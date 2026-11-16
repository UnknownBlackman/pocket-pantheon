/**
 * Villager poses on the articulated figure (scene-assets/villager.scene-asset.ts):
 * each activity sets the body's bob, lean and squash plus target angles for
 * the arms, legs and head; limbs ease towards their targets so poses blend.
 * Eyes blink now and then and close in prayer, sleep and death.
 */
import type { Object3D } from '@iwsdk/core';
import { lifeStage } from '../sim/age.ts';
import { RULES } from '../sim/rules.ts';
import type { Villager } from '../sim/types.ts';

interface Parts {
  armL?: Object3D;
  armR?: Object3D;
  legL?: Object3D;
  legR?: Object3D;
  head?: Object3D;
  eyes?: Object3D;
  tool?: Object3D;
  /** Current eased limb angles: armLx, armLz, armRx, armRz, legLx, legRx, headX, headY, headZ. */
  cur: Float32Array;
}

/** Target pose: body transform plus limb angles (radians). */
export interface Pose {
  y: number;
  sy: number;
  rx: number;
  rz: number;
  jx: number;
  armLx: number;
  armLz: number;
  armRx: number;
  armRz: number;
  legLx: number;
  legRx: number;
  headX: number;
  headY: number;
  headZ: number;
  /** Eye openness, 1 open to ~0.1 shut. */
  eyes: number;
  tool: boolean;
}

const ARM_REST = 0.12;
const cache = new WeakMap<Object3D, Parts>();
const target = new Float32Array(9);

function partsOf(body: Object3D): Parts {
  let p = cache.get(body);
  if (!p) {
    p = {
      armL: body.getObjectByName('ArmL'),
      armR: body.getObjectByName('ArmR'),
      legL: body.getObjectByName('LegL'),
      legR: body.getObjectByName('LegR'),
      head: body.getObjectByName('Head'),
      eyes: body.getObjectByName('Eyes'),
      tool: body.getObjectByName('Tool'),
      cur: new Float32Array(9),
    };
    p.cur[1] = ARM_REST;
    p.cur[3] = -ARM_REST;
    cache.set(body, p);
  }
  return p;
}

export function makePose(): Pose {
  return neutral({} as Pose);
}

function neutral(out: Pose): Pose {
  out.y = 0;
  out.sy = 1;
  out.rx = 0;
  out.rz = 0;
  out.jx = 0;
  out.armLx = 0;
  out.armLz = ARM_REST;
  out.armRx = 0;
  out.armRz = -ARM_REST;
  out.legLx = 0;
  out.legRx = 0;
  out.headX = 0;
  out.headY = 0;
  out.headZ = 0;
  out.eyes = 1;
  out.tool = false;
  return out;
}

/** Arms raised overhead, wiggling (cheering, panicking, flailing). */
function armsUp(p: Pose, lift: number, wiggle: number, t: number): void {
  p.armLz = lift + Math.sin(t * wiggle) * 0.3;
  p.armRz = -(lift + Math.cos(t * wiggle) * 0.3);
}

/**
 * Fills `p` for villager `v`. `t` is the villager's own clock, `at` seconds
 * in the current activity and `ease` 0..1 into it; `carried` while held
 * aloft; `godNear` while the god leans in close.
 */
