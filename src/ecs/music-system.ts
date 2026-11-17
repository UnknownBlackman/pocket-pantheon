/**
 * Chooses the music (audio/music.ts) from the state of the game:
 * - the welcome theme on the welcome page and while the village arrives;
 * - the village theme once play begins, following the time of day and the
 *   weather (day, dusk, night, storm);
 * - wind, the campfire and birdsong around the village (audio/ambience.ts);
 * - quieter while the game is paused. When the headset blurs the app, the
 *   master mute in UISystem silences it with the sound effects.
 */
import { createSystem, VisibilityState } from '@iwsdk/core';
import { ambience } from '../audio/ambience.ts';
import { music } from '../audio/music.ts';
import type { MusicMood } from '../audio/music.ts';
import { RULES } from '../sim/rules.ts';
import { game } from './game.ts';

export class MusicSystem extends createSystem({}) {
  update(): void {
    const inXR = this.world.visibilityState.peek() !== VisibilityState.NonImmersive;
    const playing = inXR && game.stage === 'playing';
    music.play(playing ? 'village' : 'intro');
    const sim = game.sim;
    let mood: MusicMood = 'day';
    if (sim.weather === 'storm') mood = 'storm';
    else if (sim.weather === 'rain' && sim.phase === 'day') mood = 'dusk'; // softer, no drums
    else if (sim.weather === 'snow' && sim.phase === 'day') mood = 'night'; // hushed
    else if (sim.phase !== 'day') mood = 'dusk';
    else if (sim.timeOfDay >= RULES.session.nightStart) mood = 'night';
    music.setMood(mood);
    music.setDucked(game.paused || game.godAway);
    // Wind, fire and birds only around the village itself.
    const weatherAmbience = sim.phase === 'day' && (sim.weather === 'rain' || sim.weather === 'snow') ? sim.weather : mood;
    ambience.set(playing && !game.paused ? weatherAmbience : 'off');
  }
}
