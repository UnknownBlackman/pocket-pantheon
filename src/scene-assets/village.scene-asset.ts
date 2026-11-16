/**
 * Procedural low-poly models for the Pocket Pantheon village: a medieval
 * hamlet built from merged, vertex-coloured, flat-shaded parts (see
 * lib/kit.ts), one draw call per model where possible.
 *
 * Conventions (all models):
 * - metres; origin at the centre of the ground-contact footprint, +Y up;
 *   "front" faces +Z (the builder turns doors towards the village centre);
 * - deterministic and parentless, valid as manifest prototypes and cloned at
 *   runtime (clones share geometry and materials);
 * - named parts that systems animate: 'Body' (villager pivot), 'Soil' and
 *   'Crops' (field, children 0 and 1), 'Flame', 'Orb', 'Windows', 'Smoke'.
 */
import { ConeGeometry, Group, Mesh, SphereGeometry } from '@iwsdk/core';
import { LAYOUT } from '../sim/rules.ts';
import { Kit, seeded, vary } from './lib/kit.ts';
import { HUE, PALETTE, SMOKE_MAT, WINDOW_MAT } from './village-materials.ts';

export { createDiorama } from './diorama.scene-asset.ts';

// ------------------------------------------------------------------ Villagers

export { createVillager, TUNICS } from './villager.scene-asset.ts';

// ------------------------------------------------------------------ Cottage

/**
 * An 8 cm half-timbered cottage: stone footing, whitewashed walls with dark
 * beams and braces, a steep thatched gable roof with a stone chimney, a
 * plank door facing +Z, warm windows ('Windows') and chimney smoke ('Smoke').
 */
