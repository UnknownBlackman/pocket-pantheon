/**
 * Villager needs, beliefs and decisions. Pure simulation code.
 */
import { ageFatigue, agePace } from './age.ts';
import type { EventBus } from '../core/events.ts';
import { addChronicle } from './chronicle.ts';
import { clamp, clamp01, clampToDisc, dist, stepTowards } from './math.ts';
import { random, randomRange } from './random.ts';
import { LIFE, RITUAL, RULES } from './rules.ts';
import { stormStrength } from './storm.ts';
import type { Building, BuildingKind, Intent, Villager, World } from './types.ts';

const R = RULES;

/** How far from a building's centre villagers stand to use it, metres. */
const STAND_OFF: Record<BuildingKind, number> = { field: 0.025, hut: 0.046, shrine: 0.048, campfire: 0.045 };

export function isNight(world: World): boolean {
  return world.timeOfDay >= R.session.nightStart;
}

export function buildingById(world: World, id: string | null): Building | undefined {
  if (id === null) return undefined;
  return world.buildings.find((b) => b.id === id);
}

export function isSheltered(world: World, x: number, z: number): boolean {
  for (const e of world.effects) {
    if (e.kind !== 'shelter') continue;
    const dx = x - e.pos.x;
    const dz = z - e.pos.z;
    if (dx * dx + dz * dz <= e.radius * e.radius) return true;
  }
  return false;
}

export function isDependent(v: Villager): boolean {
  return v.beliefs.initiative < R.decisions.dependentInitiative;
}

export function updateMood(v: Villager): void {
  const avgNeed = (v.needs.hunger + v.needs.fatigue) / 2;
  const belief = (v.beliefs.faith + v.beliefs.initiative) / 2;
  v.mood = clamp01(
    1 - R.mood.needWeight * avgNeed + R.mood.beliefWeight * (belief - 0.5),
  );
}

function nearestOfKind(
  world: World,
  v: Villager,
  kind: BuildingKind,
  prefer?: (b: Building) => number,
): Building | undefined {
  let best: Building | undefined;
  let bestScore = Infinity;
  for (const b of world.buildings) {
    if (b.kind !== kind) continue;
    const score = dist(v.pos, b.pos) - (prefer ? prefer(b) : 0);
    if (score < bestScore) {
      bestScore = score;
      best = b;
    }
  }
  return best;
}

function anyFieldNearlyRipe(world: World): boolean {
  for (const b of world.buildings) {
    if (b.kind === 'field' && b.growth >= R.farming.ripeAt * 0.8) return true;
  }
  return false;
}

/** Points the villager at a building for the given intent. */
export function assignIntent(
  world: World,
  v: Villager,
  intent: Intent,
  building: Building | undefined,
  commit: number,
): void {
  v.intent = intent;
  v.commit = commit;
  v.prayProgress = 0;
  if (building) {
    v.targetId = building.id;
    // Stand just off-centre so several villagers do not stack exactly.
    const angle = random(world) * Math.PI * 2;
    // Stand around the outside of the model: in a field, by a cottage door,
    // on the shrine steps, outside the campfire's stone ring.
    const r = STAND_OFF[building.kind];
    v.target = { x: building.pos.x + Math.cos(angle) * r, z: building.pos.z + Math.sin(angle) * r };
  } else if (intent === 'idle') {
    v.targetId = null;
    if (isDependent(v)) {
      v.target = null; // waits where they stand
    } else {
      // Wander a little.
      const t = {
        x: v.pos.x + randomRange(world, -0.05, 0.05),
        z: v.pos.z + randomRange(world, -0.05, 0.05),
      };
      clampToDisc(t, R.village.radius * 0.85);
      v.target = t;
    }
  } else {
    v.targetId = null;
    v.target = null;
  }
}

/** Children (under LIFE.adultAge) never farm or pray: they rest or play near family. */
export const childOf = (v: Villager): boolean => v.age < LIFE.adultAge;

