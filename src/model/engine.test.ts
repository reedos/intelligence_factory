import { describe, expect, it } from 'vitest';
import { compute, DEFAULT_SCENARIO, ACCELERATORS, type Scenario } from './engine';

const run = (s: Partial<Scenario> = {}) => compute({ ...DEFAULT_SCENARIO, ...s });

describe('energy is conserved', () => {
  for (const accel of Object.keys(ACCELERATORS) as Scenario['accel'][]) {
    for (const power of ['ac415', 'dc800'] as const) {
      for (const cooling of ['air', 'liquid', 'warm'] as const) {
        it(`${accel} · ${power} · ${cooling}: ledger plus GPU silicon equals the meter`, () => {
          const m = run({ accel, power, cooling, meterMW: 250 });
          const sum = m.ledger.reduce((a, r) => a + r.mw, 0) + m.gpuSiliconMW;
          expect(sum).toBeCloseTo(m.meterMW, 9);
          expect(m.ledger.every(r => r.mw >= 0)).toBe(true);
          expect(m.gpuSiliconMW).toBeGreaterThan(0);
        });
      }
    }
  }
});

describe('racks match their published power', () => {
  for (const a of Object.values(ACCELERATORS)) {
    it(`${a.name}: bottom-up rack power lands in ${a.publishedRackKW.join('–')} kW`, () => {
      const m = run({ accel: a.id, power: 'ac415', cooling: a.coolingOptions[0] });
      expect(m.rack.kw).toBeGreaterThanOrEqual(a.publishedRackKW[0] * 0.97);
      expect(m.rack.kw).toBeLessThanOrEqual(a.publishedRackKW[1] * 1.03);
    });
  }
  it('GB200 package power matches GPU silicon plus HBM (1,200 W × 72)', () => {
    const m = run();
    expect(m.rack.gpuSiliconKW + m.rack.hbmKW).toBeCloseTo(86.4, 6);
  });
});

describe('the reference campus stays where the page has described it', () => {
  const m = run();
  it('100 MW of GB200 with warm-water cooling lands in the published warm-water band plus a double-conversion UPS', () => {
    expect(m.pue).toBeGreaterThan(1.1);
    expect(m.pue).toBeLessThan(1.2);
  });
  it('about 600 racks and 43,000 GPUs', () => {
    expect(m.racks).toBeGreaterThan(560);
    expect(m.racks).toBeLessThan(640);
    expect(m.gpus).toBe(m.racks * 72);
  });
  it('a three-tier fabric with 3.5 optical modules per GPU', () => {
    expect(m.fabric.tiers).toBe(3);
    expect(m.NET.modules / m.gpus).toBeCloseTo(3.5, 6);   // 1 at the NIC + 5 switch ports on twin-port modules
  });
});

