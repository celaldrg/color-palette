/**
 * The shade scale panel: the 50-950 scale of one swatch; a click copies a shade.
 * @module shades-view
 */
import { el, paint, setText, syncChildren } from './dom.js';
import { nearestColorName } from './names.js';
import { shadeScale } from './shades.js';

/**
 * Wires up the shades section of the side panel.
 * @param {HTMLElement} root the shade scale's panel section
 * @param {{ copy: (hex: string) => void }} actions
 * @returns {{ update: (swatch: import('./palette.js').Swatch, t: import('./swatches-view.js').Translate) => void }}
 */
export function createShadesView(root, actions) {
  const caption = root.querySelector('#shades-of');
  const list = root.querySelector('#shade-list');

  list.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-hex]');
    if (button) actions.copy(button.dataset.hex);
  });

  return {
    update(swatch, t) {
      setText(caption, `${swatch.hex.toUpperCase()} · ${nearestColorName(swatch.hex).css}`);
      syncChildren(list, shadeScale(swatch.hex), {
        key: (shade) => String(shade.step),
        create: createShadeRow,
        update: (row, shade) => updateShadeRow(row, shade, t),
      });
    },
  };
}

function createShadeRow(shade) {
  return el(
    'li',
    {},
    el(
      'button',
      { class: 'shade', type: 'button' },
      el('span', { class: 'shade-step' }, String(shade.step)),
      el('span', { class: 'shade-base' }),
      el('span', { class: 'shade-hex' }),
    ),
  );
}

function updateShadeRow(row, shade, t) {
  const button = row.firstElementChild;
  const [, base, hex] = button.children;
  const code = shade.hex.toUpperCase();
  button.dataset.hex = code;
  paint(button, shade.hex);
  base.hidden = !shade.base;
  setText(base, t('shades.base'));
  setText(hex, code);
}
