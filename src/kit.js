import { particleBudget } from './app/render-quality.js';
// Shared modeling kit: materials, a geometry merger, animated power flows and builders for
// parts that repeat across scenes. Blender adapters provide authored physical
// meshes; this kit also supplies runtime teaching overlays and native references.
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

// ---------- surface detail, in real meters ----------
// Merged geometry has no UVs, so detail is sampled in world space (triplanar: each axis-facing side samples its own
// plane, blended by the normal). DETAIL.unit is the scene's meters per world unit, so concrete grain, brushed metal
// and board traces keep their physical size at every scale; far away the mipmaps average them out.
export const DETAIL = { unit: { value: 1 } };
function noiseCanvas(n, draw) { const c = document.createElement('canvas'); c.width = c.height = n; draw(c.getContext('2d'), n); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; }
const rng = s => () => (s = (s * 16807) % 2147483647) / 2147483647;
// tileable value noise: a few octaves of blurred random cells
const NOISE = {
  grain: noiseCanvas(256, (g, n) => {
    const r = rng(11); const img = g.createImageData(n, n);
    const oct = [[8, 0.5], [16, 0.25], [32, 0.15], [64, 0.1]].map(([cells, w]) => { const v = Array.from({ length: cells * cells }, () => r()); return { cells, w, v }; });
    const sm = t => t * t * (3 - 2 * t);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      let s = 0;
      for (const { cells, w, v } of oct) {
        const fx = x / n * cells, fy = y / n * cells, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = sm(fx - x0), ty = sm(fy - y0);
        const at = (i, j) => v[((j % cells + cells) % cells) * cells + ((i % cells + cells) % cells)];
        s += w * ((at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx) * (1 - ty) + (at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx) * ty);
      }
      const k = (y * n + x) * 4, c = Math.round(Math.min(1, s) * 255); img.data[k] = img.data[k + 1] = img.data[k + 2] = c; img.data[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }),
  brushed: noiseCanvas(256, (g, n) => {
    const r = rng(23); g.fillStyle = '#808080'; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 1400; i++) { const y = r() * n, v = Math.round(90 + r() * 80); g.fillStyle = `rgba(${v},${v},${v},${0.18 + r() * 0.3})`; g.fillRect(0, y, n, 0.6 + r() * 1.2); }
  }),
  traces: noiseCanvas(512, (g, n) => {
    const r = rng(7); g.fillStyle = '#6a6a6a'; g.fillRect(0, 0, n, n);
    g.strokeStyle = '#b4b4b4'; g.lineCap = 'round';
    for (let i = 0; i < 90; i++) {            // routed traces: horizontal, vertical and 45° runs
      let x = r() * n, y = r() * n; g.lineWidth = 1 + (r() < 0.2 ? 2 : 0); g.beginPath(); g.moveTo(x, y);
      for (let s = 0; s < 4; s++) { const d = 20 + r() * 90, a = [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4][Math.floor(r() * 4)]; x += Math.cos(a) * d; y += Math.sin(a) * d; g.lineTo(x, y); }
      g.stroke();
    }
    g.fillStyle = '#d0d0d0'; for (let i = 0; i < 260; i++) { g.beginPath(); g.arc(r() * n, r() * n, 1.4, 0, Math.PI * 2); g.fill(); }   // vias
  }),
};
function withDetail(mat, tex, meters, amt, rough) {
  mat.onBeforeCompile = shader => {
    shader.uniforms.uDetail = { value: tex }; shader.uniforms.uDetailUnit = DETAIL.unit;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vDWPos;\nvarying vec3 vDWNormal;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 dwp = vec4(transformed, 1.0);
        vec3 dwn = objectNormal;
        #ifdef USE_INSTANCING
          dwp = instanceMatrix * dwp; dwn = mat3(instanceMatrix) * dwn;
        #endif
        dwp = modelMatrix * dwp; vDWPos = dwp.xyz; vDWNormal = normalize(mat3(modelMatrix) * dwn);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vDWPos;\nvarying vec3 vDWNormal;\nuniform sampler2D uDetail;\nuniform float uDetailUnit;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec3 dbw = pow(abs(vDWNormal), vec3(4.0)); dbw /= (dbw.x + dbw.y + dbw.z + 1e-5);
        vec3 dp = vDWPos * uDetailUnit / ${meters.toFixed(4)};
        float dn = texture2D(uDetail, dp.yz).r * dbw.x + texture2D(uDetail, dp.xz).r * dbw.y + texture2D(uDetail, dp.xy).r * dbw.z;
        diffuseColor.rgb *= 1.0 + (dn - 0.5) * ${(amt * 2).toFixed(3)};`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + (dn - 0.5) * ${(rough * 2).toFixed(3)}, 0.04, 1.0);`);
  };
  mat.customProgramCacheKey = () => `detail-${tex.uuid}-${meters}-${amt}-${rough}`;
  return mat;
}
// Scene-local materials can share the world-scale detail shader without changing MAT.
export function surfaceDetail(mat, { meters = 1, amount = 0.15, roughness = 0.1, pattern = 'grain' } = {}) {
  return withDetail(mat, NOISE[pattern] || NOISE.grain, meters, amount, roughness);
}
// detail per material: which pattern, its size in meters, how much it shifts color and roughness
const DETAILS = {
  ground: ['grain', 40, 0.25, 0.05], gravel: ['grain', 0.4, 0.3, 0.1], asphalt: ['grain', 1.2, 0.18, 0.12],
  concrete: ['grain', 0.8, 0.14, 0.12], concreteDark: ['grain', 0.8, 0.14, 0.12], slab: ['grain', 1.5, 0.1, 0.18],
  wall: ['grain', 2, 0.07, 0.08], wallDark: ['grain', 2, 0.07, 0.08], roof: ['grain', 3, 0.1, 0.1],
  galv: ['brushed', 0.3, 0.08, 0.14], steel: ['brushed', 0.25, 0.08, 0.14], darkSteel: ['brushed', 0.25, 0.06, 0.12], alu: ['brushed', 0.12, 0.06, 0.16],
  copper: ['brushed', 0.05, 0.1, 0.14], nickel: ['brushed', 0.03, 0.05, 0.1],
  rack: ['grain', 0.4, 0.06, 0.1], rackFace: ['grain', 0.4, 0.06, 0.1], xfmr: ['grain', 1.2, 0.08, 0.1], ansi61: ['grain', 1.2, 0.07, 0.1],
  white: ['grain', 1.5, 0.05, 0.08], beige: ['grain', 1.5, 0.06, 0.08],
  pcb: ['traces', 0.06, 0.35, 0.25], pcbBlack: ['traces', 0.06, 0.18, 0.2],
};
for (const [k, [kind, m, a, r]] of Object.entries(DETAILS)) if (MAT[k]) withDetail(MAT[k], NOISE[kind], m, a, r);


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
      const m = new THREE.Mesh(geo, mat); m.castShadow = cast && mat.userData.ifxCastShadow !== false; m.receiveShadow = receive; group.add(m);
    }
    return group;
  }
  // many copies of the same assembly
  instance(matrices, { cast = true, receive = true } = {}) {
    const group = new THREE.Group();
    for (const [mat, geo] of this.geometries()) {
      const m = new THREE.InstancedMesh(geo, mat, matrices.length);
      matrices.forEach((mx, i) => m.setMatrixAt(i, mx));
      m.castShadow = cast && mat.userData.ifxCastShadow !== false; m.receiveShadow = receive; group.add(m);
    }
    return group;
  }
}
export const mtx = (x = 0, y = 0, z = 0, ry = 0, s = 1) => { _o.position.set(x, y, z); _o.rotation.set(0, ry, 0); _o.scale.set(s, s, s); _o.updateMatrix(); return _o.matrix.clone(); };

