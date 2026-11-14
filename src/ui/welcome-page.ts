/**
 * The welcome page: the HTML overlay in index.html, shown in the flat
 * browser view (desktop, or the Quest browser's 2D window before entering
 * XR). It greets returning players, launches XR from its button, and can
 * start a new village (second click to confirm).
 */
import { VisibilityState } from '@iwsdk/core';
import type { World } from '@iwsdk/core';
import { FRESH_FLAG, game } from '../ecs/game.ts';
import { music } from '../audio/music.ts';
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

  // Browsers keep sound off until the page is touched: the first tap or key
  // starts the welcome music.
  const unlock = (): void => music.unlock();
  document.addEventListener('pointerdown', unlock, { capture: true });
  document.addEventListener('keydown', unlock, { capture: true });

  const musicBtn = document.getElementById('music') as HTMLButtonElement | null;
  if (musicBtn) {
    const label = (): void => {
      musicBtn.textContent = music.enabled ? '♪ Music on' : '♪ Music off';
      musicBtn.setAttribute('aria-pressed', String(music.enabled));
    };
    label();
    musicBtn.addEventListener('click', () => {
      music.setEnabled(!music.enabled);
      label();
    });
  }

  enter.addEventListener('click', () => {
    music.unlock();
    world.launchXR();
  });

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
