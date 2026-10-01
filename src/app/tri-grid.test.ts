import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildTriGrid } from './tri-grid.js';

// a deterministic pseudo-random sequence, so a failure reproduces
function rng(seed: number) { return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296); }

function check(side: THREE.Side, indexed: boolean) {
  let geo: THREE.BufferGeometry = new THREE.TorusKnotGeometry(1, 0.3, 400, 40);
  if (!indexed) geo = geo.toNonIndexed();
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side }));
  mesh.position.set(3, -1, 2); mesh.rotation.set(0.4, 1.1, -0.3); mesh.scale.set(1.5, 0.8, 1.2); mesh.updateMatrixWorld(true);
  const grid = buildTriGrid(mesh)!;
  expect(grid).not.toBeNull();
  const ray = new THREE.Raycaster(), r = rng(side * 10 + (indexed ? 1 : 0) + 7);
  let hits = 0;
  for (let n = 0; n < 400; n++) {
    const from = new THREE.Vector3(3 + (r() - 0.5) * 8, -1 + (r() - 0.5) * 8, 2 + (r() - 0.5) * 8);
    const to = new THREE.Vector3(3 + (r() - 0.5) * 3, -1 + (r() - 0.5) * 3, 2 + (r() - 0.5) * 3);
    const dir = to.clone().sub(from).normalize(), far = from.distanceTo(to) * (0.3 + r() * 1.2);
    ray.set(from, dir); ray.near = 0; ray.far = far;
    const three = ray.intersectObject(mesh, false).length > 0;
    expect(grid.hits(from, dir, far)).toBe(three);
    if (three) hits++;
  }
  expect(hits).toBeGreaterThan(40);       // the test covers both outcomes
}

describe('triangle grid', () => {
  it('agrees with three\u2019s raycast, front-sided, indexed', () => check(THREE.FrontSide, true));
  it('agrees with three\u2019s raycast, double-sided, not indexed', () => check(THREE.DoubleSide, false));
  it('agrees with three\u2019s raycast, back-sided', () => check(THREE.BackSide, true));
  it('skips small meshes and knows when its mesh has moved', () => {
    const small = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    expect(buildTriGrid(small)).toBeNull();
    const big = new THREE.Mesh(new THREE.TorusKnotGeometry(1, 0.3, 400, 40), new THREE.MeshBasicMaterial());
    big.updateMatrixWorld(true);
    const g = buildTriGrid(big)!;
    expect(g.fresh()).toBe(true);
    big.position.x = 1; big.updateMatrixWorld(true);
    expect(g.fresh()).toBe(false);
  });
});
