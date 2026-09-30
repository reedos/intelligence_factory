import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
// @ts-expect-error Node builtins supplied by Vitest.
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { compute, DEFAULT_SCENARIO } from '../model/engine';
import { SITES } from '../model/sites';
let campus:any, native:any, built:any, hall:any, nativeHall:any, builtHall:any;
beforeAll(async()=>{
 const noop=()=>undefined;
 const ctx=new Proxy({createImageData:(w:number,h:number)=>({data:new Uint8ClampedArray(w*h*4)}),measureText:(t:string)=>({width:t.length*24}),createLinearGradient:()=>({addColorStop:noop}),createRadialGradient:()=>({addColorStop:noop})} as Record<string,unknown>,{get:(t,k:string)=>k in t?t[k]:noop});
 vi.stubGlobal('document',{createElement:()=>({width:1,height:1,getContext:()=>ctx})});
 campus=await import('./campus.js');
 const opts={quality:{mobile:true,shadows:false},model:compute(DEFAULT_SCENARIO)};
 native=campus.build(opts);hall=await import('./hall.js');nativeHall=hall.build(opts);
 const assets=new Map();
 for(const name of ['campus-architecture','campus-catalog','site-construction','campus-vehicles','hall-finish','campus-transformer']){
  const b=readFileSync(new URL(`../../public/models/${name}.glb`,import.meta.url));
  assets.set(name,await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),''));
 }
 vi.spyOn(GLTFLoader.prototype,'loadAsync').mockImplementation(async url=>assets.get(url.includes('campus-architecture')?'campus-architecture':url.includes('site-construction')?'site-construction':url.includes('campus-vehicles')?'campus-vehicles':url.includes('hall-finish')?'hall-finish':url.includes('campus-transformer')?'campus-transformer':'campus-catalog'));
 await campus.preload();built=campus.build(opts);await hall.preload();builtHall=hall.build(opts);
},20000);
afterAll(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
const paths=(b:any,k:string)=>b[k].map((f:any)=>({cls:f.cls,pts:f.path.curves.map((c:any)=>[c.getPoint(0).toArray(),c.getPoint(1).toArray()])}));
describe('authored Blender campus replaces geometry without changing the engineering',()=>{
 it('preserves all utility paths and hotspot coordinates',()=>{
  for(const k of ['flows','dataFlows','heatFlows'])expect(paths(built,k)).toEqual(paths(native,k));
  for(const k of ['hotspots','dataHotspots','heatHotspots']){
   const old={...native[k]},now={...built[k]};delete old.ops;delete now.ops;expect(now).toEqual(old);
  }
  expect(built.hotspots.ops.pos[1]).toBe(22.4); // mast follows the taller authored office canopy
  expect(native.hotspots.ops.pos[1]).toBe(19.45);
  expect(built.dataHotspots.border).toBeDefined();expect(built.hotspots.security).toBeDefined();
  expect(()=>built.update(4,1/60)).not.toThrow();
 });
 it('keeps streetlight poles and their clearance outside road and junction paving',()=>{
  const plan=built.scene.userData.campusRoads;
  expect(plan.streetLightPoles.length).toBeGreaterThan(15);
  for(const pole of plan.streetLightPoles)for(const r of plan.rects){
   const dx=Math.max(r.x0-pole.x,0,pole.x-r.x1),dz=Math.max(r.z0-pole.z,0,pole.z-r.z1);
   expect(Math.hypot(dx,dz),'pole intrudes into paved circulation').toBeGreaterThan(pole.radius+.5);
  }
  for(const [x,z]of [[-350,-64],[-350,-46],[-250,-64],[-250,-46],[-100,-64],[-100,-46],[250,-64],[250,-46],[-121,143]])expect(plan.streetLightPoles.some((p:any)=>p.x===x&&p.z===z)).toBe(false);
 });
 it('fits the larger shuttle inside its dedicated bay',()=>{
  const fleet=built.scene.userData.blenderFleet,bay=fleet.robovanBay;
  expect(fleet.robovanCount).toBe(1);
  for(const name of ['MODEL_3','MODEL_Y','CYBERCAB','ROBOVAN'])expect(built.scene.getObjectByName(`Blender fleet ${name}`)).toBeDefined();
  const bounds=new THREE.Box3().setFromObject(built.scene.getObjectByName('Blender fleet ROBOVAN'));
  expect(bounds.min.x).toBeGreaterThan(bay.x-bay.width/2);expect(bounds.max.x).toBeLessThan(bay.x+bay.width/2);
  expect(bounds.min.z).toBeGreaterThan(bay.z-bay.depth/2);expect(bounds.max.z).toBeLessThan(bay.z+bay.depth/2);
  expect(bounds.max.z).toBeLessThan(202); // preserved pedestrian path
 });
 it('keeps deformed cable surface normals facing out',async()=>{
  const {authoredConstruction}=await import('./site-blender-construction.js');
  const curve=new THREE.LineCurve3(new THREE.Vector3(0,0,0),new THREE.Vector3(0,2,0));
  const geo=authoredConstruction(new THREE.TubeGeometry(curve,32,.1,8,false));
  const p=geo.attributes.position,n=geo.attributes.normal;
  for(let i=0;i<p.count;i++)expect(p.getX(i)*n.getX(i)+p.getZ(i)*n.getZ(i)).toBeGreaterThan(.05);
 });
 it('keeps all six authored exterior faces outward and material order stable',async()=>{
  const {siteConstructionGeometry}=await import('./site-blender-construction.js');
  const geo=siteConstructionGeometry('BOX_SIX_FACES'),p=geo.attributes.position,n=geo.attributes.normal;
  expect(geo.groups).toHaveLength(6);
  const directions=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  for(const [i,g] of geo.groups.entries())for(let v=g.start;v<g.start+g.count;v++){
   expect(p.getX(v)*n.getX(v)+p.getY(v)*n.getY(v)+p.getZ(v)*n.getZ(v)).toBeGreaterThan(.49);
   expect(new THREE.Vector3().fromBufferAttribute(n,v).dot(new THREE.Vector3(...directions[i]))).toBeGreaterThan(.99);
  }
 });
 it('draws every Colossus 2 stage hall with authored exteriors and fits the opening view',()=>{
  for(const stage of [0,3]){
   const model=compute({...SITES.colossus2.scenario,site:'colossus2',stage});
   const b=campus.build({quality:{mobile:true,shadows:false},model});
   expect(model.halls).toBeGreaterThan(2);
   expect(b.scene.userData.campusHallCounts).toEqual({modeled:model.halls,detailed:2,expansion:model.halls-2});
   const expansion=b.scene.getObjectByName('Expanded campus halls');
   expect(expansion.userData.hallCount).toBe(model.halls-2);
   expect(expansion.children.length).toBeGreaterThan(3);
   for(const m of expansion.children){expect(m.count).toBe(model.halls-2);expect(m.geometry.userData.blender.asset).toBe('campus-architecture');}
   expect(b.scene.userData.blenderCoverage.unconverted).toEqual([]);
   const bounds=new THREE.Box3().setFromObject(expansion);
   expect(b.cinematography.views.campus).toEqual({pos:b.camera.pos,target:b.camera.target,compact:b.camera.compact,portrait:b.camera.portrait});
   for(const [aspect,preset,fov] of [[1.6,b.camera,35],[947/850,b.camera.compact,35],[.55,b.camera.portrait,48]] as const){
    const distance=new THREE.Vector3().fromArray(preset.pos).distanceTo(new THREE.Vector3().fromArray(preset.target));
    expect(distance,'OrbitControls must not clamp the fitted opening view').toBeLessThan(b.camera.max);
    expect(distance,'far plane must include campus beyond the target').toBeLessThan(b.camera.far*.7);
    const camera=new THREE.PerspectiveCamera(fov,aspect,.2,20000);camera.position.fromArray(preset.pos);camera.lookAt(new THREE.Vector3().fromArray(preset.target));camera.updateMatrixWorld(true);
    expect(camera.position.length()).toBeLessThan(b.scene.getObjectByName('Campus sky').geometry.parameters.radius);
    const projected=[];
    for(const point of b.scene.userData.campusOverviewBounds.points){
     const world=new THREE.Vector3(...point);
     expect(camera.position.distanceTo(world),'fog must not hide the framed campus').toBeLessThan(b.scene.fog.near);
     const p=world.project(camera);expect(Math.abs(p.x),`stage${stage} aspect${aspect} ${point}`).toBeLessThan(.98);expect(Math.abs(p.y)).toBeLessThan(.98);projected.push(p);
    }
    // Fit the actual union of occupied campus bounds, not a mostly empty
    // rectangle containing the distant off-campus transmission approach.
    const usedWidth=(Math.max(...projected.map(p=>p.x))-Math.min(...projected.map(p=>p.x)))/2,usedHeight=(Math.max(...projected.map(p=>p.y))-Math.min(...projected.map(p=>p.y)))/2;
    expect(Math.max(usedWidth,usedHeight)).toBeGreaterThan(.75);
   }
  }
 });
 it('retains fixtures at the rear cutaway and supplies real illumination',()=>{
  expect(builtHall.scene.userData.hallCutaway.actualAreaLights).toBe(4);
  const lights:any[]=[];builtHall.scene.traverse((o:any)=>{if(o.isRectAreaLight)lights.push(o);});
  expect(lights).toHaveLength(4);
  for(const light of lights){expect(light.intensity).toBeGreaterThan(0);if(light.name.includes('rear'))expect(light.position.z).toBeLessThan(-17);}
  const fixtures:any[]=[];builtHall.scene.traverse((o:any)=>{if(o.userData.blenderAsset==='LUMINAIRE')fixtures.push(o);});
  expect(fixtures).toHaveLength(2);
  for(const group of fixtures){const bounds=new THREE.Box3().setFromObject(group);expect(bounds.max.z).toBeLessThan(-17);}
 });
 it.each([
   {...DEFAULT_SCENARIO,meterMW:10},
   {...DEFAULT_SCENARIO,meterMW:1000},
   {...DEFAULT_SCENARIO,site:'colossus2',accel:'gb300',cooling:'liquid'},
   {...DEFAULT_SCENARIO,accel:'h100',cooling:'air',power:'dc800'},
 ])('covers scenario variant $accel / $meterMW MW',scenario=>{
  for(const builder of [campus,hall]){
   const model=compute(scenario as any),before=JSON.stringify(model);
   const scene=builder.build({quality:{mobile:true,shadows:false},model}).scene;
   expect(JSON.stringify(model)).toBe(before);
   expect(scene.userData.blenderCoverage.unconverted,JSON.stringify(scenario)).toEqual([]);
  }
 });
 it('covers all hall physical meshes while preserving every route and hotspot',()=>{
  expect(builtHall.scene.userData.blenderCoverage.unconverted).toEqual([]);
  for(const k of ['flows','dataFlows','heatFlows'])expect(paths(builtHall,k)).toEqual(paths(nativeHall,k));
  for(const k of ['hotspots','dataHotspots','heatHotspots'])expect(builtHall[k]).toEqual(nativeHall[k]);
  expect(()=>builtHall.update(4)).not.toThrow();
 });
 it('suppresses native detailed shells and loads finite authored kits',()=>{
  expect(built.scene.getObjectByName('Campus hall 1')).toBeUndefined();
  expect(built.scene.getObjectByName('Blender campus hall 1')).toBeDefined();
  expect(built.scene.getObjectByName('Blender COOLER')).toBeDefined();
  let count=0;built.scene.traverse((o:any)=>{if(!o.isMesh)return;count++;expect(Array.from(o.geometry.attributes.position.array).every(Number.isFinite)).toBe(true);});
  expect(count).toBeGreaterThan(10);
  expect(built.scene.userData.blenderCoverage.unconverted).toEqual([]);
  const bound=new THREE.Box3().setFromObject(built.scene.getObjectByName('Blender campus hall 1'));
  expect(bound.max.y).toBeLessThan(23.41);
 });
});

describe('hall support equipment synchronization',()=>{
 it('keeps four storage and two control racks distinct from GPU racks and exposes fire inspection',()=>{
  expect(builtHall.scene.userData.supportRacks).toEqual({storage:4,control:2,representative:true});
  expect(builtHall.scene.getObjectByName('Storage rack faces').count).toBe(4);
  expect(builtHall.scene.getObjectByName('Control rack faces').count).toBe(2);
  expect(builtHall.dataHotspots.storage).toBeDefined();expect(builtHall.dataHotspots.control).toBeDefined();
  expect(builtHall.heatHotspots.fire).toBeDefined();
  expect(builtHall.scene.userData.blenderCoverage.unconverted).toEqual([]);
  expect(builtHall.scene.userData.hallCutaway.actualAreaLights).toBe(4);
 });
});


describe('hall studio and liquid circuit closure',()=>{
 it('keeps the surrounding stage dark while retaining actual interior lights',()=>{
  const ground=builtHall.scene.getObjectByName('Hall dark studio surround');
  expect(Math.max(ground.material.color.r,ground.material.color.g,ground.material.color.b)).toBeLessThan(.01);
  const lights:any[]=[];builtHall.scene.traverse((o:any)=>{if(o.isRectAreaLight)lights.push(o);});
  expect(lights).toHaveLength(4);expect(lights.every(l=>l.intensity>0)).toBe(true);
 });
 it('keeps every part-camera sightline clear of the restored authored overhead rails and supports',()=>{
  const rails=builtHall.scene.getObjectByName('Hall overhead light rails');
  expect(rails).toBeDefined();builtHall.scene.updateMatrixWorld(true);
  expect(new THREE.Box3().setFromObject(rails).max.y).toBeGreaterThan(7);
  const views=['hotspots','dataHotspots','heatHotspots'].flatMap(layer=>Object.entries(builtHall[layer]).map(([name,p])=>[`${layer}.${name}`,p])) as [string,any][];
  for(const [name,hotspot]of views){
   if(!hotspot.view)continue;
   const a=new THREE.Vector3(...hotspot.view.pos),b=new THREE.Vector3(...hotspot.view.target),delta=b.clone().sub(a);
   for(const offset of [[0,0,0],[.3,0,0],[-.3,0,0],[0,.3,0],[0,-.3,0],[0,0,.3],[0,0,-.3]]){
    const aim=b.clone().add(new THREE.Vector3(...offset)).sub(a);
    const ray=new THREE.Raycaster(a,aim.clone().normalize(),.05,aim.length()-.1);
    expect(ray.intersectObject(rails,true).length,`overhead obstruction in ${name} near ${offset}`).toBe(0);
   }
  }
  // Thin retained structure may cross an overview point; it must not mask
  // a whole selected region. Close inspection above requires all seven rays clear.
  for(const preset of [builtHall.camera,builtHall.camera.compact,builtHall.camera.portrait])for(const [name,hotspot]of views){
   const a=new THREE.Vector3(...preset.pos),target=new THREE.Vector3(...hotspot.pos);
   let obscured=0;
   const direction=target.clone().sub(a).normalize(),right=new THREE.Vector3().crossVectors(direction,new THREE.Vector3(0,1,0)).normalize(),up=new THREE.Vector3().crossVectors(right,direction).normalize();
   for(const x of [-.5,0,.5])for(const y of [-.5,0,.5]){
    const aim=target.clone().addScaledVector(right,x).addScaledVector(up,y).sub(a),ray=new THREE.Raycaster(a,aim.clone().normalize(),.05,aim.length()-.1);
    if(ray.intersectObject(rails,true).length)obscured++;
   }
   expect(obscured,`overview fixture masks ${name}`).toBeLessThan(4);

  }
  const glow:any[]=[];rails.traverse((o:any)=>{if(o.isMesh&&o.material.emissiveIntensity>0)glow.push(o);});
  expect(glow.length).toBeGreaterThan(0);
  const aisleLights=builtHall.scene.children.filter((o:any)=>o.isRectAreaLight&&o.name.startsWith('Aisle light rail'));
  expect(aisleLights).toHaveLength(2);expect(aisleLights.every((o:any)=>o.intensity>0)).toBe(true);
 });
 it('joins facility headers to their separate risers and every secondary loop to CDU and rack outlets',()=>{
  const circuits=builtHall.scene.userData.hallCoolant;
  expect(circuits.facility[0][0]).toEqual([-33,6.2,-16.4]);
  expect(circuits.facility[1][0]).toEqual([-32.2,5.5,-16.4]);
  expect(circuits.secondary).toHaveLength(6*4*2);
  expect(circuits.rackDrops).toHaveLength(6*4*8*2);
  for(const p of circuits.secondary){expect(p[0][1]).toBe(2.3);expect(p[1][1]).toBe(2.45);expect(p.at(-1)[0]).toBeGreaterThan(p[0][0]);}
  for(const drop of circuits.rackDrops){
   expect(drop[1][1]).toBe(2.28);
   expect(circuits.secondary.some((rail:number[][])=>{
    const a=rail[1],b=rail[2],p=drop[0];return Math.abs(p[2]-a[2])<1e-8&&p[0]>=a[0]&&p[0]<=b[0]&&p[1]===a[1];
   })).toBe(true);
  }
 });
 it('keeps roof return branches above hot headers and tower motion on the physical elbow',()=>{
  const roofWarm=built.heatFlows.filter((f:any)=>f.cls==='warm'&&f.path.getPoint(0).y>20);
  const roofCool=built.heatFlows.filter((f:any)=>f.cls==='cool'&&f.path.getPoint(0).y>20);
  expect(roofWarm.length).toBeGreaterThan(0);
  for(let i=0;i<roofWarm.length;i++){
   const hotTop=roofWarm[i].path.curves.at(-1).getPoint(0).y,coolTop=roofCool[i].path.getPoint(0).y;
   expect(coolTop-hotTop).toBeGreaterThan(.35+.16); // header + crossing branch radii
  }
  const chilled=campus.build({quality:{mobile:true,shadows:false},model:compute({...DEFAULT_SCENARIO,cooling:'liquid'})});
  const tower=chilled.heatFlows.find((f:any)=>f.cls==='warm'&&f.path.getPoint(1).distanceTo(new THREE.Vector3(15,9,-275))<1e-6);
  expect(tower).toBeDefined();
  const returnPipe=chilled.heatFlows.find((f:any)=>f.cls==='cool'&&f.path.getPoint(0).distanceTo(new THREE.Vector3(18,.8,-275))<1e-6);
  expect(returnPipe).toBeDefined();
  expect(2.2-returnPipe.path.getPoint(0).y).toBeGreaterThan(.6+.6); // separated at plan crossings
  expect(returnPipe.path.getPoint(0).y-.6).toBeGreaterThan(.15); // clear of plant pad
  expect(tower.path.curves.some((c:any)=>c.getPoint(0).distanceTo(new THREE.Vector3(15,2.2,-275))<1e-6)).toBe(true);
 });
 it('never adds liquid rack drops to the air-cooled H100 rack model',()=>{
  const b=hall.build({quality:{mobile:true,shadows:false},model:compute({...DEFAULT_SCENARIO,accel:'h100',cooling:'air'})});
  expect(b.scene.userData.hallCoolant.secondary).toHaveLength(0);
  expect(b.scene.userData.hallCoolant.rackDrops).toHaveLength(0);
 });
 it('adds a cooled return for each warm-water rooftop row without degenerate flow segments',()=>{
  const warm=campus.build({quality:{mobile:true,shadows:false},model:compute({...DEFAULT_SCENARIO,cooling:'warm'})});
  const roof=warm.heatFlows.filter((f:any)=>f.cls==='cool'&&f.path.curves.some((c:any)=>c.getPoint(0).y>20));
  expect(roof).toHaveLength(6);
  for(const f of roof)for(const c of f.path.curves)expect(c.getLength()).toBeGreaterThan(0);
 });
});


describe('readable connected site activity',()=>{
 it('connects every expanded hall through conceptual power and fiber distribution without crossing its envelope',()=>{
  const model=compute({...SITES.colossus2.scenario,site:'colossus2',stage:0}),b=campus.build({quality:{mobile:true,shadows:false},model});
  const services=b.scene.userData.campusExpansionServices,extra=model.halls-2,perCol=Math.min(12,Math.max(2,Math.ceil(Math.sqrt(extra/1.2)))),z0=-55-(perCol-1)*60;
  expect(services.basis).toContain('not a surveyed');
  for(const kind of ['power','data','cool','warm']){
   const paths=services[kind] as number[][][];
   const contains=(p:number[],a:number[],c:number[])=>new THREE.Line3(new THREE.Vector3(...a),new THREE.Vector3(...c)).closestPointToPoint(new THREE.Vector3(...p),true,new THREE.Vector3()).distanceTo(new THREE.Vector3(...p))<1e-6;
   // Every branch start intersects an earlier trunk; no floating distribution.
   for(let i=1;i<paths.length;i++)expect(paths.slice(0,i).some(path=>path.slice(1).some((p,j)=>contains(paths[i][0],path[j],p)))).toBe(true);
   for(let h=0;h<extra;h++){
    const cx=750+Math.floor(h/perCol)*320,z=z0+h%perCol*120;
    expect(paths.some(path=>{const p=path.at(-1)!;return Math.abs(p[0]-(cx-130))<1e-8&&Math.abs(p[2]-(z+({power:0,data:-3,cool:3,warm:6} as any)[kind]))<1e-8;})).toBe(true);
    for(const path of paths)for(let i=1;i<path.length;i++)for(const t of [.1,.5,.9]){
     const p=new THREE.Vector3(...path[i-1]).lerp(new THREE.Vector3(...path[i]),t);
     expect(p.x>cx-130+.01&&p.x<cx+130-.01&&p.z>z-45+.01&&p.z<z+45-.01).toBe(false);
    }
   }
  }
  const thermal=b.heatFlows.filter((f:any)=>f.group.userData.conceptualExpansion);
  for(const f of thermal){
   const lines=services[f.cls];expect(lines.some((p:number[][])=>{
    const start=(f.cls==='warm'?p.at(-1):p[0])!,end=(f.cls==='warm'?p[0]:p.at(-1))!;
    return f.path.getPoint(0).distanceTo(new THREE.Vector3(...start))<1e-6&&f.path.getPoint(1).distanceTo(new THREE.Vector3(...end))<1e-6;
   })).toBe(true);
  }
  expect(thermal.length).toBe(services.cool.length+services.warm.length);
 });
 it('animates every rack in both directions while sampling only extra particle cores',()=>{
  for(const [mobile,accel,expectedMotion]of [[false,'gb200',54],[true,'h100',30]] as const){
   const scene=hall.build({quality:{mobile,shadows:false},model:compute({...DEFAULT_SCENARIO,accel})});
   const links=scene.scene.userData.hallFiber.routes.filter((r:any)=>r.kind==='rack-to-leaf');
   expect(links).toHaveLength(192);
   expect(links.every((r:any)=>r.animated)).toBe(true);
   expect(links.filter((r:any)=>r.particleCores)).toHaveLength(expectedMotion);
   const outbound=scene.dataFlows.filter((f:any)=>f.group.userData.rackFiberUplink);
   const inbound=scene.dataFlows.filter((f:any)=>f.group.userData.rackFiberReturn);
   expect(outbound).toHaveLength(192);expect(inbound).toHaveLength(192);
   expect(outbound.filter((f:any)=>f.mesh.count>0)).toHaveLength(expectedMotion);
   expect(inbound.every((f:any)=>f.mesh.count===0)).toBe(true);
   for(let i=0;i<192;i++){
    expect(outbound[i].path.getPoint(0).distanceTo(inbound[i].path.getPoint(1))).toBeLessThan(1e-6);
    expect(outbound[i].path.getPoint(1).distanceTo(inbound[i].path.getPoint(0))).toBeLessThan(1e-6);
   }
   const batch=scene.flowRibbons.batches.find((b:any)=>b.key==='dataFlows');
   expect(batch.entries.filter((e:any)=>e.flow.group.userData.rackFiberUplink||e.flow.group.userData.rackFiberReturn)).toHaveLength(384);
   scene.flowRibbons.setQuality({halo:false});
   expect(scene.flowRibbons.drawCallsPerVisibleLayer).toBe(1);
   for(const r of links)expect(Math.sign(r.start[2]-r.rack.z)).toBe(accel==='h100'?-r.rack.f:r.rack.f);
   scene.scene.traverse((o:any)=>{if(o.geometry)o.geometry.dispose();});
  }
 });
 it('animates sampled existing hall power drops and fiber uplinks at their real elevations',()=>{
  const power=builtHall.flows.filter((f:any)=>f.group.userData.rackPowerDrop),data=builtHall.dataFlows.filter((f:any)=>f.group.userData.rackFiberUplink);
  expect(power.length).toBeGreaterThanOrEqual(24);expect(data.length).toBeGreaterThanOrEqual(24);
  for(const f of power){expect(f.path.getPoint(0).y).toBe(3.5);expect(f.path.getPoint(1).y).toBe(2.3);expect(f.path.getPoint(0).x).toBe(f.path.getPoint(1).x);}
  for(const f of data){
   expect(f.path.getPoint(0).y).toBeCloseTo(1.333375,6);
   expect(f.path.getPoint(1).y).toBeGreaterThan(1.3);
   expect(f.path.getPoint(1).y).toBeLessThan(2.3);
  }
  const audit=builtHall.scene.userData.hallFiber;
  const links=audit.routes.filter((r:any)=>r.kind==='rack-to-leaf');
  expect(links).toHaveLength(192);expect(links.length).toBe(audit.computeRackCount);
  expect(new Set(links.map((r:any)=>`${r.rack.x}:${r.rack.z}`)).size).toBe(192);
  expect(new Set(links.map((r:any)=>r.end.join(':'))).size).toBe(192);
  expect(links.filter((r:any)=>r.animated)).toHaveLength(data.length);
  for(const route of links){
   // Rack-side risers remain inside the 600 mm cabinet width.
   for(const p of route.points.filter((p:number[])=>p[1]<4.4&&Math.abs(p[2]-route.rack.z)>.3)){
    // Only the compute end, before the overhead leg, belongs to this rack.
    if(Math.abs(p[0]-route.start[0])<.2)expect(Math.abs(p[0]-route.rack.x)).toBeLessThan(.29);
   }
  }
  for(const route of audit.routes){
   expect(Math.max(...route.points.map((p:number[])=>p[1]))).toBeCloseTo(4.55,6);
   // Long overhead runs sit above the 4.32 m tray floor, below its 4.4 m rim.
   for(let i=1;i<route.points.length;i++){
    const a=route.points[i-1],b=route.points[i];
    if(a[1]>4&&Math.abs(a[1]-b[1])<1e-8&&Math.hypot(a[0]-b[0],a[2]-b[2])>1){
     expect(a[1]).toBeCloseTo(4.36,6);
    }
   }
   if(!route.animated)continue;
   const f=builtHall.dataFlows.find((f:any)=>f.group.userData.fiberRoute===route.kind&&f.path.getPoint(0).distanceTo(new THREE.Vector3(...route.start))<1e-6);
   expect(f).toBeDefined();
   expect(f.path.getPoint(1).distanceTo(new THREE.Vector3(...route.end))).toBeLessThan(1e-6);
  }
 });
});
