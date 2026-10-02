// The power layer's "power draw" glow: a soft halo hugging the footprint of every part that draws electrical power,
// brighter and a little wider the more watts it draws (Reed, 10/02/2026, after the copper level's ACC redriver).
//
// One rule with heat (src/heat.js): powerWeight(watts, the largest in the view), log-compressed, so every 10× in
// watts is the same step in glow and rank order always holds within a view. Parts under HEAT_SCALE.minW (0.5 W) get
// no glow. Passive parts (fibers, MPO and cable assemblies as such, passive optics, heat sinks, cold plates,
// connectors) are never declared. ASSUMPTIONS['power-glow-scale'] in evidence.js states the rule for readers;
// power-glow.test.ts and scenes/power-glow.test.ts check it.
//
// A level declares its parts as `powerDraw` on what build() returns:
//   { id, part?, watts, at: [x, y, z], size: [a, b], normal?: [x, y, z], yaw?, margin?, fill?, volt?, variants? }
// `at` is the centre of the footprint on the surface the part sits on (or the face the halo lies behind), `size` the
// footprint along the plane's two axes (x and z for an upward normal), `normal` which way the surface faces (default
// up), `yaw` a turn of the footprint about that normal, `margin` how far the halo reaches past the footprint at full weight, `volt` a VOLT key when the part is fed
// at a different voltage from the level's own color, `fill` how much the inside glows (default 0.22: a halo under a
// part is hidden there anyway; a halo laid over a face sets it low so only the rim reads). One InstancedMesh draws a whole level: one draw call.
import * as THREE from 'three';
import { powerWeight } from './heat.js';
import { VOLT } from './data.js';

export const POWER_GLOW = {
  gain: 0.55,          // the brightest halo in a view, before tier boost (the ACC redriver's look at its weight)
  noBloomBoost: 1.35,  // tiers without bloom lose the bloom's spread, so the halo itself is brighter
  saverCut: 0.12,      // Battery saver and below: halos fainter than this (relative) are not drawn
  saverParticles: 0.6, // a tier at or under this particle budget is a saver tier
  pulse: 0.1,          // a slow breath, ±10%; none with reduced motion
};

// how one part's glow follows its weight: brightness and reach both grow as the square root, so their product (what
// the eye reads as "more glow") follows the weight itself
export function glowFor(watts, refWatts) {
  const w = powerWeight(watts, refWatts);
  if (!w) return null;
  const s = Math.sqrt(w);
  return { weight: w, gain: POWER_GLOW.gain * s, reach: 0.6 + 0.4 * s };
}

const VERT = `
attribute vec4 aRect;      // half extents a, b; margin; gain
attribute vec3 aColor;
attribute float aPhase;
attribute float aFill;
varying vec2 vP; varying vec4 vRect; varying vec3 vColor; varying float vPhase; varying float vFill;
void main() {
  vec2 ext = aRect.xy + aRect.z;
  vec3 local = vec3(position.x * ext.x, 0.0, position.z * ext.y);
  vP = local.xz; vRect = aRect; vColor = aColor; vPhase = aPhase; vFill = aFill;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(local, 1.0);
}`;
const FRAG = `
uniform float uTime, uPulse, uBoost;
varying vec2 vP; varying vec4 vRect; varying vec3 vColor; varying float vPhase; varying float vFill;
float sdBox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
void main() {
  vec2 half_ = vRect.xy; float m = vRect.z;
  float r = min(half_.x, half_.y) * 0.3;
  float d = sdBox(vP, half_, r);
  // outside: a soft falloff that hugs the outline and is gone by the margin; inside (mostly under the part): a rim
  // just inside the edge over a faint fill, so a part seen from above still reads as lit at its edge
  float a = d > 0.0 ? exp(-2.6 * d / m) * (1.0 - smoothstep(0.7 * m, m, d))
                    : mix(vFill, 1.0, exp(5.0 * d / max(1e-4, min(half_.x, half_.y))));
  float breath = 1.0 + uPulse * sin(uTime * 2.2 + vPhase);
  float k = a * vRect.w * breath * uBoost;
  if (k < 0.002) discard;
  gl_FragColor = vec4(vColor * k, 1.0);
}`;

