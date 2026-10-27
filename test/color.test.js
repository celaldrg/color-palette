import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clamp,
  gamutMapOklch,
  hexToRgb,
  hslToRgb,
  hsvToRgb,
  isOklchInGamut,
  linearToSrgb,
  normalizeHex,
  normalizeHue,
  oklchToHex,
  oklchToRgb,
  rgbToHex,
  rgbToHsl,
  rgbToHsv,
  rgbToOklab,
  rgbToOklch,
  srgbToLinear,
  toRgb,
} from '../src/color.js';
import { createRng, randomBetween } from '../src/rng.js';

function assertClose(actual, expected, tolerance, label = '') {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label} expected ${expected} +/- ${tolerance}, got ${actual}`);
}

function hueDistance(a, b) {
  const d = Math.abs(normalizeHue(a) - normalizeHue(b));
  return Math.min(d, 360 - d);
}

describe('hex helpers', () => {
  test('normalizeHex accepts 3 and 6 digits with or without #', () => {
    assert.equal(normalizeHex('#ABC'), '#aabbcc');
    assert.equal(normalizeHex('abc'), '#aabbcc');
    assert.equal(normalizeHex(' #A1B2C3 '), '#a1b2c3');
    assert.equal(normalizeHex('a1b2c3'), '#a1b2c3');
  });

  test('normalizeHex rejects everything else', () => {
    for (const value of ['', '#', '#ab', '#abcd', '#abcde', '#abcdefa', 'xyz', '#ggg', '##abc', null, undefined, 123]) {
      assert.equal(normalizeHex(value), null, String(value));
    }
  });

  test('hexToRgb and rgbToHex', () => {
    assert.deepEqual(hexToRgb('#ff8000'), { r: 255, g: 128, b: 0 });
    assert.deepEqual(hexToRgb('#000'), { r: 0, g: 0, b: 0 });
    assert.equal(hexToRgb('nope'), null);
    assert.equal(rgbToHex({ r: 255, g: 128, b: 0 }), '#ff8000');
    assert.equal(rgbToHex({ r: 254.6, g: -3, b: 300 }), '#ff00ff', 'rounds and clamps');
    assert.equal(rgbToHex({ r: Number.NaN, g: 0, b: Infinity }), '#000000', 'non-finite becomes 0');
  });

  test('toRgb accepts hex or RGB and throws on anything else', () => {
    assert.deepEqual(toRgb('#0080ff'), { r: 0, g: 128, b: 255 });
    assert.deepEqual(toRgb({ r: 1, g: 2, b: 3, extra: true }), { r: 1, g: 2, b: 3 });
    for (const value of ['red', '#12', null, undefined, 5, { r: 1, g: 2 }]) {
      assert.throws(() => toRgb(value), TypeError);
    }
  });

  test('clamp and normalizeHue', () => {
    assert.equal(clamp(5, 0, 3), 3);
    assert.equal(clamp(-1, 0, 3), 0);
    assert.equal(normalizeHue(360), 0);
    assert.equal(normalizeHue(-30), 330);
    assert.equal(normalizeHue(725), 5);
    assert.equal(Object.is(normalizeHue(-0), 0), true);
    assert.equal(normalizeHue(-1e-20), 0);
    assert.equal(normalizeHue(259.8145266738871), 259.8145266738871, 'in-range hues are unchanged');
    assert.ok(Number.isNaN(normalizeHue(Number.NaN)));
  });
});

describe('HSL and HSV', () => {
  test('known values', () => {
    assert.deepEqual(rgbToHsl({ r: 255, g: 0, b: 0 }), { h: 0, s: 100, l: 50 });
    assert.deepEqual(rgbToHsv({ r: 255, g: 0, b: 0 }), { h: 0, s: 100, v: 100 });
    assert.equal(rgbToHsl({ r: 0, g: 255, b: 0 }).h, 120);
    assert.equal(rgbToHsl({ r: 0, g: 0, b: 255 }).h, 240);
    assert.equal(rgbToHsl({ r: 255, g: 0, b: 128 }).h > 329, true);
    const grey = rgbToHsl({ r: 128, g: 128, b: 128 });
    assert.equal(grey.s, 0);
    assertClose(grey.l, 50.196, 0.001);
    assert.deepEqual(rgbToHsv({ r: 0, g: 0, b: 0 }), { h: 0, s: 0, v: 0 });
  });

  test('conversions back to RGB', () => {
    assert.equal(rgbToHex(hslToRgb({ h: 210, s: 50, l: 40 })), '#336699');
    assert.equal(rgbToHex(hsvToRgb({ h: 210, s: 66.67, v: 60 })), '#336699');
    assert.equal(rgbToHex(hslToRgb({ h: 0, s: 0, l: 100 })), '#ffffff');
    assert.equal(rgbToHex(hsvToRgb({ h: 0, s: 0, v: 0 })), '#000000');
  });

  test('hue wraps and out-of-range percentages are clamped', () => {
    assert.deepEqual(hslToRgb({ h: 480, s: 100, l: 50 }), hslToRgb({ h: 120, s: 100, l: 50 }));
    assert.deepEqual(hsvToRgb({ h: -120, s: 100, v: 100 }), hsvToRgb({ h: 240, s: 100, v: 100 }));
    assert.equal(rgbToHex(hslToRgb({ h: 0, s: 150, l: 120 })), '#ffffff');
  });
});

describe('OKLab and OKLCH', () => {
  test('reference values for white, black and the primaries', () => {
    const white = rgbToOklch({ r: 255, g: 255, b: 255 });
    assertClose(white.l, 1, 1e-4, 'white L');
    assertClose(white.c, 0, 1e-4, 'white C');
    assert.deepEqual(rgbToOklch({ r: 0, g: 0, b: 0 }), { l: 0, c: 0, h: 0 });
    const references = [
      [{ r: 255, g: 0, b: 0 }, 0.62796, 0.25768, 29.234],
      [{ r: 0, g: 255, b: 0 }, 0.86644, 0.29483, 142.495],
      [{ r: 0, g: 0, b: 255 }, 0.45201, 0.31321, 264.052],
    ];
    for (const [rgb, l, c, h] of references) {
      const lch = rgbToOklch(rgb);
      assertClose(lch.l, l, 1e-3, 'L');
      assertClose(lch.c, c, 1e-3, 'C');
      assertClose(lch.h, h, 0.05, 'h');
    }
  });

  test('grey has zero chroma and hue 0', () => {
    const grey = rgbToOklch({ r: 119, g: 119, b: 119 });
    assert.ok(grey.c < 1e-5);
    assert.equal(grey.h, 0);
    assertClose(rgbToOklab({ r: 119, g: 119, b: 119 }).a, 0, 1e-5);
  });

  test('sRGB transfer functions are inverse and mirrored', () => {
    for (const value of [0, 0.001, 0.04, 0.2, 0.5, 1]) {
      assertClose(linearToSrgb(srgbToLinear(value)), value, 1e-12);
      assertClose(srgbToLinear(-value), -srgbToLinear(value), 1e-15);
    }
  });
});

describe('gamut mapping', () => {
  test('in-gamut colors are left unchanged', () => {
    const lch = rgbToOklch({ r: 59, g: 130, b: 246 });
    assert.equal(isOklchInGamut(lch), true);
    assert.deepEqual(gamutMapOklch(lch), lch);
  });

  test('isOklchInGamut detects colors outside sRGB', () => {
    assert.equal(isOklchInGamut({ l: 0.7, c: 0.4, h: 150 }), false);
    assert.equal(isOklchInGamut({ l: 0.5, c: 0.05, h: 0 }), true);
    assert.equal(isOklchInGamut({ l: 1.2, c: 0, h: 0 }), false);
  });

  test('always returns valid sRGB, keeping lightness and hue and only lowering chroma', () => {
    const rng = createRng(99);
    for (let i = 0; i < 2000; i += 1) {
      const input = {
        l: randomBetween(rng, -0.2, 1.2),
        c: randomBetween(rng, 0, 0.6),
        h: randomBetween(rng, -360, 720),
      };
      const mapped = gamutMapOklch(input);
      const rgb = oklchToRgb(input);
      for (const channel of ['r', 'g', 'b']) {
        assert.ok(Number.isFinite(rgb[channel]) && rgb[channel] >= 0 && rgb[channel] <= 255, JSON.stringify(input));
      }
      assert.equal(isOklchInGamut(mapped), true);
      assert.equal(mapped.l, clamp(input.l, 0, 1));
      assert.ok(mapped.c <= input.c + 1e-12);
      if (mapped.c > 0) assert.ok(hueDistance(mapped.h, input.h) < 1e-9);
      if (mapped.c < input.c && mapped.l > 0 && mapped.l < 1) {
        assert.equal(isOklchInGamut({ ...mapped, c: mapped.c + 1e-3 }), false, 'lands on the gamut boundary');
      }
    }
  });

  test('extreme and non-finite inputs still give valid colors', () => {
    assert.equal(oklchToHex({ l: 1.5, c: 0.3, h: 40 }), '#ffffff');
    assert.equal(oklchToHex({ l: -1, c: 0.3, h: 40 }), '#000000');
    assert.deepEqual(gamutMapOklch({ l: Number.NaN, c: Infinity, h: Number.NaN }), { l: 0, c: 0, h: 0 });
    assert.match(oklchToHex({ l: 0.6, c: 1e300, h: 200 }), /^#[0-9a-f]{6}$/);
    assert.ok(rgbToOklch(oklchToRgb({ l: 0.6, c: 1e300, h: 200 })).c > 0.05, 'huge chroma maps to the boundary, not to grey');
  });
});
