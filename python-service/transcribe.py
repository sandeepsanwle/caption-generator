"""
Whisper transcription with 3-4 word caption splitting.
Uses stable-ts (stable_whisper) when available for better word-level sync; falls back to openai-whisper.
For Hindi, use language=hi and model medium/large for better accuracy.
"""
import re
from pathlib import Path

import whisper

try:
    import stable_whisper
    STABLE_WHISPER_AVAILABLE = True
except ImportError:
    STABLE_WHISPER_AVAILABLE = False

try:
    from indic_transliteration import sanscript
    from indic_transliteration.sanscript import transliterate as indic_transliterate
    INDIC_TRANSLITERATION_AVAILABLE = True
except ImportError:
    INDIC_TRANSLITERATION_AVAILABLE = False

# Devanagari Unicode range (blocks for Hindi/Sanskrit)
_DEVANAGARI_RE = re.compile(r"[\u0900-\u097F]")

# ITRANS retroflex notation: .D = ड, .T = ट, etc. Remove dot for cleaner Hinglish (e.g. sa.daka -> sadaka)
_ITRANS_RETROFLEX_DOT = re.compile(r"\.([a-zA-Z])")


def _text_to_hinglish(text: str) -> str:
    """Convert Devanagari text to Roman (Hinglish) using ITRANS. Lowercase, cleaner spellings. Leaves non-Devanagari unchanged."""
    if not text or not INDIC_TRANSLITERATION_AVAILABLE:
        return text
    if not _DEVANAGARI_RE.search(text):
        return text
    try:
        roman = indic_transliterate(text, sanscript.DEVANAGARI, sanscript.ITRANS)
        # All lowercase for consistent Hinglish
        roman = roman.lower()
        # Remove ITRANS retroflex dot notation for more natural Hinglish (sa.daka -> sadaka)
        roman = _ITRANS_RETROFLEX_DOT.sub(r"\1", roman)
        return roman
    except Exception:
        return text


def _srt_caption_text_to_lower(srt_content: str) -> str:
    """Lowercase only the caption text (third line onwards) in each SRT block. Index and timestamps unchanged."""
    if not srt_content:
        return srt_content
    blocks = [b.strip() for b in srt_content.strip().split("\n\n") if b.strip()]
    out = []
    for block in blocks:
        lines = block.split("\n")
        if len(lines) >= 3:
            # lines[0]=index, lines[1]=timestamps, lines[2:]=text
            text = " ".join(lines[2:]).strip().lower()
            out.append("\n".join([lines[0], lines[1], text]))
        else:
            out.append(block)
    return "\n\n".join(out) + ("\n" if out else "")


def _srt_to_hinglish(srt_content: str) -> str:
    """Convert SRT caption text lines from Devanagari to Hinglish (Roman). Lowercase, natural spellings. Keeps index and timestamps unchanged."""
    if not srt_content or not INDIC_TRANSLITERATION_AVAILABLE:
        return srt_content
    blocks = [b.strip() for b in srt_content.strip().split("\n\n") if b.strip()]
    out = []
    for block in blocks:
        lines = block.split("\n")
        if len(lines) >= 3:
            # lines[0]=index, lines[1]=timestamps, lines[2:]=text
            text_lines = [lines[0], lines[1]] + [_text_to_hinglish(" ".join(lines[2:]).strip())]
            out.append("\n".join(text_lines))
        else:
            out.append(block)
    return "\n\n".join(out) + ("\n" if out else "")


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


def _get_whisper_segments(
    audio_path: str | Path,
    *,
    model: str = "small",
    language: str | None = None,
) -> list[tuple[float, float]]:
    """Run Whisper without word_timestamps; return list of (start_sec, end_sec) per segment."""
    model_obj = whisper.load_model(model)
    result = model_obj.transcribe(
        str(audio_path),
        language=language,
        task="transcribe",
        fp16=False,
        initial_prompt="Accurate Hindi transcription in Devanagari script." if language == "hi" else None,
        condition_on_previous_text=True,
        compression_ratio_threshold=2.4,
        no_speech_threshold=0.6,
        word_timestamps=False,
    )
    out: list[tuple[float, float]] = []
    for seg in result.get("segments") or []:
        if not isinstance(seg, dict):
            continue
        try:
            start = float(seg.get("start", 0))
            end = float(seg.get("end", start + 0.1))
        except (TypeError, ValueError):
            continue
        out.append((start, end))
    return out


