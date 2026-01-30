import { useMemo, useState } from "react";
import Field from "../components/Field.jsx";
import StyleOptions from "../components/StyleOptions.jsx";
import { processVideo } from "../services/api.js";

const CAPTION_SOURCES = [
  { id: "auto", label: "Auto-generate (Whisper)" },
  { id: "srt", label: "Upload SRT" },
  { id: "vtt", label: "Upload VTT" },
  { id: "json", label: "Upload JSON" },
];

const LANGUAGES = [
  { id: "auto", label: "Auto-detect" },
  { id: "en", label: "English" },
  { id: "hi", label: "Hindi" },
];

function captionsAcceptFor(source) {
  if (source === "srt") return ".srt";
  if (source === "vtt") return ".vtt";
  if (source === "json") return ".json,application/json";
  return undefined;
}

export default function HomePage() {
  const [videoFile, setVideoFile] = useState(null);
  const [captionSource, setCaptionSource] = useState("auto");
  const [captionsFile, setCaptionsFile] = useState(null);
  const [language, setLanguage] = useState("auto");
  const [whisperModel, setWhisperModel] = useState("small");

  const [preset, setPreset] = useState("default");
  const [fontSize, setFontSize] = useState("28");
  const [color, setColor] = useState("#ffffff");
  const [outline, setOutline] = useState("2");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const accept = useMemo(() => captionsAcceptFor(captionSource), [captionSource]);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setResult(null);

    if (!videoFile) return setError("Please choose a video (.mp4).");

    if (captionSource !== "auto" && !captionsFile) {
      return setError("Please choose a captions file.");
    }

    const fd = new FormData();
    fd.append("video", videoFile);
    fd.append("captionSource", captionSource);
    fd.append("language", language);
    fd.append("whisperModel", whisperModel);
    fd.append("preset", preset);
    fd.append("fontSize", String(fontSize));
    fd.append("color", String(color));
    fd.append("outline", String(outline));

    if (captionSource !== "auto") {
      fd.append("captionsFile", captionsFile);
    }

    try {
      setLoading(true);
      const out = await processVideo(fd);
      setResult(out);
    } catch (err) {
      setError(err.message || "Failed to generate video.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="card">
        <div className="title">Offline Caption Generator (Whisper + FFmpeg)</div>
        <div className="subtitle">
          Upload one video. Captions are synced to the video&apos;s own audio—auto-generated with Whisper or from SRT/VTT/JSON.
        </div>

        <form onSubmit={onSubmit} className="form">
          <Field label="Video (MP4 with audio)" hint="Single file; captions will be synced to this video's audio.">
            <input
              type="file"
              accept="video/mp4,.mp4"
              onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
            />
          </Field>

          <Field label="Caption source" hint="Auto = Whisper transcribes the video audio. Or upload SRT/VTT/JSON.">
            <div className="radioRow">
              {CAPTION_SOURCES.map((t) => (
                <label key={t.id} className="radioRow__item">
                  <input
                    type="radio"
                    name="captionSource"
                    value={t.id}
                    checked={captionSource === t.id}
                    onChange={() => {
                      setCaptionSource(t.id);
                      setCaptionsFile(null);
                    }}
                  />
                  <span>{t.label}</span>
                </label>
              ))}
            </div>
          </Field>

          {captionSource === "auto" ? (
            <>
              <Field label="Language" hint="For Whisper: auto-detect, English, or Hindi (and others).">
                <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                  {LANGUAGES.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Whisper model" hint="small = fast & good; medium/large = slower, more accurate.">
                <select value={whisperModel} onChange={(e) => setWhisperModel(e.target.value)}>
                  <option value="tiny">Tiny</option>
                  <option value="base">Base</option>
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </Field>
            </>
          ) : (
            <Field label="Captions file" hint="We convert VTT/JSON to SRT automatically.">
              <input
                type="file"
                accept={accept}
                onChange={(e) => setCaptionsFile(e.target.files?.[0] || null)}
              />
            </Field>
          )}

          <Field label="Subtitle styling" hint="Font size, color, outline; bottom-center alignment.">
            <StyleOptions
              preset={preset}
              setPreset={setPreset}
              fontSize={fontSize}
              setFontSize={setFontSize}
              color={color}
              setColor={setColor}
              outline={outline}
              setOutline={setOutline}
            />
          </Field>

          {error ? <div className="alert alert--error">{error}</div> : null}
          {result?.downloadUrl ? (
            <div className="alert alert--success">
              Done.{" "}
              <a className="link" href={result.downloadUrl} download>
                Download final video
              </a>
            </div>
          ) : null}

          <button className="btn" type="submit" disabled={loading}>
            {loading ? "Generating..." : "Generate Video"}
          </button>

          {loading ? (
            <div className="loading">
              {captionSource === "auto"
                ? "Extracting audio, running Whisper, then burning captions. This may take a few minutes."
                : "Burning captions into video."}
            </div>
          ) : null}
        </form>

        <div className="footerNote">
          Requires local <code>ffmpeg</code> and <code>whisper</code> (pip install openai-whisper). Works fully offline. No paid APIs.
        </div>
      </div>
    </div>
  );
}
