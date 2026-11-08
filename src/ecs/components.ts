/**
 * Game components. System-free module: no system, DOM or renderer imports.
 * Visible "view" entities mirror the simulation in src/sim by id/index.
 */
import { createComponent, Types } from '@iwsdk/core';

/** The transform that anchors the whole village to the table. */
export const VillageRoot = createComponent('VillageRoot', {}, 'Anchors the village to the table');

/** A villager mesh mirroring sim villager `simIndex`. */
export const VillagerView = createComponent('VillagerView', {
  simId: { type: Types.String, default: '' },
  simIndex: { type: Types.Int16, default: -1 },
  /** Per-villager animation phase offset, so they do not bob in lockstep. */
  phase: { type: Types.Float32, default: 0 },
  /** Last activity seen, for transitions. */
  activity: { type: Types.String, default: 'idle' },
  /** Seconds in the current activity. */
  activityTime: { type: Types.Float32, default: 0 },
});

/** A building mesh mirroring sim building `simIndex`. */
export const BuildingView = createComponent('BuildingView', {
  simId: { type: Types.String, default: '' },
  simIndex: { type: Types.Int16, default: -1 },
  kind: {
    type: Types.Enum,
    enum: { Field: 'field', Hut: 'hut', Shrine: 'shrine', Campfire: 'campfire' },
    default: 'field',
  },
});

/** Visual-only diorama base (the round table piece). */
export const DioramaView = createComponent('DioramaView', {});

/** A transient power effect (sparkles, rain cloud, shelter dome) on the table. */
export const PowerEffect = createComponent('PowerEffect', {
  kind: {
    type: Types.Enum,
    enum: { Bless: 'bless', Rain: 'rain', Shelter: 'shelter' },
    default: 'bless',
  },
  age: { type: Types.Float32, default: 0 },
  duration: { type: Types.Float32, default: 1 },
  radius: { type: Types.Float32, default: 0.05 },
});

/** The chronicle stone tablet beside the shrine. */
export const ChronicleTablet = createComponent('ChronicleTablet', {});

/** The row of Favor gems on the diorama rim. */
export const FavorPips = createComponent('FavorPips', {});
