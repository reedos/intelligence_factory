// Vera Rubin tray: representative dimensions and cold-plate separation, informed
// by NVIDIA's public Figure18. Two service bays, four GPUs/two CPUs, no fans or hoses.
import { THREE, MAT, Builder, flow, canvasTex, texMat } from '../kit.js';
import { rbox } from '../fx.js';
import { componentView } from '../app/housing-frame.js';
import { computeMaterials, finishCompute, boardFinish } from './compute-finish.js';
import { etch } from './package-marks.js';
import { tagHeat, balanceHeat, PART_W } from '../heat.js';
import { FABRICS } from '../model/engine.ts';
export function buildRubin({quality,model}, {lights,pkgTex,dieTex,nvConnector,trayLidLabels}) {
 const scene=new THREE.Scene();lights(scene,quality);
 const S=new Builder(),N=new Builder(),flows=[],dataFlows=[],heatFlows=[],finish=computeMaterials();
 const gp=[[-1.60,-2.7],[-.62,-2.7],[.62,-2.7],[1.60,-2.7]],cp=[[-1.1,-.65],[1.1,-.65]];
 const nic=[[-1.35,2.85],[1.35,2.85]],dpu=[0,2.85];
 // Full-length open chassis, midplane and independently serviceable bay floors.
 S.box(4.4,.035,9,MAT.galv,0,.0175,0);
 for(const x of [-2.2,2.2])S.box(.035,.44,9,MAT.galv,x,.22,0);
 // Midplane: blind-mate connector housings on both faces instead of one solid
 // bar. Housing count and pin rows are representative; the PCIe runs cross
 // through the housing pairs at x = +/-.795 and +/-1.325.
 S.box(4.32,.05,.16,MAT.darkSteel,0,.06,1.1);
 for(let i=0;i<8;i++){const x=-1.855+i*.53;
  for(const zf of [.955,1.245]){S.box(.40,.2,.13,MAT.black,x,.19,zf);for(let r=0;r<2;r++)N.box(.34,.014,.008,MAT.gold,x,.15+r*.06,zf+(zf<1.1?-.066:.066));}
  for(const sx of [-1,1])N.cyl(.012,.06,MAT.nickel,x+sx*.215,.19,1.1,8,Math.PI/2);}
 const midplane=new THREE.Mesh(new THREE.BoxGeometry(4.1,.24,.04),MAT.pcbBlack);midplane.name='Rubin PCIe Gen6 midplane';midplane.position.set(0,.23,1.12);scene.add(midplane);
 for(const x of [-1.1,1.1]){S.box(2.02,.025,4.9,MAT.pcb,x,.075,-1.52);boardFinish(N,finish,x,.087,-1.52,2.02,4.9);}
 const top=texMat(dieTex(),{rough:.22,metal:.3}),labels=new Map();
 // One material per label: the eight ConnectX-9 packages share one texture.
 const labelMat=label=>{if(!labels.has(label))labels.set(label,texMat(pkgTex(label),{rough:.4}));return labels.get(label);};
 const packageAt=(name,x,z,w,d,label,lid,interposer)=>{
  N.box(w*.92,.024,d*.92,MAT.black,x,.1,z);                                   // ball field / socket under the substrate
  S.box(w,.055,d,MAT.pcbBlack,x,.14,z);
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w*.85,.025,d*.80),[MAT.silicon,MAT.silicon,label?labelMat(label):interposer?MAT.silicon:top,MAT.silicon,MAT.silicon,MAT.silicon]);
  mesh.name=name;mesh.position.set(x,.185,z);scene.add(mesh);
  if(lid)S.box(w*.46,.014,d*.44,MAT.nickel,x+w*.12,.205,z-d*.1);    // small stiffener lid; the label corner stays visible
 };
 // Representative VRM row: inductors with bright caps and power stages beside them.
 // skip: inductor slots left open as routing channels (tray-pcb.js rubinLayout), so no bus runs under a regulator
 const vrmRow=(x0,z,n,pitch,inward,skip=[])=>{for(let k=0;k<n;k++){if(skip.includes(k))continue;const x=x0+k*pitch;S.box(.1,.07,.09,MAT.inductor,x,.124,z);N.box(.072,.012,.065,MAT.alu,x,.163,z);N.box(.06,.012,.05,MAT.black,x,.094,z+inward*.085);}};
 const capRing=(x,z,w,d,open=()=>false)=>{for(let k=0;k<8;k++){const u=-w/2+(k+.5)*w/8;for(const s of [-1,1])if(!open(u,s))N.box(.018,.014,.012,MAT.beige,x+u,.095,z+s*d/2);}};
 // Channels, mirrored left to right: each GPU's NVLink leaves its rear edge on the centerline; its C2C enters the front
 // edge on the side facing its CPU; each CPU's C2C and PCIe leave through gaps 0.12 either side of its centerline.
 const c2cSide=x=>Math.sign((x<0?-1.1:1.1)-x);
 const gpuSkip=x=>({rear:[3],front:[c2cSide(x)>0?5:1]}),gpuCapOpen=x=>(u,s)=>(s<0&&Math.abs(u)<.1)||(s>0&&Math.abs(u-c2cSide(x)*.24)<.12);
 // Rubin GPU: two reticle-size compute dies side by side on the interposer,
 // four HBM4 stacks along each long edge (die size and spacing representative).
 gp.forEach(([x,z],i)=>{packageAt(`Rubin GPU ${i+1}`,x,z,.83,.95,null,false,true);
  for(const dx of [-.105,.105]){const die=new THREE.Mesh(new THREE.BoxGeometry(.19,.02,.66),[MAT.silicon,MAT.silicon,top,MAT.silicon,MAT.silicon,MAT.silicon]);die.name=`Rubin GPU ${i+1} compute die`;die.position.set(x+dx,.2075,z);scene.add(die);}for(const dx of [-.29,.29])for(const dz of [-.32,-.11,.11,.32]){N.box(.13,.05,.13,MAT.hbm,x+dx,.21,z+dz);}
  vrmRow(x-.36,z-.66,7,.12,1,gpuSkip(x).rear);vrmRow(x-.36,z+.66,7,.12,-1,gpuSkip(x).front);capRing(x,z,.9,1.08,gpuCapOpen(x));});
 cp.forEach(([x,z],i)=>{
  packageAt(`Vera CPU ${i+1}`,x,z,.75,.77,'VERA',true);
  vrmRow(x-.24,z-.52,5,.12,1,[1,3]);vrmRow(x-.24,z+.52,5,.12,-1,[1,3]);
  // SOCAMM LPDDR5X: flat compression-attached modules, each held by three
  // captive screws (representative placement of packages and screws).
  for(const side of [-1,1]){const mx=x+side*.64;
   N.box(.24,.03,.98,MAT.black,mx,.103,z);S.box(.30,.02,1.05,MAT.pcb,mx,.129,z);
   for(let k=0;k<4;k++){S.box(.22,.04,.17,MAT.black,mx,.16,z-.33+k*.22);N.box(.16,.004,.12,MAT.hbm,mx,.181,z-.33+k*.22);}
   for(const [sx,sz] of [[-.09,-.49],[.09,-.49],[0,.49]]){N.cyl(.026,.02,MAT.nickel,mx+sx,.15,z+sz,14);N.box(.03,.003,.006,MAT.black,mx+sx,.1605,z+sz);}}
 });
 // Quad-SuperNIC boards are represented by two service assemblies, with the
 // published aggregate GPU connectivity. Fine pin/trace routing is illustrative.
 nic.forEach(([x,z],i)=>{S.box(1.35,.035,2.15,MAT.pcb,x,.105,z);boardFinish(N,finish,x,.124,z,1.35,2.15);for (const dx of [-.3,.3]) for (const dz of [-.47,.47]) packageAt(`ConnectX-9 ${i*4+(dx<0?0:2)+(dz<0?1:2)}`,x+dx,z+dz,.40,.52,'ConnectX-9',true);});
 S.box(.85,.035,2.15,MAT.pcb,0,.105,2.85);boardFinish(N,finish,0,.124,2.85,.85,2.15);packageAt('BlueField-4 DPU',0,2.85,.66,.75,'BlueField-4',true);
 // Power board and exposed supply clip are representative, not a wiring drawing.
 S.box(4.1,.035,.58,MAT.pcbBlack,0,.095,-4.05);
 // Two bus converters, each between its board's two NVLink lanes and over the 12 V bar it feeds (no lane passes a
 // converter closer than 16 mm); the connectors sit straight behind the GPUs.
 const ibcX=[-1.11,1.11];
 for(const x of ibcX){S.box(.65,.12,.42,MAT.nickel,x,.2,-3.98);for(let i=0;i<4;i++)N.box(.08,.08,.16,MAT.inductor,x-.19+i*.125,.29,-3.98);}
 for(const x of [-.09,-.03,.03,.09])S.box(.045,.23,.26,MAT.copper,x,.18,-4.53);
 for(const x of [-1.1,1.1])S.box(.11,.028,4.5,MAT.copper,x,.102,-1.7);
 // Lifted cold plates reveal packages. Internal rigid liquid manifold is shown
 // at its top surface; colored motion is a schematic view of enclosed channels.
 const cooled=[...gp.map(p=>[...p,.88,1.0]),...cp.map(p=>[...p,.80,.85]),...nic.map(p=>[...p,1.08,1.65]),[...dpu,.76,1.65]];
 // Heat per plate: GPU and CPU from the accelerator table; the tray's share of the rack's NIC/DPU power split
 // over four SuperNICs per NIC board and one DPU, counted as two NICs (an assumption: heat-visual-scale).
 const A=model.accel,nicTrayW=A.nicKW*1000/18,nicW=nicTrayW*4/10,dpuW=nicTrayW*2/10;
 const plateW=[...gp.map((_,i)=>[`gpu-${i}`,A.gpuW]),...cp.map((_,i)=>[`cpu-${i}`,A.cpuW]),...nic.map((_,i)=>[`nic-board-${i}`,nicW]),['dpu',dpuW]];
 const deviceW=new Map(cooled.map((c,i)=>[c,plateW[i][1]]));
 // Each plate: a chamfered copper base, a dark seal line, a nickel-plated cap,
 // brazed inlet/outlet blocks on the manifold side and four sprung captive
 // screws. Plate shape and fastening are representative, not a drawing.
 for(const [ci,[x,z,w,d]] of cooled.entries()){
  rbox(S,w,.045,d,MAT.copper,x,.665,z,{r:.14});
  N.box(w*.93,.008,d*.93,finish.recess,x,.692,z);
  rbox(S,w*.86,.034,d*.86,MAT.nickel,x,.712,z,{r:.22});
  for(const sz of [-1,1])S.box(.13,.07,.07,MAT.nickel,x,.69,z+sz*(d*.5+.03));
  for(const sx of [-1,1])for(const sz of [-1,1]){const px=x+sx*w*.38,pz=z+sz*d*.38;
   N.cyl(.02,.05,MAT.darkSteel,px,.745,pz,10);for(const dy of [.732,.752])N.cyl(.027,.005,MAT.galv,px,dy,pz,10);
   N.cyl(.031,.014,MAT.nickel,px,.772,pz,12);N.box(.036,.002,.006,MAT.black,px,.7805,pz);}
  heatFlows.push(tagHeat(flow([[x,.22,z],[x,.77,z]],'hot',{count:4,speed:.4,size:.028,trail:false}),...plateW[ci]));
 }
 for(const [side,x] of [[-1,-2.02],[1,2.02]]){
  S.cylZ(.062,8.55,MAT.nickel,x,.662,-.05,24);S.box(.05,.09,8.4,MAT.nickel,x,.585,-.05);
  for(const z of [-3.9,-2.3,-.3,1.6,3.3])S.box(.16,.05,.1,MAT.darkSteel,x+side*.08,.56,z);
  const path=[[x,.825,-4.55],[x,.825,4.20]];if(side===1)path.reverse();
  flows.push(flow(path,side===-1?'cool':'warm',{count:20,speed:.8,size:.022,k:1.5,trail:false}));
  heatFlows.push(tagHeat(flow(path,side===-1?'cool':'warm',{count:26,speed:.8,size:.040,trailR:.015}),'manifold',plateW.reduce((a,p)=>a+p[1],0),'carrier'));
  S.cylZ(.075,.1,MAT.nickel,x,.662,-4.34,24);S.cylZ(.05,.14,MAT.darkSteel,x,.662,-4.45,16);
 }
 // No flexible internal hoses. Flush rigid branches are grouped under the
 // plates and annotated as representative channels, not external tubing.
 const rigid=(a,b)=>{S.strut([a[0],.69,a[1]],[b[0],.69,b[1]],.028,MAT.nickel,12);for(const p of [a,b])S.box(.07,.07,.07,MAT.nickel,p[0],.69,p[1]);};
 for(const [z,zSupply,zReturn] of [[-2.7,-3.45,-1.95],[-.65,-1.32,.05],[2.85,1.75,3.95]]) {
  const devices=cooled.filter(p=>p[1]===z),lo=Math.min(...devices.map(p=>p[0])),hi=Math.max(...devices.map(p=>p[0]));
  rigid([-2.02,zSupply],[hi,zSupply]);rigid([lo,zReturn],[2.02,zReturn]);
  const rowW=devices.reduce((a,c)=>a+deviceW.get(c),0);
  heatFlows.push(tagHeat(flow([[-2.02,.825,zSupply],[hi,.825,zSupply]],'cool',{count:8,speed:.65,size:.022,trail:false}),`row-${z}`,rowW,'carrier'));
  heatFlows.push(tagHeat(flow([[lo,.825,zReturn],[2.02,.825,zReturn]],'warm',{count:8,speed:.65,size:.022,trail:false}),`row-${z}`,rowW,'carrier'));
  for(const c of devices){const [x,,w,d]=c;
   rigid([x,zSupply],[x,z-d*.48]);rigid([x,z+d*.48],[x,zReturn]);
   heatFlows.push(tagHeat(flow([[x,.825,zSupply],[x,.825,z-d*.48]],'cool',{count:3,speed:.5,size:.022,trail:false}),`branch-${x}-${z}`,deviceW.get(c),'carrier'));
   heatFlows.push(tagHeat(flow([[x,.825,z+d*.48],[x,.825,zReturn]],'warm',{count:3,speed:.5,size:.022,trail:false}),`branch-${x}-${z}`,deviceW.get(c),'carrier'));
  }
 }
 balanceHeat(heatFlows);
 // Spine connectors remain at the back; eight front 800G port positions are
 // represented as four pairs so each GPU has 1.6T of scale-out capacity.
 // Routed runs: straight legs joined by short bends (45-degree jogs, a dip
 // into the midplane connector pair), read as board routing rather than a wave.
 const routed=(pts,r=.04)=>{const V=pts.map(p=>new THREE.Vector3(...p)),out=[pts[0]];
  for(let i=1;i<V.length-1;i++){const a=V[i-1],b=V[i],c=V[i+1],d1=b.clone().sub(a),d2=c.clone().sub(b),rr=Math.min(r,d1.length()/2,d2.length()/2);
   const p0=b.clone().addScaledVector(d1.normalize(),-rr),p1=b.clone().addScaledVector(d2.normalize(),rr);
   for(let k=0;k<=6;k++){const t=k/6;out.push(p0.clone().multiplyScalar((1-t)**2).addScaledVector(b,2*t*(1-t)).addScaledVector(p1,t*t).toArray());}}
  out.push(pts[pts.length-1]);return out;};
 const nvX=gp.map(([x])=>x),ports=[-1.66,-1.04,1.04,1.66];
 for(const x of nvX)nvConnector(S,N,x,.18,-4.35,.5,.22,.26);
 // A module seated in every cage: its nose stands 10 mm proud of the mouth, inside the extraction bail,
 // with its MPO receptacle on the face and the lid label on the exposed top (lid-labels.js).
 const lidAt=[];
 for(const x of ports)for(const y of [.16,.34]){
  S.box(.29,.13,.46,MAT.galv,x,y,4.21);N.box(.25,.085,.015,MAT.black,x,y,4.455);
  N.box(.19,.08,.12,MAT.nickel,x,y,4.50);N.box(.14,.045,.006,MAT.polymer,x,y,4.563);
  lidAt.push({p:[x,y+.04,4.515],face:'top',yaw:0});
 }
 // Small service IO remains visibly distinct from optical ports.
 for(const x of [-.28,-.10,.10,.28]){S.box(.12,.08,.10,MAT.darkSteel,x,.16,4.35);N.box(.09,.05,.018,MAT.black,x,.16,4.41);}
 gp.forEach(([x,z],i)=>{
 // 12 V ends at the rear VRM row (not on the package); core power runs from
 // both VRM rows into the substrate edge, below the die and HBM tops.
  // 12 V off its board's bar, straight across into the end inductor of the GPU's rear regulator row
  {const bar=x<0?-1.1:1.1,end=x+Math.sign(bar-x)*.36;
   flows.push(flow([[bar,.102,z-.66],[end,.124,z-.66]],'bus12',{count:6,speed:.8,size:.028,trailR:.009,audit:{within:[[bar-.055,.088,-3.95,bar+.055,.116,.55]],why:'out of the 12 V bar it is drawn from'}}));}
  for(const side of [-1,1])for(const dx of [-.2,.2])flows.push(flow([[x+dx,.125,z+side*.6],[x+dx,.125,z+side*.4]],'core',{count:3,speed:.35,size:.018,trail:false}));
  // NVLink: out of the package's rear edge on an inner layer, up a via just outside it, then straight back on the top
  // layer through the channel in the rear regulator row into the connector directly behind (tray-pcb.js rubinLayout).
  // Every GPU the same; short, direct, mirror-symmetric.
  dataFlows.push(flow([[x,.075,z-.3],[x,.075,z-.56],[x,.125,z-.56],[x,.125,-4.3]],'nvl',
   {count:10,speed:.9,size:.026,trailR:.009,audit:{within:[[-2.2,.06,-3.97,2.2,.088,.93]],why:'escape on an inner layer under the package edge, up a via to the top layer'}}));
  // NVIDIA SuperPOD RA Figure 2: NIC PCIe is rooted at Vera, not a
  // direct GPU-to-NIC trace. Each CPU serves its four CX9 endpoints.
  const cpu=cp[Math.floor(i/2)];
  // The crossing goes through a blind-mate connector pair (the housing
  // nearest the lane, inward), so the run enters one housing and leaves the
  // other rather than hopping over the midplane.
  const lane=ports[i],hx=Math.sign(lane)*(Math.abs(lane)<1.3?.795:1.325),j1=Math.abs(hx-cpu[0]),j2=Math.abs(lane-hx);
  // On the board it follows the CPU's PCIe bus (tray-pcb.js: out of the front edge 0.12 off the CPU centerline, up a via,
  // through the gap in the front regulator row, one jog to the midplane connector column), then crosses the midplane
  // inside its connector pair.
  const bus=cpu[0]+Math.sign(hx-cpu[0])*.12;
  const route=[[cpu[0],.075,cpu[1]+.385],[bus,.075,cpu[1]+.33],[bus,.075,cpu[1]+.47],[bus,.125,cpu[1]+.47],[bus,.125,0],[hx,.125,.2],[hx,.125,.82],[hx,.19,.9],[hx,.19,1.38],[lane,.19,1.38+j2],[lane,.19,1.85],[lane,.15,2.14]];
  const input=flow(routed(route),'pcie',{count:10,speed:.9,size:.026,trailR:.009,audit:{within:[[-2.2,.06,-3.97,2.2,.088,.93],[hx-.2,.08,.88,hx+.2,.3,1.32]],
   why:'escape on an inner layer under the CPU package edge; through the blind-mate connector pair and the midplane between them'}});input.rubinPcieRoot=Math.floor(i/2);dataFlows.push(input);
  // Each GPU is represented by two CX9 packages on one column. The branch
  // placement is illustrative; both ends touch actual package regions.
  const flank=lane+(i%2===0?-.23:.23);
  // on the NIC board, beside its packages (not 17 mm above them)
  const yN=.137;
  dataFlows.push(flow([[lane,.15,2.14],[lane,yN,1.85],[flank,yN,1.85],[flank,yN,3.06],[lane,.15,3.08]],'pcie',{count:5,speed:.9,size:.02,trail:false}));
  for(const [j,y]of [.16,.34].entries()){
   const start=j===0?2.64:3.58;
   const path=j===0?[[lane,.15,start-.02],[flank,yN,start+.04],[flank,yN,3.78],[lane,y,3.95],[lane,y,4.50]]:[[lane,.2,start],[lane,y,3.95],[lane,y,4.50]];
   const f=flow(path,'serdes',{count:5,speed:.75,size:.02,trail:false,audit:{within:[[lane-.15,y-.07,3.97,lane+.15,y+.07,4.57]],why:'into the cage and the module it holds'}});f.rubinNicOutput={gpu:i,nic:j,startZ:start};dataFlows.push(f);
  }
 });
 // C2C along the board's C2C buses (tray-pcb.js): out of the CPU's rear edge through the gap in its rear regulator row,
 // one diagonal on the top layer, in through the gap in the GPU's front row on the side facing the CPU; vias only at the
 // two package edges. One lane each way within the bus; the two GPUs of a CPU mirror each other.
 cp.forEach(([x,z],i)=>{for(const gpu of gp.slice(i*2,i*2+2))for(const reverse of [false,true]){
  const a=Math.sign(gpu[0]-x)*.12,b=-Math.sign(gpu[0]-x)*.24,o=reverse?.02:-.02;
  const pts=[[x+a+o,.075,z-.3],[x+a+o,.075,z-.47],[x+a+o,.125,z-.47],[x+a+o,.125,-1.3],[gpu[0]+b+o,.125,-1.9],[gpu[0]+b+o,.125,-2.1],[gpu[0]+b+o,.075,-2.1],[gpu[0]+b+o,.075,gpu[1]+.25]];if(reverse)pts.reverse();
  dataFlows.push(flow(pts,'c2c',{count:5,speed:.6,size:.022,trailR:.008,audit:{within:[[-2.2,.06,-3.97,2.2,.088,.93]],why:'escape on an inner layer under each package edge'}}));}});
 dataFlows.push(flow([[0,.28,3.3],[0,.28,4.38]],'serdes',{count:5,speed:.6,size:.024,trail:false}));
 // dc from the supply clip: between its copper plates, then sideways into the nearest converter's flank
 for(const s of [-1,1])flows.push(flow([[0,.2,-4.75],[0,.2,-4.3],[0,.125,-4.05],[s*.76,.125,-4.05],[s*.8,.2,-3.98]],'dc',{count:12,speed:.9,size:.03,trail:false,audit:{external:'start',why:'from the rack busbar behind the tray'}}));
 // 12 V trunks: out of the outer converters onto the copper bars, inside the bars forward to each CPU's rear regulator row
 for(const x of [-1.1,1.1])flows.push(flow([[Math.sign(x)*1.11,.2,-3.98],[x,.102,-3.9],[x,.102,-1.17]],'bus12',
  {count:14,speed:.7,size:.025,trail:false,audit:{within:[[x-.055,.088,-3.95,x+.055,.116,.55],[x-.34,.13,-4.2,x+.34,.27,-3.76]],why:'out of the converter, down into the 12 V copper bar under it, forward inside it'}}));
 for(const [x,z] of [...nic,dpu])flows.push(flow([[x,.18,1.45],[x,.18,z]],'bus12',{count:8,speed:.8,size:.022,trail:false}));
 scene.add(S.build(),N.build({cast:false}));trayLidLabels(scene,model.accel,lidAt,[.165,.07]);for(const list of [flows,dataFlows,heatFlows])for(const f of list)scene.add(f.group);
 const hs=(p,off=[2.2,2.8,3.5])=>({pos:p,view:{pos:p.map((v,i)=>v+off[i]),target:p}});
 const hotspots={osfp:hs([-1.35,.5,4.25]),clip:hs([0,.45,-4.5],[2.4,2,-3]),ibc:hs([-1.11,.45,-3.98]),vrm:hs([1.6,.2,-2.04],[-.5,1.9,2.4]),gpu:{pos:[1.6,.3,-2.7],view:componentView([1.6,.16,-2.7],[-.25,.4,1.3],[.6,.2,.6])},grace:hs([-1.1,.32,-.65]),lpddr:hs([1.74,.3,-.65],[0,2.1,.5]),coldplates:hs([-1.1,.82,-.65]),nic:hs([1.35,.8,2.85]),nvconn:hs([1.6,.4,-4.35],[2,2,-3])};
 // The power layer's glow (src/power-glow.js), on the heat layer's watts: GPUs and their regulator rows, Vera with its
 // rows and LPDDR5X, the ConnectX-9s and the DPU (the tray's NIC power as the cold plates split it), the bus
 // converters' loss and each module's fabric allowance.
 const PD=[],lp=PART_W.superchip.lpddr,loss=w=>w*(1/A.vrmEff-1);
 gp.forEach(([x,z],i)=>{PD.push({id:`gpu-${i}`,part:'gpu',watts:A.gpuW,volt:'core',at:[x,.09,z],size:[.83,.95]});
  for(const s of [-1,1])PD.push({id:`vrm-${i}-${s}`,part:'vrm',watts:loss(A.gpuW)/2,at:[x,.09,z+s*.66],size:[.82,.18]});});
 cp.forEach(([x,z],i)=>{PD.push({id:`cpu-${i}`,part:'grace',watts:A.cpuW-8*lp,volt:'core',at:[x,.09,z],size:[.75,.77]});
  for(const s of [-1,1])PD.push({id:`cpu-vrm-${i}-${s}`,part:'vrm',watts:loss(A.cpuW)/2,at:[x,.09,z+s*.52],size:[.58,.18]});
  for(const side of [-1,1])for(let k=0;k<4;k++)PD.push({id:`lpddr-${i}-${side}-${k}`,part:'lpddr',watts:lp,at:[x+side*.64,.141,z-.33+k*.22],size:[.22,.17]});});
 nic.forEach(([x,z],i)=>{for(const dx of [-.3,.3])for(const dz of [-.47,.47])PD.push({id:`cx9-${i}-${dx}-${dz}`,part:'nic',watts:nicW/4,at:[x+dx,.124,z+dz],size:[.4,.52]});});
 PD.push({id:'dpu',part:'nic',watts:dpuW,at:[0,.124,2.85],size:[.66,.75]});
 ibcX.forEach((x,i)=>PD.push({id:`ibc-${i}`,part:'ibc',watts:model.rack.ibcLossKW*1000/18/ibcX.length,at:[x,.114,-3.98],size:[.65,.42]}));
 for(const x of ports)for(const y of [.16,.34])PD.push({id:`osfp-${x}-${y}`,part:'osfp',watts:FABRICS[A.nicPortGbps].gpuModuleW,volt:'v33',at:[x,y-.063,4.21],size:[.29,.46]});
 finishCompute(scene,finish);
 scene.userData.computeGeneration={id:'rubin',gpus:4,cpus:2,fans:0,internalHoses:0,midplane:true,nicAssemblies:2,nicCount:8,dpuCount:1,opticalPorts:8,representative:true};
 // the GPU name etched on each package's front substrate margin, ahead of the interposer (package-marks.js)
 return {printSpots:[etch('GPU package marking','Rubin',[.3,.065],gp.map(([x,z])=>({from:[x,.4,z+.43],dir:[0,-1,0]})))],scene,flows,dataFlows,heatFlows,hotspots,powerDraw:PD,
  heatHotspots:{osfp:hotspots.osfp,coldplates:hotspots.coldplates,gpuheat:hotspots.gpu,manifold:hs([-2.02,.8,0]),qd:hs([2.02,.8,-4.48],[2,2,-3])},
  // tools/flows.mjs: NVLink and C2C stay over a board (the two compute boards and the power board)
  flowAudit:{floatR:.25,boardCls:['nvl','c2c'],boards:[[-2.11,-.09,-3.97,.93],[.09,2.11,-3.97,.93],[-2.05,2.05,-4.34,-3.76]]},
  dataHotspots:{nvconn:hotspots.nvconn,c2c:hs([-1.1,.4,-1.5]),cx:hotspots.nic,osfp:hotspots.osfp,dpu:hs([0,.8,2.85]),gpu:hotspots.gpu},
  camera:{pos:[5.9,6.4,8.3],target:[0,.2,-.5],near:.02,far:400,min:1,max:30},
  look:{env:'studio',envIntensity:.5,exposure:.98,bloom:.36,threshold:2,ao:.12,dof:true},update(){}};
}
