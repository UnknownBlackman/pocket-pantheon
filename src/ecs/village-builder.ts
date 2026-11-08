/**
 * Creates the visible village (diorama, buildings, villagers) as child
 * entities of the VillageRoot entity, mirroring the simulation World.
 */
import { OneHandGrabbable } from '@iwsdk/core';
import type { Entity, World } from '@iwsdk/core';
import { makeFavorPips } from '../art/effects-art.ts';
import { makeBuilding, makeDiorama, makeVillager } from '../art/village-art.ts';
import { LAYOUT } from '../sim/rules.ts';
import type { World as SimWorld } from '../sim/types.ts';
import { BuildingView, DioramaView, FavorPips, VillagerView } from './components.ts';

export function buildVillage(world: World, root: Entity, sim: SimWorld): void {
  const diorama = world.createTransformEntity(makeDiorama(), { parent: root });
  diorama.addComponent(DioramaView);
  const pips = world.createTransformEntity(makeFavorPips(), { parent: root });
  pips.addComponent(FavorPips);

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
  });

  sim.villagers.forEach((v, i) => spawnVillagerView(world, root, sim, i));
}

export function spawnVillagerView(world: World, root: Entity, sim: SimWorld, index: number): Entity {
  const v = sim.villagers[index];
  const obj = makeVillager(index);
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
  return e;
}
