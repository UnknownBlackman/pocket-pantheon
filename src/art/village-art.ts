/**
 * Runtime art helpers: clones of the manifest model prototypes (sharing
 * geometry and materials), soft blob shadows and per-villager tunic colours.
 */
import {
  CanvasTexture,
  CircleGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
} from '@iwsdk/core';
import type { Group, Object3D } from '@iwsdk/core';
import type { BuildingKind } from '../sim/types.ts';
import {
  createCampfire,
  createDiorama,
  createField,
  createHut,
  createShrine,
  createTablet,
  createVillager,
} from '../scene-assets/village.scene-asset.js';
import { PALETTE } from '../scene-assets/village-materials.js';

type Factory = () => Group;
const prototypes = new Map<string, Group>();

function cloneOf(key: string, factory: Factory): Group {
  let proto = prototypes.get(key);
  if (!proto) {
    proto = factory();
    prototypes.set(key, proto);
  }
  return proto.clone(true);
}

export const makeDiorama = (): Group => cloneOf('diorama', createDiorama);

export function makeTablet(): Group {
  const g = cloneOf('tablet', createTablet);
  g.add(makeBlobShadow(0.07));
  return g;
}

export function makeVillager(index: number): Group {
  const g = cloneOf('villager', createVillager);
  const torso = g.getObjectByName('Torso') as Mesh | undefined;
  if (torso) torso.material = tunicMaterial(index);
  g.add(makeBlobShadow(0.024));
  return g;
}

const BUILDING_FACTORIES: Record<BuildingKind, Factory> = {
  field: createField,
  hut: createHut,
  shrine: createShrine,
  campfire: createCampfire,
};

const SHADOW_SIZE: Record<BuildingKind, number> = {
  field: 0,
  hut: 0.1,
  shrine: 0.11,
  campfire: 0.1,
};

export function makeBuilding(kind: BuildingKind): Group {
  const g = cloneOf(kind, BUILDING_FACTORIES[kind]);
  const size = SHADOW_SIZE[kind];
  if (size > 0) g.add(makeBlobShadow(size));
  return g;
}

// ------------------------------------------------------------------ Tunics

const TUNIC_COLORS = [0xd2694a, 0x4a8bd2, 0xd2b04a, 0x7bbf5a, 0xb05ad2, 0x4ac2b5, 0xe0884a, 0x9a6a4a];
const tunics: MeshStandardMaterial[] = [];

function tunicMaterial(index: number): MeshStandardMaterial {
  const i = index % TUNIC_COLORS.length;
  if (!tunics[i]) {
    const m = PALETTE.tunic.clone();
    m.color.setHex(TUNIC_COLORS[i]);
    tunics[i] = m;
  }
  return tunics[i];
}

// ------------------------------------------------------------------ Blob shadows

let blobMaterial: MeshBasicMaterial | undefined;
let blobGeometry: CircleGeometry | undefined;
let blobTex: CanvasTexture | undefined;

/** A fresh soft-shadow material (own opacity) sharing the blob texture. */
export function makeBlobMaterial(): MeshBasicMaterial {
  blobTex ??= blobTexture();
  return new MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false });
}

/** Flat unit-diameter disc lying on the ground, shared by all blob shadows. */
export function blobDisc(): CircleGeometry {
  if (!blobGeometry) {
    blobGeometry = new CircleGeometry(0.5, 16);
    blobGeometry.rotateX(-Math.PI / 2);
  }
  return blobGeometry;
}

function blobTexture(): CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(30,20,10,0.55)');
  g.addColorStop(0.6, 'rgba(30,20,10,0.25)');
  g.addColorStop(1, 'rgba(30,20,10,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new CanvasTexture(canvas);
}

/** A soft dark disc lying on the ground under an object (no real-time shadows). */
export function makeBlobShadow(diameter: number): Object3D {
  blobMaterial ??= makeBlobMaterial();
  const mesh = new Mesh(blobDisc(), blobMaterial);
  mesh.name = 'BlobShadow';
  mesh.scale.setScalar(diameter);
  mesh.position.y = 0.0008;
  mesh.renderOrder = -1;
  return mesh;
}
