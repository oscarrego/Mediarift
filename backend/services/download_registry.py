"""
services/download_registry.py
------------------------------
In-memory download registry with JSON persistence.  Tracks all active, paused,
queued, and completed downloads so the frontend can poll GET /api/downloads.
Completed/stopped/error entries are persisted to history.json so the history
survives backend restarts — just like FDM keeps tabs on old downloads.
"""

import json
import os
import threading
import time
import uuid
import logging
from pathlib import Path
from typing import Any
from config import ActiveConfig as cfg

logger = logging.getLogger("ytshort.download_registry")

# Persist history next to user_settings.json
_HISTORY_PATH = Path(cfg.SETTINGS_FILE).parent / "download_history.json"

# ── Download states ─────────────────────────────────────────────────────────
STATE_QUEUED     = "queued"
STATE_FETCHING   = "fetching"   # fetching media info
STATE_DOWNLOADING = "downloading"
STATE_PAUSED     = "paused"
STATE_COMPLETED  = "completed"
STATE_ERROR      = "error"
STATE_STOPPED    = "stopped"

_lock = threading.Lock()
_downloads: dict[str, dict] = {}   # id -> entry dict


def _load_history() -> None:
    """Load persisted history from JSON into _downloads on startup."""
    global _downloads
    if not _HISTORY_PATH.exists():
        return
    try:
        with open(_HISTORY_PATH, "r", encoding="utf-8") as f:
            saved = json.load(f)
        private = {"_stop_event", "_paused"}
        with _lock:
            for entry in saved:
                entry_id = entry.get("id")
                if not entry_id or entry_id in _downloads:
                    continue
                # Restore non-active entries only
                if entry.get("state") in (STATE_COMPLETED, STATE_ERROR, STATE_STOPPED):
                    entry["_stop_event"] = threading.Event()
                    entry["_paused"] = False
                    _downloads[entry_id] = entry
        logger.info("Registry: loaded %d historical entries", len(saved))
    except Exception as exc:
        logger.warning("Registry: failed to load history: %s", exc)


def _save_history() -> None:
    """Persist completed/stopped/error entries to JSON."""
    private = {"_stop_event", "_paused"}
    try:
        with _lock:
            to_save = [
                {k: v for k, v in e.items() if k not in private}
                for e in _downloads.values()
                if e.get("state") in (STATE_COMPLETED, STATE_ERROR, STATE_STOPPED)
            ]
        with open(_HISTORY_PATH, "w", encoding="utf-8") as f:
            json.dump(to_save, f, indent=2, default=str)
    except Exception as exc:
        logger.warning("Registry: failed to save history: %s", exc)


# Load on module import
_load_history()


def _now_iso() -> str:
    import datetime
    return datetime.datetime.now().isoformat(timespec="seconds")


def create_entry(
    url: str,
    title: str = "",
    platform: str = "unknown",
    download_type: str = "video",
    quality_label: str = "best",
    format_id: str = "best",
    thumbnail: str = "",
) -> str:
    """Create a new download entry and return its ID."""
    entry_id = uuid.uuid4().hex[:12]
    entry = {
        "id": entry_id,
        "url": url,
        "title": title or url,
        "platform": platform,
        "download_type": download_type,
        "quality_label": quality_label,
        "format_id": format_id,
        "thumbnail": thumbnail,
        "state": STATE_QUEUED,
        "percent": 0,
        "downloaded_bytes": 0,
        "total_bytes": 0,
        "speed_bps": 0,
        "eta_seconds": None,
        "filename": "",
        "filepath": "",
        "mime": "",
        "error": "",
        "added_at": _now_iso(),
        "started_at": None,
        "completed_at": None,
        "_stop_event": threading.Event(),   # internal – not serialised
        "_paused": False,
    }
    with _lock:
        _downloads[entry_id] = entry
    logger.info("Registry: created entry %s for %s", entry_id, url)
    return entry_id


def update(entry_id: str, **kwargs) -> None:
    """Update fields on an existing entry. Saves history when a terminal state is reached."""
    save = False
    with _lock:
        entry = _downloads.get(entry_id)
        if entry:
            entry.update(kwargs)
            if kwargs.get("state") in (STATE_COMPLETED, STATE_ERROR, STATE_STOPPED):
                save = True
    if save:
        _save_history()


def get(entry_id: str) -> dict | None:
    with _lock:
        e = _downloads.get(entry_id)
        return dict(e) if e else None


def list_all() -> list[dict]:
    """Return a serialisable list of all entries (internal fields stripped)."""
    private = {"_stop_event", "_paused"}
    with _lock:
        result = []
        for e in _downloads.values():
            serialised = {k: v for k, v in e.items() if k not in private}
            result.append(serialised)
    # Most-recently-added first
    result.sort(key=lambda x: x["added_at"], reverse=True)
    return result


def pause(entry_id: str) -> bool:
    with _lock:
        entry = _downloads.get(entry_id)
        if not entry:
            return False
        if entry["state"] == STATE_DOWNLOADING:
            entry["_paused"] = True
            entry["state"] = STATE_PAUSED
            entry["speed_bps"] = 0
            logger.info("Registry: paused %s", entry_id)
            return True
    return False


def resume(entry_id: str) -> bool:
    with _lock:
        entry = _downloads.get(entry_id)
        if not entry:
            return False
        if entry["state"] == STATE_PAUSED:
            entry["_paused"] = False
            entry["state"] = STATE_DOWNLOADING
            logger.info("Registry: resumed %s", entry_id)
            return True
    return False


def stop(entry_id: str) -> bool:
    with _lock:
        entry = _downloads.get(entry_id)
        if not entry:
            return False
        entry["state"] = STATE_STOPPED
        entry["speed_bps"] = 0
        if "_stop_event" in entry:
            entry["_stop_event"].set()
        logger.info("Registry: stopped %s", entry_id)
        return True


def remove(entry_id: str) -> bool:
    with _lock:
        if entry_id in _downloads:
            _downloads[entry_id]["_stop_event"].set()
            del _downloads[entry_id]
            logger.info("Registry: removed %s", entry_id)
            return True
    return False


def is_paused(entry_id: str) -> bool:
    with _lock:
        entry = _downloads.get(entry_id)
        return bool(entry and entry.get("_paused"))


def should_stop(entry_id: str) -> bool:
    with _lock:
        entry = _downloads.get(entry_id)
        if not entry:
            return True
        return entry["_stop_event"].is_set()
