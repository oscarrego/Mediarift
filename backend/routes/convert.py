"""
routes/convert.py
-----------------
POST /api/convert - Upload a file and convert it to another format.

All conversions are REAL transcodes — not extension renames:
  - Images: Pillow re-encodes pixel data (JPG, PNG, WEBP, BMP, GIF, TIFF, ICO, AVIF, HEIC)
  - Audio:  FFmpeg transcodes with explicit codec (MP3, WAV, FLAC, OGG, OPUS, M4A, WMA, AAC)
  - Video:  FFmpeg transcodes with explicit codec (MP4/H.264, WEBM/VP9, GIF/palette-dither, etc.)
  - Docs:   pdf2docx / docx2pdf with ReportLab fallback
"""

import os
import uuid
import logging
from flask import Blueprint, request, jsonify, send_file
from werkzeug.utils import secure_filename
from PIL import Image

from config import ActiveConfig as cfg
from services.ffmpeg import convert_media

logger = logging.getLogger("ytshort.routes.convert")

convert_bp = Blueprint("convert", __name__)

IMAGE_EXTS = {'.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif', '.tiff', '.tif', '.ico', '.avif', '.heic', '.heif'}
MEDIA_EXTS = {'.mp4', '.mkv', '.avi', '.mov', '.webm', '.flv', '.wmv', '.gif', '.mp3', '.aac', '.wav', '.flac', '.ogg', '.opus', '.m4a', '.wma', '.ts', '.3gp', '.aiff'}
DOC_EXTS = {'.pdf', '.docx', '.doc'}

try:
    import pillow_heif
    pillow_heif.register_heif_opener()
    logger.info("pillow-heif registered: HEIC/HEIF supported")
except ImportError:
    logger.info("pillow-heif not installed: HEIC/HEIF input will fall back to PIL error")

def convert_docx_to_pdf(docx_path: str, pdf_path: str):
    """Convert DOCX to PDF using docx2pdf (MS Word) or ReportLab fallback."""
    try:
        # docx2pdf requires Microsoft Word to be installed (Windows only)
        # In a threaded environment, COM requires CoInitialize
        try:
            import pythoncom
            pythoncom.CoInitialize()
        except ImportError:
            pass
        
        from docx2pdf import convert
        logger.info("Attempting docx2pdf conversion for %s", docx_path)
        convert(docx_path, pdf_path)
        if os.path.exists(pdf_path) and os.path.getsize(pdf_path) > 0:
            logger.info("docx2pdf conversion succeeded")
            return
    except Exception as e:
        logger.warning("docx2pdf failed or MS Word not available: %s. Falling back to ReportLab.", e)

    # Fallback: parse docx and generate PDF using reportlab
    try:
        from docx import Document
        from reportlab.lib.pagesizes import letter
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

        logger.info("Running ReportLab fallback docx-to-pdf parser")
        doc = Document(docx_path)
        pdf = SimpleDocTemplate(pdf_path, pagesize=letter)
        story = []
        styles = getSampleStyleSheet()

        normal_style = ParagraphStyle(
            'DocxNormal',
            parent=styles['Normal'],
            fontSize=11,
            leading=14,
            spaceAfter=6
        )

        for para in doc.paragraphs:
            text = para.text.strip()
            if not text:
                story.append(Spacer(1, 10))
                continue

            if para.style.name.startswith('Heading'):
                level = para.style.name.replace('Heading', '').strip()
                fs = 18
                if level.isdigit():
                    fs = max(12, 24 - int(level) * 2)
                heading_style = ParagraphStyle(
                    f'DocxHeading_{level}',
                    parent=styles['Heading1'],
                    fontSize=fs,
                    leading=fs + 4,
                    spaceAfter=10,
                    spaceBefore=10
                )
                story.append(Paragraph(text, heading_style))
            else:
                story.append(Paragraph(text, normal_style))

        pdf.build(story)
        logger.info("ReportLab fallback docx-to-pdf conversion completed")
    except Exception as fallback_err:
        logger.error("ReportLab fallback failed: %s", fallback_err)
        raise RuntimeError(f"Document conversion failed: {fallback_err}")


def convert_pdf_to_docx(pdf_path: str, docx_path: str):
    """Convert PDF to DOCX using pdf2docx."""
    try:
        from pdf2docx import Converter
        logger.info("Converting PDF to DOCX: %s -> %s", pdf_path, docx_path)
        cv = Converter(pdf_path)
        cv.convert(docx_path, start=0, end=None)
        cv.close()
        logger.info("PDF to DOCX conversion succeeded")
    except Exception as e:
        logger.error("pdf2docx failed: %s", e)
        raise RuntimeError(f"PDF to DOCX conversion failed: {e}")


