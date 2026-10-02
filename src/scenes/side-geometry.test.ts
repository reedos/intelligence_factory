import { describe, it, expect } from 'vitest';
import { engineLayout, asicTap, edgeConnOf, elsOf, ELS_LANES, ASIC_HALF, COPPER_HEADS, copperLane, copperChip, PAIR_HALF, cpoFiberRoutes, baillyLayout, baillyFiberRoutes, BAILLY, CPO_DIE } from './side-geometry.js';

// Codex's optics review, 09/28: floating-point side vectors sent 12 of 18 ASIC taps outside the chip and 15 of 18
// connectors off the package edge; four laser modules fed more lanes than one can; an AEC pair missed its retimer.
const SUB = 10.4, engines = engineLayout();

// Closest distance between finite 3D segments, including parallel segments and
// endpoints. Equality of segment coordinates cannot detect crossing fibers.
function segmentDistance(p: number[], q: number[], r: number[], s: number[]) {
  const sub = (a: number[], b: number[]) => a.map((v, i) => v - b[i]);
  const dot = (a: number[], b: number[]) => a.reduce((n, v, i) => n + v * b[i], 0);
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const u = sub(q, p), v = sub(s, r), w = sub(p, r);
  const a = dot(u, u), b = dot(u, v), c = dot(v, v), d = dot(u, w), e = dot(v, w);
  let t = 0, h = 0;
  if (a < 1e-16) h = c < 1e-16 ? 0 : clamp(e / c);
  else if (c < 1e-16) t = clamp(-d / a);
  else {
    const denominator = a * c - b * b;
    t = denominator > 1e-16 ? clamp((b * e - c * d) / denominator) : 0;
    h = (b * t + e) / c;
    if (h < 0) { h = 0; t = clamp(-d / a); }
    else if (h > 1) { h = 1; t = clamp((b - d) / a); }
  }
  return Math.hypot(...w.map((n, i) => n + t * u[i] - h * v[i]));
}
describe('CPO package geometry', () => {
  it('has 18 engines, three per subassembly', () => expect(engines.length).toBe(18));
  it('every engine taps the ASIC on the edge it faces, inside the chip', () => {
    for (const e of engines) {
      const [x, z] = asicTap(e), along = e.out[0] !== 0 ? z : x, across = e.out[0] !== 0 ? x : z;
      expect(Math.abs(across), `engine ${e.side}/${e.t}`).toBeCloseTo(ASIC_HALF, 9);
      expect(Math.abs(along), `engine ${e.side}/${e.t}`).toBeLessThan(ASIC_HALF);
      expect(Math.sign(across)).toBe(Math.sign(e.out[0] + e.out[1]));
    }
  });
  it('every connector sits on the package edge, in line with its engine', () => {
    for (const e of engines) {
      const [x, z] = edgeConnOf(e, SUB), across = e.out[0] !== 0 ? x : z, along = e.out[0] !== 0 ? z : x;
      expect(Math.abs(across)).toBeCloseTo(SUB / 2 + 0.2, 9);
      expect(along).toBeCloseTo(e.out[0] !== 0 ? e.z : e.x, 9);
      expect(Math.abs(along)).toBeLessThan(SUB / 2);
    }
  });
  it('no laser module lights more than its 32 transmit lanes', () => {
    const lanes = new Map();
    engines.forEach((_, i) => lanes.set(elsOf(i), (lanes.get(elsOf(i)) || 0) + 8));
    for (const [els, n] of lanes) expect(n, `laser module ${els}`).toBeLessThanOrEqual(ELS_LANES);
    expect([...lanes.values()].reduce((a, b) => a + b, 0)).toBe(144);
  });
  it('data exits do not terminate on or turn along the laser perimeter', () => {
    for (const [i, e] of engines.entries()) {
      const routes = cpoFiberRoutes(e, i);
      expect(routes.tx).toHaveLength(8); expect(routes.rx).toHaveLength(8); expect(routes.cw).toHaveLength(2);
      for (const points of [...routes.tx, ...routes.rx]) {
        const radii = points.map(p => p[0] * e.out[0] + p[2] * e.out[1]);
        for (let k = 1; k < radii.length; k++) expect(radii[k]).toBeGreaterThan(radii[k-1]);
        expect(radii.at(-1)).toBeGreaterThan(7);
        expect(points.at(-1)![1]).toBeGreaterThan(2); // above the lower laser corridor
      }
      for (const points of routes.cw) {
        expect(points[0][0]).toBe(7.24); // assigned ELS optical aperture
        expect(points.at(-1)![0] * e.out[0] + points.at(-1)![2] * e.out[1]).toBeCloseTo(4.18);
        for (const p of points.slice(1,-2)) expect(p[1]).toBeLessThan(1.2);
      }
    }
  });
  it('laser feeds never share a segment, which would read as a bus', () => {
    const segments = new Set<string>();
    for (const [i, e] of engines.entries()) for (const points of cpoFiberRoutes(e,i).cw)
      for (let k=1;k<points.length;k++) {
        const key = [JSON.stringify(points[k-1]),JSON.stringify(points[k])].sort().join('|');
        expect(segments.has(key)).toBe(false); segments.add(key);
      }
  });
  it('the clearance check detects crossing, skew, parallel and endpoint contacts', () => {
    expect(segmentDistance([-1,0,0], [1,0,0], [0,-1,0], [0,1,0])).toBe(0);
    expect(segmentDistance([-1,0,0], [1,0,0], [0,-1,.01], [0,1,.01])).toBeCloseTo(.01);
    expect(segmentDistance([0,0,0], [1,0,0], [.5,.02,0], [2,.02,0])).toBeCloseTo(.02);
    expect(segmentDistance([0,0,0], [1,0,0], [1.01,0,0], [2,0,0])).toBeCloseTo(.01);
    expect(segmentDistance([0,0,0], [0,0,0], [-1,.02,0], [1,.02,0])).toBeCloseTo(.02);
  });
  it('every distinct physical fiber has clearance along its entire route', () => {
    // These radii match side-cpo.js and build-cpo.py. Test CW against CW and
    // data, and data against data: no exception for fibers from one engine.
    const fibers = engines.flatMap((e, i) => Object.entries(cpoFiberRoutes(e, i))
      .flatMap(([kind, paths]) => paths.map((points, lane) => ({
        name: `engine ${i} ${kind} ${lane}`, points, radius: kind === 'cw' ? .008 : .007,
      }))));
    const violations: string[] = [];
    for (let i = 0; i < fibers.length; i++) for (let j = i + 1; j < fibers.length; j++) {
      const a = fibers[i], b = fibers[j], required = a.radius + b.radius;
      for (let k = 1; k < a.points.length; k++) for (let l = 1; l < b.points.length; l++) {
        const distance = segmentDistance(a.points[k-1], a.points[k], b.points[l-1], b.points[l]);
        if (distance < required - 1e-6)
          violations.push(`${a.name} segment ${k} / ${b.name} segment ${l}: ${distance} < ${required} cm`);
      }
    }
    expect(violations).toEqual([]);
  });
});
describe('Broadcom-style CPO package geometry', () => {
  const tiles = baillyLayout(), { L, W } = CPO_DIE.mzm;
  it('has eight radial tiles, two per side, each tapping the ASIC on the edge it faces', () => {
    expect(tiles).toHaveLength(8);
    for (const side of [0, 1, 2, 3]) expect(tiles.filter(t => t.side === side)).toHaveLength(2);
    for (const t of tiles) {
      const [x, z] = asicTap(t), across = t.out[0] !== 0 ? x : z, along = t.out[0] !== 0 ? z : x;
      expect(Math.abs(across)).toBeCloseTo(ASIC_HALF, 9); expect(Math.abs(along)).toBeLessThan(ASIC_HALF);
      expect(BAILLY.rIn).toBeGreaterThan(ASIC_HALF + .3);                                  // room for the package traces
      expect(BAILLY.conn[1]).toBeLessThan(SUB / 2);                                         // connector on the package
      expect(t.r + L / 2).toBeCloseTo(BAILLY.conn[0], 9);                                  // connector at the tile's outer end
    }
  });
  it('tiles never overlap, the corner tiles of neighbouring sides included', () => {
    const box = (t: any) => { const r0 = BAILLY.rIn, r1 = BAILLY.conn[1], c = [t.out[0] !== 0 ? [r0 * t.out[0], r1 * t.out[0]] : [t.t - W / 2, t.t + W / 2].map(v => v * t.tan[0]), t.out[1] !== 0 ? [r0 * t.out[1], r1 * t.out[1]] : [t.t - W / 2, t.t + W / 2].map(v => v * t.tan[1])];
      return c.map(([a, b]) => [Math.min(a, b), Math.max(a, b)]); };
    for (let i = 0; i < tiles.length; i++) for (let j = i + 1; j < tiles.length; j++) {
      const [ax, az] = box(tiles[i]), [bx, bz] = box(tiles[j]);
      expect(ax[1] <= bx[0] || bx[1] <= ax[0] || az[1] <= bz[0] || bz[1] <= az[0], `tiles ${i} and ${j}`).toBe(true);
    }
  });
  it('every tile fiber has clearance along its entire route, and data leaves outward above the laser corridor', () => {
    const fibers = tiles.flatMap((t, i) => Object.entries(baillyFiberRoutes(t, i)).flatMap(([kind, paths]) => paths.map((points, lane) => ({ name: `tile ${i} ${kind} ${lane}`, points, radius: kind === 'cw' ? .008 : .007, kind, t }))));
    for (const f of fibers) if (f.kind !== 'cw') {
      const radii = f.points.map(p => p[0] * f.t.out[0] + p[2] * f.t.out[1]);
      for (let k = 1; k < radii.length; k++) expect(radii[k]).toBeGreaterThan(radii[k - 1]);
      expect(f.points.at(-1)![1]).toBeGreaterThan(2);
    } else expect(f.points[0][0]).toBe(7.24);
    const violations: string[] = [];
    for (let i = 0; i < fibers.length; i++) for (let j = i + 1; j < fibers.length; j++) {
      const a = fibers[i], b = fibers[j], required = a.radius + b.radius;
      for (let k = 1; k < a.points.length; k++) for (let l = 1; l < b.points.length; l++) {
        const d = segmentDistance(a.points[k - 1], a.points[k], b.points[l - 1], b.points[l]);
        if (d < required - 1e-6) violations.push(`${a.name} ${k} / ${b.name} ${l}: ${d}`);
      }
    }
    expect(violations).toEqual([]);
  });
});
describe('copper plugs', () => {
  it('every pair that passes a chip enters and leaves its footprint', () => {
    for (const [kind, hx] of COPPER_HEADS) {
      const chip = copperChip(kind, hx); if (!chip) continue;
      for (let i = 0; i < 4; i++) for (const rx of [false, true]) {
        if (chip.rxOnly && !rx) continue;
        const x = copperLane(hx, i, rx);
        expect(x - PAIR_HALF, `${kind} ${rx ? 'RX' : 'TX'} ${i}`).toBeGreaterThan(chip.x - chip.w / 2);
        expect(x + PAIR_HALF, `${kind} ${rx ? 'RX' : 'TX'} ${i}`).toBeLessThan(chip.x + chip.w / 2);
      }
    }
  });
});
