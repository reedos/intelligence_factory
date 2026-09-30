// The 3D stage: renderer, one scene per scale, camera moves, the parts panel and pins, and the
// power / data / heat layers. Scenes are rebuilt from the model whenever the scenario changes.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { HardwareGTAOPass } from './hardware-ao.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { HardwareBokehPass } from './hardware-bokeh.js';
import { DETAIL } from '../kit.js';
import { TIERS, qualityPressure } from './render-quality.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { VOLT, BASIS } from '../data.js';
import { chip as basisChip } from '../evidence.js';
import { store, on, emit } from './store.js';
import * as campus from '../scenes/campus.js';
import * as hall from '../scenes/hall.js';
import * as rack from '../scenes/rack.js';
import * as tray from '../scenes/tray.js';
import * as chip from '../scenes/chip.js';
import * as across from '../scenes/across.js';
import * as sideModule from '../scenes/side-module.js';
import * as sideCpo from '../scenes/side-cpo.js';
import * as sideCoherent from '../scenes/side-coherent.js';
import * as sideCopper from '../scenes/side-copper.js';
import { applyVisualDirection } from '../scenes/visual-direction.js';
import { applyComputeArtDirection } from '../scenes/compute-art-direction.js';
import { cameraPresetFor } from './camera-presets.js';
import { fitHousing, fitComponent } from './housing-frame.js';
import { overlapsRect, pinLabelBox, declutterPins } from './pin-layout.js';

// six levels in a line, outermost first, then the side levels inside the links, each its own diagram: the module, the
// CPO package, the coherent module, the copper cables. Each is entered from the part that holds it and left back to
// the level the reader came from.
// Isolated visual prototype: both variants keep the same stage, UI, tours, and quality settings.
// This local build defaults to authored models. module=native retains the original
// comparison implementation; authored assets load only when a level is entered.
let moduleBuilder = sideModule, cpoBuilder = sideCpo, coherentBuilder = sideCoherent, copperBuilder = sideCopper;
let rackBuilder = rack, trayBuilder = tray, chipBuilder = chip;
const assetLoaders = new Map();
if (!['native', 'original'].includes(new URLSearchParams(location.search).get('module'))) {
  moduleBuilder = await import('../scenes/side-module-blender.js');
  cpoBuilder = await import('../scenes/side-cpo-blender.js');
  const links = await import('../scenes/side-links-blender.js');
  const compute = await import('../scenes/compute-blender.js');
  rackBuilder = compute.rackBuilder; trayBuilder = compute.trayBuilder; chipBuilder = compute.chipBuilder;
  // Download authored geometry when its level is entered, rather than making
  // a phone fetch the complete ten-level asset library before the first frame.
  assetLoaders.set(0, () => across.preload());
  assetLoaders.set(1, () => campus.preload());
  assetLoaders.set(2, () => hall.preload());
  assetLoaders.set(3, options => rackBuilder.preload(options));
  assetLoaders.set(4, options => trayBuilder.preload(options));
  assetLoaders.set(5, options => chipBuilder.preload(options));
  assetLoaders.set(6, () => moduleBuilder.preload());
  assetLoaders.set(7, () => cpoBuilder.preload());
  assetLoaders.set(8, () => links.preloadLinks());
  assetLoaders.set(9, () => links.preloadLinks());
  coherentBuilder = links.coherentBuilder; copperBuilder = links.copperBuilder;
}
const BUILDERS = [across, campus, hall, rackBuilder, trayBuilder, chipBuilder, moduleBuilder, cpoBuilder, coherentBuilder, copperBuilder];
export const MAIN_LEVELS = 6, MODULE_LEVEL = 6;
export const isSide = i => i >= MAIN_LEVELS;
// how the reader entered the side levels: the level, the door part and the layer, restored by Back out. A link opened
// straight into a side level has none, and Back out goes to the level that holds that diagram instead.
let sideFrom = 4, sideVia = null, sideMode = null, sideEntered = false;
const SIDE_PARENT = { 6: 4, 7: 2, 8: 0, 9: 3 };           // module: the tray; CPO: the hall; coherent: Scale across; copper: the rack
// where a part's go-button leads: a number, or 'out' for the side level's way back
const backTarget = () => sideEntered ? sideFrom : SIDE_PARENT[ui.scene] ?? 4;
export const drillOf = p => p?.drill === 'out' ? backTarget() : p?.drill;
// the pluggable module inside the optics, with its DSP or without (LPO); a view of the module only, since the
// fabric this scenario counts still uses DSP modules
let lpoOn = false;
// tours always narrate the DSP module, so entering one puts the view back on it
export function resetVariant() { if (lpoOn) { lpoOn = false; applyVariant(); } }
function applyVariant() {
  built[MODULE_LEVEL]?.variant?.setLpo(lpoOn);
  document.querySelectorAll('[data-variant]').forEach(b => b.setAttribute('aria-pressed', String((b.dataset.variant === 'lpo') === lpoOn)));
  if (ui.scene === MODULE_LEVEL && built[MODULE_LEVEL]) {
    buildPanel(MODULE_LEVEL);
    if (ui.selected) select(ui.selected, false);
    emit('module-variant');
  }
}
document.querySelectorAll('[data-variant]').forEach(b => b.addEventListener('click', () => { lpoOn = b.dataset.variant === 'lpo'; applyVariant(); }));
// whether moving from one level to another goes in: a side level counts as inside whatever it was entered from, and
// moving between two side levels (a tour crossing from the module to the CPO package) goes across, drawn as in
export const isInward = (from, to) => isSide(to) ? true : isSide(from) ? false : to > from;

// per scene defaults: bloom, ambient occlusion radius (world units, 0 = off), exposure. A scene can override any of
// these, and pick its lighting environment and depth of field, by returning `look` from build():
//   look: { bloom, threshold, ao, exposure, env: 'room' | 'studio' | 'indoor' | 'sky' | 'night', envIntensity, dof: true }
const LOOK = [
  { bloom: 0.8, threshold: 0.95, ao: 0, exposure: 1.0 },
  { bloom: 0.85, threshold: 0.86, ao: 0, exposure: 1.0 },
  { bloom: 0.5, threshold: 1.0, ao: 0.6, exposure: 1.0 },
  { bloom: 0.55, threshold: 1.0, ao: 0.06, exposure: 1.0 },
  { bloom: 0.55, threshold: 1.35, ao: 0.12, exposure: 0.95 },
  { bloom: 0.6, threshold: 1.7, ao: 0.15, exposure: 0.95 },
  { bloom: 0.6, threshold: 1.6, ao: 0.12, exposure: 0.95 },   // inside the module
  { bloom: 0.6, threshold: 1.6, ao: 0.12, exposure: 0.95 },   // the CPO package
  { bloom: 0.6, threshold: 1.6, ao: 0.12, exposure: 0.95 },   // the coherent module
  { bloom: 0.5, threshold: 1.6, ao: 0.12, exposure: 0.95 },   // the copper cables
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
      [['v33', '3.3 V into the module'], ['core', 'Sub-volt rails']],
      [['core', 'Package power'], ['v33', 'Engines and laser modules']],
      [['v33', '3.3 V into the module'], ['core', 'Sub-volt rails']],
      [['v33', 'Port power, active cables only']],
    ],
    data: [
      [['dci', 'DWDM routes']],
      M.halls > 1 ? [['dci', 'Long-haul fiber'], ['eth', 'Hall to hall']] : [['dci', 'Long-haul fiber']],
      [['eth', `Scale-out, ${speed} optical`]],
      nvl ? [['nvl', 'Scale-up, NVLink copper'], ['eth', 'Scale-out, optical']] : [['nvl', 'NVLink, inside one server'], ['eth', 'Scale-out, optical']],
      nvl ? [['nvl', 'NVLink'], ['c2c', 'NVLink-C2C'], ['eth', 'To the NIC and optics']] : [['nvl', 'NVLink'], ['pcie', 'PCIe'], ['eth', 'To the optics']],
      M.accel.dies > 1 ? [['hbm', 'HBM'], ['hbi', 'Die to die'], ['nvl', 'NVLink out']] : [['hbm', 'HBM'], ['nvl', 'NVLink out']],
      [['eth', 'Electrical, copper'], ['tx', 'Light out, transmit'], ['rx', 'Light in, receive'], ['cw', 'Laser light, no data']],
      [['eth', 'Electrical, copper'], ['tx', 'Light out, transmit'], ['rx', 'Light in, receive'], ['cw', 'Laser light, no data']],
      [['eth', 'Electrical, copper'], ['tx', 'Light out, transmit'], ['rx', 'Light in, receive'], ['cw', 'Laser light, no data']],
      [['eth', 'Electrical pairs, both directions']],
    ],
    heat: [
      [['hv', 'Grid, for reference']],
      warm ? (M.closedLoop ? [['warm', 'Warm water up'], ['air', 'Warm air out']] : [['warm', 'Warm water up'], ['air', 'Warm air out'], ['vapor', 'Evaporation'], ['cool', 'Makeup water']])
        : M.closedLoop ? [['warm', 'Return water'], ['cool', 'Chilled supply'], ['air', 'Warm air off the chillers']]   // a closed loop evaporates nothing
        : [['warm', 'Return water'], ['cool', 'Chilled supply'], ['vapor', 'Evaporation']],
      [['cool', 'Supply water'], ['warm', 'Return water'], ['air', 'Hot air']],
      nvl ? (M.accel.liquidShare < 0.99 ? [['cool', 'Supply'], ['warm', 'Return'], ['air', 'Exhaust air']] : [['cool', 'Supply'], ['warm', 'Return']]) : [['cool', 'Cold air in'], ['air', 'Hot air out']],
      nvl ? [['hot', 'Heat into the plates'], ['cool', 'Supply'], ['warm', 'Return'], ['air', 'Fan air']] : [['hot', 'Heat into the sinks'], ['air', 'Air through the server']],
      [['hot', `Heat out of the ${M.accel.dies > 1 ? 'dies' : 'die'}`], ['air', 'Out of HBM']],
      [['hot', 'Heat out of the chips'], ['air', 'Air through the fins']],
      [['hot', 'Heat into the plate'], ['cool', 'Water through the plate']],
      [['hot', 'Heat out of the chips']],
      [['hot', 'Little heat']],
    ],
  };
}

