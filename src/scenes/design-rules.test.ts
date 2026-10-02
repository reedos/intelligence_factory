import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { compute, DEFAULT_SCENARIO } from '../model/engine';

// Engineering layout rules (Reed, 10/01/2026: "make sense from an engineering design perspective based on best
// practices for layout, place and route"), encoded for the levels drawn natively: the GPU package (scene 5), the
// coherent module (scene 8) and the copper plugs (scene 9). The pluggable module's authored routes are checked in
// side-module-blender.test.ts. research/design-review-packages-modules-2026-10-01.md lists each rule and fix.
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
type P3 = number[];
const sub = (a: P3, b: P3) => a.map((v, i) => v - b[i]);
const len = (a: P3) => Math.hypot(...a);
const pathLength = (pts: P3[]) => pts.slice(1).reduce((n, p, i) => n + len(sub(p, pts[i])), 0);
// proper crossing of two 2D segments (touching ends do not count)
function cross2(a: number[], b: number[], c: number[], d: number[]) {
  const o = (p: number[], q: number[], r: number[]) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  const o1 = o(a, b, c), o2 = o(a, b, d), o3 = o(c, d, a), o4 = o(c, d, b);
  return o1 * o2 < 0 && o3 * o4 < 0;
}
const plan = (p: P3) => [p[0], p[2]];
function planCrossings(paths: P3[][]) {
  let n = 0;
  for (let i = 0; i < paths.length; i++) for (let j = i + 1; j < paths.length; j++)
    for (let a = 1; a < paths[i].length; a++) for (let b = 1; b < paths[j].length; b++)
      if (cross2(plan(paths[i][a - 1]), plan(paths[i][a]), plan(paths[j][b - 1]), plan(paths[j][b]))) n++;
  return n;
}

let chip: typeof import('./chip.js'), coherent: typeof import('./side-coherent.js'), copper: typeof import('./side-copper.js');
beforeAll(async () => {
  vi.stubGlobal('document', canvasDocument());
  chip = await import('./chip.js');
  coherent = await import('./side-coherent.js');
  copper = await import('./side-copper.js');
});
afterAll(() => vi.unstubAllGlobals());

