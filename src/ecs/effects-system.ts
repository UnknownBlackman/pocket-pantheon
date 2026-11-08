/**
 * Animates power effects and village feedback: bless sparkles, the Favor
 * pips on the rim. Transient PowerEffect entities are removed when done.
 */
import { createSystem } from '@iwsdk/core';
import type { Mesh } from '@iwsdk/core';
import { PIP_DIM, PIP_HALF, PIP_LIT } from '../art/effects-art.ts';
import { FavorPips, PowerEffect } from './components.ts';
import { game } from './game.ts';

export class EffectsSystem extends createSystem({
  effects: { required: [PowerEffect] },
  pips: { required: [FavorPips] },
}) {
  update(delta: number, time: number): void {
    for (const e of this.queries.effects.entities) {
      const age = (e.getValue(PowerEffect, 'age') ?? 0) + delta;
      const duration = e.getValue(PowerEffect, 'duration') ?? 1;
      e.setValue(PowerEffect, 'age', age);
      const obj = e.object3D;
      if (!obj) continue;
      const t = Math.min(1, age / duration);
      if (e.getValue(PowerEffect, 'kind') === 'bless') this.animateSparkles(obj.children, t);
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
