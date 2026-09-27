// The 3D stage: renderer, one scene per scale, camera moves, the parts panel and pins, and the
// power / data / heat layers. Scenes are rebuilt from the model whenever the scenario changes.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { DETAIL } from '../kit.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { VOLT, BASIS } from '../data.js';
import { store, on, emit } from './store.js';
import * as campus from '../scenes/campus.js';
import * as hall from '../scenes/hall.js';
import * as rack from '../scenes/rack.js';
import * as tray from '../scenes/tray.js';
import * as chip from '../scenes/chip.js';
import * as across from '../scenes/across.js';

const BUILDERS = [across, campus, hall, rack, tray, chip];
const LOOK = [   // per scene: bloom, ambient occlusion radius (world units, 0 = off), exposure
  { bloom: 0.8, threshold: 0.95, ao: 0, exposure: 1.0 },
  { bloom: 0.85, threshold: 0.86, ao: 0, exposure: 1.0 },
  { bloom: 0.5, threshold: 1.0, ao: 0.6, exposure: 1.0 },
  { bloom: 0.55, threshold: 1.0, ao: 0.06, exposure: 1.0 },
  { bloom: 0.55, threshold: 1.35, ao: 0.12, exposure: 0.95 },
  { bloom: 0.6, threshold: 1.7, ao: 0.15, exposure: 0.95 },
];
function legends(M) {
  const dc = M.power.id === 'dc800', nvl = M.accel.gpusPerRack === 72, warm = M.cooling.id === 'warm';
  const rackIn = dc ? ['hvdc', '800 V DC'] : ['lv', '415 V AC'];
  const speed = M.accel.nicGbps >= 1000 ? `${M.accel.nicGbps / 1000}T` : `${M.accel.nicGbps}G`;
  return {
    power: [
      [['hv', '345–500 kV grid']],
      [['hv', '345 kV'], ['mv', '34.5 kV']],
      [['mv', '34.5 kV'], dc ? ['hvdc', '800 V DC'] : ['lv', '480 / 415 V'], ['cool', 'Supply water'], ['warm', 'Return water']],
      nvl ? [rackIn, ['dc', '≈50 V DC'], ['cool', 'Supply'], ['warm', 'Return']] : [['lv', '415 V AC'], ['dc', '54 V DC, in the server']],
      nvl ? [['dc', '≈50 V'], ['bus12', '12 V'], ['core', '≈0.8 V'], ['cool', 'Supply'], ['warm', 'Return']] : [['lv', '240 V AC in'], ['dc', '54 V'], ['bus12', '12 V'], ['core', '≈0.8 V']],
      [['core', '≈0.8 V, rising']],
    ],
    data: [
      [['dci', 'DWDM routes']],
      M.halls > 1 ? [['dci', 'Long-haul fiber'], ['eth', 'Hall to hall']] : [['dci', 'Long-haul fiber']],
      [['eth', `Scale-out, ${speed} optical`]],
      nvl ? [['nvl', 'Scale-up, NVLink copper'], ['eth', 'Scale-out, optical']] : [['nvl', 'NVLink, inside one server'], ['eth', 'Scale-out, optical']],
      nvl ? [['nvl', 'NVLink'], ['c2c', 'NVLink-C2C'], ['eth', 'To the NIC and optics']] : [['nvl', 'NVLink'], ['pcie', 'PCIe'], ['eth', 'To the optics']],
      M.accel.dies > 1 ? [['hbm', 'HBM'], ['hbi', 'Die to die'], ['nvl', 'NVLink out']] : [['hbm', 'HBM'], ['nvl', 'NVLink out']],
    ],
    heat: [
      [['hv', 'Grid, for reference']],
      warm ? [['warm', 'Warm water up'], ['air', 'Warm air out'], ['vapor', 'Evaporation'], ['cool', 'Makeup water']] : [['warm', 'Return water'], ['cool', 'Chilled supply'], ['vapor', 'Evaporation']],
      [['cool', 'Supply water'], ['warm', 'Return water'], ['air', 'Hot air']],
      nvl ? (M.accel.liquidShare < 0.99 ? [['cool', 'Supply'], ['warm', 'Return'], ['air', 'Exhaust air']] : [['cool', 'Supply'], ['warm', 'Return']]) : [['cool', 'Cold air in'], ['air', 'Hot air out']],
      nvl ? [['hot', 'Heat into the plates'], ['cool', 'Supply'], ['warm', 'Return'], ['air', 'Fan air']] : [['hot', 'Heat into the sinks'], ['air', 'Air through the server']],
      [['hot', `Heat out of the ${M.accel.dies > 1 ? 'dies' : 'die'}`], ['air', 'Out of HBM']],
    ],
  };
}

