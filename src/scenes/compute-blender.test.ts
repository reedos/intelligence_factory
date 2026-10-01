import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
// @ts-expect-error test-only Node built-in
import { readFileSync } from 'node:fs';
// @ts-expect-error test-only Node built-in
import { inflateSync } from 'node:zlib';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { compute, DEFAULT_SCENARIO } from '../model/engine';
import { fitComponent } from '../app/housing-frame.js';

const kinds=['rack','tray','chip'], ids=['gb200','gb300','rubin','h100'];
const assets=new Map<string,any>(); let native:any[],wrappers:any[];
function canvasDocument(){return {createElement(tag:string){
  if(tag!=='canvas')throw new Error(`Unexpected DOM ${tag}`);
  const noop=()=>undefined;
  const context=new Proxy({measureText:(text:string)=>({width:text.length*24}),createImageData:(w:number,h:number)=>({data:new Uint8ClampedArray(w*h*4)}),createLinearGradient:()=>({addColorStop:noop}),createRadialGradient:()=>({addColorStop:noop})} as Record<string,unknown>,{get:(t,k:string)=>k in t?t[k]:noop});
  return {width:1,height:1,getContext:()=>context};
}};}
beforeAll(async()=>{
  vi.stubGlobal('document',canvasDocument());vi.stubGlobal('self',{URL});
  // Decode is irrelevant to geometry contracts; actual embedded image bytes are
  // still fetched by GLTFLoader. GPU visual verification happens in the browser.
  vi.stubGlobal('createImageBitmap',async()=>({width:1,height:1,close(){}}));
  for(const name of ['compute-rotor','compute-solder',...kinds.flatMap(k=>ids.map(id=>`compute-${k}-${id}`))]){
    const b=readFileSync(new URL(`../../public/models/${name}.glb`,import.meta.url));
    assets.set(name,await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),''));
  }
  vi.spyOn(GLTFLoader.prototype,'loadAsync').mockImplementation(async url=>{
    const key=url.split('/').pop()!.split('.glb')[0];if(!assets.has(key))throw new Error(`Unexpected asset ${url}`);return assets.get(key);
  });
  native=await Promise.all([import('./rack.js'),import('./tray.js'),import('./chip.js')]);
  const m=await import('./compute-blender.js');wrappers=[m.rackBuilder,m.trayBuilder,m.chipBuilder];
  for(const id of ids)for(const wrapper of wrappers)await wrapper.preload({model:compute({...DEFAULT_SCENARIO,accel:id as any})});
},60000);
afterAll(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
const options=(id:string)=>({quality:{shadows:false,reflections:false,mobile:false},state:{mode:'data'},model:compute({...DEFAULT_SCENARIO,accel:id as any})});
function meshes(root:THREE.Object3D){const out:any[]=[];root.traverse((o:any)=>{if(o.isMesh)out.push(o);});return out;}
function flowPaths(b:any,key:string){return(b[key]||[]).map((f:any)=>({cls:f.cls,points:f.path.curves.map((c:any)=>[c.getPoint(0).toArray(),c.getPoint(1).toArray()])}));}
describe('complete Blender compute hardware',()=>{
  it('NVL tray Ethernet routes clear fan cartridges and NIC heat sinks in every variant',()=>{
    const fans=Array.from({length:6},(_,i)=>new THREE.Box3(
      new THREE.Vector3(-1.71+i*.76-.19,.02,2.4),
      new THREE.Vector3(-1.71+i*.76+.19,.38,2.77)));
    const sinks=[.2,.7,1.2,1.7].map(x=>new THREE.Box3(
      new THREE.Vector3(x-.15,.25,3.05),new THREE.Vector3(x+.15,.46,3.55)));
    for(const id of ['gb200','gb300'])for(const mobile of [false,true]){
      const opts=options(id);opts.quality.mobile=mobile;
      const b=wrappers[1].build(opts),routes=b.dataFlows.filter((f:any)=>f.cls==='eth'&&f.count===10);
      expect(routes.length).toBe(4);
      for(const [i,f]of routes.entries()){
        // Renderer can enlarge a core to 1.6x; reserve that radius plus 1 mm
        // in this scene's 10 cm units. Sampling is finer than the clearance.
        const obstacles=[...fans,...sinks].map(box=>box.clone().expandByScalar(f.size*1.6+.01));
        for(const curve of f.path.curves)for(let t=0;t<=1;t+=.01){
          const point=curve.getPoint(t);
          expect(obstacles.some(box=>box.containsPoint(point))).toBe(false);
        }
        const end=f.path.getPoint(1);expect(end.toArray()).toEqual([[.2,.24,4.5],[.7,.24,4.5],[1.2,.24,4.5],[1.7,.24,4.5]][i]);
      }
      expect(b.heatFlows.filter((f:any)=>f.cls==='air').length).toBe(6);
    }
  });
  it('tray and pulled-rack boards carry the projected PCB surface in every generation',()=>{
    for(const id of ids)for(const [i,name] of [[1,'Tray solder mask'],[0,'Rack tray solder mask']] as const){
      const b=wrappers[i].build(options(id)),boards=meshes(b.scene).filter((o:any)=>o.material?.name===name);
      expect(boards.length,`${id} ${name}`).toBeGreaterThan(0);
      for(const o of boards){
        expect(o.material.map&&o.material.bumpMap&&o.material.roughnessMap).toBeTruthy();
        const uv=o.geometry.attributes.uv;expect(uv.count).toBe(o.geometry.attributes.position.count);
        expect(Array.from(uv.array as Float32Array).every(v=>v>-.01&&v<1.01)).toBe(true);
      }
    }
  },30000);
  it('rack opens toward the front while rear parts and coolant direction stay correct',()=>{
    for(const id of ids){
      const b=wrappers[0].build(options(id));expect(b.camera.pos[0]).toBeGreaterThan(0);expect(b.camera.pos[2]).toBeGreaterThan(0);
      if(id==='h100')continue;
      expect(b.hotspots.spine.view.pos[2]).toBeLessThan(0);
      const rails=b.dataFlows.filter((f:any)=>f.cls==='nvl'&&f.count===26);
      expect(rails.length).toBe(4);
      for(const f of rails)expect(f.path.getPoint(0).z).toBeLessThan(-.5);
      for(const cls of ['cool','warm']){
        const power=b.flows.find((f:any)=>f.cls===cls&&f.count===26),heat=b.heatFlows.find((f:any)=>f.cls===cls&&f.count===34);
        const dy=(f:any)=>Math.sign(f.path.getPoint(1).y-f.path.getPoint(0).y);
        expect(dy(power)).toBe(dy(heat));expect(dy(power)).toBe(cls==='cool'?1:-1);
      }
    }
  });
  it('actual rack GLB leaves the rear rail cores and rear inspection sightlines clear',()=>{
    const b=wrappers[0].build(options('gb200')),hardware=b.scene.children.find((o:any)=>o.name==='Blender complete rack hardware');
    hardware.updateMatrixWorld(true);
    // The overview now faces front; rear flow visibility is tested from the rear.
    const camera=new THREE.Vector3(3.1,2.3,-3.7),ray=new THREE.Raycaster();
    const rails=[...b.dataFlows.filter((f:any)=>f.cls==='nvl'&&f.count===26),
      ...b.flows.filter((f:any)=>f.cls==='dc'&&f.count===42),
      ...b.heatFlows.filter((f:any)=>['cool','warm'].includes(f.cls)&&f.count===34)];
    for(const f of rails)for(const y of [.4,.8,1.2]){
      const p=f.path.getPoint(.5);p.y=y;
      ray.set(p,new THREE.Vector3(0,0,1));
      const hit=ray.intersectObject(hardware,true)[0];expect(hit).toBeDefined();
      expect(hit.distance).toBeGreaterThan(f.size*1.6);
      const direction=p.clone().sub(camera),distance=direction.length();ray.set(camera,direction.normalize());
      const blocked=ray.intersectObject(hardware,true).some((h:any)=>h.distance<distance-.005);
      expect(blocked).toBe(false);
    }
  });
  it('chip core/heat origins stay on silicon and NVLink substrate legs stay below the metal frame',()=>{
    for(const id of ids){
      const b=wrappers[2].build(options(id)),twin=id!=='h100';
      const inside=(x:number)=>twin?Math.abs(x)>=.1&&Math.abs(x)<=2.66:Math.abs(x)<=1.3;
      for(const f of b.flows.filter((f:any)=>f.cls==='core'))expect(inside(f.path.getPoint(1).x)).toBe(true);
      for(const f of b.heatFlows.filter((f:any)=>f.cls==='hot'&&f.thermalOrigin!=='hbm'))expect(inside(f.path.getPoint(0).x)).toBe(true);
      const rails=b.dataFlows.filter((f:any)=>f.cls==='nvl');expect(rails.length).toBe(id==='rubin'?36:18);
      for(const f of rails){
        const end=f.path.getPoint(1);
        // Blender stiffener lower face is y=1.185. The moving core also
        // clears it at the renderer's maximum 1.6x size, not only its center.
        expect(end.y+f.size*1.6).toBeLessThan(1.185);
        expect(end.y).toBeCloseTo(1.09);
      }
    }
  });

  it('complete runtime rack retains visible, animated, depth-tested cores after opaque hardware',async()=>{
    const b=wrappers[0].build(options('gb200'));
    const {applyComputeArtDirection}=await import('./compute-art-direction.js');
    applyComputeArtDirection({built:b,level:3,quality:{mobile:false},matched:false});
    for(const f of b.flows)f.group.visible=false;for(const f of b.heatFlows)f.group.visible=false;
    for(const f of b.dataFlows){f.group.visible=true;f.setLevel(1,.5);f.setLevel(1,1);f.update(2,{position:new THREE.Vector3(...b.camera.pos),worldPerPixelAtUnit:.0008});}
    b.update(2,1/60);b.scene.updateMatrixWorld(true);
    const camera=new THREE.Vector3(3.1,2.3,-3.7),ray=new THREE.Raycaster(),m=new THREE.Matrix4(),pos=new THREE.Vector3();
    const solids:any[]=[];b.scene.traverse((o:any)=>{if(o.isMesh&&o.visible&&o.material?.depthWrite!==false)solids.push(o);});
    for(const f of b.dataFlows.filter((f:any)=>f.cls==='nvl'&&f.count>=26)){
      f.mesh.getMatrixAt(0,m);pos.setFromMatrixPosition(m).applyMatrix4(f.mesh.matrixWorld);
      const d=pos.clone().sub(camera),distance=d.length();ray.set(camera,d.normalize());
      const hits=ray.intersectObjects(solids,false).filter(h=>h.distance<distance-.005).map(h=>({name:h.object.name,type:h.object.type,point:h.point.toArray(),material:(h.object as any).material.name}));
      expect(f.mesh.visible && f.group.visible).toBe(true);
      expect(f.mesh.material.depthTest).toBe(true);
      // Overlay cores must render after opaque hardware. With depthWrite=false,
      // placing them in the opaque queue allows later hardware to erase them.
      expect(f.mesh.material.transparent).toBe(true);
      expect(f.mesh.material.depthWrite).toBe(false);
      expect(hits).toEqual([]);
      expect(Array.from(m.elements).every(Number.isFinite)).toBe(true);
      expect(pos.z).toBeCloseTo(-.522);
      const before=pos.clone();f.update(2.5);f.mesh.getMatrixAt(0,m);pos.setFromMatrixPosition(m);
      expect(pos.distanceTo(before)).toBeGreaterThan(.01);
      expect(f.group.parent===b.scene).toBe(true);
    }
  });
  it('token inspection shows bounded live text in power and data while other engineering views stay clear',()=>{
    const opts:any=options('rubin');opts.state.selected='tokens';const b=wrappers[2].build(opts);
    let now=performance.now();const clock=vi.spyOn(performance,'now').mockImplementation(()=>now);
    let sawReadout=false;const sequences=new Set<number>();
    const visible=()=>{const chunks:any[]=[];b.scene.traverse((o:any)=>{if(o.isSprite&&o.userData.tokenChunk&&o.visible)chunks.push(o);});return chunks;};
    // The readout rows are the pinned, fully opaque chunks; answer chunks still in
    // flight out of the package stay faint and never reach readout opacity.
    const rows=(chunks:any[])=>chunks.filter(o=>o.material.opacity>=.9);
    try {
      for(let frame=0;frame<180;frame++){
        now+=50;b.update(frame*.05,.05);
        const chunks=visible(),pinned=rows(chunks);expect(pinned.length).toBeLessThanOrEqual(3);
        for(const sp of chunks)if(!pinned.includes(sp)){expect(sp.userData.tokenChunk.lane).toBe('answer');expect(sp.material.opacity).toBeLessThan(.61);}
        if(pinned.length){sawReadout=true;
          const ys=pinned.map(o=>o.position.y).sort((a,b)=>a-b);
          for(let j=1;j<ys.length;j++)expect(ys[j]-ys[j-1]).toBeGreaterThan(.6);
          for(const sp of pinned){expect(sp.scale.x).toBeLessThanOrEqual(9.00001);expect(sp.scale.y).toBeLessThanOrEqual(.50001);expect(sp.userData.tokenChunk.words.length).toBeGreaterThan(0);expect(sp.material.toneMapped).toBe(false);sequences.add(sp.userData.tokenChunk.sequence);}
        }
        for(const [mode,selected]of [['heat','tokens'],['data',null],['data','hbm'],['power',null]]){
          opts.state.mode=mode;opts.state.selected=selected;b.update(frame*.05,0);expect(visible()).toHaveLength(0);
        }
        for(const mode of ['power','data']){
          opts.state.mode=mode;opts.state.selected='tokens';b.update(frame*.05,0);
          expect(rows(visible()).map(o=>o.userData.tokenChunk.sequence)).toEqual(pinned.map(o=>o.userData.tokenChunk.sequence));
        }
      }
      expect(sawReadout).toBe(true);expect(sequences.size).toBeGreaterThan(3);
    }finally{clock.mockRestore();}
  });
  it('compact Power view fits the context board and keeps the Tokens pin below the HUD band',()=>{
    const b=wrappers[2].build(options('gb200')),preset=fitComponent(b.cameraByMode.power,947,850);
    const c=new THREE.PerspectiveCamera(35,947/850,.05,500);c.position.fromArray(preset.pos);c.lookAt(new THREE.Vector3(...preset.target));c.updateMatrixWorld(true);
    // The subject is the 9 cm package; the 12 cm board is supporting context.
    for(const x of [-4.5,4.5])for(const z of [-4.5,4.5]){const p=new THREE.Vector3(x,0,z).project(c);expect(Math.abs(p.x)).toBeLessThan(.96);expect(Math.abs(p.y)).toBeLessThan(.85);}
    const pin=new THREE.Vector3(...b.hotspots.tokens.pos).project(c);expect(pin.y).toBeLessThan(.65);expect(Math.abs(pin.x)).toBeLessThan(.85);
    expect(c.position.distanceTo(new THREE.Vector3(...preset.target))).toBeLessThan(b.camera.max);
  });
  it('the decorative adjacent rack no longer hides the inspected cabinet',()=>{
    for(const name of ['compute-rack-gb200','compute-rack-h100']){
      const root=assets.get(name).scene;root.updateMatrixWorld(true);let blocked=0;
      for(const mesh of meshes(root)){
        const position=mesh.geometry.attributes.position,index=mesh.geometry.index,count=index?index.count:position.count;
        for(let i=0;i<count;i+=3){
          const center=new THREE.Vector3();for(let j=0;j<3;j++)center.add(new THREE.Vector3().fromBufferAttribute(position,index?index.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld));center.multiplyScalar(1/3);
          if(center.x<-.4&&center.x>-.95&&center.y>.05&&center.y<2.2&&Math.abs(center.z)<.6)blocked++;
        }
      }
      expect(blocked).toBe(0);
    }
  });
  it('embedded chip and cabinet canvas images retain real pixel variation',()=>{
    for(const name of ['compute-chip-gb200','compute-chip-gb300','compute-chip-rubin','compute-chip-h100','compute-rack-gb200','compute-rack-h100']){
      const bytes=readFileSync(new URL(`../../public/models/${name}.glb`,import.meta.url)),length=bytes.readUInt32LE(12);
      const json=JSON.parse(bytes.subarray(20,20+length).toString()),offset=28+length;
      expect(json.images.length).toBeGreaterThan(0);
      for(const image of json.images){
        const view=json.bufferViews[image.bufferView],png=bytes.subarray(offset+view.byteOffset,offset+view.byteOffset+view.byteLength),data=[];
        for(let at=8;at+12<=png.length;){const n=png.readUInt32BE(at);if(png.toString('ascii',at+4,at+8)==='IDAT')data.push(png.subarray(at+8,at+8+n));at+=n+12;}
        // PNG filtered scanlines of the former transparent-black export had
        // only zero bytes. Varied scanline values prove actual drawn content
        // survived export; browser review checks its visual mapping.
        const count=data.reduce((n:any,b:any)=>n+b.length,0),joined=new Uint8Array(count);let at=0;
        for(const part of data){joined.set(part,at);at+=part.length;}
        expect(new Set(inflateSync(joined)).size).toBeGreaterThan(16);
      }
    }
  });
  for(const [i,kind]of kinds.entries())for(const id of ids)it(`${kind}/${id}: full replacement preserves all routes, hotspot coordinates and update contract`,()=>{
    const a=native[i].build(options(id)),b=wrappers[i].build(options(id));
    for(const key of ['flows','dataFlows','heatFlows'])expect(flowPaths(b,key)).toEqual(flowPaths(a,key));
    for(const key of ['hotspots','dataHotspots','heatHotspots'])expect(b[key]).toEqual(a[key]);
    expect(()=>{a.update(20,1/60);b.update(20,1/60);}).not.toThrow();
    const hardware=b.scene.children.find((o:any)=>o.name===`Blender complete ${kind} hardware`);
    expect(hardware).toBeDefined();expect(meshes(hardware).length).toBeGreaterThan(10);
    expect(b.scene.userData.blenderCompute.completeStaticHardware).toBe(true);
    expect(b.scene.userData.blenderCompute.replacedNativeMeshes).toBeGreaterThan(10);
    const dynamic=new Set();for(const key of ['flows','dataFlows','heatFlows'])for(const f of b[key]||[])f.group.traverse((o:any)=>dynamic.add(o));
    hardware.traverse((o:any)=>dynamic.add(o));
    const outside=meshes(b.scene).filter(o=>!dynamic.has(o)&&!o.isReflector&&!o.userData.computeDynamic&&!o.userData.nativeOverlay&&(Array.isArray(o.material)?o.material:[o.material]).some((m:any)=>!m.isMeshBasicMaterial&&!m.isShaderMaterial));
    expect(outside.length).toBe(0);
    expect(meshes(hardware).every(o=>Array.from(o.geometry.attributes.position.array).every(Number.isFinite))).toBe(true);
    expect(meshes(hardware).every(o=>o.geometry.userData.authoredIn==='Blender')).toBe(true);
    let metadata:any;hardware.traverse((o:any)=>{if(o.userData.ifxCompute)metadata=JSON.parse(o.userData.ifxCompute);});
    expect(metadata.fullStaticHardware).toBe(true);expect(metadata.scene).toBe(kind);
    const nativeBounds=new THREE.Box3(),authoredBounds=new THREE.Box3();
    a.scene.updateMatrixWorld(true);b.scene.updateMatrixWorld(true);
    for(const [scene,box] of [[a.scene,nativeBounds],[b.scene,authoredBounds]] as const)for(const mesh of meshes(scene)){
      // The studio ground is a rendering surface, not a hardware envelope.
      if(mesh.geometry.type==='PlaneGeometry'||mesh.isReflector||mesh.isSprite)continue;
      const candidate=new THREE.Box3().setFromObject(mesh),size=candidate.getSize(new THREE.Vector3());
      if(size.x>30&&size.z>30&&size.y<.1)continue;
      box.union(candidate);
    }
    // Catch metre/cm conversion failures without treating representative new
    // handles or camera annotation bounds as exact mechanical envelopes.
    const ratio=authoredBounds.getSize(new THREE.Vector3()).length()/nativeBounds.getSize(new THREE.Vector3()).length();
    expect(ratio).toBeGreaterThan(.8);expect(ratio).toBeLessThan(1.3);
  },30000);
  for(const [i,kind]of kinds.entries())it(`${kind}: rebuilds own their geometry, materials and textures`,()=>{
    const a=wrappers[i].build(options('gb200')),b=wrappers[i].build(options('gb200'));
    const ma=meshes(a.scene.children.find((o:any)=>o.name===`Blender complete ${kind} hardware`)),mb=meshes(b.scene.children.find((o:any)=>o.name===`Blender complete ${kind} hardware`));
    expect(ma.length).toBe(mb.length);ma.forEach((m,j)=>{
      expect(m.geometry===mb[j].geometry).toBe(false);expect(m.material===mb[j].material).toBe(false);
      const am=Array.isArray(m.material)?m.material:[m.material],bm=Array.isArray(mb[j].material)?mb[j].material:[mb[j].material];
      am.forEach((material:any,k:number)=>{for(const key of Object.keys(material))if(material[key]?.isTexture)expect(material[key]===bm[k][key]).toBe(false);});
    });
  });
  for(const mobile of [false,true])it(`GPU emissive animation uses a semantic surface key, mobile=${mobile}`,()=>{
    const opts=options('gb200');opts.quality.mobile=mobile;const b=wrappers[2].build(opts);
    const hardware=b.scene.children.find((o:any)=>o.name==='Blender complete chip hardware');
    const materials=[...new Set(meshes(hardware).flatMap(o=>Array.isArray(o.material)?o.material:[o.material]))] as any[];
    const dies=materials.filter(m=>m.userData.ifxAnimatedSurface==='gpu-die'),rest=materials.filter(m=>!m.userData.ifxAnimatedSurface);
    const covers=meshes(hardware).filter(o=>(Array.isArray(o.material)?o.material:[o.material]).some((m:any)=>m.userData.ifxCoverSurface==='ihs'));
    expect(covers.length).toBeGreaterThan(0);expect(covers.every(o=>!o.visible)).toBe(true);
    expect(dies.length).toBeGreaterThan(0);const baseline=rest.map(m=>[m.emissive?.getHex(),m.emissiveIntensity]);
    opts.state.mode='heat';b.update(3,1/60);expect(dies.every(m=>m.emissive.getHex()===0xff6a1a&&m.emissiveIntensity>.45)).toBe(true);
    expect(covers.every(o=>o.visible)).toBe(true);
    expect(rest.map(m=>[m.emissive?.getHex(),m.emissiveIntensity])).toEqual(baseline);
    opts.state.mode='data';b.update(4,1/60);expect(dies.every(m=>m.emissive.getHex()===0x6fd8ff&&m.emissiveIntensity<.3)).toBe(true);
    expect(covers.every(o=>!o.visible)).toBe(true);
    const repeated=meshes(b.scene).filter(m=>m.userData.computeDynamic==='bga'||m.userData.computeDynamic==='c4');
    expect(repeated.map(m=>m.count)).toEqual([676,1088]);expect(repeated.every(m=>m.geometry.userData.authoredIn==='Blender')).toBe(true);
  });
});



describe('generation-specific compute hardware',()=>{
 it('loads each requested generation rather than silently aliasing another asset',()=>{
  for(const id of ids)for(const [i,kind]of kinds.entries()){
   const b=wrappers[i].build(options(id));expect(b.scene.userData.blenderCompute.asset).toBe(`compute-${kind}-${id}.glb`);
   let meta:any;assets.get(`compute-${kind}-${id}`).scene.traverse((o:any)=>{if(o.userData.ifxCompute)meta=JSON.parse(o.userData.ifxCompute);});expect(meta.accel).toBe(id);
  }
 });
 it('keeps the service switch tray within the nine-tray census and shows two or four ASICs',()=>{
  for(const id of ['gb200','gb300','rubin']){
   const b=wrappers[0].build(options(id)),g=b.scene.userData.computeGeneration;
   expect(g.computeTrays).toBe(18);expect(g.switchTrays).toBe(9);expect(g.openedSwitchChips).toBe(id==='rubin'?4:2);
   const m=meshes(b.scene).filter(o=>(Array.isArray(o.material)?o.material:[o.material]).some((m:any)=>/^NVLink [56] switch silicon/.test(m.name)));
   expect(m.length).toBeGreaterThan(0);
   // Each disjoint silicon envelope contains actual authored vertices.
   const sy=.12+15*.04445+.022225,sz=.535-.07-.45+.5+.1;
   const positions=id==='rubin'?[[-.10,-.12],[.10,-.12],[-.10,.06],[.10,.06]]:[[-.11,-.08],[.11,-.08]];
   b.scene.updateMatrixWorld(true);
   for(const [x,z]of positions){let vertices=0;for(const mesh of m){const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);if(Math.abs(v.x-x)<.043&&Math.abs(v.z-(sz+z))<.043&&Math.abs(v.y-(sy+.004))<.006)vertices++;}}expect(vertices).toBeGreaterThan(12);}
  }
 });
 it('Rubin uses a fanless two-bay tray, eight NICs and separate rigid cooling channels',()=>{
  const b=wrappers[1].build(options('rubin'));
  expect(b.scene.userData.computeGeneration).toMatchObject({gpus:4,cpus:2,fans:0,internalHoses:0,midplane:true,nicCount:8,nicAssemblies:2,dpuCount:1,opticalPorts:8});
  expect(meshes(b.scene).filter(o=>o.userData.computeDynamic==='rotor'&&o.count>0)).toHaveLength(0);
  expect(b.heatHotspots.manifold).toBeDefined();expect(b.heatHotspots.fans).toBeUndefined();
  expect(b.heatFlows.filter((f:any)=>f.cls==='air')).toHaveLength(0);
  const hardware=b.scene.getObjectByName('Blender complete tray hardware');hardware.updateMatrixWorld(true);
  const ray=new THREE.Raycaster();
  for(const f of b.heatFlows.filter((f:any)=>['cool','warm'].includes(f.cls)))for(let u=.05;u<.96;u+=.10){const p=f.path.getPoint(u);ray.set(p,new THREE.Vector3(0,-1,0));const hit=ray.intersectObject(hardware,true)[0];expect(hit?.distance??99).toBeGreaterThan(f.size*1.6);}
 });
 it('H100 optical-module and NIC cameras clear the physical enclosure walls',()=>{
  const b=wrappers[1].build(options('h100')),hardware=b.scene.getObjectByName('Blender complete tray hardware');hardware.updateMatrixWorld(true);
  const ray=new THREE.Raycaster();
  for(const id of ['osfp','cx']){
   const h=b.dataHotspots[id],camera=new THREE.Vector3(...h.view.pos),p=new THREE.Vector3(...h.pos),d=p.clone().sub(camera),length=d.length();ray.set(camera,d.normalize());
   const hits=ray.intersectObject(hardware,true).filter((hit:any)=>hit.distance<length-.12);expect(hits.map((h:any)=>({name:h.object.name,point:h.point.toArray()})),id).toEqual([]);
  }
 });
});

