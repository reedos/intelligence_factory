// Guided journeys: one thing followed end to end, with a running tally beside the 3D view.
//   story    the overview: all six levels once, grid to token, stopping at each level's highlights in every layer
//   watt     one watt from the meter to the silicon; the tally is what is left
//   request  one question from a phone to an answer; the tally is elapsed time and energy
//   heat     one GPU's heat from the die to the sky; the tally is temperature
// Every tour moves through the levels one way, one level at a time: it never skips a level and never goes back to
// one it has left (journeys.test.ts holds them to it), so the camera never jumps out and back in.
// Beats: { link, k, title, text, tally, sim }. A sim runs that clock while the beat is on.
import { tokenFigures } from '../model/tokens.js';
import { content } from '../data.js';

const at = (scene, part, mode = 'power') => ({ scene, mode, part });
const w3 = v => v.toFixed(3);
const mw = v => v >= 1000 ? `${+(v / 1000).toFixed(2)} GW` : v >= 10 ? `${Math.round(v).toLocaleString('en-US')} MW` : `${v.toFixed(1)} MW`;

const n0 = v => Math.round(v).toLocaleString('en-US');
const big = v => v >= 1e9 ? `${+(v / 1e9).toFixed(1)} billion` : v >= 1e6 ? `${+(v / 1e6).toFixed(1)} million` : n0(v);
const pct = (a, b) => `${Math.round(a / b * 100)}%`;

