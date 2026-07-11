"""
services/ffmpeg.py
------------------
FFmpeg utilities: availability check, merge, probe, and conversion helpers.
All subprocess calls go through this module so the rest of the app never
touches FFmpeg directly.
"""

import os
import re
import shutil
import logging
import subprocess
import threading
from pathlib import Path
from typing import Optional

from config import ActiveConfig as cfg

logger = logging.getLogger("mediarift.ffmpeg")

_progress_lock = threading.Lock()
_progress_store: dict[str, dict] = {}

def set_progress(task_id: str, percent: int, stage: str = None, encoder: str = None, algorithm: str = None, ratio: str = None) -> None:
    if not task_id:
        return
    with _progress_lock:
        if task_id not in _progress_store:
            _progress_store[task_id] = {"progress": 0}
        _progress_store[task_id]["progress"] = percent
        if stage:
            _progress_store[task_id]["stage"] = stage
        if encoder:
            _progress_store[task_id]["encoder"] = encoder
        if algorithm:
            _progress_store[task_id]["algorithm"] = algorithm
        if ratio:
            _progress_store[task_id]["ratio"] = ratio

def get_progress(task_id: str) -> int:
    with _progress_lock:
        return _progress_store.get(task_id, {}).get("progress", 0)

def get_progress_data(task_id: str) -> dict:
    with _progress_lock:
        return dict(_progress_store.get(task_id, {"progress": 0}))

def clear_progress(task_id: str) -> None:
    with _progress_lock:
        _progress_store.pop(task_id, None)


def _ffmpeg_bin() -> str:
    """Return the path to the ffmpeg binary, respecting config override."""
    if cfg.FFMPEG_PATH and os.path.isfile(cfg.FFMPEG_PATH):
        return cfg.FFMPEG_PATH
    found = shutil.which("ffmpeg")
    if found:
        return found
    raise RuntimeError(
        "FFmpeg not found. Install FFmpeg and ensure it is on your system PATH, "
        "or set the FFMPEG_PATH environment variable."
    )


def _ffprobe_bin() -> str:
    if cfg.FFPROBE_PATH and os.path.isfile(cfg.FFPROBE_PATH):
        return cfg.FFPROBE_PATH
    found = shutil.which("ffprobe")
    if found:
        return found
    raise RuntimeError("ffprobe not found. Install FFmpeg (includes ffprobe).")



def is_ffmpeg_available() -> bool:
    """Return True if ffmpeg is callable on this system."""
    try:
        _ffmpeg_bin()
        return True
    except RuntimeError:
        return False


def get_ffmpeg_version() -> Optional[str]:
    """Return the ffmpeg version string or None if not available."""
    try:
        result = subprocess.run(
            [_ffmpeg_bin(), "-version"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        match = re.search(r"ffmpeg version (\S+)", result.stdout)
        return match.group(1) if match else "unknown"
    except Exception:
        return None


def merge_video_audio(video_path: str, audio_path: str, output_path: str) -> str:
    """
    Merge separate video and audio files into a single MP4.
    Returns the output_path on success.
    Raises RuntimeError on failure.
    """
    ffmpeg = _ffmpeg_bin()
    cmd = [
        ffmpeg,
        "-y",                        # overwrite output
        "-i", video_path,
        "-i", audio_path,
        "-c:v", "copy",              # stream-copy video (no re-encode)
        "-c:a", "aac",               # re-encode audio to AAC for wide compatibility
        "-b:a", "192k",
        "-movflags", "+faststart",   # optimise for streaming
        "-loglevel", "error",
        output_path,
    ]
    logger.debug("FFmpeg merge: %s", " ".join(cmd))

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=cfg.YTDLP_TIMEOUT,
        )
    except subprocess.TimeoutExpired:
        raise RuntimeError("FFmpeg merge timed out.")

    if result.returncode != 0:
        logger.error("FFmpeg stderr: %s", result.stderr)
        raise RuntimeError(f"FFmpeg merge failed: {result.stderr.strip()}")

    if not os.path.isfile(output_path):
        raise RuntimeError("FFmpeg produced no output file.")

    return output_path


def convert_to_mp3(input_path: str, output_path: str, bitrate: str = "192k") -> str:
    """
    Convert any audio-bearing file to MP3.
    Returns the output_path on success.
    """
    ffmpeg = _ffmpeg_bin()
    cmd = [
        ffmpeg,
        "-y",
        "-i", input_path,
        "-vn",
        "-acodec", "libmp3lame",
        "-ab", bitrate,
        "-loglevel", "error",
        output_path,
    ]
    logger.debug("FFmpeg convert to MP3: %s", " ".join(cmd))

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=cfg.YTDLP_TIMEOUT,
        )
    except subprocess.TimeoutExpired:
        raise RuntimeError("FFmpeg audio conversion timed out.")

    if result.returncode != 0:
        logger.error("FFmpeg stderr: %s", result.stderr)
        raise RuntimeError(f"FFmpeg audio conversion failed: {result.stderr.strip()}")

    return output_path