export function createHut(): Group {
  const k = new Kit();
  const W = 0.05; // along X
  const D = 0.04; // along Z
  const WH = 0.03; // wall height
  const F = 0.006; // footing height
  const top = F + WH;

  // Stone footing and whitewashed walls.
  k.box(W + 0.005, F, D + 0.005, HUE.stoneDark, { y: F / 2 });
  for (let i = 0; i < 6; i++) {
    k.ico(0.0028, HUE.stone, { x: -W / 2 + (i / 5) * W, y: F * 0.6, z: D / 2 + 0.003, sx: 1.4, sy: 0.7 });
  }
  k.box(W, WH, D, HUE.whitewash, { y: F + WH / 2 });

  // Timber frame on every face: corner posts, sill and mid rails, braces.
  const t = 0.0024;
  const beam = HUE.timber;
  for (const [fx, fz, len, axis] of [
    [0, D / 2 + 0.0008, W, 'x'],
    [0, -D / 2 - 0.0008, W, 'x'],
    [W / 2 + 0.0008, 0, D, 'z'],
    [-W / 2 - 0.0008, 0, D, 'z'],
  ] as const) {
    const along = (u: number, y: number): [number, number, number] =>
      axis === 'x' ? [fx + u, y, fz] : [fx, y, fz + u];
    const h = len / 2;
    // Rails.
    for (const y of [F + 0.001, F + WH * 0.5, top - 0.001]) {
      const a = along(-h, y);
      const b = along(h, y);
      k.bar(a[0], a[1], a[2], b[0], b[1], b[2], t, beam);
    }
    // Posts.
    for (const u of [-h, h, axis === 'x' ? -h / 2 : 0, axis === 'x' ? h / 2 : 0]) {
      const a = along(u, F);
      const b = along(u, top);
      k.bar(a[0], a[1], a[2], b[0], b[1], b[2], t, beam);
    }
    // Diagonal braces in the lower panels at the ends.
    const a1 = along(-h, F);
    const b1 = along(-h / 2, F + WH * 0.5);
    k.bar(a1[0], a1[1], a1[2], b1[0], b1[1], b1[2], t * 0.85, beam);
    const a2 = along(h, F);
    const b2 = along(h / 2, F + WH * 0.5);
    k.bar(a2[0], a2[1], a2[2], b2[0], b2[1], b2[2], t * 0.85, beam);
  }

  // Thatched gable roof with a darker ridge and overhanging eaves.
  k.gable(W + 0.012, 0.03, D + 0.016, HUE.thatch, { y: top });
  k.box(W + 0.013, 0.003, 0.004, HUE.thatchDark, { y: top + 0.0295 });
  k.box(W + 0.012, 0.002, 0.002, HUE.thatchDark, { y: top + 0.0004, z: (D + 0.016) / 2 });
  k.box(W + 0.012, 0.002, 0.002, HUE.thatchDark, { y: top + 0.0004, z: -(D + 0.016) / 2 });

  // Stone chimney through the back slope.
  const chimney = { x: W * 0.3, z: -D * 0.18 };
  k.box(0.008, 0.034, 0.008, HUE.stone, { x: chimney.x, y: top + 0.012, z: chimney.z });
  k.box(0.0095, 0.002, 0.0095, HUE.stoneDark, { x: chimney.x, y: top + 0.029, z: chimney.z });

  // Plank door with a frame and a little step; a bench and a flower box.
  k.box(0.0115, 0.018, 0.0016, HUE.wood, { y: F + 0.009, z: D / 2 + 0.0012 });
  k.box(0.0135, 0.0022, 0.002, HUE.timber, { y: F + 0.0185, z: D / 2 + 0.0014 });
  k.box(0.001, 0.001, 0.001, HUE.gold, { x: 0.0035, y: F + 0.009, z: D / 2 + 0.0022 });
  k.box(0.016, 0.0025, 0.005, HUE.stoneDark, { y: F * 0.4, z: D / 2 + 0.004 });
  k.box(0.014, 0.0016, 0.004, HUE.wood, { x: -0.017, y: F + 0.005, z: D / 2 + 0.004 });
  for (const lx of [-0.023, -0.011]) k.box(0.0014, 0.005, 0.0014, HUE.woodDark, { x: lx, y: F + 0.0025, z: D / 2 + 0.004 });
  k.box(0.01, 0.003, 0.003, HUE.woodDark, { x: 0.015, y: F + 0.012, z: D / 2 + 0.002 });
  const rand = seeded(77);
  for (let i = 0; i < 4; i++) {
    k.ico(0.0014, i % 2 ? 0xd04a5a : 0xe8c14a, { x: 0.0115 + i * 0.0023, y: F + 0.0145, z: D / 2 + 0.0025 + rand() * 0.001 });
  }

  // Windows with shutters (the panes glow at dusk).
  const panes = new Kit();
  const windowAt: Array<[number, number, number, number]> = [
    [0.015, F + 0.02, D / 2 + 0.0012, 0],
    [-W / 2 - 0.0012, F + 0.02, 0, Math.PI / 2],
    [W / 2 + 0.0012, F + 0.02, 0, Math.PI / 2],
  ];
  for (const [x, y, z, ry] of windowAt) {
    panes.box(0.0075, 0.007, 0.0012, 0xffffff, { x, y, z, ry });
    const ox = Math.cos(ry) * 0.0055;
    const oz = -Math.sin(ry) * 0.0055;
    k.box(0.003, 0.0075, 0.0011, HUE.wood, { x: x + ox, y, z: z + oz, ry });
    k.box(0.003, 0.0075, 0.0011, HUE.wood, { x: x - ox, y, z: z - oz, ry });
  }

  const root = new Group();
  root.name = 'Hut';
  root.add(k.mesh('Cottage'));
  root.add(...hutUpgrades(W, D));
  root.add(panes.mesh('Windows', WINDOW_MAT));

  // Chimney smoke: three puffs that SyncSystem/AnimationSystem loop upwards.
  const smoke = new Group();
  smoke.name = 'Smoke';
  smoke.position.set(chimney.x, top + 0.031, chimney.z);
  const puffGeo = new SphereGeometry(0.004, 6, 4);
  for (let i = 0; i < 3; i++) {
    const puff = new Mesh(puffGeo, SMOKE_MAT);
    puff.name = 'Puff';
    puff.userData.phase = i / 3;
    smoke.add(puff);
  }
  root.add(smoke);
  return root;
}

// ------------------------------------------------------------------ Field

/**
 * A 10 cm field. Children, in order: 'Soil' (restyled when dry), 'Crops'
 * (y-scale shows growth; rows switch to the ripe material), 'Fence'
 * (furrows, posts and rails).
 */