// ---------- the overview: grid to token, one pass down, level by level ----------
export function story(M) {
  const A = M.accel, L = M.layout, nvl = A.gpusPerRack === 72, dc = M.power.id === 'dc800', air = M.cooling.id === 'air';
  const loss = p => M.ledger.filter(r => r.label.startsWith(p)).reduce((a, r) => a + r.mw, 0);
  const t = tokenFigures(M), meter = mw(M.meterMW);
  const lineA = M.staircase[0].current.replace(' per phase', '');
  const coreA = M.staircase[M.staircase.length - 1].current;
  const net = M.NET.switchMW + M.NET.opticsMW;
  const dci = M.bandwidth[M.bandwidth.length - 1];
  return [
    // 1 · scale across
    { link: at(0, 'home'), k: 'Scale across', title: `${meter}, one grid customer`,
      text: `This campus draws ${meter} at its meter, about as much as ${n0(M.meterMW * 1000 / 1.2)} American homes. The grid lost about 5% delivering it. Every number below follows from that one choice and the three others in the scenario bar.` },
    { link: at(0, 'route', 'data'), k: 'Data · scale across', title: 'Even light takes time',
      text: `Campuses hundreds of kilometers apart can train one model together. Light is the fastest thing there is, but in glass it travels at about two thirds of its speed in a vacuum, so crossing 1,000 km still takes ${dci.latency.replace('one way', 'each way')}. A training step can't wait on that every time, so sites sync rarely: the long links carry the least, and the fast ones are further in.` },
    // 2 · grid and campus
    { link: at(1, 'line'), k: 'Grid & campus', title: '345,000 volts',
      text: `The power arrives at 345 kV so the current stays small: ${lineA} per phase for the whole campus. At the rack, the same power would need tens of thousands of amps.` },
    { link: at(1, 'mpt'), k: 'Grid & campus', title: 'The first step down',
      text: `The campus has ${L.transformers} main transformers to take it down to 34.5 kV. They are 99.6% efficient, and still turn ${mw(loss('Main power'))} into heat.` },
    { link: at(1, 'bess'), sim: 'training', k: 'Grid & campus', title: 'Standing by',
      text: M.backup === 'battery'
        ? `No diesel here: the operator names batteries as the backup, a ${(L.bessMWh / 1000).toFixed(1)} GWh pack it says is planned, which could carry this campus for about ${(L.bessMWh / L.bessMW).toFixed(0)} hours if it can deliver the full load. The same batteries soak up training load swings, which can move a campus tens of megawatts in under a second.`
        : `${n0(L.gensets)} diesel generators and ${n0(L.bessMWh)} MWh of batteries wait for the grid to fail. The batteries also soak up training load swings, which can move a campus tens of megawatts in under a second.` },
    { link: at(1, M.closedLoop ? 'chillers' : air || M.cooling.id === 'liquid' ? 'towers' : 'drycoolers', 'heat'), sim: 'hotday', k: 'Heat · grid & campus', title: 'All of it comes back out',
      text: `Every one of those ${meter} leaves again as heat. ${M.cooling.id === 'warm' ? 'Warm water climbs to dry coolers on the roofs' : M.closedLoop ? 'Air-cooled chillers on a closed loop push it into the air' : 'Chillers and cooling towers carry it away'}; cooling alone takes ${mw(M.coolMW)}. With the conversion losses, this design runs at PUE ${M.pue.toFixed(2)}${M.closedLoop ? ' and, by the operator’s account, evaporates no water: it takes only domestic water.' : ` and uses about ${big(M.meterMW * 24 * M.wue)} m³ of water a day.`}` },
    // 3 · power room and data hall
    dc
      ? { link: at(2, 'sst'), sim: 'outage', k: 'Power room', title: 'Straight to 800 V DC',
        text: `Solid-state transformers turn 34.5 kV AC into 800 V DC in one step, losing ${mw(loss('Solid-state'))}. No UPS, no rack rectifiers: batteries sit right on the DC bus.` }
      : { link: at(2, 'ups'), sim: 'outage', k: 'Power room', title: 'Clean power, at a price',
        text: `UPS modules turn AC into DC and back again so the racks never see a flicker. That double conversion costs ${mw(loss('UPS'))}, more than any other step before the rack.` },
    { link: at(2, 'racks'), k: 'Data hall', title: `${n0(M.racks)} racks`,
      text: `The IT load, ${mw(M.IT_MW)}, lands on ${n0(M.racks)} ${nvl ? A.rackName : 'DGX H100'} racks of about ${Math.round(M.rack.kw)} kW each, in ${M.halls} ${M.halls > 1 ? 'halls' : 'hall'}. That is ${n0(M.gpus)} GPUs.` },
    { link: at(2, 'spine', 'data'), k: 'Data · the hall', title: `${n0(M.NET.switches)} switches`,
      text: `Every GPU gets its own optical port into a ${M.NET.tiers}-tier fabric. Switches and optics outside the racks draw ${mw(net)}, and there are about ${big(M.NET.fibers)} strands of fiber.` },
    // 4 · the rack
    ...(nvl ? [
      { link: at(3, 'shelves'), k: 'The rack', title: dc ? '800 V down to 50' : 'AC becomes DC',
        text: `${dc ? 'DC-DC shelves' : 'Power shelves'} make about 50 V for a copper busbar down the back of the rack, carrying ${M.staircase.find(s => s.v === 50)?.current ?? ''}. That is why it is a bar, not a cable.` },
      { link: at(3, 'nvswitch', 'data'), k: 'Data · the rack', title: '72 GPUs, one machine',
        text: `${A.nvlink.gen} ties all 72 GPUs together through switch trays in the middle of the rack, ${A.nvlink.tbs} TB/s per GPU, in copper. The chattiest work, splitting each layer, stays here.` },
    ] : [
      { link: at(3, 'psus'), k: 'The rack', title: 'Every server its own supplies',
        text: `Power strips hand 240 V to each server, and six supplies inside each one make 54 V. Air cools it all: the reference design allows only four servers, about ${Math.round(M.rack.kw)} kW, per rack.` },
    ]),
    // 5 · the tray or server
    { link: at(4, 'vrm'), k: nvl ? 'Compute tray' : 'The server', title: 'The last volt',
      text: `Voltage regulators ring each GPU and make the final step to about 0.8 V: ${coreA} into one chip. They lose ${mw(loss('Voltage regulators'))} across the campus doing it.` },
    ...(nvl ? [] : [
      { link: at(4, 'nvswitch', 'data'), k: 'Data · the server', title: 'Eight GPUs, one machine',
        text: 'NVLink ties eight GPUs together on one board through four NVSwitch chips, 900 GB/s each. The domain ends at the server; everything else is network.' },
    ]),
    // 6 · the package, and what comes out of it
    { link: at(5, 'dies'), k: 'GPU package', title: `${pct(M.gpuSiliconMW, M.meterMW)} reaches the silicon`,
      text: `Of ${meter} at the meter, ${mw(M.gpuSiliconMW)} ends up in the GPU dies themselves. The rest went to conversion, cooling, memory, CPUs and the network. Both shares end up as heat.` },
    { link: at(5, 'hbm', 'data'), k: 'Data · GPU package', title: 'Memory sets the pace',
      text: `${A.hbm.type} feeds each GPU at ${A.hbm.tbs} TB/s. Writing a reply means reading the model's weights for every token, so serving speed follows memory bandwidth more than raw math.` },
    { link: at(5, 'tokens'), sim: 'inference', k: 'Tokens', title: `${big(t.rate)} tokens a second`,
      text: `At the utilization set below, the campus writes about ${big(t.rate)} tokens a second, ${big(3.6e6 / t.j)} per kilowatt-hour including its share of training. Change the scenario and the tour retells itself.` },
  ];
}

