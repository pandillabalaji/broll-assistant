# 🎬 B-Roll Assistant

An AI-powered tool that automatically suggests B-roll footage for your videos.

## How it works
1. Upload your video (MP4, MOV, MKV — max 4GB)
2. Set B-roll intensity (1–10)
3. Whisper AI transcribes your speech locally
4. Groq AI (Llama 3.3 70B) detects the best B-roll moments
5. Pexels API searches for matching 16:9 stock footage
6. Auto-trim clips to exact duration needed
7. Download clips + export timeline for your editor

## Tech Stack
| Layer | Tool |
|---|---|
| Frontend | React + Tailwind CSS + Vite |
| Backend | FastAPI + Python |
| Speech-to-text | OpenAI Whisper (runs locally, free) |
| B-roll detection | Groq API — Llama 3.3 70B (free) |
| Stock media | Pexels API (free) |
| Video processing | FFmpeg |

## Prerequisites
- Python 3.10+
- Node.js (LTS)
- FFmpeg: `brew install ffmpeg`
- Free [Groq API key](https://console.groq.com)
- Free [Pexels API key](https://www.pexels.com/api/)

## Setup (first time only)

**1. Add your API keys:**
```bash
cp backend/.env.example backend/.env
# Edit backend/.env and add your real keys
```

**2. Install Python dependencies:**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

**3. Install frontend dependencies:**
```bash
cd frontend
npm install
```

## Running the app

Edit `START.command` and replace `YOUR_GROQ_KEY_HERE` and `YOUR_PEXELS_KEY_HERE` with your actual keys, then double-click `START.command`.

Or manually:

**Terminal 1 — Backend:**
```bash
cd backend
source venv/bin/activate
export GROQ_API_KEY="your_key"
export PEXELS_API_KEY="your_key"
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

Open **http://localhost:5173**

## Project Structure
```
broll-groq/
├── backend/
│   ├── main.py                  # FastAPI app + all endpoints
│   ├── services/
│   │   ├── broll_detector.py    # Groq AI B-roll detection
│   │   ├── pexels_search.py     # Pexels stock media search
│   │   ├── transcriber.py       # Whisper speech-to-text
│   │   ├── trimmer.py           # FFmpeg auto-trim
│   │   ├── video_processor.py   # FFmpeg compression
│   │   └── timeline_exporter.py # Timeline file export
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── index.css
│   │   ├── main.jsx
│   │   └── components/
│   │       ├── UploadStep.jsx
│   │       ├── ProcessingStep.jsx
│   │       ├── EditorStep.jsx
│   │       ├── TranscriptPanel.jsx
│   │       ├── MomentsPanel.jsx
│   │       └── MediaSearchPanel.jsx
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── postcss.config.js
├── START.command                # Double-click to start
└── README.md
```
<img width="1800" height="1169" alt="Screenshot 2026-03-15 at 9 58 18 AM" src="https://github.com/user-attachments/assets/4d11c692-1803-48d9-a87d-d362a3dd6c20" />
