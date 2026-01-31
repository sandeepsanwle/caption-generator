const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");

const { processMerge, getMergeStatus, downloadMergeOutput, previewMergeOutput } = require("../controllers/mergeController");

const router = express.Router();

function getMergeUploadsDir() {
  return path.join(__dirname, "..", "..", "merge-uploads");
}

function assignMergeJobId(req, _res, next) {
  req.mergeJobId = uuidv4();
  next();
}

function sanitizeFilename(name) {
  return String(name || "file")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(0, 200);
}

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const dir = path.join(getMergeUploadsDir(), req.mergeJobId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    cb(null, `clip-${Date.now()}-${sanitizeFilename(file.originalname)}`);
  },
});

const maxMb = Number(process.env.MAX_UPLOAD_MB || 500);
const upload = multer({
  storage,
  limits: { fileSize: Math.max(1, maxMb) * 1024 * 1024 },
});

router.post(
  "/merge",
  assignMergeJobId,
  upload.array("clips", 20),
  processMerge
);

router.get("/merge/:mergeJobId", getMergeStatus);
router.get("/merge/:mergeJobId/download", downloadMergeOutput);
router.get("/merge/:mergeJobId/preview", previewMergeOutput);

module.exports = router;
