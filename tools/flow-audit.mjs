// Flow-path audit: samples every animated power and data flow densely and tests each sample against the level's
// solid geometry. A flow is an explanatory overlay drawn on top of the hardware, so its centreline should run where the
// thing it stands for runs: on a board between the packages, inside a busbar or cable it represents, through the air
// between racks. It should not pass through another package, a heat sink, a connector body or a wall on the way.
//
// auditFlows(built, THREE, opts) runs anywhere a built level exists (the browser gate tools/flows.mjs injects it with
// Function.toString, and a vitest can import it); it imports nothing. Inside-ness is a ray-parity test against each
// candidate mesh's own triangles (three axis rays, majority vote, so a mesh that is not perfectly closed rarely fools
// it), bucketed per geometry and axis so a query reads a handful of triangles. Instanced meshes are tested per copy.
//
// What is skipped as not solid: flow overlays themselves, sprites, points, lines, printed labels, runtime overlays,
// hidden objects, and materials that are transparent without depth writes (glass panes, glows, the IHS ghost covers).
// What is allowed:
//   - the run at either end of a path that starts inside its source or ends inside its sink (contiguous with the end),
//     up to opts.endRun of the path length;
//   - runs inside a mesh whose mesh/material name matches a conduit pattern (a busbar, cable, copper bar or pipe the
//     flow represents), reported as `conduit`, not as a defect;
//   - anything a flow declares itself (kit.js flow(..., { audit })), with the reason written next to the flow in the
//     scene source: audit.through = /regex on the mesh or material name/ (or true: the whole route), and/or
//     audit.within = [[x0, y0, z0, x1, y1, z1], ...], world boxes (a busbar, a connector pair, a cable run) inside which
//     the route may share space with any solid, because it is inside the conductor it stands for.
// What is flagged:
//   - inside: a mid-path run inside a solid that is neither source, sink nor an allowed conduit;
//   - offBoard: for levels that declare built.flowAudit.boards (rectangles in world x/z), a sample of a board flow
//     (cls in built.flowAudit.boardCls) that is not over a board, outside the end runs;
//   - floating: (audit.external exempts the run from an end that leaves the drawn hardware) a sample farther than opts.floatR (world units, or built.flowAudit.floatR) from every solid surface
//     along all six axis directions, for levels that declare a float radius.
export function auditFlows(built, THREE, opts = {}) {
  const o = { samples: 260, endRun: 0.5, boardEnd: 0, layers: ['flows', 'dataFlows'], skipCls: ['hot', 'warm', 'cool', 'air'],
    conduit: /copper|busbar|bus bar|bus-bar|busway|cable|wire|jumper|twinax|fiber|fibre|hose|pipe|conductor|lead frame|trace|waveguide|optical paths|carrier paths|busway|bus duct|tapoff|tap-off|bus_joint|patch termination|guide ring/i, ...(built.flowAudit || {}), ...opts };
  const V = THREE.Vector3, M4 = THREE.Matrix4;
  const scene = built.scene; scene.updateMatrixWorld(true);
  const flowNodes = new Set();
  for (const key of ['flows', 'dataFlows', 'heatFlows']) for (const f of built[key] || []) f.group?.traverse(n => flowNodes.add(n));
  const shown = n => { for (let q = n; q; q = q.parent) { if (!q.visible) return false; if (q.userData?.runtimeOverlay) return false; } return true; };
  const matsOf = m => (Array.isArray(m.material) ? m.material : [m.material]).filter(Boolean);
  const solidMat = mt => !mt.isShaderMaterial && !mt.isPointsMaterial && !mt.isLineBasicMaterial && !mt.isSpriteMaterial
    && !(mt.transparent && (mt.depthWrite === false || mt.opacity < 0.6)) && mt.visible !== false && !(mt.isMeshBasicMaterial && mt.transparent);
  const nameOf = m => {
    const mats = matsOf(m).map(mt => `${mt.name || ''}${mt.color ? '#' + mt.color.getHexString() : ''}`);
    let n = m.name; for (let q = m.parent; !n && q; q = q.parent) n = q.name;
    return `${n || 'mesh'} [${[...new Set(mats)].join(', ')}]`;
  };
  // ---- solid meshes, per copy, with world boxes in a spatial hash ----
  const items = [];
  scene.traverse(m => {
    if (!m.isMesh || m.isSprite || m.isPoints || m.isLine || flowNodes.has(m) || !shown(m)) return;
    if (m.userData?.printed || m.userData?.flowAuditIgnore) return;
    const g = m.geometry; if (!g?.attributes?.position) return;
    if (!matsOf(m).some(solidMat)) return;
    if (!g.boundingBox) g.computeBoundingBox();
    const n = m.isInstancedMesh ? m.count : 1;
    for (let c = 0; c < n; c++) {
      const world = new M4();
      if (m.isInstancedMesh) { m.getMatrixAt(c, world); world.premultiply(m.matrixWorld); } else world.copy(m.matrixWorld);
      if (Math.abs(world.determinant()) < 1e-18) continue;
      const box = g.boundingBox.clone().applyMatrix4(world);
      items.push({ mesh: m, copy: c, world, inv: world.clone().invert(), box, name: null });
    }
  });
  const all = new THREE.Box3(); for (const it of items) all.union(it.box);
  const size = all.getSize(new V()), H = Math.max(size.x, size.y, size.z) / 96 || 1;
  const hash = new Map(), key = (i, j, k) => `${i},${j},${k}`;
  items.forEach((it, idx) => {
    const a = it.box.min, b = it.box.max;
    const i0 = Math.floor(a.x / H), i1 = Math.floor(b.x / H), j0 = Math.floor(a.y / H), j1 = Math.floor(b.y / H), k0 = Math.floor(a.z / H), k1 = Math.floor(b.z / H);
    if ((i1 - i0 + 1) * (j1 - j0 + 1) * (k1 - k0 + 1) > 20000) { (hash.get('big') || hash.set('big', []).get('big')).push(idx); return; }
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) for (let k = k0; k <= k1; k++) { const s = key(i, j, k); (hash.get(s) || hash.set(s, []).get(s)).push(idx); }
  });
  const candidates = p => {
    const s = hash.get(key(Math.floor(p.x / H), Math.floor(p.y / H), Math.floor(p.z / H))) || [];
    return (hash.get('big') || []).concat(s);
  };
  // ---- per-geometry triangle buckets for axis rays ----
  const grids = new Map();
  const gridFor = (g, axis) => {
    let per = grids.get(g); if (!per) grids.set(g, per = []);
    if (per[axis]) return per[axis];
    const pos = g.attributes.position, idx = g.index, n = Math.floor((idx ? idx.count : pos.count) / 3);
    const ua = (axis + 1) % 3, va = (axis + 2) % 3, bb = g.boundingBox;
    const lo = [bb.min.x, bb.min.y, bb.min.z], hi = [bb.max.x, bb.max.y, bb.max.z];
    const G = Math.max(4, Math.min(256, Math.ceil(Math.sqrt(n / 2))));
    const du = (hi[ua] - lo[ua]) / G || 1, dv = (hi[va] - lo[va]) / G || 1;
    const T = new Float32Array(n * 9);
    for (let t = 0; t < n; t++) for (let c = 0; c < 3; c++) {
      const vi = idx ? idx.getX(t * 3 + c) : t * 3 + c;
      T[t * 9 + c * 3] = pos.getX(vi); T[t * 9 + c * 3 + 1] = pos.getY(vi); T[t * 9 + c * 3 + 2] = pos.getZ(vi);
    }
    const cells = Array.from({ length: G * G }, () => []);
    const cl = v => (v < 0 ? 0 : v >= G ? G - 1 : v);
    for (let t = 0; t < n; t++) {
      let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
      for (let c = 0; c < 3; c++) { const u = T[t * 9 + c * 3 + ua], v = T[t * 9 + c * 3 + va]; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
      for (let i = cl(Math.floor((u0 - lo[ua]) / du)); i <= cl(Math.floor((u1 - lo[ua]) / du)); i++)
        for (let j = cl(Math.floor((v0 - lo[va]) / dv)); j <= cl(Math.floor((v1 - lo[va]) / dv)); j++) cells[j * G + i].push(t);
    }
    return (per[axis] = { T, cells, G, lo, du, dv, ua, va });
  };
  // connected shells of a geometry (triangles joined through shared corner positions), so a merged mesh of many
  // boxes is tested box by box: each shell gets its own parity, and a report names the shell, not the whole merge
  const shells = new Map();
  const shellsFor = g => {
    if (shells.has(g)) return shells.get(g);
    const pos = g.attributes.position, idx = g.index, n = Math.floor((idx ? idx.count : pos.count) / 3);
    const ids = new Map(), parent = [];
    const find = a => { while (parent[a] !== a) a = parent[a] = parent[parent[a]]; return a; };
    const vid = vi => { const k = `${Math.round(pos.getX(vi) * 1e5)},${Math.round(pos.getY(vi) * 1e5)},${Math.round(pos.getZ(vi) * 1e5)}`; let id = ids.get(k); if (id === undefined) { id = parent.length; parent.push(id); ids.set(k, id); } return id; };
    const tv = new Int32Array(n * 3);
    for (let t = 0; t < n; t++) for (let c = 0; c < 3; c++) tv[t * 3 + c] = vid(idx ? idx.getX(t * 3 + c) : t * 3 + c);
    for (let t = 0; t < n; t++) { const a = find(tv[t * 3]); for (let c = 1; c < 3; c++) { const b = find(tv[t * 3 + c]); if (a !== b) parent[b] = a; } }
    const remap = new Map(), tri = new Int32Array(n), box = [];
    for (let t = 0; t < n; t++) {
      const r = find(tv[t * 3]); let c = remap.get(r); if (c === undefined) { c = remap.size; remap.set(r, c); box.push([Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]); }
      tri[t] = c;
      for (let k = 0; k < 3; k++) { const vi = idx ? idx.getX(t * 3 + k) : t * 3 + k, b = box[c], P = [pos.getX(vi), pos.getY(vi), pos.getZ(vi)]; for (let a = 0; a < 3; a++) { b[a] = Math.min(b[a], P[a]); b[a + 3] = Math.max(b[a + 3], P[a]); } }
    }
    // an open shell (a sheet, a terrain skirt, a box missing faces) has no inside: parity there means nothing
    const edges = new Map(), shellEdges = new Int32Array(remap.size), shellOpen = new Int32Array(remap.size);
    for (let t = 0; t < n; t++) for (let c = 0; c < 3; c++) {
      const a = tv[t * 3 + c], b = tv[t * 3 + (c + 1) % 3], k = a < b ? `${a},${b}` : `${b},${a}`;
      edges.set(k, (edges.get(k) || 0) + 1);
      if (!edges.has(k + 's')) edges.set(k + 's', tri[t]);
    }
    for (const [k, v] of edges) { if (k.endsWith('s')) continue; const c = edges.get(k + 's'); shellEdges[c]++; if (v === 1) shellOpen[c]++; }
    const open = Array.from(shellEdges, (e, c) => e > 0 && shellOpen[c] / e > 0.1);
    const out = { tri, box, open }; shells.set(g, out); return out;
  };
  // crossings of the ray from local point q along +axis (dir 1) or -axis (dir -1): the count and the nearest distance;
  // with `per`, crossings are also counted per shell
  const cast = (g, q, axis, dir, per) => {
    const R = gridFor(g, axis), { T, cells, G, lo, du, dv, ua, va } = R, tri = per ? shellsFor(g).tri : null;
    const pu = q[ua], pv = q[va], pa = q[axis];
    const i = Math.floor((pu - lo[ua]) / du), j = Math.floor((pv - lo[va]) / dv);
    if (i < 0 || j < 0 || i >= G || j >= G) return { n: 0, d: Infinity };
    let n = 0, d = Infinity;
    for (const t of cells[j * G + i]) {
      const b = t * 9;
      const x0 = T[b + ua], y0 = T[b + va], x1 = T[b + 3 + ua], y1 = T[b + 3 + va], x2 = T[b + 6 + ua], y2 = T[b + 6 + va];
      const den = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2); if (Math.abs(den) < 1e-20) continue;
      const w0 = ((y1 - y2) * (pu - x2) + (x2 - x1) * (pv - y2)) / den, w1 = ((y2 - y0) * (pu - x2) + (x0 - x2) * (pv - y2)) / den, w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const a = w0 * T[b + axis] + w1 * T[b + 3 + axis] + w2 * T[b + 6 + axis], s = (a - pa) * dir;
      if (s > 0) { n++; if (s < d) d = s; if (per) per.set(tri[t], (per.get(tri[t]) || 0) + 1); }
    }
    return { n, d };
  };
  const q = [0, 0, 0], lp = new V();
  const toLocal = (it, p) => { lp.copy(p).applyMatrix4(it.inv); q[0] = lp.x + 1.3e-7; q[1] = lp.y + 1.7e-7; q[2] = lp.z + 1.1e-7; return q; };
  // the shells of one mesh copy that contain p: odd crossings on at least two of three axis rays
  const inside = (it, p) => {
    if (!it.box.containsPoint(p)) return [];
    const g = it.mesh.geometry, l = toLocal(it, p), { box, open } = shellsFor(g), votes = new Map();
    for (let a = 0; a < 3; a++) {
      const per = new Map(); cast(g, l, a, 1, per);
      for (const [c, n] of per) if (n % 2 && !open[c]) { const b = box[c]; if (l[0] >= b[0] && l[0] <= b[3] && l[1] >= b[1] && l[1] <= b[4] && l[2] >= b[2] && l[2] <= b[5]) votes.set(c, (votes.get(c) || 0) + 1); }
    }
    return [...votes].filter(([, v]) => v >= 2).map(([c]) => c);
  };
  const insideAt = p => { const out = []; for (const idx of candidates(p)) for (const c of inside(items[idx], p)) out.push(`${idx}:${c}`); return out; };
  // distance to the nearest surface along the six axis directions (an upper bound on the true distance)
  const _w = new V(), _d = new V();
  const clearance = (p, limit) => {
    let best = Infinity;
    const r = Math.ceil(limit / H);
    const seen = new Set();
    const ci = Math.floor(p.x / H), cj = Math.floor(p.y / H), ck = Math.floor(p.z / H);
    const near = [...(hash.get('big') || [])];
    for (let i = ci - r; i <= ci + r; i++) for (let j = cj - r; j <= cj + r; j++) for (let k = ck - r; k <= ck + r; k++) for (const x of hash.get(key(i, j, k)) || []) near.push(x);
    for (const idx of near) {
      if (seen.has(idx)) continue; seen.add(idx);
      const it = items[idx];
      if (it.box.distanceToPoint(p) > Math.min(best, limit)) continue;
      const l = toLocal(it, p), g = it.mesh.geometry;
      for (let a = 0; a < 3; a++) for (const dir of [1, -1]) {
        const { d } = cast(g, l, a, dir); if (d === Infinity) continue;
        // local distance along the axis, to world: scale by the world length of that local axis step
        _d.set(0, 0, 0).setComponent(a, d * dir).add(lp); _w.copy(_d).applyMatrix4(it.world);
        best = Math.min(best, _w.distanceTo(p));
      }
    }
    return best;
  };
  const label = key => {
    const [idx, c] = key.split(':').map(Number), it = items[idx], b = shellsFor(it.mesh.geometry).box[c];
    const lo = new V(b[0], b[1], b[2]).applyMatrix4(it.world), hi = new V(b[3], b[4], b[5]).applyMatrix4(it.world);
    const ctr = lo.clone().add(hi).multiplyScalar(0.5).toArray().map(v => +v.toFixed(3)), sz = hi.clone().sub(lo).toArray().map(v => +Math.abs(v).toFixed(3));
    return `${it.name || (it.name = nameOf(it.mesh) + (it.mesh.isInstancedMesh ? ` #${it.copy}` : ''))} shell@${ctr.join(',')} size ${sz.join('x')}`;
  };
  const boards = o.boards || null, boardCls = new Set(o.boardCls || []);
  const onBoard = p => boards.some(b => p.x >= b[0] && p.x <= b[1] && p.z >= b[2] && p.z <= b[3]);
  // ---- walk every flow ----
  const report = [];
  let flowCount = 0, sampleCount = 0;
  for (const layer of o.layers) for (const [fi, f] of (built[layer] || []).entries()) {
    if (o.skipCls.includes(f.cls) || !f.path?.curves?.length || !(f.len > 0)) continue;
    let hidden = false; for (let q = f.group; q; q = q.parent) if (!q.visible) hidden = true;
    if (hidden) continue;                                   // a variant's route not drawn now (e.g. the LPO lanes while a DSP module shows)
    flowCount++;
    f.group.updateMatrixWorld(true);
    const mw = f.group.matrixWorld, through = f.audit?.through;
    const len = f.path.getLength(), n = Math.max(24, Math.ceil(o.samples * Math.min(1, Math.max(0.25, len / (H * 24))))), pts = [];
    // sample along each straight segment (Flow paths are polylines), keeping every corner
    let along = 0;
    for (const c of f.path.curves) {
      const a = c.getPoint(0), b = c.getPoint(1), L = a.distanceTo(b), k = Math.max(1, Math.ceil(n * L / len));
      for (let s = 0; s < k; s++) { const t = s / k; pts.push({ p: a.clone().lerp(b, t).applyMatrix4(mw), u: (along + L * t) / len }); }
      along += L;
    }
    const last = f.path.curves.at(-1).getPoint(1).applyMatrix4(mw); pts.push({ p: last, u: 1 });
    sampleCount += pts.length;
    const hits = pts.map(s => insideAt(s.p));
    const issues = [];
    // the leading and trailing runs that start inside something are the source and sink
    let head = 0; while (head < pts.length && hits[head].length && pts[head].u <= o.endRun) head++;
    let tail = pts.length - 1; while (tail >= 0 && hits[tail].length && 1 - pts[tail].u <= o.endRun) tail--;
    // group mid-path inside samples into runs per item
    const open = new Map();
    // a lone sample just under a shell's skin is a touch (a conductor on its insulator's clamp), not a crossing
    const touch = (key, s) => {
      const [i, c] = key.split(':').map(Number), it = items[i], b = shellsFor(it.mesh.geometry).box[c], l = toLocal(it, pts[s].p);
      const dims = [b[3] - b[0], b[4] - b[1], b[5] - b[2]], depth = Math.min(...[0, 1, 2].map(a => Math.min(l[a] - b[a], b[a + 3] - l[a])));
      return depth < 0.05 * Math.min(...dims);
    };
    const close = (idx, run) => {
      if (run.from === run.to && touch(idx, run.from)) return;
      const nm = label(idx), conduit = o.conduit.test(nm), declared = through === true || (!!through?.test && through.test(nm));
      const lenRun = (pts[run.to].u - pts[run.from].u) * len;
      issues.push({ kind: declared ? 'declared' : conduit ? 'conduit' : 'inside', part: nm, at: pts[run.from].p.toArray().map(v => +v.toFixed(3)), to: pts[run.to].p.toArray().map(v => +v.toFixed(3)), len: +lenRun.toFixed(4), samples: run.to - run.from + 1 });
    };
    const within = f.audit?.within || [];
    const inWithin = p => within.some(b => p.x >= b[0] && p.x <= b[3] && p.y >= b[1] && p.y <= b[4] && p.z >= b[2] && p.z <= b[5]);
    let exempt = 0;
    for (let s = head; s <= tail; s++) {
      const box = hits[s].length && inWithin(pts[s].p); if (box) exempt++;
      const now = new Set(box ? [] : hits[s]);
      for (const idx of now) { const r = open.get(idx); if (r) r.to = s; else open.set(idx, { from: s, to: s }); }
      for (const [idx, r] of [...open]) if (!now.has(idx)) { close(idx, r); open.delete(idx); }
    }
    for (const [idx, r] of open) close(idx, r);
    if (exempt) issues.push({ kind: 'declared', part: 'within a declared conductor box', at: pts[0].p.toArray().map(v => +v.toFixed(3)), samples: exempt });
    if (boards && boardCls.has(f.cls)) {
      let run = null;
      for (let s = 0; s < pts.length; s++) {
        const off = pts[s].u > o.boardEnd && pts[s].u < 1 - o.boardEnd && !onBoard(pts[s].p);
        if (off) { if (run) run.to = s; else run = { from: s, to: s }; }
        if ((!off || s === pts.length - 1) && run) { issues.push({ kind: 'offBoard', at: pts[run.from].p.toArray().map(v => +v.toFixed(3)), to: pts[run.to].p.toArray().map(v => +v.toFixed(3)), samples: run.to - run.from + 1 }); run = null; }
      }
    }
    if (o.floatR) {
      // audit.external: 'start' | 'end' | 'both': that end comes from (or goes to) something outside the drawn hardware
      // (a power cord to the PDU, a fiber to the network), so the run from it to the first nearby part may be in the air
      const ext = f.audit?.external || '', near = pts.map((x, s) => (s % 4 && s !== pts.length - 1 ? null : clearance(x.p, o.floatR * 2)));
      let from = 0, to = pts.length - 1;
      if (/start|both/.test(ext)) while (from < to && !(near[from] !== null && near[from] <= o.floatR)) from++;
      if (/end|both/.test(ext)) while (to > from && !(near[to] !== null && near[to] <= o.floatR)) to--;
      let worst = 0, at = null;
      for (let s = from; s <= to; s++) { const c = near[s]; if (c !== null && c > o.floatR && c > worst) { worst = c; at = pts[s].p.toArray().map(v => +v.toFixed(3)); } }
      if (at) issues.push({ kind: 'floating', at, clearance: worst === Infinity ? 'none' : +worst.toFixed(3) });
    }
    if (issues.length) report.push({ layer, index: fi, cls: f.cls, from: pts[0].p.toArray().map(v => +v.toFixed(3)), to: last.toArray().map(v => +v.toFixed(3)), why: f.audit?.why, issues });
  }
  const count = kind => report.reduce((n, r) => n + r.issues.filter(i => i.kind === kind).length, 0);
  return { flows: flowCount, samples: sampleCount, solids: items.length, defects: count('inside') + count('offBoard') + count('floating'),
    inside: count('inside'), offBoard: count('offBoard'), floating: count('floating'), conduit: count('conduit'), declared: count('declared'), report };
}
