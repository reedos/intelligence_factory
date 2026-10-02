// Design-rule check for the boards painted from layout data (tray-pcb.js). The same data paints the atlas and feeds
// this checker, so a trace can never again run through a mounting hole, a pad, a component footprint or a package,
// cross another trace on its own layer, or crowd anything closer than the clearance (tray-pcb.test.ts).
//
// Units are the layout's (tray units, 10 cm). Layers: 'top' is the outer copper you see through the solder mask,
// 'in' an inner layer (drawn dim); obstacles block 'top' only (SMD pads, pours, parts on the surface) or 'all'
// (plated holes, via fields, package breakout rings, through-hole connectors, mezzanine modules).
//
// obstacle: { id, kind, x, z, w, d } rectangle centered on (x, z), or { id, kind, x, z, r } circle;
//           layer 'top' | 'all'; term: a bus may end inside it (a package's breakout ring, a connector's pins)
// bus:      { id, pts, hw, layers } hw = half the drawn band (traces plus their clearance channel); layers[i] is
//           segment i's layer; a change of layer between segments is a via row, drawn by the painter

const EPS = 1e-9;
export const segLen = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
export function pointSeg(p, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz;
  const t = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L2)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
}
const cross = (ax, az, bx, bz) => ax * bz - az * bx;
function segsCross(a, b, c, d) {
  const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]], den = cross(...r, ...s);
  if (Math.abs(den) < EPS) return false;
  const t = cross(c[0] - a[0], c[1] - a[1], ...s) / den, u = cross(c[0] - a[0], c[1] - a[1], ...r) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}
export function segDist(a, b, c, d) {
  if (segsCross(a, b, c, d)) return 0;
  return Math.min(pointSeg(a, c, d), pointSeg(b, c, d), pointSeg(c, a, b), pointSeg(d, a, b));
}
const inRect = (p, r, m = 0) => Math.abs(p[0] - r.x) <= r.w / 2 + m && Math.abs(p[1] - r.z) <= r.d / 2 + m;
// distance from segment ab to an obstacle's outline (0 when it enters)
export function segObstacle(a, b, o) {
  if (o.r != null) return Math.max(0, pointSeg([o.x, o.z], a, b) - o.r);
  if (inRect(a, o) || inRect(b, o)) return 0;
  const x0 = o.x - o.w / 2, x1 = o.x + o.w / 2, z0 = o.z - o.d / 2, z1 = o.z + o.d / 2;
  const c = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  let m = Infinity;
  for (let i = 0; i < 4; i++) m = Math.min(m, segDist(a, b, c[i], c[(i + 1) % 4]));
  return m;
}
export function obstacleDist(o, q) {
  if (o.r != null && q.r != null) return Math.max(0, Math.hypot(o.x - q.x, o.z - q.z) - o.r - q.r);
  if (o.r != null || q.r != null) {
    const [c, r] = o.r != null ? [o, q] : [q, o];
    const dx = Math.max(0, Math.abs(c.x - r.x) - r.w / 2), dz = Math.max(0, Math.abs(c.z - r.z) - r.d / 2);
    return Math.max(0, Math.hypot(dx, dz) - c.r);
  }
  const dx = Math.max(0, Math.abs(o.x - q.x) - (o.w + q.w) / 2), dz = Math.max(0, Math.abs(o.z - q.z) - (o.d + q.d) / 2);
  return Math.hypot(dx, dz);
}
const bounds = o => o.r != null ? [o.x - o.r, o.z - o.r, o.x + o.r, o.z + o.r] : [o.x - o.w / 2, o.z - o.d / 2, o.x + o.w / 2, o.z + o.d / 2];
const blocks = (obstacleLayer, layer) => obstacleLayer === 'all' || layer === 'via' || obstacleLayer === layer;
const sameLayer = (a, b) => a === b || a === 'via' || b === 'via';
// a bus's segments, plus a zero-length 'via' segment wherever it changes layer: a via row goes through every layer
export function segsOf(b) {
  const out = b.pts.slice(1).map((q, i) => [b.pts[i], q, b.layers[i], i]);
  for (let i = 1; i < b.layers.length; i++) if (b.layers[i] !== b.layers[i - 1]) out.push([b.pts[i], b.pts[i], 'via', -1]);
  return out;
}

