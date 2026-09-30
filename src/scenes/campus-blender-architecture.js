// Real Blender-authored architecture. Runtime owns scenario count and placement.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
let source, pending;
export function preloadCampusArchitecture() {
  if (source) return Promise.resolve(source);
  return pending ||= new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/campus-architecture.glb?v=4`).then(g => source = g.scene).catch(e => { pending = undefined; throw e; });
}
export const hasCampusArchitecture = () => !!source;
export function addBlenderCampusArchitecture(scene, hallList, x0, x1, quality) {
  if (!source) throw new Error('Campus architecture requires preload');
  const geometries = new Map(), materials = new Map();
  const own = original => {
    const group = original.clone(true);
    group.traverse(o => {
      if (!o.isMesh) return;
      if (!geometries.has(o.geometry)) geometries.set(o.geometry, o.geometry.clone());
      o.geometry = geometries.get(o.geometry); o.geometry.userData.blender={asset:'campus-architecture',part:o.name};
      const clone = m => {
        if (!materials.has(m)) materials.set(m, m.clone());
        return materials.get(m);
      };
      o.material = Array.isArray(o.material) ? o.material.map(clone) : clone(o.material);
      o.castShadow = !!quality.shadows; o.receiveShadow = true;
    });
    return group;
  };
  for (const [i,h] of hallList.entries()) {
    const hall = own(source.getObjectByName('HALL'));
    hall.name = `Blender campus hall ${i + 1}`;
    hall.scale.x = (x1-x0)/260;
    hall.position.set((x0+x1)/2,0,(h.z0+h.z1)/2);
    const office = own(source.getObjectByName('OFFICE'));
    office.name = `Blender campus office ${i+1}`;
    office.position.set(x0-14,0,(h.z0+h.z1)/2);
    scene.add(hall,office);
  }
  scene.userData.blenderCampusArchitecture = { source:'Blender', version:1, representative:true, detailedHalls:hallList.length, originalShellSuppressed:true };
}

// Material-batched exterior instances retain the same architectural language at
// large fleet sizes. These are representative envelopes, not an inventory of
// offices, cooling plant, or server equipment in the expanded halls.
export function addBlenderCampusExpansion(scene, matrices, quality) {
  const root=new THREE.Group();root.name='Expanded campus halls';
  root.userData.hallCount=matrices.length;
  source.updateMatrixWorld(true);
  source.getObjectByName('HALL').traverse(o=>{
    if(!o.isMesh)return;
    const geo=o.geometry.clone().applyMatrix4(o.matrixWorld);
    geo.userData.blender={asset:'campus-architecture',part:o.name};
    const mesh=new THREE.InstancedMesh(geo,Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone(),matrices.length);
    mesh.name=`Expanded ${o.name}`;
    matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));
    mesh.castShadow=!!quality.shadows;mesh.receiveShadow=true;root.add(mesh);
  });
  scene.add(root);
}
