# Tabletop Gods: Design Doc and Build Plan

Nov 4, 2026 · @Ola

A seated, hands-only mixed-reality god game on a real table, built with Meta's Immersive Web SDK for the Meta VR Start Developer Competition (deadline Nov 18, 2026, 12:00pm PST).

## Brief and ground rules

**Product.** Tabletop Gods (working title) puts a small living village on the player's real table in passthrough. Villagers act on their own needs and beliefs. The player is a god who guides them with hand gestures, and the village remembers what the player did between sessions.

**Competition fit.** Track: Gaming. Division: New Experience. Judged on Innovation & Creativity, Experience Design, Technical Implementation (hand tracking, gaze, passthrough, spatial anchoring, FoV-aware design) and Polish & Presentation.

**Hard constraints. Never violate these.**

| Rule | What it means for the build |
| --- | --- |
| Hands-first | The whole game, including menus, tutorial, pause and restart, works with hands only. No controller-only path. |
| Seated, two-foot radius | No walking. Village footprint about 60 cm across; every interaction reachable from a seated position. |
| Satisfying in 10 minutes | A full session is 8 to 10 minutes. Cold start under 10 seconds. Clean pause and resume. |
| Original, not a wrapper | The game must be fully playable with no network calls and no third-party AI service. Any LLM feature is optional and off by default. |
| FoV-aware | Keep all gameplay and UI inside a small central area in front of the player. Nothing important at the edges. |

**Definition of done (Nov 18, before 12:00pm PST).**

- [ ] A public HTTPS link opens the game in the Quest browser and runs a full session using hands only.
- [ ] The first five minutes teach everything through play, with no external instructions.
- [ ] The village state survives closing and reopening the page.
- [ ] A demo video under 3 minutes is public on YouTube or Vimeo and leads with the best moment.
- [ ] The submission form is complete, including a tagline of 140 characters or fewer.
- [ ] Nothing is changed after submission; judging uses the state at the deadline.

## Stack and setup

**Stack.** Meta's Immersive Web SDK (IWSDK) on Three.js with its Entity Component System (ECS), bundled by Vite. Use TypeScript if the generator offers it, otherwise JavaScript; the types in this doc are guidance either way. No backend. Save data in the browser's storage.

**Create the project.** Run `npm create @iwsdk@latest` and answer the prompts as follows:

| Prompt | Answer | Why |
| --- | --- | --- |
| Experience type | Augmented Reality | Gives passthrough on the real table. |
| Hand tracking | Optional | Session still starts if hands are off; show a "turn on hand tracking" panel when no hand data arrives. |
| Anchors | Optional | Keeps the village in place across sessions when available. |
| Hit test | Optional | Used to place the village on a surface. |
| Plane detection | Optional | Finds the table top automatically. |
| Mesh detection | No | Not needed; saves load time. |
| Scene understanding | Yes | Includes the plane and anchor systems. |
| Grabbing | Yes | One-hand grab for lifting villagers. |
| WebXR Layers | No | Not needed. |

**Dev loop.**

1. `npm run dev` starts the dev server and opens the app. `npx iwsdk dev status` prints the current local URL.
2. Open that URL in desktop Chrome and click Enter XR. IWER, the built-in emulator, simulates a Quest 3 with mouse and keyboard, so no headset is needed.
3. For a real headset, forward the dev port to the headset with Chrome DevTools (Remote Target, then Port forwarding) and open the forwarded URL in the Quest browser.
4. Deploy with a static host (GitHub Pages or Vercel). Meta's "Deploying to GitHub Pages" guide covers the Vite base path.

**Folder layout to create.**

```text
src/
  main.ts            world creation, feature flags, system registration
  core/              constants, events (tiny pub/sub), save/load
  sim/               pure simulation code, no Three.js imports
    villager.ts      needs, beliefs, decisions
    world.ts         resources, weather, buildings, time of day
    powers.ts        effects of each god power
    rules.ts         tuning numbers in one place
  ecs/               IWSDK components and systems
  xr/                gesture detection, placement, anchors, gaze
  ui/                spatial panels (tutorial, hints, dusk summary)
  art/               procedural low-poly meshes and materials
  audio/             sound loading and mixing
tests/               unit tests for sim/ (run in Node)
```

**Key separation.** Everything in `sim/` is plain TypeScript with no XR code, so it can be unit-tested in Node and the game logic can be changed without a headset.

## Game design

