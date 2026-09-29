// Pure, representative circulation plan. No renderer or browser dependencies.
export const containsPlan=(r,x,z,margin=0)=>x>=r.x0-margin&&x<=r.x1+margin&&z>=r.z0-margin&&z<=r.z1+margin;
export function campusRoadPlan({extra=0,perCol=2,cols=0,hallX1=230,nHalls=2,batteryYard=false,gensets=0}={}) {
 const segments=[],destinations=[];
 const publicZ=extra?Math.max(380,-55+(perCol-1)*60+105):380,publicEast=Math.max(4400,590+cols*320+500);
 const add=(id,a,b,width=14)=>segments.push({id,a,b,width});
 const terminal=(id,p,kind)=>destinations.push({id,p,kind});
 add('public road',[-4400,publicZ],[publicEast,publicZ],16);
 terminal('west public continuation',[-4400,publicZ],'offsite');terminal('east public continuation',[publicEast,publicZ],'offsite');
 add('staffed entrance',[-110,publicZ],[-110,-55]);
 add('main spine',[-360,-55],[450,-55]);
 add('south service loop',[-110,130],[262,130]);
 add('east service loop',[262,130],[262,-235]);
 add('north plant loop',[262,-235],[450,-235]);
 add('outer plant loop',[450,-235],[450,-55]);
 add('battery west loop',[-360,-55],[-360,120],14);
 add('battery south loop',[-360,120],[-250,120],14);
 add('battery east loop',[-250,120],[-250,-55],14);
 add('substation approach',[-360,-30],[-445,-30],12);
 add('substation gate',[-445,-30],[-445,-65],12);terminal('substation gate',[-445,-65],'yard');
 add('battery pad entry',[-360,77],[-345,77],10);terminal('battery pad',[-345,77],'yard');
 add('parking entrance',[-110,170],[65,170],12);terminal('parking aisle',[65,170],'parking');
 for(const cz of [-170,60].slice(0,nHalls)){
  add(`hall loading ${cz}`,[262,cz-12],[hallX1+8,cz-12],14);
  terminal(`hall loading ${cz}`,[hallX1+8,cz-12],'dock');
 }
 if(batteryYard){add('backup battery entry',[262,-154],[277.5,-154],12);terminal('backup battery yard',[277.5,-154],'yard');}
 if(gensets){
  add('generator entry',[262,-187],[273,-187],12);terminal('generator yard',[273,-187],'yard');
  if(gensets>20){add('south generator entry',[262,38],[273,38],12);terminal('south generator yard',[273,38],'yard');}
  add('fuel entry',[450,-103],[418,-103],12);terminal('fuel yard',[418,-103],'yard');
 }
 const expanded=[];
 if(extra){
  const z0=-55-(perCol-1)*60,zNorth=z0-60,zSouth=z0+(perCol-1)*120+60;
  add('expansion connector',[450,-55],[590,-55]);
  for(let c=0;c<=cols;c++)add(`expansion avenue ${c}`,[590+c*320,zNorth],[590+c*320,zSouth],12);
  for(let r=0;r<=perCol;r++)add(`expansion cross street ${r}`,[590,zNorth+r*120],[590+cols*320,zNorth+r*120],12);
  for(let i=0;i<extra;i++)expanded.push({x:750+Math.floor(i/perCol)*320,z:z0+(i%perCol)*120});
 }
 const rects=segments.map(s=>{
  const r={id:s.id,x0:Math.min(s.a[0],s.b[0])-s.width/2,x1:Math.max(s.a[0],s.b[0])+s.width/2,z0:Math.min(s.a[1],s.b[1])-s.width/2,z1:Math.max(s.a[1],s.b[1])+s.width/2};
  // A service spur hands over at the actual yard/dock edge. Do not extend its
  // end-cap half a carriageway into transformers, platforms or parked cars.
  for(const end of [s.a,s.b])if(destinations.some(d=>d.p[0]===end[0]&&d.p[1]===end[1])){
   if(s.a[0]!==s.b[0])r[end[0]===Math.min(s.a[0],s.b[0])?'x0':'x1']=end[0];
   else r[end[1]===Math.min(s.a[1],s.b[1])?'z0':'z1']=end[1];
  }
  return r;
 });
 // Flared junction aprons provide swept-body clearance for the service truck;
 // they are unioned into paving, never stacked above a crossing street.
 const junctions=[];
 for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++){
  const a=segments[i],b=segments[j];if(!!(a.b[0]-a.a[0])===!!(b.b[0]-b.a[0]))continue;
  const h=a.a[1]===a.b[1]?a:b,v=h===a?b:a,x=v.a[0],z=h.a[1];
  if(x<Math.min(h.a[0],h.b[0])||x>Math.max(h.a[0],h.b[0])||z<Math.min(v.a[1],v.b[1])||z>Math.max(v.a[1],v.b[1]))continue;
  if(junctions.some(p=>p.x===x&&p.z===z))continue;
  junctions.push({x,z});rects.push({id:'junction apron',x0:x-13,x1:x+13,z0:x===-360&&z===-55?-62:z-13,z1:z+13});
 }
 // Parking is part of the paved union, so its entrance cannot be sealed by curb.
 rects.push({id:'parking lot',x0:-80,x1:80,z0:140,z1:200});
 const xs=[...new Set(rects.flatMap(r=>[r.x0,r.x1]))].sort((a,b)=>a-b),zs=[...new Set(rects.flatMap(r=>[r.z0,r.z1]))].sort((a,b)=>a-b);
 const filled=zs.slice(0,-1).map((z,j)=>xs.slice(0,-1).map((x,i)=>rects.some(r=>containsPlan(r,(x+xs[i+1])/2,(z+zs[j+1])/2))));
 const tiles=[],curbs=[];
 for(let j=0;j<zs.length-1;j++){
  // Merge adjacent cells in each row: no coplanar stacked road slabs at junctions.
  let start=-1;
  for(let i=0;i<xs.length;i++){
   const hit=i<xs.length-1&&filled[j][i];
   if(hit&&start<0)start=i;
   if(!hit&&start>=0){tiles.push({x0:xs[start],x1:xs[i],z0:zs[j],z1:zs[j+1]});start=-1;}
  }
  for(let i=0;i<xs.length-1;i++)if(filled[j][i]){
   const edges=[];
   if(!filled[j-1]?.[i])edges.push([xs[i],zs[j],xs[i+1],zs[j]]);
   if(!filled[j+1]?.[i])edges.push([xs[i],zs[j+1],xs[i+1],zs[j+1]]);
   if(!filled[j][i-1])edges.push([xs[i],zs[j],xs[i],zs[j+1]]);
   if(!filled[j][i+1])edges.push([xs[i+1],zs[j],xs[i+1],zs[j+1]]);
   for(const e of edges){
    const x=(e[0]+e[2])/2,z=(e[1]+e[3])/2;
    // Keep terminal mouths open where asphalt hands over to a yard/dock/offsite.
    if(destinations.some(d=>Math.hypot(x-d.p[0],z-d.p[1])<13))continue;
    curbs.push(e);
   }
  }
 }
 const markings=[];
 for(const s of segments){
  const dx=s.b[0]-s.a[0],dz=s.b[1]-s.a[1],len=Math.hypot(dx,dz),horizontal=!!dx;
  for(let d=8;d<len-6;d+=14){
   const x=s.a[0]+dx*d/len,z=s.a[1]+dz*d/len;
   // End each dash before an intersecting perpendicular carriageway. Never
   // stack a second dash pattern or paint straight through a crossroad.
   if(segments.some(t=>t!==s&&!!(t.b[0]-t.a[0])!==horizontal&&containsPlan(rects[segments.indexOf(t)],x,z,5)))continue;
   if(containsPlan(rects.at(-1),x,z)||junctions.some(p=>Math.abs(p.x-x)<17&&Math.abs(p.z-z)<17))continue;
   markings.push({x,z,w:horizontal?5:.18,d:horizontal?.18:5,road:s.id});
  }
 }
 // Smooth bounded junction turns; sample the actual vehicle path for clearance.
 const rounded=(path,r)=>{
  const corners=path.slice(0,-1),out=[];
  corners.forEach((b,i)=>{
   const a=corners[(i+corners.length-1)%corners.length],c=corners[(i+1)%corners.length];
   const ab=Math.hypot(b[0]-a[0],b[2]-a[2]),bc=Math.hypot(c[0]-b[0],c[2]-b[2]),d=Math.min(r===10&&((b[0]-a[0])*(c[2]-b[2])-(b[2]-a[2])*(c[0]-b[0]))<0?16:r,ab/3,bc/3);
   const start=[b[0]-(b[0]-a[0])*d/ab,b[1],b[2]-(b[2]-a[2])*d/ab],end=[b[0]+(c[0]-b[0])*d/bc,b[1],b[2]+(c[2]-b[2])*d/bc];
   for(let k=0;k<=10;k++){const t=k/10;out.push([start[0]*(1-t)**2+2*b[0]*t*(1-t)+end[0]*t*t,b[1],start[2]*(1-t)**2+2*b[2]*t*(1-t)+end[2]*t*t]);}
  });out.push([...out[0]]);return out;
 };
 const carPaths=[[[ -106,.28,-51],[258,.28,-51],[258,.28,126],[-106,.28,126],[-106,.28,-51]],[[258,.28,-51],[454,.28,-51],[454,.28,-239],[258,.28,-239],[258,.28,-51]]].map(p=>rounded(p,8));
 const truckPaths=[[[ -356,.32,-51],[258,.32,-51],[258,.32,126],[-106,.32,126],[-106,.32,-59],[-254,.32,-59],[-254,.32,116],[-356,.32,116],[-356,.32,-51]]].map(p=>rounded(p,10));
 return {representative:true,segments,destinations,junctions,rects,tiles,curbs,markings,expanded,carPaths,truckPaths};
}
