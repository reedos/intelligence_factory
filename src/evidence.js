// What backs each figure the site shows, one claim at a time.
//
// A claim is a figure the page shows beside a basis chip: a row on a 3D card, a ledger row, an inventory row, a rung of
// the links ladder, a note under a clock chart, a fact about a real campus. Its basis says what kind of statement it
// is; its evidence says what supports it.
//
//   spec      Published spec. The maker or a standards body states it for the named product or standard.
//   vendor    Vendor claim. A vendor's own comparison or performance figure, attributed to it, with the baseline it
//             is compared against. Not checked independently here.
//   reported  Published report. Stated by a named third party: a government agency, a researcher, an analyst or the
//             trade press.
//   derived   Calculated here. This site's model computes it from the scenario and cited inputs; CALCS says how.
//   assumed   Assumption. A value the model chooses where no single published figure applies; ASSUMPTIONS says why.
//
// Evidence rides with the claim: the last element of a [label, value, basis, ..., ev] row, or an `ev` field on an
// object row. Its forms:
//   spec, vendor, reported   { refs: [[sourceId, 'where in the source: section, table, page or figure'], ...] }
//                            a vendor claim also carries vs: 'what it is compared against'
//   derived                  { calc: 'calc-id' }       (optionally refs too, for the published inputs)
//   assumed                  { assume: 'assumption-id' }
// A spec must cite at least one primary source (the maker, the standards body, the agency that publishes the data).
// Sources live in src/sources.js with the date each was published (when it says) and the date it was checked.

export const BASIS = {
  spec: { label: 'Published spec', short: 'Spec', meaning: 'The maker or a standards body publishes this figure for the named product or standard.' },
  vendor: { label: 'Vendor claim', short: 'Vendor', meaning: 'The vendor’s own comparison or performance figure, attributed to it. The site has not checked it independently.' },
  reported: { label: 'Published report', short: 'Reported', meaning: 'Stated by a named third party: a government agency, a researcher, an analyst or the trade press.' },
  derived: { label: 'Calculated here', short: 'Calc.', meaning: 'Calculated by this site’s model from the scenario and the figures it cites. The method page shows how.' },
  assumed: { label: 'Assumption', short: 'Assumed', meaning: 'A value the model chooses where no single published figure applies. The method page says why.' },
  // the labels every figure carried before claims were traced one by one; none may remain once they are (STRICT)
  typical: { label: 'Industry typical', short: 'Typical', meaning: 'Not yet traced to a specific source for this figure.', legacy: true },
  est: { label: 'Estimate', short: 'Est.', meaning: 'Not yet traced to a calculation or an assumption.', legacy: true },
};
export const CITED = new Set(['spec', 'vendor', 'reported']);

// Until every claim is traced, a claim may still carry a legacy label and no evidence; STRICT makes that a test failure.
export const STRICT = false;

// the evidence carried by a claim row, wherever it sits
export function evOf(row) {
  if (Array.isArray(row)) { const last = row[row.length - 1]; return last && typeof last === 'object' && !Array.isArray(last) && (last.refs || last.calc || last.assume) ? last : null; }
  return row?.ev || null;
}

