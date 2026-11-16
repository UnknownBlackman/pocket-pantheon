/**
 * Life and death in the village. One game day is one year.
 * - Children are born at day's end when food is plentiful and the village is
 *   below its population cap; they play near their parents and come of age
 *   at LIFE.adultAge.
 * - Villagers die of old age, of starvation (full hunger for too long) or,
 *   rarely, of lightning in a storm when unsheltered. The dead keep their
 *   place in the villager list (flagged `dead`), get a grave, are mourned
 *   and remembered in the chronicle.
 * - The god's hand never kills: rough handling dazes and leaves a limp.
 */
import type { EventBus } from '../core/events.ts';
import { addChronicle, firstToday } from './chronicle.ts';
import { clamp01, dist } from './math.ts';
import { pickName } from './names.ts';
import { random, randomRange } from './random.ts';
import { LIFE, RULES } from './rules.ts';
import { stormStrength } from './storm.ts';
import type { DeathCause, Villager, World } from './types.ts';
import { isSheltered } from './villager.ts';

export const isChild = (v: Villager): boolean => v.age < LIFE.adultAge;

/** Draw scale for a villager of this age: children are smaller. */
export function villagerScale(age: number): number {
  if (age >= LIFE.adultAge) return 1;
  return LIFE.childScaleMin + (1 - LIFE.childScaleMin) * (Math.max(0, age) / LIFE.adultAge);
}

export function aliveCount(world: World): number {
  let n = 0;
  for (const v of world.villagers) if (!v.dead) n++;
  return n;
}

// ------------------------------------------------------------------ Death

export function kill(world: World, v: Villager, cause: DeathCause, bus?: EventBus): void {
  if (v.dead) return;
  v.dead = true;
  v.deathCause = cause;
  v.activity = 'dead';
  v.intent = 'idle';
  v.target = null;
  v.targetId = null;
  v.carried = false;
  v.panic = 0;
  v.reaction = null;
  v.reactionTime = 0;
  v.ride = 'none';
  v.rideHand = null;
  v.hide = 'none';
  world.graves.push({ name: v.name, age: v.age, cause, day: world.dayIndex + 1 });
  addChronicle(world, 'died', { name: v.name, age: v.age, cause: causeText(cause) }, [v.id], bus);
  if (cause !== 'old age') {
    // The village wonders why its god let this happen.
    for (const o of world.villagers) {
      if (!o.dead) o.beliefs.faith = clamp01(o.beliefs.faith + LIFE.neglectFaith);
    }
  }
  // Those nearby stop to mourn.
  for (const o of world.villagers) {
    if (o.dead || o.carried || o.ride !== 'none' || o.hide !== 'none') continue;
    if (dist(o.pos, v.pos) > LIFE.mournRadius) continue;
    o.reaction = 'mourn';
    o.reactionTime = LIFE.mournSeconds;
    o.activity = 'mourn';
    o.target = null;
  }
  const index = world.villagers.indexOf(v);
  bus?.emit('villager.died', { villagerId: v.id, index, name: v.name, cause, age: v.age });
}

export function causeText(cause: DeathCause): string {
  return cause === 'old age' ? 'of old age' : cause === 'starvation' ? 'of hunger' : 'struck by lightning';
}

/** The god's rough handling: a daze and then a limp, never death. */
export function hurt(world: World, v: Villager, bus?: EventBus): void {
  if (v.dead) return;
  v.reaction = 'daze';
  v.reactionTime = 2;
  v.activity = 'daze';
  v.limp = LIFE.limpSeconds;
  if (firstToday(world, 'hurt')) addChronicle(world, 'hurt', { name: v.name }, [v.id], bus);
  bus?.emit('villager.hurt', { villagerId: v.id });
}

