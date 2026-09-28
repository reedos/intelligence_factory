/// <reference types="vite/client" />
import { describe, it, expect } from 'vitest';

// Regression for the audit's item 2(b): `group.children.forEach(m => target.add(m))` reparents while
// iterating, which mutates the very array forEach is walking (THREE's Object3D.add removes the child
// from its old parent's children array as it attaches it elsewhere) and silently skips roughly half of
// a multi-material Builder's meshes — see src/kit.js Builder.build()/instance(), which return one mesh
// per material. campus.js and across.js each did this to every instanced part (transmission towers,
// cooling units, gensets, battery enclosures, cars, every tree, amplifier huts, line terminals), so
// only one material of each ever reached the scene (a tree with no canopy, a hut with no roof). The
// fix is to add the returned group itself (`scene.add(builder.instance(...))`), never to iterate and
// reparent its live children. This can't be unit-tested against the real THREE scene graph here (kit.js
// calls document.createElement at import time, and this project's tests run without a DOM — see
// tools/parts.mjs, views.mjs and coplanar.mjs for the browser-driven checks that exercise the built
// scenes), so this scans every scene source file's text for the broken pattern instead (via Vite's
// import.meta.glob, so no Node fs/path types are needed), which is what would have caught it: cheap,
// exact, and it can't come back unnoticed in any scene file, present or future.
const sources = import.meta.glob('./*.js', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;

describe('scene builders add the whole instance/build group, never its live children', () => {
  const reparents = /\.children\.forEach\(/;
  const files = Object.keys(sources);
  for (const file of files) {
    it(`${file} has no reparent-while-iterating`, () => {
      expect(reparents.test(sources[file])).toBe(false);
    });
  }
  it('found at least one scene file to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });
});
