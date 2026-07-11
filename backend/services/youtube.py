"""
services/youtube.py
-------------------
All yt-dlp interactions are isolated here.
Supports any URL that yt-dlp can handle — YouTube, Instagram, TikTok,
Facebook, Twitter/X, Pinterest, Vimeo, Reddit, Dailymotion, Twitch, and more.
"""

import os
import re
import time
import uuid
import logging
import subprocess
from pathlib import Path
from typing import Any

import yt_dlp

from config import ActiveConfig as cfg

logger = logging.getLogger("ytshort.youtube")

PLATFORM_PATTERNS: dict[str, list[str]] = {
    "youtube": [
        r"(?:https?://)?(?:www\.)?youtube\.com/watch",
        r"(?:https?://)?(?:www\.)?youtube\.com/shorts/",
        r"(?:https?://)?youtu\.be/",
        r"(?:https?://)?(?:www\.)?youtube\.com/live/",
        r"(?:https?://)?(?:www\.)?youtube\.com/embed/",
        r"(?:https?://)?(?:m\.)?youtube\.com/",
    ],
    "instagram": [
        r"(?:https?://)?(?:www\.)?instagram\.com/reel/",
        r"(?:https?://)?(?:www\.)?instagram\.com/p/",
        r"(?:https?://)?(?:www\.)?instagram\.com/tv/",
        r"(?:https?://)?(?:www\.)?instagram\.com/stories/",
    ],
    "tiktok": [
        r"(?:https?://)?(?:www\.)?tiktok\.com/",
        r"(?:https?://)?vm\.tiktok\.com/",
    ],
    "twitter": [
        r"(?:https?://)?(?:www\.)?twitter\.com/",
        r"(?:https?://)?(?:www\.)?x\.com/",
    ],
    "facebook": [
        r"(?:https?://)?(?:www\.)?facebook\.com/",
        r"(?:https?://)?fb\.watch/",
    ],
    "vimeo": [
        r"(?:https?://)?(?:www\.)?vimeo\.com/",
    ],
    "pinterest": [
        r"(?:https?://)?(?:www\.)?pinterest\.com/",
        r"(?:https?://)?pin\.it/",
    ],
    "reddit": [
        r"(?:https?://)?(?:www\.)?reddit\.com/",
        r"(?:https?://)?redd\.it/",
    ],
    "dailymotion": [
        r"(?:https?://)?(?:www\.)?dailymotion\.com/",
    ],
    "twitch": [
        r"(?:https?://)?(?:www\.)?twitch\.tv/",
    ],
}


def detect_platform(url: str) -> str:
    """Return the platform name for a given URL or 'unknown'."""
    for platform, patterns in PLATFORM_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, url, re.IGNORECASE):
                return platform
    return "unknown"


def is_supported_url(url: str) -> bool:
    """Accept any http/https URL — yt-dlp handles support detection at runtime."""
    if not url:
        return False
    return url.strip().startswith(("http://", "https://"))



def _base_opts() -> dict[str, Any]:
    """Common yt-dlp options shared across all operations."""
    opts: dict[str, Any] = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "socket_timeout": 30,
        "retries": 3,
        "fragment_retries": 3,
        "js_runtimes": {"node": {}},
    }
    
    # Auto-detect cookies.txt in config, backend, or project root
    backend_dir = Path(__file__).parent.parent.resolve()
    cookies_paths = [
        cfg.COOKIES_FILE,
        str(backend_dir / "cookies.txt"),
        str(backend_dir.parent / "cookies.txt"),
    ]
    for cp in cookies_paths:
        if cp and os.path.isfile(cp):
            opts["cookiefile"] = cp
            logger.info("Using cookies file: %s", cp)
            break

    if cfg.PROXY:
        opts["proxy"] = cfg.PROXY
    if cfg.FFMPEG_PATH:
        opts["ffmpeg_location"] = cfg.FFMPEG_PATH
    return opts


