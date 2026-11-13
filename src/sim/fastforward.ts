/**
 * "While you were away": advances a saved village in coarse steps of one
 * game day, capped at RULES.save.fastForwardMaxHours (one day per real hour,
 * at least one). Crops grow and are harvested, food is eaten, beliefs drift,
 * a child may be born, and a festival may happen if Faith stayed high.
 */
import { addChronicle } from './chronicle.ts';
import { clamp01 } from './math.ts';
import { random } from './random.ts';
import { RULES } from './rules.ts';
import type { World } from './types.ts';
import { aliveCount, endOfYear } from './life.ts';
import { averageBeliefs, freshPresenceFields, makeVillager } from './world.ts';

const FOOD_EATEN_PER_DAY = 20;
const HARVESTS_PER_FIELD_PER_DAY = 1;

export interface AwayReport {
  days: number;
  harvests: number;
  births: string[];
  festival: boolean;
  summary: string;
}

export function fastForward(world: World, hours: number): AwayReport {
  const days = Math.max(1, Math.min(RULES.save.fastForwardMaxHours, Math.round(hours)));
  let harvests = 0;
  const births: string[] = [];
  const deaths: string[] = [];
  let festival = false;
  const fields = world.buildings.filter((b) => b.kind === 'field');

  for (let d = 0; d < days; d++) {
    // Fields with water give a harvest; rain falls now and then.
    for (const f of fields) {
      if (random(world) < 0.5) f.water = 1;
      if (f.water >= RULES.farming.dryBelow) {
        harvests += HARVESTS_PER_FIELD_PER_DAY;
        world.food = Math.min(100, world.food + RULES.farming.harvestFood * HARVESTS_PER_FIELD_PER_DAY);
      }
      f.water = clamp01(f.water - 0.4);
      f.growth = clamp01(random(world) * 0.6);
    }
    world.food = Math.max(0, world.food - FOOD_EATEN_PER_DAY * (aliveCount(world) / 8));
    // Prayers while unattended.
    world.favor = Math.min(RULES.favor.max, world.favor + RULES.favor.perPrayer * 3);
    // Passive drift: the god was away.
    for (const v of world.villagers) {
      if (v.dead) continue;
      v.beliefs.faith = clamp01(v.beliefs.faith + RULES.beliefs.driftFaithPerDay);
      v.beliefs.initiative = clamp01(v.beliefs.initiative + RULES.beliefs.driftInitiativePerDay);
    }
    // A year passes: ageing, old age, and births when food is plentiful.
    const year = endOfYear(world, makeVillager);
    births.push(...year.born);
    deaths.push(...year.died);
    if (!festival && averageBeliefs(world).faith > 0.7) festival = true;
    world.dayIndex += 1;
  }

  // They lived their lives: needs settle to ordinary levels.
  for (const v of world.villagers) {
    v.needs.hunger = clamp01(world.food > 0 ? 0.3 : 0.7);
    v.needs.fatigue = 0.2;
    v.carried = false;
    v.panic = 0;
    v.target = null;
    v.intent = 'idle';
    v.commit = 0;
    Object.assign(v, freshPresenceFields());
  }
  world.effects.length = 0;

  const parts = [`${days} day${days === 1 ? '' : 's'} passed.`];
  if (harvests > 0) parts.push(`The fields gave ${harvests} harvest${harvests === 1 ? '' : 's'}.`);
  if (births.length) parts.push(`${births.join(' and ')} ${births.length === 1 ? 'was' : 'were'} born.`);
  if (deaths.length) parts.push(`${deaths.join(' and ')} died of old age.`);
  if (festival) parts.push('Faith ran high and they held a festival.');
  const summary = parts.join(' ');
  addChronicle(world, 'away', { summary });
  return { days, harvests, births, festival, summary };
}
