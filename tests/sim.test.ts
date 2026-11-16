import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EventBus } from '../src/core/events.ts';
import { dropVillager, liftVillager } from '../src/sim/powers.ts';
import { random } from '../src/sim/random.ts';
import { ageFatigue } from '../src/sim/age.ts';
import { RITUAL, RULES } from '../src/sim/rules.ts';
import type { Activity, World } from '../src/sim/types.ts';
import { createWorld, duskScore, runFor, tick } from '../src/sim/world.ts';

function assertInRange(world: World): void {
  for (const v of world.villagers) {
    for (const value of [v.needs.hunger, v.needs.fatigue, v.beliefs.faith, v.beliefs.initiative, v.mood]) {
      assert.ok(Number.isFinite(value) && value >= 0 && value <= 1, `${v.id} value out of range: ${value}`);
    }
    assert.ok(Number.isFinite(v.pos.x) && Number.isFinite(v.pos.z));
    assert.ok(Math.hypot(v.pos.x, v.pos.z) <= RULES.village.radius * Math.SQRT2 + 1e-6);
  }
  assert.ok(world.favor >= 0 && world.favor <= RULES.favor.max);
  assert.ok(world.food >= 0 && world.food <= 100);
}

describe('seeded randomness', () => {
  it('repeats the same sequence for the same seed', () => {
    const a = { rngState: 42 };
    const b = { rngState: 42 };
    for (let i = 0; i < 100; i++) assert.equal(random(a), random(b));
  });

  it('gives the same village after N ticks for the same seed', () => {
    const a = createWorld(7);
    const b = createWorld(7);
    runFor(a, 60);
    runFor(b, 60);
    assert.deepEqual(a, b);
  });

  it('gives different villages for different seeds', () => {
    const a = createWorld(1);
    const b = createWorld(2);
    runFor(a, 30);
    runFor(b, 30);
    assert.notDeepEqual(a.villagers.map((v) => v.pos), b.villagers.map((v) => v.pos));
  });
});

describe('starting village', () => {
  it('has 8 villagers, 3 fields, 3 huts, 1 shrine and Favor 3', () => {
    const w = createWorld(1);
    assert.equal(w.villagers.length, RULES.village.startVillagers);
    const count = (k: string) => w.buildings.filter((b) => b.kind === k).length;
    assert.equal(count('field'), 3);
    assert.equal(count('hut'), 3);
    assert.equal(count('shrine'), 1);
    assert.equal(w.favor, 3);
  });
});

describe('ten simulated minutes', () => {
  it('villagers farm, rest and pray without errors', () => {
    const w = createWorld(3);
    const seen = new Set<Activity>();
    const dt = 1 / RULES.sim.hz;
    for (let i = 0; i < 10 * 60 * RULES.sim.hz; i++) {
      tick(w, dt);
      for (const v of w.villagers) seen.add(v.activity);
      if (i % 100 === 0) assertInRange(w);
    }
    assertInRange(w);
    assert.ok(seen.has('farm'), 'nobody farmed');
    assert.ok(seen.has('rest'), 'nobody rested');
    assert.ok(seen.has('pray'), 'nobody prayed');
    assert.ok(seen.has('walk'), 'nobody walked');
    assert.ok(w.totals.harvests > 0, 'no harvests');
    assert.ok(w.totals.prayers > 0, 'no prayers');
  });

  it('reaches dusk after three days and then ends', () => {
    const w = createWorld(4);
    const total = RULES.session.daySeconds.reduce((a, b) => a + b, 0);
    runFor(w, total + 1);
    assert.equal(w.phase, 'dusk');
    assert.ok(w.chronicle.some((e) => e.kind === 'dusk'));
    runFor(w, RULES.session.duskSeconds + 1);
    assert.equal(w.phase, 'ended');
    const { stars } = duskScore(w);
    assert.ok(stars >= 1 && stars <= 5);
  });
});

