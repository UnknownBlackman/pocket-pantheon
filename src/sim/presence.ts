/**
 * The god among the villagers: how the village reacts to the player's real
 * hands and head. Pure simulation code; the XR layer fills a GodPresence
 * with hand and head samples in village space every frame, and the
 * SimSystem calls updatePresence() each fixed tick before tick().
 *
 * - Shadow: villagers under a hovering hand look up in awe; three or more
 *   under a still hand kneel and pray (an "eclipse").
 * - Riding: an open palm facing up, resting beside the village, invites the
 *   faithful to climb on. They ride when the hand lifts, hop off onto a job
 *   when it is set down, and tumble off if it tilts, closes or moves fast.
 * - Hide-and-seek: a hand resting on the table (not palm up) draws the
 *   curious to hide behind it; lifting it quickly finds them.
 * - Waving back: each wave or raise of both hands makes the village answer.
 */
import type { EventBus } from '../core/events.ts';
import { addChronicle, firstToday } from './chronicle.ts';
import { clamp01, clampToDisc, dist, stepTowards } from './math.ts';
import { buildingAt } from './powers.ts';
import { random, randomRange } from './random.ts';
import { PRESENCE as P, RULES } from './rules.ts';
import type { Activity, HandSide, Intent, Villager, World } from './types.ts';
import { assignIntent } from './villager.ts';

/** One hand, in village space. `y` is height above the diorama surface. */
export interface HandSample {
  present: boolean;
  x: number;
  y: number;
  z: number;
  /** Palm faces up (normal within ~45 degrees of up). */
  palmUp: boolean;
  /** All four fingers extended. */
  open: boolean;
  /** Degrees between the palm normal and straight up (0 = flat, palm up). */
  tilt: number;
  /** Palm speed, metres per second. */
  speed: number;
  still: boolean;
  /** Five fingertips as x,z pairs, for the shadow. */
  tips: Float32Array;
}

export interface GodPresence {
  hands: Record<HandSide, HandSample>;
  headPresent: boolean;
  head: { x: number; y: number; z: number };
  /** The god is leaning close over the village (render-only: villagers look up). */
  headNear: boolean;
  /** The XR layer increments these on each detected wave / raise of both hands. */
  waveCount: number;
  cheerCount: number;
  // Internal timers and state (owned by updatePresence).
  invite: Record<HandSide, number>;
  rest: Record<HandSide, number>;
  eclipseTime: number;
  seenWave: number;
  seenCheer: number;
  hideHand: HandSide | null;
  hideX: number;
  hideZ: number;
}

export const SIDES: readonly HandSide[] = ['left', 'right'];

export function makeHandSample(): HandSample {
  return {
    present: false,
    x: 0,
    y: 0,
    z: 0,
    palmUp: false,
    open: false,
    tilt: 90,
    speed: 0,
    still: false,
    tips: new Float32Array(10),
  };
}

export function makePresence(): GodPresence {
  return {
    hands: { left: makeHandSample(), right: makeHandSample() },
    headPresent: false,
    head: { x: 0, y: 0.5, z: 0.5 },
    headNear: false,
    waveCount: 0,
    cheerCount: 0,
    invite: { left: 0, right: 0 },
    rest: { left: 0, right: 0 },
    eclipseTime: 0,
    seenWave: 0,
    seenCheer: 0,
    hideHand: null,
    hideX: 0,
    hideZ: 0,
  };
}

/** Villagers already doing something the god's presence should not interrupt. */
function busy(v: Villager): boolean {
  return v.carried || v.ride !== 'none' || v.hide !== 'none' || v.panic > 0;
}

function react(v: Villager, activity: Activity, seconds: number): void {
  v.reaction = activity;
  v.reactionTime = seconds;
  v.activity = activity;
  v.target = null;
}

const scratch = { x: 0, z: 0 };

export function updatePresence(world: World, p: GodPresence, dt: number, bus?: EventBus): void {
  const day = world.phase === 'day';
  updateShadow(world, p, dt, day, bus);
  for (const side of SIDES) updateRiding(world, p, side, dt, day, bus);
  updateHideAndSeek(world, p, dt, day, bus);
  updateSeen(world, p, bus);
}