// ---------- a watt ----------
export function watt(M) {
  const rows = M.ledger, meter = M.meterMW, nvl = M.accel.gpusPerRack === 72, dc = M.power.id === 'dc800';
  const share = pre => rows.filter(r => pre.some(p => r.label.startsWith(p))).reduce((a, r) => a + r.mw, 0) / meter;
  let left = 1;
  const take = f => { left -= f; return `${w3(left)} W left`; };
  const pct = f => `${w3(f)} W`;   // watts, not mW: the display font is uppercase and would turn mW into MW
  const grid = share(['Main power', 'Campus cables']);
  const room = share(dc ? ['Unit substations', 'Solid-state', '800 V DC'] : ['Unit substations', 'UPS', 'Busway']);
  const cool = share(['Cooling', 'Lighting']);
  const net = share(['Scale-out', 'Optical']);
  const rack = share(['Rack power shelves', 'Server power supplies', 'In-rack', 'Busbar', 'Server power cabling']);
  const nvsw = share(['NVLink switch trays', 'NVSwitch chips']);
  const host = share([M.accel.cpuName, 'SuperNICs', 'NICs', 'SSDs']);
  const board = share(['Bus converters', 'Voltage regulators']);
  const hbm = share([M.accel.hbm.type]);
  return [
    { link: at(0, 'home'), k: 'The meter', title: 'One watt', tally: '1.000 W', text: `Take one watt of the ${mw(meter)} this campus draws and follow it. Every step below takes a slice; the number beside the scene shows what is left for the math.` },
    { link: at(1, 'mpt'), k: 'Grid & campus', title: `${pct(grid)} to the yard`, tally: take(grid), text: 'The main transformers and the campus cables and switchgear warm up a little as the watt passes: the cheapest step there is.' },
    { link: at(1, M.cooling.id === 'warm' ? 'drycoolers' : 'chillers'), k: 'A detour', title: `${pct(cool)} to cooling and the building`, tally: take(cool), text: `Part of every watt never reaches a rack: it runs ${M.cooling.id === 'warm' ? 'dry-cooler fans and pumps' : M.closedLoop ? 'air-cooled chillers and pumps' : 'chillers, towers and pumps'}, lights and controls. That slice is most of the gap between PUE ${M.pue.toFixed(2)} and 1.` },
    { link: at(2, dc ? 'sst' : 'ups'), k: 'Power room', title: `${pct(room)} to the power room`, tally: take(room), text: dc ? 'Solid-state transformers make 800 V DC in one conversion, and the DC bus loses a little more on the way to the rows.' : 'Unit substations, the UPS double conversion and the busway each take their share. The UPS is the big one.' },
    { link: at(2, 'spine', 'data'), k: 'Network', title: `${pct(net)} to the fabric`, tally: take(net), text: 'Switches and optical modules outside the racks, the price of letting every GPU reach every other.' },
    { link: at(3, nvl ? 'shelves' : 'psus'), k: 'The rack', title: `${pct(rack)} to rack power`, tally: take(rack), text: nvl ? `${dc ? 'DC-DC shelves step 800 V down to 50 V' : 'Power shelves turn AC into 50 V DC'}, and the copper busbar warms slightly carrying it.` : 'Each server’s own supplies turn AC into 54 V; the cords lose a little on the way.' },
    { link: nvl ? at(3, 'nvswitch') : at(4, 'nvswitch'), k: 'Scale-up', title: `${pct(nvsw)} to NVLink switches`, tally: take(nvsw), text: 'The switch chips that let the GPUs share memory draw their share before any math happens.' },
    { link: at(4, nvl ? 'grace' : 'cpu'), k: nvl ? 'Compute tray' : 'The server', title: `${pct(host)} to CPUs, NICs and drives`, tally: take(host), text: 'The host side: CPUs, memory, network cards and drives. Necessary, but not the model math.' },
    { link: at(4, 'vrm'), k: 'The last volt', title: `${pct(board)} to converters and regulators`, tally: take(board), text: 'Bus converters and the rings of voltage regulators beside each GPU bring the watt down to under a volt, and lose about a tenth of what passes through.' },
    { link: at(5, 'hbm'), k: 'GPU package', title: `${pct(hbm)} to memory`, tally: take(hbm), text: `${M.accel.hbm.type} stacks beside the dies use their share moving weights in and out.` },
    { link: at(5, 'dies'), k: 'The silicon', title: `${w3(left)} W does the math`, tally: `${w3(left)} W left`, text: `About ${Math.round(left * 100)}% of the watt reaches the transistors that do the arithmetic. It becomes heat there too, a few nanoseconds after it becomes a token.` },
  ];
}

