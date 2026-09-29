// Guided journeys: one thing followed end to end, with a running tally beside the 3D view.
//   story    the overview: all six levels once, grid to token, stopping at each level's highlights in every layer
//   watt     one watt from the meter to the GPU dies; the tally is what is left
//   request  one question from a phone to an answer; the tally is elapsed time
//   heat     one GPU's heat from the die to the sky; the tally is where the heat is and how warm
// Every tour moves through the levels one way, one level at a time: it never skips a level and never goes back to
// one it has left (journeys.test.ts holds them to it), so the camera never jumps out and back in. The one exception
// is a side trip into the level inside the optics: a tour dives in at the part that holds it and comes back out to
// the level it left before going on. Side-trip beats carry `parent`, the level they return to.
// Beats: { link, k, title, text, tally, sim, specs, specKey, figure }. A sim runs that clock while the beat is on.
// specs are the figures a beat states, each with its basis and evidence the way a card row carries them, and a card's
// own row wherever the card already backs the figure, so entering a tour never strips a number of its qualification.
// specKey names them as claims (claims.js): row j of a narrated tour's beat i is `tour:<id>:<i>:<j>`.
import { tokenFigures, calc } from '../model/tokens.js';
import { waterM3h } from '../model/engine.ts';
import { content, dieFlux, FACTS } from '../data.js';
import { SITES } from '../model/sites.ts';

const at = (scene, part, mode = 'power') => ({ scene, mode, part });
const w3 = v => v.toFixed(3);
const mw = v => v >= 1000 ? `${+(v / 1000).toFixed(2)} GW` : v >= 10 ? `${Math.round(v).toLocaleString('en-US')} MW` : `${v.toFixed(1)} MW`;

const n0 = v => Math.round(v).toLocaleString('en-US');
const big = v => v >= 1e9 ? `${+(v / 1e9).toFixed(1)} billion` : v >= 1e6 ? `${+(v / 1e6).toFixed(1)} million` : n0(v);
const pct = (a, b) => `${Math.round(a / b * 100)}%`;
const wh = v => v < 1 ? v.toFixed(2) : v.toFixed(1);
const ml = v => v >= 1 ? v.toFixed(1) : v > 0 ? `${+v.toPrecision(2)}` : '0';   // a request's water is often well under a milliliter

// a card's own row, evidence and all, for a figure the card already backs; null when this scenario's card lacks it
function cardRow(C, mode, scene, part, label) {
  const P = { power: C.PARTS, data: C.PARTS_DATA, heat: C.PARTS_HEAT }[mode][C.SCENES[scene].id] || [];
  return P.find(p => p.id === part)?.specs.find(r => r[0].startsWith(label)) || null;
}
const rows = (...r) => r.filter(Boolean);
// the operator's own statement of its closed cooling loop, from its campus's facts
const siteCool = M => (M.scenario.site ? SITES[M.scenario.site].facts.find(r => r[0].startsWith('Cooling')) : null) || null;
const keyed = (id, beats) => beats.map((b, i) => ({ ...b, specKey: `tour:${id}:${i}` }));

// said once at the head of a tour, where its numbers need a caveat no single beat carries
export const TOUR_NOTES = {
  request: 'An illustrative timeline: the timings are round numbers, the same for every GPU choice, not a benchmark of the selected hardware. The energy and water come from this campus’s scenario.',
  light: 'The module drawn is one silicon photonics design of several; the switch package follows NVIDIA’s published counts. Power figures are the vendors’ own.',
  heat: 'Temperatures are one illustrative operating point for each cooling design, the same the cards and the Hot to cold chart use. Real plants move with load, flow and weather.',
};