export function createField(): Group {
  const root = new Group();
  root.name = 'Field';
  const s = LAYOUT.fieldSize;

  const soil = new Mesh(new ConeGeometry(1, 1, 4, 1), PALETTE.soil);
  // A low, slightly domed plot: a squashed 4-sided pyramid rotated square.
  soil.geometry.rotateY(Math.PI / 4);
  soil.scale.set(s * 0.68, 0.007, s * 0.68);
  soil.position.y = 0.0035;
  soil.name = 'Soil';
  root.add(soil);

  const crops = new Group();
  crops.name = 'Crops';
  crops.position.y = 0.004;
  const rand = seeded(31);
  // Each row: leafy stalks ('Row0'..) and, separately, the ears of grain
  // ('Ears0'..) that appear and ripen as the field grows (SyncSystem).
  for (let i = 0; i < 4; i++) {
    const row = new Kit();
    const ears = new Kit();
    for (let j = 0; j < 9; j++) {
      const x = -s * 0.4 + (j * s * 0.8) / 8 + (rand() - 0.5) * 0.002;
      for (let b = 0; b < 3; b++) {
        row.cone(0.0013, 0.011 + rand() * 0.003, 3, 0xffffff, {
          x: x + (rand() - 0.5) * 0.003,
          z: (rand() - 0.5) * 0.003,
          rx: (rand() - 0.5) * 0.4,
          rz: (rand() - 0.5) * 0.4,
        });
      }
      // Two drooping ears of grain on each plant.
      for (const dx of [-0.0009, 0.0009]) {
        ears.ico(0.0015, 0xffffff, { x: x + dx, y: 0.0125, z: (rand() - 0.5) * 0.002, sy: 1.6, rz: dx * 220 });
      }
    }
    const z = -s * 0.33 + (i * s * 0.66) / 3;
    const mesh = row.mesh(`Row${i}`, PALETTE.crop);
    mesh.position.z = z;
    const earMesh = ears.mesh(`Ears${i}`, PALETTE.cropRipe);
    earMesh.position.z = z;
    crops.add(mesh, earMesh);
  }
  root.add(crops);

  // Furrows between rows, and a rustic post-and-rail fence on three sides.
  const k = new Kit();
  for (let i = 0; i < 5; i++) {
    const z = -s * 0.44 + (i * s * 0.88) / 4;
    k.box(s * 0.86, 0.0012, 0.0035, HUE.earthDark, { y: 0.0062, z });
  }
  const e = s * 0.5;
  const posts: Array<[number, number]> = [
    [-e, -e], [0, -e], [e, -e], [e, 0], [e, e], [-e, 0], [-e, e],
  ];
  for (const [x, z] of posts) k.cyl(0.0013, 0.0015, 0.014, 5, HUE.woodDark, { x, y: 0, z });
  const rail = (ax: number, az: number, bx: number, bz: number) => {
    k.bar(ax, 0.006, az, bx, 0.007, bz, 0.0012, HUE.wood);
    k.bar(ax, 0.011, az, bx, 0.0105, bz, 0.0012, HUE.wood);
  };
  rail(-e, -e, 0, -e);
  rail(0, -e, e, -e);
  rail(e, -e, e, 0);
  rail(e, 0, e, e);
  rail(-e, -e, -e, 0);
  rail(-e, 0, -e, e);
  root.add(k.mesh('Fence'));
  return root;
}

// ------------------------------------------------------------------ Shrine

/**
 * A 10 cm stone wayside shrine: stepped base, four pillars under a pitched
 * slate roof, an altar with the glowing 'Orb', candles and small offerings.
 * The open side faces +Z. `Orb.userData.baseY` is its resting height.
 */
