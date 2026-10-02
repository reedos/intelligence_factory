// Chip-face block diagrams as data: boxes with named ports, polyline paths and labels. One description both draws
// the canvas face and feeds a geometric checker (face-diagram.test.ts), so a waveguide or trace can never again run
// under a component outline, cross another path unmarked, or sit on a label without a test failing.
//
// Diagram: { w, h, bg, boxes, paths, texts, crossings }
//   box:  { id, x, y, w, h, fill?, stroke?, label?, size?, color?, glyph?, ports: { name: [x, y] } }
//         every port lies on the box's outline; a path may touch a box only at one of its ports
//   path: { id, pts: [[x, y], ...], color, width }
//         each end is a box port ('box.port' in from/to), a canvas edge, or a junction with another path's vertex
//   text: { text, x, y, size, color }   free label, centered on (x, y); must clear every path, box and label
//   crossings: [[pathA, pathB]]          the only pairs allowed to cross; each crossing gets a drawn marker

const FONT = 'system-ui, sans-serif';
// Width of a label in canvas pixels. In a browser the real advance is measured; the checker (no DOM) uses a
// deliberately generous per-character estimate for the 600-weight UI face, so a label that passes here fits.
export const textWidth = (text, size) => [...text].reduce((s, c) => s + (c === '°' ? .42 : /[A-Z0-9]/.test(c) ? .7 : .58), 0) * size;
export function labelRect(text, cx, cy, size) {
  const w = textWidth(text, size), h = size * .82;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}
export const portOf = (d, ref) => {
  const [id, port] = ref.split('.');
  const box = d.boxes.find(b => b.id === id);
  return box?.ports?.[port];
};

// ---------- drawing ----------
export function drawDiagram(g, d) {
  g.fillStyle = d.bg; g.fillRect(0, 0, d.w, d.h);
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const p of d.paths) {
    g.strokeStyle = p.color; g.lineWidth = p.width;
    g.beginPath(); p.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
  }
  for (const [x, y] of crossingPoints(d)) {          // a waveguide crossing or crossover: a small ringed node
    g.fillStyle = d.bg; g.beginPath(); g.arc(x, y, 5.5, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 1.5; g.stroke();
  }
  for (const b of d.boxes) {
    if (b.fill) { g.fillStyle = b.fill; g.fillRect(b.x, b.y, b.w, b.h); }
    if (b.stroke) { g.strokeStyle = b.stroke; g.lineWidth = 2; g.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2); }
    for (const q of b.glyph || []) { g.fillStyle = q.fill; g.fillRect(q.x, q.y, q.w, q.h); }
  }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const text = (t, x, y, size, color) => { g.fillStyle = color; g.font = `600 ${size}px ${FONT}`; g.fillText(t, x, y + size * .04); };
  for (const b of d.boxes) if (b.label) text(b.label, ...labelCenter(b), b.size, b.color || 'rgba(255,255,255,0.88)');
  for (const t of d.texts || []) text(t.text, t.x, t.y, t.size, t.color);
}
export const labelCenter = b => b.labelAt || [b.x + b.w / 2, b.y + b.h / 2];

