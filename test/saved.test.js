import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addSavedPalette, MAX_SAVED, removeSavedPalette, sanitizeSavedPalettes } from '../src/saved.js';

const A = ['#264653', '#2a9d8f', '#e9c46a'];
const B = ['#000000', '#808080', '#ffffff', '#ff0000'];

function distinctPalette(index) {
  const digits = index.toString(16).padStart(6, '0');
  return [`#${digits}`, '#ffffff', '#000000'];
}

test('adds palettes newest first with the share hash as id', () => {
  let list = addSavedPalette([], A, 1000);
  list = addSavedPalette(list, ['#000', '#808080', '#FFFFFF', 'ff0000'], 2000);
  assert.deepEqual(list, [
    { id: '000000-808080-ffffff-ff0000', colors: B, savedAt: 2000 },
    { id: '264653-2a9d8f-e9c46a', colors: A, savedAt: 1000 },
  ]);
});

test('saving a palette again moves it to the front without a duplicate', () => {
  const list = Object.freeze([
    { id: '000000-808080-ffffff-ff0000', colors: B, savedAt: 2000 },
    { id: '264653-2a9d8f-e9c46a', colors: A, savedAt: 1000 },
  ]);
  const next = addSavedPalette(list, A, 3000);
  assert.deepEqual(
    next.map((item) => [item.id, item.savedAt]),
    [
      ['264653-2a9d8f-e9c46a', 3000],
      ['000000-808080-ffffff-ff0000', 2000],
    ],
  );
  assert.equal(list.length, 2, 'the input list is not changed');
});

test('keeps at most MAX_SAVED palettes, dropping the oldest', () => {
  let list = [];
  for (let i = 0; i < MAX_SAVED + 6; i += 1) list = addSavedPalette(list, distinctPalette(i), i);
  assert.equal(MAX_SAVED, 24);
  assert.equal(list.length, MAX_SAVED);
  assert.equal(list[0].savedAt, MAX_SAVED + 5);
  assert.equal(list.at(-1).savedAt, 6);
});

test('removes a palette by id', () => {
  const list = [addSavedPalette([], A, 1)[0], addSavedPalette([], B, 2)[0]];
  assert.deepEqual(removeSavedPalette(list, '264653-2a9d8f-e9c46a'), [list[1]]);
  assert.deepEqual(removeSavedPalette(list, 'nope'), list);
});

test('sanitizes whatever storage returns', () => {
  for (const value of [null, undefined, 'text', 42, {}, { id: 'x' }]) {
    assert.deepEqual(sanitizeSavedPalettes(value), [], String(value));
  }
  const cleaned = sanitizeSavedPalettes([
    null,
    'text',
    {},
    { id: 123 },
    { id: 'nope' },
    { id: '264653-2A9D8F-E9C46A', colors: ['#bad'], savedAt: 5 },
    { id: '264653-2a9d8f-e9c46a', savedAt: 6 },
    { id: '000000-808080-ffffff-ff0000', savedAt: 'yesterday' },
  ]);
  assert.deepEqual(cleaned, [
    { id: '264653-2a9d8f-e9c46a', colors: A, savedAt: 5 },
    { id: '000000-808080-ffffff-ff0000', colors: B, savedAt: 0 },
  ]);
});

test('a saved list survives a JSON round trip and is capped', () => {
  let list = [];
  for (let i = 0; i < 5; i += 1) list = addSavedPalette(list, distinctPalette(i), i * 10);
  assert.deepEqual(sanitizeSavedPalettes(JSON.parse(JSON.stringify(list))), list);
  const long = Array.from({ length: 40 }, (_, i) => addSavedPalette([], distinctPalette(i), i)[0]);
  assert.equal(sanitizeSavedPalettes(long).length, MAX_SAVED);
});
