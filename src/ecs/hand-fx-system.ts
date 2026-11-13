/**
 * Hand effects on the village:
 * - the god's shadow: a soft hand-shaped shadow (palm + fingertips) under
 *   each hand, sharper and darker the lower the hand;
 * - "still visible behind your hand": a small glowing marker over each
 *   villager whose line of sight to the player's eyes passes through a real
 *   hand, drawn through the hand so nobody gets lost.
 */
import { createSystem, Vector3, VisibilityState } from '@iwsdk/core';
import type { Entity, Group, Mesh, MeshBasicMaterial } from '@iwsdk/core';
import { makeHandShadow, makeHiddenMarker } from '../art/hand-art.ts';
import { SIDES } from '../sim/presence.ts';
import { LAYOUT, PRESENCE, RULES } from '../sim/rules.ts';
import { JOINT_COUNT } from '../xr/gestures.ts';
import { hands } from '../xr/hand-state.ts';
import { VillageRoot, VillagerView } from './components.ts';
import { game } from './game.ts';
import { makeOccludable } from './occlusion.ts';

const PALM_SHADOW = 0.09;
const TIP_SHADOW = 0.028;
const SHADOW_OPACITY = 0.7;
/** Hit radius of a finger joint and of the palm for line-of-sight tests. */
const JOINT_RADIUS = 0.013;
const PALM_RADIUS = 0.045;
const MARKER_ABOVE = 0.06;

export class HandFxSystem extends createSystem({
  roots: { required: [VillageRoot] },
  villagers: { required: [VillagerView] },
}) {
  private shadows: Record<'left' | 'right', Group | null> = { left: null, right: null };
  private markers: Mesh[] = [];
  private head = new Vector3();
  private target = new Vector3();

  init(): void {
    for (let i = 0; i < RULES.village.maxVillagers; i++) {
      const m = makeHiddenMarker();
      this.world.createTransformEntity(m, { persistent: true });
      this.markers.push(m);
    }
  }

  private root(): Entity | undefined {
    for (const e of this.queries.roots.entities) return e;
    return undefined;
  }

  update(_delta: number, time: number): void {
    const active =
      game.stage === 'playing' && this.world.visibilityState.peek() === VisibilityState.Visible;
    this.updateShadows(active);
    this.updateMarkers(active, time);
  }

  // ---------------------------------------------------------------- Shadow

  private shadowFor(side: 'left' | 'right'): Group | null {
    if (this.shadows[side]) return this.shadows[side];
    const root = this.root();
    if (!root) return null;
    const g = makeHandShadow(`HandShadow:${side}`);
    makeOccludable(this.world.createTransformEntity(g, { parent: root, persistent: true }));
    this.shadows[side] = g;
    return g;
  }

  private updateShadows(active: boolean): void {
    for (const side of SIDES) {
      const h = game.presence.hands[side];
      const show = active && h.present && h.y > 0.003 && h.y < PRESENCE.shadowMaxHeight;
      const g = show ? this.shadowFor(side) : this.shadows[side];
      if (!g) continue;
      g.visible = show;
      if (!show) continue;
      const lift = h.y / PRESENCE.shadowMaxHeight;
      const grow = 1 + h.y * PRESENCE.shadowGrowPerMetre;
      const palm = g.children[0] as Mesh;
      (palm.material as MeshBasicMaterial).opacity = SHADOW_OPACITY * (1 - lift);
      this.placeBlob(palm, h.x, h.z, PALM_SHADOW * grow);
      for (let i = 0; i < 5; i++) {
        this.placeBlob(g.children[i + 1], h.tips[i * 2], h.tips[i * 2 + 1], TIP_SHADOW * grow);
      }
    }
  }

  private placeBlob(blob: { position: Vector3; scale: Vector3; visible: boolean }, x: number, z: number, size: number): void {
    blob.visible = Math.hypot(x, z) < RULES.village.radius * 0.97;
    blob.position.set(x, LAYOUT.baseHeight + 0.0015, z);
    blob.scale.setScalar(size);
  }

  // ---------------------------------------------------------------- Hidden markers

  private updateMarkers(active: boolean, time: number): void {
    for (const m of this.markers) m.visible = false;
    if (!active || (!hands.left.tracked && !hands.right.tracked)) return;
    this.player.head.getWorldPosition(this.head);
    let next = 0;
    for (const e of this.queries.villagers.entities) {
      const obj = e.object3D;
      const index = e.getValue(VillagerView, 'simIndex') ?? -1;
      const marker = this.markers[next];
      if (!obj || !marker || !obj.visible) continue;
      const v = game.sim.villagers[index];
      if (!v || v.dead || v.ride === 'ride') continue; // riders sit on top of the hand
      obj.getWorldPosition(this.target);
      this.target.y += 0.02;
      if (!this.hiddenBehindHand()) continue;
      marker.position.set(this.target.x, this.target.y + MARKER_ABOVE + Math.sin(time * 4 + index) * 0.004, this.target.z);
      marker.rotation.y = time * 2;
      marker.visible = true;
      next++;
    }
  }

  /** Does the line from the eyes to `target` pass through either hand? */
  private hiddenBehindHand(): boolean {
    const hx = this.head.x;
    const hy = this.head.y;
    const hz = this.head.z;
    const dx = this.target.x - hx;
    const dy = this.target.y - hy;
    const dz = this.target.z - hz;
    const len2 = dx * dx + dy * dy + dz * dz;
    if (len2 < 1e-6) return false;
    for (const side of SIDES) {
      const hand = hands[side];
      if (!hand.tracked) continue;
      if (this.blocks(hand.palm.x, hand.palm.y, hand.palm.z, PALM_RADIUS, hx, hy, hz, dx, dy, dz, len2)) return true;
      const j = hand.joints;
      for (let i = 0; i < JOINT_COUNT; i++) {
        if (this.blocks(j[i * 3], j[i * 3 + 1], j[i * 3 + 2], JOINT_RADIUS, hx, hy, hz, dx, dy, dz, len2)) return true;
      }
    }
    return false;
  }

  private blocks(
    px: number, py: number, pz: number, r: number,
    hx: number, hy: number, hz: number,
    dx: number, dy: number, dz: number, len2: number,
  ): boolean {
    const t = ((px - hx) * dx + (py - hy) * dy + (pz - hz) * dz) / len2;
    if (t <= 0.02 || t >= 0.97) return false;
    const cx = hx + dx * t - px;
    const cy = hy + dy * t - py;
    const cz = hz + dz * t - pz;
    return cx * cx + cy * cy + cz * cz < r * r;
  }
}