// ------------------------------------------------------------------ Shadow

export function underShadow(v: Villager, h: HandSample): boolean {
  const grow = 1 + h.y * P.shadowGrowPerMetre;
  const dx = v.pos.x - h.x;
  const dz = v.pos.z - h.z;
  const pr = P.shadowPalmRadius * grow;
  if (dx * dx + dz * dz < pr * pr) return true;
  const tr = P.shadowTipRadius * grow;
  for (let i = 0; i < 5; i++) {
    const tx = v.pos.x - h.tips[i * 2];
    const tz = v.pos.z - h.tips[i * 2 + 1];
    if (tx * tx + tz * tz < tr * tr) return true;
  }
  return false;
}

function updateShadow(world: World, p: GodPresence, dt: number, day: boolean, bus?: EventBus): void {
  let count = 0;
  let stillHand = false;
  for (const side of SIDES) {
    const h = p.hands[side];
    // A hovering hand casts the awe-inspiring shadow; a resting one is for hide-and-seek.
    if (!h.present || h.palmUp || h.y < P.restMaxHeight || h.y > P.shadowMaxHeight) continue;
    if (h.still) stillHand = true;
    for (const v of world.villagers) {
      if (busy(v)) continue;
      if (v.reactionTime > 0 && v.reaction !== 'awe' && v.reaction !== 'pray') continue;
      if (!underShadow(v, h)) continue;
      count++;
      react(v, world.eclipse && day ? 'pray' : 'awe', P.aweSeconds);
    }
  }
  if (day && count >= P.eclipseVillagers && stillHand) p.eclipseTime += dt;
  else p.eclipseTime = 0;
  const was = world.eclipse;
  world.eclipse = p.eclipseTime >= P.eclipseSeconds;
  if (world.eclipse && !was && firstToday(world, 'eclipse')) {
    addChronicle(world, 'eclipse', {}, [], bus);
  }
}

// ------------------------------------------------------------------ Riding

function intentFor(kind: string): Intent {
  return kind === 'field' ? 'farm' : kind === 'hut' ? 'rest' : kind === 'shrine' ? 'pray' : 'idle';
}

function startFall(world: World, v: Villager, hard: boolean, bus?: EventBus): void {
  v.ride = 'fall';
  v.rideTime = 0;
  v.rideHard = hard;
  v.activity = 'fall';
  if (hard) {
    v.beliefs.faith = clamp01(v.beliefs.faith + P.fallFaith);
    if (firstToday(world, 'fell')) addChronicle(world, 'fell', { name: v.name }, [v.id], bus);
  }
  bus?.emit('villager.fell', { villagerId: v.id, hard });
}

function land(v: Villager): void {
  clampToDisc(v.pos, RULES.village.radius * 0.92);
  v.ride = 'none';
  v.rideHand = null;
  v.rideY = 0;
  v.intent = 'idle';
  v.commit = 0;
  v.decisionIn = 0;
  if (v.rideHard) react(v, 'daze', P.dazeSeconds);
  else v.activity = 'idle';
  v.rideHard = false;
}

function dismount(world: World, v: Villager, bus?: EventBus): void {
  v.ride = 'none';
  v.rideHand = null;
  v.rideY = 0;
  clampToDisc(v.pos, RULES.village.radius * 0.92);
  const b = buildingAt(world, v.pos.x, v.pos.z);
  if (!b) {
    v.activity = 'idle';
    v.decisionIn = 0;
    return;
  }
  const intent = intentFor(b.kind);
  assignIntent(world, v, intent, b, RULES.decisions.liftCommitSeconds);
  v.target = null;
  v.activity = intent === 'farm' ? 'farm' : intent === 'rest' ? 'rest' : intent === 'pray' ? 'pray' : 'idle';
  v.beliefs.faith = clamp01(v.beliefs.faith + P.rideFaith);
  v.beliefs.initiative = clamp01(v.beliefs.initiative + P.rideInitiative);
  world.stats.interventions += 1;
  world.sessionCounts.ride += 1;
  if (firstToday(world, 'rode')) addChronicle(world, 'rode', { name: v.name, place: b.kind }, [v.id], bus);
  bus?.emit('villager.dropped', { villagerId: v.id, buildingId: b.id, x: v.pos.x, z: v.pos.z });
}

