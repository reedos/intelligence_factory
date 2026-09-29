// The scenario engine. One pure function turns a handful of choices into every number the page shows:
// PUE, rack count, network size, the power ledger, the voltage and bandwidth staircases, and inventory counts.
// Nothing here touches the DOM or Three.js, so it is tested directly (engine.test.ts).

import { SITES, type SiteId } from './sites';

// what kind of statement a figure is, and what backs it (src/evidence.js); 'typical' and 'est' are the labels
// figures carried before they were traced one by one
export type Basis = 'spec' | 'vendor' | 'reported' | 'derived' | 'assumed' | 'typical' | 'est';
export interface Ev { refs?: [string, string][]; vs?: string; calc?: string; assume?: string }
export type AccelId = 'h100' | 'gb200' | 'gb300' | 'rubin';
export type PowerId = 'ac415' | 'dc800';
export type CoolingId = 'air' | 'liquid' | 'warm';

export interface Scenario {
  meterMW: number;   // power drawn at the utility meter
  accel: AccelId;
  power: PowerId;
  cooling: CoolingId;
  site?: string;     // a real campus this scenario is based on (sites.ts)
  stage?: number;    // with a site that publishes its fleet (sites.ts `fleet`), which dated stage of it
}

export const DEFAULT_SCENARIO: Scenario = { meterMW: 100, accel: 'gb200', power: 'ac415', cooling: 'warm' };

// ---------- accelerators ----------
// Rack power is built bottom-up from these parts, then checked against the published rack figure in tests.
export interface Accel {
  id: AccelId; name: string; short: string; rackName: string; year: string;
  gpuW: number;            // package power, HBM included
  gpusPerRack: number;
  cpusPerRack: number; cpuW: number; cpuName: string;   // CPU with its memory
  scaleupKW: number;       // NVLink switching per rack
  nicKW: number;           // scale-out NICs and DPUs per rack
  otherKW: number;         // drives, fans, management per rack
  busbarKW: number;        // rack busbar or cabling loss
  hbmShare: number;        // HBM's share of package power
  vrmEff: number;          // 12 V → core
  ibcEff: number;          // 50 V → 12 V
  psuEff: number;          // AC → DC inside the rack (power shelves, or server PSUs)
  liquidShare: number;     // share of rack heat leaving in water
  hbm: { type: string; gb: number; tbs: number; stacks: number; layers: number };
  dies: number;
  nvlink: { gen: string; tbs: number; domain: number; switchChipsPerRack: number; linksPerGpu: number };
  nicGbps: 400 | 800 | 1600; // aggregate scale-out line rate per GPU
  nicPortGbps: 400 | 800 | 1600; // physical NIC port line rate
  nicsPerGpu: number; dpusPerTray: number; gpuPortsPerModule: number;
  fp8PF: number | null; fp4PF: number | null;          // dense, per GPU
  publishedRackKW: [number, number];
  coolingOptions: CoolingId[];
  dc800: boolean;          // can take 800 V DC to the rack
  basis: Basis;
}

export const ACCELERATORS: Record<AccelId, Accel> = {
  h100: {
    id: 'h100', name: 'NVIDIA HGX H100', short: 'H100', rackName: 'DGX H100 rack', year: '2023',
    gpuW: 700, gpusPerRack: 32, cpusPerRack: 8, cpuW: 350, cpuName: 'x86 CPUs + DDR5',
    scaleupKW: 1.8, nicKW: 1.4, otherKW: 5.2, busbarKW: 0.05,
    hbmShare: 0.1, vrmEff: 0.9, ibcEff: 0.983, psuEff: 0.96, liquidShare: 0,
    hbm: { type: 'HBM3', gb: 80, tbs: 3.35, stacks: 5, layers: 8 }, dies: 1,
    nvlink: { gen: 'NVLink 4', tbs: 0.9, domain: 8, switchChipsPerRack: 16, linksPerGpu: 18 }, nicGbps: 400, nicPortGbps: 400, nicsPerGpu: 1, dpusPerTray: 0, gpuPortsPerModule: 2, fp8PF: 1.98, fp4PF: null,
    publishedRackKW: [36, 42], coolingOptions: ['air'], dc800: false, basis: 'typical',   // DGX H100 reference design is air-cooled
  },
  gb200: {
    id: 'gb200', name: 'NVIDIA GB200 NVL72', short: 'GB200', rackName: 'GB200 NVL72', year: '2025',
    gpuW: 1200, gpusPerRack: 72, cpusPerRack: 36, cpuW: 364, cpuName: 'Grace CPUs + LPDDR5X',
    scaleupKW: 10.6, nicKW: 4.37, otherKW: 2.35, busbarKW: 0.34,
    hbmShare: 0.132, vrmEff: 0.91, ibcEff: 0.9828, psuEff: 0.975, liquidShare: 0.87,
    hbm: { type: 'HBM3e', gb: 192, tbs: 8, stacks: 8, layers: 8 }, dies: 2,
    // NVIDIA's own reference design (DGX OS / DSX architecture docs, and the CoreWeave GB200 launch) wires one
    // 400G ConnectX-7 port per GPU; ConnectX-8 800G is a documented upgrade path, not the shipping default.
    nvlink: { gen: 'NVLink 5', tbs: 1.8, domain: 72, switchChipsPerRack: 18, linksPerGpu: 18 }, nicGbps: 400, nicPortGbps: 400, nicsPerGpu: 1, dpusPerTray: 2, gpuPortsPerModule: 1, fp8PF: 5, fp4PF: 10,
    publishedRackKW: [120, 132], coolingOptions: ['liquid', 'warm'], dc800: true, basis: 'typical',
  },
  gb300: {
    id: 'gb300', name: 'NVIDIA GB300 NVL72', short: 'GB300', rackName: 'GB300 NVL72', year: '2025–26',
    gpuW: 1400, gpusPerRack: 72, cpusPerRack: 36, cpuW: 364, cpuName: 'Grace CPUs + LPDDR5X',
    scaleupKW: 10.6, nicKW: 5.0, otherKW: 2.35, busbarKW: 0.34,
    hbmShare: 0.15, vrmEff: 0.91, ibcEff: 0.9828, psuEff: 0.975, liquidShare: 0.9,
    hbm: { type: 'HBM3e', gb: 288, tbs: 8, stacks: 8, layers: 12 }, dies: 2,
    nvlink: { gen: 'NVLink 5', tbs: 1.8, domain: 72, switchChipsPerRack: 18, linksPerGpu: 18 }, nicGbps: 800, nicPortGbps: 800, nicsPerGpu: 1, dpusPerTray: 1, gpuPortsPerModule: 1, fp8PF: 5, fp4PF: 15,
    publishedRackKW: [135, 155], coolingOptions: ['liquid', 'warm'], dc800: true, basis: 'typical',
  },
  rubin: {
    id: 'rubin', name: 'NVIDIA Vera Rubin NVL72', short: 'Rubin', rackName: 'Vera Rubin NVL72', year: '2026–27',
    gpuW: 1800, gpusPerRack: 72, cpusPerRack: 36, cpuW: 400, cpuName: 'Vera CPUs + LPDDR5X',
    scaleupKW: 14, nicKW: 7.5, otherKW: 2.6, busbarKW: 0.4,
    hbmShare: 0.16, vrmEff: 0.915, ibcEff: 0.983, psuEff: 0.975, liquidShare: 1,
    hbm: { type: 'HBM4', gb: 288, tbs: 19.2, stacks: 8, layers: 12 }, dies: 2,   // stack count not yet published
    nvlink: { gen: 'NVLink 6', tbs: 3, domain: 72, switchChipsPerRack: 36, linksPerGpu: 36 }, nicGbps: 1600, nicPortGbps: 800, nicsPerGpu: 2, dpusPerTray: 1, gpuPortsPerModule: 1, fp8PF: null, fp4PF: 35,   // sources give 25–50
    publishedRackKW: [170, 230], coolingOptions: ['liquid', 'warm'], dc800: true, basis: 'est',
  },
};