const $ = id => document.getElementById(id);
const ui = store.ui;
const SCENES = () => store.C.SCENES;
const PARTS_BY = () => ({ power: store.C.PARTS, data: store.C.PARTS_DATA, heat: store.C.PARTS_HEAT });
// a scene variant may not draw every part (an air-cooled hall has no CDUs), so list only parts the scene placed
export const partsFor = (i, mode = ui.mode) => {
  const list = PARTS_BY()[mode][SCENES()[i].id] || [];
  if (!built[i]) return list;
  const hs = hotspotsFor(i, mode);
  return list.filter(p => hs[p.id]).map(p => built[i].variant?.partCopy?.(p, mode) || p);
};
const hotspotsFor = (i, mode = ui.mode) => (built[i] && { power: built[i].hotspots, data: built[i].dataHotspots, heat: built[i].heatHotspots }[mode]) || {};
// The number on a part's pin: its place among the parts its level draws in that layer. Tours number their steps with
// it too, so the number beside a step is always the one on the part in the view. (tools/parts.mjs checks every listed
// part has a pin, so a level not built yet numbers the same as it will once it is.)
export const pinNumber = (scene, id, mode = ui.mode) => { const k = partsFor(scene, mode).findIndex(p => p.id === id); return k < 0 ? null : k + 1; };
export const partCount = (scene, mode = ui.mode) => partsFor(scene, mode).length;
const voltFor = s => ui.mode === 'heat' ? { ...VOLT[s.heatVolt], short: s.heatShort, name: VOLT[s.heatVolt].name } : VOLT[ui.mode === 'data' ? s.dataVolt : s.volt];
const flowsFor = b => (ui.mode === 'data' ? b.dataFlows : ui.mode === 'heat' ? b.heatFlows : b.flows) || [];
export const mobile = matchMedia('(max-width: 760px), (pointer: coarse)').matches;
export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
// the 3D view/stage region (nav, viewer and the parts panel, which holds the tour too): single-character
// shortcuts anywhere on the page only fire while this has focus or the pointer, so they never hijack a key
// meant for something else on the page - a form, a screen reader command, dictation (WCAG 2.1.4)
const stageRegion = document.querySelector('.stage');
export const stageActive = () => !!stageRegion && (stageRegion.contains(document.activeElement) || stageRegion.matches(':hover'));
// what a scene may spend: shadows, the floor mirror (renders the scene twice) and depth of field are desktop only
const quality = { shadows: !mobile, mobile, reflections: !mobile, dof: !mobile };
const lookOf = i => ({ envIntensity: 0.35, env: 'room', dof: true, ...LOOK[i], ...(built[i]?.look || {}) });

// ---------- renderer ----------
const view = $('view'), canvas = $('gl');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
catch (e) { $('veil').textContent = 'This view needs WebGL, which this browser has turned off.'; throw e; }
const maxRatio = Math.min(devicePixelRatio, mobile ? 1.5 : 1.75);
let ratio = maxRatio;
renderer.setPixelRatio(ratio);

// ---------- the quality governor ----------
// Frame time decides what each level can afford, not a guess about the device. Each tier sheds the next most costly
// effect, in the order measured in the data hall (tools/costs.mjs): the floor mirror (about half the frame), ambient
// occlusion and depth of field, then 4x antialiasing and per-frame shadow maps, then resolution, bloom, and decorative flow density. Every route keeps moving signals. Every level keeps its
// own tier, since the hall and rack carry the mirror and the campus does not. A level steps down when its frames run
// slower than about 50 fps because of drawing, and a tier that failed stays out of reach for a while. Frames tell
// nothing about headroom under vsync, so it steps back up only where the browser has GPU timers and they say the
// better tier fits. Phones start without those effects at tier 3 and can shed bloom, particle density and resolution.
const params = new URLSearchParams(location.search);
const compareProbe = params.has('module');
if (compareProbe) renderer.info.autoReset = false;
const frameListeners = new Set();
export const observeFrame = fn => {
  frameListeners.add(fn); renderer.info.autoReset = false;
  return () => { frameListeners.delete(fn); renderer.info.autoReset = !compareProbe && !frameListeners.size; };
};
const glx = renderer.getContext();
const gpuName = (() => { try { const e = glx.getExtension('WEBGL_debug_renderer_info'); return (e && glx.getParameter(e.UNMASKED_RENDERER_WEBGL)) || glx.getParameter(glx.RENDERER) || ''; } catch { return ''; } })();
// integrated and software GPUs start with the mirror off; the GPU timers put it back where there is room
const integrated = /Intel(?!.*\bArc)|Radeon\(TM\) Graphics|Radeon Graphics|Vega \d|Mali|Adreno|PowerVR|SwiftShader|llvmpipe|Basic Render/i.test(gpuName);
let timerExt = glx.getExtension('EXT_disjoint_timer_query_webgl2');
const forced = /^[0-6]$/.test(params.get('quality') || '') ? +params.get('quality') : null;
const governing = forced === null && (!navigator.webdriver || params.has('govern'));   // test browsers opt in
let qualityPreference = 'auto';
try { if (localStorage.getItem('ifx-render-preference') === 'laptop') qualityPreference = 'laptop'; } catch { /* private browsing */ }
let bestTier = qualityPreference === 'laptop' ? 4 : mobile ? 3 : 0;
const tiers = BUILDERS.map(() => forced ?? (Math.max(bestTier, integrated && governing ? 1 : 0)));   // test browsers: full quality
const ceilings = BUILDERS.map(() => bestTier);            // the best tier each level may try for now
// when a failed tier may be tried again; the wait doubles each time a level climbs back and fails straight away
const retryAt = BUILDERS.map(() => 0), backoff = BUILDERS.map(() => 30000), climbedAt = BUILDERS.map(() => -Infinity);
// with timers a level can climb back, so what each settled on is worth remembering; without them a bad moment would stick
const QKEY = 'ifx-quality-2';
if (timerExt && governing) try {
  const s = JSON.parse(localStorage.getItem(QKEY) || 'null');
  if (s?.gpu === gpuName && s.tiers?.length === tiers.length) s.tiers.forEach((v, i) => { if (Number.isInteger(v) && v >= bestTier && v < TIERS.length) tiers[i] = v; });
} catch { /* start from the guess */ }
const tierOf = i => TIERS[tiers[i]];
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = quality.shadows;
renderer.shadowMap.type = THREE.PCFShadowMap;
// ---------- lighting environments: what metal and glass reflect ----------
const pmrem = new THREE.PMREMGenerator(renderer);
const envs = {};
function envScene(kind) {
  const s = new THREE.Scene(), box = (w, h, d, color, k, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.BackSide })); m.position.set(x, y, z); s.add(m); return m; };
  const panel = (w, h, color, k, x, y, z, rx, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide })); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); s.add(m); };
  if (kind === 'studio') {            // a dark stage: a big softbox overhead-front, cool and warm rim strips, a dim floor
    box(20, 12, 20, '#0b0d11', 1, 0, 3, 0);
    panel(8, 5, '#ffffff', 4.5, 0, 7, 4, -Math.PI / 2 + 0.5, 0);
    panel(1.2, 7, '#bcd4ff', 3.2, -8, 3, -2, 0, Math.PI / 2);
    panel(1.2, 7, '#ffd9b0', 2.6, 8, 3, -2, 0, -Math.PI / 2);
    panel(20, 20, '#1a1d22', 1, 0, -2.9, 0, -Math.PI / 2, 0);
  } else if (kind === 'indoor') {     // a hall: rows of ceiling panels over grey walls
    box(40, 8, 40, '#3a3e44', 1, 0, 3, 0);
    for (let x = -15; x <= 15; x += 6) for (let z = -15; z <= 15; z += 6) panel(3, 1, '#fff4e6', 6, x, 6.9, z, Math.PI / 2, 0);
    panel(40, 40, '#2a2c30', 1, 0, -0.9, 0, -Math.PI / 2, 0);
  } else if (kind === 'sky') {        // dusk: deep blue overhead, amber horizon, the low sun, dark ground
    const geo = new THREE.SphereGeometry(50, 32, 16), col = [], p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i) / 50, c = new THREE.Color(); if (y > 0.05) c.set('#16264a').lerp(new THREE.Color('#0a1226'), Math.min(1, y * 1.4)); else if (y > -0.05) c.set('#d8894a'); else c.set('#141610'); col.push(c.r, c.g, c.b); }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    s.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    const sun = new THREE.Mesh(new THREE.SphereGeometry(3, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc890').multiplyScalar(18) })); sun.position.set(-42, 8, 20); s.add(sun);
  } else if (kind === 'night') {
    box(40, 20, 40, '#0a1020', 1, 0, 5, 0);
    panel(40, 6, '#243048', 1.4, 0, 1, -19.5, 0, 0);
  } else s.add(new RoomEnvironment());
  return s;
}
function envFor(kind) { return envs[kind] ||= pmrem.fromScene(envScene(kind), 0.04).texture; }

