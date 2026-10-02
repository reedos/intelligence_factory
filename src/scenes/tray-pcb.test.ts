// The tray and rack boards are painted from layout data (tray-pcb.js pcbPlan) and the same data is design-rule
// checked here (pcb-check.js): no trace through a mounting hole, a pad, a package or a part modelled on the board,
// no same-layer crossing (a bus that must cross another drops to an inner layer through a via row), and never
// closer than the clearance. The painter is recorded through a stand-in canvas to prove it draws only the plan.
import { describe, it, expect, beforeAll } from 'vitest';
import { checkPcb, segsOf } from './pcb-check.js';
import { recordContext } from './face-diagram.js';

let tp: any;
beforeAll(async () => {
  (globalThis as any).document = { createElement: () => {
    const c: any = { width: 0, height: 0 };
    c.getContext = () => { const r = recordContext(c.width, c.height); recs.push(r.rec); return r.ctx; };
    return c;
  } };
  tp = await import('./tray-pcb.js');
});
const recs: any[] = [];
const ACCELS = ['h100', 'gb200', 'gb300', 'rubin'];
const clone = (p: any) => ({ ...p, buses: p.buses.map((b: any) => ({ ...b })), obstacles: [...p.obstacles], fill: { buses: p.fill.buses.map((b: any) => ({ ...b })), obstacles: [...p.fill.obstacles] } });
const bus = (id: string, pts: number[][], layers: string[], pairs = 8) => ({ id, pts, layers, pairs, hw: (pairs * 0.0105 + 0.006) / 2 });

describe('tray and rack boards pass the design-rule check', () => {
  for (const accel of ACCELS) for (const lod of ['tray', 'rack']) {
    it(`${accel} ${lod}: no trace through a hole, pad, package or part; no same-layer crossing; clearance kept`, () => {
      expect(checkPcb(tp.pcbPlan(accel, lod))).toEqual([]);
    });
  }
  it('the boards stay dense: every board carries routed buses, inner-layer runs and procedural fill', () => {
    for (const accel of ACCELS) {
      const p = tp.pcbPlan(accel, 'tray');
      expect(p.buses.length).toBeGreaterThanOrEqual(10);
      expect(p.buses.some((b: any) => b.layers.includes('in'))).toBe(true);
      expect(p.fill.buses.length + p.fill.obstacles.length).toBeGreaterThan(250);
    }
  });
});

describe('the checker catches each fault', () => {
  const base = () => clone(tp.pcbPlan('gb200', 'tray'));
  it('a bus through a mounting hole (the old GB200 outboard NVLink channel at x 1.97 through the hole at 2.03, -1)', () => {
    const p = base(); p.buses.push(bus('old NVLink', [[1.97, -0.5], [1.97, -1.5]], ['top'], 12));
    expect(checkPcb(p).some(v => v.includes('old NVLink') && v.includes('runs through hole'))).toBe(true);
  });
  it('a bus across VRM pads, and an inner-layer bus under them is fine', () => {
    const top = base(); top.buses.push(bus('cross', [[1.82, -0.3], [1.82, 0.3]], ['top']));
    expect(checkPcb(top).some(v => v.includes('cross (top) runs through VRM pad'))).toBe(true);
    const inner = base(); inner.buses.push(bus('cross', [[1.82, -0.3], [1.82, 0.3]], ['in']));
    expect(checkPcb(inner).some(v => v.includes('cross') && v.includes('VRM pad'))).toBe(false);
  });
  it('a bus through a package it does not end on, and through a part modelled in 3D', () => {
    const p = base(); p.buses.push(bus('thru', [[0.3, -1.2], [1.9, -1.2]], ['in']));
    expect(checkPcb(p).some(v => v.includes('thru (in) runs through package'))).toBe(true);
    const q = base(); q.buses.push(bus('under bar', [[1.1, -2.5], [1.1, -2.9]], ['top'], 2));
    expect(checkPcb(q).some(v => v.includes('under bar (top) runs through part 12 V bar'))).toBe(true);
  });
  it('a same-layer crossing, and the same crossing with one bus on an inner layer passes the crossing rule', () => {
    const p = base(), q = base();
    p.buses.push(bus('a', [[0.4, -2.6], [0.8, -2.6]], ['top'], 3), bus('b', [[0.6, -2.4], [0.6, -2.8]], ['top'], 3));
    q.buses.push(bus('a', [[0.4, -2.6], [0.8, -2.6]], ['top'], 3), bus('b', [[0.6, -2.4], [0.6, -2.8]], ['in'], 3));
    expect(checkPcb(p).some(v => /a crosses b on layer top|b crosses a on layer top/.test(v))).toBe(true);
    expect(checkPcb(q).some(v => /a crosses b|b crosses a/.test(v))).toBe(false);
  });
  it('a via row dropped onto another layer\'s bus', () => {
    const p = base();
    p.buses.push(bus('a', [[0.4, -2.6], [0.8, -2.6]], ['in'], 3), bus('b', [[0.6, -2.4], [0.6, -2.6], [0.6, -2.8]], ['top', 'in'], 3));
    expect(checkPcb(p).some(v => v.includes('b crosses a on layer via') || v.includes('a crosses b on layer'))).toBe(true);
  });
  it('clearance below the gap', () => {
    const p = base(), b0 = bus('near', [[0.4, -2.6], [0.8, -2.6]], ['top'], 3);
    p.buses.push(b0, bus('neighbor', [[0.4, -2.6 + 2 * b0.hw + 0.003], [0.8, -2.6 + 2 * b0.hw + 0.003]], ['top'], 3));
    expect(checkPcb(p).some(v => v.includes('crowds'))).toBe(true);
  });
  it('a hole on a pad, and a bus off its board', () => {
    const p = base(); p.obstacles.push({ id: 'Hx', kind: 'hole', x: 1.82, z: 0.2, r: 0.04, layer: 'all' });
    p.buses.push(bus('off', [[0.05, -2.0], [0.05, -1.0]], ['top'], 2));
    const v = checkPcb(p);
    expect(v.some(s => s.includes('hole Hx overlaps VRM pad'))).toBe(true);
    expect(v.some(s => s.includes('off runs off its board'))).toBe(true);
  });
});

