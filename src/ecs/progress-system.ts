/**
 * Shows how the village has grown (sim/progress.ts):
 * - stepping stones along the routes villagers walk most (one instanced
 *   mesh, rebuilt every few seconds);
 * - hut upgrades: a cobbled apron, then a garden;
 * - golden carvings on the chronicle tablet, one per finished session.
 */
import {
  createSystem,
  CylinderGeometry,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from '@iwsdk/core';
import type { Entity } from '@iwsdk/core';
import { HUE } from '../scene-assets/village-materials.ts';
import { buildingAt } from '../sim/powers.ts';
import { hutTier, pathStones, tabletCarvings } from '../sim/progress.ts';
import { LAYOUT } from '../sim/rules.ts';
import { BuildingView, ChronicleTablet, VillageRoot } from './components.ts';
import { game } from './game.ts';
import { makeOccludable } from './occlusion.ts';

const MAX_STONES = 400;
const REFRESH_SECONDS = 4;

export class ProgressSystem extends createSystem({
  roots: { required: [VillageRoot] },
  buildings: { required: [BuildingView] },
  tablets: { required: [ChronicleTablet] },
}) {
  private stones: InstancedMesh | null = null;
  private refreshIn = 0;
  private lastKey = '';
  private m = new Matrix4();
  private q = new Quaternion();
  private p = new Vector3();
  private s = new Vector3();
  private up = new Vector3(0, 1, 0);

  private root(): Entity | undefined {
    for (const e of this.queries.roots.entities) return e;
    return undefined;
  }

  private ensureStones(): InstancedMesh | null {
    if (this.stones) return this.stones;
    const root = this.root();
    if (!root) return null;
    const geo = new CylinderGeometry(0.0052, 0.0058, 0.0012, 7);
    const mat = new MeshStandardMaterial({ color: HUE.stoneLight, roughness: 0.95, flatShading: true });
    const mesh = new InstancedMesh(geo, mat, MAX_STONES);
    mesh.name = 'PathStones';
    mesh.count = 0;
    mesh.position.y = LAYOUT.baseHeight + 0.0006;
    makeOccludable(this.world.createTransformEntity(mesh, { parent: root, persistent: true }));
    this.stones = mesh;
    return mesh;
  }

  update(delta: number): void {
    this.refreshIn -= delta;
    if (this.refreshIn > 0) return;
    this.refreshIn = REFRESH_SECONDS;
    const sim = game.sim;
    this.updateStones();

    const tier = hutTier(sim);
    const carvings = tabletCarvings(sim);
    const key = `${tier}|${carvings}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    for (const e of this.queries.buildings.entities) {
      if (e.getValue(BuildingView, 'kind') !== 'hut' || !e.object3D) continue;
      const apron = e.object3D.getObjectByName('Apron');
      const garden = e.object3D.getObjectByName('Garden');
      if (apron) apron.visible = tier >= 1;
      if (garden) garden.visible = tier >= 2;
    }
    for (const e of this.queries.tablets.entities) {
      for (let i = 0; i < 6; i++) {
        const c = e.object3D?.getObjectByName(`Carving${i}`);
        if (c) c.visible = i < carvings;
      }
    }
    console.info(`[progress] huts tier ${tier}, ${carvings} carving${carvings === 1 ? '' : 's'} on the tablet`);
  }

  /** Worn paths: a stepping stone in every busy cell, sized by wear. */
  private updateStones(): void {
    const mesh = this.ensureStones();
    if (!mesh) return;
    const sim = game.sim;
    let n = 0;
    for (const st of pathStones(sim)) {
      if (n >= MAX_STONES) break;
      if (buildingAt(sim, st.x, st.z)) continue;
      // A fixed jitter and turn per cell, so stones do not shuffle on refresh.
      const h = Math.sin(st.x * 12.9898 + st.z * 78.233) * 43758.5453;
      const r = h - Math.floor(h);
      this.p.set(st.x + (r - 0.5) * 0.006, 0, st.z + (r * 7 % 1 - 0.5) * 0.006);
      this.q.setFromAxisAngle(this.up, r * Math.PI * 2);
      const size = 0.6 + st.wear * 0.5;
      this.s.set(size, 1, size * (0.8 + r * 0.3));
      this.m.compose(this.p, this.q, this.s);
      mesh.setMatrixAt(n++, this.m);
    }
    if (n !== mesh.count || n > 0) {
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
