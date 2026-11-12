/**
 * Animates power effects and village feedback: bless sparkles, rain clouds,
 * shelter domes, the storm cloud and the Favor pips on the rim. Transient
 * PowerEffect entities are removed when done.
 */
import { createSystem } from '@iwsdk/core';
import type { Entity, Mesh, Object3D } from '@iwsdk/core';
import { PIP_DIM, PIP_HALF, PIP_LIT } from '../art/effects-art.ts';
import { CLOUD_HEIGHT, makeStormCloud } from '../art/weather-art.ts';
import { RULES } from '../sim/rules.ts';
import { FavorPips, PowerEffect, VillageRoot } from './components.ts';
import { game } from './game.ts';
import { makeOccludable } from './occlusion.ts';

export class EffectsSystem extends createSystem({
  effects: { required: [PowerEffect] },
  pips: { required: [FavorPips] },
  roots: { required: [VillageRoot] },
}) {
  private storm: Object3D | null = null;
  private stormLevel = 0;

  update(delta: number, time: number): void {
    this.updateStorm(delta, time);
    for (const e of this.queries.effects.entities) {
      const age = (e.getValue(PowerEffect, 'age') ?? 0) + delta;
      const duration = e.getValue(PowerEffect, 'duration') ?? 1;
      e.setValue(PowerEffect, 'age', age);
      const obj = e.object3D;
      if (!obj) continue;
      const t = Math.min(1, age / duration);
      const kind = e.getValue(PowerEffect, 'kind');
      if (kind === 'bless') this.animateSparkles(obj.children, t);
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
    for (let i = 0; i < children.length; i++) {
      const c = children[i];
      if (c.name === 'Cloud') {
        c.position.y = CLOUD_HEIGHT + Math.sin(time * 0.8) * 0.004;
        continue;
      }
      const phase = ((c.userData.phase as number) + time * 1.6) % 1;
      c.position.y = CLOUD_HEIGHT * (1 - phase) - 0.005;
      c.visible = level > (c.userData.phase as number) * 0.9;
    }
  }

  /** The storm cloud fades in over the whole village while the sim says storm. */
  private updateStorm(delta: number, time: number): void {
    const target = game.sim.weather === 'storm' && game.stage === 'playing' ? 1 : 0;
    this.stormLevel += (target - this.stormLevel) * Math.min(1, delta * 1.5);
    if (!this.storm) {
      if (target === 0) return;
      let root: Entity | undefined;
      for (const e of this.queries.roots.entities) root = e;
      if (!root) return;
      this.storm = makeStormCloud(RULES.village.radius * 0.95);
      this.storm.position.y = RULES.village.radius * 0.15;
      makeOccludable(this.world.createTransformEntity(this.storm, { parent: root, persistent: true }));
    }
    const storm = this.storm;
    storm.visible = this.stormLevel > 0.02;
    if (!storm.visible) return;
    storm.scale.setScalar(0.6 + 0.4 * this.stormLevel);
    // Gusty sway and the cloud rumbling.
    storm.rotation.y = Math.sin(time * 0.3) * 0.15;
    this.animateDrops(storm, time * 1.4, this.stormLevel);
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
