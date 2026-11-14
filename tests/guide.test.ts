import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { STORM } from '../src/sim/rules.ts';
import { swatCloud } from '../src/sim/storm.ts';
import { GUIDE, guideAllows, guideEvent, guideField, guideStep, skipGuide, startGuide } from '../src/sim/tutorial.ts';
import { createWorld, runFor } from '../src/sim/world.ts';

describe('guided tutorial', () => {
  it('walks through every step in order, driven by actions, holding the clock', () => {
    const w = createWorld(20);
    startGuide(w);
    assert.equal(guideStep(w)?.id, 'welcome');
    runFor(w, 300);
    assert.equal(w.timeOfDay, 0, 'no time passes during the guide');
    assert.equal(w.graves.length, 0);

    assert.ok(guideEvent(w, { kind: 'inspected' }));
    assert.equal(guideStep(w)?.id, 'lift');
    assert.ok(!guideEvent(w, { kind: 'dropped', building: 'hut0' }), 'must be a field');
    assert.ok(guideEvent(w, { kind: 'dropped', building: 'field1' }));
    assert.equal(guideStep(w)?.id, 'bless');
    assert.ok(w.favor >= 6, 'Favor topped up for the powers');
    guideEvent(w, { kind: 'power', power: 'bless' });
    guideEvent(w, { kind: 'climbed' });
    assert.equal(guideStep(w)?.id, 'rain');
    assert.equal(guideField(w)!.water, 0, 'a field is dried for the lesson');
    guideEvent(w, { kind: 'power', power: 'rain' });
    assert.equal(guideStep(w)?.id, 'shelter');
    assert.equal(w.weather, 'storm', 'a practice storm');
    guideEvent(w, { kind: 'power', power: 'shelter' });
    assert.equal(guideStep(w)?.id, 'swat');
    for (let i = 0; i < STORM.clouds; i++) swatCloud(w, i);
    assert.ok(guideEvent(w, { kind: 'calmed' }));
    guideEvent(w, { kind: 'waved' });
    assert.equal(guideStep(w)?.id, 'pause');
    guideEvent(w, { kind: 'paused' });
    assert.equal(w.guide.active, false);
    assert.equal(w.guide.step, 'done');
    assert.ok(w.chronicle.some((e) => e.kind === 'guide'));
    runFor(w, 5);
    assert.ok(w.timeOfDay > 0, 'the day begins');
    assert.equal(GUIDE.length, 9);
  });

  it("allows only the current step's action", () => {
    const w = createWorld(22);
    assert.ok(guideAllows(w, 'rain'), 'everything is allowed outside the guide');
    startGuide(w);
    assert.ok(!guideAllows(w, 'lift'), 'nothing but looking during the welcome');
    guideEvent(w, { kind: 'inspected' });
    assert.ok(guideAllows(w, 'lift'));
    assert.ok(!guideAllows(w, 'rain'));
    assert.ok(!guideAllows(w, 'bless'));
    assert.ok(!guideAllows(w, 'hide'), 'no hide-and-seek during the guide');
  });

  it('can be skipped at any time', () => {
    const w = createWorld(21);
    startGuide(w);
    guideEvent(w, { kind: 'inspected' });
    skipGuide(w);
    assert.equal(w.guide.active, false);
    assert.equal(guideStep(w), null);
  });
});
