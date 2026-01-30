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

