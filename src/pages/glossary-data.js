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
  "def": "Where the transmission line dead-ends on steel gantries and lands on a ring of SF6 circuit breakers and disconnect switches, with instrument transformers to measure the power and surge arresters to clip lightning. Building one, with its interconnection study, typically takes two to four years.",
  "layer": "power",
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
  "def": "An oil-filled transformer, each about the weight of a loaded freight car, that steps the 345 kV transmission line down to the campus's 34.5 kV distribution voltage. Units this size run 99.5-99.7% efficient, and lead times ran 120-144 weeks in 2026.",
  "layer": "power",
  "sources": [
   "pa-transformer-345kv",
   "transformer-lead-times"
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
  "def": "A unit that turns incoming AC into DC and back to clean AC, with batteries on the DC link, so the racks never see a flicker between a grid failure and the generators taking load. Eaton's 9395XR, cited on this page, reaches up to 97.5% efficiency online.",
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
  "def": "Grid-side batteries, sized on this page at roughly a fifth of the campus's meter MW and twice that in MWh, that absorb the megawatt swings a synchronized fleet of GPUs can put on the grid in under a second. xAI's Colossus uses Tesla Megapacks rated up to about 150 MW for this.",
  "layer": "power",
  "sources": [
   "nvidia-bess-blog",
   "dcd-xai-colossus-memphis"
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
   "cummins-dqkan-genset"
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
  "def": "Power electronics switching at high frequency that replace the 60 Hz transformer, the UPS, and the rack rectifiers with a single conversion from 34.5 kV AC straight to 800 V DC. Navitas claims better than 98% efficiency for this step, a vendor figure this page treats as an estimate, since the racks it targets are not yet shipping.",
  "layer": "power",
  "sources": [
   "navitas-800vdc",
   "nvidia-800v-hvdc"
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
   "liteon-gb200-power-system"
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
  "def": "The ratio of power drawn at the campus meter to the power that actually reaches IT equipment; the gap is cooling, conversion losses, and building overhead. This page's cooling choices land around 1.5 for air, 1.10-1.20 for chilled liquid, and 1.05-1.15 for warm water.",
  "layer": "power",
  "sources": [
   "google-pue"
  ],
  "link": {
   "scene": 1,
   "mode": "power",
   "part": "towers"
  }
 },
 {
  "term": "NVLink",
  "def": "NVIDIA's copper scale-up link that ties GPUs into one shared-memory domain. The current generation, NVLink 5, moves 1.8 TB/s per GPU across all 72 GPUs of an NVL72 rack, fast enough that the rack behaves like one giant GPU.",
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
  "term": "NVSwitch",
  "def": "The switch chip that connects every GPU's NVLink links so any GPU can read another's memory at full speed. An NVL72 rack holds 18 of them, two per switch tray across nine trays; a DGX H100 server puts four on its own baseboard instead.",
  "layer": "data",
  "sources": [
   "nvidia-nvl72-reference-arch",
   "nvidia-h100-datasheet"
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
   "nvidia-connectx8-datasheet"
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
  "def": "The signal-processing chip inside a fully-retimed pluggable module that regenerates the electrical signal before it drives the laser. Removing it, as linear optics do, or moving it onto the switch package, as co-packaged optics do, is how the industry has been cutting optical module power.",
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
  "def": "A pluggable module with no DSP, driving its laser straight off the host chip's own electrical signal instead of regenerating it first. This page notes it runs at roughly half the power of a fully-retimed module, at some cost to reach and design margin.",
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
  "def": "Optical engines built onto a switch chip's own package instead of living in separate pluggable modules at the faceplate. NVIDIA's Quantum-X and Spectrum-X Photonics claim 3.5x power efficiency and four times fewer lasers; Broadcom's Davisson reaches 102.4 Tb/s at 3.5 W per 800G port.",
  "layer": "data",
  "sources": [
   "nvidia-spectrum-x-cpo",
   "broadcom-davisson-cpo"
  ],
  "link": {
   "scene": 2,
   "mode": "data",
   "part": "cpo"
  }
 },
 {
  "term": "External laser source",
  "def": "In a co-packaged optics design, one laser shared across several data links rather than a laser built into every pluggable module. NVIDIA's Quantum-X Photonics shares a single external laser across eight links, which is most of where its \"fewer lasers\" claim comes from.",
  "layer": "data",
  "sources": [
   "nvidia-spectrum-x-cpo"
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
  "link": {
   "scene": 1,
   "mode": "data",
   "part": "dci"
  }
 },
 {
  "term": "Coherent optics",
  "def": "Optical transmission that encodes data in a light wave's amplitude and phase, not just on and off, so one wavelength can carry many bits per symbol. It is what makes DWDM long-haul links possible, and what a 400ZR or 800ZR module implements.",
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
  "term": "400ZR / 800ZR",
  "def": "Standardized coherent pluggable formats for metro and data-center-interconnect links, running 400 Gb/s or 800 Gb/s per wavelength. 400ZR reaches 80-120 km amplified at about 15-20 W per module; 800ZR draws about 23-25 W.",
  "layer": "data",
  "sources": [
   "ciena-wavelogic6"
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
  "def": "Stacked DRAM built beside the GPU die on the same interposer, feeding it at several terabytes per second over millimeters of wiring. It runs 8-15% of a GPU's power on this page, and moving weights out of it for every token is a large share of inference energy.",
  "layer": "compute",
  "sources": [
   "micron-hbm3e-brief"
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
  "link": {
   "scene": 2,
   "mode": "data",
   "part": "dp"
  }
 },
 {
  "term": "Expert parallel",
  "def": "Spreading a mixture-of-experts model's experts across GPUs so each token only visits the few experts it's routed to. DeepSeek-V3 runs expert parallel 64 with no tensor parallel at all; NVL72's wide NVLink domain lets experts spread across all 72 GPUs of a rack.",
  "layer": "compute",
  "sources": [
   "deepseek-v3-technical-report",
   "nvidia-gb200-dynamo-moe"
  ],
  "link": {
   "scene": 3,
   "mode": "data",
   "part": "tp"
  }
 },
 {
  "term": "Prefill",
  "def": "The first phase of answering a prompt: every token of the question passes through the model at once, reading its weights from HBM. A long prompt can take a few hundred milliseconds here, the wait before the first reply word appears.",
  "layer": "compute",
  "link": {
   "scene": 5,
   "mode": "data",
   "part": "hbm"
  }
 },
 {
  "term": "Decode",
  "def": "The second phase of answering a prompt: each new reply token is written one at a time, re-reading the model's weights for every single token. Because it re-reads memory constantly rather than computing in bulk, decode speed tracks HBM bandwidth more than raw GPU math.",
  "layer": "compute",
  "link": {
   "scene": 5,
   "mode": "data",
   "part": "tokens"
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
  "def": "A cabinet at the end of a row that keeps a rack's own filtered coolant loop separate from the building's facility water, passing heat between the two through a plate heat exchanger without mixing them. Units on this page range 70 kW to 2.5 MW of capacity.",
  "layer": "heat",
  "sources": [
   "vertiv-coolchip-cdu",
   "motivair-cdu-brochure"
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
  "def": "Liters of water used on site per kilowatt-hour of IT power. This page's designs span about 0.16 L/kWh for warm-water dry coolers up to about 1.0 L/kWh for an air-cooled chiller-and-tower plant.",
  "layer": "heat",
  "sources": [
   "introl-wue"
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
   "eia-co2-per-kwh"
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
  "def": "The EPA database this page cites for the US national average grid carbon figure, 373 g CO2/kWh on 2022 data, alongside EIA's separate state-by-state electricity profiles for 2024.",
  "layer": "general",
  "sources": [
   "eia-co2-per-kwh"
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
  "term": "Basis (Spec / Typical / Est.)",
  "aka": [
   "Spec",
   "Typical",
   "Est."
  ],
  "def": "The label this page puts on every number it shows. \"Spec\" means a vendor or standards body states it; \"Typical\" means an industry-wide figure several sources agree on; \"Est.\" means the page derived it or only one uncertain source exists, and it's shown that way rather than dressed up as settled.",
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
   "naddod-gb200-interconnect"
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
  "link": {
   "scene": 0,
   "mode": "power",
   "part": "site-abilene"
  }
 },
 {
  "term": "xAI Colossus 1",
  "aka": [
   "Colossus"
  ],
  "def": "xAI's first Memphis campus: fully built and operating. About 200,000 GPUs (H100, H200, some GB200), leased in full to Anthropic since 05/06/2026; confirmed grid supply is 150 MW from MLGW/TVA, backed by 35 on-site gas turbines rated 420 MW.",
  "layer": "general",
  "sources": [
   "compute-atlas-colossus",
   "wikipedia-colossus",
   "tomshardware-colossus",
   "dcd-xai-colossus-memphis"
  ],
  "link": {
   "scene": 0,
   "mode": "power",
   "part": "site-colossus1"
  }
 },
 {
  "term": "xAI Colossus 2",
  "def": "xAI's second Memphis campus, about 3 km from Colossus 1: live and still growing, already past its original plan of 1 GW and 350,000 GPUs. By satellite estimate it ran about 946 MW of IT power and 440,000 Nvidia chips as of 09/24/2026; xAI itself reported about 550,000 chips installed by 09/25/2026. By Epoch AI's tracking, it is the most powerful AI data center operating today, by both IT power and compute; Amazon and Anthropic's New Carlisle campus is next, at about 910 MW with more chips but less compute.",
  "layer": "general",
  "sources": [
   "epoch-dc-colossus2",
   "epoch-largest-dc",
   "semianalysis-xai-colossus2",
   "wikipedia-colossus"
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
  "link": {
   "scene": 0,
   "mode": "power",
   "part": "site-fairwater-wi"
  }
 },
 {
  "term": "Meta Hyperion",
  "def": "Meta's Richland Parish, Louisiana campus: still under construction, with nothing live yet in the latest satellite imagery (04/2026). Phase 1, 1.5 GW, is due in late 2027; the full build, 5 GW and more than 1.3 million GPUs, is planned by 2030-2032.",
  "layer": "general",
  "sources": [
   "epoch-dc-hyperion",
   "meta-richland-parish",
   "cnbc-meta-louisiana",
   "led-meta-louisiana"
  ],
  "link": {
   "scene": 0,
   "mode": "power",
   "part": "site-hyperion"
  }
 }
];
