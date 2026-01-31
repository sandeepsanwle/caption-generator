/**
 * Client for the Python transcription service.
 * Node manages uploads and calls this service; Python runs Whisper and returns 3-4 word SRT.
 */
const fs = require("fs");
const path = require("path");

function getServiceUrl() {
  return process.env.TRANSCRIPTION_SERVICE_URL || "http://127.0.0.1:8000";
}

/**
 * Call Python transcription service with audio file.
 * @param {string} audioPath - Path to WAV/MP3 file
 * @param {object} options - { model, language, wordsPerCue }
 * @returns {Promise<string>} - SRT content
 */
async function transcribeViaService(audioPath, options = {}) {
  const url = `${getServiceUrl()}/transcribe`;
  const model = String(options.model || "small").toLowerCase();
  const language = String(options.language || "auto").trim() || "auto";
  const wordsPerCue = Math.max(0, Math.min(10, Number(options.wordsPerCue) || 4));

  const formData = new FormData();
  const fileBuffer = fs.readFileSync(audioPath);
  const basename = path.basename(audioPath);
  const blob = new Blob([fileBuffer], { type: "audio/wav" });
  formData.append("audio", blob, basename);
  formData.append("model", model);
  formData.append("language", language);
  formData.append("words_per_cue", String(wordsPerCue));

  const res = await fetch(url, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    let message = text || res.statusText;
    try {
      const body = JSON.parse(text);
      if (body.detail) message = body.detail;
    } catch (_) {}
    throw new Error(message);
  }

  const data = await res.json();
  if (!data || typeof data.srt !== "string") {
    throw new Error("Transcription service returned invalid response");
  }

  return { srt: data.srt };
}

/**
 * Check if the transcription service is reachable.
 */
async function checkServiceHealth() {
  try {
    const url = `${getServiceUrl()}/health`;
    const res = await fetch(url, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}

module.exports = {
  transcribeViaService,
  checkServiceHealth,
  getServiceUrl,
};
