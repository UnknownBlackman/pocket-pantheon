/**
 * Speech bubbles in the manuscript style. A bubble shrink-wraps its text
 * (wrapping, and shrinking the font for long lines, so nothing overflows),
 * sits on a tail pointing down at the speaker, and wears a name tab in the
 * speaker's tunic colour. Its look follows the mood of the line:
 *   calm  - warm parchment;
 *   joy   - parchment with gold sparkles;
 *   sad   - cool grey-blue paper;
 *   alarm - a jagged shout bubble in hot red;
 *   elder - gold-trimmed vellum with flourishes and a red "Elder" tab.
 */
import type { CanvasPanel } from './canvas-panel.ts';
import { diamond, layoutLines, parchment, roundRect, UI_COLORS, UI_FONT } from './canvas-panel.ts';

export type BubbleMood = 'calm' | 'joy' | 'sad' | 'alarm' | 'elder';

export interface BubbleSpec {
  text: string;
  name: string;
  /** Name-tab colour (CSS), usually the speaker's tunic. */
  tab: string;
  mood: BubbleMood;
}

const MARGIN = 26;
const PAD_X = 26;
const PAD_Y = 18;
const TAIL = 30;
const TAB_H = 38;

interface MoodLook {
  light: string;
  deep: string;
  border: string;
  ink: string;
}

const LOOKS: Record<BubbleMood, MoodLook> = {
  calm: { light: '#f8eed6', deep: '#e9d5a8', border: '#7a5530', ink: UI_COLORS.ink },
  joy: { light: '#fbf2d6', deep: '#efd89a', border: '#9a6a20', ink: UI_COLORS.ink },
  sad: { light: '#eef2f4', deep: '#cfd9e0', border: '#4d5d6a', ink: '#24323d' },
  alarm: { light: '#fde6d6', deep: '#f2b49a', border: '#a8322a', ink: '#4a140c' },
  elder: { light: '#fdf4d8', deep: '#efdcaa', border: '#b8862b', ink: '#3a2414' },
};

/** Draws one speech bubble into the panel (bottom-anchored: the tail tip is at the bottom centre). */
export function drawSpeechBubble(panel: CanvasPanel, spec: BubbleSpec): void {
  const { ctx, widthPx: W, heightPx: H } = panel;
  ctx.clearRect(0, 0, W, H);
  const look = LOOKS[spec.mood];
  const maxText = W - MARGIN * 2 - PAD_X * 2;

  // Fit the text: shrink the font until it is at most three lines.
  let size = 36;
  let lines: string[] = [];
  const weight = spec.mood === 'alarm' ? 800 : 700;
  const style = spec.mood === 'elder' ? 'italic ' : '';
  for (; size >= 22; size -= 2) {
    ctx.font = `${style}${weight} ${size}px ${UI_FONT}`;
    lines = layoutLines(ctx, spec.text, maxText);
    if (lines.length <= 3) break;
  }
  const lh = Math.round(size * 1.2);
  let textW = 0;
  for (const l of lines) textW = Math.max(textW, ctx.measureText(l).width);

  const bodyW = Math.min(W - MARGIN * 2, Math.max(textW + PAD_X * 2, 170));
  const bodyH = lines.length * lh + PAD_Y * 2;
  const bodyBottom = H - TAIL - 6;
  const bodyTop = Math.max(TAB_H - 6, bodyBottom - bodyH);
  const bodyX = (W - bodyW) / 2;
  const cx = W / 2;

  // Tail first, so the body covers its root.
  ctx.save();
  ctx.shadowColor = 'rgba(20, 10, 0, 0.35)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 18, bodyBottom - 4);
  ctx.lineTo(cx + 18, bodyBottom - 4);
  ctx.lineTo(cx + (spec.mood === 'alarm' ? 8 : 2), H - 6);
  ctx.closePath();
  ctx.fillStyle = look.deep;
  ctx.fill();
  ctx.restore();
  ctx.lineWidth = 4;
  ctx.strokeStyle = look.border;
  ctx.beginPath();
  ctx.moveTo(cx - 18, bodyBottom - 2);
  ctx.lineTo(cx + (spec.mood === 'alarm' ? 8 : 2), H - 6);
  ctx.lineTo(cx + 18, bodyBottom - 2);
  ctx.stroke();

  // Body.
  if (spec.mood === 'alarm') {
    jagged(ctx, bodyX, bodyTop, bodyW, bodyBottom - bodyTop, look);
  } else {
    parchment(ctx, bodyX, bodyTop, bodyW, bodyBottom - bodyTop, {
      radius: 22,
      border: look.border,
      light: look.light,
      deep: look.deep,
      flourishes: spec.mood === 'elder',
    });
  }
  if (spec.mood === 'joy') {
    sparkle(ctx, bodyX + 10, bodyTop + 8, 7);
    sparkle(ctx, bodyX + bodyW - 12, bodyTop + 12, 6);
    sparkle(ctx, bodyX + bodyW - 24, bodyBottom - 6, 5);
  }

  // Name tab, overlapping the top-left edge.
  const name = spec.mood === 'elder' ? `Elder ${spec.name}` : spec.name;
  ctx.font = `700 22px ${UI_FONT}`;
  const tabW = ctx.measureText(name).width + 28;
  const tabX = bodyX + 18;
  const tabY = bodyTop - TAB_H / 2 - 4;
  roundRect(ctx, tabX, tabY, tabW, TAB_H - 8, 10);
  ctx.fillStyle = spec.mood === 'elder' ? '#8a2a1c' : spec.tab;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = spec.mood === 'elder' ? '#e2b24a' : '#3a2414';
  ctx.stroke();
  ctx.fillStyle = spec.mood === 'elder' ? '#f6d88a' : '#fbf3e0';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, tabX + 14, tabY + (TAB_H - 8) / 2 + 1);

  // The words.
  ctx.font = `${style}${weight} ${size}px ${UI_FONT}`;
  ctx.fillStyle = look.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const textTop = bodyTop + (bodyBottom - bodyTop - lines.length * lh) / 2 + lh / 2 + 2;
  lines.forEach((l, i) => ctx.fillText(l, cx, textTop + i * lh));
  ctx.textAlign = 'left';
  panel.commit();
}

/** A spiky shout bubble. */
function jagged(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, look: MoodLook): void {
  const spikes = 7;
  const amp = 9;
  ctx.save();
  ctx.shadowColor = 'rgba(60, 10, 0, 0.4)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  ctx.beginPath();
  const edge = (x0: number, y0: number, x1: number, y1: number, nx: number, ny: number, first: boolean) => {
    for (let i = 0; i <= spikes; i++) {
      const t = i / spikes;
      const out = i % 2 ? amp : 0;
      const px = x0 + (x1 - x0) * t + nx * out;
      const py = y0 + (y1 - y0) * t + ny * out;
      if (first && i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
  };
  edge(x, y, x + w, y, 0, -1, true);
  edge(x + w, y, x + w, y + h, 1, 0, false);
  edge(x + w, y + h, x, y + h, 0, 1, false);
  edge(x, y + h, x, y, -1, 0, false);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, look.light);
  g.addColorStop(1, look.deep);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
  ctx.lineWidth = 4;
  ctx.strokeStyle = look.border;
  ctx.stroke();
}

function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  diamond(ctx, x, y, r, '#d9a530');
  ctx.strokeStyle = '#d9a530';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - r * 1.6, y);
  ctx.lineTo(x + r * 1.6, y);
  ctx.moveTo(x, y - r * 1.6);
  ctx.lineTo(x, y + r * 1.6);
  ctx.stroke();
}
