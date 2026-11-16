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
  | 'cheer'
  // Reactions to the god's hands and head (sim/presence.ts):
  | 'awe' // looking up at the hand's shadow
  | 'wave' // waving back at the god
  | 'daze' // dizzy after falling off a hand
  | 'climb' // walking to and hopping onto an open palm
  | 'ride' // sitting on the god's palm
  | 'fall' // tumbling off the palm
  | 'hide' // hiding behind the god's resting hand
  // Life and death (sim/life.ts):
  | 'play' // children at play
  | 'mourn' // standing in grief for someone who died
  | 'dead';

export type RideState = 'none' | 'climb' | 'ride' | 'fall';
export type HideState = 'none' | 'going' | 'hiding';
export type HandSide = 'left' | 'right';

/** What the villager is trying to do; `activity` is what they are doing right now. */
export type Intent = 'idle' | 'farm' | 'rest' | 'pray' | 'gather' | 'play';

export type ChronicleRef = { entryIndex: number };

/** 'f' for women and girls, 'm' for men and boys (looks, names, parents). */
export type Sex = 'f' | 'm';

export interface Villager {
  id: string;
  name: string;
  sex: Sex;
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

  /** A short timed reaction (awe, wave, cheer, daze, pray) that overrides work. */
  reaction: Activity | null;
  reactionTime: number;
  /** Riding the god's palm. Offsets are on the table plane from the palm centre. */
  ride: RideState;
  rideHand: HandSide | null;
  rideX: number;
  rideZ: number;
  /** Seconds in the current ride state; height (m) when a fall began. */
  rideTime: number;
  rideY: number;
  /** True once the riding hand has been lifted off the table. */
  rideLifted: boolean;
  /** True when the current fall was rough (tilted, fast or closed hand): dazes. */
  rideHard: boolean;
  /** Hide-and-seek behind the god's resting hand. */
  hide: HideState;
  hideTime: number;

  /** Age in years (one game day is one year); children are under LIFE.adultAge. */
  age: number;
  dead: boolean;
  deathCause: DeathCause | null;
  /** Parent ids for children born in the village. */
  parents: string[];
  /** Seconds of limping left (injured by the god's hand). */
  limp: number;
  /** Seconds spent at full hunger; starving too long is fatal. */
  starving: number;
}

export type DeathCause = 'old age' | 'starvation' | 'lightning';

export interface Grave {
  name: string;
  age: number;
  cause: DeathCause;
  day: number;
}

/** What the god did this session, for the divine title at dusk. */
export interface SessionCounts {
  lift: number;
  ride: number;
  bless: number;
  rain: number;
  shelter: number;
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
  /** The dead, in order, for the graveyard and the chronicle. */
  graves: Grave[];
  /** Storm clouds over the village: 1 present, 0 swatted away (sim/storm.ts). */
  stormClouds: number[];
  /** Seconds until each swatted cloud regrows. */
  stormRegrow: number[];
  /** First-visit guided tutorial (sim/tutorial.ts). */
  guide: { step: string; active: boolean };
  /** True while the god's hand darkens three or more villagers (they kneel). */
  eclipse: boolean;
  /** This session's interventions, reset each session. */
  sessionCounts: SessionCounts;
  /** What the villagers call the god (sim/title.ts); '' until the first dusk. */
  title: string;
  /** Tutorial steps the player has completed (see sim/tutorial.ts). */
  tutorialDone: string[];
  /** Index of the first chronicle entry of the current session. */
  sessionChronicleStart: number;
  /** Beliefs at the start of the session, for the dusk summary. */
  sessionStart: { faith: number; initiative: number };
  lastSavedAt: number; // epoch ms
}
