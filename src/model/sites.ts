// Real campuses and state grid carbon, for presets and the map. Sources: research/scenario-sources.md, sections E and F.
// A preset sets the four scenario choices to the closest match; every choice the owner has not disclosed says so.
import type { Scenario, Basis, AccelId } from './engine';

export type SiteId = 'abilene' | 'colossus1' | 'colossus2' | 'fairwater-atl' | 'fairwater-wi' | 'hyperion' | 'rainier' | 'prometheus';

// EIA State Electricity Profiles, 2024 data (released 11/10/2025); g/kWh = lb/MWh × 0.4536
export const STATE_CARBON: Record<string, { name: string; abbr: string; lb: number; g: number }> = {
  '48': { name: 'Texas', abbr: 'TX', lb: 823, g: 373 },
  '47': { name: 'Tennessee', abbr: 'TN', lb: 804, g: 365 },
  '13': { name: 'Georgia', abbr: 'GA', lb: 672, g: 305 },
  '55': { name: 'Wisconsin', abbr: 'WI', lb: 1090, g: 494 },
  '22': { name: 'Louisiana', abbr: 'LA', lb: 927, g: 420 },
  '51': { name: 'Virginia', abbr: 'VA', lb: 631, g: 286 },
  '41': { name: 'Oregon', abbr: 'OR', lb: 352, g: 160 },
  '53': { name: 'Washington', abbr: 'WA', lb: 249, g: 113 },
  '04': { name: 'Arizona', abbr: 'AZ', lb: 634, g: 288 },
  '39': { name: 'Ohio', abbr: 'OH', lb: 1005, g: 456 },
  '18': { name: 'Indiana', abbr: 'IN', lb: 1393, g: 632 },
  '19': { name: 'Iowa', abbr: 'IA', lb: 699, g: 317 },
  '36': { name: 'New York', abbr: 'NY', lb: 537, g: 244 },
};
export const US_CARBON_G = 373;   // EPA eGRID 2022 national output rate, 823 lb/MWh

// What a real campus's operator publishes about its own plant, where it differs from the model's generic campus:
// battery backup instead of diesel generators, a published battery size, a closed cooling loop that evaporates no water.
export interface Plant { backup?: 'battery'; bessMWh?: number; closedLoop?: boolean }
// What an operator says a campus runs, by date: each stage's GPUs by accelerator. The model sizes the campus from
// these counts (racks, then IT load, then meter) instead of from a meter figure; later stages are stated plans.
export interface FleetStage { label: string; when: string; note: string; parts: { accel: AccelId; gpus: number }[] }
export interface Site {
  id: SiteId; name: string; owner: string; place: string; lat: number; lon: number; state: string;
  scenario: Omit<Scenario, 'site'>;
  plant?: Plant;
  fleet?: FleetStage[];
  carbonG: number; carbonNote: string;
  facts: [string, string, Basis][];
  unknowns: string[];               // what the preset had to assume
  sources: string[];                // ids in src/sources.js
  status: Status;
}
// Where a campus stands today. Checked 09/27/2026 against Epoch AI's satellite-based Frontier Data Centers tracker
// (updated 09/24/2026) and the newest reporting; live figures are IT power, not total facility draw.
export type StatusState = 'operating' | 'partial' | 'building' | 'planned';
export interface Status { state: StatusState; line: string; live: string; asOf: string; source: string; rank?: string }
export const STATUS_WORD: Record<StatusState, string> = { operating: 'Operating', partial: 'Partly live', building: 'Under construction', planned: 'Planned' };

