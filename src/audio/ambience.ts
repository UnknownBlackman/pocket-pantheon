/**
 * The village's ambient sound (WebAudio, no files): wind that gusts and
 * swells in a storm, the campfire crackling (louder at dusk and night),
 * birdsong on fair days, rain hiss in a storm, a soft rain with distant
 * thunder rumbling now and then, and the hush of snow (muffled wind, a
 * louder fire, no birds). Everything is generated
 * from noise and short tones; levels glide so moods blend.
 */
import { audioBus } from './sfx.ts';

export type AmbienceMood = 'off' | 'day' | 'dusk' | 'night' | 'storm' | 'rain' | 'snow';

const TICK_MS = 50;
const AHEAD = 0.15;

interface Level {
  wind: number;
  windHz: number;
  fire: number;
  /** Fire crackles per second. */
  crackles: number;
  rain: number;
  birds: boolean;
  /** Distant thunder rumbles now and then (gentle rain, not the storm). */
  rumble?: boolean;
}

const LEVELS: Record<AmbienceMood, Level> = {
  off: { wind: 0, windHz: 500, fire: 0, crackles: 0, rain: 0, birds: false },
  day: { wind: 0.035, windHz: 520, fire: 0.25, crackles: 4, rain: 0, birds: true },
  dusk: { wind: 0.04, windHz: 450, fire: 0.6, crackles: 7, rain: 0, birds: false },
  night: { wind: 0.03, windHz: 380, fire: 0.75, crackles: 8, rain: 0, birds: false },
  storm: { wind: 0.13, windHz: 750, fire: 0.2, crackles: 3, rain: 0.05, birds: false },
  rain: { wind: 0.025, windHz: 480, fire: 0.3, crackles: 4, rain: 0.014, birds: false, rumble: true },
  snow: { wind: 0.028, windHz: 300, fire: 0.65, crackles: 6, rain: 0, birds: false },
};

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let noise: AudioBuffer | null = null;
let windGain: GainNode | null = null;
let windFilter: BiquadFilterNode[] = [];
let fireBed: GainNode | null = null;
let fireOut: GainNode | null = null;
let rainGain: GainNode | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let mood: AmbienceMood = 'off';
let nextCrackle = 0;
let nextBird = 0;
let nextGust = 0;
let nextRumble = 0;

function loopNoise(ac: AudioContext): AudioBufferSourceNode {
  const src = ac.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  // Start each loop at a different point so sources do not correlate.
  src.start(0, Math.random() * 2);
  return src;
}

