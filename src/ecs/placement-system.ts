/**
 * Brings the village to the player's table, with no planting step.
 *
 * On entering XR the village appears at once, floating gently 50 cm in front
 * of the player and 25 cm below eye level, and the day begins with a welcome
 * message. Meanwhile it looks for the table:
 *   1. a detected horizontal plane at table height within reach: the village
 *      slides inward to fit, shrinking to no less than LAYOUT.minVillageScale
 *      on a small table (then it overhangs a little);
 *   2. otherwise a look-down hit test from the head onto a table-height surface.
 * When a surface is found it glides down onto it and is anchored there. If
 * none turns up within LAYOUT.surfaceSearchSeconds it stays afloat (and is
 * anchored where it floats). Outside XR the village sits at a preview spot.
 */
import {
  createSystem,
  EnvironmentRaycastTarget,
  Group,
  Quaternion,
  Vector3,
  VisibilityState,
  XRAnchor,
  XRPlane,
} from '@iwsdk/core';
import type { Entity } from '@iwsdk/core';
import { chime } from '../audio/sfx.ts';
import { events } from '../core/events.ts';
import { LAYOUT, RULES } from '../sim/rules.ts';
import { aliveCount } from '../sim/life.ts';
import { startGuide } from '../sim/tutorial.ts';
import { startSession } from '../sim/world.ts';
import { setHintPanel } from '../ui/hint-panel.ts';
import { showToast, uiState } from '../ui/ui-state.ts';
import { fallbackPosition, fitVillage, isTableHeight } from '../xr/placement.ts';
import { VillageRoot } from './components.ts';
import { game } from './game.ts';

type State = 'idle' | 'arriving' | 'floating' | 'settling' | 'settled';
type Source = 'plane' | 'hit-test' | 'fallback';

/** Where the village sits in the flat browser preview (no XR). */
const DESKTOP_SPOT = new Vector3(0, 0.75, -0.35);
const SCAN_INTERVAL = 0.5;
/** Wait this long after entering XR so the head pose is real before arriving. */
const ARRIVE_DELAY = 0.5;

