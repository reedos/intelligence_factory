# IF-2 claim audit — 10/07/2026

Status: **partial; blocked from full primary-source recertification**. Do not treat this branch as a certificate that every visible claim is correct.

## Inventory and scope

`astra-if2/claim-inventory.json` records each observed claim variant, its key, displayed text, evidence and audit status. The generator covers 104 base scenarios, both module sides, evidence-chip rows, part prose, scene introductions, staircases, bandwidth rows, guided narratives, Method sections, calculation/assumption registries, and static paragraphs/headings/list items on the story, Evidence and Method pages. The Evidence page reuses the same claim registry. This is a finite scenario inventory, not an exhaustive enumeration of every continuously adjustable input or site stage.

Regenerate with:

```
node --import ./tools/astra-if2-resolve.mjs tools/astra-if2-inventory.mjs
python -X utf8 tools/astra-if2-status.py
```

The status script applies only the explicitly reviewed calculation families and assumption disclosures. It does not infer truth from HTTP success, matching quotes or metadata. `confirmed` means the stated model arithmetic was checked; it does not validate an assumed engineering input. `footnoted` means the UI explicitly identifies an assumption. Unreviewed entries remain `needs Reed`, including accessible sources not yet semantically recertified. The broad audit remains unfinished.

## Findings fixed

| Claim | Finding and change | Verification |
|---|---|---|
| N+1 main transformer bank | MVA was treated as MW. Include the existing 0.95 power-factor assumption before rounding capacity. At 150 MW, three 75 MVA units leave only 142.5 MW after one outage; the corrected bank needs four. | Capacity remaining after one outage, plus minimality checks across eight thresholds. |
| FP8 decode time and compute/memory comparison | An absent FP8 peak fell back to FP4. Require matching arithmetic precision. NVIDIA's current Rubin table now supplies dense FP8/FP6 17.5 PFLOPS and dense NVFP4 35 PFLOPS; use 17.5 for the FP8 example. | Failing-first precision check; unknown peak stays unavailable; FP4 case and matching FP8 case checked separately. |
| Per-circuit transmission current | The displayed current splits demand over two circuits; the Method formula omitted that divisor. | Description now matches the explicitly stated two-circuit model. |
| Diesel volume evidence | The million-liter inventory row opened a truck-count formula. | Point to the fuel-volume calculation; 150 MW for 48 h at 0.26 L/kWh gives 1.872 million L. |
| Grace CPU memory | A CPU row opened a GPU HBM formula dividing by 72. | Separate CPU-memory calculation: rounded 17 TB divided by 36 CPUs, shown as approximately 470 GB. This quotient is not a correction to the hardware's nominal 480 GB description elsewhere. |
| H100 package current prose | A fixed 'over a thousand amps' sentence also appeared for H100, whose modeled core current rounds to 800 A. | Use scenario-derived core current and distinguish the compute dies from package HBM. |
| HBM power-share row | A fixed 8–15% label disagreed with Rubin's assumed 16%. | Display the actual per-accelerator assumption; test displayed percentage against the model. |
| Cross-hall fibers | Method said GPU count where the implementation uses physical endpoints, including two per Rubin GPU. | Formula explanation corrected; inverse count/strand check includes both NICs. |
| Method overview | Said sites never affect hardware, and GPU silicon is simply the ledger remainder. Both had become false. | Describe reported fleets and plant overrides, physical GPU-silicon sum, and separate unallocated budget. Update HBM range and stale four-test-file wording. |

## Primary evidence opened

