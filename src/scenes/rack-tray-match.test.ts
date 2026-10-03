// Reed (10/03/2026): "The GPU tray as viewed from the NVL72 rack view is not representative of our actual GPU
// tray when viewed as the GPU tray." The rack's pulled compute tray (rack.js) draws its cold plates from the same
// layout constants tray.js and tray-rubin.js build the tray level from (NVL_BOARD_X/NVL_CPU/NVL_GPU_Z/NVL_GPU_SIZE,
// RUBIN_COLD_PLATES), so the two views cannot drift apart without this test catching it: it imports those
// constants directly (not through rack.js) and checks the rack's built pulled-tray plates land on them.
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { compute, DEFAULT_SCENARIO } from '../model/engine';

let rack: any, tray: any, trayJs: any, trayRubin: any;
beforeAll(async () => {
  const noop = () => undefined;
  const ctx = new Proxy({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), measureText: (t: string) => ({ width: t.length * 24 }),
    createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }) } as Record<string, unknown>, { get: (t, k: string) => k in t ? t[k] : noop });
  vi.stubGlobal('document', { createElement: () => ({ width: 1, height: 1, getContext: () => ctx }) });
  [rack, tray, trayJs, trayRubin] = await Promise.all([import('./rack.js'), import('./tray.js'), import('./tray.js'), import('./tray-rubin.js')]);
}, 30000);
afterAll(() => { vi.unstubAllGlobals(); });

const opts = (scenario: any) => ({ quality: { mobile: true, shadows: false, reflections: false }, state: { mode: 'power' }, model: compute({ ...DEFAULT_SCENARIO, ...scenario }) });
const TRAY_UNIT = 0.1;
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;
// every point in `found` must have an exact match in `expected` (both ways, so counts agree too)
function sameSet(found: Array<{ x: number; z: number }>, expected: Array<{ x: number; z: number }>, label: string) {
  expect(found.length, `${label}: count`).toBe(expected.length);
  for (const e of expected) {
    const hit = found.some(f => near(f.x, e.x) && near(f.z, e.z));
    expect(hit, `${label}: no rack plate at tray position (${e.x.toFixed(3)}, ${e.z.toFixed(3)})`).toBe(true);
  }
}
const pulled = (PD: any[], kind: string) => PD.filter(p => p.id.startsWith(`pulled-${kind}-`)).map((p: any) => ({ x: p.at[0], z: p.at[2] - pzOf(PD) }));
// the pulled tray's own z offset (pz) cancels out of a relative comparison; instead of recovering pz, compare
// positions relative to the tray's own first GPU plate on each side, which both layouts give unambiguously
function pzOf(_PD: any[]) { return 0; }

describe('rack pulled compute tray matches the tray level (GB200/GB300)', () => {
  for (const accel of ['gb200', 'gb300']) it(`${accel}: six cold plates, at the tray level's board/CPU/GPU positions`, () => {
    const r = rack.build(opts({ accel }));
    const expected = tray.NVL_BOARD_X.flatMap((bx: number) => [
      { x: bx * TRAY_UNIT, z: tray.NVL_CPU.z * TRAY_UNIT },
      { x: bx * TRAY_UNIT, z: tray.NVL_GPU_Z[0] * TRAY_UNIT },
      { x: bx * TRAY_UNIT, z: tray.NVL_GPU_Z[1] * TRAY_UNIT },
    ]);
    const z0 = r.powerDraw.find((p: any) => p.id === 'pulled-cpu-0').at[2] - expected[0].z;   // recover the tray's pz offset
    const found = r.powerDraw.filter((p: any) => /^pulled-(cpu|gpu)-/.test(p.id)).map((p: any) => ({ x: p.at[0], z: p.at[2] - z0 }));
    sameSet(found, expected, `${accel} rack pulled tray`);
  });
});

describe('rack pulled compute tray matches the tray level (Rubin)', () => {
  it('nine cold plates (4 GPU, 2 CPU, 2 NIC board, 1 DPU), at tray-rubin.js\'s own positions', () => {
    const r = rack.build(opts({ accel: 'rubin' }));
    const expected = trayRubin.RUBIN_COLD_PLATES.map((p: any) => ({ x: p.x * TRAY_UNIT, z: p.z * TRAY_UNIT }));
    const z0 = r.powerDraw.find((p: any) => p.id === 'pulled-cpu-4').at[2] - trayRubin.RUBIN_CPU[0][1] * TRAY_UNIT;
    const found = r.powerDraw.filter((p: any) => /^pulled-(gpu|cpu|nic|dpu)-/.test(p.id)).map((p: any) => ({ x: p.at[0], z: p.at[2] - z0 }));
    sameSet(found, expected, 'rubin rack pulled tray');
  });
});
