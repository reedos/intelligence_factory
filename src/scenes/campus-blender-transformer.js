import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Builder } from '../kit.js';
let source,pending;
export const hasCampusTransformer=()=>!!source;
export function preloadCampusTransformer(){if(source)return Promise.resolve(source);return pending ||= new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/campus-transformer.glb?v=5`).then(g=>{source=g.scene;source.updateMatrixWorld(true);return source;}).catch(e=>{pending=undefined;throw e;});}
export function campusTransformerInstances(matrices){
 const builder=new Builder(),materials=new Map();
 source.traverse(o=>{if(!o.isMesh)return;if(!materials.has(o.material))materials.set(o.material,o.material.clone());const m=materials.get(o.material);builder.addM(o.geometry,m,o.matrixWorld);builder.parts.get(m).at(-1).userData.blender={asset:'campus-transformer',part:o.name};});
 const original=builder.geometries.bind(builder);builder.geometries=()=>{const result=original();for(const[m,g]of result)if(builder.parts.get(m).every(p=>p.userData.blender))g.userData.blender={asset:'campus-transformer'};return result;};
 const group=builder.instance(matrices);group.name='Blender main transformers';return group;
}
