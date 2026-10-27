/**
 * The palette model the UI drives: swatches with locks, a harmony mode, an
 * optional base color, seeded generation, reordering, editing and undo.
 * No DOM access. Every method returns an immutable snapshot of the new state;
 * the snapshot object only changes when the state changes.
 * @module palette
 */
import { clamp, hexToRgb, rgbToOklab } from './color.js';
import { generatePalette, HARMONY_MODES, MAX_COLORS, MIN_COLORS, randomBaseColor } from './harmony.js';
import { parseColor } from './notation.js';
import { createRng, randomSeed } from './rng.js';

/** Palette size and harmony mode used when none is given. */
export const DEFAULT_COUNT = 5;
export const DEFAULT_MODE = 'random';
/** Undo steps kept in memory. */
export const HISTORY_LIMIT = 100;

/**
 * @typedef {object} Swatch
 * @property {number} id Stable identity: survives regeneration, edits and reordering.
 * @property {string} hex '#rrggbb'.
 * @property {boolean} locked Locked swatches keep their color on generate().
 */

/**
 * @typedef {object} PaletteState
 * @property {readonly Swatch[]} swatches
 * @property {string} mode One of HARMONY_MODES.
 * @property {string|null} baseColor Explicit base color, or null: then the first
 *   locked swatch is the base, and without locks a random color is.
 * @property {boolean} canUndo
 */

/**
 * @typedef {object} PaletteApp
 * @property {() => PaletteState} getState
 * @property {() => PaletteState} generate New colors for all unlocked swatches.
 * @property {(index: number) => PaletteState} toggleLock
 * @property {(from: number, to: number) => PaletteState} moveSwatch Drag-and-drop reorder.
 * @property {(index: number, color: string) => PaletteState} setColor Any notation that
 *   parseColor accepts; invalid input is ignored. Consecutive edits of one swatch
 *   (e.g. a slider drag) merge into a single undo step.
 * @property {(count: number) => PaletteState} setCount 3-8; shrinking removes unlocked
 *   swatches from the end first, growing appends harmonious colors unlike any already there.
 * @property {(mode: string) => PaletteState} setMode Switches the harmony and regenerates.
 * @property {(color: string|null) => PaletteState} setBaseColor null or '' returns to
 *   automatic; regenerates.
 * @property {(colors: string[]) => PaletteState} loadPalette Replaces every swatch
 *   (3-8 colors, e.g. from a share link or a saved palette); invalid input is ignored.
 * @property {() => PaletteState} undo Steps back one change (no-op when canUndo is false).
 */

/**
 * Creates a palette model. Without `colors` it starts with a generated palette.
 * @param {object} [options]
 * @param {number} [options.seed] RNG seed; random when omitted.
 * @param {() => number} [options.rng] Custom random source; overrides `seed`.
 * @param {number} [options.count=5] Palette size for the first palette.
 * @param {string} [options.mode='random'] Harmony mode.
 * @param {string|null} [options.baseColor=null] Explicit base color.
 * @param {string[]} [options.colors] Starting colors instead of a generated palette.
 * @param {number[]} [options.locked] Indexes of `colors` that start locked.
 * @returns {PaletteApp}
 */
export function createPaletteApp(options = {}) {
  const rng = options.rng ?? createRng(options.seed ?? randomSeed());
  let nextId = 1;
  const createSwatch = (hex, locked = false) => ({ id: nextId++, hex, locked });
  const past = [];
  let mergeKey = null;
  let present = freezeState(initialState(options, rng, createSwatch));
  let snapshot = toSnapshot(present, false);

  function commit(next, key = null) {
    if (next === present) return snapshot;
    if (key === null || key !== mergeKey) {
      past.push(present);
      if (past.length > HISTORY_LIMIT) past.shift();
    }
    mergeKey = key;
    present = freezeState(next);
    snapshot = toSnapshot(present, true);
    return snapshot;
  }

  function undo() {
    const previous = past.pop();
    if (!previous) return snapshot;
    present = previous;
    mergeKey = null;
    snapshot = toSnapshot(present, past.length > 0);
    return snapshot;
  }

  return {
    getState: () => snapshot,
    generate: () => commit(regenerate(present, rng)),
    toggleLock: (index) => commit(toggleLock(present, index)),
    moveSwatch: (from, to) => commit(moveSwatch(present, from, to)),
    setColor: (index, color) => commit(recolor(present, index, color), editKey(present, index)),
    setCount: (count) => commit(resize(present, count, rng, createSwatch)),
    setMode: (mode) => commit(changeMode(present, mode, rng)),
    setBaseColor: (color) => commit(changeBase(present, color, rng)),
    loadPalette: (colors) => commit(replaceColors(present, colors, createSwatch)),
    undo,
  };
}

function initialState(options, rng, createSwatch) {
  const mode = HARMONY_MODES.includes(options.mode) ? options.mode : DEFAULT_MODE;
  const baseColor = parseColor(options.baseColor);
  const locked = new Set(options.locked ?? []);
  const colors =
    paletteColors(options.colors) ??
    generatePalette({
      base: baseColor ?? randomBaseColor(rng),
      mode,
      count: clampCount(options.count ?? DEFAULT_COUNT) ?? DEFAULT_COUNT,
      rng,
    });
  return {
    swatches: colors.map((hex, index) => createSwatch(hex, locked.has(index))),
    mode,
    baseColor,
  };
}

function freezeState(state) {
  state.swatches.forEach(Object.freeze);
  Object.freeze(state.swatches);
  return Object.freeze(state);
}

function toSnapshot(state, canUndo) {
  return Object.freeze({ ...state, canUndo });
}

