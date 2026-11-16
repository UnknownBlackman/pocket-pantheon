/**
 * Villager names. The founders start the village (Elder Ama first); children
 * are named from the pool for their sex, avoiding names already in use.
 */
import type { Sex, World } from './types.ts';
import { randomInt } from './random.ts';

/** The founding villagers, in order: Elder Ama, then two men and two women. */
export const FOUNDERS: readonly { name: string; sex: Sex }[] = [
  { name: 'Ama', sex: 'f' },
  { name: 'Bode', sex: 'm' },
  { name: 'Cira', sex: 'f' },
  { name: 'Dayo', sex: 'm' },
  { name: 'Eshe', sex: 'f' },
];

export const FEMALE_NAMES = [
  'Ama', 'Cira', 'Eshe', 'Gita', 'Ines', 'Kemi', 'Mira', 'Oya',
  'Rua', 'Sefa', 'Ulla', 'Vida', 'Wren', 'Zia', 'Ada', 'Nell',
] as const;

export const MALE_NAMES = [
  'Bode', 'Dayo', 'Femi', 'Haru', 'Jide', 'Lio', 'Nnamdi', 'Pele',
  'Tobi', 'Yaro', 'Kofi', 'Bran', 'Odo', 'Emeka', 'Tam', 'Ivo',
] as const;

/** Every name in use, for anything that needs the whole list. */
export const NAMES: readonly string[] = [...FEMALE_NAMES, ...MALE_NAMES];

/** The sex that goes with a known name (for saves made before villagers had one). */
export function sexOfName(name: string): Sex {
  return (MALE_NAMES as readonly string[]).includes(name) ? 'm' : 'f';
}

/** A name for `sex` nobody living is using, if possible. */
export function pickName(world: World, sex: Sex): string {
  const taken = new Set<string>();
  for (const v of world.villagers) if (!v.dead) taken.add(v.name);
  const all: readonly string[] = sex === 'm' ? MALE_NAMES : FEMALE_NAMES;
  const free = all.filter((n) => !taken.has(n));
  const pool = free.length ? free : all;
  return pool[randomInt(world, pool.length)];
}
