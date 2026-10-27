/**
 * The saved palettes list (newest first). Pure list operations; the UI persists
 * the list through storage.js.
 * @module saved
 */
import { decodePaletteHash, encodePaletteHash } from './share.js';

/** Oldest entries beyond this many are dropped. */
export const MAX_SAVED = 24;

/**
 * @typedef {object} SavedPalette
 * @property {string} id The share hash of the colors, so equal palettes share an id.
 * @property {string[]} colors '#rrggbb' colors.
 * @property {number} savedAt Timestamp in milliseconds.
 */

/**
 * Adds a palette at the front; saving an existing palette again moves it to the front.
 * @param {SavedPalette[]} list
 * @param {string[]} colors
 * @param {number} savedAt timestamp (passed in to keep this function pure)
 * @returns {SavedPalette[]}
 */
export function addSavedPalette(list, colors, savedAt) {
  const id = encodePaletteHash(colors);
  const entry = { id, colors: decodePaletteHash(id), savedAt };
  return [entry, ...list.filter((item) => item.id !== id)].slice(0, MAX_SAVED);
}

/**
 * Removes a palette by id.
 * @param {SavedPalette[]} list
 * @param {string} id
 * @returns {SavedPalette[]}
 */
export function removeSavedPalette(list, id) {
  return list.filter((item) => item.id !== id);
}

/**
 * Validates data read back from storage: keeps well-formed, unique entries and
 * drops everything else, so corrupted storage can never break the app.
 * @param {unknown} value
 * @returns {SavedPalette[]}
 */
export function sanitizeSavedPalettes(value) {
  if (!Array.isArray(value)) return [];
  const result = [];
  for (const item of value) {
    const colors = decodePaletteHash(item?.id);
    if (!colors) continue;
    const id = encodePaletteHash(colors);
    if (result.some((entry) => entry.id === id)) continue;
    result.push({ id, colors, savedAt: Number.isFinite(item.savedAt) ? item.savedAt : 0 });
  }
  return result.slice(0, MAX_SAVED);
}