const UP = new THREE.Vector3(0, 1, 0);
// The layer for one view. entries: the level's powerDraw. Returns null when nothing in the view draws power.
/** @param {any[]} entries @param {{ color?: string, reduced?: boolean, refWatts?: number, when?: () => boolean }} [opts] */
export function powerGlowLayer(entries, { color = '#8fd3ff', reduced = false, refWatts, when } = {}) {
  const ref = refWatts ?? Math.max(0, ...(entries || []).map(e => e.watts || 0));
  const parts = (entries || []).map(e => ({ ...e, glow: glowFor(e.watts, ref) })).filter(e => e.glow)
    .sort((a, b) => b.glow.weight - a.glow.weight);           // brightest first: a saver tier draws a prefix
  if (!parts.length) return null;
  const n = parts.length, geo = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
  const rect = new Float32Array(n * 4), col = new Float32Array(n * 3), phase = new Float32Array(n), fill = new Float32Array(n);
  const mat = new THREE.ShaderMaterial({
    name: 'Power draw glow', vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uPulse: { value: reduced ? 0 : POWER_GLOW.pulse }, uBoost: { value: 1 } },
  });
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  mesh.name = 'Power draw glow'; mesh.frustumCulled = false; mesh.renderOrder = 2; mesh.visible = false;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), qy = new THREE.Quaternion(), c = new THREE.Color(), one = new THREE.Vector3(1, 1, 1);
  parts.forEach((e, i) => {
    const [a, b] = e.size, m0 = e.margin ?? 0.4 * Math.sqrt(a * b);
    e.glow.margin = m0 * e.glow.reach;
    // turn the footprint about its normal first (yaw), then lay the plane on its surface
    q.setFromUnitVectors(UP, new THREE.Vector3(...(e.normal || [0, 1, 0])).normalize()).multiply(qy.setFromAxisAngle(UP, e.yaw || 0));
    mesh.setMatrixAt(i, m4.compose(new THREE.Vector3(...e.at), q, one));
    rect.set([a / 2, b / 2, e.glow.margin, e.glow.gain], i * 4);
    c.set(VOLT[e.volt]?.css ?? color).multiplyScalar(1.6);    // the ACC halo's color: the supply's color, lifted
    col.set([c.r, c.g, c.b], i * 3);
    fill[i] = e.fill ?? 0.22;                                 // a face seen head-on (rack fronts) keeps only its rim
    phase[i] = (i * 2.399) % (Math.PI * 2);                   // golden-angle offsets: neighbours never breathe in step
  });
  geo.setAttribute('aRect', new THREE.InstancedBufferAttribute(rect, 4));
  geo.setAttribute('aColor', new THREE.InstancedBufferAttribute(col, 3));
  geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
  geo.setAttribute('aFill', new THREE.InstancedBufferAttribute(fill, 1));
  mesh.instanceMatrix.needsUpdate = true;
  let drawn = n, active = n;
  return {
    mesh, parts, refWatts: ref,
    // tier: brighter where there is no bloom; in saver tiers the faintest halos go (they are sorted, so a prefix)
    setTier(t = {}) {
      mat.uniforms.uBoost.value = t.bloom === false ? POWER_GLOW.noBloomBoost : 1;
      const saver = (t.particles ?? 1) <= POWER_GLOW.saverParticles;
      drawn = saver ? parts.filter(p => p.glow.weight >= POWER_GLOW.saverCut).length : n;
      mesh.count = drawn;
    },
    get drawn() { return drawn; },
    // visible only in the power layer
    show(mode) { mesh.visible = mode === 'power' && drawn > 0 && active > 0 && (when ? !!when() : true); },
    update(t, mode) { this.show(mode); mat.uniforms.uTime.value = t; },
    // levels with variants (the module's DSP/LRO/LPO, the CPO's two packages) keep one reference for the level, so a
    // variant that draws less glows less; parts the variant does not have are switched off, not re-normalized
    setActive(pred) {
      active = 0;
      parts.forEach((p, i) => { const on = !!pred(p); p.off = !on; active += on; rect[i * 4 + 3] = on ? p.glow.gain : 0; });
      geo.attributes.aRect.needsUpdate = true;
    },
    dispose() { geo.dispose(); mat.dispose(); },
  };
}

// What stage.js does after a level is built (and what the scene tests do): add the layer for its powerDraw.
/** @param {any} built @param {{ color?: string, reduced?: boolean, mode?: string }} [opts] */
export function attachPowerGlow(built, { color, reduced = false, mode = 'power' } = {}) {
  if (built.powerGlow || !built.powerDraw?.length) return built.powerGlow || null;
  const layer = powerGlowLayer(built.powerDraw, { color, reduced, refWatts: built.powerDrawRef, when: built.powerDrawWhen });
  if (!layer) return null;
  (built.powerDrawParent || built.scene).add(layer.mesh);   // a parent that moves (an exploding board) carries its glow
  built.powerGlow = layer;
  built.powerDrawActive && layer.setActive(built.powerDrawActive);
  layer.update(0, mode);
  return layer;
}

// Where a part sits, from its meshes: the world bounding box of `obj`'s meshes that pass `keep` (by mesh centre),
// as a powerDraw placement on the surface under it. `into` converts to that object's local frame (the layer's parent).
const _b = new THREE.Box3(), _m = new THREE.Box3(), _v = new THREE.Vector3();
export function footprint(obj, { keep = () => true, into = null, lift = 0.004 } = {}) {
  obj.updateWorldMatrix(true, true);
  _b.makeEmpty();
  obj.traverse(o => {
    if (!o.isMesh) return;
    _m.setFromObject(o);
    if (!_m.isEmpty() && keep(_m.getCenter(_v))) _b.union(_m);
  });
  if (_b.isEmpty()) return null;
  const c = _b.getCenter(new THREE.Vector3()), at = new THREE.Vector3(c.x, _b.min.y + lift, c.z);
  if (into) { into.updateWorldMatrix(true, false); into.worldToLocal(at); }
  return { at: at.toArray(), size: [_b.max.x - _b.min.x, _b.max.z - _b.min.z] };
}

// Watts the model's power ledger puts on one level's part (sum of its rows linked there), for equipment whose glow is
// its conversion loss: transformers, UPS modules, solid-state transformers.
export const ledgerW = (M, scene, part) => (M?.ledger || []).filter(r => r.link?.scene === scene && r.link?.part === part).reduce((a, r) => a + r.mw * 1e6, 0);
