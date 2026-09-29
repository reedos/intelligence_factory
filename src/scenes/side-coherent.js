// Side level: inside an 800ZR coherent pluggable (OSFP). World unit = 1 cm.
// The four blocks every source names: a tunable laser (sized to a nano-ITLA research example, 25.0 x 15.6 x 6.5 mm), a
// coherent driver modulator (the IQ modulator packaged with its RF driver), an integrated coherent receiver (90-degree
// hybrid, balanced photodiodes and TIAs in one package) and the coherent DSP. The footprint is to scale, the layers are
// pulled apart; where each block sits is representative (this research pass found no teardown). Transmit on the far side (z < 0), receive on the near side:
//   TX  host lanes → DSP → traces → CDM (driver → IQ modulator, lit by the laser) → fiber → LC transmit
//   RX  LC receive → fiber → ICR (mixed with the laser's own light) → TIAs → traces → DSP → host lanes
import { THREE, MAT, Builder, flow, canvasTex, setup, materials, die, strand, trace, bondWire, label, lidBox, FLOW, COL, note, unitCol, dspTex, glowMat } from './side-kit.js';

// The IQ modulator seen from above, as one dual-polarization IQ modulator: laser in at the left, split into an X and
// a Y polarization branch; each holds an I and a Q Mach-Zehnder, with a 90-degree phase section on Q; the Y branch
// passes a polarization rotator (PR) and a combiner (PBC) joins both onto one output at the right. Pads for the RF
// driver's bond wires along the far edge, one per modulator (XI, XQ, YI, YQ).
function iqTex() {
  return canvasTex(640, 256, (g, w, h) => {
    g.fillStyle = '#4a5468'; g.fillRect(0, 0, w, h); g.lineCap = 'round'; g.lineJoin = 'round';
    const txt = (t, x, y, c = 'rgba(255,255,255,0.8)') => { g.fillStyle = c; g.font = '600 15px system-ui'; g.fillText(t, x, y); };
    g.strokeStyle = 'rgba(255,179,71,0.9)'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, h / 2); g.lineTo(40, h / 2); g.lineTo(70, 70); g.moveTo(40, h / 2); g.lineTo(70, 186); g.stroke();
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
    for (let k = 0; k < 4; k++) { g.fillStyle = 'rgba(201,161,74,0.9)'; g.fillRect(200 + k * 60, 4, 34, 14); }   // RF pads: XI, XQ, YI, YQ
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(w - 12, 0, 12, h);
  });
}
// The coherent receiver: the signal in from the right and the laser's own light (the local oscillator) in from the
// left, each split by polarization (PBS); an X and a Y 90-degree hybrid mix them; four balanced photodiode pairs at the
// near edge read XI, XQ, YI, YQ for the TIAs beside them.
function icrTex() {
  return canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#4a5468'; g.fillRect(0, 0, w, h); g.lineCap = 'round'; g.lineJoin = 'round';
    const txt = (t, x, y) => { g.fillStyle = 'rgba(255,255,255,0.8)'; g.font = '600 14px system-ui'; g.fillText(t, x, y); };
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(420, 40, 34, 40); txt('PBS', 421, 65);                  // signal split
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(40, 40, 34, 40); txt('PBS', 41, 65);                    // LO split
    g.strokeStyle = 'rgba(255,122,217,0.9)'; g.lineWidth = 3; g.beginPath(); g.moveTo(w, 60); g.lineTo(454, 60); g.moveTo(420, 52); g.lineTo(330, 100); g.moveTo(420, 68); g.lineTo(220, 100); g.stroke();
    g.strokeStyle = 'rgba(255,179,71,0.9)'; g.beginPath(); g.moveTo(0, 60); g.lineTo(40, 60); g.moveTo(74, 52); g.lineTo(160, 100); g.moveTo(74, 68); g.lineTo(290, 100); g.stroke();
    for (const [x0, name] of [[140, 'X'], [270, 'Y']]) {
      g.strokeStyle = 'rgba(255,255,255,0.65)'; g.lineWidth = 2; g.strokeRect(x0, 100, 100, 70); txt(`90° ${name}`, x0 + 22, 141);
    }
    // each hybrid's I and Q outputs to their own balanced pair: X to XI and XQ, Y to YI and YQ
    [[140, 0], [140, 1], [270, 2], [270, 3]].forEach(([x0, k], j) => { g.strokeStyle = 'rgba(255,122,217,0.8)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0 + 30 + (j % 2) * 40, 170); g.lineTo(130 + k * 90, 212); g.stroke(); });
    for (let k = 0; k < 4; k++) { const x = 110 + k * 90; g.fillStyle = 'rgba(255,122,217,0.95)'; g.fillRect(x, 212, 18, 22); g.fillRect(x + 22, 212, 18, 22); }   // XI XQ YI YQ
  });
}

