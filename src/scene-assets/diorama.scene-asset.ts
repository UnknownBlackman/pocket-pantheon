/**
 * The village grounds: a round 60 cm diorama made to look lived in. Layered
 * earth sides, patchy grass, worn dirt paths from the campfire to every
 * building, a rough dry-stone rim, trees at the back, a well, woodpile,
 * haystack, cart, barrels, scarecrow, palisade and a banner, plus three
 * animated chickens and a flutterable pennant.
 *
 * Origin at the bottom centre; the walkable surface is y = LAYOUT.baseHeight.
 * Static scenery is merged into one vertex-coloured mesh ('Scenery').
 */
import { Group } from '@iwsdk/core';
import { LAYOUT, RULES } from '../sim/rules.ts';
import { START_BUILDINGS } from '../sim/world.ts';
import { HUE } from './village-materials.ts';
import { Kit, seeded, vary } from './lib/kit.ts';
import {
  bannerPole,
  barrels,
  cart,
  CHICKEN_HOMES,
  haystack,
  makeChicken,
  makePennant,
  PALISADE_FROM,
  PALISADE_TO,
  palisade,
  PROPS,
  scarecrow,
  well,
  woodpile,
} from './props.ts';

const R = RULES.village.radius;
const H = LAYOUT.baseHeight;
const TOP = H + 0.0004; // decals sit a hair above the grass

/** Footprint radius kept clear around each building kind. */
const CLEAR: Record<string, number> = { field: 0.075, hut: 0.06, shrine: 0.065, campfire: 0.07 };
const TABLET = { x: 0.095, z: -0.2 };

type Pt = { x: number; z: number };

function nearBuilding(x: number, z: number, extra = 0): boolean {
  for (const b of START_BUILDINGS) {
    if (Math.hypot(x - b.x, z - b.z) < CLEAR[b.kind] + extra) return true;
  }
  for (const key in PROPS) {
    const p = PROPS[key as keyof typeof PROPS];
    if (Math.hypot(x - p.x, z - p.z) < 0.03 + extra) return true;
  }
  return Math.hypot(x - TABLET.x, z - TABLET.z) < 0.035 + extra;
}

/** Distance from point p to segment ab. */
function segDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t));
}

const PATHS: Array<[Pt, Pt]> = START_BUILDINGS.filter((b) => b.kind !== 'campfire').map((b) => [
  { x: 0, z: 0 },
  { x: b.x, z: b.z },
]);

function onPath(x: number, z: number, width = 0.016): boolean {
  for (const [a, b] of PATHS) if (segDist({ x, z }, a, b) < width) return true;
  return false;
}

// ------------------------------------------------------------------ Ground

function ground(k: Kit, rand: () => number): void {
  // Layered earth sides: dark loam below, lighter soil above, grass on top.
  k.cyl(R * 0.975, R * 0.93, H * 0.55, 36, HUE.earthDark);
  k.cyl(R * 0.99, R * 0.975, H * 0.45 - 0.003, 36, HUE.earth, { y: H * 0.55 });
  k.cyl(R * 0.975, R * 0.99, 0.003, 36, HUE.grass, { y: H - 0.003 });

  // Patchy grass: flat irregular patches of lighter and darker green.
  for (let i = 0; i < 46; i++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * R * 0.88;
    const size = 0.018 + rand() * 0.035;
    const col = rand() < 0.5 ? HUE.grassLight : HUE.grassDark;
    k.cyl(size, size, 0.0003, 6 + Math.floor(rand() * 3), vary(col, rand, 0.05), {
      x: Math.cos(a) * r,
      y: TOP - 0.0003,
      z: Math.sin(a) * r,
      ry: rand() * Math.PI,
      sx: 1,
      sz: 0.55 + rand() * 0.45,
    });
  }

  // Trampled earth around the campfire.
  k.cyl(0.075, 0.075, 0.0005, 14, HUE.dirtDark, { y: TOP });
  k.cyl(0.062, 0.062, 0.0006, 12, HUE.dirt, { y: TOP + 0.0001 });

  // Worn paths: overlapping irregular stepping patches from the fire outwards.
  for (const [a, b] of PATHS) {
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    for (let d = 0.06; d < len - 0.03; d += 0.009) {
      const t = d / len;
      const jx = (rand() - 0.5) * 0.006;
      const jz = (rand() - 0.5) * 0.006;
      const s = 0.009 + rand() * 0.006;
      k.cyl(s, s, 0.0005, 6, vary(HUE.dirt, rand, 0.07), {
        x: a.x + (b.x - a.x) * t + jx,
        y: TOP,
        z: a.z + (b.z - a.z) * t + jz,
        ry: rand() * Math.PI,
      });
    }
  }
}

