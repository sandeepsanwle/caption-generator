const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");

const { processJob, getJobStatus, downloadJobOutput } = require("../controllers/jobsController");

const router = express.Router();

function getUploadsDir() {
  return path.join(__dirname, "..", "..", "uploads");
}

function sanitizeFilename(name) {
  return String(name || "file")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(0, 200);
}

function assignJobId(req, _res, next) {
  req.jobId = uuidv4();
  next();
}

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const base = getUploadsDir();
    const jobDir = path.join(base, req.jobId);
    fs.mkdirSync(jobDir, { recursive: true });
    cb(null, jobDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${file.fieldname}-${Date.now()}-${sanitizeFilename(file.originalname)}`);
  },
});

const maxMb = Number(process.env.MAX_UPLOAD_MB || 500);
const upload = multer({
  storage,
  limits: { fileSize: Math.max(1, maxMb) * 1024 * 1024 },
});

router.post(
  "/process",
  assignJobId,
  upload.fields([
    { name: "video", maxCount: 1 },
    { name: "captionsFile", maxCount: 1 },
  ]),
  processJob
);

router.get("/jobs/:jobId", getJobStatus);
router.get("/jobs/:jobId/download", downloadJobOutput);

module.exports = router;