def probe_duration(filepath: str) -> Optional[float]:
    """
    Use ffprobe to return the duration of a media file in seconds,
    or None if ffprobe is unavailable / the file is unreadable.
    """
    try:
        ffprobe = _ffprobe_bin()
    except RuntimeError:
        return None

    cmd = [
        ffprobe,
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        filepath,
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        return float(result.stdout.strip())
    except Exception:
        return None


def probe_metadata(filepath: str) -> dict:
    """
    Use ffprobe to return basic metadata: duration, width, height, codec names.
    Returns an empty dict if ffprobe is unavailable.
    """
    try:
        ffprobe = _ffprobe_bin()
    except RuntimeError:
        return {}

    cmd = [
        ffprobe,
        "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height,codec_name,r_frame_rate",
        "-show_entries", "format=duration,size,bit_rate",
        "-of", "json",
        filepath,
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        import json
        data = json.loads(result.stdout)
        streams = data.get("streams", [{}])
        fmt = data.get("format", {})
        video_stream = streams[0] if streams else {}
        return {
            "width": video_stream.get("width"),
            "height": video_stream.get("height"),
            "codec": video_stream.get("codec_name"),
            "fps": _parse_fps(video_stream.get("r_frame_rate", "")),
            "duration": fmt.get("duration"),
            "size": fmt.get("size"),
            "bitrate": fmt.get("bit_rate"),
        }
    except Exception:
        return {}


def _parse_fps(fps_str: str) -> Optional[float]:
    """Parse '30000/1001' style fps string to a float."""
    try:
        if "/" in fps_str:
            num, den = fps_str.split("/")
            return round(int(num) / int(den), 2)
        return float(fps_str)
    except Exception:
        return None


def convert_media(input_path: str, output_path: str, task_id: str = None) -> str:
    """
    Convert a video/audio file from input_path to output_path using FFmpeg.
    Uses explicit codec mappings for every supported format to ensure genuine
    re-encoding (not just container remux). GIF output uses a 2-pass palette
    pipeline for high quality.
    """
    ffmpeg = _ffmpeg_bin()
    target_ext = os.path.splitext(output_path)[1].lower()

    # ── Audio-only codec map ────────────────────────────────────────────────
    AUDIO_CODEC_MAP = {
        '.mp3':  ['-vn', '-acodec', 'libmp3lame', '-ab', '192k'],
        '.aac':  ['-vn', '-acodec', 'aac', '-b:a', '192k'],
        '.wav':  ['-vn', '-acodec', 'pcm_s16le'],
        '.flac': ['-vn', '-acodec', 'flac', '-compression_level', '8'],
        '.ogg':  ['-vn', '-acodec', 'libvorbis', '-q:a', '6'],
        '.opus': ['-vn', '-acodec', 'libopus', '-b:a', '128k'],
        '.m4a':  ['-vn', '-acodec', 'aac', '-b:a', '192k', '-movflags', '+faststart'],
        '.wma':  ['-vn', '-acodec', 'wmav2', '-b:a', '192k'],
        '.aiff': ['-vn', '-acodec', 'pcm_s16be'],
    }

    # ── Video codec map (container → preferred video encoder) ──────────────
    VIDEO_CODEC_MAP = {
        '.mp4':  ['-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart'],
        '.mkv':  ['-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'aac', '-b:a', '192k'],
        '.avi':  ['-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'mp3',  '-b:a', '192k'],
        '.mov':  ['-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'aac', '-b:a', '192k'],
        '.webm': ['-c:v', 'libvpx-vp9', '-crf', '30', '-b:v', '0', '-c:a', 'libopus', '-b:a', '128k'],
        '.flv':  ['-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'aac', '-b:a', '128k'],
        '.wmv':  ['-c:v', 'wmv2',   '-b:v', '2000k', '-c:a', 'wmav2', '-b:a', '192k'],
        '.ts':   ['-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'aac', '-b:a', '192k'],
        '.3gp':  ['-c:v', 'libx264', '-preset', 'fast', '-crf', '28', '-c:a', 'aac', '-b:a', '128k'],
    }

    is_target_audio = target_ext in AUDIO_CODEC_MAP

    # ── Special: Video → GIF (2-pass palette pipeline) ─────────────────────
    if target_ext == '.gif':
        return _convert_to_gif(input_path, output_path)

    # ── Audio output ────────────────────────────────────────────────────────
    if is_target_audio:
        codec_args = AUDIO_CODEC_MAP.get(target_ext, ['-vn'])
        cmd = [ffmpeg, '-y', '-i', input_path] + codec_args + ['-loglevel', 'error', output_path]
        logger.debug("FFmpeg audio convert: %s", " ".join(cmd))
        total_dur = probe_duration(input_path)
        if task_id and total_dur:
            _run_ffmpeg_with_progress(cmd, task_id, total_dur)
        else:
            _run_ffmpeg(cmd)
        return output_path

    # ── Video output ────────────────────────────────────────────────────────
    video_args = VIDEO_CODEC_MAP.get(target_ext)
    if video_args:
        cmd = [ffmpeg, '-y', '-i', input_path] + video_args + ['-loglevel', 'error', output_path]
    else:
        # Fallback: let FFmpeg decide (shouldn't normally reach here)
        cmd = [ffmpeg, '-y', '-i', input_path, '-loglevel', 'error', output_path]

    logger.debug("FFmpeg video convert: %s", " ".join(cmd))
    total_dur = probe_duration(input_path)
    if task_id and total_dur:
        _run_ffmpeg_with_progress(cmd, task_id, total_dur)
    else:
        _run_ffmpeg(cmd)

    if not os.path.isfile(output_path):
        raise RuntimeError("FFmpeg produced no output file.")

    return output_path


def _execute_subprocess_task(cmd: list, task_id: str = None, total_duration: float = None) -> None:
    """Run command as Popen, registering it in TaskManager, and handling pause/cancel/progress."""
    import services.task_manager as tm
    
    logger.debug("Executing subprocess task: %s", " ".join(cmd))
    
    run_cmd = list(cmd)
    if task_id and total_duration and total_duration > 0:
        if "-progress" not in run_cmd:
            output_file = run_cmd.pop()
            run_cmd += ["-progress", "-", output_file]
            
    try:
        process = subprocess.Popen(
            run_cmd,
            stdout=subprocess.PIPE if (task_id and total_duration) else subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
            universal_newlines=True
        )
    except Exception as e:
        logger.error("Failed to start process: %s", e)
        raise RuntimeError(f"Failed to start task process: {e}")
        
    if task_id:
        tm.register_task(task_id, process)
        
    try:
        if task_id and total_duration and total_duration > 0:
            while True:
                # Handle pause
                while tm.is_task_paused(task_id):
                    time.sleep(0.5)
                    if tm.is_task_cancelled(task_id):
                        raise RuntimeError("Task cancelled by user")
                
                # Check for cancellation
                if tm.is_task_cancelled(task_id):
                    raise RuntimeError("Task cancelled by user")
                    
                line = process.stdout.readline()
                if not line:
                    break
                if line.startswith("out_time_us="):
                    try:
                        us = int(line.split("=")[1].strip())
                        current_time = us / 1000000.0
                        percent = int((current_time / total_duration) * 100)
                        percent = min(99, max(0, percent))
                        set_progress(task_id, percent)
                    except Exception:
                        pass
        else:
            # Simple wait loop with pause/cancel checks
            while process.poll() is None:
                while tm.is_task_paused(task_id):
                    time.sleep(0.5)
                    if tm.is_task_cancelled(task_id):
                        raise RuntimeError("Task cancelled by user")
                        
                if tm.is_task_cancelled(task_id):
                    raise RuntimeError("Task cancelled by user")
                time.sleep(0.2)
                
        process.wait(timeout=cfg.YTDLP_TIMEOUT)
        if process.returncode != 0:
            stderr_content = process.stderr.read() if process.stderr else ""
            if "cancelled" in str(stderr_content).lower() or tm.is_task_cancelled(task_id):
                raise RuntimeError("Task cancelled by user")
            logger.error("Process error: %s", stderr_content)
            raise RuntimeError(f"Task process failed with code {process.returncode}: {stderr_content.strip()}")
            
        if task_id:
            set_progress(task_id, 100)
            
    finally:
        if task_id:
            tm.unregister_task(task_id)


def _run_ffmpeg(cmd: list) -> None:
    """Run an FFmpeg command and raise RuntimeError on failure."""
    _execute_subprocess_task(cmd)


def _run_ffmpeg_with_progress(cmd: list, task_id: str, total_duration: float) -> None:
    """Run FFmpeg command and parse output to update task_id progress."""
    _execute_subprocess_task(cmd, task_id, total_duration)


def _convert_to_gif(input_path: str, output_path: str, fps: int = 15, width: int = 480) -> str:
    """
    Convert a video to GIF using FFmpeg's 2-pass palette pipeline.
    This produces dramatically better quality than a naive direct conversion.
    Pass 1: generate an optimal colour palette from the source video.
    Pass 2: apply that palette to dither the final GIF frames.
    """
    ffmpeg = _ffmpeg_bin()
    palette_path = output_path + '_palette.png'

    try:
        # Pass 1 — generate palette
        palette_cmd = [
            ffmpeg, '-y', '-i', input_path,
            '-vf', f'fps={fps},scale={width}:-1:flags=lanczos,palettegen=stats_mode=diff',
            '-loglevel', 'error',
            palette_path,
        ]
        logger.debug("GIF pass-1 palette: %s", " ".join(palette_cmd))
        _run_ffmpeg(palette_cmd)

        if not os.path.isfile(palette_path):
            raise RuntimeError("GIF palette generation produced no file.")

        # Pass 2 — apply palette to produce final GIF
        gif_cmd = [
            ffmpeg, '-y',
            '-i', input_path,
            '-i', palette_path,
            '-lavfi', f'fps={fps},scale={width}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle',
            '-loglevel', 'error',
            output_path,
        ]
        logger.debug("GIF pass-2 render: %s", " ".join(gif_cmd))
        _run_ffmpeg(gif_cmd)

    finally:
        # Clean up palette temp file
        try:
            if os.path.exists(palette_path):
                os.remove(palette_path)
        except Exception:
            pass

    if not os.path.isfile(output_path):
        raise RuntimeError("GIF conversion produced no output file.")

    return output_path


_cached_encoders = None

def get_available_encoders() -> set[str]:
    global _cached_encoders
    if _cached_encoders is not None:
        return _cached_encoders
    
    _cached_encoders = set()
    try:
        ffmpeg = _ffmpeg_bin()
        result = subprocess.run([ffmpeg, "-encoders"], capture_output=True, text=True, timeout=5)
        out = result.stdout.lower()
        if "nvenc" in out:
            _cached_encoders.add("nvenc")
        if "qsv" in out:
            _cached_encoders.add("qsv")
        if "amf" in out:
            _cached_encoders.add("amf")
            
        for enc in ("libx264", "libx265", "libvpx-vp9", "libsvtav1", "libaom-av1",
                    "h264_nvenc", "hevc_nvenc", "av1_nvenc",
                    "h264_qsv", "hevc_qsv", "av1_qsv",
                    "h264_amf", "hevc_amf", "av1_amf"):
            if enc in out:
                _cached_encoders.add(enc)
    except Exception as e:
        logger.error("Failed to detect encoders: %s", e)
    return _cached_encoders


def compress_video_file(input_path: str, output_path: str, level: str, task_id: str = None) -> str:
    from routes.settings import load_settings
    settings = load_settings()
    
    preferred_gpu = settings.get("preferred_gpu_encoder", "auto")
    preset = settings.get("compression_preset", "balanced")
    
    # Check target container and default codec
    target_ext = os.path.splitext(output_path)[1].lower()
    codec = settings.get("preferred_video_codec", "h264")
    if target_ext == ".webm" and codec not in ("vp9", "av1"):
        codec = "vp9"
        
    encoders = get_available_encoders()
    
    # Resolve preferred encoder
    selected_hw = "cpu"
    if preferred_gpu == "auto":
        if "nvenc" in encoders:
            selected_hw = "nvenc"
        elif "qsv" in encoders:
            selected_hw = "qsv"
        elif "amf" in encoders:
            selected_hw = "amf"
    elif preferred_gpu in ("nvenc", "qsv", "amf") and preferred_gpu in encoders:
        selected_hw = preferred_gpu
        
    # Map encoder & parameters
    vcodec = "libx264"
    friendly_enc = "CPU (x264)"
    v_args = []
    
    algorithm_name = codec.upper()
    total_dur = probe_duration(input_path)
    
    if codec == "h264":
        if selected_hw == "nvenc":
            vcodec = "h264_nvenc"
            friendly_enc = "NVENC"
            if preset == "fast":
                v_args = ["-preset", "p1", "-cq", "20"]
            elif preset == "balanced":
                v_args = ["-preset", "p4", "-cq", "23"]
            elif preset == "max_compression":
                v_args = ["-preset", "p7", "-cq", "28", "-multipass", "2pass-full"]
            else: # archival_quality
                v_args = ["-preset", "p5", "-cq", "16"]
        elif selected_hw == "qsv":
            vcodec = "h264_qsv"
            friendly_enc = "Intel QSV"
            if preset == "fast":
                v_args = ["-preset", "veryfast", "-global_quality", "20"]
            elif preset == "balanced":
                v_args = ["-preset", "medium", "-global_quality", "23"]
            elif preset == "max_compression":
                v_args = ["-preset", "veryslow", "-global_quality", "28"]
            else:
                v_args = ["-preset", "slow", "-global_quality", "16"]
        elif selected_hw == "amf":
            vcodec = "h264_amf"
            friendly_enc = "AMD AMF"
            if preset == "fast":
                v_args = ["-quality", "speed"]
            elif preset == "balanced":
                v_args = ["-quality", "balanced"]
            elif preset == "max_compression":
                v_args = ["-quality", "quality"]
            else:
                v_args = ["-quality", "quality"]
        else: # CPU
            vcodec = "libx264"
            friendly_enc = "CPU (x264)"
            if preset == "fast":
                v_args = ["-preset", "veryfast", "-crf", "20"]
            elif preset == "balanced":
                v_args = ["-preset", "medium", "-crf", "23"]
            elif preset == "max_compression":
                v_args = ["-preset", "veryslow", "-crf", "26", "-me_method", "umh", "-subq", "10", "-aq-mode", "2"]
            else:
                v_args = ["-preset", "slow", "-crf", "16"]
                
    elif codec == "h265":
        algorithm_name = "H.265"
        if selected_hw == "nvenc":
            vcodec = "hevc_nvenc"
            friendly_enc = "NVENC"
            if preset == "fast":
                v_args = ["-preset", "p1", "-cq", "22"]
            elif preset == "balanced":
                v_args = ["-preset", "p4", "-cq", "25"]
            elif preset == "max_compression":
                v_args = ["-preset", "p7", "-cq", "30", "-multipass", "2pass-full"]
            else:
                v_args = ["-preset", "p5", "-cq", "18"]
        elif selected_hw == "qsv":
            vcodec = "hevc_qsv"
            friendly_enc = "Intel QSV"
            if preset == "fast":
                v_args = ["-preset", "veryfast", "-global_quality", "22"]
            elif preset == "balanced":
                v_args = ["-preset", "medium", "-global_quality", "25"]
            elif preset == "max_compression":
                v_args = ["-preset", "veryslow", "-global_quality", "30"]
            else:
                v_args = ["-preset", "slow", "-global_quality", "18"]
        elif selected_hw == "amf":
            vcodec = "hevc_amf"
            friendly_enc = "AMD AMF"
            if preset == "fast":
                v_args = ["-quality", "speed"]
            elif preset == "balanced":
                v_args = ["-quality", "balanced"]
            elif preset == "max_compression":
                v_args = ["-quality", "quality"]
            else:
                v_args = ["-quality", "quality"]
        else:
            vcodec = "libx265"
            friendly_enc = "CPU (x265)"
            if preset == "fast":
                v_args = ["-preset", "veryfast", "-crf", "24"]
            elif preset == "balanced":
                v_args = ["-preset", "medium", "-crf", "26"]
            elif preset == "max_compression":
                v_args = ["-preset", "veryslow", "-crf", "28", "-x265-params", "aq-mode=2:b-intra=1"]
            else:
                v_args = ["-preset", "slow", "-crf", "18"]
                
    elif codec == "vp9":
        algorithm_name = "VP9"
        vcodec = "libvpx-vp9"
        friendly_enc = "CPU (VP9)"
        if preset == "fast":
            v_args = ["-crf", "32", "-b:v", "1M", "-deadline", "good", "-cpu-used", "4"]
        elif preset == "balanced":
            v_args = ["-crf", "30", "-b:v", "0", "-deadline", "good", "-cpu-used", "2"]
        elif preset == "max_compression":
            v_args = ["-crf", "33", "-b:v", "0", "-deadline", "best", "-cpu-used", "0"]
        else:
            v_args = ["-crf", "18", "-b:v", "0", "-deadline", "good", "-cpu-used", "1"]
            
    elif codec == "av1":
        algorithm_name = "AV1"
        if selected_hw == "nvenc" and "av1_nvenc" in encoders:
            vcodec = "av1_nvenc"
            friendly_enc = "NVENC"
            if preset == "fast":
                v_args = ["-preset", "p1", "-cq", "24"]
            elif preset == "balanced":
                v_args = ["-preset", "p4", "-cq", "28"]
            elif preset == "max_compression":
                v_args = ["-preset", "p7", "-cq", "32", "-multipass", "2pass-full"]
            else:
                v_args = ["-preset", "p5", "-cq", "20"]
        elif selected_hw == "qsv" and "av1_qsv" in encoders:
            vcodec = "av1_qsv"
            friendly_enc = "Intel QSV"
            if preset == "fast":
                v_args = ["-preset", "veryfast", "-global_quality", "24"]
            elif preset == "balanced":
                v_args = ["-preset", "medium", "-global_quality", "28"]
            elif preset == "max_compression":
                v_args = ["-preset", "veryslow", "-global_quality", "32"]
            else:
                v_args = ["-preset", "slow", "-global_quality", "20"]
        elif selected_hw == "amf" and "av1_amf" in encoders:
            vcodec = "av1_amf"
            friendly_enc = "AMD AMF"
            if preset == "fast":
                v_args = ["-quality", "speed"]
            elif preset == "balanced":
                v_args = ["-quality", "balanced"]
            elif preset == "max_compression":
                v_args = ["-quality", "quality"]
            else:
                v_args = ["-quality", "quality"]
        else:
            if "libsvtav1" in encoders:
                vcodec = "libsvtav1"
                friendly_enc = "SVT-AV1"
                if preset == "fast":
                    v_args = ["-preset", "8", "-crf", "32"]
                elif preset == "balanced":
                    v_args = ["-preset", "5", "-crf", "28"]
                elif preset == "max_compression":
                    v_args = ["-preset", "2", "-crf", "30"]
                else:
                    v_args = ["-preset", "3", "-crf", "20"]
            else:
                vcodec = "libaom-av1"
                friendly_enc = "libaom"
                if preset == "fast":
                    v_args = ["-cpu-used", "6", "-crf", "32"]
                elif preset == "balanced":
                    v_args = ["-cpu-used", "4", "-crf", "28"]
                elif preset == "max_compression":
                    v_args = ["-cpu-used", "1", "-deadline", "best", "-crf", "30"]
                else:
                    v_args = ["-cpu-used", "2", "-crf", "20"]
                    
    # Audio settings
    audio_preset = settings.get("audio_quality", "high")
    acodec = "aac"
    a_args = []
    
    preferred_acodec = settings.get("preferred_audio_codec", "aac")
    if preferred_acodec == "mp3":
        acodec = "libmp3lame"
        if audio_preset == "low":
            a_args = ["-q:a", "6"]
        elif audio_preset == "medium":
            a_args = ["-q:a", "4"]
        else:
            a_args = ["-q:a", "2"]
    elif preferred_acodec == "opus":
        acodec = "libopus"
        if audio_preset == "low":
            a_args = ["-b:a", "64k", "-vbr", "on"]
        elif audio_preset == "medium":
            a_args = ["-b:a", "96k", "-vbr", "on"]
        else:
            a_args = ["-b:a", "128k", "-vbr", "on"]
    elif preferred_acodec == "flac":
        acodec = "flac"
        if audio_preset == "low":
            a_args = ["-compression_level", "1"]
        elif audio_preset == "medium":
            a_args = ["-compression_level", "5"]
        else:
            a_args = ["-compression_level", "8"]
    else:
        acodec = "aac"
        if audio_preset == "low":
            a_args = ["-b:a", "96k"]
        elif audio_preset == "medium":
            a_args = ["-q:a", "2"]
        else:
            a_args = ["-q:a", "1"]
            
    ffmpeg = _ffmpeg_bin()
    
    # 2-pass CPU max compression
    is_cpu = selected_hw == "cpu"
    if preset == "max_compression" and is_cpu and codec in ("h264", "h265", "vp9"):
        logger.info("Running 2-pass compression for %s...", codec)
        set_progress(task_id, 0, stage="Analyzing... (Pass 1/2)", encoder=friendly_enc, algorithm=algorithm_name)
        
        pass1_cmd = [
            ffmpeg, "-y", "-i", input_path,
            "-c:v", vcodec
        ] + v_args + [
            "-pass", "1", "-an", "-f", "null", "NUL" if sys.platform == "win32" else "/dev/null"
        ]
        
        try:
            _execute_subprocess_task(pass1_cmd, task_id, total_dur)
        except Exception as e:
            logger.error("Pass 1 of 2-pass failed: %s", e)
            raise e
            
        set_progress(task_id, 50, stage="Encoding... (Pass 2/2)", encoder=friendly_enc, algorithm=algorithm_name)
        
        pass2_cmd = [
            ffmpeg, "-y", "-i", input_path,
            "-c:v", vcodec
        ] + v_args + [
            "-pass", "2",
            "-c:a", acodec
        ] + a_args + [
            "-loglevel", "error",
            output_path
        ]
        
        try:
            _execute_subprocess_task(pass2_cmd, task_id, total_dur)
        except Exception as e:
            logger.error("Pass 2 of 2-pass failed: %s", e)
            raise e
            
        for f in os.listdir("."):
            if f.startswith("ffmpeg2pass") or f.endswith(".log") or f.endswith(".log.mbtree"):
                try:
                    os.remove(f)
                except Exception:
                    pass
    else:
        stage_name = f"Using {friendly_enc}..." if "cpu" not in friendly_enc.lower() else f"Encoding {algorithm_name}..."
        set_progress(task_id, 0, stage=stage_name, encoder=friendly_enc, algorithm=algorithm_name)
        
        cmd = [
            ffmpeg, "-y", "-i", input_path,
            "-c:v", vcodec
        ] + v_args + [
            "-c:a", acodec
        ] + a_args + [
            "-loglevel", "error",
            output_path
        ]
        
        _execute_subprocess_task(cmd, task_id, total_dur)
        
    if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
        raise RuntimeError("Compression produced empty or missing output file")
        
    orig_size = os.path.getsize(input_path) if os.path.exists(input_path) else 1
    comp_size = os.path.getsize(output_path) if os.path.exists(output_path) else 1
    ratio = round(orig_size / comp_size, 1)
    ratio_str = f"{ratio}:1"
    set_progress(task_id, 100, stage="Completed", ratio=ratio_str)
    
    return output_path