export function poseFor(
  p: Pose,
  v: Villager,
  t: number,
  at: number,
  ease: number,
  carried: boolean,
  godNear: boolean,
): Pose {
  neutral(p);
  const stage = lifeStage(v.age);
  // A quick blink every few seconds.
  if (t % 3.3 < 0.1) p.eyes = 0.12;

  if (carried) {
    // Dangling: legs kicking, arms flailing, swinging about.
    p.sy = 1.06;
    p.rz = Math.sin(t * 5) * 0.3;
    p.rx = Math.sin(t * 3.7) * 0.15;
    p.legLx = Math.sin(t * 12) * 0.7;
    p.legRx = -p.legLx;
    armsUp(p, 2.1, 9, t);
    p.headX = -0.35;
    return p;
  }
  switch (v.activity) {
    case 'walk': {
      // Children patter quickly; elders shuffle slowly.
      const cadence = stage === 'elder' ? 9 : stage === 'child' ? 17 : 14;
      const s = Math.sin(t * cadence);
      p.y = Math.abs(Math.cos(t * cadence)) * (stage === 'child' ? 0.0035 : 0.0022);
      p.rz = s * 0.05;
      p.legLx = s * 0.6;
      p.legRx = -s * 0.6;
      p.armLx = -s * 0.5;
      p.armRx = s * 0.5;
      p.headY = Math.sin(t * 0.7) * 0.2;
      if (v.limp > 0) {
        // A careful hobble: the right leg stays stiff, a hand on the hip.
        p.rz = 0.14 + Math.max(0, s) * 0.08;
        p.legRx = -s * 0.15;
        p.armRx = 0.4;
        p.armRz = -0.7;
        p.y = Math.max(0, s) * 0.0015;
      }
      break;
    }
    case 'play': {
      // Children skip and bounce, arms out like wings.
      const hop = Math.abs(Math.sin(t * 11));
      p.y = hop * 0.007;
      p.sy = hop < 0.15 ? 0.9 : 1.03;
      p.rz = Math.sin(t * 5.5) * 0.15;
      p.armLz = 1.2 + Math.sin(t * 11) * 0.3;
      p.armRz = -p.armLz;
      p.legLx = p.legRx = -hop * 0.5;
      break;
    }
    case 'mourn':
      // Head bowed, hands clasped in front.
      p.headX = 0.55 * ease;
      p.rx = 0.12 * ease;
      p.armLx = p.armRx = -0.55;
      p.armLz = -0.35;
      p.armRz = 0.35;
      p.rz = Math.sin(t * 1.2) * 0.03;
      p.eyes = 0.15;
      break;
    case 'dead':
      // Lying where they fell, arms out.
      p.rx = -1.45 * ease;
      p.y = 0.004 * ease;
      p.armLz = 1.1;
      p.armRz = -1.1;
      p.eyes = 0.1;
      break;
    case 'farm': {
      // Hoeing: lean in and chop the soil.
      const s = Math.sin(t * 6);
      p.tool = true;
      p.rx = (0.2 + Math.max(0, s) * 0.12) * ease;
      p.armLx = p.armRx = (-0.95 - s * 0.45) * ease;
      p.armLz = -0.3;
      p.armRz = 0.3;
      p.legLx = -0.25;
      p.legRx = 0.2;
      p.headX = 0.3;
      p.sy = 1 - Math.max(0, s) * 0.03;
      break;
    }
    case 'rest':
      // Sitting down, legs out, nodding off.
      p.y = -0.0072 * ease;
      p.legLx = -1.45 * ease + Math.sin(t * 0.6) * 0.05;
      p.legRx = -1.45 * ease;
      p.armLx = p.armRx = 0.35 * ease;
      p.headX = (0.25 + Math.sin(t * 1.5) * 0.06) * ease;
      p.sy = 1 + Math.sin(t * 1.5) * 0.015;
      p.eyes = 0.12;
      break;
    case 'pray':
      // Kneeling, hands together, bowing in time.
      p.y = -0.0042 * ease;
      p.legLx = p.legRx = 1.15 * ease;
      p.armLx = p.armRx = -1.15 * ease;
      p.armLz = -0.42;
      p.armRz = 0.42;
      p.rx = (0.12 + Math.sin(t * 2) * 0.1) * ease;
      p.headX = 0.3 * ease;
      p.eyes = 0.12;
      break;
    case 'panic': {
      // A frantic run: leaning forward, arms waving overhead.
      const s = Math.sin(t * 24);
      p.y = Math.abs(s) * 0.005;
      p.rx = 0.28;
      p.rz = s * 0.1;
      p.legLx = s * 0.95;
      p.legRx = -s * 0.95;
      armsUp(p, 2.5, 30, t);
      p.headY = Math.sin(t * 13) * 0.4;
      p.headX = -0.2;
      break;
    }
    case 'cheer': {
      const hop = Math.sin(t * 8);
      p.y = Math.max(0, hop) * 0.011;
      p.sy = hop < -0.6 ? 0.88 : 1 + Math.max(0, hop) * 0.05;
      armsUp(p, 2.7, 16, t);
      p.legLx = p.legRx = -Math.max(0, hop) * 0.45;
      p.headX = -0.3;
      break;
    }
    case 'bow':
      // A little bow to the god, hands together.
      p.rx = 0.55 * Math.sin(Math.min(1, at / 1.3) * Math.PI);
      p.headX = 0.3;
      p.armLx = p.armRx = -0.5;
      p.armLz = -0.3;
      p.armRz = 0.3;
      p.eyes = 0.15;
      break;
    case 'touch': {
      // On tiptoe, reaching up to pat the god's fingertip.
      const pat = Math.sin(t * 9);
      p.y = 0.0012 + Math.max(0, pat) * 0.0012;
      p.rx = -0.15;
      p.armLx = -2.2 + pat * 0.15;
      p.armRx = -2.2 - pat * 0.15;
      p.armLz = -0.15;
      p.armRz = 0.15;
      p.headX = -0.45;
      break;
    }
    case 'awe':
      // Staring up at the god's hand, arms a little out in wonder.
      p.headX = -0.6 * ease;
      p.rx = -0.12 * ease;
      p.armLz = 0.5;
      p.armRz = -0.5;
      p.rz = Math.sin(t * 23) * 0.02;
      break;
    case 'wave':
      // Waving back with the right hand high.
      p.armRz = -2.5 + Math.sin(t * 10) * 0.45;
      p.headX = -0.35;
      p.headZ = Math.sin(t * 5) * 0.12;
      p.rz = Math.sin(t * 5) * 0.06;
      p.y = Math.abs(Math.sin(t * 10)) * 0.0015;
      break;
    case 'daze':
      // Dizzy wobble, arms limp.
      p.headZ = Math.sin(t * 6) * 0.35;
      p.headX = Math.cos(t * 6) * 0.2;
      p.rz = Math.sin(t * 6) * 0.12;
      p.armLz = 0.45;
      p.armRz = -0.45;
      p.sy = 0.95;
      p.eyes = 0.45;
      break;
    case 'climb': {
      // Eager hops towards the palm, reaching up.
      const s = Math.sin(t * 16);
      p.y = Math.abs(s) * 0.006;
      p.armLx = -2.5 + s * 0.3;
      p.armRx = -2.5 - s * 0.3;
      p.legLx = s * 0.5;
      p.legRx = -s * 0.5;
      p.headX = -0.3;
      break;
    }
    case 'ride':
      // Sitting on the palm, legs dangling forward, looking about.
      p.y = -0.0072;
      p.legLx = -1.35 + Math.sin(t * 3) * 0.2;
      p.legRx = -1.35 - Math.sin(t * 3) * 0.2;
      p.armLx = p.armRx = 0.3;
      p.headY = Math.sin(t * 0.8) * 0.6;
      p.headX = -0.2;
      p.rz = Math.sin(t * 1.7) * 0.06;
      break;
    case 'fall':
      // Head over heels, limbs everywhere.
      p.rx = at * 14;
      p.rz = Math.sin(at * 9) * 0.6;
      armsUp(p, 2.2, 20, t);
      p.legLx = Math.sin(t * 20) * 0.8;
      p.legRx = -p.legLx;
      break;
    case 'hide': {
      // Crouched behind the hand, covering their eyes; now and then a peek.
      const peek = Math.sin(t * 1.3) > 0.55;
      p.y = -0.003;
      p.legLx = p.legRx = -0.7;
      p.rx = 0.25;
      p.armLx = -1.9;
      p.armLz = -0.35;
      p.armRx = peek ? -0.4 : -1.9;
      p.armRz = peek ? -ARM_REST : 0.35;
      p.headZ = peek ? 0.35 : 0;
      p.jx = peek ? 0.003 : 0;
      break;
    }
    default: {
      // Idle: breathing, glancing about. Dependent villagers slump and wait.
      const dependent = v.beliefs.initiative < RULES.decisions.dependentInitiative;
      p.sy = 1 + Math.sin(t * 2) * 0.018;
      p.headY = Math.sin(t * 0.45) * 0.5;
      p.headX = Math.sin(t * 0.31) * 0.08;
      if (dependent) {
        p.rx = 0.18 * ease;
        p.headX = 0.45 * ease;
        p.headY *= 0.3;
        p.armLx = p.armRx = -0.15;
      }
    }
  }
  // Age shows in how they stand and move.
  const upright = v.activity === 'walk' || v.activity === 'idle';
  if (stage === 'elder' && upright) {
    // A stoop over the cane, short steps, the cane planted ahead.
    p.rx += 0.18;
    p.headX -= 0.15;
    p.legLx *= 0.55;
    p.legRx *= 0.55;
    p.armRx *= 0.4;
    p.armLx = -0.3 + (v.activity === 'walk' ? Math.sin(t * 9) * 0.12 : 0);
    p.armLz = 0.05;
    p.y *= 0.4;
  } else if (stage === 'grey' && upright) {
    p.rx += 0.06;
    p.legLx *= 0.85;
    p.legRx *= 0.85;
  } else if (stage === 'child' && v.activity === 'idle') {
    // Children cannot keep still: little hops, swinging arms, looking about.
    p.y += Math.max(0, Math.sin(t * 3.1) - 0.6) * 0.004;
    p.armLx = Math.sin(t * 2.4) * 0.35;
    p.armRx = -p.armLx;
    p.headY = Math.sin(t * 1.2) * 0.6;
  }
  // The god leans close: idle and walking villagers look up.
  if (godNear && (v.activity === 'idle' || v.activity === 'walk')) p.headX = -0.55 * ease;
  return p;
}

