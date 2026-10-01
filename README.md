# The Intelligence Factory

An interactive explainer of an AI campus, built from cited public sources: follow **power** from a 345 kV line to
a GPU die at 0.8 V, **data** from HBM out across NVLink, optics and long-haul fiber, and **heat** from the die to the
air above the roof. Six scales, from the US grid to a 10 cm package.

This is a personal educational project based on cited public sources. It is not an official publication of my
employer or of the companies it discusses. The 3D models are schematic, not vendor CAD; routes and layouts are
illustrative; the scenario outputs are estimates from a simple model, not an engineering design or a procurement
specification. Product and performance claims are attributed to the companies that make them.

It is also a small model. Pick a campus size (10 MW to 5 GW), an accelerator (H100, GB200, GB300, Rubin),
a power path (415 V AC or 800 V DC) and cooling (air, chilled liquid, warm water), or start from a real
campus, and every scene, chart, count and sentence recomputes. Pin a scenario to compare against it.

Figures shown with a label say what kind of statement they are: **Spec** (the maker or a standards body publishes
it), **Vendor** (a vendor's own comparison, attributed, with its baseline), **Reported** (a named third party states
it), **Calc.** (this model calculates it) or **Assumed** (the model picks a value where no single published figure
applies). Click a label to see what backs that figure: its sources and where in each, the calculation, or the
assumption. The Evidence page lists them all, the Method page lists every calculation and assumption, and the research
notes behind them are in [`research/`](research/). Sources were checked on the dates the Evidence page shows; the
web moves, so a figure is only as current as its check.

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
`gh workflow run pages.yml` (typechecks, tests and builds first).

The project's own code and text are under the MIT license ([`LICENSE`](LICENSE)). Third-party code, fonts and data
keep their own terms, and the hero images' rights status is unresolved: see
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

Links: `?mw=&accel=&power=&cooling=&site=` sets the scenario and `?view=scene.layer.part` opens a view. The
visualizer's guided tours and clock strip are built but not wired into the live page (`src/visualizer.js` loads
the exploration UI only); old tour links such as `#story`, `#watt`, `#request` and `#heat` still work, but
`index.html` now forwards them, along with any `?view=` or `?clock=` link, straight into the visualizer at the
right part instead of starting a tour. The page keeps its address bar current, and Share copies it.

## Layout

- `src/model/engine.ts` — the scenario engine: rack power bottom-up, PUE, fabric, ledger, counts
- `src/model/clock.ts` — four simulations: training swings, grid outage, hot day, inference day
- `src/model/sites.ts` — real campuses, state grid carbon, the map projection
- `src/model/tokens.js` — token and energy-per-token arithmetic
- `src/data.js` — every card, count and sentence, built from the model; `src/sources.js` — citations, with when
  each was published and checked
- `src/evidence.js` — the five labels, what each figure's evidence looks like, and the registers of calculations and
  assumptions; `src/claims.js` — every labeled figure, with the key its chip carries
- `src/app/` — `stage` (3D and panels), `sections` (charts), `scenario` (the settings bar), `links`
  (chart ↔ 3D), `story` and `journeys` (tours), `clock-ui`, `sources-ui` (popovers), `share`
- `src/scenes/` — one procedural Three.js scene per scale, with variants per scenario
- `tools/claims.mjs` — every labeled figure across all scenarios that is not backed the way its label says
- `tools/` — browser checks: `cycle.mjs` (every scenario, scene, layer and clock), `views.mjs` (every tour stop
  and part is framed clear of overlays with nothing solid in front), `perf.mjs` (real-GPU cost), `links.mjs` (every
  chart link lands), `coplanar.mjs` (flush surfaces that flicker), `shot.mjs` and `look.mjs` (screenshots)