function updateRiding(
  world: World,
  p: GodPresence,
  side: HandSide,
  dt: number,
  day: boolean,
  bus?: EventBus,
): void {
  const h = p.hands[side];
  const reach = RULES.village.radius + 0.08;
  const inviting =
    day &&
    h.present &&
    h.palmUp &&
    h.open &&
    h.still &&
    h.y < P.inviteMaxHeight &&
    Math.hypot(h.x, h.z) < reach;
  p.invite[side] = inviting ? p.invite[side] + dt : 0;

  let onHand = 0;
  for (const v of world.villagers) {
    if (v.rideHand !== side) continue;
    v.rideTime += dt;
    if (v.ride === 'climb') {
      if (!h.present || !h.palmUp || !h.open || !day) {
        v.ride = 'none';
        v.rideHand = null;
        v.decisionIn = 0;
        continue;
      }
      onHand++;
      scratch.x = h.x;
      scratch.z = h.z;
      stepTowards(v.pos, scratch, RULES.village.walkSpeed * P.climbSpeedMultiplier * dt);
      v.activity = 'climb';
      if (dist(v.pos, scratch) < 0.03) {
        v.ride = 'ride';
        v.rideTime = 0;
        v.rideLifted = false;
        const a = random(world) * Math.PI * 2;
        const r = random(world) * P.rideSpread;
        v.rideX = Math.cos(a) * r;
        v.rideZ = Math.sin(a) * r;
        v.rideY = h.y;
        v.activity = 'ride';
        bus?.emit('villager.climbed', { villagerId: v.id });
      }
    } else if (v.ride === 'ride') {
      onHand++;
      if (!h.present) {
        startFall(world, v, false, bus); // tracking lost: they hop down calmly
      } else if (h.tilt > P.fallTiltDegrees || !h.open || h.speed > P.fallSpeed) {
        startFall(world, v, true, bus);
      } else {
        v.pos.x = h.x + v.rideX;
        v.pos.z = h.z + v.rideZ;
        v.rideY = h.y;
        v.activity = 'ride';
        if (h.y > P.liftedHeight) v.rideLifted = true;
        if (v.rideLifted && h.y < P.setDownHeight && h.still) dismount(world, v, bus);
      }
    } else if (v.ride === 'fall') {
      v.activity = 'fall';
      if (v.rideTime >= P.fallSeconds) land(v);
    }
  }

  // Invite the faithful aboard.
  if (p.invite[side] < P.inviteSeconds || onHand >= P.maxRiders) return;
  scratch.x = h.x;
  scratch.z = h.z;
  for (const v of world.villagers) {
    if (onHand >= P.maxRiders) break;
    if (busy(v) || v.reactionTime > 0) continue;
    // Just delivered to a job (by riding or a pinch): they get to work first.
    if (v.commit > 0 && v.intent !== 'idle') continue;
    if (dist(v.pos, scratch) > P.inviteRadius) continue;
    if (random(world) >= v.beliefs.faith * P.climbRatePerFaith * dt) continue;
    v.ride = 'climb';
    v.rideHand = side;
    v.rideTime = 0;
    v.rideHard = false;
    v.target = null;
    v.activity = 'climb';
    onHand++;
  }
}

// ------------------------------------------------------------------ Hide-and-seek

function resting(h: HandSample): boolean {
  return (
    h.present &&
    !h.palmUp &&
    h.y < P.restMaxHeight &&
    h.still &&
    Math.hypot(h.x, h.z) < RULES.village.radius + 0.05
  );
}

function endHide(v: Villager): void {
  v.hide = 'none';
  v.hideTime = 0;
  v.target = null;
  v.decisionIn = 0;
}

