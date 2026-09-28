# Intelligence Factory — Scenario Tool Fact Sheet

Sourced parameters for turning "The Intelligence Factory" explainer into a scenario tool: the
reader-selectable knobs (accelerator generation, power distribution architecture, cooling
architecture, time-behavior presets, real-site presets) and the state-level carbon numbers
needed to score them honestly.

Basis labels match `research/power-chain-sources.md`: **Published spec** (vendor/standards
body states it directly), **Industry typical** (trade press, reference designs, or multiple
independent sources agree), **Estimate** (derived or uncertain — no single authoritative
number exists).

This file assumes `research/power-chain-sources.md` (grid→rack→board power chain, PUE basics,
GB200/GB300 rack figures, 800 V DC blog claims), `research/interconnect-sources.md` and
`research/interconnect-physical-sources.md` (NVLink/scale-out/scale-across bandwidth and fiber
plant), and `research/heat-carbon-sources.md` (ASHRAE water classes, WUE, parallelism,
utilization, US national carbon intensity, training energy) already exist — figures those files
already source are reused by reference here rather than re-derived, with a pointer back to the
item number. New research in this file is: the four-generation accelerator comparison table,
the AC-vs-800V-DC efficiency-stage numbers, cooling PUE/WUE by era, simulation-clock time
behavior (load swings, outage sequence, hot-day derating, diurnal inference curve), the six
real-site presets, and the twelve-state-plus-US-average carbon intensity table.

---

## A. Accelerator generation

### H100 (HGX/DGX H100, air-cooled, 8 GPUs/server)

