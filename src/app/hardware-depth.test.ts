import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { HardwareBokehPass } from './hardware-bokeh.js';
import { HardwareGTAOPass } from './hardware-ao.js';
import { withHardwareDepth } from './hardware-depth.js';

function fixture() {
  const scene = new THREE.Scene();
  const hardware = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  const glass = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshPhysicalMaterial({ transparent: true, opacity: .85 }));
  const overlays: THREE.Object3D[] = [new LineSegments2(), new THREE.Line(), new THREE.Points(), new THREE.Sprite(),
    new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false })),
    new THREE.Mesh(new THREE.SphereGeometry(), new THREE.ShaderMaterial({ depthWrite: false }))];
  const group = new THREE.Group(); group.userData.runtimeOverlay = true; group.add(new THREE.Mesh()); overlays.push(group);
  const hidden = new THREE.Mesh(); hidden.visible = false;
  scene.add(hardware, glass, hidden, ...overlays);
  return { scene, hardware, glass, overlays, hidden };
}

describe('hardware depth contract across postprocessing', () => {
  for (const fails of [false, true]) it(`restores overlay visibility and override material${fails ? ' after an exception' : ''}`, () => {
    const { scene, hardware, glass, overlays, hidden } = fixture();
    const original = new THREE.MeshNormalMaterial(); scene.overrideMaterial = original;
    const render = () => withHardwareDepth(scene, () => {
      expect(hardware.visible).toBe(true); expect(glass.visible).toBe(true);
      expect(hidden.visible).toBe(false);
      overlays.forEach(o => expect(o.visible).toBe(false));
      scene.overrideMaterial = new THREE.MeshDepthMaterial();
      if (fails) throw new Error('depth failure');
      return 42;
    });
    if (fails) expect(render).toThrow('depth failure'); else expect(render()).toBe(42);
    overlays.forEach(o => expect(o.visible).toBe(true));
    expect(hidden.visible).toBe(false); expect(scene.overrideMaterial).toBe(original);
  });

  // Exercise the actual Three passes: checking a mocked superclass alone would
  // miss a pass re-enabling an overlay before its normal/depth render.
  for (const Pass of [HardwareGTAOPass, HardwareBokehPass]) it(`${Pass.name} sends only hardware to its override render`, () => {
    const { scene, hardware, overlays, hidden } = fixture();
    const camera = new THREE.PerspectiveCamera();
    const pass = Pass === HardwareGTAOPass ? new HardwareGTAOPass(scene, camera, 1, 1) : new HardwareBokehPass(scene, camera, {});
    let depthRenders = 0;
    const renderer = {
      autoClear: true,
      getClearColor: (color: THREE.Color) => color.set(0), getClearAlpha: () => 1,
      setClearColor() {}, setClearAlpha() {}, setRenderTarget() {}, clear() {},
      render(target: THREE.Scene) {
        if (target !== scene) return;
        depthRenders++;
        expect(scene.overrideMaterial).toBeTruthy(); expect(hardware.visible).toBe(true);
        overlays.forEach(o => expect(o.visible).toBe(false)); expect(hidden.visible).toBe(false);
      },
    };
    pass.render(renderer as any, { texture: new THREE.Texture() } as any, { texture: new THREE.Texture() } as any);
    expect(depthRenders).toBe(1);
    overlays.forEach(o => expect(o.visible).toBe(true)); expect(hidden.visible).toBe(false);
    expect(scene.overrideMaterial).toBeNull(); pass.dispose();
  });
});
