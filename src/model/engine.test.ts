import { describe, expect, it } from 'vitest';
import { compute, DEFAULT_SCENARIO, ACCELERATORS, waterM3h, type Scenario } from './engine';

const run = (s: Partial<Scenario> = {}) => compute({ ...DEFAULT_SCENARIO, ...s });

describe('WUE is measured against IT energy, not meter energy', () => {
  it('the default 100 MW scenario: 86.3506 MW IT × 0.16 L/kWh × 24 h = 331.6 m³/day, not the 384 a meter-based figure would give', () => {
    const m = run();
    expect(m.IT_MW).toBeCloseTo(86.3506, 3);
    expect(waterM3h(m) * 24).toBeCloseTo(331.6, 0);
    expect(m.meterMW * 24 * m.wue).toBeCloseTo(384, 0);   // the wrong, meter-based number, kept here so the two never drift into agreement by accident
  });
  it('scales with IT power, not meter power, so a fixed meter size with more overhead uses less water here', () => {
    const air = run({ accel: 'h100', cooling: 'air' }), warm = run({ accel: 'gb200', cooling: 'warm' });
    expect(waterM3h(air)).toBeCloseTo(air.IT_MW * air.wue, 9);
    expect(waterM3h(warm)).toBeCloseTo(warm.IT_MW * warm.wue, 9);
  });
  it('a coolFrac argument scales the rate linearly, for a partly-throttled cooling plant', () => {
    const m = run();
    expect(waterM3h(m, 0.5)).toBeCloseTo(waterM3h(m) / 2, 9);
    expect(waterM3h(m, 0)).toBe(0);
  });
});

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
    const m = run({ meterMW: 10 });
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