def _extract_info(ydl_opts: dict[str, Any], url: str, download: bool = False) -> dict[str, Any]:
    """Wrapper around yt_dlp.YoutubeDL.extract_info with automatic browser cookies fallback."""
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            return ydl.extract_info(url, download=download)
    except yt_dlp.utils.DownloadError as exc:
        msg = str(exc).lower()
        # If blocked by YouTube as bot or login required, attempt browser cookie fallback
        if "sign in" in msg or "login required" in msg or "confirm you're not a bot" in msg:
            browsers = ["chrome", "brave", "edge", "firefox", "opera", "safari"]
            for browser in browsers:
                try:
                    logger.info("Attempting cookies fallback from browser: %s", browser)
                    fallback_opts = {**ydl_opts, "cookiesfrombrowser": (browser,)}
                    with yt_dlp.YoutubeDL(fallback_opts) as ydl_c:
                        return ydl_c.extract_info(url, download=download)
                except Exception as e:
                    logger.debug("Failed loading cookies from browser %s: %s", browser, e)
                    continue
        raise exc



def get_media_info(url: str) -> dict[str, Any]:
    """
    Fetch metadata for a URL using yt-dlp.
    Returns a structured dict ready to be sent to the frontend.
    Raises RuntimeError on failure.
    Accepts any http/https URL that yt-dlp supports.
    """
    platform = detect_platform(url)

    ydl_opts = {
        **_base_opts(),
        "skip_download": True,
    }

    try:
        raw = _extract_info(ydl_opts, url, download=False)
    except yt_dlp.utils.DownloadError as exc:
        _handle_ydl_error(exc)
    except Exception as exc:
        logger.exception("Unexpected yt-dlp error for %s", url)
        raise RuntimeError(f"Failed to fetch media info: {exc}") from exc

    return _parse_info(raw, platform, url)


def _parse_info(raw: dict, platform: str, url: str) -> dict[str, Any]:
    """Transform raw yt-dlp info dict into a clean frontend-friendly dict."""
    # Thumbnail: prefer the highest-resolution non-webp thumbnail when available
    thumbnail = _best_thumbnail(raw.get("thumbnails") or []) or raw.get("thumbnail", "")

    duration_secs: int = raw.get("duration") or 0
    duration_str = _format_duration(duration_secs)

    views = raw.get("view_count")

    upload_date_raw: str = raw.get("upload_date", "")
    upload_date = _format_date(upload_date_raw)

    formats = _parse_formats(raw.get("formats") or [])

    best_res = _best_resolution(raw.get("formats") or [])

    filesize = _estimate_filesize(raw.get("formats") or [])

    return {
        "title": raw.get("title", "Unknown Title"),
        "thumbnail": thumbnail,
        "platform": platform,
        "uploader": raw.get("uploader") or raw.get("channel") or raw.get("creator") or "Unknown",
        "uploader_url": raw.get("uploader_url") or raw.get("channel_url") or "",
        "duration": duration_str,
        "duration_seconds": duration_secs,
        "views": views,
        "upload_date": upload_date,
        "description": (raw.get("description") or "")[:500],
        "video_id": raw.get("id", ""),
        "webpage_url": raw.get("webpage_url") or url,
        "best_resolution": best_res,
        "filesize_approx": filesize,
        "formats": formats,
        "video_type": _detect_video_type(platform, raw),
    }


def _best_thumbnail(thumbnails: list[dict]) -> str:
    if not thumbnails:
        return ""
    # Sort by resolution preference, avoid webp when possible
    scored = []
    for t in thumbnails:
        w = t.get("width") or 0
        h = t.get("height") or 0
        url = t.get("url", "")
        is_webp = url.lower().endswith(".webp")
        scored.append((w * h, not is_webp, url))
    scored.sort(key=lambda x: (x[0], x[1]), reverse=True)
    return scored[0][2] if scored else ""


def _format_duration(seconds: int) -> str:
    if not seconds:
        return "Unknown"
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    if h:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"


def _format_date(raw: str) -> str:
    if len(raw) == 8:
        try:
            return f"{raw[0:4]}-{raw[4:6]}-{raw[6:8]}"
        except Exception:
            pass
    return raw or "Unknown"


