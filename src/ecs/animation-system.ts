/**
 * Animates the village: villager poses with swinging limbs, turning heads
 * and blinks (ecs/villager-pose.ts), the campfire flicker, chimney smoke,
 * the shrine orb, window glow, the pennant and the chickens.
 */
import { createSystem, Grabbed } from '@iwsdk/core';
import { LAYOUT, RULES } from '../sim/rules.ts';

const LAYOUT_BASE = LAYOUT.baseHeight;
import { WINDOW_MAT } from '../scene-assets/village-materials.ts';
import { BuildingView, DioramaView, VillagerView } from './components.ts';
import { applyPose, makePose, poseFor } from './villager-pose.ts';
import { game } from './game.ts';

export class AnimationSystem extends createSystem({
  villagers: { required: [VillagerView] },
  buildings: { required: [BuildingView] },
  dioramas: { required: [DioramaView] },
}) {
  private windowGlow = 0.2;
  private pose = makePose();
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
      const carried = e.hasComponent(Grabbed) || v.carried;
      poseFor(this.pose, v, t, at, ease, carried, game.presence.headNear);
      applyPose(body, this.pose, delta);
    }

    this.animateVillageLife(delta, time);

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
      } else if (kind === 'hut') {
        // Chimney smoke: three puffs rising, drifting and shrinking in a loop.
        const smoke = obj.getObjectByName('Smoke');
        if (smoke) {
          for (let i = 0; i < smoke.children.length; i++) {
            const puff = smoke.children[i];
            const ph = ((puff.userData.phase as number) + time * 0.22) % 1;
            puff.position.set(Math.sin(ph * 3 + i) * 0.004 + ph * 0.006, ph * 0.045, ph * 0.002);
            puff.scale.setScalar(0.5 + ph * 1.6 * (1 - ph * 0.6));
            puff.visible = ph < 0.92;
          }
        }
      } else if (kind === 'shrine') {
        const orb = obj.getObjectByName('Orb');
        if (orb) {
          orb.position.y = ((orb.userData.baseY as number) ?? 0.03) + Math.sin(time * 1.6) * 0.003;
          orb.rotation.y += delta * 0.8;
          const s = 0.8 + 0.4 * (sim.favor / RULES.favor.max);
          orb.scale.setScalar(s);
        }
      }
    }
  }

  /** Window glow at dusk and night, chickens pecking about, the pennant fluttering. */
  private animateVillageLife(delta: number, time: number): void {
    const sim = game.sim;
    const evening = sim.phase !== 'day' || sim.timeOfDay >= RULES.session.nightStart - 0.08;
    const gloomy = sim.weather === 'storm' ? 0.9 : sim.weather === 'rain' || sim.weather === 'snow' ? 0.6 : 0.15;
    const target = evening ? 1.8 : gloomy;
    this.windowGlow += (target - this.windowGlow) * Math.min(1, delta * 0.8);
    WINDOW_MAT.emissiveIntensity = this.windowGlow;

    for (const e of this.queries.dioramas.entities) {
      const obj = e.object3D;
      if (!obj) continue;
      const pennant = obj.getObjectByName('Pennant');
      if (pennant) {
        pennant.rotation.y = Math.sin(time * 2.3) * 0.35 + Math.sin(time * 5.1) * 0.08;
        pennant.scale.x = 1 + Math.sin(time * 6) * 0.05;
      }
      const chickens = obj.getObjectByName('Chickens');
      if (!chickens) continue;
      for (let i = 0; i < chickens.children.length; i++) {
        const c = chickens.children[i];
        const ph = c.userData.phase as number;
        const t = time * 0.35 + ph;
        // Wander a little loop around home, pausing to peck.
        const peckCycle = (time * 0.6 + ph) % 3;
        const pecking = peckCycle > 2.2;
        const hx = c.userData.homeX as number;
        const hz = c.userData.homeZ as number;
        if (!pecking) {
          const nx = hx + Math.cos(t) * 0.02 + Math.sin(t * 2.3) * 0.006;
          const nz = hz + Math.sin(t * 1.3) * 0.018;
          const dx = nx - c.position.x;
          const dz = nz - c.position.z;
          if (dx * dx + dz * dz > 1e-10) c.rotation.y = Math.atan2(dx, dz);
          c.position.x = nx;
          c.position.z = nz;
          c.position.y = LAYOUT_BASE + Math.abs(Math.sin(time * 14 + ph)) * 0.0012;
          c.rotation.x = 0;
        } else {
          c.position.y = LAYOUT_BASE;
          c.rotation.x = Math.max(0, Math.sin((peckCycle - 2.2) * 18)) * 0.7;
        }
      }
    }
  }
}
