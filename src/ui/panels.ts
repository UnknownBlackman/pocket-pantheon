/**
 * Drawing for the spatial panels. Each panel is a CanvasPanel; buttons are
 * canvas rectangles hit-tested against the index fingertip by UISystem.
 */
import { CanvasPanel, parchment, roundRect, rule, UI_BODY, UI_COLORS, UI_FONT, wrapText } from './canvas-panel.ts';

export interface PanelButton {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Hint card as an unrolled scroll: wooden rollers with knobs top and bottom,
 * an illuminated drop-cap on the title, a rubric rule and a red wax seal.
 */
export function drawHint(panel: CanvasPanel, title: string, body: string): void {
  const ctx = panel.ctx;
  const W = panel.widthPx;
  const H = panel.heightPx;
  ctx.clearRect(0, 0, W, H);
  // The sheet between the rollers.
  parchment(ctx, 34, 26, W - 68, H - 52, { radius: 6, flourishes: false });
  roller(ctx, 14, 8, W - 28, 30);
  roller(ctx, 14, H - 38, W - 28, 30);

  // Illuminated drop-cap: a gilt square with the title's first letter in red.
  const cap = title.charAt(0);
  const rest = title.slice(1);
  const cx = 62;
  const cy = 52;
  const cs = 62;
  const g = ctx.createLinearGradient(cx, cy, cx + cs, cy + cs);
  g.addColorStop(0, '#f2cf6a');
  g.addColorStop(1, '#b8862b');
  roundRect(ctx, cx, cy, cs, cs, 8);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#6a4526';
  ctx.stroke();
  ctx.fillStyle = UI_COLORS.title;
  ctx.font = `700 50px ${UI_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(cap, cx + cs / 2, cy + cs / 2 + 2);
  ctx.textAlign = 'left';

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = UI_COLORS.title;
  let size = 42;
  ctx.font = `700 ${size}px ${UI_FONT}`;
  while (ctx.measureText(rest).width > W - 230 && size > 28) {
    size -= 2;
    ctx.font = `700 ${size}px ${UI_FONT}`;
  }
  ctx.fillText(rest, cx + cs + 4, cy + cs - 14);
  rule(ctx, cx, cy + cs + 14, W - cx * 2);
  ctx.fillStyle = UI_COLORS.text;
  ctx.font = `700 28px ${UI_BODY}`;
  wrapText(ctx, body, cx, cy + cs + 52, W - cx * 2, 36, 4);
  seal(ctx, 70, H - 66);
  panel.commit();
}

/** A turned wooden scroll roller with knobs. */
function roller(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#a06a3c');
  g.addColorStop(0.45, '#6e4322');
  g.addColorStop(1, '#3e2410');
  roundRect(ctx, x + 14, y, w - 28, h, h / 2);
  ctx.fillStyle = g;
  ctx.fill();
  for (const kx of [x + 10, x + w - 10]) {
    ctx.beginPath();
    ctx.arc(kx, y + h / 2, h / 2 + 3, 0, Math.PI * 2);
    ctx.fillStyle = '#b8862b';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#5a3a1a';
    ctx.stroke();
  }
}

/** A red wax seal stamped with a little star. */
function seal(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.shadowColor = 'rgba(40, 0, 0, 0.4)';
  ctx.shadowBlur = 4;
  ctx.beginPath();
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const r = i % 2 ? 22 : 25;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fillStyle = '#9a2b20';
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(x, y, 15, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 210, 170, 0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 220, 180, 0.75)';
  ctx.font = `700 20px ${UI_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('✦', x, y + 1);
  ctx.textAlign = 'left';
}

export function drawButtons(panel: CanvasPanel, buttons: readonly PanelButton[], hot: string | null): void {
  const ctx = panel.ctx;
  for (const b of buttons) {
    // A small wooden plaque; it glows gold under the fingertip.
    roundRect(ctx, b.x, b.y, b.w, b.h, 14);
    const g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
    if (b.id === hot) {
      g.addColorStop(0, '#f6d27a');
      g.addColorStop(1, '#d9a740');
    } else {
      g.addColorStop(0, '#8a5a34');
      g.addColorStop(1, '#5e3a20');
    }
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#3a2414';
    ctx.stroke();
    ctx.fillStyle = b.id === hot ? '#3a2414' : '#f6ead0';
    let fs = 32;
    ctx.font = `700 ${fs}px ${UI_FONT}`;
    while (ctx.measureText(b.label).width > b.w - 20 && fs > 18) {
      fs -= 2;
      ctx.font = `700 ${fs}px ${UI_FONT}`;
    }
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
  ctx.font = `700 28px ${UI_BODY}`;
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
  ctx.font = `700 26px ${UI_BODY}`;
  let y = wrapText(ctx, d.leaning, 36, 206, w - 72, 34, 2) + 8;

  ctx.fillStyle = UI_COLORS.dim;
  ctx.font = `600 23px ${UI_BODY}`;
  const bottom = buttons.length ? buttons[0].y - 16 : panel.heightPx - 30;
  for (const e of d.entries) {
    if (y > bottom - 30) break;
    y = wrapText(ctx, e, 36, y, w - 72, 30, 2) + 4;
  }
  drawButtons(panel, buttons, hot);
  panel.commit();
}

/** Chronicle card for the stone tablet: newest entries first. */
export function drawChronicle(
  panel: CanvasPanel,
  entries: string[],
  title = 'The Chronicle',
  bullets = false,
): void {
  const ctx = panel.begin();
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = UI_COLORS.title;
  ctx.font = `700 44px ${UI_FONT}`;
  ctx.fillText(title, 36, 70);
  ctx.fillStyle = UI_COLORS.text;
  ctx.font = `600 25px ${UI_BODY}`;
  let y = 116;
  for (const e of entries) {
    if (y > panel.heightPx - 40) break;
    if (bullets) {
      // A small gold diamond before each happening.
      ctx.save();
      ctx.fillStyle = UI_COLORS.title;
      ctx.translate(44, y - 9);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-5, -5, 10, 10);
      ctx.restore();
      y = wrapText(ctx, e, 64, y, panel.widthPx - 100, 32, 3) + 10;
    } else {
      y = wrapText(ctx, e, 36, y, panel.widthPx - 72, 32, 3) + 6;
    }
  }
  ctx.fillStyle = UI_COLORS.dim;
  ctx.font = `600 21px ${UI_BODY}`;
  ctx.fillText('Poke the tablet again to close.', 36, panel.heightPx - 26);
  panel.commit();
}

/** A remembered villager: who lies in this grave, and their family. */
export function drawGraveCard(
  panel: CanvasPanel,
  g: { name: string; age: number; cause: string; day: number; parents: string[]; children: string[] },
): void {
  const ctx = panel.begin();
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = UI_COLORS.dim;
  ctx.font = `600 22px ${UI_BODY}`;
  ctx.fillText('Here lies', 32, 46);
  ctx.fillStyle = UI_COLORS.title;
  ctx.font = `700 46px ${UI_FONT}`;
  ctx.fillText(g.name, 32, 96);
  ctx.fillStyle = UI_COLORS.text;
  ctx.font = `600 24px ${UI_BODY}`;
  let y = 140;
  y = wrapText(ctx, `${g.age} years old. ${g.cause[0].toUpperCase()}${g.cause.slice(1)}, on day ${g.day}.`, 32, y, panel.widthPx - 64, 30, 2) + 6;
  if (g.parents.length) y = wrapText(ctx, `Child of ${listNames(g.parents)}.`, 32, y, panel.widthPx - 64, 30, 2) + 6;
  if (g.children.length) y = wrapText(ctx, `Parent of ${listNames(g.children)}.`, 32, y, panel.widthPx - 64, 30, 2) + 6;
  if (!g.parents.length && !g.children.length) wrapText(ctx, 'One of the first of the village.', 32, y, panel.widthPx - 64, 30, 2);
  ctx.fillStyle = UI_COLORS.dim;
  ctx.font = `600 19px ${UI_BODY}`;
  ctx.fillText('Remembered by the village.', 32, panel.heightPx - 22);
  panel.commit();
}

function listNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
