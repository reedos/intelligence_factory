// Side level: inside an 800ZR coherent pluggable (OSFP). World unit = 1 cm.
// Representative discrete board-level architecture: the driver and TIA each have
// their own closed electronic package, separate from the two optical assemblies.
// This is an explicit design assumption, not a teardown of a shipping 800ZR.
// OSFP footprint and nano-ITLA envelope are dimensioned; other dimensions and RF
// routing are schematic. Optical signals never enter the electronic packages.
// Order along the board follows the OIF packaging agreements (HB-CDM, micro-ICR,
// IC-TROSA): each optical assembly takes its RF signals at the end facing the DSP
// and its fibers at the opposite end, so the DSP, then the driver and TIA, then
// the optics sit in a line with short electrical paths. The laser sits toward the
// fiber end, off the RF path, and its pigtail runs back to the splitter.
import { THREE, MAT, Builder, flow, canvasTex, setup, materials, die, strand, label, lidBox, FLOW, COL, note, unitCol, dspTex, glowMat } from './side-kit.js';
import { componentView } from '../app/housing-frame.js';
import { tagHeat, balanceHeat, heatWeight, PART_W } from '../heat.js';
import { drawDiagram } from './face-diagram.js';
import { iqDiagram, icrDiagram } from './coherent-faces.js';

// The IQ modulator and the coherent receiver seen from above, drawn from checked block diagrams
// (coherent-faces.js): RF pads at the left edge, facing the driver or TIA, both fibers on the far end (OIF HB-CDM,
// micro-ICR), every waveguide entering its component at a port, and the crossings a planar layout cannot avoid marked.
export const iqTex = () => { const d = iqDiagram(); return canvasTex(d.w, d.h, g => drawDiagram(g, d)); };
export const icrTex = () => { const d = icrDiagram(); return canvasTex(d.w, d.h, g => drawDiagram(g, d)); };

// A visible package marking makes these closed, discrete electronics unmistakable.
export function analogTex(name) {
  return canvasTex(256,256,(g,w,h)=>{
    g.fillStyle='#111a22';g.fillRect(0,0,w,h);
    g.fillStyle='#d6dce3';g.font='600 40px system-ui';g.textAlign='center';g.fillText(name,w/2,118);
    g.font='20px system-ui';g.fillText('DISCRETE IC',w/2,154);
    g.fillStyle='#b7a57c';g.beginPath();g.arc(24,24,6,0,Math.PI*2);g.fill();
  });
}

