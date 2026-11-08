import { Group, World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { VILLAGE_ROOT_NAME, SYSTEM_PRIORITY as P } from './core/constants.js';
import { AnimationSystem } from './ecs/animation-system.js';
import { VillageRoot } from './ecs/components.js';
import { game } from './ecs/game.js';
import { PlacementSystem } from './ecs/placement-system.js';
import { SimSystem } from './ecs/sim-system.js';
import { SyncSystem } from './ecs/sync-system.js';
import { buildVillage } from './ecs/village-builder.js';
import { PanelSystem } from './panel.js';

World.create(
  document.getElementById('scene-container') as HTMLDivElement,
  projectOptions,
).then((world) => {
  world
    .registerSystem(PlacementSystem, { priority: P.placement })
    .registerSystem(SimSystem, { priority: P.sim })
    .registerSystem(SyncSystem, { priority: P.sync })
    .registerSystem(AnimationSystem, { priority: P.animation })
    .registerSystem(PanelSystem, { priority: P.ui });

  // The village root starts hidden; PlacementSystem plants it on the table
  // (or at a preview spot outside XR) and anchors it where supported.
  const rootObject = new Group();
  rootObject.name = VILLAGE_ROOT_NAME;
  rootObject.visible = false;
  const root = world.createTransformEntity(rootObject, { persistent: true });
  buildVillage(world, root, game.sim);
  root.addComponent(VillageRoot);
});
