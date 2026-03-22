from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import ssl
import certifi
ssl._create_default_https_context = lambda: ssl.create_default_context(cafile=certifi.where())
import uvicorn
import os
import uuid
import json
from pathlib import Path

from services.video_processor import compress_video, extract_audio
from services.transcriber import transcribe_audio
from services.broll_detector import detect_broll_moments
from services.pexels_search import search_pexels
from services.trimmer import trim_clip
from services.timeline_exporter import export_timeline

app = FastAPI(title="B-Roll Assistant API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path("uploads")
OUTPUT_DIR = Path("outputs")
UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

jobs = {}


@app.get("/")
def root():
    return {"status": "B-Roll Assistant API running"}


@app.post("/upload")
async def upload_video(file: UploadFile = File(...)):
    allowed = [".mp4", ".mov", ".mkv"]
    ext = Path(file.filename).suffix.lower()
    if ext not in allowed:
        raise HTTPException(status_code=400, detail=f"Unsupported format. Use: {allowed}")

    job_id = str(uuid.uuid4())
    job_dir = UPLOAD_DIR / job_id
    job_dir.mkdir(exist_ok=True)

    file_path = job_dir / f"original{ext}"
    with open(file_path, "wb") as f:
        content = await file.read()
        if len(content) > 4 * 1024 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File too large. Max 4GB.")
        f.write(content)

    jobs[job_id] = {
        "status": "uploaded",
        "original_file": str(file_path),
        "filename": file.filename,
        "job_dir": str(job_dir),
    }

    return {"job_id": job_id, "filename": file.filename, "status": "uploaded"}


@app.post("/process/{job_id}")
async def process_video(job_id: str, intensity: int = 5, background_tasks: BackgroundTasks = None):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    if intensity < 1 or intensity > 10:
        raise HTTPException(status_code=400, detail="Intensity must be 1-10")

    jobs[job_id]["status"] = "processing"
    jobs[job_id]["intensity"] = intensity
    jobs[job_id]["progress"] = 0
    jobs[job_id]["step"] = "Starting..."

    background_tasks.add_task(run_pipeline, job_id)
    return {"job_id": job_id, "status": "processing"}


async def run_pipeline(job_id: str):
    job = jobs[job_id]
    job_dir = Path(job["job_dir"])
    original_file = job["original_file"]
    intensity = job.get("intensity", 5)

    try:
        jobs[job_id]["step"] = "Compressing video..."
        jobs[job_id]["progress"] = 10
        compressed_path = str(job_dir / "compressed.mp4")
        compress_video(original_file, compressed_path)

        jobs[job_id]["step"] = "Extracting audio..."
        jobs[job_id]["progress"] = 25
        audio_path = str(job_dir / "audio.wav")
        extract_audio(compressed_path, audio_path)

        jobs[job_id]["step"] = "Transcribing speech..."
        jobs[job_id]["progress"] = 40
        transcript = transcribe_audio(audio_path)
        jobs[job_id]["transcript"] = transcript

        jobs[job_id]["step"] = "Detecting B-roll moments..."
        jobs[job_id]["progress"] = 65
        moments = detect_broll_moments(transcript, intensity)
        jobs[job_id]["moments"] = moments

        jobs[job_id]["step"] = "Complete"
        jobs[job_id]["progress"] = 100
        jobs[job_id]["status"] = "complete"
        jobs[job_id]["compressed_file"] = compressed_path

    except Exception as e:
        jobs[job_id]["status"] = "error"
        jobs[job_id]["error"] = str(e)
        print(f"Pipeline error for {job_id}: {e}")


@app.get("/status/{job_id}")
def get_status(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    job = jobs[job_id]
    return {
        "job_id": job_id,
        "status": job.get("status"),
        "step": job.get("step", ""),
        "progress": job.get("progress", 0),
        "error": job.get("error"),
    }


@app.get("/results/{job_id}")
def get_results(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    job = jobs[job_id]
    if job.get("status") != "complete":
        raise HTTPException(status_code=400, detail="Job not complete yet")
    return {
        "job_id": job_id,
        "transcript": job.get("transcript", []),
        "moments": job.get("moments", []),
        "intensity": job.get("intensity", 5),
    }


@app.get("/search-media")
def search_media(query: str, per_page: int = 6, media_type: str = "videos"):
    results = search_pexels(query, per_page, media_type)
    return results


@app.post("/trim-clip")
async def trim_clip_endpoint(payload: dict):
    url = payload.get("url")
    duration = payload.get("duration", 5)
    filename = payload.get("filename", "clip.mp4")
    output_path = str(OUTPUT_DIR / filename)
    result = trim_clip(url, duration, output_path)
    return result


@app.get("/download/{filename}")
def download_file(filename: str):
    file_path = OUTPUT_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(str(file_path), filename=filename)


@app.post("/export-timeline/{job_id}")
def export_timeline_endpoint(job_id: str, payload: dict):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    selections = payload.get("selections", [])
    timeline_path = str(OUTPUT_DIR / f"timeline_{job_id}.txt")
    export_timeline(selections, timeline_path)
    return FileResponse(timeline_path, filename=f"timeline_{job_id}.txt")


@app.post("/redetect/{job_id}")
async def redetect_broll(job_id: str, intensity: int = 9, background_tasks: BackgroundTasks = None):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    job = jobs[job_id]
    if not job.get("transcript"):
        raise HTTPException(status_code=400, detail="No transcript available")
    jobs[job_id]["status"] = "redetecting"
    jobs[job_id]["intensity"] = intensity
    background_tasks.add_task(run_redetect, job_id, intensity)
    return {"job_id": job_id, "status": "redetecting"}


async def run_redetect(job_id: str, intensity: int):
    try:
        transcript = jobs[job_id]["transcript"]
        moments = detect_broll_moments(transcript, intensity)
        jobs[job_id]["moments"] = moments
        jobs[job_id]["status"] = "complete"
        jobs[job_id]["intensity"] = intensity
    except Exception as e:
        jobs[job_id]["status"] = "complete"
        print(f"Redetect error: {e}")


@app.post("/generate-fcpxml/{job_id}")
def generate_fcpxml(job_id: str, payload: dict):
    clips = payload.get("clips", [])
    username = payload.get("username", "bobby")
    folder = payload.get("folder", "BRoll_Export")
    fps = 30

    def to_frames(sec):
        return round(float(sec) * fps)

    base_path = f"/Users/{username}/Downloads/{folder}"

    assets = []
    for i, c in enumerate(clips):
        aid = f"r{i+2}"
        dur = f"{to_frames(c['duration'])}/{fps}s"
        src = f"file://{base_path}/{c['filename']}"
        assets.append(
            f'    <asset id="{aid}" name="{c["filename"]}" uid="{aid}" start="0s" '
            f'duration="{dur}" hasVideo="1" videoSources="1" hasAudio="0" audioSources="0" format="r1">\n'
            f'      <media-rep kind="original-media" src="{src}"/>\n'
            f'    </asset>'
        )

    clip_elements = []
    for i, c in enumerate(clips):
        aid = f"r{i+2}"
        dur = f"{to_frames(c['duration'])}/{fps}s"
        offset = f"{to_frames(c['timestamp'])}/{fps}s"
        safe = str(c.get("text","")).replace("<","").replace(">","").replace("&","and").replace('"',"").replace("'","")
        clip_elements.append(
            f'            <asset-clip ref="{aid}" name="{c["filename"]}" '
            f'offset="{offset}" duration="{dur}" tcFormat="NDF">\n'
            f'              <note>{safe}</note>\n'
            f'            </asset-clip>'
        )

    total = to_frames((float(clips[-1]["timestamp"]) if clips else 0) + 30)

    xml = "\n".join([
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<!DOCTYPE fcpxml>',
        '<fcpxml version="1.10">',
        '  <resources>',
        f'    <format id="r1" name="FFVideoFormat1080p30" frameDuration="1/{fps}s" width="1920" height="1080"/>',
        *assets,
        '  </resources>',
        f'  <library location="file:///Users/{username}/Movies/B-Roll-Assistant.fcpbundle">',
        '    <event name="B-Roll Assistant Export">',
        '      <project name="B-Roll Project">',
        f'        <sequence format="r1" duration="{total}/{fps}s" tcStart="0s" tcFormat="NDF" audioLayout="stereo" audioRate="48k">',
        '          <spine>',
        *clip_elements,
        '          </spine>',
        '        </sequence>',
        '      </project>',
        '    </event>',
        '  </library>',
        '</fcpxml>',
    ])

    out_path = OUTPUT_DIR / f"broll_timeline_{job_id}.fcpxml"
    with open(out_path, "w") as f:
        f.write(xml)

    return FileResponse(
        str(out_path),
        media_type="application/octet-stream",
        filename="broll_timeline.fcpxml"
    )


@app.get("/latest-fcpxml/{job_id}")
def get_latest_fcpxml(job_id: str):
    matches = list(OUTPUT_DIR.glob(f"broll_timeline_{job_id}.fcpxml"))
    if not matches:
        raise HTTPException(status_code=404, detail="FCPXML not found")
    return FileResponse(
        str(matches[0]),
        media_type="application/octet-stream",
        filename="broll_timeline.fcpxml"
    )