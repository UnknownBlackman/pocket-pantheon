/**
 * Chronicle: notable events written from plain templates. No AI, no network.
 */
import type { EventBus } from '../core/events.ts';
import { RULES } from './rules.ts';
import type { World } from './types.ts';

export type ChronicleKind =
  | 'dawn'
  | 'first-harvest'
  | 'harvest-day'
  | 'drought'
  | 'fields-dried'
  | 'storm'
  | 'storm-survived'
  | 'panic'
  | 'prayers'
  | 'lifted'
  | 'blessed'
  | 'rain'
  | 'shelter'
  | 'dependent'
  | 'festival'
  | 'dusk'
  | 'away';

type Vars = Record<string, string | number>;

const TEMPLATES: Record<ChronicleKind, (v: Vars) => string> = {
  dawn: (v) => `Day ${v.day}: the sun rose over ${v.villagers} villagers.`,
  'first-harvest': (v) =>
    `Day ${v.day}: ${v.name} brought in the village's first harvest.`,
  'harvest-day': (v) =>
    `Day ${v.day}: the fields gave ${v.count} harvest${v.count === 1 ? '' : 's'}.`,
  drought: (v) => `Day ${v.day}: no rain came, and the soil began to crack.`,
  'fields-dried': (v) =>
    `Day ${v.day}: the fields dried up and the villagers looked to the sky.`,
  storm: (v) => `Day ${v.day}: dark clouds rolled in and a storm broke.`,
  'storm-survived': (v) =>
    `Day ${v.day}: the storm passed${Number(v.panics) > 0 ? `, though ${v.panics} panicked` : ' and nobody panicked'}.`,
  panic: (v) => `Day ${v.day}: ${v.name} ran in terror.`,
  prayers: (v) =>
    `Day ${v.day}: ${v.count} prayer${v.count === 1 ? ' rose' : 's rose'} from the shrine.`,
  lifted: (v) => `Day ${v.day}: a great hand carried ${v.name} to the ${v.place}.`,
  blessed: (v) => `Day ${v.day}: ${v.name} felt the god's touch.`,
  rain: (v) => `Day ${v.day}: rain fell where the god's hand passed.`,
  shelter: (v) => `Day ${v.day}: the god sheltered the village.`,
  dependent: (v) =>
    `Day ${v.day}: ${v.name} stopped working and waited for a sign.`,
  festival: (v) =>
    `Day ${v.day}: faith ran high, and the village held a festival.`,
  dusk: (v) => `Day ${v.day}: the villagers gathered around the fire at dusk.`,
  away: (v) => `While you were away: ${v.summary}`,
};

/** Appends an entry, records it in each named villager's memory and emits an event. */
export function addChronicle(
  world: World,
  kind: ChronicleKind,
  vars: Vars,
  villagerIds: string[] = [],
  bus?: EventBus,
): number {
  const day = world.dayIndex + 1;
  const text = TEMPLATES[kind]({ day, ...vars });
  const index = world.chronicle.length;
  world.chronicle.push({ day, kind, text, villagerIds });
  for (const id of villagerIds) {
    const v = world.villagers.find((x) => x.id === id);
    if (!v) continue;
    v.memory.push({ entryIndex: index });
    while (v.memory.length > RULES.memory.perVillager) v.memory.shift();
  }
  bus?.emit('chronicle.added', { index, text });
  return index;
}