// ---------- geometry ----------
const EPS = 1e-6;
const cross = (ax, ay, bx, by) => ax * by - ay * bx;
const same = (a, b) => Math.abs(a[0] - b[0]) < .01 && Math.abs(a[1] - b[1]) < .01;
// Proper intersection point of segments ab and cd, or null (touching at an end counts as not crossing).
export function segmentCross(a, b, c, d) {
  const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]], den = cross(...r, ...s);
  if (Math.abs(den) < EPS) return null;
  const t = cross(c[0] - a[0], c[1] - a[1], ...s) / den, u = cross(c[0] - a[0], c[1] - a[1], ...r) / den;
  return t > .001 && t < .999 && u > .001 && u < .999 ? [a[0] + t * r[0], a[1] + t * r[1]] : null;
}
// Collinear overlap of positive length between two segments.
function overlapLength(a, b, c, d) {
  const r = [b[0] - a[0], b[1] - a[1]], L = Math.hypot(...r);
  if (L < EPS || Math.abs(cross(...r, c[0] - a[0], c[1] - a[1])) / L > .5 || Math.abs(cross(...r, d[0] - a[0], d[1] - a[1])) / L > .5) return 0;
  const proj = p => ((p[0] - a[0]) * r[0] + (p[1] - a[1]) * r[1]) / L;
  const lo = Math.max(0, Math.min(proj(c), proj(d))), hi = Math.min(L, Math.max(proj(c), proj(d)));
  return hi - lo;
}
// Does segment ab enter the open rectangle r (shrunk by m)? Liang-Barsky clip.
export function segmentHitsRect(a, b, r, m = 0) {
  const x0 = r.x + m, x1 = r.x + r.w - m, y0 = r.y + m, y1 = r.y + r.h - m;
  if (x1 <= x0 || y1 <= y0) return false;
  let t0 = 0, t1 = 1; const dx = b[0] - a[0], dy = b[1] - a[1];
  for (const [p, q] of [[-dx, a[0] - x0], [dx, x1 - a[0]], [-dy, a[1] - y0], [dy, y1 - a[1]]]) {
    if (Math.abs(p) < EPS) { if (q <= 0) return false; continue; }
    const t = q / p;
    if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
  }
  return t1 - t0 > 1e-4;
}
const segs = p => p.pts.slice(1).map((q, i) => [p.pts[i], q]);
const rectsOverlap = (a, b, m = 0) => a.x < b.x + b.w + m && b.x < a.x + a.w + m && a.y < b.y + b.h + m && b.y < a.y + a.h + m;
const inside = (a, b, m = 0) => a.x >= b.x + m && a.y >= b.y + m && a.x + a.w <= b.x + b.w - m && a.y + a.h <= b.y + b.h - m;
const onOutline = ([x, y], b) => (Math.abs(x - b.x) < .01 || Math.abs(x - b.x - b.w) < .01) && y >= b.y - .01 && y <= b.y + b.h + .01
  || (Math.abs(y - b.y) < .01 || Math.abs(y - b.y - b.h) < .01) && x >= b.x - .01 && x <= b.x + b.w + .01;

export function crossingPoints(d) {
  const out = [];
  for (const [ia, ib] of d.crossings || []) {
    const A = d.paths.find(p => p.id === ia), B = d.paths.find(p => p.id === ib);
    for (const [a, b] of segs(A)) for (const [c, e] of segs(B)) { const x = segmentCross(a, b, c, e); if (x) out.push(x); }
  }
  return out;
}

