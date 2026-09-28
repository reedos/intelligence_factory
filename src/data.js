// Content model for The Intelligence Factory.
// Every figure carries a basis and its evidence (src/evidence.js): a published spec, a vendor claim or a published
// report cites its sources, a calculation names how the model makes it, an assumption says why.
// The page shows the basis beside the figure; the chip opens its evidence.
import { BASIS } from './evidence.js';
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
  eth: { css: '#a6f35a', name: 'Scale-out, optical', short: '800G' },
  dci: { css: '#ffd35c', name: 'DWDM fiber', short: 'DWDM' },
  hbi: { css: '#7fe3ff', name: 'Die to die', short: 'NV-HBI' },
  hbm: { css: '#b08cff', name: 'HBM', short: 'HBM' },
  tx: { css: '#62e6ff', name: 'Light out, transmit', short: 'TX' },
  rx: { css: '#ff7ad9', name: 'Light in, receive', short: 'RX' },
  cw: { css: '#ffb347', name: 'Laser light, no data', short: 'laser' },
  v33: { css: '#8fd3ff', name: '3.3 V DC', short: '3.3 V' },
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
    nic: 'ConnectX-9 SuperNIC', nicNote: '1.6 Tb/s per GPU, pre-launch', mBasis: 'est',
  },
};

// Everything below depends on the scenario, so it is built from the model on every change.
export const WALK = {
  // west yard once (the batteries sit by the substation), then the one trip east to the generators, then the halls
  power: { campus: ['line', 'substation', 'mpt', 'ehouse', 'bess', 'gensets', 'fuel', 'unitsubs', 'hall', 'drycoolers', 'chillers', 'towers', 'fiber'] },
  // outside in, the way a byte arrives; the H100 rack shows its optics before the ports they plug into, like the NVL72
  data: { across: ['remote', 'route', 'ila', 'dci', 'home'], rack: ['tp', 'servers', 'nvswitch', 'spine', 'optical', 'uplinks', 'compute', 'mgmt'] },
  // the hot aisle before the units that pull air out of it
  heat: { hall: ['cdu', 'hotaisle', 'inrow', 'fanwall', 'fwater', 'riser'] },
};

// average heat flux through the compute dies, W/cm²: the dies' power (the package less its HBM share) over their area
export const dieFlux = A => Math.round(A.gpuW * (1 - A.hbmShare) / FACTS[A.id].dieCm2 / 5) * 5;

