// Engineering design rules for the rack, data hall, campus and scale-across levels (Reed, 10/01/2026; review in
// research/design-review-rack-hall-site-2026-10-01.md). Collision-free is necessary, not sufficient: these check that
// the layouts follow the practices a competent engineer would lay out, on the native (teaching-contract) builds.
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { compute, DEFAULT_SCENARIO } from '../model/engine';
import { SITES } from '../model/sites';

let hall: any, campus: any, rack: any, across: any;
beforeAll(async () => {
  const noop = () => undefined;
  const ctx = new Proxy({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), measureText: (t: string) => ({ width: t.length * 24 }),
    createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }) } as Record<string, unknown>, { get: (t, k: string) => k in t ? t[k] : noop });
  vi.stubGlobal('document', { createElement: () => ({ width: 1, height: 1, getContext: () => ctx }) });
  [hall, campus, rack, across] = await Promise.all([import('./hall.js'), import('./campus.js'), import('./rack.js'), import('./across.js')]);
}, 30000);
afterAll(() => { vi.unstubAllGlobals(); });

const opts = (scenario: any = {}) => ({ quality: { mobile: true, shadows: false, reflections: false }, state: { mode: 'power' }, model: compute({ ...DEFAULT_SCENARIO, ...scenario }) });
const dist2 = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const len2 = (p: number[][]) => p.slice(1).reduce((s, q, i) => s + dist2(p[i], q), 0);
// a path doubles back when it reverses direction along either plan axis
function reverses(p: number[][]) {
  for (const a of [0, 1]) {
    let sign = 0;
    for (let i = 1; i < p.length; i++) {
      const d = Math.sign(Math.round((p[i][a] - p[i - 1][a]) * 1e6));
      if (!d) continue;
      if (sign && d !== sign) return true;
      sign = d;
    }
  }
  return false;
}
// smallest radius of the circle through three consecutive route points, where the route turns
function minBendRadius(points: number[][]) {
  let min = Infinity, at: number[] = [];
  for (let i = 1; i < points.length - 1; i++) {
    const [a, b, c] = [points[i - 1], points[i], points[i + 1]];
    const ab = Math.hypot(...a.map((v, k) => v - b[k])), bc = Math.hypot(...b.map((v, k) => v - c[k])), ca = Math.hypot(...c.map((v, k) => v - a[k]));
    const u = a.map((v, k) => b[k] - v), w = c.map((v, k) => b[k] - v);
    const cross = Math.hypot(u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]);
    if (cross < 1e-9 || Math.min(ab, bc) < 1e-6) continue;
    const r = ab * bc * ca / (2 * cross); if (r < min) { min = r; at = b; }
  }
  return { min, at };
}

