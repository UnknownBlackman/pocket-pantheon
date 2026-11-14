/**
 * Villagers speak and the village is narrated, so the player always knows
 * what is going on. Speech bubbles float above heads (up to three at once,
 * a new one at most every 1.2 s, each villager at most every 8 s); a calm
 * one-line caption sits under the hint panel. Lines come from sim/barks.ts.
 * Big moments (a birth, a death) also get a message on the hint panel.
 */
import { createSystem, Vector3, VisibilityState } from '@iwsdk/core';
import type { Entity, MeshBasicMaterial } from '@iwsdk/core';
import { events } from '../core/events.ts';
import { barkLine, moodFor, narration } from '../sim/barks.ts';
import { TUNICS } from '../scene-assets/village.scene-asset.ts';
import { drawSpeechBubble } from '../ui/bubble.ts';
import type { BarkKind } from '../sim/barks.ts';
import { causeText, isChild, villagerScale } from '../sim/life.ts';
import { LAYOUT, LIFE } from '../sim/rules.ts';
import { stormStrength } from '../sim/storm.ts';
import type { DeathCause, Villager } from '../sim/types.ts';
import { CanvasPanel, ribbon } from '../ui/canvas-panel.ts';
import { narrate, say, speech } from '../ui/speech.ts';
import { villagerVoice } from '../audio/voices.ts';
import { showToast } from '../ui/ui-state.ts';
import { VillageRoot, VillagerView } from './components.ts';
import { game } from './game.ts';

const BUBBLES = 3;
/** Bubble canvas and size: about 13 cm wide, bottom-anchored on the tail. */
const BUBBLE_PX_W = 560;
const BUBBLE_PX_H = 300;
const BUBBLE_W = 0.13;
const BUBBLE_H = (BUBBLE_W * BUBBLE_PX_H) / BUBBLE_PX_W;

function tunicCss(index: number): string {
  return `#${TUNICS[index % TUNICS.length].toString(16).padStart(6, '0')}`;
}
const GLOBAL_GAP = 1.2;
const PER_VILLAGER_GAP = 8;
const CAPTION_SECONDS = 5;
/** Caption position in village space: just under the hint panel. */
const CAPTION_LOCAL = new Vector3(0, LAYOUT.baseHeight + 0.17, -0.2);

interface Bubble {
  panel: CanvasPanel;
  index: number;
  left: number;
  total: number;
}

