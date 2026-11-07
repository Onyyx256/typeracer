/** A number in [0, 1), like Math.random, but reproducible from a seed. */
export type Rng = () => number;

/**
 * Mulberry32: tiny and fast, good enough to pick words. The same seed always
 * gives the same text, which is what the tests rely on.
 */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Between min and max, both included. */
export function randomInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) {
    throw new Error("pick() needs at least one item.");
  }
  return items[Math.floor(rng() * items.length)] as T;
}

export function chance(rng: Rng, probability: number): boolean {
  return rng() < probability;
}
