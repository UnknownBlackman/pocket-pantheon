/**
 * The village changes as it survives (visual progression, persisted):
 * - worn paths: every second a villager walks adds to a coarse traffic grid;
 *   the busiest cells become stepping stones;
 * - huts gain a cobbled apron after the first session and a garden after
 *   the second;
 * - the chronicle tablet gains a golden carving for each finished session.
 * Pure simulation code.
 */
import { PROGRESS, RULES } from './rules.ts';
import type { World } from './types.ts';

const R = RULES.village.radius;
/** Cells across the village's diameter. */
export const TRAFFIC_GRID = Math.ceil((R * 2) / PROGRESS.cellSize);

function cellOf(x: number, z: number): number {
  const i = Math.floor((x + R) / PROGRESS.cellSize);
  const j = Math.floor((z + R) / PROGRESS.cellSize);
  if (i < 0 || j < 0 || i >= TRAFFIC_GRID || j >= TRAFFIC_GRID) return -1;
  return j * TRAFFIC_GRID + i;
}

/** Records `dt` seconds of walking at (x, z). */
export function addTraffic(world: World, x: number, z: number, dt: number): void {
  const c = cellOf(x, z);
  if (c < 0) return;
  if (world.traffic.length !== TRAFFIC_GRID * TRAFFIC_GRID) {
    world.traffic = new Array(TRAFFIC_GRID * TRAFFIC_GRID).fill(0);
  }
  world.traffic[c] = Math.min(PROGRESS.trafficCap, world.traffic[c] + dt);
}

export interface PathStone {
  x: number;
  z: number;
  /** 0..1: how worn (stones grow with traffic). */
  wear: number;
}

/** Cells walked enough to have become stepping stones, with their centres. */
export function pathStones(world: World): PathStone[] {
  const out: PathStone[] = [];
  const t = world.traffic;
  for (let c = 0; c < t.length; c++) {
    if (t[c] < PROGRESS.stoneAfter) continue;
    const i = c % TRAFFIC_GRID;
    const j = Math.floor(c / TRAFFIC_GRID);
    const x = -R + (i + 0.5) * PROGRESS.cellSize;
    const z = -R + (j + 0.5) * PROGRESS.cellSize;
    if (Math.hypot(x, z) > R * 0.9) continue;
    const wear = Math.min(1, (t[c] - PROGRESS.stoneAfter) / (PROGRESS.stoneFull - PROGRESS.stoneAfter));
    out.push({ x, z, wear });
  }
  return out;
}

/** Sessions the village has finished (the current one does not count). */
export function sessionsSurvived(world: World): number {
  return Math.max(0, world.session - 1);
}

/** 0: plain huts, 1: cobbled apron, 2: apron and garden. */
export function hutTier(world: World): number {
  return Math.min(2, sessionsSurvived(world));
}

/** Golden carvings on the tablet, one per finished session. */
export function tabletCarvings(world: World): number {
  return Math.min(PROGRESS.maxCarvings, sessionsSurvived(world));
}
