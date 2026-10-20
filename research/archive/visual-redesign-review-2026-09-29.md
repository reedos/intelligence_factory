# Visual redesign review — 9/29/2026

This supersedes the visual acceptance in `final-visual-review-2026-09-29.md`. The user rejected that milestone. The new revision is available for visual review; it is not a claim of vendor CAD fidelity or final user approval. No main commit, push or public deployment was made.

## Implemented

- All ten scenes now use depth-tested continuous route cores and moving luminous dashes driven by the existing route clocks. The shared renderer adds two draw calls per active layer, preserves source opacity and visibility, and follows transformed/exploded parents. It does not invent electrical or optical connections or encode lane counts, watts or speed in particle counts.
- All 27 halls in the expanded campus receive conceptual power/fiber branches. Central-plant cooling scenarios receive paired, directionally correct facility supply/return routes. Rooftop warm-water scenarios retain their separate cooling arrangement. The opening camera now fits occupied geometry rather than a large mostly empty bounding rectangle.
- The hall retains its luminous overhead rails, physical supports and reflective floor. Additional rack power and fiber motion follows existing drops and runways.
- Rack, tray and GPU package have stronger active-layer motion. Rendered review rejected oversized rack exhaust blobs; they were reduced to narrow streaks without reducing route coverage. GPU Heat emission was trimmed 18% to preserve package readability.
- Module cover displacement is now vertical only. Its board-relative paths remain registered through DSP/LPO and partial assembly changes.
- All 18 CPO engines now receive visible transmit, receive and CW motion. Power-only inspection transparency exposes buried board/package/ASIC supply paths and restores opaque state in other modes; PIC geometry remains opaque. The enlarged detail remains a separate callout.
- Coherent and copper assets were rebuilt/exported in Blender. Copper has a flat stepped clamshell, shallow shoulder, side latches, low black release loop and sectioned molded cable boot. Coherent has a broad flat lid crown with a short optical-end fin bank. Covers remain directly aligned over their bodies and use a qualified x-ray inspection treatment. Copper animates all 24 drawn directional routes; ACC receive-only and AEC bidirectional processing are preserved.

## Review and evidence

Three parallel designers performed reciprocal skeptical reviews. Detailed findings, references and acceptance checks:

- `site-redesign-2026-09-29.md`
- `compute-redesign-2026-09-29.md`
- `interconnect-redesign-2026-09-29.md`

The optical/copper reviewer and an independent peer actually viewed the [QSFPTEK DAC photograph](https://datasave.qsfptek.com/upload/2025-10-22/1761125656931.jpg) and [Coherent OSFP photograph](https://www.coherent.com/content/dam/coherent/site/en/products/networking/optical-transceivers/osfp/ftce3327r1pcl.jpg). The root reviewer inspected `copper-redesign-review.png`, an actual Blender geometry render, and the live application. Photographs support exterior cues; hidden electronics remain explicitly representative.

Independent feedback closed two shared-effect defects: transformed parents initially misregistered some paths, and standby feeds initially lost their faint opacity. Actual-asset integration regressions cover both. Root rendered review also caught and corrected a GLTF node-name mismatch in the new CPO power inspection layers before final acceptance.

## Rendered checks and limits

Root inspected desktop renders of regional Data/Power, expanded campus Data/Heat, hall Data/Heat, rack Power/Heat, tray Data/Power/Heat, GPU Data/Heat, module Data, CPO Data/Power/Heat, coherent Data/Heat and copper Data/Heat. Final rack exhaust and campus framing were inspected again after revision. At 390×844, module and copper views fit; copper page and inspector had zero horizontal overflow. This is sampled rendered verification, not a claim that every arbitrary orbit and device has been inspected.

Hall Data performance at 1440×1000 on the host RTX 5090: 360 sampled frames, 170.12 FPS, p95 frame time 6.3 ms, median CPU 5.1 ms. No physical-phone performance claim is made. The final stable-build console review contained only the earlier corrected CPO errors; no new errors appeared during the inspected scenes.

The physical assets are authored in Blender and exported as GLBs. The interactive scenes, lighting and motion graphics render in Three.js/WebGL. Inspection lids are not transparent-metal product claims. Mechanical layouts remain educational illustrations, not recovered proprietary product designs.

## Validation

1,282 tests across 29 files and TypeScript pass after the final source revisions. Production build and artifact packaging are verified separately in the handoff inventory. Technical checks support route and component correctness; visual polish remains available for the user's judgment in the private dashboard.

Review dashboard: http://<private-ip>:47411/design-review.html (Tailscale).

Final build: aff52411e0f71e46. Artifact export verified all 74 runtime files; packaging regression passes. Refreshed SHA-256 handoff inventory contains 246 source/asset/tool files. Copper Data desktop sample: 172.31 FPS, p95 6.3 ms, median CPU 0.9 ms at 1440×1000 on RTX 5090. No new console errors during the final checks.

## Brighter motion revision — 9/29/2026
Following the user's request for a stronger sense of extraordinary activity, all shared route overlays now use roughly 1.5× pulse density (bounded at 20 repeats per route), 1.6× explanatory travel speed, 25% brighter cores and a concentrated traveling highlight. Local heads peak above their surrounding streak without flashing the whole scene. Original physical paths, layer colors, opacity, depth, visibility and clock pause/slowdown remain intact. The overlay speed is illustrative, not propagation speed; individual source particles and ribbon heads no longer have identical travel rates. This supersedes earlier same-rate wording. The renderer still uses two draws per active layer. Full 1,282-test suite, type checking and production build pass.

Brighter-motion build: 46d3a07c124b429f. Rendered tray Data, Power and Heat checked after shader compilation; no new console errors. All 74 artifact runtime files verified. The previous performance figures describe the preceding revision, not a new timing measurement of this shader.

## Small halo reduction — 9/29/2026
User requested a slight reduction of glow surrounding the flows. Shared halo width reduced 10%, halo opacity 0.46 to 0.40; compute-scene bloom reduced about 8%. Bright moving cores, travel speed, density and route geometry unchanged. 41 focused tests and production build pass; artifact verification retains 74 runtime files. Build: 266107c9056d6d55.

## Targeted layer balance — 9/29/2026
GPU Heat and tray Data/Power now have narrower, lower-opacity ribbon halos and reduced emitter intensity. Added layer-specific postprocess bloom: desktop GPU Heat0.26, tray Data/Power0.34, preserving their other layers. Mode changes and cached-scene returns reapply the layer setting. Hall gains1.5× requested pulse density (subject to spacing limits), 25% emitter brightness, longer streaks, stronger route cores and three instead of two desktop rack indicators. No routes changed, and fixture bloom stays unchanged. Full1,282tests passed before the final mode-bloom wiring; final TypeScript/build pass. Build: 6b093e77bb2246cb.

## Cleaner glow throughout — 9/29/2026
Global bloom strength reduced30%, radius0.42→0.28. Shared route halos narrowed another22% and opacity reduced20%, including layer overrides. Pulse cores, route density/speed, layer-specific balance and hall activity remain unchanged.41focusedtests, TypeScript, production build and74runtime artifact-file checks pass. Build: 9d0f3b37b665045c.
