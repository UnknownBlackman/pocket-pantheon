import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { blessBuilding, blessVillager, rain, shelter } from '../src/sim/powers.ts';
import { RULES } from '../src/sim/rules.ts';
import { createWorld, runFor, setWeather } from '../src/sim/world.ts';

describe('bless', () => {
  it('raises faith, lowers initiative and spends 1 Favor', () => {
    const w = createWorld(20);
    const v = w.villagers[0];
    const { faith, initiative } = v.beliefs;
    assert.ok(blessVillager(w, v.id));
    assert.ok(Math.abs(v.beliefs.faith - (faith + RULES.beliefs.blessVillagerFaith)) < 1e-9);
    assert.ok(Math.abs(v.beliefs.initiative - (initiative + RULES.beliefs.blessVillagerInitiative)) < 1e-9);
    assert.equal(w.favor, RULES.favor.start - RULES.powers.blessCost);
  });

  it('fails without Favor and changes nothing', () => {
    const w = createWorld(21);
    w.favor = 0.5;
    const v = w.villagers[0];
    const before = { ...v.beliefs };
    assert.equal(blessVillager(w, v.id), false);
    assert.deepEqual(v.beliefs, before);
    assert.equal(w.favor, 0.5);
  });

  it('a blessed building boosts work for 20 s', () => {
    const w = createWorld(22);
    const field = w.buildings.find((b) => b.kind === 'field')!;
    assert.ok(blessBuilding(w, field.id));
    assert.equal(field.blessed, RULES.powers.blessSeconds);
    runFor(w, RULES.powers.blessSeconds + 1);
    assert.equal(field.blessed, 0);
  });
});

describe('rain', () => {
  it('refills fields in range, costs 2 Favor and keeps them wet for 30 s', () => {
    const w = createWorld(23);
    setWeather(w, 'drought');
    const fields = w.buildings.filter((b) => b.kind === 'field');
    for (const f of fields) f.water = 0;
    const target = fields[0];
    assert.ok(rain(w, target.pos.x, target.pos.z));
    assert.equal(w.favor, RULES.favor.start - RULES.powers.rainCost);
    assert.equal(target.water, 1);
    const far = fields.find((f) => Math.hypot(f.pos.x - target.pos.x, f.pos.z - target.pos.z) > RULES.powers.rainRadius)!;
    assert.equal(far.water, 0, 'field out of range stays dry');
    runFor(w, RULES.powers.rainSeconds - 1);
    assert.equal(target.water, 1, 'still watered during the rain');
    runFor(w, 20);
    assert.ok(target.water < 1, 'dries again after the rain');
    assert.equal(w.effects.filter((e) => e.kind === 'rain').length, 0);
  });

  it('fails without Favor', () => {
    const w = createWorld(24);
    w.favor = 1;
    assert.equal(rain(w, 0, 0.19), false);
    assert.equal(w.effects.length, 0);
  });
});

describe('shelter', () => {
  it('blocks storm panic for villagers inside it for 15 s', () => {
    const run = (sheltered: boolean): number => {
      const w = createWorld(25);
      setWeather(w, 'storm');
      w.favor = 10;
      for (const v of w.villagers) {
        v.pos = { x: 0, z: 0 };
        v.beliefs.initiative = 0.1; // idle in place so they stay inside
      }
      if (sheltered) assert.ok(shelter(w, 0, 0));
      runFor(w, RULES.powers.shelterSeconds - 1);
      return w.stats.panics;
    };
    assert.equal(run(true), 0, 'sheltered villagers panicked');
    assert.ok(run(false) > 0, 'unsheltered villagers never panicked');
  });

  it('expires after 15 s and costs 2 Favor', () => {
    const w = createWorld(26);
    assert.ok(shelter(w, 0, 0));
    assert.equal(w.favor, RULES.favor.start - RULES.powers.shelterCost);
    runFor(w, RULES.powers.shelterSeconds + 0.5);
    assert.equal(w.effects.length, 0);
  });
});
