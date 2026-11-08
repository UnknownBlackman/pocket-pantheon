/**
 * Shared UI state so systems can ask for hints without importing each other.
 * Plain data; UISystem reads it every frame.
 */

export interface Toast {
  title: string;
  body: string;
  /** UI clock time (seconds) when it disappears. */
  until: number;
}

export const uiState = {
  /** True while the placement ghost is showing. */
  placing: false,
  /** World position of the placement ghost centre. */
  anchor: { x: 0, y: 0, z: 0 },
  toast: null as Toast | null,
  /** UI clock, seconds; advanced by UISystem. */
  time: 0,
};

/** Shows a short message on the hint panel for `seconds`. */
export function showToast(title: string, body: string, seconds = 4): void {
  uiState.toast = { title, body, until: uiState.time + seconds };
}