const $ = id => document.getElementById(id);
const ui = store.ui;
const SCENES = () => store.C.SCENES;
const PARTS_BY = () => ({ power: store.C.PARTS, data: store.C.PARTS_DATA, heat: store.C.PARTS_HEAT });
// a scene variant may not draw every part (an air-cooled hall has no CDUs), so list only parts the scene placed
const partsFor = i => {
  const list = PARTS_BY()[ui.mode][SCENES()[i].id] || [];
  if (!built[i]) return list;
  const hs = hotspotsFor(i);
  return list.filter(p => hs[p.id]);
};
const hotspotsFor = i => (built[i] && { power: built[i].hotspots, data: built[i].dataHotspots, heat: built[i].heatHotspots }[ui.mode]) || {};
const voltFor = s => ui.mode === 'heat' ? { ...VOLT[s.heatVolt], short: s.heatShort, name: VOLT[s.heatVolt].name } : VOLT[ui.mode === 'data' ? s.dataVolt : s.volt];
const flowsFor = b => (ui.mode === 'data' ? b.dataFlows : ui.mode === 'heat' ? b.heatFlows : b.flows) || [];
export const mobile = matchMedia('(max-width: 760px), (pointer: coarse)').matches;
export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const quality = { shadows: !mobile, mobile };

// ---------- renderer ----------
const view = $('view'), canvas = $('gl');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
catch (e) { $('veil').textContent = 'This view needs WebGL, which this browser has turned off.'; throw e; }
const maxRatio = Math.min(devicePixelRatio, mobile ? 1.5 : 1.75);
let ratio = maxRatio;
renderer.setPixelRatio(ratio);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = quality.shadows;
renderer.shadowMap.type = THREE.PCFShadowMap;
const env = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;

export const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 1000);
export const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.08; controls.maxPolarAngle = Math.PI * 0.49;
controls.addEventListener('start', () => { tween = null; drift = null; emit('user-camera'); });