def _align_corrected_text_to_segments(
    segment_times: list[tuple[float, float]],
    corrected_text: str,
) -> list[tuple[str, float, float]]:
    """
    Distribute user's corrected words across segment timings.
    Each segment gets a proportional chunk of corrected words; time is split evenly within the segment.
    """
    corrected_words = [w.strip() for w in corrected_text.strip().split() if w.strip()]
    if not corrected_words or not segment_times:
        return []

    n_seg = len(segment_times)
    result: list[tuple[str, float, float]] = []
    for i in range(n_seg):
        start_sec, end_sec = segment_times[i]
        k0 = (i * len(corrected_words)) // n_seg
        k1 = ((i + 1) * len(corrected_words)) // n_seg
        count = k1 - k0
        if count <= 0:
            continue
        duration = (end_sec - start_sec) / count if count else 0
        for j in range(count):
            idx = min(k0 + j, len(corrected_words) - 1)
            t0 = start_sec + j * duration
            t1 = start_sec + (j + 1) * duration if j < count - 1 else end_sec
            result.append((corrected_words[idx], t0, t1))
    return result


def _get_whisper_word_timestamps(
    audio_path: str | Path,
    *,
    model: str = "small",
    language: str | None = None,
) -> list[tuple[str, float, float]]:
    """Run Whisper with word_timestamps=True; return list of (word, start_sec, end_sec)."""
    model_obj = whisper.load_model(model)
    result = model_obj.transcribe(
        str(audio_path),
        language=language,
        task="transcribe",
        fp16=False,
        initial_prompt="Accurate Hindi transcription in Devanagari script." if language == "hi" else None,
        condition_on_previous_text=True,
        compression_ratio_threshold=2.4,
        no_speech_threshold=0.6,
        word_timestamps=True,
    )

    words_with_ts: list[tuple[str, float, float]] = []
    segments = result.get("segments") or []
    if not isinstance(segments, list):
        return words_with_ts
    for seg in segments:
        words_raw = seg.get("words") if isinstance(seg, dict) else None
        if not words_raw or not isinstance(words_raw, list):
            continue
        for w in words_raw:
            if not isinstance(w, dict):
                continue
            word = (w.get("word") or w.get("text") or "").strip()
            if not word:
                continue
            try:
                start = float(w.get("start", 0))
                end = float(w.get("end", start + 0.1))
            except (TypeError, ValueError):
                continue
            words_with_ts.append((word, start, end))
    return words_with_ts


