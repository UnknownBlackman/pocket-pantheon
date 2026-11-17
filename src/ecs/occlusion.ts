/**
 * Marks a village entity as hidden by real-world depth (hands, mugs) using
 * IWSDK's built-in DepthOccludable. UI panels and the "behind your hand"
 * markers are deliberately left non-occludable.
 *
 * The comparison IWSDK injects is retuned (see OCCLUSION_WINDOW): the village
 * sits on a real desk, so a surface at the desk's own depth must stay visible.
 */
import { DepthOccludable, DepthSensingSystem, OcclusionShadersMode } from '@iwsdk/core';
import type { Entity } from '@iwsdk/core';
import { OCCLUSION_MODE, OCCLUSION_WINDOW } from '../core/constants.ts';

/** IWSDK's per-sample test: fades anything within 5 cm in front of the real depth. */
const SAMPLE_TEST = 'return smoothstep(0.0, 0.05, sampleDepth - vOcclusionViewDepth);';
/** The same test in IWSDK's MinMax mode. */
const MINMAX_TEST = 'vec3 occAlphas = clamp((envDepths - vOcclusionViewDepth) * fadeRangeInv, 0.0, 1.0);';

const glsl = (n: number): string => n.toFixed(4);

type ShaderLike = { fragmentShader: string };
type DepthSensingStatics = { addOcclusionToShader: (shader: ShaderLike) => void };

let tuned = false;

/**
 * Retunes IWSDK's occlusion test once, before any occludable material compiles:
 * fully visible up to OCCLUSION_WINDOW.visible behind the real surface, fully
 * hidden from OCCLUSION_WINDOW.hidden.
 */
export function tuneDepthOcclusion(): void {
  if (tuned) return;
  tuned = true;
  const statics = DepthSensingSystem as unknown as DepthSensingStatics;
  const original = statics.addOcclusionToShader.bind(DepthSensingSystem);
  const { visible, hidden } = OCCLUSION_WINDOW;
  statics.addOcclusionToShader = (shader: ShaderLike) => {
    original(shader);
    const before = shader.fragmentShader;
    shader.fragmentShader = before
      .replace(SAMPLE_TEST, `return smoothstep(${glsl(-hidden)}, ${glsl(-visible)}, sampleDepth - vOcclusionViewDepth);`)
      .replace(MINMAX_TEST, `vec3 occAlphas = clamp((envDepths - vOcclusionViewDepth + ${glsl(hidden)}) * fadeRangeInv, 0.0, 1.0);`);
    if (shader.fragmentShader === before) {
      console.warn('[occlusion] IWSDK occlusion shader changed; desk-depth tuning not applied');
    }
  };
}

export function makeOccludable(entity: Entity): Entity {
  try {
    entity.addComponent(DepthOccludable, { mode: OcclusionShadersMode[OCCLUSION_MODE] });
  } catch (err) {
    console.warn('[occlusion] could not mark entity occludable', err);
  }
  return entity;
}
