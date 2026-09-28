// Written 09/27/2026 by a drafting agent from the site's code and research files, then checked claim by claim by a
// second agent against the code (fixes applied). Edit here; the page renders it as is.
export const TERMS = [
 {
  "term": "Transmission line",
  "aka": [
   "high-voltage line"
  ],
  "def": "The 345 kV lattice-tower line that carries power from distant plants to a campus substation, two three-phase circuits bundled together with a shield wire on top for lightning. High voltage keeps the current small: a 500 MW campus rides on a few hundred amps per phase instead of the tens of thousands a rack-level voltage would need.",
  "layer": "power",
  "sources": [
   "eia-td-losses",
   "epoch-stargate-abilene"
  ],
  "link": {
   "scene": 1,
   "mode": "power",
   "part": "line"
  }
 },
 {
  "term": "Substation",
  "aka": [
   "campus substation"
  ],
  "def": "Where the transmission line dead-ends on steel gantries and lands on a ring of SF6 circuit breakers and disconnect switches, with instrument transformers to measure the power and surge arresters to clip lightning. Building one, with its interconnection study, commonly takes two to four years — see Interconnection.",
  "layer": "power",
  "sources": [
   "ieee-spectrum-hyperion",
   "epoch-stargate-abilene"
  ],
  "link": {
   "scene": 1,
   "mode": "power",
   "part": "substation"
  }
 },
 {
  "term": "Main power transformer (MPT)",
  "aka": [
   "MPT"
  ],
  "def": "An oil-filled transformer, each about the weight of a loaded freight car, that steps the 345 kV transmission line down to the campus's 34.5 kV distribution voltage. Units this size run above 99.6% efficient, and reported 2026 lead times for large HV transformers ran from about a year up to five years depending on the manufacturer and tier.",
  "layer": "power",
  "sources": [
   "pa-transformer-345kv",
   "transformer-lead-times"
  ],
  "cites": [
   ["pa-transformer-345kv", "345kV Power Transformer Performance Highlights: 'efficiencies exceeding 99.6%' for a 90/120/150 MVA unit; Key Specifications lists total shipping weight 543,350 lb"],
   ["transformer-lead-times", "June 2026 lead-time tracker by manufacturer: Tier 1 OEMs (Hitachi Energy, Siemens, GE Vernova) 48-60+ months, Tier 2 EU/Asian manufacturers 12-36 months"]
  ],
  "link": {
   "scene": 1,
   "mode": "power",
   "part": "mpt"
  }
 },
 {
  "term": "34.5 kV",
  "def": "The medium-voltage level a campus distributes power at once the main transformers have stepped it down from the incoming transmission line; some campuses use 13.8 kV instead. Prefabricated switchgear splits it into feeders that run underground to each data hall.",
  "layer": "power",
  "sources": [
   "mv-distribution-atk"
  ],
  "cites": [
   ["mv-distribution-atk", "'On a large campus, 34.5 kV has become the standard distribution voltage because it carries more power with fewer and smaller feeders than 13.8 kV'; describes MV switchgear at the substation feeding unit substations at each data hall"]
  ],
  "link": {
   "scene": 1,
   "mode": "power",
   "part": "ehouse"
  }
 },
 {
  "term": "Unit substation",
  "def": "A pad-mounted transformer along a data hall that drops 34.5 kV to 480 V, right outside the electrical rooms so the low-voltage, high-current run stays short. In an 800 V DC design it serves only cooling and building loads, since the IT load skips it through solid-state transformers instead.",
  "layer": "power",
  "sources": [
   "doe-transformer-efficiency"
  ],
  "link": {
   "scene": 2,
   "mode": "power",
   "part": "unitsub"
  }
 },
 {
  "term": "Switchgear",
  "def": "A lineup of drawout breakers that protects every outgoing circuit in a room and switches it automatically between utility and generator power when the grid drops. A campus has 34.5 kV switchgear feeding the halls, and each hall has its own 480 V (or medium-voltage, in a DC design) switchgear inside.",
  "layer": "power",
  "link": {
   "scene": 2,
   "mode": "power",
   "part": "swgr"
  }
 },
 {
  "term": "UPS",
  "aka": [
   "uninterruptible power supply"
  ],
  "def": "A unit that turns incoming AC into DC and back to clean AC, with batteries on the DC link, so the racks never see a flicker between a grid failure and the generators taking load. Eaton's 9395XR, cited on this page, is reported at up to 97.5% efficiency online — eaton.com itself would not load for this page's own check, so the figure rests on reseller and distributor listings that reproduce Eaton's spec sheet rather than a page this project opened directly.",
  "layer": "power",
  "sources": [
   "eaton-9395xr-ups"
  ],
  "cites": [
   ["eaton-9395xr-ups", "eaton.com timed out on every direct attempt (see the 'unchecked' note on this source); the 97.5% online-mode figure is reproduced by multiple third-party resellers (e.g. distributor spec sheets) citing Eaton's own datasheet"]
  ],
  "link": {
   "scene": 2,
   "mode": "power",
   "part": "ups"
  }
 },
 {
  "term": "Double conversion",
  "def": "A UPS design that always turns utility AC into DC and back into AC, rather than passing it straight through, so the output never carries the grid's own dips or noise. Among every conversion before the rack in an AC power path, it is the single biggest loss.",
  "layer": "power",
  "sources": [
   "eaton-9395xr-ups"
  ],
  "link": {
   "scene": 2,
   "mode": "power",
   "part": "ups"
  }
 },
 {
  "term": "BESS",
  "aka": [
   "battery energy storage system"
  ],
  "def": "Grid-side batteries, sized on this page at roughly a fifth of the campus's meter MW and twice that in MWh (on the Colossus 2 preset, SpaceXAI's planned 3.3 GWh pack instead, assumed to carry the whole campus), that absorb the megawatt swings a synchronized fleet of GPUs can put on the grid in under a second. SpaceXAI's (formerly xAI's) Colossus campuses are reported to use large Tesla Megapack installations for exactly this, though public reporting on their total rated power is inconsistent — from a couple hundred megawatts at the first Memphis site to gigawatt-scale estimates at the newer, much larger Colossus 2.",
  "layer": "power",
  "sources": [
   "nvidia-bess-blog",
   "dcd-xai-colossus-memphis",
   "canarymedia-xai-battery",
   "spacexai-mid-south"
  ],
  "cites": [
   ["dcd-xai-colossus-memphis", "reports TVA/MLGW granting xAI 150 MW of grid power plus 'discounted Tesla Megapack battery storage to improve stability of the Memphis power grid,' without a Megapack power rating"],
   ["canarymedia-xai-battery", "09/11/2026: counts 720 Tesla Megapack containers at Colossus 2 by satellite imagery and reports estimates 'between 720 megawatts and 1,400 MW' depending on model, and a Memphis utility CEO's figure of '2,000 MW of batteries behind the meter' — the article itself calls the exact size 'unclear'"],
   ["spacexai-mid-south", "Colossus II tab, Power: 'America's largest grid-connected battery pack will provide 3.3 gigawatt hours' (planned; no power rating given)"]
  ],
  "link": {
   "scene": 1,
   "mode": "power",
   "part": "bess"
  }
 },
 {
  "term": "Gensets",
  "aka": [
   "standby generators"
  ],
  "def": "Containerized diesel generators, 2.5-3 MW class, that start within about ten seconds of a grid failure and take the load once UPS or DC-bus batteries have carried it that far. They run only a few hours a year, mostly for testing.",
  "layer": "power",
  "sources": [
   "cummins-dqkan-genset",
   "cummins-nfpa110-ate"
  ],
  "cites": [
   ["cummins-dqkan-genset", "DQKAN generator set data sheet: 2,500 kW (2.5 MW) standby rating"],
   ["cummins-nfpa110-ate", "course listing: 'The 10-second start: NFPA 110 Type 10 starting requirements for generator set applications'"]
  ],
  "link": {
   "scene": 1,
   "mode": "power",
   "part": "gensets"
  }
 },
 {
  "term": "Busway",
  "def": "Copper bars in an aluminum housing that run overhead down each row of a data hall, carrying 415 V AC (or 800 V DC, in that design) to every rack through plug-in tap-off boxes. Moving a rack means moving a plug, not rewiring the row.",
  "layer": "power",
  "sources": [
   "lv-distribution-busway",
   "nvidia-800v-hvdc"
  ],
  "cites": [
   ["lv-distribution-busway", "'LV Distribution: Busway, PDUs, RPPs & Rack Power' describes overhead busway with plug-in tap-off boxes as the standard way to run low-voltage power down a data hall row"]
  ],
  "link": {
   "scene": 2,
   "mode": "power",
   "part": "busway"
  }
 },
 {
  "term": "415 V",
  "def": "The AC voltage the overhead busway delivers to each rack, the standard OCP ORv3 rack power shelves are built for. Line to neutral, three-phase 415 V is 240 V, the actual voltage server power supplies take.",
  "layer": "power",
  "link": {
   "scene": 2,
   "mode": "power",
   "part": "busway"
  }
 },
 {
  "term": "800 V DC",
  "def": "A higher-voltage rack feed NVIDIA is moving toward for 2027-class racks, made in one step from 34.5 kV AC by solid-state transformers, with batteries sitting right on the DC bus instead of behind a UPS. NVIDIA says it cuts copper in the rack power path by 45% compared with 415 V AC at the same power.",
  "layer": "power",
  "sources": [
   "nvidia-800v-hvdc",
   "navitas-800vdc"
  ],
  "cites": [
   ["nvidia-800v-hvdc", "Row-level power management section: 'With lower current, thinner conductors can handle the same load, reducing copper requirements by 45%'"]
  ],
  "link": {
   "scene": 2,
   "mode": "power",
   "part": "busway"
  }
 },
 {
  "term": "Solid-state transformer (SST)",
  "aka": [
   "SST"
  ],
  "def": "Power electronics switching at high frequency that replace the 60 Hz transformer, the UPS, and the rack rectifiers with a single conversion from 34.5 kV AC straight to 800 V DC. Navitas and NVIDIA both describe this step as eliminating conversion stages to cut losses, but neither publishes a single efficiency figure for it; this page's better-than-98% figure is its own assumption, informed by that direction, for hardware that is not yet shipping.",
  "layer": "power",
  "sources": [
   "navitas-800vdc",
   "nvidia-800v-hvdc"
  ],
  "cites": [
   ["navitas-800vdc", "'Navitas Supports 800 VDC Power Architecture...' (10/13/2025): describes the architecture as eliminating 'multiple traditional AC/DC and DC/DC conversion stages, maximizing energy efficiency, reducing losses' without stating a percentage for this specific conversion"],
   ["nvidia-800v-hvdc", "Key benefits section: 'Improves end-to-end efficiency by up to 5% compared to current 54 V systems' — a whole-chain figure, not a single-stage SST number"]
  ],
  "link": {
   "scene": 2,
   "mode": "power",
   "part": "sst"
  }
 },
 {
  "term": "Power shelf",
  "def": "A 1U shelf holding six hot-swap rectifiers, wired 3+3 for redundancy, that turns a rack's AC feed into about 50 V DC for the busbar. GB300's shelves add capacitors storing 65 J per GPU, which NVIDIA says cuts peak grid demand from training swings by 30%.",
  "layer": "power",
  "sources": [
   "navitas-800vdc",
   "nvidia-gb200-ocp",
   "liteon-gb200-power-system",
   "nvidia-gb300-power"
  ],
  "cites": [
   ["nvidia-gb300-power", "'Measured benefits and results': LITEON-optimized power electronics 'filled the remaining space with 65 joules/GPU of energy storage'; 'the peak power demand seen by the grid is reduced by 30% when training the Megatron LLM'"]
  ],
  "link": {
   "scene": 3,
   "mode": "power",
   "part": "shelves"
  }
 },
 {
  "term": "Busbar",
  "def": "A vertical copper bar running the full height of an NVL72 rack that every compute and switch tray clips onto, so there are no power cables to individual trays. NVIDIA's next-generation Kyber design replaces this AC/DC busbar with an 800 V DC version, claiming 45% less copper.",
  "layer": "power",
  "sources": [
   "nvidia-gb200-ocp",
   "nvidia-800v-hvdc"
  ],
  "link": {
   "scene": 3,
   "mode": "power",
   "part": "busbar"
  }
 },
 {
  "term": "50 V",
  "def": "The DC voltage on an NVL72 rack's busbar (the OCP ORv3 standard), stepped down there from the rack's incoming AC or DC feed by power shelves or DC-DC shelves. Bus converters on every tray take it the rest of the way down to 12 V.",
  "layer": "power",
  "link": {
   "scene": 3,
   "mode": "power",
   "part": "busbar"
  }
 },
 {
  "term": "IBC",
  "aka": [
   "intermediate bus converter",
   "bus converter"
  ],
  "def": "A fixed-ratio converter brick on each compute tray that cuts the busbar's roughly 50 V by about four to hand 12 V to the board. Because it doesn't regulate, it runs efficient, around 97-98%, though vendors don't publish the figure so this page estimates it.",
  "layer": "power",
  "sources": [
   "semianalysis-blackwell-power-delivery"
  ],
  "link": {
   "scene": 4,
   "mode": "power",
   "part": "ibc"
  }
 },
 {
  "term": "VRM",
  "aka": [
   "voltage regulator module"
  ],
  "def": "Dozens of switching phases ringing each GPU, an inductor and a power stage apiece switching around a megahertz, that make the final step from 12 V to under a volt at the die. They sit as close to the chip as possible, because every millimeter of copper at a thousand amps costs power.",
  "layer": "power",
  "sources": [
   "semianalysis-blackwell-power-delivery"
  ],
  "link": {
   "scene": 4,
   "mode": "power",
   "part": "vrm"
  }
 },
 {
  "term": "PUE",
  "aka": [
   "power usage effectiveness"
  ],
  "def": "The ratio of power drawn at the campus meter to the power that actually reaches IT equipment; the gap is cooling, conversion losses, and building overhead. This page calibrates its own cooling designs to land around 1.5 for air, 1.10-1.20 for chilled liquid, and 1.05-1.15 for warm water — bands chosen to bracket real operating figures rather than measured from a specific campus.",
  "layer": "power",
  "sources": [
   "google-pue"
  ],
  "cites": [
   ["google-pue", "Efficiency page: Google's own 2025 fleet-wide PUE was 1.09, against 'the global average PUE of respondents' data centers was 1.54' per the Uptime Institute's 2025 survey it cites — the real-world spread this page's own bands sit inside"]
  ],
  "link": {
   "scene": 1,
   "mode": "power",
   "part": "towers"
  }
 },
 {
  "term": "NVLink",
  "def": "NVIDIA's copper scale-up link that ties GPUs into one shared-memory domain. The current generation, NVLink 5, moves 1.8 TB/s per GPU, both directions combined, across all 72 GPUs of an NVL72 rack, fast enough that the rack behaves like one giant GPU.",
  "layer": "data",
  "sources": [
   "nvidia-nvl72-reference-arch",
   "nvidia-gb200-nvl72"
  ],
  "cites": [
   ["nvidia-gb200-nvl72", "Highlights section: 'the fifth-generation NVLink, which provides 1.8 TB/s of GPU-to-GPU interconnect'"]
  ],
  "link": {
   "scene": 3,
   "mode": "data",
   "part": "nvswitch"
  }
 },
 {
  "term": "NVSwitch",
  "def": "The switch chip that connects every GPU's NVLink links so any GPU can read another's memory at full speed. An NVL72 rack holds 18 of them, two per switch tray across nine trays; a DGX H100 server puts four on its own baseboard instead.",
  "layer": "data",
  "sources": [
   "nvidia-nvl72-reference-arch",
   "nvidia-h100-datasheet"
  ],
  "cites": [
   ["nvidia-nvl72-reference-arch", "NVIDIA NVLink Switch Tray section: 'Each GB300 NVL72 rack includes 9 NVLink Fifth-Generation switch trays, with 2 NVSwitch ASICs per tray' (18 total)"],
   ["nvidia-h100-datasheet", "DGX H100 platform (nvidia-dgx-h100) pairs eight H100 GPUs with four third-generation NVSwitch chips on one system baseboard"]
  ],
  "link": {
   "scene": 3,
   "mode": "data",
   "part": "nvswitch"
  }
 },
 {
  "term": "NVL72",
  "def": "NVIDIA's rack-scale platform that wires 72 GPUs into a single NVLink domain through copper switch trays in the middle of the rack. Both GB200 and GB300 ship as NVL72 racks on this page; DGX H100 does not, since its NVLink domain stops at eight GPUs on one server board.",
  "layer": "data",
  "sources": [
   "nvidia-gb200-nvl72",
   "nvidia-gb300-nvl72"
  ],
  "link": {
   "scene": 2,
   "mode": "data",
   "part": "racks"
  }
 },
 {
  "term": "Scale-up",
  "def": "The network tier that stays inside one machine, an NVL72 rack or a single DGX H100 server, fast enough to split one model layer's own math across GPUs. It is the chattiest traffic on the page, which is why it never leaves copper.",
  "layer": "data",
  "sources": [
   "nvidia-nvl72-reference-arch"
  ],
  "link": {
   "scene": 3,
   "mode": "data",
   "part": "nvswitch"
  }
 },
 {
  "term": "Scale-out",
  "def": "The optical fabric outside a rack or server: one port per GPU into a leaf-and-spine network that lets any GPU on the campus reach any other. It carries far less traffic per link than scale-up, which is why it can afford to be fiber instead of copper.",
  "layer": "data",
  "link": {
   "scene": 2,
   "mode": "data",
   "part": "uplinks"
  }
 },
 {
  "term": "Scale-across",
  "def": "The long-haul fiber tier linking whole campuses hundreds of kilometers apart over coherent DWDM optics. Light in fiber still needs about 5 milliseconds to cross 1,000 km, so only loosely synced training crosses this tier; interactive traffic mostly does not.",
  "layer": "data",
  "sources": [
   "microsoft-ai-wan",
   "nvidia-spectrum-xgs"
  ],
  "link": {
   "scene": 0,
   "mode": "data",
   "part": "route"
  }
 },
 {
  "term": "Leaf",
  "def": "Switches at the row ends of a data hall that every rack's GPUs connect up into first. In a rail-optimized layout, GPU number n in every rack plugs into the same leaf switch, so most traffic crosses just one hop.",
  "layer": "data",
  "link": {
   "scene": 2,
   "mode": "data",
   "part": "leaf"
  }
 },
 {
  "term": "Spine",
  "def": "The switch tier above the leaves that connects every leaf to every other, so any GPU on the campus can reach any other in a couple of hops. Two tiers of 144-port switches reach roughly 10,000 GPUs before a third tier or parallel fabric planes are needed.",
  "layer": "data",
  "sources": [
   "nvidia-xdr-switch-specs"
  ],
  "link": {
   "scene": 2,
   "mode": "data",
   "part": "spine"
  }
 },
 {
  "term": "Rail-optimized",
  "def": "A leaf-and-spine wiring pattern where GPU number n in every rack lands on the same leaf switch as GPU number n everywhere else. Most all-reduce and pipeline traffic then crosses only one switch instead of climbing the whole fabric.",
  "layer": "data",
  "link": {
   "scene": 2,
   "mode": "data",
   "part": "leaf"
  }
 },
 {
  "term": "Fat tree",
  "def": "The non-blocking Clos topology a leaf-spine (or leaf-spine-core) fabric uses, where every tier carries as much bandwidth going up as coming down. Scaling it further means adding switches, not just links, at whichever tier runs out of ports.",
  "layer": "data",
  "sources": [
   "nvidia-xdr-switch-specs"
  ],
  "link": {
   "scene": 2,
   "mode": "data",
   "part": "spine"
  }
 },
 {
  "term": "SuperNIC",
  "aka": [
   "ConnectX SuperNIC"
  ],
  "def": "NVIDIA's per-GPU network card for scale-out traffic, letting a GPU reach other racks without going through its CPU. GB300 pairs each GPU with a ConnectX-8 SuperNIC running 800 Gb/s.",
  "layer": "data",
  "sources": [
   "nvidia-connectx8-datasheet",
   "nvidia-connectx8-specs-page"
  ],
  "cites": [
   ["nvidia-connectx8-specs-page", "Specifications, C8180 single-port variant: InfiniBand speed 'XDR/NDR/HDR/HDR100/EDR/SDR' — XDR is NVIDIA's 800 Gb/s InfiniBand generation (see nvidia-xdr-switch-specs)"]
  ],
  "link": {
   "scene": 4,
   "mode": "data",
   "part": "cx"
  }
 },
 {
  "term": "DPU",
  "aka": [
   "BlueField DPU"
  ],
  "def": "A separate network processor, NVIDIA's BlueField, that runs storage, security, and the front-end request network, so a user's traffic never shares hardware with the GPU-to-GPU fabric. An NVL72 rack carries two DPUs per compute tray, 36 in all.",
  "layer": "data",
  "sources": [
   "nvidia-dgx-gb200-hardware"
  ],
  "cites": [
   ["nvidia-dgx-gb200-hardware", "Compute Trays table: '2x NVIDIA BlueField-3 DPU, dual port 400G Infiniband or Ethernet' per tray; 18 compute trays per rack give 36 total"]
  ],
  "link": {
   "scene": 4,
   "mode": "data",
   "part": "dpu"
  }
 },
 {
  "term": "OSFP",
  "def": "Octal Small Form-factor Pluggable, the module housing scale-out ports use to carry light on and off a switch or NIC. NVIDIA's 800G DR8 module, a twin-port OSFP, draws up to 17 W.",
  "layer": "data",
  "sources": [
   "nvidia-800g-dr8-datasheet"
  ],
  "link": {
   "scene": 4,
   "mode": "data",
   "part": "osfp"
  }
 },
 {
  "term": "Pluggable optics",
  "def": "Transceiver modules that plug into a switch or NIC port and convert its electrical signal to light for fiber, the default way scale-out and campus links are lit today. Power runs 8-9 W for a 400G module up to 25-30 W for an early 1.6T module.",
  "layer": "data",
  "sources": [
   "nvidia-800g-dr8-datasheet"
  ],
  "link": {
   "scene": 2,
   "mode": "data",
   "part": "optics"
  }
 },
 {
  "term": "DSP (optics)",
  "aka": [
   "digital signal processor"
  ],
  "def": "The signal-processing chip inside a fully-retimed pluggable module that regenerates the electrical signal on transmit and recovers it on receive, before it reaches the laser or after it leaves the photodiode. Linear optics (LPO) cut module power by removing this chip and letting the host chip's own SerDes drive and read the line directly. Co-packaged optics (CPO) takes a different path: it moves the optical engine itself onto or next to the switch ASIC's package, shortening the electrical run between SerDes and modulator — it is not simply this same chip relocated, and some CPO designs still retime.",
  "layer": "data",
  "link": {
   "scene": 2,
   "mode": "data",
   "part": "optics"
  }
 },
 {
  "term": "LPO",
  "aka": [
   "linear pluggable optics"
  ],
  "def": "A pluggable module with no DSP: the host chip's own SerDes drives the modulator and reads the photodiode directly, doing the equalization work the DSP used to do instead of regenerating the signal first. This page notes it runs at roughly half the power of a fully-retimed module, at some cost to reach and design margin.",
  "layer": "data",
  "link": {
   "scene": 2,
   "mode": "data",
   "part": "optics"
  }
 },
 {
  "term": "CPO",
  "aka": [
   "co-packaged optics"
  ],
  "def": "Optical engines built onto or next to a switch ASIC's own package, shortening the electrical channel between SerDes and modulator, instead of living in separate pluggable modules at the faceplate — a packaging change, not a claim about how many traffic fibers still leave the switch. NVIDIA's Quantum-X and Spectrum-X Photonics claim four times fewer lasers and, as of its August 2026 update, 5x lower power (up from an initial 3.5x); Broadcom's Davisson reaches 102.4 Tb/s at about 3.5 W per 800G port.",
  "layer": "data",
  "sources": [
   "nvidia-spectrum-x-cpo",
   "broadcom-davisson-cpo",
   "storagereview-nvidia-cpo-production"
  ],
  "cites": [
   ["nvidia-spectrum-x-cpo", "03/18/2025 announcement: 'integrate optics innovations with 4x fewer lasers to deliver 3.5x more power efficiency'"],
   ["storagereview-nvidia-cpo-production", "08/2026: production Spectrum-X Photonics delivers '5x lower power consumption'"],
   ["broadcom-davisson-cpo", "Broadcom's own 10/08/2025 announcement names the 102.4-Tbps figure; the power-per-port figure is reported by NextPlatform (see links:cpo), not stated in this release itself"]
  ],
  "link": {
   "scene": 2,
   "mode": "data",
   "part": "cpo"
  }
 },
 {
  "term": "External laser source",
  "aka": [
   "ELS"
  ],
  "def": "In a co-packaged optics design, a laser supplied from its own field-replaceable module at the front panel instead of one tiny laser built into every optical engine. NVIDIA's Quantum-X Photonics feeds all 144 of a chassis's 800G channels from 18 such modules, each packing eight individual laser diodes and each one lighting eight of those channels — the \"one laser for every eight links\" figure quoted for this design is at that module level, not a count of individual diodes. Consolidating into fewer, larger, swappable units is most of where NVIDIA's \"fewer lasers\" claim comes from.",
  "layer": "data",
  "sources": [
   "nvidia-spectrum-x-cpo",
   "ieee-spectrum-cpo-nvidia",
   "nvidia-cpo-industry-collaboration-blog"
  ],
  "cites": [
   ["nvidia-cpo-industry-collaboration-blog", "confirms the Q3450 system's '144 ports with 800Gbps apiece' (115.2 Tbps full-duplex) and 'Each ELS contains eight high-quality lasers'; an individual ELS is stated to power 32 of the switch's 576 transmit lanes — 576 ÷ 32 = 18 ELS modules, and 144 ports ÷ 18 modules = 8 ports per module, which is where this page's 'eight channels per module' figure comes from"]
  ],
  "link": {
   "scene": 2,
   "mode": "data",
   "part": "cpo"
  }
 },
 {
  "term": "DAC",
  "aka": [
   "direct-attach copper"
  ],
  "def": "A passive copper cable with no active parts at either end, the cheapest and lowest-power way to move a signal, but its reach collapses as lane speed climbs. At 224 Gb/s per lane it is good for about a meter, enough for NVLink's copper spine inside one rack.",
  "layer": "data",
  "link": {
   "scene": 3,
   "mode": "data",
   "part": "spine"
  }
 },
 {
  "term": "ACC",
  "aka": [
   "active copper cable"
  ],
  "def": "A copper cable with a redriver chip at each end that amplifies and cleans the signal without fully regenerating it. At 200 Gb/s per lane it stretches copper to about 3 meters for a couple of watts per end, enough to reach the rack next door.",
  "layer": "data"
 },
 {
  "term": "AEC",
  "aka": [
   "active electrical cable"
  ],
  "def": "A copper cable with a full DSP retimer at each end that regenerates the signal from scratch, at the cost of far more power than a redriver. It commonly reaches 7-9 meters; AWS uses it to link Trainium racks, and trade photos of xAI's Colossus are reported to show the same cable type.",
  "layer": "data"
 },
 {
  "term": "Copper wall",
  "def": "Trade-press shorthand for the point, a few meters of reach at 200-plus Gb/s per lane, past which copper stops working even with an active redriver or retimer chip, and every design switches to optics regardless of the extra power. Every interconnect vendor hits the same physics as lane speeds climb; no single vendor sets this number.",
  "layer": "data"
 },
 {
  "term": "PAM4",
  "def": "Four-level signaling that packs two bits into every symbol, used on both NVLink's copper spine and scale-out fiber links at speeds like 224 Gb/s per lane. It doubles the data rate of simple two-level signaling at the same symbol rate, at the cost of needing a cleaner signal to read correctly.",
  "layer": "data",
  "link": {
   "scene": 3,
   "mode": "data",
   "part": "spine"
  }
 },
 {
  "term": "SerDes",
  "aka": [
   "serializer/deserializer"
  ],
  "def": "Circuits along a die's edge that turn parallel on-chip data into the fast serial lanes a link like NVLink sends off the package. Every high-speed interconnect on this page, copper or optical, starts and ends at a SerDes.",
  "layer": "data",
  "link": {
   "scene": 5,
   "mode": "data",
   "part": "nvphy"
  }
 },
 {
  "term": "MPO",
  "aka": [
   "multi-fiber push-on connector"
  ],
  "def": "A connector that bundles several fibers, commonly 12, behind one push-on plug so a single optical module can light many lanes at once. An 800G DR4 module uses 8 of the 12 positions on one MPO connector; a twin-port DR8 module uses two.",
  "layer": "data"
 },
 {
  "term": "Single-mode fiber",
  "def": "Fiber with a core narrow enough that light travels one path through it, avoiding the mode-mixing that limits shorter-reach multimode fiber. It is what carries scale-out, campus, and long-haul optics on this page, since only single-mode fiber reaches past a few hundred meters.",
  "layer": "data",
  "link": {
   "scene": 2,
   "mode": "data",
   "part": "runways"
  }
 },
 {
  "term": "DCI",
  "aka": [
   "data center interconnect"
  ],
  "def": "The equipment and fiber that link one campus to another: coherent transponders in a line-terminal hut turning a handful of wavelengths into a shared long-haul connection. Ciena's WaveLogic 6, cited on this page, reaches up to 1.6 Tb/s per wavelength.",
  "layer": "data",
  "sources": [
   "ciena-wavelogic6"
  ],
  "cites": [
   ["ciena-wavelogic6", "02/21/2023 release, headlined (per its own indexed title and a BusinessWire mirror) 'Ciena Unveils WaveLogic 6, Industry's First 1.6Tb/s Coherent Optic Solution'; ciena.com blocked direct and Wayback access on every attempt this pass, so this rests on that title and third-party coverage, not a page this workstream opened itself"]
  ],
  "link": {
   "scene": 1,
   "mode": "data",
   "part": "dci"
  }
 },
 {
  "term": "Coherent optics",
  "def": "Optical transmission that encodes data in a light wave's amplitude, phase and polarization together, not just on and off, so one wavelength carries far more bits per symbol than direct-detect optics like LR4. A coherent transceiver — a pluggable (400ZR/800ZR-class) or a transponder in a line-terminal shelf — produces and receives one such wavelength; a separate mux/demux combines many wavelengths onto one fiber pair, and separate optical amplifiers extend the run. Coherent detection isn't what makes DWDM possible — direct-detect wavelengths can be multiplexed too — it's what lets each wavelength on a long run carry the most data.",
  "layer": "data",
  "sources": [
   "ciena-wavelogic6",
   "oif-400zr-ia"
  ],
  "link": {
   "scene": 0,
   "mode": "data",
   "part": "dci"
  }
 },
 {
  "term": "400ZR / 800ZR",
  "def": "Standardized coherent pluggable formats for metro and data-center-interconnect links, running 400 Gb/s or 800 Gb/s per wavelength. OIF's own implementation agreement targets 80 km or more for amplified 400ZR links (120 km class for the higher-loss-budget variant); an unamplified link's reach instead depends on the specific module's transmit power and receiver sensitivity, commonly quoted around 40 km. Module power runs about 15-20 W for 400ZR; 800ZR draws about 23-25 W, and the longer-reach 800ZR+ variant about 26-30 W.",
  "layer": "data",
  "sources": [
   "ciena-wavelogic6",
   "oif-400zr-ia"
  ],
  "cites": [
   ["oif-400zr-ia", "Section 7.1 'use cases': 'The 400ZR targeted reach for these applications is 80km or more' for amplified, 100/75 GHz DWDM links (Application Codes 0x01/0x03); Section 7.2 states unamplified reach 'is dependent on the transmit output power, input receive sensitivity, and the channel's loss characteristics' rather than giving one fixed number"]
  ],
  "link": {
   "scene": 1,
   "mode": "data",
   "part": "dci"
  }
 },
 {
  "term": "Amplifier hut",
  "def": "A small building along a long-haul fiber route, roughly every 80-100 km, that boosts the light optically without ever converting it back to electricity. Spacing this close is a rule of thumb, not a fixed standard.",
  "layer": "data",
  "link": {
   "scene": 0,
   "mode": "data",
   "part": "ila"
  }
 },
 {
  "term": "DWDM",
  "aka": [
   "dense wavelength-division multiplexing"
  ],
  "def": "Putting dozens of separate wavelengths on one fiber pair, each an independent channel of light. This page's model runs 32 wavelengths of 800G each on a route, 25.6 Tb/s total, which is how a campus's few physical fiber routes carry all of its long-haul traffic.",
  "layer": "data",
  "sources": [
   "ciena-wavelogic6"
  ],
  "link": {
   "scene": 0,
   "mode": "data",
   "part": "dci"
  }
 },
 {
  "term": "GPU",
  "def": "The chip that does a model's math: one or two reticle-size dies plus stacked HBM memory in a single package. This page follows four generations, from the 700 W H100 (2023) to the pre-launch, 1,800 W Rubin (2026-27), marked as an estimate since it hasn't shipped.",
  "layer": "compute",
  "sources": [
   "nvidia-h100-datasheet",
   "nvidia-gb200-nvl72"
  ],
  "link": {
   "scene": 4,
   "mode": "power",
   "part": "gpu"
  }
 },
 {
  "term": "Die",
  "def": "A single piece of silicon, cut at the reticle limit, the largest a chip can be made in one lithography exposure. Blackwell-class GPUs join two such dies with a 10 TB/s link so software sees one GPU; H100 uses a single die.",
  "layer": "compute",
  "sources": [
   "nvidia-blackwell-ultra-blog",
   "wccftech-nv-hbi"
  ],
  "cites": [
   ["nvidia-blackwell-ultra-blog", "'Blackwell Ultra is composed of two reticle-sized dies connected using NVIDIA High-Bandwidth Interface (NV-HBI)...that provides 10 TB/s of bandwidth'"]
  ],
  "link": {
   "scene": 5,
   "mode": "power",
   "part": "dies"
  }
 },
 {
  "term": "Reticle limit",
  "aka": [
   "reticle-limit die"
  ],
  "def": "The largest area a chip can be made in a single lithography exposure, a hard ceiling on one die's size no matter the process node. H100's 814 mm² die sits at this ceiling; Blackwell-class GPUs get more silicon per package by joining two reticle-limit dies with a fast die-to-die link instead of trying to build one larger die.",
  "layer": "compute",
  "sources": [
   "nvidia-h100-datasheet",
   "nvidia-blackwell-ultra-blog",
   "wccftech-nv-hbi"
  ],
  "cites": [
   ["nvidia-blackwell-ultra-blog", "confirms the dual-reticle join at 10 TB/s (NV-HBI); H100's single-die, 814 mm² figure is the well-corroborated industry figure for the GH100 die rather than a number stated on NVIDIA's own two-page H100 datasheet, which gives only 80 billion transistors and TDP"]
  ],
  "link": {
   "scene": 5,
   "mode": "power",
   "part": "dies"
  }
 },
 {
  "term": "HBM",
  "aka": [
   "high-bandwidth memory"
  ],
  "def": "Stacked DRAM built beside the GPU die on the same interposer, feeding it at several terabytes per second over millimeters of wiring. This page assumes it runs 8-15% of a GPU's power, an estimate drawn from academic GPU power-characterization studies rather than a vendor disclosure; moving weights out of it for every token is a large share of inference energy.",
  "layer": "compute",
  "sources": [
   "micron-hbm3e-brief"
  ],
  "cites": [
   ["micron-hbm3e-brief", "cited for HBM3E's own bandwidth/capacity specs; the WAF on assets.micron.com blocked every attempt to open it this pass (see its 'unchecked' note), so it is not relied on here for the 8-15% power-share figure, which the model treats as its own assumption"]
  ],
  "link": {
   "scene": 5,
   "mode": "power",
   "part": "hbm"
  }
 },
 {
  "term": "Interposer",
  "def": "A silicon layer that wires a GPU's dies and HBM stacks together with connections far finer than any circuit board could carry. NVIDIA calls its packaging CoWoS-L for Blackwell-class GPUs and CoWoS-S for H100.",
  "layer": "compute",
  "sources": [
   "nvidia-blackwell-ultra-blog",
   "wccftech-nv-hbi"
  ],
  "link": {
   "scene": 5,
   "mode": "power",
   "part": "interposer"
  }
 },
 {
  "term": "Tensor parallel",
  "def": "Splitting one model layer's own math across several GPUs, which trade partial results inside every layer, many times per token. It's the chattiest form of parallelism, which is why Llama 3 405B kept it to tensor parallel 8, the size of one NVLink domain on H100.",
  "layer": "compute",
  "sources": [
   "meta-llama3-herd-parallelism"
  ],
  "cites": [
   ["meta-llama3-herd-parallelism", "Table 4, 'Scaling configurations and MFU for each stage of Llama 3 405B pre-training': all three listed stages run TP=8 (with PP=16, CP=1 or 16, and DP=64/128/8)"]
  ],
  "link": {
   "scene": 3,
   "mode": "data",
   "part": "tp"
  }
 },
 {
  "term": "Pipeline parallel",
  "def": "Splitting a model's layers into consecutive stages, each living on a different rack, and passing activations down the line like an assembly line. Llama 3 405B ran pipeline parallel 16 this way.",
  "layer": "compute",
  "sources": [
   "meta-llama3-herd-parallelism"
  ],
  "cites": [
   ["meta-llama3-herd-parallelism", "Table 4, 'Scaling configurations and MFU for each stage of Llama 3 405B pre-training': PP=16 at every listed GPU count (8,192 and 16,384)"]
  ],
  "link": {
   "scene": 2,
   "mode": "data",
   "part": "pp"
  }
 },
 {
  "term": "Data parallel",
  "def": "Running many full copies of a model on different data and averaging their gradients across the fabric once per training step. It's the largest-scale, least-frequent form of parallelism on this page short of syncing loosely across whole campuses.",
  "layer": "compute",
  "sources": [
   "meta-llama3-herd-parallelism",
   "deepseek-v3-technical-report"
  ],
  "cites": [
   ["meta-llama3-herd-parallelism", "Table 4: data parallel degree scales with GPU count (DP=64 at 8,192 GPUs, up to DP=128 at 16,384)"],
   ["deepseek-v3-technical-report", "Section 3: training combines expert and pipeline parallelism with 'ZeRO-1 Data Parallelism (DP)'"]
  ],
  "link": {
   "scene": 2,
   "mode": "data",
   "part": "dp"
  }
 },
 {
  "term": "Expert parallel",
  "def": "Spreading a mixture-of-experts model's experts across GPUs so each token only visits the few experts it's routed to. DeepSeek-V3's own training used expert parallel 64 with no tensor parallel at all; NVIDIA describes NVL72's wide NVLink domain as enabling wide expert parallelism for inference too — its own reference deployment of DeepSeek R1 spreads 256 routed experts across 64 of a rack's 72 GPUs.",
  "layer": "compute",
  "sources": [
   "deepseek-v3-technical-report",
   "nvidia-gb200-dynamo-moe"
  ],
  "cites": [
   ["deepseek-v3-technical-report", "Section 3.2.1: 'DeepSeek-V3 applies 16-way Pipeline Parallelism (PP)...64-way Expert Parallelism (EP)...spanning 8 nodes' and elsewhere: trained 'without using costly Tensor Parallelism (TP)'"],
   ["nvidia-gb200-dynamo-moe", "'For the DeepSeek R1 model, this is typically around four experts per GPU, which requires 64 GPUs to accommodate the full 256 routed experts during decoding'"]
  ],
  "link": {
   "scene": 3,
   "mode": "data",
   "part": "tp"
  }
 },
 {
  "term": "Prefill",
  "def": "The first phase of answering a prompt: the model takes in the prompt's tokens in parallel, often in chunks alongside other requests. Each weight it reads serves many prompt tokens, so prefill is usually limited by compute rather than by memory bandwidth. A long prompt can take a few hundred milliseconds; together with the queue and the network, that sets the time to first token.",
  "layer": "compute",
  "link": {
   "scene": 5,
   "mode": "power",
   "part": "dies"
  }
 },
 {
  "term": "Decode",
  "def": "The second phase of answering a prompt: each new reply token is written one at a time. For a small batch, every token re-reads the model's weights, so decode speed usually tracks HBM bandwidth more than raw GPU math; serving many users in one batch shares each read and leans more on compute.",
  "layer": "compute",
  "link": {
   "scene": 5,
   "mode": "data",
   "part": "hbm"
  }
 },
 {
  "term": "KV cache",
  "aka": [
   "key-value cache"
  ],
  "def": "A model's running memory of a conversation, the keys and values computed from every earlier token in the prompt and reply so far. Every new token during decode reads both the model's weights and this cache from HBM, which is a second reason serving speed follows memory bandwidth.",
  "layer": "compute",
  "link": {
   "scene": 5,
   "mode": "data",
   "part": "hbm"
  }
 },
 {
  "term": "Token",
  "def": "The unit a language model reads and writes, roughly a few characters of text. What leaves a GPU package after all its power is a few bytes per token, and this page's calculator turns a campus's tokens-per-second into a figure per kilowatt-hour.",
  "layer": "compute",
  "sources": [
   "samsi-words-to-watts",
   "google-inference-impact"
  ],
  "link": {
   "scene": 5,
   "mode": "power",
   "part": "tokens"
  }
 },
 {
  "term": "H100-equivalent",
  "def": "An industry shorthand, used by trackers like Epoch AI, for normalizing different GPU generations into one common compute unit, since a GB200 or Rubin GPU does many times an H100's math per chip. This page avoids the shorthand and instead reports each real campus's own disclosed chip mix and generation, marking any undisclosed split as an estimate.",
  "layer": "compute"
 },
 {
  "term": "TDP",
  "aka": [
   "thermal design power"
  ],
  "def": "The power a chip is designed to dissipate as heat, in practice the same number as its electrical power draw. This page's GPUs run 700 W (H100) up to 1,800 W (Rubin, pre-launch, an estimate) at the package.",
  "layer": "heat",
  "sources": [
   "nvidia-h100-datasheet"
  ],
  "cites": [
   ["nvidia-h100-datasheet", "specifications table: 'Max thermal design power (TDP): Up to 700W (configurable)' for the SXM form factor"]
  ],
  "link": {
   "scene": 4,
   "mode": "heat",
   "part": "gpuheat"
  }
 },
 {
  "term": "Junction temperature",
  "def": "The temperature at the transistors themselves, the hottest point anywhere in the building. GPUs are thought to throttle near about 85 degrees C, though NVIDIA doesn't publish an exact limit; this page's warm-water design keeps the die around 70 degrees C.",
  "layer": "heat",
  "link": {
   "scene": 5,
   "mode": "heat",
   "part": "junction"
  }
 },
 {
  "term": "TIM",
  "aka": [
   "thermal interface material"
  ],
  "def": "A thin layer of thermally conductive paste or pad between a die and its lid, and again between the lid and the cold plate or heat sink above it. Each layer of TIM the heat crosses costs a few degrees before it reaches coolant.",
  "layer": "heat",
  "link": {
   "scene": 5,
   "mode": "heat",
   "part": "tim"
  }
 },
 {
  "term": "Cold plate",
  "def": "A copper plate with fine internal fins sitting directly on a hot chip, GPU, CPU, sometimes a switch chip, carrying coolant that enters cool and leaves a few degrees warmer. On this page's fully liquid-cooled NVL72 rack, even the switch trays and power shelves sit on cold plates.",
  "layer": "heat",
  "sources": [
   "alliance-chemical-gpu-thermal"
  ],
  "link": {
   "scene": 4,
   "mode": "heat",
   "part": "coldplates"
  }
 },
 {
  "term": "CDU",
  "aka": [
   "coolant distribution unit"
  ],
  "def": "A cabinet at the end of a row that keeps a rack's own filtered coolant loop separate from the building's facility water, passing heat between the two through a plate heat exchanger without mixing them. In this model the facility water runs about 3 °C below the rack loop on each side. Units on this page range 70 kW to 2.3 MW of capacity.",
  "layer": "heat",
  "sources": [
   "vertiv-coolchip-cdu",
   "motivair-cdu-brochure"
  ],
  "cites": [
   ["vertiv-coolchip-cdu", "CoolChip CDU family page lists models at 70, 121, 600, 1,350 and 2,300 kW"],
   ["motivair-cdu-brochure", "brochure: 'COOLING UP TO 2.3MW' from '102kW up to 2.3MW, depending on the model'"]
  ],
  "link": {
   "scene": 2,
   "mode": "heat",
   "part": "cdu"
  }
 },
 {
  "term": "Facility water",
  "def": "The building-wide water loop carrying heat between the CDUs, or in-row cooling units, and the chiller plant or dry coolers outside. This page draws its supply line blue and its warmer return line red.",
  "layer": "heat",
  "link": {
   "scene": 2,
   "mode": "heat",
   "part": "fwater"
  }
 },
 {
  "term": "Dry cooler",
  "def": "A rooftop coil-and-fan unit that rejects heat from warm facility water, 30-45 degrees C, straight into outside air with fans alone, no water spent and no chiller needed most of the year. This page's warm-water design uses dry coolers, backed by evaporative sprays only on the hottest afternoons.",
  "layer": "heat",
  "sources": [
   "ashrae-liquid-cooling-classes",
   "introl-wue"
  ],
  "link": {
   "scene": 1,
   "mode": "heat",
   "part": "drycoolers"
  }
 },
 {
  "term": "ASHRAE water classes (W17-W45)",
  "aka": [
   "ASHRAE liquid cooling classes"
  ],
  "def": "ASHRAE's naming for facility-water temperature bands, W17 through W45 and W+, where the number is the maximum supply temperature in degrees Celsius. This page's dry-cooler design runs in the W32-W45 band, warm enough to reject heat to outside air most of the year without a chiller.",
  "layer": "heat",
  "sources": [
   "ashrae-liquid-cooling-classes"
  ],
  "cites": [
   ["ashrae-liquid-cooling-classes", "'the 5th Edition redesignated the classes based on their upper temperature limit — therefore the classes are now W17, W27, W32, [W40,] W45, and the now named W+', redesignated from the prior W1-W5 bands (upper limits 17/27/32/45/over-45°C)"]
  ],
  "link": {
   "scene": 1,
   "mode": "heat",
   "part": "drycoolers"
  }
 },
 {
  "term": "Chiller",
  "def": "A refrigeration unit that spends electricity to make cold water, about 12 degrees C for air-cooled halls or about 20 degrees C for direct-to-chip liquid racks. Chiller compressors are the single biggest power draw in that kind of cooling plant, which is why it lands at a higher PUE than warm-water cooling.",
  "layer": "heat",
  "link": {
   "scene": 1,
   "mode": "heat",
   "part": "chillers"
  }
 },
 {
  "term": "Cooling tower",
  "aka": [
   "cooling towers"
  ],
  "def": "An evaporative structure that carries away the chillers' rejected heat, or, in a warm-water design, trims the loop only on the hottest days. Evaporating a kilogram of water this way removes about 2.4 megajoules of heat, which is where most of a data center's water use goes.",
  "layer": "heat",
  "sources": [
   "introl-wue",
   "nrel-water-electricity"
  ],
  "link": {
   "scene": 1,
   "mode": "heat",
   "part": "towers"
  }
 },
 {
  "term": "WUE",
  "aka": [
   "water usage effectiveness"
  ],
  "def": "Liters of water used on site per kilowatt-hour of IT power. This page's own cooling-design calibration spans about 0.16 L/kWh for warm-water dry coolers up to about 1.0 L/kWh for an air-cooled chiller-and-tower plant — figures this model chose to sit near, not the literal numbers introl-wue reports (which gives a wider industry range: 'ideal' 0.0, 'best-in-class' 0.3-0.7, and an industry average of 1.8-1.9 L/kWh).",
  "layer": "heat",
  "sources": [
   "introl-wue"
  ],
  "cites": [
   ["introl-wue", "gives 'Ideal WUE: 0.0 L/kWh', 'Best-in-class: 0.3-0.7 L/kWh' and 'Industry average: 1.8-1.9 L/kWh' — context this page's own air (≈1.0) and warm-water (≈0.16) design values sit inside and below, respectively"]
  ],
  "link": {
   "scene": 1,
   "mode": "heat",
   "part": "towers"
  }
 },
 {
  "term": "Hot aisle",
  "def": "The sealed space between rack backs where every rack's exhaust heat collects before reaching a cooling unit. On an air-cooled rack the whole load leaves this way; on a liquid-cooled one only the fraction water doesn't carry away directly does.",
  "layer": "heat",
  "link": {
   "scene": 2,
   "mode": "heat",
   "part": "hotaisle"
  }
 },
 {
  "term": "In-row cooler",
  "aka": [
   "in-row cooling unit"
  ],
  "def": "A cabinet the size of a rack, standing in the row itself, that pulls hot-aisle air through chilled-water coils and blows it back out cold at the rack fronts. This page's air-cooled hall design uses these instead of a CDU.",
  "layer": "heat",
  "link": {
   "scene": 2,
   "mode": "heat",
   "part": "inrow"
  }
 },
 {
  "term": "Fan wall",
  "def": "A wall of fans and water coils that pulls room air through and cools it, handling whatever share of a rack's heat, all of it in an air-cooled design, doesn't leave through liquid cooling.",
  "layer": "heat",
  "link": {
   "scene": 2,
   "mode": "heat",
   "part": "fanwall"
  }
 },
 {
  "term": "Grid carbon intensity",
  "def": "Grams of CO2 emitted per kilowatt-hour of grid electricity, which this page's state map shows varying more than fourfold: 113 g/kWh in hydro-heavy Washington versus 494 g/kWh in coal-and-gas-heavy Wisconsin. The same campus can emit three to four times more in one state than another.",
  "layer": "general",
  "sources": [
   "eia-state-washington",
   "eia-state-wisconsin"
  ],
  "cites": [
   ["eia-state-washington", "Washington Electricity Profile 2024, Table 1: Carbon Dioxide, 249 lb/MWh (≈113 g/kWh)"],
   ["eia-state-wisconsin", "Wisconsin Electricity Profile 2024, Table 1: Carbon Dioxide, 1,090 lb/MWh (≈494 g/kWh)"]
  ],
  "link": {
   "scene": 0,
   "mode": "power",
   "part": "carbon"
  }
 },
 {
  "term": "eGRID",
  "aka": [
   "Emissions & Generation Resource Integrated Database"
  ],
  "def": "The EPA database this page cites for the US national average grid carbon figure, 373 g CO2/kWh (823 lb/MWh) on 2022 data, alongside EIA's separate state-by-state electricity profiles for 2024. EPA has since published a newer eGRID2023 release with a lower national figure, so this page's number is a specific, dated historical reading rather than today's current average.",
  "layer": "general",
  "sources": [
   "epa-egrid2022-summary"
  ],
  "cites": [
   ["epa-egrid2022-summary", "eGRID Summary Tables 2022, Table 1 (Subregion Output Emission Rates, eGRID2022), U.S. row: CO2 823.1 lb/MWh"]
  ],
  "link": {
   "scene": 0,
   "mode": "power",
   "part": "carbon"
  }
 },
 {
  "term": "Interconnection",
  "def": "The process, and the physical tie-in, that connects a new campus's substation to the wider grid, typically at 230-500 kV. It commonly takes two to four years including the required interconnection study, part of why gigawatt campuses cluster where that grid capacity already exists.",
  "layer": "power",
  "sources": [
   "ieee-spectrum-hyperion",
   "epoch-stargate-abilene"
  ],
  "link": {
   "scene": 0,
   "mode": "power",
   "part": "grid"
  }
 },
 {
  "term": "Basis (Spec / Vendor / Reported / Derived / Assumed)",
  "aka": [
   "Spec",
   "Vendor",
   "Reported",
   "Derived",
   "Assumed"
  ],
  "def": "The label this page puts on every figure that carries a basis chip, one of five: \"Spec\" means the maker or a standards body states the figure for the named product or standard, with at least one primary source; \"Vendor\" means a vendor's own comparison or performance claim, attributed to it and stating what it's compared against, not checked independently here; \"Reported\" means a named third party — a government agency, researcher, analyst or the trade press — states it; \"Derived\" means this page's model calculates it from the scenario and its cited inputs, with the formula on the Method page; \"Assumed\" means the model chose a value where no single published figure applies, with the reason on the Method page. Two earlier labels, \"Typical\" and \"Est.\", covered figures not yet traced to one of these five; the site's build checks (`tools/claims.mjs`) fail if either still appears.",
  "layer": "general"
 },
 {
  "term": "Power ledger",
  "def": "This page's meter-to-silicon accounting: a running list of every conversion and loss between the utility meter and the GPU dies, in megawatts, that sums back to the campus's total draw. It's how the page shows where a watt actually goes, not just the final PUE ratio.",
  "layer": "general"
 },
 {
  "term": "Voltage staircase",
  "def": "A chart following one figure, current or voltage, down through every step of the power chain: 345 kV at the transmission line, 34.5 kV at the campus feeders, down to under a volt at the GPU core. Each rung links to the part of the 3D view where that step happens.",
  "layer": "general",
  "link": {
   "scene": 1,
   "mode": "power",
   "part": "line"
  }
 },
 {
  "term": "IT load",
  "def": "The power that actually reaches computing equipment, as distinct from the larger figure drawn at the meter, which also covers cooling and building overhead. The ratio of meter power to IT load is PUE.",
  "layer": "power",
  "link": {
   "scene": 1,
   "mode": "power",
   "part": "hall"
  }
 },
 {
  "term": "Accelerator",
  "def": "This page's word for a GPU generation and its rack platform together, since a GPU's power draw, memory, and cooling needs change together from one generation to the next. It tracks four: H100, GB200, GB300, and the pre-launch Rubin.",
  "layer": "compute",
  "link": {
   "scene": 4,
   "mode": "power",
   "part": "gpu"
  }
 },
 {
  "term": "NVLink-C2C",
  "def": "A coherent chip-to-chip link between a GPU and its paired CPU, fast enough that the GPU can treat the CPU's memory as a slower extension of its own. GB200 and GB300 run it at 900 GB/s; the pre-launch Rubin is expected at 1.8 TB/s, an estimate.",
  "layer": "data",
  "sources": [
   "nvidia-gb200-nvl72",
   "nvidia-gb200-nvl72-blog"
  ],
  "cites": [
   ["nvidia-gb200-nvl72-blog", "03/18/2024: 'NVLink-Chip-to-Chip (C2C) interface that delivers 900 GB/s of bidirectional bandwidth'"]
  ],
  "link": {
   "scene": 4,
   "mode": "data",
   "part": "c2c"
  }
 },
 {
  "term": "PCIe",
  "def": "The general-purpose bus connecting a GPU to its CPU and network card inside a DGX H100 server, PCIe Gen5 at about 64 GB/s per x16 direction. NVL72 racks replace it with NVLink-C2C to the CPU and dedicated NVLink for anything chattier.",
  "layer": "data",
  "sources": [
   "nvidia-h100-datasheet"
  ],
  "cites": [
   ["nvidia-h100-datasheet", "specifications table: 'Interconnect... PCIe Gen5: 128GB/s' (bidirectional total for an x16 link, i.e. about 64 GB/s per direction)"]
  ],
  "link": {
   "scene": 4,
   "mode": "data",
   "part": "pcie"
  }
 },
 {
  "term": "Stargate Abilene",
  "aka": [
   "OpenAI Stargate Abilene"
  ],
  "def": "OpenAI, Oracle, Crusoe, and SoftBank's Texas campus: partly operating, partly still being built. Buildings 1-4 of 8 were live at about 421 MW of IT power as of 09/24/2026; buildings 5-8 are roofed and being fitted out, with the full campus, over 1 GW, due between Q4 2026 and Q1 2027.",
  "layer": "general",
  "sources": [
   "epoch-dc-abilene",
   "epoch-stargate-abilene"
  ],
  "cites": [
   ["epoch-dc-abilene", "directory entry, updated 09/24/2026: '421 MW of IT power'; buildings 5-8 'structurally complete and roofed but not yet confirmed operational'"],
   ["epoch-stargate-abilene", "'Projected capacity: 1.2 GW | 1.0 million H100-equivalents...Projected completion: Q4 2026' for the full site"]
  ],
  "link": {
   "scene": 0,
   "mode": "power",
   "part": "site-abilene"
  }
 },
 {
  "term": "SpaceXAI Colossus 1",
  "aka": [
   "Colossus",
   "xAI Colossus 1"
  ],
  "def": "The first Memphis campus of SpaceXAI (xAI until its July 2026 rebrand, after SpaceX acquired it in February): fully built and operating. About 200,000 GPUs (H100, H200, some GB200), leased in full to Anthropic since 05/06/2026; confirmed grid supply is 150 MW from MLGW/TVA. Trade reports counted about 35 on-site gas turbines, about 422 MW in all; SpaceXAI says its remaining temporary turbines must all be removed by July 2027, and that more than 240 batteries let the site come fully off the grid in emergencies or at peak demand.",
  "layer": "general",
  "sources": [
   "compute-atlas-colossus",
   "wikipedia-colossus",
   "tomshardware-colossus",
   "dcd-xai-colossus-memphis",
   "spacexai-mid-south",
   "bi-spacexai-rebrand"
  ],
  "cites": [
   ["compute-atlas-colossus", "'About 35 on-site natural-gas turbines (a combined 422 MW per SELC and aerial imagery) supplement a 150 MW grid substation and Tesla Megapack storage'; ~100,000 H100 GPUs Phase 1, later expanded with H200s"],
   ["dcd-xai-colossus-memphis", "reports TVA/MLGW's board approving 'an additional 150MW of power' for Colossus"],
   ["spacexai-mid-south", "Power tab: 'more than 240 batteries so Colossus I can come completely offline during emergencies or peak demand'; Air tab: 'all remaining temporary turbines must be removed by July 2027'"],
   ["bi-spacexai-rebrand", "reports xAI's rebrand to SpaceXAI, 07/06/2026"]
  ],
  "link": {
   "scene": 0,
   "mode": "power",
   "part": "site-colossus1"
  }
 },
 {
  "term": "SpaceXAI Colossus 2",
  "aka": [
   "xAI Colossus 2"
  ],
  "def": "SpaceXAI's second Memphis campus (xAI until July 2026), about 3 km from Colossus 1: live and still growing, and called the \"First Gigawatt Datacenter\" by SemiAnalysis in 09/2025. By satellite estimate it ran about 946 MW of IT power and 440,000 Nvidia chips as of 09/24/2026; the company reported about 550,000 chips installed by 09/25/2026 and says it plans 1M+ GPUs. SpaceXAI lists a planned 3.3 GWh grid-connected battery pack for it, says its temporary gas turbines must be removed by July 2027, mentions no diesel generators, and says it uses closed-loop cooling that takes only domestic water. By Epoch AI's tracking, it is the most powerful AI data center operating today, by both IT power and compute; Amazon and Anthropic's New Carlisle campus is next, at about 910 MW with more chips but less compute.",
  "layer": "general",
  "sources": [
   "epoch-dc-colossus2",
   "epoch-largest-dc",
   "semianalysis-xai-colossus2",
   "wikipedia-colossus",
   "spacexai-mid-south",
   "bi-spacexai-rebrand"
  ],
  "cites": [
   ["epoch-dc-colossus2", "directory entry, updated 09/24/2026: '1,112k H100-eq AI compute, supported by 946 MW of IT power,' with '110k' B200 and '330k' B300 chips (≈440k total)"],
   ["epoch-largest-dc", "'Colossus 2 is the largest tracked AI data center at about 946 MW of current IT power, followed by Anthropic-Amazon New Carlisle at about 910 MW'"],
   ["semianalysis-xai-colossus2", "headline: 'xAI's Colossus 2 — First Gigawatt Datacenter In The World'"],
   ["spacexai-mid-south", "Colossus II tab: 'GPUs planned 1M+'; 'America's largest grid-connected battery pack will provide 3.3 gigawatt hours'. Water tab: 'Colossus II uses closed-loop cooling and takes only domestic water'. Air tab: 'all remaining temporary turbines must be removed by July 2027'. No tab mentions diesel generators (checked 09/27/2026)"]
  ],
  "link": {
   "scene": 0,
   "mode": "power",
   "part": "site-colossus1"
  }
 },
 {
  "term": "Microsoft Fairwater Atlanta",
  "def": "Microsoft's Fayetteville, Georgia campus: partly operating, partly under construction. 4 of 9 main-campus buildings were live at about 636 MW of IT power as of 09/24/2026; the other five, plus a planned four-building east campus, are under construction toward about 1.5 GW.",
  "layer": "general",
  "sources": [
   "epoch-dc-fairwater-atl",
   "microsoft-infinite-scale",
   "dcd-fairwater-atlanta",
   "datacenterfrontier-fairwater"
  ],
  "cites": [
   ["epoch-dc-fairwater-atl", "directory entry, updated 09/24/2026: 636 MW current IT power, 4 buildings operational (Buildings 1-2 by 10/2025, 3-4 by 06/2026)"]
  ],
  "link": {
   "scene": 0,
   "mode": "power",
   "part": "site-fairwater-atl"
  }
 },
 {
  "term": "Microsoft Fairwater Wisconsin",
  "def": "Microsoft's Mount Pleasant, Wisconsin campus: partly operating. Building 1 has run since 04/16/2026 at about 369 MW of IT power; Building 2 is under construction, due in 2028.",
  "layer": "general",
  "sources": [
   "epoch-dc-fairwater-wi",
   "dcd-fairwater-wisconsin",
   "techtimes-fairwater-wisconsin"
  ],
  "cites": [
   ["epoch-dc-fairwater-wi", "directory entry, updated 09/24/2026: Building 1 operational, dated to a 04/16/2026 Microsoft post; 369 MW of current IT power. Epoch's own construction-pace estimate for Building 2 (~early 2027) is earlier than the 2028 date reported elsewhere for this campus — see techtimes-fairwater-wisconsin, which this page follows"]
  ],
  "link": {
   "scene": 0,
   "mode": "power",
   "part": "site-fairwater-wi"
  }
 },
 {
  "term": "Meta Hyperion",
  "def": "Meta's Richland Parish, Louisiana campus: still under construction, with nothing live yet in the latest satellite imagery (04/2026). Phase 1, roughly 1.5-1.6 GW, is projected around late 2027 to early 2028; Meta itself has said the full build will reach 5 GW, though Epoch AI notes it has found no concrete evidence yet that all 5 GW lands at this specific Richland Parish site rather than being spread across Meta's broader build-out.",
  "layer": "general",
  "sources": [
   "epoch-dc-hyperion",
   "meta-richland-parish",
   "cnbc-meta-louisiana",
   "led-meta-louisiana"
  ],
  "cites": [
   ["epoch-dc-hyperion", "directory entry: latest satellite imagery '04/17/2026' shows nothing serving yet; Epoch's own projection has 'first phase operational' around 01/01/2028 at about 1,632 MW IT power, and notes 'no concrete evidence' the full 5 GW Meta has announced lands entirely at this one site"]
  ],
  "link": {
   "scene": 0,
   "mode": "power",
   "part": "site-hyperion"
  }
 }
];
