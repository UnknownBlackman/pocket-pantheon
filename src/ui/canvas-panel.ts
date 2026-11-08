/**
 * Small spatial panels drawn on a 2D canvas and shown on a plane in the
 * scene. Used for the gaze bubble, hints, pause, dusk summary and the
 * chronicle tablet. Text is generated in code; no fonts or images are loaded.
 */
import { CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from '@iwsdk/core';

export const UI_COLORS = {
  bg: 'rgba(32, 24, 18, 0.88)',
  border: 'rgba(255, 214, 140, 0.9)',
  title: '#ffd98a',
  text: '#f6efe4',
  dim: '#c9b9a3',
  good: '#9ed46a',
  warn: '#ffb35c',
  bad: '#ff7a6a',
  faith: '#ffd24a',
  initiative: '#7cc8ff',
} as const;

export const UI_FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

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
    this.canvas.width = widthPx;
    this.canvas.height = heightPx;
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.anisotropy = 4;
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

  /** Clears and draws the rounded background card. */
  begin(): CanvasRenderingContext2D {
    const { ctx, widthPx: w, heightPx: h } = this;
    ctx.clearRect(0, 0, w, h);
    roundRect(ctx, 4, 4, w - 8, h - 8, 26);
    ctx.fillStyle = UI_COLORS.bg;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = UI_COLORS.border;
    ctx.stroke();
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

/** Draws wrapped text; returns the y after the last line. */
export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 99,
): number {
  const words = text.split(' ');
  let line = '';
  let lines = 0;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      y += lineHeight;
      line = word;
      if (++lines >= maxLines) return y;
    } else {
      line = test;
    }
  }
  if (line) {
    ctx.fillText(line, x, y);
    y += lineHeight;
  }
  return y;
}

/** A labelled 0..1 bar with a small drawn icon. */
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
  ctx.font = `600 22px ${UI_FONT}`;
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y);
  const bx = x + 120;
  const bw = w - 120;
  roundRect(ctx, bx, y - 10, bw, 20, 10);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fill();
  const v = Math.max(0, Math.min(1, value));
  if (v > 0.01) {
    roundRect(ctx, bx, y - 10, Math.max(20, bw * v), 20, 10);
    ctx.fillStyle = color;
    ctx.fill();
  }
}