export function build({ quality, state, authoredHardware = false }) {
  const scene = setup(quality, 9), M = materials();
  const S = new Builder(), N = new Builder();
  const flows = [], dataFlows = [], heatFlows = [];
  const LEN = 10.78, MW = 2.258, MX0 = -LEN / 2, MX1 = LEN / 2, mx = u => MX0 + u;
  const Y = { shell: 0, pcb: 1.3, top: 1.35, lid: 3.4 };
  const shellEdge = new THREE.MeshStandardMaterial({ color: 0x81909e, metalness: 0.8, roughness: 0.3 });
  const laminate = new THREE.MeshStandardMaterial({ color: 0x465a3f, roughness: 0.7, metalness: 0.05 });
  const engraving = new THREE.MeshStandardMaterial({ color: 0x25313d, roughness: 0.55, metalness: 0.4, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const lidDetail = new THREE.MeshStandardMaterial({ color: 0xa3b1bf, metalness: 0.7, roughness: 0.4, transparent: true, opacity: 0.22, depthWrite: false });
  if (!authoredHardware) {
  S.box(LEN, 0.12, MW, MAT.darkSteel, 0, Y.shell, 0);
  S.box(LEN, 0.55, 0.1, MAT.darkSteel, 0, Y.shell + 0.3, -MW / 2 + 0.05);
  S.box(LEN, 0.55, 0.1, MAT.darkSteel, 0, Y.shell + 0.3, MW / 2 - 0.05);
  for (const z of [-MW / 2 + 0.05, MW / 2 - 0.05]) N.box(LEN - 0.12, 0.035, 0.055, shellEdge, 0, Y.shell + 0.57, z);
  }
  S.box(LEN - 0.9, 0.1, MW - 0.24, MAT.pcb, (MX0 + MX1 - 0.9) / 2 + 0.05, Y.pcb, 0);
  for (const z of [-(MW - 0.24) / 2, (MW - 0.24) / 2]) N.box(LEN - 0.92, 0.025, 0.008, laminate, -0.4, Y.pcb, z);
  // 60-contact card edge, 30 pads a side. Sequenced mating: ground pads reach
  // closest to the leading edge, then power, then signal (OSFP MSA Rev 5.0
  // sec. 3.5); pads 15/16 and 45/46 are the wider power pads. The ground and
  // signal order between them is representative, not the MSA pinout.
  const trail = mx(0.33) + 0.275;
  for (let i = 0; i < 30; i++) {
    if (i === 15) continue;                                  // joined into the 15/16 power pad
    const power = i === 14, ground = !power && i % 3 === 0;
    const lead = mx(0.055) + (ground ? 0 : power ? 0.025 : 0.05), len = trail - lead;
    const z = -0.95 + i * 0.066 + (power ? 0.033 : 0), w = power ? 0.111 : 0.045;
    N.box(len, 0.012, w, MAT.gold, lead + len / 2, Y.top + 0.006, z); N.box(len, 0.012, w, MAT.gold, lead + len / 2, Y.pcb - 0.056, z);
  }
  for (let i = 0; i < 4; i++) S.box(0.34, 0.22, 0.34, MAT.inductor, mx(1.35 + (i % 2) * 0.48), Y.top + 0.11, i < 2 ? -0.22 : 0.22);
  // the coherent DSP
  const DSPX = mx(3.09), DH = 0.85;
  S.box(1.7, 0.1, 1.7, MAT.pcbBlack, DSPX, Y.top + 0.05, 0);
  const dspTop = die(scene, M, 1.15, 0.06, 1.15, dspTex(), DSPX, Y.top + 0.13, 0);
  // Names travel into the Blender reference export (userData.sourceMesh).
  const named = name => { scene.children.at(-1).name = name; };
  named('Coherent DSP die');
  // the tunable laser, to its published size, toward the fiber end and off the
  // DSP-to-analog path; its pigtail leaves the host-facing end toward the splitter
  const ITX = 3.15, ITL = 2.5, ITW = 1.56, ITH = 0.65;
  if (!authoredHardware) {
  S.box(ITL, ITH - 0.07, ITW, MAT.nickel, ITX, Y.top + (ITH - 0.07) / 2, 0);
  S.box(ITL - 0.02, 0.014, ITW - 0.02, MAT.darkSteel, ITX, Y.top + ITH - 0.063, 0);
  S.box(ITL, 0.056, ITW, MAT.nickel, ITX, Y.top + ITH - 0.028, 0);
  // Flush seam and recessed fasteners remain within the published laser envelope.
  for (const x of [ITX - ITL / 2 + 0.14, ITX + ITL / 2 - 0.14]) for (const z of [-ITW / 2 + 0.14, ITW / 2 - 0.14]) {
    N.cyl(0.046, 0.008, engraving, x, Y.top + ITH - 0.004, z, 10);
    N.box(0.054, 0.003, 0.013, shellEdge, x, Y.top + ITH - 0.0015, z);
  }
  }
  const itOut = [ITX - ITL / 2, Y.top + 0.33, 0];
  // A fused tap (about 1 x 1 x 3 mm, on a mount in the Blender asset) splits the
  // laser's light between the transmit carrier and the receiver's local oscillator.
  // It sits at pigtail height, so the pigtail runs straight in with no bend.
  const tap = [1.15, Y.top + 0.33, 0];
  S.box(0.3, 0.1, 0.1, M.glass, tap[0], tap[1], 0);
  // Two-by-two board layout: closed electronic packages beside the DSP's
  // line-side edge, distinct optical assemblies right after them, fibers out of
  // the far end. No shared substrate or lid.
  const CX0=-.3, CL=1.10, CX_=CX0+CL/2, cdmZ=-.55;
  const RX0=-.3, RL=1.10, RX_=RX0+RL/2, icrZ=.55;
  const DRX=-.85, TIAX=-.85, drvZ=cdmZ, tiaZ=icrZ, EW=.55;
  if (!authoredHardware) {
    for(const [x,z,l,w] of [[CX_,cdmZ,1.18,.72],[DRX,drvZ,.61,.61],
      [RX_,icrZ,1.18,.72],[TIAX,tiaZ,.61,.61]])
      S.box(l,.05,w,MAT.pcbBlack,x,Y.top+.025,z);
  }
  die(scene,M,CL,.06,.66,iqTex(),CX_,Y.top+.08,cdmZ); named('Coherent IQ modulator die');
  die(scene,M,RL,.06,.66,icrTex(),RX_,Y.top+.08,icrZ); named('Coherent receiver die');
  die(scene,M,EW,.18,EW,analogTex('DRIVER'),DRX,Y.top+.14,drvZ,0,{metalness:.08,roughness:.54}); named('Coherent driver package');
  die(scene,M,EW,.18,EW,analogTex('TIA'),TIAX,Y.top+.14,tiaZ,0,{metalness:.08,roughness:.54}); named('Coherent TIA package');
  const driverBonds=[],tiaBonds=[],driverInputs=[],tiaOutputs=[];
  const portY=Y.top+.055, boardY=Y.top+.004;
  const bridge=(x0,x1,z)=>[[x0,portY,z],[x0+(x1-x0)*.3,boardY,z],
    [x0+(x1-x0)*.7,boardY,z],[x1,portY,z]];
  for(let k=0;k<4;k++) {
    const off=(58+k*46)/256*.66-.33, dz=drvZ+off, rz=tiaZ+off;
    const db=bridge(DRX+EW/2,CX0,dz),tb=bridge(RX0,TIAX+EW/2,rz);
    const di=bridge(DRX-EW/2-.05,DRX-EW/2,dz),to=bridge(TIAX-EW/2,TIAX-EW/2-.05,rz);
    driverBonds.push(db);tiaBonds.push(tb);driverInputs.push(di);tiaOutputs.push(to);
    for(const path of [db,tb,di,to]) for(const d of [-.006,.006])
      strand(N,path.map(p=>[p[0],p[1],p[2]+d]),MAT.copper,.002,4);
    // Flat gold lands on the carrier at each bond foot, reaching away from
    // the package or die edge they serve (no cubes stuck to package sides).
    for(const [x,z,out] of [[DRX-EW/2,dz,-1],[DRX+EW/2,dz,1],[TIAX-EW/2,rz,-1],[TIAX+EW/2,rz,1],[CX0,dz,-1],[RX0,rz,-1]])
      N.box(.06,.006,.034,MAT.gold,x+out*.03,Y.top+.053,z);
  }
  // Every fiber port is on the optics' far (fiber) end, x = CX0 + CL: the
  // carrier in and modulated light out of the modulator; the signal and the
  // local oscillator into the receiver. Offsets match iqTex() and icrTex().
  const OPT=CX0+CL;
  // A point on a die face given in its drawing's canvas pixels (x along the die from its RF end, y toward +z).
  const face=(x0,len,z0,cw,px,py,lift=.12)=>[x0+px/cw*len,Y.top+lift,z0-.33+py/256*.66];
  const cdmIn=[OPT,Y.top+.1,cdmZ+.33-14/256*.66],cdmOut=[OPT,Y.top+.1,cdmZ];
  const icrSig=[OPT,Y.top+.1,icrZ],icrLo=[OPT,Y.top+.1,icrZ-.33+24/256*.66];
  // Fibers follow smooth cubic bends, never kinks. The laser pigtail leaves
  // through its snout and boot (0.6 cm) and runs straight into the tap.
  const bez=(p0,p1,p2,p3,n=10)=>Array.from({length:n-1},(_,i)=>{const t=(i+1)/n,u=1-t;
    return [0,1,2].map(k=>u*u*u*p0[k]+3*u*u*t*p1[k]+3*u*t*t*p2[k]+t*t*t*p3[k]);});
  const bootEnd=[itOut[0]-.6,itOut[1],0];
  const laserTrunk=[itOut,bootEnd,tap];
  const branch=(end,s)=>{const a=[tap[0]-.15,tap[1],s*.02];
    return [tap,a,...bez(a,[a[0]-.1,tap[1],s*.02],[end[0]+.1,end[1],end[2]],end),end];};
  const carrierPath=branch(cdmIn,-1);
  const loPath=branch(icrLo,1);
  strand(N,laserTrunk,M.fiberCw,.012);
  strand(N,carrierPath,M.fiberCw,.012);strand(N,loPath,M.fiberCw,.012);
  // Duplex LC receptacle at the module front (the Blender asset models the
  // molded body, bores, sleeves and bracket). Fibers land on its rear face;
  // the fiber cores glow at the ferrule stub faces inside the bores. The line
  // fibers pass the laser case in the 2.5 mm channels beside it.
  const LCX = MX1 - 0.3, LCY = Y.top + 0.3, LCR = 4.78, LCF = 5.165, SIDE = .89, FY = Y.top + .1;
  const lcTx = [LCR, LCY, -0.3], lcRx = [LCR, LCY, 0.3];
  const sideRun = s => [...bez([OPT, FY, s*.55], [OPT+.35, FY, s*.55], [OPT+.35, FY, s*SIDE], [OPT+.8, FY, s*SIDE]),
    [OPT+.8, FY, s*SIDE], [ITX+ITL/2, FY, s*SIDE], ...bez([ITX+ITL/2, FY, s*SIDE], [4.66, FY, s*SIDE], [4.6, LCY, s*.3], [LCR, LCY, s*.3])];
  const txLead = sideRun(-1);
  const rxLead = sideRun(1).reverse();
  strand(N, [cdmOut, ...txLead, lcTx], M.fiberTx, 0.012);
  strand(N, [lcRx, ...rxLead, icrSig], M.fiberRx, 0.012);
  for (const [dz, c] of [[-0.3, COL.tx], [0.3, COL.rx]]) N.box(0.006, 0.07, 0.07, glowMat(c, 1.4), LCF, LCY, dz);
  if (!authoredHardware) for (const dz of [-0.3, 0.3]) S.box(0.58, 0.8, 0.6, MAT.polymer, (LCR + MX1 - .03) / 2, LCY, dz);
  // Separate host-side and line-side banks land on the DSP die. Signals stop
  // at the DSP and resume from its other interface: no false lane-for-lane wire
  // through the DSP. Four path groups illustrate routing, not a host pin count.
  const hostTx=[],hostRx=[],lineTx=[],lineRx=[];
  const yTrace=Y.top+.004, yDie=Y.top+.16, dieHalf=.575;
  const pair3=pts=>{for(const d of [-.006,.006]) strand(N,pts.map(p=>[p[0],p[1],p[2]+d]),MAT.copper,.002,4);};
  for(let i=0;i<4;i++) {
    const ht=-.93+i*.07,hr=.72+i*.07;
    // Match the centers of the eight visible DSP interface blocks in dspTex().
    const dt=(49+i*52)/512*1.15-.575,dr=(301+i*52)/512*1.15-.575;
    // Line side: straight from the DSP's line-side bank to the driver or TIA
    // pads beside it, about 6 mm, with no detour (OIF HB-CDM sec. 8.2 counts
    // these DSP-to-driver traces as part of the transmit response).
    const dz=driverInputs[i][0][2],rz=tiaOutputs[i][0][2];
    const tx=[[mx(.62),yTrace,ht],[DSPX-DH-.2,yTrace,ht],[DSPX-DH,yTrace,dt],
      [DSPX-dieHalf,yDie,dt]];
    const rx=[[DSPX-dieHalf,yDie,dr],[DSPX-DH,yTrace,dr],[DSPX-DH-.2,yTrace,hr],[mx(.62),yTrace,hr]];
    const lt=[[DSPX+dieHalf,yDie,dt],[DSPX+DH,yTrace,dt],
      [DRX-EW/2-.15,yTrace,dz],...driverInputs[i],...driverBonds[i]];
    const lr=[...tiaBonds[i],...tiaOutputs[i],[TIAX-EW/2-.15,yTrace,rz],
      [DSPX+DH,yTrace,dr],[DSPX+dieHalf,yDie,dr]];
    hostTx.push([[MX0-.9,yTrace,ht],...tx]);hostRx.push([...rx,[MX0-.9,yTrace,hr]]);
    lineTx.push(lt);lineRx.push(lr);
    pair3(tx);pair3(rx);
    // Outside packages only: the interior conversion is a functional animation.
    pair3(lt.slice(0,4));pair3(lr.slice(7));
  }
  scene.userData.coherentRouting={laserTrunk,carrierPath,loPath,hostTx,hostRx,lineTx,lineRx,
    discretePackages:true,hostPathGroupsAreNotLaneCounts:true,rfEndFacesDsp:true};
  const pad = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.12, 1.3), new THREE.MeshStandardMaterial({ color: 0x4d4049, roughness: 0.82, transparent: true, opacity: 0.85 }));
  pad.name='Coherent DSP thermal pad';
  pad.position.set(DSPX, 3.145, 0); scene.add(pad);
  if (!authoredHardware) {
  lidBox(scene, M, LEN, MW, [0, Y.lid, 0]);
  // A restrained translucent fin silhouette keeps the interior readable in the
  // exploded teaching view; it is representative, not a thermal design claim.
  for (let i = 0; i < 13; i++) N.box(LEN * 0.67, 0.23, 0.025, lidDetail, -1.25, Y.lid + 0.185, -0.9 + i * 0.15);
  }
  const names = new Map([[MAT.pcb,'Coherent PCB'],[MAT.inductor,'Coherent inductors'],[MAT.pcbBlack,'Coherent package substrates'],
    [M.glass,'Coherent optical tap'],[MAT.polymer,'Coherent LC receptacle'],[laminate,'Coherent PCB laminate edge'],[MAT.gold,'Coherent gold contacts'],
    [MAT.copper,'Coherent copper'],[M.fiberCw,'Coherent CW fiber'],[M.fiberTx,'Coherent TX fiber'],[M.fiberRx,'Coherent RX fiber']]);
  for (const group of [S.build(), N.build({ cast: false })]) {
    group.traverse(o => { if (o.isMesh && names.has(o.material)) o.name = names.get(o.material); });
    scene.add(group);
  }

  // ======================= flows =======================
  const yT = Y.top + 0.01;
  for(const routes of [hostTx,hostRx,lineTx,lineRx])
    for(const path of routes) dataFlows.push(flow(path,'eth',FLOW.elec));
  dataFlows.push(flow(laserTrunk,'cw',FLOW.cw));
  dataFlows.push(flow(carrierPath, 'cw', FLOW.cw));
  dataFlows.push(flow(loPath, 'cw', FLOW.cw));
  // The modulated light leaves from the combiner's output port and the received signal stops at the PBS's input
  // port: the face drawings carry the paths inside the dies, so no flow cuts across them in a straight line.
  dataFlows.push(flow([face(CX0, CL, cdmZ, 640, 610, 128), cdmOut, ...txLead, lcTx, [MX1 + 0.7, LCY, -0.3]], 'tx', FLOW.light));
  dataFlows.push(flow([[MX1 + 0.7, LCY, 0.3], lcRx, ...rxLead, icrSig, face(RX0, RL, icrZ, 512, 448, 128)], 'rx', FLOW.light));
  for (let i = 0; i < 4; i++) flows.push(flow([[MX0 - 1.1, yT, -0.9 + i * 0.6], [mx(0.3), yT, -0.9 + i * 0.6], [mx(1.35+(i%2)*.48), Y.top + 0.12, i < 2 ? -0.22 : 0.22]], 'v33', FLOW.power));
  for (const [x, z, side] of [[DSPX, 0, 0], [ITX, 0, 1], [CX_, cdmZ, -1], [DRX, drvZ, -1], [RX_, icrZ, 1], [TIAX, tiaZ, 1]]) {
    const start = [mx(2.0), yT, z * 0.4], end = [x, Y.top + 0.12, z];
    // A functional DC distribution path, not a fabricated PCB trace. Feeds run
    // along the board edge past the DSP so energy never looks as if it passes
    // through the DSP; the optical-package feeds never reach the laser case.
    const edge = side * .97;
    const pts = !side ? [start, end] : [start, [DSPX - DH - .15, yT, edge], [x, yT, edge], end];
    flows.push(flow(pts, 'core', FLOW.power));
  }
  // Heat streams follow the site's one log rule (src/heat.js) on each part's assumed watts (PART_W.coherent):
  // the DSP, the laser, the driver and the TIA. The modulator's and photodiodes' bias, well under half a watt, draws none.
  const P = PART_W.coherent;
  for (let i = 0; i < 10; i++) { const x = DSPX + (i % 5 - 2) * 0.18, z = (Math.floor(i / 5) - 0.5) * 0.45; heatFlows.push(tagHeat(flow([[x, Y.top + 0.16, z], [x, Y.lid, z], [x, Y.lid + 1.2, z]], 'hot', FLOW.heat), 'cdsp', P.dsp)); }
  for (let i = 0; i < 4; i++) heatFlows.push(tagHeat(flow([[ITX - 0.9 + i * 0.6, Y.top + ITH, 0], [ITX - 0.9 + i * 0.6, Y.lid, 0], [ITX - 0.9 + i * 0.6, Y.lid + 1.0, 0]], 'hot', FLOW.heat), 'itla', P.itla));
  for (const [x, z, part, watts] of [[CX_, cdmZ, 'cdm', P.modulator], [DRX, drvZ, 'driver', P.driver], [RX_, icrZ, 'icr', P.receiverOptics], [TIAX, tiaZ, 'tia', P.tia]]) {
    if (!heatWeight(watts, P.dsp)) continue;
    for (const dx of [-.18, .18]) heatFlows.push(tagHeat(flow([[x+dx,Y.top+(x===DRX?.25:.16),z],[x+dx,Y.lid,z],[x+dx,Y.lid+1,z]], 'hot', FLOW.heat), part, watts));
  }
  balanceHeat(heatFlows);
  [flows, dataFlows, heatFlows].forEach(a => a.forEach(f => scene.add(f.group)));

  label(scene, 'Coherent pluggable · 800ZR, OSFP', [0, -0.35, 2.6], '#e8ecf2', 0.34);
  label(scene, 'Footprint to scale · layers pulled apart · the rest representative', [0, -0.75, 2.6], note, 0.18);
  label(scene, '1 module = 800G each way on one wavelength, one fiber pair', [0, -1.05, 2.6], unitCol, 0.18);
  label(scene, 'TX · lanes in', [MX0 - 0.9, 1.75, -0.55], COL.tx, 0.16);
  label(scene, 'RX · lanes out', [MX0 - 0.9, 1.75, 0.55], COL.rx, 0.16);
  label(scene, 'Electrical · copper traces', [DSPX + 1.2, 1.9, -1.45], COL.elec, 0.14);
  label(scene, 'Tunable laser · sized to a published nano-ITLA (JLT 2023), 25.0 × 15.6 × 6.5 mm', [ITX, 2.45, 0], COL.cw, 0.15);
  label(scene, 'TX · separate driver IC → IQ modulator', [(DRX + CX_) / 2, 1.9, -1.6], COL.tx, 0.14);
  label(scene, 'RX · photodiodes → separate TIA IC', [(TIAX + RX_) / 2, 1.9, 1.6], COL.rx, 0.14);
  label(scene, 'TX carrier', [tap[0]-.35,1.85,-.18], COL.cw, .10);
  label(scene, 'RX local oscillator', [tap[0]-.35,1.85,.18], COL.cw, .10);
  label(scene, 'Light · glass fiber', [LCX - 0.6, 2.05, 0], COL.tx, 0.14);
  label(scene, 'Duplex LC receptacle', [LCX + 0.1, 2.35, 0], note, 0.12);

  const hs = {
    cdsp: { pos: [DSPX, Y.top + .2, .3] },
    itla: { pos: [ITX, Y.top + ITH + .1, 0] },
    // The die pins sit on empty corners of the face drawings, clear of their labels; each part view keeps its
    // framing on the die center (the shifts in `detail`).
    cdm: { pos: face(CX0, CL, cdmZ, 640, 560, 248, .15) },
    driver: { pos: [DRX, Y.top + .27, drvZ] },
    tia: { pos: [TIAX, Y.top + .27, tiaZ] },
    icr: { pos: face(RX0, RL, icrZ, 512, 440, 222, .15) },
    lc: { pos: [LCX, Y.top + .5, 0] },
    // The pluggable itself: the pin sits on the pull tab's finger loop.
    pluggable: { pos: [MX1 + .42, .45, 0] },
  };
  const detail = {
    cdsp: [[-.9, 1.4, 2.9], [2.2, .5, 2.1]],
    itla: [[-.9, 1.45, 3.0], [3.2, .9, 2.15]],
    driver: [[-.55, 1.0, -2.4], [1.45, .45, 1.2]],
    // Aim a little host-side of the modulator so the LC receptacle stays a
    // small block at the frame edge instead of a dark mass beside the die.
    cdm: [[.65, 1.3, -2.3], [1.5, .4, 1.1], [CX_ - .25, 0, cdmZ - .05].map((v, i) => v - hs.cdm.pos[i] * (i !== 1))],
    icr: [[.65, 1.0, 2.4], [1.8, .4, 1.2], [RX_, 0, icrZ].map((v, i) => v - hs.icr.pos[i] * (i !== 1))],
    tia: [[-.55, 1.0, 2.4], [1.45, .45, 1.2]],
    // From the transmit side and above the board: the receptacle sits beside
    // the IQ modulator, not in front of it, so each pin lands on its own part.
    lc: [[1.8, 1.6, -2.2], [1.8, .8, 1.9]],
    // The fiber end from above the transmit side: the pull tab below, the
    // lifted top housing and its label above.
    pluggable: [[2.6, 3.4, 4.6], [3.6, 4.2, 2.8], [-1.3, 1.6, 0]],
  };
  for (const [id, [offset, size, shift = [0, 0, 0]]] of Object.entries(detail))
    hs[id].view = componentView(hs[id].pos.map((v, i) => v + shift[i]), offset, size);
  return {
    scene, flows, dataFlows, heatFlows,
    camera: { pos: [1.2, 10.5, 14.5], target: [0, 1.3, 0], near: 0.05, far: 300, min: 1.2, max: 40, portrait: { pos: [0.6, 12.5, 16.5], target: [0, 0.9, 0.4] } },
    hotspots: { cdsp: hs.cdsp, itla: hs.itla, driver: hs.driver, cdm: hs.cdm, icr: hs.icr, tia: hs.tia },
    dataHotspots: { cdsp: hs.cdsp, driver: hs.driver, cdm: hs.cdm, itla: hs.itla, icr: hs.icr, tia: hs.tia, lc: hs.lc, pluggable: hs.pluggable },
    heatHotspots: { cdsp: hs.cdsp, itla: hs.itla, driver: hs.driver, cdm: hs.cdm, icr: hs.icr, tia: hs.tia },
    update(t) { dspTop.emissiveIntensity = state.mode === 'heat' ? 0.5 + 0.08 * Math.sin(t * 2) : 0; },
  };
}
