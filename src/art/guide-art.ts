/** The tutorial's target marker: a pulsing gold ring and a bobbing arrow. */
import { ConeGeometry, Group, Mesh, MeshBasicMaterial, RingGeometry } from '@iwsdk/core';

const gold = new MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.9, depthWrite: false });

export function makeGuideMarker(): Group {
  const g = new Group();
  g.name = 'GuideMarker';
  const ringGeo = new RingGeometry(0.03, 0.036, 40);
  ringGeo.rotateX(-Math.PI / 2);
  const ring = new Mesh(ringGeo, gold);
  ring.name = 'GuideRing';
  ring.position.y = 0.004;
  ring.renderOrder = 6;
  g.add(ring);
  const arrowGeo = new ConeGeometry(0.008, 0.016, 4);
  arrowGeo.rotateX(Math.PI); // point down
  const arrow = new Mesh(arrowGeo, gold);
  arrow.name = 'GuideArrow';
  arrow.position.y = 0.09;
  arrow.renderOrder = 6;
  g.add(arrow);
  g.visible = false;
  return g;
}
