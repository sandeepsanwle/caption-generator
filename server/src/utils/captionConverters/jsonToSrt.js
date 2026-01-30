const { buildSrt } = require("./srtUtils");

function jsonToSrt(jsonString) {
  let data;
  try {
    data = JSON.parse(String(jsonString));
  } catch {
    throw new Error("Invalid JSON captions file.");
  }

  if (!Array.isArray(data)) {
    throw new Error("JSON captions must be an array of cues.");
  }

  const cues = data
    .map((cue, idx) => {
      const start = Number(cue?.start);
      const end = Number(cue?.end);
      const text = String(cue?.text ?? "").trim();

      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
        throw new Error(`Invalid cue timing at index ${idx}.`);
      }
      if (!text) {
        throw new Error(`Empty cue text at index ${idx}.`);
      }
      return { start, end, text };
    })
    .sort((a, b) => a.start - b.start);

  return buildSrt(cues);
}

module.exports = { jsonToSrt };

