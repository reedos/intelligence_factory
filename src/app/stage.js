// The 3D stage: renderer, one scene per scale, camera moves, the parts panel and pins, and the
// power / data / heat layers. Scenes are rebuilt from the model whenever the scenario changes.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
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
renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 1.75));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = quality.shadows;
renderer.shadowMap.type = THREE.PCFShadowMap;
const env = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;

export const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 1000);
export const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.08; controls.maxPolarAngle = Math.PI * 0.49;
controls.addEventListener('start', () => { tween = null; emit('user-camera'); });

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
function getComposer(i) {
  if (!composers[i]) {
    const b = getScene(i), c = new EffectComposer(renderer);
    c.addPass(new RenderPass(b.scene, camera));
    if (LOOK[i].ao && !mobile) {
      const ao = new GTAOPass(b.scene, camera, 1, 1);
      ao.blendIntensity = 0.75;
      ao.updateGtaoMaterial({ radius: LOOK[i].ao, distanceExponent: 1.5, thickness: 1, scale: 1, samples: 12 });
      c.addPass(ao);
    }
    c.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), LOOK[i].bloom, 0.42, LOOK[i].threshold));
    c.addPass(new OutputPass());
    composers[i] = c;
    sizeComposer(c);
  }
  return composers[i];
}
function disposeScene(b) {
  b.scene.traverse(o => {
    o.geometry?.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    mats.forEach(m => { Object.values(m).forEach(v => v?.isTexture && v.dispose()); m.dispose(); });
  });
}
function sizeComposer(c) { c.setSize(view.clientWidth, view.clientHeight); }
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
export function flyTo(pos, target, dur = 1.1) {
  if (reduced) dur = 0.01;
  tween = { p0: camera.position.clone(), t0: controls.target.clone(), p1: V(pos), t1: V(target), u: 0, dur };
}
function stepTween(dt) {
  if (!tween) return;
  tween.u = Math.min(1, tween.u + dt / tween.dur);
  const e = tween.u < 0.5 ? 4 * tween.u ** 3 : 1 - Math.pow(-2 * tween.u + 2, 3) / 2;
  camera.position.lerpVectors(tween.p0, tween.p1, e);
  controls.target.lerpVectors(tween.t0, tween.t1, e);
  if (tween.u >= 1) tween = null;
}
export function settle() { if (tween) { camera.position.copy(tween.p1); controls.target.copy(tween.t1); tween = null; controls.update(); } }

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
  $('card-s').innerHTML = p.specs.map(([k, v, b]) => `<div><dt>${k}</dt><dd>${v}</dd><span class="chip ${b}" title="${BASIS[b].label}">${BASIS[b].short}</span></div>`).join('');
  const go_ = $('card-go'); go_.hidden = p.drill === undefined;
  go_.textContent = p.drill > ui.scene ? 'Go inside →' : 'Go out ↑';
  go_.onclick = () => go(p.drill, id);
  if (fly) { const h = hotspotsFor(ui.scene)[id]; if (h?.view) flyTo(h.view.pos, h.view.target); }
  emit('select', { scene: ui.scene, id });
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
export async function go(i, fromId, { force = false, keepCamera = false } = {}) {
  if (busy) { queued = [i, fromId, { force, keepCamera }]; return; }   // the latest request runs when this switch lands
  if ((i === ui.scene && !force) || i < 0 || i >= BUILDERS.length) return;
  busy = true;
  const veil = $('veil');
  const same = i === ui.scene;
  if (ui.scene >= 0 && !same) {
    if (fromId) { const h = hotspotsFor(ui.scene)[fromId]; if (h) flyTo([h.pos[0] + (camera.position.x - h.pos[0]) * 0.15, h.pos[1] + (camera.position.y - h.pos[1]) * 0.15, h.pos[2] + (camera.position.z - h.pos[2]) * 0.15], h.pos, 0.55); }
    veil.textContent = ''; veil.classList.remove('off');
    await new Promise(r => setTimeout(r, reduced ? 0 : 420));
  }
  veil.textContent = `Building ${SCENES()[i].title.toLowerCase()}…`;
  if (!same) veil.classList.remove('off');
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const b = getScene(i); getComposer(i);
  ui.scene = i;
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

// a new scenario rebuilds every scene from the new model; the camera stays where it is
on('scenario', () => {
  built.forEach(b => b && disposeScene(b));
  composers.forEach(c => c?.dispose?.());
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
const tickers = new Set();
export const onTick = fn => { tickers.add(fn); return () => tickers.delete(fn); };
new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(view);
function loop(ts) {
  requestAnimationFrame(loop);
  timer.update(ts);
  const dt = Math.min(timer.getDelta(), 0.05);
  tickers.forEach(fn => fn(dt));
  if (!visible || document.hidden || ui.scene < 0 || !built[ui.scene]) return;
  t += reduced ? dt * 0.35 : dt;
  const b = built[ui.scene];
  for (const f of flowsFor(b)) f.update(t);
  b.update(t, dt);
  stepTween(dt);
  controls.update();
  fitDepthRange(b.camera);
  composers[ui.scene].render();
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
