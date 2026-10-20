> Superseded visual milestone on 9/29/2026. The user rejected this visual sign-off. See visual-redesign-review-2026-09-29.md for the subsequent redesign and bounded validation. Earlier technical corrections below remain historical evidence.

# Integration review — 9/29/2026

The Blender preview is an integration candidate. The identified technical and presentation blockers in this review were corrected, independently rechecked, and exercised in the rendered application. This is a bounded educational-model review, not vendor CAD certification or a promise about every arbitrary camera position.

Private review dashboard: http://<private-ip>:47411/design-review.html (Tailscale).

Worktree: `C:\Users\reedo\.codex\worktrees\blender-module-test\intelligence_factory`. Main/origin main were checked at `9d6ce44867112d1ebc4de631f57a1a878d10995d`. Their 14 changed paths since the preview base were reconciled; details are in `version-sync-2026-09-29.md`. Main, historical previews and the public deployment have not been overwritten. No commit or push was made.

## Closed findings, highest priority first

Confidence A means strongly supported by a public specification, actual geometry or reproducible behavior. B means a justified representative design or visual judgment; the app identifies those limits.

| Priority / confidence | Finding and correction | Acceptance evidence |
| --- | --- | --- |
| P0 / A | Rubin inherited Blackwell switch/NIC counts. Model and physical assets now distinguish 4 switch ASICs per tray, 8 ConnectX-9 NICs per four-GPU tray, and physical 800G ports from per-GPU aggregate bandwidth. | Model/census tests and actual-GLB component checks; generation review below. |
| P0 / A | H100 optical module grouping and front-end NIC classification were wrong. Four twin-port host modules serve eight back-end ports; front-end ConnectX-7 cards are not BlueField DPUs. | Module, port and power accounting regressions; DGX guide. |
| P0 / A | Hall cooling, campus return pipes and service feeds had gaps or crossings that implied false connections. Distinct facility/secondary circuits, rack drops, roof risers and orthogonal electrical routes now join their intended endpoints. | Independent peer caught a hot/return crossing and an animation skipping an elbow; both fixed and covered by geometry assertions. H100 has no invented liquid rack drops. |
| P0 / A | Rubin tray flows could miss NIC packages. Endpoint routing now reaches the actual eight physical NICs; the tray is fanless with representative rigid manifolds and service bays. | Actual-asset tests and independent compute review. |
| P1 / A | H100 optics and NIC cameras were blocked by the enclosure. Cutaway access and cameras now expose the parts. | Rendered desktop checks of both `4.data.cx` and `4.data.osfp`; actual-mesh ray tests across generation/part cameras. |
| P1 / A | Coherent copy implied universal integrated driver/modulator and receiver/TIA packaging. Copy now says this is one example and explicitly allows discrete electronics. | Cards, intro and model-boundary note agree; public CDM/ICR examples do not establish universal prevalence. |
| P1 / A | Coherent heat animation lacked explanatory selectable parts. Added four Power and four Heat cards and Every part side-trip coverage. | Source/evidence/tour tests and phone-rendered Heat panel show all four parts. |
| P1 / A | Coherent DC paths crossed the laser footprint; active optical packages lacked heat cues. Routed DC around the laser and added qualified package-to-shell heat motion. | Independent optics review and actual geometry. Same-laser TX/LO paths preserved. |
| P1 / B | Coherent/copper views lacked complete enclosures and extraction hardware. Blender housings, staged lids and release loops now complete them. | Desktop and phone inspection. Copper remains representative plug hardware, not falsely labeled as a universal OSFP design. |
| P1 / A | CPO electrical paths were buried. An isolated interposer x-ray material reveals them in Data/Power without turning optical PIC geometry transparent or moving paths. | Actual-mesh visibility tests and rendered CPO tour close-up. Heat restores its intended cover treatment. |
| P1 / B | Removing overhead fixtures flattened the hall atmosphere. Restored slim emissive aisle rails, real downward area lights, supported feeds and reflective interior lighting. | Independent reviewer corrected floating wall attachments and a runway obstruction. Root overview and runway close-up show illuminated fixtures and clear targets. |
| P1 / B | Regional flow was subpixel and campus labels collided. Screen-width map symbols and zoom-aware pulses retain exact paths; captions move with leaders and route statistics appear on selection. | Independent route identity/collision tests and rendered regional overview. Bottom caption margin clears the scale bar. |
| P1 / A | Phone close-ups fitted the screen instead of the actual canvas and became tiny. Camera distance now accounts for actual canvas aspect and FOV; named views refit without resetting manual orbits. | Actual-vertex projections plus 390×844 and 390×620 UI checks. Full coherent/copper assemblies fit; neither inspector nor scrolling content overflows horizontally. |
| P1 / A | Package token text overlapped across layers and pins intruded on controls. Tokens now use three live rows only in their Data focus; labels avoid visible UI rectangles. | Focus/liveness/timing tests; clean package overview and selected-token rendered checks. |
| P1 / A | Artifact packaging could omit lazy chunks and model assets. Export now preserves the complete relative runtime tree and verifies dependencies. | Artifact smoke test and 74 runtime files verified in the generated artifact. |

