/**
 * The villager: a 4 cm chibi figure in bright medieval dress, articulated so
 * the AnimationSystem can swing limbs, turn the head and blink.
 *
 * Hierarchy (origin at the feet, front +Z):
 *   Villager > Body (squash/lean pivot at the feet)
 *     Torso (mesh: tunic or dress, belt, pouch, collar, cape/shawl)
 *     LegL / LegR (groups at the hips; hose and shoe hang down -Y)
 *     ArmL / ArmR (groups at the shoulders; sleeve and hand hang down -Y)
 *       ArmR > Tool (a hoe, hidden unless farming)
 *     Head (group at the neck) > Face (mesh), Eyes (mesh, scaled to blink)
 * ArmL/LegL are on the villager's left (+X). Rotating a limb by a negative
 * X angle swings it forward; a positive Z angle lifts ArmL outwards (and a
 * negative one lifts ArmR).
 * Smooth-shaded vertex colours on one shared material; about seven draw calls.
 */
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CapsuleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  Group,
  LatheGeometry,
  Matrix3,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
} from '@iwsdk/core';
import type { LifeStage } from '../sim/age.ts';
import type { Place } from './lib/kit.ts';

/** Tunic colours by villager index (also used for speech-bubble name tabs). */
export const TUNICS = [0xc8443a, 0x3f74c4, 0xe0a83a, 0x5a9a3c, 0xc96a9a, 0x8a52b0, 0xe07a2e, 0x2f9a8a];
/** Hose, hats and trims: contrasting, still dyed-cloth colours. */
const ACCENTS = [0x2f4f7a, 0xb8382e, 0x5a7a2e, 0xd9a03a, 0x6a3a7a, 0x2f7a6a, 0x8a3a2a, 0x46506a];
const SKINS = [0xf0c49c, 0xd9a074, 0xb07850, 0x7e5236, 0xe8b48a];
const HAIRS = [0x3b2a20, 0x7a4a26, 0xd8b058, 0xa0401e, 0x241c18];
const LEATHER = 0x5a3820;
const SHOE = 0x3e2a1c;
const GOLD = 0xe8c050;
const LINEN = 0xf2ead8;
const WOOD = 0x8a5a32;
const IRON = 0x8a8e94;
const EYE = 0x1e1612;
const CHEEK = 0xec7f78;

export const VILLAGER_MATERIAL = new MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.75,
  metalness: 0,
});

// Key heights (metres above the feet).
const HIP_Y = 0.0088;
const HIP_X = 0.0029;
const SHOULDER_Y = 0.0188;
const SHOULDER_X = 0.0066;
const NECK_Y = 0.0206;
/** Head centre above the neck pivot, and head radius. */
const HEAD_C = 0.0086;
const HEAD_R = 0.0088;

const m4 = new Matrix4();
const n3 = new Matrix3();
const q = new Quaternion();
const eul = new Euler();
const vp = new Vector3();
const vs = new Vector3();
const col = new Color();

/** Collects coloured geometry with its own (smooth) normals into one mesh. */
class Sculpt {
  private pos: number[] = [];
  private nor: number[] = [];
  private col: number[] = [];

  add(geometry: BufferGeometry, color: number, at: Place = {}): this {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    eul.set(at.rx ?? 0, at.ry ?? 0, at.rz ?? 0);
    q.setFromEuler(eul);
    vp.set(at.x ?? 0, at.y ?? 0, at.z ?? 0);
    vs.set(at.sx ?? 1, at.sy ?? 1, at.sz ?? 1);
    m4.compose(vp, q, vs);
    n3.getNormalMatrix(m4);
    col.setHex(color);
    const p = g.getAttribute('position');
    const n = g.getAttribute('normal');
    const v = new Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m4);
      this.pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(n, i).applyMatrix3(n3).normalize();
      this.nor.push(v.x, v.y, v.z);
      this.col.push(col.r, col.g, col.b);
    }
    if (g !== geometry) g.dispose();
    geometry.dispose();
    return this;
  }

  mesh(name: string): Mesh {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('normal', new BufferAttribute(new Float32Array(this.nor), 3));
    g.setAttribute('color', new BufferAttribute(new Float32Array(this.col), 3));
    g.computeBoundingBox();
    g.computeBoundingSphere();
    const m = new Mesh(g, VILLAGER_MATERIAL);
    m.name = name;
    return m;
  }
}