/** Applies `p` to the figure; limbs ease towards it at `rate` per second. */
export function applyPose(body: Object3D, p: Pose, delta: number, rate = 14): void {
  body.position.set(p.jx, p.y, 0);
  body.scale.set(2 - p.sy, p.sy, 2 - p.sy);
  body.rotation.set(p.rx, 0, p.rz);
  const parts = partsOf(body);
  const c = parts.cur;
  target[0] = p.armLx;
  target[1] = p.armLz;
  target[2] = p.armRx;
  target[3] = p.armRz;
  target[4] = p.legLx;
  target[5] = p.legRx;
  target[6] = p.headX;
  target[7] = p.headY;
  target[8] = p.headZ;
  const k = 1 - Math.exp(-rate * Math.min(delta, 0.1));
  for (let i = 0; i < 9; i++) c[i] += (target[i] - c[i]) * k;
  parts.armL?.rotation.set(c[0], 0, c[1]);
  parts.armR?.rotation.set(c[2], 0, c[3]);
  parts.legL?.rotation.set(c[4], 0, 0);
  parts.legR?.rotation.set(c[5], 0, 0);
  parts.head?.rotation.set(c[6], c[7], c[8]);
  if (parts.eyes) parts.eyes.scale.y = p.eyes;
  if (parts.tool) parts.tool.visible = p.tool;
}
