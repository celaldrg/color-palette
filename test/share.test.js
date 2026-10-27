import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generatePalette } from '../src/harmony.js';
import { createRng } from '../src/rng.js';
import { decodePaletteHash, encodePaletteHash, shareUrl } from '../src/share.js';

test('encodes colors as dash-separated hex digits', () => {
  assert.equal(encodePaletteHash(['#264653', '#2A9D8F', '#e9c46a']), '264653-2a9d8f-e9c46a');
  assert.equal(encodePaletteHash(['#abc', 'def', '#123456']), 'aabbcc-ddeeff-123456');
});

test('decodes with or without the leading #', () => {
  const expected = ['#264653', '#2a9d8f', '#e9c46a'];
  assert.deepEqual(decodePaletteHash('#264653-2a9d8f-e9c46a'), expected);
  assert.deepEqual(decodePaletteHash('264653-2A9D8F-E9C46A'), expected);
  assert.deepEqual(decodePaletteHash('  #264653-2a9d8f-e9c46a  '), expected);
});

test('palettes of every size survive a round trip', () => {
  for (let count = 3; count <= 8; count += 1) {
    const colors = generatePalette({ base: '#3b82f6', mode: 'random', count, rng: createRng(count) });
    assert.deepEqual(decodePaletteHash(`#${encodePaletteHash(colors)}`), colors);
  }
});

test('rejects malformed hashes', () => {
  const nine = Array.from({ length: 9 }, () => 'aabbcc').join('-');
  const bad = [
    '',
    '#',
    'abc',
    '264653-2a9d8f',
    nine,
    'zzzzzz-2a9d8f-e9c46a',
    '26465-2a9d8f-e9c46a',
    'abc-def-123',
    '264653--2a9d8f-e9c46a',
    '264653-2a9d8f-e9c46a-',
    '#264653-#2a9d8f-#e9c46a',
    '264653,2a9d8f,e9c46a',
    null,
    undefined,
    42,
  ];
  for (const hash of bad) assert.equal(decodePaletteHash(hash), null, String(hash));
});

test('share links drop the query and old hash and carry the palette', () => {
  const colors = ['#264653', '#2a9d8f', '#e9c46a'];
  assert.equal(
    shareUrl('https://celaldrg.github.io/color-palette/?demo#aabbcc-ddeeff-001122', colors),
    'https://celaldrg.github.io/color-palette/#264653-2a9d8f-e9c46a',
  );
  assert.equal(shareUrl('http://127.0.0.1:8080/', colors), 'http://127.0.0.1:8080/#264653-2a9d8f-e9c46a');
  assert.deepEqual(decodePaletteHash(new URL(shareUrl('http://localhost/x/', colors)).hash), colors);
});
