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

## Known issues / todo

- Day 1 deploy to GitHub Pages or Vercel not done yet: it needs the owner's
  hosting account. `vite.config.ts` already uses `base: './'`, so a static
  host at a sub-path works. Use the `iwsdk-hosting` skill when ready.

## Headset test list

(to fill in on Day 10)
