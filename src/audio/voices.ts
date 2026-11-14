/**
 * Villager voices: a few babbled syllables (no words) whenever a villager
 * speaks, so a quip is heard as well as read. Each villager keeps their own
 * pitch; children are higher and the elder lower. The mood shapes the tune:
 * joy rises, sorrow falls, alarm is quick and high. Synthesised with a
 * buzzy source through two vowel formants (WebAudio, no files).
 */
import { audioBus, isMuted } from './sfx.ts';

export type VoiceMood = 'calm' | 'joy' | 'sad' | 'alarm' | 'elder';

/** First and second formants of a few vowels (Hz). */
const VOWELS: readonly (readonly [number, number])[] = [
  [800, 1200], // a
  [400, 2000], // e
  [320, 2300], // i
  [450, 850], // o
  [340, 750], // u
];

const VOLUME = 0.11;

export function villagerVoice(opts: {
  index: number;
  text: string;
  mood: VoiceMood;
  child: boolean;
  elder: boolean;
}): void {
  if (isMuted()) return;
  const b = audioBus();
  if (!b || b.ctx.state !== 'running') return;
  try {
    const ac = b.ctx;
    // A steady pitch per villager, from their index.
    const spread = ((opts.index * 37) % 11) / 11;
    let pitch = opts.child ? 380 + spread * 120 : opts.elder ? 165 : 190 + spread * 110;
    if (opts.mood === 'alarm') pitch *= 1.25;
    const syllables = Math.max(2, Math.min(6, Math.round(opts.text.length / 7)));
    const step = opts.mood === 'alarm' ? 0.085 : opts.mood === 'elder' || opts.mood === 'sad' ? 0.15 : 0.11;
    const out = ac.createGain();
    out.gain.value = VOLUME;
    const pan = ac.createStereoPanner();
    pan.pan.value = (spread - 0.5) * 0.6;
    out.connect(pan).connect(b.master);
    let t = ac.currentTime + 0.02;
    for (let i = 0; i < syllables; i++) {
      const progress = syllables > 1 ? i / (syllables - 1) : 0;
      // Mood contour across the phrase.
      let bend = 1 + (Math.random() - 0.5) * 0.12;
      if (opts.mood === 'joy') bend *= 1 + progress * 0.25;
      else if (opts.mood === 'sad') bend *= 1 - progress * 0.2;
      else if (i === syllables - 1) bend *= 1.08; // a little lift at the end
      const f0 = pitch * bend;
      const dur = step * (0.75 + Math.random() * 0.3);
      const [f1, f2] = VOWELS[Math.floor(Math.random() * VOWELS.length)];
      const src = ac.createOscillator();
      src.type = 'sawtooth';
      src.frequency.setValueAtTime(f0, t);
      src.frequency.linearRampToValueAtTime(f0 * (opts.mood === 'sad' ? 0.94 : 1.04), t + dur);
      const env = ac.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(1, t + 0.018);
      env.gain.setValueAtTime(1, t + dur * 0.6);
      env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      for (const [f, q, g] of [
        [f1 * (opts.child ? 1.15 : 1), 5, 0.9],
        [f2 * (opts.child ? 1.15 : 1), 8, 0.45],
      ] as const) {
        const bp = ac.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = f;
        bp.Q.value = q;
        const fg = ac.createGain();
        fg.gain.value = g;
        src.connect(bp).connect(fg).connect(env);
      }
      env.connect(out);
      src.start(t);
      src.stop(t + dur + 0.02);
      t += dur + 0.025;
    }
    setTimeout(() => out.disconnect(), (t - ac.currentTime + 0.5) * 1000);
  } catch {
    /* sound never breaks the game */
  }
}
