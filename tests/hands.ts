/**
 * Synthetic WebXR hand poses for gesture tests. Builds a right hand with the
 * palm facing down and fingers pointing forward (-Z), then optionally
 * mirrors it to a left hand and rotates it.
 */
type Finger = 'ext' | 'curl';
export interface HandSpec {
  handedness?: 'left' | 'right';
  fingers?: [Finger, Finger, Finger, Finger];
  pinch?: boolean;
  /** Rotation about X (radians) applied around the wrist: -PI/2 points fingers up, palm forward. */
  pitch?: number;
  /** Rotation about Z (radians): PI turns the palm up. */
  roll?: number;
  at?: [number, number, number];
}

const KNUCKLE_X = [-0.03, -0.01, 0.01, 0.03];
const LENGTH = [0.08, 0.085, 0.08, 0.065];

export function makeHand(spec: HandSpec = {}): Float32Array {
  const fingers = spec.fingers ?? ['ext', 'ext', 'ext', 'ext'];
  const pts: number[][] = new Array(25);
  pts[0] = [0, 0, 0];
  // Thumb 1..4
  const thumbTip = [-0.06, 0, -0.06];
  for (let i = 1; i <= 4; i++) {
    const t = i / 4;
    pts[i] = [thumbTip[0] * t, 0, thumbTip[2] * t];
  }
  for (let f = 0; f < 4; f++) {
    const base = 5 + f * 5;
    const x = KNUCKLE_X[f];
    pts[base] = [x * 0.4, 0, -0.025]; // metacarpal base
    pts[base + 1] = [x, 0, -0.09]; // knuckle
    const tip = fingers[f] === 'ext' ? [x, 0, -0.09 - LENGTH[f]] : [x, -0.03, -0.07];
    pts[base + 2] = lerp(pts[base + 1], tip, 0.45);
    pts[base + 3] = lerp(pts[base + 1], tip, 0.8);
    pts[base + 4] = tip;
  }
  if (spec.pinch) pts[4] = [...pts[9]];
  const out = new Float32Array(75);
  const mirror = spec.handedness === 'left' ? -1 : 1;
  const pitch = spec.pitch ?? 0;
  const roll = spec.roll ?? 0;
  const at = spec.at ?? [0, 1, 0];
  pts.forEach((p, i) => {
    let [x, y, z] = [p[0] * mirror, p[1], p[2]];
    // roll about Z
    [x, y] = [x * Math.cos(roll) - y * Math.sin(roll), x * Math.sin(roll) + y * Math.cos(roll)];
    // pitch about X
    [y, z] = [y * Math.cos(pitch) - z * Math.sin(pitch), y * Math.sin(pitch) + z * Math.cos(pitch)];
    out[i * 3] = x + at[0];
    out[i * 3 + 1] = y + at[1];
    out[i * 3 + 2] = z + at[2];
  });
  return out;
}

function lerp(a: number[], b: number[], t: number): number[] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
