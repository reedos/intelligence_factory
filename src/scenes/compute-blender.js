// Complete static compute hardware authored in Blender. Native builders supply
// the teaching contract only: routes, scenario counts, cameras and animations.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { build as rack } from './rack.js';
import { build as tray } from './tray.js';
import { build as chip } from './chip.js';

const cache = new Map(), pending = new Map();
const physical = o => o.isMesh && !o.isReflector && !o.userData.computeDynamic
  && (Array.isArray(o.material) ? o.material : [o.material]).some(m => !m.isMeshBasicMaterial && !m.isShaderMaterial);
const variant = (_kind, model) => model.accel.id;
const assetKey = (kind, model) => `compute-${kind}-${variant(kind, model)}`;

async function load(key) {
  if (cache.has(key)) return;
  if (!pending.has(key)) pending.set(key, new GLTFLoader().loadAsync(`${import.meta.env?.BASE_URL || '/'}models/${key}.glb?v=inspection8`)
    .then(gltf => { cache.set(key, gltf.scene); pending.delete(key); })
    .catch(error => { pending.delete(key); throw error; }));
  await pending.get(key);
}
export async function preloadCompute(kind, model) {
  await Promise.all([load(assetKey(kind, model)), load(kind === 'chip' ? 'compute-solder' : 'compute-rotor')]);
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
  hardware.traverse(o => {
    if (!o.isMesh) return;
    o.geometry.userData.authoredIn = 'Blender';
    const materials = Array.isArray(o.material) ? o.material : [o.material];
    const transparent = materials.some(m => m.transparent || m.opacity < 1);
    if (materials.some(m => m.userData.ifxCoverSurface === 'ihs')) covers.push(o);
    o.castShadow = !!options.quality.shadows && !transparent;
    o.receiveShadow = !!options.quality.shadows;
    for (const material of materials) {
      if (transparent) material.depthWrite = false;
      const sourceMaterial = materialSources.get(material.userData.ifxAnimatedSurface);
      if (sourceMaterial) pulses.push([material, sourceMaterial]);
    }
  });
  for (const o of obsolete) { o.removeFromParent(); o.geometry.dispose(); }
  if (rotors.length) {
    let rotor;
    cache.get(kind === 'chip' ? 'compute-solder' : 'compute-rotor').traverse(o => { if (o.isMesh) rotor = o; });
    if (!rotor) throw new Error('Blender fan rotor asset has no mesh.');
    for (const target of rotors) {
      target.geometry.dispose(); target.geometry = rotor.geometry.clone(); target.material = rotor.material.clone();
      const radius = target.userData.computeDynamic === 'bga' ? .1 : target.userData.computeDynamic === 'c4' ? .045 : 1;
      target.geometry.scale(radius, radius, radius);
      target.geometry.userData.authoredIn = 'Blender';
      target.name = `Blender-authored ${target.userData.computeDynamic}`;
    }
  }
  built.scene.add(hardware);
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
    representative: true, runtimeExceptions: ['flow and heat overlays', 'token sprites and cache effects', 'status light effects', 'lights', 'camera', 'hotspots', 'Blender rotor and solder instancing'] };
  return built;
}
export const rackBuilder = { preload: ({ model }) => preloadCompute('rack', model), build: options => build('rack', rack, options) };
export const trayBuilder = { preload: ({ model }) => preloadCompute('tray', model), build: options => build('tray', tray, options) };
export const chipBuilder = { preload: ({ model }) => preloadCompute('chip', model), build: options => build('chip', chip, options) };
