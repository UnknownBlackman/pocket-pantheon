import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { VILLAGE_ROOT_NAME, SYSTEM_PRIORITY as P } from './core/constants.js';
import { AnimationSystem } from './ecs/animation-system.js';
import { VillageRoot } from './ecs/components.js';
import { game } from './ecs/game.js';
import { SimSystem } from './ecs/sim-system.js';
import { SyncSystem } from './ecs/sync-system.js';
import { buildVillage } from './ecs/village-builder.js';
import { PanelSystem } from './panel.js';
import { Group } from '@iwsdk/core';

World.create(
  document.getElementById('scene-container') as HTMLDivElement,
  projectOptions,
).then((world) => {
  world
    .registerSystem(SimSystem, { priority: P.sim })
    .registerSystem(SyncSystem, { priority: P.sync })
    .registerSystem(AnimationSystem, { priority: P.animation })
    .registerSystem(PanelSystem, { priority: P.ui });

  // Day 3: plant the village at a fixed table-height spot. Day 4 replaces
  // this with the placement flow.
  const rootObject = new Group();
  rootObject.name = VILLAGE_ROOT_NAME;
  rootObject.position.set(0, 0.75, -0.55);
  const root = world.createTransformEntity(rootObject, { persistent: true });
  root.addComponent(VillageRoot);
  buildVillage(world, root, game.sim);
  game.stage = 'playing';
});