export const built = [], composers = [];
function getScene(i) {
  if (!built[i]) {
    const b = BUILDERS[i].build({ quality, state: ui, model: store.M });
    b.scene.environment = env; b.scene.environmentIntensity = 0.35; b.model = store.M;
    built[i] = b;
    applyMode(b);
  }
  return built[i];
}
// the finish: a gentle filmic grade, vignette and moving grain, applied after tone mapping (display space)
const FINISH = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uGrain: { value: 0.035 }, uVignette: { value: 0.32 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uGrain, uVignette; varying vec2 vUv;
    float hash(vec2 p) { p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      c = mix(c, c * c * (3.0 - 2.0 * c), 0.18);                        // a touch of contrast in the mids
      c *= vec3(1.0, 0.99, 0.975) + vec3(-0.01, 0.0, 0.02) * (1.0 - dot(c, vec3(0.333)));   // cool shadows, warm highlights
      float v = smoothstep(0.95, 0.25, length(vUv - 0.5) * 1.25);
      c *= mix(1.0 - uVignette, 1.0, v);
      c += (hash(vUv * 1024.0 + fract(uTime) * 97.0) - 0.5) * uGrain;
      gl_FragColor = vec4(c, 1.0);
    }`,
};
let finishes = [];
function getComposer(i) {
  if (!composers[i]) {
    // multisampled: thin struts, cables and fins stay clean instead of stair-stepping (phones keep the frame rate)
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: mobile ? 0 : 4 });
    const b = getScene(i), c = new EffectComposer(renderer, rt);
    c.addPass(new RenderPass(b.scene, camera));
    if (LOOK[i].ao && !mobile) {
      const ao = new GTAOPass(b.scene, camera, 1, 1);
      ao.blendIntensity = 0.75;
      ao.updateGtaoMaterial({ radius: LOOK[i].ao, distanceExponent: 1.5, thickness: 1, scale: 1, samples: 12 });
      c.addPass(ao);
    }
    c.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), LOOK[i].bloom, 0.42, LOOK[i].threshold));
    c.addPass(new OutputPass());
    const fin = new ShaderPass(FINISH); c.addPass(fin); finishes[i] = fin;
    composers[i] = c;
    sizeComposer(c);
  }
  return composers[i];
}
function disposeScene(b) {
  b.dispose?.();                                          // anything the scene holds outside its graph (cached textures)
  b.scene.traverse(o => {
    o.shadow?.dispose();                                  // a shadow-casting light owns a render target of its own
    o.geometry?.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    mats.forEach(m => { Object.values(m).forEach(v => v?.isTexture && v.dispose()); m.dispose(); });
  });
}
// EffectComposer.dispose frees only its own two targets; bloom and AO passes hold render targets of their own
function disposeComposer(c) { if (!c) return; c.passes.forEach(p => p.dispose?.()); c.dispose(); }
function sizeComposer(c) { c.setSize(view.clientWidth, view.clientHeight); }
// adaptive resolution: step the pixel ratio down when frames run slow, back up when there is room
const perf = { n: 0, sum: 0 };
function adapt(dt) {
  perf.n++; perf.sum += dt;
  if (perf.n < 90) return;
  const avg = perf.sum / perf.n; perf.n = 0; perf.sum = 0;
  const next = avg > 0.028 ? Math.max(0.75, ratio - 0.25) : avg < 0.015 ? Math.min(maxRatio, ratio + 0.25) : ratio;
  if (next !== ratio) { ratio = next; renderer.setPixelRatio(ratio); resize(); }
}
export const renderScale = () => ratio;
export const getRenderer = () => renderer;
function resize() {
  const w = view.clientWidth, h = view.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.fov = w / h < 0.9 ? 48 : 35; camera.updateProjectionMatrix();
  composers.forEach(c => c && sizeComposer(c));
}
new ResizeObserver(resize).observe(view);

// ---------- camera tween ----------
let tween = null;
const V = (a) => new THREE.Vector3(...a);
// ---------- framing a part: on screen, clear of the page's overlays, nothing solid in front of it ----------
// The views in the scene files are hand-set; scenario variants move geometry under them. So before flying to a part,
// check the preset: the part must land inside the clear middle of the view (not under the title, buttons, tour
// control or clock), and a ray from the camera to the part must not hit anything solid first. If either fails,
// re-aim toward the part, then swing the camera higher or around it until the line of sight is clear.
const _ray = new THREE.Raycaster(), _cam = new THREE.PerspectiveCamera();
function solidsOf(b) {
  if (!b._solids) {
    b._solids = [];
    b.scene.traverse(o => {
      if (!(o.isMesh || o.isInstancedMesh) || o.isSprite) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      if (mats.some(m => m && m.depthWrite !== false && !(m.transparent && m.opacity < 0.6))) b._solids.push(o);
    });
  }
  const shown = o => { for (let q = o; q; q = q.parent) if (!q.visible) return false; return true; };
  return b._solids.filter(shown);
}
function safeBox() {
  // the clear area in normalized device coordinates, from the overlays actually on screen
  const vr = view.getBoundingClientRect(), box = { x0: -0.82, x1: 0.82, y0: -0.8, y1: 0.8 };
  const toY = px => 1 - 2 * (px - vr.top) / vr.height;
  for (const sel of ['.hud.tl', '.hud.tr', '#tour-ctl', '#clock']) {
    const el = document.querySelector(sel); if (!el || el.hidden || getComputedStyle(el).display === 'none') continue;
    const r = el.getBoundingClientRect(); if (!r.width) continue;
    if (r.top - vr.top < vr.height / 2) box.y1 = Math.min(box.y1, toY(r.bottom + 14));   // overlay along the top
    else box.y0 = Math.max(box.y0, toY(r.top - 14));                                        // along the bottom
  }
  return box;
}
function onScreen(pos, target, part, box) {
  _cam.copy(camera); _cam.position.copy(pos); _cam.lookAt(target); _cam.updateMatrixWorld();
  const v = part.clone().project(_cam);
  return v.z < 1 && v.x > box.x0 && v.x < box.x1 && v.y > box.y0 && v.y < box.y1;
}
function clearLine(b, pos, part) {
  const d = part.clone().sub(pos), dist = d.length();
  _ray.set(pos, d.normalize()); _ray.near = 0; _ray.far = dist * 0.85;
  return _ray.intersectObjects(solidsOf(b), false).length === 0;
}
export function frame(b, h) {
  const part = V(h.pos), box = safeBox();
  let pos = V(h.view.pos), target = V(h.view.target);
  // 1. on screen: slide the aim toward the part until it lands in the clear area
  for (let k = 0.25; k <= 1.001 && !onScreen(pos, target, part, box); k += 0.25) target = V(h.view.target).lerp(part, k);
  if (clearLine(b, pos, part)) return { pos: pos.toArray(), target: target.toArray() };
  // 2. line of sight: orbit the camera about the aim point, keeping the distance
  const off = pos.clone().sub(target), s = new THREE.Spherical().setFromVector3(off);
  // higher first; then lower, to look in under something lifted (the tray's cold plates), never below the floor
  for (const dPhi of [-0.25, -0.5, -0.75, -1.0, 0.25, 0.45]) for (const dTheta of [0, 0.35, -0.35, 0.8, -0.8, 1.4, -1.4]) {
    const t = s.clone(); t.phi = Math.min(1.45, Math.max(0.12, t.phi + dPhi)); t.theta += dTheta;
    const p = target.clone().add(new THREE.Vector3().setFromSpherical(t));
    if (clearLine(b, p, part) && onScreen(p, target, part, box)) return { pos: p.toArray(), target: target.toArray() };
  }
  return { pos: pos.toArray(), target: target.toArray() };   // nothing clear found: keep the preset
}
// ---------- camera moves ----------
// Plain moves slide straight. Cinematic moves (tours) arc: the camera swings around the moving aim point,
// rising and pulling back mid-move, then settles into a slow orbit and push-in while the part is on screen.
let cinema = false, drift = null, driftSign = 1;
export const setCinema = on => { cinema = on; if (!on) drift = null; };
const ease = u => (u < 0.5 ? 4 * u ** 3 : 1 - Math.pow(-2 * u + 2, 3) / 2);
export function flyTo(pos, target, dur = 1.1) {
  drift = null;
  const p1 = V(pos), t1 = V(target);
  if (reduced) dur = 0.01;
  let arc = null;
  if (cinema && !reduced) {
    const s0 = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    const s1 = new THREE.Spherical().setFromVector3(p1.clone().sub(t1));
    let dTheta = s1.theta - s0.theta; dTheta -= Math.round(dTheta / (2 * Math.PI)) * 2 * Math.PI;   // the short way round
    const travel = controls.target.distanceTo(t1) / Math.max(s0.radius, s1.radius);
    arc = { s0, s1, dTheta, lift: Math.min(0.35, 0.12 + 0.25 * Math.min(1, travel)), pull: Math.min(0.45, 0.15 + 0.3 * Math.min(1, travel)) };
    dur = Math.min(3.4, Math.max(1.8, 1.6 + Math.abs(dTheta) * 0.6 + Math.abs(Math.log(s1.radius / s0.radius)) * 0.45 + travel * 0.6));
  }
  tween = { p0: camera.position.clone(), t0: controls.target.clone(), p1, t1, u: 0, dur, arc };
}
function stepTween(dt) {
  if (drift && !tween) stepDrift(dt);
  if (!tween) return;
  tween.u = Math.min(1, tween.u + dt / tween.dur);
  const e = ease(tween.u), a = tween.arc;
  controls.target.lerpVectors(tween.t0, tween.t1, e);
  if (a) {
    const bump = Math.sin(Math.PI * tween.u);
    const s = new THREE.Spherical(
      Math.exp(Math.log(a.s0.radius) + (Math.log(a.s1.radius) - Math.log(a.s0.radius)) * e) * (1 + a.pull * bump),
      Math.max(0.1, a.s0.phi + (a.s1.phi - a.s0.phi) * e - a.lift * bump),
      a.s0.theta + a.dTheta * e);
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(s));
  } else camera.position.lerpVectors(tween.p0, tween.p1, e);
  if (tween.u >= 1) {
    tween = null;
    if (cinema && !reduced) startDrift();
  }
}
// while a part is on screen: orbit a little and push in, if the part stays in clear view the whole way
function startDrift() {
  const s = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
  const b = built[ui.scene], h = ui.selected && hotspotsFor(ui.scene)[ui.selected], part = h ? V(h.pos) : controls.target.clone();
  driftSign = -driftSign;
  for (const sign of [driftSign, -driftSign]) {
    const end = s.clone(); end.theta += sign * 0.3; end.radius *= 0.9;
    const p = controls.target.clone().add(new THREE.Vector3().setFromSpherical(end));
    if (!b || clearLine(b, p, part)) { drift = { s0: s, dTheta: sign * 0.3, dR: -0.1, t: 0, dur: 16 }; return; }
  }
}
function stepDrift(dt) {
  drift.t = Math.min(drift.dur, drift.t + dt);
  const u = drift.t / drift.dur, e = u * u * (3 - 2 * u);
  const s = drift.s0.clone(); s.theta += drift.dTheta * e; s.radius *= 1 + drift.dR * e;
  camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(s));
  if (drift.t >= drift.dur) drift = null;
}
export function settle() { drift = null; if (tween) { camera.position.copy(tween.p1); controls.target.copy(tween.t1); tween = null; controls.update(); } }

// ---------- steps, panel, pins ----------
const stepsEl = $('steps');
for (let i = 0; i < BUILDERS.length; i++) {
  const b = document.createElement('button');
  b.className = 'step'; b.type = 'button';
  b.addEventListener('click', () => go(i));
  stepsEl.appendChild(b);
}
function renderSteps() {
  [...stepsEl.children].forEach((b, i) => {
    const s = SCENES()[i], v = voltFor(s);
    b.style.setProperty('--c', v.css);
    b.innerHTML = `<span class="top"><span class="n">${s.n}</span><span class="t">${s.title}</span></span><span class="meta"><span class="dot"></span><span>${v.short} · ${s.scale}</span></span>`;
    b.setAttribute('aria-label', `${s.n}. ${s.title}, ${v.name}`);
    if (i === ui.scene) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
  });
}

// ---------- power / data / heat layer ----------
function applyMode(b) {
  const m = ui.mode;
  (b.flows || []).forEach(f => (f.group.visible = m === 'power'));
  (b.dataFlows || []).forEach(f => (f.group.visible = m === 'data'));
  (b.heatFlows || []).forEach(f => (f.group.visible = m === 'heat'));
  if (b.layers?.power) b.layers.power.visible = m !== 'data';
  if (b.layers?.data) b.layers.data.visible = m === 'data';
}
export function setMode(m) {
  if (m === ui.mode) return;
  ui.mode = m;
  document.querySelectorAll('[data-mode]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.mode === m)));
  document.body.dataset.mode = m;
  built.forEach(b => b && applyMode(b));
  renderSteps();
  if (ui.scene >= 0 && built[ui.scene]) buildPanel(ui.scene);
  emit('mode', m);
}
document.querySelectorAll('[data-mode]').forEach(x => x.addEventListener('click', () => setMode(x.dataset.mode)));

const pinsEl = $('pins');
let pins = [];
function buildPanel(i) {
  const s = SCENES()[i], parts = partsFor(i);
  $('intro').textContent = { power: s.intro, data: s.dataIntro, heat: s.heatIntro }[ui.mode];
  $('hud-title').textContent = `${s.n}. ${s.title}`;
  $('hud-sub').textContent = `${voltFor(s).name} · ${s.scale}`;
  const list = $('parts'); list.innerHTML = '';
  parts.forEach((p, n) => {
    const li = document.createElement('li'), b = document.createElement('button');
    b.type = 'button'; b.dataset.id = p.id; b.setAttribute('aria-pressed', 'false');
    b.innerHTML = `<span class="pn">${n + 1}</span><span class="pt">${p.title}</span><span class="pk">${p.drill === undefined ? '' : p.drill > i ? 'inside →' : 'out ↑'}</span>`;
    b.addEventListener('click', () => select(p.id, true));
    li.appendChild(b); list.appendChild(li);
  });
  pinsEl.innerHTML = '';
  const hs = hotspotsFor(i);
  pins = parts.filter(p => hs[p.id]).map((p) => {
    const el = document.createElement('button');
    el.type = 'button'; el.className = 'pin'; el.dataset.id = p.id;
    el.innerHTML = `<span class="num">${parts.indexOf(p) + 1}</span><span class="lbl">${p.title}</span>`;
    el.setAttribute('aria-label', p.title);
    el.addEventListener('click', () => select(p.id, true));
    pinsEl.appendChild(el);
    return { el, id: p.id, pos: V(hs[p.id].pos) };
  });
  $('legend').innerHTML = legends(store.M)[ui.mode][i].map(([k, l]) => `<span class="legend-item" style="--c:${VOLT[k].css}"><span class="sw"></span>${l}</span>`).join('');
  [...stepsEl.children].forEach((b, n) => { if (n === i) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
  $('card').hidden = true; ui.selected = null;
}
export function select(id, fly) {
  const parts = partsFor(ui.scene), p = parts.find(q => q.id === id); if (!p) return;
  ui.selected = id;
  document.querySelectorAll('#parts button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === id)));
  pins.forEach(pn => pn.el.classList.toggle('on', pn.id === id));
  $('card').hidden = false;
  $('card-k').textContent = p.kicker; $('card-t').textContent = p.title; $('card-b').textContent = p.body;
  const src = `${ui.mode}:${SCENES()[ui.scene].id}:${id}`;
  $('card-s').innerHTML = p.specs.map(([k, v, b]) => `<div><dt>${k}</dt><dd>${v}</dd><button type="button" class="chip ${b}" data-src="${src}" aria-expanded="false" aria-label="${BASIS[b].label}: sources">${BASIS[b].short}</button></div>`).join('');
  const go_ = $('card-go'); go_.hidden = p.drill === undefined;
  go_.textContent = p.drill > ui.scene ? 'Go inside →' : 'Go out ↑';
  go_.onclick = () => go(p.drill, id);
  if (fly) { const h = hotspotsFor(ui.scene)[id]; if (h?.view) { const f = frame(built[ui.scene], h); flyTo(f.pos, f.target); } }
  emit('select', { scene: ui.scene, mode: ui.mode, id });
}
export function deselect() {
  ui.selected = null; $('card').hidden = true;
  pins.forEach(p => p.el.classList.remove('on'));
  document.querySelectorAll('#parts button').forEach(b => b.setAttribute('aria-pressed', 'false'));
}
$('card-next').addEventListener('click', () => cycle(1));
export function cycle(d) {
  const parts = partsFor(ui.scene);
  const i = parts.findIndex(p => p.id === ui.selected);
  const n = (i + d + parts.length) % parts.length;
  select(parts[n].id, true);
}
export const hasPart = (scene, id, mode = ui.mode) => !!(PARTS_BY()[mode][SCENES()[scene].id] || []).find(p => p.id === id);

// ---------- scene switching ----------
let busy = false, queued = null;
export async function go(i, fromId, { force = false, keepCamera = false, fromShow = false } = {}) {
  if (!force && !fromShow) showSeq++;                      // the reader moved: drop any jump still waiting for its scene
  if (busy) { queued = [i, fromId, { force, keepCamera }]; return; }   // the latest request runs when this switch lands
  if ((i === ui.scene && !force) || i < 0 || i >= BUILDERS.length) return;
  busy = true;
  const veil = $('veil');
  const same = i === ui.scene;
  if (ui.scene >= 0 && !same) {
    if (fromId) { const h = hotspotsFor(ui.scene)[fromId]; if (h) flyTo([h.pos[0] + (camera.position.x - h.pos[0]) * 0.15, h.pos[1] + (camera.position.y - h.pos[1]) * 0.15, h.pos[2] + (camera.position.z - h.pos[2]) * 0.15], h.pos, 0.55); }
    veil.textContent = ''; veil.classList.remove('off');
    await new Promise(r => setTimeout(r, reduced ? 0 : cinema && fromId ? 950 : 420));   // a tour pushes in before the cut
  }
  veil.textContent = `Building ${SCENES()[i].title.toLowerCase()}…`;
  if (!same) veil.classList.remove('off');
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const b = getScene(i); getComposer(i);
  ui.scene = i;
  DETAIL.unit.value = SCENES()[i].unit;                   // surface detail at this scale's real size
  if (mobile) built.forEach((bb, j) => { if (bb && Math.abs(j - i) > 1) { disposeScene(bb); disposeComposer(composers[j]); built[j] = undefined; composers[j] = undefined; } });
  const c = b.camera;
  camera.near = c.near; camera.far = c.far; camera.updateProjectionMatrix();
  controls.minDistance = c.min; controls.maxDistance = c.max;
  renderer.toneMappingExposure = LOOK[i].exposure;
  if (!keepCamera) {
    // arrive pushed in, then pull back to the scene's opening view; portrait screens get closer
    const tgt = V(c.target), end = view.clientWidth / view.clientHeight < 0.9 ? tgt.clone().lerp(V(c.pos), 0.72) : V(c.pos), start = tgt.clone().lerp(end, 0.35);
    camera.position.copy(start); controls.target.copy(tgt); controls.update();
    flyTo(end.toArray(), c.target, 1.6);
  }
  buildPanel(i);
  renderSteps();
  resize();
  veil.classList.add('off');
  busy = false;
  emit('scene', i);
  if (queued) { const q = queued; queued = null; go(...q); }
  else if (built[ui.scene]?.model !== store.M) go(ui.scene, null, { force: true, keepCamera: true });   // the scenario changed mid-switch
}
export const sceneCount = BUILDERS.length;
export const isBusy = () => busy;

// Jump to a part from anywhere on the page: switch layer, change scene if needed, select it and pulse its pin.
const until = (f, ms = 30000) => new Promise(r => { const t0 = performance.now(); const tick = () => (f() || performance.now() - t0 > ms ? r() : requestAnimationFrame(tick)); tick(); });
let showSeq = 0;
export async function show({ scene, mode, part }, { scroll = true, still = () => true } = {}) {
  const my = ++showSeq, live = () => my === showSeq && still();
  if (scroll) $('view').closest('.stage').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  if (mode && mode !== ui.mode) setMode(mode);
  if (scene !== ui.scene || !built[scene]) { go(scene, cinema ? ui.selected : null, { fromShow: true }); await until(() => !live() || (ui.scene === scene && !busy && !!built[scene])); }
  if (!live()) return;                                   // a newer jump, or the reader, took over while this scene was building
  if (mode && mode !== ui.mode) setMode(mode);
  if (part) { select(part, true); beacon(part); }
  else { deselect(); const c = built[scene].camera; flyTo(c.pos, c.target, 1.6); }   // the establishing shot
}
function beacon(id) {
  const pin = pins.find(p => p.id === id); if (!pin) return;
  pin.el.classList.remove('beacon'); void pin.el.offsetWidth; pin.el.classList.add('beacon');
  setTimeout(() => pin.el.classList.remove('beacon'), 2600);
}

// a new scenario rebuilds every scene from the new model; the camera stays where it is
on('scenario', () => {
  built.forEach(b => b && disposeScene(b));
  composers.forEach(disposeComposer);
  built.length = 0; composers.length = 0;
  renderSteps();
  if (ui.scene >= 0) go(ui.scene, null, { force: true, keepCamera: true });
});

// ---------- scale bar ----------
function updateScale() {
  const s = SCENES()[ui.scene]; if (!s) return;
  const d = camera.position.distanceTo(controls.target);
  const mPerPx = 2 * d * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / view.clientHeight * s.unit;
  const target = mPerPx * 110, pow = Math.pow(10, Math.floor(Math.log10(target)));
  const nice = [1, 2, 5, 10].map(k => k * pow).reduce((a, b) => Math.abs(b - target) < Math.abs(a - target) ? b : a);
  const px = nice / mPerPx;
  $('scale-bar').style.width = `${px.toFixed(0)}px`;
  $('scale-label').textContent = nice >= 1000 ? `${nice / 1000} km` : nice >= 1 ? `${nice} m` : nice >= 0.01 ? `${+(nice * 100).toFixed(2)} cm` : `${+(nice * 1000).toFixed(2)} mm`;
}

// ---------- pins ----------
const pv = new THREE.Vector3();
function updatePins() {
  const w = view.clientWidth, h = view.clientHeight, placed = [];
  for (const p of pins) {
    pv.copy(p.pos).project(camera);
    const x = (pv.x + 1) / 2 * w, y = (1 - pv.y) / 2 * h;
    const off = pv.z > 1 || x < 6 || x > w - 6 || y < 6 || y > h - 6;
    p.el.classList.toggle('off', off);
    if (off) continue;
    p.el.style.transform = `translate(${(x - 11).toFixed(1)}px, ${(y - 11).toFixed(1)}px)`;
    p.el.classList.toggle('flip', x > w - ((p.lw ||= p.el.querySelector('.lbl').offsetWidth) || 120) - 40);   // label goes left near the right edge
    const crowded = placed.some(q => Math.abs(q[0] - x) < 130 && Math.abs(q[1] - y) < 20);
    p.el.classList.toggle('hide-lbl', crowded && p.id !== ui.selected);
    placed.push([x, y]);
  }
}

// ---------- depth range ----------
// A fixed near plane far closer than anything in view wastes depth precision, and hidden
// surfaces then bleed through and flicker (z-fighting). Keep near at about 1% of the
// distance to what the camera is looking at.
function fitDepthRange(c) {
  const near = Math.max(c.near, camera.position.distanceTo(controls.target) * 0.01);
  if (Math.abs(near - camera.near) / camera.near > 0.05) { camera.near = near; camera.updateProjectionMatrix(); }
}

// ---------- loop ----------
const timer = new THREE.Timer();
let visible = true, t = 0, frameN = 0;
// ---------- the clock drives the flows: null means steady state ----------
let levels = null, levelsWere = null;
export const setLevels = L => { levels = L; };
const POWERISH = new Set(['lv', 'hvdc', 'dc', 'bus12', 'core']);
function applyLevels(b) {
  if (!levels && !levelsWere) return;
  const L = levels, heat = ui.mode === 'heat';
  if (!L) {                                               // clock closed: put every flow in every scene back
    built.forEach(bb => bb && [bb.flows, bb.dataFlows, bb.heatFlows].forEach(list => list?.forEach(f => f.setLevel?.(1, 1))));
    levelsWere = null; return;
  }
  for (const f of flowsFor(b)) {
    if (!f.setLevel) continue;
    if (f.role === 'standby') f.setLevel(L.standby > 0 ? 5 : 1, L.standby > 0 ? 2.8 : 1);
    else if (heat) f.setLevel(f.cls === 'vapor' ? L.vapor : L.cool);
    else if (f.cls === 'hv') f.setLevel(L.grid);
    else if (f.cls === 'mv') f.setLevel(L.mv);
    else if (POWERISH.has(f.cls) && ui.mode === 'power') f.setLevel(Math.max(0.08, L.load));
    else f.setLevel(1);
  }
  levelsWere = L;
}

const tickers = new Set();
export const onTick = fn => { tickers.add(fn); return () => tickers.delete(fn); };
new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(view);
function loop(ts) {
  requestAnimationFrame(loop);
  timer.update(ts);
  const raw = timer.getDelta(), dt = Math.min(raw, 0.05);
  tickers.forEach(fn => fn(dt));
  if (!visible || document.hidden || ui.scene < 0 || !built[ui.scene]) return;
  t += reduced ? dt * 0.35 : dt;
  const b = built[ui.scene];
  applyLevels(b);
  for (const f of flowsFor(b)) f.update(t);
  b.update(t, dt);
  stepTween(dt);
  controls.update();
  fitDepthRange(b.camera);
  if (finishes[ui.scene]) finishes[ui.scene].uniforms.uTime.value = t;
  composers[ui.scene].render();
  if (!tween && !navigator.webdriver) adapt(raw);        // judge speed on steady frames; test browsers render in software
  updatePins();
  if (frameN++ % 6 === 0) updateScale();
}

addEventListener('keydown', e => {
  if (e.target.matches('input, textarea, select')) return;
  if (e.key >= '1' && e.key <= '6') go(+e.key - 1);
  else if ('pdhPDH'.includes(e.key) && e.key.length === 1) setMode({ p: 'power', d: 'data', h: 'heat' }[e.key.toLowerCase()]);
  else if (e.key === 'ArrowRight') { cycle(1); e.preventDefault(); }
  else if (e.key === 'ArrowLeft') { cycle(-1); e.preventDefault(); }
  else if (e.key === 'Escape') deselect();
});

export function start() {
  renderSteps();
  resize();
  return go(0).then(() => requestAnimationFrame(loop));
}