export function createShrine(): Group {
  const k = new Kit();
  const s = LAYOUT.shrineSize;
  const rand = seeded(9);
  k.box(s * 0.82, 0.008, s * 0.82, HUE.stoneDark, { y: 0.004 });
  k.box(s * 0.62, 0.008, s * 0.62, HUE.stone, { y: 0.012 });
  // Worn steps in front.
  k.box(s * 0.3, 0.004, 0.01, HUE.stoneLight, { y: 0.002, z: s * 0.44 });

  const base = 0.016;
  const ph = 0.04;
  for (const [x, z] of [[-0.022, -0.02], [0.022, -0.02], [-0.022, 0.018], [0.022, 0.018]]) {
    k.box(0.0075, 0.003, 0.0075, HUE.stoneDark, { x, y: base + 0.0015, z });
    k.cyl(0.0032, 0.0036, ph, 6, vary(HUE.stoneLight, rand, 0.05), { x, y: base, z });
    k.box(0.0075, 0.003, 0.0075, HUE.stoneDark, { x, y: base + ph - 0.0015, z });
  }
  // Back wall for shelter, with a little round window.
  k.box(0.046, ph * 0.85, 0.004, HUE.stone, { y: base + ph * 0.425, z: -0.022 });
  // Lintel and pitched slate roof.
  k.box(0.058, 0.005, 0.05, HUE.stoneDark, { y: base + ph + 0.0025 });
  k.gable(0.064, 0.022, 0.058, HUE.slate, { y: base + ph + 0.005 });
  k.ico(0.003, HUE.gold, { y: base + ph + 0.029 });

  // Altar.
  k.box(0.022, 0.012, 0.012, HUE.stoneLight, { y: base + 0.006, z: -0.012 });
  k.box(0.025, 0.002, 0.014, HUE.stoneDark, { y: base + 0.0125, z: -0.012 });

  // Candles and offerings on the steps.
  const flames = new Kit();
  for (const [x, z, h] of [[-0.02, 0.026, 0.006], [0.02, 0.026, 0.008], [0.013, 0.03, 0.005], [-0.012, 0.03, 0.004]]) {
    k.cyl(0.0012, 0.0013, h, 5, HUE.cream, { x, y: 0.016, z });
    flames.cone(0.0009, 0.0024, 4, 0xffffff, { x, y: 0.016 + h, z });
  }
  k.ico(0.0028, HUE.bread, { x: -0.004, y: 0.0175, z: 0.028, sx: 1.4, sy: 0.7 });
  k.ico(0.0022, 0xd04a5a, { x: 0.004, y: 0.0172, z: 0.03 });
  k.ico(0.002, 0xe8c14a, { x: 0.0065, y: 0.0172, z: 0.027 });

  const root = new Group();
  root.name = 'Shrine';
  root.add(k.mesh('ShrineStone'));
  const flameMesh = flames.mesh('CandleFlames', PALETTE.flame);
  root.add(flameMesh);

  const orb = new Mesh(new SphereGeometry(0.0075, 12, 8), PALETTE.glow);
  orb.name = 'Orb';
  const orbY = base + 0.0135 + 0.009;
  orb.position.set(0, orbY, -0.012);
  orb.userData.baseY = orbY;
  root.add(orb);
  return root;
}

// ------------------------------------------------------------------ Campfire

/**
 * A 10 cm campfire: a ring of stones round an ash bed, crossed logs, a
 * cooking pot on a tripod, log benches around it and the 'Flame' (pivot at
 * its base so it can flicker in y-scale).
 */
export function createCampfire(): Group {
  const k = new Kit();
  const rand = seeded(5);
  k.cyl(0.026, 0.026, 0.0008, 10, 0x4a4440, {});
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2;
    k.ico(0.0055 + rand() * 0.0015, vary(HUE.stone, rand, 0.12), {
      x: Math.cos(a) * 0.029, y: 0.003, z: Math.sin(a) * 0.029, sx: 1.2, sy: 0.75, ry: -a,
    });
  }
  // Teepee of logs.
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    k.bar(Math.cos(a) * 0.015, 0.001, Math.sin(a) * 0.015, Math.cos(a) * 0.003, 0.016, Math.sin(a) * 0.003, 0.003, i % 2 ? HUE.wood : HUE.woodDark);
  }
  // Tripod and pot.
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    k.bar(Math.cos(a) * 0.034, 0, Math.sin(a) * 0.034, 0, 0.05, 0, 0.0014, HUE.woodDark);
  }
  k.bar(0, 0.05, 0, 0, 0.034, 0, 0.0006, HUE.iron);
  k.cyl(0.0085, 0.006, 0.009, 9, HUE.iron, { y: 0.025 });
  k.cyl(0.0088, 0.0088, 0.0012, 9, 0x2a2a2e, { y: 0.0335 });
  // Log benches.
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 1.05;
    k.cyl(0.0035, 0.0035, 0.026, 7, HUE.wood, {
      x: Math.cos(a) * 0.062, y: 0.0035, z: Math.sin(a) * 0.062, rx: Math.PI / 2, rz: 0, ry: -a + Math.PI / 2,
    });
  }

  const root = new Group();
  root.name = 'Campfire';
  root.add(k.mesh('FirePit'));

  const flameGeo = new ConeGeometry(0.011, 0.03, 6, 1);
  flameGeo.translate(0, 0.015, 0); // pivot at the base
  const flame = new Mesh(flameGeo, PALETTE.flame);
  flame.name = 'Flame';
  flame.position.y = 0.004;
  root.add(flame);
  return root;
}

