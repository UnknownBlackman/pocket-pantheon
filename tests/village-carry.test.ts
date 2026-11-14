import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { carryReleased, handSpread, liftPose } from '../src/xr/village-carry.ts';
import type { CarryHand } from '../src/xr/village-carry.ts';

const R = 0.3;
const centre = { x: 0, y: 0.75, z: -0.5 };

function hand(x: number, z: number, over: Partial<CarryHand> = {}): CarryHand {
  return {
    tracked: true,
    open: true,
    palm: { x, y: centre.y + 0.02, z },
    normal: { x: 0, y: 1, z: 0 },
    palmSpeed: 0,
    ...over,
  };
}

describe('lifting the village', () => {
  it('needs both palms up at opposite edges', () => {
    const l = hand(-0.31, -0.5);
    const r = hand(0.31, -0.5);
    assert.ok(liftPose(l, r, centre, R));
    assert.ok(!liftPose(l, hand(-0.31, -0.45), centre, R), 'same side');
    assert.ok(!liftPose(l, hand(0.05, -0.5), centre, R), 'one hand in the middle');
    assert.ok(!liftPose(l, hand(0.31, -0.5, { normal: { x: 0, y: -1, z: 0 } }), centre, R), 'palm down');
    assert.ok(!liftPose(l, hand(0.31, -0.5, { palmSpeed: 0.5 }), centre, R), 'moving');
    assert.ok(!liftPose(l, hand(0.31, -0.5, { open: false }), centre, R), 'closed hand');
    const high = hand(0.31, -0.5);
    high.palm.y = centre.y + 0.3;
    assert.ok(!liftPose(l, high, centre, R), 'hand held high above');
  });

  it('lets go when a palm turns over or the hands spread', () => {
    const l = hand(-0.31, -0.5);
    const r = hand(0.31, -0.5);
    const spread = handSpread(l, r);
    assert.ok(!carryReleased(l, r, spread));
    assert.ok(carryReleased(l, hand(0.31, -0.5, { normal: { x: 0, y: -1, z: 0 } }), spread));
    assert.ok(carryReleased(l, hand(0.6, -0.5), spread));
    assert.ok(carryReleased(l, hand(0.31, -0.5, { tracked: false }), spread));
  });
});
