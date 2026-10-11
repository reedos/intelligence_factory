// Complete static compute hardware authored in Blender. Native builders supply
// the teaching contract only: routes, scenario counts, cameras and animations.
import { gltfLoader } from './gltf-loader.js';
import { build as rack } from './rack.js';
import { build as tray } from './tray.js';
import { build as chip } from './chip.js';
import { applyPcb, PCB_MATERIAL } from './tray-pcb.js';
import { rackMarks } from './electrical-marks.js';
import { rackManifoldMarks } from './cooling-marks.js';
import { surfaceHit, realizeSpots } from './print-kit.js';
import * as THREE from 'three';
import { canvasTex } from '../kit.js';

const cache = new Map(), pending = new Map();
const physical = o => o.isMesh && !o.isReflector && !o.userData.computeDynamic && !o.userData.nativeOverlay && !o.userData.printed   // nativeOverlay: kept native, never baked (rack-mgmt.js)
  && (Array.isArray(o.material) ? o.material : [o.material]).some(m => !m.isMeshBasicMaterial && !m.isShaderMaterial);
const variant = (_kind, model) => model.accel.id;
const assetKey = (kind, model) => `compute-${kind}-${variant(kind, model)}`;

async function load(key) {
  if (cache.has(key)) return;
  if (!pending.has(key)) pending.set(key, gltfLoader().loadAsync(`${import.meta.env?.BASE_URL || '/'}models/${key}.glb?v=r3blender`)
    .then(gltf => { cache.set(key, gltf.scene); pending.delete(key); })
    .catch(error => { pending.delete(key); throw error; }));
  await pending.get(key);
}
export async function preloadCompute(kind, model) {
  // the rack's pulled tray is the tray level's own hardware: the same file, seated in the rack (build, below)
  await Promise.all([load(assetKey(kind, model)), kind === 'rack' && load(assetKey('tray', model)), load(kind === 'chip' ? 'compute-solder' : 'compute-rotor')]);
}

function ownedClone(source) {
  const root = source.clone(true), geometries = new Map(), materials = new Map(), textures = new Map();
  root.traverse(o => {
    if (o.geometry) {
      if (!geometries.has(o.geometry)) geometries.set(o.geometry, o.geometry.clone());
      o.geometry = geometries.get(o.geometry);
    }
    if (!o.material) return;
    const copy = material => {
      if (!materials.has(material)) {
        const result = material.clone();
        for (const [key, value] of Object.entries(result)) if (value?.isTexture) {
          if (!textures.has(value)) textures.set(value, value.clone());
          result[key] = textures.get(value);
        }
        materials.set(material, result);
      }
      return materials.get(material);
    };
    o.material = Array.isArray(o.material) ? o.material.map(copy) : copy(o.material);
  });
  return root;
}

// Round 5 (graphics): the GPU die is polished backside silicon, a dark near-mirror, not a slate card. A faint
// backgrind texture - wide concentric arcs left by the grinding wheel - breaks the key light across it (roughness
// about 0.12 to 0.25). Dies carry no usable UVs in the tray file, so the arcs are projected by position, top-down,
// over each die's own footprint. Emissive (the data/heat cues) and the animated-surface key are left untouched.
const DIE = /^GPU die silicon backside/;
function backgrind() {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = 'rgb(46,46,46)'; g.fillRect(0, 0, w, h);
    let seed = 29; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const cx = -0.55 * w, cy = 1.45 * h;
    for (let r = 0.9 * w; r < 2.6 * w; r += 2 + rnd() * 3) {
      const v = 31 + Math.round(rnd() * 33);
      g.strokeStyle = `rgba(${v},${v},${v},0.55)`; g.lineWidth = 1 + rnd() * 1.6;
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
    }
  }, { srgb: false });
}
function finishDies(root) {
  if (typeof document === 'undefined') return;
  const dies = [], box = new THREE.Box3(), v = new THREE.Vector3();
  root.updateMatrixWorld(true);
  root.traverse(o => { if (o.isMesh && !Array.isArray(o.material) && DIE.test(o.material.name)) dies.push(o); });
  if (!dies.length) return;
  const rough = backgrind(), done = new Set();
  for (const mesh of dies) {
    const m = mesh.material;
    if (!done.has(m)) {
      done.add(m);
      m.color.set(0x2a313c); m.metalness = 0.6; m.roughness = 1.3; m.roughnessMap = rough;   // about 0.16 to 0.33: the key light's highlight spreads instead of whiting out the die
      if (m.clearcoat) { m.clearcoatRoughness = 1; m.clearcoatRoughnessMap = rough; }   // the chip's clearcoat shows the arcs too
      m.envMapIntensity = Math.max(m.envMapIntensity ?? 1, 1.1); m.needsUpdate = true;
    }
    const pos = mesh.geometry.attributes.position, uv = new Float32Array(pos.count * 2);
    box.makeEmpty();
    for (let i = 0; i < pos.count; i++) box.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld));
    const w = Math.max(box.max.x - box.min.x, 1e-6), d = Math.max(box.max.z - box.min.z, 1e-6);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      uv[i * 2] = (v.x - box.min.x) / w; uv[i * 2 + 1] = (v.z - box.min.z) / d;
    }
    mesh.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }
}

