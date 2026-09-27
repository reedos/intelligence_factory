// Shared modeling kit: materials, a geometry merger, animated power flows and builders for
// parts that repeat across scenes. Everything is procedural; no model files.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { VOLT } from './data.js';

export { THREE };
const std = (color, roughness = 0.7, metalness = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });

export const MAT = {
  ground: std(0x161b17, 1), gravel: std(0x55534e, 0.95), asphalt: std(0x232528, 0.92), paint: std(0xd9d6c8, 0.8),
  concrete: std(0x8e8b84, 0.88), concreteDark: std(0x5d5b57, 0.9), slab: std(0x4a4c50, 0.75),
  galv: std(0x9ba3ab, 0.42, 0.85), steel: std(0x6a717a, 0.5, 0.7), darkSteel: std(0x2c3036, 0.55, 0.6),
  xfmr: std(0x7e8884, 0.55, 0.25), ansi61: std(0x8f989b, 0.55, 0.2), white: std(0xdfe2e3, 0.6, 0.05), beige: std(0xcfc8b4, 0.7, 0.05),
  porcelain: std(0x6b3526, 0.32, 0), polymer: std(0x7d848c, 0.6, 0), alu: std(0xb8bfc6, 0.35, 0.9), copper: std(0xc4794a, 0.32, 1),
  roof: std(0xa9adb0, 0.85), wall: std(0x9ba1a7, 0.72, 0.1), wallDark: std(0x3b4149, 0.7, 0.1), glass: std(0x1e2b38, 0.1, 0.6, { envMapIntensity: 1.5 }),
  rack: std(0x131519, 0.5, 0.45), rackFace: std(0x1d2026, 0.55, 0.35), cabinet: std(0xc3c7ca, 0.55, 0.15), cabinetDark: std(0x2b2f35, 0.5, 0.3),
  pcb: std(0x10362a, 0.6, 0.05), pcbBlack: std(0x15171a, 0.6, 0.1), silicon: std(0x5f6878, 0.34, 0.5, { envMapIntensity: 0.5 }), hbm: std(0x25282e, 0.35, 0.4),
  nickel: std(0xa9aeb5, 0.38, 1, { envMapIntensity: 0.6 }), inductor: std(0x2a2c30, 0.6, 0.2), gold: std(0xc9a14a, 0.3, 1), black: std(0x0d0e10, 0.75),
  pipeBlue: std(0x2f63c9, 0.45, 0.2), pipeRed: std(0xc3414f, 0.45, 0.2), pipeInsul: std(0xc9ccce, 0.8), yellowTray: std(0xd9b11c, 0.6),
  tree: std(0x1f2d22, 0.95), trunk: std(0x3a2d22, 1), fan: std(0x16181b, 0.6, 0.3), orange: std(0xd9772a, 0.6),
  skin: std(0x9c7a62, 0.8), hiVis: std(0xc8e04a, 0.7),
};

export const glowMat = (css, k = 1.4, opacity = 1) => new THREE.MeshBasicMaterial({
  color: new THREE.Color(css).multiplyScalar(k), transparent: opacity < 1, opacity, depthWrite: opacity >= 1,
});

