# Preview reconciliation — 9/29/2026

## Scope and authority

The active Blender preview is the working integration copy. Main, optics/dive and remote main were checked at `9d6ce44867112d1ebc4de631f57a1a878d10995d`. The Blender worktree's Git HEAD remains `e5301e108c56016fa8a7e863a50f5a0ed3a98653`; its uncommitted source and assets contain the buildout. No commit, push or public deployment is part of this reconciliation.

- Current private review: http://<private-ip>:47411/design-review.html (Tailscale).
- Development preview: http://127.0.0.1:47410/design-review.html.
- The production preview emits `build-info.json`: build time, actual content fingerprint, Git HEAD, and the main revision whose changes were reviewed. It does not pretend the detached HEAD contains those commits.
- The 47407 and 47408 servers serve older generated output; they are not aliases of this review build. Historical worktrees and generated previews have not been overwritten.

The independent inventory in `version-inventory-2026-09-29.md` found all 28 local branch tips merged into main and no dirty source changes in the other 15 registered worktrees. This does not cover remote-only branches, stashes or unregistered copies.

## Changes reconciled from main

The complete `e5301e1..main` difference contains 14 paths. Reconciliation preserves the Blender conversion, existing visual polish, flow corrections, copper Heat tour and stronger public-source qualifications.

| Files | Change to preserve in this preview |
| --- | --- |
| `src/data.js`, `src/sources.js`, `src/evidence.js` | Updated optic generations and cited power allocations; campus/hall support parts; twin-port independence; coherent packaging alternatives and evidence. Separate module DSP/PIC dies remain representative. |
| `src/model/engine.ts`, `src/model/fleet.test.ts`, `src/model/sites.ts` | 800G allocation of 16.75 W per switch port from a 33.5 W twin-port module; resulting scenario counts and 1,460 MW Colossus 2 preset. |
| `src/app/journeys.js`, `tools/cycle.mjs`, `tools/tours.mjs` | Expanded campus/hall coverage and updated tour checks, retaining the preview's copper Heat comparison. |
| `src/scenes/campus.js` | Operations, security and border-router components/hotspots, adapted to authored architecture and connected circulation. |
| `src/scenes/hall.js` | Storage/control rack and fire-detection components/hotspots, preserving the cleared cutaway and real area lighting. |
| `src/scenes/side-coherent.js` | CDM/ICR labels describe one common design. TX/RX/laser/LO flow construction is unchanged. |
| `src/scenes/side-cpo.js` | Shared interposer spanning switch and engines; authored geometry and engine heights must agree. |
| `src/scenes/side-module.js` | Two independent four-lane transceivers, one per MPO; authored internals, DSP/LPO routes and metadata must agree. |

## Coherent packaging decision

Keep the physical CDM and ICR example; do not imply every coherent module has these package boundaries. The introduction, in-scene labels, inspection note, cards and assumption must agree. An alternate shared TX/RX PIC is described without inventing its driver/TIA die count or exact placement.

Public support: [OIF CDM definition](https://www.oiforum.com/wp-content/uploads/2019/01/OIF-HB-CDM-01.0.pdf), [OIF receiver definition](https://www.oiforum.com/wp-content/uploads/2019/01/OIF-DPC-MRX-02.0.pdf), and [Nokia CSTAR](https://www.nokia.com/optical-networks/cstar-silicon-photonics/). These support packaging possibilities; they do not identify a recovered 800ZR teardown.

## Campus circulation decision

One representative road plan drives pavement, markings, open curbs and traffic. Overlapping segments are combined into disjoint pavement tiles. Internal road ends must connect to another road or an explicit destination; the offsite road continues beyond the illustrated campus. Expanded halls receive connected streets. This is illustrative circulation, not a surveyed site or certified civil design.

## Acceptance record

All 14 upstream paths have been reconciled. The twin-port Blender export and shared CPO interposer were rebuilt; the independent integration review found no omitted upstream correction. The final suite passed **1,224 tests in 24 files**, and TypeScript passed on 9/29/2026.

Live browser review covered default and 27-hall Colossus 2 circulation, coherent overview/cards on desktop and a 390 px expanded phone panel (no horizontal overflow), the CPO shared substrate/detail callout, and both DSP and LPO module views. Both module DSPs and thermal pads disappear in LPO; its paired optical paths and exterior finish remain visible. Road regressions additionally cover full vehicle bodies through flared junctions and streetlight clearance from the widened pavement. These checks do not certify civil engineering, a vendor-specific internal layout or device frame rates.

Companion details: `compute-main-sync-2026-09-29.md`, `campus-road-review-2026-09-29.md`, and `version-inventory-2026-09-29.md`. `version-sync.json` records the integrated main revision for the production build identity. Main/public and historical generated previews remain distinct from this working Blender review build.

Production build passed and was verified on the existing private server: content ID `231911a8b69b8e2d`, built **9/29/2026 12:41 AM Pacific**, integrated main `9d6ce44`, no outstanding main-revision mismatch. The dashboard displays that identity and the final module status. Final production campus screenshot confirms the flared junctions and cleared poles. Independent road acceptance passed after the final fixes (20 focused tests).
