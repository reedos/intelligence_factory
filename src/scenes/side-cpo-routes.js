// Fiber cannot fold at a point. The route contract (side-geometry.js) stays a
// reviewed polyline; the drawn fiber and its moving light follow the same path
// with each interior corner rounded by a short quadratic arc (up to 3 mm,
// representative bend radius). build-cpo.py applies the identical rounding.
export function roundCorners(pts, keep = () => false, radius = .3, steps = 6) {
  const out = [pts[0]];
  for (let k = 1; k < pts.length - 1; k++) {
    const p = pts[k], a = pts[k - 1], b = pts[k + 1];
    if (keep(k, pts.length)) { out.push(p); continue; }
    const la = Math.hypot(...a.map((v, j) => v - p[j])), lb = Math.hypot(...b.map((v, j) => v - p[j]));
    const d = Math.min(radius, la * .45, lb * .45);
    const p1 = p.map((v, j) => v + (a[j] - v) / la * d), p2 = p.map((v, j) => v + (b[j] - v) / lb * d);
    for (let s = 0; s <= steps; s++) { const t = s / steps, u = 1 - t; out.push(p.map((v, j) => u * u * p1[j] + 2 * u * t * v + t * t * p2[j])); }
  }
  out.push(pts.at(-1));
  return out;
}
// Laser feeds keep the sharp drop from the module aperture and the final lift onto the engine.
export const keepCwCorner = (k, n) => k === 1 || k === n - 2;