function decideChild(world: World, v: Villager): void {
  if (isNight(world) || v.needs.fatigue > 0.6) {
    if (v.intent !== 'rest') {
      const hut = buildingById(world, v.homeId) ?? nearestOfKind(world, v, 'hut');
      assignIntent(world, v, 'rest', hut, R.decisions.minCommitSeconds);
    }
    return;
  }
  if (v.intent === 'play' && v.target) return;
  // Play near a parent (or the campfire): run to a spot, hop about, run again.
  let anchor: Villager | undefined;
  for (const o of world.villagers) {
    if (!o.dead && v.parents.includes(o.id)) {
      anchor = o;
      break;
    }
  }
  const cx = anchor ? anchor.pos.x : 0;
  const cz = anchor ? anchor.pos.z : 0;
  v.intent = 'play';
  v.targetId = null;
  v.commit = 2;
  const t = { x: cx + randomRange(world, -0.05, 0.05), z: cz + randomRange(world, -0.05, 0.05) };
  clampToDisc(t, R.village.radius * 0.85);
  v.target = t;
}

/** The decision rule: score each candidate action and pick the highest. */
export function decide(world: World, v: Villager): void {
  if (world.phase !== 'day') {
    const fire = nearestOfKind(world, v, 'campfire');
    if (v.intent !== 'gather') assignIntent(world, v, 'gather', fire, Infinity);
    return;
  }
  if (childOf(v)) {
    decideChild(world, v);
    return;
  }

  // "Too dependent": waits for a bless or a lift.
  if (isDependent(v)) {
    if (v.intent !== 'idle' || v.target !== null) {
      assignIntent(world, v, 'idle', undefined, 0);
    }
    return;
  }

  const noise = R.sim.decisionNoise;
  const night = isNight(world);
  const farm =
    v.needs.hunger +
    (anyFieldNearlyRipe(world) ? R.decisions.ripeFieldBonus : 0) +
    random(world) * noise;
  const rest =
    v.needs.fatigue * (night ? R.decisions.nightRestMultiplier : 1) +
    random(world) * noise;
  const canPray =
    v.needs.hunger < R.decisions.prayNeedsBelow &&
    v.needs.fatigue < R.decisions.prayNeedsBelow;
  const pray = canPray
    ? v.beliefs.faith * R.decisions.prayFaithWeight + random(world) * noise
    : -1;
  const idle = R.decisions.idleScore + random(world) * noise;

  const stick = R.decisions.stickiness;
  const scores: Record<'idle' | 'farm' | 'rest' | 'pray', number> = { idle, farm, rest, pray };
  if (v.intent !== 'gather' && v.intent !== 'play') scores[v.intent] += stick;

  let intent: Intent = 'idle';
  let best = scores.idle;
  if (scores.farm > best) { best = scores.farm; intent = 'farm'; }
  if (scores.rest > best) { best = scores.rest; intent = 'rest'; }
  if (scores.pray > best) { best = scores.pray; intent = 'pray'; }

  if (intent === v.intent) {
    if (intent !== 'idle') {
      if (v.targetId !== null) return; // keep going
    } else {
      // Contented villagers mostly stand around, sometimes wander.
      if (v.target !== null || random(world) > R.decisions.wanderChance) return;
    }
  }

  let building: Building | undefined;
  if (intent === 'farm') {
    building = nearestOfKind(world, v, 'field', (b) => b.growth * 0.1 + b.water * 0.05);
  } else if (intent === 'rest') {
    building = buildingById(world, v.homeId) ?? nearestOfKind(world, v, 'hut');
  } else if (intent === 'pray') {
    building = nearestOfKind(world, v, 'shrine');
  }
  assignIntent(world, v, intent, building, R.decisions.minCommitSeconds);
}

function workMultiplier(world: World, v: Villager, b: Building): number {
  let m = 1;
  if (b.water >= 0.8) m *= R.farming.boostedMultiplier; // watered
  if (b.blessed > 0) m *= R.powers.blessWorkMultiplier;
  if (v.blessed > 0) m *= R.powers.blessWorkMultiplier;
  return m;
}

