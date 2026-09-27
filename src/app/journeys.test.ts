import { describe, it, expect } from 'vitest';
import { compute, ACCELERATORS, POWER, COOLING } from '../model/engine';
import { content } from '../data.js';
import { story, watt, request, heat } from './journeys.js';
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
        const scene = C.SCENES[b.link.scene].id;
        expect((layer[b.link.mode][scene] || []).map(p => p.id), `${name}: ${b.title} → ${b.link.mode}:${scene}:${b.link.part}`).toContain(b.link.part);
      }
    }
  });
  it.each(scenarios)('the watt accounts for every ledger row: $accel / $power / $cooling at $meterMW MW', s => {
    const M = compute(s), beats = watt(M);
    const left = parseFloat(beats[beats.length - 1].tally!);
    expect(left).toBeCloseTo(M.gpuSiliconMW / M.meterMW, 3);
  });
});