// ---------- how the model calculates ----------
// id: { title, how } in plain words and a formula a reader can check; `inputs` names what feeds it. The method page
// lists them; a derived claim's popover shows its one.
export const CALCS = {
  // ---- foundation: the few estimates the site already explained, one sentence each ----
  'line-current': { title: 'Transmission line current', how: 'Per-phase current = campus MW ÷ (√3 × 345 kV × power factor).', inputs: ['campus MW at the meter', 'assumed power factor'] },
  'fuel-tankers': { title: 'Fuel deliveries', how: 'Tanker count = 48-hour fuel volume ÷ 30,000 L per truckload.', inputs: ['generator fuel burn', 'assumed truckload'] },
  'unit-sub-current': { title: 'Unit substation secondary current', how: 'Current = 2.5 MVA ÷ (√3 × 480 V); apparent power already includes the power factor.', inputs: ['unit substation rating'] },
  'busway-current': { title: 'Per-rack busway current', how: 'Current = rack kW ÷ (√3 × 415 V × power factor).', inputs: ['rack kW', 'assumed power factor'] },
  'rack-liquid-split': { title: 'Liquid and air heat per rack', how: 'Split the rack total by the liquid-cooled share published for this rack.', inputs: ['rack kW', 'published liquid share'] },
  'busbar-current': { title: 'Rack busbar current', how: 'Current = rack DC bus power ÷ busbar voltage.', inputs: ['rack DC bus power', 'busbar voltage'] },
  'core-current': { title: 'GPU core current', how: 'Current = GPU power less its HBM share ÷ assumed core voltage.', inputs: ['GPU power', 'HBM share', 'assumed core voltage'] },
  'heat-flux': { title: 'Average heat flux through the die', how: 'Flux = GPU power less its HBM share ÷ die area. Hot spots run well above this average.', inputs: ['GPU power', 'HBM share', 'die area'] },
  'fan-airflow': { title: 'Fan airflow', how: 'Airflow from Q = ṁ · cp · ΔT: rack heat carried by air, air density and specific heat, at the stated temperature rise.', inputs: ['air-cooled heat', 'assumed temperature rise'] },
  // ---- level workstreams add theirs below, each in its own block ----

  // ---- traced 09/27/2026: level 1, Scale across, and the real campuses ----


  // ---- traced 09/27/2026: level 2, Grid & campus, and the clock notes ----
  'campus-transformer-count': { title: 'Main transformer count', how: 'Count = ceil(campus MW ÷ transformer unit rating) + 1 spare (N+1); the model buys 300 MVA units above 400 MW and 75 MVA units below.', inputs: ['campus MW at the meter', 'transformer unit rating class'] },
  'campus-transformer-loss': { title: 'Main transformer loss', how: 'Loss = campus MW × (1 − main-transformer efficiency).', inputs: ['campus MW at the meter', "the transformers' published efficiency"] },
  'campus-feeder-count': { title: '34.5 kV feeder count', how: 'Feeders = max(2, ceil(campus MW ÷ 10 MW per feeder)).', inputs: ['campus MW at the meter', 'assumed 10 MW per feeder'] },
  'campus-cable-loss': { title: 'Campus cable & switchgear loss', how: 'Loss = campus MW × main-transformer efficiency × (1 − cable-and-switchgear efficiency).', inputs: ['campus MW at the meter', 'assumed cable & switchgear efficiency'] },
  'campus-genset-count': { title: 'Generator count', how: 'Units = ceil(campus MW ÷ 3 MW × 1.2) for N+20% redundancy on 3 MW-class sets.', inputs: ['campus MW at the meter', 'genset unit class'] },
  'campus-fuel-volume': { title: 'Bulk fuel volume', how: 'Volume = campus MW × 48 h × 0.26 L/kWh (the gensets’ published full-load fuel rate), shown in million liters.', inputs: ['campus MW at the meter', "the gensets' published fuel rate"] },
  'campus-bess-size': { title: 'Battery energy storage sizing', how: 'Power = 0.2 × campus MW; energy = 0.4 × campus MW (a 2-hour duration at that power) — a round sizing this model picks to show scale, not a vendor design.', inputs: ['campus MW at the meter', 'assumed BESS sizing fraction'] },
  'campus-unitsub-count': { title: 'Unit substation count', how: 'Count = ceil(campus MW × 0.97 ÷ 2.2 MW per 2.5 MVA unit at typical loading).', inputs: ['campus MW at the meter', 'unit substation rating class'] },
  'it-load-pue': { title: 'IT load and PUE', how: 'IT MW solves meter MW × upstream efficiency = IT MW ÷ IT-path efficiency + (cooling fraction + misc fraction) × IT MW ÷ side-path efficiency, chaining the model’s own conversion efficiencies; PUE = meter MW ÷ IT MW.', inputs: ['campus MW at the meter', 'the chain of conversion efficiencies', 'the cooling design’s power fraction'] },
  'campus-rack-count': { title: 'Rack count', how: 'Racks = floor(IT MW × 1000 ÷ (one rack’s kW + its GPUs’ share of the fabric’s kW)).', inputs: ['IT MW', 'rack power', 'network power per GPU'] },
  'campus-gpu-count': { title: 'GPU count', how: 'GPUs = racks × GPUs per rack.', inputs: ['rack count', 'GPUs per rack'] },
  'campus-hall-count': { title: 'Hall count', how: 'Halls = max(1, ceil(IT MW ÷ 45 MW per hall)).', inputs: ['IT MW', 'assumed IT capacity per hall'] },
  'campus-cooling-power': { title: 'Cooling power', how: 'Cooling power = coolFrac × IT MW, where coolFrac is calibrated so each cooling design lands in its publicly reported PUE band once the power chain’s own losses are added.', inputs: ['IT MW', "the cooling design's calibrated power fraction"] },
  'campus-chiller-count': { title: 'Chiller count', how: 'Chillers = ceil(IT MW × 1.1 ÷ 4 MW per chiller, a ≈1,100-ton class unit).', inputs: ['IT MW', 'chiller unit class'] },
  'campus-drycooler-count': { title: 'Dry cooler count', how: 'Units = ceil(IT MW × 1.1 ÷ 0.8 MW per dry-cooler unit).', inputs: ['IT MW', 'dry-cooler unit class'] },
  'campus-heat-rejected': { title: 'Heat rejected by the cooling plant', how: 'Heat rejected ≈ IT MW × 1.05, adding back the plant’s own electrical overhead as heat.', inputs: ['IT MW'] },
  'campus-tower-count': { title: 'Cooling tower count', how: 'Towers = warm-water design: ceil(IT MW ÷ 16 MW per tower); air/liquid design: ceil(IT MW × 1.3 ÷ 6 MW per tower).', inputs: ['IT MW', 'tower unit class'] },
  'campus-tower-use': { title: 'When the towers run', how: 'Follows the design: air/liquid designs run cooling towers year-round; warm-water designs default to dry coolers and only add tower water once outdoor air crosses the adiabatic threshold.', inputs: ['cooling design', 'adiabatic threshold, 35 °C'] },
  'campus-water-per-day': { title: 'Water per day', how: 'Water = WUE (L/kWh IT) × IT MW × 24 h, converted to cubic meters.', inputs: ['WUE for this design', 'IT MW'] },
  'campus-heat-out': { title: 'Heat leaving the campus', how: 'Heat out ≈ meter MW: energy conservation means virtually every watt drawn eventually becomes heat.', inputs: ['campus MW at the meter'] },
  'fiber-light-speed': { title: 'Light speed in fiber', how: 'One-way delay per km = 1 ÷ (speed of light ÷ assumed fiber refractive index), ≈ 4.9 µs/km.', inputs: ['speed of light', 'assumed fiber refractive index, n≈1.47'] },
  'campus-crosshall-fibers': { title: 'Hall-to-hall fiber strands', how: 'Cross-hall strands = half the campus’s GPUs × fibers per scale-out link (one non-blocking link per GPU).', inputs: ['GPU count', 'fabric fibers-per-link'] },
  'training-swing-share': { title: 'Training swing size', how: 'GPU share of the meter = GPU MW ÷ meter MW; swing size = GPU MW × (1 − the model’s low-power floor between steps). Site- and rack-battery ratings are read from this model’s own BESS and rack-storage sizing.', inputs: ["the rack build's GPU share", 'meter MW', "the model's low-power floor between steps"] },
  'hotday-cooling-response': { title: 'Hot-day cooling response', how: 'Chiller-based cooling power scales as clamp(1 + 0.025 × (T − 25 °C), 0.7, 1.6), ≈ 2.5%/°C above 25 °C; warm-water designs hold the loop with dry coolers alone until the adiabatic threshold (35 °C), then draw water.', inputs: ['outdoor temperature over the day', 'assumed chiller efficiency slope', 'adiabatic threshold, 35 °C'] },

  // ---- traced 09/27/2026: level 3, the data hall, the ledger and the inventory ----


  // ---- traced 09/27/2026: levels 4 and 5, the rack and the compute tray ----


  // ---- traced 09/27/2026: level 6, the GPU package, and the links ladder ----


  // ---- traced 09/27/2026: the glossary, the method page and prose claims ----


};

