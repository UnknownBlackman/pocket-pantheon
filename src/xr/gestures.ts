/**
 * Hand gesture detection as small pure functions over WebXR hand joint
 * positions (no Three.js, no XR objects), so they can be unit-tested with
 * recorded or synthetic poses. Joints are a flat Float32Array of 25 * xyz in
 * the standard WebXR XRHand order. Thresholds live in GESTURES (rules.ts).
 */
import { GESTURES } from '../sim/rules.ts';

export type Handedness = 'left' | 'right';
export type V3 = { x: number; y: number; z: number };

export const JOINT_COUNT = 25;
/** WebXR joint indices. `*Knuckle` is the phalanx-proximal joint. */
export const J = {
  wrist: 0,
  thumbTip: 4,
  indexKnuckle: 6,
  indexTip: 9,
  middleKnuckle: 11,
  middleTip: 14,
  ringKnuckle: 16,
  ringTip: 19,
  pinkyKnuckle: 21,
  pinkyTip: 24,
} as const;

const FINGERS = [
  [J.indexKnuckle, J.indexTip],
  [J.middleKnuckle, J.middleTip],
  [J.ringKnuckle, J.ringTip],
  [J.pinkyKnuckle, J.pinkyTip],
] as const;

const PALM_JOINTS = [J.wrist, J.indexKnuckle, J.middleKnuckle, J.ringKnuckle, J.pinkyKnuckle] as const;

export function joint(j: ArrayLike<number>, i: number, out: V3): V3 {
  out.x = j[i * 3];
  out.y = j[i * 3 + 1];
  out.z = j[i * 3 + 2];
  return out;
}

export function jointDistance(j: ArrayLike<number>, a: number, b: number): number {
  const dx = j[a * 3] - j[b * 3];
  const dy = j[a * 3 + 1] - j[b * 3 + 1];
  const dz = j[a * 3 + 2] - j[b * 3 + 2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function pinchDistance(j: ArrayLike<number>): number {
  return jointDistance(j, J.thumbTip, J.indexTip);
}

/** Pinch with hysteresis: starts under pinchStart, releases over pinchRelease. */
export function updatePinch(wasPinching: boolean, distance: number): boolean {
  return wasPinching ? distance < GESTURES.pinchRelease : distance < GESTURES.pinchStart;
}

/**
 * How far the fingertip reaches beyond its knuckle, measured from the wrist.
 * Positive and large when extended; near zero or negative when curled.
 * Scale-free enough to work across hand sizes.
 */
export function fingerReach(j: ArrayLike<number>, finger: number): number {
  const [knuckle, tip] = FINGERS[finger];
  return jointDistance(j, J.wrist, tip) - jointDistance(j, J.wrist, knuckle);
}

/** 0 = index, 1 = middle, 2 = ring, 3 = pinky. */
export function fingerExtended(j: ArrayLike<number>, finger: number): boolean {
  return fingerReach(j, finger) > GESTURES.fingerExtended;
}

export function fingerCurled(j: ArrayLike<number>, finger: number): boolean {
  return fingerReach(j, finger) < GESTURES.fingerCurled;
}

/** Index pointing, other three fingers curled. */
export function isPokePose(j: ArrayLike<number>): boolean {
  return fingerExtended(j, 0) && fingerCurled(j, 1) && fingerCurled(j, 2) && fingerCurled(j, 3);
}

/** All four fingers extended. */
export function isOpenHand(j: ArrayLike<number>): boolean {
  return fingerExtended(j, 0) && fingerExtended(j, 1) && fingerExtended(j, 2) && fingerExtended(j, 3);
}

/** Centre of the palm: mean of the wrist and the four knuckles. */
export function palmCenter(j: ArrayLike<number>, out: V3): V3 {
  out.x = out.y = out.z = 0;
  for (const i of PALM_JOINTS) {
    out.x += j[i * 3];
    out.y += j[i * 3 + 1];
    out.z += j[i * 3 + 2];
  }
  out.x /= 5;
  out.y /= 5;
  out.z /= 5;
  return out;
}

/**
 * Unit normal pointing out of the palm. Cross product of wrist->index knuckle
 * and wrist->pinky knuckle; mirrored for the left hand.
 */
export function palmNormal(j: ArrayLike<number>, handedness: Handedness, out: V3): V3 {
  const wx = j[0], wy = j[1], wz = j[2];
  const ax = j[J.indexKnuckle * 3] - wx, ay = j[J.indexKnuckle * 3 + 1] - wy, az = j[J.indexKnuckle * 3 + 2] - wz;
  const bx = j[J.pinkyKnuckle * 3] - wx, by = j[J.pinkyKnuckle * 3 + 1] - wy, bz = j[J.pinkyKnuckle * 3 + 2] - wz;
  let nx = ay * bz - az * by;
  let ny = az * bx - ax * bz;
  let nz = ax * by - ay * bx;
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
  const s = handedness === 'right' ? 1 : -1;
  nx = (nx / len) * s;
  ny = (ny / len) * s;
  nz = (nz / len) * s;
  out.x = nx;
  out.y = ny;
  out.z = nz;
  return out;
}

/** Open hand with the palm facing down. */
export function isPalmDown(j: ArrayLike<number>, normal: V3): boolean {
  return normal.y < GESTURES.palmDownDot && isOpenHand(j);
}

/** Open hand with the palm facing the head (pause gesture half). */
export function isPalmFacing(j: ArrayLike<number>, palm: V3, normal: V3, head: V3): boolean {
  const dx = head.x - palm.x;
  const dy = head.y - palm.y;
  const dz = head.z - palm.z;
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  const dot = (normal.x * dx + normal.y * dy + normal.z * dz) / len;
  return dot > GESTURES.palmFacingDot && isOpenHand(j);
}

/** Palm height above a surface is inside the Rain/Shelter band. */
export function inPalmBand(heightAboveSurface: number): boolean {
  return heightAboveSurface >= GESTURES.palmMinHeight && heightAboveSurface <= GESTURES.palmMaxHeight;
}

/** Two palms qualify for two-handed Shelter: wrists 10..25 cm apart. */
export function wristsApartForShelter(a: ArrayLike<number>, b: ArrayLike<number>): boolean {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  return d >= GESTURES.shelterTwoHandMinApart && d <= GESTURES.shelterTwoHandMaxApart;
}

/** Palm-pause: palm between pauseMin/MaxBelowEye below the head. */
export function atChestHeight(palmY: number, headY: number): boolean {
  const below = headY - palmY;
  return below >= GESTURES.pauseMinBelowEye && below <= GESTURES.pauseMaxBelowEye;
}
