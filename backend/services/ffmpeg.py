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

logger = logging.getLogger("ytshort.ffmpeg")

_progress_lock = threading.Lock()
_progress_store: dict[str, int] = {}

def set_progress(task_id: str, percent: int) -> None:
    if not task_id:
        return
    with _progress_lock:
        _progress_store[task_id] = percent

def get_progress(task_id: str) -> int:
    with _progress_lock:
        return _progress_store.get(task_id, 0)

def clear_progress(task_id: str) -> None:
    with _progress_lock:
        if task_id in _progress_store:
            del _progress_store[task_id]


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


def _run_ffmpeg(cmd: list) -> None:
    """Run an FFmpeg command and raise RuntimeError on failure."""
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=cfg.YTDLP_TIMEOUT,
        )
    except subprocess.TimeoutExpired:
        raise RuntimeError("FFmpeg media conversion timed out.")

    if result.returncode != 0:
        logger.error("FFmpeg stderr: %s", result.stderr)
        raise RuntimeError(f"FFmpeg media conversion failed: {result.stderr.strip()}")


def _run_ffmpeg_with_progress(cmd: list, task_id: str, total_duration: float) -> None:
    """Run FFmpeg command and parse output to update task_id progress."""
    if not task_id or not total_duration or total_duration <= 0:
        _run_ffmpeg(cmd)
        return

    progress_cmd = list(cmd)
    output_file = progress_cmd.pop()
    progress_cmd += ["-progress", "-", output_file]

    try:
        process = subprocess.Popen(
            progress_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
            universal_newlines=True
        )

        while True:
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

        process.wait(timeout=cfg.YTDLP_TIMEOUT)
        if process.returncode != 0:
            stderr_content = process.stderr.read()
            logger.error("FFmpeg error: %s", stderr_content)
            raise RuntimeError(f"FFmpeg failed with code {process.returncode}: {stderr_content.strip()}")

        set_progress(task_id, 100)

    except Exception as e:
        logger.error("Error running FFmpeg with progress: %s", e)
        raise


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


def compress_video_file(input_path: str, output_path: str, level: str, task_id: str = None) -> str:
    ffmpeg = _ffmpeg_bin()
    target_ext = os.path.splitext(output_path)[1].lower()

    if target_ext == '.webm':
        crf_map = {
            'low': '24',
            'medium': '30',
            'high': '36'
        }
        crf = crf_map.get(level, '30')
        cmd = [
            ffmpeg,
            '-y',
            '-i', input_path,
            '-c:v', 'libvpx-vp9',
            '-crf', crf,
            '-b:v', '0',
            '-c:a', 'libopus',
            '-b:a', '128k' if level != 'high' else '96k',
            '-loglevel', 'error',
            output_path
        ]
    else:
        crf_map = {
            'low': '20',
            'medium': '26',
            'high': '32'
        }
        crf = crf_map.get(level, '26')
        cmd = [
            ffmpeg,
            '-y',
            '-i', input_path,
            '-c:v', 'libx264',
            '-preset', 'medium',
            '-crf', crf,
            '-c:a', 'aac',
            '-b:a', '128k' if level != 'high' else '96k',
            '-loglevel', 'error',
            output_path
        ]

    logger.debug("FFmpeg video compress: %s", " ".join(cmd))
    total_dur = probe_duration(input_path)
    if task_id and total_dur:
        _run_ffmpeg_with_progress(cmd, task_id, total_dur)
    else:
        _run_ffmpeg(cmd)

    if not os.path.isfile(output_path):
        raise RuntimeError("FFmpeg compression produced no output file.")

    return output_path


