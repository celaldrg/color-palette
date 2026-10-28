/**
 * Palette exports: CSS custom properties, JSON, a Tailwind-style config object
 * and an SVG swatch strip. All functions take an array of '#rrggbb' colors.
 * @module exporters
 */
import { pickTextColor } from './contrast.js';
import { nearestColorName } from './names.js';
import { formatColor } from './notation.js';
import { shadeScale } from './shades.js';

/**
 * CSS custom properties on :root, one per color, with the nearest CSS color keyword.
 * @param {string[]} colors
 * @param {string} [prefix='color'] variable name prefix: --color-1, --color-2, ...
 * @returns {string}
 */
export function toCssVariables(colors, prefix = 'color') {
  const lines = colors.map(
    (hex, index) => `  --${prefix}-${index + 1}: ${hex}; /* ${nearestColorName(hex).css} */`,
  );
  return `:root {\n${lines.join('\n')}\n}\n`;
}

/**
 * JSON with each color's nearest CSS keyword (name) and HEX, RGB, HSL and OKLCH notations.
 * @param {string[]} colors
 * @returns {string}
 */
export function toJson(colors) {
  const entries = colors.map((hex) => ({
    name: nearestColorName(hex).css,
    hex,
    rgb: formatColor(hex, 'rgb'),
    hsl: formatColor(hex, 'hsl'),
    oklch: formatColor(hex, 'oklch'),
  }));
  return `${JSON.stringify({ colors: entries }, null, 2)}\n`;
}

/**
 * Tailwind-style color entries: one key per color (nearest CSS color keyword,
 * suffixed -2, -3 on clashes) holding DEFAULT and the 50-950 shade scale.
 * @param {string[]} colors
 * @returns {Record<string, Record<string, string>>}
 */
export function tailwindColors(colors) {
  const result = {};
  for (const hex of colors) {
    const scale = { DEFAULT: hex };
    for (const shade of shadeScale(hex)) scale[shade.step] = shade.hex;
    result[uniqueKey(result, nearestColorName(hex).css)] = scale;
  }
  return result;
}

/**
 * A Tailwind config module (theme.extend.colors) as JavaScript source.
 * @param {string[]} colors
 * @returns {string}
 */
export function toTailwindConfig(colors) {
  const config = { theme: { extend: { colors: tailwindColors(colors) } } };
  return `export default ${JSON.stringify(config, null, 2)};\n`;
}

/**
 * An SVG strip of equal-width swatches with rounded outer corners and HEX labels
 * in a readable text color.
 * @param {string[]} colors
 * @param {{ width?: number, height?: number }} [size]
 * @returns {string}
 */
export function toSvgStrip(colors, { width = 1000, height = 240 } = {}) {
  const swatches = colors.map((hex, index) => {
    const x = Math.round((index * width) / colors.length);
    const swatchWidth = Math.round(((index + 1) * width) / colors.length) - x;
    return [
      `    <rect x="${x}" y="0" width="${swatchWidth}" height="${height}" fill="${hex}"/>`,
      `    <text x="${x + swatchWidth / 2}" y="${height - 24}" fill="${pickTextColor(hex)}" ` +
        `font-family="system-ui, sans-serif" font-size="18" font-weight="600" ` +
        `text-anchor="middle">${hex.toUpperCase()}</text>`,
    ].join('\n');
  });
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    '  <defs>',
    `    <clipPath id="strip"><rect width="${width}" height="${height}" rx="16"/></clipPath>`,
    '  </defs>',
    '  <g clip-path="url(#strip)">',
    ...swatches,
    '  </g>',
    '</svg>',
    '',
  ].join('\n');
}

function uniqueKey(taken, key) {
  let candidate = key;
  for (let suffix = 2; Object.hasOwn(taken, candidate); suffix += 1) candidate = `${key}-${suffix}`;
  return candidate;
}