**Design hook.** The player is a guide, not a puppeteer. Every villager has two beliefs about the player. **Faith** is how much they trust the god. **Initiative** is how much they act on their own. Helping raises Faith but lowers Initiative; staying away does the opposite. The player is rewarded for balance, and the village visibly shows which way it is leaning.

**Session loop (8 to 10 minutes).** One session is three short "days" and a dusk summary.

| Phase | Length | What happens |
| --- | --- | --- |
| Place | 20 s | Player pinches a spot on the table to plant the village (or the game finds the table automatically). |
| Day 1 | 2 min | Villagers work, get hungry and tired. Tutorial prompts teach lift and bless through play. |
| Day 2 | 2.5 min | A drought dries the fields. Tutorial teaches rain. |
| Day 3 | 2.5 min | A storm hits. Tutorial teaches shelter. Later sessions swap in random events. |
| Dusk | 1.5 min | Villagers gather at a campfire. A short chronicle lists what happened and how Faith and Initiative changed. |

**Resources and villagers.** Start with 8 villagers, 3 fields, 3 huts and 1 shrine. Food comes from fields, rest from huts, Faith from the shrine. The player has a **Favor** meter that fills when villagers pray and is spent by powers.

**God powers.** Keep to four. Each is one gesture and one clear effect.

| Power | Gesture | Effect | Favor cost |
| --- | --- | --- | --- |
| Lift | Pinch a villager, move, release | Drop on a field, hut or shrine to send them there. Free. | 0 |
| Bless | Poke a villager or building and hold for 1 s | Boosts work speed or rest for 20 s. Raises Faith, lowers Initiative. | 1 |
| Rain | Open palm facing down above fields | Waters crops in range for 30 s. | 2 |
| Shelter | Both palms down over the village | Protects that area from storm and wolves for 15 s. | 2 |

**Reason to come back.** The village is saved between sessions. Each session starts with a short note about what changed while away (crops grew, a villager was born, a festival happens if Faith stayed high). Chronicle entries from past sessions stay readable on a stone tablet near the shrine.

**Feel and polish targets.**

- Every power has an instant visual and sound response within 100 ms.
- Villagers use simple expressive animation: walk, work, rest, pray, panic, cheer. Use bobbing, squash and stretch on primitive shapes; no skeleton animation is needed.
- Low-poly art with a warm palette, soft shadows and a day-night tint. Procedural sounds or CC0 audio only.

## Simulation data model

All of this lives in `src/sim/` with no Three.js or XR imports. Positions are in metres on the table plane, with the village centre at the origin. All values with a range are clamped to 0..1 unless stated.

```ts
type Vec2 = { x: number; z: number };
type Activity = 'idle' | 'walk' | 'farm' | 'rest' | 'pray' | 'panic' | 'cheer';

interface Villager {
  id: string;
  name: string;
  pos: Vec2;
  target: Vec2 | null;
  activity: Activity;
  needs: { hunger: number; fatigue: number };   // 1 = urgent
  beliefs: { faith: number; initiative: number };
  mood: number;                                  // derived each tick
  carried: boolean;                              // true while the player holds them
  homeId: string | null;
  memory: ChronicleRef[];                        // last 5 things that happened to them
}

type BuildingKind = 'field' | 'hut' | 'shrine' | 'campfire';
interface Building {
  id: string;
  kind: BuildingKind;
  pos: Vec2;
  water: number;        // fields only
  growth: number;       // fields only
  sheltered: number;    // seconds of Shelter power remaining
  blessed: number;      // seconds of Bless remaining
}

interface World {
  version: 1;
  seed: number;
  dayIndex: number;
  timeOfDay: number;                // 0..1 within a day
  weather: 'clear' | 'drought' | 'storm';
  favor: number;                    // 0..10, not 0..1
  food: number;                     // village stock, 0..100
  villagers: Villager[];
  buildings: Building[];
  chronicle: ChronicleEntry[];
  lastSavedAt: number;              // epoch ms
}

interface ChronicleEntry { day: number; kind: string; text: string; villagerIds: string[] }
type ChronicleRef = { entryIndex: number };
```

**Decision rule (runs about twice a second per villager).** Score each candidate action, pick the highest, and add small random noise so villagers do not move in lockstep.

- `eat/farm` scores `needs.hunger` plus a small bonus when a field is ripe.
- `rest` scores `needs.fatigue`, and is higher at night.
- `pray` scores `beliefs.faith` times 0.6, only when both needs are below 0.5.
- `panic` overrides everything during storms, drought-driven thirst or wolf attacks, unless the area is sheltered.
- If `beliefs.initiative` is below 0.25, the villager picks `idle` and waits for a bless or a lift. This is the "too dependent" state and the player should see it clearly.

