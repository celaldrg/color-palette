// The project's "done" criterion: color conversions round-trip on 1000 seeded
// colors, and the WCAG contrast ratio matches known values.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hexToRgb,
  hslToRgb,
  hsvToRgb,
  oklabToRgb,
  oklchToRgb,
  rgbToHex,
  rgbToHsl,
  rgbToHsv,
  rgbToOklab,
  rgbToOklch,
} from '../src/color.js';
import { checkContrast, contrastRatio } from '../src/contrast.js';
import { createRng } from '../src/rng.js';

const EDGE_COLORS = ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff', '#808080', '#010101', '#fefefe'];

function seededHexColors(count, seed) {
  const rng = createRng(seed);
  const byte = () => Math.floor(rng() * 256);
  return Array.from({ length: count }, () => rgbToHex({ r: byte(), g: byte(), b: byte() }));
}

const ROUND_TRIPS = [
  ['HSL', (rgb) => hslToRgb(rgbToHsl(rgb))],
  ['HSV', (rgb) => hsvToRgb(rgbToHsv(rgb))],
  ['OKLab', (rgb) => oklabToRgb(rgbToOklab(rgb))],
  ['OKLCH', (rgb) => oklchToRgb(rgbToOklch(rgb))],
];

for (const [name, roundTrip] of ROUND_TRIPS) {
  test(`DONE: HEX -> RGB -> ${name} -> RGB -> HEX round-trips 1000 seeded colors within 1 unit`, () => {
    const colors = seededHexColors(1000, 2026);
    assert.ok(new Set(colors).size > 990, 'the seeded colors are varied');
    for (const hex of [...colors, ...EDGE_COLORS]) {
      const rgb = hexToRgb(hex);
      const back = roundTrip(rgb);
      for (const channel of ['r', 'g', 'b']) {
        const error = Math.abs(back[channel] - rgb[channel]);
        assert.ok(error <= 1, `${hex} via ${name}: ${channel} is off by ${error}`);
      }
      assert.equal(rgbToHex(back), hex);
    }
  });
}

test('DONE: black on white has the WCAG maximum contrast ratio of 21', () => {
  assert.ok(Math.abs(contrastRatio('#000000', '#ffffff') - 21) < 1e-9);
  assert.ok(Math.abs(contrastRatio('#ffffff', '#000000') - 21) < 1e-9);
  const verdict = checkContrast('#000000', '#ffffff');
  assert.deepEqual([verdict.aa.normal, verdict.aa.large, verdict.aaa.normal, verdict.aaa.large], [true, true, true, true]);
});

test('DONE: #777777 on white is about 4.48 and fails AA for normal text', () => {
  const verdict = checkContrast('#777777', '#ffffff');
  assert.ok(Math.abs(verdict.ratio - 4.48) < 0.005, `ratio ${verdict.ratio}`);
  assert.equal(verdict.aa.normal, false);
  assert.equal(verdict.aa.large, true);
  assert.equal(verdict.aaa.normal, false);
});

test('DONE: identical colors have a contrast ratio of 1', () => {
  assert.equal(contrastRatio('#3b82f6', '#3b82f6'), 1);
});