// ---------- the overview: grid to token, one pass down, level by level ----------
export function story(M) {
  const C = content(M), A = M.accel, L = M.layout, nvl = A.gpusPerRack === 72, dc = M.power.id === 'dc800', air = M.cooling.id === 'air';
  const loss = p => M.ledger.filter(r => r.label.startsWith(p)).reduce((a, r) => a + r.mw, 0);
  const ledgerRow = p => { const r = M.ledger.find(x => x.label.startsWith(p)); return r ? [r.label, mw(r.mw), r.basis, r.ev] : null; };
  const card = (mode, scene, part, label) => cardRow(C, mode, scene, part, label);
  const t = tokenFigures(M), meter = mw(M.meterMW);
  const lineA = M.staircase[0].current.replace(' per phase', '');
  const rackV = dc ? 800 : 415, rackA = M.meterMW * 1e6 / (dc ? 800 : Math.sqrt(3) * 415 * 0.95);   // pf 0.95, as engine.ts's kA()
  const net = M.NET.switchMW + M.NET.opticsMW, racksMW = M.fleet.reduce((w, m) => w + m.racks * m.rackKW, 0) / 1000, spare = loss('Unallocated');
  const dci = M.bandwidth[M.bandwidth.length - 1];
  const where = nvl ? 'trays' : 'servers';
  const homes = +(M.meterMW * 1000 / 1.2).toPrecision(2);   // for scale only: two figures is all the 1.2 kW average supports
  return keyed('story', [
    // 1 · scale across
    { link: at(0, 'home'), k: 'Scale across', title: `${meter}, one grid customer`,
      text: `This campus draws ${meter} at its meter, about as much as ${n0(homes)} American homes. The grid lost about 5% delivering it. Every number below follows from that one choice and the three others in the scenario bar.`,
      specs: rows(['Meter power', meter, 'assumed', { assume: 'scenario-meter-choice' }], ['American homes, same power', `≈${n0(homes)}`, 'derived', { calc: 'homes-equivalent' }], card('power', 1, 'line', 'US grid losses')) },
    { link: at(0, 'route', 'data'), k: 'Data · scale across', title: 'Even light takes time',
      text: `Campuses hundreds of kilometers apart can train one model together. In glass, light travels at about two thirds of its speed in a vacuum, so crossing 1,000 km still takes ${dci.latency.replace('one way', 'each way')}. That makes synchronizing often expensive, and some methods, such as DiLoCo, synchronize much less often. In this model the long links carry the least traffic per GPU, and the fast ones are further in.`,
      specs: rows(card('data', 0, 'route', '1,000 km'), card('data', 0, 'remote', 'DeepMind Decoupled DiLoCo')) },
    // 2 · grid and campus
    { link: at(1, 'line'), k: 'Grid & campus', title: '345,000 volts',
      text: `The power arrives at 345 kV so the current stays small: ${lineA} per phase on each of the line’s two circuits. At ${dc ? '800 V DC' : '415 V'}, the voltage a rack takes, the same power would need about ${n0(Math.round(rackA / 1000) * 1000)} amps.`,
      specs: rows(card('power', 1, 'line', 'Voltage'), card('power', 1, 'line', 'Current'), [`Same power at ${rackV} V`, `≈${n0(Math.round(rackA / 1000) * 1000)} A`, 'derived', { calc: 'current-at-rack-voltage' }]) },
    { link: at(1, 'mpt'), k: 'Grid & campus', title: 'The first step down',
      text: `The campus has ${L.transformers} main transformers to take it down to 34.5 kV. They are 99.6% efficient, and still turn ${mw(loss('Main power'))} into heat.`,
      specs: rows(card('power', 1, 'mpt', 'Rating'), card('power', 1, 'mpt', 'Efficiency'), card('power', 1, 'mpt', 'Loss at')) },
    { link: at(1, 'bess'), sim: 'training', k: 'Grid & campus', title: 'Standing by',
      text: M.backup === 'battery'
        ? `No diesel here: the operator mentions no generators, only a ${(L.bessMWh / 1000).toFixed(1)} GWh grid-connected battery pack it says is planned. If that pack can deliver the full load, it could carry this campus for about ${(L.bessMWh / L.bessMW).toFixed(0)} hours. The model has the same batteries soak up training load swings, which can move a campus by tens of megawatts within seconds.`
        : `${n0(L.gensets)} diesel generators and ${n0(L.bessMWh)} MWh of batteries wait for the grid to fail. The batteries also soak up training load swings, which can move a campus by tens of megawatts within seconds.`,
      specs: M.backup === 'battery'
        ? rows(card('power', 1, 'bess', 'Energy, per SpaceXAI'), card('power', 1, 'bess', 'Power, assumed'), card('power', 1, 'bess', 'At full load'), card('power', 1, 'bess', 'Diesel generators'))
        : rows(card('power', 1, 'gensets', 'Units here'), card('power', 1, 'bess', 'Size here'), card('power', 1, 'bess', 'Training load swings')) },
    { link: at(1, M.cooling.id === 'warm' ? 'drycoolers' : M.closedLoop ? 'chillers' : 'towers', 'heat'), sim: 'hotday', k: 'Heat · grid & campus', title: 'All of it comes back out',
      text: `Every one of those ${meter} leaves again as heat. ${M.cooling.id === 'warm' ? 'Warm water climbs to dry coolers on the roofs' : M.closedLoop ? 'Air-cooled chillers on a closed loop push it into the air' : 'Chillers and cooling towers carry it away'}; cooling alone takes ${mw(M.coolMW)}. With the conversion losses, this design runs at PUE ${M.pue.toFixed(2)}${M.closedLoop ? ' and, by the operator’s account, cools on a closed loop, so the model counts no cooling water.' : ` and uses about ${big(waterM3h(M) * 24)} m³ of water a day (WUE is measured per kWh of IT energy, not meter energy).`}`,
      specs: rows(['Cooling power', mw(M.coolMW), 'derived', { calc: 'campus-cooling-power' }], ['PUE, this design', M.pue.toFixed(2), 'derived', { calc: 'it-load-pue' }],
        M.closedLoop ? siteCool(M) : ['Water on site, a day', `≈${big(waterM3h(M) * 24)} m³`, 'derived', { calc: 'campus-water-per-day', assume: 'wue-by-cooling' }]) },
    // 3 · power room and data hall
    dc
      ? { link: at(2, 'sst'), sim: 'outage', k: 'Power room', title: 'Straight to 800 V DC',
        text: `Solid-state transformers turn 34.5 kV AC into 800 V DC in one step, losing ${mw(loss('Solid-state'))}. No UPS, no rack rectifiers: batteries sit right on the DC bus.`,
        specs: rows(card('power', 2, 'sst', 'Efficiency'), card('power', 2, 'sst', 'Loss')) }
      : { link: at(2, 'ups'), sim: 'outage', k: 'Power room', title: 'Clean power, at a price',
        text: `UPS modules turn AC into DC and back again so the racks never see a flicker. That double conversion costs ${mw(loss('UPS'))}, more than any other step before the rack.`,
        specs: rows(card('power', 2, 'ups', 'Efficiency'), card('power', 2, 'ups', 'Loss at')) },
    { link: at(2, 'racks'), k: 'Data hall', title: `${n0(M.racks)} racks`,
      text: `Of the ${mw(M.IT_MW)} of IT load, ${mw(racksMW)} runs ${M.mixed ? `${n0(M.racks)} racks in ${M.halls} halls, ${M.fleet.map(m => `${n0(m.racksShown)} ${m.accel.rackName} racks of about ${Math.round(m.rackKW)} kW`).join(' and ')}` : `${n0(M.racks)} ${nvl ? A.rackName : 'DGX H100'} racks of about ${Math.round(M.rack.kw)} kW each, in ${M.halls} ${M.halls > 1 ? 'halls' : 'hall'}`}: ${n0(M.gpus)} GPUs. The network switches, and the optical modules at both ends of each scale-out link, take ${mw(net)}${spare >= 0.05 ? `, and ${mw(spare)} is spare capacity, short of one more rack` : ''}.`,
      specs: rows(['IT load', mw(M.IT_MW), 'derived', { calc: 'it-load-pue' }], ...(M.mixed ? M.fleet.map(m => [`${m.accel.rackName} racks`, `${n0(m.racksShown)} × ≈${Math.round(m.rackKW)} kW`, 'derived', { calc: 'campus-rack-count' }]) : [['Compute racks', `${n0(M.racks)} × ≈${Math.round(M.rack.kw)} kW = ${mw(racksMW)}`, 'derived', { calc: 'campus-rack-count' }]]),
        ['Network, switches and optics', mw(net), 'derived', { calc: 'ledger-fabric-power' }], ['GPUs', n0(M.gpus), 'derived', { calc: 'campus-gpu-count' }]) },
    { link: at(2, 'spine', 'data'), k: 'Data · the hall', title: `${n0(M.NET.switches)} switches`, figure: 'optics-cutaway',
      text: `Every GPU gets scale-out optical connections into ${M.mixed ? `its accelerator’s own fabric (${M.NET.fabrics.map(f => `${f.accel} at ${f.nicGbps >= 1000 ? f.nicGbps / 1000 + ' Tb/s' : f.nicGbps + 'G'}, ${f.tiers} tiers`).join('; ')})` : `a ${M.NET.tiers}-tier fabric`}. The switches, and the optical modules at both ends of each link, including the ones plugged into the ${where}, draw ${mw(net)}, and there are about ${big(M.NET.fibers)} strands of fiber.`,
      specs: rows(ledgerRow('Scale-out switches'), ledgerRow('Optical transceivers'), card('data', 2, 'odf', 'Fabric strands')) },
    // 4 · the rack
    ...(nvl ? [
      { link: at(3, 'shelves'), k: 'The rack', title: dc ? '800 V down to 50' : 'AC becomes DC',
        text: `${dc ? 'DC-DC shelves' : 'Power shelves'} make about 50 V for a copper busbar down the back of the rack, carrying ${M.staircase.find(s => s.v === 50)?.current ?? ''}. That is why it is a bar, not a cable.`,
        specs: rows(card('power', 3, 'shelves', 'Efficiency'), ['Busbar current', M.staircase.find(s => s.v === 50)?.current ?? '', 'derived', { calc: 'busbar-current' }]) },
      { link: at(3, 'nvswitch', 'data'), k: 'Data · the rack', title: '72 GPUs, one machine',
        text: `${A.nvlink.gen} ties all 72 GPUs together through switch trays in the middle of the rack: ${A.nvlink.tbs} TB/s per GPU, both directions combined, in copper. The chattiest work, splitting each layer, stays here.`,
        specs: rows(card('data', 3, 'nvswitch', 'Per GPU'), card('data', 3, 'nvswitch', 'Trays')) },
    ] : [
      { link: at(3, 'psus'), k: 'The rack', title: 'Every server its own supplies',
        text: `Power strips hand 240 V to each server, and six supplies inside each one make 54 V. Air cools it all: the reference design allows only four servers, about ${Math.round(M.rack.kw)} kW, per rack.`,
        specs: rows(card('power', 3, 'psus', 'Per server'), card('power', 3, 'psus', 'Efficiency'), ['Rack power, this model', `≈${Math.round(M.rack.kw)} kW`, 'derived', { calc: 'hall-rack-power' }]) },
    ]),
    // 5 · the tray or server
    // a side trip from the tray's module cages: where the scale-out traffic becomes light, then back
    { link: at(4, 'osfp', 'data'), k: nvl ? 'Data · compute tray' : 'Data · the server', title: 'Out as light',
      text: `Every GPU’s traffic to other racks leaves ${nvl ? 'the tray' : 'the server'} through pluggable optical modules at its edge. Step inside one.`,
      specs: rows(...['A 400G', 'At the SuperNIC', 'Cages', 'Module'].map(l => card('data', 4, 'osfp', l))) },   // whichever this generation's card carries
    { link: at(6, 'mzm', 'data'), parent: 4, trip: 'module', k: 'Side trip · inside the module', title: 'Where electrons become light',
      text: 'On the transmit side, modulators put each electrical lane onto laser light, and waveguides carry it to its fiber. The receive side runs the other way, through photodiodes. Then back out to the tray.',
      specs: rows(card('data', 6, 'mzm', 'Kind')) },
    { link: at(4, 'vrm'), k: nvl ? 'Compute tray' : 'The server', title: 'The last volt',
      text: `Voltage regulators ring each GPU and make the final step to about 0.8 V: ${M.staircase[M.staircase.length - 1].current} into one chip. They lose ${mw(loss('Voltage regulators'))} across the campus doing it.`,
      specs: rows(card('power', 4, 'vrm', 'Core current'), card('power', 4, 'vrm', 'Efficiency'), card('power', 4, 'vrm', 'Loss, campus-wide')) },
    ...(nvl ? [] : [
      { link: at(4, 'nvswitch', 'data'), k: 'Data · the server', title: 'Eight GPUs, one machine',
        text: 'NVLink ties eight GPUs together on one board through four NVSwitch chips: 900 GB/s per GPU, both directions combined. The domain ends at the server; everything else is network.',
        specs: rows(card('data', 4, 'nvswitch', 'Per GPU'), card('data', 4, 'nvswitch', 'Switch chips')) },
    ]),
    // 6 · the package, and what comes out of it
    { link: at(5, 'dies'), k: 'GPU package', title: `${pct(M.gpuSiliconMW, M.meterMW)} reaches the GPU dies`,
      text: `Of ${meter} at the meter, ${mw(M.gpuSiliconMW)} reaches the GPU dies themselves, where it runs the computation, on-chip memory, communication, control and leakage. Almost all the rest became heat on the way, in conversion, cooling, memory, CPUs and the network; a sliver was never drawn at all, spare capacity from rounding down to a whole rack.`,
      specs: rows(['GPU dies, whole campus', mw(M.gpuSiliconMW), 'derived', { calc: 'gpu-die-power' }], ['Share of the meter', pct(M.gpuSiliconMW, M.meterMW), 'derived', { calc: 'gpu-die-power' }]) },
    { link: at(5, 'hbm', 'data'), k: 'Data · GPU package', title: 'Memory paces the decode',
      text: `${A.hbm.type} feeds each GPU at ${A.hbm.tbs} TB/s. When a reply is written one token at a time for a small batch, every token reads the model’s weights again, so that step is usually limited by memory bandwidth more than by raw math. Prefill, and large batches, lean more on compute.`,
      specs: rows(card('data', 5, 'hbm', 'Bandwidth')) },
    { link: at(5, 'tokens'), sim: 'inference', k: 'Tokens', title: `${big(t.rate)} tokens a second`,
      text: `At the utilization set below, the campus writes about ${big(t.rate)} tokens a second, ${big(3.6e6 / t.j)} per kilowatt-hour at the meter${calc.withTrain ? ', including its share of training' : ', for serving alone: the training share is switched off below'}. Change the scenario and the tour retells itself.`,
      specs: rows(['Tokens a second, campus', big(t.rate), 'derived', { calc: 'token-rate', assume: 'tokens-per-gpu-default' }], ['Tokens per kWh at the meter', big(3.6e6 / t.j), 'derived', { calc: 'energy-per-token' }]) },
  ]);
}

