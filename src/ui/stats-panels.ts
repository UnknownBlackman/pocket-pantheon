/**
 * The player's stats, drawn two ways:
 * - the village signboard: a painted wooden board on a post at the rim,
 *   always there (day and time, weather, Favor, Faith and Initiative,
 *   villagers and food);
 * - the palm card: a parchment card that appears over the left palm when
 *   the player turns it towards their face (believers, independents, those
 *   waiting on the god, the hungry, the remembered dead, the balance).
 */
import type { CanvasPanel } from './canvas-panel.ts';
import { diamond, drawBar, parchment, roundRect, rule, UI_BODY, UI_COLORS, UI_FONT } from './canvas-panel.ts';

export interface VillageStats {
  day: number;
  timeLabel: string;
  weather: 'clear' | 'drought' | 'storm';
  favor: number;
  favorMax: number;
  faith: number;
  initiative: number;
  alive: number;
  children: number;
  food: number;
  title: string;
}

export interface PeopleStats {
  believers: number;
  independent: number;
  waiting: number;
  hungry: number;
  remembered: number;
  alive: number;
  faith: number;
  initiative: number;
  title: string;
}

/** What the balance between Faith and Initiative says about the village. */
export function balanceVerdict(faith: number, initiative: number): { text: string; color: string } {
  const gap = faith - initiative;
  if (gap > 0.2) return { text: 'Leaning on you', color: '#c06a1e' };
  if (gap < -0.2) return { text: 'Drifting from you', color: '#2f6aa0' };
  return { text: 'In balance', color: '#4f7a2a' };
}

// ------------------------------------------------------------------ Signboard

const CREAM = '#fbefd2';
const PAINT_DIM = '#e2c99a';

