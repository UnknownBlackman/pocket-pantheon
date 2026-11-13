/**
 * Every tuning number for Tabletop Gods lives here. Nothing else in the code
 * base should hard-code a gameplay number. Pure data: no Three.js, no XR.
 */

export const RULES = {
  sim: {
    /** Fixed simulation step rate (ticks per second). */
    hz: 10,
    /** Villager decision rate (decisions per second, per villager). */
    decisionHz: 2,
    /** Random noise added to every action score so villagers do not move in lockstep. */
    decisionNoise: 0.08,
  },

  session: {
    /** Real seconds per phase. Day lengths follow the session loop table. */
    placeSeconds: 20,
    daySeconds: [120, 150, 150] as readonly number[],
    duskSeconds: 90,
    /** Fraction of a day (timeOfDay) after which it counts as night. */
    nightStart: 0.8,
  },

  village: {
    startVillagers: 8,
    maxVillagers: 12,
    startFields: 3,
    startHuts: 3,
    startShrines: 1,
    /** Radius of the round diorama, metres. */
    radius: 0.3,
    /** Walk speed of a villager on the table, metres per second. */
    walkSpeed: 0.035,
    /** Distance at which a villager counts as arrived at a building, metres. */
    arriveDistance: 0.025,
    /** Max distance from a building to be "on" it when dropped, metres. */
    dropSnapDistance: 0.07,
  },

  needs: {
    hungerPerSecond: 0.004,
    fatiguePerSecond: 0.003,
    fatiguePerSecondNight: 0.006,
    /** Hunger removed per second while farming a field that has food. */
    eatPerSecond: 0.02,
    /** Fatigue removed per second while resting in a hut. */
    restPerSecond: 0.02,
    /** Bonus multiplier on resting while the hut is blessed. */
    blessedRestMultiplier: 1.5,
    /** Below this, a need is considered satisfied and the villager moves on. */
    satisfiedBelow: 0.1,
  },

  decisions: {
    /** Bonus added to the farm score when a field is ripe. */
    ripeFieldBonus: 0.15,
    /** Rest score multiplier at night. */
    nightRestMultiplier: 1.6,
    /** Prayer weight (faith x weight). */
    prayFaithWeight: 0.6,
    /** Prayer only allowed when both needs are below this. */
    prayNeedsBelow: 0.5,
    /** Below this initiative a villager idles and waits for the god. */
    dependentInitiative: 0.25,
    /** Baseline idle score, so a contented villager can just wander. */
    idleScore: 0.12,
    /** Score bonus for the action a villager is already doing (prevents flip-flopping). */
    stickiness: 0.2,
    /** Chance per decision that a contented idle villager wanders somewhere new. */
    wanderChance: 0.15,
    /** Seconds a villager commits to an action before re-scoring. */
    minCommitSeconds: 3,
    /** Seconds of commitment after the player drops a villager on a job. */
    liftCommitSeconds: 12,
  },

  farming: {
    /** Field growth per second per worker. */
    growthPerWorker: 0.01,
    /** Growth multiplier while blessed or watered. */
    boostedMultiplier: 2,
    /** Growth needed to harvest; a ripe field yields food then resets. */
    ripeAt: 1,
    /** Food added to village stock per harvest. */
    harvestFood: 12,
    /** Food consumed from stock per unit of hunger eaten. */
    foodPerHunger: 6,
    /** Water lost per second on a normal day. */
    waterDrainPerSecond: 0.004,
    /** Water lost per second during drought. */
    droughtWaterDrainPerSecond: 0.02,
    /** Fields stop growing below this water level. */
    dryBelow: 0.15,
    /** Starting water in each field. */
    startWater: 0.7,
  },

  beliefs: {
    startFaith: 0.5,
    startInitiative: 0.5,
    blessVillagerFaith: 0.08,
    blessVillagerInitiative: -0.05,
    blessBuildingWorkerFaith: 0.03,
    liftInitiative: -0.02,
    /** Passive drift applied once per game day with no intervention. */
    driftFaithPerDay: -0.03,
    driftInitiativePerDay: 0.03,
  },

  powers: {
    blessSeconds: 20,
    blessWorkMultiplier: 1.5,
    blessCost: 1,
    rainCost: 2,
    rainSeconds: 30,
    /** Rain radius around the palm, metres. */
    rainRadius: 0.12,
    rainWaterDrainPerSecond: 0.01,
    shelterCost: 2,
    shelterSeconds: 15,
    /** Shelter radius around its centre, metres. */
    shelterRadius: 0.15,
  },

  favor: {
    start: 3,
    max: 10,
    perPrayer: 0.2,
    /** Seconds of continuous praying that count as one prayer. */
    prayerSeconds: 4,
  },

  weather: {
    /** Probability per second during a storm that an unsheltered villager panics. */
    stormPanicChance: 0.05,
    /** Seconds a panic lasts. */
    panicSeconds: 3,
    /** During drought, hunger grows this much faster (thirst). */
    droughtHungerMultiplier: 1.4,
    /** Drought thirst panic happens when hunger is above this during drought. */
    droughtPanicHunger: 0.85,
  },

  mood: {
    /** mood = 1 - needWeight*avgNeed + beliefWeight*(faith+initiative)/2 - 0.5*beliefWeight */
    needWeight: 0.7,
    beliefWeight: 0.3,
  },

  save: {
    key: 'tabletop-gods-save-v1',
    /** Saves older than this trigger a fast-forward on load (ms). */
    fastForwardAfterMs: 10 * 60 * 1000,
    /** Fast-forward is capped at this many simulated hours. */
    fastForwardMaxHours: 8,
  },

  memory: {
    /** Each villager remembers this many chronicle references. */
    perVillager: 5,
  },
} as const;

