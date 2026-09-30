// Real Blender-authored architecture. Runtime owns scenario count and placement.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Builder } from '../kit.js';
import { palette } from './campus-palette.js';
let source, pending;
export function preloadCampusArchitecture() {
  if (source) return Promise.resolve(source);
  return pending ||= new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/campus-architecture.glb?v=6`).then(g => source = g.scene).catch(e => { pending = undefined; throw e; });
}
export const hasCampusArchitecture = () => !!source;
// One assembly (HALL or OFFICE) as palette-merged geometry in its own frame: the same meshes and finishes, drawn in
// one call per shading instead of one per finish.
function assembly(name, materials) {
  source.updateMatrixWorld(true);
  const root = source.getObjectByName(name), inv = root.matrixWorld.clone().invert(), B = new Builder();
  root.traverse(o => {
    if (!o.isMesh) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!materials.has(m)) materials.set(m, m.clone());
    B.addM(o.geometry, materials.get(m), inv.clone().multiply(o.matrixWorld));
  });
  palette(B);
  const out = [];
  for (const [mat, geo] of B.geometries()) { geo.userData.blender = { asset: 'campus-architecture', part: name }; out.push([mat, geo]); }
  return out;
}
export function addBlenderCampusArchitecture(scene, hallList, x0, x1, quality) {
  if (!source) throw new Error('Campus architecture requires preload');
  const materials = new Map(), parts = { HALL: assembly('HALL', materials), OFFICE: assembly('OFFICE', materials) };
  const own = name => {
    const group = new THREE.Group();
    for (const [mat, geo] of parts[name]) {
      const mesh = new THREE.Mesh(geo, mat); mesh.name = `${name} ${mat.name}`;
      mesh.castShadow = !!quality.shadows; mesh.receiveShadow = true; group.add(mesh);
    }
    return group;
  };
  for (const [i,h] of hallList.entries()) {
    const hall = own('HALL');
    hall.name = `Blender campus hall ${i + 1}`;
    hall.scale.x = (x1-x0)/260;
    hall.position.set((x0+x1)/2,0,(h.z0+h.z1)/2);
    const office = own('OFFICE');
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
  for(const [mat,geo] of assembly('HALL',new Map())){
    const mesh=new THREE.InstancedMesh(geo,mat,matrices.length);
    mesh.name=`Expanded ${mat.name}`;
    matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));
    mesh.castShadow=!!quality.shadows;mesh.receiveShadow=true;root.add(mesh);
  }
  scene.add(root);
}
