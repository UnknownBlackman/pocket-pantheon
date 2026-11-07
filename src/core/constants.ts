/** App-wide constants that are not gameplay tuning (those live in sim/rules.ts). */

export const APP_NAME = 'Tabletop Gods';

/** Name given to the Object3D of the village root, for runtime inspection. */
export const VILLAGE_ROOT_NAME = 'VillageRoot';

/** Render priorities for custom systems, in the design's update order. */
export const SYSTEM_PRIORITY = {
  handGesture: 0,
  placement: 1,
  power: 2,
  sim: 10,
  lift: 11,
  sync: 20,
  animation: 21,
  effects: 22,
  audio: 30,
  ui: 31,
  save: 40,
} as const;
