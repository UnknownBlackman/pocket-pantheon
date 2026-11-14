/**
 * Procedural music (WebAudio, no files, no network). Two pieces in D Dorian,
 * an old church mode that sounds medieval:
 * - "intro": a slow welcome for the welcome page and the village's arrival,
 *   with a drone, a rolling harp and a recorder melody.
 * - "village": a lilting 6/8 dance played while the god watches over the
 *   village. It follows the world: full band by day, slower and softer at
 *   dusk, just the lute at night, and drums and a darker mode in a storm.
 * Instruments are synthesised: a plucked string (Karplus-Strong) for lute
 * and harp, a recorder with breath and vibrato, a hurdy-gurdy drone, a frame
 * drum with jingles, and a small hall reverb.
 * Notes are scheduled a bar at a time, a little ahead of the clock, so the
 * music never depends on the frame rate.
 */
import { audioBus } from './sfx.ts';

export type MusicTrack = 'none' | 'intro' | 'village';
export type MusicMood = 'day' | 'dusk' | 'night' | 'storm';

/** Music level under the sound effects (the master is 0.5). */
const VOLUME = 0.55;
/** Level while the game is paused. */
const DUCKED = 0.3;
const FADE_SECONDS = 2.5;
const LOOKAHEAD = 0.4;
const TICK_MS = 60;
const STEPS = 6; // eighth notes per 6/8 bar
/** The plucked strings sit behind the melody: softer and darker. */
const LUTE_LEVEL = 0.55;
const LUTE_TONE_HZ = 1500;
const PREF_KEY = 'tabletop-gods-music';

// ---------------------------------------------------------------- Score

type Note = readonly [midi: number, eighths: number]; // midi 0 = rest

interface Chord {
  /** Root in the lute's register (MIDI). */
  root: number;
  /** 3 = minor, 4 = major. */
  third: number;
}

const CHORDS: Record<string, Chord> = {
  Dm: { root: 50, third: 3 },
  C: { root: 48, third: 4 },
  Am: { root: 45, third: 3 },
  F: { root: 53, third: 4 },
  G: { root: 55, third: 4 },
  Bb: { root: 46, third: 4 },
  A: { root: 45, third: 4 },
};

/** The village tune, part A (8 bars). */
const MEL_A: readonly (readonly Note[])[] = [
  [[74, 3], [72, 1], [69, 2]],
  [[67, 2], [69, 1], [72, 3]],
  [[74, 2], [76, 1], [77, 2], [76, 1]],
  [[76, 2], [74, 1], [72, 3]],
  [[69, 2], [72, 1], [77, 3]],
  [[74, 2], [71, 1], [67, 3]],
  [[67, 2], [72, 1], [74, 2], [72, 1]],
  [[74, 6]],
];
const CH_A = ['Dm', 'C', 'Dm', 'Am', 'F', 'G', 'C', 'Dm'];

/** Part B, higher and flowing. */
const MEL_B: readonly (readonly Note[])[] = [
  [[77, 2], [76, 1], [77, 1], [79, 1], [81, 1]],
  [[79, 3], [76, 3]],
  [[74, 2], [76, 1], [74, 1], [71, 2]],
  [[69, 3], [0, 3]],
  [[72, 2], [74, 1], [77, 2], [76, 1]],
  [[79, 2], [76, 1], [72, 3]],
  [[76, 2], [74, 1], [72, 2], [71, 1]],
  [[69, 2], [74, 4]],
];
const CH_B = ['F', 'C', 'G', 'Dm', 'F', 'C', 'Am', 'Dm'];

/** The welcome: slow and spacious. */
const MEL_INTRO: readonly (readonly Note[])[] = [
  [[0, 2], [69, 4]],
  [[72, 3], [71, 1], [69, 2]],
  [[67, 4], [64, 2]],
  [[62, 2], [67, 2], [71, 2]],
  [[74, 6]],
  [[72, 3], [69, 3]],
  [[67, 2], [64, 2], [67, 2]],
  [[69, 2], [62, 4]],
];
const CH_INTRO = ['Dm', 'Am', 'C', 'G', 'Dm', 'F', 'C', 'Dm'];

/** The storm: D Aeolian with a bright, uneasy A major. */
const CH_STORM = ['Dm', 'Bb', 'C', 'Dm', 'Dm', 'Bb', 'A', 'A'];

interface Bar {
  chord: string;
  melody: readonly Note[] | null;
  drums: boolean;
  ornament: boolean;
  bells: boolean;
}

