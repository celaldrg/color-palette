/**
 * Seeded pseudo-random numbers (mulberry32) so palettes and tests are reproducible.
 * @module rng
 */

/**
 * Creates a deterministic random number generator.
 * @param {number} seed Any number; only its lowest 32 bits are used.
 * @returns {() => number} A function returning floats in [0, 1).
 */
export function createRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Picks a float uniformly from [min, max).
 * @param {() => number} rng Random source from createRng.
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function randomBetween(rng, min, max) {
  return min + (max - min) * rng();
}

/**
 * Returns a fresh 32-bit seed for a normal (non-demo, non-test) session.
 * @returns {number}
 */
export function randomSeed() {
  return Math.floor(Math.random() * 4294967296);
}
