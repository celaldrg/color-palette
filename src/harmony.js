/**
 * Palette generators. Every harmony is built in OKLCH, so equal hue steps and
 * lightness steps look equally far apart, and every color is gamut mapped to sRGB.
 * @module harmony
 */
import { clamp, hexToRgb, normalizeHex, oklchToHex, rgbToOklch } from './color.js';
import { randomBetween } from './rng.js';

/** Smallest and largest palette size. */
export const MIN_COLORS = 3;
export const MAX_COLORS = 8;

/** Harmony modes in menu order; 'random' means "random harmonious". */
export const HARMONY_MODES = Object.freeze([
  'analogous',
  'complementary',
  'split-complementary',
  'triadic',
  'tetradic',
  'monochromatic',
  'random',
]);

/**
 * Hue offsets in degrees from the base hue that define each fixed harmony.
 * Tetradic is the rectangle of two complementary pairs.
 */
export const HUE_OFFSETS = Object.freeze({
  analogous: Object.freeze([-30, 0, 30]),
  complementary: Object.freeze([0, 180]),
  'split-complementary': Object.freeze([0, 150, 210]),
  triadic: Object.freeze([0, 120, 240]),
  tetradic: Object.freeze([0, 60, 180, 240]),
  monochromatic: Object.freeze([0]),
});

/** Lightness range for derived colors, so none is pure black or white. */
const LIGHTNESS_MIN = 0.2;
const LIGHTNESS_MAX = 0.97;
/** Derived hues stay visibly colored even when the base is grey. */
const COMPANION_MIN_CHROMA = 0.06;
/** Lightness step between tints or shades of one hue. */
const MIN_VARIANT_STEP = 0.12;
const MAX_VARIANT_STEP = 0.2;

/**
 * Generates a palette that harmonizes with a base color. The base color itself
 * is always part of the result, unchanged. The same inputs and RNG state always
 * give the same palette.
 * @param {object} options
 * @param {string} options.base Base color as hex.
 * @param {string} options.mode One of HARMONY_MODES.
 * @param {number} options.count Palette size, MIN_COLORS to MAX_COLORS.
 * @param {() => number} options.rng Seeded random source (see rng.js).
 * @returns {string[]} `count` lowercase '#rrggbb' colors in display order
 */
export function generatePalette({ base, mode, count, rng }) {
  const baseHex = normalizeHex(base);
  if (!baseHex) throw new TypeError(`Invalid base color: ${base}`);
  if (!HARMONY_MODES.includes(mode)) throw new RangeError(`Unknown harmony mode: ${mode}`);
  if (!Number.isInteger(count) || count < MIN_COLORS || count > MAX_COLORS) {
    throw new RangeError(`Palette size must be ${MIN_COLORS}-${MAX_COLORS}, got ${count}`);
  }
  const slots = buildSlots(mode, rgbToOklch(hexToRgb(baseHex)), count, rng);
  return slots.map((slot) => (slot === null ? baseHex : oklchToHex(slot)));
}

/**
 * A pleasant random starting color (mid lightness, moderate chroma, any hue).
 * @param {() => number} rng
 * @returns {string} '#rrggbb'
 */
export function randomBaseColor(rng) {
  return oklchToHex({
    l: randomBetween(rng, 0.5, 0.78),
    c: randomBetween(rng, 0.09, 0.17),
    h: randomBetween(rng, 0, 360),
  });
}

/** OKLCH colors per slot; null marks the slot that keeps the exact base color. */
function buildSlots(mode, base, count, rng) {
  if (mode === 'monochromatic') return monochromaticSlots(base, count, rng);
  if (mode === 'random') return randomSlots(base, count, rng);
  return anchoredSlots(base, HUE_OFFSETS[mode], count, rng);
}

/**
 * Fixed harmonies: the slots are split into one group per hue offset. Each group
 * starts with its anchor color and continues with lighter or darker variants.
 */
