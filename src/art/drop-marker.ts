/** Ground ring under a carried villager; glows gold over a valid job. */
import { Mesh, MeshBasicMaterial, RingGeometry } from '@iwsdk/core';

export const DROP_IDLE = new MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.45,
  depthWrite: false,
});
export const DROP_VALID = new MeshBasicMaterial({
  color: 0xffc94a,
  transparent: true,
  opacity: 0.95,
  depthWrite: false,
});

export function makeDropMarker(): Mesh {
  const geometry = new RingGeometry(0.018, 0.026, 24);
  geometry.rotateX(-Math.PI / 2);
  const mesh = new Mesh(geometry, DROP_IDLE);
  mesh.name = 'DropMarker';
  mesh.renderOrder = 2;
  return mesh;
}
