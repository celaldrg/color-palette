/**
 * Color math: conversions between HEX, RGB, HSL, HSV, OKLab and OKLCH, plus
 * sRGB gamut mapping by chroma reduction in OKLCH. Pure functions, no DOM.
 * @module color
 */

/** @typedef {{ r: number, g: number, b: number }} Rgb sRGB channels 0-255 (may be fractional). */
/** @typedef {{ h: number, s: number, l: number }} Hsl Hue 0-360, saturation and lightness 0-100. */
/** @typedef {{ h: number, s: number, v: number }} Hsv Hue 0-360, saturation and value 0-100. */
/** @typedef {{ l: number, a: number, b: number }} Oklab Lightness 0-1 plus the a/b opponent axes. */
/** @typedef {{ l: number, c: number, h: number }} Oklch Lightness 0-1, chroma >= 0, hue 0-360. */

const HEX_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
/** Below this chroma a color counts as grey and its hue is reported as 0. */
const ACHROMATIC_CHROMA = 1e-5;
/** Tolerance in linear light for floating point noise at the gamut edges. */
const GAMUT_EPSILON = 1e-7;
/** Upper bound for the chroma search; every sRGB color stays below about 0.33. */
const MAX_SEARCH_CHROMA = 0.4;
/** Binary search steps for gamut mapping (chroma precision about 2e-8). */
const GAMUT_STEPS = 24;

/**
 * Restricts a number to a range.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Wraps an angle in degrees into [0, 360). Angles already in range come back
 * bit-for-bit unchanged.
 * @param {number} hue
 * @returns {number}
 */
export function normalizeHue(hue) {
  const wrapped = hue % 360;
  if (wrapped < 0) return wrapped + 360 < 360 ? wrapped + 360 : 0;
  return wrapped + 0; // + 0 turns -0 into 0
}

/**
 * Normalizes '#abc', 'abc', '#AABBCC' or 'aabbcc' to lowercase '#aabbcc'.
 * @param {string} value
 * @returns {string|null} null when the value is not a 3- or 6-digit hex color
 */
export function normalizeHex(value) {
  const match = typeof value === 'string' ? HEX_PATTERN.exec(value.trim()) : null;
  if (!match) return null;
  const digits = match[1].toLowerCase();
  return `#${digits.length === 3 ? digits.replace(/./g, '$&$&') : digits}`;
}

/**
 * Parses a hex color into integer RGB channels.
 * @param {string} hex
 * @returns {Rgb|null}
 */
export function hexToRgb(hex) {
  const normal = normalizeHex(hex);
  if (!normal) return null;
  const value = Number.parseInt(normal.slice(1), 16);
  return { r: value >> 16, g: (value >> 8) & 255, b: value & 255 };
}

/**
 * Formats RGB as lowercase '#rrggbb', rounding and clamping every channel.
 * @param {Rgb} rgb
 * @returns {string}
 */
