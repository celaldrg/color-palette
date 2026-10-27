/**
 * Keyboard shortcuts: maps a key press to an app action. Pure, no DOM; the
 * browser event is described by plain fields so it can be tested in Node.
 * @module shortcuts
 */

/** Input types that do not take typed text, so shortcuts still apply in them. */
const NON_TEXT_INPUTS = new Set(['button', 'checkbox', 'color', 'file', 'image', 'radio', 'range', 'reset', 'submit']);
/** Input types that Space activates, like a button. */
const SPACE_INPUTS = new Set(['button', 'checkbox', 'image', 'radio', 'reset', 'submit']);

/**
 * @typedef {object} KeyPress
 * @property {string} key KeyboardEvent.key
 * @property {boolean} [ctrlKey]
 * @property {boolean} [metaKey]
 * @property {boolean} [altKey]
 * @property {boolean} [shiftKey]
 * @property {boolean} [repeat] the key is held down
 * @property {boolean} [typing] focus is in a text field or select, which keeps its own keys
 * @property {boolean} [activating] focus is on a button (or similar control) that the
 *   user reached with the keyboard, so Space must press it instead of generating
 * @property {boolean} [modal] a modal dialog is open and handles its own keys
 */

/**
 * The app action for a key press: Space generates (not on auto-repeat and not
 * when it presses a keyboard-focused button), Ctrl/Cmd+Z undoes, Escape closes
 * the open panel.
 * @param {KeyPress} press
 * @returns {'generate'|'undo'|'close'|null} null leaves the key to the browser
 */
export function shortcutFor(press) {
  if (press.modal) return null;
  if (press.key === 'Escape') return 'close';
  if (press.typing) return null;
  const command = Boolean(press.ctrlKey || press.metaKey);
  if (command && !press.altKey && !press.shiftKey && press.key.toLowerCase() === 'z') return 'undo';
  if (press.key === ' ' && !command && !press.altKey && !press.repeat && !press.activating) return 'generate';
  return null;
}

/**
 * Tells whether an element takes typed text (text inputs, textareas, selects and
 * editable content), where Space and Ctrl+Z must keep their usual meaning.
 * @param {{ tagName?: string, type?: string, isContentEditable?: boolean }|null} target
 * @returns {boolean}
 */
export function isTypingTarget(target) {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = String(target.tagName ?? '').toLowerCase();
  if (tag === 'textarea' || tag === 'select') return true;
  return tag === 'input' && !NON_TEXT_INPUTS.has(String(target.type ?? 'text').toLowerCase());
}

/**
 * Tells whether Space presses an element: buttons, summaries, checkboxes and
 * radio buttons.
 * @param {{ tagName?: string, type?: string }|null} target
 * @returns {boolean}
 */
export function activatesOnSpace(target) {
  if (!target) return false;
  const tag = String(target.tagName ?? '').toLowerCase();
  if (tag === 'button' || tag === 'summary') return true;
  return tag === 'input' && SPACE_INPUTS.has(String(target.type ?? '').toLowerCase());
}
