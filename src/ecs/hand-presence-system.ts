/**
 * Translates the player's tracked hands and head into village space for
 * sim/presence.ts: palm position and height above the diorama, palm up or
 * down, tilt, speed, fingertips; the head position; and detected waves and
 * raised hands. Runs every frame; the sim samples it at its fixed rate.
 */
import { createSystem, Quaternion, Vector3, VisibilityState } from '@iwsdk/core';
import type { Entity } from '@iwsdk/core';
import { SIDES } from '../sim/presence.ts';
import type { HandSample } from '../sim/presence.ts';
import { LAYOUT, PRESENCE, RULES, WAVE } from '../sim/rules.ts';
import { J, WaveDetector } from '../xr/gestures.ts';
import { hands } from '../xr/hand-state.ts';
import type { HandData } from '../xr/hand-state.ts';
import { VillageRoot } from './components.ts';
import { game } from './game.ts';

const TIPS = [J.thumbTip, J.indexTip, J.middleTip, J.ringTip, J.pinkyTip] as const;
const RAD_TO_DEG = 180 / Math.PI;

export class HandPresenceSystem extends createSystem({
  roots: { required: [VillageRoot] },
}) {
  private v = new Vector3();
  private rootQ = new Quaternion();
  private headQ = new Quaternion();
  private headWorld = new Vector3();
  private right = new Vector3();
  private waves = { left: new WaveDetector(), right: new WaveDetector() };
  private raisedArmed = true;

  private root(): Entity | undefined {
    for (const e of this.queries.roots.entities) return e;
    return undefined;
  }

  update(delta: number): void {
    const p = game.presence;
    const rootObj = this.root()?.object3D;
    const active =
      !!rootObj &&
      game.stage === 'playing' &&
      !game.paused &&
      this.world.visibilityState.peek() === VisibilityState.Visible;
    if (!active) {
      p.hands.left.present = p.hands.right.present = false;
      p.headPresent = false;
      p.headNear = false;
      return;
    }
    rootObj!.updateWorldMatrix(true, false);
    rootObj!.getWorldQuaternion(this.rootQ).invert();

    // Head in village space.
    this.player.head.getWorldPosition(this.headWorld);
    this.v.copy(this.headWorld);
    rootObj!.worldToLocal(this.v);
    p.headPresent = true;
    p.head.x = this.v.x;
    p.head.y = this.v.y - LAYOUT.baseHeight;
    p.head.z = this.v.z;
    p.headNear =
      p.head.y < PRESENCE.headNearHeight &&
      Math.hypot(p.head.x, p.head.z) < RULES.village.radius + PRESENCE.headNearDistance;

    // The head's right axis, for side-to-side waves.
    this.player.head.getWorldQuaternion(this.headQ);
    this.right.set(1, 0, 0).applyQuaternion(this.headQ);

    for (const side of SIDES) this.sampleHand(hands[side], p.hands[side], rootObj!, delta);
    this.detectWave(delta);
    this.detectRaisedHands();
  }

  private sampleHand(src: HandData, out: HandSample, rootObj: NonNullable<Entity['object3D']>, delta: number): void {
    if (!src.tracked) {
      out.present = false;
      return;
    }
    out.present = true;
    this.v.set(src.palm.x, src.palm.y, src.palm.z);
    rootObj.worldToLocal(this.v);
    out.x = this.v.x;
    out.y = this.v.y - LAYOUT.baseHeight;
    out.z = this.v.z;
    // Palm normal in village space.
    this.v.set(src.normal.x, src.normal.y, src.normal.z).applyQuaternion(this.rootQ);
    const ny = Math.max(-1, Math.min(1, this.v.y));
    out.tilt = Math.acos(ny) * RAD_TO_DEG; // 0 = palm straight up
    out.palmUp = ny > 0.7;
    out.open = src.open;
    out.speed = src.palmSpeed;
    out.still = src.palmSpeed < PRESENCE.stillSpeed;
    const j = src.joints;
    for (let i = 0; i < TIPS.length; i++) {
      const t = TIPS[i];
      this.v.set(j[t * 3], j[t * 3 + 1], j[t * 3 + 2]);
      rootObj.worldToLocal(this.v);
      out.tips[i * 2] = this.v.x;
      out.tips[i * 2 + 1] = this.v.z;
    }
    void delta;
  }

  /** An open hand waved side to side above the village. */
  private detectWave(delta: number): void {
    const p = game.presence;
    for (const side of SIDES) {
      const src = hands[side];
      const h = p.hands[side];
      const eligible =
        h.present &&
        src.open &&
        h.y >= WAVE.minHeight &&
        Math.hypot(h.x, h.z) < RULES.village.radius + 0.3;
      if (!eligible) {
        this.waves[side].reset();
        continue;
      }
      const lateral = src.palm.x * this.right.x + src.palm.y * this.right.y + src.palm.z * this.right.z;
      if (this.waves[side].update(lateral, delta)) {
        p.waveCount++;
        console.info('[presence] the god waved');
      }
    }
  }

  /** Both open hands raised to eye level: the village cheers (once per raise). */
  private detectRaisedHands(): void {
    const p = game.presence;
    const l = hands.left;
    const r = hands.right;
    const eye = this.headWorld.y + WAVE.raisedAboveEye;
    const raised = l.tracked && r.tracked && l.open && r.open && l.palm.y > eye && r.palm.y > eye;
    if (raised && this.raisedArmed) {
      this.raisedArmed = false;
      p.cheerCount++;
      console.info('[presence] the god raised both hands');
    } else if (!raised) {
      this.raisedArmed = true;
    }
  }
}
