// Every scenario must produce complete text: no undefined, NaN or empty values, and a valid basis on every spec.
import { describe, it, expect } from 'vitest';
import { compute, ACCELERATORS, POWER, COOLING } from './model/engine';
import { content, BASIS, WALK } from './data.js';
import { SOURCES, PART_SOURCES, LEDGER_SOURCES } from './sources.js';
import { SITES } from './model/sites';

const scenarios: any[] = [];
for (const accel of Object.keys(ACCELERATORS)) for (const power of Object.keys(POWER)) for (const cooling of Object.keys(COOLING))
  for (const meterMW of [10, 100, 1000, 5000]) scenarios.push({ meterMW, accel, power, cooling });
for (const [id, s] of Object.entries(SITES)) scenarios.push({ ...s.scenario, site: id });

const strings = (v: unknown, out: string[] = []): string[] => {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach(x => strings(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach(x => strings(x, out));
  return out;
};

describe('content for every scenario', () => {
  it.each(scenarios)('$accel / $power / $cooling at $meterMW MW', s => {
    const M = compute(s), C = content(M);
    const text = strings({ SCENES: C.SCENES, PARTS: C.PARTS, PARTS_DATA: C.PARTS_DATA, PARTS_HEAT: C.PARTS_HEAT, BOM: C.BOM, TEMPS: C.TEMPS, PARALLEL: C.PARALLEL });
    for (const t of text) {
      expect(t, t).not.toMatch(/undefined|NaN|Infinity|\[object/);
    }
    for (const group of [C.PARTS, C.PARTS_DATA, C.PARTS_HEAT]) for (const [scene, parts] of Object.entries(group as Record<string, any[]>)) {
      const ids = parts.map(p => p.id);
      expect(new Set(ids).size, `duplicate part ids in ${scene}`).toBe(ids.length);
      for (const p of parts) {
        expect(p.title && p.body && p.kicker, `${scene}.${p.id}`).toBeTruthy();
        for (const [label, value, basis] of p.specs) {
          expect(value, `${scene}.${p.id}: ${label}`).not.toBe('');
          expect(BASIS[basis as keyof typeof BASIS], `${scene}.${p.id}: ${label} basis ${basis}`).toBeTruthy();
        }
      }
    }
    for (const g of C.BOM) for (const [label, value, basis] of g.rows) {
      expect(value, label).not.toBe('');
      expect(BASIS[basis as keyof typeof BASIS], label).toBeTruthy();
    }
    // every card has an entry in the sources registry (an empty list means: our estimate), and every id resolves
    for (const [layerName, group] of [['power', C.PARTS], ['data', C.PARTS_DATA], ['heat', C.PARTS_HEAT]] as const)
      for (const [scene, parts] of Object.entries(group as Record<string, any[]>)) for (const p of parts) {
        const ids = (PART_SOURCES as Record<string, string[]>)[`${layerName}:${scene}:${p.id}`];
        expect(ids, `no PART_SOURCES entry for ${layerName}:${scene}:${p.id}`).toBeDefined();
        for (const id of ids) expect((SOURCES as Record<string, unknown>)[id], `unknown source ${id}`).toBeTruthy();
      }
    for (const r of M.ledger) expect((LEDGER_SOURCES as [string, string[]][]).some(([pre]) => r.label.startsWith(pre)), `no LEDGER_SOURCES prefix for ${r.label}`).toBe(true);
    // every chart row that links into 3D must land on a part this scenario has
    const layer = { power: C.PARTS, data: C.PARTS_DATA, heat: C.PARTS_HEAT } as Record<string, Record<string, any[]>>;
    const links: [string, any][] = [
      ...M.ledger.filter(r => r.link).map(r => [`ledger ${r.label}`, r.link] as [string, any]),
      ['ledger end', C.LEDGER_END.link],
      ...M.staircase.map(r => [`stair ${r.label}`, r.link] as [string, any]),
      ...M.bandwidth.map(r => [`bandwidth ${r.label}`, r.link] as [string, any]),
      ...C.TEMPS.map((r: any) => [`temp ${r.label}`, r.link] as [string, any]),
      ...C.PARALLEL.map((r: any) => [`parallel ${r.name}`, r.link] as [string, any]),
      ...C.BOM.flatMap((g: any) => g.rows.map((r: any) => [`bom ${r[0]}`, r[3]] as [string, any])),
    ];
    for (const [what, l] of links) {
      expect(l, `${what} has no link`).toBeTruthy();
      const sceneId = C.SCENES[l.scene].id;
      expect((layer[l.mode][sceneId] || []).map(p => p.id), `${what} → ${l.mode}:${sceneId}:${l.part}`).toContain(l.part);
    }
  });
});

// every part a walk-ordered level can show must be in its walk list, or it would sort to the front

describe('walk order', () => {
  it('lists every part at every walk-ordered level, in every scenario', () => {
    for (const s of scenarios) {
      const C = content(compute(s)) as any;
      for (const [key, mode] of [['PARTS', 'power'], ['PARTS_DATA', 'data'], ['PARTS_HEAT', 'heat']] as const)
        for (const [sc, ids] of Object.entries((WALK as any)[mode] as Record<string, string[]>))
          for (const p of C[key][sc] || []) expect(ids, `${mode}:${sc}:${p.id} (${JSON.stringify(s)})`).toContain(p.id);
    }
  });
});
