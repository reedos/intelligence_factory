// Part islands and the tray-versus-tray comparison, shared by tools/tray-overlay.mjs (in the browser, on the live scenes),
// src/scenes/rack-tray-match.test.ts (on the shipped GLBs) and nothing else. No imports: the browser gets this file's text
// with the `export` keywords stripped, so keep it to plain function declarations.
//
// An "island" is a connected piece of surface (triangles that share a vertex position): one screw, one cold plate lid, one
// board. A joined mesh (the Blender export batches parts by material) falls back into its parts this way, which is how a
// rack's pulled tray can be listed part by part even though it is one mesh per material in the file.

// Islands of one mesh. pos: Float32Array xyz, index: Uint16/32Array or null, m: 16 numbers (column-major, as THREE and glTF),
// toMm: [ox, oy, oz, scale] maps the transformed point to tray millimetres ((p - o) * scale), box: [x0,x1,y0,y1,z0,z1] in
// those millimetres or null (or a function (x, y, z) => boolean for a region that is not a box). Only triangles whose centroid is inside count.
export function partIslands(pos, index, m, toMm, box) {
  const nV = pos.length / 3, tri = index ? index.length / 3 : nV / 3;
  const X = new Float64Array(nV), Y = new Float64Array(nV), Z = new Float64Array(nV);
  for (let i = 0; i < nV; i++) {
    const x = pos[3 * i], y = pos[3 * i + 1], z = pos[3 * i + 2];
    X[i] = ((m[0] * x + m[4] * y + m[8] * z + m[12]) - toMm[0]) * toMm[3];
    Y[i] = ((m[1] * x + m[5] * y + m[9] * z + m[13]) - toMm[1]) * toMm[3];
    Z[i] = ((m[2] * x + m[6] * y + m[10] * z + m[14]) - toMm[2]) * toMm[3];
  }
  // weld vertices that share a position (to 0.1 mm), so flat-shaded duplicates stay one surface
  const weld = new Map(), id = new Int32Array(nV), parent = [];
  for (let i = 0; i < nV; i++) {
    const k = Math.round(X[i] * 10) + ',' + Math.round(Y[i] * 10) + ',' + Math.round(Z[i] * 10);
    let w = weld.get(k); if (w === undefined) { w = parent.length; parent.push(w); weld.set(k, w); } id[i] = w;
  }
  const find = a => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  const keep = [];
  for (let t = 0; t < tri; t++) {
    const a = index ? index[3 * t] : 3 * t, b = index ? index[3 * t + 1] : 3 * t + 1, c = index ? index[3 * t + 2] : 3 * t + 2;
    if (box) {
      const cx = (X[a] + X[b] + X[c]) / 3, cy = (Y[a] + Y[b] + Y[c]) / 3, cz = (Z[a] + Z[b] + Z[c]) / 3;
      if (typeof box === 'function') { if (!box(cx, cy, cz)) continue; }
      else if (cx < box[0] || cx > box[1] || cy < box[2] || cy > box[3] || cz < box[4] || cz > box[5]) continue;
    }
    keep.push(t);
    const ra = find(id[a]), rb = find(id[b]); if (ra !== rb) parent[rb] = ra;
    const r1 = find(id[a]), rc = find(id[c]); if (r1 !== rc) parent[rc] = r1;
  }
  const out = new Map();
  for (const t of keep) {
    const a = index ? index[3 * t] : 3 * t, b = index ? index[3 * t + 1] : 3 * t + 1, c = index ? index[3 * t + 2] : 3 * t + 2;
    const r = find(id[a]);
    let s = out.get(r); if (!s) out.set(r, s = { n: 0, x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9, z0: 1e9, z1: -1e9 });
    s.n++;
    for (const v of [a, b, c]) { s.x0 = Math.min(s.x0, X[v]); s.x1 = Math.max(s.x1, X[v]); s.y0 = Math.min(s.y0, Y[v]); s.y1 = Math.max(s.y1, Y[v]); s.z0 = Math.min(s.z0, Z[v]); s.z1 = Math.max(s.z1, Z[v]); }
  }
  return [...out.values()];
}

// The footprint record a report lists: centre and size in millimetres, tray frame (x across, z along, front +z; y up from the tray floor)
export function describe(s, material) {
  const r = v => Math.round(v * 10) / 10;
  return { material, x: r((s.x0 + s.x1) / 2), z: r((s.z0 + s.z1) / 2), w: r(s.x1 - s.x0), d: r(s.z1 - s.z0), y0: r(s.y0), y1: r(s.y1), tris: s.n };
}

