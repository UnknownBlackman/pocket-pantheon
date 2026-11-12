/**
 * Marks a village entity as hidden by real-world depth (hands, mugs) using
 * IWSDK's built-in DepthOccludable. UI panels and the "behind your hand"
 * markers are deliberately left non-occludable.
 */
import { DepthOccludable, OcclusionShadersMode } from '@iwsdk/core';
import type { Entity } from '@iwsdk/core';
import { OCCLUSION_MODE } from '../core/constants.ts';

export function makeOccludable(entity: Entity): Entity {
  try {
    entity.addComponent(DepthOccludable, { mode: OcclusionShadersMode[OCCLUSION_MODE] });
  } catch (err) {
    console.warn('[occlusion] could not mark entity occludable', err);
  }
  return entity;
}