it('every part view avoids distant opaque obstructions in all generations',()=>{
 const issues:any[]=[];
 for(const id of ids)for(const [index,kind]of kinds.entries()){
  const b=wrappers[index].build(options(id)),hardware=b.scene.getObjectByName(`Blender complete ${kind} hardware`);hardware.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(),seen=new Set();
  for(const hs of [b.hotspots,b.dataHotspots,b.heatHotspots])for(const [part,h]of Object.entries(hs) as [string,any][]){
   const key=part+JSON.stringify(h.view);if(seen.has(key))continue;seen.add(key);
   const p=new THREE.Vector3(...h.pos),camera=new THREE.Vector3(...h.view.pos),d=p.clone().sub(camera),length=d.length();ray.set(camera,d.normalize());
   const blocked=ray.intersectObject(hardware,true).find((hit:any)=>hit.distance<length-(kind==='rack'?.16:.4)&&hit.object.visible&&!(Array.isArray(hit.object.material)?hit.object.material.every((m:any)=>m.transparent):hit.object.material.transparent));
   if(blocked)issues.push({id,kind,part,remaining:Math.round((length-blocked.distance)*100)/100,point:blocked.point.toArray().map(v=>+v.toFixed(2))});
  }
 }
 expect(issues).toEqual([]);
});


