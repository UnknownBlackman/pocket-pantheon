/**
 * Places and anchors the VillageRoot on the player's table.
 *
 * Fallback chain: a detected table plane, then a hand-ray hit test on a
 * table-height surface, then a floating platform 50 cm in front of the head
 * and 25 cm below eye level. A ghost ring shows the spot; the player can
 * pinch-drag the ring to move it and pinches the air (without grabbing the
 * ring) to confirm. Outside XR the village is planted at a fixed preview spot.
 */
import {
  createSystem,
  EnvironmentRaycastTarget,
  Grabbed,
  OneHandGrabbable,
  Quaternion,
  Vector3,
  VisibilityState,
  XRAnchor,
  XRPlane,
} from '@iwsdk/core';
import type { Entity } from '@iwsdk/core';
import { makeGhost, makeReticle } from '../art/ghost.ts';
import { events } from '../core/events.ts';
import { setHintPanel } from '../ui/hint-panel.ts';
import {
  fallbackPosition,
  isTableHeight,
  pickTablePlane,
  polygonArea,
} from '../xr/placement.ts';
import type { PlaneCandidate } from '../xr/placement.ts';
import { VillageRoot } from './components.ts';
import { game } from './game.ts';

type Hand = 'left' | 'right';
const HANDS: readonly Hand[] = ['left', 'right'];

/** Where the village sits in the flat browser preview (no XR). */
const DESKTOP_SPOT = new Vector3(0, 0.75, -0.35);
/** Seconds to wait for planes or a hit before using the fallback platform. */
const FALLBACK_AFTER = 1.5;
/** Ignore pinches right after placement starts (e.g. the Enter XR pinch). */
const CONFIRM_GRACE = 0.6;
const PLANE_SCAN_INTERVAL = 0.5;

