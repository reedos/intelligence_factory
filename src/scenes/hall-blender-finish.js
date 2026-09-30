import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Builder } from '../kit.js';
let source,pending;
export const hasHallFinish=()=>!!source;
export function preloadHallFinish(){
 if(source)return Promise.resolve(source);
 return pending ||= new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/hall-finish.glb?v=8`).then(g=>{source=g.scene;source.updateMatrixWorld(true);return source;}).catch(e=>{pending=undefined;throw e;});
}
export function hallFinishInstances(name,matrices){
 const asset=source?.getObjectByName(name);if(!asset)throw new Error(`Missing authored hall finish ${name}`);
 const builder=new Builder(),materials=new Map();
 asset.traverse(o=>{if(!o.isMesh)return;const original=o.material;if(!materials.has(original))materials.set(original,original.clone());const material=materials.get(original);builder.addM(o.geometry,material,o.matrixWorld);builder.parts.get(material).at(-1).userData.blender={asset:'hall-finish',part:name};});
 const original=builder.geometries.bind(builder);builder.geometries=()=>{const result=original();for(const[material,geo]of result)if(builder.parts.get(material).every(p=>p.userData.blender))geo.userData.blender={asset:'hall-finish',part:name};return result;};
 const group=builder.instance(matrices);group.name=`Blender hall finish ${name}`;group.userData.blenderAsset=name;return group;
}
