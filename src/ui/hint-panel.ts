/**
 * Drives the authored 'welcome-panel' as the single hint panel: the welcome
 * text in the browser, placement instructions in XR (floating just above the
 * ghost ring, facing the player, inside the central view), hidden in play.
 */
import type { UIKit, UIKitMLAsset, Vector3, World } from '@iwsdk/core';

export type HintMode = 'welcome' | 'placing' | 'hidden';

const TEXT: Record<Exclude<HintMode, 'hidden'>, [string, string, string, string]> = {
  welcome: [
    'A TINY VILLAGE ON YOUR TABLE',
    'Tabletop Gods',
    'Sit at a table. This game uses your hands,',
    'not controllers. Put controllers down.',
  ],
  placing: [
    'PLANT YOUR VILLAGE',
    'Choose a spot',
    'Pinch the ring and drag to move it.',
    'Pinch the air to plant your village.',
  ],
};

/** Authored transform of the panel in the browser view (see scene JSON). */
const WELCOME_POS = [0, 1.3, -0.75] as const;
const WELCOME_SCALE = 0.12;
/** Smaller in XR: about 30 cm wide at roughly half a metre. */
const XR_SCALE = 0.07;
/** Height of the panel centre above the ghost ring, metres. */
const ABOVE_GHOST = 0.2;

let lastMode: HintMode | null = null;

function setText(panel: UIKitMLAsset, id: string, text: string): void {
  panel.getElementById<UIKit.Text>(id)?.setProperties({ text });
}

export function setHintPanel(
  world: World,
  mode: HintMode,
  anchor?: Vector3,
  head?: Vector3,
): void {
  const panel = world.getSceneObject<UIKitMLAsset>('welcome-panel');
  if (!panel) return;

  if (mode !== lastMode) {
    lastMode = mode;
    panel.visible = mode !== 'hidden';
    if (mode !== 'hidden') {
      const [eyebrow, heading, line1, line2] = TEXT[mode];
      setText(panel, 'eyebrow', eyebrow);
      setText(panel, 'heading', heading);
      setText(panel, 'line1', line1);
      setText(panel, 'line2', line2);
    }
    if (mode === 'welcome') {
      panel.position.set(WELCOME_POS[0], WELCOME_POS[1], WELCOME_POS[2]);
      panel.rotation.set((-10 * Math.PI) / 180, 0, 0);
      panel.scale.setScalar(WELCOME_SCALE);
    } else if (mode === 'placing') {
      panel.scale.setScalar(XR_SCALE);
    }
  }

  if (mode === 'placing' && anchor && head) {
    panel.position.set(anchor.x, anchor.y + ABOVE_GHOST, anchor.z);
    // Panels face +Z: yaw towards the head, pitch slightly back.
    const yaw = Math.atan2(head.x - anchor.x, head.z - anchor.z);
    panel.rotation.set(0, yaw, 0, 'YXZ');
    panel.rotateX(-0.25);
  }
}
