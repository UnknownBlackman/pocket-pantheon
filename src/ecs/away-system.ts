/**
 * The village waits for its god: when the player walks more than AWAY.distance
 * from the village for AWAY.seconds, the day clock holds (SimSystem) and the
 * music softens. Coming back within AWAY.returnDistance resumes it with a
 * hero's welcome (ecs/return-ritual.ts).
 */
import { createSystem, Vector3, VisibilityState } from '@iwsdk/core';
import type { Entity } from '@iwsdk/core';
import { chime } from '../audio/sfx.ts';
import { AWAY } from '../sim/rules.ts';
import { showToast } from '../ui/ui-state.ts';
import { VillageRoot } from './components.ts';
import { game } from './game.ts';
import { returnRitual } from './return-ritual.ts';

export class AwaySystem extends createSystem({
  roots: { required: [VillageRoot] },
}) {
  private far = 0;
  private head = new Vector3();
  private centre = new Vector3();

  private root(): Entity | undefined {
    for (const e of this.queries.roots.entities) return e;
    return undefined;
  }

  update(delta: number): void {
    const inXR = this.world.visibilityState.peek() !== VisibilityState.NonImmersive;
    const obj = this.root()?.object3D;
    if (!inXR || !obj || game.stage !== 'playing' || game.moving) {
      this.far = 0;
      if (game.godAway) game.godAway = false;
      return;
    }
    this.player.head.getWorldPosition(this.head);
    obj.getWorldPosition(this.centre);
    const d = Math.hypot(this.head.x - this.centre.x, this.head.z - this.centre.z);

    if (!game.godAway) {
      this.far = d > AWAY.distance ? this.far + delta : 0;
      if (this.far >= AWAY.seconds) {
        game.godAway = true;
        console.info(`[away] the god walked away (${d.toFixed(2)} m); the village waits`);
      }
      return;
    }
    if (d < AWAY.returnDistance) {
      game.godAway = false;
      this.far = 0;
      console.info('[away] the god is back');
      chime();
      showToast('Welcome back', 'The village waited for you.', 4);
      returnRitual();
    }
  }
}
