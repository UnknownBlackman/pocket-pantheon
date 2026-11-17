/**
 * Turns hand gestures into god powers.
 * - Bless: poke a villager or a building with the index finger (other
 *   fingers curled) and hold 1 s. Spends 1 Favor, shows sparkles.
 * - Rain: open palm facing down 5-30 cm above a field, held still 0.5 s.
 * - Shelter: both palms down over the village, wrists 10-25 cm apart, 0.7 s
 *   (wins over Rain); or one palm down over open ground for 1.5 s.
 * - Calm: during a storm, rest a hand in one of the little storm clouds and
 *   hold it there; a ring under the cloud fills and the cloud fades (a
 *   little Favor each). Calming every cloud ends the storm.
 * A ring on the diorama fills while any hold charges. During the tutorial
 * only the current step's power works (sim/tutorial.ts guideAllows).
 */
import { createSystem, Grabbed, Vector3 } from '@iwsdk/core';
import type { Entity } from '@iwsdk/core';
import { makeProgressRing, makeSparkles, setRingProgress } from '../art/effects-art.ts';
import type { ProgressRing } from '../art/effects-art.ts';
import { buzz, chime, rainSound, shelterSound, whoosh } from '../audio/sfx.ts';
import { SIDES } from '../sim/presence.ts';
import type { HandSide } from '../sim/types.ts';
import { guideAllows } from '../sim/tutorial.ts';
import { stormCloudSpot, swatCloud } from '../sim/storm.ts';
import { makeRainCloud, makeShelterDome, rainCloudHeight } from '../art/weather-art.ts';
import { events } from '../core/events.ts';
import { blessBuilding, blessVillager, rain, shelter } from '../sim/powers.ts';
import { GESTURES, LAYOUT, RULES, STORM } from '../sim/rules.ts';
import { wristsApartForShelter } from '../xr/gestures.ts';
import { choosePalmPower } from '../xr/palm-powers.ts';
import type { PalmInput, PalmMode } from '../xr/palm-powers.ts';
import { hands, HANDEDNESS } from '../xr/hand-state.ts';
import type { HandData } from '../xr/hand-state.ts';
import { BuildingView, PowerEffect, VillageRoot, VillagerView } from './components.ts';
import { game } from './game.ts';
import { guideNudge } from './guide-nudge.ts';
import { makeOccludable } from './occlusion.ts';

