// One GPU package, two levels. The tray (tray.js, tray-rubin.js) and the chip level (chip.js) both draw the substrate,
// interposer, dies and HBM stacks of each accelerator, and the audit of 10/03/2026 found them drawing different
// packages (Rubin's tray package was two portrait dies with HBM on the long sides against the chip level's two
// landscape dies with HBM above and below; the H100 substrate was 5.0 cm on the tray and 8.4 cm at chip level).
// Both now build from src/scenes/gpu-package.js. Each level records what it drew at the draw call
// (scene.userData.gpuPackageDrawn: the footprint it handed the geometry and the part's centre relative to its package),
// and this test compares that with the descriptor, per accelerator: footprints, die count, HBM count (live stacks and
// the H100 spacer), and arrangement (which axis the dies line up on, which edges the HBM faces). The chip level's own
// counts are checked against the engine's table too. A last group proves the comparison itself fails when a value is off.
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { compute, DEFAULT_SCENARIO } from '../model/engine';
import { GPU_PACKAGE, packageParts, gpuPackageJson } from './gpu-package.js';

let tray: any, chip: any;
beforeAll(async () => {
  const noop = () => undefined;
  const ctx = new Proxy({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), measureText: (t: string) => ({ width: t.length * 24 }),
    createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }) } as Record<string, unknown>, { get: (t, k: string) => k in t ? t[k] : noop });
  vi.stubGlobal('document', { createElement: () => ({ width: 1, height: 1, getContext: () => ctx }) });
  [tray, chip] = await Promise.all([import('./tray.js'), import('./chip.js')]);
}, 30000);
afterAll(() => { vi.unstubAllGlobals(); });

const ACCELS = ['h100', 'gb200', 'gb300', 'rubin'] as const;
const opts = (accel: string) => ({ quality: { mobile: true, shadows: false, reflections: false }, state: { mode: 'power' }, model: compute({ ...DEFAULT_SCENARIO, accel: accel as any }) });
const EPS = 1e-6;
type Drawn = { gpu: number; kind: string; w: number; d: number; x: number; z: number };

/** A level's record, in centimeters, grouped by package. */
function recorded(level: any): Drawn[][] {
  const log = level.scene.userData.gpuPackageDrawn;
  expect(log, 'the level records what it drew').toBeTruthy();
  const out: Drawn[][] = [];
  for (const p of log.parts as Drawn[]) {
    const cm = { ...p, w: p.w / log.perCm, d: p.d / log.perCm, x: p.x / log.perCm, z: p.z / log.perCm };
    (out[p.gpu] ??= []).push(cm);
  }
  return out;
}
const key = (p: { kind: string; x: number; z: number }) => `${p.kind}:${p.x.toFixed(4)}:${p.z.toFixed(4)}`;

/** Problems between one drawn package and the descriptor ([] when they agree). */
function problems(drawn: Drawn[], accel: string): string[] {
  const want = packageParts(accel), out: string[] = [];
  const count = (list: { kind: string }[], kind: string) => list.filter(p => p.kind === kind).length;
  for (const kind of ['substrate', 'interposer', 'die', 'hbm', 'spacer']) if (count(drawn, kind) !== count(want, kind)) out.push(`${kind} count ${count(drawn, kind)}, descriptor ${count(want, kind)}`);
  const byKey = new Map(drawn.map(p => [key(p), p]));
  for (const w of want) {
    const got = byKey.get(key(w));
    if (!got) { out.push(`no ${w.kind} drawn at (${w.x.toFixed(3)}, ${w.z.toFixed(3)}) cm`); continue; }
    if (Math.abs(got.w - w.w) > EPS || Math.abs(got.d - w.d) > EPS) out.push(`${w.kind} at (${w.x.toFixed(3)}, ${w.z.toFixed(3)}): drawn ${got.w.toFixed(3)} x ${got.d.toFixed(3)} cm, descriptor ${w.w.toFixed(3)} x ${w.d.toFixed(3)} cm`);
  }
  // arrangement: the dies line up along x and the HBM sits on the edges the descriptor names (above and below the dies
  // on the two-die packages, to the left and right on H100), none over the dies
  const dies = drawn.filter(p => p.kind === 'die'), stacks = drawn.filter(p => p.kind === 'hbm' || p.kind === 'spacer');
  if (dies.length > 1 && new Set(dies.map(p => p.z.toFixed(4))).size !== 1) out.push('dies do not line up along x');
  const edge = GPU_PACKAGE[accel as keyof typeof GPU_PACKAGE].hbmEdge, die = dies[0];
  for (const h of stacks) {
    const beyondZ = Math.abs(h.z) - h.d / 2 >= die.d / 2 - 1e-9, beyondX = dies.every(d => Math.abs(h.x - d.x) - h.w / 2 >= d.w / 2 - 1e-9);
    if (edge === 'z' && !beyondZ) out.push(`HBM at (${h.x}, ${h.z}) is not above or below the dies`);
    if (edge === 'x' && !beyondX) out.push(`HBM at (${h.x}, ${h.z}) is not beside the die`);
  }
  // everything sits on the substrate, and the stacks and dies on the interposer
  const sub = drawn.find(p => p.kind === 'substrate')!, ip = drawn.find(p => p.kind === 'interposer')!;
  for (const p of drawn) {
    const host = p.kind === 'interposer' ? sub : p.kind === 'substrate' ? null : ip;
    if (host && (Math.abs(p.x) + p.w / 2 > host.w / 2 + EPS || Math.abs(p.z) + p.d / 2 > host.d / 2 + EPS)) out.push(`${p.kind} at (${p.x.toFixed(3)}, ${p.z.toFixed(3)}) hangs over its ${host === sub ? 'substrate' : 'interposer'}`);
  }
  return out;
}

