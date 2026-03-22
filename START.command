#!/bin/bash
# ── B-Roll Assistant — Start ──────────────────────────
cd "$(dirname "$0")"

echo ""
echo "🎬 Starting B-Roll Assistant..."
echo ""

# Kill anything already on these ports
kill $(lsof -ti:8000) 2>/dev/null
kill $(lsof -ti:5173) 2>/dev/null
sleep 1

# Start backend
cd backend
source venv/bin/activate
export GROQ_API_KEY="YOUR_GROQ_KEY_HERE"
export PEXELS_API_KEY="YOUR_PEXELS_KEY_HERE"
python -m uvicorn main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
cd ..

echo "✅ Backend starting..."
sleep 4

# Start frontend
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

sleep 2
echo ""
echo "✅ App is running at: http://localhost:5173"
echo ""
open http://localhost:5173

# Shutdown on Ctrl+C
trap "echo 'Stopping...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait
