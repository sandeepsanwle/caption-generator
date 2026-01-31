const { parseSrtTimestamp } = require("./srtUtils");

/**
 * Convert seconds to ASS time format: H:MM:SS.cc (centiseconds).
 */
function formatAssTime(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  const cs = Math.round(s * 100);
  const centisec = cs % 100;
  const totalSec = Math.floor(cs / 100);
  const sec = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const min = totalMin % 60;
  const h = Math.floor(totalMin / 60);
  const pad2 = (n) => String(n).padStart(2, "0");
  return `${h}:${pad2(min)}:${pad2(sec)}.${String(centisec).padStart(2, "0")}`;
}

/**
 * Parse SRT content into cues: { start, end, text } (start/end in seconds).
 */
function parseSrtToCues(srtContent) {
  const blocks = String(srtContent).trim().split(/\n\s*\n/);
  const cues = [];
  for (const block of blocks) {
    const lines = block.split(/\r?\n/);
    if (lines.length < 3) continue;
    const timestampLine = lines[1];
    const match = timestampLine.match(/^(.+?)\s*-->\s*(.+)$/);
    if (!match) continue;
    const start = parseSrtTimestamp(match[1]);
    const end = parseSrtTimestamp(match[2]);
    const text = lines.slice(2).map((l) => l.replace(/\s+/g, " ").trim()).join("\\N");
    if (!text) continue;
    cues.push({ start, end, text });
  }
  return cues;
}

/**
 * Escape text for ASS Dialogue: comma and backslash must be escaped.
 * ASS uses \N for newline; we already joined with \\N in parseSrtToCues.
 */
function escapeAssText(text) {
  return String(text)
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\N")
    .replace(/,/g, "\\,");
}

/**
 * Convert SRT content to ASS content with the given style line (full "Style: Default,..." line values only, no "Style: " prefix)
 * and playRes for [Script Info] PlayResX and PlayResY.
 * Style line should be the comma-separated values for the Default style (Alignment=5 for center).
 */
function srtToAss(srtContent, styleLineValues, playResX, playResY) {
  const cues = parseSrtToCues(srtContent);
  const w = Math.max(1, parseInt(playResX, 10) || 1920);
  const h = Math.max(1, parseInt(playResY, 10) || 1080);

  const scriptInfo = [
    "[Script Info]",
    "ScriptType: v4.00+",
    "PlayResX: " + w,
    "PlayResY: " + h,
    "",
  ].join("\r\n");

  const styles = [
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    "Style: " + styleLineValues,
    "",
  ].join("\r\n");

  const eventsHeader = [
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ].join("\r\n");

  const dialogueLines = cues.map((cue) => {
    const start = formatAssTime(cue.start);
    const end = formatAssTime(cue.end);
    const text = escapeAssText(cue.text);
    return `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}`;
  });

  return scriptInfo + styles + eventsHeader + "\r\n" + dialogueLines.join("\r\n") + "\r\n";
}

module.exports = { srtToAss, parseSrtToCues, formatAssTime };
