import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { HardwareGTAOPass } from './hardware-ao.js';

afterEach(()=>vi.restoreAllMocks());
describe('hardware-only ambient occlusion',()=>{
  for(const fails of [false,true]) it(`excludes teaching quads and restores visibility${fails?' on failure':''}`,()=>{
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();
    const ribbon=new LineSegments2(),caption=new THREE.Sprite();
    const hardware=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());
    const cover=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial({transparent:true,opacity:.12,depthWrite:false}));
    const hidden=new THREE.Mesh();hidden.visible=false;
    const overlays=new THREE.Group();overlays.userData.runtimeOverlay=true;
    scene.add(ribbon,caption,hardware,cover,hidden,overlays);
    const pass=new HardwareGTAOPass(scene,camera,1,1);
    vi.spyOn(GTAOPass.prototype,'render').mockImplementation(()=>{
      expect(ribbon.visible).toBe(false);expect(caption.visible).toBe(false);
      expect(cover.visible).toBe(false);expect(overlays.visible).toBe(false);
      expect(hardware.visible).toBe(true);expect(hidden.visible).toBe(false);
      if(fails)throw new Error('test render failure');
    });
    if(fails)expect(()=>pass.render()).toThrow('test render failure');else pass.render();
    for(const o of [ribbon,caption,hardware,cover,overlays])expect(o.visible).toBe(true);
    expect(hidden.visible).toBe(false);
    pass.dispose();
  });
});