// ---------- geometry merger: many parts, one draw call per material ----------
const _o = new THREE.Object3D();
const _box = new THREE.BoxGeometry(1, 1, 1);
const _cyl = {};
const cylGeo = seg => _cyl[seg] || (_cyl[seg] = new THREE.CylinderGeometry(1, 1, 1, seg, 1));
function prep(geo, matrix) {
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  g.applyMatrix4(matrix);
  return g;
}
export class Builder {
  constructor() { this.parts = new Map(); }
  add(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    _o.position.set(x, y, z); _o.rotation.set(rx, ry, rz); _o.scale.set(sx, sy, sz); _o.updateMatrix();
    return this.addM(geo, mat, _o.matrix);
  }
  addM(geo, mat, matrix) {
    if (!this.parts.has(mat)) this.parts.set(mat, []);
    this.parts.get(mat).push(prep(geo, matrix));
    return this;
  }
  // box by center
  box(w, h, d, mat, x, y, z, ry = 0, rx = 0, rz = 0) { return this.add(_box, mat, x, y, z, rx, ry, rz, w, h, d); }
  // box standing on y0
  slab(w, h, d, mat, x, y0, z, ry = 0) { return this.box(w, h, d, mat, x, y0 + h / 2, z, ry); }
  cyl(r, h, mat, x, y, z, seg = 16, rx = 0, ry = 0, rz = 0) { return this.add(cylGeo(seg), mat, x, y, z, rx, ry, rz, r, h, r); }
  cylX(r, len, mat, x, y, z, seg = 16) { return this.cyl(r, len, mat, x, y, z, seg, 0, 0, Math.PI / 2); }
  cylZ(r, len, mat, x, y, z, seg = 16) { return this.cyl(r, len, mat, x, y, z, seg, Math.PI / 2, 0, 0); }
  // cylinder between two points
  strut(a, b, r, mat, seg = 6) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const d = B.clone().sub(A), len = d.length(); if (len < 1e-6) return this;
    _o.position.copy(A).addScaledVector(d, 0.5);
    _o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    _o.scale.set(r, len, r); _o.updateMatrix();
    return this.addM(cylGeo(seg), mat, _o.matrix);
  }
  merge(other, matrix) {
    for (const [mat, list] of other.parts) for (const g of list) this.addM(g, mat, matrix);
    return this;
  }
  geometries() {
    const out = new Map();
    for (const [mat, list] of this.parts) out.set(mat, mergeGeometries(list, false));
    return out;
  }
  build({ cast = true, receive = true } = {}) {
    const group = new THREE.Group();
    for (const [mat, geo] of this.geometries()) {
      const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = receive; group.add(m);
    }
    return group;
  }
  // many copies of the same assembly
  instance(matrices, { cast = true, receive = true } = {}) {
    const group = new THREE.Group();
    for (const [mat, geo] of this.geometries()) {
      const m = new THREE.InstancedMesh(geo, mat, matrices.length);
      matrices.forEach((mx, i) => m.setMatrixAt(i, mx));
      m.castShadow = cast; m.receiveShadow = receive; group.add(m);
    }
    return group;
  }
}
export const mtx = (x = 0, y = 0, z = 0, ry = 0, s = 1) => { _o.position.set(x, y, z); _o.rotation.set(0, ry, 0); _o.scale.set(s, s, s); _o.updateMatrix(); return _o.matrix.clone(); };

