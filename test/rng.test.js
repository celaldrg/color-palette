import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng, randomBetween, randomSeed } from '../src/rng.js';

const take = (rng, count) => Array.from({ length: count }, () => rng());

test('the same seed gives the same sequence, another seed another one', () => {
  assert.deepEqual(take(createRng(42), 20), take(createRng(42), 20));
  assert.notDeepEqual(take(createRng(42), 20), take(createRng(43), 20));
  assert.deepEqual(take(createRng(1), 5), take(createRng(2 ** 32 + 1), 5), 'only the low 32 bits count');
  assert.deepEqual(take(createRng(-1), 5), take(createRng(2 ** 32 - 1), 5));
});

test('values are uniform-looking floats in [0, 1)', () => {
  const values = take(createRng(7), 20000);
  assert.ok(values.every((value) => value >= 0 && value < 1));
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  assert.ok(Math.abs(mean - 0.5) < 0.01, `mean ${mean}`);
  const buckets = new Array(10).fill(0);
  for (const value of values) buckets[Math.floor(value * 10)] += 1;
  assert.ok(buckets.every((count) => count > 1800 && count < 2200), `buckets ${buckets}`);
});

test('randomBetween stays in range', () => {
  const rng = createRng(9);
  for (let i = 0; i < 1000; i += 1) {
    const value = randomBetween(rng, -5, 15);
    assert.ok(value >= -5 && value < 15);
  }
});

test('randomSeed returns a 32-bit unsigned integer', () => {
  for (let i = 0; i < 100; i += 1) {
    const seed = randomSeed();
    assert.ok(Number.isInteger(seed) && seed >= 0 && seed < 2 ** 32);
  }
});
