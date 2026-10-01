import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildOccupancy, occupancyBuilder } from './occupancy.js';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
function mesh(geo: THREE.BufferGeometry, at: THREE.Vector3, rotX = 0) {
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
  m.position.copy(at); m.rotation.x = rotX; m.updateMatrixWorld(true);
  return m;
}

describe('occupancy map', () => {
  // a 1 m box at the origin and a big tilted wall (big triangles) off to one side
  const box = mesh(new THREE.BoxGeometry(1, 1, 1), V(0, 0, 0));
  const wall = mesh(new THREE.PlaneGeometry(40, 20), V(0, 0, -10), 0.4);
  const occ = buildOccupancy([box, wall])!;

  it('is conservative: whatever is solid reads as occupied, and margins reach it', () => {
    expect(occ.near(V(0.5, 0, 0), 0)).toBe(true);                       // on the box's face
    expect(occ.near(V(1.5, 0, 0), 1.1)).toBe(true);                     // within 1.1 m of it
    expect(occ.segment(V(-5, 0, 0.2), V(5, 0, 0.2))).toBe(true);        // straight through the box
    const onWall = V(3, 0, -10);                                         // the wall passes through its own origin
    expect(occ.near(onWall, 0)).toBe(true);
  });
  it('leaves clear space clear', () => {
    expect(occ.near(V(5, 3, 5), 1)).toBe(false);
    expect(occ.segment(V(-5, 3, 4), V(5, 3, 4), 0.5)).toBe(false);
  });
  it('counts a step that ends inside something, not one that stops short of it', () => {
    expect(occ.segment(V(4, 2, 0), V(0, 0, 0))).toBe(true);
    expect(occ.segment(V(4, 2, 0), V(2, 1, 0))).toBe(false);
  });
  it('builds in slices to the same map', () => {
    const b = occupancyBuilder([box, wall]);
    let slices = 0; while (!b.step(0)) slices++;
    expect(slices).toBeGreaterThan(0);
    for (const p of [V(0.5, 0, 0), V(3, 0, -10), V(5, 3, 5)]) expect(b.result!.near(p, 0)).toBe(occ.near(p, 0));
  });
});
