/**
 * Village props and animals for the diorama: well, woodpile, haystack,
 * barrels, hand cart, scarecrow, palisade, banner pole and pennant, and the
 * chickens. Static props are drawn into a shared Kit (one merged mesh);
 * the pennant and chickens are separate meshes so they can move.
 */
import type { Mesh } from '@iwsdk/core';
import { LAYOUT, RULES } from '../sim/rules.ts';
import { Kit, vary } from './lib/kit.ts';
import { HUE } from './village-materials.ts';

const R = RULES.village.radius;
const H = LAYOUT.baseHeight;

/** Where the props stand: clear of buildings and paths. */
export const PROPS = {
  well: { x: 0.085, z: 0.035 },
  woodpile: { x: 0.24, z: 0.03 },
  haystack: { x: -0.235, z: 0.05 },
  barrels: { x: -0.13, z: 0.03 },
  cart: { x: 0.2, z: -0.17 },
  scarecrow: { x: -0.075, z: 0.205 },
  banner: { x: -0.055, z: -0.245 },
} as const;

/** Degrees of the back arc closed by a wooden palisade (behind the shrine). */
export const PALISADE_FROM = 236;
export const PALISADE_TO = 304;

export function well(k: Kit, x: number, z: number): void {
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    k.ico(0.0045, i % 2 ? HUE.stone : HUE.stoneLight, {
      x: x + Math.cos(a) * 0.012, y: H + 0.004, z: z + Math.sin(a) * 0.012, sx: 1.2, sy: 0.9, ry: -a,
    });
    k.ico(0.004, i % 2 ? HUE.stoneDark : HUE.stone, {
      x: x + Math.cos(a + 0.3) * 0.012, y: H + 0.01, z: z + Math.sin(a + 0.3) * 0.012, sx: 1.2, sy: 0.8, ry: -a,
    });
  }
  k.cyl(0.009, 0.009, 0.001, 10, HUE.water, { x, y: H + 0.011, z });
  k.cyl(0.0012, 0.0012, 0.03, 4, HUE.woodDark, { x: x - 0.013, y: H, z });
  k.cyl(0.0012, 0.0012, 0.03, 4, HUE.woodDark, { x: x + 0.013, y: H, z });
  k.bar(x - 0.014, H + 0.027, z, x + 0.014, H + 0.027, z, 0.0018, HUE.wood);
  k.gable(0.034, 0.011, 0.026, HUE.thatchDark, { x, y: H + 0.029, z });
  k.cyl(0.003, 0.0026, 0.004, 6, HUE.wood, { x: x + 0.004, y: H + 0.016, z }); // bucket
}

export function woodpile(k: Kit, x: number, z: number, rand: () => number): void {
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 4 - row; i++) {
      k.cyl(0.0028, 0.0028, 0.022, 6, vary(HUE.wood, rand, 0.12), {
        x: x + (i - (3 - row) / 2) * 0.0058, y: H + 0.0028 + row * 0.005, z: z - 0.011, rx: Math.PI / 2,
      });
    }
  }
  k.box(0.012, 0.007, 0.012, HUE.woodDark, { x: x + 0.016, y: H + 0.0035, z: z + 0.004 }); // chopping block
  k.bar(x + 0.014, H + 0.008, z + 0.004, x + 0.02, H + 0.016, z + 0.006, 0.0012, HUE.wood); // axe handle
  k.box(0.004, 0.003, 0.001, HUE.iron, { x: x + 0.02, y: H + 0.016, z: z + 0.006 }); // axe head
}

export function haystack(k: Kit, x: number, z: number, rand: () => number): void {
  k.ico(0.016, vary(HUE.hay, rand, 0.05), { x, y: H + 0.008, z, sy: 0.75 });
  k.cone(0.014, 0.014, 8, vary(HUE.hay, rand, 0.08), { x, y: H + 0.01, z });
  k.ico(0.008, HUE.thatchDark, { x: x + 0.016, y: H + 0.003, z: z + 0.006, sy: 0.6 });
}

export function barrels(k: Kit, x: number, z: number): void {
  const one = (bx: number, bz: number, h = 0.012) => {
    k.cyl(0.0048, 0.0042, h / 2, 8, HUE.wood, { x: bx, y: H, z: bz });
    k.cyl(0.0042, 0.0048, h / 2, 8, HUE.wood, { x: bx, y: H + h / 2, z: bz });
    k.cyl(0.0051, 0.0051, 0.0009, 8, HUE.iron, { x: bx, y: H + h * 0.2, z: bz });
    k.cyl(0.0051, 0.0051, 0.0009, 8, HUE.iron, { x: bx, y: H + h * 0.75, z: bz });
  };
  one(x, z);
  one(x + 0.011, z + 0.004);
  one(x + 0.004, z + 0.011, 0.01);
  k.box(0.009, 0.007, 0.009, HUE.woodDark, { x: x - 0.01, y: H + 0.0035, z: z + 0.008, ry: 0.4 }); // crate
}