function section(
  chords: readonly string[],
  melody: readonly (readonly Note[])[] | null,
  opts: Partial<Pick<Bar, 'drums' | 'ornament' | 'bells'>> = {},
  bars = chords.length,
): Bar[] {
  const out: Bar[] = [];
  for (let i = 0; i < bars; i++) {
    out.push({
      chord: chords[i % chords.length],
      melody: melody ? melody[i % melody.length] : null,
      drums: !!opts.drums,
      ornament: !!opts.ornament,
      bells: !!opts.bells,
    });
  }
  return out;
}

/** About 80 seconds by day, then it loops. */
const VILLAGE: Bar[] = [
  ...section(CH_A, null, {}, 4),
  ...section(CH_A, MEL_A),
  ...section(CH_A, MEL_A, { drums: true, ornament: true }),
  ...section(CH_B, MEL_B, { drums: true }),
  ...section(CH_A, MEL_A, { drums: true, ornament: true }),
  ...section(CH_A, null, { bells: true }),
];

const INTRO: Bar[] = [
  ...section(CH_INTRO, null, {}, 2),
  ...section(CH_INTRO, MEL_INTRO),
  ...section(CH_INTRO, null, { bells: true }),
  ...section(CH_INTRO, MEL_INTRO, { ornament: true }),
];

const STORM_BARS: Bar[] = section(CH_STORM, null, { drums: true });

/** Seconds per eighth note. */
const EIGHTH: Record<MusicMood, number> = { day: 0.3, dusk: 0.34, night: 0.38, storm: 0.27 };
const INTRO_EIGHTH = 0.42;

// D Dorian uses the white keys (pitch classes from C), for ornaments.
const DORIAN = [0, 2, 4, 5, 7, 9, 11];
function upperNeighbour(midi: number): number {
  for (let m = midi + 1; m < midi + 4; m++) if (DORIAN.includes(m % 12)) return m;
  return midi + 2;
}

const mtof = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);
const jitter = (): number => (Math.random() - 0.5) * 0.012;

// ---------------------------------------------------------------- Shared nodes

let bus: GainNode | null = null;
let reverbIn: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
const plucks = new Map<number, { buf: AudioBuffer; rate: number }>();

function setupBus(ac: AudioContext, master: GainNode): void {
  if (bus) return;
  bus = ac.createGain();
  bus.gain.value = 0;
  bus.connect(master);
  // A small hall: decaying stereo noise as the impulse response.
  const len = Math.floor(ac.sampleRate * 2.0);
  const ir = ac.createBuffer(2, len, ac.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
  }
  const conv = ac.createConvolver();
  conv.buffer = ir;
  reverbIn = ac.createGain();
  reverbIn.gain.value = 0.32;
  reverbIn.connect(conv).connect(bus);
  noiseBuf = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.5), ac.sampleRate);
  const n = noiseBuf.getChannelData(0);
  for (let i = 0; i < n.length; i++) n[i] = Math.random() * 2 - 1;
}

/** A plucked string, Karplus-Strong, computed once per pitch. */
function pluckBuffer(ac: AudioContext, midi: number): { buf: AudioBuffer; rate: number } {
  const cached = plucks.get(midi);
  if (cached) return cached;
  const sr = ac.sampleRate;
  const f = mtof(midi);
  const period = Math.max(2, Math.floor(sr / f - 0.5));
  const len = Math.floor(sr * 2.2);
  const buf = ac.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  let lp = 0;
  for (let i = 0; i < period; i++) {
    // A soft, thumb-like pluck: heavily smoothed noise has few sharp overtones.
    lp += 0.22 * (Math.random() * 2 - 1 - lp);
    d[i] = lp;
  }
  const decay = midi < 52 ? 0.997 : 0.995;
  for (let i = period; i < len; i++) d[i] = decay * 0.5 * (d[i - period] + d[i - period - 1 < 0 ? 0 : i - period - 1]);
  let peak = 0;
  for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(d[i]));
  const fade = Math.floor(sr * 0.2);
  for (let i = 0; i < len; i++) {
    d[i] = (d[i] / (peak || 1)) * 0.7;
    if (i > len - fade) d[i] *= (len - i) / fade;
  }
  // The averaging filter delays by half a sample: correct the pitch.
  const entry = { buf, rate: f / (sr / (period + 0.5)) };
  plucks.set(midi, entry);
  return entry;
}

// ---------------------------------------------------------------- Instruments

interface Out {
  ac: AudioContext;
  dry: GainNode;
}

