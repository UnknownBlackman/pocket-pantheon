/**
 * Fingertip-on-panel hit testing for canvas panels: a button is touched
 * when either index fingertip is within TOUCH_DEPTH of the panel surface
 * and inside the button's canvas rectangle.
 */
import type { Vector3 } from '@iwsdk/core';
import { hands } from '../xr/hand-state.ts';
import type { CanvasPanel } from './canvas-panel.ts';
import type { PanelButton } from './panels.ts';

export const TOUCH_DEPTH = 0.025;

export function touchedButton(
  panel: CanvasPanel,
  buttons: readonly PanelButton[],
  scratch: Vector3,
): string | null {
  const mesh = panel.mesh;
  if (!mesh.visible) return null;
  const size = (mesh.geometry as unknown as { parameters: { width: number; height: number } }).parameters;
  for (const h of [hands.left, hands.right]) {
    if (!h.tracked) continue;
    scratch.set(h.indexTip.x, h.indexTip.y, h.indexTip.z);
    mesh.worldToLocal(scratch);
    if (Math.abs(scratch.z) > TOUCH_DEPTH) continue;
    const px = (scratch.x / size.width + 0.5) * panel.widthPx;
    const py = (0.5 - scratch.y / size.height) * panel.heightPx;
    for (const b of buttons) {
      if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) return b.id;
    }
  }
  return null;
}

/** Press-once tracking: a touch must rest 0.12 s and is reported once until released. */
export class PressTracker {
  private hot: string | null = null;
  private time = 0;
  private latched = true;

  /** Returns the id pressed this frame, if any. Starts latched so a resting finger does not press. */
  update(touched: string | null, delta: number): string | null {
    if (touched && touched === this.hot) this.time += delta;
    else this.time = 0;
    this.hot = touched;
    if (!touched) this.latched = false;
    if (touched && !this.latched && this.time > 0.12) {
      this.latched = true;
      return touched;
    }
    return null;
  }

  reset(): void {
    this.hot = null;
    this.time = 0;
    this.latched = true;
  }
}
