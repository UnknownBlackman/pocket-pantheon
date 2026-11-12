/**
 * Runs the simulation at a fixed rate with an accumulator. Does nothing while
 * placing, paused, outside XR, or while the XR session is hidden or blurred.
 */
import { createSystem, VisibilityState } from '@iwsdk/core';
import { events } from '../core/events.ts';
import { RULES } from '../sim/rules.ts';
import { updatePresence } from '../sim/presence.ts';
import { tick } from '../sim/world.ts';
import { game } from './game.ts';

const STEP = 1 / RULES.sim.hz;
/** Never simulate more than this much real time in one frame (tab hitches). */
const MAX_FRAME = 0.25;

export class SimSystem extends createSystem({}) {
  private accumulator = 0;

  update(delta: number): void {
    // Only an immersive session advances the village. The flat browser
    // preview shows it idling, so the session is not used up before XR.
    const inXR = this.world.visibilityState.peek() === VisibilityState.Visible;
    if (game.stage !== 'playing' || game.paused || !inXR) {
      this.accumulator = 0;
      return;
    }
    this.accumulator += Math.min(delta, MAX_FRAME);
    while (this.accumulator >= STEP) {
      updatePresence(game.sim, game.presence, STEP, events);
      tick(game.sim, STEP, events);
      this.accumulator -= STEP;
    }
  }
}
