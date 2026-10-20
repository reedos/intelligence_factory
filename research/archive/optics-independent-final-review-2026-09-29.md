# Independent optics final review, 9/29/26

Reviewer: site designer, separate from the optics implementation owner. Application files were read-only for this audit. Scope: final levels 6–9 source changes, real GLB contracts, reference imagery and visibility controls. Parent owns rendered desktop/mobile inspection.

**Result:** no new P0/P1 blocker found in the bounded final changes. Independently reran 51 tests across `side-hardware-blender.test.ts`, `side-module-blender.test.ts` and `side-geometry.test.ts`; all passed.

Accepted:

- Coherent driver/modulator and receiver/TIA feeds go around the nano-ITLA rather than implying electrical transfer through it. Both CW routes still begin at the same laser and terminate separately on transmitter and LO receiver interfaces. Signal receive light enters separately. Active optical packages now emit qualitative heat without a false power-ratio claim.
- Staged coherent and copper lids are separate physical surfaces, complete-view restoration works, and Heat returns them above the boards as qualified x-ray targets. Release loops do not add signal ports. Transparent inspection materials are isolated from the opaque lower housing.
- CPO x-ray treatment clones only the shared interposer material; engine PIC surfaces remain opaque. Electrical-layer ray test demonstrates the buried route; Heat restores normal opacity/depth writing. The detail is still an explicitly enlarged separate callout. EIC/PIC registration lines remain schematic, not centimeter-long wire-bond claims.
- Copper ACC data crosses its redriver only in receive; AEC crosses the retimer in both directions. DAC adds no active heat. Representative pair shielding does not convert the cable into an optical path.
- Pluggable lane mapping, eight TX/eight RX fibers, direct LPO paths and TX-only laser-feed tests remain passing. Module physical die grouping is qualified as illustrative rather than inferred from independent external port count.

Reference images actually viewed: `research/reference-images/coherent-osfp-public.jpg`, `nvidia-copper-public.png`, `nvidia-cpo-public.webp`. Public sources: [Coherent product](https://www.coherent.com/networking/transceivers/telecom/FTCE3L27E1PCL), [NVIDIA copper cable overview](https://docs.nvidia.com/networking/display/400g100gpam4ovdev/copper-dac-and-lacc-cables-overview), [NVIDIA CPO architecture](https://developer.nvidia.com/blog/how-industry-collaboration-fosters-nvidia-co-packaged-optics/). The first supports the enclosure/release-loop silhouette; the small copper image supports plug/jacket proportions only; the CPO photograph supports six optical subassembly placement and external retainers. None supplies a hidden die floorplan or manufacturing clearance specification.

Limits retained: all exact internal positions except the separately dimensioned envelopes remain representative. Geometry projection tests do not prove readable annotations in the responsive UI. No independent live-browser screenshot, measured phone frame rate, photometric validation or manufacturing certification is claimed by this source audit. Final visual acceptance remains with the parent browser review.
