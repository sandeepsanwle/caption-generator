function pad2(n) {
  return String(n).padStart(2, "0");
}

function pad3(n) {
  return String(n).padStart(3, "0");
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

module.exports = { formatSrtTimestamp, buildSrt };

