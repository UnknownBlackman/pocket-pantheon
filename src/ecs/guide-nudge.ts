/**
 * When the player tries something the tutorial has not reached yet, the hint
 * panel briefly reminds them what to do first. Rate-limited so a hand that
 * keeps trying does not flicker the panel.
 */
import { guideStep } from '../sim/tutorial.ts';
import { showToast, uiState } from '../ui/ui-state.ts';
import { game } from './game.ts';

const GAP_SECONDS = 4;
let lastAt = -GAP_SECONDS;

export function guideNudge(): void {
  const step = guideStep(game.sim);
  if (!step) return;
  if (uiState.time - lastAt < GAP_SECONDS) return;
  lastAt = uiState.time;
  showToast(`First: ${step.title}`, step.body, 3);
}
