/**
 * Parsing and formatting of user-facing color notations: HEX, rgb(), hsl(),
 * hsv()/hsb(), oklch() and CSS color names. Pure functions, no DOM.
 * @module notation
 */
import {
  hslToRgb,
  hsvToRgb,
  normalizeHex,
  oklchToRgb,
  rgbToHex,
  rgbToHsl,
  rgbToHsv,
  rgbToOklch,
  roundRgb,
  toRgb,
} from './color.js';
import { namedColorHex } from './names.js';

/** Notations understood by formatColor (and parseColor). */
export const NOTATIONS = Object.freeze(['hex', 'rgb', 'hsl', 'hsv', 'oklch']);

const ALPHA_HEX_PATTERN = /^#([0-9a-f]{4}|[0-9a-f]{8})$/;
const FUNCTION_PATTERN = /^([a-z]+)\(([^()]*)\)$/;
const TOKEN_PATTERN = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(%|deg|rad|grad|turn)?$/;
/** CSS defines 100% OKLCH chroma as 0.4. */
const OKLCH_FULL_CHROMA = 0.4;

const DEGREES_PER_UNIT = new Map([
  ['', 1],
  ['deg', 1],
  ['rad', 180 / Math.PI],
  ['grad', 0.9],
  ['turn', 360],
]);

const CHANNEL_PARSERS = new Map([
  ['rgb', parseRgbChannels],
  ['rgba', parseRgbChannels],
  ['hsl', parseHslChannels],
  ['hsla', parseHslChannels],
  ['hsv', parseHsvChannels],
  ['hsb', parseHsvChannels],
  ['oklch', parseOklchChannels],
]);

const FORMATTERS = new Map([
  ['hex', rgbToHex],
  ['rgb', formatRgb],
  ['hsl', formatHsl],
  ['hsv', formatHsv],
  ['oklch', formatOklch],
]);

/**
 * Parses a color typed by a user.
 * Accepts #rgb and #rrggbb (the '#' is optional), #rgba and #rrggbbaa, rgb()/rgba(),
 * hsl()/hsla(), hsv()/hsb() and oklch() in comma or space syntax, and CSS color
 * names. Alpha is accepted for CSS compatibility but dropped, because palette colors
 * are opaque. Out-of-range channels are rejected; OKLCH colors outside sRGB are
 * gamut mapped.
 * @param {string} input
 * @returns {string|null} lowercase '#rrggbb', or null when the input is not a color
 */
export function parseColor(input) {
  if (typeof input !== 'string') return null;
  const text = input.trim().toLowerCase();
  return normalizeHex(text) ?? parseAlphaHex(text) ?? namedColorHex(text) ?? parseFunction(text);
}

/**
 * Formats a color in one of NOTATIONS. The output is accepted by parseColor and
 * reads back within one unit per RGB channel.
 * @param {string|import('./color.js').Rgb} color hex string or RGB
 * @param {string} [notation='hex'] 'hex' | 'rgb' | 'hsl' | 'hsv' | 'oklch'
 * @returns {string}
 */
export function formatColor(color, notation = 'hex') {
  const formatter = FORMATTERS.get(notation);
  if (!formatter) throw new RangeError(`Unknown notation: ${notation}`);
  return formatter(toRgb(color));
}

function parseAlphaHex(text) {
  const match = ALPHA_HEX_PATTERN.exec(text);
  if (!match) return null;
  const digits = match[1];
  return normalizeHex(digits.slice(0, digits.length === 4 ? 3 : 6));
}

function parseFunction(text) {
  const match = FUNCTION_PATTERN.exec(text);
  const parseChannels = match ? CHANNEL_PARSERS.get(match[1]) : undefined;
  const args = parseChannels ? splitArguments(match[2]) : null;
  if (!args || (args.alpha && !isAlpha(args.alpha))) return null;
  const rgb = parseChannels(args.channels);
  return rgb ? rgbToHex(rgb) : null;
}

