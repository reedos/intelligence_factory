import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';

let native: any[];
let Builder: typeof import('./side-kit.js').Builder, materials: typeof import('./side-kit.js').materials;
beforeAll(async () => {
  const noop = () => undefined;
  const context = new Proxy({
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    measureText: (text: string) => ({ width: text.length * 24 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
  } as Record<string, unknown>, { get: (target, key: string) => key in target ? target[key] : noop });
  vi.stubGlobal('document', { createElement: () => ({ width: 1, height: 1, getContext: () => context }) });
  ({ Builder, materials } = await import('./side-kit.js'));
  native = await Promise.all([import('./side-module.js'), import('./side-cpo.js'), import('./side-coherent.js')]);
});
afterAll(() => vi.unstubAllGlobals());

describe('optical glass does not cast opaque PCF shadows', () => {
  for (const instanced of [false, true]) it(`keeps opaque hardware shadows in ${instanced ? 'instanced' : 'merged'} assemblies`, () => {
    const glass = materials().glass, metal = new THREE.MeshStandardMaterial();
    const b = new Builder();
    b.box(1, 1, 1, glass); b.box(1, 1, 1, metal, 2);
    const group = instanced ? b.instance([new THREE.Matrix4()]) : b.build();
    const meshes = group.children as THREE.Mesh[];
    expect(meshes.find(o => o.material === glass)?.castShadow).toBe(false);
    expect(meshes.find(o => o.material === metal)?.castShadow).toBe(true);
    expect(meshes.every(o => o.receiveShadow)).toBe(true);
    const disabled = instanced ? b.instance([new THREE.Matrix4()], { cast: false }) : b.build({ cast: false });
    expect(disabled.children.every(o => !o.castShadow)).toBe(true);
  });

  for (const [i, name] of ['module', 'CPO', 'coherent'].entries()) it(`preserves visible glass and solid-hardware shadows in the native ${name}`, () => {
    const b = native[i].build({ quality: { shadows: true, mobile: false }, state: { mode: 'data' } });
    const glass: THREE.Mesh[] = [], hardware: THREE.Mesh[] = [];
    b.scene.traverse((object: THREE.Object3D) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      if (mats.some(m => (m as THREE.MeshPhysicalMaterial).transmission > 0)) glass.push(mesh);
      else if (mats.every(m => !m.transparent)) hardware.push(mesh);
    });
    expect(glass.length).toBeGreaterThan(0);
    expect(glass.every(o => o.visible && !o.castShadow)).toBe(true);
    expect(hardware.some(o => o.visible && o.castShadow)).toBe(true);
    expect(b.dataFlows.length).toBeGreaterThan(0);
  });
});
