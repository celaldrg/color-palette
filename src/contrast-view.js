/**
 * The contrast checker panel: text and background colors picked from the
 * palette (or white and black), a live sample, the WCAG contrast ratio and the
 * AA/AAA verdicts for normal and large text.
 * @module contrast-view
 */
import { checkContrast, formatRatio } from './contrast.js';
import { el, icon, paint, setIcon, setLabel, setText, syncChildren } from './dom.js';
import { nearestColorName } from './names.js';

/** Choices offered after the palette colors. */
const FIXED_OPTIONS = Object.freeze([
  { key: 'white', hex: '#ffffff', label: 'contrast.white' },
  { key: 'black', hex: '#000000', label: 'contrast.black' },
]);

/**
 * @typedef {object} ContrastSelection
 * @property {string} fg option key of the text color: a swatch id as a string, 'white' or 'black'
 * @property {string} bg option key of the background color
 */

/**
 * @typedef {object} ContrastActions
 * @property {(role: 'fg'|'bg', key: string) => void} select
 * @property {() => void} swap
 */

/**
 * Tells whether a contrast option key is one of the fixed choices.
 * @param {string} key
 * @returns {boolean}
 */
export function isFixedOption(key) {
  return FIXED_OPTIONS.some((option) => option.key === key);
}

/**
 * Wires up the contrast section of the side panel.
 * @param {HTMLElement} root the contrast checker's panel section
 * @param {ContrastActions} actions
 * @returns {{ update: (swatches: readonly import('./palette.js').Swatch[], selection: ContrastSelection, t: import('./swatches-view.js').Translate) => void }}
 */
export function createContrastView(root, actions) {
  const find = (selector) => root.querySelector(selector);
  const preview = find('#contrast-preview');
  const pair = find('#contrast-pair');
  const ratio = find('#contrast-ratio');
  const badges = [...root.querySelectorAll('[data-verdict]')];
  const groups = { fg: find('#contrast-fg'), bg: find('#contrast-bg') };

  for (const [role, group] of Object.entries(groups)) {
    group.addEventListener('click', (event) => {
      const chip = event.target.closest('.chip');
      if (chip) actions.select(role, chip.dataset.key);
    });
  }
  find('#contrast-swap').addEventListener('click', () => actions.swap());

  return {
    update(swatches, selection, t) {
      const options = [
        ...swatches.map((swatch, index) => ({
          key: String(swatch.id),
          hex: swatch.hex,
          name: swatch.hex.toUpperCase(),
          label: t('swatch.label', { index: index + 1, name: nearestColorName(swatch.hex).css }),
        })),
        ...FIXED_OPTIONS.map((option) => ({ ...option, name: t(option.label), label: t(option.label) })),
      ];
      const fg = options.find((option) => option.key === selection.fg);
      const bg = options.find((option) => option.key === selection.bg);
      const result = checkContrast(fg.hex, bg.hex);
      preview.style.setProperty('--sample-fg', fg.hex);
      preview.style.setProperty('--sample-bg', bg.hex);
      setText(pair, t('contrast.pair', { fg: fg.name, bg: bg.name }));
      setText(ratio, formatRatio(result.ratio));
      for (const badge of badges) {
        const [level, size] = badge.dataset.verdict.split('.');
        renderBadge(badge, result[level][size], t);
      }
      for (const [role, group] of Object.entries(groups)) {
        syncChildren(group, options, {
          key: (option) => option.key,
          create: () => el('button', { class: 'chip', type: 'button' }, icon('check')),
          update: (chip, option) => {
            paint(chip, option.hex);
            chip.setAttribute('aria-pressed', String(option.key === selection[role]));
            setLabel(chip, option.label);
          },
        });
      }
    },
  };
}

function renderBadge(badge, pass, t) {
  if (!badge.firstChild) badge.append(icon('check'), el('span'));
  badge.classList.toggle('pass', pass);
  badge.classList.toggle('fail', !pass);
  setIcon(badge.firstElementChild, pass ? 'check' : 'close');
  setText(badge.lastElementChild, t(pass ? 'contrast.pass' : 'contrast.fail'));
}
