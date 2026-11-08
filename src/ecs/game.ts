/**
 * Shared game state for systems: the simulation World (source of truth) and
 * session flags. Plain data, no entity references.
 */
import { createWorld } from '../sim/world.ts';
import type { World as SimWorld } from '../sim/types.ts';

export type GameStage = 'placing' | 'playing';

export interface GameState {
  sim: SimWorld;
  stage: GameStage;
  /** True while the pause panel is open or the XR session is not visible. */
  paused: boolean;
  /** Which placement source planted the village. */
  placementSource: 'none' | 'plane' | 'hit-test' | 'fallback';
}

export const game: GameState = {
  sim: createWorld(Date.now() >>> 0),
  stage: 'placing',
  paused: false,
  placementSource: 'none',
};