// ---------- energy flows: pulses that travel along a conductor ----------
const pulseGeo = new THREE.SphereGeometry(1, 10, 8);
export class Flow {
  constructor(points, css, { count = 24, speed = 1, size = 1, k = 2.2, opacity = 1, trail = true, trailK = 0.35, trailR } = {}) {
    this.path = new THREE.CurvePath();
    const pts = points.map(p => new THREE.Vector3(...p));
    for (let i = 0; i < pts.length - 1; i++) this.path.add(new THREE.LineCurve3(pts[i], pts[i + 1]));
    this.len = this.path.getLength(); this.count = count; this.speed = speed; this.size = size;
    this.phase = Math.random();
    this.color = new THREE.Color(css).multiplyScalar(k);
    this.mesh = new THREE.InstancedMesh(pulseGeo, new THREE.MeshBasicMaterial({ color: this.color, transparent: opacity < 1, opacity, depthWrite: false }), count);
    this.mesh.frustumCulled = false;
    this.group = new THREE.Group(); this.group.add(this.mesh);
    if (trail) {
      const tube = new THREE.TubeGeometry(this.path, Math.max(8, pts.length * 6), trailR ?? size * 0.28, 6, false);
      this.trail = new THREE.Mesh(tube, new THREE.MeshBasicMaterial({ color: new THREE.Color(css).multiplyScalar(trailK), transparent: true, opacity: 0.55, depthWrite: false }));
      this.group.add(this.trail);
    }
    this.v = new THREE.Vector3();
    this.update(0);
  }
  update(t) {
    const step = (this.speed * t) / this.len;
    for (let i = 0; i < this.count; i++) {
      const u = ((i / this.count + step + this.phase) % 1 + 1) % 1;
      this.path.getPointAt(u, this.v);
      const s = this.size * (0.75 + 0.25 * Math.sin(u * 40));
      _o.position.copy(this.v); _o.rotation.set(0, 0, 0); _o.scale.set(s, s, s); _o.updateMatrix();
      this.mesh.setMatrixAt(i, _o.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
export const flow = (points, volt, opts) => new Flow(points, VOLT[volt]?.css ?? volt, opts);

// ---------- recurring parts ----------
// A stack of insulator sheds on a core: porcelain or polymer.
export function insulator(b, x, y0, z, h, r, mat = MAT.porcelain, { axis = 'y', sheds } = {}) {
  const n = sheds ?? Math.max(3, Math.round(h / (r * 2.6)));
  const along = (t) => axis === 'y' ? [x, y0 + t, z] : axis === 'x' ? [x + t, y0, z] : [x, y0, z + t];
  const rot = axis === 'y' ? [0, 0, 0] : axis === 'x' ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0];
  b.add(cylGeo(10), mat, ...along(h / 2), ...rot, r * 0.55, h, r * 0.55);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n * h;
    b.add(cylGeo(14), mat, ...along(t), ...rot, r * (i % 2 ? 1.6 : 2.0), r * 0.28, r * (i % 2 ? 1.6 : 2.0));
  }
  return b;
}

// Lattice transmission tower, double circuit, three crossarm levels. Returns arm tip positions.
export function latticeTower(b, H = 46, base = 9) {
  const mat = MAT.galv, r = 0.14;
  const waistY = H * 0.62, waistW = 2.6, topW = 1.6;
  const legAt = (y) => { const w = y < waistY ? THREE.MathUtils.lerp(base, waistW, y / waistY) : THREE.MathUtils.lerp(waistW, topW, (y - waistY) / (H - waistY)); return w / 2; };
  const corners = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
  const levels = [0, 5, 10, 15, 20, waistY * 0.9, waistY, H * 0.72, H * 0.82, H * 0.92, H];
  for (let i = 0; i < levels.length - 1; i++) {
    const y0 = levels[i], y1 = levels[i + 1], a0 = legAt(y0), a1 = legAt(y1);
    for (let c = 0; c < 4; c++) {
      const [sx, sz] = corners[c], [tx, tz] = corners[(c + 1) % 4];
      b.strut([sx * a0, y0, sz * a0], [sx * a1, y1, sz * a1], r * 1.4, mat);
      // X bracing on each face
      b.strut([sx * a0, y0, sz * a0], [tx * a1, y1, tz * a1], r * 0.7, mat);
      b.strut([tx * a0, y0, tz * a0], [sx * a1, y1, sz * a1], r * 0.7, mat);
      b.strut([sx * a1, y1, sz * a1], [tx * a1, y1, tz * a1], r * 0.6, mat);
    }
  }
  // crossarms: three levels, both sides (two circuits)
  const tips = [];
  [H * 0.72, H * 0.82, H * 0.92].forEach((y, i) => {
    const reach = [7.2, 8.4, 7.2][i], hw = legAt(y);
    for (const side of [1, -1]) {
      const tip = [side * reach, y, 0];
      b.strut([side * hw, y, 0.9], tip, r * 0.9, mat); b.strut([side * hw, y, -0.9], tip, r * 0.9, mat);
      b.strut([side * hw, y + 2.2, 0], tip, r * 0.7, mat);
      // suspension insulator string (hangs 3.4 m)
      insulator(b, tip[0], y - 3.6, 0, 3.4, 0.16, MAT.polymer, { sheds: 12 });
      tips.push([tip[0], y - 3.8, 0]);
    }
  });
  // shield wire peaks
  for (const side of [1, -1]) b.strut([side * topW / 2, H, 0], [side * 2.4, H + 3, 0], r, mat);
  tips.push([2.4, H + 3, 0], [-2.4, H + 3, 0]);
  return tips;
}

// Sagging wire between two points, as a polyline (for a Line or a Flow).
export function catenary(a, b, sag, n = 24) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    pts.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u - sag * 4 * u * (1 - u), a[2] + (b[2] - a[2]) * u]);
  }
  return pts;
}
export function wires(polylines, color = 0x2a2e33, opacity = 0.9) {
  const pos = [];
  for (const pl of polylines) for (let i = 0; i < pl.length - 1; i++) pos.push(...pl[i], ...pl[i + 1]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity }));
}