// How alike two material signatures look: {hex, rough, metal} -> 0 (same) .. 1+
export function materialGap(a, b) {
  const c = h => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
  const ca = c(a.hex), cb = c(b.hex);
  const dc = Math.hypot(ca[0] - cb[0], ca[1] - cb[1], ca[2] - cb[2]) / 441;
  return dc + Math.abs(a.rough - b.rough) * .25 + Math.abs(a.metal - b.metal) * .25;
}

// Pair the parts of tray A with those of tray B (greedy, nearest first). A part is `missing` (in A only), `extra` (in B only),
// `offset` (a same-sized part within 80 mm but further than `tol` from where A has it), `resized` (same place, different size),
// or `material` (same place and size, a different look). Parts smaller than `minMm` in every plan dimension are not compared:
// that is the level of detail the rack draws at.
export function compareParts(A, B, { tol = 5, minMm = 8, matTol = .22 } = {}) {
  const big = p => Math.max(p.w, p.d) >= minMm;
  const a = A.filter(big), b = B.filter(big), used = new Set(), res = { matched: 0, missing: [], extra: [], offset: [], resized: [], material: [] };
  const grid = new Map(), cell = 40, key = (x, z) => Math.floor(x / cell) + ',' + Math.floor(z / cell);
  b.forEach((p, i) => { const k = key(p.x, p.z); (grid.get(k) || grid.set(k, []).get(k)).push(i); });
  const near = (p, r) => { const out = []; for (let gx = Math.floor((p.x - r) / cell); gx <= Math.floor((p.x + r) / cell); gx++) for (let gz = Math.floor((p.z - r) / cell); gz <= Math.floor((p.z + r) / cell); gz++) for (const i of grid.get(gx + ',' + gz) || []) out.push(i); return out; };
  const cost = (p, q) => Math.hypot(p.x - q.x, p.z - q.z) + Math.abs(p.w - q.w) + Math.abs(p.d - q.d) + Math.abs(p.y0 - q.y0) * .5 + Math.abs(p.y1 - q.y1) * .5;
  const order = a.map((p, i) => i).sort((i, j) => (a[j].w * a[j].d) - (a[i].w * a[i].d)), done = new Set();
  // pass 1: parts that coincide (within `tol` in place and size) pair off first, so a look-alike never takes another part's twin
  for (const i of order) {
    const p = a[i]; let best = -1, bc = 1e9;
    for (const j of near(p, tol)) if (!used.has(j)) {
      const q = b[j];
      if (Math.hypot(p.x - q.x, p.z - q.z) > tol || Math.abs(p.w - q.w) > tol || Math.abs(p.d - q.d) > tol) continue;
      const c = cost(p, q); if (c < bc) { bc = c; best = j; }
    }
    if (best < 0) continue;
    used.add(best); done.add(i);
    const q = b[best];
    if (p.mat && q.mat && materialGap(p.mat, q.mat) > matTol) res.material.push({ a: p, b: q }); else res.matched++;
  }
  // pass 2: what is left - the nearest left-over part decides which kind of difference it is
  for (const i of order) {
    if (done.has(i)) continue;
    const p = a[i]; let best = -1, bc = 1e9;
    for (const j of near(p, 80)) if (!used.has(j)) { const c = cost(p, b[j]); if (c < bc) { bc = c; best = j; } }
    if (best < 0) { res.missing.push(p); continue; }
    const q = b[best], dpos = Math.hypot(p.x - q.x, p.z - q.z), dsize = Math.max(Math.abs(p.w - q.w), Math.abs(p.d - q.d));
    if (dsize <= tol && dpos > tol) { used.add(best); res.offset.push({ a: p, b: q, by: Math.round(dpos * 10) / 10 }); continue; }
    if (dpos <= tol * 3 && dsize > tol) { used.add(best); res.resized.push({ a: p, b: q }); continue; }
    res.missing.push(p);
  }
  b.forEach((q, j) => { if (!used.has(j)) res.extra.push(q); });
  return res;
}

// A glTF material as a signature (hex colour, roughness, metalness) - what the browser reads off a THREE material
export function gltfMaterialSig(mat) {
  const pbr = mat?.pbrMetallicRoughness || {}, f = pbr.baseColorFactor || [1, 1, 1, 1];
  const lin = v => v <= .0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - .055;   // glTF factors are linear; THREE's color.getHex() is sRGB
  const h = f.slice(0, 3).map(v => Math.round(Math.min(1, Math.max(0, lin(v))) * 255));
  return { hex: (h[0] << 16) | (h[1] << 8) | h[2], rough: pbr.roughnessFactor ?? 1, metal: pbr.metallicFactor ?? 1, name: mat?.name || '' };
}

