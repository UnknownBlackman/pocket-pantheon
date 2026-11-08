/**
 * Runs the simulation at a fixed rate with an accumulator. Does nothing while
 * placing, paused, or while the XR session is hidden or blurred.
 */
import { createSystem, VisibilityState } from '@iwsdk/core';
import { events } from '../core/events.ts';
import { RULES } from '../sim/rules.ts';
import { tick } from '../sim/world.ts';
import { game } from './game.ts';

const STEP = 1 / RULES.sim.hz;
/** Never simulate more than this much real time in one frame (tab hitches). */
const MAX_FRAME = 0.25;

export class SimSystem extends createSystem({}) {
  private accumulator = 0;

  update(delta: number): void {
    const vis = this.world.visibilityState.peek();
    const hidden = vis === VisibilityState.Hidden || vis === VisibilityState.VisibleBlurred;
    if (game.stage !== 'playing' || game.paused || hidden) {
      this.accumulator = 0;
      return;
    }
    this.accumulator += Math.min(delta, MAX_FRAME);
    while (this.accumulator >= STEP) {
      tick(game.sim, STEP, events);
      this.accumulator -= STEP;
    }
  }
}
