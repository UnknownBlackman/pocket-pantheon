import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EventBus } from '../src/core/events.ts';
import { makePresence, updatePresence } from '../src/sim/presence.ts';
import type { GodPresence, HandSample } from '../src/sim/presence.ts';
import { PRESENCE, RULES } from '../src/sim/rules.ts';
import { divineTitle, TITLES } from '../src/sim/title.ts';
import type { HandSide, World } from '../src/sim/types.ts';
import { createWorld, tick } from '../src/sim/world.ts';

const DT = 1 / RULES.sim.hz;

function run(w: World, p: GodPresence, seconds: number, bus?: EventBus): void {
  for (let i = 0; i < Math.round(seconds * RULES.sim.hz); i++) {
    updatePresence(w, p, DT, bus);
    tick(w, DT, bus);
  }
}

function hand(p: GodPresence, side: HandSide, h: Partial<HandSample>): HandSample {
  const s = p.hands[side];
  Object.assign(s, { present: true, palmUp: false, open: true, tilt: 180, speed: 0, still: true }, h);
  // Fingertips spread a little ahead of the palm.
  for (let i = 0; i < 5; i++) {
    s.tips[i * 2] = s.x - 0.03 + i * 0.015;
    s.tips[i * 2 + 1] = s.z - 0.08;
  }
  return s;
}

/** A calm village: no needs pressure, everyone idle near a spot, nobody keen. */
function calmWorld(seed: number, x: number, z: number): World {
  const w = createWorld(seed);
  w.villagers.forEach((v, i) => {
    v.pos = { x: x + (i % 3) * 0.01, z: z + Math.floor(i / 3) * 0.01 };
    v.needs.hunger = 0;
    v.needs.fatigue = 0;
    v.beliefs.faith = 0;
    v.beliefs.initiative = 0.1; // dependent: they wait in place
  });
  return w;
}

describe('the god\'s shadow', () => {
  it('villagers under a hovering hand look up in awe', () => {
    const w = calmWorld(50, 0.1, 0.1);
    const p = makePresence();
    hand(p, 'right', { x: 0.1, y: 0.15, z: 0.1, still: false });
    run(w, p, 0.3);
    assert.ok(w.villagers.filter((v) => v.activity === 'awe').length >= 3);
    p.hands.right.present = false;
    run(w, p, 1.5);
    assert.equal(w.villagers.filter((v) => v.activity === 'awe').length, 0, 'awe fades');
  });

  it('a still hand over three or more makes them kneel and pray for Favor', () => {
    const w = calmWorld(51, 0.1, 0.1);
    w.favor = 0;
    const p = makePresence();
    hand(p, 'right', { x: 0.11, y: 0.12, z: 0.11 });
    run(w, p, PRESENCE.eclipseSeconds + 0.5);
    assert.equal(w.eclipse, true);
    assert.ok(w.villagers.some((v) => v.activity === 'pray'));
    run(w, p, RULES.favor.prayerSeconds + 1);
    assert.ok(w.favor > 0, 'kneeling prayers give Favor');
    assert.ok(w.chronicle.some((e) => e.kind === 'eclipse'));
  });

  it('a resting hand casts no awe (that is hide-and-seek)', () => {
    const w = calmWorld(52, 0.1, 0.1);
    const p = makePresence();
    hand(p, 'right', { x: 0.1, y: 0.02, z: 0.1 });
    run(w, p, 0.5);
    assert.equal(w.villagers.filter((v) => v.activity === 'awe').length, 0);
  });
});

