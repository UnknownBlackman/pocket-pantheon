import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { STORM } from '../src/sim/rules.ts';
import { stormStrength, swatCloud } from '../src/sim/storm.ts';
import { createWorld, runFor, setWeather } from '../src/sim/world.ts';

describe('swatting the storm', () => {
  it('each swat clears a cloud and costs a little Favor', () => {
    const w = createWorld(10);
    setWeather(w, 'storm');
    w.favor = 5;
    assert.equal(stormStrength(w), 1);
    assert.equal(swatCloud(w, 0), 'swatted');
    assert.ok(Math.abs(w.favor - (5 - STORM.swatCost)) < 1e-9);
    assert.ok(stormStrength(w) < 1);
    assert.equal(swatCloud(w, 0), 'gone', 'already swatted');
  });

  it('without Favor nothing happens', () => {
    const w = createWorld(11);
    setWeather(w, 'storm');
    w.favor = 0.1;
    assert.equal(swatCloud(w, 0), 'no-favor');
    assert.equal(stormStrength(w), 1);
  });

  it('clearing every cloud calms the storm early', () => {
    const w = createWorld(12);
    setWeather(w, 'storm');
    w.favor = 10;
    let last = '';
    for (let i = 0; i < STORM.clouds; i++) last = swatCloud(w, i);
    assert.equal(last, 'calmed');
    assert.equal(w.weather, 'clear');
    assert.ok(w.chronicle.some((e) => e.kind === 'calmed'));
  });

  it('swatted clouds regrow if the storm is not cleared', () => {
    const w = createWorld(13);
    setWeather(w, 'storm');
    w.favor = 10;
    swatCloud(w, 2);
    runFor(w, STORM.regrowSeconds + 1);
    assert.equal(w.stormClouds[2], 1);
  });
});
