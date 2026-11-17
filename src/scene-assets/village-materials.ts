import { MeshStandardMaterial } from '@iwsdk/core';

/**
 * Shared warm low-poly palette for every village model. Flat shading gives the
 * faceted diorama look; no textures. Materials are shared across clones, so
 * restyle an instance by assigning a new material, never by mutating these.
 */
const mat = (color: number, extra: Partial<ConstructorParameters<typeof MeshStandardMaterial>[0]> = {}) =>
  new MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, flatShading: true, ...extra });

export const PALETTE = {
  grass: mat(0x8fb35a),
  grassDark: mat(0x6f9445),
  soil: mat(0x8a5a3b),
  soilDry: mat(0xb89466),
  crop: mat(0x9cc94a),
  cropRipe: mat(0xe2c25a),
  stone: mat(0xa59c90),
  stoneDark: mat(0x7d756c),
  wall: mat(0xd9b48a),
  thatch: mat(0xc58b3f),
  door: mat(0x5a3a26),
  wood: mat(0x7a4b2a),
  flame: mat(0xffa53a, { emissive: 0xff7a1a, emissiveIntensity: 1.4, flatShading: false }),
  glow: mat(0xfff0b0, { emissive: 0xffd36b, emissiveIntensity: 1.2, flatShading: false }),
  skin: mat(0xc98d62),
  tunic: mat(0xd2694a),
  hair: mat(0x3b2a20),
} as const;

/** Cottage windows: warm light that EffectsSystem/AnimationSystem raises at dusk. */
export const WINDOW_MAT = new MeshStandardMaterial({
  color: 0x3a2a18,
  emissive: 0xffb54a,
  emissiveIntensity: 0.2,
  roughness: 0.6,
  flatShading: true,
});

/** Chimney smoke puffs (shared; animated by scale, not opacity). */
export const SMOKE_MAT = new MeshStandardMaterial({
  color: 0xd8d4cc,
  transparent: true,
  opacity: 0.55,
  roughness: 1,
  flatShading: true,
  depthWrite: false,
});

/** Medieval hamlet palette (sRGB hex), used through the vertex-colour kit. */
export const HUE = {
  grass: 0x7fa650,
  grassDark: 0x5f8a3d,
  grassLight: 0x9cbf5f,
  dirt: 0xa8835a,
  dirtDark: 0x8a6a46,
  earth: 0x6b4a32,
  earthDark: 0x4e3626,
  stone: 0x9a9286,
  stoneDark: 0x6f675e,
  stoneLight: 0xb8b0a2,
  whitewash: 0xe8dcc4,
  timber: 0x4a3222,
  thatch: 0xc89b4e,
  thatchDark: 0xa87d3a,
  wood: 0x7a5232,
  woodDark: 0x5a3a22,
  slate: 0x5f6570,
  leaves: 0x4f7a34,
  leavesLight: 0x6a9440,
  pine: 0x3d6638,
  trunk: 0x5c3d24,
  hay: 0xd9b860,
  water: 0x3f6f8f,
  iron: 0x3a3a3e,
  banner: 0xa8322d,
  gold: 0xe0b54a,
  cream: 0xf2e6c8,
  bread: 0xc0874a,
} as const;

/**
 * Snow lying on roofs and trees (vertex-coloured white). Shared by every
 * snow mesh; WeatherSystem fades its opacity with World.snowCover.
 */
export const SNOW_MAT = new MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.85,
  flatShading: true,
  transparent: true,
  opacity: 0,
  depthWrite: false,
});
