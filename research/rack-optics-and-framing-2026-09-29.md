# Rack optics, inspection detail, and camera review

Reviewed 9/29/2026. Public sources and supplied photographs only.

## Implemented

- Rack inspection models now include denser mechanical detail: cold-plate seals and crowns, fasteners, representative VRM/passive fields, PCB markings, sliding rails, and H100 heatsink/DIMM/fan detail. Detail is concentrated on the extended inspection unit. The extension is an explanatory service position, not a depiction of operating blind-mate connections.
- H100 racks show four rear compute OSFP cages per server; GB200/GB300 show four front compute OSFP cages per tray; Rubin shows eight front cages. Storage QSFP cages are modeled separately: four in the represented H100/GB200 configurations and two in GB300/Rubin.
- Two compute modules per unit are populated for legibility. H100/GB300 use twin connector faces; GB200/Rubin use single connector faces. H100 modules are flat-top with cage riding heatsinks. This is a representative population, not a complete optics BOM or customer cable schedule.
- Fiber runs begin at connector boots, form service loops, and terminate at visible passive patch strips. Representative multifiber looms continue to the overhead runway. No optical combining function is implied. Moving data overlays use the same centerlines as their physical cables, with lower emission to keep neighboring fibers distinct.
- Standard NVL72 switch trays retain copper NVLink connectivity and receive no scale-out optical modules. The rack optical-comparison card explicitly distinguishes these fabrics.
- Rubin's scale-out animation now begins its PCIe segment at Vera rather than drawing a direct GPU-to-NIC connection. NIC-to-cage segments are labeled electrical SerDes. Existing GPU-to-Vera C2C paths remain; optics begins inside the transceiver.
- Component cameras use explicit subject bounds fitted to the available canvas. Removed blanket compact-screen pullbacks. Optical inspection, extended compute units, H100 PSUs, Rubin C2C, GPU package, and token views have targeted framing adjustments. Token labels sit beside the text rather than over it.
- All portions of the lifted GPU lid, including imported and authored rims, are hidden outside Heat view. Thin service-face edges replace trim that crossed storage ports. Two overlapping rack edge surfaces were separated.

Static hardware is exported from editable Blender sources. Three.js renders the interactive scene and adds flow, light, token, camera, and UI behavior.

## Source checks

- [NVIDIA DGX H100/H200 introduction](https://docs.nvidia.com/dgx/dgxh100-user-guide/introduction-to-dgxh100.html): rear cluster interfaces, four OSFP cages, eight ConnectX-7 interfaces, and internal network-module connectivity. These DGX specifics are not a universal HGX OEM port map.
- [NVIDIA LinkX twin-port single-mode optics](https://networking-docs.nvidia.com/800gmms4x00ns/overview): twin-port module connectors and flat-top/riding-heatsink host fit versus finned-top switch modules.
- [NVIDIA DGX GB hardware](https://docs.nvidia.com/dgx/dgxgb200-user-guide/hardware.html) and [networking](https://docs.nvidia.com/dgx/dgxgb200-user-guide/networking.html): compute/switch tray distinction, front compute interfaces, generation-specific NICs and bay port maps. Inspected the published tray top and front images as well as the text.
- [NVIDIA NVL72 AI Factory components](https://docs.nvidia.com/enterprise-reference-architectures/nvl72-ai-factory/latest/components.html): GB300 ConnectX-8 and BlueField-3 configuration.
- [NVIDIA Vera Rubin SuperPOD reference architecture](https://docs.nvidia.com/dgx-superpod-reference-architecture-with-dgx-vera-rubin-nvl72.pdf): compute-tray prose and Figure 2, PDF page 9. Visually inspected the diagram: GPU-to-CPU C2C, CPU-side PCIe to NICs, CPU-to-CPU CLinks, eight CX-9 packages, BF4, front network ports, and rear NVLink copper. The prose also explicitly describes C2C bridging the Superchips; a blanket assertion that there is no such connection would be wrong.
- The user's yellow-cable server photograph shows RJ45 copper management/network cables. It is a cable-management reference, not evidence that those photographed ports contain optical modules.

## Limits that remain explicit

These are representative teaching models, not dimensionally exact vendor CAD. Processor and support-component placement in the rack inspection tray remains schematic; it does not reproduce every position in the supplied board photographs. Representative passive detail is not a claim about a vendor's component BOM. The detailed tray scene is not simply embedded wholesale into every rack slot. Current sourced bandwidth values elsewhere in the application were preserved rather than replaced by older figures in the supplied note.

## Validation

Follow-up, 9/29/2026: the rack overview now faces the front at a three-quarter angle, while dedicated rear parts retain rear views. Part 1 focuses on the compute inspection tray. Part 2 approaches below the extended compute tray so it no longer obscures the NVLink switch board. Added representative power distribution, network mezzanine and DPU thermal assemblies, control/storage hardware, switch cold plates, coolant connections, electrical rear connector banks, and support passives. NVIDIA's published compute and NVLink switch tray top views informed these additions; they remain schematic rather than exact board reproductions. Fiber leads now follow rounded side corridors through visible guides, with compact service returns and separately routed overhead looms. All four Blender rack sources and exports were rebuilt. The follow-up passed 128 rack part views across four generations and desktop/phone, with no reported obstruction, HUD overlap, overflow, or page errors. The rack coplanar detector found zero overlap groups.

- TypeScript check and all 1,318 tests passed. New tests check generation cage counts, absence of modules on NVLink switch rows, connector population, actual connector geometry behind fiber endpoints in exported GLBs, and Rubin PCIe/SerDes routing.
- 362 selectable views across all ten levels on desktop and 390 px phone passed automated pin placement, major line-of-sight obstruction, HUD overlap, sidebar overflow, and page-error checks.
- An additional 402 rack/tray/GPU views across all four generations and both screen sizes passed those checks. These checks measure placement and obstruction, not subjective composition quality.
- Manually inspected rack optics and GPU/token composition, including the phone optical view. Removed the defects found during this review.
- Rack, tray, and GPU coplanar-face checks reported zero overlap groups after the edge correction.
- Production artifact verification passed: 74 runtime files and 37 assets.
- A short rack Data-view smoke measurement on RTX 5090 at 1440 × 900 held approximately 16.7 ms median / 16.8 ms p95 frame intervals. Laptop mode engaged tier 4. This is a display-capped local smoke check, not a benchmark of integrated graphics or the user's workplace laptop. Auto recovery after Laptop mode is gradual, so later Auto samples are not independent full-quality benchmarks.