function rim(k: Kit, rand: () => number): void {
  // A rough dry-stone wall: two courses of irregular stones.
  const n = 60;
  for (let course = 0; course < 2; course++) {
    for (let i = 0; i < n; i++) {
      const a = ((i + course * 0.5) / n) * Math.PI * 2 + (rand() - 0.5) * 0.03;
      const r = R * (0.978 - course * 0.008);
      const size = 0.0085 + rand() * 0.004;
      k.ico(size, vary(rand() < 0.3 ? HUE.stoneDark : HUE.stone, rand, 0.1), {
        x: Math.cos(a) * r,
        y: H - 0.002 + course * 0.008,
        z: Math.sin(a) * r,
        ry: -a + rand() * 0.5,
        rx: rand() * 0.6,
        sx: 1.35,
        sy: 0.75 - course * 0.1,
        sz: 0.95,
      });
    }
  }
}

// ------------------------------------------------------------------ Trees

function pine(k: Kit, x: number, z: number, h: number, rand: () => number): void {
  k.cyl(0.0035, 0.0045, h * 0.25, 6, HUE.trunk, { x, y: H, z });
  for (let i = 0; i < 3; i++) {
    const t = i / 3;
    k.cone(0.022 * (1 - t * 0.35) * (h / 0.08), h * 0.42, 7, vary(HUE.pine, rand, 0.08), {
      x,
      y: H + h * (0.18 + t * 0.26),
      z,
      ry: rand() * Math.PI,
    });
  }
}

function oak(k: Kit, x: number, z: number, h: number, rand: () => number): void {
  k.cyl(0.004, 0.006, h * 0.45, 6, HUE.trunk, { x, y: H, z });
  // Roots flaring into the ground.
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + rand();
    k.bar(x, H + 0.004, z, x + Math.cos(a) * 0.008, H, z + Math.sin(a) * 0.008, 0.0025, HUE.trunk);
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + rand();
    const r = i === 0 ? 0 : 0.012;
    k.ico(0.018 + rand() * 0.006, vary(rand() < 0.5 ? HUE.leaves : HUE.leavesLight, rand, 0.06), {
      x: x + Math.cos(a) * r,
      y: H + h * (0.62 + rand() * 0.12),
      z: z + Math.sin(a) * r,
      sy: 0.8,
    });
  }
}

/** Trees stand at the back and sides only, so they never block the player's view. */
function trees(k: Kit, rand: () => number): void {
  let i = 0;
  for (let deg = 150; deg <= 390; deg += 17) {
    const a = (deg * Math.PI) / 180;
    const r = R * 0.86;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const inPalisade = deg >= PALISADE_FROM - 4 && deg <= PALISADE_TO + 4;
    if (z > 0.04 || inPalisade || nearBuilding(x, z, 0.005) || onPath(x, z, 0.03)) continue;
    const h = 0.065 + rand() * 0.03;
    if (i++ % 2 === 0) pine(k, x, z, h, rand);
    else oak(k, x, z, h * 0.85, rand);
  }
}

// ------------------------------------------------------------------ Scatter

