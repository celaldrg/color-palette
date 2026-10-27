/**
 * Clipboard and file download helpers for the browser UI.
 * @module clipboard
 */

/** How long a download's object URL stays valid, in ms. */
const REVOKE_DELAY_MS = 1000;

/**
 * Copies text to the clipboard: the async Clipboard API first, then a hidden
 * textarea with execCommand('copy') where that API is missing or refused.
 * @param {string} text
 * @returns {Promise<boolean>} true when the text was copied
 */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return copyWithSelection(text);
  }
}

/**
 * Saves text as a file through a temporary object URL.
 * @param {string} filename e.g. 'palette.svg'
 * @param {string} text file contents
 * @param {string} type MIME type, e.g. 'image/svg+xml'
 */
export function downloadText(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.hidden = true;
  host().append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}

/** The open modal dialog, if any (the rest of the page is inert then), else the body. */
function host() {
  return document.querySelector('dialog[open]') ?? document.body;
}

function copyWithSelection(text) {
  const focused = document.activeElement;
  const area = document.createElement('textarea');
  area.value = text;
  area.readOnly = true;
  area.className = 'offscreen';
  host().append(area);
  area.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  area.remove();
  if (focused instanceof HTMLElement) focused.focus({ preventScroll: true });
  return copied;
}