export const SITES: Record<SiteId, Site> = {
  abilene: {
    id: 'abilene', name: 'Stargate Abilene', owner: 'OpenAI, Oracle, Crusoe, SoftBank', place: 'Abilene, TX', lat: 32.45, lon: -99.75, state: '48',
    scenario: { meterMW: 500, accel: 'gb200', power: 'ac415', cooling: 'liquid' },
    carbonG: 335, carbonNote: 'ERCOT subregion, 738 lb/MWh (EPA eGRID). The Texas state figure is 373 g/kWh; the site sits inside ERCOT.',
    facts: [['IT power operating, buildings 1–4 of 8', '≈421 MW', 'typical'], ['Planned', 'more than 1 GW', 'typical'], ['Grid', 'double 345 kV corridor, new Oncor substation', 'typical'], ['On-site generation', 'none disclosed', 'typical']],
    unknowns: ['Meter power is estimated from the 421 MW IT figure at a PUE near 1.2.', 'The accelerator split per building is not disclosed; GB200-class is assumed.', 'The cooling design is not disclosed; chilled liquid is assumed.'],
    sources: ['epoch-dc-abilene', 'epoch-stargate-abilene'],
    status: { state: 'partial', live: '≈421 MW IT', asOf: '09/24/2026', source: 'epoch-dc-abilene',
      line: 'Buildings 1–4 of 8 are live, about 421 MW of IT power. Buildings 5–8 are roofed and being fitted out; the full campus is due between Q4 2026 and Q1 2027.' },
  },
  colossus1: {
    id: 'colossus1', name: 'SpaceXAI Colossus 1', owner: 'SpaceXAI (formerly xAI)', place: 'Memphis, TN', lat: 35.05, lon: -90.06, state: '47',
    scenario: { meterMW: 300, accel: 'h100', power: 'ac415', cooling: 'air' },
    carbonG: 365, carbonNote: 'Tennessee, 804 lb/MWh (EIA 2024). Temporary gas turbines supplied part of the power, which this figure does not capture; SpaceXAI says all of its remaining temporary turbines must be removed by July 2027.',
    facts: [['GPUs, per Elon Musk, 09/25/2026', '230k: 150k H100, 50k H200, 30k GB200', 'typical'], ['GPUs, reported earlier', '≈200,000 (H100, H200, some GB200)', 'typical'], ['Phase 2 power', '≈300 MW', 'typical'], ['Grid supply', 'MLGW/TVA, ≈150 MW', 'typical'], ['On-site generation, reported', '35 gas turbines, 420 MW rated', 'typical'], ['Batteries, reported', 'Tesla Megapacks, up to ≈150 MW', 'typical'], ['Backup, per SpaceXAI', 'more than 240 batteries, enough to take the site fully off the grid', 'typical'], ['Cooling water, per SpaceXAI', '≈820,000 gal a day, hybrid system', 'typical']],
    unknowns: ['This page models H100 as air-cooled, NVIDIA’s reference design; the sources here do not say how Colossus 1 cools its racks.', 'Elon Musk puts the fleet at 150k H100, 50k H200 and 30k GB200 (09/25/2026). This preset models H100 racks only, sized from the ≈300 MW figure; the H200 and GB200 share is not modeled.', 'SpaceXAI describes batteries, not diesel, as Colossus I’s backup; this preset still draws the model’s generic diesel plant.'],
    sources: ['compute-atlas-colossus', 'wikipedia-colossus', 'tomshardware-colossus', 'dcd-xai-colossus-memphis', 'spacexai-mid-south', 'bi-spacexai-rebrand', 'elonmusk-x-colossus-2026-09-25'],
    status: { state: 'operating', live: '150 MW from the grid, plus turbines', asOf: '09/23/2026', source: 'compute-atlas-colossus',
      line: 'Fully built, about 200,000 GPUs, and leased in full to Anthropic since 05/06/2026. The confirmed grid supply is still 150 MW; TVA approved 300 MW in 02/2026.' },
  },
  colossus2: {
    id: 'colossus2', name: 'SpaceXAI Colossus 2', owner: 'SpaceXAI (formerly xAI)', place: 'Memphis, TN', lat: 35.02, lon: -90.05, state: '47',
    // meterMW is what the model derives for the first stage below; the fleet, not this figure, sizes the campus
    scenario: { meterMW: 1461, accel: 'gb300', power: 'ac415', cooling: 'liquid', stage: 0 },
    // SpaceXAI's Mid-South page (checked 09/27/2026): a 3.3 GWh grid-connected battery pack planned, no diesel
    // mentioned, and closed-loop cooling that takes only domestic water
    plant: { backup: 'battery', bessMWh: 3300, closedLoop: true },
    // Elon Musk on X, 09/25/2026: "Colossus 2 is 110k GB200 and 440k GB300. Another 220k GB300 will be fully operational
    // next week and another 220k in November. If we get lucky, yet another 220k GB300 by late December."
    fleet: [
      { label: 'Now', when: '09/25/2026', note: '110k GB200 + 440k GB300, per Elon Musk', parts: [{ accel: 'gb200', gpus: 110000 }, { accel: 'gb300', gpus: 440000 }] },
      { label: '+220k', when: '“next week” after 09/25/2026', note: 'another 220k GB300, planned', parts: [{ accel: 'gb200', gpus: 110000 }, { accel: 'gb300', gpus: 660000 }] },
      { label: '+440k', when: 'November 2026', note: 'another 220k GB300, planned', parts: [{ accel: 'gb200', gpus: 110000 }, { accel: 'gb300', gpus: 880000 }] },
      { label: '+660k', when: 'late December 2026, “if we get lucky”', note: 'yet another 220k GB300, contingent', parts: [{ accel: 'gb200', gpus: 110000 }, { accel: 'gb300', gpus: 1100000 }] },
    ],
    carbonG: 365, carbonNote: 'Tennessee, 804 lb/MWh (EIA 2024). SpaceXAI says the temporary gas turbines it has run in Tennessee and Mississippi since 08/01/2025, with state authorization, must all be removed by July 2027; it says it is already taking units offline. This figure does not capture them.',
    facts: [
      ['GPUs, per Elon Musk, 09/25/2026', '550k: 110k GB200 + 440k GB300', 'typical'],
      ['Coming, per Elon Musk', '+220k GB300 “next week”, +220k in November, +220k by late December “if we get lucky”', 'typical'],
      ['Why 110k, per Elon Musk', 'the number of fiber optic cables that can plug into a central switch', 'typical'],
      ['IT power running, satellite estimate, 09/24/2026', '≈946 MW', 'est'],
      ['Chips, satellite count, 09/24/2026', '≈440,000: 110k GB200, 330k GB300', 'est'],
      ['GPUs planned, per SpaceXAI', '1M+', 'typical'],
      ['Battery, per SpaceXAI', '3.3 GWh, planned (Riley Trettel to the TVA board, 08/20/2026; TVA approved a direct grid hookup that day)', 'typical'],
      ['Grid, per SpaceXAI', '$55M for two MLGW substations in Memphis, one of them 150 MW (which campus they serve is not said)', 'typical'],
      ['Gas turbines, per SpaceXAI', 'temporary since 08/01/2025; all out by July 2027', 'typical'],
      ['Diesel backup', 'not mentioned by SpaceXAI', 'typical'],
      ['Cooling, per SpaceXAI', 'closed loop, domestic water only', 'typical'],
      ['Cooling plant, Aug 2025', '119 air-cooled chillers, ≈200 MW', 'typical'],
    ],
    unknowns: [
      'GPU counts come from Elon Musk’s post (09/25/2026). The halls, CDUs, cables, token rates and the whole layout are this model’s, sized from those counts, not SpaceXAI’s.',
      'Meter power is this model’s estimate from those counts: each accelerator’s own bottom-up rack power, plus the network, at this design’s PUE. It lands above Epoch AI’s ≈946 MW satellite estimate of IT power from a day earlier, which counted 440,000 chips.',
      'The 3D rack, tray and package show a GB300 NVL72, the chip in four of five GPUs. The 110,000 GB200s are counted in every total at their own rack power, memory and transistor count, not as GB300s.',
      'Stages after Now are what Elon Musk said is coming, not installed hardware; the last is contingent (“if we get lucky”).',
      'Backup is modeled as batteries only, as SpaceXAI describes it, with no diesel. The 3.3 GWh pack is planned and its power rating is not published, so the model assumes it can carry the whole campus; its hours at full load shrink as the fleet grows.',
      'Cooling is modeled as air-cooled chillers on a closed loop, as SpaceXAI describes Colossus II, so the model counts no cooling water; SpaceXAI says the site takes only domestic water.',
    ],
    sources: ['elonmusk-x-colossus-2026-09-25', 'elonmusk-x-110k-switch', 'tomshardware-spacexai-660k', 'epoch-dc-colossus2', 'epoch-largest-dc', 'semianalysis-xai-colossus2', 'wikipedia-colossus', 'spacexai-mid-south', 'canarymedia-xai-battery', 'bi-spacexai-rebrand'],
    status: { state: 'partial', live: '≈946 MW IT', asOf: '09/24/2026', source: 'epoch-dc-colossus2',
      rank: 'The most powerful AI data center operating today, by IT power and by compute (Epoch AI, 09/24/2026). Amazon and Anthropic’s New Carlisle campus is next at about 910 MW, with more chips but less compute.',
      line: 'Live and still growing: about 946 MW of IT power and 440,000 Nvidia chips by satellite count on 09/24/2026. A day later Elon Musk put it at 550,000 GPUs, 110k GB200 and 440k GB300, with 660,000 more GB300s planned by the end of the year.' },
  },
  'fairwater-atl': {
    id: 'fairwater-atl', name: 'Microsoft Fairwater Atlanta', owner: 'Microsoft', place: 'Fayetteville, GA', lat: 33.45, lon: -84.46, state: '13',
    scenario: { meterMW: 740, accel: 'gb300', power: 'ac415', cooling: 'warm' },
    carbonG: 305, carbonNote: 'Georgia, 672 lb/MWh (EIA 2024).',
    facts: [['IT power running, satellite estimate', '≈636 MW, 4 of 9 buildings', 'est'], ['Planned', '≈1.5 GW with a 4-building east campus', 'est'], ['Accelerators', 'GB200 and GB300 NVL72, up to 140 kW per rack', 'typical'], ['Cooling', 'closed-loop liquid, no evaporation', 'spec'], ['Backup power', '"no UPS or gen-sets," one trade report', 'est']],
    unknowns: ['Meter power is estimated from the ≈636 MW IT figure at a PUE near 1.15.', 'The GB200/GB300 split is not disclosed; GB300 is assumed.', 'Closed-loop liquid is modeled as warm water with dry coolers.', 'The "no UPS or generators" report is unconfirmed, so this page keeps both.'],
    sources: ['epoch-dc-fairwater-atl', 'microsoft-infinite-scale', 'dcd-fairwater-atlanta', 'datacenterfrontier-fairwater'],
    status: { state: 'partial', live: '≈636 MW IT', asOf: '09/24/2026', source: 'epoch-dc-fairwater-atl',
      line: '4 of 9 main-campus buildings are live, about 636 MW of IT power. The other five, and a 4-building east campus, are under construction toward about 1.5 GW.' },
  },
  'fairwater-wi': {
    id: 'fairwater-wi', name: 'Microsoft Fairwater Wisconsin', owner: 'Microsoft', place: 'Mount Pleasant, WI', lat: 42.71, lon: -87.88, state: '55',
    scenario: { meterMW: 450, accel: 'gb200', power: 'ac415', cooling: 'warm' },
    carbonG: 494, carbonNote: 'Wisconsin, 1,090 lb/MWh (EIA 2024), the highest of the states on this map.',
    facts: [['Power', '≈450 MW, $3.3B initial', 'typical'], ['Accelerators', 'GB200 NVL72, 800G Ethernet', 'typical'], ['Cooling', 'closed-loop liquid, filled once', 'spec'], ['Opened', '06/23/2026', 'typical']],
    unknowns: ['Later investment rose to $7.3B; no updated power figure was found.', 'On-site generation is not disclosed.'],
    sources: ['epoch-dc-fairwater-wi', 'dcd-fairwater-wisconsin', 'techtimes-fairwater-wisconsin', 'microsoft-ai-wan'],
    status: { state: 'partial', live: '≈369 MW IT', asOf: '09/24/2026', source: 'epoch-dc-fairwater-wi',
      line: 'Building 1 has run since 04/16/2026, about 369 MW of IT power. Building 2 is under construction, due in 2028.' },
  },
  hyperion: {
    id: 'hyperion', name: 'Meta Hyperion', owner: 'Meta', place: 'Richland Parish, LA', lat: 32.47, lon: -91.75, state: '22',
    scenario: { meterMW: 1500, accel: 'gb200', power: 'ac415', cooling: 'warm' },
    carbonG: 420, carbonNote: 'Louisiana, 927 lb/MWh (EIA 2024). Entergy is building 2.23 GW of new gas generation for the site.',
    facts: [['Phase 1', '1.5 GW by late 2027', 'typical'], ['Planned', '5 GW by 2030, more than $50B', 'typical'], ['GPUs, planned', '1.3 million or more', 'typical'], ['New gas generation', '2.23 GW, online by end of 2028', 'typical']],
    unknowns: ['Blackwell is disclosed; a mixed NVIDIA and AMD fleet is reported by one source. GB200 is assumed.', 'The cooling design is not disclosed; warm water is assumed.'],
    sources: ['epoch-dc-hyperion', 'meta-richland-parish', 'cnbc-meta-louisiana', 'led-meta-louisiana'],
    status: { state: 'building', live: 'nothing live yet', asOf: '09/27/2026', source: 'epoch-dc-hyperion',
      line: 'Under construction, with nothing serving yet in the latest satellite imagery (04/2026). Phase 1, 1.5 GW, is due in late 2027; the full 5 GW by 2030–2032.' },
  },
  "rainier": {
    id: "rainier", name: "Amazon Project Rainier", owner: "Amazon Web Services (built for Anthropic)", place: "New Carlisle, IN", lat: 41.7, lon: -86.51, state: "18",
    scenario: { meterMW: 1050, accel: "h100", power: "ac415", cooling: "air" },
    carbonG: 632, carbonNote: "Indiana, 1,393 lb/MWh (EIA 2024), the highest state rate mapped here; the campus's operating power comes entirely from the grid, with on-site diesel generators kept for backup only.",
    facts: [["IT power operating, ~16 of ~30 buildings live", "≈910 MW", "typical"], ["Planned full campus, due ~Q1 2028", "≈1,925 MW (1.9 GW)", "typical"], ["Chips, Oct. 2025 launch vs. 09/2026", "≈500,000 Trainium2 at launch (64-chip UltraServers); ≈1,045,000 by Epoch's 09/24/2026 count", "typical"], ["Grid interconnection", "Indiana Michigan Power (AEP), 345 kV Olive station plus two new substations", "typical"], ["On-site generation", "none for operating power; diesel gensets for backup only", "typical"]],
    unknowns: ["This site's engine models NVIDIA accelerators only; Project Rainier runs AWS's own Trainium2 chips (UltraServers of 64 chips each), which it cannot model, so the closest preset by rack power and cooling is used instead — H100-class, air-cooled, 415 V AC — and its watts-per-chip and per-rack figures are NVIDIA's, not Amazon's real silicon.", "Meter power is estimated from the ≈910 MW IT figure at a PUE near 1.15, the value reported for this chiller-free, air-cooled design.", "The Trainium2-to-Trainium3 mix as later buildings come online is not modeled; all live capacity is treated as one class.", "Building counts vary by source (30 per company figures, up to 32 in Epoch's imagery-based count); this page follows Epoch's 16-of-32-live split."],
    sources: ["epoch-dc-new-carlisle", "eia-state-indiana", "measuredai-new-carlisle", "compute-atlas-rainier", "blackridge-rainier"],
    status: { state: "partial", live: "≈910 MW IT", asOf: "09/24/2026", source: "epoch-dc-new-carlisle",
      line: "About 16 of roughly 30 planned buildings are live: near 910 MW of IT power and about a million Trainium2 chips by Epoch AI’s count. The rest are under construction toward about 1.9 GW, due around Q1 2028." },
  },
  "prometheus": {
    id: "prometheus", name: "Meta Prometheus", owner: "Meta", place: "New Albany, OH", lat: 40.07, lon: -82.76, state: "39",
    scenario: { meterMW: 585, accel: "gb200", power: "ac415", cooling: "liquid" },
    carbonG: 456, carbonNote: "Ohio, 1,005 lb/MWh (EIA 2024). Two off-grid gas plants, Socrates North and South (~400 MW combined), power the campus directly and are not captured by this grid figure.",
    facts: [["IT power operating, Epoch satellite estimate", "≈496 MW", "est"], ["Compute, satellite estimate", "≈600k H100-eq compute; ≈237k Nvidia B200 chips now, B300 to follow", "est"], ["Planned, by Q3 2028", "≈1,022 MW IT power, ≈$38.7B total capital", "est"], ["On-site generation", "Socrates North + South gas plants, ~400 MW, fully off-grid (no PJM interconnection)", "typical"], ["Construction", "12 buildings planned: 5 traditional halls (2.5M sq ft) + 7 tents (1.3M sq ft); first 5 tents (~125k sq ft each) went up in about 3 months, Apr–Jun 2026", "typical"]],
    unknowns: ["Meter power is estimated from the ≈496 MW IT figure at a PUE near 1.15–1.2; the tents' own cooling overhead is not disclosed.", "The live split between GB200-class (\"Catalina\") and GB300-class (\"Clemente\") racks is not disclosed; GB200 is modeled as the larger current share, reading Epoch's \"B200 now, B300 next.\"", "Direct liquid cooling for the NVL72 racks is assumed; the tents' actual thermal design is not confirmed publicly.", "The exact address geocode is not published; coordinates are estimated from the 1500 Beech Road, Licking County parcel to about 0.01 degree.", "Sources disagree on tent numbering and count (five vs. seven named at different times); only 5 of the eventual 7 tents are confirmed complete on the Apr–Jun 2026 schedule, and Epoch's satellite imagery as of 08/2026 still showed later buildings awaiting power hookups."],
    sources: ["epoch-dc-prometheus", "epoch-satellite-prometheus", "mlq-meta-gas-tents", "measuredai-prometheus-primer", "eia-state-ohio", "techcrunch-meta-tents"],
    status: { state: "partial", live: "≈496 MW IT", asOf: "09/24/2026", source: "epoch-dc-prometheus",
      line: "About 496 MW of IT power runs across a patchwork of tents, colocation space, and traditional buildings, roughly half of the ≈1,022 MW Epoch expects by Q3 2028. Two off-grid gas plants, Socrates North and South, feed the campus directly, outside the regional grid." },
  },
};

