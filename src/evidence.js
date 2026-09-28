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


  // ---- traced 09/27/2026: level 3, the data hall, the ledger and the inventory ----


  // ---- traced 09/27/2026: levels 4 and 5, the rack and the compute tray ----


  // ---- traced 09/27/2026: level 6, the GPU package, and the links ladder ----
  'copper-wall-chart': { title: 'The copper-wall chart', how: 'Each bar plots the reach figure cited for that PAM4 lane rate in the media ladder above (a ratified IEEE clause, a draft objective, or "not yet defined"); the dashed line marks the ≈7 m band where trade sources put the general copper/optics crossover, any lane rate.', inputs: ['each lane rate’s cited reach', 'the crossover estimate'] },

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


  // ---- traced 09/27/2026: level 3, the data hall, the ledger and the inventory ----


  // ---- traced 09/27/2026: levels 4 and 5, the rack and the compute tray ----


  // ---- traced 09/27/2026: level 6, the GPU package, and the links ladder ----
  'throttle-point': { title: 'GPU throttle temperature', value: '≈85 °C', why: 'NVIDIA does not publish a junction throttle point for these data-center GPUs; ≈85 °C is the commonly used ballpark for silicon of this class, shown only to place the die’s working temperature relative to it.' },
  'thermal-stack-layers': { title: 'Layers between die and coolant', value: 'die → thermal interface → lid → thermal interface → cold plate or heat sink', why: 'A generic description of the heat path common to data-center GPU packages; the exact materials and layer count are proprietary to each vendor and cooling design.' },
  'hbm-power-share': { title: 'HBM’s share of GPU package power', value: '≈8–15%', why: 'No chipmaker publishes a per-generation split of package power between the compute die and the HBM stacks; this range is the rough order of magnitude used across component-power discussions of GPUs in this class, and it should move with HBM generation and stack count.' },
  'token-byte-size': { title: 'Bytes per output token, text', value: 'a few bytes', why: 'A token ID is 2–4 bytes as the model emits it, or a few characters (≈4 bytes in UTF-8) once decoded to text; either way the network payload per token is tiny next to the compute behind it, which is the point the card makes.' },
  'rubin-packaging': { title: 'Rubin packaging technology', value: 'TSMC CoWoS-L (carried over)', why: 'NVIDIA has not stated Rubin’s packaging technology; this carries forward CoWoS-L, which trade analysis (Tom’s Hardware) reports TSMC uses for Blackwell’s two-die package, pending Rubin’s own teardown.' },
  'rubin-die-area': { title: 'Rubin die area', value: '≈16 cm² total, two dies (carried over)', why: 'NVIDIA has not published Rubin’s die size. The figure shown carries forward the reticle-limited two-die total trade press reported for Blackwell, pending an independent teardown of Rubin.' },
  'rubin-nvhbi-bandwidth': { title: 'Rubin NV-HBI die-to-die bandwidth', value: '10 TB/s (carried over)', why: 'NVIDIA confirms Rubin’s two dies are joined by NV-HBI but has not published its bandwidth. The figure shown carries forward Blackwell’s confirmed 10 TB/s, pending Rubin’s own datasheet.' },
  'rubin-package-power': { title: 'Rubin GPU package power', value: '≈1,800 W', why: 'NVIDIA has not published a per-GPU TDP for Rubin. 1,800 W is the figure shown at NVIDIA’s own early Vera Rubin materials; trade press (Tom’s Hardware) has since reported the shipping figure may run higher, up to 2,300 W, so this is treated as an early, not a final, number.' },
  'hbm-thermal-limit-other-gens': { title: 'HBM operating-temperature limit, other generations', value: '≈105 °C', why: 'Micron publishes 0–105 °C specifically for HBM3E (GB200/GB300’s memory). H100’s HBM3 and Rubin’s HBM4 do not have a confirmed public limit, so the same figure is carried over as a reasonable proxy for stacked DRAM of this class.' },

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
