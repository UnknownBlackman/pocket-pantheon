import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LAYOUT } from '../src/sim/rules.ts';
import {
  fallbackPosition,
  isTableHeight,
  pickTablePlane,
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

  it('prefers a labelled table, else the largest table-height horizontal plane', () => {
    const floor = { height: 0, area: 9, horizontal: true };
    const wall = { height: 0.8, area: 4, horizontal: false };
    const desk = { height: 0.75, area: 0.8, horizontal: true };
    const bench = { height: 0.45, area: 0.5, horizontal: true };
    assert.equal(pickTablePlane([floor, wall, desk, bench]), 2);
    const labelled = { height: 1.2, area: 0.3, horizontal: true, label: 'table' };
    assert.equal(pickTablePlane([floor, desk, labelled]), 2);
    assert.equal(pickTablePlane([floor, wall]), -1);
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