function build(ac: AudioContext, master: GainNode): void {
  ctx = ac;
  out = ac.createGain();
  out.gain.value = 1;
  out.connect(master);
  noise = ac.createBuffer(1, ac.sampleRate * 3, ac.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

  // Wind: two noise bands, panned apart for width.
  windGain = ac.createGain();
  windGain.gain.value = 0.0001;
  windGain.connect(out);
  windFilter = [];
  for (const pan of [-0.6, 0.6]) {
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 500;
    bp.Q.value = 0.9;
    const p = ac.createStereoPanner();
    p.pan.value = pan;
    loopNoise(ac).connect(bp).connect(p).connect(windGain);
    windFilter.push(bp);
  }

  // Fire: a low roar under the crackles.
  fireOut = ac.createGain();
  fireOut.gain.value = 0.0001;
  fireOut.connect(out);
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 260;
  fireBed = ac.createGain();
  fireBed.gain.value = 0.05;
  loopNoise(ac).connect(lp).connect(fireBed).connect(fireOut);

  // Rain: a bright hiss.
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 2500;
  rainGain = ac.createGain();
  rainGain.gain.value = 0.0001;
  loopNoise(ac).connect(hp).connect(rainGain).connect(out);

  nextCrackle = nextBird = nextGust = ac.currentTime;
}

/** One crackle or pop of the fire. */
function crackle(ac: AudioContext, t: number): void {
  if (!noise || !fireOut) return;
  const pop = Math.random() < 0.18;
  const src = ac.createBufferSource();
  src.buffer = noise;
  const f = ac.createBiquadFilter();
  f.type = pop ? 'bandpass' : 'highpass';
  f.frequency.value = pop ? 700 + Math.random() * 500 : 1800 + Math.random() * 2500;
  const g = ac.createGain();
  const len = pop ? 0.03 + Math.random() * 0.03 : 0.004 + Math.random() * 0.012;
  const vel = (pop ? 0.25 : 0.12) * (0.4 + Math.random() * 0.6);
  g.gain.setValueAtTime(vel, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  const p = ac.createStereoPanner();
  p.pan.value = (Math.random() - 0.5) * 0.4;
  src.connect(f).connect(g).connect(p).connect(fireOut);
  src.start(t, Math.random() * 2.5);
  src.stop(t + len + 0.02);
}

/** Distant thunder: a deep, slow roll of filtered noise, far off to one side. */
function rumble(ac: AudioContext, t: number): void {
  if (!noise || !out) return;
  const src = ac.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 110 + Math.random() * 60;
  lp.Q.value = 0.7;
  const g = ac.createGain();
  const peak = 0.12 + Math.random() * 0.07;
  const len = 3 + Math.random() * 2;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak * 0.5, t + 0.4);
  g.gain.linearRampToValueAtTime(peak, t + 1.1);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  const p = ac.createStereoPanner();
  p.pan.value = (Math.random() - 0.5) * 1.4;
  src.connect(lp).connect(g).connect(p).connect(out);
  src.start(t, Math.random() * 2);
  src.stop(t + len + 0.1);
}

/** A little bird: two to four quick rising chirps. */
function bird(ac: AudioContext, t: number): void {
  if (!out) return;
  const base = 2600 + Math.random() * 1400;
  const pan = (Math.random() - 0.5) * 1.6;
  const n = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    const s = t + i * (0.09 + Math.random() * 0.05);
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(base, s);
    o.frequency.exponentialRampToValueAtTime(base * (1.25 + Math.random() * 0.2), s + 0.05);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, s);
    g.gain.linearRampToValueAtTime(0.018, s + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, s + 0.07);
    const p = ac.createStereoPanner();
    p.pan.value = pan;
    o.connect(g).connect(p).connect(out);
    o.start(s);
    o.stop(s + 0.09);
  }
}

function tick(): void {
  const ac = ctx;
  if (!ac || ac.state !== 'running') return;
  try {
    const L = LEVELS[mood];
    const now = ac.currentTime;
    const horizon = now + AHEAD;
    if (nextCrackle < now) nextCrackle = now;
    while (L.crackles > 0 && nextCrackle < horizon) {
      crackle(ac, nextCrackle);
      nextCrackle += (-Math.log(1 - Math.random()) / L.crackles) || 0.1;
    }
    if (L.birds) {
      if (nextBird < now) nextBird = now + 2 + Math.random() * 4;
      if (nextBird < horizon) {
        bird(ac, nextBird);
        nextBird += 4 + Math.random() * 7;
      }
    }
    if (L.rumble) {
      if (nextRumble < now) nextRumble = now + 4 + Math.random() * 6;
      if (nextRumble < horizon) {
        rumble(ac, nextRumble);
        nextRumble += 12 + Math.random() * 14;
      }
    }
    // Gusts: the wind's level and pitch wander.
    if (nextGust < now && windGain) {
      const gust = 0.6 + Math.random() * 0.9;
      windGain.gain.setTargetAtTime(Math.max(0.0001, L.wind * gust), now, 1.2);
      for (const f of windFilter) f.frequency.setTargetAtTime(L.windHz * (0.7 + Math.random() * 0.7), now, 1.5);
      nextGust = now + 1.5 + Math.random() * 2.5;
    }
  } catch (err) {
    console.warn('[ambience]', err);
  }
}

export const ambience = {
  /** Sets the ambience; 'off' fades it out. Cheap to call every frame. */
  set(m: AmbienceMood): void {
    if (m === mood && ctx) return;
    if (m === 'off' && !ctx) return;
    const b = audioBus();
    if (!b || b.ctx.state !== 'running') return;
    if (!ctx) build(b.ctx, b.master);
    if (!timer) timer = setInterval(tick, TICK_MS);
    mood = m;
    const L = LEVELS[m];
    const t = b.ctx.currentTime;
    fireOut?.gain.setTargetAtTime(Math.max(0.0001, L.fire), t, 1.5);
    rainGain?.gain.setTargetAtTime(Math.max(0.0001, L.rain), t, 1.5);
    windGain?.gain.setTargetAtTime(Math.max(0.0001, L.wind), t, 1.5);
    nextGust = t + 1;
  },
};
