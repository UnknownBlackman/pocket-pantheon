/**
 * The visible side of births and deaths:
 * - a newborn gets a villager view at once, with a burst of petals;
 * - the dead lie down and fade (Dying), then their view is removed;
 * - the graveyard inside the palisade shows a headstone for each of the
 *   most recent dead.
 */
import { createSystem, GrabSystem } from '@iwsdk/core';
import type { Entity } from '@iwsdk/core';
import { makeSparkles } from '../art/effects-art.ts';
import { chime } from '../audio/sfx.ts';
import { events } from '../core/events.ts';
import { createGrave } from '../scene-assets/village.scene-asset.ts';
import { LAYOUT, RULES } from '../sim/rules.ts';
import { Dying, GraveView, PowerEffect, VillageRoot, VillagerView } from './components.ts';
import { game } from './game.ts';
import { makeOccludable } from './occlusion.ts';
import { spawnVillagerView } from './village-builder.ts';

/**
 * Graveyard slots: a row just inside the palisade behind the shrine, with a
 * gap for the banner pole (about 257 degrees).
 */
const GRAVE_DEGREES = [244, 250, 264, 270, 276, 282, 288, 294];
const GRAVE_SLOTS = GRAVE_DEGREES.length;
const GRAVE_RADIUS = RULES.village.radius * 0.85;

export function graveSpot(slot: number): { x: number; z: number; yaw: number } {
  const a = (GRAVE_DEGREES[slot] * Math.PI) / 180;
  const x = Math.cos(a) * GRAVE_RADIUS;
  const z = Math.sin(a) * GRAVE_RADIUS;
  return { x, z, yaw: Math.atan2(-x, -z) };
}

export class LifeSystem extends createSystem({
  roots: { required: [VillageRoot] },
  villagers: { required: [VillagerView] },
  dying: { required: [Dying] },
  graves: { required: [GraveView] },
}) {
  private graveProto = createGrave();

  init(): void {
    this.cleanupFuncs.push(
      events.on('villager.born', (e) => this.onBorn(e.index)),
      events.on('villager.died', (e) => this.onDied(e.index)),
    );
  }

  private root(): Entity | undefined {
    for (const e of this.queries.roots.entities) return e;
    return undefined;
  }

  private onBorn(index: number): void {
    const root = this.root();
    const v = game.sim.villagers[index];
    if (!root || !v) return;
    spawnVillagerView(this.world, root, game.sim, index);
    const petals = makeSparkles();
    petals.position.set(v.pos.x, LAYOUT.baseHeight, v.pos.z);
    const fx = this.world.createTransformEntity(petals, { parent: root });
    fx.addComponent(PowerEffect, { kind: 'bless', age: 0, duration: 2.2, radius: 0.04 });
    chime();
  }

  private onDied(index: number): void {
    for (const e of this.queries.villagers.entities) {
      if (e.getValue(VillagerView, 'simIndex') !== index) continue;
      try {
        this.world.getSystem(GrabSystem)?.forceRelease(e);
      } catch {
        /* not held */
      }
      if (!e.hasComponent(Dying)) e.addComponent(Dying, { left: 3 });
    }
  }

  update(delta: number): void {
    // The dead lie down (AnimationSystem) and sink away, then go.
    const doomed: Entity[] = [];
    for (const e of this.queries.dying.entities) {
      const left = (e.getValue(Dying, 'left') ?? 0) - delta;
      e.setValue(Dying, 'left', left);
      const obj = e.object3D;
      if (obj && left < 1) obj.position.y = LAYOUT.baseHeight - (1 - Math.max(0, left)) * 0.012;
      if (left <= 0) doomed.push(e);
    }
    for (const e of doomed) e.destroy(); // shared geometry: destroy, never dispose

    this.syncGraves();
  }

  /** One headstone per recent death, newest replacing the oldest. */
  private syncGraves(): void {
    const graves = game.sim.graves;
    const want = Math.min(graves.length, GRAVE_SLOTS);
    let have = 0;
    for (const _ of this.queries.graves.entities) have++;
    if (have === want) return;
    const root = this.root();
    if (!root) return;
    const old: Entity[] = [];
    for (const e of this.queries.graves.entities) old.push(e);
    for (const e of old) e.destroy();
    const first = graves.length - want;
    for (let slot = 0; slot < want; slot++) {
      const spot = graveSpot(slot);
      const obj = this.graveProto.clone(true);
      obj.position.set(spot.x, LAYOUT.baseHeight, spot.z);
      obj.rotation.y = spot.yaw;
      const e = this.world.createTransformEntity(obj, { parent: root });
      e.addComponent(GraveView, { grave: first + slot });
      makeOccludable(e);
    }
  }
}
