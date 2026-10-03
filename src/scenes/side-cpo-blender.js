// Blender authors every physical mesh. The native scene remains the source of
// runtime signal paths, hotspots, labels and schematic registration guides.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { build as buildDiagram } from './side-cpo.js';
import { engineLayout, CPO_VARIANTS } from './side-geometry.js';
import { ringEicTex, eicMzmTex, mzmCpoPicTex } from './cpo-variants.js';
import { THREE, label, note, eicBondTex } from './side-kit.js';
import { directLink } from './link-art-direction.js';
import { attachFlowRibbons } from '../flow-ribbons.js';

let source, pending;
export function preload() {
  if (source) return Promise.resolve(source);
  return pending ||= new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/cpo-hardware.glb?v=26`)
    .then(gltf => { source = gltf.scene; return source; })
    .catch(error => { pending = undefined; throw error; });
}

// Representative die faces painted at runtime onto the GLB's 0-1 top-face UVs.
// Not floorplans: dark silicon and a seal ring. The EIC faces (cpo-variants.js) are
// shared by the eighteen packaged engines and the exploded detail.
const srgb = v => Math.round(255 * Math.min(1, Math.max(0, v)) ** (1 / 2.2));
function paintFace(W, H, shade) {
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d'), img = ctx.createImageData(W, H);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const blocks = Array.from({ length: (H >> 4) + 1 }, () => Array.from({ length: (W >> 4) + 1 }, rnd));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = shade(x / W, y / H, Math.min(x, W - 1 - x, y, H - 1 - y), blocks[y >> 4][x >> 4], x, y), i = (y * W + x) * 4;
    img.data[i] = srgb(c[0]); img.data[i + 1] = srgb(c[1]); img.data[i + 2] = srgb(c[2]); img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace; tex.flipY = false; tex.anisotropy = 4;
  return tex;
}
// Bare switch die back: ground-silicon sheen, faint grind arcs and a seal ring.
// No part mark: nothing published identifies the die face.
function asicFace() {
  return paintFace(512, 512, (u, v, e) => {
    if (e <= 6) return [.02, .03, .045];
    if (e < 10) return [.15, .17, .19];
    const r = Math.hypot(u - 1.6, v + .4), grind = .011 * Math.sin(r * 900) * Math.sin(r * 37);
    const sheen = .05 * Math.max(0, 1 - Math.hypot(u - .3, v - .3) * 1.3);
    return [.024 + sheen + grind, .042 + sheen + grind, .07 + sheen * 1.2 + grind];
  });
}
// Motherboard soldermask, tiled at about 1 cm: grain, faint generic trace
// relief and via dots. Generic board texture, not a routing drawing.
function boardFace() {
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const vias = Array.from({ length: 22 }, () => [rnd() * 256, rnd() * 256]);
  const rows = Array.from({ length: 9 }, () => [Math.floor(rnd() * 256), rnd() * 256, rnd() * 256]);
  const tex = paintFace(256, 256, (u, v, e, block, x, y) => {
    let k = (block - .5) * .012;
    for (const [ry, a, b] of rows) if (Math.abs(y - ry) < 1.5 && x > Math.min(a, b) && x < Math.max(a, b)) k += .03;
    for (const [vx, vy] of vias) { const d = Math.hypot(x - vx, y - vy); if (d < 4) k += d < 2 ? -.012 : .09; }
    return [.018 + k * .6, .061 + k, .054 + k * .9];
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(13.6, 13.6);
  return tex;
}
// One stripe per fiber across a data ribbon: a rounded coated core, dark seams.
function ribbonStripes(color) {
  const tex = paintFace(64, 4, (u, v, e, block, x) => {
    const f = ((x % 8) + .5) / 8;
    if (x % 8 === 0) return color.map(c => c * .08);
    const k = .12 + .38 * Math.sqrt(Math.max(0, 1 - (2 * f - 1) ** 2));
    return color.map(c => c * k);
  });
  tex.wrapT = THREE.RepeatWrapping; tex.magFilter = THREE.LinearFilter;
  return tex;
}
const RIBBONS = { 'Transmit ribbon': [.37, .80, .90], 'Receive ribbon': [.82, .37, .66] };

export function build(args) {
  if (!source) throw new Error('CPO hardware preload required');
  const asset = source.clone(true), geometries = new Map(), materials = new Map();
  let meta;
  asset.traverse(node => {
    if (node.userData.ifx) meta = JSON.parse(node.userData.ifx);
    if (!node.isMesh) return;
    if (!geometries.has(node.geometry)) geometries.set(node.geometry, node.geometry.clone());
    node.geometry = geometries.get(node.geometry);
    const clone = original => {
      if (!materials.has(original)) {
        const copy = original.clone();
        // The source uses material-only meshes; keep texture ownership safe if
        // later revisions add maps, since stage disposes every built scene.
        for (const [k,v] of Object.entries(copy)) if (v?.isTexture) copy[k] = v.clone();
        if (copy.transparent) copy.depthWrite = false;
        materials.set(original,copy);
      }
      return materials.get(original);
    };
    node.material = Array.isArray(node.material) ? node.material.map(clone) : clone(node.material);
    node.castShadow = !!args.quality.shadows && !(Array.isArray(node.material) ? node.material.some(m=>m.transparent) : node.material.transparent);
    node.receiveShadow = !!args.quality.shadows;
  });
  const engines = engineLayout();
  if (meta?.units !== 'm' || meta.engineCount !== engines.length || meta.subassemblyCount !== 6
    || String(meta.engineVariants) !== String(CPO_VARIANTS)
    || engines.some((e,i)=>Math.abs(meta.enginesCm[i][0]-e.x)>1e-5 || Math.abs(meta.enginesCm[i][1]-1.65)>1e-5 || Math.abs(meta.enginesCm[i][2]-e.z)>1e-5)) {
    throw new Error('CPO asset does not match the technical layout');
  }
  asset.scale.setScalar(100); asset.name = 'Blender CPO complete hardware';
  let asicMaterial, copperMaterial;
  asset.traverse(node => {
    if (!node.isMesh) return;
    if (node.material.name === 'Switch ASIC silicon') asicMaterial = node.material;
    if (node.material.name === 'Electrical copper') copperMaterial = node.material;
  });
  if (!asicMaterial) throw new Error('CPO asset is missing its authored switch ASIC');
  if (!copperMaterial) throw new Error('CPO asset is missing its authored electrical copper');
  asicMaterial.emissive.set(0xff6a1a);
  if (!asicMaterial.map) { asicMaterial.map = asicFace(); asicMaterial.needsUpdate = true; }
  asset.traverse(node => {
    if (node.isMesh && node.material.name === 'Midnight laminate' && !node.material.map) {
      const m = node.material; m.map = boardFace(); m.bumpMap = m.map; m.bumpScale = .6; m.color.set(0xffffff); m.needsUpdate = true;
    }
  });
  // The engine views' faces: the ring view's EIC, the Mach-Zehnder view's EIC (its driver blocks over the electrode
  // segments) and the one-die view's face (photonics and circuits side by side). One texture each, shared by the 18
  // packaged engines and the exploded detail.
  const eicMap = ringEicTex(), faceMaps = {
    'Electronic die face': eicMap, 'Detail electronic die face': eicMap,
    'MZM electronic die face': eicMzmTex(), 'MZM photonic die face': mzmCpoPicTex(),
  };
  faceMaps['Detail MZM electronic die face'] = faceMaps['MZM electronic die face'];
  asset.traverse(node => {
    const face = node.isMesh && node.material.name;
    if (faceMaps[face] && !node.material.map) {
      const m = node.material, map = faceMaps[face]; m.map = map; m.bumpMap = map; m.bumpScale = .25; m.color.set(0xffffff); m.needsUpdate = true;
    }
    if (face === 'Detail EIC hybrid-bond face' && !node.material.map) {
      node.material.map = eicBondTex(); node.material.color.set(0xffffff); node.material.needsUpdate = true;
    }
    const lane = node.isMesh && RIBBONS[node.material.name];
    if (lane && !node.material.map) {
      const m = node.material, tex = ribbonStripes(lane);
      m.map = tex; m.emissiveMap = tex; m.color.set(0xffffff); m.emissive.set(0xffffff); m.emissiveIntensity = .35; m.needsUpdate = true;
    }
  });
  const built = buildDiagram({ ...args, authoredHardware: true, authoredAsicMaterial: asicMaterial });
  // Include the entire off-package callout and its fiber ends at desktop widths. Each variant's pos
  // keeps the same offset from target the hand-placed single camera this replaces used (so 'ring',
  // the default, opens on an unchanged frame), but target now orbits that variant's own hardware
  // bounding-box centre (tools/orbit-center.mjs) instead of a point hand-placed beside the package.
  // side-cpo.js's own `camera` is a getter keyed on the same `built.variant.kind`; redefine it here
  // rather than assigning into it, since buildDiagram's native `built.camera` is itself a getter.
  const CPO_CAMERA = {
    ring: { pos: [-2.82, 27.17, 32.58], target: [-2.82, 1.17, -1.42], portrait: { pos: [13.18, 29.47, 26.58], target: [-2.82, 1.17, -1.42] } },
    // mzm's target re-measured 10/02/2026 (tools/orbit-center.mjs) after the tile bus fix moved BAILLY.t: the
    // package's own bbox centre shifted about 0.3 cm on x and z. pos keeps the same offset from target as before.
    mzm: { pos: [-3.77, 27.17, 32.3], target: [-3.78, 1.17, -1.71], portrait: { pos: [12.23, 29.47, 26.3], target: [-3.78, 1.17, -1.71] } },
  };
  Object.defineProperty(built, 'camera', { configurable: true,
    get: () => ({ ...CPO_CAMERA[built.variant.kind], near: 0.05, far: 500, min: 2, max: 90 }) });
  built.scene.add(asset);
  // Notes for the inspection layers, one per design where they differ.
  const tagged = (k, ...a) => { const n = label(built.scene, ...a); n.userData.cpoVariant = k; return n; };
  const plateNotes = { ring: tagged('ring', 'Heat view: cold plate and coolant pipes in x-ray; mechanics representative', [0, 5.05, 5.2], note, .17),
    mzm: tagged('mzm', 'Heat view: heat sink in x-ray; shape representative, the reference system is air-cooled', [0, 5.6, 5.2], note, .17) };
  const slabNotes = { ring: tagged('ring', 'Data / Power: interposer in x-ray to expose buried electrical routes', [0, 2.2, 5.2], note, .17),
    mzm: tagged('mzm', 'Data / Power: package build-up layers in x-ray to expose buried electrical routes', [0, 2.2, 5.2], note, .17) };
  directLink({ built, model: asset, kind: 'cpo', quality: args.quality, state: args.state });
  // Keep machined highlights crisp while the animated signal cores still bloom.
  Object.assign(built.look, { bloom: .54, threshold: 1.7, envIntensity: .7, exposure: 1.0 });
  // X-ray plate and heat sink: a view-angle rim keeps the translucent sheet readable face-on
  // and under bloom, instead of vanishing over the glowing die.
  asset.traverse(node => {
    if (!node.isMesh || !['Cutaway cold plate', 'Cutaway heat sink', 'Heat sink fins'].includes(node.material.name)) return;
    const m = node.material;
    m.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>',
        `float ifxRim = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.0);
        diffuseColor.a = clamp(diffuseColor.a + ifxRim * 0.3, 0.0, 1.0);
        #include <opaque_fragment>`);
    };
    m.customProgramCacheKey = () => 'ifx-cpo-plate-rim';
  });
  // Each design's cooling: NVIDIA-style a cold plate with coolant pipes; Broadcom-style a heat sink.
  const cooling = { ring: asset.getObjectByName(meta.coolingGroups.ring), mzm: asset.getObjectByName(meta.coolingGroups.mzm) };
  if (!cooling.ring || !cooling.mzm) throw new Error('CPO mechanical asset is missing its cooling assemblies');
  const plate = cooling.ring;
  // The slab under each design's engines, x-rayed in Data and Power: the ring package's interposer, the Broadcom-style
  // package's build-up layers. Each has its own Blender material; the clone keeps the inspection treatment private to
  // this build so no optical chip is ever ghosted with it.
  const slabs = { ring: asset.getObjectByName('CPO_RING_PACKAGE__Silicon_interposer'), mzm: asset.getObjectByName('CPO_MZM_PACKAGE__Organic_build-up_layers') };
  if (!slabs.ring?.isMesh || !slabs.mzm?.isMesh) throw new Error('CPO hardware is missing its interposer or build-up layers');
  for (const slab of Object.values(slabs)) slab.material = slab.material.clone();
  // Power arrives from below the board. An explicitly labeled inspection view
  // reveals those existing paths through selected stack layers; moving the
  // routes above the package would invent a different power connection.
  const powerLayers = [];
  for (const name of ['CPO_BOARD__Midnight_laminate', 'CPO_PACKAGE__Package_ceramic', 'CPO_DIES__Switch_ASIC_silicon']) {
    const mesh = asset.getObjectByName(name);
    if (!mesh?.isMesh) throw new Error(`Missing CPO power inspection layer: ${name}`);
    if (mesh.material !== asicMaterial) mesh.material = mesh.material.clone();
    powerLayers.push({ mesh, material: mesh.material, castShadow: mesh.castShadow,
      opacity: mesh.material.opacity, transparent: mesh.material.transparent, depthWrite: mesh.material.depthWrite });
  }
  const powerNote = label(built.scene, 'Power: ASIC partially translucent; board and package in x-ray', [0, 2.6, 5.2], note, .17);
  const pipeMaterials = new Map(), pipeMeshes = [];
  plate.traverse(object => {
    if (!object.isMesh) return;
    const mats = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of mats) if (/^(Supply|Return) coolant pipe$/.test(material.name)) {
      pipeMaterials.set(material, { transparent: material.transparent, opacity: material.opacity, depthWrite: material.depthWrite });
      pipeMeshes.push([object, object.castShadow]);
    }
  });
  let showPlate = false, dirty = false;
  const noteOn = () => !args.state.selected || built.inspection.annotations;
  const syncPlate = () => {
    const kind = built.variant.kind, heat = args.state.mode === 'heat', visible = showPlate || heat;
    const power = args.state.mode === 'power';
    for (const layer of powerLayers) {
      const transparent = power || layer.transparent;
      if (layer.material.transparent !== transparent) { layer.material.needsUpdate = true; dirty = true; }
      layer.material.transparent = transparent;
      layer.material.opacity = power ? (layer.material === asicMaterial ? .58 : .16) : layer.opacity;
      layer.material.depthWrite = power ? false : layer.depthWrite;
      layer.mesh.castShadow = layer.castShadow && !power;
    }
    powerNote.visible = power && noteOn();
    const electrical = args.state.mode === 'data' || args.state.mode === 'power';
    for (const [k, slab] of Object.entries(slabs)) {
      const m = slab.material;
      if (m.transparent !== electrical) { m.needsUpdate = true; dirty = true; }
      m.transparent = electrical; m.opacity = electrical ? .1 : 1; m.depthWrite = !electrical;
      slab.castShadow = !!args.quality.shadows && !electrical;
      slabNotes[k].visible = k === kind && electrical && noteOn();
    }
    // The wide package-trace bus reads thin next to the bright green data streams it carries once the build-up
    // layer goes to x-ray above: a small emissive lift keeps the copper legible between the moving pulses without
    // turning it green itself. Power and heat keep the plain, unlit copper.
    // Halved 10/02/2026 (Reed/Opus review): with the mzm package's 16 real lane segments this close together, the
    // emissive lift plus ribbonIntensity read as a yellow haze rather than a legible bus, worst on phone. Shared
    // with the ring package's own traces, which stay legible at the lower level too.
    const dataOn = args.state.mode === 'data';
    copperMaterial.emissive.set(dataOn ? 0xd98a4a : 0x000000);
    copperMaterial.emissiveIntensity = dataOn ? 0.175 : 0;
    for (const [material, original] of pipeMaterials) {
      const transparent = heat || original.transparent;
      if (material.transparent !== transparent) { material.needsUpdate = true; dirty = true; }
      material.transparent = transparent;
      material.opacity = heat ? 0.16 : original.opacity;
      material.depthWrite = heat ? false : original.depthWrite;
    }
    for (const [mesh, castShadow] of pipeMeshes) mesh.castShadow = heat ? false : castShadow;
    for (const [object, on] of [[cooling.ring, visible && kind === 'ring'], [built.coolingHardware, visible && kind === 'ring'], [cooling.mzm, visible && kind === 'mzm']]) {
      dirty ||= object.visible !== on; object.visible = on;
    }
    for (const [k, n] of Object.entries(plateNotes)) n.visible = k === kind && visible && noteOn();
  };
  Object.defineProperties(built.inspection, {
    covers: { get: () => showPlate || args.state.mode === 'heat' },
    coversForced: { get: () => args.state.mode === 'heat' },
    hasCovers: { value: true }, coverLabel: { get: () => built.variant.kind === 'mzm' ? 'heat sink' : 'cold plate' },
  });
  built.inspection.setCovers = value => { showPlate = !!value; syncPlate(); };
  const SCOPE = {
    ring: 'Representative package and mechanics; six groups of three engines, counts NVIDIA’s. Package layers and the cold plate are separated for inspection. Data and Power show the interposer in x-ray to expose buried electrical routes; it is not transparent silicon. Power shows the board and package ceramic in x-ray, with the ASIC partially translucent so its footprint and the schematic supply paths from below remain visible. TX/RX fibers continue outward to front-panel ports outside this diagram; separate lower amber fibers supply laser light. Fiber routing is representative, with surface coupling unfolded for clarity rather than a literal edge-coupled NVIDIA die. Heat view shows the cold plate and coolant pipes in x-ray so their internal flow is visible; the fin channels inside the plate are representative. Power and data marks show direction, not lane counts, speed or watts; heat streams are sized by each part’s assumed watts on the site’s log heat scale (each 10× in power is 5× the motion). Electrical and heat motion across display gaps is schematic. The separate engine detail is enlarged 2.5×: its EIC/PIC faces are bonded in hardware, and its dashed leader identifies the enlarged engine. Each driver block sits over its ring and each TIA over its photodiode; the electronic die’s other blocks are representative.',
    mzm: 'Representative Mach-Zehnder package, following the approach in Broadcom’s 51.2T Bailly-class CPO as reported: eight radial engine tiles, two per side, counts Broadcom’s. Tile proportions follow Broadcom’s published package images; sizes, the tile floorplan and the fiber routing are representative. Data and Power show the package build-up layers in x-ray to expose buried electrical routes. Power shows the board and package ceramic in x-ray, with the ASIC partially translucent. Each tile’s 16 transmit and 16 receive fibers leave its fiber connector toward front-panel ports outside this diagram; lower amber fibers bring laser light from remote laser modules, whose count and allocation are illustrative. Heat view shows a finned heat sink in x-ray, because the reference system is air-cooled; its shape is representative. The separate tile detail is enlarged 3.5× and draws all 64 lanes each way, as sixteen 400G FR4 groups of four wavelengths (16 × 4 lanes × 100 Gb/s = 6.4 Tb/s): its electronic die covers the electrical end, with each driver cell over its modulator’s electrode segments and each TIA over its photodiode, and the Mach-Zehnder arms run on past it. Drawn arm length is representative; real silicon Mach-Zehnder modulators run millimeters. Moving light is shown on three of the 64 lanes. Power and data marks show direction, not lane counts, speed or watts; heat streams are sized by each part’s assumed watts on the site’s log heat scale.',
  };
  Object.defineProperty(built.inspection, 'scope', { get: () => SCOPE[built.variant.kind], configurable: true });
  const VIEWS = {
    ring: { label: 'Engine detail · 2.5×', pos: [-10.7, 8.2, 1.8], target: [-11.7, 1.9, -8.4], portrait: { pos: [-10.7, 11, 6], target: [-11.7, 1.9, -8.4] } },
    mzm: { label: 'Tile detail · 3.5×', pos: [-11.6, 10.2, 3.2], target: [-12.6, 1.9, -8.4], portrait: { pos: [-11.6, 14, 8], target: [-12.6, 1.9, -8.4] } },
  };
  const views = {
    diagram: { label: 'Complete diagram', ...built.camera },
    package: { label: 'Package', pos: [14, 18, 27], target: [1, 1.1, 0],
      portrait: { pos: [12, 23, 31], target: [.8, 1.1, 0] } },
  };
  Object.defineProperty(views, 'detail', { get: () => VIEWS[built.variant.kind], enumerable: true });
  built.inspection.views = views;
  // Each design's authored meshes sit in its own groups (meta.variantGroups); the toggle shows one design's groups
  // and the scene's own flows and captions follow.
  const viewGroups = Object.fromEntries(CPO_VARIANTS.map(k => [k, meta.variantGroups[k].map(name => {
    const group = asset.getObjectByName(name);
    if (!group) throw new Error(`CPO asset is missing engine view group ${name}`);
    return group;
  })]));
  const setNative = built.variant.set;
  built.variant.set = next => {
    setNative(next);
    for (const k of CPO_VARIANTS) for (const group of viewGroups[k]) group.visible = k === built.variant.kind;
    dirty = true; syncPlate();
  };
  built.variant.groups = viewGroups;
  built.variant.set(built.variant.kind);
  const viewSprites = built.scene.children.filter(o => o.isSprite && o.userData.cpoVariant);
  const update = built.update;
  built.update = (t, dt) => {
    const changed = update(t, dt); syncPlate();
    // captions that name another engine view's chips stay hidden whatever the annotation setting
    for (const sprite of viewSprites) if (!built.variant.spriteVisible(sprite)) sprite.visible = false;
    const moved = dirty; dirty = false; return moved || changed;
  };
  built.update(0, 0);
  built.scene.userData.authoredHardware = { kind: 'cpo', source: 'Blender', representative: true };
  attachFlowRibbons(built, { width: 1.8, glow: 4.5, brightness: 3.0, mobile: args.quality.mobile });
  return built;
}
