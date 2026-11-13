/**
 * How the player sees their stats:
 * - a painted signboard on a post at the front-right of the rim, always
 *   facing the player: day and time, weather, Favor, Faith and Initiative
 *   with the balance, villagers and food, and the divine title;
 * - a palm card: turn the left palm towards your face (a hands-only "wrist
 *   menu") to see believers, independents, those waiting on you, the hungry
 *   and the remembered dead.
 */
import { createSystem, Mesh, CylinderGeometry, Vector3, VisibilityState } from '@iwsdk/core';
import type { Entity } from '@iwsdk/core';
import { PALETTE } from '../scene-assets/village-materials.ts';
import { aliveCount, isChild } from '../sim/life.ts';
import { LAYOUT, RULES } from '../sim/rules.ts';
import { averageBeliefs } from '../sim/world.ts';
import { CanvasPanel } from '../ui/canvas-panel.ts';
import { drawPalmCard, drawSignboard } from '../ui/stats-panels.ts';
import { isPalmFacing } from '../xr/gestures.ts';
import { hands } from '../xr/hand-state.ts';
import { VillageRoot } from './components.ts';
import { game } from './game.ts';

/** Signboard spot in village space (front-right, just inside the rim). */
const SIGN_LOCAL = { x: 0.205, z: 0.2 };
const POST_HEIGHT = 0.03;
const SIGN_WIDTH = 0.15;
const SIGN_PX = { w: 640, h: 390 };
const REFRESH = 0.5;
const PALM_HOLD = 0.3;

function timeLabel(phase: string, t: number): string {
  if (phase !== 'day') return 'Dusk';
  if (t < 0.25) return 'Morning';
  if (t < 0.55) return 'Midday';
  if (t < 0.8) return 'Afternoon';
  return 'Evening';
}

export class StatsSystem extends createSystem({
  roots: { required: [VillageRoot] },
}) {
  private sign!: CanvasPanel;
  private palm!: CanvasPanel;
  private post: Mesh | null = null;
  private signKey = '';
  private palmKey = '';
  private refreshIn = 0;
  private palmHold = 0;
  private head = new Vector3();
  private v = new Vector3();

  init(): void {
    this.sign = new CanvasPanel(SIGN_PX.w, SIGN_PX.h, SIGN_WIDTH, 'VillageSignboard');
    this.sign.mesh.visible = false;
    this.world.createTransformEntity(this.sign.mesh, { persistent: true });
    this.palm = new CanvasPanel(520, 400, 0.12, 'PalmCard');
    this.palm.mesh.visible = false;
    this.palm.mesh.renderOrder = 46;
    this.world.createTransformEntity(this.palm.mesh, { persistent: true });
  }

  private root(): Entity | undefined {
    for (const e of this.queries.roots.entities) return e;
    return undefined;
  }

  update(delta: number): void {
    const inXR = this.world.visibilityState.peek() !== VisibilityState.NonImmersive;
    const root = this.root();
    const show = inXR && game.stage === 'playing' && !!root?.object3D;
    if (!show) {
      this.sign.mesh.visible = false;
      this.palm.mesh.visible = false;
      return;
    }
    this.player.head.getWorldPosition(this.head);
    this.placeSign(root!);
    this.refreshIn -= delta;
    if (this.refreshIn <= 0) {
      this.refreshIn = REFRESH;
      this.refreshSign();
    }
    this.updatePalm(delta);
  }

  // ---------------------------------------------------------------- Signboard

  private placeSign(root: Entity): void {
    const rootObj = root.object3D!;
    if (!this.post) {
      const post = new Mesh(new CylinderGeometry(0.0025, 0.003, POST_HEIGHT, 6), PALETTE.wood);
      post.name = 'SignPost';
      post.position.set(SIGN_LOCAL.x, LAYOUT.baseHeight + POST_HEIGHT / 2, SIGN_LOCAL.z);
      this.world.createTransformEntity(post, { parent: root, persistent: true });
      this.post = post;
    }
    const boardH = (SIGN_WIDTH * SIGN_PX.h) / SIGN_PX.w;
    this.v.set(SIGN_LOCAL.x, LAYOUT.baseHeight + POST_HEIGHT + boardH / 2 - 0.004, SIGN_LOCAL.z);
    rootObj.localToWorld(this.v);
    const mesh = this.sign.mesh;
    mesh.position.copy(this.v);
    mesh.scale.setScalar(rootObj.scale.x);
    mesh.lookAt(this.head);
    mesh.visible = true;
  }

  private refreshSign(): void {
    const sim = game.sim;
    const avg = averageBeliefs(sim);
    let children = 0;
    for (const v of sim.villagers) if (!v.dead && isChild(v)) children++;
    const stats = {
      day: sim.dayIndex + 1,
      timeLabel: timeLabel(sim.phase, sim.timeOfDay),
      weather: sim.weather,
      favor: sim.favor,
      favorMax: RULES.favor.max,
      faith: avg.faith,
      initiative: avg.initiative,
      alive: aliveCount(sim),
      children,
      food: sim.food,
      title: sim.title,
    };
    const key = [
      stats.day,
      stats.timeLabel,
      stats.weather,
      Math.floor(stats.favor * 2),
      Math.round(stats.faith * 50),
      Math.round(stats.initiative * 50),
      stats.alive,
      children,
      Math.round(stats.food),
      stats.title,
    ].join('|');
    if (key === this.signKey) return;
    this.signKey = key;
    drawSignboard(this.sign, stats);
  }

  // ---------------------------------------------------------------- Palm card

  private updatePalm(delta: number): void {
    const l = hands.left;
    const r = hands.right;
    const facing =
      l.tracked &&
      isPalmFacing(l.joints, l.palm, l.normal, this.head) &&
      this.head.distanceTo(this.v.set(l.palm.x, l.palm.y, l.palm.z)) < 0.55;
    // Both palms facing is the pause gesture, not the card.
    const pausing = facing && r.tracked && isPalmFacing(r.joints, r.palm, r.normal, this.head);
    this.palmHold = facing && !pausing && !game.paused ? this.palmHold + delta : 0;
    const mesh = this.palm.mesh;
    if (this.palmHold < PALM_HOLD) {
      mesh.visible = false;
      return;
    }
    const sim = game.sim;
    const avg = averageBeliefs(sim);
    let believers = 0;
    let independent = 0;
    let waiting = 0;
    let hungry = 0;
    for (const v of sim.villagers) {
      if (v.dead) continue;
      if (v.beliefs.faith >= 0.6) believers++;
      if (v.beliefs.initiative >= 0.6) independent++;
      if (v.beliefs.initiative < RULES.decisions.dependentInitiative) waiting++;
      if (v.needs.hunger > 0.7) hungry++;
    }
    const people = {
      believers,
      independent,
      waiting,
      hungry,
      remembered: sim.graves.length,
      alive: aliveCount(sim),
      faith: avg.faith,
      initiative: avg.initiative,
      title: sim.title,
    };
    const key = `${believers}|${independent}|${waiting}|${hungry}|${people.remembered}|${people.alive}|${Math.round(avg.faith * 20)}|${Math.round(avg.initiative * 20)}|${sim.title}`;
    if (key !== this.palmKey || !mesh.visible) {
      this.palmKey = key;
      drawPalmCard(this.palm, people);
    }
    // Float the card just above the palm, facing the eyes.
    mesh.position.set(l.palm.x, l.palm.y + 0.085, l.palm.z);
    mesh.lookAt(this.head);
    mesh.visible = true;
  }
}