/**
 * Hand-gesture thresholds. Starting values to tune on a real headset.
 * Distances in metres, times in seconds.
 */
export const GESTURES = {
  pinchStart: 0.02,
  pinchRelease: 0.035,
  pokeDistance: 0.03,
  pokeHoldSeconds: 1.0,
  /** Palm-down needs the palm normal within ~32 degrees of straight down. */
  palmDownDot: -0.85,
  palmMinHeight: 0.06,
  palmMaxHeight: 0.25,
  palmMaxSpeed: 0.08,
  rainHoldSeconds: 0.8,
  shelterTwoHandMinApart: 0.1,
  shelterTwoHandMaxApart: 0.25,
  shelterTwoHandHoldSeconds: 0.9,
  shelterOneHandHoldSeconds: 2.0,
  pauseHoldSeconds: 1.0,
  noHandsWarningSeconds: 3,
  /** Extended: fingertip reaches this much further from the wrist than its knuckle. */
  fingerExtended: 0.04,
  /** Curled: fingertip reaches less than this beyond its knuckle (often negative). */
  fingerCurled: 0.015,
  /** Palm faces the viewer when its normal points at the head this much (dot). */
  palmFacingDot: 0.7,
  /** Pause palms must be between these distances below the eyes (chest height). */
  pauseMinBelowEye: 0.15,
  pauseMaxBelowEye: 0.6,
  /** Extra poke reach around a building's footprint. */
  buildingPokeRadius: 0.045,
  /** Head-direction gaze: cone half-angle (deg), dwell and max range. */
  gazeConeDegrees: 10,
  gazeDwellSeconds: 0.4,
  /**
   * Eyes look below the head's forward direction when looking down at a table;
   * head-direction gaze aims this many degrees lower to match.
   */
  gazePitchBiasDegrees: 15,
  /** Pointing with the index finger shows a villager's details. */
  pointConeDegrees: 8,
  pointDwellSeconds: 0.2,
  pointMaxDistance: 1.0,
  /** A fingertip this close to a villager shows their details at once. */
  touchDistance: 0.05,
  gazeLingerSeconds: 0.3,
  gazeMaxDistance: 1.5,
  /** After a power fires, the hand must leave the pose for this long. */
  powerCooldownSeconds: 2,
  /** A hand must have been tracked this long before palm powers count it. */
  palmArmSeconds: 1.0,
} as const;

