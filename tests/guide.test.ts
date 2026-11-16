import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RULES } from '../src/sim/rules.ts';
import { greetGod } from '../src/sim/presence.ts';
import {
  activeLesson,
  GUIDE,
  guideAllows,
  guideEvent,
  guideStep,
  lessonEvent,
  LESSON_IDS,
  skipGuide,
  startGuide,
  updateLessons,
} from '../src/sim/tutorial.ts';
import { createWorld, runFor, setWeather } from '../src/sim/world.ts';

/** A world that has just finished the core guide. */
function afterGuide(seed: number) {
  const w = createWorld(seed);
  startGuide(w);
  guideEvent(w, { kind: 'inspected' });
  guideEvent(w, { kind: 'dropped', building: 'field1' });
  guideEvent(w, { kind: 'power', power: 'bless' });
  guideEvent(w, { kind: 'climbed' });
  return w;
}

describe('the core guide', () => {
  it('is four quick steps, driven by actions, holding the clock', () => {
    const w = createWorld(20);
    startGuide(w);
    assert.equal(GUIDE.length, 4);
    assert.equal(guideStep(w)?.id, 'welcome');
    runFor(w, 300);
    assert.equal(w.timeOfDay, 0, 'no time passes during the guide');
    assert.ok(guideEvent(w, { kind: 'inspected' }));
    assert.ok(!guideEvent(w, { kind: 'dropped', building: 'hut0' }), 'must be a field');
    assert.ok(guideEvent(w, { kind: 'dropped', building: 'field1' }));
    assert.equal(guideStep(w)?.id, 'bless');
    assert.ok(w.favor >= 6, 'Favor topped up for the blessing');
    guideEvent(w, { kind: 'power', power: 'bless' });
    guideEvent(w, { kind: 'climbed' });
    assert.equal(w.guide.active, false);
    assert.equal(w.guide.step, 'done');
    assert.ok(w.chronicle.some((e) => e.kind === 'guide'));
    runFor(w, 5);
    assert.ok(w.timeOfDay > 0, 'the day begins');
  });

  it("allows only the current step's action", () => {
    const w = createWorld(22);
    assert.ok(guideAllows(w, 'rain'), 'everything is allowed outside the guide');
    startGuide(w);
    assert.ok(!guideAllows(w, 'lift'), 'nothing but looking during the welcome');
    guideEvent(w, { kind: 'inspected' });
    assert.ok(guideAllows(w, 'lift'));
    assert.ok(!guideAllows(w, 'rain'));
    assert.ok(!guideAllows(w, 'hide'), 'no hide-and-seek during the guide');
  });

  it('a new god is greeted with waves', () => {
    const w = createWorld(23);
    assert.equal(greetGod(w), w.villagers.length);
    assert.ok(w.villagers.every((v) => v.activity === 'wave'));
  });
});

describe('lessons, just in time', () => {
  it('the drought brings the rain lesson, learned by raining', () => {
    const w = afterGuide(30);
    w.favor = 0;
    setWeather(w, 'drought');
    updateLessons(w, 0.1);
    assert.equal(activeLesson(w)?.id, 'rain');
    assert.ok(w.favor >= RULES.powers.rainCost, 'enough Favor to practise');
    assert.ok(guideAllows(w, 'shelter'), 'lessons hold nothing back');
    assert.ok(lessonEvent(w, { kind: 'power', power: 'rain' }));
    assert.equal(activeLesson(w), null);
    assert.ok(w.lessons.done.includes('rain'));
  });

  it('the storm teaches shelter, then calming the clouds', () => {
    const w = afterGuide(31);
    setWeather(w, 'storm');
    updateLessons(w, 0.1);
    assert.equal(activeLesson(w)?.id, 'shelter');
    lessonEvent(w, { kind: 'power', power: 'shelter' });
    updateLessons(w, 0.1);
    assert.equal(activeLesson(w)?.id, 'calm');
    lessonEvent(w, { kind: 'calmed' });
    assert.ok(w.lessons.done.includes('calm'));
  });

  it('waving comes after a little free play; ignored lessons fade', () => {
    const w = afterGuide(32);
    for (let i = 0; i < 600; i++) updateLessons(w, 0.1);
    assert.equal(activeLesson(w)?.id, 'wave');
    for (let i = 0; i < 500; i++) updateLessons(w, 0.1);
    assert.equal(activeLesson(w), null, 'faded after a while');
    assert.ok(w.lessons.done.includes('wave'));
  });

  it('the first dusk teaches pausing', () => {
    const w = afterGuide(33);
    w.lessons.done = ['rain', 'shelter', 'calm', 'wave'];
    w.phase = 'dusk';
    updateLessons(w, 0.1);
    assert.equal(activeLesson(w)?.id, 'pause');
    assert.ok(lessonEvent(w, { kind: 'paused' }));
  });

  it('skipping skips the lessons too', () => {
    const w = createWorld(21);
    startGuide(w);
    guideEvent(w, { kind: 'inspected' });
    skipGuide(w);
    assert.equal(w.guide.active, false);
    assert.equal(guideStep(w), null);
    assert.deepEqual([...w.lessons.done].sort(), [...LESSON_IDS].sort());
    setWeather(w, 'storm');
    updateLessons(w, 0.1);
    assert.equal(activeLesson(w), null);
  });
});