describe('data hall: pathways, power and cooling follow the overhead plan', () => {
  for (const [name, scenario] of [['GB200 liquid', {}], ['H100 air', { accel: 'h100', cooling: 'air' }], ['Rubin 800 V DC', { accel: 'rubin', power: 'dc800' }]] as const) {
    it(`${name}: busway over each rack's rear, fiber runway apart from power, water below power`, () => {
      const b = hall.build(opts(scenario)), P = b.scene.userData.hallPlan;
      for (const row of P.rows) {
        // 2N: an A busway over the rack's rear quarter, a B busway over its front quarter, both over the rack footprint
        expect(Math.sign(row.busZ - row.z)).toBe(-row.f);
        expect(Math.sign(row.busZB - row.z)).toBe(row.f);
        for (const bz of [row.busZ, row.busZB]) {
          expect(Math.abs(bz - row.z)).toBeLessThan(P.rackDepth / 2);
          // BICSI: data cabling at least 300 mm from power cable (3D clearance between the two pathways)
          const horizontal = Math.abs(bz - row.runwayZ) - P.busHalfDepth - P.runwayHalfWidth, vertical = P.runwayY - (P.busY + .11);
          expect(Math.max(horizontal, vertical)).toBeGreaterThanOrEqual(.3);
        }
        expect(Math.abs(row.busZ - row.busZB) - 2 * P.busHalfDepth).toBeGreaterThan(.2);   // A and B never share a support
        if (row.tcsSupplyZ !== undefined) {
          // the rack loop rides below the busway, over the rack rears, and supply and return never share a line
          expect(P.tcsY).toBeLessThan(P.busY - .5);
          for (const z of [row.tcsSupplyZ, row.tcsReturnZ]) { expect(Math.sign(z - row.z)).toBe(-row.f); expect(Math.abs(z - row.z)).toBeLessThan(P.rackDepth / 2); }
          expect(Math.abs(row.tcsSupplyZ - row.tcsReturnZ)).toBeGreaterThan(2 * .035);
        }
      }
      // rack power drops come straight down from their own busway: A drops from A, B from B
      const drops = b.flows.filter((f: any) => f.group.userData.rackPowerDrop);
      expect(new Set(drops.map((f: any) => f.group.userData.rackPowerDrop))).toEqual(new Set(['A', 'B']));
      for (const f of drops) {
        const z = f.path.getPoint(0).z, key = f.group.userData.rackPowerDrop === 'A' ? 'busZ' : 'busZB';
        expect(P.rows.some((r: any) => Math.abs(r[key] - z) < 1e-6)).toBe(true);
      }
    });
    it(`${name}: no facility-water drop passes through a fiber runway or a busway`, () => {
      const b = hall.build(opts(scenario)), P = b.scene.userData.hallPlan, drops = b.scene.userData.hallCoolant.facilityDrops, r = .07;
      expect(drops.length).toBeGreaterThan(0);
      for (const [[x, top, z], [, bottom]] of drops) {
        if (x < P.rowX0 || x > P.rowX1) continue;
        for (const row of P.rows) {
          if (top > P.runwayY && bottom < P.runwayY) expect(Math.abs(z - row.runwayZ), `drop at ${x},${z} through the runway over row ${row.z}`).toBeGreaterThan(P.runwayHalfWidth + r);
          if (top > P.busY && bottom < P.busY) for (const bz of [row.busZ, row.busZB]) expect(Math.abs(z - bz), `drop at ${x},${z} through a busway over row ${row.z}`).toBeGreaterThan(P.busHalfDepth + r + .03);
        }
      }
    });
  }
  it('every rack-loop drop lands at the rear of its own rack, on its own header', () => {
    const b = hall.build(opts()), P = b.scene.userData.hallPlan, { secondary, rackDrops } = b.scene.userData.hallCoolant;
    expect(rackDrops.length).toBe(6 * 4 * 8 * 2);
    for (const drop of rackDrops) {
      const z = drop[0][2], row = P.rows.reduce((a: any, c: any) => (Math.abs(c.z - z) < Math.abs(a.z - z) ? c : a));
      expect(Math.sign(z - row.z)).toBe(-row.f);
      expect(secondary.some((rail: number[][]) => Math.abs(rail[1][2] - z) < 1e-9 && drop[0][0] >= rail[1][0] && drop[0][0] <= rail[2][0])).toBe(true);
    }
  });
  it('fiber routes keep a gentle bend radius and never kink', () => {
    const b = hall.build(opts()), routes = b.scene.userData.hallFiber.routes;
    // Corners are drawn with a 75 mm radius where the run allows (managedRoute); the tightest jog at a switch face may
    // not go below 7.5 mm, the minimum design radius of G.657.A2 bend-insensitive single-mode fiber.
    for (const r of routes) { const { min, at } = minBendRadius(r.points); expect(min, `${r.kind} at ${at.map(v => v.toFixed(3))}`).toBeGreaterThanOrEqual(.0075); }
  });
});

