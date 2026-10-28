import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickTextColor } from '../src/contrast.js';
import { tailwindColors, toCssVariables, toJson, toSvgStrip, toTailwindConfig } from '../src/exporters.js';
import { nearestColorName } from '../src/names.js';
import { formatColor, parseColor } from '../src/notation.js';
import { SHADE_STEPS } from '../src/shades.js';

const COLORS = ['#264653', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51'];

test('CSS custom properties, one per color with its nearest name', () => {
  const css = toCssVariables(COLORS);
  assert.ok(css.includes('--color-1: #264653; /* darkslategray */'));
  const lines = css.split('\n');
  assert.equal(lines[0], ':root {');
  assert.equal(lines.at(-2), '}');
  assert.equal(lines.at(-1), '', 'ends with a newline');
  COLORS.forEach((hex, index) => {
    assert.equal(lines[index + 1], `  --color-${index + 1}: ${hex}; /* ${nearestColorName(hex).css} */`);
  });
  assert.match(toCssVariables(COLORS, 'brand'), /--brand-5: #e76f51;/);
});

test('JSON lists each color in several notations', () => {
  const text = toJson(COLORS);
  assert.ok(text.endsWith('}\n'));
  const { colors } = JSON.parse(text);
  assert.equal(colors[0].name, 'darkslategray');
  assert.equal(colors.length, COLORS.length);
  colors.forEach((entry, index) => {
    const hex = COLORS[index];
    assert.deepEqual(Object.keys(entry), ['name', 'hex', 'rgb', 'hsl', 'oklch']);
    assert.equal(entry.hex, hex);
    assert.equal(entry.name, nearestColorName(hex).css);
    assert.equal(entry.rgb, formatColor(hex, 'rgb'));
    assert.equal(parseColor(entry.rgb), hex);
    assert.equal(parseColor(entry.hsl), parseColor(formatColor(hex, 'hsl')));
    assert.equal(entry.oklch, formatColor(hex, 'oklch'));
  });
});

test('Tailwind colors: CSS keyword keys with DEFAULT and a 50-950 scale', () => {
  const colors = tailwindColors(COLORS);
  assert.equal(Object.keys(colors).length, COLORS.length);
  Object.entries(colors).forEach(([key, scale], index) => {
    assert.match(key, /^[a-z]+(-[a-z0-9]+)*$/);
    assert.equal(scale.DEFAULT, COLORS[index]);
    assert.deepEqual(
      Object.keys(scale)
        .filter((name) => name !== 'DEFAULT')
        .map(Number),
      SHADE_STEPS,
    );
    assert.ok(Object.values(scale).every((hex) => /^#[0-9a-f]{6}$/.test(hex)));
    assert.ok(SHADE_STEPS.some((step) => scale[step] === scale.DEFAULT), 'the color itself is one of the steps');
  });
  assert.equal(Object.keys(colors)[0], 'darkslategray');
});

test('Tailwind keys get a numeric suffix when names clash', () => {
  assert.deepEqual(Object.keys(tailwindColors(['#ff0000', '#fe0000', '#fd0101'])), ['red', 'red-2', 'red-3']);
});

test('Tailwind config is a JavaScript module around theme.extend.colors', () => {
  const source = toTailwindConfig(COLORS);
  const prefix = 'export default ';
  assert.ok(source.startsWith(prefix));
  assert.ok(source.endsWith('};\n'));
  const config = JSON.parse(source.slice(prefix.length, -2));
  assert.deepEqual(config, { theme: { extend: { colors: tailwindColors(COLORS) } } });
});

test('SVG strip: equal swatches filling the width, readable labels', () => {
  const svg = toSvgStrip(COLORS);
  assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="240" viewBox="0 0 1000 240">'));
  assert.ok(svg.endsWith('</svg>\n'));
  assert.ok(svg.includes('rx="16"'));
  const rects = [...svg.matchAll(/<rect x="(\d+)" y="0" width="(\d+)" height="240" fill="(#[0-9a-f]{6})"\/>/g)];
  assert.deepEqual(
    rects.map((match) => match[3]),
    COLORS,
  );
  let x = 0;
  for (const [, left, width] of rects) {
    assert.equal(Number(left), x, 'swatches touch');
    x += Number(width);
  }
  assert.equal(x, 1000, 'swatches fill the width');
  const labels = [...svg.matchAll(/fill="(#[0-9a-f]{6})"[^>]*>(#[0-9A-F]{6})<\/text>/g)];
  assert.deepEqual(
    labels.map((match) => match[2]),
    COLORS.map((hex) => hex.toUpperCase()),
  );
  labels.forEach((match, index) => assert.equal(match[1], pickTextColor(COLORS[index])));
  assert.equal(svg.match(/https?:\/\//g).length, 1, 'only the SVG namespace, no external references');
});

test('SVG strip honours a custom size and uneven widths', () => {
  const svg = toSvgStrip(['#000000', '#ffffff', '#ff0000'], { width: 100, height: 50 });
  assert.match(svg, /width="100" height="50" viewBox="0 0 100 50"/);
  const widths = [...svg.matchAll(/<rect x="\d+" y="0" width="(\d+)"/g)].map((match) => Number(match[1]));
  assert.deepEqual(widths, [33, 34, 33]);
});
