import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { hexToRgb, rgbToHex } from '../src/color.js';
import { formatColor, NOTATIONS, parseColor } from '../src/notation.js';
import { createRng } from '../src/rng.js';

const VALID = [
  ['#ff0000', '#ff0000'],
  ['#F00', '#ff0000'],
  ['f00', '#ff0000'],
  ['FF8800', '#ff8800'],
  ['#ff000080', '#ff0000'],
  ['#f008', '#ff0000'],
  ['rgb(255, 0, 0)', '#ff0000'],
  ['rgb(255 136 0)', '#ff8800'],
  ['RGBA(0, 128, 255, 0.5)', '#0080ff'],
  ['rgb(0 128 255 / 50%)', '#0080ff'],
  ['rgb(0 128 255/0.25)', '#0080ff'],
  ['rgb(100%, 50%, 0%)', '#ff8000'],
  ['  rgb( 1 , 2 , 3 )  ', '#010203'],
  ['hsl(120, 100%, 50%)', '#00ff00'],
  ['hsl(120deg 100% 25%)', '#008000'],
  ['hsla(240, 100%, 50%, 0.3)', '#0000ff'],
  ['hsl(0.5turn 100% 50%)', '#00ffff'],
  ['hsl(3.14159265rad 100% 50%)', '#00ffff'],
  ['hsl(200grad 100% 50%)', '#00ffff'],
  ['hsl(-120 100% 50%)', '#0000ff'],
  ['hsl(210 50 40)', '#336699'],
  ['hsv(0, 100%, 100%)', '#ff0000'],
  ['hsb(240 100% 50%)', '#000080'],
  ['oklch(62.8% 0.2577 29.23)', '#ff0000'],
  ['oklch(0.62796 0.25768 29.2339deg)', '#ff0000'],
  ['oklch(1 0 0)', '#ffffff'],
  ['oklch(0% 0 0)', '#000000'],
  ['rebeccapurple', '#663399'],
  ['Dark Slate Blue', '#483d8b'],
  ['  WHITE  ', '#ffffff'],
];

const GARBAGE = [
  '',
  '   ',
  'hello',
  'transparent',
  '#12',
  '#12345',
  '#1234567',
  '#ggg',
  '##fff',
  'rgb(1, 2)',
  'rgb(1, 2, 3, 4, 5)',
  'rgb(1 2 3 4)',
  'rgb(256, 0, 0)',
  'rgb(-1, 0, 0)',
  'rgb(101%, 0%, 0%)',
  'rgb(1, 2 3)',
  'rgb(1, 2, 3',
  'rgb 1 2 3',
  'rgb(1px, 2, 3)',
  'rgb(1, 2, 3) x',
  'rgb(1 2 3 / 2)',
  'rgb(1 2 3 / 0.5 / 1)',
  'rgb(1 2 3 /)',
  'rgb(1, 2, 3 / 0.5)',
  'rgb(1,,2,3)',
  'rgb()',
  'rgb(1e999, 0, 0)',
  'rgb(NaN, 0, 0)',
  'hsl(120%, 50%, 50%)',
  'hsl(abc, 50%, 50%)',
  'hsl(120, 150%, 50%)',
  'hsl(120, 50%)',
  'hsv(0, 0%, 101%)',
  'oklch(1.5 0.1 120)',
  'oklch(0.5 -0.1 120)',
  'oklch(50% 0.1 120%)',
  'oklch(50 0.1 120)',
  'cmyk(0, 0, 0, 0)',
  'constructor(1, 2, 3)',
  null,
  undefined,
  42,
  {},
];

function seededHexColors(count, seed) {
  const rng = createRng(seed);
  const byte = () => Math.floor(rng() * 256);
  return Array.from({ length: count }, () => rgbToHex({ r: byte(), g: byte(), b: byte() }));
}

describe('parseColor', () => {
  test('accepts HEX, RGB, HSL, HSV, OKLCH and CSS names', () => {
    for (const [input, expected] of VALID) {
      assert.equal(parseColor(input), expected, input);
    }
  });

  test('rejects garbage', () => {
    for (const input of GARBAGE) {
      assert.equal(parseColor(input), null, String(input));
    }
  });

  test('gamut maps OKLCH colors outside sRGB instead of rejecting them', () => {
    assert.match(parseColor('oklch(0.7 0.5 150)'), /^#[0-9a-f]{6}$/);
    assert.equal(parseColor('oklch(70% 100% 150deg)'), parseColor('oklch(0.7 0.4 150)'));
  });
});

describe('formatColor', () => {
  test('known values', () => {
    assert.equal(formatColor('#ff0000'), '#ff0000');
    assert.equal(formatColor('#ff0000', 'rgb'), 'rgb(255 0 0)');
    assert.equal(formatColor('#ff0000', 'hsl'), 'hsl(0 100% 50%)');
    assert.equal(formatColor('#ff0000', 'hsv'), 'hsv(0 100% 100%)');
    assert.equal(formatColor('#ff0000', 'oklch'), 'oklch(62.8% 0.2577 29.23)');
    assert.equal(formatColor({ r: 51, g: 102, b: 153 }, 'hsl'), 'hsl(210 50% 40%)');
    assert.equal(formatColor('#777777', 'oklch'), 'oklch(56.93% 0 0)');
  });

  test('rejects unknown notations', () => {
    assert.throws(() => formatColor('#ff0000', 'cmyk'), RangeError);
  });

  for (const notation of NOTATIONS) {
    test(`${notation} output parses back within 1 unit per channel on 1000 seeded colors`, () => {
      for (const hex of seededHexColors(1000, 7)) {
        const text = formatColor(hex, notation);
        const parsed = parseColor(text);
        assert.notEqual(parsed, null, text);
        const expected = hexToRgb(hex);
        const actual = hexToRgb(parsed);
        for (const channel of ['r', 'g', 'b']) {
          assert.ok(Math.abs(actual[channel] - expected[channel]) <= 1, `${hex} -> ${text} -> ${parsed}`);
        }
      }
    });
  }
});
