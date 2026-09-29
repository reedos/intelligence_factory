import {describe,it,expect} from 'vitest';
import {campusRoadPlan,containsPlan} from './campus-road-plan.js';
const variants=[{name:'default',gensets:20},{name:'short hall',nHalls:1,hallX1:40,gensets:4},{name:'Colossus 2',extra:25,perCol:5,cols:5,batteryYard:true},{name:'future campus',extra:58,perCol:7,cols:9,batteryYard:true},{name:'large campus',extra:90,perCol:9,cols:10,batteryYard:true}];
const overlap=(a:any,b:any)=>Math.min(a.x1,b.x1)>Math.max(a.x0,b.x0)&&Math.min(a.z1,b.z1)>Math.max(a.z0,b.z0);
const on=(p:number[],s:any)=>Math.abs((p[0]-s.a[0])*(s.b[1]-s.a[1])-(p[1]-s.a[1])*(s.b[0]-s.a[0]))<.001&&p[0]>=Math.min(s.a[0],s.b[0])-.001&&p[0]<=Math.max(s.a[0],s.b[0])+.001&&p[1]>=Math.min(s.a[1],s.b[1])-.001&&p[1]<=Math.max(s.a[1],s.b[1])+.001;
describe('campus circulation topology',()=>{
 it('connects every road and destination to the staffed public entrance',()=>{
  for(const options of variants){
   const p=campusRoadPlan(options),seen=new Set([0]);let changed=true;
   while(changed){changed=false;for(let i=0;i<p.segments.length;i++)if(!seen.has(i)&&[...seen].some(j=>overlap(p.rects[i],p.rects[j]))){seen.add(i);changed=true;}}
   expect(seen.size,options.name).toBe(p.segments.length);
   for(const s of p.segments)for(const end of [s.a,s.b])expect(p.segments.some(t=>t!==s&&on(end,t))||p.destinations.some(d=>Math.hypot(d.p[0]-end[0],d.p[1]-end[1])<.001),`${options.name}: ${s.id} loose endpoint`).toBe(true);
   for(const d of p.destinations)expect(p.segments.some(s=>on(d.p,s))).toBe(true);
   for(const r of p.rects){
    expect(overlap(r,{x0:-567,x1:-451,z0:-65.05,z1:-64.95}),'road crosses closed substation fence').toBe(false);
    expect(overlap(r,{x0:-439,x1:-357,z0:-65.05,z1:-64.95}),'road crosses closed substation fence').toBe(false);
    expect(overlap(r,{x0:-357.05,x1:-356.95,z0:-235,z1:-65}),'road crosses east substation fence').toBe(false);
   }
   if(options.batteryYard){const entry=p.rects.find(r=>r.id==='backup battery entry')!;expect(entry.x1).toBe(277.5);expect(entry.x1).toBeLessThan(281);}
  }
 });
 it('uses a nonoverlapping pavement union and keeps crossroad markings clear',()=>{
  for(const options of variants){
   const p=campusRoadPlan(options);
   for(let i=0;i<p.tiles.length;i++)for(let j=i+1;j<p.tiles.length;j++)expect(overlap(p.tiles[i],p.tiles[j]),'overlaid asphalt faces').toBe(false);
   for(const m of p.markings){
    const horizontal=m.w>m.d;
    const paint={x0:m.x-m.w/2,x1:m.x+m.w/2,z0:m.z-m.d/2,z1:m.z+m.d/2};
    for(let i=0;i<p.segments.length;i++)if(!!(p.segments[i].b[0]-p.segments[i].a[0])!==horizontal)expect(overlap(paint,p.rects[i]),'paint enters a crossroad').toBe(false);
   }
   // Both the parking entrance and the main four-way junction have no curb barrier.
   for(const [x,z]of [[-80,170],[-110,-55],[262,-55]])expect(p.curbs.some(e=>on([x,z],{a:[e[0],e[1]],b:[e[2],e[3]]}))).toBe(false);
  }
 });
 it('keeps vehicle loops entirely paved and expansion streets outside hall envelopes',()=>{
  for(const options of variants){
   const p=campusRoadPlan(options);
   for(const [path,halfLength,halfWidth] of [...p.carPaths.map(path=>[path,2.4,1.1] as const),...p.truckPaths.map(path=>[path,5.8,1.45] as const)])for(let i=1;i<path.length;i++)for(let t=0;t<=1;t+=.05){
    const x=path[i-1][0]*(1-t)+path[i][0]*t,z=path[i-1][2]*(1-t)+path[i][2]*t;
    const vx=path[i][0]-path[i-1][0],vz=path[i][2]-path[i-1][2],length=Math.hypot(vx,vz),ux=vx/length,uz=vz/length;
    for(const front of [-halfLength,-halfLength/2,0,halfLength/2,halfLength])for(const side of [-halfWidth,0,halfWidth])expect(p.rects.some(r=>containsPlan(r,x+front*ux-side*uz,z+front*uz+side*ux)),`vehicle envelope leaves pavement at ${x},${z}`).toBe(true);
    // Straight road portions consistently use right-hand traffic; curved
    // junction samples are covered by the swept-body test above.
    if(length>30){
     const mid=[(path[i][0]+path[i-1][0])/2,(path[i][2]+path[i-1][2])/2];
     const road=p.segments.find(s=>!!(s.b[0]-s.a[0])===!!vx&&containsPlan(p.rects[p.segments.indexOf(s)],mid[0],mid[1]));
     expect(road).toBeDefined();
     const offset=ux?(mid[1]-road!.a[1])*ux:-(mid[0]-road!.a[0])*uz;expect(offset,'right-hand traffic lane').toBeGreaterThan(0);
    }
   }
   for(const hall of p.expanded){
    const envelope={x0:hall.x-132,x1:hall.x+132,z0:hall.z-49,z1:hall.z+49};
    expect(p.rects.some(r=>overlap(r,envelope)),'road intersects expanded hall').toBe(false);
    expect(p.segments.some(s=>s.id.startsWith('expansion avenue')&&Math.abs(s.a[0]-hall.x)<=160),'hall lacks service access').toBe(true);
   }
  }
 });
});