function doWork(world: World, v: Villager, dt: number, bus?: EventBus): void {
  const b = buildingById(world, v.targetId);
  if (!b) {
    v.activity = 'idle';
    return;
  }
  switch (v.intent) {
    case 'farm': {
      v.activity = 'farm';
      if (b.water >= R.farming.dryBelow) {
        b.growth += R.farming.growthPerWorker * workMultiplier(world, v, b) * dt;
        if (b.growth >= R.farming.ripeAt) {
          b.growth = 0;
          world.food = Math.min(100, world.food + R.farming.harvestFood);
          world.stats.harvests += 1;
          world.totals.harvests += 1;
          if (world.totals.harvests === 1) {
            addChronicle(world, 'first-harvest', { name: v.name }, [v.id], bus);
          }
        }
      }
      // Eat from the village stock while at the field.
      const eat = Math.min(
        v.needs.hunger,
        R.needs.eatPerSecond * dt,
        world.food / R.farming.foodPerHunger,
      );
      if (eat > 0) {
        v.needs.hunger -= eat;
        world.food = Math.max(0, world.food - eat * R.farming.foodPerHunger);
      }
      break;
    }
    case 'rest': {
      v.activity = 'rest';
      const mult = b.blessed > 0 ? R.needs.blessedRestMultiplier : 1;
      v.needs.fatigue -= R.needs.restPerSecond * mult * dt;
      break;
    }
    case 'pray': {
      v.activity = 'pray';
      accumulatePrayer(world, v, dt);
      break;
    }
    case 'play': {
      v.activity = 'play';
      break;
    }
    case 'gather': {
      v.activity = world.phase === 'dusk' ? 'cheer' : 'idle';
      break;
    }
    default:
      v.activity = 'idle';
  }
}

/** Prayer time turns into Favor: one prayer every prayerSeconds. */
export function accumulatePrayer(world: World, v: Villager, dt: number): void {
  v.prayProgress += dt;
  if (v.prayProgress >= R.favor.prayerSeconds) {
    v.prayProgress -= R.favor.prayerSeconds;
    world.favor = Math.min(R.favor.max, world.favor + R.favor.perPrayer);
    world.stats.prayers += 1;
    world.totals.prayers += 1;
  }
}

/** Somewhere 6-11 cm away, roughly away from where they were heading. */
function fleeSpot(world: World, v: Villager): { x: number; z: number } {
  const a = random(world) * Math.PI * 2;
  const r = 0.06 + random(world) * 0.05;
  const t = { x: v.pos.x + Math.cos(a) * r, z: v.pos.z + Math.sin(a) * r };
  clampToDisc(t, R.village.radius * 0.85);
  return t;
}

function startPanic(world: World, v: Villager, bus?: EventBus): void {
  v.panic = R.weather.panicSeconds;
  v.activity = 'panic';
  v.target = fleeSpot(world, v);
  v.targetId = null;
  world.stats.panics += 1;
  if (world.stats.panics === 1) {
    addChronicle(world, 'panic', { name: v.name }, [v.id], bus);
  }
}