export class PlacementSystem extends createSystem({
  roots: { required: [VillageRoot] },
  planes: { required: [XRPlane] },
}) {
  private state: State = 'idle';
  private searchTime = 0;
  private arriveIn = 0;
  private scanIn = 0;
  private floatBase = new Vector3();
  private settleFrom = new Vector3();
  private settleTo = new Vector3();
  private fromScale = 1;
  private toScale = 1;
  private settleT = 0;
  private settleSource: Source = 'fallback';
  private reticle: Entity | null = null;
  private head = new Vector3();
  private forward = new Vector3();
  private ahead = new Vector3();
  private tmp = new Vector3();
  private tmp2 = new Vector3();
  private headQ = new Quaternion();
  private up = new Vector3(0, 1, 0);

  init(): void {
    this.cleanupFuncs.push(
      this.world.visibilityState.subscribe((vis) => {
        if (vis === VisibilityState.NonImmersive) this.placeForDesktop();
        else if (vis === VisibilityState.Visible && this.state === 'idle') this.beginArrival();
      }),
      // Roots may be created after init.
      this.queries.roots.subscribe('qualify', () => {
        const vis = this.world.visibilityState.peek();
        if (vis === VisibilityState.NonImmersive) this.placeForDesktop();
        else if (this.state === 'idle') this.beginArrival();
      }),
    );
  }

  private root(): Entity | undefined {
    for (const e of this.queries.roots.entities) return e;
    return undefined;
  }

  // ---------------------------------------------------------------- Desktop

  private placeForDesktop(): void {
    const root = this.root();
    if (!root?.object3D) return;
    this.removeAnchor(root);
    this.dropReticle();
    root.object3D.position.copy(DESKTOP_SPOT);
    root.object3D.rotation.set(0, 0, 0);
    root.object3D.scale.setScalar(1);
    root.object3D.visible = true;
    this.state = 'idle';
    game.placementSource = 'fallback';
    game.stage = 'playing';
    uiState.placing = false;
    setHintPanel(this.world, 'welcome');
  }

  // ---------------------------------------------------------------- Arrival

  /** Entering XR: hide the village for a moment until head tracking is live. */
  private beginArrival(): void {
    const root = this.root();
    if (!root?.object3D) return;
    this.removeAnchor(root);
    root.object3D.visible = false;
    this.state = 'arriving';
    this.arriveIn = ARRIVE_DELAY;
    setHintPanel(this.world, 'hidden');
  }

  /** The village appears afloat in front of the player. */
  private arrive(): void {
    const root = this.root();
    const obj = root?.object3D;
    if (!root || !obj) return;
    this.removeAnchor(root);
    this.updateHead();
    this.floatBase.copy(this.ahead);
    obj.position.copy(this.floatBase);
    obj.rotation.set(0, Math.atan2(this.head.x - this.ahead.x, this.head.z - this.ahead.z), 0);
    obj.scale.setScalar(1);
    obj.visible = true;
    this.state = 'floating';
    this.searchTime = 0;
    this.scanIn = 0;
    game.stage = 'playing';
    uiState.placing = false;
    setHintPanel(this.world, 'hidden');
    this.ensureReticle();
    this.welcome();
    console.info('[placement] village arrived afloat; looking for the table');
  }

  /** The welcome message, and a new 3-day session when one is due. */
  private welcome(): void {
    if (game.newSessionOnPlace) {
      game.newSessionOnPlace = false;
      startSession(game.sim, events);
    }
    if (game.away) {
      showToast('While you were away', game.away.summary, 9);
      game.away = null;
    } else if (game.returning) {
      const title = game.sim.title ? `, ${game.sim.title}` : '';
      showToast(`Welcome back${title}`, `Your ${aliveCount(game.sim)} villagers remember you.`, 6);
    } else {
      showToast(
        'Welcome, little god',
        'This village is yours to guide. It will settle on your table when it finds one.',
        7,
      );
      // First visit: Elder Ama teaches the old ways (skippable).
      if (game.sim.guide.step === 'none') startGuide(game.sim, events);
    }
    game.returning = false;
  }

  // ---------------------------------------------------------------- Each frame

  update(delta: number, time: number): void {
    const root = this.root();
    const obj = root?.object3D;
    if (!root || !obj) return;

    if (this.state === 'arriving') {
      this.arriveIn -= delta;
      this.player.head.getWorldPosition(this.head);
      // Wait for a real head pose (not the origin before tracking starts).
      if (this.arriveIn <= 0 && this.head.y - this.floorY() > 0.3) this.arrive();
      return;
    }
    if (this.state === 'floating') {
      obj.position.copy(this.floatBase);
      obj.position.y += Math.sin(time * 1.4) * LAYOUT.floatBob;
      this.searchTime += delta;
      this.scanIn -= delta;
      if (this.scanIn <= 0) {
        this.scanIn = SCAN_INTERVAL;
        if (this.findSurface()) {
          this.startSettle(obj);
          return;
        }
      }
      if (this.searchTime >= LAYOUT.surfaceSearchSeconds) {
        // No table found: stay where it floats.
        obj.position.copy(this.floatBase);
        this.finish(root, 'fallback');
      }
    } else if (this.state === 'settling') {
      this.settleT = Math.min(1, this.settleT + delta / LAYOUT.settleSeconds);
      const t = this.settleT;
      const ease = t * t * (3 - 2 * t); // smoothstep: a gentle glide
      obj.position.lerpVectors(this.settleFrom, this.settleTo, ease);
      obj.scale.setScalar(this.fromScale + (this.toScale - this.fromScale) * ease);
      if (t >= 1) this.finish(root, this.settleSource);
    }
  }

  private startSettle(obj: NonNullable<Entity['object3D']>): void {
    this.state = 'settling';
    this.settleT = 0;
    this.settleFrom.copy(obj.position);
    this.fromScale = obj.scale.x;
    console.info(
      `[placement] found the table by ${this.settleSource}; settling at scale ${this.toScale.toFixed(2)}`,
    );
  }

  private finish(root: Entity, source: Source): void {
    this.state = 'settled';
    this.dropReticle();
    this.tryAnchor(root);
    game.placementSource = source;
    if (source !== 'fallback') chime();
    console.info(`[placement] village placed using ${source}`);
    events.emit('village.placed', { source });
  }

  // ---------------------------------------------------------------- Finding the table

  /** Head position, flat forward direction and the floating spot ahead. */
  private updateHead(): void {
    this.player.head.getWorldPosition(this.head);
    this.player.head.getWorldQuaternion(this.headQ);
    this.forward.set(0, 0, -1).applyQuaternion(this.headQ);
    this.forward.y = 0;
    if (this.forward.lengthSq() < 1e-6) this.forward.set(0, 0, -1);
    this.forward.normalize();
    const p = fallbackPosition(this.head, Math.atan2(-this.forward.x, -this.forward.z));
    this.ahead.set(p.x, p.y, p.z);
  }

  private floorY(): number {
    this.player.getWorldPosition(this.tmp);
    return this.tmp.y;
  }

  /** Reachable for a seated player: in front and within LAYOUT.maxReach. */
  private reachable(x: number, z: number): boolean {
    const dx = x - this.head.x;
    const dz = z - this.head.z;
    return Math.hypot(dx, dz) <= LAYOUT.maxReach && dx * this.forward.x + dz * this.forward.z > 0;
  }

  /** Writes settleTo / toScale / settleSource and returns true when a table is found. */
  private findSurface(): boolean {
    this.updateHead();
    return this.findPlane() || this.findHit();
  }

  private findPlane(): boolean {
    const floor = this.floorY();
    let bestScore = -Infinity;
    for (const e of this.queries.planes.entities) {
      try {
        const plane = e.getValue(XRPlane, '_plane') as (XRPlane & { semanticLabel?: string }) | undefined;
        const obj = e.object3D;
        if (!plane || !obj || plane.orientation !== 'horizontal') continue;
        obj.getWorldPosition(this.tmp);
        const labelled = plane.semanticLabel?.toLowerCase() === 'table';
        if (!labelled && !isTableHeight(this.tmp.y - floor)) continue;
        // Work in the plane's own space: its polygon lies in local x/z.
        this.tmp2.copy(this.ahead);
        obj.worldToLocal(this.tmp2);
        const fit = fitVillage(plane.polygon, { x: this.tmp2.x, z: this.tmp2.z }, RULES.village.radius, (x, z) => {
          this.tmp.set(x, 0, z);
          obj.localToWorld(this.tmp);
          return this.reachable(this.tmp.x, this.tmp.z);
        });
        if (!fit) continue;
        const score = fit.scale * 10 + (labelled ? 1 : 0) - (fit.overhang ? 5 : 0);
        if (score <= bestScore) continue;
        bestScore = score;
        this.settleTo.set(fit.x, 0, fit.z);
        obj.localToWorld(this.settleTo);
        this.toScale = fit.scale;
        this.settleSource = 'plane';
        if (fit.overhang) console.info('[placement] small table: the village overhangs a little');
      } catch (err) {
        console.warn('[placement] bad plane', err);
      }
    }
    return bestScore > -Infinity;
  }

  /** Look-down ray from the head onto an upward-facing, table-height surface. */
  private findHit(): boolean {
    const reticle = this.reticle;
    if (!reticle?.object3D || !reticle.getValue(EnvironmentRaycastTarget, 'xrHitTestResult')) return false;
    reticle.object3D.getWorldPosition(this.tmp);
    reticle.object3D.getWorldQuaternion(this.headQ);
    this.tmp2.copy(this.up).applyQuaternion(this.headQ);
    if (this.tmp2.y < 0.9 || !isTableHeight(this.tmp.y - this.floorY())) return false;
    if (!this.reachable(this.tmp.x, this.tmp.z)) return false;
    this.settleTo.copy(this.tmp);
    this.toScale = 1;
    this.settleSource = 'hit-test';
    return true;
  }

  private ensureReticle(): void {
    if (this.reticle) return;
    try {
      // An invisible marker that follows a ray from the head, tilted down.
      const marker = new Group();
      marker.name = 'TableProbe';
      this.reticle = this.world.createTransformEntity(marker, { persistent: true });
      const tilt = new Quaternion().setFromAxisAngle(
        new Vector3(1, 0, 0),
        (-LAYOUT.lookDownDegrees * Math.PI) / 180,
      );
      this.reticle.addComponent(EnvironmentRaycastTarget, {
        space: 'viewer',
        maxDistance: 1.5,
        offsetQuaternion: tilt,
      });
    } catch (err) {
      console.warn('[placement] hit test unavailable', err);
      this.reticle = null;
    }
  }

  private dropReticle(): void {
    if (!this.reticle) return;
    try {
      this.reticle.removeComponent(EnvironmentRaycastTarget);
      this.reticle.destroy();
    } catch {
      /* ignore */
    }
    this.reticle = null;
  }

  // ---------------------------------------------------------------- Anchors

  private removeAnchor(root: Entity): void {
    try {
      if (root.hasComponent(XRAnchor)) root.removeComponent(XRAnchor);
    } catch (err) {
      console.warn('[placement] could not remove anchor', err);
    }
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
