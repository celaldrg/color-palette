/**
 * Entry point: connects the palette model to the page. Every change goes
 * through the model (or the small UI state below) and then render(), which
 * draws the whole page from that state.
 * @module main
 */
import { copyText, downloadText } from './clipboard.js';
import { bestContrastPair } from './contrast.js';
import { createContrastView, isFixedOption } from './contrast-view.js';
import { createDemo, isDemoRequest } from './demo.js';
import { setText, translateStatic } from './dom.js';
import { createExportView } from './export-view.js';
import { HARMONY_MODES, MAX_COLORS, MIN_COLORS } from './harmony.js';
import { normalizeLanguage, otherLanguage, translate } from './i18n.js';
import { parseColor } from './notation.js';
import { createPaletteApp } from './palette.js';
import { createPickerView } from './picker-view.js';
import { addSavedPalette, removeSavedPalette, sanitizeSavedPalettes } from './saved.js';
import { createSavedView } from './saved-view.js';
import { createShadesView } from './shades-view.js';
import { decodePaletteHash, encodePaletteHash, shareUrl } from './share.js';
import { activatesOnSpace, isTypingTarget, shortcutFor } from './shortcuts.js';
import { storage } from './storage.js';
import { createSwatchesView } from './swatches-view.js';

/** How long a toast message stays, in ms. */
const TOAST_MS = 2200;
/** The URL hash follows the palette once edits pause this long, in ms (browsers throttle history updates). */
const HASH_DELAY_MS = 300;
/** Panel title per panel view. */
const PANEL_TITLES = new Map([
  ['picker', 'picker.title'],
  ['contrast', 'contrast.title'],
  ['shades', 'shades.title'],
  ['saved', 'saved.title'],
]);

const page = {
  generate: byId('generate'),
  lang: byId('lang'),
  mode: byId('mode'),
  base: byId('base'),
  baseBox: byId('base-box'),
  baseChip: byId('base-chip'),
  baseClear: byId('base-clear'),
  baseError: byId('base-error'),
  count: byId('count'),
  countDown: byId('count-down'),
  countUp: byId('count-up'),
  undo: byId('undo'),
  contrastTool: byId('contrast-tool'),
  exportTool: byId('export-tool'),
  shareTool: byId('share-tool'),
  savedTool: byId('saved-tool'),
  panel: byId('panel'),
  panelTitle: byId('panel-title'),
  panelClose: byId('panel-close'),
  panelViews: [...document.querySelectorAll('.panel-view')],
  exportDialog: byId('export-dialog'),
  toast: byId('toast'),
};

const demo = isDemoRequest(location.search) ? createDemo() : null;
const app = demo?.app ?? createPaletteApp({ colors: decodePaletteHash(location.hash) ?? undefined });
let state = app.getState();

/** UI state that is not part of the palette model. */
const ui = {
  language: normalizeLanguage(storage.getItem('language')),
  /** 'picker' | 'contrast' | 'shades' | 'saved' | null */
  panel: demo ? 'contrast' : null,
  /** Swatch id the picker or the shade scale shows. */
  targetId: null,
  /** Contrast checker selection: see contrast-view.js. */
  contrast: demo ? contrastKeys(demo.contrast) : null,
  saved: sanitizeSavedPalettes(storage.getJson('saved', [])),
};

/** The element that opened the panel; it gets focus back when the panel closes. */
let panelOpener = null;
/** Whether the focused element was reached with the keyboard (see shortcutFor). */
let keyboardFocus = false;
/** Set when a Space press generated, so its keyup does not also click a button. */
let spaceUsed = false;
let toastTimer = 0;
let hashTimer = 0;

const views = {
  swatches: createSwatchesView(byId('swatches'), {
    edit: (index) => togglePanel('picker', state.swatches[index].id),
    toggleLock: (index) => update(app.toggleLock(index)),
    shades: (index) => togglePanel('shades', state.swatches[index].id),
    copy: (index) => copyHex(state.swatches[index].hex),
    move: (from, to) => update(app.moveSwatch(from, to)),
  }),
  picker: createPickerView(panelView('picker'), {
    setColor: (hex) => update(app.setColor(targetIndex(), hex)),
    copy: (text) => copy(text, 'export.copied'),
  }),
  contrast: createContrastView(panelView('contrast'), {
    select: (role, key) => {
      ui.contrast = { ...ui.contrast, [role]: key };
      render();
    },
    swap: () => {
      ui.contrast = { fg: ui.contrast.bg, bg: ui.contrast.fg };
      render();
    },
  }),
  shades: createShadesView(panelView('shades'), { copy: copyHex }),
  saved: createSavedView(panelView('saved'), { save: savePalette, load: loadSaved, remove: removeSaved }),
  exporter: createExportView(page.exportDialog, {
    copy: (text) => copy(text, 'export.copied'),
    download: (filename, text, type) => {
      downloadText(filename, text, type);
      showToast(t('export.downloaded'));
    },
  }),
};

