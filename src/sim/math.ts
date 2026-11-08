import type { Vec2 } from './types.ts';

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;

export function dist(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

/** Moves `pos` towards `target` by at most `step`. Returns true when arrived. */
export function stepTowards(pos: Vec2, target: Vec2, step: number): boolean {
  const dx = target.x - pos.x;
  const dz = target.z - pos.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  if (d <= step || d === 0) {
    pos.x = target.x;
    pos.z = target.z;
    return true;
  }
  pos.x += (dx / d) * step;
  pos.z += (dz / d) * step;
  return false;
}

/** Keeps a point inside a circle of `radius` around the origin. */
export function clampToDisc(pos: Vec2, radius: number): void {
  const d = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
  if (d > radius) {
    pos.x = (pos.x / d) * radius;
    pos.z = (pos.z / d) * radius;
  }
}