describe('the tray and chip levels draw the descriptor\'s GPU package', () => {
  for (const accel of ACCELS) {
    it(`${accel}: tray package matches the descriptor`, () => {
      const t = tray.build(opts(accel)), pk = recorded(t);
      expect(pk.length, 'GPU packages on the tray').toBe(accel === 'h100' ? 8 : 4);
      for (const [i, p] of pk.entries()) expect(problems(p, accel), `${accel} tray GPU ${i}`).toEqual([]);
    });
    it(`${accel}: chip package matches the descriptor`, () => {
      const c = chip.build(opts(accel)), pk = recorded(c);
      expect(pk.length).toBe(1);
      expect(problems(pk[0], accel), `${accel} chip`).toEqual([]);
    });
    it(`${accel}: tray and chip agree with each other, part for part`, () => {
      const t = recorded(tray.build(opts(accel)))[0], c = recorded(chip.build(opts(accel)))[0];
      const norm = (list: Drawn[]) => list.map(p => `${key(p)}:${p.w.toFixed(4)}:${p.d.toFixed(4)}`).sort();
      expect(norm(t)).toEqual(norm(c));
    });
    it(`${accel}: the counts are the engine's (dies, HBM stacks)`, () => {
      const model = compute({ ...DEFAULT_SCENARIO, accel: accel as any }), A = model.accel, want = GPU_PACKAGE[accel];
      expect(want.dies.length, 'dies').toBe(A.dies);
      const live = want.hbm.sites.length - (want.hbm.spare >= 0 ? 1 : 0);
      expect(live, 'live HBM stacks').toBe(A.hbm.stacks);
      const c = chip.build(opts(accel)).scene.userData.computePackage;
      expect(c.gpuDies).toBe(A.dies); expect(c.liveHbmStacks).toBe(A.hbm.stacks); expect(c.spacerSites).toBe(want.hbm.spare >= 0 ? 1 : 0);
    });
  }
  it('Rubin is one package at both levels: two landscape dies side by side, four HBM4 stacks above and four below', () => {
    const t = recorded(tray.build(opts('rubin')))[0], c = recorded(chip.build(opts('rubin')))[0];
    for (const pk of [t, c]) {
      const dies = pk.filter(p => p.kind === 'die'), hbm = pk.filter(p => p.kind === 'hbm');
      expect(dies.length).toBe(2); expect(hbm.length).toBe(8);
      expect(dies.every(d => d.w < d.d), 'dies are 2.6 x 3.3 cm, narrower than deep').toBe(true);
      expect(hbm.filter(h => h.z > 0).length).toBe(4); expect(hbm.filter(h => h.z < 0).length).toBe(4);
    }
  });
  it('the same package is the same size as a share of the substrate at both levels (H100: substrate against die)', () => {
    const ratio = (pk: Drawn[]) => pk.find(p => p.kind === 'substrate')!.w / pk.find(p => p.kind === 'die')!.w;
    for (const accel of ACCELS) expect(ratio(recorded(tray.build(opts(accel)))[0])).toBeCloseTo(ratio(recorded(chip.build(opts(accel)))[0]), 9);
  });
});

describe('the comparison fails when a package drifts', () => {
  const good = () => structuredClone(packageParts('gb200')).map((p: any) => ({ gpu: 0, ...p })) as Drawn[];
  it('passes on the descriptor itself', () => { expect(problems(good(), 'gb200')).toEqual([]); });
  it('fails on a die that is 5 percent too wide', () => {
    const g = good(); g.find(p => p.kind === 'die')!.w *= 1.05; expect(problems(g, 'gb200').length).toBeGreaterThan(0);
  });
  it('fails on a substrate that is a millimetre short', () => {
    const g = good(); g.find(p => p.kind === 'substrate')!.w -= 0.1; expect(problems(g, 'gb200').length).toBeGreaterThan(0);
  });
  it('fails on a missing HBM stack', () => {
    const g = good(); g.splice(g.findIndex(p => p.kind === 'hbm'), 1); expect(problems(g, 'gb200').length).toBeGreaterThan(0);
  });
  it('fails when HBM moves to the die sides (the old Rubin tray arrangement)', () => {
    const g = good(); for (const h of g.filter(p => p.kind === 'hbm')) { h.x = Math.sign(h.x) * 2.6; h.z = ((Math.abs(h.z) > 2.3 ? 1 : -1) * (h.x > 0 ? 0.5 : 1.2)); }
    expect(problems(g, 'gb200').length).toBeGreaterThan(0);
  });
  it('fails when the H100 spare site is populated', () => {
    const g = structuredClone(packageParts('h100')).map((p: any) => ({ gpu: 0, ...p })) as Drawn[];
    expect(problems(g, 'h100')).toEqual([]);
    g.find(p => p.kind === 'spacer')!.kind = 'hbm'; expect(problems(g, 'h100').length).toBeGreaterThan(0);
  });
});

describe('the Blender hand-off file stays in step with the descriptor', () => {
  it('tools/blender/references/gpu-package.json (read by build-compute.py) equals gpuPackageJson()', async () => {
    // @ts-ignore vite ?raw import
    const j = JSON.parse((await import('../../tools/blender/references/gpu-package.json?raw')).default);
    expect(j).toEqual(JSON.parse(JSON.stringify(gpuPackageJson())));
  });
});