describe('campus: substation at the line, short feeders, diverse fiber, plant beside its halls', () => {
  it('MV feeders run the shortest practical orthogonal route to each hall and never double back', () => {
    for (const scenario of [{}, { cooling: 'liquid' }]) {
      const b = campus.build(opts(scenario)), F = b.scene.userData.campusFeeders;
      F.halls.forEach((path: number[][], i: number) => {
        expect(reverses(path), `feeder to hall ${i + 1}`).toBe(false);
        const line = F.unitSubLines[i], end = [line.x0, line.z];
        // the feeder reaches its hall's unit-substation line no more than 1.45x the straight distance (an orthogonal
        // duct bank route; the old hall A route dipped south and back north and ran 1.38x)
        let at = 0; for (let k = 1; k < path.length; k++) { if (Math.abs(path[k][1] - line.z) < 1e-6) { at = k; break; } }
        const reach = len2([...path.slice(0, at), [end[0], path[at][1]]]);
        expect(reach / dist2(F.source, end), `feeder to hall ${i + 1}`).toBeLessThan(1.45);
      });
    }
  });
  it('two fiber entrances on opposite sides of the halls, at least 20 m apart, each route straight through its hut', () => {
    const b = campus.build(opts()), C = b.scene.userData.campusFiber;
    const [a, c] = C.vaults;
    expect(dist2(a, c)).toBeGreaterThan(20);                         // TIA-942 / VA OIT: diverse entrances >= 20 m apart
    expect(Math.sign(a[1]) * Math.sign(c[1])).toBe(-1);              // one south of the halls, one north
    C.routes.forEach((r: number[][], i: number) => {
      const plan = r.map(([x, , z]) => [x, z]);
      expect(reverses(plan), `entrance route ${i + 1}`).toBe(false);
      expect(plan.some(p => dist2(p, C.huts[i]) < 1e-6), `route ${i + 1} passes through its hut`).toBe(true);
    });
  });
  it('every detailed hall has its own chilled-water pair from the plant; pairs never cross and clear the roads', () => {
    for (const scenario of [{ cooling: 'liquid' }, { cooling: 'air', accel: 'h100' }]) {
      const b = campus.build(opts(scenario)), W = b.scene.userData.campusChilledWater, roads = b.scene.userData.campusRoads.rects;
      expect(W?.hallB).toBeDefined();
      const { supply, ret } = W.hallB;
      // pairs do not intersect anywhere (same elevation, side by side)
      const segs = (p: number[][]) => p.slice(1).map((q, i) => [p[i], q]);
      const cross = (s: number[][], t: number[][]) => {
        const [[x1, , z1], [x2, , z2]] = s, [[x3, , z3], [x4, , z4]] = t;
        const d = (x2 - x1) * (z4 - z3) - (z2 - z1) * (x4 - x3); if (Math.abs(d) < 1e-9) return false;
        const u = ((x3 - x1) * (z4 - z3) - (z3 - z1) * (x4 - x3)) / d, v = ((x3 - x1) * (z2 - z1) - (z3 - z1) * (x2 - x1)) / d;
        return u > 1e-6 && u < 1 - 1e-6 && v > 1e-6 && v < 1 - 1e-6;
      };
      for (const s of segs(supply)) for (const t of segs(ret)) expect(cross(s, t)).toBe(false);
      // where a pipe is over a road it rides a bridge with at least 5 m clear underneath (pipe bottom, 0.6 m radius)
      for (const path of [supply, ret]) for (const [p, q] of segs(path)) for (let t = 0; t <= 1; t += .05) {
        const x = p[0] + (q[0] - p[0]) * t, y = p[1] + (q[1] - p[1]) * t, z = p[2] + (q[2] - p[2]) * t;
        if (roads.some((r: any) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1)) expect(y - .6, `pipe over road at ${x},${z}`).toBeGreaterThanOrEqual(5);
      }
    }
  });
});