// ---------- what the model assumes ----------
// id: { title, value, why } — why this value, and what would change it. The method page lists them.
export const ASSUMPTIONS = {
  'power-factor': { title: 'Power factor', value: '0.95', why: 'A common design value for large facility loads; the real figure depends on the equipment and its correction.' },
  'fuel-truckload': { title: 'Fuel truckload', value: '30,000 L', why: 'A typical road tanker; used only to show the scale of refueling.' },
  'core-voltage': { title: 'GPU core voltage', value: '≈0.8 V', why: 'Chipmakers do not publish core voltages for these parts; 0.7–0.9 V is the usual range for this class of process.' },
  // ---- level workstreams add theirs below, each in its own block ----

  // ---- traced 09/27/2026: level 1, Scale across, and the real campuses ----


  // ---- traced 09/27/2026: level 2, Grid & campus, and the clock notes ----
  'campus-interconnect-voltage': { title: 'Campus interconnection voltage', value: '345 kV', why: 'This model fixes every campus’s transmission interconnection at 345 kV so the voltage staircase reads the same at every size. Real gigawatt campuses (Stargate Abilene) use this class too, but the largest ones need 500 kV or extra circuits instead, which this design does not switch to.' },
  'substation-layout': { title: 'Substation breaker count and yard size', value: '6 dead-tank SF₆ breakers, ring bus, ≈200×150 m pad', why: 'Illustrative of a typical major transmission substation. This campus’s actual breaker count and footprint depend on the utility’s own design and are not published for a generic site.' },
  'bess-sizing': { title: 'Battery energy storage sizing fraction', value: '0.2× campus MW power, 0.4× campus MW energy (2 h)', why: 'No published rule ties campus battery size to campus MW; this model picks a round, illustrative fraction to show scale, not a specific vendor design.' },
  'hall-it-capacity': { title: 'IT load per data hall', value: '45 MW', why: 'A round figure representing a large modern hall; real halls vary with design and run both smaller and considerably larger.' },
  'cooling-power-fraction': { title: 'Cooling power fraction of IT load', value: 'air 0.42, liquid 0.13, warm water 0.08', why: 'Calibrated so each cooling design, once the power chain’s own losses are added, lands in its publicly reported PUE band (air ≈1.5, liquid with chillers 1.10–1.20, warm water 1.05–1.15), not read off one specific facility.' },
  'wue-by-cooling': { title: 'Water use by cooling design', value: 'air 1.0, liquid 0.5, warm water 0.16 L/kWh IT', why: 'Illustrative figures chosen to fall within the water-use ranges reported for each cooling approach (near-zero for closed-loop liquid, higher for evaporative towers), not a single published number for this design.' },
  'fiber-refractive-index': { title: 'Fiber refractive index', value: 'n ≈ 1.47', why: 'Typical single-mode telecom fiber; the exact figure varies slightly by fiber type and is not published for an illustrative route.' },
  'ductbank-layout': { title: 'Duct-bank layout', value: '4-inch conduits, one cable per conduit, a spare row', why: 'Standard telecom civil-construction practice, not a specification for this particular campus; no published layout exists for an illustrative site.' },
  'outage-timeline': { title: 'Outage scenario timing', value: 'chiller restart ≈2 min, outage 15 min, grid-stable wait 5 min', why: 'Illustrative numbers chosen to show the shape of a recovery, not a published incident or a specific utility’s reconnection policy.' },
  'hotday-slope': { title: 'Hot-day cooling response slope', value: 'chiller ≈2.5%/°C above 25 °C; dry-cooler/adiabatic curve fit to the adiabatic threshold', why: 'No public dry-cooler or chiller derating curve was found for this exact design; the model picks a plausible slope to show the shape of the day, not a measured curve.' },
  'inference-daily-shape': { title: 'Inference day peak-to-trough ratio and idle/peak power', value: '2.5× peak:trough; idle GPUs at 30% of full power; busiest hour at 90%', why: 'No provider publishes a peak-to-trough demand ratio or an idle-power fraction for a production GPU fleet; these are illustrative choices consistent with general utilization discussions, not measured figures for a specific service.' },

  // ---- traced 09/27/2026: level 3, the data hall, the ledger and the inventory ----


  // ---- traced 09/27/2026: levels 4 and 5, the rack and the compute tray ----


  // ---- traced 09/27/2026: level 6, the GPU package, and the links ladder ----


  // ---- traced 09/27/2026: the glossary, the method page and prose claims ----


};

