import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NAMED_COLORS, namedColorHex, nearestColorName } from '../src/names.js';

test('the table holds the 148 CSS named colors', () => {
  assert.equal(NAMED_COLORS.length, 148);
  assert.equal(new Set(NAMED_COLORS.map((color) => color.css)).size, 148, 'keywords are unique');
  for (const { name, css, hex } of NAMED_COLORS) {
    assert.match(hex, /^#[0-9a-f]{6}$/);
    assert.match(css, /^[a-z]+$/);
    assert.match(name, /^[A-Z][a-z]*( [A-Z][a-z]*)*$/, 'display names are Title Case');
    assert.equal(name.replace(/ /g, '').toLowerCase(), css);
  }
  const sorted = [...NAMED_COLORS.map((color) => color.css)].sort();
  assert.deepEqual(
    NAMED_COLORS.map((color) => color.css),
    sorted,
    'alphabetical',
  );
  assert.ok(Object.isFrozen(NAMED_COLORS) && Object.isFrozen(NAMED_COLORS[0]));
});

test('namedColorHex looks up keywords ignoring case and spaces', () => {
  assert.equal(namedColorHex('red'), '#ff0000');
  assert.equal(namedColorHex('RebeccaPurple'), '#663399');
  assert.equal(namedColorHex('dark slate blue'), '#483d8b');
  assert.equal(namedColorHex('grey'), '#808080');
  assert.equal(namedColorHex('gray'), '#808080');
  for (const value of ['notacolor', '', 'transparent', 'constructor', '__proto__', null, undefined, 5]) {
    assert.equal(namedColorHex(value), null, String(value));
  }
});

test('nearestColorName finds exact matches with distance 0', () => {
  for (const { hex } of NAMED_COLORS) {
    const nearest = nearestColorName(hex);
    assert.equal(nearest.hex, hex);
    assert.equal(nearest.distance, 0);
  }
});

test('ties go to the alphabetically first name', () => {
  assert.equal(nearestColorName('#808080').name, 'Gray');
  assert.equal(nearestColorName('#00ffff').name, 'Aqua');
  assert.equal(nearestColorName('#ff00ff').name, 'Fuchsia');
});

test('nearestColorName finds the closest name for other colors', () => {
  const near = nearestColorName('#fe0101');
  assert.deepEqual([near.name, near.css, near.hex], ['Red', 'red', '#ff0000']);
  assert.ok(near.distance > 0 && near.distance < 0.01);
  assert.equal(nearestColorName('#3b82f6').name, 'Dodger Blue');
  assert.equal(nearestColorName({ r: 244, g: 162, b: 97 }).name, 'Sandy Brown');
  assert.equal(nearestColorName('#010101').name, 'Black');
});
