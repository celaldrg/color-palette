import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { hexToRgb, normalizeHue, oklchToHex, rgbToOklch } from '../src/color.js';
import {
  generatePalette,
  HARMONY_MODES,
  HUE_OFFSETS,
  MAX_COLORS,
  MIN_COLORS,
  randomBaseColor,
} from '../src/harmony.js';
import { createRng, randomBetween } from '../src/rng.js';

/** Below this OKLCH chroma the hue of an 8-bit color is too noisy to measure. */
const MEASURABLE_CHROMA = 0.04;
const HUE_TOLERANCE = 3;
const FIXED_MODES = Object.keys(HUE_OFFSETS).filter((mode) => mode !== 'monochromatic');
const COUNTS = [3, 4, 5, 6, 7, 8];
const HEX = /^#[0-9a-f]{6}$/;

const oklch = (hex) => rgbToOklch(hexToRgb(hex));

/** Signed hue difference in (-180, 180]. */
function hueDelta(from, to) {
  const delta = normalizeHue(to - from);
  return delta > 180 ? delta - 360 : delta;
}

function saturatedBases(count, seed) {
  const rng = createRng(seed);
  return Array.from({ length: count }, () =>
    oklchToHex({ l: randomBetween(rng, 0.45, 0.75), c: randomBetween(rng, 0.1, 0.16), h: randomBetween(rng, 0, 360) }),
  );
}

describe('harmony definitions', () => {
  test('modes and hue offsets', () => {
    assert.deepEqual(HARMONY_MODES, [
      'analogous',
      'complementary',
      'split-complementary',
      'triadic',
      'tetradic',
      'monochromatic',
      'random',
    ]);
    assert.deepEqual(HUE_OFFSETS.analogous, [-30, 0, 30]);
    assert.deepEqual(HUE_OFFSETS.complementary, [0, 180]);
    assert.deepEqual(HUE_OFFSETS['split-complementary'], [0, 150, 210]);
    assert.deepEqual(HUE_OFFSETS.triadic, [0, 120, 240]);
    assert.deepEqual(HUE_OFFSETS.tetradic, [0, 60, 180, 240]);
    assert.deepEqual(HUE_OFFSETS.monochromatic, [0]);
    assert.equal(MIN_COLORS, 3);
    assert.equal(MAX_COLORS, 8);
  });

  test('offsets have the classic geometry', () => {
    assert.equal(HUE_OFFSETS.triadic[1] - HUE_OFFSETS.triadic[0], 120);
    assert.equal(HUE_OFFSETS.triadic[2] - HUE_OFFSETS.triadic[1], 120);
    const [, left, right] = HUE_OFFSETS['split-complementary'];
    assert.equal((left + right) / 2, 180, 'split around the complement');
    const [a, b, c, d] = HUE_OFFSETS.tetradic;
    assert.deepEqual([c - a, d - b], [180, 180], 'two complementary pairs');
  });
});

