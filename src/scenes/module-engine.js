// The NIC-side single-port module is ONE DR4 engine of the twin-port drawing (Reed, 10/03/2026): the same Blender
// asset with the second engine's lane parts taken out. The asset tags every conductor route with its `engine` (1 or 2:
// lanes 0-3 and 4-7, tools/blender/convert-module-twin.py), so each separate solid piece of a lane mesh is matched to
// the nearest route and dropped when that route belongs to the other engine. The MPO parts are matched by side
// instead (receptacle 2 sits at -z). The shell, board, DSP and the single PIC / driver / TIA / laser blocks stay.
// Run on the build-owned clone at rest (before the model is scaled or exploded), in glTF metres like the routes.
import * as THREE from 'three';

const norm = n => n.replace(/[\s_]+/g, ' ').trim().toLowerCase();

// meshes whose pieces are lane-specific: every piece sits on, or at the end of, one lane's route
export const LANE_MESHES = [
  'HOST_SIGNAL_VIAS 05 | Gold contacts and wire bonds', 'LPO_BYPASS 06 | Copper circuitry', 'PART_DSP_TRACES 06 | Copper circuitry',
  'PART_BONDS 05 | Gold contacts and wire bonds', 'DRIVER channel cells', 'DRIVER channel pads', 'TIA channel cells', 'TIA channel pads',
  'PART_LASERS__05', 'PART_LASERS__07', 'PART_OPTICAL_ROUTES 06 | Copper circuitry', 'PART_OPTICAL_ROUTES 13 | TX optical paths',
  'PART_OPTICAL_ROUTES 14 | RX optical paths', 'PART_OPTICAL_ROUTES 15 | Laser carrier paths', 'MZM modulator bodies',
  'PART_PIC transmit electrodes', 'PART_PIC__05', 'PART_PIC__07',
];
// meshes by connector: receptacle 1 (+z) is engine 1's, receptacle 2 (-z) engine 2's
export const MPO_PIECE_MESHES = ['PART_MPO 02 | Machined edge highlights', 'PART_MPO 07 | Molded packages', 'PART_MPO 10 | Connector ferrule',
  'PART_MPO 13 | TX optical paths', 'PART_MPO 14 | RX optical paths'];
export const MPO_WHOLE_OBJECTS = ['MPO receptacle 2', 'MPO sleeve 2'];