// A spatial index of everything placed so far, used both to check a finished plan and to place the fill.
export class Clearance {
  constructor(gap, cell = 0.1) { this.gap = gap; this.cell = cell; this.grid = new Map(); this.items = []; }
  _keys(x0, z0, x1, z1) {
    const c = this.cell, out = [];
    for (let i = Math.floor(x0 / c); i <= Math.floor(x1 / c); i++) for (let j = Math.floor(z0 / c); j <= Math.floor(z1 / c); j++) out.push(`${i},${j}`);
    return out;
  }
  _near(x0, z0, x1, z1) {
    const m = this.gap + 0.08, seen = new Set();
    for (const k of this._keys(x0 - m, z0 - m, x1 + m, z1 + m)) for (const it of this.grid.get(k) || []) seen.add(it);
    return seen;
  }
  _add(it, [x0, z0, x1, z1]) {
    this.items.push(it);
    for (const k of this._keys(x0, z0, x1, z1)) { if (!this.grid.has(k)) this.grid.set(k, []); this.grid.get(k).push(it); }
  }
  addObstacle(o) { this._add({ type: 'ob', o }, bounds(o)); }
  addBus(b) {
    b.segs = segsOf(b);
    b.segs.forEach((s, i) => this._add({ type: 'seg', b, i }, [Math.min(s[0][0], s[1][0]) - b.hw, Math.min(s[0][1], s[1][1]) - b.hw, Math.max(s[0][0], s[1][0]) + b.hw, Math.max(s[0][1], s[1][1]) + b.hw]));
  }
  // violations a bus would cause against what is placed (ignoring itself)
  busFaults(b) {
    const out = [], segs = segsOf(b), g = this.gap, last = b.pts.length - 2;
    const ends = [b.pts[0], b.pts.at(-1)];
    segs.forEach(([a, c, layer, i]) => {
      const box = [Math.min(a[0], c[0]) - b.hw, Math.min(a[1], c[1]) - b.hw, Math.max(a[0], c[0]) + b.hw, Math.max(a[1], c[1]) + b.hw];
      for (const it of this._near(...box)) {
        if (it.type === 'ob') {
          const o = it.o;
          if (!blocks(o.layer, layer)) continue;
          // a bus may run into the breakout of the part it ends on, on its end segment only
          if (o.term && !b.fill && ((i === 0 && inRect(ends[0], o, 0.03)) || (i === last && inRect(ends[1], o, 0.03)))) continue;
          const dist = segObstacle(a, c, o) - b.hw;
          if (dist < g - 1e-6) out.push(`${b.id} (${layer}) ${dist <= 0 ? 'runs through' : `comes within ${(dist / g).toFixed(2)} gap of`} ${o.kind} ${o.id}`);
        } else if (it.b !== b) {
          const [p, q, l2] = it.b.segs[it.i];
          if (!sameLayer(l2, layer)) continue;
          // two buses that end in the same part may meet inside its breakout ring
          const dist = segDist(a, c, p, q) - b.hw - it.b.hw;
          if (dist < g - 1e-6) {
            const shared = !b.fill && !it.b.fill && this.items.some(x => x.type === 'ob' && x.o.term && [b.pts[0], b.pts.at(-1)].some(e => inRect(e, x.o, 0.03)) && [it.b.pts[0], it.b.pts.at(-1)].some(e => inRect(e, x.o, 0.03))
              && closestInside(a, c, p, q, x.o));
            if (!shared) out.push(`${b.id} ${dist <= -Math.min(b.hw, it.b.hw) ? 'crosses' : dist <= 0 ? 'overlaps' : 'crowds'} ${it.b.id} on layer ${layer}`);
          }
        }
      }
    });
    return out;
  }
  obstacleFaults(o, { against = () => true, buses = true } = {}) {
    const out = [], g = this.gap, [x0, z0, x1, z1] = bounds(o);
    for (const it of this._near(x0, z0, x1, z1)) {
      if (it.type === 'ob') {
        if (it.o === o || !against(it.o)) continue;
        const dist = obstacleDist(o, it.o);
        if (dist < g - 1e-6) out.push(`${o.kind} ${o.id} ${dist <= 0 ? 'overlaps' : 'crowds'} ${it.o.kind} ${it.o.id}`);
      } else if (buses) {
        const [a, c, layer] = it.b.segs[it.i];
        if (!blocks(o.layer, layer)) continue;
        if (o.term && !it.b.fill && [it.b.pts[0], it.b.pts.at(-1)].some(e => inRect(e, o, 0.03))) continue;
        const dist = segObstacle(a, c, o) - it.b.hw;
        if (dist < g - 1e-6) out.push(`${o.kind} ${o.id} ${dist <= 0 ? 'sits on' : 'crowds'} ${it.b.id} (${layer})`);
      }
    }
    return out;
  }
}
// is the closest approach of the two segments inside the part's rectangle (a shared breakout)?
function closestInside(a, c, p, q, o) {
  const n = 16; let best = Infinity, at = null;
  for (let k = 0; k <= n; k++) {
    const t = k / n, x = [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t], d = pointSeg(x, p, q);
    if (d < best) { best = d; at = x; }
  }
  return inRect(at, o, 0.03);
}

