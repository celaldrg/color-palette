/**
 * Shade scale (50-950) around a color, perceptually spaced in OKLCH lightness.
 * @module shades
 */
import { hexToRgb, normalizeHex, oklchToHex, rgbToOklch } from './color.js';

/** Step names from lightest to darkest. */
export const SHADE_STEPS = Object.freeze([50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]);

/** Reference OKLCH lightness per step, in even perceptual steps. */
const REFERENCE_LIGHTNESS = [0.97, 0.93, 0.87, 0.79, 0.7, 0.62, 0.54, 0.46, 0.39, 0.32, 0.24];
/** Chroma per step relative to the strongest step: muted at both ends. */
const RELATIVE_CHROMA = [0.08, 0.2, 0.38, 0.62, 0.86, 1, 1, 0.92, 0.8, 0.66, 0.5];
/** The scale never reaches pure white or black unless the base color does. */
const LIGHTEST = 0.99;
const DARKEST = 0.14;

/**
 * @typedef {object} Shade
 * @property {number} step One of SHADE_STEPS.
 * @property {string} hex '#rrggbb'.
 * @property {boolean} base True for the step that holds the input color itself.
 */

/**
 * Builds a 50-950 scale for a color. The color keeps its hue and sits, unchanged,
 * at the step whose reference lightness is closest; the other steps are spread
 * between it and near-white or near-black, so lightness falls strictly from 50 to 950.
 * @param {string} color hex color
 * @returns {Shade[]} eleven shades, lightest first
 */
export function shadeScale(color) {
  const hex = normalizeHex(color);
  if (!hex) throw new TypeError(`Invalid color: ${color}`);
  const base = rgbToOklch(hexToRgb(hex));
  const anchor = nearestStep(base.l);
  return SHADE_STEPS.map((step, index) => {
    if (index === anchor) return { step, hex, base: true };
    const l = stepLightness(index, anchor, base.l);
    const c = base.c * (RELATIVE_CHROMA[index] / RELATIVE_CHROMA[anchor]);
    return { step, hex: oklchToHex({ l, c, h: base.h }), base: false };
  });
}

function nearestStep(lightness) {
  let best = 0;
  REFERENCE_LIGHTNESS.forEach((value, index) => {
    if (Math.abs(value - lightness) < Math.abs(REFERENCE_LIGHTNESS[best] - lightness)) best = index;
  });
  return best;
}

/**
 * Rescales the reference curve so it passes through the base lightness at the
 * anchor step: lighter steps fill (base, LIGHTEST), darker steps (DARKEST, base).
 */
function stepLightness(index, anchor, baseLightness) {
  const reference = REFERENCE_LIGHTNESS[index];
  const anchorReference = REFERENCE_LIGHTNESS[anchor];
  if (index < anchor) {
    const scale = (LIGHTEST - baseLightness) / (LIGHTEST - anchorReference);
    return baseLightness + (reference - anchorReference) * scale;
  }
  const scale = (baseLightness - DARKEST) / (anchorReference - DARKEST);
  return baseLightness - (anchorReference - reference) * scale;
}