it('exported GPU packages have the expected live HBM sites and stack heights',()=>{
 for(const id of ids){
  const b=wrappers[2].build(options(id)),m=b.scene.userData.computePackage,model=options(id).model;
  expect(m.gpuDies).toBe(id==='h100'?1:2);expect(m.liveHbmStacks).toBe(model.accel.hbm.stacks);expect(m.hbmDramLayers).toBe(model.accel.hbm.layers);
  expect(m.nvlinkLinks).toBe(model.accel.nvlink.linksPerGpu);
  expect(b.heatFlows.filter((f:any)=>f.thermalOrigin==='hbm').every((f:any)=>f.cls==='hot')).toBe(true);
  const tops=meshes(b.scene).filter(o=>(Array.isArray(o.material)?o.material:[o.material]).some((mat:any)=>mat.name.startsWith('HBM printed top')));
  expect(tops.length).toBeGreaterThan(0);b.scene.updateMatrixWorld(true);
  const sites=id==='h100'?[-2.05,2.05].flatMap(x=>[-1.12,0,1.12].map(z=>[x,z])):[-2.02,-.7,.7,2.02].flatMap(x=>[-2.3,2.3].map(z=>[x,z]));
  const ray=new THREE.Raycaster();let hits=0;
  for(const [i,[x,z]]of sites.entries()){
   ray.set(new THREE.Vector3(x,5,z),new THREE.Vector3(0,-1,0));const hit=ray.intersectObjects(tops,true)[0];
   if(id==='h100'&&i===5){expect(hit).toBeUndefined();continue;}
   // one molded block per stack, drawn about 3x its real height (hbm-stack-drawing)
   expect(hit).toBeDefined();expect(hit.point.y).toBeCloseTo(3.40,3);hits++;
  }
  expect(hits).toBe(model.accel.hbm.stacks);
 }
});