export const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 1000);
export const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.08; controls.maxPolarAngle = Math.PI * 0.49;
controls.addEventListener('start', () => {
  tween = null; drift = null;
  if (built[ui.scene]?.inspection) { built[ui.scene].inspection.currentView = 'custom'; emit('campus-presentation'); }
  emit('user-camera');
});

export const built = [], composers = [];
function getScene(i) {
  if (!built[i]) {
    const b = BUILDERS[i].build({ quality: { ...quality, reduced }, state: ui, model: store.M });
    applyComputeArtDirection({ built: b, level: i, quality, matched: params.get('finish') === 'matched' });
    applyVisualDirection({ built: b, level: i, matched: params.get('finish') === 'matched' });
    built[i] = b;
    const L = lookOf(i);
    b.scene.environment = envFor(L.env); b.scene.environmentIntensity = L.envIntensity; b.model = store.M;
    applyMode(b);
    b._mirrors = []; b.scene.traverse(o => { if (o.isReflector) b._mirrors.push(o); });
    b._mirrors.forEach(m => { m.visible = tierOf(i).mirror; });
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
let finishes = [], dofs = [], aos = [];
function getComposer(i) {
  if (!composers[i]) {
    // multisampled: thin struts, cables and fins stay clean instead of stair-stepping (phones keep the frame rate)
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: mobile ? 0 : tierOf(i).msaa });
    const b = getScene(i), c = new EffectComposer(renderer, rt);
    c.addPass(new RenderPass(b.scene, camera));
    const L = lookOf(i);
    if (L.ao && !mobile) {
      const ao = new HardwareGTAOPass(b.scene, camera, 1, 1);
      ao.blendIntensity = 0.75;
      ao.updateGtaoMaterial({ radius: L.ao, distanceExponent: 1.5, thickness: 1, scale: 1, samples: 12 });
      ao.enabled = tierOf(i).ao; aos[i] = ao;
      c.addPass(ao);
    }
    // depth of field for tour close-ups (desktop): off until a tour frames a part, then focused on it every frame
    if (quality.dof && L.dof) { const dof = new HardwareBokehPass(b.scene, camera, { focus: 1, aperture: 0, maxblur: 0.006 }); dof.enabled = false; c.addPass(dof); dofs[i] = dof; }
    c.flowBloom = new UnrealBloomPass(new THREE.Vector2(1, 1), L.bloom * .7, 0.28, L.threshold);
    c.flowBloom.enabled = tierOf(i).bloom;
    c.addPass(c.flowBloom);
    c.addPass(new OutputPass());
    const fin = new ShaderPass(FINISH);
    fin.uniforms.uGrain.value = L.grain ?? 0.035;
    fin.uniforms.uVignette.value = L.vignette ?? 0.32;
    c.addPass(fin); finishes[i] = fin;
    composers[i] = c;
    sizeComposer(c);
  }
  // Layer-specific bloom keeps dense heat/signal fields crisp without dimming
  // the same hardware's other layers. Reapply when returning to a cached scene.
  const L = lookOf(i);
  composers[i].flowBloom.strength = (L.bloomByMode?.[ui.mode] ?? L.bloom) * .7;
  return composers[i];
}
function disposeScene(b) {
  b.dispose?.();                                          // anything the scene holds outside its graph (cached textures)
  b.scene.traverse(o => {
    o.shadow?.dispose();                                  // a shadow-casting light owns a render target of its own
    o.geometry?.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    const owned = new Set([...mats, o.customDepthMaterial, o.customDistanceMaterial].filter(Boolean));
    owned.forEach(m => { Object.values(m).forEach(v => v?.isTexture && v.dispose()); m.dispose(); });
  });
}
// EffectComposer.dispose frees only its own two targets; bloom and AO passes hold render targets of their own
function disposeComposer(c) { if (!c) return; c.passes.forEach(p => p.dispose?.()); c.dispose(); }
// a composer keeps the pixel ratio it was built with unless told, so a lower resolution tier would only shrink the
// final picture while every pass still drew at full size
function sizeComposer(c) {
  c.setSize(view.clientWidth, view.clientHeight);
  if (c.tierRatio !== ratio) { c.tierRatio = ratio; c.setPixelRatio(ratio); }
}
// put level i's effects at its tier; the renderer-wide settings follow the level on screen. True if the size changed.
function applyTier(i) {
  const t = tierOf(i), c = composers[i];
  built[i]?._mirrors.forEach(m => { m.visible = t.mirror; });
  if (aos[i]) aos[i].enabled = t.ao;
  if (c?.flowBloom) c.flowBloom.enabled = t.bloom;
  built[i]?.flowRibbons?.setQuality({ halo: t.halo });
  for (const key of ['flows', 'dataFlows', 'heatFlows'])
    for (const f of built[i]?.[key] || []) f.setRenderBudget?.(t.particles);
  if (c) for (const rt of [c.renderTarget1, c.renderTarget2]) { const n = mobile ? 0 : t.msaa; if (rt.samples !== n) { rt.samples = n; rt.dispose(); } }
  if (i !== ui.scene) return false;
  emit('render-quality');
  renderer.shadowMap.autoUpdate = t.liveShadows; renderer.shadowMap.needsUpdate = true;   // a frozen map still draws once
  const r = Math.min(maxRatio, t.ratio);
  if (r === ratio) return false;
  ratio = r; renderer.setPixelRatio(ratio); return true;
}
// what a tier actually changes on level i: tiers that shed an effect this level lacks are the same tier here
const looksLike = (i, n) => { const t = TIERS[n]; return [t.mirror && built[i]?._mirrors.length > 0, t.ao && !!aos[i], t.dof && !!dofs[i], mobile ? 0 : t.msaa, t.liveShadows && quality.shadows, Math.min(maxRatio, t.ratio), t.bloom, t.halo && !!built[i]?.flowRibbons, t.particles].join(); };
function stepFrom(i, dir) {
  const now = looksLike(i, tiers[i]);
  for (let n = tiers[i] + dir; n >= ceilings[i] && n < TIERS.length; n += dir) if (looksLike(i, n) !== now) return n;
  return null;
}
const gov = { frames: [], gpu: [], cpu: [], quietUntil: 0, q: [], live: null, t0: 0, drawMs: 0, workMs: 0, healthy: 0 };
const hush = ms => { gov.frames.length = gov.gpu.length = gov.cpu.length = 0; gov.healthy = 0; gov.quietUntil = Math.max(gov.quietUntil, performance.now() + ms); };
function setTier(i, n) {
  tiers[i] = n;
  if (applyTier(i)) resize();
  hush(2000);                                             // let the new tier settle before judging it
  if (timerExt) try { localStorage.setItem(QKEY, JSON.stringify({ gpu: gpuName, tiers })); } catch { /* not remembered */ }
}
// GPU time per frame, from timer queries where the browser has them (Chromium on desktop): read a few frames late.
// A lost context invalidates the queries and the extension; start again once it is back.
function gpuBegin() {
  if (!governing || !timerExt || gov.live || gov.q.length > 7) return;   // a GPU that is behind has several frames queued
  gov.live = glx.createQuery(); glx.beginQuery(timerExt.TIME_ELAPSED_EXT, gov.live);
}
function gpuEnd() {
  if (!timerExt || (!gov.live && !gov.q.length)) return;
  if (gov.live) { glx.endQuery(timerExt.TIME_ELAPSED_EXT); gov.q.push(gov.live); gov.live = null; }
  const disjoint = glx.getParameter(timerExt.GPU_DISJOINT_EXT), settled = performance.now() >= gov.quietUntil;
  while (gov.q.length && glx.getQueryParameter(gov.q[0], glx.QUERY_RESULT_AVAILABLE)) {
    const q = gov.q.shift(), ns = glx.getQueryParameter(q, glx.QUERY_RESULT); glx.deleteQuery(q);
    if (!disjoint && settled) gov.gpu.push(ns / 1e6);
  }
}
canvas.addEventListener('webglcontextlost', () => { gov.q.length = 0; gov.live = null; timerExt = null; });
canvas.addEventListener('webglcontextrestored', () => { timerExt = glx.getExtension('EXT_disjoint_timer_query_webgl2'); hush(2000); });
const median = a => a.slice().sort((x, y) => x - y)[a.length >> 1];
// the frame time a reader feels: the mean interval without the slowest 5%, so one hitch is no verdict. Not the median:
// a GPU that falls behind delivers frames in bursts, a few at the display's rate and then a long stall, and the median
// of that reads 60 fps while the page runs at 15.
const felt = a => { const s = a.slice().sort((x, y) => x - y); s.length -= Math.floor(s.length * 0.05); return s.reduce((x, y) => x + y, 0) / s.length; };
// Sustained rendering pressure below ~50 fps sheds one tier, below 25 fps two.
// CPU includes animation updates and render submission, not just draw calls.
// Ignore idle-GPU frame caps. Recovery needs three healthy windows plus the
// failed-tier cooldown, preventing rapid quality oscillation.
function govern(raw) {
  const now = performance.now();
  if (!governing || now < gov.quietUntil) return;
  if (!gov.frames.length) gov.t0 = now;
  gov.frames.push(raw * 1000); gov.cpu.push(gov.workMs);
  if (gov.frames.length < 90 && !(now - gov.t0 > 1800 && gov.frames.length >= 12)) return;
  const i = ui.scene, frame = felt(gov.frames), cpu = felt(gov.cpu);
  const gpu = timerExt && gov.gpu.length >= Math.max(4, Math.min(30, gov.frames.length / 3)) ? median(gov.gpu) : null;
  gov.frames.length = gov.gpu.length = gov.cpu.length = 0; gov.judged = { frame, gpu, cpu };
  const pressure = qualityPressure({ frame, gpu, cpu });
  gov.healthy = pressure === -1 ? gov.healthy + 1 : 0;
  if (pressure > 0) {
    let n = stepFrom(i, 1);
    if (n !== null && pressure === 2) { const was = tiers[i]; tiers[i] = n; n = stepFrom(i, 1) ?? n; tiers[i] = was; }
    if (n !== null) {
      if (now - climbedAt[i] < 20000) backoff[i] = Math.min(300000, backoff[i] * 2);
      ceilings[i] = n; retryAt[i] = now + backoff[i]; setTier(i, n);
    }
  } else if (gov.healthy >= 3) {
    if (now >= retryAt[i]) ceilings[i] = bestTier;         // a tier that failed gets another chance once its wait is up
    const n = stepFrom(i, -1); if (n !== null) { climbedAt[i] = now; setTier(i, n); }
  }
}
export const qualityInfo = () => ({ gpu: gpuName, integrated, timers: !!timerExt, governing, tiers: [...tiers], ceilings: [...ceilings], ratio,
  preference: qualityPreference, bloom: composers[ui.scene]?.flowBloom?.enabled ?? null, particleFraction: tierOf(ui.scene)?.particles ?? 1,
  cpuMs: gov.judged?.cpu ?? null,
  gpuMs: gov.gpu.length >= 10 ? median(gov.gpu) : gov.judged?.gpu ?? null, drawMs: gov.drawMs,
  composerRatio: composers[ui.scene]?.tierRatio ?? null, ao: aos[ui.scene] ? aos[ui.scene].enabled : null, judged: gov.judged ?? null, pending: gov.q.length, quietFor: Math.max(0, gov.quietUntil - performance.now()), window: gov.frames.length });
