# Heat audit: how much heat each part is drawn with (10/01/2026)

Reed's request: "Throughout the visualizer can we audit how much heat we are showing emanating from different
components and make sure that it aligns with expectations/common sense? For example, I'd imagine that optical
components don't radiate as much heat as electrical." Follow-up (10/01/2026): the watts-to-visual mapping must not be
linear; use a log-compressed, per-level-normalized rule, keep rank order within a view, draw nothing under about
0.5 W, and say "log scale" on screen.

Branch `vis/heat-audit`. Code: `src/heat.js` (the rule), every scene's heat section, `src/app/stage.js` (applies the
rule once more after art direction, legend note), `src/scenes/heat-scale.test.ts` and `src/heat.test.ts` (checks).

## 1. Method

**What was inventoried.** Every heat visual on all ten levels, for six scenarios (GB200 warm water 100 MW, GB300
800 V DC liquid 300 MW, H100 air 1 GW, Vera Rubin warm water 10 MW, GB200 5 GW, Colossus 2), desktop and phone:

- heat streams (`heatFlows`: classes `hot`, `warm`, `cool`, `air`, `vapor`; their pulses and their ribbons),
- emissive heat glows (GPU dies, module DSP and analog chips, module shell, coherent DSP, CPO ASIC, copper chip glow
  and haze),
- plumes (hall hot-aisle haze, rack air-share haze, tray shimmer over GPU sinks or bus converters, campus tower vapor,
  power-plant plumes on Scale across).

**Visual heat weight.** One comparable number per source: for each stream, *moving pulses × pulse size × pulse
radius after art direction × peak color brightness × opacity*, summed over the source's streams
(`flowHeatWeight` / `heatSources` in `src/heat.js`). It is measured on scenes built exactly as the page builds them
(authored Blender hardware, compute and link art direction, motion styles), so it is what renders. The tables below
give each source's weight relative to the largest source in its view (`rel`), before and after the fix, beside what
the rule asks for (`rule`).

**Source and carrier.** A *source* is heat leaving one part as the view draws it (one GPU package, one HBM stack, one
engine, one chip). A *carrier* is a coolant or air loop moving heat collected elsewhere (rack manifolds, hall water,
campus coolers and towers); its supply leg belongs to its loop. Sources are ranked against sources, carriers against
carriers.

**Watts.** From the model wherever it has them (`src/model/engine.ts`: GPU package power and HBM share, CPU, NIC/DPU
and other per-rack power, VRM and bus-converter losses, liquid share, rack kW, IT MW, halls). Otherwise from cited
figures and order-of-magnitude allocations, now in `PART_W` (`src/heat.js`) and stated in
`ASSUMPTIONS['heat-visual-scale']`:

