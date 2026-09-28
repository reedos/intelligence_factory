import { describe, it, expect } from 'vitest';
import { compute, ACCELERATORS, POWER, COOLING, WATER } from './engine';
import { makeSim, SIMS, totals, trainingStorage } from './clock';
import { content } from '../data.js';

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
  // Superseded: this used to assert the rack storage flattened a training step to near nothing (an
  // unconstrained 0.6 s low-pass, no capacity check). Reproducing that would need ~350 J/GPU before a
  // checkpoint and ~759 J/GPU across one, against NVIDIA's stated 65 J/GPU — audit item 8. The tests
  // below check the honest, capacity-bounded replacement instead.
  it('rack and site storage never exceed their declared capacity or power rating, and energy reconciles exactly at every step', () => {
    for (const accel of ['gb200', 'gb300', 'rubin'] as const) {
      const M = run({ accel }), ts = trainingStorage(M);
      for (let i = 0; i < ts.N; i++) {
        expect(ts.rackSocMJ[i], `rack soc at step ${i}`).toBeGreaterThanOrEqual(-1e-9);
        expect(ts.rackSocMJ[i], `rack soc at step ${i}`).toBeLessThanOrEqual(ts.rackCapMJ + 1e-9);
        expect(ts.siteSocMJ[i], `site soc at step ${i}`).toBeGreaterThanOrEqual(-1e-9);
        expect(ts.siteSocMJ[i], `site soc at step ${i}`).toBeLessThanOrEqual(ts.siteCapMJ + 1e-9);
      }
      for (let i = 1; i < ts.N; i++) {
        const demandMW = ts.g(i * ts.dt) * ts.G;
        const rackPowerMW = ts.rackMW[i] - demandMW;         // + charging, - discharging
        expect(Math.abs(rackPowerMW), `rack power at step ${i}`).toBeLessThanOrEqual(ts.rackPowerMW + 1e-6);
        expect((ts.rackSocMJ[i] - ts.rackSocMJ[i - 1]) / ts.dt, `rack energy conservation at step ${i}`).toBeCloseTo(rackPowerMW, 6);
        const sitePowerMW = ts.siteMW[i] - ts.rackMW[i];
        expect(Math.abs(sitePowerMW), `site power at step ${i}`).toBeLessThanOrEqual(ts.sitePowerMW + 1e-6);
        expect((ts.siteSocMJ[i] - ts.siteSocMJ[i - 1]) / ts.dt, `site energy conservation at step ${i}`).toBeCloseTo(sitePowerMW, 6);
      }
    }
  });
  it('GB300 rack storage is too small to smooth a sustained step swing (its whole 65 J/GPU drains in well under a second); site batteries narrow the steady cycling but not the checkpoint dip', () => {
    const sim = makeSim(run({ accel: 'gb300' }), 'training'), s = grid(sim, 3000).filter(x => x.t > 3 && x.t < 36);
    const range = (k: string) => Math.max(...s.map(x => x.values[k])) - Math.min(...s.map(x => x.values[k]));
    expect(range('rack')).toBeGreaterThan(range('raw') * 0.95);     // 65 J/GPU can't touch a multi-cycle swing
    expect(range('site')).toBeLessThan(range('raw') * 0.2);         // but the site batteries flatten the steady cycling
    const full = grid(sim, 6000);
    const fullRange = (k: string) => Math.max(...full.map(x => x.values[k])) - Math.min(...full.map(x => x.values[k]));
    expect(fullRange('site')).toBeGreaterThan(range('site') * 2);   // the checkpoint dip needs more than the site batteries' rated power
  });
});

describe('one set of temperature assumptions, shared by the cards and the clocks', () => {
  it('the hot-day adiabatic-assist threshold is the same 35 °C data.js\'s TEMPS card shows for warm-water cooling', () => {
    const M = run({ cooling: 'warm' });
    const row = (content(M) as any).TEMPS.find((r: any) => r.label === 'Outdoor air, hot day');
    expect(row.c).toBe(WATER.warmAdiabaticC);
    // and the sim itself only starts spraying at or above that same point, not some other number
    const sim = makeSim(M, 'hotday');
    expect(sim.sample(sim.events[0].t - 0.5).waterM3h).toBeLessThan(sim.sample(sim.events[0].t + 0.5).waterM3h);
  });
  it('the chilled-water-supply figure is the same for liquid cooling everywhere it appears', () => {
    const M = run({ cooling: 'liquid' });
    const row = (content(M) as any).TEMPS.find((r: any) => r.label === 'Chilled water supply');
    expect(row.c).toBe(WATER.liquidSupplyC);
  });
});

describe('outage', () => {
  it('batteries carry the load until the generators; no gap in supply, and every source sums to siteMW', () => {
    const M = run(), sim = makeSim(M, 'outage'), fail = sim.events[0].t;
    for (const s of grid(sim, 4000)) {
      const supply = s.values.grid + s.values.battery + s.values.gens;
      expect(supply, `supply at ${s.t}`).toBeGreaterThan(M.meterMW * 0.5);   // cooling sheds, IT never drops
      expect(supply, `siteMW at ${s.t}`).toBeCloseTo(s.siteMW, 6);
    }
    expect(sim.sample(fail + 5).values.battery).toBeGreaterThan(0);
    expect(sim.sample(fail + 5).values.gens).toBe(0);
    expect(sim.sample(fail + 12).values.gens).toBeGreaterThan(sim.sample(fail + 12).values.battery);
  });

  it('NFPA 110 Type 10: the emergency system assumes its full rated load within 10 s of the failure, and not a moment sooner either', () => {
    const sim = makeSim(run(), 'outage'), fail = sim.events[0].t;
    const full = sim.sample(fail + 10);
    expect(full.values.battery).toBeCloseTo(0, 6);            // no more battery or bridge contribution
    expect(full.values.gens).toBeCloseTo(full.siteMW, 6);     // generators alone carry the whole load
    expect(sim.sample(fail + 9.99).values.gens).toBeLessThan(full.values.gens);   // still ramping a moment before
  });

  it('the utility meter reads zero while islanded, but the site keeps drawing power the whole time', () => {
    const sim = makeSim(run(), 'outage'), fail = sim.events[0].t;
    const retransfer = sim.events.find(e => e.label === 'Back on the grid')!.t;
    const mid = (fail + retransfer) / 2;
    expect(sim.sample(mid).meterMW).toBe(0);
    expect(sim.sample(mid).siteMW).toBeGreaterThan(0);
  });

  it('energy totals separate utility-only from site-wide draw, and integrate exactly across the grid-loss instant', () => {
    const M = run(), sim = makeSim(M, 'outage'), fail = sim.events[0].t, t = 900;
    const tot = totals(sim, t, 120);   // the coarse resolution the live UI actually uses
    // The grid supplied the full load for exactly the first `fail` seconds, then nothing until it returns
    expect(tot.mwh).toBeCloseTo(M.meterMW * fail / 3600, 6);
    // Independent fine-grained reference for the site-wide total, bypassing totals()'s own breakpoint logic
    let refMwh = 0; const N = 20000;
    for (let i = 0; i < N; i++) { const a = t * i / N, b = t * (i + 1) / N; refMwh += sim.sample((a + b) / 2).siteMW * (b - a) / 3600; }
    expect(tot.siteMwh).toBeCloseTo(refMwh, 1);
    expect(tot.siteMwh).toBeGreaterThan(tot.mwh * 5);   // the site never stopped drawing power; the utility mostly did
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