export class PlacementSystem extends createSystem({
  roots: { required: [VillageRoot] },
  planes: { required: [XRPlane] },
}) {
  private state: 'idle' | 'searching' | 'confirmed' = 'idle';
  private source: 'none' | 'plane' | 'hit-test' | 'fallback' = 'none';
  private searchTime = 0;
  private planeScanIn = 0;
  private manual = false;
  private pinching: Record<Hand, boolean> = { left: false, right: false };
  private dragged: Record<Hand, boolean> = { left: false, right: false };
  private ghost!: Entity;
  private reticle: Entity | null = null;
  private tmpA = new Vector3();
  private tmpB = new Vector3();
  private tmpQ = new Quaternion();
  private up = new Vector3(0, 1, 0);
  private candidates: PlaneCandidate[] = [];
  private candidateEntities: Entity[] = [];

  init(): void {
    const ghostObject = makeGhost();
    ghostObject.visible = false;
    this.ghost = this.world.createTransformEntity(ghostObject, { persistent: true });
    this.ghost.addComponent(OneHandGrabbable, { rotate: false, translate: true });

    this.cleanupFuncs.push(
      this.world.visibilityState.subscribe((vis) => {
        if (vis === VisibilityState.NonImmersive) this.placeForDesktop();
        else if (vis === VisibilityState.Visible && this.state === 'idle') this.beginPlacement();
      }),
    );
    // Roots may be created after init; plant once one exists outside XR.
    this.cleanupFuncs.push(
      this.queries.roots.subscribe('qualify', () => {
        const vis = this.world.visibilityState.peek();
        if (vis === VisibilityState.NonImmersive) this.placeForDesktop();
        else if (this.state === 'idle') this.beginPlacement();
      }),
    );
  }

  private root(): Entity | undefined {
    for (const e of this.queries.roots.entities) return e;
    return undefined;
  }

  private placeForDesktop(): void {
    const root = this.root();
    if (!root?.object3D) return;
    this.removeAnchor(root);
    this.hideGhost();
    root.object3D.position.copy(DESKTOP_SPOT);
    root.object3D.rotation.set(0, 0, 0);
    root.object3D.visible = true;
    this.state = 'idle';
    game.placementSource = 'fallback';
    game.stage = 'playing';
    setHintPanel(this.world, 'welcome');
  }

  private beginPlacement(): void {
    const root = this.root();
    if (!root?.object3D) return;
    this.removeAnchor(root);
    root.object3D.visible = false;
    game.stage = 'placing';
    this.state = 'searching';
    this.source = 'none';
    this.searchTime = 0;
    this.planeScanIn = 0;
    this.manual = false;
    this.pinching.left = this.pinching.right = false;
    this.dragged.left = this.dragged.right = false;
    this.ensureReticle();
    setHintPanel(this.world, 'placing');
  }

  private ensureReticle(): void {
    if (this.reticle) return;
    try {
      const obj = makeReticle();
      obj.visible = false;
      this.reticle = this.world.createTransformEntity(obj, { persistent: true });
      this.reticle.addComponent(EnvironmentRaycastTarget, { space: 'right', maxDistance: 2 });
    } catch (err) {
      console.warn('[placement] hit test unavailable', err);
      this.reticle = null;
    }
  }

  private hideGhost(): void {
    const obj = this.ghost.object3D;
    if (obj) {
      obj.visible = false;
      obj.position.set(0, -100, 0); // out of reach so it cannot be grabbed
    }
  }

  private removeAnchor(root: Entity): void {
    try {
      if (root.hasComponent(XRAnchor)) root.removeComponent(XRAnchor);
    } catch (err) {
      console.warn('[placement] could not remove anchor', err);
    }
  }

  update(delta: number): void {
    if (this.state !== 'searching') return;
    const ghostObj = this.ghost.object3D;
    const root = this.root();
    if (!ghostObj || !root) return;
    this.searchTime += delta;

    const grabbed = this.ghost.hasComponent(Grabbed);
    if (grabbed) this.manual = true;

    if (!this.manual) this.autoPosition(delta);

    if (this.source !== 'none') {
      ghostObj.visible = true;
      setHintPanel(this.world, 'placing', ghostObj.position, this.headPosition(this.tmpB));
    }

    // Pinch the air (not the ring) to confirm.
    for (const hand of HANDS) {
      const sel = this.input.xr.getSelectState(hand);
      if (sel.start) {
        this.pinching[hand] = true;
        this.dragged[hand] = false;
      }
      if (this.pinching[hand] && grabbed) this.dragged[hand] = true;
      if (sel.end && this.pinching[hand]) {
        this.pinching[hand] = false;
        if (!this.dragged[hand] && this.source !== 'none' && this.searchTime > CONFIRM_GRACE) {
          this.confirm(root);
          return;
        }
      }
    }
  }

  private headPosition(out: Vector3): Vector3 {
    this.player.head.getWorldPosition(out);
    return out;
  }

  private floorY(): number {
    this.player.getWorldPosition(this.tmpA);
    return this.tmpA.y;
  }

  private autoPosition(delta: number): void {
    const ghostObj = this.ghost.object3D!;

    // 1. A detected table plane.
    this.planeScanIn -= delta;
    if (this.planeScanIn <= 0) {
      this.planeScanIn = PLANE_SCAN_INTERVAL;
      const plane = this.findTablePlane();
      if (plane?.object3D) {
        plane.object3D.getWorldPosition(ghostObj.position);
        this.setSource('plane');
        return;
      }
    }
    if (this.source === 'plane') return;

    // 2. The hand ray's hit on a table-height, upward-facing surface.
    const reticle = this.reticle;
    if (reticle?.object3D && reticle.getValue(EnvironmentRaycastTarget, 'xrHitTestResult')) {
      reticle.object3D.getWorldPosition(this.tmpA);
      reticle.object3D.getWorldQuaternion(this.tmpQ);
      this.tmpB.copy(this.up).applyQuaternion(this.tmpQ);
      if (this.tmpB.y > 0.9 && isTableHeight(this.tmpA.y - this.floorY())) {
        ghostObj.position.copy(this.tmpA);
        this.setSource('hit-test');
        return;
      }
    }

    // 3. The floating fallback platform, placed once; the player can drag it.
    if (this.source === 'none' && this.searchTime > FALLBACK_AFTER) {
      const head = this.headPosition(this.tmpA);
      this.player.head.getWorldQuaternion(this.tmpQ);
      this.tmpB.set(0, 0, -1).applyQuaternion(this.tmpQ);
      const yaw = Math.atan2(-this.tmpB.x, -this.tmpB.z);
      const p = fallbackPosition(head, yaw);
      ghostObj.position.set(p.x, p.y, p.z);
      this.setSource('fallback');
    }
  }

  private setSource(source: 'plane' | 'hit-test' | 'fallback'): void {
    if (this.source === source) return;
    this.source = source;
    console.info(`[placement] candidate from ${source}`);
  }

  private findTablePlane(): Entity | undefined {
    this.candidates.length = 0;
    this.candidateEntities.length = 0;
    const floor = this.floorY();
    for (const e of this.queries.planes.entities) {
      try {
        const plane = e.getValue(XRPlane, '_plane') as
          | (XRPlane & { semanticLabel?: string })
          | undefined;
        if (!plane || !e.object3D) continue;
        e.object3D.getWorldPosition(this.tmpA);
        this.candidates.push({
          height: this.tmpA.y - floor,
          area: polygonArea(plane.polygon),
          horizontal: plane.orientation === 'horizontal',
          label: plane.semanticLabel,
        });
        this.candidateEntities.push(e);
      } catch (err) {
        console.warn('[placement] bad plane', err);
      }
    }
    const i = pickTablePlane(this.candidates);
    return i >= 0 ? this.candidateEntities[i] : undefined;
  }

  private confirm(root: Entity): void {
    const ghostObj = this.ghost.object3D!;
    const rootObj = root.object3D!;
    rootObj.position.copy(ghostObj.position);
    // Face the village's front (+Z) towards the player.
    const head = this.headPosition(this.tmpA);
    rootObj.rotation.set(0, Math.atan2(head.x - rootObj.position.x, head.z - rootObj.position.z), 0);
    rootObj.visible = true;
    this.hideGhost();
    if (this.reticle?.object3D) {
      this.reticle.removeComponent(EnvironmentRaycastTarget);
      this.reticle.object3D.visible = false;
      this.reticle.dispose();
      this.reticle = null;
    }

    const source = this.source === 'none' ? 'fallback' : this.source;
    this.tryAnchor(root);
    this.state = 'confirmed';
    game.placementSource = source;
    game.stage = 'playing';
    setHintPanel(this.world, 'hidden');
    console.info(`[placement] village placed using ${source}`);
    events.emit('village.placed', { source });
  }

  private tryAnchor(root: Entity): void {
    try {
      const session = this.world.session as (XRSession & { enabledFeatures?: string[] }) | undefined;
      const features = session?.enabledFeatures;
      if (features && !features.includes('anchors')) {
        console.info('[placement] anchors not enabled; village is not anchored');
        return;
      }
      root.addComponent(XRAnchor);
      console.info('[placement] village anchored');
    } catch (err) {
      console.info('[placement] anchors unavailable; continuing without', err);
    }
  }
}