it('H100 optical paths exit through an open rear IO plane',()=>{
 const b=wrappers[1].build(options('h100')),hardware=b.scene.getObjectByName('Blender complete tray hardware');hardware.updateMatrixWorld(true);
 const ray=new THREE.Raycaster();
 for(const x of [-1.65,-1.05,1.05,1.65]){
  ray.set(new THREE.Vector3(x,2.30,-4.8),new THREE.Vector3(0,0,1));
  const solid=ray.intersectObject(hardware,true).find((h:any)=>h.point.z>=-4.515&&h.point.z<=-4.485);
  expect(!!solid,`open optical aperture at x=${x}`).toBe(false);
 }
});

it('Rubin scale-out overlays terminate on all eight NIC package regions',()=>{
 const b=wrappers[1].build(options('rubin'));
 const outputs=b.dataFlows.filter((f:any)=>f.rubinNicOutput);
 expect(outputs.length).toBe(8);
 for(let gpu=0;gpu<4;gpu++)expect(outputs.filter((f:any)=>f.rubinNicOutput.gpu===gpu).map((f:any)=>f.rubinNicOutput.startZ)).toEqual([2.64,3.58]);
});

it('Rubin NIC PCIe starts at Vera; electrical SerDes reaches the optical cages',()=>{
 const b=wrappers[1].build(options('rubin'));
 const roots=b.dataFlows.filter((f:any)=>Number.isInteger(f.rubinPcieRoot));
 expect(roots).toHaveLength(4);
 for(const f of roots){
  expect(f.cls).toBe('pcie');
  expect(f.path.getPoint(0).x).toBeCloseTo(f.rubinPcieRoot===0?-1.1:1.1);
  expect(f.path.getPoint(0).z).toBeCloseTo(-.65+.385);
 }
 expect(b.dataFlows.filter((f:any)=>f.rubinNicOutput).every((f:any)=>f.cls==='serdes')).toBe(true);
});