describe('GPU package (scene 5): place and route', () => {
  const builds = () => (['h100', 'gb200', 'gb300', 'rubin'] as const).map(accel => {
    const model = compute({ ...DEFAULT_SCENARIO, accel });
    const built = chip.build({ quality: { shadows: false, reflections: false, mobile: false }, state: { mode: 'data', selected: null }, model });
    return { accel, model, built, routes: built.scene.userData.packageRouting };
  });
  it('the host board escape runs start on outer-row pads and never cross', () => {
    const runs: number[][][] = [];
    for (let side = 0; side < 4; side++) for (let k = 0; k < chip.BGA_RUNS; k++) runs.push(chip.bgaRun(side, k));
    for (const run of runs) {
      const [x, z] = run[0];
      // on the outermost pad row, on the pad grid
      expect(Math.max(Math.abs(x), Math.abs(z))).toBeCloseTo(chip.BGA.half, 9);
      const along = Math.abs(x) === chip.BGA.half ? z : x;
      expect(Math.abs(((along + chip.BGA.half) / chip.BGA.pitch) % 1 - 0.5)).toBeCloseTo(0.5, 6);
      // every segment moves outward (no hook back)
      const r = run.map(([a, b]) => Math.max(Math.abs(a), Math.abs(b)));
      for (let i = 1; i < r.length; i++) expect(r[i]).toBeGreaterThan(r[i - 1]);
    }
    const as3 = runs.map(run => run.map(([x, z]) => [x, 0, z]));
    expect(planCrossings(as3)).toBe(0);
  });
  it('HBM lanes cross straight from each stack to the die edge it faces: short, parallel, no crossings', () => {
    for (const { accel, routes } of builds()) {
      expect(routes.hbm.length, accel).toBeGreaterThan(0);
      for (const r of routes.hbm) {
        const across = sub(r[2], r[1]);
        // one axis only: perpendicular to the edge, and only the gap plus the two PHY bands
        expect(across.filter((v: number) => Math.abs(v) > 1e-9).length, accel).toBe(1);
        expect(len(across), accel).toBeLessThan(0.6);
        // the two legs are vertical (microbumps)
        expect(Math.abs(r[0][0] - r[1][0]) + Math.abs(r[0][2] - r[1][2])).toBeLessThan(1e-9);
        expect(Math.abs(r[2][0] - r[3][0]) + Math.abs(r[2][2] - r[3][2])).toBeLessThan(1e-9);
      }
      expect(planCrossings(routes.hbm), accel).toBe(0);
    }
  });
  it("the drawn HBM waterfall (schematic, lifted for visibility): evenly spaced parallel strands that drop into the die on the stack's side", () => {
    for (const { accel, model, routes } of builds()) {
      const twin = model.accel.dies > 1;
      expect(routes.hbmDrawn.length, accel).toBe((routes.hbm.length / 3) * 11);   // eleven strands per live stack
      for (const r of routes.hbmDrawn) {
        const along = r.map((p: P3) => twin ? p[0] : p[2]), across = r.map((p: P3) => twin ? p[2] : p[0]);
        expect(new Set(along.map((v: number) => v.toFixed(9))).size, `${accel}: one lane, no convergence`).toBe(1);
        // moves only toward the die, and lands on it from the stack's side: inside the die edge, short of its centre line
        for (let i = 1; i < across.length; i++) expect(Math.abs(across[i]), accel).toBeLessThanOrEqual(Math.abs(across[i - 1]) + 1e-9);
        const end = Math.abs(across.at(-1)!), edge = twin ? 1.65 : 1.3;
        expect(end, accel).toBeLessThan(edge); expect(end, accel).toBeGreaterThan(edge / 2);
        expect(Math.sign(across.at(-1)!), accel).toBe(Math.sign(across[0]));
      }
      expect(planCrossings(routes.hbmDrawn), accel).toBe(0);
      // evenly spaced across each stack's sheet
      for (let g = 0; g < routes.hbmDrawn.length; g += 11) {
        const t = routes.hbmDrawn.slice(g, g + 11).map((r: P3[]) => twin ? r[0][0] : r[0][2]);
        for (let i = 2; i < t.length; i++) expect(t[i] - t[i - 1], accel).toBeCloseTo(t[1] - t[0], 9);
      }
    }
  });
  it('the die-to-die link runs straight across the seam, lanes evenly spaced', () => {
    for (const { accel, model, routes } of builds()) {
      if (model.accel.dies < 2) { expect(routes.hbi.length).toBe(0); continue; }
      for (const r of routes.hbi) { expect(new Set(r.map((p: P3) => p[2])).size, accel).toBe(1); expect(Math.abs(r[0][0]) + Math.abs(r[3][0])).toBeLessThan(0.4); }
      expect(planCrossings(routes.hbi), accel).toBe(0);
    }
  });
  it('NVLink escapes outward through bumps, substrate, ball and board run: no crossings, no doubling back, near-direct', () => {
    for (const { accel, model, routes } of builds()) {
      expect(routes.nvl.length, accel).toBe(model.accel.nvlink.linksPerGpu);
      for (const r of routes.nvl) {
        // distance from the package centre never decreases along the route
        const out = r.map((p: P3) => Math.max(Math.abs(p[0]), Math.abs(p[2])));
        for (let i = 1; i < out.length; i++) expect(out[i], accel).toBeGreaterThanOrEqual(out[i - 1] - 1e-9);
        // height never rises once it starts down (no layer change back up)
        for (let i = 1; i < r.length; i++) expect(r[i][1], accel).toBeLessThanOrEqual(r[i - 1][1] + 1e-9);
        // plan length within 1.6x the straight-line plan distance from die edge to the run's via
        const flat = r.map((p: P3) => [p[0], 0, p[2]]);
        expect(pathLength(flat) / len(sub(flat.at(-1)!, flat[0])), accel).toBeLessThan(1.6);
      }
      // routes on the same side never cross in plan (each layer's leg is fanned in order)
      expect(planCrossings(routes.nvl), accel).toBe(0);
    }
  });
  it('C4 bumps sit only under the interposer they bond to', () => {
    for (const { accel, model, built } of builds()) {
      let c4: THREE.InstancedMesh | undefined;
      built.scene.traverse((o: any) => { if (o.userData.computeDynamic === 'c4') c4 = o; });
      const twin = model.accel.dies > 1, IW = twin ? 6.2 : 6.0, ID = twin ? 5.9 : 4.0, m = new THREE.Matrix4(), p = new THREE.Vector3();
      for (let i = 0; i < c4!.count; i++) {
        c4!.getMatrixAt(i, m); p.setFromMatrixPosition(m);
        expect(Math.abs(p.x), accel).toBeLessThan(IW / 2); expect(Math.abs(p.z), accel).toBeLessThan(ID / 2);
      }
    }
  });
});

// polyline points of a native flow (kit.js Flow: a CurvePath of line segments)
const flowPoints = (f: any): P3[] => [f.path.curves[0].v1.toArray(), ...f.path.curves.map((c: any) => c.v2.toArray())];
// smallest radius of curvature along a sampled polyline: circumradius of each consecutive point triple
function minBendRadius(pts: P3[]) {
  let min = Infinity;
  for (let i = 1; i < pts.length - 1; i++) {
    const a = len(sub(pts[i], pts[i - 1])), b = len(sub(pts[i + 1], pts[i])), c = len(sub(pts[i + 1], pts[i - 1]));
    const s = (a + b + c) / 2, area = Math.sqrt(Math.max(0, s * (s - a) * (s - b) * (s - c)));
    if (a < 1e-9 || b < 1e-9 || area < 1e-12) continue;
    min = Math.min(min, a * b * c / (4 * area));
  }
  return min;
}

