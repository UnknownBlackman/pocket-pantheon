/**
 * Spatial UI, all inside the central view and all usable with hands only:
 * - hint panel above the back of the village: placement help, tutorial
 *   hints (driven by player actions) and short messages;
 * - pause: hold both palms facing you at chest height for 1 s; the pause
 *   panel has Resume and New village buttons pressed by poking them;
 * - a "hand tracking needed" panel when no hand data arrives within 3 s.
 */
import { createSystem, Quaternion, Vector3, VisibilityState } from '@iwsdk/core';
import type { Entity, Object3D } from '@iwsdk/core';
import { chime, setMuted, tick } from '../audio/sfx.ts';
import { events } from '../core/events.ts';
import { GESTURES, LAYOUT } from '../sim/rules.ts';
import { completeStep, currentHint } from '../sim/tutorial.ts';
import { CanvasPanel } from '../ui/canvas-panel.ts';
import { drawHint, drawPause } from '../ui/panels.ts';
import type { PanelButton } from '../ui/panels.ts';
import { showToast, uiState } from '../ui/ui-state.ts';
import { atChestHeight, isPalmFacing } from '../xr/gestures.ts';
import { hands } from '../xr/hand-state.ts';
import {
  BuildingView,
  ChronicleTablet,
  DioramaView,
  FavorPips,
  PowerEffect,
  VillageRoot,
  VillagerView,
} from './components.ts';
import { game } from './game.ts';
import { resetVillage } from './village-reset.ts';

const PAUSE_BUTTONS: readonly PanelButton[] = [
  { id: 'resume', label: 'Resume', x: 36, y: 250, w: 270, h: 96 },
  { id: 'restart', label: 'New village', x: 334, y: 250, w: 270, h: 96 },
];
const PAUSE_BUTTONS_ARMED: readonly PanelButton[] = PAUSE_BUTTONS.map((b) =>
  b.id === 'restart' ? { ...b, label: 'Yes, start over' } : b,
);
/** Hint panel position in village space: above the back of the diorama. */
const HINT_LOCAL = new Vector3(0, LAYOUT.baseHeight + 0.24, -0.2);
/** A fingertip within this distance of a panel's surface touches it. */
const TOUCH_DEPTH = 0.025;

