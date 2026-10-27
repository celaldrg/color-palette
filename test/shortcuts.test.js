import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activatesOnSpace, isTypingTarget, shortcutFor } from '../src/shortcuts.js';

test('Space generates, Ctrl+Z and Cmd+Z undo, Escape closes', () => {
  assert.equal(shortcutFor({ key: ' ' }), 'generate');
  assert.equal(shortcutFor({ key: ' ', shiftKey: true }), 'generate');
  assert.equal(shortcutFor({ key: 'z', ctrlKey: true }), 'undo');
  assert.equal(shortcutFor({ key: 'Z', metaKey: true }), 'undo');
  assert.equal(shortcutFor({ key: 'Escape' }), 'close');
});

test('held keys, modifiers and other keys do nothing', () => {
  assert.equal(shortcutFor({ key: ' ', repeat: true }), null);
  assert.equal(shortcutFor({ key: ' ', ctrlKey: true }), null);
  assert.equal(shortcutFor({ key: ' ', altKey: true }), null);
  assert.equal(shortcutFor({ key: 'z' }), null);
  assert.equal(shortcutFor({ key: 'z', ctrlKey: true, shiftKey: true }), null);
  assert.equal(shortcutFor({ key: 'z', ctrlKey: true, altKey: true }), null);
  assert.equal(shortcutFor({ key: 'Enter' }), null);
  assert.equal(shortcutFor({ key: 'z', ctrlKey: true, repeat: true }), 'undo', 'holding Ctrl+Z keeps undoing');
});

test('text fields keep Space and Ctrl+Z; a modal dialog keeps every key', () => {
  assert.equal(shortcutFor({ key: ' ', typing: true }), null);
  assert.equal(shortcutFor({ key: 'z', ctrlKey: true, typing: true }), null);
  assert.equal(shortcutFor({ key: 'Escape', typing: true }), 'close');
  for (const key of [' ', 'Escape', 'z']) assert.equal(shortcutFor({ key, ctrlKey: key === 'z', modal: true }), null);
});

test('typing targets are text inputs, textareas, selects and editable content', () => {
  assert.equal(isTypingTarget({ tagName: 'INPUT', type: 'text' }), true);
  assert.equal(isTypingTarget({ tagName: 'INPUT' }), true);
  assert.equal(isTypingTarget({ tagName: 'INPUT', type: 'search' }), true);
  assert.equal(isTypingTarget({ tagName: 'TEXTAREA' }), true);
  assert.equal(isTypingTarget({ tagName: 'SELECT' }), true);
  assert.equal(isTypingTarget({ tagName: 'DIV', isContentEditable: true }), true);
  assert.equal(isTypingTarget({ tagName: 'INPUT', type: 'range' }), false);
  assert.equal(isTypingTarget({ tagName: 'INPUT', type: 'checkbox' }), false);
  assert.equal(isTypingTarget({ tagName: 'BUTTON' }), false);
  assert.equal(isTypingTarget({ tagName: 'BODY' }), false);
  assert.equal(isTypingTarget(null), false);
});

test('Space presses a button reached with the keyboard; other shortcuts still work there', () => {
  assert.equal(shortcutFor({ key: ' ', activating: true }), null);
  assert.equal(shortcutFor({ key: 'z', ctrlKey: true, activating: true }), 'undo');
  assert.equal(shortcutFor({ key: 'Escape', activating: true }), 'close');
  assert.equal(shortcutFor({ key: ' ', activating: false }), 'generate', 'a button focused by a click does not take Space');
});

test('buttons, summaries, checkboxes and radio buttons are pressed by Space', () => {
  assert.equal(activatesOnSpace({ tagName: 'BUTTON' }), true);
  assert.equal(activatesOnSpace({ tagName: 'SUMMARY' }), true);
  assert.equal(activatesOnSpace({ tagName: 'INPUT', type: 'checkbox' }), true);
  assert.equal(activatesOnSpace({ tagName: 'INPUT', type: 'RADIO' }), true);
  assert.equal(activatesOnSpace({ tagName: 'INPUT', type: 'range' }), false);
  assert.equal(activatesOnSpace({ tagName: 'INPUT', type: 'text' }), false);
  assert.equal(activatesOnSpace({ tagName: 'INPUT' }), false);
  assert.equal(activatesOnSpace({ tagName: 'A' }), false);
  assert.equal(activatesOnSpace({ tagName: 'DIV' }), false);
  assert.equal(activatesOnSpace(null), false);
});