// ---------- power distribution ----------
export interface PowerArch { id: PowerId; name: string; short: string; rackV: string; basis: Basis }
export const POWER: Record<PowerId, PowerArch> = {
  ac415: { id: 'ac415', name: '415 V AC to the rack', short: '415 V AC', rackV: '415 V AC', basis: 'typical' },
  dc800: { id: 'dc800', name: '800 V DC to the rack', short: '800 V DC', rackV: '800 V DC', basis: 'est' },
};
const EFF = {
  mpt: 0.996, campus: 0.997,              // main transformers, campus cables and switchgear
  unitSub: 0.99, ups: 0.965, busway: 0.995,
  sst: 0.98, dcBus: 0.997, dcBattery: 0.998, rackDcDc: 0.985,   // Navitas: SST >98%, 800 → 50 V at 98.5% peak
};

// ---------- cooling ----------
export interface Cooling { id: CoolingId; name: string; short: string; sub: string; coolFrac: number; wue: number; basis: Basis }
export const COOLING: Record<CoolingId, Cooling> = {
  // coolFrac is cooling power per unit of IT load, set so each design lands in its published PUE band
  // (air ≈1.5, liquid with chillers 1.10–1.20, warm water 1.05–1.15) once the power chain's own losses are added
  air: { id: 'air', name: 'Air-cooled halls with chillers', short: 'Air', sub: 'chillers', coolFrac: 0.42, wue: 1.0, basis: 'typical' },
  liquid: { id: 'liquid', name: 'Liquid to the chip, chilled water', short: 'Liquid', sub: 'chilled water', coolFrac: 0.13, wue: 0.5, basis: 'typical' },
  warm: { id: 'warm', name: 'Warm-water liquid, dry coolers', short: 'Warm water', sub: 'dry coolers', coolFrac: 0.08, wue: 0.16, basis: 'typical' },
};
const MISC_FRAC = 0.017;   // lighting, controls, offices, as a share of IT

// ---------- water temperatures ----------
// One design point per cooling choice, shared by the cards (data.js) and the hot-day/outage clocks
// (clock.ts), so a reader never sees two different numbers for the same assumption.
export const WATER = {
  warmSupplyC: 45,       // NVIDIA's warm-water MGX rack spec: coolant entering the rack (typical)
  warmAdiabaticC: 35,    // outdoor air at or above this needs adiabatic-spray assist to hold the warm-water loop (est)
  liquidSupplyC: 20,     // this design's chiller-made supply for direct-to-chip liquid cooling, non-warm (est)
  airSupplyC: 12,        // this design's chiller-made supply for in-row air cooling (typical)
};
// One operating point for every temperature the page names, per cooling design, so the heat tour, the cards and the
// Hot to cold chart read the same numbers (ASSUMPTIONS 'loop-temps'). Liquid designs have two water loops that meet
// at the CDU: the rack loop through the cold plates, and the facility loop to the roof or the chillers. Air designs
// have one chilled-water loop between the in-row coils and the chillers. Supply runs toward the heat, return away.
export const LOOP = {
  rackRiseC: 10,         // coolant rise across a rack, and across the facility loop at the same heat (reported ≈10 °C, NVL72)
  cduApproachC: 3,       // the CDU's plate exchanger: facility water sits this far below the rack loop on each side
  dieOverCoolantC: 20,   // die above the coolant leaving its cold plate, at full load
  lidDropC: 8,           // die to lid, through the first interface
  coldAisleC: 22,        // supply air at the rack fronts, inside ASHRAE's recommended 18-27 °C
  airRiseC: 18,          // front to back through an air-cooled server (15-20 °C, 'air-rack-rise')
  airDieC: 80,           // an air-cooled H100 die at full load
  condenserC: 35,        // condenser water leaving the chillers for the cooling towers
};
export interface Temps { die: number; lid: number; tcsSupply?: number; tcsReturn?: number; fwsSupply: number; fwsReturn: number; coldAisle?: number; hotAisle?: number; ambient: number; condenser?: number }
export function loopTemps(coolingId: CoolingId): Temps {
  const ambient = WATER.warmAdiabaticC;                                  // the hot afternoon the plant is designed for
  if (coolingId === 'air') {
    const hotAisle = LOOP.coldAisleC + LOOP.airRiseC;
    return { die: LOOP.airDieC, lid: LOOP.airDieC - LOOP.lidDropC, coldAisle: LOOP.coldAisleC, hotAisle, fwsSupply: WATER.airSupplyC, fwsReturn: WATER.airSupplyC + LOOP.rackRiseC, ambient, condenser: LOOP.condenserC };
  }
  const warm = coolingId === 'warm';
  const tcsSupply = warm ? WATER.warmSupplyC : WATER.liquidSupplyC + LOOP.cduApproachC, tcsReturn = tcsSupply + LOOP.rackRiseC;
  const die = tcsReturn + LOOP.dieOverCoolantC;
  return { die, lid: die - LOOP.lidDropC, tcsSupply, tcsReturn, fwsSupply: tcsSupply - LOOP.cduApproachC, fwsReturn: tcsReturn - LOOP.cduApproachC, ambient, ...(warm ? {} : { condenser: LOOP.condenserC }) };
}

