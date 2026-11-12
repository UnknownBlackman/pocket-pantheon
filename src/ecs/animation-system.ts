/**
 * Procedural villager animation on primitive shapes: walk bob, work swing,
 * rest sit, pray kneel, panic jitter, cheer hop, plus a slumped "waiting"
 * pose for dependent villagers and a dangle while carried. Also flickers the
 * campfire and floats the shrine orb.
 */
import { createSystem, Grabbed } from '@iwsdk/core';
import { RULES } from '../sim/rules.ts';
import { BuildingView, VillagerView } from './components.ts';
import { game } from './game.ts';

export class AnimationSystem extends createSystem({
  villagers: { required: [VillagerView] },
  buildings: { required: [BuildingView] },
}) {
  update(delta: number, time: number): void {
    const sim = game.sim;
    for (const e of this.queries.villagers.entities) {
      const obj = e.object3D;
      const body = obj?.children[0]; // 'Body' (see createVillager)
      const v = sim.villagers[e.getValue(VillagerView, 'simIndex') ?? -1];
      if (!body || !v) continue;
      const t = time + (e.getValue(VillagerView, 'phase') ?? 0) * 10;
      const at = e.getValue(VillagerView, 'activityTime') ?? 0;
      const ease = Math.min(1, at * 4); // blend into a pose over 0.25 s

      let y = 0;
      let sx = 1;
      let sy = 1;
      let rx = 0;
      let rz = 0;
      let jx = 0;
      let jz = 0;

      if (e.hasComponent(Grabbed) || v.carried) {
        // Dangle: stretched, swinging, legs kicking.
        sy = 1.12 + Math.sin(t * 9) * 0.04;
        sx = 0.92;
        rz = Math.sin(t * 5) * 0.35;
        rx = Math.sin(t * 3.7) * 0.2;
      } else {
        switch (v.activity) {
          case 'walk': {
            const s = Math.sin(t * 14);
            y = Math.abs(s) * 0.004;
            sy = 1 + Math.sin(t * 28) * 0.05;
            sx = 2 - sy;
            rz = s * 0.08;
            break;
          }
          case 'farm': {
            const s = Math.sin(t * 6);
            rx = (0.35 + s * 0.25) * ease;
            sy = 1 - Math.max(0, s) * 0.06;
            sx = 2 - sy;
            break;
          }
          case 'rest':
            sy = 1 - 0.28 * ease + Math.sin(t * 1.5) * 0.015;
            sx = 1 + 0.12 * ease;
            rx = 0.15 * ease;
            break;
          case 'pray':
            sy = 1 - 0.2 * ease;
            sx = 1 + 0.06 * ease;
            rx = (0.3 + Math.sin(t * 2) * 0.2) * ease;
            break;
          case 'panic':
            jx = Math.sin(t * 47) * 0.002;
            jz = Math.cos(t * 39) * 0.002;
            y = Math.abs(Math.sin(t * 20)) * 0.005;
            rz = Math.sin(t * 30) * 0.3;
            sy = 1.08;
            sx = 0.94;
            break;
          case 'cheer': {
            const hop = Math.sin(t * 8);
            y = Math.max(0, hop) * 0.012;
            sy = hop < -0.6 ? 0.85 : 1 + Math.max(0, hop) * 0.08;
            sx = 2 - sy;
            break;
          }
          case 'awe':
            // Lean back to stare up at the god's hand, trembling a little.
            rx = -0.45 * ease;
            sy = 1.04;
            sx = 0.98;
            rz = Math.sin(t * 23) * 0.03;
            break;
          case 'wave':
            // Sway side to side and bounce: waving back with the whole body.
            rz = Math.sin(t * 10) * 0.3;
            rx = -0.2;
            y = Math.abs(Math.sin(t * 10)) * 0.003;
            break;
          case 'daze':
            // Dizzy wobble after a fall.
            rz = Math.sin(t * 6) * 0.3;
            rx = Math.cos(t * 6) * 0.15;
            sy = 0.9;
            sx = 1.05;
            break;
          case 'climb': {
            // Eager little hops towards the open palm.
            const s = Math.sin(t * 16);
            y = Math.abs(s) * 0.007;
            sy = 1 + Math.sin(t * 32) * 0.06;
            sx = 2 - sy;
            rx = -0.15;
            break;
          }
          case 'ride':
            // Sitting on the palm, swaying with the hand.
            sy = 0.78;
            sx = 1.1;
            rx = -0.1 + Math.sin(t * 2.5) * 0.06;
            rz = Math.sin(t * 1.7) * 0.08;
            break;
          case 'fall':
            // Head-over-heels tumble.
            rx = at * 14;
            rz = Math.sin(at * 9) * 0.6;
            break;
          case 'hide': {
            // Crouch behind the god's hand and peek out now and then.
            sy = 0.72;
            sx = 1.08;
            const peek = Math.sin(t * 1.3);
            rz = peek > 0.55 ? (peek - 0.55) * 1.6 : 0;
            jx = peek > 0.55 ? 0.003 : 0;
            break;
          }
          default: {
            // Idle: gentle breathing. Dependent villagers slump and wait.
            const dependent = v.beliefs.initiative < RULES.decisions.dependentInitiative;
            sy = 1 + Math.sin(t * 2) * 0.02;
            if (dependent) {
              rx = 0.4 * ease;
              sy -= 0.08 * ease;
            }
            // The god leans close: everyone looks up.
            if (game.presence.headNear) rx = -0.3 * ease;
            sx = 2 - sy;
          }
        }
      }

      body.position.set(jx, y, jz);
      body.scale.set(sx, sy, sx);
      body.rotation.set(rx, 0, rz);
    }

    for (const e of this.queries.buildings.entities) {
      const kind = e.getValue(BuildingView, 'kind');
      const obj = e.object3D;
      if (!obj) continue;
      if (kind === 'campfire') {
        const flame = obj.getObjectByName('Flame');
        if (flame) {
          const dusk = sim.phase !== 'day' ? 1.6 : 1;
          const f = 1 + Math.sin(time * 17) * 0.12 + Math.sin(time * 29) * 0.08;
          flame.scale.set(dusk * (2 - f) * 0.9 + 0.1, dusk * f, dusk * (2 - f) * 0.9 + 0.1);
          flame.rotation.y += delta * 2;
        }
      } else if (kind === 'shrine') {
        const orb = obj.getObjectByName('Orb');
        if (orb) {
          orb.position.y = 0.078 + Math.sin(time * 1.6) * 0.004;
          orb.rotation.y += delta * 0.8;
          const s = 0.8 + 0.4 * (sim.favor / RULES.favor.max);
          orb.scale.setScalar(s);
        }
      }
    }
  }
}