/** The separate solid pieces of an indexed or plain triangle mesh: triangles joined through welded vertices. */
export function meshPieces(geometry) {
  const pos = geometry.attributes.position, idx = geometry.index, n = pos.count;
  const parent = new Int32Array(n); for (let i = 0; i < n; i++) parent[i] = i;
  const find = a => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  const weld = new Map();
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(pos.getX(i) * 1e7)},${Math.round(pos.getY(i) * 1e7)},${Math.round(pos.getZ(i) * 1e7)}`;
    const first = weld.get(k);
    if (first === undefined) weld.set(k, i); else parent[find(i)] = find(first);
  }
  const tri = idx ? idx.count / 3 : n / 3, at = (t, c) => (idx ? idx.getX(3 * t + c) : 3 * t + c);
  for (let t = 0; t < tri; t++) { const a = at(t, 0); parent[find(at(t, 1))] = find(a); parent[find(at(t, 2))] = find(a); }
  const groups = new Map();
  for (let t = 0; t < tri; t++) {
    const r = find(at(t, 0));
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(t);
  }
  return [...groups.values()];
}

function segmentDistanceSq(p, a, b) {
  const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2], apx = p.x - a[0], apy = p.y - a[1], apz = p.z - a[2];
  const len = abx * abx + aby * aby + abz * abz;
  const t = len > 0 ? Math.max(0, Math.min(1, (apx * abx + apy * aby + apz * abz) / len)) : 0;
  const dx = apx - t * abx, dy = apy - t * aby, dz = apz - t * abz;
  return dx * dx + dy * dy + dz * dz;
}

/** Which engine (1 or 2) a piece belongs to: the engine of the nearest route to a few of its vertices. */
function nearestEngine(points, routes) {
  let best = Infinity, engine = 1;
  for (const p of points) for (const r of routes) {
    const pts = r.points;
    for (let i = 0; i < pts.length - 1; i++) {
      const d = segmentDistanceSq(p, pts[i], pts[i + 1]);
      if (d < best) { best = d; engine = r.engine; }
    }
  }
  return engine;
}

/** Drop the triangles at `triangles` indexes from a (build-owned) geometry; the mesh hides when nothing is left. */
function keepTriangles(mesh, keep) {
  const g = mesh.geometry, idx = g.index;
  const src = idx ? idx.array : Array.from({ length: g.attributes.position.count }, (_, i) => i);
  const out = [];
  for (let t = 0; t < keep.length; t++) if (keep[t]) out.push(src[3 * t], src[3 * t + 1], src[3 * t + 2]);
  if (!out.length) { mesh.visible = false; return 0; }
  // compact: only the vertices a kept triangle still uses stay, so nothing orphaned is uploaded or counted
  const used = new Map(), order = [];
  for (const v of out) if (!used.has(v)) { used.set(v, order.length); order.push(v); }
  for (const [name, attr] of Object.entries(g.attributes)) {
    const size = attr.itemSize, array = new attr.array.constructor(order.length * size);
    order.forEach((v, k) => { for (let c = 0; c < size; c++) array[k * size + c] = attr.array[v * size + c]; });
    g.setAttribute(name, new THREE.BufferAttribute(array, size, attr.normalized));
  }
  g.setIndex(out.map(v => used.get(v))); g.boundingBox = null; g.boundingSphere = null; g.computeBoundingSphere();
  return out.length / 3;
}

/**
 * Keep only `engine`'s lane parts on a build-owned clone at rest. Returns counts for diagnostics.
 * @param {THREE.Object3D} root the cloned asset scene (matrices are updated here)
 * @param {{ routes: { name: string, engine?: number, points: number[][] }[] }} metadata the asset's IFX route metadata
 * @param {number} engine the engine kept (1: lanes 0-3, receptacle 1)
 */
export function keepEngine(root, metadata, engine = 1) {
  root.updateMatrixWorld(true);
  const routes = metadata.routes.filter(r => r.engine && r.points?.length > 1);
  const meshes = new Map(); root.traverse(o => { if (o.isMesh) meshes.set(norm(o.name), o); });
  const byName = {}; root.traverse(o => { byName[norm(o.name)] = o; });
  const dropped = {};
  const world = new THREE.Vector3();
  for (const name of LANE_MESHES) {
    const mesh = meshes.get(norm(name)); if (!mesh) throw new Error(`Module engine filter: mesh not found: ${name}`);
    const pos = mesh.geometry.attributes.position, idx = mesh.geometry.index;
    const keep = [], tri = idx ? idx.count / 3 : pos.count / 3;
    for (const piece of meshPieces(mesh.geometry)) {
      // up to 6 vertices spread through the piece stand for it
      const sample = [], step = Math.max(1, Math.floor(piece.length / 6));
      for (let k = 0; k < piece.length; k += step) {
        const v = idx ? idx.getX(3 * piece[k]) : 3 * piece[k];
        sample.push(world.fromBufferAttribute(pos, v).applyMatrix4(mesh.matrixWorld).clone());
      }
      const e = nearestEngine(sample, routes);
      for (const t of piece) keep[t] = e === engine;
    }
    for (let t = 0; t < tri; t++) keep[t] ??= true;
    dropped[name] = keep.filter(k => !k).length;
    keepTriangles(mesh, keep);
  }
  // connectors: engine 1's receptacle is the +z one, so a piece whose centre is on the -z side belongs to engine 2
  const sign = engine === 1 ? 1 : -1;
  for (const name of MPO_PIECE_MESHES) {
    const mesh = meshes.get(norm(name)); if (!mesh) throw new Error(`Module engine filter: mesh not found: ${name}`);
    const pos = mesh.geometry.attributes.position, idx = mesh.geometry.index, keep = [];
    for (const piece of meshPieces(mesh.geometry)) {
      let z = 0;
      for (const t of piece) for (let c = 0; c < 3; c++) z += world.fromBufferAttribute(pos, idx ? idx.getX(3 * t + c) : 3 * t + c).applyMatrix4(mesh.matrixWorld).z;
      const centre = z / (piece.length * 3);
      for (const t of piece) keep[t] = centre * sign >= 0;
    }
    dropped[name] = keep.filter(k => !k).length;
    keepTriangles(mesh, keep);
  }
  for (const name of MPO_WHOLE_OBJECTS) { const o = byName[norm(name)]; if (!o) throw new Error(`Module engine filter: object not found: ${name}`); o.visible = false; dropped[name] = 1; }
  return dropped;
}