describe('rack: rear services mirrored, coolant fed the same way as the hall', () => {
  for (const accel of ['gb200', 'gb300', 'rubin']) it(`${accel}: spine, bus bar and manifolds at the rear, mirrored; manifolds top-fed`, () => {
    const b = rack.build({ ...opts({ accel }), state: { mode: 'power' } }), R = b.scene.userData.rackPlan;
    // NVIDIA DGX GB200 user guide: the rear carries the cable cartridges, bus bar and liquid manifolds
    for (const z of [R.cartridgeZ, R.busbarZ, R.manifoldZ]) expect(z).toBeLessThan(R.trayRearZ + .03);
    const mirrored = (xs: number[]) => xs.every(x => xs.some(y => Math.abs(x + y) < 1e-9));
    expect(mirrored(R.cartridgeX)).toBe(true);
    expect(mirrored(R.manifoldX)).toBe(true);
    // the hall's rack loop is overhead (hall.js): the rack's hoses leave through its roof, inside the 600 mm width
    expect(R.coolantFeed).toBe('top');
    for (const h of R.hoses) { expect(h.top).toBeGreaterThan(R.roofY); expect(Math.abs(h.x)).toBeLessThan(.3 - .02); }
    const hall0 = hall.build(opts({ accel })).scene.userData.hallPlan;
    expect(hall0.tcsY).toBeGreaterThan(2.3);                           // the hall's rack loop runs over the rack tops
  });
});

describe('scale across: diverse long-haul routes', () => {
  it('this campus takes its two routes through two separate terminals', () => {
    const b = across.build(opts()), T = b.scene.userData.campusTerminals;
    expect(T.diverse).toBe(true);
    expect(dist2(T.east, T.north)).toBeGreaterThan(20);
  });
  it('Colossus 2 scenario builds every level with the same rules', () => {
    const model = compute({ ...SITES.colossus2.scenario, site: 'colossus2', stage: 0 } as any), o = { quality: { mobile: true, shadows: false, reflections: false }, state: { mode: 'power' }, model };
    const c = campus.build(o);
    for (const path of c.scene.userData.campusFeeders.halls) expect(reverses(path)).toBe(false);
    const h = hall.build(o);
    for (const row of h.scene.userData.hallPlan.rows) expect(Math.sign(row.busZ - row.z)).toBe(-row.f);
  });
});

describe('rack follow-up: shelves, feeds, NVLink stubs, corner clearances, runway', () => {
  const overlap = (a: number[], b: number[]) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
  for (const accel of ['gb200', 'gb300', 'rubin']) {
    it(`${accel}: eight power shelves; feed cords never cross a tray and stay in the rear cable space`, () => {
      const b = rack.build({ ...opts({ accel }), state: { mode: 'power' } }), R = b.scene.userData.rackPlan;
      expect(R.shelves).toBe(8);                         // NVIDIA DGX GB200 user guide: "eight power shelves"
      const feeds = b.scene.userData.rackFeeds;
      expect(feeds).toHaveLength(2);
      expect(new Set(feeds.map((f: any) => Math.sign(f.path[0][2])))).toEqual(new Set([-1, 1]));   // A and B from separate busways
      for (const f of feeds) for (const seg of [...f.path.slice(1).map((p: number[], i: number) => [f.path[i], p]), ...f.whips]) for (let t = 0; t <= 1; t += .02) {
        const [a, c] = seg, p = a.map((v: number, k: number) => v + (c[k] - v) * t);
        if (p[1] < R.roofY - .05) {
          expect(p[2], `feed point ${p.map((v: number) => v.toFixed(3))} behind the trays`).toBeLessThanOrEqual(R.trayRearZ + 1e-9);
          expect(Math.abs(p[0])).toBeGreaterThan(.04 + .012);          // clear of the bus bar and its cover
          for (const cx of R.cartridgeX) expect(Math.abs(p[0] - cx)).toBeGreaterThan(.03 + .012);   // clear of every cartridge (half-width .03)
        }
      }
    });
    it(`${accel}: each NVLink stub runs straight back from its own connector into the cartridge behind it`, () => {
      const b = rack.build({ ...opts({ accel }), state: { mode: 'data' } }), R = b.scene.userData.rackPlan;
      const stubs = b.dataFlows.filter((f: any) => f.cls === 'nvl' && f.count === 2);
      expect(stubs.length).toBe(6 * 4);
      for (const f of stubs) {
        const a = f.path.getPoint(0), c = f.path.getPoint(1);
        expect(Math.abs(a.x - c.x)).toBeLessThan(1e-9); expect(Math.abs(a.y - c.y)).toBeLessThan(1e-9);
        expect(R.cartridgeX.some((x: number) => Math.abs(x - a.x) < 1e-9)).toBe(true);
      }
      // the opened switch tray's links end on a cartridge face, like the stubs
      const sw = b.dataFlows.filter((f: any) => f.cls === 'nvl' && f.count === 8);
      expect(sw.length).toBe(accel === 'rubin' ? 4 : 2);
      for (const f of sw) {
        const end = f.path.getPoint(1);
        expect(R.cartridgeX.some((x: number) => Math.abs(x - end.x) < 1e-9)).toBe(true);
        expect(end.z).toBeLessThan(R.trayRearZ - .05);                 // behind the trays, on the cartridge face
      }
    });
    it(`${accel}: manifold clear of the corner post, rear rail and cartridges; runway along the row`, () => {
      const b = rack.build({ ...opts({ accel }), state: { mode: 'power' } }), C = b.scene.userData.rackPlan.rearCorner;
      expect(overlap(C.manifold, C.post)).toBe(false);
      expect(overlap(C.manifold, C.rail)).toBe(false);
      expect(overlap(C.manifold, C.cartridge)).toBe(false);
      const trunks = b.dataFlows.filter((f: any) => f.rackOpticalTrunk);
      for (const f of trunks) { const end = f.path.getPoint(1); expect(end.x).toBeLessThan(-1.5); expect(Math.abs(end.z)).toBeLessThan(.15); }
    });
  }
});

