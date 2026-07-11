"""
services/download_registry.py
------------------------------
In-memory download registry with SQLite persistence.
Tracks all active, paused, queued, and completed downloads so the frontend can poll.
Survives backend restarts by loading records from SQLite on startup.
"""

import threading
import uuid
import logging
from typing import Any

logger = logging.getLogger("ytshort.download_registry")

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
    """Load persisted history from SQLite database into _downloads on startup."""
    global _downloads
    import database
    try:
        saved = database.get_all_db_downloads()
        with _lock:
            for item in saved:
                entry_id = item.get("id")
                if not entry_id or entry_id in _downloads:
                    continue
                
                # Map SQLite columns back to in-memory format
                entry = {
                    "id": entry_id,
                    "url": item.get("url"),
                    "title": item.get("title"),
                    "platform": item.get("platform"),
                    "download_type": item.get("download_type"),
                    "quality_label": item.get("quality_label"),
                    "format_id": item.get("format_id"),
                    "thumbnail": item.get("thumbnail"),
                    "filename": item.get("filename"),
                    "filepath": item.get("filepath"),
                    "mime": item.get("mime"),
                    "total_bytes": item.get("file_size", 0),
                    "downloaded_bytes": item.get("file_size", 0) if item.get("status") == STATE_COMPLETED else int((item.get("percent", 0) / 100.0) * item.get("file_size", 0)),
                    "state": item.get("status"),
                    "percent": item.get("percent", 0),
                    "speed_bps": item.get("speed", 0),
                    "eta_seconds": item.get("eta"),
                    "error": item.get("error", ""),
                    "added_at": item.get("created_at"),
                    "started_at": item.get("started_at"),
                    "completed_at": item.get("completed_at"),
                    "_stop_event": threading.Event(),
                    "_paused": item.get("status") == STATE_PAUSED,
                }
                _downloads[entry_id] = entry
        logger.info("Registry: loaded %d entries from SQLite database", len(saved))
    except Exception as exc:
        logger.warning("Registry: failed to load history from SQLite: %s", exc)


# Load history from SQLite immediately on module import
_load_history()


def _now_iso() -> str:
    import datetime
    return datetime.datetime.now().isoformat(timespec="seconds")


def _map_entry_to_db(entry: dict) -> dict:
    """Map in-memory registry dictionary to SQLite database columns."""
    return {
        "id": entry.get("id"),
        "url": entry.get("url"),
        "title": entry.get("title"),
        "platform": entry.get("platform"),
        "download_type": entry.get("download_type"),
        "quality_label": entry.get("quality_label"),
        "format_id": entry.get("format_id"),
        "thumbnail": entry.get("thumbnail"),
        "filename": entry.get("filename"),
        "filepath": entry.get("filepath"),
        "mime": entry.get("mime"),
        "file_size": entry.get("total_bytes", 0),
        "status": entry.get("state"),
        "percent": entry.get("percent", 0),
        "speed": entry.get("speed_bps", 0),
        "eta": entry.get("eta_seconds"),
        "error": entry.get("error", ""),
        "created_at": entry.get("added_at"),
        "started_at": entry.get("started_at"),
        "completed_at": entry.get("completed_at"),
    }


def create_entry(
    url: str,
    title: str = "",
    platform: str = "unknown",
    download_type: str = "video",
    quality_label: str = "best",
    format_id: str = "best",
    thumbnail: str = "",
) -> str:
    """Create a new download entry and save it to SQLite (asynchronously)."""
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
    
    # Persist to database asynchronously
    import database
    db_item = _map_entry_to_db(entry)
    database.save_db_download_async(db_item)
    
    logger.info("Registry: created entry %s for %s", entry_id, url)
    return entry_id


def update(entry_id: str, **kwargs) -> None:
    """Update fields on an existing entry. Saves to SQLite (asynchronously)."""
    import database
    db_fields = {}
    with _lock:
        entry = _downloads.get(entry_id)
        if entry:
            entry.update(kwargs)
            # Map the updated kwargs to database columns
            for k, v in kwargs.items():
                if k == "state":
                    db_fields["status"] = v
                elif k == "total_bytes":
                    db_fields["file_size"] = v
                elif k == "speed_bps":
                    db_fields["speed"] = v
                elif k == "eta_seconds":
                    db_fields["eta"] = v
                elif k == "added_at":
                    db_fields["created_at"] = v
                elif k in ("url", "title", "platform", "download_type", "quality_label", "format_id", 
                           "thumbnail", "filename", "filepath", "mime", "percent", "error", "started_at", "completed_at"):
                    db_fields[k] = v
            
            if db_fields:
                database.update_db_download_async(entry_id, db_fields)


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
            
            # Sync update to database
            import database
            database.update_db_download_async(entry_id, {"status": STATE_PAUSED, "speed": 0})
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
            
            # Sync update to database
            import database
            database.update_db_download_async(entry_id, {"status": STATE_DOWNLOADING})
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
        
        # Sync update to database
        import database
        database.update_db_download_async(entry_id, {"status": STATE_STOPPED, "speed": 0})
        return True


def remove(entry_id: str) -> bool:
    with _lock:
        if entry_id in _downloads:
            _downloads[entry_id]["_stop_event"].set()
            del _downloads[entry_id]
            logger.info("Registry: removed %s", entry_id)
            
            # Delete from SQLite database
            import database
            database.delete_db_download_async(entry_id)
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
