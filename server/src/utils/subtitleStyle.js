function normalizeHexColor(hex) {
  const h = String(hex || "").trim();
  const m = h.match(/^#?([0-9a-fA-F]{6})$/);
  return m ? `#${m[1].toUpperCase()}` : null;
}

/**
 * ASS colors are &HAABBGGRR (alpha, blue, green, red)
 * We'll use AA=00 (opaque) and convert from #RRGGBB.
 */
function hexToAssColor(hex) {
  const norm = normalizeHexColor(hex) || "#FFFFFF";
  const rr = norm.slice(1, 3);
  const gg = norm.slice(3, 5);
  const bb = norm.slice(5, 7);
  return `&H00${bb}${gg}${rr}&`;
}

const STYLE_PRESETS = {
  default: {
    fontSize: 28,
    color: "#FFFFFF",
    outline: 2,
  },
  yellowBold: {
    fontSize: 32,
    color: "#FFD400",
    outline: 3,
  },
  tiktokWhite: {
    fontSize: 34,
    color: "#FFFFFF",
    outline: 4,
  },
};

function coerceNumber(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Builds a force_style string for FFmpeg libass subtitles filter.
 * Captions are centered (Alignment=5).
 */
function buildForceStyle({
  preset = "default",
  fontSize,
  color,
  outline,
  marginV,
} = {}) {
  const p = STYLE_PRESETS[preset] || STYLE_PRESETS.default;

  const fs = Math.max(10, Math.min(96, coerceNumber(fontSize, p.fontSize)));
  const out = Math.max(0, Math.min(10, coerceNumber(outline, p.outline)));
  const mv = Math.max(0, Math.min(200, coerceNumber(marginV, 0)));
  const primary = hexToAssColor(color || p.color);
  const outlineColor = hexToAssColor("#000000");

  return [
    "Fontname=Arial",
    `Fontsize=${fs}`,
    `PrimaryColour=${primary}`,
    `OutlineColour=${outlineColor}`,
    "BorderStyle=1",
    `Outline=${out}`,
    "Shadow=0",
    "Alignment=5",
    "MarginL=0",
    "MarginR=0",
    `MarginV=${mv}`,
  ].join(",");
}

/**
 * Builds the full ASS [V4+ Styles] "Style: Default,..." line for use in an ASS file.
 * Captions are centered (Alignment=5).
 */
function buildAssStyleLine({
  preset = "default",
  fontSize,
  color,
  outline,
  marginV,
} = {}) {
  const p = STYLE_PRESETS[preset] || STYLE_PRESETS.default;
  const fs = Math.max(10, Math.min(96, coerceNumber(fontSize, p.fontSize)));
  const out = Math.max(0, Math.min(10, coerceNumber(outline, p.outline)));
  const mv = Math.max(0, Math.min(200, coerceNumber(marginV, 0)));
  const primary = hexToAssColor(color || p.color);
  const outlineColor = hexToAssColor("#000000");
  const secondary = "&H000000FF&";
  const back = "&H64000000&";
  return [
    "Default",
    "Arial",
    String(fs),
    primary,
    secondary,
    outlineColor,
    back,
    "0",
    "0",
    "0",
    "0",
    "100",
    "100",
    "0",
    "0",
    "1",
    String(out),
    "0",
    "5",
    "0",
    "0",
    String(mv),
    "1",
  ].join(",");
}

module.exports = { buildForceStyle, buildAssStyleLine, STYLE_PRESETS };

