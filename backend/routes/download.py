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

logger = logging.getLogger("ytshort.routes.download")

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

    def _hook(d):
        # Check if we should abort
        if registry.should_stop(entry_id):
            raise Exception("Download stopped by user")

        # Handle pause: spin-wait (yt-dlp calls this hook frequently)
        while registry.is_paused(entry_id):
            time.sleep(0.5)
            if registry.should_stop(entry_id):
                raise Exception("Download stopped by user")

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
    """Background thread: perform the actual download and update the registry."""
    import datetime
    registry.update(entry_id, state=registry.STATE_DOWNLOADING,
                    started_at=datetime.datetime.now().isoformat(timespec="seconds"))

    try:
        hook = _build_progress_hook(entry_id)
        result = download_media(
            url=url,
            format_id=format_id,
            download_type=download_type,
            quality_label=quality_label,
            thumbnail_ext=thumbnail_ext,
            progress_hook=hook,
            speed_kbps=speed_kbps,
        )
        filepath = result["filepath"]
        filename = result["filename"]
        mime = result["mime"]
        size = os.path.getsize(filepath) if os.path.isfile(filepath) else 0

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
        )
        logger.info("Download %s completed: %s", entry_id, filename)

    except Exception as exc:
        msg = str(exc)
        if "stopped by user" in msg.lower():
            registry.update(entry_id, state=registry.STATE_STOPPED, speed_bps=0)
        else:
            code = _classify_error(msg)
            logger.warning("Download %s failed (%s): %s", entry_id, code, msg)
            registry.update(entry_id, state=registry.STATE_ERROR, error=msg, speed_bps=0)



@download_bp.post("/download")
def start_download():
    """
    POST /api/download
    Body: { url, format_id, download_type, quality_label, thumbnail_ext }
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

    entry_id = registry.create_entry(
        url=url,
        platform=platform,
        download_type=download_type,
        quality_label=quality_label,
        format_id=format_id,
    )

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
    ok = registry.resume(entry_id)
    if not ok:
        return jsonify({"error": "Cannot resume entry", "code": "CANNOT_RESUME"}), 409
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
