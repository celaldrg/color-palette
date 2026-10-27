import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bestContrastPair,
  checkContrast,
  contrastRatio,
  formatRatio,
  pickTextColor,
  relativeLuminance,
  WCAG_THRESHOLDS,
  wcagVerdict,
} from '../src/contrast.js';

test('relative luminance of white, black and mid grey', () => {
  assert.ok(Math.abs(relativeLuminance('#ffffff') - 1) < 1e-12);
  assert.equal(relativeLuminance('#000000'), 0);
  assert.ok(Math.abs(relativeLuminance({ r: 119, g: 119, b: 119 }) - 0.1845) < 1e-4);
});

test('contrast ratio is symmetric and accepts hex or RGB', () => {
  assert.equal(contrastRatio('#336699', '#ffffff'), contrastRatio('#ffffff', '#336699'));
  assert.equal(contrastRatio({ r: 0, g: 0, b: 0 }, '#fff'), contrastRatio('#000000', '#ffffff'));
});

test('known contrast ratios', () => {
  assert.ok(Math.abs(contrastRatio('#336699', '#ffffff') - 6.0) < 0.01);
  assert.ok(Math.abs(contrastRatio('#0000ff', '#ffffff') - 8.59) < 0.01);
  assert.ok(Math.abs(contrastRatio('#ffff00', '#000000') - 19.56) < 0.01);
});

test('verdict thresholds follow WCAG 2.x', () => {
  assert.deepEqual(WCAG_THRESHOLDS, { aaNormal: 4.5, aaLarge: 3, aaaNormal: 7, aaaLarge: 4.5 });
  assert.deepEqual(wcagVerdict(4.5), { aa: { normal: true, large: true }, aaa: { normal: false, large: true } });
  assert.deepEqual(wcagVerdict(4.499), { aa: { normal: false, large: true }, aaa: { normal: false, large: false } });
  assert.deepEqual(wcagVerdict(3), { aa: { normal: false, large: true }, aaa: { normal: false, large: false } });
  assert.deepEqual(wcagVerdict(2.99), { aa: { normal: false, large: false }, aaa: { normal: false, large: false } });
  assert.deepEqual(wcagVerdict(7), { aa: { normal: true, large: true }, aaa: { normal: true, large: true } });
});

test('checkContrast combines ratio and verdict', () => {
  const result = checkContrast('#ffffff', '#336699');
  assert.ok(Math.abs(result.ratio - 6.0) < 0.01);
  assert.deepEqual([result.aa.normal, result.aaa.normal], [true, false]);
});

test('formatRatio truncates to two decimals', () => {
  assert.equal(formatRatio(contrastRatio('#000000', '#ffffff')), '21:1');
  assert.equal(formatRatio(contrastRatio('#777777', '#ffffff')), '4.47:1');
  assert.equal(formatRatio(4.4999), '4.49:1');
  assert.equal(formatRatio(4.5), '4.5:1');
  assert.equal(formatRatio(1), '1:1');
});

test('pickTextColor chooses the more readable candidate', () => {
  assert.equal(pickTextColor('#000000'), '#ffffff');
  assert.equal(pickTextColor('#ffffff'), '#000000');
  assert.equal(pickTextColor('#ffff00'), '#000000');
  assert.equal(pickTextColor('#1e3a8a'), '#ffffff');
  assert.equal(pickTextColor('#1e3a8a', ['#0f172a', '#e2e8f0']), '#e2e8f0');
});

test('bestContrastPair finds the strongest pair with the lighter color as text', () => {
  assert.deepEqual(bestContrastPair(['#777777', '#000000', '#ffffff']), { foreground: 2, background: 1 });
  assert.deepEqual(bestContrastPair(['#ffffff', '#336699']), { foreground: 0, background: 1 });
  assert.deepEqual(bestContrastPair(['#336699', '#ffffff']), { foreground: 1, background: 0 });
  assert.deepEqual(bestContrastPair(['#123456', '#123456', '#123456']), { foreground: 0, background: 1 }, 'ties keep the first pair');
});