export class SpeechSystem extends createSystem({
  villagers: { required: [VillagerView] },
  roots: { required: [VillageRoot] },
}) {
  private bubbles: Bubble[] = [];
  private caption!: CanvasPanel;
  private captionLeft = 0;
  private gap = 0;
  private lastSaid: number[] = [];
  private lastActivity: string[] = [];
  private lastHungerBark: number[] = [];
  private clock = 0;
  private prayNarratedAt = -999;
  private wasEclipse = false;
  private swatNarrated = false;
  private head = new Vector3();
  private v = new Vector3();
  private rand = Math.random;

  init(): void {
    for (let i = 0; i < BUBBLES; i++) {
      const panel = new CanvasPanel(BUBBLE_PX_W, BUBBLE_PX_H, BUBBLE_W, 'SpeechBubble');
      (panel.mesh.material as MeshBasicMaterial).depthTest = false;
      panel.mesh.renderOrder = 45;
      panel.mesh.visible = false;
      this.world.createTransformEntity(panel.mesh, { persistent: true });
      this.bubbles.push({ panel, index: -1, left: 0, total: 1 });
    }
    this.caption = new CanvasPanel(1000, 120, 0.32, 'NarrationCaption');
    (this.caption.mesh.material as MeshBasicMaterial).depthTest = false;
    this.caption.mesh.renderOrder = 44;
    this.caption.mesh.visible = false;
    this.world.createTransformEntity(this.caption.mesh, { persistent: true });
    this.listen();
  }

  // ---------------------------------------------------------------- Event lines

  private indexOf(id: string): number {
    return game.sim.villagers.findIndex((v) => v.id === id);
  }

  /** A living, free villager nearest (x, z), for group reactions. */
  private nearest(x: number, z: number, filter?: (v: Villager) => boolean): number {
    let best = -1;
    let bestD = Infinity;
    game.sim.villagers.forEach((v, i) => {
      if (v.dead || v.carried || (filter && !filter(v))) return;
      const d = Math.hypot(v.pos.x - x, v.pos.z - z);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }

  private bark(index: number, kind: BarkKind, force = false): void {
    if (index < 0) return;
    if (!force && this.clock - (this.lastSaid[index] ?? -99) < PER_VILLAGER_GAP) return;
    say(index, barkLine(kind, this.rand), 3.2, false, moodFor(kind));
  }

  private listen(): void {
    const on = events.on.bind(events);
    this.cleanupFuncs.push(
      on('villager.climbed', (e) => {
        const i = this.indexOf(e.villagerId);
        this.bark(i, this.rand() < 0.5 ? 'climb' : 'ride', true);
        const v = game.sim.villagers[i];
        if (v) narrate(narration('riders', [v.name]));
      }),
      on('villager.fell', (e) => this.bark(this.indexOf(e.villagerId), e.hard ? 'fall' : 'hop-down', true)),
      on('villager.hid', (e) => {
        const i = this.indexOf(e.villagerId);
        this.bark(i, 'hide', true);
        const v = game.sim.villagers[i];
        if (v) narrate(narration('hiders', [v.name]));
      }),
      on('hideseek.found', () => this.bark(this.nearestTo('cheer'), 'found', true)),
      on('god.waved', () => this.bark(this.nearestTo('wave'), 'wave', true)),
      on('god.cheered', () => this.bark(this.nearestTo('cheer'), 'cheer', true)),
      on('villager.lifted', (e) => this.bark(this.indexOf(e.villagerId), 'lifted', true)),
      on('villager.dropped', (e) => {
        const kind: BarkKind | null = !e.buildingId
          ? null
          : e.buildingId.startsWith('field')
            ? 'farm'
            : e.buildingId.startsWith('hut')
              ? 'rest'
              : e.buildingId.startsWith('shrine')
                ? 'shrine'
                : null;
        if (kind) this.bark(this.indexOf(e.villagerId), kind, true);
      }),
      on('power.used', (e) => {
        if (e.kind === 'bless' && e.targetId) {
          const i = this.indexOf(e.targetId);
          if (i >= 0) this.bark(i, 'blessed', true);
          else this.bark(this.nearest(0, 0), 'blessed', true);
        } else if (e.kind === 'rain') {
          this.bark(this.nearest(0, 0.15), 'rain', true);
        } else if (e.kind === 'shelter') {
          this.bark(this.nearest(0, 0), 'sheltered', true);
        }
      }),
      on('storm.swatted', () => {
        if (!this.swatNarrated) {
          this.swatNarrated = true;
          narrate(narration('storm-weakens'));
          this.bark(this.nearest(0, 0), 'swat', true);
        }
      }),
      on('storm.calmed', () => {
        this.swatNarrated = false;
        this.bark(this.nearest(0, 0), 'calm', true);
      }),
      on('weather.changed', (e) => {
        if (e.weather === 'storm') {
          this.swatNarrated = false;
          this.bark(this.nearest(0, 0), 'panic', true);
        }
      }),
      on('session.dusk', () => {
        narrate(narration('dusk'));
        this.bark(this.nearest(0, 0), 'dusk', true);
      }),
      on('villager.born', (e) => {
        showToast('A child is born!', `Welcome, ${e.name}, child of ${e.parents.join(' and ')}.`, 7);
        const parent = game.sim.villagers.findIndex((v) => !v.dead && v.name === e.parents[0]);
        this.bark(parent, 'newborn', true);
      }),
      on('villager.died', (e) => {
        const cause = causeText(e.cause as DeathCause);
        showToast(`${e.name} has died`, `${e.name} died ${cause}, aged ${e.age}. The village mourns.`, 8);
        const v = game.sim.villagers[e.index];
        if (v) this.bark(this.nearest(v.pos.x, v.pos.z, (o) => o.activity === 'mourn'), 'mourn', true);
      }),
      on('villager.hurt', (e) => this.bark(this.indexOf(e.villagerId), 'fall', true)),
    );
  }

  private nearestTo(activity: string): number {
    const list = game.sim.villagers;
    for (let i = 0; i < list.length; i++) if (!list[i].dead && list[i].activity === activity) return i;
    return this.nearest(0, 0);
  }

  // ---------------------------------------------------------------- Watching the village

  /** Lines for changes in what villagers are doing (no event needed). */
  private watch(): void {
    const sim = game.sim;
    let praying = 0;
    const prayers: string[] = [];
    sim.villagers.forEach((v, i) => {
      if (v.dead) return;
      const was = this.lastActivity[i];
      const now = v.activity;
      this.lastActivity[i] = now;
      if (now === 'pray') {
        praying++;
        if (prayers.length < 3) prayers.push(v.name);
      }
      if (was === now) {
        if (v.needs.hunger > 0.9 && this.clock - (this.lastHungerBark[i] ?? -99) > 40) {
          this.lastHungerBark[i] = this.clock;
          this.bark(i, 'starving');
        }
        return;
      }
      if (now === 'pray') this.bark(i, praying > 1 ? 'pray-together' : 'pray');
      else if (now === 'awe') this.bark(i, 'awe');
      else if (now === 'panic' && this.rand() < 0.4) this.bark(i, 'panic');
      else if (now === 'play' && isChild(v) && this.rand() < 0.25) this.bark(i, 'play');
      else if (now === 'walk' && v.limp > 0 && this.rand() < 0.3) this.bark(i, 'limp');
      else if (now === 'idle' && v.beliefs.initiative < 0.25 && this.rand() < 0.2) this.bark(i, 'waiting');
    });
    if (praying >= 2 && this.clock - this.prayNarratedAt > 60) {
      this.prayNarratedAt = this.clock;
      narrate(narration('pray-group', prayers));
    }
    if (sim.eclipse && !this.wasEclipse) {
      narrate(narration('eclipse'));
      this.bark(this.nearestTo('pray'), 'kneel', true);
    }
    this.wasEclipse = sim.eclipse;
    void stormStrength;
  }

  // ---------------------------------------------------------------- Showing

  update(delta: number): void {
    this.clock += delta;
    this.gap = Math.max(0, this.gap - delta);
    const inXR = this.world.visibilityState.peek() !== VisibilityState.NonImmersive;
    const active = inXR && game.stage === 'playing';
    if (!active) {
      for (const b of this.bubbles) b.panel.mesh.visible = false;
      this.caption.mesh.visible = false;
      speech.requests.length = 0;
      speech.narration.length = 0;
      return;
    }
    this.watch();
    this.player.head.getWorldPosition(this.head);
    this.startBubbles();
    this.placeBubbles(delta);
    this.updateCaption(delta);
  }

  private startBubbles(): void {
    while (speech.requests.length) {
      const req = speech.requests[0];
      if (!req.priority && this.gap > 0) return;
      const v = game.sim.villagers[req.index];
      speech.requests.shift();
      if (!v || v.dead) continue;
      // Reuse this villager's bubble, else a free one, else the oldest.
      let b = this.bubbles.find((x) => x.index === req.index && x.left > 0);
      b ??= this.bubbles.find((x) => x.left <= 0);
      b ??= this.bubbles.reduce((a, c) => (c.left < a.left ? c : a));
      b.index = req.index;
      b.left = req.seconds;
      b.total = req.seconds;
      drawSpeechBubble(b.panel, {
        text: req.text,
        name: v.name,
        tab: tunicCss(req.index),
        mood: req.mood,
      });
      villagerVoice({
        index: req.index,
        text: req.text,
        mood: req.mood,
        child: v.age < LIFE.adultAge,
        elder: req.index === 0 || v.age >= LIFE.oldAgeFrom,
      });
      this.lastSaid[req.index] = this.clock;
      if (!req.priority) this.gap = GLOBAL_GAP;
    }
  }

  private viewFor(index: number): Entity | undefined {
    for (const e of this.queries.villagers.entities) {
      if (e.getValue(VillagerView, 'simIndex') === index) return e;
    }
    return undefined;
  }

  private placeBubbles(delta: number): void {
    for (const b of this.bubbles) {
      const mesh = b.panel.mesh;
      if (b.left <= 0) {
        mesh.visible = false;
        continue;
      }
      b.left -= delta;
      const e = this.viewFor(b.index);
      const v = game.sim.villagers[b.index];
      if (!e?.object3D || !v || v.dead) {
        b.left = 0;
        mesh.visible = false;
        continue;
      }
      e.object3D.getWorldPosition(this.v);
      // The tail tip sits just above the head; the bubble rises from it.
      const lift = 0.045 * villagerScale(v.age) + 0.008 + BUBBLE_H / 2;
      mesh.position.set(this.v.x, this.v.y + lift, this.v.z);
      mesh.lookAt(this.head);
      // Pop in, then shrink away at the end.
      const s = Math.min(1, (b.total - b.left) * 8, b.left * 4);
      mesh.scale.setScalar(Math.max(0.01, s));
      mesh.visible = true;
    }
  }

  private updateCaption(delta: number): void {
    const mesh = this.caption.mesh;
    if (speech.narration.length && this.captionLeft < CAPTION_SECONDS - 2) {
      const text = speech.narration.shift()!;
      ribbon(this.caption.ctx, this.caption.widthPx, this.caption.heightPx, text);
      this.caption.commit();
      this.captionLeft = CAPTION_SECONDS;
    }
    if (this.captionLeft <= 0) {
      mesh.visible = false;
      return;
    }
    this.captionLeft -= delta;
    let root: Entity | undefined;
    for (const e of this.queries.roots.entities) root = e;
    if (!root?.object3D) return;
    this.v.copy(CAPTION_LOCAL);
    root.object3D.localToWorld(this.v);
    mesh.position.copy(this.v);
    mesh.lookAt(this.head);
    mesh.visible = true;
  }
}