def _parse_formats(formats: list[dict]) -> list[dict]:
    """Return a clean list of available download formats."""
    seen_labels: set[str] = set()
    result: list[dict] = []

    # Video+Audio combined or video-only, sorted by quality descending
    video_formats = [
        f for f in formats
        if f.get("vcodec", "none") != "none"
        and f.get("ext") not in ("mhtml",)
        and f.get("protocol") not in ("mhtml", "http_dash_segments_generator")
    ]

    # Sort by height descending, then by filesize descending
    video_formats.sort(
        key=lambda f: (f.get("height") or 0, f.get("filesize") or f.get("filesize_approx") or 0),
        reverse=True,
    )

    for f in video_formats:
        height = f.get("height")
        if not height:
            continue
        label = f"{height}p"
        if label in seen_labels:
            continue
        seen_labels.add(label)
        has_audio = f.get("acodec", "none") != "none"
        result.append({
            "format_id": f.get("format_id", ""),
            "label": label,
            "height": height,
            "ext": f.get("ext", "mp4"),
            "filesize": f.get("filesize") or f.get("filesize_approx"),
            "has_audio": has_audio,
            "needs_merge": not has_audio,
            "vcodec": f.get("vcodec", ""),
            "acodec": f.get("acodec", "none"),
            "fps": f.get("fps"),
            "tbr": f.get("tbr"),
        })

    audio_formats = [
        f for f in formats
        if f.get("vcodec", "none") == "none"
        and f.get("acodec", "none") != "none"
        and f.get("ext") not in ("mhtml",)
    ]
    audio_formats.sort(
        key=lambda f: f.get("abr") or f.get("tbr") or 0,
        reverse=True,
    )
    if audio_formats:
        best_audio = audio_formats[0]
        result.append({
            "format_id": best_audio.get("format_id", ""),
            "label": "Audio Only",
            "height": 0,
            "ext": "mp3",
            "filesize": best_audio.get("filesize") or best_audio.get("filesize_approx"),
            "has_audio": True,
            "needs_merge": False,
            "vcodec": "none",
            "acodec": best_audio.get("acodec", ""),
            "fps": None,
            "tbr": best_audio.get("abr") or best_audio.get("tbr"),
        })

    return result


def _best_resolution(formats: list[dict]) -> str:
    heights = [f.get("height") for f in formats if f.get("height")]
    if not heights:
        return "Unknown"
    return f"{max(heights)}p"


def _estimate_filesize(formats: list[dict]) -> int | None:
    for f in sorted(formats, key=lambda x: x.get("height") or 0, reverse=True):
        size = f.get("filesize") or f.get("filesize_approx")
        if size:
            return size
    return None


def _detect_video_type(platform: str, raw: dict) -> str:
    webpage_url: str = raw.get("webpage_url") or ""
    if platform == "youtube":
        if "/shorts/" in webpage_url:
            return "Short"
        if "/live/" in webpage_url or raw.get("is_live"):
            return "Live"
        return "Video"
    if platform == "instagram":
        if "/reel/" in webpage_url:
            return "Reel"
        if "/stories/" in webpage_url:
            return "Story"
        return "Video"
    return "Video"



def download_media(
    url: str,
    format_id: str,
    download_type: str,  # "video" | "audio" | "thumbnail"
    quality_label: str,
    thumbnail_ext: str = "jpg",
    progress_hook=None,
    speed_kbps: int = 0,   # 0 = unlimited; >0 = KB/s rate limit
) -> dict[str, Any]:
    """
    Download media to TEMP_DIR.
    Returns {"filepath": str, "filename": str, "mime": str}.
    Raises RuntimeError on failure.
    Accepts any http/https URL that yt-dlp supports.
    """
    # Unique temp subdirectory per download to avoid collisions
    job_id = uuid.uuid4().hex
    job_dir = Path(cfg.TEMP_DIR) / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    try:
        if download_type == "thumbnail":
            return _download_thumbnail(url, job_dir, thumbnail_ext=thumbnail_ext)
        if download_type == "audio":
            return _download_audio(url, job_dir, progress_hook, speed_kbps)
        return _download_video(url, format_id, quality_label, job_dir, progress_hook, speed_kbps)
    except Exception:
        _cleanup_dir(job_dir)
        raise


