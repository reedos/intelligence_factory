# Design review: GPU package, pluggable module, data center interconnect, copper cables (10/01/2026)

Reed, 10/01/2026: "Please make sure for all of our designs they make sense from an engineering design perspective
based on best practices for layout, place and route, etc." Shared rule set: placement by signal flow, short direct
high-speed routing away from switching power, power delivery point-of-load, gentle fiber bends, and package
routing that escapes from the face that bonds (rules 1-6 below refer to its sections).

Scope: scene 5 (GPU package and the host board under it), scene 6 (pluggable module, DSP/LRO/LPO, 800G and 1.6T),
scene 8 (800ZR coherent module), scene 9 (DAC/ACC/AEC plugs). Branch `design/packages-modules`.

## Sources opened for this pass

| Source | What it supports |
| --- | --- |
| [SemiWiki, TSMC Technology Symposium highlights, part 2](https://semiwiki.com/semiconductor-manufacturers/tsmc/290560-highlights-of-the-tsmc-technology-symposium-part-2/) | CoWoS-L replaces the silicon interposer with an organic one carrying embedded LSI silicon bridges where dense die-to-die wiring is needed |
| [NextPCB, "CoWoS Packaging Explained: Why H100 & B200 Need 2.5D"](https://www.nextpcb.com/blog/cowos-packaging-h100-b200) | H100: one die with up to six HBM stacks on a monolithic CoWoS-S interposer; B200: two dies, eight HBM3e stacks, CoWoS-L bridges where needed; the interposer wiring runs between logic die and memory |
| TechInsights B200 packaging note (already cited in the site as `techinsights-b200-packaging`) | Blackwell uses CoWoS-L, not a monolithic interposer |
| OSFP MSA contact map as encoded in the module asset (`contacts`, MSA Rev 5.22) | VCC on pads 15/16 and 45/46 at the centre of the card edge; TX and RX pairs in banks either side |
| OIF HB-CDM / micro-ICR / IC-TROSA notes (already cited, evidence `coherent-module-layout`) | RF at one end of each optical package, fibers at the other; DSP, then driver/TIA, then optics |

No public teardown gives the internal layout of the twin-port OSFP, the 800ZR module or the AEC paddle cards, so
those are laid out by the rules and labelled "as drawn" (evidence `optics-module-layout`, `coherent-module-layout`).

## Violations and fixes

| Level | Element | Violation | Rule | Fix | Evidence |
| --- | --- | --- | --- | --- | --- |
| 5 GPU package | HBM-to-die data | Lanes drawn as diagonals from each stack's top into the die interior, converging (not parallel, not at the PHY edge) | 2 short/direct, parallel buses; 6 escape from the bonding face | Each lane leaves the stack's die-facing PHY edge through its microbumps, crosses the interposer (on CoWoS-L, the bridge under that edge) perpendicular to the edge, and rises into the die's HBM PHY band: 3 parallel lanes per stack, about 4 mm | SemiWiki/NextPCB (bridges and interposer wiring between die and HBM); `cowos-bridge-drawing` |
| 5 GPU package | NV-HBI | Lanes ran 2.4 cm across both die tops, not at the seam | 2 short/direct; 6 I/O on the edge facing its partner | Seven lane pairs cross the seam straight over the seam bridge, 3 mm | SemiWiki (LSI bridges for die-to-die) |
| 5 GPU package | NVLink escape | Diagonals through the exploded air gaps from die edge to the substrate edge; no ball or board | 6 escape from the face that bonds; 2 no layer change mid-route | Die SerDes edge → microbumps → interposer RDL → C4 → substrate (fanned in order to ball pitch) → outer-row ball → that ball's escape run on the host board; never rises again | as drawn |
| 5 GPU package | NVLink fan-out on two sides | In the first pass of the new routes, run order ran against the die edge order on two sides (36 crossings on H100) | 2 no crossings | Runs taken in reverse on those sides (caught by the new test) | design-rules.test.ts |
| 5 Host board | BGA escape | Fan-out traces began 2 mm outside the ball field, connected to no pad | 6 escape from pads; 1 connectors/pads | Every run starts on an outer-row pad, leaves straight, jogs 45 degrees toward the nearer corner, ends on a via (chip GLBs rebuilt) | as drawn |
| 5 GPU package (H100) | C4 bumps | 10 of the 32 C4 rows sat outside the shallower CoWoS-S interposer, bonded to nothing | 6 bumps on the face that bonds | Field sized to each interposer | NextPCB (H100 interposer) |
| 6 Module | DSP placement | DSP 2.7 cm from the connector; the 16 host pairs crossed the whole power section | 1 part that talks to a connector sits next to it | DSP moved 17.5 mm to sit right behind the connector breakout; host pairs about 3 mm, straight | OSFP contact map; `optics-module-layout` |
| 6 Module | Host pairs vs power | Host buses ran between switching inductors and their controllers (crossing switch nodes, about 0.5 mm away) | 2 keep high-speed away from VRMs/inductors | Power stage moved beside the DSP's line side, outboard of a compressed line bus: 1.3 mm or more from every inductor and controller | side-module-blender.test.ts |
| 6 Module | Power flows | Spider of diagonals from one point across the high-speed buses and over the DSP | 3 power wide and direct; 2 separate channels | 3.3 V from the centre VCC pads in a plane under the DSP to two point-of-load stages; a DSP rail from each; analog rails along the board edges outboard of every lane | OSFP contact map (VCC 15/16, 45/46) |
| 6 Module | Driver to modulator | 6 mm RF lines from the driver pads to the MZM electrodes, past the lasers; each laser feed crossed an RF line | 1 driver at the modulator; 2 short, no crossings | Lasers at the chip's host-side edge between the pads of the lanes they feed; modulators moved up to the driver: 3.4 mm RF lines, landing on the electrode away from the laser feed | as drawn |
| 6 Module | LPO / LRO copper | Followed the old corridor between power parts | 2 | Same compressed corridor as the DSP's line bus; LRO split by direction still holds | side-module-blender.test.ts |
| 8 Coherent | DSP copper | Copper strands drawn from the die across the package top to the board | 6 escape from the bonding face | Copper only on the board, from the package edge; flows rise into the die edge vertically through the package | as drawn |
| 8 Coherent | 3.3 V entry | Four 3.3 V arrows fanned in from across the card edge, over the host signal pads | 3 power enters at its connector pins | One feed from the 15/16 power pad, down the gap between the converters | `coherent-module-layout` (power pads 15/16, 45/46) |
| 8 Coherent | Rails | Rails ran along both board edges and crossed the host lanes | 2 separate channels; 3 direct | One centre channel between the transmit and receive chains, branching into each part from its inner side, on to the laser | design-rules.test.ts |
| 8 Coherent | Line fibers at the LC | 1 mm S-bend from the side channel into the LC receptacle (laser case ended 3.8 mm short of it) | 5 minimum bend radius | Laser 4 mm toward the host, optics 9 mm long, chain 5 mm toward the host: every fiber, tap branch and pigtail bends at 3 mm or more | design-rules.test.ts |
| 8 Coherent | Passives | Two capacitors sat on the gold fingers; centre capacitors sat on the power branches | 1 keep-outs | Moved beside the power channel and behind the fingers | as drawn |
| 9 Copper | AEC inductors | Power inductors 0.3 mm from the innermost pairs | 2 keep high-speed away from inductors | Pair banks toward the card edges at 1.5 mm pitch, 4.4 mm centre channel: 1.2 mm clearance; drains mirror toward the channel; ACC/AEC packages widened to cover their banks | design-rules.test.ts |
| 9 Copper | Wire termination | Checked: pairs terminate in order, alternate above/below into the jacket, never cross | 5 | No change | side-geometry.test.ts |

## Checked and kept

- HBM stacks: eight around the two Blackwell dies and six around the H100 die (NextPCB); as drawn, each twin die has two stacks along each of its two outer edges that face them, H100 three along each side, and every stack faces its PHY edge.
- Die-to-die PHY on the seam edge, HBM PHY on the HBM edges, NVLink SerDes on the free edges.
- Coherent: DSP nearest the host, driver/TIA at the DSP line edge (about 5 mm), RF at the optics' host end, fibers at
  the far end; DSP-to-driver/TIA copper short and uncrossed.
- Module: TIAs right at the photodiodes (bond wires under 1 mm); line fibers fan to the MPO ports without kinks.
- Heat: the DSP sits under the gap pad and the finned lid in every variant; heat weights untouched.

## Known limits

- The native fallback module (`?module=native`, side-module.js) keeps its older drawing; the shipped module is the
  Blender asset.
- Internal layouts of the twin-port OSFP, 800ZR and AEC remain representative, as the evidence entries say.

## Tests that encode the rules

- `src/scenes/design-rules.test.ts`: BGA escape runs start on pads and never cross; HBM lanes perpendicular, short,
  parallel; NV-HBI straight; NVLink outward-only, never rising, plan length within 1.6x direct, no crossings; C4
  only under the interposer; coherent copper never across the package top, line copper under 1.8 cm, power never
  crosses a lane, fiber bend radius 3 mm or more; copper pairs 1 mm from the inductors, mirror banks, uncrossed
  breakouts.
- `src/scenes/side-module-blender.test.ts` ("module board follows place-and-route rules"): host pairs straight and
  under 5 mm after the breakout, every high-speed pair 1 mm from all seven switching parts, RF under 4 mm with no
  laser feed crossing it, DSP within 2 cm of the connector. All four fail on the previous asset.
