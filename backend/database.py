"""
backend/database.py
------------------
SQLite database module for the MediaRift application.
Handles table schemas, indexes, connection pooling/locking, WAL mode configuration,
JSON database migration on first run, and non-blocking background writes.
"""

import sys
import os
import sqlite3
import threading
import logging
from pathlib import Path
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger("ytshort.database")

# ---------------------------------------------------------------------------
# Database Location Selection
# ---------------------------------------------------------------------------
if getattr(sys, 'frozen', False):
    # Beside the executable in production
    APP_DIR = Path(sys.executable).parent.resolve()
else:
    # Project root in development
    APP_DIR = Path(__file__).parent.parent.resolve()

DB_PATH = str(APP_DIR / "mediarift.db")

_db_lock = threading.Lock()
_db_write_executor = ThreadPoolExecutor(max_workers=1)


def run_async_write(func, *args, **kwargs):
    """Submit a write function to the sequential background executor pool."""
    return _db_write_executor.submit(func, *args, **kwargs)


def init_db() -> None:
    """Initialize the SQLite database schema and configurations, then trigger migrations."""
    logger.info("Initializing database at %s...", DB_PATH)
    
    with _db_lock:
        conn = sqlite3.connect(DB_PATH)
        try:
            # Enable Write-Ahead Logging (WAL) for concurrent read/write transactions
            conn.execute("PRAGMA journal_mode=WAL;")
            conn.execute("PRAGMA synchronous=NORMAL;")
            
            # settings table schema
            conn.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                theme TEXT DEFAULT 'dark',
                speed_preset TEXT DEFAULT 'high',
                speed_limit_kbps INTEGER DEFAULT 0,
                max_concurrent_downloads INTEGER DEFAULT 3,
                snail_mode INTEGER DEFAULT 0,
                snail_speed_kbps INTEGER DEFAULT 50,
                download_folder TEXT DEFAULT '',
                launch_at_startup INTEGER DEFAULT 0,
                auto_remove_on_delete INTEGER DEFAULT 1,
                auto_remove_deleted INTEGER DEFAULT 1,
                auto_remove_completed INTEGER DEFAULT 0,
                auto_retry_failed INTEGER DEFAULT 0,
                font_size INTEGER DEFAULT 13,
                window_width INTEGER DEFAULT 1280,
                window_height INTEGER DEFAULT 720,
                window_x INTEGER,
                window_y INTEGER,
                updated_at TEXT
            );
            """)
            
            # downloads table schema
            conn.execute("""
            CREATE TABLE IF NOT EXISTS downloads (
                id TEXT PRIMARY KEY,
                url TEXT,
                title TEXT,
                platform TEXT,
                download_type TEXT,
                quality_label TEXT,
                format_id TEXT,
                thumbnail TEXT,
                filename TEXT,
                filepath TEXT,
                mime TEXT,
                file_size INTEGER DEFAULT 0,
                status TEXT,
                percent INTEGER DEFAULT 0,
                speed INTEGER DEFAULT 0,
                eta INTEGER,
                error TEXT,
                created_at TEXT,
                started_at TEXT,
                completed_at TEXT
            );
            """)
            
            # conversions table schema
            conn.execute("""
            CREATE TABLE IF NOT EXISTS conversions (
                id TEXT PRIMARY KEY,
                original_filename TEXT,
                output_filename TEXT,
                source_format TEXT,
                target_format TEXT,
                output_path TEXT,
                status TEXT,
                error TEXT,
                created_at TEXT,
                completed_at TEXT
            );
            """)
            
            # compressions table schema
            conn.execute("""
            CREATE TABLE IF NOT EXISTS compressions (
                id TEXT PRIMARY KEY,
                original_filename TEXT,
                output_filename TEXT,
                compression_level TEXT,
                original_size INTEGER,
                compressed_size INTEGER,
                saved_bytes INTEGER,
                saved_percent REAL,
                output_path TEXT,
                status TEXT,
                created_at TEXT,
                completed_at TEXT
            );
            """)
            
            # media_scrapes table schema
            conn.execute("""
            CREATE TABLE IF NOT EXISTS media_scrapes (
                id TEXT PRIMARY KEY,
                website_url TEXT,
                media_count INTEGER,
                image_count INTEGER,
                video_count INTEGER,
                audio_count INTEGER,
                favicon_count INTEGER,
                scanned_at TEXT
            );
            """)
            
            # Index creations for queries optimization
            conn.execute("CREATE INDEX IF NOT EXISTS idx_downloads_created_at ON downloads(created_at);")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_downloads_status ON downloads(status);")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_downloads_url ON downloads(url);")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_downloads_filename ON downloads(filename);")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_conversions_created_at ON conversions(created_at);")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_compressions_created_at ON compressions(created_at);")
            
            conn.commit()
            logger.info("Database schemas and indexes initialized successfully.")
        except Exception as e:
            logger.error("Failed to initialize database schemas: %s", e)
            conn.rollback()
            raise e
        finally:
            conn.close()

    # Trigger migrations and recover unfinished downloads on startup
    _migrate_json_files()
    _recover_unfinished_downloads()


# ---------------------------------------------------------------------------
# Migration & Recovery Logic
# ---------------------------------------------------------------------------

def _migrate_json_files() -> None:
    """Migrate settings and download history from JSON files into SQLite on first run."""
    import json
    
    settings_file = APP_DIR / "user_settings.json"
    history_file = APP_DIR / "download_history.json"
    
    # 1. Migrate settings
    if settings_file.exists():
        try:
            with open(settings_file, "r", encoding="utf-8") as f:
                saved_settings = json.load(f)
            
            from routes.settings import DEFAULT_SETTINGS
            merged = {**DEFAULT_SETTINGS, **saved_settings}
            save_db_settings(merged)
            
            bak_file = settings_file.with_suffix(".json.bak")
            if bak_file.exists():
                os.remove(bak_file)
            settings_file.rename(bak_file)
            logger.info("Successfully migrated settings JSON into SQLite database and backup file as %s", bak_file)
        except Exception as e:
            logger.error("Failed to migrate settings JSON: %s", e)
            
    # 2. Migrate download history
    if history_file.exists():
        try:
            with open(history_file, "r", encoding="utf-8") as f:
                history_list = json.load(f)
            
            migrated_count = 0
            for item in history_list:
                db_item = {
                    "id": item.get("id"),
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
                    "file_size": item.get("total_bytes", 0),
                    "status": item.get("state"),
                    "percent": item.get("percent", 0),
                    "speed": item.get("speed_bps", 0),
                    "eta": item.get("eta_seconds"),
                    "error": item.get("error", ""),
                    "created_at": item.get("added_at"),
                    "started_at": item.get("started_at"),
                    "completed_at": item.get("completed_at"),
                }
                insert_db_download_if_not_exists(db_item)
                migrated_count += 1
                
            bak_file = history_file.with_suffix(".json.bak")
            if bak_file.exists():
                os.remove(bak_file)
            history_file.rename(bak_file)
            logger.info("Successfully migrated %d download history records and backup file as %s", migrated_count, bak_file)
        except Exception as e:
            logger.error("Failed to migrate download history JSON: %s", e)


def _recover_unfinished_downloads() -> None:
    """Restore unfinished downloads as 'Interrupted' after an unexpected shutdown."""
    with _db_lock:
        conn = sqlite3.connect(DB_PATH)
        try:
            # Active states: 'queued', 'fetching', 'downloading', 'paused'
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE downloads SET status = 'Interrupted', speed = 0 WHERE status IN ('queued', 'fetching', 'downloading', 'paused')"
            )
            affected = cursor.rowcount
            conn.commit()
            if affected > 0:
                logger.info("Crash Recovery: updated %d unfinished download entries to 'Interrupted'", affected)
        except Exception as e:
            logger.error("Failed to run crash recovery for unfinished downloads: %s", e)
            conn.rollback()
        finally:
            conn.close()


# ---------------------------------------------------------------------------
# Settings CRUD Operations
# ---------------------------------------------------------------------------

def load_db_settings() -> dict:
    """Load settings from the SQLite database. If none exists, returns default settings."""
    from routes.settings import DEFAULT_SETTINGS
    with _db_lock:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM settings WHERE id = 1")
            row = cursor.fetchone()
            if row:
                result = dict(row)
                result.pop("id", None)
                result.pop("updated_at", None)
                # Map booleans from SQLite int to Python bool
                for k, v in DEFAULT_SETTINGS.items():
                    if isinstance(v, bool) and k in result:
                        result[k] = bool(result[k])
                return result
        except Exception as e:
            logger.error("Error loading settings from database: %s", e)
        finally:
            conn.close()
            
    return dict(DEFAULT_SETTINGS)


def save_db_settings(settings_data: dict) -> dict:
    """Save settings to the SQLite database (ID=1) and returns merged settings."""
    from routes.settings import DEFAULT_SETTINGS
    current = load_db_settings()
    current.update({k: v for k, v in settings_data.items() if k in DEFAULT_SETTINGS})
    
    db_fields = {}
    for k, v in current.items():
        if isinstance(v, bool):
            db_fields[k] = 1 if v else 0
        else:
            db_fields[k] = v
            
    db_fields["updated_at"] = datetime.now().isoformat(timespec="seconds")
    
    columns = list(db_fields.keys())
    values = [db_fields[c] for c in columns]
    placeholders = ", ".join(["?"] * (len(columns) + 1))
    
    sql = f"""
    INSERT OR REPLACE INTO settings (id, {', '.join(columns)})
    VALUES ({placeholders})
    """
    
    with _db_lock:
        conn = sqlite3.connect(DB_PATH)
        try:
            conn.execute(sql, [1] + values)
            conn.commit()
        except Exception as e:
            logger.error("Error writing settings to database: %s", e)
            conn.rollback()
        finally:
            conn.close()
            
    return current


# ---------------------------------------------------------------------------
# Downloads CRUD Operations
# ---------------------------------------------------------------------------

def insert_db_download_if_not_exists(item: dict) -> None:
    """Insert a download entry if it does not already exist in the database."""
    columns = list(item.keys())
    values = [item[c] for c in columns]
    placeholders = ", ".join(["?"] * len(columns))
    sql = f"INSERT OR IGNORE INTO downloads ({', '.join(columns)}) VALUES ({placeholders})"
    with _db_lock:
        conn = sqlite3.connect(DB_PATH)
        try:
            conn.execute(sql, values)
            conn.commit()
        except Exception as e:
            logger.error("Error inserting download %s: %s", item.get("id"), e)
            conn.rollback()
        finally:
            conn.close()


def save_db_download(item: dict) -> None:
    """Insert or replace a download item in the database (synchronous)."""
    columns = list(item.keys())
    values = [item[c] for c in columns]
    placeholders = ", ".join(["?"] * len(columns))
    sql = f"INSERT OR REPLACE INTO downloads ({', '.join(columns)}) VALUES ({placeholders})"
    with _db_lock:
        conn = sqlite3.connect(DB_PATH)
        try:
            conn.execute(sql, values)
            conn.commit()
        except Exception as e:
            logger.error("Error saving download %s: %s", item.get("id"), e)
            conn.rollback()
        finally:
            conn.close()


def update_db_download(entry_id: str, fields: dict) -> None:
    """Update specified columns on a download entry (synchronous)."""
    if not fields:
        return
    set_clause = ", ".join([f"{k} = ?" for k in fields.keys()])
    values = list(fields.values()) + [entry_id]
    sql = f"UPDATE downloads SET {set_clause} WHERE id = ?"
    with _db_lock:
        conn = sqlite3.connect(DB_PATH)
        try:
            conn.execute(sql, values)
            conn.commit()
        except Exception as e:
            logger.error("Error updating download %s: %s", entry_id, e)
            conn.rollback()
        finally:
            conn.close()


def delete_db_download(entry_id: str) -> None:
    """Delete a download entry from the database (synchronous)."""
    sql = "DELETE FROM downloads WHERE id = ?"
    with _db_lock:
        conn = sqlite3.connect(DB_PATH)
        try:
            conn.execute(sql, [entry_id])
            conn.commit()
        except Exception as e:
            logger.error("Error deleting download %s from DB: %s", entry_id, e)
            conn.rollback()
        finally:
            conn.close()


def get_all_db_downloads() -> list[dict]:
    """Get all downloads from database, ordered by creation date desc."""
    with _db_lock:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM downloads ORDER BY created_at DESC")
            rows = cursor.fetchall()
            return [dict(r) for r in rows]
        except Exception as e:
            logger.error("Error loading downloads from database: %s", e)
            return []
        finally:
            conn.close()


def get_db_download(entry_id: str) -> dict | None:
    """Get a single download by ID."""
    with _db_lock:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM downloads WHERE id = ?", [entry_id])
            row = cursor.fetchone()
            return dict(row) if row else None
        except Exception as e:
            logger.error("Error loading download %s from database: %s", entry_id, e)
            return None
        finally:
            conn.close()


# Async wrappers for non-blocking UI writes
def save_db_download_async(item: dict) -> None:
    run_async_write(save_db_download, item)


def update_db_download_async(entry_id: str, fields: dict) -> None:
    run_async_write(update_db_download, entry_id, fields)


def delete_db_download_async(entry_id: str) -> None:
    run_async_write(delete_db_download, entry_id)


# ---------------------------------------------------------------------------
# Conversions History Operations
# ---------------------------------------------------------------------------

def save_db_conversion(item: dict) -> None:
    """Insert or replace a conversion history record in the database."""
    columns = list(item.keys())
    values = [item[c] for c in columns]
    placeholders = ", ".join(["?"] * len(columns))
    sql = f"INSERT OR REPLACE INTO conversions ({', '.join(columns)}) VALUES ({placeholders})"
    with _db_lock:
        conn = sqlite3.connect(DB_PATH)
        try:
            conn.execute(sql, values)
            conn.commit()
            logger.info("Saved conversion %s (%s) to database.", item.get("id"), item.get("original_filename"))
        except Exception as e:
            logger.error("Error saving conversion history %s: %s", item.get("id"), e)
            conn.rollback()
        finally:
            conn.close()


def save_db_conversion_async(item: dict) -> None:
    run_async_write(save_db_conversion, item)


# ---------------------------------------------------------------------------
# Compressions History Operations
# ---------------------------------------------------------------------------

def save_db_compression(item: dict) -> None:
    """Insert or replace a compression history record in the database."""
    columns = list(item.keys())
    values = [item[c] for c in columns]
    placeholders = ", ".join(["?"] * len(columns))
    sql = f"INSERT OR REPLACE INTO compressions ({', '.join(columns)}) VALUES ({placeholders})"
    with _db_lock:
        conn = sqlite3.connect(DB_PATH)
        try:
            conn.execute(sql, values)
            conn.commit()
            logger.info("Saved compression %s (%s) to database.", item.get("id"), item.get("original_filename"))
        except Exception as e:
            logger.error("Error saving compression history %s: %s", item.get("id"), e)
            conn.rollback()
        finally:
            conn.close()


def save_db_compression_async(item: dict) -> None:
    run_async_write(save_db_compression, item)


# ---------------------------------------------------------------------------
# Media Scrapes History Operations
# ---------------------------------------------------------------------------

def save_db_media_scrape(item: dict) -> None:
    """Insert or replace a media scrape history record in the database."""
    columns = list(item.keys())
    values = [item[c] for c in columns]
    placeholders = ", ".join(["?"] * len(columns))
    sql = f"INSERT OR REPLACE INTO media_scrapes ({', '.join(columns)}) VALUES ({placeholders})"
    with _db_lock:
        conn = sqlite3.connect(DB_PATH)
        try:
            conn.execute(sql, values)
            conn.commit()
            logger.info("Saved media scrape %s (%s) to database.", item.get("id"), item.get("website_url"))
        except Exception as e:
            logger.error("Error saving media scrape history %s: %s", item.get("id"), e)
            conn.rollback()
        finally:
            conn.close()


def save_db_media_scrape_async(item: dict) -> None:
    run_async_write(save_db_media_scrape, item)