describe('the painter draws the plan and nothing else', () => {
  for (const accel of ACCELS) it(`${accel}: every trace stroke lies inside a planned bus band`, () => {
    recs.length = 0;
    tp.paintPcb(accel, { W: 512, lod: 'tray' });
    const plan = tp.pcbPlan(accel, 'tray'), color = recs[0];
    const bands = [...plan.buses, ...plan.fill.buses].flatMap((b: any) => segsOf(b).filter((s: any) => s[2] !== 'via').map((s: any) => ({ a: s[0], c: s[1], layer: s[2], hw: b.hw })));
    const near = (p: number[], layer: string) => bands.some(({ a, c, layer: l, hw }) => l === layer && dist(p, a, c) <= hw + 1e-6);
    const strokes = color.paths.filter((p: any) => p.color === '#1d6849' || p.color === '#165a3f');
    expect(strokes.length).toBeGreaterThan(100);
    const stray = strokes.filter((s: any) => !s.pts.every((p: number[]) => near(p, s.color === '#1d6849' ? 'top' : 'in')));
    expect(stray.map((s: any) => `${s.color} ${s.pts[0]}`)).toEqual([]);
  });
});
function dist(p: number[], a: number[], b: number[]) {
  const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz;
  const t = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L2)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
}

// Every other board (switch trays, NIC and module cards, the rack's generic boards) carries the world-space trace
// tile from kit.js: its runs never cross or crowd one another, wrapped copies included, and its vias keep clear.
describe('generic board trace tile (kit.js tracePattern)', () => {
  it('no two runs cross or come within the gap, across the tile seams too; vias clear of runs', async () => {
    const kit: any = await import('../kit.js');
    const { paths, vias, n } = kit.tracePattern(512);
    expect(paths.length).toBeGreaterThan(60);
    const need = (p: any, q: any) => Math.max(p.w, 2 * kit.VIA_R) / 2 + Math.max(q.w, 2 * kit.VIA_R) / 2 + kit.TRACE_GAP;
    const bad: string[] = [];
    paths.forEach((p: any, i: number) => paths.forEach((q: any, j: number) => { if (j > i && kit.runGap(p, q, n) < need(p, q) - 1e-6) bad.push(`runs ${i} and ${j}`); }));
    const ends = new Set(paths.flatMap((p: any) => [p.pts[0], p.pts.at(-1)]));
    for (const v of vias) if (!ends.has(v)) for (const q of paths) if (kit.runGap({ pts: [v, v], w: 2 * kit.VIA_R }, q, n) < kit.VIA_R + Math.max(q.w, 2 * kit.VIA_R) / 2 + kit.TRACE_GAP - 1e-6) bad.push(`via ${v}`);
    expect(bad).toEqual([]);
    // and the check bites: a run straight across the tile meets one
    expect(paths.some((q: any) => kit.runGap({ pts: [[0, 256], [512, 256]], w: 1 }, q, n) < need({ w: 1 }, q))).toBe(true);
  });
});
