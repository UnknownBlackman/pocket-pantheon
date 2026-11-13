/** Villager names. The first eight found the village; the rest are for children. */
import type { World } from './types.ts';
import { randomInt } from './random.ts';

export const NAMES = [
  'Ama', 'Bode', 'Cira', 'Dayo', 'Eshe', 'Femi', 'Gita', 'Haru',
  'Ines', 'Jide', 'Kemi', 'Lio', 'Mira', 'Nnamdi', 'Oya', 'Pele',
  'Rua', 'Sefa', 'Tobi', 'Ulla', 'Vida', 'Wren', 'Yaro', 'Zia',
] as const;

/** A name nobody living or remembered in the graveyard is using, if possible. */
export function pickName(world: World): string {
  const taken = new Set<string>();
  for (const v of world.villagers) if (!v.dead) taken.add(v.name);
  const free = NAMES.filter((n) => !taken.has(n));
  const pool = free.length ? free : NAMES;
  return pool[randomInt(world, pool.length)];
}
