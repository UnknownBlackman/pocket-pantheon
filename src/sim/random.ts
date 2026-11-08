/**
 * Seeded randomness (mulberry32). The state lives on the World so a saved
 * village resumes the same sequence and tests are repeatable.
 */

export interface RngHolder {
  rngState: number;
}

/** Returns a float in [0, 1) and advances the holder's state. */
export function random(holder: RngHolder): number {
  let t = (holder.rngState = (holder.rngState + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randomRange(holder: RngHolder, min: number, max: number): number {
  return min + (max - min) * random(holder);
}

export function randomInt(holder: RngHolder, maxExclusive: number): number {
  return Math.floor(random(holder) * maxExclusive);
}

export function pick<T>(holder: RngHolder, items: readonly T[]): T {
  return items[randomInt(holder, items.length)];
}
