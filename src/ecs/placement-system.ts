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
 *
 * Moving it later takes a deliberate gesture (xr/village-carry.ts): both
 * palms up at opposite edges, held still while a ring fills, lifts the
 * village like a tray. It follows the hands; turning a palm over or
 * spreading the hands sets it down, gliding onto a table below if there is
 * one (else it stays afloat there). Not during the tutorial.
 *
 * The living desk: on a real surface (a plane or hit test) the diorama's
 * earth pedestal sinks into the desk and the village ground sits right on
 * it, with patches, paths and props growing out of the real desk and a
 * feathered edge of stones, twigs and moss. In mid-air (fallback, or while
 * carried) the solid diorama box comes back.
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
import { makeProgressRing, setRingProgress } from '../art/effects-art.ts';
import type { ProgressRing } from '../art/effects-art.ts';
import { chime, whoosh } from '../audio/sfx.ts';
import { events } from '../core/events.ts';
import { CARRY, LAYOUT, RULES } from '../sim/rules.ts';
import { aliveCount } from '../sim/life.ts';
import { guideAllows, startGuide } from '../sim/tutorial.ts';
import { startSession } from '../sim/world.ts';
import { setHintPanel } from '../ui/hint-panel.ts';
import { showToast, uiState } from '../ui/ui-state.ts';
import { fallbackPosition, fitVillage, isTableHeight } from '../xr/placement.ts';
import { hands } from '../xr/hand-state.ts';
import { carryReleased, handSpread, liftPose } from '../xr/village-carry.ts';
import { guideNudge } from './guide-nudge.ts';
import { DioramaView, VillageRoot } from './components.ts';
import { game } from './game.ts';

type State = 'idle' | 'arriving' | 'floating' | 'settling' | 'settled' | 'carried';
type Source = 'plane' | 'hit-test' | 'fallback';

/** Where the village sits in the flat browser preview (no XR). */
const DESKTOP_SPOT = new Vector3(0, 0.75, -0.35);
const SCAN_INTERVAL = 0.5;
/** Wait this long after entering XR so the head pose is real before arriving. */
const ARRIVE_DELAY = 0.5;

