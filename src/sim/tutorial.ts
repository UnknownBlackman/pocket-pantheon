/**
 * The first-visit guided tutorial. Elder Ama leads the new god through
 * everything the village can do, one step at a time; each step waits for
 * the player to do it. While it runs the day clock is held (sim/world.ts),
 * nobody starves or is struck by lightning, and each power step tops up
 * Favor so the player cannot fail for lack of it. The rain step dries a
 * field on purpose; the shelter and swat steps bring a practice storm.
 * Pure simulation code.
 */
import type { EventBus } from '../core/events.ts';
import { addChronicle } from './chronicle.ts';
import { initStorm } from './storm.ts';
import type { Building, Villager, World } from './types.ts';
import { setWeather } from './world.ts';

export type GuideStepId =
  | 'welcome'
  | 'lift'
  | 'bless'
  | 'ride'
  | 'rain'
  | 'shelter'
  | 'swat'
  | 'wave'
  | 'pause';

export type GuideTarget = 'elder' | 'field' | 'dry-field' | 'edge' | 'village' | 'none';

export interface GuideStep {
  id: GuideStepId;
  title: string;
  body: string;
  /** What Elder Ama says. */
  elder: string;
  target: GuideTarget;
}

export const GUIDE: readonly GuideStep[] = [
  {
    id: 'welcome',
    title: 'Meet Elder Ama',
    body: 'Look at Ama (or point at her) for a moment to see how she feels.',
    elder: 'Welcome, great one! Look upon me.',
    target: 'elder',
  },
  {
    id: 'lift',
    title: 'Carry a villager',
    body: 'Pinch a villager, carry them, and let go over the glowing field.',
    elder: 'Carry one of us to the field. We will work it.',
    target: 'field',
  },
  {
    id: 'bless',
    title: 'Bless someone',
    body: 'Point one finger at a villager and hold it there until the ring fills.',
    elder: 'A blessing gives us strength. Touch one of us.',
    target: 'elder',
  },
  {
    id: 'ride',
    title: 'Let them ride',
    body: 'Rest your open hand, palm up, at the glowing edge and keep it still.',
    elder: 'May we climb upon your hand?',
    target: 'edge',
  },
  {
    id: 'rain',
    title: 'Rain on the dry field',
    body: 'Rest your hand on the table to let your riders off. Then hold your open hand flat, palm down, above the parched field.',
    elder: 'The soil cracks! Send rain, we beg you.',
    target: 'dry-field',
  },
  {
    id: 'shelter',
    title: 'Shelter us',
    body: 'A storm! Hold both palms down over the village, or one palm over open ground.',
    elder: 'Dark clouds! Protect us!',
    target: 'village',
  },
  {
    id: 'swat',
    title: 'Sweep the storm away',
    body: 'Swat the little clouds with quick sweeps of your hand. Each costs a little Favor.',
    elder: 'Now drive the clouds away!',
    target: 'village',
  },
  {
    id: 'wave',
    title: 'Say hello',
    body: 'Wave your open hand from side to side above the village.',
    elder: 'Wave to us, so all may see you!',
    target: 'none',
  },
  {
    id: 'pause',
    title: 'Rest when you need to',
    body: 'Hold both palms towards your face at chest height to pause. Poke Resume to carry on.',
    elder: 'When you must rest, show us your palms.',
    target: 'none',
  },
];

export type GuideEvent =
  | { kind: 'inspected' }
  | { kind: 'dropped'; building: string | null }
  | { kind: 'power'; power: 'bless' | 'rain' | 'shelter' }
  | { kind: 'climbed' }
  | { kind: 'calmed' }
  | { kind: 'waved' }
  | { kind: 'paused' };

/** Favor the god is given for each step that needs a power. */
const PRACTICE_FAVOR = 6;

export function guideStep(world: World): GuideStep | null {
  if (!world.guide.active) return null;
  return GUIDE.find((s) => s.id === world.guide.step) ?? null;
}

/** The elder who guides: Ama if she lives, else the oldest adult. */
export function guideElder(world: World): Villager | undefined {
  const ama = world.villagers[0];
  if (ama && !ama.dead) return ama;
  let best: Villager | undefined;
  for (const v of world.villagers) if (!v.dead && (!best || v.age > best.age)) best = v;
  return best;
}

/** The field the guide points at (the middle field, nearest the player). */
export function guideField(world: World): Building | undefined {
  const fields = world.buildings.filter((b) => b.kind === 'field');
  return fields[Math.min(1, fields.length - 1)];
}

export function startGuide(world: World, bus?: EventBus): void {
  world.guide = { step: GUIDE[0].id, active: true };
  enterStep(world, GUIDE[0].id, bus);
}

export function skipGuide(world: World, bus?: EventBus): void {
  finishGuide(world, bus);
}

function finishGuide(world: World, bus?: EventBus): void {
  world.guide = { step: 'done', active: false };
  if (world.weather !== 'clear') setWeather(world, 'clear', bus);
  world.effects.length = 0;
  const elder = guideElder(world);
  if (elder) addChronicle(world, 'guide', { name: elder.name }, [elder.id], bus);
  bus?.emit('guide.step', { step: 'done' });
}

function enterStep(world: World, id: GuideStepId, bus?: EventBus): void {
  const needsFavor = id === 'bless' || id === 'rain' || id === 'shelter' || id === 'swat';
  if (needsFavor) world.favor = Math.max(world.favor, PRACTICE_FAVOR);
  if (id === 'rain') {
    const field = guideField(world);
    if (field) field.water = 0;
  }
  if (id === 'shelter') {
    setWeather(world, 'storm', bus);
    initStorm(world);
  }
  bus?.emit('guide.step', { step: id });
}

function completes(step: GuideStepId, e: GuideEvent): boolean {
  switch (step) {
    case 'welcome':
      return e.kind === 'inspected';
    case 'lift':
      return e.kind === 'dropped' && e.building !== null && e.building.startsWith('field');
    case 'bless':
      return e.kind === 'power' && e.power === 'bless';
    case 'ride':
      return e.kind === 'climbed';
    case 'rain':
      return e.kind === 'power' && e.power === 'rain';
    case 'shelter':
      return e.kind === 'power' && e.power === 'shelter';
    case 'swat':
      return e.kind === 'calmed';
    case 'wave':
      return e.kind === 'waved';
    case 'pause':
      return e.kind === 'paused';
  }
}

/** Practice never fails for lack of Favor: top it up during power steps. */
export function guideTopUp(world: World): void {
  const id = world.guide.active ? world.guide.step : '';
  if ((id === 'bless' || id === 'rain' || id === 'shelter' || id === 'swat') && world.favor < 2) {
    world.favor = PRACTICE_FAVOR;
  }
}

/** Feeds a player action to the guide; returns true when it moved on. */
export function guideEvent(world: World, e: GuideEvent, bus?: EventBus): boolean {
  const step = guideStep(world);
  if (!step || !completes(step.id, e)) return false;
  const i = GUIDE.findIndex((s) => s.id === step.id);
  const next = GUIDE[i + 1];
  if (!next) {
    finishGuide(world, bus);
    return true;
  }
  // Sheltered from the practice storm: keep it going for the swat step.
  if (step.id === 'shelter' && world.weather !== 'storm') {
    setWeather(world, 'storm', bus);
    initStorm(world);
  }
  world.guide.step = next.id;
  enterStep(world, next.id, bus);
  return true;
}
