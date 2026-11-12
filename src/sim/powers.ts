/**
 * Effects of each god power on the simulation. Pure code: the XR layer
 * detects the gesture and calls these.
 */
import type { EventBus } from '../core/events.ts';
import { addChronicle } from './chronicle.ts';
import { clamp01, clampToDisc, dist } from './math.ts';
import { RULES } from './rules.ts';
import type { Building, Villager, World } from './types.ts';
import { assignIntent, buildingById } from './villager.ts';
import { freshPresenceFields } from './world.ts';

const R = RULES;

function villagerById(world: World, id: string): Villager | undefined {
  return world.villagers.find((v) => v.id === id);
}

function markIntervention(world: World): void {
  world.stats.interventions += 1;
}

/** Only the first entry of a kind per day goes into the chronicle. */
function firstToday(world: World, kind: string): boolean {
  const day = world.dayIndex + 1;
  return !world.chronicle.some((e) => e.kind === kind && e.day === day);
}

/** Nearest building to a point within the drop-snap distance, if any. */
export function buildingAt(world: World, x: number, z: number): Building | undefined {
  let best: Building | undefined;
  let bestD: number = R.village.dropSnapDistance;
  const p = { x, z };
  for (const b of world.buildings) {
    const d = dist(p, b.pos);
    if (d <= bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}

// ---------------------------------------------------------------- Lift

export function liftVillager(world: World, id: string, bus?: EventBus): boolean {
  const v = villagerById(world, id);
  if (!v || v.carried) return false;
  v.carried = true;
  // A pinch takes priority over riding, hiding or a reaction.
  Object.assign(v, freshPresenceFields());
  v.panic = 0;
  v.target = null;
  v.activity = 'idle';
  bus?.emit('villager.lifted', { villagerId: id });
  return true;
}

/** Updates the sim position of a carried villager (table-plane metres). */
export function moveCarried(world: World, id: string, x: number, z: number): void {
  const v = villagerById(world, id);
  if (!v || !v.carried) return;
  v.pos.x = x;
  v.pos.z = z;
}

/**
 * Drops a carried villager. On a field they farm, on a hut they rest, on the
 * shrine they pray, at the campfire they idle there. Lift costs initiative.
 * Returns the building they were dropped on, if any.
 */
export function dropVillager(
  world: World,
  id: string,
  x: number,
  z: number,
  bus?: EventBus,
): Building | undefined {
  const v = villagerById(world, id);
  if (!v) return undefined;
  v.carried = false;
  v.pos.x = x;
  v.pos.z = z;
  clampToDisc(v.pos, R.village.radius * 0.92);
  const b = buildingAt(world, v.pos.x, v.pos.z);
  if (b) {
    const intent =
      b.kind === 'field' ? 'farm' : b.kind === 'hut' ? 'rest' : b.kind === 'shrine' ? 'pray' : 'idle';
    assignIntent(world, v, intent, b, R.decisions.liftCommitSeconds);
    // Start working where they were dropped instead of walking to a spot.
    v.target = null;
    v.activity = intent === 'farm' ? 'farm' : intent === 'rest' ? 'rest' : intent === 'pray' ? 'pray' : 'idle';
    v.decisionIn = 1 / R.sim.decisionHz;
    v.beliefs.initiative = clamp01(v.beliefs.initiative + R.beliefs.liftInitiative);
    markIntervention(world);
    world.sessionCounts.lift += 1;
    const place = b.kind === 'campfire' ? 'campfire' : b.kind;
    if (firstToday(world, 'lifted')) {
      addChronicle(world, 'lifted', { name: v.name, place }, [v.id], bus);
    }
  } else {
    assignIntent(world, v, 'idle', undefined, 0);
    v.target = null;
    v.activity = 'idle';
  }
  bus?.emit('villager.dropped', {
    villagerId: id,
    buildingId: b ? b.id : null,
    x: v.pos.x,
    z: v.pos.z,
  });
  return b;
}

// ---------------------------------------------------------------- Bless

function spendFavor(world: World, cost: number): boolean {
  if (world.favor + 1e-9 < cost) return false;
  world.favor = Math.max(0, world.favor - cost);
  return true;
}

export function blessVillager(world: World, id: string, bus?: EventBus): boolean {
  const v = villagerById(world, id);
  if (!v || !spendFavor(world, R.powers.blessCost)) return false;
  v.beliefs.faith = clamp01(v.beliefs.faith + R.beliefs.blessVillagerFaith);
  v.beliefs.initiative = clamp01(v.beliefs.initiative + R.beliefs.blessVillagerInitiative);
  v.blessed = R.powers.blessSeconds;
  v.panic = 0;
  world.sessionCounts.bless += 1;
  // A blessing wakes a waiting villager for a while.
  v.commit = 0;
  v.decisionIn = 0;
  markIntervention(world);
  if (firstToday(world, 'blessed')) {
    addChronicle(world, 'blessed', { name: v.name }, [v.id], bus);
  }
  bus?.emit('power.used', { kind: 'bless', targetId: id });
  return true;
}

export function blessBuilding(world: World, id: string, bus?: EventBus): boolean {
  const b = buildingById(world, id);
  if (!b || !spendFavor(world, R.powers.blessCost)) return false;
  b.blessed = R.powers.blessSeconds;
  world.sessionCounts.bless += 1;
  for (const v of world.villagers) {
    if (v.targetId === b.id) {
      v.beliefs.faith = clamp01(v.beliefs.faith + R.beliefs.blessBuildingWorkerFaith);
    }
  }
  markIntervention(world);
  bus?.emit('power.used', { kind: 'bless', targetId: id });
  return true;
}

// ---------------------------------------------------------------- Rain / Shelter

export function rain(world: World, x: number, z: number, bus?: EventBus): boolean {
  if (!spendFavor(world, R.powers.rainCost)) return false;
  world.effects.push({
    kind: 'rain',
    pos: { x, z },
    radius: R.powers.rainRadius,
    remaining: R.powers.rainSeconds,
  });
  for (const b of world.buildings) {
    if (b.kind === 'field' && dist(b.pos, { x, z }) <= R.powers.rainRadius) b.water = 1;
  }
  world.sessionCounts.rain += 1;
  markIntervention(world);
  if (firstToday(world, 'rain')) addChronicle(world, 'rain', {}, [], bus);
  bus?.emit('power.used', { kind: 'rain', targetId: null });
  return true;
}

export function shelter(world: World, x: number, z: number, bus?: EventBus): boolean {
  if (!spendFavor(world, R.powers.shelterCost)) return false;
  world.effects.push({
    kind: 'shelter',
    pos: { x, z },
    radius: R.powers.shelterRadius,
    remaining: R.powers.shelterSeconds,
  });
  for (const b of world.buildings) {
    if (dist(b.pos, { x, z }) <= R.powers.shelterRadius) b.sheltered = R.powers.shelterSeconds;
  }
  for (const v of world.villagers) {
    if (dist(v.pos, { x, z }) <= R.powers.shelterRadius) v.panic = 0;
  }
  world.sessionCounts.shelter += 1;
  markIntervention(world);
  if (firstToday(world, 'shelter')) addChronicle(world, 'shelter', {}, [], bus);
  bus?.emit('power.used', { kind: 'shelter', targetId: null });
  return true;
}
