/**
 * The hero's welcome: when the god comes back (a saved village reopened, or
 * walking back after wandering off), the villagers drop their tools, run to
 * the edge of the village nearest the god and cheer, and the elder calls out.
 */
import { cheer } from '../audio/sfx.ts';
import { events } from '../core/events.ts';
import { barkLine } from '../sim/barks.ts';
import { heroWelcome } from '../sim/presence.ts';
import { guideElder } from '../sim/tutorial.ts';
import { say } from '../ui/speech.ts';
import { game } from './game.ts';

export function returnRitual(): void {
  const sim = game.sim;
  const p = game.presence;
  const toward = p.headPresent ? { x: p.head.x, z: p.head.z } : { x: 0, z: 1 };
  const came = heroWelcome(sim, toward, events);
  if (!came) return;
  console.info(`[ritual] ${came} villagers run to greet the returning god`);
  const elder = guideElder(sim);
  if (elder) say(sim.villagers.indexOf(elder), barkLine('welcome', Math.random), 3.5, true, 'joy');
  // The cheer as they reach the edge.
  setTimeout(() => cheer(), 2600);
}