// ---------- scale-out fabric by NIC speed ----------
// One physical port per NIC into a non-blocking fat tree; Rubin has two NICs per GPU.
// gpuModuleW and portModuleW are per-port power allowances. Physical module
// counts divide by the host/switch port grouping independently (H100 host OSFPs carry two).
const FABRICS = {
  400: { radix: 64, switchKW: 0.75, gpuModuleW: 9, portModuleW: 8.5, portsPerModule: 2, fibersPerLink: 8, switchName: 'Quantum-2, 64 × 400G' },
  800: { radix: 144, switchKW: 2.9, gpuModuleW: 17, portModuleW: 16.75, portsPerModule: 2,   // NVIDIA MMS4A00 1.6T twin-port: 33.5 W max, two ports
        fibersPerLink: 8, switchName: 'Quantum-X800, 144 × 800G' },
  1600: { radix: 72, switchKW: 2.9, gpuModuleW: 27, portModuleW: 27, portsPerModule: 1, fibersPerLink: 16, switchName: 'Spectrum-6, 72 × 1.6T' },   // Rubin's Ethernet switch; its port count is not published yet
} as const;

// Where a figure lives in 3D: scene index, layer and part id. The page uses it to jump from a chart row to the part.
export interface Link { scene: number; mode: 'power' | 'data' | 'heat'; part: string }
const L = (scene: number, part: string, mode: Link['mode'] = 'power'): Link => ({ scene, mode, part });
export interface LedgerRow { label: string; mw: number; kind: 'loss' | 'overhead' | 'net' | 'work'; scene: number; basis: Basis; ev?: Ev; link?: Link }

// one rack, bottom up (kW), for an accelerator on a power design
function rackOf(accel: Accel, power: PowerArch) {
  const pkgKW = accel.gpuW * accel.gpusPerRack / 1000;
  const hbmKW = pkgKW * accel.hbmShare, gpuSiliconKW = pkgKW - hbmKW;
  const vrmLossKW = pkgKW / accel.vrmEff - pkgKW;
  const cpuKW = accel.cpusPerRack * accel.cpuW / 1000;
  const load12 = pkgKW + vrmLossKW + cpuKW + accel.scaleupKW + accel.nicKW + accel.otherKW;
  const ibcLossKW = load12 / accel.ibcEff - load12;
  const dcBusKW = load12 + ibcLossKW + accel.busbarKW;
  const rackEff = power.id === 'dc800' ? EFF.rackDcDc : accel.psuEff;
  const rackKW = dcBusKW / rackEff;
  return { kw: rackKW, dcBusKW, convKW: rackKW - dcBusKW, pkgKW, hbmKW, gpuSiliconKW, vrmLossKW, ibcLossKW, cpuKW, gpus: accel.gpusPerRack, eff: rackEff };
}

// A tier's own port count sets how many links and switch ports a GPU needs, which sets kwPerGpu, which sets how many
// racks the site's power actually buys — so "how many GPUs" and "how many tiers" depend on each other. Evaluate both
// tier configurations directly and pick the smaller one that stays inside its own port budget.
function tierConfig(F: (typeof FABRICS)[keyof typeof FABRICS], tiers: 2 | 3, nicsPerGpu = 1) {
  const portsPerGpu = (tiers === 2 ? 3 : 5) * nicsPerGpu, linksPerGpu = (tiers === 2 ? 2 : 3) * nicsPerGpu;
  const kwPerGpu = portsPerGpu / F.radix * F.switchKW + (nicsPerGpu * F.gpuModuleW + portsPerGpu * F.portModuleW) / 1000;
  return { tiers, portsPerGpu, linksPerGpu, kwPerGpu, nicsPerGpu };
}
// one non-blocking fabric for G GPUs on one NIC speed: its counts and its power
function fabricOf(F: (typeof FABRICS)[keyof typeof FABRICS], G: number, cfg: ReturnType<typeof tierConfig>, gpuPortsPerModule = 1) {
  const threeTierMax = F.radix ** 3 / 4, endpoints = G * cfg.nicsPerGpu;
  const leaf = Math.ceil(endpoints / (F.radix / 2));
  const spine = cfg.tiers === 2 ? Math.ceil(endpoints / F.radix) : Math.ceil(endpoints / (F.radix / 2));
  const core = cfg.tiers === 3 ? Math.ceil(endpoints / F.radix) : 0;
  const switches = leaf + spine + core, links = G * cfg.linksPerGpu;
  const gpuModules = endpoints / gpuPortsPerModule, switchModules = G * cfg.portsPerGpu / F.portsPerModule;   // twin-port modules carry two switch ports
  return {
    F, ...cfg, planes: Math.max(1, Math.ceil(endpoints / threeTierMax)), gpus: G, endpoints, leaf, spine, core, switches, links, gpuModules, switchModules,
    switchMW: switches * F.switchKW / 1000, opticsMW: (endpoints * F.gpuModuleW + G * cfg.portsPerGpu * F.portModuleW) / 1e6,
  };
}

