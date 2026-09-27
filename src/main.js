import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SCENES, PARTS, PARTS_DATA, PARTS_HEAT, TEMPS, PARALLEL, VOLT, BASIS, LEDGER, LEDGER_END, LEDGER_MARKS, STAIRCASE, BANDWIDTH, BOM, CAMPUS, IT_MW, GPUS, RACKS, NET, FABRIC } from './data.js';
import * as campus from './scenes/campus.js';
import * as hall from './scenes/hall.js';
import * as rack from './scenes/rack.js';
import * as tray from './scenes/tray.js';
import * as chip from './scenes/chip.js';
import * as across from './scenes/across.js';

const BUILDERS = [across, campus, hall, rack, tray, chip];
const LOOK = [   // per scene: bloom, ambient occlusion radius (world units, 0 = off), exposure
  { bloom: 0.8, threshold: 0.95, ao: 0, exposure: 1.0 },
  { bloom: 0.85, threshold: 0.86, ao: 0, exposure: 1.0 },
  { bloom: 0.5, threshold: 1.0, ao: 0.6, exposure: 1.0 },
  { bloom: 0.55, threshold: 1.0, ao: 0.06, exposure: 1.0 },
  { bloom: 0.55, threshold: 1.35, ao: 0.12, exposure: 0.95 },
  { bloom: 0.6, threshold: 1.7, ao: 0.15, exposure: 0.95 },
];
const LEGENDS_DATA = [
  [['dci', 'DWDM routes']],
  [['dci', 'Long-haul fiber'], ['eth', 'Hall to hall']],
  [['eth', 'Scale-out, 800G optical']],
  [['nvl', 'Scale-up, NVLink copper'], ['eth', 'Scale-out, optical']],
  [['nvl', 'NVLink'], ['c2c', 'NVLink-C2C'], ['eth', 'To the NIC and optics']],
  [['hbm', 'HBM'], ['hbi', 'Die to die'], ['nvl', 'NVLink out']],
];
const LEGENDS_HEAT = [
  [['hv', 'Grid, for reference']],
  [['warm', 'Warm water up'], ['air', 'Warm air out'], ['vapor', 'Evaporation'], ['cool', 'Makeup water']],
  [['cool', 'Supply water'], ['warm', 'Return water'], ['air', 'Hot air']],
  [['cool', 'Supply'], ['warm', 'Return'], ['air', 'Exhaust air']],
  [['hot', 'Heat into the plates'], ['cool', 'Supply'], ['warm', 'Return'], ['air', 'Fan air']],
  [['hot', 'Heat out of the dies'], ['air', 'Out of HBM']],
];
const LEGENDS = [
  [['hv', '345–500 kV grid']],
  [['hv', '345 kV'], ['mv', '34.5 kV']],
  [['mv', '34.5 kV'], ['lv', '480 / 415 V'], ['cool', 'Supply water'], ['warm', 'Return water']],
  [['lv', '415 V AC'], ['dc', '≈50 V DC'], ['cool', 'Supply'], ['warm', 'Return']],
  [['dc', '≈50 V'], ['bus12', '12 V'], ['core', '≈0.8 V'], ['cool', 'Supply'], ['warm', 'Return']],
  [['core', '≈0.8 V, rising']],
];

const $ = id => document.getElementById(id);
const fmt = (n, d = 0) => n.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
const state = { scene: -1, selected: null, tokPerGpu: 2000, pue: CAMPUS.pue, mode: 'power' };
const PARTS_BY = { power: PARTS, data: PARTS_DATA, heat: PARTS_HEAT };
const partsFor = i => PARTS_BY[state.mode][SCENES[i].id];
const hotspotsFor = i => ({ power: built[i].hotspots, data: built[i].dataHotspots, heat: built[i].heatHotspots })[state.mode] || {};
const voltFor = s => state.mode === 'heat' ? { ...VOLT[s.heatVolt], short: s.heatShort, name: VOLT[s.heatVolt].name } : VOLT[state.mode === 'data' ? s.dataVolt : s.volt];
const flowsFor = b => (state.mode === 'data' ? b.dataFlows : state.mode === 'heat' ? b.heatFlows : b.flows) || [];
const mobile = matchMedia('(max-width: 760px), (pointer: coarse)').matches;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const quality = { shadows: !mobile, mobile };

// ---------- renderer ----------
const view = $('view'), canvas = $('gl');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
catch (e) { $('veil').textContent = 'This view needs WebGL, which this browser has turned off.'; throw e; }
renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 1.75));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = quality.shadows;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const env = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 1000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.08; controls.maxPolarAngle = Math.PI * 0.49;
controls.addEventListener('start', () => { tween = null; });

