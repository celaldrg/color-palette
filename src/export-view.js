/**
 * The export dialog: the palette as CSS custom properties, JSON, a Tailwind
 * config or an SVG strip; text formats are copied, the SVG is downloaded.
 * @module export-view
 */
import { setIcon, setText } from './dom.js';
import { toCssVariables, toJson, toSvgStrip, toTailwindConfig } from './exporters.js';

/** Export formats: how to build them and what the action button does. */
const FORMATS = new Map([
  ['css', { build: toCssVariables, label: 'export.css' }],
  ['json', { build: toJson, label: 'export.json' }],
  ['tailwind', { build: toTailwindConfig, label: 'export.tailwind' }],
  ['svg', { build: toSvgStrip, label: 'export.svg', file: 'palette.svg', type: 'image/svg+xml' }],
]);

/**
 * @typedef {object} ExportActions
 * @property {(text: string) => void} copy
 * @property {(filename: string, text: string, type: string) => void} download
 */

/**
 * Wires up the export dialog.
 * @param {HTMLDialogElement} dialog
 * @param {ExportActions} actions
 * @returns {{
 *   open: (colors: string[], t: import('./swatches-view.js').Translate) => void,
 *   update: (colors: string[], t: import('./swatches-view.js').Translate) => void,
 * }}
 */
export function createExportView(dialog, actions) {
  const find = (selector) => dialog.querySelector(selector);
  const formatButtons = [...dialog.querySelectorAll('[data-format]')];
  const code = find('#export-code');
  const preview = find('#export-preview');
  const actionButton = find('#export-action');
  let format = 'css';
  let output = '';
  let colors = [];
  let t = null;

  formatButtons.forEach((button) =>
    button.addEventListener('click', () => {
      format = button.dataset.format;
      render();
    }),
  );
  actionButton.addEventListener('click', () => {
    const { file, type } = FORMATS.get(format);
    if (file) actions.download(file, output, type);
    else actions.copy(output);
  });
  find('#export-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog && !isInside(dialog.getBoundingClientRect(), event)) dialog.close();
  });

  function render() {
    const spec = FORMATS.get(format);
    output = spec.build(colors);
    formatButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.format === format)));
    setText(code, output);
    preview.hidden = !spec.file;
    if (spec.file) preview.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(output)}`;
    setIcon(actionButton.querySelector('svg'), spec.file ? 'download' : 'copy');
    setText(find('#export-action-label'), t(spec.label));
  }

  return {
    open(nextColors, translate) {
      colors = nextColors;
      t = translate;
      render();
      dialog.showModal();
    },
    update(nextColors, translate) {
      if (!dialog.open) return;
      colors = nextColors;
      t = translate;
      render();
    },
  };
}

/** True when a pointer event happened inside a rectangle (a backdrop click is outside). */
function isInside(rect, event) {
  return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
}