/** Physical sizes from the scale-and-layout table, metres. */
export const LAYOUT = {
  villagerHeight: 0.04,
  fieldSize: 0.1,
  hutSize: 0.08,
  shrineSize: 0.1,
  campfireSize: 0.1,
  /** Height of the diorama base above the table. */
  baseHeight: 0.02,
  /** Fallback platform: in front of the head and below eye level. */
  fallbackForward: 0.5,
  fallbackBelowEye: 0.25,
  /** Accept horizontal planes this high above the floor as tables. */
  tableMinHeight: 0.4,
  tableMaxHeight: 1.0,
  /** Seated reach: ignore table spots further than this from the head (horizontal). */
  maxReach: 0.9,
} as const;

/**
 * The god's hands and head among the villagers (sim/presence.ts). Heights
 * are above the diorama surface, distances on the table plane, metres.
 */
export const PRESENCE = {
  /** A hand moving slower than this (m/s) counts as held still. */
  stillSpeed: 0.08,
  // The god's shadow
  shadowMaxHeight: 0.35,
  shadowPalmRadius: 0.055,
  shadowTipRadius: 0.022,
  /** Shadows grow this much per metre of hand height. */
  shadowGrowPerMetre: 2.5,
  /** Seconds a villager keeps looking up after the shadow leaves. */
  aweSeconds: 0.6,
  /** Villagers under a still hand for this long kneel and pray (an eclipse). */
  eclipseVillagers: 3,
  eclipseSeconds: 1.5,

  // Riding the god's palm
  maxRiders: 3,
  /** An open palm, facing up, held still this low beside the village invites riders. */
  inviteMaxHeight: 0.07,
  inviteSeconds: 0.8,
  inviteRadius: 0.18,
  /** Chance per second that a villager climbs on, times their Faith. */
  climbRatePerFaith: 0.9,
  climbSpeedMultiplier: 1.4,
  /** Riders sit within this radius of the palm centre. */
  rideSpread: 0.02,
  /** Riders fall when the palm tilts more than this, closes, or moves this fast. */
  fallTiltDegrees: 35,
  fallSpeed: 0.6,
  fallSeconds: 0.45,
  dazeSeconds: 2,
  /** The hand counts as lifted above this height; set down below setDownHeight. */
  liftedHeight: 0.08,
  setDownHeight: 0.035,
  rideFaith: 0.02,
  rideInitiative: -0.02,
  fallFaith: -0.03,

  // Hide-and-seek
  /** A hand resting this low (not palm up), still, for this long starts the game. */
  restMaxHeight: 0.05,
  restSeconds: 1.5,
  hideRadius: 0.25,
  maxHiders: 3,
  /** Chance per second a villager joins, times their Initiative (the curious ones). */
  hideRatePerInitiative: 0.8,
  /** Hiders crouch this far behind the hand, away from the god's eyes. */
  hideBehind: 0.06,
  hideBoredSeconds: 25,
  /** Lifting the hand this fast or this high finds them. */
  foundSpeed: 0.45,
  foundHeight: 0.1,
  foundCheerSeconds: 2,

  // They see you
  reactSeconds: 2.5,
  /** The god's head counts as leaning close within these limits. */
  headNearHeight: 0.45,
  headNearDistance: 0.45,
} as const;

/** Wave and raised-hands detection (xr/gestures.ts). */
export const WAVE = {
  /** Side-to-side reversals needed, within the window, each swing this long. */
  reversals: 3,
  windowSeconds: 1.6,
  minSwing: 0.03,
  /** The waving hand must be at least this high above the table. */
  minHeight: 0.12,
  /** Raised hands: palms this far above eye level (negative = below). */
  raisedAboveEye: -0.05,
} as const;