describe('choices move the numbers the right way', () => {
  it('cooling lands in its published PUE band: air ≈1.5, chilled liquid ≈1.1–1.2, warm water lowest', () => {
    expect(run({ accel: 'h100', cooling: 'air' }).pue).toBeGreaterThan(1.4);
    expect(run({ accel: 'h100', cooling: 'air' }).pue).toBeLessThan(1.6);
    expect(run({ cooling: 'liquid' }).pue).toBeLessThan(1.25);
  });
  it('cooling: air costs more than chilled liquid, which costs more than warm water', () => {
    const air = run({ accel: 'h100', cooling: 'air' }).pue;
    const liq = run({ cooling: 'liquid' }).pue, warm = run({ cooling: 'warm' }).pue;
    expect(air).toBeGreaterThan(liq);
    expect(liq).toBeGreaterThan(warm);
  });
  it('800 V DC delivers more IT power from the same meter, within NVIDIA’s "up to 5%"', () => {
    const ac = run({ power: 'ac415' }), dc = run({ power: 'dc800' });
    const gain = dc.gpuSiliconMW / ac.gpuSiliconMW - 1;
    expect(gain).toBeGreaterThan(0.01);
    expect(gain).toBeLessThan(0.05);
  });
  it('H100 cannot take 800 V DC or warm water; the engine falls back', () => {
    const m = run({ accel: 'h100', power: 'dc800', cooling: 'warm' });
    expect(m.power.id).toBe('ac415');
    expect(m.cooling.id).not.toBe('warm');
  });
  it('NVL72 racks are liquid-cooled only', () => {
    expect(run({ accel: 'gb200', cooling: 'air' }).cooling.id).not.toBe('air');
  });
  it('racks scale with the meter', () => {
    const small = run({ meterMW: 20 }), big = run({ meterMW: 1000 });
    expect(big.racks / small.racks).toBeGreaterThan(45);
    expect(big.racks / small.racks).toBeLessThan(55);
  });
  it('a small cluster fits in two fabric tiers', () => {
    // GB200's reference fabric is 400G (radix 64, two-tier limit 64²/2 = 2,048 GPUs), so "small" here means
    // small enough for that, not the 10 MW that used to fit under the old, wrongly-assumed 800G/radix-144 fabric.
    const m = run({ meterMW: 2 });
    expect(m.fabric.tiers).toBe(2);
    expect(m.NET.core).toBe(0);
  });
  it('the fabric never has fewer ports than it needs', () => {
    for (const meterMW of [10, 100, 1000, 5000]) {
      const m = run({ meterMW });
      const ports = m.NET.switches * m.NET.fabric.radix;
      expect(ports).toBeGreaterThanOrEqual(m.gpus * m.fabric.portsPerGpu);
    }
  });
});

describe('the network solves to a feasible topology at every tier transition', () => {
  // A two-tier fat tree of radix R can carry at most R²/2 GPUs (one non-blocking link per GPU at every tier).
  // Below that, a two-tier fabric fits; at and above it, the campus needs a third tier — and because a third
  // tier costs more switch power per GPU, the racks it actually buys must themselves fit back inside R²/2 too
  // (issue 10: the old code picked a tier count from an estimate, then let the final rack count drift past it).
  for (const [accel, points] of Object.entries({
    // [below, at-or-just-above] meterMW, straddling this accelerator's own two-tier boundary
    h100: [3, 4], gb200: [3, 5], gb300: [24, 27], rubin: [7, 9],
  }) as [Scenario['accel'], [number, number]][]) {
    it(`${accel}: never reports two tiers with more GPUs than the fabric's own limit`, () => {
      for (const meterMW of points) {
        const m = run({ accel, meterMW });
        const twoTierMax = m.NET.fabric.radix ** 2 / 2;
        if (m.fabric.tiers === 2) expect(m.gpus).toBeLessThanOrEqual(twoTierMax);
        else expect(m.fabric.tiers).toBe(3);
        // whichever tier was chosen, it must still have enough ports for the GPUs it ended up with
        expect(m.NET.switches * m.NET.fabric.radix).toBeGreaterThanOrEqual(m.gpus * m.fabric.portsPerGpu);
      }
    });
  }
  it('reproduces the audit\'s exact GB300-at-27-MW case within its own fabric\'s capacity', () => {
    // The audit's counterexample: two fixed topology passes landed on 10,656 GB200 GPUs (and the GB300-at-27-MW
    // equivalent) past the fabric's own two-tier limit (144²/2 = 10,368 for GB300's 800G/radix-144 fabric).
    const m = run({ accel: 'gb300', meterMW: 27 });
    const twoTierMax = m.NET.fabric.radix ** 2 / 2;
    expect(m.fabric.tiers).toBe(3);
    expect(m.gpus).toBeLessThanOrEqual(twoTierMax);
  });
});

