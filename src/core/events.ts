/**
 * Tiny typed pub/sub. Systems talk through these events instead of importing
 * each other. No Three.js or XR imports, so sim/ code and tests can use it.
 */

export interface GameEvents {
  'villager.lifted': { villagerId: string };
  'villager.dropped': {
    villagerId: string;
    buildingId: string | null;
    x: number;
    z: number;
  };
  'power.used': { kind: 'bless' | 'rain' | 'shelter'; targetId: string | null };
  'day.changed': { dayIndex: number };
  'weather.changed': { weather: 'clear' | 'drought' | 'storm' };
  'chronicle.added': { index: number; text: string };
  'session.dusk': { dayIndex: number };
  'village.placed': { source: 'plane' | 'hit-test' | 'fallback' };
  'villager.inspected': { villagerId: string };
  'power.failed': { kind: 'bless' | 'rain' | 'shelter'; need: number; have: number };
  'tutorial.completed': { step: string };
  'session.paused': { paused: boolean };
  'villager.climbed': { villagerId: string };
  'villager.fell': { villagerId: string; hard: boolean };
  'villager.hid': { villagerId: string };
  'villager.touched': { villagerId: string };
  'hideseek.found': { count: number };
  'god.waved': Record<string, never>;
  'god.cheered': Record<string, never>;
  'villager.born': { villagerId: string; index: number; name: string; parents: string[] };
  'villager.died': { villagerId: string; index: number; name: string; cause: string; age: number };
  'villager.hurt': { villagerId: string };
  lightning: { x: number; z: number };
  'storm.swatted': { cloud: number };
  'storm.calmed': Record<string, never>;
  'guide.step': { step: string };
}

export type GameEventName = keyof GameEvents;
type Handler<K extends GameEventName> = (payload: GameEvents[K]) => void;

export class EventBus {
  private handlers = new Map<GameEventName, Set<Handler<never>>>();

  on<K extends GameEventName>(name: K, handler: Handler<K>): () => void {
    let set = this.handlers.get(name);
    if (!set) {
      set = new Set();
      this.handlers.set(name, set);
    }
    set.add(handler as Handler<never>);
    return () => this.off(name, handler);
  }

  off<K extends GameEventName>(name: K, handler: Handler<K>): void {
    this.handlers.get(name)?.delete(handler as Handler<never>);
  }

  emit<K extends GameEventName>(name: K, payload: GameEvents[K]): void {
    const set = this.handlers.get(name);
    if (!set) return;
    for (const handler of set) {
      try {
        (handler as Handler<K>)(payload);
      } catch (err) {
        console.error(`[events] handler for ${name} threw`, err);
      }
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}

/** The single app-wide bus. Tests may construct their own EventBus. */
export const events = new EventBus();
