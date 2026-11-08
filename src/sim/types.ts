/**
 * Simulation data model. Pure data, no Three.js or XR imports.
 * Positions are metres on the table plane, village centre at the origin.
 * Ranged values are clamped to 0..1 unless stated.
 */

export type Vec2 = { x: number; z: number };

export type Activity =
  | 'idle'
  | 'walk'
  | 'farm'
  | 'rest'
  | 'pray'
  | 'panic'
  | 'cheer';

/** What the villager is trying to do; `activity` is what they are doing right now. */
export type Intent = 'idle' | 'farm' | 'rest' | 'pray' | 'gather';

export type ChronicleRef = { entryIndex: number };

export interface Villager {
  id: string;
  name: string;
  pos: Vec2;
  target: Vec2 | null;
  activity: Activity;
  needs: { hunger: number; fatigue: number }; // 1 = urgent
  beliefs: { faith: number; initiative: number };
  mood: number; // derived each tick
  carried: boolean; // true while the player holds them
  homeId: string | null;
  memory: ChronicleRef[]; // last 5 things that happened to them

  // Bookkeeping beyond the design sketch.
  intent: Intent;
  targetId: string | null;
  /** Seconds left committed to the current intent before re-scoring. */
  commit: number;
  /** Seconds until the next decision. */
  decisionIn: number;
  /** Seconds of panic remaining. */
  panic: number;
  /** Seconds accumulated towards the next prayer. */
  prayProgress: number;
  /** Seconds of personal bless remaining. */
  blessed: number;
}

export type BuildingKind = 'field' | 'hut' | 'shrine' | 'campfire';

export interface Building {
  id: string;
  kind: BuildingKind;
  pos: Vec2;
  water: number; // fields only
  growth: number; // fields only
  sheltered: number; // seconds of Shelter power remaining
  blessed: number; // seconds of Bless remaining
}

export type Weather = 'clear' | 'drought' | 'storm';
export type Phase = 'day' | 'dusk' | 'ended';

export interface ChronicleEntry {
  day: number;
  kind: string;
  text: string;
  villagerIds: string[];
}

/** A power effect active on the table (rain cloud or shelter dome). */
export interface ActiveEffect {
  kind: 'rain' | 'shelter';
  pos: Vec2;
  radius: number;
  remaining: number;
}

/** Per-day counters used for chronicle text and drift. */
export interface DayStats {
  harvests: number;
  prayers: number;
  panics: number;
  interventions: number;
  fieldsDried: boolean;
}

export interface World {
  version: 1;
  seed: number;
  /** Current state of the seeded RNG, so a save resumes the same sequence. */
  rngState: number;
  /** Total days lived by the village, across sessions. */
  dayIndex: number;
  /** Day within the current session, 0..2. */
  sessionDay: number;
  /** Sessions started, 1 for the first. */
  session: number;
  phase: Phase;
  /** Seconds spent in the current dusk phase. */
  phaseTime: number;
  timeOfDay: number; // 0..1 within a day
  weather: Weather;
  favor: number; // 0..10, not 0..1
  food: number; // village stock, 0..100
  villagers: Villager[];
  buildings: Building[];
  effects: ActiveEffect[];
  chronicle: ChronicleEntry[];
  stats: DayStats;
  /** Totals over the whole save, for milestones like "first harvest". */
  totals: { harvests: number; prayers: number; storms: number };
  /** Beliefs at the start of the session, for the dusk summary. */
  sessionStart: { faith: number; initiative: number };
  lastSavedAt: number; // epoch ms
}