export class PlacementSystem extends createSystem({
  roots: { required: [VillageRoot] },
  planes: { required: [XRPlane] },
  dioramas: { required: [DioramaView] },
}) {
  /** 0 = diorama box, 1 = living desk; eases towards deskTarget. */
  private deskBlend = 0;
  private deskTarget = 0;
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
  // Carrying the village.
  private liftHold = 0;
  private liftRing: ProgressRing | null = null;
  private carryOffset = new Vector3();
  private carrySpread = 0;
  private mid = new Vector3();

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
    this.deskTarget = this.deskBlend = 0;
    this.state = 'idle';
    game.placementSource = 'fallback';
    game.stage = 'playing';
    uiState.placing = false;
    // The HTML welcome page (index.html) greets the player outside XR.
    setHintPanel(this.world, 'hidden');
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
    this.deskTarget = this.deskBlend = 0;
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
    this.updateDesk(delta);

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
    } else if (this.state === 'settled') {
      this.updateLift(root, delta);
    } else if (this.state === 'carried') {
      this.updateCarried(root, delta);
    } else if (this.state === 'settling') {
      this.settleT = Math.min(1, this.settleT + delta / LAYOUT.settleSeconds);
      const t = this.settleT;
      const ease = t * t * (3 - 2 * t); // smoothstep: a gentle glide
      obj.position.lerpVectors(this.settleFrom, this.settleTo, ease);
      obj.scale.setScalar(this.fromScale + (this.toScale - this.fromScale) * ease);
      if (t >= 1) this.finish(root, this.settleSource);
    }
  }

  // ---------------------------------------------------------------- Carrying it elsewhere

  private midpoint(out: Vector3): Vector3 {
    const l = hands.left.palm;
    const r = hands.right.palm;
    return out.set((l.x + r.x) / 2, (l.y + r.y) / 2, (l.z + r.z) / 2);
  }

  /** Settled: watch for the two-palm lift and fill a ring around the village. */
  private updateLift(root: Entity, delta: number): void {
    const obj = root.object3D!;
    const inXR = this.world.visibilityState.peek() !== VisibilityState.NonImmersive;
    const scale = obj.scale.x;
    this.tmp.copy(obj.position);
    this.tmp.y += LAYOUT.baseHeight * scale;
    const posed =
      inXR && !game.paused && liftPose(hands.left, hands.right, this.tmp, RULES.village.radius * scale);
    if (posed && !guideAllows(game.sim, 'move')) {
      // The tutorial comes first.
      this.liftHold += delta;
      if (this.liftHold > 0.5) guideNudge();
      if (this.liftRing) this.liftRing.visible = false;
      return;
    }
    this.liftHold = posed ? this.liftHold + delta : 0;
    const ring = this.ensureLiftRing(root);
    if (!ring) return;
    ring.visible = this.liftHold > 0.15;
    if (!ring.visible) return;
    const progress = Math.min(1, this.liftHold / CARRY.holdSeconds);
    setRingProgress(ring, progress, 0xffe7a8);
    if (progress >= 1) this.startCarry(root);
  }

  private ensureLiftRing(root: Entity): ProgressRing | null {
    if (this.liftRing) return this.liftRing;
    this.liftRing = makeProgressRing(RULES.village.radius + 0.025, 0xffe7a8);
    this.liftRing.position.y = LAYOUT.baseHeight + 0.004;
    this.liftRing.visible = false;
    this.world.createTransformEntity(this.liftRing, { parent: root, persistent: true });
    return this.liftRing;
  }

  private startCarry(root: Entity): void {
    const obj = root.object3D!;
    this.removeAnchor(root);
    this.state = 'carried';
    this.liftHold = 0;
    if (this.liftRing) this.liftRing.visible = false;
    game.moving = true;
    // Lifted into the air: the diorama box comes back.
    this.deskTarget = 0;
    this.carryOffset.subVectors(obj.position, this.midpoint(this.mid));
    this.carrySpread = handSpread(hands.left, hands.right);
    whoosh();
    showToast('Carrying the village', 'Lower it onto a table, then turn your palms over to set it down.', 5);
    console.info('[placement] the god lifts the village');
  }

  /** Carried: follow the hands; set down on letting go. */
  private updateCarried(root: Entity, delta: number): void {
    const obj = root.object3D!;
    const inXR = this.world.visibilityState.peek() !== VisibilityState.NonImmersive;
    if (!inXR || carryReleased(hands.left, hands.right, this.carrySpread)) {
      this.setDown(root);
      return;
    }
    this.midpoint(this.mid).add(this.carryOffset);
    obj.position.lerp(this.mid, 1 - Math.exp(-CARRY.followRate * Math.min(delta, 0.1)));
  }

  /** Let go: glide onto a table below if there is one, else stay afloat here. */
  private setDown(root: Entity): void {
    const obj = root.object3D!;
    game.moving = false;
    if (this.findTableBelow(obj.position, obj.scale.x)) {
      this.startSettle(obj);
      return;
    }
    showToast('No table there', 'The village floats where you left it. Lift it again to move it.', 5);
    this.finish(root, 'fallback');
  }

  /** The highest table-height plane below `pos` that the village fits on. */
  private findTableBelow(pos: Vector3, scale: number): boolean {
    const floor = this.floorY();
    let bestY = -Infinity;
    for (const e of this.queries.planes.entities) {
      try {
        const plane = e.getValue(XRPlane, '_plane') as (XRPlane & { semanticLabel?: string }) | undefined;
        const obj = e.object3D;
        if (!plane || !obj || plane.orientation !== 'horizontal') continue;
        obj.getWorldPosition(this.tmp);
        const labelled = plane.semanticLabel?.toLowerCase() === 'table';
        if (!labelled && !isTableHeight(this.tmp.y - floor)) continue;
        if (this.tmp.y > pos.y + 0.08 || this.tmp.y < pos.y - CARRY.dropReach || this.tmp.y <= bestY) continue;
        this.tmp2.copy(pos);
        obj.worldToLocal(this.tmp2);
        const fit = fitVillage(plane.polygon, { x: this.tmp2.x, z: this.tmp2.z }, RULES.village.radius * scale);
        if (!fit || Math.hypot(fit.x - this.tmp2.x, fit.z - this.tmp2.z) > RULES.village.radius) continue;
        bestY = this.tmp.y;
        this.settleTo.set(fit.x, 0, fit.z);
        obj.localToWorld(this.settleTo);
        this.toScale = Math.min(scale, fit.scale);
        this.settleSource = 'plane';
        this.sinkToDesk();
      } catch (err) {
        console.warn('[placement] bad plane', err);
      }
    }
    return bestY > -Infinity;
  }

  /**
   * A real surface: the village ground will sit on it (the pedestal sinks),
   * so lower the target by the pedestal's height.
   */
  private sinkToDesk(): void {
    this.settleTo.y -= (LAYOUT.baseHeight - LAYOUT.deskLift) * this.toScale;
  }

  /** Eases between the diorama box and the living desk. */
  private updateDesk(delta: number): void {
    const step = delta / LAYOUT.deskBlendSeconds;
    const before = this.deskBlend;
    this.deskBlend =
      this.deskTarget > this.deskBlend
        ? Math.min(this.deskTarget, this.deskBlend + step)
        : Math.max(this.deskTarget, this.deskBlend - step);
    for (const e of this.queries.dioramas.entities) {
      const d = e.object3D;
      if (!d) continue;
      const pedestal = d.getObjectByName('Pedestal');
      const edge = d.getObjectByName('DeskEdge');
      const b = this.deskBlend;
      const ease = b * b * (3 - 2 * b);
      if (pedestal) {
        // The earth slab sinks down into the desk (the real desk hides it).
        pedestal.scale.y = Math.max(0.001, 1 - ease);
        pedestal.visible = b < 0.999;
      }
      if (edge) {
        edge.visible = b > 0.3;
        edge.scale.setScalar(0.85 + 0.15 * ease);
      }
      if (before !== this.deskBlend && (b === 0 || b === 1)) {
        console.info(`[placement] ${b === 1 ? 'living desk: the village grows out of the desk' : 'diorama box'}`);
      }
    }
  }

  private startSettle(obj: NonNullable<Entity['object3D']>): void {
    this.deskTarget = this.settleSource === 'fallback' ? 0 : 1;
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
        this.sinkToDesk();
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
    this.sinkToDesk();
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