**Tuning values (all in `rules.ts`, nothing hard-coded elsewhere).**

| Rule | Starting value |
| --- | --- |
| Hunger growth | +0.004 per second (about one meal per day) |
| Fatigue growth | +0.003 per second, +0.006 at night |
| Farm work | field growth +0.01 per second per worker, doubled while blessed or watered |
| Bless on a villager | faith +0.08, initiative −0.05 |
| Bless on a building | worker speed ×1.5 for 20 s; faith +0.03 for workers |
| Lift and drop on a job | initiative −0.02 each time |
| Passive drift per game day with no intervention | faith −0.03, initiative +0.03 |
| Prayer | each prayer adds 0.2 Favor; Favor caps at 10; start at 3 |
| Rain | field water set to 1 in range, drains 0.01 per second |
| Shelter | immune to storm and wolves for 15 s |
| Dusk score | average of (1 minus the gap between faith and initiative) and average mood, shown as 1 to 5 stars |

**Chronicle.** Every notable event (first harvest, storm survived, villager panics, prayer count, festival) appends a `ChronicleEntry` produced from a plain template, for example "Day 2: the fields dried up and the villagers looked to the sky." No AI or network needed.

**Save format.** Serialise `World` as JSON under one key (`tabletop-gods-save-v1`) in `localStorage`, saved on every dusk and on `visibilitychange` hidden. On load, if the save is older than 10 minutes, call `fastForward(hours)` (capped at 8 hours of simulated time, coarse steps) to grow crops, apply passive drift and append a "while you were away" entry. Always wrap storage calls in try/catch and fall back to a fresh village.

## Architecture

**Pattern.** The simulation in `sim/` is the source of truth. IWSDK entities are only the visible and touchable "view" of it. Systems read input, call into `sim/`, then copy state onto entities. Follow the ECS conventions and API names in the generated project template and the docs at iwsdk.dev; do not guess API signatures, read the template code first.

**Components (data on entities).**

| Component | Holds |
| --- | --- |
| VillagerView | sim id, mesh group, animation state, shadow blob |
| BuildingView | sim id, mesh group, kind |
| Grabbable | IWSDK's grab component, enabled on villagers only |
| PowerEffect | kind (rain, shelter, bless), age, radius, owner hand |
| UIPanel | panel type (tutorial, hint, dusk, tablet), anchored position |
| VillageRoot | the transform that anchors the whole village to the table |

**Systems in update order each frame.**

1. `HandGestureSystem`: reads hand joints and emits gesture events (pinch start/move/end, poke-hold, palm-down, cup).
2. `PlacementSystem`: finds the table, places and anchors `VillageRoot`, handles the fallback (see Interaction and placement).
3. `PowerSystem`: turns gesture events into calls to `sim/powers.ts`; spends Favor; spawns `PowerEffect` entities.
4. `SimSystem`: runs `sim.tick()` at a fixed 10 Hz using an accumulator; does nothing while the session is paused.
5. `SyncSystem`: copies sim positions and states to entities with smoothing; carried villagers follow the pinching hand.
6. `AnimationSystem`: procedural walk bob, work swing, pray kneel, panic jitter, cheer hop.
7. `EffectsSystem`: rain particles, shelter dome, bless sparkles, day-night tint, weather.
8. `AudioSystem`: ambient bed, per-power sounds, villager murmurs, spatialised at the village.
9. `UISystem`: tutorial prompts, hints, dusk summary, tablet; all panels near the village and inside the central field of view.
10. `SaveSystem`: saves at dusk, on pause and on page hide.

**Events (tiny pub/sub in `core/events.ts`).** `villager.lifted`, `villager.dropped`, `power.used`, `day.changed`, `weather.changed`, `chronicle.added`, `session.dusk`. Systems talk through these, not by importing each other.

**Pause rule.** When the XR visibility state is not `visible`, or the player opens the pause gesture panel, stop `SimSystem`, mute audio and save. Resume restores everything with no loss.

**Performance targets (design targets, verify on a headset).**

- Hold the headset's native frame rate (72 Hz or higher) with 12 villagers.
- Fewer than about 100 draw calls: merge static geometry and instance repeated meshes.
- No real-time shadows; use blob shadows. Keep textures small and generate colours in code where possible.

