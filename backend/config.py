import sys
import os
from pathlib import Path
from dotenv import load_dotenv

# Determine app directory for persistent storage (downloads, settings, etc.)
if getattr(sys, 'frozen', False):
    # Running inside PyInstaller bundle - persistent folder is the folder containing the exe
    APP_DIR = Path(sys.executable).parent.resolve()
    load_dotenv(dotenv_path=APP_DIR / ".env")
else:
    # Running in development - persistent folder is the project root (parent of backend)
    APP_DIR = Path(__file__).parent.parent.resolve()
    load_dotenv(dotenv_path=Path(__file__).parent / ".env")

BASE_DIR = Path(__file__).parent.resolve()


class Config:
    APP_VERSION: str = "1.0.0"
    ENV: str = os.getenv("FLASK_ENV", "production")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "mediarift-secret-change-me-in-production")

    _cors_raw: str = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
    CORS_ORIGINS: list[str] = [o.strip() for o in _cors_raw.split(",") if o.strip()]

    DOWNLOADS_DIR: str = str(APP_DIR / "downloads")
    TEMP_DIR: str = str(APP_DIR / "temp")

    # Maximum size (bytes) of a single download allowed on the server.
    # Default: 4 GB  (yt-dlp itself can handle larger files, this is a
    # soft guard for the temp directory).
    MAX_DOWNLOAD_SIZE: int = int(os.getenv("MAX_DOWNLOAD_SIZE", str(4 * 1024 ** 3)))

    YTDLP_TIMEOUT: int = int(os.getenv("YTDLP_TIMEOUT", "600"))

    _bundled_ffmpeg = ""
    _bundled_ffprobe = ""
    if getattr(sys, 'frozen', False):
        # 1. Look in the directory of the executable
        _exe_dir = os.path.dirname(sys.executable)
        _f_path_exe = os.path.join(_exe_dir, "ffmpeg.exe")
        _p_path_exe = os.path.join(_exe_dir, "ffprobe.exe")
        
        if os.path.isfile(_f_path_exe):
            _bundled_ffmpeg = _f_path_exe
        else:
            # 2. Fall back to sys._MEIPASS (embedded in bundle)
            _base_path = sys._MEIPASS
            _f_path = os.path.join(_base_path, "ffmpeg.exe")
            if os.path.isfile(_f_path):
                _bundled_ffmpeg = _f_path
                
        if os.path.isfile(_p_path_exe):
            _bundled_ffprobe = _p_path_exe
        else:
            _base_path = sys._MEIPASS
            _p_path = os.path.join(_base_path, "ffprobe.exe")
            if os.path.isfile(_p_path):
                _bundled_ffprobe = _p_path

    FFMPEG_PATH: str = os.getenv("FFMPEG_PATH", _bundled_ffmpeg)
    FFPROBE_PATH: str = os.getenv("FFPROBE_PATH", _bundled_ffprobe)

    COOKIES_FILE: str = os.getenv("COOKIES_FILE", "")

    PROXY: str = os.getenv("PROXY", "")

    # How long (seconds) to keep temp files after a completed download
    # before the cleanup sweep removes them.  Default: 1 hour.
    TEMP_FILE_TTL: int = int(os.getenv("TEMP_FILE_TTL", "3600"))

    SETTINGS_FILE: str = str(APP_DIR / "user_settings.json")

    MAX_CONCURRENT_DOWNLOADS: int = int(os.getenv("MAX_CONCURRENT_DOWNLOADS", "3"))


class DevelopmentConfig(Config):
    ENV = "development"
    DEBUG = True


class ProductionConfig(Config):
    ENV = "production"
    DEBUG = False


# Map FLASK_ENV value to config class
config_map: dict[str, type] = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
}

# The config class to use – imported by app.py
ActiveConfig: type = config_map.get(os.getenv("FLASK_ENV", "production"), ProductionConfig)
