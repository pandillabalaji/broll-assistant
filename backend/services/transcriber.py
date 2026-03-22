import whisper
import os


_model = None

def get_model():
    global _model
    if _model is None:
        print("Loading Whisper model (base)... this may take a moment on first run.")
        _model = whisper.load_model("base")
    return _model


def transcribe_audio(audio_path: str) -> list:
    """
    Transcribe audio using OpenAI Whisper.
    Returns list of segments: [{start, end, text}, ...]
    """
    model = get_model()
    result = model.transcribe(
        audio_path,
        word_timestamps=False,
        verbose=False
    )

    segments = []
    for seg in result.get("segments", []):
        segments.append({
            "start": round(seg["start"], 2),
            "end": round(seg["end"], 2),
            "text": seg["text"].strip()
        })

    return segments