@convert_bp.post("/convert")
def convert_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded", "code": "NO_FILE"}), 400
    
    file = request.files['file']
    to_format = request.form.get('toFormat', '').strip().lower()
    task_id = request.form.get('taskId', '').strip()
    
    if not file or not file.filename:
        return jsonify({"error": "Empty file", "code": "EMPTY_FILE"}), 400
    
    if not to_format:
        return jsonify({"error": "Missing target format 'toFormat'", "code": "MISSING_FORMAT"}), 400
    
    orig_filename = secure_filename(file.filename)
    name_part, from_ext = os.path.splitext(orig_filename)
    from_ext = from_ext.lower()
    to_ext = f".{to_format}"
    
    if from_ext == to_ext:
        return jsonify({"error": "Source and target formats are the same", "code": "SAME_FORMAT"}), 400

    os.makedirs(cfg.TEMP_DIR, exist_ok=True)
    
    unique_id = str(uuid.uuid4())
    input_path = os.path.join(cfg.TEMP_DIR, f"{unique_id}_in{from_ext}")
    output_path = os.path.join(cfg.TEMP_DIR, f"{unique_id}_out{to_ext}")
    
    import datetime
    created_at = datetime.datetime.now().isoformat(timespec="seconds")
    conv_id = task_id or str(uuid.uuid4())
    
    try:
        file.save(input_path)
        
        from services.ffmpeg import set_progress
        if from_ext in IMAGE_EXTS and to_ext in IMAGE_EXTS:
            if task_id:
                set_progress(task_id, 20)
            logger.info("Image re-encode: %s -> %s via Pillow", from_ext, to_ext)
            img = Image.open(input_path)
            if to_ext in ('.jpg', '.jpeg', '.bmp') and img.mode in ('RGBA', 'LA', 'P'):
                img = img.convert('RGB')
            if to_ext == '.ico':
                img.save(output_path, format='ICO', sizes=[(256, 256), (128, 128), (64, 64), (32, 32), (16, 16)])
            else:
                img.save(output_path)
            if task_id:
                set_progress(task_id, 100)
        
        elif from_ext in DOC_EXTS and to_ext in DOC_EXTS:
            if task_id:
                set_progress(task_id, 20)
            if from_ext in ('.docx', '.doc') and to_ext == '.pdf':
                convert_docx_to_pdf(input_path, output_path)
            elif from_ext == '.pdf' and to_ext == '.docx':
                convert_pdf_to_docx(input_path, output_path)
            else:
                return jsonify({"error": f"Unsupported document conversion: {from_ext} to {to_ext}", "code": "UNSUPPORTED_CONVERSION"}), 400
            if task_id:
                set_progress(task_id, 100)
                
        elif from_ext in MEDIA_EXTS and to_ext in MEDIA_EXTS:
            logger.info("Media transcode: %s -> %s via FFmpeg", from_ext, to_ext)
            convert_media(input_path, output_path, task_id=task_id)
            
        else:
            return jsonify({
                "error": f"Cannot convert {from_ext} to {to_ext}: cross-category conversion is not supported. "
                          f"Image→Image, Audio/Video→Audio/Video, and Doc→Doc are supported.",
                "code": "UNSUPPORTED_CONVERSION"
            }), 400

        if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
            raise RuntimeError("Conversion produced an empty or missing output file.")
            
        download_name = f"{name_part}{to_ext}"
        
        import database
        database.save_db_conversion_async({
            "id": conv_id,
            "original_filename": orig_filename,
            "output_filename": download_name,
            "source_format": from_ext.lstrip('.'),
            "target_format": to_ext.lstrip('.'),
            "output_path": output_path,
            "status": "completed",
            "error": "",
            "created_at": created_at,
            "completed_at": datetime.datetime.now().isoformat(timespec="seconds")
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
        logger.exception("Conversion failed: %s", err)
        try:
            import database
            database.save_db_conversion_async({
                "id": conv_id,
                "original_filename": orig_filename,
                "output_filename": f"{name_part}{to_ext}",
                "source_format": from_ext.lstrip('.'),
                "target_format": to_ext.lstrip('.'),
                "output_path": output_path,
                "status": "error",
                "error": str(err),
                "created_at": created_at,
                "completed_at": datetime.datetime.now().isoformat(timespec="seconds")
            })
        except Exception:
            pass
        return jsonify({"error": f"Conversion failed: {str(err)}", "code": "CONVERSION_ERROR"}), 500
        
    finally:
        try:
            if os.path.exists(input_path):
                os.remove(input_path)
            if os.path.exists(output_path):
                os.remove(output_path)
        except Exception as clean_err:
            logger.warning("Failed to clean up temp files: %s", clean_err)


@convert_bp.get("/convert/progress/<task_id>")
def convert_progress(task_id):
    from services.ffmpeg import get_progress
    return jsonify({"progress": get_progress(task_id)})
