/**
 * The deterministic "?demo" state used for the README screenshot: a five-color
 * triadic palette with its base swatch locked and a contrast pair to show.
 * @module demo
 */
import { bestContrastPair } from './contrast.js';
import { generatePalette } from './harmony.js';
import { createPaletteApp } from './palette.js';
import { createRng } from './rng.js';

/** Seed, base color, harmony and size of the demo palette. */
export const DEMO_SEED = 7;
export const DEMO_BASE = '#009d82';
export const DEMO_MODE = 'triadic';
export const DEMO_COUNT = 5;

/**
 * @typedef {object} Demo
 * @property {import('./palette.js').PaletteApp} app The palette model, already filled.
 * @property {number} lockedIndex Index of the locked (base) swatch.
 * @property {{ foreground: number, background: number }} contrast Swatch indexes for
 *   the open contrast panel: the pair with the highest contrast, lighter one as text.
 */

/**
 * Tells whether the page was opened with the "?demo" query parameter.
 * @param {string} search location.search, e.g. '?demo'
 * @returns {boolean}
 */
export function isDemoRequest(search) {
  return new URLSearchParams(search).has('demo');
}

/**
 * Builds the demo palette model. Calling it twice gives identical results.
 * @returns {Demo}
 */
export function createDemo() {
  // The app keeps drawing from the same generator, so its first Generate does not
  // replay the sequence that made the demo colors.
  const rng = createRng(DEMO_SEED);
  const colors = generatePalette({ base: DEMO_BASE, mode: DEMO_MODE, count: DEMO_COUNT, rng });
  const lockedIndex = colors.indexOf(DEMO_BASE);
  const app = createPaletteApp({ rng, mode: DEMO_MODE, colors, locked: [lockedIndex] });
  return { app, lockedIndex, contrast: bestContrastPair(colors) };
}