// the basis chip for one claim: a button that opens that claim's evidence (src/app/sources-ui.js)
const attr = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export const chip = (basis, key, label = '') => { const b = BASIS[basis] || BASIS.est;
  return `<button type="button" class="chip ${basis}" data-src="${attr(key)}" aria-expanded="false" aria-label="${attr(`${b.label}${label ? ` for ${String(label).replace(/<[^>]+>/g, '')}` : ''}: what backs it`)}">${b.short}</button>`; };

// what is wrong with one claim's evidence, as sentences (empty when it holds up)
export function problems(claim, SOURCES, strict = STRICT) {
  const out = [], { basis, ev } = claim, b = BASIS[basis];
  if (!b) return [`unknown basis ${basis}`];
  if (b.legacy) { if (strict) out.push(`still labeled ${basis}`); return out; }
  if (!ev) return strict ? [`no evidence for a ${basis} claim`] : [];   // not yet traced one by one
  if (CITED.has(basis)) {
    if (!ev.refs?.length) out.push('cites no source');
    if (basis === 'vendor' && !ev.vs) out.push('vendor claim without its baseline');
  }
  if (basis === 'derived' && !CALCS[ev.calc]) out.push(`unknown calculation ${ev.calc}`);
  if (basis === 'assumed' && !ASSUMPTIONS[ev.assume]) out.push(`unknown assumption ${ev.assume}`);
  for (const ref of ev.refs || []) {
    const [id, at] = ref, s = SOURCES[id];
    if (!s) { out.push(`unknown source ${id}`); continue; }
    if (!at || !String(at).trim()) out.push(`${id}: no location in the source`);
    if (!s.accessed) out.push(`${id}: never checked (no access date)`);
    if (!s.kind) out.push(`${id}: not marked primary or secondary`);
  }
  if (basis === 'spec' && ev.refs?.length && !ev.refs.some(([id]) => SOURCES[id]?.kind === 'primary')) out.push('a spec with no primary source');
  return out;
}
