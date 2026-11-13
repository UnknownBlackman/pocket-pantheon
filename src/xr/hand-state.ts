/**
 * Per-frame hand data shared between systems. HandGestureSystem writes it;
 * PowerSystem, PauseSystem and UI read it. World-space metres.
 */
import { JOINT_COUNT } from './gestures.ts';
import type { Handedness, V3 } from './gestures.ts';

export interface HandData {
  handedness: Handedness;
  tracked: boolean;
  /** Seconds since tracking (re)started for this hand. */
  trackedFor: number;
  joints: Float32Array;
  palm: V3;
  normal: V3;
  indexTip: V3;
  /** Smoothed palm speed, metres per second. */
  palmSpeed: number;
  pinching: boolean;
  poke: boolean;
  open: boolean;
  palmDown: boolean;
}

function makeHand(handedness: Handedness): HandData {
  return {
    handedness,
    tracked: false,
    trackedFor: 0,
    joints: new Float32Array(JOINT_COUNT * 3),
    palm: { x: 0, y: 0, z: 0 },
    normal: { x: 0, y: 1, z: 0 },
    indexTip: { x: 0, y: 0, z: 0 },
    palmSpeed: 0,
    pinching: false,
    poke: false,
    open: false,
    palmDown: false,
  };
}

export const hands = {
  left: makeHand('left'),
  right: makeHand('right'),
  /** Seconds since the XR session became visible (reset on each session). */
  sessionTime: 0,
  /** True once any hand joint data has arrived this session. */
  everTracked: false,
};

export const HANDEDNESS: readonly Handedness[] = ['left', 'right'];
