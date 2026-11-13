/**
 * The welcome page: the HTML overlay in index.html, shown in the flat
 * browser view (desktop, or the Quest browser's 2D window before entering
 * XR). It greets returning players, launches XR from its button, and can
 * start a new village (second click to confirm).
 */
import { VisibilityState } from '@iwsdk/core';
import type { World } from '@iwsdk/core';
import { FRESH_FLAG, game } from '../ecs/game.ts';
import { aliveCount } from '../sim/life.ts';

export function setupWelcomePage(world: World): void {
  const page = document.getElementById('welcome');
  const enter = document.getElementById('enter') as HTMLButtonElement | null;
  const fresh = document.getElementById('fresh') as HTMLButtonElement | null;
  const returning = document.getElementById('returning');
  const note = document.getElementById('note');
  if (!page || !enter || !fresh || !returning || !note) return;

  // Returning players: who they are to the village, and where it stands.
  const sim = game.sim;
  if (game.returning) {
    const title = sim.title ? `<em>${sim.title}</em>` : 'great one';
    returning.innerHTML = `Welcome back, ${title}. Day ${sim.dayIndex + 1}: ${aliveCount(sim)} villagers await you.`;
    returning.hidden = false;
    fresh.hidden = false;
    enter.textContent = 'Return to the village';
  }

  enter.addEventListener('click', () => world.launchXR());

  let armed = false;
  fresh.addEventListener('click', () => {
    if (!armed) {
      armed = true;
      fresh.textContent = 'Click again: your village will be lost';
      setTimeout(() => {
        armed = false;
        fresh.textContent = 'Start a new village';
      }, 4000);
      return;
    }
    try {
      sessionStorage.setItem(FRESH_FLAG, '1');
    } catch {
      /* storage blocked */
    }
    location.reload();
  });

  // Without immersive AR (a plain desktop browser), explain where to play.
  const xr = (navigator as Navigator & { xr?: XRSystem }).xr;
  if (!xr) {
    notSupported(enter, note);
  } else {
    xr.isSessionSupported('immersive-ar')
      .then((ok) => {
        if (!ok) notSupported(enter, note);
      })
      .catch(() => notSupported(enter, note));
  }

  // Shown only outside XR.
  world.visibilityState.subscribe((vis) => {
    page.classList.toggle('hidden', vis !== VisibilityState.NonImmersive);
  });
}

function notSupported(enter: HTMLButtonElement, note: HTMLElement): void {
  enter.disabled = true;
  enter.textContent = 'Open this page on a Meta Quest';
  note.hidden = false;
  note.textContent =
    'Tabletop Gods is played in mixed reality. Open this link in the Meta Quest browser, sit at a table and put your controllers down.';
}
