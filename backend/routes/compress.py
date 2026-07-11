import os
import uuid
import logging
from flask import Blueprint, request, jsonify, send_file
from werkzeug.utils import secure_filename
from PIL import Image

from config import ActiveConfig as cfg
from services.ffmpeg import compress_video_file

logger = logging.getLogger("mediarift.routes.compress")

compress_bp = Blueprint("compress", __name__)

IMAGE_EXTS = {'.jpg', '.jpeg', '.png', '.webp'}
VIDEO_EXTS = {'.mp4', '.mkv', '.avi', '.mov', '.webm'}

def compress_image_file(input_path: str, output_path: str, level: str, task_id: str = None) -> None:
    import shutil
    import subprocess
    import services.task_manager as tm
    from routes.settings import load_settings
    
    settings = load_settings()
    use_max_quality = settings.get("use_max_quality_algorithms", False)
    
    # Check if task was cancelled before starting
    if task_id and tm.is_task_cancelled(task_id):
        raise RuntimeError("Task cancelled by user")
        
    _, ext = os.path.splitext(output_path)
    ext = ext.lower()
    
    # Map level to quality
    quality_map = {
        'low': 92,      # Best quality
        'medium': 80,   # Balanced
        'high': 65      # Maximum compression
    }
    quality = quality_map.get(level, 80)
    
    # 1. JPEG Optimization (cjpeg / MozJPEG fallback to Pillow)
    if ext in ('.jpg', '.jpeg'):
        cjpeg_bin = shutil.which("cjpeg")
        if cjpeg_bin:
            logger.info("Using MozJPEG (cjpeg) for image compression")
            cmd = [cjpeg_bin, "-quality", str(quality), "-progressive", "-optimize"]
            if use_max_quality or level == 'low':
                cmd += ["-sample", "1x1"] # 4:4:4 subsampling
            else:
                cmd += ["-sample", "2x2"] # 4:2:0 subsampling
            cmd += [input_path]
            
            try:
                if task_id:
                    from services.ffmpeg import set_progress
                    set_progress(task_id, 40, stage="Optimizing JPEG...", algorithm="MozJPEG")
                    
                process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                if task_id:
                    tm.register_task(task_id, process)
                
                stdout_data, stderr_data = process.communicate()
                if process.returncode == 0:
                    with open(output_path, "wb") as f:
                        f.write(stdout_data)
                    if task_id:
                        set_progress(task_id, 100)
                    return
                else:
                    logger.warning("cjpeg failed: %s. Falling back to Pillow", stderr_data)
            except Exception as e:
                logger.warning("Failed running cjpeg: %s. Falling back to Pillow", e)
            finally:
                if task_id:
                    tm.unregister_task(task_id)
                    
        # Pillow Fallback
        logger.info("Using Pillow for JPEG compression")
        if task_id:
            from services.ffmpeg import set_progress
            set_progress(task_id, 40, stage="Optimizing JPEG...", algorithm="JPEG")
            
        img = Image.open(input_path)
        if img.mode in ('RGBA', 'LA', 'P'):
            img = img.convert('RGB')
            
        subsampling = 0 if (use_max_quality or level == 'low') else 2  # 0 is 4:4:4, 2 is 4:2:0
        img.save(output_path, 'JPEG', quality=quality, optimize=True, progressive=True, subsampling=subsampling)
        img.close()
        if task_id:
            set_progress(task_id, 100)
            
    # 2. PNG Optimization (oxipng or zopflipng fallback to Pillow)
    elif ext == '.png':
        oxipng_bin = shutil.which("oxipng")
        zopfli_bin = shutil.which("zopflipng")
        
        if oxipng_bin:
            logger.info("Using Oxipng for PNG compression")
            if task_id:
                from services.ffmpeg import set_progress
                set_progress(task_id, 30, stage="Optimizing PNG...", algorithm="Oxipng")
            opt_level = "max" if (use_max_quality or level == 'high') else "3"
            cmd = [oxipng_bin, "-o", opt_level, "--strip", "safe", input_path, "--out", output_path]
            try:
                process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                if task_id:
                    tm.register_task(task_id, process)
                process.communicate()
                if process.returncode == 0:
                    if task_id:
                        set_progress(task_id, 100)
                    return
            except Exception as e:
                logger.warning("oxipng failed: %s", e)
            finally:
                if task_id:
                    tm.unregister_task(task_id)
                    
        elif zopfli_bin:
            logger.info("Using ZopfliPNG for PNG compression")
            if task_id:
                from services.ffmpeg import set_progress
                set_progress(task_id, 30, stage="Optimizing PNG...", algorithm="ZopfliPNG")
            cmd = [zopfli_bin, "-m", input_path, output_path]
            try:
                process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                if task_id:
                    tm.register_task(task_id, process)
                process.communicate()
                if process.returncode == 0:
                    if task_id:
                        set_progress(task_id, 100)
                    return
            except Exception as e:
                logger.warning("zopflipng failed: %s", e)
            finally:
                if task_id:
                    tm.unregister_task(task_id)
                    
        # Pillow Fallback
        logger.info("Using Pillow for PNG compression")
        if task_id:
            from services.ffmpeg import set_progress
            set_progress(task_id, 30, stage="Optimizing PNG...", algorithm="PNG")
            
        img = Image.open(input_path)
        if level == 'high' or use_max_quality:
            img = img.quantize(colors=256)
        img.save(output_path, 'PNG', optimize=True, compress_level=9)
        img.close()
        if task_id:
            set_progress(task_id, 100)
            
    # 3. WebP Optimization
    elif ext == '.webp':
        logger.info("Using WebP encoder with highest quality/effort")
        if task_id:
            from services.ffmpeg import set_progress
            set_progress(task_id, 40, stage="Encoding WebP...", algorithm="WebP")
            
        img = Image.open(input_path)
        img.save(output_path, 'WEBP', quality=quality, method=6)
        img.close()
        if task_id:
            set_progress(task_id, 100)
            
    # 4. AVIF Optimization
    elif ext == '.avif':
        pillow_avif = False
        try:
            import pillow_avif
            pillow_avif = True
        except ImportError:
            pass
            
        if pillow_avif:
            logger.info("Using Pillow-AVIF for AVIF compression")
            if task_id:
                from services.ffmpeg import set_progress
                set_progress(task_id, 40, stage="Encoding AVIF...", algorithm="AVIF (Pillow)")
            img = Image.open(input_path)
            img.save(output_path, 'AVIF', quality=quality, speed=1 if (use_max_quality or level == 'high') else 4)
            img.close()
            if task_id:
                set_progress(task_id, 100)
        else:
            logger.info("Using FFmpeg AV1 still-picture encoder for AVIF")
            if task_id:
                from services.ffmpeg import set_progress
                set_progress(task_id, 20, stage="Encoding AVIF...", algorithm="AVIF (FFmpeg)")
                
            from services.ffmpeg import _ffmpeg_bin
            ffmpeg = _ffmpeg_bin()
            cmd = [
                ffmpeg, "-y", "-i", input_path,
                "-c:v", "libaom-av1", "-crf", str(int(63 - (quality / 100.0) * 63)),
                "-still-picture", "1",
                "-cpu-used", "1" if (use_max_quality or level == 'high') else "4",
                "-loglevel", "error",
                output_path
            ]
            
            process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            if task_id:
                tm.register_task(task_id, process)
            try:
                process.communicate()
                if process.returncode == 0:
                    if task_id:
                        set_progress(task_id, 100)
                    return
                else:
                    raise RuntimeError("FFmpeg AVIF still-picture encoding failed")
            except Exception as e:
                logger.error("FFmpeg AVIF failed: %s", e)
                raise e
            finally:
                if task_id:
                    tm.unregister_task(task_id)
    else:
        img = Image.open(input_path)
        img.save(output_path)
        img.close()


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

    import datetime
    created_at = datetime.datetime.now().isoformat(timespec="seconds")
    comp_id = task_id or unique_id
    
    try:
        file.save(input_path)

        from services.ffmpeg import set_progress
        if from_ext in IMAGE_EXTS:
            logger.info("Image compress: %s with level %s", from_ext, level)
            compress_image_file(input_path, output_path, level, task_id=comp_id)
        elif from_ext in VIDEO_EXTS:
            logger.info("Video compress: %s with level %s via FFmpeg", from_ext, level)
            compress_video_file(input_path, output_path, level, task_id=comp_id)

        if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
            raise RuntimeError("Compression produced an empty or missing output file.")

        download_name = f"{name_part}_compressed{from_ext}"

        orig_size = os.path.getsize(input_path) if os.path.exists(input_path) else 0
        comp_size = os.path.getsize(output_path) if os.path.exists(output_path) else 0
        saved_bytes = orig_size - comp_size
        saved_pct = (saved_bytes / orig_size * 100.0) if orig_size > 0 else 0.0

        # Read GPU preferences/preset used for compression log
        from routes.settings import load_settings
        settings = load_settings()
        gpu_used = settings.get("preferred_gpu_encoder", "auto")
        preset = settings.get("compression_preset", "balanced")
        
        import database
        database.save_db_compression_async({
            "id": comp_id,
            "original_filename": orig_filename,
            "output_filename": download_name,
            "compression_level": level,
            "original_size": orig_size,
            "compressed_size": comp_size,
            "saved_bytes": saved_bytes,
            "saved_percent": saved_pct,
            "output_path": output_path,
            "status": "completed",
            "created_at": created_at,
            "completed_at": datetime.datetime.now().isoformat(timespec="seconds"),
            "gpu_encoder": gpu_used,
            "compression_preset": preset,
            "compression_stats": f"ratio: {round(orig_size/comp_size, 1) if comp_size > 0 else 1}:1"
        })

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
        try:
            orig_size = os.path.getsize(input_path) if os.path.exists(input_path) else 0
            import database
            database.save_db_compression_async({
                "id": comp_id,
                "original_filename": orig_filename,
                "output_filename": f"{name_part}_compressed{from_ext}",
                "compression_level": level,
                "original_size": orig_size,
                "compressed_size": 0,
                "saved_bytes": 0,
                "saved_percent": 0.0,
                "output_path": output_path,
                "status": "error",
                "created_at": created_at,
                "completed_at": datetime.datetime.now().isoformat(timespec="seconds")
            })
        except Exception:
            pass
        return jsonify({"error": f"Compression failed: {str(err)}", "code": "COMPRESSION_ERROR"}), 500

    finally:
        try:
            if os.path.exists(input_path):
                os.remove(input_path)
            if os.path.exists(output_path):
                os.remove(output_path)
        except Exception as clean_err:
            logger.warning("Failed to clean up temp files: %s", clean_err)


@compress_bp.post("/compress/<taskId>/pause")
def pause_compress(taskId):
    import services.task_manager as tm
    ok = tm.suspend_task(taskId)
    return jsonify({"success": ok}), 200


@compress_bp.post("/compress/<taskId>/resume")
def resume_compress(taskId):
    import services.task_manager as tm
    ok = tm.resume_task(taskId)
    return jsonify({"success": ok}), 200


@compress_bp.post("/compress/<taskId>/cancel")
def cancel_compress(taskId):
    import services.task_manager as tm
    ok = tm.cancel_task(taskId)
    return jsonify({"success": ok}), 200


@compress_bp.get("/compress/progress/<task_id>")
def compress_progress(task_id):
    from services.ffmpeg import get_progress_data
    return jsonify(get_progress_data(task_id))
