import {beforeAll,afterAll,it,expect,vi} from 'vitest';
// @ts-expect-error Vitest provides Node builtins.
import {readFileSync} from 'node:fs';
import {PerspectiveCamera, Vector3, Matrix4} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {compute,DEFAULT_SCENARIO} from '../model/engine';
let native:any,built:any,across:any;
beforeAll(async()=>{
 const noop=()=>undefined;
 const context=new Proxy({measureText:(t:string)=>({width:t.length*20}),createImageData:(w:number,h:number)=>({data:new Uint8ClampedArray(w*h*4)}),createLinearGradient:()=>({addColorStop:noop}),createRadialGradient:()=>({addColorStop:noop})} as Record<string,unknown>,{get:(t,k:string)=>k in t?t[k]:noop});
 vi.stubGlobal('document',{createElement:()=>({width:1,height:1,getContext:()=>context})});
 across=await import('./across.js');const options={quality:{mobile:true,shadows:false},model:compute(DEFAULT_SCENARIO)};
 native=across.build(options);
 const assets=new Map();
 for(const name of ['campus-catalog','across-infrastructure']){
  const b=readFileSync(new URL(`../../public/models/${name}.glb`,import.meta.url));
  assets.set(name,await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),''));
 }
 vi.spyOn(GLTFLoader.prototype,'loadAsync').mockImplementation(async url=>assets.get(url.includes('across-infrastructure')?'across-infrastructure':'campus-catalog'));
 await across.preload();built=across.build(options);
});
afterAll(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
const paths=(b:any,k:string)=>b[k].map((f:any)=>({cls:f.cls,pts:f.path.curves.map((c:any)=>[c.getPoint(0).toArray(),c.getPoint(1).toArray()])}));
it('authored map preserves geographic routes, counts, layer membership and anchors',()=>{
 for(const k of ['flows','dataFlows','heatFlows'])expect(paths(built,k)).toEqual(paths(native,k));
 for(const k of ['hotspots','dataHotspots','heatHotspots'])expect(built[k]).toEqual(native[k]);
 expect(()=>built.update(10)).not.toThrow();
 expect(built.layers.data.getObjectByName('Blender MAP_HUT')).toBeDefined();
 expect(built.layers.power.getObjectByName('Blender GRID_PYLON')).toBeDefined();
});
it('every physical surface uses Blender geometry while animation stays runtime',()=>{
 const flowNodes=new Set();for(const key of ['flows','dataFlows'])for(const f of built[key])f.group.traverse((o:any)=>flowNodes.add(o));
 const missed:string[]=[];let n=0;
 built.scene.traverse((o:any)=>{
  if(!o.isMesh||flowNodes.has(o))return;
  const mats=Array.isArray(o.material)?o.material:[o.material];
  if(!mats.some((m:any)=>m.isMeshStandardMaterial))return;
  n++;if(!(o.geometry.userData.blender||o.geometry.userData.authoredIn==='Blender'))missed.push(o.name||o.geometry.type);
  expect(Array.from(o.geometry.attributes.position.array).every(Number.isFinite)).toBe(true);
 });
 expect(n).toBeGreaterThan(20);expect(missed).toEqual([]);
});
it('authored geographic surface faces upward with the original UV orientation',()=>{
 const ground=built.scene.children.find((o:any)=>o.isMesh&&o.material.map);
 expect(ground).toBeDefined();const p=ground.geometry.attributes.position,n=ground.geometry.attributes.normal,uv=ground.geometry.attributes.uv;
 for(let i=0;i<p.count;i++){
  expect(n.getY(i)).toBeGreaterThan(.99);
  expect(uv.getX(i)).toBeCloseTo(p.getX(i)+.5,5);
  expect(uv.getY(i)).toBeCloseTo(.5-p.getZ(i),5);
 }
});
it('authored tower exterior normals face outward after Blender export',()=>{
 const mast=built.layers.power.getObjectByName('Blender WIND_MAST');
 let checked=0;
 mast.traverse((o:any)=>{
  if(!o.isMesh)return;const p=o.geometry.attributes.position,n=o.geometry.attributes.normal;
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),y=p.getY(i),z=p.getZ(i),r=Math.hypot(x,z);
   if(y>16.01||r>.66||Math.abs(n.getY(i))>.5)continue;
   expect(n.getX(i)*x+n.getZ(i)*z).toBeGreaterThan(.1);checked++;
  }
 });
 expect(checked).toBeGreaterThan(20);
});

