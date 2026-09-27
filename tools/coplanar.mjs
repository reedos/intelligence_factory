// Coplanar-face detector: finds opaque, same-facing, axis-aligned faces that overlap on (nearly) the same plane.
// Those z-fight on some GPUs no matter how good the depth range is.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1000, height: 700 } });
p.on('pageerror', e => console.log('pageerror', e.message));
await p.goto(process.env.URL || 'http://127.0.0.1:47400/');
await p.waitForFunction(() => window.ifx && window.ifx.state.scene === 0, null, { timeout: 90000 });
const names = ['across', 'campus', 'hall', 'rack', 'tray', 'chip'];
for (let sc = 0; sc < 6; sc++) {
  await p.evaluate(i => window.ifx.go(i), sc); await p.waitForFunction(i => window.ifx.state.scene === i, sc);
  const res = await p.evaluate(() => {
    const w = window.ifx, B = w.built[w.state.scene], cam = B.camera;
    const d = Math.hypot(cam.pos[0] - cam.target[0], cam.pos[1] - cam.target[1], cam.pos[2] - cam.target[2]);
    const tol = 2.5e-5 * d;                               // below this separation, 24-bit depth cannot separate faces at the default view
    const faces = [];                                     // {axis, sign, c, u0,u1,v0,v1 tris, tag}
    const M = w.camera.matrixWorld.constructor, V = w.camera.position.constructor;
    const m = new M(), va = new V(), vb = new V(), vc = new V(), e1 = new V(), e2 = new V(), n = new V();
    let meshId = 0;
    B.scene.updateMatrixWorld(true);
    B.scene.traverse(o => {
      if (!o.isMesh || !o.visible) return;
      let vis = true; for (let q = o; q; q = q.parent) if (!q.visible) vis = false; if (!vis) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      if (mats.every(mt => mt.transparent && !mt.depthWrite) || mats.every(mt => mt.isMeshBasicMaterial && mt.transparent)) return;
      const g = o.geometry, pos = g.attributes.position, idx = g.index;
      const count = o.isInstancedMesh ? o.count : 1;
      const groups = g.groups.length ? g.groups : [{ start: 0, count: idx ? idx.count : pos.count, materialIndex: 0 }];
      for (let k = 0; k < count; k++) {
        const tag = meshId++;
        if (o.isInstancedMesh) { o.getMatrixAt(k, m); m.premultiply(o.matrixWorld); } else m.copy(o.matrixWorld);
        for (const gr of groups) {
          const mt = mats[gr.materialIndex] || mats[0];
          if (mt.transparent && !mt.depthWrite) continue;
          const col = mt.color ? '#' + mt.color.getHexString() : '?';
          for (let t = gr.start; t < gr.start + gr.count; t += 3) {
            const i0 = idx ? idx.getX(t) : t, i1 = idx ? idx.getX(t + 1) : t + 1, i2 = idx ? idx.getX(t + 2) : t + 2;
            va.fromBufferAttribute(pos, i0).applyMatrix4(m); vb.fromBufferAttribute(pos, i1).applyMatrix4(m); vc.fromBufferAttribute(pos, i2).applyMatrix4(m);
            n.crossVectors(e1.subVectors(vb, va), e2.subVectors(vc, va)); const L = n.length(); if (L < 1e-12) continue; n.divideScalar(L);
            let axis = -1; if (Math.abs(n.y) > 0.9999) axis = 1; else if (Math.abs(n.x) > 0.9999) axis = 0; else if (Math.abs(n.z) > 0.9999) axis = 2; if (axis < 0) continue;
            if (axis === 1 && n.y < 0) continue;
            const sign = Math.sign(n.getComponent(axis)), [a1, a2] = axis === 1 ? [0, 2] : axis === 0 ? [1, 2] : [0, 1];
            faces.push({ axis, sign, c: va.getComponent(axis), tri: [[va.getComponent(a1), va.getComponent(a2)], [vb.getComponent(a1), vb.getComponent(a2)], [vc.getComponent(a1), vc.getComponent(a2)]], tag, col, dbl: mt.side === 2 });
          }
        }
      }
    });
    // cluster by (axis, sign) then by plane coordinate within tol
    const byKey = new Map();
    for (const f of faces) { const k = f.axis * 2 + (f.sign > 0 ? 1 : 0); if (!byKey.has(k)) byKey.set(k, []); byKey.get(k).push(f); }
    const hits = [];
    const inTri = (px, py, t) => { const [[x0, y0], [x1, y1], [x2, y2]] = t; const d1 = (px - x1) * (y0 - y1) - (x0 - x1) * (py - y1), d2 = (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2), d3 = (px - x0) * (y2 - y0) - (x2 - x0) * (py - y0); return !(((d1 < 0) || (d2 < 0) || (d3 < 0)) && ((d1 > 0) || (d2 > 0) || (d3 > 0))); };
    for (const [k, list] of byKey) {
      list.sort((a, c) => a.c - c.c);
      let s = 0;
      while (s < list.length) {
        let e = s + 1; while (e < list.length && list[e].c - list[e - 1].c < tol) e++;
        const cl = list.slice(s, e); s = e;
        if (new Set(cl.map(f => f.tag)).size < 2) continue;
        // rasterize each triangle onto a jittered grid, per tag; count cells covered by 2+ tags
        let mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity;
        for (const f of cl) for (const [x, y] of f.tri) { mnx = Math.min(mnx, x); mxx = Math.max(mxx, x); mny = Math.min(mny, y); mxy = Math.max(mxy, y); }
        const cell = Math.max((mxx - mnx) / 700, (mxy - mny) / 700, tol * 4, 1e-6);
        const cells = new Map();
        for (const f of cl) {
          let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity; for (const [x, y] of f.tri) { a0 = Math.min(a0, x); a1 = Math.max(a1, x); b0 = Math.min(b0, y); b1 = Math.max(b1, y); }
          for (let i = Math.floor((a0 - mnx) / cell); i <= Math.floor((a1 - mnx) / cell); i++) for (let j = Math.floor((b0 - mny) / cell); j <= Math.floor((b1 - mny) / cell); j++) {
            const px = mnx + (i + 0.3719) * cell, py = mny + (j + 0.6143) * cell;
            if (!inTri(px, py, f.tri)) continue;
            const key = i * 100003 + j; let set = cells.get(key); if (!set) cells.set(key, set = new Map()); set.set(f.tag, f);
          }
        }
        const pairs = new Map();
        for (const [key, set] of cells) if (set.size > 1) {
          const all = [...set.values()];
          const fs = all.filter(f => all.some(o => o.tag !== f.tag && Math.abs(o.c - f.c) < tol));
          if (fs.length < 2) continue;
          const label = [...new Set(fs.map(f => f.col))].sort().join(' + ');
          const pr = pairs.get(label) || { n: 0, at: null, c: fs[0].c }; pr.n++; if (!pr.at) { const i = Math.floor(key / 100003), j = key - i * 100003; pr.at = [mnx + i * cell, mny + j * cell]; } pairs.set(label, pr);
        }
        for (const [label, pr] of pairs) {
          const area = pr.n * cell * cell;
          if (area < (d * 0.004) ** 2) continue;
          hits.push({ axis: 'xyz'[Math.floor(k / 2)] + (k % 2 ? '+' : '-'), plane: +pr.c.toFixed(4), area: +area.toPrecision(3), at: pr.at.map(v => +v.toFixed(3)), mats: label });
        }
      }
    }
    hits.sort((a, c) => c.area - a.area);
    return { d: +d.toFixed(2), tol: +tol.toExponential(1), faces: faces.length, hits: hits.slice(0, 25) };
  });
  console.log(`\n== ${names[sc]}: view distance ${res.d}, tol ${res.tol}, ${res.faces} axis faces, ${res.hits.length} overlap groups`);
  for (const h of res.hits) console.log(`  ${h.axis} @ ${h.plane}  area ${h.area}  at ${h.at}  ${h.mats}`);
}
await b.close();
