/**
 * Dusk and memory:
 * - At dusk the villagers gather at the campfire (sim) and a summary panel
 *   shows a 1-5 star rating, how Faith and Initiative changed this session,
 *   which way the village leans, and this session's chronicle. When dusk
 *   ends, a "Begin a new day" button (poke) starts the next session.
 * - Poking the stone tablet beside the shrine opens the chronicle of past
 *   sessions; poking it again (or waiting) closes it.
 */
import { createSystem, Vector3, VisibilityState } from '@iwsdk/core';
import type { Entity } from '@iwsdk/core';
import { chime } from '../audio/sfx.ts';
import { events } from '../core/events.ts';
import { LAYOUT } from '../sim/rules.ts';
import { averageBeliefs, duskScore, startSession } from '../sim/world.ts';
import { CanvasPanel } from '../ui/canvas-panel.ts';
import { drawChronicle, drawDusk } from '../ui/panels.ts';
import type { DuskSummary, PanelButton } from '../ui/panels.ts';
import { PressTracker, touchedButton } from '../ui/poke.ts';
import { showToast } from '../ui/ui-state.ts';
import { hands } from '../xr/hand-state.ts';
import { ChronicleTablet, VillageRoot } from './components.ts';
import { game } from './game.ts';

const NEW_DAY_BUTTONS: readonly PanelButton[] = [
  { id: 'new-day', label: 'Begin a new day', x: 170, y: 520, w: 380, h: 90 },
];
const NO_BUTTONS: readonly PanelButton[] = [];
/** Dusk panel position in village space: above the back of the diorama. */
const DUSK_LOCAL = new Vector3(0, LAYOUT.baseHeight + 0.26, -0.18);
/** Chronicle panel floats above the tablet. */
const CHRONICLE_ABOVE = 0.2;
const TABLET_POKE_RADIUS = 0.04;
const CHRONICLE_OPEN_SECONDS = 30;

export class ChronicleSystem extends createSystem({
  roots: { required: [VillageRoot] },
  tablets: { required: [ChronicleTablet] },
}) {
  private dusk!: CanvasPanel;
  private chronicle!: CanvasPanel;
  private duskKey = '';
  private chronicleKey = '';
  private press = new PressTracker();
  private head = new Vector3();
  private v = new Vector3();
  private scratch = new Vector3();
  private chronicleOpen = 0;
  private tabletTouch = 0;
  private tabletLatched = false;

  init(): void {
    this.dusk = this.makePanel(720, 640, 0.34, 'DuskPanel');
    this.chronicle = this.makePanel(720, 720, 0.3, 'ChroniclePanel');
    this.cleanupFuncs.push(
      events.on('session.dusk', () => {
        this.press.reset();
        chime();
      }),
    );
  }

  private makePanel(w: number, h: number, widthM: number, name: string): CanvasPanel {
    const panel = new CanvasPanel(w, h, widthM, name);
    panel.mesh.visible = false;
    this.world.createTransformEntity(panel.mesh, { persistent: true });
    return panel;
  }

  private root(): Entity | undefined {
    for (const e of this.queries.roots.entities) return e;
    return undefined;
  }

  update(delta: number): void {
    const inXR = this.world.visibilityState.peek() !== VisibilityState.NonImmersive;
    const playing = inXR && game.stage === 'playing' && !game.paused;
    this.player.head.getWorldPosition(this.head);
    this.updateDusk(playing, delta);
    this.updateTablet(playing, delta);
  }

  // ---------------------------------------------------------------- Dusk

  private summary(): DuskSummary {
    const sim = game.sim;
    const avg = averageBeliefs(sim);
    const gap = avg.faith - avg.initiative;
    const leaning =
      gap > 0.2
        ? 'They lean on you. Help a little less and they will find their own feet.'
        : gap < -0.2
          ? 'They are drifting from you. Show yourself a little more.'
          : 'A balanced village: they trust you and still act for themselves.';
    const entries = sim.chronicle.slice(sim.sessionChronicleStart).slice(-6).map((e) => e.text);
    return {
      day: sim.dayIndex,
      stars: duskScore(sim).stars,
      faith: avg.faith,
      faithDelta: avg.faith - sim.sessionStart.faith,
      initiative: avg.initiative,
      initiativeDelta: avg.initiative - sim.sessionStart.initiative,
      leaning,
      entries,
    };
  }

  private updateDusk(playing: boolean, delta: number): void {
    const mesh = this.dusk.mesh;
    const phase = game.sim.phase;
    const rootObj = this.root()?.object3D;
    if (!playing || phase === 'day' || !rootObj) {
      mesh.visible = false;
      return;
    }
    const ended = phase === 'ended';
    const buttons = ended ? NEW_DAY_BUTTONS : NO_BUTTONS;

    this.v.copy(DUSK_LOCAL);
    rootObj.localToWorld(this.v);
    mesh.position.copy(this.v);
    mesh.lookAt(this.head);
    mesh.visible = true;

    const touched = ended ? touchedButton(this.dusk, buttons, this.scratch) : null;
    const key = `${phase}|${game.sim.chronicle.length}|${touched}`;
    if (key !== this.duskKey) {
      this.duskKey = key;
      drawDusk(this.dusk, this.summary(), buttons, touched);
    }
    if (this.press.update(touched, delta) === 'new-day') {
      chime();
      startSession(game.sim, events);
      mesh.visible = false;
      showToast('A new day', 'The sun rises over your village.', 5);
      console.info(`[chronicle] session ${game.sim.session} begins`);
    }
  }

  // ---------------------------------------------------------------- Tablet

  private updateTablet(playing: boolean, delta: number): void {
    const mesh = this.chronicle.mesh;
    let tablet: Entity | undefined;
    for (const e of this.queries.tablets.entities) tablet = e;
    const tabletObj = tablet?.object3D;
    if (!playing || !tabletObj) {
      mesh.visible = false;
      this.chronicleOpen = 0;
      return;
    }
    tabletObj.getWorldPosition(this.v);
    this.v.y += 0.045; // centre of the slab

    // A resting fingertip on the tablet for 0.3 s toggles the chronicle.
    let touching = false;
    for (const h of [hands.left, hands.right]) {
      if (!h.tracked) continue;
      this.scratch.set(h.indexTip.x, h.indexTip.y, h.indexTip.z);
      if (this.scratch.distanceTo(this.v) < TABLET_POKE_RADIUS) touching = true;
    }
    this.tabletTouch = touching ? this.tabletTouch + delta : 0;
    if (!touching) this.tabletLatched = false;
    if (touching && !this.tabletLatched && this.tabletTouch > 0.3) {
      this.tabletLatched = true;
      this.chronicleOpen = this.chronicleOpen > 0 ? 0 : CHRONICLE_OPEN_SECONDS;
      chime();
    }

    if (this.chronicleOpen <= 0) {
      mesh.visible = false;
      return;
    }
    this.chronicleOpen -= delta;
    const sim = game.sim;
    const key = `${sim.chronicle.length}`;
    if (key !== this.chronicleKey || !mesh.visible) {
      this.chronicleKey = key;
      const entries = sim.chronicle.slice(-10).reverse().map((e) => e.text);
      drawChronicle(this.chronicle, entries);
    }
    mesh.position.set(this.v.x, this.v.y + CHRONICLE_ABOVE, this.v.z);
    mesh.lookAt(this.head);
    mesh.visible = true;
  }
}
