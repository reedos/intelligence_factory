// Content model for The Intelligence Factory.
// Every number carries a basis: 'spec' (vendor or standards body states it), 'typical'
// (industry-typical figure several sources agree on) or 'est' (derived here, or uncertain).
// The page shows the basis next to the number. Sources are listed in research/*.md.

export const BASIS = {
  spec: { label: 'Published spec', short: 'Spec' },
  typical: { label: 'Industry typical', short: 'Typical' },
  est: { label: 'Estimate', short: 'Est.' },
};

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
  // heat classes
  hot: { css: '#ffc34a', name: 'Heat from silicon', short: 'heat' },
  air: { css: '#ff8a4a', name: 'Hot air', short: 'air' },
  vapor: { css: '#d6e6ff', name: 'Evaporation', short: 'vapor' },
};

import { SITES, PLACES, placeKey, STATE_CARBON, DEFAULT_PLACE, US_CARBON_G, STATUS_WORD } from './model/sites.ts';
// a real campus's status as spec rows: its state and live figure, and a ranking where one is claimed
const statusRows = s => [[`Status, ${s.status.asOf}`, `${STATUS_WORD[s.status.state]} · ${s.status.live}`, 'est'], ...(s.status.rank ? [['Ranking, Epoch AI', 'Most powerful operating today', 'est']] : [])];

