// A real campus whose operator publishes its own plant (sites.ts `plant`) replaces the generic one, and only that
// campus: Colossus 2 is battery-backed with no diesel, and on its own cooling design a closed loop with no towers and
// no cooling water. Everything that describes the campus must follow, and nothing may point at parts it lacks.
import { describe, it, expect } from 'vitest';
import { compute } from './engine';
import { makeSim } from './clock';
import { content } from '../data.js';
import { SITES } from './sites';

const preset = { ...SITES.colossus2.scenario, site: 'colossus2' } as any;
const ids = (list: any[]) => list.map(p => p.id);

describe('a published plant', () => {
  it('Colossus 2: batteries, no diesel, a closed loop', () => {
    const M = compute(preset), L = M.layout;
    expect(M.backup).toBe('battery');
    expect([L.gensets, L.fuelML]).toEqual([0, 0]);
    expect(L.bessMWh).toBe(3300);
    expect(L.bessMW).toBe(Math.round(M.meterMW));             // assumed to carry the campus: the rating is unpublished
    expect(M.closedLoop).toBe(true);
    expect([L.towers, M.wue]).toEqual([0, 0]);
  });
  it('the closed loop is the operator’s cooling design: change the cooling and it no longer applies', () => {
    const M = compute({ ...preset, cooling: 'warm' });
    expect(M.closedLoop).toBe(false);
    expect(M.layout.towers).toBeGreaterThan(0);
    expect(M.wue).toBeGreaterThan(0);
    expect(M.backup).toBe('battery');                          // the backup design is the site's, whatever the cooling
  });
  it('no other campus changes', () => {
    for (const s of [{ ...preset, site: undefined }, { ...SITES.colossus1.scenario, site: 'colossus1' }, { meterMW: 100, accel: 'gb200', power: 'ac415', cooling: 'liquid' }] as any[]) {
      const M = compute(s);
      expect(M.backup, JSON.stringify(s)).toBe('diesel');
      expect(M.closedLoop).toBe(false);
      expect(M.layout.gensets).toBeGreaterThan(0);
      expect(M.layout.towers).toBeGreaterThan(0);
    }
  });
  it('the cards, inventory and clocks describe only what the campus has', () => {
    const M = compute(preset), C = content(M);
    expect(ids(C.PARTS.campus)).not.toContain('gensets');
    expect(ids(C.PARTS.campus)).not.toContain('fuel');
    expect(ids(C.PARTS.campus)).not.toContain('towers');
    expect(ids(C.PARTS_HEAT.campus)).not.toContain('towers');
    const rows = C.BOM.flatMap((g: any) => g.rows.map((r: any) => r[0]));
    expect(rows.filter((r: string) => /Diesel generators, 3 MW|Diesel on site|Cooling towers/.test(r))).toEqual([]);
    const outage = makeSim(M, 'outage');
    expect(outage.series.map(x => x.key)).not.toContain('gens');
    for (let t = 0; t <= outage.duration; t += 30) {
      const s = outage.sample(t);
      expect(Number.isFinite(s.values.battery) && Number.isFinite(s.values.grid), `outage at ${t} s`).toBe(true);
    }
    const hot = makeSim(M, 'hotday');
    for (let h = 0; h <= 24; h += 3) expect(Number.isFinite(hot.sample(h).levels.vapor), `hot day at ${h} h`).toBe(true);
    const text = JSON.stringify({ SCENES: C.SCENES[1], campus: C.PARTS.campus, heat: C.PARTS_HEAT.campus });
    expect(text).not.toMatch(/diesel generators and batteries stand by|cooling towers throw/);
  });
});