// ---------- canvas textures ----------
export function canvasTex(w, h, draw, { repeat = [1, 1], srgb = true } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat);
  t.anisotropy = 4;
  return t;
}
export const texMat = (tex, { rough = 0.7, metal = 0.1, emissive = null, emissiveIntensity = 1 } = {}) => new THREE.MeshStandardMaterial({
  map: tex, roughness: rough, metalness: metal, ...(emissive ? { emissive: 0xffffff, emissiveMap: emissive, emissiveIntensity } : {}),
});

// A standalone mesh (used for textured faces the merger would strip UVs from).
export function plane(w, h, mat, x, y, z, rx = 0, ry = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, 0); m.receiveShadow = true; return m;
}

// ---------- sky dome ----------
export function sky(top = '#0b1424', mid = '#1d2c44', horizon = '#c98a5a', radius = 5000) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(top) }, mid: { value: new THREE.Color(mid) }, hor: { value: new THREE.Color(horizon) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 hor; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h < 0.0 ? hor * 0.35 : mix(hor, mid, smoothstep(0.0, 0.18, h)); c = mix(c, top, smoothstep(0.18, 0.7, h)); gl_FragColor = vec4(c, 1.0); }',
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), mat);
  m.renderOrder = -1; return m;
}

// A flat text label that always faces the camera. h = height in world units.
export function textSprite(text, color = '#e8ecf2', h = 1) {
  const c = document.createElement('canvas'), g = c.getContext('2d');
  const font = '600 44px "IBM Plex Mono", ui-monospace, monospace';
  g.font = font; const w = Math.ceil(g.measureText(text).width) + 36; c.width = w; c.height = 72;
  g.font = font; g.fillStyle = 'rgba(10,14,20,0.82)'; g.beginPath(); g.roundRect(2, 4, w - 4, 64, 14); g.fill();
  g.strokeStyle = color; g.globalAlpha = 0.75; g.lineWidth = 2.5; g.stroke(); g.globalAlpha = 1;
  g.fillStyle = color; g.textBaseline = 'middle'; g.fillText(text, 18, 37);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  s.scale.set(w / 72 * h, h, 1); s.renderOrder = 10; return s;
}

// A person for scale: 1.75 m, hard hat.
export function person(b, x, z, ry = 0, y0 = 0, vest = MAT.hiVis) {
  const c = Math.cos(ry), s = Math.sin(ry), at = (dx, dz) => [x + dx * c + dz * s, z - dx * s + dz * c];
  for (const side of [-1, 1]) { const [lx, lz] = at(side * 0.1, 0); b.cyl(0.07, 0.85, MAT.darkSteel, lx, y0 + 0.425, lz, 8); }
  b.cyl(0.19, 0.6, vest, x, y0 + 1.15, z, 10);
  for (const side of [-1, 1]) { const [ax, az] = at(side * 0.25, 0); b.cyl(0.05, 0.6, vest, ax, y0 + 1.12, az, 8); }
  b.add(new THREE.SphereGeometry(0.11, 12, 10), MAT.skin, x, y0 + 1.58, z);
  b.add(new THREE.SphereGeometry(0.13, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), MAT.white, x, y0 + 1.62, z);
  return b;
}
