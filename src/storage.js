/**
 * The only place that touches localStorage. Every read and write is wrapped in
 * try/catch, so private mode, disabled storage or a full quota never crash the app.
 * Nothing is accessed at import time.
 * @module storage
 */

const KEY_PREFIX = 'color-palette:';

/**
 * @typedef {object} SafeStorage
 * @property {(key: string, fallback?: string|null) => string|null} getItem
 * @property {(key: string, value: string) => boolean} setItem true when stored
 * @property {(key: string, fallback?: unknown) => unknown} getJson fallback on missing or invalid JSON
 * @property {(key: string, value: unknown) => boolean} setJson true when stored
 */

/**
 * Creates a guarded storage wrapper.
 * @param {() => (Storage|null|undefined)} [getBackend] returns the Web Storage
 *   object; defaults to window.localStorage (tests inject fakes)
 * @returns {SafeStorage}
 */
export function createStorage(getBackend = () => globalThis.localStorage) {
  function read(key) {
    try {
      return getBackend()?.getItem(KEY_PREFIX + key) ?? null;
    } catch {
      return null;
    }
  }

  function write(key, text) {
    try {
      const backend = getBackend();
      if (!backend) return false;
      backend.setItem(KEY_PREFIX + key, text);
      return true;
    } catch {
      return false;
    }
  }

  return {
    getItem: (key, fallback = null) => read(key) ?? fallback,
    setItem: (key, value) => write(key, String(value)),
    getJson(key, fallback = null) {
      const text = read(key);
      if (text === null) return fallback;
      try {
        return JSON.parse(text);
      } catch {
        return fallback;
      }
    },
    setJson(key, value) {
      try {
        return write(key, JSON.stringify(value));
      } catch {
        return false;
      }
    },
  };
}

/** The app-wide wrapper around window.localStorage. */
export const storage = createStorage();
