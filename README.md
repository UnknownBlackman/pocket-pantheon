# Tabletop Gods

A seated, hands-only mixed-reality god game on a real table, built with Meta's
Immersive Web SDK (IWSDK). See [DESIGN.md](DESIGN.md) for the full design and
build plan, and [NOTES.md](NOTES.md) for decisions and known issues.

```sh
npm install
npm run dev        # CLI-managed dev server + emulator browser
npm test           # Node unit tests for src/sim (no headset needed)
npm run typecheck
npm run build
```

## Layout

```text
src/
  index.ts      world creation and system registration (IWSDK entry point)
  core/         constants, event bus, save/load
  sim/          pure simulation, no Three.js or XR imports
  ecs/          IWSDK components and systems
  xr/           gestures, placement, anchors, gaze
  ui/           spatial panels
  art/          procedural low-poly meshes and materials
  audio/        procedural sounds
tests/          Node tests for sim/
```
