/**
 * The storm as a handful of little clouds over the village. The god can swat
 * them away (each costs a little Favor); swatted clouds regrow unless every
 * one is cleared, which calms the storm early. Fewer clouds, less panic.
 */
import type { EventBus } from '../core/events.ts';
import { addChronicle } from './chronicle.ts';
import { clamp01 } from './math.ts';
import { STORM } from './rules.ts';
import type { World } from './types.ts';

export function initStorm(world: World): void {
  world.stormClouds = new Array(STORM.clouds).fill(1);
  world.stormRegrow = new Array(STORM.clouds).fill(0);
}

/** 0..1: the share of clouds still over the village (0 when not stormy). */
export function stormStrength(world: World): number {
  if (world.weather !== 'storm') return 0;
  const n = world.stormClouds.length;
  if (!n) return 1;
  let sum = 0;
  for (const c of world.stormClouds) sum += c;
  return sum / n;
}

/** Fixed spot of cloud `i` in village space (x, z on the table, y above it). */
export function stormCloudSpot(i: number): { x: number; y: number; z: number } {
  const a = (i / STORM.clouds) * Math.PI * 2 + (i % 2) * 0.35;
  const r = STORM.cloudRing * (0.55 + (i % 3) * 0.28);
  return { x: Math.cos(a) * r, y: STORM.cloudHeight, z: Math.sin(a) * r };
}

export type SwatResult = 'swatted' | 'calmed' | 'no-favor' | 'gone';

export function swatCloud(world: World, i: number, bus?: EventBus): SwatResult {
  if (world.weather !== 'storm' || !world.stormClouds[i]) return 'gone';
  if (world.favor + 1e-9 < STORM.swatCost) {
    bus?.emit('power.failed', { kind: 'shelter', need: STORM.swatCost, have: world.favor });
    return 'no-favor';
  }
  world.favor = Math.max(0, world.favor - STORM.swatCost);
  world.stormClouds[i] = 0;
  world.stormRegrow[i] = STORM.regrowSeconds;
  world.stats.interventions += 1;
  bus?.emit('storm.swatted', { cloud: i });
  if (stormStrength(world) <= 0) {
    calmStorm(world, bus);
    return 'calmed';
  }
  return 'swatted';
}

/** Every cloud swept away: the storm breaks early. */
export function calmStorm(world: World, bus?: EventBus): void {
  world.weather = 'clear';
  world.sessionCounts.shelter += 1;
  for (const v of world.villagers) {
    if (v.dead) continue;
    v.panic = 0;
    v.beliefs.faith = clamp01(v.beliefs.faith + STORM.calmFaith);
    v.beliefs.initiative = clamp01(v.beliefs.initiative + STORM.calmInitiative);
  }
  addChronicle(world, 'calmed', {}, [], bus);
  bus?.emit('weather.changed', { weather: 'clear' });
  bus?.emit('storm.calmed', {});
}

/** Swatted clouds drift back after a while. */
export function updateStorm(world: World, dt: number): void {
  // The tutorial's practice storm stays cleared where it was swatted.
  if (world.weather !== 'storm' || world.guide.active) return;
  for (let i = 0; i < world.stormClouds.length; i++) {
    if (world.stormClouds[i]) continue;
    world.stormRegrow[i] -= dt;
    if (world.stormRegrow[i] <= 0) world.stormClouds[i] = 1;
  }
}
