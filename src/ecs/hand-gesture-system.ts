/**
 * Reads WebXR hand joints every frame (fillPoses, no per-frame allocation
 * after warm-up) and classifies each hand with the pure functions in
 * xr/gestures.ts. Results go into the shared `hands` state.
 */
import { createSystem, Matrix4, Vector3, VisibilityState } from '@iwsdk/core';
import {
  JOINT_COUNT,
  isOpenHand,
  isPalmDown,
  isPokePose,
  joint,
  J,
  palmCenter,
  palmNormal,
  pinchDistance,
  updatePinch,
} from '../xr/gestures.ts';
import { hands, HANDEDNESS } from '../xr/hand-state.ts';
import type { HandData } from '../xr/hand-state.ts';

/** `fillPoses` is part of WebXR Hand Input but missing from some type packages. */
type FrameWithFillPoses = XRFrame & {
  fillPoses?: (spaces: XRSpace[], baseSpace: XRSpace, transforms: Float32Array) => boolean;
};

export class HandGestureSystem extends createSystem({}) {
  private spaces: Record<'left' | 'right', { hand: XRHand | null; list: XRJointSpace[] }> = {
    left: { hand: null, list: [] },
    right: { hand: null, list: [] },
  };
  private matrices = new Float32Array(JOINT_COUNT * 16);
  private tmp = new Vector3();
  private originMatrix = new Matrix4();
  private lastPalm = { x: 0, y: 0, z: 0 };

  init(): void {
    this.cleanupFuncs.push(
      this.world.visibilityState.subscribe((vis) => {
        if (vis === VisibilityState.NonImmersive) {
          hands.sessionTime = 0;
          hands.everTracked = false;
          hands.left.tracked = hands.right.tracked = false;
        }
      }),
    );
  }

  update(delta: number): void {
    const frame = this.xrFrame as XRFrame | undefined;
    const ref = this.renderer.xr.getReferenceSpace();
    if (this.world.visibilityState.peek() === VisibilityState.NonImmersive || !frame || !ref) {
      hands.left.tracked = hands.right.tracked = false;
      return;
    }
    hands.sessionTime += delta;
    this.player.updateMatrixWorld();
    this.originMatrix.copy(this.player.matrixWorld);
    for (const h of HANDEDNESS) this.readHand(h, frame, ref, delta);
  }

  private readHand(h: 'left' | 'right', frame: XRFrame, ref: XRReferenceSpace, delta: number): void {
    const data = hands[h];
    let source: XRInputSource | undefined;
    try {
      source = this.input.xr.getPrimaryInputSource(h);
    } catch {
      source = undefined;
    }
    const xrHand = source?.hand ?? null;
    if (!xrHand) {
      data.tracked = false;
      data.pinching = data.poke = data.open = data.palmDown = false;
      return;
    }
    const cache = this.spaces[h];
    if (cache.hand !== xrHand) {
      cache.hand = xrHand;
      cache.list = Array.from(xrHand.values());
    }
    let ok = false;
    try {
      const fill = (frame as FrameWithFillPoses).fillPoses;
      if (typeof fill === 'function') {
        ok = fill.call(frame, cache.list, ref, this.matrices);
      } else {
        ok = true;
        for (let i = 0; i < cache.list.length; i++) {
          const pose = frame.getJointPose?.(cache.list[i], ref);
          if (!pose) {
            ok = false;
            break;
          }
          this.matrices.set(pose.transform.matrix, i * 16);
        }
      }
    } catch {
      ok = false;
    }
    if (!ok) {
      data.tracked = false;
      return;
    }

    const j = data.joints;
    for (let i = 0; i < JOINT_COUNT; i++) {
      this.tmp
        .set(this.matrices[i * 16 + 12], this.matrices[i * 16 + 13], this.matrices[i * 16 + 14])
        .applyMatrix4(this.originMatrix);
      j[i * 3] = this.tmp.x;
      j[i * 3 + 1] = this.tmp.y;
      j[i * 3 + 2] = this.tmp.z;
    }
    data.tracked = true;
    hands.everTracked = true;

    this.lastPalm.x = data.palm.x;
    this.lastPalm.y = data.palm.y;
    this.lastPalm.z = data.palm.z;
    palmCenter(j, data.palm);
    palmNormal(j, h, data.normal);
    joint(j, J.indexTip, data.indexTip);
    if (delta > 0) {
      const dx = data.palm.x - this.lastPalm.x;
      const dy = data.palm.y - this.lastPalm.y;
      const dz = data.palm.z - this.lastPalm.z;
      const speed = Math.sqrt(dx * dx + dy * dy + dz * dz) / delta;
      data.palmSpeed += (Math.min(speed, 2) - data.palmSpeed) * Math.min(1, delta * 8);
    }
    data.pinching = updatePinch(data.pinching, pinchDistance(j));
    data.poke = !data.pinching && isPokePose(j);
    data.open = isOpenHand(j);
    data.palmDown = isPalmDown(j, data.normal);
  }
}

export type { HandData };