- [NVIDIA Rubin specifications](https://www.nvidia.com/en-us/data-center/vera-rubin-nvl72/): per-GPU table and dense/sparse footnotes support 17.5 PFLOPS FP8, 35 PFLOPS dense FP4, 19.2 TB/s HBM and 3 TB/s NVLink. Rechecked 10/07/2026.
- [Meta Llama 3.1 model card](https://github.com/meta-llama/llama-models/blob/main/models/llama3_1/MODEL_CARD.md): model-family sizes include 70B. This is an approximate parameter count, not a byte-perfect checkpoint size.
- [NVIDIA's FP8 model card](https://huggingface.co/nvidia/Llama-3.1-70B-Instruct-FP8): weights and activations of linear operators are quantized. The site's 70 GB traffic model remains a simplified weights-only floor, excluding KV cache and other work.
- [Eaton 9395XR](https://www.eaton.com/us/en-us/catalog/backup-power-ups-surge-it-power-distribution/eaton-9395xr-ups.html): current page says greater than 97% double-conversion efficiency and up to 99% ESS. The model's 96.5% remains an explicit design assumption, not this product's measured value.
- [HPE GB200 QuickSpecs](https://www.hpe.com/us/en/collaterals/collateral.a50009224enw.html) and [Broadcom Davisson release](https://investors.broadcom.com/news-releases/news-release-details/broadcom-announces-tomahawkr-6-davisson-industrys-first-1024) were retrievable via the second reading path after initial timeouts; retrieval alone does not confirm every claim citing them.

## Independent tests and limits

`src/model/claim-audit.test.ts` reconstructs the IT budget by numerical bisection, walks power backward through the rack, checks minimum equipment capacity, reconciles an hour of reply energy/water/carbon with campus totals, checks bandwidth direction and units, propagates heat-display rounding, checks physical network endpoints and modules, and verifies the changed visible quantities. Relative error is used for continuous quantities; integer capacity requirements use inequalities and minimality. Existing engine, fleet, plant, clock, lane-math and media tests remain in place.

These tests do **not** yet constitute an independent per-figure oracle for every calculation registry entry, every site stage or every displayed rounding path. The inventory keeps those unverified claims explicit. The structural claim gate reports 0 metadata problems across 185,214 instances; that is not semantic source validation.

## Needs Reed

Full recertification is blocked by source access: the first sweep retrieved 340 of 385 references with HTTP 200, received 11 HTTP 403 denials, skipped 12 further references on denied hosts, and recorded 22 other transport/status failures. `astra-if2/source-access.json` retains the exact per-reference result. No denied action was retried. Public sources need to be made available through an authorized route before the remaining claims can be certified; this branch does not weaken evidence categories to hide gaps.

The remaining semantic audit and independent test coverage are incomplete. Preserve their unverified status when reviewing or applying these fixes. No navigation or evidence-category change is proposed.

## Verification

Final suite: 64 files / 1,745 tests passed. Typecheck and production build passed. All six HTML pages passed overflow/page-error checks at 360 and 1440 px; screenshots were inspected. The visualizer harness initially selected before scene loading finished; corrected readiness produced three consecutive passing runs. This is disclosed as a timing-sensitive harness, not evidence of a missing Tokens feature. Port 49748 was used.

The required full-tree identifier scan found identifiers already present in four historical research notes. Those values were replaced with neutral placeholders in this branch. The final hostname/IP scan passes; original values were never printed.

## Claude continuation 10/08/2026

### Scope and why

The first pass was blocked on source access and left 6,264 of 7,646 inventory entries unreviewed. This pass reviews what a visitor sees first, in the **default scenario** (100 MW, GB200 NVL72, 415 V AC, warm-water cooling): the story page (`index.html` text and the default story tour, 223 rows); the headline, scale line and intro text of all ten levels plus the stat rows of the across, campus, hall, rack and tray levels (386 rows); the stat rows of the chip, module, CPO, coherent and copper levels plus the bandwidth, staircase and links tables (381 rows); and every claim that cites one of the 45 sources that failed in the first sweep (90 rows). That is 1,080 reviewed rows in `astra-if2/recert/a1-claims.json` to `a4-deep.json`, each with a verdict (confirmed, footnoted, wrong, unsupported or needs Reed), sources, derivation and note.

**Not recertified:** the other 103 scenarios (their text differs where numbers or part names change), BOM, ledger, clock-simulation, site-preset and temperature rows, part prose, the 144 assumption and 84 calculation registry entries, and the Method sections. Treat those as unreviewed, not as correct.

### Coverage

| | Before (ce2e270) | After |
|---|---|---|
| Inventory variants | 7,646 | 7,754 (fixed text creates new variants) |
| confirmed | 687 | 1,332 |
| footnoted | 551 | 584 |
| fixed | 144 | 288 |
| needs Reed | 6,264 | 5,550 |

Default-scenario entries (flag `default` in the inventory): 1,885 entries, 1,883 distinct (key, value) claims. 956 of them (51%) now carry a reviewed verdict. By group: card rows 701 of 727, scene text 40 of 42, links 12 of 12, bandwidth 5 of 5, staircase 7 of 7, static page text 116 of 127, story tour 40 of 89, narratives 34 of 115; BOM, ledger, site, prose, assumption, calculation and Method rows 0. Default-scenario status after: 635 confirmed, 408 footnoted, 56 fixed, 786 needs Reed (66 reviewed and unresolved, 719 not yet reviewed).

Source access: the 45 sources that failed are refetched in `astra-if2/recert/source-refetch.json`. 19 are now fully readable, so 359 of 385 sources are readable (was 340). Still unreadable or unparsed (26): nvidia-copper-dac-lacc-overview (search excerpt only), nvidia-sn5000-datasheet, cummins-qsk78, cummins-nfpa110-ate (PDF not parsed), cat-c175-16, liteon-gtc-2026, liteon-gb200-power-system, marvell-ara-product-brief, marvell-acc-aec-architecture, marvell-cpo-tray-blog, marvell-light-engine-2021, marvell-3d-sipho-2024, marvell-cpo-xpu-2025, ciena-wavelogic6-nano, ciena-wavelogic6, nrel-water-electricity, eaton-9395xr-ups, hpe-gb200-quickspecs, amphenol-paladin-hd, fs-com-dgx-h100, fs-64ch-cband-mux, tspa-400g-lane-ofc, tsmc-coupe-stack-2024 (PDF not parsed), broadcom-th6-davisson-release, broadcom-cpo-reliability-meta, broadcom-bailly-release-2024. Epoch's Prometheus and New Carlisle pages were read again on 10/08/2026.

### How the status script uses this

`tools/astra-if2-status.py` now reads `recert/a*.json`. A row matched by (key, value) takes the reviewed verdict; the worst verdict wins when files disagree; wrong, unsupported and needs-Reed rows stay **needs Reed** with the note as the reason. Rows listed in `recert/fixes.json` (key, old values, new values, source or derivation) become **fixed** under their new text. `fixes.json` is the record of every change below. The inventory generator also gains a `default` flag for the counts above.

### Fixes (each re-verified against the cited text or recomputed before changing)

| Where | Old | New | Basis |
|---|---|---|---|
| Prometheus site facts, status line, Method text | 496 MW IT; 600k H100-eq; 237k B200 | 471 MW (08/31/2026); 536k H100-eq; 166k B300 | Epoch directory page, read 10/08/2026 |
| Across grid card | 230–500 kV | 345–500 kV | the page's own assumption and headline |
| Across intro / heat intro | "which is why gigawatt clusters get split"; "as much as power does" | "so very large clusters are often split"; "along with power" | unsourced causal and comparative claims softened |
| Campus data intro and Strands card | "thousands of strands"; "tens of thousands per hall pair" | computed: about 179k strands | 44,640 GPUs / 2 x 8 fibers = 178,560 |
| Rack scale | 2.3 m tall | 2.2 m tall | Sunbird: 2,236 mm |
| Chip scale | 10 cm across (floored) | 11 cm across | board = 8.4 + 2 x 1.2 = 10.8 cm |
| Rack intro | "all cooled by water" | "cooled mostly by water" | model: 87% to liquid; shelf PSUs are air-cooled |
| GB200 NIC name (tray intro, NIC card) | ConnectX-7 SuperNIC | ConnectX-7 | NVIDIA hardware guide |
| Tray heat intro | copper plate | cold plate | no source for the material |
| HBM power-share card and evidence note | ≈8–15% | ≈10–16% | assumption `hbm-power-share`; model 10%/13.2%/15%/16% |
| Rack shelf efficiency (card and story tour) | ≈97.5% peak, half load | ≈97.5% peak | Flex: "up to 97.5% (peak)" |
| Busbar rating | 1,400 A per section | 1,400 A | NVIDIA OCP blog |
| Kyber busbar card | 45% compared with today's busbar | compared with traditional 415 V AC | nvidia-800v-hvdc |
| Rack manifold card | GPUs, CPUs, switch chips | GPUs and CPUs | NVIDIA DGX guide names cold plates on those only |
| 2500 kVA transformer efficiency | ≈99.5% | ≈99.55% | 10 CFR 431.196 Table 6 |
| Dry-cooler water use | ≈0.15–0.17 L/kWh | adds "total, with wind/solar power" | arXiv Table 5 (1.31 L/kWh with gas power) |
| C+L band | about 2x | up to 2x | Telstra/Ciena text |
| Hollow-core fiber | "over 1,200 km carrying live traffic" | dropped | no source states it |
| LR4 card | "on one fiber pair" | dropped | not in the cited slide |
| Data-parallel traffic card | large all-reduce | large gradient sync | Llama 3 paper does not say all-reduce |
| CPO card | "not fewer fibers" | dropped | in none of the sources |
| DAC reach | 1–2 m | 0.5–2 m (1–2 m typical) | NVIDIA guide |
| Rack liquid-split calc text | "published liquid share" | the share this site assumes | the 87% source (HPE QuickSpecs) never loaded |
| Story page static text | Hyperion "runs on" gas plants; "leased fiber"; dry coolers alone at 45 °C; Llama 405B row; Samsi on A100; 13k tok/s from SemiAnalysis; NVIDIA 8–10x; PUE 1.2 / 132 kW racks; "written in TypeScript"; "every figure"; "1,380 tests across 40 files"; 800G / 144-port scale-out caption | "is to be powered by three new gas plants"; "long-haul fiber"; "with spray assist"; all three sizes; V100; LMSYS/SGLang; SemiAnalysis ≈8x; PUE 1.16 / 131 kW GB200 NVL72; JavaScript with a TypeScript engine; narrowed; counts removed; 400G / three tiers of 64-port switches | source text or default-scenario values |
| Story narrative | UPS loss "more than any other step before the rack" | "any other power-conversion step" | cooling (6.9 MW) is a larger row |
| Links lede (`sections.js`) | leased fiber | long-haul fiber | no source |

Unsourced phrases dropped or softened without a replacement source: "over 1,200 km carrying live traffic", "half load" (two places), "not fewer fibers", "on one fiber pair", "switch chips" as liquid-cooled, "leased fiber", "copper" plate, "which is why gigawatt clusters get split", "as much as power does".

Tests: `src/model/claim-audit-recert.test.ts` (9 tests) recomputes cross-hall strands from GPU count and fibers per link, derives the HBM label range from the accelerator table, checks the chip scale from the package geometry, the Prometheus figures, the voltage range, the static caption and bottom-line text in `index.html` against the default model, and that removed phrases stay removed.

### Needs Reed

Framing and scale: across "2,000 km across" (the map spans about 4,700 km; campuses are about 1,560 km apart); campus "1.6 km across" (scene extent 1.54 km, drawn parts about 1 km); hall "70 m across" and tray "44 cm wide" (no derivation; measure or relabel); copper headline wording (passive versus active copper for the NVLink spine; "ACC with one redriver" versus NVIDIA's LACC with a chip in each end); the Fairwater-WI "Opened" date (06/23/2026 is construction complete; Epoch says 04/16/2026 operational); Project Rainier building count (card says about 16 of 30; the 10/08 Epoch read says buildings 1–16 operational with 17–18 roofed; an earlier pass read 18 of 32; unchanged); Prometheus meter power of 585 MW was sized from 496 MW IT, so the preset needs a decision now that IT is 471 MW (and Epoch lists only B300, so GB300 may fit better than the GB200 preset).

Unreadable sources: the 87% liquid share (HPE QuickSpecs) behind 114 kW / 17 kW / ≈13% in the hall, rack and heat levels (label now says assumed; add it to the assumption registry or find NVIDIA's figure); NREL ≈1.8 L/kWh; Colossus 1 rows (Compute Atlas 403, X 402, SpaceX page blank); Rainier ~500,000 Trainium2 at launch; Munters 165,000 MWh; Motivair dew point; Acacia ITLA shared-CW-laser and dimensions; Marvell Ara "one DSP, 8 x 200G", ACC redriver, CPO tray and light-engine counts; TSMC SoIC-X; Broadcom one million flap-free port-hours; Mach-Zehnder citation (404; replace the citation or accept common knowledge); Ascent coherent power (15 W low end, 800ZR+ 28 W).

Source mismatches left alone because the right figure needs a call: GPT-4 training electricity (52–62 GWh is not on the cited Epoch page; remove or re-source); AEC "≈20 W per end at 200G/lane" (the cited guide says 2.5–3.5 W); copper-wall 200G span (0.7–3 m and 2.5 m, 100G 5 m estimates unsupported); DAC link row "under 1 m to about 3 m"; unit-substation efficiency ≈99% on the hall card (DOE page gives no percentage; the campus card now says 99.55%); hall rack "120–132 kW" (132 is a repeated figure not re-confirmed; the evidence note already says so); 72 scale-out ports per rack (one port per GPU is an inference); "every layer, many times per token" for tensor parallelism; "sources disagree ≈5x" for coolant flow; amplifier spacing "every 80 km or so" (Cisco gives 120 km for 800ZR); the rack census (5,184 copper connections and 4 cartridges are trade-report estimates, to be labeled as such); the CPO "18 engines in six groups of three" count, the module-intro sentence "is one DR4 engine of", and the DensiLink to front-cage sentence need a source check.
