/**
 * Gaze bubble: looking at a villager for 0.4 s shows a small card above them
 * with hunger, fatigue, Faith and Initiative; it hides when the gaze moves
 * away. Uses head direction (the fallback the design calls for on headsets
 * without eye tracking); see NOTES.md for eye-tracked gaze.
 */
import { createSystem, Quaternion, Vector3 } from '@iwsdk/core';
import type { Entity } from '@iwsdk/core';
import { isDependent } from '../sim/villager.ts';
import { GESTURES } from '../sim/rules.ts';
import { CanvasPanel, drawBar, UI_COLORS, UI_FONT } from '../ui/canvas-panel.ts';
import { VillageRoot, VillagerView } from './components.ts';
import { game } from './game.ts';

const BUBBLE_ABOVE = 0.075;
const REDRAW_EVERY = 0.5;

const ACTIVITY_TEXT: Record<string, string> = {
  idle: 'resting easy',
  walk: 'on the move',
  farm: 'farming',
  rest: 'resting',
  pray: 'praying',
  panic: 'panicking!',
  cheer: 'celebrating',
};

export class GazeBubbleSystem extends createSystem({
  villagers: { required: [VillagerView] },
  roots: { required: [VillageRoot] },
}) {
  private panel!: CanvasPanel;
  private bubble!: Entity;
  private head = new Vector3();
  private forward = new Vector3();
  private toTarget = new Vector3();
  private villagerPos = new Vector3();
  private headQ = new Quaternion();
  private candidate = -1;
  private dwell = 0;
  private shown = -1;
  private linger = 0;
  private redrawIn = 0;
  private cosCone = Math.cos((GESTURES.gazeConeDegrees * Math.PI) / 180);

  init(): void {
    this.panel = new CanvasPanel(400, 230, 0.09, 'GazeBubble');
    this.panel.mesh.visible = false;
    this.bubble = this.world.createTransformEntity(this.panel.mesh, { persistent: true });
  }

  update(delta: number): void {
    const mesh = this.panel.mesh;
    if (game.stage !== 'playing') {
      mesh.visible = false;
      this.shown = this.candidate = -1;
      return;
    }
    this.player.head.getWorldPosition(this.head);
    this.player.head.getWorldQuaternion(this.headQ);
    this.forward.set(0, 0, -1).applyQuaternion(this.headQ);

    // Find the villager closest to the centre of the gaze cone.
    let best = -1;
    let bestDot = this.cosCone;
    for (const e of this.queries.villagers.entities) {
      const obj = e.object3D;
      if (!obj || !obj.visible) continue;
      obj.getWorldPosition(this.villagerPos);
      this.villagerPos.y += 0.02;
      this.toTarget.subVectors(this.villagerPos, this.head);
      const d = this.toTarget.length();
      if (d > GESTURES.gazeMaxDistance || d < 1e-4) continue;
      const dot = this.toTarget.dot(this.forward) / d;
      if (dot > bestDot) {
        bestDot = dot;
        best = e.getValue(VillagerView, 'simIndex') ?? -1;
      }
    }

    if (best >= 0 && best === this.candidate) this.dwell += delta;
    else {
      this.candidate = best;
      this.dwell = 0;
    }
    if (best >= 0 && this.dwell >= GESTURES.gazeDwellSeconds && best !== this.shown) {
      this.shown = best;
      this.redrawIn = 0;
    }
    if (this.shown >= 0 && best !== this.shown) {
      this.linger += delta;
      if (this.linger > GESTURES.gazeLingerSeconds) this.shown = -1;
    } else {
      this.linger = 0;
    }

    if (this.shown < 0) {
      mesh.visible = false;
      return;
    }
    const entity = this.findView(this.shown);
    if (!entity?.object3D) {
      mesh.visible = false;
      this.shown = -1;
      return;
    }
    entity.object3D.getWorldPosition(this.villagerPos);
    mesh.position.set(this.villagerPos.x, this.villagerPos.y + BUBBLE_ABOVE, this.villagerPos.z);
    mesh.lookAt(this.head);
    mesh.visible = true;
    this.redrawIn -= delta;
    if (this.redrawIn <= 0) {
      this.redrawIn = REDRAW_EVERY;
      this.draw(this.shown);
    }
  }

  private findView(index: number): Entity | undefined {
    for (const e of this.queries.villagers.entities) {
      if (e.getValue(VillagerView, 'simIndex') === index) return e;
    }
    return undefined;
  }

  private draw(index: number): void {
    const v = game.sim.villagers[index];
    if (!v) return;
    const ctx = this.panel.begin();
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = UI_COLORS.title;
    ctx.font = `700 34px ${UI_FONT}`;
    ctx.fillText(v.name, 24, 48);
    ctx.fillStyle = UI_COLORS.dim;
    ctx.font = `500 22px ${UI_FONT}`;
    const doing = isDependent(v) && v.activity === 'idle' ? 'waiting for a sign' : ACTIVITY_TEXT[v.activity] ?? v.activity;
    ctx.textAlign = 'right';
    ctx.fillText(doing, 376, 48);
    ctx.textAlign = 'left';
    drawBar(ctx, 'Hunger', v.needs.hunger, v.needs.hunger > 0.7 ? UI_COLORS.bad : UI_COLORS.warn, 24, 90, 352);
    drawBar(ctx, 'Tired', v.needs.fatigue, v.needs.fatigue > 0.7 ? UI_COLORS.bad : UI_COLORS.warn, 24, 125, 352);
    drawBar(ctx, 'Faith', v.beliefs.faith, UI_COLORS.faith, 24, 160, 352);
    drawBar(ctx, 'Initiative', v.beliefs.initiative, UI_COLORS.initiative, 24, 195, 352);
    this.panel.commit();
  }
}