def _download_video(
    url: str,
    format_id: str,
    quality_label: str,
    job_dir: Path,
    progress_hook,
    speed_kbps: int = 0,
) -> dict[str, Any]:
    """Download video (merging audio stream if necessary)."""
    outtmpl = str(job_dir / "%(title)s.%(ext)s")

    # Build format selector
    if format_id and format_id != "best":
        # Try to merge with best audio; fallback to format alone
        fmt_selector = f"{format_id}+bestaudio[ext=m4a]/({format_id}+bestaudio)/{format_id}/best"
    else:
        fmt_selector = "bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best"

    ydl_opts: dict[str, Any] = {
        **_base_opts(),
        "format": fmt_selector,
        "outtmpl": outtmpl,
        "merge_output_format": "mp4",
        "postprocessors": [
            {
                "key": "FFmpegVideoConvertor",
                "preferedformat": "mp4",
            }
        ],
    }
    if speed_kbps and speed_kbps > 0:
        ydl_opts["ratelimit"] = speed_kbps * 1024  # bytes/s
    if progress_hook:
        ydl_opts["progress_hooks"] = [progress_hook]
    if cfg.FFMPEG_PATH:
        ydl_opts["ffmpeg_location"] = cfg.FFMPEG_PATH

    try:
        info = _extract_info(ydl_opts, url, download=True)
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            filepath = ydl.prepare_filename(info)
    except yt_dlp.utils.DownloadError as exc:
        _handle_ydl_error(exc)

    # yt-dlp may change the extension after merging
    filepath = _resolve_actual_file(filepath, job_dir)
    filename = _sanitize_filename(Path(filepath).name)

    return {"filepath": str(filepath), "filename": filename, "mime": "video/mp4"}


def _download_audio(url: str, job_dir: Path, progress_hook, speed_kbps: int = 0) -> dict[str, Any]:
    outtmpl = str(job_dir / "%(title)s.%(ext)s")

    ydl_opts: dict[str, Any] = {
        **_base_opts(),
        "format": "bestaudio/best",
        "outtmpl": outtmpl,
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "192",
            }
        ],
    }
    if speed_kbps and speed_kbps > 0:
        ydl_opts["ratelimit"] = speed_kbps * 1024
    if progress_hook:
        ydl_opts["progress_hooks"] = [progress_hook]
    if cfg.FFMPEG_PATH:
        ydl_opts["ffmpeg_location"] = cfg.FFMPEG_PATH

    try:
        info = _extract_info(ydl_opts, url, download=True)
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            filepath = ydl.prepare_filename(info)
    except yt_dlp.utils.DownloadError as exc:
        _handle_ydl_error(exc)

    filepath = _resolve_actual_file(filepath, job_dir, preferred_ext=".mp3")
    filename = _sanitize_filename(Path(filepath).name)

    return {"filepath": str(filepath), "filename": filename, "mime": "audio/mpeg"}


def _download_thumbnail(url: str, job_dir: Path, thumbnail_ext: str = "jpg") -> dict[str, Any]:
    """
    Extract and save the best thumbnail image, converting to the requested format.
    thumbnail_ext: 'jpg' | 'png' | 'webp'
    """
    # Normalise requested extension
    target_ext = thumbnail_ext.lower().strip(".")
    if target_ext not in ("jpg", "jpeg", "png", "webp"):
        target_ext = "jpg"
    # Treat jpeg/jpg as the same
    if target_ext == "jpeg":
        target_ext = "jpg"

    ydl_opts: dict[str, Any] = {
        **_base_opts(),
        "skip_download": True,
        "writethumbnail": True,
        "outtmpl": str(job_dir / "%(title)s.%(ext)s"),
    }

    try:
        info = _extract_info(ydl_opts, url, download=True)
    except yt_dlp.utils.DownloadError as exc:
        _handle_ydl_error(exc)

    # Find the written thumbnail file
    image_exts = {".jpg", ".jpeg", ".png", ".webp"}
    source_file: Path | None = None
    for f in job_dir.iterdir():
        if f.suffix.lower() in image_exts:
            source_file = f
            break

    if source_file is None:
        raise RuntimeError("Thumbnail file not found after download.")

    # If the file is already in the desired format, return it as-is
    current_ext = source_file.suffix.lower().lstrip(".")
    if current_ext == "jpeg":
        current_ext = "jpg"

    if current_ext == target_ext:
        filename = _sanitize_filename(source_file.name)
        mime = _thumb_mime(target_ext)
        return {"filepath": str(source_file), "filename": filename, "mime": mime}

    # Convert using Pillow
    try:
        from PIL import Image
        img = Image.open(source_file)
        # JPEG doesn't support transparency — convert to RGB
        if target_ext in ("jpg",) and img.mode in ("RGBA", "P", "LA"):
            img = img.convert("RGB")
        out_stem = source_file.stem
        out_name = f"{out_stem}.{target_ext}"
        out_path = job_dir / out_name
        pil_format = "JPEG" if target_ext == "jpg" else target_ext.upper()
        save_kwargs: dict = {}
        if pil_format == "JPEG":
            save_kwargs["quality"] = 95
        img.save(out_path, format=pil_format, **save_kwargs)
        img.close()
        try:
            source_file.unlink()
        except Exception:
            pass
        filename = _sanitize_filename(out_name)
        return {"filepath": str(out_path), "filename": filename, "mime": _thumb_mime(target_ext)}
    except ImportError:
        # Pillow not installed — fall back to returning the original file
        logger.warning("Pillow not installed; returning thumbnail in original format (%s)", current_ext)
        filename = _sanitize_filename(source_file.name)
        return {"filepath": str(source_file), "filename": filename, "mime": _thumb_mime(current_ext)}
    except Exception as exc:
        logger.warning("Thumbnail conversion failed (%s -> %s): %s", current_ext, target_ext, exc)
        filename = _sanitize_filename(source_file.name)
        return {"filepath": str(source_file), "filename": filename, "mime": _thumb_mime(current_ext)}


