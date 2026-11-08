/**
 * Procedural low-poly models for the Tabletop Gods village.
 *
 * Conventions (all models):
 * - metres; origin at the centre of the ground-contact footprint, +Y up;
 *   "front" faces +Z (towards the player when the village is unrotated);
 * - deterministic and parentless, so they are valid manifest prototypes and
 *   can be cloned at runtime (clones share geometry and materials);
 * - named semantic parts so systems can animate or restyle them.
 */
import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  SphereGeometry,
  TorusGeometry,
} from '@iwsdk/core';
import type { BufferGeometry, Material } from '@iwsdk/core';
import { LAYOUT } from '../sim/rules.ts';
import { PALETTE } from './village-materials.ts';

function part(name: string, geometry: BufferGeometry, material: Material): Mesh {
  const mesh = new Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

// ------------------------------------------------------------------ Diorama

/**
 * Round diorama, 60 cm across with a stone rim. Origin at the bottom centre;
 * the walkable top surface is at y = LAYOUT.baseHeight.
 */
export function createDiorama(): Group {
  const root = new Group();
  root.name = 'Diorama';
  const r = 0.3;
  const h = LAYOUT.baseHeight;

  const earth = part('Earth', new CylinderGeometry(r * 0.98, r * 0.94, h, 28, 1), PALETTE.soil);
  earth.position.y = h / 2;
  root.add(earth);

  const grass = part('Grass', new CylinderGeometry(r * 0.97, r * 0.97, 0.003, 28, 1), PALETTE.grass);
  grass.position.y = h - 0.0012;
  root.add(grass);

  const rim = part('StoneRim', new TorusGeometry(r * 0.985, 0.011, 5, 28), PALETTE.stone);
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = h - 0.002;
  root.add(rim);
  return root;
}

// ------------------------------------------------------------------ Villager

/**
 * A 4 cm villager. Hierarchy: Villager > Body (squash/stretch pivot at the
 * feet) > Torso, Head, Hair. Body material is the tunic, so systems can tint
 * it per villager by assigning a new material to `Torso`.
 */
export function createVillager(): Group {
  const root = new Group();
  root.name = 'Villager';
  const body = new Group();
  body.name = 'Body';
  root.add(body);

  const torso = part('Torso', new CylinderGeometry(0.0065, 0.0105, 0.024, 7, 1), PALETTE.tunic);
  torso.position.y = 0.012;
  body.add(torso);

  const head = part('Head', new IcosahedronGeometry(0.0085, 1), PALETTE.skin);
  head.position.y = 0.0315;
  body.add(head);

  const hair = part('Hair', new SphereGeometry(0.0088, 7, 4, 0, Math.PI * 2, 0, Math.PI * 0.45), PALETTE.hair);
  hair.position.y = 0.0325;
  body.add(hair);
  return root;
}

// ------------------------------------------------------------------ Buildings

/**
 * A 10 cm square field. `Soil` is restyled when dry; `Crops` is a group whose
 * y-scale shows growth (0..1) and whose rows switch to the ripe material.
 */
export function createField(): Group {
  const root = new Group();
  root.name = 'Field';
  const s = LAYOUT.fieldSize;

  const soil = part('Soil', new BoxGeometry(s, 0.006, s), PALETTE.soil);
  soil.position.y = 0.003;
  root.add(soil);

  const crops = new Group();
  crops.name = 'Crops';
  crops.position.y = 0.006;
  const rowGeo = new BoxGeometry(s * 0.86, 0.012, 0.011);
  rowGeo.translate(0, 0.006, 0); // grow upward from the soil
  for (let i = 0; i < 4; i++) {
    const row = part(`Row${i}`, rowGeo, PALETTE.crop);
    row.position.z = -s * 0.33 + (i * s * 0.66) / 3;
    crops.add(row);
  }
  root.add(crops);
  return root;
}

/** An 8 cm round hut with a thatched cone roof and a door facing +Z. */
export function createHut(): Group {
  const root = new Group();
  root.name = 'Hut';
  const w = LAYOUT.hutSize;

  const walls = part('Walls', new CylinderGeometry(w * 0.36, w * 0.4, w * 0.42, 9, 1), PALETTE.wall);
  walls.position.y = w * 0.21;
  root.add(walls);

  const roof = part('Roof', new ConeGeometry(w * 0.52, w * 0.5, 9, 1), PALETTE.thatch);
  roof.position.y = w * 0.42 + w * 0.25 - 0.002;
  root.add(roof);

  const door = part('Door', new BoxGeometry(w * 0.16, w * 0.26, 0.004), PALETTE.door);
  door.position.set(0, w * 0.13, w * 0.37);
  root.add(door);
  return root;
}

/** A 10 cm shrine: stepped stone base, standing stone and a glowing orb. */
export function createShrine(): Group {
  const root = new Group();
  root.name = 'Shrine';
  const s = LAYOUT.shrineSize;

  const step1 = part('BaseLower', new BoxGeometry(s * 0.8, s * 0.08, s * 0.8), PALETTE.stoneDark);
  step1.position.y = s * 0.04;
  root.add(step1);

  const step2 = part('BaseUpper', new BoxGeometry(s * 0.55, s * 0.08, s * 0.55), PALETTE.stone);
  step2.position.y = s * 0.12;
  root.add(step2);

  const pillar = part('Pillar', new CylinderGeometry(s * 0.1, s * 0.15, s * 0.5, 6, 1), PALETTE.stone);
  pillar.position.y = s * 0.16 + s * 0.25;
  root.add(pillar);

  const orb = part('Orb', new IcosahedronGeometry(s * 0.11, 1), PALETTE.glow);
  orb.position.y = s * 0.16 + s * 0.5 + s * 0.12;
  root.add(orb);
  return root;
}

/** A 10 cm campfire: ring of stones, crossed logs and a flame. */
export function createCampfire(): Group {
  const root = new Group();
  root.name = 'Campfire';
  const s = LAYOUT.campfireSize;

  const ring = part('StoneRing', new TorusGeometry(s * 0.36, s * 0.07, 4, 9), PALETTE.stoneDark);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = s * 0.04;
  root.add(ring);

  const logGeo = new CylinderGeometry(s * 0.04, s * 0.04, s * 0.5, 5, 1);
  logGeo.rotateZ(Math.PI / 2);
  const logA = part('LogA', logGeo, PALETTE.wood);
  logA.position.y = s * 0.05;
  logA.rotation.y = Math.PI / 4;
  root.add(logA);
  const logB = part('LogB', logGeo, PALETTE.wood);
  logB.position.y = s * 0.09;
  logB.rotation.y = -Math.PI / 4;
  root.add(logB);

  const flameGeo = new ConeGeometry(s * 0.13, s * 0.32, 6, 1);
  flameGeo.translate(0, s * 0.16, 0); // pivot at the base so it can flicker in y-scale
  const flame = part('Flame', flameGeo, PALETTE.flame);
  flame.position.y = s * 0.08;
  root.add(flame);
  return root;
}
