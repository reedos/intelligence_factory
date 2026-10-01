// A uniform grid over one large mesh's triangles, for fast exact ray tests. Three's raycast tests every triangle of
// a mesh whose bounding sphere the ray touches: the data hall's racks are one mesh of about a million triangles, so
// each line-of-sight test in framing cost ~25 ms and a part selection several of them. Here the triangles are binned
// once (by their bounding boxes) into cells in the mesh's own space; a ray walks only the cells it passes through and
// tests only their triangles, with the same face rules as three's raycast (front, back or double sided).
import * as THREE from 'three';

const _inv = new THREE.Matrix4(), _o = new THREE.Vector3(), _e = new THREE.Vector3();

// mesh: a static, non-instanced mesh. Returns null for one not worth a grid (or not testable this way).
export function buildTriGrid(mesh, { minTriangles = 20000, perCell = 6 } = {}) {
  const g = mesh.geometry, pos = g?.attributes?.position;
  if (!pos || mesh.isInstancedMesh || mesh.isSkinnedMesh || g.morphAttributes?.position) return null;
  const idx = g.index, nTri = Math.floor((idx ? idx.count : pos.count) / 3);
  if (nTri < minTriangles) return null;
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  // one side for the whole mesh: double if any of its materials is (a hit three would count is never missed)
  const side = mats.some(m => m?.side === THREE.DoubleSide) ? THREE.DoubleSide : mats[0]?.side ?? THREE.FrontSide;
  const P = pos.array && pos.itemSize === 3 && !pos.isInterleavedBufferAttribute ? pos.array : Float32Array.from({ length: pos.count * 3 }, (_, i) => pos.getComponent(i / 3 | 0, i % 3));
  const I = idx ? idx.array : null, corner = (t, k) => (I ? I[t * 3 + k] : t * 3 + k);
  if (!g.boundingBox) g.computeBoundingBox();
  const box = g.boundingBox.clone(), size = box.getSize(new THREE.Vector3());
  const pad = Math.max(size.x, size.y, size.z) * 1e-4 + 1e-9; box.expandByScalar(pad); box.getSize(size);
  // cells: about nTri / perCell of them, shaped to the box
  const vol = Math.max(size.x * size.y * size.z, 1e-30), h = Math.cbrt(vol / Math.max(1, nTri / perCell));
  const nx = Math.min(256, Math.max(1, Math.ceil(size.x / h))), ny = Math.min(256, Math.max(1, Math.ceil(size.y / h))), nz = Math.min(256, Math.max(1, Math.ceil(size.z / h)));
  const sx = size.x / nx, sy = size.y / ny, sz = size.z / nz, ox = box.min.x, oy = box.min.y, oz = box.min.z;
  const ci = (v, o, s, n) => Math.min(n - 1, Math.max(0, Math.floor((v - o) / s)));
  const range = new Int32Array(nTri * 6);
  const count = new Int32Array(nx * ny * nz + 1);
  for (let t = 0; t < nTri; t++) {
    const a = corner(t, 0) * 3, b = corner(t, 1) * 3, c = corner(t, 2) * 3;
    const i0 = ci(Math.min(P[a], P[b], P[c]), ox, sx, nx), i1 = ci(Math.max(P[a], P[b], P[c]), ox, sx, nx);
    const j0 = ci(Math.min(P[a + 1], P[b + 1], P[c + 1]), oy, sy, ny), j1 = ci(Math.max(P[a + 1], P[b + 1], P[c + 1]), oy, sy, ny);
    const k0 = ci(Math.min(P[a + 2], P[b + 2], P[c + 2]), oz, sz, nz), k1 = ci(Math.max(P[a + 2], P[b + 2], P[c + 2]), oz, sz, nz);
    range.set([i0, i1, j0, j1, k0, k1], t * 6);
    for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) count[(k * ny + j) * nx + i + 1]++;
  }
  for (let n = 1; n < count.length; n++) count[n] += count[n - 1];
  const items = new Int32Array(count[count.length - 1]), fill = count.slice(0, -1);
  for (let t = 0; t < nTri; t++) {
    const r = t * 6;
    for (let k = range[r + 4]; k <= range[r + 5]; k++) for (let j = range[r + 2]; j <= range[r + 3]; j++) for (let i = range[r]; i <= range[r + 1]; i++) items[fill[(k * ny + j) * nx + i]++] = t;
  }
  const stamp = new Int32Array(nTri); let mark = 0;
  const matrix = mesh.matrixWorld.clone();
  // Möller–Trumbore with three's culling: a front-side mesh counts only hits on front faces, a back-side one back
  const tri = (t, o, d, far) => {
    const a = corner(t, 0) * 3, b = corner(t, 1) * 3, c = corner(t, 2) * 3;
    const e1x = P[b] - P[a], e1y = P[b + 1] - P[a + 1], e1z = P[b + 2] - P[a + 2];
    const e2x = P[c] - P[a], e2y = P[c + 1] - P[a + 1], e2z = P[c + 2] - P[a + 2];
    const px = d.y * e2z - d.z * e2y, py = d.z * e2x - d.x * e2z, pz = d.x * e2y - d.y * e2x;
    const det = e1x * px + e1y * py + e1z * pz;
    if (Math.abs(det) < 1e-18) return false;
    // det = -dir·(e1×e2): three culls a front-side triangle the ray meets from behind (dir·normal > 0), a back-side
    // one met from the front
    if (side === THREE.FrontSide && det < 0) return false;
    if (side === THREE.BackSide && det > 0) return false;
    const inv = 1 / det, tx = o.x - P[a], ty = o.y - P[a + 1], tz = o.z - P[a + 2];
    const u = (tx * px + ty * py + tz * pz) * inv; if (u < 0 || u > 1) return false;
    const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
    const v = (d.x * qx + d.y * qy + d.z * qz) * inv; if (v < 0 || u + v > 1) return false;
    const s = (e2x * qx + e2y * qy + e2z * qz) * inv;
    return s >= 0 && s <= far;
  };
  const _d = new THREE.Vector3();
  return {
    mesh, triangles: nTri, cells: nx * ny * nz,
    // still valid: the mesh has not moved since the grid was made
    fresh: () => mesh.matrixWorld.equals(matrix),
    // does the world-space segment from `from` along unit `dir` for `far` meet the mesh (as three's raycast would)?
    hits(from, dir, far) {
      _inv.copy(mesh.matrixWorld).invert();
      _o.copy(from).applyMatrix4(_inv); _e.copy(dir).multiplyScalar(far).add(from).applyMatrix4(_inv);
      const d = _d.subVectors(_e, _o), len = d.length(); if (len < 1e-12) return false; d.divideScalar(len);
      // clip to the box, then walk the cells (Amanatides & Woo)
      let t0 = 0, t1 = len;
      for (const [o, dd, lo, hi] of [[_o.x, d.x, box.min.x, box.max.x], [_o.y, d.y, box.min.y, box.max.y], [_o.z, d.z, box.min.z, box.max.z]]) {
        if (Math.abs(dd) < 1e-15) { if (o < lo || o > hi) return false; continue; }
        let a = (lo - o) / dd, b = (hi - o) / dd; if (a > b) [a, b] = [b, a];
        t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) return false;
      }
      const x = _o.x + d.x * t0, y = _o.y + d.y * t0, z = _o.z + d.z * t0;
      let i = ci(x, ox, sx, nx), j = ci(y, oy, sy, ny), k = ci(z, oz, sz, nz);
      const stepX = d.x > 0 ? 1 : -1, stepY = d.y > 0 ? 1 : -1, stepZ = d.z > 0 ? 1 : -1;
      const next = (p, o, s, c, dd) => (Math.abs(dd) < 1e-15 ? Infinity : ((o + (c + (dd > 0 ? 1 : 0)) * s) - p) / dd + t0);
      let tx = next(x, ox, sx, i, d.x), ty = next(y, oy, sy, j, d.y), tz = next(z, oz, sz, k, d.z);
      const dx = Math.abs(d.x) < 1e-15 ? Infinity : sx / Math.abs(d.x), dy = Math.abs(d.y) < 1e-15 ? Infinity : sy / Math.abs(d.y), dz = Math.abs(d.z) < 1e-15 ? Infinity : sz / Math.abs(d.z);
      if (++mark === 0x7fffffff) { stamp.fill(0); mark = 1; }
      for (;;) {
        const n = (k * ny + j) * nx + i;
        for (let q = count[n]; q < count[n + 1]; q++) {
          const t = items[q]; if (stamp[t] === mark) continue; stamp[t] = mark;
          if (tri(t, _o, d, len)) return true;
        }
        const tn = Math.min(tx, ty, tz);
        if (tn > t1) return false;
        if (tn === tx) { i += stepX; tx += dx; if (i < 0 || i >= nx) return false; }
        else if (tn === ty) { j += stepY; ty += dy; if (j < 0 || j >= ny) return false; }
        else { k += stepZ; tz += dz; if (k < 0 || k >= nz) return false; }
      }
    },
  };
}
