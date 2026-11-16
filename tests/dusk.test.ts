import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RULES } from '../src/sim/rules.ts';
import { createWorld, runFor } from '../src/sim/world.ts';

const S = RULES.session;

describe('the evening at dusk', () => {
  it('a short dance at the fire, then sitting round it, then home to bed', () => {
    const w = createWorld(80);
    w.guide = { step: 'done', active: false };
    w.phase = 'dusk';
    w.phaseTime = 0;
    for (const v of w.villagers) {
      v.decisionIn = 0;
      v.commit = 0;
    }
    // Dancing early on (once they have reached the fire).
    runFor(w, S.duskDanceFraction * S.duskSeconds * 0.9);
    assert.ok(w.villagers.some((v) => v.activity === 'cheer'), 'someone dances');
    // Then they sit.
    runFor(w, S.duskSeconds * (S.childBedFraction - S.duskDanceFraction) * 0.8);
    assert.ok(w.villagers.some((v) => v.activity === 'sit'), 'someone sits by the fire');
    assert.ok(w.villagers.every((v) => v.activity !== 'cheer'), 'the dancing has stopped');
    // By the end of dusk everyone is in bed.
    runFor(w, S.duskSeconds);
    for (const v of w.villagers) {
      assert.equal(v.intent, 'rest', `${v.name} went to bed`);
    }
    assert.ok(w.villagers.filter((v) => v.activity === 'rest').length >= w.villagers.length - 1, 'asleep at home');
  });
});