describe('Coherent module (scene 8): place and route', () => {
  const build = () => coherent.build({ quality: { shadows: false }, state: { mode: 'data' } });
  it('DSP copper escapes from under the package edge: nothing runs across the package top', () => {
    const { scene } = build(), r = scene.userData.coherentRouting;
    const DSPX = r.dspX, dieHalf = r.dieHalf, yTop = 1.35;
    for (const path of [...r.hostTx, ...r.hostRx, ...r.lineTx, ...r.lineRx]) for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i];
      const raised = Math.max(a[1], b[1]) > yTop + 0.02;
      if (!raised || Math.abs(a[0] - DSPX) > r.dspHalf + 0.01 || Math.abs(b[0] - DSPX) > r.dspHalf + 0.01) continue;
      // only vertical risers into the die, inside its footprint
      expect(Math.abs(a[0] - b[0]) + Math.abs(a[2] - b[2])).toBeLessThan(1e-9);
      expect(Math.abs(a[0] - DSPX)).toBeLessThanOrEqual(dieHalf + 1e-9);
    }
  });
  it('DSP-to-driver and DSP-to-TIA copper is short and direct', () => {
    const { scene } = build(), r = scene.userData.coherentRouting;
    for (const path of [...r.lineTx, ...r.lineRx]) {
      const flat = path.map((p: P3) => [p[0], 0, p[2]]);
      expect(pathLength(flat)).toBeLessThan(1.8);                 // die bank to the optics: under 1 cm of board plus the package and bond legs
    }
    expect(planCrossings(r.lineTx)).toBe(0); expect(planCrossings(r.lineRx)).toBe(0);
    expect(planCrossings(r.hostTx)).toBe(0); expect(planCrossings(r.hostRx)).toBe(0);
  });
  it('power paths never cross a high-speed lane in plan', () => {
    const built = build(), r = built.scene.userData.coherentRouting;
    const hs = [...r.hostTx, ...r.hostRx, ...r.lineTx, ...r.lineRx];
    for (const f of built.flows) {
      const pw = flowPoints(f);
      for (const lane of hs) expect(planCrossings([pw, lane])).toBe(0);
    }
  });
  it('fibers bend gently: no radius under 3 mm (bend-insensitive fiber inside a module)', () => {
    const r = build().scene.userData.coherentRouting;
    for (const [name, fiber] of Object.entries({ tx: r.txFiber, rx: r.rxFiber, carrier: r.carrierPath, lo: r.loPath, trunk: r.laserTrunk })) expect(minBendRadius(fiber as P3[]), name).toBeGreaterThanOrEqual(0.3);
  });
});

describe('Copper plugs (scene 9): place and route', () => {
  it('pairs keep at least 1 mm from the AEC power inductors and the supply trace in the centre channel', async () => {
    const { copperLane, PAIR_HALF, COPPER_HEADS } = await import('./side-geometry.js');
    for (const [, h] of COPPER_HEADS) for (let i = 0; i < 4; i++) for (const rx of [false, true]) {
      const hx = Number(h);
      const inner = Math.abs(copperLane(hx, i, rx) - hx) - PAIR_HALF - 0.008;   // nearest trace edge to the centre line
      expect(inner - 0.1).toBeGreaterThanOrEqual(0.1);                         // inductor half-width 0.1 cm
    }
  });
  it('transmit and receive banks are mirror images, evenly pitched, inside the card', async () => {
    const { copperLane, PAIR_HALF, COPPER_HEADS } = await import('./side-geometry.js');
    for (const [, h] of COPPER_HEADS) for (let i = 0; i < 4; i++) {
      const hx = Number(h);
      expect(copperLane(hx, i, false) - hx).toBeCloseTo(-(copperLane(hx, 3 - i, true) - hx), 9);
      if (i) expect(copperLane(hx, i, true) - copperLane(hx, i - 1, true)).toBeCloseTo(0.15, 9);
      expect(Math.abs(copperLane(hx, i, true) - hx) + PAIR_HALF + 0.008).toBeLessThan((1.84 - 0.3) / 2);
    }
  });
  it('edge-pad breakouts on the same card face never cross', async () => {
    const { copperLane, copperPad, COPPER_HEADS } = await import('./side-geometry.js');
    for (const [, h] of COPPER_HEADS) for (const top of [true, false]) {
      const hx = Number(h);
      const legs: P3[][] = [];
      for (let i = 0; i < 4; i++) for (const rx of [false, true]) {
        const pad = copperPad(hx, i, rx); if (pad.top !== top) continue;
        legs.push([[pad.x, 0, 2.6], [copperLane(hx, i, rx), 0, 2.25]]);
      }
      expect(planCrossings(legs)).toBe(0);
    }
  });
});
