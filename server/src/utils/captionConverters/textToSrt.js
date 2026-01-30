const { buildSrt } = require("./srtUtils");

function splitIntoWordChunks(text, { minWords = 3, maxWords = 5 } = {}) {
  const words = String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

  if (words.length === 0) return [];

  // Choose a chunk size in the 3–5 range (defaulting to 4).
  const chunkSize = Math.min(maxWords, Math.max(minWords, 4));

  const chunks = [];
  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(" "));
  }
  return chunks;
}

function splitTextIntoCaptions(text) {
  const rawLines = String(text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // If the user provided meaningful newlines, preserve them as cue boundaries.
  if (rawLines.length >= 2) return rawLines;

  // Otherwise, use word chunks (good for reels/shorts).
  return splitIntoWordChunks(text);
}

/**
 * Distribute caption cues evenly across the audio duration.
 */
function textToSrt(text, durationSeconds) {
  const captions = splitTextIntoCaptions(text);
  if (captions.length === 0) {
    throw new Error("Text captions are empty.");
  }

  const duration = Number(durationSeconds);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("Invalid audio duration (ffprobe failed).");
  }

  const n = captions.length;
  const slice = duration / n;

  const cues = captions.map((line, i) => {
    const start = i * slice;
    const end = i === n - 1 ? duration : (i + 1) * slice;
    return { start, end, text: line };
  });

  return buildSrt(cues);
}

module.exports = { textToSrt };