// Laptop is a conservative starting floor, never a fixed quality lock.
export function setQualityPreference(value) {
  if (!['auto', 'laptop'].includes(value)) return;
  qualityPreference = value; bestTier = value === 'laptop' ? 4 : mobile ? 3 : 0;
  try { localStorage.setItem('ifx-render-preference', value); } catch { /* optional */ }
  for (let i = 0; i < tiers.length; i++) {
    ceilings[i] = bestTier; retryAt[i] = 0; backoff[i] = 30000;
    // Returning to Auto permits measured recovery; avoid a sudden expensive jump.
    if (forced === null && value === 'auto' && !timerExt) tiers[i] = Math.max(bestTier, integrated ? 1 : 0);
    else if (forced === null && tiers[i] < bestTier) tiers[i] = bestTier;
    if (built[i]) applyTier(i);
  }
  if (ui.scene >= 0) { applyTier(ui.scene); resize(); }
  emit('render-quality');
}
// for probes: put level i at tier n; `hold` keeps it there (it may still step down, never up)
export const forceTier = (n, { hold = false, i = ui.scene } = {}) => { ceilings[i] = hold ? n : Math.min(ceilings[i], n); retryAt[i] = hold ? Infinity : 0; setTier(i, n); };
export const renderScale = () => ratio;
export const getRenderer = () => renderer;
function resize() {
  const w = view.clientWidth, h = view.clientHeight;
  hush(1000);                                             // a new size is a new workload; judge it once it settles
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.fov = w / h < 0.9 ? 48 : 35; camera.updateProjectionMatrix();
  const inspection = built[ui.scene]?.inspection;
  const named = inspection?.views?.[inspection.currentView];
  const selected = ui.selected && hotspotsFor(ui.scene)[ui.selected];
  if (selected?.view.detailSize && !cinema && inspection?.currentView !== 'custom') {
    const fitted = frame(built[ui.scene], selected);
    if (tween) {
      tween.p1.fromArray(fitted.pos); tween.t1.fromArray(fitted.target);
      if (tween.arc) {
        tween.arc.s1.setFromVector3(tween.p1.clone().sub(tween.t1));
        const turn = tween.arc.s1.theta - tween.arc.s0.theta;
        tween.arc.dTheta = turn - Math.round(turn / (2 * Math.PI)) * 2 * Math.PI;
      }
    }
    else { camera.position.fromArray(fitted.pos); controls.target.fromArray(fitted.target); }
  }
  if (named && !tween && !cinema) {
    const preset = cameraPreset(named);
    camera.position.fromArray(preset.pos); controls.target.fromArray(preset.target);
  }
  if (built[ui.scene]?.housingBounds && !ui.selected && !named?.detailSize && inspection?.currentView !== 'custom' && !tween && !cinema) {
    const fitted = housingFrame({ pos: camera.position.toArray(), target: controls.target.toArray() });
    camera.position.fromArray(fitted.pos); controls.target.fromArray(fitted.target);
  }
  composers.forEach(c => c && sizeComposer(c));
  // resizing clears the canvas; draw straight away so a strip opening below the view never flashes it black
  if (ui.scene >= 0 && built[ui.scene] && composers[ui.scene]) { controls.update(); composers[ui.scene].render(); updatePins(); }
}
new ResizeObserver(resize).observe(view);
// the key hints are for first contact: gone after the first drag or scroll in the view
for (const ev of ['pointerdown', 'wheel']) view.addEventListener(ev, () => document.body.classList.add('looked'), { once: true, passive: true });

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
  for (const sel of ['.hud.tl', '.hud.tr', '#hud-btns']) {        // the clock and the phone buttons sit below the view
    const el = document.querySelector(sel); if (!el || el.hidden || getComputedStyle(el).display === 'none') continue;
    const r = el.getBoundingClientRect(); if (!r.width) continue;
    if (r.top - vr.top < vr.height / 2) box.y1 = Math.min(box.y1, toY(r.bottom + 14));   // overlay along the top
    else box.y0 = Math.max(box.y0, toY(r.top - 14));                                        // along the bottom
  }
  return box;
}
function onScreen(pos, target, part, box) {
  _cam.copy(camera); _cam.position.copy(pos); _cam.lookAt(target); _cam.updateMatrixWorld();
  // project at the view's size as it is now, not as the camera last saw it: a tour step that opens or closes the
  // clock strip resizes the view before the ResizeObserver catches up, and a part framed at the old aspect can land
  // off screen once it does (the overview's racks stop on a phone, right after the outage clock closes)
  const w = view.clientWidth, h = view.clientHeight;
  if (w && h) { _cam.aspect = w / h; _cam.fov = w / h < 0.9 ? 48 : 35; _cam.updateProjectionMatrix(); }
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
  const preset = h.view.detailSize ? fitComponent(h.view, view.clientWidth, view.clientHeight, box) : h.view;
  let pos = V(preset.pos), target = V(preset.target);
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
// ---------- depth of field: focus on the part a tour is showing ----------
// Blur grows with distance from the focal plane; scaling the aperture by 1/focus makes it look the same at every scale.
const _fp = new THREE.Vector3();
let campusSoftFocus = true;
function focusDof() {
  const d = dofs[ui.scene]; if (!d) return;
  const campus = !!built[ui.scene]?.cinematography;
  const h = (cinema || campus) && ui.selected && hotspotsFor(ui.scene)[ui.selected];
  const soft = campus && campusSoftFocus;
  d.enabled = (campus ? soft : !!h) && tierOf(ui.scene).dof;
  if (!d.enabled) return;
  const focus = Math.max(0.01, camera.position.distanceTo(h ? _fp.set(...h.pos) : controls.target));
  d.uniforms.focus.value = focus;
  d.uniforms.aperture.value = (campus && !h ? 0.0035 : 0.0045) / focus;
  d.uniforms.maxblur.value = campus && !h ? 0.004 : 0.006;
}

export const campusFocusInfo = () => ({ enabled: campusSoftFocus, available: !!dofs[1] && tierOf(1).dof });
export function setCampusFocus(enabled) { campusSoftFocus = !!enabled; emit('campus-presentation'); }
function housingFrame(c) {
  return fitHousing(c, built[ui.scene]?.housingBounds, view.clientWidth, view.clientHeight, safeBox());
}
function cameraPreset(c) {
  if (c.detailSize) return frame(built[ui.scene], { pos: c.focus, view: c });
  return housingFrame(cameraPresetFor(c, view.clientWidth, view.clientHeight));
}
const overviewCamera = b => ({ ...b.camera, ...(b.cameraByMode?.[ui.mode] || {}) });
export function setCampusView(name) {
  const c = built[ui.scene]?.cinematography?.views[name]; if (!c) return;
  emit('user-camera');
  deselect();
  const opening = cameraPreset(c);
  flyTo(opening.pos, opening.target, reduced ? 0.01 : 1.8);
  emit('campus-presentation', { view: name });
}
export function setInspectionView(name) {
  const c = built[ui.scene]?.inspection?.views?.[name]; if (!c) return;
  emit('user-camera'); deselect();
  built[ui.scene]?.inspection?.setView?.(name);
  built[ui.scene].inspection.currentView = name;
  emit('campus-presentation', { view: name });
  const opening = cameraPreset(c);
  flyTo(opening.pos, opening.target, reduced ? .01 : 1.5, { detail: !!c.detailSize });
}

// ---------- camera moves ----------
// Plain moves slide straight. Cinematic moves (tours) arc: the camera swings around the moving aim point,
// rising and pulling back mid-move, then settles into a slow orbit and push-in while the part is on screen.
let cinema = false, drift = null, driftSign = 1, tourPace = 1;
export const setCinema = on => { cinema = on; if (!on) drift = null; };
// a faster tour flies faster too, by the square root so 8x still reads as a move rather than a cut
export const setTourPace = p => { tourPace = p; };
// level transitions: Full is the whole dive (about 2 s a level), Quick the same moves in about 60% of the time, Instant
// a straight cut. The reader's choice is remembered; reduced motion always cuts.
export const TRANSITIONS = { full: 1, quick: 0.6, instant: 0 };
let transitions = 'quick';
try { const v = localStorage.getItem('ifx-transitions'); if (Object.hasOwn(TRANSITIONS, v)) transitions = v; } catch { /* stay at Quick */ }
export const getTransitions = () => transitions;
export function setTransitions(v) {
  if (!Object.hasOwn(TRANSITIONS, v)) return;
  transitions = v;
  try { localStorage.setItem('ifx-transitions', v); } catch { /* not remembered, still works */ }
}
const ease = u => (u < 0.5 ? 4 * u ** 3 : 1 - Math.pow(-2 * u + 2, 3) / 2);
const easeIn = u => u * u * u, easeOut = u => 1 - (1 - u) ** 3, easeIn2 = u => u * u;
// a straight move with its own easing, for the level transitions: no arc, no drift when it lands
function glide(pos, target, dur, curve) {
  drift = null;
  tween = { p0: camera.position.clone(), t0: controls.target.clone(), p1: pos.clone(), t1: target.clone(), u: 0, dur: reduced ? 0.01 : dur, arc: null, curve, still: true };
}
export function flyTo(pos, target, dur = 1.1, { detail = false } = {}) {
  drift = null;
  const p1 = V(pos), t1 = V(target);
  if (reduced) dur = 0.01;
  let arc = null;
  if ((cinema || detail) && !reduced) {
    const s0 = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    const s1 = new THREE.Spherical().setFromVector3(p1.clone().sub(t1));
    let dTheta = s1.theta - s0.theta; dTheta -= Math.round(dTheta / (2 * Math.PI)) * 2 * Math.PI;   // the short way round
    const travel = controls.target.distanceTo(t1) / Math.max(s0.radius, s1.radius);
    arc = { s0, s1, dTheta, lift: Math.min(0.35, 0.12 + 0.25 * Math.min(1, travel)), pull: Math.min(0.45, 0.15 + 0.3 * Math.min(1, travel)) };
    dur = Math.min(3.4, Math.max(1.8, 1.6 + Math.abs(dTheta) * 0.6 + Math.abs(Math.log(s1.radius / s0.radius)) * 0.45 + travel * 0.6)) / Math.sqrt(tourPace);
    if (detail && !cinema) {
      // A restrained orbit and dolly descend into the component. Settle at the
      // authored angle; no perpetual drift after a reader selects a part.
      arc.lift = .055; arc.pull = .025;
      dur = Math.min(2.1, 1.55 + Math.abs(dTheta) * .16);
    }
  }
  tween = { p0: camera.position.clone(), t0: controls.target.clone(), p1, t1, u: 0, dur, arc, still: detail && !cinema };
}
function stepTween(dt) {
  if (drift && !tween) stepDrift(dt);
  if (!tween) return;
  tween.u = Math.min(1, tween.u + dt / tween.dur);
  const e = (tween.curve || ease)(tween.u), a = tween.arc;
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
    const still = tween.still;
    tween = null;
    if (cinema && !reduced && !still) startDrift();
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
    if (isSide(i)) { b.classList.add('side'); b.hidden = ui.scene !== i; }
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
  built.forEach((b, i) => {
    if (!b) return;
    applyMode(b);
    if (composers[i]) getComposer(i);
  });
  renderSteps();
  const was = ui.selected;
  if (ui.scene >= 0 && built[ui.scene]) buildPanel(ui.scene);
  if (was && ui.scene >= 0 && hasPart(ui.scene, was, m)) select(was, false);   // the same part, told in the new layer
  else if (built[ui.scene]?.cameraByMode) {
    const opening = cameraPreset(overviewCamera(built[ui.scene]));
    flyTo(opening.pos, opening.target, 1.1);
  }
  emit('mode', m);
}
document.querySelectorAll('[data-mode]').forEach(x => x.addEventListener('click', () => setMode(x.dataset.mode)));

const pinsEl = $('pins');
let pins = [];
let expandedPins = null;          // ids of a pin group the reader opened (small screens)
const pinGroups = new Map();
function buildPanel(i) {
  const s = SCENES()[i], parts = partsFor(i);
  $('intro').textContent = built[i]?.variant?.intro?.(ui.mode) || { power: s.intro, data: s.dataIntro, heat: s.heatIntro }[ui.mode];
  if (i === MODULE_LEVEL && moduleBuilder !== sideModule && ui.mode === 'data') {
    $('intro').textContent = $('intro').textContent.replace('Transmit runs along the far side, receive along the near side, each its own chain.', 'Transmit and receive follow separate labeled paths. Internal component placement is representative.');
  }
  $('hud-title').textContent = s.side ? s.title : `${s.n}. ${s.title}`;
  $('optics-variant').hidden = i !== MODULE_LEVEL;
  const back = $('back-out'); back.hidden = !isSide(i);
  if (isSide(i)) {
    const t = SCENES()[backTarget()].title;
    back.innerHTML = `<span class="bo-action">← Back outside</span><span class="bo-destination">${t}</span>`;
    back.setAttribute('aria-label', `Back outside to ${t}`);
  }
  $('hud-sub').textContent = `${voltFor(s).name} · ${s.scale}`;
  const list = $('parts'); list.innerHTML = '';
  $('parts-k').textContent = `${{ power: 'Power', data: 'Data', heat: 'Heat' }[ui.mode]} · ${s.side ? 'inside the links' : `level ${s.n}`} · ${parts.length} parts`;
  const tabN = $('parts-n'); if (tabN) { tabN.textContent = parts.length; tabN.setAttribute('aria-label', `, ${parts.length} parts`); }
  const playThese = $('play-these');
  if (playThese) { playThese.textContent = `▶ Play 1 to ${parts.length}`; playThese.hidden = !parts.length; }
  const overviewRow = document.createElement('li'), overview = document.createElement('button');
  overview.type = 'button'; overview.dataset.overview = ''; overview.setAttribute('aria-pressed', 'true');
  overview.setAttribute('aria-label', `0. Overview of ${s.title}`);
  overview.innerHTML = '<span class="pn">0</span><span class="pt">Overview</span><span class="pk">Full view</span>';
  overview.addEventListener('click', () => selectOverview());
  overviewRow.appendChild(overview); list.appendChild(overviewRow);
  parts.forEach((p, n) => {
    const li = document.createElement('li'), b = document.createElement('button');
    b.type = 'button'; b.dataset.id = p.id; b.setAttribute('aria-pressed', 'false');
    b.innerHTML = `<span class="pn">${n + 1}</span><span class="pt">${p.title}</span><span class="pk">${p.drill === undefined ? '' : isInward(i, drillOf(p)) ? 'inside →' : 'out ↑'}</span>`;
    b.addEventListener('click', () => select(p.id, true));
    li.appendChild(b); list.appendChild(li);
  });
  pinsEl.innerHTML = ''; pinGroups.clear(); expandedPins = null;
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
// bring the selected row and its card into the side pane's view, scrolling the pane alone (never the page): both
// when they fit, otherwise the card's top
function revealInPane(els) {
  const sc = document.querySelector('.panel-scroll'); if (!sc || document.body.classList.contains('story') || sc.scrollHeight <= sc.clientHeight) return;
  const pr = sc.getBoundingClientRect(), rs = els.filter(Boolean).map(e => e.getBoundingClientRect()); if (!rs.length) return;
  const top = Math.min(...rs.map(r => r.top)), bottom = Math.max(...rs.map(r => r.bottom)), pad = 12;
  const dy = bottom - top > pr.height ? rs[rs.length - 1].top - pr.top - pad : bottom > pr.bottom ? bottom - pr.bottom + pad : top < pr.top ? top - pr.top - pad : 0;
  if (dy) sc.scrollBy({ top: dy, behavior: reduced ? 'auto' : 'smooth' });
}
export function select(id, fly) {
  const parts = partsFor(ui.scene), p = parts.find(q => q.id === id); if (!p) return;
  if (built[ui.scene]?.inspection) built[ui.scene].inspection.currentView = '';
  if (ui.mode !== 'heat') built[ui.scene]?.inspection?.setCovers?.(false);
  const presentation = built[ui.scene]?.presentation;
  if (presentation && (presentation.amount !== 1 || presentation.explode !== 1)) {
    presentation.setExplode(1, { immediate: true });
    renderer.shadowMap.needsUpdate = true;
    emit('module-presentation');
  }
  ui.selected = id;
  document.querySelectorAll('#parts button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === id)));
  pins.forEach(pn => pn.el.classList.toggle('on', pn.id === id));
  $('card').hidden = false;
  $('card-k').textContent = p.kicker; $('card-t').textContent = p.title; $('card-b').textContent = p.body;
  const key = `card:${ui.mode}:${SCENES()[ui.scene].id}:${id}`;   // each row's chip opens that row's own evidence
  $('card-s').innerHTML = p.specs.map(([k, v, b], i) => `<div><dt>${k}</dt><dd>${v}</dd>${basisChip(b, `${key}:${i}`, k)}</div>`).join('');
  const go_ = $('card-go'), to = drillOf(p), inw = isInward(ui.scene, to); go_.hidden = p.drill === undefined;
  if (p.drill !== undefined) go_.textContent = `${inw ? 'Go inside' : 'Back out'}: ${SCENES()[to].title} ${inw ? '→' : '↑'}`;
  go_.onclick = () => (p.drill === 'out' ? backOut() : go(drillOf(p), id));
  if (fly) { const h = hotspotsFor(ui.scene)[id]; if (h?.view) { const f = frame(built[ui.scene], h); flyTo(f.pos, f.target, 1.1, { detail: !!h.view.detailSize }); } }
  revealInPane([document.querySelector(`#parts button[data-id="${id}"]`)?.closest('li'), $('card')]);
  emit('select', { scene: ui.scene, mode: ui.mode, id });
}
export function deselect() {
  ui.selected = null; $('card').hidden = true;
  pins.forEach(p => p.el.classList.remove('on'));
  document.querySelectorAll('#parts button').forEach(b => b.setAttribute('aria-pressed', String(b.hasAttribute('data-overview'))));
}
async function selectOverview() {
  if (ui.scene < 0) return;
  const focusOverview = $('card').contains(document.activeElement);
  emit('user-camera');
  await show({ scene: ui.scene, mode: ui.mode, part: null }, { scroll: false });
  if (focusOverview) document.querySelector('#parts button[data-overview]')?.focus({ preventScroll: true });
  revealInPane([$('intro')]);
}
export function setModuleExplode(value, { frame: reframe = true } = {}) {
  const b = built[ui.scene]; if (!b?.presentation) return;
  deselect();
  b.presentation.setExplode(value, { immediate: reduced });
  renderer.shadowMap.needsUpdate = true;
  if (reframe) {
    const c = value < 0.5 ? b.presentation.assembledCamera : b.camera;
    const opening = cameraPreset(c);
    flyTo(opening.pos, opening.target, reduced ? 0.01 : 1.4);
  }
  emit('module-presentation');
}
$('card-prev').addEventListener('click', () => cycle(-1));
$('card-next').addEventListener('click', () => cycle(1));
export function cycle(d) {
  const parts = partsFor(ui.scene);
  // Overview is stop 0; real parts retain their existing numbers and tour order.
  const i = parts.findIndex(p => p.id === ui.selected) + 1;
  const n = (i + d + parts.length + 1) % (parts.length + 1);
  if (n === 0) selectOverview();
  else select(parts[n - 1].id, true);
}
export const hasPart = (scene, id, mode = ui.mode) => !!(PARTS_BY()[mode][SCENES()[scene].id] || []).find(p => p.id === id);

// ---------- level transitions ----------
// Going in, the camera dives at the part that holds the next level (the hall on the campus, a rack in the hall, a
// tray in the rack, the GPU on the tray) while an iris closes on it; the black names the level and the step in scale;
// then the new level opens from close in and pulls back. Going out runs the other way: pull back, close, and open on
// the part of the outer level you just came out of. Reduced motion keeps the plain fade.
function portalOf(scene, into) {
  const b = built[scene]; if (!b) return null;
  const maps = { power: b.hotspots, data: b.dataHotspots, heat: b.heatHotspots }, id = SCENES()[scene].id;
  for (const mode of [ui.mode, 'power', 'data', 'heat']) {
    const p = (PARTS_BY()[mode][id] || []).find(q => q.drill === into && maps[mode]?.[q.id]);
    if (p) return V(maps[mode][p.id].pos);
  }
  return null;
}
const veilEl = $('veil');
let iris = null, irisR = 0, travelSeq = 0;
const irisFull = () => Math.hypot(view.clientWidth, view.clientHeight) + 80;
const _ip = new THREE.Vector3();
function irisTo(r1, dur, at) {
  return new Promise(res => {
    if (!veilEl.classList.contains('iris')) { irisR = irisFull(); stepIrisStyle(null); veilEl.classList.add('iris'); veilEl.classList.remove('off'); }
    iris?.res();                                         // whoever waited on the iris this replaces is let go, never stranded
    iris = { r0: irisR, r1, t: 0, dur: Math.max(0.01, dur), at, res };
  });
}
function stepIrisStyle(at) {
  let x = view.clientWidth / 2, y = view.clientHeight / 2;
  if (at) { _ip.copy(at).project(camera); if (_ip.z < 1) { x = (_ip.x + 1) / 2 * view.clientWidth; y = (1 - _ip.y) / 2 * view.clientHeight; } }
  veilEl.style.setProperty('--ix', `${x.toFixed(1)}px`); veilEl.style.setProperty('--iy', `${y.toFixed(1)}px`); veilEl.style.setProperty('--ir', `${irisR.toFixed(1)}px`);
}
function stepIris(dt) {
  if (!iris) return;
  iris.t = Math.min(1, iris.t + dt / iris.dur);
  const u = iris.t, e = iris.r1 < iris.r0 ? easeIn(u) * 0.35 + u * u * (3 - 2 * u) * 0.65 : easeOut(u);
  irisR = iris.r0 + (iris.r1 - iris.r0) * e;
  stepIrisStyle(iris.at);
  if (iris.t >= 1) { const r = iris.res; iris = null; r(); }
}
function jumpLabel(from, to) {
  const a = SCENES()[from], b = SCENES()[to];
  const where = isSide(to) && isSide(from) ? 'Across' : isSide(to) ? `In · inside level ${SCENES()[sideEntered ? from : SIDE_PARENT[to]].n}` : isSide(from) ? `Out · level ${b.n} of ${MAIN_LEVELS}` : `${to > from ? 'In' : 'Out'} · level ${b.n} of ${MAIN_LEVELS}`;
  return `<div class="jump"><span class="jump-k">${where}</span><b>${b.title}</b><span class="jump-s">${a.scale} → ${b.scale}</span></div>`;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- scene switching ----------
let busy = false, queued = null, goingTo = -1;
export async function go(i, fromId, { force = false, keepCamera = false, fromShow = false } = {}) {
  if (!force && !fromShow) showSeq++;                      // the reader moved: drop any jump still waiting for its scene
  if (busy) { queued = [i, fromId, { force, keepCamera }]; return; }   // the latest request runs when this switch lands
  if ((i === ui.scene && !force) || i < 0 || i >= BUILDERS.length) return;
  busy = true; goingTo = i;
  const veil = $('veil');
  const same = i === ui.scene;
  // a door entry records the way back (level, part, layer); any other way in, a share link or a jump, clears it so
  // Back goes to the level that holds that diagram
  if (isSide(i) && !isSide(ui.scene) && ui.scene >= 0) { if (fromId) { sideFrom = ui.scene; sideVia = fromId; sideMode = ui.mode; sideEntered = true; } else sideEntered = false; }
  const from = ui.scene, inward = isInward(from, i), T = TRANSITIONS[transitions] / Math.sqrt(cinema ? tourPace : 1);
  const cut = reduced || transitions === 'instant';
  const travel = from >= 0 && !same && !cut;              // a level transition, rather than the first load or a rebuild
  const swap = cut && from >= 0 && !same && !!built[i];   // a cut to a level already built: nothing to cover
  let closedAt = 0;
  const mine = from >= 0 && !same ? ++travelSeq : travelSeq;   // any newer switch takes the iris over from this one
  if (!travel && from >= 0 && !same && veilEl.classList.contains('iris')) {   // a cut while a dive is still opening
    const r = iris?.res; iris = null; r?.();
    veilEl.style.transition = 'none'; veilEl.classList.add('off'); veilEl.classList.remove('iris'); veilEl.textContent = ''; void veilEl.offsetWidth; veilEl.style.transition = '';
    view.classList.remove('diving');
  }
  if (travel) {
    view.classList.add('diving');
    veil.innerHTML = jumpLabel(from, i);                   // the next level's name, revealed as the view closes around it
    // the side level has more than one way in (the hall's pluggables and its CPO switch): dive at the one picked
    const via = isSide(i) && fromId ? hotspotsFor(from)[fromId] : null;
    let portal = via ? V(via.pos) : inward ? portalOf(from, isSide(i) ? i : from + 1) : null;
    if (inward && !portal && fromId) { const h = hotspotsFor(from)[fromId]; if (h) portal = V(h.pos); }
    if (portal) {                                          // dive at the part that holds the next level
      glide(portal.clone().lerp(camera.position, 0.05), portal, 0.95 * T, easeIn2);
      await irisTo(0, 0.95 * T, portal);
    } else {                                               // pull straight back and close on the middle
      glide(controls.target.clone().add(camera.position.clone().sub(controls.target).multiplyScalar(2.6)), controls.target.clone(), 0.8 * T, easeIn);
      await irisTo(0, 0.8 * T, null);
    }
    closedAt = performance.now();
  } else if (from >= 0 && !same && !swap) {
    veil.textContent = ''; veil.classList.remove('off');
    await sleep(cut ? 0 : 420);
  }
  // a rebuild in place (a new scenario) never touches the veil: it may be holding a transition's level name
  if (!travel && !swap && !same) veil.textContent = `Building ${SCENES()[i].title.toLowerCase()}…`;
  if (!same && !travel && !swap) veil.classList.remove('off');
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  try {
    let requestedModel;
    do {
      requestedModel = store.M;
      await assetLoaders.get(i)?.({ model: requestedModel, quality });
    } while (requestedModel !== store.M);
  } catch (error) {
    busy = false; goingTo = -1;
    view.classList.remove('diving'); veil.classList.remove('iris');
    veil.textContent = 'This model could not load. Select the level again to retry.';
    veil.classList.remove('off');
    console.error('Model asset load failed', error);
    if (queued) { const q = queued; queued = null; go(...q); }
    return;
  }
  const b = getScene(i); getComposer(i);
  ui.scene = i;
  b.inspection?.setView?.('diagram');
  if (b.inspection) b.inspection.currentView = 'diagram';
  DETAIL.unit.value = SCENES()[i].unit;                   // surface detail at this scale's real size
  if (mobile) built.forEach((bb, j) => { if (bb && Math.abs(j - i) > 1) { disposeScene(bb); disposeComposer(composers[j]); built[j] = undefined; composers[j] = undefined; } });
  const c = (isSide(i) && b.cameraFrom?.[sideVia]) || overviewCamera(b);   // the side level opens on the half you came in for
  camera.near = c.near; camera.far = c.far; camera.updateProjectionMatrix();
  controls.minDistance = c.min; controls.maxDistance = c.max;
  renderer.toneMappingExposure = lookOf(i).exposure;
  let openAt = null, arrive = null;
  if (!keepCamera) {
    // arrive pushed in, then pull back to the scene's opening view; portrait screens get closer
    // portrait screens get closer, unless the level brings its own portrait view (a side level's diagram has to fit whole)
    const portrait = view.clientWidth / view.clientHeight < .9 || (b.cinematography && view.clientWidth < 600);
    const preset = cameraPreset(c), cp = preset !== c ? preset : null;
    const tgt = V(cp ? cp.target : c.target), end = cp ? V(cp.pos) : portrait ? tgt.clone().lerp(V(c.pos), 0.72) : V(c.pos);
    if (travel) {
      // in: from right up against the new level, as if the dive carried on; out: from the part just left
      const outVia = isSide(from) && !isSide(i) && sideVia ? hotspotsFor(i)[sideVia] : null;   // back out at the part the reader went in by
      const back = inward ? null : outVia ? V(outVia.pos) : portalOf(i, isSide(from) ? from : i + 1);
      const aim = back || tgt;
      tween = null; drift = null;                          // the dive's own move ends here, not under the new level
      camera.position.copy(aim.clone().lerp(end, inward ? 0.08 : 0.06)); controls.target.copy(aim); controls.update();
      const at = camera.position.clone();                 // pull back as the view opens, so the arrival is seen
      // unless a tour or the reader has moved it meanwhile (the controls settle it by a hair each frame, hence the slack)
      arrive = () => { if (!tween && camera.position.distanceTo(at) < 0.01 * at.distanceTo(controls.target)) glide(end, tgt, 1.5 * T, easeOut); };
      openAt = back;
    } else {
      camera.position.copy(tgt.clone().lerp(end, 0.35)); controls.target.copy(tgt); controls.update();
      flyTo(end.toArray(), tgt.toArray(), from >= 0 && cut ? 0.01 : 1.6);   // the first load still flies in
    }
  }
  if (i === MODULE_LEVEL) applyVariant();
  buildPanel(i);
  renderSteps();
  applyTier(i);
  resize();
  hush(1500);
  if (travel) {
    // Reed, 09/27: the level's name flashed by. It now stays up long enough to read (about 1.4 s at Full, 0.85 s at
    // Quick, never under 0.8 s even in a fast tour), counted from when it went up, and the view opens only once the new
    // level has drawn a few frames behind it, so its first frames' stutter stays hidden. The switch itself is done:
    // anyone waiting on go() carries on meanwhile.
    const f0 = frameN, readUntil = closedAt + Math.max(800, 1400 * T);
    (async () => {
      await until(() => mine !== travelSeq || frameN >= f0 + 3, 3000);
      if (performance.now() < readUntil) await sleep(readUntil - performance.now());
      if (mine !== travelSeq) return;                      // the reader has already moved on; that transition opens instead
      arrive?.();
      await irisTo(irisFull(), 0.75 * T, openAt);
      if (mine !== travelSeq) return;
      // hand back to the plain veil without its fade: fully open already, so it must not flash dark on the way
      veilEl.style.transition = 'none'; veilEl.classList.add('off'); veilEl.classList.remove('iris'); void veilEl.offsetWidth; veilEl.style.transition = '';
      veilEl.textContent = '';
      view.classList.remove('diving');
    })();
  } else veil.classList.add('off');
  busy = false;
  emit('scene', i);
  if (queued) { const q = queued; queued = null; go(...q); }
  else if (built[ui.scene]?.model !== store.M) go(ui.scene, null, { force: true, keepCamera: true });   // the scenario changed mid-switch
}
export const sceneCount = BUILDERS.length;
// Back out of a side level to the level, layer and door part the reader came in by
export async function backOut() {
  if (!isSide(ui.scene)) return;
  const restoreFocus = document.activeElement === $('back-out');
  const to = backTarget(), via = sideEntered ? sideVia : null, mode = sideEntered ? sideMode : null;
  if (mode && mode !== ui.mode) setMode(mode);
  await go(to, null);
  if (via && hasPart(to, via)) select(via, true);
  if (restoreFocus) {
    const row = [...document.querySelectorAll('#parts button')].find(b => via && b.dataset.id === via)
      || document.querySelector('#parts button[data-overview]');
    row?.focus({ preventScroll: true });
  }
}
$('back-out')?.addEventListener('click', () => backOut());
export const isBusy = () => busy;
export const isCameraMoving = () => busy || !!tween;
// the level the view is on or on its way to: a switch in flight assigns ui.scene only partway through (after the
// level is built, which can take seconds on a slow device), and a switch queued behind it lands after that
export const destination = () => queued && queued[0] >= 0 && queued[0] < BUILDERS.length ? queued[0] : busy ? goingTo : ui.scene;

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
  else {
    deselect();
    built[scene].inspection?.setView?.('diagram');
    if (built[scene].inspection) built[scene].inspection.currentView = 'diagram';
    built[scene].presentation?.setExplode(1, { immediate: true });
    renderer.shadowMap.needsUpdate = true;
    emit('module-presentation');
    emit('campus-presentation');
    const opening = cameraPreset(overviewCamera(built[scene]));
    flyTo(opening.pos, opening.target, 1.6);
    emit('select', { scene: ui.scene, mode: ui.mode, id: null });
  }
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
  built.length = 0; composers.length = 0; aos.length = 0; dofs.length = 0; finishes.length = 0;
  renderSteps();
  // mid-switch, go() rebuilds the level it lands on once it is done; a rebuild queued now would name the old level
  if (ui.scene >= 0 && !busy) go(ui.scene, null, { force: true, keepCamera: true });
});

// ---------- scale bar ----------
function updateScale() {
  const s = SCENES()[ui.scene]; if (!s) return;
  const d = camera.position.distanceTo(controls.target);
  const mPerPx = 2 * d * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / view.clientHeight * s.unit;
  const target = mPerPx * (view.clientWidth < 520 ? 80 : 110), pow = Math.pow(10, Math.floor(Math.log10(target)));
  const nice = [1, 2, 5, 10].map(k => k * pow).reduce((a, b) => Math.abs(b - target) < Math.abs(a - target) ? b : a);
  const px = nice / mPerPx;
  $('scale-bar').style.width = `${px.toFixed(0)}px`;
  $('scale-label').textContent = nice >= 1000 ? `${nice / 1000} km` : nice >= 1 ? `${nice} m` : nice >= 0.01 ? `${+(nice * 100).toFixed(2)} cm` : `${+(nice * 1000).toFixed(2)} mm`;
}

// ---------- pins ----------
const pv = new THREE.Vector3();
// group badges for piled-up pins on small screens: "2 +4" is pin 2 and four more; a tap fans them all out
function syncPinGroups(groups, w, h) {
  const live = new Set();
  for (const g of groups) {
    live.add(g.key);
    let el = pinGroups.get(g.key);
    if (!el || !el.isConnected) {
      el = document.createElement('button'); el.type = 'button'; el.className = 'pin-group';
      const nums = g.ids.map(id => pins.find(p => p.id === id)?.el.querySelector('.num')?.textContent).filter(Boolean);
      el.innerHTML = `<b>${nums[0]}</b><span>+${nums.length - 1}</span>`;
      el.setAttribute('aria-label', `${nums.length} parts here: ${nums.join(', ')}. Show them`);
      el.addEventListener('click', e => { e.stopPropagation(); expandedPins = new Set(g.ids); });
      pinsEl.appendChild(el); pinGroups.set(g.key, el);
    }
    el.style.transform = `translate(${(Math.max(20, Math.min(w - 20, g.x))).toFixed(1)}px, ${(Math.max(14, Math.min(h - 14, g.y))).toFixed(1)}px) translate(-50%, -50%)`;
  }
  for (const [key, el] of pinGroups) if (!live.has(key)) { el.remove(); pinGroups.delete(key); }
}
// a tap anywhere else in the view folds an opened group back up
view.addEventListener('pointerdown', e => { if (expandedPins && !e.target.closest?.('.pin, .pin-group')) expandedPins = null; });
function updatePins() {
  const w = view.clientWidth, h = view.clientHeight, placed = [];
  const vr = view.getBoundingClientRect(), reserved = [];
  for (const el of document.querySelectorAll('#view .hud, #hud-btns')) {
    if (el.hidden || getComputedStyle(el).display === 'none') continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || r.bottom <= vr.top || r.top >= vr.bottom) continue;
    reserved.push({ left: r.left - vr.left, right: r.right - vr.left, top: r.top - vr.top, bottom: r.bottom - vr.top });
  }
  const presentation = built[ui.scene]?.presentation || built[ui.scene]?.cinematography;
  const compact = presentation?.compactPins || isSide(ui.scene);
  const ordered = [...pins].sort((a, b) => Number(b.id === ui.selected) - Number(a.id === ui.selected));
  const pinPoints = ordered.map(p => {
    pv.copy(p.pos).project(camera);
    return { id: p.id, x: (pv.x + 1) / 2 * w, y: (1 - pv.y) / 2 * h, z: pv.z };
  });
  // Small screens: pins that pile up are fanned out or gathered into a group badge (declutterPins) instead of
  // overlapping or being dropped. The selected pin never joins a cluster.
  const small = w < 640;
  let clutter = null;
  if (small && !presentation?.hidePins) {
    const cands = [];
    for (const q of pinPoints) {
      if (q.id === ui.selected || q.z > 1 || q.x < 6 || q.x > w - 6 || q.y < 6 || q.y > h - 6) continue;
      if (reserved.some(r => overlapsRect({ left: q.x - 13, right: q.x + 13, top: q.y - 13, bottom: q.y + 13 }, r, 4))) continue;
      cands.push(q);
    }
    cands.sort((a, b) => pins.findIndex(p => p.id === a.id) - pins.findIndex(p => p.id === b.id));
    clutter = declutterPins(cands, { expanded: expandedPins });
  }
  syncPinGroups(clutter?.groups || [], w, h);
  for (const p of ordered) {
    pv.copy(p.pos).project(camera);
    let x = (pv.x + 1) / 2 * w, y = (1 - pv.y) / 2 * h;
    const spot = clutter?.placements.get(p.id);
    const fanned = !!spot && (Math.abs(spot.x - x) > .5 || Math.abs(spot.y - y) > .5);
    if (spot) { x = Math.max(12, Math.min(w - 12, spot.x)); y = Math.max(12, Math.min(h - 12, spot.y)); }
    p.el.classList.toggle('fanned', fanned);
    if (fanned) {
      const dx = spot.ax - x, dy = spot.ay - y;
      const lead = Math.hypot(dx, dy) - 14; p.el.style.setProperty('--lead-len', `${lead > 8 ? lead.toFixed(1) : 0}px`);
      p.el.style.setProperty('--lead-a', `${Math.atan2(dy, dx).toFixed(3)}rad`);
    }
    // Nearby optical elements share a small footprint. Keep their buttons from
    // intercepting each other; every part remains selectable in the inspector.
    const overlaps = !clutter && compact && p.id !== ui.selected && placed.some(q => Math.hypot(q[0] - x, q[1] - y) < 28);
    const markerBlocked = !spot && reserved.some(r => overlapsRect({ left: x - 13, right: x + 13, top: y - 13, bottom: y + 13 }, r, 4));
    const off = presentation?.hidePins || overlaps || !!clutter?.hidden.has(p.id) || (markerBlocked && p.id !== ui.selected) || pv.z > 1 || x < 6 || x > w - 6 || y < 6 || y > h - 6;
    p.el.classList.toggle('off', off);
    if (off) continue;
    p.el.style.transform = `translate(${(x - 11).toFixed(1)}px, ${(y - 11).toFixed(1)}px)`;
    p.el.querySelector('.num').style.visibility = markerBlocked ? 'hidden' : '';
    const lbl = p.el.querySelector('.lbl'), labelWidth = (p.lw ||= lbl.offsetWidth) || 120;
    const labelBox = pinLabelBox(x, y, labelWidth, w, h, reserved, p.id === ui.selected);
    p.el.classList.remove('flip');
    const left = labelBox?.left ?? x + 18, right = labelBox?.right ?? left + labelWidth;
    Object.assign(lbl.style, { position: 'absolute', right: 'auto', left: `${left - x + 11}px`, top: `${(labelBox?.top ?? y - 9) - y + 11}px` });
    // Also reserve future numbered buttons: a later circle must not obscure an
    // earlier label merely because it was visited later in the part list.
    const crowded = placed.some(q => Math.abs(q[1] - y) < 24 && left < q[3] + 12 && right > q[2] - 12)
      || pinPoints.some(q => q.id !== p.id && q.z <= 1 && Math.abs(q.y - y) < 24 && q.x + 13 > left && q.x - 13 < right);
    const hideLabel = !labelBox || (crowded && p.id !== ui.selected);
    p.el.classList.toggle('hide-lbl', hideLabel); lbl.style.visibility = hideLabel ? 'hidden' : '';
    if (p.id === ui.selected && labelBox) reserved.push(labelBox);
    placed.push([x, y, hideLabel ? x - 11 : Math.min(x - 11, left), hideLabel ? x + 11 : Math.max(x + 11, right)]);
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
timer.connect(document);                                  // no rAF runs while the tab is hidden: resume without a jump
// the frames straight after coming back say nothing about this tier
document.addEventListener('visibilitychange', () => { if (!document.hidden) hush(1500); });
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
onTick(stepIris);
new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(view);
function loop(ts) {
  requestAnimationFrame(loop);
  timer.update(ts);
  const raw = timer.getDelta(), dt = Math.min(raw, 0.05);
  tickers.forEach(fn => fn(dt));
  if (!visible || document.hidden || ui.scene < 0 || !built[ui.scene]) return;
  t += reduced ? dt * 0.35 : dt;
  const b = built[ui.scene];
  const frameStarted = performance.now();
  applyLevels(b);
  const projection = { position: camera.position,
    worldPerPixelAtUnit: 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.max(1, view.clientHeight) };
  for (const f of flowsFor(b)) f.update(t, projection);
  if (b.update(t, dt) === true) renderer.shadowMap.needsUpdate = true;
  stepTween(dt);
  controls.update();
  fitDepthRange(b.camera);
  if (finishes[ui.scene]) finishes[ui.scene].uniforms.uTime.value = t;
  focusDof();
  if (compareProbe || frameListeners.size) renderer.info.reset();
  gpuBegin(); const d0 = performance.now(); composers[ui.scene].render(); gov.drawMs = performance.now() - d0; gpuEnd();
  gov.workMs = performance.now() - frameStarted;
  if (!tween) govern(raw);                                // judge speed on steady frames, never mid-move
  updatePins();
  if (frameN++ % 6 === 0) updateScale();
  if (frameListeners.size) {
    const r = renderer.info.render;
    const sample = { dt: raw * 1000, cpuMs: performance.now() - frameStarted, submitMs: gov.drawMs, calls: r.calls, triangles: r.triangles };
    frameListeners.forEach(fn => fn(sample));
  }
}

addEventListener('keydown', e => {
  if (e.target.matches('input, textarea, select') || e.target.closest?.('.pace-menu')) return;
  if (!stageActive()) return;                              // scoped to the stage: see stageActive above
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
