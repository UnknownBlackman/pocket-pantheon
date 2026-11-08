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
import { LAYOUT } from '../sim/rules.ts';
import { setHintPanel } from '../ui/hint-panel.ts';
import { showToast, uiState } from '../ui/ui-state.ts';
import { startSession } from '../sim/world.ts';
import {
  fallbackPosition,
  isTableHeight,
  pickTablePlane,
  pointInPolygon,
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
  private candidateSpots: Vector3[] = [];
  private ahead = new Vector3();
  private forward = new Vector3();
  private head = new Vector3();
  private planeSpot = new Vector3();

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
    uiState.placing = false;
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
    // In XR the canvas hint panel (UISystem) explains placement.
    setHintPanel(this.world, 'hidden');
    uiState.placing = true;
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
      uiState.anchor.x = ghostObj.position.x;
      uiState.anchor.y = ghostObj.position.y;
      uiState.anchor.z = ghostObj.position.z;
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
      if (this.findTablePlane(this.planeSpot)) {
        ghostObj.position.copy(this.planeSpot);
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
      this.updateHeadFrame();
      const reach = Math.hypot(this.tmpA.x - this.head.x, this.tmpA.z - this.head.z);
      if (this.tmpB.y > 0.9 && isTableHeight(this.tmpA.y - this.floorY()) && reach <= LAYOUT.maxReach) {
        ghostObj.position.copy(this.tmpA);
        this.setSource('hit-test');
        return;
      }
    }

    // 3. The floating fallback platform, placed once; the player can drag it.
    if (this.source === 'none' && this.searchTime > FALLBACK_AFTER) {
      this.updateHeadFrame();
      ghostObj.position.copy(this.ahead);
      this.setSource('fallback');
    }
  }

  /** Head position, flat forward direction and the fallback spot ahead. */
  private updateHeadFrame(): void {
    this.headPosition(this.head);
    this.player.head.getWorldQuaternion(this.tmpQ);
    this.forward.set(0, 0, -1).applyQuaternion(this.tmpQ);
    this.forward.y = 0;
    if (this.forward.lengthSq() < 1e-6) this.forward.set(0, 0, -1);
    this.forward.normalize();
    const yaw = Math.atan2(-this.forward.x, -this.forward.z);
    const p = fallbackPosition(this.head, yaw);
    this.ahead.set(p.x, p.y, p.z);
  }

  private setSource(source: 'plane' | 'hit-test' | 'fallback'): void {
    if (this.source === source) return;
    this.source = source;
    console.info(`[placement] candidate from ${source}`);
  }

  /** Finds a reachable table spot on a detected plane; writes it to `out`. */
  private findTablePlane(out: Vector3): boolean {
    this.updateHeadFrame();
    this.candidates.length = 0;
    const floor = this.floorY();
    let n = 0;
    for (const e of this.queries.planes.entities) {
      try {
        const plane = e.getValue(XRPlane, '_plane') as
          | (XRPlane & { semanticLabel?: string })
          | undefined;
        const obj = e.object3D;
        if (!plane || !obj) continue;
        if (!this.candidateSpots[n]) this.candidateSpots[n] = new Vector3();
        const spot = this.candidateSpots[n];
        // Is the spot 50 cm ahead over this plane? Test in plane space.
        this.tmpA.copy(this.ahead);
        obj.worldToLocal(this.tmpA);
        const containsAhead = pointInPolygon(this.tmpA.x, this.tmpA.z, plane.polygon);
        obj.getWorldPosition(spot);
        if (containsAhead) spot.set(this.ahead.x, spot.y, this.ahead.z);
        this.tmpB.set(spot.x - this.head.x, 0, spot.z - this.head.z);
        this.candidates.push({
          height: spot.y - floor,
          horizontal: plane.orientation === 'horizontal',
          label: plane.semanticLabel,
          reach: this.tmpB.length(),
          inFront: this.tmpB.dot(this.forward) > 0,
          containsAhead,
        });
        n++;
      } catch (err) {
        console.warn('[placement] bad plane', err);
      }
    }
    const i = pickTablePlane(this.candidates);
    if (i < 0) return false;
    out.copy(this.candidateSpots[i]);
    return true;
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
    this.startOrResumeSession();
    this.state = 'confirmed';
    game.placementSource = source;
    game.stage = 'playing';
    uiState.placing = false;
    setHintPanel(this.world, 'hidden');
    console.info(`[placement] village placed using ${source}`);
    events.emit('village.placed', { source });
  }

  /** Coming back: start a new 3-day session if due, and say what changed. */
  private startOrResumeSession(): void {
    if (game.newSessionOnPlace) {
      game.newSessionOnPlace = false;
      startSession(game.sim, events);
    }
    if (game.away) {
      showToast('While you were away', game.away.summary, 9);
      game.away = null;
    } else if (game.returning) {
      showToast('Welcome back', `Your ${game.sim.villagers.length} villagers remember you.`, 5);
    }
    game.returning = false;
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
