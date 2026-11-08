/**
 * Ghost outline of the village shown during placement, and the small
 * hit-test reticle. Runtime-only effect meshes.
 */
import {
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  TorusGeometry,
} from '@iwsdk/core';
import { RULES } from '../sim/rules.ts';

const R = RULES.village.radius;

/** Glowing ring the size of the diorama plus a faint disc to pinch-drag. */
export function makeGhost(): Group {
  const root = new Group();
  root.name = 'PlacementGhost';

  const ring = new Mesh(
    new TorusGeometry(R, 0.005, 6, 48),
    new MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.9 }),
  );
  ring.name = 'GhostRing';
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.006;
  root.add(ring);

  const disc = new Mesh(
    new CylinderGeometry(R, R, 0.012, 32, 1),
    new MeshBasicMaterial({ color: 0xfff2cc, transparent: true, opacity: 0.18, depthWrite: false }),
  );
  disc.name = 'GhostDisc';
  disc.position.y = 0.006;
  root.add(disc);

  // Centre marker so the player sees where the shrine and fire will go.
  const centre = new Mesh(
    new RingGeometry(0.02, 0.028, 24),
    new MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.8 }),
  );
  centre.name = 'GhostCentre';
  centre.rotation.x = -Math.PI / 2;
  centre.position.y = 0.013;
  root.add(centre);
  return root;
}

/** Small ring that follows the hand ray's hit on real surfaces. */
export function makeReticle(): Mesh {
  // The raycast system aligns local +Y with the surface normal, so the ring
  // is baked flat into the geometry rather than rotated on the mesh.
  const geometry = new RingGeometry(0.015, 0.022, 24);
  geometry.rotateX(-Math.PI / 2);
  const mesh = new Mesh(
    geometry,
    new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }),
  );
  mesh.name = 'HitReticle';
  return mesh;
}
