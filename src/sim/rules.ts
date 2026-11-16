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
    duskSeconds: 60,
    /** Fraction of a day (timeOfDay) after which it counts as night. */
    nightStart: 0.8,
  },

  village: {
    /** Elder Ama and four more: two men and two women (sim/names.ts FOUNDERS). */
    startVillagers: 5,
    /**
     * Population cap, children included. Beyond this a 60 cm village gets
     * crowded, pinching picks the wrong villager and stories blur together.
     */
    maxVillagers: 14,
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
    /** Panicking villagers run this many times walking speed... */
    panicRunSpeed: 2.3,
    /** ...and dart in a new direction about this often (seconds). */
    panicTurnSeconds: 0.9,
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
  /** On a small table the village shrinks to fit, but never below this (villagers stay pinchable). */
  minVillageScale: 0.8,
  /** Look for a table this long after entering XR before staying afloat. */
  surfaceSearchSeconds: 10,
  /** Seconds the village takes to glide down onto a found surface. */
  settleSeconds: 1.6,
  /** Gentle bob while the village floats, metres. */
  floatBob: 0.003,
  /** The look-down ray from the head used to find the table by hit test, degrees below forward. */
  lookDownDegrees: 35,
  /**
   * On a real desk the pedestal sinks away and the village ground sits this
   * far above the desk (just clear of it, so depth occlusion never flickers).
   */
  deskLift: 0.0015,
  /** Seconds the pedestal takes to sink into (or rise from) the desk. */
  deskBlendSeconds: 1.2,
  /** Grid step when searching a table polygon for the best spot, metres. */
  fitGridStep: 0.02,
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
  /** Riders on a hand resting low and still hop off by themselves after this long. */
  restingDismountSeconds: 8,
  /** After hopping off, a villager waits this long before climbing on again. */
  reboardSeconds: 6,
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

/** Life and death (sim/life.ts). Ages are in years; one game day is one year. */
export const LIFE = {
  startAgeMin: 16,
  startAgeMax: 45,
  /** The village elder (Ama, who guides the tutorial) starts this old. */
  elderAge: 58,
  /** Children become adults at this age. */
  adultAge: 13,
  /** Children are drawn at this scale when newborn, growing to full size at adultAge. */
  childScaleMin: 0.6,
  /** Children walk this much faster when playing. */
  childPlaySpeed: 1.3,
  /** Children eat from the village stock wherever they are. */
  childEatPerSecond: 0.012,
  /** Hair greys and the step slows from this age (sim/age.ts)... */
  greyFrom: 45,
  greyPace: 0.9,
  greyFatigue: 1.1,
  /** ...and elders (from oldAgeFrom) stoop on a cane, walk slowly and tire sooner. */
  elderPace: 0.68,
  elderFatigue: 1.35,
  /** From this age the chance of dying of old age each year grows by oldAgeChancePerYear. */
  oldAgeFrom: 58,
  oldAgeChancePerYear: 0.035,
  /** Births happen at day's end when the stock has this much food. */
  birthFood: 45,
  birthChance: 0.55,
  /** A villager starving (hunger at 1) this long dies. */
  starveSeconds: 100,
  /** Hunger and lightning take at most this many villagers a day (the rest hang on). */
  famineDeathsPerDay: 1,
  /** Hunger and lightning never leave the village with fewer adults than this. */
  protectedAdults: 2,
  /** Chance per second that lightning strikes an unsheltered villager at full storm. */
  lightningPerSecond: 0.0004,
  /** Injuries from the god's hand: a daze, then a limp at half speed. */
  limpSeconds: 30,
  limpSpeed: 0.5,
  /** Dropping a pinched villager from higher than this above the table hurts them. */
  hurtDropHeight: 0.12,
  /** Mourners pause for this long. */
  mournSeconds: 5,
  mournRadius: 0.2,
  /** Faith lost by everyone when someone dies of starvation or lightning. */
  neglectFaith: -0.01,
} as const;

/** The storm and swatting it away (sim/storm.ts). */
export const STORM = {
  /** Little storm clouds over the village. */
  clouds: 6,
  cloudRing: 0.11,
  /** Matches the drawn cloud height (art/weather-art CLOUD_HEIGHT). */
  cloudHeight: 0.14,
  cloudRadius: 0.02,
  /** Calming a cloud costs this much Favor. */
  swatCost: 0.25,
  /** Rest a hand on a cloud this long (like a blessing) to calm it. */
  calmHoldSeconds: 1.0,
  /** A hand this close to a cloud's centre is resting on it (metres). */
  calmReach: 0.045,
  /** A hand moving faster than this (m/s) is passing by, not resting. */
  calmMaxSpeed: 0.25,
  /** A calmed cloud regrows after this long (unless all are calmed). */
  regrowSeconds: 25,
  calmFaith: 0.02,
  calmInitiative: -0.01,
} as const;

/** Walking away from the village holds its day clock (ecs/away-system.ts). */
export const AWAY = {
  /** Head further than this from the village centre (horizontal, metres)... */
  distance: 1.5,
  /** ...for this long, and the village waits for the god. */
  seconds: 3,
  /** Coming back within this distance resumes it. */
  returnDistance: 1.2,
} as const;

/**
 * Moving the village (xr/village-carry.ts): both hands open, palms up, at
 * opposite edges of the village, held still, lift it like a tray.
 */
export const CARRY = {
  holdSeconds: 1.5,
  /** Palms count as at the edge between these fractions of the village radius. */
  edgeInner: 0.6,
  edgeOuter: 1.4,
  /** Palm height above the village surface (metres). */
  minAbove: -0.05,
  maxAbove: 0.1,
  /** Palm-up: palm normal at least this much upward (dot with +Y). */
  palmUpDot: 0.6,
  /** The two palms must be on opposite sides (dot of directions below this). */
  oppositeDot: -0.5,
  stillSpeed: 0.12,
  /** While carried: set it down when a palm turns over this far (normal Y below)... */
  releaseDot: 0.2,
  /** ...or the hands spread this much wider than when they lifted it (metres). */
  releaseSpread: 0.2,
  /** How quickly the village follows the hands (per second). */
  followRate: 12,
  /** Only set it down on a table no more than this far below (metres). */
  dropReach: 0.6,
} as const;

/** The village changes as it survives (sim/progress.ts). */
export const PROGRESS = {
  /** Traffic grid cell size (metres). */
  cellSize: 0.02,
  /** Seconds of walking in a cell before a stepping stone appears there... */
  stoneAfter: 20,
  /** ...and when it is fully worn in. */
  stoneFull: 60,
  /** Traffic stops counting here (keeps saves small and stable). */
  trafficCap: 200,
  maxCarvings: 6,
} as const;

/** Little rituals with the god (sim/presence.ts, sim/powers.ts). */
export const RITUAL = {
  /** Curious villagers touch the resting hand's fingertip this long before hiding. */
  touchSeconds: 2.2,
  /** Children run to a resting hand at this rate per second (whatever their Initiative). */
  childJoinRate: 1.6,
  /** A villager set down on a job bows or cheers this long first. */
  dropGreetSeconds: 1.3,
  /** The return ritual: running to the edge (gives up after this long)... */
  rallySeconds: 9,
  rallySpeed: 1.6,
  /** ...then cheering there. */
  rallyCheerSeconds: 3.5,
} as const;
