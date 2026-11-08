/**
 * Save and load the village as JSON under one localStorage key. Every
 * storage call is wrapped: private windows, blocked storage or a corrupt
 * save fall back to a fresh village instead of crashing. Storage is passed
 * in so the logic can be tested in Node.
 */
import { fastForward } from '../sim/fastforward.ts';
import type { AwayReport } from '../sim/fastforward.ts';
import { RULES } from '../sim/rules.ts';
import type { World } from '../sim/types.ts';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export function serializeWorld(world: World, now: number): string {
  world.lastSavedAt = now;
  return JSON.stringify(world);
}

/** Parses and sanity-checks a save. Returns null when it is unusable. */
export function deserializeWorld(json: string): World | null {
  try {
    const w = JSON.parse(json) as Partial<World>;
    if (!w || w.version !== 1) return null;
    if (!Array.isArray(w.villagers) || !Array.isArray(w.buildings) || !Array.isArray(w.chronicle)) {
      return null;
    }
    if (typeof w.favor !== 'number' || typeof w.rngState !== 'number') return null;
    // Defaults for fields added after the first saves.
    w.tutorialDone ??= [];
    w.effects ??= [];
    w.sessionChronicleStart ??= 0;
    return w as World;
  } catch {
    return null;
  }
}

export function saveWorld(storage: StorageLike | null | undefined, world: World, now = Date.now()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(RULES.save.key, serializeWorld(world, now));
    return true;
  } catch (err) {
    console.warn('[save] could not save', err);
    return false;
  }
}

export interface LoadResult {
  world: World;
  /** Set when the save was old enough to fast-forward. */
  away: AwayReport | null;
}

export function loadWorld(storage: StorageLike | null | undefined, now = Date.now()): LoadResult | null {
  if (!storage) return null;
  let json: string | null = null;
  try {
    json = storage.getItem(RULES.save.key);
  } catch (err) {
    console.warn('[save] could not read', err);
    return null;
  }
  if (!json) return null;
  const world = deserializeWorld(json);
  if (!world) {
    console.warn('[save] save was unreadable; starting a fresh village');
    return null;
  }
  // Nobody holds a villager across a reload.
  for (const v of world.villagers) v.carried = false;
  let away: AwayReport | null = null;
  const elapsed = now - (world.lastSavedAt || now);
  if (elapsed > RULES.save.fastForwardAfterMs) {
    away = fastForward(world, elapsed / 3_600_000);
  }
  return { world, away };
}

/** The browser's localStorage, or null when it is unavailable. */
export function browserStorage(): StorageLike | null {
  try {
    const s = globalThis.localStorage;
    return s ?? null;
  } catch {
    return null;
  }
}
