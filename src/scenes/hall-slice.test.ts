// What the data-hall level draws against what its cards say (10/03/2026 drift audit, items 9 and 17). The level draws one
// fixed, representative hall (192 racks, 9 UPS cabinets, 24 coolant units) whatever the scenario; no model count is tied to
// it. So the text must never put a model number over "here": the cards say "across the campus" or "per hall, N halls", and the
// level says what is shown. These tests build the hall, count what it drew, and read the cards' strings.
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { compute, DEFAULT_SCENARIO, ACCELERATORS } from '../model/engine';
import { content } from '../data.js';
import { story } from '../app/journeys.js';

let hall: any, S: any, cpo: any, side: any;
beforeAll(async () => {
  const noop = () => undefined;
  const ctx = new Proxy({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), measureText: (t: string) => ({ width: t.length * 24 }),
    createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }) } as Record<string, unknown>, { get: (t, k: string) => k in t ? t[k] : noop });
  vi.stubGlobal('document', { createElement: () => ({ width: 1, height: 1, getContext: () => ctx }) });
  [hall, S, cpo, side] = await Promise.all([import('./hall.js'), import('./hall-slice.js'), import('./cpo-switch.js'), import('./side-geometry.js')]);
}, 60000);
afterAll(() => { vi.unstubAllGlobals(); });

const opts = (scenario: any = {}) => ({ quality: { mobile: true, shadows: false, reflections: false }, state: { mode: 'power' }, model: compute({ ...DEFAULT_SCENARIO, ...scenario }) });

describe('the hall draws the slice hall-slice.js says it does, in every scenario', () => {
  for (const scenario of [{}, { accel: 'h100', cooling: 'air' }, { accel: 'rubin', power: 'dc800' }, { meterMW: 1000 }] as any[]) it(`${scenario.accel ?? 'gb200'}${scenario.power ? ' ' + scenario.power : ''}${scenario.meterMW ? ' ' + scenario.meterMW + ' MW' : ''}`, () => {
    const d = hall.build(opts(scenario)).scene.userData.hallSlice, H = S.HALL_SLICE;
    expect(d.racks).toBe(H.racks); expect(d.racks).toBe(192);
    expect(d.cdus).toBe(H.cdus); expect(d.cdus).toBe(24);
    expect(d.ups).toBe(H.ups); expect(d.ups).toBe(9);
    expect(d.rows).toBe(H.rows); expect(d.switchgear).toBe(H.switchgear);
  }, 60000);
});

describe('hall cards never put a model count over "here"', () => {
  const model = (scenario: any) => compute({ ...DEFAULT_SCENARIO, ...scenario });
  const fixes = [{}, { accel: 'h100', cooling: 'air' }, { accel: 'gb300', meterMW: 1000 }, { accel: 'rubin', power: 'dc800' }, { meterMW: 40 }] as any[];
  for (const scenario of fixes) it(`${JSON.stringify(scenario)}: the level says what it shows, and each facility count says what it covers`, () => {
    const M = model(scenario), C = content(M), hallScene: any = C.SCENES.find((s: any) => s.id === 'hall');
    expect(hallScene.intro.startsWith('Shown: a representative hall of 192 racks in six rows')).toBe(true);
    for (const parts of [C.PARTS.hall, C.PARTS_HEAT.hall]) for (const p of parts) for (const row of p.specs || []) {
      const [label, value] = row as string[];
      if (/\bhere\b/.test(label) && /^≈?\d/.test(String(value))) throw new Error(`${p.id}: "${label}" quotes ${value} as if it were drawn here`);
    }
    const find = (id: string) => C.PARTS.hall.find((p: any) => p.id === id);
    const counts: Array<[string, string, number]> = [['ups', 'Modules', M.layout.upsModules], ['sst', 'Modules, ≈2.5 MW each', M.layout.sstModules], ['cdu', 'Units, ≈1.25 MW each', M.layout.cdus], ['inrow', 'Units', M.layout.airUnits]];
    for (const [id, label, n] of counts) {
      const card = find(id); if (!card) continue;
      const row = card.specs.find((r: string[]) => r[0] === label);
      expect(row, `${id} card has a "${label}" row`).toBeTruthy();
      expect(row[1]).toContain(`≈${Math.round(n).toLocaleString('en-US')} across the campus`);
      if (M.halls > 1) expect(row[1]).toContain(`≈${Math.ceil(n / M.halls).toLocaleString('en-US')} per hall (${M.halls} halls)`);
      else expect(row[1]).not.toContain('per hall');
    }
  });
  it('the tour\'s hall steps title the racks and switches as the campus totals', () => {
    const M = compute({ ...DEFAULT_SCENARIO, meterMW: 100 }), steps = story(M);
    const racks = steps.find((s: any) => s.link?.part === 'racks' && s.link.scene === 2 && /racks/.test(s.title));
    expect(racks.title).toBe(`${Math.round(M.racks).toLocaleString('en-US')} racks in ${M.halls} halls`);
    expect(steps.find((s: any) => /switches across the campus/.test(s.title))).toBeTruthy();
  });
});

describe('the hall CPO switch\'s counts come from cpo-switch.js and agree with the CPO level and its cards', () => {
  it('144 MPO = 4 packages x 18 engines x 2 ports; the CPO level draws one package of 18 engines', () => {
    const C = cpo.CPO_SWITCH;
    expect(C.mpo).toBe(144); expect(C.mpo / C.packages).toBe(C.enginesPerPackage * C.portsPerEngine);
    expect(C.mpoRows * C.mpoCols).toBe(C.mpo);
    expect(side.engineLayout()).toHaveLength(C.enginesPerPackage);
  });
  it('the hall scene reports and draws those counts', () => {
    const b = hall.build(opts()), C = cpo.CPO_SWITCH, d = b.scene.userData.cpoComparison;
    expect(d.mpoConnectors).toBe(C.mpo); expect(d.laserModules).toBe(C.els); expect(d.cappedCoolantPorts).toBe(C.udq4);
  }, 60000);
  it('the CPO cards quote the same switch', () => {
    const C = content(compute(DEFAULT_SCENARIO)), cpoParts = JSON.stringify([C.PARTS, C.PARTS_DATA, C.PARTS_HEAT]);
    expect(cpoParts).toContain(`The switch’s ${cpo.CPO_SWITCH.els} serve its four packages.`);
    expect(cpoParts).toContain('a Quantum-X Photonics switch holds four.');
    expect(cpoParts).toContain(`${cpo.CPO_SWITCH.els} per Q3450 switch`);
  });
});

void ACCELERATORS;
