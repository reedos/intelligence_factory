// Opt-in Blender geometry behind the existing module scene contract. World unit = 1 cm.
// The asset is a representative layout, not a recovered production design. Exported
// routes describe visible conductors; chip-internal paths are omitted; contact breakout uses representative PCB layers.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { THREE, flow, setup, label, FLOW, COL, note, unitCol } from './side-kit.js';
import { applyArtDirection } from './module-art-direction.js';
import { MODULE_VARIANTS, LRO_COLOR, inVariant, splitByZ, lroDieTop, lroIntro, lroPartCopy, dspMarkingTop } from './module-lro.js';
import { moduleLabel, moduleTier } from './lid-labels.js';
import { attachFlowRibbons } from '../flow-ribbons.js';
import { tagHeat, balanceHeat, heatIntensity, PART_W } from '../heat.js';
import { hardwareBounds, componentView } from '../app/housing-frame.js';

let cached, pending;
const CM = 100;
const EXPLODED = {
  '01_BASE': [0, 0, 0], '02_BOARD': [0, 1.5, 0], '03_THERMAL': [0, 2.8, 0],
  '04_COVER': [0, 4, 0], '05_PULL_TAB': [0, 0, 0],
};
// Pin offsets from each exported anchor, cm. The driver pin sits at the driver's
// front-left corner (clear of its DRV marking) and the laser pin at the front of the
// laser row, so the two no longer touch at overview distance. The DSP pin sits on the
// substrate margin in front of the die, off the die's printed marking.
const PIN_OFFSET = {
  driver: [-0.22, 0, 0.24], lasers: [0.05, 0, 0.2], tia: [-0.2, 0, -0.23],
  dsp: [0.3, -0.03, 0.63],
};
const key = name => name.replace(/[\s_]+/g, ' ').trim().toLowerCase();
const cm = point => point.map(value => value * CM);

export function preload(url = `${import.meta.env?.BASE_URL || '/'}models/osfp-module-runtime.glb?v=relayout1`) {
  if (cached) return Promise.resolve(cached);
  if (!pending) pending = new GLTFLoader().loadAsync(url).then(gltf => {
    cached = gltf;
    return gltf;
  }).catch(error => { pending = undefined; throw error; });
  return pending;
}

// Stage disposes scene geometry, materials and textures when scenarios change. Each
// build owns its GPU resources; the preloaded source remains safe to build again.
function cloneAsset(source) {
  const copy = source.clone(true), geometries = new Map(), materials = new Map(), textures = new Map();
  const material = original => {
    if (!materials.has(original)) {
      const result = original.clone();
      for (const [name, value] of Object.entries(result)) if (value?.isTexture) {
        if (!textures.has(value)) textures.set(value, value.clone());
        result[name] = textures.get(value);
      }
      materials.set(original, result);
    }
    return materials.get(original);
  };
  copy.traverse(object => {
    if (object.geometry) {
      if (!geometries.has(object.geometry)) geometries.set(object.geometry, object.geometry.clone());
      object.geometry = geometries.get(object.geometry);
    }
    if (object.material) object.material = Array.isArray(object.material)
      ? object.material.map(material) : material(object.material);
  });
  return copy;
}

