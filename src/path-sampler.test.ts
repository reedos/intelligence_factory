import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { PathSampler } from './path-sampler.js';

// A small seeded generator, so the polylines are the same on every run.
const rng = (seed: number) => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

function polyline(r: () => number, n: number, withRepeat = false) {
  const path = new THREE.CurvePath<THREE.Vector3>();
  const pts = Array.from({ length: n }, () => new THREE.Vector3((r() - .5) * 80, (r() - .5) * 20, (r() - .5) * 80));
  if (withRepeat && n > 3) pts[2].copy(pts[1]);        // a zero-length segment
  for (let i = 0; i < n - 1; i++) path.add(new THREE.LineCurve3(pts[i], pts[i + 1]));
  return path;
}

describe('PathSampler agrees with three.js CurvePath', () => {
  for (const [name, n, repeat] of [['2 points', 2, false], ['6 points', 6, false], ['40 points', 40, false], ['a zero-length segment', 8, true]] as const) {
    it(`positions and tangents match: ${name}`, () => {
      const r = rng(n * 7 + (repeat ? 1 : 0));
      for (let k = 0; k < 20; k++) {
        const path = polyline(r, n, repeat), s = new PathSampler(path);
        const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), d = new THREE.Vector3();
        for (let j = 0; j < 400; j++) {
          const u = j === 0 ? 0 : (j === 399 ? 0.999999999 : r());
          const want = path.getPointAt(u, a.clone()), ok = s.pointAt(u, b);
          expect(ok).toBe(want !== null);
          if (want) { expect(b.x).toBe(want.x); expect(b.y).toBe(want.y); expect(b.z).toBe(want.z); }
          const tw = path.getTangentAt(u, new THREE.Vector3());
          s.tangentAt(u, c, a, d);
          expect(c.x).toBe(tw.x); expect(c.y).toBe(tw.y); expect(c.z).toBe(tw.z);
        }
      }
    });
  }
});
