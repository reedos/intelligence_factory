// Complete Blender hardware, with native flow and interaction contracts retained.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { build as buildCoherent } from './side-coherent.js';
import { build as buildCopper } from './side-copper.js';
import { directLink } from './link-art-direction.js';
import { attachFlowRibbons } from '../flow-ribbons.js';
import { hardwareBounds } from '../app/housing-frame.js';

const cached = new Map();
let pending;
export function preloadLinks() {
  if (cached.size === 2) return Promise.resolve();
  if (!pending) pending = Promise.all(['coherent', 'copper'].map(async name => {
    const gltf = await new GLTFLoader().loadAsync(`${import.meta.env?.BASE_URL || '/'}models/${name}-hardware.glb?v=${name === 'copper' ? 17 : 10}`);
    cached.set(name, gltf.scene);
  })).catch(error => { pending = null; throw error; });
  return pending;
}

function cloneAsset(source) {
  const copy = source.clone(true), geometries = new Map(), materials = new Map(), textures = new Map();
  const cloneMaterial = source => {
    if (!materials.has(source)) {
      const copy = source.clone();
      for (const [key,value] of Object.entries(copy)) if (value?.isTexture) {
        if (!textures.has(value)) textures.set(value,value.clone());
        copy[key] = textures.get(value);
      }
      materials.set(source,copy);
    }
    return materials.get(source);
  };
  copy.traverse(object => {
    if (object.geometry) {
      if (!geometries.has(object.geometry)) geometries.set(object.geometry,object.geometry.clone());
      object.geometry = geometries.get(object.geometry);
    }
    if (object.material) object.material = Array.isArray(object.material) ? object.material.map(cloneMaterial) : cloneMaterial(object.material);
  });
  return copy;
}

