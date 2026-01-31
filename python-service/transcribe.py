"""
Whisper transcription with 3-4 word caption splitting.
Uses openai-whisper. For Hindi, use language=hi and model medium/large for better accuracy.
"""
import re
from pathlib import Path

import whisper


def parse_srt_timestamp(ts: str) -> float:
    """Parse SRT timestamp (HH:MM:SS,mmm) to seconds."""
    m = re.match(r"^(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})$", (ts or "").strip())
    if not m:
        return 0.0
    h, min_, s = int(m[1] or 0), int(m[2] or 0), int(m[3] or 0)
    ms = int((m[4] or "0").ljust(3, "0")[:3], 10)
    return h * 3600 + min_ * 60 + s + ms / 1000


def format_srt_timestamp(seconds: float) -> str:
    """Convert seconds to SRT timestamp format HH:MM:SS,mmm."""
    total_ms = max(0, int(round(seconds * 1000)))
    ms = total_ms % 1000
    total_sec = total_ms // 1000
    s = total_sec % 60
    total_min = total_sec // 60
    m = total_min % 60
    h = total_min // 60
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def split_srt_into_word_chunks(srt_content: str, max_words_per_cue: int = 4) -> str:
    """
    Split SRT cues so each displays only 3-4 words at a time.
    Creates multiple cues with proportional timing.
    If max_words_per_cue <= 0, returns content unchanged.
    """
    if max_words_per_cue < 1:
        return srt_content

    blocks = [b.strip() for b in srt_content.strip().split("\n\n") if b.strip()]
    all_cues = []

    for block in blocks:
        lines = [ln.strip() for ln in block.split("\n")]
        if len(lines) < 3:
            continue

        timestamp_line = lines[1]
        match = re.match(r"^(.+?)\s*-->\s*(.+)$", timestamp_line)
        if not match:
            continue

        start_sec = parse_srt_timestamp(match.group(1))
        end_sec = parse_srt_timestamp(match.group(2))
        full_text = " ".join(lines[2:]).strip()
        if not full_text:
            continue

        words = full_text.split()
        duration = end_sec - start_sec

        for i in range(0, len(words), max_words_per_cue):
            chunk = words[i : i + max_words_per_cue]
            chunk_text = " ".join(chunk)
            chunk_start = start_sec + (i / len(words)) * duration
            chunk_end = start_sec + (min(i + max_words_per_cue, len(words)) / len(words)) * duration

            all_cues.append({"start": chunk_start, "end": chunk_end, "text": chunk_text})

    return "\n\n".join(
        f"{idx + 1}\n{format_srt_timestamp(c['start'])} --> {format_srt_timestamp(c['end'])}\n{c['text']}"
        for idx, c in enumerate(all_cues)
    ) + ("\n" if all_cues else "")


def _transcribe_openai_whisper(
    audio_path: str | Path,
    *,
    model: str = "small",
    language: str | None = None,
    words_per_cue: int = 4,
) -> str:
    """Use openai-whisper for transcription. For Hindi, use model medium or large for better word accuracy."""
    model_obj = whisper.load_model(model)
    result = model_obj.transcribe(
        str(audio_path),
        language=language,
        task="transcribe",
        initial_prompt="Accurate Hindi transcription in Devanagari script." if language == "hi" else None,
        condition_on_previous_text=True,
        compression_ratio_threshold=2.4,
        no_speech_threshold=0.6,
        word_timestamps=False,
    )

    segments = result.get("segments", [])
    raw_lines = []
    for i, seg in enumerate(segments):
        start = seg.get("start", 0)
        end = seg.get("end", start + 1)
        text = (seg.get("text") or "").strip()
        if not text:
            continue
        raw_lines.append(f"{i + 1}\n{format_srt_timestamp(start)} --> {format_srt_timestamp(end)}\n{text}")

    raw_srt = "\n\n".join(raw_lines) + ("\n" if raw_lines else "")
    return split_srt_into_word_chunks(raw_srt, max_words_per_cue=words_per_cue)


def transcribe_audio(
    audio_path: str | Path,
    *,
    model: str = "small",
    language: str | None = "auto",
    words_per_cue: int = 4,
) -> str:
    """
    Run Whisper on audio, return SRT with 3-4 word cues.
    For Hindi: set language=hi and use model medium or large for better word accuracy.
    """
    lang = None if (not language or language == "auto") else language
    return _transcribe_openai_whisper(
        audio_path,
        model=model,
        language=lang,
        words_per_cue=words_per_cue,
    )
