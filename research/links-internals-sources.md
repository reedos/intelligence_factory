# The Intelligence Factory — "Inside the Links" Fact Sheet (Copper + Coherent)

Sourced figures for two new millimeter/centimeter-scale stations extending "Inside the optics"
into "Inside the links": (1) COPPER — a passive DAC cable head, an ACC (linear redriver) head,
an AEC (retimer-each-end) head, and the NVIDIA GB200/GB300 NVL72 NVLink spine; (2) COHERENT —
an 800ZR/800ZR+ pluggable's DSP, tunable laser, IQ modulator, and coherent receiver, plus an
optional EDFA internals note. Compiled 09/28/2026.

Read first, not re-derived except where flagged: `research/copper-optics-sources.md` (its
Sections 1, 2 and 5 already source DAC/ACC/AEC reach and power, and the NVL72 spine "passive
vs. active" question — this file adds physical/component-layout facts those sections don't
cover, and points back rather than re-quoting), `research/interconnect-sources.md`,
`research/interconnect-physical-sources.md` (Section 1 already sources the NVL72 spine's link
count, cartridge count and connector family), and `research/optics-internals-sources.md` (the
DSP-pluggable and CPO fact sheet already built for this level — its Section B on DSP function
and Section C on lasers/modulators/receivers is the direct-detect analog of this file's
coherent section and is cited, not repeated).

`src/sources.js` ids reused: `oif-400zr-ia`, `edgeoptic-400g-coherent-guide`,
`ascentoptics-coherent-power-consumption` / `ascentoptics-coherent-power` (same source, two
ids in the file), `smartoptics-400zr-dci`, `lightwaveonline-wavelogic6`, `ciena-wavelogic6`,
`ciena-wavelogic6-nano`, `coherent-full-cband-pols`, `coherent-1p6t-dr8` (a Coherent Corp.
DR8 datacom module — not itself coherent-modulation; kept distinct here from the coherent-ZR
line), `ascentoptics-osfp-form-factor`, `nvidia-gb200-nvl72`, `nvidia-gb300-nvl72`,
`nvidia-nvl72-reference-arch`, `semianalysis-nvl72-optics`.

Basis labels match the rest of the site: **Published spec** (a vendor, MSA or standards body
states it), **Industry typical** (trade press/reference designs agree), **Estimate** (derived
here or sources conflict), **Vendor claim** for one company's own marketing number. Check date
for every row below: 09/28/2026.

---

## 1. COPPER — passive DAC, ACC, and AEC cable heads

### 1a. What's inside each head (construction)