it('rack optics seat on compute units, retain generation port counts and terminate their patch leads',()=>{
 for(const id of ids){
  const b=wrappers[0].build(options(id)),info=b.scene.userData.rackOptics;
  const count=id==='h100'?4:18;
  expect(info.cagesPerTray).toBe(id==='rubin'?8:4);
  expect(info.modules).toHaveLength(count*2);
  expect(info.storageCages).toHaveLength(count*(id==='gb200'||id==='h100'?4:2));
  expect(info.modules.filter((m:any)=>m.pulled)).toHaveLength(2);
  for(const m of info.modules){
   if(id!=='h100')expect(m.row<11||m.row>19).toBe(true); // no optics on NVLink switch trays
   expect(m.capacityGbps).toBe(id==='gb200'?400:800);
   expect(m.connectors).toBe(id==='h100'||id==='gb300'?2:1);
  }
  const trunks=b.dataFlows.filter((f:any)=>f.rackOpticalTrunk);
  expect(trunks).toHaveLength(8);
  for(const f of trunks){
   const end=f.path.getPoint(1);
   expect(end.x).toBeGreaterThan(.08);expect(end.x).toBeLessThan(.32);
   expect(end.y).toBeCloseTo(3.665,6);expect(end.z).toBeCloseTo(-1.58,6);
   // Side-wall crossings happen above the 3.71 m rim; the long run is inside.
   for(const curve of f.path.curves)for(const p of [curve.getPoint(0),curve.getPoint(1)]){
    if(p.z<-1.2){expect(p.x).toBeGreaterThan(.08);expect(p.x).toBeLessThan(.32);expect(p.y).toBeCloseTo(3.665,6);}
    if(Math.abs(p.x-.06)<.012||Math.abs(p.x-.34)<.012)expect(p.y).toBeGreaterThan(3.73);
   }
  }
  const links=b.dataFlows.filter((f:any)=>f.rackOpticalLink);
  expect(links).toHaveLength(count*(id==='h100'||id==='gb300'?4:2));
  const hardware=b.scene.getObjectByName('Blender complete rack hardware');hardware.updateMatrixWorld(true);
  // Limit intersections to the connector boots. Testing every screw, chassis
  // face and cable triangle for every lead needlessly scales with rack detail.
  const connectors=meshes(hardware).filter(o=>(Array.isArray(o.material)?o.material:[o.material]).some((m:any)=>m.name.startsWith('MPO APC connector boot')));
  expect(connectors.length).toBeGreaterThan(0);
  const cables=meshes(hardware).filter(o=>(Array.isArray(o.material)?o.material:[o.material]).some((m:any)=>m.name.startsWith('Optical patch cable jacket')));
  expect(cables.length).toBeGreaterThan(0);
  for(const cable of cables){
   const box=new THREE.Box3().setFromObject(cable);
   expect(box.min.x).toBeGreaterThan(-.3);expect(box.max.x).toBeLessThan(.3);
  }

  const ray=new THREE.Raycaster();
  for(const f of links){
   expect(f.rackOpticalLink.managed).toBe(true);
   for(const segment of f.path.curves) {
    for(const p of [segment.getPoint(0),segment.getPoint(1)]) {
     expect(Math.abs(p.x)).toBeLessThan(.29);
     expect(p.z).toBeLessThan(1.55);
    }
   }
   expect(f.path.getPoint(0).toArray()).toEqual(f.rackOpticalLink.start);
   expect(f.path.getPoint(1).distanceTo(new THREE.Vector3(...f.rackOpticalLink.end))).toBeLessThan(1e-8);
   expect(f.ribbonIntensity).toBeLessThan(.4);
   // A connector must actually exist in the shipped Blender asset behind the fiber.
   ray.set(new THREE.Vector3(...f.rackOpticalLink.start),new THREE.Vector3(0,0,id==='h100'?1:-1));
   const hit=ray.intersectObjects(connectors,false).find((h:any)=>h.distance<.035);
   expect(hit,`${id} row ${f.rackOpticalLink.row} seated fiber connector`).toBeDefined();
  }
 }
});