export function content(M) {
  const { accel: A, power: P, cooling: CL, NET, racks: RACKS, gpus: GPUS, IT_MW, layout: L, rack: RK } = M;
  const X = FACTS[A.id];
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
        : 'Two heat paths leave every rack. Most goes into water, through a coolant unit at the row end to the facility loop overhead. The rest is hot air, trapped in the aisle between rack backs and pulled through the fan wall.',
      dataIntro: `Scale-out lives here. Every GPU gets its own optical port. Fibers run up from each rack into yellow runways, to leaf switches at the row ends and on to the spine, so any GPU can reach any other in a few microseconds.`,
      intro: (dc
        ? 'Solid-state transformers take 34.5 kV and make 800 V DC in one step, with batteries on the DC bus instead of a UPS. DC busway carries 800 V over the rows into every rack.'
        : 'Outside the wall a unit substation drops 34.5 kV to 480 V. Inside, switchgear and UPS modules feed overhead busway at 415 V that drops into every rack.')
        + (air ? ' Chilled water runs overhead to cooling units in every row.' : ' Facility water runs overhead to coolant units at the ends of each row.'),
    },
    nvl ? {
      id: 'rack', n: 4, title: 'The rack', scale: '2.3 m tall', unit: 1, volt: 'dc', dataVolt: 'nvl', heatVolt: 'warm', heatShort: `≈${Math.round(liq * 100)}% water`,
      heatIntro: liq >= 0.99
        ? `All of a ${rackKW} kW rack's heat is reported to leave in water: even the switch trays and power shelves sit on cold plates.`
        : `About ${liqKW} of a rack’s ${rackKW} kW leaves in the water manifolds down the back. The rest, from power shelves, switches, optics and drives, leaves as hot air out the rear door.`,
      dataIntro: `Scale-up lives here. Copper ${A.nvlink.gen} ties all 72 GPUs to the nine switch trays in the middle, so the rack behaves like one giant GPU. Only the scale-out ports leave the rack, as fiber.`,
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
      id: 'tray', n: 5, title: 'Compute tray', scale: '44 cm wide', unit: 0.1, volt: 'bus12', dataVolt: 'eth', heatVolt: 'cool', heatShort: 'cold plates',
      heatIntro: liq >= 0.99
        ? 'Coolant enters at the back, runs through a copper plate on each CPU and GPU, and leaves warmer. This model puts the NICs, optics and drives on cold plates too, so no air crosses the tray; the fans at the front are drawn for comparison and stand still.'
        : 'Coolant enters at the back, runs through a copper plate on each CPU and GPU, and leaves warmer. Fans at the front still push air over the parts water does not touch: NICs, optics, drives.',
      dataIntro: `Each GPU has three ways out: NVLink to the rack spine at the back, NVLink-C2C to its ${X.cpu} CPU, and a SuperNIC whose optical module at the front turns its traffic into light.`,
      intro: 'Each tray clips onto the busbar at about 50 V. Bus converters drop that to 12 V, and rings of voltage regulators around each GPU make the final step to under a volt, right beside the chip.',
    } : {
      id: 'tray', n: 5, title: 'DGX H100 server', scale: '48 cm wide', unit: 0.1, volt: 'bus12', dataVolt: 'eth', heatVolt: 'air', heatShort: 'heat sinks',
      heatIntro: 'Twelve fans pull air across tall copper-and-aluminum heat sinks on the eight GPUs, then over the CPUs and memory, and out the back.',
      dataIntro: 'Eight GPUs share one NVLink domain through four NVSwitch chips on the baseboard. Everything else goes over PCIe: to the CPUs, and to eight ConnectX-7 NICs whose optical modules leave the back of the server.',
      intro: 'Six power supplies at the back turn AC into 54 V. The GPU baseboard steps that to 12 V, and voltage regulators around each GPU make the final step to under a volt.',
    },
    {
      id: 'chip', n: 6, title: 'GPU package & tokens', scale: '10 cm across', unit: 0.01, volt: 'core', dataVolt: 'hbm', heatVolt: 'hot', heatShort: 'die, hottest',
      heatIntro: `Every watt that arrives turns into heat inside ${A.dies > 1 ? 'two dies' : 'one die'} smaller than a postcard. It climbs through a thermal interface and the lid into ${nvl ? 'the cold plate' : 'the heat sink'}; the hard part is getting it out of the silicon fast enough.`,
      dataIntro: A.dies > 1
        ? `The fastest links are the shortest. HBM feeds the dies at ${hbmTB} over millimeters, the two dies talk at 10 TB/s across their seam, and ${A.nvlink.gen} leaves the package edge at ${nvlTB}.`
        : `The fastest links are the shortest. HBM feeds the die at ${hbmTB} over millimeters, and 18 ${A.nvlink.gen} links leave the package edge at ${nvlTB}.`,
      intro: `The last millimeter: over a thousand amps climb through solder balls and the substrate into ${A.dies > 1 ? 'two silicon dies' : 'one silicon die'} and ${A.id === 'h100' ? 'five working HBM stacks' : `${A.hbm.stacks} HBM stacks`}. What leaves is heat, and tokens.`,
    },
    // the side level: entered from a module cage on the tray or the CPO switch in the hall, not part of the line
    {
      id: 'optics', n: '+', side: true, title: 'Inside the optics', scale: '11 cm long', unit: 0.01, volt: 'v33', dataVolt: 'eth', heatVolt: 'hot', heatShort: 'fins and a plate',
      intro: 'Two ways to turn electrical lanes into light, side by side at the same scale. On the left, a pluggable module that slides into a cage on the tray or a switch; on the right, a switch package with the optics built around the switch chip itself.',
      dataIntro: 'Follow one lane each way. On the left, electrical lanes come in at the edge connector, a DSP cleans them up, drivers swing the modulators, and light leaves through the fiber; light coming back hits a photodiode and runs the same chain in reverse. On the right, the switch chip hands its lanes a few millimeters to an optical engine instead, and laser light arrives from separate modules at the front panel.',
      heatIntro: 'In the module, the DSP is the hottest part: its heat crosses a gap pad into the shell and leaves through the fins in the air the switch or server blows past. The co-packaged switch sits under a cold plate, with the optical engines beside the switch chip in the same water-cooled package.',
    },
  ];

  // ---------- power-mode parts per scene. The 3D scene supplies positions; this supplies what to say ----------
  // specs: [label, value, basis]
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
      ] },
    { id: 'plants', title: 'Generation', kicker: 'Gas, nuclear, wind, solar',
      body: 'Plants inject power into the grid far from the campus; the grid delivers it with about 5% lost on the way.',
      specs: [['US grid losses', '≈5% (EIA)', 'spec', { refs: [['eia-td-losses', 'FAQ answer: "annual electricity transmission and distribution (T&D) losses averaged about 5% of the electricity transmitted and distributed in the United States in 2018 through 2022"']] }]] },
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
        ['Yard', '≈200 × 150 m gravel pad', 'assumed', evAssume('substation-layout')],
        ['Interconnection study', '1–3 years alone', 'reported', evRefs([['atk-substation-construction', 'blog: "System impact studies, facilities studies, and any required network upgrades can run twelve to thirty-six months depending on the region"']])],
      ] },
    { id: 'mpt', title: 'Main power transformers', kicker: '345 kV → 34.5 kV',
      body: `Oil-filled transformers, each the weight of a loaded freight car, step the line down to the campus distribution voltage. Radiators and fans shed their heat; concrete fire walls keep one fire from taking the others.${L.transformers > 3 ? ` Three are drawn; this campus needs ${L.transformers}.` : ''}`,
      specs: [
        ['Rating', `${L.transformers} × ${L.mvaUnit} MVA, N+1`, 'derived', evCalc('campus-transformer-count')],
        ['Efficiency, 345 kV class', '>99.6% at all loading levels', 'spec', evRefs([['pa-transformer-345kv', 'product page: "High efficiency: exceeding 99.6% at all loading levels"']])],
        [`Loss at ${meter}`, lossTxt('Main power'), 'derived', evCalc('campus-transformer-loss')],
        ['Lead time, 2026', '128–144 weeks', 'reported', evRefs([['industrialsage-transformer-leadtimes', 'quoting a Wood Mackenzie Q2 2025 survey: "standard power transformers average 128 weeks for delivery"; generator step-up units "average 144 weeks"']])],
      ] },
    { id: 'ehouse', title: '34.5 kV switchgear', kicker: 'Campus distribution',
      body: 'Prefabricated switchgear buildings split the transformer output into feeders, each breaker-protected, that run in concrete duct banks under the roads to the data halls.',
      specs: [
        ['Feeders', `≈${n0(L.feeders)}, each ≈10 MW`, 'derived', evCalc('campus-feeder-count')],
        ['Voltage', '34.5 kV (some campuses use 13.8 kV)', 'reported', evRefs([['mv-distribution-atk', 'blog: "On a large campus, 34.5 kV has become the standard distribution voltage because it carries more power with fewer and smaller feeders than 13.8 kV"']])],
        ['Loss, cables + gear', lossTxt('Campus cables'), 'derived', evCalc('campus-cable-loss')],
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
      ] },
    ]),
    { id: 'fiber', title: 'Fiber entrances', kicker: 'Two diverse routes',
      body: 'Long-haul fiber enters at two vaults on opposite sides of the site, so one backhoe cannot cut the campus off. Tokens leave the same way the questions arrive.',
      specs: [['Routes', '2 or more, physically separate', 'reported', evRefs([['trg-diverse-fiber-routes', '"A properly designed facility has dual fiber entrances. Fiber enters from two separate locations, following different physical paths into the building."']])]] },
  ];
  // evidence shared by more than one hall card: the NIC line rate a GPU gets, and the accelerator's published
  // rack-power range, both drawn from a shipping datasheet for h100/gb200/gb300 and carried as pre-launch
  // assumptions for rubin (see ASSUMPTIONS 'rubin-prelaunch-specs' / 'rubin-prelaunch-power')
  const nicSpecEv = A.id === 'rubin' ? { assume: 'rubin-prelaunch-specs' }
    : { refs: [[A.id === 'h100' ? 'nvidia-dgx-h100' : A.id === 'gb200' ? 'nvidia-coreweave-gb200-400g' : 'nvidia-connectx8-datasheet',
        A.id === 'h100' ? 'product page: eight ConnectX-7 400 Gb/s network adapters, one per GPU'
        : A.id === 'gb200' ? '"NVIDIA Quantum-2 InfiniBand networking that delivers 400Gb/s bandwidth per GPU"'
        : 'ConnectX-8 SuperNIC datasheet: 800 Gb/s port speed']] };
  const nicSpecBasis = A.id === 'rubin' ? 'assumed' : 'spec';
  const rackPublishedEv = A.id === 'rubin' ? { assume: 'rubin-prelaunch-power' }
    : A.id === 'gb200' ? { refs: [['servethehome-dgx-gb200', 'confirms the 120 kW figure ("the 120kW flagship system stacked in a single rack"); this site’s 132 kW upper figure is a commonly repeated peak/TDP figure not independently re-confirmed in this pass']] }
    : { refs: [['servethehome-dgx-gb200', 'establishes the GB200-generation 120 kW flagship figure this GB300 range is reported relative to'], ['nvidia-gb300-power', 'NVIDIA’s own GB300 NVL72 power-smoothing post, describing the same rack platform this range covers']] };
  const rackPublishedBasis = A.id === 'rubin' ? 'assumed' : 'reported';
  PARTS.hall = [
    { id: 'unitsub', title: 'Unit substation', kicker: dc ? '34.5 kV → 480 V, for cooling' : '34.5 kV → 480 V, 2.5 MVA',
      body: dc
        ? 'Outside the wall, a pad-mounted transformer still makes 480 V for pumps, fans and lights. The racks no longer need it.'
        : 'Outside the wall, a pad-mounted transformer takes one campus feeder and makes 480 V three-phase. Its secondary runs a few meters through the wall into the switchgear.',
      specs: [['Rating', '2.5 MVA', 'assumed', { assume: 'unitsub-mva' }], ['Secondary current', '≈3,000 A at full load', 'derived', { calc: 'hall-unitsub-current' }], ['Efficiency', '≈99%', 'assumed', { assume: 'unitsub-cooling-side-eff-99', refs: [['doe-transformer-standards-2024', "DOE's 04/04/2024 final rule updating distribution-transformer efficiency standards, which supersedes the 2013 rule"]] }]] },
    { id: 'swgr', title: dc ? 'Medium-voltage switchgear' : '480 V switchgear', kicker: 'Breakers and transfer',
      body: dc
        ? `Breakers protect each 34.5 kV feed into the solid-state transformers and switch between utility and ${bat ? 'the site batteries' : 'generator power'} when the grid drops.`
        : `A lineup of drawout breakers protects every outgoing circuit and switches the room between utility and ${bat ? 'the site batteries' : 'generator'} when the grid drops.`,
      specs: [['Transfer', bat ? 'automatic, utility ↔ site batteries' : 'automatic, utility ↔ generator', 'assumed', { assume: bat ? 'site-battery-carries-campus' : 'hall-standard-practice' }]] },
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
        : 'A transformer steps 480 V to 415 V, the voltage OCP rack power shelves take. Copper bars in an aluminum housing then run over each row, and plug-in tap-off boxes drop a short cable into each rack, so moving a rack means moving a plug.',
      specs: dc
        ? [['Rack voltage', '800 V DC', 'spec', { refs: [['nvidia-800v-hvdc', "NVIDIA's own architecture post names 800 V as the DC bus voltage for its next-generation AI-factory power design"]] }], ['Per rack', M.staircase.find(s => s.v === 800)?.current ?? '', 'derived', { calc: 'hall-busway-current' }], ['Copper, NVIDIA claim', '−45%', 'vendor', { refs: [['nvidia-800v-hvdc', '"With lower current, thinner conductors can handle the same load, reducing copper requirements by 45%."']], vs: '415 V AC busway distribution at the same delivered power' }]]
        : [['Rack voltage', '415 V three-phase', 'reported', { refs: [['lv-distribution-busway', '"415V (and its 400V European twin) is the de facto rack standard for liquid-density AI rows", vs. 208V three-phase in legacy air-cooled halls (the page does not separately discuss 480 V upstream distribution)']] }], ['Per rack', `${M.staircase.find(s => s.v === 415)?.current ?? ''} at ${rackKW} kW`, 'derived', { calc: 'hall-busway-current', assume: 'power-factor' }], ['Why busway', 'tap-offs move without rewiring', 'assumed', { assume: 'hall-standard-practice' }]] },
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
      specs: [['Air share of heat', `≈${Math.round((1 - liq) * 100)}%`, 'derived', { calc: 'hall-air-heat-share' }]] },
    air
      ? { id: 'inrow', title: 'In-row cooling units', kicker: 'Chilled water, cold air',
        body: 'Cabinets the size of a rack sit in each row. Fans pull hot-aisle air through chilled-water coils and blow it out cold into the room at the rack fronts.',
        specs: [['Capacity', '≈60–100 kW each', 'assumed', { assume: 'inrow-capacity' }], ['Units here', `≈${n0(L.airUnits)}`, 'derived', { calc: 'bom-facility-count', assume: 'inrow-capacity' }], ['Supply air', '≈18–27 °C (ASHRAE)', 'spec', { refs: [['ashrae-tc99-reference-card', 'Table 2.1, 2015 Thermal Guidelines: Recommended row, classes A1 to A4, 18 to 27 °C']] }]] }
      : { id: 'cdu', title: 'Coolant distribution unit', kicker: 'Two loops, one heat exchanger',
        body: 'The CDU keeps the rack loop, filtered water with glycol running through cold plates, separate from facility water. Units such as Vertiv’s CoolChip or Motivair’s CDU line pack the pumps, plate heat exchanger and controls into one cabinet at the row end.',
        specs: [['Capacity range', '70 kW – 2.3 MW', 'spec', { refs: [['vertiv-coolchip-cdu', 'CoolChip CDU family: models from CDU 70 (70 kW) to CDU 2300 (2300 kW)'], ['motivair-cdu-brochure', '"COOLING UP TO 2.3MW", MCDU-4U (102 kW) through MCDU-60 (2.3 MW) rated-capacity table']] }], ['Units here, ≈1.25 MW', `≈${n0(L.cdus)}`, 'derived', { calc: 'bom-facility-count', assume: 'cdu-module-mw' }], ['Rule', 'rack loop stays above dew point', 'spec', { refs: [['motivair-cdu-brochure', '"The CDU maintains a secondary loop water temperature above the dew point in the data center to eliminate the possibility of condensation"']] }]] },
    { id: 'fwater', title: air ? 'Chilled water loop' : 'Facility water loop', kicker: 'Supply and return headers',
      body: `Insulated steel headers carry water between the ${air ? 'cooling units' : 'CDUs'} and the ${warm ? 'rooftop dry coolers' : 'chiller plant'}. Blue carries cooler supply, red carries warm return.`,
      specs: [['Supply → return', `≈${TT.fwsSupply} → ${TT.fwsReturn} °C`, 'assumed', { assume: 'loop-temps' }], ['Temperature rise', '≈10 °C across the racks', 'assumed', { assume: 'hall-water-rise-10c' }]] },
    { id: 'fanwall', title: 'Fan wall', kicker: 'Air side',
      body: air ? 'A wall of fans and coils handles room air and the heat from lights, people and power gear.' : 'A wall of fans and coils cools the air that carries the remaining heat from power shelves, switches, optics and memory.',
      specs: [['Share of rack heat', `≈${Math.round((1 - liq) * 100)}%`, 'derived', { calc: 'hall-air-heat-share' }]] },
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
      ? { basis: 'vendor', ev: { refs: [ref('nvidia-rubin-platform', 'NVLink section: sixth-generation NVLink, "3.6TB/s of bandwidth" per GPU')], vs: 'GB200/GB300 NVL72’s 1.8 TB/s per GPU (fifth-generation NVLink)' } }
      : { basis: 'spec', ev: { refs: [ref('nvidia-gb200-nvl72-llm-blog', '"The revolutionary 1.8 TB/s of bidirectional throughput per GPU"')] } };
  const nvlDomainEv = () => A.id === 'rubin'
    ? { basis: 'vendor', ev: { refs: [ref('nvidia-rubin-platform', 'NVLink section: Vera Rubin NVL72 rack, "260TB/s"')], vs: 'GB200/GB300 NVL72’s 130 TB/s domain total' } }
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
      ? { basis: 'assumed', value: hbmSpec, ev: { assume: 'rubin-hbm-capacity' } }
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
    ? { basis: 'assumed', ev: { assume: 'rubin-rack-layout' } }
    : { basis: 'spec', ev: { refs: [ref('nvidia-dgx-gb200-hardware', 'Hardware: "18x 1RU compute trays, each with 2 Grace CPUs and 4 Blackwell GPUs"; "9x 1RU NVLink switch trays" of "2x NVLink NVSwitches" each'), ref('nvidia-nvl72-reference-arch', 'System Hardware & Components: 18 compute trays, 9 NVLink switch trays of 2 NVSwitch ASICs each')] } };
  PARTS.rack = nvl ? [
    { id: 'feed', title: 'Rack feed', kicker: dc ? '800 V DC in' : '415 V AC in',
      body: 'Two tap-off cables from the overhead busway plug into the top of the rack: A and B feeds for redundancy.',
      specs: [['Feeds', 'A + B', 'assumed', { assume: 'dual-feed-redundancy' }]] },
    dc
      ? { id: 'shelves', title: 'DC-DC shelves', kicker: '800 V DC → ≈50 V DC',
        body: 'With DC already in the busway, shelves such as Delta’s or LITEON’s 800 V DC power shelves only step voltage down, one conversion instead of rectifying AC. Later racks move this conversion onto the trays.',
        specs: [['Efficiency, Navitas claim', '≈98.5% peak', 'vendor', { refs: [ref('navitas-10kw-dcdc-985', 'press release: "98.5% peak efficiency and 98.1% full load efficiency" for an 800 V-to-50 V DC-DC platform')], vs: 'a multi-stage AC-fed power shelf' }], ['Loss per rack', `≈${RK.convKW.toFixed(1)} kW`, 'derived', { calc: 'shelf-loss', refs: [ref('navitas-10kw-dcdc-985', '98.5% peak efficiency, the published input to this calculation')] }]] }
      : { id: 'shelves', title: 'Power shelves', kicker: '415 V AC → ≈50 V DC',
        body: `Each 1U shelf, such as LITEON’s power shelf for NVL72 racks, holds six hot-swap rectifiers in a 3+3 arrangement that turn AC into about 50 V DC.${A.id === 'gb300' ? ' GB300 shelves add capacitors that store 65 J per GPU to smooth training load swings.' : ''}`,
        specs: [['Shelf', '≈33 kW, 6 × 5.5 kW', 'spec', { refs: [ref('flex-gb200-power-shelf', 'product page: "consist of 6 PSUs with a max output power of 33kW"; component diagram separately labels one PSU "5500W PSU" (33 kW ÷ 6 = 5.5 kW matches)')] }],
          A.id === 'gb300'
            ? ['Shelves per rack', '6 (up to 8)', 'reported', { refs: [ref('flex-gb200-power-shelf', '6 PSUs of 33 kW total is the shelf unit'), ref('nvidia-nvl72-reference-arch', 'GB300 NVL72 System Hardware & Components: "8 power shelves of 33 kW, with each shelf having six 5.5 kW PSUs" for a rack "requiring up to 142 kW"')] }]
            : ['Shelves per rack', '6', 'assumed', { assume: 'gb200-shelf-count', refs: [ref('flex-gb200-power-shelf', '6 PSUs of 33 kW total is the shelf unit')] }],
          ['Efficiency', '≈97.5% peak, half load', 'spec', { refs: [ref('flex-gb200-power-shelf', 'product page: "High efficiency up to 97.5% (peak)"')] }], ...(A.id === 'gb300' ? [['GB300 smoothing', '−30% peak grid demand', 'spec', { refs: [ref('nvidia-gb300-power', 'blog: "the peak grid demand is reduced by 30% when training the Megatron LLM"')] }]] : [])] },
    { id: 'busbar', title: 'DC busbar', kicker: `≈${n0(Math.round(RK.dcBusKW * 1000 / 50 / 100) * 100)} A down the back`,
      body: 'A vertical copper busbar runs the full height of the rack. Every tray has a clip on its back that grabs the bar when it slides in, so there are no power cables to trays.',
      specs: [['Voltage', '≈50 V DC (OCP ORv3)', 'spec', { refs: [ref('nvidia-dgx-gb200-hardware', 'Hardware: shelves "convert AC power into nominal 50V-51V DC output and distribute it through the bus bar"')] }], ['Busbar rating', '1,400 A per section', 'spec', { refs: [ref('nvidia-gb200-ocp', '"The new design supports a substantially higher 1,400 amp current flow"')] }], ['Next: NVIDIA Kyber, 2027', '800 V DC, 45% less copper', 'vendor', { refs: [ref('nvidia-800v-hvdc', '"reducing copper requirements by 45%"; "Full-scale production... will coincide with NVIDIA Kyber rack-scale systems in 2027"')], vs: 'today’s 54 V/50 V busbar architecture' }]] },
    { id: 'compute', title: 'Compute trays', kicker: '18 trays, 4 GPUs each',
      body: `Each 1U tray holds two superchips: two ${X.cpu} CPUs and four ${X.gpus} under water-cooled cold plates.`,
      specs: (() => { const { basis, ev } = nvl72LayoutEv(); return [['Trays', '18', basis, ev], ['GPUs per tray', '4', basis, ev], ['CPUs per tray', '2', basis, ev], ['Tray power', `≈${trayKW.toFixed(1)} kW`, 'derived', { calc: 'tray-power' }]]; })(), drill: 4 },
    { id: 'nvswitch', title: 'NVLink switch trays', kicker: '9 trays in the middle',
      body: 'Switch trays in the middle of the rack connect all 72 GPUs as one NVLink domain, so any GPU can read any other’s memory at full speed.',
      specs: (() => { const l = nvl72LayoutEv(), b = nvlPerGpuEv(), d = nvlDomainEv();
        return [['Trays', '9', l.basis, l.ev], ['Bandwidth per GPU', nvlTB, b.basis, b.ev], ['Domain total', A.id === 'rubin' ? '≈260 TB/s, as announced' : '130 TB/s', d.basis, d.ev]]; })() },
    { id: 'spine', title: 'NVLink spine', kicker: '≈5,000 copper cables',
      body: 'Cable cartridges down the back tie every tray to every switch in passive copper, with no retimers and no optical modules in the path. NVIDIA’s own DGX GB200 user guide calls this the "NVLink passive copper cable cartridge backplane." Its OCP-contribution developer blog once called the same cables "active copper cables" — loose usage, most likely meaning links that are actively carrying traffic, rather than a description of the electronics inside them.',
      specs: [['Links', 'more than 5,000 passive copper', 'spec', { refs: [ref('nvidia-gb200-ocp', '"These cartridges accommodate over 5,000 active copper cables"'), ref('nvidia-dgx-gb200-hardware', 'Hardware: opening paragraph calls the same backplane the "NVLink passive copper cable cartridge backplane"')] }], ['Total length', '≈2 miles', 'reported', { refs: [ref('theregister-dgx-gb200-nvl72', 'rack tour: "Both the NVLink switch and compute sleds slot into a blind mate backplane with more than 2 miles (3.2 km) of copper cabling"')] }], ['Signaling', '224G PAM4', 'reported', { refs: [ref('naddod-gb200-interconnect', 'interconnect analysis: NVLink 5 cartridge links run 224 Gb/s PAM4; not stated in these terms by NVIDIA itself')] }]] },
    { id: 'manifold', title: 'Coolant manifolds', kicker: 'Blue in, red out',
      body: 'Two vertical manifolds with dripless quick disconnects feed every tray. A tray comes out without a drop of water.',
      specs: [['Liquid-cooled parts', liq >= 0.99 ? 'everything, by this model' : 'GPUs, CPUs, switch chips', liq >= 0.99 ? 'assumed' : 'spec', liq >= 0.99 ? { assume: 'rubin-full-liquid-cooling' } : { refs: [ref('nvidia-dgx-gb200-hardware', 'Hardware: compute trays "cooled by liquid that runs up and down the rack through manifolds, then through the cold plates that are attached to the CPUs and the GPUs"')] }]] },
  ] : [
    { id: 'feed', title: 'Rack feed', kicker: '415 V AC in',
      body: 'Two tap-off cables from the overhead busway feed the rack: A and B for redundancy.',
      specs: [['Feeds', 'A + B', 'assumed', { assume: 'dual-feed-redundancy' }]] },
    { id: 'pdu', title: 'Rack power strips', kicker: '415 V three-phase → 240 V outlets',
      body: 'Vertical power strips at the back split each three-phase feed into single-phase outlets. Line to neutral, 415 V three-phase is 240 V, which is what server power supplies take.',
      specs: [['Per strip', 'high-30s kW class', 'reported', { refs: [ref('lv-distribution-busway', '"a 415V three-phase PDU at the same amperage [60A] clears the high-30s [kW]"; its 208V/415V density-tier table separately puts the 17–20 kW class at 208V, not 415V')] }], ['Outlets', 'C19/C21', 'reported', { refs: [ref('lv-distribution-busway', 'density-tier table, 30–80 kW row: "415V/400V busway + tap-off... IEC 60309 feed, C19/C21"')] }]] },
    { id: 'servers', title: 'DGX H100 servers', kicker: '4 per rack, 8U each',
      body: 'Each server holds eight H100 GPUs on one baseboard, two Xeon CPUs, and its own power supplies and fans.',
      specs: [['Per server', '≈10.2 kW max', 'spec', { refs: [ref('nvidia-dgxh100-user-guide', 'Power Specifications table: "10.2 kW max." in the unlabeled column between Input and Specification for Each Power Supply — the system-level figure, distinct from the 3,300 W per-PSU column')] }], ['GPUs per server', '8', 'spec', { refs: [ref('nvidia-dgxh100-user-guide', 'Component Descriptions: "8 x NVIDIA H100 GPUs"')] }], ['Height', '8U, 356 mm', 'spec', { refs: [ref('nvidia-dgxh100-user-guide', 'Mechanical Specifications: "Form Factor: 8U Rackmount", "Height: 14\\" (356 mm)"')] }]], drill: 4 },
    { id: 'psus', title: 'Server power supplies', kicker: 'AC → 54 V, inside each server',
      body: 'Each server has six 3.3 kW supplies, four carrying the load and two spare. The conversion happens server by server instead of in shared rack shelves.',
      specs: [['Per server', '6 × 3.3 kW, 4+2', 'spec', { refs: [ref('nvidia-dgxh100-user-guide', 'Power Specifications: "six power supply units (PSU) configured for 4+2 redundancy"; Specification for Each Power Supply column: "3300 W @ 200-240 V, 16 A, 50-60 Hz"')] }], ['Efficiency', '≈96% (80 PLUS Titanium class)', 'assumed', { assume: 'dgx-h100-psu-efficiency' }], ['Loss per rack', `≈${RK.convKW.toFixed(1)} kW`, 'derived', { calc: 'shelf-loss' }]] },
    { id: 'cabling', title: 'Power cords', kicker: 'No busbar',
      body: 'Twenty-four cords, six per server, run from the strips to the supplies. Air-cooled racks at 40 kW do not need a busbar.',
      specs: [['Cords per rack', '24', 'derived', { calc: 'count-per-rack' }]] },
    { id: 'mgmt', title: 'Management switch', kicker: 'Out-of-band',
      body: 'A small copper switch at the top runs the rack’s management network: firmware, sensors and power control, separate from the fabrics that move model data.',
      specs: [['Rate', '1–10 GbE class', 'assumed', { assume: 'bmc-network-speed' }]] },
  ];
  PARTS.tray = nvl ? [
    { id: 'clip', title: 'Busbar clip', kicker: '≈50 V DC in',
      body: 'Spring copper fingers at the back of the tray grab the rack busbar. More than a hundred amps flows through this clip when the tray is working hard.',
      specs: [['Tray power', `≈${trayKW.toFixed(1)} kW`, 'derived', { calc: 'tray-power' }], ['Current at 50 V', `≈${n0(trayKW * 20)} A`, 'derived', { calc: 'tray-clip-current' }]] },
    { id: 'ibc', title: 'Bus converters', kicker: '50 V → 12 V',
      body: 'Fixed-ratio converter bricks cut the voltage by about four and hand 12 V to the board. They are very efficient because they do not regulate. Vendors do not publish figures for this board, so the loss here is an estimate.',
      specs: [['Efficiency', '≈97–98%', 'assumed', { assume: 'ibc-efficiency' }], ['Loss, campus-wide', lossTxt('Bus converters'), 'derived', { calc: 'conversion-loss-campus' }]] },
    { id: 'vrm', title: 'Voltage regulators', kicker: '12 V → ≈0.8 V',
      body: 'Dozens of switching phases ring each GPU, each an inductor and a power stage switching at around a megahertz. They sit as close to the chip as they can, because every millimeter at a thousand amps costs power.',
      specs: [['Phases per GPU', '≈20–30', 'assumed', { assume: 'vrm-phases' }], ['Efficiency', `≈${Math.round(A.vrmEff * 100)}%`, 'assumed', { assume: 'vrm-efficiency' }], ['Loss, campus-wide', lossTxt('Voltage regulators'), 'derived', { calc: 'conversion-loss-campus' }], ['Core current', `≈${n0(coreA)} A`, 'derived', { calc: 'core-current' }]] },
    { id: 'gpu', title: X.gpus, kicker: `4 per tray, ${n0(A.gpuW)} W each`,
      body: `Each GPU package is two large dies and ${stacksTxt} of HBM. It is where most of the power in the building finally goes.`,
      specs: (() => { const p = gpuPowerEv(), t = transistorsEv(), m = hbmMemEv();
        return [['Power', `≈${n0(A.gpuW)} W`, p.basis, p.ev], ['Transistors', X.transistors, t.basis, t.ev], ['Memory', m.value, m.basis, m.ev]]; })(), drill: 5 },
    { id: 'grace', title: `${X.cpu} CPUs`, kicker: '2 per tray',
      body: `Each Arm CPU feeds two GPUs over a ${X.c2c} coherent link and keeps its own LPDDR5X memory beside it.`,
      specs: A.id === 'rubin'
        ? [['Cores', X.cpuCores, 'vendor', { refs: [ref('nvidia-rubin-platform', '"88 NVIDIA custom Olympus cores" with "full Armv9.2 compatibility"')], vs: 'Grace’s 72 Arm Neoverse V2 cores (GB200/GB300)' }], ['CPU–GPU link', `${X.c2c} NVLink-C2C`, 'assumed', { assume: 'rubin-c2c-lpddr' }]]
        : [['Cores', X.cpuCores, 'spec', { refs: [ref('nvidia-grace-cpu-page', '"144 Arm Neoverse V2 cores into a single module" (two Grace CPUs); 72 cores per CPU')] }], ['CPU–GPU link', `${X.c2c} NVLink-C2C`, 'assumed', { assume: 'grace-gpu-c2c-bandwidth', refs: [ref('nvidia-grace-cpu-page', '"The Grace CPU Superchip is composed of two Grace CPUs connected coherently over NVIDIA NVLink-C2C at 900 GB/s" — Grace-to-Grace, not Grace-to-GPU'), ref('nvidia-grace-hopper-superchip', '"900 gigabytes per second (GB/s) of coherent interface" for the Grace-to-Hopper CPU-to-GPU link, one generation earlier')] }]] },
    { id: 'lpddr', title: 'LPDDR5X memory', kicker: 'CPU memory',
      body: `Low-power DRAM packages soldered around each ${X.cpu} CPU.`,
      specs: [A.id === 'rubin'
        ? ['Capacity', X.cpuMem, 'assumed', { assume: 'rubin-c2c-lpddr' }]
        : ['Capacity', X.cpuMem, 'derived', { calc: 'hbm-per-gpu', refs: [ref(A.id === 'gb300' ? 'nvidia-gb300-nvl72' : 'nvidia-gb200-nvl72', A.id === 'gb300' ? '"17 TB LPDDR5X" CPU memory ÷ 36 CPUs' : '"17 TB LPDDR5X" total ÷ 36 Grace CPUs')] }]] },
    { id: 'coldplates', title: 'Cold plates', kicker: 'Water on every hot chip',
      body: 'Copper plates with fine internal fins sit on each GPU and CPU. Coolant enters cool, picks up over a kilowatt per GPU, and leaves warm.',
      specs: (() => { const p = gpuPowerEv(); return [['Heat per GPU', `≈${(A.gpuW / 1000).toFixed(1)} kW`, p.basis, p.ev]]; })() },
    { id: 'nic', title: 'NICs, DPU and SSDs', kicker: 'The front of the tray',
      body: `${X.nic} cards carry scale-out traffic to the spine, a BlueField DPU handles storage and security, and E1.S drives hold local data.`,
      specs: (() => { const n = nicPerGpuEv(); return [['Scale-out', `${nicTxt} per GPU`, n.basis, n.ev]]; })() },
    { id: 'nvconn', title: 'NVLink connectors', kicker: 'To the spine',
      body: 'High-density connectors at the rear mate with the copper spine when the tray is pushed home.',
      specs: (() => { const b = nvlPerGpuEv(); return [['Per GPU', `${A.nvlink.gen}, ${nvlTB}`, b.basis, b.ev]]; })() },
  ] : [
    { id: 'psu', title: 'Power supplies', kicker: 'AC → 54 V DC',
      body: 'Six hot-swap supplies at the back of the server take 240 V AC and make 54 V DC for the GPU baseboard and the CPU tray.',
      specs: [['Supplies', '6 × 3.3 kW, 4+2', 'spec', { refs: [ref('nvidia-dgxh100-user-guide', 'Power Specifications: "six power supply units (PSU) configured for 4+2 redundancy"; Specification for Each Power Supply column: "3300 W @ 200-240 V, 16 A, 50-60 Hz"')] }], ['Server power', '≈10.2 kW max', 'spec', { refs: [ref('nvidia-dgxh100-user-guide', 'Power Specifications table: "10.2 kW max." in the unlabeled column between Input and Specification for Each Power Supply — the system-level figure, distinct from the 3,300 W per-PSU column')] }]] },
    { id: 'ibc', title: 'Bus converters', kicker: '54 V → 12 V',
      body: 'Converter modules on the GPU baseboard step 54 V down to 12 V beside each GPU module. Vendors do not publish figures for this board, so the loss here is an estimate.',
      specs: [['Efficiency', '≈98%', 'assumed', { assume: 'ibc-efficiency' }], ['Loss, campus-wide', lossTxt('Bus converters'), 'derived', { calc: 'conversion-loss-campus' }]] },
    { id: 'vrm', title: 'Voltage regulators', kicker: '12 V → ≈0.8 V',
      body: 'Switching phases around each GPU make the final step to under a volt.',
      specs: [['Efficiency', `≈${Math.round(A.vrmEff * 100)}%`, 'assumed', { assume: 'vrm-efficiency' }], ['Loss, campus-wide', lossTxt('Voltage regulators'), 'derived', { calc: 'conversion-loss-campus' }], ['Core current', `≈${n0(coreA)} A`, 'derived', { calc: 'core-current' }]] },
    { id: 'gpu', title: 'H100 GPUs', kicker: '8 per server, 700 W each',
      body: 'Each SXM5 module is one large die with five working HBM3 stacks beside it, mounted face-down on the baseboard under a heat sink.',
      specs: [['Power', '700 W', 'spec', { refs: [ref('nvidia-h100-product-page', 'spec table: "Max thermal design power (TDP) | Up to 700W (configurable)"')] }], ['Transistors', X.transistors, 'spec', { refs: [ref('nvidia-hopper-architecture-page', '"Built with over 80 billion transistors using a cutting edge TSMC 4N process"')] }], ['Memory', hbmSpec, 'spec', { refs: [ref('nvidia-h100-product-page', 'spec table: "GPU Memory | 80GB" with "3.35TB/s" bandwidth')] }]], drill: 5 },
    { id: 'cpu', title: 'Xeon CPUs', kicker: '2 per server',
      body: 'Two x86 CPUs on a separate tray run the operating system and feed the GPUs over PCIe. They do none of the model math.',
      specs: [['CPU', `${X.cpuLong}, ${X.cpuCores}`, 'spec', { refs: [ref('nvidia-dgxh100-user-guide', 'Component Descriptions: "2 x Intel Xeon 8480C PCIe Gen5 CPUs with 56 cores each"')] }], ['Memory', X.cpuMem, 'spec', { refs: [ref('nvidia-dgx-h100', 'product page: "Dual Intel Xeon Platinum 8480C processors, 112 cores total, and 2 TB System Memory"')] }]] },
    { id: 'heatsinks', title: 'Heat sinks', kicker: 'Air, not water',
      body: 'Tall finned heat sinks with vapor chambers sit on each GPU. The server is 8U tall mostly to make room for them and for the air they need.',
      specs: [['Heat per GPU', '700 W', 'spec', { refs: [ref('nvidia-h100-product-page', 'spec table: "Max thermal design power (TDP) | Up to 700W (configurable)"')] }]] },
    { id: 'nvswitch', title: 'NVSwitch chips', kicker: '4 on the baseboard',
      body: 'Four third-generation NVSwitch chips connect all eight GPUs, so any GPU reads any other’s memory at full speed.',
      specs: [['Per GPU', '18 NVLink 4 links, 900 GB/s', 'spec', { refs: [ref('nvidia-dgxh100-user-guide', 'Component Descriptions: "4 x 4th generation NVLinks that provide 900 GB/s"')] }]] },
    { id: 'nic', title: 'ConnectX-7 NICs', kicker: 'One per GPU',
      body: 'Eight 400 Gb/s network cards carry scale-out traffic, grouped two to a twin-port optical cage at the back.',
      specs: [['Scale-out', '400 Gb/s per GPU', 'spec', { refs: [ref('nvidia-dgxh100-user-guide', 'Component Descriptions: "4 x OSFP ports for 8 x NVIDIA ConnectX-7 Single Port" cards, "Up to 400Gbps"')] }]] },
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
      hbm: { basis: 'spec', ev: { refs: [['nvidia-rubin-gpu-architecture-blog', 'body text: "up to 288 GB of HBM4 memory" and "up to 22 TB/s of peak bandwidth"'], ['wccftech-rubin-gpu-architecture', 'body text: "peak bandwidth of 22 TB/s"']] } },
      nvlink: { basis: 'spec', ev: { refs: [['nvidia-rubin-gpu-architecture-blog', 'body text: "3,600 GB/s of scale-up bandwidth for all-to-all GPU communication"'], ['nvidia-rubin-platform', 'body text: "Each GPU offers 3.6TB/s of bandwidth" and the NVL72 rack total "260TB/s" (72 × 3.6 TB/s)']] } },
      pkgPower: { basis: 'assumed', ev: { assume: 'rubin-package-power' } },
    },
  }[A.id];

  PARTS.chip = [
    { id: 'balls', title: 'Solder balls & substrate', kicker: 'A thousand-plus amps comes up here',
      body: 'Thousands of solder balls carry power and signals from the board into a many-layer organic substrate. Most of the balls are power and ground: at 0.8 V it takes many parallel paths to carry a thousand amps.',
      specs: [['Core voltage', '≈0.7–0.9 V', 'assumed', { assume: 'core-voltage' }], ['Core current, P ÷ V', `≈${n0(coreA)} A over several rails`, 'derived', { calc: 'core-current' }]] },
    { id: 'interposer', title: 'Interposer', kicker: X.packaging.replace('TSMC ', ''),
      body: 'A silicon layer wires the dies and memory together with lines far finer than any circuit board can carry.',
      specs: [['Packaging', X.packaging, EV6.pack.basis, EV6.pack.ev]] },
    { id: 'dies', title: A.dies > 1 ? 'Two GPU dies' : 'One GPU die', kicker: `${X.transistors.replace(', as announced', '')} transistors`,
      body: A.dies > 1
        ? 'Two reticle-limit dies act as one GPU, joined by a 10 TB/s die-to-die link. Nearly every watt that reaches them, whether it runs computation, on-chip memory, communication or leakage, ends as heat.'
        : 'One reticle-limit die, about as large as a chip can be made in one exposure. Nearly every watt that reaches it, whether it runs computation, on-chip memory, communication or leakage, ends as heat.',
      specs: [['Transistors', X.transistors, EV6.transistors.basis, EV6.transistors.ev],
        ...(A.dies > 1 ? [['Die-to-die link', '10 TB/s NV-HBI', EV6.dieRow.basis, EV6.dieRow.ev]] : [['Die area', '814 mm²', EV6.dieRow.basis, EV6.dieRow.ev]]),
        ['Process', X.process, EV6.process.basis, EV6.process.ev]] },
    { id: 'hbm', title: `${A.hbm.type} stacks`, kicker: `${stacksTxt}, ${A.hbm.gb} GB`,
      body: `Each stack, from suppliers such as SK hynix, Micron and Samsung, is ${A.hbm.layers} DRAM dies thinned and stacked with through-silicon vias. Moving model weights out of HBM for every token is a large share of inference energy.`,
      specs: [['Capacity', `${A.hbm.gb} GB${A.id === 'gb200' ? ' (NVIDIA rack total implies ≈186 GB)' : ''}`, EV6.hbm.basis, EV6.hbm.ev], ['Bandwidth', hbmTB, EV6.hbm.basis, EV6.hbm.ev],
        ['Layers per stack', `${A.hbm.layers}`, EV6.layers.basis, EV6.layers.ev], ['Share of GPU power', '≈8–15%', 'assumed', { assume: 'hbm-power-share' }]] },
    { id: 'tokens', title: 'Tokens', kicker: 'What leaves',
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
      ['NVLink copper connections', `≈${kfmt(NET.nvlinkPairs)}`, 'derived', Lk(3, 'spine'), bomRack],
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
      [nvl ? 'SuperNICs' : 'ConnectX-7 NICs', `≈${n0(GPUS)}`, 'derived', Lk(4, 'cx', 'data'), bomSilicon],
      [`Leaf / spine / core switches, ${NET.fabric.radix}-port`, `≈${n0(NET.switches)}`, 'derived', Lk(2, 'spine', 'data'), { calc: 'bom-network-count', refs: fabricRefs }],
      ['Optical modules', `≈${kfmt(NET.modules)}`, 'derived', Lk(2, 'optics', 'data'), { calc: 'bom-network-count', refs: [['nvidia-800g-dr8-datasheet', 'section 4.2: Maximum Power Dissipation, Max 17 W -- the per-module figure the fabric’s optics-power model scales from']] }],
      ['Fiber strands in the fabric', `≈${kfmt(NET.fibers)}`, 'derived', Lk(2, 'runways', 'data'), bomNetwork],
    ] },
  ];

  // ---------- data-mode parts per scene. Positions come from each scene's dataHotspots ----------
  const PARTS_DATA = {
    across: [
      { id: 'dci', title: 'Line terminals', kicker: 'Coherent DWDM',
        body: 'At each campus, coherent transceivers—in routers or dedicated transponder shelves—each turn one signal into one wavelength, 800 Gb/s to 1.6 Tb/s. A multiplexer combines many of those wavelengths onto a single fiber pair; amplifier huts (next) carry the combined light between campuses, and a demultiplexer splits it back into wavelengths at the far end.',
        specs: [
          ['Per wavelength, WaveLogic 6', 'up to 1.6 Tb/s', 'spec', { refs: [['ciena-wavelogic6', 'product announcement: WaveLogic 6 family, up to 1.6 Tb/s per wavelength']] }],
          ['800G pluggable, e.g. Marvell COLORZ 800', '800 Gb/s to ≈500 km', 'spec', { refs: [['marvell-colorz-800', 'press release: "up to 800 Gbps of bandwidth for DCI links up to 500km"']] }],
          ['Field trial', '1.6 Tb/s over 1,100 km (Telstra)', 'reported', { refs: [['convergedigest-telstra-ciena-1100km', 'lead sentence: "Telstra has transmitted four 400GbE client services over a single 1.6 Tbps wavelength across approximately 1,100 km between Melbourne and Sydney"']] }],
          ['C+L band', 'about 2× capacity per fiber', 'reported', { refs: [['convergedigest-telstra-ciena-1100km', 'body text: expanding from C-band into L-band "effectively opens a second optical transmission band, increasing the usable spectrum"']] }],
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
        body: 'Coherent transceivers here each produce or receive one wavelength, hundreds of gigabits to over a terabit; a multiplexer combines dozens of them onto each fiber pair bound for other campuses, and amplifiers along the route keep the combined signal alive without converting it back to electricity.',
        specs: [
          ['Per wavelength, Ciena WaveLogic 6', 'up to 1.6 Tb/s', 'spec', evRefs([['ciena-wavelogic6', 'press release: "transmission at rates of up to 1.6 Tbps via a single carrier"'], ['lightwaveonline-wavelogic6', 'coverage of the same announcement, same figure']])],
          ['400ZR reach, amplified', 'up to ≈120 km', 'reported', evRefs([['smartoptics-400zr-dci', 'knowledge-bank post: the 400ZR project focused on "400G Ethernet with amplified point-to-point DWDM links over DCI up to 120 KM"']])],
          ['Module power, 400ZR / 800ZR', '≈18–20 W / ≈23–25 W', 'reported', evRefs([['ascentoptics-coherent-power-consumption', 'guide: 400ZR modules "typically consume 18 to 20 W"; "one 800G link delivers the same capacity at 23 to 25 watts"']])],
        ] },
      ...(multiHall ? [
        { id: 'interhall', title: 'Hall-to-hall fiber', kicker: `One fabric, ${halls} buildings`,
          body: 'Thousands of strands in the duct banks join the spines of every hall, so a single training job can span every GPU on the campus.',
          specs: [['Strands', 'tens of thousands per hall pair', 'derived', evCalc('campus-crosshall-fibers')]] },
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
        specs: [['Fabric strands, whole campus', `≈${kfmt(NET.fibers)}`, 'derived', { calc: 'bom-network-count' }], ['Housing density, Corning EDGE8', '144 fibers per 1U', 'spec', { refs: [['corning-edge8', 'EDGE8-01U-SP product page: "Number of Modules: 18", "Fiber Capacity: 144" (18 modules × 8 fibers)']] }], ['4U housings for this campus', `≈${n0(NET.fibers / 576)}`, 'derived', { calc: 'hall-fiber-housings' }]] },
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
        body: `Network racks at the row ends hold leaf switches, ${A.nicGbps === 400 ? 'such as NVIDIA’s Quantum-2 QM9700 (InfiniBand)' : A.nicGbps === 800 ? 'such as NVIDIA’s Quantum-X800 Q3400 (InfiniBand) or Spectrum-X SN5600 (Ethernet)' : 'from NVIDIA’s Spectrum-6 generation, announced with Rubin'}. In a rail-optimized layout, GPU number n in every rack plugs into the same leaf, so most traffic crosses only one switch.`,
        specs: [['Leaf switches, campus', `≈${n0(NET.leaf)}`, 'derived', { calc: 'bom-network-count' }], ['Hops, same rail', '1', 'assumed', { assume: 'rail-optimized-1hop' }], ['Switch hop, InfiniBand', 'under ≈100 ns; NVIDIA publishes none', 'assumed', { assume: 'ib-switch-hop-latency' }]] },
      { id: 'spine', title: 'Spine switches', kicker: 'Any GPU to any GPU',
        body: `The spine connects every leaf to every other. Two tiers of ${NET.fabric.radix}-port switches reach about ${kfmt(NET.fabric.radix ** 2 / 2)} GPUs; this campus uses ${NET.tiers}${NET.planes > 1 ? `, in ${NET.planes} parallel planes` : ''}.`,
        specs: [['Switch', NET.fabric.switchName, A.nicGbps === 1600 ? 'assumed' : 'spec', A.nicGbps === 1600 ? { assume: 'rubin-prelaunch-specs' } : A.nicGbps === 400 ? { refs: [['nvidia-quantum2-qm9700-specs', 'QM97xx specifications: 32 OSFP cages, 25.6 Tbps total (64 logical 400G NDR ports)']] } : { refs: [['nvidia-xdr-switch-specs', 'Q32xx/Q34xx XDR 800Gb/s InfiniBand switch systems specifications']] }], ['Merchant switch chips, same role', 'Broadcom Tomahawk 6 (102.4 Tb/s), Marvell Teralynx 10 (51.2 Tb/s)', 'spec', { refs: [['broadcom-tomahawk6', 'page title: "Broadcom Now Shipping World’s First 102.4 Tbps Switch in Production Volume"'], ['marvell-teralynx10', 'press release: "a low power, programmable 51.2 Tbps Ethernet device"']] }], ['Spine + core switches', `≈${n0(NET.spine + NET.core)}`, 'derived', { calc: 'bom-network-count' }]] },
      { id: 'runways', title: 'Fiber runways', kicker: 'Yellow means fiber',
        body: 'Overhead yellow trays carry thousands of single-mode strands. A parallel module lights eight lanes through two multi-fiber connectors, so strand counts climb fast.',
        specs: [['Fibers per link', `${NET.fabric.fibersPerLink}`, 'assumed', { assume: 'fibers-per-link' }]] },
      { id: 'optics', title: 'Optical modules', kicker: 'Several per GPU', drill: 6,
        body: `Every link is lit at both ends by a pluggable module, from merchant suppliers such as InnoLight and Coherent as well as NVIDIA’s own LinkX line. Here they fill the faces of the leaf switches at the row ends and of the spine switches, with a link light on each and fiber rising to the runway. One per GPU leaves the rack, and every tier above adds more: about ${(NET.modules / GPUS).toFixed(1)} per GPU, ${NET.opticsMW.toFixed(1)} MW for this campus.`,
        specs: [['NVIDIA 800G DR8, 500 m', '17 W max', 'spec', { refs: [['nvidia-800g-dr8-datasheet', '§4.2, Recommended Operating Conditions and Power Supply Requirements: Maximum Power Dissipation, Max 17 W']] }], ['1.6T modules, e.g. InnoLight or Coherent 1.6T-DR8', '≈25–30 W, still ramping', 'assumed', { assume: '1.6t-module-power' }], ['The DSP inside each module', 'e.g. Marvell Ara, Broadcom Sian, Credo Bluebird', 'spec', { refs: [['marvell-ara-1p6t-portfolio', 'Marvell’s own 1.6T optical DSP portfolio announcement'], ['broadcom-sian3-200g-lane-dsp', 'Broadcom’s own Sian3 200G-lane DSP announcement'], ['credo-bluebird-dsp', 'Credo’s own Bluebird 1.6T optical DSP product page']] }], ['Linear-drive (LPO)', 'roughly half the power', 'reported', { refs: [['semtech-200g-lpo-power-blog', '"200G LPO Power, Reach and Loss: Real Numbers" -- Semtech’s own published LPO-vs-DSP power comparison']] }]] },
      { id: 'cpo', title: 'Co-packaged optics', kicker: 'A comparison, not deployed here', drill: 6,
        body: 'This scenario does not deploy CPO: none of its switches, power or fiber counts change because of this card. One extra switch stands apart at the end of the spine row as a schematic stand-in for the alternative, NVIDIA Spectrum-X/Quantum-X Photonics-style CPO, for comparison only. CPO is a kind of switch, not an add-on: a fabric that adopts it uses CPO switches in place of pluggable ones, which is why this one is set apart rather than drawn in the row. Real CPO switches put the optical engines on (or beside) the switch package itself, shortening the electrical path to the laser and cutting out the pluggable modules, which changes both signal-processing needs and electrical losses; it is not simply "every removed block is saved power." Fewer lasers, from sharing external laser sources across ports, is also not the same claim as fewer traffic fibers: CPO does not by itself reduce how many fibers carry data. Every switch actually counted in this hall still takes pluggables, as most fabrics do today.',
        specs: [['NVIDIA Quantum-X / Spectrum-X Photonics', '5× power efficiency, 4× fewer lasers, not fewer fibers (Aug. 2026 reporting; NVIDIA’s own March 2025 launch claimed 3.5×)', 'vendor', { refs: [['storagereview-nvidia-cpo-production', '"5x lower power consumption" and "4x fewer lasers" vs. conventional pluggable-optics switches, 08/15/2026'], ['nvidia-spectrum-x-cpo', 'launch announcement: "4x fewer lasers to deliver 3.5x more power efficiency... compared with traditional methods", 03/18/2025'], ['nvidia-cpo-industry-collaboration-blog', '08/26/2025 post restates "reducing the total number of lasers in the data center by a factor of four compared to legacy designs" but not a power-efficiency multiplier']], vs: 'conventional switches using pluggable optical transceivers' }], ['Broadcom Davisson', '102.4 Tb/s, ≈3.5 W per 800G port', 'vendor', { refs: [['broadcom-tomahawk6', 'page title: "Broadcom Now Shipping World’s First 102.4 Tbps Switch in Production Volume" -- Davisson is Broadcom’s CPO variant built on this same Tomahawk 6 ASIC (per nextplatform-broadcom-cpo)'], ['nextplatform-broadcom-cpo', '"An 800 Gb/sec port will burn about 3.5 watts, says Broadcom, which is 36.4 percent lower than with the Tomahawk 5 CPO port at the same bandwidth and more than 70 percent lower than pluggable optics at the same bandwidth"']], vs: 'Broadcom’s prior-generation Tomahawk 5 CPO port and pluggable optics, both at 800 Gb/s' }]] },
      { id: 'racks', title: nvl ? 'NVL72 racks' : 'DGX H100 racks', kicker: 'Scale-up stays inside', drill: 3,
        // each way to each way (NVLink's vendor-quoted figure is bidirectional; a NIC's line rate already isn't),
        // the same basis engine.ts's bandwidth staircase compares on (issue 9) — not NVLink's aggregate over the
        // NIC's per-direction rate, which would silently double this ratio.
        body: nvl
          ? `Inside each rack, 72 GPUs talk over copper NVLink, ${Math.round(A.nvlink.tbs * 4000 / A.nicGbps)} times faster each way than the fabric outside.`
          : `Inside each server, 8 GPUs talk over NVLink, ${Math.round(A.nvlink.tbs * 4000 / A.nicGbps)} times faster each way than the fabric outside. Between servers, even in the same rack, it is all fabric.`,
        specs: [['NVLink per GPU', nvlTB, A.id === 'rubin' ? 'assumed' : 'spec', A.id === 'rubin' ? { assume: 'rubin-prelaunch-specs' } : { refs: [[A.id === 'h100' ? 'nvidia-h100-datasheet' : 'nvidia-blackwell-platform-arrives', A.id === 'h100' ? 'H100 datasheet: 900 GB/s NVLink bandwidth per GPU' : 'Blackwell platform launch release: "the latest iteration of NVIDIA NVLink delivers groundbreaking 1.8TB/s bidirectional throughput per GPU" (the NVL72 product page itself states only the 130 TB/s system aggregate, not a per-GPU figure)']] }], ['Domain', `${A.nvlink.domain} GPUs`, 'spec', { refs: [[nvl ? 'nvidia-gb200-nvl72' : 'nvidia-dgx-h100', nvl ? 'NVL72 platform page: all 72 GPUs in one NVLink domain' : 'product page: 8 GPUs share one NVLink domain per DGX H100 baseboard']] }]] },
    ],
    rack: nvl ? [
      { id: 'tp', title: 'Tensor + expert parallel', kicker: 'The chattiest work lives here',
        body: 'Inside one rack a model layer’s math is split across GPUs, or its experts are spread across as many as its 72 GPUs. The GPUs trade partial results inside every layer, which only NVLink is fast enough for.',
        specs: [['Traffic', 'every layer, many times per token', 'reported', { refs: [ref('meta-llama3-herd-parallelism', 'describes tensor-parallel GPUs exchanging activations inside every transformer layer, many times per forward/backward pass')] }], ['Llama 3 405B, H100', 'tensor parallel 8, inside each server', 'spec', { refs: [ref('meta-llama3-herd-parallelism', 'training section: 405B model trained with tensor parallelism 8')] }], ['NVL72 wide expert parallel', 'up to 72 GPUs, the NVLink domain', 'reported', { refs: [ref('nvidia-gb200-dynamo-moe', 'blog: "The NVLink domain can now support up to 72 NVIDIA Blackwell GPUs"; its own DeepSeek R1 example spreads 256 routed experts across 64 of those GPUs, not all 72')] }]] },
      { id: 'nvswitch', title: 'NVLink switch trays', kicker: 'Scale-up: one domain',
        body: 'Nine switch trays in the middle connect all 72 GPUs, so any GPU can read another’s memory as fast as its own link allows.',
        specs: (() => { const l = nvl72LayoutEv(), b = nvlPerGpuEv(); return [['Trays', '9, 2 switch chips each (18)', l.basis, l.ev], ['Per GPU', `${A.nvlink.gen}, ${nvlTB}`, b.basis, b.ev]]; })() },
      { id: 'spine', title: 'NVLink spine', kicker: 'Copper, not light',
        body: 'Cable cartridges down the back carry more than 5,000 copper links. At 224G, passive copper reaches about a meter, just enough for one rack, and it needs no optical modules or retimers.',
        specs: [['Links', 'more than 5,000', 'spec', { refs: [ref('nvidia-gb200-ocp', '"These cartridges accommodate over 5,000 active copper cables"')] }], ['Power saved vs optics, NVIDIA', '≈20 kW per rack', 'vendor', { refs: [ref('semianalysis-nvl72-optics', 'quotes Jensen Huang: copper NVLink saves roughly 20 kW per rack vs an equivalent optical scale-up fabric')], vs: 'an equivalent NVL72-scale optical scale-up fabric' }], ['Passive copper reach at 224G', '≈1 m', 'reported', { refs: [ref('ieee-8023dj-electrical-adhoc', 'IEEE 802.3dj electrical ad hoc contribution on copper reach objectives at 224 Gb/s PAM4')] }]] },
      { id: 'optical', title: 'The optical alternative', kicker: 'Copper inside, light between',
        body: 'Google scales up differently, not purely with light: within each 64-chip cube, most ICI links are copper, wired directly in a 3D torus, with optical transceivers only at the cube’s outer edges. Mirror-based optical circuit switches (OCS) then join whole cubes together, and can rewire that fabric between cubes in milliseconds.',
        specs: [['Ironwood superpod', '9,216 chips, 144 cubes of 64', 'spec', { refs: [ref('google-ironwood-codesign', '"a small ‘pod’ (e.g., a 256-chip Ironwood pod with four cubes) to a massive ‘superpod’ (e.g., a 9,216-chip system with 144 cubes)"; each cube is "64 Ironwood chips"')] }], ['ICI per chip, inside a cube', '1.2 TB/s; mostly copper', 'reported', { refs: [ref('google-ironwood-tpu', '"linked via a breakthrough Inter-Chip Interconnect (ICI) network operating at 9.6 Tb/s" (= 1.2 TB/s); Google’s own pages do not state the link medium'), ref('semianalysis-tpuv7-ironwood', 'reports that ICI links interior to the 4×4×4 cube run over direct-attached copper (DAC) cables, while chips at the cube’s face/edge/corner use optical transceivers instead')] }], ['Optical circuit switch, Google’s Palomar-class design', '136 ports, ≈108 W', 'reported', { refs: [ref('semianalysis-google-apollo-ocs', '"Google, with their Apollo project, has developed a non-blocking 136x136 optical circuit switch" that "only uses 108 watts of power consumption"')] }]] },
      { id: 'uplinks', title: 'Scale-out ports', kicker: 'The only data that leaves',
        body: 'One optical port per GPU leaves the front of each compute tray and climbs to the fiber runway overhead.',
        specs: (() => { const n = nicPerGpuEv(); return [['Ports', '72', 'reported', { refs: [ref('semianalysis-nvl72-optics', 'describes NVL72’s scale-out network as 72 OSFP ports, one per GPU')] }], ['Rate', nicTxt, n.basis, n.ev]]; })() },
      { id: 'compute', title: 'Compute trays', kicker: '4 GPUs each', drill: 4,
        body: 'Each tray is where the three networks meet: NVLink at the back, optics at the front, and the CPU link in between.',
        specs: (() => { const l = nvl72LayoutEv(); return [['GPUs', '4', l.basis, l.ev]]; })() },
      { id: 'mgmt', title: 'Management switch', kicker: 'Out-of-band',
        body: 'A small copper switch at the top runs the rack’s management network: firmware, sensors and power control, separate from the fabrics that move model data.',
        specs: [['Rate', '1–10 GbE class', 'assumed', { assume: 'bmc-network-speed' }]] },
    ] : [
      { id: 'tp', title: 'Tensor parallel', kicker: 'Inside one server',
        body: 'The chattiest work, splitting each layer’s math, has to fit inside one 8-GPU server. That is why Llama 3 405B ran tensor parallel 8 on H100: eight was the whole NVLink domain.',
        specs: [['Llama 3 405B, H100', 'tensor parallel 8, inside each server', 'spec', { refs: [ref('meta-llama3-herd-parallelism', 'training section: 405B model trained with tensor parallelism 8')] }], ['NVLink domain', '8 GPUs', 'spec', { refs: [ref('nvidia-dgxh100-user-guide', 'Component Descriptions: 8 GPUs joined by "4 x 4th generation NVLinks"')] }]] },
      { id: 'servers', title: 'DGX H100 servers', kicker: '4 NVLink islands per rack', drill: 4,
        body: 'Four servers, four separate NVLink domains. GPUs in different servers of the same rack talk through the leaf switch, like any other rack.',
        specs: [['NVLink per GPU', '900 GB/s', 'spec', { refs: [ref('nvidia-h100-product-page', 'spec table: "NVLink | 900GB/s"')] }]] },
      { id: 'uplinks', title: 'Scale-out ports', kicker: '32 per rack',
        body: 'Each server has four twin-port optical cages at the back, two 400 Gb/s links in each, one per GPU.',
        specs: [['Per GPU', '400 Gb/s', 'spec', { refs: [ref('nvidia-dgxh100-user-guide', 'Component Descriptions: "4 x OSFP ports for 8 x NVIDIA ConnectX-7 Single Port" cards, "Up to 400Gbps"')] }], ['Ports per rack', '32', 'derived', { calc: 'count-per-rack', refs: [ref('nvidia-dgxh100-user-guide', '8 ConnectX-7 ports per server × 4 servers per rack')] }]] },
      { id: 'optical', title: 'The optical alternative', kicker: 'Copper inside, light between',
        body: 'Google scales up differently, not purely with light: within each 64-chip cube, most ICI links are copper, wired directly in a 3D torus, with optical transceivers only at the cube’s outer edges. Mirror-based optical circuit switches (OCS) then join whole cubes together, and can rewire that fabric between cubes in milliseconds.',
        specs: [['Ironwood superpod', '9,216 chips, 144 cubes of 64', 'spec', { refs: [ref('google-ironwood-codesign', '"a small ‘pod’ (e.g., a 256-chip Ironwood pod with four cubes) to a massive ‘superpod’ (e.g., a 9,216-chip system with 144 cubes)"; each cube is "64 Ironwood chips"')] }], ['ICI per chip, inside a cube', '1.2 TB/s; mostly copper', 'reported', { refs: [ref('google-ironwood-tpu', '"linked via a breakthrough Inter-Chip Interconnect (ICI) network operating at 9.6 Tb/s" (= 1.2 TB/s); Google’s own pages do not state the link medium'), ref('semianalysis-tpuv7-ironwood', 'reports that ICI links interior to the 4×4×4 cube run over direct-attached copper (DAC) cables, while chips at the cube’s face/edge/corner use optical transceivers instead')] }]] },
      { id: 'mgmt', title: 'Management switch', kicker: 'Out-of-band',
        body: 'A small copper switch at the top runs the rack’s management network, separate from the fabrics that move model data.',
        specs: [['Rate', '1–10 GbE class', 'assumed', { assume: 'bmc-network-speed' }]] },
    ],
    tray: nvl ? [
      { id: 'nvconn', title: 'NVLink connectors', kicker: `${A.nvlink.gen}`,
        body: 'Each GPU’s NVLink links leave the back of the tray and mate with the copper spine when the tray is pushed home.',
        specs: (() => { const b = nvlPerGpuEv(); return [['Per GPU', nvlTB, b.basis, b.ev]]; })() },
      { id: 'c2c', title: 'NVLink-C2C', kicker: 'CPU to GPU',
        body: `Each ${X.cpu} CPU talks to its GPUs over a coherent chip-to-chip link, so the GPUs can use CPU memory as a slower extension of their own.`,
        specs: A.id === 'rubin'
          ? [['Bandwidth', X.c2c, 'assumed', { assume: 'rubin-c2c-lpddr' }]]
          : [['Bandwidth', X.c2c, 'assumed', { assume: 'grace-gpu-c2c-bandwidth', refs: [ref('nvidia-grace-cpu-page', '"The Grace CPU Superchip is composed of two Grace CPUs connected coherently over NVIDIA NVLink-C2C at 900 GB/s" — Grace-to-Grace, not Grace-to-GPU'), ref('nvidia-grace-hopper-superchip', '"900 gigabytes per second (GB/s) of coherent interface" for the Grace-to-Hopper CPU-to-GPU link, one generation earlier')] }]] },
      { id: 'cx', title: 'SuperNICs', kicker: 'One per GPU',
        body: 'Each GPU has its own network card for scale-out traffic, so GPUs talk to other racks without going through the CPU.',
        specs: (() => { const n = nicPerGpuEv(); return [['NIC', X.nic, n.basis, n.ev], ['Per GPU', X.nicNote, n.basis, n.ev]]; })() },
      { id: 'osfp', title: 'Optical modules', kicker: 'Electrons become light', drill: 6,
        body: 'Pluggable modules at the front turn the NIC’s electrical signal into light on single-mode fiber.',
        specs: [['NVIDIA 800G DR8', '17 W max', 'spec', { refs: [ref('nvidia-800g-dr8-datasheet', 'Key Features / Recommended Operating Conditions table: "17-Watts max power" for the 500 m single-mode DR8 variant')] }], ['400G module', '8–9 W', 'reported', { refs: [ref('nvidia-linkx-interconnect', 'LinkX 400G module family power figures in this range')] }]] },
      { id: 'dpu', title: 'BlueField DPU', kicker: 'Front-end network',
        body: 'A separate network carries user requests, storage and management. The DPU runs it without taking CPU time.',
        specs: [A.id === 'rubin'
          ? ['BlueField-4', 'up to 800 Gb/s', 'vendor', { refs: [ref('nvidia-bluefield4-blog', '"800Gb/s throughput" stated in the launch blog’s subtitle')], vs: 'BlueField-3’s 400 Gb/s' }]
          : ['BlueField-3', 'up to 400 Gb/s', 'spec', { refs: [ref('nvidia-bf3-networking-docs', '"BlueField-3 offers speeds up to 400 gigabits per second (Gb/s)"')] }],
          ['Role', 'storage, security, tenant networking', A.id === 'rubin' ? 'vendor' : 'spec', A.id === 'rubin'
            ? { refs: [ref('nvidia-bluefield4-blog', '"software-defined acceleration across AI data storage, networking and security"')], vs: 'the host CPU handling these functions directly' }
            : { refs: [ref('nvidia-bf3-networking-docs', 'describes BlueField-3 offloading "software-defined networking, storage, security, and management functions"')] }]] },
      { id: 'gpu', title: X.gpus, kicker: 'Where the links begin', drill: 5,
        body: 'Every one of these links starts at the edge of the GPU dies.',
        specs: [['Links per GPU', 'NVLink, C2C, PCIe to the NIC', 'reported', { refs: [ref('nvidia-nvl72-reference-arch', 'describes each compute tray’s GPU connecting out over NVLink to the spine, NVLink-C2C to its CPU, and PCIe to its NIC')] }]] },
    ] : [
      { id: 'nvswitch', title: 'NVSwitch chips', kicker: 'Scale-up, on the board',
        body: 'NVLink runs in the baseboard’s copper traces from each GPU to four NVSwitch chips. No cables: the whole domain fits on one board.',
        specs: [['Per GPU', '18 links, 900 GB/s', 'spec', { refs: [ref('nvidia-h100-product-page', 'spec table: "NVLink | 900GB/s"')] }], ['Switch chips', '4', 'spec', { refs: [ref('nvidia-dgxh100-user-guide', 'Component Descriptions: "4 x 4th generation NVLinks that provide 900 GB/s"')] }]] },
      { id: 'pcie', title: 'PCIe switches', kicker: 'GPU to CPU and NIC',
        body: 'PCIe Gen5 switches connect each GPU to its NIC and to the CPUs. Data to other servers goes GPU → PCIe → NIC without passing through CPU memory.',
        specs: [['Generation', 'PCIe Gen5, ≈64 GB/s per x16 direction', 'spec', { refs: [ref('nvidia-dgxh100-user-guide', 'Component Descriptions: "2 x Intel Xeon 8480C PCIe Gen5 CPUs"'), ref('wikipedia-pcie', 'link-performance table: PCIe 5.0 x16, "63.015" GB/s one direction')] }]] },
      { id: 'cx', title: 'ConnectX-7 NICs', kicker: 'One per GPU',
        body: 'Eight single-port 400 Gb/s NICs, one for each GPU, carry scale-out traffic.',
        specs: [['Per GPU', '400 Gb/s', 'spec', { refs: [ref('nvidia-dgxh100-user-guide', 'Component Descriptions: "4 x OSFP ports for 8 x NVIDIA ConnectX-7 Single Port" cards, "Up to 400Gbps"')] }]] },
      { id: 'osfp', title: 'Twin-port optical cages', kicker: 'Electrons become light', drill: 6,
        body: 'Four cages at the back each hold one 800G twin-port module carrying two 400G links.',
        specs: [['Cages', '4, 2 × 400G each', 'spec', { refs: [ref('nvidia-dgxh100-user-guide', 'Component Descriptions: "4 x OSFP ports for 8 x NVIDIA ConnectX-7 Single Port" cards — 4 physical cages, 2 GPUs’ ports each')] }]] },
      { id: 'dpu', title: 'Storage & management NICs', kicker: 'Front-end network',
        body: 'Two dual-port ConnectX-7 cards run storage and the front-end network, separate from the GPU fabric. NVIDIA’s own DGX H100 hardware guide and datasheet describe these as ConnectX-7 cards, not BlueField DPUs.',
        specs: [['Count', '2 per server', 'spec', { refs: [ref('nvidia-dgxh100-user-guide', 'Component Descriptions: "2 x NVIDIA ConnectX-7 Dual Port Ethernet Cards" for storage/management networking')] }]] },
      { id: 'gpu', title: 'H100 GPUs', kicker: 'Where the links begin', drill: 5,
        body: 'Every one of these links starts at the edge of the GPU die.',
        specs: [['Links per GPU', 'NVLink, PCIe to the NIC', 'reported', { refs: [ref('naddod-gb200-interconnect', 'describes each H100 GPU connecting out over NVLink to its NVSwitch and PCIe to its NIC/CPU')] }]] },
    ],
    chip: [
      { id: 'hbm', title: A.hbm.type, kicker: `${hbmTB}, millimeters away`,
        body: 'The fastest link in the building is the shortest: thousands of wires through the interposer between each HBM stack and the dies.',
        specs: [['Bandwidth', hbmTB, EV6.hbm.basis, EV6.hbm.ev]] },
      ...(A.dies > 1 ? [{ id: 'hbi', title: 'NV-HBI', kicker: '10 TB/s die to die',
        body: 'The two dies join across their seam fast enough that software sees one GPU.',
        specs: [['Bandwidth', '10 TB/s', EV6.dieRow.basis, EV6.dieRow.ev]] }] : []),
      { id: 'nvphy', title: 'NVLink SerDes', kicker: `${A.nvlink.gen} leaves here`,
        body: `Serializer circuits along the die edge push NVLink out through the package, ${nvlTB} per GPU.`,
        specs: [['Per GPU', nvlTB, EV6.nvlink.basis, EV6.nvlink.ev]] },
      { id: 'cpo', title: 'Light on the package', kicker: 'What comes next',
        body: 'Today the GPU speaks copper and a module turns it into light. Switches already carry optical engines on the package; bringing them to the GPU would let scale-up reach beyond one rack.',
        specs: [[A.short, 'electrical I/O only', 'reported', { refs: [['nvidia-dgx-gb200-user-guide', 'hardware overview: "connected by NVLink through the NVLink passive copper cable cartridge backplane"']] }]] },
      { id: 'tokens', title: 'Tokens', kicker: 'What leaves',
        body: 'After all those links, the output is small: a few bytes per token, sent back out the front-end network to whoever asked.',
        specs: [['Per token of text', 'a few bytes', 'assumed', { assume: 'token-byte-size' }]] },
    ],
  };

  // ---------- heat-mode parts per scene. Positions come from each scene's heatHotspots ----------
  const PARTS_HEAT = {
    across: [
      { id: 'climate', title: 'Climate picks sites', kicker: 'Heat stays local',
        body: 'Power travels, heat does not. Builders favor places where outside air is cool enough to reject heat most of the year, and where water is not scarce.',
        specs: [['Free cooling', 'most hours in cool climates', 'assumed', { assume: 'free-cooling-framing' }]] },
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
        specs: [['Rise', '≈10 °C', 'assumed', { assume: 'hall-water-rise-10c' }], ['Supply → return', `≈${TT.fwsSupply} → ${TT.fwsReturn} °C`, 'assumed', { assume: 'loop-temps' }]] },
      { id: 'hotaisle', title: 'Hot aisle', kicker: air ? 'All the heat, as air' : 'The air-side heat',
        body: 'Rack backs face each other across a sealed aisle, so hot air rises and flows to the coolers instead of warming the room.',
        specs: [['Air share of rack heat', `≈${Math.round((1 - liq) * 100)}%`, 'derived', { calc: 'hall-air-heat-share' }]] },
      { id: 'fanwall', title: 'Fan wall', kicker: 'Air back to cool',
        body: 'Fans pull hot-aisle air through water coils and blow it back into the room cool, closing the air loop.',
        specs: [air
          ? ['Moves', 'room loads and overflow', 'assumed', { assume: 'hall-standard-practice' }]
          : ['Moves', `the ≈${Math.round((1 - liq) * 100)}% air share`, 'derived', { calc: 'hall-air-heat-share' }]] },
      { id: 'riser', title: warm ? 'Risers to the roof' : 'Risers to the plant', kicker: 'Heat leaves the building',
        body: `The headers turn up and out to the ${warm ? 'dry coolers' : 'chillers'}.`,
        specs: [['Carries', 'nearly all of the hall’s heat', 'assumed', { assume: 'hall-standard-practice' }]], drill: 1 },
    ],
    rack: nvl ? [
      { id: 'manifold', title: 'Coolant manifolds', kicker: 'Cool in, warm out',
        body: 'Supply comes up one side, fans out to every tray through dripless quick disconnects, and returns warmer down the other.',
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
        body: 'Copper plates with fine internal fins sit on each GPU and CPU, lifted here to show the chips. Coolant runs through them in series and leaves a few degrees warmer each time.',
        specs: (() => { const p = gpuPowerEv(); return [['Heat per GPU', `≈${(A.gpuW / 1000).toFixed(1)} kW`, p.basis, p.ev]]; })() },
      { id: 'gpuheat', title: 'The heat source', kicker: `Four GPUs, two CPUs`, drill: 5,
        body: 'Almost all of the tray’s power ends up here, in a few square centimeters of silicon under each plate.',
        specs: [['Tray heat', `≈${trayKW.toFixed(1)} kW`, 'derived', { calc: 'tray-power' }]] },
      { id: 'fans', title: 'Fans', kicker: 'For what water misses',
        body: liq >= 0.99 ? 'Reports say this tray has no fans at all; they are drawn here for comparison.' : 'Small fans push air past the NICs, optical modules and drives, which have no cold plates.',
        specs: [['Air-cooled parts', liq >= 0.99 ? 'none, by this model' : 'NICs, SSDs, M.2 boards', liq >= 0.99 ? 'assumed' : 'reported', liq >= 0.99 ? { assume: 'rubin-full-liquid-cooling' } : { refs: [ref('nvidia-dgx-gb200-hardware', 'Hardware: compute trays are liquid-cooled on "the CPUs and the GPUs"; NICs, drives and optics are not on the manifold')] }]] },
      { id: 'qd', title: 'Quick disconnects', kicker: 'Dripless',
        body: 'Couplings at the back seal as the tray is pulled, so a tray comes out dry.',
        specs: [['Per tray', 'one supply, one return per board', 'reported', { refs: [ref('nvidia-dgx-gb200-hardware', 'Hardware: the rear provides "inlets and outlets to the liquid cooling manifolds"')] }]] },
    ] : [
      { id: 'heatsinks', title: 'Heat sinks', kicker: 'Fins and vapor chambers',
        body: 'Each GPU’s heat spreads through a vapor chamber into a tall stack of fins. Air carries it away; nothing here is water.',
        specs: [['Heat per GPU', '700 W', 'spec', { refs: [ref('nvidia-h100-product-page', 'spec table: "Max thermal design power (TDP) | Up to 700W (configurable)"')] }]] },
      { id: 'gpuheat', title: 'The heat source', kicker: 'Eight GPUs', drill: 5,
        body: 'Most of the server’s ten kilowatts is made here, under the heat sinks.',
        specs: [['GPUs', '8 × 700 W', 'spec', { refs: [ref('nvidia-dgxh100-user-guide', 'Component Descriptions: "8 x NVIDIA H100 GPUs"'), ref('nvidia-h100-product-page', 'spec table: "Max thermal design power (TDP) | Up to 700W (configurable)"')] }]] },
      { id: 'fans', title: 'Fans', kicker: 'Front to back',
        body: 'A wall of fans at the front pulls air through the whole server. At full load they are a noticeable share of its power.',
        specs: [['Fans', '12', 'assumed', { assume: 'dgx-h100-fan-count' }], ['Airflow at a 15 °C rise', '≈1,200 CFM per server', 'derived', { calc: 'fan-airflow' }]] },
    ],
    chip: [
      { id: 'junction', title: A.dies > 1 ? 'The dies' : 'The die', kicker: 'Hottest point in the building',
        body: 'Transistors switching billions of times a second turn nearly every watt into heat right at the surface of the silicon.',
        specs: [['Package power', `≈${n0(A.gpuW)} W`, EV6.pkgPower.basis, EV6.pkgPower.ev], ['Compute dies, this model', `≈${n0(A.gpuW * (1 - A.hbmShare))} W; the rest is HBM`, 'derived', { calc: 'gpu-die-power' }], ['At full load, this operating point', `≈${TT.die} °C`, 'assumed', { assume: 'loop-temps' }], ['Throttle point', 'near ≈85 °C; NVIDIA publishes none', 'assumed', { assume: 'throttle-point' }]] },
      { id: 'flux', title: 'Heat flux', kicker: 'Like a stovetop, but denser',
        body: `About ${n0(A.gpuW * (1 - A.hbmShare))} W through ${A.dies > 1 ? 'two reticle-size dies' : 'one reticle-size die'} averages about ${flux} watts per square centimeter, several times a stove burner. Hot spots on the die run far higher, and those set the ${nvl ? 'cold plate' : 'heat sink'} design.`,
        specs: [[A.dies > 1 ? 'Die area, two dies' : 'Die area', `≈${X.dieCm2} cm²`, EV6.fluxDie.basis, EV6.fluxDie.ev], ['Average flux', `≈${flux} W/cm²`, 'derived', { calc: 'heat-flux' }], ['Hot spots, cooling trade press', '500+ W/cm²', 'reported', { refs: [['alliance-chemical-gpu-thermal', 'body text: "At 1,000 W TDP with an active die area of approximately 1.5–2 cm², the resulting heat flux at the cold-plate interface reaches 500–600 W/cm²" (B200)']] }]] },
      { id: 'tim', title: 'Thermal interface and lid', kicker: 'The first hop out',
        body: `A thin thermal interface material carries heat from the ${A.dies > 1 ? 'dies' : 'die'} into the lid, and a second one into the ${nvl ? 'cold plate' : 'heat sink'}. Each layer costs a few degrees.`,
        specs: [['Layers to coolant', `die, interface, lid, interface, ${nvl ? 'plate' : 'heat sink'}`, 'assumed', { assume: 'thermal-stack-layers' }]] },
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

  // ---------- the side level: inside the optics (research/optics-internals-sources.md) ----------
  const lay = ['Layout', 'representative, not one product', 'assumed', { assume: 'optics-module-layout' }];
  const cpoLay = ['Layout', 'representative; counts are NVIDIA’s', 'assumed', { assume: 'cpo-package-layout' }];
  const osfpSize = ['OSFP body', '107.8 × 22.58 × 13.0 mm', 'reported', { refs: [ref('ascentoptics-osfp-form-factor', 'form factor dimensions: the integrated-heat-sink body as 22.58 mm wide × 107.8 mm long × 13.0 mm tall, restating the OSFP MSA')] }];
  const pins = ['Edge connector', '60 pins: 16 high-speed, 4 power, 20 ground, 20 other', 'reported', { refs: [ref('ascentoptics-osfp-form-factor', 'electrical interface: a 60-pin edge connector, allocated as 16 high-speed data, 16 low-speed/clock, 4 control, 4 power and 20 ground pins')] }];
  const lanes8 = ['Host lanes', '8 × 200G electrical, each way', 'spec', { refs: [ref('juniper-1p6t-transceiver', '"8x200G electrical—The electrical interface between the switch and the transceiver components"')] }];
  const quantumOSA = ['Per switch chip', '6 subassemblies × 3 engines = 18', 'spec', { refs: [ref('nvidia-cpo-industry-collaboration-blog', 'Quantum-X section: 28.8 Tb/s per switch ASIC through six optical subassemblies of three optical engines each')] }];
  const perEngine = ['Per engine', '1.6 Tb/s each way, 8 × 200G', 'spec', { refs: [ref('nvidia-cpo-industry-collaboration-blog', 'Quantum-X section: each optical engine carries 1.6 Tb/s transmit and 1.6 Tb/s receive over 8 × 200 Gb/s PAM4 lanes')] }];
  const fibers18 = ['Fibers per engine', '8 transmit, 8 receive, 2 laser in', 'spec', { refs: [ref('nvidia-cpo-industry-collaboration-blog', 'Quantum-X section: eight transmit, eight receive and two laser-input fibers per optical engine')] }];
  const els18 = ['Laser modules', '18 per Q3450 switch, 8 lasers each', 'spec', { refs: [ref('nvidia-cpo-industry-collaboration-blog', 'external laser source section: 18 field-replaceable ELS modules per Q3450, each with eight laser diodes'), ref('lambda-q3450-unboxing', '"18 removable external light-source modules, each feeding eight MPO ports"')] }];
  const q3450W = ['Q3450 switch, NVIDIA figure', '3.95 kW', 'vendor', { refs: [ref('lambda-q3450-unboxing', 'power section: 3.95 kW for the CPO switch against 7.0 kW for a pluggable-optics equivalent')], vs: 'a pluggable-optics equivalent switch at 7.0 kW' }];
  const portW = ['Per port, NVIDIA figure', 'as low as 9 W', 'vendor', { refs: [ref('nvidia-cpo-scaling-blog', 'body text: 30 W per port with pluggable transceivers, "as low as 9 W" per port with co-packaged optics')], vs: '30 W per port with pluggable transceivers' }];
  const coupe = ['Engine stack', '65 nm electronic chip bonded on a photonic chip', 'reported', { refs: [ref('ic-online-nvidia-coupe', 'COUPE section: a 65 nm EIC stacked on the PIC with TSMC SoIC-X hybrid bonding'), ref('trendforce-coupe-semicon-2025', '"TSMC\'s 65nm silicon photonics technology is in volume production"')] }];
  const dspW = ['1.6T module, 3 nm DSP', 'under 22 W (Marvell), under 23 W (Broadcom)', 'vendor', { refs: [ref('marvell-ara-1-6t-prnewswire', 'body text: Ara enables 1.6T modules at less than 22 W'), ref('broadcom-sian3-200g-lane-dsp', 'body text: sub-23 W 1.6T modules on Sian3')], vs: 'their 5 nm predecessors, over 20% higher by both companies’ figures' }];
  const lqd = ['Cooling', 'liquid, ASIC and optics on one loop', 'reported', { refs: [ref('lambda-q3450-unboxing', 'cooling section: one liquid-cooled architecture for the switch ASIC and the co-packaged optics together; four UDQ4 quick-disconnects')] }];
  const edge = { id: 'fingers', title: 'Edge connector', kicker: 'Back out to the cage', drill: 'out',
    body: 'Gold fingers on both faces of the board are the module’s only electrical connection: power in, and the host’s lanes in and out. The cage it plugs into is on the level you came from.', specs: [pins, osfpSize] };
  PARTS.optics = [
    { ...edge, specs: [pins, osfpSize] },
    { id: 'dcdc', title: 'Power conversion', kicker: 'Rails for every chip', body: 'The host supplies one voltage. Small converters on the module make the separate rails the DSP, the drivers and the lasers need.', specs: [lay] },
    { id: 'dsp', title: 'DSP', kicker: 'The biggest draw', body: 'The digital signal processor is the module’s largest single power draw, and the part an LPO module removes. The newest are made on a 3 nm process.', specs: [dspW] },
    { id: 'lasers', title: 'Lasers', kicker: 'Light only', body: 'In a silicon photonics module, separate continuous-wave lasers make steady light, because silicon cannot make light efficiently; the data goes onto it in the modulators. Other 1.6T modules use lasers that carry the data themselves.', specs: [['Design drawn', 'silicon photonics, separate lasers', 'assumed', { assume: 'optics-sip-design' }], ['Short-reach DR8', 'directly modulated lasers are also used', 'spec', { refs: [ref('juniper-1p6t-transceiver', '"DMLs are used for single-mode optics such as DR8"')] }]] },
    { id: 'asic', title: 'Switch ASIC', kicker: 'Most of the package power', body: 'The switch chip does the switching and drives every lane a few millimeters to the optical engines around it. One of these packages is drawn; a Quantum-X Photonics switch holds four.', specs: [q3450W, cpoLay] },
    { id: 'engine', title: 'Optical engines', kicker: 'Powered from the package', body: 'Each engine is an electronic chip bonded on top of a photonic chip, fed from the package substrate like the switch chip beside it.', specs: [coupe, quantumOSA] },
    { id: 'els', title: 'External laser sources', kicker: 'Swappable, at the front', body: 'The lasers are kept out of the hot package, in modules at the front panel that can be replaced without opening the switch. Four are drawn feeding this package; the switch’s 18 serve its four packages.', specs: [els18] },
  ];
  PARTS_DATA.optics = [
    { ...edge, specs: [lanes8, pins] },
    { id: 'dsp', title: 'DSP', kicker: 'Cleans up every lane', body: 'Host lanes arrive from the switch or NIC with loss and distortion from the board. The DSP retimes and equalizes them, then drives clean lanes to the optics; on the way back it recovers the data from the receive side. The LPO module leaves it out and lets the host’s own SerDes do that work.',
      specs: [['What it does', 'retiming, equalization, error correction', 'spec', { refs: [ref('juniper-1p6t-transceiver', '"The CDR is responsible for re-timing incoming data to reduce jitter. The DSP handles functions like equalization, error correction, and other signal processing tasks"')] }], ['Examples', 'Marvell Ara, Broadcom Sian3 (3 nm)', 'spec', { refs: [ref('marvell-ara-1-6t-prnewswire', 'headline and body: Ara, a 3 nm 1.6 Tb/s PAM4 DSP, 8 × 200G electrical and 8 × 200G optical lanes'), ref('broadcom-sian3-200g-lane-dsp', 'body text: Sian3, a 3 nm 200G-per-lane DSP PHY for 800G and 1.6T modules')] }]] },
    { id: 'driver', title: 'Drivers and TIAs', kicker: 'Analog, both ways', body: 'Drivers swing the modulators with each lane’s signal on the way out. On the way in, transimpedance amplifiers turn each photodiode’s tiny current into a voltage. In an LPO module these linear parts are all that is left between the host and the light.',
      specs: [['Receive, per module', '8 photodiodes, 8 TIAs', 'spec', { refs: [ref('juniper-1p6t-transceiver', 'receive section: eight photodetectors and eight TIAs; the TIA "converts and amplifies the electrical current from the photodiode into an electrical voltage level"')] }], ['LPO keeps', 'a linear driver, the TIA, linear equalizers', 'reported', { refs: [ref('flexoptix-lpo-intro', 'what LPO keeps: a CTLE and linear driver on transmit, a photodiode, TIA and linear equalizer on receive, none retiming the signal')] }]] },
    { id: 'pic', title: 'Silicon photonics chip', kicker: 'Where electrons become light', body: 'Modulators imprint each lane onto the lasers’ light, and waveguides carry it to the fiber edge. Photodiodes on the receive side turn incoming light back into current. Transmit and receive are separate paths on the chip.', specs: [['Design drawn', 'Mach-Zehnder modulators on silicon', 'assumed', { assume: 'optics-sip-design' }], lay] },
    { id: 'mpo', title: 'Fiber connectors', kicker: 'One fiber per lane, each way', body: 'Two MPO-12 connectors, one per DR4 half: four fibers out and four in on each, with the middle four positions unused. Sixteen fibers carry the module’s eight lanes each way.',
      specs: [['Connectors', 'dual MPO-12', 'spec', { refs: [ref('juniper-1p6t-transceiver', 'optical interface: DR8 / 2×DR4 modules use dual MPO-12/APC connectors'), ref('nvidia-800g-dr8-datasheet', 'optical interface: two MPO-12/APC connectors on the twin-port DR8 module')] }], ['Fibers lit', '16: 4 out and 4 in per connector', 'spec', { refs: [ref('nvidia-800g-dr8-datasheet', 'optical interface: a twin-port DR8 module on two MPO-12/APC connectors, eight fibers active on each (four transmit, four receive)')] }]] },
    { id: 'asic', title: 'Switch ASIC', kicker: 'Lanes go millimeters, not centimeters', body: 'The switch chip’s SerDes send each lane a few millimeters to an optical engine instead of across a board to a module at the front panel. That shorter electrical path is where CPO saves its power.',
      specs: [['Per switch chip', '28.8 Tb/s each way', 'spec', { refs: [ref('nvidia-cpo-industry-collaboration-blog', 'Quantum-X section: 28.8 Tb/s full-duplex per switch ASIC')] }], ['Electrical loss, NVIDIA figure', '≈4 dB, from 20–22 dB', 'vendor', { refs: [ref('nvidia-cpo-scaling-blog', 'body text: 22 dB for the pluggable path against approximately 4 dB with co-packaged optics'), ref('lambda-q3450-unboxing', 'body text: roughly 20 dB to 4 dB')], vs: 'the path to a pluggable module, 20–22 dB' }], portW] },
    { id: 'engine', title: 'Optical engines', kicker: 'Modulators beside the switch', body: 'Each engine stacks an electronic chip on a photonic chip. Micro-ring modulators put the lanes onto the laser light, and photodiodes read the light that comes back.',
      specs: [perEngine, ['Modulators', 'micro-rings, 200G PAM4 each', 'spec', { refs: [ref('nvidia-cpo-industry-collaboration-blog', 'body text: micro-ring modulators for 200 Gb/s PAM4 per wavelength')] }], coupe] },
    { id: 'els', title: 'External laser sources', kicker: 'Light in, no data', body: 'Laser light reaches the engines by fiber from modules at the front panel, two fibers per engine, in the same bundle as its data fibers. It carries no data until an engine’s modulators put some on it.', specs: [els18, fibers18] },
    { id: 'fiberout', title: 'Fiber out of the package', kicker: 'Detachable at the edge', body: 'Each engine’s fibers run to a connector at the package edge, and from there to the switch’s front panel.', specs: [fibers18, ['Front panel, Q3450', '144 MPO connectors', 'reported', { refs: [ref('lambda-q3450-unboxing', 'front panel: 144 MPO optical connectors for 144 × 800G ports')] }]] },
  ];
  PARTS_HEAT.optics = [
    { id: 'dsp', title: 'DSP', kicker: 'The module’s hot spot', body: 'Most of a DSP module’s heat starts in the DSP. A gap pad carries it up into the shell. Without it, an LPO module runs cooler.', specs: [dspW] },
    { id: 'shell', title: 'Shell and fins', kicker: 'Cooled by the host’s air', body: 'The module has no fan of its own. Its finned top sits in the air the switch or server moves past the cages.', specs: [osfpSize, lay] },
    { id: 'asic', title: 'Switch ASIC and engines', kicker: 'One package, one plate', body: 'The switch chip and the optical engines around it share one package, and their heat goes up into one cold plate.', specs: [lqd, q3450W] },
    { id: 'coldplate', title: 'Cold plate', kicker: 'Water, not air', body: 'Water through the plate carries the package’s heat away. The lasers, at the front panel, stay out of it.', specs: [lqd] },
  ];

  // The numbered parts at a level (pins, the list, "Play 1 to N") read as one walk: the way the thing flows, without
  // the camera crossing the scene and back. Levels not listed already read that way as written. Reviewed 09/27/2026.
  for (const [P, walk] of [[PARTS, WALK.power], [PARTS_DATA, WALK.data], [PARTS_HEAT, WALK.heat]])
    for (const [sc, ids] of Object.entries(walk)) if (P[sc]) P[sc] = [...P[sc]].sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));

  return {
    SCENES, PARTS, PARTS_DATA, PARTS_HEAT, BOM, TEMPS, PARALLEL, LEDGER_END,
    LEDGER: M.ledger, LEDGER_MARKS: M.marks, STAIRCASE: M.staircase, BANDWIDTH: M.bandwidth,
  };
}
