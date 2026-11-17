/**
 * Animates power effects and village feedback: bless sparkles, rain clouds,
 * shelter domes, the storm cloud and the Favor pips on the rim. Transient
 * PowerEffect entities are removed when done.
 */
import { createSystem, Group as GroupCtor } from '@iwsdk/core';
import type { Entity, Group, Mesh, Object3D } from '@iwsdk/core';

/** Drops this close to a palm (horizontally) land on the hand. */
const SPLASH_HAND_RADIUS = 0.055;
const SPLASH_SECONDS = 0.25;
import { PIP_DIM, PIP_HALF, PIP_LIT } from '../art/effects-art.ts';
import { CLOUD_HEIGHT, makeBolt, makeSplashPool, makeStormlet } from '../art/weather-art.ts';
import { thunder } from '../audio/sfx.ts';
import { events } from '../core/events.ts';
import { stormCloudSpot } from '../sim/storm.ts';
import { SIDES } from '../sim/presence.ts';
import { LAYOUT, STORM } from '../sim/rules.ts';
import { FavorPips, PowerEffect, VillageRoot } from './components.ts';
import { game } from './game.ts';
import { makeOccludable } from './occlusion.ts';

export class EffectsSystem extends createSystem({
  effects: { required: [PowerEffect] },
  pips: { required: [FavorPips] },
  roots: { required: [VillageRoot] },
}) {
  private storm: Object3D | null = null;
  private splashes: Group | null = null;
  private nextSplash = 0;

  init(): void {
    this.cleanupFuncs.push(events.on('lightning', (e) => this.strike(e.x, e.z)));
  }

  update(delta: number, time: number): void {
    this.updateStorm(delta, time);
    this.animateSplashes(delta);
    for (const e of this.queries.effects.entities) {
      const age = (e.getValue(PowerEffect, 'age') ?? 0) + delta;
      const duration = e.getValue(PowerEffect, 'duration') ?? 1;
      e.setValue(PowerEffect, 'age', age);
      const obj = e.object3D;
      if (!obj) continue;
      const t = Math.min(1, age / duration);
      const kind = e.getValue(PowerEffect, 'kind');
      if (kind === 'bless') this.animateSparkles(obj.children, t);
      else if (kind === 'bolt') obj.visible = Math.sin(age * 60) > -0.3;
      else this.animateWeather(obj, kind === 'rain', age, duration, time);
      if (age >= duration) e.destroy(); // shared geometry: destroy, never dispose
    }

    const favor = game.sim.favor;
    for (const e of this.queries.pips.entities) {
      const children = e.object3D?.children;
      if (!children) continue;
      for (let i = 0; i < children.length; i++) {
        const pip = children[i] as Mesh;
        const fill = favor - i;
        const mat = fill >= 1 ? PIP_LIT : fill > 0 ? PIP_HALF : PIP_DIM;
        if (pip.material !== mat) pip.material = mat;
        pip.rotation.y = fill >= 1 ? time * 1.5 + i : 0;
      }
    }
  }

  /** Rain cloud or shelter dome: grow in, live, shrink out at the end. */
  private animateWeather(obj: Object3D, isRain: boolean, age: number, duration: number, time: number): void {
    const grow = Math.min(1, age / 0.4);
    const fade = Math.min(1, Math.max(0, (duration - age) / 1.2));
    const s = grow * fade;
    if (isRain) {
      obj.scale.setScalar(Math.max(0.001, s));
      this.animateDrops(obj, time, 1);
    } else {
      const pulse = 1 + Math.sin(time * 3) * 0.015;
      obj.scale.set(Math.max(0.001, s * pulse), Math.max(0.001, s * pulse), Math.max(0.001, s * pulse));
    }
  }

  private animateDrops(obj: Object3D, time: number, level: number): void {
    const children = obj.children;
    // A called rain cloud sits under the palm that called it; others at the usual height.
    const height = (obj.userData.cloudHeight as number | undefined) ?? CLOUD_HEIGHT;
    // Drop positions in village space, to test them against the god's hands.
    const s = obj.scale.x;
    const cos = Math.cos(obj.rotation.y);
    const sin = Math.sin(obj.rotation.y);
    for (let i = 0; i < children.length; i++) {
      const c = children[i];
      if (c.name === 'Cloud') {
        c.position.y = height + Math.sin(time * 0.8) * 0.004;
        continue;
      }
      const phase = ((c.userData.phase as number) + time * 1.6) % 1;
      c.position.y = height * (1 - phase) - 0.005;
      c.visible = level > (c.userData.phase as number) * 0.9;
      if (!c.visible) continue;
      const x = obj.position.x + (c.position.x * cos + c.position.z * sin) * s;
      const z = obj.position.z + (-c.position.x * sin + c.position.z * cos) * s;
      const y = obj.position.y + c.position.y * s;
      const handY = this.handAbove(x, z);
      if (handY === null) {
        c.userData.above = true;
        continue;
      }
      if (y < handY) {
        // The drop hit the back of the god's hand.
        c.visible = false;
        if (c.userData.above) this.splash(x, handY, z);
        c.userData.above = false;
      } else {
        c.userData.above = true;
      }
    }
  }

  /** Village-space height of a hand covering (x, z), or null. */
  private handAbove(x: number, z: number): number | null {
    let best: number | null = null;
    for (const side of SIDES) {
      const h = game.presence.hands[side];
      if (!h.present || h.y < 0.01) continue;
      const dx = x - h.x;
      const dz = z - h.z;
      if (dx * dx + dz * dz > SPLASH_HAND_RADIUS * SPLASH_HAND_RADIUS) continue;
      const y = LAYOUT.baseHeight + h.y + 0.01;
      if (best === null || y > best) best = y;
    }
    return best;
  }

  private splash(x: number, y: number, z: number): void {
    const pool = this.ensureSplashes();
    if (!pool) return;
    const s = pool.children[this.nextSplash];
    this.nextSplash = (this.nextSplash + 1) % pool.children.length;
    s.position.set(x, y, z);
    s.userData.age = 0;
    s.visible = true;
  }

  private ensureSplashes(): Group | null {
    if (this.splashes) return this.splashes;
    let root: Entity | undefined;
    for (const e of this.queries.roots.entities) root = e;
    if (!root) return null;
    // Not occludable: the splash sits on the real hand and must stay visible.
    this.splashes = makeSplashPool(16);
    this.world.createTransformEntity(this.splashes, { parent: root, persistent: true });
    return this.splashes;
  }

  private animateSplashes(delta: number): void {
    const pool = this.splashes;
    if (!pool) return;
    for (const s of pool.children) {
      if (!s.visible) continue;
      const age = (s.userData.age as number) + delta;
      s.userData.age = age;
      const t = age / SPLASH_SECONDS;
      if (t >= 1) {
        s.visible = false;
        continue;
      }
      s.scale.set(0.5 + t * 1.4, Math.max(0.05, 1 - t), 0.5 + t * 1.4);
    }
  }

  /**
   * The storm: one small stormlet per sim cloud. Present clouds drift and
   * rain; swatted ones puff outwards and vanish, then drift back if they
   * regrow.
   */
  private updateStorm(delta: number, time: number): void {
    const stormy = game.sim.weather === 'storm' && game.stage === 'playing';
    if (!this.storm) {
      if (!stormy) return;
      let root: Entity | undefined;
      for (const e of this.queries.roots.entities) root = e;
      if (!root) return;
      const g = new GroupCtor();
      g.name = 'Storm';
      for (let i = 0; i < STORM.clouds; i++) {
        const s = makeStormlet(STORM.cloudRadius * 1.6);
        const spot = stormCloudSpot(i);
        s.position.set(spot.x, LAYOUT.baseHeight, spot.z);
        s.userData.level = 0;
        s.userData.baseX = spot.x;
        s.userData.baseZ = spot.z;
        g.add(s);
      }
      this.storm = g;
      makeOccludable(this.world.createTransformEntity(g, { parent: root, persistent: true }));
    }
    const clouds = game.sim.stormClouds;
    let any = false;
    for (let i = 0; i < this.storm.children.length; i++) {
      const s = this.storm.children[i];
      const present = stormy && clouds[i] === 1;
      let level = s.userData.level as number;
      // Swatted clouds vanish fast; regrowing ones drift back slowly.
      level += ((present ? 1 : 0) - level) * Math.min(1, delta * (present ? 0.8 : 6));
      s.userData.level = level;
      s.visible = level > 0.02;
      if (!s.visible) continue;
      any = true;
      const out = present ? 0 : (1 - level) * 0.04;
      const bx = s.userData.baseX as number;
      const bz = s.userData.baseZ as number;
      const len = Math.hypot(bx, bz) || 1;
      s.position.x = bx + (bx / len) * out + Math.sin(time * 0.4 + i) * 0.004;
      s.position.z = bz + (bz / len) * out + Math.cos(time * 0.3 + i) * 0.004;
      s.scale.setScalar(Math.max(0.01, present ? level : level * (1 + (1 - level))));
      this.animateDrops(s, time * 1.4 + i, present ? 1 : 0);
    }
    this.storm.visible = any;
  }

  /** A lightning bolt flickers for a moment where it struck. */
  private strike(x: number, z: number): void {
    let root: Entity | undefined;
    for (const e of this.queries.roots.entities) root = e;
    if (!root) return;
    const bolt = makeBolt();
    bolt.position.set(x, LAYOUT.baseHeight, z);
    const e = this.world.createTransformEntity(bolt, { parent: root });
    e.addComponent(PowerEffect, { kind: 'bolt', age: 0, duration: 0.35, radius: 0.01 });
    thunder();
  }

  private animateSparkles(children: { position: { x: number; y: number; z: number }; scale: { setScalar(s: number): void }; userData: Record<string, unknown> }[], t: number): void {
    for (let i = 0; i < children.length; i++) {
      const s = children[i];
      const a = (s.userData.angle as number) + t * 3;
      const r = 0.015 + t * 0.025;
      s.position.x = Math.cos(a) * r;
      s.position.z = Math.sin(a) * r;
      s.position.y = 0.01 + (i % 3) * 0.008 + t * 0.05;
      s.scale.setScalar(t < 0.2 ? t * 5 : 1 - (t - 0.2) / 0.8);
    }
  }
}
