import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
// @ts-expect-error Vitest supplies Node built-ins; app tsconfig intentionally excludes Node types.
import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { compute, DEFAULT_SCENARIO, type Scenario } from '../model/engine';
import { content } from '../data.js';
import { HEAT_SCALE, balanceHeat } from '../heat.js';
import { attachPowerGlow, POWER_GLOW } from '../power-glow.js';
import { TIERS } from '../app/render-quality.js';
import { applyComputeArtDirection } from './compute-art-direction.js';
import { applyVisualDirection } from './visual-direction.js';

// The power layer's glow on every level, built the way the page builds it (authored hardware, art direction, then
// stage.js's attachPowerGlow): every part that draws power glows on the one log rule (src/power-glow.js), rank order
// holds within a view, passive parts never glow, and the glow shows in the power layer only.

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
};
const LEVELS = ['across', 'campus', 'hall', 'rack', 'tray', 'chip', 'module', 'cpo', 'coherent', 'copper'];
const SIDE = ['module', 'cpo', 'coherent', 'copper'];
const assets = new Map<string, any>();
const views: { level: string; scenario: string; form: string; built: any }[] = [];
// what can never draw power: glass, connectors, cable assemblies as such, coolant hardware and heat spreaders
const PASSIVE = /fiber|mpo|ribbon|cable|connector|coldplate|cold-plate|plate|sink|manifold|pipe|busbar|busway/i;
// and the parts each level lists that are passive: conductors, connectors, glass, coolant hardware, stored energy
const PASSIVE_PARTS: Record<string, string[]> = {
  across: ['grid', 'carbon'], campus: ['line', 'fuel', 'fiber', 'security'],
  hall: ['busway', 'containment', 'fwater', 'batt', 'optics'], rack: ['feed', 'busbar', 'spine', 'manifold'],
  tray: ['clip', 'coldplates', 'nvconn'], chip: ['balls', 'interposer', 'tokens'], module: ['fingers'],
  cpo: ['today', 'next'], coherent: ['lc', 'pluggable'], copper: ['dac'],
};

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
  const L: Record<string, any> = { across, campus, hall, rack: compute_.rackBuilder, tray: compute_.trayBuilder, chip: compute_.chipBuilder,
    module: mod, cpo, coherent: links.coherentBuilder, copper: links.copperBuilder };
  for (const [scenario, s] of Object.entries(SCENARIOS)) {
    const model = compute(s);
    for (const k of ['rack', 'tray', 'chip']) await L[k].preload({ model });
    for (const mobile of [false, true]) {
      const form = mobile ? 'phone' : 'desktop';
      const state = { mode: 'power' };
      const quality = { mobile, shadows: false, reflections: false };
      for (const level of LEVELS) {
        if (SIDE.includes(level) && scenario !== 'gb200-warm') continue;
        const built = L[level].build({ quality, state, model });
        applyComputeArtDirection({ built, level: LEVELS.indexOf(level), quality });
        applyVisualDirection({ built, level: LEVELS.indexOf(level) });
        if (built.heatFlows) balanceHeat(built.heatFlows);
        attachPowerGlow(built, { color: '#47cfff', mode: 'power' });
        built.update?.(1, 1 / 60);
        views.push({ level, scenario, form, built });
      }
    }
  }
}, 600000);
afterAll(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const active = (v: any) => v.built.powerGlow.parts.filter((p: any) => !p.off);

describe('the power-draw glow on every level', () => {
  it('every level has one glow layer, one draw call, and every declared part a place and watts', () => {
    for (const v of views) {
      const where = `${v.level} ${v.scenario} ${v.form}`;
      expect(v.built.powerGlow, where).toBeTruthy();
      const meshes: any[] = [];
      v.built.scene.traverse((o: any) => { if (o.name === 'Power draw glow') meshes.push(o); });
      expect(meshes.length, where).toBe(1);
      expect(meshes[0].isInstancedMesh, where).toBe(true);
      for (const p of v.built.powerDraw) {
        expect(p.at?.length, `${where} ${p.id}`).toBe(3);
        expect(p.at.every(Number.isFinite), `${where} ${p.id}`).toBe(true);
        expect(p.size?.length === 2 && p.size.every((s: number) => s > 0), `${where} ${p.id}`).toBe(true);
        expect(p.watts, `${where} ${p.id}`).toBeGreaterThanOrEqual(0);
      }
    }
  });
  it('within a view, more watts never glows less (brightness and reach)', () => {
    const bad: string[] = [];
    for (const v of views) {
      const parts = active(v);
      for (const a of parts) for (const b of parts) {
        if (!(a.watts > b.watts * 1.0001)) continue;
        if (a.glow.gain < b.glow.gain || a.glow.reach < b.glow.reach) bad.push(`${v.level} ${v.scenario}: ${a.id} ${a.watts} W glows less than ${b.id} ${b.watts} W`);
        if (a.glow.weight * 1.0001 < b.glow.weight) bad.push(`${v.level} ${v.scenario}: weight ${a.id} < ${b.id}`);
      }
    }
    expect(bad).toEqual([]);
  });
  it('the largest draw in a view is the reference; nothing under the threshold glows', () => {
    for (const v of views) {
      const g = v.built.powerGlow, top = Math.max(...v.built.powerDraw.map((p: any) => p.watts));
      expect(g.refWatts, v.level).toBe(v.built.powerDrawRef ?? top);
      for (const p of g.parts) expect(p.watts, `${v.level} ${p.id}`).toBeGreaterThanOrEqual(HEAT_SCALE.minW);
      for (const p of v.built.powerDraw) if (p.watts < HEAT_SCALE.minW) expect(g.parts.find((q: any) => q.id === p.id), `${v.level} ${p.id}`).toBeUndefined();
    }
    // the passive DAC end (0.1 W) and the coherent optics' bias are declared and fall under the rule
    const cu = views.find(v => v.level === 'copper')!.built.powerGlow, coh = views.find(v => v.level === 'coherent')!.built.powerGlow;
    expect(cu.parts.map((p: any) => p.id).sort()).toEqual(['acc', 'aec']);
    expect(coh.parts.map((p: any) => p.id)).not.toContain('cdm');
    expect(coh.parts.map((p: any) => p.id)).not.toContain('icr');
  });
  it('passive parts never glow', () => {
    for (const v of views) for (const p of v.built.powerGlow.parts) {
      expect(`${p.id} ${p.part ?? ''}`, `${v.level} ${v.scenario}`).not.toMatch(PASSIVE);
      expect(PASSIVE_PARTS[v.level], `${v.level} ${p.id}`).not.toContain(p.part ?? p.id);
    }
  });
  it('every glowing part is one the level lists in the power layer', () => {
    for (const v of views) {
      const C: any = content(compute(SCENARIOS[v.scenario])), id = v.level;
      const listed = new Set([...(C.PARTS[id] || []), ...(C.PARTS_DATA[id] || []), ...(C.PARTS_HEAT[id] || [])].map((p: any) => p.id));
      for (const p of v.built.powerGlow.parts) if (p.part) expect(listed.has(p.part), `${v.level} ${v.scenario} ${p.id} → ${p.part}`).toBe(true);
    }
  });
  it('shows in the power layer only', () => {
    for (const v of views) {
      const g = v.built.powerGlow;
      for (const [mode, on] of [['power', true], ['data', false], ['heat', false]] as const) {
        g.update(2, mode);
        expect(g.mesh.visible, `${v.level} ${mode}`).toBe(on && (v.built.powerDrawWhen ? v.built.powerDrawWhen() : true));
      }
    }
  });
  it('variants switch parts off without re-normalizing', () => {
    const mod = views.find(v => v.level === 'module')!.built, cpo = views.find(v => v.level === 'cpo')!.built;
    const on = (b: any) => b.powerGlow.parts.filter((p: any) => !p.off).map((p: any) => p.id);
    mod.variant.set('lpo'); expect(on(mod)).not.toContain('dsp'); expect(on(mod)).not.toContain('dsp-lro');
    mod.variant.set('lro'); expect(on(mod)).toContain('dsp-lro');
    const lro = mod.powerGlow.parts.find((p: any) => p.id === 'dsp-lro'), full = mod.powerGlow.parts.find((p: any) => p.id === 'dsp');
    expect(lro.glow.gain).toBeLessThan(full.glow.gain);
    mod.variant.set('dsp'); expect(on(mod)).toContain('dsp'); expect(on(mod)).not.toContain('dsp-lro');
    cpo.variant.set('mzm'); expect(on(cpo)).toContain('mzm-asic'); expect(on(cpo).some((id: string) => id.startsWith('engine-'))).toBe(false);
    cpo.variant.set('ring'); expect(on(cpo)).toContain('asic'); expect(on(cpo).some((id: string) => id.startsWith('tile-'))).toBe(false);
  });
  it('quality tiers: no-bloom tiers boost, saver tiers drop the faintest halos', () => {
    for (const v of views) {
      const g = v.built.powerGlow, n = g.parts.length;
      g.setTier(TIERS[0]); expect(g.drawn).toBe(n); expect(g.mesh.material.uniforms.uBoost.value).toBe(1);
      g.setTier(TIERS[4]);
      expect(g.mesh.material.uniforms.uBoost.value).toBe(POWER_GLOW.noBloomBoost);
      expect(g.drawn).toBe(g.parts.filter((p: any) => p.glow.weight >= POWER_GLOW.saverCut).length);
      expect(g.drawn).toBeGreaterThan(0);
      g.setTier(TIERS[0]);
    }
  });
});
