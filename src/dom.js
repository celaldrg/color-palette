/**
 * DOM helpers shared by the view modules: elements built node by node (never from HTML strings),
 * icons from the inline SVG sprite, keyed list updates, color painting and
 * translation of the static markup.
 * @module dom
 */
import { pickTextColor } from './contrast.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
/** Text colors for text on a colored surface: white or the page's dark navy. */
const INKS = ['#ffffff', '#0f172a'];
/** data-i18n-* attributes and the attribute each one translates. */
const TRANSLATED_ATTRIBUTES = [
  ['data-i18n-aria', 'aria-label'],
  ['data-i18n-title', 'title'],
  ['data-i18n-placeholder', 'placeholder'],
  ['data-i18n-alt', 'alt'],
];

/**
 * Creates an element with attributes and children.
 * @param {string} tag
 * @param {Record<string, string|number|boolean|null|undefined>} [attributes] true sets an
 *   empty attribute; false, null and undefined are skipped
 * @param {...(Node|string)} children
 * @returns {HTMLElement}
 */
export function el(tag, attributes = {}, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value === false || value === null || value === undefined) continue;
    node.setAttribute(name, value === true ? '' : String(value));
  }
  node.append(...children);
  return node;
}

/**
 * Creates an icon that shows a symbol of the inline SVG sprite.
 * @param {string} name symbol id without the 'i-' prefix, e.g. 'lock'
 * @returns {SVGSVGElement}
 */
export function icon(name) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `#i-${name}`);
  svg.append(use);
  return svg;
}

/**
 * Switches an icon (from icon() or the static markup) to another sprite symbol.
 * @param {SVGSVGElement} svg
 * @param {string} name symbol id without the 'i-' prefix
 */
export function setIcon(svg, name) {
  const use = svg.querySelector('use');
  const href = `#i-${name}`;
  if (use.getAttribute('href') !== href) use.setAttribute('href', href);
}

/**
 * Sets an element's text, touching the DOM only when the text changes.
 * @param {Node} node
 * @param {string} text
 */
export function setText(node, text) {
  if (node.textContent !== text) node.textContent = text;
}

/**
 * Names an icon-only control for assistive technology and shows the same text
 * as its tooltip.
 * @param {Element} node
 * @param {string} text
 */
export function setLabel(node, text) {
  if (node.getAttribute('aria-label') !== text) node.setAttribute('aria-label', text);
  if (node.getAttribute('title') !== text) node.setAttribute('title', text);
}

/**
 * Paints an element with a color: --swatch holds the color and --ink the more
 * readable text color on it; the 'ink-light' class marks white text.
 * @param {HTMLElement} node
 * @param {string} hex '#rrggbb'
 */
export function paint(node, hex) {
  const ink = pickTextColor(hex, INKS);
  node.style.setProperty('--swatch', hex);
  node.style.setProperty('--ink', ink);
  node.classList.toggle('ink-light', ink === INKS[0]);
}

/**
 * Updates a list in place: keeps the node of every key that is still present,
 * creates nodes for new keys, removes nodes of vanished keys and puts all of
 * them in the order of `items`.
 * @template T
 * @param {Element} container
 * @param {readonly T[]} items
 * @param {object} handlers
 * @param {(item: T) => string} handlers.key unique key of an item
 * @param {(item: T) => HTMLElement} handlers.create builds the node for a new key
 * @param {(node: HTMLElement, item: T, index: number) => void} handlers.update
 *   refreshes a node; runs for new and kept nodes alike
 */
export function syncChildren(container, items, { key, create, update }) {
  const existing = new Map([...container.children].map((node) => [node.dataset.key, node]));
  items.forEach((item, index) => {
    const itemKey = key(item);
    let node = existing.get(itemKey);
    if (node) {
      existing.delete(itemKey);
    } else {
      node = create(item);
      node.dataset.key = itemKey;
    }
    update(node, item, index);
    const current = container.children[index];
    if (current !== node) container.insertBefore(node, current ?? null);
  });
  existing.forEach((node) => node.remove());
}

/**
 * Translates the static markup: data-i18n sets the text, data-i18n-aria,
 * -title, -placeholder and -alt set those attributes.
 * @param {ParentNode} root
 * @param {(key: string) => string} t
 */
export function translateStatic(root, t) {
  for (const node of root.querySelectorAll('[data-i18n]')) setText(node, t(node.dataset.i18n));
  for (const [source, target] of TRANSLATED_ATTRIBUTES) {
    for (const node of root.querySelectorAll(`[${source}]`)) node.setAttribute(target, t(node.getAttribute(source)));
  }
}
