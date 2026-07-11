"""
routes/info.py
--------------
POST /api/info  – fetch media metadata without downloading.
GET  /api/health – detailed health check (ffmpeg, yt-dlp status).
"""

import logging
from flask import Blueprint, request, jsonify, current_app

from services.youtube import get_media_info, detect_platform, is_supported_url
from services.ffmpeg import is_ffmpeg_available, get_ffmpeg_version

logger = logging.getLogger("ytshort.routes.info")

info_bp = Blueprint("info", __name__)



def _validate_url(url: str | None) -> tuple[str | None, dict | None]:
    """
    Validate a URL string.
    Returns (clean_url, None) on success or (None, error_response) on failure.
    Accepts any http/https URL — yt-dlp handles platform support at runtime.
    """
    if not url or not isinstance(url, str):
        return None, {"error": "Missing URL", "code": "MISSING_URL"}

    url = url.strip()

    if len(url) > 4096:
        return None, {"error": "URL is too long", "code": "URL_TOO_LONG"}

    if not url.startswith(("http://", "https://")):
        return None, {"error": "URL must start with http:// or https://", "code": "INVALID_URL_SCHEME"}

    return url, None



@info_bp.post("/info")
def fetch_info():
    """
    POST /api/info
    Body: { "url": "https://..." }
    Returns structured media metadata.
    """
    body = request.get_json(silent=True) or {}
    raw_url = body.get("url")

    url, err = _validate_url(raw_url)
    if err:
        return jsonify(err), 400

    try:
        info = get_media_info(url)
        return jsonify({"success": True, "data": info}), 200

    except ValueError as exc:
        logger.warning("Validation error for %s: %s", url, exc)
        return jsonify({"error": str(exc), "code": "VALIDATION_ERROR"}), 400

    except RuntimeError as exc:
        msg = str(exc)
        logger.warning("Runtime error for %s: %s", url, msg)
        code = _classify_error(msg)
        return jsonify({"error": msg, "code": code}), 422

    except Exception as exc:
        logger.exception("Unexpected error fetching info for %s", url)
        return jsonify({
            "error": "An unexpected error occurred while fetching media information.",
            "code": "SERVER_ERROR",
        }), 500


@info_bp.get("/health")
def health_detail():
    """
    GET /api/health
    Returns detailed status of backend dependencies.
    """
    import yt_dlp  # local import to avoid circular
    ffmpeg_ok = is_ffmpeg_available()
    ffmpeg_ver = get_ffmpeg_version() if ffmpeg_ok else None

    try:
        ytdlp_ver = yt_dlp.version.__version__
    except Exception:
        ytdlp_ver = "unknown"

    return jsonify({
        "status": "ok",
        "app": "Mediarift App",
        "version": current_app.config.get("APP_VERSION", "1.0.0"),
        "dependencies": {
            "ffmpeg": {
                "available": ffmpeg_ok,
                "version": ffmpeg_ver,
            },
            "ytdlp": {
                "available": True,
                "version": ytdlp_ver,
            },
        },
    }), 200



def _classify_error(msg: str) -> str:
    msg_lower = msg.lower()
    if "private" in msg_lower:
        return "PRIVATE_MEDIA"
    if "age" in msg_lower and "restrict" in msg_lower:
        return "AGE_RESTRICTED"
    if "unavailable" in msg_lower or "deleted" in msg_lower:
        return "MEDIA_UNAVAILABLE"
    if "copyright" in msg_lower:
        return "COPYRIGHT_BLOCKED"
    if "login" in msg_lower or "authentication" in msg_lower:
        return "AUTH_REQUIRED"
    if "no formats" in msg_lower:
        return "NO_FORMATS"
    return "DOWNLOAD_ERROR"
