import os
import uuid
import logging
from flask import Blueprint, request, jsonify, send_file
from werkzeug.utils import secure_filename
from PIL import Image

from config import ActiveConfig as cfg
from services.ffmpeg import compress_video_file

logger = logging.getLogger("ytshort.routes.compress")

compress_bp = Blueprint("compress", __name__)

IMAGE_EXTS = {'.jpg', '.jpeg', '.png', '.webp'}
VIDEO_EXTS = {'.mp4', '.mkv', '.avi', '.mov', '.webm'}

def compress_image_file(input_path: str, output_path: str, level: str) -> None:
    img = Image.open(input_path)
    _, ext = os.path.splitext(output_path)
    ext = ext.lower()

    quality_map = {
        'low': 85,
        'medium': 70,
        'high': 55
    }
    quality = quality_map.get(level, 70)

    if ext in ('.jpg', '.jpeg') and img.mode in ('RGBA', 'LA', 'P'):
        img = img.convert('RGB')

    if ext in ('.jpg', '.jpeg'):
        img.save(output_path, 'JPEG', quality=quality, optimize=True)
    elif ext == '.png':
        if level == 'high':
            quantized = img.quantize(colors=128)
            quantized.save(output_path, 'PNG', optimize=True)
        elif level == 'medium':
            quantized = img.quantize(colors=256)
            quantized.save(output_path, 'PNG', optimize=True)
        else:
            img.save(output_path, 'PNG', optimize=True, compress_level=9)
    elif ext == '.webp':
        img.save(output_path, 'WEBP', quality=quality, method=6)
    else:
        img.save(output_path)


@compress_bp.post("/compress")
def compress_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded", "code": "NO_FILE"}), 400

    file = request.files['file']
    level = request.form.get('level', 'medium').strip().lower()
    task_id = request.form.get('taskId', '').strip()

    if level not in ('low', 'medium', 'high'):
        level = 'medium'

    if not file or not file.filename:
        return jsonify({"error": "Empty file", "code": "EMPTY_FILE"}), 400

    orig_filename = secure_filename(file.filename)
    name_part, from_ext = os.path.splitext(orig_filename)
    from_ext = from_ext.lower()

    if from_ext not in IMAGE_EXTS and from_ext not in VIDEO_EXTS:
        return jsonify({
            "error": f"Unsupported file format '{from_ext}' for compression. "
                      f"Supported formats: Images ({', '.join(IMAGE_EXTS)}) and Videos ({', '.join(VIDEO_EXTS)}).",
            "code": "UNSUPPORTED_FORMAT"
        }), 400

    os.makedirs(cfg.TEMP_DIR, exist_ok=True)

    unique_id = str(uuid.uuid4())
    input_path = os.path.join(cfg.TEMP_DIR, f"{unique_id}_in{from_ext}")
    output_path = os.path.join(cfg.TEMP_DIR, f"{unique_id}_out{from_ext}")

    try:
        file.save(input_path)

        from services.ffmpeg import set_progress
        if from_ext in IMAGE_EXTS:
            if task_id:
                set_progress(task_id, 20)
            logger.info("Image compress: %s with level %s", from_ext, level)
            compress_image_file(input_path, output_path, level)
            if task_id:
                set_progress(task_id, 100)
        elif from_ext in VIDEO_EXTS:
            logger.info("Video compress: %s with level %s via FFmpeg", from_ext, level)
            compress_video_file(input_path, output_path, level, task_id=task_id)

        if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
            raise RuntimeError("Compression produced an empty or missing output file.")

        download_name = f"{name_part}_compressed{from_ext}"

        import io
        with open(output_path, 'rb') as f:
            file_data = io.BytesIO(f.read())

        return send_file(
            file_data,
            as_attachment=True,
            download_name=download_name,
            mimetype="application/octet-stream"
        )

    except Exception as err:
        logger.exception("Compression failed: %s", err)
        return jsonify({"error": f"Compression failed: {str(err)}", "code": "COMPRESSION_ERROR"}), 500

    finally:
        try:
            if os.path.exists(input_path):
                os.remove(input_path)
            if os.path.exists(output_path):
                os.remove(output_path)
        except Exception as clean_err:
            logger.warning("Failed to clean up temp files: %s", clean_err)


@compress_bp.get("/compress/progress/<task_id>")
def compress_progress(task_id):
    from services.ffmpeg import get_progress
    return jsonify({"progress": get_progress(task_id)})
