"""
routes/download.py
------------------
POST   /api/download          – start a new download (async, returns entry id)
GET    /api/downloads         – list all download entries (for polling)
GET    /api/downloads/<id>    – single entry
POST   /api/downloads/<id>/pause   – pause
POST   /api/downloads/<id>/resume  – resume
POST   /api/downloads/<id>/stop    – stop
DELETE /api/downloads/<id>         – remove from registry
"""

import os
import logging
import threading
import time
import shutil
from pathlib import Path

from flask import Blueprint, request, jsonify, send_file, current_app

from services.youtube import download_media, detect_platform, is_supported_url, get_media_info
from services.ffmpeg import is_ffmpeg_available
import services.download_registry as registry
from routes.settings import load_settings, get_effective_speed_kbps

logger = logging.getLogger("mediarift.routes.download")

download_bp = Blueprint("download", __name__)



def _classify_error(msg: str) -> str:
    m = msg.lower()
    if "private" in m:          return "PRIVATE_MEDIA"
    if "age" in m and "restrict" in m: return "AGE_RESTRICTED"
    if "unavailable" in m or "deleted" in m: return "MEDIA_UNAVAILABLE"
    if "copyright" in m:        return "COPYRIGHT_BLOCKED"
    if "login" in m or "authentication" in m: return "AUTH_REQUIRED"
    if "ffmpeg" in m:           return "FFMPEG_MISSING"
    if "timeout" in m:          return "TIMEOUT"
    if "no formats" in m:       return "NO_FORMATS"
    return "DOWNLOAD_ERROR"


def _build_progress_hook(entry_id: str):
    """Return a yt-dlp progress hook that feeds into the registry."""
    last_tick = [0.0]
    last_settings_check = [0.0]

    def _hook(d):
        # Check if we should abort
        if registry.should_stop(entry_id):
            raise Exception("Download stopped by user")

        # Handle pause: spin-wait (yt-dlp calls this hook frequently)
        while registry.is_paused(entry_id):
            time.sleep(0.5)
            if registry.should_stop(entry_id):
                raise Exception("Download stopped by user")

        # Periodically check settings to support dynamic speed changes
        now = time.monotonic()
        if now - last_settings_check[0] >= 0.5:
            last_settings_check[0] = now
            try:
                settings = load_settings()
                speed_kbps = get_effective_speed_kbps(settings)
                new_ratelimit = speed_kbps * 1024 if speed_kbps > 0 else None
                
                import sys
                frame = sys._getframe(1)
                while frame:
                    local_self = frame.f_locals.get('self')
                    if local_self and (local_self.__class__.__name__ in ('HttpFD', 'FileDownloader') or hasattr(local_self, 'params')):
                        current_limit = local_self.params.get('ratelimit')
                        if current_limit != new_ratelimit:
                            local_self.params['ratelimit'] = new_ratelimit
                        break
                    frame = frame.f_back
            except Exception as e:
                logger.error("Error updating dynamic speed limit in hook: %s", e)

        status = d.get("status")
        if status == "downloading":
            downloaded = d.get("downloaded_bytes") or 0
            total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            speed = d.get("speed") or 0
            eta = d.get("eta")
            pct = int(downloaded / total * 100) if total else 0

            # Throttle updates to ~4 per second to avoid lock contention
            now = time.monotonic()
            if now - last_tick[0] >= 0.25:
                last_tick[0] = now
                registry.update(
                    entry_id,
                    state=registry.STATE_DOWNLOADING,
                    percent=pct,
                    downloaded_bytes=downloaded,
                    total_bytes=total,
                    speed_bps=int(speed),
                    eta_seconds=eta,
                )

        elif status == "finished":
            registry.update(entry_id, percent=99, speed_bps=0, state=registry.STATE_DOWNLOADING)

    return _hook