function byId(id) {
  return document.getElementById(id);
}

function panelView(name) {
  return page.panelViews.find((view) => view.dataset.view === name);
}

/** Looks up a UI string in the current language. */
function t(key, params) {
  return translate(ui.language, key, params);
}

function colors() {
  return state.swatches.map((swatch) => swatch.hex);
}

function targetIndex() {
  return state.swatches.findIndex((swatch) => swatch.id === ui.targetId);
}

/** Contrast option keys for two swatch indexes. */
function contrastKeys({ foreground, background }) {
  return { fg: String(state.swatches[foreground].id), bg: String(state.swatches[background].id) };
}

/** Stores a new model state and redraws. */
function update(next) {
  state = next;
  render();
}

/** Drops UI state that points at swatches which no longer exist. */
function reconcileUi() {
  const ids = new Set(state.swatches.map((swatch) => String(swatch.id)));
  if ((ui.panel === 'picker' || ui.panel === 'shades') && !ids.has(String(ui.targetId))) ui.panel = null;
  const known = (key) => ids.has(key) || isFixedOption(key);
  if (!ui.contrast || !known(ui.contrast.fg) || !known(ui.contrast.bg)) {
    ui.contrast = contrastKeys(bestContrastPair(colors()));
  }
}

function render() {
  reconcileUi();
  const editing = ui.panel === 'picker' || ui.panel === 'shades';
  views.swatches.update(state.swatches, editing ? ui.targetId : null, t);
  renderControls();
  renderPanel();
  views.exporter.update(colors(), t);
  clearTimeout(hashTimer);
  hashTimer = setTimeout(syncHash, HASH_DELAY_MS);
}

/** Puts the palette in the URL hash, so the address bar is always a share link. */
function syncHash() {
  const hash = `#${encodePaletteHash(colors())}`;
  if (location.hash !== hash) history.replaceState(null, '', hash);
}

function renderControls() {
  const count = state.swatches.length;
  page.mode.value = state.mode;
  if (document.activeElement !== page.base && page.baseError.hidden) page.base.value = state.baseColor ?? '';
  page.baseChip.classList.toggle('is-auto', state.baseColor === null);
  page.baseChip.style.setProperty('--chip', state.baseColor ?? 'transparent');
  page.baseClear.hidden = state.baseColor === null && page.base.value === '';
  setText(page.count, String(count));
  page.countDown.disabled = count <= MIN_COLORS;
  page.countUp.disabled = count >= MAX_COLORS;
  page.undo.disabled = !state.canUndo;
  page.contrastTool.setAttribute('aria-pressed', String(ui.panel === 'contrast'));
  page.savedTool.setAttribute('aria-pressed', String(ui.panel === 'saved'));
}

function renderPanel() {
  page.panel.hidden = ui.panel === null;
  if (ui.panel === null) return;
  setText(page.panelTitle, t(PANEL_TITLES.get(ui.panel)));
  for (const view of page.panelViews) view.hidden = view.dataset.view !== ui.panel;
  const target = state.swatches[targetIndex()];
  if (ui.panel === 'picker') views.picker.update(target, t);
  else if (ui.panel === 'shades') views.shades.update(target, t);
  else if (ui.panel === 'contrast') views.contrast.update(state.swatches, ui.contrast, t);
  else views.saved.update(ui.saved, encodePaletteHash(colors()), ui.language, t);
}

/** Opens a panel view, or closes it when that same view is already open. */
function togglePanel(view, targetId = null) {
  if (ui.panel === view && ui.targetId === targetId) {
    closePanel();
    return;
  }
  if (ui.panel === null) panelOpener = document.activeElement;
  ui.panel = view;
  ui.targetId = targetId;
  render();
  page.panel.focus({ preventScroll: true });
}

function closePanel() {
  const focusInside = page.panel.contains(document.activeElement);
  ui.panel = null;
  render();
  if (focusInside && panelOpener?.isConnected) panelOpener.focus({ preventScroll: true });
  panelOpener = null;
}

function showToast(message) {
  const { toast } = page;
  // A modal dialog hides the rest of the page, so the toast moves into it.
  const host = document.querySelector('dialog[open]') ?? document.body;
  if (toast.parentElement !== host) host.append(toast);
  setText(toast, message);
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, TOAST_MS);
}

