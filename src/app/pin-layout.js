// a pin whose anchor sits just inside the canvas edge is drawn whole: its circle (with its ring) is held `margin` px in
// from each edge (round-5 review: pins half cut off at the edge of the phone view)
export const keepInside = (x, y, w, h, margin = 16) => [Math.max(margin, Math.min(w - margin, x)), Math.max(margin, Math.min(h - margin, y))];

export const overlapsRect = (a, b, gap = 0) => a.left < b.right + gap && a.right > b.left - gap && a.top < b.bottom + gap && a.bottom > b.top - gap;

export function pinLabelBox(x, y, width, canvasWidth, canvasHeight, reserved, selected = false) {
  const height = 18, clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const candidates = [[x + 18, y - 9], [x - 29 - width, y - 9]];
  // beside the pin first, then under and over it; a pin that is not selected gives up (its label shows on hover)
  // when none of them is clear
  candidates.push([x - width / 2, y + 16], [x - width / 2, y - 34]);
  if (selected) {
    for (const r of reserved) candidates.push([x - width / 2, r.bottom + 6], [x - width / 2, r.top - height - 6], [r.left - width - 6, y - 9], [r.right + 6, y - 9]);
  }
  for (let [left, top] of candidates) {
    if (selected) { left = clamp(left, 6, canvasWidth - width - 6); top = clamp(top, 6, canvasHeight - height - 6); }
    const box = { left, top, right: left + width, bottom: top + height };
    if (box.left < 6 || box.right > canvasWidth - 6 || box.top < 6 || box.bottom > canvasHeight - 6) continue;
    if (!reserved.some(r => overlapsRect(box, r, 4))) return box;
  }
  return null;
}

// Small screens: numbered pins that land on top of each other are decluttered. Pins closer than `radius` px join one
// cluster. A cluster of 2..collapseAt-1 pins fans out on a ring round its centre (each pin keeps its own number), a
// bigger one folds into a single group badge, which fans out like the small ones once `expanded` holds any of its
// ids. Whatever results must not overlap: two clusters whose fans or badges would touch merge and are laid out again.
// points: [{ id, x, y }] in list order. Returns placements (id -> { x, y, ax, ay }, true point ax/ay),
// hidden ids, and groups ({ key, ids, x, y }) to draw as badges.
// `fixed` ([{ x, y }]) are pins that do not move (the selected one): a cluster that would touch one is slid clear of it.
// radius defaults to a pin's diameter (22) plus 6 px. `gap` is the clear space kept between two pins' circles once laid
// out (4 px by default); stage.js asks for more, since each pin's dark ring makes it about 30 px across on screen.
/** @param {{ id: string, x: number, y: number }[]} points @param {{ radius?: number, gap?: number, collapseAt?: number, expanded?: Set<string> | null, fixed?: { x: number, y: number }[] }} [opts] */
export function declutterPins(points, { radius = 28, gap = 4, collapseAt = 5, expanded = null, fixed = [] } = {}) {
  const PIN = 12, BADGE = 21;   // half-sizes: a 22 px pin with its ring, a "N +k" badge
  const order = new Map(points.map((p, i) => [p.id, i]));
  let clusters = points.map(p => [p]);
  const centre = m => ({ x: m.reduce((s, q) => s + q.x, 0) / m.length, y: m.reduce((s, q) => s + q.y, 0) / m.length });
  const merge = (i, j) => { clusters[i] = [...clusters[i], ...clusters[j]].sort((a, b) => order.get(a.id) - order.get(b.id)); clusters.splice(j, 1); };
  // single linkage: any two pins closer than radius share a cluster
  for (let again = true; again;) {
    again = false;
    outer: for (let i = 0; i < clusters.length; i++) for (let j = i + 1; j < clusters.length; j++)
      if (clusters[i].some(a => clusters[j].some(b => Math.hypot(a.x - b.x, a.y - b.y) < radius))) { merge(i, j); again = true; break outer; }
  }
  const layout0 = m => {
    const c = centre(m), k = m.length;
    if (k === 1) return { c, items: [{ id: m[0].id, x: m[0].x, y: m[0].y, r: PIN, p: m[0] }] };
    const open = expanded && m.some(p => expanded.has(p.id));
    if (k >= collapseAt && !open) return { c, group: true, items: [{ x: c.x, y: c.y, r: BADGE }] };
    // evenly spaced round the centre, in the order the pins already sit round it, so each keeps its side;
    // neighbours at least 34 px apart: 22 px badges with a clear gap
    const r = Math.max(17, PIN + gap / 2 + 1) / Math.sin(Math.PI / k);
    const ang = m.map(p => Math.hypot(p.x - c.x, p.y - c.y) < 1 ? null : Math.atan2(p.y - c.y, p.x - c.x));
    const start = ang.find(a => a !== null) ?? -Math.PI / 2;
    const rel = a => ((a - start) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    const sorted = m.map((p, i) => ({ p, a: ang[i] ?? start + i * 1e-3 })).sort((u, v) => rel(u.a) - rel(v.a));
    return { c, items: sorted.map(({ p }, i) => { const a = start + i * 2 * Math.PI / k; return { id: p.id, x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a), r: PIN, p }; }) };
  };
  // a cluster that would touch a fixed pin slides directly away from it until clear
  const layout = m => {
    const l = layout0(m);
    if (!fixed.length) return l;
    let dx = 0, dy = 0;
    for (let n = 0; n < 80; n++) {
      const f = fixed.find(q => l.items.some(it => Math.hypot(it.x + dx - q.x, it.y + dy - q.y) < it.r + 11 + gap));
      if (!f) break;
      const vx = l.c.x + dx - f.x, vy = l.c.y + dy - f.y, d = Math.hypot(vx, vy);
      if (d < 0.5) dy -= 3; else { dx += vx / d * 3; dy += vy / d * 3; }
    }
    if (!dx && !dy) return l;
    return { ...l, c: { x: l.c.x + dx, y: l.c.y + dy }, items: l.items.map(it => ({ ...it, x: it.x + dx, y: it.y + dy })) };
  };
  let laid;
  for (let again = true; again;) {
    again = false; laid = clusters.map(layout);
    outer: for (let i = 0; i < laid.length; i++) for (let j = i + 1; j < laid.length; j++)
      if (laid[i].items.some(a => laid[j].items.some(b => Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r + gap))) { merge(i, j); again = true; break outer; }
  }
  const placements = new Map(), hidden = new Set(), groups = [];
  laid.forEach((l, i) => {
    if (l.group) { clusters[i].forEach(p => hidden.add(p.id)); groups.push({ key: clusters[i].map(p => p.id).join('|'), ids: clusters[i].map(p => p.id), x: l.c.x, y: l.c.y }); return; }
    for (const it of l.items) placements.set(it.id, { x: it.x, y: it.y, ax: it.p.x, ay: it.p.y });
  });
  return { placements, hidden, groups };
}
