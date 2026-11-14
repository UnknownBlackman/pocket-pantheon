/**
 * The deliberate "lift the village like a tray" gesture: both hands open,
 * palms up, at opposite edges of the village, near its surface and still.
 * Pure maths on plain vectors (world space), so it can be unit-tested.
 */
import { CARRY } from '../sim/rules.ts';

export interface V3 {
  x: number;
  y: number;
  z: number;
}

export interface CarryHand {
  tracked: boolean;
  open: boolean;
  /** Palm centre, world space. */
  palm: V3;
  /** Palm normal (out of the palm), world space. */
  normal: V3;
  palmSpeed: number;
}

/**
 * True when both hands hold the lifting pose around a village whose surface
 * centre is `centre` and whose radius (world metres, scale included) is `radius`.
 */
export function liftPose(left: CarryHand, right: CarryHand, centre: V3, radius: number): boolean {
  const dirs: { x: number; z: number }[] = [];
  for (const h of [left, right]) {
    if (!h.tracked || !h.open) return false;
    if (h.normal.y < CARRY.palmUpDot || h.palmSpeed > CARRY.stillSpeed) return false;
    const above = h.palm.y - centre.y;
    if (above < CARRY.minAbove || above > CARRY.maxAbove) return false;
    const dx = h.palm.x - centre.x;
    const dz = h.palm.z - centre.z;
    const d = Math.hypot(dx, dz);
    if (d < radius * CARRY.edgeInner || d > radius * CARRY.edgeOuter) return false;
    dirs.push({ x: dx / d, z: dz / d });
  }
  return dirs[0].x * dirs[1].x + dirs[0].z * dirs[1].z < CARRY.oppositeDot;
}

/** While carrying: true when the god lets go (a hand lost or turned over, or spread wide). */
export function carryReleased(left: CarryHand, right: CarryHand, startSpread: number): boolean {
  if (!left.tracked || !right.tracked) return true;
  if (left.normal.y < CARRY.releaseDot || right.normal.y < CARRY.releaseDot) return true;
  return handSpread(left, right) > startSpread + CARRY.releaseSpread;
}

/** Horizontal distance between the palms. */
export function handSpread(left: CarryHand, right: CarryHand): number {
  return Math.hypot(left.palm.x - right.palm.x, left.palm.z - right.palm.z);
}
