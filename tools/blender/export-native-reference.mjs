// Offline technical-layout reference export. Final deliverables are authored in
// Blender, not these reference GLBs. No browser automation or app runtime is used.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const canvasPath = process.env.IFX_CANVAS_PACKAGE || 'C:/Users/reedo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas';
const { createCanvas, ImageData, Image } = require(canvasPath);
const CanvasType = createCanvas(1, 1).constructor;
// NAPI exposes a data() method that browser canvases do not have. Three's
// exporter mistakes any .data member for raw DataTexture pixels and writes
// transparent black. Hide that non-browser method in this offline adapter.
Object.defineProperty(CanvasType.prototype, 'data', { value: undefined, configurable: true });
CanvasType.prototype.toBlob = function(callback, mime = 'image/png') {
  const buffer = this.toBuffer(mime === 'image/jpeg' ? 'image/jpeg' : 'image/png');
  queueMicrotask(() => callback(new Blob([buffer], { type: mime })));
};
globalThis.HTMLCanvasElement = CanvasType;
globalThis.HTMLImageElement = Image;
globalThis.ImageData = ImageData;
globalThis.document = { createElement(tag) {
  if (tag !== 'canvas') throw new Error(`Unexpected offline DOM dependency: ${tag}`);
  return createCanvas(1, 1);
} };
globalThis.FileReader = class {
  async readAsArrayBuffer(blob) { this.result = await blob.arrayBuffer(); this.onloadend?.(); }
  async readAsDataURL(blob) { this.result = `data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`; this.onloadend?.(); }
};

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const referenceDirectory = path.join(ROOT, 'tools', 'blender', 'references');
await fs.mkdir(referenceDirectory, { recursive: true });
export const server = await createServer({ root: ROOT, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });

export function isPhysicalMesh(object) {
  if (!object.isMesh || object.isReflector || object.userData.computeDynamic || object.userData.nativeOverlay || object.userData.printed) return false;   // nativeOverlay: runtime-only hardware (rack-mgmt.js)
  const materials = Array.isArray(object.material) ? object.material : [object.material];
  // Additive light markers/cache bands/status indicators are teaching effects.
  return materials.some(m => !m.isMeshBasicMaterial && !m.isShaderMaterial);
}

export async function exportReference({ name, module, options, unitMeters = 1, stripTextures = false, textureFree = false, prepare }) {
  const { build } = await server.ssrLoadModule(module);
  const built = build(options), root = new THREE.Group(), omit = new Set();
  prepare?.(built);
  for (const key of ['flows', 'dataFlows', 'heatFlows']) for (const f of built[key] || []) f.group.traverse(o => omit.add(o));
  let meshIndex = 0;
  const diagramSlots = new Map();
  const materialSlots = new Map();
  built.scene.updateMatrixWorld(true);
  built.scene.traverse(o => {
    if (omit.has(o) || !isPhysicalMesh(o)) return;
    const copy = o.clone(false);
    copy.geometry = o.geometry.clone();
    const mats = (Array.isArray(o.material) ? o.material : [o.material]).map((m, j) => {
      const result = m.clone();
      result.name ||= `Physical ${meshIndex}`;
      if (!materialSlots.has(m)) materialSlots.set(m, materialSlots.size);
      result.userData = { ...result.userData, ifxSourceMaterial: materialSlots.get(m) };
      if (stripTextures || textureFree) {
        const keys = Object.keys(result).filter(k => result[k]?.isTexture);
        if (keys.length) {
          result.userData = { ...result.userData, ifxCanvasSlot: `${meshIndex}:${j}`, ifxCanvasKeys: keys };
          if (m.map) {
            if (!diagramSlots.has(m.map)) diagramSlots.set(m.map, diagramSlots.size);
            result.userData.ifxDiagramSlot = diagramSlots.get(m.map);
          }
          for (const key of keys) result[key] = null;
        }
      }
      return result;
    });
    copy.material = Array.isArray(o.material) ? mats : mats[0];
    copy.matrix.copy(o.matrixWorld); copy.matrixAutoUpdate = false;
    copy.name = `REFERENCE_${name}_${String(meshIndex++).padStart(4, '0')}`;
    copy.userData = { sourceMesh: o.name || '', representative: true };
    root.add(copy);
  });
  root.scale.setScalar(unitMeters);
  root.name = `Technical layout reference ${name}`;
  root.userData = { basis: 'Reference positions from audited native technical layout. Blender authoring required.', nativeUnitMeters: unitMeters };
  const output = await new GLTFExporter().parseAsync(root, { binary: true, onlyVisible: false, maxTextureSize: 1024 });
  const target = path.join(referenceDirectory, `${name}.glb`);
  await fs.writeFile(target, Buffer.from(output));
  console.log(JSON.stringify({ name, physicalMeshes: meshIndex, bytes: output.byteLength, target }));
  return { built, target };
}