// one pin per place on the map (Colossus 1 and 2 are 3 km apart)
export const PLACES = [
  { ids: ['abilene'], name: 'Stargate Abilene' },
  { ids: ['colossus1', 'colossus2'], name: 'SpaceXAI Colossus' },
  { ids: ['fairwater-atl'], name: 'Fairwater Atlanta' },
  { ids: ['fairwater-wi'], name: 'Fairwater Wisconsin' },
  { ids: ['hyperion'], name: 'Meta Hyperion' },
  { ids: ['rainier'], name: 'Project Rainier' },
  { ids: ['prometheus'], name: 'Meta Prometheus' },
].map(p => ({ ...p, site: SITES[p.ids[0] as SiteId] }));
export const placeKey = (p: { ids: string[] }) => `site-${p.ids[0]}`;

// the default campus, when no site is chosen: a generic location in southwest Ohio, which keeps the map centered on
// the Midwest campuses (it sat at New Albany until Meta Prometheus, 4 km away, joined the real campuses)
export const DEFAULT_PLACE = { name: 'This campus', lat: 39.3, lon: -84.4, state: '39' };

// Albers equal-area conic for the lower 48 (standard parallels 29.5° and 45.5°), in km
const R = 6371, rad = Math.PI / 180, p1 = 29.5 * rad, p2 = 45.5 * rad, p0 = 37.5 * rad, l0 = -96 * rad;
const n = (Math.sin(p1) + Math.sin(p2)) / 2, C = Math.cos(p1) ** 2 + 2 * n * Math.sin(p1), r0 = R * Math.sqrt(C - 2 * n * Math.sin(p0)) / n;
export function albers(lon: number, lat: number): [number, number] {
  const r = R * Math.sqrt(C - 2 * n * Math.sin(lat * rad)) / n, t = n * (lon * rad - l0);
  return [r * Math.sin(t), r0 - r * Math.cos(t)];   // x east, y north
}
export function greatCircleKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