function scatter(k: Kit, rand: () => number): void {
  const spot = (minR = 0.085, maxR = R * 0.9): Pt | null => {
    for (let tries = 0; tries < 12; tries++) {
      const a = rand() * Math.PI * 2;
      const r = minR + Math.sqrt(rand()) * (maxR - minR);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (!nearBuilding(x, z) && !onPath(x, z)) return { x, z };
    }
    return null;
  };
  // Grass tufts: three leaning blades.
  for (let i = 0; i < 150; i++) {
    const p = spot();
    if (!p) continue;
    const col = vary(rand() < 0.6 ? HUE.grassDark : HUE.leavesLight, rand, 0.08);
    for (let b = 0; b < 3; b++) {
      const a = (b / 3) * Math.PI * 2 + rand();
      k.cone(0.0013, 0.006 + rand() * 0.004, 3, col, {
        x: p.x + Math.cos(a) * 0.0015,
        y: H,
        z: p.z + Math.sin(a) * 0.0015,
        rx: Math.sin(a) * 0.4,
        rz: -Math.cos(a) * 0.4,
      });
    }
  }
  // Wildflowers: a stem and a bright head.
  const petals = [0xf2e6c8, 0xe8c14a, 0xc85a8a, 0x8a7ad0, 0xe07a4a];
  for (let i = 0; i < 45; i++) {
    const p = spot(0.09);
    if (!p) continue;
    k.cyl(0.0004, 0.0004, 0.006, 3, HUE.grassDark, { x: p.x, y: H, z: p.z });
    k.ico(0.0016, petals[Math.floor(rand() * petals.length)], { x: p.x, y: H + 0.0065, z: p.z });
  }
  // Mushrooms in the shade of the back.
  for (let i = 0; i < 10; i++) {
    const p = spot(0.16);
    if (!p || p.z > 0) continue;
    k.cyl(0.0008, 0.001, 0.003, 4, HUE.cream, { x: p.x, y: H, z: p.z });
    k.cone(0.0028, 0.0022, 6, rand() < 0.5 ? 0xb8402e : HUE.bread, { x: p.x, y: H + 0.003, z: p.z });
  }
  // Pebbles.
  for (let i = 0; i < 18; i++) {
    const p = spot();
    if (!p) continue;
    k.ico(0.002 + rand() * 0.002, vary(HUE.stone, rand, 0.12), {
      x: p.x,
      y: H + 0.0008,
      z: p.z,
      sy: 0.6,
      ry: rand() * 3,
    });
  }
}

// ------------------------------------------------------------------ The diorama

export function createDiorama(): Group {
  const rand = seeded(1207);
  const k = new Kit();
  ground(k, rand);
  rim(k, rand);
  palisade(k, rand);
  trees(k, rand);
  scatter(k, rand);
  well(k, PROPS.well.x, PROPS.well.z);
  woodpile(k, PROPS.woodpile.x, PROPS.woodpile.z, rand);
  haystack(k, PROPS.haystack.x, PROPS.haystack.z, rand);
  barrels(k, PROPS.barrels.x, PROPS.barrels.z);
  cart(k, PROPS.cart.x, PROPS.cart.z);
  scarecrow(k, PROPS.scarecrow.x, PROPS.scarecrow.z);
  const poleTop = bannerPole(k, PROPS.banner.x, PROPS.banner.z);

  const root = new Group();
  root.name = 'Diorama';
  root.add(k.mesh('Scenery'));

  const pennant = makePennant();
  pennant.position.set(PROPS.banner.x, poleTop, PROPS.banner.z);
  root.add(pennant);

  const chickens = new Group();
  chickens.name = 'Chickens';
  CHICKEN_HOMES.forEach((home, i) => {
    const c = makeChicken(home.color);
    c.position.set(home.x, H, home.z);
    c.userData.homeX = home.x;
    c.userData.homeZ = home.z;
    c.userData.phase = i * 2.1;
    chickens.add(c);
  });
  root.add(chickens);
  return root;
}
