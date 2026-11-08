/**
 * Drives the authored UIKit 'welcome-panel' in the flat browser view (title,
 * a one-line note that the game uses hands, and the Enter XR button). In XR
 * it is hidden; the canvas panels in UISystem take over.
 */
import type { UIKit, UIKitMLAsset, World } from '@iwsdk/core';

export type HintMode = 'welcome' | 'hidden';

const WELCOME: [string, string, string, string] = [
  'A TINY VILLAGE ON YOUR TABLE',
  'Tabletop Gods',
  'Sit at a table. This game uses your hands,',
  'not controllers. Put controllers down.',
];

let lastMode: HintMode | null = null;

function setText(panel: UIKitMLAsset, id: string, text: string): void {
  panel.getElementById<UIKit.Text>(id)?.setProperties({ text });
}

export function setHintPanel(world: World, mode: HintMode): void {
  const panel = world.getSceneObject<UIKitMLAsset>('welcome-panel');
  if (!panel || mode === lastMode) return;
  lastMode = mode;
  panel.visible = mode === 'welcome';
  if (mode === 'welcome') {
    const [eyebrow, heading, line1, line2] = WELCOME;
    setText(panel, 'eyebrow', eyebrow);
    setText(panel, 'heading', heading);
    setText(panel, 'line1', line1);
    setText(panel, 'line2', line2);
  }
}