def _thumb_mime(ext: str) -> str:
    """Return the MIME type for a thumbnail extension."""
    return {
        "jpg":  "image/jpeg",
        "jpeg": "image/jpeg",
        "png":  "image/png",
        "webp": "image/webp",
    }.get(ext.lower(), "image/jpeg")



def _resolve_actual_file(expected_path: str, job_dir: Path, preferred_ext: str = ".mp4") -> str:
    """
    yt-dlp sometimes changes the file extension after postprocessing.
    Walk the job directory to find the actual output file.
    """
    if os.path.isfile(expected_path):
        return expected_path

    stem = Path(expected_path).stem
    for ext in (preferred_ext, ".mp4", ".mkv", ".webm", ".mp3", ".m4a", ".opus"):
        candidate = job_dir / (stem + ext)
        if candidate.is_file():
            return str(candidate)

    # Last resort: any non-temp file in job_dir
    for f in sorted(job_dir.iterdir(), key=lambda x: x.stat().st_size, reverse=True):
        if f.is_file() and not f.name.startswith("."):
            return str(f)

    raise RuntimeError(f"Downloaded file not found in {job_dir}")


def _sanitize_filename(name: str) -> str:
    """Remove path traversal characters and keep the filename safe."""
    name = os.path.basename(name)
    name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", name)
    name = re.sub(r"[_\s]{2,}", "_", name).strip("_. ")
    base, ext = os.path.splitext(name)
    if len(base) > 200:
        base = base[:200]
    return base + ext if base else "download" + ext


def _cleanup_dir(directory: Path) -> None:
    """Remove all files in a directory then the directory itself."""
    try:
        for f in directory.iterdir():
            try:
                f.unlink()
            except Exception:
                pass
        directory.rmdir()
    except Exception:
        pass


def _handle_ydl_error(exc: yt_dlp.utils.DownloadError) -> None:
    """Map yt-dlp error messages to human-readable RuntimeErrors."""
    msg = str(exc).lower()
    if "private" in msg:
        raise RuntimeError("This media is private and cannot be downloaded.")
    if "age" in msg and "restrict" in msg:
        raise RuntimeError("This media is age-restricted. Sign-in cookies are required.")
    if "unavailable" in msg or "not available" in msg:
        raise RuntimeError("This media is unavailable in your region or has been deleted.")
    if "copyright" in msg:
        raise RuntimeError("This media has been blocked due to a copyright claim.")
    if "no video formats" in msg or "no formats" in msg:
        raise RuntimeError("No downloadable formats were found for this URL.")
    if "unsupported url" in msg:
        raise RuntimeError("This URL is not supported by the downloader.")
    if "login required" in msg or "sign in" in msg or "confirm you're not a bot" in msg:
        raise RuntimeError(
            "This video requires authentication (Sign in to confirm you're not a bot). "
            "Please export your YouTube cookies to a 'cookies.txt' file (using a browser extension like 'Get cookies.txt LOCALLY') "
            "and place it in the application's backend folder to download."
        )
    logger.error("yt-dlp DownloadError: %s", exc)
    raise RuntimeError(f"Download failed: {exc}")