- **GPU (package) TDP:** **700 W** (SXM5, "up to 700 W configurable"); PCIe/NVL variant lower (350–400 W).
  - Basis: Published spec. Source: [NVIDIA H100 datasheet](https://resources.nvidia.com/en-us-gpu-resources/h100-datasheet-24306) (NVIDIA); [NVIDIA H100 product page](https://www.nvidia.com/en-us/data-center/h100/).
- **GPUs per rack as typically deployed:** NVIDIA's own DGX SuperPOD design guidance caps **air-cooled DGX H100 at 4 systems (32 GPUs) per rack** — not a hard physical limit but a thermal one: a 5th or 6th node creates hot spots standard air handling can't clear. Each DGX H100 draws roughly 10–11 kW, so **4 systems/rack ≈ 40.8 kW/rack**.
  - Basis: Published spec (NVIDIA's own DGX SuperPOD H100 design guide) for the 4-per-rack cap and the reasoning; Industry typical for the per-system kW figure. Source: [NVIDIA DGX SuperPOD: Data Center Design Featuring DGX H100 Systems — Cooling and Airflow](https://docs.nvidia.com/dgx-superpod/design-guides/dgx-superpod-data-center-design-h100/latest/cooling.html) (NVIDIA); [Introl, "Building 100kW+ GPU Racks"](https://introl.com/blog/building-100kw-gpu-racks-power-cooling-architecture) (Introl, corroborating air cooling's practical 30–40 kW/rack ceiling vs. 60–120 kW+ for direct-to-chip liquid).
  - Note: some integrators run 1 DGX H100 (8 GPUs, ~10.2 kW nameplate) per rack in lower-density colo space — "4 per rack" is NVIDIA's own reference-architecture density, not a universal figure. Present both: 1 server/rack (~10–11 kW) as the conservative colo case, 4 servers/rack (~41 kW) as NVIDIA's reference-density case.
- **Rack kW:** see above — **~10–11 kW (1 server) to ~41 kW (4 servers, NVIDIA reference density)**.
- **HBM:** HBM3, **80 GB**, **~3.35 TB/s** per GPU (SXM5).
  - Basis: Published spec. Source: [NVIDIA H100 datasheet](https://resources.nvidia.com/en-us-gpu-resources/h100-datasheet-24306).
- **HBM stacks per GPU / layers per stack:** **5 active stacks** of 16 GB each (die carries 6 physical stack sites; 1 is a yield-recovery spare, standard practice — not user-configurable), each an **8-Hi HBM3 stack** (8 layers), totaling 80 GB.
  - Basis: Industry typical (widely reported technical teardown detail, not a single NVIDIA datasheet line). Source: [Tom's Hardware, "Nvidia's Hopper H100 SXM5 Pictured"](https://www.tomshardware.com/news/nvidia-hopper-h100-sxm5-pictured) (Tom's Hardware); cross-referenced against [NVIDIA H100 datasheet](https://resources.nvidia.com/en-us-gpu-resources/h100-datasheet-24306) for the 80 GB total.
- **Dies per GPU package:** **1** (monolithic GH100 die, ~814 mm², reticle-limited on TSMC 4N).
  - Basis: Published spec. Source: [NVIDIA H100 Tensor Core GPU Architecture whitepaper](https://www.advancedclustering.com/wp-content/uploads/2022/03/gtc22-whitepaper-hopper.pdf) (NVIDIA).
- **NVLink:** 4th generation, **900 GB/s** per GPU (bidirectional), scale-up domain = the **8-GPU NVSwitch domain inside one server** (no rack-scale NVLink domain existed for H100 — that starts with GB200 NVL72).
  - Basis: Published spec. Source: [NVIDIA H100 datasheet](https://resources.nvidia.com/en-us-gpu-resources/h100-datasheet-24306).
- **Scale-out NIC speed per GPU:** DGX H100 pairs **8 GPUs with 8 single-port ConnectX-7 NICs at 400 Gb/s NDR** (roughly 1:1 GPU:NIC), plus 2 dual-port BlueField-3 DPUs (200 Gb/s) for storage/management — i.e., **400 Gb/s per GPU** is the standard scale-out figure.
  - Basis: Published spec. Source: [NVIDIA DGX H100 product page](https://www.nvidia.com/en-eu/data-center/dgx-h100/) (NVIDIA); [FS.com, "Introduction to NVIDIA DGX H100"](https://www.fs.com/blog/introduction-to-nvidia-dgx-h100-3856.html).
- **Dense FP8 PFLOPS per GPU:** **~1.98 PFLOPS dense** (3,958 TFLOPS is the sparse figure NVIDIA prints; dense is half that, ~1,979 TFLOPS ≈ 1.98 PFLOPS).
  - Basis: Published spec (sparse number is NVIDIA's own; the "dense = sparse/2" convention is NVIDIA's standard footnote across Hopper/Blackwell datasheets, applied here as arithmetic). Source: [NVIDIA H100 datasheet](https://resources.nvidia.com/en-us-gpu-resources/h100-datasheet-24306); [Spheron, "NVIDIA H100 Specs"](https://www.spheron.network/blog/nvidia-h100-specs/).
- **Dense FP4 PFLOPS per GPU:** **Not applicable.** Hopper (H100) has no native FP4 Tensor Core support — FP8 is the lowest precision NVIDIA lists for this generation. Say so; do not put a number here.
  - Basis: Published spec (absence, confirmed directly against NVIDIA's own datasheet precision list: FP64/FP32/TF32/BF16/FP16/FP8/INT8, no FP4).
- **Share of heat to liquid vs air:** **0% liquid / 100% air** for the air-cooled HGX/DGX H100 configuration this row describes (a separately sold direct-liquid-cooled H100 SKU exists from some OEMs but is not the "air-cooled, 8 GPUs per server" baseline the prompt specifies).
  - Basis: Published spec (air-cooled is the reference configuration itself).

### GB200 NVL72

*(Reuses `power-chain-sources.md` items 13, 15, 18 where noted — see that file for full sourcing detail.)*

- **GPU (package) TDP:** **1,200 W** per Blackwell GPU. Basis: Published spec (per power-chain item 18).
- **GPUs per rack:** **72** Blackwell GPUs + 36 Grace CPUs (18 compute trays × 2 CPU + 4 GPU). Basis: Published spec (power-chain item 13).
- **Rack kW:** NVIDIA nominal **120 kW**; TDP commonly cited **132 kW**; peak (EDPp) **~192 kW**. HPE splits **115 kW liquid / 17 kW air (~87% liquid)**. Basis: Published spec / Industry typical (power-chain item 13).
- **HBM:** HBM3e. Per-GPU capacity has a small unreconciled discrepancy: NVIDIA's own rack-level total (13.4 TB / 72 = **~186 GB** implied) vs. the widely cited spec-sheet **192 GB** (8 × 24 GB stacks); bandwidth **~8 TB/s per GPU** (576 TB/s rack ÷ 72). Basis: Published spec, flagged discrepancy (power-chain item 18).
- **HBM stacks per GPU / layers:** **8 stacks**, 8-Hi HBM3e (24 GB/stack → 192 GB spec-sheet figure). Basis: Industry typical (power-chain item 18, citing WCCFTech technical breakdown).
- **Dies per GPU package:** **2** reticle-limited dies, linked by **NV-HBI at 10 TB/s**, presented in software as one GPU; **208 billion transistors** for the full dual-die package. Basis: Published spec (power-chain item 18).
- **NVLink:** 5th generation. Per-GPU bandwidth is commonly cited at **1.8 TB/s** (bidirectional) in independent technical summaries; note that one NVIDIA-hosted GB200 NVL72 spec table, as fetched in this session, printed a per-GPU "3.6 TB/s" figure that does not match the widely corroborated 1.8 TB/s NVLink5 number and looks likely to be a page-extraction artifact (possibly bleed from a rack-level or next-gen figure) rather than a real per-GPU spec — **treat 1.8 TB/s/GPU as the number to use, and flag the 3.6 TB/s reading as unverified.** Scale-up domain: **72 GPUs** (all-to-all NVLink mesh within one rack), aggregate **130 TB/s** rack NVLink bandwidth (NVIDIA's own figure).
  - Basis: Published spec (130 TB/s rack aggregate, NVIDIA's own page) / Industry typical (1.8 TB/s per-GPU) / flagged conflict (3.6 TB/s reading). Source: [NVIDIA, GB200 NVL72 page](https://www.nvidia.com/en-us/data-center/gb200-nvl72/); power-chain item 15.
- **Scale-out NIC speed per GPU:** **800 Gb/s** via ConnectX-8 SuperNIC (8 front OSFP ports on the compute tray, Quantum-X800 InfiniBand or Spectrum-X Ethernet).
  - Basis: Published spec. Source: [NVIDIA ConnectX-8 SuperNIC datasheet](https://resources.nvidia.com/en-us-accelerated-networking-resource-library/connectx-datasheet-c) (NVIDIA); [ServeTheHome, ConnectX-8 detail](https://www.servethehome.com/nvidia-connectx-8-supernic-pcie-gen6-800g-nic-detailed/).
- **Dense FP8 / FP4 PFLOPS per GPU:** NVIDIA's own per-GPU (superchip) table gives **FP8: 20 PFLOPS**; **FP4: 40 PFLOPS sparse / 20 PFLOPS dense**. Rack-scale: FP4 **1,440 sparse / 720 dense** PFLOPS; FP8 **720 PFLOPS**.
  - Basis: Published spec. Source: [NVIDIA, GB200 NVL72 page](https://www.nvidia.com/en-us/data-center/gb200-nvl72/) (fetched directly in this session).
- **Share of heat to liquid vs air:** **~87% liquid / 13% air** (115 kW liquid / 17 kW air, HPE's published split). Basis: Industry typical (power-chain item 13).

### GB300 NVL72

- **GPU (package) TDP:** Not stated as a clean standalone per-GPU watt figure in NVIDIA's own materials found this session; rack TDP of 132–142 kW ÷ 72 GPUs implies roughly **1.4–1.9 kW per GPU including CPU/NIC/cooling share** (an inference, not a quoted per-chip TDP). **Say so — no single sourced per-GPU watt number found**; use the rack figure below instead.
  - Basis: Estimate.
- **GPUs per rack:** **72** B300 (Blackwell Ultra) GPUs + 36 Grace CPUs. Basis: Published spec.
- **Rack kW:** **~135 kW TDP**, **~140 kW** typical rack-scale figure, up to **~155 kW peak**; alternative sourcing gives 132–142 kW nominal. Basis: Industry typical (power-chain item 13; [Sunbird DCIM](https://www.sunbirddcim.com/blog/how-much-power-does-nvidia-gb300-nvl72-need); [Lenovo Press GB300 NVL72 product guide](https://lenovopress.lenovo.com/lp2357-lenovo-nvidia-gb300-nvl72-rack-scale-ai), closer to Published spec for that specific SKU).
- **HBM:** HBM3e, **288 GB per GPU**, **~8 TB/s per GPU** (20.7 TB / 72 GPUs at the rack level; NVIDIA's own GB300 NVL72 page states "20 TB | Up to 576 TB/s" rack-aggregate, i.e. the same 8 TB/s/GPU by division).
  - Basis: Published spec. Source: [NVIDIA, GB300 NVL72 page](https://www.nvidia.com/en-us/data-center/gb300-nvl72/) (fetched directly); corroborated by [SemiAnalysis/InferenceX GB300 NVL72 spec page](https://inferencex.semianalysis.com/chips/gb300-nvl72).
- **HBM stacks per GPU / layers:** **8 stacks**, now **12-Hi** (up from GB200's 8-Hi), 24 GB/stack → 288 GB. Basis: Published spec/Industry typical. Source: [TweakTown, "NVIDIA details Blackwell Ultra GB300"](https://www.tweaktown.com/news/107373/nvidia-details-blackwell-ultra-gb30-features-20480-cuda-cores-288gb-hb3e-memory-and-pcie-gen6/index.html); [VideoCardz, GB300 coverage](https://videocardz.com/newz/nvidia-blackwell-ultra-gb30-features-20480-cuda-cores-288gb-hb3e-memory-and-pcie-gen6).
- **Dies per GPU package:** **2** reticle-sized dies (same NV-HBI, 10 TB/s die-to-die link as GB200). Basis: Published spec.
- **NVLink:** 5th generation (same as GB200), **130 TB/s** aggregate rack bandwidth (NVIDIA's own page). Per-GPU figure by the same 1.8 TB/s NVLink5 convention as GB200 — NVIDIA did not print a different per-GPU NVLink number for GB300 in the page fetched. Scale-up domain: **72 GPUs**.
- **Scale-out NIC speed per GPU:** **800 Gb/s** (ConnectX-8, same generation as GB200). Basis: Industry typical (no GB300-specific NIC upgrade found; presumed carryover).
- **Dense FP8 / FP4 PFLOPS per GPU:** Secondary sources give **~5 PFLOPS dense FP8 per GPU** (→ ~360 PFLOPS rack dense, ~720 PFLOPS rack with sparsity) and **~15 PFLOPS dense FP4 per GPU** (→ ~1,080 PFLOPS rack dense FP4, "1.5× more FP4 compute than GB200," "50% more HBM3e per GPU" per the same comparison). NVIDIA's own GB300 NVL72 page (fetched directly) printed rack-level **"FP4: 1440 | [garbled]"** and **"FP8/FP6: 720 PFLOPS"** — the FP8 number matches GB200's rack figure exactly, which is suspicious given GB300 is supposed to out-perform GB200; the page-extraction did not cleanly separate GB300's actual FP8 dense number from GB200's. **Flag this as unresolved — use the secondary-source ~5 PFLOPS dense FP8/GPU (~15 PFLOPS dense FP4/GPU) figures as Industry typical, and do not trust a rack-level "720 PFLOPS FP8" as GB300-specific without re-verifying against NVIDIA's downloadable Blackwell Ultra datasheet PDF** (linked from the page but not itself fetched in this session).
  - Basis: Industry typical, with an explicit unresolved discrepancy. Source: [server-parts.eu, "NVIDIA B300 Full Specs"](https://www.server-parts.eu/post/nvidia-b300-gpu-blackwell-ultra-architecture); [oxmaint, "GB300 NVL72 Specs"](https://oxmaint.com/sap-integration/on-prem-ai/gb300-nvl72-specs-industrial-ai); [NVIDIA, GB300 NVL72 page](https://www.nvidia.com/en-us/data-center/gb300-nvl72/).
- **Share of heat to liquid vs air:** **~90% liquid / 10% air** (~128 kW to liquid, ~14 kW residual air, out of ~142 kW). Basis: Industry typical. Source: [Pantheon, "GB200 & GB300 NVL72 Power and Cooling Requirements"](https://pantheon.run/learn/nvidia-gb200-nvl72-power-and-cooling); [Sunbird DCIM GB300 power post](https://www.sunbirddcim.com/blog/how-much-power-does-nvidia-gb300-nvl72-need).
- **GB300-specific:** capacitor-based power smoothing (65 J/GPU, 30% peak-demand cut) — see Section D below; reuses power-chain item 16 directly, don't re-derive.

### Vera Rubin NVL144 / NVL72 (2H 2026)

**A naming note the tool should surface directly, since the prompt asks for it:** NVIDIA's own GTC 2025 material defined "NVL144" by **counting GPU compute dies, not packages** — 72 Rubin packages × 2 dies/package = 144. NVIDIA subsequently **renamed the same rack "Vera Rubin NVL72"** to describe it by package count instead, matching the GB200/GB300 NVL72 convention (which counts packages). **The hardware inside "VR NVL144" and "VR NVL72" is the same rack — only the counting convention changed.** This is exactly the kind of thing that should be a toggle or footnote in the tool, not two different rack options.
- Basis: Published spec (NVIDIA's own GTC framing, as reported). Source: [Introl, "NVIDIA Vera Rubin: 600kW Racks by 2027"](https://introl.com/blog/nvidia-vera-rubin-gpu-600kw-racks-2027) (Introl, explicitly describing the die-vs-package renaming); corroborated by [SemiAnalysis, "Vera Rubin – Extreme Co-Design"](https://newsletter.semianalysis.com/p/vera-rubin-extreme-co-design-an-evolution) and [Rohan Paul, X post on Vera Rubin NVL144 rollout](https://x.com/rohanpaul_ai/status/1977865064775311390) (industry-analyst social post, corroborating detail, not a primary source by itself).

Given the above, figures below are **per package (72 in a rack)** unless stated as "per die":

- **GPU (package) TDP:** **~1.8 kW baseline**, up to **~2.3 kW** in a "Max-P" configuration (secondary-source figures; NVIDIA has not published an official per-GPU TDP in the material found this session — hardware ships 2H 2026). Basis: Industry typical/Estimate. Source: [Introl, "NVIDIA Vera Rubin: 600kW Racks by 2027"](https://introl.com/blog/nvidia-vera-rubin-gpu-600kw-racks-2027).
- **GPUs per rack:** **72 Rubin packages (144 compute dies)**, 36 Vera CPUs. Basis: Published spec (per naming note above).
- **Rack kW:** Reported **~120–130 kW** for the standard "VR NVL144/NVL72" rack; a higher-power "CPX" variant reaches **~190 kW** (some sourcing says up to 370 kW for CPX); NVIDIA's own August 2025 materials describe Kyber-class Rubin Ultra racks (a later, larger rack — not this one) at ~600 kW with up to 576 accelerators — **do not conflate the 2H 2026 Vera Rubin NVL72 rack with the later Kyber/Rubin Ultra rack.**
  - Basis: Industry typical, with the Kyber/Rubin-Ultra conflation flagged explicitly (see also power-chain item 17). Source: [Introl, "NVIDIA Vera Rubin: 600kW Racks by 2027"](https://introl.com/blog/nvidia-vera-rubin-gpu-600kw-racks-2027).
- **HBM:** HBM4, **288 GB per GPU package**, **~22 TB/s per GPU**.
  - Basis: Industry typical (pre-launch spec, not yet an NVIDIA datasheet fetched directly). Source: [NADDOD, "NVIDIA Vera Rubin NVL144"](https://www.naddod.com/blog/nvidia-vera-rubin-nvl144-next-generation-high-performance-computing-platform"); [WCCFTech, "NVIDIA Rubin & Rubin Ultra"](https://wccftech.com/nvidia-rubin-rubin-ultra-next-gen-vera-cpus-next-year-1-tb-hbm4-memory-4-reticle-sized-gpus-100pf-fp4-88-cpu-cores/) (states up to 1 TB HBM4 for the later Rubin Ultra part — do not confuse with base Rubin's 288 GB).
- **HBM stacks per GPU / layers:** Not found as a clean sourced number in this session — pre-launch part, secondary sources give total capacity/bandwidth but not stack count/layer count. **Say so.**
- **Dies per GPU package:** **2** reticle-sized compute dies on a 3 nm-class process (same dual-die pattern as Blackwell/Blackwell Ultra), which is the basis for the 72-package/144-die naming distinction above.
  - Basis: Industry typical (pre-launch). Source: [Tom's Hardware, "Nvidia's Vera Rubin platform in depth"](https://www.tomshardware.com/pc-components/gpus/nvidias-vera-rubin-platform-in-depth-inside-nvidias-most-complex-ai-and-hpc-platform-to-date).
- **NVLink:** 6th generation, **~3.6 TB/s per GPU** (bidirectional; "1.8 TB/s each way" is also reported, i.e. NVLink6 roughly doubles NVLink5's 1.8 TB/s). Scale-up domain: **72 packages / 144 dies** per rack, with NVSwitch 6 fabric giving **~28.8 TB/s** aggregate GPU-to-GPU bandwidth cited by one source (this figure has not been cross-checked against a second independent source — treat cautiously) and NVIDIA's own claimed rack-level NVLink aggregate elsewhere cited at 260 TB/s (also not independently cross-checked in this session).
  - Basis: Industry typical, internally inconsistent aggregate figures (28.8 TB/s vs. 260 TB/s) — **flag as unresolved, do not present both as if they agree.** Source: [Wheeler's Network, "Decoding Nvidia's Rubin Networking Math"](https://www.wheelersnetwork.com/2025/11/decoding-nvidias-rubin-networking-math.html); [VRLA Tech, "NVIDIA Vera Rubin Architecture"](https://vrlatech.com/nvidia-vera-rubin-architecture-explained/).
- **Scale-up CPU-GPU link:** NVLink-C2C at **1.8 TB/s** between each Vera CPU and its paired Rubin GPU. Basis: Industry typical.
- **Scale-out NIC speed per GPU:** **ConnectX-9**, doubling to **1.6 Tb/s** per the ConnectX generation jump (one source), though the same source also describes ConnectX-9 modular expansion bays at "800 GB/s" (likely a units mix-up between Gb/s and GB/s in the secondary reporting) — **the precise per-GPU scale-out figure is not cleanly confirmed; treat "1.6 Tb/s (2×800 Gb/s)" as the most likely reading and flag the GB/s-vs-Gb/s ambiguity.**
  - Basis: Industry typical, flagged unit ambiguity. Source: [Introl, "NVIDIA Vera Rubin: 600kW Racks by 2027"](https://introl.com/blog/nvidia-vera-rubin-gpu-600kw-racks-2027).
- **Dense FP8 / FP4 PFLOPS per GPU:** Reported figures conflict across secondary sources: one gives **50 PFLOPS FP4** total per GPU with a separate **35 PFLOPS "FP4 training" (dense)** framing; another gives a rack-level **"up to 3.6 NVFP4 ExaFLOPS"** for inference and **"1.2 FP8 ExaFLOPS"** for training across the 144-die rack, which — divided across 144 dies — implies roughly **25 PFLOPS FP4/die** and **~8.3 PFLOPS FP8/die**, not matching the 50/35 PFLOPS-per-GPU figures from the other source. **This is a real, unresolved conflict between secondary sources on a not-yet-shipped part — present a range (e.g., "~25–50 PFLOPS FP4 per GPU, sources disagree") rather than a single number, and re-verify against NVIDIA's own numbers once Vera Rubin ships and a primary datasheet exists.**
  - Basis: Estimate (pre-launch, conflicting secondary sourcing). Source: [NADDOD, "NVIDIA Vera Rubin NVL144"](https://www.naddod.com/blog/nvidia-vera-rubin-nvl144-next-generation-high-performance-computing-platform); [Hashrate Index, "NVIDIA Vera Rubin NVL72"](https://hashrateindex.com/blog/nvidia-vera-rubin-nvl72-specs-breakdown/); [Flopper.io, "NVIDIA Vera Rubin NVL72 Specs"](https://flopper.io/system/nvidia-vera-rubin-nvl72) (cites 1,260 PFLOPS FP8, yet another figure — three-way disagreement).
- **Share of heat to liquid vs air:** **~100% liquid** — the compute tray is reported as fully (100%) liquid-cooled, with a PCB midplane replacing cabling; design point cited at 45 °C liquid supply.
  - Basis: Industry typical (pre-launch). Source: [Rohan Paul, X post](https://x.com/rohanpaul_ai/status/1977865064775311390); [Introl, "NVIDIA Vera Rubin: 600kW Racks by 2027"](https://introl.com/blog/nvidia-vera-rubin-gpu-600kw-racks-2027).

### Google TPU v7 (Ironwood) — comparable per-chip numbers

- **Power:** **600 W TDP per chip**, reported as "2× the power efficiency of the prior generation (Trillium)."
  - Basis: Industry typical (Google has not published a formal TDP datasheet found in this session; 600 W is trade-press-reported but repeated consistently across multiple independent outlets). Source: [Google Cloud, "Ironwood: the first Google TPU for the age of inference"](https://blog.google/innovation-and-ai/infrastructure-and-cloud/google-cloud/ironwood-tpu-age-of-inference/) (Google, official announcement — does not itself state the 600 W figure in the excerpt seen); [Introl, "Google TPU Architecture: 7 Generations Explained"](https://introl.com/blog/google-tpu-architecture-complete-guide-7-generations) (trade summary, states 600 W).
- **HBM:** **192 GB per chip**, **~7.37 TB/s** bandwidth.
  - Basis: Published spec (Google's own TPU7x documentation). Source: [Google Cloud, "TPU7x (Ironwood)" docs](https://docs.cloud.google.com/tpu/docs/tpu7x) (Google, current).
- **ICI (inter-chip interconnect, Google's NVLink-equivalent):** **1.2 TB/s per chip**.
  - Basis: Published spec. Source: [Google Cloud, TPU7x docs](https://docs.cloud.google.com/tpu/docs/tpu7x).
- **Compute:** **4,614 FP8 TFLOPS** (**2,307 BF16 TFLOPS**) per chip — first TPU generation with native FP8 hardware support. No FP4 support disclosed (comparable to Hopper's absence of FP4 — say so).
  - Basis: Published spec. Source: [Google Cloud, TPU7x docs](https://docs.cloud.google.com/tpu/docs/tpu7x); [XPU.pub, "Google Adds FP8 to Ironwood TPU"](https://xpu.pub/2025/04/16/google-ironwood/).
- **Scale:** pods scale from 256 chips to **9,216-chip superpods** delivering a claimed **42.5 FP8 exaflops**.
  - Basis: Published spec (Google's own announcement). Source: [Google, Ironwood announcement](https://blog.google/innovation-and-ai/infrastructure-and-cloud/google-cloud/ironwood-tpu-age-of-inference/).
- **Power architecture:** reported to follow **OCP ORv3** with a **±400 V DC** rack distribution architecture, supporting up to roughly **1 MW per rack** at full scale — Google's own analogue to NVIDIA's 800 V DC push, at a different bus voltage.
  - Basis: Industry typical (not an official Google spec sheet in the sources found). Source: [NADDOD, "Google TPU: The AI Chip for the AI Inference Era"](https://www.naddod.com/ai-insights/google-tpu-the-ai-chip-for-the-ai-inference-era).
- **Dies per package / NIC per chip:** Not found as sourced numbers in this session — Google does not publish TPU package/die construction or per-chip scale-out NIC speed with the same granularity NVIDIA does. **Say so.**

---

## B. Power distribution: AC path vs. NVIDIA 800 V DC

### Today's AC path

**Stages:** MV utility feed (commonly 13.8 kV in the NVIDIA framing used here) → step-down to **480/415 V AC** → **UPS** (double-conversion, online) → rack power distribution (busway/PDU) → **rack power shelves converting to ~50–51 V DC** → board-level DC-DC down to ~0.8 V at the die (see power-chain items 9, 14, 19).

**Stage efficiencies (published/typical, by component):**
- MV-to-LV unit substation transformer: DOE 2016 standard cuts average losses **13–18%** vs. pre-2016 units; no single clean "X% efficient" headline number for a specific 2.5–3 MVA rating (power-chain item 8).
- Static double-conversion UPS: Eaton 9395XR rated **up to 97.5%** efficiency in double-conversion mode, **up to 99%** in eco/ESS mode (power-chain item 9).
- OCP ORv3 rack power shelf (AC→~50 V DC): reported **~97.5%** peak efficiency at half load (power-chain item 14).
- **End-to-end AC chain (multiple independent framings converge on a similar range):** one framing states legacy AC architectures deliver only **~83% end-to-end efficiency** from grid to compute load; a related framing states "a well-designed AC chain delivers 85–90% of metered power to the compute load" — i.e., **roughly 15–17% of grid power is lost across the AC chain's multiple conversion stages** before reaching the die.
  - Basis: Industry typical (secondary trade-press synthesis of the NVIDIA 800 V DC framing, not a single named utility/vendor study). Source: [InvisibleHill Research, "800V vs. 48V Data Center Power: Where the Savings Come From"](https://invisiblehill.com/research/800v-vs-48v-data-center-power-where-the-savings-come-from) (secondary analysis citing the ~83% figure); [datacenterrichness Substack, "Solid State Transformers Could Reshape AI Infrastructure"](https://datacenterrichness.substack.com/p/solid-state-transformers-could-reshape") (secondary synthesis). Neither of these is NVIDIA's own blog post — NVIDIA's own post states only the **relative** "up to 5%" gain (below), not an absolute 83% baseline efficiency number. **Flag the 83% figure as Industry typical/secondary-source arithmetic, not an NVIDIA-stated baseline.**

### NVIDIA 800 V DC architecture ("Kyber" direction, also underpinning near-term Vera Rubin racks)

**Stages:** MV utility feed (13.8 kV AC) → **industrial-grade rectifiers / solid-state transformers at the facility perimeter, converting directly to 800 V DC** → row/rack busway at 800 V DC → **in-rack DC-DC conversion** down to the board bus (48 V or 12 V) → on-die VRM. This collapses what NVIDIA describes as **4–5 conversion stages down to 2**, by eliminating the separate UPS and PDU stages as distinct AC equipment (their function — energy storage/ride-through and distribution — is absorbed into the DC architecture; see next paragraph on where storage sits).
- Basis: Published spec (NVIDIA's own blog, quoted directly). Source: [NVIDIA Developer Blog, "NVIDIA 800 V HVDC Architecture Will Power the Next Generation of AI Factories"](https://developer.nvidia.com/blog/nvidia-800-v-hvdc-architecture-will-power-the-next-generation-of-ai-factories/) (NVIDIA, May 20, 2025) — fetched directly in this session; power-chain item 17.

**Efficiency figures:**
- NVIDIA's own claim: **"up to 5% improvement in end-to-end power efficiency"** vs. the 54 V/legacy architecture. This is the number to use as NVIDIA's own headline claim.
  - Basis: Published spec.
- A secondary trade-press framing puts specific before/after numbers on this same claim: **~83% (AC baseline) → "over 92%"** end-to-end efficiency with 800 V DC — this is a **much larger jump than NVIDIA's own "up to 5%"** framing, meaning the two do not agree, and are not both usable as if they measure the same thing. **NVIDIA's own "5%" is almost certainly a relative-improvement figure on top of a much higher baseline than 83%; the 83%→92% framing is a different (unverified) secondary construction.** Use NVIDIA's own "up to 5%" as the sourced published-spec number, and either drop the 83%/92% framing or clearly label it Estimate/unverified.
  - Basis: Estimate — flagged internal conflict. Source: [mgrid.org, "AI Data Centers Shift to 800 VDC Solid-State Transformers"](https://mgrid.org/2026/05/15/how-moving-ai-data-centers-to-800-vdc-distribution-and-solid-state-transformers-sidesteps-phase-imbalance-entirely/).
- **Solid-state transformer (SST) efficiency (component-level, published vendor specs, not the same as the end-to-end "5%" system claim):** Navitas states SST designs exceeding **98% conversion efficiency** from 13.8/34.5 kV AC to 800/1500 V DC; a separate Navitas 800 V→50 V DC-DC platform is rated **98.5% peak efficiency**; Wolfspeed's 10 kV SiC MOSFET line is marketed around **99% efficiency** for this class of conversion.
  - Basis: Published spec (vendor datasheets/press). Source: [Navitas, "Navitas Supports 800 VDC Power Architecture for NVIDIA's Next-Generation AI Factory Computing Platforms"](https://navitassemi.com/navitas-supports-800-vdc-power-architecture-for-nvidias-next-generation-ai-factory-computing-platforms/); [Wolfspeed, "Powering AI with SiC-based solid-state transformers"](https://www.wolfspeed.com/knowledge-center/article/powering-ai-with-reliable-silicon-carbide-based-solid-state-transformers/).
- **800 V → 48 V or 12 V in-rack DC-DC efficiency:** reported ranges of **94–97%** end-to-end for the two-stage (800→48/12 V) in-rack chain in one synthesis; individual converter topologies cited at **96–99%** peak (a 4:1 switched-tank converter topology; a 48V-to-12V resonant switched-capacitor prototype at 98.8% peak/96.1% full-load); TI reports **97.6% peak** for an isolated 800 V-to-6 V converter. For comparison, legacy AC power-supply-unit-based conversion is cited at only **89–93%**.
  - Basis: Industry typical (mix of vendor datasheets and one applied-research synthesis, not a single named NVIDIA reference design). Source: [Rax, "800V DC Power Distribution for Data Centers"](https://rax.ae/knowledge-center/articles/800v-dc-power-distribution-data-centers-megawatt-racks.html); [InvisibleHill Research, "800V vs. 48V Data Center Power"](https://invisiblehill.com/research/800v-vs-48v-data-center-power-where-the-savings-come-from).
- **Copper reduction:** **45% less copper** required vs. 415 V AC distribution, and **85% more power** deliverable through the same conductor size — both NVIDIA's own numbers.
  - Basis: Published spec (power-chain item 17).
- **UPS/battery on the 800 V bus:** NVIDIA's own post mentions "energy storage solutions to help data center infrastructure handle load spikes" as part of the 800 V DC architecture but, as fetched in this session, **does not give a specific statement on whether traditional UPS/battery strings sit directly on the 800 V bus versus a separate subsystem.** Related capacitor-based smoothing at the GB300 rack level (65 J/GPU, see Section D) is a separate, already-in-production mechanism, distinct from facility-level 800 V DC UPS placement. **Say so — this specific architectural detail (UPS bus placement) is not confirmed by a primary source found in this session.**
  - Basis: Estimate (unconfirmed).
- **NVIDIA's other claimed benefits:** up to **70% lower maintenance cost**, up to **30% lower total cost of ownership**. Basis: Published spec (power-chain item 17).

---

## C. Cooling architecture: design PUE and WUE by era

| Architecture | Design PUE | WUE (L/kWh) | Basis |
|---|---|---|---|
| (1) Air-cooled halls with chillers (H100 era) | **~1.5** typical; broader range **1.4–1.8**; Uptime's fleet-wide 2025/2026 survey average sits at **1.52–1.56** (weighted **1.36** by size) reflecting a fleet still dominated by air-cooled/mixed facilities | Not separately isolated for pure air-cooled-with-chiller-tower designs in sources found — LBNL's fleet-average WUE trajectory (0.45–0.48 L/kWh in some future scenarios) is the closest available number, and it describes the broader (mixed) fleet, not an air-only design point. **Say so: no clean air-only WUE design figure found.** | Industry typical |
| (2) Liquid-cooled halls with chillers | **~1.10–1.20** (direct-to-chip) | Comparable to warm-water figures below where the same dry-cooler/adiabatic-assist plant is used; where a chiller (not a dry cooler) rejects the heat, WUE tracks the chiller's own cooling-tower water use, which is architecture- and climate-specific and not separately isolated in sources found this session. | Industry typical |
| (3) Warm-water liquid cooling with dry coolers | **~1.05–1.15** direct-to-chip range (best-case single-phase immersion 1.03–1.08, a related but distinct architecture); Uptime's D2C-cooled facility band is cited as **1.03–1.20** | **~0.15–0.17 L/kWh** (dry-cooler + adiabatic-assist); Microsoft's Fairwater design claims **effectively zero ongoing water use** (closed-loop, filled once at construction, "as little water annually as a restaurant" per CEO Nadella, Build 2026 — a qualitative CEO claim, not an audited figure) | Industry typical (PUE range) / Published spec (Microsoft's own zero-water design claim, see heat-carbon item 7) |

- **Sources:** [Introl, "Direct-to-Chip Cooling Implementation"](https://introl.com/blog/direct-to-chip-cooling-pue-below-12-implementation) (Introl); [Introl, "Liquid Cooling vs Air Cooling for AI Data Centers"](https://introl.com/blog/liquid-vs-air-cooling-ai-data-centers); [mgrid.org, "Data Center PUE Gains Stall as Liquid Cooling Adoption Hits 19%"](https://mgrid.org/2026/02/13/data-center-pue-plateau-liquid-cooling-19-percent-adoption/) and [mgrid.org, "Global Data Center PUE Stalls at 1.54"](https://mgrid.org/2025/10/01/uptime-institute-data-center-pue-stagnation-2025-liquid-cooling/) (both citing Uptime Institute's 2025/2026 survey figures); [Uptime Institute, 2025 Cooling Systems Survey PDF](https://intelligence.uptimeinstitute.com/sites/default/files/2025-07/UI%20Field%20181_Data%20center%20cooling.pdf) (Uptime, primary survey — behind a registration wall, not independently re-fetched in this session, so the 1.03–1.20/1.52–1.56 numbers above should be re-verified against it directly before publishing); Microsoft closed-loop and LBNL WUE figures reused from `heat-carbon-sources.md` item 7 and `power-chain-sources.md` item 7 — see those files for full sourcing and caveats (in particular: the LBNL 0.45–0.48 L/kWh figure is via secondary trade summary and should be re-verified against the [LBNL 2024 US Data Center Energy Usage Report PDF](https://eta-publications.lbl.gov/sites/default/files/2024-12/lbnl-2024-united-states-data-center-energy-usage-report_1.pdf) directly).
- **Note:** I did not find LBNL's 2024 report breaking out PUE/WUE explicitly by these three named architectures in the text pulled in this session (the PDF is long; I did not fetch and parse it page-by-page) — the (1)/(2)/(3) figures above are stitched together from multiple vendor/trade-press sources describing each architecture type separately, not one single LBNL table with all three rows. **Say so, and treat the table above as a reasonable synthesis, not a single authoritative source's own comparison table.**

---

## D. Time behavior for a simulation clock

### Synchronized training load swings

- **Magnitude:** Widely reported in the tens of MW at single-datacenter scale, reaching **hundreds of MW** when a job spans a large enough cluster ("100 MW swings, pushing clusters to ~150% of average draw" per one framing already in power-chain item 6). Ramp rates of **tens to hundreds of MW per second** are reported at job start, checkpoint boundaries, fault recovery, or global barriers.
- **Period / frequency:** A joint Microsoft/OpenAI/NVIDIA research paper (August 2025), based on measurements from production training clusters, found the **dominant frequency components of these power oscillations fall in the 0.2–3 Hz range** — i.e., swings on the order of **0.3 to 5 seconds**, not sub-second in the sense of kHz switching, but fast enough to fall inside power-grid resonant bands for long transmission lines and nearby generators.
  - Basis: Published spec (a named joint industry research paper, the most authoritative source found for this specific number). Source: ["Power Stabilization for AI Training Datacenters"](https://www.alphaxiv.org/abs/2508.14318) (Microsoft/OpenAI/NVIDIA, Aug 2025, as indexed on alphaXiv); [arXiv, "A Pre-Dispatch Resonance Safety Criterion for AI Training Clusters"](https://arxiv.org/html/2606.22096) (independent follow-on analysis using the same 0.2–3 Hz framing); [Data Center Dynamics, "The AI power swingers"](https://www.datacenterdynamics.com/en/analysis/the-ai-power-swingers/) (trade summary).
  - Note: "tied to step time" in the prompt's framing is directionally correct (each ramp corresponds to a step/iteration boundary) but the specific 0.2–3 Hz figure is a frequency-domain (FFT) characterization across many step boundaries, not a single "step time" value — present it as a frequency band, not a literal per-step duration.
- **GB300 power smoothing:** capacitor-based energy storage, **65 J per GPU**, co-designed with LITE-ON, occupying roughly half the PSU's volume; NVIDIA reports this **cuts peak grid demand by up to 30%** on a Megatron LLM training workload vs. the GB200 power shelf. Reuses power-chain item 16 directly — Published spec, NVIDIA's own technical blog.
  - Source: [NVIDIA Developer Blog, "How New GB300 NVL72 Features Provide Steady Power for AI"](https://developer.nvidia.com/blog/how-new-gb300-nvl72-features-provide-steady-power-for-ai/) (NVIDIA, July 28, 2025).
- **Battery-based smoothing (BESS):** used both for training-load buffering and grid-facing services; xAI Colossus (Memphis) up to 168 Tesla Megapacks (~150 MW reported); Meta Hyperion (Louisiana) plans grid-scale battery storage at three sites per its Entergy agreement. Reuses power-chain item 6 directly — Industry typical.

### Grid outage sequence

- **UPS ride-through:** UPS batteries are sized to bridge the gap until generators are running and accepting load — commonly a **few minutes up to ~15 minutes** of design margin, though the "3–10 minute" range is more typically quoted as the practical target given fast generator starts; flywheel UPS (a different technology than battery UPS) provides a shorter **15–30 second** bridge specifically to cover the generator-start gap, relying on the generator picking up load well within that window.
  - Basis: Industry typical (no single code-mandated "ride-through minutes" number exists — it's a design choice sized against the generator-start time below). Source: [ZincFive, "Runtime Optimization: As Data Centers Reduce UPS Runtimes..."](https://zincfive.com/paper/runtime-optimization-as-data-centers-reduce-ups-runtimes-the-right-batteries-become-more-critical/); [Energy Intelligence Glossary, "Data Center UPS Flywheel"](https://energy-solutions.co/glossary/terms/data-center-uninterruptible-power-supply-ups-flywheel).
- **Generator start and load acceptance (NFPA 110):** **Level 1 systems** (the class typically specified for mission-critical/data-center standby power) must have the power source and transfer switch **assume full emergency load within 10 seconds** of a utility failure — a hard requirement covering engine cranking, run-up to rated speed/voltage, and automatic transfer switch operation, with **no tolerance for deviation**.
  - Basis: Published spec (NFPA 110 is the standards body; the 10-second figure is the code's own Level 1 requirement). Source: [Generator Source, "NFPA 110 Standard Overview on Generator Requirements"](https://generatorsource.com/safety-maintenance/nfpa-110-generator-requirements/); [NFPA, "An Overview of NFPA 110"](https://www.nfpa.org/news-blogs-and-articles/blogs/2023/01/23/an-overview-of-nfpa-110) (NFPA's own blog, corroborating).
- **Transfer back / battery runtime:** Not found as a single sourced "typical minutes" figure in this session beyond the ride-through range above — transfer-back timing (generator to utility, once utility is confirmed stable) is typically a a few minutes of utility-stability confirmation before re-transfer, but no single code-mandated number was found. **Say so.**
  - Basis: Estimate/not found.

### Hot-day profile

- **Dry-cooler capacity derating with ambient temperature:** A clean, quantified derating curve (e.g., "X% capacity loss per °C above design point") was **not found** in any single source in this session — dry-cooler manufacturer datasheets do publish specific capacity-vs-ambient curves, but I did not fetch a named manufacturer's curve directly. What is sourced: (a) the general principle that **as ambient rises, condensing/approach temperature and compressor lift increase, reducing dry-cooler capacity and pushing systems toward chiller or adiabatic assist**; (b) a general full-plant-scale efficiency-change figure from an unrelated (thermoelectric power plant) context of **~0.6% efficiency change per 5.5°C** — **this power-plant figure should not be reused for data-center dry-cooler capacity derating; it's a different system entirely, included here only to show what was found and explicitly rejected as inapplicable.**
  - Basis: Estimate — **say so clearly: no data-center-specific dry-cooler derating curve was sourced.** Recommend pulling a named vendor (Munters, Güntner, Vertiv) dry-cooler capacity-vs-ambient datasheet directly before putting a number on the tool.
- **Adiabatic/evaporative assist activation threshold:** Patent-literature examples describe **free-cooling (dry) mode below ~65°F (18.3°C)** ambient, and **adiabatic-assist activation at/above ~95°F (35°C)** ambient (beyond which dry-only air movement can no longer cool the load) — these are illustrative design thresholds from patent filings, not a single universal industry standard.
  - Basis: Industry typical (patent-literature examples, not a named vendor spec sheet or standard). Source: [USPTO, "Hybrid dry adiabatic cooling chilled water plant for data centers"](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12426214); [USPTO, "Data centre cooling systems"](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/11089718).

### Inference traffic diurnal curve

- **Shape:** LLM inference/conversational-AI traffic shows a **low overnight trough, a sharp morning rise, a midday dip, a secondary afternoon peak, then evening decline** — consistent with human-activity-driven demand and corroborated across multiple independent measurement studies of real LLM deployments.
  - Basis: Industry typical (peer-reviewed/preprint measurement studies, not a single hyperscaler's own disclosed curve). Source: [arXiv, "From Servers to Sites: Compositional Power Trace Generation of LLM Inference for Infrastructure Planning"](https://arxiv.org/pdf/2603.18383) (arXiv, describes the shape but — see below — was not found to state a specific peak/trough ratio in the sections extracted); [arXiv, "Daily and Weekly Periodicity in Large Language Model Performance and Its Implications for Research"](https://arxiv.org/pdf/2602.15889).
- **Peak/trough ratio or published daily utilization shape — a specific number:** **Not found.** No hyperscaler (OpenAI, Google, Anthropic, Microsoft) has published a specific peak:trough ratio for its inference fleet's diurnal power draw in the sources searched this session; the closest analogues found were (a) qualitative descriptions of the shape (above), and (b) an unrelated general-enterprise-GPU utilization figure (~5% average utilization across many Kubernetes clusters, already in heat-carbon item 12 — **that number describes idle/allocated-but-unused capacity, not a time-of-day curve, and should not be repackaged as a diurnal ratio**). One source notes that at the fleet level, "hundreds of apps across time zones and use cases fill each other's troughs, so the fleet runs closer to saturation around the clock" for large multi-tenant hyperscaler fleets specifically — i.e., the diurnal swing a single consumer-facing app sees is smoothed out at full hyperscaler-fleet scale, which cuts against assuming a single sharp national diurnal curve for the biggest fleets.
  - Basis: Estimate — **say so: no sourced peak/trough ratio number exists for this tool to use.** Recommend either (a) using a placeholder/adjustable slider labeled clearly as illustrative, or (b) sourcing a specific regional grid operator's (e.g., ERCOT, PJM) published load curve for known AI campuses as a proxy, which was not attempted in this session.

---

## E. Real-site presets

### Stargate Abilene, TX (OpenAI/Oracle/Crusoe/SoftBank)

- **Location:** Abilene, TX — city-level coordinates **32.45°N, 99.75°W**. Exact campus coordinates were not found in this session (news/trade sources describe the site relative to Abilene and the Midland–Graham 345 kV corridor, not a street address or GPS pin).
- **MW:** ~**421 MW** IT power operating (buildings 1–4 of 8, as of July 2026, per Epoch AI's site-evidence estimate); planned end-state **>1 GW** (a 1.2 GW-class 345 kV substation with five main power transformers is under construction). Reused directly from power-chain item 2 — see that file for the Industry-typical/not-OpenAI-disclosed caveat.
- **Accelerator type:** Not confirmed to a specific generation split in sources found this session beyond general "NVIDIA GPU" reporting for Stargate broadly; GB200/GB300-class hardware is widely assumed for 2025–2026 buildout given the timeline, but I did not find an Abilene-specific per-building accelerator-generation disclosure. **Say so.**
- **GPU count:** Not disclosed in sources found this session.
- **Cooling:** Not independently sourced in this pass beyond the general large-campus liquid-cooling assumption common to GB200/GB300-era buildouts — no Abilene-specific cooling-architecture disclosure found. **Say so.**
- **Grid/on-site generation:** Fed by a double 345 kV corridor (Midland–Graham, TX) with a new Oncor 345 kV substation; no on-site generation disclosed (contrast with xAI Colossus and Meta Hyperion below, both of which pair on-site/adjacent gas generation with grid draw).
  - Basis: Industry typical (Epoch AI site-evidence estimates, not OpenAI/Oracle disclosure). Source: [Epoch AI, "OpenAI Stargate: where the US sites stand"](https://epoch.ai/publications/openai-stargate-where-the-us-sites-stand) (Epoch AI, 2026).

### xAI Colossus 1 & 2, Memphis, TN

- **Location:** Memphis, TN — **Colossus 1**: former Electrolux factory site, South Memphis (Riverport/Paul R. Lowry Road area), city-level coordinates **~35.05°N, 90.06°W**. **Colossus 2**: 5420 Tulane Road, Whitehaven, Memphis, TN 38109 (three parcels, ~100 acres), city-level coordinates **~35.02°N, 90.05°W**; power is substantially self-generated via gas turbines across the state line in **Southaven, Mississippi** (a former Duke Energy natural-gas power-plant site xAI acquired mid-2025).
- **MW:** Colossus 1: began at ~8 MW initial grid interconnect, MLGW/TVA supply reaching **~150 MW**; Colossus 1 "fully operational" reporting cites **200,000 GPUs** backed by Tesla Megapack batteries, with a "Phase 2" consuming **300 MW**. Colossus 2: initial phase targets **110,000 NVIDIA GB200 GPUs** scaling to a planned **350,000 GPUs**; site-wide cooling capacity reported at **~200 MW** via 119 air-cooled chillers (as of Aug 2025); frequently described in trade press as "the first gigawatt datacenter," implying a **~1 GW** target once gas-turbine generation in Southaven, MS is fully online.
- **Accelerator type:** Colossus 1: **NVIDIA H100** (initial ~100,000-GPU cluster), later mixed with **H200**; per one Dec-2025 accounting, the combined Colossus fleet is **150,000 H100 + 50,000 H200 + 30,000 GB200**. Colossus 2: **NVIDIA GB200** (110,000 initial, scaling toward 350,000).
- **Cooling:** Air-cooled chillers reported for Colossus 2 (119 units, ~200 MW cooling capacity, >50,000 gallons/minute at full capacity) — a notable contrast to the closed-loop liquid approach at Microsoft's Fairwater sites below, and to GB200/GB300's native liquid-cooled rack design (suggesting the site pairs liquid-cooled racks with an air-cooled/chilled-water-loop building plant, though this specific pairing was not explicitly confirmed in the sources fetched).
- **Grid/on-site generation:** MLGW/TVA grid supply (a $24M new substation adds 150 MW of grid capacity) plus **35 on-site gas turbines rated at 420 MW** at Colossus 1, and separate gas-turbine generation at the Southaven, MS site for Colossus 2; Tesla Megapack battery fleet (reported up to 168 units / ~150 MW) for bridging/backup. A system-impact study also flagged **$1.7M of required upgrades to an existing 161 kV transmission line**.
  - Basis: Industry typical throughout (all figures are trade press / integrator blog reporting; xAI has not published these numbers itself). Source: [Wikipedia, "Colossus (data center)"](https://en.wikipedia.org/wiki/Colossus_(data_center)); [Introl, "xAI's Memphis Colossus"](https://introl.com/blog/xai-memphis-colossus-100000-gpu-supercomputer-infrastructure); [SemiAnalysis, "xAI's Colossus 2 – First Gigawatt Datacenter"](https://newsletter.semianalysis.com/p/xais-colossus-2-first-gigawatt-datacenter); [Tom's Hardware, "Musk's Colossus is fully operational with 200,000 GPUs"](https://www.tomshardware.com/tech-industry/artificial-intelligence/musks-colossus-is-fully-operational-with-200-000-gpus-backed-by-tesla-batteries-phase-2-to-consume-300-mw-enough-to-power-300-000-homes); [Data Center Dynamics, "xAI gets 150MW for Colossus"](https://www.datacenterdynamics.com/en/news/xai-colossus-memphis-power-tva/); [Global Energy Monitor, "Colossus 1 power station"](https://www.gem.wiki/Colossus_1_power_station).

#### Update 09/27/2026: the operator's own page, and its name

xAI is now **SpaceXAI**: SpaceX acquired xAI in February 2026 and the company completed its rebrand in July 2026
(Business Insider via Yahoo Finance, "xAI makes its rebrand to SpaceXAI complete with a new logo," 07/06/2026,
https://finance.yahoo.com/technology/ai/articles/xai-makes-rebrand-spacexai-complete-215010760.html). The presets now
use that name.

SpaceXAI's **Mid-South** page, https://www.spacex.com/Mid-South, was checked on 09/27/2026 in a browser (it renders
with JavaScript; several figures sit behind its Colossus II, Water, Power and Air tabs). It is the operator's own
description of its sites, so the site labels each figure as SpaceXAI's claim. What it says:

- **Colossus II:** "GPUs planned 1M+"; "America's largest grid-connected battery pack will provide 3.3 gigawatt hours,
  enough to power Memphis for two hours" (planned, not stated as built). Colossus II "uses closed-loop cooling and
  takes only domestic water."
- **Grid:** $55M for two MLGW substations in Memphis, $35M of it for a 150 MW substation and $20M for a second (the
  page does not say which campus they serve); TVA bills large computing loads under their own rate class.
- **Backup:** "more than 240 batteries so Colossus I can come completely offline during emergencies or peak demand,"
  under a TVA contract. The page never mentions diesel generators.
- **Turbines** (Air tab): "After temporary turbines started on August 1, 2025, …"; "All remaining temporary units run in
  Tennessee and Mississippi with state authorization." Under
  an agreed order with the Mississippi Department of Environmental Quality all must be removed by July 2027, and
  SpaceXAI says it is already taking units offline.
- **Water:** Colossus I's hybrid system uses about 820,000 gallons a day; a $360M recycling plant is designed for up to
  10 million gallons of wastewater a day (about 3.64 billion gallons a year kept in the Memphis Aquifer).
- **Scale:** Colossus I and II together, "over two gigawatts of compute" and more than 2.5 million square feet.

What the model does with it: the Colossus 2 preset models battery backup with no diesel, the 3.3 GWh pack (its power
rating is not published, so the model assumes it can carry the whole campus, about 3 hours at full load), and
air-cooled chillers on a closed loop with no cooling towers and no cooling water counted. The earlier reporting above
("power is substantially self-generated via gas turbines across the state line") is superseded by the operator's own
account of temporary turbines being removed. Colossus 1 keeps the model's generic diesel plant, with a note that
SpaceXAI describes batteries as its backup.

### Microsoft Fairwater Atlanta, GA

- **Location:** Fayetteville, Fayette County, GA (1435 Highway 54 West) — city-level coordinates **~33.45°N, 84.46°W**.
- **MW:** **433 MW** total power capacity reported; first building (of what's described as a multi-building campus) at **173 MW**.
- **Accelerator type:** "Hundreds of thousands" of **NVIDIA GB200 and GB300** GPUs, 72 Blackwell GPUs/rack (i.e. NVL72-class racks), up to **140 kW/rack** and **1,360 kW/row**.
- **GPU count:** Not disclosed as an exact figure — "hundreds of thousands" is the only figure found.
- **Cooling:** Microsoft's **closed-loop liquid cooling** ("Fairwater" design) — no cooling towers, no ongoing evaporative water draw after initial fill; two-story building architecture specifically to shorten cable runs and reduce inter-GPU latency. Went live/online **October 2025**.
- **Grid/on-site generation:** Described in one source as a **"grid-only"** gigawatt-class AI data center (i.e., no significant on-site backup generation comparable to xAI's gas turbines) — **no UPS or generator sets**, per one direct trade-press headline, which is a notable departure from conventional data-center design and should be flagged as unusual/worth double-checking rather than assumed to generalize to all Fairwater sites.
  - Basis: Industry typical (trade press; Microsoft's own blog post confirms the closed-loop cooling design and October 2025 launch but the specific "no UPS/no gensets" claim is from a single DCD headline, not directly corroborated by Microsoft's own material in this session — **flag as needing independent confirmation**). Source: [Data Center Dynamics, "Microsoft launches Atlanta Fairwater AI data center - two stories, no UPS or gen-sets"](https://www.datacenterdynamics.com/en/news/microsoft-launches-atlanta-fairwater-data-center-two-stories-no-ups-or-gen-sets/); [Microsoft, "Infinite scale: The architecture behind the Azure AI superfactory"](https://blogs.microsoft.com/blog/2025/11/12/infinite-scale-the-architecture-behind-the-azure-ai-superfactory/) (Microsoft, official); [measuredai Substack, "Microsoft's Fairwater Atlanta: A Grid-Only Gigawatt AI Data Center"](https://measuredai.substack.com/p/microsoft-fairwater-atlanta-data-center).

### Microsoft Fairwater Wisconsin (Mount Pleasant, WI)

- **Location:** Mount Pleasant, WI (Racine County) — city-level coordinates **~42.71°N, 87.88°W**. Campus spans 315 acres.
- **MW:** **450 MW**, **$3.3B** initial investment (later reporting cites Microsoft's total Wisconsin investment rising to **$7.3B**, suggesting expansion beyond the original 450 MW figure, though a revised MW figure for the expanded scope was not found in this session — **say so**).
- **Accelerator type:** "Hundreds of thousands of NVIDIA Blackwell GPUs and GB200 NVL72 systems," networked via **800G Ethernet** into what Microsoft describes as "one massive AI supercomputer."
- **GPU count:** Not disclosed as an exact figure.
- **Cooling:** Same **closed-loop liquid cooling** design as Atlanta — filled once at construction, no evaporation, no cooling tower, no ongoing water draw (Microsoft's own claim: "as little water annually as a restaurant" — see Section C and heat-carbon item 7 for the caveat that this is a CEO quote, not an audited figure).
- **Grid/on-site generation:** Not found as a specific on-site-generation disclosure in this session (contrast with Atlanta's "grid-only, no gensets" framing above, and with xAI's on-site gas turbines) — presumed conventional utility grid interconnection given no contrary reporting found. **Say so: absence of evidence, not evidence of absence.**
- Opened **June 23, 2026** per one source ("Microsoft Opens Fairwater... Wisconsin AI Campus Runs as One Supercomputer via 800G Ethernet").
  - Basis: Industry typical, Microsoft's own blog for the design/cooling claims. Source: [Data Center Dynamics, "Microsoft increases Wisconsin data center investment to $7.3bn"](https://www.datacenterdynamics.com/en/news/microsoft-increases-wisconsin-data-center-investment-to-73bn-says-fairwater-site-will-be-worlds-most-powerful-data-center/); [TechTimes, "Microsoft Opens Fairwater: Wisconsin AI Campus Runs as One Supercomputer via 800G Ethernet"](https://www.techtimes.com/articles/319205/20260627/microsoft-opens-fairwater-wisconsin-ai-campus-runs-one-supercomputer-via-800g-ethernet.htm); [aidatacenterindex.com, "Microsoft Project Fairwater (Mount Pleasant, Wisconsin)"](https://aidatacenterindex.com/datacenters/microsoft-project-fairwater-wisconsin.html) (lists 3.3 GW, which appears to be a data-aggregator error or refers to a much longer-term end-state not corroborated elsewhere — **flag as an outlier figure, do not use 3.3 GW without independent confirmation; 450 MW is the figure corroborated by multiple sources**).

### Meta Hyperion, Richland Parish, LA

- **Location:** Richland Parish, LA, near Rayville (LA-183 & Wade Rd) — city-level coordinates **~32.47°N, 91.75°W**. Site described as ~5–6 miles long, ~1 mile wide, including both the Meta data-center campus and an adjacent Entergy power-plant site.
- **MW:** Phased buildout — **Phase 1: 1.5 GW by late 2027**; total planned **5 GW by 2030**; total project cost reported at **>$50B**.
- **Accelerator type:** **NVIDIA Blackwell** disclosed; one source additionally describes Meta pursuing a "custom hardware stack" including **AMD Instinct MI450** for at least part of the buildout — i.e., this is reported as a **mixed NVIDIA/AMD site**, not NVIDIA-exclusive, which is a meaningful and non-obvious detail for a scenario tool's accelerator-mix assumptions.
- **GPU count:** Reported target of **1.3+ million GPUs** across the full campus (not phase-specific).
- **Cooling:** Not independently sourced to a specific architecture in this session beyond general large-campus expectations — no Hyperion-specific cooling disclosure (liquid vs. air, closed-loop vs. evaporative) found. **Say so.**
- **Grid/on-site generation:** Entergy Louisiana has filed for **2.23 GW of new natural-gas generation capacity**, including **two gas-fired plants at the Franklin Farms Power Station project** (Holly Ridge) built specifically to serve this site — the power plant is expected online by **end of 2028**, i.e. after Meta's own Phase 1 target (late 2027), implying an interim reliance on existing grid capacity for the first phase. This gas-plant-to-data-center pairing is structurally similar to xAI's Memphis/Southaven arrangement.
  - Basis: Industry typical (Meta's own Data Centers blog confirms the campus and scale claims; the gas-plant timeline and MI450 detail are trade-press reporting, not Meta's own disclosure). Source: [Meta Data Centers, "The largest Meta data center yet brings big impact to Louisiana"](https://datacenters.atmeta.com/richland-parish-data-center/) (Meta, official); [CNBC, "Meta's Louisiana data center investment to reach $50 billion"](https://www.cnbc.com/2026/07/13/meta-louisiana-data-center-investment-reaches-50-billion-amid-ai-push.html); [andrew.ooo, "Meta Hyperion $50B Louisiana Expansion: What It Means"](https://andrew.ooo/answers/meta-hyperion-5gw-louisiana-50-billion-what-it-means-july-2026/) (independent analysis, source of the MI450/mixed-accelerator claim — **flag this specific claim as needing a second corroborating source**); [Louisiana Economic Development, "Meta Commits More Than $50 Billion for North Louisiana Project"](https://www.opportunitylouisiana.gov/news/meta-commits-more-than-50-billion-for-north-louisiana-project-becoming-one-of-the-largest-data-centers-in-history) (state government press release, on the gas-plant timeline).

---

## F. Grid carbon intensity by US state

All state-level figures below are from the same series — **EIA State Electricity Profiles, 2024 data, released November 10, 2025** — fetched directly from each state's own EIA profile page in this session, so units, year, and methodology are consistent across all twelve states. This is a **different EIA product** than the "~0.81 lb/kWh (2023, multi-year generation total)" US-average figure already sourced in `heat-carbon-sources.md` item 11 and the EPA eGRID 823.1 lb/MWh (2022 data) figure also in that file — see the Gaps note below on why the state-profile series and the eGRID/EIA-FAQ series aren't necessarily perfectly reconcilable.

| State | lb CO2/MWh (= lb/1000 kWh) | g CO2/kWh (computed: lb/MWh × 0.4536) | Relevant site(s) |
|---|---|---|---|
| Texas (TX) | 823 | 373 | Stargate Abilene |
| Tennessee (TN) | 804 | 365 | xAI Colossus 1 & 2 |
| Georgia (GA) | 672 | 305 | Microsoft Fairwater Atlanta |
| Wisconsin (WI) | 1,090 | 494 | Microsoft Fairwater Wisconsin |
| Louisiana (LA) | 927 | 420 | Meta Hyperion |
| Virginia (VA) | 631 | 286 | (general reference — "Data Center Alley") |
| Oregon (OR) | 352 | 160 | (general reference — hydro-heavy) |
| Washington (WA) | 249 | 113 | (general reference — hydro-heavy, lowest of the twelve) |
| Arizona (AZ) | 634 | 288 | (general reference) |
| Ohio (OH) | 1,005 | 456 | (general reference) |
| Iowa (IA) | 699 | 317 | (general reference) |
| New York (NY) | 537 | 244 | (general reference) |
| **US average** | **~823** (EPA eGRID, 2022 data) / **~810** (EIA FAQ, 2023 generation-weighted) | **~373** / **~368** | national baseline |

- Basis: Published spec (EIA's own State Electricity Profiles for all twelve states; EPA eGRID and EIA FAQ for the two US-average framings, reused from heat-carbon item 11).
- Source (state rows): [EIA, Texas Electricity Profile 2024](https://www.eia.gov/electricity/state/texas/); [EIA, Tennessee Electricity Profile 2024](https://www.eia.gov/electricity/state/tennessee/); [EIA, Georgia Electricity Profile 2024](https://www.eia.gov/electricity/state/georgia/); [EIA, Wisconsin Electricity Profile 2024](https://www.eia.gov/electricity/state/wisconsin/); [EIA, Louisiana Electricity Profile 2024](https://www.eia.gov/electricity/state/louisiana/); [EIA, Virginia Electricity Profile 2024](https://www.eia.gov/electricity/state/virginia/); [EIA, Oregon Electricity Profile 2024](https://www.eia.gov/electricity/state/oregon/); [EIA, Washington Electricity Profile 2024](https://www.eia.gov/electricity/state/washington/); [EIA, Arizona Electricity Profile 2024](https://www.eia.gov/electricity/state/arizona/); [EIA, Ohio Electricity Profile 2024](https://www.eia.gov/electricity/state/ohio/); [EIA, Iowa Electricity Profile 2024](https://www.eia.gov/electricity/state/iowa/); [EIA, New York Electricity Profile 2024](https://www.eia.gov/electricity/state/newyork/). All fetched directly in this session (Sept 2026), all showing the same "Carbon Dioxide (lbs/MWh)" table entry, all dated to 2024 data / Nov 10, 2025 release.
- Source (US average rows): reused from `heat-carbon-sources.md` item 11 — [EIA FAQ #74](https://www.eia.gov/tools/faqs/faq.php?id=74&t=11); EPA eGRID national output emission rate via secondary aggregator, see that file for the caveat about not having directly fetched EPA's own eGRID summary table.
- **Note on ERCOT-vs-Texas-state figure:** an eGRID subregion-level figure for ERCOT specifically was also found (**738 lb/MWh**), which is meaningfully lower than the Texas *state* figure above (823 lb/MWh) — these are two different geographies (ERCOT subregion vs. the whole state of Texas, which also has SPP and WECC-served areas in its panhandle/far-west) and two different EPA/EIA products. **Do not treat 823 and 738 as measuring the same thing** — Stargate Abilene sits within ERCOT, so 738 lb/MWh (eGRID ERCOT subregion) may actually be the more geographically precise number for that specific site, while 823 lb/MWh (EIA's Texas state profile) is the more precise number if the tool is doing a state-level comparison across all twelve states in the table. **Flag this choice explicitly in the tool rather than picking silently.**

---

## Gaps and conflicts

1. **GB300 dense FP8/FP4-per-GPU figures are unresolved.** NVIDIA's own GB300 NVL72 page, as fetched directly in this session, printed a rack-level FP8 figure (720 PFLOPS) identical to GB200's — which contradicts every secondary source's claim that GB300 delivers meaningfully more compute per GPU than GB200. Re-fetch NVIDIA's downloadable Blackwell Ultra datasheet PDF (linked from that page) before publishing a per-GPU FP8/FP4 number for GB300.
2. **Vera Rubin FP4/FP8 PFLOPS-per-GPU figures conflict across three secondary sources** (50 PFLOPS FP4/GPU vs. ~25 PFLOPS/die implied from rack-level ExaFLOPS vs. 1,260 PFLOPS FP8 for the whole rack from a fourth source) — this is a pre-launch (2H 2026) part with no primary NVIDIA datasheet yet; treat every number in that row as provisional.
3. **NVLink-bandwidth-per-GPU for GB200 has a direct-fetch anomaly.** NVIDIA's own page, fetched directly, printed "3.6 TB/s" per GPU, which conflicts with the widely corroborated 1.8 TB/s NVLink5-per-GPU figure used everywhere else (including power-chain item 15's context). This may be a page-scraping artifact rather than a real NVIDIA figure — re-verify against a screenshot of the live page before trusting either number.
4. **The 800 V DC "83%→92%" efficiency-stage framing is not NVIDIA's own number** and is a much larger claimed gain than NVIDIA's own "up to 5%" headline — these should not both appear on the tool as if they describe the same measurement. Recommend using only NVIDIA's own "up to 5%" published claim and treating the 83%/92% figures as a separate, lower-confidence secondary construction (or dropping them).
5. **No sourced peak/trough ratio exists for an inference traffic diurnal curve.** This is a real gap, not just an uncertain estimate — no hyperscaler has published one, and the shape (found) and the ratio (not found) are two different claims. The tool's diurnal slider will need either a clearly-labeled illustrative default or a proxy from public grid-operator load data (not sourced in this pass).
6. **No dry-cooler capacity-derating-with-ambient-temperature curve was found anywhere in this session.** This is a genuine gap for the "hot-day profile" simulation-clock feature — a named vendor datasheet (Munters, Güntner, BASX, Vertiv) needs to be pulled directly before the tool can show a real derating curve rather than a placeholder.
7. **Texas carbon intensity has two defensible numbers that measure different things** (823 lb/MWh EIA state profile vs. 738 lb/MWh eGRID ERCOT subregion) and the tool needs to pick deliberately, since Stargate Abilene specifically sits in ERCOT while the state-level figure is more appropriate for state-to-state comparison.
8. **Microsoft Fairwater Atlanta's "no UPS or gensets" claim comes from a single trade-press headline**, not Microsoft's own material directly confirming it in the sources fetched this session — an unusual enough claim (most hyperscale sites keep some on-site backup generation) that it deserves independent confirmation before being presented as a settled site fact, rather than folded in alongside the closed-loop-cooling claim that Microsoft's own blog does directly confirm.

Additional smaller gaps also flagged inline above: H100's per-rack density has two legitimate answers (1 vs. 4 servers/rack) depending on which reference design is used; Wisconsin's headline MW figure may be stale given a later, larger investment figure with no matching MW update found; Meta Hyperion's on-site cooling architecture was not sourced at all; and Vera Rubin's per-GPU scale-out NIC speed has an unresolved Gb/s-vs-GB/s unit ambiguity in the one source that states it.
