// A real campus sized from its operator's own GPU counts (sites.ts `fleet`), held to what Reed asked for on 09/28/2026:
// Colossus 2 is Elon Musk's 09/25/2026 snapshot, 110k GB200 + 440k GB300, not the old all-GB300 1.1 GW scenario;
// its later stages are dated plans, never the default; the GB200s stay GB200s in every total; the generic slider
// campus is untouched.
import { describe, it, expect } from 'vitest';
import { compute, ACCELERATORS } from './engine';
import { SITES } from './sites';
import { content } from '../data.js';

const C2 = SITES.colossus2 as any;
const at = (stage: number | undefined, extra = {}) => compute({ ...C2.scenario, site: 'colossus2', stage, ...extra } as any) as any;

describe('Colossus 2 from Elon Musk’s 09/25/2026 counts', () => {
  it('the preset opens on the dated snapshot, 550k GPUs with the GB200s kept', () => {
    const M = at(C2.scenario.stage);
    expect(M.stage).toBe(0);
    expect(M.gpus).toBe(550000);
    expect(M.fleet.map((m: any) => [m.accel.id, m.gpus])).toEqual([['gb200', 110000], ['gb300', 440000]]);
    expect(M.racks).toBe(7639);                                             // 550,000 ÷ 72
    // the preset's own meter figure is the one the fleet derives, so it cannot drift from the model
    expect(M.scenario.meterMW).toBe(C2.scenario.meterMW);
    expect(M.meterMW).toBeGreaterThan(1100);                                // the old 1.1 GW preset was low for these counts
  });
  it('each stage adds 220k GB300 and sizes the campus from the GPUs, as the table in the feedback does', () => {
    const want = [[550000, 7639], [770000, 10694], [990000, 13750], [1210000, 16806]];
    want.forEach(([g, r], i) => { const M = at(i); expect(M.gpus).toBe(g); expect(M.racks).toBe(r); });
    const meters = want.map((_, i) => at(i).meterMW);
    for (let i = 1; i < meters.length; i++) expect(meters[i]).toBeGreaterThan(meters[i - 1]);
  });
  it('keeping the GB200s counts less memory, fewer transistors and less power than an all-GB300 fleet', () => {
    const mixed = at(0);
    const allGB300 = compute({ ...C2.scenario, site: undefined, stage: undefined, meterMW: 1000 } as any) as any;
    const perGpu = (M: any, f: (m: any) => number) => M.fleet.reduce((a: number, m: any) => a + m.gpus * f(m), 0) / M.gpus;
    expect(perGpu(mixed, m => m.accel.gpuW)).toBeLessThan(ACCELERATORS.gb300.gpuW);
    expect(perGpu(mixed, m => m.accel.hbm.gb)).toBeLessThan(ACCELERATORS.gb300.hbm.gb);
    expect(mixed.rackAvgKW).toBeLessThan(allGB300.rack.kw);
    // and the inventory lists each kind of rack and GPU on its own row
    const rows = (content(mixed) as any).BOM.flatMap((g: any) => g.rows.map((r: any) => r[0]));
    expect(rows).toContain('GB200 NVL72 racks'); expect(rows).toContain('GB300 NVL72 racks');
    expect(rows.some((r: string) => /\(GB200\)/.test(r)) && rows.some((r: string) => /\(GB300\)/.test(r))).toBe(true);
  });
  it('the rack counts the page shows for each kind add up to the campus total at every stage', () => {
    for (let i = 0; i < 4; i++) { const M = at(i); expect(M.fleet.reduce((n: number, m: any) => n + m.racksShown, 0)).toBe(M.racks); }
  });
  it('only the GB300 racks carry rack energy storage in the training clock', async () => {
    const { makeSim } = await import('./clock');
    const M = at(0), sim = makeSim(M, 'training') as any, Gs = M.fleet.find((m: any) => m.accel.id === 'gb300').gpuMW;
    expect(Gs).toBeLessThan(M.gpuRackMW);
    // the smoothing lifts the GB300 share by exactly the low-pass gap an all-GB300 campus shows at the same instant, and
    // the GB200 share not at all (the old clock smoothed the whole fleet's GPU power)
    const ref = compute({ meterMW: 500, accel: 'gb300', power: 'ac415', cooling: 'liquid' }) as any, refSim = makeSim(ref, 'training') as any;
    for (const t of [10.3, 10.9, 25.1, 39.2, 44.6]) {
      const a = sim.sample(t).values, b = refSim.sample(t).values, gap = (b.rack - b.raw) / ref.gpuRackMW;
      expect(a.rack - a.raw).toBeCloseTo(Gs * gap, 6);
    }
    expect(sim.notes.map((n: any) => n.text).join(' ')).toMatch(/Only the GB300 racks have it/);
  });
  it('energy is conserved for a mixed fleet exactly as for a generic one', () => {
    for (let i = 0; i < 4; i++) {
      const M = at(i), silicon = M.fleet.reduce((a: number, m: any) => a + m.racks * m.accel.gpuW * m.accel.gpusPerRack * (1 - m.accel.hbmShare) / 1e6, 0);
      expect(M.gpuSiliconMW).toBeCloseTo(silicon, 1);                   // whole switches round the network up by a few kW
      expect(M.ledger.reduce((a: number, r: any) => a + r.mw, 0) + M.gpuSiliconMW).toBeCloseTo(M.meterMW, 6);
    }
  });
  it('the fleet holds only while the reader keeps the preset’s accelerator and does not pick a size', () => {
    expect(at(0, { accel: 'rubin' }).stage).toBeNull();
    expect(at(undefined).stage).toBeNull();                                // a size from the slider drops the stage
    expect(at(undefined).gpus).not.toBe(550000);
  });
  it('the generic campus is untouched: 1.1 GW of GB300 is still 405,144 GPUs', () => {
    const M = compute({ meterMW: 1100, accel: 'gb300', power: 'ac415', cooling: 'liquid' }) as any;
    expect(M.gpus).toBe(405144); expect(M.mixed).toBe(false); expect(M.stage).toBeNull();
  });
  it('Elon Musk’s post is reported, not spec, and the model’s figures stay estimates', () => {
    for (const [k, , b] of C2.facts) if (/Elon Musk/.test(k)) expect(b, k).toBe('reported');
    expect(C2.unknowns.join(' ')).toMatch(/halls, CDUs, cables, token rates and the whole layout are this model’s/);
  });
});
