import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { completeStep, currentHint, tutorialComplete } from '../src/sim/tutorial.ts';
import { createWorld, setWeather } from '../src/sim/world.ts';

describe('tutorial', () => {
  it('teaches lift, bless and gaze in order, driven by actions', () => {
    const w = createWorld(30);
    assert.equal(currentHint(w)?.step, 'lift');
    completeStep(w, 'lift');
    assert.equal(currentHint(w)?.step, 'bless');
    completeStep(w, 'bless');
    assert.equal(currentHint(w)?.step, 'gaze');
  });

  it('waits for the drought before teaching rain, and the storm for shelter', () => {
    const w = createWorld(31);
    for (const s of ['lift', 'bless', 'gaze'] as const) completeStep(w, s);
    assert.equal(currentHint(w), null, 'no hint while waiting for the drought');
    setWeather(w, 'drought');
    assert.equal(currentHint(w)?.step, 'rain');
    completeStep(w, 'rain');
    assert.equal(currentHint(w), null);
    setWeather(w, 'storm');
    assert.equal(currentHint(w)?.step, 'shelter');
    completeStep(w, 'shelter');
    assert.equal(currentHint(w)?.step, 'complete');
    assert.ok(tutorialComplete(w));
  });

  it('counts a power used early once its step is reached', () => {
    const w = createWorld(32);
    assert.equal(completeStep(w, 'bless'), true);
    assert.equal(completeStep(w, 'bless'), false, 'only once');
    assert.equal(currentHint(w)?.step, 'lift');
    completeStep(w, 'lift');
    assert.equal(currentHint(w)?.step, 'gaze');
  });
});