it('compute studio adds exact-path batched motion to all three hardware scales',async()=>{
 const {applyComputeArtDirection}=await import('./compute-art-direction.js');
 for(const [index,wrapper]of wrappers.entries()){
  const opts=options('rubin'),b=wrapper.build(opts);
  const before=['flows','dataFlows','heatFlows'].map(k=>b[k].map((f:any)=>f.path.curves.map((c:any)=>[c.getPoint(0).toArray(),c.getPoint(1).toArray()])));
  applyComputeArtDirection({built:b,level:index+3,quality:opts.quality});
  expect(b.flowRibbons.batches).toHaveLength(3);expect(b.flowRibbons.drawCallsPerVisibleLayer).toBe(2);
  expect(b.scene.userData.computeArtDirection).toBe('studio-streams-v2');
  expect(['flows','dataFlows','heatFlows'].map(k=>b[k].map((f:any)=>f.path.curves.map((c:any)=>[c.getPoint(0).toArray(),c.getPoint(1).toArray()])))).toEqual(before);
  for(const key of ['flows','heatFlows'])for(const f of b[key])f.group.visible=false;
  b.update(1,.016);
  expect(b.flowRibbons.batches.filter((v:any)=>v.group.visible).map((v:any)=>v.key)).toEqual(['dataFlows']);
 }
});

