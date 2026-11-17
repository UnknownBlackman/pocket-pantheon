/**
 * Gentle weather over the village (sim weather 'rain' and 'snow'):
 * - a soft grey cloud layer drifting overhead;
 * - rain streaks or drifting snowflakes, falling only inside the village;
 * - snow that settles: a patchy white blanket on the ground, caps on the
 *   cottage roofs and the trees ('SnowCap', 'SnowTrees'), fading with
 *   World.snowCover so it builds up while it snows and melts afterwards;
 * - villagers pull up their hoods ('RainHood') in rain and snow.
 * Everything lives in village space, so it follows the village (and sits on
 * the real desk in Living Desk mode).
 */
import {
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  createSystem,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from '@iwsdk/core';
import type { Entity, Object3D } from '@iwsdk/core';
import { SNOW_MAT } from '../scene-assets/village-materials.ts';
import { LAYOUT, RULES } from '../sim/rules.ts';
import { BuildingView, DioramaView, VillageRoot, VillagerView } from './components.ts';
import { game } from './game.ts';
import { makeOccludable } from './occlusion.ts';

const R = RULES.village.radius;
const H = LAYOUT.baseHeight;
const SKY = 0.2; // where rain and snow start (and the clouds float), above the village surface
const RAIN_DROPS = 420;
const SNOW_FLAKES = 320;
const RAIN_SPEED = 0.62; // m/s: a little slower than life, so it reads as rain at this scale
const SNOW_SPEED = 0.035;
const FADE_PER_SECOND = 0.35;
const FLUTTER_AXIS = new Vector3(0.3, 1, 0.2).normalize();
const HOOD_REFRESH_SECONDS = 2;

interface Particle {
  x: number;
  y: number;
  z: number;
  phase: number;
}

function scatter(n: number, seed: number): Particle[] {
  let s = seed;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const out: Particle[] = [];
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * R * 0.97;
    out.push({ x: Math.cos(a) * r, y: H + rnd() * SKY, z: Math.sin(a) * r, phase: rnd() * Math.PI * 2 });
  }
  return out;
}

/** A soft, patchy snow blanket: white with uneven alpha, thinning at the edge. */
function snowTexture(): CanvasTexture {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);
  let s = 7;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = 0; i < 260; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * size * 0.47;
    const x = size / 2 + Math.cos(a) * r;
    const y = size / 2 + Math.sin(a) * r;
    const rad = 10 + rnd() * 26;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, 'rgba(250,252,255,0.9)');
    g.addColorStop(0.6, 'rgba(244,248,252,0.6)');
    g.addColorStop(1, 'rgba(240,246,252,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  // Fade out towards the rim.
  ctx.globalCompositeOperation = 'destination-in';
  const edge = ctx.createRadialGradient(size / 2, size / 2, size * 0.36, size / 2, size / 2, size * 0.5);
  edge.addColorStop(0, 'rgba(0,0,0,1)');
  edge.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, size, size);
  return new CanvasTexture(c);
}

