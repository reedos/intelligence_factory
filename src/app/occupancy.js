// A coarse voxel map of a level's solid geometry, for the camera's path clearance. Raycasting a flight against the
// meshes themselves is too slow to do on a tap (the data hall's racks are one mesh of a million triangles: ~25 ms a
// ray), so each level is rasterized into a grid of occupied cells, conservatively: a cell is marked when any triangle
// comes within it, so a path the map calls clear of a margin is clear of the real surfaces too. Queries are then a
// few hundred bit reads. Building touches every triangle once, so it runs in slices (a few milliseconds a frame) off the tap.
import * as THREE from 'three';

const _box = new THREE.Box3(), _m = new THREE.Matrix4(), _im = new THREE.Matrix4(), _v = new THREE.Vector3();

// meshes: THREE meshes and instanced meshes, matrices up to date. maxCells bounds the memory (one bit a cell).
// step(budgetMs) does up to that much work and says whether the map is done; `result` is the map once it is.
export function occupancyBuilder(meshes, { maxCells = 32_000_000 } = {}) {
  const bounds = new THREE.Box3();
  for (const o of meshes) bounds.union(_box.setFromObject(o));
  if (bounds.isEmpty()) return { step: () => true, result: null };
  const size = bounds.getSize(new THREE.Vector3()), pad = Math.max(size.x, size.y, size.z) * 0.02 + 1e-6;
  bounds.expandByScalar(pad); bounds.getSize(size);
  const h = Math.max(Math.cbrt((size.x * size.y * size.z) / maxCells), Math.max(size.x, size.y, size.z) / 4096);
  const nx = Math.max(1, Math.ceil(size.x / h)), ny = Math.max(1, Math.ceil(size.y / h)), nz = Math.max(1, Math.ceil(size.z / h));
  const bits = new Uint32Array(Math.ceil((nx * ny * nz) / 32)), ox = bounds.min.x, oy = bounds.min.y, oz = bounds.min.z;
  const reach = h * 0.87;                                   // half a cell's diagonal
  const set = i => { bits[i >>> 5] |= 1 << (i & 31); };
  const has = i => (bits[i >>> 5] >>> (i & 31)) & 1;
  const clampI = (v, n) => (v < 0 ? 0 : v >= n ? n - 1 : v);
  let V = new Float32Array(0);
  // one triangle, its corners at V[a], V[b], V[c] (world space)
  const mark = (a, b, c) => {
    const ax = V[a], ay = V[a + 1], az = V[a + 2], bx = V[b], by = V[b + 1], bz = V[b + 2], cx = V[c], cy = V[c + 1], cz = V[c + 2];
    const i0 = clampI(Math.floor((Math.min(ax, bx, cx) - ox) / h), nx), i1 = clampI(Math.floor((Math.max(ax, bx, cx) - ox) / h), nx);
    const j0 = clampI(Math.floor((Math.min(ay, by, cy) - oy) / h), ny), j1 = clampI(Math.floor((Math.max(ay, by, cy) - oy) / h), ny);
    const k0 = clampI(Math.floor((Math.min(az, bz, cz) - oz) / h), nz), k1 = clampI(Math.floor((Math.max(az, bz, cz) - oz) / h), nz);
    if ((i1 - i0 + 1) * (j1 - j0 + 1) * (k1 - k0 + 1) <= 8) {
      for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) set((k * ny + j) * nx + i);
      return;
    }
    // a big triangle: only the cells its plane passes through (a superset of the triangle within its box)
    const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
    let px = uy * vz - uz * vy, py = uz * vx - ux * vz, pz = ux * vy - uy * vx;
    const len = Math.hypot(px, py, pz); if (len < 1e-20) return;
    px /= len; py /= len; pz /= len;
    const d = px * ax + py * ay + pz * az;
    for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) {
      const base = py * (oy + (j + 0.5) * h) + pz * (oz + (k + 0.5) * h) - d, row = (k * ny + j) * nx;
      for (let i = i0; i <= i1; i++) if (Math.abs(base + px * (ox + (i + 0.5) * h)) <= reach) set(row + i);
    }
  };
  // the work, as a queue of (mesh, copy) jobs, each walked in chunks of triangles
  const jobs = [];
  for (const o of meshes) {
    const pos = o.geometry?.attributes?.position; if (!pos) continue;
    for (let c = 0, n = o.isInstancedMesh ? o.count : 1; c < n; c++) jobs.push([o, c]);
  }
  let job = 0, tri = 0, idx = null, tris = 0;
  const begin = () => {                                    // world-space corners of the job's copy, once
    const [o, c] = jobs[job], g = o.geometry, pos = g.attributes.position;
    if (o.isInstancedMesh) { o.getMatrixAt(c, _im); _m.multiplyMatrices(o.matrixWorld, _im); } else _m.copy(o.matrixWorld);
    if (V.length < pos.count * 3) V = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) { _v.fromBufferAttribute(pos, i).applyMatrix4(_m); V[i * 3] = _v.x; V[i * 3 + 1] = _v.y; V[i * 3 + 2] = _v.z; }
    idx = g.index; tris = Math.floor((idx ? idx.count : pos.count) / 3); tri = 0;
  };
  const near = (p, r) => {
    const R = r + reach, R2 = R * R;
    const i0 = Math.floor((p.x - R - ox) / h), i1 = Math.floor((p.x + R - ox) / h);
    const j0 = Math.floor((p.y - R - oy) / h), j1 = Math.floor((p.y + R - oy) / h);
    const k0 = Math.floor((p.z - R - oz) / h), k1 = Math.floor((p.z + R - oz) / h);
    if (i1 < 0 || j1 < 0 || k1 < 0 || i0 >= nx || j0 >= ny || k0 >= nz) return false;
    for (let k = Math.max(0, k0); k <= Math.min(nz - 1, k1); k++) {
      const dz = oz + (k + 0.5) * h - p.z;
      for (let j = Math.max(0, j0); j <= Math.min(ny - 1, j1); j++) {
        const dy = oy + (j + 0.5) * h - p.y, row = (k * ny + j) * nx;
        for (let i = Math.max(0, i0); i <= Math.min(nx - 1, i1); i++) {
          if (!has(row + i)) continue;
          const dx = ox + (i + 0.5) * h - p.x;
          if (r <= 0 ? (Math.abs(dx) <= h / 2 && Math.abs(dy) <= h / 2 && Math.abs(dz) <= h / 2) : dx * dx + dy * dy + dz * dz <= R2) return true;
        }
      }
    }
    return false;
  };
  const _p = new THREE.Vector3();
  const map = {
    cell: h, dims: [nx, ny, nz], bounds,
    // anything solid (maybe) within r of p? r = 0 asks only whether p's own cell is occupied: the best guess at
    // whether p is inside something, neither conservative nor generous
    near,
    // does the segment a→b come within r (r0 at a, r1 at b, linearly between) of anything solid? from/to: false
    // leaves that end point itself out (a camera framing sits where it sits; the way there is what is tested)
    segment(a, b, r0 = 0, r1 = r0, { from = true, to = true } = {}) {
      // spheres every half radius (or half cell) cover the swept capsule
      const len = a.distanceTo(b), steps = Math.max(2, Math.ceil(len / Math.max(h * 0.5, Math.min(r0, r1) * 0.5)));
      for (let s = from ? 0 : 1; s <= (to ? steps : steps - 1); s++) {
        const f = s / steps;
        if (near(_p.lerpVectors(a, b, f), r0 + (r1 - r0) * f)) return true;
      }
      return false;
    },
  };
  const builder = {
    result: null,
    step(budgetMs = Infinity) {
      const t0 = performance.now();
      while (job < jobs.length) {
        if (!idx && tri === 0 && tris === 0) begin();
        const end = Math.min(tris, tri + 20000);
        if (idx) for (; tri < end; tri++) mark(idx.getX(tri * 3) * 3, idx.getX(tri * 3 + 1) * 3, idx.getX(tri * 3 + 2) * 3);
        else for (; tri < end; tri++) mark(tri * 9, tri * 9 + 3, tri * 9 + 6);
        if (tri >= tris) { job++; tri = 0; tris = 0; idx = null; }
        if (performance.now() - t0 > budgetMs) return false;
      }
      builder.result = map;
      return true;
    },
  };
  return builder;
}
export function buildOccupancy(meshes, opts) {
  const b = occupancyBuilder(meshes, opts); b.step(); return b.result;
}
