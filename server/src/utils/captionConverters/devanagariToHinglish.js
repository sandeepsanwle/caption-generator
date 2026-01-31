const sanskritTransliterate = require("devanagari-transliterate");

/**
 * Simplify ISO/IAST diacritics to casual Hinglish (e.g. "kya" not "kyā").
 * Applied in order so longer sequences are replaced first.
 */
const DIACRITIC_REPLACEMENTS = [
  ["r̥", "ri"], ["l̥", "li"], ["m̐", "n"],
  ["ā", "a"], ["ī", "i"], ["ū", "u"], ["ē", "e"], ["ō", "o"],
  ["ṁ", "n"], ["ṃ", "n"], ["ḥ", "h"], ["ṅ", "n"], ["ñ", "n"], ["ṇ", "n"],
  ["ṭ", "t"], ["ḍ", "d"], ["ṣ", "sh"], ["ś", "sh"], ["ṛ", "ri"], ["ḷ", "l"],
  ["ʾ", ""],
];

/**
 * Convert Devanagari text to Hinglish (Roman script).
 * Uses ISO-15919 transliteration then simplifies diacritics for casual Hinglish style.
 *
 * @param {string} devanagariText - Text in Devanagari (Hindi script)
 * @returns {string} - Text in Hinglish (Roman script)
 */
function devanagariToHinglish(devanagariText) {
  if (!devanagariText || typeof devanagariText !== "string") return devanagariText;

  // Skip if text has no Devanagari (e.g. already English)
  const devanagariRange = /[\u0900-\u097F]/;
  if (!devanagariRange.test(devanagariText)) return devanagariText;

  let roman = sanskritTransliterate("ISO", "devanagari2latin", devanagariText);
  if (!roman) return devanagariText;

  for (const [from, to] of DIACRITIC_REPLACEMENTS) {
    roman = roman.split(from).join(to);
  }
  return roman;
}

/**
 * Convert all Devanagari text in SRT content to Hinglish.
 *
 * @param {string} srtContent - Raw SRT file content
 * @returns {string} - SRT with caption text converted to Hinglish
 */
function srtDevanagariToHinglish(srtContent) {
  if (!srtContent) return srtContent;

  const blocks = srtContent.trim().split(/\n\s*\n/);
  const result = [];

  for (const block of blocks) {
    const lines = block.split(/\r?\n/);
    if (lines.length < 3) {
      result.push(block);
      continue;
    }

    const index = lines[0];
    const timestamp = lines[1];
    const textLines = lines.slice(2);
    const originalText = textLines.join("\n");
    const hinglishText = devanagariToHinglish(originalText);

    result.push(`${index}\n${timestamp}\n${hinglishText}`);
  }

  return result.join("\n\n") + (result.length ? "\n" : "");
}

module.exports = { devanagariToHinglish, srtDevanagariToHinglish };