describe('hall and campus follow-up', () => {
  it('H100 rear-port risers stay inside their rack until above the roof, never through the hot-aisle roof', () => {
    const b = hall.build(opts({ accel: 'h100', cooling: 'air' }));
    const links = b.scene.userData.hallFiber.routes.filter((r: any) => r.kind === 'rack-to-leaf');
    expect(links.length).toBe(192);
    for (const r of links) for (const p of r.points) if (p[1] > 2.3 && p[1] < 2.45 && Math.abs(p[0] - r.rack.x) < .4) {
      expect(Math.abs(p[2] - r.rack.z), `riser at ${p.map((v: number) => v.toFixed(2))}`).toBeLessThan(.6);
    }
  });
  it('warm-water trim towers are piped to every detailed hall, pairs never crossing', () => {
    const b = campus.build(opts({ cooling: 'warm' })), T = b.scene.userData.campusTrimWater, roads = b.scene.userData.campusRoads.rects;
    expect(T.pairs).toHaveLength(2);
    const segs = (p: number[][]) => p.slice(1).map((q, i) => [p[i], q]);
    const cross = (s: number[][], t: number[][]) => {
      const [[x1, , z1], [x2, , z2]] = s, [[x3, , z3], [x4, , z4]] = t;
      const d = (x2 - x1) * (z4 - z3) - (z2 - z1) * (x4 - x3); if (Math.abs(d) < 1e-9) return false;
      const u = ((x3 - x1) * (z4 - z3) - (z3 - z1) * (x4 - x3)) / d, v = ((x3 - x1) * (z2 - z1) - (z3 - z1) * (x2 - x1)) / d;
      return u > 1e-6 && u < 1 - 1e-6 && v > 1e-6 && v < 1 - 1e-6;
    };
    const all = T.pairs.flatMap((p: any) => [p.supply, p.ret]);
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) for (const a of segs(all[i])) for (const c of segs(all[j])) expect(cross(a, c)).toBe(false);
    for (const path of all) for (const [p, q] of segs(path)) for (let t = 0; t <= 1; t += .05) {
      const x = p[0] + (q[0] - p[0]) * t, y = p[1] + (q[1] - p[1]) * t, z = p[2] + (q[2] - p[2]) * t;
      if (roads.some((r: any) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1)) expect(y - .6).toBeGreaterThanOrEqual(5);
    }
    for (const p of T.pairs) expect(p.supply[0][2]).toBeCloseTo(-269.5, 6);         // they start at the tower row
  });
});
