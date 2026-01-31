# Offline Caption Generator

Add captions to a video using its own audio. Fully offline: no paid APIs, no cloud.

## What it does

1. You upload one video (MP4 with audio).
2. Captions are created from the video’s audio (Whisper) or from an uploaded SRT/VTT/JSON file.
3. Captions are burned into the video. You download the new video.

## What you need

- **Node.js** 18+
- **Python** 3.10+ (for transcription)
- **FFmpeg** on your system (`ffmpeg -version` and `ffprobe -version` should work)
- **(Optional)** MongoDB for saving job status

## Install

1. Open a terminal in the project folder.
2. Install Node dependencies:
   ```bash
   npm install
   ```
3. Install Python dependencies (includes **stable-ts** for better caption sync):
   ```bash
   cd python-service
   pip install -r requirements.txt
   cd ..
   ```
   For long videos (10+ minutes), ensure enough RAM; transcription runs on the full audio.

## Run (development)

1. Start everything (React, Node, Python):
   ```bash
   npm start
   ```
2. Open in browser: **http://localhost:5173**
3. Upload a video, choose options, click **Generate Video**. When it’s done, use the download link.

To run without the Python service (only SRT/VTT/JSON uploads):

```bash
npm run dev:no-python
```

## Run (production-style)

1. Start the Python transcription service (in one terminal):
   ```bash
   npm run python:serve
   ```
2. Build and start the app (in another terminal):
   ```bash
   npm run start:prod
   ```
3. Open in browser: **http://localhost:5000**

## Config (optional)

```bash
cp server/.env.example server/.env
```

You can set:

- `PORT=5000` – Node server port
- `MONGO_URI=...` – MongoDB URL (optional)
- `MAX_UPLOAD_MB=500` – Max upload size
- `TRANSCRIPTION_SERVICE_URL=http://127.0.0.1:8000` – Python service URL

## Options in the app

- **Caption source**: Auto (Whisper) or upload SRT / VTT / JSON.
- **Language**: Auto-detect, English, or Hindi. For Hindi, use model **Medium** or **Large** for better accuracy.
- **Whisper model**: Tiny / Base / Small / Medium / Large. Larger = slower but more accurate.
- **Corrected captions (optional)**: When using Auto (Whisper), you can paste corrected script (e.g. corrected Hindi). Whisper is used only for word-level timestamps; your text is aligned to those timings and replaces Whisper’s text. Leave empty to use Whisper output as-is.
- **Words at a time**: How many words per caption line (default 4).
- **Subtitle styling**: Font size, color, outline.

## JSON captions format

If you upload JSON, use this shape:

```json
[
  { "start": 0.0, "end": 2.5, "text": "Hello world" },
  { "start": 2.5, "end": 5.0, "text": "Next line" }
]
```

## Project layout

- **client** – React UI
- **server** – Node: uploads, calls Python, runs FFmpeg
- **python-service** – Whisper transcription, 3–4 word captions

All processing is local; no paid or cloud services.
