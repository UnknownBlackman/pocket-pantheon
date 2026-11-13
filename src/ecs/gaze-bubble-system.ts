/**
 * Villager details: a small card above a villager with hunger, tiredness,
 * Faith and Initiative. It appears when the player
 * - touches the villager with a fingertip (at once),
 * - points at them with the index finger (0.2 s), or
 * - looks at them (0.4 s). Gaze uses head direction, the design's fallback
 *   without eye tracking; the ray is also tried 15 degrees lower because the
 *   eyes, not the head, do most of the work when looking down at a table.
 * It hides shortly after none of these point at the villager any more.
 */
import { createSystem, Quaternion, Vector3 } from '@iwsdk/core';
import type { Entity, MeshBasicMaterial } from '@iwsdk/core';
import { events } from '../core/events.ts';
import { isDependent } from '../sim/villager.ts';
import { GESTURES } from '../sim/rules.ts';
import { J } from '../xr/gestures.ts';
import { hands } from '../xr/hand-state.ts';
import { CanvasPanel, drawBar, UI_COLORS, UI_FONT } from '../ui/canvas-panel.ts';
import { VillageRoot, VillagerView } from './components.ts';
import { game } from './game.ts';

const BUBBLE_ABOVE = 0.085;
/** About 12 cm wide: readable at arm's length. */
const BUBBLE_WIDTH = 0.12;
const REDRAW_EVERY = 0.5;

const ACTIVITY_TEXT: Record<string, string> = {
  idle: 'resting easy',
  walk: 'on the move',
  farm: 'farming',
  rest: 'resting',
  pray: 'praying',
  panic: 'panicking!',
  cheer: 'celebrating',
  play: 'playing',
  mourn: 'mourning',
  awe: 'in awe',
  wave: 'waving',
  ride: 'riding your hand',
  hide: 'hiding',
  daze: 'dazed',
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
  private cosPoint = Math.cos((GESTURES.pointConeDegrees * Math.PI) / 180);
  private lowered = new Vector3();
  private right = new Vector3();
  private tip = new Vector3();
  private pointDir = new Vector3();

  init(): void {
    this.panel = new CanvasPanel(400, 230, BUBBLE_WIDTH, 'GazeBubble');
    this.panel.mesh.visible = false;
    // UI: drawn over clouds and scenery so it is never swallowed by them.
    const mat = this.panel.mesh.material as MeshBasicMaterial;
    mat.depthTest = false;
    this.panel.mesh.renderOrder = 40;
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
    this.right.set(1, 0, 0).applyQuaternion(this.headQ);
    this.lowered
      .copy(this.forward)
      .applyAxisAngle(this.right, (-GESTURES.gazePitchBiasDegrees * Math.PI) / 180);

    // Touch beats pointing beats gaze.
    let need: number = 0;
    let via = 'touch';
    let best = this.pickByTouch();
    if (best < 0) {
      best = this.pickByPointing();
      need = GESTURES.pointDwellSeconds;
      via = 'pointing';
    }
    if (best < 0) {
      best = this.pickByGaze();
      need = GESTURES.gazeDwellSeconds;
      via = 'gaze';
    }

    if (best >= 0 && best === this.candidate) this.dwell += delta;
    else {
      this.candidate = best;
      this.dwell = 0;
    }
    if (best >= 0 && this.dwell >= need && best !== this.shown) {
      this.shown = best;
      this.redrawIn = 0;
      const v = game.sim.villagers[best];
      if (v) {
        events.emit('villager.inspected', { villagerId: v.id });
        console.info(`[bubble] ${v.name} via ${via}`);
      }
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

  /** Villager centre (world) for an entity; false when not usable. */
  private centre(e: Entity): boolean {
    const obj = e.object3D;
    if (!obj || !obj.visible) return false;
    if (game.sim.villagers[e.getValue(VillagerView, 'simIndex') ?? -1]?.dead) return false;
    obj.getWorldPosition(this.villagerPos);
    this.villagerPos.y += 0.02;
    return true;
  }

  /** The villager a fingertip is touching, or -1. */
  private pickByTouch(): number {
    let best = -1;
    let bestD: number = GESTURES.touchDistance;
    for (const h of [hands.left, hands.right]) {
      if (!h.tracked) continue;
      for (const e of this.queries.villagers.entities) {
        if (!this.centre(e)) continue;
        const d = this.villagerPos.distanceTo(h.indexTip as Vector3);
        if (d < bestD) {
          bestD = d;
          best = e.getValue(VillagerView, 'simIndex') ?? -1;
        }
      }
    }
    return best;
  }

  /** The villager an extended index finger points at, or -1. */
  private pickByPointing(): number {
    let best = -1;
    let bestDot = this.cosPoint;
    for (const h of [hands.left, hands.right]) {
      if (!h.tracked || !h.poke) continue;
      const j = h.joints;
      this.tip.set(h.indexTip.x, h.indexTip.y, h.indexTip.z);
      this.pointDir
        .set(j[J.indexKnuckle * 3], j[J.indexKnuckle * 3 + 1], j[J.indexKnuckle * 3 + 2])
        .subVectors(this.tip, this.pointDir)
        .normalize();
      for (const e of this.queries.villagers.entities) {
        if (!this.centre(e)) continue;
        this.toTarget.subVectors(this.villagerPos, this.tip);
        const d = this.toTarget.length();
        if (d > GESTURES.pointMaxDistance || d < 1e-4) continue;
        const dot = this.toTarget.dot(this.pointDir) / d;
        if (dot > bestDot) {
          bestDot = dot;
          best = e.getValue(VillagerView, 'simIndex') ?? -1;
        }
      }
    }
    return best;
  }

  /** The villager nearest the centre of either gaze ray (head or lowered), or -1. */
  private pickByGaze(): number {
    let best = -1;
    let bestDot = this.cosCone;
    for (const e of this.queries.villagers.entities) {
      if (!this.centre(e)) continue;
      this.toTarget.subVectors(this.villagerPos, this.head);
      const d = this.toTarget.length();
      if (d > GESTURES.gazeMaxDistance || d < 1e-4) continue;
      const dot = Math.max(this.toTarget.dot(this.forward), this.toTarget.dot(this.lowered)) / d;
      if (dot > bestDot) {
        bestDot = dot;
        best = e.getValue(VillagerView, 'simIndex') ?? -1;
      }
    }
    return best;
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
    ctx.font = `500 20px ${UI_FONT}`;
    ctx.fillText(v.age < 13 ? `child, ${v.age}` : `${v.age}${v.limp > 0 ? ', limping' : ''}`, 24 + Math.min(150, v.name.length * 19), 48);
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
