/**
 * Life stages: how age shows in looks and behaviour. Children are small,
 * big-headed and quick; adults in their prime; from LIFE.greyFrom hair
 * greys and the step slows a little; elders (LIFE.oldAgeFrom) have white
 * hair, a cane and a stoop, walk slowly and tire sooner. Pure.
 */
import { LIFE } from './rules.ts';

export type LifeStage = 'child' | 'adult' | 'grey' | 'elder';

export function lifeStage(age: number): LifeStage {
  if (age < LIFE.adultAge) return 'child';
  if (age >= LIFE.oldAgeFrom) return 'elder';
  if (age >= LIFE.greyFrom) return 'grey';
  return 'adult';
}

/** Walking pace multiplier for this age. */
export function agePace(age: number): number {
  const s = lifeStage(age);
  return s === 'elder' ? LIFE.elderPace : s === 'grey' ? LIFE.greyPace : 1;
}

/** Fatigue rate multiplier for this age (elders tire sooner). */
export function ageFatigue(age: number): number {
  const s = lifeStage(age);
  return s === 'elder' ? LIFE.elderFatigue : s === 'grey' ? LIFE.greyFatigue : 1;
}
