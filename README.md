# Offline Caption Generator (MERN + Whisper + FFmpeg)

Production-ready MERN app that adds **perfectly synced captions** to a video by analyzing the video’s **own audio**. Fully offline: no paid APIs, no cloud AI.

## Core idea

- User uploads **one video** (MP4 with audio).
- Captions are generated from that video’s audio (Whisper) or from uploaded SRT/VTT/JSON.
- Original video and audio stay unchanged; only **burned-in subtitles** are added.
- Audio inside the video is the **single source of truth**.

## Features

- **Single upload**: one video file (MP4 with audio).
- **Caption source** (choose one):
  - **Auto (Whisper)** – extract audio from video, run local Whisper, get word-level SRT, burn into video.
  - **Upload SRT** – use as-is.
  - **Upload VTT** – converted to SRT, then burned.
  - **Upload JSON** – converted to SRT, then burned.
- **Whisper**: model (tiny/base/small/medium/large), language (auto / en / hi, etc.).
- **FFmpeg**: extract audio (WAV 16kHz mono for Whisper); burn subtitles with styling (font size, color, outline, bottom-center).
- **Optional MongoDB**: job status stored in DB if `MONGO_URI` is set; otherwise in-memory.

## Requirements

- **Node.js** 18+
- **FFmpeg** (and ffprobe) on PATH:
  ```bash
  ffmpeg -version
  ffprobe -version
  ```
- **Whisper** (openai-whisper) on PATH:
  ```bash
  pip install openai-whisper
  whisper --help
  ```
- **(Optional)** MongoDB (local or Atlas free tier)

## Install

From the project root:

```bash
npm install
```

## Run (dev)

Starts server (port `5000`) and React dev server (port `5173`):

```bash
npm start
```

Open: **http://localhost:5173**

## Run (prod-like)

Build client and serve from Express:

```bash
npm run start:prod
```

Open: **http://localhost:5000**

## Backend env

```bash
cp server/.env.example server/.env
```

- `PORT=5000`
- `MONGO_URI=...` (optional)
- `MAX_UPLOAD_MB=500`

## JSON captions format

```json
[
  { "start": 0.0, "end": 2.5, "text": "Hello world" },
  { "start": 2.5, "end": 5.0, "text": "This is a mystery" }
]
```

## Project structure

```
/client
  /src
    components
    pages
    services
/server
  /src
    controllers
    routes
    utils
      captionConverters
      ffmpegRunner
      whisperRunner
  /uploads
  /outputs
```

## Flow (auto captions)

1. User uploads video, selects “Auto-generate (Whisper)”.
2. Server extracts audio: `ffmpeg -i video.mp4 -vn ... extract.wav`.
3. Server runs: `whisper extract.wav --model small --output_format srt --output_dir jobDir [--language en]`.
4. Server burns SRT into video: `ffmpeg -i video.mp4 -vf subtitles=... -c:a copy out.mp4`.
5. User downloads final video.

Everything is free and self-hosted; no paid or cloud services.
