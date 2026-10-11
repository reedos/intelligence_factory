// Meshopt-compress GLBs in place: node tools/compress-models.mjs [file.glb ...] (default: every public/models/*.glb).
// Run after rebuilding GLBs in Blender (npm run models:compress). The loaders decode it with three's MeshoptDecoder
// (src/scenes/gltf-loader.js). Geometry stays exact: positions stay float32 and node transforms, names, extras,
// materials and textures are untouched; only normals, UVs and colors are quantized (KHR_mesh_quantization),
// vertices reordered for the cache, and the buffers meshopt-encoded (EXT_meshopt_compression).
// Files that already use EXT_meshopt_compression are skipped, so re-running is safe.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Logger, NodeIO, PropertyType } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { prune, quantize, reorder } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const dir = 'public/models';
const files = process.argv.slice(2).length ? process.argv.slice(2)
  : readdirSync(dir).filter(f => f.endsWith('.glb')).map(f => join(dir, f));

await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
const io = new NodeIO().setLogger(new Logger(Logger.Verbosity.ERROR)).registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

// the GLB's JSON chunk: enough to see whether it is already compressed without decoding it
const extensionsUsed = file => {
  const b = readFileSync(file), length = b.readUInt32LE(12);
  return JSON.parse(b.subarray(20, 20 + length).toString('utf8')).extensionsUsed || [];
};
const mb = n => (n / 1e6).toFixed(2);

let before = 0, after = 0;
for (const file of files) {
  const size = statSync(file).size;
  // the module's lane-flow glow follows its authored vertex order, which compression reorders: it ships as authored
  if (/osfp-module-runtime\.glb$/.test(file)) { console.log(`keep  ${file} (shipped uncompressed: its lane glow needs the authored vertex order)`); continue; }
  if (extensionsUsed(file).includes('EXT_meshopt_compression')) { console.log(`skip  ${file} (already meshopt, ${mb(size)} MB)`); continue; }
  const doc = await io.read(file);
  await doc.transform(
    reorder({ encoder: MeshoptEncoder }),
    // POSITION stays float: quantizing it would move every mesh's node transform, which scene code reads
    quantize({ pattern: /^(?!POSITION$)/, cleanup: false }),
    prune({ propertyTypes: [PropertyType.ACCESSOR], keepAttributes: true, keepIndices: true }),
  );
  doc.createExtension(EXTMeshoptCompression).setRequired(true)
    .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  await io.write(file, doc);
  const out = statSync(file).size;
  before += size; after += out;
  console.log(`wrote ${file}: ${mb(size)} -> ${mb(out)} MB`);
}
if (before) console.log(`total ${mb(before)} -> ${mb(after)} MB`);
