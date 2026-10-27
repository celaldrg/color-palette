/**
 * The swatch strip: one full-height swatch per color with its HEX, nearest
 * CSS color keyword and tools (lock, shades, copy, drag handle). Swatches reorder by
 * dragging with pointer events (mouse, touch and pen) or by the arrow keys,
 * Home and End on the drag handle.
 * @module swatches-view
 */
import { clamp } from './color.js';
import { el, icon, paint, setIcon, setLabel, setText, syncChildren } from './dom.js';
import { nearestColorName } from './names.js';
import { displacement, dropIndex, keyboardTarget } from './reorder.js';

/** Pointer travel in px before a press on a swatch turns into a drag. */
const DRAG_THRESHOLD = 6;
/** The click that follows a drag is ignored for this long, in ms. */
const CLICK_GUARD_MS = 300;

/**
 * @typedef {(key: string, params?: Record<string, string|number>) => string} Translate
 */

/**
 * @typedef {object} SwatchActions
 * @property {(index: number) => void} edit opens the picker
 * @property {(index: number) => void} toggleLock
 * @property {(index: number) => void} shades opens the shade scale
 * @property {(index: number) => void} copy copies the HEX code
 * @property {(from: number, to: number) => void} move
 */

/**
 * Wires up the swatch list.
 * @param {HTMLOListElement} list
 * @param {SwatchActions} actions
 * @returns {{ update: (swatches: readonly import('./palette.js').Swatch[], selectedId: number|null, t: Translate) => void }}
 */
export function createSwatchesView(list, actions) {
  /** The press or drag in progress, or null. */
  let drag = null;
  let ignoreClicksUntil = 0;

  list.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button || button.dataset.action === 'grip' || performance.now() < ignoreClicksUntil) return;
    actions[button.dataset.action](indexOf(button));
  });
  list.addEventListener('keydown', moveByKey);
  list.addEventListener('pointerdown', pressSwatch);
  list.addEventListener('pointermove', followPointer);
  list.addEventListener('pointerup', dropSwatch);
  list.addEventListener('pointercancel', () => endDrag());
  list.addEventListener('lostpointercapture', () => endDrag());

  function indexOf(node) {
    return [...list.children].indexOf(node.closest('.swatch'));
  }

  function pressSwatch(event) {
    const handle = event.target.closest('.swatch-face, .tool-grip');
    if (drag || !handle || !event.isPrimary || event.button !== 0) return;
    drag = { pointerId: event.pointerId, item: handle.closest('.swatch'), x: event.clientX, y: event.clientY, active: false };
  }

  function followPointer(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (!drag.active) {
      if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < DRAG_THRESHOLD) return;
      startDrag();
    }
    const { centers, from, items, vertical } = drag;
    const travel = vertical ? event.clientY - drag.y : event.clientX - drag.x;
    const offset = clamp(travel, centers[0] - centers[from], centers.at(-1) - centers[from]);
    drag.to = dropIndex(centers, from, centers[from] + offset);
    items.forEach((item, index) => {
      const shift = index === from ? offset : slotShift(centers, index, displacement(index, from, drag.to));
      item.style.transform = shift ? `translate${vertical ? 'Y' : 'X'}(${shift}px)` : '';
    });
  }

  function startDrag() {
    const items = [...list.children];
    const vertical = getComputedStyle(list).flexDirection.startsWith('column');
    const centers = items.map((item) => {
      const rect = item.getBoundingClientRect();
      return vertical ? rect.top + rect.height / 2 : rect.left + rect.width / 2;
    });
    const from = items.indexOf(drag.item);
    Object.assign(drag, { active: true, items, vertical, centers, from, to: from });
    list.setPointerCapture(drag.pointerId);
    list.classList.add('is-sorting');
    drag.item.classList.add('is-dragging');
  }

  function dropSwatch(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const { active, from, to } = drag;
    endDrag();
    if (!active) return;
    ignoreClicksUntil = performance.now() + CLICK_GUARD_MS;
    if (to !== from) actions.move(from, to);
  }

  /** Ends a press or drag; the swatches snap back without animating. */
  function endDrag() {
    const ending = drag;
    drag = null;
    if (!ending?.active) return;
    list.classList.add('no-anim');
    ending.items.forEach((item) => item.style.removeProperty('transform'));
    ending.item.classList.remove('is-dragging');
    list.classList.remove('is-sorting');
    list.getBoundingClientRect(); // apply the reset now, while transitions are off
    requestAnimationFrame(() => list.classList.remove('no-anim'));
    if (list.hasPointerCapture(ending.pointerId)) list.releasePointerCapture(ending.pointerId);
  }

  function moveByKey(event) {
    const grip = event.target.closest('.tool-grip');
    if (!grip || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const from = indexOf(grip);
    const to = keyboardTarget(event.key, from, list.children.length);
    if (to === null) return;
    event.preventDefault();
    const key = grip.closest('.swatch').dataset.key;
    actions.move(from, to);
    [...list.children].find((item) => item.dataset.key === key)?.querySelector('.tool-grip').focus();
  }

  return {
    update(swatches, selectedId, t) {
      endDrag();
      syncChildren(list, swatches, {
        key: (swatch) => String(swatch.id),
        create: createSwatch,
        update: (node, swatch, index) => updateSwatch(node, swatch, index, swatch.id === selectedId, t),
      });
    },
  };
}

/** Distance to the neighbouring slot an item moves into: step is -1, 0 or 1. */
function slotShift(centers, index, step) {
  return step === 0 ? 0 : centers[index + step] - centers[index];
}

function createSwatch() {
  const tool = (action, iconName, className) =>
    el('button', { class: `tool ${className}`, type: 'button', 'data-action': action }, icon(iconName));
  return el(
    'li',
    { class: 'swatch' },
    el(
      'button',
      { class: 'swatch-face', type: 'button', 'data-action': 'edit' },
      el('span', { class: 'swatch-hex' }),
      el('span', { class: 'swatch-name' }),
    ),
    el(
      'div',
      { class: 'swatch-tools', role: 'group' },
      tool('toggleLock', 'unlock', 'tool-lock'),
      tool('shades', 'shades', 'tool-shades'),
      tool('copy', 'copy', 'tool-copy'),
      tool('grip', 'grip', 'tool-grip'),
    ),
  );
}

function updateSwatch(node, swatch, index, selected, t) {
  const hex = swatch.hex.toUpperCase();
  const name = nearestColorName(swatch.hex).css;
  const [face, tools] = node.children;
  const [lock, shades, copy, grip] = tools.children;
  paint(node, swatch.hex);
  node.classList.toggle('is-locked', swatch.locked);
  node.classList.toggle('is-selected', selected);
  setText(face.firstElementChild, hex.slice(1));
  setText(face.lastElementChild, name);
  face.setAttribute('aria-label', t('swatch.faceLabel', { index: index + 1, hex, name }));
  face.setAttribute('title', t('swatch.edit'));
  tools.setAttribute('aria-label', t('swatch.label', { index: index + 1, name }));
  lock.setAttribute('aria-pressed', String(swatch.locked));
  lock.setAttribute('aria-label', t('swatch.lock'));
  lock.setAttribute('title', t(swatch.locked ? 'swatch.unlock' : 'swatch.lock'));
  setIcon(lock.firstElementChild, swatch.locked ? 'lock' : 'unlock');
  setLabel(shades, t('swatch.shades'));
  setLabel(copy, t('swatch.copy'));
  setLabel(grip, t('swatch.drag'));
}
