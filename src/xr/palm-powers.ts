/**
 * Which palm power (Rain, one-hand Shelter, two-hand Shelter) a pair of
 * hands is asking for, if any. Pure and tested; PowerSystem feeds it hand
 * data in village space and runs the hold timer.
 */
import { GESTURES, RULES } from '../sim/rules.ts';

export interface PalmInput {
  tracked: boolean;
  /** Seconds since tracking began for this hand. */
  trackedFor: number;
  /** Open hand with the palm facing down (see isPalmDown). */
  palmDown: boolean;
  /** Palm speed, m/s. */
  speed: number;
  /** Palm height above the diorama surface, m. */
  height: number;
  /** Palm distance from the village centre on the table plane, m. */
  distance: number;
  /** A field lies under this palm. */
  overField: boolean;
}

export type PalmMode = 'none' | 'rain' | 'shelter1' | 'shelter2';

export interface PalmChoice {
  mode: PalmMode;
  /** Seconds the pose must be held before the power fires. */
  hold: number;
  /** Which hand placed it, for single-hand powers. */
  hand: 'left' | 'right' | null;
}

const NONE: PalmChoice = { mode: 'none', hold: 0, hand: null };

/** One hand qualifies: flat palm down, still, in the height band, over the village, settled. */
export function palmQualifies(p: PalmInput): boolean {
  return (
    p.tracked &&
    p.trackedFor >= GESTURES.palmArmSeconds &&
    p.palmDown &&
    p.speed <= GESTURES.palmMaxSpeed &&
    p.height >= GESTURES.palmMinHeight &&
    p.height <= GESTURES.palmMaxHeight &&
    p.distance <= RULES.village.radius
  );
}

/**
 * `blocked` suppresses all palm powers while something else is going on: a
 * pinch, a villager being carried or riding, hide-and-seek, or pause.
 * Two qualifying hands with wrists 10-25 cm apart ask for Shelter (this wins
 * over Rain); one hand over a field asks for Rain, over open ground for the
 * slower one-hand Shelter.
 */
export function choosePalmPower(
  left: PalmInput,
  right: PalmInput,
  wristsApart: boolean,
  blocked: boolean,
): PalmChoice {
  if (blocked) return NONE;
  const l = palmQualifies(left);
  const r = palmQualifies(right);
  if (l && r && wristsApart) return { mode: 'shelter2', hold: GESTURES.shelterTwoHandHoldSeconds, hand: null };
  if (!l && !r) return NONE;
  // With two qualifying hands that are not a Shelter pair, the right hand leads.
  const hand = r ? 'right' : 'left';
  const p = r ? right : left;
  return p.overField
    ? { mode: 'rain', hold: GESTURES.rainHoldSeconds, hand }
    : { mode: 'shelter1', hold: GESTURES.shelterOneHandHoldSeconds, hand };
}
