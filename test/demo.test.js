import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hexToRgb, normalizeHue, rgbToOklch } from '../src/color.js';
import { contrastRatio, relativeLuminance } from '../src/contrast.js';
import { createDemo, DEMO_BASE, DEMO_COUNT, DEMO_MODE, isDemoRequest } from '../src/demo.js';
import { HUE_OFFSETS } from '../src/harmony.js';

test('the demo is a five-color triadic palette with the base swatch locked', () => {
  const { app, lockedIndex } = createDemo();
  const state = app.getState();
  assert.equal(DEMO_COUNT, 5);
  assert.equal(DEMO_MODE, 'triadic');
  assert.equal(state.mode, 'triadic');
  assert.equal(state.swatches.length, 5);
  assert.deepEqual(
    state.swatches.map((swatch) => swatch.locked),
    state.swatches.map((_, index) => index === lockedIndex),
  );
  assert.equal(state.swatches[lockedIndex].hex, DEMO_BASE);
  assert.equal(state.canUndo, false);
});

test('the demo colors sit on the triadic hues', () => {
  const baseHue = rgbToOklch(hexToRgb(DEMO_BASE)).h;
  const seen = new Set();
  for (const { hex } of createDemo().app.getState().swatches) {
    const { c, h } = rgbToOklch(hexToRgb(hex));
    if (c < 0.04) continue;
    const relative = normalizeHue(h - baseHue);
    const offset = HUE_OFFSETS.triadic.find((value) => {
      const delta = normalizeHue(relative - value);
      return Math.min(delta, 360 - delta) <= 3;
    });
    assert.notEqual(offset, undefined, hex);
    seen.add(offset);
  }
  assert.equal(seen.size, 3);
});

test('the open contrast panel shows the strongest pair, lighter color as text', () => {
  const { app, contrast } = createDemo();
  const colors = app.getState().swatches.map((swatch) => swatch.hex);
  const { foreground, background } = contrast;
  assert.notEqual(foreground, background);
  assert.ok(colors[foreground] && colors[background]);
  assert.ok(relativeLuminance(colors[foreground]) > relativeLuminance(colors[background]));
  const best = Math.max(...colors.flatMap((a, i) => colors.slice(i + 1).map((b) => contrastRatio(a, b))));
  assert.equal(contrastRatio(colors[foreground], colors[background]), best);
});

test('the demo is identical every time and still works as a normal palette', () => {
  const first = createDemo();
  const second = createDemo();
  assert.deepEqual(first.app.getState(), second.app.getState());
  assert.deepEqual([first.lockedIndex, first.contrast], [second.lockedIndex, second.contrast]);
  assert.deepEqual(first.app.generate(), second.app.generate());
  assert.equal(first.app.getState().swatches[first.lockedIndex].hex, DEMO_BASE);
});

test('the first Generate in the demo changes the unlocked colors', () => {
  const { app, lockedIndex } = createDemo();
  const before = app.getState().swatches.map((swatch) => swatch.hex);
  const after = app.generate().swatches.map((swatch) => swatch.hex);
  assert.equal(after[lockedIndex], before[lockedIndex]);
  assert.ok(after.some((hex, index) => index !== lockedIndex && hex !== before[index]));
});

test('only the demo query parameter starts the demo', () => {
  for (const search of ['?demo', '?demo=1', 'demo', '?lang=tr&demo']) assert.equal(isDemoRequest(search), true, search);
  for (const search of ['', '?', '?demonstration', '?x=demo']) assert.equal(isDemoRequest(search), false, search);
});
