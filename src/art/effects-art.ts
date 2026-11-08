/**
 * Runtime effect meshes: hold-progress ring, bless sparkles, Favor pips.
 * Shared geometries/materials are module-level; effects are cheap clones.
 */
import {
  AdditiveBlending,
  Color,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  RingGeometry,
  ShaderMaterial,
} from '@iwsdk/core';
import { RULES } from '../sim/rules.ts';

// ------------------------------------------------------------------ Progress ring

const RING_VERT = /* glsl */ `
varying vec2 vP;
void main() {
  vP = position.xz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const RING_FRAG = /* glsl */ `
uniform float progress;
uniform vec3 color;
varying vec2 vP;
void main() {
  float a = atan(vP.x, -vP.y) / 6.2831853 + 0.5;
  if (a > progress) {
    gl_FragColor = vec4(color * 0.5, 0.3);
  } else {
    gl_FragColor = vec4(color, 0.95);
  }
}`;

export type ProgressRing = Mesh & { material: ShaderMaterial };

/** A flat ring that fills clockwise as `setRingProgress` goes 0..1. */
export function makeProgressRing(radius: number, colorHex: number): ProgressRing {
  const geometry = new RingGeometry(radius * 0.72, radius, 40, 1);
  geometry.rotateX(-Math.PI / 2);
  const material = new ShaderMaterial({
    uniforms: { progress: { value: 0 }, color: { value: new Color(colorHex) } },
    vertexShader: RING_VERT,
    fragmentShader: RING_FRAG,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new Mesh(geometry, material) as ProgressRing;
  mesh.name = 'ProgressRing';
  mesh.renderOrder = 5;
  mesh.visible = false;
  return mesh;
}

export function setRingProgress(ring: ProgressRing, progress: number, colorHex?: number): void {
  ring.material.uniforms.progress.value = progress;
  if (colorHex !== undefined) (ring.material.uniforms.color.value as Color).setHex(colorHex);
}

// ------------------------------------------------------------------ Sparkles

const sparkleGeo = new OctahedronGeometry(0.004, 0);
const sparkleMat = new MeshBasicMaterial({
  color: 0xffe08a,
  transparent: true,
  blending: AdditiveBlending,
  depthWrite: false,
});

/** A burst of 12 sparkles; EffectsSystem animates children by their index. */
export function makeSparkles(): Group {
  const g = new Group();
  g.name = 'BlessSparkles';
  for (let i = 0; i < 12; i++) {
    const s = new Mesh(sparkleGeo, sparkleMat);
    const a = (i / 12) * Math.PI * 2;
    s.position.set(Math.cos(a) * 0.015, 0.01 + (i % 3) * 0.008, Math.sin(a) * 0.015);
    s.userData.angle = a;
    g.add(s);
  }
  return g;
}

// ------------------------------------------------------------------ Favor pips

const pipGeo = new IcosahedronGeometry(0.0055, 0);
export const PIP_LIT = new MeshStandardMaterial({
  color: 0xffd36b,
  emissive: 0xffb02e,
  emissiveIntensity: 1.3,
  flatShading: true,
});
export const PIP_DIM = new MeshStandardMaterial({ color: 0x6b6155, roughness: 0.9, flatShading: true });
export const PIP_HALF = new MeshStandardMaterial({
  color: 0xc9a25a,
  emissive: 0x7a5a1a,
  emissiveIntensity: 0.6,
  flatShading: true,
});

/**
 * Ten gems along the front of the stone rim, one per point of Favor. The
 * group's origin is the village centre; the pips sit on the rim facing +Z.
 */
export function makeFavorPips(): Group {
  const g = new Group();
  g.name = 'FavorPips';
  const n = RULES.favor.max;
  const r = RULES.village.radius * 0.985;
  const spread = Math.PI * 0.42;
  for (let i = 0; i < n; i++) {
    const a = Math.PI / 2 + spread / 2 - (spread * i) / (n - 1);
    const pip = new Mesh(pipGeo, PIP_DIM);
    pip.name = `Pip${i}`;
    pip.position.set(Math.cos(a) * r, 0.026, Math.sin(a) * r);
    g.add(pip);
  }
  return g;
}