| part | watts used | basis |
|---|---|---|
| Pluggable module DSP | ≈14 W (LRO transmit-only DSP ≈6 W) | Semtech: full-DSP module 23–25 W, LRO ≈16 W, LPO ≈10 W at 200G/lane (`lroW` row, vendor). DSP = full − LPO; LRO DSP = LRO − LPO |
| Module drivers / TIAs / lasers | ≈3 / ≈2 / ≈3 W | Assumed split of the ≈10 W an LPO module keeps (≈2 W converter/controller, not drawn) |
| Module modulators, photodiodes, waveguides, fibers, MPOs | ≪0.5 W | Assumed; passive or micro-watt bias. Drawn with no heat before and after |
| 800ZR DSP | ≈16 W | Module 24–25 W (FiberMall, reported) less the parts below |
| 800ZR tunable laser | 2.9 W | EFFECT Photonics nITLA17 (spec row); JLT nano-ITLA "under 3 W" |
| 800ZR driver IC / TIA IC | ≈2 / ≈1 W | Assumed (four-channel 128 GBd analog ICs) |
| 800ZR IQ modulator bias, receiver-optics (photodiode) bias | ≈0.3 W / ≈0.05 W | Assumed; both under the 0.5 W threshold |
| CPO switch ASIC / optical engine | ≈550 W / ≈13 W | NVIDIA: Q3450 3.95 kW, ≈9 W per port (vendor rows); four packages, less fans/management |
| CPO rings, photodiodes, fibers, external lasers | ≪0.5 W at the package | Lasers sit at the front panel; never drawn as package heat |
| Copper DAC / ACC redriver / AEC retimer (per end) | 0.1 / ≈2 / ≈10 W | NVIDIA DAC 0.1 W (spec); ACC "a couple of watts" (reported); AEC between 2.5–3.5 W and ≈20 W (reported) |
| HBM stack | GPU W × HBM share ÷ live stacks (14–36 W) | Model (`hbmShare`, `hbm.stacks`) |
| GPU silicon (chip level) | GPU W × (1 − HBM share) (630–1,512 W) | Model |
| Tray GPU / CPU | 700–1,800 W / 350–400 W | Model (`gpuW`, `cpuW`) |
| Rubin tray NIC board (4 SuperNICs) / DPU | ≈167 W / ≈83 W | Model's NIC/DPU kW per rack ÷ 18 trays, DPU counted as two NICs (assumed) |
| NVL tray air share | (NIC + other + bus-converter loss) kW ÷ 18 | Model |
| Rack water / air | rack kW × liquid share / rest | Model |
| Hall water / air | racks drawn × rack kW × liquid share / rest (air halls: both carry all of it) | Model |
| Campus coolers, chiller plant, condenser, towers | IT MW (per drawn hall, chiller plant 7/6 of what it moves; warm-water towers trim a fifth) | Model; the 7/6 is the chiller card's figure; the trim fraction is assumed |
| Scale across campus | meter MW (home: scenario; others: each real campus's) | Model and `sites.ts` |

## 2. Top findings (before the fix)

Worst first. "rel" is visual heat weight relative to the largest source in the view.

1. **Coherent 800ZR: optical parts drawn as hot as the electronics.** The IQ modulator (≈0.3 W bias) and the receiver
   optics (hybrids + photodiodes, milliwatts) each drew two heat streams identical to the driver IC (≈2 W) and the TIA
   (≈1 W): rel 0.200 each, the same as the driver and TIA. Their cards said the marks were "qualitative", but on screen
   a photodiode block emitted exactly as much heat as an amplifier IC. The tunable laser (2.9 W) drew twice the
   driver (0.40 vs 0.20). This is Reed's example exactly. **Fixed:** both optical blocks draw no heat (under 0.5 W);
   their cards now say "Too little to draw" and why.
2. **Copper: ACC redriver drawn identical to the AEC retimer.** Same five strands, glow and haze per chip, by design
   ("identical treatment avoids implying a ratio"), so a ≈2 W redriver showed as much heat as a ≈10 W retimer
   (rel 1.000; rule 0.325). **Fixed:** strands, glow and haze follow the rule (ACC 0.325).
3. **Scale across: the home campus outdrew every larger campus.** Every campus icon drew the same two streams, the
   home one larger: a 100 MW scenario campus drew 1.18× the heat of 1.76 GW Colossus (rank inversion in every scenario
   under ≈1.8 GW). **Fixed:** heat follows each campus's power (home 0.135 at 100 MW, 1.000 at 5 GW).
4. **Rack (NVL72): the air path drawn at more than half the water path.** 13% of the heat (17 kW) leaves as air,
   87% (114 kW) in water, but the 21 air streams drew rel 0.566 against the manifolds (rule 0.265; before art
   direction the air even outweighed the water, 1.32×). **Fixed:** 0.265; the air haze fades with it.
5. **Tray (GB200/GB300): the Grace CPU drawn as hot as a GPU, and the air as heavy as the water.** Every cold plate
   drew four identical streams, so a 364 W CPU matched a 1.2–1.4 kW GPU (rel 1.000; rule 0.39–0.43). The air
   streams over the parts water does not reach (≈0.5 kW) drew 0.98 of a board's water loop (2.8–3.2 kW; rule
   0.29–0.30). **Fixed.**
6. **Vera Rubin tray: GPU, CPU, NIC boards and DPU all one identical stream; GPU branch water lighter than a CPU
   row.** A 1.8 kW GPU, a 400 W Vera CPU, a ≈167 W NIC board and a ≈83 W DPU each drew one identical stream
   (rel 1.000 all). In the water, each 1.8 kW GPU branch drew 0.061 while the 400–800 W CPU and NIC rows drew 0.306
   (rank inversion). **Fixed:** CPU 0.349, NIC board 0.190, DPU 0.117; branches and rows in rank.