describe('riding the god\'s palm', () => {
  function inviteWorld(seed: number): { w: World; p: GodPresence } {
    const w = calmWorld(seed, 0.2, 0.0);
    w.villagers[0].beliefs.faith = 0.9; // only the faithful one climbs
    const p = makePresence();
    hand(p, 'right', { x: 0.26, y: 0.02, z: 0.0, palmUp: true, tilt: 5 });
    return { w, p };
  }

  it('an open palm up beside the village invites the faithful aboard', () => {
    const { w, p } = inviteWorld(53);
    run(w, p, 6);
    const v = w.villagers[0];
    assert.equal(v.ride, 'ride');
    assert.equal(v.activity, 'ride');
    assert.ok(w.villagers.slice(1).every((x) => x.ride === 'none'), 'the faithless stay off');
  });

  it('riders follow the hand and hop off onto the job they are set down on', () => {
    const { w, p } = inviteWorld(54);
    const bus = new EventBus();
    const drops: string[] = [];
    bus.on('villager.dropped', (e) => drops.push(e.buildingId ?? ''));
    run(w, p, 6, bus);
    const v = w.villagers[0];
    assert.equal(v.ride, 'ride');
    const before = { ...v.beliefs };
    // Lift, carry over a field, set down.
    const field = w.buildings.find((b) => b.kind === 'field')!;
    hand(p, 'right', { x: 0.2, y: 0.15, z: 0.0, palmUp: true, tilt: 5 });
    run(w, p, 0.3, bus);
    assert.ok(v.rideLifted);
    hand(p, 'right', { x: field.pos.x, y: 0.15, z: field.pos.z, palmUp: true, tilt: 5 });
    run(w, p, 0.2, bus);
    assert.ok(Math.abs(v.pos.x - field.pos.x) < 0.03, 'rider moved with the hand');
    hand(p, 'right', { x: field.pos.x, y: 0.02, z: field.pos.z, palmUp: true, tilt: 5 });
    run(w, p, 0.3, bus);
    assert.equal(v.ride, 'none');
    assert.equal(v.activity, 'farm');
    assert.ok(Math.abs(v.beliefs.faith - (before.faith + PRESENCE.rideFaith)) < 1e-9);
    assert.ok(drops.includes(field.id), `drops: ${JSON.stringify(drops)} field ${field.id}`);
    assert.equal(w.sessionCounts.ride, 1);
  });

  it('riders set down on a job get to work instead of climbing straight back on', () => {
    const { w, p } = inviteWorld(62);
    run(w, p, 6);
    const v = w.villagers[0];
    assert.equal(v.ride, 'ride');
    const field = w.buildings.find((b) => b.kind === 'field')!;
    hand(p, 'right', { x: field.pos.x, y: 0.15, z: field.pos.z, palmUp: true, tilt: 5 });
    run(w, p, 0.3);
    hand(p, 'right', { x: field.pos.x, y: 0.02, z: field.pos.z, palmUp: true, tilt: 5 });
    run(w, p, 0.3);
    assert.equal(v.ride, 'none');
    // The open palm stays on the field, still inviting.
    run(w, p, 5);
    assert.equal(v.ride, 'none', 'climbed back on while committed to the job');
    assert.equal(v.activity, 'farm');
  });

  it('tilting the hand tips them off: they land dazed and lose a little Faith', () => {
    const { w, p } = inviteWorld(55);
    run(w, p, 6);
    const v = w.villagers[0];
    const faith = v.beliefs.faith;
    hand(p, 'right', { x: 0.2, y: 0.15, z: 0.0, palmUp: true, tilt: 70 });
    run(w, p, 0.2);
    assert.equal(v.ride, 'fall');
    run(w, p, PRESENCE.fallSeconds + 0.2);
    assert.equal(v.ride, 'none');
    assert.equal(v.activity, 'daze');
    assert.ok(Math.abs(v.beliefs.faith - (faith + PRESENCE.fallFaith)) < 1e-9);
    assert.ok(Math.hypot(v.pos.x, v.pos.z) <= RULES.village.radius, 'landed on the diorama');
  });

  it('losing hand tracking lets riders hop down calmly, without a daze', () => {
    const { w, p } = inviteWorld(56);
    run(w, p, 6);
    const v = w.villagers[0];
    const faith = v.beliefs.faith;
    p.hands.right.present = false;
    run(w, p, PRESENCE.fallSeconds + 0.3);
    assert.equal(v.ride, 'none');
    assert.notEqual(v.activity, 'daze');
    assert.equal(v.beliefs.faith, faith);
  });

  it('riders on a hand resting on the table hop off by themselves after a while', () => {
    const { w, p } = inviteWorld(63);
    run(w, p, 6);
    const v = w.villagers[0];
    assert.equal(v.ride, 'ride');
    run(w, p, PRESENCE.restingDismountSeconds + 1);
    assert.equal(v.ride, 'none');
    assert.notEqual(v.activity, 'daze', 'a gentle hop, not a fall');
  });

  it('never carries more than three riders', () => {
    const w = calmWorld(57, 0.2, 0.0);
    for (const v of w.villagers) v.beliefs.faith = 1;
    const p = makePresence();
    hand(p, 'right', { x: 0.24, y: 0.02, z: 0.0, palmUp: true, tilt: 5 });
    run(w, p, 10);
    assert.ok(w.villagers.filter((v) => v.ride !== 'none').length <= PRESENCE.maxRiders);
  });
});

