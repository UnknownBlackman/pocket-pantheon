/**
 * In the flat browser view (the welcome page), the camera circles the
 * village slowly so it reads as alive behind the welcome card. The view is
 * nudged so the village sits to the right of the card on wide screens.
 */
import { createSystem, Vector3, VisibilityState } from '@iwsdk/core';
import type { Entity } from '@iwsdk/core';
import { VillageRoot } from './components.ts';

const RADIUS = 0.72;
const HEIGHT = 0.36;
const SPEED = 0.08;

export class PreviewCameraSystem extends createSystem({
  roots: { required: [VillageRoot] },
}) {
  private target = new Vector3();

  update(_delta: number, time: number): void {
    if (this.world.visibilityState.peek() !== VisibilityState.NonImmersive) return;
    let root: Entity | undefined;
    for (const e of this.queries.roots.entities) root = e;
    const obj = root?.object3D;
    if (!obj) return;
    obj.getWorldPosition(this.target);
    this.target.y += 0.03;
    const a = time * SPEED;
    const cam = this.camera;
    cam.position.set(
      this.target.x + Math.sin(a) * RADIUS,
      this.target.y + HEIGHT,
      this.target.z + Math.cos(a) * RADIUS,
    );
    cam.lookAt(this.target);
    // Wide screens: shift the village right of the welcome card.
    if (window.innerWidth > 820 && window.innerWidth > window.innerHeight) cam.rotateY(0.28);
  }
}
