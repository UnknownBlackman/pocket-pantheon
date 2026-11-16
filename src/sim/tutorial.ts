/**
 * The first-visit tutorial, in two parts.
 *
 * 1. The core guide (about a minute): Elder Ama asks the new god to look at
 *    her, carry a villager to a field, bless someone and let them ride a
 *    palm: the signature moments. While it runs the day clock is held,
 *    nobody starves or is struck by lightning, only the current step's
 *    action works, and Favor is topped up so the bless cannot fail.
 *
 * 2. Lessons, taught just in time once the village is running: when the
 *    drought comes Ama asks for rain; when the storm comes she teaches
 *    shelter, then calming the clouds; after a little free play, waving;
 *    at the first dusk, pausing. Lessons hold nothing back, finish when the
 *    player does the thing, and fade if ignored. Skipping the tutorial
 *    skips them too.
 * Pure simulation code.
 */
import type { EventBus } from '../core/events.ts';
import { addChronicle } from './chronicle.ts';
import { RULES } from './rules.ts';
import type { Building, LessonId, Villager, World } from './types.ts';

export type GuideStepId = 'welcome' | 'lift' | 'bless' | 'ride';

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
];

export interface Lesson {
  id: LessonId;
  title: string;
  body: string;
  elder: string;
  target: GuideTarget;
}

export const LESSONS: Record<LessonId, Lesson> = {
  rain: {
    id: 'rain',
    title: 'Rain on the dry fields',
    body: 'Hold your open hand flat, palm down, above a parched field until the ring fills. Set any riders down first.',
    elder: 'The soil cracks! Send rain, we beg you.',
    target: 'dry-field',
  },
  shelter: {
    id: 'shelter',
    title: 'Shelter us',
    body: 'A storm! Hold both palms down over the village, or one palm over open ground.',
    elder: 'Dark clouds! Protect us!',
    target: 'village',
  },
  calm: {
    id: 'calm',
    title: 'Calm the storm',
    body: 'Rest your hand in a little storm cloud and hold it there until its ring fills.',
    elder: 'Now calm the clouds, one by one!',
    target: 'village',
  },
  wave: {
    id: 'wave',
    title: 'Say hello',
    body: 'Wave your open hand from side to side above the village.',
    elder: 'Wave to us, so all may see you!',
    target: 'none',
  },
  pause: {
    id: 'pause',
    title: 'Rest when you need to',
    body: 'Hold both palms towards your face at chest height to pause. Poke Resume to carry on.',
    elder: 'When you must rest, show us your palms.',
    target: 'none',
  },
};

export const LESSON_IDS = Object.keys(LESSONS) as LessonId[];

/** A lesson nobody acts on fades after this long. */
const LESSON_SECONDS = 45;
/** Free play before Ama suggests waving. */
const WAVE_AFTER_SECONDS = 50;

export type GuideEvent =
  | { kind: 'inspected' }
  | { kind: 'dropped'; building: string | null }
  | { kind: 'power'; power: 'bless' | 'rain' | 'shelter' }
  | { kind: 'climbed' }
  | { kind: 'calmed' }
  | { kind: 'waved' }
  | { kind: 'paused' };

/** Favor given for a step or lesson that needs a power. */
const PRACTICE_FAVOR = 6;

export function guideStep(world: World): GuideStep | null {
  if (!world.guide.active) return null;
  return GUIDE.find((s) => s.id === world.guide.step) ?? null;
}

/** The lesson Ama is teaching right now, if any. */
export function activeLesson(world: World): Lesson | null {
  const id = world.lessons.active;
  return id ? LESSONS[id] : null;
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

/** The driest field (for the rain lesson). */
export function driestField(world: World): Building | undefined {
  let best: Building | undefined;
  for (const b of world.buildings) if (b.kind === 'field' && (!best || b.water < best.water)) best = b;
  return best;
}

export function startGuide(world: World, bus?: EventBus): void {
  world.guide = { step: GUIDE[0].id, active: true };
  world.lessons = { active: null, done: [], time: 0, free: 0 };
  enterStep(world, GUIDE[0].id, bus);
}

/** Skipping skips the lessons too. */
export function skipGuide(world: World, bus?: EventBus): void {
  world.lessons = { active: null, done: [...LESSON_IDS], time: 0, free: 0 };
  finishGuide(world, bus);
}

function finishGuide(world: World, bus?: EventBus): void {
  world.guide = { step: 'done', active: false };
  const elder = guideElder(world);
  if (elder) addChronicle(world, 'guide', { name: elder.name }, [elder.id], bus);
  bus?.emit('guide.step', { step: 'done' });
}

function enterStep(world: World, id: GuideStepId, bus?: EventBus): void {
  if (id === 'bless') world.favor = Math.max(world.favor, PRACTICE_FAVOR);
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
  }
}