def _run_download(entry_id: str, url: str, format_id: str, download_type: str,
                  quality_label: str, thumbnail_ext: str, speed_kbps: int):
    """Background thread: perform the actual download and update the registry with auto-retries."""
    import datetime
    
    settings = load_settings()
    max_retries = int(settings.get("max_retries", 3))
    auto_retry = settings.get("auto_retry_failed", True)
    
    registry.update(
        entry_id,
        state=registry.STATE_DOWNLOADING,
        started_at=datetime.datetime.now().isoformat(timespec="seconds")
    )
    
    retry_count = 0
    
    while True:
        try:
            if registry.should_stop(entry_id):
                registry.update(entry_id, state=registry.STATE_STOPPED, speed_bps=0)
                return
                
            hook = _build_progress_hook(entry_id)
            
            # Subtitle options per-download
            sub_langs_list = [lang.strip() for lang in settings.get("subtitle_languages", "en").split(",") if lang.strip()]
            subtitles_opts = {
                "download_subtitles": settings.get("auto_download_subtitles", False),
                "subtitles_langs": sub_langs_list,
                "subtitle_format": settings.get("subtitle_format", "srt"),
                "subtitles_only": False,
                "embed_subtitles": True
            }
            
            # Read from entry subtitles_options if present
            entry = registry.get(entry_id)
            if entry and "subtitles_options" in entry:
                subtitles_opts.update(entry["subtitles_options"])
                
            result = download_media(
                url=url,
                format_id=format_id,
                download_type=download_type,
                quality_label=quality_label,
                thumbnail_ext=thumbnail_ext,
                progress_hook=hook,
                speed_kbps=speed_kbps,
                subtitles_options=subtitles_opts
            )
            filepath = result["filepath"]
            filename = result["filename"]
            mime = result["mime"]
            size = os.path.getsize(filepath) if os.path.isfile(filepath) else 0
            
            sub_langs_str = ",".join(subtitles_opts.get("subtitles_langs", [])) if subtitles_opts.get("download_subtitles") else ""
            
            registry.update(
                entry_id,
                state=registry.STATE_COMPLETED,
                percent=100,
                speed_bps=0,
                filename=filename,
                filepath=filepath,
                mime=mime,
                total_bytes=size,
                downloaded_bytes=size,
                completed_at=datetime.datetime.now().isoformat(timespec="seconds"),
                subtitle_languages=sub_langs_str,
                resume_status="completed"
            )
            logger.info("Download %s completed: %s", entry_id, filename)
            return
            
        except Exception as exc:
            msg = str(exc)
            if "stopped by user" in msg.lower() or registry.should_stop(entry_id):
                registry.update(entry_id, state=registry.STATE_STOPPED, speed_bps=0)
                return
                
            code = _classify_error(msg)
            permanent_errors = (
                "PRIVATE_MEDIA",
                "AGE_RESTRICTED",
                "MEDIA_UNAVAILABLE",
                "COPYRIGHT_BLOCKED",
                "AUTH_REQUIRED",
                "FFMPEG_MISSING",
                "NO_FORMATS"
            )
            
            should_retry = (auto_retry and retry_count < max_retries and code not in permanent_errors)
            
            if should_retry:
                retry_count += 1
                wait_sec = 5 * (2 ** (retry_count - 1))
                logger.warning("Download %s failed: %s. Retrying %d/%d in %d seconds...", entry_id, msg, retry_count, max_retries, wait_sec)
                
                now_str = datetime.datetime.now().isoformat(timespec="seconds")
                registry.update(
                    entry_id,
                    state="retrying",
                    retry_count=retry_count,
                    max_retries=max_retries,
                    retry_countdown=wait_sec,
                    last_error=msg,
                    last_retry=now_str
                )
                
                for remaining in range(wait_sec, 0, -1):
                    if registry.should_stop(entry_id):
                        registry.update(entry_id, state=registry.STATE_STOPPED, speed_bps=0)
                        return
                    time.sleep(1)
                    registry.update(entry_id, retry_countdown=remaining - 1)
                    
                registry.update(entry_id, state=registry.STATE_DOWNLOADING)
            else:
                logger.warning("Download %s failed permanently (%s): %s", entry_id, code, msg)
                registry.update(
                    entry_id,
                    state=registry.STATE_ERROR,
                    error=msg,
                    speed_bps=0,
                    last_error=msg
                )
                return