// ---------- a request ----------
export function request(M) {
  const t = tokenFigures(M), nvl = M.accel.gpusPerRack === 72;
  const replyTok = 500, streamTps = 60;               // an interactive reply and a per-user stream rate (illustrative)
  const decodeS = replyTok / streamTps, whReply = t.j * replyTok / 3600;
  let ms = 0;
  const add = v => { ms += v; return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`; };
  return [
    { link: at(0, 'route', 'data'), k: 'Scale across', title: 'A question leaves a phone', tally: add(25), text: 'Your prompt crosses the internet to the nearest region: tens of milliseconds, most of it light in fiber at about 5 µs per kilometer. The ≈25 ms here is illustrative.' },
    { link: at(1, 'fiber', 'data'), k: 'Grid & campus', title: 'In through the fiber vault', tally: add(1), text: 'It enters through one of the two diverse fiber routes, the same way the answer will leave.' },
    { link: at(2, 'dp', 'data'), k: 'Data hall', title: 'Waiting for a seat', tally: add(50), text: 'The hall holds many copies of the model, each on its own GPUs. A scheduler batches your request with others onto one of them; under load the wait can be longer than every network hop combined. 50 ms here is illustrative.' },
    { link: at(3, 'tp', 'data'), k: 'Scale-up', title: 'Every layer, a conversation', tally: add(0), text: `Your copy of the model is split across ${nvl ? 'the GPUs of a rack' : 'the 8 GPUs of a server'}. Inside every layer they swap partial results over NVLink, in well under a microsecond each time, hundreds of times per token.` },
    { link: at(4, 'dpu', 'data'), k: nvl ? 'Compute tray' : 'The server', title: 'The front-end network', tally: add(0.2), text: `The request itself arrives on a separate network, run by DPUs on each ${nvl ? 'tray' : 'server'} and kept apart from the GPU fabric.` },
    { link: at(5, 'hbm', 'data'), k: 'GPU package', title: 'Reading the prompt', tally: add(200), text: `Prefill: all your prompt's tokens go through the model at once, reading the weights from ${M.accel.hbm.type}. For a long prompt this takes a few hundred milliseconds, the time to the first word.` },
    { link: at(5, 'tokens'), sim: 'inference', k: 'Tokens', title: `${replyTok} tokens, one at a time`, tally: add(decodeS * 1000), text: `Decode: each new token reads the weights again. At ${streamTps} tokens a second for your stream (illustrative), a ${replyTok}-token answer takes about ${decodeS.toFixed(1)} s. It costs about ${whReply < 1 ? whReply.toFixed(2) : whReply.toFixed(1)} Wh at this campus, cooling and training share included.` },
    { link: at(5, 'tokens', 'data'), k: 'Out', title: 'The answer streams back', tally: add(25), text: `Words leave as they are written, a few bytes each, back out the way the question came in. In all: about ${(ms / 1000).toFixed(1)} s and ${whReply < 1 ? whReply.toFixed(2) : whReply.toFixed(1)} Wh, about ${(whReply / 1000 * M.wue * 1000).toFixed(1)} mL of water on site.` },
  ];
}

