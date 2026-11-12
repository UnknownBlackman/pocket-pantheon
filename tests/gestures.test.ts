import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GESTURES } from '../src/sim/rules.ts';
import {
  atChestHeight,
  inPalmBand,
  isOpenHand,
  isPalmDown,
  isPalmFacing,
  isPokePose,
  palmCenter,
  palmNormal,
  pinchDistance,
  updatePinch,
  wristsApartForShelter,
} from '../src/xr/gestures.ts';
import type { V3 } from '../src/xr/gestures.ts';
import { makeHand } from './hands.ts';

const v = (): V3 => ({ x: 0, y: 0, z: 0 });

describe('pinch', () => {
  it('detects a pinch and an open hand by thumb-index distance', () => {
    assert.ok(pinchDistance(makeHand({ pinch: true })) < GESTURES.pinchStart);
    assert.ok(pinchDistance(makeHand()) > GESTURES.pinchRelease);
  });

  it('uses hysteresis so the pinch does not flicker', () => {
    const mid = (GESTURES.pinchStart + GESTURES.pinchRelease) / 2;
    assert.equal(updatePinch(false, mid), false, 'does not start between thresholds');
    assert.equal(updatePinch(true, mid), true, 'does not release between thresholds');
    assert.equal(updatePinch(false, GESTURES.pinchStart * 0.5), true);
    assert.equal(updatePinch(true, GESTURES.pinchRelease * 1.2), false);
  });
});

describe('poke', () => {
  it('index out, others curled is a poke', () => {
    assert.ok(isPokePose(makeHand({ fingers: ['ext', 'curl', 'curl', 'curl'] })));
  });
  it('an open hand or a fist is not a poke', () => {
    assert.ok(!isPokePose(makeHand()));
    assert.ok(!isPokePose(makeHand({ fingers: ['curl', 'curl', 'curl', 'curl'] })));
  });
});

describe('palm down', () => {
  for (const handedness of ['right', 'left'] as const) {
    it(`${handedness} open hand facing down is palm-down`, () => {
      const j = makeHand({ handedness });
      const n = palmNormal(j, handedness, v());
      assert.ok(n.y < -0.9, `normal y ${n.y}`);
      assert.ok(isPalmDown(j, n));
    });
    it(`${handedness} hand with palm up is not palm-down`, () => {
      const j = makeHand({ handedness, roll: Math.PI });
      const n = palmNormal(j, handedness, v());
      assert.ok(n.y > 0.9, `normal y ${n.y}`);
      assert.ok(!isPalmDown(j, n));
    });
  }
  it('a fist facing down is not palm-down', () => {
    const j = makeHand({ fingers: ['curl', 'curl', 'curl', 'curl'] });
    assert.ok(!isOpenHand(j));
    assert.ok(!isPalmDown(j, palmNormal(j, 'right', v())));
  });
  it('palm height band is 5 to 30 cm', () => {
    assert.ok(inPalmBand(0.1));
    assert.ok(!inPalmBand(0.02));
    assert.ok(!inPalmBand(0.5));
  });
});

describe('two hands', () => {
  it('wrists 10-25 cm apart qualify for shelter', () => {
    const a = makeHand({ at: [-0.08, 1, -0.4] });
    const b = makeHand({ handedness: 'left', at: [0.08, 1, -0.4] });
    assert.ok(wristsApartForShelter(a, b));
    const far = makeHand({ handedness: 'left', at: [0.4, 1, -0.4] });
    assert.ok(!wristsApartForShelter(a, far));
  });

  it('palm facing the head at chest height is the pause pose', () => {
    // Fingers up, palm towards +Z (the player sits at +Z looking down -Z).
    const j = makeHand({ pitch: Math.PI / 2, roll: Math.PI, at: [0.1, 1.2, -0.35] });
    const palm = palmCenter(j, v());
    const n = palmNormal(j, 'right', v());
    const head = { x: 0, y: 1.55, z: 0 };
    assert.ok(n.z > 0.9, `normal z ${n.z}`);
    assert.ok(isPalmFacing(j, palm, n, head));
    assert.ok(atChestHeight(palm.y, head.y));
    const away = makeHand({ pitch: Math.PI / 2, at: [0.1, 1.2, -0.35] });
    assert.ok(!isPalmFacing(away, palmCenter(away, v()), palmNormal(away, 'right', v()), head));
  });
});

describe('wave', () => {
  it('a side-to-side wave is detected; a slow drift or tiny jitter is not', async () => {
    const { WaveDetector } = await import('../src/xr/gestures.ts');
    const dt = 1 / 60;
    const wave = new WaveDetector();
    let waved = false;
    for (let i = 0; i < 90 && !waved; i++) waved = wave.update(Math.sin(i * dt * Math.PI * 4) * 0.06, dt);
    assert.ok(waved, 'two full waves per second, 6 cm swing');

    const drift = new WaveDetector();
    let drifted = false;
    for (let i = 0; i < 120; i++) drifted ||= drift.update(i * dt * 0.2, dt);
    assert.ok(!drifted, 'a slow drift is not a wave');

    const jitter = new WaveDetector();
    let jittered = false;
    for (let i = 0; i < 120; i++) jittered ||= jitter.update(Math.sin(i) * 0.01, dt);
    assert.ok(!jittered, 'tracking jitter is not a wave');
  });
});