describe('needs', () => {
  it('hunger and fatigue grow at the tuned daytime rates', () => {
    const w = createWorld(5);
    const v = w.villagers[0];
    v.beliefs.initiative = 0.1; // dependent: idles, so nothing satisfies needs
    v.needs.hunger = 0;
    v.needs.fatigue = 0;
    runFor(w, 10);
    assert.ok(Math.abs(v.needs.hunger - 10 * RULES.needs.hungerPerSecond) < 1e-6);
    // Elder Ama tires sooner with age (sim/age.ts).
    assert.ok(Math.abs(v.needs.fatigue - 10 * RULES.needs.fatiguePerSecond * ageFatigue(v.age)) < 1e-6);
  });

  it('carried villagers do not change needs', () => {
    const w = createWorld(5);
    const v = w.villagers[1];
    liftVillager(w, v.id);
    const needs = { ...v.needs };
    runFor(w, 10);
    assert.deepEqual(v.needs, needs);
  });

  it('a dependent villager idles until lifted', () => {
    const w = createWorld(6);
    const v = w.villagers[0];
    v.beliefs.initiative = 0.1;
    v.needs.hunger = 0.9;
    runFor(w, 20);
    assert.equal(v.intent, 'idle');
    assert.equal(v.activity, 'idle');
    // Lift and drop on a field: they farm despite being dependent.
    const field = w.buildings.find((b) => b.kind === 'field')!;
    liftVillager(w, v.id);
    dropVillager(w, v.id, field.pos.x, field.pos.z);
    runFor(w, 2);
    assert.equal(v.activity, 'farm');
  });
});

describe('weather and chronicle', () => {
  it('the first session has a drought on day 2 that dries fields and is chronicled', () => {
    const w = createWorld(8);
    const bus = new EventBus();
    const weathers: string[] = [];
    bus.on('weather.changed', (p) => weathers.push(p.weather));
    runFor(w, RULES.session.daySeconds[0] + 1, bus);
    assert.equal(w.sessionDay, 1);
    assert.equal(w.weather, 'drought');
    assert.deepEqual(weathers, ['drought']);
    assert.ok(w.chronicle.some((e) => e.kind === 'drought'));
    // Let the drought work with nobody farming the fields.
    for (const v of w.villagers) v.carried = true;
    runFor(w, 60, bus);
    const fields = w.buildings.filter((b) => b.kind === 'field');
    assert.ok(fields.every((f) => f.water < RULES.farming.dryBelow), 'fields not dry');
    const dried = w.chronicle.find((e) => e.kind === 'fields-dried');
    assert.ok(dried, 'no fields-dried entry');
    assert.match(dried!.text, /^Day 2: the fields dried up/);
  });

  it('day 3 of the first session is a storm', () => {
    const w = createWorld(9);
    runFor(w, RULES.session.daySeconds[0] + RULES.session.daySeconds[1] + 1);
    assert.equal(w.weather, 'storm');
    assert.ok(w.chronicle.some((e) => e.kind === 'storm'));
  });
});

describe('lift and drop', () => {
  it('dropping on a field farms, on a hut rests, on the shrine prays', () => {
    const w = createWorld(10);
    const expect: Record<string, Activity> = { field: 'farm', hut: 'rest', shrine: 'pray' };
    for (const [kind, activity] of Object.entries(expect)) {
      const v = w.villagers[0];
      const b = w.buildings.find((x) => x.kind === kind)!;
      const before = v.beliefs.initiative;
      assert.ok(liftVillager(w, v.id));
      dropVillager(w, v.id, b.pos.x + 0.01, b.pos.z);
      assert.equal(v.activity, activity, `drop on ${kind}`);
      assert.ok(Math.abs(v.beliefs.initiative - (before + RULES.beliefs.liftInitiative)) < 1e-9);
      assert.ok(v.reaction === 'bow' || v.reaction === 'cheer', 'a bow or cheer to the god first');
      runFor(w, RITUAL.dropGreetSeconds + 1);
      assert.equal(v.activity, activity, `${activity} after the greeting`);
    }
  });

  it('a lifted villager does not move or decide', () => {
    const w = createWorld(11);
    const v = w.villagers[2];
    liftVillager(w, v.id);
    const pos = { ...v.pos };
    runFor(w, 5);
    assert.deepEqual(v.pos, pos);
    assert.equal(v.carried, true);
  });
});

describe('ageing', () => {
  it('shows in life stages, pace and stamina', async () => {
    const { lifeStage, agePace } = await import('../src/sim/age.ts');
    assert.equal(lifeStage(5), 'child');
    assert.equal(lifeStage(30), 'adult');
    assert.equal(lifeStage(50), 'grey');
    assert.equal(lifeStage(60), 'elder');
    assert.ok(agePace(60) < agePace(50) && agePace(50) < agePace(30));
    assert.ok(ageFatigue(60) > ageFatigue(30));
  });
});