/** Player actions the core guide can allow or hold back. */
export type GuideAction = 'lift' | 'bless' | 'ride' | 'rain' | 'shelter' | 'calm' | 'hide' | 'move';

const STEP_ACTION: Partial<Record<GuideStepId, GuideAction>> = {
  lift: 'lift',
  bless: 'bless',
  ride: 'ride',
};

/**
 * During the core guide only the current step's action works, so the player
 * learns one thing at a time. Afterwards (lessons included) everything is.
 */
export function guideAllows(world: World, action: GuideAction): boolean {
  if (!world.guide.active) return true;
  return STEP_ACTION[world.guide.step as GuideStepId] === action;
}

/** Practice never fails for lack of Favor: top it up while a power is being taught. */
export function guideTopUp(world: World): void {
  const powerStep = world.guide.active && world.guide.step === 'bless';
  const l = world.lessons.active;
  const powerLesson = l === 'rain' || l === 'shelter' || l === 'calm';
  if ((powerStep || powerLesson) && world.favor < 2) world.favor = PRACTICE_FAVOR;
}

/** Feeds a player action to the core guide; returns true when it moved on. */
export function guideEvent(world: World, e: GuideEvent, bus?: EventBus): boolean {
  const step = guideStep(world);
  if (!step || !completes(step.id, e)) return false;
  const i = GUIDE.findIndex((s) => s.id === step.id);
  const next = GUIDE[i + 1];
  if (!next) {
    finishGuide(world, bus);
    return true;
  }
  world.guide.step = next.id;
  enterStep(world, next.id, bus);
  return true;
}

// ------------------------------------------------------------------ Lessons

function lessonDone(world: World, id: LessonId): boolean {
  return world.lessons.done.includes(id);
}

function endLesson(world: World, bus?: EventBus): void {
  const id = world.lessons.active;
  if (!id) return;
  if (!world.lessons.done.includes(id)) world.lessons.done.push(id);
  world.lessons.active = null;
  world.lessons.time = 0;
  bus?.emit('guide.step', { step: `${id}-done` });
}

function startLesson(world: World, id: LessonId, bus?: EventBus): void {
  world.lessons.active = id;
  world.lessons.time = 0;
  if (id === 'rain' || id === 'shelter' || id === 'calm') {
    world.favor = Math.max(world.favor, id === 'calm' ? 3 : RULES.powers.rainCost + 2);
  }
  bus?.emit('guide.step', { step: id });
}

/** Feeds a player action to the current lesson; returns true when it was learned. */
export function lessonEvent(world: World, e: GuideEvent, bus?: EventBus): boolean {
  const id = world.lessons.active;
  if (!id) return false;
  const learned =
    (id === 'rain' && e.kind === 'power' && e.power === 'rain') ||
    (id === 'shelter' && e.kind === 'power' && e.power === 'shelter') ||
    (id === 'calm' && e.kind === 'calmed') ||
    (id === 'wave' && e.kind === 'waved') ||
    (id === 'pause' && e.kind === 'paused');
  if (!learned) return false;
  endLesson(world, bus);
  return true;
}

/**
 * Starts lessons when their moment comes, and lets ignored ones fade.
 * Runs only after the core guide has been completed (not skipped).
 */
export function updateLessons(world: World, dt: number, bus?: EventBus): void {
  if (world.guide.active || world.guide.step !== 'done') return;
  const L = world.lessons;
  if (L.done.length >= LESSON_IDS.length) return;
  if (L.active) {
    L.time += dt;
    // The weather moved on, or nobody acted: let it go.
    const stormGone = (L.active === 'shelter' || L.active === 'calm') && world.weather !== 'storm';
    if (L.time > LESSON_SECONDS || stormGone) endLesson(world, bus);
    return;
  }
  if (world.phase === 'day') L.free += dt;
  const dryField = world.buildings.some((b) => b.kind === 'field' && b.water < RULES.farming.dryBelow);
  if (!lessonDone(world, 'rain') && world.phase === 'day' && (world.weather === 'drought' || dryField)) {
    startLesson(world, 'rain', bus);
  } else if (!lessonDone(world, 'shelter') && world.weather === 'storm') {
    startLesson(world, 'shelter', bus);
  } else if (lessonDone(world, 'shelter') && !lessonDone(world, 'calm') && world.weather === 'storm') {
    startLesson(world, 'calm', bus);
  } else if (!lessonDone(world, 'pause') && world.phase === 'dusk') {
    startLesson(world, 'pause', bus);
  } else if (!lessonDone(world, 'wave') && world.phase === 'day' && L.free > WAVE_AFTER_SECONDS) {
    startLesson(world, 'wave', bus);
  }
}