const BLESS_COLOR = 0xffd36b;
const RAIN_COLOR = 0x6cc4ff;
const SHELTER_COLOR = 0xffe7a8;
const FAIL_COLOR = 0xff6a5a;
const CALM_COLOR = 0xbfe3ff;
/** A palm counts as in a cloud this far above or below its middle (metres). */
const CALM_VERTICAL = 0.04;
/** A held-back action nudges the player after this long. */
const NUDGE_AFTER = 0.5;
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
  private palmLocal = { left: new Vector3(), right: new Vector3() };
  private palmIn: Record<'left' | 'right', PalmInput> = {
    left: { tracked: false, trackedFor: 0, palmDown: false, speed: 0, height: 0, distance: 0, overField: false },
    right: { tracked: false, trackedFor: 0, palmDown: false, speed: 0, height: 0, distance: 0, overField: false },
  };
  private palmMode: PalmMode = 'none';
  private palmHold = 0;
  private palmFired = false;
  private palmCooldown = 0;
  private palmX = 0;
  private palmZ = 0;
  /** Height above the table of the palm calling rain (the cloud forms just under it). */
  private palmHeight = 0;
  private palmRing: ProgressRing | null = null;
  private palmHeldBack = 0;

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
    const active = game.stage === 'playing' && !game.paused && !game.moving && !!rootObj && game.sim.phase === 'day';
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
    if (active) this.updateCalm(delta);
    else this.resetCalm();
    if (active) this.updatePalmPowers(delta);
    else this.resetPalm();
  }

  // ---------------------------------------------------------------- Calming the storm

  private calm: Record<HandSide, { cloud: number; hold: number; ring: ProgressRing | null }> = {
    left: { cloud: -1, hold: 0, ring: null },
    right: { cloud: -1, hold: 0, ring: null },
  };
  private calmBuzzIn = 0;
  private calmBlocked = 0;

  /** True while either hand is resting in a cloud (palm powers wait). */
  private calming(): boolean {
    return this.calm.left.cloud >= 0 || this.calm.right.cloud >= 0;
  }

  private resetCalm(): void {
    for (const side of SIDES) {
      const c = this.calm[side];
      c.cloud = -1;
      c.hold = 0;
      if (c.ring) c.ring.visible = false;
    }
  }

  /** The cloud a hand is resting in, or -1. */
  private cloudUnder(side: HandSide): number {
    const sim = game.sim;
    const h = game.presence.hands[side];
    if (!h.present || h.speed > STORM.calmMaxSpeed) return -1;
    let best = -1;
    let bestD: number = STORM.calmReach;
    for (let i = 0; i < sim.stormClouds.length; i++) {
      if (!sim.stormClouds[i]) continue;
      const c = stormCloudSpot(i);
      if (Math.abs(h.y - c.y) > CALM_VERTICAL) continue;
      const d = Math.hypot(h.x - c.x, h.z - c.z);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  /**
   * Like a blessing: rest a hand in a storm cloud and hold it there until the
   * ring fills, and the cloud calms (a little Favor each).
   */
  private updateCalm(delta: number): void {
    this.calmBuzzIn = Math.max(0, this.calmBuzzIn - delta);
    const sim = game.sim;
    if (sim.weather !== 'storm') {
      this.resetCalm();
      this.calmBlocked = 0;
      return;
    }
    const allowed = guideAllows(sim, 'calm');
    let tried = false;
    for (const side of SIDES) {
      const c = this.calm[side];
      const cloud = this.cloudUnder(side);
      if (cloud >= 0 && !allowed) tried = true;
      if (cloud < 0 || !allowed) {
        c.cloud = -1;
        c.hold = 0;
        if (c.ring) c.ring.visible = false;
        continue;
      }
      // The other hand already has this cloud.
      const other = this.calm[side === 'left' ? 'right' : 'left'];
      if (other.cloud === cloud && side === 'right') {
        c.cloud = -1;
        if (c.ring) c.ring.visible = false;
        continue;
      }
      if (cloud !== c.cloud) {
        c.cloud = cloud;
        c.hold = 0;
      }
      c.hold += delta;
      const progress = Math.min(1, c.hold / STORM.calmHoldSeconds);
      const ring = this.calmRing(side);
      if (ring) {
        const spot = stormCloudSpot(cloud);
        ring.visible = true;
        ring.position.set(spot.x, LAYOUT.baseHeight + 0.004, spot.z);
        setRingProgress(ring, progress, CALM_COLOR);
      }
      if (progress < 1) continue;
      const result = swatCloud(sim, cloud, events);
      c.cloud = -1;
      c.hold = 0;
      if (result === 'swatted' || result === 'calmed') {
        console.info(`[calm] cloud ${cloud} ${result}`);
        whoosh();
        if (result === 'calmed') chime();
      } else if (result === 'no-favor') {
        if (ring) setRingProgress(ring, 1, FAIL_COLOR);
        if (this.calmBuzzIn <= 0) {
          buzz();
          this.calmBuzzIn = 1.5;
        }
      }
    }
    this.calmBlocked = tried ? this.calmBlocked + delta : 0;
    if (this.calmBlocked > NUDGE_AFTER) guideNudge();
  }

  private calmRing(side: HandSide): ProgressRing | null {
    const c = this.calm[side];
    if (c.ring) return c.ring;
    const root = this.root();
    if (!root) return null;
    c.ring = makeProgressRing(0.03, CALM_COLOR);
    this.world.createTransformEntity(c.ring, { parent: root, persistent: true });
    return c.ring;
  }

  // ---------------------------------------------------------------- Rain / Shelter

  /** Fills a palm-power input for one hand, in village space. */
  private samplePalm(hand: HandData, local: Vector3, out: PalmInput): void {
    const rootObj = this.root()?.object3D;
    out.tracked = hand.tracked && !!rootObj;
    out.trackedFor = hand.trackedFor;
    out.palmDown = hand.palmDown;
    out.speed = hand.palmSpeed;
    if (!out.tracked) return;
    local.set(hand.palm.x, hand.palm.y, hand.palm.z);
    rootObj!.worldToLocal(local);
    out.height = local.y - LAYOUT.baseHeight;
    out.distance = Math.hypot(local.x, local.z);
    out.overField = this.fieldUnder(local.x, local.z) !== null;
  }

  private fieldUnder(x: number, z: number): { x: number; z: number } | null {
    const reach = LAYOUT.fieldSize / 2 + 0.02;
    for (const b of game.sim.buildings) {
      if (b.kind === 'field' && Math.abs(b.pos.x - x) < reach && Math.abs(b.pos.z - z) < reach) return b.pos;
    }
    return null;
  }

  /** Palm powers wait while the hands or villagers are busy with something else. */
  private palmBlocked(): boolean {
    if (this.calming()) return true;
    if (hands.left.pinching || hands.right.pinching) return true;
    if (game.presence.hideHand !== null) return true;
    for (const v of game.sim.villagers) if (v.carried || v.ride !== 'none') return true;
    return false;
  }

  private resetPalm(): void {
    this.palmMode = 'none';
    this.palmHold = 0;
    this.palmFired = false;
    if (this.palmRing) this.palmRing.visible = false;
  }

  private updatePalmPowers(delta: number): void {
    this.palmCooldown = Math.max(0, this.palmCooldown - delta);
    this.samplePalm(hands.left, this.palmLocal.left, this.palmIn.left);
    this.samplePalm(hands.right, this.palmLocal.right, this.palmIn.right);
    const apart =
      hands.left.tracked && hands.right.tracked && wristsApartForShelter(hands.left.joints, hands.right.joints);
    const choice = choosePalmPower(this.palmIn.left, this.palmIn.right, apart, this.palmBlocked());
    const mode: PalmMode = choice.mode;
    const need = choice.hold;
    if (mode === 'shelter2') {
      this.palmX = (this.palmLocal.left.x + this.palmLocal.right.x) / 2;
      this.palmZ = (this.palmLocal.left.z + this.palmLocal.right.z) / 2;
    } else if (choice.hand) {
      const p = this.palmLocal[choice.hand];
      this.palmHeight = this.palmIn[choice.hand].height;
      const field = mode === 'rain' ? this.fieldUnder(p.x, p.z) : null;
      this.palmX = field ? field.x : p.x;
      this.palmZ = field ? field.z : p.z;
    }

    if (mode === 'none') {
      this.resetPalm();
      this.palmHeldBack = 0;
      return;
    }
    // The tutorial holds back powers it has not taught yet.
    const sim0 = game.sim;
    if (!guideAllows(sim0, mode === 'rain' ? 'rain' : 'shelter')) {
      this.resetPalm();
      this.palmHeldBack += delta;
      if (this.palmHeldBack > NUDGE_AFTER) guideNudge();
      return;
    }
    this.palmHeldBack = 0;
    if (mode !== this.palmMode) {
      this.palmMode = mode;
      this.palmHold = 0;
      this.palmFired = false;
    }
    // A power fires once per pose; a short cooldown stops a quick re-entry.
    if (!this.palmFired && this.palmCooldown > 0) {
      if (this.palmRing) this.palmRing.visible = false;
      return;
    }
    const ring = this.ensurePalmRing();
    const color = mode === 'rain' ? RAIN_COLOR : SHELTER_COLOR;
    if (ring) {
      ring.visible = true;
      ring.position.set(this.palmX, LAYOUT.baseHeight + 0.004, this.palmZ);
      ring.scale.setScalar(mode === 'rain' ? 1 : 1.6);
    }
    if (this.palmFired) return;
    this.palmHold += delta;
    const progress = Math.min(1, this.palmHold / need);
    if (ring) setRingProgress(ring, progress, color);
    if (progress < 1) return;

    this.palmFired = true;
    const sim = game.sim;
    const ok =
      mode === 'rain'
        ? rain(sim, this.palmX, this.palmZ, events)
        : shelter(sim, this.palmX, this.palmZ, events);
    if (ok) {
      if (mode === 'rain') rainSound();
      else shelterSound();
      this.spawnWeatherEffect(mode === 'rain' ? 'rain' : 'shelter', this.palmX, this.palmZ);
      console.info(`[power] ${mode} at (${this.palmX.toFixed(2)}, ${this.palmZ.toFixed(2)}); Favor now ${sim.favor.toFixed(1)}`);
      this.palmCooldown = GESTURES.powerCooldownSeconds;
    } else {
      buzz();
      if (ring) setRingProgress(ring, 1, FAIL_COLOR);
      const kind = mode === 'rain' ? 'rain' : 'shelter';
      const need = kind === 'rain' ? RULES.powers.rainCost : RULES.powers.shelterCost;
      events.emit('power.failed', { kind, need, have: sim.favor });
      console.info(`[power] ${mode} needs more Favor, have ${sim.favor.toFixed(1)}`);
    }
  }

  private ensurePalmRing(): ProgressRing | null {
    if (this.palmRing) return this.palmRing;
    const root = this.root();
    if (!root) return null;
    this.palmRing = makeProgressRing(0.05, RAIN_COLOR);
    this.world.createTransformEntity(this.palmRing, { parent: root, persistent: true });
    return this.palmRing;
  }

  private spawnWeatherEffect(kind: 'rain' | 'shelter', x: number, z: number): void {
    const root = this.root();
    if (!root) return;
    const obj =
      kind === 'rain'
        ? makeRainCloud(RULES.powers.rainRadius, rainCloudHeight(this.palmHeight))
        : makeShelterDome(RULES.powers.shelterRadius);
    obj.position.set(x, LAYOUT.baseHeight, z);
    const e = this.world.createTransformEntity(obj, { parent: root });
    e.addComponent(PowerEffect, {
      kind,
      age: 0,
      duration: kind === 'rain' ? RULES.powers.rainSeconds : RULES.powers.shelterSeconds,
      radius: kind === 'rain' ? RULES.powers.rainRadius : RULES.powers.shelterRadius,
    });
    makeOccludable(e);
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
      if (game.sim.villagers[e.getValue(VillagerView, 'simIndex') ?? -1]?.dead) continue;
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
    if (!guideAllows(game.sim, 'bless')) {
      // Touching a villager before the bless step: no ring, just a reminder
      // if the finger stays.
      state.hold += delta;
      if (ring) ring.visible = false;
      if (state.hold > NUDGE_AFTER + 0.5) guideNudge();
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
      console.info(`[power] bless on ${state.kind} ${state.index}; Favor now ${sim.favor.toFixed(1)}`);
    } else {
      buzz();
      state.failFlash = 0.8;
      events.emit('power.failed', { kind: 'bless', need: RULES.powers.blessCost, have: sim.favor });
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
    makeOccludable(e);
  }
}