// Every part of a GLB inside a tray-frame box. buf: ArrayBuffer/Buffer of a .glb. toMm(world) frames: see partIslands. Used by
// the vitest gate; the browser tool walks the live THREE scene instead.
export function glbParts(buf, toMm, box) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const jlen = dv.getUint32(12, true), json = JSON.parse(new TextDecoder().decode(u8.subarray(20, 20 + jlen)));
  const bin0 = 20 + jlen + 8, binLen = dv.getUint32(20 + jlen, true), bin = u8.subarray(bin0, bin0 + binLen);
  const view = acc => {
    const a = json.accessors[acc], bv = json.bufferViews[a.bufferView], off = (bv.byteOffset || 0) + (a.byteOffset || 0);
    const n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type], T = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array }[a.componentType];
    const stride = bv.byteStride, bytes = T.BYTES_PER_ELEMENT;
    if (!stride || stride === n * bytes) { const copy = new Uint8Array(a.count * n * bytes); copy.set(bin.subarray(off, off + a.count * n * bytes)); return new T(copy.buffer); }
    const out = new T(a.count * n), d = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
    for (let i = 0; i < a.count; i++) for (let k = 0; k < n; k++) out[i * n + k] = a.componentType === 5126 ? d.getFloat32(off + i * stride + k * 4, true) : d.getUint32(off + i * stride + k * bytes, true);
    return out;
  };
  const compose = nd => {   // column-major TRS or matrix
    if (nd.matrix) return nd.matrix.slice();
    const [qx, qy, qz, qw] = nd.rotation || [0, 0, 0, 1], [sx, sy, sz] = nd.scale || [1, 1, 1], [tx, ty, tz] = nd.translation || [0, 0, 0];
    const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz, xx = qx * x2, xy = qx * y2, xz = qx * z2, yy = qy * y2, yz = qy * z2, zz = qz * z2, wx = qw * x2, wy = qw * y2, wz = qw * z2;
    return [(1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0, (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0, (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0, tx, ty, tz, 1];
  };
  const mul = (a, b) => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
  const parts = [], scene = json.scenes[json.scene || 0];
  const walk = (i, parent) => {
    const nd = json.nodes[i], m = mul(parent, compose(nd));
    if (nd.mesh !== undefined) for (const p of json.meshes[nd.mesh].primitives) {
      if ((p.mode ?? 4) !== 4) continue;
      const mat = json.materials?.[p.material], sig = gltfMaterialSig(mat);
      if (mat?.alphaMode === 'BLEND') continue;
      const pos = view(p.attributes.POSITION), idx = p.indices !== undefined ? view(p.indices) : null;
      for (const s of partIslands(pos, idx, m, toMm, box)) parts.push({ ...describe(s, mat?.name || ''), mat: sig });
    }
    for (const c of nd.children || []) walk(c, m);
  };
  for (const r of scene.nodes) walk(r, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  return parts;
}

// ---- the live scene (THREE objects), shared by tools/tray-overlay.mjs (in the browser) and rack-tray-parts.test.ts (in Node) ----

// Is this mesh hardware of the tray (drawn, opaque, not a teaching overlay, not on the `ignore` list, not a spinning rotor)?
// `ignore`: a regular expression source; a mesh whose materials all match it is not counted (the rack's own patch leads and cable
// manager, the closed trays' cage shells, printed decals).
export function isHardware(ob, ignore) {
  if (ob.userData.nativeOverlay || ob.userData.printed) return false;   // runtime-only overlays (rack management leads) and decals
  if (!ob.isMesh || ob.isReflector || ob.userData.computeDynamic) return false;
  for (let q = ob; q; q = q.parent) if (q.visible === false) return false;
  const ms = Array.isArray(ob.material) ? ob.material : [ob.material], skip = ignore ? new RegExp(ignore, 'i') : null;
  if (skip && ms.every(m => skip.test(m.name || ''))) return false;
  return ms.some(m => !m.isMeshBasicMaterial && !m.isShaderMaterial && !(m.transparent && m.opacity < 1));
}

// The tray level's bounding box of its hardware, in tray millimetres: [x0, x1, y0, y1, z0, z1] (that level draws in tray units of 10 cm)
export function trayBounds(root, T) {
  root.updateMatrixWorld(true);
  const bx = new T.Box3(), t = new T.Box3();
  root.traverse(ob => {
    if (!ob.isMesh || ob.isReflector || ob.userData.computeDynamic) return;
    for (let q = ob; q; q = q.parent) if (q.visible === false) return;
    const ms = Array.isArray(ob.material) ? ob.material : [ob.material];
    if (!ms.some(m => !m.isMeshBasicMaterial && !m.isShaderMaterial && !(m.transparent && m.opacity < 1))) return;
    t.setFromObject(ob); if (isFinite(t.min.x)) bx.union(t);
  });
  return [bx.min.x * 100, bx.max.x * 100, bx.min.y * 100, bx.max.y * 100, bx.min.z * 100, bx.max.z * 100];
}

// Every part of a level's scene inside `box` (a function (x, y, z) in tray millimetres), with `toMm` = [ox, oy, oz, scale] mapping
// the level's world to the tray's frame. A spinning rotor (one instanced mesh per fan group) is one record per fan: where it is
// and how big, since its pose changes every frame.
export function levelParts(root, T, { toMm, box, ignore }) {
  root.updateMatrixWorld(true);
  const parts = [], sig = m => ({ hex: m.color ? m.color.getHex() : 0x808080, rough: m.roughness ?? 1, metal: m.metalness ?? 0, name: m.name || '' });
  root.traverse(ob => {
    if (ob.userData.computeDynamic === 'rotor' && ob.isInstancedMesh) {
      let visible = true; for (let q = ob; q; q = q.parent) if (q.visible === false) visible = false;
      if (!visible) return;
      const m4 = new T.Matrix4(), v = new T.Vector3(); ob.geometry.computeBoundingSphere();
      for (let i = 0; i < ob.count; i++) {
        ob.getMatrixAt(i, m4); m4.premultiply(ob.matrixWorld); v.setFromMatrixPosition(m4);
        const r = ob.geometry.boundingSphere.radius * m4.getMaxScaleOnAxis() * toMm[3];
        const x = (v.x - toMm[0]) * toMm[3], y = (v.y - toMm[1]) * toMm[3], z = (v.z - toMm[2]) * toMm[3], rd = Math.round(r * 20) / 10;
        if (box(x, y, z)) parts.push({ material: 'fan rotor', x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, w: rd, d: rd, y0: Math.round((y - r) * 10) / 10, y1: Math.round((y + r) * 10) / 10, tris: 0, mat: { hex: 0, rough: 1, metal: 0, name: 'fan rotor' } });
      }
      return;
    }
    if (!isHardware(ob, ignore)) return;
    const geo = ob.geometry, pos = geo.attributes.position; if (!pos) return;
    const ms = Array.isArray(ob.material) ? ob.material : [ob.material];
    const arr = pos.isInterleavedBufferAttribute || pos.itemSize !== 3 ? Float32Array.from({ length: pos.count * 3 }, (_, i) => pos.getComponent(Math.floor(i / 3), i % 3)) : pos.array;
    const groups = geo.groups.length ? geo.groups : [{ start: 0, count: geo.index ? geo.index.count : pos.count, materialIndex: 0 }];
    const matrices = [];
    if (ob.isInstancedMesh) { const m4 = new T.Matrix4(); for (let i = 0; i < ob.count; i++) { ob.getMatrixAt(i, m4); matrices.push(m4.clone().premultiply(ob.matrixWorld).elements.slice()); } }
    else matrices.push(ob.matrixWorld.elements.slice());
    for (const gr of groups) {
      const m = ms[gr.materialIndex] || ms[0];
      if (m.isMeshBasicMaterial || m.isShaderMaterial || (m.transparent && m.opacity < 1)) continue;
      if (!geo.index && groups.length > 1) continue;
      const idx = geo.index ? geo.index.array.subarray(gr.start, gr.start + gr.count) : null;
      for (const matrix of matrices.slice(0, 4000)) for (const s of partIslands(arr, idx, matrix, toMm, box)) parts.push({ ...describe(s, m.name || ''), mat: sig(m) });
    }
  });
  return parts;
}

// The region compared: the tray level's own bounding box; behind the rack's front plane (zRear, tray millimetres) the pulled tray's rear
// still stands in the rack's frame beside the closed trays' fronts, so there only what stands within the slot's height counts.
export function trayRegion(frame, zRear, slot = 44.5) {
  const [fx0, fx1, fy0, fy1, fz0, fz1] = frame;
  return (x, y, z) => x >= fx0 && x <= fx1 && y >= fy0 - 1 && y <= fy1 + 1 && z >= fz0 && z <= fz1 && (z >= zRear || y <= slot);
}
export const RACK_OWNED = 'patch cable|MPO APC|hook-and-loop|MPO patch lead|lid label|package marking|drive capacity|cable manager|Inserted flat top OSFP shell';
