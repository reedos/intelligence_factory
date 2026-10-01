// The path a camera move takes, as a pure function of the move and its progress, so the stage can play it and the
// clearance check can sample it with the same math. A move is { p0, t0, p1, t1, arc, hop, curve }:
//   arc  swings the camera around the moving aim point (spherical interpolation), rising by `lift` and pulling back
//        by `pull` mid-move; `xlift`, `xpull` and `xturn` (a swing to one side) are the clearance detour on top (see
//        clearPath), shaped sin² rather than sin, so the camera leaves and arrives along the move's own path and only
//        the middle changes
//   hop  on a straight move, rises by `up` (world units, negative dips), pulls back by `back` (a fraction of the aim
//        distance) and steps aside by `side` (world units, level) mid-move, again sin²; set only when the straight
//        line would pass through something
//   via  waypoints (world positions) the camera passes through on a smooth curve instead, for a move no bump can
//        clear (one whose end framing sits in among things, reachable only by backing out and coming back in)
// None of these touches the ends: at u = 0 and u = 1 the camera sits exactly on its start and end framing.
import * as THREE from 'three';

export const ease = u => (u < 0.5 ? 4 * u ** 3 : 1 - Math.pow(-2 * u + 2, 3) / 2);
const _s = new THREE.Spherical(), _v = new THREE.Vector3();

