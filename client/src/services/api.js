export async function processVideo(formData) {
  const res = await fetch("/api/process", {
    method: "POST",
    body: formData,
  });

  const contentType = res.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await res.json()
    : { error: await res.text() };

  if (!res.ok) {
    const msg = payload?.error || "Processing failed";
    throw new Error(msg);
  }

  return payload;
}

export async function getJobStatus(jobId) {
  const res = await fetch(`/api/jobs/${jobId}`);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error("Failed to fetch job status");
  }
  return res.json();
}

export async function mergeVideos(formData) {
  const res = await fetch("/api/merge", {
    method: "POST",
    body: formData,
  });
  const contentType = res.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await res.json()
    : { error: await res.text() };
  if (!res.ok) {
    const msg = payload?.error || "Merge failed";
    throw new Error(msg);
  }
  return payload;
}

export async function getMergeStatus(mergeJobId) {
  const res = await fetch(`/api/merge/${mergeJobId}`);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error("Failed to fetch merge status");
  }
  return res.json();
}

