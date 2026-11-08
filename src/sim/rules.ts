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
  palmDownDot: -0.7,
  palmMinHeight: 0.05,
  palmMaxHeight: 0.3,
  palmMaxSpeed: 0.15,
  rainHoldSeconds: 0.5,
  shelterTwoHandMinApart: 0.1,
  shelterTwoHandMaxApart: 0.25,
  shelterTwoHandHoldSeconds: 0.7,
  shelterOneHandHoldSeconds: 1.5,
  pauseHoldSeconds: 1.0,
  noHandsWarningSeconds: 3,
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
} as const;
