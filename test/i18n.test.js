import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HARMONY_MODES } from '../src/harmony.js';
import { LANGUAGES, normalizeLanguage, otherLanguage, STRINGS, translate } from '../src/i18n.js';

const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

test('English and Turkish have the same keys, placeholders and no empty strings', () => {
  assert.deepEqual(LANGUAGES, ['en', 'tr']);
  assert.deepEqual(Object.keys(STRINGS.tr).sort(), Object.keys(STRINGS.en).sort());
  for (const key of Object.keys(STRINGS.en)) {
    for (const language of LANGUAGES) {
      const text = STRINGS[language][key];
      assert.equal(typeof text, 'string');
      assert.notEqual(text.trim(), '', `${language} ${key}`);
    }
    assert.deepEqual(placeholders(STRINGS.tr[key]), placeholders(STRINGS.en[key]), key);
  }
  assert.ok(Object.isFrozen(STRINGS) && Object.isFrozen(STRINGS.en) && Object.isFrozen(STRINGS.tr));
});

test('every harmony mode has a label', () => {
  for (const mode of HARMONY_MODES) {
    assert.notEqual(translate('en', `harmony.${mode}`), `harmony.${mode}`);
    assert.notEqual(translate('tr', `harmony.${mode}`), translate('en', `harmony.${mode}`));
  }
});

test('translate fills placeholders', () => {
  assert.equal(translate('en', 'action.generate'), 'Generate');
  assert.equal(translate('tr', 'action.generate'), 'Oluştur');
  assert.equal(translate('en', 'swatch.label', { index: 2, name: 'Coral' }), 'Color 2: Coral');
  assert.equal(translate('tr', 'swatch.label', { index: 2, name: 'Coral' }), '2. renk: Coral');
  assert.equal(translate('en', 'swatch.label', { index: 1 }), 'Color 1: {name}', 'missing values stay visible');
  assert.equal(translate('en', 'swatch.label', { index: '$&', name: '$1' }), 'Color $&: $1', 'no replacement patterns');
});

test('translate falls back to English, then to the key', () => {
  assert.equal(translate('de', 'action.undo'), 'Undo');
  assert.equal(translate(undefined, 'action.undo'), 'Undo');
  for (const key of ['no.such.key', 'toString', 'constructor', '__proto__']) {
    assert.equal(translate('tr', key), key);
  }
});

test('language helpers', () => {
  assert.equal(normalizeLanguage('tr'), 'tr');
  assert.equal(normalizeLanguage('en'), 'en');
  for (const value of ['de', 'TR', '', null, undefined, 1]) assert.equal(normalizeLanguage(value), 'en', String(value));
  assert.equal(otherLanguage('en'), 'tr');
  assert.equal(otherLanguage('tr'), 'en');
  assert.equal(otherLanguage('xx'), 'tr');
});
