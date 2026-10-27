import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStorage, storage } from '../src/storage.js';

function memoryBackend() {
  const data = new Map();
  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
  };
}

function throwingBackend() {
  const fail = () => {
    throw new Error('QuotaExceededError');
  };
  return { getItem: fail, setItem: fail };
}

test('stores strings under a prefixed key', () => {
  const backend = memoryBackend();
  const store = createStorage(() => backend);
  assert.equal(store.setItem('lang', 'tr'), true);
  assert.equal(backend.data.get('color-palette:lang'), 'tr');
  assert.equal(store.getItem('lang'), 'tr');
  assert.equal(store.getItem('missing'), null);
  assert.equal(store.getItem('missing', 'en'), 'en');
});

test('stores JSON and falls back on missing or corrupt data', () => {
  const backend = memoryBackend();
  const store = createStorage(() => backend);
  const saved = [{ id: '264653-2a9d8f-e9c46a', savedAt: 1 }];
  assert.equal(store.setJson('saved', saved), true);
  assert.deepEqual(store.getJson('saved'), saved);
  assert.deepEqual(store.getJson('missing', []), []);
  backend.data.set('color-palette:broken', '{not json');
  assert.deepEqual(store.getJson('broken', []), []);
  const circular = {};
  circular.self = circular;
  assert.equal(store.setJson('circular', circular), false);
});

test('never throws when storage is blocked, full or missing', () => {
  const blocked = () => {
    throw new Error('SecurityError');
  };
  for (const getBackend of [() => throwingBackend(), blocked, () => null, () => undefined]) {
    const store = createStorage(getBackend);
    assert.equal(store.getItem('lang', 'en'), 'en');
    assert.equal(store.setItem('lang', 'tr'), false);
    assert.deepEqual(store.getJson('saved', []), []);
    assert.equal(store.setJson('saved', []), false);
  }
});

test('the default wrapper is safe to use outside a browser', () => {
  assert.equal(storage.getItem('test-key-that-is-never-written', 'fallback'), 'fallback');
  assert.deepEqual(storage.getJson('test-key-that-is-never-written', []), []);
});
