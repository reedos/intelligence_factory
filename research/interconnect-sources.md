# Watts to Tokens — Interconnect Fact Sheet

Sourced figures for the data layer: scale-up (NVLink in the rack), scale-out (NICs,
switches, optics across the hall), and scale-across (fiber between campuses). Compiled
2026-09-26 from three research passes. Basis labels match `power-chain-sources.md`:
**Published spec** (a vendor or standards body states it), **Industry typical** (trade
press or reference designs agree), **Estimate** (derived or uncertain).

---

## 1. Scale-up

| Item | Value | Basis | Source |
|---|---|---|---|
| NVLink 5 per GPU, GB200 NVL72 | 1.8 TB/s bidirectional | Published spec | [NVIDIA dev blog, GB200 NVL72](https://developer.nvidia.com/blog/nvidia-gb200-nvl72-delivers-trillion-parameter-llm-training-and-real-time-inference/) |
| Links per GPU | 18 (18 × 100 GB/s) | Published spec | same; [NVL72 reference architecture](https://docs.nvidia.com/enterprise-reference-architectures/nvl72-ai-factory/latest/components.html) |
| NVLink Switch chips | 9 trays × 2 = **18** per rack | Published spec | NVL72 reference architecture; SemiAnalysis corroborates |
| Domain total | 130 TB/s (= 72 × 1.8 TB/s) | Published spec | [NVIDIA GB200 NVL72](https://www.nvidia.com/en-us/data-center/gb200-nvl72/) |
| Lane rate | 224 Gb/s PAM4 | Industry typical | NADDOD; IEEE 802.3dj / OIF CEI-224G. Not stated verbatim by NVIDIA |
| NVLink hop latency | not published | — | Next Platform (Aug 2026): "no one has ever confirmed" |
| Passive copper reach at 224G | ≈1 m (active copper ≈3 m) | Industry typical | [IEEE 802.3dj contribution](https://www.ieee802.org/3/dj/public/23_05/li_3dj_09a_2305.pdf); TE OFC 2024 demo |
| Power copper saves vs optics in NVL72 | ≈20 kW per rack | Published spec (keynote quote) | Jensen Huang via [SemiAnalysis](https://newsletter.semianalysis.com/p/nvidias-optical-boogeyman-nvl72-infiniband) |
| Spine links | >5,000 active copper links, ≈2 miles | Spec / Typical | NVIDIA OCP blog; [ServeTheHome](https://www.servethehome.com/this-is-the-nvidia-dgx-gb200-nvl72/) |
| Vera Rubin, NVLink 6 | 3.6 TB/s per GPU, 260 TB/s per rack, 2H 2026 | Published spec | [NVIDIA dev blog, Vera Rubin](https://developer.nvidia.com/blog/nvidia-vera-rubin-pod-seven-chips-five-rack-scale-systems-one-ai-supercomputer/) |
| Rubin Ultra / Kyber NVL576 | 576 dies (144 packages), ≈600 kW, 2H 2027 | Industry typical | [DCD](https://www.datacenterdynamics.com/en/news/nvidias-rubin-ultra-nvl576-rack-expected-to-be-600kw-coming-second-half-of-2027/) |
| UALink 1.0 | Apr 8, 2025; 200G lanes; up to 1,024 accelerators | Industry typical | [SDxCentral](https://www.sdxcentral.com/news/ualink-consortium-releases-200g-10-specification-for-ai-accelerator-interconnects/) (primary PDF not parsed) |
| AMD MI300X | 8 Infinity Fabric links, ≈1 TB/s peak P2P | Published spec | AMD Hot Chips 2024 |
| Google TPU v5p pod | 8,960 chips; ICI 1.2 TB/s bidir per chip | Published spec | [Google Cloud docs](https://docs.cloud.google.com/tpu/docs/v5p) |
| Google Ironwood pod | 9,216 chips; ICI 9.6 Tb/s (≈1.2 TB/s) | Published spec | [Google blog](https://blog.google/products/google-cloud/ironwood-google-tpu-things-to-know/) |
| Palomar OCS | 136 ports, ≈108 W vs ≈3 kW electrical switch | Industry typical | [SemiAnalysis, Apollo](https://newsletter.semianalysis.com/p/google-apollo-the-3-billion-game); [arXiv 2208.10041](https://arxiv.org/abs/2208.10041) |

Notes: "NVL144" is used for both a die count and, later, a different Kyber rack; define it every time. NVLink 7 for Rubin Ultra is trade-press only.

## 2. Scale-out

| Item | Value | Basis | Source |
|---|---|---|---|
| GB300 NVL72 per-GPU scale-out | 800 Gb/s, ConnectX-8 | Published spec | [NVIDIA GB300 NVL72](https://www.nvidia.com/en-us/data-center/gb300-nvl72/) |
| GB200 NVL72 per-GPU scale-out, NVIDIA's reference design | 400 Gb/s, one ConnectX-7 port per GPU (four 400G CX7 per compute tray, one per GPU); ConnectX-8 800G is a documented upgrade, not the shipping default | Published spec | [NVIDIA DSX data center architecture reference](https://docs.nvidia.com/dsx/ncp/software-reference-guide/data-center-architecture) (compute-tray NIC table); [NVIDIA, GB200 NVL72 on CoreWeave](https://blogs.nvidia.com/blog/blackwell-coreweave-gb200-nvl72-instances-cloud/) ("Quantum-2 InfiniBand networking that delivers 400Gb/s bandwidth per GPU") |
| ConnectX-8 host link | PCIe Gen6, 48 lanes with built-in switch | Published spec | [ServeTheHome](https://www.servethehome.com/nvidia-connectx-8-supernic-pcie-gen6-800g-nic-detailed/) |
| Scale-out ports per NVL72 rack | 72 OSFP, one per GPU | Industry typical | SemiAnalysis, Optical Boogeyman |
| Quantum-2 QM9700 | 64 × 400G NDR, 51.2 Tb/s aggregate | Published spec | [NVIDIA Quantum-2 QM9700 specifications](https://docs.nvidia.com/networking/display/qm97x0pub/specifications) |
| Quantum-X800 Q3400 | 144 × 800G, 115.2 Tb/s, 2.9 kW typical (7 kW max, active cables) | Published spec | [NVIDIA XDR switch specs](https://networking-docs.nvidia.com/xdrswitcheshw/specifications) |
| Quantum-X800 Q3200 | 72 × 800G, 57.6 Tb/s, 862 W typical | Published spec | same |
| Spectrum SN5600 | 64 × 800G, 51.2 Tb/s, 940 W typical | Published spec (power) / Typical (ports) | [NVIDIA SN5000 specs](https://networking-docs.nvidia.com/sn5000hw/specifications) |
| Rail-optimized | GPU n in every node goes to leaf n; same-rail traffic crosses one switch | Industry typical | Introl; NVIDIA ibdiagnet uses the term |
| Transceivers per GPU | ≈1 GPU-to-leaf; more per tier above. "2.5–3.5" **not confirmed** | Estimate | SemiAnalysis 100k-H100 piece: ≈0.98 per GPU at the leaf tier |
| NVIDIA 800G DR8 (MMS4X00-NM, 500 m) | 17 W max; 100 m variant 9 W | Published spec | [NVIDIA datasheet](https://docs.nvidia.com/nvidia-mms4x00-nm-800gbps-twin-port-osfp-2x400gb-s-single-mode-dr8-500m-12-07-2023.pdf) |
| 800G 2×FR4 | ≈12–16 W | Industry typical | FS.com, Jabil, NADDOD datasheets |
| 1.6T modules | ≈25–30 W DSP; <15 W linear | Estimate (pre-volume) | FiberMall, AscentOptics |
| LPO saving | ≈40–50% per module | Industry typical | Semtech, SemiEngineering |
| NVIDIA Quantum-X / Spectrum-X Photonics | 3.5× power efficiency, 4× fewer lasers; Quantum-X 144 × 800G; Spectrum-X 2026 | Published spec | [NVIDIA newsroom, Mar 2025](https://nvidianews.nvidia.com/news/nvidia-spectrum-x-co-packaged-optics-networking-switches-ai-factories) |
| Broadcom Davisson (TH6 CPO) | 102.4 Tb/s; 3.5 W per 800G port optics | Published spec | [Broadcom](https://www.broadcom.com/company/news/product-releases/63626) |
| InfiniBand switch hop | <100 ns | Industry typical | not in NVIDIA's current datasheet |
| Fiber propagation | ≈4.9 µs/km (≈5 rule of thumb) | Industry typical | [MapYourTech](https://mapyourtech.com/the-5-microsecond-rule-fiber-propagation-latency-per-kilometer/) |
| BlueField-3 | up to 400 Gb/s; storage, security, front-end offload | Published spec | NVIDIA BlueField-3 datasheet |

## 3. Scale-across

| Item | Value | Basis | Source |
|---|---|---|---|
| NVIDIA Spectrum-XGS | Aug 22, 2025; "nearly doubles" NCCL across sites; CoreWeave first | Published spec | [NVIDIA newsroom](https://nvidianews.nvidia.com/news/nvidia-introduces-spectrum-xgs-ethernet-to-connect-distributed-data-centers-into-giga-scale-ai-super-factories) |
| Microsoft AI WAN | 120,000 miles of new fiber (>25% of its total) | Published spec | [Microsoft Source](https://news.microsoft.com/source/features/ai/from-wisconsin-to-atlanta-microsoft-connects-datacenters-to-build-its-first-ai-superfactory/) |
| Fairwater Atlanta ↔ Wisconsin | ≈700 miles | Industry typical | [Data Center Frontier](https://www.datacenterfrontier.com/machine-learning/article/55330039/microsofts-fairwater-atlanta-and-the-rise-of-the-distributed-ai-supercomputer) |
| Google | trains largest models across campuses and metros | Published spec | [Google Cloud blog](https://cloud.google.com/blog/products/networking/data-center-and-global-networks-built-for-ai-era) |
| DeepMind Decoupled DiLoCo | 12B model across 4 US regions on 2–5 Gb/s | Published spec | [DeepMind, Apr 2026](https://deepmind.google/blog/decoupled-diloco/) |
| Meta multi-site training | not disclosed | — | — |
| 400ZR | 80–120 km amplified; ≈15–20 W | Industry typical | OIF IA via secondary sources |
| 800ZR | 80–120 km; ≈23–25 W (ZR+ ≈26–30 W) | Industry typical | Converge Digest, AscentOptics |
| Ciena WaveLogic 6 Extreme | 1.6 Tb/s per wavelength; C+L ≈2× per fiber | Published spec | [Ciena](https://www.ciena.com/about/newsroom/press-releases/ciena-unveils-wavelogic-6) |
| "50+ Tb/s per fiber pair" | **not verified** | — | — |
| Field trial | 1.6 Tb/s over 1,100 km (Telstra) | Published spec | Ciena press release |
| Amplifier spacing | ≈80–100 km | Industry typical (weak) | rule of thumb |
| US coast to coast, round trip | 43.2 ms at fiber speed | Estimate | [SemiAnalysis, multi-DC training](https://newsletter.semianalysis.com/p/multi-datacenter-training-openais) |

## 4. Network power

- SemiAnalysis, 100k H100 cluster: storage, switches, CPU nodes and optics add ≈10% of IT power on top of GPU servers (Estimate; networking not isolated).
- SemiAnalysis networking model, GB300 NVL72 on InfiniBand: the back-end fabric is ≈86% of networking power (Estimate; via secondary summary).
- Page estimate, this campus: two tiers of 144-port switches ≈900 × 2.9 kW ≈ 2.6 MW; ≈130k modules at ≈17 W ≈ 2.2 MW (Estimate, built from the specs above).

## Gaps and conflicts

- **36 vs 18 NVLink Switch chips:** 18 is correct (9 trays × 2).
- **GB200 NIC generation:** blended; say "400G at launch, 800G on later builds and on GB300".
- **Transceivers per GPU, "2.5–3.5":** not found in accessible SemiAnalysis pieces.
- **NVLink hop latency** and **InfiniBand hop latency in NVIDIA docs:** not published.
- **WaveLogic 6 "50+ Tb/s per fiber pair":** unverified; the page uses only 1.6 Tb/s per wavelength and "about 2× with C+L".
- OIF 400ZR / 800ZR PDFs and Cisco's 800ZR datasheet could not be read directly; their figures come from secondary sources.
