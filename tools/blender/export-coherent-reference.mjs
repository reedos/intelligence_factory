// Regenerate only the coherent technical-layout reference (not copper).
// Run: node tools/blender/export-coherent-reference.mjs
import { exportReference, server } from './export-native-reference.mjs';
try {
  await exportReference({ name: 'coherent-internals', module: '/src/scenes/side-coherent.js', options: { quality: { shadows: false }, state: { mode: 'data' }, authoredHardware: true }, unitMeters: .01, textureFree: true });
} finally { await server.close(); }
