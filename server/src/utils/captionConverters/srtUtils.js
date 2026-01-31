function pad2(n) {
  return String(n).padStart(2, "0");
}

function pad3(n) {
  return String(n).padStart(3, "0");
}

/**
 * Parse SRT timestamp (HH:MM:SS,mmm) to seconds.
 */
function parseSrtTimestamp(ts) {
  const m = String(ts || "").trim().match(/^(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})$/);
  if (!m) return 0;
  const h = parseInt(m[1], 10) || 0;
  const min = parseInt(m[2], 10) || 0;
  const s = parseInt(m[3], 10) || 0;
  const ms = parseInt(m[4].padEnd(3, "0").slice(0, 3), 10) || 0;
  return h * 3600 + min * 60 + s + ms / 1000;
}

/**
 * Convert seconds to SRT timestamp format: HH:MM:SS,mmm
 */
function formatSrtTimestamp(seconds) {
  const clamped = Math.max(0, Number(seconds) || 0);
  const totalMs = Math.round(clamped * 1000);

  const ms = totalMs % 1000;
  const totalSec = Math.floor(totalMs / 1000);
  const s = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const m = totalMin % 60;
  const h = Math.floor(totalMin / 60);

  return `${pad2(h)}:${pad2(m)}:${pad2(s)},${pad3(ms)}`;
}

function buildSrt(cues) {
  return cues
    .map((cue, idx) => {
      const start = formatSrtTimestamp(cue.start);
      const end = formatSrtTimestamp(cue.end);
      const text = String(cue.text || "").trim();
      return `${idx + 1}\n${start} --> ${end}\n${text}\n`;
    })
    .join("\n");
}

module.exports = { formatSrtTimestamp, parseSrtTimestamp, buildSrt };