// ---------- a watt ----------
export function watt(M) {
  const rows_ = M.ledger, meter = M.meterMW, nvl = M.accel.gpusPerRack === 72, dc = M.power.id === 'dc800';
  const share = pre => rows_.filter(r => pre.some(p => r.label.startsWith(p))).reduce((a, r) => a + r.mw, 0) / meter;
  let left = 1;
  const take = f => { left -= f; return `${w3(left)} W left`; };
  const pct = f => `${w3(f)} W`;   // watts, not mW: the display font is uppercase and would turn mW into MW
  const slice = f => [['This step, per watt at the meter', `${w3(f)} W`, 'derived', { calc: 'watt-slices' }]];
  const grid = share(['Main power', 'Campus cables']);
  const room = share(dc ? ['Unit substations', 'Solid-state', '800 V DC'] : ['Unit substations', 'UPS', 'Busway']);
  const cool = share(['Cooling', 'Lighting']);
  const net = share(['Scale-out', 'Optical']);
  const rack = share(['Rack power shelves', 'Server power supplies', 'In-rack', 'Busbar', 'Server power cabling']);
  const nvsw = share(['NVLink switch trays', 'NVSwitch chips']);
  const host = share([M.accel.cpuName, 'SuperNICs', 'NICs', 'SSDs']);
  const board = share(['Bus converters', 'Voltage regulators']);
  const hbm = share([M.accel.hbm.type]);
  const spare = share(['Unallocated']);
  const beats = [
    { link: at(0, 'home'), k: 'The meter', title: 'One watt', tally: '1.000 W', text: `Take one watt of the ${mw(meter)} this campus draws and follow it. Every step below takes a slice; the number beside the scene shows what is left on its way to the GPU dies.`,
      specs: [['Meter power', mw(meter), 'assumed', { assume: 'scenario-meter-choice' }]] },
    { link: at(1, 'mpt'), k: 'Grid & campus', title: `${pct(grid)} to the yard`, tally: take(grid), text: 'The main transformers and the campus cables and switchgear warm up a little as the watt passes: the cheapest step there is.', specs: slice(grid) },
    { link: at(1, M.cooling.id === 'warm' ? 'drycoolers' : 'chillers'), k: 'A detour', title: `${pct(cool)} to cooling and the building`, tally: take(cool), text: `Part of every watt never reaches a rack: it runs ${M.cooling.id === 'warm' ? 'dry-cooler fans and pumps' : M.closedLoop ? 'air-cooled chillers and pumps' : 'chillers, towers and pumps'}, lights and controls. That slice is most of the gap between PUE ${M.pue.toFixed(2)} and 1.`,
      specs: [...slice(cool), ['PUE, this design', M.pue.toFixed(2), 'derived', { calc: 'it-load-pue' }]] },
    { link: at(2, dc ? 'sst' : 'ups'), k: 'Power room', title: `${pct(room)} to the power room`, tally: take(room), text: dc ? 'Solid-state transformers make 800 V DC in one conversion, and the DC bus loses a little more on the way to the rows.' : 'Unit substations, the UPS double conversion and the busway each take their share. The UPS is the big one.', specs: slice(room) },
    { link: at(2, 'spine', 'data'), k: 'Network', title: `${pct(net)} to the fabric`, tally: take(net), text: `Switches, and the optical modules at both ends of every scale-out link, including the ones plugged into the ${nvl ? 'trays' : 'servers'}: the price of letting every GPU reach every other.`, specs: slice(net) },
    { link: at(3, nvl ? 'shelves' : 'psus'), k: 'The rack', title: `${pct(rack)} to rack power`, tally: take(rack), text: nvl ? `${dc ? 'DC-DC shelves step 800 V down to 50 V' : 'Power shelves turn AC into 50 V DC'}, and the copper busbar warms slightly carrying it.` : 'Each server’s own supplies turn AC into 54 V; the cords lose a little on the way.', specs: slice(rack) },
    { link: nvl ? at(3, 'nvswitch') : at(4, 'nvswitch'), k: 'Scale-up', title: `${pct(nvsw)} to NVLink switches`, tally: take(nvsw), text: 'The NVLink switch chips that let the GPUs share memory draw their share.', specs: slice(nvsw) },
    { link: at(4, nvl ? 'grace' : 'cpu'), k: nvl ? 'Compute tray' : 'The server', title: `${pct(host)} to CPUs, NICs and drives`, tally: take(host), text: 'The host side: CPUs, memory, network cards and drives. They keep the GPUs fed, and none of this slice reaches a GPU die.', specs: slice(host) },
    { link: at(4, 'vrm'), k: 'The last volt', title: `${pct(board)} to converters and regulators`, tally: take(board), text: 'Bus converters and the rings of voltage regulators beside each GPU bring the watt down to under a volt, and lose about a tenth of what passes through.', specs: slice(board) },
    { link: at(5, 'hbm'), k: 'GPU package', title: `${pct(hbm)} to memory`, tally: take(hbm), text: `${M.accel.hbm.type} stacks beside each GPU’s ${M.accel.dies > 1 ? 'dies' : 'die'} use their share moving weights in and out.`, specs: slice(hbm) },
  ];
  left -= spare;   // rounds down to a whole rack: never drawn at all, so it gets no beat of its own
  beats.push({ link: at(5, 'dies'), k: 'The GPU dies', title: `${w3(left)} W reaches the GPU dies`, tally: `${w3(left)} W left`,
    text: `About ${Math.round(left * 100)}% of the watt reaches the GPU dies. There it powers the computation, on-chip memory, communication, control and leakage, and almost all of it ends as heat. This model does not estimate how much of it is useful arithmetic.${spare >= 0.0005 ? ` The ${w3(spare)} W the tour skipped is spare capacity, short of a whole rack, and was never drawn at all.` : ''}`,
    specs: [['Reaches the GPU dies, per watt', `${w3(left)} W`, 'derived', { calc: 'gpu-die-power' }]] });
  return keyed('watt', beats);
}

