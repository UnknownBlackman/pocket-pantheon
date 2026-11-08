/**
 * Turns hand gestures into god powers. Day 6: Bless — poke a villager or a
 * building with the index finger (other fingers curled) and hold for 1 s; a
 * ring under the target fills while holding. Spends 1 Favor, shows sparkles.
 */
import { createSystem, Grabbed, Vector3 } from '@iwsdk/core';
import type { Entity } from '@iwsdk/core';
import { makeProgressRing, makeSparkles, setRingProgress } from '../art/effects-art.ts';
import type { ProgressRing } from '../art/effects-art.ts';
import { buzz, chime } from '../audio/sfx.ts';
import { events } from '../core/events.ts';
import { blessBuilding, blessVillager } from '../sim/powers.ts';
import { GESTURES, LAYOUT, RULES } from '../sim/rules.ts';
import { hands, HANDEDNESS } from '../xr/hand-state.ts';
import { BuildingView, PowerEffect, VillageRoot, VillagerView } from './components.ts';
import { game } from './game.ts';

const BLESS_COLOR = 0xffd36b;
const FAIL_COLOR = 0xff6a5a;
/** Height of a villager's body centre above the diorama surface. */
const VILLAGER_CENTRE = 0.02;
const BUILDING_POKE_HEIGHT = 0.12;

interface PokeState {
  kind: 'none' | 'villager' | 'building';
  index: number;
  hold: number;
  fired: boolean;
  failFlash: number;
  ring: ProgressRing | null;
}

const newPoke = (): PokeState => ({ kind: 'none', index: -1, hold: 0, fired: false, failFlash: 0, ring: null });

export class PowerSystem extends createSystem({
  roots: { required: [VillageRoot] },
  villagers: { required: [VillagerView] },
  buildings: { required: [BuildingView] },
}) {
  private poke: Record<'left' | 'right', PokeState> = { left: newPoke(), right: newPoke() };
  private tip = new Vector3();

  private root(): Entity | undefined {
    for (const e of this.queries.roots.entities) return e;
    return undefined;
  }

  /** Rings are child entities of the village so they lie on the diorama. */
  private ring(state: PokeState): ProgressRing | null {
    if (state.ring) return state.ring;
    const root = this.root();
    if (!root) return null;
    state.ring = makeProgressRing(0.022, BLESS_COLOR);
    this.world.createTransformEntity(state.ring, { parent: root, persistent: true });
    return state.ring;
  }

  update(delta: number): void {
    const root = this.root();
    const rootObj = root?.object3D;
    const active = game.stage === 'playing' && !game.paused && !!rootObj && game.sim.phase === 'day';
    for (const h of HANDEDNESS) {
      const state = this.poke[h];
      const hand = hands[h];
      if (!active || !hand.tracked || !hand.poke) {
        this.resetPoke(state);
        continue;
      }
      // Index tip in village-local space.
      this.tip.set(hand.indexTip.x, hand.indexTip.y, hand.indexTip.z);
      rootObj!.worldToLocal(this.tip);
      this.updateBless(state, delta);
    }
  }

  private resetPoke(state: PokeState): void {
    state.kind = 'none';
    state.index = -1;
    state.hold = 0;
    state.fired = false;
    if (state.ring) state.ring.visible = false;
  }

  private findTarget(): { kind: 'villager' | 'building'; index: number; x: number; z: number } | null {
    const t = this.tip;
    const reach = GESTURES.pokeDistance + 0.01;
    let best: { kind: 'villager' | 'building'; index: number; x: number; z: number } | null = null;
    let bestD = reach;
    for (const e of this.queries.villagers.entities) {
      if (e.hasComponent(Grabbed) || !e.object3D) continue;
      const p = e.object3D.position;
      const dx = t.x - p.x;
      const dy = t.y - (p.y + VILLAGER_CENTRE);
      const dz = t.z - p.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < bestD) {
        bestD = d;
        best = { kind: 'villager', index: e.getValue(VillagerView, 'simIndex') ?? -1, x: p.x, z: p.z };
      }
    }
    if (best) return best;
    let bestH: number = GESTURES.buildingPokeRadius;
    for (const e of this.queries.buildings.entities) {
      if (!e.object3D) continue;
      const p = e.object3D.position;
      const h = Math.hypot(t.x - p.x, t.z - p.z);
      const above = t.y - LAYOUT.baseHeight;
      if (h < bestH && above > -0.01 && above < BUILDING_POKE_HEIGHT) {
        bestH = h;
        best = { kind: 'building', index: e.getValue(BuildingView, 'simIndex') ?? -1, x: p.x, z: p.z };
      }
    }
    return best;
  }

  private updateBless(state: PokeState, delta: number): void {
    const target = this.findTarget();
    const ring = this.ring(state);
    if (!target || target.index < 0) {
      this.resetPoke(state);
      return;
    }
    if (target.kind !== state.kind || target.index !== state.index) {
      state.kind = target.kind;
      state.index = target.index;
      state.hold = 0;
      state.fired = false;
    }
    if (ring) {
      ring.visible = true;
      ring.position.set(target.x, LAYOUT.baseHeight + 0.003, target.z);
    }
    if (state.fired) {
      state.failFlash = Math.max(0, state.failFlash - delta);
      if (ring) setRingProgress(ring, 1, state.failFlash > 0 ? FAIL_COLOR : BLESS_COLOR);
      return;
    }
    state.hold += delta;
    const progress = Math.min(1, state.hold / GESTURES.pokeHoldSeconds);
    if (ring) setRingProgress(ring, progress, BLESS_COLOR);
    if (progress < 1) return;

    state.fired = true;
    const sim = game.sim;
    const ok =
      state.kind === 'villager'
        ? blessVillager(sim, sim.villagers[state.index]?.id ?? '', events)
        : blessBuilding(sim, sim.buildings[state.index]?.id ?? '', events);
    if (ok) {
      chime();
      this.spawnSparkles(target.x, target.z);
    } else {
      buzz();
      state.failFlash = 0.8;
      console.info(`[power] bless needs ${RULES.powers.blessCost} Favor, have ${sim.favor.toFixed(1)}`);
    }
  }

  private spawnSparkles(x: number, z: number): void {
    const root = this.root();
    if (!root) return;
    const obj = makeSparkles();
    obj.position.set(x, LAYOUT.baseHeight, z);
    const e = this.world.createTransformEntity(obj, { parent: root });
    e.addComponent(PowerEffect, { kind: 'bless', age: 0, duration: 1.4, radius: 0.03 });
  }
}