function build(kind, native, options) {
  const key = assetKey(kind, options.model), source = cache.get(key);
  if (!source) throw new Error(`Call ${kind}Builder.preload({model}) before build.`);
  let generation; source.traverse(o => { if (o.userData.ifxCompute) generation = JSON.parse(o.userData.ifxCompute); });
  if (generation?.scene !== kind || generation?.accel !== options.model.accel.id) throw new Error('Compute asset generation does not match the requested scene.');
  const built = native(options), hardware = ownedClone(source), dynamic = new Set();
  for (const name of ['flows', 'dataFlows', 'heatFlows']) for (const f of built[name] || []) f.group.traverse(o => dynamic.add(o));
  const obsolete = [], nativeMaterials = new Map(), rotors = [];
  built.scene.traverse(o => {
    if (o.userData.computeDynamic) rotors.push(o);
    if (dynamic.has(o) || !physical(o)) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (!nativeMaterials.has(m)) nativeMaterials.set(m, nativeMaterials.size);
    obsolete.push(o);
  });
  const materialSources = new Map([...nativeMaterials.keys()].filter(m => m.userData.ifxAnimatedSurface).map(m => [m.userData.ifxAnimatedSurface, m])), pulses = [], covers = [];
  hardware.scale.setScalar(kind === 'rack' ? 1 : kind === 'tray' ? 10 : 100);
  hardware.name = `Blender complete ${kind} hardware`;
  const dress = root => root.traverse(o => {
    if (!o.isMesh) return;
    o.geometry.userData.authoredIn = 'Blender';
    const materials = Array.isArray(o.material) ? o.material : [o.material];
    const transparent = materials.some(m => m.transparent || m.opacity < 1);
    if (materials.some(m => m.userData.ifxCoverSurface === 'ihs')) covers.push(o);
    // Millimetre-scale SMD parts cast no visible shadow; skipping the shadow pass saves draw calls.
    const tiny = materials.some(m => /^PCB passive/.test(m.name));
    o.castShadow = !!options.quality.shadows && !transparent && !tiny;
    o.receiveShadow = !!options.quality.shadows;
    for (const material of materials) {
      if (transparent) material.depthWrite = false;
      const sourceMaterial = materialSources.get(material.userData.ifxAnimatedSurface);
      if (sourceMaterial) pulses.push([material, sourceMaterial]);
    }
  });
  dress(hardware);
  finishDies(hardware);
  for (const o of obsolete) { o.removeFromParent(); o.geometry.dispose(); }
  if (rotors.length) {
    // compute-solder carries a reflowed BGA ball and a lighter C4 bump mesh.
    const shapes = [];
    cache.get(kind === 'chip' ? 'compute-solder' : 'compute-rotor').traverse(o => { if (o.isMesh) shapes.push(o); });
    if (!shapes.length) throw new Error('Blender fan rotor asset has no mesh.');
    const shapeFor = dynamic => (dynamic === 'c4' && shapes.find(o => /C4 bump/.test(o.name)))
      || shapes.find(o => !/C4 bump/.test(o.name)) || shapes[0];
    for (const target of rotors) {
      const rotor = shapeFor(target.userData.computeDynamic);
      target.geometry.dispose(); target.geometry = rotor.geometry.clone(); target.material = rotor.material.clone();
      const radius = target.userData.computeDynamic === 'bga' ? (target.userData.ballRadius ?? .1) : target.userData.computeDynamic === 'c4' ? .045 : 1;
      target.geometry.scale(radius, radius, radius);
      target.geometry.userData.authoredIn = 'Blender';
      target.name = `Blender-authored ${target.userData.computeDynamic}`;
    }
  }
  // Board surfaces: the painted PCB atlas, projected by position (tray-pcb.js).
  const accel = options.model.accel.id, mobile = !!options.quality.mobile;
  if (kind === 'tray') applyPcb(hardware, accel, { mobile });
  built.scene.add(hardware);
  if (kind === 'rack') {
    // The pulled tray is the tray level's own hardware, the same GLB, seated where rack.js pulled it out (scene.userData.pulledTray):
    // every part, size, orientation and material the tray level draws, nothing rebuilt beside it. Only its boards' painted surface is
    // the rack's lighter one (tray-pcb.js 'rack' level of detail), painted while the file is still in tray units, as the tray level does.
    const frame = built.scene.userData.pulledTray, seated = ownedClone(cache.get(assetKey('tray', options.model)));
    seated.name = 'Blender complete tray hardware, pulled (the tray level\'s own)';
    seated.traverse(o => { delete o.userData.ifxCompute; });   // the tray file's generation stamp names the tray; this hardware is the rack's
    dress(seated);
    finishDies(seated);
    seated.scale.setScalar(10); seated.position.set(0, 0, 0); seated.updateMatrixWorld(true);
    applyPcb(seated, accel, { lod: 'rack', named: PCB_MATERIAL });
    seated.scale.setScalar(1); seated.position.set(frame.x, frame.floor, frame.z);
    hardware.add(seated);   // the rack hardware is at scale 1 (metres), the file's own unit
  }
  // Package markings and other prints requested by the native builder, on the authored surfaces.
  realizeSpots(hardware, built.scene, built.printSpots);
  if (kind === 'rack' && built.printMarks) {
    // Voltage marks print on the authored surfaces: the busway's front face and the busbar's rear face.
    const tag = built.printMarks.busbar;
    const hit = tag && surfaceHit(hardware, [tag.x, tag.y, tag.z - 1], [0, 0, 1]);
    rackMarks(built.scene, options.model, { root: hardware, busway: built.printMarks.busway, busbar: hit ? { p: hit.point.toArray(), n: [0, 0, -1] } : null });
    // the rack loop's pipe markers on the manifolds' rear faces
    rackManifoldMarks(built.scene, built.printMarks.manifolds.map(m => {
      const hit = surfaceHit(hardware, [m.x, m.y, m.z - 1], [0, 0, 1]);
      return hit && { p: hit.point.toArray(), side: m.side };
    }).filter(Boolean));
  }
  built.scene.traverse(o => { if (o.userData.computeCoverOutline === 'ihs') covers.push(o); });
  const showCovers = () => { for (const o of covers) o.visible = options.state.mode === 'heat'; };
  showCovers();
  const update = built.update;
  built.update = (t, dt) => {
    const result = update?.(t, dt);
    showCovers();
    for (const [target, source] of pulses) if (source.emissive) {
      target.emissive.copy(source.emissive); target.emissiveIntensity = source.emissiveIntensity;
    }
    return result;
  };
  built.scene.userData.blenderCompute = { asset: `${key}.glb`, completeStaticHardware: true, replacedNativeMeshes: obsolete.length,
    representative: true, runtimeExceptions: ['flow and heat overlays', 'token sprites and cache effects', 'status light effects', 'lights', 'camera', 'hotspots', 'Blender rotor and solder instancing', 'native overlays (rack management leads)', 'printed labels'] };
  return built;
}
export const rackBuilder = { preload: ({ model }) => preloadCompute('rack', model), build: options => build('rack', rack, options) };
export const trayBuilder = { preload: ({ model }) => preloadCompute('tray', model), build: options => build('tray', tray, options) };
export const chipBuilder = { preload: ({ model }) => preloadCompute('chip', model), build: options => build('chip', chip, options) };