// Facts the text needs per accelerator that the engine does not use for arithmetic.
const FACTS = {
  h100: {
    gpu: 'H100', gpus: 'H100 GPUs', arch: 'Hopper', transistors: '80 billion', tBasis: 'spec', process: 'TSMC 4N', pBasis: 'spec',
    dieCm2: 8.14, packaging: 'TSMC CoWoS-S', cpu: 'Xeon', cpuLong: 'Intel Xeon Platinum 8480C', cpuCores: '56 cores each', cpuMem: '2 TB DDR5 per server',
    nic: 'ConnectX-7', nicNote: '400 Gb/s per GPU', mBasis: 'spec',
  },
  gb200: {
    gpu: 'Blackwell', gpus: 'Blackwell GPUs', arch: 'Blackwell', transistors: '208 billion', tBasis: 'spec', process: 'TSMC 4NP', pBasis: 'spec',
    dieCm2: 16, packaging: 'TSMC CoWoS-L', cpu: 'Grace', cpuCores: '72 Arm Neoverse V2 cores', c2c: '900 GB/s', cpuMem: '480 GB LPDDR5X per CPU (17 TB per rack)',
    nic: 'ConnectX SuperNIC', nicNote: '400G early, 800G with ConnectX-8', mBasis: 'spec',
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

export function content(M) {
  const { accel: A, power: P, cooling: CL, NET, racks: RACKS, gpus: GPUS, IT_MW, layout: L, rack: RK } = M;
  const X = FACTS[A.id];
  const nvl = A.gpusPerRack === 72, dc = P.id === 'dc800', air = CL.id === 'air', warm = CL.id === 'warm';
  const n0 = v => Math.round(v).toLocaleString('en-US');
  const kfmt = v => v >= 1e6 ? `${(v / 1e6).toFixed(1)} million` : v >= 1e4 ? `${n0(v / 1000)}k` : n0(v);
  const mwTxt = v => v >= 1000 ? `${+(v / 1000).toFixed(2)} GW` : v >= 10 ? `${n0(v)} MW` : `${v.toFixed(1)} MW`;
  const meter = mwTxt(M.meterMW);
  const lossOf = prefix => M.ledger.filter(r => r.label.startsWith(prefix)).reduce((a, r) => a + r.mw, 0);
  const lossTxt = prefix => { const v = lossOf(prefix); return v >= 10 ? `≈${n0(v)} MW` : `≈${v.toFixed(1)} MW`; };
  const rackKW = Math.round(RK.kw);
  const liq = air ? 0 : A.liquidShare, liqKW = Math.round(RK.kw * liq), airKW = rackKW - liqKW;
  const halls = M.halls, multiHall = halls > 1;
  const hbmTB = `${A.hbm.tbs} TB/s`;
  const nvlTB = A.nvlink.tbs >= 1 ? `${A.nvlink.tbs} TB/s` : `${A.nvlink.tbs * 1000} GB/s`;
  const nicTxt = A.nicGbps >= 1000 ? `${A.nicGbps / 1000} Tb/s` : `${A.nicGbps} Gb/s`;
  const nicShort = A.nicGbps >= 1000 ? `${A.nicGbps / 1000}T` : `${A.nicGbps}G`;
  const coreA = Math.round(A.gpuW * (1 - A.hbmShare) / 0.8 / 100) * 100;
  const flux = Math.round(A.gpuW * (1 - A.hbmShare) / X.dieCm2 / 5) * 5;
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
        ? `All ${meter} leaves as heat. Warm water climbs to rows of dry coolers on the roofs, which dump it into the air; on the hottest afternoons evaporative towers help, and cost water.`
        : air
          ? `All ${meter} leaves as heat. Chillers make cold water for the cooling units in the halls, and cooling towers throw the chillers' heat away by evaporating water: the most water-hungry way to cool.`
          : `All ${meter} leaves as heat. Chillers make cold water for the coolant units beside the racks, and cooling towers throw the chillers' heat away by evaporating water.`,
      dataIntro: multiHall
        ? `Two diverse fiber routes enter the site. Coherent optics in a line-terminal hut turn them into the campus’s link to other campuses, while thousands of strands in duct banks tie ${halls === 2 ? 'the two halls' : `all ${halls} halls`} into one fabric.`
        : 'Two diverse fiber routes enter the site. Coherent optics in a line-terminal hut turn them into the campus’s link to other campuses. With one hall, the whole fabric lives under one roof.',
      intro: `A 345 kV line lands at the campus substation. ${count(L.transformers)} transformers step it down to 34.5 kV, which runs underground to transformers along ${multiHall ? `each of ${halls} data halls` : 'the data hall'}. The grid itself lost about 5% getting here. Diesel generators and batteries stand by for when the grid drops.${halls > 2 ? ` The two halls in front are drawn in detail; the other ${halls - 2} are the plain blocks beyond.` : ''}`,
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
      heatIntro: 'Coolant enters at the back, runs through a copper plate on each CPU and GPU, and leaves warmer. Fans at the front still push air over the parts water does not touch: NICs, optics, drives.',
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
  ];

  // ---------- power-mode parts per scene. The 3D scene supplies positions; this supplies what to say ----------
  // specs: [label, value, basis]
  const PARTS = {};
  const site = M.scenario.site ? SITES[M.scenario.site] : null;
  const stateC = STATE_CARBON[(site || DEFAULT_PLACE).state];
  PARTS.across = [
    { id: 'grid', title: 'Each campus, its own grid', kicker: '345–500 kV backbone',
      body: 'High-voltage lines tie every campus to power plants and the wider grid. A gigawatt campus needs a new substation and often new lines, which is why builders spread clusters across regions where power is available.',
      specs: [['Interconnection', '230–500 kV', 'typical'], ['Example', 'Meta Hyperion: new 500 kV substation and lines', 'typical']] },
    { id: 'plants', title: 'Generation', kicker: 'Gas, nuclear, wind, solar',
      body: 'Plants inject power into the grid far from the campus; the grid delivers it with about 5% lost on the way.',
      specs: [['US grid losses', '≈5% (EIA)', 'spec']] },
    site
      ? { id: 'home', title: site.name, kicker: `${site.place} · ${meter} modeled`,
        body: `${site.owner}. This page rebuilds the campus from the closest scenario it can: ${site.unknowns.join(' ')} Go in to follow the power down.`,
        specs: [...statusRows(site), ...site.facts, ['Modeled here', `${meter} at the meter, ${A.short}, ${M.cooling.short.toLowerCase()} cooling`, 'est']], drill: 1 }
      : { id: 'home', title: 'This campus', kicker: `${meter} at the meter`,
        body: `The campus this page follows, ${meter} at the meter, placed in southwest Ohio for the map. Pick a real campus in the scenario bar to move it. Go in to the substation and follow the power down.`,
        specs: [['Meter', meter, 'est'], ['IT load', `${mwTxt(IT_MW)} at PUE ${M.pue.toFixed(2)}`, 'est']], drill: 1 },
    { id: 'carbon', title: 'Grid carbon by state', kicker: `${stateC ? `${stateC.name}: ${stateC.g} g CO₂/kWh` : 'EIA state profiles, 2024'}`,
      body: `Shaded states have EIA figures: teal for hydro-heavy grids, amber and red for coal and gas. The same campus emits three to four times more in Wisconsin than in Washington.${site ? ` ${site.carbonNote}` : ''}`,
      specs: [...(stateC ? [[`${stateC.name}, 2024`, `${stateC.lb.toLocaleString('en-US')} lb/MWh, ${stateC.g} g/kWh`, 'spec']] : []), ['US average, eGRID 2022', `${US_CARBON_G} g/kWh`, 'spec'], ['Lowest shown, Washington', '113 g/kWh', 'spec'], ['Highest shown, Wisconsin', '494 g/kWh', 'spec']] },
    ...PLACES.filter(p => !site || !p.ids.includes(site.id)).map(p => {
      // Colossus 1 and 2 share a pin; the card leads with the one that is bigger now
      const ss = p.ids.map(id => SITES[id]), lead = ss.find(x => x.status.rank) || ss[0];
      return { id: placeKey(p), title: p.name, kicker: `${p.site.place} · ${ss.map(x => STATUS_WORD[x.status.state].toLowerCase()).join(', ')}`,
        body: `${p.site.owner}. ${ss.map(x => (ss.length > 1 ? `${x.name.replace(/^xAI /, '')}: ` : '') + x.status.line).join(' ')}${lead.status.rank ? ` ${lead.status.rank}` : ''} Choose it under Real campuses in the scenario bar to rebuild this page around it.`,
        specs: [...ss.flatMap(x => statusRows(x).map(([k, v, b]) => [ss.length > 1 ? `${x.name.replace(/^xAI /, '')}: ${k.toLowerCase()}` : k, v, b])), ...p.site.facts] };
    }),
  ];
  const lineA = M.staircase[0].current;
  PARTS.campus = [
    { id: 'line', title: 'Transmission line', kicker: '345 kV AC · 3 phases × 2 circuits',
      body: `Lattice towers carry two three-phase circuits of bundled aluminum conductor, with a shield wire on top to take lightning. At 345 kV the whole ${meter} campus rides on ${lineA.replace(' per phase', '')} per phase, which is why power travels far at high voltage.${M.meterMW > 1500 ? ' A campus this big would take several circuits, or 500 kV.' : ''}`,
      specs: [['Voltage', '345 kV line-to-line', 'typical'], [`Current, ${meter}`, lineA, 'est'], ['US grid losses, 2018–2022', '≈5% (EIA)', 'spec'], ['Example', 'Stargate Abilene: double 345 kV corridor', 'typical']] },
    { id: 'substation', title: 'Campus substation', kicker: 'Utility interconnect',
      body: 'The line dead-ends on steel gantries and lands on a ring of SF₆ circuit breakers and disconnect switches. Instrument transformers measure it, surge arresters clip lightning, and tall masts shield the yard.',
      specs: [['Breakers', '6 dead-tank SF₆, ring bus', 'est'], ['Yard', '≈200 × 150 m gravel pad', 'est'], ['Build time', '2–4 years with interconnection study', 'typical']] },
    { id: 'mpt', title: 'Main power transformers', kicker: '345 kV → 34.5 kV',
      body: `Oil-filled transformers, each the weight of a loaded freight car, step the line down to the campus distribution voltage. Radiators and fans shed their heat; concrete fire walls keep one fire from taking the others.${L.transformers > 3 ? ` Three are drawn; this campus needs ${L.transformers}.` : ''}`,
      specs: [['Rating', `${L.transformers} × ${L.mvaUnit} MVA, N+1`, 'est'], ['Efficiency, >100 MVA units', '99.5–99.7%', 'typical'], [`Loss at ${meter}`, lossTxt('Main power'), 'est'], ['Lead time, 2026', '120–144 weeks', 'typical']] },
    { id: 'ehouse', title: '34.5 kV switchgear', kicker: 'Campus distribution',
      body: 'Prefabricated switchgear buildings split the transformer output into feeders, each breaker-protected, that run in concrete duct banks under the roads to the data halls.',
      specs: [['Feeders', `≈${n0(L.feeders)}, each ≈10 MW`, 'est'], ['Voltage', '34.5 kV (some campuses use 13.8 kV)', 'typical'], ['Loss, cables + gear', lossTxt('Campus cables'), 'est']] },
    { id: 'gensets', title: 'Standby generator yard', kicker: 'Diesel, 480 V stepped up to 34.5 kV',
      body: 'Containerized diesel sets, such as Cummins’ QSK78 or Caterpillar’s C175-16 in the 2.5-3 MW class, start within about ten seconds of a grid failure. The UPS batteries carry the load until they take over. They run a few hours a year, mostly for testing.',
      specs: [['Unit size', '2.5–3 MW class', 'spec'], ['Units here', `≈${n0(L.gensets)}, N+20%`, 'est'], ['Fuel, 2.5 MW at full load', '173 US gal/h (≈0.26 L/kWh)', 'spec'], ['Start to load', '≈10 s', 'typical']] },
    { id: 'fuel', title: 'Bulk fuel storage', kicker: '48 hours at full load',
      body: 'Horizontal steel tanks hold enough diesel to run the whole campus for two days, with polishing skids that keep stored fuel clean.',
      specs: [[`Volume, 48 h at ${meter}`, `≈${L.fuelML >= 10 ? n0(L.fuelML) : L.fuelML.toFixed(1)} million L`, 'est'], ['Tanker deliveries to refill', `≈${n0(L.fuelML * 1e6 / 30000)}`, 'est']] },
    { id: 'bess', title: 'Battery energy storage', kicker: 'Smooths GPU load swings',
      body: 'Thousands of GPUs stepping in lockstep during training can swing campus load by tens of megawatts in seconds. Grid-side batteries absorb the swings the utility would otherwise see, and can sell grid services.',
      specs: [['Size here', `≈${n0(L.bessMW)} MW / ${n0(L.bessMWh)} MWh`, 'est'], ['Training load swings', 'up to ≈100 MW, sub-second', 'typical'], ['Example', 'xAI Colossus: up to ≈150 MW of Megapacks', 'typical']] },
    { id: 'unitsubs', title: 'Unit substations', kicker: '34.5 kV → 480 V',
      body: dc
        ? 'Pad-mounted transformers along each hall drop the feeders to 480 V for the cooling plant and building loads. The IT load skips them: solid-state transformers inside take 34.5 kV straight to 800 V DC.'
        : 'A line of pad-mounted transformers along each hall drops the feeders to 480 V right outside the electrical rooms, keeping the high-current low-voltage runs short.',
      specs: [['Count', `≈${n0(dc ? Math.ceil((M.coolMW + M.miscMW) / 2.2) : L.unitSubs)} × 2.5 MVA`, 'est'], ['Efficiency', '≈99%', 'typical']], drill: 2 },
    { id: 'hall', title: 'Data halls', kicker: `${halls} ${halls > 1 ? 'halls' : 'hall'}, ≈${kfmt(RACKS)} racks, ≈${kfmt(GPUS)} GPUs`,
      body: `The halls hold the IT load, about 45 MW each. Each floor is a slab with no raised floor: ${nvl ? 'racks are too heavy and the cooling is water, not air under the floor' : 'air comes from cooling units in the rows, not up through floor tiles'}.`,
      specs: [['IT load', `${mwTxt(IT_MW)} at PUE ${M.pue.toFixed(2)}`, 'est'], ['Racks', `≈${n0(RACKS)}`, 'est'], ['Halls', `${halls}`, 'est'], ['Floor load, one rack', nvl ? '≈1.4 t on 0.6 × 1.2 m' : '≈0.6 t, four 130 kg servers plus the rack', 'typical']], drill: 2 },
    warm
      ? { id: 'drycoolers', title: 'Dry coolers', kicker: 'Heat out, no water used',
        body: 'Rooftop coils, such as EVAPCO’s Apex or Baltimore Aircoil’s TrilliumSeries dry coolers, reject the heat carried out of the GPUs by warm water with big fans. Water at 30–40 °C is warm enough to dump heat to outside air most of the year without chillers.',
        specs: [['Heat rejected', `≈${mwTxt(IT_MW * 1.05)}`, 'est'], ['Units, ≈0.8 MW each', `≈${n0(L.dryCoolers)}`, 'est'], ['Water classes', 'ASHRAE W32–W45: 32–45 °C max supply', 'spec'], ['Water use, dry + adiabatic', '≈0.15–0.17 L/kWh', 'typical']] }
      : { id: 'chillers', title: 'Chiller plant', kicker: 'Makes cold water',
        body: `Chillers, such as Schneider Electric’s Uniflair line, run a refrigeration cycle to cool water to ${air ? 'about 12 °C for the air coolers in the halls' : 'about 20 °C for the racks’ coolant units'}. Their compressors are the biggest power draw in cooling, which is why this design lands at PUE ${M.pue.toFixed(2)}.`,
        specs: [['Chillers, ≈4 MW (1,100 ton) each', `≈${n0(L.chillers)}`, 'est'], ['Cooling power', mwTxt(M.coolMW), 'est'], ['Chiller efficiency', 'COP ≈5–7 at design', 'typical']] },
    { id: 'towers', title: warm ? 'Cooling towers & tanks' : 'Cooling towers', kicker: warm ? 'For the hottest days' : 'Where the heat and water go',
      body: warm
        ? 'Evaporative towers trim water temperature on hot afternoons, and the tanks hold treated makeup water and fire water.'
        : 'Towers take the chillers’ heat, and the heat of their compressors, and throw it away by evaporating water. That is where most of a data center’s water goes.',
      specs: [['Towers', `≈${n0(L.towers)}`, 'est'], ['Water, on site', `≈${M.wue.toFixed(2)} L/kWh`, 'typical'], ['Use', warm ? 'peak days only' : 'all year', 'est']] },
    { id: 'fiber', title: 'Fiber entrances', kicker: 'Two diverse routes',
      body: 'Long-haul fiber enters at two vaults on opposite sides of the site, so one backhoe cannot cut the campus off. Tokens leave the same way the questions arrive.',
      specs: [['Routes', '2 or more, physically separate', 'typical']] },
  ];
  PARTS.hall = [
    { id: 'unitsub', title: 'Unit substation', kicker: dc ? '34.5 kV → 480 V, for cooling' : '34.5 kV → 480 V, 2.5 MVA',
      body: dc
        ? 'Outside the wall, a pad-mounted transformer still makes 480 V for pumps, fans and lights. The racks no longer need it.'
        : 'Outside the wall, a pad-mounted transformer takes one campus feeder and makes 480 V three-phase. Its secondary runs a few meters through the wall into the switchgear.',
      specs: [['Rating', '2.5 MVA', 'typical'], ['Secondary current', '≈3,000 A at full load', 'est'], ['Efficiency', '≈99%', 'typical']] },
    { id: 'swgr', title: dc ? 'Medium-voltage switchgear' : '480 V switchgear', kicker: 'Breakers and transfer',
      body: dc
        ? 'Breakers protect each 34.5 kV feed into the solid-state transformers and switch between utility and generator power when the grid drops.'
        : 'A lineup of drawout breakers protects every outgoing circuit and switches the room between utility and generator when the grid drops.',
      specs: [['Transfer', 'automatic, utility ↔ generator', 'typical']] },
    dc
      ? { id: 'sst', title: 'Solid-state transformers', kicker: '34.5 kV AC → 800 V DC',
        body: 'Power electronics switching at high frequency replace the 60 Hz transformer, the UPS and the rack rectifiers with one conversion. NVIDIA and partners such as Navitas, Delta and Infineon/SolarEdge target these for 2027 racks; the efficiency here is a vendor claim.',
        specs: [['Efficiency, Navitas claim', '>98%', 'est'], ['Modules here, ≈2.5 MW', `≈${n0(L.sstModules)}`, 'est'], ['Loss', lossTxt('Solid-state'), 'est']] }
      : { id: 'ups', title: 'UPS modules', kicker: 'Double conversion',
        body: 'The UPS turns AC into DC and back to clean AC, with batteries on the DC link. It rides through the seconds between a grid failure and the generators taking load.',
        specs: [['Module', '1.25–1.5 MW', 'typical'], ['Modules here', `≈${n0(L.upsModules)}`, 'est'], ['Efficiency, Eaton 9395XR', 'up to 97.5% online, 99% eco', 'spec'], [`Loss at ${meter}`, lossTxt('UPS'), 'est']] },
    { id: 'batt', title: dc ? 'DC battery cabinets' : 'Battery cabinets', kicker: 'Lithium-ion, ≈5 minutes',
      body: dc
        ? 'Batteries sit right on the 800 V DC bus, with no inverter between them and the racks, so there is no UPS conversion loss at all.'
        : 'Racks of lithium-ion modules on the UPS DC link. Five minutes is plenty: the generators are carrying the load within a minute.',
      specs: [['Runtime', 'set by string count, often ≈5 min', 'est'], ['Chemistry', 'Li-ion (LFP or NMC)', 'typical']] },
    { id: 'busway', title: dc ? '800 V DC busway' : 'Overhead busway', kicker: dc ? '800 V DC to every rack' : '415 V to every rack',
      body: dc
        ? `Two conductors instead of three phases, and about a fifth of the current of 415 V AC at the same power. NVIDIA says 800 V DC cuts copper in the rack path by 45%.`
        : 'A transformer steps 480 V to 415 V, the voltage OCP rack power shelves take. Copper bars in an aluminum housing then run over each row, and plug-in tap-off boxes drop a short cable into each rack, so moving a rack means moving a plug.',
      specs: dc
        ? [['Rack voltage', '800 V DC', 'est'], ['Per rack', M.staircase.find(s => s.v === 800)?.current ?? '', 'est'], ['Copper, NVIDIA claim', '−45%', 'spec']]
        : [['Rack voltage', '415 V three-phase (OCP ORv3)', 'spec'], ['Per rack', `${M.staircase.find(s => s.v === 415)?.current ?? ''} at ${rackKW} kW`, 'est'], ['Why busway', 'tap-offs move without rewiring', 'typical']] },
    { id: 'racks', title: nvl ? `${A.short} NVL72 racks` : 'DGX H100 racks', kicker: `${rackKW} kW each`,
      body: nvl
        ? `Each rack draws what a whole row of racks drew ten years ago. About ${Math.round(liq * 100)}% of its heat leaves in water${liq < 1 ? ', the rest in air' : ''}.`
        : 'Four air-cooled servers per rack, eight GPUs each. More would overheat: NVIDIA caps air-cooled DGX H100 at four per rack.',
      specs: nvl
        ? [['Power, this model', `≈${rackKW} kW`, 'est'], ['Published range', `${A.publishedRackKW[0]}–${A.publishedRackKW[1]} kW`, A.basis], ['GPUs', `72 ${X.arch}`, 'spec'], ['Liquid / air', `${liqKW} kW / ${airKW} kW`, 'est']]
        : [['Power, this model', `≈${rackKW} kW`, 'est'], ['Published', '≈41 kW for 4 systems', 'spec'], ['GPUs', '32 H100', 'spec']],
      drill: 3 },
    { id: 'containment', title: 'Hot aisle containment', kicker: air ? 'Keeps hot and cold air apart' : 'For the heat water misses',
      body: 'Glass roofs and doors close the aisle between rack backs, so the warm air goes straight back to the coolers instead of mixing into the room.',
      specs: [['Air share of heat', `≈${Math.round((1 - liq) * 100)}%`, 'est']] },
    air
      ? { id: 'inrow', title: 'In-row cooling units', kicker: 'Chilled water, cold air',
        body: 'Cabinets the size of a rack sit in each row. Fans pull hot-aisle air through chilled-water coils and blow it out cold into the room at the rack fronts.',
        specs: [['Capacity', '≈60–100 kW each', 'typical'], ['Units here', `≈${n0(L.airUnits)}`, 'est'], ['Supply air', '≈18–27 °C (ASHRAE)', 'spec']] }
      : { id: 'cdu', title: 'Coolant distribution unit', kicker: 'Two loops, one heat exchanger',
        body: 'The CDU keeps the rack loop, filtered water with glycol running through cold plates, separate from facility water. Units such as Vertiv’s CoolChip or Motivair’s CDU line pack the pumps, plate heat exchanger and controls into one cabinet at the row end.',
        specs: [['Capacity range', '70 kW – 2.5 MW', 'spec'], ['Units here, ≈1.25 MW', `≈${n0(L.cdus)}`, 'est'], ['Rule', 'rack loop stays above dew point', 'spec']] },
    { id: 'fwater', title: air ? 'Chilled water loop' : 'Facility water loop', kicker: 'Supply and return headers',
      body: `Insulated steel headers carry water between the ${air ? 'cooling units' : 'CDUs'} and the ${warm ? 'rooftop dry coolers' : 'chiller plant'}. Blue carries cooler supply, red carries warm return.`,
      specs: [['Supply', warm ? '≈40–45 °C' : air ? '≈12 °C' : '≈20–30 °C', 'typical'], ['Temperature rise', '≈10 °C across the racks', 'est']] },
    { id: 'fanwall', title: 'Fan wall', kicker: 'Air side',
      body: air ? 'A wall of fans and coils handles room air and the heat from lights, people and power gear.' : 'A wall of fans and coils cools the air that carries the remaining heat from power shelves, switches, optics and memory.',
      specs: [['Share of rack heat', `≈${Math.round((1 - liq) * 100)}%`, 'est']] },
    { id: 'network', title: 'Network spine', kicker: 'Where tokens leave',
      body: 'Spine switches tie every rack to every other and to the fiber out of the building. Dense yellow trays carry thousands of fibers overhead.',
      specs: [['Per GPU', `${nicTxt} scale-out`, 'est']] },
  ];
  PARTS.rack = nvl ? [
    { id: 'feed', title: 'Rack feed', kicker: dc ? '800 V DC in' : '415 V AC in',
      body: 'Two tap-off cables from the overhead busway plug into the top of the rack: A and B feeds for redundancy.',
      specs: [['Feeds', 'A + B', 'typical']] },
    dc
      ? { id: 'shelves', title: 'DC-DC shelves', kicker: '800 V DC → ≈50 V DC',
        body: 'With DC already in the busway, shelves such as Delta’s or LITEON’s 800 V DC power shelves only step voltage down, one conversion instead of rectifying AC. Later racks move this conversion onto the trays.',
        specs: [['Efficiency, Navitas claim', '≈98.5% peak', 'est'], ['Loss per rack', `≈${RK.convKW.toFixed(1)} kW`, 'est']] }
      : { id: 'shelves', title: 'Power shelves', kicker: '415 V AC → ≈50 V DC',
        body: `Each 1U shelf, such as LITEON’s power shelf for NVL72 racks, holds six hot-swap rectifiers in a 3+3 arrangement that turn AC into about 50 V DC.${A.id === 'gb300' ? ' GB300 shelves add capacitors that store 65 J per GPU to smooth training load swings.' : ''}`,
        specs: [['Shelf', '≈33 kW, 6 × 5.5 kW', 'typical'], ['Shelves per rack', '6 (up to 8)', 'typical'], ['Efficiency', '≈97.5% peak, half load', 'typical'], ...(A.id === 'gb300' ? [['GB300 smoothing', '−30% peak grid demand', 'spec']] : [])] },
    { id: 'busbar', title: 'DC busbar', kicker: `≈${n0(Math.round(RK.dcBusKW * 1000 / 50 / 100) * 100)} A down the back`,
      body: 'A vertical copper busbar runs the full height of the rack. Every tray has a clip on its back that grabs the bar when it slides in, so there are no power cables to trays.',
      specs: [['Voltage', '≈50 V DC (OCP ORv3)', 'spec'], ['Busbar rating', '1,400 A per section', 'spec'], ['Next: NVIDIA Kyber, 2027', '800 V DC, 45% less copper', 'spec']] },
    { id: 'compute', title: 'Compute trays', kicker: '18 trays, 4 GPUs each',
      body: `Each 1U tray holds two superchips: two ${X.cpu} CPUs and four ${X.gpus} under water-cooled cold plates.`,
      specs: [['Trays', '18', 'spec'], ['GPUs per tray', '4', 'spec'], ['CPUs per tray', '2', 'spec'], ['Tray power', `≈${trayKW.toFixed(1)} kW`, 'est']], drill: 4 },
    { id: 'nvswitch', title: 'NVLink switch trays', kicker: '9 trays in the middle',
      body: 'Switch trays in the middle of the rack connect all 72 GPUs as one NVLink domain, so any GPU can read any other’s memory at full speed.',
      specs: [['Trays', '9', 'spec'], ['Bandwidth per GPU', nvlTB, A.basis], ['Domain total', A.id === 'rubin' ? '≈260 TB/s, as announced' : '130 TB/s', A.id === 'rubin' ? 'est' : 'spec']] },
    { id: 'spine', title: 'NVLink spine', kicker: '≈5,000 copper cables',
      body: 'Cable cartridges down the back tie every tray to every switch in passive copper, with no retimers and no optical modules in the path. NVIDIA’s own DGX GB200 user guide calls this the "NVLink passive copper cable cartridge backplane." Its OCP-contribution developer blog once called the same cables "active copper cables" — loose usage, most likely meaning links that are actively carrying traffic, rather than a description of the electronics inside them.',
      specs: [['Links', 'more than 5,000 passive copper', 'spec'], ['Total length', '≈2 miles', 'typical'], ['Signaling', '224G PAM4', 'typical']] },
    { id: 'manifold', title: 'Coolant manifolds', kicker: 'Blue in, red out',
      body: 'Two vertical manifolds with dripless quick disconnects feed every tray. A tray comes out without a drop of water.',
      specs: [['Liquid-cooled parts', liq >= 0.99 ? 'everything, reportedly' : 'GPUs, CPUs, switch chips', liq >= 0.99 ? 'est' : 'typical']] },
  ] : [
    { id: 'feed', title: 'Rack feed', kicker: '415 V AC in',
      body: 'Two tap-off cables from the overhead busway feed the rack: A and B for redundancy.',
      specs: [['Feeds', 'A + B', 'typical']] },
    { id: 'pdu', title: 'Rack power strips', kicker: '415 V three-phase → 240 V outlets',
      body: 'Vertical power strips at the back split each three-phase feed into single-phase outlets. Line to neutral, 415 V three-phase is 240 V, which is what server power supplies take.',
      specs: [['Per strip', '≈17–22 kW class', 'typical'], ['Outlets', 'C19/C20', 'typical']] },
    { id: 'servers', title: 'DGX H100 servers', kicker: '4 per rack, 8U each',
      body: 'Each server holds eight H100 GPUs on one baseboard, two Xeon CPUs, and its own power supplies and fans.',
      specs: [['Per server', '≈10.2 kW max', 'spec'], ['GPUs per server', '8', 'spec'], ['Height', '8U, 356 mm', 'spec']], drill: 4 },
    { id: 'psus', title: 'Server power supplies', kicker: 'AC → 54 V, inside each server',
      body: 'Each server has six 3.3 kW supplies, four carrying the load and two spare. The conversion happens server by server instead of in shared rack shelves.',
      specs: [['Per server', '6 × 3.3 kW, 4+2', 'spec'], ['Efficiency', '≈96% (80 PLUS Titanium class)', 'typical'], ['Loss per rack', `≈${RK.convKW.toFixed(1)} kW`, 'est']] },
    { id: 'cabling', title: 'Power cords', kicker: 'No busbar',
      body: 'Twenty-four cords, six per server, run from the strips to the supplies. Air-cooled racks at 40 kW do not need a busbar.',
      specs: [['Cords per rack', '24', 'est']] },
    { id: 'mgmt', title: 'Management switch', kicker: 'Out-of-band',
      body: 'A small copper switch at the top runs the rack’s management network: firmware, sensors and power control, separate from the fabrics that move model data.',
      specs: [['Rate', '1–10 GbE class', 'est']] },
  ];
  PARTS.tray = nvl ? [
    { id: 'clip', title: 'Busbar clip', kicker: '≈50 V DC in',
      body: 'Spring copper fingers at the back of the tray grab the rack busbar. More than a hundred amps flows through this clip when the tray is working hard.',
      specs: [['Tray power', `≈${trayKW.toFixed(1)} kW`, 'est'], ['Current at 50 V', `≈${n0(trayKW * 20)} A`, 'est']] },
    { id: 'ibc', title: 'Bus converters', kicker: '50 V → 12 V',
      body: 'Fixed-ratio converter bricks cut the voltage by about four and hand 12 V to the board. They are very efficient because they do not regulate. Vendors do not publish figures for this board, so the loss here is an estimate.',
      specs: [['Efficiency', '≈97–98%', 'est'], ['Loss, campus-wide', lossTxt('Bus converters'), 'est']] },
    { id: 'vrm', title: 'Voltage regulators', kicker: '12 V → ≈0.8 V',
      body: 'Dozens of switching phases ring each GPU, each an inductor and a power stage switching at around a megahertz. They sit as close to the chip as they can, because every millimeter at a thousand amps costs power.',
      specs: [['Phases per GPU', '≈20–30', 'est'], ['Efficiency', `≈${Math.round(A.vrmEff * 100)}%`, 'est'], ['Loss, campus-wide', lossTxt('Voltage regulators'), 'est'], ['Core current', `≈${n0(coreA)} A`, 'est']] },
    { id: 'gpu', title: X.gpus, kicker: `4 per tray, ${n0(A.gpuW)} W each`,
      body: `Each GPU package is two large dies and ${stacksTxt} of HBM. It is where most of the power in the building finally goes.`,
      specs: [['Power', `≈${n0(A.gpuW)} W`, A.basis], ['Transistors', X.transistors, X.tBasis], ['Memory', hbmSpec, X.mBasis]], drill: 5 },
    { id: 'grace', title: `${X.cpu} CPUs`, kicker: '2 per tray',
      body: `Each Arm CPU feeds two GPUs over a ${X.c2c} coherent link and keeps its own LPDDR5X memory beside it.`,
      specs: [['Cores', X.cpuCores, A.id === 'rubin' ? 'est' : 'spec'], ['CPU–GPU link', `${X.c2c} NVLink-C2C`, A.id === 'rubin' ? 'est' : 'spec']] },
    { id: 'lpddr', title: 'LPDDR5X memory', kicker: 'CPU memory',
      body: `Low-power DRAM packages soldered around each ${X.cpu} CPU.`,
      specs: [['Capacity', X.cpuMem, A.id === 'rubin' ? 'est' : 'spec']] },
    { id: 'coldplates', title: 'Cold plates', kicker: 'Water on every hot chip',
      body: 'Copper plates with fine internal fins sit on each GPU and CPU. Coolant enters cool, picks up over a kilowatt per GPU, and leaves warm.',
      specs: [['Heat per GPU', `≈${(A.gpuW / 1000).toFixed(1)} kW`, A.basis]] },
    { id: 'nic', title: 'NICs, DPU and SSDs', kicker: 'The front of the tray',
      body: '${X.nic} cards carry scale-out traffic to the spine, a BlueField DPU handles storage and security, and E1.S drives hold local data.',
      specs: [['Scale-out', `${nicTxt} per GPU`, X.mBasis]] },
    { id: 'nvconn', title: 'NVLink connectors', kicker: 'To the spine',
      body: 'High-density connectors at the rear mate with the copper spine when the tray is pushed home.',
      specs: [['Per GPU', `${A.nvlink.gen}, ${nvlTB}`, A.basis]] },
  ] : [
    { id: 'psu', title: 'Power supplies', kicker: 'AC → 54 V DC',
      body: 'Six hot-swap supplies at the back of the server take 240 V AC and make 54 V DC for the GPU baseboard and the CPU tray.',
      specs: [['Supplies', '6 × 3.3 kW, 4+2', 'spec'], ['Server power', '≈10.2 kW max', 'spec']] },
    { id: 'ibc', title: 'Bus converters', kicker: '54 V → 12 V',
      body: 'Converter modules on the GPU baseboard step 54 V down to 12 V beside each GPU module. Vendors do not publish figures for this board, so the loss here is an estimate.',
      specs: [['Efficiency', '≈98%', 'est'], ['Loss, campus-wide', lossTxt('Bus converters'), 'est']] },
    { id: 'vrm', title: 'Voltage regulators', kicker: '12 V → ≈0.8 V',
      body: 'Switching phases around each GPU make the final step to under a volt.',
      specs: [['Efficiency', `≈${Math.round(A.vrmEff * 100)}%`, 'est'], ['Loss, campus-wide', lossTxt('Voltage regulators'), 'est'], ['Core current', `≈${n0(coreA)} A`, 'est']] },
    { id: 'gpu', title: 'H100 GPUs', kicker: '8 per server, 700 W each',
      body: 'Each SXM5 module is one large die with five working HBM3 stacks beside it, mounted face-down on the baseboard under a heat sink.',
      specs: [['Power', '700 W', 'spec'], ['Transistors', X.transistors, 'spec'], ['Memory', hbmSpec, 'spec']], drill: 5 },
    { id: 'cpu', title: 'Xeon CPUs', kicker: '2 per server',
      body: 'Two x86 CPUs on a separate tray run the operating system and feed the GPUs over PCIe. They do none of the model math.',
      specs: [['CPU', `${X.cpuLong}, ${X.cpuCores}`, 'spec'], ['Memory', X.cpuMem, 'spec']] },
    { id: 'heatsinks', title: 'Heat sinks', kicker: 'Air, not water',
      body: 'Tall finned heat sinks with vapor chambers sit on each GPU. The server is 8U tall mostly to make room for them and for the air they need.',
      specs: [['Heat per GPU', '700 W', 'spec']] },
    { id: 'nvswitch', title: 'NVSwitch chips', kicker: '4 on the baseboard',
      body: 'Four third-generation NVSwitch chips connect all eight GPUs, so any GPU reads any other’s memory at full speed.',
      specs: [['Per GPU', '18 NVLink 4 links, 900 GB/s', 'spec']] },
    { id: 'nic', title: 'ConnectX-7 NICs', kicker: 'One per GPU',
      body: 'Eight 400 Gb/s network cards carry scale-out traffic, grouped two to a twin-port optical cage at the back.',
      specs: [['Scale-out', '400 Gb/s per GPU', 'spec']] },
  ];
  PARTS.chip = [
    { id: 'balls', title: 'Solder balls & substrate', kicker: 'A thousand-plus amps comes up here',
      body: 'Thousands of solder balls carry power and signals from the board into a many-layer organic substrate. Most of the balls are power and ground: at 0.8 V it takes many parallel paths to carry a thousand amps.',
      specs: [['Core voltage', '≈0.7–0.9 V', 'typical'], ['Core current, P ÷ V', `≈${n0(coreA)} A over several rails`, 'est']] },
    { id: 'interposer', title: 'Interposer', kicker: X.packaging.replace('TSMC ', ''),
      body: 'A silicon layer wires the dies and memory together with lines far finer than any circuit board can carry.',
      specs: [['Packaging', X.packaging, X.pBasis]] },
    { id: 'dies', title: A.dies > 1 ? 'Two GPU dies' : 'One GPU die', kicker: `${X.transistors.replace(', as announced', '')} transistors`,
      body: A.dies > 1
        ? 'Two reticle-limit dies act as one GPU, joined by a 10 TB/s die-to-die link. Nearly every watt that reaches them becomes heat within a few nanoseconds of doing arithmetic.'
        : 'One reticle-limit die, about as large as a chip can be made in one exposure. Nearly every watt that reaches it becomes heat within a few nanoseconds of doing arithmetic.',
      specs: [['Transistors', X.transistors, X.tBasis], ...(A.dies > 1 ? [['Die-to-die link', '10 TB/s NV-HBI', 'spec']] : [['Die area', '814 mm²', 'spec']]), ['Process', X.process, X.pBasis]] },
    { id: 'hbm', title: `${A.hbm.type} stacks`, kicker: `${stacksTxt}, ${A.hbm.gb} GB`,
      body: `Each stack, from suppliers such as SK hynix, Micron and Samsung, is ${A.hbm.layers} DRAM dies thinned and stacked with through-silicon vias. Moving model weights out of HBM for every token is a large share of inference energy.`,
      specs: [['Capacity', `${A.hbm.gb} GB${A.id === 'gb200' ? ' (NVIDIA rack total implies ≈186 GB)' : ''}`, X.mBasis], ['Bandwidth', hbmTB, X.mBasis], ['Layers per stack', `${A.hbm.layers}`, A.id === 'rubin' ? 'est' : 'typical'], ['Share of GPU power', '≈8–15%', 'est']] },
    { id: 'tokens', title: 'Tokens', kicker: 'What leaves',
      body: 'Every token a model writes is a pass through billions of weights. Run the numbers below to see how many a kilowatt-hour buys.',
      specs: [['Google, median Gemini text prompt', '0.24 Wh, all-in', 'spec'], ['LLaMA-65B on A100, 2023', '≈3–4 J per token', 'spec'], ['GB200 vs H200', '≈8–10× tokens per MW', 'typical']] },
  ];

  // ---------- bill of materials. The 4th element is the part each row counts ----------
  const Lk = at;
  const BOM = [
    { group: 'Grid & campus', rows: [
      [`Main power transformers, ${L.mvaUnit} MVA`, n0(L.transformers), 'est', Lk(1, 'mpt')],
      ['34.5 kV feeders', `≈${n0(L.feeders)}`, 'est', Lk(1, 'ehouse')],
      ['Diesel generators, 3 MW', `≈${n0(L.gensets)}`, 'est', Lk(1, 'gensets')],
      ['Diesel on site, 48 h', `≈${L.fuelML >= 10 ? n0(L.fuelML) : L.fuelML.toFixed(1)} million L`, 'est', Lk(1, 'fuel')],
      ['Battery storage', `≈${n0(L.bessMW)} MW / ${n0(L.bessMWh)} MWh`, 'est', Lk(1, 'bess')],
      ...(warm ? [['Rooftop dry coolers', `≈${n0(L.dryCoolers)}`, 'est', Lk(1, 'drycoolers')]] : [['Chillers, 4 MW', `≈${n0(L.chillers)}`, 'est', Lk(1, 'chillers')]]),
      ['Cooling towers', `≈${n0(L.towers)}`, 'est', Lk(1, 'towers')],
    ] },
    { group: 'Buildings', rows: [
      ['Data halls', n0(halls), 'est', Lk(1, 'hall')],
      ['Unit substations, 2.5 MVA', `≈${n0(dc ? Math.ceil((M.coolMW + M.miscMW) / 2.2) : L.unitSubs)}`, 'est', Lk(2, 'unitsub')],
      dc ? ['Solid-state transformers, 2.5 MW', `≈${n0(L.sstModules)}`, 'est', Lk(2, 'sst')] : ['UPS modules, 1.25 MW', `≈${n0(L.upsModules)}`, 'est', Lk(2, 'ups')],
      air ? ['In-row cooling units', `≈${n0(L.airUnits)}`, 'est', Lk(2, 'inrow')] : ['Coolant distribution units', `≈${n0(L.cdus)}`, 'est', Lk(2, 'cdu')],
      ['Busway runs', `≈${n0(RACKS / 10)}`, 'est', Lk(2, 'busway')],
    ] },
    { group: 'Racks', rows: nvl ? [
      [`${A.rackName} racks`, `≈${n0(RACKS)}`, 'est', Lk(2, 'racks')],
      [dc ? 'DC-DC shelves' : 'Power shelves', `≈${n0(RACKS * 6)}`, 'est', Lk(3, 'shelves')],
      ...(dc ? [] : [['Rectifiers', `≈${n0(RACKS * 36)}`, 'est', Lk(3, 'shelves')]]),
      ['NVLink copper connections', `≈${kfmt(NET.nvlinkPairs)}`, 'est', Lk(3, 'spine')],
    ] : [
      ['DGX H100 racks', `≈${n0(RACKS)}`, 'est', Lk(2, 'racks')],
      ['DGX H100 servers', `≈${n0(RACKS * 4)}`, 'est', Lk(3, 'servers')],
      ['Server power supplies', `≈${n0(RACKS * 24)}`, 'est', Lk(4, 'psu')],
    ] },
    { group: 'Silicon', rows: [
      [X.gpus, `≈${n0(GPUS)}`, 'est', Lk(4, 'gpu')],
      [`${X.cpu} CPUs`, `≈${n0(M.cpus)}`, 'est', Lk(4, nvl ? 'grace' : 'cpu')],
      [`${A.hbm.type} stacks`, `≈${kfmt(GPUS * (A.id === 'h100' ? 5 : A.hbm.stacks))}`, 'est', Lk(5, 'hbm')],
      ['VRM phases', `≈${kfmt(GPUS * 24)}`, 'est', Lk(4, 'vrm')],
      ['Transistors in GPUs', `≈${(GPUS * parseFloat(X.transistors.replace('≈', '')) * 1e9 / 1e15).toFixed(1)} quadrillion`, 'est', Lk(5, 'dies')],
    ] },
    { group: 'Network', rows: [
      [nvl ? 'NVLink switch chips' : 'NVSwitch chips', `≈${n0(NET.nvswitchChips)}`, 'est', nvl ? Lk(3, 'nvswitch', 'data') : Lk(4, 'nvswitch', 'data')],
      [nvl ? 'SuperNICs' : 'ConnectX-7 NICs', `≈${n0(GPUS)}`, 'est', Lk(4, 'cx', 'data')],
      [`Leaf / spine / core switches, ${NET.fabric.radix}-port`, `≈${n0(NET.switches)}`, 'est', Lk(2, 'spine', 'data')],
      ['Optical modules', `≈${kfmt(NET.modules)}`, 'est', Lk(2, 'optics', 'data')],
      ['Fiber strands in the fabric', `≈${kfmt(NET.fibers)}`, 'est', Lk(2, 'runways', 'data')],
    ] },
  ];

  // ---------- data-mode parts per scene. Positions come from each scene's dataHotspots ----------
  const PARTS_DATA = {
    across: [
      { id: 'dci', title: 'Line terminals', kicker: 'Coherent DWDM',
        body: 'At each campus, coherent transponders put many wavelengths on a fiber pair, each 800 Gb/s to 1.6 Tb/s.',
        specs: [['Per wavelength, WaveLogic 6', 'up to 1.6 Tb/s', 'spec'], ['800G pluggable, e.g. Marvell COLORZ 800', '800 Gb/s to ≈500 km', 'spec'], ['Field trial', '1.6 Tb/s over 1,100 km (Telstra)', 'spec'], ['C+L band', 'about 2× capacity per fiber', 'spec']] },
      { id: 'ila', title: 'Amplifier huts', kicker: 'Every 60–100 km',
        body: 'Small buildings along the route boost the light without converting it back to electricity.',
        specs: [['Spacing', '≈80–100 km, rule of thumb', 'typical']] },
      { id: 'route', title: 'Fiber route', kicker: '≈5 milliseconds per 1,000 km',
        body: 'Light in glass covers about 200 km per millisecond. A 1,000 km route adds about 10 ms to every round trip, fine for inference and hard for tightly synchronized training.',
        specs: [['Speed in fiber', '≈4.9 µs per km', 'typical'], ['1,000 km round trip', '≈10 ms', 'est'], ['Microsoft hollow-core fiber', '≈33% lower latency; 1,280 km laid', 'spec'], ['Per fiber pair, C-band 800ZR', '32 × 800G = 25.6 Tb/s', 'spec']] },
      { id: 'remote', title: 'Other campuses', kicker: 'One model, several sites',
        body: 'Builders now train single models across campuses, splitting the work so the slow links carry the least traffic. Google trains its largest models across campuses and metros; Microsoft links Fairwater sites about 700 miles apart.',
        specs: [['Microsoft AI WAN fiber added', '120,000 miles', 'spec'], ['NVIDIA Spectrum-XGS', 'nearly 2× NCCL across sites', 'spec'], ['DeepMind Decoupled DiLoCo', '4 US regions over 2–5 Gb/s', 'spec']] },
      { id: 'home', title: site ? site.name : 'This campus', kicker: 'Go in', drill: 1,
        body: 'Go into the campus and follow the data in.',
        specs: [['GPUs', `≈${n0(GPUS)}`, 'est']] },
    ],
    campus: [
      { id: 'fiber', title: 'Fiber entrances', kicker: 'Two diverse routes',
        body: 'Long-haul fiber enters at vaults on opposite sides of the site, so one backhoe cannot cut the campus off. Questions arrive and tokens leave the same way.',
        specs: [['Routes', '2 or more, physically separate', 'typical']] },
      { id: 'dci', title: 'Line terminal hut', kicker: 'Coherent DWDM',
        body: 'Coherent optics put dozens of wavelengths on each fiber pair, each carrying hundreds of gigabits to over a terabit, bound for other campuses.',
        specs: [['Per wavelength, Ciena WaveLogic 6', 'up to 1.6 Tb/s', 'spec'], ['400ZR reach, amplified', '80–120 km', 'typical'], ['Module power, 400ZR / 800ZR', '≈15–20 W / ≈23–25 W', 'typical']] },
      ...(multiHall ? [
        { id: 'interhall', title: 'Hall-to-hall fiber', kicker: `One fabric, ${halls} buildings`,
          body: 'Thousands of strands in the duct banks join the spines of every hall, so a single training job can span every GPU on the campus.',
          specs: [['Strands', 'tens of thousands per hall pair', 'est']] },
        { id: 'ductbank', title: 'Duct bank', kicker: 'Fiber between the halls, cut away',
          body: `Between buildings, fiber runs in 4-inch conduits cast in concrete, one high-count ribbon cable per conduit, with a spare row. In this layout half the spine-to-core links cross between halls: about ${kfmt(NET.crossHallFibers)} strands, or roughly ${n0(Math.ceil(NET.crossHallFibers / 6912))} cables of 6,912 fibers each.`,
          specs: [['Strands crossing', `≈${kfmt(NET.crossHallFibers)}`, 'est'], ['Cable', '6,912-fiber ribbon fits a 2-inch duct', 'spec'], ['Duct-bank layout', 'general telecom practice', 'est']] },
      ] : []),
      { id: 'hall', title: 'Data halls', kicker: 'Scale-out fabric inside', drill: 2,
        body: 'Inside, every GPU has its own optical port into a leaf-and-spine fabric.',
        specs: [['GPUs', `≈${n0(GPUS)}`, 'est']] },
      { id: 'longhaul', title: 'Long-haul route', kicker: 'Scale across', drill: 0,
        body: 'The fiber leaving the site runs to other campuses hundreds of kilometers away.',
        specs: [['Light in fiber', '≈5 µs per km', 'typical']] },
    ],
    hall: [
      { id: 'odf', title: 'Fiber distribution frames', kicker: 'Where every link is patched',
        body: 'Fabric links do not run switch to switch in one piece. Trunk cables land on patch frames, and short jumpers make the actual connections, so a link can be moved without pulling cable through the ceiling.',
        specs: [['Fabric strands, whole campus', `≈${kfmt(NET.fibers)}`, 'est'], ['Housing density, Corning EDGE8', '144 fibers per 1U, 576 per 4U', 'spec'], ['4U housings for this campus', `≈${n0(NET.fibers / 576)}`, 'est']] },
      ...(multiHall ? [{ id: 'crosshall', title: 'To the other halls', kicker: 'Through the floor', drill: 1,
        body: 'Cables for the links that cross buildings drop through a floor sleeve into the duct bank outside.',
        specs: [['Strands', `≈${kfmt(NET.crossHallFibers)}`, 'est']] }] : []),
      { id: 'pp', title: 'Pipeline stages', kicker: `One replica, four racks`,
        body: `The tinted rack tops show one way to lay a model out: its layers split into four stages, one rack each, passing activations down the line like an assembly line. 4 racks × ${A.gpusPerRack} GPUs = one copy of the model.`,
        specs: [['Traffic', 'point to point, per micro-batch', 'spec'], ['Llama 3 405B', 'pipeline parallel 16', 'spec'], ['Layout drawn here', 'illustrative', 'est']] },
      { id: 'dp', title: 'Data-parallel replicas', kicker: 'Many copies, one model',
        body: 'Every group of four racks holds another full copy. Each copy trains on different data, and all of them average their gradients across the fabric once per step.',
        specs: [['Traffic', 'large all-reduce, once per step', 'spec'], ['Llama 3 405B', 'TP 8 × CP 16 × PP 16 × DP 8 = 16,384 GPUs', 'spec'], ['DeepSeek-V3', 'no tensor parallel; EP 64, PP 16, ZeRO-1 DP', 'spec']] },
      { id: 'uplinks', title: 'Rack uplinks', kicker: 'Where scale-out starts',
        body: `Each rack sends one optical link per GPU up into the fiber runway overhead: ${A.gpusPerRack} ports per rack before the first switch, ${nicShort} each.`,
        specs: [['Per GPU', nicTxt, X.mBasis], ['Ports per rack', `${A.gpusPerRack}`, 'typical']] },
      { id: 'leaf', title: 'Leaf switches', kicker: 'Rail-optimized',
        body: `Network racks at the row ends hold leaf switches, ${A.nicGbps === 400 ? 'such as NVIDIA’s Quantum-2 QM9700 (InfiniBand)' : A.nicGbps === 800 ? 'such as NVIDIA’s Quantum-X800 Q3400 (InfiniBand) or Spectrum-X SN5600 (Ethernet)' : 'from NVIDIA’s Spectrum-6 generation, announced with Rubin'}. In a rail-optimized layout, GPU number n in every rack plugs into the same leaf, so most traffic crosses only one switch.`,
        specs: [['Leaf switches, campus', `≈${n0(NET.leaf)}`, 'est'], ['Hops, same rail', '1', 'typical'], ['Switch hop, InfiniBand', 'under ≈100 ns; NVIDIA publishes none', 'typical']] },
      { id: 'spine', title: 'Spine switches', kicker: 'Any GPU to any GPU',
        body: `The spine connects every leaf to every other. Two tiers of ${NET.fabric.radix}-port switches reach about ${kfmt(NET.fabric.radix ** 2 / 2)} GPUs; this campus uses ${NET.tiers}${NET.planes > 1 ? `, in ${NET.planes} parallel planes` : ''}.`,
        specs: [['Switch', NET.fabric.switchName, A.nicGbps === 1600 ? 'est' : 'spec'], ['Merchant switch chips, same role', 'Broadcom Tomahawk 6 (102.4 Tb/s), Marvell Teralynx 10 (51.2 Tb/s)', 'spec'], ['Spine + core switches', `≈${n0(NET.spine + NET.core)}`, 'est']] },
      { id: 'runways', title: 'Fiber runways', kicker: 'Yellow means fiber',
        body: 'Overhead yellow trays carry thousands of single-mode strands. A parallel module lights eight lanes through two multi-fiber connectors, so strand counts climb fast.',
        specs: [['Fibers per link', `${NET.fabric.fibersPerLink}`, 'typical']] },
      { id: 'optics', title: 'Optical modules', kicker: 'Several per GPU',
        body: `Every link is lit at both ends by a pluggable module, from merchant suppliers such as InnoLight and Coherent as well as NVIDIA’s own LinkX line. Here they fill the faces of the leaf switches at the row ends and of the spine switches, with a link light on each and fiber rising to the runway. One per GPU leaves the rack, and every tier above adds more: about ${(NET.modules / GPUS).toFixed(1)} per GPU, ${NET.opticsMW.toFixed(1)} MW for this campus.`,
        specs: [['NVIDIA 800G DR8, 500 m', '17 W max', 'spec'], ['1.6T modules, e.g. InnoLight or Coherent 1.6T-DR8', '≈25–30 W, still ramping', 'est'], ['The DSP inside each module', 'e.g. Marvell Ara, Broadcom Sian, Credo Bluebird', 'spec'], ['Linear-drive (LPO)', 'roughly half the power', 'typical']] },
      { id: 'cpo', title: 'Co-packaged optics', kicker: 'Light inside the switch',
        body: 'New switches put the optical engines on the switch package itself, cutting out the pluggable modules and much of their power. One spine switch here is drawn that way: liquid-cooled, with fiber landing straight on the chassis beside a few external laser modules. Every other switch in the hall still takes pluggables, as most fabrics do today.',
        specs: [['NVIDIA Quantum-X / Spectrum-X Photonics', '3.5× power efficiency, 4× fewer lasers', 'spec'], ['Broadcom Davisson', '102.4 Tb/s, 3.5 W per 800G port', 'spec']] },
      { id: 'racks', title: nvl ? 'NVL72 racks' : 'DGX H100 racks', kicker: 'Scale-up stays inside', drill: 3,
        body: nvl
          ? `Inside each rack, 72 GPUs talk over copper NVLink, ${Math.round(A.nvlink.tbs * 8000 / A.nicGbps)} times faster than the fabric outside.`
          : 'Inside each server, 8 GPUs talk over NVLink, 18 times faster than the fabric outside. Between servers, even in the same rack, it is all fabric.',
        specs: [['NVLink per GPU', nvlTB, A.basis], ['Domain', `${A.nvlink.domain} GPUs`, 'spec']] },
    ],
    rack: nvl ? [
      { id: 'tp', title: 'Tensor + expert parallel', kicker: 'The chattiest work lives here',
        body: 'Inside one rack a model layer’s math is split across GPUs, or its experts are spread over all 72. The GPUs trade partial results inside every layer, which only NVLink is fast enough for.',
        specs: [['Traffic', 'every layer, many times per token', 'spec'], ['Llama 3 405B, H100', 'tensor parallel 8, inside each server', 'spec'], ['NVL72 wide expert parallel', 'experts across all 72 GPUs', 'spec']] },
      { id: 'nvswitch', title: 'NVLink switch trays', kicker: 'Scale-up: one domain',
        body: 'Nine switch trays in the middle connect all 72 GPUs, so any GPU can read another’s memory as fast as its own link allows.',
        specs: [['Trays', '9, 2 switch chips each (18)', 'spec'], ['Per GPU', `${A.nvlink.gen}, ${nvlTB}`, A.basis]] },
      { id: 'spine', title: 'NVLink spine', kicker: 'Copper, not light',
        body: 'Cable cartridges down the back carry more than 5,000 copper links. At 224G, passive copper reaches about a meter, just enough for one rack, and it needs no optical modules or retimers.',
        specs: [['Links', 'more than 5,000', 'spec'], ['Power saved vs optics, NVIDIA', '≈20 kW per rack', 'spec'], ['Passive copper reach at 224G', '≈1 m', 'typical']] },
      { id: 'optical', title: 'The optical alternative', kicker: 'Google TPU pods',
        body: 'Google scales up with light instead: TPU pods of about 9,000 chips wired through mirror-based optical circuit switches that can rewire the pod in milliseconds.',
        specs: [['Ironwood pod', '9,216 chips', 'spec'], ['ICI per chip', '1.2 TB/s', 'spec'], ['Optical circuit switch', '136 ports, ≈108 W', 'typical']] },
      { id: 'uplinks', title: 'Scale-out ports', kicker: 'The only data that leaves',
        body: 'One optical port per GPU leaves the front of each compute tray and climbs to the fiber runway overhead.',
        specs: [['Ports', '72', 'typical'], ['Rate', nicTxt, X.mBasis]] },
      { id: 'compute', title: 'Compute trays', kicker: '4 GPUs each', drill: 4,
        body: 'Each tray is where the three networks meet: NVLink at the back, optics at the front, and the CPU link in between.',
        specs: [['GPUs', '4', 'spec']] },
      { id: 'mgmt', title: 'Management switch', kicker: 'Out-of-band',
        body: 'A small copper switch at the top runs the rack’s management network: firmware, sensors and power control, separate from the fabrics that move model data.',
        specs: [['Rate', '1–10 GbE class', 'est']] },
    ] : [
      { id: 'tp', title: 'Tensor parallel', kicker: 'Inside one server',
        body: 'The chattiest work, splitting each layer’s math, has to fit inside one 8-GPU server. That is why Llama 3 405B ran tensor parallel 8 on H100: eight was the whole NVLink domain.',
        specs: [['Llama 3 405B, H100', 'tensor parallel 8, inside each server', 'spec'], ['NVLink domain', '8 GPUs', 'spec']] },
      { id: 'servers', title: 'DGX H100 servers', kicker: '4 NVLink islands per rack', drill: 4,
        body: 'Four servers, four separate NVLink domains. GPUs in different servers of the same rack talk through the leaf switch, like any other rack.',
        specs: [['NVLink per GPU', '900 GB/s', 'spec']] },
      { id: 'uplinks', title: 'Scale-out ports', kicker: '32 per rack',
        body: 'Each server has four twin-port optical cages at the back, two 400 Gb/s links in each, one per GPU.',
        specs: [['Per GPU', '400 Gb/s', 'spec'], ['Ports per rack', '32', 'spec']] },
      { id: 'optical', title: 'The optical alternative', kicker: 'Google TPU pods',
        body: 'Google scales up with light instead: TPU pods of about 9,000 chips wired through mirror-based optical circuit switches that can rewire the pod in milliseconds.',
        specs: [['Ironwood pod', '9,216 chips', 'spec'], ['ICI per chip', '1.2 TB/s', 'spec']] },
      { id: 'mgmt', title: 'Management switch', kicker: 'Out-of-band',
        body: 'A small copper switch at the top runs the rack’s management network, separate from the fabrics that move model data.',
        specs: [['Rate', '1–10 GbE class', 'est']] },
    ],
    tray: nvl ? [
      { id: 'nvconn', title: 'NVLink connectors', kicker: `${A.nvlink.gen}`,
        body: 'Each GPU’s NVLink links leave the back of the tray and mate with the copper spine when the tray is pushed home.',
        specs: [['Per GPU', nvlTB, A.basis]] },
      { id: 'c2c', title: 'NVLink-C2C', kicker: 'CPU to GPU',
        body: `Each ${X.cpu} CPU talks to its GPUs over a coherent chip-to-chip link, so the GPUs can use CPU memory as a slower extension of their own.`,
        specs: [['Bandwidth', X.c2c, A.id === 'rubin' ? 'est' : 'spec']] },
      { id: 'cx', title: 'SuperNICs', kicker: 'One per GPU',
        body: 'Each GPU has its own network card for scale-out traffic, so GPUs talk to other racks without going through the CPU.',
        specs: [['NIC', X.nic, X.mBasis], ['Per GPU', X.nicNote, X.mBasis]] },
      { id: 'osfp', title: 'Optical modules', kicker: 'Electrons become light',
        body: 'Pluggable modules at the front turn the NIC’s electrical signal into light on single-mode fiber.',
        specs: [['NVIDIA 800G DR8', '17 W max', 'spec'], ['400G module', '8–9 W', 'spec']] },
      { id: 'dpu', title: 'BlueField DPU', kicker: 'Front-end network',
        body: 'A separate network carries user requests, storage and management. The DPU runs it without taking CPU time.',
        specs: [A.id === 'rubin' ? ['BlueField-4', 'up to 800 Gb/s', 'est'] : ['BlueField-3', 'up to 400 Gb/s', 'spec'], ['Role', 'storage, security, tenant networking', 'typical']] },
      { id: 'gpu', title: X.gpus, kicker: 'Where the links begin', drill: 5,
        body: 'Every one of these links starts at the edge of the GPU dies.',
        specs: [['Links per GPU', 'NVLink, C2C, PCIe to the NIC', 'spec']] },
    ] : [
      { id: 'nvswitch', title: 'NVSwitch chips', kicker: 'Scale-up, on the board',
        body: 'NVLink runs in the baseboard’s copper traces from each GPU to four NVSwitch chips. No cables: the whole domain fits on one board.',
        specs: [['Per GPU', '18 links, 900 GB/s', 'spec'], ['Switch chips', '4', 'spec']] },
      { id: 'pcie', title: 'PCIe switches', kicker: 'GPU to CPU and NIC',
        body: 'PCIe Gen5 switches connect each GPU to its NIC and to the CPUs. Data to other servers goes GPU → PCIe → NIC without passing through CPU memory.',
        specs: [['Generation', 'PCIe Gen5, ≈64 GB/s per x16 direction', 'spec']] },
      { id: 'cx', title: 'ConnectX-7 NICs', kicker: 'One per GPU',
        body: 'Eight single-port 400 Gb/s NICs, one for each GPU, carry scale-out traffic.',
        specs: [['Per GPU', '400 Gb/s', 'spec']] },
      { id: 'osfp', title: 'Twin-port optical cages', kicker: 'Electrons become light',
        body: 'Four cages at the back each hold one 800G twin-port module carrying two 400G links.',
        specs: [['Cages', '4, 2 × 400G each', 'spec']] },
      { id: 'dpu', title: 'BlueField-3 DPUs', kicker: 'Front-end network',
        body: 'Two DPUs run storage and the front-end network, separate from the GPU fabric.',
        specs: [['Count', '2 per server', 'spec']] },
      { id: 'gpu', title: 'H100 GPUs', kicker: 'Where the links begin', drill: 5,
        body: 'Every one of these links starts at the edge of the GPU die.',
        specs: [['Links per GPU', 'NVLink, PCIe to the NIC', 'spec']] },
    ],
    chip: [
      { id: 'hbm', title: A.hbm.type, kicker: `${hbmTB}, millimeters away`,
        body: 'The fastest link in the building is the shortest: thousands of wires through the interposer between each HBM stack and the dies.',
        specs: [['Bandwidth', hbmTB, X.mBasis]] },
      ...(A.dies > 1 ? [{ id: 'hbi', title: 'NV-HBI', kicker: '10 TB/s die to die',
        body: 'The two dies join across their seam fast enough that software sees one GPU.',
        specs: [['Bandwidth', '10 TB/s', 'spec']] }] : []),
      { id: 'nvphy', title: 'NVLink SerDes', kicker: `${A.nvlink.gen} leaves here`,
        body: `Serializer circuits along the die edge push NVLink out through the package, ${nvlTB} per GPU.`,
        specs: [['Per GPU', nvlTB, A.basis]] },
      { id: 'cpo', title: 'Light on the package', kicker: 'What comes next',
        body: 'Today the GPU speaks copper and a module turns it into light. Switches already carry optical engines on the package; bringing them to the GPU would let scale-up reach beyond one rack.',
        specs: [[A.short, 'electrical I/O only', A.id === 'rubin' ? 'est' : 'spec']] },
      { id: 'tokens', title: 'Tokens', kicker: 'What leaves',
        body: 'After all those links, the output is small: a few bytes per token, sent back out the front-end network to whoever asked.',
        specs: [['Per token of text', 'a few bytes', 'est']] },
    ],
  };

  // ---------- heat-mode parts per scene. Positions come from each scene's heatHotspots ----------
  const PARTS_HEAT = {
    across: [
      { id: 'climate', title: 'Climate picks sites', kicker: 'Heat stays local',
        body: 'Power travels, heat does not. Builders favor places where outside air is cool enough to reject heat most of the year, and where water is not scarce.',
        specs: [['Free cooling', 'most hours in cool climates', 'typical']] },
      { id: 'home', title: site ? site.name : 'This campus', kicker: 'Go in', drill: 1,
        body: 'Go into the campus and follow the heat out.',
        specs: [['Heat out', meter, 'est']] },
    ],
    campus: [
      warm
        ? { id: 'drycoolers', title: 'Dry coolers', kicker: 'Heat into air, no water',
          body: 'Warm facility water runs through finned coils on the roofs while big fans pull outside air across them. With water at 30–45 °C, outside air can take the heat most of the year without chillers.',
          specs: [['Heat rejected', `≈${mwTxt(IT_MW * 1.05)}`, 'est'], ['NVIDIA warm-water spec', '45 °C in, ≈55 °C out', 'typical'], ['Water classes', 'ASHRAE W32–W45', 'spec']] }
        : { id: 'chillers', title: 'Chiller plant', kicker: 'Pumping heat uphill',
          body: 'Chillers move heat from cold water into warmer tower water, and spend electricity to do it: every megawatt they move adds roughly a sixth more to reject.',
          specs: [['Cooling power', mwTxt(M.coolMW), 'est'], ['Chillers', `≈${n0(L.chillers)}`, 'est']] },
      { id: 'towers', title: 'Cooling towers', kicker: warm ? 'Hot days cost water' : 'Where the water goes',
        body: warm
          ? 'Evaporating water carries heat away far better than air, so towers trim the loop on the hottest afternoons. Every kilowatt-hour moved this way costs water.'
          : 'Evaporation carries the heat away all year. Each kilogram of water evaporated takes about 2.4 MJ with it, which adds up to rivers of water at this scale.',
        specs: [['On site, this design', `≈${M.wue.toFixed(2)} L/kWh`, 'typical'], ['Water per day', `≈${kfmt(M.meterMW * 24 * M.wue)} m³`, 'est'], ['At the power plant, typical thermal', '≈1.8 L/kWh (NREL)', 'spec']] },
      { id: 'plume', title: `Where ${meter} goes`, kicker: 'All of it, as heat',
        body: `Every watt that came in on the 345 kV line leaves as warm air${warm ? '' : ' and water vapor'} above the roofs. The campus is, physically, a ${meter} heater that happens to make tokens on the way.`,
        specs: [['Heat out', meter, 'est']] },
      { id: 'reuse', title: 'Heat reuse', kicker: 'Warm water is still worth something',
        body: 'In cold climates the return water can feed a district heating network, with heat pumps lifting it to 70–75 °C. This campus exports none; these do.',
        specs: [['Meta Odense, Denmark', '≈165,000 MWh a year, ≈11,000 homes', 'typical'], ['Microsoft + Fortum, Finland', 'up to 180 MW of district heat', 'spec'], ['Stockholm Data Parks', '30+ data centers selling heat', 'spec']] },
    ],
    hall: [
      air
        ? { id: 'inrow', title: 'In-row cooling units', kicker: 'Hot air in, cold air out',
          body: 'Fans pull hot-aisle air through chilled-water coils and push it out cold at the rack fronts. The water carries the heat to the chiller plant.',
          specs: [['Supply air', '≈18–27 °C (ASHRAE)', 'spec'], ['Units here', `≈${n0(L.airUnits)}`, 'est']] }
        : { id: 'cdu', title: 'Coolant distribution unit', kicker: 'Where the two loops meet',
          body: 'A plate heat exchanger, in units such as Vertiv’s CoolChip or Motivair’s CDU line, passes heat from the rack loop into facility water without mixing them. The rack side stays above the dew point so nothing condenses.',
          specs: [['Capacity range', '70 kW – 2.5 MW', 'spec'], ['Approach, facility to rack loop', 'a few °C', 'est']] },
      { id: 'fwater', title: air ? 'Chilled water loop' : 'Facility water loop', kicker: 'Supply blue, return red',
        body: `Insulated headers carry warm return water ${warm ? 'up to the roof' : 'to the chiller plant'} and cooler supply water back. The temperature difference sets how much water has to move.`,
        specs: [['Rise', '≈10 °C', 'est']] },
      { id: 'hotaisle', title: 'Hot aisle', kicker: air ? 'All the heat, as air' : 'The air-side heat',
        body: 'Rack backs face each other across a sealed aisle, so hot air rises and flows to the coolers instead of warming the room.',
        specs: [['Air share of rack heat', `≈${Math.round((1 - liq) * 100)}%`, 'est']] },
      { id: 'fanwall', title: 'Fan wall', kicker: 'Air back to cool',
        body: 'Fans pull hot-aisle air through water coils and blow it back into the room cool, closing the air loop.',
        specs: [['Moves', air ? 'room loads and overflow' : `the ≈${Math.round((1 - liq) * 100)}% air share`, 'est']] },
      { id: 'riser', title: warm ? 'Risers to the roof' : 'Risers to the plant', kicker: 'Heat leaves the building',
        body: `The headers turn up and out to the ${warm ? 'dry coolers' : 'chillers'}.`,
        specs: [['Carries', 'nearly all of the hall’s heat', 'est']], drill: 1 },
    ],
    rack: nvl ? [
      { id: 'manifold', title: 'Coolant manifolds', kicker: 'Cool in, warm out',
        body: 'Supply comes up one side, fans out to every tray through dripless quick disconnects, and returns warmer down the other.',
        specs: [['To liquid, this model', `≈${liqKW} kW`, 'est'], ['Rise across the rack', '≈10 °C (45 → 55 °C)', 'typical'], ['Flow rate', 'sources disagree ≈5×', 'est']] },
      ...(liq < 0.99 ? [{ id: 'rearair', title: 'Rear exhaust', kicker: `The last ${Math.round((1 - liq) * 100)}%`,
        body: 'Power shelves, switch trays, optics and drives still shed heat into air, which leaves the back of the rack into the hot aisle.',
        specs: [['To air, this model', `≈${airKW} kW`, 'est']] }] : []),
      { id: 'compute', title: 'Compute trays', kicker: 'Where the heat starts', drill: 4,
        body: 'Each tray carries its heat into its cold plates.',
        specs: [['Per tray', `≈${trayKW.toFixed(1)} kW`, 'est']] },
    ] : [
      { id: 'front', title: 'Cold aisle', kicker: 'Air in',
        body: 'Cool air from the in-row units reaches the rack fronts and is pulled in by each server’s fans.',
        specs: [['Inlet', '≈18–27 °C (ASHRAE)', 'spec']] },
      { id: 'rearair', title: 'Rear exhaust', kicker: 'All of it',
        body: `Every watt leaves the back as hot air, ${rackKW} kW per rack, into the sealed hot aisle.`,
        specs: [['Heat to air', `${rackKW} kW`, 'est'], ['Rise, front to back', '≈15–20 °C', 'typical']] },
      { id: 'servers', title: 'DGX H100 servers', kicker: 'Where the heat starts', drill: 4,
        body: 'Each server carries about ten kilowatts of heat into its airstream.',
        specs: [['Per server', '≈10.2 kW max', 'spec']] },
    ],
    tray: nvl ? [
      { id: 'coldplates', title: 'Cold plates', kicker: 'Water on every hot chip',
        body: 'Copper plates with fine internal fins sit on each GPU and CPU, lifted here to show the chips. Coolant runs through them in series and leaves a few degrees warmer each time.',
        specs: [['Heat per GPU', `≈${(A.gpuW / 1000).toFixed(1)} kW`, A.basis]] },
      { id: 'gpuheat', title: 'The heat source', kicker: `Four GPUs, two CPUs`, drill: 5,
        body: 'Almost all of the tray’s power ends up here, in a few square centimeters of silicon under each plate.',
        specs: [['Tray heat', `≈${trayKW.toFixed(1)} kW`, 'est']] },
      { id: 'fans', title: 'Fans', kicker: 'For what water misses',
        body: liq >= 0.99 ? 'Reports say this tray has no fans at all; they are drawn here for comparison.' : 'Small fans push air past the NICs, optical modules and drives, which have no cold plates.',
        specs: [['Air-cooled parts', liq >= 0.99 ? 'none, reportedly' : 'NICs, SSDs, M.2 boards', liq >= 0.99 ? 'est' : 'typical']] },
      { id: 'qd', title: 'Quick disconnects', kicker: 'Dripless',
        body: 'Couplings at the back seal as the tray is pulled, so a tray comes out dry.',
        specs: [['Per tray', 'one supply, one return per board', 'est']] },
    ] : [
      { id: 'heatsinks', title: 'Heat sinks', kicker: 'Fins and vapor chambers',
        body: 'Each GPU’s heat spreads through a vapor chamber into a tall stack of fins. Air carries it away; nothing here is water.',
        specs: [['Heat per GPU', '700 W', 'spec']] },
      { id: 'gpuheat', title: 'The heat source', kicker: 'Eight GPUs', drill: 5,
        body: 'Most of the server’s ten kilowatts is made here, under the heat sinks.',
        specs: [['GPUs', '8 × 700 W', 'spec']] },
      { id: 'fans', title: 'Fans', kicker: 'Front to back',
        body: 'A wall of fans at the front pulls air through the whole server. At full load they are a noticeable share of its power.',
        specs: [['Fans', '12', 'est'], ['Airflow at a 15 °C rise', '≈1,200 CFM per server', 'est']] },
    ],
    chip: [
      { id: 'junction', title: A.dies > 1 ? 'The dies' : 'The die', kicker: 'Hottest point in the building',
        body: 'Transistors switching billions of times a second turn nearly every watt into heat right at the surface of the silicon.',
        specs: [['Package power', `≈${n0(A.gpuW)} W`, A.basis], ['Throttle point', 'near ≈85 °C; NVIDIA publishes none', 'est']] },
      { id: 'flux', title: 'Heat flux', kicker: 'Like a stovetop, but denser',
        body: `About ${n0(A.gpuW * (1 - A.hbmShare))} W through ${A.dies > 1 ? 'two reticle-size dies' : 'one reticle-size die'} averages about ${flux} watts per square centimeter, several times a stove burner. Hot spots on the die run far higher, and those set the ${nvl ? 'cold plate' : 'heat sink'} design.`,
        specs: [[A.dies > 1 ? 'Die area, two dies' : 'Die area', `≈${X.dieCm2} cm²`, A.id === 'h100' ? 'spec' : 'typical'], ['Average flux', `≈${flux} W/cm²`, 'est'], ['Hot spots, cooling trade press', '500+ W/cm²', 'typical']] },
      { id: 'tim', title: 'Thermal interface and lid', kicker: 'The first hop out',
        body: `A thin thermal interface material carries heat from the ${A.dies > 1 ? 'dies' : 'die'} into the lid, and a second one into the ${nvl ? 'cold plate' : 'heat sink'}. Each layer costs a few degrees.`,
        specs: [['Layers to coolant', `die, interface, lid, interface, ${nvl ? 'plate' : 'heat sink'}`, 'typical']] },
      { id: 'hbm', title: 'HBM stacks', kicker: 'Heat in layers',
        body: `Stacked DRAM traps heat between its ${A.hbm.layers} layers, and DRAM leaks more as it warms, so memory often sets the temperature limit before the GPU does.`,
        specs: [['Share of package power', '≈8–15%', 'est'], ['HBM3e limit, Micron', '105 °C', 'spec']] },
    ],
  };

  // Temperature at each hop, hottest first. Values are representative, not a vendor spec.
  const outside = at(1, warm ? 'drycoolers' : 'chillers', 'heat');
  const TEMPS = warm ? [
    { label: 'GPU die', c: 70, note: 'throttles near ≈85 °C; not published', basis: 'est', link: at(5, 'junction', 'heat') },
    { label: 'Coolant leaving the rack', c: 55, note: '≈10 °C rise across the rack', basis: 'typical', link: at(3, 'manifold', 'heat') },
    { label: 'Facility water to the roof', c: 52, note: 'a few degrees lost in the CDU', basis: 'est', link: at(2, 'fwater', 'heat') },
    { label: 'Coolant entering the rack', c: 45, note: 'NVIDIA warm-water spec', basis: 'typical', link: at(2, 'cdu', 'heat') },
    { label: 'Outdoor air, hot day', c: 35, note: 'still cold enough for dry coolers', basis: 'est', link: outside },
  ] : air ? [
    { label: 'GPU die', c: 80, note: 'air runs the silicon hotter', basis: 'est', link: at(5, 'junction', 'heat') },
    { label: 'Hot aisle', c: 40, note: '≈15–20 °C rise through the servers', basis: 'typical', link: at(2, 'hotaisle', 'heat') },
    { label: 'Outdoor air, hot day', c: 35, note: 'too warm to cool 12 °C water without chillers', basis: 'est', link: outside },
    { label: 'Cold aisle', c: 22, note: 'ASHRAE 18–27 °C', basis: 'spec', link: at(3, 'front', 'heat') },
    { label: 'Chilled water supply', c: 12, note: 'made by chillers, all year', basis: 'typical', link: at(2, 'fwater', 'heat') },
  ] : [
    { label: 'GPU die', c: 65, note: 'throttles near ≈85 °C; not published', basis: 'est', link: at(5, 'junction', 'heat') },
    { label: 'Coolant leaving the rack', c: 40, note: '≈10 °C rise across the rack', basis: 'typical', link: at(3, 'manifold', 'heat') },
    { label: 'Outdoor air, hot day', c: 35, note: 'too warm for the loop without chillers', basis: 'est', link: outside },
    { label: 'Coolant entering the rack', c: 30, note: 'a few degrees above chilled water', basis: 'est', link: at(2, 'cdu', 'heat') },
    { label: 'Chilled water supply', c: 25, note: 'made by chillers', basis: 'est', link: at(2, 'fwater', 'heat') },
  ];

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

  // The numbered parts at a level (pins, the list, "Play 1 to N") read as one walk: the way the thing flows, without
  // the camera crossing the scene and back. Levels not listed already read that way as written. Reviewed 09/27/2026.
  for (const [P, walk] of [[PARTS, WALK.power], [PARTS_DATA, WALK.data], [PARTS_HEAT, WALK.heat]])
    for (const [sc, ids] of Object.entries(walk)) if (P[sc]) P[sc] = [...P[sc]].sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));

  return {
    SCENES, PARTS, PARTS_DATA, PARTS_HEAT, BOM, TEMPS, PARALLEL, LEDGER_END,
    LEDGER: M.ledger, LEDGER_MARKS: M.marks, STAIRCASE: M.staircase, BANDWIDTH: M.bandwidth,
  };
}