function send(out: Out, node: AudioNode, wet: number): void {
  node.connect(out.dry);
  if (reverbIn && wet > 0) {
    const g = out.ac.createGain();
    g.gain.value = wet;
    node.connect(g).connect(reverbIn);
  }
}

function pluck(out: Out, midi: number, t: number, vel: number, wet = 0.6): void {
  const { buf, rate } = pluckBuffer(out.ac, midi);
  const src = out.ac.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  // Darken the string: a gut-strung lute, not a steel guitar.
  const tone = out.ac.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = LUTE_TONE_HZ;
  tone.Q.value = 0.5;
  const g = out.ac.createGain();
  g.gain.value = vel * LUTE_LEVEL;
  src.connect(tone).connect(g);
  send(out, g, wet);
  src.start(t);
}

function recorder(out: Out, midi: number, t: number, dur: number, vel: number): void {
  const ac = out.ac;
  const f = mtof(midi);
  const env = ac.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.linearRampToValueAtTime(vel, t + 0.05);
  env.gain.setValueAtTime(vel, t + Math.max(0.06, dur * 0.6));
  env.gain.linearRampToValueAtTime(vel * 0.8, t + dur);
  env.gain.linearRampToValueAtTime(0.0001, t + dur + 0.09);
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 3200;
  const body = ac.createOscillator();
  body.type = 'sine';
  body.frequency.value = f;
  const edge = ac.createOscillator();
  edge.type = 'triangle';
  edge.frequency.value = f;
  const edgeGain = ac.createGain();
  edgeGain.gain.value = 0.35;
  // Vibrato that blooms on long notes.
  const lfo = ac.createOscillator();
  lfo.frequency.value = 5.2;
  const depth = ac.createGain();
  depth.gain.setValueAtTime(0, t);
  depth.gain.linearRampToValueAtTime(dur > 0.5 ? f * 0.007 : 0, t + Math.min(0.45, dur));
  lfo.connect(depth);
  depth.connect(body.frequency);
  depth.connect(edge.frequency);
  body.connect(filter);
  edge.connect(edgeGain).connect(filter);
  filter.connect(env);
  send(out, env, 0.75);
  const end = t + dur + 0.12;
  for (const o of [body, edge, lfo]) {
    o.start(t);
    o.stop(end);
  }
  // A breathy chiff at the start of the note.
  if (noiseBuf) {
    const n = ac.createBufferSource();
    n.buffer = noiseBuf;
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = Math.min(6000, f * 3);
    bp.Q.value = 2;
    const ng = ac.createGain();
    ng.gain.setValueAtTime(vel * 0.35, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    n.connect(bp).connect(ng);
    send(out, ng, 0.3);
    n.start(t);
    n.stop(t + 0.08);
  }
}

function drum(out: Out, t: number, vel: number, high = false): void {
  const ac = out.ac;
  const osc = ac.createOscillator();
  osc.type = 'sine';
  const f0 = high ? 210 : 115;
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(f0 * 0.5, t + 0.18);
  const g = ac.createGain();
  g.gain.setValueAtTime(vel, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + (high ? 0.18 : 0.38));
  osc.connect(g);
  send(out, g, 0.25);
  osc.start(t);
  osc.stop(t + 0.45);
  if (noiseBuf) {
    const n = ac.createBufferSource();
    n.buffer = noiseBuf;
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = high ? 1800 : 900;
    const ng = ac.createGain();
    ng.gain.setValueAtTime(vel * 0.35, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    n.connect(bp).connect(ng);
    send(out, ng, 0.2);
    n.start(t);
    n.stop(t + 0.07);
  }
}

function jingle(out: Out, t: number, vel: number): void {
  if (!noiseBuf) return;
  const ac = out.ac;
  const n = ac.createBufferSource();
  n.buffer = noiseBuf;
  n.playbackRate.value = 0.8 + Math.random() * 0.4;
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 6500;
  const g = ac.createGain();
  g.gain.setValueAtTime(vel, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  n.connect(hp).connect(g);
  send(out, g, 0.4);
  n.start(t);
  n.stop(t + 0.14);
}

function bell(out: Out, midi: number, t: number, vel: number): void {
  const ac = out.ac;
  const f = mtof(midi);
  for (const [ratio, amp, decay] of [
    [1, 1, 2.2],
    [2.76, 0.35, 0.9],
    [5.4, 0.12, 0.4],
  ] as const) {
    const o = ac.createOscillator();
    o.frequency.value = f * ratio;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vel * amp, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    o.connect(g);
    send(out, g, 0.9);
    o.start(t);
    o.stop(t + decay + 0.05);
  }
}

// ---------------------------------------------------------------- Players

class Player {
  readonly out: Out;
  private gain: GainNode;
  private droneFilter: BiquadFilterNode;
  private droneGain: GainNode;
  private drones: OscillatorNode[] = [];
  private bar = 0;
  private stormBar = 0;
  next: number;

  constructor(
    ac: AudioContext,
    readonly track: Exclude<MusicTrack, 'none'>,
  ) {
    this.gain = ac.createGain();
    this.gain.gain.setValueAtTime(0.0001, ac.currentTime);
    this.gain.gain.linearRampToValueAtTime(1, ac.currentTime + FADE_SECONDS);
    this.gain.connect(bus!);
    const dry = ac.createGain();
    dry.connect(this.gain);
    this.out = { ac, dry };
    // The drone: D and A, like a hurdy-gurdy's drone strings.
    this.droneFilter = ac.createBiquadFilter();
    this.droneFilter.type = 'lowpass';
    this.droneFilter.frequency.value = 420;
    this.droneGain = ac.createGain();
    this.droneGain.gain.value = 0.0001;
    this.droneFilter.connect(this.droneGain).connect(dry);
    for (const [midi, cents] of [
      [38, 0],
      [45, 3],
      [50, -4],
    ] as const) {
      const o = ac.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = mtof(midi);
      o.detune.value = cents;
      o.connect(this.droneFilter);
      o.start();
      this.drones.push(o);
    }
    this.next = ac.currentTime + 0.15;
  }

  /** Fades out and stops everything it started. */
  stop(): void {
    const t = this.out.ac.currentTime;
    this.gain.gain.cancelScheduledValues(t);
    this.gain.gain.setValueAtTime(Math.max(0.0001, this.gain.gain.value), t);
    this.gain.gain.linearRampToValueAtTime(0.0001, t + FADE_SECONDS);
    for (const o of this.drones) o.stop(t + FADE_SECONDS + 0.1);
    setTimeout(() => this.gain.disconnect(), (FADE_SECONDS + 3) * 1000);
  }

  /** Schedules whole bars until the clock is LOOKAHEAD ahead. */
  pump(mood: MusicMood): void {
    const now = this.out.ac.currentTime;
    if (this.next < now) this.next = now + 0.05; // fell behind (tab hidden)
    while (this.next < now + LOOKAHEAD) {
      const eighth = this.track === 'intro' ? INTRO_EIGHTH : EIGHTH[mood];
      let bar: Bar;
      if (this.track === 'intro') {
        bar = INTRO[this.bar++ % INTRO.length];
      } else if (mood === 'storm') {
        bar = STORM_BARS[this.stormBar++ % STORM_BARS.length];
      } else {
        this.stormBar = 0;
        bar = VILLAGE[this.bar++ % VILLAGE.length];
      }
      this.playBar(bar, this.next, eighth, this.track === 'intro' ? 'intro' : mood);
      this.next += eighth * STEPS;
    }
  }

  private playBar(bar: Bar, t0: number, eighth: number, style: MusicMood | 'intro'): void {
    const out = this.out;
    const chord = CHORDS[bar.chord];
    const r = chord.root;
    const third = chord.third;

    // Drone level and colour follow the mood.
    const droneLevel = style === 'storm' ? 0.06 : style === 'night' ? 0.03 : style === 'intro' ? 0.05 : 0.04;
    const droneCut = style === 'storm' ? 800 : style === 'night' ? 300 : 440;
    this.droneGain.gain.setTargetAtTime(droneLevel, t0, 1.2);
    this.droneFilter.frequency.setTargetAtTime(droneCut, t0, 1.5);

    // Lute or harp.
    let pattern: readonly (readonly [number, number])[]; // [interval, velocity] per eighth; vel 0 = silent
    switch (style) {
      case 'intro':
        pattern = [[0, 0.22], [7, 0.15], [12, 0.15], [12 + third, 0.14], [19, 0.13], [24, 0.12]];
        break;
      case 'storm':
        pattern = [[0, 0.3], [0, 0.16], [7, 0.2], [0, 0.26], [0, 0.16], [7, 0.2]];
        break;
      case 'night':
        pattern = [[0, 0.2], [0, 0], [12, 0.12], [12 + third, 0.11], [0, 0], [0, 0]];
        break;
      case 'dusk':
        pattern = [[0, 0.24], [7, 0.13], [12, 0.15], [12 + third, 0.13], [12, 0], [7, 0.12]];
        break;
      default:
        pattern = [[0, 0.3], [7, 0.18], [12, 0.2], [12 + third, 0.18], [12, 0.17], [7, 0.16]];
    }
    for (let s = 0; s < STEPS; s++) {
      const [iv, vel] = pattern[s];
      if (vel > 0) pluck(out, r + iv, t0 + s * eighth + jitter(), vel * (0.9 + Math.random() * 0.2));
    }

    // Melody on the recorder (not at night or in a storm).
    const melodyOn = bar.melody && style !== 'night' && style !== 'storm';
    if (melodyOn) {
      const vel = style === 'dusk' ? 0.08 : style === 'intro' ? 0.1 : 0.11;
      let step = 0;
      for (const [midi, len] of bar.melody!) {
        const t = t0 + step * eighth + jitter();
        const dur = len * eighth - 0.03;
        if (midi > 0) {
          if (bar.ornament && len >= 3) {
            recorder(out, upperNeighbour(midi), t, 0.07, vel * 0.8);
            recorder(out, midi, t + 0.08, dur - 0.08, vel);
          } else {
            recorder(out, midi, t, dur, vel);
          }
        }
        step += len;
      }
    }

    // Drums.
    if (bar.drums && (style === 'day' || style === 'storm')) {
      if (style === 'storm') {
        const vels = [0.5, 0.18, 0.28, 0.42, 0.2, 0.3];
        for (let s = 0; s < STEPS; s++) drum(out, t0 + s * eighth + jitter(), vels[s]);
      } else {
        drum(out, t0 + jitter(), 0.34);
        drum(out, t0 + 3 * eighth + jitter(), 0.2);
        drum(out, t0 + 5 * eighth + jitter(), 0.1, true);
        jingle(out, t0 + 1 * eighth + jitter(), 0.05);
        jingle(out, t0 + 4 * eighth + jitter(), 0.06);
      }
    }

    // Bells: a few high notes from the chord, like a distant chapel.
    if (bar.bells || (style === 'night' && Math.random() < 0.35)) {
      const tones = [r + 24, r + 24 + third, r + 31, r + 36];
      for (let i = 0; i < 2; i++) {
        const s = Math.floor(Math.random() * STEPS);
        bell(out, tones[Math.floor(Math.random() * tones.length)], t0 + s * eighth, 0.035);
      }
    }
  }
}

// ---------------------------------------------------------------- Control

let player: Player | null = null;
let want: MusicTrack = 'none';
let mood: MusicMood = 'day';
let ducked = false;
let timer: ReturnType<typeof setInterval> | null = null;
let enabled = readPref();

function readPref(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) !== 'off';
  } catch {
    return true;
  }
}

function level(ac: AudioContext): void {
  if (!bus) return;
  const v = enabled ? VOLUME * (ducked ? DUCKED : 1) : 0;
  bus.gain.setTargetAtTime(Math.max(0.0001, v), ac.currentTime, 0.4);
}

function pump(): void {
  try {
    // The context may still have been waking up when play() was asked.
    if ((player?.track ?? 'none') !== want) music.play(want);
    player?.pump(mood);
  } catch (err) {
    console.warn('[music]', err);
    /* audio errors never break the game */
  }
}

export const music = {
  /**
   * Call from a user gesture (a click or tap): browsers keep sound off until
   * the player has touched the page.
   */
  unlock(): void {
    const b = audioBus();
    if (!b) return;
    setupBus(b.ctx, b.master);
    level(b.ctx);
    if (!timer) timer = setInterval(pump, TICK_MS);
    this.play(want);
  },

  /** Crossfades to `track` (no-op if already playing it). */
  play(track: MusicTrack): void {
    want = track;
    if (!bus) return;
    try {
      const b = audioBus();
      if (!b) return;
      if (b.ctx.state !== 'running') return; // not unlocked yet
      if (player?.track === track) return;
      player?.stop();
      player = track === 'none' ? null : new Player(b.ctx, track);
      console.info(`[music] ${track}`);
      pump();
    } catch (err) {
      console.warn('[music] could not start', err);
      player = null;
    }
  },

  setMood(m: MusicMood): void {
    mood = m;
  },

  setDucked(d: boolean): void {
    if (d === ducked) return;
    ducked = d;
    const b = bus ? audioBus() : null;
    if (b) level(b.ctx);
  },

  get enabled(): boolean {
    return enabled;
  },

  setEnabled(on: boolean): void {
    enabled = on;
    try {
      localStorage.setItem(PREF_KEY, on ? 'on' : 'off');
    } catch {
      /* storage blocked */
    }
    const b = bus ? audioBus() : null;
    if (b) level(b.ctx);
  },
};
