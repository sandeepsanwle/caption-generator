const { buildSrt } = require("./srtUtils");

function parseVttTimestamp(ts) {
  // VTT supports:
  // - HH:MM:SS.mmm
  // - MM:SS.mmm
  const m = String(ts).trim().match(/^(\d{1,2}:)?(\d{2}):(\d{2})\.(\d{3})$/);
  if (!m) return null;
  const hasHours = Boolean(m[1]);
  const h = hasHours ? Number(m[1].replace(":", "")) : 0;
  const min = Number(m[2]);
  const sec = Number(m[3]);
  const ms = Number(m[4]);
  return h * 3600 + min * 60 + sec + ms / 1000;
}

function vttToSrt(vttString) {
  const raw = String(vttString || "").replace(/\r\n/g, "\n");
  const lines = raw.split("\n");

  // Drop WEBVTT header + any header metadata until first blank line.
  let i = 0;
  if (lines[i]?.trim().toUpperCase().startsWith("WEBVTT")) i++;
  while (i < lines.length && lines[i].trim() !== "") i++;
  while (i < lines.length && lines[i].trim() === "") i++;

  const cues = [];

  while (i < lines.length) {
    // Optional cue identifier line (can be anything) before the time line.
    if (lines[i] && !lines[i].includes("-->") && lines[i].trim() !== "") {
      i++;
    }
    if (i >= lines.length) break;

    const timeLine = lines[i] || "";
    const timeMatch = timeLine.match(
      /^(.+?)\s*-->\s*(.+?)(\s+.*)?$/
    );
    if (!timeMatch) {
      i++;
      continue;
    }

    const start = parseVttTimestamp(timeMatch[1]);
    const end = parseVttTimestamp(timeMatch[2]);
    if (start == null || end == null || end <= start) {
      throw new Error("Invalid VTT timestamps.");
    }

    i++;
    const textLines = [];
    while (i < lines.length && lines[i].trim() !== "") {
      textLines.push(lines[i]);
      i++;
    }

    cues.push({
      start,
      end,
      text: textLines.join("\n").trim(),
    });

    // Skip blank lines between cues
    while (i < lines.length && lines[i].trim() === "") i++;
  }

  if (cues.length === 0) {
    throw new Error("No cues found in VTT file.");
  }

  return buildSrt(cues);
}

module.exports = { vttToSrt };

