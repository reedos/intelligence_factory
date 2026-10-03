// Content model for The Intelligence Factory.
// Every figure carries a basis and its evidence (src/evidence.js): a published spec, a vendor claim or a published
// report cites its sources, a calculation names how the model makes it, an assumption says why.
// The page shows the basis beside the figure; the chip opens its evidence.
import { BASIS } from './evidence.js';
import { moduleTier } from './scenes/lid-labels.js';
import { tokenMathRows } from './model/token-math.js';
export { BASIS };

// Voltage classes: one color per class, used by every flow, chip and chart.
export const VOLT = {
  hv: { css: '#b69cff', name: '345 kV AC', short: '345 kV' },
  mv: { css: '#ffb14e', name: '34.5 kV AC', short: '34.5 kV' },
  lv: { css: '#ff7f50', name: '480 / 415 V AC', short: '415 V' },
  hvdc: { css: '#e8ff5a', name: '800 V DC', short: '800 V' },
  dc: { css: '#47cfff', name: '≈50 V DC', short: '50 V' },
  bus12: { css: '#5ce1c6', name: '12 V DC', short: '12 V' },
  core: { css: '#e9fbff', name: '≈0.8 V DC', short: '0.8 V' },
  cool: { css: '#3f8cff', name: 'Supply water' },
  warm: { css: '#ff5a6e', name: 'Return water' },
  // data classes
  nvl: { css: '#ff5fd2', name: 'NVLink, copper', short: 'NVLink' },
  c2c: { css: '#ffa3e4', name: 'NVLink-C2C', short: 'C2C' },
  pcie: { css: '#ffb870', name: 'PCIe', short: 'PCIe' },
  serdes: { css: '#76d6ba', name: 'Electrical SerDes', short: 'SerDes' },
  eth: { css: '#a6f35a', name: 'Scale-out, optical', short: '800G' },
  dci: { css: '#ffd35c', name: 'DWDM fiber', short: 'DWDM' },
  hbi: { css: '#7fe3ff', name: 'Die to die', short: 'NV-HBI' },
  hbm: { css: '#b08cff', name: 'HBM', short: 'HBM' },
  tx: { css: '#62e6ff', name: 'Light out, transmit', short: 'TX' },
  rx: { css: '#ff7ad9', name: 'Light in, receive', short: 'RX' },
  cw: { css: '#ffb347', name: 'Laser light, no data', short: 'laser' },
  v33: { css: '#8fd3ff', name: '3.3 V DC', short: '3.3 V' },
  mod16: { css: '#a6f35a', name: '1.6T module, 8 lanes each way', short: '1.6T' },
  mod8: { css: '#a6f35a', name: '800G module, 8 lanes each way', short: '800G' },
  cpo288: { css: '#a6f35a', name: '18 ring-modulator engines · 28.8T', short: '28.8T' },
  zr800: { css: '#ffd35c', name: '800ZR, one wavelength', short: '800G' },
  cu: { css: '#ff5fd2', name: 'Copper pairs', short: 'copper' },
  // heat classes
  hot: { css: '#ffc34a', name: 'Heat from silicon', short: 'heat' },
  air: { css: '#ff8a4a', name: 'Hot air', short: 'air' },
  vapor: { css: '#d6e6ff', name: 'Evaporation', short: 'vapor' },
};

import { SITES, PLACES, placeKey, STATE_CARBON, STATE_EIA_SOURCE, DEFAULT_PLACE, US_CARBON_G, STATUS_WORD } from './model/sites.ts';
import { waterM3h, WATER } from './model/engine.ts';
// a real campus's status as spec rows: its state and live figure, and a ranking where one is claimed. Both are
// reported by the tracker named in s.status.source (Epoch AI's Frontier Data Centers directory for every site but
// Colossus 1, which follows Compute Atlas instead; see src/model/sites.ts).
const statusRows = s => { const loc = s.status.source === 'compute-atlas-colossus'
  ? 'facility profile: operating-status line and grid-power figure'
  : 'directory entry: "CURRENT IT POWER" figure';
  return [
    [`Status, ${s.status.asOf}`, `${STATUS_WORD[s.status.state]} · ${s.status.live}`, 'reported', { refs: [[s.status.source, loc]] }],
    ...(s.status.rank ? [['Ranking, Epoch AI', 'Most powerful operating today', 'reported',
      { refs: [['epoch-largest-dc', 'ranking page lead text: "Colossus 2 is the largest tracked AI data center at about 946 MW of current IT power"']] }]] : []),
  ];
};

// Facts the text needs per accelerator that the engine does not use for arithmetic.
export const FACTS = {
  h100: {
    gpu: 'H100', gpus: 'H100 GPUs', arch: 'Hopper', transistors: '80 billion', tBasis: 'spec', process: 'TSMC 4N', pBasis: 'spec',
    dieCm2: 8.14, packaging: 'TSMC CoWoS-S', cpu: 'Xeon', cpuLong: 'Intel Xeon Platinum 8480C', cpuCores: '56 cores each', cpuMem: '2 TB DDR5 per server',
    nic: 'ConnectX-7', nicNote: '400 Gb/s per GPU', mBasis: 'spec',
  },
  gb200: {
    gpu: 'Blackwell', gpus: 'Blackwell GPUs', arch: 'Blackwell', transistors: '208 billion', tBasis: 'spec', process: 'TSMC 4NP', pBasis: 'spec',
    dieCm2: 16, packaging: 'TSMC CoWoS-L', cpu: 'Grace', cpuCores: '72 Arm Neoverse V2 cores', c2c: '900 GB/s', cpuMem: '480 GB LPDDR5X per CPU (17 TB per rack)',
    nic: 'ConnectX-7 SuperNIC', nicNote: '400 Gb/s per GPU, NVIDIA’s reference design; ConnectX-8 upgrades to 800 Gb/s', mBasis: 'spec',
  },
  gb300: {
    gpu: 'Blackwell Ultra', gpus: 'Blackwell Ultra GPUs', arch: 'Blackwell Ultra', transistors: '208 billion', tBasis: 'typical', process: 'TSMC 4NP', pBasis: 'spec',
    dieCm2: 16, packaging: 'TSMC CoWoS-L', cpu: 'Grace', cpuCores: '72 Arm Neoverse V2 cores', c2c: '900 GB/s', cpuMem: '480 GB LPDDR5X per CPU',
    nic: 'ConnectX-8 SuperNIC', nicNote: '800 Gb/s per GPU', mBasis: 'spec',
  },
  rubin: {
    gpu: 'Rubin', gpus: 'Rubin GPUs', arch: 'Rubin', transistors: '≈336 billion, as announced', tBasis: 'est', process: 'TSMC 3 nm class', pBasis: 'est',
    dieCm2: 16, packaging: 'TSMC CoWoS-L', cpu: 'Vera', cpuCores: '88 custom Arm cores', c2c: '1.8 TB/s', cpuMem: 'up to 1.5 TB LPDDR5X per CPU',
    nic: 'ConnectX-9 SuperNIC', nicNote: '1.6 Tb/s aggregate per GPU', mBasis: 'est',
  },
};

// Everything below depends on the scenario, so it is built from the model on every change.
export const WALK = {
  // west yard once (the batteries sit by the substation), then the one trip east to the generators, then the halls
  power: { campus: ['line', 'substation', 'mpt', 'ehouse', 'bess', 'gensets', 'fuel', 'unitsubs', 'hall', 'drycoolers', 'chillers', 'towers', 'fiber', 'security', 'ops'] },
  // outside in, the way a byte arrives; the H100 rack shows its optics before the ports they plug into, like the NVL72
  data: { across: ['remote', 'route', 'ila', 'dci', 'home'], rack: ['tp', 'servers', 'nvswitch', 'spine', 'optical', 'uplinks', 'compute', 'mgmt'] },
  // the hot aisle before the units that pull air out of it
  heat: { hall: ['cdu', 'hotaisle', 'inrow', 'fanwall', 'fwater', 'cpo', 'fire', 'riser'] },
};

// average heat flux through the compute dies, W/cm²: the dies' power (the package less its HBM share) over their area
export const dieFlux = A => Math.round(A.gpuW * (1 - A.hbmShare) / FACTS[A.id].dieCm2 / 5) * 5;

export function content(M) {
  const { accel: A, power: P, cooling: CL, NET, racks: RACKS, gpus: GPUS, IT_MW, layout: L, rack: RK } = M;
  const X = FACTS[A.id];
  // the aqua multimode links and 1:2 splitters at one leaf (scenes/hall-breakout.js) are drawn in 400G NVL72 halls only
  const mmDrawn = A.nicPortGbps === 400 && A.gpusPerRack === 72;
  // the switch-side twin-port module the module side level opens: 800G (MMS4X00) for H100 / GB200, 1.6T (MMS4A00) for
  // GB300, a 1.6T-class module of unpublished type for Vera Rubin (scenes/lid-labels.js moduleTier)
  const MT = moduleTier(A), MT8 = MT.key === '800g';
  const mtName = `${MT.label}${MT.part ? ` (NVIDIA ${MT.part})` : ', its exact type unpublished'}`;
  const nvl = A.gpusPerRack === 72, dc = P.id === 'dc800', air = CL.id === 'air', warm = CL.id === 'warm';
  // a real campus's published plant (sites.ts): battery backup instead of diesel, a closed loop instead of towers
  const bat = M.backup === 'battery', closed = M.closedLoop, bessH = L.bessMW ? L.bessMWh / L.bessMW : 0;
  // the operator's own statement of its closed loop, cited wherever the page says the campus evaporates no water
  const siteCool = closed ? SITES[M.scenario.site].facts.find(r => r[0].startsWith('Cooling')) : null;
  const n0 = v => Math.round(v).toLocaleString('en-US');
  const kfmt = v => v >= 1e6 ? `${(v / 1e6).toFixed(1)} million` : v >= 1e4 ? `${n0(v / 1000)}k` : n0(v);
  const mwTxt = v => v >= 1000 ? `${+(v / 1000).toFixed(2)} GW` : v >= 10 ? `${n0(v)} MW` : `${v.toFixed(1)} MW`;
  const meter = mwTxt(M.meterMW);
  const lossOf = prefix => M.ledger.filter(r => r.label.startsWith(prefix)).reduce((a, r) => a + r.mw, 0);
  const lossTxt = prefix => { const v = lossOf(prefix); return v >= 10 ? `≈${n0(v)} MW` : `≈${v.toFixed(1)} MW`; };
  const rackKW = Math.round(RK.kw);
  // a real campus's own mix (sites.ts fleet): every total counts each accelerator at its own figures
  const FL = M.fleet, mixed = M.mixed;
  const tPerGpu = a => parseFloat(FACTS[a.id].transistors.replace('≈', '')) * 1e9;
  const liq = air ? 0 : A.liquidShare, liqKW = Math.round(RK.kw * liq), airKW = rackKW - liqKW;
  const halls = M.halls, multiHall = halls > 1;
  const hbmTB = `${A.hbm.tbs} TB/s`;
  const nvlTB = A.nvlink.tbs >= 1 ? `${A.nvlink.tbs} TB/s` : `${A.nvlink.tbs * 1000} GB/s`;
  const nicTxt = A.nicGbps >= 1000 ? `${A.nicGbps / 1000} Tb/s` : `${A.nicGbps} Gb/s`;
  const nicShort = A.nicGbps >= 1000 ? `${A.nicGbps / 1000}T` : `${A.nicGbps}G`;
  const coreA = Math.round(A.gpuW * (1 - A.hbmShare) / 0.8 / 100) * 100;
  const flux = dieFlux(A), TT = M.temps;
  const trayKW = nvl ? (RK.dcBusKW - A.scaleupKW - A.busbarKW) / 18 : RK.kw / 4;
  const hbmSpec = `${A.hbm.gb} GB ${A.hbm.type}`;
  const stacksTxt = A.id === 'h100' ? '5 active stacks on 6 sites' : `${A.hbm.stacks} stacks`;
  const at = (scene, part, mode = 'power') => ({ scene, mode, part });   // where a figure lives in 3D
  const LEDGER_END = { label: 'GPU silicon', sub: 'tensor math, caches, links, leakage', scene: 5, link: at(5, 'dies') };
  VOLT.eth.short = nicShort;   // the scale-out label follows the NIC speed
  const count = v => v <= 10 ? ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'][v] : n0(v);
  // the campus scene adds plain hall blocks east of the site; its width grows with them (see scenes/campus.js)
  const extraHalls = Math.max(0, halls - 2), blockCols = extraHalls ? Math.ceil(extraHalls / Math.min(12, Math.max(2, Math.ceil(Math.sqrt(extraHalls / 1.2))))) : 0;
  const campusKm = extraHalls ? 1.23 + blockCols * 0.32 : 1.6;

  // ---------- scenes, largest to smallest. unit = meters per world unit, for the scale bar ----------
  const SCENES = [
    {
      id: 'across', n: 1, title: 'Scale across', scale: '2,000 km across', unit: 1000, volt: 'hv', dataVolt: 'dci', heatVolt: 'air', heatShort: 'climate',
      heatIntro: 'Heat stays local, so climate and water pick sites as much as power does. Cool, dry places reject heat to air most of the year without spending water.',
      intro: 'Start at the grid. Power plants feed 345–500 kV lines into campuses hundreds of kilometers apart, and each campus is its own grid customer, which is why gigawatt clusters get split across sites. Go into the lit campus to follow its power in.',
      dataIntro: 'Campuses hundreds of kilometers apart can train one model. Coherent optics light dozens of wavelengths per fiber, amplified every 80 km or so, but light still takes about 5 ms to cross 1,000 km.',
    },
    {
      id: 'campus', n: 2, title: 'Grid & campus', scale: `${extraHalls ? '≈' : ''}${campusKm.toFixed(1)} km across`, unit: 1, volt: 'hv', dataVolt: 'dci', heatVolt: 'air', heatShort: `${meter} out`,
      heatIntro: warm
        ? `All ${meter} leaves as heat. Warm water climbs to rows of dry coolers on the roofs, which dump it into the air; ${closed ? 'the loop is closed, so, by the operator’s account, no water is evaporated.' : 'on the hottest afternoons evaporative towers help, and cost water.'}`
        : air
          ? `All ${meter} leaves as heat. Chillers make cold water for the cooling units in the halls, and cooling towers throw the chillers' heat away by evaporating water: the most water-hungry way to cool.`
          : closed
            ? `All ${meter} leaves as heat. Air-cooled chillers make cold water for the coolant units beside the racks and push the heat into outside air. The loop is closed, so, by the operator's account, no water is evaporated.`
            : `All ${meter} leaves as heat. Chillers make cold water for the coolant units beside the racks, and cooling towers throw the chillers' heat away by evaporating water.`,
      dataIntro: multiHall
        ? `Two diverse fiber routes enter the site. Coherent optics in a line-terminal hut turn them into the campus’s link to other campuses, while thousands of strands in duct banks tie ${halls === 2 ? 'the two halls' : `all ${halls} halls`} into one fabric.`
        : 'Two diverse fiber routes enter the site. Coherent optics in a line-terminal hut turn them into the campus’s link to other campuses. With one hall, the whole fabric lives under one roof.',
      intro: `A 345 kV line lands at the campus substation. ${count(L.transformers)} transformers step it down to 34.5 kV, which runs underground to transformers along ${multiHall ? `each of ${halls} data halls` : 'the data hall'}. The grid itself lost about 5% getting here. ${bat ? 'Batteries stand by for when the grid drops; the operator names no diesel generators.' : 'Diesel generators and batteries stand by for when the grid drops.'}${halls > 2 ? ` The two halls in front are drawn in detail; the other ${halls - 2} are the plain blocks beyond.` : ''}`,
    },
    {
      id: 'hall', n: 3, title: 'Power room & data hall', scale: '70 m across', unit: 1, volt: dc ? 'hvdc' : 'lv', dataVolt: 'eth', heatVolt: air ? 'air' : 'warm', heatShort: air ? 'all air' : 'water + air',
      heatIntro: air
        ? 'Every rack breathes cold air in the front and blows hot air out the back into a sealed aisle. Cooling units in the rows pull that air through chilled-water coils and send it back cold.'
        : liq >= 0.99
          ? 'Every rack here is cooled by water: its heat goes through a coolant unit in its row to the facility loop overhead, and no hot aisle is drawn.'
          : 'Two heat paths leave every rack. Most goes into water, through a coolant unit in its row to the facility loop overhead. The rest is hot air, trapped in the aisle between rack backs and pulled through the fan wall.',
      dataIntro: `Scale-out lives here. Every GPU has dedicated scale-out optical connections. Fibers run up from each rack into yellow runways, to leaf switches at the row ends and on to the spine, so any GPU can reach any other in a few microseconds.`,
      intro: (dc
        ? 'Solid-state transformers take 34.5 kV and make 800 V DC in one step, with batteries on the DC bus instead of a UPS. DC busway carries 800 V over the rows into every rack.'
        : 'Outside the wall a unit substation drops 34.5 kV to 480 V. Inside, switchgear and UPS modules feed overhead busway at 415 V that drops into every rack.')
        + (air ? ' Chilled water runs overhead to cooling units in every row.' : ' Facility water runs overhead to coolant units in each row, one per eight racks.'),
    },
    nvl ? {
      id: 'rack', n: 4, title: 'The rack', scale: '2.3 m tall', unit: 1, volt: 'dc', dataVolt: 'nvl', heatVolt: 'warm', heatShort: `≈${Math.round(liq * 100)}% water`,
      heatIntro: liq >= 0.99
        ? `All of a ${rackKW} kW rack's heat is reported to leave in water: even the switch trays and power shelves sit on cold plates.`
        : `About ${liqKW} of a rack’s ${rackKW} kW leaves in the water manifolds down the back. The rest, from power shelves, switches, optics and drives, leaves as hot air out the rear door.`,
      dataIntro: `Scale-up lives here. Copper ${A.nvlink.gen} ties all 72 GPUs to the nine switch trays in the middle. Separate scale-out and storage networks leave through the compute trays' front optical ports; management has its own connections.`,
      intro: dc
        ? `A ${A.rackName} rack fed at 800 V DC: DC-DC shelves drop it to about 50 V, and a copper busbar down the back feeds 18 compute trays and 9 NVLink switch trays, all cooled by water. The rack draws about ${rackKW} kW.`
        : `A ${A.rackName} rack takes 415 V AC in at the top and turns it into about 50 V DC in its power shelves. A copper busbar down the back feeds 18 compute trays and 9 NVLink switch trays, all cooled by water. It draws about ${rackKW} kW.`,
    } : {
      id: 'rack', n: 4, title: 'The rack', scale: '2.3 m tall', unit: 1, volt: 'lv', dataVolt: 'nvl', heatVolt: 'air', heatShort: 'all air',
      heatIntro: `All ${rackKW} kW leaves as air. Fans pull cold air in the front of each server and push it out the back, about ${n0(Math.round(rackKW / (1.2 * 1.005 * 15) * 2119 / 100) * 100)} cubic feet a minute for the rack at a 15 °C rise.`,
      dataIntro: 'Scale-up stops at the server. Each DGX H100 has its own 8-GPU NVLink domain on its baseboard; everything between servers, even in the same rack, goes out as fiber.',
      intro: `A rack of four DGX H100 servers, ${rackKW} kW in all, the density NVIDIA's reference design allows for air cooling. Power strips at the back take 415 V from the busway and feed each server's own AC power supplies.`,
    },
    nvl ? {
      id: 'tray', n: 5, title: `${A.id === 'rubin' ? 'Vera Rubin' : A.short} compute tray`, scale: '44 cm wide, schematic', unit: 0.1, volt: 'bus12', dataVolt: 'eth', heatVolt: 'cool', heatShort: 'cold plates',
      heatIntro: liq >= 0.99
        ? 'NVIDIA’s Vera Rubin reference tray is fanless and hose-free. An integrated liquid manifold and quick disconnects serve the modular bays. The cold plates are lifted here to reveal the chips; routes across those display gaps are schematic.'
        : 'Coolant enters at the back, runs through a copper plate on each CPU and GPU, and leaves warmer. Fans at the front still push air over the parts water does not touch: NICs, optics, drives.',
      dataIntro: A.id === 'rubin' ? 'Four Rubin GPUs connect to the rear copper NVLink spine and to two Vera CPUs over NVLink-C2C. The CPUs connect through the PCIe Gen6 midplane to eight ConnectX-9 NICs; electrical SerDes then reaches the front optical cages. Light begins in a seated transceiver. Mechanical placement is representative.' : `This ${A.short} tray contains four ${X.gpus} and two ${X.cpu} CPUs. Each GPU has three ways out: NVLink to the rack spine at the back, NVLink-C2C to its CPU, and ${X.nic} networking to the optical modules. Mechanical placement is representative.`,
      intro: 'Each tray clips onto the busbar at about 50 V. Bus converters drop that to 12 V, and rings of voltage regulators around each GPU make the final step to under a volt, right beside the chip.',
    } : {
      id: 'tray', n: 5, title: 'DGX H100 server', scale: '48 cm wide', unit: 0.1, volt: 'bus12', dataVolt: 'eth', heatVolt: 'air', heatShort: 'heat sinks',
      heatIntro: 'Twelve front fan modules pull air through both trays: across tall copper-and-aluminum heat sinks on the eight GPUs on top, over the CPUs, memory and network modules below, and out the back.',
      dataIntro: 'Eight GPUs share one NVLink domain through four NVSwitch chips on the baseboard. Each GPU’s PCIe runs through the midplane to its own ConnectX-7 on a network module in the motherboard tray, and DensiLink cables carry the eight ports back to four twin-port cages at the rear.',
      intro: 'This is one complete 8U DGX H100 server pulled from the rack, not an NVL72 compute tray, cut open along one side. As NVIDIA’s figures show it, the GPU tray fills the top, the motherboard tray with the CPUs, memory and network modules sits under it, and six power supplies run across the bottom of the rear; both trays plug into a midplane behind the twelve front fans. Depths, the midplane’s openings and the power copper under the motherboard tray are representative.',
    },
    {
      id: 'chip', n: 6, title: 'GPU package & tokens', scale: '10 cm across', unit: 0.01, volt: 'core', dataVolt: 'hbm', heatVolt: 'hot', heatShort: 'die, hottest',
      heatIntro: `Every watt that arrives turns into heat inside ${A.dies > 1 ? 'two dies' : 'one die'} smaller than a postcard. It climbs through a thin thermal interface ${A.id === 'h100' ? '' : 'and a heat spreader '}into ${nvl ? 'the cold plate' : 'the heat sink'}; the hard part is getting it out of the silicon fast enough.`,
      dataIntro: A.dies > 1
        ? `The fastest links are the shortest. HBM feeds the dies at ${hbmTB} over millimeters, the two dies talk at 10 TB/s across their seam, and ${A.nvlink.gen} leaves the package edge at ${nvlTB}.`
        : `The fastest links are the shortest. HBM feeds the die at ${hbmTB} over millimeters, and 18 ${A.nvlink.gen} links leave the package edge at ${nvlTB}.`,
      intro: `The last millimeter: over a thousand amps climb through solder balls and the substrate into ${A.dies > 1 ? 'two silicon dies' : 'one silicon die'} and ${A.id === 'h100' ? 'five working HBM stacks' : `${A.hbm.stacks} HBM stacks`}. What leaves is heat, and tokens.`,
    },
    // the side levels inside the links, each its own diagram, each entered from the part that holds it (not part of the
    // line of six): a module from a tray's cages or the hall's pluggables, the CPO package from the hall's CPO switch,
    // the coherent module from the line terminals, the copper cables from an NVL72 rack's NVLink spine
    {
      id: 'module', n: '+', side: true, title: 'Inside the module', tab: 'Pluggable optics', kicker: `${MT.published ? `${MT.rate} 2×DR4` : MT.rate} · in the hall`, door: 'pluggable optics', scale: '10.8 cm long', unit: 0.01, volt: 'v33', dataVolt: MT8 ? 'mod8' : 'mod16', heatVolt: 'hot', heatShort: 'fins',
      intro: `A ${MT.rate} twin-port optical module, opened up: its footprint drawn to its published size, its layers pulled apart vertically, its parts representative. This scenario’s switch module: ${mtName}, the module in the leaf and spine switches’ cages. It carries two ${MT.port} links: one shared eight-lane DSP serves a representative photonics chip, with eight ${MT.lane} transmit channels grouped on one side and eight receive channels on the other. Four channels in each direction feed each optical port. The internal placement and separate analog chips are representative, not a documented teardown.${A.id === 'h100' ? ' The DGX H100 servers take the flat-top version of this module; the switches take this finned one.' : A.id === 'gb200' ? ' The compute trays’ own NIC ports take a different module, a single-port OSFP 400G DR4; this level opens the switch end of the link.' : A.id === 'gb300' ? ' The compute trays’ own NIC ports take a different module, a single-port OSFP 800G DR4; this level opens the switch end of the link.' : ' This scenario models two 800G links per GPU; the network and transceiver selection are illustrative, and the drawing is the 1.6T twin-port.'} Everything that turns the host’s electrical lanes into light, and back, is inside. The toggle also shows a half-retimed (LRO) version, with the DSP on transmit only, and the LPO version, with no DSP.`,
      dataIntro: `This scenario’s switch module, ${MT.label}: one eight-channel transmit bank and one eight-channel receive bank at ${MT.lane} per lane, serving two ${MT.port} optical ports. Internal placement and chip partitioning are representative. Out: the host’s lanes, the shared eight-lane DSP, a driver, electrical connections to the modulators, which put each lane onto the lasers’ light, then glass fiber to the connector. In: fiber from the connector to a photodiode, electrical connections to the TIA, the DSP, and back to the host.`,
      heatIntro: 'The DSP is the major heat source. Its heat crosses a gap pad into the shell and leaves through the fins, in the air the switch or server blows past its cages. The driver, TIA and lasers make less; heat is drawn on a log scale, so each 10× in power is 5× the motion.',
    },
    {
      id: 'cpo', n: '+', side: true, title: 'Inside the CPO package', tab: 'Co-packaged optics', scale: 'package, representative', unit: 0.01, volt: 'core', dataVolt: 'cpo288', heatVolt: 'hot', heatShort: 'one cold plate',
      intro: 'A switch package with its optics built around the switch chip: 18 micro-ring modulator engines in six groups of three. It follows the approach in NVIDIA’s published Quantum-X and Spectrum-X Photonics switches. The counts are NVIDIA’s; the package’s size and layout are drawn to show its parts. One engine is lifted out beside it as a detail. The toggle redraws the package with Mach-Zehnder modulators instead.',
      dataIntro: 'Electrical lanes leave the switch chip’s SerDes through short copper traces in the package to each engine. In the engine, the electronic chip’s drivers swing ring modulators on the photonic chip below; photodiodes there read incoming light for its TIAs. Laser light arrives separately, by fiber, from modules at the front panel. It follows the approach in NVIDIA’s published Quantum-X and Spectrum-X Photonics switches.',
      heatIntro: 'The switch chip and every engine sit in one package, cooled with liquid; the single cold plate drawn over it is representative. Its two short pipes mark supply and return connections to the switch’s cooling loop outside this package view.',
    },
    {
      id: 'coherent', n: '+', side: true, title: 'Coherent optics', tab: 'Coherent optics', kicker: '800ZR · data center interconnect', door: 'coherent optics', scale: '10.8 cm long', unit: 0.01, volt: 'v33', dataVolt: 'zr800', heatVolt: 'hot', heatShort: 'fins',
      intro: 'An 800ZR coherent pluggable carries 800G between campuses on one wavelength. This representative design uses discrete board-mounted driver and TIA packages, separate from the transmit and receive optical assemblies. Parts sit in the order the OIF packaging agreements imply: the DSP, then the driver and TIA beside it, then the optics with their fibers facing the front, and the laser toward the fiber end, off the electrical path. Only the OSFP envelope and the cited nano-ITLA case are to scale; the other parts and their exact placement are illustrative.',
      dataIntro: 'Follow the separately packaged electronics and optical assemblies: DSP → driver IC → IQ modulator on transmit; receiver photodiodes → TIA IC → DSP on receive. The driver and TIA carry electrical signals, not light. One laser feeds the modulator and the receiver’s local oscillator. This discrete package arrangement is a design assumption, not a teardown of a specific product.',
      heatIntro: 'The DSP, laser, driver IC and TIA IC are distinct heat sources, the DSP by far the largest. The modulator and receiver optics lose a little too, well under half a watt: too little to draw. Heat is drawn on a log scale, so each 10× in power is 5× the motion.',
    },
    {
      id: 'copper', n: '+', side: true, title: 'Inside the copper cables', tab: 'Copper cables', kicker: 'DAC / ACC / AEC', scale: 'one plug end', unit: 0.01, volt: 'v33', dataVolt: 'cu', heatVolt: 'hot', heatShort: 'little',
      intro: 'Three copper cables, one end of each, opened up: a passive copper cable (DAC) with nothing in the signal path, an active copper cable with one redriver, and an active electrical cable with a retimer in each end. No light anywhere; copper the whole way.',
      dataIntro: 'Transmit pairs on the left of each card, receive pairs on the right. In a passive copper cable they run straight from the fingers into the twinax. An ACC passes the receive pairs through one analog redriver; an AEC passes both directions through a DSP retimer.',
      heatIntro: 'A passive copper cable makes very little heat: a little in its ID memory, and some loss in the copper itself. The chips in active cables draw power from the port, and it ends up as heat in the plug.',
    },
  ];

  // ---------- power-mode parts per scene. The 3D scene supplies positions; this supplies what to say ----------
  // specs: [label, value, basis]
  for (const key of ['intro', 'dataIntro', 'heatIntro']) SCENES[1][key] += ' Buildings, landscaping and distribution routes are a conceptual design, not a surveyed layout of a named site.';
  const PARTS = {};
  const site = M.scenario.site ? SITES[M.scenario.site] : null;
  const stateC = STATE_CARBON[(site || DEFAULT_PLACE).state];
  PARTS.across = [
    { id: 'grid', title: 'Each campus, its own grid', kicker: '345–500 kV backbone',
      body: 'High-voltage lines tie every campus to power plants and the wider grid. A gigawatt campus needs a new substation and often new lines, which is why builders spread clusters across regions where power is available.',
      specs: [
        ['Interconnection', '230–500 kV', 'assumed', { assume: 'campus-interconnection-voltage-range' }],
        ['Example', 'Amazon Project Rainier: existing Olive 345 kV station, new interconnection', 'reported',
          { refs: [['measuredai-new-carlisle', 'body text: "the campus already adjoined extra-high-voltage (EHV) transmission and a very substantial existing substation — the Olive 345 kV station"']] }],
        ['Map symbols', 'substations, towers and supply lines are representative', 'assumed', { assume: 'across-map-symbols' }],
      ] },
    { id: 'plants', title: 'Generation', kicker: 'Gas, coal, nuclear, wind, solar',
      body: 'Plants inject power into the grid far from the campus; the grid delivers it with about 5% lost on the way.',
      specs: [['US grid losses', '≈5% (EIA)', 'spec', { refs: [['eia-td-losses', 'FAQ answer: "annual electricity transmission and distribution (T&D) losses averaged about 5% of the electricity transmitted and distributed in the United States in 2018 through 2022"']] }],
        ['Plant symbols', 'representative types, heights exaggerated', 'assumed', { assume: 'across-map-symbols' }]] },
    site
      ? { id: 'home', title: site.name, kicker: `${site.place} · ${meter} modeled`,
        body: `${site.owner}. This page rebuilds the campus from the closest scenario it can: ${site.unknowns.join(' ')} Go in to follow the power down.`,
        specs: [...statusRows(site), ...site.facts, ['Modeled here', `${meter} at the meter, ${A.short}, ${M.cooling.short.toLowerCase()} cooling`, 'assumed', { assume: 'scenario-meter-choice' }]], drill: 1 }
      : { id: 'home', title: 'This campus', kicker: `${meter} at the meter`,
        body: `The campus this page follows, ${meter} at the meter, placed in southwest Ohio for the map. Pick a real campus in the scenario bar to move it. Go in to the substation and follow the power down.`,
        specs: [['Meter', meter, 'assumed', { assume: 'scenario-meter-choice' }], ['IT load', `${mwTxt(IT_MW)} at PUE ${M.pue.toFixed(2)}`, 'derived', { calc: 'it-load-from-pue' }]], drill: 1 },
    { id: 'carbon', title: 'Grid carbon by state', kicker: `${stateC ? `${stateC.name}: ${stateC.g} g CO₂/kWh` : 'EIA state profiles, 2024'}`,
      body: `Shaded states have EIA figures: teal for hydro-heavy grids, amber and red for coal and gas. The same campus emits three to four times more in Wisconsin than in Washington.${site ? ` ${site.carbonNote}` : ''}`,
      specs: [
        ...(stateC ? [[`${stateC.name}, 2024`, `${stateC.lb.toLocaleString('en-US')} lb/MWh, ${stateC.g} g/kWh`, 'spec',
          { refs: [[STATE_EIA_SOURCE[(site || DEFAULT_PLACE).state], `Table 1. 2024 Summary statistics (${stateC.name}), row "Carbon Dioxide (lbs/MWh)"`]] }]] : []),
        ['US average, eGRID 2022', `${US_CARBON_G} g/kWh`, 'spec',
          { refs: [['epa-egrid2022-summary-tables', 'Table 3, State Output Emission Rates (eGRID2022), "U.S." row, CO2 lb/MWh (823.1, matching Table 1’s subregion total)']] }],
        ['Lowest shown, Washington', '113 g/kWh', 'spec', { refs: [['eia-state-washington', 'Table 1. 2024 Summary statistics (Washington), row "Carbon Dioxide (lbs/MWh)": 249']] }],
        ['Highest shown, Wisconsin', '494 g/kWh', 'spec', { refs: [['eia-state-wisconsin', 'Table 1. 2024 Summary statistics (Wisconsin), row "Carbon Dioxide (lbs/MWh)"']] }],
      ] },
    ...PLACES.filter(p => !site || !p.ids.includes(site.id)).map(p => {
      // Colossus 1 and 2 share a pin; the card leads with the one that is bigger now
      const ss = p.ids.map(id => SITES[id]), lead = ss.find(x => x.status.rank) || ss[0];
      return { id: placeKey(p), title: p.name, kicker: `${p.site.place} · ${ss.map(x => STATUS_WORD[x.status.state].toLowerCase()).join(', ')}`,
        body: `${p.site.owner}. ${ss.map(x => (ss.length > 1 ? `${x.name.replace(/^SpaceXAI /, '')}: ` : '') + x.status.line).join(' ')}${lead.status.rank ? ` ${lead.status.rank}` : ''} Choose it under Real campuses in the scenario bar to rebuild this page around it.`,
        specs: [...ss.flatMap(x => statusRows(x).map(row => [ss.length > 1 ? `${x.name.replace(/^SpaceXAI /, '')}: ${row[0].toLowerCase()}` : row[0], ...row.slice(1)])), ...p.site.facts] };
    }),
  ];
  const lineA = M.staircase[0].current;
  const evAssume = id => ({ assume: id });
  const evCalc = (id, refs) => (refs ? { calc: id, refs } : { calc: id });
  const evRefs = refs => ({ refs });
  PARTS.campus = [
    { id: 'line', title: 'Transmission line', kicker: '345 kV AC · 3 phases × 2 circuits',
      body: `Lattice towers carry two three-phase circuits of bundled aluminum conductor, with a shield wire on top to take lightning. At 345 kV the whole ${meter} campus rides on ${lineA.replace(' per phase', '')} per phase on each circuit, which is why power travels far at high voltage.${M.meterMW > 1500 ? ' A campus this big would take several circuits, or 500 kV.' : ''}`,
      specs: [
        ['Voltage', '345 kV line-to-line', 'assumed', evAssume('campus-interconnect-voltage')],
        [`Current, ${meter}`, lineA.replace('per phase', 'per phase, on each circuit'), 'derived', evCalc('line-current')],
        ['US grid losses, 2018–2022', '≈5% (EIA)', 'spec', evRefs([['eia-td-losses', 'FAQ answer: "annual electricity transmission and distribution (T&D) losses averaged about 5% of the electricity transmitted and distributed in the United States in 2018 through 2022"']])],
        ['Example', 'Stargate Abilene: double 345 kV corridor', 'reported', evRefs([['yesenergy-abilene-hyperscale', 'blog post: "The facility is fed by a double 345 kV corridor that goes from Midland to Graham, Texas."']])],
      ] },
    { id: 'substation', title: 'Campus substation', kicker: 'Utility interconnect',
      body: 'The line dead-ends on steel gantries and lands on a ring of SF₆ circuit breakers and disconnect switches. Instrument transformers measure it, surge arresters clip lightning, and tall masts shield the yard.',
      specs: [
        ['Breakers', '6 dead-tank SF₆, ring bus', 'assumed', evAssume('substation-layout')],
        ['Equipment drawn', 'typical forms, representative', 'assumed', evAssume('campus-substation-drawing')],
        ['Yard', '≈200 × 150 m gravel pad', 'assumed', evAssume('substation-layout')],
        ['Interconnection study', '1–3 years alone', 'reported', evRefs([['atk-substation-construction', 'blog: "System impact studies, facilities studies, and any required network upgrades can run twelve to thirty-six months depending on the region"']])],
      ] },
    { id: 'mpt', title: 'Main power transformers', kicker: '345 kV → 34.5 kV',
      body: `Oil-filled transformers, each the weight of a loaded freight car, step the line down to the campus distribution voltage. Radiators and fans shed their heat; concrete fire walls keep one fire from taking the others.${L.transformers > 3 ? ` Three are drawn; this campus needs ${L.transformers}.` : ''}`,
      specs: [
        ['Rating', `${L.transformers} × ${L.mvaUnit} MVA, N+1`, 'derived', evCalc('campus-transformer-count')],
        ['Efficiency, 345 kV class', '>99.6% at all loading levels', 'spec', evRefs([['pa-transformer-345kv', 'product page: "High efficiency: exceeding 99.6% at all loading levels"']])],
        [`Loss at ${meter}`, lossTxt('Main power'), 'derived', evCalc('campus-transformer-loss')],
        ['Fittings drawn', 'radiator banks, fans, bushings: a typical layout', 'assumed', evAssume('campus-mpt-drawing')],
        ['Lead time, 2026', '128–144 weeks', 'reported', evRefs([['industrialsage-transformer-leadtimes', 'quoting a Wood Mackenzie Q2 2025 survey: "standard power transformers average 128 weeks for delivery"; generator step-up units "average 144 weeks"']])],
      ] },
    { id: 'ehouse', title: '34.5 kV switchgear', kicker: 'Campus distribution',
      body: 'Prefabricated switchgear buildings split the transformer output into feeders, each breaker-protected, that run in concrete duct banks by the shortest practical route to the data halls.',
      specs: [
        ['Feeders', `≈${n0(L.feeders)}, each ≈10 MW`, 'derived', evCalc('campus-feeder-count')],
        ['Voltage', '34.5 kV (some campuses use 13.8 kV)', 'reported', evRefs([['mv-distribution-atk', 'blog: "On a large campus, 34.5 kV has become the standard distribution voltage because it carries more power with fewer and smaller feeders than 13.8 kV"']])],
        ['Loss, cables + gear', lossTxt('Campus cables'), 'derived', evCalc('campus-cable-loss')],
        ['Buildings drawn', 'a typical prefab kit, representative', 'assumed', evAssume('campus-prefab-buildings')],
      ] },
    ...(bat ? [] : [
    { id: 'gensets', title: 'Standby generator yard', kicker: 'Diesel, 480 V stepped up to 34.5 kV',
      body: 'Containerized diesel sets, such as Cummins’ QSK78 or Caterpillar’s C175-16 in the 2.5-3 MW class, start within about ten seconds of a grid failure. The UPS batteries carry the load until they take over. They run a few hours a year, mostly for testing.',
      specs: [
        ['Unit size', '2.5–3 MW class', 'spec', evRefs([['cummins-dqkan-genset', 'data sheet NAD-5919-EN: DQKAN rated 2500 kW standby'], ['cat-c175-16', 'product page: C175-16 rated 2500–3100 kW standby']])],
        ['Units here', `≈${n0(L.gensets)}, N+20%`, 'derived', evCalc('campus-genset-count')],
        ['Fuel, 2.5 MW at full load', '173 US gal/h (≈0.26 L/kWh)', 'spec', evRefs([['cummins-dqkan-genset', 'data sheet fuel-consumption table: 173.1 gal/hr at full (2500 kW) load']])],
        ['Start to load', '≈10 s', 'spec', evRefs([['cummins-nfpa110-ate', 'reprint of NFPA 110-2016 Table 4.1(b), "Types of EPSSs": Type 10 = "10 sec"'], ['nixonpower-nfpa110', 'comparison table: NFPA 110 Type 10 = 10 seconds; "data centers generally use Level 1, Type 10 systems"']])],
      ] },
    { id: 'fuel', title: 'Bulk fuel storage', kicker: '48 hours at full load',
      body: 'Horizontal steel tanks hold enough diesel to run the whole campus for two days, with polishing skids that keep stored fuel clean.',
      specs: [
        [`Volume, 48 h at ${meter}`, `≈${L.fuelML >= 10 ? n0(L.fuelML) : L.fuelML.toFixed(1)} million L`, 'derived', evCalc('campus-fuel-volume')],
        ['Tanker deliveries to refill', `≈${n0(L.fuelML * 1e6 / 30000)}`, 'derived', evCalc('fuel-tankers')],
        ['Tanks drawn', 'double-wall horizontal, representative fittings', 'assumed', evAssume('campus-fuel-tank-drawing')],
      ] },
    ]),
    bat
      ? { id: 'bess', title: 'Battery storage', kicker: 'Planned pack; no diesel mentioned',
        body: `SpaceXAI’s page lists a grid-connected battery pack for this campus that “will provide 3.3 gigawatt hours,” and mentions no diesel generators; its energy developer, Riley Trettel, told the TVA board the same figure on 08/20/2026, and TVA approved a direct grid hookup that day. At its first Memphis site, it says, more than 240 batteries let the campus come completely offline in emergencies or at peak demand. The pack’s power rating is not published; the model assumes it can carry the whole campus, about ${bessH.toFixed(0)} hours at full load, and that the same batteries soak up training load swings.`,
        specs: [
          ['Energy, per SpaceXAI (planned)', `${+(L.bessMWh / 1000).toFixed(1)} GWh`, 'spec', evRefs([['spacexai-mid-south', 'Colossus II tab, Power: "America’s largest grid-connected battery pack will provide 3.3 gigawatt hours"'], ['canarymedia-xai-battery', 'body text: on Aug. 20 SpaceXAI energy and data center developer Riley Trettel told the TVA board the battery has "3.3 GWh of storage"']])],
          ['Power, assumed', `≈${mwTxt(L.bessMW)}, the whole campus`, 'assumed', evAssume('site-battery-carries-campus')],
          ['At full load', `≈${bessH.toFixed(1)} h`, 'derived', evCalc('site-battery-hours')],
          ['Diesel generators', 'none mentioned by SpaceXAI', 'spec', evRefs([['spacexai-mid-south', 'all five tabs (Colossus I, Colossus II, Water, Power, Air), checked 09/27/2026: no diesel generators are mentioned']])],
        ] }
      : { id: 'bess', title: 'Battery energy storage', kicker: 'Smooths GPU load swings',
      body: 'Thousands of GPUs stepping in lockstep during training can swing campus load by tens of megawatts in seconds. Grid-side batteries absorb the swings the utility would otherwise see, and can sell grid services.',
      specs: [
        ['Size here', `≈${n0(L.bessMW)} MW / ${n0(L.bessMWh)} MWh`, 'derived', evCalc('campus-bess-size')],
        ['Training load swings', 'tens to hundreds of MW, seconds', 'reported', evRefs([['arxiv-power-stabilization-2508', 'Section I (Introduction): "these swings can amount to tens or hundreds of megawatts" (Microsoft, OpenAI, NVIDIA)']])],
        ['Example', 'SpaceXAI Colossus 1: ≈150 MW of Megapacks', 'reported', evRefs([['interestingengineering-xai-megapack', '"150 megawatts of Tesla Megapack batteries have been installed to serve as a stored energy backup"']])],
      ] },
    { id: 'unitsubs', title: 'Unit substations', kicker: '34.5 kV → 480 V',
      body: dc
        ? 'Pad-mounted transformers along each hall drop the feeders to 480 V for the cooling plant and building loads. The IT load skips them: solid-state transformers inside take 34.5 kV straight to 800 V DC.'
        : 'A line of pad-mounted transformers along each hall drops the feeders to 480 V right outside the electrical rooms, keeping the high-current low-voltage runs short.',
      specs: [
        ['Count', `≈${n0(dc ? Math.ceil((M.coolMW + M.miscMW) / 2.2) : L.unitSubs)} × 2.5 MVA`, 'derived', evCalc('campus-unitsub-count')],
        ['Efficiency, 2500 kVA class', '≈99.5%', 'spec', evRefs([['cfr-10-431-196', 'Table 6 to paragraph (b)(3): 2500 kVA three-phase liquid-immersed distribution transformer, 99.55% required efficiency at 50% load']])],
      ], drill: 2 },
    { id: 'hall', title: 'Data halls', kicker: `${halls} ${halls > 1 ? 'halls' : 'hall'}, ≈${kfmt(RACKS)} racks, ≈${kfmt(GPUS)} GPUs`,
      body: `The halls hold the IT load, about 45 MW each. Each floor is a slab with no raised floor: ${nvl ? 'racks are too heavy and the cooling is water, not air under the floor' : 'air comes from cooling units in the rows, not up through floor tiles'}.`,
      specs: [
        ['IT load', `${mwTxt(IT_MW)} at PUE ${M.pue.toFixed(2)}`, 'derived', evCalc('it-load-pue')],
        ['Racks', `≈${n0(RACKS)}`, 'derived', evCalc('campus-rack-count')],
        ['Halls', `${halls}`, 'derived', evCalc('campus-hall-count')],
        ['Floor load, one rack', nvl ? '≈1.4 t on 0.6 × 1.1 m' : '≈0.6 t, four 130 kg servers plus the rack',
          'reported', nvl
            ? evRefs([['sunbirddcim-gb200-nvl72', 'blog: "The GB200 NVL72 weighs 1.36 metric tons, or 3,000 pounds"; rack "600mm wide by 1,068mm deep"']])
            : evRefs([['nvidia-dgxh100-user-guide-intro', 'specifications table: "System Weight: 287.6 lbs (130.45 kg) max"']])],
      ], drill: 2 },
    warm
      ? { id: 'drycoolers', title: 'Dry coolers', kicker: 'Heat out, no water used',
        body: 'Rooftop coils, such as EVAPCO’s Apex or Baltimore Aircoil’s TrilliumSeries dry coolers, reject the heat carried out of the GPUs by warm water with big fans. Water at 30–40 °C is warm enough to dump heat to outside air most of the year without chillers.',
        specs: [
          ['Heat rejected', `≈${mwTxt(IT_MW * 1.05)}`, 'derived', evCalc('campus-heat-rejected')],
          ['Units, ≈0.8 MW each', `≈${n0(L.dryCoolers)}`, 'derived', evCalc('campus-drycooler-count')],
          ['Water classes', 'ASHRAE W32–W45: 32–45 °C max supply', 'spec', evRefs([['ashrae-liquid-cooling-classes', 'blog: classes "W17, W27, W32, NEW class W40, W45" named for their maximum supply temperature in °C'], ['ashrae-tc99-liquid-cooling-wp', 'p.4, "Change to ASHRAE Water Classifications": "the W classes are being renamed with the upper temperature limits incorporated in the name... W17 (previously W1), W27 (W2), W32 (W3), W40 (new), W45 (W4)"']])],
          closed ? siteCool : ['Water use, dry + adiabatic', '≈0.15–0.17 L/kWh', 'reported', evRefs([['ai-dc-water-arxiv', 'Table 5: WUE for "IT Liquid cooling: dry cooler with adiabatic assist (air-cooled chiller)" = 0.15–0.17 L/kWh, adapted from Lei et al. 2025']])],
        ] }
      : closed
        ? { id: 'chillers', title: 'Chiller plant', kicker: 'Air-cooled, closed loop',
          body: `Air-cooled chillers make cold water for the racks’ coolant units and push the heat into outside air through fans on their condenser coils. SpaceXAI says Colossus II uses closed-loop cooling and takes only domestic water, so this model draws no cooling towers and counts no cooling water. Their compressors are the biggest power draw in cooling, which is why this design lands at PUE ${M.pue.toFixed(2)}.`,
          specs: [
            ['Chillers, ≈4 MW (1,100 ton) each', `≈${n0(L.chillers)}`, 'derived', evCalc('campus-chiller-count')],
            ['Reported, Aug 2025', '119 air-cooled chillers, ≈200 MW', 'reported', evRefs([['semianalysis-xai-colossus2', 'body text: "119 air-cooled chillers on site, i.e. roughly 200MW of cooling capacity" as of August 22, 2025']])],
            ['Cooling power', mwTxt(M.coolMW), 'derived', evCalc('campus-cooling-power')],
            ['Cooling water, per SpaceXAI', 'closed loop; domestic water only', 'spec', evRefs([['spacexai-mid-south', 'Water tab, "What Colossus uses today": "Colossus II uses closed-loop cooling and takes only domestic water"']])],
          ] }
        : { id: 'chillers', title: 'Chiller plant', kicker: 'Makes cold water',
        body: `Chillers, such as Schneider Electric’s Uniflair line, run a refrigeration cycle to cool water to ${air ? `about ${TT.fwsSupply} °C for the air coolers in the halls` : `about ${TT.fwsSupply} °C for the racks’ coolant units`}. Their compressors are the biggest power draw in cooling, which is why this design lands at PUE ${M.pue.toFixed(2)}.`,
        specs: [
          ['Chillers, ≈4 MW (1,100 ton) each', `≈${n0(L.chillers)}`, 'derived', evCalc('campus-chiller-count')],
          ['Cooling power', mwTxt(M.coolMW), 'derived', evCalc('campus-cooling-power')],
          ['Chiller efficiency', 'COP ≈5.5–8', 'reported', evRefs([['hvactoolskit-chiller-cop', 'chiller COP reference chart, two size classes combined: "Water-Cooled Centrifugal (<300T): 5.5-6.5" and "Water-Cooled Centrifugal (300+T): 6.0-8.0"']])],
        ] },
    ...(closed ? [] : [
    { id: 'towers', title: warm ? 'Cooling towers & tanks' : 'Cooling towers', kicker: warm ? 'For the hottest days' : 'Where the heat and water go',
      body: warm
        ? 'Evaporative towers trim water temperature on hot afternoons, and the tanks hold treated makeup water and fire water.'
        : 'Towers take the chillers’ heat, and the heat of their compressors, and throw it away by evaporating water. That is where most of a data center’s water goes.',
      specs: [
        ['Towers', `≈${n0(L.towers)}`, 'derived', evCalc('campus-tower-count')],
        ['WUE, on site', `≈${M.wue.toFixed(2)} L/kWh IT`, 'assumed', evAssume('wue-by-cooling')],
        ['Use', warm ? 'peak days only' : 'all year', 'derived', evCalc('campus-tower-use')],
        ['Cell drawn', 'counterflow, representative', 'assumed', evAssume('campus-tower-drawing')],
      ] },
    ]),
    { id: 'fiber', title: 'Fiber entrances', kicker: 'Two diverse routes',
      body: 'Long-haul fiber enters at two vaults on opposite sides of the site, so one backhoe cannot cut the campus off. Tokens leave the same way the questions arrive.',
      specs: [['Routes', '2 or more, physically separate', 'reported', evRefs([['trg-diverse-fiber-routes', '"A properly designed facility has dual fiber entrances. Fiber enters from two separate locations, following different physical paths into the building."']])]] },
    { id: 'security', title: 'Perimeter and gate', kicker: 'The outer layer of several',
      body: 'Physical security comes in layers, from the fence and a staffed gate inward to the building, the hall and the racks. The fence and gatehouse drawn here are the outermost one.',
      specs: [['Microsoft’s layers', 'facility perimeter, building perimeter, inside the building, the hall floor', 'reported', evRefs([['microsoft-azure-physical-security', '"access approval at the facility’s perimeter, at the building’s perimeter, inside the building, and on the datacenter floor"']])],
        ['Google’s data centers', 'six layers of physical security', 'reported', evRefs([['google-datacenter-security-blog', '"Each data center is protected with six layers of physical security designed to thwart unauthorized access."']])]] },
    { id: 'ops', title: 'Operations center', kicker: 'Watching power, cooling and security',
      body: 'Operators watch the site from software rather than by walking it. A power monitoring system gathers readings from the switchgear and distribution points; infrastructure management software tracks equipment, temperatures and security. It is drawn here as the site’s office building.',
      specs: [['Power monitoring (EPMS)', 'readings from key distribution points', 'reported', evRefs([['vertiv-epms', '"gathers power and energy information from key distribution points across a building"']])],
        ['Infrastructure management (DCIM)', 'assets, environment, security', 'reported', evRefs([['schneider-ecostruxure-dcim', '"Oversee and control assets, environmental conditions, and security"']])]] },
  ];
  // evidence shared by more than one hall card: the NIC line rate a GPU gets, and the accelerator's published
  // rack-power range, both drawn from a shipping datasheet for h100/gb200/gb300 and carried as pre-launch
  // assumptions for rubin (see ASSUMPTIONS 'rubin-prelaunch-specs' / 'rubin-prelaunch-power')
  const nicSpecEv = A.id === 'rubin' ? { refs: [['nvidia-vera-rubin-pod-blog', 'Eight ConnectX-9 devices per four-GPU tray provide 1.6 Tb/s aggregate scale-out per GPU.']] }
    : { refs: [[A.id === 'h100' ? 'nvidia-dgx-h100' : A.id === 'gb200' ? 'nvidia-coreweave-gb200-400g' : 'nvidia-connectx8-datasheet',
        A.id === 'h100' ? 'product page: eight ConnectX-7 400 Gb/s network adapters, one per GPU'
        : A.id === 'gb200' ? '"NVIDIA Quantum-2 InfiniBand networking that delivers 400Gb/s bandwidth per GPU"'
        : 'ConnectX-8 SuperNIC datasheet: 800 Gb/s port speed']] };
  const nicSpecBasis = 'spec';
  const rackPublishedEv = A.id === 'rubin' ? { assume: 'rubin-prelaunch-power' }
    : A.id === 'gb200' ? { refs: [['servethehome-dgx-gb200', 'confirms the 120 kW figure ("the 120kW flagship system stacked in a single rack"); this site’s 132 kW upper figure is a commonly repeated peak/TDP figure not independently re-confirmed in this pass']] }
    : { refs: [['servethehome-dgx-gb200', 'establishes the GB200-generation 120 kW flagship figure this GB300 range is reported relative to'], ['nvidia-gb300-power', 'NVIDIA’s own GB300 NVL72 power-smoothing post, describing the same rack platform this range covers']] };
  const rackPublishedBasis = A.id === 'rubin' ? 'assumed' : 'reported';
  PARTS.hall = [
    { id: 'unitsub', title: 'Unit substation', kicker: dc ? '34.5 kV → 480 V, for cooling' : '34.5 kV → 480 V, 2.5 MVA',
      body: dc
        ? 'Outside the wall, a pad-mounted transformer still makes 480 V for pumps, fans and lights. The racks no longer need it.'
        : 'Outside the wall, a pad-mounted transformer takes one campus feeder and makes 480 V three-phase. Its secondary runs a few meters through the wall into the switchgear.',
      specs: [['Rating', '2.5 MVA', 'assumed', { assume: 'unitsub-mva' }], ['Secondary current', '≈3,000 A at full load', 'derived', { calc: 'hall-unitsub-current' }], ['Efficiency', '≈99%', 'assumed', { assume: 'unitsub-cooling-side-eff-99', refs: [['doe-transformer-standards-2024', "DOE's 04/04/2024 final rule updating distribution-transformer efficiency standards, which supersedes the 2013 rule"]] }], ['Enclosure as drawn', 'representative', 'assumed', { assume: 'hall-unitsub-detail' }]] },
    { id: 'swgr', title: dc ? 'Medium-voltage switchgear' : '480 V switchgear', kicker: 'Breakers and transfer',
      body: dc
        ? `Breakers protect each 34.5 kV feed into the solid-state transformers and switch between utility and ${bat ? 'the site batteries' : 'generator power'} when the grid drops.`
        : `A lineup of drawout breakers protects every outgoing circuit and switches the room between utility and ${bat ? 'the site batteries' : 'generator'} when the grid drops.`,
      specs: [['Transfer', bat ? 'automatic, utility ↔ site batteries' : 'automatic, utility ↔ generator', 'assumed', { assume: bat ? 'site-battery-carries-campus' : 'hall-standard-practice' }], ['Markings', 'nameplate and arc-flash signs, representative', 'assumed', { assume: 'electrical-marks' }]] },
    dc
      ? { id: 'sst', title: 'Solid-state transformers', kicker: '34.5 kV AC → 800 V DC',
        body: 'Power electronics switching at high frequency replace the 60 Hz transformer, the UPS and the rack rectifiers with one conversion. NVIDIA and partners such as Navitas, Delta and Infineon/SolarEdge target these for 2027 racks; the efficiency here is a vendor claim.',
        specs: [['Efficiency, Navitas claim', '>98%', 'vendor', { refs: [['semiconductor-today-navitas-sst', '"exceeding 98% conversion from medium-voltage grids (13.8kVAC to 34.5kVAC) to 800VDC or 1500VDC" -- Navitas’s own claim for its SiCPAK SST power modules (the previously-cited navitas-800vdc release states no efficiency percentage at all)']], vs: 'a conventional 60 Hz transformer + UPS + rack-rectifier stack (three conversions, replaced by one)' }], ['Modules here, ≈2.5 MW', `≈${n0(L.sstModules)}`, 'derived', { calc: 'bom-facility-count', assume: 'sst-module-mw' }], ['Loss', lossTxt('Solid-state'), 'derived', { calc: 'ledger-stage-loss', assume: 'sst-eff-98' }]] }
      : { id: 'ups', title: 'UPS modules', kicker: 'Double conversion',
        body: `The UPS turns AC into DC and back to clean AC, with batteries on the DC link. It rides through the seconds between a grid failure and ${bat ? 'the site batteries' : 'the generators'} taking load.`,
        specs: [['Module', '1.25–1.5 MW', 'assumed', { assume: 'ups-module-mw' }], ['Modules here', `≈${n0(L.upsModules)}`, 'derived', { calc: 'bom-facility-count', assume: 'ups-module-mw' }], ['Efficiency, Eaton 9395XR', 'up to 97.5% online, 99% eco', 'reported', { refs: [['ceie-eaton-9395xr', '"tested efficiency of Eaton 9395XR UPS dual conversion in online mode is as high as 97.5%"; eco/AC-direct mode "can be improved to 99%" (Eaton’s own product page could not be opened this pass -- see its unchecked note)']] }], [`Loss at ${meter}`, lossTxt('UPS'), 'derived', { calc: 'ledger-conv-loss', assume: 'ups-eff-96.5' }]] },
    { id: 'batt', title: dc ? 'DC battery cabinets' : 'Battery cabinets', kicker: 'Lithium-ion, ≈5 minutes',
      body: dc
        ? 'Batteries sit right on the 800 V DC bus, with no inverter between them and the racks, so there is no UPS conversion loss at all.'
        : `Racks of lithium-ion modules on the UPS DC link. Five minutes is plenty: ${bat ? 'the site batteries are carrying the load within seconds' : 'the generators are carrying the load within a minute'}.`,
      specs: [['Runtime', 'set by string count, often ≈5 min', 'assumed', { assume: 'hall-batt-runtime' }], ['Chemistry', 'Li-ion (LFP or NMC)', 'assumed', { assume: 'hall-standard-practice' }]] },
    { id: 'busway', title: dc ? '800 V DC busway' : 'Overhead busway', kicker: dc ? '800 V DC to every rack' : '415 V to every rack',
      body: dc
        ? `Two conductors instead of three phases, and about a fifth of the current of 415 V AC at the same power. NVIDIA says 800 V DC cuts copper in the rack path by 45%.`
        : 'A transformer steps 480 V to 415 V, the voltage OCP rack power shelves take. Copper bars in an aluminum housing then run over each row, two to a row: an A busway over the rack backs and a B busway over the fronts, each from its own UPS side. Plug-in tap-off boxes drop one short cable from each into every rack, so moving a rack means moving two plugs.',
      specs: dc
        ? [['Rack voltage', '800 V DC', 'spec', { refs: [['nvidia-800v-hvdc', "NVIDIA's own architecture post names 800 V as the DC bus voltage for its next-generation AI-factory power design"]] }], ['Per rack', M.staircase.find(s => s.v === 800)?.current ?? '', 'derived', { calc: 'hall-busway-current' }], ['Copper, NVIDIA claim', '−45%', 'vendor', { refs: [['nvidia-800v-hvdc', '"With lower current, thinner conductors can handle the same load, reducing copper requirements by 45%."']], vs: '415 V AC busway distribution at the same delivered power' }], ['Hardware as drawn', 'representative', 'assumed', { assume: 'hall-busway-hardware' }]]
        : [['Rack voltage', '415 V three-phase', 'reported', { refs: [['lv-distribution-busway', '"415V (and its 400V European twin) is the de facto rack standard for liquid-density AI rows", vs. 208V three-phase in legacy air-cooled halls (the page does not separately discuss 480 V upstream distribution)']] }], ['Per rack', `${M.staircase.find(s => s.v === 415)?.current ?? ''} at ${rackKW} kW`, 'derived', { calc: 'hall-busway-current', assume: 'power-factor' }], ['Why busway', 'tap-offs move without rewiring', 'assumed', { assume: 'hall-standard-practice' }], ['Hardware as drawn', 'representative', 'assumed', { assume: 'hall-busway-hardware' }]] },
    { id: 'racks', title: mixed ? 'NVL72 racks' : nvl ? `${A.short} NVL72 racks` : 'DGX H100 racks', kicker: mixed ? FL.map(m => `≈${n0(m.racksShown)} ${m.accel.short}`).join(', ') : `${rackKW} kW each`,
      body: nvl
        ? `Each rack draws what a whole row of racks drew ten years ago. About ${Math.round(liq * 100)}% of its heat leaves in water${liq < 1 ? ', the rest in air' : ''}.${mixed ? ` This campus runs ${FL.map(m => `≈${n0(m.racksShown)} ${m.accel.rackName}`).join(' and ')} racks; the levels below show a ${A.rackName}.` : ''}`
        : 'Four air-cooled servers per rack, eight GPUs each. More would overheat: NVIDIA caps air-cooled DGX H100 at four per rack.',
      specs: nvl
        ? [...(mixed ? FL.map(m => [`${m.accel.short} rack, this model`, `≈${Math.round(m.rackKW)} kW`, 'derived', { calc: 'hall-rack-power' }]) : [['Power, this model', `≈${rackKW} kW`, 'derived', { calc: 'hall-rack-power' }]]), ['Published range', `${A.publishedRackKW[0]}–${A.publishedRackKW[1]} kW`, rackPublishedBasis, rackPublishedEv], ['GPUs', `72 ${X.arch}`, 'spec', { refs: [['nvidia-gb200-nvl72', 'product page: the NVL72 platform name and specifications describe a 72-GPU rack']] }], ['Liquid / air', `${liqKW} kW / ${airKW} kW`, 'derived', { calc: 'hall-liquid-air-split' }]]
        : [['Power, this model', `≈${rackKW} kW`, 'derived', { calc: 'hall-rack-power' }], ['Published', '≈41 kW for 4 systems', 'spec', { refs: [['nvidia-dgx-h100', 'product page: per-server maximum power draw, ×4 servers per rack']] }], ['GPUs', '32 H100', 'spec', { refs: [['nvidia-dgx-h100', 'product page: 8 GPUs per DGX H100 server × 4 servers per rack']] }]],
      drill: 3 },
    { id: 'containment', title: 'Hot aisle containment', kicker: air ? 'Keeps hot and cold air apart' : 'For the heat water misses',
      body: 'Glass roofs and doors close the aisle between rack backs, so the warm air goes straight back to the coolers instead of mixing into the room.',
      specs: [['Air share of heat', `≈${Math.round((1 - liq) * 100)}%`, 'derived', { calc: 'hall-air-heat-share' }], ['Doors and roof as drawn', 'representative', 'assumed', { assume: 'hall-containment-doors' }]] },
    air
      ? { id: 'inrow', title: 'In-row cooling units', kicker: 'Chilled water, cold air',
        body: 'Cabinets the size of a rack sit in each row. Fans pull hot-aisle air through chilled-water coils and blow it out cold into the room at the rack fronts.',
        specs: [['Capacity', '≈60–100 kW each', 'assumed', { assume: 'inrow-capacity' }], ['Units here', `≈${n0(L.airUnits)}`, 'derived', { calc: 'bom-facility-count', assume: 'inrow-capacity' }], ['Supply air', '≈18–27 °C (ASHRAE)', 'spec', { refs: [['ashrae-tc99-reference-card', 'Table 2.1, 2015 Thermal Guidelines: Recommended row, classes A1 to A4, 18 to 27 °C']] }], ['Cabinet drawn', 'representative', 'assumed', { assume: 'hall-cdu-cabinet' }]] }
      : { id: 'cdu', title: 'Coolant distribution unit', kicker: 'Two loops, one heat exchanger',
        body: 'The CDU keeps the rack loop, filtered water with glycol running through cold plates, separate from facility water. Units such as Vertiv’s CoolChip or Motivair’s CDU line pack the pumps, plate heat exchanger and controls into one cabinet; here one stands in the row beside every eight racks.',
        specs: [['Capacity range', '70 kW – 2.3 MW', 'spec', { refs: [['vertiv-coolchip-cdu', 'CoolChip CDU family: models from CDU 70 (70 kW) to CDU 2300 (2300 kW)'], ['motivair-cdu-brochure', '"COOLING UP TO 2.3MW", MCDU-4U (102 kW) through MCDU-60 (2.3 MW) rated-capacity table']] }], ['Units here, ≈1.25 MW', `≈${n0(L.cdus)}`, 'derived', { calc: 'bom-facility-count', assume: 'cdu-module-mw' }], ['Rule', 'rack loop stays above dew point', 'spec', { refs: [['motivair-cdu-brochure', '"The CDU maintains a secondary loop water temperature above the dew point in the data center to eliminate the possibility of condensation"']] }], ['Cabinet drawn', 'representative', 'assumed', { assume: 'hall-cdu-cabinet' }]] },
    { id: 'fwater', title: air ? 'Chilled water loop' : 'Facility water loop', kicker: 'Supply and return headers',
      body: `Insulated steel headers carry water between the ${air ? 'cooling units' : 'CDUs'} and the ${warm ? 'rooftop dry coolers' : 'chiller plant'}. Blue carries cooler supply, red carries warm return.`,
      specs: [['Supply → return', `≈${TT.fwsSupply} → ${TT.fwsReturn} °C`, 'assumed', { assume: 'loop-temps' }], ['Temperature rise', '≈10 °C across the racks', 'assumed', { assume: 'hall-water-rise-10c' }], ['Pipework as drawn', 'representative', 'assumed', { assume: 'hall-pipework-detail' }], ['Pipe markers', 'green with white letters and a flow arrow, ASME A13.1 style', 'assumed', { assume: 'pipe-markers', refs: [['projectmaterials-asme-a13-1', 'color code chart: "Green water, potable water, cooling water, condensate", green background with white text; "Flow direction arrows are a mandatory element of every pipe label"']] }]] },
    { id: 'fanwall', title: 'Fan wall', kicker: 'Air side',
      body: air ? 'A wall of fans and coils handles room air and the heat from lights, people and power gear.' : 'A wall of fans and coils cools the air that carries the remaining heat from power shelves, switches, optics and memory.',
      specs: [['Share of rack heat', `≈${Math.round((1 - liq) * 100)}%`, 'derived', { calc: 'hall-air-heat-share' }], ['Cells as drawn', 'representative', 'assumed', { assume: 'hall-fanwall-cells' }]] },
    { id: 'network', title: 'Network spine', kicker: 'Where tokens leave',
      body: 'Spine switches tie every rack to every other and to the fiber out of the building. Dense yellow trays carry thousands of fibers overhead.',
      specs: [['Per GPU', `${nicTxt} scale-out`, nicSpecBasis, nicSpecEv]] },
  ];
  // ---------- L45 tracing helpers: evidence for facts that recur across the rack and tray cards, per accelerator.
  // NVIDIA's own current pages/docs are cited where a direct fetch confirmed the exact figure; SemiAnalysis or
  // trade press stands in where a live NVIDIA page did not state the figure in what was fetched (marked 'reported'),
  // and NVIDIA's own pre-launch disclosures for Rubin are marked 'vendor' with the shipped generation as baseline.
  const ref = (id, at) => [id, at];
  const nvlPerGpuEv = () => A.id === 'h100'
    ? { basis: 'spec', ev: { refs: [ref('nvidia-h100-product-page', 'spec table: "NVLink | 900GB/s"')] } }
    : A.id === 'rubin'
      ? { basis: 'spec', ev: { refs: [ref('nvidia-nvlink-current-specs', 'Specifications table, sixth generation: 3,000 GB/s per GPU; preliminary, checked 9/29/2026. Earlier architecture blogs list 3.6 TB/s.')] } }
      : { basis: 'spec', ev: { refs: [ref('nvidia-gb200-nvl72-llm-blog', '"The revolutionary 1.8 TB/s of bidirectional throughput per GPU"')] } };
  const nvlDomainEv = () => A.id === 'rubin'
    ? { basis: 'spec', ev: { refs: [ref('nvidia-nvlink-current-specs', 'NVLink Switch specifications: 216 TB/s aggregate for NVL72; preliminary, checked 9/29/2026. Earlier blogs list 260 TB/s.')] } }
    : { basis: 'spec', ev: { refs: [ref(A.id === 'gb300' ? 'nvidia-gb300-nvl72' : 'nvidia-gb200-nvl72', '"130 terabytes per second (TB/s) of low-latency GPU communications"')] } };
  const gpuPowerEv = () => A.id === 'h100'
    ? { basis: 'spec', ev: { refs: [ref('nvidia-h100-product-page', 'spec table: "Max thermal design power (TDP) | Up to 700W (configurable)"')] } }
    : A.id === 'gb200'
      ? { basis: 'reported', ev: { refs: [ref('semianalysis-gb200-nvl72-specs', 'chip spec table: "TDP per chip: 1,200 W"')] } }
      : A.id === 'gb300'
        ? { basis: 'reported', ev: { refs: [ref('semianalysis-gb300-nvl72-specs', 'chip spec table: "TDP per chip: 1,400 W"')] } }
        : { basis: 'assumed', ev: { assume: 'rubin-gpu-power' } };
  const transistorsEv = () => A.id === 'h100'
    ? { basis: 'spec', ev: { refs: [ref('nvidia-hopper-architecture-page', '"Built with over 80 billion transistors using a cutting edge TSMC 4N process"')] } }
    : A.id === 'rubin'
      ? { basis: 'vendor', ev: { refs: [ref('wccftech-nvidia-rubin-gpu-architecture', '"The chip packs a total of 336 billion transistors," reporting NVIDIA’s architecture disclosure')], vs: 'Blackwell Ultra (GB300)’s 208 billion transistors, a 62% increase' } }
      : { basis: 'spec', ev: { refs: [ref('nvidia-blackwell-architecture-page', '"NVIDIA Blackwell-architecture GPUs pack 208 billion transistors"')] } };
  const hbmMemEv = () => A.id === 'h100'
    ? { basis: 'spec', value: hbmSpec, ev: { refs: [ref('nvidia-h100-product-page', 'spec table: "GPU Memory | 80GB" with "3.35TB/s" bandwidth')] } }
    : A.id === 'rubin'
      ? { basis: 'spec', value: hbmSpec, ev: { refs: [ref('nvidia-vera-rubin-current-specs', 'Rubin GPU column: 288 GB HBM4 and 19.2 TB/s, checked 9/29/2026; older architecture materials list 22 TB/s.')] } }
      : { basis: 'derived', value: `≈${A.id === 'gb300' ? 278 : 186} GB ${A.hbm.type}`,
        ev: { calc: 'hbm-per-gpu', refs: [ref(A.id === 'gb300' ? 'nvidia-gb300-nvl72' : 'nvidia-gb200-nvl72', A.id === 'gb300' ? '"20 TB" GPU memory total ÷ 72 GPUs' : '"13.4 TB HBM3E" total ÷ 72 GPUs')] } };
  const nicPerGpuEv = () => A.id === 'h100'
    ? { basis: 'spec', ev: { refs: [ref('nvidia-dgxh100-user-guide', 'Component Descriptions: "4 x OSFP ports for 8 x NVIDIA ConnectX-7 Single Port" cards, "Up to 400Gbps"')] } }
    : A.id === 'gb200'
      ? { basis: 'spec', ev: { refs: [ref('nvidia-dgx-gb200-hardware', 'Hardware: each compute tray has "4x NVIDIA ConnectX-7 single port 400G OSFP NIC"')] } }
      : A.id === 'gb300'
        ? { basis: 'spec', ev: { refs: [ref('nvidia-gb300-nvl72', '"NVIDIA ConnectX-8 SuperNIC’s" provide "800 gigabits per second (Gb/s) of network connectivity for each GPU"')] } }
        : { basis: 'vendor', ev: { refs: [ref('nvidia-ethernet-supernic', '"NVIDIA ConnectX-9 SuperNIC delivers up to 1.6 Tb/s throughput per GPU"')], vs: 'ConnectX-8 SuperNIC’s 800 Gb/s (GB300 generation)' } };
  const nvl72LayoutEv = () => A.id === 'rubin'
    ? { basis: 'spec', ev: { refs: [ref('nvidia-vera-rubin-pod-blog', 'Streamlined design section and Figures 6–7: 18 compute trays, 9 switch trays; two superchips per compute tray, four switch ASICs per switch tray.'), ref('nvidia-vera-rubin-system-blog', 'Vera Rubin superchip and compute-tray sections: one Vera CPU and two Rubin GPUs per superchip; two superchips per tray.')] } }
    : { basis: 'spec', ev: { refs: [ref('nvidia-dgx-gb200-hardware', 'Hardware: "18x 1RU compute trays, each with 2 Grace CPUs and 4 Blackwell GPUs"; "9x 1RU NVLink switch trays" of "2x NVLink NVSwitches" each'), ref('nvidia-nvl72-reference-arch', 'System Hardware & Components: 18 compute trays, 9 NVLink switch trays of 2 NVSwitch ASICs each')] } };
  PARTS.rack = nvl ? [
    { id: 'feed', title: 'Rack feed', kicker: dc ? '800 V DC in' : '415 V AC in',
      body: 'Two tap-off cables, one from each of two overhead busways (A and B), come in through the roof and run down the back of the rack to the power shelves, half of them on each feed, so either feed can be switched off for work.',
      specs: [['Feeds', 'A + B', 'assumed', { assume: 'dual-feed-redundancy' }], ['Tap-off hardware as drawn', 'representative', 'assumed', { assume: 'busway-tapoff-hardware' }]] },
    dc
      ? { id: 'shelves', title: 'DC-DC shelves', kicker: '800 V DC → ≈50 V DC',
        body: 'With DC already in the busway, shelves such as Delta’s or LITEON’s 800 V DC power shelves only step voltage down, one conversion instead of rectifying AC. Later racks move this conversion onto the trays.',
        specs: [['Efficiency, Navitas claim', '≈98.5% peak', 'vendor', { refs: [ref('navitas-10kw-dcdc-985', 'press release: "98.5% peak efficiency and 98.1% full load efficiency" for an 800 V-to-50 V DC-DC platform')], vs: 'a multi-stage AC-fed power shelf' }], ['Loss per rack', `≈${RK.convKW.toFixed(1)} kW`, 'derived', { calc: 'shelf-loss', refs: [ref('navitas-10kw-dcdc-985', '98.5% peak efficiency, the published input to this calculation')] }]] }
      : { id: 'shelves', title: 'Power shelves', kicker: '415 V AC → ≈50 V DC',
        body: `Each 1U shelf, such as LITEON’s power shelf for NVL72 racks, holds six hot-swap rectifiers in a 3+3 arrangement that turn AC into about 50 V DC.${A.id === 'gb300' ? ' GB300 shelves add capacitors that store 65 J per GPU to smooth training load swings.' : ''}`,
        specs: [['Shelf', '≈33 kW, 6 × 5.5 kW', 'spec', { refs: [ref('flex-gb200-power-shelf', 'product page: "consist of 6 PSUs with a max output power of 33kW"; component diagram separately labels one PSU "5500W PSU" (33 kW ÷ 6 = 5.5 kW matches)')] }],
          A.id === 'gb300'
            ? ['Shelves per rack', '8', 'spec', { refs: [ref('nvidia-nvl72-reference-arch', 'GB300 NVL72 System Hardware & Components: "8 power shelves of 33 kW, with each shelf having six 5.5 kW PSUs" for a rack "requiring up to 142 kW"')] }]
            : A.id === 'gb200'
              ? ['Shelves per rack', '8', 'spec', { refs: [ref('nvidia-dgx-gb200-hardware', 'Hardware: "The power shelf uses six air-cooled 5.5kW PSUs in eight power shelves that provide N+N redundancy and the required input power of 33kW per power shelf"')] }]
              : ['Shelves per rack', '8', 'assumed', { assume: 'gb200-shelf-count', refs: [ref('nvidia-dgx-gb200-hardware', 'Hardware: "six air-cooled 5.5kW PSUs in eight power shelves" for the GB200 rack, the count assumed here for Rubin')] }],
          ['Efficiency', '≈97.5% peak, half load', 'spec', { refs: [ref('flex-gb200-power-shelf', 'product page: "High efficiency up to 97.5% (peak)"')] }], ...(A.id === 'gb300' ? [['GB300 smoothing', '−30% peak grid demand', 'spec', { refs: [ref('nvidia-gb300-power', 'blog: "the peak grid demand is reduced by 30% when training the Megatron LLM"')] }]] : [])] },
    { id: 'busbar', title: 'DC busbar', kicker: `≈${n0(Math.round(RK.dcBusKW * 1000 / 50 / 100) * 100)} A down the back`,
      body: 'A vertical copper busbar runs the full height of the rack. Every tray has a clip on its back that grabs the bar when it slides in, so there are no power cables to trays.',
      specs: [['Voltage', '≈50 V DC (OCP ORv3)', 'spec', { refs: [ref('nvidia-dgx-gb200-hardware', 'Hardware: shelves "convert AC power into nominal 50V-51V DC output and distribute it through the bus bar"')] }], ['Busbar rating', '1,400 A per section', 'spec', { refs: [ref('nvidia-gb200-ocp', '"The new design supports a substantially higher 1,400 amp current flow"')] }], ['Next: NVIDIA Kyber, 2027', '800 V DC, 45% less copper', 'vendor', { refs: [ref('nvidia-800v-hvdc', '"reducing copper requirements by 45%"; "Full-scale production... will coincide with NVIDIA Kyber rack-scale systems in 2027"')], vs: 'today’s 54 V/50 V busbar architecture' }]] },
    { id: 'compute', title: 'Compute trays', kicker: '18 trays, 4 GPUs each',
      body: `Each tray holds two superchips: two ${X.cpu} CPUs and four ${X.gpus}. ${A.id === 'rubin' ? 'The Vera Rubin reference uses modular bays, an integrated liquid manifold and no tray fans.' : 'GB200 and GB300 share this broad layout, while their GPUs and network interfaces differ.'} Enclosure details are representative.`,
      specs: (() => { const { basis, ev } = nvl72LayoutEv(); return [['Trays', '18', basis, ev], ['GPUs per tray', '4', basis, ev], ['CPUs per tray', '2', basis, ev], ['Tray power', `≈${trayKW.toFixed(1)} kW`, 'derived', { calc: 'tray-power' }], ['Front panels as drawn', 'representative', 'assumed', { assume: 'nvl72-tray-faces' }]]; })(), drill: 4 },
    { id: 'nvswitch', title: 'NVLink switch trays', kicker: '9 trays in the middle',
      body: 'Nine switch trays connect all 72 GPUs as one NVLink domain. One tray is pulled out for inspection; connections across that display gap are schematic. Remote access is limited by the interconnect and workload, not the GPU’s local HBM bandwidth.',
      specs: (() => { const l = nvl72LayoutEv(), b = nvlPerGpuEv(), d = nvlDomainEv();
        return [['Trays', '9', l.basis, l.ev], ['Switch chips per tray', A.id === 'rubin' ? '4' : '2', l.basis, l.ev], ['Bandwidth per GPU', nvlTB, b.basis, b.ev], ['Domain total', A.id === 'rubin' ? '216 TB/s, preliminary 9/29/2026' : '130 TB/s', d.basis, d.ev], A.id === 'rubin' ? ['Front handles as drawn', 'representative', 'assumed', { assume: 'nvl72-tray-faces' }] : ['Front handles', 'gold, for removing the tray', 'reported', { refs: [ref('servethehome-dgx-gb200', 'NVSwitch shelves: "these gold features are handles to remove the shelves"')] }]]; })() },
    { id: 'spine', title: 'NVLink spine', kicker: '≈5,000 copper cables',
      body: A.id === 'rubin' ? 'Four rear cable cartridges connect compute and NVLink switch trays with roughly 5,000 copper cables. The model does not infer their signal-conditioning electronics from the earlier GB200 design.' : 'The rear cable cartridges join compute and switch trays. The GB200 user guide explicitly describes its backplane as passive copper; an older NVIDIA OCP article calls the cables active, so that wording alone does not establish their electronics. This view represents connectivity rather than a lane-by-lane wiring drawing.',
      specs: [...(A.id === 'rubin' ? [['Cartridges', '4; roughly 5,000 copper cables', 'spec', { refs: [ref('nvidia-vera-rubin-pod-blog', 'Streamlined design: four copper cable cartridges, roughly 5,000 cables spanning two miles.')] }]] : [['Links', 'more than 5,000 passive copper', 'spec', { refs: [ref('nvidia-gb200-ocp', '"These cartridges accommodate over 5,000 active copper cables"'), ref('nvidia-dgx-gb200-hardware', 'Hardware: opening paragraph calls the same backplane the "NVLink passive copper cable cartridge backplane"')] }], ['Total length', '≈2 miles', 'reported', { refs: [ref('theregister-dgx-gb200-nvl72', 'rack tour: "Both the NVLink switch and compute sleds slot into a blind mate backplane with more than 2 miles (3.2 km) of copper cabling"')] }], ['Signaling', '224G PAM4', 'reported', { refs: [ref('naddod-gb200-interconnect', 'interconnect analysis: NVLink 5 cartridge links run 224 Gb/s PAM4; not stated in these terms by NVIDIA itself')] }]]), ['Tray connection', 'blind-mate backplane, no loose cables', 'reported', { refs: [ref('theregister-dgx-gb200-nvl72', 'rack tour: "Both the NVLink switch and compute sleds slot into a blind mate backplane"')] }], ['Cartridge hardware as drawn', 'representative', 'assumed', { assume: 'nvl72-spine-mechanics' }]] },
    { id: 'manifold', title: 'Coolant manifolds', kicker: 'Blue in, red out',
      body: 'Two vertical manifolds with dripless quick disconnects feed every tray. The disconnects limit leakage when a tray is serviced.',
      specs: [['Liquid-cooled parts', liq >= 0.99 ? 'everything, by this model' : 'GPUs, CPUs, switch chips', liq >= 0.99 ? 'assumed' : 'spec', liq >= 0.99 ? { assume: 'rubin-full-liquid-cooling' } : { refs: [ref('nvidia-dgx-gb200-hardware', 'Hardware: compute trays "cooled by liquid that runs up and down the rack through manifolds, then through the cold plates that are attached to the CPUs and the GPUs"')] }], ['Tray connection', 'blind-mate nozzles', 'reported', { refs: [ref('servethehome-dgx-gb200', '"The rack is designed to blind-mate the power via the bus bar, as well as the liquid cooling nozzles and the NVLink connections for each component."')] }], ['Manifold hardware as drawn', 'representative', 'assumed', { assume: 'nvl72-manifold-hardware' }], ['Pipe markers', 'TCS supply and return, ASME A13.1 style', 'assumed', { assume: 'pipe-markers' }]] },
  ] : [
    { id: 'feed', title: 'Rack feed', kicker: '415 V AC in',
      body: 'Two tap-off cables from the overhead busway feed the rack: A and B for redundancy.',
      specs: [['Feeds', 'A + B', 'assumed', { assume: 'dual-feed-redundancy' }], ['Tap-off hardware as drawn', 'representative', 'assumed', { assume: 'busway-tapoff-hardware' }]] },
    { id: 'pdu', title: 'Rack power strips', kicker: '415 V three-phase → 240 V outlets',
      body: 'Vertical power strips at the back split each three-phase feed into single-phase outlets. Line to neutral, 415 V three-phase is 240 V, which is what server power supplies take.',
      specs: [['Per strip', 'high-30s kW class', 'reported', { refs: [ref('lv-distribution-busway', '"a 415V three-phase PDU at the same amperage [60A] clears the high-30s [kW]"; its 208V/415V density-tier table separately puts the 17–20 kW class at 208V, not 415V')] }], ['Outlets', 'C19, taking each cord’s C20 plug', 'reported', { refs: [ref('lv-distribution-busway', 'density-tier table, 30–80 kW row: "415V/400V busway + tap-off... IEC 60309 feed, C19/C21"'), ref('nvidia-dgxh100-user-guide', 'Power Cord Specification: "Plug Standard | C19/C20", so the strip end of each cord is a C20 plug in a C19 outlet')] }], ['Strips as drawn', 'representative', 'assumed', { assume: 'h100-pdu-cords' }]] },
    { id: 'servers', title: 'DGX H100 servers', kicker: '4 per rack, 8U each',
      body: 'Each server holds eight H100 GPUs on one baseboard, two Xeon CPUs, and its own power supplies and fans.',
      specs: [['Per server', '≈10.2 kW max', 'spec', { refs: [ref('nvidia-dgxh100-user-guide', 'Power Specifications table: "10.2 kW max." in the unlabeled column between Input and Specification for Each Power Supply — the system-level figure, distinct from the 3,300 W per-PSU column')] }], ['GPUs per server', '8', 'spec', { refs: [ref('nvidia-dgxh100-user-guide', 'Component Descriptions: "8 x NVIDIA H100 GPUs"')] }], ['Height', '8U, 356 mm', 'spec', { refs: [ref('nvidia-dgxh100-user-guide', 'Mechanical Specifications: "Form Factor: 8U Rackmount", "Height: 14\\" (356 mm)"')] }], ['Front', 'metal-foam bezel with handles', 'spec', { refs: [ref('nvidia-dgxh100-safety', 'NVIDIA Bezel: "The bezel’s decorative metal foam contains some nickel"; "use the handles to remove, attach or carry the bezel"'), ref('nvidia-dgxh100-user-guide', 'Front Panel (With Bezel): Power Button, ID Button, Fault LED')] }], ['Bezel and rear as drawn', 'representative', 'assumed', { assume: 'dgx-h100-bezel-rear' }]], drill: 4 },
    { id: 'psus', title: 'Server power supplies', kicker: 'AC → 54 V, inside each server',
      body: 'Each server has six 3.3 kW supplies, four carrying the load and two spare. The conversion happens server by server instead of in shared rack shelves.',
      specs: [['Per server', '6 × 3.3 kW, 4+2', 'spec', { refs: [ref('nvidia-dgxh100-user-guide', 'Power Specifications: "six power supply units (PSU) configured for 4+2 redundancy"; Specification for Each Power Supply column: "3300 W @ 200-240 V, 16 A, 50-60 Hz"')] }], ['Efficiency', '≈96% (80 PLUS Titanium class)', 'assumed', { assume: 'dgx-h100-psu-efficiency' }], ['Loss per rack', `≈${RK.convKW.toFixed(1)} kW`, 'derived', { calc: 'shelf-loss' }]] },
    { id: 'cabling', title: 'Power cords', kicker: 'No busbar',
      body: 'Twenty-four cords, six per server, run from the strips to the supplies. Air-cooled racks at 40 kW do not need a busbar.',
      specs: [['Cords per rack', '24', 'derived', { calc: 'count-per-rack' }], ['Cord ends', 'C19/C20, 1.2 m', 'spec', { refs: [ref('nvidia-dgxh100-user-guide', 'Power Cord Specification: "Plug Standard | C19/C20"; "Dimension | 1200mm length"')] }], ['Strips and routing as drawn', 'representative', 'assumed', { assume: 'h100-pdu-cords' }]] },
    { id: 'mgmt', title: 'Management switch', kicker: 'Out-of-band',
      body: 'A small copper switch at the top runs the rack’s management network: firmware, sensors and power control, separate from the fabrics that move model data.',
      specs: [['Rate', '1–10 GbE class', 'assumed', { assume: 'bmc-network-speed' }], ['Ports as drawn', '48 × 1 GbE + 4 × 100 GbE', 'assumed', { assume: 'tor-switch-ports', refs: [ref('nvidia-sn2201-specs', 'Connector/Port Specifications: "48 RJ45 ports of 1GbE and 4 QSFP28 ports of 100GbE"')] }], ['Free units above', 'cable manager + blanking panels', 'assumed', { assume: 'rack-elevation-fill' }]] },
  ];
  PARTS.tray = nvl ? [
    { id: 'clip', title: 'Busbar clip', kicker: '≈50 V DC in',
      body: 'Spring copper fingers at the back of the tray grab the rack busbar. More than a hundred amps flows through this clip when the tray is working hard.',
      specs: [['Tray power', `≈${trayKW.toFixed(1)} kW`, 'derived', { calc: 'tray-power' }], ['Current at 50 V', `≈${n0(trayKW * 20)} A`, 'derived', { calc: 'tray-clip-current' }], ['Finger count and housing', 'representative', 'assumed', { assume: 'tray-mechanical-detail' }]] },
    { id: 'ibc', title: 'Bus converters', kicker: '50 V → 12 V',
      body: 'Fixed-ratio converter bricks cut the voltage by about four and hand 12 V to the board. They are very efficient because they do not regulate. Vendors do not publish figures for this board, so the loss here is an estimate.',
      specs: [['Efficiency', '≈97–98%', 'assumed', { assume: 'ibc-efficiency' }], ['Loss, campus-wide', lossTxt('Bus converters'), 'derived', { calc: 'conversion-loss-campus' }]] },
    { id: 'vrm', title: 'Voltage regulators', kicker: '12 V → ≈0.8 V',
      body: 'Dozens of switching phases ring each GPU, each an inductor and a power stage switching at around a megahertz. They sit as close to the chip as they can, because every millimeter at a thousand amps costs power.',
      specs: [['Phases per GPU', '≈20–30', 'assumed', { assume: 'vrm-phases' }], ['Efficiency', `≈${Math.round(A.vrmEff * 100)}%`, 'assumed', { assume: 'vrm-efficiency' }], ['Loss, campus-wide', lossTxt('Voltage regulators'), 'derived', { calc: 'conversion-loss-campus' }], ['Core current', `≈${n0(coreA)} A`, 'derived', { calc: 'core-current' }], ['Board layout, traces and passives', 'representative', 'assumed', { assume: 'tray-mechanical-detail' }]] },
    { id: 'gpu', title: X.gpus, kicker: `4 per tray, ${n0(A.gpuW)} W each`,
      body: `Each GPU package is two large dies and ${stacksTxt} of HBM. It is where most of the power in the building finally goes.`,
      specs: (() => { const p = gpuPowerEv(), t = transistorsEv(), m = hbmMemEv();
        return [['Power', `≈${n0(A.gpuW)} W`, p.basis, p.ev], ['Transistors', X.transistors, t.basis, t.ev], [A.id === 'gb200' || A.id === 'gb300' ? 'Memory, from rounded rack total' : 'Memory', m.value, m.basis, m.ev]]; })(), drill: 5 },
    { id: 'grace', title: `${X.cpu} CPUs`, kicker: '2 per tray',
      body: `Each Arm CPU feeds two GPUs over a ${X.c2c} coherent link and keeps its own LPDDR5X memory beside it.`,
      specs: A.id === 'rubin'
        ? [['Cores', X.cpuCores, 'spec', { refs: [ref('nvidia-vera-rubin-current-specs', 'Superchip column: 88 custom Olympus CPU cores.')] }], ['CPU–GPU link', `${X.c2c} NVLink-C2C`, 'spec', { refs: [ref('nvidia-vera-rubin-current-specs', 'Superchip column: 1.8 TB/s NVLink-C2C bandwidth.')] }]]
        : [['Cores', X.cpuCores, 'spec', { refs: [ref('nvidia-grace-cpu-page', '"144 Arm Neoverse V2 cores into a single module" (two Grace CPUs); 72 cores per CPU')] }], ['CPU–GPU link', `${X.c2c} NVLink-C2C`, 'assumed', { assume: 'grace-gpu-c2c-bandwidth', refs: [ref('nvidia-grace-cpu-page', '"The Grace CPU Superchip is composed of two Grace CPUs connected coherently over NVIDIA NVLink-C2C at 900 GB/s" — Grace-to-Grace, not Grace-to-GPU'), ref('nvidia-grace-hopper-superchip', '"900 gigabytes per second (GB/s) of coherent interface" for the Grace-to-Hopper CPU-to-GPU link, one generation earlier')] }]] },
    { id: 'lpddr', title: 'LPDDR5X memory', kicker: 'CPU memory',
      body: A.id === 'rubin' ? 'Vera uses LPDDR5X SOCAMM memory modules. These are serviceable modules, not a ring of individual DRAM packages soldered around the CPU.' : `Low-power LPDDR5X is the ${X.cpu} CPU’s system memory. The illustrated placement is representative; it is separate from the GPU’s HBM.`,
      specs: [A.id === 'rubin'
        ? ['Capacity', X.cpuMem, 'spec', { refs: [ref('nvidia-vera-rubin-current-specs', 'Superchip column: up to 1.5 TB LPDDR5X for its one Vera CPU.'), ref('nvidia-vera-rubin-system-blog', 'Vera CPU and superchip sections identify SOCAMM LPDDR5X modules.')] }]
        : ['Capacity', X.cpuMem, 'derived', { calc: 'hbm-per-gpu', refs: [ref(A.id === 'gb300' ? 'nvidia-gb300-nvl72' : 'nvidia-gb200-nvl72', A.id === 'gb300' ? '"17 TB LPDDR5X" CPU memory ÷ 36 CPUs' : '"17 TB LPDDR5X" total ÷ 36 Grace CPUs')] }],
        ...(A.id === 'rubin' ? [['Module screws and package layout', 'representative', 'assumed', { assume: 'tray-mechanical-detail' }]] : [])] },
    { id: 'coldplates', title: 'Cold plates', kicker: 'Water on every hot chip',
      body: 'Copper plates with fine internal fins sit on each GPU and CPU. Coolant enters cool, picks up over a kilowatt per GPU, and leaves warm.',
      specs: (() => { const p = gpuPowerEv(); return [['Heat per GPU', `≈${(A.gpuW / 1000).toFixed(1)} kW`, p.basis, p.ev], ['Plate, fitting and screw shapes', 'representative', 'assumed', { assume: 'tray-mechanical-detail' }]]; })() },
    { id: 'nic', title: 'NICs, DPU and SSDs', kicker: 'The front of the tray',
      body: `${X.nic} cards carry scale-out traffic to the spine, ${A.dpusPerTray} BlueField ${A.dpusPerTray === 1 ? 'DPU handles' : 'DPUs handle'} storage and security, and E1.S drives hold local data.`,
      specs: (() => { const n = nicPerGpuEv(); return [['Scale-out', `${nicTxt} per GPU`, n.basis, n.ev], ...(A.id === 'gb300' ? [['NIC boards', '2 mezzanine boards × 2 ConnectX-8', 'spec', { refs: [ref('nvidia-nvl72-reference-arch', 'GB300 compute tray list: "2 Mezzanine Network Boards with 2 ConnectX-8 silicon chips in each, for a total of 4 ConnectX-8 Host Channel Adapters (HCA)"')] }], ['Front cages', '4 OSFP on 2 OSFP boards, 2 ports each', 'spec', { refs: [ref('lenovo-gb300-guide', 'compute tray slots: "Two PCIe Gen5 x16 Slot (OSFP Boards)"; Figure 5 labels "Bottom 2x OSFP Boards" and "2x CX8 Board"')] }], ['NIC board to cage board', 'internal cable assemblies', 'assumed', { assume: 'tray-nic-cage-cabling', refs: [ref('lenovo-gb300-guide', 'parts list: "GB300 PCIe Riser Cable"')] }], ['E1.S bays', 'up to 8, 4 populated', 'spec', { refs: [ref('lenovo-gb300-guide', 'storage: "Each Compute Tray supports up to 8x EDSFF E1.S NVMe SSDs, installed in 8 internal drive bays (non-hot-swap)"; only 4 are populated in the reference architecture')] }]] : A.id === 'gb200' ? [['NIC mounting', 'mezzanine boards on Mirror Mezz connectors', 'reported', { refs: [ref('semianalysis-gb200-hw', '"the ConnectX-7/8 ICs now sit directly on top of the Bianca board using a mezzanine board via Mirror Mezz connectors"')] }], ['To the front cages', 'DensiLink flyover cables', 'reported', { refs: [ref('semianalysis-gb200-hw', '"The electrical lanes are routed to the OSFP cages at the front of the chassis with DensiLink connectors from the mezzanine board."')] }], ['Cable path and cage board', 'representative', 'assumed', { assume: 'tray-nic-cage-cabling' }]] : [])]; })() },
    { id: 'nvconn', title: 'NVLink connectors', kicker: 'To the spine',
      body: 'High-density connectors at the rear mate with the copper spine when the tray is pushed home.',
      specs: (() => { const b = nvlPerGpuEv(); return [['Per GPU', `${A.nvlink.gen}, ${nvlTB}`, b.basis, b.ev]]; })() },
  ] : [
    { id: 'psu', title: 'Power supplies', kicker: 'AC → 54 V DC',
      body: 'Six hot-swap supplies run across the bottom of the rear, under both trays. They take 200–240 V AC; a distribution board and copper bars carry their DC forward under the motherboard tray to the midplane.',
      specs: [['Supplies', '6 × 3.3 kW, 4+2', 'spec', { refs: [ref('nvidia-dgxh100-user-guide', 'Power Specifications: "six power supply units (PSU) configured for 4+2 redundancy"; Specification for Each Power Supply column: "3300 W @ 200-240 V, 16 A, 50-60 Hz"')] }], ['Server power', '≈10.2 kW max', 'spec', { refs: [ref('nvidia-dgxh100-user-guide', 'Power Specifications table: "10.2 kW max." in the unlabeled column between Input and Specification for Each Power Supply — the system-level figure, distinct from the 3,300 W per-PSU column')] }], ['Where', 'the bottom of the rear', 'spec', { refs: [ref('nvidia-dgxh100-user-guide', 'Rear Panel Modules figure, labels top to bottom: "GPU tray", "Motherboard tray", "6 x 3.3kW Power Supplies"')] }], ['Distribution board and copper', 'representative', 'assumed', { assume: 'dgx-h100-internal-layout' }]] },
    { id: 'midplane', title: 'Midplane', kicker: 'Where the two trays plug in',
      body: 'Both trays slide in from the rear and plug into one board behind the fans. It carries their power, PCIe, sensors and signaling, so the GPU tray on top and the motherboard tray below never meet directly. Its openings let the fans’ air through; their shape here is representative.',
      specs: [['Carries', 'power, PCIe, sensors, signaling', 'spec', { refs: [ref('nvidia-dgxh100-user-guide', 'Motherboard Tray Components and GPU Tray Components figures, at the front edge of each tray: "Midplane connectivity Power, PCIe, sensors and signaling communications"')] }], ['Engaged by', 'levers on the motherboard tray', 'spec', { refs: [ref('nvidia-dgxh100-service-manual-mbtray-common', 'Preparing the Motherboard for Service: "Pull the ejection levers to disengage the midplane connectors"; "Use the levers to engage the midplane connectors"'), ref('nvidia-dgxh100-service-manual-mbtray', 'installation steps: "Use the levers to engage the midplane connectors"; removal: "Pull the ejection levers to disengage the midplane connectors"')] }], ['Openings, copper and connectors as drawn', 'representative', 'assumed', { assume: 'dgx-h100-internal-layout' }]] },
    { id: 'ibc', title: 'Bus converters', kicker: '54 V → 12 V',
      body: 'Converter modules at the front of the GPU baseboard step 54 V down to 12 V for the GPU modules behind them. Vendors do not publish figures for this board, so their place and the loss here are estimates.',
      specs: [['Efficiency', '≈98%', 'assumed', { assume: 'ibc-efficiency' }], ['Loss, campus-wide', lossTxt('Bus converters'), 'derived', { calc: 'conversion-loss-campus' }], ['Placement', 'representative', 'assumed', { assume: 'dgx-h100-internal-layout' }]] },
    { id: 'vrm', title: 'Voltage regulators', kicker: '12 V → ≈0.8 V',
      body: 'Switching phases around each GPU make the final step to under a volt.',
      specs: [['Efficiency', `≈${Math.round(A.vrmEff * 100)}%`, 'assumed', { assume: 'vrm-efficiency' }], ['Loss, campus-wide', lossTxt('Voltage regulators'), 'derived', { calc: 'conversion-loss-campus' }], ['Core current', `≈${n0(coreA)} A`, 'derived', { calc: 'core-current' }], ['Board layout, traces and passives', 'representative', 'assumed', { assume: 'tray-mechanical-detail' }]] },
    { id: 'gpu', title: 'H100 GPUs', kicker: '8 per server, 700 W each',
      body: 'Each SXM5 module is one large die with five working HBM3 stacks beside it, mounted face-down on the baseboard under a heat sink. The front one on the open side is lifted on its guide posts to show it.',
      specs: [['Power', '700 W', 'spec', { refs: [ref('nvidia-h100-product-page', 'spec table: "Max thermal design power (TDP) | Up to 700W (configurable)"')] }], ['Transistors', X.transistors, 'spec', { refs: [ref('nvidia-hopper-architecture-page', '"Built with over 80 billion transistors using a cutting edge TSMC 4N process"')] }], ['Memory', hbmSpec, 'spec', { refs: [ref('nvidia-h100-product-page', 'spec table: "GPU Memory | 80GB" with "3.35TB/s" bandwidth')] }]], drill: 5 },
    { id: 'heatsinks', title: 'Heat sinks', kicker: 'Air, not water',
      body: 'Tall finned heat sinks with heat pipes sit on each GPU. The GPU tray takes most of the 8U height to make room for them and for the air they need.',
      specs: [['Heat per GPU', '700 W', 'spec', { refs: [ref('nvidia-h100-product-page', 'spec table: "Max thermal design power (TDP) | Up to 700W (configurable)"')] }], ['Fin and heat-pipe counts', 'representative', 'assumed', { assume: 'tray-mechanical-detail' }]] },
    { id: 'nvswitch', title: 'NVSwitch chips', kicker: '4 on the baseboard',
      body: 'Four third-generation NVSwitch chips at the back of the baseboard connect all eight GPUs, so any GPU reads any other’s memory at full speed.',
      specs: [['Per GPU', '18 NVLink 4 links, 900 GB/s', 'spec', { refs: [ref('nvidia-dgxh100-user-guide', 'Component Descriptions: "4 x 4th generation NVLinks that provide 900 GB/s"')] }]] },
    { id: 'cpu', title: 'Xeon CPUs', kicker: '2 per server, 350 W each',
      body: 'Two x86 CPUs sit side by side in the motherboard tray, under the GPU tray. They run the operating system and feed the GPUs; they do none of the model math.',
      specs: [['CPU', `${X.cpuLong}, ${X.cpuCores}`, 'spec', { refs: [ref('nvidia-dgxh100-user-guide', 'Component Descriptions: "2 x Intel Xeon 8480C PCIe Gen5 CPUs with 56 cores each"')] }], ['Power', '350 W each', 'spec', { refs: [ref('intel-xeon-8480c', 'specifications: TDP "350 W"')] }]] },
    { id: 'dimm', title: 'System memory', kicker: '32 DIMMs, 2 TB',
      body: 'Eight DDR5 DIMMs stand either side of each CPU, along the airflow. Each CPU has eight memory channels, so its sixteen DIMMs run two to a channel.',
      specs: [['DIMMs', '32 × 64 GB, 2 TB', 'spec', { refs: [ref('nvidia-dgxh100-user-guide', 'Component Descriptions: "2 TB using 32 x DIMMs"; Motherboard Tray Components figure: "32 x 64GB DIMMs for a total of 2TB of system memory"')] }], ['Channels per CPU', '8', 'spec', { refs: [ref('intel-xeon-8480c', 'specifications: "Max # of Memory Channels" 8; Memory Types "Up to DDR5 4800 MT/s 1DPC Up to DDR5 4400 MT/s 2DPC"')] }]] },
    { id: 'nic', title: 'ConnectX-7 NICs', kicker: 'One per GPU',
      body: 'Two network modules at the front of the motherboard tray carry four ConnectX-7 each, one for every GPU. Four DensiLink cables, two ports each, run back over the CPUs to the four twin-port cages at the rear.',
      specs: [['Scale-out', '400 Gb/s per GPU', 'spec', { refs: [ref('nvidia-dgxh100-user-guide', 'Component Descriptions: "4 x OSFP ports for 8 x NVIDIA ConnectX-7 Single Port" cards, "Up to 400Gbps"')] }], ['Modules', '2, four ConnectX-7 each', 'spec', { refs: [ref('nvidia-dgxh100-user-guide', 'Network Modules: "Consolidates four ConnectX-7 networking cards into a single device"; "Two networking modules are installed on interposer board"')] }], ['To the cages', '4 DensiLink cables, 2 ports each', 'spec', { refs: [ref('nvidia-dgxh100-user-guide', 'Network Modules: "DensiLink cables are used to go directly from ConnectX-7 networking cards to OSFP connectors at the back of the system"; "Each DensiLink cable has two ports, one from each ConnectX-7 card"')] }], ['Power, a comparable card', '24.9 W typical', 'spec', { refs: [ref('nvidia-connectx7-specs', 'MCX75310AAS-NEAT (single-port OSFP): "Typical power with passive cables in PCIe Gen 5.0 x16" "24.9W"')] }], ['Cable path', 'representative', 'assumed', { assume: 'tray-nic-cage-cabling' }]] },
  ];
  // ---------- level 6 evidence: the GPU package, one basis + citation per accelerator per fact ----------
  // NVIDIA confirms some of these facts identically across generations (die-to-die bandwidth, packaging family);
  // others it has stated only for some chips, or not yet for Rubin (pre-launch). See research/product-portfolio.md
  // and the fetches behind this commit for the exact quotes each ref location paraphrases.
  const EV6 = {
    h100: {
      pack: { basis: 'reported', ev: { refs: [['tomshardware-cowos-l-blackwell', 'body text, quoting NVIDIA CEO Jensen Huang: "We will also transition the CoWoS-S capacity to CoWoS-L" — said of Hopper, which "will use CoWoS-S"']] } },
      process: { basis: 'spec', ev: { refs: [['nvidia-hopper-architecture-indepth', 'body text: "TSMC 4N process customized for NVIDIA"']] } },
      transistors: { basis: 'spec', ev: { refs: [['nvidia-hopper-architecture-indepth', 'body text: "80 billion transistors"']] } },
      dieRow: { basis: 'spec', ev: { refs: [['nvidia-hopper-architecture-indepth', 'body text: "a die size of 814 mm2"; also in the A100/H100 comparison table, "GPU Die Size ... 814mm2"']] } },
      fluxDie: { basis: 'spec', ev: { refs: [['nvidia-hopper-architecture-indepth', 'body text: "a die size of 814 mm2" (= 8.14 cm²)']] } },
      layers: { basis: 'reported', ev: { refs: [['tomshardware-hynix-hbm3-h100', 'body text: "each stack packs eight 2GB DRAM devices for a total of 16GB per package... the company kicks off production with 8-Hi stacks", shipping "for its H100 compute GPUs"']] } },
      hbm: { basis: 'spec', ev: { refs: [['nvidia-h100-product-page', 'specifications table: "GPU Memory 80GB", "GPU Memory Bandwidth 3.35TB/s" (SXM5 column)']] } },
      nvlink: { basis: 'spec', ev: { refs: [['nvidia-hopper-architecture-indepth', 'body text: "900 GB/sec total bandwidth... 18 fourth-generation NVLink links at 25 GB/sec each"'], ['nvidia-h100-product-page', 'specifications table: NVLink 900GB/s']] } },
      pkgPower: { basis: 'spec', ev: { refs: [['nvidia-hopper-architecture-indepth', 'body text: SXM5 "700 Watts"'], ['nvidia-h100-product-page', 'specifications table: "Up to 700W (configurable)"']] } },
    },
    gb200: {
      pack: { basis: 'reported', ev: { refs: [['tomshardware-cowos-l-blackwell', 'headline and body: NVIDIA "shifts to CoWoS-L packaging for Blackwell GPU production"']] } },
      process: { basis: 'spec', ev: { refs: [['nvidianews-blackwell-platform-arrival', 'body text: "manufactured using a custom-built 4NP TSMC process"']] } },
      transistors: { basis: 'spec', ev: { refs: [['nvidianews-blackwell-platform-arrival', 'body text: "Packed with 208 billion transistors"']] } },
      dieRow: { basis: 'spec', ev: { refs: [['nvidianews-blackwell-platform-arrival', 'body text: "a 10 TB/second chip-to-chip link" joining the two reticle-limit dies']] } },
      fluxDie: { basis: 'reported', ev: { refs: [['wccftech-nv-hbi', 'body text: "AI Superchip - 208 Billion Transistors (TSMC 4NP, >1600mm2)"']] } },
      layers: { basis: 'spec', ev: { refs: [['micron-hbm3e-brief', 'specifications table: "8H, 12H HBM3E" at "24GB, 36GB"']] } },
      hbm: { basis: 'spec', ev: { refs: [['nvidia-gb200-nvl72', 'specifications: "372 GB" HBM3e and "16 TB/s" per Grace Blackwell Superchip (2 GPUs)'], ['micron-hbm3e-brief', 'specifications table: 24 GB at 8-Hi, >1.2 TB/s per stack']] } },
      nvlink: { basis: 'spec', ev: { refs: [['nvidia-gb200-nvl72', 'product page: "1.8 TB/s of GPU-to-GPU interconnect", fifth-generation NVLink'], ['nvidianews-blackwell-platform-arrival', 'body text: "1.8TB/s bidirectional throughput per GPU"']] } },
      pkgPower: { basis: 'reported', ev: { refs: [['semianalysis-gb200-nvl72-specs', 'the chip’s specifications table: "1,200 W" per GPU']] } },
    },
    gb300: {
      pack: { basis: 'reported', ev: { refs: [['tomshardware-cowos-l-blackwell', 'headline and body: NVIDIA "shifts to CoWoS-L packaging for Blackwell GPU production" (Blackwell Ultra shares the platform)']] } },
      process: { basis: 'spec', ev: { refs: [['nvidia-blackwell-ultra-blog', 'body text: "manufactured using TSMC 4NP"']] } },
      transistors: { basis: 'spec', ev: { refs: [['nvidia-blackwell-ultra-blog', 'body text: "208B transistors–2.6x more than the NVIDIA Hopper GPU"']] } },
      dieRow: { basis: 'spec', ev: { refs: [['nvidianews-blackwell-platform-arrival', 'body text: "a 10 TB/second chip-to-chip link"; Blackwell Ultra keeps the same die-to-die interconnect']] } },
      fluxDie: { basis: 'reported', ev: { refs: [['wccftech-nv-hbi', 'body text: ">1600mm2" for the same 208B-transistor die pair Blackwell Ultra also reports']] } },
      layers: { basis: 'spec', ev: { refs: [['micron-hbm3e-brief', 'specifications table: "8H, 12H HBM3E" at "24GB, 36GB"']] } },
      hbm: { basis: 'spec', ev: { refs: [['nvidia-blackwell-ultra-blog', 'body text: "288 GB of HBM3e per GPU" and "8 TB/s per GPU"'], ['micron-hbm3e-brief', 'specifications table: 36 GB at 12-Hi']] } },
      nvlink: { basis: 'spec', ev: { refs: [['nvidia-blackwell-ultra-blog', 'body text: "1.8 TB/s bidirectional (18 links x 100 GB/s)"']] } },
      pkgPower: { basis: 'spec', ev: { refs: [['nvidia-blackwell-ultra-blog', 'body text: per-GPU TDP "Up to 1,400W"']] } },
    },
    rubin: {
      pack: { basis: 'assumed', ev: { assume: 'rubin-packaging' } },
      process: { basis: 'reported', ev: { refs: [['wccftech-rubin-gpu-architecture', 'body text: "TSMC’s 3nm (N3P) process node"']] } },
      transistors: { basis: 'spec', ev: { refs: [['nvidia-rubin-gpu-architecture-blog', 'body text: "336 billion transistors"']] } },
      dieRow: { basis: 'assumed', ev: { assume: 'rubin-nvhbi-bandwidth' } },
      fluxDie: { basis: 'assumed', ev: { assume: 'rubin-die-area' } },
      layers: { basis: 'reported', ev: { refs: [['wccftech-rubin-gpu-architecture', 'body text: "288 GB of capacity across eight 12-Hi stacks"']] } },
      hbm: { basis: 'spec', ev: { refs: [['nvidia-vera-rubin-current-specs', 'GPU column, checked 9/29/2026: 288 GB HBM4 and 19.2 TB/s. Older architecture blogs retain 22 TB/s.']] } },
      nvlink: { basis: 'spec', ev: { refs: [['nvidia-nvlink-current-specs', 'Sixth-generation table, checked 9/29/2026: 3,000 GB/s per GPU and 216 TB/s per rack; preliminary. Older blogs retain 3.6 TB/s and 260 TB/s.']] } },
      pkgPower: { basis: 'assumed', ev: { assume: 'rubin-package-power' } },
    },
  }[A.id];

  PARTS.chip = [
    { id: 'balls', title: 'Solder balls & substrate', kicker: 'A thousand-plus amps comes up here',
      body: 'Thousands of solder balls carry power and signals from the board into a many-layer organic substrate. Most of the balls are power and ground: at 0.8 V it takes many parallel paths to carry a thousand amps.',
      specs: [['Core voltage', '≈0.7–0.9 V', 'assumed', { assume: 'core-voltage' }], ['Core current, P ÷ V', `≈${n0(coreA)} A over several rails`, 'derived', { calc: 'core-current' }], ['Stiffener ring and capacitors, as drawn', 'representative', 'assumed', { assume: 'package-stiffener-drawing' }], ['Ball and bump pitch, as drawn', 'coarser than real', 'assumed', { assume: 'package-solder-drawing' }]] },
    { id: 'interposer', title: 'Interposer', kicker: X.packaging.replace('TSMC ', ''),
      body: A.id === 'h100'
        ? 'A single silicon interposer wires the die and memory together with lines far finer than any circuit board can carry.'
        : 'Instead of one large silicon interposer, small silicon bridges embedded in the interposer carry the finest wiring: under the seam between the dies and under each die-to-HBM edge.',
      specs: [['Packaging', X.packaging, EV6.pack.basis, EV6.pack.ev],
        ...(A.id === 'h100' ? [] : [['Structure', 'bridge-based, not a monolithic silicon interposer', A.id === 'rubin' ? 'assumed' : 'reported', A.id === 'rubin' ? { assume: 'rubin-packaging' } : { refs: [['techinsights-b200-packaging', 'body text: GB100 "utilizes the local area silicon interconnect (-L) variant of CoWoS instead of a monolithic silicon interposer (-S)", "NVIDIA’s first use of a bridge-based 2.5D integration technology"']] }],
          ['Bridges and microbumps, as drawn', 'representative', 'assumed', { assume: 'cowos-bridge-drawing' }]])] },
    { id: 'dies', title: A.dies > 1 ? 'Two GPU dies' : 'One GPU die', kicker: `${X.transistors.replace(', as announced', '')} transistors`,
      body: A.dies > 1
        ? 'Two reticle-limit dies act as one GPU, joined by a 10 TB/s die-to-die link. Nearly every watt that reaches them, whether it runs computation, on-chip memory, communication or leakage, ends as heat.'
        : 'One reticle-limit die, about as large as a chip can be made in one exposure. Nearly every watt that reaches it, whether it runs computation, on-chip memory, communication or leakage, ends as heat.',
      specs: [['Transistors', X.transistors, EV6.transistors.basis, EV6.transistors.ev],
        ...(A.dies > 1 ? [['Die-to-die link', '10 TB/s NV-HBI', EV6.dieRow.basis, EV6.dieRow.ev]] : [['Die area', '814 mm²', EV6.dieRow.basis, EV6.dieRow.ev]]),
        ['Process', X.process, EV6.process.basis, EV6.process.ev], ['Floorplan shown', 'illustrative x-ray', 'assumed', { assume: 'die-floorplan-drawing' }]] },
    { id: 'hbm', title: `${A.hbm.type} stacks`, kicker: `${stacksTxt}, ${A.hbm.gb} GB`,
      body: `Each stack, from suppliers such as SK hynix, Micron and Samsung, is ${A.hbm.layers} DRAM dies thinned and stacked with through-silicon vias. Moving model weights out of HBM for every token is a large share of inference energy.`,
      specs: [['Capacity', `${A.hbm.gb} GB${A.id === 'gb200' ? ' nominal; rack total implies ≈186 GB' : A.id === 'gb300' ? ' nominal; rounded rack total implies ≈278 GB' : ''}`, EV6.hbm.basis, EV6.hbm.ev], ['Bandwidth', hbmTB, EV6.hbm.basis, EV6.hbm.ev],
        ['Layers per stack', `${A.hbm.layers}`, EV6.layers.basis, EV6.layers.ev], ['Share of GPU power', '≈8–15%', 'assumed', { assume: 'hbm-power-share' }], ['Stack height, as drawn', 'about 3× real', 'assumed', { assume: 'hbm-stack-drawing' }]] },
    { id: 'tokens', title: 'Tokens', kicker: 'What leaves', math: tokenMathRows(M),
      body: 'Every token a model writes is a pass through billions of weights. Run the numbers below to see how many a kilowatt-hour buys.',
      specs: [
        ['Google, median Gemini text prompt', '0.24 Wh, all-in', 'spec', { refs: [['google-inference-impact', 'body text: "the median Gemini Apps text prompt uses 0.24 watt-hours (Wh) of energy"']] }],
        ['LLaMA-65B on V100, 2023', '≈3–4 J per token', 'spec', { refs: [['samsi-words-to-watts', 'Section IV.C: "with length 512, we see that it takes about 3-4 Joules for a output token" — Figs. 6-7\'s 8/16/32-shard x-axis is the paper\'s V100 config (Table II: 65B needs 8 V100s but only 4 A100s)']] }],
        ['GB200 vs H200', '≈8× tokens per MW', 'reported', { refs: [['semianalysis-inferencex-inferencemax', 'body text: "single node H200 FP8 vs a GB200 NVL72 FP4 (without Multi Token Prediction)... ~8x improvement in token/s processed per all-in provisioned MW" (DeepSeek R1)']] }],
      ] },
  ];

  // ---------- bill of materials. The 4th element is the part each row counts, the 5th (bomEv) its evidence ----------
  const Lk = at;
  const bomFacility = { calc: 'bom-facility-count' };
  const bomRack = { calc: 'bom-rack-count' };
  const bomSilicon = { calc: 'bom-silicon-count' };
  const bomNetwork = { calc: 'bom-network-count' };
  const fabricRefs = [['nvidia-quantum2-qm9700-specs', 'QM97xx specifications: 32 OSFP cages, 25.6 Tbps (64 logical 400G ports) -- the 400G-tier radix the fabric model encodes'], ['nvidia-xdr-switch-specs', 'Quantum-X800 XDR specifications -- the 800G-tier radix the fabric model encodes']];
  const BOM = [
    { group: 'Grid & campus', rows: [
      [`Main power transformers, ${L.mvaUnit} MVA`, n0(L.transformers), 'derived', Lk(1, 'mpt'), bomFacility],
      ['34.5 kV feeders', `≈${n0(L.feeders)}`, 'derived', Lk(1, 'ehouse'), bomFacility],
      ...(bat ? [
        ['Battery storage, per SpaceXAI (planned)', `${+(L.bessMWh / 1000).toFixed(1)} GWh`, 'spec', Lk(1, 'bess'), { refs: [['spacexai-mid-south', 'Colossus II tab, Power: "America’s largest grid-connected battery pack will provide 3.3 gigawatt hours"']] }],
        ['Battery power, assumed', `≈${n0(L.bessMW)} MW, ≈${bessH.toFixed(1)} h at full load`, 'assumed', Lk(1, 'bess'), { assume: 'site-battery-carries-campus' }],
        ['Diesel generators', 'none mentioned by SpaceXAI', 'spec', Lk(1, 'bess'), { refs: [['spacexai-mid-south', 'all five tabs (Colossus I, Colossus II, Water, Power, Air), checked 09/27/2026: no diesel generators are mentioned']] }],
      ] : [
        ['Diesel generators, 3 MW', `≈${n0(L.gensets)}`, 'derived', Lk(1, 'gensets'), { calc: 'bom-facility-count', refs: [['cummins-dqkan-genset', 'DQKAN generator-set data sheet: 2500 kW (2.5 MW) standby rating for one commercial unit in this class -- this site’s own model rounds to an illustrative 3 MW genset unit for its count, not this specific product’s rating']] }],
        ['Diesel on site, 48 h', `≈${L.fuelML >= 10 ? n0(L.fuelML) : L.fuelML.toFixed(1)} million L`, 'derived', Lk(1, 'fuel'), { calc: 'fuel-tankers', assume: 'fuel-truckload' }],
        ['Battery storage', `≈${n0(L.bessMW)} MW / ${n0(L.bessMWh)} MWh`, 'derived', Lk(1, 'bess'), bomFacility],
      ]),
      ...(warm ? [['Rooftop dry coolers', `≈${n0(L.dryCoolers)}`, 'derived', Lk(1, 'drycoolers'), bomFacility]] : [['Chillers, 4 MW', `≈${n0(L.chillers)}`, 'derived', Lk(1, 'chillers'), bomFacility]]),
      ...(closed ? [] : [['Cooling towers', `≈${n0(L.towers)}`, 'derived', Lk(1, 'towers'), bomFacility]]),
    ] },
    { group: 'Buildings', rows: [
      ['Data halls', n0(halls), 'derived', Lk(1, 'hall'), bomFacility],
      ['Unit substations, 2.5 MVA', `≈${n0(dc ? Math.ceil((M.coolMW + M.miscMW) / 2.2) : L.unitSubs)}`, 'derived', Lk(2, 'unitsub'), { calc: 'bom-facility-count', assume: 'unitsub-mva' }],
      dc ? ['Solid-state transformers, 2.5 MW', `≈${n0(L.sstModules)}`, 'derived', Lk(2, 'sst'), bomFacility] : ['UPS modules, 1.25 MW', `≈${n0(L.upsModules)}`, 'derived', Lk(2, 'ups'), { calc: 'bom-facility-count', assume: 'ups-module-mw' }],
      air ? ['In-row cooling units', `≈${n0(L.airUnits)}`, 'derived', Lk(2, 'inrow'), bomFacility] : ['Coolant distribution units', `≈${n0(L.cdus)}`, 'derived', Lk(2, 'cdu'), { calc: 'bom-facility-count', refs: [['vertiv-coolchip-cdu', 'CoolChip CDU family page: models from CDU 70 (70 kW) to CDU 2300 (2300 kW)'], ['motivair-cdu-brochure', 'brochure: "COOLING UP TO 2.3MW", MCDU-4U (102 kW) through MCDU-60 (2.3 MW) rated-capacity table']] }],
      ['Busway runs', `≈${n0(RACKS / 10)}`, 'derived', Lk(2, 'busway'), bomRack],
    ] },
    { group: 'Racks', rows: nvl ? [
      ...FL.map(m => [`${m.accel.rackName} racks`, `≈${n0(m.racksShown)}`, 'derived', Lk(2, 'racks'), { calc: M.stage != null ? 'bom-racks-from-gpus' : 'bom-racks-from-power' }]),
      [dc ? 'DC-DC shelves' : 'Power shelves', `≈${n0(RACKS * 6)}`, 'derived', Lk(3, 'shelves'), bomRack],
      ...(dc ? [] : [['Rectifiers', `≈${n0(RACKS * 36)}`, 'derived', Lk(3, 'shelves'), bomRack]]),
      ...(!FL.some(m => m.accel.id === 'rubin') ? [['NVLink copper connections', `≈${kfmt(NET.nvlinkPairs)}`, 'derived', Lk(3, 'spine'), bomRack]] : []),
    ] : [
      ['DGX H100 racks', `≈${n0(RACKS)}`, 'derived', Lk(2, 'racks'), { calc: 'bom-racks-from-power' }],
      ['DGX H100 servers', `≈${n0(RACKS * 4)}`, 'derived', Lk(3, 'servers'), bomRack],
      ['Server power supplies', `≈${n0(RACKS * 24)}`, 'derived', Lk(4, 'psu'), bomRack],
    ] },
    { group: 'Silicon', rows: [
      ...(mixed ? FL.map(m => [`${FACTS[m.accel.id].gpus} (${m.accel.short})`, `≈${n0(m.gpus)}`, 'reported', Lk(4, 'gpu'), { refs: [['elonmusk-x-colossus-2026-09-25', 'post on X, 09/25/2026: "Colossus 2 is 110k GB200 and 440k GB300" (later stages: his stated plans)']] }]) : [[X.gpus, `≈${n0(GPUS)}`, 'derived', Lk(4, 'gpu'), bomSilicon]]),
      [`${X.cpu} CPUs`, `≈${n0(M.cpus)}`, 'derived', Lk(4, nvl ? 'grace' : 'cpu'), bomSilicon],
      [`${A.hbm.type} stacks`, `≈${kfmt(M.hbmStacks)}`, 'derived', Lk(5, 'hbm'), bomSilicon],
      ['VRM phases', `≈${kfmt(GPUS * 24)}`, 'derived', Lk(4, 'vrm'), bomSilicon],
      ['Transistors in GPUs', `≈${(FL.reduce((t, m) => t + m.gpus * tPerGpu(m.accel), 0) / 1e15).toFixed(1)} quadrillion`, 'derived', Lk(5, 'dies'), bomSilicon],
    ] },
    { group: 'Network', rows: [
      [nvl ? 'NVLink switch chips' : 'NVSwitch chips', `≈${n0(NET.nvswitchChips)}`, 'derived', nvl ? Lk(3, 'nvswitch', 'data') : Lk(4, 'nvswitch', 'data'), bomRack],
      [nvl ? 'SuperNICs' : 'ConnectX-7 NICs', `≈${n0(FL.reduce((sum, m) => sum + m.gpus * m.accel.nicsPerGpu, 0))}`, 'derived', Lk(4, 'cx', 'data'), bomNetwork],
      [`Leaf / spine / core switches, ${NET.fabric.radix}-port`, `≈${n0(NET.switches)}`, 'derived', Lk(2, 'spine', 'data'), { calc: 'bom-network-count', refs: fabricRefs }],
      ['Optical modules', `≈${kfmt(NET.modules)}`, 'derived', Lk(2, 'optics', 'data'), { calc: 'bom-network-count', refs: [['nvidia-800g-dr8-datasheet', 'section 4.2: Maximum Power Dissipation, Max 17 W -- the per-module figure the fabric’s optics-power model scales from']] }],
      ['Fiber strands in the fabric', `≈${kfmt(NET.fibers)}`, 'derived', Lk(2, 'runways', 'data'), bomNetwork],
    ] },
  ];

  // Google's optical circuit switches, from Google's own papers: the TPU v4 paper (ISCA 2023) for the switch and the
  // 4,096-chip system it joins, Jupiter Evolving (SIGCOMM 2022) for the same kind of switch one layer up. The power
  // comparison is SemiAnalysis's, so it stays a report. The card figure (src/app/ocs-figure.js) draws rows 1 and 2.
  const ocsBody = 'The NVIDIA hardware shown uses copper for its NVLink domain and separate pluggable optics for the compute network. For comparison, Google scales up differently, not purely with light: within each 64-chip cube, most ICI links are copper, wired directly in a 3D torus, with optical transceivers only at the cube’s outer edges. Mirror-based optical circuit switches (OCS) then join whole cubes together. Google’s TPU v4 paper describes its switch: 3D MEMS mirrors that re-aim the light in milliseconds, with circulators sending both directions down one fiber, which halves the ports and cables. Google’s Jupiter data center network uses OCSes a layer up, where they take the place of the spine switches.';
  const ocsRows = [
    ['TPU v4: 4,096 chips in 64 racks', '48 OCSes join them', 'spec', { refs: [ref('google-tpuv4-ocs-paper', 'Section 2.2, Construction of the TPU v4 Supercomputer: "48 OCSes connect the 48 pairs of cables from 64 4^3 blocks (each 64 chips), yielding the desired total of 4096 TPU v4 chips"; "The 48 OCSes join eight rows together to form the complete 64-rack system."')] }],
    ['Packet switches for the same job, Google’s estimate', '568 InfiniBand switches', 'vendor', { refs: [ref('google-tpuv4-ocs-paper', 'Section 7.3, What if TPU v4 used IB versus OCS?: "To replace the 48 128-port OCSes, 4096 TPU v4s need 568 IB switches." (a full 3-level fat tree, following NVIDIA’s guidance)')], vs: 'the 48 OCSes that join the 4,096-chip TPU v4 system' }],
    ['Palomar OCS ports', '136 × 136: 128 in use + 8 spares', 'spec', { refs: [ref('google-tpuv4-ocs-paper', 'Section 2.2: "The Palomar OCS is 136×136 (128 ports plus 8 spares for link testing and repairs)"')] }],
    ['How it switches', '3D MEMS mirrors, in milliseconds', 'spec', { refs: [ref('google-tpuv4-ocs-paper', 'Section 2.1, Optical Circuit Switching: "based on 3D Micro-Electro-Mechanical Systems (MEMS) mirrors that switch in milliseconds. They employ circulators to send light both ways in a fiber, halving the number of required ports and cables."')] }],
    ['OCS power, reported', '≈108 W vs ≈3,000 W for a 136-port packet switch', 'reported', { refs: [ref('semianalysis-google-apollo-ocs', '"The Apollo switch uses only 108 watts of power consumption compared to a standard 136 port electrical packet switch (EPS), which would be in the 3,000 watts range."')] }],
    ['Jupiter data center network', 'an OCS layer replaces the spine', 'spec', { refs: [ref('google-jupiter-evolving-paper', 'Section 1, Introduction: OCSes "move Jupiter from a Clos to a block-level direct-connect topology that eliminates the spine switching layer and its associated challenges altogether"')] }],
  ];

  // PCIe/CXL retimers: no GB200 compute tray source shows any. The one report on the reference board says it needs
  // none between CPU, GPU and NIC, because the NIC sits on a mezzanine connector; so none are drawn, and this row says so.
  const gb200Retimers = ['PCIe retimers, CPU to GPU', 'none on the reference board', 'reported', { refs: [ref('semianalysis-gb200-hw', 'Compute Tray Diagrams & Cabling: "there is no longer any need for switches or retimers between the CPU and GPU on the reference design." Frontend Networking: with hyperscalers’ own backend NICs, "a dedicated PCIe switch from Broadcom / Astera Labs will be required"')] }];

  // The rack's management leads (src/scenes/rack-mgmt.js): NVIDIA's GB200 reference architecture names what joins the
  // out-of-band network and the switch; the lead per tray, its jack and its routing are drawn as representative.
  const mgmtLeadRows = [
    ['Out-of-band network, GB200 reference', 'every compute and switch tray’s management port, on SN2201 switches', 'spec', { refs: [ref('nvidia-superpod-gb200-network-fabrics', 'Out-of-Band Management Network: "The OOB management network use SN2201 switches"; "It connects the management ports of all devices including DGX GB200 compute trays, switch trays, and management servers, storage, networking gear, rack PDUs, and all other devices"; "The OOB network carries all IPMI related control traffic"')] }],
    ['Leads as drawn', 'one RJ45 copper lead per tray, to the 1 GbE ports', 'assumed', { assume: 'mgmt-tray-leads', refs: [ref('nvidia-sn2201-specs', 'Connector/Port Specifications: "48 RJ45 ports of 1GbE and 4 QSFP28 ports of 100GbE"')] }],
  ];

  // ---------- data-mode parts per scene. Positions come from each scene's dataHotspots ----------
  const PARTS_DATA = {
    across: [
      { id: 'dci', title: 'Line terminals', kicker: 'Coherent DWDM',
        body: 'At each campus, coherent transceivers—in routers or dedicated transponder shelves—each turn one signal into one wavelength, 800 Gb/s to 1.6 Tb/s. A multiplexer combines many of those wavelengths onto a single fiber pair; amplifier huts (next) carry the combined light between campuses, and a demultiplexer splits it back into wavelengths at the far end. This campus’s two routes leave by separate terminals on different sides, matching its two fiber entrances.',
        specs: [
          ['Per wavelength, WaveLogic 6', 'up to 1.6 Tb/s', 'spec', { refs: [['ciena-wavelogic6', 'product announcement: WaveLogic 6 family, up to 1.6 Tb/s per wavelength']] }],
          ['800G pluggable, e.g. Marvell COLORZ 800', '800 Gb/s to ≈500 km', 'spec', { refs: [['marvell-colorz-800', 'press release: "up to 800 Gbps of bandwidth for DCI links up to 500km"']] }],
          ['Field trial', '1.6 Tb/s over 1,100 km (Telstra)', 'reported', { refs: [['convergedigest-telstra-ciena-1100km', 'lead sentence: "Telstra has transmitted four 400GbE client services over a single 1.6 Tbps wavelength across approximately 1,100 km between Melbourne and Sydney"']] }],
          ['C+L band', 'about 2× capacity per fiber', 'reported', { refs: [['convergedigest-telstra-ciena-1100km', 'body text: expanding from C-band into L-band "effectively opens a second optical transmission band, increasing the usable spectrum"']] }],
          ['Inside a line terminal, e.g. Ciena 6500 RLS', 'mux/demux, ROADM and amplifier modules in compact shelves', 'spec', { refs: [['ciena-6500-rls-datasheet', 'module list: "ROADM with Line Amplifier (RLA) 12x1 C-band Module ... integrating twin 1x12 flexible grid WSS, EDFAs"; "Dual Line Amplifier (DLA) C-band module ... integrating bi-directional C-band EDFA line amplifiers"; "Raman Amplifier (SRA) C-band Module"; "Colorless Channel Mux/Demux (CCMD)"']] }],
          ['Mux/demux, e.g. Ciena CMD64', 'up to 64 channels on a 75 GHz grid', 'spec', { refs: [['ciena-6500-rls-datasheet', 'module list: "64-channel mux/demux (CMD64): 2RU 75GHz, C-band channel mux/demux for add/drop of up to 64 channels; including support for coherent pluggables"']] }],
        ] },
      { id: 'ila', title: 'Amplifier huts', kicker: 'Every 60–100 km',
        body: 'Small buildings along the route boost the light directly, in the optical domain, without converting it back to electricity or reading the data.',
        specs: [['Spacing', '≈80–100 km, rule of thumb', 'assumed', { assume: 'amplifier-spacing' }]] },
      { id: 'route', title: 'Fiber route', kicker: '≈5 milliseconds per 1,000 km, one way',
        body: 'Illustrative route: real campuses, an invented path between them. Light in glass covers about 200 km per millisecond one way, before any switching, routing or queueing delay. An illustrative 1,000 km route adds about 5 ms of propagation each way, roughly 10 ms round trip—fine for inference, hard for tightly synchronized training.',
        specs: [
          ['Speed in fiber', '≈4.9 µs per km, one way', 'derived', { calc: 'fiber-speed' }],
          ['1,000 km, propagation only', '≈5 ms one way, ≈10 ms round trip', 'derived', { calc: 'route-1000km-latency' }],
          ['Microsoft hollow-core fiber', '≈33% lower latency; over 1,200 km carrying live traffic', 'reported', { refs: [['microsoft-hollow-core-fiber', 'body text: hollow-core fiber "cutting latency by 33%" versus solid-glass fiber'], ['networkworld-hollow-core-fiber', 'article text: Microsoft’s pilot "involved over 1,200 km of fibre, now installed underground and actively carrying live traffic"']] }],
          ['Per fiber pair, C-band 800ZR', '32 × 800G = 25.6 Tb/s', 'reported', { refs: [['coherent-full-cband-pols', 'article text: "the enhanced POLS can support 32 DWDM wavelengths over a fiber pair," an "aggregate capacity of 25.6 Tbps"']] }],
        ] },
      { id: 'remote', title: 'Other campuses', kicker: 'One model, several sites',
        body: 'Builders now train single models across campuses, splitting the work so the slow links carry the least traffic. Google trains its largest models across campuses and metros; Microsoft links Fairwater sites about 700 miles apart.',
        specs: [
          ['Microsoft AI WAN fiber added', '120,000 miles', 'spec', { refs: [['microsoft-ai-wan', 'body text: "The company has deployed 120,000 miles of dedicated fiber for the network"']] }],
          ['NVIDIA Spectrum-XGS', 'nearly 2× NCCL across sites', 'vendor', { vs: 'NVIDIA’s own NCCL (Collective Communications Library) baseline, in geographically distributed multi-site clusters', refs: [['nvidia-spectrum-xgs', 'announcement text: "Spectrum-XGS Ethernet nearly doubles the performance of the NVIDIA Collective Communications Library"']] }],
          ['DeepMind Decoupled DiLoCo', '4 US regions over 2–5 Gb/s', 'reported', { refs: [['deepmind-decoupled-diloco', 'blog post: "We successfully trained a 12 billion parameter model across four separate U.S. regions using 2-5 Gbps of wide-area networking"']] }],
        ] },
      { id: 'home', title: site ? site.name : 'This campus', kicker: 'Go in', drill: 1,
        body: 'Go into the campus and follow the data in.',
        specs: [['GPUs', `≈${n0(GPUS)}`, 'derived', { calc: 'gpu-count-scenario' }]] },
    ],
    campus: [
      { id: 'fiber', title: 'Fiber entrances', kicker: 'Two diverse routes',
        body: 'Long-haul fiber enters at vaults on opposite sides of the site, so one backhoe cannot cut the campus off. Questions arrive and tokens leave the same way.',
        specs: [['Routes', '2 or more, physically separate', 'reported', evRefs([['trg-diverse-fiber-routes', '"A properly designed facility has dual fiber entrances. Fiber enters from two separate locations, following different physical paths into the building."']])]] },
      { id: 'dci', title: 'Line terminal hut', kicker: 'Coherent DWDM',
        body: 'Coherent transceivers here each produce or receive one wavelength, hundreds of gigabits to over a terabit; a multiplexer combines dozens of them onto each fiber pair bound for other campuses, and amplifiers along the route keep the combined signal alive without converting it back to electricity. The cutaway beside it shows the gear inside.',
        specs: [
          ['Per wavelength, Ciena WaveLogic 6', 'up to 1.6 Tb/s', 'spec', evRefs([['ciena-wavelogic6', 'press release: "transmission at rates of up to 1.6 Tbps via a single carrier"'], ['lightwaveonline-wavelogic6', 'coverage of the same announcement, same figure']])],
          ['400ZR reach, amplified', 'up to ≈120 km', 'reported', evRefs([['smartoptics-400zr-dci', 'knowledge-bank post: the 400ZR project focused on "400G Ethernet with amplified point-to-point DWDM links over DCI up to 120 KM"']])],
          ['Module power, 400ZR / 800ZR', '≈18–20 W / ≈23–25 W', 'reported', evRefs([['ascentoptics-coherent-power-consumption', 'guide: 400ZR modules "typically consume 18 to 20 W"; "one 800G link delivers the same capacity at 23 to 25 watts"']])],
        ] },
      { id: 'lineterm', title: 'Inside the line terminal', kicker: 'Cut away beside the hut',
        body: 'Opened up, the hut splits the work three ways. Coherent pluggables sit in the router’s own ports, each sending one wavelength. A passive mux/demux lays those wavelengths side by side on one fiber, each in its own slot of a fixed grid. A ROADM shelf with built-in amplifiers can add, drop or pass single wavelengths without turning the rest back into electricity, and amplifies the combined light before it leaves through the wall. The cutaway is drawn beside the hut so it reads on its own; its colors only tell the wavelengths apart, all of them infrared.',
        specs: [
          ['Coherent pluggables', 'one wavelength each, straight from a router port', 'spec', evRefs([['cisco-800g-zr-datasheet', 'overview: "Cisco 800G-capable coherent optics can transmit a single wavelength of 800G traffic directly from a router or switch port up to 120 km for 800ZR in a Data Center Interconnect (DCI) application"']])],
          ['Mux/demux, e.g. Ciena CMD64', '2RU, up to 64 channels on a 75 GHz C-band grid', 'spec', evRefs([['ciena-6500-rls-datasheet', 'module list: "64-channel mux/demux (CMD64): 2RU 75GHz, C-band channel mux/demux for add/drop of up to 64 channels; including support for coherent pluggables"']])],
          ['A 64 × 75 GHz grid, in frequency', '191.3625–196.0875 THz, ≈1,529–1,567 nm', 'reported', evRefs([['fs-64ch-cband-mux', 'product title: "64 Channels DWDM Mux Demux, Super C-band 75GHz 191.3625-196.0875THz"; wavelength = speed of light ÷ frequency']])],
          ['ROADM shelf drawn, Ciena 6500 RLS R8-300', '8 slots; 330 × 440 × 281 mm, 7.5U', 'spec', evRefs([['ciena-6500-rls-datasheet', 'Physical dimensions: "R8-300 8-slot shelf: 7.5U, 330 mm (H) x 440 mm (W) x 281 mm (D)"']])],
          ['Modules in that family', 'ROADM with line amplifier (WSS and EDFAs), dual line amplifier, Raman amplifier, colorless mux/demux', 'spec', evRefs([['ciena-6500-rls-datasheet', 'module list: "ROADM with Line Amplifier (RLA) 12x1 C-band Module ... integrating twin 1x12 flexible grid WSS, EDFAs"; "Dual Line Amplifier (DLA) C-band module ... integrating bi-directional C-band EDFA line amplifiers"; "Raman Amplifier (SRA) C-band Module"; "Colorless Channel Mux/Demux (CCMD)"']])],
          ['What a ROADM does', 'switches single wavelengths without converting the rest to electricity', 'reported', evRefs([['wikipedia-roadm', 'lead: "adds the ability to remotely switch traffic from a wavelength-division multiplexing (WDM) system at the wavelength layer ... without the need to convert the signals on all of the WDM channels to electronic signals and back again"']])],
          ['Racks, router, slot layout, port counts and fiber thickness as drawn', 'representative', 'assumed', evAssume('dwdm-terminal-rack')],
        ] },
      { id: 'border', title: 'Meet-me room and border switches', kicker: 'Where outside networks connect',
        body: 'Carriers’ fiber ends in a meet-me room, where outside networks cross-connect to the campus. Border switches then peer with those networks over BGP. NVIDIA calls this the edge network: it links the cluster’s services to networks outside it, while the GPU-to-GPU fabric stays inside.',
        specs: [['NVIDIA’s name for it', 'the edge network', 'spec', evRefs([['nvidia-missioncontrol-northsouth', '"Edge Network is the network that connects the SuperPOD to the customer’s network."']])],
          ['Meet-me room', 'where carriers physically interconnect', 'reported', evRefs([['wikipedia-meet-me-room', '"a place within a colocation center (or carrier hotel) where telecommunications companies can physically connect to one another"']])]] },
      ...(multiHall ? [
        { id: 'interhall', title: 'Hall-to-hall fiber', kicker: `One fabric, ${halls} buildings`,
          body: `Thousands of strands in the duct banks join the spines of every hall, so a single training job can span every GPU on the campus. Each link needs optics rated for its length. The two halls drawn here sit about 140 m apart at their spine ends, inside the 500 m of the same parallel-fiber DR optics used within a hall. Longer runs between buildings step up to FR4 (2 km) or LR4 (10 km), which put four wavelengths on one fiber pair, each carrying four-level PAM4 signals rather than the coherent ones used between campuses; DR and FR4 modules cannot be linked to each other.${extraHalls ? ' The plain hall blocks farther out are not routed here, so their link lengths are not modeled.' : ''}`,
          specs: [['Strands', 'tens of thousands per hall pair', 'derived', evCalc('campus-crosshall-fibers')],
            ['Drawn spine-to-spine route', '≈140 m between the halls, inside DR reach', 'assumed', evAssume('campus-crosshall-route')],
            ['DR, parallel fiber', '500 m, eight fibers on MPO-12/APC', 'spec', evRefs([['nvidia-linkx-interconnect', 'DR4 vs FR4 section: "DR4 (data center reach) supports up to 500 meters using four parallel channels over eight fibers with MPO-12/APC connectors"']])],
            ['FR4, e.g. NVIDIA MMS4X50-NM (2 × FR4)', '2 km, four wavelengths per 400G port, duplex LC', 'spec', evRefs([['nvidia-mms4x50-nm', 'specifications: product name "800Gbps Twin-port OSFP 2xFR4, 2x400Gb/s Single Mode, 2km"; connector "Single-mode Duplex LC PC"; four wavelengths per transmitter, 1264.5–1337.5 nm'], ['nvidia-linkx-interconnect', '"FR4 (far reach) supports up to two kilometers by multiplexing four channels of different laser wavelengths into a single fiber pair"; "DR4 is parallel and FR4 is multiplexed, so they can\'t be directly linked to each other"'], ['tiafotc-400gbase-fr4', '400GBASE-FR4, IEEE 802.3 clause 151 (first published as 802.3cu): "400 Gb/s wavelength-division multiplexed (WDM) PAM4 serial transmission over 2 single-mode optical fibers, with reach up to at least 2 km"']])],
            ['LR4, 400GBASE-LR4', '10 km, four wavelengths on one fiber pair', 'spec', evRefs([['ieee-802-3cu-lr4-baseline', 'adopted objective: "Define a four-wavelength 400 Gb/s PHY for operation over SMF with lengths up to at least 10 km"']])]] },
        { id: 'ductbank', title: 'Duct bank', kicker: 'Fiber between the halls, cut away',
          body: `Between buildings, fiber runs in 4-inch conduits cast in concrete, one high-count ribbon cable per conduit, with a spare row. In this layout half the spine-to-core links cross between halls: about ${kfmt(NET.crossHallFibers)} strands, or roughly ${n0(Math.ceil(NET.crossHallFibers / 6912))} cables of 6,912 fibers each.`,
          specs: [
            ['Strands crossing', `≈${kfmt(NET.crossHallFibers)}`, 'derived', evCalc('campus-crosshall-fibers')],
            ['Cable', '6,912-fiber ribbon fits a 2-inch duct', 'spec', evRefs([['prysmian-flexribbon', 'FlexRibbon whitepaper: "6,912 bend-insensitive fibres small enough to fit into a 50.8 mm/2-inch duct"']])],
            ['Duct-bank layout', 'general telecom practice', 'assumed', evAssume('ductbank-layout')],
          ] },
      ] : []),
      { id: 'hall', title: 'Data halls', kicker: 'Scale-out fabric inside', drill: 2,
        body: 'Inside, every GPU has its own optical port into a leaf-and-spine fabric.',
        specs: [['GPUs', `≈${n0(GPUS)}`, 'derived', evCalc('campus-gpu-count')]] },
      { id: 'longhaul', title: 'Long-haul route', kicker: 'Scale across', drill: 0,
        body: 'The fiber leaving the site runs to other campuses hundreds of kilometers away; the route drawn is illustrative, not a real carrier path.',
        specs: [['Light in fiber', '≈4.9 µs per km, one way', 'derived', evCalc('fiber-light-speed')]] },
    ],
    hall: [
      { id: 'odf', title: 'Fiber distribution frames', kicker: 'Where every link is patched',
        body: 'Fabric links do not run switch to switch in one piece. Trunk cables land on patch frames, and short jumpers make the actual connections, so a link can be moved without pulling cable through the ceiling.',
        specs: [['Fabric strands, whole campus', `≈${kfmt(NET.fibers)}`, 'derived', { calc: 'bom-network-count' }], ['Housing density, Corning EDGE8', '144 fibers per 1U', 'spec', { refs: [['corning-edge8', 'EDGE8-01U-SP product page: "Number of Modules: 18", "Fiber Capacity: 144" (18 modules × 8 fibers)']] }], ['4U housings for this campus', `≈${n0(NET.fibers / 576)}`, 'derived', { calc: 'hall-fiber-housings' }], ['Bay layout as drawn', 'representative', 'assumed', { assume: 'hall-odf-bay' }]] },
      ...(multiHall ? [{ id: 'crosshall', title: 'To the other halls', kicker: 'Through the floor', drill: 1,
        body: 'Cables for the links that cross buildings drop through a floor sleeve into the duct bank outside.',
        specs: [['Strands', `≈${kfmt(NET.crossHallFibers)}`, 'derived', { calc: 'hall-crosshall-strands' }]] }] : []),
      { id: 'pp', title: 'Pipeline stages', kicker: `One replica, four racks`,
        body: `The tinted rack tops show one way to lay a model out: its layers split into four stages, one rack each, passing activations down the line like an assembly line. 4 racks × ${A.gpusPerRack} GPUs = one copy of the model.`,
        specs: [['Traffic', 'point to point, per micro-batch', 'reported', { refs: [['meta-llama3-herd-parallelism', '§3.3.2, Parallelism for Model Scaling: activations pass point-to-point between pipeline stages']] }], ['Llama 3 405B', 'pipeline parallel 16', 'spec', { refs: [['meta-llama3-herd-parallelism', '§3.3.2, Table 4: 4D parallelism for 405B pretraining, TP=8, CP=16, PP=16, DP=8 on up to 16K H100 GPUs']] }], ['Layout drawn here', 'illustrative', 'assumed', { assume: 'hall-illustrative-layout' }]] },
      { id: 'dp', title: 'Data-parallel replicas', kicker: 'Many copies, one model',
        body: 'Every group of four racks holds another full copy. Each copy trains on different data, and all of them average their gradients across the fabric once per step.',
        specs: [['Traffic', 'large all-reduce, once per step', 'reported', { refs: [['meta-llama3-herd-parallelism', '§3.3.2, Parallelism for Model Scaling: data-parallel replicas synchronize gradients by all-reduce once per training step']] }], ['Llama 3 405B', 'TP 8 × CP 16 × PP 16 × DP 8 = 16,384 GPUs', 'spec', { refs: [['meta-llama3-herd-parallelism', '§3.3.2, Table 4: "Llama 3 405B is trained on up to 16K H100 GPUs" with TP=8, CP=16, PP=16, DP=8']] }], ['DeepSeek-V3', 'no tensor parallel; EP 64, PP 16, ZeRO-1 DP', 'spec', { refs: [['deepseek-v3-technical-report', '§3.2, Training Framework: "train DeepSeek-V3 without using costly Tensor Parallelism (TP)"; "applies 16-way Pipeline Parallelism (PP), 64-way Expert Parallelism (EP) spanning 8 nodes, and ZeRO-1 Data Parallelism (DP)"']] }]] },
      { id: 'uplinks', title: 'Rack uplinks', kicker: 'Where scale-out starts',
        body: `Each rack sends one optical link per GPU up into the fiber runway overhead: ${A.gpusPerRack} ports per rack before the first switch, ${nicShort} each.`,
        specs: [['Per GPU', nicTxt, nicSpecBasis, nicSpecEv], ['Ports per rack', `${A.gpusPerRack}`, 'spec', { refs: [[nvl ? 'nvidia-gb200-nvl72' : 'nvidia-dgx-h100', nvl ? 'NVL72 platform page: 72 GPUs per rack' : 'product page: 4 servers × 8 GPUs per rack']] }]] },
      { id: 'leaf', title: 'Leaf switches', kicker: 'Rail-optimized',
        body: `Network racks at the row ends hold leaf switches, ${A.nicGbps === 400 ? 'such as NVIDIA’s Quantum-2 QM9700 (InfiniBand)' : A.nicGbps === 800 ? 'such as NVIDIA’s Quantum-X800 Q3400 (InfiniBand) or Spectrum-X SN5600 (Ethernet)' : 'modeled here as Quantum-X800 InfiniBand on two 800G ports per GPU; Vera Rubin Ethernet installations can use a different fabric'}. In a rail-optimized layout, GPU number n in every rack plugs into the same leaf, so most traffic crosses only one switch.`,
        specs: [['Leaf switches, campus', `≈${n0(NET.leaf)}`, 'derived', { calc: 'bom-network-count' }], ['Hops, same rail', '1', 'assumed', { assume: 'rail-optimized-1hop' }], ['Switch hop, InfiniBand', 'under ≈100 ns; NVIDIA publishes none', 'assumed', { assume: 'ib-switch-hop-latency' }], [A.nicGbps === 400 ? 'Switch drawn, QM9700' : 'Switch drawn, Q3400', A.nicGbps === 400 ? '1U, 32 OSFP cages' : '4U, 72 OSFP cages', 'spec', { refs: A.nicGbps === 400 ? [['nvidia-quantum2-qm9700-specs', 'QM97xx specifications: 32 OSFP cages; 438 mm × 43.6 mm (1U) × 660 mm']] : [['nvidia-xdr-switch-specs', 'Q3400-RA: 4U (177.8 mm) × 438 mm × 850 mm'], ['nvidia-quantum-x800-switches', 'Q3400: 144 XDR ports over 72 OSFP cages']] }], ['Face arrangement', 'representative', 'assumed', { assume: 'hall-switch-faceplate' }]] },
      { id: 'spine', title: 'Spine switches', kicker: 'Any GPU to any GPU',
        body: `The spine connects every leaf to every other. Two tiers of ${NET.fabric.radix}-port switches reach about ${kfmt(NET.fabric.radix ** 2 / 2)} GPUs; this campus uses ${NET.tiers}${NET.planes > 1 ? `, in ${NET.planes} parallel planes` : ''}.`,
        specs: [['Switch', NET.fabric.switchName, A.nicGbps === 1600 ? 'assumed' : 'spec', A.nicGbps === 1600 ? { assume: 'rubin-nic-module' } : A.nicGbps === 400 ? { refs: [['nvidia-quantum2-qm9700-specs', 'QM97xx specifications: 32 OSFP cages, 25.6 Tbps total (64 logical 400G NDR ports)']] } : { refs: [['nvidia-xdr-switch-specs', 'Q32xx/Q34xx XDR 800Gb/s InfiniBand switch systems specifications']] }], ['Merchant switch chips, same role', 'Broadcom Tomahawk 6 (102.4 Tb/s), Marvell Teralynx 10 (51.2 Tb/s)', 'spec', { refs: [['broadcom-tomahawk6', 'page title: "Broadcom Now Shipping World’s First 102.4 Tbps Switch in Production Volume"'], ['marvell-teralynx10', 'press release: "a low power, programmable 51.2 Tbps Ethernet device"']] }], ['Spine + core switches', `≈${n0(NET.spine + NET.core)}`, 'derived', { calc: 'bom-network-count' }], [A.nicGbps === 400 ? 'Switch drawn, QM9700' : 'Switch drawn, Q3400', A.nicGbps === 400 ? '1U, 32 OSFP cages' : '4U, 72 OSFP cages', 'spec', { refs: A.nicGbps === 400 ? [['nvidia-quantum2-qm9700-specs', 'QM97xx specifications: 32 OSFP cages; 438 mm × 43.6 mm (1U) × 660 mm']] : [['nvidia-xdr-switch-specs', 'Q3400-RA: 4U (177.8 mm) × 438 mm × 850 mm'], ['nvidia-quantum-x800-switches', 'Q3400: 144 XDR ports over 72 OSFP cages']] }], ['Face arrangement', 'representative', 'assumed', { assume: 'hall-switch-faceplate' }]] },
      { id: 'storage', title: 'Storage and its network', kicker: 'A separate network',
        body: 'The GPU servers reach shared storage over a network of its own, apart from the GPU fabric. NVIDIA’s reference design takes storage from certified partners, reached over Ethernet with RDMA. A few storage racks stand in for it here; this model’s IT load counts the GPU racks and their fabric only.',
        specs: [['Separate networks, NVIDIA’s design', 'compute, storage, in-band and out-of-band management, besides NVLink', 'spec', evRefs([['nvidia-superpod-gb200-network-fabrics', 'the Network Fabrics page describes the NVLink fabric, the compute fabric, the storage fabric and network, the in-band and out-of-band management networks; storage: "The storage network embodies the performance for the high-speed storage while keeping the support for high availability."']])],
          ['Storage attach', 'RDMA over Ethernet (RoCEv2), a partner’s shared file system', 'spec', evRefs([['nvidia-superpod-gb200-components', '"High-Performance Storage is provided via RDMA over Converged Ethernet v2 (RoCEv2) connected storage from a DGX SuperPOD certified storage partner"']])]] },
      { id: 'control', title: 'Management and login servers', kicker: 'Where the cluster is run',
        body: 'A small set of ordinary CPU servers runs the cluster rather than the model: installing and monitoring every node, scheduling jobs, and giving users somewhere to log in. They sit on the in-band management network.',
        specs: [['In NVIDIA’s B300 design', '2 for Base Command Manager, 3 for Kubernetes, 2 Slurm login nodes', 'spec', evRefs([['nvidia-superpod-b300-management-servers', 'Management Server Quantities and Connectivity: "Base Command Manager in High Availability (HA): 2 Nodes"; "K8s Management Server: 3 Nodes"; "SLURM Login Nodes, 2 Nodes"']])]] },
      { id: 'runways', title: 'Fiber runways', kicker: 'Yellow means fiber',
        body: 'Overhead yellow trays carry thousands of fiber strands. A parallel optical link runs each lane on its own fiber, one each way, so strand counts climb fast.',
        specs: [['Fibers per link', `${NET.fabric.fibersPerLink}`, 'assumed', { assume: 'fibers-per-link' }],
          ...(A.nicPortGbps === 400 ? [['Multimode fiber jacket', 'aqua', 'spec', { refs: [['nvidia-mma4z00-ns400-datasheet', 'Introduction: "Multimode optics is denoted by a tan-colored pull tab and aqua-colored optical fiber."'], ['nvidia-mfp7e20-splitter', '§2 Application: "Multimode fibers use an industry standard Aqua fiber jacket color"']] }]] : []),
          ['Single-mode fiber jacket', 'yellow', 'spec', { refs: [['nvidia-mfp7e40-splitter', '§2 Application: "Single-mode fibers use an industry standard yellow fiber jacket color"']] }],
          ...(A.nicPortGbps === 400 ? [['Splitter cable reach', 'up to 50 m, through two patch panels', 'spec', { refs: [['nvidia-mfp7e20-splitter', 'Key Features: "50m max reach"; §2: "50-meter specification assumes two optical patch panels in the link with total of 4 optical connector junctions"'], ['nvidia-mfp7e40-splitter', 'Key Features: "Up to 50 m reach"']] }]] : []),
          ...(mmDrawn ? [['Aqua cables in this runway', 'representative', 'assumed', { assume: 'hall-multimode-breakout' }]] : [])] },
      { id: 'optics', title: 'Optical modules', kicker: 'Several per GPU', drill: 6, doorName: MT.label,
        body: `Every link is lit at both ends by a pluggable module, from merchant suppliers such as InnoLight and Coherent as well as NVIDIA’s own LinkX line. Here they fill the faces of the leaf switches at the row ends and of the spine switches, with a link light on each and fiber rising to the runway. ${A.nicsPerGpu} physical scale-out ${A.nicsPerGpu === 1 ? 'link leaves' : 'links leave'} the rack per GPU, and every tier above adds more modules: about ${(NET.modules / GPUS).toFixed(1)} per GPU, ${NET.opticsMW.toFixed(1)} MW for this campus.${A.nicPortGbps === 400 ? ' Runs this short can also be multimode: short-reach optics on aqua fiber, rated to 50 m on OM4.' : ''}${A.nicPortGbps === 400 ? ' A splitter (breakout) cable can also share one switch port between two adapters, each at half rate.' : ''}${mmDrawn ? ' One leaf switch here shows both: a tan-tabbed module sends two straight aqua cables to two racks, and the module beside it sends two 1:2 splitter cables to four. They are representative examples, not counted in the totals.' : ''} Go inside to open this scenario’s switch module: ${mtName}.`,
        specs: [...(A.nicPortGbps === 400 ? [
          ['At the switch: twin-port 800G OSFP, 2 × 400G', '17 W max', 'spec', { refs: [['nvidia-800g-dr8-datasheet', '§4.2, Recommended Operating Conditions and Power Supply Requirements: Maximum Power Dissipation, Max 17 W'], ['nvidia-mma4z00-ns', '"The 400G IB/EN switches require finned-top 2x400G transceivers for additional cooling"']] }],
          ['Short runs, multimode option', '2 × SR4, OM4 up to 50 m (OM3 30 m)', 'spec', { refs: [['nvidia-mma4z00-ns-specs', 'MMA4Z00-NS specifications: "Operating Distance (OM3) 2–30 m", "Operating Distance (OM4) 2–50 m"; two MPO-12/APC connectors']] }],
          ['Multimode light source', '850 nm VCSEL', 'spec', { refs: [['nvidia-mma4z00-ns400-datasheet', 'Key Features, MMA4Z00-NS400 (the single-port 400G SR4 adapter end): "850nm VCSEL"'], ['nvidia-mma4z00-ns-specs', 'MMA4Z00-NS transmitter and receiver tables: "Wavelength λC 844 850 863 nm"']] }],
          ['How multimode is marked', 'tan pull tab, aqua fiber', 'spec', { refs: [['nvidia-mma4z00-ns-specs', '"Tan pull-tab denotes multimode optics"'], ['nvidia-mma4z00-ns400-datasheet', 'Introduction: "Multimode optics is denoted by a tan-colored pull tab and aqua-colored optical fiber."']] }],
          ['1:2 splitter cables', 'one 4-channel MPO-12 port to two 2-channel ends, 200G each', 'spec', { refs: [['nvidia-mfp7e20-splitter', 'Introduction: "a multimode, 4-channel-to-two 2-channel splitter fiber cable"; "The 2-channel ends are inserted into two, single-port 400Gb/s OSFP and/or QSFP112 transceivers which with only 2 fibers can output 200G rates"'], ['nvidia-mfp7e40-splitter', 'Introduction: the single-mode version, the same 4-channel-to-two 2-channel split']] }],
          ['Twin-port module with two splitters', 'one switch cage to four 200G adapters', 'spec', { refs: [['nvidia-mfp7e20-splitter', 'Introduction: "Two splitter fiber cables are used in the twin-port OSFP transceiver enabling four, 2-channel ends to four transceivers"; the typical use is "linking OSFP switches to" ConnectX-7 adapters and/or BlueField-3 DPUs'], ['nvidia-mma4z00-ns400-datasheet', '§2.1 Connectivity Scenarios, 200Gb/s mode: "This case creates links to four 200Gb/s ConnectX-7/OSFP adapter cards"']] }],
          ['Adapter module on a splitter end', '2 lanes lit, 200G; ≈5.5 W typical instead of 8 W', 'spec', { refs: [['nvidia-mma4z00-ns400-datasheet', '§2.1.1 Use cases: two-fiber ends "only activate two of the lanes in the 400G transceiver creating a 200G device and automatically reduces the power consumption of only the 400G transceivers from 8 Watts typical to 5.5 Watts typical"']] }],
          ['Straight and split on one module', 'not mixed: both ports straight, or both split', 'spec', { refs: [['nvidia-mma4z00-ns400-datasheet', '§2.1: both fibers in the twin-port transceiver "must be the same type - straight or splitter and cannot be mixed"'], ['nvidia-mfp7e20-splitter', '§2 Application: twin-port transceivers "must use the same fiber type in both MPO-12/APC ports (straight or 1:2 splitter) and cannot be mixed"']] }],
          ...(mmDrawn ? [['Aqua straight links and splitters at one leaf, as drawn', 'representative', 'assumed', { assume: 'hall-multimode-breakout' }]] : []),
        ] : A.id !== 'rubin' && A.nicPortGbps === 800 ? [
          ['At the switch: twin-port 1.6T OSFP, 2 × DR4', 'Quantum-X800', 'spec', { refs: [['nvidia-quantum-x800-clusters', 'transceiver list: "NVIDIA twin port transceiver, 1600Gbps, OSFP 2xDR4, 2xMPO APC, 1310nm SMF", platform: switch']] }],
          ['Its power', '33.5 W max', 'spec', { refs: [['nvidia-mms4a00', 'product summary: "33.5W max power"; "Used in Quantum-3 air-cooled and liquid-cooled switch"']] }],
        ] : [
          // Vera Rubin: the switch module type is unpublished, so no NVIDIA part or power figure is quoted for it
          ...(() => { const n = nicPerGpuEv(); return [['Scale-out per GPU', `${nicTxt} aggregate`, n.basis, n.ev]]; })(),
          ['Links per GPU, modeled', '2 × 800 Gb/s', 'assumed', { assume: 'rubin-nic-module' }],
          ['At the switch: OSFP 1.6T', 'exact type unpublished; drawn as the 1.6T twin-port class', 'assumed', { assume: 'module-follows-scenario' }],
        ]), ['The DSP inside each module', 'e.g. Marvell Ara, Broadcom Sian, Credo Bluebird', 'spec', { refs: [['marvell-ara-1p6t-portfolio', 'Marvell’s own 1.6T optical DSP portfolio announcement'], ['broadcom-sian3-200g-lane-dsp', 'Broadcom’s own Sian3 200G-lane DSP announcement'], ['credo-bluebird-dsp', 'Credo’s own Bluebird 1.6T optical DSP product page']] }], ['Linear-drive (LPO), Semtech target', 'about 10 W versus 23–25 W retimed', 'vendor', { vs: 'Semtech’s 200G-lane discussion: target linear-module power versus current retimed modules, not a universal measured saving', refs: [['semtech-200g-lpo-power-blog', '"200G LPO Power, Reach and Loss: Real Numbers" -- Semtech’s own published LPO-vs-DSP power comparison']] }]] },
      { id: 'cpo', title: 'Co-packaged optics', kicker: 'A comparison, not deployed here', drill: 7, trip: 'cpo',
        body: 'This scenario does not deploy CPO: none of its switches, power or fiber counts change because of this card. One extra switch stands apart at the end of the spine row as a schematic stand-in for the alternative, a CPO switch modeled on NVIDIA’s Spectrum-X/Quantum-X Photonics switches, for comparison only. CPO is a kind of switch, not an add-on: a fabric that adopts it uses CPO switches in place of pluggable ones, which is why this one is set apart rather than drawn in the row. Real CPO switches put the optical engines on (or beside) the switch package itself, shortening the electrical path to the optical engines and cutting out the pluggable modules, which changes both signal-processing needs and electrical losses; it is not simply "every removed block is saved power." Fewer lasers, from sharing external laser sources across ports, is also not the same claim as fewer traffic fibers: CPO does not by itself reduce how many fibers carry data. Every switch actually counted in this hall still takes pluggables, as most fabrics do today.',
        specs: [['NVIDIA Quantum-X / Spectrum-X Photonics', '5× power efficiency, 4× fewer lasers, not fewer fibers (Aug. 2026 reporting; NVIDIA’s own March 2025 launch claimed 3.5×)', 'vendor', { refs: [['storagereview-nvidia-cpo-production', '"5x lower power consumption" and "4x fewer lasers" vs. conventional pluggable-optics switches, 08/15/2026'], ['nvidia-spectrum-x-cpo', 'launch announcement: "4x fewer lasers to deliver 3.5x more power efficiency... compared with traditional methods", 03/18/2025'], ['nvidia-cpo-industry-collaboration-blog', '08/26/2025 post restates "reducing the total number of lasers in the data center by a factor of four compared to legacy designs" but not a power-efficiency multiplier']], vs: 'conventional switches using pluggable optical transceivers' }], ['Broadcom Davisson', '102.4 Tb/s, ≈3.5 W per 800G port', 'vendor', { refs: [['broadcom-tomahawk6', 'page title: "Broadcom Now Shipping World’s First 102.4 Tbps Switch in Production Volume" -- Davisson is Broadcom’s CPO variant built on this same Tomahawk 6 ASIC (per nextplatform-broadcom-cpo)'], ['nextplatform-broadcom-cpo', '"An 800 Gb/sec port will burn about 3.5 watts, says Broadcom, which is 36.4 percent lower than with the Tomahawk 5 CPO port at the same bandwidth and more than 70 percent lower than pluggable optics at the same bandwidth"']], vs: 'Broadcom’s prior-generation Tomahawk 5 CPO port and pluggable optics, both at 800 Gb/s' }], ['Stand-in faceplate, Q3450 counts', '144 MPO, 18 laser modules, 4 capped UDQ4 ports', 'reported', { refs: [['lambda-q3450-unboxing', 'front panel: 144 MPO optical connectors; "The switch supports 18 removable external light-source modules"; "four UDQ4 liquid cooling connections"']] }], ['Faceplate layout', 'representative', 'assumed', { assume: 'hall-cpo-faceplate' }], ['Where CPO ships today', 'standalone switches like this stand-in, from NVIDIA and Broadcom', 'reported', { refs: [['trendforce-cpo-ramp-2026', `first paragraph: "NVIDIA has begun shipping its next-generation Spectrum-X CPO switch to select partners. Meanwhile, Broadcom is continuing limited shipments of its 51.2T Bailly CPO switch"`], ['nvidia-vera-rubin-production-2026', 'body: Spectrum-X Ethernet Photonics, "the world’s first co-packaged-optics (CPO)-based switches with 200Gb/s SerDes — now in production"']] }]] },
      { id: 'racks', title: nvl ? 'NVL72 racks' : 'DGX H100 racks', kicker: 'Scale-up stays inside', drill: 3,
        // each way to each way (NVLink's vendor-quoted figure is bidirectional; a NIC's line rate already isn't),
        // the same basis engine.ts's bandwidth staircase compares on (issue 9) — not NVLink's aggregate over the
        // NIC's per-direction rate, which would silently double this ratio.
        body: nvl
          ? `Inside each rack, 72 GPUs talk over copper NVLink, ${Math.round(A.nvlink.tbs * 4000 / A.nicGbps)} times faster each way than the fabric outside.`
          : `Inside each server, 8 GPUs talk over NVLink, ${Math.round(A.nvlink.tbs * 4000 / A.nicGbps)} times faster each way than the fabric outside. Between servers, even in the same rack, it is all fabric.`,
        specs: [['NVLink per GPU', nvlTB, 'spec', A.id === 'rubin' ? nvlPerGpuEv().ev : { refs: [[A.id === 'h100' ? 'nvidia-h100-datasheet' : 'nvidia-blackwell-platform-arrives', A.id === 'h100' ? 'H100 datasheet: 900 GB/s NVLink bandwidth per GPU' : 'Blackwell platform launch release: "the latest iteration of NVIDIA NVLink delivers groundbreaking 1.8TB/s bidirectional throughput per GPU" (the NVL72 product page itself states only the 130 TB/s system aggregate, not a per-GPU figure)']] }], ['Domain', `${A.nvlink.domain} GPUs`, 'spec', { refs: [[nvl ? 'nvidia-gb200-nvl72' : 'nvidia-dgx-h100', nvl ? 'NVL72 platform page: all 72 GPUs in one NVLink domain' : 'product page: 8 GPUs share one NVLink domain per DGX H100 baseboard']] }]] },
    ],
    rack: nvl ? [
      { id: 'tp', title: 'Tensor + expert parallel', kicker: 'The chattiest work lives here',
        body: 'Inside one rack a model layer’s math is split across GPUs, or its experts are spread across as many as its 72 GPUs. The GPUs trade partial results inside every layer, which only NVLink is fast enough for.',
        specs: [['Traffic', 'every layer, many times per token', 'reported', { refs: [ref('meta-llama3-herd-parallelism', 'describes tensor-parallel GPUs exchanging activations inside every transformer layer, many times per forward/backward pass')] }], ['Llama 3 405B, H100', 'tensor parallel 8, inside each server', 'spec', { refs: [ref('meta-llama3-herd-parallelism', 'training section: 405B model trained with tensor parallelism 8')] }], ['NVL72 wide expert parallel', 'up to 72 GPUs, the NVLink domain', 'reported', { refs: [ref('nvidia-gb200-dynamo-moe', 'blog: "The NVLink domain can now support up to 72 NVIDIA Blackwell GPUs"; its own DeepSeek R1 example spreads 256 routed experts across 64 of those GPUs, not all 72')] }]] },
      { id: 'nvswitch', title: 'NVLink switch trays', kicker: 'Scale-up: one domain',
        body: 'Nine switch trays connect all 72 GPUs. One of the nine is pulled out for inspection; highlighted connections across that display gap are schematic, not exposed physical cables.',
        specs: (() => { const l = nvl72LayoutEv(), b = nvlPerGpuEv(); return [['Trays', A.id === 'rubin' ? '9, 4 switch chips each (36)' : '9, 2 switch chips each (18)', l.basis, l.ev], ['Per GPU', `${A.nvlink.gen}, ${nvlTB}`, b.basis, b.ev]]; })() },
      { id: 'spine', title: 'NVLink spine', kicker: 'Copper, not light',
        body: A.id === 'rubin' ? 'Four cable cartridges carry roughly 5,000 copper cables between compute and NVLink switch trays. This view represents their connectivity, not the individual lane routing or signal-conditioning electronics.' : 'Cable cartridges down the back carry more than 5,000 copper connections between compute and switch trays. Their physical routing is represented schematically; this is separate from the optical scale-out fabric.',
        specs: A.id === 'rubin' ? [['Cable cartridges', '4, roughly 5,000 copper cables', 'spec', { refs: [ref('nvidia-vera-rubin-pod-blog', 'Streamlined rack design: four copper cable cartridges, roughly 5,000 cables spanning two miles.')] }]] : [['Links', 'more than 5,000', 'spec', { refs: [ref('nvidia-gb200-ocp', '"These cartridges accommodate over 5,000 active copper cables"')] }], ['Power saved vs optics, NVIDIA', '≈20 kW per rack', 'vendor', { refs: [ref('semianalysis-nvl72-optics', 'quotes Jensen Huang: copper NVLink saves roughly 20 kW per rack vs an equivalent optical scale-up fabric')], vs: 'an equivalent NVL72-scale optical scale-up fabric' }], ['Passive copper reach at 224G', '≈1 m', 'reported', { refs: [ref('ieee-8023dj-electrical-adhoc', 'IEEE 802.3dj electrical ad hoc contribution on copper reach objectives at 224 Gb/s PAM4')] }]] },
      { id: 'optical', title: 'Copper and optical fabrics', kicker: 'Scale-up versus scale-out',
        body: ocsBody,
        specs: [['Ironwood superpod', '9,216 chips, 144 cubes of 64', 'spec', { refs: [ref('google-ironwood-codesign', '"a small ‘pod’ (e.g., a 256-chip Ironwood pod with four cubes) to a massive ‘superpod’ (e.g., a 9,216-chip system with 144 cubes)"; each cube is "64 Ironwood chips"')] }], ['ICI per chip, inside a cube', '1.2 TB/s; mostly copper', 'reported', { refs: [ref('google-ironwood-tpu', '"linked via a breakthrough Inter-Chip Interconnect (ICI) network operating at 9.6 Tb/s" (= 1.2 TB/s); Google’s own pages do not state the link medium'), ref('semianalysis-tpuv7-ironwood', 'reports that ICI links interior to the 4×4×4 cube run over direct-attached copper (DAC) cables, while chips at the cube’s face/edge/corner use optical transceivers instead')] }], ...ocsRows] },
      { id: 'uplinks', title: 'Scale-out ports', kicker: 'Beyond the NVLink domain',
        body: (A.id === 'rubin' ? 'Eight 800 Gb/s compute-fabric cages sit on the front of each four-GPU tray.' : 'Four compute-fabric OSFP cages sit on the front of each tray, one per GPU.') + ' The narrower QSFP cages serve storage and in-band networking. A subset of OSFP modules and patch leads is populated here for visibility; this is not a complete cabling plan. The NVLink switch trays connect through rear copper, not these optics.',
        specs: (() => { const n = nicPerGpuEv(); return [[A.id === 'rubin' ? 'Physical links, modeled' : 'Ports', A.id === 'rubin' ? '144 × 800 Gb/s' : '72', A.id === 'rubin' ? 'assumed' : 'reported', A.id === 'rubin' ? { assume: 'rubin-nic-module' } : { refs: [ref('semianalysis-nvl72-optics', 'describes NVL72’s scale-out network as 72 OSFP ports, one per GPU')] }], ['Aggregate per GPU', nicTxt, n.basis, n.ev]]; })() },
      { id: 'compute', title: 'Compute trays', kicker: '4 GPUs each', drill: 4,
        body: 'Each tray is where the networks meet: copper NVLink at the back, pluggable scale-out and storage optics at the front, and CPU links inside. One tray is extended in an illustrative service position so its interior is visible; it is not an operating configuration.',
        specs: (() => { const l = nvl72LayoutEv(); return [['GPUs', '4', l.basis, l.ev]]; })() },
      { id: 'mgmt', title: 'Management switch', kicker: 'Out-of-band',
        body: 'A small copper switch at the top runs the rack’s management network: firmware, sensors and power control, separate from the fabrics that move model data.',
        specs: [['Rate', '1–10 GbE class', 'assumed', { assume: 'bmc-network-speed' }], ['TOR switches', '2', 'spec', { refs: [ref('nvidia-dgx-gb200-hardware', 'Hardware: "2x TOR Switches for management"')] }], ...mgmtLeadRows, ['Ports as drawn', '48 × 1 GbE + 4 × 100 GbE', 'assumed', { assume: 'tor-switch-ports', refs: [ref('nvidia-sn2201-specs', 'Connector/Port Specifications: "48 RJ45 ports of 1GbE and 4 QSFP28 ports of 100GbE"')] }], ['Free units above', 'cable manager + blanking panels', 'assumed', { assume: 'rack-elevation-fill' }]] },
    ] : [
      { id: 'tp', title: 'Tensor parallel', kicker: 'Inside one server',
        body: 'The chattiest work, splitting each layer’s math, has to fit inside one 8-GPU server. That is why Llama 3 405B ran tensor parallel 8 on H100: eight was the whole NVLink domain.',
        specs: [['Llama 3 405B, H100', 'tensor parallel 8, inside each server', 'spec', { refs: [ref('meta-llama3-herd-parallelism', 'training section: 405B model trained with tensor parallelism 8')] }], ['NVLink domain', '8 GPUs', 'spec', { refs: [ref('nvidia-dgxh100-user-guide', 'Component Descriptions: 8 GPUs joined by "4 x 4th generation NVLinks"')] }]] },
      { id: 'servers', title: 'DGX H100 servers', kicker: '4 NVLink islands per rack', drill: 4,
        body: 'Four servers, four separate NVLink domains. GPUs in different servers of the same rack talk through the leaf switch, like any other rack.',
        specs: [['NVLink per GPU', '900 GB/s', 'spec', { refs: [ref('nvidia-h100-product-page', 'spec table: "NVLink | 900GB/s"')] }]] },
      { id: 'uplinks', title: 'Scale-out ports', kicker: '32 per rack',
        body: 'Each DGX H100 server has four twin-port OSFP cages at the rear: eight 400 Gb/s compute links in total. Flat-top modules fit under the cages’ riding heat sinks. Separate QSFP cages serve storage and in-band networking. Only a subset is populated here so the modules and fiber patch leads remain visible.',
        specs: [['Per GPU', '400 Gb/s', 'spec', { refs: [ref('nvidia-dgxh100-user-guide', 'Component Descriptions: "4 x OSFP ports for 8 x NVIDIA ConnectX-7 Single Port" cards, "Up to 400Gbps"')] }], ['Ports per rack', '32', 'derived', { calc: 'count-per-rack', refs: [ref('nvidia-dgxh100-user-guide', '8 ConnectX-7 ports per server × 4 servers per rack')] }]] },
      { id: 'optical', title: 'Copper and optical fabrics', kicker: 'Scale-up versus scale-out',
        body: ocsBody,
        specs: [['Ironwood superpod', '9,216 chips, 144 cubes of 64', 'spec', { refs: [ref('google-ironwood-codesign', '"a small ‘pod’ (e.g., a 256-chip Ironwood pod with four cubes) to a massive ‘superpod’ (e.g., a 9,216-chip system with 144 cubes)"; each cube is "64 Ironwood chips"')] }], ['ICI per chip, inside a cube', '1.2 TB/s; mostly copper', 'reported', { refs: [ref('google-ironwood-tpu', '"linked via a breakthrough Inter-Chip Interconnect (ICI) network operating at 9.6 Tb/s" (= 1.2 TB/s); Google’s own pages do not state the link medium'), ref('semianalysis-tpuv7-ironwood', 'reports that ICI links interior to the 4×4×4 cube run over direct-attached copper (DAC) cables, while chips at the cube’s face/edge/corner use optical transceivers instead')] }], ...ocsRows] },
      { id: 'mgmt', title: 'Management switch', kicker: 'Out-of-band',
        body: 'A small copper switch at the top runs the rack’s management network, separate from the fabrics that move model data.',
        specs: [['Rate', '1–10 GbE class', 'assumed', { assume: 'bmc-network-speed' }], ['Ports as drawn', '48 × 1 GbE + 4 × 100 GbE', 'assumed', { assume: 'tor-switch-ports', refs: [ref('nvidia-sn2201-specs', 'Connector/Port Specifications: "48 RJ45 ports of 1GbE and 4 QSFP28 ports of 100GbE"')] }], ['Free units above', 'cable manager + blanking panels', 'assumed', { assume: 'rack-elevation-fill' }]] },
    ],
    tray: nvl ? [
      { id: 'nvconn', title: 'NVLink connectors', kicker: `${A.nvlink.gen}`,
        body: 'Each GPU’s NVLink links leave the back of the tray and mate with the copper spine when the tray is pushed home.',
        specs: (() => { const b = nvlPerGpuEv(); return [['Per GPU', nvlTB, b.basis, b.ev]]; })() },
      { id: 'c2c', title: 'NVLink-C2C', kicker: 'CPU to GPU',
        body: `Each ${X.cpu} CPU talks to its GPUs over a coherent chip-to-chip link, so the GPUs can use CPU memory as a slower extension of their own.`,
        specs: A.id === 'rubin'
          ? [['Bandwidth', X.c2c, 'spec', { refs: [ref('nvidia-vera-rubin-current-specs', 'Superchip column: 1.8 TB/s NVLink-C2C bandwidth.')] }]]
          : [['Bandwidth', X.c2c, 'assumed', { assume: 'grace-gpu-c2c-bandwidth', refs: [ref('nvidia-grace-cpu-page', '"The Grace CPU Superchip is composed of two Grace CPUs connected coherently over NVIDIA NVLink-C2C at 900 GB/s" — Grace-to-Grace, not Grace-to-GPU'), ref('nvidia-grace-hopper-superchip', '"900 gigabytes per second (GB/s) of coherent interface" for the Grace-to-Hopper CPU-to-GPU link, one generation earlier')] }]] },
      { id: 'cx', title: 'SuperNICs', kicker: A.id === 'rubin' ? 'Eight per tray' : 'Four per tray',
        body: A.id === 'rubin' ? 'Two front networking assemblies carry eight ConnectX-9 SuperNICs in total. They provide the four GPUs with scale-out connectivity through the PCB midplane; the quoted per-GPU bandwidth is aggregate, not a count of physical NICs.' : `Four ${X.nic} interfaces carry the four GPUs’ scale-out traffic, allowing communication with other racks without passing through the CPU.`,
        specs: (() => { const n = nicPerGpuEv(); return [['NIC', X.nic, n.basis, n.ev], ['Per GPU', X.nicNote, n.basis, n.ev], ...(A.id === 'gb200' ? [gb200Retimers] : [])]; })() },
      // the tray's own modules: a single-port module per NIC port; the twin-port module that carries two of these
      // links sits at the switch end (the one opened up in the module diagram)
      { id: 'osfp', title: 'Optical modules', kicker: 'Electrons become light', drill: 6, trip: 'module',
        doorName: MT.label,
        body: (A.nicGbps === 400
          ? 'Pluggable modules at the front turn the NIC’s electrical signal into light. Each 400G port takes a 400G module; at the switch end, one twin-port module carries two of these links.'
          : A.nicGbps === 800
            ? 'Pluggable modules at the front turn the SuperNIC’s electrical signal into light. NVIDIA lists a single-port 800G module for ConnectX-8, four lanes each way; at the switch end, one twin-port 1.6T module carries two of these links.'
            : 'Eight modeled 800 Gb/s optical links serve the four GPUs, giving each GPU 1.6 Tb/s aggregate scale-out bandwidth. The selected InfiniBand fabric and module mechanics are representative; the eight ConnectX-9 devices per tray are documented.'
        ) + ` Go inside opens the switch-end module, ${mtName}, not the module in these NIC cages.`,
        specs: [...(A.id === 'gb300' ? [['Cages', '4 OSFP on 2 OSFP boards, cabled from the CX8 boards', 'spec', { refs: [ref('lenovo-gb300-guide', 'compute tray slots: "Two PCIe Gen5 x16 Slot (OSFP Boards)"; Figure 5 labels "Bottom 2x OSFP Boards"')] }], ['Cable path', 'representative', 'assumed', { assume: 'tray-nic-cage-cabling' }]]
          : A.id === 'gb200' ? [['NIC to cage', 'DensiLink flyover cables', 'reported', { refs: [ref('semianalysis-gb200-hw', '"The electrical lanes are routed to the OSFP cages at the front of the chassis with DensiLink connectors from the mezzanine board."')] }], ['Cable path', 'representative', 'assumed', { assume: 'tray-nic-cage-cabling' }]] : []), ...(A.nicGbps === 400
          ? [['A 400G module, e.g.', 'NVIDIA single-port 400G OSFP, DR4', 'spec', { refs: [ref('nvidia-mms4x00-ns400', 'specifications: single-port 400G OSFP DR4 transceiver')] }], ['Its power', '9 W max', 'spec', { refs: [ref('nvidia-mms4x00-ns400', 'specifications table: "Maximum Power consumption (400G)", 9 W')] }]]
          : A.nicGbps === 800
            ? [['At the SuperNIC', 'single-port 800G OSFP, DR4', 'spec', { refs: [ref('nvidia-quantum-x800-clusters', 'transceiver list: "NVIDIA single port transceiver, 800Gbps, OSFP DR4, MPO, APC 1310nm SMF", platform: NIC')] }], ['At the switch', 'twin-port 1.6T OSFP, 2 × DR4', 'spec', { refs: [ref('nvidia-quantum-x800-clusters', 'transceiver list: "NVIDIA twin port transceiver, 1600Gbps, OSFP 2xDR4", platform: switch')] }]]
            : [['Module links, modeled', '8 × 800 Gb/s per tray; 2 per GPU', 'assumed', { assume: 'rubin-nic-module', refs: [ref('nvidia-vera-rubin-pod-blog', 'Compute tray: eight ConnectX-9 SuperNICs, four Rubin GPUs; 1.6 Tb/s aggregate scale-out per GPU.')] }]])] },
      { id: 'dpu', title: 'BlueField DPU', kicker: 'Front-end network',
        body: `A separate network carries user requests, storage and management. This tray has ${A.dpusPerTray} ${A.id === 'rubin' ? 'BlueField-4' : 'BlueField-3'} ${A.dpusPerTray === 1 ? 'DPU' : 'DPUs'} to offload network, storage and security work.`,
        specs: [['DPUs per tray', String(A.dpusPerTray), 'spec', { refs: [ref(A.id === 'rubin' ? 'nvidia-vera-rubin-pod-blog' : A.id === 'gb300' ? 'nvidia-dgx-gb300' : 'nvidia-dgx-gb200-hardware', A.id === 'rubin' ? 'Compute tray includes one BlueField-4.' : A.id === 'gb300' ? '18 BlueField-3 DPUs across 18 compute trays.' : 'Compute tray includes two BlueField-3 DPUs.')] }], A.id === 'rubin'
          ? ['BlueField-4', 'up to 800 Gb/s', 'vendor', { refs: [ref('nvidia-bluefield4-blog', '"800Gb/s throughput" stated in the launch blog’s subtitle')], vs: 'BlueField-3’s 400 Gb/s' }]
          : ['BlueField-3', 'up to 400 Gb/s', 'spec', { refs: [ref('nvidia-bf3-networking-docs', '"BlueField-3 offers speeds up to 400 gigabits per second (Gb/s)"')] }],
          ['Role', 'storage, security, tenant networking', A.id === 'rubin' ? 'vendor' : 'spec', A.id === 'rubin'
            ? { refs: [ref('nvidia-bluefield4-blog', '"software-defined acceleration across AI data storage, networking and security"')], vs: 'the host CPU handling these functions directly' }
            : { refs: [ref('nvidia-bf3-networking-docs', 'describes BlueField-3 offloading "software-defined networking, storage, security, and management functions"')] }]] },
      { id: 'gpu', title: X.gpus, kicker: 'Where the links begin', drill: 5,
        body: A.id === 'rubin' ? 'NVLink leaves the GPU for the rack’s copper spine. For scale-out, the path crosses NVLink-C2C to Vera, then PCIe to the ConnectX-9 NICs, and electrical SerDes to the front optical modules.' : 'Every one of these links starts at the edge of the GPU dies.',
        specs: A.id === 'rubin' ? [['Scale-out path', 'GPU → Vera → ConnectX-9 → optics', 'spec', { refs: [ref('nvidia-rubin-superpod-topology', 'Figure 2: C2C from GPUs to CPUs; PCIe from CPUs to eight ConnectX-9 NICs.')] }]] : [['Links per GPU', 'NVLink, C2C, PCIe to the NIC', 'reported', { refs: [ref('nvidia-nvl72-reference-arch', 'describes each compute tray’s GPU connecting out over NVLink to the spine, NVLink-C2C to its CPU, and PCIe to its NIC')] }]] },
    ] : [
      { id: 'nvswitch', title: 'NVSwitch chips', kicker: 'Scale-up, on the board',
        body: 'NVLink runs in the baseboard’s copper traces from each GPU to four NVSwitch chips at the back of the board. No cables: the whole domain fits on one board.',
        specs: [['Per GPU', '18 links, 900 GB/s', 'spec', { refs: [ref('nvidia-h100-product-page', 'spec table: "NVLink | 900GB/s"')] }], ['Switch chips', '4', 'spec', { refs: [ref('nvidia-dgxh100-datasheet', 'specifications table: "NVSwitch™ 4x"')] }]] },
      { id: 'midplane', title: 'Midplane', kicker: 'GPU tray to motherboard tray',
        body: 'Each GPU’s PCIe leaves the front of the baseboard, crosses the midplane and comes back into the motherboard tray’s interposer board, to its own ConnectX-7. The drives at the front come in through it too.',
        specs: [['GPU PCIe', 'to the GPU tray through the midplane', 'spec', { refs: [ref('nvidia-dgxh100-user-guide', 'Network Modules figure: "PCIe Connections to GPU tray through midplane"; Network Modules: "Interposer board connects to CPUs on one end and to GPU tray on the other"')] }], ['Disconnects with', 'the motherboard tray’s ejection levers', 'spec', { refs: [ref('nvidia-dgxh100-service-manual-mbtray-common', 'Preparing the Motherboard for Service: "Pull the ejection levers to disengage the midplane connectors"')] }], ['Carries', 'power, PCIe, sensors, signaling', 'spec', { refs: [ref('nvidia-dgxh100-user-guide', 'Motherboard Tray Components and GPU Tray Components figures: "Midplane connectivity Power, PCIe, sensors and signaling communications"')] }], ['Traces and openings as drawn', 'representative', 'assumed', { assume: 'dgx-h100-internal-layout' }]] },
      { id: 'cx', title: 'ConnectX-7 NICs', kicker: 'One per GPU',
        body: 'Eight single-port 400 Gb/s ConnectX-7, one for each GPU, on two network modules at the front of the motherboard tray. Each also links to a CPU.',
        specs: [['Per GPU', '400 Gb/s', 'spec', { refs: [ref('nvidia-dgxh100-user-guide', 'Component Descriptions: "4 x OSFP ports for 8 x NVIDIA ConnectX-7 Single Port" cards, "Up to 400Gbps"')] }], ['Modules', '2, four ConnectX-7 each', 'spec', { refs: [ref('nvidia-dgxh100-user-guide', 'Network Modules: "Consolidates four ConnectX-7 networking cards into a single device"; "Two networking modules are installed on interposer board"')] }]] },
      { id: 'osfp', title: 'Twin-port optical cages', kicker: 'Electrons become light', drill: 6, trip: 'module', doorName: MT.label,
        body: 'Four cages in the middle of the motherboard tray’s rear each hold one 800G twin-port module carrying two 400G links; a DensiLink cable brings each pair of ports from the network modules. The server takes the flat-top version of the module; the switches take the same module with cooling fins. Go inside opens the finned switch-side version.',
        specs: [['Cages', '4, 2 × 400G each', 'spec', { refs: [ref('nvidia-dgxh100-user-guide', 'Network Ports figure: "4 x OSFP ports, each provides connectivity to two ConnectX-7 cards for a total of 8 x 400Gb/s ports"')] }],
          ['Module', 'twin-port 800G OSFP, flat-top', 'spec', { refs: [ref('nvidia-mma4z00-ns', '"This requires the use of flat-top transceivers, ACCs, and DACs in the DGX H100."')] }],
          ['Fiber', '2 × SR4 multimode, up to 50 m on OM4; or 2 × DR4 single-mode', 'spec', { refs: [ref('nvidia-mma4z00-ns', 'specifications: Operating Distance (OM4) 2–50 m'), ref('nvidia-mms4x00-ns', 'the single-mode 2xDR4 twin-port version')] }],
          ['Power', '17 W max', 'spec', { refs: [ref('nvidia-mms4x00-ns', '"Twin-port single mode OSFP transceivers remain at 17 Watts for all configurations"')] }]] },
      { id: 'dpu', title: 'Storage & management NICs', kicker: 'Front-end network',
        body: 'Two dual-port ConnectX-7 cards in the rear riser slots run storage and the front-end network, separate from the GPU fabric. NVIDIA’s own DGX H100 hardware guide and datasheet describe these as ConnectX-7 cards, not BlueField DPUs. The other two slots hold a 100 GbE NIC and the pair of M.2 boot drives.',
        specs: [['Count', '2 per server', 'spec', { refs: [ref('nvidia-dgxh100-user-guide', 'Component Descriptions: "2 x NVIDIA ConnectX-7 Dual Port Ethernet Cards" for storage/management networking')] }], ['Slots', '1 and 2, on the rear risers', 'spec', { refs: [ref('nvidia-dgxh100-user-guide', 'Network Ports figure: "Slot 1: Dual port ConnectX-7 card", "Slot 2: Dual port ConnectX-7 card"; Motherboard Tray Components figure: "PCIe card riser for slots 1 and 3", "PCIe card riser for slots 2 and 4"')] }], ['Slots 3 and 4', '100 GbE NIC; M.2 boot drives', 'spec', { refs: [ref('nvidia-dgxh100-user-guide', 'Network Ports figure: "Slot 3: 100 Gb/s Ethernet NIC"; "Slot 4: M.2 PCIe carrier for Dual 1.92TB NVMe boot drives"')] }]] },
      { id: 'pcie', title: 'PCIe switches', kicker: 'Drives and storage NICs',
        body: 'GPU data does not pass through these: NVIDIA’s topology runs each GPU’s PCIe straight to its own ConnectX-7, which also links to a CPU. Three PCIe switches serve the rest, one per CPU for four drives and a storage NIC, and one for the NVSwitch chips. Their positions here are representative.',
        specs: [['GPU to NIC', 'direct, no switch between', 'spec', { refs: [ref('nvidia-dgxh100-user-guide', 'DGX H100/200 System Topology figure: each GPU links to one device labeled "ConnectX-7 Network Module", which links to a CPU'), ref('nvidia-connectx7-ib-datasheet', '"Standalone ConnectX-7 application-specific integrated circuit (ASIC), supporting PCIe switch capabilities"')] }], ['PCIe switches', '3', 'spec', { refs: [ref('nvidia-dgxh100-user-guide', 'DGX H100/200 System Topology figure, legend "PCIe Switches": one per CPU, each to four NVMe drives and a ConnectX-7; one between CPU 0 and the four NVSwitch chips')] }], ['Generation', 'PCIe Gen5, ≈64 GB/s per x16 direction', 'spec', { refs: [ref('nvidia-dgxh100-user-guide', 'Component Descriptions: "2 x Intel Xeon 8480C PCIe Gen5 CPUs"'), ref('wikipedia-pcie', 'link-performance table: PCIe 5.0 x16, "63.015" GB/s one direction')] }], ['Positions as drawn', 'representative', 'assumed', { assume: 'dgx-h100-internal-layout' }]] },
      { id: 'nvme', title: 'NVMe drives', kicker: '8 at the front',
        body: 'Eight U.2 NVMe drives fill the strip under the fans, four on each side of the console board, as a local data cache. Each CPU reaches four of them through a PCIe switch. Two M.2 drives at the rear hold the operating system.',
        specs: [['Data cache', '8 × 3.84 TB U.2', 'spec', { refs: [ref('nvidia-dgxh100-user-guide', 'Component Descriptions: "8 x 3.84 TB NVMe U.2 SED (ea) in RAID 0 array"')] }], ['Where', 'the front, under the fans', 'spec', { refs: [ref('nvidia-dgxh100-user-guide', 'With the Bezel Removed figure: "8 x 3.84 TB U.2 NVMe Self-Encrypting Drives (SED)" along the bottom, under "12 x Fan Modules"')] }], ['Boot', '2 × 1.92 TB M.2, RAID 1', 'spec', { refs: [ref('nvidia-dgxh100-user-guide', 'Component Descriptions: "2 x 1.92 TB NVMe M.2 SSD (ea) in RAID 1 array"')] }]] },
      { id: 'gpu', title: 'H100 GPUs', kicker: 'Where the links begin', drill: 5,
        body: 'Every one of these links starts at the edge of the GPU die.',
        specs: [['Links per GPU', 'NVLink, PCIe to the NIC', 'reported', { refs: [ref('naddod-gb200-interconnect', 'describes each H100 GPU connecting out over NVLink to its NVSwitch and PCIe to its NIC/CPU')] }]] },
    ],
    chip: [
      { id: 'hbm', title: A.hbm.type, kicker: `${hbmTB}, millimeters away`,
        body: `The fastest link in the building is the shortest: thousands of wires between each HBM stack and the die edge it faces. The arcs drawn from each stack into the die are lifted over the parts so they can be seen; the real wires run underneath, from the stack's microbumps through ${A.id === 'h100' ? 'the silicon interposer' : 'a silicon bridge in the interposer'} to the HBM interface along the die's edge. The lights at work on the dies are schematic too: they show compute being scheduled and data reaching it, not a real floorplan or scheduling trace.`,
        specs: [['Bandwidth', hbmTB, EV6.hbm.basis, EV6.hbm.ev], ['Drawn flow', 'lifted over the parts; the wires run beneath', 'assumed', { assume: 'hbm-flow-drawing' }],
          ['Activity on the dies', 'schematic, not a floorplan or a trace', 'assumed', { assume: 'die-activity-drawing' }]] },
      ...(A.dies > 1 ? [{ id: 'hbi', title: 'NV-HBI', kicker: '10 TB/s die to die',
        body: 'The two dies join across their seam fast enough that software sees one GPU.',
        specs: [['Bandwidth', '10 TB/s', EV6.dieRow.basis, EV6.dieRow.ev]] }] : []),
      { id: 'nvphy', title: 'NVLink SerDes', kicker: `${A.nvlink.gen} leaves here`,
        body: `Serializer circuits along the die edge push NVLink out through the package, ${nvlTB} per GPU.`,
        specs: [['Per GPU', nvlTB, EV6.nvlink.basis, EV6.nvlink.ev]] },
      { id: 'cpo', title: 'Light on the package', kicker: 'What comes next',
        body: 'Today the GPU speaks copper and a module turns it into light. Switches already carry optical engines on the package; bringing them to the GPU would let scale-up reach beyond one rack.',
        specs: [[A.short, 'electrical I/O only', 'reported', { refs: [['nvidia-dgx-gb200-user-guide', 'hardware overview: "connected by NVLink through the NVLink passive copper cable cartridge backplane"']] }]] },
      { id: 'tokens', title: 'Tokens', kicker: 'What leaves', math: tokenMathRows(M),
        body: 'After all those links, the output is small: a few bytes per token, sent back out the front-end network to whoever asked.',
        specs: [['Per token of text', 'a few bytes', 'assumed', { assume: 'token-byte-size' }]] },
    ],
  };

  // ---------- heat-mode parts per scene. Positions come from each scene's heatHotspots ----------
  // every heat layer draws its motion on one rule (src/heat.js); the cards that compare parts carry it
  const heatScale = ['Heat drawn', 'log scale, each 10× in power 5× the motion; none under 0.5 W', 'assumed', { assume: 'heat-visual-scale' }];
  const glowScale = ['Glow drawn', 'log scale, each 10× in power 5× the glow; none under 0.5 W', 'assumed', { assume: 'power-glow-scale' }];
  const PARTS_HEAT = {
    across: [
      { id: 'climate', title: 'Climate picks sites', kicker: 'Heat stays local',
        body: 'Power travels between sites; heat is rejected locally. Builders favor places where outside air is cool enough to reject heat most of the year, and where water is not scarce. Rising pulses show local heat rejection schematically: their amount follows each campus’s power on the site’s log heat scale, while their height and speed are not measurements.',
        specs: [['Free cooling', 'most hours in cool climates', 'assumed', { assume: 'free-cooling-framing' }], heatScale] },
      { id: 'home', title: site ? site.name : 'This campus', kicker: 'Go in', drill: 1,
        body: 'Go into the campus and follow the heat out.',
        specs: [['Heat out', meter, 'derived', { calc: 'heat-out-equals-power-in' }]] },
    ],
    campus: [
      warm
        ? { id: 'drycoolers', title: 'Dry coolers', kicker: 'Heat into air, no water',
          body: 'Warm facility water runs through finned coils on the roofs while big fans pull outside air across them. With water at 30–45 °C, outside air can take the heat most of the year without chillers.',
          specs: [
            ['Heat rejected', `≈${mwTxt(IT_MW * 1.05)}`, 'derived', evCalc('campus-heat-rejected')],
            ['NVIDIA warm-water spec', '45 °C in, ≈55 °C out', 'spec', evRefs([['nvidia-warm-water-blog', 'NVIDIA blog: "the coolant entering a fully liquid-cooled chip at 45 degrees Celsius exits at roughly 55 degrees"']])],
            ['Water classes', 'ASHRAE W32–W45', 'spec', evRefs([['ashrae-liquid-cooling-classes', 'blog: classes "W17, W27, W32, NEW class W40, W45" named for their maximum supply temperature in °C'], ['ashrae-tc99-liquid-cooling-wp', 'p.4, "Change to ASHRAE Water Classifications": "the W classes are being renamed with the upper temperature limits incorporated in the name... W17 (previously W1), W27 (W2), W32 (W3), W40 (new), W45 (W4)"']])],
          ] }
        : { id: 'chillers', title: 'Chiller plant', kicker: 'Pumping heat uphill',
          body: closed
            ? 'Air-cooled chillers move heat from cold water into outside air through their condenser fans, and spend electricity to do it: every megawatt they move adds roughly a sixth more to reject. On a closed loop, no water leaves as vapor.'
            : 'Chillers move heat from cold water into warmer tower water, and spend electricity to do it: every megawatt they move adds roughly a sixth more to reject.',
          specs: [
            ['Cooling power', mwTxt(M.coolMW), 'derived', evCalc('campus-cooling-power')],
            ['Chillers', `≈${n0(L.chillers)}`, 'derived', evCalc('campus-chiller-count')],
          ] },
      ...(closed ? [] : [
      { id: 'towers', title: 'Cooling towers', kicker: warm ? 'Hot days cost water' : 'Where the water goes',
        body: warm
          ? 'Evaporating water carries heat away far better than air, so towers trim the loop on the hottest afternoons. Every kilowatt-hour moved this way costs water.'
          : 'Evaporation carries the heat away all year. Each kilogram of water evaporated takes about 2.4 MJ with it, which adds up to rivers of water at this scale.',
        specs: [
          ['WUE, this design', `≈${M.wue.toFixed(2)} L/kWh IT`, 'assumed', evAssume('wue-by-cooling')],
          ['Water treatment', 'anti-scale, anti-corrosion and disinfectant dosing, plus blowdown', 'reported', evRefs([['cdc-legionella-cooling-towers', '"Automate anti-corrosion, anti-scale, and disinfectant addition and monitoring."']])],
          ['Water per day', `≈${kfmt(waterM3h(M) * 24)} m³`, 'derived', evCalc('campus-water-per-day')],
          ['At the power plant, typical thermal', '≈1.8 L/kWh (NREL)', 'spec', evRefs([['nrel-water-electricity', 'review’s synthesis figure: 0.47 gal (1.8 L) evaporated per kWh of end-use electricity for typical thermoelectric generation']])],
        ] },
      ]),
      { id: 'plume', title: `Where ${meter} goes`, kicker: 'All of it, as heat',
        body: `Every watt that came in on the 345 kV line leaves as warm air${warm || closed ? '' : ' and water vapor'} above the roofs. The campus is, physically, a ${meter} heater that happens to make tokens on the way.`,
        specs: [['Heat out', meter, 'derived', evCalc('campus-heat-out')]] },
      { id: 'reuse', title: 'Heat reuse', kicker: 'Warm water is still worth something',
        body: 'In cold climates the return water can feed a district heating network, with heat pumps lifting it to 70–75 °C. This campus exports none; these do.',
        specs: [
          ['Meta Odense, Denmark', '≈165,000 MWh a year, ≈11,000 homes', 'reported', evRefs([['munters-odense', 'case study: Meta’s Odense heat reuse provides "up to 165,000 MWh of energy a year" to warm "11,000 homes and businesses"']])],
          ['Microsoft + Fortum, Finland', 'up to 180 MW of district heat', 'reported', evRefs([['fortum-finland-heat', 'press release: "72 units, producing up to 180 megawatts of district heating"']])],
          ['Stockholm Data Parks', '30+ data centers selling heat', 'reported', evRefs([['stockholm-data-parks', 'program site'], ['eurelectric-stockholm-data-parks', '"The platform now connects 30+ DCs across 16 providers."']])],
          ['Tie-in drawn here', 'an illustration, not built', 'assumed', evAssume('campus-heat-reuse-illustration')],
        ] },
    ],
    hall: [
      air
        ? { id: 'inrow', title: 'In-row cooling units', kicker: 'Hot air in, cold air out',
          body: 'Fans pull hot-aisle air through chilled-water coils and push it out cold at the rack fronts. The water carries the heat to the chiller plant.',
          specs: [['Supply air', '≈18–27 °C (ASHRAE)', 'spec', { refs: [['ashrae-tc99-reference-card', 'Table 2.1, 2015 Thermal Guidelines: Recommended row, classes A1 to A4, 18 to 27 °C']] }], ['Units here', `≈${n0(L.airUnits)}`, 'derived', { calc: 'bom-facility-count', assume: 'inrow-capacity' }]] }
        : { id: 'cdu', title: 'Coolant distribution unit', kicker: 'Where the two loops meet',
          body: 'A plate heat exchanger, in units such as Vertiv’s CoolChip or Motivair’s CDU line, passes heat from the rack loop into facility water without mixing them. The rack side stays above the dew point so nothing condenses.',
          specs: [['Capacity range', '70 kW – 2.3 MW', 'spec', { refs: [['vertiv-coolchip-cdu', 'CoolChip CDU family: models from CDU 70 (70 kW) to CDU 2300 (2300 kW)'], ['motivair-cdu-brochure', '"COOLING UP TO 2.3MW", MCDU-4U (102 kW) through MCDU-60 (2.3 MW) rated-capacity table']] }], ['Approach, facility to rack loop', 'a few °C (≈3 °C here)', 'assumed', { assume: 'hall-cdu-approach' }], ['Rack loop, supply → return', `≈${TT.tcsSupply ?? TT.fwsSupply} → ${TT.tcsReturn ?? TT.fwsReturn} °C`, 'assumed', { assume: 'loop-temps' }]] },
      { id: 'fwater', title: air ? 'Chilled water loop' : 'Facility water loop', kicker: 'Supply blue, return red',
        body: `Insulated headers carry warm return water ${warm ? 'up to the roof' : 'to the chiller plant'} and cooler supply water back. The temperature difference sets how much water has to move.`,
        specs: [['Rise', '≈10 °C', 'assumed', { assume: 'hall-water-rise-10c' }], ['Supply → return', `≈${TT.fwsSupply} → ${TT.fwsReturn} °C`, 'assumed', { assume: 'loop-temps' }], ['Pipework as drawn', 'representative', 'assumed', { assume: 'hall-pipework-detail' }], ['Pipe markers', 'green with white letters and a flow arrow, ASME A13.1 style', 'assumed', { assume: 'pipe-markers', refs: [['projectmaterials-asme-a13-1', 'color code chart: "Green water, potable water, cooling water, condensate", green background with white text; "Flow direction arrows are a mandatory element of every pipe label"']] }]] },
      { id: 'hotaisle', title: 'Hot aisle', kicker: air ? 'All the heat, as air' : 'The air-side heat',
        body: 'Rack backs face each other across a sealed aisle, so hot air rises and flows to the coolers instead of warming the room.',
        specs: [['Air share of rack heat', `≈${Math.round((1 - liq) * 100)}%`, 'derived', { calc: 'hall-air-heat-share' }], ['Doors and roof as drawn', 'representative', 'assumed', { assume: 'hall-containment-doors' }]] },
      { id: 'fanwall', title: 'Fan wall', kicker: 'Air back to cool',
        body: 'Fans pull hot-aisle air through water coils and blow it back into the room cool, closing the air loop.',
        specs: [air
          ? ['Moves', 'room loads and overflow', 'assumed', { assume: 'hall-standard-practice' }]
          : ['Moves', `the ≈${Math.round((1 - liq) * 100)}% air share`, 'derived', { calc: 'hall-air-heat-share' }], ['Cells as drawn', 'representative', 'assumed', { assume: 'hall-fanwall-cells' }]] },
      { id: 'fire', title: 'Fire detection', kicker: 'Smoke found early',
        body: 'Air-sampling detectors pull air from the room through a pipe network and test it continuously, so they can find smoke before a fire grows. Sprinkler lines run above the aisles. NFPA 75 sets the minimum fire protection for rooms of IT equipment.',
        specs: [['Air-sampling detection', 'continuous, the earliest warning', 'reported', evRefs([['xtralis-vesda', '"continuous air sampling provide the earliest possible warning of an impending fire hazard"']])], ['Devices as drawn', 'representative', 'assumed', { assume: 'hall-fire-devices' }],
          ['NFPA 75 covers', 'fire, smoke, corrosion, heat and water damage', 'reported', evRefs([['nfpa75-csemag', 'NFPA 75’s purpose: "minimum requirements for the protection of IT equipment and IT equipment areas from damage by fire or its associated effects"']])]] },
      { id: 'riser', title: warm ? 'Risers to the roof' : 'Risers to the plant', kicker: 'Heat leaves the building',
        body: `The headers turn up and out to the ${warm ? 'dry coolers' : 'chillers'}.`,
        specs: [['Carries', 'nearly all of the hall’s heat', 'assumed', { assume: 'hall-standard-practice' }], ['Pipework as drawn', 'representative', 'assumed', { assume: 'hall-pipework-detail' }], ['Pipe markers', 'green with white letters and a flow arrow, ASME A13.1 style', 'assumed', { assume: 'pipe-markers', refs: [['projectmaterials-asme-a13-1', 'color code chart: "Green water, potable water, cooling water, condensate", green background with white text; "Flow direction arrows are a mandatory element of every pipe label"']] }]], drill: 1 },
    ],
    rack: nvl ? [
      { id: 'manifold', title: 'Coolant manifolds', kicker: 'Cool in, warm out',
        body: 'Supply drops in from the overhead rack loop at the top of one side, fans out to every tray through dripless quick disconnects, and returns warmer up the other side to the top.',
        specs: [['To liquid, this model', `≈${liqKW} kW`, 'derived', { calc: 'rack-liquid-split' }], ['Rise across the rack', '≈10 °C', 'reported', { refs: [ref('alliance-chemical-gpu-thermal', '"roughly 170–195 liters per minute of coolant at a 10°C inlet-to-outlet rise (about 1.5 LPM per kW)" for a GB200 NVL72 rack')] }], ['Supply → return, this design', `≈${TT.tcsSupply} → ${TT.tcsReturn} °C`, warm ? 'spec' : 'assumed', warm ? { refs: [['nvidia-warm-water-blog', 'NVIDIA blog: "the coolant entering a fully liquid-cooled chip at 45 degrees Celsius exits at roughly 55 degrees"']] } : { assume: 'loop-temps' }], ['Flow rate', 'sources disagree ≈5×', 'assumed', { assume: 'rack-water-temps', refs: [ref('alliance-chemical-gpu-thermal', '"roughly 170–195 liters per minute"; notes "the OEM/CDU specification governs" the built system')] }]] },
      ...(liq < 0.99 ? [{ id: 'rearair', title: 'Rear exhaust', kicker: `The last ${Math.round((1 - liq) * 100)}%`,
        body: 'Power shelves, switch trays, optics and drives still shed heat into air, which leaves the back of the rack into the hot aisle.',
        specs: [['To air, this model', `≈${airKW} kW`, 'derived', { calc: 'rack-liquid-split' }]] }] : []),
      { id: 'compute', title: 'Compute trays', kicker: 'Where the heat starts', drill: 4,
        body: 'Each tray carries its heat into its cold plates.',
        specs: [['Per tray', `≈${trayKW.toFixed(1)} kW`, 'derived', { calc: 'tray-power' }]] },
    ] : [
      { id: 'front', title: 'Cold aisle', kicker: 'Air in',
        body: 'Cool air from the in-row units reaches the rack fronts and is pulled in by each server’s fans.',
        specs: [['Inlet', '≈18–27 °C (ASHRAE)', 'spec', { refs: [ref('ashrae-thermal-guidelines-refcard', 'Table 2.1, 2021 Thermal Guidelines for Air Cooling: Recommended range for Classes A1 to A4, "18 to 27" °C dry-bulb')] }]] },
      { id: 'rearair', title: 'Rear exhaust', kicker: 'All of it',
        body: `Every watt leaves the back as hot air, ${rackKW} kW per rack, into the sealed hot aisle.`,
        specs: [['Heat to air', `${rackKW} kW`, 'derived', { calc: 'rack-liquid-split' }], ['Rise, front to back', '≈15–20 °C', 'assumed', { assume: 'air-rack-rise' }]] },
      { id: 'servers', title: 'DGX H100 servers', kicker: 'Where the heat starts', drill: 4,
        body: 'Each server carries about ten kilowatts of heat into its airstream.',
        specs: [['Per server', '≈10.2 kW max', 'spec', { refs: [ref('nvidia-dgxh100-user-guide', 'Power Specifications table: "10.2 kW max." in the unlabeled column between Input and Specification for Each Power Supply — the system-level figure, distinct from the 3,300 W per-PSU column')] }]] },
    ],
    tray: nvl ? [
      { id: 'coldplates', title: 'Cold plates', kicker: 'Water on every hot chip',
        body: A.id === 'rubin' ? 'Cold plates are lifted to show the chips. A rigid internal manifold and quick disconnects serve the modular bays; these routes illustrate supply and return, not a recovered internal channel layout.' : 'Copper plates with fine internal fins sit on each GPU and CPU, lifted here to show the chips. The illustrated loop links them in series; exact production plumbing can differ.',
        specs: (() => { const p = gpuPowerEv(); return [['Heat per GPU', `≈${(A.gpuW / 1000).toFixed(1)} kW`, p.basis, p.ev]]; })() },
      { id: 'gpuheat', title: 'The heat source', kicker: `Four GPUs, two CPUs`, drill: 5,
        body: 'Almost all of the tray’s power ends up here, in a few square centimeters of silicon under each plate.',
        specs: [['Tray heat', `≈${trayKW.toFixed(1)} kW`, 'derived', { calc: 'tray-power' }]] },
      ...(A.id === 'rubin' ? [{ id: 'manifold', title: 'Integrated liquid manifold', kicker: 'Fanless reference tray',
        body: 'The Vera Rubin reference replaces internal fans and flexible hoses with modular bays and an integrated liquid manifold. Cooling geometry is representative; no absent fan is drawn as installed hardware.',
        specs: [['Tray cooling', 'fanless, hose-free liquid cooling', 'spec', { refs: [ref('nvidia-vera-rubin-pod-blog', 'Compute and NVLink Switch trays section: redesigned PCB midplane and fanless, hose-free tray; MGX section describes internal tray manifolds.')] }], ['Tube and boss routing', 'representative', 'assumed', { assume: 'tray-mechanical-detail' }]] }] : [{ id: 'fans', title: 'Fans', kicker: 'For what water misses',
        body: 'Small fans push air past the peripheral electronics that are not served by CPU/GPU cold plates.',
        specs: [['Air-cooled parts', 'peripheral electronics', 'reported', { refs: [ref('nvidia-dgx-gb200-hardware', 'Hardware: CPU/GPU liquid cooling and air-cooled peripheral components.')] }]] }]),
      { id: 'qd', title: 'Quick disconnects', kicker: 'Dripless',
        body: 'Couplings at the back seal as the tray is pulled, so a tray comes out dry.',
        specs: [['Per tray', 'one supply, one return per board', 'reported', { refs: [ref('nvidia-dgx-gb200-hardware', 'Hardware: the rear provides "inlets and outlets to the liquid cooling manifolds"')] }]] },
    ] : [
      { id: 'heatsinks', title: 'Heat sinks', kicker: 'Fins and heat pipes',
        body: 'Each GPU’s heat spreads through a copper base and heat pipes into a tall stack of fins. Air carries it away; nothing here is water.',
        specs: [['Heat per GPU', '700 W', 'spec', { refs: [ref('nvidia-h100-product-page', 'spec table: "Max thermal design power (TDP) | Up to 700W (configurable)"')] }], ['Heat-pipe count and routing', 'representative', 'assumed', { assume: 'tray-mechanical-detail' }]] },
      { id: 'gpuheat', title: 'The heat source', kicker: 'Eight GPUs', drill: 5,
        body: 'Most of the server’s ten kilowatts is made here, under the heat sinks.',
        specs: [['GPUs', '8 × 700 W', 'spec', { refs: [ref('nvidia-dgxh100-user-guide', 'Component Descriptions: "8 x NVIDIA H100 GPUs"'), ref('nvidia-h100-product-page', 'spec table: "Max thermal design power (TDP) | Up to 700W (configurable)"')] }]] },
      { id: 'cpuheat', title: 'CPUs and memory', kicker: 'Under the GPU tray',
        body: 'Air also runs through the motherboard tray, over the two CPUs, the 32 DIMMs and the eight ConnectX-7, and out the rear between the risers.',
        specs: [['CPUs', '2 × 350 W', 'spec', { refs: [ref('intel-xeon-8480c', 'specifications: TDP "350 W"')] }], ['ConnectX-7, a comparable card', '24.9 W typical each', 'spec', { refs: [ref('nvidia-connectx7-specs', 'MCX75310AAS-NEAT (single-port OSFP): "Typical power with passive cables in PCIe Gen 5.0 x16" "24.9W"')] }]] },
      { id: 'psuheat', title: 'Supply losses', kicker: 'Out the bottom of the rear',
        body: 'The six supplies lose a few percent of what they convert as heat, and it leaves straight out the rear under the two trays.',
        specs: [['Server power', '≈10.2 kW max', 'spec', { refs: [ref('nvidia-dgxh100-user-guide', 'Power Specifications table: "10.2 kW max."')] }], ['Efficiency', '≈96% (80 PLUS Titanium class)', 'assumed', { assume: 'dgx-h100-psu-efficiency' }]] },
      { id: 'fans', title: 'Fans', kicker: 'Front to back',
        body: 'Twelve fan modules, two fans each, cover the front above the drives and pull air through both trays and out the back. At full load they are a noticeable share of the server’s power.',
        specs: [['Fan modules', '12', 'spec', { refs: [ref('nvidia-dgxh100-user-guide', 'With the Bezel Removed figure: "12 x Fan Modules"')] }], ['Fans per module', '2', 'spec', { refs: [ref('nvidia-dgxh100-service-manual-fans', 'body text: "There are two fans in the fan module, identified by SPD_FAN_SYSn_F and SPD_FAN_SYSn_R"')] }], ['Airflow', '1,105 CFM at 80% fan speed', 'spec', { refs: [ref('nvidia-dgxh100-user-guide', 'Environmental Specifications: "Airflow 1105 CFM Front-to-Back @ 80% fan PWM"')] }], ['Heat output', '38,557 BTU/hr', 'spec', { refs: [ref('nvidia-dgxh100-user-guide', 'Environmental Specifications: "Heat Output 38,557 BTU/hr"')] }], ['Airflow at a 15 °C rise', '≈1,200 CFM per server', 'derived', { calc: 'fan-airflow' }]] },
    ],
    chip: [
      { id: 'junction', title: A.dies > 1 ? 'The dies' : 'The die', kicker: 'Hottest point in the building',
        body: 'Transistors switching billions of times a second turn nearly every watt into heat right at the surface of the silicon.',
        specs: [['Package power', `≈${n0(A.gpuW)} W`, EV6.pkgPower.basis, EV6.pkgPower.ev], ['Compute dies, this model', `≈${n0(A.gpuW * (1 - A.hbmShare))} W; the rest is HBM`, 'derived', { calc: 'gpu-die-power' }], ['At full load, this operating point', `≈${TT.die} °C`, 'assumed', { assume: 'loop-temps' }], ['Throttle point', 'near ≈85 °C; NVIDIA publishes none', 'assumed', { assume: 'throttle-point' }]] },
      { id: 'flux', title: 'Heat flux', kicker: 'Like a stovetop, but denser',
        body: `About ${n0(A.gpuW * (1 - A.hbmShare))} W through ${A.dies > 1 ? 'two reticle-size dies' : 'one reticle-size die'} averages about ${flux} watts per square centimeter, several times a stove burner. Hot spots on the die run far higher, and those set the ${nvl ? 'cold plate' : 'heat sink'} design.`,
        specs: [[A.dies > 1 ? 'Die area, two dies' : 'Die area', `≈${X.dieCm2} cm²`, EV6.fluxDie.basis, EV6.fluxDie.ev], ['Average flux', `≈${flux} W/cm²`, 'derived', { calc: 'heat-flux' }], ['Hot spots, cooling trade press', '500+ W/cm²', 'reported', { refs: [['alliance-chemical-gpu-thermal', 'body text: "At 1,000 W TDP with an active die area of approximately 1.5–2 cm², the resulting heat flux at the cold-plate interface reaches 500–600 W/cm²" (B200)']] }]] },
      { id: 'tim', title: A.id === 'h100' ? 'Thermal interface and heat sink base' : 'Thermal interface and lid', kicker: 'The first hop out',
        body: A.id === 'h100'
          ? `A thin thermal interface material carries heat from the die and the HBM straight into the flat base of the ${nvl ? 'cold plate' : 'heat sink'}, drawn lifted and see-through so the heat shows through it. The H100 SXM5 module is reported to ship bare-die, with no lid. Each layer costs a few degrees.`
          : `A thin thermal interface material carries heat from the ${A.dies > 1 ? 'dies' : 'die'} and the HBM into a metal lid, or heat spreader, and on into the ${nvl ? 'cold plate' : 'heat sink'}. The lid is drawn lifted and see-through so the heat shows through it; whether this package ships with one is not public. Each layer costs a few degrees.`,
        specs: [...(A.id === 'h100' ? [['Lid on the package', 'none: bare die', 'reported', { refs: [['tes-h100-sxm5-module', 'product listing: "Package: bare die, no heat spreader" and "Thermal: bare-die — heatsink mates directly to silicon"']] }]]
          : [['Lid, as drawn', 'representative; not confirmed for this package', 'assumed', { assume: 'thermal-stack-layers' }]]),
          ['Layers to coolant', A.id === 'h100' ? `die, interface, ${nvl ? 'cold plate' : 'heat sink'}` : `die, interface, lid, interface, ${nvl ? 'cold plate' : 'heat sink'}`, 'assumed', { assume: 'thermal-stack-layers' }]] },
      { id: 'hbm', title: 'HBM stacks', kicker: 'Heat in layers',
        body: `Stacked DRAM traps heat between its ${A.hbm.layers} layers, and DRAM leaks more as it warms, so memory often sets the temperature limit before the GPU does.`,
        specs: [['Share of package power', '≈8–15%', 'assumed', { assume: 'hbm-power-share' }],
          A.hbm.type === 'HBM3e'
            ? ['HBM3e limit, Micron', '105 °C', 'spec', { refs: [['micron-hbm3e-brief', 'specifications table: "Operating Temperature 0°C ≤ TOPER ≤ +105°C"']] }]
            : [`${A.hbm.type} limit, carried from HBM3e`, '≈105 °C', 'assumed', { assume: 'hbm-thermal-limit-other-gens' }]] },
    ],
  };

  // Temperature at each hop, hottest first, from the engine's one operating point per cooling design (M.temps): the
  // numbers the heat tour and the cards use. Each names its loop, and whether it is the supply or the return.
  const outside = at(1, warm ? 'drycoolers' : 'chillers', 'heat'), lt = { assume: 'loop-temps' };
  const TEMPS = (air ? [
    { label: 'GPU die', c: TT.die, note: 'throttles near ≈85 °C', basis: 'assumed', ev: lt, link: at(5, 'junction', 'heat') },
    { label: 'Hot aisle', c: TT.hotAisle, note: `≈${TT.hotAisle - TT.coldAisle} °C rise, front to back`, basis: 'assumed', ev: lt, link: at(2, 'hotaisle', 'heat') },
    { label: 'Outdoor air, hot day', c: TT.ambient, note: 'too warm to make cold water', basis: 'assumed', ev: lt, link: outside },
    { label: 'Cold aisle', c: TT.coldAisle, note: 'ASHRAE: 18–27 °C', basis: 'spec', ev: { refs: [['ashrae-tc99-reference-card', 'Table 2.1, 2015 Thermal Guidelines: Recommended row, classes A1 to A4, 18 to 27 °C']] }, link: at(3, 'front', 'heat') },
    { label: 'Chilled water supply', c: TT.fwsSupply, note: 'made by chillers', basis: 'assumed', ev: lt, link: at(2, 'fwater', 'heat') },
  ] : [
    { label: 'GPU die', c: TT.die, note: 'throttles near ≈85 °C', basis: 'assumed', ev: lt, link: at(5, 'junction', 'heat') },
    { label: 'Rack loop return', c: TT.tcsReturn, note: 'leaving the racks', basis: warm ? 'spec' : 'assumed', ev: warm ? { refs: [['nvidia-warm-water-blog', 'NVIDIA blog: "the coolant entering a fully liquid-cooled chip at 45 degrees Celsius exits at roughly 55 degrees"']] } : lt, link: at(3, 'manifold', 'heat') },
    { label: 'Facility return', c: TT.fwsReturn, note: warm ? 'up to the roof' : 'to the chillers', basis: 'assumed', ev: lt, link: at(2, 'fwater', 'heat') },
    { label: 'Rack loop supply', c: TT.tcsSupply, note: warm ? 'NVIDIA warm-water spec' : 'out of the CDU', basis: warm ? 'spec' : 'assumed', ev: warm ? { refs: [['nvidia-warm-water-blog', 'NVIDIA blog: "the coolant entering a fully liquid-cooled chip at 45 degrees Celsius"']] } : lt, link: at(2, 'cdu', 'heat') },
    { label: 'Facility supply', c: TT.fwsSupply, note: warm ? 'from the dry coolers' : 'made by chillers', basis: 'assumed', ev: lt, link: at(2, 'fwater', 'heat') },
    { label: 'Outdoor air, hot day', c: TT.ambient, note: warm ? (closed ? 'a hot design afternoon' : 'above it, sprays help') : 'warmer than the loop', basis: 'assumed', ev: lt, link: outside },
  ]).sort((a, b) => b.c - a.c);

  // How a model is split, from the chattiest traffic to the quietest.
  const PARALLEL = [
    { name: nvl ? 'Tensor + expert parallel' : 'Tensor parallel', where: nvl ? `Inside one ${A.rackName} rack` : 'Inside one 8-GPU server', cls: 'nvl', scene: 3, link: at(3, 'tp', 'data'),
      what: 'Each layer’s math is split across GPUs, or experts are spread across them. GPUs exchange partial results inside every layer, many times per token.',
      need: 'TB/s, every layer' },
    { name: 'Pipeline parallel', where: 'Across a few racks', cls: 'eth', scene: 2, link: at(2, 'pp', 'data'),
      what: 'Consecutive groups of layers live on different racks. Activations pass from one stage to the next, like an assembly line.',
      need: 'Point to point, per micro-batch' },
    { name: 'Data parallel', where: 'Across the hall', cls: 'eth', scene: 2, link: at(2, 'dp', 'data'),
      what: 'Many copies of the model train on different data and average their gradients once per step, overlapped with compute.',
      need: 'Big all-reduce, once per step' },
    { name: 'Loosely synced replicas', where: 'Across campuses', cls: 'dci', scene: 0, link: at(0, 'remote', 'data'),
      what: 'Sites train mostly on their own and sync only every so often, which keeps the slow long-haul links from stalling every step.',
      need: 'Gb/s, every few hundred steps' },
  ];

  // ---------- the side levels inside the links (research/optics-internals-sources.md, research/links-internals-sources.md) ----------
  const lay = ['Layout', 'representative, not one product', 'assumed', { assume: 'optics-module-layout' }];
  const extLay = ['Nose, saddle and receptacle bodies', 'shape representative', 'assumed', { assume: 'module-exterior-detail' }];
  const cpoLay = ['Layout', 'representative; counts are NVIDIA’s', 'assumed', { assume: 'cpo-package-layout' }];
  const osfpSize = ['OSFP body', '107.8 × 22.58 × 13.0 mm', 'reported', { refs: [ref('ascentoptics-osfp-form-factor', 'form factor dimensions: the integrated-heat-sink body as 22.58 mm wide × 107.8 mm long × 13.0 mm tall, restating the OSFP MSA')] }];
  const pins = ['Edge connector', '60 contacts: 32 high-speed (8 TX + 8 RX differential pairs), 4 control, 4 power, 20 ground', 'spec', { refs: [ref('osfp-msa', 'Module Electrical Connector section, checked in the MSA text mirrored by fluxlight.com (the rev 5.22 PDF would not extract): "16 contacts for 8 differential pairs of high-speed transmit signals, 16 contacts for 8 differential pairs of high-speed receive signals, 4 contacts for low-speed control signals, 4 contacts for power and 20 contacts for ground"')] }];
  const supply = ['Supply', '3.3 V on 4 power contacts, up to 2.5 A each (3.25 A on OSFP1600)', 'spec', { refs: [ref('osfp-msa', 'Rev 5.22 §15.6: "each power pin allows up to 2.5 Amps for a total of 10.0 Amps... For OSFP1600, each power pin allows up to 3.25 Amps"')] }];
  const lanes8 = ['Host lanes', '8 × 200G electrical, each way', 'spec', { refs: [ref('juniper-1p6t-transceiver', '"8x200G electrical—The electrical interface between the switch and the transceiver components"')] }];
  const quantumOSA = ['Per switch chip', '6 subassemblies × 3 engines = 18', 'spec', { refs: [ref('nvidia-cpo-industry-collaboration-blog', 'Quantum-X section: "Each Quantum-X switch ASIC delivers 28.8Tbps full duplex bandwidth, harnessed through six high-capacity optical subassemblies", each with three COUPE-based optical engines')] }];
  const perEngine = ['Per engine', '1.6 Tb/s each way, 8 × 200G', 'spec', { refs: [ref('nvidia-cpo-industry-collaboration-blog', 'Quantum-X section: engines "each supporting 1.6Tbps transmit and 1.6Tbps receive", with "eight 200Gbps PAM4 lanes for both transmit and receive"')] }];
  const fibers18 = ['Fibers per engine', '8 transmit, 8 receive, 2 laser in', 'spec', { refs: [ref('nvidia-cpo-industry-collaboration-blog', 'Quantum-X section: "eight transmit, eight receive, and two laser input fibers per engine"')] }];
  const els18 = ['Laser modules', '18 per Q3450 switch, 8 lasers each', 'reported', { refs: [ref('nvidia-cpo-industry-collaboration-blog', 'external laser source section: "Each ELS contains eight high-quality lasers"'), ref('lambda-q3450-unboxing', '"The switch supports 18 removable external light-source modules, each feeding eight MPO ports."')] }];
  const els32 = ['Transmit lanes per module', '32', 'spec', { refs: [ref('nvidia-cpo-industry-collaboration-blog', 'external laser source section: "An individual ELS is capable of powering 32 of the Quantum-X switch’s 576 transmit lanes"')] }];
  const q3450W = ['Q3450 switch, NVIDIA figure', '3.95 kW', 'vendor', { refs: [ref('lambda-q3450-unboxing', 'power comparison: "NVIDIA Photonics CPO switch: 3.95 kW. Standard switch: 7.0 kW."')], vs: 'a pluggable-optics equivalent switch at 7.0 kW' }];
  const portW = ['Per port, NVIDIA figure', 'as low as 9 W', 'vendor', { refs: [ref('nvidia-cpo-scaling-blog', 'body text: 30 W per port with pluggable transceivers, "as low as 9 W" per port with co-packaged optics')], vs: '30 W per port with pluggable transceivers' }];
  const coupe = ['Engine stack, as reported', 'electronic die above photonic die, TSMC SoIC-X', 'reported', { refs: [ref('tsmc-coupe-stack-2024', 'PDF page 2, Silicon Photonics Integration: COUPE uses SoIC-X to stack an electrical die on top of a photonic die; no process-node sizes asserted here.'), ref('nvidia-cpo-hotchips-2025', 'PDF page 14: Electronic IC / Photonic IC stack and COUPE microlens surface coupling; does not disclose the illustrated driver/TIA floorplan.')] }];
  const cpoCircuits = ['Electronic die floorplan drawn', 'eight driver and eight TIA blocks; placement representative', 'assumed', { assume: 'cpo-circuit-partition' }];
  const credoTwin = ['One DSP for both ports, e.g.', 'Credo Cardinal 1650: 1.6T DR8 or 2 × 800G DR4', 'spec', { refs: [ref('credo-optical-dsp', 'product table: Cardinal 1650, 8:8 at 200G/lane, "1.6T SR8/DR8/FR8, 2x800G SR4/DR4/FR4"')] }];
  const dspCount = ['DSPs in NVIDIA’s module', 'not published: one for both ports or one per port', 'assumed', { assume: 'optics-dsp-count' }];
  const sharedDsp = ['Example: Marvell Ara DSP', 'one DSP, 8 × 200G in each direction', 'spec', { refs: [ref('marvell-ara-product-brief', 'Overview and feature list: a 1.6T (8 × 200Gbps) DSP with eight host interfaces and an octal line interface; block diagram supports 2xDR4. Separate analog chips and placement here remain representative.')] }];
  const twinEngines = ['Inside a twin-port module', 'two independent 800G ports', 'spec', { refs: [ref('nvidia-mms4a00-specs', '"This enables it to host two transceivers inside, each with its own MPO-12/APC optical connector operating independently"')] }];
  const dspW = ['1.6T transceiver, Broadcom figure', 'under 23 W', 'vendor', { refs: [ref('broadcom-sian3-200g-lane-dsp', 'solution highlights: "Low power 3nm 200G/lane DSP for sub-13W 800G and sub-23W 1.6T transceivers"')], vs: 'its previous generation, which Broadcom puts over 20% higher' }];
  const marvellW = ['Marvell Ara, Marvell figure', 'over 20% less module power', 'vendor', { refs: [ref('marvell-ara-1-6t-prnewswire', 'body text: Ara leverages the Marvell 3nm platform "to reduce 1.6 Tbps optical module power by over 20%"')], vs: 'the previous generation of Marvell DSP' }];
  const lqd = ['Cooling, Q3450 switch', 'liquid; 4 UDQ4 connections, dual internal loops', 'reported', { refs: [ref('lambda-q3450-unboxing', 'cooling: "Cooling runs through four UDQ4 liquid cooling connections with dual internal loops."')] }];
  const plateDrawn = ['Cold plate drawn', 'one per package, representative', 'assumed', { assume: 'cpo-package-layout' }];
  const headLay = ['Layout', 'representative, not one product', 'assumed', { assume: 'copper-head-layout' }];
  const zrLay = ['Layout', 'OSFP envelope and cited nano-ITLA case to scale; other parts representative', 'assumed', { assume: 'coherent-module-layout' }];
  const dacNone = ['In the signal path', 'no redriver, retimer or DSP', 'reported', { refs: [ref('flexoptix-dac-acc-aec', '"pure twinax copper with no active signal processing at all"')] }];
  const dacW = ['Power, NVIDIA DAC', '≈0.1 W per end', 'spec', { refs: [ref('nvidia-copper-dac-lacc-overview', 'DAC section: "Power consumption is 0.1 Watts per end"')] }];
  const accChip = ['Inside', 'a redriver on the receive direction; NVIDIA’s LACC has one in each end', 'reported', { refs: [ref('marvell-acc-aec-architecture', 'Inside the Cable: ACC equalizers amplify signals received from the opposite cable end; the equalizer is analog'), ref('nvidia-copper-dac-lacc-overview', '"LACCs are essentially DAC cables with an additional IC in each end to boost the signal power and noise reduction"')] }];
  const accW = ['Power and reach', 'a couple of watts per end, ≈3 m at 200G/lane', 'reported', { refs: [ref('viksnewsletter-acc-power', '"pushes copper out to 3 meters at 200G/lane for just a couple of watts per end"')] }];
  const aecChip = ['Inside', 'a DSP retimer in each end: CTLE, DFE, CDR, FIR', 'reported', { refs: [ref('marvell-acc-aec-architecture', 'Inside the Cable: AEC DSPs at each cable end maintain signal integrity during both transmission and reception'), ref('ascentoptics-copper-cables', 'AEC section: "The Retimer chip in AEC is more advanced than the Redriver used in ACC. It integrates CTLE (Continuous-Time Linear Equalizer), DFE (Decision Feedback Equalization), CDR (Clock Data Recovery), and FIR drivers."')] }];
  const aecW = ['Power', '≈20 W per end at 200G/lane; 2.5–3.5 W in one guide, lane rate unstated', 'reported', { refs: [ref('viksnewsletter-acc-power', '"[AEC] burns around 20 watts per end"'), ref('ascentoptics-copper-cables', 'AEC section: "higher power consumption (2.5–3.5W)", no lane rate given')] }];
  const spinePassive = ['GB200 NVL72’s NVLink spine', 'passive copper', 'spec', { refs: [ref('nvidia-dgx-gb200-user-guide', 'hardware overview: "connected by NVLink through the NVLink passive copper cable cartridge backplane"')] }];
  const dacReach = ['Reach, 800G-class', '1–2 m', 'reported', { refs: [ref('flexoptix-dac-acc-aec', 'reach section: up to 5 m at lower data rates, 1–2 m at 800G-class signaling'), ref('nvidia-copper-dac-lacc-overview', '"0.5m to 2-meters for straight cables"')] }];
  const sipDrawn = ['Design drawn', 'silicon photonics, separate lasers', 'assumed', { assume: 'optics-sip-design' }];
  const tiaDoes = ['What it does', 'photodiode current in, voltage out', 'spec', { refs: [ref('juniper-1p6t-transceiver', 'receive section: the TIA "converts and amplifies the electrical current from the photodiode into an electrical voltage level"')] }];
  const lpoKeeps = ['LPO keeps', 'a linear driver (TX), the TIA (RX)', 'reported', { refs: [ref('flexoptix-lpo-intro', '"LPO technology removes the DSP with complex CDR functionality and keeps only high-linearity analog components such as drivers, lasers, photodiodes, and TIAs"')] }];
  // ---- the half-retimed (LRO / RTLR) variant, 09/30/2026: rows on the DSP and TIA cards, drawn by scenes/module-lro.js ----
  const oifRtlr = ref('oif-rtlr-press-2025', 'announcement body: RTLR "eliminates the need for a receive DSP in the optical module and leveraging signal processing already available in the host device"');
  const msaLro = ref('lpo-msa-faqs', 'FAQ answer: "Links that use a linear receiver and a retimed transmitter (i.e., half-linear or half-retimed modules) are referred to as LRO modules and will be designated with “-LRO” on any optical specifications."');
  const lroWhat = ['Half-retimed (LRO, RTLR)', 'DSP on transmit only; the host’s processing replaces a receive DSP', 'spec', { refs: [oifRtlr, msaLro] }];
  const lroIa = ['OIF RTLR interface', 'OIF-EEI-112G-RTLR 1.0, 112 Gb/s lanes, published 11/18/2025', 'spec', { refs: [ref('oif-rtlr-press-2025', 'title and body: "112 Gb/s Retimed Transmitter Linear Receiver (RTLR)"; "published on November 18, 2025, with the document designation OIF-EEI-112G-RTLR version 01.0"')] }];
  const lroAraT = ['Transmit-only DSP, Marvell', 'Ara T: 8 × 200G TRO; sampling from Q1 2026', 'spec', { refs: [ref('marvell-ara-1p6t-portfolio', 'body text: "Ara T, the first 8x200G transmit-retimed optics (TRO) DSP"; "Ara X, Ara T, Petra and Aquila M DSPs are sampling to customers beginning in Q1 2026."')] }];
  const lroDove = ['Credo Dove 850 (800G LRO DSP), Credo figure', 'up to 50% less DSP power', 'vendor', { vs: 'a baseline Credo’s release does not name', refs: [ref('credo-lro-dove850-press', 'release body: "In an LRO transceiver or Active Optical Cable (AOC), only the transmit path from the electrical input to the optical line side output includes a DSP for signal retiming and equalization"; "Dove 850 reduces DSP power by up to 50%"')] }];
  const lroW = ['Module power at 200G/lane, Semtech figures', 'LRO ≈16 W · full DSP 23–25 W · LPO target ≈10 W', 'vendor', { vs: 'Semtech’s comparison of current full-DSP and LRO modules with its LPO target; not a measured saving for one module', refs: [ref('semtech-200g-lpo-power-blog', 'power section: "currently 23 to 25 watts per module... LRO/RTLR (Half-Retimed) Modules: currently approximately 16 watts... LPO Modules: targeting approximately 10 watts"')] }];
  const lroTia = ['In an LRO module', 'linear receive: the TIA output goes to the host', 'spec', { refs: [oifRtlr, msaLro] }];
  const hostEq = ['Linear receive, Semtech on LPO', 'the host SerDes is calibrated to supply the equalization', 'reported', { refs: [ref('semtech-lpo-ai-basics-blog', 'host requirements: "Not necessarily new ASICs, but the host SerDes must be correctly calibrated to deliver the equalization LPO modules expect."')] }];
  const lroDrawn = ['LRO as drawn', 'same package, receive half hatched; representative', 'assumed', { assume: 'module-lro-drawing' }];
  // ---- the module this scenario's switches use (10/01/2026): the level follows the hall's switch-side lid label ----
  const mms4x00Twin = ref('nvidia-mms4x00-ns', 'overview: "two transceiver engines in a single OSFP form-factor plug creating 800Gb/s electrical to the switch and 2x400G optics"');
  const thisModule = MT8
    ? ['This scenario’s switch module', 'NVIDIA MMS4X00, 800G twin-port OSFP, 2 × DR4, finned top', 'spec', { refs: [mms4x00Twin, ref('nvidia-mms4x00-ns', 'overview: "one, 17-Watt twin-port, finned-top 2xDR4 transceivers in each switch"')] }]
    : MT.published
      ? ['This scenario’s switch module', 'NVIDIA MMS4A00, 1.6T twin-port OSFP, 2 × DR4', 'spec', { refs: [ref('nvidia-quantum-x800-clusters', 'transceiver list: "NVIDIA twin port transceiver, 1600Gbps, OSFP 2xDR4, 2xMPO APC, 1310nm SMF", platform: switch'), ref('nvidia-mms4a00', 'title: "MMS4A00 1600Gbps, 2xDR4, Twin-port OSFP, 2xMPO, 1310nm Single Mode Transceiver"')] }]
      : ['This scenario’s switch module', 'type not published; drawn as a 1.6T twin-port OSFP', 'assumed', { assume: 'module-follows-scenario' }];
  const drawnSame = ['Internals drawn', 'one layout for the 800G and 1.6T twin-ports', 'assumed', { assume: 'module-follows-scenario' }];
  const modPower = MT8
    ? ['Max power, NVIDIA MMS4X00', '17 W', 'spec', { refs: [ref('nvidia-mms4x00-ns-specs', 'specifications table: "Maximum Power Dissipation", 17 W'), ref('nvidia-mms4x00-ns', 'overview: "Twin-port single mode OSFP transceivers remain at 17 Watts for all configurations"')] }]
    : MT.published
      ? ['Max power, NVIDIA MMS4A00', '33.5 W', 'spec', { refs: [ref('nvidia-mms4a00-specs', 'specifications table: "Maximum Power Dissipation", 33.5 W'), ref('nvidia-mms4a00', 'product summary: "33.5W max power"')] }]
      : null;
  const hostLanes = MT8
    ? ['Host lanes', '8 × 100G electrical, each way', 'spec', { refs: [mms4x00Twin, ref('osfp-msa', 'Module Electrical Connector section: "16 contacts for 8 differential pairs of high-speed transmit signals, 16 contacts for 8 differential pairs of high-speed receive signals"')] }]
    : MT.published
      ? ['Host lanes', '8 × 200G PAM4 electrical, each way', 'spec', { refs: [ref('nvidia-mms4a00', 'overview: "The electrical configuration is 8-channels of 200G-PAM4."'), ref('juniper-1p6t-transceiver', '"8x200G electrical—The electrical interface between the switch and the transceiver components"')] }]
      : lanes8;
  const opticalLanes = MT8
    ? ['Optical lanes, MMS4X00', '8 × 100G PAM4 each way, 2 × DR4; 53.125 GBd', 'spec', { refs: [ref('nvidia-mms4x00-ns-specs', 'specifications table: "Signaling Rate per Lane", 53.125 GBd'), ref('nvidia-mms4x00-ns', 'overview: "The line rate is 400Gb/s for both 400GbE Ethernet and NDR InfiniBand based on the 100G-PAM4 modulation"; "two 4-channel MPO-12/APC optical connectors"')] }]
    : MT.published
      ? ['Optical lanes, MMS4A00', '8 × 200G PAM4 each way, 2 × DR4; 106.25 GBd', 'spec', { refs: [ref('nvidia-mms4a00-specs', 'specifications table: "Signaling Rate per Lane", 106.25 GBd; "8-channels 200G-PAM4"')] }]
      : null;
  const reach = MT8
    ? ['Reach, MMS4X00-NS', 'up to 100 m; a 500 m version (-NM) exists', 'spec', { refs: [ref('nvidia-mms4x00-ns', 'overview: "two straight fibers cables (MFP7E30-Nxxx) up to 100-meters"; "A 500-meter version (-NM) is also available for longer switch-to-switch reaches"')] }]
    : MT.published
      ? ['Reach, MMS4A00', 'up to 500 m', 'spec', { refs: [ref('nvidia-mms4a00', 'overview: "Maximum reach: 500-meters"'), ref('nvidia-mms4a00-specs', 'specifications table: "Operating Distance", 500 m max')] }]
      : null;
  const twinPorts = MT8
    ? ['Inside a twin-port module', 'two independent 400G ports', 'spec', { refs: [mms4x00Twin] }]
    : MT.published ? twinEngines : ['Inside NVIDIA’s 1.6T twin-port', 'two independent 800G ports', 'spec', twinEngines[3]];
  const twinDsp = MT8
    ? ['One DSP for both ports, e.g.', 'Credo Robin 800: 800G DR8 or 2 × 400G DR4, 8:8 at 100G/lane', 'spec', { refs: [ref('credo-optical-dsp', 'product table, 100G/Lane DSPs: Robin 800, 8:8, 100G/lane, "800G SR8/DR8, 2x400G SR4/DR4/FR4"')] }]
    : credoTwin;
  const dspFamilies = MT8
    ? ['Example 800G DSPs, 8 × 100G', 'Credo Robin and Dove families, 8:8', 'spec', { refs: [ref('credo-optical-dsp', 'product table, 100G/Lane DSPs: Robin 800/802/850/852 and Dove 800/850, each 8:8 at 100G/lane for 800G DR8 and 2x400G DR4')] }]
    : ['Example 1.6T DSP families', 'Marvell Ara (1.6T), Broadcom Sian3 (800G / 1.6T)', 'spec', { refs: [ref('marvell-ara-1-6t-prnewswire', 'headline and body: Ara, a 3 nm 1.6 Tb/s PAM4 DSP, 8 × 200G electrical and 8 × 200G optical lanes'), ref('broadcom-sian3-200g-lane-dsp', 'body text: Sian3, a 3 nm 200G-per-lane DSP PHY for 800G and 1.6T modules')] }];
  // power figures on the DSP cards: the 800G twin-port's own NVIDIA rating; the 1.6T DSP vendors' figures otherwise
  const dspPower = MT8 ? [modPower] : [dspW, marvellW, ...(modPower ? [modPower] : [])];
  const edge = { id: 'fingers', title: 'Edge connector', kicker: 'Back out to the cage', drill: 'out',
    body: 'Gold fingers on both faces of the board carry power, control signals, and eight high-speed lanes each way. Ground contacts engage first, then power, then signals. Each signal pair connects into the module through copper traces and vias. The data view reveals the inner board layers near the connector so you can follow the complete path; routing is representative. The cage it plugs into is on the level you came from.' };
  PARTS.module = [
    { ...edge, specs: [thisModule, pins, supply, ...(modPower ? [modPower] : []), osfpSize, drawnSame] },
    { id: 'dcdc', title: 'Power conversion', kicker: 'Rails for every chip', body: 'The host supplies one voltage. Small converters on the module make the separate rails the DSP, the driver, the TIA and the lasers need.', specs: [lay] },
    { id: 'dsp', title: 'DSP', kicker: 'A major draw', body: `In the design drawn, one DSP handles eight ${MT.lane} lanes in each direction, ${MT.rate} each way, for both ports. DSP makers sell single chips for exactly this; NVIDIA does not publish whether its twin-port module uses one DSP or one per port. Its line-side lanes run in separate eight-channel TX and RX banks, divided into two four-lane, ${MT.port} optical ports at the fibers. Transmit and receive are not added to name the module rate. This is a representative architecture, not a claim about a specific module’s chip count. The DSP is a major power draw. The LRO comparison keeps it for transmit only; the LPO comparison removes this chip and shows its empty footprint.`, specs: [...(MT8 ? [] : [sharedDsp]), twinDsp, dspCount, ...dspPower, twinPorts, lay, lroW, lroDove, lroAraT, lroDrawn] },
    { id: 'driver', title: 'Driver', kicker: 'Transmit amplifier', body: 'The driver amplifies each outgoing lane enough to swing a modulator’s electrodes. The converters feed it a separate rail, drawn as its own branch. A linear-drive (LPO) module keeps the driver and drops the DSP.', specs: [lpoKeeps, lay] },
    { id: 'lasers', title: 'Lasers', kicker: 'Light only', body: 'In a silicon photonics module, as drawn, separate continuous-wave lasers make steady light, because silicon cannot make light efficiently; the data goes onto it in the modulators. Other modules put the laser and modulator in one chip instead: NVIDIA’s 800G twin-port in its MPO-16 version uses EMLs.', specs: [sipDrawn, ['Short-reach DR8', 'directly modulated lasers are also used', 'spec', { refs: [ref('juniper-1p6t-transceiver', '"DMLs are used for single-mode optics such as DR8"')] }], ['NVIDIA’s 800G twin-port (MPO-16)', '1310 nm EML lasers', 'spec', { refs: [ref('nvidia-mms4x00-nm16', 'product page: "1310nm EML laser"')] }]] },
  ];
  PARTS_DATA.module = [
    { ...edge, specs: [hostLanes, pins, thisModule, drawnSame] },
    { id: 'dsp', title: 'DSP', kicker: 'Cleans up every lane, both ways', body: `In the design drawn, one DSP handles all eight transmit lanes and all eight receive lanes, at ${MT.lane} per lane: ${MT.rate} each way, split into two independent ${MT.port} ports at the fibers. On transmit, host traces enter the DSP, then line-side traces fan out to the eight-channel driver and transmit bank. On receive, the eight-channel TIA feeds this same DSP, which recovers the signals and sends the data to the host. The LRO comparison keeps the DSP on transmit only and runs receive straight from the TIA to the host; the LPO comparison removes the DSP and connects the host directly to the linear driver and TIA.`,
      specs: [twinDsp, dspCount, ...(MT8 ? [] : [sharedDsp]), ...(opticalLanes ? [opticalLanes] : []), ['What it does', 'retiming, equalization, error correction', 'spec', { refs: [ref('juniper-1p6t-transceiver', '"The CDR is responsible for re-timing incoming data to reduce jitter. The DSP handles functions like equalization, error correction, and other signal processing tasks"')] }], dspFamilies, lroWhat, lroIa, lroAraT, lroDrawn] },
    { id: 'driver', title: 'Driver', kicker: 'Transmit only', body: 'The driver takes each outgoing lane from the DSP and swings a modulator’s electrodes with it, through bond wires to the photonic chip.', specs: [lpoKeeps, lay] },
    { id: 'lasers', title: 'Lasers', kicker: 'Light for the transmit side', body: 'Continuous-wave laser sources supply steady light to the transmit modulators. Their placement and coupling are representative; they do not feed the receive path.', specs: [sipDrawn] },
    { id: 'mzm', title: 'Modulators', kicker: 'Writing data onto light', body: 'Eight Mach-Zehnder modulators, one per lane. Each splits the lasers’ light into two arms, shifts one arm with the lane’s signal and recombines them, so the light brightens and dims with the data. Waveguides carry it to the fiber edge.',
      specs: [['Kind', 'Mach-Zehnder, a common silicon-photonics modulator design', 'reported', { refs: [ref('tspa-400g-lane-ofc', 'modulator section: Mach-Zehnder interferometer modulators, mature and high-bandwidth, the current commercial mainstream in silicon photonics')] }], sipDrawn] },
    { id: 'mpo', title: 'Fiber connectors', kicker: 'One fiber per lane, each way', body: 'Two MPO-12 connectors, one per DR4 half: positions 1–4 transmit, 9–12 receive, 5–8 unused. Half of each direction’s fibers go to each connector, which is why the transmit and receive fibers cross on the way.',
      specs: [...(opticalLanes ? [opticalLanes] : []), ...(reach ? [reach] : []), ['Connectors', 'dual MPO-12', 'spec', { refs: [ref('nvidia-mms4x00-ns', 'overview: the 800G twin-port uses "two 4-channel MPO-12/APC optical connectors"'), ref('juniper-1p6t-transceiver', 'optical interface: DR8 / 2×DR4 modules use dual MPO-12/APC connectors'), ref('nvidia-800g-dr8-datasheet', 'optical interface: two MPO-12/APC connectors on the twin-port DR8 module')] }], ['Fibers lit', '16: 4 out and 4 in per connector', 'spec', { refs: [ref('nvidia-800g-dr8-datasheet', 'optical interface: a twin-port DR8 module on two MPO-12/APC connectors, eight fibers active on each (four transmit, four receive)')] }], ['Receptacles', 'two, ferrules vertical, 10.0 mm apart', 'spec', { refs: [ref('osfp-msa', 'Rev 5.22 Fig 14-48, "Optical receptacle and channel orientation for Dual MPO connector": two vertical fiber columns, "10.0±0.6mm" apart (PDF p.154)'), ref('nvidia-mms4a00-datasheet', 'Option 2 drawing, "TRANCEIVEIR PORT VIEW": two vertical ferrules side by side (PDF p.16)')] }],
        ['Splitter cables, 800G twin-port generation', 'one MPO-12 port split into two 2-channel ends', 'spec', { refs: [ref('nvidia-mfp7e40-splitter', 'Introduction: "a single mode, 4-channel-to-two 2-channel splitter fiber" cable; the 4-channel end goes into a twin-port 800G OSFP, the 2-channel ends into two single-port 400G transceivers that run at 200G'), ref('nvidia-mfp7e20-splitter', 'Introduction: the multimode version, a "4-channel-to-two 2-channel splitter fiber cable"')] }],
        ['Splitter fibers', '8 lit at the 4-channel end, shared between the two ends', 'spec', { refs: [ref('nvidia-mfp7e20-splitter', 'Introduction: the MPO-12/APC "uses 8 active fibers to transmit light and 4 inactive fibers as strength members"; §2.1: "These cables have 8 individual fibers, 4 in each direction"'), ref('nvidia-mfp7e40-splitter', 'Introduction: the 2-channel ends run "with only 2 fibers" at 200G')] }], extLay] },
    { id: 'pd', title: 'Photodiodes', kicker: 'Receive only', body: 'In a silicon photonics design, as drawn, light from each receive fiber runs along a waveguide to a germanium photodiode on the same chip, which turns it into a small current. Other designs use separate photodiode chips.', specs: [['Receive, per module', '8 photodiodes, one per lane', 'spec', { refs: [ref('juniper-1p6t-transceiver', 'receive section: eight photodetectors and eight TIAs, one pair per optical lane')] }], lay] },
    { id: 'tia', title: 'TIA', kicker: 'Receive only', body: 'The transimpedance amplifier turns each photodiode’s current into a voltage and sends it to the DSP, or straight to the host in an LPO or half-retimed (LRO) module.', specs: [tiaDoes, lpoKeeps, lroTia, hostEq] },
  ];
  PARTS_HEAT.module = [
    { id: 'dsp', title: 'DSP', kicker: 'The major heat source', body: 'The shared DSP is the module’s major heat source, drawn with the most motion; the driver, TIA and lasers each make a fraction of its heat, and the modulators, photodiodes and fibers too little to draw. One gap pad carries the DSP’s heat up into the shell. The LRO comparison keeps a transmit-only DSP under the pad, with about half the motion; the LPO comparison removes both the DSP and its thermal pad, and an outline marks the absent chip’s footprint.', specs: [...dspPower, lroW, lroDove, heatScale] },
    { id: 'shell', title: 'Shell and fins', kicker: 'Cooled by the host’s air', body: 'The module has no fan of its own. Its finned top sits in the air the switch or server moves past the cages.', specs: [osfpSize, ['Lid print', `${MT.label}, as on this scenario’s switches; the LPO view adds LPO`, 'assumed', { assume: 'module-lid-labels' }], ...(modPower ? [modPower] : []), lay] },
  ];
  const lossRow = ['Electrical loss, NVIDIA figures', '≈4 dB, from 20–22 dB', 'vendor', { refs: [ref('nvidia-cpo-scaling-blog', 'body text: 22 dB for the pluggable path against approximately 4 dB with co-packaged optics'), ref('lambda-q3450-unboxing', '"Signal loss drops from roughly 20dB to 4dB"')], vs: 'the path to a pluggable module, 20–22 dB' }];
  // ---- Broadcom's engine as reported from its ISSCC 2026 paper 23.4 (research/cpo-landscape-2026-10-01.md) ----
  const bcmEic = ['Broadcom’s engine, as reported', 'one 7 nm electronic die per engine: all 64 transmit and receive channels, MZM drivers and TIAs', 'reported', { refs: [ref('tencent-broadcom-isscc-2026', `write-up of Broadcom’s ISSCC 2026 paper 23.4, chip section: "该CPO ASIC采用7nm FinFET工艺制造（图23.4.7），单片裸片集成64条发射/接收通道、TXPLL、辅助公共电路及ADC/DAC组件；6.4Tb/s光引擎通过7nm ASIC与PIC硅片的3D封装实现" (the CPO ASIC is made in a 7 nm FinFET process; a single die integrates the 64 transmit/receive channels, the transmit PLL, shared support circuits and ADC/DAC blocks; the 6.4 Tb/s optical engine is this 7 nm ASIC 3D-packaged with the photonic chip). Its transmit path ends in "MZM驱动器" (MZM drivers); its receive path is a "直接驱动TIA" (direct-drive TIA). This is the 51.2T (Tomahawk 5) generation at 106.25 Gb/s per lane; the paper itself was not opened.`), ref('semianalysis-isscc-2026', `Broadcom 6.4T Optical Engine - Paper 23.4: "One CPO package consists of eight 6.4T OEs, each with a PIC and an EIC, on TSMC's N7 process."`)] }];
  const bcmMzm = ['Broadcom, for comparison', 'Mach-Zehnder modulators (MZM), not rings', 'reported', { refs: [ref('semianalysis-isscc-2026', `Broadcom 6.4T Optical Engine - Paper 23.4: "Broadcom showcased progress on their 6.4T MZM optical engine (OE) consisting of 64 lanes of ~100G using PAM4 modulation."`), ref('tencent-broadcom-isscc-2026', 'title: "Broadcom基于7nm ASIC＋硅光MZM的3D集成6.4Tb/s" (Broadcom: a 7 nm ASIC plus silicon-photonics MZM, 3D-integrated, 6.4 Tb/s)')] }];
  // ---- the engine toggle, 10/01/2026: rows for the ring, Mach-Zehnder and one-die views (scenes/cpo-variants.js) ----
  const nvEic = ['Engine partition, as reported', 'drivers, TIAs and control logic on the electronic die; modulators and detectors on the photonic die (COUPE)', 'reported', { refs: [ref('semianalysis-cpo-newsletter', `Quantum-X Photonics section: "Each optical engine integrates a Photonic Integrated Circuit (PIC) built on a mature N65 process node, and an Electronic Integrated Circuit (EIC) fabricated on an advanced N6 node. The PIC leverages the older node because it contains optical components such as modulators, waveguides, and detectors—devices that do not benefit from scaling, and often perform better at larger geometries. In contrast, the EIC includes drivers, TIAs, and control logic, which benefit significantly from higher transistor density and improved power efficiency enabled by advanced nodes." TSMC COUPE section, Die fabrication: "The EIC is manufactured on the N7 node, integrating high-speed optical modulator drivers and TIAs." A report on the COUPE engines, not NVIDIA’s published floorplan.`)] }];
  const bcmLanes = ['Broadcom’s engine, lanes', '64 × 106.25 Gb/s PAM4, 6.4 Tb/s, for 51.2T (Tomahawk 5) switching', 'reported', { refs: [ref('tencent-broadcom-isscc-2026', 'opening: "发布了一款用于51.2T交换的6.4Tb/s CPO专用ASIC，该7nm ASIC与硅光芯片PIC进行3D封装，能量效率达到4.2pJ/b。" (it presented a 6.4 Tb/s CPO ASIC for 51.2T switching, the 7 nm ASIC 3D-packaged with the silicon-photonics PIC); conclusion: "该6.4Tb/s CPO ASIC通过64条106.25Gb/s PAM-4通道实现最高集成度和吞吐量" (the 6.4 Tb/s CPO ASIC reaches its integration and throughput through 64 lanes of 106.25 Gb/s PAM-4). The 4.2 pJ/b figure is not used here: the same post’s title says 4.5 pJ/b.'), ref('semianalysis-isscc-2026', 'Broadcom 6.4T Optical Engine - Paper 23.4: "The optical engines were tested in a Tomahawk 5 51.2T CPO system."')] }];
  const bcmSeg = ['Broadcom’s transmit drive, as reported', 'retimed, then three driver segments per MZM: one for the low bit, two for the high bit', 'reported', { refs: [ref('tencent-broadcom-isscc-2026', 'system architecture: "发射路径中，模拟前端（AFE）后接时钟数据恢复（CDR）模块，对来自主机的输入数据进行重定时和串并转换" (in the transmit path the analog front end is followed by a clock-and-data-recovery block that retimes and deserializes the host’s data); "串并转换后的数据流通过发射数字信号处理器（TX DSP）送入MZM驱动器，其中PAM-4信号的温度计编码支持利用最高有效位（MSB）数据同时驱动两个调制器分段。" (the data passes through a transmit DSP into the MZM driver, whose thermometer coding drives two modulator segments with the PAM-4 high bit); driver section: "这些位于8倍时钟（8t）域的数据流被分配至3个驱动器分段——第一个分段分配给LSB，后两个分配给MSB。" (the streams go to three driver segments: the first for the low bit, the other two for the high bit)')] }];
  const bcmRx = ['Broadcom’s receive, as reported', 'each TIA drives the switch chip directly through the package substrate', 'reported', { refs: [ref('tencent-broadcom-isscc-2026', 'receive section: "TIA差分输出通过有机基板直接驱动主机交换ASIC" (the TIA’s differential output drives the host switch ASIC directly through the organic substrate)')] }];
  const mzmSize = ['Modulator size, SemiAnalysis', 'Mach-Zehnder: millimeters long; rings: tens of microns', 'reported', { refs: [ref('semianalysis-cpo-newsletter', 'modulator section, Mach-Zehnder drawbacks: "Large form factor with dimensions measured in millimeter scale for length (compared to MRM in micron scale), since they require two waveguide arms and a combining region"; micro-ring advantages: "The are extremely compact (scale in the tens of microns), allowing far higher modulator density than MZMs."')] }];
  const odinMono = ['Ranovus Odin', 'one monolithic die: micro-ring modulators, photodetectors, RF drivers, TIAs, control logic', 'spec', { refs: [ref('ranovus-odin-jabil-2025', 'release body: "a groundbreaking monolithic Electronic and Photonic Integrated Circuit (EPIC) platform"; "Featuring monolithic integration of silicon photonics, RF drivers, transimpedance amplifiers (TIA), and control logic"; "Key innovations include patented silicon photonics-based Micro Ring Modulators (MRM), internal isolator-free laser sources, and high-performance photodetectors."')] }];
  const ayarMono = ['Ayar Labs TeraPHY', 'micro-ring based, electronics and photonics on one die; later designs may split them', 'reported', { refs: [ref('ayar-gf-monolithic-2020', 'opening: "Ayar Labs has successfully demonstrated its patented monolithic electronic/photonic solution on GLOBALFOUNDRIES (GF) next generation photonics solution based on its 45nm platform."; CEO quote: "Ayar Labs has been perfecting our micro-ring based monolithic electronic/photonic solution for nearly a decade."'), ref('semianalysis-cpo-newsletter', 'TSMC COUPE section: "Ayar Labs, who has previously relied on Global Foundries’ Fotonix platform for monolithic optical engines, now also has COUPE on their roadmap."'), ref('gazettabyte-ayar-teraphy-2026', 'From monolithic optics to modular chiplets: "This [TeraPHY optical I/O chiplet] architecture lets us move seamlessly through different foundry processes"; "The 8Tbps TeraPHY device is built using GlobalFoundries’ 45SPCLO 45nm silicon-photonics process"; "But the design can also be migrated to TSMC’s more advanced CMOS nodes for the electrical IC while benefiting from TSMC’s silicon photonics and packaging flows."')] }];
  const mrvlEngine = ['Marvell’s 6.4T engine', '32 × 200G; modulators, drivers and TIAs in one 3D-packaged device', 'spec', { refs: [ref('marvell-3d-sipho-2024', 'opening: "the industry’s first highly integrated SiPho engine featuring 32 channels of 200G electrical and optical interfaces"; body: "The Marvell 3D SiPho engine combines hundreds of components such as waveguides and modulators, photodetectors, modulator drivers, trans-impedance amplifiers, microcontrollers, and a host of other passive components into a single, unified device"; "The SiPho Engine leverages advanced 3D packaging and other Marvell technologies to integrate hundreds of components into a single device."'), ref('marvell-cpo-xpu-2025', 'body: "The Marvell 6.4T 3D SiPho Engine is a highly integrated optical engine with 32 channels of 200G electrical and optical interfaces"')] }];
  const cpoOpticsW = ['Optics power per 800G, SemiAnalysis estimate', '≈4–5 W for the Q3450’s engines and lasers, against ≈16–17 W for an 800G DR4 transceiver', 'reported', { refs: [ref('semianalysis-cpo-newsletter', 'power section: "While an 800G DR4 optical transceiver consumes about 16-17W, we estimate that the optical engine together with external laser sources used in Nvidia’s Q3450 CPO switch consume about 4-5W per 800G of bandwidth, a 73% reduction in power."')] }];
  // ---- the Mach-Zehnder package, 10/01/2026: Bailly-class, its own parts (scenes/cpo-bailly.js) ----
  const baillyPkg = ['Package, Broadcom', 'Tomahawk 5 switch chip and eight 6.4 Tb/s optical engines: 51.2 Tb/s', 'spec', { refs: [ref('broadcom-bailly-release-2024', 'opening: "The product integrates eight silicon photonics based 6.4-Tbps optical engines with Broadcom’s best-in-class StrataXGS® Tomahawk®5 switch chip."'), ref('semianalysis-isscc-2026', `Broadcom 6.4T Optical Engine - Paper 23.4: "One CPO package consists of eight 6.4T OEs, each with a PIC and an EIC, on TSMC's N7 process."`)] }];
  const baillyW = ['Optics power, Broadcom figure', '70% lower than pluggable transceivers', 'vendor', { vs: 'pluggable transceiver solutions', refs: [ref('broadcom-bailly-release-2024', 'opening: "Bailly enables the optical interconnect to operate at 70% lower power consumption and delivers an 8x improvement in silicon area efficiency as compared to pluggable transceiver solutions."')] }];
  const baillyEngine = ['Engine, Broadcom', '6.4T-FR4 engines with a Broadcom Fiber Connector (BFC)', 'spec', { refs: [ref('broadcom-bailly-release-2024', 'product highlights: "Broadcom 6.4T-FR4 Bailly SCIP optical engines with Broadcom Fiber Connector (BFC) for CPO systems"')] }];
  const baillyPorts = ['Front panel, Broadcom reference system', '128 × 400G FR4 ports on 128 duplex LC connectors', 'spec', { refs: [ref('broadcom-bailly-release-2024', 'product highlights: "4RU system design with high-efficiency air cooling to deliver 128 ports of 400G FR4 connectivity externally fiber-coupled with 128 duplex LC optical connectors"')] }];
  const baillyFibers = ['Data fibers per engine', '16 transmit and 16 receive', 'derived', { calc: 'bailly-fibers-per-engine' }];
  const baillyRlm = ['Lasers, Broadcom reference system', 'remote laser modules, field-replaceable', 'spec', { refs: [ref('broadcom-bailly-release-2024', 'product highlights: "System design compatible to support multiple remote laser modules (RLM) for field replaceability"')] }];
  const baillyEdge = ['Fiber attach, Broadcom', 'edge-coupled, high-density, automated', 'spec', { refs: [ref('broadcom-bailly-release-2024', 'body: "Broadcom’s innovative manufacturing approach that utilizes proven CMOS foundry processes, advanced packaging technologies and a highly automated high-density, edge-coupled fiber attach capability"')] }];
  const baillyCond = ['Signal conditioning, Broadcom', 'less needed with the engines on the switch chip’s substrate', 'spec', { refs: [ref('broadcom-bailly-release-2024', 'body: "The high degree of integration enables the placement of the optical engines on a common substrate with complex logic ASICs minimizing the need for signal conditioning circuitry."')] }];
  const baillyAir = ['Cooling, Broadcom reference system', '4RU, high-efficiency air cooling', 'spec', { refs: [ref('broadcom-bailly-release-2024', 'product highlights: "4RU system design with high-efficiency air cooling to deliver 128 ports of 400G FR4 connectivity"')] }];
  const fr4Lanes = ['400G FR4', 'four wavelengths share one fiber each way', 'spec', { refs: [ref('nvidia-linkx-interconnect', '"FR4 (far reach) supports up to two kilometers by multiplexing four channels of different laser wavelengths into a single fiber pair"'), ref('tiafotc-400gbase-fr4', '400GBASE-FR4, IEEE 802.3 clause 151: "400 Gb/s wavelength-division multiplexed (WDM) PAM4 serial transmission over 2 single-mode optical fibers, with reach up to at least 2 km"')] }];
  const baillyLay = ['Layout', 'representative; counts are Broadcom’s', 'assumed', { assume: 'cpo-bailly-layout' }];
  const bcmMath = ['Engine and package rate', '6.4 Tb/s per engine = 16 × 400G FR4 ports = 64 lanes × 100 Gb/s each way (106.25 Gb/s line rate); 8 engines × 6.4 Tb/s = 51.2 Tb/s', 'derived', { calc: 'bailly-engine-rate' }];
  const nvMath = ['Engine and package rate', '1.6 Tb/s per engine = 8 lanes × 200 Gb/s each way; 18 engines × 1.6 Tb/s = 28.8 Tb/s', 'derived', { calc: 'quantum-engine-rate' }];
  const sinkDrawn = ['Heat sink drawn', 'representative shape', 'assumed', { assume: 'cpo-bailly-layout' }];
  // ---- who ships CPO today, and where it is heading: status as of 10/01/2026 (research/cpo-landscape-2026-10-01.md) ----
  const nowSpectrum = ['NVIDIA Spectrum-X Ethernet Photonics', 'in production (NVIDIA, 05/31/2026); shipping to select partners (TrendForce, 07/27/2026)', 'reported', { refs: [ref('nvidia-vera-rubin-production-2026', 'summary line: "Vera Rubin introduces NVIDIA Spectrum-X Ethernet Photonics — now in production — combining co-packaged optics with Spectrum-X switching to enable million-GPU AI factories."'), ref('trendforce-cpo-ramp-2026', 'first paragraph: "NVIDIA has begun shipping its next-generation Spectrum-X CPO switch to select partners."'), ref('storagereview-nvidia-cpo-production', 'opening: "NVIDIA has moved Spectrum-X Ethernet Photonics, its co-packaged optics (CPO) Ethernet switch platform, into full production."')] }];
  const nowQuantum = ['NVIDIA Quantum-X InfiniBand Photonics', 'Q3450-LD, 144 × 800G ports; engineering samples at Lambda, 06/2026', 'reported', { refs: [ref('nvidia-silicon-photonics-page', 'Quantum-X section: "The NVIDIA Quantum-X800 InfiniBand platform includes CPO-based switches, including the Q3450-LD with 144 ports of 800 gigabits-per-second (Gb/s) InfiniBand."'), ref('lambda-q3450-unboxing', 'opening: "Lambda is taking an early look at co-packaged optics, starting with the NVIDIA Quantum-X InfiniBand Photonics Q3450-LD switch"; timing: "Engineering samples are a chance to work through rack design, cooling, power delivery, fiber routing, and the installation process with the vendor while the product is still becoming real."')] }];
  const nowDavisson = ['Broadcom TH6-Davisson', '102.4 Tb/s, 16 × 6.4T engines; announced 10/08/2025 as shipping, sampled to early-access customers', 'spec', { refs: [ref('broadcom-th6-davisson-release', `opening: "now shipping Tomahawk® 6 Davisson (TH6-Davisson), the company's third-generation Co-Packaged Optics (CPO) Ethernet switch"; product highlights: "16 x 6.4 Tbps Davisson DR Optical Engines"; availability: "Broadcom is currently sampling the TH6-Davisson BCM78919 device to its early access customers and partners."`)] }];
  const nowBailly = ['Broadcom TH5-Bailly, 51.2 Tb/s', 'in volume manufacturing with Delta and Micas Networks (TrendForce, 07/27/2026)', 'reported', { refs: [ref('trendforce-cpo-ramp-2026', `Broadcom paragraph: "Broadcom's 51.2T Bailly CPO switch has entered volume manufacturing with support from Delta Electronics and Micas Networks."`)] }];
  const nowMeta = ['Bailly in Meta’s lab, Broadcom figure', 'one million flap-free 400G port-hours', 'vendor', { refs: [ref('broadcom-cpo-reliability-meta', 'opening: "one million cumulative 400G equivalent port device hours of flap-free CPO operation at Meta"; "The absence of link flaps in Meta’s high-temperature lab characterization environment"; footnote: ECOC 2025 talk by Siamak Amiralizadeh, 09/30/2025')], vs: 'pluggable modules: "Compared to pluggable module solutions, the data highlights that CPO reduces optics power by 65 percent and also demonstrates higher link reliability."' }];
  const nextTray = ['Marvell compute tray, a concept', '4 XPUs, each with four 6.4T light engines: 102.4 Tb/s on 1,024 fibers, in 1U', 'vendor', { refs: [ref('marvell-cpo-tray-blog', 'The CPO Server Tray: "a conceptualized AI compute tray with CPO developed with products from SENKO Advanced Components and Marvell. The design contains room for four XPUs and up to 102.4 Tbps of bandwidth delivered through 1024 optical fibers, all in a 1U tray."; "Each XPU is connected to four Marvell 6.4T light engines for opto-electric conversions." The post later puts the total, with laser fibers, at 1,152.')], vs: 'copper scale-up, in Marvell’s words: "The density and reach enabled by CPO opens the door to scale-up domains far beyond what is possible with copper alone."' }];
  const nextSwitch = ['Marvell CPO switch, a reference design', 'switch chip + 16 light engines; 16 laser modules at the faceplate; 1OU with a cold plate', 'vendor', { refs: [ref('marvell-cpo-tray-blog', 'Heat and Space: "Marvell, SENKO, Jabil, and Mikros Technologies also recently unveiled a reference design of a data center CPO switch."; "surrounded by 16 light engine tiles and 1,152 fibers (128 laser fibers and 1,024 data fibers). The light engines are driven by 16 laser modules, which are connected to the faceplate for better serviceability."; "maintains a system height of 1OU"')], vs: 'air cooling: "conventional air cooling would require a chassis that is two to three times thicker"' }];
  const nextOci = ['OCI MSA, founded 03/12/2026', 'an open optical scale-up spec: AMD, Broadcom, Meta, Microsoft, NVIDIA, OpenAI', 'reported', { refs: [ref('oci-msa-founding-2026', 'opening: "The Optical Compute Interconnect (OCI) Multi-Source Agreement (MSA) group today announced its formation, led by founding members AMD, Broadcom, Meta, Microsoft, NVIDIA and OpenAI."; "OCI will enable migration from copper-based to optical-based scale-up architectures"; "Support for pluggable, on-board, and co-packaged optics (CPO)."')] }];
  const nextAyar = ['Ayar Labs, with GUC', 'optical engines on an XPU package: over 100 Tb/s, a package design', 'vendor', { refs: [ref('ayar-guc-cpo-2025', '"The new XPU multi-chip package (MCP) design replaces traditional electrical interconnects with Ayar Labs’ optical engines attached directly to the MCP organic substrate. This architecture enables more than 100 Tbps full-duplex optical interface from the XPU package, more than an order of magnitude improvement over current XPUs."')], vs: 'current XPUs, which Ayar Labs puts more than ten times lower' }];
  const nextLightmatter = ['Lightmatter Passage L200', '32 and 64 Tb/s 3D CPO engines for XPUs and switches; announced 03/31/2025 for 2026', 'vendor', { refs: [ref('lightmatter-l200-2025', '"The L200 3D CPO family includes both 32 Tbps and 64 Tbps versions, representing a 5 to 10x improvement over existing solutions."; "Available in 2026, Lightmatter’s L200 and L200X 3D CPO chips are designed to accelerate time to market and performance of next generation XPUs and switches"')], vs: 'existing interconnect solutions, which Lightmatter puts 5 to 10 times lower' }];
  const nextCelestial = ['Celestial AI', 'bought by Marvell, 02/02/2026, for optical scale-up', 'reported', { refs: [ref('marvell-celestial-close-2026', 'opening: "completed its previously announced acquisition of Celestial AI, a pioneer in optical interconnect technology for scale-up connectivity"; outlook: initial revenue "in the second half of fiscal 2028"')] }];
  const cpoToday = { id: 'today', title: 'Who ships CPO today', kicker: 'Switches, as of 10/01/2026', body: 'CPO in production today means network switches: a switch chip ringed by optical engines, in a standalone box in the scale-out network, like this package and the CPO switch set apart in the data hall. NVIDIA and Broadcom both make them, and NVIDIA names cloud providers among its first users. Pluggable modules still carry most optical links. Google’s optical circuit switches are something else: mirrors that steer light between ordinary transceivers, with no optics on a chip package.', specs: [nowSpectrum, nowQuantum, nowDavisson, nowBailly, nowMeta] };
  const cpoNext = { id: 'next', title: 'Where CPO is heading', kicker: 'Onto the GPU package, not there yet', body: 'The next step moves optical engines from the switch onto the GPU or accelerator package, so scale-up links could run on fiber past one rack. As of 10/01/2026 that is concepts, reference designs and early products, not shipping systems. Marvell has shown a 1U compute-tray concept and a reference CPO switch; Ayar Labs and Lightmatter offer optical engines meant for accelerator packages; Marvell bought Celestial AI for its optical scale-up fabric. Some designs put the drivers and TIAs on the same die as the photonics: Ranovus describes its Odin engine as a monolithic electronic and photonic integrated circuit, and Ayar Labs builds its TeraPHY optical I/O chiplets, for accelerator packages, on a micro-ring based monolithic electronic/photonic platform. Six companies founded the OCI MSA to write an open optical scale-up specification.', specs: [nextTray, nextSwitch, nextOci, nextAyar, nextLightmatter, nextCelestial, odinMono, ayarMono] };
  const ringRow = ['Modulators, NVIDIA figure', 'micro-rings, 200G PAM4 per wavelength', 'vendor', { refs: [ref('nvidia-cpo-industry-collaboration-blog', 'How TSMC helped solve Micro Ring Modulator problems: NVIDIA identifies microring modulation and a direct 200 Gb/s PAM4 rate per wavelength.')], vs: 'NVIDIA’s stated per-wavelength operating rate; not a comparison against another modulator design' }];
  PARTS.cpo = [
    { id: 'asic', title: 'Switch ASIC', kicker: 'Likely the package’s largest power draw', body: 'The switch chip does the switching and drives every lane a few millimeters to the optical engines around it. One of these packages is drawn; a Quantum-X Photonics switch holds four.', specs: [q3450W, cpoLay] },
    { id: 'engine', title: 'Optical engines', kicker: 'Powered from the package', body: 'Each engine is an electronic chip bonded on top of a photonic chip, fed from the package substrate like the switch chip beside it. One engine does the work of one 1.6T module: 8 lanes × 200 Gb/s = 1.6 Tb/s each way. This package holds 18, so 18 × 1.6 Tb/s = 28.8 Tb/s, the switch chip’s rate. The toggle above the view switches to a package with Mach-Zehnder modulators.', specs: [coupe, quantumOSA, perEngine, nvMath, cpoOpticsW] },
    { id: 'els', title: 'External laser sources', kicker: 'Swappable, at the front', body: 'The lasers are kept out of the hot package, in modules at the front panel that can be replaced without opening the switch. Five are shown here; their allocation to this package is illustrative. The switch’s 18 serve its four packages.', specs: [els18, els32] },
    // the Mach-Zehnder package's own parts: pinned only while the toggle shows it
    { id: 'mzm-asic', title: 'Switch ASIC', kicker: 'Tomahawk 5-class, 51.2 Tb/s', body: 'The switch chip does the switching and drives every lane a few millimeters to the eight engine tiles around it. Broadcom pairs its Tomahawk 5 with eight 6.4 Tb/s engines in Bailly.', specs: [baillyPkg, baillyW, baillyLay] },
    { id: 'mzm-engine', title: 'Optical engines', kicker: 'Eight tiles, 6.4 Tb/s each', body: 'Each engine is a tile, about twice as long as it is wide with its connector: its electronic die at the switch-chip end, fed from the package substrate like the switch chip, and its photonic die running out to a fiber connector at the package edge. One engine carries 6.4 Tb/s each way: 16 × 400G FR4 ports, which is 64 lanes × 100 Gb/s (106.25 Gb/s line rate). Eight engines × 6.4 Tb/s = 51.2 Tb/s.', specs: [baillyEngine, bcmEic, bcmLanes, bcmMath, baillyLay] },
    { id: 'mzm-laser', title: 'Remote laser modules', kicker: 'Swappable, at the front', body: 'The lasers sit in modules at the front panel that can be replaced in the field; fibers bring their light to each engine. Five are drawn, four of them used; how many a Bailly-class switch has and how they are shared is not drawn from a source.', specs: [baillyRlm, baillyLay] },
    cpoToday, cpoNext,
  ];
  PARTS_DATA.cpo = [
    { id: 'asic', title: 'Switch ASIC', kicker: 'The lanes start here', body: 'The switch chip’s SerDes drive its transmit lanes to the optical engines around it and recover its receive lanes from them.', specs: [['Per switch chip', '28.8 Tb/s each way', 'spec', { refs: [ref('nvidia-cpo-industry-collaboration-blog', 'Quantum-X section: 28.8 Tb/s full-duplex per switch ASIC')] }], portW] },
    { id: 'serdes', title: 'Package traces', kicker: 'Electrical, millimeters', body: 'Copper traces in the package substrate carry each lane from the switch chip to an engine’s electronic chip: a few millimeters, where a pluggable module sits centimeters away across a board. That shorter path is where CPO saves its power.', specs: [lossRow, cpoLay] },
    { id: 'eic', title: 'Electronic chip', kicker: 'Driver and TIA circuit blocks', body: 'The electronic die is drawn as bare silicon, with a seal ring at its edge and eight transmit-driver and eight receive-TIA circuit blocks. The inductors, power grid and bond-pad array drawn on it are generic features, not this die’s layout. Short electrical bonds connect these circuits to modulators and photodiodes on the photonic die below. These blocks are functions within the illustrated EIC, not separate board-mounted chips. SemiAnalysis reports this split for NVIDIA’s COUPE engines: drivers, TIAs and control logic on the electronic die, modulators and detectors on the photonic die. Their placement here is representative; NVIDIA has not published the die’s floorplan. Broadcom’s engine, as reported from its ISSCC 2026 paper, puts all 64 transmit and receive channels on one 7 nm electronic die. Marvell’s 6.4T engine also puts its drivers and TIAs in one 3D-packaged device with its photonics, without saying how its dies stack or which modulators it uses.', specs: [coupe, nvEic, bcmEic, cpoCircuits, mrvlEngine] },
    { id: 'rings', title: 'Ring modulators', kicker: 'Transmit', body: 'Tiny rings sit beside waveguides carrying laser light. Electrical driver signals shift each ring’s resonance, changing the transmitted light intensity to encode data. Slower thermal control keeps the operating point stable. The ring arrangement and waveguide routing are representative. Designs differ: Broadcom’s engines use Mach-Zehnder modulators, as reported from its ISSCC 2026 paper; the toggle above the view switches to a package that draws them.', specs: [ringRow, bcmMzm, perEngine, nvMath, mzmSize] },
    { id: 'pd', title: 'Photodiodes', kicker: 'Receive', body: 'In the illustrated partition, incoming light reaches photodiodes on the photonic die. Their electrical currents pass through short bonds to receive-TIA circuits on the electronic die above. The TIAs amplify these currents into voltage signals; light does not enter the electronic die. Circuit placement is representative.', specs: [perEngine, cpoLay, cpoCircuits, nvEic] },
    { id: 'els', title: 'External laser sources', kicker: 'Light in, no data', body: 'Laser light reaches each engine by fiber from modules at the front panel, two fibers per engine, drawn here running beside its data fibers. It carries no data until an engine’s rings put some on it.', specs: [els18, els32, fibers18] },
    { id: 'fiberout', title: 'Fiber out of the package', kicker: 'A sealed fiber interface', body: 'Each engine has eight transmit fibers and eight receive fibers. They continue outward through a sealed interface toward front-panel ports outside this diagram. The separate lower amber fibers supply laser light; they do not join the data fibers or form an engine-to-engine loop. Quantum-X uses socketed electrical connections for its three-engine optical subassemblies. Spectrum-X uses a detachable optical connector. The drawn blocks and fiber bends are representative; NVIDIA shows microlens surface coupling at the photonic die.', specs: [['Interface, Quantum-X', 'socketed subassemblies, sealed fiber interface', 'reported', { refs: [ref('nvidia-cpo-industry-collaboration-blog', 'How modular optical subassemblies ensure rapid deployment: the subassembly has a socket-based electrical interface to the main switch package and a hermetically sealed fiber interface to the engines.')] }], ['Spectrum-X, for comparison', 'a detachable optical connector', 'spec', { refs: [ref('nvidia-cpo-industry-collaboration-blog', 'body text: "Spectrum-X employs a detachable optical connector"')] }], fibers18, ['Front panel, Q3450', '144 MPO connectors', 'reported', { refs: [ref('lambda-q3450-unboxing', 'front panel: 144 MPO optical connectors for 144 × 800G ports')] }]] },
    { id: 'mzm-asic', title: 'Switch ASIC', kicker: 'The lanes start here', body: 'The switch chip’s SerDes drive its transmit lanes to the eight engines and recover its receive lanes from them: 64 lanes × 100 Gb/s = 6.4 Tb/s each way per engine, and 8 × 6.4 Tb/s = 51.2 Tb/s.', specs: [baillyPkg, bcmLanes, bcmMath] },
    { id: 'mzm-serdes', title: 'Package traces', kicker: 'Electrical, millimeters', body: 'Copper traces in the package substrate carry each lane from the switch chip to a tile’s electronic die, millimeters away. Broadcom says putting the engines on the switch chip’s substrate cuts the signal conditioning the link needs.', specs: [baillyCond, baillyLay] },
    { id: 'mzm-eic', title: 'Electronic chip', kicker: 'Over the electrical end', body: 'One electronic die per engine, bonded over the electrical end of the photonic die and reached from the package through vias in the photonic die (TSVs, a few drawn, representative): a driver block over each lane’s electrode segments and a TIA over each photodiode, with clocking, transmit DSP, ADC/DAC, test and power blocks drawn as representative. That follows the write-ups of Broadcom’s ISSCC 2026 paper 23.4: one 7 nm die carries all 64 transmit and receive channels and a transmit PLL, retimes transmit before its segmented MZM drivers, and sends each TIA’s output straight to the switch chip. All 64 lanes each way are drawn: 64 driver cells and 64 TIA cells.', specs: [bcmEic, bcmSeg, bcmLanes, baillyLay] },
    { id: 'mzm-mod', title: 'Mach-Zehnder modulators', kicker: 'Transmit', body: 'Each lane splits its laser light into two arms on the photonic die and joins it again. Electrodes along the arms carry the driver’s signal, which shifts the light’s phase, so the rejoined light brightens or dims with the data. As reported, each modulator is driven in three segments, one for the PAM4 signal’s low bit and two for its high bit; the segments lie under the electronic die, and past it the arms run on, with a bias heater, to where they rejoin. A multiplexer then puts four lanes at four wavelengths on one transmit fiber, as a 400G FR4 port does: 4 × 100 Gb/s = 400 Gb/s. All 64 modulators are drawn, as 16 such groups on 16 transmit fibers. Laser light arrives on two fibers and is tapped to each group’s wavelength demultiplexer; that split, the arrangement and the arm length are representative (real silicon Mach-Zehnder arms run millimeters).', specs: [bcmMzm, bcmSeg, mzmSize, fr4Lanes, baillyLay, bcmMath] },
    { id: 'mzm-pd', title: 'Photodiodes', kicker: 'Receive', body: 'Each receive fiber carries four wavelengths. A demultiplexer splits them to four photodiodes near the electrical end of the photonic die, under TIAs on the electronic die, which, in Broadcom’s design as reported, drive the switch chip directly through the package substrate.', specs: [bcmRx, fr4Lanes, baillyLay] },
    { id: 'mzm-laser', title: 'Remote laser modules', kicker: 'Light in, no data', body: 'Laser light reaches each engine by fiber from modules at the front panel, drawn running round the package low down and into each engine’s connector beside its data fibers. It carries no data until the modulators put some on it.', specs: [baillyRlm, baillyLay] },
    { id: 'mzm-fiberout', title: 'Fiber out of the package', kicker: 'A connector on each engine', body: 'Each engine’s fibers attach at the edge of its photonic die and leave through a Broadcom Fiber Connector at the tile’s outer end, toward front-panel LC ports outside this diagram. Sixteen 400G FR4 ports per engine make 16 transmit and 16 receive fibers.', specs: [baillyEngine, baillyEdge, baillyPorts, baillyFibers] },
    cpoToday, cpoNext,
  ];
  PARTS_HEAT.cpo = [
    { id: 'asic', title: 'Switch ASIC and engines', kicker: 'One package, one plate', body: 'The switch chip and the optical engines around it share one package, and their heat goes up into one cold plate. The switch chip makes most of it: each engine draws one faint stream beside the chip’s many.', specs: [lqd, plateDrawn, q3450W, portW, heatScale] },
    { id: 'coldplate', title: 'Cold plate', kicker: 'Water, not air', body: 'Water through the plate carries the package’s heat away. The lasers, at the front panel, stay out of it.', specs: [lqd, plateDrawn] },
    { id: 'mzm-asic', title: 'Switch ASIC and engines', kicker: 'One package, air-cooled', body: 'The switch chip and the eight engines share one package. Broadcom’s 51.2T reference system is air-cooled, so their heat goes up into a heat sink and away with the air.', specs: [baillyAir, sinkDrawn] },
    { id: 'mzm-sink', title: 'Heat sink', kicker: 'Air, not water', body: 'Air through the fin channels carries the package’s heat away; the lasers, at the front panel, stay out of it. The fins’ shape is representative.', specs: [baillyAir, sinkDrawn] },
  ];
  const zrPower = ['800ZR module, FiberMall ZR page', '24–25 W', 'reported', { refs: [ref('fibermall-800g-zr', 'power section: "800G ZR draws 24 to 25 watts"')] }];
  const zrPower2 = ['800G ZR tier, FiberMall guide', '20–30 W', 'reported', { refs: [ref('fibermall-coherent-guide', 'power table: 800G ZR modules "20-30W"')] }];
  const nanoItla = ['Nano-ITLA, JLT 2023 research example', '25.0 × 15.6 × 6.5 mm, under 3 W', 'reported', { refs: [ref('jlt-nano-itla-2023', 'abstract: "The Nano-ITLA is 25.0 mm (L) × 15.6 mm (W) × 6.5 mm (H)" and "less than 3 W total power consumption"')] }];
  const nitla17 = ['EFFECT Photonics nITLA17', '2.9 W', 'spec', { refs: [ref('effect-nitla17', 'specifications: 2.9 W power consumption')] }];
  const zrLaserSplit = ['Shared laser, same-wavelength link', 'CW light splits to the modulator and receiver local oscillator', 'reported', { refs: [ref('acacia-coherent-edge-access-2021', 'Page 10, Design optimization for Coherent BiDi inset: a same-wavelength transmitter and receiver can share a CW laser; its conventional coherent diagram shows the splitter branches to modulator and receiver LO. Different-wavelength BiDi needs a separate LO laser.')] }];
  const zrDspDrawing = ['Electrical routes drawn', 'four host-path groups; schematic, not a lane count or pinout', 'assumed', { assume: 'coherent-dsp-interfaces' }];
  const zrAnalogLayout = ['Drawn as', 'discrete driver and TIA packages; separate optical assemblies, representative', 'assumed', { assume: 'coherent-cdm-icr-architecture' }];
  // Package orientation in the OIF agreements: RF at one end, fibers at the other; the drawn order follows from it.
  const zrRfEnds = ['Optical packages, OIF agreements', 'RF pads at one end, fibers at the opposite end', 'spec', { refs: [ref('oif-micro-icr-ia', 'sec. 7.1: "For both form factors the fiber inputs and the RF electrical outputs are located on opposite ends of the package."'), ref('oif-hb-cdm-ia', 'Fig. 4-2: RF landing pads RF1–RF13 on the end opposite the input and output fiber boots'), ref('oif-ic-trosa-ia', 'sec. 9.1: "For both form factors the optical fiber interfaces and the RF electrical interfaces are located on opposite ends of the package."')] }];
  const zrOrder = ['Order as drawn', 'DSP → driver/TIA → optics → laser, short direct RF paths', 'assumed', { assume: 'coherent-module-layout' }];
  const zrCoPack = ['Common alternative, NeoPhotonics COSA', 'modulator co-packaged with drivers, receiver with TIAs', 'vendor', { vs: 'the discrete packages drawn here; a 64 GBd product announcement, not a teardown of this OSFP.', refs: [ref('neophotonics-cosa-2018', 'release text: "The COSA contains a coherent I/Q modulator co-packaged with drivers, as well as a coherent receiver co-packaged with trans-impedance amplifiers."')] }];
  const zrDriver = ['800G-class research example', 'separate 128 GBd driver IC', 'reported', { refs: [ref('sumitomo-coherent-ics-2025', 'Section 2 and Photo 1: separately developed driver IC; Section 4.1 later assembles it with an InP modulator in a CDM. Not a teardown of this OSFP.')] }];
  const zrTia = ['800G-class research example', 'separate 128 GBd TIA IC', 'reported', { refs: [ref('sumitomo-coherent-ics-2025', 'Section 3 and Photo 2: separately developed TIA; Section 4.1 later assembles it with detector optics in an ICR. Not a teardown of this OSFP.')] }];
  const zrOpticalLoss = ['Power and heat shown', 'optics’ bias well under half a watt; heat not drawn', 'assumed', { assume: 'coherent-optical-power-heat' }];
  PARTS_DATA.coherent = [
    { id: 'cdsp', title: 'Coherent DSP', kicker: 'Electrical signal processing', body: 'Host digital signals and optical-side analog signals land at distinct banks on the DSP package. Transmit processing and digital-to-analog conversion produce the driver signals; analog-to-digital conversion and receive processing recover data from the TIA outputs. These are processing paths, not straight wires through the chip. The DSP sits nearest the host connector, with the driver and TIA right beside its line-side edge. The four drawn host-path groups are schematic, not a lane count or pinout. Power figures cover the complete module.',
      specs: [['Skew, OIF IC-TROSA', 'high-speed contacts grouped to suit common coherent DSP ball maps', 'spec', { refs: [ref('oif-ic-trosa-ia', 'sec. 4.3: "To reduce high speed channel skew between IC-TROSA and most common coherent DSP ball maps the TX and RX contacts are grouped in a single outer row."')] }], ['Makers, per one 2026 survey', 'Cisco (Acacia), Marvell, Ciena, Nokia (Infinera)', 'reported', { refs: [ref('cignal-coherent-dsp-2026', 'coherent DSP supply chain survey: the companies with their own coherent DSP')] }], zrDspDrawing, zrPower, zrPower2, zrLay] },
    { id: 'driver', title: 'Modulator driver IC', kicker: 'Electrical signal in, electrical signal out', body: 'The driver sits in its own board-mounted electronic package beside the DSP’s line-side edge, separate from the optical modulator assembly. It amplifies the DSP’s analog transmit signals and sends electrical drive across short board connections to the modulator’s RF end; the modulator’s fibers leave from its other end. These high-speed paths are kept short and direct, so the laser sits elsewhere. This package arrangement is representative.',
      specs: [zrDriver, zrAnalogLayout, zrRfEnds, zrOrder, zrCoPack, ['Commercial example, 400G ZR/ZR+', 'CHR2094 driver paired with CHR1094 TIA', 'spec', { refs: [ref('coherent-analog-ics-2025', 'Product paragraph: CHR1094/CHR2094 chipset is for 400G ZR/ZR+ coherent links. The separately listed CHR2075 targets 800G/1.6T pluggables; that is not an 800ZR qualification for this coherent chipset.')] }], zrLay] },
    // Keep these two IDs for existing deep links; their labels describe optics, not CDM/ICR package boundaries.
    { id: 'cdm', title: 'Dual-polarization IQ modulator', kicker: 'Electrical drive changes the light', body: 'Laser light enters the optical modulator. Electrical signals from the separate driver control nested Mach–Zehnder modulators, changing amplitude and phase for each polarization. The modulated light then leaves for the transmit fiber. Its RF pads face the driver and the DSP; both fibers, laser light in and modulated light out, use the far end, as in the OIF HB-CDM. This standalone optical assembly excludes the separately packaged driver.',
      specs: [['Optical function', 'nested modulators for two polarizations', 'vendor', { vs: 'Lumentum HB-CDM product architecture; not a performance comparison or a teardown of this OSFP.', refs: [ref('lumentum-hb-cdm', 'Product description identifies two nested modulators and a four-channel driver as distinct components within its co-packaged CDM; this drawing separates the components for inspection.')] }], ['Modulation', 'DP-16QAM at ≈118 GBd', 'reported', { refs: [ref('mapyourtech-800zr', 'body text: DP-16QAM at roughly 118 Gbaud for 800ZR'), ref('fibermall-800g-zr', 'body text: DP-16QAM at roughly 118 Gbaud')] }], zrAnalogLayout, zrLay] },
    { id: 'itla', title: 'Tunable laser', kicker: 'One precise color, used twice', body: 'One continuous-wave laser feeds an optical splitter. One branch supplies the modulator’s transmit carrier; the other supplies the receiver’s local oscillator, the light reference mixed with the incoming signal. This shared-laser design assumes transmit and receive use the same nominal wavelength. The laser tunes across the C-band. It is drawn toward the fiber end, with its pigtail running back to the splitter, so it never sits between the DSP and the analog chips.',
      specs: [zrLaserSplit, nanoItla, nitla17, ['Pigtail, vendor nano-ITLA example', 'PANDA fiber, bend radius 5 mm or more; Molex board connector', 'spec', { refs: [ref('ldpd-nano-itla-c17', 'specifications table: "Fiber Type: PANDA Fiber, or equivalents", "Minimum Fiber Bend Radius: Equal or better than 5mm", "Electrical Interface: Molex 5054761010". The drawn flex tail and routing are representative.')] }], ['Tunes across', 'C-band, 1528.58–1567.34 nm', 'spec', { refs: [ref('cisco-800g-zr-datasheet', 'optical specifications table: C-band tuning range 1528.58–1567.34 nm')] }], ['Integrated example, Furukawa IC-TROSA', 'laser at the LC end; driver and TIA at the RF flex end', 'reported', { refs: [ref('furukawa-ic-trosa-2023', 'Fig. 1, top view of the IC-TROSA Type-2: RF flexible printed circuit with the 4-ch TIA and 4-ch DRV at one end, the laser chip and LC receptacle at the other. A single-package design, not this discrete board.')] }], zrOrder] },
    { id: 'icr', title: 'Receiver optics (hybrids + photodiodes)', kicker: 'Light becomes electrical current', body: 'Incoming light and local-oscillator light meet in 90-degree optical hybrids. Balanced photodiode pairs convert their outputs into four electrical signals: in-phase and quadrature for each polarization. Those currents travel over short electrical connections to the separately packaged TIA. The signal and local-oscillator fibers enter the far end, opposite the electrical outputs, as in the OIF micro-ICR. This standalone optical assembly excludes the TIA electronics.',
      specs: [zrRfEnds, ['Optical receiver function', 'two 90° hybrids, four balanced photodiode pairs', 'spec', { refs: [ref('oif-dpc-rx-architecture', 'Section 6, page 8: two 90-degree hybrid mixers, four balanced detector pairs and four linear amplifiers. Supports functional architecture, not this physical layout.')] }], zrAnalogLayout, zrLay] },
    { id: 'tia', title: 'Transimpedance amplifier IC', kicker: 'Detector currents become voltage signals', body: 'The TIA sits in its own board-mounted electronic package between the receiver optical assembly and the DSP, separate from both. It converts and amplifies photodiode currents into voltage signals and sends them a few millimeters to the DSP. Light stops at the photodiodes; no light enters this package. Its short connections are representative.',
      specs: [zrTia, zrRfEnds, zrOrder, zrCoPack, ['Commercial example, 400G ZR/ZR+', 'CHR1094: four channels, 64 GBd, wire-bonded die', 'spec', { refs: [ref('coherent-tia-products', 'CHR1094 product-table row: coherent, 4 channels, 64 GBaud, die/wire bonded, 400G ZR/ZR+. This example does not specify the TIA used in an 800ZR module.')] }], zrAnalogLayout, zrLay] },
    { id: 'lc', title: 'One fiber pair', kicker: '800G on one wavelength', body: 'Where a DR8 module needs sixteen fibers, a coherent module sends everything on one wavelength over one fiber each way, so a DWDM system can stack dozens of them on a single pair across a region.',
      specs: [['Connector', 'LC duplex', 'spec', { refs: [ref('cisco-800g-zr-datasheet', 'specifications: "Connector: LC duplex"')] }], ['Receptacle as drawn', 'body, sleeves and port pitch representative', 'assumed', { assume: 'coherent-lc-receptacle' }], ['Reach, Cisco modules', '120 km amplified (800ZR) · over 1,000 km amplified (ZR+) · 75–80 km unamplified', 'spec', { refs: [ref('cisco-800g-zr-datasheet', 'tables 1 and 2: "Up to 120 km amplified DWDM" (800ZR), "Over 1000 km amplified DWDM" (ZR+), and "Up to 75 km with 800ZR and 80 km with 800G ZR+" unamplified')] }], ['Standard', 'OIF 800ZR, published 10/30/2024', 'spec', { refs: [ref('oif-800zr-release', 'release: OIF-800ZR-01.0 implementation agreement, 10/30/2024')] }]] },
    { id: 'pluggable', title: 'Pull tab and label', kicker: 'One module in one router port', body: 'The whole assembly is an OSFP pluggable: it slides into a router or switch port, and a pull on the tab at the fiber end releases the latch. The label sits where the OSFP specification recommends, on top at the fiber end. Here the finned top housing is lifted and drawn in x-ray so the parts inside stay visible.',
      specs: [['Form factors, Cisco 800G ZR/ZR+', 'QSFP-DD and OSFP', 'spec', { refs: [ref('cisco-800g-zr-datasheet', 'ordering table and compliance: QSFP-DD and OSFP versions; "the Cisco 800G OSFP optical modules are mechanically compliant with the OSFP MSA"')] }],
        ['OSFP module, MSA', '22.58 mm wide, 13.0 mm tall', 'spec', { refs: [ref('osfp-msa', 'Fig. 3-2, OSFP overall dimensions: width 22.58 ± 0.10 mm, height 13.00 mm inside the cage')] }],
        ['Label location, MSA', 'top face at the fiber end, about 15 × 20 mm', 'spec', { refs: [ref('osfp-msa', 'sec. 3.2: "Figure 3-4 shows the recommended reference locations for the label"; Fig. 3-4 draws a (15.0) × (20.0) mm label at the front of the top face')] }],
        ['Length with pull tab, Cisco OSFP 800G', '116 mm max', 'spec', { vs: 'Cisco’s non-coherent OSFP 800G modules; used here only as a length bound for the drawn tab.', refs: [ref('cisco-osfp-800g-datasheet', 'Table 6, "Module dimension with pull tab": "(H x W x D) 13 x 22.58 x 116 mm (0.51 x 0.89 x 4.57 in.) max"')] }],
        ['Pull tab color as drawn', 'white, the MSA color for 1550 nm modules; no coherent row', 'assumed', { assume: 'coherent-pull-tab' }],
        ['Label and tab as drawn', 'wording, stock and tab shape representative', 'assumed', { assume: 'coherent-pull-tab' }]] },
  ];
  PARTS.coherent = [
    { id: 'cdsp', title: 'Coherent DSP', kicker: 'Electrical signal processing', body: 'The host supplies DC power to the coherent DSP. Its transmit and receive processing both consume energy. The cited wattage is for the complete module, not the DSP alone.', specs: [zrPower, zrLay] },
    { id: 'itla', title: 'Tunable laser', kicker: 'Electrical power to laser light', body: 'The laser’s electrical supply powers its light source and tuning controls. Optical carrier and local-oscillator light split from the same source; the two light paths are not electrical supply wires.', specs: [zrLaserSplit, nanoItla, nitla17, zrLay] },
    { id: 'driver', title: 'Modulator driver IC', kicker: 'Separate powered electronics', body: 'The discrete driver package has its own electrical supply and sends the modulation drive to the separate optical assembly. The supply feed and the high-speed signal links serve different purposes. No individual chip wattage is assigned.', specs: [zrDriver, zrAnalogLayout, zrLay] },
    { id: 'cdm', title: 'Dual-polarization IQ modulator', kicker: 'Electrical drive and optical carrier', body: 'The modulator receives high-speed electrical drive from the separate driver and light from the laser. Bias and control connections are qualitative; the drawing does not assign the modulator its own share of module power.', specs: [zrOpticalLoss, zrAnalogLayout, zrLay] },
    { id: 'icr', title: 'Receiver optics (hybrids + photodiodes)', kicker: 'Photodetector bias', body: 'The photodiodes convert light to electrical current. Their illustrated bias feed is distinct from the incoming optical paths and the small detector signals going to the TIA. No receiver-optics wattage is specified.', specs: [zrOpticalLoss, zrAnalogLayout, zrLay] },
    { id: 'tia', title: 'Transimpedance amplifier IC', kicker: 'Separate receiver electronics', body: 'The discrete TIA package receives its own electrical supply to amplify detector currents for the DSP. Its supply wire carries power; the nearby photodiode connections carry the received electrical signal.', specs: [zrTia, zrAnalogLayout, zrLay] },
  ];
  PARTS_HEAT.coherent = [
    { id: 'cdsp', title: 'DSP heat', kicker: 'Conduction toward the shell', body: 'Signal processing turns electrical power into heat, most of the module’s. The marks show its path toward the shell, with the most motion of any part; the exploded display gap is not a physical thermal interface.', specs: [heatScale, zrPower, ['Drawn above the DSP', 'finned top housing, pedestal and gap pad; representative', 'assumed', { assume: 'coherent-dsp-thermal-stack' }], zrLay] },
    { id: 'itla', title: 'Laser heat', kicker: 'Light generation and temperature control', body: 'Electrical losses in the tunable laser and its controls must leave through the module’s thermal structure. The shell is shown in x-ray for inspection. At about 3 W against the DSP’s much larger share, it draws less motion.', specs: [nanoItla, nitla17, heatScale, zrLay] },
    { id: 'driver', title: 'Driver IC heat', kicker: 'Transmit amplifier losses', body: 'Driving the modulators dissipates heat in the discrete driver package. The animation marks heat leaving this package toward the shell, scaled to an assumed couple of watts, without specifying a particular thermal interface.', specs: [zrDriver, heatScale, zrLay] },
    { id: 'cdm', title: 'Modulator losses', kicker: 'Too little to draw', body: 'Optical absorption and the modulator’s bias make a little heat, well under half a watt, far less than the separate driver that swings it. That is below the threshold the site draws, so no heat rises from it; the driver’s heat is drawn at its own package.', specs: [zrOpticalLoss, heatScale, zrLay] },
    { id: 'icr', title: 'Receiver-optics losses', kicker: 'Too little to draw', body: 'Photodetection absorbs light, and detector bias adds a trace of heat: milliwatts, too little to draw. The TIA’s electronic losses are drawn at its separate chip, not folded into this optical block.', specs: [zrOpticalLoss, heatScale, zrLay] },
    { id: 'tia', title: 'TIA IC heat', kicker: 'Receive amplifier losses', body: 'The powered TIA dissipates heat while amplifying detector currents, about a watt as assumed here: the faintest of the drawn sources, still more than the receiver optics beside it, which draw none.', specs: [zrTia, heatScale, zrLay] },
  ];
  PARTS_DATA.copper = [
    { id: 'dac', title: 'Direct Attach Copper (DAC)', kicker: 'No active signal conditioning', body: 'Twinax pairs run straight from the plug’s card into the cable, so the copper’s own loss limits it to a meter or two at today’s rates, and it draws only a little power, for its ID memory. The documented GB200 NVL72 spine is passive copper too, though built as fixed cable cartridges the trays plug into, not cables like this one.', specs: [dacNone, dacW, dacReach, spinePassive, headLay] },
    { id: 'acc', title: 'Active Copper Cable (ACC)', kicker: 'One redriver', body: 'A small analog chip boosts and equalizes the signal arriving at the plug, the receive direction, but does not recover its clock. NVIDIA’s version puts one in each end. It buys a little more reach for a couple of watts.', specs: [accChip, accW, headLay] },
    { id: 'aec', title: 'Active Electrical Cable (AEC)', kicker: 'A retimer in each end', body: 'Each end holds a DSP retimer, the same general kind of chip an optical module uses on its electrical side, for both directions: it recovers the clock and rebuilds the signal. That reaches several meters, at several times the power.', specs: [aecChip, aecW, headLay] },
  ];
  PARTS.copper = [
    { id: 'dac', title: 'Direct Attach Copper (DAC)', kicker: 'About 0.1 W per end', body: 'No redriver or retimer to power; the plug’s small ID memory draws a little. NVIDIA’s documented GB200 NVL72 spine is passive copper too, as fixed cable cartridges rather than pluggable cables.', specs: [dacW, dacNone, spinePassive, glowScale] },
    { id: 'acc', title: 'Active Copper Cable (ACC)', kicker: 'A couple of watts', body: 'One small analog chip in the plug, powered from the port.', specs: [accW, accChip, glowScale] },
    { id: 'aec', title: 'Active Electrical Cable (AEC)', kicker: 'A DSP in each end', body: 'Two DSP retimers per cable, one in each plug, each drawing power from its port.', specs: [aecW, aecChip, glowScale] },
  ];
  PARTS_HEAT.copper = [
    { id: 'acc', title: 'Redriver heat', kicker: 'A couple of watts', body: 'The analog redriver draws power from the port and warms the plug. Moving marks show heat reaching the case and surroundings, less of it than from the AEC’s retimer. The case is lifted for inspection: the display gap is not a real thermal interface.', specs: [accW, accChip, heatScale, headLay] },
    { id: 'aec', title: 'Retimer heat', kicker: 'The hottest plug', body: 'The retimer handles both signal directions and draws several times an ACC’s power from the port. Its heat must leave through the plug and its surroundings, so it draws the most motion here. This representative animation shows that transfer across the exploded display gap; it does not specify cooling hardware or temperature.', specs: [aecW, aecChip, heatScale, headLay] },
  ];
  // doors: the NVL72 rack's NVLink spine opens the copper cables; the line terminals at Scale across and the campus's
  // line-terminal cutaway open the data center interconnect's coherent module
  for (const P of [PARTS.rack, PARTS_DATA.rack]) { const sp = P?.find(p => p.id === 'spine'); if (sp) Object.assign(sp, { drill: 9, trip: 'copper' }); }
  { const d = PARTS_DATA.across?.find(p => p.id === 'dci'); if (d) Object.assign(d, { drill: 8, trip: 'coherent' }); }
  { const d = PARTS_DATA.campus?.find(p => p.id === 'lineterm'); if (d) Object.assign(d, { drill: 8 }); }   // the cutaway, with the router's coherent pluggables; the hut card points to it (Reed, 10/01/2026)

  // doors into the side level for the power and heat layers, never a level's last card (a trip comes back out to its
  // level before the tour moves on) (the data layer's are the tray's module cages and the
  // hall's CPO card): each opens the half of the level that lives there, and the every-part tours take the trip
  const doorModule = { id: 'osfp', title: 'Optical modules', drill: 6, trip: 'module', doorName: MT.label };
  const doorCpo = { id: 'cpo', title: 'Co-packaged optics', drill: 7, trip: 'cpo' };
  // the tray door's power rows follow the NIC-side module: NVIDIA's rating where it publishes one (GB200's single-port
  // 400G, the DGX H100's 800G twin-port), otherwise the DSP makers' 1.6T figures, labeled as the switch-end class
  const trayW = A.id === 'gb200'
    ? [['NIC module, NVIDIA single-port 400G DR4', '9 W max', 'spec', { refs: [ref('nvidia-mms4x00-ns400', 'specifications table: "Maximum Power consumption (400G)", 9 W')] }]]
    : A.id === 'h100'
      ? [['NIC module, NVIDIA 800G twin-port (flat top)', '17 W max', 'spec', { refs: [ref('nvidia-mms4x00-ns', 'overview: "Twin-port single mode OSFP transceivers remain at 17 Watts for all configurations"')] }]]
      : [[`1.6T switch-end module, Broadcom figure`, dspW[1], dspW[2], dspW[3]], ['1.6T switch-end module, Marvell Ara figure', marvellW[1], marvellW[2], marvellW[3]]];
  PARTS.tray = [...PARTS.tray.slice(0, -1), { ...doorModule, kicker: 'Power at the front edge', body: 'Each scale-out port’s module takes its power from the host it plugs into. Inside, the DSP is a major share of it.', specs: trayW }, PARTS.tray.at(-1)];
  PARTS_HEAT.tray = [...PARTS_HEAT.tray.slice(0, -1), { ...doorModule, kicker: 'Heat at the front edge', body: 'Heat leaves each module through its shell into the host cage and cooling hardware. The switch-side example has a finned top; server-side flat-top modules use the host’s cooling arrangement.', specs: [...trayW, osfpSize] }, PARTS_HEAT.tray.at(-1)];
  PARTS.hall = [...PARTS.hall.slice(0, -1), { ...doorCpo, kicker: 'A comparison, not deployed here', body: 'This scenario’s switches use pluggable modules. The CPO switch set apart at the end of the spine row is a comparison: NVIDIA puts co-packaged optics at as low as 9 W a port, against 30 W with pluggables.', specs: [portW, q3450W] }, PARTS.hall.at(-1)];
  PARTS.hall.splice(PARTS.hall.length - 2, 0, {
    id: 'optics', title: 'Optical modules', drill: 6, doorName: MT.label, kicker: 'Powered through the host switch',
    body: `Hall distribution feeds the network racks. Inside each switch, its power supply and board regulators provide 3.3 V DC to the pluggable modules through their electrical connectors. The fibers carry light, not the module’s electrical supply. The hall shows representative rack feeds; go inside to follow power from the host connector through this scenario’s switch module, ${mtName}, drawn with representative internals.`,
    specs: [supply, pins],
  });
  PARTS_HEAT.hall = [...PARTS_HEAT.hall.slice(0, -1), { ...doorCpo, kicker: 'Liquid-cooled', body: 'The comparison CPO switch cools its switch chips and their optics with liquid, rather than blowing air across front-panel modules. Inside, the package drawn at this door has one cold plate, as a representative layout.', specs: [lqd] }, PARTS_HEAT.hall.at(-1)];

  // The numbered parts at a level (pins, the list, "Play 1 to N") read as one walk: the way the thing flows, without
  // the camera crossing the scene and back. Levels not listed already read that way as written. Reviewed 09/27/2026.
  for (const [P, walk] of [[PARTS, WALK.power], [PARTS_DATA, WALK.data], [PARTS_HEAT, WALK.heat]])
    for (const [sc, ids] of Object.entries(walk)) if (P[sc]) P[sc] = [...P[sc]].sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));

  return {
    SCENES, PARTS, PARTS_DATA, PARTS_HEAT, BOM, TEMPS, PARALLEL, LEDGER_END,
    LEDGER: M.ledger, LEDGER_MARKS: M.marks, STAIRCASE: M.staircase, BANDWIDTH: M.bandwidth,
  };
}
