import { describe, it, expect } from 'vitest';
import { compute, ACCELERATORS, POWER, COOLING } from './engine';
import { makeSim, SIMS, totals } from './clock';

const run = (s = {}) => compute({ meterMW: 100, accel: 'gb200', power: 'ac415', cooling: 'warm', ...s } as any);
const grid = (sim: any, n = 600) => Array.from({ length: n + 1 }, (_, i) => sim.sample(sim.duration * i / n));

describe('every sim, every scenario', () => {
  for (const accel of Object.keys(ACCELERATORS)) for (const power of Object.keys(POWER)) for (const cooling of Object.keys(COOLING))
    for (const { id } of SIMS) it(`${id}: ${accel}/${power}/${cooling} samples are finite and sane`, () => {
      const M = run({ accel, power, cooling }), sim = makeSim(M, id);
      for (const s of grid(sim, 300)) {
        expect(Number.isFinite(s.meterMW)).toBe(true);
        expect(s.meterMW).toBeGreaterThanOrEqual(0);
        expect(s.meterMW).toBeLessThan(M.meterMW * 1.35);
        for (const k of sim.series.map(x => x.key)) expect(Number.isFinite(s.values[k]), `${k} at ${s.t}`).toBe(true);
        for (const v of Object.values(s.levels)) expect(v).toBeGreaterThanOrEqual(0);
        expect(s.phase.length).toBeGreaterThan(3);
      }
    });
});

describe('training', () => {
  it('swings the campus by most of the GPU power, and the step sits in the 0.2–3 Hz band', () => {
    const M = run(), sim = makeSim(M, 'training');
    const v = grid(sim, 3000).filter(s => s.t < 36).map(s => s.values.raw);
    const swing = Math.max(...v) - Math.min(...v);
    expect(swing / M.meterMW).toBeGreaterThan(0.3);
    expect(swing / M.meterMW).toBeLessThan(0.7);
    // count rising edges through the midpoint in 30 s
    const mid = (Math.max(...v) + Math.min(...v)) / 2; let up = 0;
    for (let i = 1; i < v.length; i++) if (v[i - 1] < mid && v[i] >= mid) up++;
    const hz = up / 36;
    expect(hz).toBeGreaterThanOrEqual(0.2); expect(hz).toBeLessThanOrEqual(3);
  });
  it('GB300 rack storage cuts the swing the grid sees; site batteries flatten it', () => {
    const sim = makeSim(run({ accel: 'gb300' }), 'training'), s = grid(sim, 3000).filter(x => x.t > 3 && x.t < 36);
    const range = (k: string) => Math.max(...s.map(x => x.values[k])) - Math.min(...s.map(x => x.values[k]));
    expect(range('rack')).toBeLessThan(range('raw') * 0.8);
    expect(range('site')).toBeLessThan(1e-9);
  });
});

describe('outage', () => {
  it('batteries carry the load until the generators, which take it within 10 s; no gap in supply', () => {
    const M = run(), sim = makeSim(M, 'outage'), fail = sim.events[0].t;
    for (const s of grid(sim, 4000)) {
      const supply = s.values.grid + s.values.battery + s.values.gens;
      expect(supply, `supply at ${s.t}`).toBeGreaterThan(M.meterMW * 0.5);   // cooling sheds, IT never drops
    }
    expect(sim.sample(fail + 5).values.battery).toBeGreaterThan(0);
    expect(sim.sample(fail + 5).values.gens).toBe(0);
    expect(sim.sample(fail + 12).values.gens).toBeGreaterThan(sim.sample(fail + 12).values.battery);
    expect(sim.events.find(e => e.label.startsWith('Generators'))!.t - fail).toBeLessThanOrEqual(10);
  });
});

describe('hot day', () => {
  it('warm-water campuses start using water only above ≈35 °C', () => {
    const sim = makeSim(run({ cooling: 'warm' }), 'hotday');
    const night = sim.sample(4), noon = sim.sample(15);
    expect(night.values.temp).toBeLessThan(35); expect(noon.values.temp).toBeGreaterThan(35);
    expect(noon.waterM3h).toBeGreaterThan(night.waterM3h * 5);
    expect(sim.events.length).toBe(2);
  });
  it('chilled campuses draw more power in the afternoon', () => {
    const sim = makeSim(run({ accel: 'h100', cooling: 'air' }), 'hotday');
    expect(sim.sample(15).meterMW).toBeGreaterThan(sim.sample(4).meterMW);
  });
});

describe('inference day', () => {
  it('demand spans the chosen peak-to-trough ratio, and energy per token is worst at the trough', () => {
    const sim = makeSim(run(), 'inference', { peakTrough: 3 });
    const s = grid(sim, 960), d = s.map(x => x.values.demand);
    expect(Math.max(...d) / Math.min(...d)).toBeCloseTo(3, 1);
    const lo = s.reduce((a, b) => (b.values.demand < a.values.demand ? b : a)), hi = s.reduce((a, b) => (b.values.demand > a.values.demand ? b : a));
    expect(lo.values.jtok).toBeGreaterThan(hi.values.jtok);
    expect(lo.t < 8 || lo.t > 22).toBe(true);   // trough overnight
    expect(hi.t).toBeGreaterThan(9); expect(hi.t).toBeLessThan(19);
  });
  it('counters integrate: a day of inference uses about meter × 24 h', () => {
    const M = run(), sim = makeSim(M, 'inference'), tot = totals(sim, 24);
    expect(tot.mwh).toBeGreaterThan(M.meterMW * 24 * 0.6);
    expect(tot.mwh).toBeLessThan(M.meterMW * 24 * 1.01);
    expect(tot.tokens).toBeGreaterThan(0);
  });
});