// ---------- a request ----------
// The camera goes inward one level at a time, which is not quite the order a request happens in: the stop at the rack
// is a look at where the request will run, not a step in time, so it adds none.
export function request(M) {
  const C = content(M), t = tokenFigures(M), nvl = M.accel.gpusPerRack === 72;
  const card = (mode, scene, part, label) => cardRow(C, mode, scene, part, label);
  const replyTok = 500, streamTps = 60;               // an interactive reply and a per-user stream rate (illustrative)
  const T = { net: 25, vault: 1, queue: 50, frontEnd: 0.2, prefill: 200 };   // ms, illustrative (ASSUMPTIONS 'request-timeline')
  const decodeS = replyTok / streamTps, whReply = t.j * replyTok / 3600, whIT = whReply / M.pue;
  const ttft = T.net + T.vault + T.queue + T.frontEnd + T.prefill + T.net;   // until the first word is back on the phone
  let ms = 0;
  const add = v => { ms += v; return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`; };
  const timeline = ['Timing', 'illustrative, the same for every GPU', 'assumed', { assume: 'request-timeline' }];
  const energy = ['Energy per reply, at the meter', `≈${wh(whReply)} Wh${calc.withTrain ? ', training share included' : ', serving only'}`, 'derived', { calc: 'reply-energy' }];
  return keyed('request', [
    { link: at(0, 'route', 'data'), k: 'Scale across', title: 'A question leaves a phone', tally: add(T.net), text: `Your prompt crosses the internet to the nearest region: tens of milliseconds, much of it light in fiber at about 5 µs per kilometer. The ≈${T.net} ms here is illustrative.`,
      specs: rows(timeline, card('data', 0, 'route', 'Speed in fiber')) },
    { link: at(1, 'fiber', 'data'), k: 'Grid & campus', title: 'In through the fiber vault', tally: add(T.vault), text: 'It enters through one of the two diverse fiber routes, the same way the answer will leave.',
      specs: rows(card('data', 1, 'fiber', 'Routes')) },
    { link: at(2, 'racks', 'data'), k: 'Data hall', title: 'Waiting for a seat', tally: add(T.queue), text: `The hall holds many copies of the model. In this tour a serving copy lives on ${nvl ? 'one rack’s 72 GPUs' : 'one 8-GPU server'}; the training layout on the pipeline and data-parallel cards is different. A scheduler batches your request with others onto one copy, and under load that wait can be longer than every network hop combined. The ${T.queue} ms here is illustrative.`,
      specs: rows(['A serving copy, this tour', nvl ? 'one rack, 72 GPUs' : 'one server, 8 GPUs', 'assumed', { assume: 'serving-replica' }], timeline) },
    { link: at(3, 'tp', 'data'), k: 'Scale-up · where it will run', title: 'Every layer, a conversation', tally: add(0), text: `Your copy of the model is split across ${nvl ? 'the GPUs of this rack' : 'the 8 GPUs of a server'}. During prefill and decoding they will exchange partial results over NVLink inside every layer, many times per token. How long each exchange takes depends on message size, the number of GPUs and the software, so this stop adds no time.`,
      specs: rows(card('data', 3, 'tp', 'Traffic'), card('data', 2, 'racks', 'NVLink per GPU')) },
    { link: at(4, 'dpu', 'data'), k: nvl ? 'Compute tray' : 'The server', title: 'The front-end network', tally: add(T.frontEnd), text: `The request itself arrives on a separate network, kept apart from the GPU fabric, through the ${nvl ? 'DPU on each tray' : 'front-end network cards on each server'}.`,
      specs: rows(card('data', 4, 'dpu', ''), timeline) },
    { link: at(5, 'dies'), k: 'GPU package', title: 'Reading the prompt', tally: add(T.prefill), text: `Prefill: the model takes in your prompt’s tokens in parallel, often in chunks alongside other requests. Each weight it reads serves many prompt tokens, so prefill is usually limited by compute rather than memory. Here it takes ${T.prefill} ms (illustrative). With the trip in, the queue and the trip back, the first word reaches you about ${Math.round(ttft)} ms after you pressed send: that whole wait, not prefill alone, is the time to first token.`,
      specs: rows(['Prefill, this example', `${T.prefill} ms`, 'assumed', { assume: 'request-timeline' }], ['Time to first token, this example', `≈${Math.round(ttft)} ms`, 'derived', { calc: 'request-ttft' }]) },
    { link: at(5, 'hbm', 'data'), sim: 'inference', k: 'GPU package', title: `${replyTok} tokens, one at a time`, tally: add(decodeS * 1000), text: `Decode: each new token needs the model’s weights read again from ${M.accel.hbm.type}, shared across the batch of users served together, so this step is usually limited by memory bandwidth. At ${streamTps} tokens a second for your stream (illustrative), a ${replyTok}-token answer takes about ${decodeS.toFixed(1)} s. It costs about ${wh(whReply)} Wh at this campus’s meter, cooling included${calc.withTrain ? ', and a share of training' : ''}.`,
      specs: rows(['Stream rate and reply length', `${streamTps} tokens/s, ${replyTok} tokens`, 'assumed', { assume: 'request-timeline' }], energy, card('data', 5, 'hbm', 'Bandwidth')) },
    { link: at(5, 'tokens', 'data'), k: 'Out', title: 'The answer streams back', tally: add(T.net), text: `Words leave as they are written, a few bytes each, back out the way the question came in. In all: about ${(ms / 1000).toFixed(1)} s, and about ${wh(whReply)} Wh at the meter, of which about ${wh(whIT)} Wh reached the IT equipment. ${M.closedLoop ? 'The operator reports a closed cooling loop, so the model counts no cooling water.' : `At this design’s WUE of ${M.wue.toFixed(2)} L per kWh of IT energy, that is about ${ml(t.waterReply)} mL of water on site.`}`,
      specs: rows(energy, ['IT energy per reply', `≈${wh(whIT)} Wh`, 'derived', { calc: 'reply-energy' }],
        M.closedLoop ? siteCool(M) : ['Water on site, per reply', `≈${ml(t.waterReply)} mL`, 'derived', { calc: 'reply-water', assume: 'wue-by-cooling' }]) },
  ]);
}

// ---------- electrons to light: one lane through a pluggable module, then the same lane co-packaged ----------
export function light(M) {
  const C = content(M), nvl = M.accel.gpusPerRack === 72;
  const card = (mode, scene, part, label) => cardRow(C, mode, scene, part, label);
  const d = (sc, id) => C.PARTS_DATA[sc].find(p => p.id === id);
  // every step inside counts as the tray, the level the tour went in from: the camera goes into the module, across to
  // the CPO package, and the tour ends there
  const inside = (sc, id, title, text, ...specs) => ({ link: at(sc === 'module' ? 6 : 7, id, 'data'), parent: 4, trip: sc, k: sc === 'module' ? 'Inside the pluggable module' : 'Inside the CPO package', title, text, specs: rows(...specs) });
  return keyed('light', [
    { link: at(4, 'osfp', 'data'), k: nvl ? 'Compute tray' : 'The server', title: 'One lane, leaving the tray',
      text: `Follow one electrical lane from the NIC to the fiber: first through a pluggable module in ${nvl ? 'the tray’s' : 'the server’s'} cage, then the same job done inside a switch package.`,
      specs: rows(...['A 400G', 'At the SuperNIC', 'Cages', 'Module'].map(l => card('data', 4, 'osfp', l))) },   // whichever this generation's card carries
    inside('module', 'fingers', 'In at the edge', 'The lane arrives on the edge connector’s gold fingers, one of eight transmit lanes. Eight more leave on other fingers: the receive side.', card('data', 6, 'fingers', 'Host lanes')),
    inside('module', 'dsp', 'Cleaned up', d('module', 'dsp').body, card('data', 6, 'dsp', 'What it does')),
    inside('module', 'driver', 'The driver', d('module', 'driver').body, card('data', 6, 'driver', 'LPO keeps')),
    inside('module', 'mzm', 'Onto light', d('module', 'mzm').body, card('data', 6, 'mzm', 'Kind')),
    inside('module', 'mpo', 'Out on its own fiber', d('module', 'mpo').body, card('data', 6, 'mpo', 'Connectors'), card('data', 6, 'mpo', 'Fibers lit')),
    inside('cpo', 'serdes', 'The same lane, co-packaged', `${d('cpo', 'serdes').body} Compare like with like: the module you just left carries 1.6 Tb/s each way, and so does one optical engine here. This package holds 18 of them.`, card('data', 7, 'rings', 'Per engine'), card('data', 7, 'serdes', 'Electrical loss')),
    inside('cpo', 'eic', 'The driver, micrometers from the light', d('cpo', 'eic').body, card('data', 7, 'eic', 'Engine stack')),
    inside('cpo', 'rings', 'Onto light, by a ring', d('cpo', 'rings').body, card('data', 7, 'rings', 'Modulators')),
    inside('cpo', 'els', 'Light from the front panel', d('cpo', 'els').body, card('data', 7, 'els', 'Laser modules')),
    inside('cpo', 'fiberout', 'Out through the package edge', `${d('cpo', 'fiberout').body} The power per port is where the two designs part ways, by NVIDIA’s own figures.`, card('data', 7, 'fiberout', 'Fibers per engine'), card('data', 7, 'asic', 'Per port')),
  ]);
}

// ---------- the heat ----------
// Every temperature comes from the engine's one operating point per cooling design (M.temps), the same the cards and
// the Hot to cold chart read, and each says which loop and which side of it: supply runs to the heat, return away.
export function heat(M) {
  const C = content(M), A = M.accel, T = M.temps, nvl = A.gpusPerRack === 72, warm = M.cooling.id === 'warm', air = M.cooling.id === 'air';
  const card = (mode, scene, part, label) => cardRow(C, mode, scene, part, label);
  const loop = (label, v) => [label, v, 'assumed', { assume: 'loop-temps' }];
  const pkgW = Math.round(A.gpuW), dieW = Math.round(A.gpuW * (1 - A.hbmShare)), dies = A.dies > 1 ? 'dies' : 'die';
  const liqKW = Math.round(M.rack.kw * (air ? 0 : A.liquidShare));
  return keyed('heat', [
    { link: at(5, 'junction', 'heat'), k: 'The die', title: `≈${n0(dieW)} W in a few square centimeters`, tally: `≈${T.die} °C die`,
      text: `The package draws ${n0(pkgW)} W: about ${n0(dieW)} W in the compute ${dies} and ${n0(pkgW - dieW)} W in the ${A.hbm.type} stacks beside ${A.dies > 1 ? 'them' : 'it'}. The ${A.dies > 1 ? 'dies’' : 'die’s'} share becomes heat in about ${FACTS[A.id].dieCm2} cm² of silicon, about ${dieFlux(A)} W per square centimeter on average.`,
      specs: rows(card('heat', 5, 'junction', 'Package power'), ['Compute dies, this model', `≈${n0(dieW)} W`, 'derived', { calc: 'gpu-die-power' }], card('heat', 5, 'flux', 'Die area'), card('heat', 5, 'flux', 'Average flux'), loop('Die, this operating point', `≈${T.die} °C`)) },
    { link: at(5, 'tim', 'heat'), k: 'The first hop', title: 'Through the lid', tally: `≈${T.lid} °C lid`, text: 'Thermal interface material carries it into the lid, then into the metal above. Each layer costs a few degrees.',
      specs: rows(card('heat', 5, 'tim', 'Layers'), loop('Lid, this operating point', `≈${T.lid} °C`)) },
    nvl
      ? { link: at(4, 'coldplates', 'heat'), k: 'Compute tray', title: 'Into water', tally: `≈${T.tcsReturn} °C coolant out`, text: `A copper cold plate with fine fins hands the heat to the rack loop’s coolant, which enters the tray at about ${T.tcsSupply} °C and leaves a few degrees warmer for every chip it passes.`,
        specs: rows(card('heat', 4, 'coldplates', 'Heat per GPU'), warm ? card('heat', 1, 'drycoolers', 'NVIDIA warm-water spec') : loop('Rack loop, supply → return', `${T.tcsSupply} → ${T.tcsReturn} °C`)) }
      : { link: at(4, 'heatsinks', 'heat'), k: 'The server', title: 'Into air', tally: `≈${T.hotAisle} °C air out`, text: `A tall heat sink spreads it through fins, and the server fans sweep it out the back: air comes in at about ${T.coldAisle} °C and leaves near ${T.hotAisle} °C.`,
        specs: rows(card('heat', 4, 'heatsinks', 'Heat per GPU'), loop('Air in → out, this operating point', `${T.coldAisle} → ${T.hotAisle} °C`)) },
    nvl
      ? { link: at(3, 'manifold', 'heat'), k: 'The rack', title: 'Down the manifold', tally: `≈${T.tcsReturn} °C rack return`, text: `The rack’s return manifold gathers about ${liqKW} kW of heat from every tray, in coolant at about ${T.tcsReturn} °C.`,
        specs: rows(card('heat', 3, 'manifold', 'To liquid'), card('heat', 3, 'manifold', 'Rise across the rack'), card('heat', 3, 'manifold', 'Supply → return')) }
      : { link: at(3, 'rearair', 'heat'), k: 'The rack', title: 'Into the hot aisle', tally: `≈${T.hotAisle} °C air`, text: `All ${Math.round(M.rack.kw)} kW of the rack leaves as hot air into a sealed aisle.`,
        specs: rows(card('heat', 3, 'rearair', 'Heat to air'), card('heat', 3, 'rearair', 'Rise')) },
    air
      ? { link: at(2, 'inrow', 'heat'), k: 'Data hall', title: 'Air to water', tally: `≈${T.fwsSupply} °C water in`, text: `In-row cooling units pull the hot air through coils of chilled water, which comes in at about ${T.fwsSupply} °C and leaves at about ${T.fwsReturn} °C, and send the air back to the rack fronts at about ${T.coldAisle} °C.`,
        specs: rows(card('heat', 2, 'inrow', 'Supply air'), loop('Chilled water, supply → return', `${T.fwsSupply} → ${T.fwsReturn} °C`)) }
      : { link: at(2, 'cdu', 'heat'), k: 'Data hall', title: 'Loop to loop', tally: `≈${T.fwsReturn} °C facility return`, text: `A coolant distribution unit passes the heat from the rack loop into facility water through a plate heat exchanger, without mixing them. Facility water comes in at about ${T.fwsSupply} °C and leaves at about ${T.fwsReturn} °C, a few degrees below the rack loop on each side.`,
        specs: rows(card('heat', 2, 'cdu', 'Approach'), loop('Facility water, supply → return', `${T.fwsSupply} → ${T.fwsReturn} °C`)) },
    { link: at(2, 'riser', 'heat'), k: 'Data hall', title: 'Up and out', tally: `≈${T.fwsReturn} °C return`, text: `Insulated headers carry the warm return water, about ${T.fwsReturn} °C, out of the building to the ${warm ? 'roof' : 'chiller plant'}.`,
      specs: rows(card('heat', 2, 'riser', 'Carries'), loop(air ? 'Chilled water return' : 'Facility water return', `≈${T.fwsReturn} °C`)) },
    warm
      ? { link: at(1, 'drycoolers', 'heat'), k: 'Grid & campus', title: 'Into the air', tally: `≈${T.fwsSupply} °C supply back`, text: `Dry coolers push the heat into outside air with fans alone and send the water back at about ${T.fwsSupply} °C, as long as the air stays below about ${T.ambient} °C. ${M.closedLoop ? 'The loop is closed, so, by the operator’s account, no water is evaporated.' : 'On hotter afternoons sprays help, and cost water.'}`,
        specs: rows(card('heat', 1, 'drycoolers', 'Heat rejected'), loop('Facility water supply, back to the hall', `≈${T.fwsSupply} °C`), M.closedLoop ? siteCool(M) : loop('Sprays needed above', `≈${T.ambient} °C outside`)) }
      : { link: at(1, 'chillers', 'heat'), k: 'Grid & campus', title: 'Pumped uphill', tally: `≈${T.fwsSupply} °C supply made`,
        text: M.closedLoop
          ? `Air-cooled chillers spend electricity to make cold water at about ${T.fwsSupply} °C again, pushing the heat into outside air through their condenser coils and adding their own heat to the pile.`
          : `Chillers spend electricity to make cold water at about ${T.fwsSupply} °C again, moving the heat into condenser water at about ${T.condenser} °C, which the cooling towers cool by evaporating some of it. The chillers add their own heat to the pile.`,
        specs: rows(card('heat', 1, 'chillers', 'Cooling power'), loop(air ? 'Chilled water made' : 'Facility water made', `≈${T.fwsSupply} °C`), M.closedLoop ? null : loop('Condenser water to the towers', `≈${T.condenser} °C`)) },
    { link: at(1, 'plume', 'heat'), sim: 'hotday', k: 'The sky', title: 'Gone', tally: `${mw(M.meterMW)} of heat`,
      text: `${warm ? 'Warm air rises off the roofs' : M.closedLoop ? 'Warm air rises off the chillers’ fans' : 'Warm, wet air rises off the cooling towers'}. At the design point the campus is a ${mw(M.meterMW)} heater that happened to write tokens on the way. The clock below runs one hot day, from a cool night to a hot afternoon: as the air warms, cooling works harder and the draw climbs.`,
      specs: rows(card('heat', 1, 'plume', 'Heat out')) },
  ]);
}

// ---------- every part in a layer, one level at a time ----------
// Each level opens on its establishing shot with the layer's intro (the overview: no part, so no number), then stops at
// every part with its card, in list order, so the part steps run 1 to N like the pins.
// Power runs level 1 to 6, the way it flows; heat runs 6 to 1, from the die out to the sky; data runs 1 to 6.
// Parts a scene variant does not draw (an air-cooled hall has no CDU) are skipped by the player at run time.
const LAYER = { power: ['PARTS', 'intro', 'Power'], data: ['PARTS_DATA', 'dataIntro', 'Data'], heat: ['PARTS_HEAT', 'heatIntro', 'Heat'] };
export const OUTWARD = new Set(['heat']);
// tour audit finding 4: the data-layer stops whose card is about pluggable or co-packaged optics also get the
// optics-cutaway disclosure (DSP/LPO/CPO), so a reader who never opens the Links section still sees what is
// inside one - the CPO card on the hall's switches, the general optics card beside it (it already names DSP and
// LPO by name), and the tray's own OSFP cages (same id on both the NVL72 and DGX H100 tray part lists). Not the
// line terminal where campuses meet the WAN: its coherent long-haul optics are not what the cutaway draws. story.js
// renders the figure; this only marks which stops carry it.
const OPTICS_FIGURE = new Set(['hall:cpo', 'hall:optics', 'tray:osfp']);
/** @param {any} M @param {'power'|'data'|'heat'} mode @param {number|null} [only] one level (0-5), or all six */
export function layer(M, mode, only = null) {
  const C = content(M), [key, introKey, name] = LAYER[mode], out = [];
  // the six levels in a line; the side level inside the optics (index 6) plays only when asked for by name
  const levels = C.SCENES.map((sc, i) => [sc, i]).filter(([sc, i]) => only === null ? !sc.side : i === only);
  if (OUTWARD.has(mode)) levels.reverse();
  levels.forEach(([sc, i]) => {
    const parts = C[key][sc.id] || [];
    // the layer name goes in every kicker, not just the level number, so a reader mid-walk through "All" can
    // always tell which of the three layers a beat belongs to (tour audit finding 14)
    out.push({ link: { scene: i, mode, part: null }, k: `${name} · Level ${i + 1} of 6 · overview`, title: sc.title, text: sc[introKey], tally: `Level ${i + 1} of 6`, level: true });
    // The line-terminal optic is locally powered/cooled at each campus. This
    // explicit side comparison does not turn the long-haul light path into an
    // intercampus power or heat connection. Resume this parent level afterward.
    if (only === null && i === 0 && mode !== 'data') {
      const comparison = sideTrip(C, key, mode, name, 'coherent', i);
      if (comparison.length) comparison[0].text = `Inside a campus line terminal: a coherent module consumes local electrical power and rejects heat locally. This side trip does not carry power or heat between campuses. ${comparison[0].text}`;
      out.push(...comparison);
    }
    // A comparison trip, not an assertion that NVL72's passive spine contains
    // active cable chips. Return to this rack's first heat card afterward.
    if (only === null && mode === 'heat' && sc.id === 'rack' && M.accel.gpusPerRack === 72) {
      const comparison = sideTrip(C, key, mode, name, 'copper', i);
      comparison[0].text = `This rack's NVLink spine uses passive copper. For comparison, active cable plugs generate heat in their signal-conditioning chips. ${comparison[0].text}`;
      out.push(...comparison);
    }
    parts.forEach((p, j) => out.push({
      link: { scene: i, mode, part: p.id }, k: `${name} · Level ${i + 1} · ${sc.title}`, title: p.title, text: p.body,
      // the full row set, not a 3-row slice: story.js shows the first three and puts the rest behind a working
      // disclosure, each with its own chip: specKey matches the key src/claims.js already builds for the same
      // card's 3D-view rows (card:<layer>:<scene>:<part>:<row>), so a tour's chip and the card's chip open the
      // same popover (tour audit finding 4)
      specs: p.specs, specKey: `card:${mode}:${sc.id}:${p.id}`, tally: `Level ${i + 1} · ${j + 1} of ${parts.length}`,
      ...(mode === 'data' && OPTICS_FIGURE.has(`${sc.id}:${p.id}`) ? { figure: 'optics-cutaway' } : {}),
    }));
    // a door into the side level: take the trip through the half of it that lives here, then carry on here. Not in a
    // one-level playthrough, whose steps are numbered like the pins
    if (only === null) for (let j = out.length - 1, n = 0; n < parts.length; n++) {
      const p = parts[parts.length - 1 - n]; if (!p.trip) continue;
      const at_ = out.findIndex(b => b.link.scene === i && b.link.part === p.id);
      out.splice(at_ + 1, 0, ...sideTrip(C, key, mode, name, p.trip, i));
    }
  });
  return out;
}
const SIDE_NAME = { module: 'the pluggable module', cpo: 'the CPO package', copper: 'the copper cables', coherent: 'the coherent module' };
// a side trip: every part of the side level a door opens, in that level's own order
function sideTrip(C, key, mode, name, trip, parent) {
  const side = C.SCENES.findIndex(sc => sc.id === trip), parts = C[key][trip] || [];
  return parts.map((p, j) => ({
    link: { scene: side, mode, part: p.id }, parent, trip, k: `${name} · Side trip · Inside ${SIDE_NAME[trip]}`, title: p.title, text: p.body,
    specs: p.specs, specKey: `card:${mode}:${trip}:${p.id}`, tally: `Side trip · ${j + 1} of ${parts.length}`,
  }));
}
// in, out, in: each layer starts on the level the one before it ended on
export const everything = M => ['power', 'heat', 'data'].flatMap(m => layer(M, m));
// This order still bounds a manual step (the chevrons, arrow keys, the "Next" suggestion) to one level or one
// tour away, so the camera never jumps. Reed, 09/27: it used to also hand playback on to the next tour with no
// stop, story -> heat -> watt -> request, which broke the overview's own promise of "once" - story.js now stops
// there and offers the three as separate choices. Every-part tours still hand over while playing: that walk is
// meant to be exhaustive and continuous, not a menu of choices.
export const CHAIN = { Tours: ['story', 'heat', 'watt', 'request', 'light'], 'Every part': ['all-power', 'all-heat', 'all-data'] };
