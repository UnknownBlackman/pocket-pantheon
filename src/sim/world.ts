/**
 * World state: resources, weather, buildings, time of day, the session loop.
 * Pure simulation code; the ECS SimSystem calls tick() at a fixed rate.
 */
import type { EventBus } from '../core/events.ts';
import { addChronicle } from './chronicle.ts';
import { clamp01 } from './math.ts';
import { pick, random, randomRange } from './random.ts';
import { RULES } from './rules.ts';
import type { Building, BuildingKind, Villager, Weather, World } from './types.ts';
import { updateVillager } from './villager.ts';

const R = RULES;

const NAMES = [
  'Ama', 'Bode', 'Cira', 'Dayo', 'Eshe', 'Femi', 'Gita', 'Haru',
  'Ines', 'Jide', 'Kemi', 'Lio', 'Mira', 'Nnamdi', 'Oya', 'Pele',
] as const;

/** Fixed layout of the starting village, metres from the centre. */
const START_BUILDINGS: ReadonlyArray<{ kind: BuildingKind; x: number; z: number }> = [
  { kind: 'campfire', x: 0, z: 0 },
  { kind: 'shrine', x: 0, z: -0.19 },
  { kind: 'field', x: -0.15, z: 0.14 },
  { kind: 'field', x: 0, z: 0.19 },
  { kind: 'field', x: 0.15, z: 0.14 },
  { kind: 'hut', x: -0.19, z: -0.06 },
  { kind: 'hut', x: 0.19, z: -0.06 },
  { kind: 'hut', x: -0.12, z: -0.18 },
];

function makeBuilding(id: string, kind: BuildingKind, x: number, z: number): Building {
  return {
    id,
    kind,
    pos: { x, z },
    water: kind === 'field' ? R.farming.startWater : 0,
    growth: 0,
    sheltered: 0,
    blessed: 0,
  };
}

export function makeVillager(world: World, index: number): Villager {
  const huts = world.buildings.filter((b) => b.kind === 'hut');
  const angle = (index / R.village.startVillagers) * Math.PI * 2;
  const r = 0.07 + random(world) * 0.03;
  return {
    id: `v${index}`,
    name: NAMES[index % NAMES.length],
    pos: { x: Math.cos(angle) * r, z: Math.sin(angle) * r },
    target: null,
    activity: 'idle',
    needs: {
      hunger: randomRange(world, 0.1, 0.4),
      fatigue: randomRange(world, 0.05, 0.3),
    },
    beliefs: {
      faith: clamp01(R.beliefs.startFaith + randomRange(world, -0.1, 0.1)),
      initiative: clamp01(R.beliefs.startInitiative + randomRange(world, -0.1, 0.1)),
    },
    mood: 0.7,
    carried: false,
    homeId: huts.length ? huts[index % huts.length].id : null,
    memory: [],
    intent: 'idle',
    targetId: null,
    commit: 0,
    decisionIn: random(world) / R.sim.decisionHz,
    panic: 0,
    prayProgress: 0,
    blessed: 0,
  };
}

export function freshStats(): World['stats'] {
  return { harvests: 0, prayers: 0, panics: 0, interventions: 0, fieldsDried: false };
}

export function createWorld(seed = 1): World {
  const world: World = {
    version: 1,
    seed,
    rngState: seed >>> 0,
    dayIndex: 0,
    sessionDay: 0,
    session: 1,
    phase: 'day',
    phaseTime: 0,
    timeOfDay: 0,
    weather: 'clear',
    favor: R.favor.start,
    food: 40,
    villagers: [],
    buildings: [],
    effects: [],
    chronicle: [],
    stats: freshStats(),
    totals: { harvests: 0, prayers: 0, storms: 0 },
    tutorialDone: [],
    sessionStart: { faith: R.beliefs.startFaith, initiative: R.beliefs.startInitiative },
    lastSavedAt: 0,
  };
  const counts: Record<BuildingKind, number> = { field: 0, hut: 0, shrine: 0, campfire: 0 };
  for (const b of START_BUILDINGS) {
    world.buildings.push(makeBuilding(`${b.kind}${counts[b.kind]++}`, b.kind, b.x, b.z));
  }
  for (let i = 0; i < R.village.startVillagers; i++) {
    world.villagers.push(makeVillager(world, i));
  }
  const avg = averageBeliefs(world);
  world.sessionStart = { faith: avg.faith, initiative: avg.initiative };
  addChronicle(world, 'dawn', { villagers: world.villagers.length });
  return world;
}

export function dayLength(world: World): number {
  const days = R.session.daySeconds;
  return days[Math.min(world.sessionDay, days.length - 1)];
}

export function averageBeliefs(world: World): { faith: number; initiative: number; mood: number } {
  let faith = 0;
  let initiative = 0;
  let mood = 0;
  const n = world.villagers.length || 1;
  for (const v of world.villagers) {
    faith += v.beliefs.faith;
    initiative += v.beliefs.initiative;
    mood += v.mood;
  }
  return { faith: faith / n, initiative: initiative / n, mood: mood / n };
}

/** Dusk score: average of (1 - |faith - initiative|) and average mood, as 1..5 stars. */
export function duskScore(world: World): { score: number; stars: number } {
  let balance = 0;
  let mood = 0;
  const n = world.villagers.length || 1;
  for (const v of world.villagers) {
    balance += 1 - Math.abs(v.beliefs.faith - v.beliefs.initiative);
    mood += v.mood;
  }
  const score = clamp01((balance / n + mood / n) / 2);
  return { score, stars: 1 + Math.round(score * 4) };
}

