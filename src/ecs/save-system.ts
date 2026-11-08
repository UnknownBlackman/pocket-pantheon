/**
 * Saves the village: at dusk, when paused, when the page is hidden or
 * closed, when the XR session is hidden or blurred, and every 20 s while
 * playing as a safety net. Never throws.
 */
import { createSystem, VisibilityState } from '@iwsdk/core';
import { events } from '../core/events.ts';
import { browserStorage, saveWorld } from '../core/save.ts';
import { game } from './game.ts';

const AUTOSAVE_SECONDS = 20;

export class SaveSystem extends createSystem({}) {
  private sinceSave = 0;

  init(): void {
    const save = (why: string) => this.save(why);
    const onPageHide = () => save('page hidden');
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') save('page hidden');
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    this.cleanupFuncs.push(
      () => document.removeEventListener('visibilitychange', onVisibility),
      () => window.removeEventListener('pagehide', onPageHide),
      events.on('session.dusk', () => save('dusk')),
      events.on('session.paused', (p) => {
        if (p.paused) save('pause');
      }),
      events.on('village.placed', () => save('placed')),
      this.world.visibilityState.subscribe((vis) => {
        if (vis === VisibilityState.Hidden || vis === VisibilityState.VisibleBlurred) save('xr blurred');
      }),
    );
  }

  private save(why: string): void {
    // Nothing worth saving before the first placement of a brand-new village.
    if (game.stage !== 'playing' && !game.returning) return;
    if (saveWorld(browserStorage(), game.sim)) {
      this.sinceSave = 0;
      console.info(`[save] saved (${why})`);
    }
  }

  update(delta: number): void {
    if (game.stage !== 'playing' || game.paused) return;
    this.sinceSave += delta;
    if (this.sinceSave >= AUTOSAVE_SECONDS) this.save('autosave');
  }
}