it('refines only rack exhaust into narrower dimmer streaks while preserving coolant and tray motion',async()=>{
 const {applyComputeArtDirection}=await import('./compute-art-direction.js');
 for(const index of [0,1]){
  const opts=options('gb300'),b=wrappers[index].build(opts);
  const air=b.heatFlows.filter((f:any)=>f.cls==='air'),cool=b.heatFlows.filter((f:any)=>f.cls==='cool');
  const before=air.map((f:any)=>({count:f.count,color:f.base.color.clone(),len:f.len}));
  expect(air.length).toBeGreaterThan(0);
  applyComputeArtDirection({built:b,level:index+3,quality:opts.quality});
  for(const [i,f]of air.entries()){
   expect(f.count).toBeGreaterThanOrEqual(before[i].count);expect(f.len).toBe(before[i].len);
   expect(f.motionStyle.radius).toBe(index===0?.55:1.15);expect(f.motionStyle.stretch).toBe(index===0?3.2:2.6);
   expect(f.base.color.r).toBeCloseTo(before[i].color.r*(index===0?.85:1.9));
  }
  expect(cool.every((f:any)=>f.motionStyle.radius===1.15&&f.motionStyle.stretch===2.6)).toBe(true);
 }
});

it('trims package Heat emission without changing Data or power presentation',async()=>{
 const {applyComputeArtDirection}=await import('./compute-art-direction.js');
 const opts=options('rubin'),b=wrappers[2].build(opts);
 const before=['flows','dataFlows','heatFlows'].map(k=>b[k].map((f:any)=>({color:f.base.color.clone(),speed:f.speed,len:f.len})));
 applyComputeArtDirection({built:b,level:5,quality:opts.quality});
 for(const [i,k]of ['flows','dataFlows','heatFlows'].entries())for(const [j,f]of b[k].entries()){
  expect(f.base.color.r).toBeCloseTo(before[i][j].color.r*(k==='heatFlows'?1.15:k==='dataFlows'?1.5:1.9));
  expect(f.speed).toBe(before[i][j].speed);expect(f.len).toBe(before[i][j].len);
 }
});
