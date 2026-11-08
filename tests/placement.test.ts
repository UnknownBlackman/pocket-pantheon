import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LAYOUT } from '../src/sim/rules.ts';
import {
  fallbackPosition,
  isTableHeight,
  pickTablePlane,
  pointInPolygon,
  polygonArea,
} from '../src/xr/placement.ts';

describe('placement helpers', () => {
  it('computes polygon area', () => {
    const square = [
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      { x: 1, z: 2 },
      { x: 0, z: 2 },
    ];
    assert.equal(polygonArea(square), 2);
  });

  it('tests points inside polygons', () => {
    const sq = [
      { x: -1, z: -1 },
      { x: 1, z: -1 },
      { x: 1, z: 1 },
      { x: -1, z: 1 },
    ];
    assert.ok(pointInPolygon(0, 0, sq));
    assert.ok(!pointInPolygon(2, 0, sq));
  });

  it('only picks reachable table spots in front, preferring one under the ahead spot', () => {
    const base = { horizontal: true, inFront: true, containsAhead: false, reach: 0.6, height: 0.75 };
    const floor = { ...base, height: 0, reach: 0.3 };
    const behind = { ...base, inFront: false, reach: 0.4 };
    const far = { ...base, reach: 1.6 };
    const near = { ...base, reach: 0.7 };
    const ahead = { ...base, reach: 0.8, containsAhead: true };
    assert.equal(pickTablePlane([floor, behind, far]), -1);
    assert.equal(pickTablePlane([floor, behind, far, near]), 3);
    assert.equal(pickTablePlane([near, ahead]), 1);
    const labelled = { ...base, height: 1.2, reach: 0.85, label: 'table' };
    assert.equal(pickTablePlane([ahead, labelled]), 1);
  });

  it('accepts table heights only', () => {
    assert.ok(isTableHeight(0.75));
    assert.ok(!isTableHeight(0.1));
    assert.ok(!isTableHeight(1.4));
  });

  it('puts the fallback platform 50 cm ahead and 25 cm below the eyes', () => {
    const p = fallbackPosition({ x: 0, y: 1.2, z: 0 }, 0);
    assert.ok(Math.abs(p.x) < 1e-9);
    assert.ok(Math.abs(p.y - (1.2 - LAYOUT.fallbackBelowEye)) < 1e-9);
    assert.ok(Math.abs(p.z + LAYOUT.fallbackForward) < 1e-9);
    const turned = fallbackPosition({ x: 0, y: 1.2, z: 0 }, Math.PI / 2); // facing -X
    assert.ok(Math.abs(turned.x + LAYOUT.fallbackForward) < 1e-9);
  });
});
