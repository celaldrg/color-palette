/**
 * The color picker's slider model: HSL and OKLCH channels with their ranges,
 * conversions to and from hex, and the gradient each slider track shows.
 * Pure functions, no DOM.
 * @module sliders
 */
import { gamutMapOklch, hexToRgb, hslToRgb, oklchToHex, rgbToHex, rgbToHsl, rgbToOklch } from './color.js';

/** Color spaces the picker offers. */
export const SLIDER_SPACES = Object.freeze(['hsl', 'oklch']);

/**
 * Chroma that gamut mapping may take away before the picker reports a color as
 * outside sRGB. Rounding noise stays below 2e-8 (checked on every 24-bit color),
 * while one chroma slider step is 0.001.
 */
const GAMUT_NOTE_CHROMA = 1e-4;

/**
 * @typedef {object} SliderChannel
 * @property {string} key channel name in the slider values ('h', 's', 'l' or 'c')
 * @property {string} label i18n key of the channel name
 * @property {number} min
 * @property {number} max
 * @property {number} step
 */

const channel = (key, label, max, step) => Object.freeze({ key, label, min: 0, max, step });

/**
 * Slider channels per space, in display order. OKLCH lightness is in percent;
 * OKLCH chroma stops at 0.37, a little beyond the most saturated sRGB color.
 * @type {Readonly<Record<string, readonly SliderChannel[]>>}
 */
export const SLIDER_CHANNELS = Object.freeze({
  hsl: Object.freeze([
    channel('h', 'picker.hue', 360, 0.1),
    channel('s', 'picker.saturation', 100, 0.1),
    channel('l', 'picker.lightness', 100, 0.1),
  ]),
  oklch: Object.freeze([
    channel('l', 'picker.lightness', 100, 0.1),
    channel('c', 'picker.chroma', 0.37, 0.001),
    channel('h', 'picker.hue', 360, 0.1),
  ]),
});

/** Hue tracks always show a vivid rainbow, whatever the current color. */
const HUE_TRACK = Object.freeze({ hsl: { s: 100, l: 50 }, oklch: { l: 72, c: 0.14 } });
/** Color stops per track gradient. */
const TRACK_STOPS = 13;

/**
 * Slider values for a hex color.
 * @param {string} space 'hsl' or 'oklch'
 * @param {string} hex
 * @returns {Record<string, number>} hsl: {h, s, l}; oklch: {l (0-100), c, h}
 */
export function slidersFromHex(space, hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) throw new TypeError(`Invalid color: ${hex}`);
  if (checkSpace(space) === 'hsl') return rgbToHsl(rgb);
  const { l, c, h } = rgbToOklch(rgb);
  return { l: l * 100, c, h };
}

/**
 * The hex color for slider values; OKLCH values outside sRGB are gamut mapped
 * by reducing chroma.
 * @param {string} space 'hsl' or 'oklch'
 * @param {Record<string, number>} values as returned by slidersFromHex
 * @returns {string} '#rrggbb'
 */
export function hexFromSliders(space, values) {
  if (checkSpace(space) === 'hsl') return rgbToHex(hslToRgb(values));
  return oklchToHex(toOklch(values));
}

/**
 * Tells whether slider values show as they are. HSL always does; OKLCH values
 * are outside sRGB when gamut mapping must reduce their chroma by more than
 * rounding noise, so the values of any hex color always fit.
 * @param {string} space 'hsl' or 'oklch'
 * @param {Record<string, number>} values
 * @returns {boolean}
 */
export function slidersInGamut(space, values) {
  if (checkSpace(space) === 'hsl') return true;
  const lch = toOklch(values);
  return lch.c - gamutMapOklch(lch).c < GAMUT_NOTE_CHROMA;
}

/**
 * The CSS gradient for one slider track: the color as that channel sweeps its
 * range while the other channels keep their values.
 * @param {string} space 'hsl' or 'oklch'
 * @param {string} key channel key
 * @param {Record<string, number>} values current slider values
 * @returns {string} 'linear-gradient(90deg, #..., ...)'
 */
export function sliderGradient(space, key, values) {
  const { min, max } = findChannel(space, key);
  const base = key === 'h' ? { ...values, ...HUE_TRACK[space] } : values;
  const stops = Array.from({ length: TRACK_STOPS }, (_, index) =>
    hexFromSliders(space, { ...base, [key]: min + ((max - min) * index) / (TRACK_STOPS - 1) }),
  );
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}

/**
 * Display text for a slider value: hues in degrees, OKLCH chroma with three
 * decimals, everything else in whole percent.
 * @param {string} space 'hsl' or 'oklch'
 * @param {string} key channel key
 * @param {number} value
 * @returns {string}
 */
export function formatSliderValue(space, key, value) {
  findChannel(space, key);
  if (key === 'h') return `${Math.round(value) % 360}°`;
  if (key === 'c') return value.toFixed(3);
  return `${Math.round(value)}%`;
}

function checkSpace(space) {
  if (!SLIDER_SPACES.includes(space)) throw new RangeError(`Unknown color space: ${space}`);
  return space;
}

function findChannel(space, key) {
  const found = SLIDER_CHANNELS[checkSpace(space)].find((item) => item.key === key);
  if (!found) throw new RangeError(`Unknown ${space} channel: ${key}`);
  return found;
}

function toOklch({ l, c, h }) {
  return { l: l / 100, c, h };
}
