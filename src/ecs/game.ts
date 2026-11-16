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
  /** The god has walked away from the village: its clock waits (AwaySystem). */
  godAway: boolean;
  /** The god is carrying the village to a new spot (PlacementSystem). */
  moving: boolean;
  /** Which placement source planted the village. */
  placementSource: 'none' | 'plane' | 'hit-test' | 'fallback';
  /** True when this save came back from an earlier visit. */
  returning: boolean;
  /** "While you were away" report, shown once when the village is placed. */
  away: AwayReport | null;
  /** Lines of the "while you were away" scroll, shown on the chronicle tablet once. */
  awayScroll: string[] | null;
  /** Start a fresh 3-day session when the village is next placed. */
  newSessionOnPlace: boolean;
  /** The player's hands and head in village space (filled by HandPresenceSystem). */
  presence: GodPresence;
}

/**
 * A brand-new village (first-visit tutorial included) when the page URL has
 * `?fresh`, or once after Shift+F on the flat page (see index.ts).
 */
export const FRESH_FLAG = 'tabletop-gods-fresh';

function wantsFresh(): boolean {
  try {
    if (globalThis.sessionStorage?.getItem(FRESH_FLAG)) {
      globalThis.sessionStorage.removeItem(FRESH_FLAG);
      return true;
    }
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
      godAway: false,
      moving: false,
      placementSource: 'none',
      returning: true,
      away: loaded.away,
      awayScroll: null,
      // A finished session, or a long absence, starts a new 3-day session.
      newSessionOnPlace: w.phase !== 'day' || loaded.away !== null,
      presence: makePresence(),
    };
  }
  return {
    sim: createWorld(Date.now() >>> 0),
    stage: 'placing',
    paused: false,
    godAway: false,
    moving: false,
    placementSource: 'none',
    returning: false,
    away: null,
    awayScroll: null,
    newSessionOnPlace: false,
    presence: makePresence(),
  };
}

export const game: GameState = initialState();
