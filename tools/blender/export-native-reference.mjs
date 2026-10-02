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
if (process.argv.includes('--compute')) {
  try {
    const { compute, DEFAULT_SCENARIO } = await server.ssrLoadModule('/src/model/engine.ts');
    // IFX_COMPUTE_SCENES=rack and IFX_COMPUTE_ACCELS=gb200,gb300 narrow the export (default: everything).
    const only = (name, all) => process.env[name] ? process.env[name].split(',') : all;
    for (const accel of only('IFX_COMPUTE_ACCELS', ['h100', 'gb200', 'gb300', 'rubin'])) {
      const model = compute({ ...DEFAULT_SCENARIO, accel });
      for (const [scene, unitMeters] of [['rack', 1], ['tray', .1], ['chip', .01]].filter(([scene]) => only('IFX_COMPUTE_SCENES', [scene]).includes(scene))) {
        await exportReference({ name: `${scene}-${accel}`, module: `/src/scenes/${scene}.js`, options: { quality: { shadows: false, reflections: false, mobile: false }, state: { mode: 'data' }, model }, unitMeters });
      }
    }
  } finally { await server.close(); }
}
