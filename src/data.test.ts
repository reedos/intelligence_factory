// Every scenario must produce complete text: no undefined, NaN or empty values, and a valid basis on every spec.
import { describe, it, expect } from 'vitest';
import { compute, ACCELERATORS, POWER, COOLING } from './model/engine';
import { content, BASIS } from './data.js';

const scenarios: any[] = [];
for (const accel of Object.keys(ACCELERATORS)) for (const power of Object.keys(POWER)) for (const cooling of Object.keys(COOLING))
  for (const meterMW of [10, 100, 1000, 5000]) scenarios.push({ meterMW, accel, power, cooling });

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
  });
});
