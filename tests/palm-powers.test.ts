import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GESTURES } from '../src/sim/rules.ts';
import { choosePalmPower, palmQualifies } from '../src/xr/palm-powers.ts';
import type { PalmInput } from '../src/xr/palm-powers.ts';

const palm = (over: Partial<PalmInput> = {}): PalmInput => ({
  tracked: true,
  trackedFor: 5,
  palmDown: true,
  speed: 0,
  height: 0.12,
  distance: 0.1,
  overField: false,
  ...over,
});
const away = palm({ tracked: false });

describe('palm powers', () => {
  it('a flat, still palm over a field asks for Rain; over open ground, one-hand Shelter', () => {
    assert.equal(choosePalmPower(away, palm({ overField: true }), false, false).mode, 'rain');
    assert.equal(choosePalmPower(away, palm({ overField: true }), false, false).hold, GESTURES.rainHoldSeconds);
    const s = choosePalmPower(palm(), away, false, false);
    assert.equal(s.mode, 'shelter1');
    assert.equal(s.hand, 'left');
    assert.equal(s.hold, GESTURES.shelterOneHandHoldSeconds);
  });

  it('two qualifying palms with wrists apart ask for Shelter, over Rain', () => {
    const c = choosePalmPower(palm({ overField: true }), palm({ overField: true }), true, false);
    assert.equal(c.mode, 'shelter2');
  });

  it('rejects hands that are tilted, moving, too high, too low, outside the village or just appeared', () => {
    assert.ok(!palmQualifies(palm({ palmDown: false })));
    assert.ok(!palmQualifies(palm({ speed: GESTURES.palmMaxSpeed * 1.5 })));
    assert.ok(!palmQualifies(palm({ height: GESTURES.palmMaxHeight + 0.02 })));
    assert.ok(!palmQualifies(palm({ height: GESTURES.palmMinHeight - 0.02 })));
    assert.ok(!palmQualifies(palm({ distance: 0.5 })));
    assert.ok(!palmQualifies(palm({ trackedFor: GESTURES.palmArmSeconds / 2 })));
    assert.ok(palmQualifies(palm()));
  });

  it('nothing fires while something else is going on', () => {
    assert.equal(choosePalmPower(palm({ overField: true }), palm(), true, true).mode, 'none');
  });

  it('the tightened thresholds hold', () => {
    assert.ok(GESTURES.palmDownDot <= -0.85, 'palm must face down within ~32 degrees');
    assert.ok(GESTURES.palmMaxSpeed <= 0.08);
    assert.ok(GESTURES.rainHoldSeconds >= 0.8);
    assert.ok(GESTURES.shelterOneHandHoldSeconds >= 2);
  });
});
