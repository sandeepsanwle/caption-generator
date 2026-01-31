const { formatSrtTimestamp, parseSrtTimestamp } = require("./srtUtils");

/**
 * Splits SRT cues so each displays only 3-4 words at a time (not multiple lines).
 * Creates multiple cues with proportional timing - only one short phrase visible per moment.
 *
 * @param {string} srtContent - Raw SRT file content
 * @param {number} maxWordsPerCue - Max words per cue (default 4 for "3-4 words at a time")
 * @returns {string} - Rewritten SRT with split cues
 */
function srtWordWrap(srtContent, maxWordsPerCue = 4) {
  if (!maxWordsPerCue || maxWordsPerCue < 1) return srtContent;

  const blocks = srtContent.trim().split(/\n\s*\n/);
  const allCues = [];

  for (const block of blocks) {
    const lines = block.split(/\r?\n/);
    if (lines.length < 3) continue;

    const timestampLine = lines[1];
    const match = timestampLine.match(/^(.+?)\s*-->\s*(.+)$/);
    if (!match) continue;

    const startSec = parseSrtTimestamp(match[1]);
    const endSec = parseSrtTimestamp(match[2]);
    const fullText = lines.slice(2).join(" ").replace(/\s+/g, " ").trim();
    if (!fullText) continue;

    const words = fullText.split(/\s+/).filter(Boolean);
    const duration = endSec - startSec;

    for (let i = 0; i < words.length; i += maxWordsPerCue) {
      const chunk = words.slice(i, i + maxWordsPerCue);
      const chunkText = chunk.join(" ");
      const chunkStart = startSec + (i / words.length) * duration;
      const chunkEnd = startSec + (Math.min(i + maxWordsPerCue, words.length) / words.length) * duration;

      allCues.push({
        start: chunkStart,
        end: chunkEnd,
        text: chunkText,
      });
    }
  }

  return allCues
    .map((cue, idx) => {
      const start = formatSrtTimestamp(cue.start);
      const end = formatSrtTimestamp(cue.end);
      return `${idx + 1}\n${start} --> ${end}\n${cue.text}\n`;
    })
    .join("\n\n") + (allCues.length ? "\n" : "");
}

module.exports = { srtWordWrap };