// ---------- the heat ----------
export function heat(M) {
  const nvl = M.accel.gpusPerRack === 72, warm = M.cooling.id === 'warm', air = M.cooling.id === 'air';
  const T = (nvl ? (warm ? [70, 55, 52, 45, 35] : [65, 40, 38, 30, 35]) : [80, 40, 40, 12, 35]);
  const W = Math.round(M.accel.gpuW);
  return [
    { link: at(5, 'junction', 'heat'), k: 'The die', title: `${W} W in a few square centimeters`, tally: `≈${T[0]} °C`, text: `Every watt the GPU takes becomes heat in the silicon, ${Math.round(M.accel.gpuW * (1 - M.accel.hbmShare) / (M.accel.dies > 1 ? 16 : 8.14))} W per square centimeter on average.` },
    { link: at(5, 'tim', 'heat'), k: 'The first hop', title: 'Through the lid', tally: `≈${T[0] - 8} °C`, text: 'Thermal interface material carries it into the lid, then into the metal above. Each layer costs a few degrees.' },
    nvl
      ? { link: at(4, 'coldplates', 'heat'), k: 'Compute tray', title: 'Into water', tally: `≈${T[1]} °C coolant`, text: 'A copper cold plate with fine fins hands the heat to coolant, which leaves the tray a few degrees warmer for every chip it passes.' }
      : { link: at(4, 'heatsinks', 'heat'), k: 'The server', title: 'Into air', tally: `≈${T[1]} °C air`, text: 'A tall heat sink spreads it through fins, and the server fans sweep it out the back.' },
    nvl
      ? { link: at(3, 'manifold', 'heat'), k: 'The rack', title: 'Down the manifold', tally: `≈${T[1]} °C`, text: `The rack's return manifold gathers about ${Math.round(M.rack.kw * (air ? 0 : M.accel.liquidShare))} kW of heat from every tray.` }
      : { link: at(3, 'rearair', 'heat'), k: 'The rack', title: 'Into the hot aisle', tally: `≈${T[1]} °C`, text: `All ${Math.round(M.rack.kw)} kW of the rack leaves as hot air into a sealed aisle.` },
    air
      ? { link: at(2, 'inrow', 'heat'), k: 'Data hall', title: 'Air to water', tally: `≈${T[3]} °C water in`, text: 'In-row cooling units pull the hot air through coils of chilled water and send it back cold.' }
      : { link: at(2, 'cdu', 'heat'), k: 'Data hall', title: 'Loop to loop', tally: `≈${T[2]} °C facility water`, text: 'A coolant distribution unit passes the heat from the rack loop into facility water through a plate heat exchanger, without mixing them.' },
    { link: at(2, 'riser', 'heat'), k: 'Data hall', title: 'Up and out', tally: `≈${T[2]} °C`, text: `Insulated headers carry it out of the building to the ${warm ? 'roof' : 'chiller plant'}.` },
    warm
      ? { link: at(1, 'drycoolers', 'heat'), k: 'Grid & campus', title: 'Into the air', tally: `${T[4]} °C day`, text: 'Dry coolers push it into outside air with fans alone, as long as the air is cooler than the water. On the hottest afternoons sprays help, and cost water.' }
      : { link: at(1, 'chillers', 'heat'), k: 'Grid & campus', title: 'Pumped uphill', tally: `≈${T[3]} °C made`, text: M.closedLoop ? 'Air-cooled chillers spend electricity to move the heat from cold water into outside air, adding their own heat to the pile.' : 'Chillers spend electricity to move the heat from cold water into warmer tower water, adding their own heat to the pile.' },
    { link: at(1, 'plume', 'heat'), sim: 'hotday', k: 'The sky', title: 'Gone', tally: `${T[4]} °C outside`, text: `${warm ? 'Warm air rises off the roofs' : M.closedLoop ? 'Warm air rises off the chillers’ fans' : 'Warm, wet air rises off the cooling towers'}. The campus is a ${mw(M.meterMW)} heater that happened to write tokens on the way.` },
  ];
}

