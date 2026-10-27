import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hexToRgb, normalizeHex, normalizeHue, rgbToHex, rgbToOklch } from '../src/color.js';
import { createRng } from '../src/rng.js';
import { SHADE_STEPS, shadeScale } from '../src/shades.js';

const EDGE_COLORS = ['#000000', '#ffffff', '#808080', '#ff0000', '#ffff00', '#0000ff', '#00ffff', '#010101', '#fefefe'];

const oklch = (hex) => rgbToOklch(hexToRgb(hex));

function seededHexColors(count, seed) {
  const rng = createRng(seed);
  const byte = () => Math.floor(rng() * 256);
  return Array.from({ length: count }, () => rgbToHex({ r: byte(), g: byte(), b: byte() }));
}

test('steps run from 50 to 950', () => {
  assert.deepEqual(SHADE_STEPS, [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]);
});

test('the input color sits unchanged at the step closest to its lightness', () => {
  const cases = [
    ['#3b82f6', 500],
    ['#000000', 950],
    ['#ffffff', 50],
    ['#F00', 500],
  ];
  for (const [color, step] of cases) {
    const scale = shadeScale(color);
    assert.deepEqual(
      scale.map((shade) => shade.step),
      SHADE_STEPS,
    );
    const bases = scale.filter((shade) => shade.base);
    assert.equal(bases.length, 1);
    assert.equal(bases[0].step, step, color);
    assert.equal(bases[0].hex, normalizeHex(color));
  }
});

test('lightness falls strictly from 50 to 950 for 500 seeded colors and the extremes', () => {
  for (const color of [...seededHexColors(500, 950), ...EDGE_COLORS]) {
    const scale = shadeScale(color);
    assert.equal(scale.length, 11);
    const lightness = scale.map((shade) => oklch(shade.hex).l);
    for (let i = 1; i < lightness.length; i += 1) {
      assert.ok(lightness[i] < lightness[i - 1], `${color}: ${scale[i - 1].hex} -> ${scale[i].hex}`);
    }
  }
});

test('colored shades keep the hue', () => {
  for (const color of ['#3b82f6', '#e76f51', '#2a9d8f', '#8b5cf6']) {
    const hue = oklch(color).h;
    for (const shade of shadeScale(color)) {
      const { c, h } = oklch(shade.hex);
      if (c < 0.04) continue;
      const delta = normalizeHue(h - hue);
      assert.ok(Math.min(delta, 360 - delta) <= 3, `${color} ${shade.step}: ${shade.hex}`);
    }
  }
});

test('greys give a grey scale', () => {
  for (const shade of shadeScale('#808080')) {
    const { r, g, b } = hexToRgb(shade.hex);
    assert.ok(r === g && g === b, shade.hex);
  }
});

test('rejects invalid colors', () => {
  for (const value of ['nope', '', null, undefined, 'rgb(1 2 3)']) {
    assert.throws(() => shadeScale(value), TypeError, String(value));
  }
});
