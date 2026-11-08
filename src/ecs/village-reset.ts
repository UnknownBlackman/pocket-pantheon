/**
 * Replaces the village with a fresh one in the same place (pause > New
 * village). View entities are destroyed (their geometry and materials are
 * shared prototypes, so they must not be disposed) and rebuilt.
 */
import type { Entity, World } from '@iwsdk/core';
import { createWorld } from '../sim/world.ts';
import { game } from './game.ts';
import { buildVillage } from './village-builder.ts';

export function resetVillage(world: World, root: Entity, views: Iterable<Entity>): void {
  const doomed: Entity[] = [];
  for (const e of views) doomed.push(e);
  for (const e of doomed) e.destroy();
  const keepTutorial = game.sim.tutorialDone.slice();
  game.sim = createWorld((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0);
  game.sim.tutorialDone = keepTutorial;
  buildVillage(world, root, game.sim);
}