describe('GB200 follows NVIDIA\'s reference fabric', () => {
  it('is 400G, one ConnectX-7 port per GPU, not an assumed 800G upgrade', () => {
    expect(ACCELERATORS.gb200.nicGbps).toBe(400);
    const m = run();
    expect(m.NET.fabric.switchName).toContain('Quantum-2');   // FABRICS[400], not FABRICS[800]'s Quantum-X800
    expect(m.NET.fabric.radix).toBe(64);
  });
  it('GB300 keeps the 800G ConnectX-8 upgrade path as its own default', () => {
    expect(ACCELERATORS.gb300.nicGbps).toBe(800);
  });
});

describe('the bandwidth staircase compares like with like', () => {
  it('states a direction and scope for every row, and halves NVLink\'s vendor-quoted bidirectional figure', () => {
    const m = run();
    const nvlink = m.bandwidth.find(b => b.cls === 'nvl')!, nic = m.bandwidth.find(b => b.cls === 'eth')!;
    expect(nvlink.dir).toBe('each way');
    expect(nvlink.gbs).toBeCloseTo(m.accel.nvlink.tbs * 500, 6);   // 900 GB/s each way for GB200's 1.8 TB/s bidirectional
    expect(nic.dir).toBe('each way');
    expect(nic.gbs).toBeCloseTo(m.accel.nicGbps / 8, 6);           // a port's line rate is already a per-direction figure
    expect(nvlink.gbs).toBeGreaterThan(nic.gbs);                   // NVLink still comfortably outruns the NIC, each way
    for (const b of m.bandwidth) expect(['aggregate', 'each way', 'shared']).toContain(b.dir);
  });
});

describe('GPU silicon is a physical sum, not a leftover residual', () => {
  it('equals the rack-level silicon figure times the whole racks built, with the rounding gap shown separately', () => {
    const m = run({ meterMW: 10 });   // a size whose rack count doesn't divide the campus power evenly
    expect(m.gpuSiliconMW).toBeCloseTo(m.rack.gpuSiliconKW * m.racks / 1000, 9);
    const spare = m.ledger.find(r => r.label.startsWith('Unallocated'));
    expect(spare).toBeDefined();
    expect(spare!.mw).toBeGreaterThanOrEqual(0);
    // conservation still holds with the spare row counted, the same invariant engine.test's first describe checks
    expect(m.ledger.reduce((a, r) => a + r.mw, 0) + m.gpuSiliconMW).toBeCloseTo(m.meterMW, 9);
  });
  it('no longer folds the whole-rack rounding gap into the silicon figure (the audit\'s +2.48% at 10 MW GB200)', () => {
    const m = run({ meterMW: 10 });
    const spareMW = m.ledger.find(r => r.label.startsWith('Unallocated'))!.mw;
    const oldWayGpuSiliconMW = m.gpuSiliconMW + spareMW;   // what the old "meter minus everything else" formula reported
    expect(m.gpuSiliconMW).toBeLessThan(oldWayGpuSiliconMW);
    expect(spareMW / m.meterMW).toBeLessThan(0.01);   // a rounding sliver, not a meaningful share of the campus
  });
});

describe('one voltage field per rail (issue 18a/18b)', () => {
  it('H100\'s rail is 54 V and its current is computed at 54 V, not a mismatched 50 V', () => {
    const m = run({ accel: 'h100' });
    const rail = m.staircase.find(s => s.label === '54 V')!;
    expect(rail).toBeDefined();
    const expectedA = Math.round(m.rack.dcBusKW * 1000 / 54 / 5) * 5;
    expect(rail.current).toBe(`≈${expectedA} A`);
  });
  it('the 2.5 MVA unit substation reads current from apparent power, with no separate power-factor term', () => {
    const m = run({ accel: 'gb200', power: 'ac415' });
    const row = m.staircase.find(s => s.where === 'Unit substation out')!;
    const expectedA = Math.round(2.5e6 / (Math.sqrt(3) * 480) / 100) * 100;
    expect(row.current).toBe(`≈${expectedA.toLocaleString('en-US')} A`);
  });
});