function updateHideAndSeek(world: World, p: GodPresence, dt: number, day: boolean, bus?: EventBus): void {
  const side = p.hideHand;
  if (side) {
    const h = p.hands[side];
    const lifted = !h.present || h.speed > P.foundSpeed || h.y > P.foundHeight;
    if (lifted || !day) {
      // "Found you!" Hiders cheer and scatter; walkers just give up.
      let found: Villager | null = null;
      let count = 0;
      for (const v of world.villagers) {
        if (v.hide === 'none') continue;
        if (v.hide === 'hiding' && day) {
          found ??= v;
          count++;
          endHide(v);
          react(v, 'cheer', P.foundCheerSeconds);
        } else {
          endHide(v);
        }
      }
      if (found) {
        if (firstToday(world, 'found')) addChronicle(world, 'found', { name: found.name }, [found.id], bus);
        bus?.emit('hideseek.found', { count });
      }
      p.hideHand = null;
      p.rest[side] = 0;
      return;
    }

    let hiders = 0;
    for (const v of world.villagers) {
      if (v.hide === 'none') continue;
      hiders++;
      v.hideTime += dt;
      if (v.hideTime > P.hideBoredSeconds) {
        endHide(v);
        continue;
      }
      if (v.hide === 'going' && v.target) {
        const arrived = stepTowards(v.pos, v.target, RULES.village.walkSpeed * 1.4 * dt);
        v.activity = 'walk';
        if (arrived) {
          v.hide = 'hiding';
          v.target = null;
          v.activity = 'hide';
          bus?.emit('villager.hid', { villagerId: v.id });
        }
      } else {
        v.activity = 'hide';
      }
    }
    // More of the curious join while the hand rests.
    if (hiders < P.maxHiders && resting(h)) {
      scratch.x = p.hideX;
      scratch.z = p.hideZ;
      for (const v of world.villagers) {
        if (hiders >= P.maxHiders) break;
        if (busy(v) || v.reactionTime > 0) continue;
        if (dist(v.pos, scratch) > P.hideRadius) continue;
        if (random(world) >= v.beliefs.initiative * P.hideRatePerInitiative * dt) continue;
        v.hide = 'going';
        v.hideTime = 0;
        v.target = {
          x: p.hideX + randomRange(world, -0.02, 0.02),
          z: p.hideZ + randomRange(world, -0.02, 0.02),
        };
        clampToDisc(v.target, RULES.village.radius * 0.95);
        hiders++;
      }
    }
    if (hiders === 0 && !resting(h)) p.hideHand = null;
    return;
  }

  if (!day) {
    p.rest.left = p.rest.right = 0;
    return;
  }
  for (const s of SIDES) {
    const h = p.hands[s];
    p.rest[s] = resting(h) ? p.rest[s] + dt : 0;
    if (p.rest[s] < P.restSeconds) continue;
    // Hide on the far side of the hand from the god's eyes.
    let dx = h.x - (p.headPresent ? p.head.x : h.x);
    let dz = h.z - (p.headPresent ? p.head.z : h.z + 1);
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;
    p.hideHand = s;
    p.hideX = h.x + dx * P.hideBehind;
    p.hideZ = h.z + dz * P.hideBehind;
    break;
  }
}

// ------------------------------------------------------------------ Waving back

function reactAll(world: World, activity: Activity): void {
  for (const v of world.villagers) {
    if (busy(v)) continue;
    react(v, activity, P.reactSeconds);
  }
}

function updateSeen(world: World, p: GodPresence, bus?: EventBus): void {
  if (world.phase === 'ended') {
    p.seenWave = p.waveCount;
    p.seenCheer = p.cheerCount;
    return;
  }
  if (p.waveCount !== p.seenWave) {
    p.seenWave = p.waveCount;
    reactAll(world, 'wave');
    if (firstToday(world, 'waved')) addChronicle(world, 'waved', {}, [], bus);
    bus?.emit('god.waved', {});
  }
  if (p.cheerCount !== p.seenCheer) {
    p.seenCheer = p.cheerCount;
    reactAll(world, 'cheer');
    if (firstToday(world, 'cheered')) addChronicle(world, 'cheered', {}, [], bus);
    bus?.emit('god.cheered', {});
  }
}
