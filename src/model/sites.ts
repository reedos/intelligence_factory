// Real campuses and state grid carbon, for presets and the map. Sources: research/scenario-sources.md, sections E and F.
// A preset sets the four scenario choices to the closest match; every choice the owner has not disclosed says so.
import type { Scenario, Basis } from './engine';

export type SiteId = 'abilene' | 'colossus1' | 'colossus2' | 'fairwater-atl' | 'fairwater-wi' | 'hyperion';

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
  '19': { name: 'Iowa', abbr: 'IA', lb: 699, g: 317 },
  '36': { name: 'New York', abbr: 'NY', lb: 537, g: 244 },
};
export const US_CARBON_G = 373;   // EPA eGRID 2022 national output rate, 823 lb/MWh

export interface Site {
  id: SiteId; name: string; owner: string; place: string; lat: number; lon: number; state: string;
  scenario: Omit<Scenario, 'site'>;
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
    id: 'colossus1', name: 'xAI Colossus 1', owner: 'xAI', place: 'Memphis, TN', lat: 35.05, lon: -90.06, state: '47',
    scenario: { meterMW: 300, accel: 'h100', power: 'ac415', cooling: 'air' },
    carbonG: 365, carbonNote: 'Tennessee, 804 lb/MWh (EIA 2024). On-site gas turbines supplied part of the power, which this figure does not capture.',
    facts: [['GPUs, reported', '≈200,000 (H100, H200, some GB200)', 'typical'], ['Phase 2 power', '≈300 MW', 'typical'], ['Grid supply', 'MLGW/TVA, ≈150 MW', 'typical'], ['On-site generation', '35 gas turbines, 420 MW rated', 'typical'], ['Batteries', 'Tesla Megapacks, up to ≈150 MW', 'typical']],
    unknowns: ['This page models H100 as air-cooled, NVIDIA’s reference design; the sources here do not say how Colossus 1 cools its racks.', 'The H200 and GB200 share of the fleet is not modeled.'],
    sources: ['compute-atlas-colossus', 'wikipedia-colossus', 'tomshardware-colossus', 'dcd-xai-colossus-memphis'],
    status: { state: 'operating', live: '150 MW from the grid, plus turbines', asOf: '09/23/2026', source: 'compute-atlas-colossus',
      line: 'Fully built, about 200,000 GPUs, and leased in full to Anthropic since 05/06/2026. The confirmed grid supply is still 150 MW; TVA approved 300 MW in 02/2026.' },
  },
  colossus2: {
    id: 'colossus2', name: 'xAI Colossus 2', owner: 'xAI', place: 'Memphis, TN', lat: 35.02, lon: -90.05, state: '47',
    scenario: { meterMW: 1100, accel: 'gb300', power: 'ac415', cooling: 'liquid' },
    carbonG: 365, carbonNote: 'Tennessee, 804 lb/MWh (EIA 2024). Gas turbines across the state line in Southaven, MS, are meant to carry much of the load.',
    facts: [['IT power running, satellite estimate', '≈946 MW', 'est'], ['Chips, satellite count', '≈440,000: 110k GB200, 330k GB300', 'est'], ['Chips, xAI, 09/25/2026', '≈550,000 installed', 'typical'], ['Cooling plant, Aug 2025', '119 air-cooled chillers, ≈200 MW', 'typical'], ['First plan', '≈1 GW, 350,000 GPUs, now passed', 'typical']],
    unknowns: ['Meter power is estimated from the ≈946 MW IT figure at a PUE near 1.15.', 'Three quarters of the chips are GB300, so GB300 racks are modeled throughout.', 'Liquid-cooled racks on an air-cooled chiller plant is inferred, not confirmed.'],
    sources: ['epoch-dc-colossus2', 'epoch-largest-dc', 'semianalysis-xai-colossus2', 'wikipedia-colossus'],
    status: { state: 'partial', live: '≈946 MW IT', asOf: '09/24/2026', source: 'epoch-dc-colossus2',
      rank: 'The most powerful AI data center operating today, by IT power and by compute (Epoch AI, 09/24/2026). Amazon and Anthropic’s New Carlisle campus is next at about 910 MW, with more chips but less compute.',
      line: 'Live and still growing: about 946 MW of IT power and 440,000 Nvidia chips by satellite count, already past its original 1 GW, 350,000-GPU plan. xAI says about 550,000 chips were installed by 09/25/2026.' },
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
};

// one pin per place on the map (Colossus 1 and 2 are 3 km apart)
export const PLACES = [
  { ids: ['abilene'], name: 'Stargate Abilene' },
  { ids: ['colossus1', 'colossus2'], name: 'xAI Colossus' },
  { ids: ['fairwater-atl'], name: 'Fairwater Atlanta' },
  { ids: ['fairwater-wi'], name: 'Fairwater Wisconsin' },
  { ids: ['hyperion'], name: 'Meta Hyperion' },
].map(p => ({ ...p, site: SITES[p.ids[0] as SiteId] }));
export const placeKey = (p: { ids: string[] }) => `site-${p.ids[0]}`;

// the default campus, when no site is chosen: a generic location in central Ohio's data-center cluster
export const DEFAULT_PLACE = { name: 'This campus', lat: 40.08, lon: -82.81, state: '39' };

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