def _align_corrected_text_to_whisper_timestamps(
    whisper_words: list[tuple[str, float, float]],
    corrected_text: str,
) -> list[tuple[str, float, float]]:
    """
    Align user-provided corrected text (space-separated words) to Whisper word timestamps.
    Preserves Whisper timing; replaces text with corrected words.
    """
    corrected_words = [w.strip() for w in corrected_text.strip().split() if w.strip()]
    if not corrected_words:
        return whisper_words
    if not whisper_words:
        return []

    n_whisper = len(whisper_words)
    n_corrected = len(corrected_words)
    result: list[tuple[str, float, float]] = []

    if n_corrected == n_whisper:
        for i, (_, start, end) in enumerate(whisper_words):
            idx = min(i, n_corrected - 1)
            result.append((corrected_words[idx], start, end))
    elif n_corrected < n_whisper:
        # Group Whisper timestamps: each corrected word gets a range of Whisper words
        size = max(1, (n_whisper + n_corrected - 1) // n_corrected)
        for i in range(n_corrected):
            j0 = min(i * size, n_whisper - 1)
            j1 = min(j0 + size, n_whisper)
            if j1 <= j0:
                j1 = j0 + 1
            j1 = min(j1, n_whisper)
            start = whisper_words[j0][1]
            end = whisper_words[j1 - 1][2]
            result.append((corrected_words[i], start, end))
    else:
        # Split: distribute corrected words across Whisper timestamps (divide time)
        for i in range(n_whisper):
            start_wh, end_wh = whisper_words[i][1], whisper_words[i][2]
            k0 = (i * n_corrected) // n_whisper
            k1 = ((i + 1) * n_corrected) // n_whisper
            count = k1 - k0
            if count <= 0:
                continue
            duration = (end_wh - start_wh) / count if count else 0
            for j in range(count):
                cidx = min(k0 + j, n_corrected - 1)
                t0 = start_wh + j * duration
                t1 = start_wh + (j + 1) * duration if j < count - 1 else end_wh
                result.append((corrected_words[cidx], t0, t1))
    return result


def _words_to_srt_chunks(
    words_with_ts: list[tuple[str, float, float]],
    max_words_per_cue: int = 4,
) -> str:
    """Build SRT from (word, start, end) list with 3-4 word cue grouping."""
    if not words_with_ts:
        return ""

    cues: list[tuple[float, float, str]] = []
    for i in range(0, len(words_with_ts), max_words_per_cue):
        chunk = words_with_ts[i : i + max_words_per_cue]
        if not chunk:
            continue
        text = " ".join(w[0] for w in chunk)
        start = chunk[0][1]
        end = chunk[-1][2]
        cues.append((start, end, text))

    return "\n\n".join(
        f"{idx + 1}\n{format_srt_timestamp(s)} --> {format_srt_timestamp(e)}\n{t}"
        for idx, (s, e, t) in enumerate(cues)
    ) + "\n"


def _transcribe_stable_whisper(
    audio_path: str | Path,
    *,
    model: str = "small",
    language: str | None = None,
    words_per_cue: int = 4,
    corrected_text: str | None = None,
) -> str | None:
    """
    Use stable-ts (stable_whisper) for transcription with better word-level sync.
    Returns SRT string, or None if stable_whisper not available or fails.
    """
    if not STABLE_WHISPER_AVAILABLE:
        return None
    try:
        model_obj = stable_whisper.load_model(model)
        lang = language if language and language != "auto" else None
        result = model_obj.transcribe(
            str(audio_path),
            language=lang,
            vad=False,
            word_timestamps=True,
        )
        if not result or not getattr(result, "segments", None):
            return None
        words_with_ts: list[tuple[str, float, float]] = []
        for seg in result.segments:
            if not getattr(seg, "words", None):
                continue
            for w in seg.words:
                word = (getattr(w, "word", None) or "").strip()
                if not word:
                    continue
                start = getattr(w, "start", 0) or 0
                end = getattr(w, "end", start + 0.1) or start + 0.1
                try:
                    start, end = float(start), float(end)
                except (TypeError, ValueError):
                    continue
                words_with_ts.append((word, start, end))
        if not words_with_ts:
            return None
        if corrected_text and corrected_text.strip():
            aligned = _align_corrected_text_to_whisper_timestamps(
                words_with_ts, corrected_text.strip()
            )
            return _words_to_srt_chunks(aligned, max_words_per_cue=words_per_cue)
        return _words_to_srt_chunks(words_with_ts, max_words_per_cue=words_per_cue)
    except Exception:
        return None


def _transcribe_openai_whisper(
    audio_path: str | Path,
    *,
    model: str = "small",
    language: str | None = None,
    words_per_cue: int = 4,
    corrected_text: str | None = None,
) -> str:
    """Use openai-whisper for transcription. If corrected_text is provided, use Whisper only for timing and replace with corrected words."""
    if corrected_text and corrected_text.strip():
        lang = None if (not language or language == "auto") else language
        corrected_stripped = corrected_text.strip()
        # Try word-level timestamps first (best timing)
        whisper_words: list[tuple[str, float, float]] = []
        try:
            whisper_words = _get_whisper_word_timestamps(
                audio_path,
                model=model,
                language=lang,
            )
        except Exception:
            # Whisper can raise e.g. list index out of range when word_timestamps have edge cases
            whisper_words = []

        if whisper_words:
            aligned = _align_corrected_text_to_whisper_timestamps(whisper_words, corrected_stripped)
            return _words_to_srt_chunks(aligned, max_words_per_cue=words_per_cue)

        # Fallback: use segment-level timing so we still use the user's corrected text (never Whisper text)
        try:
            segment_times = _get_whisper_segments(
                audio_path,
                model=model,
                language=lang,
            )
            if segment_times:
                aligned = _align_corrected_text_to_segments(segment_times, corrected_stripped)
                if aligned:
                    return _words_to_srt_chunks(aligned, max_words_per_cue=words_per_cue)
        except Exception:
            pass
        # If both fail, run normal transcription then replace segment text with corrected chunks
        # (one more fallback: segment-level transcribe, then map corrected text to those segments)
        try:
            model_obj = whisper.load_model(model)
            result = model_obj.transcribe(
                str(audio_path),
                language=language,
                task="transcribe",
                fp16=False,
                initial_prompt="Accurate Hindi transcription in Devanagari script." if language == "hi" else None,
                condition_on_previous_text=True,
                compression_ratio_threshold=2.4,
                no_speech_threshold=0.6,
                word_timestamps=False,
            )
            segments = result.get("segments") or []
            if segments and isinstance(segments, list):
                segment_times = []
                for seg in segments:
                    if not isinstance(seg, dict):
                        continue
                    try:
                        segment_times.append((float(seg.get("start", 0)), float(seg.get("end", 0))))
                    except (TypeError, ValueError):
                        continue
                if segment_times:
                    aligned = _align_corrected_text_to_segments(segment_times, corrected_stripped)
                    if aligned:
                        return _words_to_srt_chunks(aligned, max_words_per_cue=words_per_cue)
        except Exception:
            pass
        # Last resort: single segment spanning 0 to a default duration (avoid empty output)
        corrected_words = [w.strip() for w in corrected_stripped.split() if w.strip()]
        if corrected_words:
            # Assume ~0.3s per word for display
            duration_per_word = 0.35
            words_with_ts = [
                (w, i * duration_per_word, (i + 1) * duration_per_word)
                for i, w in enumerate(corrected_words)
            ]
            return _words_to_srt_chunks(words_with_ts, max_words_per_cue=words_per_cue)

    model_obj = whisper.load_model(model)
    # fp16=False on CPU for stability; process full audio (no truncation)
    result = model_obj.transcribe(
        str(audio_path),
        language=language,
        task="transcribe",
        fp16=False,
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
    corrected_text: str | None = None,
    output_script: str | None = None,
) -> str:
    """
    Run Whisper on audio, return SRT with 3-4 word cues (full audio).
    Prefers stable-ts for better word-level sync when available.
    If corrected_text is provided, timing is used and corrected words replace transcript text.
    If output_script == "hinglish", Devanagari caption text is transliterated to Roman (Hinglish).
    """
    lang = None if (not language or language == "auto") else language
    # Prefer stable-ts for better word-level sync and full transcription
    if STABLE_WHISPER_AVAILABLE:
        srt = _transcribe_stable_whisper(
            audio_path,
            model=model,
            language=lang,
            words_per_cue=words_per_cue,
            corrected_text=corrected_text,
        )
        if srt and srt.strip():
            if (output_script or "").strip().lower() == "hinglish":
                srt = _srt_to_hinglish(srt)
            return _srt_caption_text_to_lower(srt)
    srt = _transcribe_openai_whisper(
        audio_path,
        model=model,
        language=lang,
        words_per_cue=words_per_cue,
        corrected_text=corrected_text,
    )
    if (output_script or "").strip().lower() == "hinglish":
        srt = _srt_to_hinglish(srt)
    return _srt_caption_text_to_lower(srt)