7. **Campus (chilled-water designs): conceptual expansion services drawn far over the towers.** On the H100 1 GW,
   GB300 300 MW and Colossus 2 campuses, the expansion halls' water (0.6–1.1 GW) drew 2.7–23× the cooling towers or
   chiller fans that reject more heat (1.4 GW at Colossus 2): rank inversion. The condenser water drew 0.42 of the
   towers it feeds with the same heat. On warm-water campuses the dry-cooler air drew 1.5× the roof water carrying
   the same heat, and the trim towers 0.185 (rule 0.527). **Fixed.**
8. **Hall (air-cooled H100): the water loop drawn at 2.4× the air carrying the same heat.** In an air hall the air
   carries every watt to the in-row coolers and the chilled water carries the same watts out; the water drew 1.00,
   the air 0.42. **Fixed:** equal. In liquid halls the air share was already close (0.29 vs rule 0.27; now exact).
   The Vera Rubin hall drew three hot aisles of air for racks the model cools 100% by water; **removed**, and its
   heat intro now says so.
9. **Chip: HBM stacks drawn nearly linearly.** Each stack (14–36 W) drew rel 0.018 of the GPU silicon (630–1,512 W):
   rank correct, but on a log scale they should read 0.063–0.073. **Fixed** (one denser stream per stack).
10. **Module: driver, TIA and lasers drawn identically.** One stream each (rel 0.167) whatever their watts; the TIA
   (≈2 W) matched the driver and lasers (≈3 W). Rank held and the DSP clearly dominated, as it should. **Fixed:**
   driver and lasers 0.341, TIA 0.257. The module's optical parts (modulators, photodiodes, waveguides, fibers, MPO
   connectors) never drew heat, before or after.

What was already right: the CPO engines against the switch ASIC (0.071 vs rule 0.073; rings, photodiodes, fibers and
the front-panel lasers draw no package heat); the GPU silicon as the chip level's dominant source; the module DSP as
its dominant source and the LRO view's halved DSP arrows (3 of 6; rule 3.3 of 6); the DAC drawing nothing; passive
parts (fibers, MPOs, connectors, rings, photodiodes) nowhere emitting heat except the coherent case above.

## 3. The rule (one helper, every level)

`src/heat.js`:

