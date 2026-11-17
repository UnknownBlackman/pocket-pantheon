/** App-wide constants that are not gameplay tuning (those live in sim/rules.ts). */

export const APP_NAME = 'Pocket Pantheon';

/** Name given to the Object3D of the village root, for runtime inspection. */
export const VILLAGE_ROOT_NAME = 'VillageRoot';

/**
 * Depth occlusion mode for village meshes: soft (13-tap blur) reads best
 * around fingers. Switch to 'HardOcclusion' if the headset frame rate suffers.
 */
export const OCCLUSION_MODE = 'SoftOcclusion' as const;

/**
 * How far behind the real surface (metres, as the headset measures it) a
 * village surface may be before real-world depth hides it. IWSDK's default
 * starts fading anything within 5 cm *in front of* the real depth, which on a
 * desk swallows the flat ground (a millimetre above the wood) and the bases of
 * everything standing on it. With this window the desk itself, give or take
 * sensor noise, never hides the village, while a hand or mug a few centimetres
 * in front of a villager still does.
 */
export const OCCLUSION_WINDOW = {
  /** At most this far behind the real surface: fully visible. */
  visible: 0.02,
  /** At least this far behind the real surface: fully hidden. */
  hidden: 0.035,
} as const;

/** Render priorities for custom systems, in the design's update order. */
export const SYSTEM_PRIORITY = {
  handGesture: 0,
  handPresence: 0.5,
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
