// Copper-only reference export (the --optics flag also rewrites the coherent reference).
// Run: node tools/blender/export-copper-reference.mjs, then Blender: build-links.py -- copper
import { exportReference, server } from './export-native-reference.mjs';
try {
  await exportReference({ name: 'copper-internals', module: '/src/scenes/side-copper.js', options: { quality: { shadows: false }, state: { mode: 'data' }, authoredHardware: true }, unitMeters: .01, textureFree: true });
} finally { await server.close(); }
