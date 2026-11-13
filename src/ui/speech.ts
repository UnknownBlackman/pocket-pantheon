/**
 * A tiny queue for things villagers say (speech bubbles) and one-line
 * narration. Any system may push; SpeechSystem shows them, rate-limited.
 */

export interface SpeechRequest {
  /** Villager index in the sim list. */
  index: number;
  text: string;
  seconds: number;
  /** Priority lines (the tutorial elder) skip the rate limits. */
  priority: boolean;
  /** Sets the bubble's look (ui/bubble.ts). */
  mood: 'calm' | 'joy' | 'sad' | 'alarm' | 'elder';
}

export const speech = {
  requests: [] as SpeechRequest[],
  narration: [] as string[],
};

export function say(
  index: number,
  text: string,
  seconds = 3.2,
  priority = false,
  mood: SpeechRequest['mood'] = priority ? 'elder' : 'calm',
): void {
  if (index < 0) return;
  // Keep the queue short: old chatter is dropped.
  if (speech.requests.length > 6) speech.requests.shift();
  speech.requests.push({ index, text, seconds, priority, mood });
}

export function narrate(text: string): void {
  if (speech.narration.length > 3) speech.narration.shift();
  speech.narration.push(text);
}
