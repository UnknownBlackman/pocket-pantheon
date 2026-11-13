import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EventBus } from '../src/core/events.ts';
import { aliveCount, endOfYear, hurt, isChild, kill, villagerScale } from '../src/sim/life.ts';
import { LIFE, RULES } from '../src/sim/rules.ts';
import { createWorld, makeVillager, runFor } from '../src/sim/world.ts';

describe('births and children', () => {
  it('a child is born at day end when food is plentiful, small and playing near family', () => {
    let born = false;
    for (let seed = 1; seed < 20 && !born; seed++) {
      const w = createWorld(seed);
      w.food = 90;
      const bus = new EventBus();
      let event = '';
      bus.on('villager.born', (e) => (event = `${e.name} to ${e.parents.join(' and ')}`));
      const r = endOfYear(w, makeVillager, bus);
      if (!r.born.length) continue;
      born = true;
      const child = w.villagers[w.villagers.length - 1];
      assert.equal(child.age, 0);
      assert.ok(isChild(child));
      assert.equal(child.parents.length, 2);
      assert.ok(event.includes(child.name));
      assert.ok(w.chronicle.some((e) => e.kind === 'born' && e.text.includes(child.name)));
      assert.ok(villagerScale(child.age) < 0.7);
      runFor(w, 20);
      assert.notEqual(child.activity, 'farm');
      assert.notEqual(child.activity, 'pray');
    }
    assert.ok(born, 'no birth in 20 seeds');
  });

  it('no births at the population cap of 14', () => {
    const w = createWorld(2);
    while (w.villagers.length < RULES.village.maxVillagers) {
      w.villagers.push(makeVillager(w, w.villagers.length));
    }
    w.food = 100;
    for (let i = 0; i < 10; i++) endOfYear(w, makeVillager);
    assert.ok(aliveCount(w) <= RULES.village.maxVillagers);
  });

  it('children come of age at 13', () => {
    const w = createWorld(3);
    const v = w.villagers[1];
    v.age = LIFE.adultAge - 1;
    endOfYear(w, makeVillager);
    assert.equal(v.age, LIFE.adultAge);
    assert.ok(!isChild(v));
    assert.ok(w.chronicle.some((e) => e.kind === 'came-of-age'));
  });
});

describe('death', () => {
  it('the very old die of old age, get a grave and are mourned', () => {
    const w = createWorld(4);
    const bus = new EventBus();
    let died = '';
    bus.on('villager.died', (e) => (died = `${e.name} ${e.cause}`));
    const v = w.villagers[2];
    v.age = 90;
    for (const o of w.villagers) o.pos = { ...v.pos }; // everyone close by
    endOfYear(w, makeVillager, bus);
    assert.ok(v.dead);
    assert.equal(v.deathCause, 'old age');
    assert.equal(died, `${v.name} old age`);
    assert.equal(w.graves.length, 1);
    assert.ok(w.chronicle.some((e) => e.kind === 'died' && e.text.includes(v.name)));
    assert.ok(w.villagers.some((o) => !o.dead && o.activity === 'mourn'));
  });

  it("starving too long is fatal and shakes the village's faith", () => {
    const w = createWorld(5);
    w.food = 0;
    // Parched fields: no harvest can refill the store.
    for (const b of w.buildings) b.water = 0;
    w.weather = 'drought';
    const v = w.villagers[3];
    v.needs.hunger = 1;
    const faith = w.villagers[4].beliefs.faith;
    runFor(w, LIFE.starveSeconds + 5);
    assert.ok(v.dead);
    assert.equal(v.deathCause, 'starvation');
    assert.ok(w.villagers[4].beliefs.faith < faith);
  });

  it('the dead stay put and no longer act', () => {
    const w = createWorld(6);
    const v = w.villagers[1];
    kill(w, v, 'lightning');
    const pos = { ...v.pos };
    runFor(w, 10);
    assert.deepEqual(v.pos, pos);
    assert.equal(v.activity, 'dead');
    assert.equal(aliveCount(w), RULES.village.startVillagers - 1);
  });

  it("the god's hand only hurts: a daze, then a limp that wears off", () => {
    const w = createWorld(7);
    const v = w.villagers[1];
    hurt(w, v);
    assert.equal(v.activity, 'daze');
    assert.equal(v.limp, LIFE.limpSeconds);
    assert.ok(!v.dead);
    runFor(w, LIFE.limpSeconds + 1);
    assert.equal(v.limp, 0);
  });
});
