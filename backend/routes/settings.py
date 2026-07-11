"""
routes/settings.py
------------------
GET  /api/settings  – return current user settings
POST /api/settings  – update and persist user settings
"""

import json
import logging
import os
from pathlib import Path
from flask import Blueprint, jsonify, request

logger = logging.getLogger("mediarift.routes.settings")

settings_bp = Blueprint("settings", __name__)

DEFAULT_SETTINGS = {
    "theme": "dark",
    "speed_preset": "high",        # low | medium | high | max | custom
    "speed_limit_kbps": 0,         # 0 = unlimited; >0 = KB/s
    "max_concurrent_downloads": 3,
    "snail_mode": False,
    "snail_speed_kbps": 50,
    "download_folder": "",          # empty = use backend default
    "launch_at_startup": False,
    "auto_remove_on_delete": True,
    "auto_remove_deleted": True,    # remove deleted files from list
    "auto_remove_completed": False, # remove completed downloads from list
    "auto_retry_failed": False,     # auto-retry failed downloads
    "font_size": 13,                # UI font size in px (11-18)
    "window_width": 1280,
    "window_height": 720,
    "window_x": None,
    "window_y": None,
    
    # New Downloader settings
    "max_retries": 3,
    "clipboard_detection": False,
    "auto_open_download_dialog": True,
    "resume_interrupted_downloads": True,
    "auto_download_subtitles": False,
    "subtitle_format": "srt",       # srt | vtt | ass
    "subtitle_languages": "en",     # comma-separated list of formats/languages
    
    # New Compression settings
    "preferred_gpu_encoder": "auto", # auto | cpu | nvenc | qsv | amf
    "compression_preset": "balanced", # fast | balanced | max_compression | archival_quality
    "image_optimization_level": "high", # low | medium | high
    "video_optimization_level": "balanced", # fast | balanced | max_compression | archival
    "audio_quality": "high",        # low | medium | high | archival
    "use_max_quality_algorithms": False,

    # Dynamic Traffic limit presets
    "preset_low_speed_kbps": 256,
    "preset_medium_speed_kbps": 2048,
    "preset_high_speed_kbps": 0,
    "preset_max_speed_kbps": 0,
    "preset_low_max_conn": 15,
    "preset_medium_max_conn": 50,
    "preset_high_max_conn": 200,
    "preset_max_max_conn": 200,
    "preset_low_server_conn": 5,
    "preset_medium_server_conn": 8,
    "preset_high_server_conn": 15,
    "preset_max_server_conn": 15,
    "preset_low_max_downloads": 2,
    "preset_medium_max_downloads": 3,
    "preset_high_max_downloads": 4,
    "preset_max_max_downloads": 0
}

SPEED_PRESETS = {
    "low":    256,    # 256 KB/s
    "medium": 2048,   # 2 MB/s
    "high":   0,      # unlimited (but labelled High)
    "max":    0,      # truly unlimited
}


def _settings_file() -> Path:
    from config import ActiveConfig as cfg
    return Path(getattr(cfg, "SETTINGS_FILE", Path(cfg.TEMP_DIR).parent / "user_settings.json"))


def validate_settings(data: dict) -> dict:
    """Validate every settings field, ignoring invalid values and ensuring type safety."""
    validated = {}
    for k, default_v in DEFAULT_SETTINGS.items():
        if k not in data:
            continue
        val = data[k]
        
        # Type alignment
        if isinstance(default_v, bool):
            if isinstance(val, (bool, int)):
                validated[k] = bool(val)
        elif isinstance(default_v, int):
            try:
                validated[k] = int(val)
            except (ValueError, TypeError):
                pass
        elif isinstance(default_v, str):
            if isinstance(val, str):
                validated[k] = val
        elif default_v is None:
            if val is None or isinstance(val, int):
                validated[k] = val
                
    # Range / Enum constraints validation
    if "theme" in validated and validated["theme"] not in ("light", "dark"):
        validated["theme"] = "dark"
    if "font_size" in validated:
        validated["font_size"] = min(18, max(11, validated["font_size"]))
    if "max_retries" in validated:
        validated["max_retries"] = min(10, max(0, validated["max_retries"]))
    if "subtitle_format" in validated and validated["subtitle_format"] not in ("srt", "vtt", "ass"):
        validated["subtitle_format"] = "srt"
    if "preferred_gpu_encoder" in validated and validated["preferred_gpu_encoder"] not in ("auto", "cpu", "nvenc", "qsv", "amf"):
        validated["preferred_gpu_encoder"] = "auto"
    if "compression_preset" in validated and validated["compression_preset"] not in ("fast", "balanced", "max_compression", "archival_quality"):
        validated["compression_preset"] = "balanced"
        
    return validated


def load_settings() -> dict:
    """Load settings from database, falling back to defaults."""
    import database
    try:
        return database.load_db_settings()
    except Exception as exc:
        logger.warning("Failed to load settings from DB: %s", exc)
    return dict(DEFAULT_SETTINGS)


def save_settings(data: dict) -> dict:
    """Merge data into current settings and persist to database. Returns merged settings."""
    import database
    try:
        validated_data = validate_settings(data)
        return database.save_db_settings(validated_data)
    except Exception as exc:
        logger.error("Failed to save settings to DB: %s", exc)
        raise exc



def get_effective_speed_kbps(settings: dict | None = None) -> int:
    """
    Return the effective rate limit in KB/s (0 = unlimited).
    Snail mode overrides the preset.
    """
    if settings is None:
        settings = load_settings()
    if settings.get("snail_mode"):
        return int(settings.get("snail_speed_kbps", 50))
    limit = int(settings.get("speed_limit_kbps", 0))
    if limit == 0:
        preset = settings.get("speed_preset", "high")
        preset_key = f"preset_{preset}_speed_kbps"
        limit = int(settings.get(preset_key, 0))
    return limit


@settings_bp.get("/settings")
def get_settings():
    return jsonify({"success": True, "data": load_settings()}), 200


@settings_bp.post("/settings")
def update_settings():
    body = request.get_json(silent=True) or {}
    if not body:
        return jsonify({"error": "Empty request body", "code": "EMPTY_BODY"}), 400
    try:
        merged = save_settings(body)
        return jsonify({"success": True, "data": merged}), 200
    except Exception as exc:
        logger.exception("Failed to save settings: %s", exc)
        return jsonify({"error": "Failed to save settings", "code": "SAVE_ERROR"}), 500
