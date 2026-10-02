import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
// @ts-expect-error Vitest supplies Node built-ins; app tsconfig intentionally excludes Node types.
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { cameraPresetFor } from '../app/camera-presets.js';

function canvasDocument() {
  return { createElement(tag: string) {
    if (tag !== 'canvas') throw new Error(`Unexpected DOM dependency ${tag}`);
    const noop = () => undefined;
    const context = new Proxy({
      createImageData: (w:number,h:number) => ({data:new Uint8ClampedArray(w*h*4)}),
      measureText: (text:string) => ({width:text.length*24}),
      createLinearGradient: () => ({addColorStop:noop}), createRadialGradient: () => ({addColorStop:noop}),
    } as Record<string,unknown>, {get:(target,key:string)=>key in target ? target[key] : noop});
    return {width:1,height:1,getContext:()=>context};
  }};
}
let native: any[], wrappers: any[], assets: Map<string,any>;
const builds:any[]=[];
beforeAll(async()=>{
  vi.stubGlobal('document',canvasDocument()); assets=new Map();
  for (const name of ['cpo','coherent','copper']) {
    const b=readFileSync(new URL(`../../public/models/${name}-hardware.glb`,import.meta.url));
    assets.set(name,await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),''));
  }
  vi.spyOn(GLTFLoader.prototype,'loadAsync').mockImplementation(async url=>{
    const name=['cpo','coherent','copper'].find(n=>url.includes(`${n}-hardware`));
    if(!name) throw new Error(`Unexpected asset ${url}`);
    return assets.get(name);
  });
  native=await Promise.all([import('./side-cpo.js'),import('./side-coherent.js'),import('./side-copper.js')]);
  const cpo=await import('./side-cpo-blender.js'),links=await import('./side-links-blender.js');
  await Promise.all([cpo.preload(),links.preloadLinks()]);
  wrappers=[cpo,links.coherentBuilder,links.copperBuilder];
});