// ------------------------------------------------------------------ Tablet

/**
 * A 9 cm stone tablet with carved lines and creeping moss, standing on a
 * low plinth; its face is +Z. Poking it opens the chronicle.
 */
export function createTablet(): Group {
  const k = new Kit();
  k.box(0.06, 0.008, 0.026, HUE.stoneDark, { y: 0.004 });
  k.box(0.05, 0.075, 0.012, HUE.stone, { y: 0.008 + 0.0375, rx: -0.08 });
  k.ico(0.02, HUE.stone, { y: 0.082, z: -0.003, sx: 1.25, sy: 0.45, sz: 0.3 }); // rounded top
  for (let i = 0; i < 5; i++) {
    k.box(i === 4 ? 0.02 : 0.034, 0.003, 0.002, HUE.stoneDark, {
      y: 0.008 + 0.0375 + 0.024 - i * 0.012, z: 0.0062 + i * 0.001, rx: -0.08,
    });
  }
  const rand = seeded(13);
  for (let i = 0; i < 6; i++) {
    k.ico(0.003 + rand() * 0.002, vary(HUE.grassDark, rand, 0.1), {
      x: -0.022 + rand() * 0.01, y: 0.01 + rand() * 0.02, z: 0.005, sz: 0.5,
    });
  }
  const root = new Group();
  root.name = 'Tablet';
  root.add(k.mesh('TabletStone'));
  root.add(...tabletCarvings());
  return root;
}

/**
 * Upgrades a hut earns as the village survives (sim/progress.ts hutTier),
 * hidden until then: 'Apron' (tier 1) is a cobbled apron around the footing
 * with stepping stones to the door; 'Garden' (tier 2) a wattle-fenced garden
 * of cabbages and flowers beside it.
 */
function hutUpgrades(W: number, D: number): Mesh[] {
  const rand = seeded(77);
  const apron = new Kit();
  const ring = 0.007;
  for (let i = 0; i < 34; i++) {
    // Walk the rectangle's perimeter just outside the footing.
    const t = i / 34;
    const per = 2 * (W + D);
    let d = t * per;
    let x: number;
    let z: number;
    if (d < W) {
      x = -W / 2 + d;
      z = D / 2 + ring;
    } else if ((d -= W) < D) {
      x = W / 2 + ring;
      z = D / 2 - d;
    } else if ((d -= D) < W) {
      x = W / 2 - d;
      z = -D / 2 - ring;
    } else {
      d -= W;
      x = -W / 2 - ring;
      z = -D / 2 + d;
    }
    apron.ico(0.0032 + rand() * 0.0012, vary(rand() < 0.3 ? HUE.stoneDark : HUE.stoneLight, rand, 0.08), {
      x, y: 0.0006, z, sy: 0.4, ry: rand() * 3,
    });
  }
  for (let i = 0; i < 3; i++) {
    apron.cyl(0.0042, 0.0046, 0.0012, 7, vary(HUE.stone, rand, 0.08), {
      x: (rand() - 0.5) * 0.004, z: D / 2 + 0.016 + i * 0.01, ry: rand() * 3,
    });
  }
  const garden = new Kit();
  const gx = W / 2 + 0.024;
  const gw = 0.022;
  const gd = 0.032;
  garden.box(gw, 0.0012, gd, HUE.earth, { x: gx, y: 0.0006 });
  // Wattle fence: posts and two woven rails.
  for (const [ax, az, bx, bz] of [
    [gx - gw / 2, -gd / 2, gx + gw / 2, -gd / 2],
    [gx + gw / 2, -gd / 2, gx + gw / 2, gd / 2],
    [gx - gw / 2, gd / 2, gx + gw / 2, gd / 2],
  ]) {
    for (const h of [0.004, 0.0075]) garden.bar(ax, h, az, bx, h, bz, 0.0012, HUE.wood);
    garden.bar(ax, 0, az, ax, 0.009, az, 0.0016, HUE.woodDark);
    garden.bar(bx, 0, bz, bx, 0.009, bz, 0.0016, HUE.woodDark);
  }
  const petals = [0xe8c14a, 0xc85a8a, 0x8a7ad0, 0xf2e6c8, 0xe07a4a];
  for (let i = 0; i < 6; i++) {
    const px = gx - gw / 2 + 0.005 + (i % 2) * 0.012;
    const pz = -gd / 2 + 0.006 + Math.floor(i / 2) * 0.01;
    if (i % 3 === 0) {
      garden.ico(0.0034, vary(0x7fb04a, rand, 0.06), { x: px, y: 0.003, z: pz, sy: 0.75 }); // a cabbage
    } else {
      garden.cyl(0.0004, 0.0004, 0.006, 3, HUE.grassDark, { x: px, y: 0.001, z: pz });
      garden.ico(0.0018, petals[i % petals.length], { x: px, y: 0.0075, z: pz });
    }
  }
  const a = apron.mesh('Apron');
  const g = garden.mesh('Garden');
  a.visible = false;
  g.visible = false;
  return [a, g];
}