function anchoredSlots(base, offsets, count, rng) {
  const sizes = groupSizes(offsets.length, count);
  const slots = [];
  offsets.forEach((offset, group) => {
    if (sizes[group] === 0) return;
    const isBase = offset === 0;
    const anchor = isBase ? base : companion(base, offset, rng);
    const variantCount = sizes[group] - 1;
    const direction = variantDirection(anchor.l, group, variantCount);
    slots.push(isBase ? null : anchor, ...variants(anchor, variantCount, direction, rng));
  });
  return slots;
}

/** Spreads `count` slots over `groups` as evenly as possible, in order. */
function groupSizes(groups, count) {
  const sizes = new Array(groups).fill(0);
  for (let slot = 0; slot < count; slot += 1) sizes[Math.floor((slot * groups) / count)] += 1;
  return sizes;
}

/** The base rotated by `offset`, with a little lightness and chroma variety. */
function companion(base, offset, rng) {
  return {
    l: clamp(base.l + randomBetween(rng, -0.12, 0.12), 0.3, 0.9),
    c: Math.max(base.c, COMPANION_MIN_CHROMA) * randomBetween(rng, 0.8, 1.1),
    h: base.h + offset,
  };
}

/**
 * Even groups get darker variants and odd groups lighter ones, which spreads the
 * palette's lightness; a side without room for clear steps yields to the other side.
 */
function variantDirection(lightness, group, variantCount) {
  const preferred = group % 2 === 0 ? -1 : 1;
  if (roomFor(lightness, preferred) >= MIN_VARIANT_STEP * (variantCount + 0.5)) return preferred;
  return roomFor(lightness, -preferred) > roomFor(lightness, preferred) ? -preferred : preferred;
}

function roomFor(lightness, direction) {
  return direction > 0 ? LIGHTNESS_MAX - lightness : lightness - LIGHTNESS_MIN;
}

/** Tints (direction 1) or shades (direction -1) of one hue, evenly stepped. */
function variants(anchor, count, direction, rng) {
  if (count === 0) return [];
  const room = roomFor(anchor.l, direction);
  const step = Math.min(MAX_VARIANT_STEP, room / (count + 0.5)) * randomBetween(rng, 0.8, 1);
  return Array.from({ length: count }, (_, index) => ({
    l: anchor.l + direction * step * (index + 1),
    c: anchor.c * randomBetween(rng, 0.55, 0.9),
    h: anchor.h,
  }));
}

/** One hue, lightness evenly spread from dark to light; the base takes the nearest slot. */
function monochromaticSlots(base, count, rng) {
  const targets = lightnessRamp(count, randomBetween(rng, 0.22, 0.32), randomBetween(rng, 0.9, 0.97));
  const baseIndex = nearestIndex(targets, base.l);
  return targets.map((l, index) =>
    index === baseIndex ? null : { l, c: base.c * randomBetween(rng, 0.75, 1.1), h: base.h },
  );
}

/**
 * "Random harmonious": a dark-to-light lightness ramp whose hue drifts by a
 * constant random step (15-40 degrees) on either side of the base.
 */
function randomSlots(base, count, rng) {
  const targets = lightnessRamp(count, randomBetween(rng, 0.28, 0.42), randomBetween(rng, 0.86, 0.95));
  const baseIndex = nearestIndex(targets, base.l);
  const hueStep =
    randomBetween(rng, 15, Math.min(40, 210 / (count - 1))) * (rng() < 0.5 ? -1 : 1);
  const chroma = Math.max(base.c, COMPANION_MIN_CHROMA);
  return targets.map((l, index) =>
    index === baseIndex
      ? null
      : { l, c: chroma * randomBetween(rng, 0.7, 1.15), h: base.h + hueStep * (index - baseIndex) },
  );
}

function lightnessRamp(count, low, high) {
  return Array.from({ length: count }, (_, index) => low + ((high - low) * index) / (count - 1));
}

function nearestIndex(values, target) {
  let best = 0;
  values.forEach((value, index) => {
    if (Math.abs(value - target) < Math.abs(values[best] - target)) best = index;
  });
  return best;
}
