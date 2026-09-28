# Watts to Tokens — Power Chain Fact Sheet

Sourced figures for the "Watts to Tokens" 3D explainer, from 345 kV transmission
down to a GPU die at ~0.8 V and the tokens it produces. US context, 60 Hz,
unless noted.

Basis labels: **Published spec** (vendor/standards body states it directly),
**Industry typical** (trade press, reference designs, or multiple independent
sources agree), **Estimate** (derived or uncertain — no single authoritative
number exists).

Checked `~/projects/stack_ledger` first (see note at the end of each relevant
item). That project tracks company-level MW commitments and chip-fab capacity
with its own source-ID ledger (`research/sources.json`, `research/catalog.json`);
it does not carry the rack/board/die-level figures this page needs, so those
come from primary vendor and trade-press sources below, with stack_ledger's
figures reused only for the campus MW examples.

---

## 1. Grid and campus

### 1. US average transmission and distribution (T&D) losses

- **Value:** ~5% of electricity transmitted and distributed
- **Basis:** Published spec (EIA's own FAQ answer)
- **Source:** [U.S. EIA, "How much electricity is lost in electricity transmission and distribution in the United States?"](https://www.eia.gov/tools/faqs/faq.php?id=105&t=5) — EIA FAQ, exact quote: "annual electricity transmission and distribution (T&D) losses averaged about 5% of the electricity transmitted and distributed in the United States in 2018 through 2022."
- **Note:** This is a multi-year average (2018–2022), not a single-year figure; EIA has not published a more recent single-year update as of this research. Some secondary sources (e.g., World Bank data) cite 6% for the US in other year ranges — treat 5% as EIA's own current headline number.

### 2. Typical HV interconnection voltages and campus examples

- **Value/range:** 230/345/500 kV interconnection is standard for large AI campuses; individual campus IT/compute power ranges from ~150 MW (early build) to multi-GW planned end states.
- **Basis:** Published spec / Industry typical (mixed — see per-example notes)
- **Examples:**
  - **Stargate Abilene, TX (OpenAI/Oracle/Crusoe/SoftBank):** Fed by a double 345 kV corridor (Midland–Graham, TX) with a new 345 kV substation (Oncor); buildings 1–4 (of 8) reported operational at ~421 MW IT power as of July 2026; planned campus end-state >1 GW (a 1 GW+ 345 kV substation with five main power transformers, ~1.2 GW total, is under construction).
    - Source: [Epoch AI, "OpenAI Stargate: where the US sites stand"](https://epoch.ai/publications/openai-stargate-where-the-us-sites-stand) (Epoch AI, 2026); [Compute Atlas, "Stargate Abilene"](https://www.compute-atlas.com/facilities/stargate-abilene-tx"); corroborated in stack_ledger `research/catalog.json` entries `abilene-it-operating` / `abilene-it-endstate` (source id `epoch-openai-stargate-abilene`, same Epoch AI publication).
    - Note: the 421 MW and 1.2 GW figures are third-party (Epoch AI) site estimates from cooling/equipment evidence and utility filings, not an OpenAI/Oracle metered disclosure — treat as Industry typical, not Published spec.
  - **xAI Colossus, Memphis, TN:** First MLGW substation delivering 150 MW built in 97 days (Memphis Light, Gas & Water + TVA supply); grid draw later reported near 250 MW, backed by 168–enlarged Tesla Megapack fleet (reported up to 150 MW of batteries) and on-site gas turbines (reported up to ~495 MW additional on-site generation). A separate system-impact study flagged $1.7M of upgrades to an existing 161 kV transmission line.
    - Source: [Data Center Dynamics, "Fury from campaigners as Elon Musk's xAI gets 150MW for Colossus supercomputer in Memphis"](https://www.datacenterdynamics.com/en/news/xai-colossus-memphis-power-tva/) (DCD, 2025); [SemiAnalysis, "xAI's Colossus 2 – First Gigawatt Datacenter"](https://newsletter.semianalysis.com/p/xais-colossus-2-first-gigawatt-datacenter) (SemiAnalysis, 2025).
    - Note: xAI has not published these numbers itself; figures come from trade press and a utility system-impact study — Industry typical, not Published spec. The MW figures reported (150 → 250 → 495 MW) reflect different build phases at different dates and are not directly comparable.
  - **Meta Hyperion, Richland Parish, LA:** Planned to scale to 5 GW of compute; Entergy Louisiana building a new "Smalling" 500/230 kV substation, a "Car Gas Road" 500 kV switchyard, the Sarepta–Mt Olive 500 kV line, and ~240 miles of new HV transmission, plus 7 combined-cycle gas plants (reported combined ~7.5 GW nameplate) and grid-scale battery storage at three sites.
    - Source: [IEEE Spectrum, "5GW Data Center Buildout Requires Novel Engineering"](https://spectrum.ieee.org/5gw-data-center) (IEEE Spectrum, 2026); [Data Center Frontier, "Ownership and Power Challenges in Meta's Hyperion and Prometheus Data Centers"](https://www.datacenterfrontier.com/hyperscale/article/55310441/ownership-and-power-challenges-in-metas-hyperion-and-prometheus-data-centers) (Data Center Frontier, 2026).
    - Note: 5 GW is Meta/Entergy's own stated plan (company-commitment), not current operating load — label the number itself Published spec (as a commitment) but current IT MW as not yet observed.

### 3. Large power transformer efficiency and MVA ratings; lead times

- **Value:** Efficiency 99.5–99.7% typical for units >100 MVA. Example 345 kV unit: 90/120/150 MVA ONAN/ONAF/ONAF ratings.
- **Basis:** Industry typical (efficiency), Published spec (example rating sheet)
- **Source:** [PA Transformer, "345 kV Power Transformer Projects"](https://www.patransformer.com/power-transformer-projects/power-transformer-345-kv/) (PA Transformer product page); general efficiency range corroborated by multiple transformer-manufacturer technical pages (Electrical4U, Daelim, Wiringuru) — no single standards-body number found; IEEE/ANSI C57 series sets loss/efficiency *test methods*, not a single target percentage.
- **Lead times:** 120–144 weeks (roughly 2.5–3 years) typical for large power transformers as of Q1 2026; generator step-up (GSU) units running longer, some >210 weeks; most manufacturers booking 24–36 months out.
- **Source:** [GridReadiness, "HV Transformer Lead Times 2026: EU vs US"](https://www.gridreadiness.com/blog/power-transformer-lead-times-ai-data-center-2026.html); [DistroForge, "Transformer Lead Times 2026: US Procurement Numbers"](https://distroforge.com/blog/transformer-procurement-2026/) — both are transformer-industry/procurement trade sites (2026), not a utility or DOE primary release; treat lead-time figures as Industry typical.
- **Note:** No single "efficiency spec" number could be sourced from a standards body (IEEE C57.12.90 defines *how* to measure losses, not a required minimum efficiency); the 99.5–99.7% figure is a converging trade-press/manufacturer estimate, not a certified spec — labeled Industry typical.

### 4. Typical MV distribution voltage inside campuses

- **Value:** 13.8 kV is the traditional North American default; 34.5 kV increasingly used for large AI campuses because it carries more power over fewer/smaller feeders across a sprawling site. Utility service into the campus commonly at 69–230+ kV, stepped down to 34.5 kV or 13.8 kV for internal distribution. 12.47 kV is a legacy/utility-distribution class, less common as the *internal* AI-campus MV bus today.
- **Basis:** Industry typical
- **Source:** [ATK Energy Group, "Medium-Voltage Distribution for Data Center Campuses in 2026"](https://atkenergygroup.com/blog/medium-voltage-distribution-data-center-campuses/) (ATK Energy, 2026); [Keentel Engineering, "Medium Voltage Switchgear in Data Centers Guide"](https://keentelengineering.com/medium-voltage-switchgear-data-centers-guide) (2026).
- **Note:** No IEEE/ANSI standard mandates one over the other; choice is a project-specific engineering tradeoff (feeder count/cost vs. equipment cost), so this is a trend observation, not a fixed spec.

### 5. Diesel standby gensets

- **Value:** 2.5–3.1 MW class units common (e.g., Cummins DQKAN 2500 kW, Caterpillar C175-16 2500–3100 kW/kVA).
- **Basis:** Published spec (vendor datasheets)
- **Fuel burn at full load:**
  - Cummins DQKAN 2500 kW: 173.1 US gal/hr at 100% load → **≈0.069 gal/kWh** (≈261 L/MWh)
  - Caterpillar C175-16 (2500 ekW continuous): 174.8 gal/hr at 100% → **≈0.070 gal/kWh** (≈265 L/MWh)
  - Caterpillar C175-16 (3000 ekW standby): 212.9 gal/hr at 100% → **≈0.071 gal/kWh** (≈269 L/MWh)
  - **Source:** [Cummins, DQKAN spec sheet (NAD-5919-EN)](https://www.globalpwr.com/wp-content/uploads/cut-sheets/gps-cummins-2500-kw-dqkan-data-sheet.pdf) (Cummins Inc.); [Caterpillar, C175-16 spec sheet](https://emc.cat.com/pubdirect.ashx?media_string_id=SS-8098119-1000028916-042.pdf) (Caterpillar Inc.).
  - The gal/kWh figures are my own division of the vendor's published gal/hr by rated kW — label that conversion **Estimate**, the underlying gal/hr and kW figures **Published spec**.
- **Fuel tank / hours:** Sub-base tanks commonly ~3,750 gal per 2,500 kW unit (Cummins DQKAN); scaled to a 24–72 hour on-site fuel runtime commonly cited in data-center design guides, but I could not find a single authoritative source stating "24–72 h" as a design standard — it is a commonly used range in RFPs/design guides, not a code requirement.
  - **Basis:** Estimate / Industry typical (no single sourced standard found)
- **Genset count per 100 MW / redundancy:** Not found as a single sourced industry figure. Genset sizing and N+1/2N redundancy ratios are project-specific (depend on genset size chosen, Tier level, and UPS topology); I did not find a vendor or trade-press source stating a standard "gensets per 100 MW" ratio. **Say so: no source found for this sub-item.**

### 6. BESS at AI campuses

- **Value:** Used for both (a) buffering GPU-training load swings (sub-second, reported up to ~100 MW swings, pushing clusters to ~150% of average draw) and (b) grid-facing services/backup. Real examples: xAI Colossus (Memphis) reportedly running up to 168 Tesla Megapacks (reported capacity up to ~150 MW) as bridge power/backup; Meta Hyperion (Louisiana) plan includes grid-scale battery storage at three sites (grid-services/firming role, per Entergy agreement).
- **Basis:** Industry typical (load-swing role) / Published spec (NVIDIA's own technical description of the mechanism)
- **Source:** [NVIDIA Technical Blog, "Designing Production-Ready Battery Energy Storage Systems for AI Factories"](https://developer.nvidia.com/blog/designing-production-ready-battery-energy-storage-systems-for-ai-factories) (NVIDIA, 2026); [PGJ Online, "Load Smoothing in AI Data Centers"](https://pgjonline.com/news/2025/november/load-smoothing-in-ai-data-centers-the-case-for-batteries-and-integrated-electrical-system-design) (Power Grid International, 2025); xAI/Meta examples per sources cited in item 2.
- **Note:** the "100 MW swings" and "150% of normal draw" figures are trade-press/vendor-blog characterizations of the phenomenon in general, not tied to a specific measured campus — treat as Industry typical, not a hard spec for any one site.

### 7. Heat rejection for liquid-cooled AI halls

- **Value:** ASHRAE TC 9.9 5th Edition renamed water temperature classes to **W17, W27, W32, W40, W45, W+**, where the number is the max supply temperature in °C (e.g., W32 = 32°C max supply). W32/W40 are commonly described as the "chiller-free in many climates" band; W45/W+ as the heat-reuse/dry-cooler band. Minimum supply temperature across all classes is 2°C.
- **Basis:** Published spec (ASHRAE TC 9.9 defines the classes; exact whitepaper text not directly re-fetched, sourced via trade coverage of the 5th edition)
- **Source:** [Upsite Technologies, "What You Need to Know About ASHRAE's Fifth Edition of Thermal Guidelines"](https://www.upsite.com/blog/what-you-need-to-know-about-ashraes-fifth-edition-of-thermal-guidelines/) (Upsite, 2025/2026); ASHRAE's original whitepaper "Emergence and Expansion of Liquid Cooling in Mainstream Data Centers" (ASHRAE TC 9.9) covers the predecessor W1–W5 classes: [ASHRAE/Vertiv-hosted PDF](https://www.vertiv.com/49db1c/globalassets/documents/white-papers/ashrae_tc0909_emergence_and_expansion_of_liquid_cooling_in_mainstream_data_centers_5_may_2021_332771_0.pdf).
- **Note:** I read the 5th-edition renaming through secondary trade coverage, not ASHRAE's own (paywalled) book text — label the class *names/numbers* Published spec (ASHRAE is the standards body and these are widely and consistently reported), but treat any interpretive claims ("often chiller-free") as Industry typical.
- **WUE:** Dry-cooler + adiabatic-assist liquid cooling reported at **0.15–0.17 L/kWh**; Berkeley Lab's 2024 US Data Center Energy Usage Report projects fleet-average WUE reaching **0.45–0.48 L/kWh** in some future scenarios; Meta reports fleet WUE around **0.20 L/kWh** for its newest hyperscale campuses (secondary source, not confirmed on Meta's own sustainability page directly — see item 10 note).
  - **Source:** [Introl, "Water Usage Efficiency: AI Data Center Cooling Without Crisis"](https://introl.com/blog/water-usage-efficiency-wue-ai-data-center-cooling-guide-2025) (Introl, 2025); LBNL 2024 US Data Center Energy Usage Report (cited via secondary trade summary — recommend re-verifying against the LBNL PDF directly before publishing this number on the page).
  - **Basis:** Industry typical

---

## 2. Building

### 8. MV-to-LV unit substation transformers (2.5–3 MVA, 34.5 kV → 480 V) and DOE 2016 efficiency

- **Value:** DOE's 2016 efficiency standard (10 CFR Part 431) covers three classes — low-voltage dry-type, medium-voltage dry-type, and liquid-immersed distribution transformers — and is estimated by DOE to cut average energy losses by **18%** (low-voltage dry-type) and **13%** (medium-voltage dry-type) versus pre-2016 units.
- **Basis:** Published spec (DOE rulemaking)
- **Source:** [U.S. DOE, "Energy Conservation Standards for Distribution Transformers" final rule](https://www1.eere.energy.gov/buildings/appliance_standards/pdfs/dt_final_rule.pdf) (US DOE/EERE); summarized also by [Hammond Power Solutions, "New Energy Efficiency levels US 2016"](https://americas.hammondpowersolutions.com/en/resources/faq/distribution-transformers/new-energy-efficiency-levels-us-2016) (manufacturer FAQ).
- **Note:** I did not find a single published *efficiency percentage* (e.g., "98.9%") specifically for a 2.5–3 MVA 34.5 kV→480 V unit substation transformer under the DOE 2016 levels — DOE publishes the standard as maximum allowable *loss* tables (kW loss by kVA/BIL/voltage class) in 10 CFR 431 Subpart K, not a single headline efficiency percentage. Treat any single-number efficiency claim for this specific rating as **Estimate** unless computed directly from the DOE loss tables (not done here).

### 9. Static double-conversion UPS

- **Value:** Eaton 9395XR modular UPS: rated up to 1500 kW per cabinet (1.5 MW / up to 1.8 MW per system); tested double-conversion (online) efficiency **up to 97.5%**; Energy Saver System (eco/ESS) mode up to **99%**; supports Li-ion battery cabinets with real-time monitoring.
- **Basis:** Published spec (Eaton product literature)
- **Source:** [Eaton, "9395XR UPS" product page](https://www.eaton.com/us/en-us/catalog/backup-power-ups-surge-it-power-distribution/eaton-9395xr-ups.html) (Eaton, current product page); [Eaton 9395XR brochure PDF](https://www.eaton.com/content/dam/eaton/products/backup-power-ups-surge-it-power-distribution/backup-power-ups/eaton-9395xr-ups/resource/eaton-9395xr-ups-brochure-en-gb-anz.pdf).
- **Note:** I could not independently pull matching primary spec sheets for Vertiv or Schneider Galaxy modules in this session (searches surfaced only the Eaton unit clearly); the "1.25–1.6 MW module" range in the prompt is consistent with publicly known Vertiv/Schneider large-frame UPS classes but I do not have a directly fetched citation for those two vendors' exact numbers — treat the multi-vendor range as **Industry typical**, Eaton's own number as **Published spec**.
- **Li-ion runtime minutes:** Not sourced to a specific number in this session — runtime is configurable (battery string sizing), so there is no single "typical minutes" figure; say so.
- **GPUs on UPS:** In AI halls, IT load (including GPUs) is typically still on UPS for ride-through, but many designs now split cooling/mechanical loads onto a separate (sometimes non-UPS-backed) path, and some designs use the rack-level capacitive energy storage (see item 16, GB300) plus grid-forming BESS specifically to reduce the *size* of UPS needed for GPU load transients rather than removing GPUs from UPS entirely. I found no single vendor source stating "GPUs are/are not on UPS" as a blanket rule — this is architecture-dependent. **Basis: Estimate.**

### 10. PUE

- **Uptime Institute global average (2026 survey):** Industry-wide annual average PUE reported (via secondary trade summary) as **1.52**, or **1.36** when facilities are weighted by size. Uptime's own press release for the 16th annual (2026) survey states only qualitatively that "power efficiency gains remain gradual… minor improvements in average PUE this year" and does not itself print the 1.52/1.36 figures in the press-release text I could fetch.
  - **Source:** [Uptime Institute, 16th Annual 2026 Global Data Center Survey — press release](https://uptimeinstitute.com/about-ui/press-releases/16th-annual-2026-global-data-center-survey-deployment-of-high-density-racks-rising-fast-operators-face-continued-recruiting-and-retention-pressures) (Uptime Institute, 2026) — qualitative only, no number in fetched text; the 1.52/1.36 figures come from [Server Configurator, "Datacenter PUE 2026: Global, Regional & Hyperscale Data"](https://www.server-configurator.com/statistics/datacenter-pue-statistics-2026) (secondary aggregator, 2026), which cites the Uptime survey.
  - **Basis:** Industry typical, with a flag: the exact 1.52/1.36 numbers should be re-verified against Uptime's full survey PDF (behind a registration wall) before quoting on the page as "Uptime says."
- **Google fleet-wide PUE:** **1.09** trailing-twelve-month, as of the page's most recent quarter (Q2 2026 quarterly PUE 1.10, TTM 1.09; 2025 annual average also stated as 1.09).
  - **Source:** [Google, "Efficiency — Google Data Centers"](https://datacenters.google/efficiency/) (Google, live page, checked 2026-09). **Basis: Published spec** (company's own reported metric).
- **Meta fleet-wide PUE:** Widely reported (secondary sources) around **1.08–1.09**, "low 1.1 range." Meta's own sustainability data-centers page (fetched directly) does **not** state a specific number in the page text pulled in this session — the number likely lives in Meta's downloadable Sustainability Report / Environmental Data Index PDF, which I did not fetch.
  - **Source (secondary):** trade summaries referencing Meta reporting, e.g. mmcginvest.com investment-research summary (not a primary Meta source — low confidence). **Basis: Industry typical**, and flagged as needing direct verification against Meta's own PDF report before publishing.
- **Microsoft fleet-wide PUE:** Reported (secondary) around **1.15**. No primary Microsoft sustainability-report citation was directly fetched in this session.
  - **Basis:** Industry typical, unverified against primary source — flag for follow-up.
- **Design PUE for liquid-cooled AI halls:** Vendor/trade-press design targets commonly cited in the 1.1–1.3 range for new liquid-cooled AI facilities (warmer loops + less/no mechanical cooling), but I did not pull a single authoritative "design PUE" spec sheet in this session. **Basis: Estimate — no clean single source found; recommend sourcing a specific hyperscaler's published design-PUE target (e.g., a Meta or Microsoft new-build announcement) before using a number on the page.**

### 11. Busway vs PDU, 415 V vs 480 V

- **Value:** 415 V (3-phase, derived from a 240 V-per-leg/415 V line-to-line system, the US analogue of Europe's 400 V) is becoming the de facto AI-hall rack-power standard, alongside 480 V distribution upstream; busway is preferred over cable-fed PDUs for high-density (>40 kW/rack) AI rows because tap-off boxes can be relocated without rewiring, and higher voltage (415 V vs 208 V) quarters resistive loss for the same current rating, roughly doubling deliverable power through the same conductor.
- **Basis:** Industry typical
- **Source:** ["LV Distribution: Busway, PDUs, RPPs & Rack Power," The Definitive Guide to AI Data Centers](https://aidatacenterguide.com/part-4-electrical-and-energy-infrastructure/4-6-lv-distribution-busway-pdus-rpps-and-rack-power); [Introl, "Power Distribution Units"](https://introl.com/blog/power-distribution-units-pdu-high-density-ai-data-center-2025) (Introl, 2025); [Server Technology, "415V Rack PDU Solutions"](https://www.servertech.com/solutions/415v-pdu-solutions) (Server Technology product page).
- **Note:** No single standards body mandates 415 V/480 V for AI halls; this is a converging industry practice, not a code requirement — hence Industry typical rather than Published spec.

### 12. CDU capacities

- **Value:** In-row/facility CDUs span roughly **70 kW to 2.5+ MW** per unit across current vendor lineups: Vertiv CoolChip CDU family 70–1,350+ kW; Motivair (by Schneider Electric) MCDU-70 announced (Jan 2026) at up to **2.5 MW**, with the broader Motivair line spanning ~105 kW–2.5 MW; CoolIT CHx2000 targeted at high-density AI/HPC (specific MW rating not found in this session).
- **Basis:** Published spec (vendor product pages), Industry typical (comparative framing)
- **Source:** [Vertiv, "Vertiv CoolChip CDU"](https://www.vertiv.com/en-us/products-catalog/thermal-management/high-density-solutions/vertiv-coolchip-cdu/) (Vertiv, current); [Motivair/Schneider Electric CDU brochure, Sept 2025](https://www.motivaircorp.com/uploads/files/brochures/CDU%202025%20Motivair%20by%20SE_Updated_9_26_25.pdf); [Vertiv press release, Nov 2024, on new high-capacity CDUs](https://www.businesswire.com/news/home/20241119492103/en/Vertiv-Expands-its-Global-Liquid-Cooling-Portfolio-with-the-Announcement-of-Two-New-High-Capacity-Coolant-Distribution-Units-to-Support-AI-Applications).
- **Supply temperature to cold plates:** Typically kept above the data-hall dew point to avoid condensation ("100% sensible cooling" per Vertiv); consistent with ASHRAE W32/W40 supply-temperature classes in item 7. No single universal cold-plate supply-temperature number found — it's facility- and climate-dependent. **Basis: Estimate for a single number; Published spec for the "keep secondary loop above dew point" design principle.**

---

## 3. Rack (NVIDIA GB200 NVL72 and GB300 NVL72)

### 13. Rack power, counts, weight, liquid-cooled share

**GB200 NVL72:**
- GPUs: 72 Blackwell GPUs; CPUs: 36 Grace CPUs (18 compute trays, 2 Grace CPUs + 4 Blackwell GPUs per tray)
- NVLink switch trays: 9 trays, each with 4 NVSwitch chips
- Rack power: NVIDIA's own nominal figure is **120 kW**; TDP commonly cited at **132 kW** with EDPp (peak electrical design power, ~1.5x TDP) around **192 kW**; deployed racks reported drawing **130–132 kW** under full load. HPE's configuration guide splits this as **115 kW liquid-cooled / 17 kW air-cooled** (~87% liquid-cooled share).
- Power shelves: reported as 6 shelves (max 8), each delivering up to ~33 kW (Flex's power-shelf implementation: six 5.5 kW PSUs in 3+3 redundant configuration per shelf, ~97.5% peak efficiency at half load), feeding a common rack busbar at ~50–51 V DC.
- Rack weight: reported figures vary by source — ~1,360 kg (~3,000 lb) for the full rack in some vendor guides, vs. a separately reported component breakdown (compute rack 1,500 kg + NVLink switch rack 800 kg + CDU 400 kg + PDU 300 kg) that sums to ~3,000 kg for the full multi-rack cluster unit, not one 72-GPU rack. **These two figures are not reconciled — flag as a real conflict, not just rounding.**
- **Basis:** Published spec (GPU/CPU/tray counts, from NVIDIA's own NVL72 page and DGX GB200 user guide), Industry typical (power-shelf count/kW breakdown, rack weight — vendor/integrator secondary sources, not NVIDIA's own datasheet).
- **Source:** [NVIDIA, "GB200 NVL72"](https://www.nvidia.com/en-us/data-center/gb200-nvl72/) (NVIDIA, current); [NVIDIA DGX GB200 User Guide PDF](https://docs.nvidia.com/dgx/dgxgb200-user-guide/dgxgb200-user-guide.pdf) (NVIDIA, Sept 2026); [HPE QuickSpecs, "NVIDIA GB200 NVL72 by HPE"](https://www.hpe.com/us/en/collaterals/collateral.a50009224enw.html) (HPE, current); [Pantheon, "NVIDIA GB200 NVL72 Specs & Datasheet"](https://pantheon.run/learn/nvidia-gb200-nvl72-specs) (secondary integrator summary); [Rax.ae, "NVIDIA GB200 NVL72 Data Center Guide"](https://rax.ae/knowledge-center/articles/nvidia-blackwell-gb200-nvl72-data-center-guide.html) (secondary integrator summary); [LITE-ON, "NVIDIA GB200 Blackwell power system"](https://www.liteon.com/en/news/press-center/content/nvidia-gb200-blackwell-power-system) (LITE-ON, power-shelf vendor).

**GB300 NVL72:**
- Rack power: reported at **~140 kW** rack-scale, with each rack at **135 kW TDP** and up to **~155 kW peak** depending on workload.
- **Basis:** Industry typical
- **Source:** [Sunbird DCIM, "How Much Power Does a NVIDIA GB300 NVL72 Need?"](https://www.sunbirddcim.com/blog/how-much-power-does-nvidia-gb300-nvl72-need); [Lenovo Press, "Lenovo NVIDIA GB300 NVL72 Rack Scale AI Product Guide"](https://lenovopress.lenovo.com/lp2357-lenovo-nvidia-gb300-nvl72-rack-scale-ai) (Lenovo, integrator spec sheet — closer to Published spec for Lenovo's specific SKU).

### 14. OCP ORv3 48–54 V DC busbar and power shelf efficiency

- **Value:** NVIDIA's GB200 power system is compatible with the OCP ORv3 standard (rack busbar, 1400 A busbar, ORv3-defined 7-pin AC-input connectors, 415 V AC rack input); power shelves convert AC to **~50–51 V DC** onto the busbar. Reported peak efficiency **~97.5%** at half load (consistent with 80 PLUS Titanium-class performance, though I did not find NVIDIA or OCP explicitly using the "80 PLUS Titanium" certification label for this specific shelf).
- **Basis:** Published spec (ORv3 compliance, voltage, connector), Industry typical (the 97.5% efficiency figure, from a power-shelf vendor rather than NVIDIA/OCP directly)
- **Source:** [NVIDIA Developer Blog, "NVIDIA Contributes NVIDIA GB200 NVL72 Designs to Open Compute Project"](https://developer.nvidia.com/blog/nvidia-contributes-nvidia-gb200-nvl72-designs-to-open-compute-project/) (NVIDIA, 2024); [LITE-ON press release](https://www.liteon.com/en/news/press-center/content/nvidia-gb200-blackwell-power-system) (LITE-ON, power-shelf OEM); [Barchart/Business Wire, "Flex Delivers Advanced Power Management for Next-Generation NVIDIA AI Infrastructure"](https://www.barchart.com/story/news/33869165/flex-delivers-advanced-power-management-for-next-generation-nvidia-ai-infrastructure) (Flex, 2026).
- **Note:** "80 PLUS Titanium" is a certification program for individual power supplies (typically at much lower total power); I did not find that certification applied to these rack-scale ORv3 shelves by name — treat the "97.5% Titanium-class" framing as an analogy, not a certified label.

### 15. NVLink spine cables

- **Value:** NVIDIA's own characterization: the 4 NVLink cartridges in the back of an NVL72 rack host **>5,000 active copper links** forming an all-to-all mesh among the 72 GPUs, commonly reported in trade press as "**~5,000 copper cables, over 2 miles**" total length; delivering 130 TB/s aggregate NVLink bandwidth (NVIDIA's own page) via 260 TB/s AllReduce bandwidth (trade-press figure). Each link uses 224G PAM4 signaling.
- **Basis:** Published spec (NVIDIA's ">5,000 links" statement, via a third-party's direct quote from NVIDIA material) / Industry typical (the round "~5,000 cables / 2 miles" phrasing, and the 260 TB/s figure)
- **Source:** [NVIDIA, GB200 NVL72 page](https://www.nvidia.com/en-us/data-center/gb200-nvl72/) (130 TB/s NVLink bandwidth, NVIDIA); [NVIDIA Developer Blog, OCP contribution post](https://developer.nvidia.com/blog/nvidia-contributes-nvidia-gb200-nvl72-designs-to-open-compute-project/) (NVIDIA, 2024, describes the cartridge/cable architecture); trade summary via [SMM/Shanghai Metals Market, "CITIC Securities: GB200 Super Chip Released, High-Speed Cable Companies"](https://news.metal.com/newscontent/102679764) and [FiberMall blog](https://www.fibermall.com/blog/how-nvidia-gb200-utilizes-800g-1600g-dac-acc.htm) for the "~5,000 cables, 2 miles" round figures.

### 16. GB300 energy storage / power smoothing

- **Value:** GB300 NVL72 power shelves add electrolytic capacitors (co-designed with LITEON) occupying roughly **half the PSU's volume**, storing **65 J per GPU**, managed by a new charge-management controller; charges during low GPU-demand periods, discharges during spikes. NVIDIA reports this **reduced peak grid demand by 30%** when training a Megatron LLM workload, versus the GB200 power shelf without this feature.
- **Basis:** Published spec (NVIDIA's own technical blog)
- **Source:** [NVIDIA Developer Blog, "How New GB300 NVL72 Features Provide Steady Power for AI"](https://developer.nvidia.com/blog/how-new-gb300-nvl72-features-provide-steady-power-for-ai/) (NVIDIA, July 28, 2025).

### 17. NVIDIA 800 V DC ("Kyber," 2027)

- **Value:** NVIDIA's own claims: **up to 5% improvement in end-to-end power efficiency** vs. today's 54 V architecture; **45% less copper** required vs. 415 VAC distribution; **85% more power** through the same conductor size; **up to 70%** lower maintenance costs; **up to 30%** reduction in total cost of ownership. Full-scale production timed to **NVIDIA Kyber rack-scale systems in 2027**. Kyber racks reported at ~600 kW/rack with up to 576 Rubin Ultra accelerators (trade-press figure, not directly quoted from the same NVIDIA post).
- **Partner list (per NVIDIA's own post):** Silicon providers — Analog Devices, Infineon, Innoscience, MPS, Navitas, onsemi, Renesas, ROHM, STMicroelectronics, Texas Instruments. Power-system component makers — Delta, Flex Power, Lead Wealth, LITE-ON, Megmeet. Data-center power-system vendors — Eaton, Schneider Electric, Vertiv.
- **Basis:** Published spec
- **Source:** [NVIDIA Developer Blog, "NVIDIA 800 V HVDC Architecture Will Power the Next Generation of AI Factories"](https://developer.nvidia.com/blog/nvidia-800-v-hvdc-architecture-will-power-the-next-generation-of-ai-factories/) (NVIDIA, May 20, 2025).
- **Note:** the 600 kW/576-GPU Kyber rack figure came from a separate trade-press piece ([StorageReview, "NVIDIA Offers a Preview of What's Next for Gigawatt-Scale AI Factories at the OCP Global Summit"](https://www.storagereview.com/news/nvidia-offers-a-preview-of-whats-next-for-gigawatt-scale-ai-factories-at-the-ocp-global-summit)), not the 800 V efficiency blog post — label that specific rack number Industry typical, separate from the Published-spec efficiency claims above. ABB, GE Vernova, Hitachi Energy and Siemens are named as 800VDC ecosystem partners in secondary trade coverage but did not appear in the partner list on NVIDIA's own blog post as fetched — flag this as a discrepancy between NVIDIA's own list and trade-press lists that add utility-scale power vendors.

---

## 4. Board and chip

### 18. GB200 superchip

- **Power per Blackwell GPU in NVL72:** **1,200 W** (widely and consistently reported).
  - **Basis:** Industry typical / Published spec (NVIDIA itself has stated 1,200 W in conference material, though the specific NVIDIA product page fetched in this session did not print a per-GPU watt figure directly — only rack-level specs). Treat as Published spec via SemiAnalysis's direct citation of NVIDIA's own 1,200 W TDP figure.
  - **Source:** [SemiAnalysis/InferenceX, "NVIDIA GB200 NVL72 Specs, Pricing & AI Inference Benchmarks"](https://inferencex.semianalysis.com/chips/gb200-nvl72) (SemiAnalysis, 2026 — states "1,200 W TDP per chip... ~1.87 kW all-in per chip" including host CPU/NIC/cooling share).
- **Grace CPU power:** Not independently pulled as a standalone number in this session (NVIDIA's public materials emphasize the combined superchip/rack figures, not a per-CPU watt spec). **Say so: not sourced.**
- **LPDDR5X capacity:** NVIDIA's own NVL72 page states **17 TB LPDDR5X total** across 36 Grace CPUs (≈472 GB per CPU); some superchip-level (1 GPU + 1 CPU pairing) spec sheets separately cite **480 GB LPDDR5X per Grace CPU** with 512 GB/s bandwidth.
  - **Basis:** Published spec, with a minor reconciliation note: 17,000 GB / 36 ≈ 472 GB, vs. the commonly cited round "480 GB" per-CPU spec sheet number — a ~2% discrepancy, likely rounding/marketing vs. raw math.
  - **Source:** [NVIDIA, GB200 NVL72 page](https://www.nvidia.com/en-us/data-center/gb200-nvl72/) (NVIDIA); [Flopper.io, "NVIDIA GB200 Spec Sheet"](https://flopper.io/gpu/nvidia-gb200-grace-blackwell-superchip-372gb/spec-sheet) (secondary spec aggregator, cites 480 GB).
- **HBM3e capacity and stack count per GPU:** NVIDIA's own NVL72 page states **13.4 TB HBM3e total** across 72 GPUs → **≈186 GB per GPU** by direct division. Widely cited spec-sheet figure elsewhere (and commonly used in the prompt's framing) is **192 GB per GPU across 8 HBM3e stacks**. 72 × 192 GB = 13,824 GB = 13.5 TB, close to but not exactly matching NVIDIA's stated 13.4 TB total.
  - **Basis:** Published spec for both numbers; the two don't perfectly reconcile (186 GB implied vs. 192 GB spec-sheet) — likely raw/usable-capacity vs. nominal-die-capacity difference, common with HBM (some capacity reserved for redundancy/ECC). **Flag as a real, small, unresolved discrepancy** rather than picking one — use 192 GB (8-Hi × 8 stacks) as the per-die spec number, note NVIDIA's own rack-level total implies ~186 GB usable per GPU.
  - **Source:** [NVIDIA, GB200 NVL72 page](https://www.nvidia.com/en-us/data-center/gb200-nvl72/) (NVIDIA); stack count (8 stacks per GPU) is standard HBM3e packaging for Blackwell per multiple technical breakdowns, e.g. [WCCFTech, "NVIDIA Blackwell Ultra: NV-HBI..."](https://wccftech.com/nvidia-blackwell-ai-deep-dive-nv-hbi-fuse-two-ai-gpus-together-5th-gen-tensor-cores-5th-gen-nvlink-spectrum-x/).
- **Die-to-die link:** **NV-HBI** (NVIDIA High-Bandwidth Interface), a custom die-to-die interconnect providing **10 TB/s** between the two reticle-limited dies that make up one Blackwell GPU package, giving unified address space/cache coherency so software sees one GPU.
  - **Basis:** Published spec (NVIDIA's own architecture material, as quoted by trade press)
  - **Source:** [WCCFTech, "NVIDIA Deep-Dives Into Blackwell Infrastructure: NV-HBI Used To Fuse Two AI GPUs Together"](https://wccftech.com/nvidia-blackwell-ai-deep-dive-nv-hbi-fuse-two-ai-gpus-together-5th-gen-tensor-cores-5th-gen-nvlink-spectrum-x/) (WCCFTech, citing NVIDIA architecture deep-dive material).
- **Transistor count:** **208 billion transistors** per Blackwell GPU package (two reticle-limited dies of ~104B each), TSMC 4NP process.
  - **Basis:** Published spec
  - **Source:** [NVIDIA Developer Blog, "Inside NVIDIA Blackwell Ultra: The Chip Powering the AI Factory Era"](https://developer.nvidia.com/blog/inside-nvidia-blackwell-ultra-the-chip-powering-the-ai-factory-era) (NVIDIA); corroborated by WCCFTech piece above.
  - **Note:** 208B is the figure for the full dual-die package (marketed as "one GPU"); it is sometimes reported per-die (~104B) in less careful summaries — make sure the explainer states clearly which one is being visualized.

### 19. Board-level power delivery (48/54 V → 12 V IBC, VRM at ~0.8 V)

- **Value:** GPU/accelerator core operating voltage commonly cited as **0.8–1.0 V** in vertical-power-delivery industry material; current requirements for high-end accelerators reported reaching/exceeding **1,000 A**. Infineon markets stackable multiphase power modules supporting **up to 12 phases**, scaling past 1,000 A while remaining compatible with vertical (die-adjacent) placement. Vicor markets a competing Factorized Power Architecture (Lateral/Vertical Power Delivery, "LPD"/"VPD") claiming up to **95% reduction in power-delivery-network losses** versus conventional approaches and full use of the processor's package perimeter.
- **Basis:** Industry typical (vendor marketing claims, not independently benchmarked by a third party in sources found)
- **Source:** [SemiAnalysis, "Energizing AI: Power Delivery Competition Heats Up — Vicor, MPS, Delta, ADI, Renesas, Infineon"](https://newsletter.semianalysis.com/p/energizing-ai-power-delivery-competition) (SemiAnalysis); [Vicor, "Vertical Power Delivery Enables Cutting-Edge Processing"](https://www.vicorpower.com/resource-library/articles/high-performance-computing/vertical-power-delivery-enables-cutting-edge-processing) (Vicor, vendor technical article); [Power Electronics News, "Discrete Vertical Power Delivery Solutions for AI"](https://www.powerelectronicsnews.com/discrete-vertical-power-delivery-solutions-for-high-current-ai-loads/) (trade press, Infineon multiphase module description).
- **Note:** I did not find a single, specific, independently measured **48/54 V→12 V intermediate-bus-converter (IBC) efficiency percentage**, nor a specific **multiphase VRM efficiency at 0.8 V** number, nor a **typical phase count and per-phase current** figure for a named accelerator, in any primary vendor datasheet in this session. These are exactly the kind of numbers vendors treat as competitive/customer-specific (NVIDIA doesn't publish board-level VRM specs; Infineon/MPS/Vicor speak in relative terms — "up to 12 phases," "95% loss reduction" — rather than absolute efficiency percentages at a stated voltage/current point). **Label this whole item Estimate — do not put a specific IBC or VRM efficiency percentage on the page without a named datasheet backing it.**
- **H100/HGX baseboard rail voltage (audit issue 18a):** the HGX baseboard's own bus is specified as **54.0 V nominal** ("54V_BUS_IN"), not the 50 V the site's current calculator used for its current figure. Use 54 V consistently for the H100 rail (both the label and the P÷V current calculation): about **681 A** at this site's default 100 MW scenario, not the mismatched 735 A a 50 V divisor gave.
  - **Basis:** Published spec.
  - **Source:** [Open Compute Project, HGX Form Factor Specification](https://www.opencompute.org/documents/open-compute-specification-hgx-baseboard-contribution-r1-v0-1-pdf) (OCP, states the 54.0 V nominal baseboard input rail).

### 20. GPU core voltage range and current

- **Value:** ~**0.7–0.9 V** core voltage range is standard framing for modern large digital ASICs/GPUs in vertical-power-delivery industry material (~0.8–1.0 V cited in the Vicor/SemiAnalysis material above); approximate core current for a ~1,200 W GPU at ~0.8 V would be on the order of **1,000–1,500 A** by simple P=IV division (1,200 W / 0.8 V ≈ 1,500 A, though real GPUs draw across multiple voltage rails so total die current is split across domains, not one 1,500 A rail).
- **Basis:** Estimate (the voltage range is Industry typical from vendor material; the specific current figure is my own P/V arithmetic, not a sourced NVIDIA number, and is almost certainly an oversimplification since real GPU power delivery splits across several voltage domains/phases).
- **Source:** Same as item 19 (SemiAnalysis, Vicor, Power Electronics News).
- **Note: this is the weakest-sourced technical number on the page — flag clearly on the explainer as an illustrative estimate, not a measured NVIDIA figure.**

### 21. HBM share of accelerator power

- **Value:** Memory (HBM) power commonly estimated at **~8–15%** of total GPU TDP in academic/technical characterization work, expected to grow as HBM bandwidth increases generation over generation.
- **Basis:** Estimate (academic/technical estimate, not a vendor-disclosed number for any specific chip)
- **Source:** [arXiv, "Methodology for Fine-Grain GPU Power Visibility and Insights"](https://arxiv.org/html/2412.12426v1) (academic paper, cites the 8–15% range); a separate, coarser system-level breakdown (GPU ~70%, CPU ~15%, RAM ~10% of *system* power, a different scope than HBM-of-GPU-TDP) appears in some sources and should not be confused with the HBM-specific figure.
- **Note:** No NVIDIA-specific HBM3e power breakdown for Blackwell was found; the 8–15% figure is a general estimate across GPU generations/vendors, not GB200-specific.

---

## 5. Tokens

### 22. Energy/throughput per token

- **NVIDIA GB200 NVL72 (InferenceMAX / SemiAnalysis benchmarks):** GB200 NVL72 reported to deliver **~10x higher tokens per MW** than a single H200 node across a range of interactivity levels, in a 670B-parameter MoE document-querying test; a separate comparison (single H200 FP8 node vs. GB200 NVL72 FP4, no multi-token prediction) put the improvement at **~8x tokens/second per all-in provisioned MW**. On DeepSeek R1-class models, SGLang on GB200 NVL72 was reported serving **~26k input tokens/s** (prefill) and **~13k output tokens/s** (decode) per GPU under specific benchmark conditions (not a single "energy per token" joule figure).
  - **Basis:** Industry typical (SemiAnalysis benchmark suite; independently run and published, cross-checked/reported by NVIDIA's own blog as favorable coverage)
  - **Source:** [SemiAnalysis/InferenceX, "InferenceMAX: Open Source Inference Benchmarking"](https://newsletter.semianalysis.com/p/inferencemax-open-source-inference) (SemiAnalysis); [SemiAnalysis/InferenceX, "NVIDIA GB200 NVL72 Specs, Pricing & AI Inference Benchmarks"](https://inferencex.semianalysis.com/chips/gb200-nvl72); [NVIDIA Developer Blog, "NVIDIA Blackwell Leads on New SemiAnalysis InferenceMAX Benchmarks"](https://developer.nvidia.com/blog/nvidia-blackwell-leads-on-new-semianalysis-inferencemax-benchmarks/) (NVIDIA, reporting on SemiAnalysis's results); [NVIDIA blog, "Speed Demon: NVIDIA Blackwell Takes Pole Position in Latest MLPerf Inference Results"](https://blogs.nvidia.com/blog/blackwell-inferencemax-benchmark-results) (NVIDIA).
  - **Note:** these are relative multipliers ("10x", "8x tokens/MW"), not absolute joules-per-token figures for GB200 — genuinely useful for the explainer's "efficiency has improved a lot" framing, but not directly usable as an absolute J/token number without more digging into the underlying InferenceMAX dataset.
- **The site's "13,000" decode preset, named precisely (audit issue 15):** SGLang on GB200 NVL72, serving DeepSeek V3/R1 (a 671B-parameter MoE model), FP8 attention + NVFP4 MoE precision, 2,000-token input sequences: **13,386 output tokens/s per GPU** (decode) and 26,156 input tokens/s per GPU (prefill) — a 4.8x and 3.8x speedup over the equivalent H100 setup. (The same benchmark under plainer BF16 attention + FP8 MoE gives 9,087 output / 18,471 input tokens/s per GPU — cite the FP8+NVFP4 number as the one behind "13,000," not an unqualified "GB200 decode" figure.) This is a decode-only rate; it says nothing about prefill cost, concurrency or a specific interactivity target, so the site should name the model, precision and benchmark date next to the number rather than presenting it as GB200's general throughput.
  - **Basis:** Industry typical (an independently run, published benchmark; SemiAnalysis InferenceMAX v1, October 2025).
  - **Source:** [LMSYS Org, "SGLang and NVIDIA Accelerating SemiAnalysis InferenceMAX and GB200 Together"](https://www.lmsys.org/blog/2025-10-14-sa-inference-max/) (LMSYS, states the exact per-GPU prefill/decode figures and precision/input-length conditions above).
- **"From Words to Watts" (Samsi et al., 2023):** Empirical measurement on **LLaMA-65B, V100/A100 GPUs** (not H100/GB200): approximately **3–4 J per generated token**.
  - **Basis:** Published spec (peer-reviewed/preprint academic measurement, specific hardware and model stated)
  - **Source:** [arXiv 2310.03003, "From Words to Watts: Benchmarking the Energy Costs of Large Language Model Inference"](https://arxiv.org/pdf/2310.03003) (Samsi et al., October 2023).
  - **Note:** this is older-generation hardware (V100/A100) and a mid-sized (65B) dense model — not representative of current GB200/H100 inference efficiency; use only as a historical baseline on the page, not as a current number.
- **ML.ENERGY Leaderboard:** Tracks energy-per-token (J/tok) and inter-token latency across ~40 model architectures (LLM, VLM, diffusion) and multiple GPU generations (including H100, B200); leaderboard is a live, queryable dataset rather than a single fixed number — for H100 vs. B200 comparisons, the leaderboard's own summary notes results are workload/latency-constraint-dependent ("for tight latency constraints, H100 can sometimes consume less energy... for Diffusion, B200 generally wins").
  - **Basis:** Published spec (an actively maintained, methodologically documented public benchmark)
  - **Source:** [ML.ENERGY, "The ML.ENERGY Benchmark: Toward Automated Inference Energy Measurement and Optimization"](https://arxiv.org/pdf/2505.06371) (ML.ENERGY project / academic paper); [ML.ENERGY Blog, "LLM Inference Energy: A Longitudinal Analysis"](https://ml.energy/blog/measurement/energy/llm-inference-energy-a-longitudinal-analysis/); live data at ml.energy.
  - **Note:** because it's a live leaderboard, any specific J/tok number pulled today should be re-checked against the live site at build time rather than hard-coded from this research pass.
- **MLPerf Inference (MLCommons) power submissions:** MLPerf Inference v5.1 (Sept 2025) includes datacenter and edge power-measurement submissions (a data-center submission from Lenovo, an edge submission from GATEOverflow, per MLCommons's own release), combining throughput results with power measurements. I was not able to pull a specific GB200 joules-per-token number from the publicly available MLCommons/NVIDIA blog summaries in this session — the underlying numbers exist in MLCommons's results database/tables, which would need a direct query (mlcommons.org results explorer) rather than the blog summaries fetched here.
  - **Basis:** Published spec exists (MLCommons results are audited and public) but **the specific number was not retrieved — say so.**
  - **Source:** [MLCommons, "MLCommons Releases New MLPerf Inference v5.1 Benchmark Results"](https://mlcommons.org/2025/09/mlperf-inference-v5-1-results/) (MLCommons, Sept 2025).
- **Google Gemini per-prompt energy disclosure:** Median Gemini Apps **text** prompt: **0.24 Wh** energy, **0.03 gCO2e**, **0.26 mL** water, as measured by Google's own in-situ telemetry across its fleet (energy figure includes accelerator + host CPU + idle/backup capacity + cooling overhead — a full-stack "measured PUE-inclusive" number, not just the chip). Google states energy and carbon footprint per prompt dropped 33x and 44x respectively over the trailing 12 months (methodology improvements + efficiency gains, as of the disclosure date).
  - **Basis:** Published spec (company's own measured disclosure, first of its kind at this granularity)
  - **Source:** [Google Cloud Blog, "Measuring the environmental impact of AI inference"](https://cloud.google.com/blog/products/infrastructure/measuring-the-environmental-impact-of-ai-inference/) (Google, May 2025); widely corroborated in trade press, e.g. [MIT Technology Review, "In a first, Google has released data on how much energy an AI prompt uses"](https://www.technologyreview.com/2025/08/21/1122288/google-gemini-ai-energy/) (Aug 2025) and [Data Center Dynamics coverage](https://www.datacenterdynamics.com/en/news/google-median-gemini-prompt-uses-024-watt-hours-of-power-and-consumes-026ml-of-water/).
  - **Note:** explicitly limited to **text** prompts (median case); Google's own post says image/video generation costs substantially more — do not extrapolate this number to image/video use cases on the explainer.

---

## Gaps and conflicts

**Not found / no source located (say so rather than invent):**
- A single sourced "gensets per 100 MW" ratio (item 5) — genset sizing/redundancy is project-specific.
- A single sourced "24–72 h on-site fuel" design standard as a named code or standard (item 5) — commonly used in RFPs, but no single citable standard found.
- Li-ion UPS runtime in minutes as a fixed spec (item 9) — configurable by battery-string sizing, not a fixed vendor number.
- A blanket answer on whether GPUs sit on UPS in AI halls (item 9) — architecture-dependent, no single source states a rule.
- Grace CPU standalone power draw in watts (item 18).
- 48/54 V→12 V IBC efficiency percentage and multiphase VRM efficiency at 0.8 V, with phase count/per-phase current for a named accelerator (item 19) — vendors describe these only in relative/marketing terms.
- A single absolute joules-per-token number for GB200 NVL72 from an audited source (MLPerf Power results exist but the number wasn't retrieved in this session — see item 22).

**Real or apparent conflicts found:**
- **GB200 rack weight:** ~1,360 kg (single-rack figure in some integrator guides) vs. a ~3,000 kg component breakdown that appears to describe a multi-rack cluster unit (compute rack + switch rack + CDU + PDU), not one 72-GPU rack (item 13). Needs a primary NVIDIA/OEM datasheet to resolve before using either number confidently.
- **GB200 HBM3e per GPU:** NVIDIA's own rack-level total (13.4 TB / 72 GPUs ≈ 186 GB) doesn't exactly match the widely cited 192 GB (8×24 GB stacks) per-GPU spec-sheet figure (item 18) — likely raw vs. usable capacity, not resolved here.
- **GB200 LPDDR5X per Grace CPU:** NVIDIA's rack total (17 TB / 36 CPUs ≈ 472 GB) vs. commonly cited 480 GB per-CPU spec sheet (item 18) — same pattern, ~2% gap, not resolved.
- **PUE numbers for Google/Meta/Microsoft (item 10):** Google's own page gave a clean, directly-fetched Published-spec number (1.09 TTM). Meta and Microsoft numbers in wide circulation (~1.08–1.09 and ~1.15) could not be directly confirmed against either company's own live sustainability page in this session — treat as Industry typical pending direct verification against their PDFs/reports.
- **NVIDIA's 800VDC partner list (item 17):** NVIDIA's own blog names a specific set of silicon/power-system/DC-power vendors; some trade coverage adds ABB, GE Vernova, Hitachi Energy and Siemens as "ecosystem partners" — these did not appear in the specific NVIDIA blog post fetched, so the wider list should be treated as broader industry framing, not NVIDIA's own official partner roster, unless found on a page not fetched here.
- **A common claim that turned out shakier than expected:** the "80 PLUS Titanium" framing for OCP ORv3 GB200 power shelves (item 14) is an analogy used in trade coverage, not a certification NVIDIA/OCP is shown applying to this specific product in the sources checked — don't present it as a certified spec on the page.

**stack_ledger reuse note:** stack_ledger's `research/catalog.json` / `research/sources.json` provided corroborating source IDs for the Stargate Abilene and Colossus/GB200/GB300 campus entries (e.g., `epoch-openai-stargate-abilene`, `spacex-prospectus-2026`), but its data model stores chart-axis bounds rather than point values in the fields inspected, so the actual MW numbers above were sourced directly from Epoch AI / trade press rather than reverse-engineered from stack_ledger's JSON. If exact point-in-time MW series are needed later, stack_ledger's `docs/data/ledger.json` (not fully inspected in this pass) likely holds the actual time-series values keyed to these same catalog IDs.