/** Advance one villager by dt seconds. */
export function updateVillager(world: World, v: Villager, dt: number, bus?: EventBus): void {
  if (v.dead) return;
  if (v.carried) {
    updateMood(v);
    return;
  }

  // Needs.
  const night = isNight(world);
  const hungerRate =
    R.needs.hungerPerSecond *
    (world.weather === 'drought' ? R.weather.droughtHungerMultiplier : 1);
  v.needs.hunger = clamp01(v.needs.hunger + hungerRate * dt);
  v.needs.fatigue = clamp01(
    v.needs.fatigue +
      (night ? R.needs.fatiguePerSecondNight : R.needs.fatiguePerSecond) * ageFatigue(v.age) * dt,
  );
  if (v.blessed > 0) v.blessed = Math.max(0, v.blessed - dt);
  // Children eat from the village stock wherever they are.
  if (childOf(v) && world.food > 0 && v.needs.hunger > 0.25) {
    const eat = Math.min(v.needs.hunger, LIFE.childEatPerSecond * dt, world.food / R.farming.foodPerHunger);
    v.needs.hunger -= eat;
    world.food = Math.max(0, world.food - eat * R.farming.foodPerHunger);
  }

  // Riding the god's palm or hiding behind the god's hand: sim/presence.ts
  // moves them; only their needs advance here.
  if (v.ride !== 'none' || v.hide !== 'none') {
    updateMood(v);
    return;
  }

  // The return ritual (sim/presence.ts heroWelcome): run to the edge, then cheer.
  if (v.rally > 0) {
    v.rally -= dt;
    const arrived = v.target
      ? stepTowards(v.pos, v.target, R.village.walkSpeed * RITUAL.rallySpeed * dt)
      : true;
    v.activity = 'walk';
    if (arrived || v.rally <= 0) {
      v.rally = 0;
      v.target = null;
      v.reaction = 'cheer';
      v.reactionTime = RITUAL.rallyCheerSeconds;
      v.activity = 'cheer';
    }
    updateMood(v);
    return;
  }

  // Panic overrides everything unless sheltered.
  const sheltered = isSheltered(world, v.pos.x, v.pos.z);
  if (v.panic > 0) {
    v.panic -= dt;
    if (sheltered) v.panic = 0;
    v.activity = 'panic';
    // Run for it: dash to a spot, then dart off somewhere else (zig-zag).
    const arrived = v.target ? stepTowards(v.pos, v.target, R.village.walkSpeed * R.weather.panicRunSpeed * dt) : true;
    if (arrived || random(world) < dt / R.weather.panicTurnSeconds) v.target = fleeSpot(world, v);
    clampToDisc(v.pos, R.village.radius * 0.9);
    if (v.panic <= 0) {
      v.target = null;
      v.decisionIn = 0;
    }
    updateMood(v);
    return;
  }
  // Short reactions to the god (awe, waving, cheering, dazed, kneeling).
  if (v.reactionTime > 0) {
    v.reactionTime -= dt;
    v.activity = v.reaction ?? 'idle';
    if (v.reaction === 'pray') accumulatePrayer(world, v, dt);
    if (v.reactionTime <= 0) {
      v.reaction = null;
      v.reactionTime = 0;
      v.decisionIn = 0;
    }
    updateMood(v);
    return;
  }
  if (!sheltered && world.phase === 'day') {
    if (world.weather === 'storm' && random(world) < R.weather.stormPanicChance * stormStrength(world) * dt) {
      startPanic(world, v, bus);
      updateMood(v);
      return;
    }
    if (
      world.weather === 'drought' &&
      v.needs.hunger > R.weather.droughtPanicHunger &&
      random(world) < R.weather.stormPanicChance * 0.5 * dt
    ) {
      startPanic(world, v, bus);
      updateMood(v);
      return;
    }
  }

  // Decisions about twice a second, respecting commitment.
  v.commit -= dt;
  v.decisionIn -= dt;
  if (v.decisionIn <= 0) {
    v.decisionIn = 1 / R.sim.decisionHz + randomRange(world, -0.05, 0.05);
    // Re-score once the commitment (e.g. from a lift) has run out.
    if (v.commit <= 0 || world.phase !== 'day') decide(world, v);
  }

  // Movement then work.
  if (v.target) {
    const pace =
      (v.limp > 0 ? LIFE.limpSpeed : 1) *
      (childOf(v) && v.intent === 'play' ? LIFE.childPlaySpeed : 1) *
      agePace(v.age);
    const arrived = stepTowards(v.pos, v.target, R.village.walkSpeed * pace * dt);
    if (!arrived) {
      v.activity = 'walk';
    } else {
      v.target = null;
    }
  }
  if (!v.target) {
    if (v.intent === 'idle') v.activity = 'idle';
    else doWork(world, v, dt, bus);
  }

  v.beliefs.faith = clamp01(v.beliefs.faith);
  v.beliefs.initiative = clamp01(v.beliefs.initiative);
  v.pos.x = clamp(v.pos.x, -R.village.radius, R.village.radius);
  v.pos.z = clamp(v.pos.z, -R.village.radius, R.village.radius);
  updateMood(v);
}