## Interaction and placement

**Gestures.** Read WebXR hand joints (wrist, palm, thumb tip, index tip and so on) in `xr/gestures.ts`. Each gesture is a small pure function over joint positions so it can be unit-tested with recorded poses. All thresholds are starting values to tune on a real headset; keep them in one config object.

| Gesture | Detection rule | Hold | Notes |
| --- | --- | --- | --- |
| Pinch (Lift) | Thumb tip to index tip under 2 cm to start, over 3.5 cm to release | none | Use IWSDK's grab system for the lift itself. The two thresholds prevent flicker. |
| Poke-hold (Bless) | Index tip within 3 cm of a villager or building, other fingers curled | 1.0 s | Show a ring that fills while holding, so the player understands. |
| Palm-down (Rain) | Palm normal points down (dot with up below −0.7), fingers extended, hand 5 to 30 cm above a field, slow movement | 0.5 s | Valid only over fields. |
| Both palms down (Shelter) | Two palm-down hands, wrists 10 to 25 cm apart, above the village | 0.7 s | Wins over Rain when both hands qualify. |
| One palm down over non-field ground (Shelter, one-handed) | Same as palm-down but not over a field | 1.5 s | Accessibility alternative so every power works with one hand. |
| Pause | Both palms facing the user, held at chest height | 1.0 s | Opens a hands-only pause panel with Resume and Restart. |

**Gaze.** Use IWSDK's gaze pointer. Looking at a villager for 0.4 s shows a small bubble with their needs, Faith and Initiative as icons. On hardware without eye tracking the SDK should fall back to head direction; confirm this in the IWSDK docs and design the bubble to work with either.

**Scale and layout (design choices).**

| Object | Size |
| --- | --- |
| Village footprint | about 60 cm across, a round diorama with a visible stone rim |
| Villager | about 4 cm tall, large enough to pinch |
| Field | about 10 cm square |
| Hut | about 8 cm |
| Shrine and campfire | about 10 cm |
| Floating panels | 40 to 60 cm from the eyes, inside the central view, never beyond the village edge |

**Placement flow (`xr/placement.ts`).**

1. Request plane detection and hit test if available. Prefer a plane labelled as a table if the API exposes labels; otherwise use the largest horizontal plane about 0.4 to 1.0 m above the floor.
2. Show a ghost outline of the village on that surface. The player pinches to confirm. Always ask for confirmation; it also teaches pinching.
3. After confirming, create an anchor for `VillageRoot` with IWSDK's anchor feature. If persistent anchors are not available on the device, run placement again at the start of each session; treat anchor persistence as a bonus, not a requirement.
4. **Fallback chain:** plane detection, then hit test, then a floating diorama platform 50 cm in front of the player and 25 cm below eye level that the player can move with a pinch-drag before confirming. The game must work completely with this fallback, because the emulator and some rooms will use it.

**Hands not available.** If no hand data arrives within 3 seconds of session start, show a panel in front of the player saying hand tracking is needed and how to turn it on. Controller fallback is a stretch goal, not a requirement.

## Build plan

Day 1 is Wed Nov 4 and Day 14 is Tue Nov 17. The real deadline is Nov 18 at 12:00pm PST, which is 9:00pm in Lagos, so Day 14 is a buffer. Each task has an acceptance test; a task is not done until it passes. The agent should complete tasks in order and commit after each one.

**Day 1 (Nov 4): Skeleton and deploy**

- [ ] Create the IWSDK project with the flags in the setup section. Acceptance: `npm run dev` runs and the emulator shows a grabbable cube after Enter XR.
- [ ] Deploy the empty project to GitHub Pages or Vercel. Acceptance: the public HTTPS URL loads in a normal desktop browser. Deploy early so deployment problems appear now, not on the last day.
- [ ] Add the folder layout, the event bus and `rules.ts`.

**Day 2 (Nov 5): Simulation core**

- [ ] Implement the types, `World`, `tick(dt)`, the villager decision rule and needs growth in `sim/`. Acceptance: a Node test runs 10 simulated minutes and villagers farm, rest and pray without errors.
- [ ] Implement weather states and the chronicle templates. Acceptance: tests show a drought dries fields and creates a chronicle entry.
- [ ] Seeded randomness so tests are repeatable.

**Day 3 (Nov 6): Make it visible**