/** Weather for a given session day: scripted in the first session, random after. */
export function weatherForDay(world: World): Weather {
  if (world.sessionDay === 0) return 'clear';
  if (world.session === 1) return world.sessionDay === 1 ? 'drought' : 'storm';
  return pick(world, ['clear', 'drought', 'storm'] as const);
}

export function setWeather(world: World, weather: Weather, bus?: EventBus): void {
  if (world.weather === weather) return;
  world.weather = weather;
  if (weather === 'drought') addChronicle(world, 'drought', {}, [], bus);
  if (weather === 'storm') {
    world.totals.storms += 1;
    addChronicle(world, 'storm', {}, [], bus);
  }
  bus?.emit('weather.changed', { weather });
}

function endOfDay(world: World, bus?: EventBus): void {
  const s = world.stats;
  if (s.harvests > 0) addChronicle(world, 'harvest-day', { count: s.harvests }, [], bus);
  if (s.prayers > 0) addChronicle(world, 'prayers', { count: s.prayers }, [], bus);
  if (world.weather === 'storm') {
    addChronicle(world, 'storm-survived', { panics: s.panics }, [], bus);
  }
  // Passive drift when the god stayed away all day.
  if (s.interventions === 0) {
    for (const v of world.villagers) {
      v.beliefs.faith = clamp01(v.beliefs.faith + R.beliefs.driftFaithPerDay);
      v.beliefs.initiative = clamp01(v.beliefs.initiative + R.beliefs.driftInitiativePerDay);
    }
  }
}

function startDay(world: World, bus?: EventBus): void {
  world.timeOfDay = 0;
  world.stats = freshStats();
  setWeather(world, weatherForDay(world), bus);
  if (world.weather === 'clear' && world.sessionDay > 0) {
    addChronicle(world, 'dawn', { villagers: world.villagers.length }, [], bus);
  }
  bus?.emit('day.changed', { dayIndex: world.dayIndex });
}

function startDusk(world: World, bus?: EventBus): void {
  world.phase = 'dusk';
  world.phaseTime = 0;
  world.timeOfDay = 1;
  world.effects.length = 0;
  setWeather(world, 'clear', bus);
  if (averageBeliefs(world).faith > 0.7) addChronicle(world, 'festival', {}, [], bus);
  addChronicle(world, 'dusk', {}, [], bus);
  for (const v of world.villagers) {
    v.panic = 0;
    v.commit = 0;
    v.decisionIn = 0;
  }
  bus?.emit('session.dusk', { dayIndex: world.dayIndex });
}

/** Begins a new session on an existing village (after dusk or on reload). */
export function startSession(world: World, bus?: EventBus): void {
  world.session += 1;
  world.sessionDay = 0;
  world.phase = 'day';
  world.phaseTime = 0;
  const avg = averageBeliefs(world);
  world.sessionStart = { faith: avg.faith, initiative: avg.initiative };
  for (const v of world.villagers) {
    v.intent = 'idle';
    v.commit = 0;
  }
  startDay(world, bus);
}

function updateBuildings(world: World, dt: number, bus?: EventBus): void {
  const drain =
    world.weather === 'drought'
      ? R.farming.droughtWaterDrainPerSecond
      : R.farming.waterDrainPerSecond;
  for (const b of world.buildings) {
    if (b.blessed > 0) b.blessed = Math.max(0, b.blessed - dt);
    if (b.sheltered > 0) b.sheltered = Math.max(0, b.sheltered - dt);
    if (b.kind !== 'field') continue;
    // Rain keeps fields watered while it lasts.
    let raining = world.weather === 'storm';
    for (const e of world.effects) {
      if (e.kind !== 'rain') continue;
      const dx = b.pos.x - e.pos.x;
      const dz = b.pos.z - e.pos.z;
      if (dx * dx + dz * dz <= e.radius * e.radius) raining = true;
    }
    if (raining) {
      b.water = 1;
    } else {
      const wasWet = b.water >= R.farming.dryBelow;
      b.water = clamp01(b.water - drain * dt);
      if (wasWet && b.water < R.farming.dryBelow && !world.stats.fieldsDried) {
        world.stats.fieldsDried = true;
        addChronicle(world, 'fields-dried', {}, [], bus);
      }
    }
  }
}

function updateEffects(world: World, dt: number): void {
  for (let i = world.effects.length - 1; i >= 0; i--) {
    const e = world.effects[i];
    e.remaining -= dt;
    if (e.remaining <= 0) world.effects.splice(i, 1);
  }
}

/** Advance the whole simulation by dt seconds. */
export function tick(world: World, dt: number, bus?: EventBus): void {
  if (world.phase === 'ended') return;

  if (world.phase === 'day') {
    world.timeOfDay += dt / dayLength(world);
    if (world.timeOfDay >= 1) {
      endOfDay(world, bus);
      world.dayIndex += 1;
      world.sessionDay += 1;
      if (world.sessionDay >= R.session.daySeconds.length) {
        startDusk(world, bus);
      } else {
        startDay(world, bus);
      }
    }
  } else if (world.phase === 'dusk') {
    world.phaseTime += dt;
    if (world.phaseTime >= R.session.duskSeconds) world.phase = 'ended';
  }

  updateEffects(world, dt);
  updateBuildings(world, dt, bus);
  for (const v of world.villagers) updateVillager(world, v, dt, bus);
  world.favor = Math.min(R.favor.max, Math.max(0, world.favor));
  world.food = Math.min(100, Math.max(0, world.food));
}

/** Run many fixed steps; handy for tests and fast-forward. */
export function runFor(world: World, seconds: number, bus?: EventBus): void {
  const dt = 1 / R.sim.hz;
  const steps = Math.round(seconds * R.sim.hz);
  for (let i = 0; i < steps; i++) tick(world, dt, bus);
}
