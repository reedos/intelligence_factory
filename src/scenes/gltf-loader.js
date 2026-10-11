// Every GLB is meshopt-compressed (tools/compress-models.mjs); every loader decodes it with three's MeshoptDecoder.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

export const gltfLoader = () => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