describe('coherent packaging qualifications remain visible in the interactive scene',()=>{
  it('coherent overview sightlines reach both optical packages without a distant housing obstruction',()=>{
    const b=build(1),asset=b.scene.children.find((o:THREE.Object3D)=>o.name.startsWith('Blender'));
    b.scene.updateMatrixWorld(true);
    const start=new THREE.Vector3(...b.camera.pos),ray=new THREE.Raycaster();
    for(const id of ['driver','cdm','icr','tia']) {
      const end=new THREE.Vector3(...b.dataHotspots[id].pos),direction=end.clone().sub(start),length=direction.length();
      ray.set(start,direction.normalize());
      const blockers=ray.intersectObject(asset,true).filter(hit=>hit.object.visible && hit.distance<length-.45 &&
        !((hit.object as THREE.Mesh).material as THREE.MeshStandardMaterial).transparent);
      expect(blockers.map(hit=>({name:hit.object.name,point:hit.point.toArray()})),id).toEqual([]);
    }
  });
  it('laser pigtail, snout and boot clear the driver and TIA packages by at least 1 mm',()=>{
    const b=build(1),asset=b.scene.children.find((o:THREE.Object3D)=>o.name.startsWith('Blender'));
    asset.updateMatrixWorld(true);
    const islands=['driver','tia'].map(id=>new THREE.Box3().setFromObject(asset.getObjectByName(`coherent-hardware_${id}_ceramic`)).expandByVector(new THREE.Vector3(.1,0,.1)));
    const hitsXZ=(p:THREE.Vector3)=>islands.some(box=>p.x>=box.min.x&&p.x<=box.max.x&&p.z>=box.min.z&&p.z<=box.max.z);
    // Boot and snout surfaces (x < 4 cm keeps the LC strain reliefs out).
    const pigtail:THREE.Vector3[]=[];
    for(const m of meshes(asset)) {
      const names=(Array.isArray(m.material)?m.material:[m.material]).map(x=>x.name).join();
      if(!/Molded black cable boot|Kovar fiber feedthrough/.test(names)) continue;
      const pos=m.geometry.attributes.position;
      for(let j=0;j<pos.count;j++){const p=new THREE.Vector3().fromBufferAttribute(pos,j).applyMatrix4(m.matrixWorld);if(p.x<4)pigtail.push(p);}
    }
    expect(pigtail.length).toBeGreaterThan(0);
    expect(pigtail.filter(hitsXZ)).toEqual([]);
    // The fiber from the boot to the tap, as a 0.12 mm-radius tube.
    const trunk=b.scene.userData.coherentRouting.laserTrunk.map((p:number[])=>new THREE.Vector3(...p));
    for(let i=1;i<trunk.length;i++) for(let t=0;t<=1;t+=.05) {
      const p=trunk[i-1].clone().lerp(trunk[i],t);
      for(const dz of [-.012,.012]) expect(hitsXZ(p.clone().setZ(p.z+dz)),`trunk ${i}`).toBe(false);
    }
  });
  it('keeps analog IC mounting islands separate from optics and optical paths outside electronics',()=>{
    const b=build(1),asset=b.scene.children.find((o:THREE.Object3D)=>o.name.startsWith('Blender'));
    asset.updateMatrixWorld(true);
    const bounds=(id:string)=>new THREE.Box3().setFromObject(asset.getObjectByName(`coherent-hardware_${id}_ceramic`));
    const driver=bounds('driver'),modulator=bounds('cdm'),receiver=bounds('icr'),tia=bounds('tia');
    expect(driver.max.x).toBeLessThan(modulator.min.x-.15);
    expect(tia.max.x).toBeLessThan(receiver.min.x-.15);
    for(const box of [driver,modulator,receiver,tia]) {
      expect(Math.max(Math.abs(box.min.z),Math.abs(box.max.z))).toBeLessThan(1.009);
    }
    const insideXZ=(box:THREE.Box3,p:THREE.Vector3)=>p.x>=box.min.x&&p.x<=box.max.x&&p.z>=box.min.z&&p.z<=box.max.z;
    for(const f of b.dataFlows.filter((f:any)=>['cw','tx','rx'].includes(f.cls))) {
      const points=f.path.getPoints(200);
      expect(points.some((p:THREE.Vector3)=>insideXZ(driver,p)||insideXZ(tia,p))).toBe(false);
    }
    const routes=b.scene.userData.coherentRouting;
    expect(routes.discretePackages).toBe(true);
    const first=(points:number[][],box:THREE.Box3)=>points.findIndex(p=>insideXZ(box,new THREE.Vector3(...p)));
    for(const p of routes.lineTx) {expect(first(p,driver)).toBeGreaterThan(-1);expect(first(p,modulator)).toBeGreaterThan(first(p,driver));}
    for(const p of routes.lineRx) {expect(first(p,receiver)).toBe(0);expect(first(p,tia)).toBeGreaterThan(0);}
    for(const p of routes.hostTx) expect(p.at(-1)[0]).toBeCloseTo(-2.875);
    for(const p of routes.hostRx) expect(p[0][0]).toBeCloseTo(-2.875);
    for(const p of routes.lineTx) expect(p[0][0]).toBeCloseTo(-1.725);
    for(const p of routes.lineRx) expect(p.at(-1)[0]).toBeCloseTo(-1.725);

  });
  it('keeps DSP-to-driver and TIA-to-DSP routes short and direct, with the laser off the RF path (OIF packaging order)',()=>{
    const b=build(1),asset=b.scene.children.find((o:THREE.Object3D)=>o.name.startsWith('Blender'));
    asset.updateMatrixWorld(true);
    const laser=new THREE.Box3();for(const m of meshes(asset).filter(m=>m.name.includes('_itla_')))laser.union(new THREE.Box3().setFromObject(m));
    const bounds=(id:string)=>new THREE.Box3().setFromObject(asset.getObjectByName(`coherent-hardware_${id}_ceramic`));
    const driver=bounds('driver'),tia=bounds('tia'),modulator=bounds('cdm'),receiver=bounds('icr');
    // Order along the module: DSP, then the analog chips, then the optics, then the laser.
    expect(laser.min.x).toBeGreaterThan(Math.max(modulator.max.x,receiver.max.x));
    const routes=b.scene.userData.coherentRouting;
    expect(routes.rfEndFacesDsp).toBe(true);
    const length=(pts:number[][])=>pts.slice(1).reduce((n,p,i)=>n+Math.hypot(p[0]-pts[i][0],p[2]-pts[i][2]),0);
    for(const p of routes.lineTx) {
      const k=p.findIndex((q:number[])=>q[0]>=driver.min.x-.1);
      expect(length(p.slice(0,k+1))).toBeLessThan(.75);   // die edge to the driver's input pads, under 7.5 mm
      expect(Math.max(...p.map((q:number[])=>q[0]))).toBeLessThan(laser.min.x);
    }
    for(const p of routes.lineRx) {
      const k=p.findIndex((q:number[])=>q[0]<tia.min.x);
      expect(length(p.slice(k-1))).toBeLessThan(.75);
      expect(Math.max(...p.map((q:number[])=>q[0]))).toBeLessThan(laser.min.x);
    }
    // Every optical port of both optics is on their fiber end, facing away from the DSP.
    for(const path of [routes.carrierPath,routes.loPath]) expect(path.at(-1)[0]).toBeCloseTo(modulator.max.x-.04,1);
  });
  it('keeps DSP electrical routes outside the tunable laser and host routes clear of the power components',()=>{
    const b=build(1),asset=b.scene.children.find((o:THREE.Object3D)=>o.name.startsWith('Blender'));
    asset.updateMatrixWorld(true);
    const laser=new THREE.Box3();for(const m of meshes(asset).filter(m=>m.name.includes('_itla_')))laser.union(new THREE.Box3().setFromObject(m));
    for(const f of b.dataFlows.filter((f:any)=>f.cls==='eth')) {
      const exclusion=laser.clone().expandByScalar(f.size);
      expect(f.path.getPoints(300).some((p:THREE.Vector3)=>exclusion.containsPoint(p))).toBe(false);
    }
    const routes=b.scene.userData.coherentRouting;
    for(const route of [...routes.hostTx,...routes.hostRx]) for(const p of route) {
      if(p[0]<-3.2&&p[0]>-4.4)expect(Math.abs(p[2])).toBeGreaterThan(.4);
    }
    expect(routes.hostTx).toHaveLength(4);expect(routes.hostRx).toHaveLength(4);
    expect(routes.hostPathGroupsAreNotLaneCounts).toBe(true);
  });
  it('keeps the thermal pad in x-ray with the cover so DSP signal banks remain visible',()=>{
    const opts=options(),b=wrappers[1].build(opts);
    const pad=meshes(b.scene).find(m=>m.userData.sourceMesh==='Coherent DSP thermal pad');
    expect(pad).toBeDefined();
    b.inspection.setView('driver');b.update(0,0);expect(pad!.visible).toBe(true);
    for(const material of Array.isArray(pad!.material)?pad!.material:[pad!.material]) { expect(material.opacity).toBeLessThan(.25);expect(material.depthWrite).toBe(false); }
    opts.state.mode='heat';b.update(1,0);expect(pad!.visible).toBe(true);
  });
  it('shows qualitative heat from both active optical packages as well as the DSP and laser',()=>{
    const b=build(1);
    for(const id of ['driver','cdm','icr','tia']) {
      // The part view's focus is the package; a die's pin may sit off-center, on an empty corner of its face drawing.
      const p=b.dataHotspots[id].view.focus;
      expect(b.heatFlows.some((f:any)=>{
        const a=f.path.getPoint(0),z=f.path.getPoint(1);
        return Math.abs(a.x-p[0])<.3 && Math.abs(a.z-p[2])<.1 && z.y>a.y;
      })).toBe(true);
    }
    expect(b.inspection.scope).toContain('pulse counts do not represent power ratios');
  });
  it('states a representative option in the scope and both optical package labels',()=>{
    const b=build(1),captions:string[]=[];
    b.scene.traverse((o:THREE.Object3D)=>{if(o.userData.caption?.text)captions.push(o.userData.caption.text);});
    expect(b.inspection.scope).toContain('Discrete board-level design');
    expect(b.inspection.scope).toContain('No shared package or substrate');
    expect(b.inspection.scope).toContain('Exact die placement varies');
    expect(b.inspection.scope).toContain('remaining layout is representative');
    expect(captions).toContain('TX · separate driver IC → IQ modulator');
    expect(captions).toContain('RX · photodiodes → separate TIA IC');
    const laserPaths=b.dataFlows.filter((f:any)=>f.cls==='cw');
    expect(laserPaths).toHaveLength(3);
    const routing=b.scene.userData.coherentRouting;
    expect(routing.carrierPath[0]).toEqual(routing.laserTrunk.at(-1));
    expect(routing.loPath[0]).toEqual(routing.laserTrunk.at(-1));
    expect(routing.carrierPath.at(-1)[2]).toBeLessThan(0);
    expect(routing.loPath.at(-1)[2]).toBeGreaterThan(0);
    expect(routing.carrierPath.slice(1).every((p:number[])=>p[2]<0)).toBe(true);
    expect(routing.loPath.slice(1).every((p:number[])=>p[2]>0)).toBe(true);

  });
});
afterAll(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
const options=()=>({quality:{shadows:false},state:{mode:'data'}});
function build(i:number){const b=wrappers[i].build(options());builds.push(b);return b;}
function flowPaths(b:any,key:string){return b[key].map((f:any)=>({cls:f.cls,points:f.path.curves.map((c:any)=>[c.getPoint(0).toArray(),c.getPoint(1).toArray()])}));}
function meshes(root:THREE.Object3D){const m:THREE.Mesh[]=[];root.traverse(o=>{if(o instanceof THREE.Mesh)m.push(o);});return m;}

describe('Blender mechanical layers preserve native technical diagrams',()=>{
  it('CPO exposes buried electrical routes only through a qualified interposer x-ray',()=>{
    const opts=options(),b=wrappers[0].build(opts);
    const interposer=b.scene.getObjectByName('CPO_PACKAGE__Silicon_interposer') as THREE.Mesh;
    expect(interposer).toBeDefined();
    b.scene.updateMatrixWorld(true);
    const path=b.dataFlows.find((f:any)=>f.cls==='eth').path;
    const p=path.curves[0].getPoint(.6), ray=new THREE.Raycaster(new THREE.Vector3(p.x,4,p.z),new THREE.Vector3(0,-1,0));
    const hits=ray.intersectObject(interposer);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].point.y).toBeGreaterThan(p.y);
    const m=interposer.material as THREE.MeshStandardMaterial;
    for(const mode of ['data','power','heat','data']) {
      opts.state.mode=mode;b.update(1,1/60);
      expect(m.transparent).toBe(mode!=='heat');expect(m.depthWrite).toBe(mode==='heat');
      expect(m.opacity).toBe(mode==='heat'?1:.1);expect(m.depthTest).toBe(true);
    }
    const pic=meshes(b.scene).find(o=>o!==interposer && !Array.isArray(o.material) && o.material.name==='Photonic die passivation');
    expect(pic).toBeDefined();expect((pic!.material as THREE.Material).opacity).toBe(1);
    expect(b.inspection.scope).toContain('not transparent silicon');
  });
  for (const [i,name] of ['cpo','coherent','copper'].entries()) {
    it(`${name}: keeps every source/destination, lane path, and clickable hotspot`,()=>{
      const a=native[i].build(options()),b=build(i);
      for(const k of ['flows','dataFlows','heatFlows'])expect(flowPaths(b,k)).toEqual(flowPaths(a,k));
      for(const k of ['hotspots','dataHotspots','heatHotspots'])expect(b[k]).toEqual(a[k]);
      expect(()=>b.update(20,1/60)).not.toThrow();
      expect(meshes(b.scene).every(m=>Array.from(m.geometry.attributes.position.array).every(Number.isFinite))).toBe(true);
    });
    it(`${name}: each rebuild owns its asset geometry and materials`,()=>{
      const a=build(i),b=build(i);
      const assetA=a.scene.children.find((o:THREE.Object3D)=>o.name.startsWith('Blender'));
      const assetB=b.scene.children.find((o:THREE.Object3D)=>o.name.startsWith('Blender'));
      expect(assetA).toBeDefined();expect(assetB).toBeDefined();
      const aa=meshes(assetA),bb=meshes(assetB);expect(aa.length).toBeGreaterThan(0);expect(aa.length).toBe(bb.length);
      // Compare identity directly: serializing complete BufferGeometry objects
      // for assertion diagnostics can dominate this ownership check.
      aa.forEach((m,j)=>{expect(m.geometry === bb[j].geometry).toBe(false);expect(m.material === bb[j].material).toBe(false);});
    });
  }
  it('coherent mechanics stay within the 107.8 × 22.58 mm OSFP footprint',()=>{
    const b=build(1),asset=b.scene.children.find((o:THREE.Object3D)=>o.name.startsWith('Blender'));
    const shell=meshes(asset).find(m=>m.name==='coherent-hardware_base_shell');
    expect(shell).toBeDefined();
    asset.updateMatrixWorld(true);
    const size=new THREE.Box3().setFromObject(shell!).getSize(new THREE.Vector3());
    expect(size.x).toBeCloseTo(10.78,4);expect(size.z).toBeCloseTo(2.258,4);
  });
  it('three copper heads including lifted covers fit compact and tall-phone overview frames',()=>{
    const b=build(2),asset=b.scene.children.find((o:THREE.Object3D)=>o.name.startsWith('Blender'));
    asset.updateMatrixWorld(true);
    for(const [width,height] of [[947,850],[910,1000],[390,445],[390,430],[390,220],[390,140]]) {
      const aspect=width/height,preset=cameraPresetFor(b.camera,width,height),camera=new THREE.PerspectiveCamera(aspect<.9?48:35,aspect,.05,300);
      camera.position.fromArray(preset.pos);camera.lookAt(new THREE.Vector3().fromArray(preset.target));camera.updateMatrixWorld();
      let edge=0;
      for(const mesh of meshes(asset)) {
        const positions=mesh.geometry.attributes.position,p=new THREE.Vector3();
        for(let i=0;i<positions.count;i++) {
          p.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld).project(camera);
          edge=Math.max(edge,Math.abs(p.x),Math.abs(p.y));
        }
      }
      expect(edge,`${width}×${height}: all physical geometry, including hidden covers`).toBeLessThan(.96);
    }
  });
  for (const i of [1,2]) it(`cover inspection ${i}: all layers and detail views retain the complete housing`,()=>{
    const opts=options(),b=wrappers[i].build(opts),covers=meshes(b.scene).filter(m=>m.name.includes('_cover_'));
    expect(covers.length).toBeGreaterThan(0);
    expect(covers.every(m=>m.visible)).toBe(true);
    b.inspection.setCovers(true);b.update(1,1/60);
    expect(covers.every(m=>m.visible)).toBe(true);
    b.inspection.setCovers(false);opts.state.mode='heat';b.update(2,1/60);
    expect(covers.every(m=>m.visible)).toBe(true);
    expect(b.inspection.covers).toBe(true);expect(b.inspection.coversForced).toBe(true);
    opts.state.mode='data';b.update(3,1/60);
    expect(covers.every(m=>m.visible)).toBe(true);
    expect(b.inspection.covers).toBe(true);expect(b.inspection.coversForced).toBe(true);
  });
  it('CPO authors eighteen engine positions in six groups matching the native layout',async()=>{
    const {engineLayout}=await import('./side-geometry.js');let metadata:any;
    assets.get('cpo').scene.traverse((o:THREE.Object3D)=>{if(o.userData.ifx)metadata=JSON.parse(o.userData.ifx);});
    expect(metadata.engineCount).toBe(18);expect(metadata.subassemblyCount).toBe(6);
    expect(metadata.enginesCm).toEqual(engineLayout().map(e=>[e.x,1.65,e.z]));
  });
  it('CPO inspection removes the whole cooling assembly and restores it for heat',()=>{
    const opts=options(),b=wrappers[0].build(opts),plate=b.scene.getObjectByName('CPO_COLDPLATE');
    expect(plate).toBeDefined(); expect(plate.visible).toBe(false);
    expect(b.coolingHardware.visible).toBe(false);
    b.inspection.setCovers(true); b.update(1,1/60);
    expect(plate.visible).toBe(true); expect(b.coolingHardware.visible).toBe(true);
    b.inspection.setCovers(false); opts.state.mode='heat'; b.update(2,1/60);
    expect(plate.visible).toBe(true); expect(b.coolingHardware.visible).toBe(true);
    expect(b.inspection.covers).toBe(true);expect(b.inspection.coversForced).toBe(true);
    const pipes=meshes(plate).flatMap(m=>Array.isArray(m.material)?m.material:[m.material])
      .filter(m=>/^(Supply|Return) coolant pipe$/.test(m.name));
    expect(pipes.length).toBe(2);
    for(const material of pipes) {
      expect(material.transparent).toBe(true);expect(material.opacity).toBeLessThan(.25);
      expect(material.depthWrite).toBe(false);expect(material.depthTest).toBe(true);
    }
    opts.state.mode='data'; b.update(3,1/60);
    expect(plate.visible).toBe(false); expect(b.coolingHardware.visible).toBe(false);
    expect(b.inspection.covers).toBe(false);expect(b.inspection.coversForced).toBe(false);
    for(const material of pipes) { expect(material.transparent).toBe(false);expect(material.opacity).toBe(1);expect(material.depthWrite).toBe(true); }
  });
  it('copper heat starts on active packages, moves upward, and does not imply passive signal electronics',async()=>{
    const {copperChip}=await import('./side-geometry.js'),b=build(2);
    expect(Object.keys(b.heatHotspots)).toEqual(['acc','aec']);
    expect(b.heatFlows.length).toBeGreaterThan(0);
    const chipBounds=[copperChip('acc',0),copperChip('aec',4.6)];
    for(const f of b.heatFlows) {
      const start=f.path.getPoint(0),end=f.path.getPoint(1);
      expect(chipBounds.some(c=>c&&Math.abs(start.x-c.x)<c.w/2&&Math.abs(start.z+.2)<c.d/2)).toBe(true);
      expect(end.y).toBeGreaterThan(2.5);expect(end.y).toBeGreaterThan(start.y);
      const before=Array.from(f.mesh.instanceMatrix.array);f.update(1);f.update(1.5);
      expect(Array.from(f.mesh.instanceMatrix.array)).not.toEqual(before);
      expect(f.mesh.material.depthTest).toBe(true);
    }
    expect(b.inspection.scope).toContain('does not encode watts');
  });
  it('CPO schematic ASIC remains plausible in size and its power/heat anchors stay on silicon',async()=>{
    const {ASIC_HALF}=await import('./side-geometry.js'),b=build(0);
    // A representative monolithic square must fit within the conventional
    // 26 x 33 mm exposure field; this does not claim NVIDIA die dimensions.
    expect(ASIC_HALF*20).toBeLessThanOrEqual(26);
    for(const f of b.flows.filter((f:any)=>f.cls==='core')) {
      const end=f.path.getPoint(1);expect(Math.abs(end.x)).toBeLessThan(ASIC_HALF);expect(Math.abs(end.z)).toBeLessThan(ASIC_HALF);
    }
    const dieHeat=b.heatFlows.filter((f:any)=>Math.abs(f.path.getPoint(0).y-1.68)<1e-5);
    expect(dieHeat.length).toBe(14);
    for(const f of dieHeat) {
      const start=f.path.getPoint(0);expect(Math.abs(start.x)).toBeLessThan(ASIC_HALF);expect(Math.abs(start.z)).toBeLessThan(ASIC_HALF);
    }
  });
});

