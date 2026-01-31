# Python Transcription Service

Runs Whisper to create 3–4 word captions. The Node server calls this for auto captions.

## Install

```bash
cd python-service
pip install -r requirements.txt
```

## Run

```bash
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Or from project root: `npm run python:serve`

## Options

- **Models**: tiny, base, small, medium, large (use medium/large for Hindi)
- **API**: `POST /transcribe` with form fields: `audio` (file), `model`, `language`, `words_per_cue`

## Requirements

- Python 3.10+
- openai-whisper
- FFmpeg (for loading audio)
