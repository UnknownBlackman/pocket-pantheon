/**
 * Shared game state for systems: the simulation World (source of truth) and
 * session flags. Plain data, no entity references. The village is loaded
 * from the save at startup (fast-forwarded if it is old) or created fresh.
 */
import { browserStorage, loadWorld } from '../core/save.ts';
import type { AwayReport } from '../sim/fastforward.ts';
import { makePresence } from '../sim/presence.ts';
import type { GodPresence } from '../sim/presence.ts';
import { createWorld } from '../sim/world.ts';
import type { World as SimWorld } from '../sim/types.ts';

export type GameStage = 'placing' | 'playing';

export interface GameState {
  sim: SimWorld;
  stage: GameStage;
  /** True while the pause panel is open. */
  paused: boolean;
  /** Which placement source planted the village. */
  placementSource: 'none' | 'plane' | 'hit-test' | 'fallback';
  /** True when this save came back from an earlier visit. */
  returning: boolean;
  /** "While you were away" report, shown once when the village is placed. */
  away: AwayReport | null;
  /** Start a fresh 3-day session when the village is next placed. */
  newSessionOnPlace: boolean;
  /** The player's hands and head in village space (filled by HandPresenceSystem). */
  presence: GodPresence;
}

/** `?fresh` in the page URL starts a brand-new village (first-visit tutorial included). */
function wantsFresh(): boolean {
  try {
    return new URLSearchParams(globalThis.location?.search ?? '').has('fresh');
  } catch {
    return false;
  }
}

function initialState(): GameState {
  const loaded = wantsFresh() ? null : loadWorld(browserStorage());
  if (loaded) {
    const w = loaded.world;
    console.info(`[save] loaded village (day ${w.dayIndex + 1}, session ${w.session})`);
    return {
      sim: w,
      stage: 'placing',
      paused: false,
      placementSource: 'none',
      returning: true,
      away: loaded.away,
      // A finished session, or a long absence, starts a new 3-day session.
      newSessionOnPlace: w.phase !== 'day' || loaded.away !== null,
      presence: makePresence(),
    };
  }
  return {
    sim: createWorld(Date.now() >>> 0),
    stage: 'placing',
    paused: false,
    placementSource: 'none',
    returning: false,
    away: null,
    newSessionOnPlace: false,
    presence: makePresence(),
  };
}

export const game: GameState = initialState();
