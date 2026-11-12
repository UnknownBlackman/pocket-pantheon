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
      events.on('villager.climbed', () => hop()),
      events.on('villager.fell', (e) => tumble(e.hard)),
      events.on('villager.hid', () => giggle()),
      events.on('hideseek.found', () => cheer()),
      events.on('god.waved', () => cheer()),
      events.on('god.cheered', () => cheer()),
    );
  }
}
