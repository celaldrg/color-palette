/**
 * Share links: a palette encoded in the URL hash as '#264653-2a9d8f-e9c46a'.
 * @module share
 */
import { normalizeHex } from './color.js';
import { MAX_COLORS, MIN_COLORS } from './harmony.js';

const HEX_DIGITS = /^[0-9a-f]{6}$/i;

/**
 * Encodes colors for the URL hash (without the leading '#').
 * @param {string[]} colors hex colors
 * @returns {string} e.g. '264653-2a9d8f-e9c46a'
 */
export function encodePaletteHash(colors) {
  return colors.map((color) => normalizeHex(color).slice(1)).join('-');
}

/**
 * A clean link to a palette: the page address without query string or old hash,
 * plus the encoded palette as the hash.
 * @param {string} href the current page URL
 * @param {string[]} colors hex colors
 * @returns {string} e.g. 'https://example.com/app/#264653-2a9d8f-e9c46a'
 */
export function shareUrl(href, colors) {
  const url = new URL(href);
  url.search = '';
  url.hash = encodePaletteHash(colors);
  return url.href;
}

/**
 * Decodes a URL hash made by encodePaletteHash. The leading '#' is optional.
 * @param {string} hash
 * @returns {string[]|null} lowercase '#rrggbb' colors, or null unless the hash
 *   holds MIN_COLORS-MAX_COLORS six-digit hex colors
 */
export function decodePaletteHash(hash) {
  if (typeof hash !== 'string') return null;
  const parts = hash.trim().replace(/^#/, '').split('-');
  if (parts.length < MIN_COLORS || parts.length > MAX_COLORS) return null;
  if (!parts.every((part) => HEX_DIGITS.test(part))) return null;
  return parts.map((part) => `#${part.toLowerCase()}`);
}
