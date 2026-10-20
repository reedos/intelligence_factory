// A fast, allocation-free sampler for a THREE.CurvePath of straight segments (the polylines every Flow rides).
// It reproduces CurvePath.getPointAt(u) and getTangentAt(u) step for step, from the same cached lengths, so the
// numbers agree with three's own to the last bit; it only skips the generic dispatch, the linear scan over the
// segments and the Vector3 allocations that made particle updates the largest non-render cost of a frame.
// src/path-sampler.test.ts checks it against three's own methods on random polylines.
export class PathSampler {
  constructor(path) {
    this.path = path;
    this.arc = path.getLengths();               // three's arc-length table (u to t)
    this.cum = path.getCurveLengths();          // cumulative length at the end of each segment
    this.total = path.getLength();
    this.seg = path.curves.map(c => ({ v1: c.v1, v2: c.v2, len: c.getLength() }));
  }
  // Curve.getUtoTmapping(u) for the path
  uToT(u) {
    const a = this.arc, il = a.length, target = u * a[il - 1];
    let low = 0, high = il - 1, i = 0;
    while (low <= high) {
      i = Math.floor(low + (high - low) / 2);
      const cmp = a[i] - target;
      if (cmp < 0) low = i + 1; else if (cmp > 0) high = i - 1; else { high = i; break; }
    }
    i = high;
    if (a[i] === target) return i / (il - 1);
    const before = a[i], after = a[i + 1];
    return (i + (target - before) / (after - before)) / (il - 1);
  }
  // CurvePath.getPoint(t); false when t lies past the last segment (three returns null and leaves the target alone)
  pointAtT(t, out) {
    const d = t * this.total, cum = this.cum;
    let lo = 0, hi = cum.length - 1;
    if (!(cum[hi] >= d)) return false;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] >= d) hi = mid; else lo = mid + 1; }
    const s = this.seg[lo], u = s.len === 0 ? 0 : 1 - (cum[lo] - d) / s.len;
    if (u === 1) out.copy(s.v2);
    else out.copy(s.v2).sub(s.v1).multiplyScalar(u).add(s.v1);
    return true;
  }
  pointAt(u, out) { return this.pointAtT(this.uToT(u), out); }
  // Curve.getTangent(t) by central difference, as three does for a path
  tangentAt(u, out, a, b) {
    const t = this.uToT(u), t1 = Math.max(0, t - 0.0001), t2 = Math.min(1, t + 0.0001);
    this.pointAtT(t1, a); this.pointAtT(t2, b);
    return out.copy(b).sub(a).normalize();
  }
}
