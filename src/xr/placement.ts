/**
 * Pure placement helpers (no Three.js): choosing a table plane and computing
 * the fallback platform pose. Kept pure so they can be unit-tested.
 */
import { LAYOUT } from '../sim/rules.ts';

export type PlacementSource = 'plane' | 'hit-test' | 'fallback';

export interface PlaneCandidate {
  /** Height of the candidate spot above the floor, metres. */
  height: number;
  horizontal: boolean;
  /** Semantic label if the device exposes one (e.g. 'table'). */
  label?: string;
  /** Horizontal distance from the head to the candidate spot, metres. */
  reach: number;
  /** True when the spot is in front of the player (not behind). */
  inFront: boolean;
  /** True when the plane contains the spot 50 cm ahead of the player. */
  containsAhead: boolean;
}

/** Area of a planar polygon given as x/z points (shoelace formula). */
export function polygonArea(points: ReadonlyArray<{ x: number; z: number }>): number {
  let a = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    a += (points[j].x + points[i].x) * (points[j].z - points[i].z);
  }
  return Math.abs(a / 2);
}

/** Even-odd point-in-polygon test on the x/z plane. */
export function pointInPolygon(
  x: number,
  z: number,
  points: ReadonlyArray<{ x: number; z: number }>,
): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i];
    const b = points[j];
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Picks the best table spot for a seated player. Only horizontal planes in
 * front of the player and within reach count. A plane labelled 'table' wins,
 * then one that contains the spot 50 cm ahead, then the nearest table-height
 * plane. Returns the index of the chosen candidate or -1.
 */
export function pickTablePlane(candidates: ReadonlyArray<PlaneCandidate>): number {
  let best = -1;
  let bestScore = -Infinity;
  candidates.forEach((c, i) => {
    if (!c.horizontal || !c.inFront || c.reach > LAYOUT.maxReach) return;
    const labelled = c.label?.toLowerCase() === 'table';
    const inRange = c.height >= LAYOUT.tableMinHeight && c.height <= LAYOUT.tableMaxHeight;
    if (!labelled && !inRange) return;
    const score = (labelled ? 100 : 0) + (c.containsAhead ? 50 : 0) - c.reach * 10;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

/** True when a hit-test height looks like a table top. */
export function isTableHeight(height: number): boolean {
  return height >= LAYOUT.tableMinHeight && height <= LAYOUT.tableMaxHeight;
}

/**
 * Fallback platform: 50 cm in front of the head (horizontal direction only)
 * and 25 cm below eye level. `yaw` is the head's heading in radians, where
 * yaw 0 looks down -Z.
 */
export function fallbackPosition(
  head: { x: number; y: number; z: number },
  yaw: number,
): { x: number; y: number; z: number } {
  return {
    x: head.x - Math.sin(yaw) * LAYOUT.fallbackForward,
    y: head.y - LAYOUT.fallbackBelowEye,
    z: head.z - Math.cos(yaw) * LAYOUT.fallbackForward,
  };
}

/** Shortest distance from a point to a polygon's edges (x/z). */
export function distanceToEdges(x: number, z: number, points: ReadonlyArray<{ x: number; z: number }>): number {
  let best = Infinity;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[j];
    const b = points[i];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len2 = dx * dx + dz * dz || 1e-12;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / len2));
    best = Math.min(best, Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t)));
  }
  return best;
}

export interface VillageFit {
  /** Village centre in the polygon's space. */
  x: number;
  z: number;
  /** Village scale, between LAYOUT.minVillageScale and 1. */
  scale: number;
  /** True when even the smallest allowed village hangs over the edge. */
  overhang: boolean;
}

/**
 * Where a round village of `radius` fits best on a table polygon. Prefers
 * full size, sliding the centre inward from `prefer` as little as needed;
 * if no spot fits full size it uses the roomiest spot and shrinks the
 * village, never below LAYOUT.minVillageScale (then it overhangs a little).
 * `reachable(x, z)` filters out spots the seated player cannot reach.
 */
export function fitVillage(
  polygon: ReadonlyArray<{ x: number; z: number }>,
  prefer: { x: number; z: number },
  radius: number,
  reachable: (x: number, z: number) => boolean = () => true,
): VillageFit | null {
  if (polygon.length < 3) return null;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of polygon) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  const step = LAYOUT.fitGridStep;
  let best: { x: number; z: number; room: number; dist: number } | null = null;
  for (let x = minX + step / 2; x <= maxX; x += step) {
    for (let z = minZ + step / 2; z <= maxZ; z += step) {
      if (!pointInPolygon(x, z, polygon) || !reachable(x, z)) continue;
      // Room for the village here, capped at full size, in 5 mm steps.
      const room = Math.floor(Math.min(distanceToEdges(x, z, polygon), radius) / 0.005) * 0.005;
      const dist = Math.hypot(x - prefer.x, z - prefer.z);
      if (!best || room > best.room + 1e-9 || (Math.abs(room - best.room) < 1e-9 && dist < best.dist)) {
        best = { x, z, room, dist };
      }
    }
  }
  if (!best) return null;
  const scale = Math.max(LAYOUT.minVillageScale, Math.min(1, best.room / radius));
  return { x: best.x, z: best.z, scale, overhang: best.room < radius * scale - 1e-6 };
}
