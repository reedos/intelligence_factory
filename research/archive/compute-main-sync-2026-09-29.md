# Module, CPO, and hall synchronization — 9/29/26

Compared the preview base `e5301e1` with main `9d6ce44`. This integration preserves the Blender hardware, studio finish, interactive overlays, inspection controls, and prior technical corrections. Main was read only; no commit, build, push, or deployment was performed by this agent.

## Changes incorporated

### Twin-port module

- Replaced the native side-module implementation with main's two-engine arrangement; the preview had no independent changes in that native file. Restored the common host-supply and air-removal flows that the upstream refactor had dropped.
- Re-authored the Blender internals as two independent four-lane optical engines: two DSP packages, two PICs, two drivers, two TIAs, four transmit-only lasers, and two thermal pads. `tools/blender/convert-module-twin.py` preserves the original exterior, PCB, power conversion, optical connectors, and electrical contact geometry, while replacing the former shared engine and its routes.
- The original single-engine GLB is retained as a reproducible authoring input at `tools/blender/osfp-module-single-engine-reference.glb`; the new editable source is `tools/blender/osfp-module-twin.blend`. Runtime GLB is 6,659,508 bytes. The loader query is `twin4`.
- Both MPO-12 connectors retain positions 1–4 transmit and 9–12 receive. Each new engine reaches its own connector, with eight distinct fibers. An intermediate mirrored layout would have crossed the second port's bundles; its transmit/receive placement was corrected before acceptance. The authored fibers now preserve transverse ordering with surface clearance.
- Separate DSP/PIC dies are a representative implementation of documented independent transceivers, not a claim about a vendor teardown. The runtime caption and metadata make that distinction. Contact fan-out remains omitted; visible sampled host traces begin beyond that omitted region rather than inventing intersecting exposed routes.
- Power and heat now cover both engines. LPO removes both DSP packages, their power branches, and their thermal pads, and exposes 32 authored differential-pair conductors directly between sampled host traces and the drivers/TIAs. Runtime LPO motion follows exported alternate routes rather than reconstructing a separate path.
- Preserved assembled OSFP dimensions, contact/pin map, studio/matched finish behavior, layer switching, exploded animation, interaction anchors, and resource ownership.

Acceptance: actual-GLB tests verify two separated DSP/PIC/pad groups inside the module width, both engines' power branches, both LPO footprints, four TX/four RX positions per connector, noncrossing fiber ordering, all signal motion on authored paths, and the original exact enclosure/contact/assembly contracts. Live visual acceptance remains the parent agent's responsibility.

### Shared CPO interposer

- Incorporated main's shared 9 × 9 cm representative interposer beneath the ASIC and all 18 engines. Retained the preview's 24 mm representative ASIC rather than regressing to the older oversized die.
- Raised engine centers to 1.65 cm and raised their mechanical carriers, interface supports, and associated fiber endpoints consistently. Carriers clear the shared interposer's 1.5 cm top surface.
- Regenerated `cpo-hardware.blend` and `cpo-hardware.glb`; loader query is `v4`. Metadata records interposer dimensions and revised engine locations; wrapper validation rejects mismatched engine heights.
- Preserved the separate 2.5× engine callout, dotted leader, engine-owned laser connectors, cold-plate controls, and all preview lighting.

Acceptance: actual GLB interposer measures 9 × 9 cm, top at 1.5 cm; all 18 engines have 1.65 cm center height and lie over it. Native and authored wrapper route/hotspot contracts agree. Parent's live CPO review accepted the shared substrate and separate callout.

### Hall support equipment

- Added four storage racks, two control racks, dedicated non-GPU equipment face textures, associated optical access details, and storage/control data hotspots from main.
- Added the smoke-detection sampling system and fire inspection hotspot from main.
- Preserved authored Blender construction and the preview's rear-only cutaway lighting. Did not reintroduce main's two additional overhead fixtures above the support racks because they conflict with the corrected cutaway presentation.

Acceptance: actual builder exposes the new data/heat hotspots, reports four storage and two control racks, leaves no physical meshes without Blender provenance, and retains the two real cutaway area lights.

## Validation

- 23 module actual-GLB tests passed.
- CPO/coherent/copper and campus actual-asset suites passed, including added interposer and hall support regressions. Combined owned suites: 49 passing tests.
- `npm run typecheck` passed.
- Independent road review identified an oncoming-lane error and later a swept-truck-body corner failure. The site author corrected both; final road validation is assigned to the presentation agent. No road files were edited here.

## Checked and retained

Transmit-only laser feeds; two-arm Mach–Zehnder waveguides; separate electrical bond/RF conductors and optical fibers/waveguides; receive direction toward the host; exact MPO endpoints; unchanged OSFP envelope and contact pad map; DSP/LPO visibility and power/thermal distinctions; exploded/assembled interaction; runtime-owned cloned resources; CPO EIC/PIC detail and callout separation; hall GPU rack count and existing utility topology. These tests establish geometry and runtime contracts, not vendor-specific internal packaging or browser visual quality.
