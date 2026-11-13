import { DepthSensingSystem, Group, World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { VILLAGE_ROOT_NAME, SYSTEM_PRIORITY as P } from './core/constants.js';
import { AnimationSystem } from './ecs/animation-system.js';
import { AudioSystem } from './ecs/audio-system.js';
import { ChronicleSystem } from './ecs/chronicle-system.js';
import { GuideSystem } from './ecs/guide-system.js';
import { LifeSystem } from './ecs/life-system.js';
import { SpeechSystem } from './ecs/speech-system.js';
import { EffectsSystem } from './ecs/effects-system.js';
import { GazeBubbleSystem } from './ecs/gaze-bubble-system.js';
import { HandFxSystem } from './ecs/hand-fx-system.js';
import { HandGestureSystem } from './ecs/hand-gesture-system.js';
import { HandPresenceSystem } from './ecs/hand-presence-system.js';
import { PowerSystem } from './ecs/power-system.js';
import { SaveSystem } from './ecs/save-system.js';
import { VillageRoot } from './ecs/components.js';
import { game } from './ecs/game.js';
import { LiftSystem } from './ecs/lift-system.js';
import { PlacementSystem } from './ecs/placement-system.js';
import { SimSystem } from './ecs/sim-system.js';
import { SyncSystem } from './ecs/sync-system.js';
import { UISystem } from './ecs/ui-system.js';
import { buildVillage } from './ecs/village-builder.js';
import { PanelSystem } from './panel.js';

World.create(
  document.getElementById('scene-container') as HTMLDivElement,
  projectOptions,
).then((world) => {
  // Real hands and objects hide the village behind them (passthrough depth).
  // Depth is requested as optional, so sessions without it still run.
  world.registerSystem(DepthSensingSystem, {
    configData: {
      enableDepthTexture: true,
      enableOcclusion: true,
      useFloat32: true,
      blurRadius: 20,
    },
  });

  world
    .registerSystem(HandGestureSystem, { priority: P.handGesture })
    .registerSystem(HandPresenceSystem, { priority: P.handPresence })
    .registerSystem(PlacementSystem, { priority: P.placement })
    .registerSystem(PowerSystem, { priority: P.power })
    .registerSystem(SimSystem, { priority: P.sim })
    .registerSystem(LiftSystem, { priority: P.lift })
    .registerSystem(SyncSystem, { priority: P.sync })
    .registerSystem(AnimationSystem, { priority: P.animation })
    .registerSystem(EffectsSystem, { priority: P.effects })
    .registerSystem(HandFxSystem, { priority: P.effects })
    .registerSystem(AudioSystem, { priority: P.audio })
    .registerSystem(GazeBubbleSystem, { priority: P.ui })
    .registerSystem(UISystem, { priority: P.ui })
    .registerSystem(ChronicleSystem, { priority: P.ui })
    .registerSystem(GuideSystem, { priority: P.ui })
    .registerSystem(SpeechSystem, { priority: P.ui })
    .registerSystem(LifeSystem, { priority: P.effects })
    .registerSystem(PanelSystem, { priority: P.ui })
    .registerSystem(SaveSystem, { priority: P.save });

  // The village root starts hidden; PlacementSystem plants it on the table
  // (or at a preview spot outside XR) and anchors it where supported.
  const rootObject = new Group();
  rootObject.name = VILLAGE_ROOT_NAME;
  rootObject.visible = false;
  const root = world.createTransformEntity(rootObject, { persistent: true });
  buildVillage(world, root, game.sim);
  root.addComponent(VillageRoot);
});
