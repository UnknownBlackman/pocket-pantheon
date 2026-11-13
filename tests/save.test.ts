import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { deserializeWorld, loadWorld, saveWorld } from '../src/core/save.ts';
import type { StorageLike } from '../src/core/save.ts';
import { fastForward } from '../src/sim/fastforward.ts';
import { RULES } from '../src/sim/rules.ts';
import type { World } from '../src/sim/types.ts';
import { createWorld, runFor } from '../src/sim/world.ts';

class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(k: string): string | null {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.data.set(k, v);
  }
}

function assertValid(w: World): void {
  for (const v of w.villagers) {
    for (const x of [v.needs.hunger, v.needs.fatigue, v.beliefs.faith, v.beliefs.initiative]) {
      assert.ok(Number.isFinite(x) && x >= 0 && x <= 1, `out of range ${x}`);
    }
  }
  for (const b of w.buildings) {
    assert.ok(b.water >= 0 && b.water <= 1 && b.growth >= 0 && b.growth <= 1);
  }
  assert.ok(w.favor >= 0 && w.favor <= RULES.favor.max);
  assert.ok(w.food >= 0 && w.food <= 100);
  // The dead keep their place in the list; the living respect the cap.
  assert.ok(w.villagers.filter((v) => !v.dead).length <= RULES.village.maxVillagers);
}

describe('save and load', () => {
  it('returns an identical World', () => {
    const storage = new MemoryStorage();
    const w = createWorld(40);
    runFor(w, 90);
    const now = 1_700_000_000_000;
    assert.ok(saveWorld(storage, w, now));
    const loaded = loadWorld(storage, now + 1000);
    assert.ok(loaded);
    assert.equal(loaded!.away, null, 'no fast-forward for a fresh save');
    assert.deepEqual(loaded!.world, w);
  });

  it('falls back to null for missing, corrupt or wrong-version saves', () => {
    const storage = new MemoryStorage();
    assert.equal(loadWorld(storage), null);
    storage.setItem(RULES.save.key, '{not json');
    assert.equal(loadWorld(storage), null);
    assert.equal(deserializeWorld(JSON.stringify({ version: 2 })), null);
    assert.equal(loadWorld(null), null);
  });

  it('survives storage that throws', () => {
    const broken: StorageLike = {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('blocked');
      },
    };
    assert.equal(saveWorld(broken, createWorld(41)), false);
    assert.equal(loadWorld(broken), null);
  });

  it('fast-forwards a save older than 10 minutes and adds a note', () => {
    const storage = new MemoryStorage();
    const w = createWorld(42);
    const now = 1_700_000_000_000;
    saveWorld(storage, w, now);
    const later = now + 3 * 3_600_000;
    const loaded = loadWorld(storage, later)!;
    assert.ok(loaded.away, 'expected a fast-forward');
    assert.equal(loaded.away!.days, 3);
    const last = loaded.world.chronicle[loaded.world.chronicle.length - 1];
    assert.equal(last.kind, 'away');
    assert.match(last.text, /^While you were away: 3 days passed\./);
    assertValid(loaded.world);
  });
});

describe('fastForward', () => {
  it('never produces values out of range and caps at 8 hours', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const w = createWorld(seed);
      const report = fastForward(w, 100);
      assert.equal(report.days, RULES.save.fastForwardMaxHours);
      assertValid(w);
    }
  });

  it('can bring a birth when food is plentiful', () => {
    let births = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const w = createWorld(seed);
      w.food = 100;
      births += fastForward(w, 8).births.length;
      assertValid(w);
    }
    assert.ok(births > 0);
  });
});
