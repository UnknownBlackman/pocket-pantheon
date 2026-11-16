/**
 * Copies simulation state onto view entities with smoothing: villager
 * positions and facing, field growth/dryness. Carried villagers are skipped
 * here; the LiftSystem drives them from the hand.
 */
import { createSystem, Grabbed } from '@iwsdk/core';
import type { Material, Mesh } from '@iwsdk/core';
import { PALETTE } from '../scene-assets/village-materials.ts';
import { villagerScale } from '../sim/life.ts';
import { LAYOUT, PRESENCE, RULES } from '../sim/rules.ts';
import type { Building, World as SimWorld } from '../sim/types.ts';
import { BuildingView, VillagerView } from './components.ts';
import { game } from './game.ts';

const TWO_PI = Math.PI * 2;
/** Riders sit this far above the palm centre (the palm's thickness). */
const RIDE_SEAT = 0.012;

function findBuilding(sim: SimWorld, id: string | null): Building | undefined {
  if (id === null) return undefined;
  const list = sim.buildings;
  for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
  return undefined;
}

function dampAngle(current: number, target: number, k: number): number {
  let d = (target - current) % TWO_PI;
  if (d > Math.PI) d -= TWO_PI;
  if (d < -Math.PI) d += TWO_PI;
  return current + d * k;
}

function setMaterial(mesh: Mesh | undefined, material: Material): void {
  if (mesh && mesh.material !== material) mesh.material = material;
}

export class SyncSystem extends createSystem({
  villagers: { required: [VillagerView], excluded: [Grabbed] },
  buildings: { required: [BuildingView] },
}) {
  update(delta: number): void {
    const sim = game.sim;
    const posK = 1 - Math.exp(-10 * delta);
    const rotK = 1 - Math.exp(-8 * delta);

    for (const e of this.queries.villagers.entities) {
      const obj = e.object3D;
      const index = e.getValue(VillagerView, 'simIndex') ?? -1;
      const v = sim.villagers[index];
      if (!obj || !v) continue;

      const p = game.presence;
      if (v.dead) continue; // lying where they fell (LifeSystem fades them out)
      obj.scale.setScalar(villagerScale(v.age));
      if (v.ride === 'ride' && v.rideHand && p.hands[v.rideHand].present) {
        // Sitting on the god's palm: stick to the live hand, not the 10 Hz sim.
        const h = p.hands[v.rideHand];
        const k = Math.min(1, posK * 3);
        obj.position.x += (h.x + v.rideX - obj.position.x) * k;
        obj.position.z += (h.z + v.rideZ - obj.position.z) * k;
        obj.position.y += (LAYOUT.baseHeight + h.y + RIDE_SEAT - obj.position.y) * k;
      } else if (v.ride === 'fall') {
        // Tumbling from the palm height to the table.
        const t = Math.min(1, v.rideTime / PRESENCE.fallSeconds);
        obj.position.x += (v.pos.x - obj.position.x) * posK;
        obj.position.z += (v.pos.z - obj.position.z) * posK;
        obj.position.y = LAYOUT.baseHeight + Math.max(0, (v.rideY + RIDE_SEAT) * (1 - t * t));
      } else {
        const px = obj.position.x;
        const pz = obj.position.z;
        obj.position.x += (v.pos.x - px) * posK;
        obj.position.z += (v.pos.z - pz) * posK;
        obj.position.y += (LAYOUT.baseHeight - obj.position.y) * posK;
      }

      // Face the way they walk, the building they work at, or the god.
      let fx = 0;
      let fz = 0;
      const facesGod =
        p.headPresent &&
        (v.activity === 'awe' ||
          v.activity === 'wave' ||
          v.activity === 'ride' ||
          v.activity === 'daze' ||
          v.activity === 'bow' ||
          (v.activity === 'cheer' && v.reaction === 'cheer') ||
          (p.headNear && v.activity === 'idle'));
      if (facesGod) {
        fx = p.head.x - obj.position.x;
        fz = p.head.z - obj.position.z;
      } else if (v.activity === 'touch' && v.target) {
        fx = v.target.x - v.pos.x;
        fz = v.target.z - v.pos.z;
      } else if (v.activity === 'climb' && v.rideHand && p.hands[v.rideHand].present) {
        fx = p.hands[v.rideHand].x - obj.position.x;
        fz = p.hands[v.rideHand].z - obj.position.z;
      } else if ((v.activity === 'walk' || v.activity === 'panic') && v.target) {
        fx = v.target.x - v.pos.x;
        fz = v.target.z - v.pos.z;
      } else if (v.activity === 'cheer' || v.activity === 'pray' || v.activity === 'farm') {
        const b = findBuilding(sim, v.targetId);
        if (b) {
          fx = b.pos.x - v.pos.x;
          fz = b.pos.z - v.pos.z;
        }
      }
      if (fx * fx + fz * fz > 1e-6) {
        obj.rotation.y = dampAngle(obj.rotation.y, Math.atan2(fx, fz), rotK);
      }

      const last = e.getValue(VillagerView, 'activity');
      if (last !== v.activity) {
        e.setValue(VillagerView, 'activity', v.activity);
        e.setValue(VillagerView, 'activityTime', 0);
      } else {
        e.setValue(VillagerView, 'activityTime', (e.getValue(VillagerView, 'activityTime') ?? 0) + delta);
      }
    }

    for (const e of this.queries.buildings.entities) {
      if (e.getValue(BuildingView, 'kind') !== 'field') continue;
      const obj = e.object3D;
      const b = sim.buildings[e.getValue(BuildingView, 'simIndex') ?? -1];
      if (!obj || !b) continue;
      // Children by construction order: Soil, Crops (see createField).
      const soil = obj.children[0] as Mesh | undefined;
      const crops = obj.children[1];
      setMaterial(soil, b.water < RULES.farming.dryBelow ? PALETTE.soilDry : PALETTE.soil);
      if (crops) {
        const targetScale = 0.08 + 0.92 * Math.min(1, b.growth / RULES.farming.ripeAt);
        crops.scale.y += (targetScale - crops.scale.y) * posK;
        const ripe = b.growth >= RULES.farming.ripeAt * 0.8;
        for (const row of crops.children) setMaterial(row as Mesh, ripe ? PALETTE.cropRipe : PALETTE.crop);
      }
    }
  }
}
