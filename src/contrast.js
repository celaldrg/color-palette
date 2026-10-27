/**
 * WCAG 2.x relative luminance, contrast ratio and AA/AAA verdicts.
 * @module contrast
 */
import { srgbToLinear, toRgb } from './color.js';

/** Minimum contrast ratios from WCAG 2.x (success criteria 1.4.3 and 1.4.6). */
export const WCAG_THRESHOLDS = Object.freeze({
  aaNormal: 4.5,
  aaLarge: 3,
  aaaNormal: 7,
  aaaLarge: 4.5,
});

/**
 * @typedef {object} WcagVerdict
 * @property {{ normal: boolean, large: boolean }} aa
 * @property {{ normal: boolean, large: boolean }} aaa
 */

/**
 * WCAG relative luminance of an sRGB color (0 for black, 1 for white).
 * @param {string|import('./color.js').Rgb} color hex string or RGB
 * @returns {number}
 */
export function relativeLuminance(color) {
  const { r, g, b } = toRgb(color);
  return (
    0.2126 * srgbToLinear(r / 255) + 0.7152 * srgbToLinear(g / 255) + 0.0722 * srgbToLinear(b / 255)
  );
}

/**
 * WCAG contrast ratio between two colors, from 1 (identical) to 21 (black on white).
 * The order of the arguments does not matter.
 * @param {string|import('./color.js').Rgb} foreground
 * @param {string|import('./color.js').Rgb} background
 * @returns {number}
 */
export function contrastRatio(foreground, background) {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

/**
 * AA/AAA verdicts for normal and large text. WCAG compares the unrounded ratio.
 * @param {number} ratio
 * @returns {WcagVerdict}
 */
export function wcagVerdict(ratio) {
  return {
    aa: { normal: ratio >= WCAG_THRESHOLDS.aaNormal, large: ratio >= WCAG_THRESHOLDS.aaLarge },
    aaa: { normal: ratio >= WCAG_THRESHOLDS.aaaNormal, large: ratio >= WCAG_THRESHOLDS.aaaLarge },
  };
}

/**
 * Contrast ratio plus verdicts for a text/background pair.
 * @param {string|import('./color.js').Rgb} foreground
 * @param {string|import('./color.js').Rgb} background
 * @returns {{ ratio: number } & WcagVerdict}
 */
export function checkContrast(foreground, background) {
  const ratio = contrastRatio(foreground, background);
  return { ratio, ...wcagVerdict(ratio) };
}

/**
 * Formats a ratio for display, truncated (not rounded) to two decimals so a
 * failing 4.499 never shows as a passing 4.5: 4.4776 -> '4.47:1', 21 -> '21:1'.
 * @param {number} ratio
 * @returns {string}
 */
export function formatRatio(ratio) {
  const truncated = Math.floor(ratio * 100 + 1e-9) / 100;
  return `${Number(truncated.toFixed(2))}:1`;
}

/**
 * Finds the two colors of a palette with the highest contrast and returns the
 * lighter one as the text color. Ties go to the earlier pair.
 * @param {Array<string|import('./color.js').Rgb>} colors at least two colors
 * @returns {{ foreground: number, background: number }} indexes into `colors`
 */
export function bestContrastPair(colors) {
  let best = { foreground: 0, background: 1, ratio: 0 };
  colors.forEach((first, i) => {
    colors.slice(i + 1).forEach((second, offset) => {
      const ratio = contrastRatio(first, second);
      if (ratio > best.ratio) best = { foreground: i, background: i + 1 + offset, ratio };
    });
  });
  const swap = relativeLuminance(colors[best.foreground]) < relativeLuminance(colors[best.background]);
  return swap
    ? { foreground: best.background, background: best.foreground }
    : { foreground: best.foreground, background: best.background };
}

/**
 * Picks the candidate text color with the highest contrast on a background.
 * @param {string|import('./color.js').Rgb} background
 * @param {string[]} [candidates=['#ffffff', '#000000']] hex colors; the first wins ties
 * @returns {string}
 */
export function pickTextColor(background, candidates = ['#ffffff', '#000000']) {
  let best = candidates[0];
  let bestRatio = -1;
  for (const candidate of candidates) {
    const ratio = contrastRatio(candidate, background);
    if (ratio > bestRatio) {
      best = candidate;
      bestRatio = ratio;
    }
  }
  return best;
}
