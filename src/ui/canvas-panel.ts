/**
 * Spatial panels drawn on a 2D canvas and shown on a plane in the scene: the
 * details card, hints, pause, dusk summary, chronicle, speech bubbles and
 * the narration ribbon. The look is a medieval manuscript: dark ink on warm
 * parchment (high contrast, readable over passthrough), serif headings,
 * double ink borders and small corner flourishes. Text is generated in
 * code; no fonts or images are loaded.
 */
import { CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from '@iwsdk/core';

/** Ink and pigment colours for text and marks on parchment. */
export const UI_COLORS = {
  parchment: '#f6ead0',
  parchmentDeep: '#e6cf9f',
  ink: '#1e1009',
  border: '#6a4526',
  title: '#7e1f12', // rubric red, as in illuminated manuscripts
  text: '#1e1009',
  dim: '#4e3826',
  gold: '#b8862b',
  good: '#4f7a2a',
  warn: '#c06a1e',
  bad: '#a8322a',
  faith: '#b8862b',
  initiative: '#2f6aa0',
} as const;

/** Serif for headings and names: the manuscript look. */
export const UI_FONT = 'Georgia, "Palatino Linotype", "Book Antiqua", Palatino, "Times New Roman", serif';
/** Heavy humanist sans for body text: legible at a distance in a headset. */
export const UI_BODY = '"Segoe UI", "Trebuchet MS", Roboto, "Helvetica Neue", Arial, system-ui, sans-serif';
/** Canvas pixels per layout pixel: renders text crisper than its layout size. */
const SHARPNESS = 1.6;

export class CanvasPanel {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly texture: CanvasTexture;
  readonly mesh: Mesh;
  readonly widthPx: number;
  readonly heightPx: number;

  /** `widthM` is the panel's width in metres; height follows the aspect. */
  constructor(widthPx: number, heightPx: number, widthM: number, name: string) {
    this.widthPx = widthPx;
    this.heightPx = heightPx;
    this.canvas = document.createElement('canvas');
    // Layout stays in `widthPx` x `heightPx`; the canvas has extra pixels.
    this.canvas.width = Math.round(widthPx * SHARPNESS);
    this.canvas.height = Math.round(heightPx * SHARPNESS);
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.setTransform(SHARPNESS, 0, 0, SHARPNESS, 0, 0);
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.anisotropy = 8;
    const material = new MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      toneMapped: false,
      depthWrite: false,
    });
    this.mesh = new Mesh(new PlaneGeometry(widthM, (widthM * heightPx) / widthPx), material);
    this.mesh.name = name;
    this.mesh.renderOrder = 10;
  }

  /** Clears and draws the parchment card filling the panel. */
  begin(): CanvasRenderingContext2D {
    const { ctx, widthPx: w, heightPx: h } = this;
    ctx.clearRect(0, 0, w, h);
    parchment(ctx, 10, 8, w - 20, h - 20, { radius: 22 });
    return ctx;
  }

  commit(): void {
    this.texture.needsUpdate = true;
  }
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export interface ParchmentStyle {
  radius?: number;
  /** Border ink (default brown); gold for the elder. */
  border?: string;
  /** Paper tint: light and deep stops of the gradient. */
  light?: string;
  deep?: string;
  /** Small diamond flourishes in the corners. */
  flourishes?: boolean;
}

/** A parchment card with a soft shadow, a double ink border and flourishes. */
export function parchment(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  style: ParchmentStyle = {},
): void {
  const r = style.radius ?? 20;
  const border = style.border ?? UI_COLORS.border;
  ctx.save();
  ctx.shadowColor = 'rgba(20, 10, 0, 0.45)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;
  roundRect(ctx, x, y, w, h, r);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, style.light ?? UI_COLORS.parchment);
  g.addColorStop(1, style.deep ?? UI_COLORS.parchmentDeep);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
  // Aged edges: a faint darker rim inside the card.
  const v = ctx.createRadialGradient(x + w / 2, y + h / 2, Math.min(w, h) * 0.35, x + w / 2, y + h / 2, Math.max(w, h) * 0.75);
  v.addColorStop(0, 'rgba(120, 80, 30, 0)');
  v.addColorStop(1, 'rgba(120, 80, 30, 0.18)');
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = v;
  ctx.fill();
  // Double ink border.
  ctx.lineWidth = 4;
  ctx.strokeStyle = border;
  roundRect(ctx, x, y, w, h, r);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.55;
  roundRect(ctx, x + 7, y + 7, w - 14, h - 14, Math.max(4, r - 6));
  ctx.stroke();
  ctx.globalAlpha = 1;
  if (style.flourishes !== false && w > 120 && h > 70) {
    for (const [cx, cy] of [
      [x + 14, y + 14],
      [x + w - 14, y + 14],
      [x + 14, y + h - 14],
      [x + w - 14, y + h - 14],
    ]) {
      diamond(ctx, cx, cy, 5, border);
    }
  }
}