const built = [], composers = [];
function getScene(i) {
  if (!built[i]) {
    const b = BUILDERS[i].build({ quality, state });
    b.scene.environment = env; b.scene.environmentIntensity = 0.35;
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
function flyTo(pos, target, dur = 1.1) {
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

// ---------- steps, panel, pins ----------
const stepsEl = $('steps');
SCENES.forEach((s, i) => {
  const b = document.createElement('button');
  b.className = 'step'; b.type = 'button';
  b.addEventListener('click', () => go(i));
  stepsEl.appendChild(b);
});
function renderSteps() {
  [...stepsEl.children].forEach((b, i) => {
    const s = SCENES[i], v = voltFor(s);
    b.style.setProperty('--c', v.css);
    b.innerHTML = `<span class="top"><span class="n">${s.n}</span><span class="t">${s.title}</span></span><span class="meta"><span class="dot"></span><span>${v.short} · ${s.scale}</span></span>`;
    b.setAttribute('aria-label', `${s.n}. ${s.title}, ${v.name}`);
    if (i === state.scene) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
  });
}
renderSteps();

// ---------- power / data layer ----------
function applyMode(b) {
  const m = state.mode;
  (b.flows || []).forEach(f => (f.group.visible = m === 'power'));
  (b.dataFlows || []).forEach(f => (f.group.visible = m === 'data'));
  (b.heatFlows || []).forEach(f => (f.group.visible = m === 'heat'));
  if (b.layers?.power) b.layers.power.visible = m !== 'data';
  if (b.layers?.data) b.layers.data.visible = m === 'data';
}
function setMode(m) {
  if (m === state.mode) return;
  state.mode = m;
  document.querySelectorAll('[data-mode]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.mode === m)));
  document.body.dataset.mode = m;
  built.forEach(b => b && applyMode(b));
  renderSteps();
  if (state.scene >= 0) buildPanel(state.scene);
}
document.querySelectorAll('[data-mode]').forEach(x => x.addEventListener('click', () => setMode(x.dataset.mode)));

const pinsEl = $('pins');
let pins = [];
function buildPanel(i) {
  const s = SCENES[i], parts = partsFor(i);
  $('intro').textContent = { power: s.intro, data: s.dataIntro, heat: s.heatIntro }[state.mode];
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
  $('legend').innerHTML = ({ power: LEGENDS, data: LEGENDS_DATA, heat: LEGENDS_HEAT }[state.mode])[i].map(([k, l]) => `<span class="legend-item" style="--c:${VOLT[k].css}"><span class="sw"></span>${l}</span>`).join('');
  [...stepsEl.children].forEach((b, n) => { if (n === i) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
  $('card').hidden = true; state.selected = null;
  highlightLedger(i);
}
function select(id, fly) {
  const parts = partsFor(state.scene), p = parts.find(q => q.id === id); if (!p) return;
  state.selected = id;
  document.querySelectorAll('#parts button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === id)));
  pins.forEach(pn => pn.el.classList.toggle('on', pn.id === id));
  $('card').hidden = false;
  $('card-k').textContent = p.kicker; $('card-t').textContent = p.title; $('card-b').textContent = p.body;
  $('card-s').innerHTML = p.specs.map(([k, v, b]) => `<div><dt>${k}</dt><dd>${v}</dd><span class="chip ${b}" title="${BASIS[b].label}">${BASIS[b].short}</span></div>`).join('');
  const go_ = $('card-go'); go_.hidden = p.drill === undefined;
  go_.textContent = p.drill > state.scene ? 'Go inside →' : 'Go out ↑';
  go_.onclick = () => go(p.drill, id);
  if (fly) { const h = hotspotsFor(state.scene)[id]; if (h?.view) flyTo(h.view.pos, h.view.target); }
}
$('card-next').addEventListener('click', () => cycle(1));
function cycle(d) {
  const parts = partsFor(state.scene);
  const i = parts.findIndex(p => p.id === state.selected);
  const n = (i + d + parts.length) % parts.length;
  select(parts[n].id, true);
}

// ---------- scene switching ----------
let busy = false;
async function go(i, fromId) {
  if (busy || i === state.scene || i < 0 || i >= SCENES.length) return;
  busy = true;
  const veil = $('veil');
  if (state.scene >= 0) {
    if (fromId) { const h = hotspotsFor(state.scene)[fromId]; if (h) flyTo([h.pos[0] + (camera.position.x - h.pos[0]) * 0.15, h.pos[1] + (camera.position.y - h.pos[1]) * 0.15, h.pos[2] + (camera.position.z - h.pos[2]) * 0.15], h.pos, 0.55); }
    veil.textContent = ''; veil.classList.remove('off');
    await new Promise(r => setTimeout(r, reduced ? 0 : 420));
  }
  veil.textContent = `Building ${SCENES[i].title.toLowerCase()}…`;
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const b = getScene(i); getComposer(i);
  state.scene = i;
  const c = b.camera;
  camera.near = c.near; camera.far = c.far; camera.updateProjectionMatrix();
  controls.minDistance = c.min; controls.maxDistance = c.max;
  renderer.toneMappingExposure = LOOK[i].exposure;
  // arrive pushed in, then pull back to the scene's opening view
  // portrait screens get closer: the scene is width-limited there
  const tgt = V(c.target), end = view.clientWidth / view.clientHeight < 0.9 ? tgt.clone().lerp(V(c.pos), 0.72) : V(c.pos), start = tgt.clone().lerp(end, 0.35);
  camera.position.copy(start); controls.target.copy(tgt); controls.update();
  flyTo(end.toArray(), c.target, 1.6);
  buildPanel(i);
  renderSteps();
  resize();
  veil.classList.add('off');
  busy = false;
}

// ---------- scale bar ----------
function updateScale() {
  const s = SCENES[state.scene]; if (!s) return;
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
    p.el.classList.toggle('hide-lbl', crowded && p.id !== state.selected);
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
new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(view);
function loop(ts) {
  requestAnimationFrame(loop);
  timer.update(ts);
  const dt = Math.min(timer.getDelta(), 0.05);
  if (!visible || document.hidden || state.scene < 0) return;
  t += reduced ? dt * 0.35 : dt;
  const b = built[state.scene];
  for (const f of flowsFor(b)) f.update(t);
  b.update(t, dt);
  stepTween(dt);
  controls.update();
  fitDepthRange(b.camera);
  composers[state.scene].render();
  updatePins();
  if (frameN++ % 6 === 0) updateScale();
}

addEventListener('keydown', e => {
  if (e.target.matches('input, textarea')) return;
  if (e.key >= '1' && e.key <= '6') go(+e.key - 1);
  else if ('pdhPDH'.includes(e.key) && e.key.length === 1) setMode({ p: 'power', d: 'data', h: 'heat' }[e.key.toLowerCase()]);
  else if (e.key === 'ArrowRight') { cycle(1); e.preventDefault(); }
  else if (e.key === 'ArrowLeft') { cycle(-1); e.preventDefault(); }
  else if (e.key === 'Escape') { state.selected = null; $('card').hidden = true; pins.forEach(p => p.el.classList.remove('on')); document.querySelectorAll('#parts button').forEach(b => b.setAttribute('aria-pressed', 'false')); }
});

// ---------- ledger ----------
const KIND = { loss: 'var(--loss)', overhead: 'var(--overhead)', work: 'var(--work)', net: 'var(--net)' };
const SCENE_VOLT = ['hv', 'mv', 'lv', 'dc', 'bus12', 'core'];
function renderLedger() {
  const rows = [];
  let rem = CAMPUS.meterMW;
  const row = (cls, label, chip, bar, mw, sceneI) => rows.push(`<div class="lg-row ${cls}" data-scene="${sceneI ?? ''}"><div class="lab"><span>${label}</span>${chip}</div>${bar}<div class="mw ${cls.includes('minus') ? 'minus' : ''}">${mw}</div></div>`);
  const trunk = (mw, cut, kind, v) => `<div class="bar" style="--c:${VOLT[v].css}"><div class="rem" style="width:${(mw - (cut || 0)) / CAMPUS.meterMW * 100}%"></div>${cut ? `<div class="cut" style="--k:${KIND[kind]};left:${(mw - cut) / CAMPUS.meterMW * 100}%;width:${cut / CAMPUS.meterMW * 100}%"></div>` : ''}</div>`;
  row('mark', 'At the campus meter', '', trunk(rem, 0, null, 'hv'), `${fmt(rem, 1)} MW`, 1);
  LEDGER.forEach((l, i) => {
    row('minus', l.label, `<span class="chip ${l.basis}">${BASIS[l.basis].short}</span>`, trunk(rem, l.mw, l.kind, SCENE_VOLT[l.scene]), `−${fmt(l.mw, 1)}`, l.scene);
    rem -= l.mw;
    const mark = LEDGER_MARKS.find(m => m.after === i);
    if (mark) row('mark', mark.label === 'IT load (PUE 1.2)' ? `IT load, PUE ${CAMPUS.pue}` : mark.label, '', trunk(rem, 0, null, SCENE_VOLT[Math.min(5, (LEDGER[i + 1] || l).scene)]), `${fmt(rem, 1)} MW`, l.scene);
  });
  row('mark end', `${LEDGER_END.label} <span style="color:var(--muted);font-weight:400">· ${LEDGER_END.sub}</span>`, '', trunk(rem, 0, null, 'core'), `${fmt(rem, 1)} MW`, 5);
  $('ledger').innerHTML = rows.join('');
}
function highlightLedger(i) { document.querySelectorAll('.lg-row').forEach(r => r.classList.toggle('here', r.dataset.scene === String(i) && r.classList.contains('minus'))); }

// ---------- staircase chart ----------
function renderStairs() {
  const svg = $('stairs'), W = 1000, H = 380, L = 70, R = 24, T = 52, B = 130;
  const lo = Math.log10(0.5), hi = Math.log10(600000);
  const y = v => T + (hi - Math.log10(v)) / (hi - lo) * (H - T - B);
  const n = STAIRCASE.length, cw = (W - L - R) / n;
  let out = '';
  [1, 10, 100, 1000, 10000, 100000].forEach(v => {
    out += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#222b38" stroke-width="1"/>`;
    out += `<text x="${L - 10}" y="${y(v) + 4}" text-anchor="end" fill="#6b747c" font-family="IBM Plex Mono, monospace" font-size="12">${v >= 1000 ? v / 1000 + ' kV' : v + ' V'}</text>`;
  });
  STAIRCASE.forEach((s, i) => {
    const x0 = L + i * cw, x1 = x0 + cw, yy = y(s.v), c = VOLT[s.volt].css;
    out += `<rect x="${x0 + 3}" y="${yy}" width="${cw - 6}" height="${H - B - yy}" fill="${c}" fill-opacity="0.12"/>`;
    out += `<line x1="${x0 + 3}" x2="${x1 - 3}" y1="${yy}" y2="${yy}" stroke="${c}" stroke-width="3" stroke-linecap="round"/>`;
    if (i < n - 1) { const ny = y(STAIRCASE[i + 1].v); out += `<line x1="${x1 - 3}" x2="${x1 + 3}" y1="${yy}" y2="${ny}" stroke="#6b747c" stroke-width="1.5" stroke-dasharray="3 3"/>`; }
    out += `<text x="${x0 + cw / 2}" y="${yy - 10}" text-anchor="middle" fill="${c}" font-family="IBM Plex Mono, monospace" font-weight="600" font-size="15">${s.label}</text>`;
    out += `<text x="${x0 + cw / 2}" y="${H - B + 24}" text-anchor="middle" fill="#f0f0fa" font-family="Manrope, sans-serif" font-weight="600" font-size="12.5">${s.where}</text>`;
    const [c1, c2] = s.current.split(/ (?=per )/);
    out += `<text x="${x0 + cw / 2}" y="${H - B + 46}" text-anchor="middle" fill="#e9fbff" font-family="IBM Plex Mono, monospace" font-weight="600" font-size="13">${c1}</text>`;
    if (c2) out += `<text x="${x0 + cw / 2}" y="${H - B + 63}" text-anchor="middle" fill="#e9fbff" font-family="IBM Plex Mono, monospace" font-size="11.5">${c2}</text>`;
    out += `<text x="${x0 + cw / 2}" y="${H - B + (c2 ? 84 : 66)}" text-anchor="middle" fill="#aab2b9" font-family="Manrope, sans-serif" font-size="11.5">${s.note}</text>`;
  });
  out += `<text x="${L}" y="18" fill="#aab2b9" font-family="Manrope, sans-serif" font-size="12.5">Voltage, log scale. Current is for the conductor named under each step. All currents are estimates from P ÷ V.</text>`;
  svg.innerHTML = out;
}

// ---------- tokens: an honest cost per token ----------
const logSlider = (el, lo, hi) => ({ get: () => Math.pow(10, lo + (el.value / 1000) * (hi - lo)), set: v => (el.value = Math.round((Math.log10(v) - lo) / (hi - lo) * 1000)) });
function syncRange(el) { el.style.setProperty('--pct', `${(el.value - el.min) / (el.max - el.min) * 100}%`); }
const T = {
  tps: logSlider($('tps'), 2, Math.log10(20000)), train: logSlider($('train'), 0, Math.log10(300)), life: logSlider($('life'), 13, 17),
};
Object.assign(state, { util: 0.6, carbon: 370, wue: 0.2, trainGWh: 50, lifeTokens: 1e15, withTrain: true });
const sig = (v, d = 2) => v >= 100 ? fmt(v) : v >= 10 ? v.toFixed(1) : v.toFixed(d);
const big = v => v >= 1e12 ? `${sig(v / 1e12)} T` : v >= 1e9 ? `${sig(v / 1e9)} B` : v >= 1e6 ? `${sig(v / 1e6)} M` : v >= 1e3 ? `${sig(v / 1e3)} k` : sig(v);
function renderTokens() {
  const facilityW = IT_MW * state.pue * 1e6, rate = GPUS * state.tokPerGpu * state.util;
  const jOps = facilityW / rate;
  const jTrain = state.withTrain ? state.trainGWh * 3.6e12 / state.lifeTokens : 0;
  const j = jOps + jTrain, reply = 500, whReply = j * reply / 3600;
  $('tps-v').textContent = fmt(state.tokPerGpu); $('pue-v').textContent = state.pue.toFixed(2);
  $('util-v').textContent = `${Math.round(state.util * 100)}%`; $('carbon-v').textContent = `${fmt(state.carbon)} g`;
  $('wue-v').textContent = `${state.wue.toFixed(2)} L`; $('train-v').textContent = `${sig(state.trainGWh)} GWh`;
  $('life-v').textContent = big(state.lifeTokens);
  $('o-j').textContent = sig(j); $('o-kwh').textContent = big(3.6e6 / j);
  $('o-wh').textContent = sig(whReply, 3); $('o-co2').textContent = sig(whReply / 1000 * state.carbon, 3);
  $('o-water').textContent = sig(whReply / 1000 * state.wue * 1000, 3); $('o-train').textContent = `${sig(jTrain / j * 100, 1)}%`;
  document.querySelector('.train-ctl').classList.toggle('off', !state.withTrain);
  ['tps', 'pue', 'util', 'carbon', 'wue', 'train', 'life'].forEach(id => syncRange($(id)));
}
T.tps.set(state.tokPerGpu); T.train.set(state.trainGWh); T.life.set(state.lifeTokens);
$('tps').addEventListener('input', () => { state.tokPerGpu = Math.round(T.tps.get()); renderTokens(); });
$('pue').addEventListener('input', e => { state.pue = +e.target.value / 100; renderTokens(); });
$('util').addEventListener('input', e => { state.util = +e.target.value / 100; renderTokens(); });
$('carbon').addEventListener('input', e => { state.carbon = +e.target.value; renderTokens(); });
$('wue').addEventListener('input', e => { state.wue = +e.target.value / 100; renderTokens(); });
$('train').addEventListener('input', () => { state.trainGWh = T.train.get(); renderTokens(); });
$('life').addEventListener('input', () => { state.lifeTokens = T.life.get(); renderTokens(); });
$('with-train').addEventListener('change', e => { state.withTrain = e.target.checked; renderTokens(); });
document.querySelectorAll('#presets button').forEach(b => b.addEventListener('click', () => { state.tokPerGpu = +b.dataset.tps; T.tps.set(state.tokPerGpu); renderTokens(); }));
document.querySelectorAll('#grid-presets button').forEach(b => b.addEventListener('click', () => { state.carbon = +b.dataset.g; $('carbon').value = state.carbon; renderTokens(); }));

// ---------- temperatures: hot to cold ----------
function renderTemps() {
  const svg = $('temps'), W = 1000, H = 340, L = 60, R = 24, T0 = 44, B = 96;
  const y = c => T0 + (100 - c) / 100 * (H - T0 - B);
  const n = TEMPS.length, cw = (W - L - R) / n;
  const col = c => c >= 70 ? '#ffc34a' : c >= 44 ? '#ff5a6e' : c >= 30 ? '#8b7bff' : '#3f8cff';
  let out = '';
  [0, 25, 50, 75, 100].forEach(c => {
    out += `<line x1="${L}" x2="${W - R}" y1="${y(c)}" y2="${y(c)}" stroke="#222b38"/>`;
    out += `<text x="${L - 10}" y="${y(c) + 4}" text-anchor="end" fill="#6b747c" font-family="IBM Plex Mono, monospace" font-size="12">${c} °C</text>`;
  });
  TEMPS.forEach((t, i) => {
    const x0 = L + i * cw, yy = y(t.c), c = col(t.c);
    out += `<rect x="${x0 + 16}" y="${yy}" width="${cw - 32}" height="${H - B - yy}" rx="4" fill="${c}" fill-opacity="0.2" stroke="${c}" stroke-opacity="0.8"/>`;
    out += `<text x="${x0 + cw / 2}" y="${yy - 10}" text-anchor="middle" fill="${c}" font-family="IBM Plex Mono, monospace" font-weight="600" font-size="15">≈${t.c} °C</text>`;
    out += `<text x="${x0 + cw / 2}" y="${H - B + 24}" text-anchor="middle" fill="#f0f0fa" font-family="Manrope, sans-serif" font-weight="700" font-size="13.5">${t.label}</text>`;
    out += `<text x="${x0 + cw / 2}" y="${H - B + 44}" text-anchor="middle" fill="#aab2b9" font-family="Manrope, sans-serif" font-size="12">${t.note}</text>`;
    if (i < n - 1) { const d = t.c - TEMPS[i + 1].c; out += `<text x="${x0 + cw}" y="${(y(t.c) + y(TEMPS[i + 1].c)) / 2 + 4}" text-anchor="middle" fill="#6b747c" font-family="IBM Plex Mono, monospace" font-size="11.5">−${d}</text>`; }
  });
  out += `<text x="${L}" y="20" fill="#aab2b9" font-family="Manrope, sans-serif" font-size="12.5">Representative temperatures under load. The small numbers are the drop across each hop, the price of moving heat one step further.</text>`;
  svg.innerHTML = out;
}

// ---------- the links, drawn and counted ----------
const n0 = v => Math.round(v).toLocaleString('en-US');
const kilo = v => v >= 1e6 ? `${(v / 1e6).toFixed(1)} M` : v >= 1e4 ? `${Math.round(v / 1000)}k` : n0(v);
const TXT = (x, y, s, { a = 'middle', size = 12, fill = 'currentColor', w = 500, mono = false, op = 1 } = {}) =>
  `<text x="${x}" y="${y}" text-anchor="${a}" font-family="${mono ? 'IBM Plex Mono, monospace' : 'Manrope, sans-serif'}" font-size="${size}" font-weight="${w}" fill="${fill}" fill-opacity="${op}">${s}</text>`;
const C = k => VOLT[k].css;
function renderLinks() {
  // 1. Scale-up: every GPU has one link to each of the 18 switch chips
  {
    const W = 1000, gx = i => 40 + i * (920 / 71), sx = j => 70 + j * (860 / 17), gy = 46, sy = 214;
    let lines = '', hi = '';
    for (let i = 0; i < 72; i++) for (let j = 0; j < 18; j++) {
      const l = `<line x1="${gx(i)}" y1="${gy + 6}" x2="${sx(j)}" y2="${sy - 12}"`;
      if (i === 20) hi += `${l} stroke="${C('nvl')}" stroke-width="1.6"/>`; else lines += `${l} stroke="currentColor" stroke-opacity="0.05"/>`;
    }
    let dots = '';
    for (let i = 0; i < 72; i++) dots += `<circle cx="${gx(i)}" cy="${gy}" r="5" fill="${i === 20 ? C('nvl') : '#6f7a8c'}"/>`;
    for (let j = 0; j < 18; j++) dots += `<rect x="${sx(j) - 16}" y="${sy - 12}" width="32" height="20" rx="3" fill="#1b2230" stroke="${C('nvl')}" stroke-opacity="0.7"/>`;
    $('fig-scaleup').innerHTML = `<svg viewBox="0 0 ${W} 280" role="img" aria-label="Scale-up in one NVL72 rack: each of 72 GPUs has one NVLink to each of 18 switch chips, 1,296 links in all">
      ${lines}${hi}${dots}
      ${TXT(40, 22, '72 GPUs', { a: 'start', size: 13, w: 700 })}${TXT(960, 22, '18 NVLink links from every GPU, one to each switch chip', { a: 'end', size: 12, op: 0.7 })}
      ${TXT(gx(20), 22, 'one GPU', { fill: C('nvl'), size: 12, w: 600 })}
      ${TXT(500, 250, '18 NVLink switch chips, 2 per switch tray × 9 trays, 72 ports each', { size: 13, w: 700 })}
      ${TXT(500, 270, '72 × 18 = 1,296 links · 4 copper pairs each = 5,184 connections · no optics, no hops outside the rack', { size: 12, op: 0.7, mono: true })}
    </svg>`;
  }
  // 2. Scale-out: a three-tier fat tree
  {
    const W = 1000, H = 400, ys = { core: 60, spine: 150, leaf: 240, rack: 330 }, x = (i, n, x0 = 80, x1 = 740) => x0 + (i + 0.5) * (x1 - x0) / n;
    let edges = '', nodes = '';
    const box = (cx, cy, w, h, stroke, label) => `<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="4" fill="#161d29" stroke="${stroke}"/>` + (label ? TXT(cx, cy + 4, label, { size: 11, mono: true, op: 0.85 }) : '');
    const pods = 2, per = 4;
    for (let p = 0; p < pods; p++) for (let i = 0; i < per; i++) {
      const k = p * per + i, lx = x(k, pods * per);
      edges += `<line x1="${lx}" y1="${ys.rack - 18}" x2="${lx}" y2="${ys.leaf + 12}" stroke="${C('eth')}" stroke-width="3"/>`;
      for (let j = 0; j < per; j++) edges += `<line x1="${lx}" y1="${ys.leaf - 12}" x2="${x(p * per + j, pods * per)}" y2="${ys.spine + 12}" stroke="${C('eth')}" stroke-opacity="0.45"/>`;
      for (let c = 0; c < 4; c++) edges += `<line x1="${lx}" y1="${ys.spine - 12}" x2="${x(c, 4, 200, 620)}" y2="${ys.core + 12}" stroke="${C('eth')}" stroke-opacity="0.3"/>`;
    }
    for (let k = 0; k < pods * per; k++) { const lx = x(k, pods * per); nodes += box(lx, ys.rack, 64, 36, '#3a4658', 'NVL72') + box(lx, ys.leaf, 56, 22, C('eth'), '') + box(lx, ys.spine, 56, 22, C('eth'), ''); }
    for (let c = 0; c < 4; c++) nodes += box(x(c, 4, 200, 620), ys.core, 56, 22, C('eth'), '');
    const side = (y, t, s) => TXT(770, y - 2, t, { a: 'start', size: 13, w: 700 }) + TXT(770, y + 15, s, { a: 'start', size: 11.5, op: 0.7, mono: true });
    const edge = (y, t) => TXT(770, y, t, { a: 'start', size: 11.5, fill: C('eth'), mono: true });
    $('fig-scaleout').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Scale-out fabric: racks connect to leaf switches, leaves to spines, spines to cores, one 800G link per GPU at each tier">
      ${edges}${nodes}
      ${side(ys.core, `Core · ${n0(NET.core)} switches`, '144 × 800G down')}
      ${edge((ys.core + ys.spine) / 2 + 4, `↕ ${n0(GPUS)} links`)}
      ${side(ys.spine, `Spine · ${n0(NET.spine)} switches`, '72 down, 72 up')}
      ${edge((ys.spine + ys.leaf) / 2 + 4, `↕ ${n0(GPUS)} links`)}
      ${side(ys.leaf, `Leaf · ${n0(NET.leaf)} switches`, '72 down, 72 up')}
      ${edge((ys.leaf + ys.rack) / 2 + 4, `↕ ${n0(GPUS)} links, 1 × 800G per GPU`)}
      ${side(ys.rack, `${n0(RACKS)} racks · ${n0(GPUS)} GPUs`, '72 optical ports each')}
      ${TXT(410, 388, 'Drawn: 8 racks in 2 pods. Every leaf reaches every spine in its pod; every spine reaches every core.', { size: 11.5, op: 0.6 })}
    </svg>`;
  }
  // 3. Scale across: the chain from core switch to the far campus
  {
    const W = 1000, y = 90, d = NET.dci;
    const stops = [
      [60, 'Core', 'switches'], [180, 'DCI routers', `${d.modulesPerEnd} × 800ZR`], [300, 'Mux', `${d.lambdas} λ, C-band`], [390, 'Amp', 'EDFA'],
    ];
    const far = [[610, 'Amp', ''], [700, 'Mux', ''], [820, 'Routers', ''], [940, 'Remote', 'campus']];
    let out = '';
    const node = ([cx, t, s], hl) => `<rect x="${cx - 42}" y="${y - 20}" width="84" height="40" rx="5" fill="#161d29" stroke="${hl ? C('dci') : '#3a4658'}"/>` + TXT(cx, y - 2, t, { size: 12, w: 700 }) + (s ? TXT(cx, y + 13, s, { size: 10.5, op: 0.7, mono: true }) : '');
    out += `<line x1="102" y1="${y}" x2="138" y2="${y}" stroke="${C('eth')}" stroke-width="2"/><line x1="222" y1="${y}" x2="258" y2="${y}" stroke="${C('dci')}" stroke-width="2"/><line x1="342" y1="${y}" x2="348" y2="${y}" stroke="${C('dci')}" stroke-width="3"/>`;
    // the long-haul span with in-line amplifier huts
    out += `<line x1="432" y1="${y}" x2="568" y2="${y}" stroke="${C('dci')}" stroke-width="3" stroke-dasharray="2 5"/>`;
    for (let k = 0; k < 5; k++) { const hx = 452 + k * 24; out += `<rect x="${hx - 6}" y="${y - 7}" width="12" height="14" rx="2" fill="#2a2f38" stroke="${C('dci')}"/>`; }
    out += `<line x1="652" y1="${y}" x2="658" y2="${y}" stroke="${C('dci')}" stroke-width="3"/><line x1="742" y1="${y}" x2="778" y2="${y}" stroke="${C('dci')}" stroke-width="2"/><line x1="862" y1="${y}" x2="898" y2="${y}" stroke="${C('eth')}" stroke-width="2"/>`;
    stops.forEach(s => out += node(s, s[1] === 'DCI routers'));
    far.forEach(s => out += node(s, false));
    out += TXT(500, y - 32, `${d.routeKm.toLocaleString('en-US')} km of fiber · ${d.huts} amplifier huts, one every ≈${d.spanKm} km`, { size: 12, w: 600, fill: C('dci') });
    out += TXT(500, y + 34, `≈${(d.routeKm * 0.0049).toFixed(1)} ms one way`, { size: 11.5, mono: true, op: 0.8 });
    const note = (x0, t, s) => TXT(x0, 170, t, { size: 12, w: 700 }) + TXT(x0, 188, s, { size: 11, op: 0.7, mono: true });
    out += note(180, 'Each wavelength', `${d.gbps}G, coherent`) + note(345, 'Each fiber pair', `${d.lambdas} × ${d.gbps}G = ${(d.lambdas * d.gbps / 1000).toFixed(1)} Tb/s`)
      + note(560, 'Each route', `${d.litPairs} lit pairs of a ${d.cableStrands}-strand cable`) + note(800, 'This campus', `${d.routes} routes · ≈${n0(d.tbpsPerRoute * d.routes)} Tb/s`);
    $('fig-across').innerHTML = `<svg viewBox="0 0 ${W} 210" role="img" aria-label="Scale across: core switches hand traffic to DCI routers with coherent 800ZR optics, multiplexed onto fiber pairs, amplified every 80 km to the remote campus">${out}</svg>`;
  }
  // 4. The census, from the smallest structure out
  const rackFibers = [(CAMPUS.gpusPerRack + FABRIC.dpusPerRack) * FABRIC.fibersPerLink, (CAMPUS.gpusPerRack + 2 * FABRIC.dpusPerRack) * FABRIC.fibersPerLink];
  const hallGpus = GPUS / 2, d = NET.dci;
  const cards = [
    ['GPU package', 'nvl', [['NVLink links', '18'], ['Copper pairs out', '72'], ['CPU link', '1 × NVLink-C2C'], ['Scale-out port', '1 × 800G'], ['HBM stacks', '8']]],
    ['Compute tray', 'nvl', [['GPUs', '4'], ['NVLink links', '72'], ['Scale-out optical ports', '4'], ['BlueField-3 DPUs, 2 × 400G', '2'], ['Fibers out the front', `≈${n0(6 * FABRIC.fibersPerLink)}–${n0(8 * FABRIC.fibersPerLink)}`]]],
    ['NVL72 rack', 'nvl', [['NVLink links', '1,296'], ['Copper connections', '5,184'], ['NVLink cable cartridges', '4'], ['NVLink switch chips', '18'], ['Scale-out ports', '72'], ['BlueField-3 DPUs, 2 × 400G', n0(FABRIC.dpusPerRack)], ['Management switches', n0(FABRIC.mgmtPerRack)], ['Fibers leaving the rack', `≈${n0(rackFibers[0])}–${n0(rackFibers[1])}`]]],
    ['One data hall', 'eth', [['Racks', `≈${n0(RACKS / 2)}`], ['GPU-to-leaf links', `≈${kilo(hallGpus)}`], ['Leaf + spine switches', `≈${n0(NET.leaf / 2 + NET.spine / 2)}`], ['Optical modules', `≈${kilo(NET.modules / 2)}`], ['Fiber strands', `≈${kilo(NET.fibers / 2)}`], ['Patch housings, 576 fibers per 4U', `≈${n0(NET.fibers / 2 / 576)}`]]],
    ['The campus fabric', 'eth', [['Fabric switches', n0(NET.switches)], ['Optical links', kilo(NET.links)], ['Optical modules', `${kilo(NET.modules)} · ${(NET.modules / GPUS).toFixed(1)} per GPU`], ['Fiber strands', `≈${kilo(NET.fibers)}`], ['NVLink copper connections', `≈${kilo(NET.nvlinkPairs)}`], ['Network power outside the racks', `${(NET.switchMW + NET.opticsMW).toFixed(1)} MW`]]],
    ['Campus to campus', 'dci', [['Diverse routes', `${d.routes}`], ['Lit fiber pairs per route', `${d.litPairs} of ${d.cableStrands / 2}`], ['Wavelengths per pair', `${d.lambdas} × ${d.gbps}G`], ['Coherent modules, each end', n0(d.modulesPerEnd)], ['Router line cards, 36 × 800G', `≈${Math.ceil(d.modulesPerEnd / d.portsPerLinecard)}`], ['Capacity', `≈${n0(d.tbpsPerRoute * d.routes)} Tb/s`], ['Amplifier huts per route', `${d.huts}`]]],
  ];
  $('census').innerHTML = cards.map(([t, cls, rows]) => `<div class="cz" style="--c:${C(cls)}"><h3>${t}</h3><dl>${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl></div>`).join('');
}

// ---------- how a model is split ----------
function renderParallel() {
  const levels = [...PARALLEL].reverse();   // outermost first
  let html = '<div class="nest-core" style="--c:var(--hbm)"><b>One GPU</b><span>HBM feeds the math at 8 TB/s. Serving a chat reply is mostly waiting on memory: each new token reads the weights and the conversation\u2019s KV cache from HBM.</span></div>';
  PARALLEL.forEach(p => {
    html = `<div class="nest" style="--c:${VOLT[p.cls].css}"><div class="nest-head"><b>${p.name}</b><span class="nest-where">${p.where}</span><span class="nest-need">${p.need}</span></div><p>${p.what}</p>${html}</div>`;
  });
  $('parallel').innerHTML = html;
  void levels;
}

// ---------- bill of materials ----------
$('bom').innerHTML = BOM.map(g => `<div class="bom-col"><h3>${g.group}</h3><dl>${g.rows.map(([k, v, b]) => `<div><dt>${k}</dt><dd>${v} <span class="chip ${b}">${BASIS[b].short}</span></dd></div>`).join('')}</dl></div>`).join('');

function renderBandwidth() {
  const svg = $('bandwidth'), W = 1000, H = 400, L = 70, R = 24, T = 40, B = 130;
  const lo = Math.log10(0.5), hi = Math.log10(20000);
  const y = v => T + (hi - Math.log10(v)) / (hi - lo) * (H - T - B);
  const n = BANDWIDTH.length, cw = (W - L - R) / n;
  let out = '';
  [1, 10, 100, 1000, 10000].forEach(v => {
    out += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#222b38" stroke-width="1"/>`;
    out += `<text x="${L - 10}" y="${y(v) + 4}" text-anchor="end" fill="#6b747c" font-family="IBM Plex Mono, monospace" font-size="12">${v >= 1000 ? v / 1000 + ' TB/s' : v + ' GB/s'}</text>`;
  });
  BANDWIDTH.forEach((b, i) => {
    const x0 = L + i * cw, yy = y(b.gbs), c = VOLT[b.cls].css;
    out += `<rect x="${x0 + 14}" y="${yy}" width="${cw - 28}" height="${H - B - yy}" rx="4" fill="${c}" fill-opacity="0.22" stroke="${c}" stroke-opacity="0.8"/>`;
    out += `<text x="${x0 + cw / 2}" y="${yy - 10}" text-anchor="middle" fill="${c}" font-family="IBM Plex Mono, monospace" font-weight="600" font-size="15">${b.gbs >= 1000 ? b.gbs / 1000 + ' TB/s' : '≈' + b.gbs + ' GB/s'}</text>`;
    out += `<text x="${x0 + cw / 2}" y="${H - B + 24}" text-anchor="middle" fill="#f0f0fa" font-family="Manrope, sans-serif" font-weight="700" font-size="14">${b.label}</text>`;
    out += `<text x="${x0 + cw / 2}" y="${H - B + 42}" text-anchor="middle" fill="#aab2b9" font-family="Manrope, sans-serif" font-size="12.5">${b.where}</text>`;
    out += `<text x="${x0 + cw / 2}" y="${H - B + 66}" text-anchor="middle" fill="#e9fbff" font-family="IBM Plex Mono, monospace" font-weight="600" font-size="12.5">${b.latency}</text>`;
    out += `<text x="${x0 + cw / 2}" y="${H - B + 86}" text-anchor="middle" fill="#6b747c" font-family="Manrope, sans-serif" font-size="11.5">${b.note}</text>`;
  });
  out += `<text x="${L}" y="20" fill="#aab2b9" font-family="Manrope, sans-serif" font-size="12.5">Bandwidth per GPU, log scale, with one-way latency under each bar. Each step out is 10–100× slower.</text>`;
  svg.innerHTML = out;
}

renderLedger(); renderStairs(); renderBandwidth(); renderLinks(); renderTemps(); renderParallel(); renderTokens();
resize();
go(0).then(() => requestAnimationFrame(loop));

// test hook
window.ifx = { go, select, setMode, state, camera, controls, composers, built, settle() { if (tween) { camera.position.copy(tween.p1); controls.target.copy(tween.t1); tween = null; controls.update(); } } };