- [ ] Procedural low-poly meshes for ground diorama, villager, field, hut, shrine and campfire. Acceptance: the village renders at the sizes in the layout table.
- [ ] `SyncSystem` and `AnimationSystem`. Acceptance: in the emulator, 8 villagers walk, farm, rest and pray on their own.

**Day 4 (Nov 7): Placement**

- [ ] Plane detection, hit test, ghost outline, pinch-to-confirm and the fallback platform. Acceptance: the emulator can place the village using the fallback, and the code path for real planes exists and logs which source it used.
- [ ] Anchor `VillageRoot` where supported. Acceptance: no errors when anchors are unavailable.

* **Gate:** the village is playable to watch in the emulator.

**Day 5 (Nov 8): Lift**

- [ ] Make villagers grabbable. Acceptance: pinch-lift, carry and drop works in the emulator; a dropped villager on a field starts farming, on a hut starts resting, on the shrine starts praying.
- [ ] Villagers react while carried (dangle animation, soft squeal sound placeholder).

**Day 6 (Nov 9): Bless and gaze**

- [ ] Poke-hold with a filling ring. Acceptance: a held poke blesses the target, changes Faith and Initiative as specified, spends 1 Favor and shows sparkles.
- [ ] Gaze bubble with needs and beliefs icons. Acceptance: looking at a villager for 0.4 s shows the bubble and it disappears when looking away.

**Day 7 (Nov 10): Weather and the other powers**

- [ ] Rain and Shelter gestures, effects and Favor spending. Acceptance: Rain refills fields, Shelter blocks storm panic, both validated by tests in `sim/` and visible in the emulator.
- [ ] Scripted drought on Day 2 and storm on Day 3 of the first session; random events in later sessions.

**Day 8 (Nov 11): First five minutes and UI**

- [ ] Tutorial driven by what the player does (not by timers): place, lift, bless, rain, shelter. Acceptance: a person who has never seen the game completes the loop without outside help (test with a friend or by following the steps yourself with a fresh save).
- [ ] Spatial panels for hints and the pause gesture panel. Acceptance: panels stay in the central field of view and every action works with hands.

**Day 9 (Nov 12): Dusk, chronicle and saving**

- [ ] Dusk scene with the campfire, star rating and chronicle summary. Acceptance: a full 8 to 10 minute session ends with the summary.
- [ ] Save, load and `fastForward`. Acceptance: reload the page and the same village, Favor and chronicle return; a save older than 10 minutes shows the "while you were away" note.
- [ ] Stone tablet that lists past chronicle entries.

**Day 10 (Nov 13): First real headset test**

- [ ] Run the game on a real Quest. Acceptance: record every problem in a list with severity. Check pinch reliability, poke-hold, palm-down, scale, comfort at the table and frame rate.
- [ ] Fix all blockers and tune gesture thresholds in the config.

**Day 11 (Nov 14): Polish**

- [ ] Audio (ambient, power sounds, murmurs), day-night tint, squash-and-stretch animation, UI motion.
- [ ] Performance pass against the targets in the architecture section.

**Day 12 (Nov 15): Second headset test and feature freeze**

- [ ] Re-test on a headset with a person who has not seen the game. Acceptance: they finish the first five minutes unaided.
- [ ] Fix bugs. **Feature freeze at the end of the day.** After this, only bug fixes.

**Day 13 (Nov 16): Submission assets**

- [ ] Record the demo video (under 3 minutes): hook in the first 10 seconds, then lift, bless, rain, shelter, dusk and the "come back later" moment. Upload to YouTube or Vimeo as public.
- [ ] Write the submission text: inspiration, how it was built, hand interactions, future plans (about 500 words or fewer) and a tagline of 140 characters or fewer.

**Day 14 (Nov 17): Buffer and submit**

- [ ] Final deploy and test of the public link from a clean browser profile and, if possible, a headset.
- [ ] Submit the form and confirm the confirmation email. Do not change the build afterwards.

## Testing and submission

**Automated tests (Node, run on every commit).** Cover `sim/` and `xr/gestures.ts` only.

- Same seed gives the same village after N ticks.
- Needs, drift and power effects match the tuning table within tolerance.
- A villager with initiative below 0.25 idles until blessed or lifted.
- Save then load returns an identical `World`; `fastForward` never produces values outside their ranges.
- Gesture functions classify recorded joint poses correctly (pinch, poke, palm-down, both palms) and respect hysteresis.

**Emulator checklist (desktop, IWER).**

- [ ] Session starts and the village appears using the fallback placement.
- [ ] No console errors for a full 10-minute session.
- [ ] Every power can be triggered with emulated hands.
- [ ] Reloading the page restores the village.

