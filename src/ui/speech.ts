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
}

export const speech = {
  requests: [] as SpeechRequest[],
  narration: [] as string[],
};

export function say(index: number, text: string, seconds = 3.2, priority = false): void {
  if (index < 0) return;
  // Keep the queue short: old chatter is dropped.
  if (speech.requests.length > 6) speech.requests.shift();
  speech.requests.push({ index, text, seconds, priority });
}

export function narrate(text: string): void {
  if (speech.narration.length > 3) speech.narration.shift();
  speech.narration.push(text);
}