export function diamond(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r, cy);
  ctx.lineTo(cx, cy + r);
  ctx.lineTo(cx - r, cy);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/** A thin ornamental rule with a diamond in the middle (under headings). */
export function rule(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
  ctx.strokeStyle = UI_COLORS.border;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w / 2 - 10, y);
  ctx.moveTo(x + w / 2 + 10, y);
  ctx.lineTo(x + w, y);
  ctx.stroke();
  ctx.globalAlpha = 1;
  diamond(ctx, x + w / 2, y, 5, UI_COLORS.title);
}

/** Splits text into lines no wider than maxWidth with the current font. */
export function layoutLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Draws wrapped text; returns the y after the last line. Never drops words. */
export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 99,
): number {
  const lines = layoutLines(ctx, text, maxWidth);
  if (lines.length > maxLines) {
    // Squeeze the overflow onto the last allowed line with an ellipsis.
    const kept = lines.slice(0, maxLines);
    let last = lines.slice(maxLines - 1).join(' ');
    while (ctx.measureText(`${last}…`).width > maxWidth && last.length > 1) last = last.slice(0, -1);
    kept[maxLines - 1] = `${last}…`;
    lines.length = 0;
    lines.push(...kept);
  }
  for (const l of lines) {
    ctx.fillText(l, x, y);
    y += lineHeight;
  }
  return y;
}

/** A labelled 0..1 bar, inked onto parchment. */
export function drawBar(
  ctx: CanvasRenderingContext2D,
  label: string,
  value: number,
  color: string,
  x: number,
  y: number,
  w: number,
): void {
  ctx.fillStyle = UI_COLORS.dim;
  ctx.font = `700 22px ${UI_BODY}`;
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y);
  const bx = x + 120;
  const bw = w - 120;
  roundRect(ctx, bx, y - 10, bw, 20, 10);
  ctx.fillStyle = 'rgba(90, 60, 30, 0.16)';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(90, 60, 30, 0.45)';
  ctx.stroke();
  const v = Math.max(0, Math.min(1, value));
  if (v > 0.01) {
    roundRect(ctx, bx, y - 10, Math.max(20, bw * v), 20, 10);
    ctx.fillStyle = color;
    ctx.fill();
  }
}

/**
 * A red ribbon banner with swallowtail ends and folds, used for narration.
 * Text is cream with a dark outline so it reads over anything.
 */
export function ribbon(ctx: CanvasRenderingContext2D, w: number, h: number, text: string): void {
  ctx.clearRect(0, 0, w, h);
  const top = h * 0.16;
  const bot = h * 0.84;
  const tail = 46;
  const body = '#9a2b20';
  const fold = '#6a1a12';
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  // Tails (behind), with a notch.
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? 4 : w - 4;
    const x1 = side < 0 ? tail + 24 : w - tail - 24;
    ctx.beginPath();
    ctx.moveTo(x0, top + 10);
    ctx.lineTo(x1, top + 10);
    ctx.lineTo(x1, bot + 10);
    ctx.lineTo(x0, bot + 10);
    ctx.lineTo(x0 + side * -22, (top + bot) / 2 + 10);
    ctx.closePath();
    ctx.fillStyle = fold;
    ctx.fill();
  }
  // Main band.
  ctx.beginPath();
  ctx.moveTo(tail, top);
  ctx.lineTo(w - tail, top);
  ctx.lineTo(w - tail, bot);
  ctx.lineTo(tail, bot);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, top, 0, bot);
  g.addColorStop(0, '#b8392b');
  g.addColorStop(1, body);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
  // Gold stitching along the edges.
  ctx.strokeStyle = 'rgba(232, 190, 90, 0.85)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(tail + 8, top + 7);
  ctx.lineTo(w - tail - 8, top + 7);
  ctx.moveTo(tail + 8, bot - 7);
  ctx.lineTo(w - tail - 8, bot - 7);
  ctx.stroke();
  ctx.setLineDash([]);
  // Text, fitted to the band.
  let size = 34;
  ctx.font = `italic 700 ${size}px ${UI_FONT}`;
  while (ctx.measureText(text).width > w - tail * 2 - 40 && size > 20) {
    size -= 2;
    ctx.font = `italic 700 ${size}px ${UI_FONT}`;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(50, 10, 5, 0.8)';
  ctx.strokeText(text, w / 2, (top + bot) / 2 + 1);
  ctx.fillStyle = '#fbefd2';
  ctx.fillText(text, w / 2, (top + bot) / 2 + 1);
  ctx.textAlign = 'left';
}