/** Splits 'a, b, c[, alpha]' or 'a b c[ / alpha]' into parsed tokens. */
function splitArguments(body) {
  const text = body.trim();
  if (text.includes(',')) {
    const parts = text.split(',').map((part) => part.trim());
    if (parts.length < 3 || parts.length > 4) return null;
    return parseTokens(parts.slice(0, 3), parts[3]);
  }
  const [channels, alpha, extra] = text.split('/');
  if (extra !== undefined) return null;
  return parseTokens(channels.trim().split(/\s+/), alpha?.trim());
}

function parseTokens(parts, alphaText) {
  if (parts.length !== 3) return null;
  const channels = parts.map(parseToken);
  const alpha = alphaText === undefined ? null : parseToken(alphaText);
  if (channels.includes(null) || (alphaText !== undefined && !alpha)) return null;
  return { channels, alpha };
}

function parseToken(text) {
  const match = TOKEN_PATTERN.exec(text);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? { value, unit: match[2] ?? '' } : null;
}

/** A bare number, or a percentage of `full` (the value of 100%); null for other units. */
function plainOrPercent({ value, unit }, full) {
  if (unit === '') return value;
  if (unit === '%') return (value * full) / 100;
  return null;
}

function inRange(value, min, max) {
  return value !== null && value >= min && value <= max;
}

function isAlpha(token) {
  return inRange(plainOrPercent(token, 1), 0, 1);
}

function toDegrees({ value, unit }) {
  return DEGREES_PER_UNIT.has(unit) ? value * DEGREES_PER_UNIT.get(unit) : null;
}

function parseRgbChannels(tokens) {
  const [r, g, b] = tokens.map((token) => plainOrPercent(token, 255));
  return [r, g, b].every((v) => inRange(v, 0, 255)) ? { r, g, b } : null;
}

function parseHueTriplet([hueToken, ...percentTokens]) {
  const hue = toDegrees(hueToken);
  const [first, second] = percentTokens.map((token) => plainOrPercent(token, 100));
  return hue !== null && inRange(first, 0, 100) && inRange(second, 0, 100) ? [hue, first, second] : null;
}

function parseHslChannels(tokens) {
  const values = parseHueTriplet(tokens);
  return values && hslToRgb({ h: values[0], s: values[1], l: values[2] });
}

function parseHsvChannels(tokens) {
  const values = parseHueTriplet(tokens);
  return values && hsvToRgb({ h: values[0], s: values[1], v: values[2] });
}

function parseOklchChannels([lightnessToken, chromaToken, hueToken]) {
  const l = plainOrPercent(lightnessToken, 1);
  const c = plainOrPercent(chromaToken, OKLCH_FULL_CHROMA);
  const h = toDegrees(hueToken);
  if (!inRange(l, 0, 1) || !inRange(c, 0, Infinity) || h === null) return null;
  return oklchToRgb({ l, c, h });
}

function formatRgb(rgb) {
  const { r, g, b } = roundRgb(rgb);
  return `rgb(${r} ${g} ${b})`;
}

function formatHsl(rgb) {
  const { h, s, l } = rgbToHsl(rgb);
  return `hsl(${fixed(h, 1)} ${fixed(s, 1)}% ${fixed(l, 1)}%)`;
}

function formatHsv(rgb) {
  const { h, s, v } = rgbToHsv(rgb);
  return `hsv(${fixed(h, 1)} ${fixed(s, 1)}% ${fixed(v, 1)}%)`;
}

function formatOklch(rgb) {
  const { l, c, h } = rgbToOklch(rgb);
  return `oklch(${fixed(l * 100, 2)}% ${fixed(c, 4)} ${fixed(h, 2)})`;
}

/** Rounds to `digits` decimals and drops trailing zeros ('-0' prints as '0'). */
function fixed(value, digits) {
  return String(Number(value.toFixed(digits)));
}
