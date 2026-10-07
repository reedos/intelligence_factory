# Blender integration review — 9/29/2026

**Outcome:** ready for Opus’s integration review. Required gate runs are complete; two hidden-contact geometry warnings have documented dispositions. Final visual acceptance remains with Reed.

Private review: http://<private-ip>:47411/design-review.html (Tailscale). Tested source/asset content ID: `e85df3bf7009e363`.

## Local integration

Branch: `blender/review-integration-2026-09-29` in the Blender test worktree. The Blender buildout is committed as `206ad6e`; `af97a5b` merges `origin/main` at `9d6ce44`. Main is now an ancestor of this branch. No push, main-checkout change, Pages deployment or public publication has been performed.

This supersedes the detached-HEAD integration status in `version-sync-2026-09-29.md`; that document remains the historical reconciliation record. Opus's untracked handoff in the main checkout remains untouched.

## Conflict decisions

- Retained both independent module paths and MPOs, with both DSPs removed in LPO. The drawing explicitly calls separate internal dies representative: independent transceivers alone do not prove vendor die counts.
- Retained the shared CPO interposer, engine heights, authored geometry and distinct enlarged detail.
- Retained coherent packaging alternatives, using “one packaging example.” A prevalence claim such as “one common design” needs additional evidence; the displayed assembly does not describe every coherent module.
- Retained campus security, operations and border routing; hall storage, control and fire detection; all associated cards and source mappings.
- Retained the 16.75 W allocation per 800G port, 33.5 W twin-port module maximum, 1,460 MW Colossus 2 preset and the 402,264-GPU model expectation.
- Retained the preview's newer cited Rubin layout and module qualifications. Its eight ConnectX-9 interfaces and two physical 800G ports per GPU are not silently replaced by an older single-module assumption.
- Kept all upstream source additions and tour/clock fixes. Removed duplicate `border` and `fire` hotspot keys introduced by automatic merging.

## Gate integrity

The camera gate previously cleared `site` after applying every scenario, so its “Colossus 2” run was generic. It now preserves explicit sites, uses the current 1,460 MW preset, and returns a nonzero exit code for findings. The other five scenario definitions are unchanged. A corrected desktop Colossus sweep is run in addition to the full desktop sweep; the full phone sweep uses the corrected script.

Cycle, UI, tours and coplanar gates retain their software-rendering default, with optional `IFX_GATE_GPU=1` selecting D3D11. Software cycle/UI runs were stopped for speed and replaced with full hardware runs; stopped runs do not count as passes. The UI gate now intersects a phone beat's text bounds with its actual scrolling clip; screenshots confirmed the apparent overlap was offscreen text. The tour gate uses the current tray title, explicitly pauses manual navigation, and invokes the existing control handlers without Playwright auto-scrolling the document to an unrelated beat. Its outage check now freezes the real clock before the key event, requires the tour to hold after its dwell at both 1× and 8×, resumes the clock, and requires release. Both hold and release were observed. Source disclosure and popover checks also pass. These are gate repairs, not changes to tour playback behavior.

## Gate results

- TypeScript: passed.
- Unit/regression suite: 1,282 tests in 29 files passed.
- Strict claims audit: 0 distinct problems in 64,123 claim instances.
- Production build to `dist-gates`: passed.
- Parts: 19 scenarios; 0 listed parts without a pin; no page errors.
- Desktop camera coverage: six scenarios × 91 stops, all clear; no page errors. Corrected Colossus rerun: 91 stops, all clear; no page errors.
- Phone camera coverage: six scenarios × 91 stops, all clear; no page errors; corrected Colossus preset included.
- Cycle: six scenarios, all ten scenes and three layers plus clocks; 0 errors.
- UI: desktop and 390 × 844 phone, exploring/clock/tour/tour-with-clock; no problems.
- Tours: entry context, outward Heat traversal, phone picker, outage hold/release at 1×/8×, popover hold/resume, specification disclosure and all three optical cutaways; no problems.
- Coplanar diagnostic: completed all ten scenes again after correction. Eight scenes have zero candidate groups; hall and rack each retain one verified hidden contact group, documented below. No unresolved exposed-surface finding remains from this scan.
- Performance on the final geometry: 90 scene/layer/scenario cases per form, no page errors. Slowest desktop p95 7.5 ms (GB300 5 GW campus Data); slowest phone-layout p95 7.3 ms (H100 1 GW campus Power). Both use NVIDIA RTX 5090 / ANGLE D3D11 with vsync/frame cap disabled. Phone is 390 × 844 at 3× DPR on this PC, not a physical handset. These timings are not a universal hardware guarantee.
- Post-fix camera recheck: default GB200 and Colossus 2 × desktop and phone × 91 stops = 364 stops, all clear; no page errors.
- Final private production build and artifact packaging: passed; 74 runtime files verified, 37 asset files.

## Surface findings corrected during this merge gate

| Location | Finding and correction | Verification |
| --- | --- | --- |
| Campus authored architecture | Extruded prism faces had inward winding. Reversed winding; maintained the existing silhouette. | Exported office bottom signed Y-area −1659.1844, top +1659.1844. Final camera recheck recorded below. |
| Campus arrival sign | Graphic was within the conservative near-surface threshold of its backing. Increased physical clearance. | Campus final coplanar scan: zero groups. |
| Campus cooler | Solid capped throat overlapped the intended fan aperture. Replaced it with a hollow shroud. | Campus final coplanar scan: zero groups; no fictitious solid lid across the fan opening. |
| Hall | Crown top shared the wall plane; cabinet graphics nearly coincided with raised stiles. Raised the crown and inset graphics. | Exposed candidates removed; remaining buried pier contact explained below. |
| GB200/GB300 compute trays | Underlying wall and rolled upper return had the same top plane. Shortened the underlying wall while retaining the return and outer presentation. | Default tray final scan: zero groups; both assets regenerated, hardware tests passed. |
| Coherent | ITLA identification plate coincided with its lid; ceramic package seals coincided with carriers. Cut an actual recessed identification pocket and placed seals above carriers. | Final coherent scan: zero groups. Nano-ITLA full envelope remains 25 × 15.6 × 6.5 mm; actual-asset tests pass. |
| Pluggable | Representative passive termination tops sat only 5 µm below an overlapping ceramic top. Recessed the upper termination skin, preserving electrical layout and enclosure dimensions. | Final module scan: zero groups; twin-port/LPO hardware tests pass. |

Two conservative diagnostic warnings are accepted with specific geometry evidence, not suppressed in the tool:

- **Hall:** wall/pier contact at Y=7.50. The opaque crown top is Y=7.53; the entire overlap sits within its flat roof footprint even after its bevel. These faces are buried inside the assembly. Source: `tools/blender/build-hall-finish.py`, service-wall and crown construction.
- **Rack:** handle/insert rear faces share Z=.467. The opaque tray blocks rear viewing; front viewing culls these backward-facing surfaces. Source: `src/scenes/rack.js`, handle collar and black insert geometry. No visible face is being displaced merely to silence a warning.

The Blender source files, generators and runtime GLBs were rebuilt together. Coplanar diagnostics now include object names and optional scene targeting; no tolerance was loosened. The test is a conservative default-layer geometric detector, not a proof that arbitrary transparent inspection views can never show coincident internal interfaces.

## Scope of approval

The automated gates support integration correctness; they do not certify undisclosed vendor internals, civil engineering, every possible rendering artifact or physical-phone frame rates. Representative geometry and qualitative flow-speed disclosures remain intentional. Reed's final visual acceptance and deployment approval are separate.
