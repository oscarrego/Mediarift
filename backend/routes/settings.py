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

logger = logging.getLogger("ytshort.routes.settings")

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
        return database.save_db_settings(data)
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
        limit = SPEED_PRESETS.get(preset, 0)
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