/** Valid 3-8 color list as '#rrggbb' strings, else null. */
function paletteColors(colors) {
  if (!Array.isArray(colors) || colors.length < MIN_COLORS || colors.length > MAX_COLORS) return null;
  const hexes = colors.map(parseColor);
  return hexes.includes(null) ? null : hexes;
}

/** A number or numeric string rounded and clamped to 3-8; null for anything else ('' included). */
function clampCount(value) {
  const numeric = typeof value === 'number' || (typeof value === 'string' && value.trim() !== '');
  const count = numeric ? Math.round(Number(value)) : Number.NaN;
  return Number.isFinite(count) ? clamp(count, MIN_COLORS, MAX_COLORS) : null;
}

function swatchAt(state, index) {
  return Number.isInteger(index) ? (state.swatches[index] ?? null) : null;
}

function withSwatches(state, swatches) {
  return { ...state, swatches };
}

function replaceSwatch(state, index, swatch) {
  return withSwatches(
    state,
    state.swatches.map((item, i) => (i === index ? swatch : item)),
  );
}

function moveItem(list, from, to) {
  const result = [...list];
  const [item] = result.splice(from, 1);
  result.splice(to, 0, item);
  return result;
}

/**
 * The color the next palette harmonizes with, and the swatch index it must stay at
 * (-1 when it does not come from a swatch).
 */
function harmonyAnchor(state, rng) {
  if (state.baseColor) return { hex: state.baseColor, index: -1 };
  const index = state.swatches.findIndex((swatch) => swatch.locked);
  return index >= 0 ? { hex: state.swatches[index].hex, index } : { hex: randomBaseColor(rng), index: -1 };
}

/** Generates `count` colors around the anchor, with the anchor color at its swatch index. */
function harmonizedColors(state, anchor, count, rng) {
  const colors = generatePalette({ base: anchor.hex, mode: state.mode, count, rng });
  return anchor.index < 0 ? colors : moveItem(colors, colors.indexOf(anchor.hex), anchor.index);
}

function regenerate(state, rng) {
  if (state.swatches.every((swatch) => swatch.locked)) return state;
  const colors = harmonizedColors(state, harmonyAnchor(state, rng), state.swatches.length, rng);
  return withSwatches(
    state,
    state.swatches.map((swatch, i) => (swatch.locked ? swatch : { ...swatch, hex: colors[i] })),
  );
}

function toggleLock(state, index) {
  const swatch = swatchAt(state, index);
  return swatch ? replaceSwatch(state, index, { ...swatch, locked: !swatch.locked }) : state;
}

function moveSwatch(state, from, to) {
  if (!swatchAt(state, from) || !swatchAt(state, to) || from === to) return state;
  return withSwatches(state, moveItem(state.swatches, from, to));
}

function recolor(state, index, color) {
  const swatch = swatchAt(state, index);
  const hex = parseColor(color);
  return swatch && hex && hex !== swatch.hex ? replaceSwatch(state, index, { ...swatch, hex }) : state;
}

function editKey(state, index) {
  const swatch = swatchAt(state, index);
  return swatch ? `color:${swatch.id}` : null;
}

function resize(state, count, rng, createSwatch) {
  const target = clampCount(count);
  const current = state.swatches.length;
  if (target === null || target === current) return state;
  if (target < current) return withSwatches(state, shrink(state.swatches, current - target));
  const added = addedColors(state, target, rng);
  return withSwatches(state, [...state.swatches, ...added.map((hex) => createSwatch(hex))]);
}

/**
 * Colors for a growing palette. A palette of the new size is generated around the
 * base color (else the first locked swatch, else the first swatch), and its colors
 * farthest from everything already there are taken one at a time, so a new color
 * never repeats an existing one and fills the widest gap.
 */
function addedColors(state, target, rng) {
  const anchor = state.baseColor ?? (state.swatches.find((swatch) => swatch.locked) ?? state.swatches[0]).hex;
  const candidates = generatePalette({ base: anchor, mode: state.mode, count: target, rng }).map(withLab);
  const palette = state.swatches.map((swatch) => withLab(swatch.hex));
  const added = [];
  while (palette.length < target) {
    const next = farthestCandidate(candidates, palette);
    palette.push(next);
    added.push(next.hex);
  }
  return added;
}

function withLab(hex) {
  return { hex, lab: rgbToOklab(hexToRgb(hex)) };
}

/** The candidate whose closest palette color is farthest away in OKLab; ties go to the first. */
function farthestCandidate(candidates, palette) {
  const gaps = candidates.map((candidate) => Math.min(...palette.map((color) => labDistance(color.lab, candidate.lab))));
  return candidates[gaps.indexOf(Math.max(...gaps))];
}

function labDistance(a, b) {
  return Math.hypot(a.l - b.l, a.a - b.a, a.b - b.b);
}

/** Removes swatches from the end, unlocked ones first. */
function shrink(swatches, removeCount) {
  const result = [...swatches];
  for (let removed = 0; removed < removeCount; removed += 1) {
    const index = result.findLastIndex((swatch) => !swatch.locked);
    result.splice(index >= 0 ? index : result.length - 1, 1);
  }
  return result;
}

function changeMode(state, mode, rng) {
  if (!HARMONY_MODES.includes(mode) || mode === state.mode) return state;
  return regenerate({ ...state, mode }, rng);
}

function changeBase(state, color, rng) {
  const clearing = color === null || (typeof color === 'string' && color.trim() === '');
  const baseColor = clearing ? null : parseColor(color);
  if ((!clearing && !baseColor) || baseColor === state.baseColor) return state;
  return regenerate({ ...state, baseColor }, rng);
}

function replaceColors(state, colors, createSwatch) {
  const hexes = paletteColors(colors);
  return hexes ? withSwatches(state, hexes.map((hex) => createSwatch(hex))) : state;
}
