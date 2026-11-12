/**
 * The first-five-minutes tutorial, driven by what the player does, not by
 * timers. Each step shows a hint until the player performs it; Rain waits
 * for the drought and Shelter for the storm. Pure code, no XR.
 */
import type { World } from './types.ts';

export type TutorialStep = 'lift' | 'bless' | 'gaze' | 'ride' | 'rain' | 'shelter';
export const TUTORIAL_STEPS: readonly TutorialStep[] = ['lift', 'bless', 'gaze', 'ride', 'rain', 'shelter'];

export interface Hint {
  step: TutorialStep | 'complete';
  title: string;
  body: string;
}

const HINTS: Record<TutorialStep, Omit<Hint, 'step'>> = {
  lift: {
    title: 'Lift a villager',
    body: 'Pinch a villager, carry them and let go over a field, a hut or the shrine.',
  },
  bless: {
    title: 'Bless your people',
    body: 'Point one finger at a villager or building and hold until the ring fills. It costs 1 Favor (the gold gems).',
  },
  gaze: {
    title: 'See how they feel',
    body: 'Look at a villager for a moment to see their hunger, tiredness, Faith and Initiative.',
  },
  ride: {
    title: 'Let them climb aboard',
    body: 'Rest your open hand, palm up, beside the village and keep it still. Lift it to carry them; tilt it and they tumble.',
  },
  rain: {
    title: 'The fields are drying!',
    body: 'Hold your open hand flat, palm down, a hand-width above a field.',
  },
  shelter: {
    title: 'A storm is coming!',
    body: 'Hold both palms down over the village, or one palm over open ground, to shelter them.',
  },
};

const COMPLETE: Hint = {
  step: 'complete',
  title: 'They are yours to guide',
  body: 'Help too much and they wait for you. Stay away and they stop believing. Find the balance.',
};

export function isStepDone(world: World, step: TutorialStep): boolean {
  return world.tutorialDone.includes(step);
}

/** Marks a step done. Returns true when this call completed it. */
export function completeStep(world: World, step: TutorialStep): boolean {
  if (isStepDone(world, step)) return false;
  world.tutorialDone.push(step);
  return true;
}

export function tutorialComplete(world: World): boolean {
  return TUTORIAL_STEPS.every((s) => isStepDone(world, s));
}

/** Is the moment right to teach this step? */
function ready(world: World, step: TutorialStep): boolean {
  switch (step) {
    case 'rain':
      return world.weather === 'drought';
    case 'shelter':
      return world.weather === 'storm';
    default:
      return true;
  }
}

/**
 * The hint to show now, or null while waiting (e.g. for the drought). Steps
 * are taught in order; a later power used early still counts when reached.
 */
export function currentHint(world: World): Hint | null {
  for (const step of TUTORIAL_STEPS) {
    if (isStepDone(world, step)) continue;
    return ready(world, step) ? { step, ...HINTS[step] } : null;
  }
  return COMPLETE;
}
