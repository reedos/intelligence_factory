// Blender authors every physical mesh. The native scene remains the source of
// runtime signal paths, hotspots, labels and schematic registration guides.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { build as buildDiagram } from './side-cpo.js';
import { engineLayout } from './side-geometry.js';
import { THREE, label, note } from './side-kit.js';
import { directLink } from './link-art-direction.js';
import { attachFlowRibbons } from '../flow-ribbons.js';

let source, pending;
export function preload() {
  if (source) return Promise.resolve(source);
  return pending ||= new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/cpo-hardware.glb?v=9`)
    .then(gltf => { source = gltf.scene; return source; })
    .catch(error => { pending = undefined; throw error; });
}

// Representative die faces painted at runtime onto the GLB's 0-1 top-face UVs.
// Not floorplans: dark silicon, a seal ring, faint cell rows, and for the EIC a
// 20% tint marking the transmit (driver) and receive (TIA) halves.
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
const mix = (a, b, k) => a.map((v, i) => v * (1 - k) + b[i] * k);
function eicFace() {
  return paintFace(512, 384, (u, v, e, block, x, y) => {
    if (e <= 7) return [.022, .03, .042];
    if (e < 10.5) return [.16, .18, .20];
    const grain = (y % 6 < 1 ? .010 : 0) + ((x + Math.floor(y / 6) * 37) % 29 < 1 ? .006 : 0) + (block - .5) * .012;
    let c = [.030 + grain, .045 + grain, .070 + grain];
    if (e > 14 && v > .53) c = mix(c, [.05, .19, .24], .2);       // transmit drivers
    if (e > 14 && v < .47) c = mix(c, [.20, .07, .15], .2);       // receive TIAs
    return c;
  });
}

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
    || engines.some((e,i)=>Math.abs(meta.enginesCm[i][0]-e.x)>1e-5 || Math.abs(meta.enginesCm[i][1]-1.65)>1e-5 || Math.abs(meta.enginesCm[i][2]-e.z)>1e-5)) {
    throw new Error('CPO asset does not match the technical layout');
  }
  asset.scale.setScalar(100); asset.name = 'Blender CPO complete hardware';
  let asicMaterial;
  asset.traverse(node => { if (node.isMesh && node.material.name === 'Switch ASIC silicon') asicMaterial = node.material; });
  if (!asicMaterial) throw new Error('CPO asset is missing its authored switch ASIC');
  asicMaterial.emissive.set(0xff6a1a);
  asset.traverse(node => {
    if (node.isMesh && node.material.name === 'Electronic die face' && !node.material.map) {
      node.material.map = eicFace(); node.material.color.set(0xffffff); node.material.needsUpdate = true;
    }
  });
  const built = buildDiagram({ ...args, authoredHardware: true, authoredAsicMaterial: asicMaterial });
  // Include the entire off-package callout and its fiber ends at desktop widths.
  built.camera.pos = [-1, 27, 32];
  built.camera.target = [-1, 1, -2];
  built.scene.add(asset);
  const plateNote = label(built.scene, 'Heat view: cold plate and coolant pipes in x-ray; mechanics representative', [0, 5.05, 5.2], note, .17);
  const interposerNote = label(built.scene, 'Data / Power: interposer in x-ray to expose buried electrical routes', [0, 2.2, 5.2], note, .17);
  directLink({ built, model: asset, kind: 'cpo', quality: args.quality, state: args.state });
  // Keep machined highlights crisp while the animated signal cores still bloom.
  Object.assign(built.look, { bloom: .54, threshold: 1.7, envIntensity: .7, exposure: 1.0 });
  // X-ray plate: a view-angle rim keeps the translucent sheet readable face-on
  // and under bloom, instead of vanishing over the glowing die.
  asset.traverse(node => {
    if (!node.isMesh || node.material.name !== 'Cutaway cold plate') return;
    const m = node.material;
    m.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>',
        `float ifxRim = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.0);
        diffuseColor.a = clamp(diffuseColor.a + ifxRim * 0.3, 0.0, 1.0);
        #include <opaque_fragment>`);
    };
    m.customProgramCacheKey = () => 'ifx-cpo-plate-rim';
  });
  const plate = asset.getObjectByName('CPO_COLDPLATE');
  if (!plate) throw new Error('CPO mechanical asset is missing its cold-plate assembly');
  const interposer = asset.getObjectByName('CPO_PACKAGE__Photonic_die_passivation');
  if (!interposer?.isMesh) throw new Error('CPO hardware is missing its shared interposer');
  // This material is otherwise shared with the PIC dies: isolate the inspection
  // treatment so the electrical layer is exposed without ghosting optical chips.
  interposer.material = interposer.material.clone();
  const interposerMaterial = interposer.material;
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
  const syncPlate = () => {
    const heat = args.state.mode === 'heat', visible = showPlate || heat;
    const power = args.state.mode === 'power';
    for (const layer of powerLayers) {
      const transparent = power || layer.transparent;
      if (layer.material.transparent !== transparent) { layer.material.needsUpdate = true; dirty = true; }
      layer.material.transparent = transparent;
      layer.material.opacity = power ? (layer.material === asicMaterial ? .58 : .16) : layer.opacity;
      layer.material.depthWrite = power ? false : layer.depthWrite;
      layer.mesh.castShadow = layer.castShadow && !power;
    }
    powerNote.visible = power && (!args.state.selected || built.inspection.annotations);
    const electrical = args.state.mode === 'data' || args.state.mode === 'power';
    if (interposerMaterial.transparent !== electrical) { interposerMaterial.needsUpdate = true; dirty = true; }
    interposerMaterial.transparent = electrical;
    interposerMaterial.opacity = electrical ? .1 : 1;
    interposerMaterial.depthWrite = !electrical;
    interposer.castShadow = !!args.quality.shadows && !electrical;
    interposerNote.visible = electrical && (!args.state.selected || built.inspection.annotations);
    for (const [material, original] of pipeMaterials) {
      const transparent = heat || original.transparent;
      if (material.transparent !== transparent) { material.needsUpdate = true; dirty = true; }
      material.transparent = transparent;
      material.opacity = heat ? 0.16 : original.opacity;
      material.depthWrite = heat ? false : original.depthWrite;
    }
    for (const [mesh, castShadow] of pipeMeshes) mesh.castShadow = heat ? false : castShadow;
    for (const object of [plate, built.coolingHardware]) {
      dirty ||= object.visible !== visible; object.visible = visible;
    }
    plateNote.visible = visible && (!args.state.selected || built.inspection.annotations);
  };
  Object.defineProperties(built.inspection, {
    covers: { get: () => showPlate || args.state.mode === 'heat' },
    coversForced: { get: () => args.state.mode === 'heat' },
    hasCovers: { value: true }, coverLabel: { value: 'cold plate' },
  });
  built.inspection.setCovers = value => { showPlate = !!value; syncPlate(); };
  built.inspection.scope = 'Representative package and mechanics; six groups of three engines. Package layers and the cold plate are separated for inspection. Data and Power show the interposer in x-ray to expose buried electrical routes; it is not transparent silicon. Power shows the board and package ceramic in x-ray, with the ASIC partially translucent so its footprint and the schematic supply paths from below remain visible. TX/RX fibers continue outward to front-panel ports outside this diagram; separate lower amber fibers supply laser light. Fiber routing is representative, with surface coupling unfolded for clarity rather than a literal edge-coupled NVIDIA die. Heat view shows the cold plate and coolant pipes in x-ray so their internal flow is visible; the fin channels inside the plate are representative. Moving marks show direction, not lane counts, speed or watts. Electrical and heat motion across display gaps is schematic. The separate engine detail is enlarged 2.5×: its EIC/PIC faces are bonded in hardware, and its dashed leader identifies the enlarged engine.';
  built.inspection.views = {
    diagram: { label: 'Complete diagram', ...built.camera },
    package: { label: 'Package', pos: [14, 18, 27], target: [1, 1.1, 0],
      portrait: { pos: [12, 23, 31], target: [.8, 1.1, 0] } },
    detail: { label: 'Engine detail · 2.5×', pos: [-10.7, 8.2, 1.8], target: [-11.7, 1.9, -8.4],
      portrait: { pos: [-10.7, 11, 6], target: [-11.7, 1.9, -8.4] } },
  };
  const update = built.update;
  built.update = (t, dt) => {
    const changed = update(t, dt); syncPlate();
    const moved = dirty; dirty = false; return moved || changed;
  };
  built.update(0, 0);
  built.scene.userData.authoredHardware = { kind: 'cpo', source: 'Blender', representative: true };
  attachFlowRibbons(built, { width: 1.8, glow: 4.5, brightness: 3.0, mobile: args.quality.mobile });
  return built;
}
