// Vera Rubin tray: representative dimensions and cold-plate separation, informed
// by NVIDIA's public Figure18. Two service bays, four GPUs/two CPUs, no fans or hoses.
import { THREE, MAT, Builder, flow, canvasTex, texMat } from '../kit.js';
import { computeMaterials, finishCompute, boardFinish } from './compute-finish.js';
export function buildRubin({quality,model}, {lights,pkgTex,dieTex}) {
 const scene=new THREE.Scene();lights(scene,quality);
 const S=new Builder(),N=new Builder(),flows=[],dataFlows=[],heatFlows=[],finish=computeMaterials();
 const gp=[[-1.60,-2.7],[-.62,-2.7],[.62,-2.7],[1.60,-2.7]],cp=[[-1.1,-.65],[1.1,-.65]];
 const nic=[[-1.35,2.85],[1.35,2.85]],dpu=[0,2.85];
 // Full-length open chassis, midplane and independently serviceable bay floors.
 S.box(4.4,.035,9,MAT.galv,0,.0175,0);
 for(const x of [-2.2,2.2])S.box(.035,.44,9,MAT.galv,x,.22,0);
 S.box(4.32,.34,.18,MAT.darkSteel,0,.22,1.1);
 const midplane=new THREE.Mesh(new THREE.BoxGeometry(4.1,.24,.04),MAT.pcbBlack);midplane.name='Rubin PCIe Gen6 midplane';midplane.position.set(0,.23,1.12);scene.add(midplane);
 for(const x of [-1.1,1.1]){S.box(2.02,.025,4.9,MAT.pcbBlack,x,.075,-1.52);boardFinish(N,finish,x,.087,-1.52,2.02,4.9);}
 const top=texMat(dieTex(),{rough:.3,metal:.55});
 const packageAt=(name,x,z,w,d,label)=>{
  S.box(w,.055,d,MAT.pcbBlack,x,.14,z);
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w*.85,.025,d*.80),[MAT.silicon,MAT.silicon,label?texMat(pkgTex(label),{rough:.4}):top,MAT.silicon,MAT.silicon,MAT.silicon]);
  mesh.name=name;mesh.position.set(x,.185,z);scene.add(mesh);
 };
 gp.forEach(([x,z],i)=>{packageAt(`Rubin GPU ${i+1}`,x,z,.83,.95);for(const dx of [-.29,.29])for(const dz of [-.32,-.11,.11,.32])N.box(.13,.05,.13,MAT.hbm,x+dx,.21,z+dz);});
 cp.forEach(([x,z],i)=>{
  packageAt(`Vera CPU ${i+1}`,x,z,.75,.77,'VERA');
  for(const side of [-1,1]){S.box(.30,.08,1.05,MAT.pcb,x+side*.64,.16,z);for(let k=0;k<4;k++)N.box(.22,.055,.17,MAT.black,x+side*.64,.21,z-.33+k*.22);}
 });
 // Quad-SuperNIC boards are represented by two service assemblies, with the
 // published aggregate GPU connectivity. Fine pin/trace routing is illustrative.
 nic.forEach(([x,z],i)=>{S.box(1.35,.035,2.15,MAT.pcb,x,.105,z);for (const dx of [-.3,.3]) for (const dz of [-.47,.47]) packageAt(`ConnectX-9 ${i*4+(dx<0?0:2)+(dz<0?1:2)}`,x+dx,z+dz,.40,.52,'CX9');});
 S.box(.85,.035,2.15,MAT.pcbBlack,0,.105,2.85);packageAt('BlueField-4 DPU',0,2.85,.66,.75,'BF4');
 // Power board and exposed supply clip are representative, not a wiring drawing.
 S.box(4.1,.035,.58,MAT.pcbBlack,0,.095,-4.05);
 for(const x of [-1.5,-.5,.5,1.5]){S.box(.65,.12,.42,MAT.nickel,x,.2,-4.02);for(let i=0;i<4;i++)N.box(.08,.08,.16,MAT.inductor,x-.19+i*.125,.29,-4.02);}
 for(const x of [-.09,-.03,.03,.09])S.box(.045,.23,.26,MAT.copper,x,.18,-4.53);
 for(const x of [-1.1,1.1])S.box(.11,.028,4.5,MAT.copper,x,.102,-1.7);
 // Lifted cold plates reveal packages. Internal rigid liquid manifold is shown
 // at its top surface; colored motion is a schematic view of enclosed channels.
 const cooled=[...gp.map(p=>[...p,.88,1.0]),...cp.map(p=>[...p,.80,.85]),...nic.map(p=>[...p,1.08,1.65]),[...dpu,.76,1.65]];
 for(const [i,[x,z,w,d]] of cooled.entries()){
  const plate=new THREE.Mesh(new THREE.BoxGeometry(w,.075,d),MAT.nickel);plate.name=`Rubin cold plate ${i+1}`;plate.position.set(x,.70,z);scene.add(plate);
  for(const sx of [-1,1])for(const sz of [-1,1])N.cyl(.025,.02,MAT.darkSteel,x+sx*w*.38,.75,z+sz*d*.38,10);
  heatFlows.push(flow([[x,.22,z],[x,.77,z]],'hot',{count:4,speed:.4,size:.028,trail:false}));
 }
 for(const [side,x] of [[-1,-2.02],[1,2.02]]){
  S.box(.15,.16,8.55,MAT.nickel,x,.65,-.05);
  const path=[[x,.825,-4.55],[x,.825,4.20]];if(side===1)path.reverse();
  flows.push(flow(path,side===-1?'cool':'warm',{count:20,speed:.8,size:.033,trail:false}));
  heatFlows.push(flow(path,side===-1?'cool':'warm',{count:26,speed:.8,size:.040,trailR:.015}));
  S.cylZ(.065,.22,MAT.nickel,x,.65,-4.48,12);
 }
 // No flexible internal hoses. Flush rigid branches are grouped under the
 // plates and annotated as representative channels, not external tubing.
 const rigid=(a,b)=>S.box(Math.max(.075,Math.abs(a[0]-b[0])),.055,Math.max(.075,Math.abs(a[1]-b[1])),MAT.nickel,(a[0]+b[0])/2,.65,(a[1]+b[1])/2);
 for(const [z,zSupply,zReturn] of [[-2.7,-3.45,-1.95],[-.65,-1.32,.05],[2.85,1.75,3.95]]) {
  const devices=cooled.filter(p=>p[1]===z),lo=Math.min(...devices.map(p=>p[0])),hi=Math.max(...devices.map(p=>p[0]));
  rigid([-2.02,zSupply],[hi,zSupply]);rigid([lo,zReturn],[2.02,zReturn]);
  heatFlows.push(flow([[-2.02,.825,zSupply],[hi,.825,zSupply]],'cool',{count:8,speed:.65,size:.022,trail:false}));
  heatFlows.push(flow([[lo,.825,zReturn],[2.02,.825,zReturn]],'warm',{count:8,speed:.65,size:.022,trail:false}));
  for(const [x,,w,d] of devices){
   rigid([x,zSupply],[x,z-d*.48]);rigid([x,z+d*.48],[x,zReturn]);
   heatFlows.push(flow([[x,.825,zSupply],[x,.825,z-d*.48]],'cool',{count:3,speed:.5,size:.022,trail:false}));
   heatFlows.push(flow([[x,.825,z+d*.48],[x,.825,zReturn]],'warm',{count:3,speed:.5,size:.022,trail:false}));
  }
 }
 // Spine connectors remain at the back; eight front 800G port positions are
 // represented as four pairs so each GPU has 1.6T of scale-out capacity.
 const nvX=[-1.75,-.7,.7,1.75],ports=[-1.66,-1.04,1.04,1.66];
 for(const x of nvX){S.box(.50,.22,.26,MAT.black,x,.18,-4.35);N.box(.44,.018,.20,MAT.gold,x,.30,-4.35);}
 for(const x of ports)for(const y of [.16,.34]){
  S.box(.29,.13,.46,MAT.galv,x,y,4.21);N.box(.25,.085,.015,MAT.black,x,y,4.455);
 }
 // Small service IO remains visibly distinct from optical ports.
 for(const x of [-.28,-.10,.10,.28]){S.box(.12,.08,.10,MAT.darkSteel,x,.16,4.35);N.box(.09,.05,.018,MAT.black,x,.16,4.41);}
 gp.forEach(([x,z],i)=>{
  flows.push(flow([[Math.sign(x)*1.5,.28,-4.02],[x,.28,-3.35],[x,.25,z]],'bus12',{count:10,speed:.8,size:.028,trailR:.009}));
  for(const side of [-1,1])flows.push(flow([[x+side*.40,.24,z],[x+side*.15,.24,z]],'core',{count:4,speed:.35,size:.018,trail:false}));
  dataFlows.push(flow([[x,.29,z-.25],[nvX[i],.31,-3.75],[nvX[i],.31,-4.35]],'nvl',{count:10,speed:.9,size:.03,trailR:.01}));
  const lane=ports[i],route=[[x,.29,z+.4],[lane,.29,-1.65],[lane,.29,.75],[lane,.50,.90],[lane,.50,1.32],[lane,.29,1.55],[lane,.29,2.12]];
  // Midplane connector crossing is electrical; no exposed trace penetrates its body.
  dataFlows.push(flow(route,'eth',{count:10,speed:.9,size:.026,trailR:.009}));
  // Each GPU is represented by two CX9 packages on one column. The branch
  // placement is illustrative; both ends touch actual package regions.
  const flank=lane+(i%2===0?-.23:.23);
  dataFlows.push(flow([[lane,.29,1.85],[flank,.29,1.85],[flank,.29,3.06],[lane,.29,3.06]],'eth',{count:5,speed:.9,size:.02,trail:false}));
  for(const [j,y]of [.16,.34].entries()){
   const start=j===0?2.64:3.58;
   const path=j===0?[[lane,.29,start],[flank,.29,start],[flank,.29,3.78],[lane,y,3.95],[lane,y,4.50]]:[[lane,.29,start],[lane,y,3.95],[lane,y,4.50]];
   const f=flow(path,'eth',{count:5,speed:.75,size:.02,trail:false});f.rubinNicOutput={gpu:i,nic:j,startZ:start};dataFlows.push(f);
  }
 });
 cp.forEach(([x,z],i)=>{for(const gpu of gp.slice(i*2,i*2+2))for(const reverse of [false,true]){const pts=[[x,.30,z-.32],[gpu[0],.30,gpu[1]+.38]];if(reverse)pts.reverse();dataFlows.push(flow(pts,'c2c',{count:5,speed:.6,size:.025,trailR:.008}));}});
 dataFlows.push(flow([[0,.28,3.3],[0,.28,4.38]],'eth',{count:5,speed:.6,size:.024,trail:false}));
 flows.push(flow([[0,.25,-4.75],[0,.28,-4.05],[-1.5,.28,-4.02]],'dc',{count:12,speed:.9,size:.03,trail:false}));
 for(const x of [-1.1,1.1])flows.push(flow([[Math.sign(x)*1.5,.28,-4.02],[x,.3,-3.55],[x,.3,-.65]],'bus12',{count:14,speed:.7,size:.025,trail:false}));
 for(const [x,z] of [...nic,dpu])flows.push(flow([[x,.18,1.45],[x,.18,z]],'bus12',{count:8,speed:.8,size:.022,trail:false}));
 scene.add(S.build(),N.build({cast:false}));for(const list of [flows,dataFlows,heatFlows])for(const f of list)scene.add(f.group);
 const hs=(p,off=[2.2,2.8,3.5])=>({pos:p,view:{pos:p.map((v,i)=>v+off[i]),target:p}});
 const hotspots={osfp:hs([-1.35,.5,4.25]),clip:hs([0,.45,-4.5],[2.4,2,-3]),ibc:hs([-1.5,.45,-4]),vrm:hs([1.95,.35,-2.7]),gpu:hs([1.6,.3,-2.7],[0,.20,1.3]),grace:hs([-1.1,.32,-.65]),lpddr:hs([1.74,.3,-.65],[0,2.1,.5]),coldplates:hs([-1.1,.82,-.65]),nic:hs([1.35,.8,2.85]),nvconn:hs([1.75,.4,-4.35],[2,2,-3])};
 finishCompute(scene,finish);
 scene.userData.computeGeneration={id:'rubin',gpus:4,cpus:2,fans:0,internalHoses:0,midplane:true,nicAssemblies:2,nicCount:8,dpuCount:1,opticalPorts:8,representative:true};
 return {scene,flows,dataFlows,heatFlows,hotspots,
  heatHotspots:{osfp:hotspots.osfp,coldplates:hotspots.coldplates,gpuheat:hotspots.gpu,manifold:hs([-2.02,.8,0]),qd:hs([2.02,.8,-4.48],[2,2,-3])},
  dataHotspots:{nvconn:hotspots.nvconn,c2c:hs([-1.1,.4,-1.5]),cx:hotspots.nic,osfp:hotspots.osfp,dpu:hs([0,.8,2.85]),gpu:hotspots.gpu},
  camera:{pos:[5.9,6.4,8.3],target:[0,.2,-.5],near:.02,far:400,min:1,max:30},
  look:{env:'studio',envIntensity:.5,exposure:.98,bloom:.36,threshold:2,ao:.12,dof:true},update(){}};
}
