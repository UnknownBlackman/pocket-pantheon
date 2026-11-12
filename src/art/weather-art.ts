/**
 * Weather and power visuals: a small rain cloud, the shelter dome and the
 * big storm cloud. Origins sit on the diorama surface under the effect.
 * EffectsSystem animates children named 'Drop', 'Cloud' and 'Dome'.
 */
import {
  BoxGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
} from '@iwsdk/core';

const puffGeo = new IcosahedronGeometry(1, 1);
const cloudMat = new MeshStandardMaterial({ color: 0xe8eef5, roughness: 1, flatShading: true });
const stormMat = new MeshStandardMaterial({ color: 0x5d6470, roughness: 1, flatShading: true });
const dropGeo = new BoxGeometry(0.0012, 0.01, 0.0012);
const dropMat = new MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.85 });
const domeMat = new MeshBasicMaterial({
  color: 0xffe7a8,
  transparent: true,
  opacity: 0.16,
  side: DoubleSide,
  depthWrite: false,
});
const domeRimMat = new MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.8 });

/** Cloud height above the table surface, metres. */
export const CLOUD_HEIGHT = 0.14;

function cloud(radius: number, material: MeshStandardMaterial, puffs: number): Group {
  const g = new Group();
  g.name = 'Cloud';
  for (let i = 0; i < puffs; i++) {
    const a = (i / puffs) * Math.PI * 2;
    const p = new Mesh(puffGeo, material);
    const r = i === 0 ? 0 : radius * 0.55;
    p.position.set(Math.cos(a) * r, (i % 2) * radius * 0.08, Math.sin(a) * r);
    p.scale.set(radius * 0.6, radius * 0.35, radius * 0.6);
    g.add(p);
  }
  g.position.y = CLOUD_HEIGHT;
  return g;
}

function drops(g: Group, radius: number, count: number): void {
  for (let i = 0; i < count; i++) {
    const d = new Mesh(dropGeo, dropMat);
    d.name = 'Drop';
    // Deterministic scatter (golden angle) so no randomness is needed here.
    const a = i * 2.399963;
    const r = radius * Math.sqrt((i + 0.5) / count);
    d.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    d.userData.phase = (i * 0.618) % 1;
    g.add(d);
  }
}

export function makeRainCloud(radius: number): Group {
  const g = new Group();
  g.name = 'RainCloud';
  g.add(cloud(radius, cloudMat, 5));
  drops(g, radius * 0.9, 28);
  return g;
}

export function makeStormCloud(radius: number): Group {
  const g = new Group();
  g.name = 'StormCloud';
  g.add(cloud(radius, stormMat, 9));
  drops(g, radius * 0.95, 60);
  return g;
}

const domeGeos = new Map<number, { dome: SphereGeometry; rim: TorusGeometry }>();

export function makeShelterDome(radius: number): Group {
  let geos = domeGeos.get(radius);
  if (!geos) {
    geos = {
      dome: new SphereGeometry(radius, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      rim: new TorusGeometry(radius, 0.003, 4, 40),
    };
    domeGeos.set(radius, geos);
  }
  const g = new Group();
  g.name = 'ShelterDome';
  const dome = new Mesh(geos.dome, domeMat);
  dome.name = 'Dome';
  g.add(dome);
  const rim = new Mesh(geos.rim, domeRimMat);
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.002;
  g.add(rim);
  return g;
}

const splashGeo = new SphereGeometry(0.004, 6, 3);
const splashMat = new MeshBasicMaterial({ color: 0xdff3ff, transparent: true, opacity: 0.85 });

/** A pool of tiny splash droplets for rain hitting the god's hand. */
export function makeSplashPool(count: number): Group {
  const g = new Group();
  g.name = 'HandSplashes';
  for (let i = 0; i < count; i++) {
    const s = new Mesh(splashGeo, splashMat);
    s.name = 'Splash';
    s.visible = false;
    s.userData.age = 1;
    s.renderOrder = 6;
    g.add(s);
  }
  return g;
}
