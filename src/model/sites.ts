// Real campuses and state grid carbon, for presets and the map. Sources: research/scenario-sources.md, sections E and F.
// A preset sets the four scenario choices to the closest match; every choice the owner has not disclosed says so.
import type { Scenario, Basis, Ev } from './engine';

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
// which src/sources.js id backs each state's row above (all: EIA state electricity profile, "2024 Summary statistics")
export const STATE_EIA_SOURCE: Record<string, string> = {
  '48': 'eia-state-texas', '47': 'eia-state-tennessee', '13': 'eia-state-georgia', '55': 'eia-state-wisconsin',
  '22': 'eia-state-louisiana', '51': 'eia-state-virginia', '41': 'eia-state-oregon', '53': 'eia-state-washington',
  '04': 'eia-state-arizona', '39': 'eia-state-ohio', '18': 'eia-state-indiana', '19': 'eia-state-iowa', '36': 'eia-state-newyork',
};

// What a real campus's operator publishes about its own plant, where it differs from the model's generic campus:
// battery backup instead of diesel generators, a published battery size, a closed cooling loop that evaporates no water.
export interface Plant { backup?: 'battery'; bessMWh?: number; closedLoop?: boolean }
export interface Site {
  id: SiteId; name: string; owner: string; place: string; lat: number; lon: number; state: string;
  scenario: Omit<Scenario, 'site'>;
  plant?: Plant;
  carbonG: number; carbonNote: string;
  facts: ([string, string, Basis] | [string, string, Basis, Ev])[];
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
    facts: [
      ['IT power operating, buildings 1–4 of 8', '≈421 MW', 'reported', { refs: [['epoch-dc-abilene', 'directory entry: "CURRENT IT POWER" 421MW']] }],
      ['Planned', '≈1.2 GW (Epoch, 04/2026 estimate)', 'reported', { refs: [['epoch-stargate-abilene', 'site profile: "Projected capacity: 1.2 GW | 1.0 million H100-equivalents"']] }],
      ['Grid', 'double 345 kV corridor (Midland–Graham), Mulberry Creek substation', 'reported', { refs: [['yesenergy-hyperscale-dc-anatomy', 'body text: "The facility is fed by a double 345 kV corridor that goes from Midland to Graham, Texas," and "a substation next to the facility called Abilene Mulberry Creek"']] }],
      ['On-site generation', 'natural gas reported by Epoch (04/2026); not itemized in the current tracker', 'reported', { refs: [['epoch-stargate-abilene', 'body text: "Power is currently supplied by a mix of on-site natural gas and grid power, which includes local wind power"']] }],
    ],
    unknowns: ['Meter power is estimated from the 421 MW IT figure at a PUE near 1.2.', 'The accelerator split per building is not disclosed; GB200-class is assumed.', 'The cooling design is not disclosed; chilled liquid is assumed.', 'Epoch AI’s newer directory entry (09/24/2026) projects a lower 843 MW for this site than its own 04/2026 Stargate publication (1.2 GW), consistent with reporting that OpenAI redirected some planned Abilene capacity elsewhere; this page keeps the earlier, higher figure as the "Planned" row and flags the disagreement here rather than picking one silently.'],
    sources: ['epoch-dc-abilene', 'epoch-stargate-abilene', 'yesenergy-hyperscale-dc-anatomy'],
    status: { state: 'partial', live: '≈421 MW IT', asOf: '09/24/2026', source: 'epoch-dc-abilene',
      line: 'Buildings 1–4 of 8 are live, about 421 MW of IT power. Buildings 5–8 are roofed and being fitted out; the full campus is due between Q4 2026 and Q1 2027.' },
  },
  colossus1: {
    id: 'colossus1', name: 'SpaceXAI Colossus 1', owner: 'SpaceXAI (formerly xAI)', place: 'Memphis, TN', lat: 35.05, lon: -90.06, state: '47',
    scenario: { meterMW: 300, accel: 'h100', power: 'ac415', cooling: 'air' },
    carbonG: 365, carbonNote: 'Tennessee, 804 lb/MWh (EIA 2024). Temporary gas turbines supplied part of the power, which this figure does not capture; SpaceXAI says all of its remaining temporary turbines must be removed by July 2027.',
    facts: [
      ['GPUs, reported', '≈200,000 (H100, H200, some GB200)', 'reported', { refs: [['tomshardware-colossus', 'headline: "fully operational with 200,000 GPUs"']] }],
      ['Phase 2 power', '≈300 MW', 'reported', { refs: [['tomshardware-colossus', 'headline: "Phase 2 to consume 300 MW"']] }],
      ['Grid supply', 'MLGW/TVA, ≈150 MW', 'reported', { refs: [['interestingengineering-xai-megapack', 'body text: "receiving 150MW of grid power from MLGW and TVA"']] }],
      ['On-site generation', '≈35 gas turbines, ≈422 MW', 'reported', { refs: [['compute-atlas-colossus', 'facility profile: on-site generation "422 MW" via "approximately 35 natural-gas turbines"']] }],
      ['Batteries', 'Tesla Megapacks, ≈150 MW', 'reported', { refs: [['interestingengineering-xai-megapack', 'body text: "150MW of Megapack Batteries for stored energy backup have been integrated"']] }],
      ['Backup, per SpaceXAI', 'more than 240 batteries, enough for the site to come fully off the grid', 'spec', { refs: [['spacexai-mid-south', 'Power tab, "Installing resilient, sustainable backup power": "more than 240 batteries so Colossus I can come completely offline during emergencies or peak demand"']] }],
      ['Cooling water, per SpaceXAI', '≈820,000 gal a day, hybrid system', 'spec', { refs: [['spacexai-mid-south', 'Water tab, "What Colossus uses today": "Colossus I has a hybrid system that uses about 820,000 gallons a day"']] }],
    ],
    unknowns: ['This page models H100 as air-cooled, NVIDIA’s reference design; the sources here do not say how Colossus 1 cools its racks.', 'The H200 and GB200 share of the fleet is not modeled.', 'Sources disagree on Colossus 1’s gas-turbine total (SemiAnalysis reports ≈240 MW for one phase; Compute Atlas reports ≈422 MW site-wide); this page follows Compute Atlas.', 'SpaceXAI describes batteries, not diesel, as Colossus I’s backup; this preset still draws the model’s generic diesel plant.', 'xAI became SpaceXAI in July 2026 (Business Insider, 07/06/2026). This page uses the current name; most sources cited here predate the rebrand and still say "xAI".'],
    sources: ['compute-atlas-colossus', 'wikipedia-colossus', 'tomshardware-colossus', 'dcd-xai-colossus-memphis', 'interestingengineering-xai-megapack', 'spacexai-mid-south', 'bi-spacexai-rebrand'],
    status: { state: 'operating', live: '150 MW from the grid, plus turbines', asOf: '09/23/2026', source: 'compute-atlas-colossus',
      line: 'Fully built, about 200,000 GPUs, and leased in full to Anthropic since 05/06/2026. The confirmed grid supply is still 150 MW; TVA approved 300 MW in 02/2026.' },
  },
  colossus2: {
    id: 'colossus2', name: 'SpaceXAI Colossus 2', owner: 'SpaceXAI (formerly xAI)', place: 'Memphis, TN', lat: 35.02, lon: -90.05, state: '47',
    scenario: { meterMW: 1100, accel: 'gb300', power: 'ac415', cooling: 'liquid' },
    // SpaceXAI's Mid-South page (checked 09/27/2026): a 3.3 GWh grid-connected battery pack planned, no diesel
    // mentioned, and closed-loop cooling that takes only domestic water
    plant: { backup: 'battery', bessMWh: 3300, closedLoop: true },
    carbonG: 365, carbonNote: 'Tennessee, 804 lb/MWh (EIA 2024). This figure does not capture the temporary gas turbines SpaceXAI says it has run in Tennessee and Mississippi since 08/01/2025 with state authorization; it says all of them must be removed by July 2027 and that it is already taking units offline.',
    facts: [
      ['IT power running, satellite estimate', '≈946 MW', 'reported', { refs: [['epoch-dc-colossus2', 'directory entry: "CURRENT IT POWER" 946MW']] }],
      ['Chips, satellite count', '≈440,000: 110k GB200, 330k GB300', 'reported', { refs: [['epoch-dc-colossus2', 'directory entry, hardware table: GB200 "110k", GB300 "330k"']] }],
      ['Chips, the company, 09/25/2026', '≈550,000 installed', 'reported', { refs: [['groundnews-colossus2-550k', 'aggregated wire coverage (~09/25/2026): "110k GB200 and 440k GB300" / "550,000 Nvidia GB200/GB300 chips" currently deployed']] }],
      ['GPUs planned, per SpaceXAI', '1M+', 'spec', { refs: [['spacexai-mid-south', 'Colossus II tab: "GPUs planned 1M+"']] }],
      ['Battery, per SpaceXAI', '3.3 GWh grid-connected pack, planned', 'spec', { refs: [['spacexai-mid-south', 'Colossus II tab, Power: "America’s largest grid-connected battery pack will provide 3.3 gigawatt hours"']] }],
      ['Grid, per SpaceXAI', '$55M for two MLGW substations in Memphis, one of them 150 MW (which campus they serve is not said)', 'spec', { refs: [['spacexai-mid-south', 'Power tab, "SpaceXAI is investing in a stronger electric grid": "$35 million in a 150 MW substation to support MLGW and another $20 million in a second substation"']] }],
      ['Gas turbines, per SpaceXAI', 'temporary units in TN and MS since 08/01/2025; all out by July 2027', 'spec', { refs: [['spacexai-mid-south', 'Air tab: "After temporary turbines started on August 1, 2025"; "all remaining temporary turbines must be removed by July 2027" under an agreed order with the Mississippi DEQ']] }],
      ['Diesel backup', 'not mentioned by SpaceXAI', 'spec', { refs: [['spacexai-mid-south', 'all five tabs (Colossus I, Colossus II, Water, Power, Air), checked 09/27/2026: no diesel generators are mentioned']] }],
      ['Cooling, per SpaceXAI', 'closed loop, domestic water only', 'spec', { refs: [['spacexai-mid-south', 'Water tab, "What Colossus uses today": "Colossus II uses closed-loop cooling and takes only domestic water"']] }],
      ['Cooling plant, Aug 2025', '119 air-cooled chillers, ≈200 MW', 'reported', { refs: [['semianalysis-xai-colossus2', 'body text: "119 air-cooled chillers on site, i.e. roughly 200MW of cooling capacity" as of August 22, 2025']] }],
      ['SemiAnalysis framing, 09/2025', 'titled "First Gigawatt Datacenter"; ≈200 MW of cooling then, ≈946 MW IT now', 'reported', { refs: [['semianalysis-xai-colossus2', 'headline: "xAI’s Colossus 2 — First Gigawatt Datacenter In The World"']] }],
    ],
    unknowns: ['Meter power is estimated from the ≈946 MW IT figure at a PUE near 1.15.', 'Three quarters of the chips are GB300, so GB300 racks are modeled throughout.', 'Backup is modeled as batteries only, since SpaceXAI lists a battery pack and mentions no diesel. The 3.3 GWh pack is planned and its power rating is not published, so the model assumes it can carry the whole campus: about 3 hours at this preset’s ≈1.1 GW, longer on a smaller campus.', 'Cooling is modeled as air-cooled chillers (as SemiAnalysis counted in 08/2025) on a closed loop, as SpaceXAI describes Colossus II, so the model counts no cooling water; SpaceXAI says the site takes only domestic water. Liquid-cooled racks on that plant are inferred from the GB300 design, not confirmed.', 'The company’s own 550,000-chip figure (110k GB200 + 440k GB300) and Epoch’s satellite count (110k GB200 + 330k GB300 = 440,000) disagree on the GB300 share; this page shows both rather than reconciling them.', 'xAI became SpaceXAI in July 2026 (see Colossus 1’s unknowns); most sources cited here still say "xAI".', 'An earlier pass of this page stated the site’s "first plan" was "≈1 GW, ≈350,000 GPUs"; the ≈350,000-GPU figure could not be traced to any source (it is not in the cited SemiAnalysis piece, paywall included) and was dropped rather than kept as an unsupported number.', 'The layout, equipment counts and routes in 3D are this model’s generic campus sized to these figures, not SpaceXAI’s site plan.'],
    sources: ['epoch-dc-colossus2', 'epoch-largest-dc', 'semianalysis-xai-colossus2', 'wikipedia-colossus', 'groundnews-colossus2-550k', 'spacexai-mid-south', 'bi-spacexai-rebrand'],
    status: { state: 'partial', live: '≈946 MW IT', asOf: '09/24/2026', source: 'epoch-dc-colossus2',
      rank: 'The most powerful AI data center operating today, by IT power and by compute (Epoch AI, 09/24/2026). Amazon and Anthropic’s New Carlisle campus is next at about 910 MW, with more chips but less compute.',
      line: 'Live and still growing: about 946 MW of IT power and 440,000 Nvidia chips by satellite count, called the "First Gigawatt Datacenter" by SemiAnalysis back in 09/2025. The company says about 550,000 chips were installed by 09/25/2026.' },
  },
  'fairwater-atl': {
    id: 'fairwater-atl', name: 'Microsoft Fairwater Atlanta', owner: 'Microsoft', place: 'Fayetteville, GA', lat: 33.45, lon: -84.46, state: '13',
    scenario: { meterMW: 740, accel: 'gb300', power: 'ac415', cooling: 'warm' },
    // Microsoft's own post: a closed loop that reuses the liquid "with no evaporation" (see the Cooling fact)
    plant: { closedLoop: true },
    carbonG: 305, carbonNote: 'Georgia, 672 lb/MWh (EIA 2024).',
    facts: [
      ['IT power running, satellite estimate', '≈636 MW, 4 of 9 Main Campus buildings', 'reported', { refs: [['epoch-dc-fairwater-atl', 'directory entry: "CURRENT IT POWER" 636MW; body text on buildings 1–4 live'], ['measuredai-fairwater-atlanta-data-center', 'body text: "The QTS Fayetteville Main Campus comprises nine data center buildings — four operational, five under construction"']] }],
      ['Planned', '≈1.5 GW across all 13 buildings (Fairwater + Main + East Campus)', 'reported', { refs: [['measuredai-fairwater-atlanta-data-center', 'body text: the full QTS Fayetteville campus "designed to eventually reach approximately 1,500 MW across all 13 buildings"']] }],
      ['Accelerators', 'NVIDIA Blackwell NVL72 (GB200/GB300 family), ≈140 kW per rack', 'spec', { refs: [['microsoft-infinite-scale', 'body text: "~140kW per rack, 1,360 kW per row"'], ['measuredai-fairwater-atlanta-data-center', 'body text: "Each NVL72 rack contains 72 NVIDIA Blackwell GPUs... roughly 140 kW of rack power"']] }],
      ['Cooling', 'closed-loop liquid, no evaporation', 'spec', { refs: [['microsoft-infinite-scale', 'body text: a "closed-loop approach that reuses the liquid continuously after the initial fill with no evaporation"'], ['measuredai-fairwater-atlanta-data-center', 'body text: "The cooling loop is filled once and recirculated for the life of the building"']] }],
      ['Backup power', 'no on-site generation, UPS or dual-corded distribution (grid-only design)', 'spec', { refs: [['microsoft-infinite-scale', 'body text: Microsoft can "forgo traditional resiliency approaches for the GPU fleet (such as on-site generation, UPS systems and dual-corded distribution)"'], ['measuredai-fairwater-atlanta-data-center', 'body text: "The Fairwater template strips on-site power generation, UPS systems, and dual-corded distribution out of the buildings’ electrical topology entirely"']] }],
    ],
    unknowns: ['Meter power is estimated from the ≈636 MW IT figure at a PUE near 1.15.', 'The GB200/GB300 split is not disclosed; GB300 is assumed.', 'Closed-loop liquid is modeled as warm water with dry coolers on a closed loop, as Microsoft describes it, so the model counts no cooling water and no hot-day sprays; how the plant rides out the hottest afternoons is not stated in the sources here.', 'Microsoft says the design forgoes on-site generation, UPS systems and dual-corded distribution for the GPU fleet. This preset still runs the model’s generic power chain, with its UPS losses, generators and batteries, so those figures are the generic model’s, not Microsoft’s.'],
    sources: ['epoch-dc-fairwater-atl', 'microsoft-infinite-scale', 'dcd-fairwater-atlanta', 'datacenterfrontier-fairwater', 'measuredai-fairwater-atlanta-data-center'],
    status: { state: 'partial', live: '≈636 MW IT', asOf: '09/24/2026', source: 'epoch-dc-fairwater-atl',
      line: '4 of 9 main-campus buildings are live, about 636 MW of IT power. The rest of the 13 planned buildings, across the main, east and Fairwater campuses, are under construction toward about 1.5 GW.' },
  },
  'fairwater-wi': {
    id: 'fairwater-wi', name: 'Microsoft Fairwater Wisconsin', owner: 'Microsoft', place: 'Mount Pleasant, WI', lat: 42.71, lon: -87.88, state: '55',
    scenario: { meterMW: 450, accel: 'gb200', power: 'ac415', cooling: 'warm' },
    carbonG: 494, carbonNote: 'Wisconsin, 1,090 lb/MWh (EIA 2024), the highest of the states on this map.',
    facts: [
      ['Power', 'Building 1 ≈369 MW live; $3.3B initial investment', 'reported', { refs: [['epoch-dc-fairwater-wi', 'directory entry: "CURRENT IT POWER" 369MW'], ['microsoft-made-in-wisconsin', 'body text: "$3.3 billion investment pledge"']] }],
      ['Accelerators', 'GB200 NVL72 racks (NVLink 5.0 inside), racks linked by 800G Ethernet', 'reported', { refs: [['techtimes-fairwater-wisconsin', 'body text: "NVIDIA’s GB200 NVL72 systems connect 72 Blackwell GPUs through NVLink 5.0"; separately, "connecting the racks is a two-level networking tree built on 800G Ethernet"']] }],
      ['Cooling', 'closed-loop liquid, filled once', 'spec', { refs: [['microsoft-made-in-wisconsin', 'body text: "a state-of-the-art closed-loop liquid cooling system, filled during construction and recirculated continuously"']] }],
      ['Opened', '06/23/2026', 'reported', { refs: [['microsoft-wisconsin-construction-complete', 'headline/dateline: construction completed, announced Tuesday, June 23, 2026']] }],
    ],
    unknowns: ['Later investment rose to $7.3B; no updated power figure was found.', 'On-site generation is not disclosed.', 'Microsoft describes a closed-loop liquid system filled once; the sources here do not say whether heat rejection evaporates any water, so the model’s warm-water design still counts hot-day spray water.', 'Epoch’s tracker shows building 1 at ≈369 MW live against a much larger ≈2,263 MW projected total; no single published figure gives a stable "design capacity" for the site, so this page states the live figure rather than a round ≈450 MW.'],
    sources: ['epoch-dc-fairwater-wi', 'dcd-fairwater-wisconsin', 'techtimes-fairwater-wisconsin', 'microsoft-ai-wan', 'microsoft-made-in-wisconsin', 'microsoft-wisconsin-construction-complete'],
    status: { state: 'partial', live: '≈369 MW IT', asOf: '09/24/2026', source: 'epoch-dc-fairwater-wi',
      line: 'Building 1 has run since 04/16/2026, about 369 MW of IT power. Building 2 is under construction, due in 2028.' },
  },
  hyperion: {
    id: 'hyperion', name: 'Meta Hyperion', owner: 'Meta', place: 'Richland Parish, LA', lat: 32.47, lon: -91.75, state: '22',
    scenario: { meterMW: 1500, accel: 'gb200', power: 'ac415', cooling: 'warm' },
    carbonG: 420, carbonNote: 'Louisiana, 927 lb/MWh (EIA 2024). Entergy is building 2.26 GW of new gas generation for the site.',
    facts: [
      ['Phase 1', '≈2 GW by 2030', 'reported', { refs: [['ieee-spectrum-hyperion', 'body text: "the first phase—a 2-GW version—will be completed by 2030"']] }],
      ['Planned', '5 GW at full build (~2032), more than $50B', 'spec', { refs: [['meta-richland-parish', 'body text: "delivering 5 gigawatts of compute capacity to house Hyperion" and "$50B+ Data center investment"'], ['wikipedia-hyperion-dc', 'body text: "full build-out around 2032"']] }],
      ['GPUs, planned', 'more than 3 million at full build (reporter estimate)', 'reported', { refs: [['ieee-spectrum-hyperion', 'body text: "Hyperion could include over 41,000 rack-scale systems, for a total of more than 3 million GPUs"']] }],
      ['New gas generation', '2.26 GW combined, three turbine plants', 'reported', { refs: [['ieee-spectrum-hyperion', 'body text: Entergy’s "three new gas-turbine power plants... will generate a combined 2.26 GW"'], ['wikipedia-hyperion-dc', 'body text: "Entergy has begun building three gas-powered combined-cycle power plants"']] }],
    ],
    unknowns: ['Blackwell is disclosed; a mixed NVIDIA and AMD fleet is reported by one source. GB200 is assumed.', 'The cooling design is not disclosed; warm water is assumed.', 'Meta’s own published GPU figure ("1.3 million") describes Meta’s company-wide fleet target for 2025, not Hyperion specifically (IEEE Spectrum); this page instead shows Spectrum’s own Hyperion-specific estimate.', 'Entergy has separately said it could produce "at least 3.8 GW" for the deal (Wikipedia); this page uses the more specific 2.26 GW turbine figure IEEE Spectrum reports.'],
    sources: ['epoch-dc-hyperion', 'meta-richland-parish', 'cnbc-meta-louisiana', 'led-meta-louisiana', 'ieee-spectrum-hyperion', 'wikipedia-hyperion-dc'],
    status: { state: 'building', live: 'nothing live yet', asOf: '09/27/2026', source: 'epoch-dc-hyperion',
      line: 'Under construction, with nothing serving yet in the latest satellite imagery (Epoch AI, updated 09/24/2026). The first phase, about 2 GW, is due by 2030; Meta’s full build is 5 GW, expected around 2032.' },
  },
  "rainier": {
    id: "rainier", name: "Amazon Project Rainier", owner: "Amazon Web Services (built for Anthropic)", place: "New Carlisle, IN", lat: 41.7, lon: -86.51, state: "18",
    scenario: { meterMW: 1050, accel: "h100", power: "ac415", cooling: "air" },
    carbonG: 632, carbonNote: "Indiana, 1,393 lb/MWh (EIA 2024), the highest state rate mapped here; the campus's operating power comes entirely from the grid, with on-site diesel generators kept for backup only.",
    facts: [
      ["IT power operating, ~16 of ~30 buildings live", "≈910 MW", "reported", { refs: [["epoch-dc-new-carlisle", 'directory entry: "CURRENT IT POWER" 910MW']] }],
      ["Planned full campus, due ~Q1 2028", "≈1,925 MW (1.9 GW)", "reported", { refs: [["epoch-dc-new-carlisle", 'directory entry: "PROJECTED IT POWER" 1,925MW']] }],
      ["Chips, Oct. 2025 launch vs. 09/2026", "≈500,000 Trainium2 at launch (64-chip UltraServers); ≈1,045,000 by Epoch's 09/24/2026 count", "reported", { refs: [["compute-atlas-rainier", 'facility profile: "Phase 1 online with ~500,000 Trainium2 chips," operational October 2025'], ["epoch-dc-new-carlisle", 'directory entry: current Trainium2 count "1,045k"']] }],
      ["Grid interconnection", "Indiana Michigan Power (AEP), existing Olive 345 kV station", "reported", { refs: [["measuredai-new-carlisle", 'body text: "the campus already adjoined... the Olive 345 kV station" on "a purpose-built 345 kV transmission delivery scheme"'], ["compute-atlas-rainier", 'facility profile: utility "Indiana Michigan Power (AEP)"']] }],
      ["On-site generation", "none for operating power; diesel gensets for backup only", "reported", { refs: [["measuredai-new-carlisle", 'body text: "All operating power comes from the utility grid... The only on-site generation is a diesel fleet held in reserve for emergency backup"']] }],
    ],
    unknowns: ["This site's engine models NVIDIA accelerators only; Project Rainier runs AWS's own Trainium2 chips (UltraServers of 64 chips each), which it cannot model, so the closest preset by rack power and cooling is used instead — H100-class, air-cooled, 415 V AC — and its watts-per-chip and per-rack figures are NVIDIA's, not Amazon's real silicon.", "Meter power is estimated from the ≈910 MW IT figure at a PUE near 1.15, the value reported for this chiller-free, air-cooled design.", "The Trainium2-to-Trainium3 mix as later buildings come online is not modeled; all live capacity is treated as one class.", "Building counts vary by source (30 per company figures, up to 32 in Epoch's imagery-based count, ≈18 per Compute Atlas); this page follows Epoch's 16-of-32-live split."],
    sources: ["epoch-dc-new-carlisle", "eia-state-indiana", "measuredai-new-carlisle", "compute-atlas-rainier", "blackridge-rainier"],
    status: { state: "partial", live: "≈910 MW IT", asOf: "09/24/2026", source: "epoch-dc-new-carlisle",
      line: "About 16 of roughly 30 planned buildings are live: near 910 MW of IT power and about a million Trainium2 chips by Epoch AI’s count. The rest are under construction toward about 1.9 GW, due around Q1 2028." },
  },
  "prometheus": {
    id: "prometheus", name: "Meta Prometheus", owner: "Meta", place: "New Albany, OH", lat: 40.07, lon: -82.76, state: "39",
    scenario: { meterMW: 585, accel: "gb200", power: "ac415", cooling: "liquid" },
    carbonG: 456, carbonNote: "Ohio, 1,005 lb/MWh (EIA 2024). Two off-grid gas plants, Socrates North and South (~400 MW combined), power the campus directly and are not captured by this grid figure.",
    facts: [
      ["IT power operating, Epoch satellite estimate", "≈496 MW", "reported", { refs: [["epoch-dc-prometheus", 'directory entry: "CURRENT IT POWER" 496MW']] }],
      ["Compute, satellite estimate", "≈600k H100-eq compute; ≈237k Nvidia B200 chips now, B300 to follow", "reported", { refs: [["epoch-dc-prometheus", 'directory entry: current chip count "237.4k" B200 delivering "600k H100-equivalents," B300 chips projected next']] }],
      ["Planned, by Q3 2028", "≈1,022 MW IT power, ≈$38.7B total capital", "reported", { refs: [["epoch-dc-prometheus", 'directory entry: "PROJECTED IT POWER" 1,022MW by Q3 2028, with the tracker’s total-capital estimate']] }],
      ["On-site generation", "Socrates North + South gas plants, ≈400 MW, fully off-grid", "reported", { refs: [["mlq-meta-gas-tents", 'body text: "400MW of dedicated, off-grid natural gas generation," split between "the 200MW Socrates South plant" and a "twin 200MW Socrates North facility"']] }],
      ["Construction", "5 tent structures (~125,000 sq ft each) built Apr–Jun 2026, plus traditional colocation buildings", "reported", { refs: [["mlq-meta-gas-tents", 'body text: "Five ~125,000-sq-ft tent structures at its New Albany, Ohio campus between April and June 2026," built in about 3 months versus 18–36 months for traditional halls']] }],
    ],
    unknowns: ["Meter power is estimated from the ≈496 MW IT figure at a PUE near 1.15–1.2; the tents' own cooling overhead is not disclosed.", "The live split between GB200-class (\"Catalina\") and GB300-class (\"Clemente\") racks is not disclosed; GB200 is modeled as the larger current share, reading Epoch's \"B200 now, B300 next.\"", "Direct liquid cooling for the NVL72 racks is assumed; the tents' actual thermal design is not confirmed publicly.", "The exact address geocode is not published; coordinates are estimated from the 1500 Beech Road, Licking County parcel to about 0.01 degree.", "Sources disagree on tent count (TechCrunch reports six tents completed by 06/04/2026; MLQ.ai reports five built between April and June); this page follows MLQ's five, and drops an earlier, unconfirmed \"12 buildings: 5 halls + 7 tents\" breakdown this pass could not trace to any cited source."],
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
