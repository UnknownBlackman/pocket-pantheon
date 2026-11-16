import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fastForward } from '../src/sim/fastforward.ts';
import { kill } from '../src/sim/life.ts';
import { heroWelcome, makePresence, updatePresence } from '../src/sim/presence.ts';
import type { GodPresence } from '../src/sim/presence.ts';
import { addTraffic, hutTier, pathStones, tabletCarvings } from '../src/sim/progress.ts';
import { PRESENCE, PROGRESS, RITUAL, RULES } from '../src/sim/rules.ts';
import type { World } from '../src/sim/types.ts';
import { createWorld, tick } from '../src/sim/world.ts';

const DT = 1 / RULES.sim.hz;

function run(w: World, p: GodPresence, seconds: number): void {
  for (let i = 0; i < Math.round(seconds * RULES.sim.hz); i++) {
    updatePresence(w, p, DT);
    tick(w, DT);
  }
}

describe('the hero\'s welcome', () => {
  it('everyone runs to the edge nearest the god and cheers', () => {
    const w = createWorld(70);
    const p = makePresence();
    const came = heroWelcome(w, { x: 0, z: 1 });
    assert.equal(came, w.villagers.length);
    assert.ok(w.villagers.every((v) => v.rally > 0));
    // Where each one stands when they stop running.
    const arrivedAt = new Map<string, number>();
    for (let i = 0; i < RITUAL.rallySeconds * RULES.sim.hz + 2; i++) {
      run(w, p, DT);
      for (const v of w.villagers) {
        if (v.rally === 0 && !arrivedAt.has(v.id)) {
          arrivedAt.set(v.id, v.pos.z);
          assert.equal(v.reaction, 'cheer', `${v.name} cheers on arrival`);
        }
      }
    }
    for (const v of w.villagers) {
      assert.ok((arrivedAt.get(v.id) ?? 0) > RULES.village.radius * 0.4, `${v.name} reached the near edge`);
    }
  });
});

describe('the curious touch the god\'s fingertips', () => {
  it('a resting hand draws villagers to touch a fingertip, then hide', () => {
    const w = createWorld(71);
    w.guide = { step: 'done', active: false };
    for (const v of w.villagers) {
      v.pos = { x: 0.1, z: 0.05 };
      v.beliefs.initiative = 1;
      v.needs.hunger = 0;
      v.needs.fatigue = 0;
    }
    const p = makePresence();
    const h = p.hands.right;
    Object.assign(h, { present: true, x: 0.1, y: 0.02, z: 0.1, palmUp: false, open: true, speed: 0, still: true });
    for (let i = 0; i < 5; i++) {
      h.tips[i * 2] = 0.07 + i * 0.015;
      h.tips[i * 2 + 1] = 0.02;
    }
    const seen = new Set<string>();
    for (let s = 0; s < (PRESENCE.restSeconds + RITUAL.touchSeconds + 8) * RULES.sim.hz; s++) {
      updatePresence(w, p, DT);
      tick(w, DT);
      for (const v of w.villagers) seen.add(v.hide);
    }
    assert.ok(seen.has('touch-going'), 'ran to the fingertip');
    assert.ok(seen.has('touching'), 'touched it');
    assert.ok(seen.has('going') || seen.has('hiding'), 'then went to hide');
  });
});

describe('the village grows', () => {
  it('busy routes wear into stepping stones', () => {
    const w = createWorld(72);
    assert.equal(pathStones(w).length, 0);
    addTraffic(w, 0.05, 0.05, PROGRESS.stoneAfter + 1);
    addTraffic(w, -0.1, 0.02, PROGRESS.stoneAfter / 2);
    const stones = pathStones(w);
    assert.equal(stones.length, 1);
    assert.ok(Math.abs(stones[0].x - 0.05) < PROGRESS.cellSize);
  });

  it('huts and the tablet change with sessions survived', () => {
    const w = createWorld(73);
    assert.equal(hutTier(w), 0);
    assert.equal(tabletCarvings(w), 0);
    w.session = 3;
    assert.equal(hutTier(w), 2);
    assert.equal(tabletCarvings(w), 2);
  });

  it('graves remember parents and children', () => {
    const w = createWorld(74);
    const [mother, child] = [w.villagers[2], w.villagers[3]];
    child.parents = [mother.id];
    kill(w, mother, 'old age');
    const g = w.graves[w.graves.length - 1];
    assert.deepEqual(g.children, [child.name]);
  });

  it('the away report lists what happened, line by line', () => {
    const w = createWorld(75);
    const r = fastForward(w, 3);
    assert.ok(r.lines.length >= 1);
  });
});
