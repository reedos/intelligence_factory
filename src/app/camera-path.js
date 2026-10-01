// The path a camera move takes, as a pure function of the move and its progress, so the stage can play it and the
// clearance check can sample it with the same math. A move is { p0, t0, p1, t1, arc, hop, curve }:
//   arc  swings the camera around the moving aim point (spherical interpolation), rising by `lift` and pulling back
//        by `pull` mid-move; `xlift`, `xpull` and `xturn` (a swing to one side) are the clearance detour on top (see
//        clearPath), shaped sin² rather than sin, so the camera leaves and arrives along the move's own path and only
//        the middle changes
//   hop  on a straight move, rises by `up` (world units, negative dips), pulls back by `back` (a fraction of the aim
//        distance) and steps aside by `side` (world units, level) mid-move, again sin²; set only when the straight
//        line would pass through something
// Neither bump touches the ends: at u = 0 and u = 1 the camera sits exactly on its start and end framing.
import * as THREE from 'three';

export const ease = u => (u < 0.5 ? 4 * u ** 3 : 1 - Math.pow(-2 * u + 2, 3) / 2);
const _s = new THREE.Spherical(), _v = new THREE.Vector3();

// the camera position and aim point at progress u (0..1)
export function poseAt(m, u, pos = new THREE.Vector3(), target = new THREE.Vector3()) {
  const e = (m.curve || ease)(u), a = m.arc, bump = Math.sin(Math.PI * u), bump2 = bump * bump;
  target.lerpVectors(m.t0, m.t1, e);
  if (a) {
    _s.set(
      Math.exp(Math.log(a.s0.radius) + (Math.log(a.s1.radius) - Math.log(a.s0.radius)) * e) * (1 + a.pull * bump + (a.xpull || 0) * bump2),
      Math.max(0.1, a.s0.phi + (a.s1.phi - a.s0.phi) * e - a.lift * bump - (a.xlift || 0) * bump2),
      a.s0.theta + a.dTheta * e + (a.xturn || 0) * bump2);
    pos.copy(target).add(_v.setFromSpherical(_s));
  } else {
    pos.lerpVectors(m.p0, m.p1, e);
    const h = m.hop;
    if (h && bump2 > 0) {
      _v.subVectors(pos, target);
      pos.addScaledVector(_v, h.back * bump2);
      pos.y += h.up * bump2;
      if (h.side) {                                       // across the way it is going, level
        _v.set(m.p1.z - m.p0.z, 0, m.p0.x - m.p1.x);
        const l = _v.length(); if (l > 1e-9) pos.addScaledVector(_v, (h.side / l) * bump2);
      }
    }
  }
  return { pos, target };
}

// n + 1 evenly spaced poses along the move, u = 0 .. 1
export function samplePath(m, n = 32) {
  const out = [];
  for (let k = 0; k <= n; k++) { const u = k / n, { pos, target } = poseAt(m, u); out.push({ u, pos, target }); }
  return out;
}
export const pathLength = pts => pts.reduce((s, p, k) => (k ? s + p.pos.distanceTo(pts[k - 1].pos) : 0), 0);

// Detour the path until nothing solid lies along it. `blocked(a, b)` gets two consecutive samples ({ u, pos, target })
// and says how badly the step between them is obstructed (0 or false: clear; higher is worse, e.g. 1 for skimming a
// surface, 100 for passing through it). The candidates are a grid of detours, tried smallest first: arcs climb or
// flatten (xlift), stand further off (xpull) and swing to either side (xturn); straight moves hop up or dip (up),
// pull back (back) and step aside (side). The first clear one wins. If none is, the least obstructed one does (the
// authored path on a tie), so a detour never makes a move worse; with `through`, a detour whose cost still reaches
// it (it passes through something) is dropped for the authored path, a smaller change no less sure. `budgetMs` bounds
// the search on a slow device (the best found so far stands). The end framing never changes. Leaves the chosen
// arc/hop on the move and returns { clear, tries, stretch, costs }: `stretch` is how much longer the path got, for
// the caller to lengthen the move; `costs` lists each candidate's obstruction, the authored path first (counting
// stops once a candidate is no better than the best so far).
export function clearPath(m, blocked, { n = 32, through = Infinity, budgetMs = Infinity } = {}) {
  const t0 = performance.now(), first = samplePath(m, n), base = pathLength(first) || 1;
  const cost = (pts, worst) => {
    let c = 0;
    for (let k = 1; k < pts.length && c < worst; k++) c += +blocked(pts[k - 1], pts[k]) || 0;
    return c;
  };
  const authored = { cost: cost(first, Infinity), arc: m.arc && { xlift: m.arc.xlift || 0, xpull: m.arc.xpull || 0, xturn: m.arc.xturn || 0 }, hop: m.hop || null, pts: first, t: 0 };
  if (!authored.cost) return { clear: true, tries: 0, stretch: 1, costs: [0] };
  let best = authored;
  const costs = [best.cost], cands = [];
  // the scale of a straight move: how far the camera travels and how far it stands off its aim
  const scale = Math.max(m.p0.distanceTo(m.p1), m.p0.distanceTo(m.t0), m.p1.distanceTo(m.t1), 1e-6);
  if (m.arc) {
    for (const xlift of [-0.2, -0.1, 0, 0.15, 0.3, 0.5, 0.8, 1.1]) for (const xpull of [0, 0.25, 0.6, 1.2, 2, 3]) for (const xturn of [0, 0.15, -0.15, 0.3, -0.3, 0.5, -0.5]) {
      const size = Math.abs(xlift) + 0.8 * xpull + Math.abs(xturn);
      if (size) cands.push({ size, arc: { xlift, xpull, xturn } });
    }
  } else {
    for (const up of [-0.1, -0.05, 0, 0.1, 0.2, 0.35, 0.6, 1]) for (const side of [0, 0.05, -0.05, 0.1, -0.1, 0.2, -0.2]) for (const back of [0, 0.2, 0.5]) {
      const size = Math.abs(up) + Math.abs(side) + 0.5 * back;
      if (size) cands.push({ size, hop: { up: up * scale, back, side: side * scale } });
    }
  }
  cands.sort((a, b) => a.size - b.size);
  const apply = c => { if (c.arc) Object.assign(m.arc, c.arc); else m.hop = c.hop; };
  let t = 0;
  for (const c of cands) {
    if (performance.now() - t0 > budgetMs) break;
    t++; apply(c);
    const pts = samplePath(m, n), k = cost(pts, best.cost);
    costs.push(k);
    if (k < best.cost) best = { cost: k, arc: c.arc, hop: c.hop, pts, t };
    if (!k) break;
  }
  if (best.cost >= through && best.t) best = authored;
  apply(best.arc ? { arc: best.arc } : { hop: best.hop });
  return { clear: !best.cost, tries: t, stretch: pathLength(best.pts) / base, costs };
}