function hideToast() {
  page.toast.classList.remove('is-visible');
}

async function copy(text, successKey, params) {
  const copied = await copyText(text);
  showToast(copied ? t(successKey, params) : t('copy.failed'));
}

function copyHex(hex) {
  const code = hex.toUpperCase();
  return copy(code, 'swatch.copied', { hex: code });
}

function savePalette() {
  ui.saved = addSavedPalette(ui.saved, colors(), Date.now());
  const stored = storage.setJson('saved', ui.saved);
  render();
  showToast(t(stored ? 'saved.saved' : 'saved.notStored'));
}

function loadSaved(id) {
  const entry = ui.saved.find((item) => item.id === id);
  if (!entry) return;
  update(app.loadPalette(entry.colors));
  showToast(t('saved.loaded'));
}

function removeSaved(id) {
  ui.saved = removeSavedPalette(ui.saved, id);
  storage.setJson('saved', ui.saved);
  render();
  byId('save-palette').focus({ preventScroll: true });
}

function commitBaseColor() {
  const text = page.base.value.trim();
  const valid = text === '' || parseColor(text) !== null;
  page.baseError.hidden = valid;
  page.baseBox.classList.toggle('is-invalid', !valid);
  page.base.setAttribute('aria-invalid', String(!valid));
  if (valid) update(app.setBaseColor(text === '' ? null : text));
}

function applyLanguage() {
  document.documentElement.lang = ui.language;
  document.title = t('app.title');
  translateStatic(document.body, t);
  for (const option of page.mode.options) option.textContent = t(`harmony.${option.value}`);
  render();
}

function handleKeydown(event) {
  if (event.isComposing) return;
  const focused = document.activeElement;
  const command = shortcutFor({
    key: event.key,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    altKey: event.altKey,
    shiftKey: event.shiftKey,
    repeat: event.repeat,
    typing: isTypingTarget(focused),
    activating: keyboardFocus && activatesOnSpace(focused),
    modal: page.exportDialog.open,
  });
  if (command === null || (command === 'close' && ui.panel === null)) return;
  event.preventDefault();
  if (command === 'generate') {
    spaceUsed = true;
    update(app.generate());
  } else if (command === 'undo') {
    update(app.undo());
  } else {
    closePanel();
  }
}

function bindEvents() {
  page.generate.addEventListener('click', () => update(app.generate()));
  page.lang.addEventListener('click', () => {
    ui.language = otherLanguage(ui.language);
    storage.setItem('language', ui.language);
    hideToast(); // its message is in the old language
    applyLanguage();
  });
  page.mode.addEventListener('change', () => update(app.setMode(page.mode.value)));
  page.base.addEventListener('change', commitBaseColor);
  page.base.addEventListener('input', () => {
    page.baseError.hidden = true;
    page.baseBox.classList.remove('is-invalid');
    page.base.removeAttribute('aria-invalid');
    page.baseClear.hidden = state.baseColor === null && page.base.value === '';
  });
  page.base.addEventListener('blur', () => {
    if (page.baseError.hidden) page.base.value = state.baseColor ?? '';
  });
  page.baseClear.addEventListener('click', () => {
    page.base.value = '';
    commitBaseColor();
    page.base.focus();
  });
  page.countDown.addEventListener('click', () => update(app.setCount(state.swatches.length - 1)));
  page.countUp.addEventListener('click', () => update(app.setCount(state.swatches.length + 1)));
  page.undo.addEventListener('click', () => update(app.undo()));
  page.contrastTool.addEventListener('click', () => togglePanel('contrast'));
  page.exportTool.addEventListener('click', () => views.exporter.open(colors(), t));
  page.shareTool.addEventListener('click', () => copy(shareUrl(location.href, colors()), 'share.copied'));
  page.savedTool.addEventListener('click', () => togglePanel('saved'));
  page.panelClose.addEventListener('click', closePanel);
  document.addEventListener('keydown', handleKeydown);
  document.addEventListener('keyup', (event) => {
    if (event.key !== ' ' || !spaceUsed) return;
    spaceUsed = false;
    event.preventDefault();
  });
  document.addEventListener('focusin', (event) => {
    keyboardFocus = event.target instanceof Element && event.target.matches(':focus-visible');
  });
  window.addEventListener('hashchange', () => {
    const next = decodePaletteHash(location.hash);
    if (next && encodePaletteHash(next) !== encodePaletteHash(colors())) update(app.loadPalette(next));
  });
}

function start() {
  for (const mode of HARMONY_MODES) page.mode.append(new Option(mode, mode));
  bindEvents();
  applyLanguage();
}

start();
