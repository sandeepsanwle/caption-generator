const fs = require("fs");
const path = require("path");

const { createJob, updateJob, getJob } = require("../utils/jobStore");
const {
  extractAudioFromVideo,
  burnCaptionsIntoVideo,
} = require("../utils/ffmpegRunner");
const { transcribeViaService } = require("../utils/transcriptionServiceClient");
const { buildForceStyle } = require("../utils/subtitleStyle");

const { vttToSrt } = require("../utils/captionConverters/vttToSrt");
const { jsonToSrt } = require("../utils/captionConverters/jsonToSrt");
const { srtWordWrap } = require("../utils/captionConverters/srtWordWrap");

function assertFileExists(p, label) {
  if (!p || !fs.existsSync(p)) {
    throw new Error(`${label} is missing.`);
  }
}

function getUploadsDir() {
  return path.join(__dirname, "..", "..", "uploads");
}

function getOutputsDir() {
  return path.join(__dirname, "..", "..", "outputs");
}

function cleanupTempFiles(paths) {
  for (const p of paths) {
    try {
      if (p && fs.existsSync(p)) fs.unlinkSync(p);
    } catch (_) {}
  }
}

async function processJobInBackground(jobId, jobData) {
  const {
    captionSource,
    videoPath,
    captionsPath,
    language,
    whisperModel,
    wordsPerLine,
    correctedCaptions,
    preset,
    fontSize,
    color,
    outline,
    marginV,
  } = jobData;
  const uploadsDir = getUploadsDir();
  const outputsDir = getOutputsDir();
  const jobUploadDir = path.join(uploadsDir, jobId);
  const extractedAudioPath = path.join(jobUploadDir, "extract.wav");
  const generatedSrtPath = path.join(jobUploadDir, "captions.srt");
  const outputVideoPath = path.join(outputsDir, `${jobId}.mp4`);
  const forceStyle = buildForceStyle({ preset, fontSize, color, outline, marginV });

  try {
    assertFileExists(videoPath, "Video file");

    if (captionSource === "auto") {
      await extractAudioFromVideo(videoPath, extractedAudioPath);
      assertFileExists(extractedAudioPath, "Extracted audio");
      const wordsPerCue = Math.max(0, Math.min(10, Number(wordsPerLine) || 4));
      const { srt } = await transcribeViaService(extractedAudioPath, {
        model: whisperModel,
        language,
        wordsPerCue: wordsPerCue > 0 ? wordsPerCue : 4,
        correctedText: correctedCaptions || undefined,
      });
      fs.writeFileSync(generatedSrtPath, srt, "utf8");
    } else if (captionSource === "srt") {
      if (!captionsPath) throw new Error("SRT file is required.");
      const raw = fs.readFileSync(captionsPath, "utf8");
      fs.writeFileSync(generatedSrtPath, raw.replace(/\r\n/g, "\n"), "utf8");
    } else if (captionSource === "vtt") {
      if (!captionsPath) throw new Error("VTT file is required.");
      const raw = fs.readFileSync(captionsPath, "utf8");
      const srt = vttToSrt(raw);
      fs.writeFileSync(generatedSrtPath, srt, "utf8");
    } else if (captionSource === "json") {
      if (!captionsPath) throw new Error("JSON file is required.");
      const raw = fs.readFileSync(captionsPath, "utf8");
      const srt = jsonToSrt(raw);
      fs.writeFileSync(generatedSrtPath, srt, "utf8");
    }

    assertFileExists(generatedSrtPath, "Captions SRT");

    if (captionSource !== "auto") {
      const wpl = Math.max(0, Math.min(10, Number(wordsPerLine) || 4));
      if (wpl > 0) {
        const raw = fs.readFileSync(generatedSrtPath, "utf8");
        fs.writeFileSync(generatedSrtPath, srtWordWrap(raw, wpl), "utf8");
      }
    }

    await burnCaptionsIntoVideo({
      videoPath,
      srtPath: generatedSrtPath,
      outputPath: outputVideoPath,
      forceStyle,
    });

    assertFileExists(outputVideoPath, "Output video");
    await updateJob(jobId, { status: "completed", outputVideoPath, error: null });
    cleanupTempFiles([extractedAudioPath]);
  } catch (err) {
    await updateJob(jobId, { status: "failed", error: err.message });
  }
}

async function processJob(req, res) {
  const jobId = req.jobId;
  const captionSource = String(req.body.captionSource || "").toLowerCase();
  const language = String(req.body.language || "auto").toLowerCase().trim() || "auto";
  const whisperModel = String(req.body.whisperModel || "small").toLowerCase();

  const videoFile = req.files?.video?.[0];
  const captionsFile = req.files?.captionsFile?.[0];

  if (!jobId) return res.status(400).json({ error: "Missing job id." });
  if (!videoFile) return res.status(400).json({ error: "Video file is required." });
  if (!["auto", "srt", "vtt", "json"].includes(captionSource)) {
    return res.status(400).json({
      error: "Invalid captionSource. Use: auto | srt | vtt | json",
    });
  }

  const uploadsDir = getUploadsDir();
  const outputsDir = getOutputsDir();
  fs.mkdirSync(outputsDir, { recursive: true });

  const jobUploadDir = path.join(uploadsDir, jobId);
  fs.mkdirSync(jobUploadDir, { recursive: true });

  const extractedAudioPath = path.join(jobUploadDir, "extract.wav");
  const generatedSrtPath = path.join(jobUploadDir, "captions.srt");
  const outputVideoPath = path.join(outputsDir, `${jobId}.mp4`);

  const preset = req.body.preset || "default";
  const fontSize = req.body.fontSize;
  const color = req.body.color;
  const outline = req.body.outline;
  const marginV = req.body.marginV;
  const forceStyle = buildForceStyle({ preset, fontSize, color, outline, marginV });

  const jobRecord = {
    jobId,
    status: "processing",
    captionSource,
    inputVideoPath: videoFile.path,
    inputCaptionsPath: captionsFile?.path,
    generatedSrtPath,
    outputVideoPath: null,
    error: null,
  };

  await createJob(jobRecord);

  const jobData = {
    captionSource,
    videoPath: videoFile.path,
    captionsPath: captionsFile?.path,
    language,
    whisperModel,
    wordsPerLine: req.body.wordsPerLine,
    correctedCaptions: req.body.correctedCaptions ? String(req.body.correctedCaptions).trim() : undefined,
    preset,
    fontSize,
    color,
    outline,
    marginV,
  };

  res.json({ jobId, status: "processing" });

  processJobInBackground(jobId, jobData).catch(() => {});
}

async function getJobStatus(req, res) {
  const job = await getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  return res.json(job);
}

async function downloadJobOutput(req, res) {
  const jobId = req.params.jobId;
  const job = await getJob(jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  if (job.status !== "completed" || !job.outputVideoPath) {
    return res.status(400).json({ error: "Job is not completed yet." });
  }
  if (!fs.existsSync(job.outputVideoPath)) {
    return res.status(404).json({ error: "Output file missing on disk." });
  }
  return res.download(job.outputVideoPath, `captioned-${jobId}.mp4`);
}

module.exports = { processJob, getJobStatus, downloadJobOutput };
