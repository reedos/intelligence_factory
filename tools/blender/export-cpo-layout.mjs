// Regenerate before build-cpo.py so physical glass and animated light agree.
import { readFileSync, writeFileSync } from 'node:fs';
import { engineLayout, SUBS, edgeConnOf, cpoFiberRoutes } from '../../src/scenes/side-geometry.js';
const file = new URL('./link-layout.json', import.meta.url);
const previous = JSON.parse(readFileSync(file, 'utf8'));
const engines = engineLayout();
const layout = { ...previous, engines, subassemblies: SUBS,
  connectors: engines.map(e => edgeConnOf(e, 10.4)), fiberRoutes: engines.map(cpoFiberRoutes) };
// One coordinate triplet per line keeps generated geometry reviewable without 9,000 lines
// of individual coordinates.
writeFileSync(file, JSON.stringify(layout, null, 2).replace(/\[\s+(-?[\d.e+-]+),\s+(-?[\d.e+-]+),\s+(-?[\d.e+-]+)\s+\]/g, '[$1, $2, $3]') + '\n');