const sphere = (r: number, w = 14, h = 10): SphereGeometry => new SphereGeometry(r, w, h);
/** A sphere cap from the top down to `cut` (fraction of PI). */
const cap = (r: number, cut: number): SphereGeometry => new SphereGeometry(r, 16, 8, 0, Math.PI * 2, 0, Math.PI * cut);
/** A lathe from (radius, height) pairs, bottom to top. */
function lathe(profile: readonly (readonly [number, number])[], phiStart = 0, phiLength = Math.PI * 2): LatheGeometry {
  return new LatheGeometry(
    profile.map(([r, y]) => new Vector2(r, y)),
    18,
    phiStart,
    phiLength,
  );
}

type Headwear = 'hood' | 'straw' | 'coif' | 'cap' | 'bare' | 'elder';
/** Men wear hoods, felt caps, straw hats or a bowl cut; women coifs, straw hats or a braid. */
const MEN_HEADWEAR: readonly Headwear[] = ['hood', 'cap', 'straw', 'bare'];
const WOMEN_HEADWEAR: readonly Headwear[] = ['coif', 'straw', 'bare'];

interface Look {
  tunic: number;
  accent: number;
  skin: number;
  hair: number;
  dress: boolean;
  /** Long hair in a braid down the back. */
  braid: boolean;
  headwear: Headwear;
  /** How old they look (sim/age.ts): head size, hair colour, a cane. */
  stage: LifeStage;
}

function lookFor(variant: number, female: boolean, stage: LifeStage): Look {
  const ama = variant === 0;
  const styles = female ? WOMEN_HEADWEAR : MEN_HEADWEAR;
  let hair = ama ? 0xd8d4cc : HAIRS[(variant * 7 + 2) % HAIRS.length];
  // Hair greys in middle age and turns white in old age.
  if (stage === 'grey') hair = new Color(hair).lerp(new Color(0xb4b0a8), 0.55).getHex();
  if (stage === 'elder' && !ama) hair = 0xe4e0d8;
  let headwear: Headwear = ama ? 'elder' : styles[(variant * 5 + 1) % styles.length];
  // Children go bare-headed or in a little straw hat.
  if (stage === 'child') headwear = variant % 3 === 0 ? 'straw' : 'bare';
  return {
    tunic: ama ? 0x6a4a8a : TUNICS[variant % TUNICS.length],
    accent: ACCENTS[(variant * 3 + 1) % ACCENTS.length],
    skin: SKINS[(variant * 3 + 1) % SKINS.length],
    hair,
    dress: ama || female,
    braid: female && !ama,
    headwear,
    stage,
  };
}

// ------------------------------------------------------------------ Parts