| Item | Value | Basis | Sources |
|---|---|---|---|
| DAC (passive) head construction | No active electronics at all: twinax copper pairs terminate directly at the connector's PCB/flex, which carries only the connector's mechanical contacts and (per standard pluggable-cable practice) an EEPROM for CMIS module identification — no redriver, no retimer, no DSP. Signal passes through unchanged except for the cable's own resistive/dielectric loss | Published spec (structure) / Industry typical (the EEPROM-only claim, not separately vendor-confirmed for DAC specifically this pass) | [Flexoptix, "DAC, ACC, or AEC?"](https://www.flexoptix.net/en/blog/blog/dac-acc-or-aec) — "pure twinax copper with no active signal processing at all"; [AscentOptics, "Understanding High-Speed Copper Cables: DAC, ACC, and AEC"](https://ascentoptics.com/blog/understanding-high-speed-copper-cables-dac-acc-and-aec/) — DAC "primarily consists of copper conductors and connector modules" |
| ACC head construction | One redriver/equalizer chip inside the connector shell, on the receive (Rx) end per most descriptions (some vendor implementations put a chip at both ends) — an analog CTLE (continuous-time linear equalizer) plus a linear driver, mounted on a small PCB inside the connector housing alongside the EEPROM; no clock-data-recovery block | Published spec (function) / Industry typical (the "one end, typically Rx" placement detail — NVIDIA's own LACC datasheet does not specify which end) | [NADDOD, "Comparing AOC, DAC, ACC, and AEC Cables for AI and Data Center Networks"](https://www.naddod.com/blog/a-complete-overview-of-aoc-dac-acc-and-aec-cables) — "a Redriver chip integrated at one end of the cable, typically the receiver (Rx) end"; [Flexoptix, "DAC, ACC, or AEC?"](https://www.flexoptix.net/en/blog/blog/dac-acc-or-aec) — "a small piece of active electronics inside the connectors: a redriver/equalizer" |
| AEC head construction | One DSP-based retimer chip inside the connector shell at *each* end (two chips per cable) — integrates CTLE, DFE (decision feedback equalization), CDR (clock-data recovery) and FIR-shaped output drivers; this is the same class of chip that goes into a DSP-retimed optical module's electrical side, just packaged into a cable connector instead of a transceiver housing | Published spec | [NADDOD, "Comparing AOC, DAC, ACC, and AEC Cables"](https://www.naddod.com/blog/a-complete-overview-of-aoc-dac-acc-and-aec-cables) — "The Retimer chip in AEC... integrating CTLE, DFE, CDR, and FIR drivers"; [Flexoptix, "DAC, ACC, or AEC?"](https://www.flexoptix.net/en/blog/blog/dac-acc-or-aec) — "a DSP-based retimer" at each end, "2 total per cable" |
| Physical head size, general | No public dimensional drawing found for the internal PCB/chip footprint inside a DAC/ACC/AEC connector housing specifically (as opposed to the OSFP/QSFP-DD *cage* dimensions, which are the same MSA envelope already sourced in `research/optics-internals-sources.md`, Section A) | — | Searched directly; not found |
| A labeled teardown photo of a DAC, ACC, or AEC connector head | Not found publicly this pass | Not found publicly | Searched multiple queries (teardown, internal photo, PCB); no vendor or third-party teardown with parts labeled was located, matching `optics-internals-sources.md`'s same finding for pluggable modules |

### 1b. Power, reach — reused from `copper-optics-sources.md`, one correction flagged

| Item | Value | Basis | Sources |
|---|---|---|---|
| ACC power, 200 Gb/s/lane class | ≈2–3 W/end (already sourced) | Industry typical | `copper-optics-sources.md`, Section 2 |
| ACC power, general/older-generation figure found this pass | 1.2–1.8 W total (i.e., per cable, not per end) — a lower figure than the per-end numbers above; likely describes a lower lane-rate generation, not directly reconciled this pass | Industry typical | [AscentOptics, "Understanding High-Speed Copper Cables"](https://ascentoptics.com/blog/understanding-high-speed-copper-cables-dac-acc-and-aec/) — "1.2–1.8W" |
| AEC power, 200 Gb/s/lane class (already sourced) | ≈20 W/end | Industry typical | `copper-optics-sources.md`, Section 2 |
| **AEC power, new figure found this pass — conflicts with the above** | "Roughly 10–13 W per cable end at 800G (~21–26 W total); ~4 W per end at 400G (~8 W total)" | Industry typical | [AscentOptics, "Understanding High-Speed Copper Cables"](https://ascentoptics.com/blog/understanding-high-speed-copper-cables-dac-acc-and-aec/) |
| **AEC power, third figure found this pass** | 2.5–12 W per end (a wide range spanning generations) | Industry typical | [NADDOD, "Comparing AOC, DAC, ACC, and AEC Cables"](https://www.naddod.com/blog/a-complete-overview-of-aoc-dac-acc-and-aec-cables) |
| DAC head reach, general (not lane-rate-specific) | Up to 5 m at lower data rates; 1–2 m at 800G-class signaling | Industry typical | [Flexoptix, "DAC, ACC, or AEC?"](https://www.flexoptix.net/en/blog/blog/dac-acc-or-aec) |

**Conflict flagged, not resolved:** three AEC power figures collected this pass (10–13 W/end at 800G; 2.5–12 W/end general; and the ≈20 W/end at 200G/lane already in `copper-optics-sources.md`, sourced to Vik's Newsletter) do not cleanly reconcile — they may describe different lane rates, different reach targets within the AEC family, or simply reflect trade-press imprecision. `copper-optics-sources.md`'s own Section 2 already carries a similar spread (≈4.5 W/end for an older 56G/lane generation vs. ≈20 W/end at 200G/lane) and frames it as a generational range rather than one number; this file's new figures fit inside that same range and should be treated the same way — state AEC power as "roughly 4–20+ W per end, rising sharply with lane rate and reach," not a single figure, if the card needs one number.

---

## 2. COPPER — NVIDIA GB200/GB300 NVL72 NVLink spine (consolidated, not re-derived)

Every fact below already has a full citation in `copper-optics-sources.md` (Section 5) or
`interconnect-physical-sources.md` (Section 1). This section only consolidates them for the
"Inside the links" copper station so a card writer doesn't have to open three files.

| Item | Value | Basis | Already sourced in |
|---|---|---|---|
| What it is | A cable-cartridge backplane at the rear of the rack carrying every GPU-to-NVSwitch NVLink connection — not individual point-to-point cables run by hand | Published spec | `interconnect-physical-sources.md`, Section 1 |
| Cable/link count | 1,296 individual NVLink connections (18 links/GPU × 72 GPUs); each link is 4 differential pairs, for 5,184 total copper connections — reconciles with ServeTheHome's independently reported "5,184" figure and NVIDIA's own ">5,000" framing | Published spec (the >5,000 figure) / Industry typical (the exact 1,296×4=5,184 arithmetic) | `interconnect-physical-sources.md`, Section 1 |
| Total cable length | >2 miles (≈3.2 km) of copper in the backplane — cross-checked by an independent academic source (3.2 km, 1.5 mm² cross-section) | Industry typical | `copper-optics-sources.md`, Section 5; `interconnect-physical-sources.md`, Section 1 |
| Cartridge count | 4 NVLink cartridges, per NVIDIA's own OCP-contribution wording, corroborated by Lenovo's GB300 NVL72 docs describing a 4-unit cable cartridge backplane. **Flagged, not resolved:** third-party resale listings for the same spine describe conflicting cartridge form factors ("18×1RU," "9×2RU") that don't reconcile with "4" — these are secondhand-parts listings, not vendor documentation, and should not be used as a primary source | Published spec (NVIDIA's own "4 cartridges" wording, via trade quotation) / Industry typical (Lenovo corroboration) | `interconnect-physical-sources.md`, Section 1 |
| Connector family | Amphenol Paladin HD 224 Gb/s backplane interconnect system — general product-line spec is published (Amphenol), but the specific "used in GB200 NVL72, 72 differential pairs/connector" attribution traces only to trade press, not a fetched NVIDIA or Amphenol datasheet naming the program | Industry typical | `interconnect-physical-sources.md`, Section 1 |
| Lane rate | 224 Gb/s PAM4 (the same signaling rate as NVLink 5's 100 GB/s-per-link figure implies, given IEEE 802.3dj/OIF CEI-224G as the underlying SerDes generation) — not stated verbatim by NVIDIA itself | Industry typical | `interconnect-sources.md`, Section 1 |
| Passive or active | Passive by the industry ACC/AEC definition (no redriver or retimer chip inside the cable) — this file's own Section 1a construction facts above are what "passive" means physically. NVIDIA's own documentation is internally inconsistent in its *wording*: its DGX GB200 user guide calls the spine a "passive copper cable cartridge backplane," while its OCP-contribution developer blog calls the same cables "over 5,000 active copper cables." A third-party technical analysis states flatly that all NVIDIA scale-up copper is passive; the likelier reading of NVIDIA's own "active" wording is "actively carrying live links," not the ACC/AEC engineering term | Published spec (both NVIDIA quotes are its own) | `copper-optics-sources.md`, Section 5 (full quotes and both source URLs there) |
| What optics would have cost instead | Jensen Huang, GTC 2024 keynote (per a fan transcription, not NVIDIA's own published transcript): optics for the same spine would have cost ≈20 kW that NVIDIA avoided by using copper | Published spec (keynote quote, secondary transcription) | `copper-optics-sources.md`, Section 5 |
| Reach | Implicit: within one rack's rear cable-cartridge span — NVIDIA does not publish an exact meter figure for the spine cable run itself; the general "passive copper ≈1 m at 224G/lane" objective (IEEE P802.3dj, draft) is the closest sourced reach figure for this lane-rate class, not a spine-specific measurement | Published spec (the general 224G/lane objective) / Not found publicly (a spine-specific cable-run length) | `copper-optics-sources.md`, Section 1 |
| GB300 NVL72 vs. GB200 NVL72 spine differences | No public source found this pass stating the GB300 spine differs physically from the GB200 spine (cartridge count, connector, or cable count) — treat as the same spine design across both generations unless a GB300-specific source is found | — | Not found publicly (searched this pass; `nvidia-gb300-nvl72` describes the compute tray, not the spine) |

---

## 3. COHERENT — 800ZR / 800ZR+ pluggable

### 3a. The OIF 800ZR / 800ZR+ agreements

| Item | Value | Basis | Sources |
|---|---|---|---|
| OIF-800ZR-01.0 publication date | 10/30/2024 | Published spec | [OIF, "OIF Releases 800ZR Coherent Interface Implementation Agreement (IA)"](https://www.oiforum.com/oif-releases-800zr-coherent-interface-implementation-agreement-ia-and-key-400zr-ia-updates-addressing-market-demands-for-scalable-interoperable-high-capacity-solutions/); primary IA text at [oiforum.com/OIF-800ZR-01.0.pdf](https://www.oiforum.com/wp-content/uploads/OIF-800ZR-01.0.pdf) (PDF downloaded but rendered only as unreadable binary to this session's fetch tool, the same PDF limitation already noted for OIF-400ZR-02.0 and P802.3dj in the copper-optics sheet — figures below are via trade-press restatement of the IA, not a direct primary read) |
| 800ZR symbol rate | 118.2 GBd (nominal), dual-polarization | Published spec (IA-derived, trade-restated) | [MapYourTech, "800ZR and 800ZR+: The Coherent Pluggable Wave"](https://mapyourtech.com/800zr-and-800zr-the-coherent-pluggable-wave/); [FiberMall, "800G ZR & ZR+ Coherent Modules"](https://www.fibermall.com/blog/800g-zr-zr-coherent-guide.htm) — both state "DP-16QAM at roughly 118 Gbaud" |
| 800ZR+ symbol rate range | Described elsewhere on the site (task prompt) as ~118–131 GBd; this pass's sources state 800ZR/800ZR+ both run "~118 Gbaud" for the interoperable OIF mode, with proprietary/flexible ZR+ implementations (e.g., Ciena WaveLogic 6 Nano) reaching higher — WaveLogic 6 Nano is stated at "118–140 GBd," including a "135 GBaud PKT-MAX" mode | Published spec (Ciena's own figure) / Industry typical (the OIF-mode figure) | [Ciena, WaveLogic 6 Nano infobrief](https://www.ciena.com/insights/infobriefs/wavelogic-6-nano-400g-800g-enhanced-pluggable-transceivers) (via search-summary; already partially cited as `ciena-wavelogic6-nano` for a different WL6n page) |
| Modulation | DP-16QAM (dual-polarization 16-state QAM) for both 400ZR and 800ZR/800ZR+ under the OIF-interoperable mode; ZR+ implementations can step down to QPSK/8QAM for extended reach at lower capacity | Published spec | Same MapYourTech and FiberMall sources above |
| Channel spacing | 150 GHz on the ITU-T G.694.1 flexible grid (already sourced in `interconnect-physical-sources.md`, Section 7, via a secondary MapYourTech summary — reused here, not re-derived) | Published spec (secondary-summarized) | `interconnect-physical-sources.md`, Section 7 |
| Reach, 800ZR | 80–120 km on a single amplified DWDM span; ≈75 km unamplified — reach class stated identically to the 400ZR figures already in `copper-optics-sources.md`, Section 6, at a doubled data rate | Published spec | [MapYourTech, "800ZR and 800ZR+"](https://mapyourtech.com/800zr-and-800zr-the-coherent-pluggable-wave/); Cisco's own datasheet (below) states "Up to 120 km amplified DWDM" |
| Reach, 800ZR+ | 600–1,000+ km (vendor-dependent; not a single OIF-interoperable figure — ZR+ implementations diverge by vendor). Cisco's own datasheet: "Over 1000 km amplified DWDM" | Published spec (Cisco's own figure) / Industry typical (the broader vendor-dependent range) | [Cisco, "QSFP-DD and OSFP 800G ZR/ZR+ Coherent Optics Modules Data Sheet"](https://www.cisco.com/c/en/us/products/collateral/interfaces-modules/transceiver-modules/qsfp-dd-osfp-800g-zr-zr-plus-coherent-optics.html), dated 7/13/2026; [FiberMall, "800G ZR & ZR+ Coherent Modules"](https://www.fibermall.com/blog/800g-zr-zr-coherent-guide.htm) |
| Module power, 800ZR | 24–25 W (one source) or 20–30 W (a second, wider-banded source) — treat as ≈24–30 W, generation-dependent, not one fixed number | Industry typical | [FiberMall, "800G ZR & ZR+ Coherent Modules"](https://www.fibermall.com/blog/800g-zr-zr-coherent-guide.htm) — "24-25 W"; [FiberMall, "Coherent Optical Modules: The Complete Guide"](https://www.fibermall.com/blog/coherent-optical-module-guide.htm) — "20-30W" for the same 800G ZR tier |
| Module power, 800ZR+ | 26–32 W | Industry typical | [FiberMall, "800G ZR & ZR+ Coherent Modules"](https://www.fibermall.com/blog/800g-zr-zr-coherent-guide.htm) |
| Module power, not confirmed in Cisco's own datasheet | Cisco's data sheet states only "QSFP-DD type 2B compliant, OSFP power class 8" — no watt figure given directly; do not invent one, use the FiberMall trade-press range above and flag it as trade-sourced, not Cisco's own number | — | Same Cisco datasheet |
| Form factor | OSFP and QSFP-DD, same MSA envelope as the DSP-pluggable dimensions already sourced in `research/optics-internals-sources.md`, Section A (OSFP: 22.58 × 107.8 × 13.0 mm IHS variant) — OSFP is generally preferred for 800ZR/ZR+ specifically for its larger thermal budget | Published spec (MSA envelope, reused) / Industry typical (the OSFP-preference framing) | [FiberMall, "800G ZR & ZR+ Coherent Modules"](https://www.fibermall.com/blog/800g-zr-zr-coherent-guide.htm) — "OSFP recommended for thermal reasons"; envelope reused from `optics-internals-sources.md` |
| Optical connector | LC duplex (single fiber pair in, single fiber pair out — unlike the multi-fiber MPO connectors used by direct-detect DR8/FR4 optics, because coherent transmission puts all the capacity on one wavelength pair rather than spreading it across parallel fibers) | Published spec | Cisco's own 800G ZR/ZR+ datasheet — "Connector: LC duplex" |
| Wavelength tunability | C-band: 1528.58–1567.34 nm; L-band: 1570.21–1610.49 nm (Cisco's own figures, for the 800G ZR+ L-band-capable variant); transmit power >+1 dBm, C-band | Published spec | Same Cisco datasheet |

### 3b. The four functional blocks inside the module

| Item | Value | Basis | Sources |
|---|---|---|---|
| The module's own four-block description | A coherent ZR/ZR+ module is consistently described (independent of vendor) as four functional blocks: (1) a tunable laser (ITLA) generating a stable single-wavelength carrier; (2) a coherent driver modulator (CDM) that encodes data onto the light by modulating phase and amplitude; (3) an integrated coherent receiver (ICR) that mixes the incoming signal with a local-oscillator tap through a 90-degree optical hybrid and balanced photodetectors; (4) a DSP that performs signal shaping, equalization, FEC, carrier recovery, polarization demultiplexing and impairment compensation | Published spec (consistent trade-technical description, not one single vendor's block diagram) | [FiberMall, "Coherent Optical Modules: The Complete Guide (100ZR to 800ZR)"](https://www.fibermall.com/blog/coherent-optical-module-guide.htm) — states all four blocks in this language directly |
| Same four-block framing, second source | "narrow linewidth tunable laser, Silicon Photonics Modulator, coherent receiver, and coherent digital signal processor (DSP)... compressed into a faceplate module" | Published spec | [AscentOptics, "OSFP ZR Coherent: 400G & 800G DCI Guide"](https://ascentoptics.com/blog/osfp-zr-coherent/) |
| A labeled internal teardown photo of an 800ZR module | Not found publicly this pass — searched directly; results returned vendor product pages and datasheets, none with an internal photo or parts-labeled cross-section | Not found publicly | Searched via WebSearch; no result located |
| No public block diagram with dimensions/placement | The four-block functional description above is consistently repeated across sources, but no source this pass provided a dimensioned or positioned internal layout (where the ITLA sits relative to the CDM, ICR and DSP inside the module PCB) — treat any specific physical arrangement on the page as an assumption, not a sourced fact | Not found publicly | Searched directly across FiberMall, AscentOptics, Cisco, Coherent Corp. and Marvell material |

### 3c. Coherent DSP vendors

| Item | Value | Basis | Sources |
|---|---|---|---|
| Coherent DSP market — who actually makes one | Only a small number of companies have their own coherent DSP: Cisco (via its Acacia acquisition), Marvell, Ciena, and Nokia (via its Infinera acquisition). This is a materially shorter list than the PAM4/direct-detect DSP market (Broadcom, Marvell, MaxLinear, others) covered in `optics-internals-sources.md`, Section B | Industry typical | [Cignal AI, "Tracking the Coherent DSP Supply Chain - 2026"](https://cignal.ai/2026/04/tracking-the-coherent-dsp-supply-chain-2026/) (title/framing via search-summary, not independently re-fetched in full this pass); corroborated by [photonera.substack.com, "Cisco: The Undisputed Leader Dominating Coherent Communications"](https://photonera.substack.com/p/company-deep-dive-cisco-the-undisputed) |
| **Broadcom does not field a coherent DSP** | Broadcom's DSP portfolio (Sian3, BCM8780x/BCM85812/BCM87812) is PAM4 direct-detect silicon for DR8/FR4-class optics and CPO, not coherent-modulation silicon — confirmed by searching directly for a Broadcom coherent/800ZR DSP and finding none; trade commentary states Broadcom is "weak in coherent DSPs" and coherent-DSP market surveys list only Cisco/Marvell/Ciena/Nokia | Industry typical | Same photonera.substack.com piece — "Broadcom excels in switch ASICs and general-purpose DSPs but is weak in coherent DSPs"; corroborated by the absence of any Broadcom coherent product in the Cignal AI coverage above. The task prompt's example list ("e.g., Marvell Orion, Ciena WaveLogic 6 Nano, Broadcom, others") should therefore not present Broadcom as a coherent-DSP peer to Marvell/Ciena on the page — it is not one |
| Marvell Orion | Marvell's 800ZR/ZR+ coherent DSP, paired with its own COLORZ 800 module (silicon-photonics-based). Announced 8/23/2023. Supports symbol rates "in excess of 130+ GBd." Third-generation Marvell optical module product (after 100G direct-detect and 400ZR coherent) | Published spec (existence, date, symbol-rate claim) | [Gazettabyte, "Marvell kickstarts the 800G coherent pluggable era"](https://www.gazettabyte.com/home/2023/10/26/marvell-kickstarts-the-800g-coherent-pluggable-era.html) (via search-summary — the page itself 404'd on direct WebFetch this pass); [Cignal AI, "Marvell Delivers Industry's First Pluggable Coherent 800 Gbps DSP and Module"](https://cignal.ai/2023/08/marvell-delivers-industrys-first-pluggable-coherent-800-gbps-dsp-and-module/), 8/2023 |
| Marvell Orion — process node, exact power figure | Not independently confirmed this pass — Marvell's own product-brief PDFs (both the Orion DSP brief and the COLORZ 800 module brief) returned HTTP 403 on every direct fetch attempt, the same domain-wide block already noted in `optics-internals-sources.md` and `copper-optics-sources.md` | Not found publicly (this session's tooling) | Both PDFs found via search but inaccessible: [marvell.com Orion product brief](https://www.marvell.com/content/dam/marvell/en/public-collateral/dsp/marvell-coherent-dsp-orion-product-brief.pdf); [marvell.com COLORZ 800 product brief](https://www.marvell.com/content/dam/marvell/en/public-collateral/optical-modules/marvell-optical-module-colorz-800-zr-zr+-product-brief.pdf) |
| Cisco/Acacia Delphi DSP | 800ZR and 800G ZR+ modules using Cisco's own "Delphi" DSP launched in 2024; 800ZRx (a further Cisco/Acacia generation) forecast to ship >200,000 ports in 2026 | Industry typical | Search-summary from the photonera.substack.com and Cignal AI pieces above — the specific "Delphi" name and port forecast were not independently re-verified against a Cisco or Acacia primary page this pass; flag before quoting the exact port count as Cisco's own figure |
| Ciena WaveLogic 6 Nano (WL6n) | Ciena's DSP/coherent-optics platform for 400G–1.6T pluggables, covering interoperable 800ZR for metro DCI and proprietary 800G ZR+ to 1,000 km; baud rate 118–140 GBd, including a 135 GBaud "PKT-MAX" mode | Published spec | [Ciena, "WaveLogic 6 Nano" infobrief](https://www.ciena.com/insights/infobriefs/wavelogic-6-nano-400g-800g-enhanced-pluggable-transceivers) (via search-summary); already partially cited in `src/sources.js` as `ciena-wavelogic6-nano` |
| Nokia (Infinera) coherent DSP | Named in the coherent-DSP vendor list above; no further Nokia/Infinera-specific 800ZR product detail (part name, power figure) was pulled this pass — would need a dedicated search before citing a specific Nokia part | Not found publicly (not pursued this pass, out of scope for the copper/coherent brief requested) | — |

### 3d. Tunable laser: ITLA / micro-ITLA / nano-ITLA

| Item | Value | Basis | Sources |
|---|---|---|---|
| Form-factor shrink, three generations | Original ITLA (OIF standard, 2011): 74 mm × 30.5 mm (L×W). Micro-ITLA (~2015, OIF MSA): 37.5 mm × 20.0 mm — roughly one-third the ITLA footprint. Nano-ITLA (~2021, sized for QSFP-DD/OSFP): 25.0 mm (L) × 15.6 mm (W) × 6.5 mm (H) — roughly half the micro-ITLA footprint again | Published spec | [Laser Focus World, "Tunable external-cavity lasers power high-speed coherent transmission"](https://www.laserfocusworld.com/lasers-sources/article/14206767/tunable-external-cavity-lasers-power-high-speed-coherent-transmission) (ITLA/micro-ITLA history, via search-summary); [Optical Connections News, "NeoPhotonics' Nano-ITLA... enable 400G and beyond coherent OSFP and DD-QSFP modules"](https://opticalconnectionsnews.com/2019/03/ofc-neophotonics-nano-itla-extends-ultra-narrow-linewidth-performance-to-enable-400g-and-beyond-coherent-osfp-and-dd-qsfp-modules/) (nano-ITLA dimensions, via search-summary); underlying MSA text at [OIF Micro-ITLA IA (01.1)](https://www.oiforum.com/wp-content/uploads/2019/01/OIF-Micro-ITLA-01.1.pdf) and [OIF ITLA MSA (01.3)](https://www.oiforum.com/wp-content/uploads/2019/01/OIF-ITLA-MSA-01.3.pdf), neither independently re-fetched this pass (consistent with this project's repeated OIF-PDF rendering limitation) |
| Nano-ITLA power/tuning, one commercial example | EFFECT Photonics nITLA17: 17 dBm output, 191.3–196.1 THz tuning range (C-band), <300 kHz linewidth, 2.9 W power consumption, OIF ITLA MSA 01.3 compliant, targeted at 400G ZR/ZR+/800G ZR | Published spec (vendor datasheet) | [EFFECT Photonics, "17 dBm nano ITLA for 400/800G coherent transceivers"](https://effectphotonics.com/products/nitla17/) |
| Nano-ITLA power, second source's figure | "Less than 3 W total power consumption," 120 ITU-grid channel switching over 48 nm | Published spec | Same Optical Connections News source above — consistent with, not contradicting, the EFFECT Photonics 2.9 W figure |
| Nano-ITLA pigtail and board connection, one commercial example | LD-PD NITLA-C-17: PANDA polarization-maintaining fiber pigtail, fiber bend radius 5 mm or more, Molex 5054761010 board-to-board connector (fetched 09/30/2026; used for the coherent level's pigtail and flex-tail row) | Published spec (vendor datasheet) | [LD-PD, "Nano Integrable Tunable Laser Assembly of C band (NITLA-C-17)"](https://www.ld-pd.com/?a=cp3&id=862) |
| What makes a nano-ITLA possible | Monolithic InP photonic-integrated-circuit design: gain medium, phase-control sections and highly selective filters integrated on one chip for mode-hop-free tuning — an evolution of the same external-cavity architecture used in the larger ITLA/micro-ITLA generations, not a different laser technology | Published spec (vendor's own technical framing) | [EFFECT Photonics, nITLA17 product page](https://effectphotonics.com/products/nitla17/) |
| Which laser generation 800ZR modules actually use | Not confirmed to one specific generation this pass — nano-ITLA is explicitly marketed for "400G ZR/ZR+/800G ZR," and micro-ITLA remains in use in some current products; no source found stating 800ZR modules exclusively use one generation over the other | Not found publicly (as an exclusive claim) | Inferred from the overlapping vendor-marketing claims above; flag before stating "800ZR always uses nano-ITLA" as fact |

### 3e. IQ modulator and coherent receiver

| Item | Value | Basis | Sources |
|---|---|---|---|
| Coherent driver modulator (CDM) — what it is | The OIF-standardized modulator+driver assembly that encodes data onto the laser's light by modulating phase and amplitude (an IQ modulator) — packaged with an integrated RF driver IC | Published spec | [FiberMall, "Coherent Optical Modules: The Complete Guide"](https://www.fibermall.com/blog/coherent-optical-module-guide.htm); OIF's own handbook, [OIF-HB-CDM-01.0](https://www.oiforum.com/wp-content/uploads/2019/01/OIF-HB-CDM-01.0.pdf) (not independently re-fetched this pass) |
| CDM material platforms | Historically lithium niobate (LiNbO3); OIF has separately defined High-Bandwidth CDM (HB-CDM) for rates up to 64 GBd; a newer, smaller-form-factor InP-based modulator standard was, per one source, "presently being defined by the OIF" as an evolution beyond LiNbO3; silicon-photonics IQ modulators are also in commercial/research use for 800ZR-class modules | Published spec (OIF CDM/HB-CDM existence) / Industry typical (the InP-standard-in-progress claim, and the SiPh-vs-InP split, both via search-summary, not independently re-verified against a primary OIF document this pass) | Search-summary synthesis citing [OIF-HB-CDM-01.0](https://www.oiforum.com/wp-content/uploads/2019/01/OIF-HB-CDM-01.0.pdf); [Lumentum, "High-Bandwidth Coherent Driver Modulator (HB-CDM)"](https://www.lumentum.com/en/products/high-bandwidth-coherent-driver-modulator) — states the HB-CDM mechanical outline as the OIF Type 1 MSA size, 30 mm × 12 mm × 6.5 mm, with an SOA (semiconductor optical amplifier) embedded in the modulator structure |
| Silicon-photonics IQ modulator research demonstration | An all-silicon IQ modulator demonstrated at 120 GBaud, 16-QAM, aimed explicitly at data-center-interconnect applications — a research paper, not a confirmed shipping 800ZR part | Industry typical (peer-reviewed, not a named commercial product) | [Optica, "120-GBaud 16-QAM silicon photonics IQ modulator for data center interconnection"](https://opg.optica.org/viewmedia.cfm?r=1&rwjcode=oe&uri=oe-31-16-25515&html=true) |
| Marvell COLORZ 800's modulator | Marvell's own COLORZ 800 marketing describes "SiPho technology" for the module, implying a silicon-photonics IQ modulator, but the product brief PDF that would confirm this in Marvell's own words returned HTTP 403 on every fetch attempt | Vendor claim (existence of SiPho framing) / Not found publicly (the modulator detail specifically) | [Cignal AI, "Marvell Delivers Industry's First Pluggable Coherent 800 Gbps DSP and Module"](https://cignal.ai/2023/08/marvell-delivers-industrys-first-pluggable-coherent-800-gbps-dsp-and-module/) |
| Integrated coherent receiver (ICR) — what it is | Mixes the incoming optical signal with a local-oscillator tap (from the same tunable laser, split internally) through a 90-degree optical hybrid, then converts the four resulting optical outputs (I/Q × two polarizations) to electrical current via balanced photodiode pairs and transimpedance amplifiers (TIAs) — architecturally the coherent-transmission analog of the DR8/FR4 direct-detect receive chain (8× photodiode + 8× TIA) already sourced in `optics-internals-sources.md`, Section C, just with a 90-degree hybrid stage added ahead of the photodiodes | Published spec | [FiberMall, "Coherent Optical Modules: The Complete Guide"](https://www.fibermall.com/blog/coherent-optical-module-guide.htm); general ICR architecture (90-degree hybrid + balanced photodiode pairs + TIAs) corroborated by [ResearchGate, "Integrated Optical Coherent Balanced Receiver"](https://www.researchgate.net/publication/229004196_Integrated_Optical_Coherent_Balanced_Receiver) (academic, general architecture description, not tied to a named 800ZR part) |
| ICR material platform | Historically LiNbO3 optical hybrid co-packaged with InP balanced photodiode arrays and TIAs — this describes the general ICR product category, not a part confirmed inside a named 800ZR module | Industry typical | Search-summary synthesis from patent/academic literature; not tied to a specific 800ZR vendor's part in any source found this pass |
| A named, dated commercial 800ZR ICR part number | Not found publicly this pass | Not found publicly | Searched directly; only general architectural descriptions and older (100G/400G-era) academic/patent sources located |

---

## 4. Optional: EDFA internals

| Item | Value | Basis | Sources |
|---|---|---|---|
| Basic architecture | A coil of erbium-doped fiber (EDF), typically 10–30 m long; a pump laser; and a WDM coupler that combines the pump light and the signal so both travel through the EDF together | Published spec (general, well-established amplifier architecture; not tied to one vendor's product this pass) | [ScienceDirect, "Erbium Fiber — an overview"](https://www.sciencedirect.com/topics/engineering/erbium-fiber) (topic-overview page, aggregating academic sources) |
| Pump wavelengths | 980 nm or 1480 nm. 980 nm is generally preferred for lower noise and lower thermal demand; 1480 nm has a lower but broader absorption cross-section and can suit higher-power amplifier designs | Industry typical / academic consensus | [PMC/NCBI, "Comparison of 1480 nm and 980 nm-pumped Gallium-Erbium fiber amplifier"](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11116936/) |
| Isolators | Optical isolators are placed to prevent reflections from re-entering and being amplified by the erbium fiber, which would otherwise degrade noise performance or cause instability | Industry typical | General EDFA architecture references, aggregated via the ScienceDirect topic page above |
| Pumping direction | Pump energy can co-propagate with the signal (forward/co-pumping), counter-propagate (backward/counter-pumping), or both (bidirectional) — a design choice trading noise figure against output power/gain flatness | Industry typical | Same ScienceDirect aggregation |
| Signal band | C-band (1530–1565 nm) or L-band (1565–1625 nm), matching the C-band/L-band figures already sourced in `interconnect-physical-sources.md`, Section 7 | Published spec | `interconnect-physical-sources.md`, Section 7 (reused) |
| A public block diagram or dimensioned schematic of a specific commercial EDFA module (as opposed to the generic architecture above) | Not found publicly this pass — the sources located describe EDFA function and physics, not a named product's internal layout with dimensions | Not found publicly | Searched directly; no vendor teardown or dimensioned schematic located |

**Recommendation for the page:** the EDFA facts above are sufficient for a generic explanatory diagram (fiber coil → pump laser → WDM coupler → isolator, with 980/1480 nm labeled) but not for a to-scale, product-specific schematic. Label any EDFA card as a general-principle diagram, not a specific product's internals, unless a follow-up pass finds a named commercial EDFA teardown.

---

## Not found publicly

- **A labeled internal teardown (component photo) of a DAC, ACC, or AEC cable connector head** — no vendor or third-party source with parts identified was located, matching the same gap already noted for pluggable optical modules in `optics-internals-sources.md`.
- **A labeled internal teardown or dimensioned block diagram of an 800ZR/800ZR+ module** showing the ITLA, CDM, ICR and DSP's physical placement relative to each other. The four-block functional description is well and consistently sourced; the physical layout is not.
- **Marvell Orion's process node and an independently confirmed absolute power figure** — Marvell's own product-brief PDFs (Orion DSP and COLORZ 800 module) 403 on every direct fetch, consistent with every other pass in this research set that has tried marvell.com.
- **A named, dated commercial 800ZR ICR (coherent receiver) part number** from any vendor.
- **Whether 800ZR modules use nano-ITLA exclusively, or still ship with micro-ITLA in some products** — both are marketed for this generation; no source states one has fully displaced the other.
- **A GB300 NVL72 spine that is confirmed physically different from the GB200 NVL72 spine** — no source found this pass distinguishes them; treated as the same design.
- **A dimensioned, product-specific EDFA schematic** — only the generic architecture (fiber coil, pump laser, WDM coupler, isolator) is public at the level of detail found this pass.
- **A specific Nokia/Infinera 800ZR coherent DSP part name or power figure** — named as a market participant but not researched further this pass (outside the prompt's core ask).
- **The OIF-800ZR-01.0 IA's own PDF text** — downloaded but rendered as unreadable binary to this session's tools, the same limitation already logged against OIF-400ZR-02.0 and IEEE P802.3dj in `copper-optics-sources.md`. Every 800ZR figure above is via trade-press or vendor-datasheet restatement of the IA, not a direct primary read.

---

## Conflicts between sources

- **AEC power per end** — this pass found figures of 10–13 W/end (800G) and 2.5–12 W/end (general) that sit below the ≈20 W/end (200 Gb/s/lane) figure already established in `copper-optics-sources.md`, Section 2 (sourced to Vik's Newsletter). None of the three sources states its exact lane rate/generation clearly enough to reconcile with certainty; present AEC power as a wide, generation-dependent range (roughly 4–20+ W/end) rather than one number. See Section 1b above for the full comparison.
- **800ZR module power** — 24–25 W (FiberMall's narrower figure) vs. 20–30 W (FiberMall's own wider figure, a different page on the same publisher) for the same nominal 800ZR tier. Cisco's own datasheet gives no watt figure at all, only a power-class designation. Use "≈24–30 W," not a single number, and note it is trade-sourced, not vendor-stated.
- **Coherent driver modulator material** — LiNbO3 (the historical/traditional platform, still current in Lumentum's HB-CDM), a newer InP standard described as "presently being defined" by OIF, and silicon-photonics IQ modulators (both a research demonstration and Marvell's own "SiPho" marketing for COLORZ 800) all appear as live options in the sources checked this pass. The industry has not settled on one platform the way DSP has settled on a handful of vendors; present the IQ modulator as "one of several competing platforms — LiNbO3, InP, or silicon photonics, vendor-dependent," not a single confirmed technology for "800ZR modules" as a category.
- **Task prompt's DSP vendor list vs. what this pass found** — the task names "Marvell Orion, Ciena WaveLogic 6 Nano, Broadcom, others" as example coherent DSPs. This pass found no evidence Broadcom fields a coherent DSP at all (its DSPs are PAM4/direct-detect); the actual short list of coherent-DSP makers is Cisco (Acacia/Delphi), Marvell (Orion), Ciena (WaveLogic 6 Nano), and Nokia (Infinera). Recommend substituting Cisco for Broadcom on the page, or naming both with Broadcom's absence flagged, rather than implying Broadcom is a coherent-DSP peer to Marvell and Ciena.

---

## For the page

Five plain sentences, each tied to a sourced row above, for whoever writes the level's card copy:

1. Copper cables that carry data between racks come in three flavors that trade power for reach: a plain passive cable (DAC) has no electronics at all and works only over a couple of meters; add one small amplifier chip at the connector (ACC) and it reaches about three meters for a couple of watts; add a full signal-regenerating chip at both ends (AEC) and it reaches seven meters or more for a few times the power. *(Section 1a, 1b)*
2. Inside NVIDIA's GB200/GB300 NVL72 rack, the entire NVLink scale-up fabric — every GPU talking to every other GPU — runs over more than 5,000 individual passive copper connections bundled into four cable cartridges at the back of the rack, over two miles of wire with zero watts spent on signal regeneration. *(Section 2)*
3. An 800ZR coherent module packs four very different jobs into one pluggable: a tunable laser that generates one precise color of light, a modulator that writes data onto that light's phase and amplitude, a receiver that unscrambles the returning light against a copy of the same laser's beam, and a DSP that cleans up everything the fiber distorted along the way — running at roughly 118 billion symbols per second to move 800 gigabits over 80 to 120 kilometers of fiber with no repeater in between. *(Section 3a, 3b)*
4. Only a handful of companies in the world can build the DSP at the heart of a coherent module — Cisco, Marvell, Ciena, and Nokia — a far shorter list than the many companies that build the simpler DSPs inside ordinary optical modules, because coherent signal processing is a harder problem. *(Section 3c)*
5. The tunable laser itself has shrunk three times in over a decade: from a laser the size of a matchbox in 2011 down to a chip barely bigger than a fingernail today, small enough to fit inside the same pluggable module as everything else. *(Section 3d)*

---

*Compiled by the research workstream for the "Inside the links" extension, `optics/dive` branch.
Every URL above was fetched or search-verified this pass (09/28/2026); nothing here was filled
from memory. Public sources only — MSA/standards documents, vendor datasheets and technical
blogs, press releases, conference papers, and trade press. No private, NDA, or leaked material
was sought or used.*

---

## Corrections, 09/28/2026 (after Codex's review of optics/dive)

- **Nano-ITLA dimensions (section 3d).** "25.0 mm (L) × 15.6 mm (W) × 6.5 mm (H)" and "less than 3 W total power
  consumption" are in the abstract of a 2023 Journal of Lightwave Technology paper
  (https://opg.optica.org/jlt/abstract.cfm?uri=jlt-41-16-5405), not in the 2019 Optical Connections News article,
  which says only "approximately half the size" of the micro-ITLA. EFFECT Photonics' nITLA17 page gives 2.9 W but no
  dimensions. No commercial datasheet with numeric dimensions was reachable. The site now names the JLT example.
- **Copper quotations (section 1a).** "a Redriver chip at one end of the cable, typically the receiver (Rx) end" and
  "The Retimer chip in AEC ... integrates CTLE ..., DFE ..., CDR ..., and FIR drivers" are on AscentOptics, not NADDOD.
  NADDOD returned HTTP 403 on every fetch, so its "2.5–12 W per end" could not be confirmed and is no longer cited.
- **AEC power (section 1b).** AscentOptics gives "higher power consumption (2.5–3.5W)" for AEC and "1.2–1.8W" for ACC;
  it does not give 10–13 W at 800G or 4 W at 400G. The site now shows Vik's "around 20 watts per end" at 200G/lane
  and AscentOptics' 2.5–3.5 W with its lane rate unstated.
- **DAC power.** NVIDIA's DAC and LACC overview: "Power consumption is 0.1 Watts per end", and LACCs have "an
  additional IC in each end".
- **800ZR power (section 3a).** FiberMall's two pages give "24 to 25 watts" (ZR page) and "20-30W" (guide); the site
  shows both by name, not a combined ≈24–30 W.
- **800ZR reach.** Cisco ties both headline reaches to amplified DWDM ("Up to 120 km amplified DWDM", "Over 1000 km
  amplified DWDM") and gives "Up to 75 km with 800ZR and 80 km with 800G ZR+" unamplified.
- **Coherent DSP makers.** The "Broadcom is not among them" line rested on trade commentary; the site now names the
  makers one 2026 survey lists, without a universal exclusion.


## 9/29/2026 — Separate coherent driver and TIA components

The coherent close-up distinguishes electronic ICs from optical components. The visible
`cdm` and `icr` part names become **Dual-polarization IQ modulator** and **Receiver optics
(hybrids + photodiodes)**; the legacy IDs remain for old links. New `driver` and `tia` parts
exist in data, power and heat views. The current drawing uses separately packaged board-mounted driver and TIA electronics, each
physically distinct from the standalone optical assemblies. This package arrangement, its
interfaces, component dimensions and placement remain explicit design assumptions. Only the OSFP envelope and the cited nano-ITLA case are to scale.

Public source check on 9/29/2026:

- [Precision OT, Part II](https://www.precisionot.com/whats-in-a-coherent-pluggablepart-ii/):
  the “Coherent Pluggables: What’s Inside?” section and Figure 2 distinguish drivers, TIAs,
  modulators and photodetectors. This is a generic architecture illustration, not a teardown
  establishing physical package boundaries.
- [Coherent IC announcement](https://www.coherent.com/news/press-releases/coherent-unveils-a-family-of-ics-for-next-generation-optical-transceivers):
  CHR1094/CHR2094 is a coherent **400G ZR/ZR+** chipset. The separate CHR2075 announcement
  for 800G/1.6T modules does not qualify that coherent chipset for 800ZR.
- [Coherent TIA product table](https://www.coherent.com/networking/optoelectronic-devices/integrated-circuits/transimpedance-amplifiers):
  CHR1094 is a four-channel, 64 GBd wire-bonded die for 400G ZR/ZR+. It is an example of
  a distinct electronic IC, not the claimed component inside the modeled 800ZR module.
- [Sumitomo Electric, E101-06](https://sumitomoelectric.com/sites/default/files/2025-10/download_documents/E101-06.pdf):
  Figure 1 supports the signal-chain ordering. Sections 2–3 and Photos 1–2 document separate
  driver and TIA ICs; Section 4.1 assembles them with optics into CDM/ICR packages.
- [OIF ECOC 2022 presentation](https://www.oiforum.com/wp-content/uploads/ECOC-2022-Market-Focus-Gass-final1.pdf),
  slide 10, groups photonics, driver and TIA within a COSA. It supports explaining component
  roles without assuming one sealed package per component.
- [Lightwave, Coherent 800G DCO](https://www.lightwaveonline.com/home/article/14305470/coherent-corp-800g-coherent-pluggable-dco-module-in-qsfp-dd-form-factor)
  is **secondary** coverage. It describes an IC-TROSA containing optics and analog electronics;
  it is context for integration alternatives, not evidence of discrete board packages.

The intended paths are DSP → driver → modulator on transmit, and photodiodes → TIA → DSP
on receive. Those links are electrical. Laser carrier and local-oscillator branches remain
optical and terminate at optics, never at the driver or TIA. Short chip-to-optics connections
avoid suggesting that sensitive RF/current paths can be routed arbitrarily around a module.

Power and heat animations remain qualitative. No module-total wattage is reassigned to an
individual driver, TIA or optical block. Optical-block bias/control and heat paths are
explicit assumptions, not a specific vendor circuit or a claim of equal dissipation.

Validation of the earlier 9/29/2026 bare-die discrete-IC revision (superseded by the board-package redesign below): Blender 5.2 regenerated the coherent
`.blend` and GLB from the updated circuit reference. Separate islands fit within the
PCB; signal geometry keeps light outside analog ICs. The review found and corrected
small carrier overhangs and overlapping electrical trace widths. Explicit board-to-IC
bonds now join the short IC-to-optics bonds. Component sizes remain illustrative.
All 1,283 tests pass, TypeScript passes, and the claims checker reports zero problems
across 66,515 claim instances. Desktop and 390-pixel phone camera gates each pass
97 stops in the GB200 AC warm-water scenario. The coherent coplanar scan finds zero
overlap groups. The driver and TIA close-ups were visually inspected in the browser.
This revision is available in the private preview, not deployed to the public site.

## 9/29/2026 — Discrete board-package redesign

The earlier separate bare dies still resembled integrated optical subassemblies. The revised
design makes the requested distinction physical: the driver and TIA are opaque, independently
board-mounted electronic packages; the modulator and receiver optics are separate optical
assemblies. Neither analog package shares an optical carrier. Short board connections carry
electrical signals between these assemblies; optical paths terminate only at optics.

This is an explicitly assumed discrete implementation. The public sources above establish
separate analog ICs and signal-chain functions, but do not validate this exact four-assembly
800ZR OSFP floorplan or its package interfaces. Current cards describe the discrete design
being shown. Integrated alternatives are discussed in the evidence caveat, without presenting
them as the current drawing. The validation results for the earlier bare-die revision do not
certify this later package redesign; it requires fresh geometry and preview checks.

## 9/29/2026 — Laser split and DSP interfaces

[Acacia’s March 2021 white paper](https://acacia-inc.com/wp-content/uploads/2021/03/Coherent-for-Service-Provider-Edge-and-Access-Network-Applications-WP0321.pdf),
page 10, explains the shared CW source for a coherent link using the same transmit and
receive wavelength. The conventional diagram branches the laser through a splitter to the
modulator and receiver LO. Its BiDi contrast uses separate lasers when those wavelengths
differ. The laser card now cites this architecture directly; it does not generalize the
shared source to every coherent design or source the illustrative OSFP floorplan from it.

The DSP card identifies separate host-side digital and optical-side analog interfaces.
The four drawn host-path groups organize the diagram; they are not four specified host
lanes, a package pinout or a one-to-one mapping through the processor. Transmit processing
and DAC conversion, and receive ADC conversion and processing, separate the two interfaces.
Package terminal positions and internal converter implementation remain representative.
The discrete driver/TIA package architecture caveat is unchanged.

## 9/29/2026 — Final correction checks

The discrete board-package geometry now passes dedicated checks for separate footprints,
optical paths staying outside electronics, fixed DSP interface endpoints, electrical routes
clearing the laser, and one laser trunk branching only at the visible splitter. The raised
DSP thermal pad follows cover visibility so the interface banks remain inspectable.
Coherent camera checks passed 97 desktop and 97 phone stops; the coherent coplanar scan
found zero overlap groups. Package layout and electrical pin positions remain assumptions.

Both pluggable DSPs now carry Blender-authored 4 × 200G / 800G each-way markings; existing
four-lane-per-engine routes total 1.6T per direction. The old duplicated 8 × 200G lettering
was removed. ACC REDRIVER and AEC DSP RETIMER lettering is printed on the copper packages.

The apparent translucent ACC block was a GTAO normal-pass error: LineSegments2 flow
ribbons were rendered using an ordinary mesh override, exposing their proxy rectangles.
HardwareGTAOPass excludes teaching overlays, sprites and non-depth-writing transparent
meshes only during AO rendering, then restores visibility. Hardware AO and color-pass
signal animation remain enabled. The corrected ACC view was visually checked in-browser.

Final validation: 1,288 tests pass across 30 files; TypeScript passes; the evidence checker
reports zero problems across 66,827 claim instances. Production build and standalone
artifact build succeed. Changes are in the private review preview, not the public release.
