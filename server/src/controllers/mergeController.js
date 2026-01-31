const fs = require("fs");
const path = require("path");

const { createMergeJob, updateMergeJob, getMergeJob } = require("../utils/mergeStore");
const { getClipInfo, normalizeClip, mergeWithConcat } = require("../utils/ffmpegRunner");

const ORIENTATIONS = {
  vertical: { width: 1080, height: 1920 },
  landscape: { width: 1920, height: 1080 },
};

function getMergeUploadsDir() {
  return path.join(__dirname, "..", "..", "merge-uploads");
}

function getOutputsDir() {
  return path.join(__dirname, "..", "..", "outputs");
}

function cleanupPaths(paths) {
  for (const p of paths) {
    try {
      if (p && fs.existsSync(p)) fs.unlinkSync(p);
    } catch (_) {}
  }
}

async function processMergeInBackground(mergeJobId, clipPaths, orientation) {
  const jobDir = path.join(getMergeUploadsDir(), mergeJobId);
  const outputsDir = getOutputsDir();
  fs.mkdirSync(outputsDir, { recursive: true });
  const outputPath = path.join(outputsDir, `merge-${mergeJobId}.mp4`);
  const { width, height } = ORIENTATIONS[orientation] || ORIENTATIONS.landscape;
  const normalizedPaths = [];

  try {
    for (let i = 0; i < clipPaths.length; i++) {
      const p = clipPaths[i];
      if (!p || !fs.existsSync(p)) {
        throw new Error(`Clip ${i + 1} is missing.`);
      }
      const outPath = path.join(jobDir, `normalized-${i}.mp4`);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      await normalizeClip(p, outPath, { width, height });
      normalizedPaths.push(outPath);
    }

    if (normalizedPaths.length === 0) {
      throw new Error("No clips to merge.");
    }

    await mergeWithConcat(normalizedPaths, outputPath);

    if (!fs.existsSync(outputPath)) {
      throw new Error("Merge output file was not created.");
    }

    await updateMergeJob(mergeJobId, { status: "completed", outputPath, error: null });
    cleanupPaths(normalizedPaths);
  } catch (err) {
    await updateMergeJob(mergeJobId, { status: "failed", error: err.message });
    cleanupPaths(normalizedPaths);
  }
}

async function processMerge(req, res) {
  const mergeJobId = req.mergeJobId;
  const clips = Array.isArray(req.files) ? req.files : [];
  const orientation = (req.body?.orientation || req.query?.orientation || "landscape").toString().toLowerCase().trim();
  if (!["vertical", "landscape"].includes(orientation)) {
    return res.status(400).json({ error: "Invalid orientation. Use: vertical | landscape" });
  }

  if (!clips.length) {
    return res.status(400).json({ error: "At least one video clip is required." });
  }

  const maxClips = Math.min(20, Math.max(1, Number(process.env.MAX_MERGE_CLIPS) || 20));
  if (clips.length > maxClips) {
    return res.status(400).json({ error: `Maximum ${maxClips} clips allowed.` });
  }

  const clipPaths = clips.map((f) => f.path);
  const jobDir = path.join(getMergeUploadsDir(), mergeJobId);
  fs.mkdirSync(jobDir, { recursive: true });

  const record = {
    mergeJobId,
    status: "processing",
    orientation,
    clipCount: clipPaths.length,
    outputPath: null,
    error: null,
  };
  createMergeJob(record);

  res.json({ mergeJobId, status: "processing" });

  processMergeInBackground(mergeJobId, clipPaths, orientation).catch(() => {});
}

async function getMergeStatus(req, res) {
  const job = await getMergeJob(req.params.mergeJobId);
  if (!job) return res.status(404).json({ error: "Merge job not found." });
  res.json({
    mergeJobId: job.mergeJobId,
    status: job.status,
    error: job.error || undefined,
    downloadUrl: job.status === "completed" && job.outputPath ? `/api/merge/${job.mergeJobId}/download` : undefined,
    previewUrl: job.status === "completed" && job.outputPath ? `/api/merge/${job.mergeJobId}/preview` : undefined,
  });
}

async function downloadMergeOutput(req, res) {
  const mergeJobId = req.params.mergeJobId;
  const job = await getMergeJob(mergeJobId);
  if (!job) return res.status(404).json({ error: "Merge job not found." });
  if (job.status !== "completed" || !job.outputPath) {
    return res.status(400).json({ error: "Merge is not completed yet." });
  }
  if (!fs.existsSync(job.outputPath)) {
    return res.status(404).json({ error: "Output file missing on disk." });
  }
  return res.download(job.outputPath, `merged-${mergeJobId}.mp4`);
}

/** Serve merged video for in-browser playback (Content-Disposition: inline). */
async function previewMergeOutput(req, res) {
  const mergeJobId = req.params.mergeJobId;
  const job = await getMergeJob(mergeJobId);
  if (!job) return res.status(404).json({ error: "Merge job not found." });
  if (job.status !== "completed" || !job.outputPath) {
    return res.status(400).json({ error: "Merge is not completed yet." });
  }
  if (!fs.existsSync(job.outputPath)) {
    return res.status(404).json({ error: "Output file missing on disk." });
  }
  res.setHeader("Content-Disposition", "inline");
  return res.sendFile(path.resolve(job.outputPath), { maxAge: "1h" });
}

module.exports = {
  processMerge,
  getMergeStatus,
  downloadMergeOutput,
  previewMergeOutput,
};
