// Side level: inside an 800ZR coherent pluggable (OSFP). World unit = 1 cm.
// Representative discrete board-level architecture: the driver and TIA each have
// their own closed electronic package, separate from the two optical assemblies.
// This is an explicit design assumption, not a teardown of a shipping 800ZR.
// OSFP footprint and nano-ITLA envelope are dimensioned; other dimensions and RF
// routing are schematic. Optical signals never enter the electronic packages.
import { THREE, MAT, Builder, flow, canvasTex, setup, materials, die, strand, label, lidBox, FLOW, COL, note, unitCol, dspTex, glowMat } from './side-kit.js';
import { componentView } from '../app/housing-frame.js';

// The IQ modulator seen from above, as one dual-polarization IQ modulator: laser in at the near edge, split into an X and
// a Y polarization branch; each holds an I and a Q Mach-Zehnder, with a 90-degree phase section on Q; the Y branch
// passes a polarization rotator (PR) and a combiner (PBC) joins both onto one output at the right. Pads for the RF
// driver's electrical terminals along the left edge, one per modulator (XI, XQ, YI, YQ).
function iqTex() {
  return canvasTex(640, 256, (g, w, h) => {
    g.fillStyle = '#4a5468'; g.fillRect(0, 0, w, h); g.lineCap = 'round'; g.lineJoin = 'round';
    const txt = (t, x, y, c = 'rgba(255,255,255,0.8)') => { g.fillStyle = c; g.font = '600 15px system-ui'; g.fillText(t, x, y); };
    g.strokeStyle = 'rgba(255,179,71,0.9)'; g.lineWidth = 3; g.beginPath(); g.moveTo(w / 2, h); g.lineTo(w / 2, h - 14); g.lineTo(40, h - 14); g.lineTo(40, h / 2); g.lineTo(70, 70); g.moveTo(40, h / 2); g.lineTo(70, 186); g.stroke();
    const pol = [[70, 'X'], [186, 'Y']];
    pol.forEach(([py, name], p) => {
      txt(name, 78, py + 5);
      for (const [dy, iq] of [[-26, 'I'], [26, 'Q']]) {
        const y = py + dy;
        g.strokeStyle = 'rgba(255,179,71,0.9)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(70, py); g.lineTo(110, y); g.lineTo(130, y); g.stroke();
        g.strokeStyle = 'rgba(98,230,255,0.95)'; g.beginPath(); g.moveTo(130, y); g.lineTo(145, y - 8); g.lineTo(355, y - 8); g.lineTo(370, y); g.moveTo(130, y); g.lineTo(145, y + 8); g.lineTo(355, y + 8); g.lineTo(370, y); g.lineTo(420, y); g.stroke();
        g.fillStyle = 'rgba(201,161,74,0.85)'; g.fillRect(150, y - 13, 200, 3); g.fillRect(150, y + 10, 200, 3);
        txt(iq, 112, y - 6, 'rgba(98,230,255,0.9)');
        if (iq === 'Q') { g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(382, y - 9, 30, 18); txt('90°', 383, y + 5); }
        g.strokeStyle = 'rgba(98,230,255,0.95)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(420, y); g.lineTo(450, py); g.stroke();
      }
      g.beginPath(); g.moveTo(450, py); g.lineTo(p ? 480 : 540, py); g.stroke();
    });
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(480, 174, 34, 24); txt('PR', 485, 191);                  // rotate Y
    g.strokeStyle = 'rgba(98,230,255,0.95)'; g.beginPath(); g.moveTo(514, 186); g.lineTo(540, 186); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(540, 60, 40, 136); txt('PBC', 543, 133);                 // combine X and Y
    g.strokeStyle = 'rgba(98,230,255,0.95)'; g.lineWidth = 3; g.beginPath(); g.moveTo(580, h / 2); g.lineTo(w, h / 2); g.stroke();
    for (let k = 0; k < 4; k++) {
      const py=58+k*46, electrode=[44,96,160,212][k]-13;
      g.fillStyle='rgba(201,161,74,.9)';g.fillRect(0,py-6,16,12);
      g.strokeStyle='rgba(201,161,74,.9)';g.lineWidth=2;g.beginPath();
      g.moveTo(16,py);g.lineTo(85+k*9,py);g.lineTo(125,electrode);g.lineTo(150,electrode);g.stroke();
    }   // RF pads: XI, XQ, YI, YQ
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(w - 12, 0, 12, h);
  });
}
// The coherent receiver: the signal in from the right and the laser's own light (the local oscillator) in from the
// far edge, each split by polarization (PBS); an X and a Y 90-degree hybrid mix them; four balanced photodiode pairs at the
// left edge read XI, XQ, YI, YQ for the separate TIA package.
function icrTex() {
  return canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#4a5468'; g.fillRect(0, 0, w, h); g.lineCap = 'round'; g.lineJoin = 'round';
    const txt = (t, x, y) => { g.fillStyle = 'rgba(255,255,255,0.8)'; g.font = '600 14px system-ui'; g.fillText(t, x, y); };
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(420, 40, 34, 40); txt('PBS', 421, 65);                  // signal split
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(40, 40, 34, 40); txt('PBS', 41, 65);                    // LO split
    g.strokeStyle = 'rgba(255,122,217,0.9)'; g.lineWidth = 3; g.beginPath(); g.moveTo(w, h / 2); g.lineTo(480, h / 2); g.lineTo(480, 60); g.lineTo(454, 60); g.moveTo(420, 52); g.lineTo(330, 100); g.moveTo(420, 68); g.lineTo(220, 100); g.stroke();
    g.strokeStyle = 'rgba(255,179,71,0.9)'; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, 24); g.lineTo(40, 24); g.lineTo(40, 60); g.moveTo(74, 52); g.lineTo(160, 100); g.moveTo(74, 68); g.lineTo(290, 100); g.stroke();
    for (const [x0, name] of [[140, 'X'], [270, 'Y']]) {
      g.strokeStyle = 'rgba(255,255,255,0.65)'; g.lineWidth = 2; g.strokeRect(x0, 100, 100, 70); txt(`90° ${name}`, x0 + 22, 141);
    }
    // Four balanced photodiode pairs terminate at the left electrical edge.
    // Each pair receives complementary optical outputs from its hybrid.
    for (let k=0;k<4;k++) {
      const y=58+k*46, hx=k<2 ? 140 : 270, hy=115+(k%2)*35;
      g.strokeStyle='rgba(255,122,217,0.8)'; g.lineWidth=2;
      for (const d of [-4,4]) { g.beginPath(); g.moveTo(hx,hy+d); g.lineTo(65,y+d); g.lineTo(44,y+d); g.stroke(); }
      g.fillStyle='rgba(255,122,217,0.95)';g.fillRect(24,y-10,18,8);g.fillRect(24,y+2,18,8);
      g.strokeStyle='rgba(201,161,74,.9)';g.beginPath();g.moveTo(24,y);g.lineTo(0,y);g.stroke();
    }

  });
}

