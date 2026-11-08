# Notes

## Decisions

- Entry point stays `src/index.ts` (IWSDK requires it to import
  `virtual:iwsdk-project`); it plays the role of `main.ts` in the design.
- `src/sim/` and `src/core/` use explicit `.ts` import extensions so Node 24 can
  run the tests directly with built-in type stripping (`npm test`), no extra
  test dependency. `tsconfig.test.json` typechecks tests with Node types.
- All tuning numbers, gesture thresholds and layout sizes are in
  `src/sim/rules.ts` (`RULES`, `GESTURES`, `LAYOUT`).
- No real-time shadows (design performance target): `environment.shadows` is off.
  Villagers and buildings use soft canvas blob shadows (`src/art/village-art.ts`).
- Sim extras beyond the design sketch: villager `intent`, `commit`, `panic`,
  `blessed` bookkeeping; World `rngState`, `sessionDay`, `session`, `phase`,
  `effects`, per-day `stats`. A `stickiness` score bonus stops villagers
  flip-flopping between near-equal actions.
- Farm work: x2 when the field is watered (water >= 0.8), x1.5 when the field
  or the worker is blessed (the rules table gives both numbers; they stack).
- Storm panic chance tuned down to 0.05/s per villager (0.15 kept a third of
  the village panicking all storm).
- Placement: plane -> hit test -> fallback platform. The ghost ring is a
  `OneHandGrabbable` (pinch-drag to move); pinching the air without grabbing
  the ring confirms. Outside XR the village sits at a fixed preview spot.
  The chosen source is logged as `[placement] village placed using <source>`.
- The authored `welcome-panel` doubles as the placement hint panel
  (`src/ui/hint-panel.ts`), floating 20 cm above the ghost and facing the player.
- Lift: villagers carry `OneHandGrabbable` (rotate off). `LiftSystem` maps
  grab/release to `liftVillager`/`dropVillager`, shows a gold drop marker over a
  valid job and plays procedural squeal/plop sounds (`src/audio/sfx.ts`).

- Gestures (`src/xr/gestures.ts`) use the knuckle (phalanx-proximal) joints:
  a finger is extended when its tip reaches >= 4 cm further from the wrist
  than its knuckle, curled when < 1.5 cm. Scale-free across hand sizes.
- Rain holds watered fields at full water for the 30 s the cloud lasts; after
  that they drain at the weather's normal rate. `rainWaterDrainPerSecond`
  is kept in rules.ts but not used yet.
- Gaze bubble uses head direction (the design's fallback). IWSDK's
  `GazeSystem` (enabled by the `gazeTracking` XR feature) turns the input
  model into gaze+pinch and disables hand rays, which could fight
  pinch-to-lift; try it on a headset with eye tracking before switching.
- Spatial UI uses canvas-texture panels (`src/ui/canvas-panel.ts`). The
  UIKit welcome panel rendered in the browser view but not inside the
  emulated XR session during the Day 5 check; it now stays browser-only.

## Known issues / todo

- Day 1 deploy to GitHub Pages or Vercel not done yet: it needs the owner's
  hosting account. `vite.config.ts` already uses `base: './'`, so a static
  host at a sub-path works. Use the `iwsdk-hosting` skill when ready.

## Headset test list

- Pinch-grab of a 4 cm villager: does the proximity grab reliably catch it?
  If not, add a larger invisible grab collider or scale villagers up.
- Plane detection: which label does Quest report for the table? Is the plane
  entity's origin the plane centre (the ghost snaps to it)?
- Hit-test reticle from a hand ray: does it land on the table?
- Anchoring: village stays put after recentering / re-entering.
- Placement confirm: pinching the air must not fire by accident while dragging
  the ring.
- Hint panel readable at ~50 cm and inside the central view.
- Poke-hold: does the index tip reliably come within 4 cm of a 4 cm
  villager without the hand's grab pinch firing?
- Palm-down Rain/Shelter: thresholds (palm normal dot < -0.7, 5-30 cm
  above the table, palm speed < 0.15 m/s) need tuning on real hands.
