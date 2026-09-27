# The Intelligence Factory

An interactive, sourced explainer of an AI campus: follow **power** from a 345 kV line to a GPU die at
0.8 V, **data** from HBM out across NVLink, optics and long-haul fiber, and **heat** from the die to the
air above the roof. Six scales, from a 2,000 km grid to a 10 cm package.

Every figure carries a basis label: **Spec** (a vendor or standards body states it), **Typical** (trade
press or reference designs agree) or **Est.** (derived here, or sources conflict). The research notes
behind them are in [`research/`](research/).

## Run

```sh
npm install
npm run dev        # http://127.0.0.1:47400
npm test           # model engine tests
npm run build      # static site in dist/, relative paths, ready for GitHub Pages
```

## Layout

- `src/main.js` — renderer, camera, panels, charts
- `src/data.js` — content: parts, specs, ledger, counts
- `src/scenes/` — one procedural Three.js scene per scale
- `src/kit.js` — shared materials, geometry merger, animated flows
- `tools/` — checks: `shot.mjs` (screenshots), `coplanar.mjs` (flush-surface detector), `flicker.mjs`
