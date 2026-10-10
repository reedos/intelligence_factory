import { expect, it } from 'vitest';
import { compute, ACCELERATORS, FABRICS, waterM3h } from './engine';
import { tokenFigures, calc } from './tokens.js';
import { content, dieFlux, FACTS } from '../data.js';
import { allClaims } from '../claims.js';
import { tokenMath, TOKEN_MATH_MODEL } from './token-math.js';

it('retains enough real transformer capacity after one unit is unavailable', () => {
  for (const meterMW of [75, 142.5, 150, 400, 570, 600, 1000, 5000]) {
    const m = compute({ meterMW, accel: 'gb200', power: 'ac415', cooling: 'warm' });
    const availableMW = Array.from({ length: m.layout.transformers - 1 }, () => m.layout.mvaUnit * 0.95).reduce((a, b) => a + b, 0);
    expect(availableMW, `${meterMW} MW after one outage`).toBeGreaterThanOrEqual(meterMW);
    expect(availableMW - m.layout.mvaUnit * 0.95).toBeLessThan(meterMW);
  }
});

it('visible evidence describes the quantity actually displayed', () => {
  const m = compute({ meterMW: 150, accel: 'gb200', power: 'ac415', cooling: 'warm' });
  const claims = allClaims(m, content(m));
  const fuel = claims.find(c => c.label === 'Diesel on site, 48 h')!;
  expect(fuel.ev.calc).toBe('campus-fuel-volume');
  expect(fuel.value).toContain('1.9 million L');
  // An hour at 150,000 kW burns 39,000 L; forty-eight hours is 1.872 million L.
  expect(m.layout.fuelML / 1.872).toBeCloseTo(1, 12);
  const cpu = claims.find(c => c.ev?.calc === 'cpu-memory-per-cpu')!;
  expect(cpu.value).toContain('≈470 GB');
  expect(Math.abs(470 * 36 / 17000 - 1)).toBeLessThan(0.01);
  const h = compute({ meterMW: 100, accel: 'h100', power: 'ac415', cooling: 'air' });
  expect(content(h).SCENES.find(s => s.id === 'chip')!.intro).toContain('about 800 amps');
});

// Check dimensions by reconstructing an hour of operation and a physical die area,
// instead of copying each displayed quantity's forward expression.
for (const accel of Object.keys(ACCELERATORS) as (keyof typeof ACCELERATORS)[]) {
  for (const power of ['ac415', 'dc800'] as const) {
    it(`${accel}/${power}: independent energy, water, traffic and heat balances`, () => {
      const m = compute({ meterMW: 250, accel, power, cooling: 'warm' });
      const close = (actual: number, expected: number, rel = 1e-10) => expect(Math.abs(actual - expected) / Math.max(Math.abs(expected), 1e-12)).toBeLessThanOrEqual(rel);
      const tokens = tokenFigures(m, { ...calc, withTrain: false });
      const repliesPerHour = tokens.rate * 3600 / 500;
      close(tokens.whReply * repliesPerHour / 1e6, m.meterMW);
      close(tokens.waterReply * repliesPerHour / 1e6, waterM3h(m)); // mL to m³
      close(tokens.co2Reply * repliesPerHour / (calc.carbon * 1000), m.meterMW);
      close(waterM3h(m) * 1000 / m.wue / 1000, m.IT_MW);
      const energy = m.ledger.reduce((sum, row) => sum + row.mw * 3.6e9, m.gpuSiliconMW * 3.6e9);
      close(energy / 3.6e9, m.meterMW);
      for (const row of m.bandwidth) {
        if (row.cls === 'hbm') close(row.gbs * 1e9, m.accel.hbm.tbs * 1e12);
        if (row.cls === 'nvl') close(row.gbs * 8 * 2, m.accel.nvlink.tbs * 8000);
        if (row.cls === 'eth') close(row.gbs * 8, m.accel.nicGbps);
      }
      const heatWatts = dieFlux(m.accel) * FACTS[accel].dieCm2;
      // Display rounds to the nearest 5 W/cm²: propagate that resolution to watts.
      close(heatWatts, m.accel.gpuW * (1 - m.accel.hbmShare), 2.5 * FACTS[accel].dieCm2 / (m.accel.gpuW * (1 - m.accel.hbmShare)) + 1e-12);
    });
  }
}

it('compares compute and memory only at the model arithmetic precision', () => {
  const m = compute({ meterMW: 100, accel: 'rubin', power: 'dc800', cooling: 'warm' });
  const missing = { ...m, accel: { ...m.accel, fp8PF: null } };
  expect(tokenMath(missing).mathS).toBeNull();
  expect(tokenMath(missing).balance).toBeNull();
  expect(tokenMath(m).mathS! * 17.5e15 / 140e9).toBeCloseTo(1, 10);
  const fp4 = tokenMath(m, { ...TOKEN_MATH_MODEL, precision: 'FP4', bytesPerParam: 0.5 });
  expect(fp4.mathS! * 35e15 / 140e9).toBeCloseTo(1, 10);
  expect(fp4.readS * 19.2e12 / 35e9).toBeCloseTo(1, 10);
});