function build(name, nativeBuilder, options) {
  const source = cached.get(name);
  if (!source) throw new Error(`Call preloadLinks() before building the Blender ${name} scene.`);
  const built = nativeBuilder({ ...options, authoredHardware: true }), model = cloneAsset(source);
  // The native builder remains the executable technical contract for teaching
  // flows, diagrams and hotspots. Every static hardware surface is replaced by
  // its Blender-authored equivalent; no procedural hardware is rendered twice.
  const dynamic = new Set(), diagrams = new Map(), staticMeshes = [];
  for (const key of ['flows', 'dataFlows', 'heatFlows']) for (const f of built[key] || []) f.group.traverse(o => dynamic.add(o));
  built.scene.traverse(o => {
    if (!o.isMesh || dynamic.has(o)) return;
    const materials = Array.isArray(o.material) ? o.material : [o.material];
    if (!materials.some(m => !m.isMeshBasicMaterial && !m.isShaderMaterial)) return;
    for (const material of materials) if (material.map && !diagrams.has(material.map)) diagrams.set(material.map, material);
    staticMeshes.push(o);
  });
  const diagramMaterials = [...diagrams.values()], diagramTargets = [];
  model.traverse(o => {
    if (!o.isMesh) return;
    for (const material of Array.isArray(o.material) ? o.material : [o.material]) {
      const slot = material.userData.ifxDiagramSlot;
      if (!Number.isInteger(slot)) continue;
      const source = diagramMaterials[slot];
      if (!source) throw new Error(`Missing ${name} diagram texture ${slot}`);
      material.map = source.map; material.color.copy(source.color);
      material.emissive.copy(source.emissive); material.needsUpdate = true;
      diagramTargets.push([material, source]);
    }
  });
  for (const mesh of staticMeshes) { mesh.removeFromParent(); mesh.geometry.dispose(); }
  if (name === 'coherent') {
    built.camera.pos = [3.2, 16, 11];
    built.camera.target = [1.3, 1.6, -1];
    built.camera.compact = { pos: [3.5, 24.2, 15.8], target: [1.3, 1.6, -1] };
    built.camera.portrait = { pos: [1.3, 23.2, 14.12], target: [1.3, 1.6, -1], fit: { aspect: 1, fov: 35, minScale: .60 } };
  }
  if (name === 'copper') {
    // The three raised covers span more width than the exposed boards. Preserve
    // their outer edges through the compact and tall-phone aspect ranges.
    built.camera.compact = { pos: [0, 16, 19.5], target: [0, .9, 0] };
    built.camera.portrait = { pos: [0, 16.6, 19.5], target: [0, .9, 0], fit: { aspect: 1, fov: 35, minScale: .7 } };
  }
  model.scale.setScalar(100); // GLB metres -> scene centimetres.
  model.name = `Blender ${name} complete hardware`;
  model.traverse(object => {
    if (!object.isMesh) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const transparent = materials.some(material => material.transparent || material.opacity < 1);
    object.castShadow = !!options.quality.shadows && !transparent;
    object.receiveShadow = !!options.quality.shadows && !transparent;
    materials.forEach(material => { if (material.transparent || material.opacity < 1) { material.depthWrite = false; material.side = 2; } });
  });
  built.scene.add(model);
  directLink({ built, model, kind: name, quality: options.quality, state: options.state });
  built.inspection.scope = name === 'coherent'
    ? 'Discrete board-level design: the driver and TIA are each in their own electronic package, physically separate from the IQ modulator and receiver optical assemblies. No shared package or substrate joins electronics to optics here. This packaging choice, dimensions and RF routing are representative assumptions, not a teardown of a shipping 800ZR. Exact die placement varies. OSFP shell footprint and the nano-ITLA case envelope are to scale; the remaining layout is representative. The release loop is representative and extends beyond the shell. Layers are separated for inspection; transfer across display gaps is schematic. The same tunable laser supplies the transmit carrier and receive local oscillator. Heat paths are qualitative; pulse counts do not represent power ratios.'
    : 'Representative DAC, ACC and AEC circuits in a two-piece die-cast clamshell at QSFP112 width and height (about 18.4 by 8.5 mm), informed by public exterior photographs rather than a teardown. The body is drawn shorter than a 72.4 mm Type 1 module; the nose, card supports, latch sliders, grounding fingers and internal placement are illustrative. Four transmit and four receive pairs are shown. Layers, pair shields and the upper half of the cable jacket are opened for inspection. Every signal path is electrical. The ACC redriver handles receive; the AEC retimer handles both directions. Heat motion shows qualitative transfer from active chips to the case and surroundings across exploded gaps; it does not encode watts or a power ratio. Release hardware adds no signal connections.';
  built.inspection.scope += ' Lids lift straight above their bodies without lateral displacement. Their surfaces use an x-ray inspection treatment to keep internal paths visible; this is not transparent metal. In Heat, each lid is an x-ray thermal target.';
  const view = (label, hotspot) => ({ label, ...hotspot.view });
  built.inspection.views = name === 'coherent' ? {
    diagram: { label: 'Complete module', ...built.camera },
    laser: view('Tunable laser', built.dataHotspots.itla),
    driver: view('Driver IC', built.dataHotspots.driver),
    tia: view('TIA IC', built.dataHotspots.tia),
    transmit: view('Transmit optics', built.dataHotspots.cdm),
    receive: view('Coherent receiver', built.dataHotspots.icr),
  } : {
    diagram: { label: 'Three plug ends', ...built.camera },
    dac: view('DAC · passive', built.dataHotspots.dac),
    acc: view('ACC · receive redriver', built.dataHotspots.acc),
    aec: view('AEC · retimer', built.dataHotspots.aec),
  };
  const covers = [];
  model.traverse(object => { if (object.isMesh && (object.name.includes('_cover_') || object.userData.sourceMesh === 'Coherent DSP thermal pad')) covers.push(object); });
  // Export merges by material, so lid edge metal can share a material with the
  // lower chassis. Keep thermal x-ray treatment local to lid meshes only.
  const lidCopies = new Map();
  const lidMaterial = material => {
    if (!lidCopies.has(material)) lidCopies.set(material, material.clone());
    return lidCopies.get(material);
  };
  for (const cover of covers) cover.material = Array.isArray(cover.material) ? cover.material.map(lidMaterial) : lidMaterial(cover.material);
  const coverPositions = new Map(covers.map(cover => [cover, cover.position.clone()]));
  const coverMaterials = new Set(covers.flatMap(cover => Array.isArray(cover.material) ? cover.material : [cover.material]));
  // Copper: the twinax shield, insulation and drain are solid in Power and Heat. In Data they take the same x-ray
  // inspection treatment as the lids, so the pulses stay visible running between the two conductors of each pair.
  const sheath = new Set();
  if (name === 'copper') model.traverse(o => { if (o.isMesh) for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (/Twinax dielectric|Twinax foil shield|Tinned drain wire/i.test(m.name)) sheath.add(m); });
  built.housingBounds = hardwareBounds(model);
  Object.defineProperties(built.inspection, {
    covers: { value: true },
    coversForced: { value: true },
    coversAlwaysVisible: { value: true },
    hasCovers: { value: covers.length > 0 },
  });
  let coversDirty = false;
  built.inspection.setCovers = () => {
    const visible = true;
    for (const cover of covers) { coversDirty ||= cover.visible !== visible; cover.visible = visible; }
  };
  built.inspection.setView = () => built.inspection.setCovers();
  const update = built.update;
  built.update = (t, dt) => {
    const changed = update(t, dt), visible = true;
    for (const [target, source] of diagramTargets) target.emissiveIntensity = source.emissiveIntensity;
    let moved = coversDirty; coversDirty = false;
    for (const cover of covers) {
      moved ||= cover.visible !== visible; cover.visible = visible;
      cover.castShadow = false;
      const rest = coverPositions.get(cover);
      moved ||= !cover.position.equals(rest);
      cover.position.copy(rest);
    }
    const xray = options.state.mode === 'data';
    for (const material of sheath) {
      const opacity = xray ? (/foil/i.test(material.name) ? .16 : .3) : 1;
      if (material.opacity !== opacity) { material.transparent = xray; material.opacity = opacity; material.depthWrite = !xray; material.needsUpdate = true; moved = true; }
    }
    for (const material of coverMaterials) {
      if (!material.transparent) { material.transparent = true; material.needsUpdate = true; moved = true; }
      // Keep a readable enclosure outline without layering a bright sheet over
      // the electronics. This is an inspection treatment, not clear metal.
      material.opacity = options.state.mode === 'heat' ? .18 : /edge highlights/i.test(material.name) ? .32 : .07;
      material.depthWrite = false;
    }
    return moved || changed;
  };
  built.update(0, 0);
  attachFlowRibbons(built, { width: name === 'copper' ? 1.6 : 2.2, glow: name === 'copper' ? 3.5 : 5.0, brightness: 2.8, mobile: options.quality.mobile });
  built.scene.userData.authoredMechanicalHardware = { asset: `${name}-hardware.glb`, representative: true, units: 'cm', nativeSignalsRetained: true,
    staticGeometry: 'Complete Blender-authored hardware', runtimeExceptions: ['animated flows', 'caption sprites', 'hotspots', 'diagram textures', 'lighting'], replacedNativeMeshes: staticMeshes.length };
  return built;
}

export const coherentBuilder = { build: options => build('coherent', buildCoherent, options) };
export const copperBuilder = { build: options => build('copper', buildCopper, options) };