export class WeatherSystem extends createSystem({
  roots: { required: [VillageRoot] },
  buildings: { required: [BuildingView] },
  dioramas: { required: [DioramaView] },
  villagers: { required: [VillagerView] },
}) {
  private group: Group | null = null;
  private clouds!: Group;
  private cloudMat!: MeshStandardMaterial;
  private rain!: InstancedMesh;
  private rainMat!: MeshBasicMaterial;
  private snow!: InstancedMesh;
  private snowMat!: MeshBasicMaterial;
  private blanket!: Mesh;
  private blanketMat!: MeshBasicMaterial;
  private drops = scatter(RAIN_DROPS, 11);
  private flakes = scatter(SNOW_FLAKES, 23);
  private rainLevel = 0;
  private snowLevel = 0;
  private m = new Matrix4();
  private q = new Quaternion();
  private p = new Vector3();
  private s = new Vector3(1, 1, 1);
  private lastCover = -1;
  private lastHood = false;
  private hoodRefresh = 0;

  private root(): Entity | undefined {
    for (const e of this.queries.roots.entities) return e;
    return undefined;
  }

  private build(root: Entity): void {
    const g = new Group();
    g.name = 'Weather';

    // A soft cloud layer: small smooth puffs over the back and sides only, so
    // the near side (the player looks in from +Z) stays open.
    this.clouds = new Group();
    this.cloudMat = new MeshStandardMaterial({ color: 0xb4bcc6, roughness: 1, transparent: true, opacity: 0, depthWrite: false });
    const puff = new IcosahedronGeometry(1, 2);
    for (let i = 0; i < 16; i++) {
      // From 150 to 390 degrees round the back (local -Z is away from the player).
      const deg = 150 + (i / 15) * 240;
      const a = (deg * Math.PI) / 180;
      const r = R * (0.55 + (i % 3) * 0.14);
      const p = new Mesh(puff, this.cloudMat);
      p.position.set(Math.cos(a) * r, H + SKY + (i % 2) * 0.008, Math.sin(a) * r);
      const size = 0.026 + (i % 4) * 0.005;
      p.scale.set(size * 1.3, size * 0.5, size);
      this.clouds.add(p);
    }
    g.add(this.clouds);

    this.rainMat = new MeshBasicMaterial({ color: 0xd6ecff, transparent: true, opacity: 0, depthWrite: false });
    this.rain = new InstancedMesh(new BoxGeometry(0.0009, 0.016, 0.0009), this.rainMat, RAIN_DROPS);
    this.rain.frustumCulled = false;
    g.add(this.rain);

    this.snowMat = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
    this.snow = new InstancedMesh(new IcosahedronGeometry(0.0013, 0), this.snowMat, SNOW_FLAKES);
    this.snow.frustumCulled = false;
    g.add(this.snow);

    // The snow blanket on the ground, above the grass, paths and decals.
    this.blanketMat = new MeshBasicMaterial({
      map: snowTexture(),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    const disc = new CircleGeometry(R * 0.99, 48);
    disc.rotateX(-Math.PI / 2);
    this.blanket = new Mesh(disc, this.blanketMat);
    this.blanket.position.y = H + 0.0012;
    this.blanket.renderOrder = 1;
    g.add(this.blanket);

    g.visible = false;
    this.group = g;
    makeOccludable(this.world.createTransformEntity(g, { parent: root, persistent: true }));
  }

  update(delta: number, time: number): void {
    const root = this.root();
    if (!root?.object3D) return;
    if (!this.group) this.build(root);
    const sim = game.sim;
    const day = game.stage === 'playing' && sim.phase === 'day';
    const step = Math.min(1, delta * FADE_PER_SECOND);
    const towards = (v: number, target: number) => v + Math.sign(target - v) * Math.min(Math.abs(target - v), step);
    this.rainLevel = towards(this.rainLevel, day && sim.weather === 'rain' ? 1 : 0);
    this.snowLevel = towards(this.snowLevel, day && sim.weather === 'snow' ? 1 : 0);
    const sky = Math.max(this.rainLevel, this.snowLevel);
    const cover = sim.snowCover;

    const g = this.group!;
    g.visible = sky > 0.001 || cover > 0.001;
    if (!g.visible) {
      this.applyCover(0);
      this.applyHoods(false);
      return;
    }

    // Clouds drift slowly round.
    this.cloudMat.opacity = 0.6 * sky;
    this.cloudMat.color.setHex(this.rainLevel >= this.snowLevel ? 0x9aa3ae : 0xd7dde4);
    this.clouds.visible = sky > 0.01;
    // A gentle bob (no spin, so the near side stays open).
    this.clouds.position.y = Math.sin(time * 0.3) * 0.003;

    this.updateRain(delta);
    this.updateSnow(delta, time);

    this.blanketMat.opacity = 0.92 * cover;
    this.blanket.visible = cover > 0.01;
    this.applyCover(cover);
    this.hoodRefresh -= delta;
    if (this.hoodRefresh <= 0) {
      // Also catches newborns and villagers whose figure was rebuilt.
      this.hoodRefresh = HOOD_REFRESH_SECONDS;
      this.lastHood = !(sky > 0.3);
    }
    this.applyHoods(sky > 0.3);
  }

  private updateRain(delta: number): void {
    this.rain.visible = this.rainLevel > 0.01;
    if (!this.rain.visible) return;
    this.rainMat.opacity = 0.8 * this.rainLevel;
    for (let i = 0; i < this.drops.length; i++) {
      const d = this.drops[i];
      d.y -= RAIN_SPEED * delta;
      if (d.y < H) d.y += SKY;
      this.p.set(d.x, d.y, d.z);
      this.m.compose(this.p, this.q.identity(), this.s);
      this.rain.setMatrixAt(i, this.m);
    }
    this.rain.instanceMatrix.needsUpdate = true;
  }

  private updateSnow(delta: number, time: number): void {
    this.snow.visible = this.snowLevel > 0.01;
    if (!this.snow.visible) return;
    this.snowMat.opacity = 0.95 * this.snowLevel;
    for (let i = 0; i < this.flakes.length; i++) {
      const f = this.flakes[i];
      f.y -= SNOW_SPEED * delta * (0.75 + 0.5 * Math.sin(f.phase));
      if (f.y < H) f.y += SKY;
      // Flakes drift and flutter as they fall.
      this.p.set(f.x + Math.sin(time * 0.9 + f.phase) * 0.008, f.y, f.z + Math.cos(time * 0.7 + f.phase) * 0.006);
      this.q.setFromAxisAngle(FLUTTER_AXIS, time * 1.5 + f.phase);
      this.m.compose(this.p, this.q, this.s);
      this.snow.setMatrixAt(i, this.m);
    }
    this.snow.instanceMatrix.needsUpdate = true;
  }

  /** Roof and tree snow (shared material) follow the snow cover. */
  private applyCover(cover: number): void {
    if (Math.abs(cover - this.lastCover) < 0.004) return;
    this.lastCover = cover;
    SNOW_MAT.opacity = cover;
    const show = cover > 0.01;
    for (const e of this.queries.buildings.entities) {
      const cap = e.object3D?.getObjectByName('SnowCap');
      if (cap) cap.visible = show;
    }
    for (const e of this.queries.dioramas.entities) {
      const trees = e.object3D?.getObjectByName('SnowTrees');
      if (trees) trees.visible = show;
    }
  }

  /** Hoods up in rain and snow. */
  private applyHoods(up: boolean): void {
    if (up === this.lastHood) return;
    this.lastHood = up;
    for (const e of this.queries.villagers.entities) {
      const hood: Object3D | undefined = e.object3D?.getObjectByName('RainHood');
      if (hood) hood.visible = up;
    }
  }
}
