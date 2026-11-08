/**
 * Drawing for the spatial panels. Each panel is a CanvasPanel; buttons are
 * canvas rectangles hit-tested against the index fingertip by UISystem.
 */
import { CanvasPanel, roundRect, UI_COLORS, UI_FONT, wrapText } from './canvas-panel.ts';

export interface PanelButton {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Hint card: a title and a wrapped body. */
export function drawHint(panel: CanvasPanel, title: string, body: string): void {
  const ctx = panel.begin();
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = UI_COLORS.title;
  ctx.font = `700 44px ${UI_FONT}`;
  ctx.fillText(title, 36, 74);
  ctx.fillStyle = UI_COLORS.text;
  ctx.font = `500 32px ${UI_FONT}`;
  wrapText(ctx, body, 36, 128, panel.widthPx - 72, 42, 4);
  panel.commit();
}

export function drawButtons(panel: CanvasPanel, buttons: readonly PanelButton[], hot: string | null): void {
  const ctx = panel.ctx;
  for (const b of buttons) {
    roundRect(ctx, b.x, b.y, b.w, b.h, 22);
    ctx.fillStyle = b.id === hot ? 'rgba(255, 211, 107, 0.95)' : 'rgba(255, 255, 255, 0.12)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = UI_COLORS.border;
    ctx.stroke();
    ctx.fillStyle = b.id === hot ? '#2a1c10' : UI_COLORS.text;
    ctx.font = `700 34px ${UI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 2);
    ctx.textAlign = 'left';
  }
}

/** Pause card with poke buttons. */
export function drawPause(panel: CanvasPanel, buttons: readonly PanelButton[], hot: string | null, note: string): void {
  const ctx = panel.begin();
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = UI_COLORS.title;
  ctx.font = `700 48px ${UI_FONT}`;
  ctx.fillText('Paused', 36, 78);
  ctx.fillStyle = UI_COLORS.text;
  ctx.font = `500 30px ${UI_FONT}`;
  wrapText(ctx, note, 36, 128, panel.widthPx - 72, 38, 2);
  drawButtons(panel, buttons, hot);
  panel.commit();
}
