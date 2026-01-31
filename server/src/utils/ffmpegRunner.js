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

/**
 * Get clip info: duration (seconds) and hasAudio (boolean).
 */
async function getClipInfo(videoPath) {
  const durationArgs = [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    videoPath,
  ];
  const { stdout: durationOut } = await runCmd("ffprobe", durationArgs, { logPrefix: "ffprobe" });
  const duration = Number(String(durationOut).trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Could not get duration for ${videoPath}`);
  }

  const streamArgs = [
    "-v", "error",
    "-select_streams", "a",
    "-show_entries", "stream=codec_type",
    "-of", "csv=p=0",
    videoPath,
  ];
  let hasAudio = false;
  try {
    const { stdout: streamOut } = await runCmd("ffprobe", streamArgs, { logPrefix: "ffprobe" });
    hasAudio = String(streamOut).trim().length > 0;
  } catch (_) {
    // no audio stream
  }
  return { duration, hasAudio };
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

/** Normalize one clip to target size (scale + pad). Adds silent audio if no audio. */
async function normalizeClip(inputPath, outputPath, { width, height }) {
  const w = Number(width) || 1080;
  const h = Number(height) || 1920;
  const { duration, hasAudio } = await getClipInfo(inputPath);
  const vf = `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2`;
  const args = ["-y", "-i", inputPath];
  if (!hasAudio) {
    args.push("-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100", "-t", String(duration), "-map", "0:v", "-map", "1:a", "-shortest");
  }
  args.push("-vf", vf, "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-c:a", "aac", "-ar", "44100", "-movflags", "+faststart", outputPath);
  await runCmd("ffmpeg", args, { logPrefix: "ffmpeg" });
}

/**
 * Concat pre-normalized MP4 files (same codec) into one.
 * @param {string[]} normalizedPaths - Paths in order
 * @param {string} outputPath - Output file
 */
async function mergeWithConcat(normalizedPaths, outputPath) {
  const listPath = outputPath.replace(/\.[^.]+$/, "") + "-list.txt";
  const lines = normalizedPaths.map((p) => {
    const normalized = p.replace(/\\/g, "/");
    const escaped = normalized.replace(/'/g, "\\'");
    return `file '${escaped}'`;
  });
  const fs = require("fs");
  fs.writeFileSync(listPath, lines.join("\n"), "utf8");
  try {
    const args = ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", "-movflags", "+faststart", outputPath];
    await runCmd("ffmpeg", args, { logPrefix: "ffmpeg" });
  } finally {
    try {
      if (fs.existsSync(listPath)) fs.unlinkSync(listPath);
    } catch (_) {}
  }
}

module.exports = {
  getAudioDurationSeconds,
  extractAudioFromVideo,
  burnCaptionsIntoVideo,
  getClipInfo,
  normalizeClip,
  mergeWithConcat,
};

