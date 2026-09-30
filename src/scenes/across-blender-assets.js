// Authored geographic surface and plant symbols. Runtime only places/instances.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Builder } from '../kit.js';
let source, pending;
export function preloadAcrossAssets() {
  if (source) return Promise.resolve();
  return pending ||= new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/across-infrastructure.glb?v=3`)
    .then(g => { source = g.scene; source.updateMatrixWorld(true); })
    .catch(e => { pending = null; throw e; });
}
export const hasAcrossAssets = () => !!source;
export function acrossAssetBuilder(name) {
  const asset = source?.getObjectByName(name);
  if (!asset) throw new Error(`Missing Blender map asset: ${name}`);
  const b = new Builder(), materials = new Map();
  asset.traverse(o => {
    if (!o.isMesh) return;
    if (!materials.has(o.material)) materials.set(o.material, o.material.clone());
    b.addM(o.geometry, materials.get(o.material), o.matrixWorld);
  });
  return b;
}
export function acrossAssetInstances(name, matrices) {
  const g = acrossAssetBuilder(name).instance(matrices, { cast: false });
  g.name = `Blender ${name}`; g.userData.blenderAsset = name;
  g.traverse(o => { if (o.geometry) o.geometry.userData.authoredIn = 'Blender'; });
  return g;
}
export function acrossSurfaceGeometry() {
  // Builder intentionally discards UVs for solid-color mechanical batches;
  // the geographic surface must retain its authored map coordinates.
  const part = source?.getObjectByName('MAP_SURFACE')?.children.find(o => o.isMesh);
  if (!part) throw new Error('Missing Blender geographic surface');
  const geo = part.geometry.clone().applyMatrix4(part.matrixWorld);
  geo.userData.authoredIn = 'Blender';
  return geo;
}
export function replaceWindRotor(mesh) {
  const [geo] = acrossAssetBuilder('WIND_ROTOR').geometries().values();
  mesh.geometry.dispose(); mesh.geometry = geo;
  mesh.userData.blenderAsset = 'WIND_ROTOR'; geo.userData.authoredIn = 'Blender';
}