it('regional routes remain above the flat authored map and readable at overview scale',()=>{
 const camera=new PerspectiveCamera(45,1440/1000,1,30000);camera.position.fromArray(built.camera.pos);camera.lookAt(new Vector3(...built.camera.target));camera.updateMatrixWorld();
 const projection={position:camera.position,worldPerPixelAtUnit:2*Math.tan(Math.PI/8)/1000};
 const ink:any[]=[];built.scene.traverse((o:any)=>{if(o.name==='Regional fiber route annotation')ink.push(o);});
 expect(ink).toHaveLength(2);
 built.dataFlows.forEach((f:any,i:number)=>{
  const original=paths(built,'dataFlows')[i];
  for(const c of f.path.curves)expect(c.getPoint(0).y).toBeGreaterThan(0);
  f.update(1,projection);f.update(1.02,projection);
  expect(f.size).toBeGreaterThan(2.5);expect(f.mesh.material.depthTest).toBe(false);
  const scale=new Vector3(),position=new Vector3();const m=new Matrix4();f.mesh.getMatrixAt(0,m);scale.setFromMatrixScale(m);position.setFromMatrixPosition(m);
  expect(scale.x/(position.distanceTo(camera.position)*projection.worldPerPixelAtUnit)).toBeGreaterThan(.6);
  expect(paths(built,'dataFlows')[i]).toEqual(original);
  if(i%2===0){const attr=ink[i/2].geometry.attributes.position;expect(attr.count).toBe(f.path.curves.length+1);for(let j=0;j<attr.count;j++){
    const point=j===attr.count-1?f.path.curves.at(-1).getPoint(1):f.path.curves[j].getPoint(0);
    expect(attr.getX(j)).toBeCloseTo(point.x,3);expect(attr.getZ(j)).toBeCloseTo(point.z,3);expect(attr.getY(j)).toBe(point.y);
  }}
 });
});
it('map captions keep the main campus visible and avoid overlap on desktop and phone',()=>{
 for(const [width,height] of [[1440,1000],[390,650]]){
  const camera=new PerspectiveCamera(45,width/height,1,30000);camera.position.fromArray(built.camera.pos);camera.lookAt(new Vector3(...built.camera.target));
  built.scene.onBeforeRender({getSize:(v:any)=>v.set(width,height)},built.scene,camera);
  const sprites:any[]=[];built.scene.traverse((o:any)=>{if(o.name==='Map campus caption'&&o.visible)sprites.push(o);if(o.name==='Map route distance caption')expect(o.visible).toBe(false);});
  expect(sprites.length).toBeGreaterThan(0);expect(sprites.some(o=>o.parent===built.scene)).toBe(true);
  for(const sprite of sprites)expect(sprite.userData.screenBox[3]).toBeLessThanOrEqual(height-60);
  for(let i=0;i<sprites.length;i++)for(let j=0;j<i;j++){
   const a=sprites[i].userData.screenBox,b=sprites[j].userData.screenBox;
   expect(a[0]<b[2]&&a[2]>b[0]&&a[1]<b[3]&&a[3]>b[1]).toBe(false);
  }
 }
 const state={selected:'route'};const b=across.build({quality:{mobile:true,shadows:false},model:compute(DEFAULT_SCENARIO),state});
 const camera=new PerspectiveCamera(45,1.44,1,30000);camera.position.fromArray(b.dataHotspots.route.view.pos);camera.lookAt(new Vector3(...b.dataHotspots.route.view.target));
 b.scene.onBeforeRender({getSize:(v:any)=>v.set(1440,1000)},b.scene,camera);
 let shown=0;b.scene.traverse((o:any)=>{if(o.name==='Map route distance caption'&&o.visible)shown++;});expect(shown).toBeGreaterThan(0);
});