describe('shared CPO interposer correction',()=>{
 it('spans the ASIC and all 18 engines, with elevated carriers above its top',()=>{
  const asset=assets.get('cpo').scene;asset.updateMatrixWorld(true);
  const interposer=asset.getObjectByName('CPO_PACKAGE__Silicon_interposer');
  let target:THREE.Object3D|undefined;
  asset.traverse((o:THREE.Object3D)=>{if(o.name.replaceAll('_',' ').includes('CPO PACKAGE  Silicon interposer'))target=o;});
  const bounds=new THREE.Box3().setFromObject(interposer||target!);
  const size=bounds.getSize(new THREE.Vector3());
  expect(size.x*100).toBeCloseTo(9,4);expect(size.z*100).toBeCloseTo(9,4);
  expect(bounds.max.y*100).toBeCloseTo(1.5,4);
  let meta:any;asset.traverse((o:THREE.Object3D)=>{if(o.userData.ifx)meta=JSON.parse(o.userData.ifx);});
  expect(meta.interposerCm).toEqual([9,.1,9]);
  for(const [x,y,z] of meta.enginesCm){expect(Math.abs(x)).toBeLessThan(4.5);expect(Math.abs(z)).toBeLessThan(4.5);expect(y).toBe(1.65);}
 });
});

