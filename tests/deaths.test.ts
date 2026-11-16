import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { updateLife } from '../src/sim/life.ts';
import { LIFE, RULES } from '../src/sim/rules.ts';
import { createWorld } from '../src/sim/world.ts';

const DT = 1 / RULES.sim.hz;

/** Everyone starving at once, in a clear day with the tutorial done. */
function famine(seed: number) {
  const w = createWorld(seed);
  w.guide = { step: 'done', active: false };
  w.phase = 'day';
  for (const v of w.villagers) {
    v.needs.hunger = 1;
    v.starving = LIFE.starveSeconds; // long past the limit
  }
  return w;
}

describe('deaths are rarer and never total', () => {
  it('one hunger death a day at most, the rest hang on', () => {
    const w = famine(90);
    updateLife(w, DT);
    const dead = w.villagers.filter((v) => v.dead).length;
    assert.equal(dead, 1);
    assert.equal(w.deathsToday, 1);
    assert.ok(w.villagers.filter((v) => !v.dead).every((v) => v.starving === 0));
  });

  it('Ama is never taken by hunger', () => {
    const w = famine(91);
    for (let i = 0; i < 50; i++) updateLife(w, DT);
    assert.equal(w.villagers[0].dead, false);
  });

  it('the village is never left with fewer than the protected adults', () => {
    const w = famine(92);
    w.deathsToday = 0;
    for (let day = 0; day < 20; day++) {
      w.deathsToday = 0; // a new day
      for (const v of w.villagers) if (!v.dead) v.starving = LIFE.starveSeconds;
      updateLife(w, DT);
    }
    const adults = w.villagers.filter((v) => !v.dead && v.age >= LIFE.adultAge).length;
    assert.ok(adults >= LIFE.protectedAdults, `adults left: ${adults}`);
  });

  it('a day with a death costs faith once, not once per death', () => {
    const w = famine(93);
    const before = w.villagers.map((v) => v.beliefs.faith);
    updateLife(w, DT);
    const dead = w.villagers.find((v) => v.dead)!;
    assert.ok(dead);
    // Each survivor lost exactly one neglect's worth of faith.
    w.villagers.forEach((v, i) => {
      if (v.dead) return;
      assert.ok(Math.abs(before[i] - v.beliefs.faith + LIFE.neglectFaith) < 1e-9, `${v.name} faith`);
    });
  });
});
