# The Intelligence Factory

An interactive, sourced explainer of an AI campus: follow **power** from a 345 kV line to a GPU die at
0.8 V, **data** from HBM out across NVLink, optics and long-haul fiber, and **heat** from the die to the
air above the roof. Six scales, from the US grid to a 10 cm package.

It is also a small model. Pick a campus size (10 MW to 5 GW), an accelerator (H100, GB200, GB300, Rubin),
a power path (415 V AC or 800 V DC) and cooling (air, chilled liquid, warm water), or start from a real
campus, and every scene, chart, count and sentence recomputes. Pin a scenario to compare against it.

Every figure carries a basis label: **Spec** (a vendor or standards body states it), **Typical** (trade
press or reference designs agree) or **Est.** (derived here, or sources conflict). Click a label for its
sources. The research notes behind them are in [`research/`](research/).

## Run

```sh
npm install
npm run dev        # http://127.0.0.1:47400
npm test           # engine, clock, content, links and journeys
npm run typecheck
npm run build      # static site in dist/, relative paths, ready for GitHub Pages
npm run artifact   # dist-artifact/: the same page shaped for a claude.ai artifact
```

Live at https://reedos.github.io/intelligence_factory/ (noindex for now). Deploy by hand:
`gh workflow run pages.yml` (typechecks, tests and builds first). MIT license.

Links: `?mw=&accel=&power=&cooling=&site=` sets the scenario and `?view=scene.layer.part` opens a view;
`#story`, `#watt`, `#request` and `#heat` start a tour. The page keeps its address bar current, and
Share copies it.

## Layout

- `src/model/engine.ts` — the scenario engine: rack power bottom-up, PUE, fabric, ledger, counts
- `src/model/clock.ts` — four simulations: training swings, grid outage, hot day, inference day
- `src/model/sites.ts` — real campuses, state grid carbon, the map projection
- `src/model/tokens.js` — token and energy-per-token arithmetic
- `src/data.js` — every card, count and sentence, built from the model; `src/sources.js` — citations
- `src/app/` — `stage` (3D and panels), `sections` (charts), `scenario` (the settings bar), `links`
  (chart ↔ 3D), `story` and `journeys` (tours), `clock-ui`, `sources-ui` (popovers), `share`
- `src/scenes/` — one procedural Three.js scene per scale, with variants per scenario
- `tools/` — browser checks: `cycle.mjs` (every scenario, scene, layer and clock), `links.mjs` (every
  chart link lands), `coplanar.mjs` (flush surfaces that flicker), `shot.mjs` and `look.mjs` (screenshots)
