// Fiber cannot fold at a point. The route contract (side-geometry.js) stays a
// reviewed polyline; the drawn fiber and its moving light follow the same path
// with each interior corner rounded by a quadratic arc of up to 5 mm (4 mm for the thinner laser fibers), a gentle
// representative bend rather than a kink (design rule 5). build-cpo.py applies the identical rounding.
export const CW_BEND = .4;
export function roundCorners(pts, keep = () => false, radius = .5, steps = 6) {
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
// Laser feeds once kept a sharp drop from the module aperture and a sharp final lift onto the engine; every corner is
// now rounded (design rule 5). Kept as a hook for routes that must keep a corner.
export const keepCwCorner = () => false;