**Headset checklist (real Quest, minimum two sessions).**

- [ ] Cold start to playable in under about 10 seconds on the public link.
- [ ] Plane detection places the village on the table; fallback still works if scene permission is declined.
- [ ] Pinch, poke-hold and palm-down trigger reliably with either hand, without false triggers while resting hands on the table.
- [ ] Villagers are comfortable to pick up at 4 cm; adjust size or pinch radius if not.
- [ ] Panels readable and inside the central field of view; text legible at about 50 cm.
- [ ] Frame rate holds at the headset's native rate for 10 minutes with 12 villagers.
- [ ] Tab switch or taking the headset off pauses; putting it back resumes cleanly.
- [ ] A first-time tester finishes the first five minutes without help.

**Deployment.** WebXR needs HTTPS, and GitHub Pages and Vercel both provide it. Keep the build small (aim under 10 MB total). After deploying, open the public URL on a clean browser profile and on the headset. Judges open the same link, so the Enter XR button must be obvious and the page must explain, in one short line, that hands (not controllers) are used. Do not change the site after the deadline.

**Demo video (under 3 minutes, public on YouTube or Vimeo).**

1. 0:00 to 0:10: a hand lifts a villager on a real table. Show the best moment first; judges are not required to watch past 3 minutes.
2. 0:10 to 1:30: bless, rain and shelter during a drought and a storm, with the Faith and Initiative bubble visible.
3. 1:30 to 2:20: the dusk campfire and chronicle.
4. 2:20 to 2:50: close and reopen the game, and show the village remembering. Name the hand tracking, gaze, passthrough and anchoring features used.

Film on a real headset if possible using the headset's built-in capture; otherwise use emulator footage, which the rules allow.

**Submission form fields.** Name, tagline (140 characters or fewer), track (Gaming), division (New Experience), a description of about 500 words (inspiration, how it was built, future plans), how hand interactions are used (optional but fill it in), target launch date, team details, the playable link and the video link.

## Risks, cut list and agent rules

**Risks and mitigations.**

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| Hand gestures feel wrong on a real headset | High | Two headset tests (Days 10 and 12); thresholds in one config; pinch is the only gesture the tutorial depends on. |
| No headset access | Medium | Arrange a device by Day 9 (friend, lab, tech hub, VR arcade). Without one, the first real run happens when judges play, so treat this as the top risk. |
| Plane detection fails or is declined | Medium | Fallback platform is a first-class path, tested every day. |
| Anchor persistence unsupported | Medium | Re-place at each session; the village data still persists in storage. |
| Simulation feels flat | Medium | Faith and Initiative must be visible on villagers (posture, colour, bubble); playtest the dusk summary. |
| Frame rate drops | Medium | Hold the 12-villager limit, merge meshes, no real-time shadows. |
| Scope creep | High | Use the cut list below; freeze features at the end of Day 12. |

**Cut list (drop in this order if behind schedule).**

1. Stone tablet of past chronicle entries.
2. Random events beyond the two scripted ones.
3. Fast-forward "while you were away" (keep plain saving).
4. Anchor persistence.
5. Shelter two-hand gesture (keep the one-handed version).
6. Gaze bubble (replace with a poke that shows the same bubble).

Never cut: placement fallback, Lift, Bless, Rain, dusk summary, saving, tutorial, pause.

**Stretch goals (only if Days 1 to 11 finish early; never after the Day 12 freeze).** A friend joins as a visiting god through a shared link; an optional LLM voices villager prayers (off by default, never required).

**Working rules for the coding agent.**

- Read the generated IWSDK template and the docs at iwsdk.dev before writing XR code; do not invent API names.
- Keep `sim/` free of Three.js and XR imports. Put every tuning number in `rules.ts`.
- Work task by task in the order of the build plan. Commit after each task with a clear message. Run the Node tests before every commit.
- After each task, run the emulator and confirm the acceptance test; if a check cannot be done in the emulator, add it to the headset checklist instead of marking it done.
- No network calls at runtime, no external services, no analytics. Assets must be generated in code or be CC0 and listed in a `CREDITS.md`.
- Wrap every `localStorage` and optional-feature call (anchors, planes, hand data) in try/catch or feature checks so the game degrades instead of crashing.
- Ask the human before changing scope, the gesture set or any rule listed under Hard constraints.
- Keep a `NOTES.md` with decisions, known issues and the headset-test list.
