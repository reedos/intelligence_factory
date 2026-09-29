# Compute motion redesign — 9/29/26

Goal: unmistakable, structured power/data/heat activity while retaining the corrected generation hardware and polished studio materials. This pass changes explanatory graphics and lighting response, not mechanical topology, counts or sourced hardware claims. No build, commit or deployment performed here.

## Diagnosis and implemented changes

**P1 — many correct paths had no continuous visible route.** Numerous original Flow definitions used `trail:false`; others used narrow dim tubes. Raising particle counts alone could not fix the disconnected-dot appearance or subpixel routes. New reusable `src/flow-ribbons.js` draws a continuous soft-edged colored route plus brighter moving dashes on the exact existing piecewise path. All classes are batched with vertex colors: only two additional draws per active layer, independent of route count. Separate segments are never joined between unrelated paths.

**P1 — bright motion was suppressed by the studio treatment.** `compute-art-direction.js` retains the existing studio lighting/reflections but lowers bloom threshold from1.85 to1.25, uses modest0.48 bloom and increases moving-core brightness/stretch. The new route core is2.5px for tray/package and2.8px for rack, with a restrained5.5/6.5px continuous halo. These are explanatory screen-width graphics, not a claim that electrical traces or coolant channels are that wide. Depth testing remains enabled: no blanket x-ray through opaque hardware.

**P1, independently caught and fixed — transformed Flow parents initially misregistered batched routes.** Flow paths are local to their groups, including exploded module boards. The helper now converts each group's matrixWorld into the scene-root frame, caching the matrix and rewriting position buffers only when it changes. Local arc normalization keeps moving dashes synchronized under uniform scale. Source count, direction, endpoints, speed and simulation gain are unchanged.

The helper's phase is driven directly by each existing Flow's accumulated distance, so stopping the clock stops it. Per-segment visibility respects gain, mesh visibility and every parent group's visibility. No separate autonomous animation clock was introduced. Existing scene update/disposal behavior is preserved. It is suitable for shared use in the other hardware scenes; cartographic annotations remain a separate concern.

## Acceptance and validation

- Thirty-nine helper/actual-compute-GLB tests pass, plus TypeScript. New contracts cover exact segment endpoints/directions, two draws per layer, clock stop/advance, per-route gain and group visibility, shader phase/alpha injection, transformed/animated parents and unchanged-buffer caching.
- Integration test applies the studio effect to rack, tray and GPU actual Rubin assets, verifies three batches, unchanged physical routes and correct layer isolation.
- All previously corrected generation counts, package textures, H100 inspection access, fan/manifold clearance, optical apertures, camera contracts and token readability remain covered by the thirty-five compute tests included in that total.
- Parent live GB300 tray Data review reported visibly stronger structured flow and no GPU shader errors. This is an initial rendered milestone, not a blanket visual sign-off for every mode/view/device. Parent owns complete rendered acceptance and performance measurements.
- No new mechanical geometry was needed; no new product-photo claim is introduced. Existing public hardware references and qualifications remain in `compute-final-review-2026-09-29.md`.

## Reciprocal site review

Independently ran twenty-five updated campus/hall/across tests: pass. Expanded campus power joins the existing power trunk, and fiber joins the existing campus optical route; branches follow exterior service corridors and terminate at each representative hall envelope. Hall additional sampled power/fiber motion follows existing physical drop/runway coordinates. Routes are conceptual distributions, not surveyed site topology or asserted conduit capacity. Final paired central-plant heat extension also accepted after rerunning the twenty-five tests and TypeScript: cold flows outward from the existing cold port, warm flows reverse toward the existing warm port; separate heights preserve circuit separation. No central-water extension appears for rooftop warm-water scenarios. User-visible conceptual/not-surveyed qualification is present in all three campus introductions. Parent owns site rendered acceptance.

Final peer review: presentation_controls found no helper blocker in source phase direction, gain/clock behavior, recursive visibility, transforms or depth testing. Self-audit additionally corrected source-opacity preservation so an intentionally dim standby flow remains dim until its source brightness rises; the regression covers0.45 idle opacity and active brightness.39tests and TypeScript pass after that fix. Ribbon dashes and individual particle orbs share direction and accumulated-distance clock but need not coincide phase-for-phase. Brightness above1 clamps ribbon alpha; emission remains controlled by the configured semantic color brightness.

Rendered refinement requested by parent: rack exhaust alone now uses0.55radius/0.85brightness/3.2stretch versus1.15/1.9/2.6, with0.75pixel floor. This roughly halves transverse core size while preserving route coverage, pulse counts and clock speed; coolant and tray effects are unchanged. GPU Heat brightness multiplier reduced1.9→1.55 (18.4%) without touching Data/Power.37compute tests plus the4helper tests and TypeScript pass; selective-scope regressions prevent these trims leaking into other layers. Final perceived pixel size/halo remains parent-rendered acceptance.