export function build({ quality, state }) {
  const scene = setup(quality, 9), M = materials();
  const S = new Builder(), N = new Builder();
  const flows = [], dataFlows = [], heatFlows = [];
  const LEN = 10.78, MW = 2.258, MX0 = -LEN / 2, MX1 = LEN / 2, mx = u => MX0 + u;
  const Y = { shell: 0, pcb: 1.3, top: 1.35, lid: 3.4 };
  S.box(LEN, 0.12, MW, MAT.darkSteel, 0, Y.shell, 0);
  S.box(LEN, 0.55, 0.1, MAT.darkSteel, 0, Y.shell + 0.3, -MW / 2 + 0.05);
  S.box(LEN - 0.9, 0.1, MW - 0.24, MAT.pcb, (MX0 + MX1 - 0.9) / 2 + 0.05, Y.pcb, 0);
  for (let i = 0; i < 30; i++) { const z = -0.95 + i * 0.066; N.box(0.55, 0.012, 0.045, MAT.gold, mx(0.33), Y.top + 0.006, z); N.box(0.55, 0.012, 0.045, MAT.gold, mx(0.33), Y.pcb - 0.056, z); }
  for (let i = 0; i < 4; i++) S.box(0.34, 0.22, 0.34, MAT.inductor, mx(1.35 + (i % 2) * 0.48), Y.top + 0.11, i < 2 ? -0.62 : 0.62);
  // the coherent DSP
  const DSPX = mx(3.9), DH = 0.85;
  S.box(1.7, 0.1, 1.7, MAT.pcbBlack, DSPX, Y.top + 0.05, 0);
  const dspTop = die(scene, M, 1.15, 0.06, 1.15, dspTex(), DSPX, Y.top + 0.13, 0);
  // the tunable laser, to its published size
  const ITX = mx(6.35), ITL = 2.5, ITW = 1.56, ITH = 0.65;
  S.box(ITL, ITH, ITW, MAT.nickel, ITX, Y.top + ITH / 2, 0);
  const itOut = [ITX + ITL / 2, Y.top + 0.33, 0];
  N.box(0.03, 0.12, 0.3, glowMat(COL.cw, 1.5), itOut[0] + 0.015, itOut[1], 0);
  // a tap splits the laser's light between the transmit carrier and the receiver's local oscillator
  const tap = [itOut[0] + 0.22, Y.top + 0.12, 0];
  S.box(0.18, 0.12, 0.3, M.glass, tap[0], tap[1], 0);
  // the coherent driver modulator: an RF driver strip along the far edge, bonded to the IQ modulator chip beside it
  const CX0 = mx(7.75), CL = 1.75, CX_ = CX0 + CL / 2, cdmZ = -0.52;
  S.box(CL + 0.1, 0.05, 0.82, MAT.pcbBlack, CX_, Y.top + 0.025, cdmZ);
  die(scene, M, CL, 0.06, 0.48, iqTex(), CX_, Y.top + 0.08, cdmZ + 0.1);
  const drvTop = die(scene, M, CL * 0.7, 0.06, 0.16, null, CX_, Y.top + 0.08, cdmZ - 0.27); drvTop.color = new THREE.Color(0x3e4a66);
  for (let k = 0; k < 4; k++) { const x = CX0 + (200 + k * 60 + 17) / 640 * CL; bondWire(N, [x, Y.top + 0.11, cdmZ - 0.22], [x, Y.top + 0.11, cdmZ - 0.12], 0.06); }
  const cdmIn = [CX0, Y.top + 0.1, cdmZ + 0.1], cdmOut = [CX0 + CL, Y.top + 0.1, cdmZ + 0.1];
  // the coherent receiver: hybrid and photodiodes, with the TIAs along the near edge
  const RX0 = mx(7.75), RL = 1.5, RX_ = RX0 + RL / 2, icrZ = 0.52;
  S.box(RL + 0.1, 0.05, 0.82, MAT.pcbBlack, RX_, Y.top + 0.025, icrZ);
  die(scene, M, RL, 0.06, 0.46, icrTex(), RX_, Y.top + 0.08, icrZ - 0.1);
  const tiaTop = die(scene, M, RL * 0.75, 0.06, 0.16, null, RX_, Y.top + 0.08, icrZ + 0.27); tiaTop.color = new THREE.Color(0x5a3e62);
  for (let k = 0; k < 4; k++) { const x = RX0 + (110 + k * 90 + 20) / 512 * RL; bondWire(N, [x, Y.top + 0.11, icrZ + 0.12], [x, Y.top + 0.11, icrZ + 0.2], 0.06); }
  const icrSig = [RX0 + RL, Y.top + 0.1, icrZ - 0.25], icrLo = [RX0, Y.top + 0.1, icrZ - 0.25];
  // short fibers: laser to modulator and to receiver; the modulated light out; the received light in
  strand(N, [itOut, tap], M.fiberCw, 0.012);
  strand(N, [tap, [tap[0] + 0.1, tap[1], cdmZ + 0.1], cdmIn], M.fiberCw, 0.012);
  strand(N, [tap, [tap[0] + 0.1, tap[1], icrZ - 0.25], icrLo], M.fiberCw, 0.012);
  const LCX = MX1 - 0.3, lcTx = [LCX - 0.25, Y.top + 0.2, -0.3], lcRx = [LCX - 0.25, Y.top + 0.2, 0.3];
  strand(N, [cdmOut, [(cdmOut[0] + lcTx[0]) / 2, Y.top + 0.18, -0.35], lcTx], M.fiberTx, 0.012);
  strand(N, [lcRx, [(icrSig[0] + lcRx[0]) / 2, Y.top + 0.18, 0.3], icrSig], M.fiberRx, 0.012);
  for (const [dz, c] of [[-0.3, COL.tx], [0.3, COL.rx]]) { S.box(0.5, 0.36, 0.42, MAT.polymer, LCX, Y.top + 0.2, dz); N.box(0.02, 0.05, 0.05, glowMat(c, 1.4), LCX + 0.26, Y.top + 0.2, dz); }
  // copper traces: host side to the DSP, then along the board's edges past the laser to the CDM's driver (transmit)
  // and back from the ICR's TIAs (receive)
  const pair = pts => { for (const d of [-0.02, 0.02]) for (let k = 0; k < pts.length - 1; k++) trace(N, [pts[k][0], pts[k][1] + d], [pts[k + 1][0], pts[k + 1][1] + d], Y.top + 0.002, 0.016); };
  for (let i = 0; i < 4; i++) {
    const zt = -0.86 + i * 0.1, zr = 0.56 + i * 0.1, et = -0.95 + i * 0.045, er = 0.81 + i * 0.045;
    pair([[mx(0.62), zt], [DSPX - 1.2, zt], [DSPX - DH, zt * 0.8]]);
    pair([[mx(0.62), zr], [DSPX - 1.2, zr], [DSPX - DH, zr * 0.8]]);
    pair([[DSPX + DH, -0.55 + i * 0.1], [ITX - ITL / 2 - 0.2, et], [CX0 + 0.2, et], [CX0 + 0.3 + i * 0.3, cdmZ - 0.33]]);
    pair([[DSPX + DH, 0.25 + i * 0.1], [ITX - ITL / 2 - 0.2, er], [RX0 + 0.2, er], [RX0 + 0.3 + i * 0.28, icrZ + 0.33]]);
  }
  const pad = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.12, 1.3), new THREE.MeshStandardMaterial({ color: 0xd87aa0, roughness: 0.8, transparent: true, opacity: 0.85 }));
  pad.position.set(DSPX, 2.35, 0); scene.add(pad);
  lidBox(scene, M, LEN, MW, [0, Y.lid, 0]);
  scene.add(S.build()); scene.add(N.build({ cast: false }));

  // ======================= flows =======================
  const yT = Y.top + 0.01;
  for (let i = 0; i < 4; i += 1) {
    const zt = -0.86 + i * 0.1, zr = 0.56 + i * 0.1, et = -0.95 + i * 0.045, er = 0.81 + i * 0.045;
    if (i % 2 === 0) {
      dataFlows.push(flow([[MX0 - 0.9, yT, zt], [mx(0.62), yT, zt], [DSPX - 1.2, yT, zt], [DSPX - DH, yT, zt * 0.8], [DSPX + DH, Y.top + 0.18, -0.55 + i * 0.1], [ITX - ITL / 2 - 0.2, yT, et], [CX0 + 0.2, yT, et], [CX0 + 0.3 + i * 0.3, Y.top + 0.1, cdmZ - 0.33], [CX0 + 0.3 + i * 0.3, Y.top + 0.12, cdmZ + 0.05]], 'eth', FLOW.elec));
      dataFlows.push(flow([[RX0 + 0.3 + i * 0.28, Y.top + 0.12, icrZ + 0.05], [RX0 + 0.3 + i * 0.28, Y.top + 0.1, icrZ + 0.33], [RX0 + 0.2, yT, er], [ITX - ITL / 2 - 0.2, yT, er], [DSPX + DH, Y.top + 0.18, 0.25 + i * 0.1], [DSPX - DH, yT, zr * 0.8], [DSPX - 1.2, yT, zr], [mx(0.62), yT, zr], [MX0 - 0.9, yT, zr]], 'eth', FLOW.elec));
    }
  }
  dataFlows.push(flow([itOut, tap, [tap[0] + 0.1, tap[1], cdmZ + 0.1], cdmIn], 'cw', FLOW.cw));
  dataFlows.push(flow([itOut, tap, [tap[0] + 0.1, tap[1], icrZ - 0.25], icrLo], 'cw', FLOW.cw));
  dataFlows.push(flow([cdmIn, cdmOut, [(cdmOut[0] + lcTx[0]) / 2, Y.top + 0.18, -0.35], lcTx, [MX1 + 0.7, Y.top + 0.2, -0.3]], 'tx', FLOW.light));
  dataFlows.push(flow([[MX1 + 0.7, Y.top + 0.2, 0.3], lcRx, [(icrSig[0] + lcRx[0]) / 2, Y.top + 0.18, 0.3], icrSig, [RX_, Y.top + 0.12, icrZ - 0.1]], 'rx', FLOW.light));
  for (let i = 0; i < 4; i++) flows.push(flow([[MX0 - 1.1, yT, -0.9 + i * 0.6], [mx(0.3), yT, -0.9 + i * 0.6], [mx(1.5), Y.top + 0.12, i < 2 ? -0.62 : 0.62]], 'v33', FLOW.power));
  for (const [x, z] of [[DSPX, 0], [ITX, 0], [CX_, cdmZ], [RX_, icrZ]]) flows.push(flow([[mx(2.0), yT, z * 0.4], [x, Y.top + 0.12, z]], 'core', FLOW.power));
  for (let i = 0; i < 10; i++) { const x = DSPX + (i % 5 - 2) * 0.18, z = (Math.floor(i / 5) - 0.5) * 0.45; heatFlows.push(flow([[x, Y.top + 0.16, z], [x, Y.lid, z], [x, Y.lid + 1.2, z]], 'hot', FLOW.heat)); }
  for (let i = 0; i < 4; i++) heatFlows.push(flow([[ITX - 0.9 + i * 0.6, Y.top + ITH, 0], [ITX - 0.9 + i * 0.6, Y.lid, 0], [ITX - 0.9 + i * 0.6, Y.lid + 1.0, 0]], 'hot', FLOW.heat));
  [flows, dataFlows, heatFlows].forEach(a => a.forEach(f => scene.add(f.group)));

  label(scene, 'Coherent pluggable · 800ZR, OSFP', [0, -0.35, 2.6], '#e8ecf2', 0.34);
  label(scene, 'Footprint to scale · layers pulled apart · the rest representative', [0, -0.75, 2.6], note, 0.18);
  label(scene, '1 module = 800G each way on one wavelength, one fiber pair', [0, -1.05, 2.6], unitCol, 0.18);
  label(scene, 'TX · lanes in', [MX0 - 0.9, 1.75, -0.55], COL.tx, 0.16);
  label(scene, 'RX · lanes out', [MX0 - 0.9, 1.75, 0.55], COL.rx, 0.16);
  label(scene, 'Electrical · copper traces', [DSPX + 1.2, 1.9, -1.45], COL.elec, 0.14);
  label(scene, 'Tunable laser · sized to a published nano-ITLA (JLT 2023), 25.0 × 15.6 × 6.5 mm', [ITX, 2.45, 0], COL.cw, 0.15);
  label(scene, 'Driver + IQ modulator (TX) · one common design', [CX_, 1.9, -1.45], COL.tx, 0.14);
  label(scene, 'Coherent receiver + TIAs (RX) · one common design', [RX_, 1.9, 1.45], COL.rx, 0.14);
  label(scene, 'Light · glass fiber', [LCX - 0.6, 2.05, 0], COL.tx, 0.14);

  const view = (p, v, t) => ({ pos: p, view: { pos: v, target: t } });
  const hs = {
    cdsp: view([DSPX, Y.top + 0.2, 0.3], [DSPX - 0.6, 4.4, 3.8], [DSPX, Y.top, 0]),
    itla: view([ITX, Y.top + ITH + 0.1, 0], [ITX - 0.6, 4.2, 3.8], [ITX, Y.top, 0]),
    cdm: view([CX_, Y.top + 0.15, cdmZ], [CX_ - 0.2, 3.4, -2.6], [CX_, Y.top, cdmZ]),
    icr: view([RX_, Y.top + 0.15, icrZ], [RX_ - 0.2, 3.4, 2.8], [RX_, Y.top, icrZ]),
    lc: view([LCX, Y.top + 0.5, 0], [MX1 + 1.8, 3.2, 3.4], [LCX - 0.5, Y.top, 0]),
  };
  return {
    scene, flows, dataFlows, heatFlows,
    camera: { pos: [1.2, 8.6, 10.5], target: [0, 1.3, 0], near: 0.05, far: 300, min: 1.2, max: 40, portrait: { pos: [0.6, 12.5, 16.5], target: [0, 0.9, 0.4] } },
    hotspots: {},
    dataHotspots: { cdsp: hs.cdsp, cdm: hs.cdm, itla: hs.itla, icr: hs.icr, lc: hs.lc },
    heatHotspots: {},
    update(t) { dspTop.emissiveIntensity = state.mode === 'heat' ? 0.5 + 0.08 * Math.sin(t * 2) : 0; },
  };
}
