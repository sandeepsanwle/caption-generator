"""
Python transcription service.
Accepts audio, runs Whisper, returns SRT with 3-4 word captions.
"""
import os
import tempfile
import warnings
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, Form, HTTPException, UploadFile

from transcribe import transcribe_audio

# Suppress Whisper FP16-on-CPU warning (benign)
warnings.filterwarnings("ignore", message="FP16 is not supported on CPU")

TRANSCRIBE_MODELS = {"tiny", "base", "small", "medium", "large"}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Preload Whisper model on startup (optional, for faster first request)."""
    yield


app = FastAPI(title="Caption Transcription Service", lifespan=lifespan)


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/transcribe")
async def transcribe(
    audio: UploadFile = File(...),
    model: str = Form("small"),
    language: str = Form("auto"),
    words_per_cue: int = Form(4),
    corrected_text: str = Form(""),
    output_script: str = Form("devanagari"),
):
    """Transcribe audio with Whisper. If corrected_text is set, use Whisper only for timing and replace with corrected words. output_script: devanagari | hinglish for caption script."""
    if model not in TRANSCRIBE_MODELS:
        raise HTTPException(400, f"Invalid model. Use: {', '.join(sorted(TRANSCRIBE_MODELS))}")

    words_per_cue = max(1, min(10, words_per_cue))
    lang = (language or "auto").strip().lower() or "auto"
    corrected = (corrected_text or "").strip() or None
    script = (output_script or "devanagari").strip().lower() or "devanagari"

    suffix = ".wav" if audio.filename and audio.filename.lower().endswith(".wav") else ".mp3"
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await audio.read()
            tmp.write(content)
            tmp_path = tmp.name

        try:
            srt = transcribe_audio(
                tmp_path,
                model=model,
                language=lang if lang != "auto" else None,
                words_per_cue=words_per_cue,
                corrected_text=corrected,
                output_script=script,
            )
            return {"srt": srt, "language": language}
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
    except Exception as e:
        raise HTTPException(500, str(e)) from e
