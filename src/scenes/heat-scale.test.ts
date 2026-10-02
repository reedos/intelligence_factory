import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
// @ts-expect-error Vitest supplies Node built-ins; app tsconfig intentionally excludes Node types.
import { readFileSync, writeFileSync } from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { compute, DEFAULT_SCENARIO, type Scenario } from '../model/engine';
import { SITES } from '../model/sites';
import { heatSources, heatWeight, HEAT_SCALE, flowHeatWeight, balanceHeat } from '../heat.js';
import { applyComputeArtDirection } from './compute-art-direction.js';
import { applyVisualDirection } from './visual-direction.js';

// Every heat stream on every level, built the way the page builds it (authored hardware, art direction and all),
// checked against the site's one heat rule (src/heat.js): within a view, a part with more watts never draws less
// heat than a part with fewer, and nothing under the threshold draws a stream.
vi.mock('../heat.js', async orig => {
  const m: any = await orig();
  // @ts-expect-error Node global
  return process.env.HEAT_RAW ? { ...m, balanceHeat: (f: unknown) => f } : m;
});

function canvasDocument() {
  return { createElement(tag: string) {
    if (tag !== 'canvas') throw new Error(`Unexpected DOM dependency ${tag}`);
    const noop = () => undefined;
    const context = new Proxy({
      createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      measureText: (text: string) => ({ width: text.length * 24 }),
      createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }),
    } as Record<string, unknown>, { get: (target, key: string) => key in target ? target[key] : noop });
    return { width: 1, height: 1, getContext: () => context };
  } };
}

const SCENARIOS: Record<string, Scenario> = {
  'gb200-warm': DEFAULT_SCENARIO,
  'gb300-dc-liquid': { meterMW: 300, accel: 'gb300', power: 'dc800', cooling: 'liquid' },
  'h100-air-1gw': { meterMW: 1000, accel: 'h100', power: 'ac415', cooling: 'air' },
  'rubin-dc-warm-10mw': { meterMW: 10, accel: 'rubin', power: 'dc800', cooling: 'warm' },
  'gb200-5gw': { meterMW: 5000, accel: 'gb200', power: 'ac415', cooling: 'warm' },
  colossus2: { ...SITES.colossus2.scenario, site: 'colossus2' } as Scenario,
};
const assets = new Map<string, any>();
let L: Record<string, any> = {};
const views: { level: string; scenario: string; form: string; built: any }[] = [];
const LEVEL = { across: 0, campus: 1, hall: 2, rack: 3, tray: 4, chip: 5, module: 6, cpo: 7, coherent: 8, copper: 9 } as Record<string, number>;
// what stage.js getScene does after a build
function finish(built: any, level: string, quality: any) {
  applyComputeArtDirection({ built, level: LEVEL[level], quality });
  applyVisualDirection({ built, level: LEVEL[level] });
  // @ts-expect-error Node global
  if (built.heatFlows && !process.env.HEAT_RAW) balanceHeat(built.heatFlows);
  return built;
}

