import { useCallback, useEffect, useRef, useState } from "react";
import { mergeVideos, getMergeStatus } from "../services/api.js";

const ORIENTATIONS = [
  { id: "vertical", label: "Vertical (Shorts)", hint: "9:16 — 1080×1920" },
  { id: "landscape", label: "Landscape (long)", hint: "16:9 — 1920×1080" },
];

export default function MergePage() {
  const [orientation, setOrientation] = useState("vertical");
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [logs, setLogs] = useState([]);
  const [showLogModal, setShowLogModal] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const pollRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  function onFileSelect(e) {
    const chosen = Array.from(e.target.files || []);
    if (!chosen.length) return;
    setFiles((prev) => [...prev, ...chosen]);
    e.target.value = "";
  }

  function removeFile(index) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function moveFile(from, to) {
    if (from === to || to < 0 || to >= files.length) return;
    setFiles((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  function handleDragStart(e, index) {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  }

  function handleDragOver(e, index) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function handleDrop(e, dropIndex) {
    e.preventDefault();
    const from = draggedIndex;
    if (from == null) return;
    setDraggedIndex(null);
    moveFile(from, dropIndex);
  }

  function handleDragEnd() {
    setDraggedIndex(null);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setResult(null);
    setLogs([]);
    setShowLogModal(true);

    if (files.length < 2) {
      setShowLogModal(false);
      return setError("Upload at least 2 video clips to merge.");
    }

    const formData = new FormData();
    formData.append("orientation", orientation);
    files.forEach((file) => formData.append("clips", file));

    try {
      setLoading(true);
      const out = await mergeVideos(formData);
      const mergeJobId = out?.mergeJobId;
      if (!mergeJobId) throw new Error("No merge job ID returned");

      setLogs([{ ts: new Date().toISOString(), message: "Merging your clips. This may take a few minutes." }]);

      const poll = async () => {
        const job = await getMergeStatus(mergeJobId);
        if (!job) return;
        if (job.status === "completed") {
          stopPolling();
          setLogs((prev) =>
            prev.some((m) => m.message.includes("Done"))
              ? prev
              : [...prev, { ts: new Date().toISOString(), message: "Done! Your merged video is ready." }]
          );
          setLoading(false);
          setResult({
            mergeJobId,
            downloadUrl: `/api/merge/${mergeJobId}/download`,
            previewUrl: `/api/merge/${mergeJobId}/preview`,
          });
        } else if (job.status === "failed") {
          stopPolling();
          setLogs((prev) => [...prev, { ts: new Date().toISOString(), message: `Error: ${job.error || "Merge failed"}` }]);
          setLoading(false);
          setError(job.error || "Merge failed");
        }
      };

      await poll();
      pollRef.current = setInterval(poll, 1500);
    } catch (err) {
      setLoading(false);
      setShowLogModal(false);
      setError(err.message || "Failed to merge videos.");
    }
  }

  return (
    <div className="page">
      <div className="card">
        <div className="title">Merge Videos</div>
        <div className="subtitle">
          Upload multiple clips, reorder with drag-and-drop, then merge into one video. Choose output orientation (vertical for Shorts or landscape for long videos).
        </div>

        <form onSubmit={onSubmit} className="form">
          <div className="field">
            <div className="field__label">Output orientation</div>
            <div className="field__hint">Vertical = Shorts (9:16). Landscape = long (16:9). Clips are scaled and padded to fit.</div>
            <div className="radioRow" style={{ marginTop: 8 }}>
              {ORIENTATIONS.map((o) => (
                <label key={o.id} className="radioRow__item mergeOrientationItem">
                  <input
                    type="radio"
                    name="orientation"
                    value={o.id}
                    checked={orientation === o.id}
                    onChange={() => setOrientation(o.id)}
                  />
                  <span className="mergeOrientationItem__label">{o.label}</span>
                  <span className="field__hint mergeOrientationItem__hint">{o.hint}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="field">
            <div className="field__label">Video clips (order = merge order)</div>
            <div className="field__hint">Number shows order in merged video. Add files, then drag rows to reorder.</div>
            <input
              type="file"
              accept="video/mp4,.mp4,video/*"
              multiple
              onChange={onFileSelect}
              className="mergeFileInput"
            />
            {files.length > 0 ? (
              <ul className="mergeList">
                {files.map((file, index) => (
                  <li
                    key={`${file.name}-${index}`}
                    className={`mergeList__item ${draggedIndex === index ? "mergeList__item--dragging" : ""}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                  >
                    <span className="mergeList__num" title={`Position ${index + 1} in merged video`}>
                      {index + 1}
                    </span>
                    <span className="mergeList__handle" aria-hidden="true">⋮⋮</span>
                    <span className="mergeList__name">{file.name}</span>
                    <button
                      type="button"
                      className="mergeList__remove"
                      onClick={() => removeFile(index)}
                      aria-label={`Remove ${file.name}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {error ? <div className="alert alert--error">{error}</div> : null}
          {result?.downloadUrl ? (
            <div className="mergeResult">
              <div className="alert alert--success mergeResult__alert">
                Done.{" "}
                <a className="link" href={result.previewUrl || result.downloadUrl} target="_blank" rel="noopener noreferrer">
                  Preview merged video
                </a>
                {" · "}
                <a className="link" href={result.downloadUrl} download>
                  Download merged video
                </a>
              </div>
              <div className="mergePreview">
                <div className="mergePreview__label">Preview</div>
                <video
                  className="mergePreview__video"
                  src={result.previewUrl || result.downloadUrl}
                  controls
                  preload="metadata"
                  playsInline
                >
                  Your browser does not support the video tag.
                </video>
              </div>
            </div>
          ) : null}

          <button className="btn" type="submit" disabled={loading || files.length < 2}>
            {loading ? "Merging…" : "Merge videos"}
          </button>

          {loading ? (
            <div className="loading">Merging clips… Check the status popup for progress.</div>
          ) : null}
        </form>

        {showLogModal && (
          <div className="logModal" role="dialog" aria-label="Status">
            <div className="logModal__box">
              <div className="logModal__header">
                <h3 className="logModal__title">Status</h3>
                <button type="button" className="logModal__close" onClick={() => setShowLogModal(false)} aria-label="Close">
                  ×
                </button>
              </div>
              <div className="logModal__body">
                {logs.length === 0 ? (
                  <div className="logModal__empty">Merging…</div>
                ) : (
                  <ul className="logModal__list">
                    {logs.map((entry, i) => (
                      <li key={i} className="logModal__item">
                        <span className="logModal__ts">{entry.ts ? new Date(entry.ts).toLocaleTimeString() : ""}</span>
                        <span className="logModal__msg">{entry.message}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="footerNote">
          Clips are normalized to the chosen size (scale + pad), then concatenated. Requires <code>ffmpeg</code>.
        </div>
      </div>
    </div>
  );
}