describe('complete link housings',()=>{
 it('coherent optical-package power feeds clear the laser case with their full pulse radius',()=>{
  const b=build(1),asset=b.scene.children.find((o:THREE.Object3D)=>o.name.startsWith('Blender'));asset.updateMatrixWorld(true);
  const laser=new THREE.Box3();for(const m of meshes(asset).filter(m=>m.name.includes('_itla_')))laser.union(new THREE.Box3().setFromObject(m));
  // Every DC feed except the laser's own (which ends inside its case).
  const feeds=b.flows.filter((f:any)=>f.cls==='core'&&!laser.containsPoint(f.path.getPoint(1)));
  expect(feeds).toHaveLength(5);
  for(const f of feeds) {
   const padded=laser.clone().expandByScalar(f.size);
   for(let n=0;n<=200;n++)expect(padded.containsPoint(f.path.getPoint(n/200))).toBe(false);
  }
 });
 for(const i of [1,2]) {
  it(`housing ${i} opens complete, preserves base opacity, and clears internal detail`,()=>{
   const opts=options(),b=wrappers[i].build(opts),all=meshes(b.scene),covers=all.filter(m=>m.name.includes('_cover_'));
   expect(covers.every(m=>m.visible)).toBe(true);
   expect(all.some(m=>m.name.includes('_pull_'))).toBe(true);
   const coverPositions=covers.map(m=>m.position.clone());
   b.inspection.setView('receive');b.update(1,1/60);
   expect(covers.every(m=>m.visible)).toBe(true);
   b.inspection.setView('diagram');b.update(2,1/60);
   expect(covers.every(m=>m.visible)).toBe(true);
   opts.state.mode='heat';b.update(3,1/60);
   expect(covers.every((m,j)=>m.position.equals(coverPositions[j]))).toBe(true);
   for(const m of covers) for(const material of Array.isArray(m.material)?m.material:[m.material]) {
    expect(material.opacity).toBe(.18);expect(material.depthWrite).toBe(false);expect(material.depthTest).toBe(true);
   }
   for(const m of all.filter(m=>m.name.includes('_base_'))) for(const material of Array.isArray(m.material)?m.material:[m.material]) expect(material.opacity).toBe(1);
   expect(b.inspection.scope).toContain('x-ray thermal target');
  });
  it(`housing ${i} fits all default overview aspects in data and heat`,()=>{
   const opts=options(),b=wrappers[i].build(opts),asset=b.scene.children.find((o:THREE.Object3D)=>o.name.startsWith('Blender'));
   for(const mode of ['data','heat']) for(const [width,height] of [[1440,800],[947,850],[910,1000],[390,445],[390,430],[390,220],[390,140]]) {
    opts.state.mode=mode;b.update(1,1/60);asset.updateMatrixWorld(true);
    const aspect=width/height,preset=cameraPresetFor(b.camera,width,height),camera=new THREE.PerspectiveCamera(aspect<.9?48:35,aspect,.05,300);
    camera.position.fromArray(preset.pos);camera.lookAt(new THREE.Vector3().fromArray(preset.target));camera.updateMatrixWorld();
    let edge=0,minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for(const m of meshes(asset)) {
     const positions=m.geometry.attributes.position,p=new THREE.Vector3();
     for(let j=0;j<positions.count;j++) {p.fromBufferAttribute(positions,j).applyMatrix4(m.matrixWorld).project(camera);edge=Math.max(edge,Math.abs(p.x),Math.abs(p.y));minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);}
    }
    expect(edge,`${mode} ${width}×${height}`).toBeLessThan(.96);
    // A phone view may lay the module across the canvas or diagonally up it; either way it must fill one axis.
    if(width===390 && height===445)expect(Math.max(maxX-minX,maxY-minY)/2,`${mode}: useful mobile canvas span`).toBeGreaterThan(.75);
   }
  });
 }
});

