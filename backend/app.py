import os
import sys
import logging
from flask import Flask, send_from_directory
from flask_cors import CORS
from config import Config
import threading
import time
import socket
import webview

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("mediarift")

# Initialize database (creates schemas, runs migrations, recovers unfinished downloads)
import database
database.init_db()


def create_app(config_class: type = Config) -> Flask:
    """Application factory – create and configure the Flask app."""
    # Determine the directory where static files are located
    try:
        # PyInstaller creates a temp folder and stores path in _MEIPASS
        base_path = sys._MEIPASS
    except AttributeError:
        base_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    
    frontend_dist_dir = os.path.join(base_path, "frontend", "dist")

    app = Flask(__name__, static_folder=frontend_dist_dir, static_url_path="")
    app.config.from_object(config_class)

    CORS(
        app,
        resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}},
        supports_credentials=True,
    )

    _ensure_directories(app)

    from routes.info import info_bp
    from routes.download import download_bp
    from routes.settings import settings_bp
    from routes.media_fetch import media_fetch_bp
    from routes.convert import convert_bp
    from routes.compress import compress_bp

    app.register_blueprint(info_bp, url_prefix="/api")
    app.register_blueprint(download_bp, url_prefix="/api")
    app.register_blueprint(settings_bp, url_prefix="/api")
    app.register_blueprint(media_fetch_bp, url_prefix="/api")
    app.register_blueprint(convert_bp, url_prefix="/api")
    app.register_blueprint(compress_bp, url_prefix="/api")

    # ------------------------------------------------------------------
    # Serve index.html or health-check root route
    # ------------------------------------------------------------------
    @app.get("/")
    def health_check():
        index_path = os.path.join(frontend_dist_dir, "index.html")
        if os.path.exists(index_path):
            return send_from_directory(frontend_dist_dir, "index.html")
        return {
            "status": "ok",
            "app": "Mediarift App",
            "version": app.config.get("APP_VERSION", "1.0.0"),
        }, 200

    # ------------------------------------------------------------------
    # Global error handlers
    # ------------------------------------------------------------------
    @app.errorhandler(400)
    def bad_request(exc):
        logger.warning("400 Bad Request: %s", exc)
        return {"error": "Bad request", "detail": str(exc)}, 400

    @app.errorhandler(404)
    def not_found(exc):
        return {"error": "Endpoint not found"}, 404

    @app.errorhandler(405)
    def method_not_allowed(exc):
        return {"error": "Method not allowed"}, 405

    @app.errorhandler(500)
    def internal_error(exc):
        logger.exception("Unhandled server error: %s", exc)
        return {"error": "Internal server error", "detail": str(exc)}, 500

    logger.info("Mediarift App created – environment: %s", app.config.get("ENV", "production"))
    return app


def _ensure_directories(app: Flask) -> None:
    """Create the downloads and temp directories if they do not exist."""
    for path_key in ("DOWNLOADS_DIR", "TEMP_DIR"):
        directory = app.config.get(path_key)
        if directory:
            os.makedirs(directory, exist_ok=True)
            logger.debug("Ensured directory: %s", directory)


def find_free_port() -> int:
    """Find a free port on localhost, defaulting to 5000 if available."""
    # Try port 5000 first
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.bind(("127.0.0.1", 5000))
        s.close()
        return 5000
    except Exception:
        pass
    
    # Find any random free port
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


def check_flask_and_load(window, port):
    """Wait for Flask to become healthy and then load the real app URL."""
    url = f"http://127.0.0.1:{port}"
    health_url = f"{url}/api/health"
    
    # Wait for up to 15 seconds for Flask to boot
    for _ in range(75):
        try:
            import requests
            r = requests.get(health_url, timeout=0.5)
            if r.status_code == 200:
                logger.info("Flask backend is healthy. Loading app URL in webview...")
                window.load_url(url)
                return
        except Exception:
            pass
        time.sleep(0.2)
        
    logger.error("Flask backend failed to start. Loading fallback URL...")
    window.load_url(url)


def run_flask_thread(port):
    """Run Flask server in a daemon thread."""
    flask_app = create_app()
    flask_app.run(host="127.0.0.1", port=port, debug=False, threaded=True)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    debug = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    
    if getattr(sys, 'frozen', False):
        from routes.settings import load_settings, save_settings
        
        settings = load_settings()
        width = settings.get("window_width", 1280)
        height = settings.get("window_height", 720)
        x = settings.get("window_x")
        y = settings.get("window_y")
        
        try: x = int(x) if x is not None else None
        except Exception: x = None
        try: y = int(y) if y is not None else None
        except Exception: y = None
        
        window_state = {
            "width": width,
            "height": height,
            "x": x,
            "y": y
        }
        
        def on_resized(w, h):
            window_state["width"] = w
            window_state["height"] = h
            
        def on_moved(nx, ny):
            window_state["x"] = nx
            window_state["y"] = ny
            
        port = find_free_port()
        logger.info("Starting Flask backend thread on port %d...", port)
        threading.Thread(target=run_flask_thread, args=(port,), daemon=True).start()
        
        splash_html = (
            "data:text/html,<html><head><title>MediaRift</title>"
            "<style>body { background: #121214; color: white; display: flex; "
            "justify-content: center; align-items: center; height: 100vh; margin: 0; "
            "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; } "
            ".spinner { border: 4px solid rgba(255,255,255,0.1); width: 50px; height: 50px; "
            "border-radius: 50%; border-left-color: #3b82f6; "
            "animation: spin 1s linear infinite; margin-bottom: 20px; } "
            "@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } } "
            ".container { text-align: center; }</style></head>"
            "<body><div class='container'><div class='spinner'></div>"
            "<h2 style='font-weight: 500;'>Loading MediaRift...</h2></div></body></html>"
        )
        
        logger.info("Creating native application window...")
        window = webview.create_window(
            title="MediaRift",
            url=splash_html,
            width=width,
            height=height,
            x=x,
            y=y,
            min_size=(1024, 768)
        )
        
        window.events.resized += on_resized
        window.events.moved += on_moved
        
        threading.Thread(target=check_flask_and_load, args=(window, port), daemon=True).start()
        
        webview.start()
        
        try:
            save_settings({
                "window_width": window_state["width"],
                "window_height": window_state["height"],
                "window_x": window_state["x"],
                "window_y": window_state["y"]
            })
            logger.info("Window state saved: %s", window_state)
        except Exception as e:
            logger.error("Failed to save window state: %s", e)
            
    else:
        flask_app = create_app()
        port = int(os.environ.get("PORT", 5000))
        logger.info("Starting Mediarift App on port %d (debug=%s)", port, debug)
        flask_app.run(host="0.0.0.0", port=port, debug=debug, threaded=True)