- `heatWeight(W, Wref) = (W / Wref) ^ log10(5)` (≈ W^0.7): **log-compressed, equal visual steps per decade**: every
  10× in power is 5× in visual heat weight. 1 kW vs 100 W reads 5:1, vs 10 W 25:1, vs 1 W 125:1. `Wref` is the
  largest source (or carrier) in the same view, so each level is normalized to its own largest part (the module's
  DSP reads as clearly as the chip's GPU).
- **Threshold:** under 0.5 W a part draws no stream at all (`balanceHeat` throws if one is built). At most the shared
  part tint remains.
- `tagHeat(flow, part, watts, role)` names every stream's source; `balanceHeat(flows)` sets each source's total visual
  weight to `heatWeight × the largest's`, changing pulse count first and the remainder as opacity (exact, with an
  opacity floor of 0.3 of the authored value). It keeps the view within its existing pulse budget (scaling the whole
  view down together when the log rule would add pulses), and raises the reference only where a small source cannot
  fade far enough. Scenes call it when they build; `stage.js` calls it again after art direction, whose spacing
  limits change pulse counts unevenly.
- `heatIntensity(authored, W, Wref)` applies the same weight to glows and plumes (module chip and shell glows, copper
  glow and haze, hall hot-aisle haze, rack air haze, tray converter shimmer, campus tower vapor).
- Rank order within a view holds by construction and is tested.

Why a power law with ratio steps rather than additive steps per decade: additive steps (e.g. −0.4 per decade) give
near-peer small parts almost the hero's weight, so a group of them outweighs it: the module's driver, TIA and lasers
together would show twice the DSP's heat, and eight HBM stacks three times the die. Equal *ratio* steps per decade
are still a log scale (straight on log-log), compress 1 W to 1 kW into a legible 125:1, and keep the main source
dominant. One caveat remains, inherent to any log scale: many identical small parts sum to more than their share
(eight HBM stacks together draw about half the die's heat for about a sixth of its watts; 18 CPO engines together
about 1.3× the ASIC for about 0.4× its watts). The on-screen note covers this.

**Honesty on screen.** The heat layer's legend now ends with "Heat on a log scale: each step ≈ 10× the power"
(desktop and phone). Cards that compare parts carry a spec row *Heat drawn: log scale, each 10× in power 5× the
motion; none under 0.5 W* (`assumed`, `heat-visual-scale`), and cards keep their sourced watt figures (module power,
ACC "a couple of watts", AEC per-end figures, nano-ITLA 2.9 W, Q3450 3.95 kW, ≈9 W per CPO port).

## 4. Per-level tables (desktop, GB200 warm water 100 MW unless noted)

`n` = instances drawn; `before rank` flags a part drawn heavier than a part with more watts in the same view.

### Scale across

| role | part | W each | n | before rel | after rel | rule | before rank | verdict |
|---|---|---|---|---|---|---|---|---|
| source | Colossus (1+2) | 1,760 MW | 1 | 1.000 | 1.000 | 1.000 | below home | OK |
| source | Hyperion | 1,500 MW | 1 | 1.000 | 0.894 | 0.894 | below home | overstated → fixed |
| source | Rainier | 1,050 MW | 1 | 1.000 | 0.697 | 0.697 | below home | overstated → fixed |
| source | Fairwater Atlanta | 740 MW | 1 | 1.000 | 0.546 | 0.546 | below home | overstated → fixed |
| source | Prometheus | 585 MW | 1 | 1.000 | 0.463 | 0.463 | below home | overstated → fixed |
| source | Abilene | 500 MW | 1 | 1.000 | 0.415 | 0.415 | below home | overstated → fixed |
| source | Fairwater Wisconsin | 450 MW | 1 | 1.000 | 0.385 | 0.385 | below home | overstated → fixed |
| source | This campus | 100 MW | 1 | 1.176 | 0.135 | 0.135 | inverted | overstated → fixed |

At 5 GW the home campus is the largest (1.000; Colossus 0.482). Power-plant plumes (nuclear vapor, gas/coal
exhaust) are power-layer scenery at GW scale, larger than every campus stream; unchanged (rank holds).

### Grid & campus (warm water: dry coolers; chilled water: GB300 300 MW, Colossus 2)

| scenario | role | part | W | before rel | after rel | rule | before rank | verdict |
|---|---|---|---|---|---|---|---|---|
| warm | carrier | roof water, per drawn hall | 43 MW | 1.000 | 1.000 | 1.000 | ok | OK |
| warm | carrier | dry-cooler air, per drawn hall | 43 MW | 1.503 | 1.000 | 1.000 | ok | overstated → fixed |
| warm | carrier | evaporative towers (trim) | 17 MW | 0.185 | 0.527 | 0.527 | ok | understated → fixed |
| GB300 liquid | carrier | towers | 296 MW | 1.000 | 1.000 | 1.000 | below expansion | OK |
| GB300 liquid | carrier | condenser water | 296 MW | 0.417 | 1.000 | 1.000 | below expansion | understated → fixed |
| GB300 liquid | carrier | expansion halls' water | 169 MW | 2.678 | 0.676 | 0.676 | inverted | overstated → fixed |
| GB300 liquid | carrier | chilled water (detailed halls) | 85 MW | 0.368 | 0.417 | 0.417 | ok | OK |
| Colossus 2 | carrier | chiller fan air | 1,409 MW | 1.000 | 1.000 | 1.000 | below expansion | OK |
| Colossus 2 | carrier | expansion halls' water | 1,118 MW | 22.667 | 0.912 | 0.851 | inverted | overstated → fixed (floor-limited) |
| Colossus 2 | carrier | chilled water | 89 MW | 0.622 | 0.146 | 0.146 | ok | overstated → fixed |

The heat-export tie-in ("illustrative, not built") is left unscaled: it carries no real watts.

### Power room & data hall

| scenario | role | part | W | before rel | after rel | rule | verdict |
|---|---|---|---|---|---|---|---|
| GB200 warm | carrier | water (CDUs, facility loop) | 21.9 MW | 1.000 | 1.000 | 1.000 | OK |
| GB200 warm | carrier | hot-aisle air (and its haze) | 3.3 MW | 0.291 | 0.265 | 0.265 | slightly overstated → fixed |
| H100 air | carrier | chilled water | 7.4 MW | 1.000 | 1.000 | 1.000 | OK |
| H100 air | carrier | hot-aisle air | 7.4 MW | 0.423 | 1.000 | 1.000 | understated → fixed |
| Rubin | carrier | hot-aisle air | 0 W (100% liquid) | drawn | none | none | passive-equivalent drawn → removed |

### The rack

| scenario | role | part | W | before rel | after rel | rule | verdict |
|---|---|---|---|---|---|---|---|
| GB200 | carrier | water: manifolds + tray branches | 114 kW | 1.000 | 1.000 | 1.000 | OK |
| GB200 | carrier | air out the rear (and haze) | 17 kW | 0.566 | 0.265 | 0.265 | overstated → fixed |
| H100 air | carrier | each closed server's air | 9.6 kW | 1.000 | 1.000 | 1.000 | OK |
| H100 air | carrier | pulled server, each GPU sink's air | 700 W | 0.032 | 0.161 | 0.161 | understated → fixed |

### Compute tray

| scenario | role | part | W each | n | before rel | after rel | rule | verdict |
|---|---|---|---|---|---|---|---|---|
| GB200 | source | GPU package | 1,200 W | 4 | 1.000 | 1.000 | 1.000 | OK |
| GB200 | source | Grace CPU + LPDDR5X | 364 W | 2 | 1.000 | 0.434 | 0.434 | overstated → fixed |
| GB200 | carrier | board water loop | 2.76 kW | 2 | 1.000 | 1.000 | 1.000 | OK |
| GB200 | carrier | tray air (NICs, DPUs, drives, converters) | 495 W | 1 | 0.978 | 0.301 | 0.301 | overstated → fixed |
| GB200 | plume | bus-converter shimmer (desktop) | ≈30 W each | 4 | 0.1 opacity | 0.008 | — | overstated → fixed (effectively off) |
| Rubin | source | GPU | 1,800 W | 4 | 1.000 | 1.000 | 1.000 | OK |
| Rubin | source | Vera CPU | 400 W | 2 | 1.000 | 0.349 | 0.349 | overstated → fixed |
| Rubin | source | NIC board (4 SuperNICs) | ≈167 W | 2 | 1.000 | 0.190 | 0.190 | overstated → fixed |
| Rubin | source | DPU | ≈83 W | 1 | 1.000 | 0.117 | 0.117 | overstated → fixed |
| Rubin | carrier | manifold | 8.4 kW | 1 | 1.000 | 1.000 | 1.000 | OK |
| Rubin | carrier | GPU row | 7.2 kW | 1 | 0.306 | 0.897 | 0.897 | understated → fixed |
| Rubin | carrier | GPU branch | 1.8 kW | 4 | 0.061 | 0.340 | 0.340 | inverted (below CPU/NIC rows) → fixed |
| Rubin | carrier | CPU row / NIC+DPU row | 800 / 417 W | 1+1 | 0.306 | 0.193 / 0.122 | same | overstated → fixed |
| H100 | source | GPU (hot stream, sink shimmer) | 700 W | 8 | 0.6–1.0 | 1.000 | 1.000 | OK |
| H100 | carrier | whole-server air / each GPU sink's air | 9.6 kW / 700 W | 1 / 8 | 1.000 / 0.166 | 1.000 / 0.161 | same | OK |

### GPU package

| scenario | role | part | W each | n | before rel | after rel | rule | verdict |
|---|---|---|---|---|---|---|---|---|
| GB200 | source | GPU silicon (two dies; emissive glow) | 1,042 W | 1 | 1.000 | 1.000 | 1.000 | OK |
| GB200 | source | HBM3e stack | 20 W | 8 | 0.018 | 0.063 | 0.063 | understated → fixed |
| H100 | source | HBM3 stack / silicon | 14 W / 630 W | 5 / 1 | 0.018 | 0.070 | 0.070 | understated → fixed |
| Rubin | source | HBM4 stack / silicon | 36 W / 1,512 W | 8 / 1 | 0.018 | 0.073 | 0.073 | understated → fixed |

### Pluggable module (full DSP; LRO and LPO views noted)

| role | part | W | before rel | after rel | rule | verdict |
|---|---|---|---|---|---|---|
| source | DSP (6 streams, emissive glow 0.5) | 14 W | 1.000 | 1.000 | 1.000 | OK |
| source | driver (glow 0.25 → 0.17) | 3 W | 0.167 | 0.341 | 0.341 | understated → fixed |
| source | lasers (glow 0.25 → 0.17) | 3 W | 0.167 | 0.341 | 0.341 | understated → fixed |
| source | TIA (glow 0.25 → 0.13) | 2 W | 0.167 | 0.257 | 0.257 | rank tie with 3 W parts → fixed |
| — | modulators, photodiodes, waveguides, fibers, MPO connectors | ≪0.5 W | none | none | none | OK (passive, no heat) |
| carrier | air past the fins (shell glow 0.26) | 24 W | 1.000 | 1.000 | 1.000 | OK |
| LRO | DSP, transmit only (3 of 6 streams; glow 0.36 → 0.28) | 6 W | 0.500 | 0.500 | 0.552 | OK (whole streams) |
| LRO / LPO | shell glow | 16 / 10 W | 0.20 / 0.15 | 0.20 / 0.14 | rule | OK |

### Co-packaged optics

| role | part | W each | n | before rel | after rel | rule | verdict |
|---|---|---|---|---|---|---|---|
| source | switch ASIC (14 streams, emissive glow) | ≈550 W | 1 | 1.000 | 1.000 | 1.000 | OK |
| source | optical engine (EIC + PIC) | ≈13 W | 18 | 0.071 | 0.073 | 0.073 | OK |
| — | ring modulators, photodiodes, fibers, external lasers | ≪0.5 W at the package | — | none | none | none | OK |
| carrier | cold-plate water | ≈784 W | 1 | 1.000 | 1.000 | 1.000 | OK |

### Coherent 800ZR

| role | part | W | before rel | after rel | rule | verdict |
|---|---|---|---|---|---|---|
| source | coherent DSP (10 streams, emissive glow) | ≈16 W | 1.000 | 1.000 | 1.000 | OK |
| source | tunable laser (4 streams) | 2.9 W | 0.400 | 0.303 | 0.303 | overstated → fixed |
| source | driver IC | ≈2 W | 0.200 | 0.234 | 0.234 | OK, now exact |
| source | TIA IC | ≈1 W | 0.200 | 0.144 | 0.144 | rank tie with driver → fixed |
| source | IQ modulator (optical) | ≈0.3 W | 0.200 | none | none (under 0.5 W) | **overstated: optics = electronics** → removed |
| source | receiver optics (hybrids + photodiodes) | ≈0.05 W | 0.200 | none | none (under 0.5 W) | **overstated: optics = electronics** → removed |

### Copper cables

| role | part | W per end | before rel | after rel | rule | verdict |
|---|---|---|---|---|---|---|
| source | AEC retimer (5 strands, glow, haze) | ≈10 W | 1.000 | 1.000 | 1.000 | OK |
| source | ACC redriver (5 strands, glow, haze) | ≈2 W | 1.000 | 0.325 | 0.325 | **overstated (identical to AEC)** → fixed |
| — | DAC (no chip) | 0.1 W | none | none | none | OK |

## 5. What changed, per level

- **Scale across:** campus heat streams follow each campus's meter power (home from the scenario, real campuses from
  `sites.ts`); climate card text says amount follows power on the log scale.
