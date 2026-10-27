/**
 * The saved palettes panel: save the current palette, load or delete saved ones.
 * @module saved-view
 */
import { el, icon, setLabel, setText, syncChildren } from './dom.js';

/**
 * @typedef {object} SavedActions
 * @property {() => void} save
 * @property {(id: string) => void} load
 * @property {(id: string) => void} remove
 */

/**
 * Wires up the saved palettes section of the side panel.
 * @param {HTMLElement} root the saved palettes' panel section
 * @param {SavedActions} actions
 * @returns {{ update: (saved: readonly import('./saved.js').SavedPalette[], currentId: string, language: string, t: import('./swatches-view.js').Translate) => void }}
 */
export function createSavedView(root, actions) {
  const empty = root.querySelector('#saved-empty');
  const list = root.querySelector('#saved-list');

  root.querySelector('#save-palette').addEventListener('click', () => actions.save());
  list.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (button) actions[button.dataset.action](button.closest('li').dataset.key);
  });

  return {
    update(saved, currentId, language, t) {
      const dates = new Intl.DateTimeFormat(language, { dateStyle: 'medium' });
      empty.hidden = saved.length > 0;
      syncChildren(list, saved, {
        key: (entry) => entry.id,
        create: createSavedItem,
        update: (item, entry) => {
          const [load, remove] = item.children;
          const colors = entry.colors.map((hex) => hex.toUpperCase()).join(', ');
          load.setAttribute('aria-label', t('saved.loadLabel', { colors }));
          load.setAttribute('aria-current', String(entry.id === currentId));
          setText(load.lastElementChild, t('saved.meta', { count: entry.colors.length, date: dates.format(entry.savedAt) }));
          setLabel(remove, t('saved.delete'));
        },
      });
    },
  };
}

function createSavedItem(entry) {
  const strip = el('span', { class: 'saved-strip' });
  for (const hex of entry.colors) {
    const segment = el('span');
    segment.style.backgroundColor = hex;
    strip.append(segment);
  }
  return el(
    'li',
    { class: 'saved-item' },
    el('button', { class: 'saved-load', type: 'button', 'data-action': 'load' }, strip, el('span', { class: 'saved-meta' })),
    el('button', { class: 'icon-btn', type: 'button', 'data-action': 'remove' }, icon('trash')),
  );
}
