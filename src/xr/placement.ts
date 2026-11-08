/**
 * Pure placement helpers (no Three.js): choosing a table plane and computing
 * the fallback platform pose. Kept pure so they can be unit-tested.
 */
import { LAYOUT } from '../sim/rules.ts';

export type PlacementSource = 'plane' | 'hit-test' | 'fallback';

export interface PlaneCandidate {
  /** Height of the plane centre above the floor, metres. */
  height: number;
  /** Polygon area, square metres. */
  area: number;
  horizontal: boolean;
  /** Semantic label if the device exposes one (e.g. 'table'). */
  label?: string;
}

/** Area of a planar polygon given as x/z points (shoelace formula). */
export function polygonArea(points: ReadonlyArray<{ x: number; z: number }>): number {
  let a = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    a += (points[j].x + points[i].x) * (points[j].z - points[i].z);
  }
  return Math.abs(a / 2);
}

/**
 * Picks the best table: a plane labelled 'table' wins; otherwise the largest
 * horizontal plane between tableMinHeight and tableMaxHeight above the floor.
 * Returns the index of the chosen candidate or -1.
 */
export function pickTablePlane(candidates: ReadonlyArray<PlaneCandidate>): number {
  let best = -1;
  let bestScore = -Infinity;
  candidates.forEach((c, i) => {
    if (!c.horizontal) return;
    const labelled = c.label?.toLowerCase() === 'table';
    const inRange = c.height >= LAYOUT.tableMinHeight && c.height <= LAYOUT.tableMaxHeight;
    if (!labelled && !inRange) return;
    const score = (labelled ? 100 : 0) + c.area;
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