// ---------- energy flows: pulses that travel along a conductor ----------
const pulseGeo = new THREE.SphereGeometry(1, 12, 8);
// A pulse is a droplet of light, not a bead: brightness and opacity fall off from the side facing the camera to the
// silhouette (so no hard rim), the centre runs toward white, and it adds to what is behind it. Same instanced sphere
// and one draw per flow as before; only the shading changes. `color` and `opacity` keep their MeshBasicMaterial meaning.
export class PulseMaterial extends THREE.MeshBasicMaterial {
  constructor(params) {
    super({ blending: THREE.AdditiveBlending, ...params });
    this.onBeforeCompile = shader => {
      shader.vertexShader = `varying vec3 vGlowN;\nvarying vec3 vGlowV;\n${shader.vertexShader}`.replace('#include <project_vertex>', `#include <project_vertex>
  vec3 glowN = normal;
  #ifdef USE_INSTANCING
    glowN = inverse(transpose(mat3(instanceMatrix))) * normal;   // stretched pulses keep true normals
  #endif
  vGlowN = normalize(normalMatrix * glowN);
  vGlowV = -mvPosition.xyz;`);
      shader.fragmentShader = `varying vec3 vGlowN;\nvarying vec3 vGlowV;\n${shader.fragmentShader}`.replace('#include <opaque_fragment>', `
  float glowF = clamp(abs(dot(normalize(vGlowN), normalize(vGlowV))), 0.0, 1.0);
  float glowHalo = glowF * glowF, glowCore = pow(glowF, 7.0);
  float glowPeak = max(max(outgoingLight.r, outgoingLight.g), outgoingLight.b);
  outgoingLight = outgoingLight * (0.25 + 0.85 * glowHalo) + vec3(glowPeak * 0.75 * glowCore);
  diffuseColor.a *= smoothstep(0.02, 0.6, glowF);
  #include <opaque_fragment>`);
    };
  }
  customProgramCacheKey() { return 'ifx-pulse-droplet-v1'; }
}
export class Flow {
  constructor(points, css, { count = 24, speed = 1, size = 1, k = 2.2, opacity = 1, trail = true, trailK = 0.35, trailR, role } = {}) {
    this.role = role; this.gain = 1; this.bright = 1; this.acc = 0; this.lastT = undefined;
    this.path = new THREE.CurvePath();
    const pts = points.map(p => new THREE.Vector3(...p));
    for (let i = 0; i < pts.length - 1; i++) this.path.add(new THREE.LineCurve3(pts[i], pts[i + 1]));
    this.len = this.path.getLength(); this.count = count; this.speed = speed; this.size = size;
    this.phase = Math.random();
    this.color = new THREE.Color(css).multiplyScalar(k);
    // Render after opaque hardware while still testing its depth. An opaque-
    // queue particle with depthWrite:false can be painted over by a later
    // hardware draw even when the particle is in front of that hardware.
    this.mesh = new THREE.InstancedMesh(pulseGeo, new PulseMaterial({ color: this.color, transparent: true, opacity, depthWrite: false }), count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.group = new THREE.Group(); this.group.add(this.mesh);
    if (trail) {
      const tube = new THREE.TubeGeometry(this.path, Math.max(8, pts.length * 6), trailR ?? size * 0.28, 6, false);
      this.trail = new THREE.Mesh(tube, new THREE.MeshBasicMaterial({ color: new THREE.Color(css).multiplyScalar(trailK), transparent: true, opacity: 0.55, depthWrite: false }));
      this.group.add(this.trail);
    }
    this.v = new THREE.Vector3();
    this.tangent = new THREE.Vector3();
    this.pulseAxis = new THREE.Vector3(0, 0, 1);
    this.base = { color: this.color.clone(), opacity, trail: this.trail?.material.color.clone() };
    this.update(0);
  }
  // position advances by speed × gain, so the clock can speed a flow up or stop it without a jump
  // Presentation changes never alter routes, direction, speed or clock gating.
  // Dense existing rails keep their count; sparse routes gain more moving cores.
  setMotionStyle({ density = 1, brightness = 1, radius = 1, pixels = 0, stretch = 1 } = {}) {
    if (this.motionStyle) return;
    const spacingLimit = Math.max(this.count, Math.floor(this.len / (this.size * radius * 7)));
    const count = Math.min(Math.ceil(this.count * density), spacingLimit);
    if (count > this.count) {
      this.mesh.instanceMatrix = new THREE.InstancedBufferAttribute(new Float32Array(count * 16), 16);
      this.mesh.count = this.count = count;
    }
    this.base.color.multiplyScalar(brightness);
    this.mesh.material.color.copy(this.base.color).multiplyScalar(this.bright);
    this.motionStyle = { radius, pixels, stretch };
  }
  setRenderBudget(fraction = 1) {
    this.renderFraction = Math.max(.1, Math.min(1, fraction));
    this.mesh.count = particleBudget(this.count, this.renderFraction);
  }
  update(t, projection) {
    const dt = this.lastT === undefined ? 0 : Math.max(0, t - this.lastT);
    this.lastT = t; this.acc += this.speed * this.gain * dt;
    const step = this.acc / this.len;
    const activeCount = this.mesh.count;
    for (let i = 0; i < activeCount; i++) {
      const u = ((i / activeCount + step + this.phase) % 1 + 1) % 1;
      this.path.getPointAt(u, this.v);
      const style = this.motionStyle;
      let radius = this.size * (style?.radius || 1);
      if (style?.pixels && projection) {
        const perPixel = this.v.distanceTo(projection.position) * projection.worldPerPixelAtUnit;
        radius = Math.max(radius, Math.min(this.size * 1.6, perPixel * style.pixels));
      }
      // Keep a visible gap even on legacy rails whose original pulse count is
      // already high. Preserve that count instead of turning it into a bar.
      if (style) radius = Math.min(radius, this.len / this.count / 3.2);
      const s = radius * (style ? 0.85 + 0.15 * Math.sin(u * 40) : 0.75 + 0.25 * Math.sin(u * 40));
      const stretch = style ? Math.max(1, Math.min(style.stretch, this.len / this.count / (radius * 3))) : 1;
      _o.position.copy(this.v);
      if (stretch > 1) {
        this.path.getTangentAt(u, this.tangent);
        _o.quaternion.setFromUnitVectors(this.pulseAxis, this.tangent);
      } else _o.rotation.set(0, 0, 0);
      _o.scale.set(s, s, s * stretch); _o.updateMatrix();
      this.mesh.setMatrixAt(i, _o.matrix);
    }
    this.mesh.instanceMatrix.clearUpdateRanges();
    this.mesh.instanceMatrix.addUpdateRange(0, activeCount * 16);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
Flow.prototype.setLevel = function (gain, bright = 1) {
  this.gain = gain;
  const on = gain > 0.02;                                 // the layer switch owns group.visible; the clock hides the parts
  if (this.mesh.visible !== on) { this.mesh.visible = on; if (this.trail) this.trail.visible = on; }
  if (bright !== this.bright) {
    this.bright = bright;
    const m = this.mesh.material;
    m.color.copy(this.base.color).multiplyScalar(bright);
    m.opacity = Math.min(1, this.base.opacity * bright); m.transparent = true;
    if (this.trail) this.trail.material.color.copy(this.base.trail).multiplyScalar(bright);
  }
};
export const flow = (points, volt, opts) => Object.assign(new Flow(points, VOLT[volt]?.css ?? volt, opts), { cls: volt });

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
// `string`: an optional Builder holding an authored insulator string laid along +X from its origin (the campus
// catalog's 3 m SUB_STRING); each suspension string then uses it, hung straight down and scaled to reach the
// conductor clamp, instead of the procedural disc stack.
const _hang = new THREE.Matrix4(), _hangR = new THREE.Matrix4().makeRotationZ(-Math.PI / 2), _hangS = new THREE.Matrix4();
export function latticeTower(b, H = 46, base = 9, { string = null } = {}) {
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
      // suspension insulator string (hangs 3.4 m from 0.2 m under the arm to the clamp)
      if (string) b.merge(string, _hang.makeTranslation(tip[0], y - 0.2, 0).multiply(_hangR).multiply(_hangS.makeScale(1.2, 1.2, 1.2)));
      else insulator(b, tip[0], y - 3.6, 0, 3.4, 0.16, MAT.polymer, { sheds: 12 });
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

// A person for scale: 1.75 m, standing, facing local +z. Dark work clothes under a hi-vis vest with a
// retro-reflective band, arms at the sides with a slight bend, boots and a brimmed hard hat, so the figure
// reads as a person rather than a colored peg at the 5-20 m distances the part cameras use.
// Only shapes the site construction library carries (box, cylinder, its 1.3:1.85 taper, sphere, dome).
const PERSON = {
  shirt: std(0x1d2a3a, 0.85), trousers: std(0x23262b, 0.9), boots: std(0x15130f, 0.8),
  vest: std(0xb7c43c, 0.6), band: std(0x9ea3a6, 0.35, 0.3), hat: std(0xe6e3d8, 0.45),
};
const _taper = new THREE.CylinderGeometry(1.3 / 1.85, 1, 1, 10, 1);
export function person(b, x, z, ry = 0, y0 = 0, vest = PERSON.vest) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const P = (dx, y, dz) => [x + dx * c + dz * s, y0 + y, z - dx * s + dz * c];
  const limb = (a, e, r, m) => b.strut(P(...a), P(...e), r, m, 8);
  for (const side of [-1, 1]) {
    limb([side * 0.1, 0.93, 0], [side * 0.105, 0.5, 0.025], 0.072, PERSON.trousers);
    limb([side * 0.105, 0.5, 0.025], [side * 0.11, 0.1, 0], 0.06, PERSON.trousers);
    b.box(0.12, 0.11, 0.27, PERSON.boots, ...P(side * 0.11, 0.055, 0.04), ry);
    // arms hang a little away from the body, elbows slightly bent forward
    limb([side * 0.215, 1.43, 0], [side * 0.255, 1.15, -0.01], 0.05, PERSON.shirt);
    limb([side * 0.255, 1.15, -0.01], [side * 0.25, 0.9, 0.07], 0.043, PERSON.shirt);
    b.add(new THREE.SphereGeometry(0.047, 8, 6), MAT.skin, ...P(side * 0.25, 0.87, 0.075));
  }
  b.box(0.34, 0.16, 0.2, PERSON.trousers, ...P(0, 0.92, 0), ry);
  // torso: a flattened taper, wide at the shoulders; the vest is a slightly larger shell over it
  b.add(_taper, PERSON.shirt, ...P(0, 1.21, 0), Math.PI, -ry, 0, 0.215, 0.56, 0.13);
  b.add(_taper, vest, ...P(0, 1.25, 0), Math.PI, -ry, 0, 0.228, 0.44, 0.142);
  b.add(_taper, PERSON.band, ...P(0, 1.12, 0), Math.PI, -ry, 0, 0.215, 0.05, 0.14);
  b.cyl(0.048, 0.1, MAT.skin, ...P(0, 1.52, 0), 8);
  b.add(new THREE.SphereGeometry(0.1, 12, 10), MAT.skin, ...P(0, 1.63, 0), 0, ry, 0, 1, 1.15, 1.05);
  b.add(new THREE.SphereGeometry(0.125, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), PERSON.hat, ...P(0, 1.675, 0.005), 0, ry, 0, 1, 0.8, 1.08);
  b.cyl(0.155, 0.016, PERSON.hat, ...P(0, 1.68, 0.02), 14);
  return b;
}

// ---------- spinning fans: one instanced mesh per scene, turned every frame ----------
// items: { p: [x, y, z], axis: 'x' | 'y' | 'z', r } in world units. Blades sit in the plane across the axis.
export function spinners(items, mat = MAT.darkSteel, { blades = 5, speed = 5 } = {}) {
  const parts = [];
  for (let i = 0; i < blades; i++) { const b = new THREE.BoxGeometry(0.92, 0.05, 0.24); b.translate(0.5, 0, 0); b.rotateX(0.35); b.rotateY(i * Math.PI * 2 / blades); parts.push(b); }
  parts.push(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 12));
  const geo = mergeGeometries(parts.map(g => g.toNonIndexed()));
  const m = new THREE.InstancedMesh(geo, mat, items.length);
  m.castShadow = false; m.receiveShadow = true;
  const base = { y: new THREE.Quaternion(), x: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2)), z: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)) };
  const spin = new THREE.Quaternion(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), M4 = new THREE.Matrix4(), up = new THREE.Vector3(0, 1, 0);
  const phase = items.map((_, i) => (i * 2.399) % (Math.PI * 2)), rate = items.map((_, i) => speed * (0.85 + ((i * 0.618) % 1) * 0.3));
  const update = t => {
    items.forEach((it, i) => {
      spin.setFromAxisAngle(up, t * rate[i] + phase[i]);
      q.copy(base[it.axis || 'y']).multiply(spin);
      M4.compose(p.set(...it.p), q, s.set(it.r, it.r, it.r)); m.setMatrixAt(i, M4);
    });
    m.instanceMatrix.needsUpdate = true;
  };
  update(0);
  return { mesh: m, update };
}
