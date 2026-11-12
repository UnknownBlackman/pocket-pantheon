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

function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, filled: boolean): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  if (filled) {
    ctx.fillStyle = UI_COLORS.faith;
    ctx.fill();
  } else {
    ctx.lineWidth = 3;
    ctx.strokeStyle = UI_COLORS.dim;
    ctx.stroke();
  }
}

export interface DuskSummary {
  day: number;
  /** What the villagers call the god, e.g. 'the Storm-Caller'. */
  title: string;
  stars: number;
  faith: number;
  faithDelta: number;
  initiative: number;
  initiativeDelta: number;
  leaning: string;
  entries: string[];
}

function signed(n: number): string {
  const pct = Math.round(n * 100);
  return pct > 0 ? `+${pct}` : `${pct}`;
}

/** Dusk card: stars, belief changes, this session's chronicle, optional button. */
export function drawDusk(
  panel: CanvasPanel,
  d: DuskSummary,
  buttons: readonly PanelButton[],
  hot: string | null,
): void {
  const ctx = panel.begin();
  const w = panel.widthPx;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = UI_COLORS.title;
  ctx.font = `700 46px ${UI_FONT}`;
  ctx.fillText(`Dusk of day ${d.day}`, 36, 72);
  for (let i = 0; i < 5; i++) star(ctx, w - 230 + i * 44, 56, 18, i < d.stars);

  ctx.font = `italic 600 30px ${UI_FONT}`;
  ctx.fillStyle = UI_COLORS.title;
  if (d.title) ctx.fillText(`They call you ${d.title}`, 36, 116);

  ctx.font = `600 30px ${UI_FONT}`;
  ctx.fillStyle = UI_COLORS.faith;
  ctx.fillText(`Faith ${Math.round(d.faith * 100)} (${signed(d.faithDelta)})`, 36, 162);
  ctx.fillStyle = UI_COLORS.initiative;
  ctx.fillText(`Initiative ${Math.round(d.initiative * 100)} (${signed(d.initiativeDelta)})`, 360, 162);
  ctx.fillStyle = UI_COLORS.text;
  ctx.font = `500 28px ${UI_FONT}`;
  let y = wrapText(ctx, d.leaning, 36, 206, w - 72, 34, 2) + 8;

  ctx.fillStyle = UI_COLORS.dim;
  ctx.font = `500 24px ${UI_FONT}`;
  const bottom = buttons.length ? buttons[0].y - 16 : panel.heightPx - 30;
  for (const e of d.entries) {
    if (y > bottom - 30) break;
    y = wrapText(ctx, e, 36, y, w - 72, 30, 2) + 4;
  }
  drawButtons(panel, buttons, hot);
  panel.commit();
}

/** Chronicle card for the stone tablet: newest entries first. */
export function drawChronicle(panel: CanvasPanel, entries: string[]): void {
  const ctx = panel.begin();
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = UI_COLORS.title;
  ctx.font = `700 44px ${UI_FONT}`;
  ctx.fillText('The Chronicle', 36, 70);
  ctx.fillStyle = UI_COLORS.text;
  ctx.font = `500 26px ${UI_FONT}`;
  let y = 116;
  for (const e of entries) {
    if (y > panel.heightPx - 40) break;
    y = wrapText(ctx, e, 36, y, panel.widthPx - 72, 32, 3) + 6;
  }
  ctx.fillStyle = UI_COLORS.dim;
  ctx.font = `500 22px ${UI_FONT}`;
  ctx.fillText('Poke the tablet again to close.', 36, panel.heightPx - 26);
  panel.commit();
}
