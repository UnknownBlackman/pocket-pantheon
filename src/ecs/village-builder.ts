/**
 * Creates the visible village (diorama, buildings, villagers) as child
 * entities of the VillageRoot entity, mirroring the simulation World.
 */
import { Group, OneHandGrabbable } from '@iwsdk/core';
import type { Entity, World } from '@iwsdk/core';
import { makeFavorPips } from '../art/effects-art.ts';
import { makeBlobShadow, makeBuilding, makeDiorama, makeTablet, makeVillager } from '../art/village-art.ts';
import { LAYOUT } from '../sim/rules.ts';
import type { World as SimWorld } from '../sim/types.ts';
import { makeOccludable } from './occlusion.ts';
import { BuildingView, ChronicleTablet, DioramaView, FavorPips, VillagerView } from './components.ts';

/** Where the chronicle tablet stands, beside the shrine (village space). */
export const TABLET_POS = { x: 0.095, z: -0.2 } as const;

export function buildVillage(world: World, root: Entity, sim: SimWorld): void {
  const dioramaObj = makeDiorama();
  // Soft shadows under the trees and props (on the grass, or the real desk).
  const shadows = new Group();
  shadows.name = 'GroundShadows';
  shadows.position.y = LAYOUT.baseHeight;
  for (const spot of (dioramaObj.userData.shadowSpots ?? []) as { x: number; z: number; d: number }[]) {
    const blob = makeBlobShadow(spot.d);
    blob.position.x = spot.x;
    blob.position.z = spot.z;
    shadows.add(blob);
  }
  dioramaObj.add(shadows);
  const diorama = world.createTransformEntity(dioramaObj, { parent: root });
  diorama.addComponent(DioramaView);
  makeOccludable(diorama);
  const pips = world.createTransformEntity(makeFavorPips(), { parent: root });
  pips.addComponent(FavorPips);
  makeOccludable(pips);
  const tabletObj = makeTablet();
  tabletObj.position.set(TABLET_POS.x, LAYOUT.baseHeight, TABLET_POS.z);
  tabletObj.rotation.y = Math.atan2(-TABLET_POS.x, -TABLET_POS.z);
  const tablet = world.createTransformEntity(tabletObj, { parent: root });
  tablet.addComponent(ChronicleTablet);
  makeOccludable(tablet);

  sim.buildings.forEach((b, i) => {
    const obj = makeBuilding(b.kind);
    obj.name = `Building:${b.id}`;
    obj.position.set(b.pos.x, LAYOUT.baseHeight, b.pos.z);
    // Doors and faces turn towards the village centre.
    if (b.kind === 'hut' || b.kind === 'shrine') {
      obj.rotation.y = Math.atan2(-b.pos.x, -b.pos.z);
    }
    const e = world.createTransformEntity(obj, { parent: root });
    e.addComponent(BuildingView, { simId: b.id, simIndex: i, kind: b.kind });
    makeOccludable(e);
  });

  sim.villagers.forEach((v, i) => {
    if (!v.dead) spawnVillagerView(world, root, sim, i);
  });
}

export function spawnVillagerView(world: World, root: Entity, sim: SimWorld, index: number): Entity {
  const v = sim.villagers[index];
  const obj = makeVillager(index, v.sex === 'f');
  obj.name = `Villager:${v.name}`;
  obj.position.set(v.pos.x, LAYOUT.baseHeight, v.pos.z);
  const e = world.createTransformEntity(obj, { parent: root });
  e.addComponent(VillagerView, {
    simId: v.id,
    simIndex: index,
    phase: (index * 0.37) % 1,
    activity: v.activity,
    activityTime: 0,
  });
  // Lift power: a hand pinch grabs the villager. Kept upright while carried.
  e.addComponent(OneHandGrabbable, { rotate: false, translate: true });
  makeOccludable(e);
  return e;
}
