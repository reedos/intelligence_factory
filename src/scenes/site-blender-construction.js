// Blender-authored construction modules for scenario-dependent placement.
// The semantic catalog supplies complete equipment; this library supplies remaining
// panels, tubes, terrain surfaces and structural members. It does not claim a new
// equipment redesign merely because a construction primitive is authored in Blender.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { THREE, Builder as NativeBuilder } from '../kit.js';
let source,pending;
const geometries=new Map();
export function preloadSiteConstruction(){
 if(source)return Promise.resolve(source);
 return pending ||= new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/site-construction.glb?v=4`).then(g=>{
  source=g.scene;source.updateMatrixWorld(true);
  source.traverse(o=>{if(!o.isMesh)return;const geo=o.geometry.clone().applyMatrix4(o.matrixWorld);geo.userData.blender={asset:'site-construction',module:o.name};geometries.set(o.name,geo);});
  const faces=['PX','NX','PY','NY','PZ','NZ'].map(n=>{const g=geometries.get(`FACE_${n}`);return g.index?g.toNonIndexed():g.clone();});
  const box=mergeGeometries(faces,true);box.userData.blender={asset:'site-construction',module:'BOX_SIX_FACES'};geometries.set('BOX_SIX_FACES',box);
  return source;
 }).catch(e=>{pending=undefined;throw e;});
}
export const hasSiteConstruction=()=>!!source;
export function siteConstructionGeometry(name){const g=geometries.get(name);if(!g)throw new Error(`Missing Blender construction ${name}`);return g.clone();}
function fit(g,bounds){
 g.computeBoundingBox();const size=g.boundingBox.getSize(new THREE.Vector3()),center=g.boundingBox.getCenter(new THREE.Vector3());
 const target=bounds.getSize(new THREE.Vector3()),at=bounds.getCenter(new THREE.Vector3());
 g.translate(-center.x,-center.y,-center.z);g.scale(size.x>1e-8?target.x/size.x:1,size.y>1e-8?target.y/size.y:1,size.z>1e-8?target.z/size.z:1);g.translate(at.x,at.y,at.z);return g;
}
export function authoredConstruction(geo,{sixFaces=false}={}){
 if(!source||geo.userData.blender)return geo;
 geo.computeBoundingBox();const bounds=geo.boundingBox;let name;
 if(geo.type==='BoxGeometry')name=sixFaces?'BOX_SIX_FACES':(geo.attributes.position.count>24?'ROUNDED_BOX':'BOX');
 else if(geo.type==='RoundedBoxGeometry')name='ROUNDED_BOX';
 else if(geo.type==='ConeGeometry')name='CONE';
 else if(geo.type==='CylinderGeometry'){
  const p=geo.parameters;
  // nearest authored segment count: 12 for small parts, 24, and 48 for large tanks and stacks
  if(p.radiusTop===p.radiusBottom)name=p.radialSegments<=14?'CYLINDER_12':p.radialSegments>=32||Math.max(p.radiusTop,p.radiusBottom)>5?'CYLINDER_48':'CYLINDER';
  else if(Math.abs(p.radiusTop/p.radiusBottom-1.3/1.85)<1e-6)name='TAPERED_CYLINDER';
 }
 else if(geo.type==='TubeGeometry'){
  const p=geo.parameters,g=siteConstructionGeometry('TUBE'),pos=g.attributes.position;
  // [normal,tangent,-binormal] is right-handed; +binormal would
  // mirror the authored topology and make the tube's face winding inward.
  const frame=p.path.computeFrenetFrames(32,false);
  for(let i=0;i<pos.count;i++){
   const t=Math.max(0,Math.min(1,pos.getY(i))),j=Math.round(t*32),v=p.path.getPointAt(t);
   v.addScaledVector(frame.normals[j],pos.getX(i)*p.radius).addScaledVector(frame.binormals[j],-pos.getZ(i)*p.radius);
   pos.setXYZ(i,v.x,v.y,v.z);
  }
  g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;
 }
 else if(geo.type==='SphereGeometry')name=geo.parameters.thetaLength<Math.PI?'DOME':'SPHERE';
 else if(geo.type==='PlaneGeometry')name='PLANE';
 else if(geo.type==='LatheGeometry')name='COOLING_TOWER';
 if(!name)return geo;
 const g=siteConstructionGeometry(name);
 if(name==='PLANE'){
  const d=bounds.getSize(new THREE.Vector3());
  if(d.y<1e-7)g.rotateX(-Math.PI/2);else if(d.x<1e-7)g.rotateY(Math.PI/2);
 }
 return fit(g,bounds);
}
export class SiteBuilder extends NativeBuilder {
 addM(geo,mat,matrix){
  const authored=authoredConstruction(geo);super.addM(authored,mat,matrix);
  const prepared=this.parts.get(mat).at(-1);
  if(authored.userData.blender)prepared.userData.blender=authored.userData.blender;
  else prepared.userData.unconvertedSourceType=geo.type;
  return this;
 }
 geometries(){
  const result=super.geometries();
  for(const [mat,g] of result){
   const parts=this.parts.get(mat)||[];
   if(parts.every(p=>p.userData.blender))g.userData.blender={asset:'Blender construction/catalog assembly'};
   else g.userData.unconvertedSourceTypes=[...new Set(parts.filter(p=>!p.userData.blender).map(p=>p.userData.unconvertedSourceType||p.type))];
  }
  return result;
 }
}
// Only physical surfaces are included in provenance coverage. Flow/light/glow
// markers, text sprites, particle fields and sky shader are declared runtime effects.
export function finalizeSiteGeometry(scene){
 if(!source)return;
 const converted=new Map(),physical=[],unconverted=[];
 scene.traverse(o=>{
  if(!o.isMesh||o.userData.printed)return;   // printed labels and markers are surface decals, not construction
  const mats=Array.isArray(o.material)?o.material:[o.material];
  if(!mats.some(m=>m.isMeshStandardMaterial||m.isMeshPhysicalMaterial))return;
  if(!o.geometry.userData.blender){
   let g;
   if(o.name==='Illustrative distant ridgeline')g=fit(siteConstructionGeometry('RIDGE'),new THREE.Box3().setFromBufferAttribute(o.geometry.attributes.position));
   else {
    const key=o.geometry.uuid+(Array.isArray(o.material)?'-faces':'');
    if(!converted.has(key))converted.set(key,authoredConstruction(o.geometry,{sixFaces:Array.isArray(o.material)}));
    g=converted.get(key);
   }
   o.geometry=g;
  }
  physical.push(o);if(!o.geometry.userData.blender)unconverted.push({name:o.name||'(unnamed)',type:o.geometry.type,vertices:o.geometry.attributes.position.count,sources:o.geometry.userData.unconvertedSourceTypes});
 });
 scene.userData.blenderCoverage={physicalMeshes:physical.length,authoredPhysicalMeshes:physical.length-unconverted.length,unconverted,
  runtimeEffects:['Flow particles and path overlays','Status/light markers','Text sprites and UI','Sky shader','Heat/cloud particle fields']};
}
