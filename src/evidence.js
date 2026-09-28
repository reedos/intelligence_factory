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
  'tray-power': { title: 'Compute tray power', how: 'NVL72: tray power = (rack DC-bus power − NVLink scale-up power − busbar loss) ÷ 18 trays. DGX H100: tray power = rack power ÷ 4 servers.', inputs: ['rack DC-bus power (or rack power)', 'NVLink scale-up power per rack', 'busbar loss', 'trays or servers per rack'] },
  'tray-clip-current': { title: 'Tray busbar-clip current', how: 'Current = tray power ÷ 50 V busbar voltage.', inputs: ['tray power', 'busbar voltage'] },
  'shelf-loss': { title: 'Power-shelf or server-PSU loss per rack', how: 'Loss = power reaching the busbar or server rail × (1 ÷ conversion efficiency − 1).', inputs: ['power reaching the busbar or rail', 'shelf or PSU conversion efficiency'] },
  'conversion-loss-campus': { title: 'Bus-converter or voltage-regulator loss, campus-wide', how: 'Per-rack loss = power passing through the stage × (1 ÷ assumed stage efficiency − 1); the campus figure sums this across every rack the scenario builds.', inputs: ['power through the stage per rack', 'assumed stage efficiency', 'racks in the scenario'] },
  'count-per-rack': { title: 'Count per rack, from the count per server', how: 'Count per rack = the published count per server (power cords per supply, or scale-out ports per NIC) × 4 servers per rack.', inputs: ['published count per server', 'servers per rack (4)'] },
  'hbm-per-gpu': { title: 'Per-GPU HBM capacity, NVL72', how: 'Per-GPU capacity = NVIDIA’s published rack-wide HBM total ÷ 72 GPUs. This is usable capacity as NVIDIA states it for the rack; the 8-stack, 24 GB/stack nominal figure vendors also cite (192 GB for GB200, 288 GB for GB300) is a few percent higher, likely raw die capacity before ECC/redundancy reservation — the two are not reconciled here.', inputs: ['NVIDIA’s published rack HBM total', 'GPUs per rack (72)'] },

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


  // ---- traced 09/27/2026: levels 4 and 5, the rack and the compute tray ----
  'ibc-efficiency': { title: 'Bus-converter (IBC) efficiency', value: '97–98%', why: 'Neither NVIDIA nor the shelf/tray vendors publish a board-level efficiency figure for the fixed-ratio 50 V→12 V (or 54 V→12 V) bus-converter bricks. 97–98% is the range power-semiconductor vendors describe in general terms for this class of unregulated converter; it is not a disclosed number for a named accelerator board.' },
  'vrm-efficiency': { title: 'Voltage-regulator (VRM) efficiency', value: '90–92%', why: 'NVIDIA does not publish board-level VRM efficiency for these racks. The value is a mid-range estimate for a multiphase buck converter stepping 12 V down to under a volt at over a thousand amps, based on the general ranges power-delivery vendors (Infineon, Vicor, MPS) describe for this class of design, not a disclosed figure for a named board.' },
  'vrm-phases': { title: 'VRM phases per GPU', value: '≈20–30', why: 'Vendors describe multiphase GPU power delivery only in relative terms ("up to 12 phases" per module, stackable) and do not publish a phase count for a named accelerator board. 20–30 phases is a plausible total for a ~1.2–1.8 kW rail split across several parallel converter modules at typical per-phase currents for this class of design.' },
  'dual-feed-redundancy': { title: 'Two power feeds into a rack (A/B)', value: 'A + B tap-offs', why: 'Feeding every rack from two separate busway tap-offs is standard practice for concurrently maintainable (Tier III/IV-style) data center power, not a figure NVIDIA publishes for the DGX H100 reference rack specifically.' },
  'bmc-network-speed': { title: 'Management/BMC network speed', value: '1–10 GbE class', why: 'NVIDIA’s hardware guides describe the rack’s out-of-band management switches (for BMC, sensor and power-control traffic) without stating a link speed; 1–10 GbE is the class commonly used for BMC/IPMI networks industry-wide, far below the fabric that carries model data.' },
  'dgx-h100-fan-count': { title: 'DGX H100 fan count', value: '12', why: 'NVIDIA’s public DGX H100 documentation does not state the chassis fan count. 12 is a reasonable estimate for an 8U air-cooled chassis moving roughly 10 kW of heat, consistent with the airflow the model derives for that heat load.' },
  'dgx-h100-psu-efficiency': { title: 'DGX H100 power-supply efficiency', value: '≈96%', why: 'NVIDIA does not publish a measured efficiency for the DGX H100’s power supplies. Describing them as “80 PLUS Titanium class” implies performance at or above that certification’s 94%-at-50%-load minimum; 96% is a plausible value within that class, not a disclosed NVIDIA figure.' },
  'rubin-gpu-power': { title: 'Rubin GPU package power', value: '≈1,800 W', why: 'NVIDIA has not published a per-GPU power figure for Rubin. 1,800 W continues the generation-over-generation growth pattern (700 W H100 → 1,200 W GB200 → 1,400 W GB300), a plausible design point rather than a disclosed spec.' },
  'rack-water-temps': { title: 'Coolant rise and flow rate across an NVL72 rack', value: '≈10 °C rise; ≈170–195 L/min', why: 'NVIDIA does not publish a single supply/return delta or flow rate for the GB200 NVL72’s coolant loop; the OEM/CDU specification governs the built system. The figures used here are one third party’s reported estimate for the rack’s heat load and a 10 °C design rise, and other integrators’ published CDU flow ranges differ from it.' },
  'air-rack-rise': { title: 'Front-to-back air temperature rise, DGX H100 rack', value: '≈15–20 °C', why: 'NVIDIA does not publish a front-to-back air temperature rise for the DGX H100 reference rack. 15–20 °C is a common design range for air-cooled server racks at this power density, given a cold-aisle supply in the ASHRAE-recommended 18–27 °C band.' },
  'rubin-rack-layout': { title: 'Vera Rubin NVL72 tray layout', value: '18 compute trays (4 GPU + 2 CPU each), 9 NVLink switch trays (2 switch chips each)', why: 'NVIDIA has not published the Vera Rubin NVL72 rack’s internal tray layout. This assumes it mirrors the GB200/GB300 NVL72 layout NVIDIA has published, because Rubin NVL72 keeps the same 72-GPU, rack-scale form factor and the “NVL72” name.' },
  'rubin-full-liquid-cooling': { title: 'Vera Rubin NVL72, fully liquid-cooled', value: 'liquid share = 100%', why: 'NVIDIA has not published a liquid/air heat split for Rubin NVL72. At the power densities Rubin’s own architecture disclosure implies, this site assumes every heat-generating part (including switch trays and power shelves) is on a cold plate, continuing the trend from GB200 (≈87% liquid) to GB300 (≈90%) rather than a disclosed figure.' },
  'rubin-c2c-lpddr': { title: 'Vera CPU-to-GPU link and LPDDR5X capacity', value: '1.8 TB/s NVLink-C2C; up to 1.5 TB LPDDR5X per CPU', why: 'NVIDIA has not published Vera’s CPU-to-GPU NVLink-C2C bandwidth or per-CPU LPDDR5X capacity. This carries forward Grace’s published GB200/GB300 figures as a placeholder pending NVIDIA’s own numbers for Vera.' },
  'rubin-hbm-capacity': { title: 'Rubin GPU HBM4 capacity and bandwidth', value: '288 GB, 22 TB/s', why: 'NVIDIA’s Rubin platform announcement details transistor count and compute performance but not per-GPU HBM4 capacity or bandwidth. This carries forward GB300’s HBM capacity as a placeholder and estimates bandwidth from Micron’s published HBM4 per-stack rate (>2.8 TB/s) × 8 stacks, not a disclosed NVIDIA figure.' },
  // adversarial pass 09/28/2026 (L45): two claims cited a source that supports a nearby but different figure,
  // not the exact one shown — requalified from 'reported'/'spec' to 'assumed' rather than kept as stated.
  'gb200-shelf-count': { title: 'GB200/Rubin NVL72 AC power-shelf count', value: '6', why: 'NVIDIA’s DGX GB200 hardware guide says only that the rack uses “multiple power shelves,” with no count. The “8 power shelves of 33 kW” figure NVIDIA does publish is stated on the GB300 NVL72 reference-architecture page specifically, not for GB200 or Rubin. 6 shelves — Flex’s 33 kW shelf unit deployed six times — is assumed here for GB200 and Rubin, not a disclosed count for those racks.' },
  'grace-gpu-c2c-bandwidth': { title: 'Grace-to-GPU NVLink-C2C bandwidth, GB200/GB300', value: '900 GB/s', why: 'NVIDIA’s Grace CPU page states 900 GB/s for the Grace-to-Grace link inside the CPU-only Grace Superchip, a different pairing than the Grace-to-GPU link this row describes. NVIDIA’s Grace Hopper Superchip page states the same 900 GB/s for its Grace-to-Hopper (CPU-to-GPU) link, one generation earlier. No GB200/GB300-specific NVIDIA page was found stating the Grace-to-Blackwell figure directly, so this assumes NVLink-C2C bandwidth is unchanged across those three pairings of the same interconnect generation.' },

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