- **Grid & campus:** every heat loop tagged (roof water and dry-cooler air per detailed hall, standing for the whole
  campus; chilled water; condenser water; towers; chiller fan air; expansion water) and balanced; tower vapor plume
  opacity follows the towers' share. The illustrative heat-export tie-in stays as drawn.
- **Hall:** water and air paths tagged by liquid share; air streams and hot-aisle haze scale with the air share;
  all-liquid (Rubin) halls draw no hot aisle; heat intro for that case.
- **Rack:** NVL water vs air by liquid share, haze follows the air; H100 servers' air vs each GPU sink's air.
- **Tray:** NVL plates by GPU/CPU watts, water loops vs tray air, bus-converter shimmer by converter loss; Rubin plates,
  rows and branches by watts; H100 GPUs and air.
- **Chip:** GPU silicon and each HBM stack by watts.
- **Module (Blender and native):** DSP, driver, TIA and lasers by watts; DSP, analog-chip and shell glows by the same
  rule per variant (LRO DSP glow 0.28, LPO shell 0.14). DSP card names it the major source and says the optics draw none.
- **CPO:** ASIC and engines tagged (already in rule); scope text: heat streams are sized by watts on the log scale.
- **Coherent:** modulator and receiver-optics heat removed; laser, driver, TIA by watts; cards rewritten ("Too little to
  draw"), `coherent-optical-power-heat` assumption updated, scope text updated.
- **Copper:** ACC strands, glow and haze scaled against the AEC; cards carry the cited power rows; scope text updated.
- **Everywhere:** heat legend note "Heat on a log scale: each step ≈ 10× the power"; `heat-visual-scale` assumption;
  `stage.js` re-applies the rule after art direction.

Disclaimers updated (they claimed pulses did not encode watts; they now say how they do): module heat intro and DSP
card, coherent heat intro and all six heat cards, copper both heat cards and scope, CPO scope and ASIC heat card,
across climate card, `module-lro-drawing` and `coherent-optical-power-heat` assumptions, LRO heat copy
(`module-lro.js`).

## 6. Particles

Total heat pulses per view stay at or below the original everywhere but one corner case: Scale across at 10 MW
(Vera Rubin scenario) goes 80 → 128 pulses, because a 10 MW home campus beside 1.76 GW sits at the opacity floor and
the reference rises to keep it below its peers. Elsewhere: campus 650 → 649 (warm) and 1,046 → 142 (Colossus 2), hall
1,107 → 1,086, rack 272 → 145, tray 218 → 168, chip 200–212 → 130–176, module 42 → 41, CPO 106 → 106, coherent 54 → 54,
copper 40 → 30. Stream (draw-call) counts are unchanged except the removed coherent optics (−4) and Rubin hall air
(−12).

## 7. Reproducing

`npx vitest run src/scenes/heat-scale.test.ts` checks every level and scenario (rank order within each view, rule
weights, nothing under 0.5 W, optics never above their electronics). `HEAT_DUMP=out.json` writes the per-source
weights; add `HEAT_RAW=1` for the authored look without the rule (the "before" columns; the coherent optics and the
Rubin hall air were removed in code, so their "before" values come from the original stream counts).

## 8. Gates (10/01/2026, real GPU, `IFX_GATE_GPU=1`, preview on 127.0.0.1:47525)

- `npx tsc --noEmit` 0; `npx vitest run` 47 files, 1,480 tests pass (incl. `heat.test.ts`, `scenes/heat-scale.test.ts`
  with Colossus 2 among its six scenarios); `npx tsx tools/claims.mjs` 0 problems; `npm run build` 0.
- `coplanar` 0, `parts` 0, `cycle` 0, `perf desktop` 0, `perf phone` 0, `ui` 0 (with the two new heat-layer states;
  a first run caught the legend note widening the legend into the key hints by 2 px, fixed with `contain: inline-size`
  and a minimum legend width).
- `views desktop` / `views phone` exit 1 on intermittent "pin off screen" stops, nearly all in the power and data
  layers and different on every run (3–23 stops). The unmodified baseline build fails the same way on this machine
  (13 stops, all power/data), so this is the gate's timing, not the heat change.

Screenshots (before = `a72820c` build, after = this branch; heat layer, `setTransitions('instant')`, settled 3 s):
`before-desktop-0..9`, `after-desktop-0..9`, `before/after-phone-{4,6,7,8}`, and the Colossus 2 preset's tray
(`colossus2-{before,after}-desktop-4[-coldplates]`), in the session scratchpad `heat/` folder.