beforeAll(async () => {
  vi.stubGlobal('document', canvasDocument()); vi.stubGlobal('self', { URL });
  vi.stubGlobal('createImageBitmap', async () => ({ width: 1, height: 1, close() {} }));
  vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(async (url: string) => {
    const name = url.split('/').pop()!.split('.glb')[0];
    if (!assets.has(name)) {
      const b = readFileSync(new URL(`../../public/models/${name}.glb`, import.meta.url));
      assets.set(name, await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), ''));
    }
    return assets.get(name);
  });
  const [across, campus, hall, compute_, mod, cpo, links] = await Promise.all([import('./across.js'), import('./campus.js'),
    import('./hall.js'), import('./compute-blender.js'), import('./side-module-blender.js'), import('./side-cpo-blender.js'),
    import('./side-links-blender.js')]);
  await Promise.all([across.preload(), campus.preload(), hall.preload(), mod.preload(), cpo.preload(), links.preloadLinks()]);
  L = { across, campus, hall, rack: compute_.rackBuilder, tray: compute_.trayBuilder, chip: compute_.chipBuilder,
    module: mod, cpo, coherent: links.coherentBuilder, copper: links.copperBuilder };
  for (const [scenario, s] of Object.entries(SCENARIOS)) {
    const model = compute(s);
    for (const k of ['rack', 'tray', 'chip']) await L[k].preload({ model });
    for (const mobile of [false, true]) {
      const form = mobile ? 'phone' : 'desktop';
      const options = () => ({ quality: { mobile, shadows: false, reflections: false }, state: { mode: 'heat' }, model });
      for (const level of ['across', 'campus', 'hall', 'rack', 'tray', 'chip']) views.push({ level, scenario, form, built: finish(L[level].build(options()), level, options().quality) });
      // the side levels depend on the scenario only through the module's rate; build them once per form
      if (scenario === 'gb200-warm' || (scenario === 'gb300-dc-liquid')) for (const level of ['module', 'cpo', 'coherent', 'copper']) {
        const built = finish(L[level].build(options()), level, options().quality); built.update?.(1, 1 / 60);
        views.push({ level, scenario, form, built });
      }
    }
  }
}, 600000);
afterAll(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('one heat rule on every level', () => {
  it('every heat stream names its part and watts', () => {
    for (const v of views) for (const f of v.built.heatFlows || []) {
      // the one illustration: a heat-export tie-in the campus does not have
      if (!f.heat) { expect(f.group.parent?.name || f.cls, `${v.level} ${v.scenario}`).toBeTruthy(); continue; }
      expect(f.heat.watts, `${v.level} ${v.scenario} ${f.heat.source}`).toBeGreaterThan(0);
    }
    const untagged = views.flatMap(v => (v.built.heatFlows || []).filter((f: any) => !f.heat).map(() => v.level));
    expect(new Set(untagged)).toEqual(new Set(untagged.length ? ['campus'] : []));
  });
  it('within a view, more watts never draws less heat (sources with sources, carriers with carriers)', () => {
    const bad: string[] = [];
    for (const v of views) {
      const s = heatSources(v.built.heatFlows);
      for (const a of s) for (const b of s) {
        if (a.role !== b.role || !(a.watts > b.watts * 1.0001)) continue;
        if (a.weight < b.weight * 0.999) bad.push(`${v.level} ${v.scenario} ${v.form}: ${a.source} ${a.watts.toFixed(1)} W draws ${a.weight.toFixed(3)} < ${b.source} ${b.watts.toFixed(1)} W ${b.weight.toFixed(3)}`);
      }
    }
    expect(bad).toEqual([]);
  });
  it('each source draws its rule weight relative to the largest in its view', () => {
    // whole pulses round up and the faintest opacity is a floor, so small sources may sit a little above the rule
    const off: string[] = [];
    for (const v of views) {
      const s = heatSources(v.built.heatFlows);
      for (const role of ['source', 'carrier']) {
        const g = s.filter(x => x.role === role); if (g.length < 2) continue;
        const hero = g.reduce((a, b) => (b.watts > a.watts ? b : a));
        for (const x of g) {
          const want = heatWeight(x.watts, hero.watts), got = x.weight / hero.weight;
          // the floor on opacity and whole pulses round small sources up, never down by more than a pulse
          if (got < want * 0.7 || got > Math.max(want * 1.5, want + 0.06)) off.push(`${v.level} ${v.scenario} ${v.form} ${x.source}: rule ${want.toFixed(3)}, drawn ${got.toFixed(3)}`);
        }
      }
    }
    // @ts-expect-error Node global
    if (process.env.HEAT_RAW) return;
    expect(off).toEqual([]);
  });
  it('nothing under the threshold draws a stream', () => {
    for (const v of views) for (const f of v.built.heatFlows || []) if (f.heat) expect(f.heat.watts, `${v.level} ${f.heat.source}`).toBeGreaterThanOrEqual(HEAT_SCALE.minW);
    // the parts the rule removes: the coherent modulator's and photodiodes' bias, the passive DAC end
    const coh = views.find(v => v.level === 'coherent')!.built, cu = views.find(v => v.level === 'copper')!.built;
    expect(heatSources(coh.heatFlows).map(s => s.source).sort()).toEqual(['cdsp', 'driver', 'itla', 'tia']);
    expect(heatSources(cu.heatFlows).map(s => s.source).sort()).toEqual(['acc', 'aec']);
  });
  it('optical parts never draw more heat than the electronics beside them', () => {
    const mod = views.find(v => v.level === 'module')!.built, w = Object.fromEntries(heatSources(mod.heatFlows).map(s => [s.source, s.weight]));
    expect(w.dsp).toBeGreaterThan(w.driver); expect(w.driver).toBeGreaterThanOrEqual(w.tia);
    const cpo = views.find(v => v.level === 'cpo')!.built, c = heatSources(cpo.heatFlows);
    const asic = c.find(s => s.source === 'asic')!;
    for (const e of c.filter(s => s.source.startsWith('engine-'))) expect(e.weight).toBeLessThan(asic.weight / 5);
  });
});

// Optional audit dump: HEAT_DUMP=<file.json> npx vitest run src/scenes/heat-scale.test.ts (HEAT_RAW=1 for the authored look)
// @ts-expect-error Node global
const dump = process.env.HEAT_DUMP;
if (dump) it('dumps per-source heat weights', () => {
  const out = views.map(v => ({ level: v.level, scenario: v.scenario, form: v.form,
    particles: (v.built.heatFlows || []).reduce((a: number, f: any) => a + f.count, 0), streams: (v.built.heatFlows || []).length,
    sources: heatSources(v.built.heatFlows), untagged: (v.built.heatFlows || []).filter((f: any) => !f.heat).map((f: any) => ({ cls: f.cls, weight: flowHeatWeight(f) })) }));
  writeFileSync(dump, JSON.stringify(out, null, 1));
});