// The level opens the scenario's switch-side module (lid-labels.js moduleTier): the 800G twin-port for H100 and GB200,
// the 1.6T twin-port for GB300, a 1.6T-class module of unpublished type for Vera Rubin. Both twin-ports are finned
// OSFPs with eight lanes each way, so one drawing serves both; the captions, DSP marking and lid print follow the tier
// (evidence.js 'module-follows-scenario').
/** @param {{ quality: any, state: any, model?: any }} options */
export function build({ quality, state, model: scenario }) {
  if (!cached) throw new Error('Blender module must finish preload() before build().');
  const accel = scenario?.accel, tier = moduleTier(accel);
  const scene = setup(quality, 9), model = cloneAsset(cached.scene);
  const objects = new Map();
  model.traverse(object => {
    objects.set(key(object.name), object);
    if (object.isMesh) { object.castShadow = !!quality.shadows; object.receiveShadow = !!quality.shadows; }
    if (object.isLight || object.isCamera || /studio[ _]floor/i.test(object.name)) object.visible = false;
  });
  const object = name => {
    const found = objects.get(key(name));
    if (!found) throw new Error(`Blender module is missing semantic group: ${name}`);
    return found;
  };
  let metadata;
  model.traverse(node => {
    if (node.userData.ifx) metadata = typeof node.userData.ifx === 'string'
      ? JSON.parse(node.userData.ifx) : node.userData.ifx;
  });
  if (metadata?.version !== 1 || metadata.units !== 'm' || metadata.coordinates !== 'gltf-root-rest') {
    throw new Error('Blender module requires version 1 IFX route metadata in glTF-root-rest metres.');
  }
  const routes = new Map(metadata.routes.map(route => [route.name, route]));
  model.scale.setScalar(CM);
  for (const [name, offset] of Object.entries(EXPLODED)) object(name).position.set(...offset.map(v => v / CM));
  scene.add(model);
  model.updateMatrixWorld(true);
  const breakoutWindows = [];
  model.traverse(node => {
    if (node.userData.pcbBreakoutWindow && node.material) {
      node.material.transparent = true; node.material.depthWrite = false;
      node.castShadow = false; breakoutWindows.push(node);
    }
  });
  const matched = typeof location !== 'undefined' && new URLSearchParams(location.search).get('finish') === 'matched';
  const { setLabelLpo, labelText, ...art } = matched ? {} : applyArtDirection({ scene, model, quality, accel });
  const look = matched ? undefined : { ...art, grain: 0.008, vignette: 0.22 };
  let amount = 1, targetAmount = 1, startAmount = 1, assemblyTime = 0;
  const assemblyObjects = Object.entries(EXPLODED).map(([name, offset]) => [object(name), offset]);

  // Overlays use centimetres in the same resting coordinate frame as the asset.
  // Their assembly translation matches the model; no Blender timeline is needed.
  const boardOverlay = new THREE.Group();
  boardOverlay.name = 'Blender module board overlays';
  boardOverlay.position.set(...EXPLODED['02_BOARD']); scene.add(boardOverlay);
  const flows = [], dataFlows = [], heatFlows = [], dspOnly = new Set(), lpoOnly = new Set();
  const lists = { power: flows, data: dataFlows, heat: heatFlows };
  let lpo = false, kind = 'dsp';   // kind: 'dsp' | 'lro' | 'lpo' (module-lro.js)
  const sourceRoute = name => {
    const route = routes.get(name);
    if (!route || route.assembly !== '02_BOARD' || route.points?.length < 2) {
      throw new Error(`Blender module is missing a board route: ${name}`);
    }
    return route.points.map(cm);
  };
  const addFlow = ({ id, source = null, points, mode = 'data', kind, variant = 'common', from, to,
    reverse = false, assembly = '02_BOARD', voltage, options }) => {
    const path = (source ? sourceRoute(source) : points).map(p => [...p]);
    if (reverse) path.reverse();
    const cls = voltage || ({ electrical: 'eth', power: 'core', heat: 'hot' })[kind] || kind;
    const style = ({ electrical: FLOW.elec, tx: FLOW.light, rx: FLOW.light, cw: FLOW.cw,
      power: FLOW.power, heat: FLOW.heat, air: FLOW.heat })[kind];
    // Put the glow into moving signals while keeping Studio's subdued static
    // materials and high bloom threshold. Smaller cores preserve lane separation.
    const finish = matched ? {} : { size: style.size * (kind === 'cw' ? 0.7 : 0.8), k: style.k * 1.35, trailR: 0.0045, trailK: 0.25 };
    // Power rails read as dimly as the light paths once did: give them a lit trace and
    // more frequent pulses so the power layer carries the same visual weight. The pulse
    // gain is capped below bloom blow-out where the white sub-volt rails converge on the
    // converters and the DSP.
    if (!matched && kind === 'power') Object.assign(finish, { size: style.size * 0.9, k: style.k * 1.55, count: 6, trail: true, trailR: 0.009, trailK: 0.5 });
    const f = flow(path, cls, { ...style, ...finish, ...options });
    // Diagnostics describe real runtime paths, including their physical source.
    f.route = { id, source, assembly, mode, kind, variant, from, to,
      direction: reverse ? 'reverse' : 'forward', points: path };
    lists[mode].push(f);
    if (variant === 'dsp') dspOnly.add(f);
    if (variant === 'lpo') lpoOnly.add(f);
    (assembly ? boardOverlay : scene).add(f.group);
    return f;
  };

  // Four of eight lanes carry animated samples, as in the original module. Each
  // pulse stays on its exported conductor. Processing inside opaque chips is not
  // represented as a fictitious exposed wire between their input/output pins.
  for (const i of [0, 2, 5, 7]) {
    const lane = String(i + 1).padStart(2, '0');
    for (const rx of [false, true]) {
      const prefix = rx ? 'RX' : 'TX', from = rx ? 'tia' : 'dsp', to = rx ? 'dsp' : 'driver';
      addFlow({ id: `${prefix}-${i}-host`, source: `${prefix} host copper ${i} -1`, kind: 'electrical',
        variant: 'dsp', from: rx ? 'dsp' : 'fingers', to: rx ? 'fingers' : 'dsp', reverse: rx });
      addFlow({ id: `${prefix}-${i}-engine`, source: `${prefix} engine copper ${i} -1`, kind: 'electrical',
        variant: 'dsp', from, to, reverse: rx });
    }
    addFlow({ id: `TX-${i}-bond`, source: `Driver bond ${i + 1}`, kind: 'electrical', from: 'driver', to: 'mzm' });
    addFlow({ id: `TX-${i}-rf-feed`, source: `TX RF feed ${i + 1}`, kind: 'electrical', from: 'driver', to: 'mzm' });
    addFlow({ id: `RX-${i}-bond`, source: `TIA bond ${i + 1}`, kind: 'electrical', from: 'pd', to: 'tia', reverse: true });
    addFlow({ id: `TX-${i}-waveguide`, source: `TX ${lane} MZM arm -1`, kind: 'tx', from: 'mzm', to: 'mpo' });
    addFlow({ id: `TX-${i}-waveguide-second-arm`, source: `TX ${lane} MZM arm 1`, kind: 'tx', from: 'mzm', to: 'mpo' });
    addFlow({ id: `RX-${i}-waveguide`, source: `RX ${lane} waveguide`, kind: 'rx', from: 'mpo', to: 'pd' });
    addFlow({ id: `TX-${i}-fiber`, source: `TX glass fiber ${lane}`, kind: 'tx', from: 'mzm', to: 'mpo' });
    addFlow({ id: `RX-${i}-fiber`, source: `RX glass fiber ${lane}`, kind: 'rx', from: 'mpo', to: 'pd', reverse: true });
  }
  for (let k = 0; k < 4; k++) for (let j = 0; j < 2; j++) {
    addFlow({ id: `CW-${k}-${j}`, source: `CW feed ${k} ${j}`, kind: 'cw', from: 'lasers', to: 'mzm' });
  }

  // LPO is a different electrical routing layout, not merely an absent DSP.
  // Draw both conductors of all eight pairs per direction and animate one member
  // of representative pairs, all the way to their assigned edge-connector contacts.
  for (let i = 0; i < 8; i++) for (const rx of [false, true]) for (const sign of [-1, 1]) {
    const prefix = rx ? 'RX' : 'TX';
    const host = sourceRoute(`${prefix} host copper ${i} ${sign}`);
    const engine = sourceRoute(`${prefix} engine copper ${i} ${sign}`);
    const points = sourceRoute(`${prefix} LPO copper ${i} ${sign}`);
    if (sign === -1 && [0, 2, 5, 7].includes(i)) {
      addFlow({ id: `${prefix}-${i}-bypass`, points, kind: 'electrical', variant: 'lpo',
        from: rx ? 'tia' : 'fingers', to: rx ? 'fingers' : 'driver', reverse: rx });
    }
  }
  const bypassMesh = new THREE.Group(), authoredBypass = object('LPO_BYPASS');
  bypassMesh.name = 'LPO bypass copper';
  authoredBypass.parent.add(bypassMesh); bypassMesh.add(authoredBypass);
  // LRO keeps the DSP's transmit copper and the LPO layout's receive copper: each merged copper mesh splits by direction
  const firstMesh = root => { let found; root.traverse(n => { if (!found && n.isMesh) found = n; }); return found; };
  const dspCopper = splitByZ(firstMesh(object('PART_DSP_TRACES'))), bypassCopper = splitByZ(firstMesh(authoredBypass));

  const anchorLocal = name => {
    const anchor = metadata.anchors[name];
    if (!anchor?.position || !EXPLODED[anchor.assembly]) throw new Error(`Blender module is missing anchor: ${name}`);
    return cm(anchor.position);
  };
  const anchorWorld = name => {
    const local = anchorLocal(name), offset = EXPLODED[metadata.anchors[name].assembly];
    return local.map((v, i) => v + offset[i]);
  };

  // Power and thermal arrows are functional diagrams, not exported PCB routing
  // or literal conduction through the display's exploded air gaps. They follow the board's layout
  // (design review 10/01/2026): the host's 3.3 V enters on the VCC pads at the centre of the card edge and runs
  // in an inner plane under the DSP to the two point-of-load stages beside its line-side edge, one each side,
  // outboard of the line bus. Each stage feeds the DSP back under its edge; the analog rails leave the stages
  // along the board edges, outboard of every lane, into the driver, the TIA and the lasers' bias pads.
  const fingers = anchorLocal('fingers'), converter = anchorLocal('dcdc'), dspLocal = anchorLocal('dsp');
  const analogAnchors = metadata.analogAnchors;
  if (analogAnchors?.length !== 1) throw new Error('Module requires one authored eight-channel analog anchor set.');
  const yB = fingers[1] + 0.005, stageZ = Math.abs(converter[2]), ctrlX = converter[0] - 0.4, eastX = converter[0] + 0.45, edgeZ = 0.93;
  for (const s of [1, -1]) {
    const stage = [converter[0], converter[1], s * stageZ];
    addFlow({ id: s > 0 ? 'power-input' : 'power-input-2', points: [[fingers[0] - 1, yB, 0], [fingers[0], yB, 0], [dspLocal[0], yB, 0],
      [dspLocal[0] + 0.6, yB, s * 0.68], [ctrlX, yB, s * 0.68], [stage[0], stage[1], s * 0.68]],
      mode: 'power', kind: 'power', voltage: 'v33', from: 'fingers', to: 'dcdc' });
    addFlow({ id: s > 0 ? 'power-dsp' : 'power-dsp-2', points: [[stage[0], stage[1], s * 0.48], [ctrlX, yB, s * 0.48], [dspLocal[0] + 0.6, yB, s * 0.48], dspLocal],
      mode: 'power', kind: 'power', from: 'dcdc', to: 'dsp', variant: 'dsp' });
  }
  for (const [engineIndex, anchors] of analogAnchors.entries()) for (const target of ['driver', 'tia', 'lasers']) {
    const end = cm(anchors[target]), s = Math.sign(end[2]) || 1;
    // the lasers' bias enters on pads at the photonic chip's outer edge, clear of the transmit RF lines
    const into = target === 'lasers' ? [end[0], end[1], s * 0.72] : end;
    addFlow({ id: `power-${target}-${engineIndex}`, points: [[eastX, converter[1], s * stageZ], [eastX + 0.5, yB, s * edgeZ], [into[0], yB, s * edgeZ], into],
      mode: 'power', kind: 'power', from: 'dcdc', to: target });
  }
  const dspAnchor = anchorWorld('dsp'), shellAnchor = anchorWorld('shell');
  const padY = EXPLODED['03_THERMAL'][1] + 0.456;
  const coverY = EXPLODED['04_COVER'][1] + 0.675, exhaustY = Math.max(shellAnchor[1] + 0.3, 5.6);
  for (let i = 0; i < 6; i++) {
    const x = dspAnchor[0] + (i % 3 - 1) * 0.22, z = dspAnchor[2] + (Math.floor(i / 3) - 0.5) * 0.4;
    tagHeat(addFlow({ id: `heat-dsp-${i}`, points: [[x, dspAnchor[1], z], [x, padY, z], [x, coverY, z], [x, exhaustY, z]],
      mode: 'heat', kind: 'heat', variant: 'dsp', from: 'dsp', to: 'shell', assembly: null }), 'dsp', PART_W.module.dsp);
  }
  for (const [engineIndex, anchors] of analogAnchors.entries()) {
    const engineWorld = name => cm(anchors[name]).map((v, i) => v + EXPLODED['02_BOARD'][i]);
    for (const source of ['driver', 'tia', 'lasers']) {
      const p = engineWorld(source);
      tagHeat(addFlow({ id: `heat-${source}-${engineIndex}`, points: [p, [p[0], coverY, p[2]], [p[0], exhaustY, p[2]]],
        mode: 'heat', kind: 'heat', from: source, to: 'shell', assembly: null }), source, PART_W.module[source]);
    }
  }
  for (let i = 0; i < 5; i++) {
    const z = -1.2 + i * 0.35;
    tagHeat(addFlow({ id: `heat-air-${i}`, points: [[6.3, exhaustY, z], [-6.2, exhaustY, z]],
      mode: 'heat', kind: 'air', from: 'shell', to: 'air', assembly: null }), 'shell-air', PART_W.module.total, 'carrier');
  }
  // One log rule for every heat stream (src/heat.js): the full DSP is the reference in every variant, so the LRO
  // view keeps its three transmit-side DSP streams (the rule gives 3.3) and the LPO view drops the DSP's six.
  balanceHeat(heatFlows);

  const dspGroup = object('PART_DSP'), thermal = object('03_THERMAL'), dspTraces = object('PART_DSP_TRACES');
  // Isolate the DSP material before animating its emissive heat cue: the export
  // shares its silicon material with driver, TIA and PIC meshes.
  const dspMaterials = new Map(), heatMaterials = [];
  dspGroup.traverse(node => {
    const isolate = m => {
      if (!dspMaterials.has(m)) {
        const copy = m.clone(); dspMaterials.set(m, copy);
        if (/silicon/i.test(copy.name)) {
          copy.emissive.set(0xff6a1a); copy.emissiveIntensity = 0; heatMaterials.push(copy);
        }
      }
      return dspMaterials.get(m);
    };
    if (node.material) node.material = Array.isArray(node.material) ? node.material.map(isolate) : isolate(node.material);
  });
  // Heat mode warms the finned cover itself, brightest over the DSP and toward
  // the fin roots: a qualitative cue, not a temperature map.
  const cover = object('04_COVER'), shellHeat = { value: 0 }, coverBase = { value: 0 }, heatX = { value: dspAnchor[0] };
  const shellMaterials = new Map();
  cover.traverse(node => {
    if (!node.isMesh || !/Satin nickel aluminium/i.test(node.material?.name || '')) return;
    if (!shellMaterials.has(node.material)) {
      const m = node.material.clone();
      m.emissive.set(0xff6a1a); m.emissiveIntensity = 1;
      m.onBeforeCompile = shader => {
        Object.assign(shader.uniforms, { ifxShellHeat: shellHeat, ifxCoverBase: coverBase,
          ifxHeatX: heatX });
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vIfxWorld;')
          .replace('#include <project_vertex>', '#include <project_vertex>\nvIfxWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>',
          '#include <common>\nvarying vec3 vIfxWorld;\nuniform float ifxShellHeat, ifxCoverBase, ifxHeatX;')
          .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          float ifxDx = (vIfxWorld.x - ifxHeatX) / 2.6;
          float ifxRise = clamp((vIfxWorld.y - ifxCoverBase) / 0.7, 0.0, 1.0);
          totalEmissiveRadiance *= ifxShellHeat * (0.18 + 0.82 * exp(-ifxDx * ifxDx)) * (1.0 - 0.6 * ifxRise);`);
      };
      m.customProgramCacheKey = () => 'ifx-module-shell-heat';
      shellMaterials.set(node.material, m);
    }
    node.material = shellMaterials.get(node.material);
  });
  // The driver, TIA and laser sources get their own, dimmer heat glow so every
  // heat arrow starts at a warm source; their silicon is shared with the PIC otherwise.
  const analogHeat = [];
  for (const [name, pattern, watts] of [['PART_DRIVER', /silicon/i, PART_W.module.driver], ['PART_TIA', /silicon/i, PART_W.module.tia], ['PART_LASERS', /Molded packages/i, PART_W.module.lasers]]) {
    const isolated = new Map();
    object(name).traverse(node => {
      if (!node.isMesh || !pattern.test(node.material?.name || '')) return;
      if (!isolated.has(node.material)) {
        const copy = node.material.clone(); copy.emissive.set(0xff6a1a); copy.emissiveIntensity = 0;
        copy.userData.heatGlow = heatIntensity(0.5, watts, PART_W.module.dsp);
        isolated.set(node.material, copy); analogHeat.push(copy);
      }
      node.material = isolated.get(node.material);
    });
  }
  const ghost = new THREE.Group(); boardOverlay.add(ghost);
  {
    const outline = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.015, 1.5),
      new THREE.MeshBasicMaterial({ color: 0x8fd3ff, transparent: true, opacity: 0.12, depthWrite: false }));
    outline.position.set(dspLocal[0], 0.279, dspLocal[2]); ghost.add(outline);
  }
  // LRO: the same package marked as a transmit-only retimer (representative, evidence 'module-lro-drawing')
  const lroMark = lroDieTop({ w: 1.0, d: 1.0, lanes: `8 × ${tier.lane}` }); lroMark.position.set(dspLocal[0], dspLocal[1] + 0.0015, dspLocal[2]);
  boardOverlay.add(lroMark);
  // The asset's DSP carries a modeled 1.6T marking (DSP / 8 × 200G / 1.6T); an 800G scenario covers it with its own.
  let dspCapacity = objects.get(key('SHARED_DSP_CAPACITY'));
  if (dspCapacity && tier.laneGbps !== 200) {
    dspCapacity.visible = false;
    // same place and size as the modeled marking: its box, in the board overlay's frame
    const box = new THREE.Box3().setFromObject(dspCapacity), at = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    const top = dspMarkingTop({ w: size.x * 1.1, d: size.z * 1.1, lines: ['DSP', `8 × ${tier.lane}`, tier.rate] });
    top.position.set(at.x - EXPLODED['02_BOARD'][0], box.max.y - EXPLODED['02_BOARD'][1] + 0.0005, at.z - EXPLODED['02_BOARD'][2]);
    boardOverlay.add(top); dspCapacity = top;
  }
  const lroTag = label(scene, 'LRO · DSP retimes transmit only; receive runs linear, TIA to host',
    [dspAnchor[0], dspAnchor[1] + 0.6, dspAnchor[2]], LRO_COLOR, 0.15);
  const lpoTag = label(scene, 'LPO · direct host lanes to the linear driver and TIA',
    [dspAnchor[0], dspAnchor[1] + 0.6, dspAnchor[2]], '#8fd3ff', 0.15);
  label(scene, `Pluggable module · ${tier.published ? `${tier.rate} twin-port OSFP, 2 × DR4` : `${tier.rate} OSFP, type unpublished`}`, [0.6, -0.35, 2.6], '#e8ecf2', 0.32);
  label(scene, '107.8 × 22.58 mm footprint · exploded spacing · representative internals', [0.6, -0.72, 2.6], note, 0.17);
  label(scene, `One DSP · ${tier.rate} · 8 TX + 8 RX · two ${tier.port} ports`, [0.6, -1.02, 2.6], unitCol, 0.17);
  // End-to-end TX/RX explanations live in the panel. Placing them at the host
  // connector would imply that light enters or leaves that electrical interface.
  const modeNote = label(scene, 'Power and heat arrows are schematic across the exploded assembly.',
    [0.6, -1.32, 2.6], note, 0.14);
  const diagramLabels = scene.children.filter(o => o.isSprite);
  // The overview frames the captions with the hardware, so the fit keeps them inside the clear view and off the
  // bottom HUD (the drag hint, the scale bar, the legend): see presentation.clearBottomHud and stage.js safeBox.
  const captionBounds = new THREE.Box3();
  for (const sprite of diagramLabels) if (sprite.userData.caption && sprite.position.y < 0) {
    const { x, y, z } = sprite.position, w = sprite.scale.x / 2, h = sprite.scale.y / 2;
    captionBounds.expandByPoint(new THREE.Vector3(x - w, y - h, z)).expandByPoint(new THREE.Vector3(x + w, y + h, z));
  }

  function setVariant(next) {
    kind = MODULE_VARIANTS.includes(next) ? next : 'dsp'; lpo = kind === 'lpo';
    dspGroup.visible = thermal.visible = dspTraces.visible = !lpo;
    bypassMesh.visible = kind !== 'dsp'; ghost.visible = lpoTag.visible = lpo;
    dspCopper.source.visible = bypassCopper.source.visible = kind !== 'lro';
    dspCopper.tx.visible = bypassCopper.rx.visible = kind === 'lro';
    lroMark.visible = kind === 'lro'; if (dspCapacity) dspCapacity.visible = kind === 'dsp';   // the 800G overlay sits outside the DSP group, so LPO hides it here too
    setLabelLpo?.(lpo);   // the lid print names the variant: the scenario's switch label, or ... LPO (LRO keeps the plain print: no source names it on a lid)
    syncFlows();
  }
  const setLpo = on => setVariant(on ? 'lpo' : 'dsp');
  // a flow's direction for the LRO split: receive lanes, and the DSP heat arrows on its receive side
  const rxFlow = f => /^RX-/.test(f.route.id) || /^heat-dsp-[012]$/.test(f.route.id);
  function syncFlows() {
    // Reveal the buried connector escape only in the open data diagram.
    for (const window of breakoutWindows) {
      const revealed = state.mode === 'data' && amount === 1 && targetAmount === 1;
      window.material.opacity = revealed ? 0.08 : 1;
      window.material.depthWrite = !revealed;
    }
    for (const [mode, list] of Object.entries(lists)) for (const f of list) {
      f.group.visible = amount === 1 && targetAmount === 1 && state.mode === mode && inVariant(kind, f.route.variant, rxFlow(f));
    }
    for (const sprite of diagramLabels) sprite.visible = amount === 1 && targetAmount === 1 && !state.selected;
    modeNote.visible = amount === 1 && targetAmount === 1 && state.mode !== 'data' && !state.selected;
    lpoTag.visible = amount === 1 && targetAmount === 1 && lpo;
    lroTag.visible = amount === 1 && targetAmount === 1 && kind === 'lro' && !state.selected;
  }
  function applyAssembly() {
    for (const [o, offset] of assemblyObjects) o.position.set(...offset.map(v => v / CM * amount));
    boardOverlay.position.set(...EXPLODED['02_BOARD'].map(v => v * amount));
    model.updateMatrixWorld(true);
    syncFlows();
  }
  function setExplode(value, { immediate = false } = {}) {
    if (!Number.isFinite(value)) return;
    targetAmount = THREE.MathUtils.clamp(value, 0, 1);
    startAmount = amount; assemblyTime = 0;
    if (immediate) { amount = targetAmount; applyAssembly(); }
    else syncFlows();
  }
  const hs = {};
  for (const name of ['fingers', 'dcdc', 'dsp', 'driver', 'lasers', 'mzm', 'mpo', 'pd', 'tia', 'shell']) {
    const p = anchorWorld(name);
    const [offset, size] = ({
      fingers: [[-2.0, 1.1, 2.5], [1.5, .35, 2.3]],
      dcdc: [[-.9, 1.2, 2.5], [1.8, .55, 1.3]],
      dsp: [[-1.2, 1.55, 3.2], [2.35, .5, 2.1]],
      driver: [[-.65, 1.0, 2.3], [1.25, .35, 1.2]],
      lasers: [[-.65, .9, 2.2], [1.2, .45, 1.15]],
      mzm: [[.85, 1.1, 2.4], [2.0, .35, 1.4]],
      mpo: [[2.4, 1.35, 1.75], [1.2, .95, 2.3]],
      pd: [[.35, 1.7, 1.2], [.55, .25, .8]],
      tia: [[-.45, 1.6, 1.25], [.75, .3, .8]],
      shell: [[-2.5, 2.0, 4.0], [7.5, .7, 2.5]],
    })[name];
    // A pin marks its part without sitting on the part's printed marking, and neighbouring
    // parts' pins stay apart: the pin moves to a free corner, the camera keeps the anchor.
    const pin = PIN_OFFSET[name] || [0, 0, 0];
    hs[name] = { pos: p.map((v, i) => v + pin[i]), view: componentView(p, offset, size) };
  }
  // Heat mode frames the DSP with its gap pad above it: the aim rises between the two
  // so the pad sits in clear space below the HUD hint, not under it. The pin and the
  // focus stay on the DSP.
  const dspHeat = { ...hs.dsp, view: (() => {
    const focus = hs.dsp.view.focus, target = [focus[0], focus[1] + 0.55, focus[2]];
    return { pos: [target[0] - 1.0, target[1] + 1.1, target[2] + 3.4], target, focus: [...focus], detailSize: [2.35, 1.3, 1.8] };
  })() };
  setLpo(false);
  scene.userData.blenderModule = { version: metadata.version, units: 'cm', source: 'osfp-module-runtime.glb',
    tier: tier.key, scope: `Representative single-DSP implementation: eight ${tier.lane} lanes per direction, split across two ${tier.port} optical ports. Exterior informed by public OSFP photographs. Exploded spacing; internals are illustrative.` };
  const built = {
    scene, flows, dataFlows, heatFlows, look,
    housingBounds: hardwareBounds(model).union(captionBounds),
    camera: { pos: quality.mobile ? [1.6, 13.5, 20.5] : [1.6, 12, 17.5], target: [0.5, 2.1, 0], near: 0.05, far: 300, min: 1.2, max: 40,
      portrait: { pos: [4.2, 9.5, 12], target: [0.9, 2.1, 0.2] } },
    hotspots: { fingers: hs.fingers, dcdc: hs.dcdc, dsp: hs.dsp, driver: hs.driver, lasers: hs.lasers },
    dataHotspots: { fingers: hs.fingers, dsp: hs.dsp, driver: hs.driver, lasers: hs.lasers, mzm: hs.mzm, mpo: hs.mpo, pd: hs.pd, tia: hs.tia },
    heatHotspots: { dsp: dspHeat, shell: hs.shell },
    variant: {
      get lpo() { return lpo; }, setLpo, get kind() { return kind; }, set: setVariant,
      // what the lid prints now: the hall's switch label for this scenario, plus LPO in the LPO view
      get lid() { return labelText?.() ?? moduleLabel(accel, lpo); }, tier,
      intro(mode) {
        if (kind === 'lro') return lroIntro(mode);
        if (!lpo) return null;
        return {
          data: 'LPO leaves out the module DSP. Host transmit lanes feed the linear driver, then the modulators and outgoing fibers. Incoming light reaches the photodiodes, whose current the TIA converts for the host. The lasers feed transmit only. Internal placement and RF routing are representative.',
          power: 'The LPO comparison removes the module DSP and its power branch. The linear driver, TIA, laser sources and power conversion remain. Arrows show the functional power path, not a board routing design.',
          heat: 'The LPO comparison removes the DSP and its thermal pad. The driver, TIA and laser sources still produce heat. Arrows show heat transfer schematically across the exploded assembly; the display gaps are not physical air gaps.',
        }[mode];
      },
      partCopy(part, mode) {
        if (kind === 'lro') return lroPartCopy(part, mode);
        if (!lpo) return part;
        if (part.id === 'dsp') return { ...part, title: 'DSP footprint, absent in LPO', kicker: 'Removed in this variant', body: 'The blue outline marks the shared DSP footprint for comparison. This LPO view contains no module DSP, DSP power branch or DSP thermal pad. The host provides the signal processing the linear optical link needs.', specs: [] };
        if (part.id === 'dcdc') return { ...part, body: 'The host supplies the module. Its converters provide the rails for the linear driver, TIA, laser sources and control circuitry. This LPO comparison has no module DSP power branch.' };
        if (part.id === 'driver' && mode === 'data') return { ...part, body: 'The linear driver takes outgoing electrical lanes directly from the host and drives the modulator electrodes. The module DSP is absent in this LPO comparison.' };
        return part;
      },
    },
    presentation: {
      compactPins: true, clearBottomHud: true,
      get explode() { return targetAmount; }, get amount() { return amount; },
      get hidePins() { return amount !== 1 || targetAmount !== 1; }, setExplode,
      assembledCamera: { pos: quality.mobile ? [3.5, 10, 18] : [7.5, 8, 13], target: [0.6, 0.5, 0] },
    },
    update(t, dt = 1 / 60) {
      const moving = amount !== targetAmount;
      if (moving) {
        assemblyTime = Math.min(1, assemblyTime + Math.max(0, dt) / 1.4);
        const ease = assemblyTime * assemblyTime * (3 - 2 * assemblyTime);
        amount = assemblyTime === 1 ? targetAmount : startAmount + (targetAmount - startAmount) * ease;
        applyAssembly();
      }
      syncFlows();
      // Without the DSP (LPO) the analog chips remain the sources, so the warm band moves and dims.
      // glows on the same log rule as the streams: the shell by the whole module's watts, each chip by its own
      shellHeat.value = state.mode === 'heat' && amount === 1 ? heatIntensity(0.26, PART_W.module[lpo ? 'lpo' : kind === 'lro' ? 'lro' : 'total'], PART_W.module.total) + 0.04 * Math.sin(t * 2) : 0;
      heatX.value = lpo ? anchorWorld('driver')[0] : dspAnchor[0];
      coverBase.value = cover.position.y * CM + 0.615;
      for (const material of analogHeat) material.emissiveIntensity = state.mode === 'heat' ? material.userData.heatGlow * (1 + 0.2 * Math.sin(t * 2 + 1)) : 0;
      for (const material of heatMaterials) material.emissiveIntensity = state.mode === 'heat' && !lpo
        ? heatIntensity(0.5, PART_W.module[kind === 'lro' ? 'lroDsp' : 'dsp'], PART_W.module.dsp) + 0.08 * Math.sin(t * 2) : 0;
      return moving;
    },
  };
  attachFlowRibbons(built, { width: 1.45, glow: 3.5, brightness: 2.8, mobile: quality.mobile });
  return built;
}
