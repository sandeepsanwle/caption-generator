const PRESETS = [
  { id: "default", label: "Default (White)" },
  { id: "yellowBold", label: "Bold Yellow" },
  { id: "tiktokWhite", label: "Reels/TikTok White" },
];

export default function StyleOptions({
  preset,
  setPreset,
  fontSize,
  setFontSize,
  color,
  setColor,
  outline,
  setOutline,
}) {
  return (
    <div className="styleGrid">
      <label className="styleGrid__item">
        <div className="miniLabel">Preset</div>
        <select value={preset} onChange={(e) => setPreset(e.target.value)}>
          {PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      <label className="styleGrid__item">
        <div className="miniLabel">Font size</div>
        <input
          type="number"
          min="10"
          max="96"
          value={fontSize}
          onChange={(e) => setFontSize(e.target.value)}
        />
      </label>

      <label className="styleGrid__item">
        <div className="miniLabel">Color</div>
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
        />
      </label>

      <label className="styleGrid__item">
        <div className="miniLabel">Outline</div>
        <input
          type="number"
          min="0"
          max="10"
          value={outline}
          onChange={(e) => setOutline(e.target.value)}
        />
      </label>
    </div>
  );
}