function paint(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, font: string, color = CREAM): void {
  ctx.font = font;
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(30, 14, 4, 0.85)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function board(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;
  roundRect(ctx, 8, 8, w - 16, h - 16, 14);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#8a5a34');
  g.addColorStop(1, '#5e3a20');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
  // Planks and grain.
  ctx.strokeStyle = 'rgba(40, 20, 6, 0.45)';
  ctx.lineWidth = 2;
  for (let i = 1; i < 4; i++) {
    const y = 8 + ((h - 16) * i) / 4;
    ctx.beginPath();
    ctx.moveTo(14, y);
    ctx.lineTo(w - 14, y);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255, 220, 170, 0.08)';
  for (let i = 0; i < 18; i++) {
    const y = 16 + i * ((h - 32) / 18);
    ctx.beginPath();
    ctx.moveTo(20, y);
    ctx.bezierCurveTo(w * 0.3, y + 4, w * 0.6, y - 4, w - 20, y + 2);
    ctx.stroke();
  }
  // Frame and nails.
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#3e2410';
  roundRect(ctx, 8, 8, w - 16, h - 16, 14);
  ctx.stroke();
  for (const [x, y] of [[24, 24], [w - 24, 24], [24, h - 24], [w - 24, h - 24]]) {
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#b8b0a2';
    ctx.fill();
    ctx.strokeStyle = '#3a3a3e';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function weatherIcon(ctx: CanvasRenderingContext2D, kind: VillageStats['weather'], x: number, y: number): void {
  if (kind === 'storm') {
    ctx.fillStyle = '#9aa2ae';
    for (const [dx, dy, r] of [[-12, 2, 13], [4, -6, 16], [18, 3, 12]]) {
      ctx.beginPath();
      ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffd34a';
    ctx.beginPath();
    ctx.moveTo(x + 2, y + 8);
    ctx.lineTo(x - 6, y + 26);
    ctx.lineTo(x + 2, y + 24);
    ctx.lineTo(x - 2, y + 38);
    ctx.lineTo(x + 10, y + 18);
    ctx.lineTo(x + 3, y + 20);
    ctx.closePath();
    ctx.fill();
    return;
  }
  const color = kind === 'drought' ? '#ff8a3a' : '#ffd34a';
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * 19, y + Math.sin(a) * 19);
    ctx.lineTo(x + Math.cos(a) * 27, y + Math.sin(a) * 27);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(x, y, 14, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

export function drawSignboard(panel: CanvasPanel, s: VillageStats): void {
  const ctx = panel.ctx;
  const W = panel.widthPx;
  const H = panel.heightPx;
  board(ctx, W, H);
  ctx.textBaseline = 'alphabetic';
  paint(ctx, `Day ${s.day}`, 40, 72, `700 44px ${UI_FONT}`);
  paint(ctx, s.timeLabel, 40 + 150, 70, `700 30px ${UI_BODY}`, PAINT_DIM);
  weatherIcon(ctx, s.weather, W - 70, 54);
  const weatherWord = s.weather === 'clear' ? 'Fair' : s.weather === 'drought' ? 'Drought' : 'Storm';
  ctx.textAlign = 'right';
  paint(ctx, weatherWord, W - 108, 70, `700 28px ${UI_BODY}`, PAINT_DIM);
  ctx.textAlign = 'left';

  // Favor gems.
  paint(ctx, 'Favor', 40, 132, `700 30px ${UI_BODY}`);
  for (let i = 0; i < s.favorMax; i++) {
    const fill = s.favor - i;
    const x = 170 + i * 30;
    diamond(ctx, x, 121, 11, fill >= 1 ? '#ffcf4a' : fill > 0 ? '#c9a25a' : 'rgba(30, 14, 4, 0.55)');
  }
  paint(ctx, `${Math.floor(s.favor)}/${s.favorMax}`, 480, 132, `700 28px ${UI_BODY}`, PAINT_DIM);

  // Faith and Initiative, inked onto a small parchment inset.
  parchment(ctx, 30, 156, W - 60, 120, { radius: 10, flourishes: false });
  drawBar(ctx, 'Faith', s.faith, UI_COLORS.faith, 50, 190, W - 100);
  drawBar(ctx, 'Initiative', s.initiative, UI_COLORS.initiative, 50, 228, W - 100);
  const v = balanceVerdict(s.faith, s.initiative);
  ctx.fillStyle = v.color;
  ctx.font = `800 22px ${UI_BODY}`;
  ctx.textAlign = 'center';
  ctx.fillText(v.text, W / 2, 262);
  ctx.textAlign = 'left';

  const people = `${s.alive} villagers${s.children ? `, ${s.children} young` : ''}`;
  paint(ctx, people, 40, 322, `700 28px ${UI_BODY}`);
  ctx.textAlign = 'right';
  paint(ctx, `Food ${Math.round(s.food)}`, W - 40, 322, `700 28px ${UI_BODY}`);
  ctx.textAlign = 'left';
  if (s.title) {
    ctx.textAlign = 'center';
    paint(ctx, `They call you ${s.title}`, W / 2, 364, `italic 700 24px ${UI_FONT}`, PAINT_DIM);
    ctx.textAlign = 'left';
  }
  panel.commit();
}

// ------------------------------------------------------------------ Palm card

export function drawPalmCard(panel: CanvasPanel, p: PeopleStats): void {
  const ctx = panel.begin();
  const W = panel.widthPx;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = UI_COLORS.title;
  ctx.font = `700 36px ${UI_FONT}`;
  ctx.fillText('Your people', 36, 62);
  rule(ctx, 36, 80, W - 72);
  const rows: Array<[string, string, string]> = [
    ['Believers', `${p.believers} of ${p.alive}`, UI_COLORS.faith],
    ['Act on their own', `${p.independent}`, UI_COLORS.initiative],
    ['Waiting on you', `${p.waiting}`, p.waiting > 0 ? UI_COLORS.bad : UI_COLORS.good],
    ['Hungry', `${p.hungry}`, p.hungry > 0 ? UI_COLORS.warn : UI_COLORS.good],
    ['Remembered', `${p.remembered}`, UI_COLORS.dim],
  ];
  let y = 118;
  for (const [label, value, color] of rows) {
    ctx.fillStyle = UI_COLORS.text;
    ctx.font = `700 26px ${UI_BODY}`;
    ctx.fillText(label, 40, y);
    ctx.fillStyle = color;
    ctx.font = `800 28px ${UI_BODY}`;
    ctx.textAlign = 'right';
    ctx.fillText(value, W - 40, y);
    ctx.textAlign = 'left';
    y += 38;
  }
  const v = balanceVerdict(p.faith, p.initiative);
  ctx.fillStyle = v.color;
  ctx.font = `800 26px ${UI_BODY}`;
  ctx.textAlign = 'center';
  ctx.fillText(v.text, W / 2, y + 8);
  if (p.title) {
    ctx.fillStyle = UI_COLORS.dim;
    ctx.font = `italic 700 22px ${UI_FONT}`;
    ctx.fillText(`They call you ${p.title}`, W / 2, y + 40);
  }
  ctx.textAlign = 'left';
  panel.commit();
}