// ---------- every part in a layer, one level at a time ----------
// Each level opens on its establishing shot with the layer's intro (the overview: no part, so no number), then stops at
// every part with its card, in list order, so the part steps run 1 to N like the pins.
// Power runs level 1 to 6, the way it flows; heat runs 6 to 1, from the die out to the sky; data runs 1 to 6.
// Parts a scene variant does not draw (an air-cooled hall has no CDU) are skipped by the player at run time.
const LAYER = { power: ['PARTS', 'intro', 'Power'], data: ['PARTS_DATA', 'dataIntro', 'Data'], heat: ['PARTS_HEAT', 'heatIntro', 'Heat'] };
export const OUTWARD = new Set(['heat']);
/** @param {any} M @param {'power'|'data'|'heat'} mode @param {number|null} [only] one level (0-5), or all six */
export function layer(M, mode, only = null) {
  const C = content(M), [key, introKey, name] = LAYER[mode], out = [];
  const levels = C.SCENES.map((sc, i) => [sc, i]).filter(([, i]) => only === null || i === only);
  if (OUTWARD.has(mode)) levels.reverse();
  levels.forEach(([sc, i]) => {
    const parts = C[key][sc.id] || [];
    out.push({ link: { scene: i, mode, part: null }, k: `${name} · level ${i + 1} of 6 · overview`, title: sc.title, text: sc[introKey], tally: `Level ${i + 1} of 6`, level: true });
    parts.forEach((p, j) => out.push({
      link: { scene: i, mode, part: p.id }, k: `Level ${i + 1} · ${sc.title}`, title: p.title, text: p.body,
      specs: p.specs.slice(0, 3), tally: `Level ${i + 1} · ${j + 1} of ${parts.length}`,
    }));
  });
  return out;
}
// in, out, in: each layer starts on the level the one before it ended on
export const everything = M => ['power', 'heat', 'data'].flatMap(m => layer(M, m));
// A tour that ends while playing hands on to the next in its group. Each starts where the last one ended, or one
// level away, except the request, which has to start at a phone again.
export const CHAIN = { Tours: ['story', 'heat', 'watt', 'request'], 'Every part': ['all-power', 'all-heat', 'all-data'] };