// Every rule the drawing must keep. Returns readable violations; [] means clean.
export function checkDiagram(d, { gap = 3 } = {}) {
  const bad = [], allowed = new Set((d.crossings || []).map(([a, b]) => [a, b].sort().join('|')));
  const labels = [];
  for (const b of d.boxes) {
    for (const [name, pt] of Object.entries(b.ports || {})) if (!onOutline(pt, b)) bad.push(`port ${b.id}.${name} is not on its outline`);
    if (b.label) {
      const r = labelRect(b.label, ...labelCenter(b), b.size);
      if (!inside(r, b, 1)) bad.push(`label "${b.label}" does not fit inside box ${b.id}`);
      labels.push({ name: `"${b.label}" (${b.id})`, r, own: b.id });
    }
  }
  for (const t of d.texts || []) {
    const r = labelRect(t.text, t.x, t.y, t.size);
    labels.push({ name: `"${t.text}"`, r });
    if (r.x < 0 || r.y < 0 || r.x + r.w > d.w || r.y + r.h > d.h) bad.push(`label "${t.text}" runs off the face`);
    for (const b of d.boxes) if (rectsOverlap(r, b, 1)) bad.push(`label "${t.text}" touches box ${b.id}`);
  }
  for (let i = 0; i < d.boxes.length; i++) for (let j = i + 1; j < d.boxes.length; j++)
    if (rectsOverlap(d.boxes[i], d.boxes[j], -.01)) bad.push(`boxes ${d.boxes[i].id} and ${d.boxes[j].id} overlap`);
  for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++)
    if (rectsOverlap(labels[i].r, labels[j].r, 2)) bad.push(`labels ${labels[i].name} and ${labels[j].name} collide`);
  const vertices = new Map(d.paths.map(p => [p.id, p.pts]));
  for (const p of d.paths) {
    // ends: a declared port, the canvas edge, or a junction on another path's vertex
    for (const [end, ref] of [[p.pts[0], p.from], [p.pts.at(-1), p.to]]) {
      if (ref) { const q = portOf(d, ref); if (!q) bad.push(`${p.id}: unknown port ${ref}`); else if (!same(q, end)) bad.push(`${p.id}: end ${end} is not at port ${ref} ${q}`); continue; }
      const edge = end[0] <= .01 || end[1] <= .01 || end[0] >= d.w - .01 || end[1] >= d.h - .01;
      const junction = [...vertices].some(([id, pts]) => id !== p.id && pts.some(v => same(v, end)));
      if (!edge && !junction) bad.push(`${p.id}: loose end at ${end}`);
    }
    for (const [a, b] of segs(p)) {
      for (const box of d.boxes) if (segmentHitsRect(a, b, box, .5)) bad.push(`${p.id}: segment ${a}→${b} runs through box ${box.id}`);
      for (const l of labels) if (segmentHitsRect(a, b, { x: l.r.x - p.width / 2 - 1, y: l.r.y - p.width / 2 - 1, w: l.r.w + p.width + 2, h: l.r.h + p.width + 2 }))
        bad.push(`${p.id}: segment ${a}→${b} runs over label ${l.name}`);
    }
  }
  for (let i = 0; i < d.paths.length; i++) for (let j = i; j < d.paths.length; j++) {
    const A = d.paths[i], B = d.paths[j], sa = segs(A), sb = segs(B);
    for (let m = 0; m < sa.length; m++) for (let n = (i === j ? m + 1 : 0); n < sb.length; n++) {
      const [a, b] = sa[m], [c, e] = sb[n], x = segmentCross(a, b, c, e);
      if (x && !(i !== j && allowed.has([A.id, B.id].sort().join('|')))) bad.push(`${A.id} crosses ${B.id} at ${x.map(v => v.toFixed(1))} without a marked crossing`);
      if (overlapLength(a, b, c, e) > .5) bad.push(`${A.id} and ${B.id} run on top of each other`);
      // even spacing: two paths that neither cross nor meet keep a visible gap between their strokes
      if (!x && i !== j && ![a, b].some(u => [c, e].some(v => same(u, v)))) {
        const dist = segDist(a, b, c, e);
        if (dist < (A.width + B.width) / 2 + gap) bad.push(`${A.id} and ${B.id} come within ${dist.toFixed(1)} px`);
      }
    }
  }
  // every declared crossing exists, and its marker clears every box and label
  for (const [a, b] of d.crossings || []) {
    const A = d.paths.find(p => p.id === a), B = d.paths.find(p => p.id === b);
    if (!A || !B) { bad.push(`crossing ${a}/${b} names an unknown path`); continue; }
    const pts = crossingPoints({ paths: [A, B], crossings: [[a, b]] });
    if (!pts.length) bad.push(`crossing ${a}/${b} is declared but the paths never cross`);
    for (const [x, y] of pts) {
      const m = { x: x - 6, y: y - 6, w: 12, h: 12 };
      for (const box of d.boxes) if (rectsOverlap(m, box)) bad.push(`crossing marker at ${x},${y} touches box ${box.id}`);
      for (const l of labels) if (rectsOverlap(m, l.r)) bad.push(`crossing marker at ${x},${y} touches label ${l.name}`);
    }
  }
  return [...new Set(bad)];
}
function pointSeg(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
  const t = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
function segDist(a, b, c, d) {
  if (segmentCross(a, b, c, d)) return 0;
  return Math.min(pointSeg(a, c, d), pointSeg(b, c, d), pointSeg(c, a, b), pointSeg(d, a, b));
}

// ---------- auditing faces drawn freehand ----------
// A stand-in 2D context that records what a texture function draws: stroked polylines, filled or stroked
// rectangles, arcs (as their bounding boxes) and text. auditDrawing() then applies the same rules loosely to a
// face that is not described as data: no stroke runs through a component it does not end on, no text sits on a
// stroke, and every crossing between two differently colored strokes is reported.
export function recordContext(w, h) {
  const rec = { w, h, paths: [], rects: [], texts: [] };
  let sub = [], subs = [], seq = 0;
  const state = { lineWidth: 1, strokeStyle: '#000', fillStyle: '#000', font: '10px sans-serif', textAlign: 'start', textBaseline: 'alphabetic' };
  const size = () => +(/(\d+(?:\.\d+)?)px/.exec(state.font)?.[1] || 10);
  const ctx = {
    canvas: { width: w, height: h },
    beginPath() { sub = []; subs = [sub]; },
    moveTo(x, y) { sub = [[x, y]]; subs.push(sub); },
    lineTo(x, y) { if (!sub.length) subs.push(sub); sub.push([x, y]); },
    rect(x, y, rw, rh) { subs.push([[x, y], [x + rw, y], [x + rw, y + rh], [x, y + rh], [x, y]]); },
    arc(x, y, r) { rec.rects.push({ x: x - r, y: y - r, w: 2 * r, h: 2 * r, kind: 'arc', color: state.strokeStyle, seq: seq++ }); },
    roundRect(x, y, rw, rh) { ctx.rect(x, y, rw, rh); },
    closePath() { if (sub.length) sub.push(sub[0]); },
    stroke() { for (const s of subs) if (s.length > 1) rec.paths.push({ pts: s.map(p => [...p]), color: String(state.strokeStyle), width: state.lineWidth, seq: seq++ }); },
    fill() {},
    fillRect(x, y, rw, rh) { rec.rects.push({ x, y, w: rw, h: rh, kind: 'fill', color: String(state.fillStyle), seq: seq++ }); },
    strokeRect(x, y, rw, rh) { rec.rects.push({ x, y, w: rw, h: rh, kind: 'stroke', color: String(state.strokeStyle), seq: seq++ }); },
    clearRect() {},
    fillText(text, x, y) {
      const s = size(), tw = textWidth(String(text), s);
      const x0 = state.textAlign === 'center' ? x - tw / 2 : state.textAlign === 'right' || state.textAlign === 'end' ? x - tw : x;
      const y0 = state.textBaseline === 'middle' ? y - s * .41 : state.textBaseline === 'top' ? y : y - s * .78;
      rec.texts.push({ text: String(text), r: { x: x0, y: y0, w: tw, h: s * .82 }, seq: seq++ });
    },
    measureText: text => ({ width: textWidth(String(text), size()) }),
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    createImageData: (iw, ih) => ({ data: new Uint8ClampedArray(iw * ih * 4) }),
    putImageData() {}, getImageData: (x, y, iw, ih) => ({ data: new Uint8ClampedArray(iw * ih * 4) }),
    save() {}, restore() {}, clip() {}, translate() {}, rotate() {}, scale() {}, setTransform() {}, drawImage() {},
  };
  for (const k of Object.keys(state)) Object.defineProperty(ctx, k, { get: () => state[k], set: v => { state[k] = v; } });
  return { ctx, rec };
}
export function recordDrawing(w, h, draw) { const { ctx, rec } = recordContext(w, h); draw(ctx, w, h); return rec; }

export function auditDrawing(rec) {
  const bad = [];
  // components: rectangles that are not backgrounds, full-span bands (edges, divides, scan lines) or hairlines
  const comps = rec.rects.filter(r => !(r.w >= rec.w - 1 || r.h >= rec.h - 1) && Math.min(r.w, r.h) > 3.5);
  const touches = (p, r) => p[0] >= r.x - .6 && p[0] <= r.x + r.w + .6 && p[1] >= r.y - .6 && p[1] <= r.y + r.h + .6;
  rec.paths.forEach((p, i) => {
    for (const [a, b] of segs(p)) {
      // a filled plate painted after the stroke covers it (a label backing over a hatch), so that is not a collision
      for (const r of comps) if (segmentHitsRect(a, b, r, .8) && !touches(a, r) && !touches(b, r) && !(r.kind === 'fill' && r.seq > p.seq))
        bad.push(`stroke ${i} (${p.color}) ${a}→${b} runs through ${r.kind} rect ${[r.x, r.y, r.w, r.h]}`);
      for (const t of rec.texts) if (segmentHitsRect(a, b, { x: t.r.x - p.width / 2, y: t.r.y - p.width / 2, w: t.r.w + p.width, h: t.r.h + p.width })
        && !rec.rects.some(r => r.kind === 'fill' && r.seq > p.seq && r.seq < t.seq && inside(t.r, r)))
        bad.push(`stroke ${i} (${p.color}) runs over text "${t.text}"`);
    }
  });
  for (let i = 0; i < rec.paths.length; i++) for (let j = i + 1; j < rec.paths.length; j++) {
    const A = rec.paths[i], B = rec.paths[j];
    if (A.color === B.color) continue;
    for (const [a, b] of segs(A)) for (const [c, e] of segs(B)) {
      const x = segmentCross(a, b, c, e);
      if (x) bad.push(`stroke ${i} (${A.color}) crosses stroke ${j} (${B.color}) at ${x.map(v => v.toFixed(1))}`);
    }
  }
  for (let i = 0; i < rec.texts.length; i++) for (let j = i + 1; j < rec.texts.length; j++)
    if (rectsOverlap(rec.texts[i].r, rec.texts[j].r, 1)) bad.push(`text "${rec.texts[i].text}" collides with "${rec.texts[j].text}"`);
  return [...new Set(bad)];
}
