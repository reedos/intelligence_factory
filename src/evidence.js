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
  'ledger-stage-loss': { title: 'Ledger loss row', how: 'Loss = the power flowing into this stage × (1 − its assumed or published efficiency).', inputs: ['MW reaching the stage', 'the stage’s assumed or published efficiency'] },
  'ledger-conv-loss': { title: 'Ledger conversion-loss row', how: 'Loss = the downstream load this stage feeds ÷ its assumed efficiency, minus that load itself.', inputs: ['downstream load the stage feeds', 'the stage’s assumed efficiency'] },
  'ledger-overhead-frac': { title: 'Ledger cooling/lighting overhead row', how: 'MW = the IT load × an assumed share of it, picked so the design lands in the cooling class’s published PUE band.', inputs: ['IT load', 'assumed overhead fraction for this cooling class'] },
  'ledger-fabric-power': { title: 'Ledger network-power row', how: 'MW = a published or estimated per-unit power (per switch or per optical module) × how many units this campus’s fabric needs for its GPU count.', inputs: ['per-unit power', 'switch or module count from the fabric model'] },
  'ledger-rack-share': { title: 'Ledger per-rack-component row', how: 'MW = a published or estimated power budget for this component in one rack × the number of racks the site’s power buys.', inputs: ['per-rack power for the component', 'racks built'] },
  'ledger-remainder': { title: 'Unallocated ledger row', how: 'MW = the meter figure, minus every other ledger row, minus the GPU-silicon figure. Building a whole number of racks always leaves a sliver of the meter’s IT budget short of one more rack; this row is that rounding remainder, not a separate piece of equipment.', inputs: ['meter MW', 'every other ledger row', 'GPU-silicon MW'] },
  'bom-racks-from-power': { title: 'Racks built', how: 'Racks = the IT-power budget ÷ (one rack’s kW + its share of the scale-out fabric’s per-GPU power), rounded down to a whole rack.', inputs: ['IT MW', 'one rack’s kW', 'fabric power per GPU'] },
  'bom-facility-count': { title: 'Grid, campus and building inventory counts', how: 'Count = the meter MW (and, for cooling equipment, the IT load and cooling choice) ÷ the catalog unit size this site’s model assumes for that piece of equipment, with N+1 or N+20% margin where the card notes it.', inputs: ['meter MW or IT MW', 'assumed catalog unit size', 'redundancy margin'] },
  'bom-rack-count': { title: 'Rack and server counts', how: 'Count = the racks (or servers, or per-rack part multiples) the model’s power-and-fabric solve builds for this scenario.', inputs: ['racks built', 'parts per rack'] },
  'bom-silicon-count': { title: 'Silicon counts', how: 'Count = GPUs (or CPUs, HBM stacks, VRM phases) × the fixed number of that part per GPU or per rack that this accelerator’s bill of materials uses.', inputs: ['GPUs or racks built', 'parts per GPU or per rack'] },
  'bom-network-count': { title: 'Network inventory counts', how: 'Count = the fabric model’s switch, module or fiber count for this many GPUs at this NIC speed (leaf + spine + core switches, GPU- and switch-side modules, links × fibers per link).', inputs: ['GPUs built', 'the fabric’s per-tier port and fiber counts'] },
  'hall-unitsub-current': { title: 'Hall unit-substation secondary current', how: 'Current = 2.5 MVA ÷ (√3 × 480 V); the rating is already apparent power, so no separate power-factor term applies.', inputs: ['unit substation rating'] },
  'hall-busway-current': { title: 'Hall busway per-rack current', how: 'AC case: current = rack kW ÷ (√3 × 415 V × assumed power factor). DC case: current = rack kW ÷ 800 V.', inputs: ['rack kW', 'assumed power factor (AC only)'] },
  'hall-liquid-air-split': { title: 'Hall rack liquid/air heat split', how: 'Split the rack total by the accelerator’s liquid-cooled heat share, this site’s estimate since vendors publish a rack-level figure, not a fixed engineering constant.', inputs: ['rack kW', 'liquid-cooled share for this accelerator/cooling combination'] },
  'hall-air-heat-share': { title: 'Hall air-side heat share', how: 'Air share = 1 − the liquid-cooled share used for the rack’s liquid/air split above.', inputs: ['liquid-cooled share'] },
  'hall-fiber-housings': { title: 'Fiber housings for the campus fabric', how: 'Housings = total fabric strands ÷ fibers per housing (four EDGE8 1U housings’ worth, 4 × 144 fibers, per 4U enclosure).', inputs: ['fabric strands', 'fibers per housing'] },
  'hall-module-count': { title: 'Optical modules per GPU', how: 'Modules per GPU = the fabric’s total optical-module count (GPU-side plus switch-side) ÷ GPUs built.', inputs: ['module count', 'GPUs built'] },
  'hall-crosshall-strands': { title: 'Strands crossing to other halls', how: 'Half of this campus’s spine-to-core links are modeled as crossing between halls; strands = (GPUs ÷ 2) × fibers per link.', inputs: ['GPUs built', 'fibers per link'] },
  'hall-rack-power': { title: 'Rack power, built bottom-up', how: 'kW = GPU package power + CPU power + scale-up switching + NICs/DPUs + drives/fans/management, run up through the assumed 12 V and core-voltage conversion efficiencies, then divided by the rack’s AC/DC or DC/DC input-stage efficiency.', inputs: ['accelerator’s published GPU/CPU power', 'assumed per-rack scale-up/NIC/other power', 'assumed conversion efficiencies down the chain'] },


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


  // ---- traced 09/27/2026: level 3, the data hall, the ledger and the inventory ----
  'unitsub-mva': { title: 'Unit substation size', value: '2.5 MVA', why: 'A catalog size in the 2.5–3 MVA class commonly used for 34.5 kV → 480 V campus distribution (industry trade coverage, not one standard); the model picks the round 2.5 MVA point and sizes N+ units from it.' },
  'mpt-eff-99.6': { title: 'Main power transformer efficiency', value: '99.6%', why: 'A round point inside the 99.5–99.7% range trade and manufacturer sources converge on for large (>100 MVA) power transformers; no single standards body publishes one required efficiency percentage for this class.' },
  'ups-module-mw': { title: 'UPS module size', value: '1.25 MW modeled', why: 'The model divides IT load into 1.25 MW UPS modules. Real double-conversion modules of this class run 1.25–1.8 MW per cabinet (e.g. Eaton’s 9395XR at up to 1.5–1.8 MW); 1.25 MW is a round illustrative unit, not one product’s rating.' },
  'ups-eff-96.5': { title: 'UPS double-conversion efficiency', value: '96.5%', why: 'A conservative point within the 96–97.5% online-mode range reported for this UPS class (Eaton’s 9395XR is tested to 97.5% online, up to 99% in eco/ESS mode); the model uses online mode at a slightly lower figure to leave margin.' },
  'sst-eff-98': { title: 'Solid-state transformer efficiency', value: '>98%', why: 'Navitas’s own figure for its 800 V DC power stage for NVIDIA’s next-generation rack platform; SSTs for 2027-era racks are not yet a shipping, independently benchmarked product, so this is carried as a vendor claim, not a checked spec.' },
  'busway-eff-99.5': { title: 'Busway and whip loss', value: '0.5%', why: 'A small, unpublished resistive-loss allowance for the overhead busway and rack tap-off whips; no vendor publishes a busway efficiency figure at this level of the chain.' },
  'campus-cable-eff-99.7': { title: 'Campus cable & switchgear efficiency', value: '99.7%', why: 'An assumed loss allowance for the 34.5 kV feeders and switchgear between the main transformers and the halls; cable/switchgear loss at this length and voltage is small and not separately published by a single source.' },
  'dcbus-battery-eff': { title: '800 V DC bus and battery efficiency', value: '99.7% bus, 99.8% battery float', why: 'Small assumed conduction/float losses for the DC bus and the batteries sitting on it; NVIDIA’s 800 V HVDC material describes the architecture but does not publish a bus- or battery-loss percentage.' },
  'rack-dcdc-eff-98.5': { title: 'In-rack DC-DC efficiency, 800 V → 50 V', value: '98.5% peak', why: 'Navitas’s own peak-efficiency figure for its 800 V DC rack power stage, carried as a vendor claim since this conversion stage is not yet a shipping, independently benchmarked product.' },
  'cooling-overhead-frac': { title: 'Cooling and lighting overhead, share of IT load', value: 'air 42%, liquid 13%, warm-water 8%; lighting/controls/offices 1.7%', why: 'These shares are picked, not measured, so the fully-built design lands in each cooling class’s reported PUE band (air ≈1.5, chilled liquid 1.10–1.20, warm water 1.05–1.15) once the power chain’s own conversion losses are added on top. Google’s own fleet PUE (1.09 TTM) anchors the low end of that band.' },
  'rack-component-power': { title: 'Per-rack component power budgets (scale-up switching, NICs/DPUs, CPUs, drives/fans/management)', value: 'from each accelerator’s own table', why: 'Chipmakers publish GPU, package and rack-level power, but not a line-item watts figure for NVSwitch/NVLink-switch trays, NICs/DPUs, CPUs or drives/fans/management individually; the model apportions a plausible share of the published rack total to each, checked against the published rack range in engine.test.ts.' },
  'unitsub-cooling-side-eff-99': { title: 'Unit substation efficiency (cooling/building side)', value: '≈99%', why: 'A round, conservative figure inside the loss reductions DOE’s 2024 distribution-transformer rule targets for this equipment class; no single spec sheet states one efficiency percentage for a 2.5 MVA 34.5 kV → 480 V unit substation.' },
  'hall-batt-runtime': { title: 'Hall battery runtime', value: '≈5 minutes', why: 'Set by how many battery strings are installed, not a fixed design rule; five minutes is comfortably more than the generators need to pick up load (about ten seconds to start, under a minute to carry it).' },
  'hall-water-rise-10c': { title: 'Facility/rack water temperature rise', value: '≈10 °C', why: 'A representative supply-to-return delta for the loop; the real number depends on flow rate and load, which this model does not simulate hydraulically.' },
  'hall-cdu-approach': { title: 'CDU approach temperature, facility to rack loop', value: 'a few °C', why: 'A typical plate-heat-exchanger approach; the exact figure depends on the specific CDU and its flow rates, which this model does not size.' },
  'hall-standard-practice': { title: 'Standard switchgear, battery and busway design practice', value: 'automatic utility/generator transfer; Li-ion (LFP or NMC) UPS batteries; tap-off busway', why: 'Near-universal data-center design practice rather than a scenario-specific figure -- included for context, not computed by the model or unique to one vendor.' },
  'sst-module-mw': { title: 'Solid-state transformer module size', value: '≈2.5 MW modeled', why: 'A round illustrative module size for a product class (800 V DC solid-state transformers for 2027-era racks) that is not yet shipping in a fixed catalog size; chosen to match the unit substation size this design already uses elsewhere.' },
  'cdu-module-mw': { title: 'Coolant distribution unit size', value: '≈1.25 MW modeled', why: 'A round point inside the 70 kW – 2.3 MW range vendors such as Vertiv and Motivair sell CDUs in; the model uses 1.25 MW as its illustrative per-unit size, not one product’s exact rating.' },
  'inrow-capacity': { title: 'In-row cooling unit capacity', value: '≈60–100 kW each', why: 'A representative capacity band for row-based CRAH/in-row air-cooling units at this density; the model does not tie the count to one named product’s datasheet.' },
  'water-supply-temp': { title: 'Facility/chilled water supply temperature', value: '12–20 °C (chiller-made) or 45 °C (warm-water)', why: 'A design point for each cooling class picked to sit inside ASHRAE’s liquid-cooling water classes; the warm-water figure follows NVIDIA’s own warm-water rack guidance, the chiller-made figures are this site’s own choice since chiller plants are sized case by case.' },
  'rubin-prelaunch-power': { title: 'Rubin-generation published rack power range', value: '170–230 kW, as announced', why: 'Vera Rubin NVL72 has not shipped; the range comes from pre-launch NVIDIA materials and trade coverage of announced specifications, not a released product datasheet, so it is carried as an assumption rather than a checked spec.' },
  'rubin-prelaunch-specs': { title: 'Rubin-generation NIC and NVLink figures', value: '1.6 Tb/s ConnectX-9 SuperNIC per GPU, NVLink 6', why: 'Vera Rubin has not shipped; NVIDIA has announced these figures ahead of launch, so they are carried as an assumption rather than a checked spec until a shipping datasheet confirms them.' },
  'hall-illustrative-layout': { title: 'Pipeline-stage layout drawn on the hall floor', value: 'illustrative', why: 'The site draws one plausible way to lay four pipeline stages across four racks; real deployments place stages however the cluster’s job scheduler and topology dictate, not necessarily one stage per physical rack.' },
  'rail-optimized-1hop': { title: 'Rail-optimized fabric hop count', value: '1 hop, same rail', why: 'A property of the rail-optimized leaf-and-spine topology this site draws (GPU port n in every rack lands on the same leaf switch), not a measured figure for one campus.' },
  'ib-switch-hop-latency': { title: 'InfiniBand switch hop latency', value: 'under ≈100 ns', why: 'NVIDIA does not publish a per-hop switching-latency figure for its InfiniBand switches; this is a commonly cited order-of-magnitude for cut-through ASIC switching, not a datasheet number.' },
  'fibers-per-link': { title: 'Fibers per fabric link', value: '8 (400G/800G tier) or 16 (1.6T tier)', why: 'Set by how many single-mode strands a parallel optical module of that generation lights (an 8-channel DR8-class module, or a wider design at 1.6T); the model’s own fabric table, not a single named product’s spec.' },
  '1.6t-module-power': { title: '1.6T optical module power', value: '≈25–30 W', why: '1.6T-class modules (e.g. InnoLight, Coherent 1.6T-DR8) are still a ramping product generation; vendor datasheets for this exact class were not opened in this pass, so the figure is carried as an estimate extrapolated from the 800G-class module’s published power.' },


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
