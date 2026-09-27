import { describe, it, expect } from 'vitest';
import { compute, ACCELERATORS, POWER, COOLING } from '../model/engine';
import { content } from '../data.js';
import { story, watt, request, heat, layer, everything } from './journeys.js';
import { SITES } from '../model/sites';

const scenarios: any[] = [];
for (const accel of Object.keys(ACCELERATORS)) for (const power of Object.keys(POWER)) for (const cooling of Object.keys(COOLING))
  for (const meterMW of [10, 1000]) scenarios.push({ meterMW, accel, power, cooling });
for (const [id, s] of Object.entries(SITES)) scenarios.push({ ...s.scenario, site: id });

describe('tours', () => {
  it.each(scenarios)('$accel / $power / $cooling at $meterMW MW $site: every beat is complete and lands on a part', s => {
    const M = compute(s), C = content(M);
    const layer = { power: C.PARTS, data: C.PARTS_DATA, heat: C.PARTS_HEAT } as Record<string, Record<string, any[]>>;
    for (const [name, beats] of Object.entries({ story: story(M), watt: watt(M), request: request(M), heat: heat(M) })) {
      expect(beats.length, name).toBeGreaterThan(5);
      for (const b of beats as any[]) {
        for (const t of [b.k, b.title, b.text, b.tally ?? '']) expect(t, `${name}: ${b.title}`).not.toMatch(/undefined|NaN|Infinity|\[object/);
        expect([undefined, 'training', 'outage', 'hotday', 'inference'], `${name}: ${b.title} sim`).toContain(b.sim);
        const scene = C.SCENES[b.link.scene].id;
        expect((layer[b.link.mode][scene] || []).map(p => p.id), `${name}: ${b.title} → ${b.link.mode}:${scene}:${b.link.part}`).toContain(b.link.part);
      }
    }
  });
  it.each(scenarios)('every-part tours cover every card once: $accel / $power / $cooling at $meterMW MW', s => {
    const M = compute(s), C = content(M);
    for (const [mode, key] of [['power', 'PARTS'], ['data', 'PARTS_DATA'], ['heat', 'PARTS_HEAT']] as const) {
      const beats = layer(M, mode), parts = beats.filter((b: any) => b.link.part);
      const cards = C.SCENES.flatMap((sc: any) => ((C as any)[key][sc.id] || []).map((p: any) => `${sc.id}:${p.id}`));
      expect(parts.map((b: any) => `${C.SCENES[b.link.scene].id}:${b.link.part}`)).toEqual(cards);
      expect(beats.filter((b: any) => b.level).length).toBe(6);
      for (const b of beats as any[]) for (const t of [b.k, b.title, b.text, b.tally]) expect(t, b.title).not.toMatch(/undefined|NaN/);
    }
    expect(everything(M).length).toBe(['power', 'data', 'heat'].reduce((a, m) => a + layer(M, m as any).length, 0));
  });
  it.each(scenarios)('the watt accounts for every ledger row: $accel / $power / $cooling at $meterMW MW', s => {
    const M = compute(s), beats = watt(M);
    const left = parseFloat(beats[beats.length - 1].tally!);
    expect(left).toBeCloseTo(M.gpuSiliconMW / M.meterMW, 3);
  });
});