@download_bp.post("/download")
def start_download():
    """
    POST /api/download
    Body: { url, format_id, download_type, quality_label, thumbnail_ext, subtitles_options }
    Returns immediately with { id } — progress is polled via GET /api/downloads.
    """
    body = request.get_json(silent=True) or {}

    url: str = (body.get("url") or "").strip()
    format_id: str = (body.get("format_id") or "best").strip()
    download_type: str = (body.get("download_type") or "video").strip().lower()
    quality_label: str = (body.get("quality_label") or "best").strip()
    thumbnail_ext: str = (body.get("thumbnail_ext") or "jpg").strip().lower()

    if not url:
        return jsonify({"error": "Missing URL", "code": "MISSING_URL"}), 400
    if not url.startswith(("http://", "https://")):
        return jsonify({"error": "Invalid URL scheme", "code": "INVALID_URL"}), 400
    if download_type not in ("video", "audio", "thumbnail"):
        return jsonify({"error": "Invalid download_type", "code": "INVALID_DOWNLOAD_TYPE"}), 400

    platform = detect_platform(url)
    settings = load_settings()
    speed_kbps = get_effective_speed_kbps(settings)

    # Subtitles options parser
    subtitles_options = {}
    if "subtitles_options" in body:
        subtitles_options = body["subtitles_options"]
    elif "download_subtitles" in body:
        subtitles_options = {
            "download_subtitles": bool(body.get("download_subtitles")),
            "subtitles_langs": body.get("subtitles_langs") or ["en"],
            "subtitle_format": body.get("subtitle_format") or "srt",
            "subtitles_only": bool(body.get("subtitles_only")),
            "embed_subtitles": bool(body.get("embed_subtitles", True)),
            "download_all_languages": bool(body.get("download_all_languages", False))
        }

    entry_id = registry.create_entry(
        url=url,
        platform=platform,
        download_type=download_type,
        quality_label=quality_label,
        format_id=format_id,
    )

    if subtitles_options:
        registry.update(entry_id, subtitles_options=subtitles_options)

    # Fetch title in the same thread (fast) then start download in background
    try:
        info = get_media_info(url)
        registry.update(entry_id,
                        title=info.get("title", url),
                        thumbnail=info.get("thumbnail", ""))
    except Exception:
        pass  # title stays as URL — not fatal

    t = threading.Thread(
        target=_run_download,
        args=(entry_id, url, format_id, download_type, quality_label, thumbnail_ext, speed_kbps),
        daemon=True,
    )
    t.start()

    return jsonify({"success": True, "id": entry_id}), 202


@download_bp.get("/downloads")
def list_downloads():
    return jsonify({"success": True, "data": registry.list_all()}), 200


@download_bp.get("/downloads/<entry_id>")
def get_download(entry_id: str):
    entry = registry.get(entry_id)
    if not entry:
        return jsonify({"error": "Not found", "code": "NOT_FOUND"}), 404
    return jsonify({"success": True, "data": entry}), 200


@download_bp.post("/downloads/<entry_id>/pause")
def pause_download(entry_id: str):
    ok = registry.pause(entry_id)
    if not ok:
        return jsonify({"error": "Cannot pause entry", "code": "CANNOT_PAUSE"}), 409
    return jsonify({"success": True}), 200


@download_bp.post("/downloads/<entry_id>/resume")
def resume_download(entry_id: str):
    entry = registry.get(entry_id)
    if not entry:
        return jsonify({"error": "Not found", "code": "NOT_FOUND"}), 404
        
    if entry.get("state") == "Interrupted":
        # Launch new thread to resume
        settings = load_settings()
        speed_kbps = get_effective_speed_kbps(settings)
        url = entry.get("url")
        format_id = entry.get("format_id", "best")
        download_type = entry.get("download_type", "video")
        quality_label = entry.get("quality_label", "best")
        
        # Mark as resuming
        registry.update(entry_id, state="Resuming...", error="")
        
        t = threading.Thread(
            target=_run_download,
            args=(entry_id, url, format_id, download_type, quality_label, "jpg", speed_kbps),
            daemon=True
        )
        t.start()
        return jsonify({"success": True}), 200

    ok = registry.resume(entry_id)
    if not ok:
        return jsonify({"error": "Cannot resume entry", "code": "CANNOT_RESUME"}), 409
    return jsonify({"success": True}), 200


@download_bp.post("/downloads/<entry_id>/restart")
def restart_download(entry_id: str):
    entry = registry.get(entry_id)
    if not entry:
        return jsonify({"error": "Not found", "code": "NOT_FOUND"}), 404
        
    # Delete job temp files
    filepath = entry.get("filepath")
    if filepath:
        try:
            parent = os.path.dirname(filepath)
            if "temp" in parent:
                import shutil
                shutil.rmtree(parent, ignore_errors=True)
        except Exception:
            pass
            
    settings = load_settings()
    speed_kbps = get_effective_speed_kbps(settings)
    url = entry.get("url")
    format_id = entry.get("format_id", "best")
    download_type = entry.get("download_type", "video")
    quality_label = entry.get("quality_label", "best")
    
    registry.update(
        entry_id,
        state=registry.STATE_QUEUED,
        percent=0,
        downloaded_bytes=0,
        speed_bps=0,
        error=""
    )
    
    t = threading.Thread(
        target=_run_download,
        args=(entry_id, url, format_id, download_type, quality_label, "jpg", speed_kbps),
        daemon=True
    )
    t.start()
    return jsonify({"success": True}), 200


@download_bp.post("/downloads/<entry_id>/stop")
def stop_download(entry_id: str):
    registry.stop(entry_id)
    return jsonify({"success": True}), 200