// A visible package marking makes these closed, discrete electronics unmistakable.
function analogTex(name) {
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
  const DSPX = mx(3.9), DH = 0.85;
  S.box(1.7, 0.1, 1.7, MAT.pcbBlack, DSPX, Y.top + 0.05, 0);
  const dspTop = die(scene, M, 1.15, 0.06, 1.15, dspTex(), DSPX, Y.top + 0.13, 0);
  // Names travel into the Blender reference export (userData.sourceMesh).
  const named = name => { scene.children.at(-1).name = name; };
  named('Coherent DSP die');
  // the tunable laser, to its published size
  const ITX = mx(6.35), ITL = 2.5, ITW = 1.56, ITH = 0.65;
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
  const itOut = [ITX + ITL / 2, Y.top + 0.33, 0];
  // A fused tap (about 1 x 1 x 3 mm, on a mount in the Blender asset) splits the
  // laser's light between the transmit carrier and the receiver's local oscillator.
  const tap = [3.5, Y.top + 0.23, 0];
  S.box(0.3, 0.1, 0.1, M.glass, tap[0], tap[1], 0);
  // Two-by-two board layout: closed electronic packages on the host side,
  // distinct optical assemblies toward the fiber side. No shared substrate or lid.
  const CX0=3.37, CL=1.10, CX_=CX0+CL/2, cdmZ=-.55;
  const RX0=3.37, RL=1.10, RX_=RX0+RL/2, icrZ=.55;
  const DRX=2.85, TIAX=2.85, drvZ=cdmZ, tiaZ=icrZ, EW=.55;
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
  const cdmIn=[CX_,Y.top+.1,cdmZ+.33],cdmOut=[CX0+CL,Y.top+.1,cdmZ];
  const icrSig=[RX0+RL,Y.top+.1,icrZ],icrLo=[RX_,Y.top+.1,icrZ-.33];
  // Fibers follow smooth cubic bends, never kinks. The laser pigtail leaves
  // through its snout and boot (0.6 cm) and drops to the tap in an S-bend whose
  // radius stays at or above the 5 mm a nano-ITLA vendor page specifies.
  const bez=(p0,p1,p2,p3,n=10)=>Array.from({length:n-1},(_,i)=>{const t=(i+1)/n,u=1-t;
    return [0,1,2].map(k=>u*u*u*p0[k]+3*u*u*t*p1[k]+3*u*t*t*p2[k]+t*t*t*p3[k]);});
  const bootEnd=[itOut[0]+.6,itOut[1],0],tapIn=[tap[0]-.15,tap[1],0];
  const laserTrunk=[itOut,bootEnd,...bez(bootEnd,[3.08,itOut[1],0],[3.08,tap[1],0],tapIn),tapIn,tap];
  const branch=(end,s)=>{const a=[tap[0]+.15,tap[1],s*.02];
    return [tap,a,...bez(a,[3.86,tap[1],s*.02],[end[0],end[1],s*.03],end),end];};
  const carrierPath=branch(cdmIn,-1);
  const loPath=branch(icrLo,1);
  strand(N,laserTrunk,M.fiberCw,.012);
  strand(N,carrierPath,M.fiberCw,.012);strand(N,loPath,M.fiberCw,.012);
  // Duplex LC receptacle at the module front (the Blender asset models the
  // molded body, bores, sleeves and bracket). Fibers land on its rear face;
  // the fiber cores glow at the ferrule stub faces inside the bores.
  const LCX = MX1 - 0.3, LCY = Y.top + 0.3, LCR = 4.78, LCF = 5.165;
  const lcTx = [LCR, LCY, -0.3], lcRx = [LCR, LCY, 0.3];
  const txLead = bez(cdmOut, [4.64, cdmOut[1], -.55], [4.62, LCY, -.3], lcTx);
  const rxLead = bez(lcRx, [4.62, LCY, .3], [4.64, icrSig[1], .55], icrSig);
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
    const et=-.95+i*.045,er=.81+i*.045;
    const tx=[[mx(.62),yTrace,ht],[-3.1,yTrace,ht],[DSPX-DH,yTrace,dt],
      [DSPX-dieHalf,yDie,dt]];
    const rx=[[DSPX-dieHalf,yDie,dr],[DSPX-DH,yTrace,dr],[-3.1,yTrace,hr],[mx(.62),yTrace,hr]];
    const lt=[[DSPX+dieHalf,yDie,dt],[DSPX+DH,yTrace,dt],
      [ITX-ITL/2-.2,yTrace,et],[DRX-EW/2-.15,yTrace,et],...driverInputs[i],...driverBonds[i]];
    const lr=[...tiaBonds[i],...tiaOutputs[i],[TIAX-EW/2-.15,yTrace,er],
      [ITX-ITL/2-.2,yTrace,er],[DSPX+DH,yTrace,dr],[DSPX+dieHalf,yDie,dr]];
    hostTx.push([[MX0-.9,yTrace,ht],...tx]);hostRx.push([...rx,[MX0-.9,yTrace,hr]]);
    lineTx.push(lt);lineRx.push(lr);
    pair3(tx);pair3(rx);
    // Outside packages only: the interior conversion is a functional animation.
    pair3(lt.slice(0,5));pair3(lr.slice(7));
  }
  scene.userData.coherentRouting={laserTrunk,carrierPath,loPath,hostTx,hostRx,lineTx,lineRx,
    discretePackages:true,hostPathGroupsAreNotLaneCounts:true};
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
  dataFlows.push(flow([cdmIn, cdmOut, ...txLead, lcTx, [MX1 + 0.7, LCY, -0.3]], 'tx', FLOW.light));
  dataFlows.push(flow([[MX1 + 0.7, LCY, 0.3], lcRx, ...rxLead, icrSig, [RX_, Y.top + 0.12, icrZ]], 'rx', FLOW.light));
  for (let i = 0; i < 4; i++) flows.push(flow([[MX0 - 1.1, yT, -0.9 + i * 0.6], [mx(0.3), yT, -0.9 + i * 0.6], [mx(1.35+(i%2)*.48), Y.top + 0.12, i < 2 ? -0.22 : 0.22]], 'v33', FLOW.power));
  for (const [x, z] of [[DSPX, 0], [ITX, 0], [CX_, cdmZ], [DRX, drvZ], [RX_, icrZ], [TIAX, tiaZ]]) {
    const start = [mx(2.0), yT, z * 0.4], end = [x, Y.top + 0.12, z];
    // A functional DC distribution path, not a fabricated PCB trace. Route the
    // optical-package feeds outside the metal laser case so energy cannot look
    // as if it passes through the laser to reach unrelated circuits.
    const edge = Math.sign(z) * .97;
    const pts = z === 0 ? [start, end] : [start, [ITX - ITL / 2 - .22, yT, edge],
      [ITX + ITL / 2 + .2, yT, edge], [x, yT, edge], end];
    flows.push(flow(pts, 'core', FLOW.power));
  }
  for (let i = 0; i < 10; i++) { const x = DSPX + (i % 5 - 2) * 0.18, z = (Math.floor(i / 5) - 0.5) * 0.45; heatFlows.push(flow([[x, Y.top + 0.16, z], [x, Y.lid, z], [x, Y.lid + 1.2, z]], 'hot', FLOW.heat)); }
  for (let i = 0; i < 4; i++) heatFlows.push(flow([[ITX - 0.9 + i * 0.6, Y.top + ITH, 0], [ITX - 0.9 + i * 0.6, Y.lid, 0], [ITX - 0.9 + i * 0.6, Y.lid + 1.0, 0]], 'hot', FLOW.heat));
  // Electronics and biased optics also reject heat; pulse counts are not watts.
  for (const [x,z] of [[CX_,cdmZ],[DRX,drvZ],[RX_,icrZ],[TIAX,tiaZ]]) for (const dx of [-.18,.18])
    heatFlows.push(flow([[x+dx,Y.top+(x===DRX?.25:.16),z],[x+dx,Y.lid,z],[x+dx,Y.lid+1,z]], 'hot', FLOW.heat));
  [flows, dataFlows, heatFlows].forEach(a => a.forEach(f => scene.add(f.group)));

  label(scene, 'Coherent pluggable · 800ZR, OSFP', [0, -0.35, 2.6], '#e8ecf2', 0.34);
  label(scene, 'Footprint to scale · layers pulled apart · the rest representative', [0, -0.75, 2.6], note, 0.18);
  label(scene, '1 module = 800G each way on one wavelength, one fiber pair', [0, -1.05, 2.6], unitCol, 0.18);
  label(scene, 'TX · lanes in', [MX0 - 0.9, 1.75, -0.55], COL.tx, 0.16);
  label(scene, 'RX · lanes out', [MX0 - 0.9, 1.75, 0.55], COL.rx, 0.16);
  label(scene, 'Electrical · copper traces', [DSPX + 1.2, 1.9, -1.45], COL.elec, 0.14);
  label(scene, 'Tunable laser · sized to a published nano-ITLA (JLT 2023), 25.0 × 15.6 × 6.5 mm', [ITX, 2.45, 0], COL.cw, 0.15);
  label(scene, 'TX · separate driver IC → IQ modulator', [CX_, 1.9, -1.6], COL.tx, 0.14);
  label(scene, 'RX · photodiodes → separate TIA IC', [RX_, 1.9, 1.6], COL.rx, 0.14);
  label(scene, 'TX carrier', [3.7,1.85,-.18], COL.cw, .10);
  label(scene, 'RX local oscillator', [3.7,1.85,.18], COL.cw, .10);
  label(scene, 'Light · glass fiber', [LCX - 0.6, 2.05, 0], COL.tx, 0.14);
  label(scene, 'Duplex LC receptacle', [LCX + 0.1, 2.35, 0], note, 0.12);

  const hs = {
    cdsp: { pos: [DSPX, Y.top + .2, .3] },
    itla: { pos: [ITX, Y.top + ITH + .1, 0] },
    cdm: { pos: [CX_, Y.top + .15, cdmZ] },
    driver: { pos: [DRX, Y.top + .27, drvZ] },
    tia: { pos: [TIAX, Y.top + .27, tiaZ] },
    icr: { pos: [RX_, Y.top + .15, icrZ] },
    lc: { pos: [LCX, Y.top + .5, 0] },
  };
  const detail = {
    cdsp: [[-.9, 1.4, 2.9], [2.2, .5, 2.1]],
    itla: [[-.9, 1.45, 3.0], [3.2, .9, 2.15]],
    driver: [[-.55, 1.0, -2.4], [1.45, .45, 1.2]],
    // Aim a little host-side of the modulator so the LC receptacle stays a
    // small block at the frame edge instead of a dark mass beside the die.
    cdm: [[.65, 1.3, -2.3], [1.5, .4, 1.1], [-.25, 0, -.05]],
    icr: [[.65, 1.0, 2.4], [1.8, .4, 1.2]],
    tia: [[-.55, 1.0, 2.4], [1.45, .45, 1.2]],
    // From the transmit side and above the board: the receptacle sits beside
    // the IQ modulator, not in front of it, so each pin lands on its own part.
    lc: [[1.8, 1.6, -2.2], [1.8, .8, 1.9]],
  };
  for (const [id, [offset, size, shift = [0, 0, 0]]] of Object.entries(detail))
    hs[id].view = componentView(hs[id].pos.map((v, i) => v + shift[i]), offset, size);
  return {
    scene, flows, dataFlows, heatFlows,
    camera: { pos: [1.2, 10.5, 14.5], target: [0, 1.3, 0], near: 0.05, far: 300, min: 1.2, max: 40, portrait: { pos: [0.6, 12.5, 16.5], target: [0, 0.9, 0.4] } },
    hotspots: { cdsp: hs.cdsp, itla: hs.itla, driver: hs.driver, cdm: hs.cdm, icr: hs.icr, tia: hs.tia },
    dataHotspots: { cdsp: hs.cdsp, driver: hs.driver, cdm: hs.cdm, itla: hs.itla, icr: hs.icr, tia: hs.tia, lc: hs.lc },
    heatHotspots: { cdsp: hs.cdsp, itla: hs.itla, driver: hs.driver, cdm: hs.cdm, icr: hs.icr, tia: hs.tia },
    update(t) { dspTop.emissiveIntensity = state.mode === 'heat' ? 0.5 + 0.08 * Math.sin(t * 2) : 0; },
  };
}
