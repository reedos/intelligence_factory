// Engineering design rules for the GB200, GB300 and Vera Rubin compute-tray boards (Reed, 10/01/2026: "make sure
// all of our designs make sense from an engineering design perspective"). Collision-free is checked by pcb-check.js;
// these check the layout itself, on the same plan the board is painted from (tray-pcb.js pcbPlan):
//   - high-speed buses are short and direct: length within a cap of the straight line from escape to connector
//   - nothing high-speed runs under a regulator: no NVLink, C2C or PCIe segment, on any layer, over an inductor
//     footprint or a power stage
//   - a layer change happens only at the escape or at the destination (a via at either end, none mid-route)
//   - mirror-symmetric parts get mirror-symmetric routes: every bus on one board has its mirror on the other
//   - one interface per channel: NVLink, C2C, PCIe and the 12 V bar keep apart
import { describe, it, expect, beforeAll } from 'vitest';

let tp: any;
beforeAll(async () => {
  (globalThis as any).document = { createElement: () => ({ getContext: () => new Proxy({}, { get: () => () => ({ addColorStop() {} }) }) }) };
  tp = await import('./tray-pcb.js');
});
const kind = (b: any) => /^NVLink/.test(b.id) ? 'nvlink' : /^C2C/.test(b.id) ? 'c2c' : /^PCIe/.test(b.id) ? 'pcie' : null;
const len = (pts: number[][]) => pts.slice(1).reduce((n, p, i) => n + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
function segDist(a: number[], b: number[], c: number[], d: number[]) {
  const pd = (p: number[], q: number[], r: number[]) => { const vx = r[0] - q[0], vz = r[1] - q[1], L = vx * vx + vz * vz; const t = L ? Math.max(0, Math.min(1, ((p[0] - q[0]) * vx + (p[1] - q[1]) * vz) / L)) : 0; return Math.hypot(p[0] - q[0] - t * vx, p[1] - q[1] - t * vz); };
  const o = (p: number[], q: number[], r: number[]) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  if (o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0) return 0;
  return Math.min(pd(a, c, d), pd(b, c, d), pd(c, a, b), pd(d, a, b));
}
const rectDist = (a: number[], b: number[], r: any) => {
  // distance from a segment to an axis-aligned rectangle (0 when it crosses it)
  const x0 = r.x - r.w / 2, x1 = r.x + r.w / 2, z0 = r.z - r.d / 2, z1 = r.z + r.d / 2;
  const inside = (p: number[]) => p[0] >= x0 && p[0] <= x1 && p[1] >= z0 && p[1] <= z1;
  if (inside(a) || inside(b)) return 0;
  const corners = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  return Math.min(...corners.map((c, i) => segDist(a, b, c, corners[(i + 1) % 4])));
};

for (const accel of ['gb200', 'gb300', 'rubin']) describe(`${accel} compute-tray board design`, () => {
  const plan = () => tp.pcbPlan(accel, 'tray');
  const fast = () => plan().buses.filter((b: any) => kind(b));

  it('high-speed buses are short and direct (length vs straight line)', () => {
    for (const b of fast()) {
      const straight = Math.hypot(b.pts.at(-1)[0] - b.pts[0][0], b.pts.at(-1)[1] - b.pts[0][1]);
      // A route that must pass another package (the GB front GPU's NVLink around the rear GPU, Grace's C2C to the rear
      // GPU around the front one) takes one side channel; everything else runs nearly straight.
      const passes = (kind(b) === 'nvlink' && /front/.test(b.id)) || (kind(b) === 'c2c' && /rear/.test(b.id));
      const cap = passes ? 1.5 : 1.15;
      expect(len(b.pts) / straight, b.id).toBeLessThanOrEqual(cap);
    }
  });

  it('no high-speed bus, on any layer, runs under an inductor or a power stage', () => {
    const p = plan(), stages = p.obstacles.filter((o: any) => /power stage/.test(o.id)), vrms = p.L.vrms;
    for (const b of fast()) for (let i = 1; i < b.pts.length; i++)
      for (const r of [...vrms, ...stages]) expect(rectDist(b.pts[i - 1], b.pts[i], r), `${b.id} vs ${r.id || 'VRM'} at ${r.x.toFixed(2)},${r.z.toFixed(2)}`).toBeGreaterThan(b.hw);
  });

  it('a layer change only at the escape or at the destination', () => {
    for (const b of fast()) expect(b.layers.join(' '), b.id).toMatch(/^(in )?top( top)*( in)?$/);
  });

  it('the two boards mirror each other, route for route (NVLink and C2C; the NICs sit on one side, so PCIe to them does not)', () => {
    const buses = fast().filter((b: any) => kind(b) !== 'pcie' || accel === 'rubin'), key = (pts: number[][]) => pts.map(p => `${p[0].toFixed(4)},${p[1].toFixed(4)}`).join(';');
    const all = new Set(buses.map((b: any) => key(b.pts)));
    for (const b of buses) expect(all.has(key(b.pts.map((p: number[]) => [-p[0] + 0, p[1]]))), `${b.id} has no mirror`).toBe(true);
  });

  it('one interface per channel: NVLink, C2C, PCIe and the 12 V bar keep apart', () => {
    const p = plan(), buses = fast(), bars = p.obstacles.filter((o: any) => /12 V bar/.test(o.id));
    for (const a of buses) {
      for (const b of buses) if (kind(a) !== kind(b)) for (let i = 1; i < a.pts.length; i++) for (let j = 1; j < b.pts.length; j++)
        expect(segDist(a.pts[i - 1], a.pts[i], b.pts[j - 1], b.pts[j]), `${a.id} vs ${b.id}`).toBeGreaterThan(a.hw + b.hw);
      for (const r of bars) for (let i = 1; i < a.pts.length; i++) expect(rectDist(a.pts[i - 1], a.pts[i], r), `${a.id} vs 12 V bar`).toBeGreaterThan(a.hw);
    }
  });

  it('every GPU reaches the nearest NVLink connector, and the connectors sit at the rear edge', () => {
    const nv = plan().buses.filter((b: any) => kind(b) === 'nvlink');
    expect(nv.length).toBe(4);
    for (const b of nv) expect(b.pts.at(-1)[1], b.id).toBeLessThan(-3);
  });
});