describe('hide-and-seek', () => {
  it('the curious hide behind a resting hand and cheer when it is lifted', () => {
    const w = calmWorld(58, 0.1, 0.1);
    for (const v of w.villagers) v.beliefs.initiative = 0.9;
    for (const v of w.villagers) v.beliefs.faith = 0; // nobody climbs
    // Busy them in place so they do not wander off: dependent-like idle via commit.
    const p = makePresence();
    p.headPresent = true;
    p.head = { x: 0, y: 0.5, z: 0.6 };
    const bus = new EventBus();
    let found = 0;
    bus.on('hideseek.found', (e) => (found = e.count));
    hand(p, 'right', { x: 0.1, y: 0.02, z: 0.12 });
    run(w, p, 8, bus);
    const hiding = w.villagers.filter((v) => v.hide === 'hiding');
    assert.ok(hiding.length > 0, 'somebody hid');
    assert.ok(hiding.length <= PRESENCE.maxHiders);
    // They hide on the far side of the hand from the god's eyes (smaller z).
    for (const v of hiding) assert.ok(v.pos.z < 0.12, `hid at z=${v.pos.z}`);
    hand(p, 'right', { x: 0.1, y: 0.2, z: 0.12, speed: 1, still: false });
    run(w, p, 0.2, bus);
    assert.equal(found, hiding.length);
    assert.ok(hiding.every((v) => v.hide === 'none' && v.activity === 'cheer'));
    assert.ok(w.chronicle.some((e) => e.kind === 'found'));
  });
});

describe('waving back', () => {
  it('a wave makes the village wave back; raised hands make it cheer', () => {
    const w = calmWorld(59, 0.0, 0.0);
    const p = makePresence();
    p.waveCount = 1;
    run(w, p, 0.2);
    assert.ok(w.villagers.every((v) => v.activity === 'wave'));
    run(w, p, PRESENCE.reactSeconds + 0.5);
    assert.ok(w.villagers.every((v) => v.activity !== 'wave'), 'waving ends');
    p.cheerCount = 1;
    run(w, p, 0.2);
    assert.ok(w.villagers.every((v) => v.activity === 'cheer'));
    assert.ok(w.chronicle.some((e) => e.kind === 'waved'));
    assert.ok(w.chronicle.some((e) => e.kind === 'cheered'));
  });
});

describe('divine title', () => {
  it('names the god from how they played this session', () => {
    const w = createWorld(60);
    assert.equal(divineTitle(w), TITLES.distant);
    for (const v of w.villagers) {
      v.beliefs.faith = 0.8;
      v.beliefs.initiative = 0.4;
    }
    w.sessionCounts = { lift: 1, ride: 0, bless: 0, rain: 3, shelter: 2 };
    assert.equal(divineTitle(w), TITLES.storm);
    w.sessionCounts = { lift: 0, ride: 0, bless: 5, rain: 1, shelter: 0 };
    assert.equal(divineTitle(w), TITLES.gentle);
    w.sessionCounts = { lift: 3, ride: 3, bless: 1, rain: 1, shelter: 0 };
    assert.equal(divineTitle(w), TITLES.lifter);
    for (const v of w.villagers) v.beliefs.initiative = 0.78;
    assert.equal(divineTitle(w), TITLES.balanced);
  });

  it('is chronicled at dusk when it changes', () => {
    const w = createWorld(61);
    const total = RULES.session.daySeconds.reduce((a, b) => a + b, 0);
    const p = makePresence();
    run(w, p, total + 1);
    assert.equal(w.title, TITLES.distant);
    assert.ok(w.chronicle.some((e) => e.kind === 'title' && e.text.includes(TITLES.distant)));
  });
});