/** Per tick: starvation and lightning. Not during the guided tutorial. */
export function updateLife(world: World, dt: number, bus?: EventBus): void {
  if (world.guide.active || world.phase !== 'day') return;
  const storm = stormStrength(world);
  for (const v of world.villagers) {
    if (v.dead || v.carried) continue;
    if (v.limp > 0) v.limp = Math.max(0, v.limp - dt);
    if (v.needs.hunger >= 0.999) v.starving += dt;
    else v.starving = Math.max(0, v.starving - dt * 2);
    if (v.starving >= LIFE.starveSeconds) {
      kill(world, v, 'starvation', bus);
      continue;
    }
    if (
      storm > 0 &&
      v.ride === 'none' &&
      !isSheltered(world, v.pos.x, v.pos.z) &&
      random(world) < LIFE.lightningPerSecond * storm * dt
    ) {
      bus?.emit('lightning', { x: v.pos.x, z: v.pos.z });
      kill(world, v, 'lightning', bus);
    }
  }
}

// ------------------------------------------------------------------ Birth and age

type MakeVillager = (world: World, index: number) => Villager;

export function makeChild(world: World, a: Villager, b: Villager, make: MakeVillager): Villager {
  const index = world.villagers.length;
  const child = make(world, index);
  child.id = `v${index}-${world.dayIndex}`;
  child.sex = random(world) < 0.5 ? 'f' : 'm';
  child.name = pickName(world, child.sex);
  child.age = 0;
  child.parents = [a.id, b.id];
  child.homeId = a.homeId;
  child.needs.hunger = 0.1;
  child.needs.fatigue = 0.1;
  child.beliefs.faith = clamp01((a.beliefs.faith + b.beliefs.faith) / 2 + randomRange(world, -0.05, 0.05));
  child.beliefs.initiative = clamp01(
    (a.beliefs.initiative + b.beliefs.initiative) / 2 + randomRange(world, -0.05, 0.05),
  );
  child.pos = { x: a.pos.x + randomRange(world, -0.02, 0.02), z: a.pos.z + randomRange(world, -0.02, 0.02) };
  world.villagers.push(child);
  return child;
}

export interface YearReport {
  born: string[];
  died: string[];
}

/**
 * At day's end: everyone ages a year, children may come of age, the very old
 * may die, and with plenty of food and room a child may be born.
 */
export function endOfYear(world: World, make: MakeVillager, bus?: EventBus): YearReport {
  const report: YearReport = { born: [], died: [] };
  for (const v of world.villagers) {
    if (v.dead) continue;
    v.age += 1;
    if (v.age === LIFE.adultAge) addChronicle(world, 'came-of-age', { name: v.name }, [v.id], bus);
  }
  for (const v of world.villagers) {
    if (v.dead || v.age < LIFE.oldAgeFrom) continue;
    const chance = (v.age - LIFE.oldAgeFrom + 1) * LIFE.oldAgeChancePerYear;
    if (random(world) < chance) {
      kill(world, v, 'old age', bus);
      report.died.push(v.name);
    }
  }
  if (aliveCount(world) >= RULES.village.maxVillagers) {
    if (world.food >= LIFE.birthFood && firstToday(world, 'full')) addChronicle(world, 'full', {}, [], bus);
    return report;
  }
  if (world.food < LIFE.birthFood || random(world) >= LIFE.birthChance) return report;
  // The happiest adult and the happiest adult of the other sex become parents.
  const adults = world.villagers
    .filter((v) => !v.dead && !isChild(v) && v.age <= 50)
    .sort((x, y) => y.mood - x.mood);
  const a = adults[0];
  const b = a ? adults.find((v) => v.sex !== a.sex) : undefined;
  if (!a || !b) return report;
  const child = makeChild(world, a, b, make);
  world.food = Math.max(0, world.food - 10);
  addChronicle(world, 'born', { name: child.name, a: a.name, b: b.name }, [child.id, a.id, b.id], bus);
  // Neighbours gather to cheer the newborn.
  for (const o of world.villagers) {
    if (o.dead || o === child || o.carried || o.ride !== 'none' || o.hide !== 'none') continue;
    if (dist(o.pos, a.pos) < 0.15) {
      o.reaction = 'cheer';
      o.reactionTime = 3;
      o.activity = 'cheer';
    }
  }
  report.born.push(child.name);
  bus?.emit('villager.born', {
    villagerId: child.id,
    index: world.villagers.length - 1,
    name: child.name,
    parents: [a.name, b.name],
  });
  return report;
}
