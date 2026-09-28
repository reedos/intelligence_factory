// Every figure shown with a basis chip must be backed the way its label says: a spec, vendor claim or published report
// cites a source that exists, says where in it the figure is, and has been checked; a spec cites at least one primary
// source; a vendor claim names its baseline; a calculation and an assumption name an entry the method page lists.
// While STRICT is off, figures not yet traced one by one may keep a legacy label with no evidence; once it is on,
// none may.
import { describe, it, expect } from 'vitest';
import { compute, ACCELERATORS, POWER, COOLING } from './model/engine';
import { content } from './data.js';
import { allClaims, claimByKey } from './claims.js';
import { BASIS, CALCS, ASSUMPTIONS, STRICT, problems } from './evidence.js';
import { SOURCES } from './sources.js';
import { SITES } from './model/sites';

const scenarios: any[] = [];
for (const accel of Object.keys(ACCELERATORS)) for (const power of Object.keys(POWER)) for (const cooling of Object.keys(COOLING))
  for (const meterMW of [10, 100, 1000, 5000]) scenarios.push({ meterMW, accel, power, cooling });
for (const [id, s] of Object.entries(SITES)) scenarios.push({ ...s.scenario, site: id });
const DATE = /^(\d{2}\/\d{2}\/\d{4}|\d{2}\/\d{4}|\d{4})$/;

describe('claims', () => {
  it.each(scenarios)('every claim is backed as its label says: $accel / $power / $cooling at $meterMW MW $site', s => {
    const M = compute(s), C = content(M), bad: string[] = [];
    for (const c of allClaims(M, C) as any[]) for (const p of problems(c, SOURCES)) bad.push(`${c.key} (${c.label}): ${p}`);
    expect(bad, bad.slice(0, 12).join('\n')).toEqual([]);
  });
  it('every chip key finds its claim again', () => {
    const M = compute(scenarios[20]), C = content(M), all = allClaims(M, C) as any[];
    expect(new Set(all.map(c => c.key)).size, 'duplicate claim keys').toBe(all.length);
    for (const c of all.filter((_, i) => i % 7 === 0)) expect((claimByKey(M, C, c.key) as any)?.label).toBe(c.label);
  });
  it('the registers are complete, and every source record is well formed', () => {
    for (const [id, c] of Object.entries(CALCS) as [string, any][]) expect(c.title && c.how, `calc ${id}`).toBeTruthy();
    for (const [id, a] of Object.entries(ASSUMPTIONS) as [string, any][]) expect(a.title && a.value && a.why, `assumption ${id}`).toBeTruthy();
    for (const [id, s] of Object.entries(SOURCES) as [string, any][]) {
      expect(s.title && s.publisher && /^https?:\/\//.test(s.url), `source ${id}`).toBeTruthy();
      if (s.kind) expect(['primary', 'secondary'], `source ${id} kind`).toContain(s.kind);
      if (s.accessed) expect(s.accessed, `source ${id} accessed`).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
      if (s.published && s.published !== 'undated') expect(s.published, `source ${id} published`).toMatch(DATE);
    }
  });
  it('no figure keeps a legacy label once tracing is complete', () => {
    const M = compute(scenarios[20]), C = content(M), legacy = (allClaims(M, C) as any[]).filter(c => (BASIS as any)[c.basis]?.legacy);
    if (STRICT) expect(legacy.map(c => c.key)).toEqual([]);
    else expect(legacy.length).toBeGreaterThanOrEqual(0);
  });
});
