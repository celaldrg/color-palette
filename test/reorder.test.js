import { test } from 'node:test';
import assert from 'node:assert/strict';
import { displacement, dropIndex, keyboardTarget } from '../src/reorder.js';

const CENTERS = [50, 150, 250, 350, 450];

test('a dragged item stays put until its center passes a neighbour', () => {
  assert.equal(dropIndex(CENTERS, 2, 250), 2);
  assert.equal(dropIndex(CENTERS, 2, 349), 2);
  assert.equal(dropIndex(CENTERS, 2, 351), 3);
  assert.equal(dropIndex(CENTERS, 2, 151), 2);
  assert.equal(dropIndex(CENTERS, 2, 149), 1);
});

test('dragging far lands at the ends', () => {
  assert.equal(dropIndex(CENTERS, 0, 10_000), 4);
  assert.equal(dropIndex(CENTERS, 4, -10_000), 0);
  assert.equal(dropIndex(CENTERS, 1, 451), 4);
  assert.equal(dropIndex(CENTERS, 3, 49), 0);
});

test('neighbours shift one slot to make room, the rest stay', () => {
  const shifts = (from, to) => CENTERS.map((_, index) => displacement(index, from, to));
  assert.deepEqual(shifts(1, 3), [0, 0, -1, -1, 0]);
  assert.deepEqual(shifts(3, 0), [1, 1, 1, 0, 0]);
  assert.deepEqual(shifts(2, 2), [0, 0, 0, 0, 0]);
});

test('shifting by the displacements gives the same order as moving the item', () => {
  for (let from = 0; from < CENTERS.length; from += 1) {
    for (let to = 0; to < CENTERS.length; to += 1) {
      const slots = CENTERS.map((_, index) => (index === from ? to : index + displacement(index, from, to)));
      assert.deepEqual([...slots].sort((a, b) => a - b), [0, 1, 2, 3, 4], `${from} -> ${to}`);
    }
  }
});

test('arrow keys, Home and End move an item within bounds', () => {
  assert.equal(keyboardTarget('ArrowLeft', 2, 5), 1);
  assert.equal(keyboardTarget('ArrowUp', 2, 5), 1);
  assert.equal(keyboardTarget('ArrowRight', 2, 5), 3);
  assert.equal(keyboardTarget('ArrowDown', 2, 5), 3);
  assert.equal(keyboardTarget('Home', 2, 5), 0);
  assert.equal(keyboardTarget('End', 2, 5), 4);
  assert.equal(keyboardTarget('ArrowLeft', 0, 5), null);
  assert.equal(keyboardTarget('ArrowRight', 4, 5), null);
  assert.equal(keyboardTarget('Home', 0, 5), null);
  assert.equal(keyboardTarget('Enter', 2, 5), null);
  assert.equal(keyboardTarget('toString', 2, 5), null);
});
