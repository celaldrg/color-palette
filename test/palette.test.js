import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { hexToRgb, normalizeHue, rgbToOklab, rgbToOklch } from '../src/color.js';
import { HARMONY_MODES, HUE_OFFSETS } from '../src/harmony.js';
import {
  createPaletteApp,
  DEFAULT_COUNT,
  DEFAULT_MODE,
  HISTORY_LIMIT,
} from '../src/palette.js';
import { createRng } from '../src/rng.js';

const START = ['#264653', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51'];
const HEX = /^#[0-9a-f]{6}$/;
/** OKLab distance below which two colors are hard to tell apart. */
const JUST_NOTICEABLE = 0.02;

const hexes = (state) => state.swatches.map((swatch) => swatch.hex);
const ids = (state) => state.swatches.map((swatch) => swatch.id);
const locks = (state) => state.swatches.map((swatch) => swatch.locked);
const startApp = (options = {}) => createPaletteApp({ seed: 1, colors: START, ...options });

/** Builds a 3-color palette and grows it to 8 one swatch at a time, like pressing + five times. */
function grownColors(options) {
  const app = createPaletteApp({ ...options, count: 3 });
  for (let count = 4; count <= 8; count += 1) app.setCount(count);
  return hexes(app.getState());
}

/** Smallest OKLab distance between any two of the colors. */
function closestPair(colors) {
  const labs = colors.map((hex) => rgbToOklab(hexToRgb(hex)));
  let closest = Infinity;
  labs.forEach((a, i) =>
    labs.slice(i + 1).forEach((b) => {
      closest = Math.min(closest, Math.hypot(a.l - b.l, a.a - b.a, a.b - b.b));
    }),
  );
  return closest;
}

describe('creating the model', () => {
  test('defaults: five generated colors, random harmony, nothing locked', () => {
    const state = createPaletteApp({ seed: 1 }).getState();
    assert.equal(DEFAULT_COUNT, 5);
    assert.equal(DEFAULT_MODE, 'random');
    assert.equal(state.swatches.length, DEFAULT_COUNT);
    assert.ok(hexes(state).every((hex) => HEX.test(hex)));
    assert.equal(new Set(ids(state)).size, DEFAULT_COUNT);
    assert.deepEqual(locks(state), [false, false, false, false, false]);
    assert.equal(state.mode, 'random');
    assert.equal(state.baseColor, null);
    assert.equal(state.canUndo, false);
  });

  test('the same seed gives the same palettes, and rng overrides seed', () => {
    const first = createPaletteApp({ seed: 99 });
    const second = createPaletteApp({ seed: 99 });
    const third = createPaletteApp({ seed: 1, rng: createRng(99) });
    assert.deepEqual(first.getState(), second.getState());
    assert.deepEqual(first.getState(), third.getState());
    assert.deepEqual(first.generate(), second.generate());
    assert.notDeepEqual(hexes(createPaletteApp({ seed: 100 }).getState()), hexes(first.getState()));
  });

  test('options: size, mode, base color, starting colors and locks', () => {
    assert.equal(createPaletteApp({ seed: 1, count: 20 }).getState().swatches.length, 8);
    assert.equal(createPaletteApp({ seed: 1, count: 1 }).getState().swatches.length, 3);
    assert.equal(createPaletteApp({ seed: 1, mode: 'pentadic' }).getState().mode, 'random');
    const based = createPaletteApp({ seed: 1, mode: 'triadic', baseColor: 'rgb(255 0 0)' }).getState();
    assert.equal(based.baseColor, '#ff0000');
    assert.ok(hexes(based).includes('#ff0000'));
    const given = startApp({ locked: [1, 3] }).getState();
    assert.deepEqual(hexes(given), START);
    assert.deepEqual(locks(given), [false, true, false, true, false]);
    const invalid = createPaletteApp({ seed: 1, colors: ['#000000', 'nope', '#ffffff'] }).getState();
    assert.equal(invalid.swatches.length, DEFAULT_COUNT, 'invalid starting colors are ignored');
  });

  test('snapshots are frozen and only change when the state does', () => {
    const app = startApp();
    const state = app.getState();
    assert.ok(Object.isFrozen(state) && Object.isFrozen(state.swatches) && Object.isFrozen(state.swatches[0]));
    assert.throws(() => state.swatches.push({}), TypeError);
    assert.throws(() => {
      state.swatches[0].hex = '#000000';
    }, TypeError);
    assert.equal(app.getState(), state);
    assert.equal(app.toggleLock(99), state, 'a no-op returns the same snapshot');
    assert.notEqual(app.toggleLock(0), state);
  });
});

describe('generate', () => {
  test('replaces unlocked colors and keeps locked swatches and ids', () => {
    const app = startApp({ locked: [1] });
    const before = app.getState();
    const after = app.generate();
    assert.deepEqual(ids(after), ids(before));
    assert.equal(after.swatches[1].hex, START[1]);
    assert.ok(after.swatches[1].locked);
    assert.ok([0, 2, 3, 4].some((i) => after.swatches[i].hex !== START[i]));
    assert.ok(hexes(after).every((hex) => HEX.test(hex)));
    assert.equal(after.canUndo, true);
  });

  test('harmonizes with the first locked swatch', () => {
    const app = startApp({ locked: [2], mode: 'monochromatic' });
    const hue = rgbToOklch(hexToRgb(START[2])).h;
    for (let round = 0; round < 10; round += 1) {
      const state = app.generate();
      assert.equal(state.swatches[2].hex, START[2]);
      for (const hex of hexes(state)) {
        const color = rgbToOklch(hexToRgb(hex));
        if (color.c < 0.04) continue;
        const delta = normalizeHue(color.h - hue);
        assert.ok(Math.min(delta, 360 - delta) <= 3, `${hex} keeps the hue of ${START[2]}`);
      }
    }
  });

  test('harmonizes with an explicit base color', () => {
    const app = startApp();
    const state = app.setBaseColor('#ff0000');
    assert.equal(state.baseColor, '#ff0000');
    assert.ok(hexes(state).includes('#ff0000'));
    assert.ok(hexes(app.generate()).includes('#ff0000'));
  });

  test('is a no-op when every swatch is locked', () => {
    const app = startApp({ locked: [0, 1, 2, 3, 4] });
    const state = app.getState();
    assert.equal(app.generate(), state);
    assert.equal(state.canUndo, false);
  });
});

describe('editing', () => {
  test('toggleLock flips one swatch and ignores bad indexes', () => {
    const app = startApp();
    assert.deepEqual(locks(app.toggleLock(3)), [false, false, false, true, false]);
    assert.deepEqual(locks(app.toggleLock(3)), [false, false, false, false, false]);
    const state = app.getState();
    for (const index of [-1, 5, 1.5, '0', null]) assert.equal(app.toggleLock(index), state, String(index));
  });

  test('moveSwatch reorders swatches with their ids and locks', () => {
    const app = startApp({ locked: [0] });
    const before = app.getState();
    const after = app.moveSwatch(0, 3);
    assert.deepEqual(hexes(after), [START[1], START[2], START[3], START[0], START[4]]);
    assert.deepEqual(ids(after), [before.swatches[1].id, before.swatches[2].id, before.swatches[3].id, before.swatches[0].id, before.swatches[4].id]);
    assert.deepEqual(locks(after), [false, false, false, true, false]);
    assert.deepEqual(hexes(app.moveSwatch(4, 0)), [START[4], START[1], START[2], START[3], START[0]]);
    for (const [from, to] of [
      [1, 1],
      [-1, 2],
      [0, 5],
      [0.5, 1],
    ]) {
      assert.equal(app.moveSwatch(from, to), app.getState());
    }
  });

  test('setColor accepts every notation and ignores invalid input', () => {
    const app = startApp();
    const id = app.getState().swatches[0].id;
    const cases = [
      ['rgb(255 0 0)', '#ff0000'],
      ['hsl(120 100% 50%)', '#00ff00'],
      ['hsv(240 100% 100%)', '#0000ff'],
      ['oklch(1 0 0)', '#ffffff'],
      ['rebeccapurple', '#663399'],
      ['#ABC', '#aabbcc'],
    ];
    for (const [input, expected] of cases) {
      const state = app.setColor(0, input);
      assert.equal(state.swatches[0].hex, expected, input);
      assert.equal(state.swatches[0].id, id);
    }
    const state = app.getState();
    for (const input of ['nope', '', 'rgb(300 0 0)', null]) assert.equal(app.setColor(0, input), state, String(input));
    assert.equal(app.setColor(9, '#000000'), state);
    assert.equal(app.setColor(0, '#aabbcc'), state, 'the same color is a no-op');
  });

  test('locked swatches can still be edited by hand', () => {
    const app = startApp({ locked: [0] });
    const state = app.setColor(0, '#000000');
    assert.equal(state.swatches[0].hex, '#000000');
    assert.equal(state.swatches[0].locked, true);
  });

  test('setMode and setBaseColor regenerate; repeats and invalid values are no-ops', () => {
    const app = startApp();
    const triadic = app.setMode('triadic');
    assert.equal(triadic.mode, 'triadic');
    assert.notDeepEqual(hexes(triadic), START);
    assert.equal(app.setMode('triadic'), triadic);
    assert.equal(app.setMode('pentadic'), triadic);
    const based = app.setBaseColor('  hsl(0 100% 50%) ');
    assert.equal(based.baseColor, '#ff0000');
    assert.equal(app.setBaseColor('#f00'), based);
    assert.equal(app.setBaseColor('not a color'), based);
    const cleared = app.setBaseColor('');
    assert.equal(cleared.baseColor, null);
    assert.equal(app.setBaseColor(null), cleared);
    assert.equal(app.setBaseColor('   '), cleared);
  });
});

describe('palette size', () => {
  test('growing adds swatches with new ids and keeps the existing ones', () => {
    const app = startApp();
    const before = app.getState();
    const after = app.setCount(8);
    assert.equal(after.swatches.length, 8);
    assert.deepEqual(after.swatches.slice(0, 5), [...before.swatches]);
    assert.equal(new Set(ids(after)).size, 8);
    assert.ok(hexes(after).every((hex) => HEX.test(hex)));
  });

  test('growing one swatch at a time never repeats or nearly repeats a color', () => {
    for (const baseColor of [null, '#3b82f6']) {
      for (const mode of HARMONY_MODES) {
        for (let seed = 1; seed <= 40; seed += 1) {
          const colors = grownColors({ seed, mode, baseColor });
          const label = `${mode}, base ${baseColor}, seed ${seed}: ${colors.join(' ')}`;
          assert.equal(new Set(colors).size, 8, label);
          assert.ok(closestPair(colors) >= JUST_NOTICEABLE, label);
        }
      }
    }
  });

  test('growing keeps to the hues of the harmony', () => {
    const baseColor = '#3b82f6';
    const baseHue = rgbToOklch(hexToRgb(baseColor)).h;
    for (const [mode, offsets] of Object.entries(HUE_OFFSETS)) {
      for (let seed = 1; seed <= 20; seed += 1) {
        for (const hex of grownColors({ seed, mode, baseColor })) {
          const color = rgbToOklch(hexToRgb(hex));
          if (color.c < 0.04) continue;
          const onHarmony = offsets.some((offset) => {
            const delta = normalizeHue(color.h - baseHue - offset);
            return Math.min(delta, 360 - delta) <= 3;
          });
          assert.ok(onHarmony, `${mode}, seed ${seed}: ${hex}`);
        }
      }
    }
  });

  test('shrinking removes unlocked swatches from the end first', () => {
    const app = startApp({ locked: [3, 4] });
    const after = app.setCount(3);
    assert.deepEqual(hexes(after), [START[0], START[3], START[4]]);
    const allLocked = startApp({ locked: [0, 1, 2, 3, 4] }).setCount(3);
    assert.deepEqual(hexes(allLocked), START.slice(0, 3));
  });

  test('clamps to 3-8, accepts numeric strings and ignores junk', () => {
    const app = startApp();
    assert.equal(app.setCount(20).swatches.length, 8);
    assert.equal(app.setCount(0).swatches.length, 3);
    assert.equal(app.setCount('6').swatches.length, 6);
    const state = app.getState();
    for (const value of ['abc', '', ' ', null, Number.NaN, Infinity, undefined, 6]) {
      assert.equal(app.setCount(value), state, String(value));
    }
  });
});

describe('loading palettes', () => {
  test('replaces every swatch with fresh, unlocked ones', () => {
    const app = startApp({ locked: [0] });
    const before = app.getState();
    const after = app.loadPalette(['#000', 'white', 'rgb(255 0 0)', 'hsl(240 100% 50%)']);
    assert.deepEqual(hexes(after), ['#000000', '#ffffff', '#ff0000', '#0000ff']);
    assert.deepEqual(locks(after), [false, false, false, false]);
    assert.ok(ids(after).every((id) => !ids(before).includes(id)));
  });

  test('ignores invalid palettes', () => {
    const app = startApp();
    const state = app.getState();
    const nine = Array.from({ length: 9 }, () => '#000000');
    for (const colors of [['#000000', '#ffffff'], nine, ['#000000', '#ffffff', 'nope'], 'abc', null]) {
      assert.equal(app.loadPalette(colors), state, String(colors));
    }
  });
});

describe('undo', () => {
  test('steps back through changes', () => {
    const app = startApp();
    const states = [app.getState()];
    states.push(app.toggleLock(1));
    states.push(app.generate());
    states.push(app.moveSwatch(0, 2));
    states.push(app.setMode('tetradic'));
    states.push(app.setCount(7));
    states.push(app.loadPalette(START));
    for (let i = states.length - 2; i >= 0; i -= 1) {
      const state = app.undo();
      assert.deepEqual(state.swatches, states[i].swatches);
      assert.equal(state.mode, states[i].mode);
      assert.equal(state.canUndo, i > 0);
    }
    assert.equal(app.undo(), app.getState(), 'nothing left to undo');
  });

  test('consecutive edits of one swatch merge into one step', () => {
    const app = startApp();
    app.setColor(0, '#100000');
    app.setColor(0, '#200000');
    app.setColor(0, '#300000');
    assert.equal(app.undo().swatches[0].hex, START[0]);
    assert.equal(app.getState().canUndo, false);
  });

  test('edits of different swatches, or with other changes between, stay separate', () => {
    const app = startApp();
    app.setColor(0, '#100000');
    app.setColor(1, '#200000');
    app.toggleLock(4);
    app.setColor(1, '#300000');
    assert.equal(app.undo().swatches[1].hex, '#200000');
    assert.equal(app.undo().swatches[4].locked, false);
    assert.equal(app.undo().swatches[1].hex, START[1]);
    assert.equal(app.undo().swatches[0].hex, START[0]);
    assert.equal(app.getState().canUndo, false);
  });

  test('an edit after undo starts a new step', () => {
    const app = startApp();
    app.setColor(0, '#100000');
    app.undo();
    app.setColor(0, '#200000');
    assert.equal(app.undo().swatches[0].hex, START[0]);
  });

  test(`keeps the last ${HISTORY_LIMIT} steps`, () => {
    const app = startApp();
    for (let i = 0; i < HISTORY_LIMIT + 50; i += 1) app.toggleLock(0);
    let steps = 0;
    while (app.getState().canUndo) {
      app.undo();
      steps += 1;
    }
    assert.equal(steps, HISTORY_LIMIT);
  });
});
