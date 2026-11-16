# Pocket Pantheon

> A living miniature civilization that makes a home on your desk.

Put on your Quest. A tiny medieval village drifts down onto your real table, and
its people stop what they are doing, look up, and wave at the giant in the sky.

That's you. Use your bare hands to pick up a farmer and set her down in a field. Hold a palm out and a
villager climbs on and rides it. Stretch a hand over a drought-cracked field and
it rains. Rest your hand flat on the table and the curious ones run up to touch
your fingertips, then scatter to hide.

No controllers, no menus, no walking around. Sit at a table and play with your hands.

## Why it's different

**It's a god game, but the point is restraint.** Every villager has two beliefs:
*Faith* in you and *Initiative* of their own. Bless them, rescue them, rain on
their crops, and they trust you more, but they also lean on you more. Help too
much and they stand idle, waiting for a sign. Stay away and Faith drifts down and
the fields go unattended. The game is the balance, and at dusk the village
gives you a name for how you played: *the Gentle Hand*, *the Storm-Caller*, *the
Lifter*, *the Balanced One*, *the Distant One*.

**Your real hands are part of the world.** Villagers see your shadow and look up
in awe. A hand resting on the table becomes a mountain to hide behind. The
real desk becomes the ground: the village grows straight out of your wood
grain, and on headsets with depth sensing a real mug or hand in front of it
hides the villagers behind it.

**The village outlives your session.** Close the browser and come back later:
every hour away becomes a day of village life, up to eight. Crops were
harvested, children were born and grew up, and an elder may have died and
been laid to rest in the graveyard. Everyone runs to the edge to cheer your
return, and the news waits for you on a stone tablet.

## What you can do

Everything is a hand gesture. Nothing needs a controller.

| Gesture | What happens |
| --- | --- |
| **Pinch** a villager and carry them | Set them on a field, hut or shrine and they get to work. Drop them from too high and they limp. |
| **Point** at someone and hold | A blessing: they grow braver and more faithful (costs Favor). |
| **Palm down** over a field | Rain for the crops. |
| **Both palms down** over the village | A golden shelter against the storm. |
| **Rest a hand in a storm cloud** | Calm it. Calm them all and the storm breaks early. |
| **Open palm up** at the village's edge | The faithful climb on and ride your hand. |
| **Rest your hand flat** on the table | Curious villagers touch your fingertips, then play hide-and-seek behind your hand. Lift it to find them. |
| **Wave** | They wave back. |
| **Look or point** at a villager | See their mood, needs and beliefs. |
| **Turn your left palm** to your face | Your stats: believers, the hungry, the remembered dead. |
| **Both palms to your face** | Pause. |
| **Both palms up** at opposite edges, held still | Lift the whole village and carry it somewhere else. |

Elder Ama teaches carrying, blessing and riding in about a minute. The rest
arrive when they matter: the drought teaches rain, the storm teaches shelter
and calming, and waving and pausing come along later.

## A village with a life of its own

- **Five people, then more.** Elder Ama and four villagers found the village. They farm, rest,
  pray and wander on their own needs and beliefs. Prayers are your only source
  of Favor, which pays for every power.
- **Birth, growing up and growing old.** Children are born at day's end when
  there is food to spare, play near their parents, grow up, grey, stoop on a cane
  and, in the end, are laid to rest. The village caps at fourteen.
- **Weather with stakes.** A drought dries the soil. A storm sends panicked
  villagers running and its lightning can strike. Shelter and calm the storm,
  or let them learn to cope.
- **It remembers.** Names, parents, children, a chronicle of the day's story and
  a graveyard where you can poke a headstone to learn who lies there.
- **It grows.** Over sessions, worn routes become stepping stones, cottages gain
  cobbled aprons and gardens, and the tablet gains carvings.
- **It waits for you.** Walk away from the table and the day clock holds.

## Built for mixed reality

- **Hands only, seated.** Gestures are recognised straight from XR hand joints
  (pinch, point, open palm, palm direction, hold time, speed), with no controller
  fallback. The whole village is 60 cm across and every interaction is within
  reach.
- **Real table, real depth.** The village finds your table through plane
  detection or a look-down hit test, shrinks to fit small ones, anchors there, and sinks its
  earth pedestal into the real surface. With depth sensing, real hands and
  objects occlude the miniature.
- **FoV-aware.** The village, panels and speech bubbles stay in a small central
  area so nothing important sits at the edge of the view.
- **Entirely procedural.** Every model, texture, sound and note is generated in
  code: low-poly vertex-coloured villagers, an adaptive modal soundtrack
  (a drone, plucked strings and a recorder that follow day, dusk, night and
  storm), wind, fire crackle, birdsong and babbled villager voices. No asset
  files, no network calls, no third-party services. The production build is under 4 MB.

## Run it

```sh
npm install
npm run dev
```

This starts the IWSDK dev server and an emulated Quest browser. To play on a
real headset, run `npm run dev:status`, open one of the network URLs on a Quest
on the same Wi-Fi, accept the local certificate warning, turn on **hand
tracking** in the headset's settings, put the controllers down, and press
**Enter the village**.

Other commands:

```sh
npm test            # Node unit tests for the simulation (no headset needed)
npm run typecheck
npm run build       # production build in dist/
```

On the flat browser page, **Shift+F** starts a brand-new village.

## How it's built

Built with Meta's [Immersive Web SDK](https://iwsdk.dev) (an ECS on Three.js)
and TypeScript, bundled with Vite.

```text
src/
  index.ts      world creation and system registration
  sim/          the whole game as pure, seeded, deterministic logic (no Three.js or XR)
  ecs/          IWSDK components and systems that show and drive it
  xr/           gesture recognition, table finding, placement, gaze
  scene-assets/ procedural models: villagers, huts, fields, the diorama
  art/          effects, weather and hand visuals
  ui/           manuscript-style panels, speech bubbles, the welcome page
  audio/        procedural music, ambience, voices and effects
  core/         event bus, constants, save and load
tests/          Node tests for the simulation
```

The simulation never touches the renderer, so everything that matters (needs,
beliefs, births, weather, ageing, fast-forwarding a missed day) is covered by
fast unit tests, and the gameplay numbers all live in one file,
`src/sim/rules.ts`.
