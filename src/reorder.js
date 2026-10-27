/**
 * Reordering math for the swatch strip: where a dragged swatch lands, how the
 * others make room, and where the arrow keys move a swatch. Pure, no DOM.
 * @module reorder
 */

/**
 * The index a dragged item drops at: the furthest neighbour whose center the
 * dragged item's center has passed.
 * @param {number[]} centers item centers along the drag axis, in list order (ascending)
 * @param {number} from index of the dragged item
 * @param {number} position current center of the dragged item
 * @returns {number}
 */
export function dropIndex(centers, from, position) {
  let index = from;
  for (let i = from + 1; i < centers.length && position > centers[i]; i += 1) index = i;
  for (let i = from - 1; i >= 0 && position < centers[i]; i -= 1) index = i;
  return index;
}

/**
 * How many slots an item shifts to make room while another item is dragged.
 * @param {number} index the item
 * @param {number} from index of the dragged item
 * @param {number} to current drop index
 * @returns {-1|0|1} -1 one slot back, 1 one slot forward
 */
export function displacement(index, from, to) {
  if (index === from) return 0;
  if (from < to && index > from && index <= to) return -1;
  if (to < from && index >= to && index < from) return 1;
  return 0;
}

/**
 * Where a key press moves an item: arrow keys step by one, Home and End jump
 * to the ends.
 * @param {string} key KeyboardEvent.key
 * @param {number} index current index
 * @param {number} count number of items
 * @returns {number|null} the new index, or null when the key does not move the item
 */
export function keyboardTarget(key, index, count) {
  const targets = new Map([
    ['ArrowLeft', index - 1],
    ['ArrowUp', index - 1],
    ['ArrowRight', index + 1],
    ['ArrowDown', index + 1],
    ['Home', 0],
    ['End', count - 1],
  ]);
  const target = targets.get(key);
  return target !== undefined && target !== index && target >= 0 && target < count ? target : null;
}
