# Interconnect visual redesign — 9/29/26

This revision responds to the rejected visual milestone. It is a real Blender geometry revision plus an interactive motion revision; passing tests alone does not establish that it meets the requested visual bar.

## References actually viewed

- QSFPTEK's [400G QSFP112 DAC product](https://www.qsfptek.com/product/103693.html), specifically this [manufacturer product photograph](https://datasave.qsfptek.com/upload/2025-10-22/1761125656931.jpg). Saved and viewed at `research/reference-images/qsfptek-qsfp112-flat-dac.jpg`. Visible cues: flat metal clamshell, shallow rear shoulder, side release latch, molded black boot, low black pull loop and exposed edge contacts. The photograph establishes external appearance, not hidden electronics.
- NVIDIA's [MCP7Y10 product specification](https://docs.nvidia.com/mcp7y10-nxxx-800gbs-twin-port-osfp-to-2x400g-qsfp112-dac-splitter-1-3m-product-specifications.pdf) establishes the four-channel QSFP112 end. That is a better comparison for this four-TX/four-RX teaching circuit than an eight-lane OSFP end.
- NVIDIA's [MCP4Y10 overview](https://networking-docs.nvidia.com/mcp4y10nxxx2x400pub/overview), including the exterior illustration saved and viewed at `research/reference-images/nvidia-copper-flat-top.png`, distinguishes flat-top and finned-top products. Cooling ribs are not a universal property of copper plugs.
- Coherent's [public OSFP exterior photograph](https://www.coherent.com/content/dam/coherent/site/en/products/networking/optical-transceivers/osfp/ftce3327r1pcl.jpg), saved and viewed at `research/reference-images/coherent-osfp-public.jpg`, supports the elongated metal enclosure, fins and release-loop appearance. It does not validate the depicted internal package arrangement.
- Amphenol's [OSFP cable datasheet](https://cdn.amphenol-cs.com/media/wysiwyg/files/documentation/datasheet/cableassemblies/hsio_ca_osfp.pdf), read for material and product-family context: nickel-plated die-cast shells, thermoplastic pull tabs, active/passive variants. Its photograph was not successfully retrieved locally and is not claimed as a visually inspected reference.

## Findings and repairs, by priority

### P1 — Copper exterior lacked a credible manufactured silhouette

`tools/blender/build-links.py`, copper builder and new `cable_cutaway`/`copper_pull` helpers.

The previous free-standing circular clamp and decorative raised lid ribs did not resemble the selected real four-lane plug reference. Rebuilt the exterior as a flat-top clamshell with a shallow rear shoulder, side latches, low black release arms and grip, and a thick molded cable boot. Removed the circular clamp and all five decorative lid ribs. The eight exposed conductor pairs remain in their existing audited positions; no mechanical part adds a signal connection. A second direct photo comparison also corrected the coherent lid: it now has a broad flat crown and a short fin bank near the LC end, replacing unsupported full-length fins.

Acceptance: actual GLB contains the new geometry, the manufacturer photograph and Blender geometry render show the same broad construction cues, and the runtime view must still make DAC/ACC/AEC differences easy to read. Confidence: high for removing unsupported mechanics; moderate for exact resemblance because this remains an enlarged representative teaching layout, not a dimensioned replica.

### P1 — Offset lids weakened assembly comprehension

`src/scenes/side-links-blender.js`, cover update and scope.

Removed all lateral cover translation. Coherent and copper covers remain directly aligned in x/z in every mode, lifted only along the assembly normal. Qualified x-ray inspection surfaces keep the aligned cover from hiding the internal circuit. Heat retains its explicitly labeled x-ray thermal target. Internal detail selection can still hide the cover; returning to the complete view restores it.

Acceptance: exact cover transforms do not change when switching Data/Power/Heat; the base stays opaque; the complete overview contains the lid and release hardware. Automated tests verify this and the existing desktop, compact and usable phone-canvas fits. Confidence: high for alignment and truthful qualification; visual strength of the ghosted surfaces remains a runtime review judgment.

### P1 — Too many actual signal lanes had no visible motion

`src/scenes/side-copper.js:70`, `src/scenes/side-coherent.js:152`, wrapper motion integration.

Copper previously animated only two sample lanes per head despite drawing eight pairs. It now animates all four transmit and four receive pairs in each of the three heads: 24 paths total. ACC still processes receive only; AEC still processes both directions. Coherent now animates all four drawn electrical paths each way, retaining the same DSP/CDM/ICR endpoints and same-laser TX/LO split.

Integrated the shared depth-tested exact-route ribbons in both scenes. Copper uses a narrower 1.6-pixel core and 3.5-pixel halo to preserve separation between adjacent pairs; coherent uses 2.2/5.0. These are explanatory overlays on the actual routes. Moving dashes use each flow's existing clock, direction and visibility. No global depth override or invented connections.

Acceptance: 24 copper routes, exactly four directions each way per head, plus visible motion in the browser in Data/Power/Heat. Source, direction and shader-contract tests pass; root owns final browser inspection. Confidence: high for topology and motion coverage; brightness and apparent speed need live review.

### P1 — Opaque cable jacket concealed the final electrical path

The cable jacket is now authored as a thick lower half-shell with its upper half removed, explicitly stated in the inspection scope. This preserves a plausible black boot/jacket silhouette while revealing the conductor continuation. This is a geometric section, not transparent polymer or a signal drawn over solid hardware.

Acceptance: downward rays at three positions on every tail reach jacket below the conductor centerline; all data routes continue without a fabricated optical segment. Confidence: high.

## Independent checks of the shared CPO/motion work

- Added a regression that finds one distinct package CW route ending at each of the 18 engines; no alternate-engine sampling remains.
- Added Data → Power → Data → Power → Heat material checks: only the selected board/package/ASIC layers receive the power inspection treatment; depth testing remains enabled, opaque state returns outside Power, and PIC opacity stays intact.
- Reviewed `flow-ribbons.js` against the actual `Flow` implementation: line segments follow exact routes and transformed parents; the negative shader phase produces motion in increasing route direction; gain affects the source clock; hidden ancestors suppress their ribbons. The helper author also corrected source-opacity preservation after this review. Dash phase need not coincide with individual particles, but direction and clock agree.

## Artifacts and validation

- Source: `tools/blender/build-links.py`; retained `.blend` files for both assets.
- `public/models/coherent-hardware.glb`: 958,588 bytes.
- `public/models/copper-hardware.glb`: 1,412,788 bytes.
- Loader version `v=7` invalidates the previous enclosure cache, including the final coherent lid correction.
- `research/copper-redesign-review.png` is an actual Blender Cycles geometry review render, inspected after reducing excessive review-light intensity. It is not an interactive screenshot and does not contain runtime motion graphics. Render script: `tools/blender/render-links-review.py`.
- Focused checks: 37 passing tests across actual GLBs, side geometry and shared flow ribbons; TypeScript passes. Tests include actual usable phone canvases of 390×445, 390×220 and 390×140, not only the full physical screen aspect.

Remaining limits: public exterior photos cannot establish hidden package placement, copper housing dimensions are illustrative rather than a claimed QSFP product envelope, and representative contact pads are not a pin-by-pin connector specification. The coherent shell footprint and nano-ITLA envelope are preserved. Runtime visual acceptance, annotation collisions and whether the result meets the user's requested spectacle still require the browser review; this report does not substitute a test count for that judgment.
