/**
 * Plays the village's reaction sounds from game events, so the systems that
 * cause them do not need to know about audio.
 */
import { createSystem } from '@iwsdk/core';
import { cheer, giggle, hop, tumble } from '../audio/sfx.ts';
import { events } from '../core/events.ts';

export class AudioSystem extends createSystem({}) {
  init(): void {
    this.cleanupFuncs.push(
      events.on('villager.climbed', (e) => {
        hop();
        console.info(`[presence] ${e.villagerId} climbed onto the hand`);
      }),
      events.on('villager.fell', (e) => {
        tumble(e.hard);
        console.info(`[presence] ${e.villagerId} ${e.hard ? 'fell off' : 'hopped down from'} the hand`);
      }),
      events.on('villager.hid', (e) => {
        giggle();
        console.info(`[presence] ${e.villagerId} is hiding behind the hand`);
      }),
      events.on('hideseek.found', (e) => {
        cheer();
        console.info(`[presence] found ${e.count} hiding`);
      }),
      events.on('god.waved', () => cheer()),
      events.on('god.cheered', () => cheer()),
    );
  }
}
