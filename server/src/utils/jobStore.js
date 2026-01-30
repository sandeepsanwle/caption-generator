const Job = require("../models/Job");

/**
 * Optional MongoDB-backed job store.
 * If MONGO_URI is not set (or connection fails), we fall back to an in-memory Map.
 */

let useDb = false;
const mem = new Map(); // jobId -> job

function initJobStore({ dbReady }) {
  useDb = Boolean(dbReady);
}

async function createJob(job) {
  if (useDb) {
    await Job.create(job);
    return job;
  }
  mem.set(job.jobId, { ...job, createdAt: new Date(), updatedAt: new Date() });
  return mem.get(job.jobId);
}

async function updateJob(jobId, patch) {
  if (useDb) {
    await Job.updateOne({ jobId }, { $set: patch }).exec();
    return getJob(jobId);
  }
  const existing = mem.get(jobId);
  if (!existing) return null;
  const updated = { ...existing, ...patch, updatedAt: new Date() };
  mem.set(jobId, updated);
  return updated;
}

async function getJob(jobId) {
  if (useDb) {
    return Job.findOne({ jobId }).lean().exec();
  }
  return mem.get(jobId) || null;
}

module.exports = {
  initJobStore,
  createJob,
  updateJob,
  getJob,
};

