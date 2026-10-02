import {beforeAll,afterAll,it,expect,vi} from 'vitest';
// @ts-expect-error Vitest supplies Node builtins.
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {engineLayout} from './side-geometry.js';
let moduleBuilder:any,cpoBuilder:any;
beforeAll(async()=>{
 const noop=()=>undefined,ctx=new Proxy({measureText:(t:string)=>({width:t.length*24}),createImageData:(w:number,h:number)=>({data:new Uint8ClampedArray(w*h*4)}),createLinearGradient:()=>({addColorStop:noop}),createRadialGradient:()=>({addColorStop:noop})} as Record<string,unknown>,{get:(t,k:string)=>k in t?t[k]:noop});
 vi.stubGlobal('document',{createElement:()=>({width:1,height:1,getContext:()=>ctx})});
 const assets=new Map();for(const name of ['osfp-module-runtime','cpo-hardware']){
  const b=readFileSync(new URL(`../../public/models/${name}.glb`,import.meta.url));assets.set(name,await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),''));
 }
 vi.spyOn(GLTFLoader.prototype,'loadAsync').mockImplementation(async url=>assets.get(url.includes('cpo-hardware')?'cpo-hardware':'osfp-module-runtime'));
 moduleBuilder=await import('./side-module-blender.js');cpoBuilder=await import('./side-cpo-blender.js');await Promise.all([moduleBuilder.preload(),cpoBuilder.preload()]);
});
afterAll(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
function exactWorldRoutes(b:any){
 b.scene.updateMatrixWorld(true);const inverse=b.scene.matrixWorld.clone().invert();
 for(const batch of b.flowRibbons.batches){const starts=batch.geometry.getAttribute('instanceStart'),ends=batch.geometry.getAttribute('instanceEnd');
  for(const entry of batch.entries){let i=entry.start;for(const c of entry.flow.path.curves){if(c.getLength()<1e-9)continue;
   const matrix=new THREE.Matrix4().multiplyMatrices(inverse,entry.flow.group.matrixWorld);
   for(const [attr,t]of [[starts,0],[ends,1]] as const){const p=c.getPoint(t).applyMatrix4(matrix),q=new THREE.Vector3().fromBufferAttribute(attr,i);expect(q.distanceTo(p)).toBeLessThan(1e-4);}i++;
  }}
 }
}
it('actual module ribbons share exported board transforms and DSP/LPO/assembly visibility',()=>{
 const state={mode:'data'},b=moduleBuilder.build({quality:{mobile:false,shadows:false},state});
 for(const mode of ['data','power','heat'])for(const lpo of [false,true]){
  state.mode=mode;b.variant.setLpo(lpo);b.update(1,.016);exactWorldRoutes(b);
  for(const batch of b.flowRibbons.batches)for(const entry of batch.entries){
   const on=entry.flow.group.visible&&entry.flow.mesh.visible;expect(batch.alpha.getX(entry.start)>0).toBe(on);
  }
 }
 b.presentation.setExplode(.5,{immediate:true});b.update(2,.016);exactWorldRoutes(b);
 expect(b.flowRibbons.batches.every((v:any)=>!v.group.visible)).toBe(true);
 b.presentation.setExplode(1,{immediate:true});b.update(3,.016);exactWorldRoutes(b);
});
it('CPO activates all 18 actual engine CW paths and limits new stack x-ray to Power',()=>{
 const state={mode:'data'},b=cpoBuilder.build({quality:{mobile:false,shadows:false},state});
 const cw=b.dataFlows.filter((f:any)=>f.cls==='cw'),engines=engineLayout();expect(cw).toHaveLength(27); // 18 package paths plus three enlarged-detail samples in each of the three engine views
 expect(cw.filter((f:any)=>f.group.parent?.visible!==false)).toHaveLength(21); // one engine view on screen
 for(const [i,e]of engines.entries()){
  const p=cw[i].path.getPoint(1);expect(p.x).toBeCloseTo(e.x+e.out[0]*.83+e.tan[0]*.305);expect(p.z).toBeCloseTo(e.z+e.out[1]*.83+e.tan[1]*.305);
 }
 for(const mode of ['data','power','heat','data']){
  state.mode=mode;b.update(2,.016);exactWorldRoutes(b);
  for(const name of ['CPO_BOARD__Midnight_laminate','CPO_PACKAGE__Package_ceramic','CPO_DIES__Switch_ASIC_silicon']){
   const m=b.scene.getObjectByName(name).material;expect(m.transparent).toBe(mode==='power');expect(m.opacity).toBe(mode==='power'?(name.includes('ASIC')?.58:.16):1);expect(m.depthWrite).toBe(mode!=='power');
  }
 }
 expect(b.inspection.scope).toContain('Moving marks show direction, not lane counts');expect(b.inspection.scope).toContain('ASIC partially translucent');
});