## Evidence and independent review

- `generation-model-review-2026-09-29.md`: physical counts, current Rubin specification discrepancy and network accounting. Primary references include [NVIDIA Rubin architecture](https://developer.nvidia.com/blog/?p=113993), [current Rubin specifications](https://www.nvidia.com/en-us/data-center/vera-rubin-nvl72/) and [NVLink specifications](https://www.nvidia.com/en-us/data-center/nvlink/). Current product tables take precedence over older dated blog bandwidth figures, and the discrepancy remains documented.
- `compute-final-review-2026-09-29.md` and the final addendum to `compute-independent-audit-2026-09-28.md`: H100/GB200/GB300/Rubin, actual exported geometry, camera rays, flow registration and public photographs. [DGX H100 guide](https://docs.nvidia.com/dgx/dgxh100-user-guide/introduction-to-dgxh100.html), [GB200 hardware guide](https://docs.nvidia.com/dgx/dgxgb200-user-guide/hardware.html), [GB300 product](https://www.nvidia.com/en-us/data-center/dgx-gb300/).
- `site-final-review-2026-09-29.md` and `site-independent-review-2026-09-29.md`: campus/hall/map endpoint and lighting feedback loops. Actual [Google facility photos](https://www.datacenters.google/discover-more/photo-gallery/) and [NVIDIA liquid-cooling explanation](https://blogs.nvidia.com/blog/blackwell-platform-water-efficiency-liquid-cooling-data-centers-ai-factories/) were reviewed. Architecture is illustrative, not a surveyed named-site reconstruction.
- `optics-final-review-2026-09-29.md` and `optics-independent-final-review-2026-09-29.md`: signal chains, materials, enclosures, physical proportions and public images. [NVIDIA CPO architecture](https://developer.nvidia.com/blog/how-industry-collaboration-fosters-nvidia-co-packaged-optics/), [Coherent OSFP product](https://www.coherent.com/networking/transceivers/telecom/FTCE3L27E1PCL), [Marvell active copper](https://www.marvell.com/blogs/active-copper-cables-ai-rack-interconnects.html).

No confidential sources were used. Vendor power claims retain their comparisons/baselines. The combined ELS module/laser count row is labeled reported, not a primary specification. Representative dimensions, topology and exact die partitioning remain qualified.

## Validation and integration handoff

- 1,267 tests across 27 files pass; TypeScript passes. Artifact smoke test, production build and full runtime-tree verification pass. Logs: `full-review-test.log`, `final-typecheck.log`, `final-build.log`, `artifact-test.log`, `artifact-build.log`.
- Rendered checks covered all ten scene families and focused Data/Heat/Power views, the expanded Colossus 2 capacity layout, H100 NIC/optical cameras, DSP/LPO switching, cover/camera controls, the Light tour entering the module and crossing into CPO, and returning to its parent tray. Automated tour tests cover all generated side trips; manual playback was sampled, not every minute of every tour.
- Phone UI checks at 390 px verify complete side-module assemblies and no horizontal inspector overflow. Coherent Heat was also checked with the panel expanded and at 620 px screen height. These are desktop browser viewport tests, not a physical phone certification.
- Hall runway Data sample: 360 frames at 1440×1000, RTX 5090, 172.06 fps, p95 frame 6.3 ms, median CPU 3.1 ms, 781 calls and 10,587,383 triangles across all render passes. This is not a low-end-device or mobile performance claim.
- `integration-files-2026-09-29.json` records candidate paths and SHA-256 hashes, including required public images and models, Blender source/generator files and build tools. Preserve those untracked runtime assets when integrating. `dist/build-info.json` identifies the exact generated content and synchronized main revision.
- Integrate the candidate into a fresh branch from the recorded main revision, preserving any newer upstream changes if main advances. Run the same checks there before publishing. Historical worktrees and older preview ports are separate copies, not aliases of this candidate.

## Checked and correct; retain these decisions

- Lasers feed TX modulators only in the direct-detect module; received data reaches photodiodes/TIAs. DSP and direct LPO chains terminate at the same physical interfaces. Two MPO groups retain 1–4 TX and 9–12 RX mapping. Electrical traces/bonds are distinct from optical waveguides/fibers.
- CPO retains rings, EIC/PIC stacking, engine-specific fiber connectors and a disconnected, labeled 2.5× callout. The hall's CPO comparison chassis is not spuriously wired into the installed fabric.
- Coherent transmit and LO share the same tunable laser; receive signal is independent. Integrated CDM/ICR packaging is one illustrated option, with discrete driver/TIA alternatives explicit.
- ACC conditions receive only; AEC conditions both directions; DAC has no active-chip heat source.
- GB200/GB300 retain legitimate family resemblance, while H100 and Rubin differ where public evidence supports it. No fictional distinctions were added solely for spectacle.
- Heat motion is qualitative transport, not a particle-count wattmeter. HBM heat conducts toward package cooling. Water loops remain separated at the CDU heat exchanger.
- Physical model assets are authored/exported in Blender; the live application renders them with Three.js/WebGL. Stills labeled Blender Cycles are separate. Neither procedural Blender construction nor glossy presentation makes these recovered manufacturer CAD models.
