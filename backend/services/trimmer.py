import subprocess
import requests
import os
import random
import tempfile
from pathlib import Path


def trim_clip(url: str, duration: float, output_path: str) -> dict:
    """
    Download a clip from URL and trim it to the required duration.
    Uses a smart starting point to avoid boring beginnings.
    """
    try:
        # Download the clip to a temp file
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
            tmp_path = tmp.name

        headers = {"User-Agent": "Mozilla/5.0"}
        response = requests.get(url, headers=headers, stream=True, timeout=30)
        response.raise_for_status()

        with open(tmp_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)

        # Get duration of downloaded clip
        probe_cmd = [
            "ffprobe", "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            tmp_path
        ]
        probe_result = subprocess.run(probe_cmd, capture_output=True, text=True)
        clip_duration = float(probe_result.stdout.strip()) if probe_result.returncode == 0 else 10.0

        # Smart start: use first 30% of clip or random point in first half
        # This avoids black frames at start while keeping natural feel
        max_start = max(0, clip_duration - duration)
        if max_start > 2:
            # Pick a start point in the first 40% of available range
            start_time = random.uniform(0, min(max_start, clip_duration * 0.4))
        else:
            start_time = 0

        # Trim with FFmpeg
        cmd = [
            "ffmpeg", "-y",
            "-ss", str(start_time),
            "-i", tmp_path,
            "-t", str(duration),
            "-c:v", "libx264",
            "-crf", "23",
            "-preset", "fast",
            "-c:a", "aac",
            "-b:a", "128k",
            output_path
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)

        # Clean up temp file
        os.unlink(tmp_path)

        if result.returncode != 0:
            return {"success": False, "error": result.stderr}

        filename = Path(output_path).name
        return {
            "success": True,
            "filename": filename,
            "duration": duration,
            "start_time": round(start_time, 2),
        }

    except Exception as e:
        return {"success": False, "error": str(e)}