// A real campus whose operator has said what it runs (sites.ts `fleet`) is sized from that fleet, one dated stage at a
// time: GPUs set the racks, the racks and their network set the IT load, and the IT load sets the meter. Each
// accelerator keeps its own rack power and gets its own scale-out fabric at its own NIC speed (ASSUMPTIONS
// 'fleet-own-fabrics'). It holds only while the reader keeps the preset's accelerator, the one its 3D rack, tray and
// package show; any other scenario is sized the usual way, from the meter, as a one-member fleet.
export interface FleetMember { accel: Accel; gpus: number; racks: number; rack: ReturnType<typeof rackOf>; fab: ReturnType<typeof fabricOf> }

export function compute(s: Scenario) {
  const accel = ACCELERATORS[s.accel];
  const power = POWER[accel.dc800 ? s.power : 'ac415'];
  const cooling = COOLING[accel.coolingOptions.includes(s.cooling) ? s.cooling : accel.coolingOptions[accel.coolingOptions.length - 1]];
  const site = s.site ? SITES[s.site as SiteId] : undefined, plant = site?.plant;
  const stages = site?.fleet;
  const stage = stages && s.stage != null && stages[s.stage]?.parts.some(p => p.gpus > 0) && accel.id === site!.scenario.accel ? s.stage : null;

  // ----- one rack of the accelerator the scenario names, the one the 3D levels draw -----
  const rack = rackOf(accel, power);
  const { pkgKW, vrmLossKW, dcBusKW } = rack, rackKW = rack.kw;
  const F = FABRICS[accel.nicPortGbps];
  const twoTierMax = F.radix * F.radix / 2;

  // ----- facility -----
  const upstream = EFF.mpt * EFF.campus;
  const itPath = power.id === 'dc800' ? EFF.sst * EFF.dcBus * EFF.dcBattery : EFF.unitSub * EFF.ups * EFF.busway;
  const sidePath = EFF.unitSub;   // cooling and building loads
  // meter · upstream = IT / itPath + (coolFrac + misc) · IT / sidePath
  const meterPerIT = (1 / itPath + (cooling.coolFrac + MISC_FRAC) / sidePath) / upstream;

  let meterMW: number, IT_MW: number, fleet: FleetMember[];
  if (stage !== null) {
    // the operator's own GPU counts; a partly filled last rack counts toward power as the share it holds
    fleet = stages![stage].parts.filter(p => p.gpus > 0).map(p => {
      const a = ACCELERATORS[p.accel], Fa = FABRICS[a.nicPortGbps];
      const cfg = tierConfig(Fa, p.gpus * a.nicsPerGpu <= Fa.radix * Fa.radix / 2 ? 2 : 3, a.nicsPerGpu);
      return { accel: a, gpus: p.gpus, racks: p.gpus / a.gpusPerRack, rack: rackOf(a, a.dc800 ? power : POWER.ac415), fab: fabricOf(Fa, p.gpus, cfg, a.gpuPortsPerModule) };
    });
    // the IT load is what the fleet draws: its racks, and its switches and optics as counted, so nothing is left over
    IT_MW = fleet.reduce((w, m) => w + m.racks * m.rack.kw / 1000 + m.fab.switchMW + m.fab.opticsMW, 0);
    meterMW = IT_MW * meterPerIT;
  } else {
    // solve for the IT load from the meter; racks and the network outside them share it
    meterMW = s.meterMW;
    IT_MW = meterMW / meterPerIT;
    const racksFor = (cfg: ReturnType<typeof tierConfig>) => Math.floor(IT_MW * 1000 / (rackKW + accel.gpusPerRack * cfg.kwPerGpu));
    const two = tierConfig(F, 2, accel.nicsPerGpu), twoRacks = racksFor(two), twoGpus = twoRacks * accel.gpusPerRack;
    // Two tiers is only a valid fabric if the GPUs it would actually buy fit its own port budget; once the site's
    // power buys more GPUs than that, the campus needs a third tier (which costs more per GPU, so it always buys
    // fewer of them — this can never flip back to "two tiers fits after all").
    const feasible2Tier = twoGpus * accel.nicsPerGpu <= twoTierMax;
    const chosen = feasible2Tier ? two : tierConfig(F, 3, accel.nicsPerGpu);
    const r = feasible2Tier ? twoRacks : racksFor(chosen), g = r * accel.gpusPerRack;
    fleet = [{ accel, gpus: g, racks: r, rack, fab: fabricOf(F, g, chosen, accel.gpuPortsPerModule) }];
  }
  const coolMW = cooling.coolFrac * IT_MW, miscMW = MISC_FRAC * IT_MW;
  const gpus = fleet.reduce((n, m) => n + m.gpus, 0);
  const racks = Math.round(fleet.reduce((n, m) => n + m.racks, 0));
  // the campus total of one per-rack quantity
  const perRack = (f: (m: FleetMember) => number) => fleet.reduce((a, m) => a + m.racks * f(m), 0);
  const sumFab = (f: (x: FleetMember['fab']) => number) => fleet.reduce((a, m) => a + f(m.fab), 0);
  const fab = fleet[fleet.length - 1].fab;   // the drawn accelerator's fabric (last in a fleet: the majority)

  // ----- network counts: every fleet member's fabric, summed -----
  const leaf = sumFab(x => x.leaf), spine = sumFab(x => x.spine), core = sumFab(x => x.core), switches = sumFab(x => x.switches);
  const links = sumFab(x => x.links), gpuModules = sumFab(x => x.gpuModules), switchModules = sumFab(x => x.switchModules);
  const switchMW = sumFab(x => x.switchMW), opticsMW = sumFab(x => x.opticsMW);
  const dci = { routes: 2, lambdas: 32, gbps: 800, routeKm: 1100, spanKm: 80, cableStrands: 432, portsPerLinecard: 36, litPairs: 0, tbpsPerRoute: 0, modulesPerEnd: 0, huts: 0 };
  dci.litPairs = Math.max(2, Math.round(gpus * 10 / 1000 / 2 / (dci.lambdas * dci.gbps / 1000)));   // ≈10 Gb/s per GPU to other sites
  dci.tbpsPerRoute = dci.litPairs * dci.lambdas * dci.gbps / 1000;
  dci.modulesPerEnd = dci.routes * dci.litPairs * dci.lambdas;
  dci.huts = Math.ceil(dci.routeKm / dci.spanKm) - 1;
  const h = (m: FleetMember) => m.accel.id === 'h100';
  const NET = {
    leaf, spine, core, switches, tiers: fab.tiers, planes: sumFab(x => x.planes), links, gpuModules, switchModules,
    modules: gpuModules + switchModules, fibers: sumFab(x => x.links * x.F.fibersPerLink),
    crossHallFibers: sumFab(x => x.endpoints / 2 * x.F.fibersPerLink), switchMW, opticsMW,
    // NVIDIA NVLink specifications: 18 logical links/GPU for Hopper/Blackwell, 36 for Rubin.
    nvlinkLinks: Math.round(perRack(m => m.accel.gpusPerRack * m.accel.nvlink.linksPerGpu)),
    // Legacy wire-count estimate; Rubin physical pair mapping is unverified and omitted from UI.
    nvlinkPairs: Math.round(perRack(m => (h(m) ? m.accel.gpusPerRack * 18 * 4 : 5184))),
    // NVIDIA Vera Rubin technical blog: four NVLink6 chips/tray x nine trays.
    // Scale-up power is a whole-rack budget, so this count does not double it.
    nvswitchChips: Math.round(perRack(m => m.accel.nvlink.switchChipsPerRack)),
    // DGX H100 has two front-end dual-port ConnectX7 cards/server, not BF3 DPUs.
    dpus: Math.round(perRack(m => (h(m) ? 4 : 18) * m.accel.dpusPerTray)), dci, fabric: F,
    // a mixed fleet runs one fabric per accelerator, each at its own NIC speed
    fabrics: fleet.map(m => ({ accel: m.accel.short, gpus: m.gpus, nicGbps: m.accel.nicGbps, nicPortGbps: m.accel.nicPortGbps, nicsPerGpu: m.accel.nicsPerGpu, endpoints: m.fab.endpoints, tiers: m.fab.tiers, switches: m.fab.switches, radix: m.fab.F.radix, switchName: m.fab.F.switchName })),
  };

  // ----- the ledger: meter to GPU silicon -----
  const R = (f: (m: FleetMember) => number) => perRack(f) / 1000;   // kW per rack → MW for the campus
  const itIn = IT_MW / itPath;                 // power entering the IT path
  const sideIn = (coolMW + miscMW) / sidePath;
  const hgx = accel.id === 'h100';
  const ledger: LedgerRow[] = [
    { label: 'Main power transformers', mw: meterMW * (1 - EFF.mpt), kind: 'loss', scene: 1, basis: 'derived', ev: { calc: 'ledger-stage-loss', assume: 'mpt-eff-99.6' }, link: L(1, 'mpt') },
    { label: 'Campus cables & switchgear', mw: meterMW * EFF.mpt * (1 - EFF.campus), kind: 'loss', scene: 1, basis: 'derived', ev: { calc: 'ledger-stage-loss', assume: 'campus-cable-eff-99.7' }, link: L(1, 'ehouse') },
    ...(power.id === 'dc800' ? [
      { label: 'Unit substations, cooling side', mw: sideIn * (1 - EFF.unitSub), kind: 'loss', scene: 2, basis: 'derived', ev: { calc: 'ledger-stage-loss', assume: 'unitsub-cooling-side-eff-99', refs: [['doe-transformer-standards-2024', "DOE's own summary of the 04/04/2024 final rule updating distribution-transformer efficiency standards -- supersedes the 2013 rule this site cited before"]] }, link: L(2, 'unitsub') } as LedgerRow,
      { label: 'Solid-state transformers, MV → 800 V DC', mw: itIn * (1 - EFF.sst), kind: 'loss', scene: 2, basis: 'derived', ev: { calc: 'ledger-stage-loss', assume: 'sst-eff-98', refs: [['semiconductor-today-navitas-sst', "\"exceeding 98% conversion from medium-voltage grids (13.8kVAC to 34.5kVAC) to 800VDC or 1500VDC\" -- Navitas's own claim for its SiCPAK SST modules; the site's earlier navitas-800vdc citation for this figure states no efficiency percentage"]] }, link: L(2, 'sst') } as LedgerRow,
      { label: '800 V DC bus & batteries', mw: itIn * EFF.sst * (1 - EFF.dcBus * EFF.dcBattery), kind: 'loss', scene: 2, basis: 'derived', ev: { calc: 'ledger-stage-loss', assume: 'dcbus-battery-eff' }, link: L(2, 'busway') } as LedgerRow,
    ] : [
      { label: 'Unit substations', mw: (itIn + sideIn) * (1 - EFF.unitSub), kind: 'loss', scene: 2, basis: 'derived', ev: { calc: 'ledger-stage-loss', assume: 'unitsub-cooling-side-eff-99', refs: [['doe-transformer-standards-2024', "DOE's own summary of the 04/04/2024 final rule updating distribution-transformer efficiency standards -- supersedes the 2013 rule this site cited before"]] }, link: L(2, 'unitsub') } as LedgerRow,
      { label: 'UPS, double conversion', mw: itIn * EFF.unitSub * (1 - EFF.ups), kind: 'loss', scene: 2, basis: 'derived', ev: { calc: 'ledger-conv-loss', assume: 'ups-eff-96.5', refs: [['ceie-eaton-9395xr', "distributor summary of Eaton's tested figures: \"dual conversion in online mode is as high as 97.5%\", eco/AC-direct mode \"can be improved to 99%\""]] }, link: L(2, 'ups') } as LedgerRow,
      { label: 'Busway & whips', mw: itIn * EFF.unitSub * EFF.ups * (1 - EFF.busway), kind: 'loss', scene: 2, basis: 'derived', ev: { calc: 'ledger-stage-loss', assume: 'busway-eff-99.5' }, link: L(2, 'busway') } as LedgerRow,
    ]),
    { label: `Cooling: ${cooling.short.toLowerCase()}, ${cooling.sub}`, mw: coolMW, kind: 'overhead', scene: 2, basis: 'derived', ev: { calc: 'ledger-overhead-frac', assume: 'cooling-overhead-frac', refs: [['google-pue', 'Efficiency page: Google’s own fleet-wide PUE, anchoring the low end of the warm-water/liquid band']] }, link: L(1, cooling.id === 'warm' ? 'drycoolers' : 'chillers') },
    { label: 'Lighting, controls, offices', mw: miscMW, kind: 'overhead', scene: 2, basis: 'derived', ev: { calc: 'ledger-overhead-frac', assume: 'cooling-overhead-frac' } },
    { label: fleet.length > 1 ? 'Scale-out switches, one fabric per accelerator' : `Scale-out switches, ${fab.tiers} tiers`, mw: switchMW, kind: 'net', scene: 2, basis: 'derived', ev: { calc: 'ledger-fabric-power', ...(fleet.length > 1 ? { assume: 'fleet-own-fabrics' } : {}) }, link: L(2, 'spine', 'data') },
    { label: 'Optical transceivers', mw: opticsMW, kind: 'net', scene: 2, basis: 'derived', ev: { calc: 'ledger-fabric-power', refs: [['nvidia-800g-dr8-datasheet', 'section 4.2, Recommended Operating Conditions and Power Supply Requirements: Maximum Power Dissipation, Max 17 W (the 400G-class per-module figure the fabric model scales from)']] }, link: L(2, 'optics', 'data') },
    { label: power.id === 'dc800' ? 'In-rack DC-DC, 800 → 50 V' : (hgx ? 'Server power supplies, AC → DC' : 'Rack power shelves, AC → DC'), mw: R(m => m.rack.convKW), kind: 'loss', scene: 3, basis: 'derived', ev: power.id === 'dc800' ? { calc: 'ledger-conv-loss', assume: 'rack-dcdc-eff-98.5', refs: [['navitas-10kw-dcdc-800v50v', "\"deliver 98.5% peak efficiency and 98.1% full load efficiency\" for its \"800 V-to-50 V\" DC-DC platform (the site's earlier navitas-800vdc citation for this figure states no efficiency percentage)"]] } : { calc: 'ledger-conv-loss', refs: [['nvidia-h100-datasheet', 'system power figures behind the ≈96% AC→54 V PSU efficiency assumed for the DGX H100 case'], ['nvidia-gb200-ocp', 'OCP contribution post describing the GB200 ORv3 power-shelf conversion this figure covers']] }, link: L(3, hgx ? 'psus' : 'shelves') },
    { label: hgx ? 'Server power cabling' : 'Busbar', mw: R(m => m.accel.busbarKW), kind: 'loss', scene: 3, basis: 'derived', ev: { calc: 'ledger-rack-share' }, link: L(3, hgx ? 'cabling' : 'busbar') },
    { label: hgx ? 'NVSwitch chips (scale-up)' : 'NVLink switch trays (scale-up)', mw: R(m => m.accel.scaleupKW), kind: 'net', scene: 3, basis: 'derived', ev: { calc: 'ledger-rack-share', assume: 'rack-component-power' }, link: hgx ? L(4, 'nvswitch') : L(3, 'nvswitch') },
    { label: accel.cpuName, mw: R(m => m.rack.cpuKW), kind: 'work', scene: 4, basis: 'derived', ev: { calc: 'ledger-rack-share', assume: 'rack-component-power' }, link: L(4, hgx ? 'cpu' : 'grace') },
    { label: hgx ? 'NICs & DPUs' : 'SuperNICs & DPUs', mw: R(m => m.accel.nicKW), kind: 'net', scene: 4, basis: 'derived', ev: { calc: 'ledger-rack-share', assume: 'rack-component-power', refs: [['nvidia-coreweave-gb200-400g', "\"NVIDIA Quantum-2 InfiniBand networking that delivers 400Gb/s bandwidth per GPU\" -- the per-GPU NIC rate this row's per-rack figure is built from"]] }, link: L(4, 'nic') },
    { label: 'SSDs, fans, management', mw: R(m => m.accel.otherKW), kind: 'work', scene: 4, basis: 'derived', ev: { calc: 'ledger-rack-share', assume: 'rack-component-power' }, ...(hgx ? { link: L(4, 'fans', 'heat') } : {}) },
    { label: hgx ? 'Bus converters, 54 → 12 V' : 'Bus converters, 50 → 12 V', mw: R(m => m.rack.ibcLossKW), kind: 'loss', scene: 4, basis: 'derived', ev: { calc: 'ledger-conv-loss', refs: [['semianalysis-blackwell-power-delivery', 'board-level power-delivery survey behind the assumed ≈97–98% intermediate-bus-converter efficiency (no vendor publishes an absolute IBC efficiency at a stated voltage/current point)']] }, link: L(4, 'ibc') },
    { label: 'Voltage regulators, 12 → 0.8 V', mw: R(m => m.rack.vrmLossKW), kind: 'loss', scene: 4, basis: 'derived', ev: { calc: 'ledger-conv-loss', refs: [['semianalysis-blackwell-power-delivery', 'board-level power-delivery survey behind the assumed VRM efficiency at ≈0.8 V core voltage (no vendor publishes an absolute figure at a stated current)']] }, link: L(4, 'vrm') },
    { label: `${accel.hbm.type} memory`, mw: R(m => m.rack.hbmKW), kind: 'work', scene: 5, basis: 'derived', ev: { calc: 'ledger-rack-share', assume: 'hbm-share-of-gpu-power' }, link: L(5, 'hbm') },
  ];
  // GPU silicon from the actual, physical component sum (one rack's own share, times the whole racks the site
  // built) — not "whatever the ledger hasn't claimed yet". Building a whole number of racks always leaves a
  // sliver of the meter's IT budget short of one more rack; show that sliver as its own row instead of quietly
  // folding it into the silicon figure. Appended last so it never shifts the `marks` indices above.
  const gpuSiliconMW = R(m => m.rack.gpuSiliconKW);
  const ledgerSum = ledger.reduce((a, r) => a + r.mw, 0);
  const spareMW = meterMW - ledgerSum - gpuSiliconMW;
  if (stage === null) ledger.push({ label: 'Unallocated: rounds down to a whole rack', mw: spareMW, kind: 'overhead', scene: 2, basis: 'derived', ev: { calc: 'ledger-remainder' } });
  const marks = [
    { after: 1, label: '34.5 kV feeders' },     // both power paths have three facility rows, so the marks line up
    { after: 6, label: 'IT load' },
    { after: 8, label: 'Into the racks' },
    { after: 14, label: 'GPU modules' },
  ];
  const pue = meterMW / IT_MW;
  // whole racks per kind for display, apportioned so they add up to the campus total
  const shown = fleet.map(m => Math.floor(m.racks)), rest = racks - shown.reduce((a, b) => a + b, 0);
  fleet.map((m, k) => [m.racks - Math.floor(m.racks), k]).sort((a, b) => b[0] - a[0]).slice(0, Math.max(0, rest)).forEach(([, k]) => { shown[k]++; });

  // ----- staircases -----
  const kA = (w: number, v: number) => w / (Math.sqrt(3) * v * 0.95);   // three-phase current at pf 0.95, from real power
  const kAapp = (va: number, v: number) => va / (Math.sqrt(3) * v);     // from apparent power (a transformer's MVA rating
                                                                        // already is apparent power; no separate pf term)
  const fmtA = (a: number) => a >= 1000 ? `≈${(Math.round(a / 100) * 100).toLocaleString('en-US')} A` : `≈${Math.round(a / 5) * 5} A`;
  const busbarV = accel.id === 'h100' ? 54 : 50;   // OCP HGX baseboard spec: 54 V nominal; GB200/GB300 ORv3 busbar: ≈50–51 V
  const staircase = [
    { link: L(1, 'line'), v: 345000, label: '345 kV', where: 'Transmission line', current: `${fmtA(kA(meterMW * 1e6, 345000) / 2)} per phase`, note: `the whole ${meterMW >= 1000 ? (meterMW / 1000).toFixed(1) + ' GW' : Math.round(meterMW) + ' MW'} campus, 2 circuits`, volt: 'hv', basis: 'est' as Basis },
    { link: L(1, 'ehouse'), v: 34500, label: '34.5 kV', where: 'Campus feeders', current: `${fmtA(kA(10e6, 34500))} per feeder`, note: 'one 10 MW feeder', volt: 'mv', basis: 'est' as Basis },
    ...(power.id === 'dc800' ? [
      { link: L(2, 'busway'), v: 800, label: '800 V DC', where: 'DC busway to the rack', current: fmtA(rackKW * 1000 / 800), note: `one ${Math.round(rackKW)} kW ${accel.short} rack`, volt: 'dc', basis: 'est' as Basis },
    ] : [
      { link: L(2, 'unitsub'), v: 480, label: '480 V', where: 'Unit substation out', current: fmtA(kAapp(2.5e6, 480)), note: 'one 2.5 MVA transformer', volt: 'lv', basis: 'est' as Basis },
      { link: L(2, 'busway'), v: 415, label: '415 V', where: 'Busway to the rack', current: `${fmtA(kA(rackKW * 1000, 415))} per phase`, note: `one ${Math.round(rackKW)} kW ${accel.short} rack`, volt: 'lv', basis: 'est' as Basis },
    ]),
    { link: accel.id === 'h100' ? L(4, 'psu') : L(3, 'busbar'), v: busbarV, label: `${busbarV} V`, where: accel.id === 'h100' ? `Server ${busbarV} V rail` : 'Rack busbar', current: fmtA(dcBusKW * 1000 / busbarV), note: accel.id === 'h100' ? 'all 4 servers in a rack' : `one ${Math.round(rackKW)} kW ${accel.short} rack, all sections`, volt: 'dc', basis: 'est' as Basis },
    { link: L(4, 'ibc'), v: 12, label: '12 V', where: 'Board power rail', current: fmtA((pkgKW + vrmLossKW) * 1000 / accel.gpusPerRack / 12), note: 'one GPU’s share', volt: 'bus12', basis: 'est' as Basis },
    { link: L(5, 'balls'), v: 0.8, label: '0.8 V', where: 'GPU core', current: `≈${(Math.round(accel.gpuW * (1 - accel.hbmShare) / 0.8 / 100) * 100).toLocaleString('en-US')} A`, note: 'into one GPU, split across rails', volt: 'core', basis: 'est' as Basis },
  ];
  const dciPerGpuGBs = dci.tbpsPerRoute * dci.routes * 1000 / 8 / Math.max(1, gpus);
  // Every row states its own measurement basis: 'aggregate' is a bus figure with no separate send/receive side
  // (memory, or a die-to-die fabric quoted the same way); 'each way' is one direction of a duplex link, the
  // basis a NIC's line rate is conventionally quoted in (so NVLink's vendor-quoted bidirectional total is
  // halved here to compare on the same footing); 'shared' is an assumed slice of a link built for many GPUs
  // at once, not a dedicated per-GPU interface.
  const bandwidth = [
    ...(accel.dies > 1 ? [{ link: L(5, 'hbi', 'data'), label: 'NV-HBI', where: 'Die to die', gbs: 10000, latency: 'nanoseconds', note: 'aggregate, across the seam', dir: 'aggregate' as const, cls: 'hbi', basis: 'spec' as Basis }] : []),
    { link: L(5, 'hbm', 'data'), label: accel.hbm.type, where: 'Memory, on package', gbs: accel.hbm.tbs * 1000, latency: '≈100s of ns', note: 'aggregate, per GPU', dir: 'aggregate' as const, cls: 'hbm', basis: accel.basis },
    { link: accel.id === 'h100' ? L(4, 'nvswitch', 'data') : L(3, 'nvswitch', 'data'), label: accel.nvlink.gen, where: accel.id === 'h100' ? 'Scale-up, in the server' : 'Scale-up, in the rack', gbs: accel.nvlink.tbs * 500, latency: 'sub-µs, unpublished', note: `each way, ${accel.nvlink.domain}-GPU domain`, dir: 'each way' as const, cls: 'nvl', basis: accel.basis },
    { link: L(2, 'leaf', 'data'), label: `${accel.nicGbps >= 1000 ? accel.nicGbps / 1000 + 'T' : accel.nicGbps + 'G'}`, where: 'Scale-out, the hall', gbs: accel.nicGbps / 8, latency: '≈1–2 µs', note: `each way, per GPU${accel.nicsPerGpu > 1 ? ` (${accel.nicsPerGpu} ports)` : ''}`, dir: 'each way' as const, cls: 'eth', basis: 'typical' as Basis },
    { link: L(0, 'route', 'data'), label: 'DWDM', where: 'Scale across, 1,000 km', gbs: +dciPerGpuGBs.toFixed(2), latency: '≈5 ms one way', note: 'shared: an assumed per-GPU slice, not a dedicated link', dir: 'shared' as const, cls: 'dci', basis: 'est' as Basis },
  ];

  // ----- layout counts for the campus scene -----
  // Unit sizes are typical catalog sizes; counts are this model's estimates. A real campus whose operator publishes its
  // own plant (sites.ts `plant`) replaces the generic one: battery backup instead of diesel, a published battery size
  // (its power rating, never published, is assumed to carry the whole campus), a closed cooling loop with no towers.
  // the closed loop is the operator's own cooling design: it holds only while the reader keeps that design
  const batteryBackup = plant?.backup === 'battery', closedLoop = !!plant?.closedLoop && cooling.id === site?.scenario.cooling;
  const mvaUnit = meterMW > 400 ? 300 : 75;                // big campuses buy bigger main transformers
  const liquidMW = IT_MW * (cooling.id === 'air' ? 0 : perRack(m => m.rack.kw * m.accel.liquidShare) / perRack(m => m.rack.kw));
  const layout = {
    halls: Math.max(1, Math.ceil(IT_MW / 45)),
    mvaUnit,
    transformers: Math.ceil(meterMW / mvaUnit) + 1,         // N+1
    feeders: Math.max(2, Math.ceil(meterMW / 10)),
    gensets: batteryBackup ? 0 : Math.ceil(meterMW / 3 * 1.2),         // 3 MW class, N+20%
    fuelML: batteryBackup ? 0 : meterMW * 48 * 0.26 / 1000,            // 48 h at 0.26 L/kWh, million liters
    bessMW: batteryBackup ? Math.round(meterMW) : Math.round(meterMW * 0.2), bessMWh: plant?.bessMWh ?? Math.round(meterMW * 0.4),
    unitSubs: Math.ceil(meterMW * 0.97 / 2.2),               // 2.5 MVA units at ≈2.2 MW
    upsModules: power.id === 'dc800' ? 0 : Math.ceil(itIn / 1.25),
    sstModules: power.id === 'dc800' ? Math.ceil(itIn / 2.5) : 0,
    cdus: Math.ceil(liquidMW / 1.25),
    airUnits: Math.ceil((IT_MW - liquidMW) / (cooling.id === 'air' ? 0.1 : 0.4)),   // in-row coolers, or fan-wall sections
    dryCoolers: cooling.id === 'warm' ? Math.ceil(IT_MW * 1.1 / 0.8) : 0,
    chillers: cooling.id === 'warm' ? 0 : Math.ceil(IT_MW * 1.1 / 4),              // 4 MW (≈1,100 ton) chillers
    towers: closedLoop ? 0 : cooling.id === 'warm' ? Math.ceil(IT_MW / 16) : Math.ceil(IT_MW * 1.3 / 6),
  };

  return {
    scenario: { meterMW: stage !== null ? Math.round(meterMW) : meterMW, accel: accel.id, power: power.id, cooling: cooling.id, ...(s.site ? { site: s.site } : {}), ...(stage !== null ? { stage } : {}) } as Scenario,
    accel, power, cooling,
    meterMW, IT_MW, pue, wue: closedLoop ? 0 : cooling.wue, coolMW, miscMW,
    backup: batteryBackup ? 'battery' as const : 'diesel' as const, closedLoop,
    temps: loopTemps(cooling.id),
    rack,                                          // one rack of the drawn accelerator
    racks, gpus, cpus: Math.round(perRack(m => m.accel.cpusPerRack)),
    // what the campus runs: one member for a generic scenario, the operator's own mix for a real campus's stage
    fleet: fleet.map((m, k) => ({ accel: m.accel, gpus: m.gpus, racks: m.racks, racksShown: shown[k], rackKW: m.rack.kw,
      gpuMW: m.racks * (m.rack.pkgKW + m.rack.vrmLossKW) / m.rack.eff / 1000 })),
    mixed: fleet.length > 1, stage,
    rackAvgKW: perRack(m => m.rack.kw) / perRack(() => 1),
    gpuRackMW: R(m => (m.rack.pkgKW + m.rack.vrmLossKW) / m.rack.eff),   // the part of rack power that swings with the GPUs
    hbmStacks: fleet.reduce((n, m) => n + m.gpus * (m.accel.id === 'h100' ? 5 : m.accel.hbm.stacks), 0),
    fabric: { tiers: fab.tiers, portsPerGpu: fab.portsPerGpu, linksPerGpu: fab.linksPerGpu, kwPerGpu: fab.kwPerGpu, planes: fab.planes }, NET,
    ledger, gpuSiliconMW, marks,
    staircase, bandwidth, layout,
    // decode is memory-bound: scale with HBM bandwidth (a mixed fleet averages its members, per GPU)
    tokPerGpuRef: Math.round(fleet.reduce((a, m) => a + m.gpus * 2000 * m.accel.hbm.tbs / 8, 0) / Math.max(1, gpus) / 50) * 50,
    halls: layout.halls,
  };
}
export type Model = ReturnType<typeof compute>;

// Water Usage Effectiveness (The Green Grid, WP#35) is liters of on-site water per kWh of IT
// equipment energy, not facility/meter energy — the two differ by a factor of PUE. `frac` lets a
// caller show only the water a partly-throttled cooling plant is actually using right now (an
// outage running the chillers at reduced capacity, say), as a share of the full-IT-load rate.
export function waterM3h(M: Model, frac = 1) {
  return M.IT_MW * M.wue * frac;
}