export function cart(k: Kit, x: number, z: number): void {
  const yaw = 0.5;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const at = (lx: number, lz: number) => ({ x: x + lx * c + lz * s, z: z - lx * s + lz * c });
  k.box(0.03, 0.002, 0.018, HUE.wood, { x, y: H + 0.009, z, ry: yaw });
  for (const side of [-1, 1]) {
    const w = at(0.003, side * 0.011);
    k.cyl(0.007, 0.007, 0.0018, 10, HUE.woodDark, { x: w.x, y: H + 0.007, z: w.z, rx: Math.PI / 2, ry: yaw });
    const h1 = at(-0.015, side * 0.006);
    const h2 = at(-0.032, side * 0.006);
    k.bar(h1.x, H + 0.01, h1.z, h2.x, H + 0.004, h2.z, 0.0016, HUE.wood);
    for (const lx of [-0.013, 0, 0.013]) {
      const p = at(lx, side * 0.009);
      k.box(0.0015, 0.006, 0.0015, HUE.woodDark, { x: p.x, y: H + 0.013, z: p.z });
    }
  }
  k.ico(0.006, HUE.hay, { x, y: H + 0.013, z, sy: 0.6 }); // a load of hay
}

export function scarecrow(k: Kit, x: number, z: number): void {
  const coat = 0x6a5a8a;
  k.cyl(0.0012, 0.0012, 0.036, 4, HUE.woodDark, { x, y: H, z });
  k.bar(x - 0.012, H + 0.026, z, x + 0.012, H + 0.026, z, 0.0016, HUE.woodDark);
  k.cyl(0.0035, 0.006, 0.012, 6, coat, { x, y: H + 0.016, z }); // patched coat
  k.bar(x - 0.011, H + 0.026, z, x + 0.011, H + 0.026, z, 0.003, coat);
  k.ico(0.0045, HUE.hay, { x, y: H + 0.032, z });
  k.cyl(0.008, 0.008, 0.001, 8, HUE.thatchDark, { x, y: H + 0.035, z });
  k.cone(0.004, 0.006, 6, HUE.thatchDark, { x, y: H + 0.035, z });
}

export function palisade(k: Kit, rand: () => number): void {
  const r = R * 0.905;
  const step = 4.2;
  let prev: { x: number; z: number } | null = null;
  for (let deg = PALISADE_FROM; deg <= PALISADE_TO; deg += step) {
    const a = (deg * Math.PI) / 180;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const h = 0.022 + rand() * 0.006;
    k.cyl(0.0022, 0.0024, h, 5, vary(HUE.wood, rand, 0.1), { x, y: H, z });
    k.cone(0.0022, 0.004, 5, HUE.woodDark, { x, y: H + h, z });
    if (prev) {
      k.bar(prev.x, H + 0.008, prev.z, x, H + 0.008, z, 0.0014, HUE.woodDark);
      k.bar(prev.x, H + 0.017, prev.z, x, H + 0.017, z, 0.0014, HUE.woodDark);
    }
    prev = { x, z };
  }
}

/** Banner pole; returns the height where the pennant hangs. */
export function bannerPole(k: Kit, x: number, z: number): number {
  const h = 0.07;
  k.cyl(0.0012, 0.0016, h, 5, HUE.woodDark, { x, y: H, z });
  k.ico(0.002, HUE.gold, { x, y: H + h + 0.001, z });
  k.cone(0.004, 0.003, 6, HUE.stoneDark, { x, y: H, z });
  return H + h - 0.002;
}

/** The pennant: its origin is at the pole so it can flutter around it. */
export function makePennant(): Mesh {
  const k = new Kit();
  k.box(0.024, 0.012, 0.0008, HUE.banner, { x: 0.012, y: -0.006 });
  k.box(0.024, 0.0022, 0.001, HUE.gold, { x: 0.012, y: -0.006 });
  return k.mesh('Pennant');
}

/** A 1.3 cm hen facing +Z, feet at the origin. */
export function makeChicken(color: number): Mesh {
  const k = new Kit();
  k.ico(0.0042, color, { y: 0.0055, sx: 0.9, sz: 1.25 });
  k.cone(0.0028, 0.005, 4, color, { y: 0.007, z: -0.004, rx: -0.9 });
  k.ico(0.0024, color, { y: 0.0095, z: 0.0042 });
  k.box(0.0009, 0.0018, 0.0022, 0xc8322a, { y: 0.0118, z: 0.0042 });
  k.cone(0.0009, 0.0022, 4, 0xe8b830, { y: 0.0092, z: 0.0065, rx: Math.PI / 2 });
  for (const sx of [-0.0015, 0.0015]) k.bar(sx, 0, 0, sx, 0.0028, 0, 0.0007, 0xe0a030);
  return k.mesh('Chicken');
}

export const CHICKEN_HOMES = [
  { x: 0.06, z: 0.085, color: 0xf4efe4 },
  { x: -0.085, z: 0.075, color: 0xb87a40 },
  { x: 0.12, z: -0.11, color: 0xf4efe4 },
] as const;