function torso(look: Look): Mesh {
  const s = new Sculpt();
  const hem = look.dress ? 0.0034 : 0.0068;
  const flare = look.dress ? 0.0104 : 0.0096;
  // Tunic or kirtle: a bell from the hem to the neck, closed at both ends.
  s.add(
    lathe([
      [0, hem],
      [flare, hem],
      [flare - 0.0004, hem + 0.0012],
      [0.0082, 0.012],
      [0.0068, 0.0165],
      [0.0062, 0.019],
      [0.0044, 0.0207],
      [0, 0.021],
    ]),
    look.tunic,
  );
  // Hem trim in the accent colour.
  s.add(new TorusGeometry(flare - 0.0002, 0.00055, 6, 24), look.accent, { y: hem + 0.0004, rx: Math.PI / 2 });
  if (look.dress && look.headwear !== 'elder') {
    // A linen apron over the front of the skirt.
    s.add(
      lathe(
        [
          [flare + 0.0003, hem + 0.0012],
          [0.0086, 0.0118],
        ],
        -0.6,
        1.2,
      ),
      LINEN,
    );
  }
  // Belt, buckle and a little pouch.
  s.add(new TorusGeometry(0.0081, 0.0008, 6, 24), LEATHER, { y: 0.0121, rx: Math.PI / 2 });
  s.add(sphere(0.0011, 8, 6), GOLD, { y: 0.0121, z: 0.0088, sz: 0.5 });
  s.add(sphere(0.0019, 10, 8), LEATHER, { x: 0.0072, y: 0.0103, z: 0.0034, sx: 0.7 });
  // Collar.
  s.add(new TorusGeometry(0.0048, 0.0007, 6, 20), look.headwear === 'elder' ? LINEN : look.accent, {
    y: 0.0203,
    rx: Math.PI / 2,
  });
  // A hooded villager wears a short cape; the elder a shawl.
  if (look.headwear === 'hood' || look.headwear === 'elder') {
    const c = look.headwear === 'elder' ? 0xb04a5a : look.accent;
    s.add(
      lathe([
        [0.0084, 0.0168],
        [0.0074, 0.0186],
        [0.0062, 0.0202],
        [0.0046, 0.0212],
      ]),
      c,
    );
  }
  // Neck.
  s.add(new CylinderGeometry(0.0026, 0.003, 0.003, 10), look.skin, { y: 0.0215 });
  return s.mesh('Torso');
}

function leg(look: Look, side: 1 | -1): Group {
  const s = new Sculpt();
  s.add(new CapsuleGeometry(0.0019, 0.0042, 4, 10), look.dress ? look.tunic : look.accent, { y: -0.0036 });
  // A rounded shoe pointing forward.
  s.add(sphere(0.0024, 12, 8), SHOE, { y: -0.0071, z: 0.0009, sx: 1, sy: 0.62, sz: 1.45 });
  const g = new Group();
  g.name = side > 0 ? 'LegL' : 'LegR';
  g.position.set(side * HIP_X, HIP_Y, 0);
  g.add(s.mesh(side > 0 ? 'LegLMesh' : 'LegRMesh'));
  return g;
}

function arm(look: Look, side: 1 | -1): Group {
  const s = new Sculpt();
  const sleeve = look.dress ? look.accent : look.tunic;
  s.add(new CapsuleGeometry(0.0021, 0.0046, 4, 10), sleeve, { y: -0.0038 });
  // Cuff and hand.
  s.add(new TorusGeometry(0.0018, 0.0005, 6, 14), look.headwear === 'elder' ? LINEN : look.accent, {
    y: -0.0068,
    rx: Math.PI / 2,
  });
  s.add(sphere(0.0019, 12, 8), look.skin, { y: -0.0087 });
  const g = new Group();
  g.name = side > 0 ? 'ArmL' : 'ArmR';
  g.position.set(side * SHOULDER_X, SHOULDER_Y, 0);
  g.rotation.z = side * 0.12;
  g.add(s.mesh(side > 0 ? 'ArmLMesh' : 'ArmRMesh'));
  if (side < 0) g.add(hoe());
  if (side > 0 && look.stage === 'elder') g.add(cane());
  return g;
}

/** An elder's walking stick in the left hand, from the fist down to the ground. */
function cane(): Mesh {
  const s = new Sculpt();
  const len = SHOULDER_Y - 0.0087 + 0.0006;
  s.add(new CylinderGeometry(0.00055, 0.0007, len, 6), WOOD, { y: -0.0087 - len / 2 + 0.0012, z: 0.0024, rx: -0.12 });
  // A curved handle over the fist.
  s.add(new TorusGeometry(0.0016, 0.0005, 6, 10, Math.PI), WOOD, { y: -0.0076, z: 0.0012, ry: Math.PI / 2 });
  return s.mesh('Cane');
}

