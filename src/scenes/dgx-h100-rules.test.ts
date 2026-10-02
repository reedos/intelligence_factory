// DGX H100 server level against the engineering design rules (Reed, 10/01/2026): placement by signal flow, high-speed
// routes clear of power stages and in their own channels, power entry -> conversion -> point of load in straight
// lines, mirror-symmetric routes, nothing in front of a fan opening, cables without kinks. The drawn flows are the
// routes the reader follows, so they are what is checked; tray-pcb.test.ts checks the board artwork itself.
import { beforeAll, describe, it, expect, vi } from 'vitest';
import { compute, DEFAULT_SCENARIO } from '../model/engine';
import { DGX } from './dgx-h100-layout.js';

let built: any;
beforeAll(async () => {
  const noop = () => undefined;
  vi.stubGlobal('document', { createElement: () => ({ width: 1, height: 1, getContext: () => new Proxy({ measureText: (t: string) => ({ width: t.length * 24 }), createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }) } as Record<string, unknown>, { get: (t, k: string) => k in t ? t[k] : noop }) }) });
  const { build } = await import('./tray.js');
  built = build({ quality: { shadows: false, reflections: false, mobile: false }, state: { mode: 'data' }, model: compute({ ...DEFAULT_SCENARIO, accel: 'h100' } as any) });
});

const samples = (f: any, n = 60) => { const out: number[][] = []; for (const c of f.path.curves) for (let i = 0; i <= n; i++) out.push(c.getPoint(i / n).toArray()); return out; };
const near = (a: number, b: number, e = 1e-6) => Math.abs(a - b) < e;
const { gy, my, ZM } = DGX;
// switching power stages, in plan: the GPU tray's bus converters and each CPU's regulator row
const ibcBoxes = DGX.ibcs.map(([x, z, w]) => ({ x, z, w: w + 0.06, d: 0.42, y: gy }));
const vrmBoxes = DGX.cpuX.map(x => { const s = Math.sign(x), a = x + s * DGX.cpuVrmX[0], b = x + s * DGX.cpuVrmX[1]; return { x: (a + b) / 2, z: DGX.cpuZ + 0.53, w: Math.abs(b - a) + 0.13, d: 0.13, y: my }; });
const inBox = ([x, y, z]: number[], o: any) => Math.abs(x - o.x) < o.w / 2 && Math.abs(z - o.z) < o.d / 2 && Math.abs(y - o.y) < 0.2;

describe('DGX H100 layout follows the design rules', () => {
  it('no NVLink or PCIe route runs over a bus converter or a CPU regulator row', () => {
    const bad: string[] = [];
    for (const f of built.dataFlows.filter((f: any) => ['nvl', 'pcie'].includes(f.cls)))
      for (const p of samples(f)) for (const o of [...ibcBoxes, ...vrmBoxes]) if (inBox(p, o)) bad.push(`${f.cls} at ${p.map((v: number) => v.toFixed(2))}`);
    expect([...new Set(bad)]).toEqual([]);
  });
  it('each GPU’s PCIe runs straight along its column on the baseboard and straight back to its ConnectX-7 column', () => {
    const gpu = built.dataFlows.filter((f: any) => f.dgxPcie);
    expect(gpu).toHaveLength(8);
    for (const f of gpu) {
      const pts = samples(f, 8);
      const onGpu = pts.filter(p => p[1] > gy - 0.05 && p[2] < ZM - 0.25), onMb = pts.filter(p => p[1] < my + 0.05 && p[2] < ZM - 0.25 && p[2] > DGX.modZ + 0.5);
      expect(new Set(onGpu.map(p => p[0].toFixed(3))).size, `GPU ${f.dgxPcie.gpu} baseboard run`).toBe(1);
      expect(new Set(onMb.map(p => p[0].toFixed(3))).size, `GPU ${f.dgxPcie.gpu} interposer run`).toBe(1);
      expect(DGX.mbPcieX).toContain(+onMb[0][0].toFixed(2));
    }
  });
  it('on the midplane, PCIe uses the PCIe stiles and 54 V the power stiles; nothing crosses a fan opening vertically', () => {
    const stile = (f: any) => samples(f, 20).filter(p => near(p[2], ZM - 0.04, 1e-3) && p[1] > 0.75 && p[1] < 1.38).map(p => +p[0].toFixed(2));
    for (const f of built.dataFlows.filter((f: any) => f.dgxPcie)) for (const x of stile(f)) expect(DGX.pciStileX).toContain(x);
    for (const f of built.flows.filter((f: any) => f.cls === 'dc')) for (const x of stile(f)) expect(DGX.pwrStileX).toContain(x);
  });
  it('power goes connector -> converter -> regulator row in straight runs: every 12 V route is two or three segments, rear rows straight behind the front', () => {
    const v12 = built.flows.filter((f: any) => f.cls === 'bus12');
    expect(v12).toHaveLength(8);
    for (const f of v12) {
      const pts = samples(f, 1), xs = pts.slice(1).map(p => p[0].toFixed(3));
      expect(new Set(xs).size, 'one regulator-row line per route').toBe(1);
      expect(f.path.curves.length).toBeLessThanOrEqual(3);
    }
  });
  it('mirror-symmetric parts get mirror-symmetric routes', () => {
    const key = (f: any) => samples(f, 4).map(([x, y, z]) => `${x.toFixed(2)},${y.toFixed(2)},${z.toFixed(2)}`).join(' ');
    const mirror = (f: any) => samples(f, 4).map(([x, y, z]) => `${(-x).toFixed(2)},${y.toFixed(2)},${z.toFixed(2)}`).join(' ');
    for (const [list, cls] of [[built.dataFlows, 'pcie'], [built.dataFlows, 'nvl'], [built.flows, 'bus12'], [built.flows, 'dc']] as const) {
      const fs = list.filter((f: any) => f.cls === cls), keys = new Set(fs.map(key));
      const odd = fs.filter((f: any) => !keys.has(mirror(f))).map((f: any) => key(f).slice(0, 40));
      expect(odd, cls).toEqual([]);
    }
  });
  it('DensiLink cables keep their order, never cross, run as one bundle over the center and bend without kinks', () => {
    const cables: number[][][] = built.scene.userData.dgxCables;
    expect(cables).toHaveLength(4);
    for (let i = 1; i < 4; i++) for (const k of [0, 2, 3]) expect(cables[i][k][0]).toBeGreaterThan(cables[i - 1][k][0]);
    for (const c of cables) {
      for (const p of c.slice(2, 5)) expect(Math.abs(p[0])).toBeLessThan(0.5);   // over the center, clear of the CPU sinks
      for (let i = 1; i < c.length - 1; i++) {
        const a = c[i].map((v, j) => v - c[i - 1][j]), b = c[i + 1].map((v, j) => v - c[i][j]);
        const cos = a.reduce((s, v, j) => s + v * b[j], 0) / Math.hypot(...a) / Math.hypot(...b);
        expect(Math.acos(Math.min(1, cos)) * 180 / Math.PI, 'turn at a cable control point').toBeLessThan(75);
      }
    }
  });
  it('the inter-tray connection is the documented midplane: every GPU PCIe and every tray power feed crosses it', () => {
    const crosses = (f: any) => samples(f, 10).some(p => near(p[2], ZM - 0.04, 1e-3));
    for (const f of built.dataFlows.filter((f: any) => f.dgxPcie)) expect(crosses(f)).toBe(true);
    expect(built.flows.filter((f: any) => f.cls === 'dc' && crosses(f)).length).toBeGreaterThanOrEqual(5);
  });
});
