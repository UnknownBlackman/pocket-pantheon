import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RULES } from '../src/sim/rules.ts';
import { coverSpot } from '../src/sim/villager.ts';
import { createWorld, runFor, setWeather, weatherForDay } from '../src/sim/world.ts';

function playable(seed: number) {
  const w = createWorld(seed);
  w.guide = { step: 'done', active: false };
  w.lessons = { active: null, done: ['rain', 'shelter', 'calm', 'wave', 'pause'], time: 0, free: 0 };
  return w;
}

describe('gentle weather', () => {
  it('after the first session, days bring rain and snow as well as fair weather', () => {
    const w = playable(60);
    w.session = 2;
    w.sessionDay = 1;
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(weatherForDay(w));
    for (const kind of ['clear', 'rain', 'snow', 'drought', 'storm']) assert.ok(seen.has(kind), kind);
  });

  it('the first session keeps its scripted days', () => {
    const w = playable(61);
    w.sessionDay = 1;
    assert.equal(weatherForDay(w), 'drought');
    w.sessionDay = 2;
    assert.equal(weatherForDay(w), 'storm');
  });

  it('rain waters every field', () => {
    const w = playable(62);
    for (const b of w.buildings) if (b.kind === 'field') b.water = 0;
    setWeather(w, 'rain');
    runFor(w, 1);
    assert.ok(w.buildings.filter((b) => b.kind === 'field').every((b) => b.water === 1));
    assert.ok(w.chronicle.some((e) => e.kind === 'rainy-day'));
  });

  it('snow settles, then melts, and the first snow is remembered', () => {
    const w = playable(63);
    setWeather(w, 'snow');
    runFor(w, RULES.weather.snowSettleSeconds + 1);
    assert.equal(w.snowCover, 1);
    assert.ok(w.chronicle.some((e) => e.kind === 'first-snow'));
    setWeather(w, 'clear');
    runFor(w, RULES.weather.snowMeltSeconds + 1);
    assert.equal(w.snowCover, 0);
  });

  it('snow does not make villagers hungrier', () => {
    const a = playable(64);
    const b = playable(64);
    setWeather(b, 'snow');
    for (const w of [a, b]) for (const v of w.villagers) v.needs.hunger = 0;
    runFor(a, 10);
    runFor(b, 10);
    const hungerA = a.villagers.map((v) => v.needs.hunger);
    const hungerB = b.villagers.map((v) => v.needs.hunger);
    hungerB.forEach((h, i) => assert.ok(h <= hungerA[i] + 1e-9, 'no extra hunger in snow'));
  });

  it('idle villagers take cover: eaves in rain, the fire in snow', () => {
    const w = playable(65);
    const v = w.villagers[1];
    setWeather(w, 'rain');
    const eaves = coverSpot(w, v)!;
    const hut = w.buildings.filter((b) => b.kind === 'hut').some((b) => Math.hypot(b.pos.x - eaves.x, b.pos.z - eaves.z) < 0.06);
    assert.ok(hut, 'under a cottage');
    setWeather(w, 'snow');
    const fire = w.buildings.find((b) => b.kind === 'campfire')!;
    const spot = coverSpot(w, v)!;
    assert.ok(Math.hypot(fire.pos.x - spot.x, fire.pos.z - spot.z) < 0.09, 'by the fire');
    setWeather(w, 'clear');
    assert.equal(coverSpot(w, v), null);
  });
});