describe('generatePalette', () => {
  test('every mode and size gives valid colors that include the exact base', () => {
    for (const base of ['#3b82f6', '#e76f51', '#808080', '#000000', '#ffffff', '#ff0000', '#0000ff']) {
      for (const mode of HARMONY_MODES) {
        for (const count of COUNTS) {
          const palette = generatePalette({ base, mode, count, rng: createRng(count) });
          assert.equal(palette.length, count, `${base} ${mode} ${count}`);
          assert.ok(palette.every((hex) => HEX.test(hex)), palette.join());
          assert.ok(palette.includes(base), `${base} ${mode} ${count}: ${palette.join()}`);
        }
      }
    }
  });

  test('normalizes the base and is deterministic for a given seed', () => {
    const first = generatePalette({ base: '#3B82F6', mode: 'triadic', count: 5, rng: createRng(11) });
    const second = generatePalette({ base: '#3b82f6', mode: 'triadic', count: 5, rng: createRng(11) });
    assert.deepEqual(first, second);
    assert.ok(first.includes('#3b82f6'));
    const other = generatePalette({ base: '#3b82f6', mode: 'triadic', count: 5, rng: createRng(12) });
    assert.notDeepEqual(first, other, 'another seed gives another palette');
  });

  test('fixed harmonies place their colors on the expected hue offsets', () => {
    for (const mode of FIXED_MODES) {
      const offsets = HUE_OFFSETS[mode];
      for (const base of saturatedBases(40, 314)) {
        const baseHue = oklch(base).h;
        for (const count of COUNTS) {
          const palette = generatePalette({ base, mode, count, rng: createRng(count * 7 + 1) });
          const seen = new Set();
          for (const hex of palette) {
            const color = oklch(hex);
            if (color.c < MEASURABLE_CHROMA) continue;
            const relative = hueDelta(baseHue, color.h);
            const offset = offsets.find((value) => Math.abs(hueDelta(value, relative)) <= HUE_TOLERANCE);
            assert.notEqual(offset, undefined, `${mode} ${base} ${count}: ${hex} sits at ${relative.toFixed(1)} deg`);
            seen.add(offset);
          }
          assert.equal(seen.size, Math.min(count, offsets.length), `${mode} ${base} ${count}: hues ${[...seen]}`);
        }
      }
    }
  });

  test('monochromatic keeps the base hue and runs from dark to light', () => {
    for (const base of saturatedBases(40, 2718)) {
      const baseHue = oklch(base).h;
      for (const count of COUNTS) {
        const colors = generatePalette({ base, mode: 'monochromatic', count, rng: createRng(count) }).map(oklch);
        colors.forEach((color, index) => {
          if (color.c >= MEASURABLE_CHROMA) assert.ok(Math.abs(hueDelta(baseHue, color.h)) <= HUE_TOLERANCE);
          if (index > 0) assert.ok(color.l > colors[index - 1].l, `${base} ${count}: lightness rises`);
        });
      }
    }
  });

  test('random harmonious runs from dark to light with a constant 15-40 degree hue drift', () => {
    for (const base of saturatedBases(40, 1618)) {
      for (const count of COUNTS) {
        const colors = generatePalette({ base, mode: 'random', count, rng: createRng(count + 50) }).map(oklch);
        const steps = [];
        colors.forEach((color, index) => {
          if (index === 0) return;
          const previous = colors[index - 1];
          assert.ok(color.l > previous.l, `${base} ${count}: lightness rises`);
          if (color.c >= MEASURABLE_CHROMA && previous.c >= MEASURABLE_CHROMA) steps.push(hueDelta(previous.h, color.h));
        });
        for (const step of steps) {
          assert.ok(Math.abs(step) >= 15 - HUE_TOLERANCE && Math.abs(step) <= 40 + HUE_TOLERANCE, `step ${step}`);
          assert.equal(Math.sign(step), Math.sign(steps[0]), 'the hue drifts one way');
        }
        if (steps.length > 1) assert.ok(Math.max(...steps) - Math.min(...steps) <= 2 * HUE_TOLERANCE, `steps ${steps}`);
      }
    }
  });

  test('rejects invalid arguments', () => {
    const rng = createRng(1);
    assert.throws(() => generatePalette({ base: 'nope', mode: 'triadic', count: 5, rng }), TypeError);
    assert.throws(() => generatePalette({ base: '#3b82f6', mode: 'pentadic', count: 5, rng }), RangeError);
    for (const count of [2, 9, 4.5, '5', Number.NaN]) {
      assert.throws(() => generatePalette({ base: '#3b82f6', mode: 'triadic', count, rng }), RangeError, String(count));
    }
  });
});

test('randomBaseColor is seeded, mid-light and moderately saturated', () => {
  assert.equal(randomBaseColor(createRng(3)), randomBaseColor(createRng(3)));
  const rng = createRng(77);
  const hues = new Set();
  for (let i = 0; i < 300; i += 1) {
    const hex = randomBaseColor(rng);
    assert.match(hex, HEX);
    const { l, c, h } = oklch(hex);
    assert.ok(l > 0.49 && l < 0.79, `lightness ${l}`);
    assert.ok(c > 0.03 && c < 0.18, `chroma ${c}`);
    hues.add(Math.floor(h / 30));
  }
  assert.equal(hues.size, 12, 'hues cover the whole wheel');
});
