// Opt-in Blender geometry behind the existing module scene contract. World unit = 1 cm.
// The asset is a representative layout, not a recovered production design. Exported
// routes describe visible conductors; chip-internal paths are omitted; contact breakout uses representative PCB layers.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { THREE, flow, setup, label, FLOW, COL, note, unitCol } from './side-kit.js';
import { applyArtDirection } from './module-art-direction.js';
import { attachFlowRibbons } from '../flow-ribbons.js';
import { hardwareBounds, componentView } from '../app/housing-frame.js';

let cached, pending;
const CM = 100;
const EXPLODED = {
  '01_BASE': [0, 0, 0], '02_BOARD': [0, 1.5, 0], '03_THERMAL': [0, 2.6, 0],
  '04_COVER': [0, 4, 0], '05_PULL_TAB': [0, 0, 0],
};
const key = name => name.replace(/[\s_]+/g, ' ').trim().toLowerCase();
const cm = point => point.map(value => value * CM);

export function preload(url = `${import.meta.env?.BASE_URL || '/'}models/osfp-module-runtime.glb?v=edge-connected9`) {
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

export function build({ quality, state }) {
  if (!cached) throw new Error('Blender module must finish preload() before build().');
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
  const look = matched ? undefined : { ...applyArtDirection({ scene, model, quality }), grain: 0.008, vignette: 0.22 };
  let amount = 1, targetAmount = 1, startAmount = 1, assemblyTime = 0;
  const assemblyObjects = Object.entries(EXPLODED).map(([name, offset]) => [object(name), offset]);

  // Overlays use centimetres in the same resting coordinate frame as the asset.
  // Their assembly translation matches the model; no Blender timeline is needed.
  const boardOverlay = new THREE.Group();
  boardOverlay.name = 'Blender module board overlays';
  boardOverlay.position.set(...EXPLODED['02_BOARD']); scene.add(boardOverlay);
  const flows = [], dataFlows = [], heatFlows = [], dspOnly = new Set(), lpoOnly = new Set();
  const lists = { power: flows, data: dataFlows, heat: heatFlows };
  let lpo = false;
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
  // or literal conduction through the display's exploded air gaps.
  const fingers = anchorLocal('fingers'), converter = anchorLocal('dcdc');
  addFlow({ id: 'power-input', points: [[fingers[0] - 1, fingers[1], fingers[2]], fingers, converter],
    mode: 'power', kind: 'power', voltage: 'v33', from: 'fingers', to: 'dcdc' });
  const analogAnchors = metadata.analogAnchors;
  if (analogAnchors?.length !== 1) throw new Error('Module requires one authored eight-channel analog anchor set.');
  const dspLocal = anchorLocal('dsp');
  addFlow({ id: 'power-dsp', points: [converter, [converter[0] + 0.4, converter[1], dspLocal[2]], dspLocal],
    mode: 'power', kind: 'power', from: 'dcdc', to: 'dsp', variant: 'dsp' });
  for (const [engineIndex, anchors] of analogAnchors.entries()) for (const target of ['driver', 'tia', 'lasers']) {
    const end = cm(anchors[target]);
    addFlow({ id: `power-${target}-${engineIndex}`, points: [converter, [converter[0] + 0.4, converter[1], end[2]], end],
      mode: 'power', kind: 'power', from: 'dcdc', to: target });
  }
  const dspAnchor = anchorWorld('dsp'), shellAnchor = anchorWorld('shell');
  const padY = EXPLODED['03_THERMAL'][1] + 0.518;
  const coverY = EXPLODED['04_COVER'][1] + 0.675, exhaustY = Math.max(shellAnchor[1] + 0.3, 5.6);
  for (let i = 0; i < 6; i++) {
    const x = dspAnchor[0] + (i % 3 - 1) * 0.22, z = dspAnchor[2] + (Math.floor(i / 3) - 0.5) * 0.4;
    addFlow({ id: `heat-dsp-${i}`, points: [[x, dspAnchor[1], z], [x, padY, z], [x, coverY, z], [x, exhaustY, z]],
      mode: 'heat', kind: 'heat', variant: 'dsp', from: 'dsp', to: 'shell', assembly: null });
  }
  for (const [engineIndex, anchors] of analogAnchors.entries()) {
    const engineWorld = name => cm(anchors[name]).map((v, i) => v + EXPLODED['02_BOARD'][i]);
    for (const source of ['driver', 'tia', 'lasers']) {
      const p = engineWorld(source);
      addFlow({ id: `heat-${source}-${engineIndex}`, points: [p, [p[0], coverY, p[2]], [p[0], exhaustY, p[2]]],
        mode: 'heat', kind: 'heat', from: source, to: 'shell', assembly: null });
    }
  }
  for (let i = 0; i < 5; i++) {
    const z = -1.2 + i * 0.35;
    addFlow({ id: `heat-air-${i}`, points: [[6.3, exhaustY, z], [-6.2, exhaustY, z]],
      mode: 'heat', kind: 'air', from: 'shell', to: 'air', assembly: null });
  }

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
  const ghost = new THREE.Group(); boardOverlay.add(ghost);
  {
    const outline = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.015, 1.5),
      new THREE.MeshBasicMaterial({ color: 0x8fd3ff, transparent: true, opacity: 0.12, depthWrite: false }));
    outline.position.set(dspLocal[0], 0.279, dspLocal[2]); ghost.add(outline);
  }
  const lpoTag = label(scene, 'LPO · direct host lanes to the linear driver and TIA',
    [dspAnchor[0], dspAnchor[1] + 0.6, dspAnchor[2]], '#8fd3ff', 0.15);
  label(scene, 'Pluggable module · 1.6T twin-port OSFP, 2 × DR4', [0.6, -0.35, 2.6], '#e8ecf2', 0.32);
  label(scene, '107.8 × 22.58 mm footprint · exploded spacing · representative internals', [0.6, -0.72, 2.6], note, 0.17);
  label(scene, 'One DSP · 1.6T · 8 TX + 8 RX · two 800G ports', [0.6, -1.02, 2.6], unitCol, 0.17);
  // End-to-end TX/RX explanations live in the panel. Placing them at the host
  // connector would imply that light enters or leaves that electrical interface.
  const modeNote = label(scene, 'Power and heat arrows are schematic across the exploded assembly.',
    [0.6, -1.32, 2.6], note, 0.14);
  const diagramLabels = scene.children.filter(o => o.isSprite);

  function setLpo(on) {
    lpo = !!on;
    dspGroup.visible = thermal.visible = dspTraces.visible = !lpo;
    bypassMesh.visible = ghost.visible = lpoTag.visible = lpo;
    syncFlows();
  }
  function syncFlows() {
    // Reveal the buried connector escape only in the open data diagram.
    for (const window of breakoutWindows) {
      const revealed = state.mode === 'data' && amount === 1 && targetAmount === 1;
      window.material.opacity = revealed ? 0.08 : 1;
      window.material.depthWrite = !revealed;
    }
    for (const [mode, list] of Object.entries(lists)) for (const f of list) {
      f.group.visible = amount === 1 && targetAmount === 1 && state.mode === mode && !(lpo ? dspOnly.has(f) : lpoOnly.has(f));
    }
    for (const sprite of diagramLabels) sprite.visible = amount === 1 && targetAmount === 1 && !state.selected;
    modeNote.visible = amount === 1 && targetAmount === 1 && state.mode !== 'data' && !state.selected;
    lpoTag.visible = amount === 1 && targetAmount === 1 && lpo;
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
      mpo: [[2.4, 1.15, 1.7], [1.6, .8, 2.45]],
      pd: [[.7, 1.0, -2.2], [1.3, .35, 1.2]],
      tia: [[-.65, 1.0, -2.3], [1.25, .35, 1.2]],
      shell: [[-2.5, 2.0, 4.0], [7.5, .7, 2.5]],
    })[name];
    hs[name] = { pos: p, view: componentView(p, offset, size) };
  }
  setLpo(false);
  scene.userData.blenderModule = { version: metadata.version, units: 'cm', source: 'osfp-module-runtime.glb',
    scope: 'Representative single-DSP implementation: eight 200G lanes per direction, split across two 800G optical ports. Exterior informed by public OSFP photographs. Exploded spacing; internals are illustrative.' };
  const built = {
    scene, flows, dataFlows, heatFlows, look,
    housingBounds: hardwareBounds(model),
    camera: { pos: quality.mobile ? [1.6, 13.5, 20.5] : [1.6, 12, 17.5], target: [0.5, 2.1, 0], near: 0.05, far: 300, min: 1.2, max: 40,
      portrait: { pos: [1.2, 14.5, 19], target: [0.7, 2.3, 0.3] } },
    hotspots: { fingers: hs.fingers, dcdc: hs.dcdc, dsp: hs.dsp, driver: hs.driver, lasers: hs.lasers },
    dataHotspots: { fingers: hs.fingers, dsp: hs.dsp, driver: hs.driver, lasers: hs.lasers, mzm: hs.mzm, mpo: hs.mpo, pd: hs.pd, tia: hs.tia },
    heatHotspots: { dsp: hs.dsp, shell: hs.shell },
    variant: {
      get lpo() { return lpo; }, setLpo,
      intro(mode) {
        if (!lpo) return null;
        return {
          data: 'LPO leaves out the module DSP. Host transmit lanes feed the linear driver, then the modulators and outgoing fibers. Incoming light reaches the photodiodes, whose current the TIA converts for the host. The lasers feed transmit only. Internal placement and RF routing are representative.',
          power: 'The LPO comparison removes the module DSP and its power branch. The linear driver, TIA, laser sources and power conversion remain. Arrows show the functional power path, not a board routing design.',
          heat: 'The LPO comparison removes the DSP and its thermal pad. The driver, TIA and laser sources still produce heat. Arrows show heat transfer schematically across the exploded assembly; the display gaps are not physical air gaps.',
        }[mode];
      },
      partCopy(part, mode) {
        if (!lpo) return part;
        if (part.id === 'dsp') return { ...part, title: 'DSP footprint, absent in LPO', kicker: 'Removed in this variant', body: 'The blue outline marks the shared DSP footprint for comparison. This LPO view contains no module DSP, DSP power branch or DSP thermal pad. The host provides the signal processing the linear optical link needs.', specs: [] };
        if (part.id === 'dcdc') return { ...part, body: 'The host supplies the module. Its converters provide the rails for the linear driver, TIA, laser sources and control circuitry. This LPO comparison has no module DSP power branch.' };
        if (part.id === 'driver' && mode === 'data') return { ...part, body: 'The linear driver takes outgoing electrical lanes directly from the host and drives the modulator electrodes. The module DSP is absent in this LPO comparison.' };
        return part;
      },
    },
    presentation: {
      compactPins: true,
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
      for (const material of heatMaterials) material.emissiveIntensity = state.mode === 'heat' && !lpo
        ? 0.5 + 0.08 * Math.sin(t * 2) : 0;
      return moving;
    },
  };
  attachFlowRibbons(built, { width: 1.45, glow: 3.5, brightness: 2.8, mobile: quality.mobile });
  return built;
}