// ------------------------------------------------------------------ Grave

/** A 2 cm grave: a rounded headstone over an earth mound with wildflowers. Faces +Z. */
export function createGrave(): Group {
  const k = new Kit();
  k.ico(0.009, HUE.earth, { y: 0.001, z: 0.006, sx: 0.8, sy: 0.35, sz: 1.3 });
  k.box(0.011, 0.012, 0.003, HUE.stone, { y: 0.006 });
  k.ico(0.0055, HUE.stone, { y: 0.012, sx: 1, sy: 0.55, sz: 0.27 });
  k.box(0.006, 0.0008, 0.0008, HUE.stoneDark, { y: 0.009, z: 0.0016 });
  k.box(0.0008, 0.004, 0.0008, HUE.stoneDark, { y: 0.0095, z: 0.0016 });
  k.ico(0.0014, 0xe8c14a, { x: -0.003, y: 0.003, z: 0.011 });
  k.ico(0.0012, 0xc85a8a, { x: 0.003, y: 0.003, z: 0.012 });
  const root = new Group();
  root.name = 'Grave';
  root.add(k.mesh('Headstone'));
  return root;
}

/**
 * Six golden carvings along the tablet's plinth, one per finished session
 * (sim/progress.ts tabletCarvings): sun, sheaf, raindrop, hand, star, crown.
 * Named 'Carving0'..'Carving5', hidden until earned.
 */
function tabletCarvings(): Mesh[] {
  const out: Mesh[] = [];
  const z = 0.0132;
  const y = 0.0042;
  const G = HUE.gold;
  for (let i = 0; i < 6; i++) {
    const k = new Kit();
    const x = -0.025 + i * 0.01;
    switch (i) {
      case 0: // sun
        k.cyl(0.0016, 0.0016, 0.0006, 8, G, { x, y, z, rx: Math.PI / 2 });
        for (let r = 0; r < 4; r++) {
          const a = (r / 4) * Math.PI * 2 + Math.PI / 4;
          k.box(0.0006, 0.0014, 0.0005, G, { x: x + Math.cos(a) * 0.0027, y: y + Math.sin(a) * 0.0027, z, rz: a - Math.PI / 2 });
        }
        break;
      case 1: // a sheaf of wheat
        k.box(0.0006, 0.005, 0.0005, G, { x, y, z });
        for (const s of [-1, 1]) k.box(0.0006, 0.0022, 0.0005, G, { x: x + s * 0.0011, y: y + 0.0012, z, rz: -s * 0.6 });
        break;
      case 2: // a raindrop
        k.ico(0.0016, G, { x, y: y - 0.0006, z, sz: 0.35 });
        k.cone(0.0013, 0.0022, 6, G, { x, y: y + 0.0004, z, sz: 0.35 });
        break;
      case 3: // an open hand
        k.box(0.0026, 0.0022, 0.0005, G, { x, y: y - 0.0008, z });
        for (let f = 0; f < 4; f++) k.box(0.0005, 0.0018, 0.0005, G, { x: x - 0.0009 + f * 0.0006, y: y + 0.0011, z });
        break;
      case 4: // a star
        for (let r = 0; r < 3; r++) k.box(0.0006, 0.0042, 0.0005, G, { x, y, z, rz: (r / 3) * Math.PI });
        break;
      default: // a crown
        k.box(0.0036, 0.0012, 0.0005, G, { x, y: y - 0.0012, z });
        for (const s of [-1, 0, 1]) k.cone(0.0007, 0.0022, 4, G, { x: x + s * 0.0013, y: y - 0.0006, z, sz: 0.4 });
    }
    const m = k.mesh(`Carving${i}`);
    m.visible = false;
    out.push(m);
  }
  return out;
}