/** A hoe held in the right hand; the AnimationSystem shows it while farming. */
function hoe(): Mesh {
  const s = new Sculpt();
  // The handle runs from just behind the fist forward and down.
  const dir = new Vector3(0, -0.55, 1).normalize();
  const len = 0.024;
  const mid = new Vector3(0, -0.0087, 0).addScaledVector(dir, len / 2 - 0.004);
  const rot = new Euler().setFromQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir));
  s.add(new CylinderGeometry(0.00055, 0.00055, len, 6), WOOD, { x: mid.x, y: mid.y, z: mid.z, rx: rot.x, ry: rot.y, rz: rot.z });
  const end = new Vector3(0, -0.0087, 0).addScaledVector(dir, len - 0.004);
  // The iron blade hangs down from the end of the handle.
  s.add(new BoxGeometry(0.0042, 0.0034, 0.0007), IRON, { x: end.x, y: end.y - 0.0013, z: end.z + 0.0003, rx: -0.35 });
  const m = s.mesh('Tool');
  m.visible = false;
  return m;
}

function headwear(s: Sculpt, look: Look): void {
  const y = HEAD_C;
  const hairCap = (cut: number, r = HEAD_R + 0.0005): void => {
    s.add(cap(r, cut), look.hair, { y, z: -0.0004, rx: -0.12 });
  };
  switch (look.headwear) {
    case 'hood': {
      // A pointed hood open at the face, its long tail (liripipe) behind.
      s.add(cap(HEAD_R + 0.0012, 0.66), look.accent, { y: y + 0.0002, z: -0.0012, rx: -0.5 });
      s.add(new ConeGeometry(0.0034, 0.011, 10), look.accent, { y: y + 0.0062, z: -0.0068, rx: -2.1 });
      break;
    }
    case 'straw': {
      hairCap(0.52);
      s.add(new CylinderGeometry(0.0142, 0.0148, 0.001, 22), 0xe6c46a, { y: y + 0.0058 });
      s.add(new CylinderGeometry(0.0062, 0.0074, 0.0052, 16), 0xe6c46a, { y: y + 0.0086 });
      s.add(new CylinderGeometry(0.0075, 0.0075, 0.0013, 16), look.accent, { y: y + 0.0071 });
      break;
    }
    case 'coif': {
      // A white linen cap, a curl of hair at the brow.
      s.add(cap(HEAD_R + 0.0008, 0.6), LINEN, { y, z: -0.0012, rx: -0.35 });
      s.add(sphere(0.0018, 10, 8), look.hair, { y: y + 0.0062, z: 0.0055, sy: 0.6 });
      break;
    }
    case 'cap': {
      // A jaunty felt cap with a long bright feather.
      hairCap(0.5);
      s.add(new CylinderGeometry(0.0068, 0.0094, 0.0046, 16), look.accent, { y: y + 0.0064, rx: -0.18, rz: 0.12 });
      s.add(sphere(0.0011, 8, 8), GOLD, { x: 0.0062, y: y + 0.0072, z: 0.0028 });
      s.add(sphere(0.001, 8, 6), 0xf2f0e8, { x: 0.0068, y: y + 0.0108, z: -0.0028, sy: 6, sz: 1.8, rx: -0.9, rz: -0.25 });
      break;
    }
    case 'elder': {
      // Silver hair in a bun under a little white veil.
      hairCap(0.56);
      s.add(sphere(0.0034, 12, 10), look.hair, { y: y + 0.0058, z: -0.006 });
      s.add(cap(HEAD_R + 0.0011, 0.38), LINEN, { y: y + 0.0004, z: -0.0016, rx: -0.4 });
      break;
    }
    default: {
      // A bowl cut with a fringe.
      hairCap(0.55, HEAD_R + 0.0007);
      s.add(new TorusGeometry(0.0062, 0.0013, 6, 18, Math.PI), look.hair, { y: y + 0.0042, z: 0.0026, rx: -1.0 });
    }
  }
}

