/**
 * The color picker panel: a live preview, a text field that accepts any
 * supported notation, HSL or OKLCH sliders with gradient tracks, and the
 * color in every notation, each one copyable.
 * @module picker-view
 */
import { el, icon, paint, setText, syncChildren } from './dom.js';
import { nearestColorName } from './names.js';
import { formatColor, NOTATIONS, parseColor } from './notation.js';
import {
  formatSliderValue,
  hexFromSliders,
  SLIDER_CHANNELS,
  sliderGradient,
  slidersFromHex,
  slidersInGamut,
} from './sliders.js';

/**
 * @typedef {object} PickerActions
 * @property {(hex: string) => void} setColor recolors the edited swatch; the caller
 *   then passes the swatch back through update(), changed or not
 * @property {(text: string) => void} copy
 */

/**
 * Wires up the picker section of the side panel.
 * @param {HTMLElement} root the picker's panel section
 * @param {PickerActions} actions
 * @returns {{ update: (swatch: import('./palette.js').Swatch, t: import('./swatches-view.js').Translate) => void }}
 */
export function createPickerView(root, actions) {
  const find = (selector) => root.querySelector(selector);
  const preview = find('#picker-preview');
  const hexText = find('#picker-hex');
  const nameText = find('#picker-name');
  const input = find('#picker-input');
  const error = find('#picker-error');
  const gamut = find('#picker-gamut');
  const notations = find('#notation-list');
  const spaceButtons = [...root.querySelectorAll('[data-space]')];
  const sliders = [...root.querySelectorAll('.slider')].map((row) => ({
    name: row.querySelector('.slider-name'),
    value: row.querySelector('.slider-value'),
    range: row.querySelector('input'),
  }));
  let space = 'hsl';
  let values = null;
  /** The swatch the sliders were last set from (or set), so they only resync on outside changes. */
  let synced = { id: null, hex: null };
  let swatch = null;
  let t = null;

  spaceButtons.forEach((button) =>
    button.addEventListener('click', () => {
      space = button.dataset.space;
      values = slidersFromHex(space, swatch.hex);
      render();
    }),
  );
  sliders.forEach((slider, position) =>
    slider.range.addEventListener('input', () => {
      const { key } = SLIDER_CHANNELS[space][position];
      values = { ...values, [key]: Number(slider.range.value) };
      synced = { id: swatch.id, hex: hexFromSliders(space, values) };
      actions.setColor(synced.hex);
    }),
  );
  input.addEventListener('input', () => {
    showError(false);
    const hex = parseColor(input.value);
    if (hex) actions.setColor(hex);
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') showError(parseColor(input.value) === null);
  });
  input.addEventListener('blur', () => {
    showError(false);
    input.value = swatch.hex;
  });
  notations.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-value]');
    if (button) actions.copy(button.dataset.value);
  });

  function showError(invalid) {
    error.hidden = !invalid;
    input.setAttribute('aria-invalid', String(invalid));
  }

  function render() {
    const { hex } = swatch;
    paint(preview, hex);
    setText(hexText, hex.toUpperCase());
    setText(nameText, nearestColorName(hex).css);
    if (document.activeElement !== input) input.value = hex;
    spaceButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.space === space)));
    SLIDER_CHANNELS[space].forEach((channel, position) => renderSlider(sliders[position], channel, hex));
    gamut.hidden = slidersInGamut(space, values);
    syncChildren(notations, NOTATIONS, {
      key: (notation) => notation,
      create: createNotationRow,
      update: (row, notation) => updateNotationRow(row, notation, formatColor(hex, notation), t),
    });
  }

  function renderSlider(slider, channel, hex) {
    const { key, label, min, max, step } = channel;
    setText(slider.name, t(label));
    setText(slider.value, formatSliderValue(space, key, values[key]));
    for (const [attribute, value] of [['min', min], ['max', max], ['step', step]]) {
      slider.range.setAttribute(attribute, String(value));
    }
    slider.range.value = String(values[key]);
    slider.range.style.setProperty('--track', sliderGradient(space, key, values));
    slider.range.style.setProperty('--thumb', hex);
  }

  return {
    update(nextSwatch, translate) {
      swatch = nextSwatch;
      t = translate;
      if (swatch.id !== synced.id || swatch.hex !== synced.hex) {
        values = slidersFromHex(space, swatch.hex);
        synced = { id: swatch.id, hex: swatch.hex };
      }
      render();
    },
  };
}

function createNotationRow() {
  return el(
    'li',
    {},
    el(
      'button',
      { class: 'notation', type: 'button' },
      el('span', { class: 'notation-name' }),
      el('span', { class: 'notation-value' }),
      icon('copy'),
    ),
  );
}

function updateNotationRow(row, notation, value, t) {
  const button = row.firstElementChild;
  button.dataset.value = value;
  setText(button.querySelector('.notation-name'), t(`notation.${notation}`));
  setText(button.querySelector('.notation-value'), value);
}
