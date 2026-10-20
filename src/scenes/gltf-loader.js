// Every GLB is meshopt-compressed (tools/compress-models.mjs); every loader decodes it with three's MeshoptDecoder.
// Compression stores normals, UVs and colours as normalized integers. Scene code merges, transforms and edits these
// geometries alongside its own float geometry (kit.js mergeGeometries), and mixing the two corrupts the normals, which
// a real GPU draws as a black scene. So every vertex attribute comes back as plain float32 once loaded: the download
// stays small and the scene code sees the same geometry it saw before compression.
import { BufferAttribute } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

function toFloat(attribute) {
  if (attribute.array instanceof Float32Array && !attribute.normalized && !attribute.isInterleavedBufferAttribute) return attribute;
  const { count, itemSize } = attribute, out = new Float32Array(count * itemSize), get = ['getX', 'getY', 'getZ', 'getW'];
  for (let i = 0; i < count; i++) for (let c = 0; c < itemSize; c++) out[i * itemSize + c] = attribute[get[c]](i);
  const result = new BufferAttribute(out, itemSize);
  result.name = attribute.name;
  return result;
}

export function floatAttributes(scene) {
  scene.traverse(o => {
    const g = o.geometry;
    if (!g) return;
    for (const name of Object.keys(g.attributes)) g.setAttribute(name, toFloat(g.attributes[name]));
  });
  return scene;
}

export const gltfLoader = () => {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const parse = loader.parse.bind(loader);
  loader.parse = (data, path, onLoad, onError) => parse(data, path, gltf => { gltf.scenes.forEach(floatAttributes); onLoad(gltf); }, onError);
  return loader;
};
