import { describe, it, expect } from 'vitest';
import { compute, ACCELERATORS, POWER, COOLING } from '../model/engine';
import { content } from '../data.js';
import { story, watt, request, heat, light, layer, everything, CHAIN, OUTWARD } from './journeys.js';
import { SITES } from '../model/sites';

const scenarios: any[] = [];
for (const accel of Object.keys(ACCELERATORS)) for (const power of Object.keys(POWER)) for (const cooling of Object.keys(COOLING))
  for (const meterMW of [10, 1000]) scenarios.push({ meterMW, accel, power, cooling });
for (const [id, s] of Object.entries(SITES)) scenarios.push({ ...s.scenario, site: id });

describe('tours', () => {
  it.each(scenarios)('$accel / $power / $cooling at $meterMW MW $site: every beat is complete and lands on a part', s => {
    const M = compute(s), C = content(M);
    const layer = { power: C.PARTS, data: C.PARTS_DATA, heat: C.PARTS_HEAT } as Record<string, Record<string, any[]>>;
    for (const [name, beats] of Object.entries({ story: story(M), watt: watt(M), request: request(M), heat: heat(M), light: light(M) })) {
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
      // the six levels in a line; the side levels have their own This level walks, and a door's trip, not a place here
      const line = C.SCENES.filter((sc: any) => !sc.side), scenes = OUTWARD.has(mode) ? [...line].reverse() : line;
      const P = (C as any)[key] as Record<string, any[]>;
      // each door card is followed by the side trip through every part of the side level it opens
      const cards = scenes.flatMap((sc: any) => (P[sc.id] || []).flatMap((p: any) => [`${sc.id}:${p.id}`, ...(p.trip ? (P[p.trip] || []).map(q => `${p.trip}:${q.id}`) : [])]));
      if (mode !== 'data') {
        cards.splice(cards.findIndex((id: string) => id.startsWith('across:')), 0,
          'coherent:cdsp', 'coherent:itla', 'coherent:driver', 'coherent:cdm', 'coherent:icr', 'coherent:tia');
        const trip = parts.filter((b: any) => b.trip === 'coherent');
        expect(trip).toHaveLength(6);expect(trip.every((b:any)=>b.parent===0)).toBe(true);
        expect(trip[0].text).toContain('does not carry power or heat between campuses');
        expect(parts[parts.indexOf(trip.at(-1)!)+1].link.scene).toBe(0);
      }
      if (mode === 'heat' && M.accel.gpusPerRack === 72) {
        cards.splice(cards.findIndex((id: string) => id.startsWith('rack:')), 0, 'copper:acc', 'copper:aec');
        const comparison = parts.find((b: any) => b.trip === 'copper');
        expect(comparison?.text).toContain("This rack's NVLink spine uses passive copper. For comparison");
      }
      expect(parts.map((b: any) => `${C.SCENES[b.link.scene].id}:${b.link.part}`)).toEqual(cards);
      // and a side level a door opens is covered once, whole
      const opened = new Set(scenes.flatMap((sc: any) => (P[sc.id] || []).map((p: any) => p.trip).filter(Boolean)));
      for (const trip of opened) expect(cards.filter(c => c.startsWith(`${trip}:`)), `${mode}: ${trip}`).toEqual((P[trip] || []).map(q => `${trip}:${q.id}`));
      expect(beats.filter((b: any) => b.level).length).toBe(6);
      for (const b of beats as any[]) for (const t of [b.k, b.title, b.text, b.tally]) expect(t, b.title).not.toMatch(/undefined|NaN/);
    }
    expect(everything(M).length).toBe(['power', 'data', 'heat'].reduce((a, m) => a + layer(M, m as any).length, 0));
  });
  // Reed, 09/27: a level's step numbers ran one ahead of the pins on the model. The opening step is the level's
  // overview, not a part; the part steps follow the list the pins are numbered from, so part step k is pin k.
  it.each(scenarios)('a level playthrough opens on its overview, then runs the parts in pin order: $accel / $power / $cooling at $meterMW MW', s => {
    const M = compute(s), C = content(M);
    for (let i = 0; i < C.SCENES.length; i++) for (const [mode, key] of [['power', 'PARTS'], ['data', 'PARTS_DATA'], ['heat', 'PARTS_HEAT']] as const) {
      const [first, ...rest] = layer(M, mode, i) as any[], pins = ((C as any)[key][C.SCENES[i].id] || []).map((p: any) => p.id);
      expect(first.level && first.link.part, `${mode} level ${i + 1}: the opening step`).toBe(null);
      expect(first.k, `${mode} level ${i + 1}`).toMatch(/overview$/);
      expect(rest.map(b => b.link.part), `${mode} level ${i + 1}: part steps`).toEqual(pins);
    }
  });
  it.each(scenarios)('the watt accounts for every ledger row: $accel / $power / $cooling at $meterMW MW', s => {
    const M = compute(s), beats = watt(M);
    const left = parseFloat(beats[beats.length - 1].tally!);
    expect(left).toBeCloseTo(M.gpuSiliconMW / M.meterMW, 3);
  });

  // Codex's optics review, 09/28: coverage used to be derived from the doors already configured, so a side card with
  // no door went unnoticed. This inventory is written out by hand: every side-level card an Every part tour must
  // visit, per layer. The copper cables' door is the NVL72 rack's NVLink spine, so they are expected only there.
  // the CPO level's side trip walks both packages: the stage brings the Broadcom-style one up for its mzm-* parts
  const SIDE_EXPECTED = (nvl: boolean): Record<string, Record<string, string[]>> => ({
    power: { module: ['fingers', 'dcdc', 'dsp', 'driver', 'lasers'], cpo: ['asic', 'engine', 'els', 'mzm-asic', 'mzm-engine', 'mzm-laser', 'today', 'next'], coherent: ['cdsp', 'itla', 'driver', 'cdm', 'icr', 'tia'], ...(nvl ? { copper: ['dac', 'acc', 'aec'] } : {}) },
    data: { module: ['fingers', 'dsp', 'driver', 'lasers', 'mzm', 'mpo', 'pd', 'tia'], cpo: ['asic', 'serdes', 'eic', 'rings', 'pd', 'els', 'fiberout', 'mzm-asic', 'mzm-serdes', 'mzm-eic', 'mzm-mod', 'mzm-pd', 'mzm-laser', 'mzm-fiberout', 'today', 'next'], coherent: ['cdsp', 'driver', 'cdm', 'itla', 'icr', 'tia', 'lc', 'pluggable'], ...(nvl ? { copper: ['dac', 'acc', 'aec'] } : {}) },
    heat: { module: ['dsp', 'shell'], cpo: ['asic', 'coldplate', 'mzm-asic', 'mzm-sink'], coherent: ['cdsp', 'itla', 'driver', 'cdm', 'icr', 'tia'], ...(nvl ? { copper: ['acc', 'aec'] } : {}) },
  });
  it.each(scenarios)('the Every part tours visit every intended side card, and every side card is intended: $accel / $power / $cooling at $meterMW MW $site', s => {
    const M = compute(s), C = content(M), want = SIDE_EXPECTED(M.accel.gpusPerRack === 72);
    for (const [mode, key] of [['power', 'PARTS'], ['data', 'PARTS_DATA'], ['heat', 'PARTS_HEAT']] as const) {
      const seen = new Set(layer(M, mode).filter((b: any) => (C.SCENES[b.link.scene] as any).side).map((b: any) => `${C.SCENES[b.link.scene].id}:${b.link.part}`));
      const intended = Object.entries(want[mode]).flatMap(([sc, ids]) => ids.map(id => `${sc}:${id}`));
      expect([...seen].sort(), `${mode}: visited`).toEqual(intended.sort());
      // and nothing on a side level sits outside the inventory (a card no tour could reach)
      const cards = C.SCENES.filter((sc: any) => sc.side).flatMap((sc: any) => (((C as any)[key][sc.id] || []) as any[]).map(p => `${sc.id}:${p.id}`));
      const everIntended = new Set(Object.entries(SIDE_EXPECTED(true)[mode]).flatMap(([sc, ids]) => ids.map(id => `${sc}:${id}`)));
      for (const c of cards) expect(everIntended.has(c), `${mode}: ${c} has no tour`).toBe(true);
    }
  });

  // Reed, 09/27: tours felt like they jumped to another level and back. A tour now moves one level at a time, one way.
  // a side trip counts as the level it returns to: the camera goes in and comes straight back out there
  const levels = (beats: any[]) => beats.map(b => b.parent ?? b.link.scene);
  const oneWay = (lv: number[]) => {
    const steps = lv.slice(1).map((v, i) => v - lv[i]);
    return steps.every(d => Math.abs(d) <= 1) && (steps.every(d => d >= 0) || steps.every(d => d <= 0));
  };
  const TOUR: Record<string, (M: any) => any[]> = {
    story, watt, request, heat, light,
    'all-power': M => layer(M, 'power'), 'all-heat': M => layer(M, 'heat'), 'all-data': M => layer(M, 'data'),
  };
  it.each(scenarios)('every tour moves one level at a time, one way: $accel / $power / $cooling at $meterMW MW $site', s => {
    const M = compute(s);
    for (const [name, beats] of Object.entries(TOUR)) expect(levels(beats(M)), name).toSatisfy(oneWay);
    for (let i = 0; i < 6; i++) for (const m of ['power', 'data', 'heat'] as const) {
      const lv = levels(layer(M, m, i));
      expect(new Set(lv), `${m} level ${i + 1}`).toEqual(new Set([i]));
    }
    // all of it: each layer one way, and each starts on the level the last one ended on
    const all = everything(M), bounds = ['power', 'heat', 'data'].map(m => levels(layer(M, m as any)));
    expect(all.length).toBe(bounds.flat().length);
    for (let k = 1; k < bounds.length; k++) expect(bounds[k][0], 'everything, layer ' + k).toBe(bounds[k - 1].at(-1));
    // playing on: every-part tours hand over on the same level; the tours jump at most once (back to a phone)
    const ends = (id: string) => { const lv = levels(TOUR[id](M)); return [lv[0], lv.at(-1)!]; };
    const jumps = (chain: string[]) => chain.slice(1).filter((id, k) => Math.abs(ends(id)[0] - ends(chain[k])[1]) > 1).length;
    expect(jumps(CHAIN['Every part'])).toBe(0);
    expect(jumps(CHAIN.Tours)).toBeLessThanOrEqual(1);
  });
  it.each(scenarios)('every side trip dives in from its parent level and returns to it: $accel / $power / $cooling at $meterMW MW $site', s => {
    const M = compute(s), C = content(M), isSide = (i: number) => !!(C.SCENES[i] as any)?.side;
    for (const [name, beats] of Object.entries(TOUR)) {
      const bs = beats(M) as any[];
      bs.forEach((b, i) => {
        if (!isSide(b.link.scene)) return;
        expect(b.parent, `${name} ${i}: a side-level beat names its parent`).toBeTypeOf('number');
        const before = bs.slice(0, i).reverse().find(x => !isSide(x.link.scene)), after = bs.slice(i + 1).find(x => !isSide(x.link.scene));
        expect(before?.link.scene, `${name} ${i}: entered from its parent`).toBe(b.parent);
        if (after) expect(after.link.scene, `${name} ${i}: back out to its parent`).toBe(b.parent);
      });
    }
  });
});