// Every rule the plan must keep. Returns readable violations; [] means clean.
// plan: { boards, obstacles, buses, fill: { obstacles, buses } }  (built by tray-pcb.js pcbPlan)
export function checkPcb(plan, { gap = 0.0064, edge = 0.02 } = {}) {
  const bad = [], C = new Clearance(gap);
  const obstacles = [...plan.obstacles, ...plan.fill.obstacles], buses = [...plan.buses, ...plan.fill.buses];
  for (const o of obstacles) C.addObstacle(o);
  for (const b of buses) C.addBus(b);
  // holes clear every part and pad; fill parts clear everything; a pad never sits on another part
  // holes keep the clearance from every part and pad; the drawn pads (packages, regulators, connectors, test points)
  // never overlap each other. Parts modelled in 3D are keep-outs for copper only: how they sit is the model's business.
  for (const o of plan.obstacles) {
    const hole = o.kind === 'hole';
    bad.push(...C.obstacleFaults(o, { buses: false, against: q => hole || q.kind === 'hole' || !!(o.pad && q.pad && !o.model && !q.model) })
      .filter(v => hole || v.includes(' overlaps ') || v.includes('hole')));
  }
  for (const o of plan.fill.obstacles) bad.push(...C.obstacleFaults(o));
  // a pour's thermal vias go through the board: none may land on an inner-layer run under the pour
  for (const p of plan.pours || []) for (const v of p.vias) for (const b of buses) for (const [a, c, layer] of b.segs)
    if (layer !== 'top' && pointSeg(v, a, c) < b.hw + gap + 0.004 - 1e-6) bad.push(`thermal via at ${v.map(n => n.toFixed(3))} lands on ${b.id} (${layer})`);
  for (const b of buses) {
    bad.push(...C.busFaults(b));
    // inside one board, clear of its edge stitching
    for (const [a, c] of b.segs) {
      const on = plan.boards.some(r => [a, c].every(p => inRect(p, { x: r.x, z: r.z, w: r.w - 2 * (edge + b.hw), d: r.d - 2 * (edge + b.hw) })));
      if (!on) bad.push(`${b.id} runs off its board near ${a.map(v => v.toFixed(2))}`);
    }
  }
  return [...new Set(bad)];
}
