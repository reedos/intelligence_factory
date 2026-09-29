import { it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Matrix4, Vector3, Quaternion } from 'three';
let Flow: any;
beforeAll(async () => {
  const context = new Proxy({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) } as Record<string, unknown>, { get: (target, key: string) => target[key] || (() => {}) });
  vi.stubGlobal('document', { createElement: () => ({ getContext: () => context }) });
  Flow = (await import('./kit.js')).Flow;
});
afterAll(() => vi.unstubAllGlobals());

it('adds readable pulses on sparse paths without changing their route or clock control', () => {
  const f = new Flow([[0, 0, 0], [0, 0, 10]], '#ff8800', { count: 3, size: .01, trail: false });
  f.setMotionStyle({ density: 1.8, brightness: 1.5, radius: 1.15, pixels: 1, stretch: 1.8 });
  expect(f.count).toBe(6); expect(f.mesh.count).toBe(6);
  expect(f.path.getPointAt(1).toArray()).toEqual([0, 0, 10]);
  f.setLevel(0); const acc = f.acc; f.update(10);
  expect(f.acc).toBe(acc); expect(f.mesh.visible).toBe(false);
  f.setLevel(1); f.update(11);
  expect(f.acc).toBeGreaterThan(acc); expect(f.mesh.visible).toBe(true);
  expect(f.mesh.material.depthTest).toBe(true);
  expect(f.mesh.material.transparent).toBe(true);
  f.setLevel(1, 2);
  expect(f.mesh.material.opacity).toBe(1);
  expect(f.mesh.material.transparent).toBe(true);
});

it('retains dense rail counts and caps projected pulse width instead of making solid neon', () => {
  const f = new Flow([[0, 0, 0], [0, 0, 1.4]], '#ff8800', { count: 42, size: .011, trail: false });
  f.setMotionStyle({ density: 2, radius: 1.15, pixels: 1, stretch: 1.8 });
  f.update(1, { position: new Vector3(1000, 1000, 1000), worldPerPixelAtUnit: .1 });
  expect(f.count).toBe(42);
  const m = new Matrix4(), p = new Vector3(), q = new Quaternion(), s = new Vector3();
  f.mesh.getMatrixAt(0, m); m.decompose(p, q, s);
  expect(s.x).toBeLessThanOrEqual(.011 * 1.6 + 1e-7);
  expect(s.x * 2).toBeLessThan(1.4 / 42 * .7);
  expect(s.z * 2).toBeLessThan(1.4 / 42 * .7);
  expect([p.x, p.y]).toEqual([0, 0]);
});

it('orients sparse directional cores along the path and applies the look only once', () => {
  const f = new Flow([[0, 0, 0], [10, 0, 0]], '#00ffff', { count: 3, size: .02, trail: false });
  f.setMotionStyle({ density: 2, brightness: 1.5, stretch: 1.8 });
  const color = f.base.color.clone(); f.setMotionStyle({ density: 2, brightness: 1.5 });
  expect(f.count).toBe(6); expect(f.base.color.equals(color)).toBe(true);
  f.update(2);
  const m = new Matrix4(), p = new Vector3(), q = new Quaternion(), s = new Vector3();
  f.mesh.getMatrixAt(0, m); m.decompose(p, q, s);
  expect(new Vector3(0, 0, 1).applyQuaternion(q).x).toBeCloseTo(1);
  expect(s.z / s.x).toBeCloseTo(1.8);
});
