/**
 * Lift power: villagers carry IWSDK's OneHandGrabbable, so a hand pinch lifts
 * them. This system tells the simulation who is carried, tracks where they
 * are over the table, shows a drop marker (gold over a field, hut or shrine)
 * and, on release, drops them into the job under them.
 */
import { createSystem, Grabbed, GrabSystem, Vector3 } from '@iwsdk/core';
import type { Entity, Mesh } from '@iwsdk/core';
import { makeDropMarker, DROP_IDLE, DROP_VALID } from '../art/drop-marker.ts';
import { plop, squeal } from '../audio/sfx.ts';
import { events } from '../core/events.ts';
import { buildingAt, dropVillager, liftVillager, moveCarried } from '../sim/powers.ts';
import { hurt } from '../sim/life.ts';
import { LAYOUT, LIFE } from '../sim/rules.ts';
import { guideAllows } from '../sim/tutorial.ts';
import { VillageRoot, VillagerView } from './components.ts';
import { game } from './game.ts';
import { guideNudge } from './guide-nudge.ts';

export class LiftSystem extends createSystem({
  held: { required: [VillagerView, Grabbed] },
  roots: { required: [VillageRoot] },
}) {
  private local = new Vector3();
  private markerMesh: Mesh | null = null;

  init(): void {
    this.cleanupFuncs.push(
      this.queries.held.subscribe('qualify', (e) => this.onLift(e)),
      this.queries.held.subscribe('disqualify', (e) => this.onDrop(e)),
    );
  }

  private root(): Entity | undefined {
    for (const e of this.queries.roots.entities) return e;
    return undefined;
  }

  private simId(e: Entity): string {
    return e.getValue(VillagerView, 'simId') ?? '';
  }

  /** Villager world position into village-root local space (table plane). */
  private toLocal(e: Entity): Vector3 | null {
    const root = this.root()?.object3D;
    const obj = e.object3D;
    if (!root || !obj) return null;
    obj.getWorldPosition(this.local);
    return root.worldToLocal(this.local);
  }

  private onLift(e: Entity): void {
    const lifted = game.sim.villagers[e.getValue(VillagerView, 'simIndex') ?? -1];
    if (game.stage !== 'playing' || !lifted || lifted.dead) {
      this.world.getSystem(GrabSystem)?.forceRelease(e);
      return;
    }
    // The tutorial teaches one thing at a time: no carrying before its step.
    if (!guideAllows(game.sim, 'lift')) {
      this.world.getSystem(GrabSystem)?.forceRelease(e);
      guideNudge();
      return;
    }
    if (liftVillager(game.sim, this.simId(e), events)) {
      squeal();
      console.info(`[lift] picked up ${this.simId(e)}`);
    }
    this.ensureMarker();
  }

  /** The marker is a child entity of the village root so it lies on the diorama. */
  private ensureMarker(): void {
    if (this.markerMesh) return;
    const root = this.root();
    if (!root) return;
    const mesh = makeDropMarker();
    mesh.visible = false;
    this.world.createTransformEntity(mesh, { parent: root, persistent: true });
    this.markerMesh = mesh;
  }

  private onDrop(e: Entity): void {
    if (this.markerMesh) this.markerMesh.visible = false;
    const p = this.toLocal(e);
    if (!p) return;
    const v = game.sim.villagers[e.getValue(VillagerView, 'simIndex') ?? -1];
    if (!v || !v.carried) return;
    const dropHeight = p.y - LAYOUT.baseHeight;
    const building = dropVillager(game.sim, v.id, p.x, p.z, events);
    plop(building !== undefined);
    // Dropped from high up: the god's hand never kills, but it can hurt.
    if (dropHeight > LIFE.hurtDropHeight) hurt(game.sim, v, events);
    console.info(`[lift] ${v.name} dropped on ${building ? building.id : 'open ground'} -> ${v.activity}`);
    // Stand upright again; SyncSystem lowers them back onto the table.
    e.object3D?.rotation.set(0, e.object3D.rotation.y, 0);
  }

  update(): void {
    const markerObj = this.markerMesh;
    let shown = false;
    for (const e of this.queries.held.entities) {
      const p = this.toLocal(e);
      if (!p) continue;
      moveCarried(game.sim, this.simId(e), p.x, p.z);
      if (markerObj) {
        const over = buildingAt(game.sim, p.x, p.z);
        markerObj.visible = true;
        shown = true;
        markerObj.position.set(
          over ? over.pos.x : p.x,
          LAYOUT.baseHeight + 0.004,
          over ? over.pos.z : p.z,
        );
        const mat = over ? DROP_VALID : DROP_IDLE;
        if (markerObj.material !== mat) markerObj.material = mat;
        markerObj.scale.setScalar(over ? 2.2 : 1);
      }
    }
    if (markerObj && !shown) markerObj.visible = false;
  }
}
