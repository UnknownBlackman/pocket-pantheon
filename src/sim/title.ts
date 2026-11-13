/**
 * The divine title: at dusk the villagers name the god after how they were
 * treated this session. Pure function of the session counts and beliefs.
 */
import type { World } from './types.ts';

export const TITLES = {
  distant: 'the Distant One',
  balanced: 'the Balanced One',
  gentle: 'the Gentle Hand',
  storm: 'the Storm-Caller',
  lifter: 'the Lifter',
} as const;

/** Fewer interventions than this in a session makes the god "Distant". */
export const DISTANT_BELOW = 4;
/** Faith and Initiative this close (on average) earns "Balanced". */
export const BALANCED_GAP = 0.1;

export function divineTitle(world: World): string {
  const c = world.sessionCounts;
  const total = c.lift + c.ride + c.bless + c.rain + c.shelter;
  if (total < DISTANT_BELOW) return TITLES.distant;
  let faith = 0;
  let initiative = 0;
  let n = 0;
  for (const v of world.villagers) {
    if (v.dead) continue;
    n++;
    faith += v.beliefs.faith;
    initiative += v.beliefs.initiative;
  }
  n ||= 1;
  if (Math.abs(faith / n - initiative / n) < BALANCED_GAP) return TITLES.balanced;
  const weather = c.rain + c.shelter;
  const carry = c.lift + c.ride;
  if (c.bless >= weather && c.bless >= carry) return TITLES.gentle;
  if (weather >= carry) return TITLES.storm;
  return TITLES.lifter;
}
