/**
 * In-memory store for merge jobs (merge job ID -> record).
 * Same pattern as jobStore; can be extended with MongoDB later if needed.
 */
const mem = new Map();

function createMergeJob(job) {
  const record = { ...job, createdAt: new Date(), updatedAt: new Date() };
  mem.set(job.mergeJobId, record);
  return record;
}

function updateMergeJob(mergeJobId, patch) {
  const existing = mem.get(mergeJobId);
  if (!existing) return null;
  const updated = { ...existing, ...patch, updatedAt: new Date() };
  mem.set(mergeJobId, updated);
  return updated;
}

function getMergeJob(mergeJobId) {
  return mem.get(mergeJobId) || null;
}

module.exports = {
  createMergeJob,
  updateMergeJob,
  getMergeJob,
};
