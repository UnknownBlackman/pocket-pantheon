/**
 * Runs the first-visit guided tutorial (sim/tutorial.ts) in the world:
 * feeds the player's actions to the guide, has Elder Ama say each step's
 * line (repeated every 12 s until done), and places a pulsing gold marker
 * with a bobbing arrow on what to do next. The hint panel shows the step's
 * instructions and a Skip button (UISystem).
 */
import { createSystem } from '@iwsdk/core';
import type { Entity, Group } from '@iwsdk/core';
import { makeGuideMarker } from '../art/guide-art.ts';
import { chime } from '../audio/sfx.ts';
import { events } from '../core/events.ts';
import { LAYOUT, RULES } from '../sim/rules.ts';
import { guideElder, guideEvent, guideField, guideStep } from '../sim/tutorial.ts';
import type { GuideEvent } from '../sim/tutorial.ts';
import { say } from '../ui/speech.ts';
import { showToast } from '../ui/ui-state.ts';
import { VillageRoot } from './components.ts';
import { game } from './game.ts';

const REPEAT_SECONDS = 12;

export class GuideSystem extends createSystem({
  roots: { required: [VillageRoot] },
}) {
  private marker: Group | null = null;
  private sayIn = 0;

  init(): void {
    const feed = (e: GuideEvent) => {
      if (!game.sim.guide.active) return;
      if (guideEvent(game.sim, e, events)) chime();
    };
    this.cleanupFuncs.push(
      events.on('villager.inspected', () => feed({ kind: 'inspected' })),
      events.on('villager.dropped', (e) => feed({ kind: 'dropped', building: e.buildingId })),
      events.on('power.used', (e) => feed({ kind: 'power', power: e.kind })),
      events.on('villager.climbed', () => feed({ kind: 'climbed' })),
      events.on('storm.calmed', () => feed({ kind: 'calmed' })),
      events.on('god.waved', () => feed({ kind: 'waved' })),
      events.on('session.paused', (e) => {
        if (e.paused) feed({ kind: 'paused' });
      }),
      events.on('guide.step', (e) => {
        this.sayIn = 0.5; // the elder speaks shortly after a new step
        if (e.step === 'done') {
          showToast('You are ready, great one', 'The first day begins. Guide them well, but not too much.', 8);
        }
      }),
    );
  }

  private root(): Entity | undefined {
    for (const e of this.queries.roots.entities) return e;
    return undefined;
  }

  update(delta: number, time: number): void {
    const step = game.stage === 'playing' ? guideStep(game.sim) : null;
    const root = this.root();
    if (!step || !root) {
      if (this.marker) this.marker.visible = false;
      return;
    }
    const sim = game.sim;
    const elder = guideElder(sim);
    const elderIndex = elder ? sim.villagers.indexOf(elder) : -1;

    // Elder Ama speaks the step's line, and repeats it now and then.
    this.sayIn -= delta;
    if (this.sayIn <= 0 && !game.paused) {
      this.sayIn = REPEAT_SECONDS;
      say(elderIndex, step.elder, 5, true);
    }

    // The marker shows what to do next.
    if (!this.marker) {
      this.marker = makeGuideMarker();
      this.world.createTransformEntity(this.marker, { parent: root, persistent: true });
    }
    let x = 0;
    let z = 0;
    let show = true;
    switch (step.target) {
      case 'elder':
        if (elder) {
          x = elder.pos.x;
          z = elder.pos.z;
        } else show = false;
        break;
      case 'field':
      case 'dry-field': {
        const f = guideField(sim);
        if (f) {
          x = f.pos.x;
          z = f.pos.z;
        } else show = false;
        break;
      }
      case 'edge':
        // The right-hand rim, nearest the player's right hand.
        x = RULES.village.radius * 0.8;
        z = RULES.village.radius * 0.45;
        break;
      case 'village':
        break;
      case 'none':
        show = false;
        break;
    }
    const m = this.marker;
    m.visible = show;
    if (!show) return;
    m.position.set(x, LAYOUT.baseHeight, z);
    const pulse = 1 + Math.sin(time * 4) * 0.12;
    const ring = m.children[0];
    ring.scale.setScalar(step.target === 'village' ? 2.2 * pulse : pulse);
    const arrow = m.children[1];
    arrow.position.y = 0.08 + Math.sin(time * 3) * 0.008;
    arrow.rotation.y = time * 1.5;
  }
}