@download_bp.delete("/downloads/<entry_id>")
def delete_download(entry_id: str):
    entry = registry.get(entry_id)
    if entry and entry.get("filepath") and os.path.isfile(entry["filepath"]):
        settings = load_settings()
        if settings.get("auto_remove_on_delete"):
            try:
                parent = str(Path(entry["filepath"]).parent)
                shutil.rmtree(parent, ignore_errors=True)
            except Exception:
                pass
    registry.remove(entry_id)
    return jsonify({"success": True}), 200


@download_bp.get("/downloads/<entry_id>/file")
def serve_file(entry_id: str):
    """Serve the completed file for download (browser save dialog)."""
    entry = registry.get(entry_id)
    if not entry:
        return jsonify({"error": "Not found"}), 404
    filepath = entry.get("filepath", "")
    if not filepath or not os.path.isfile(filepath):
        return jsonify({"error": "File not available"}), 404
    return send_file(
        filepath,
        mimetype=entry.get("mime", "application/octet-stream"),
        as_attachment=True,
        download_name=entry.get("filename", "download"),
    )


@download_bp.post("/downloads/<entry_id>/open-folder")
def open_folder(entry_id: str):
    """Open the folder containing the completed download in the OS file manager.
    Windows: explorer /select,<path>  (highlights the file in Explorer)
    macOS:   open -R <path>
    Linux:   xdg-open <parent-dir>
    """
    import subprocess
    import platform as _platform

    entry = registry.get(entry_id)
    if not entry:
        return jsonify({"error": "Not found", "code": "NOT_FOUND"}), 404

    filepath = entry.get("filepath", "")

    try:
        sys_platform = _platform.system()
        if sys_platform == "Windows":
            if filepath and os.path.isfile(filepath):
                subprocess.Popen(["explorer", "/select,", os.path.normpath(filepath)])
            else:
                folder = os.path.dirname(filepath) if filepath else os.path.expanduser("~/Downloads")
                subprocess.Popen(["explorer", os.path.normpath(folder)])
        elif sys_platform == "Darwin":
            if filepath and os.path.isfile(filepath):
                subprocess.Popen(["open", "-R", filepath])
            else:
                folder = os.path.dirname(filepath) if filepath else os.path.expanduser("~/Downloads")
                subprocess.Popen(["open", folder])
        else:
            folder = os.path.dirname(filepath) if (filepath and os.path.isfile(filepath)) else os.path.expanduser("~/Downloads")
            subprocess.Popen(["xdg-open", folder])

        return jsonify({"success": True}), 200
    except Exception as exc:
        logger.warning("open-folder failed: %s", exc)
        return jsonify({"error": str(exc), "code": "OPEN_FAILED"}), 500


def get_windows_clipboard() -> str:
    import ctypes
    CF_UNICODETEXT = 13
    user32 = ctypes.windll.user32
    if not user32.OpenClipboard(None):
        return ""
    try:
        if user32.IsClipboardFormatAvailable(CF_UNICODETEXT):
            h_clip_mem = user32.GetClipboardData(CF_UNICODETEXT)
            if h_clip_mem:
                user32.GlobalLock.restype = ctypes.c_void_p
                user32.GlobalLock.argtypes = [ctypes.c_void_p]
                user32.GlobalUnlock.argtypes = [ctypes.c_void_p]
                p_clip_mem = user32.GlobalLock(h_clip_mem)
                if p_clip_mem:
                    text = ctypes.wstring_at(p_clip_mem)
                    user32.GlobalUnlock(h_clip_mem)
                    return text
    finally:
        user32.CloseClipboard()
    return ""


def is_valid_media_url(url: str) -> bool:
    import re
    # Match common media sharing domains
    pattern = re.compile(
        r'^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be|vimeo\.com|tiktok\.com|instagram\.com|facebook\.com|twitter\.com|x\.com)\/\S+$',
        re.IGNORECASE
    )
    return bool(pattern.match(url))


@download_bp.post("/clipboard/detect")
def detect_clipboard():
    body = request.get_json(silent=True) or {}
    last_url = body.get("last_url", "").strip()
    
    text = ""
    try:
        import sys
        if sys.platform == "win32":
            text = get_windows_clipboard()
        else:
            import shutil
            if shutil.which("pbpaste"):
                import subprocess
                text = subprocess.check_output("pbpaste", text=True, shell=True).strip()
            elif shutil.which("xclip"):
                import subprocess
                text = subprocess.check_output("xclip -selection clipboard -o", text=True, shell=True).strip()
    except Exception as e:
        logger.debug("Failed reading clipboard: %s", e)
        
    text = text.strip()
    if text and text != last_url and is_valid_media_url(text):
        return jsonify({"detected": True, "url": text}), 200
        
    return jsonify({"detected": False}), 200
