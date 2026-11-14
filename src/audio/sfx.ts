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

/**
 * The shared context and master output, for the music (audio/music.ts).
 * Creating the context must happen during a user gesture to be audible.
 */
export function audioBus(): { ctx: AudioContext; master: GainNode } | null {
  const ac = audio();
  return ac && master ? { ctx: ac, master } : null;
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

/** Warm rising chime when a power succeeds. */
export function chime(): void {
  blip(660, 1.0, 0.35, 'sine', 0.22);
  setTimeout(() => blip(880, 1.0, 0.35, 'sine', 0.18), 80);
  setTimeout(() => blip(1320, 1.0, 0.45, 'sine', 0.12), 160);
}

/** Low buzz when there is not enough Favor. */
export function buzz(): void {
  blip(150, 0.9, 0.25, 'square', 0.08);
}

/** Soft tick while a hold is charging (call sparingly). */
export function tick(): void {
  blip(1400, 1.0, 0.03, 'sine', 0.04);
}

/** Rain: a burst of filtered noise. */
export function rainSound(): void {
  noise(1.6, 900, 0.18);
}

/** Shelter: a deep hum that swells. */
export function shelterSound(): void {
  blip(110, 1.5, 0.9, 'sine', 0.25);
  setTimeout(() => blip(220, 1.2, 0.7, 'triangle', 0.1), 120);
}

function noise(duration: number, cutoff: number, volume: number): void {
  if (muted) return;
  const ac = audio();
  if (!ac || !master) return;
  try {
    const len = Math.floor(ac.sampleRate * duration);
    const buffer = ac.createBuffer(1, len, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ac.createBufferSource();
    src.buffer = buffer;
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = ac.createGain();
    gain.gain.value = volume;
    src.connect(filter).connect(gain).connect(master);
    src.start();
  } catch {
    /* ignore */
  }
}

/** Tiny giggle: a villager found a hiding spot. */
export function giggle(): void {
  blip(1250 + Math.random() * 200, 1.15, 0.06, 'triangle', 0.08);
  setTimeout(() => blip(1350 + Math.random() * 200, 1.1, 0.06, 'triangle', 0.07), 80);
  setTimeout(() => blip(1450 + Math.random() * 200, 1.05, 0.06, 'triangle', 0.06), 160);
}

/** A little crowd cheer: hide-and-seek found, or waving back. */
export function cheer(): void {
  for (let i = 0; i < 5; i++) {
    setTimeout(() => blip(700 + Math.random() * 500, 1.3, 0.16, 'triangle', 0.07), i * 45);
  }
}

/** A hop onto the god's palm. */
export function hop(): void {
  blip(600, 1.6, 0.09, 'sine', 0.14);
}

/** Falling off: a descending squeal (hard) or a soft drop. */
export function tumble(hard: boolean): void {
  if (hard) blip(1000, 0.35, 0.4, 'triangle', 0.18);
  else blip(500, 0.7, 0.15, 'sine', 0.12);
}

/** Distant thunder after lightning. */
export function thunder(): void {
  noise(1.4, 220, 0.3);
}

/** A whoosh as the god swats a storm cloud. */
export function whoosh(): void {
  noise(0.25, 1400, 0.12);
}
