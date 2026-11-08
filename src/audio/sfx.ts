/**
 * Procedural placeholder sounds (WebAudio, no files, no network). Every call
 * is wrapped so a missing or blocked AudioContext never breaks the game.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    return ctx;
  } catch {
    return null;
  }
}

export function setMuted(value: boolean): void {
  muted = value;
  try {
    if (master && ctx) master.gain.setTargetAtTime(value ? 0 : 0.5, ctx.currentTime, 0.05);
  } catch {
    /* ignore */
  }
}

/** A short pitched blip with an envelope; `slide` bends the pitch. */
function blip(
  freq: number,
  slide: number,
  duration: number,
  type: OscillatorType,
  volume: number,
): void {
  if (muted) return;
  const ac = audio();
  if (!ac || !master) return;
  try {
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t + duration);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  } catch {
    /* ignore */
  }
}

/** Soft squeal when a villager is lifted. */
export function squeal(): void {
  blip(780 + Math.random() * 120, 1.7, 0.22, 'triangle', 0.25);
  setTimeout(() => blip(1100 + Math.random() * 100, 1.25, 0.12, 'sine', 0.15), 90);
}

/** Little plop when a villager is set down; brighter when dropped on a job. */
export function plop(onJob: boolean): void {
  blip(onJob ? 520 : 300, 0.55, 0.14, 'sine', 0.3);
  if (onJob) setTimeout(() => blip(780, 1.0, 0.12, 'triangle', 0.15), 70);
}
