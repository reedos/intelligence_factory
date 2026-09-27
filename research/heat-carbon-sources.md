# Watts to Tokens — Heat, Parallelism & Token-Cost Fact Sheet

Sourced figures for three new sections of the "Watts to Tokens" 3D explainer: the heat
layer (chip to campus), how models are split across GB200 NVL72 hardware (parallelism),
and an honest per-token cost (utilization, carbon, water, training share).

Basis labels, matching `research/power-chain-sources.md`: **Published spec** (vendor/standards
body states it directly), **Industry typical** (trade press, reference designs, or multiple
independent sources agree), **Estimate** (derived or uncertain — no single authoritative
number exists).

---

## 1. Heat

### 1. Blackwell GPU / HBM3e temperature limits

- **Value:** No NVIDIA datasheet stating a Blackwell Tj-max or throttle point was found. Generic
  NVIDIA data-center GPU throttling is commonly described in secondary sources as beginning
  around **83–90°C** core/junction temperature, and one cooling-vendor technical article frames
  a junction limit of **85°C** when discussing GB200/B200 thermal headroom at different coolant
  supply temperatures (e.g., "junction temperature approaches ~43°C — well below the 85°C
  junction limit" at 18°C supply). Neither NVIDIA's own GB200 NVL72 page nor its DGX GB200 user
  guide states a Tj-max number directly.
- **Basis:** Estimate (the 85°C figure is a secondary cooling-engineering source's framing, not
  a quoted NVIDIA spec; the 83–90°C throttle range is generic NVIDIA GPU behavior, not
  Blackwell-specific).
- **Source:** [Alliance Chemical, "GPU Thermal Density & Coolant Flow Specs: B200, GB200, MI300 (2026)"](https://alliancechemical.com/blogs/articles/gpu-thermal-density-b200-gb200-coolant-flow-specs) (Alliance Chemical, trade/vendor blog, 2026 — no NVIDIA citation for the 85°C figure); general 83–90°C throttle range corroborated across consumer/enthusiast GPU-temperature guides (e.g., SunbeamTech, mypcbottleneck.com), which are not data-center-specific or Blackwell-specific.
- **HBM3e:** Micron's HBM3e product brief states an operating temperature range of **0°C ≤ T_OPER ≤ +105°C**.
  - **Basis:** Published spec (vendor datasheet).
  - **Source:** [Micron, "HBM3E Product Brief"](https://assets.micron.com/adobe/assets/urn:aaid:aem:b710d8f2-7f66-44c1-a234-456e2b986347/original/as/hbm3e-product-brief.pdf) (Micron, current).
  - **Note:** This is Micron's own HBM3e part, not NVIDIA's Samsung/SK hynix-sourced HBM3e as used in Blackwell specifically, but the 105°C ceiling is standard across HBM3e vendors per JEDEC JESD238-family packaging. No JEDEC document itself (behind a paywall) was directly read; treat the JEDEC-level number as unconfirmed at the standards-body level, Published spec only for Micron's own part.
- **Say so:** No source found for a typical *operating* die temperature specifically "under liquid cooling" for Blackwell as a single number — it depends on coolant supply temperature (see item 3) and workload; the 43–53°C junction range quoted above is the closest found, and it is itself a secondary source's illustrative calculation, not a measured fleet average.

### 2. Heat flux at the die; Blackwell die area

- **Die area:** Blackwell (B100/B200/GB200) is two reticle-limited dies per package, each
  commonly cited around **~800 mm²** (close to TSMC's ~858 mm² reticle limit on the 4NP
  process), joined by NV-HBI. NVIDIA has not published an exact die-area figure; the ~800 mm²
  number comes from trade-press/analyst reconstruction.
  - **Basis:** Industry typical (converging trade-press estimate, not an NVIDIA-published number).
  - **Source:** [SemiWiki, "Nvidia introduces Blackwell (800mm² reticle limit N4P dies)"](https://semiwiki.com/forum/threads/nvidia-introduces-blackwell-800mm2-reticle-limit-n4p-dies.19856/) (SemiWiki analyst forum); [WCCFTech, "NVIDIA Blackwell GPU Architecture Official: 208 Billion Transistors..."](https://wccftech.com/nvidia-blackwell-gpu-architecture-official-208-billion-transistors-5x-ai-performance-192-gb-hbm3e-memory/) (WCCFTech, citing NVIDIA architecture material for the 208B transistor / two-die figure, not the mm² figure itself).
- **Heat flux — average, my own calculation:** Two ~800 mm² dies = **~1,600 mm² (16 cm²)** total
  die area per package. At the commonly cited **1,200 W** per-GPU TDP in an NVL72 rack (see
  `power-chain-sources.md` item 18), average package-level heat flux is **1,200 W ÷ 16 cm² ≈
  75 W/cm²**.
  - **Basis:** Estimate — this is my own division of two trade-press numbers (die area, TDP),
    not a vendor-stated flux figure.
- **Heat flux — figures quoted in cooling trade press:** Several cooling-industry sources quote
  **"500–600 W/cm²"** for B200/GB200, and describe two-phase cold-plate technology as capable
  of handling flux **"over 500 W/cm²"** or (two-phase immersion) up to **1,000 W/cm²**.
  - **Basis:** Industry typical, but likely **not the same quantity** as the average-die-flux
    estimate above.
  - **Source:** [Alliance Chemical, "GPU Thermal Density & Coolant Flow Specs"](https://alliancechemical.com/blogs/articles/gpu-thermal-density-b200-gb200-coolant-flow-specs) (2026); general two-phase cold-plate capability figures from [ScienceDirect, "Microchannel heat sinks for cold plate liquid cooling in data centers"](https://www.sciencedirect.com/science/article/abs/pii/S1364032126000286) (academic review, 2026) and general cooling-industry coverage summarized via search (exact publisher not independently re-fetched for the 1,000 W/cm² immersion figure — treat that one number as **not directly sourced**, say so).
  - **Note — real conflict, not reconciled:** The 500–600 W/cm² figures almost certainly describe **peak local hotspot flux** that a cold plate is engineered to remove (a design/capability spec for the cooling hardware), not the **average flux across the full package** implied by dividing total TDP by total die area (~75 W/cm²). Modern GPU dies are known to have highly non-uniform power density (compute cores vs. cache/IO regions), so a hotspot running at 500+ W/cm² over a small area is consistent with a ~75 W/cm² package average — but no source reconciles the two numbers directly for Blackwell specifically. Present both on the explainer as different things: "chip-average" vs. "hotspot the cooling has to handle."

### 3. GB200 NVL72 liquid cooling: inlet temperature, rise, flow rate

- **Coolant inlet temperature range:** Multiple ranges are reported depending on design vintage:
  - **18–32°C** framed as "the coolant supply temperature range" for B200/GB200 by one cooling-industry source.
  - NVIDIA's **ACS (Accelerated Compute System) reference design** reportedly specifies cold-plate inlet **32–45°C**.
  - NVIDIA's newer **"warm water" MGX spec** (applies to GB200, GB300, and Vera Rubin racks) is reported at **45°C (113°F)** inlet, explicitly framed as chiller-free ("dry coolers can handle the load outside of maybe 1% of the year... in some climates").
  - **Basis:** Industry typical for the 18–32°C and 32–45°C figures (secondary trade/vendor-blog sources, not an NVIDIA datasheet directly fetched); the 45°C warm-water figure is closer to Published spec, sourced to a piece that directly quotes NVIDIA's own MGX/rack cooling messaging.
  - **Source:** [Alliance Chemical, "GPU Thermal Density & Coolant Flow Specs"](https://alliancechemical.com/blogs/articles/gpu-thermal-density-b200-gb200-coolant-flow-specs) (2026, for 18–32°C and the ACS 32–45°C figure); [Supercomputing.news, "NVIDIA 45°C Warm-Water Cooling Spec"](https://www.supercomputing.news/emerging/nvidia-45c-warm-water-cooling-mgx-data-center) (2026, for the 45°C MGX figure and the "45°C in → ~55°C out" rise, and the ASHRAE W45 cross-reference: "W45 class covers facility water supplied at up to 45°C").
  - **Note — real conflict:** These are not the same design point. 18–32°C and 45°C describe different hardware generations/reference designs (older/cooler-water GB200 deployments vs. NVIDIA's newest warm-water MGX push covering GB200/GB300/Vera Rubin). Do not present a single "the" inlet temperature on the explainer — present it as a range across deployed designs, with 45°C flagged as NVIDIA's current forward-looking chiller-free target.
- **Temperature rise across the rack:** Commonly cited **~10°C** rise (inlet to outlet) at the
  cold plate for a ~120–130 kW rack; the 45°C warm-water design is reported with coolant
  "entering at 45°C, exiting at roughly 55°C" (a similar ~10°C rise), with SemiAnalysis modeling
  return temperatures "approaching 65°C" in some future (Vera Rubin-era) configurations.
  - **Basis:** Industry typical.
  - **Source:** Same as above (Alliance Chemical; Supercomputing.news, citing SemiAnalysis modeling).
- **Flow rate:** Reported figures vary sharply by source:
  - **~170–195 L/min per rack** at a 10°C rise, for a 120–130 kW GB200 NVL72 rack (worked back from cooling capacity, "about 1.5 LPM per kW").
  - **30–40 L/min per rack "at full load"**, attributed to the NVIDIA ACS reference design.
  - A separate figure of **~80 L/min** and another of "up to 130 L/min" also appear in the same search results without clear attribution to a specific rack config.
  - **Basis:** Industry typical / Estimate — none of these were traced to an NVIDIA or OEM datasheet page directly fetched in this session.
  - **Source:** [Alliance Chemical, "GPU Thermal Density & Coolant Flow Specs"](https://alliancechemical.com/blogs/articles/gpu-thermal-density-b200-gb200-coolant-flow-specs) (2026).
  - **Note — real, unresolved conflict:** The ~170–195 L/min figure and the ~30–40 L/min "ACS reference design" figure differ by roughly 5x. This likely reflects different measurement points (total facility-side flow across a whole rack's manifold vs. a single reference design's per-loop flow, or a difference between the 120 kW nominal and 132–192 kW EDPp power draw used in each calc), but no source reconciles them. Flag both numbers and the discrepancy on the explainer rather than picking one.

### 4. CDU approach temperature; dry cooler approach; W32/W40/W45 facility pairs

- **CDU approach (facility water to rack/technology loop):** No single sourced number found.
  Multiple CDU vendor pages (Eaton, Vertiv, nVent, Supermicro, Modine) describe *what* a CDU
  does — isolate facility water from the IT coolant loop via a heat exchanger, and keep the
  IT-side supply above the data-hall dew point to prevent condensation — but none of the
  vendor pages fetched in this session states a numeric "approach temperature" (e.g., "2–5°C")
  for their CDU's heat exchanger.
  - **Basis:** Estimate for any single number — **say so, not found.**
  - **Source:** [Vertiv, "Understanding coolant distribution units (CDUs) for liquid cooling"](https://www.vertiv.com/en-us/insights/articles/educational-articles/understanding-coolant-distribution-units-cdus-for-liquid-cooling/); [Eaton, CDU product page](https://www.eaton.com/us/en-us/catalog/thermal-management-solutions/coolant-distribution-unit-cdu.html); [nVent, CDU page](https://www.nvent.com/en-us/data-solutions/coolant-distribution-unit) (all current vendor pages, general design-principle descriptions only).
- **Dry cooler approach to outdoor air:** A patent filing (not a vendor spec or standards
  document) gives a worked example: entering water at 18°C (64°F), exiting air at 25°C (77°F),
  for an approach temperature of ~7°C (13°F), noting "wider or narrower approach ... selected
  based on economic considerations." Dry coolers are also generally described as effective
  "in regions where outside temperatures don't exceed about 80°F (27°C)."
  - **Basis:** Estimate (a single patent-document worked example, not an industry-standard number; presented as illustrative, not authoritative).
  - **Source:** US patent filing on data-center climate control (accessed via [USPTO image server, "Climate control system for data centers"](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/8583289)) — treat as a single engineering example, not a citable industry standard.
- **W32/W40/W45 facility supply/return pairs:** Per ASHRAE TC 9.9's water-temperature classes
  (see `power-chain-sources.md` item 7 for the class definitions themselves), a **W45** system
  is reported (via the NVIDIA-focused 45°C piece above) at **45°C supply / ~55–65°C return**.
  No single source gave matched supply/return pairs for W32 or W40 specifically.
  - **Basis:** Industry typical for W45 (from the same Supercomputing.news piece above); **not found** for W32/W40 as matched pairs — say so.

### 5. Air-side heat in the rack

- **HPE's own figure (confirmed):** **115 kW liquid-cooled / 17 kW air-cooled** per GB200 NVL72
  rack (132 kW total), i.e., **~87% liquid / ~13% air**.
  - **Basis:** Published spec (HPE's own QuickSpecs / product page, consistent with
    `power-chain-sources.md` item 13, which already cites this).
  - **Source:** [HPE, "NVIDIA GB200 NVL72 by HPE" product page](https://buy.hpe.com/us/en/compute/rack-scale-system/nvidia-nvl-system/nvidia-gb200-nvl72-by-hpe/p/1014890104) (HPE, current); [HPE QuickSpecs PDF](https://www.hpe.com/psnow/doc/a50009224enw).
- **Which parts are air-cooled:** A SemiAnalysis hardware-teardown newsletter states that while
  the GPU/CPU compute trays are liquid-cooled, the **SSDs, the M.2 riser board, and the NICs**
  are air-cooled, using conventional 40mm fans for these "low-power peripherals." Power shelves
  are not explicitly called out as liquid- or air-cooled in the sources fetched, and optics'
  cooling method (air vs. liquid) was not stated either way.
  - **Basis:** Industry typical (SemiAnalysis component-level teardown), with a gap: power-shelf
    and optics cooling method **not confirmed** — say so.
  - **Source:** [SemiAnalysis, "GB200 Hardware Architecture and Component Supply Chain & BOM"](https://newsletter.semianalysis.com/p/gb200-hardware-architecture-and-component) (SemiAnalysis, 2026).
- **Hot-aisle air temperature:** Not sourced to a specific number in this session for GB200 NVL72
  specifically — say so; general data-center hot-aisle targets (commonly 30–35°C+ in
  high-density air-cooled designs) were not independently verified against a GB200-specific
  source and are omitted rather than guessed.

### 6. Heat reuse examples

- **Meta, Odense, Denmark:** Figures vary by source/date of report:
  - "165,000 MWh/year... to about 9,000 households" (one 2026 report).
  - "up to 165,000 MWh of energy a year to warm 11,000 homes and businesses" (Munters case study).
  - "recover 215,000 MWh... redistribute... to more than 12,000 homes" (a later/expanded-scope figure).
  - Heat pumps (ammonia-based, per one source) raise recovered heat to **70–75°C** for the
    district-heating network.
  - **Basis:** Industry typical (trade press; figures likely reflect different points in time as
    the facility/heat-export agreement scaled up — not necessarily contradictory, but **not
    reconciled to a single current number**).
  - **Source:** [The Asia Business Daily, "Data Center Heats 9,000 Homes..."](https://www.asiae.co.kr/en/article/2026082014520590931) (2026); [Munters, "Harnessing heat from Odense data center for reuse in district heating"](https://www.munters.com/en-us/knowledge-bank/case-studies/casestudy-13666/) (Munters case study); [ScienceBlog.com coverage of Fjernvarme Fyn's 2025 statement](https://scienceblog.com/m-a-data-center-in-denmark-gives-away-heat-that-data-centers-often-waste-it-runs-water-from-the-citys-heating-network-through-its-cooling-units-and-into-heat-pumps-that-raise-it-enou/) ("in practice supplying surplus heat equivalent to about 11,000 households," per Fjernvarme Fyn, 2025).
- **Microsoft / Fortum, Finland (Kirkkonummi + Espoo/Hepokorpi):** Two heat-pump plants (Kolabacken and Hepokorpi) with **40 air-to-water + 72 water-to-water heat pumps**, producing up to **180 MW district heating**, 200 MW electric boiler capacity, and 800 MWh thermal storage. Waste heat is projected to cover **~40% of the 2 TWh/year district-heating demand** for ~250,000 users in the area; ~75% of the data centers' waste heat is expected to be captured for district heating (seasonal, low in summer).
  - **Basis:** Published spec (Fortum's own project figures).
  - **Source:** [Fortum, "Fortum has started heat production at two large data centre sites in Finland"](https://www.fortum.com/en/media/2026/05/fortum-has-started-heat-production-two-large-data-centre-sites-finland) (Fortum, May 2026); [Data Center Dynamics coverage](https://www.datacenterdynamics.com/en/news/fortum-starts-operations-at-two-heat-pump-plants-tied-to-microsoft-district-heating-scheme/) (DCD, 2026).
- **Equinix, Paris (PA10):** Exports surplus heat free of charge for **15 years** to the Plaine
  Saulnier development zone and the Olympic Aquatic Centre (2024 Paris Olympics venue). A
  separate, generic Equinix framing: **a 20 MW data center generates enough heat per year to
  heat 100 Olympic-size pools for a month, or 4,500 homes for a year** (an illustrative
  company-stated ratio, not PA10-specific).
  - **Basis:** Published spec (Equinix's own project/press description) for the PA10 project terms; Estimate/illustrative for the 20 MW → 4,500 homes ratio.
  - **Source:** [Equinix Newsroom, "Repurposing Heat for Community Use..."](https://newsroom.equinix.com/2023-07-13-Repurposing-Heat-for-Community-Use-Heat-Export-Project-Powered-by-Equinix-Sets-Stage-for-Further-Cooperation) (Equinix, 2023); [Equinix Blog, "What Is Data Center Heat Export and How Does it Work?"](https://blog.equinix.com/blog/2024/06/05/what-is-data-center-heat-export-and-how-does-it-work/) (Equinix, 2024).
- **Stockholm Data Parks:** A city-run open-heat-market platform (Stockholm Exergi + City of
  Stockholm + Ellevio + Stokab), connecting **30+ data centers across 16 providers**; data
  centers sell waste heat under standardized, temperature-indexed contracts (reported at
  **SEK 2M/MW/year**, i.e., data-center operators invest in heat pumps, Stockholm Exergi invests
  in pipe connections). Fully expanded, projected to heat the equivalent of **35,000 apartments**,
  with a long-term goal of **10% of the city's heating demand** from data-center waste heat.
  - **Basis:** Published spec (Stockholm Data Parks / Stockholm Exergi's own program figures).
  - **Source:** [Stockholm Data Parks](https://stockholmdataparks.com/) (current program site); [Eurelectric, "Stockholm Exergi: Data Parks shows the potential for scaling the reuse of waste heat..."](https://www.eurelectric.org/stories/stockholm-exergi-data-parks-shows-the-potential-for-scaling-the-reuse-of-waste-heat-when-it-becomes-a-tradable-product/) (Eurelectric).
  - **Note:** No single temperature figure (supply/return to the district network) was found for the Stockholm program specifically — say so.

### 7. Water: WUE, Microsoft's zero-water claim, indirect water in electricity generation

- **WUE ranges (liquid cooling with dry coolers vs. evaporative towers):** Dry-cooler /
  adiabatic-assist liquid cooling reported at **0.15–0.17 L/kWh**; LBNL's 2024 US Data Center
  Energy Usage Report projects fleet-average WUE reaching **0.45–0.48 L/kWh** in some future
  scenarios (a higher number, reflecting the broader current fleet, much of which still uses
  evaporative cooling); Meta reported (per a secondary source, not confirmed against Meta's own
  report) fleet WUE around **0.20 L/kWh** for its newest hyperscale campuses.
  - **Basis:** Industry typical. (Same figures and same caveats as `power-chain-sources.md` item 7 — reused here rather than re-derived; that file recommends re-verifying the LBNL number against the LBNL PDF directly before publishing.)
  - **Source:** [Introl, "Water Usage Efficiency: AI Data Center Cooling Without Crisis"](https://introl.com/blog/water-usage-efficiency-wue-ai-data-center-cooling-guide-2025) (Introl, 2025).
- **Microsoft's "zero water" closed-loop claim (Fairwater):** Microsoft's Fairwater AI campus
  (Mount Pleasant, WI; a second pilot in Phoenix, AZ) uses a **closed-loop, chiller-based
  liquid-cooling system**, filled once during construction and continuously recirculated —
  described as consuming effectively **zero water** for ongoing cooling operations after the
  initial fill. CEO Satya Nadella stated (Microsoft Build 2026) that the newest-generation AI
  data centers use "as little water annually as a restaurant." All Microsoft data centers
  designed from **August 2024** onward use this design; the approach is expected online from
  **late 2027**.
  - **Basis:** Published spec (Microsoft's own blog post and CEO statement) for the design and timeline; the "restaurant"-level annual-consumption comparison is a qualitative CEO claim, not an audited figure — treat that comparison as **Estimate/marketing framing**, not a measured number.
  - **Source:** [Microsoft Cloud Blog, "Sustainable by design: Next-generation datacenters consume zero water for cooling"](https://www.microsoft.com/en-us/microsoft-cloud/blog/2024/12/09/sustainable-by-design-next-generation-datacenters-consume-zero-water-for-cooling/) (Microsoft, Dec 2024); [Tom's Hardware coverage of the Build 2026 restaurant-water claim](https://www.tomshardware.com/tech-industry/big-tech/microsoft-ceo-says-new-ai-data-centers-use-as-little-water-annually-as-a-restaurant-closed-loop-cooling-system-aims-to-slash-consumption-from-millions-of-gallons-as-ai-infrastructure-faces-mounting-environmental-scrutiny) (Tom's Hardware, 2026).
- **Google/Meta WUE (own numbers):** Google's own current WUE metric per data center was **not**
  found stated as a single fleet-wide number in the sources fetched in this session (Google's
  public data-centers "operating sustainably" and "efficiency" pages were checked for PUE, not a
  headline WUE figure); Google did report **30.7 billion liters** of water used with **~88%**
  from freshwater sources, and **87%** of freshwater withdrawal from low/medium water-risk
  sources (2025 Environmental Report figures, per secondary trade coverage) — these are
  absolute/risk figures, not a WUE ratio.
  - **Basis:** Estimate — a clean, Published-spec Google WUE ratio was **not found**; say so, and do not put a single Google WUE number on the explainer without a direct pull from Google's Environmental Report PDF.
  - **Source:** [Data Centre Magazine, "What Google's Environmental Report Says About Data Centres"](https://datacentremagazine.com/news/google-environmental-report-2025-the-data-centre-impact) (secondary trade coverage of Google's 2025 report).
  - **Meta:** Not independently re-verified in this session beyond the Introl secondary citation above — say so.
- **Indirect water in US electricity generation:** NREL's Macknick et al. work (the standard
  reference) gives **~0.47 gal/kWh (≈1.8 L/kWh)** of freshwater *evaporated* (consumed, not
  withdrawn) for a "typical" US thermoelectric power plant.
  - **Basis:** Published spec (peer-reviewed/NREL technical-report figure, widely used as the standard reference value).
  - **Source:** [NREL, "Consumptive Water Use for U.S. Power Production"](https://docs.nrel.gov/docs/fy04osti/33905.pdf) (NREL, Macknick et al.); [NREL, "A review of operational water consumption and withdrawal factors for electricity generating technologies"](https://docs.nrel.gov/docs/fy11osti/50900.pdf) (NREL, Macknick, Newmark, Heath, Hallett).
  - **Note:** This figure varies enormously by generation technology (thermoelectric steam-cycle vs. combined-cycle gas vs. wind/solar, which consume far less) and by region/cooling-tech mix; the ~1.8 L/kWh number is a "typical thermoelectric" figure, not a single US-grid-average across all generation types — flag this nuance if using the number for a specific region's fuel mix.

---

## 2. Parallelism

### 8. Tensor, pipeline, data (FSDP/ZeRO), and expert parallelism — definitions and NVLink rationale

- **Tensor parallelism (TP):** Splits individual large-layer weight matrices (attention, MLP)
  across GPUs — "intra-layer" model parallelism. Requires an all-reduce (or reduce-scatter/
  all-gather) after each split operation, i.e., **communication every layer** (multiple times
  per transformer block), which is why it needs the highest bandwidth/lowest latency link
  available.
  - **Basis:** Published spec (originates in the Megatron-LM paper).
  - **Source:** Shoeybi, Patwary, Puri, LeGresley, Casper, Catanzaro, "Megatron-LM: Training Multi-Billion Parameter Language Models Using Model Parallelism" (2019), as summarized by [NVIDIA NeMo Framework docs, "Parallelisms"](https://docs.nvidia.com/nemo-framework/user-guide/24.12/nemotoolkit/features/parallelisms.html) (NVIDIA, current) and the underlying [Megatron-LM GitHub repo](https://github.com/NVIDIA/Megatron-LM).
- **Pipeline parallelism (PP):** Splits the model "vertically" by assigning consecutive layers
  (stages) to different GPUs/nodes; communication is **point-to-point activations passed
  between stages**, roughly once per micro-batch per stage boundary — much less frequent and
  lower-bandwidth than TP's per-layer traffic, which is why PP can cross node/network
  boundaries more cheaply than TP.
  - **Basis:** Published spec (Megatron-LM / GPipe-lineage definition, corroborated by NVIDIA NeMo docs).
  - **Source:** Same as above.
- **Data parallelism / FSDP / ZeRO:** Each worker holds a shard of the model, and DeepSpeed's
  ZeRO shows progressively more sharding across three stages — **ZeRO-1** shards optimizer
  states, **ZeRO-2** additionally shards gradients, **ZeRO-3** additionally shards parameters
  themselves. PyTorch's **FSDP** (Fully Sharded Data Parallel) is directly inspired by ZeRO and
  reports comparable performance. Communication (all-gather of parameters, reduce-scatter of
  gradients) happens **once per training step** (per forward/backward pass), the least frequent
  of the three core parallelism types, consistent with DP/FSDP being the "outermost" dimension
  that can cross whole data-center-scale networks.
  - **Basis:** Published spec (Microsoft DeepSpeed/ZeRO paper and documentation; Meta/PyTorch FSDP documentation).
  - **Source:** [Microsoft Research, "DeepSpeed: Extreme-scale model training for everyone"](https://www.microsoft.com/en-us/research/blog/deepspeed-extreme-scale-model-training-for-everyone/) (Microsoft Research blog); [Hugging Face, "FSDP vs DeepSpeed"](https://huggingface.co/docs/accelerate/en/concept_guides/fsdp_and_deepspeed) (Hugging Face docs, summarizing both).
- **Expert parallelism (EP):** For mixture-of-experts (MoE) models, different experts (separate
  FFN sub-networks) live on different GPUs; each token is routed (via a learned gate) to a
  small subset of experts, requiring an **all-to-all** exchange of tokens/activations across the
  GPUs holding the selected experts. Because this all-to-all happens **per MoE layer, per
  forward/backward pass** (not just once per step), it — like TP — benefits enormously from
  being confined to a high-bandwidth, low-latency domain (i.e., within NVLink) rather than
  crossing the data-center network fabric.
  - **Basis:** Published spec (concept standard in MoE literature; NVIDIA's own framing of "wide expert parallelism" ties directly to this).
  - **Source:** [NVIDIA Glossary, "What Is Mixture of Experts (MoE) and How It Works?"](https://www.nvidia.com/en-us/glossary/mixture-of-experts/) (NVIDIA); [NVIDIA Developer Blog, "How NVIDIA GB200 NVL72 and NVIDIA Dynamo Boost Inference Performance for MoE Models"](https://developer.nvidia.com/blog/how-nvidia-gb200-nvl72-and-nvidia-dynamo-boost-inference-performance-for-moe-models) (NVIDIA, 2026).
- **NVIDIA's NVL72 / MoE claims:** NVIDIA states GB200 NVL72 delivers a **"10x inference
  performance leap"** across a range of MoE models (including **DeepSeek-R1**, Kimi K2 Thinking,
  Mistral Large 3) versus H200, attributing this largely to **"wide expert parallelism"** —
  spreading a small number of experts per GPU across all 72 GPUs in the NVLink domain to
  balance compute and free HBM for KV cache — reporting **1.8x per-GPU throughput gains** from
  wide-EP specifically in the decode phase. NVIDIA frames NVLink's all-to-all bandwidth as
  **"36 times faster than current Ethernet standards"** for this purpose. **NVIDIA Dynamo** is
  described as the disaggregated-serving software layer (see item 10) that orchestrates this at
  scale.
  - **Basis:** Published spec (NVIDIA's own blog and benchmark claims); the underlying benchmark
    numbers (10x, 1.8x) trace to NVIDIA/SemiAnalysis InferenceMAX-style benchmarks, so treat the
    specific multipliers as Industry typical (benchmark-dependent) rather than a universal
    constant.
  - **Source:** [NVIDIA Developer Blog, "How NVIDIA GB200 NVL72 and NVIDIA Dynamo Boost Inference Performance for MoE Models"](https://developer.nvidia.com/blog/how-nvidia-gb200-nvl72-and-nvidia-dynamo-boost-inference-performance-for-moe-models) (NVIDIA, 2026); [Introl, "Mixture of Experts Infrastructure"](https://introl.com/blog/mixture-of-experts-moe-infrastructure-scaling-sparse-models-guide) (Introl, secondary summary); [LMSYS Org, "Deploying DeepSeek on GB300 NVL72: Big Wins in Long-Context Inference"](https://www.lmsys.org/blog/2026-02-19-gb300-longctx/) (LMSYS, 2026, independent benchmark write-up).

### 9. Disclosed parallelism layouts for large training runs

- **Llama 3 405B (Meta):** The Llama 3 paper's own Table 4 states a **4D parallelism** scheme
  ordered **[TP, CP, PP, DP]** (innermost to outermost). At the **16,384-GPU** scale training at
  **128K sequence length**: **TP = 8, CP = 16, PP = 16, DP = 8** (8 × 16 × 16 × 8 = 16,384). The
  paper states explicitly that **"the innermost parallelism requires the highest network
  bandwidth and lowest latency, and hence is usually constrained to within the same server"** —
  i.e., TP is deliberately placed innermost (within the 8-GPU NVLink domain of an H100 server)
  precisely because it is the most communication-hungry dimension.
  - **Basis:** Published spec (Meta's own paper).
  - **Source:** Touvron et al. (Meta AI), ["The Llama 3 Herd of Models"](https://arxiv.org/pdf/2407.21783) (arXiv:2407.21783, 2024), as rendered at [ar5iv](https://ar5iv.labs.arxiv.org/html/2407.21783).
  - **Note:** A separate academic paper (ISCA 2025, "Scaling Llama 3 Training with Efficient Parallelism Strategies") describes different smaller-scale example configs (e.g., 512 H100s at TP=8/PP=9/CP=2/DP=4, or 448 B200s at TP=4/PP=8/CP=2/DP=7) for other stages/ablations of the same training campaign — these are **not** the flagship 16K-GPU/405B configuration and should not be conflated with the paper's headline TP8/CP16/PP16/DP8 figure.
- **DeepSeek-V3 (DeepSeek-AI):** The technical report states DeepSeek-V3 was trained using
  **no tensor parallelism** (deliberately avoided as "costly"), **16-way pipeline parallelism**
  (via their custom **DualPipe** algorithm, engineered to minimize pipeline bubbles and overlap
  communication with computation), **64-way expert parallelism spanning 8 nodes**, and
  **ZeRO-1 data parallelism**.
  - **Basis:** Published spec (DeepSeek-AI's own technical report).
  - **Source:** DeepSeek-AI, ["DeepSeek-V3 Technical Report"](https://arxiv.org/pdf/2412.19437) (arXiv:2412.19437, Dec 2024).
  - **Note:** This is a deliberate contrast with Llama 3's approach — Meta uses substantial TP (degree 8) because it trained on NVLink-rich H100 nodes at large scale; DeepSeek avoided TP specifically as a hardware-aware cost optimization (their nodes/interconnect were more export-constrained), instead investing engineering effort in PP (DualPipe) and EP scheduling to hide communication.

### 10. Inference: prefill vs. decode, KV cache, disaggregation, batching

- **Prefill vs. decode:** Prefill (processing the input prompt) is **compute-bound** — it
  processes many tokens in parallel through the model, saturating GPU FLOPs. Decode (generating
  output tokens one at a time, autoregressively) is **memory-bandwidth-bound** — each step must
  reload the full set of model weights (and the growing KV cache) from HBM for a comparatively
  tiny amount of compute per token, so decode throughput is limited by HBM bandwidth, not FLOPs.
  - **Basis:** Industry typical / Published spec (a standard, widely stated systems-architecture
    fact in LLM-serving literature; not attributed to one single vendor).
  - **Source:** [BentoML, "Prefill-decode disaggregation"](https://bentoml.com/llm/inference-optimization/prefill-decode-disaggregation) (BentoML LLM Inference Handbook); corroborated across multiple 2025–2026 arXiv papers on disaggregated serving, e.g. [arXiv 2510.08544, "SPAD: Specialized Prefill and Decode Hardware for Disaggregated LLM Inference"](https://arxiv.org/pdf/2510.08544).
- **KV cache in HBM:** The key/value cache generated during prefill (and extended during decode)
  is stored in GPU HBM; it grows continuously with sequence length and batch size, and for
  disaggregated architectures must be transferred from prefill workers to decode workers —
  a nontrivial data-movement cost that can offset the benefits of disaggregation if not managed
  carefully.
  - **Basis:** Industry typical.
  - **Source:** Same as above; also [Medium, "Why LLM Inference Is Disaggregating Its Memory"](https://medium.com/@sseshadri/why-llm-inference-is-disaggregating-its-memory-2d9d299d931a) (secondary summary).
- **Disaggregated prefill/decode (NVIDIA Dynamo):** NVIDIA Dynamo is described as a distributed
  inference-serving framework built specifically to run prefill and decode on **separate,
  independently scaled pools of GPUs** (each optimized for its respective bottleneck — compute
  for prefill, memory bandwidth/capacity for decode), simplifying what NVIDIA calls "the
  complexities of disaggregated serving architectures," and is the software layer behind
  NVIDIA's NVL72 MoE-serving claims in item 8.
  - **Basis:** Published spec (NVIDIA's own product description).
  - **Source:** [NVIDIA Developer Blog, "How NVIDIA GB200 NVL72 and NVIDIA Dynamo Boost Inference Performance for MoE Models"](https://developer.nvidia.com/blog/how-nvidia-gb200-nvl72-and-nvidia-dynamo-boost-inference-performance-for-moe-models) (NVIDIA, 2026).
- **Batching:** Not independently re-sourced beyond the general framing above in this session —
  the standard concept (continuous/in-flight batching lets a GPU serve many concurrent decode
  requests to keep memory-bandwidth-bound steps busy) is widely documented but a specific
  NVIDIA/vendor number for GB200 NVL72 batch sizes was **not pulled** in this pass — say so.

---

## 3. Honest token cost

### 11. US grid carbon intensity, regional spread, 24/7 CFE

- **US national average:** EIA states U.S. **net electricity generation in 2023** (~4.18
  trillion kWh) resulted in **~1.53 billion metric tons of CO2**, i.e., **about 0.81 lb
  CO2/kWh (≈368 g CO2/kWh)**. Separately, EPA's eGRID methodology (2022 data, released via
  eGRID 2023 update cadence) gives a **national average output emission rate of 823.1 lb
  CO2/MWh (≈373 g CO2/kWh)** — the two independent figures (EIA's generation-based number and
  EPA's eGRID-based number) agree closely (~368 vs. ~373 g/kWh).
  - **Basis:** Published spec (both EIA and EPA are the respective federal statistical/regulatory
    sources; the ~5 g/kWh gap between them likely reflects slightly different year and
    methodology, not a real disagreement).
  - **Source:** [U.S. EIA, "How much carbon dioxide is produced per kilowatthour of U.S. electricity generation?"](https://www.eia.gov/tools/faqs/faq.php?id=74&t=11) (EIA FAQ, updated Dec 11, 2024, citing 2023 data); [EPA eGRID national output emission rate, as tabulated by secondary aggregators of the eGRID 2023 data release](https://emission-factors.com/guides/egrid-subregion-emission-factors.html) (I did not directly fetch EPA's own eGRID summary-data table in this session — the 823.1 lb/MWh figure is via a secondary eGRID-data aggregator; recommend confirming against epa.gov/egrid/summary-data directly before publishing).
- **Regional spread:** I was not able to pull specific, current (2025/2026) g CO2/kWh figures
  for PJM, MISO, SPP, ERCOT, or a Pacific-Northwest subregion directly from EPA eGRID or EIA in
  this session — searches returned discussion of these grid operators' policy fights and load
  growth, not their emissions-intensity numbers. **Say so: regional intensity figures for these
  five specific balancing authorities/subregions were not sourced in this pass** and should be
  pulled directly from EPA's eGRID subregion tables (the file already used in
  `power-chain-sources.md`'s ecosystem, e.g. emission-factors.com's eGRID subregion table) before
  publishing regional comparisons on the explainer. As a general, well-known qualitative
  pattern (not independently re-verified with a number here): the Pacific Northwest (hydro-heavy)
  and California grids are typically among the lowest-carbon US regions, while coal-and-gas-heavy
  Midwest regions (parts of MISO/SPP) and PJM are typically higher — treat this as **Estimate/
  general knowledge**, not a sourced number, until real eGRID subregion figures are pulled.
- **24/7 carbon-free energy (hyperscalers):** Google reports its 24/7 CFE score rose from
  **64% to 66%** in 2024, with **9 of 20** grid regions where Google owns/operates data centers
  reaching **at least 80% CFE**; Google has matched 100% of its electricity with renewables
  annually (on a non-hourly basis) since 2017 and targets 100% 24/7 CFE by 2030. Microsoft and
  Google have both stated a 2030 24/7-matching goal; one 2026 report states **Microsoft is
  considering scaling back or scuttling** its 24/7-by-2030 pledge given AI-driven demand growth.
  - **Basis:** Published spec (Google's own reported percentage) for Google; Industry typical /
    unconfirmed for the Microsoft retrenchment claim (a single trade report, not a Microsoft
    statement).
  - **Source:** [Google, "24/7 by 2030: Realizing a Carbon-free Future"](https://sustainability.google/reports/247-carbon-free-energy/) (Google Sustainability, current); [GeekWire, "Report: As AI electricity demands soar, Microsoft weighs retreat from ambitious carbon-free energy pledge"](https://www.geekwire.com/2026/report-as-ai-electricity-demands-soar-microsoft-weighs-retreat-from-ambitious-carbon-free-energy-pledge/) (GeekWire, 2026).

### 12. Utilization of inference fleets

- **General enterprise GPU fleets:** A Cast AI report (analyzing "tens of thousands of
  production Kubernetes clusters," January 2025–April 2026) found **average GPU compute
  utilization of ~5%** before optimization, with GPUs frequently allocated-but-idle from the
  scheduler's perspective (memory reserved, compute mostly unused).
  - **Basis:** Industry typical (a single vendor's telemetry report across its customer base —
    not necessarily representative of hyperscaler-run frontier-model inference fleets
    specifically, which invest heavily in their own utilization tooling).
  - **Source:** [Cast AI, "The GPU Shortage Inside Your Own Infrastructure..."](https://cast.ai/blog/gpu-utilization-idle-capacity-queued-workloads/) (Cast AI, 2026); corroborated by [Winbuzzer, "5% GPU Utilization: Enterprises Face Underused GPU Fleets as AI Costs Rise"](https://winbuzzer.com/2026/05/11/enterprises-face-underused-gpu-fleets-as-ai-costs-rise-xcxwbn/) (2026).
  - **Note:** This 5% figure describes general enterprise/multi-tenant Kubernetes GPU clusters, not specifically hyperscaler LLM-serving fleets (Google/Meta/OpenAI/etc.) — do not present it on the explainer as "how utilized ChatGPT's GPUs are." It is useful context for "AI compute is often stranded/idle by default," not a number for the "honest cost of a token" specifically.
- **Google's own methodology (a more directly relevant number):** Google's environmental-impact
  paper explicitly states that production AI-serving systems require **"a degree of provisioned
  capacity that is idle but ready to handle traffic spikes or failover at any given moment,"**
  and that **"the energy consumed by these idle chips must be factored into the total energy
  footprint"** — i.e., Google's own 0.24 Wh/prompt figure (item 15) already has this idle-capacity
  gap baked in, rather than reporting a raw "GPU busy" utilization percentage.
  - **Basis:** Published spec (Google's own paper, describing methodology rather than stating a
    single utilization percentage).
  - **Source:** Google, ["Measuring the environmental impact of delivering AI at Google Scale"](https://arxiv.org/abs/2508.15734) (arXiv:2508.15734, Aug 2025); [Google Cloud Blog summary](https://cloud.google.com/blog/products/infrastructure/measuring-the-environmental-impact-of-ai-inference/) (Google, May 2025).
  - **Say so:** Google does not publish a single "our fleet runs at X% utilization" number in
    the materials fetched — the idle-capacity effect is folded into the per-prompt energy figure
    rather than disclosed as a standalone percentage. No such standalone hyperscaler utilization
    percentage was found for any of Google/Meta/OpenAI/Anthropic in this session.

### 13. Training energy for known models; Epoch AI compute/power trend

- **Llama 3.1 405B (Meta's own model card):** **39.3 million GPU-hours** on H100-80GB for
  pretraining; **11,390 tons CO2eq** location-based emissions estimate for training, but
  **0 tons CO2eq** market-based (because Meta claims 100%-renewable-matched global operations
  and net-zero operational emissions).
  - **Basis:** Published spec (Meta's own model card).
  - **Source:** [Meta, Llama 3.1 Model Card](https://github.com/meta-llama/llama-models/blob/main/models/llama3_1/MODEL_CARD.md) (meta-llama GitHub repo, current).
  - **Note:** The location-based vs. market-based numbers (11,390 vs. 0 tons) are not in conflict
    — they are two different accounting conventions (location-based = actual local grid mix;
    market-based = net of purchased renewable-energy certificates/PPAs). Present both, labeled,
    rather than picking one; presenting only the "0 tons" figure without the location-based
    number would be misleading for an "honest" cost section.
- **GPT-4 (Epoch AI estimate, not OpenAI-disclosed):** Estimated **51,773–62,319 MWh** of
  electricity for training, based on an estimated **~25,000 NVIDIA A100 GPUs running 90–100
  days**.
  - **Basis:** Estimate (Epoch AI's own explicit framing — OpenAI has not disclosed GPT-4
    training energy; this is a third-party reconstruction from reported GPU counts and training
    duration).
  - **Source:** [Epoch AI, "How much energy does ChatGPT use?"](https://epoch.ai/gradient-updates/how-much-energy-does-chatgpt-use) (Epoch AI); cross-posted at [Epoch AI Substack](https://epochai.substack.com/p/how-much-energy-does-chatgpt-use).
- **Gemini:** Not found — no Google-disclosed or credible third-party estimate of Gemini
  *training* energy was located in this session (Google's own disclosure in item 15 explicitly
  excludes training; see that item's boundary note). **Say so.**
- **Epoch AI's frontier-training trend:** Training compute for frontier models has grown at
  roughly **4–5x per year** since 2020 (compute doubling roughly every **5.2 months**); the
  **power** required for frontier training runs has been doubling **~annually**, with training
  power demand growing at an estimated **2.2x per year**, frontier runs already **exceeding
  100 MW**, and Epoch AI projecting individual training runs could reach **4–16 GW by 2030**
  (assuming continued 4–5x/year compute scaling partly offset by ~40%/year GPU efficiency
  gains).
  - **Basis:** Published spec (Epoch AI's own published trend analysis, an organization
    specifically dedicated to tracking and publishing this kind of figure — treat as the closest
    thing to an authoritative running estimate, while noting it is itself built on Epoch's own
    modeling assumptions, not a census of all training runs).
  - **Source:** [Epoch AI, "The power required to train frontier AI models is doubling annually"](https://epoch.ai/data-insights/power-usage-trend) (Epoch AI); [Epoch AI, "The training compute of notable AI models has been doubling roughly every six months"](https://epoch.ai/data-insights/compute-trend-post-2010) (Epoch AI); [Epoch AI, "Training compute of frontier AI models grows by 4-5x per year"](https://epoch.ai/publications/training-compute-of-frontier-ai-models-grows-by-4-5x-per-year) (Epoch AI); [Epoch AI Substack, "Projecting AI Training Power Demand"](https://epochai.substack.com/p/power-demands-of-frontier-ai-training) (Epoch AI).

### 14. Embodied carbon of AI hardware

- **NVIDIA HGX H100 (NVIDIA's own disclosure):** NVIDIA published a **cradle-to-gate Product
  Carbon Footprint (PCF)** for the HGX H100 baseboard (8x H100 SXM GPUs) of **1,312 kg CO2e**
  for the whole baseboard — i.e., **≈164 kg CO2e per GPU** by simple division — covering raw
  material extraction, component manufacturing, and final assembly (not use-phase or
  end-of-life). Memory contributes **~42%** of this embodied footprint, integrated circuits
  **~25%**, thermal components **~18%**. The assessment was **ISO-conformant and third-party
  reviewed**, performed by WSP on NVIDIA's behalf.
  - **Basis:** Published spec (NVIDIA's own, third-party-reviewed PCF document).
  - **Source:** [NVIDIA, "HGX H100 PCF Summary"](https://images.nvidia.com/aem-dam/Solutions/documents/HGX-H100-PCF-Summary.pdf) (NVIDIA, current).
- **NVIDIA HGX B200 (comparison):** NVIDIA states HGX B200 achieves a **24% reduction in
  embodied carbon emissions** compared to HGX H100 across large AI training/inference workloads
  (i.e., per unit of useful compute delivered, not necessarily per physical board), and cites an
  embodied-carbon computing intensity of **0.66 gCO2e per exaFLOP** for HGX H100 as the baseline
  for that comparison.
  - **Basis:** Published spec (NVIDIA's own PCF summary and developer blog).
  - **Source:** [NVIDIA, "HGX B200 PCF Summary"](https://images.nvidia.com/aem-dam/Solutions/documents/HGX-B200-PCF-Summary.pdf) (NVIDIA, current); [NVIDIA Developer Blog, "NVIDIA HGX B200 Reduces Embodied Carbon Emissions Intensity"](https://developer.nvidia.com/blog/nvidia-hgx-b200-reduces-embodied-carbon-emissions-intensity) (NVIDIA).
  - **Note:** No equivalent NVIDIA-published PCF was found for the GB200 NVL72 rack or the
    Blackwell GPU specifically used in NVL72 (as opposed to the air-cooled HGX B200 8-GPU
    board) — **say so**; do not extrapolate the HGX H100/B200 per-board figures directly onto a
    GB200 NVL72 rack's 72-GPU embodied footprint without a dedicated NVL72 PCF, which was not
    located in this session.

### 15. Google's 2025 per-prompt disclosure — exact boundary

- **Headline figures:** Median **Gemini Apps text prompt**: **0.24 Wh** energy, **0.03 g CO2e**,
  **0.26 mL** water (equivalently described by Google as "less energy than watching nine seconds
  of television" and "about five drops of water").
- **What's included (per the paper's own stated methodology):**
  - **Idle/provisioned capacity:** explicitly included — "production systems require a degree of
    provisioned capacity that is idle but ready to handle traffic spikes or failover... the
    energy consumed by these idle chips must be factored into the total energy footprint."
  - **Host CPU and DRAM:** explicitly included, in addition to the AI accelerator itself.
  - **Data center overhead (PUE):** explicitly included — cooling, power distribution, and other
    overhead, "measured by... Power Usage Effectiveness (PUE)."
  - **Embodied/manufacturing emissions of the hardware:** explicitly **included** in the carbon
    (not energy) figure — the paper states emissions are calculated from "the local grid energy
    mix of the consumed electricity, **and the embodied emissions of the compute hardware**,"
    covering Scope 1+3 emissions "for the AI accelerators and host CPU & DRAM."
  - **Water:** measured via the **consumptive-use variant of WUE (ISO WUE Category 2)** — "water
    input minus water returned" for on-site data-center cooling; the paper's water figure is
    about data-center cooling water, not power-plant cooling water for the electricity Google
    consumes (i.e., it likely does **not** include the ~1.8 L/kWh indirect generation-water
    figure from item 7).
- **What's explicitly excluded:** **Training energy** — the paper states directly: "This study
  specifically considers the inference and serving energy consumption of an AI prompt. **We
  leave the measurement of AI model training to future work.**"
  - **Basis:** Published spec (Google's own peer-reviewed-style technical paper, not just the
    summary blog post — this is a meaningfully more precise/citable source than the blog post
    alone, and resolves an open question left in `power-chain-sources.md` item 22, which had
    flagged the embodied-emissions boundary as unclear).
  - **Source:** Google, ["Measuring the environmental impact of delivering AI at Google Scale"](https://arxiv.org/abs/2508.15734) (arXiv:2508.15734, Aug 2025 — full text at [arxiv.org/html/2508.15734v1](https://arxiv.org/html/2508.15734v1)); [Google Cloud Blog, "Measuring the environmental impact of AI inference"](https://cloud.google.com/blog/products/infrastructure/measuring-the-environmental-impact-of-ai-inference/) (Google, May 2025, the public-facing summary of the same work); corroborated by [MIT Technology Review](https://www.technologyreview.com/2025/08/21/1122288/google-gemini-ai-energy/) (Aug 2025).
  - **Note:** Explicitly scoped to **text** prompts (median case) only; Google states image/video
    generation cost substantially more per prompt — do not extrapolate the 0.24 Wh figure to
    other modalities on the explainer.

---

## Gaps and conflicts

**Not found / no source located (say so rather than invent):**
- A Blackwell-specific Tj-max/throttle-point spec from an NVIDIA datasheet (item 1) — the
  85°C figure in circulation traces to a secondary cooling-engineering article, not NVIDIA.
- A single, resolved die-area figure for Blackwell (item 2) — ~800 mm²/die is a converging
  trade-press estimate, not an NVIDIA-published number.
- A numeric CDU approach-temperature spec from any CDU vendor (item 4) — vendor pages describe
  the function, not a °C number.
- Matched facility supply/return temperature pairs for W32 and W40 specifically (item 4) — only
  W45 (45°C/~55–65°C) was sourced.
- Hot-aisle air temperature for GB200 NVL72's air-cooled fraction (item 5).
- A single supply/return temperature for the Stockholm Data Parks heat-export network (item 6).
- A clean, Published-spec Google or Meta WUE ratio (L/kWh) pulled directly from their own
  current sustainability reports (item 7) — only secondary/trade citations were found.
- Regional (PJM/MISO/SPP/ERCOT/Pacific Northwest) g CO2/kWh figures pulled directly from EPA
  eGRID subregion tables (item 11) — general regional patterns are well known but no specific
  current numbers were sourced in this pass.
- A standalone hyperscaler "fleet utilization %" number for any of Google/Meta/OpenAI/Anthropic
  inference serving (item 12) — Google folds idle capacity into its per-prompt energy figure
  rather than disclosing a percentage.
- Any Gemini training-energy estimate (item 13) — Google's per-prompt paper explicitly excludes
  training and no credible third-party estimate was found.
- A GB200 NVL72-specific (rack-level, 72-GPU) NVIDIA product carbon footprint (item 14) — only
  the air-cooled 8-GPU HGX H100/B200 board PCFs were found.
- A specific NVIDIA-stated batch-size or throughput number tying "batching" concretely to GB200
  NVL72 in this session (item 10) — the concept is described generally, not with an NVL72 number.

**Real or apparent conflicts found:**
- **Coolant inlet temperature (item 3):** Sources give 18–32°C, 32–45°C (ACS reference design),
  and 45°C (newest MGX warm-water spec) as three different "the" inlet temperature figures for
  GB200-class racks. These describe different design vintages/reference designs, not one
  number — present as a range across designs, not a single spec.
- **Coolant flow rate per rack (item 3):** ~170–195 L/min vs. ~30–40 L/min for what's described
  as the same rack class — a ~5x unreconciled gap, likely different measurement scope
  (whole-rack facility flow vs. a single reference design's loop), not resolved here.
- **Die-level heat flux (item 2):** My own average-flux calculation (~75 W/cm², from
  TDP ÷ die area) is 6–8x lower than commonly quoted "500–600 W/cm²" cooling-industry figures.
  These are very likely describing different things — average package flux vs. peak hotspot
  flux the cold plate must handle — but no source directly reconciles them for Blackwell. Present
  both, labeled, rather than picking one.
- **Meta Odense heat-reuse scale (item 6):** 165,000 MWh/9,000 homes vs. 165,000 MWh/11,000
  homes vs. 215,000 MWh/12,000+ homes across different reports — likely reflects the
  project scaling up over time (2020 vs. 2025/2026 reporting), not a true contradiction, but not
  reconciled to one current figure here.
- **Llama 3 405B parallelism figures across sources (item 9):** The paper's own flagship
  16,384-GPU/128K-sequence-length configuration (TP8/CP16/PP16/DP8) should not be confused with
  smaller example configurations (e.g., 512-GPU or 448-GPU configs) that appear in a separate
  ISCA 2025 analysis paper discussing other stages of the same overall training campaign.
- **US grid carbon intensity, EIA vs. EPA eGRID (item 11):** ~368 g/kWh (EIA, derived from 2023
  generation and emissions totals) vs. ~373 g/kWh (EPA eGRID, later data-vintage). A ~1% gap,
  most likely a data-year/methodology difference rather than a real disagreement — both are
  reasonable "US average" figures to cite, with eGRID being the more granular/regional-capable
  dataset.
- **Google per-prompt boundary vs. the prior fact sheet's uncertainty (item 15):** This research
  pass found Google's actual arXiv methodology paper, which states plainly that embodied
  hardware emissions **are** included in the carbon figure and training **is not** — resolving
  the ambiguity that `power-chain-sources.md` item 22 had flagged as unconfirmed. Use this file's
  item 15, not the earlier file's more hedged note, as the current answer.