export function rgbToHex(rgb) {
  const { r, g, b } = roundRgb(rgb);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/**
 * Rounds and clamps RGB channels to integers 0-255; non-finite values become 0.
 * @param {Rgb} rgb
 * @returns {Rgb}
 */
export function roundRgb({ r, g, b }) {
  return { r: toByte(r), g: toByte(g), b: toByte(b) };
}

function toByte(value) {
  return Number.isFinite(value) ? Math.round(clamp(value, 0, 255)) : 0;
}

/**
 * Accepts a hex string or an RGB object and returns a plain RGB object.
 * @param {string|Rgb} color
 * @returns {Rgb}
 * @throws {TypeError} when the value is neither
 */
export function toRgb(color) {
  const rgb = typeof color === 'string' ? hexToRgb(color) : color;
  if (rgb && [rgb.r, rgb.g, rgb.b].every(Number.isFinite)) return { r: rgb.r, g: rgb.g, b: rgb.b };
  throw new TypeError(`Expected a hex color or an {r, g, b} object, got ${String(color)}`);
}

/**
 * Converts sRGB to HSL.
 * @param {Rgb} rgb
 * @returns {Hsl}
 */
export function rgbToHsl(rgb) {
  const { max, min, hue } = describe(rgb);
  const l = (max + min) / 2;
  const delta = max - min;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  return { h: hue, s: s * 100, l: l * 100 };
}

/**
 * Converts HSL to sRGB (fractional channels).
 * @param {Hsl} hsl
 * @returns {Rgb}
 */
export function hslToRgb({ h, s, l }) {
  const hue = normalizeHue(h);
  const light = clamp(l, 0, 100) / 100;
  const amount = (clamp(s, 0, 100) / 100) * Math.min(light, 1 - light);
  const channel = (n) => {
    const k = (n + hue / 30) % 12;
    return (light - amount * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255;
  };
  return { r: channel(0), g: channel(8), b: channel(4) };
}

/**
 * Converts sRGB to HSV.
 * @param {Rgb} rgb
 * @returns {Hsv}
 */
export function rgbToHsv(rgb) {
  const { max, min, hue } = describe(rgb);
  return { h: hue, s: max === 0 ? 0 : ((max - min) / max) * 100, v: max * 100 };
}

/**
 * Converts HSV to sRGB (fractional channels).
 * @param {Hsv} hsv
 * @returns {Rgb}
 */
export function hsvToRgb({ h, s, v }) {
  const hue = normalizeHue(h);
  const value = clamp(v, 0, 100) / 100;
  const amount = value * (clamp(s, 0, 100) / 100);
  const channel = (n) => {
    const k = (n + hue / 60) % 6;
    return (value - amount * Math.max(0, Math.min(k, 4 - k, 1))) * 255;
  };
  return { r: channel(5), g: channel(3), b: channel(1) };
}

/** Largest and smallest channel (0-1) and the shared HSL/HSV hue. */
function describe({ r, g, b }) {
  const [red, green, blue] = [r / 255, g / 255, b / 255];
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  return { max, min, hue: hueOf(red, green, blue, max, max - min) };
}

function hueOf(red, green, blue, max, delta) {
  if (delta === 0) return 0;
  if (max === red) return normalizeHue(((green - blue) / delta) * 60);
  if (max === green) return normalizeHue(((blue - red) / delta + 2) * 60);
  return normalizeHue(((red - green) / delta + 4) * 60);
}

/**
 * sRGB transfer function: gamma-encoded 0-1 value to linear light.
 * Mirrored for negative inputs so out-of-gamut math stays continuous.
 * @param {number} value
 * @returns {number}
 */
export function srgbToLinear(value) {
  const abs = Math.abs(value);
  const linear = abs <= 0.04045 ? abs / 12.92 : ((abs + 0.055) / 1.055) ** 2.4;
  return Math.sign(value) * linear;
}

/**
 * Inverse sRGB transfer function: linear light to gamma-encoded 0-1 value.
 * @param {number} value
 * @returns {number}
 */
export function linearToSrgb(value) {
  const abs = Math.abs(value);
  const encoded = abs <= 0.0031308 ? abs * 12.92 : 1.055 * abs ** (1 / 2.4) - 0.055;
  return Math.sign(value) * encoded;
}

/**
 * Converts sRGB to OKLab (Bjorn Ottosson's matrices).
 * @param {Rgb} rgb
 * @returns {Oklab}
 */
export function rgbToOklab({ r, g, b }) {
  const red = srgbToLinear(r / 255);
  const green = srgbToLinear(g / 255);
  const blue = srgbToLinear(b / 255);
  const long = Math.cbrt(0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue);
  const medium = Math.cbrt(0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue);
  const short = Math.cbrt(0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue);
  return {
    l: 0.2104542553 * long + 0.793617785 * medium - 0.0040720468 * short,
    a: 1.9779984951 * long - 2.428592205 * medium + 0.4505937099 * short,
    b: 0.0259040371 * long + 0.7827717662 * medium - 0.808675766 * short,
  };
}

/** OKLab to linear-light sRGB; values outside 0-1 mean out of gamut. */
function oklabToLinear({ l, a, b }) {
  const long = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const medium = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const short = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short,
    -1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short,
    -0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short,
  ];
}

/**
 * Converts OKLab to polar OKLCH. Grey colors get hue 0.
 * @param {Oklab} lab
 * @returns {Oklch}
 */
export function oklabToOklch({ l, a, b }) {
  const c = Math.hypot(a, b);
  const h = c < ACHROMATIC_CHROMA ? 0 : normalizeHue((Math.atan2(b, a) * 180) / Math.PI);
  return { l, c, h };
}

/**
 * Converts OKLCH to OKLab.
 * @param {Oklch} lch
 * @returns {Oklab}
 */
export function oklchToOklab({ l, c, h }) {
  const radians = (h * Math.PI) / 180;
  return { l, a: c * Math.cos(radians), b: c * Math.sin(radians) };
}

/**
 * Converts sRGB to OKLCH.
 * @param {Rgb} rgb
 * @returns {Oklch}
 */
export function rgbToOklch(rgb) {
  return oklabToOklch(rgbToOklab(rgb));
}

/**
 * Tells whether an OKLCH color lies inside the sRGB gamut.
 * @param {Oklch} lch
 * @returns {boolean}
 */
export function isOklchInGamut(lch) {
  return oklabToLinear(oklchToOklab(lch)).every((v) => v >= -GAMUT_EPSILON && v <= 1 + GAMUT_EPSILON);
}

/**
 * Maps an OKLCH color into sRGB by reducing chroma only (binary search), keeping
 * lightness (clamped to 0-1) and hue. In-gamut colors come back unchanged.
 * @param {Oklch} lch
 * @returns {Oklch}
 */
export function gamutMapOklch(lch) {
  const l = clamp(finiteOr(lch.l, 0), 0, 1);
  const h = normalizeHue(finiteOr(lch.h, 0));
  const c = Math.max(0, finiteOr(lch.c, 0));
  if (l === 0 || l === 1) return { l, c: 0, h };
  if (isOklchInGamut({ l, c, h })) return { l, c, h };
  let low = 0;
  let high = Math.min(c, MAX_SEARCH_CHROMA);
  for (let step = 0; step < GAMUT_STEPS; step += 1) {
    const middle = (low + high) / 2;
    if (isOklchInGamut({ l, c: middle, h })) low = middle;
    else high = middle;
  }
  return { l, c: low, h };
}

function finiteOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

/**
 * Converts OKLCH to sRGB, gamut mapping out-of-gamut colors first.
 * @param {Oklch} lch
 * @returns {Rgb} fractional channels, always within 0-255
 */
export function oklchToRgb(lch) {
  const [r, g, b] = oklabToLinear(oklchToOklab(gamutMapOklch(lch))).map(
    (v) => clamp(linearToSrgb(v), 0, 1) * 255,
  );
  return { r, g, b };
}

/**
 * Converts OKLab to sRGB, gamut mapping out-of-gamut colors first.
 * @param {Oklab} lab
 * @returns {Rgb}
 */
export function oklabToRgb(lab) {
  return oklchToRgb(oklabToOklch(lab));
}

/**
 * Converts OKLCH to a gamut-mapped '#rrggbb'.
 * @param {Oklch} lch
 * @returns {string}
 */
export function oklchToHex(lch) {
  return rgbToHex(oklchToRgb(lch));
}