it('facility and rack counts satisfy independently reconstructed capacity budgets', () => {
  const near = (a: number, b: number, rel = 1e-10) => expect(Math.abs(a - b) / Math.max(Math.abs(b), 1e-12)).toBeLessThanOrEqual(rel);
  const covers = (count: number, unit: number, demand: number, minimum = 0) => {
    expect(count * unit + 1e-10).toBeGreaterThanOrEqual(demand);
    if (count > minimum) expect((count - 1) * unit).toBeLessThan(demand);
  };
  for (const a of Object.values(ACCELERATORS)) for (const power of ['ac415', 'dc800'] as const) for (const cooling of a.coolingOptions) for (const meterMW of [10, 100, 1000]) {
    const m = compute({ meterMW, accel: a.id, power, cooling }), l = m.layout;
    // Work backward from the meter: upstream losses, then divide incoming power
    // between IT and the cooling/building branch by numerical bisection.
    const input = meterMW * 0.996 * 0.997;
    const path = m.power.id === 'dc800' ? [0.98, 0.997, 0.998] : [0.99, 0.965, 0.995];
    let low = 0, high = input;
    for (let i = 0; i < 70; i++) {
      const it = (low + high) / 2;
      let required = it;
      for (const efficiency of [...path].reverse()) required /= efficiency;
      required += (it * m.cooling.coolFrac + it * 0.017) / 0.99;
      if (required > input) high = it; else low = it;
    }
    near(m.IT_MW, (low + high) / 2);
    const atBusbar = m.rack.kw * m.rack.eff;
    const atBoards = (atBusbar - a.busbarKW) * a.ibcEff;
    const atGpuRegulators = atBoards - a.cpusPerRack * a.cpuW / 1000 - a.scaleupKW - a.nicKW - a.otherKW;
    near(atGpuRegulators * a.vrmEff * 1000, a.gpusPerRack * a.gpuW);
    near(m.coolMW, m.IT_MW * m.cooling.coolFrac);
    near(m.miscMW, m.IT_MW * 0.017);
    covers(l.halls, 45, m.IT_MW, 1);
    covers(l.feeders, 10, meterMW, 2);
    covers(l.gensets, 3, meterMW * 1.2);
    covers(l.unitSubs, 2.2, meterMW * 0.97);
    const inletIT = path.reduce((v, e) => v / e, m.IT_MW);
    covers(m.power.id === 'dc800' ? l.sstModules : l.upsModules, m.power.id === 'dc800' ? 2.5 : 1.25, inletIT);
    const liquid = m.cooling.id === 'air' ? 0 : m.IT_MW * a.liquidShare;
    covers(l.cdus, 1.25, liquid);
    covers(l.airUnits, m.cooling.id === 'air' ? 0.1 : 0.4, m.IT_MW - liquid);
    covers(m.cooling.id === 'warm' ? l.dryCoolers : l.chillers, m.cooling.id === 'warm' ? 0.8 : 4, m.IT_MW * 1.1);
    covers(l.towers, m.cooling.id === 'warm' ? 16 : 6, m.IT_MW * (m.cooling.id === 'warm' ? 1 : 1.3));
    const f = FABRICS[a.nicPortGbps], endpoints = m.gpus * a.nicsPerGpu;
    covers(m.NET.leaf, f.radix / 2, endpoints);
    covers(m.NET.spine, m.fabric.tiers === 2 ? f.radix : f.radix / 2, endpoints);
    if (m.fabric.tiers === 3) covers(m.NET.core, f.radix, endpoints);
    near(m.gpus, m.racks * a.gpusPerRack);
    near(m.cpus, m.racks * a.cpusPerRack);
    near(m.NET.crossHallFibers * 2 / f.fibersPerLink, endpoints);
    const occupiedSwitchPorts = endpoints * (m.fabric.tiers === 2 ? 3 : 5);
    near(m.NET.links * 2, occupiedSwitchPorts + endpoints);
    near(m.NET.gpuModules * a.gpuPortsPerModule, endpoints);
    near(m.NET.switchModules * f.portsPerModule, occupiedSwitchPorts);
    near(m.NET.fibers / f.fibersPerLink, m.NET.links);
    near(m.NET.switchMW * 1000 / f.switchKW, m.NET.switches);
    near(m.NET.opticsMW * 1e6, endpoints * f.gpuModuleW + occupiedSwitchPorts * f.portModuleW);
    near(m.hbmStacks / m.gpus, a.hbm.stacks);
    const hbm = allClaims(m, content(m)).find(c => c.label === 'Share of GPU power')!;
    near(parseFloat(String(hbm.value).replace('≈', '')) / 100, a.hbmShare);
  }
});
