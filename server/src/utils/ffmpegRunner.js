const { spawn } = require("child_process");

function runCmd(bin, args, { logPrefix } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));

    child.on("error", (err) => {
      reject(
        new Error(
          `${logPrefix || bin} failed to start. Is it installed? (${err.message})`
        )
      );
    });

    child.on("close", (code) => {
      if (code === 0) return resolve({ stdout, stderr });
      reject(
        new Error(
          `${logPrefix || bin} exited with code ${code}\n\n${stderr || stdout}`
        )
      );
    });
  });
}

async function getAudioDurationSeconds(audioPath) {
  const args = [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    audioPath,
  ];

  const { stdout } = await runCmd("ffprobe", args, { logPrefix: "ffprobe" });
  const duration = Number(String(stdout).trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("Could not determine audio duration via ffprobe.");
  }
  return duration;
}

function escapeForFfmpegFilterValue(value) {
  // We wrap in single quotes in the filter, so escape single quotes and backslashes.
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function escapeForSubtitlesFilename(filePath) {
  // subtitles filter parses ':' as option delimiter; escape it.
  // Also escape backslashes and single quotes.
  return String(filePath)
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'");
}

/**
 * Extract audio from video as WAV (for Whisper).
 * ffmpeg -i video.mp4 -vn -acodec pcm_s16le -ar 16000 audio.wav
 */
async function extractAudioFromVideo(videoPath, audioPath) {
  const args = [
    "-y",
    "-i",
    videoPath,
    "-vn",
    "-acodec",
    "pcm_s16le",
    "-ar",
    "16000",
    "-ac",
    "1",
    audioPath,
  ];
  await runCmd("ffmpeg", args, { logPrefix: "ffmpeg" });
}

/**
 * Burn subtitles into the ORIGINAL video. Video and audio streams are preserved;
 * only the video stream gets the subtitle filter (no audio replacement).
 */
async function burnCaptionsIntoVideo({ videoPath, srtPath, outputPath, forceStyle }) {
  const escapedSrt = escapeForSubtitlesFilename(srtPath);
  const escapedStyle = escapeForFfmpegFilterValue(forceStyle);
  const vf = `subtitles='${escapedSrt}':force_style='${escapedStyle}'`;

  const args = [
    "-y",
    "-i",
    videoPath,
    "-vf",
    vf,
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "18",
    "-c:a",
    "copy",
    "-movflags",
    "+faststart",
    outputPath,
  ];

  await runCmd("ffmpeg", args, { logPrefix: "ffmpeg" });
}

module.exports = {
  getAudioDurationSeconds,
  extractAudioFromVideo,
  burnCaptionsIntoVideo,
};