if (process.argv.includes('--optics')) {
  try {
    for (const name of ['coherent', 'copper']) await exportReference({ name: `${name}-internals`, module: `/src/scenes/side-${name}.js`, options: { quality: { shadows: false }, state: { mode: 'data' }, authoredHardware: true }, unitMeters: .01, textureFree: true });
  } finally { await server.close(); }
}
if (process.argv.includes('--hall')) {
  // The rack faces the data hall draws (build-hall-finish.py: NVL_FACE, H100_FACE), from the same records the rack level and
  // hall.js build from: nvl72-layout.js (rows, pitch, cabinet size), dgx-h100-layout.js (DGX_RACK: chassis, bezel, handles,
  // panel) and hall-rack-face.js (the face plane). Meters, rack frame, front +z. hall-rack-face.test.ts keeps this file and the
  // GLB in step with them.
  try {
    const L = await server.ssrLoadModule('/src/scenes/nvl72-layout.js'), G = await server.ssrLoadModule('/src/scenes/dgx-h100-layout.js'),
      F = await server.ssrLoadModule('/src/scenes/hall-rack-face.js');
    await fs.writeFile(path.join(referenceDirectory, 'hall-layout.json'), JSON.stringify({ unit: 1,
      rack: L.RACK, face: F.FACE,
      nvl: { pitch: L.U, rows: F.nvlFaceRows(), pulledKinds: ['power', 'compute'] },
      h100: { ...G.DGX_RACK, serverY: F.h100FaceServers().map(s => s.y), mgmtY: F.h100FaceMgmtY() } }, null, 1) + '\n');
    console.log(JSON.stringify({ name: 'hall-layout', target: path.join(referenceDirectory, 'hall-layout.json') }));
  } finally { await server.close(); }
}
if (process.argv.includes('--compute')) {
  try {
    const { compute, DEFAULT_SCENARIO } = await server.ssrLoadModule('/src/model/engine.ts');
    // IFX_ONLY=tray-gb200,tray-rubin limits the export to those references (other agents may own the rest)
    const only = process.env.IFX_ONLY?.split(',');
    for (const accel of ['h100', 'gb200', 'gb300', 'rubin']) {
      const model = compute({ ...DEFAULT_SCENARIO, accel });
      const scenes = (process.env.IFX_COMPUTE_SCENES || 'rack,tray,chip').split(',');
      for (const [scene, unitMeters] of [['rack', 1], ['tray', .1], ['chip', .01]].filter(([scene]) => scenes.includes(scene))) {
        if (only && !only.includes(`${scene}-${accel}`)) continue;
        await exportReference({ name: `${scene}-${accel}`, module: `/src/scenes/${scene}.js`, options: { quality: { shadows: false, reflections: false, mobile: false }, state: { mode: 'data' }, model }, unitMeters });
      }
    }
    // The pulled tray's layout, from the same constants tray.js / tray-rubin.js build the tray level from, for
    // rack-inspection-detail.py (Blender cannot import them): tray units, tray-local frame; unit = 0.1 m.
    const T = await server.ssrLoadModule('/src/scenes/tray.js'), R = await server.ssrLoadModule('/src/scenes/tray-rubin.js'), K = await server.ssrLoadModule('/src/scenes/rack.js');
    // The tray's front and rear interfaces, the OSFP/QSFP envelopes, the rack's tray rows and the module port counts come from the
    // same constants the scenes build from (tray.js, tray-rubin.js, osfp-size.js, nvl72-layout.js, dgx-h100-layout.js, lid-labels.js).
    const O = await server.ssrLoadModule('/src/scenes/osfp-size.js'), L = await server.ssrLoadModule('/src/scenes/nvl72-layout.js'),
      G = await server.ssrLoadModule('/src/scenes/dgx-h100-layout.js'), LL = await server.ssrLoadModule('/src/scenes/lid-labels.js');
    await fs.writeFile(path.join(referenceDirectory, 'rack-tray-layout.json'), JSON.stringify({ unit: 0.1,
      osfp: O.OSFP_U, qsfp: O.QSFP_U,
      modulePorts: Object.fromEntries(['h100', 'gb200', 'gb300', 'rubin'].map(a => [a, LL.modulePorts(a)])),
      rack: { layout: L.LAYOUT, pulled: L.PULLED, switchPulled: L.SWITCH_PULLED, base: L.BASE + 0.02, pitch: L.U },
      nvl: { boardX: T.NVL_BOARD_X, cpu: T.NVL_CPU, gpuZ: T.NVL_GPU_Z, gpuSize: T.NVL_GPU_SIZE, fanX: T.NVL_FAN_X, fanZ: T.NVL_FAN_Z, lpddr: T.NVL_LPDDR, plates: K.NVL_COLD_PLATES,
        front: T.NVL_FRONT, rear: T.NVL_REAR },
      rubin: { plates: R.RUBIN_COLD_PLATES, front: R.RUBIN_FRONT, rear: R.RUBIN_REAR, nic: R.RUBIN_NIC, dpu: R.RUBIN_DPU },
      h100: { cageX: G.DGX.cageX, cageY: G.DGX.cageY, storageX: G.DGX.storageX, storageDY: G.DGX.storageDY, cardY: G.DGX.cardY, driveX: G.DGX.driveX, driveY: G.DGX.driveY } }, null, 1));
    // The GPU package, once: the same descriptor chip.js, tray.js and tray-rubin.js build from, for build-compute.py
    // (stiffener ring and fiducials). gpu-package.test.ts keeps this file in step with the module.
    const GP = await server.ssrLoadModule('/src/scenes/gpu-package.js');
    await fs.writeFile(path.join(referenceDirectory, 'gpu-package.json'), JSON.stringify(GP.gpuPackageJson(), null, 1));
  } finally { await server.close(); }
}