describe('photo-grounded copper inspection',()=>{
 it('animates all four transmit and receive pairs per head in the correct directions',()=>{
  const b=build(2);expect(b.dataFlows).toHaveLength(24);
  for(const hx of [-4.6,0,4.6]) {
   const paths=b.dataFlows.filter((f:any)=>Math.abs(f.path.getPoint(.5).x-hx)<1.1);
   expect(paths).toHaveLength(8);
   expect(paths.filter((f:any)=>f.path.getPoint(0).z>f.path.getPoint(1).z)).toHaveLength(4);
   expect(paths.filter((f:any)=>f.path.getPoint(0).z<f.path.getPoint(1).z)).toHaveLength(4);
  }
  expect(b.flowRibbons).toBeDefined();
 });
 it('does not bury the cable continuation beneath opaque jacket material',()=>{
  const b=build(2),asset=b.scene.children.find((o:THREE.Object3D)=>o.name.startsWith('Blender'));
  b.scene.updateMatrixWorld(true);
  const jacket=meshes(asset).filter(m=>m.name.includes('_base_boot'));
  expect(jacket.length).toBeGreaterThan(0);
  for(const hx of [-4.6,0,4.6]) for(const z of [-4.5,-5,-5.8]) {
   const ray=new THREE.Raycaster(new THREE.Vector3(hx,3,z),new THREE.Vector3(0,-1,0));
   const hits=ray.intersectObjects(jacket);
   expect(hits.length).toBeGreaterThan(0);
   expect(hits[0].point.y).toBeLessThan(.90);
  }
  expect(b.inspection.scope).toContain('upper half of the cable jacket');
 });
});