export class UISystem extends createSystem({
  roots: { required: [VillageRoot] },
  villagers: { required: [VillagerView] },
  buildings: { required: [BuildingView] },
  dioramas: { required: [DioramaView] },
  pips: { required: [FavorPips] },
  effects: { required: [PowerEffect] },
  tablets: { required: [ChronicleTablet] },
}) {
  private hint!: CanvasPanel;
  private pause!: CanvasPanel;
  private handsPanel!: CanvasPanel;
  private hintKey = '';
  private pauseKey = '';
  private pauseHold = 0;
  private hotButton: string | null = null;
  private pressTime = 0;
  private pressed = false;
  private restartArmedUntil = 0;
  private head = new Vector3();
  private headQ = new Quaternion();
  private v = new Vector3();
  private local = new Vector3();

  init(): void {
    this.hint = this.makePanel(640, 280, 0.3, 'HintPanel');
    this.pause = this.makePanel(640, 380, 0.3, 'PausePanel');
    this.handsPanel = this.makePanel(640, 300, 0.32, 'HandsNeededPanel');
    drawHint(
      this.handsPanel,
      'Hand tracking needed',
      'Put your controllers down and hold up your hands. If they do not appear, turn on hand tracking in Settings > Movement tracking.',
    );

    this.cleanupFuncs.push(
      events.on('villager.dropped', (p) => {
        if (p.buildingId) completeStep(game.sim, 'lift');
      }),
      events.on('power.used', (p) => {
        completeStep(game.sim, p.kind);
      }),
      events.on('villager.inspected', () => {
        completeStep(game.sim, 'gaze');
      }),
      events.on('power.failed', (p) => {
        showToast(
          'Not enough Favor',
          `That needs ${p.need} Favor and you have ${Math.floor(p.have)}. Villagers praying at the shrine give you Favor.`,
        );
      }),
      this.world.visibilityState.subscribe((vis) => {
        // Pause rule: mute while the session is not visible.
        setMuted(vis === VisibilityState.Hidden || vis === VisibilityState.VisibleBlurred);
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
    uiState.time += delta;
    const inXR = this.world.visibilityState.peek() !== VisibilityState.NonImmersive;
    this.player.head.getWorldPosition(this.head);
    this.player.head.getWorldQuaternion(this.headQ);

    this.updateHandsPanel(inXR);
    this.updatePauseGesture(delta, inXR);
    this.updatePausePanel(delta);
    this.updateHint(inXR);
  }

  // ---------------------------------------------------------------- Hint

  /** The hint to show now, or '' for none. Writes the body into `hintBody`. */
  private hintBody = '';
  private pickHint(): string {
    const toast = uiState.toast;
    if (toast && toast.until > uiState.time) {
      this.hintBody = toast.body;
      return toast.title;
    }
    if (uiState.placing) {
      this.hintBody = 'Pinch the ring and drag to move it. Pinch the air to plant your village there.';
      return 'Plant your village';
    }
    if (game.stage !== 'playing' || game.sim.phase !== 'day') return '';
    const h = currentHint(game.sim);
    if (!h) return '';
    if (h.step === 'complete') {
      if (!game.sim.tutorialDone.includes('complete-shown')) {
        game.sim.tutorialDone.push('complete-shown');
        showToast(h.title, h.body, 8);
        chime();
      }
      return '';
    }
    this.hintBody = h.body;
    return h.title;
  }

  private updateHint(inXR: boolean): void {
    const mesh = this.hint.mesh;
    const title = inXR && !game.paused && !this.handsPanel.mesh.visible ? this.pickHint() : '';
    if (!title) {
      mesh.visible = false;
      return;
    }
    const key = `${title}|${this.hintBody}`;
    if (key !== this.hintKey) {
      this.hintKey = key;
      drawHint(this.hint, title, this.hintBody);
    }
    // Above the ghost while placing, else above the back of the village.
    if (uiState.placing) {
      mesh.position.set(uiState.anchor.x, uiState.anchor.y + 0.22, uiState.anchor.z);
    } else {
      const rootObj = this.root()?.object3D;
      if (!rootObj) return;
      this.v.copy(HINT_LOCAL);
      rootObj.localToWorld(this.v);
      mesh.position.copy(this.v);
    }
    mesh.lookAt(this.head);
    mesh.visible = true;
  }

  // ---------------------------------------------------------------- Hands needed

  private updateHandsPanel(inXR: boolean): void {
    const mesh = this.handsPanel.mesh;
    const missing =
      inXR &&
      hands.sessionTime > GESTURES.noHandsWarningSeconds &&
      !hands.left.tracked &&
      !hands.right.tracked;
    if (!missing) {
      mesh.visible = false;
      return;
    }
    if (!mesh.visible || this.outOfView(mesh, 0.85)) this.placeInFront(mesh, 0.55, 0.12);
    mesh.visible = true;
  }

  // ---------------------------------------------------------------- Pause

  private updatePauseGesture(delta: number, inXR: boolean): void {
    if (!inXR || game.paused || game.stage !== 'playing') {
      this.pauseHold = 0;
      return;
    }
    const l = hands.left;
    const r = hands.right;
    const pose =
      l.tracked &&
      r.tracked &&
      isPalmFacing(l.joints, l.palm, l.normal, this.head) &&
      isPalmFacing(r.joints, r.palm, r.normal, this.head) &&
      atChestHeight(l.palm.y, this.head.y) &&
      atChestHeight(r.palm.y, this.head.y);
    if (!pose) {
      this.pauseHold = 0;
      return;
    }
    const before = this.pauseHold;
    this.pauseHold += delta;
    if (Math.floor(before * 4) !== Math.floor(this.pauseHold * 4)) tick();
    if (this.pauseHold >= GESTURES.pauseHoldSeconds) {
      this.pauseHold = 0;
      this.openPause();
    }
  }

  private openPause(): void {
    game.paused = true;
    this.pauseKey = '';
    this.pressed = true; // ignore a fingertip already resting where a button appears
    this.placeInFront(this.pause.mesh, 0.45, 0.18);
    this.pause.mesh.visible = true;
    chime();
    events.emit('session.paused', { paused: true });
    console.info('[ui] paused');
  }

  private closePause(): void {
    game.paused = false;
    this.pause.mesh.visible = false;
    events.emit('session.paused', { paused: false });
    console.info('[ui] resumed');
  }

  private updatePausePanel(delta: number): void {
    const mesh = this.pause.mesh;
    if (!game.paused) {
      mesh.visible = false;
      return;
    }
    const armed = this.restartArmedUntil > uiState.time;
    const buttons = armed ? PAUSE_BUTTONS_ARMED : PAUSE_BUTTONS;
    const hot = this.pokedButton(this.pause, buttons);
    const key = `${hot}|${armed}`;
    if (key !== this.pauseKey) {
      this.pauseKey = key;
      const note = armed
        ? 'Press again to start over. Your current village will be lost.'
        : 'Your village waits. Poke a button to continue.';
      drawPause(this.pause, buttons, hot, note);
    }

    // A poke presses once when the fingertip has rested on a button for 0.12 s.
    if (hot && hot === this.hotButton) this.pressTime += delta;
    else this.pressTime = 0;
    this.hotButton = hot;
    if (!hot) this.pressed = false;
    if (hot && !this.pressed && this.pressTime > 0.12) {
      this.pressed = true;
      this.press(hot);
    }
  }

  private press(id: string): void {
    chime();
    if (id === 'resume') {
      this.closePause();
      return;
    }
    if (id === 'restart') {
      if (this.restartArmedUntil > uiState.time) {
        this.restartArmedUntil = 0;
        this.restart();
        this.closePause();
        showToast('A new village', 'Eight villagers wake up on your table.', 5);
      } else {
        this.restartArmedUntil = uiState.time + 4;
      }
    }
  }

  private restart(): void {
    const root = this.root();
    if (!root) return;
    const views: Entity[] = [];
    const qs = [
      this.queries.villagers,
      this.queries.buildings,
      this.queries.dioramas,
      this.queries.pips,
      this.queries.effects,
      this.queries.tablets,
    ];
    for (const q of qs) for (const e of q.entities) views.push(e);
    resetVillage(this.world, root, views);
    console.info('[ui] new village');
  }

  /** Which button (if any) a fingertip is touching on a panel. */
  private pokedButton(panel: CanvasPanel, buttons: readonly PanelButton[]): string | null {
    const mesh = panel.mesh;
    const size = (mesh.geometry as unknown as { parameters: { width: number; height: number } }).parameters;
    for (const h of [hands.left, hands.right]) {
      if (!h.tracked) continue;
      this.local.set(h.indexTip.x, h.indexTip.y, h.indexTip.z);
      mesh.worldToLocal(this.local);
      if (Math.abs(this.local.z) > TOUCH_DEPTH) continue;
      const px = (this.local.x / size.width + 0.5) * panel.widthPx;
      const py = (0.5 - this.local.y / size.height) * panel.heightPx;
      for (const b of buttons) {
        if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) return b.id;
      }
    }
    return null;
  }

  // ---------------------------------------------------------------- Helpers

  /** Puts a panel `dist` metres ahead of the eyes and `below` metres lower, facing them. */
  private placeInFront(mesh: Object3D, dist: number, below: number): void {
    this.v.set(0, 0, -1).applyQuaternion(this.headQ);
    this.v.y = 0;
    if (this.v.lengthSq() < 1e-6) this.v.set(0, 0, -1);
    this.v.normalize().multiplyScalar(dist);
    mesh.position.set(this.head.x + this.v.x, this.head.y - below, this.head.z + this.v.z);
    mesh.lookAt(this.head);
  }

  private outOfView(mesh: Object3D, minDot: number): boolean {
    this.v.subVectors(mesh.position, this.head).normalize();
    this.local.set(0, 0, -1).applyQuaternion(this.headQ);
    return this.v.dot(this.local) < minDot;
  }
}
