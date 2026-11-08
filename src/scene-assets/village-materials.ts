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
