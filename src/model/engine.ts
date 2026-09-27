// The scenario engine. One pure function turns a handful of choices into every number the page shows:
// PUE, rack count, network size, the power ledger, the voltage and bandwidth staircases, and inventory counts.
// Nothing here touches the DOM or Three.js, so it is tested directly (engine.test.ts).

export type Basis = 'spec' | 'typical' | 'est';
export type AccelId = 'h100' | 'gb200' | 'gb300' | 'rubin';
export type PowerId = 'ac415' | 'dc800';
export type CoolingId = 'air' | 'liquid' | 'warm';

export interface Scenario {
  meterMW: number;   // power drawn at the utility meter
  accel: AccelId;
  power: PowerId;
  cooling: CoolingId;
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
  nvlink: { gen: string; tbs: number; domain: number };
  nicGbps: 400 | 800 | 1600;
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
    nvlink: { gen: 'NVLink 4', tbs: 0.9, domain: 8 }, nicGbps: 400, fp8PF: 1.98, fp4PF: null,
    publishedRackKW: [36, 42], coolingOptions: ['air', 'liquid'], dc800: false, basis: 'typical',
  },
  gb200: {
    id: 'gb200', name: 'NVIDIA GB200 NVL72', short: 'GB200', rackName: 'GB200 NVL72', year: '2025',
    gpuW: 1200, gpusPerRack: 72, cpusPerRack: 36, cpuW: 364, cpuName: 'Grace CPUs + LPDDR5X',
    scaleupKW: 10.6, nicKW: 4.37, otherKW: 2.35, busbarKW: 0.34,
    hbmShare: 0.132, vrmEff: 0.91, ibcEff: 0.9828, psuEff: 0.975, liquidShare: 0.87,
    hbm: { type: 'HBM3e', gb: 192, tbs: 8, stacks: 8, layers: 8 }, dies: 2,
    nvlink: { gen: 'NVLink 5', tbs: 1.8, domain: 72 }, nicGbps: 800, fp8PF: 5, fp4PF: 10,
    publishedRackKW: [120, 132], coolingOptions: ['liquid', 'warm'], dc800: true, basis: 'typical',
  },
  gb300: {
    id: 'gb300', name: 'NVIDIA GB300 NVL72', short: 'GB300', rackName: 'GB300 NVL72', year: '2025–26',
    gpuW: 1400, gpusPerRack: 72, cpusPerRack: 36, cpuW: 364, cpuName: 'Grace CPUs + LPDDR5X',
    scaleupKW: 10.6, nicKW: 5.0, otherKW: 2.35, busbarKW: 0.34,
    hbmShare: 0.15, vrmEff: 0.91, ibcEff: 0.9828, psuEff: 0.975, liquidShare: 0.9,
    hbm: { type: 'HBM3e', gb: 288, tbs: 8, stacks: 8, layers: 12 }, dies: 2,
    nvlink: { gen: 'NVLink 5', tbs: 1.8, domain: 72 }, nicGbps: 800, fp8PF: 5, fp4PF: 15,
    publishedRackKW: [135, 155], coolingOptions: ['liquid', 'warm'], dc800: true, basis: 'typical',
  },
  rubin: {
    id: 'rubin', name: 'NVIDIA Vera Rubin NVL144', short: 'Rubin', rackName: 'Vera Rubin NVL144', year: '2026–27',
    gpuW: 1800, gpusPerRack: 72, cpusPerRack: 36, cpuW: 400, cpuName: 'Vera CPUs + LPDDR5X',
    scaleupKW: 14, nicKW: 7.5, otherKW: 2.6, busbarKW: 0.4,
    hbmShare: 0.16, vrmEff: 0.915, ibcEff: 0.983, psuEff: 0.975, liquidShare: 1,
    hbm: { type: 'HBM4', gb: 288, tbs: 22, stacks: 8, layers: 12 }, dies: 2,   // stack count not yet published
    nvlink: { gen: 'NVLink 6', tbs: 3.6, domain: 72 }, nicGbps: 1600, fp8PF: null, fp4PF: 35,   // sources give 25–50
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

// ---------- scale-out fabric by NIC speed ----------
// One port per GPU into a non-blocking fat tree. Switch-side modules are counted per port.
const FABRICS = {
  400: { radix: 64, switchKW: 0.75, gpuModuleW: 9, portModuleW: 8.5, portsPerModule: 2, fibersPerLink: 8, switchName: 'Quantum-2, 64 × 400G' },
  800: { radix: 144, switchKW: 2.9, gpuModuleW: 17, portModuleW: 13.5, portsPerModule: 2, fibersPerLink: 8, switchName: 'Quantum-X800, 144 × 800G' },
  1600: { radix: 72, switchKW: 2.9, gpuModuleW: 27, portModuleW: 27, portsPerModule: 1, fibersPerLink: 16, switchName: '72 × 1.6T' },
} as const;

export interface LedgerRow { label: string; mw: number; kind: 'loss' | 'overhead' | 'net' | 'work'; scene: number; basis: Basis }

export function compute(s: Scenario) {
  const accel = ACCELERATORS[s.accel];
  const power = POWER[accel.dc800 ? s.power : 'ac415'];
  const cooling = COOLING[accel.coolingOptions.includes(s.cooling) ? s.cooling : accel.coolingOptions[accel.coolingOptions.length - 1]];
  const meterMW = s.meterMW;

  // ----- one rack, bottom up (kW) -----
  const pkgKW = accel.gpuW * accel.gpusPerRack / 1000;
  const hbmKW = pkgKW * accel.hbmShare, gpuSiliconKW = pkgKW - hbmKW;
  const vrmLossKW = pkgKW / accel.vrmEff - pkgKW;
  const cpuKW = accel.cpusPerRack * accel.cpuW / 1000;
  const load12 = pkgKW + vrmLossKW + cpuKW + accel.scaleupKW + accel.nicKW + accel.otherKW;
  const ibcLossKW = load12 / accel.ibcEff - load12;
  const dcBusKW = load12 + ibcLossKW + accel.busbarKW;
  const rackEff = power.id === 'dc800' ? EFF.rackDcDc : accel.psuEff;
  const rackKW = dcBusKW / rackEff;
  const rackConvKW = rackKW - dcBusKW;

  // ----- fabric per GPU (two tiers if it fits, else three; beyond that, parallel fabrics) -----
  const F = FABRICS[accel.nicGbps];
  const fabricFor = (G: number) => {
    const twoTierMax = F.radix * F.radix / 2, threeTierMax = F.radix ** 3 / 4;
    const tiers = G <= twoTierMax ? 2 : 3;
    const portsPerGpu = tiers === 2 ? 3 : 5, linksPerGpu = tiers === 2 ? 2 : 3;
    const kwPerGpu = portsPerGpu / F.radix * F.switchKW + (F.gpuModuleW + portsPerGpu * F.portModuleW) / 1000;
    return { tiers, portsPerGpu, linksPerGpu, kwPerGpu, planes: Math.max(1, Math.ceil(G / threeTierMax)) };
  };

  // ----- facility: solve for IT load from the meter -----
  const upstream = EFF.mpt * EFF.campus;
  const itPath = power.id === 'dc800' ? EFF.sst * EFF.dcBus * EFF.dcBattery : EFF.unitSub * EFF.ups * EFF.busway;
  const sidePath = EFF.unitSub;   // cooling and building loads
  // meter · upstream = IT / itPath + (coolFrac + misc) · IT / sidePath
  const IT_MW = meterMW * upstream / (1 / itPath + (cooling.coolFrac + MISC_FRAC) / sidePath);
  const coolMW = cooling.coolFrac * IT_MW, miscMW = MISC_FRAC * IT_MW;

  // racks and the network outside them share the IT load
  let fab = fabricFor(IT_MW * 1000 / rackKW * accel.gpusPerRack);
  let racks = Math.floor(IT_MW * 1000 / (rackKW + accel.gpusPerRack * fab.kwPerGpu));
  fab = fabricFor(racks * accel.gpusPerRack);
  racks = Math.floor(IT_MW * 1000 / (rackKW + accel.gpusPerRack * fab.kwPerGpu));
  const gpus = racks * accel.gpusPerRack;

  // ----- network counts -----
  const perTier = gpus;                                    // non-blocking: one link per GPU at every tier
  const leaf = Math.ceil(gpus / (F.radix / 2));
  const spine = fab.tiers === 2 ? Math.ceil(gpus / F.radix) : Math.ceil(gpus / (F.radix / 2));
  const core = fab.tiers === 3 ? Math.ceil(gpus / F.radix) : 0;
  const switches = leaf + spine + core;
  const links = perTier * fab.linksPerGpu;
  const gpuModules = gpus, switchModules = gpus * fab.portsPerGpu / F.portsPerModule;   // twin-port modules carry two switch ports
  const switchMW = switches * F.switchKW / 1000;
  const opticsMW = (gpuModules * F.gpuModuleW + gpus * fab.portsPerGpu * F.portModuleW) / 1e6;
  const dci = { routes: 2, lambdas: 32, gbps: 800, routeKm: 1100, spanKm: 80, cableStrands: 432, portsPerLinecard: 36, litPairs: 0, tbpsPerRoute: 0, modulesPerEnd: 0, huts: 0 };
  dci.litPairs = Math.max(2, Math.round(gpus * 10 / 1000 / 2 / (dci.lambdas * dci.gbps / 1000)));   // ≈10 Gb/s per GPU to other sites
  dci.tbpsPerRoute = dci.litPairs * dci.lambdas * dci.gbps / 1000;
  dci.modulesPerEnd = dci.routes * dci.litPairs * dci.lambdas;
  dci.huts = Math.ceil(dci.routeKm / dci.spanKm) - 1;
  const NET = {
    leaf, spine, core, switches, tiers: fab.tiers, planes: fab.planes, links, gpuModules, switchModules,
    modules: gpuModules + switchModules, fibers: links * F.fibersPerLink,
    crossHallFibers: gpus / 2 * F.fibersPerLink, switchMW, opticsMW,
    nvlinkLinks: racks * (accel.id === 'h100' ? accel.gpusPerRack * 18 : 1296),
    nvlinkPairs: racks * (accel.id === 'h100' ? accel.gpusPerRack * 18 * 4 : 5184),
    nvswitchChips: racks * (accel.id === 'h100' ? 16 : 18),
    dpus: racks * (accel.id === 'h100' ? 8 : 36), dci, fabric: F,
  };

  // ----- the ledger: meter to GPU silicon -----
  const R = racks / 1000;   // kW per rack → MW for the campus
  const itIn = IT_MW / itPath;                 // power entering the IT path
  const sideIn = (coolMW + miscMW) / sidePath;
  const ledger: LedgerRow[] = [
    { label: 'Main power transformers', mw: meterMW * (1 - EFF.mpt), kind: 'loss', scene: 1, basis: 'typical' },
    { label: 'Campus cables & switchgear', mw: meterMW * EFF.mpt * (1 - EFF.campus), kind: 'loss', scene: 1, basis: 'est' },
    ...(power.id === 'dc800' ? [
      { label: 'Unit substations, cooling side', mw: sideIn * (1 - EFF.unitSub), kind: 'loss', scene: 2, basis: 'typical' } as LedgerRow,
      { label: 'Solid-state transformers, MV → 800 V DC', mw: itIn * (1 - EFF.sst), kind: 'loss', scene: 2, basis: 'est' } as LedgerRow,
      { label: '800 V DC bus & batteries', mw: itIn * EFF.sst * (1 - EFF.dcBus * EFF.dcBattery), kind: 'loss', scene: 2, basis: 'est' } as LedgerRow,
    ] : [
      { label: 'Unit substations', mw: (itIn + sideIn) * (1 - EFF.unitSub), kind: 'loss', scene: 2, basis: 'typical' } as LedgerRow,
      { label: 'UPS, double conversion', mw: itIn * EFF.unitSub * (1 - EFF.ups), kind: 'loss', scene: 2, basis: 'typical' } as LedgerRow,
      { label: 'Busway & whips', mw: itIn * EFF.unitSub * EFF.ups * (1 - EFF.busway), kind: 'loss', scene: 2, basis: 'est' } as LedgerRow,
    ]),
    { label: `Cooling: ${cooling.short.toLowerCase()}, ${cooling.sub}`, mw: coolMW, kind: 'overhead', scene: 2, basis: cooling.basis },
    { label: 'Lighting, controls, offices', mw: miscMW, kind: 'overhead', scene: 2, basis: 'est' },
    { label: `Scale-out switches, ${fab.tiers} tiers`, mw: switchMW, kind: 'net', scene: 2, basis: 'est' },
    { label: 'Optical transceivers', mw: opticsMW, kind: 'net', scene: 2, basis: 'est' },
    { label: power.id === 'dc800' ? 'In-rack DC-DC, 800 → 50 V' : (accel.id === 'h100' ? 'Server power supplies, AC → DC' : 'Rack power shelves, AC → DC'), mw: rackConvKW * R, kind: 'loss', scene: 3, basis: power.id === 'dc800' ? 'est' : 'typical' },
    { label: accel.id === 'h100' ? 'Server power cabling' : 'Busbar', mw: accel.busbarKW * R, kind: 'loss', scene: 3, basis: 'est' },
    { label: accel.id === 'h100' ? 'NVSwitch chips (scale-up)' : 'NVLink switch trays (scale-up)', mw: accel.scaleupKW * R, kind: 'net', scene: 3, basis: 'est' },
    { label: accel.cpuName, mw: cpuKW * R, kind: 'work', scene: 4, basis: 'est' },
    { label: accel.id === 'h100' ? 'NICs & DPUs' : 'SuperNICs & DPUs', mw: accel.nicKW * R, kind: 'net', scene: 4, basis: 'est' },
    { label: 'SSDs, fans, management', mw: accel.otherKW * R, kind: 'work', scene: 4, basis: 'est' },
    { label: 'Bus converters, 50 → 12 V', mw: ibcLossKW * R, kind: 'loss', scene: 4, basis: 'est' },
    { label: 'Voltage regulators, 12 → 0.8 V', mw: vrmLossKW * R, kind: 'loss', scene: 4, basis: 'est' },
    { label: `${accel.hbm.type} memory`, mw: hbmKW * R, kind: 'work', scene: 5, basis: 'est' },
  ];
  const ledgerSum = ledger.reduce((a, r) => a + r.mw, 0);
  const gpuSiliconMW = meterMW - ledgerSum;      // what is left: GPU silicon, plus the few racks' worth of rounding
  const marks = [
    { after: 1, label: '34.5 kV feeders' },     // both power paths have three facility rows, so the marks line up
    { after: 6, label: 'IT load' },
    { after: 8, label: 'Into the racks' },
    { after: 14, label: 'GPU modules' },
  ];
  const pue = meterMW / IT_MW;

  // ----- staircases -----
  const kA = (w: number, v: number) => w / (Math.sqrt(3) * v * 0.95);   // three-phase current at pf 0.95
  const fmtA = (a: number) => a >= 1000 ? `≈${(Math.round(a / 100) * 100).toLocaleString('en-US')} A` : `≈${Math.round(a / 5) * 5} A`;
  const staircase = [
    { v: 345000, label: '345 kV', where: 'Transmission line', current: `${fmtA(kA(meterMW * 1e6, 345000) / 2)} per phase`, note: `the whole ${meterMW >= 1000 ? (meterMW / 1000).toFixed(1) + ' GW' : Math.round(meterMW) + ' MW'} campus, 2 circuits`, volt: 'hv', basis: 'est' as Basis },
    { v: 34500, label: '34.5 kV', where: 'Campus feeders', current: `${fmtA(kA(10e6, 34500))} per feeder`, note: 'one 10 MW feeder', volt: 'mv', basis: 'est' as Basis },
    ...(power.id === 'dc800' ? [
      { v: 800, label: '800 V DC', where: 'DC busway to the rack', current: fmtA(rackKW * 1000 / 800), note: `one ${Math.round(rackKW)} kW rack`, volt: 'dc', basis: 'est' as Basis },
    ] : [
      { v: 480, label: '480 V', where: 'Unit substation out', current: fmtA(kA(2.5e6, 480)), note: 'one 2.5 MVA transformer', volt: 'lv', basis: 'est' as Basis },
      { v: 415, label: '415 V', where: 'Busway to the rack', current: `${fmtA(kA(rackKW * 1000, 415))} per phase`, note: `one ${Math.round(rackKW)} kW rack`, volt: 'lv', basis: 'est' as Basis },
    ]),
    { v: 50, label: '50 V', where: accel.id === 'h100' ? 'Server 54 V rail' : 'Rack busbar', current: fmtA(dcBusKW * 1000 / 50), note: accel.id === 'h100' ? 'all 4 servers in a rack' : `one ${Math.round(rackKW)} kW rack, all sections`, volt: 'dc', basis: 'est' as Basis },
    { v: 12, label: '12 V', where: 'Board power rail', current: fmtA((pkgKW + vrmLossKW) * 1000 / accel.gpusPerRack / 12), note: 'one GPU’s share', volt: 'bus12', basis: 'est' as Basis },
    { v: 0.8, label: '0.8 V', where: 'GPU core', current: `≈${(Math.round(accel.gpuW * (1 - accel.hbmShare) / 0.8 / 100) * 100).toLocaleString('en-US')} A`, note: 'into one GPU, split across rails', volt: 'core', basis: 'est' as Basis },
  ];
  const dciPerGpuGBs = dci.tbpsPerRoute * dci.routes * 1000 / 8 / Math.max(1, gpus);
  const bandwidth = [
    ...(accel.dies > 1 ? [{ label: 'NV-HBI', where: 'Die to die', gbs: 10000, latency: 'nanoseconds', note: 'across the seam', cls: 'hbi', basis: 'spec' as Basis }] : []),
    { label: accel.hbm.type, where: 'Memory, on package', gbs: accel.hbm.tbs * 1000, latency: '≈100s of ns', note: 'per GPU', cls: 'hbm', basis: accel.basis },
    { label: accel.nvlink.gen, where: 'Scale-up, in the rack', gbs: accel.nvlink.tbs * 1000, latency: 'sub-µs, unpublished', note: `per GPU, ${accel.nvlink.domain} GPUs`, cls: 'nvl', basis: accel.basis },
    { label: `${accel.nicGbps >= 1000 ? accel.nicGbps / 1000 + 'T' : accel.nicGbps + 'G'}`, where: 'Scale-out, the hall', gbs: accel.nicGbps / 8, latency: '≈1–2 µs', note: 'per GPU', cls: 'eth', basis: 'typical' as Basis },
    { label: 'DWDM', where: 'Scale across, 1,000 km', gbs: +dciPerGpuGBs.toFixed(2), latency: '≈5 ms one way', note: 'per GPU share of the site links', cls: 'dci', basis: 'est' as Basis },
  ];

  // ----- layout counts for the campus scene -----
  const layout = {
    halls: Math.max(1, Math.ceil(IT_MW / 45)),
    transformers: Math.ceil(meterMW / 75) + 1,
    gensets: Math.ceil(meterMW / 3 * 1.2),
    bessMWh: Math.round(meterMW * 0.4),
    chillers: cooling.id === 'warm' ? 0 : Math.ceil(IT_MW / 4),
  };

  return {
    scenario: { meterMW, accel: accel.id, power: power.id, cooling: cooling.id } as Scenario,
    accel, power, cooling,
    meterMW, IT_MW, pue, wue: cooling.wue, coolMW, miscMW,
    rack: { kw: rackKW, dcBusKW, convKW: rackConvKW, pkgKW, hbmKW, gpuSiliconKW, vrmLossKW, ibcLossKW, cpuKW, gpus: accel.gpusPerRack },
    racks, gpus, cpus: racks * accel.cpusPerRack,
    fabric: fab, NET,
    ledger, gpuSiliconMW, marks,
    staircase, bandwidth, layout,
    tokPerGpuRef: Math.round(2000 * accel.hbm.tbs / 8 / 50) * 50,   // decode is memory-bound: scale with HBM bandwidth
    halls: layout.halls,
  };
}
export type Model = ReturnType<typeof compute>;