/** An oilcloth hood over the head and shoulders, hidden until rain or snow (WeatherSystem). */
function rainHood(look: Look): Mesh {
  const s = new Sculpt();
  const cloth = new Color(look.accent).multiplyScalar(0.72).getHex();
  s.add(cap(HEAD_R + 0.0026, 0.68), cloth, { y: HEAD_C + 0.0003, z: -0.0014, rx: -0.55 });
  // A little peak at the back.
  s.add(new ConeGeometry(0.0028, 0.006, 10), cloth, { y: HEAD_C + 0.0068, z: -0.0062, rx: -1.9 });
  // The cowl over the shoulders.
  s.add(
    lathe([
      [0.0092, -0.0042],
      [0.0078, -0.0022],
      [0.0056, 0.0004],
    ]),
    cloth,
  );
  const m = s.mesh('RainHood');
  m.visible = false;
  return m;
}

function head(look: Look): Group {
  const face = new Sculpt();
  face.add(sphere(HEAD_R, 20, 14), look.skin, { y: HEAD_C });
  // Ears, a button nose, rosy cheeks and a smile.
  for (const side of [-1, 1]) {
    face.add(sphere(0.0016, 8, 6), look.skin, { x: side * 0.0086, y: HEAD_C - 0.0004, sx: 0.55 });
    face.add(sphere(0.0014, 10, 6), CHEEK, { x: side * 0.005, y: HEAD_C - 0.002, z: 0.0068, sz: 0.4, sy: 0.75 });
  }
  face.add(sphere(0.0011, 10, 8), new Color(look.skin).multiplyScalar(0.88).getHex(), { y: HEAD_C - 0.0006, z: 0.0086 });
  face.add(new TorusGeometry(0.0016, 0.00038, 6, 10, Math.PI), 0x7a2a22, { y: HEAD_C - 0.0022, z: 0.0081, rz: Math.PI });
  headwear(face, look);
  if (look.braid) {
    // A braid down the back of the head, tied with a ribbon.
    face.add(new CapsuleGeometry(0.0019, 0.0075, 4, 10), look.hair, { y: HEAD_C - 0.0072, z: -0.0068, rx: 0.35 });
    face.add(new TorusGeometry(0.0017, 0.0005, 6, 12), look.accent, { y: HEAD_C - 0.0118, z: -0.0052, rx: Math.PI / 2 + 0.35 });
  }

  const eyes = new Sculpt();
  for (const side of [-1, 1]) {
    eyes.add(sphere(0.0011, 10, 8), EYE, { x: side * 0.003, sy: 1.35, sz: 0.6, z: 0.008 });
    eyes.add(sphere(0.00032, 6, 4), 0xffffff, { x: side * 0.003 + 0.0003, y: 0.0006, z: 0.0087 });
  }
  const eyesMesh = eyes.mesh('Eyes');
  // Eyes blink by squashing around their own centre.
  eyesMesh.position.y = HEAD_C + 0.0006;

  const g = new Group();
  g.name = 'Head';
  g.position.y = NECK_Y;
  g.add(face.mesh('Face'), eyesMesh);
  // A straw hat already keeps the rain off; everyone else has a hood to pull up.
  if (look.headwear !== 'straw') g.add(rainHood(look));
  return g;
}

/**
 * A 4 cm villager. `variant` (the villager's index) picks colours and
 * headwear; `female` picks the outfit: women wear a long kirtle with an
 * apron and a braid (coif, straw hat or bare), men a tunic and hose (hood,
 * feathered cap, straw hat or a bowl cut). Variant 0 is the elder, in a
 * purple gown and shawl with silver hair. `stage` shows their age:
 * children have big heads and go bare-headed or in straw hats; hair greys
 * from middle age and turns white for elders, who carry a cane.
 */
export function createVillager(variant = 0, female = variant % 2 === 0, stage: LifeStage = 'adult'): Group {
  const look = lookFor(variant, female, stage);
  const body = new Group();
  body.name = 'Body';
  const h = head(look);
  // Children have big heads for their size.
  if (stage === 'child') h.scale.setScalar(1.18);
  body.add(torso(look), leg(look, 1), leg(look, -1), arm(look, 1), arm(look, -1), h);
  const root = new Group();
  root.name = 'Villager';
  root.add(body);
  return root;
}
