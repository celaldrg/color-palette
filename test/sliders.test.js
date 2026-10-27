import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rgbToHex } from '../src/color.js';
import { createRng } from '../src/rng.js';
import {
  formatSliderValue,
  hexFromSliders,
  SLIDER_CHANNELS,
  SLIDER_SPACES,
  sliderGradient,
  slidersFromHex,
  slidersInGamut,
} from '../src/sliders.js';

const HEX = /^#[0-9a-f]{6}$/;

function seededColors(count, seed) {
  const rng = createRng(seed);
  const byte = () => Math.floor(rng() * 256);
  return Array.from({ length: count }, () => rgbToHex({ r: byte(), g: byte(), b: byte() }));
}

test('every space has three channels whose ranges contain the values of real colors', () => {
  assert.deepEqual(SLIDER_SPACES, ['hsl', 'oklch']);
  for (const space of SLIDER_SPACES) {
    assert.equal(SLIDER_CHANNELS[space].length, 3);
    for (const hex of seededColors(200, 3)) {
      const values = slidersFromHex(space, hex);
      for (const { key, min, max } of SLIDER_CHANNELS[space]) {
        assert.ok(values[key] >= min && values[key] <= max, `${space} ${key} of ${hex}: ${values[key]}`);
      }
    }
  }
});

test('slider values convert back to the same hex color', () => {
  for (const space of SLIDER_SPACES) {
    for (const hex of [...seededColors(500, 11), '#000000', '#ffffff', '#808080']) {
      assert.equal(hexFromSliders(space, slidersFromHex(space, hex)), hex, `${space} ${hex}`);
    }
  }
});

test('OKLCH values outside sRGB are flagged and still give a valid color', () => {
  const vivid = { l: 50, c: 0.37, h: 140 };
  assert.equal(slidersInGamut('oklch', vivid), false);
  assert.match(hexFromSliders('oklch', vivid), HEX);
  assert.equal(slidersInGamut('oklch', slidersFromHex('oklch', '#3b82f6')), true);
  assert.equal(slidersInGamut('hsl', { h: 10, s: 100, l: 50 }), true);
});

test('the OKLCH values of a hex color never count as outside sRGB', () => {
  // The surface of the RGB cube is the gamut edge, where rounding noise used to trip the check.
  const steps = Array.from({ length: 52 }, (_, index) => index * 5);
  const surface = [];
  for (const edge of [0, 255]) {
    for (const x of steps) {
      for (const y of steps) surface.push({ r: edge, g: x, b: y }, { r: x, g: edge, b: y }, { r: x, g: y, b: edge });
    }
  }
  for (const hex of [...surface.map(rgbToHex), '#f5ef00', ...seededColors(5000, 5)]) {
    assert.equal(slidersInGamut('oklch', slidersFromHex('oklch', hex)), true, hex);
  }
});

test('one chroma step past the gamut edge is flagged', () => {
  for (const hex of ['#00ff00', '#ffff00', '#0000ff']) {
    const edge = slidersFromHex('oklch', hex);
    assert.equal(slidersInGamut('oklch', { ...edge, c: edge.c + 0.001 }), false, hex);
  }
  assert.equal(slidersInGamut('oklch', { l: 100, c: 0.05, h: 0 }), false, 'white has no chroma to spare');
});

test('track gradients sweep one channel through valid colors', () => {
  const values = slidersFromHex('oklch', '#3b82f6');
  for (const space of SLIDER_SPACES) {
    for (const { key } of SLIDER_CHANNELS[space]) {
      const gradient = sliderGradient(space, key, slidersFromHex(space, '#3b82f6'));
      assert.match(gradient, /^linear-gradient\(90deg, (#[0-9a-f]{6}, )+#[0-9a-f]{6}\)$/);
    }
  }
  const lightness = sliderGradient('oklch', 'l', values).match(/#[0-9a-f]{6}/g);
  assert.equal(lightness[0], '#000000');
  assert.equal(lightness.at(-1), '#ffffff');
  const hues = new Set(sliderGradient('hsl', 'h', { h: 0, s: 0, l: 50 }).match(/#[0-9a-f]{6}/g));
  assert.ok(hues.size > 6, 'the hue track stays colorful even for a grey');
});

test('slider values are formatted for display', () => {
  assert.equal(formatSliderValue('hsl', 'h', 210.4), '210°');
  assert.equal(formatSliderValue('hsl', 'h', 359.7), '0°');
  assert.equal(formatSliderValue('hsl', 's', 66.6), '67%');
  assert.equal(formatSliderValue('oklch', 'l', 62.84), '63%');
  assert.equal(formatSliderValue('oklch', 'c', 0.12345), '0.123');
});

test('unknown spaces and channels are rejected', () => {
  assert.throws(() => slidersFromHex('lab', '#ffffff'), RangeError);
  assert.throws(() => slidersFromHex('hsl', 'nope'), TypeError);
  assert.throws(() => hexFromSliders('hsv', { h: 0, s: 0, v: 0 }), RangeError);
  assert.throws(() => sliderGradient('hsl', 'c', { h: 0, s: 0, l: 0 }), RangeError);
  assert.throws(() => formatSliderValue('oklch', 's', 1), RangeError);
});
