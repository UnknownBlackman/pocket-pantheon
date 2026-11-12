/**
 * Visuals for the god's hands: a soft hand-shaped shadow on the diorama
 * (palm plus five fingertips) and the small glowing markers that keep
 * villagers visible when they are hidden behind a real hand.
 */
import { Group, Mesh, MeshBasicMaterial, OctahedronGeometry } from '@iwsdk/core';
import { blobDisc, makeBlobMaterial } from './village-art.ts';

/** Six blobs: index 0 is the palm, 1..5 the fingertips. Each hand gets its own material. */
export function makeHandShadow(name: string): Group {
  const g = new Group();
  g.name = name;
  const material = makeBlobMaterial();
  for (let i = 0; i < 6; i++) {
    const blob = new Mesh(blobDisc(), material);
    blob.name = i === 0 ? 'PalmShadow' : `TipShadow${i}`;
    blob.renderOrder = -1;
    g.add(blob);
  }
  g.visible = false;
  return g;
}

const markerGeo = new OctahedronGeometry(0.006, 0);
markerGeo.scale(1, 1.6, 1);
const markerMat = new MeshBasicMaterial({
  color: 0xffe08a,
  transparent: true,
  opacity: 0.9,
  depthTest: false, // drawn through the real hand on purpose
  depthWrite: false,
});

/** A small glowing diamond shown above a villager hidden behind a hand. */
export function makeHiddenMarker(): Mesh {
  const m = new Mesh(markerGeo, markerMat);
  m.name = 'HiddenMarker';
  m.renderOrder = 30;
  m.visible = false;
  return m;
}