// the camera position and aim point at progress u (0..1)
export function poseAt(m, u, pos = new THREE.Vector3(), target = new THREE.Vector3()) {
  const e = (m.curve || ease)(u), a = m.arc, bump = Math.sin(Math.PI * u), bump2 = bump * bump;
  target.lerpVectors(m.t0, m.t1, e);
  if (m.via?.length) pos.copy(viaCurve(m).getPointAt(e));
  else if (a) {
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

// a move routed through waypoints: a smooth (centripetal Catmull-Rom) curve from p0 through each to p1, walked at
// even speed along its length; rebuilt only when the waypoints or the ends change
function viaCurve(m) {
  const c = m._via;
  if (c && c.via === m.via && c.p0.equals(m.p0) && c.p1.equals(m.p1)) return c.curve;
  const curve = new THREE.CatmullRomCurve3([m.p0.clone(), ...m.via, m.p1.clone()], false, 'centripetal');
  curve.arcLengthDivisions = 64;
  m._via = { via: m.via, p0: m.p0.clone(), p1: m.p1.clone(), curve };
  return curve;
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
// surface, 100 for passing through it). Candidates, smallest change first:
//   1. bumps on the move's own shape: arcs climb or flatten (xlift), stand further off (xpull) and swing to either
//      side (xturn); straight moves hop up or dip (up), pull back (back) and step aside (side)
//   2. waypoints, for what no bump clears: back out along the start framing's line of sight, travel (raised or to
//      one side if need be) and come in along the end framing's; or one waypoint over or around the middle
//   (the 90 smallest bumps, then the waypoints, then the larger bumps)
// The first clear candidate wins (screened at n/2 samples, measured at n), or the first whose every step costs no
// more than `goodEnough`. If none is clear, the least obstructed
// one does (the authored path on a tie), so a detour never makes a move worse; with `through`, a detour whose cost
// still reaches it (it passes through something) is dropped for the authored path, a smaller change no less sure.
// The search is bounded by a count of candidates (`maxTries`), not by time, so a slow device finds the same path
// as a fast one. The end framing never changes. Leaves the chosen detour on the move and returns
// { clear, good, tries, stretch, costs } (good: clear, or no step worse than `goodEnough`): `stretch` is how much longer the path got, for the caller to lengthen the move;
// `costs` lists each candidate's screened obstruction, the authored path first (counting stops once a candidate is
// no better than the best so far).
export function clearPath(m, blocked, opts) {
  const g = planPath(m, blocked, opts);
  for (;;) { const r = g.next(); if (r.done) return r.value; }
}
// the same search, one candidate per step: a caller with time to spare (a page between frames) can run it in slices
export function* planPath(m, blocked, { n = 32, through = Infinity, maxTries = Infinity, goodEnough = 0 } = {}) {
  const first = samplePath(m, n), base = pathLength(first) || 1, coarse = Math.max(4, n >> 1);
  let peak = 0;                                            // the worst single step of the last full measure
  const cost = (pts, worst) => {
    let c = 0; peak = 0;
    for (let k = 1; k < pts.length && c < worst; k++) { const b = +blocked(pts[k - 1], pts[k]) || 0; c += b; if (b > peak) peak = b; }
    return c;
  };
  const shape = () => ({ arc: m.arc && { xlift: m.arc.xlift || 0, xpull: m.arc.xpull || 0, xturn: m.arc.xturn || 0 }, hop: m.hop || null, via: m.via || null });
  const authored = { cost: cost(first, Infinity), peak, ...shape(), pts: first, t: 0 };
  if (!authored.cost) return { clear: true, good: true, tries: 0, stretch: 1, costs: [0] };
  if (authored.peak <= goodEnough) return { clear: false, good: true, tries: 0, stretch: 1, costs: [authored.cost] };   // only soft edges: as authored
  let best = authored;
  const costs = [best.cost], local = [], wide = [];
  // the scale of the move: how far the camera travels and how far it stands off its aim
  const d0 = m.p0.distanceTo(m.t0), d1 = m.p1.distanceTo(m.t1);
  const scale = Math.max(m.p0.distanceTo(m.p1), d0, d1, 1e-6);
  if (m.arc) {
    for (const xlift of [-0.2, -0.1, 0, 0.15, 0.3, 0.5, 0.8, 1.1]) for (const xpull of [0, 0.25, 0.6, 1.2, 2, 3]) for (const xturn of [0, 0.15, -0.15, 0.3, -0.3, 0.5, -0.5]) {
      const size = Math.abs(xlift) + 0.8 * xpull + Math.abs(xturn);
      if (size) local.push({ size, arc: { xlift, xpull, xturn } });
    }
  } else {
    for (const up of [-0.1, -0.05, 0, 0.1, 0.2, 0.35, 0.6, 1]) for (const side of [0, 0.05, -0.05, 0.1, -0.1, 0.2, -0.2]) for (const back of [0, 0.2, 0.5]) {
      const size = Math.abs(up) + Math.abs(side) + 0.5 * back;
      if (size) local.push({ size, hop: { up: up * scale, back, side: side * scale } });
    }
  }
  // waypoints: out along each framing's line of sight, then across, raised or aside
  const up = new THREE.Vector3(0, 1, 0), b0 = m.p0.clone().sub(m.t0).normalize(), b1 = m.p1.clone().sub(m.t1).normalize();
  const side = m.p1.clone().sub(m.p0).cross(up); if (side.lengthSq() < 1e-12) side.set(1, 0, 0); side.normalize();
  for (const k of [0.3, 0.6, 1, 1.6]) for (const h of [0, 0.15, 0.35, 0.7]) for (const sd of [0, 0.25, -0.25]) {
    const lift = up.clone().multiplyScalar(h * scale).addScaledVector(side, sd * scale);
    wide.push({ size: 2 + k + h + Math.abs(sd), via: [m.p0.clone().addScaledVector(b0, k * d0).add(lift), m.p1.clone().addScaledVector(b1, k * d1).add(lift)] });
  }
  // a framing tucked in among things (under a ledge, between boards) is left and reached level, or along its line
  // of sight only a short way, with the far side free to rise
  const flat = v => { const f = v.clone().setY(0); return f.lengthSq() > 1e-12 ? f.normalize() : v.clone(); };
  for (const k of [0.2, 0.4, 0.7, 1.1]) for (const level of [false, true]) for (const [k2, h] of [[0.3, 0], [0.3, 0.35], [0.7, 0], [0.7, 0.35]]) {
    const size = 2.2 + k + k2 + h + (level ? 0.1 : 0);
    // tucked at the end: the start backs out (and may rise), the end is reached along its line of sight or level
    wide.push({ size, via: [m.p0.clone().addScaledVector(b0, k2 * d0).addScaledVector(up, h * scale), m.p1.clone().addScaledVector(level ? flat(b1) : b1, k * d1)] });
    // tucked at the start: the same, mirrored
    wide.push({ size, via: [m.p0.clone().addScaledVector(level ? flat(b0) : b0, k * d0), m.p1.clone().addScaledVector(b1, k2 * d1).addScaledVector(up, h * scale)] });
  }
  const mid = m.p0.clone().add(m.p1).multiplyScalar(0.5);
  for (const h of [0.25, 0.5, 0.9, 1.4]) for (const sd of [0, 0.4, -0.4]) wide.push({ size: 2.5 + h + Math.abs(sd), via: [mid.clone().addScaledVector(up, h * scale).addScaledVector(side, sd * scale)] });
  // the smaller bumps first, then the waypoints, then the larger bumps: a bounded search reaches all three kinds
  local.sort((a, b) => a.size - b.size); wide.sort((a, b) => a.size - b.size);
  const cands = [...local.slice(0, 90), ...wide, ...local.slice(90)];
  const a0 = m.arc && { xlift: 0, xpull: 0, xturn: 0 };
  const apply = c => { if (m.arc) Object.assign(m.arc, c.arc || a0); m.hop = c.hop || null; m.via = c.via || null; };
  let t = 0;
  for (const c of cands) {
    if (t >= maxTries) break;
    if (t) yield t;
    t++; apply(c);
    // screened at half the samples (no fewer obstructions than that can pass), then measured in full
    const k = cost(samplePath(m, coarse), best.cost);
    costs.push(k);
    if (k >= best.cost) continue;
    const pts = samplePath(m, n), fine = cost(pts, best.cost);
    if (fine < best.cost) best = { cost: fine, peak, ...shape(), pts, t };
    // stop at a clear path, or at one whose every step is within `goodEnough` (only the soft edge of a margin)
    if (!fine || (best.t === t && best.peak <= goodEnough)) break;
  }
  if (best.cost >= through && best.t) best = authored;
  apply(best);
  return { clear: !best.cost, good: best.peak <= goodEnough && best.cost < through, tries: t, stretch: pathLength(best.pts) / base, costs };
}