describe('CPO complete motion coverage and isolated power inspection',()=>{
 it('keeps physical glass and animated TX, RX and CW on the same eighteen independent routes',async()=>{
  const {engineLayout,cpoFiberRoutes}=await import('./side-geometry.js'),b=build(0);
  let meta:any;assets.get('cpo').scene.traverse((o:THREE.Object3D)=>{if(o.userData.ifx)meta=JSON.parse(o.userData.ifx);});
  const routes=engineLayout().map(cpoFiberRoutes);
  expect(meta.fiberRoutesCm).toEqual(routes);
  for(const bundle of routes) for(const [kind,points] of [['tx',bundle.tx[3]],['rx',[...bundle.rx[3]].reverse()],['cw',bundle.cw[0]]] as const) {
   const expectedStart=new THREE.Vector3(...points[0]),expectedEnd=new THREE.Vector3(...points.at(-1)!);
   const matches=b.dataFlows.filter((f:any)=>f.cls===kind && f.path.getPoint(0).distanceTo(expectedStart)<1e-6 && f.path.getPoint(1).distanceTo(expectedEnd)<1e-6);
   expect(matches).toHaveLength(1);
  }
 });
 it('reveals only selected package stack layers for power and restores them in other modes',()=>{
  const opts=options(),b=wrappers[0].build(opts);
  const layers=['CPO_BOARD__Midnight_laminate','CPO_PACKAGE__Package_ceramic','CPO_DIES__Switch_ASIC_silicon'].map(name=>b.scene.getObjectByName(name));
  for(const mode of ['power','data','power','heat']) {
   opts.state.mode=mode;b.update(1,1/60);
   for(const layer of layers) {
    expect(layer).toBeDefined();expect(layer.material.transparent).toBe(mode==='power');
    expect(layer.material.opacity).toBe(mode==='power'?(layer.name.includes('ASIC')?.58:.16):1);
    expect(layer.material.depthWrite).toBe(mode!=='power');expect(layer.material.depthTest).toBe(true);
   }
   const pics=meshes(b.scene).filter(m=>m.name.includes('Photonic_die_passivation')&&!m.name.includes('CPO_PACKAGE'));
   expect(pics.length).toBeGreaterThan(0);
   for(const pic of pics)expect((pic.material as THREE.MeshStandardMaterial).opacity).toBe(1);
  }
  expect(b.inspection.scope).toContain('supply paths from below');
 });
});
