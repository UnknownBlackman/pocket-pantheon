# Pocket Pantheon

*A living miniature civilization that makes a home on your desk.*

Imagine putting on your Quest and watching a tiny village float down onto your
real table. The villagers stop what they're doing, look up, and wave at the giant
in the sky.

That giant is you.

From there it's all hands. Pinch up a farmer and set her down in a field. Hold
out an open palm and watch someone climb on for a ride. When the fields crack
in a drought, stretch your hand over them and it rains. Rest your hand flat on the
table and the curious ones come running to touch your fingertips, then scatter
to hide behind your hand.

There are no controllers and no menus, and you never have to stand up. Sit down at
a table and play with your hands.

## The trick is knowing when to stop

Every villager has two kinds of belief: *Faith* in you, and *Initiative* of their own.

Bless them, rescue them, rain on their crops, and they trust you more. But
they start leaning on you too. Help too much and you'll find people standing
around waiting for a sign. Stay away and their faith drifts, and the fields go
untended.

So the game is really about balance. At dusk the village decides what to call
you, based on how you played: *the Gentle Hand*, *the Storm-Caller*, *the Lifter*,
*the Balanced One*, or, if you barely showed up, *the Distant One*.

## Your hands, your desk

We wanted the real room to be part of the game, not just a backdrop.

The village looks for your table and settles onto it, shrinking a little if
the table is small. Then it does something we love: the little earthen
base sinks away and the village grows straight out of your actual desk, wood
grain and all. If your headset has depth sensing, a real mug or your own
hand in front of the village hides the villagers behind it, the way it would
with real objects.

The villagers notice you, too. They see your shadow and look up in awe. They
wave back when you wave. Rest your hand on the table and it becomes the best
hiding spot in the village.

## Come back tomorrow

Close the game and come back later, and the village will have carried on
without you. Every hour you're away counts as a day of village life, up to
eight. Crops get harvested, children are born and grow up, and sometimes an
elder dies and is laid to rest in the graveyard. When you return, everyone runs
to the edge of the table to cheer, and what happened while you were gone is
waiting on a stone tablet beside the shrine.

Walk away from the table mid-game and the village simply waits for you.

## What your hands can do

Everything is a gesture, and none of it needs a controller.

- **Pinch a villager and carry them.** Set them down on a field, a hut or the
  shrine and they'll get to work. Drop them from too high and they'll limp
  home.
- **Point at someone and hold.** That's a blessing. It costs a little Favor.
- **Hold a flat palm over a field.** Rain.
- **Hold both palms over the village.** A golden shelter, for when the storm comes.
- **Rest your hand in a storm cloud.** It calms. Calm every cloud and the storm breaks early.
- **Open palm, facing up, at the edge of the village.** The faithful climb on for a ride.
- **Rest your hand flat on the table.** The curious come to touch your
  fingertips and then play hide-and-seek. Lift your hand to find them.
- **Wave.** They wave back.
- **Look or point at a villager.** You'll see how they're feeling.
- **Turn your left palm towards you.** A little card shows your stats: who
  believes, who's hungry, who you've lost.
- **Both palms towards your face.** Pause.
- **Both palms up at opposite edges, held still.** Lift the whole village and
  carry it somewhere new.

You won't have to memorise any of this. Elder Ama teaches carrying, blessing
and riding in your first minute, and the rest comes when it matters: the
drought teaches rain, the storm teaches shelter and calming, and waving and
pausing come along later.

## A village that lives on its own

Five villagers found the settlement: Elder Ama and four others. Left alone,
they farm, rest, pray and wander about, guided by their own needs and beliefs.
Their prayers are where your Favor comes from, and Favor pays for every power
you use.

They're born, they grow up, they go grey, and eventually they stoop over a
cane and are laid to rest. Children play near their parents, and the village
tops out at fourteen. A storm sends people running in panic, and its lightning
can strike. Villagers remember each other, and you can poke a headstone to
learn who lies there and who they left behind.

The place changes over time too. Paths wear into stepping stones where people
walk most, cottages gain cobbled doorways and little gardens, and the tablet by the shrine
gets a new carving after every session.

## For the curious: how it works

Pocket Pantheon is built with Meta's [Immersive Web SDK](https://iwsdk.dev) on
Three.js, in TypeScript. A few things we're proud of:

- **Hands only, and seated.** Gestures are recognised directly from the hand
  joints, using pinch distance, which fingers are extended, which way the palm
  faces, how still it is and how long you hold it. There's no controller
  fallback. The whole village is 60 cm across, so everything is within reach.
- **It knows your table.** Plane detection and a look-down hit test find the
  surface, and an anchor keeps the village there.
- **Everything is made in code.** No models, textures or audio files, and no
  network calls. The villagers, huts and fields are generated low-poly meshes.
  The music is synthesised live: a drone, plucked strings and a recorder that shift
  with the time of day and the weather, alongside wind, a crackling fire, birdsong
  and babbled villager voices. The whole production build is under 4 MB.
- **The game and the graphics are kept apart.** All the rules live in a plain,
  seeded simulation that knows nothing about the renderer, so we can test the
  important parts (needs, beliefs, births, ageing, even fast-forwarding a day you
  missed) quickly, with no headset. Every tuning number sits in one file,
  `src/sim/rules.ts`.

```text
src/
  sim/           the game: pure, seeded, deterministic logic
  ecs/           IWSDK systems that show and drive it
  xr/            gesture recognition, table finding, placement
  scene-assets/  procedural models: villagers, huts, fields, the diorama
  art/           effects, weather and hand visuals
  ui/            manuscript-style panels, speech bubbles, the welcome page
  audio/         music, ambience, voices and sound effects
  core/          event bus, constants, save and load
tests/           Node tests for the simulation
```

## Try it

```sh
npm install
npm run dev
```

That starts the dev server and opens an emulated Quest in your browser.

To play on a real headset, run `npm run dev:status` and open one of the network
URLs in the Quest browser (on the same Wi-Fi). Accept the certificate warning,
make sure **hand tracking** is on in the headset settings, put your controllers
down, and press **Enter the village**.

A few other commands you might want:

```sh
npm test         # simulation tests, no headset needed
npm run typecheck
npm run build    # production build in dist/
```

On the flat browser page, press **Shift+F** to start a brand-new village.
