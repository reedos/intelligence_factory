import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { THREE, Builder } from '../kit.js';
let source, pending;
export function preloadCampusCatalog() {
  if (source) return Promise.resolve(source);
  return pending ||= new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/campus-catalog.glb?v=18`).then(g => { source=g.scene; source.updateMatrixWorld(true); source.traverse(o=>{if(o.isMesh)o.geometry.userData.blender={asset:'campus-catalog',part:o.name};}); return source; }).catch(e=>{pending=undefined;throw e;});
}
export const hasCampusCatalog=()=>!!source;
// Blender meshes supply shape/material; JS only instantiates scenario placement.
export function campusCatalogBuilder(name, target=new Builder()) {
  const asset=source?.getObjectByName(name); if(!asset) throw new Error(`Missing Blender campus asset ${name}`);
  const mats=new Map();
  asset.traverse(o=>{
    if(!o.isMesh) return;
    const m=Array.isArray(o.material)?o.material[0]:o.material;
    if(!mats.has(m)) mats.set(m,m.clone());
    target.addM(o.geometry,mats.get(m),o.matrixWorld);
    target.parts.get(mats.get(m)).at(-1).userData.blender={asset:'campus-catalog',part:o.name};
  });
  if(!target._blenderCatalogMarked){
    const original=target.geometries.bind(target);
    target.geometries=()=>{const result=original();for(const [mat,g] of result)if(target.parts.get(mat).every(p=>p.userData.blender))g.userData.blender={asset:'campus-catalog',part:name};return result;};
    target._blenderCatalogMarked=true;
  }
  return target;
}
export function campusCatalogInstances(name, matrices, options) {
  const g=campusCatalogBuilder(name).instance(matrices,options);g.name=`Blender ${name}`;g.userData.blenderAsset=name;return g;
}
export function campusCatalogRotor(mesh) {
  if(!source)return;
  const [[mat,geo]]=campusCatalogBuilder('FAN').geometries();
  // the rotor's own grey FRP finish, not the caller's placeholder dark steel
  mesh.geometry.dispose();mesh.geometry=geo;mesh.material=mat;mesh.userData.blenderAsset='FAN';
}
