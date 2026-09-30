import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Builder } from '../kit.js';
let source,pending;
export const hasCampusVehicles=()=>!!source;
export function preloadCampusVehicles(){
 if(source)return Promise.resolve(source);
 return pending ||= new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/campus-vehicles.glb?v=7`).then(g=>{source=g.scene;source.updateMatrixWorld(true);return source;}).catch(e=>{pending=undefined;throw e;});
}
export function campusVehicleBuilder(name,target=new Builder()){
 const group=source?.getObjectByName(name);if(!group)throw new Error(`Missing Blender fleet model ${name}`);
 const materials=new Map();
 group.traverse(o=>{
  if(!o.isMesh)return;
  const original=Array.isArray(o.material)?o.material[0]:o.material;
  if(!materials.has(original))materials.set(original,original.clone());
  const material=materials.get(original),geo=o.geometry;
  geo.userData.blender={asset:'campus-vehicles',part:name};
  target.addM(geo,material,o.matrixWorld);
  target.parts.get(material).at(-1).userData.blender={asset:'campus-vehicles',part:name};
 });
 const geometries=target.geometries.bind(target);
 target.geometries=()=>{const result=geometries();for(const [mat,geo] of result)if(target.parts.get(mat).every(p=>p.userData.blender))geo.userData.blender={asset:'campus-vehicles',part:name};return result;};
 return target;
}
export function campusVehicleInstances(name,matrices){const g=campusVehicleBuilder(name).instance(matrices);g.name=`Blender fleet ${name}`;g.userData.blenderAsset=name;return g;}
