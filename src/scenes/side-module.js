// Side level: inside a 1.6T DR8 pluggable module (OSFP), exploded, and its LPO variant. World unit = 1 cm.
// The footprint is drawn to its published size and the layers are pulled apart vertically; the parts inside are
// representative (this research pass found no suitable public teardown).
// Transmit runs along the far side of the board (z < 0), receive along the near side (z > 0), each its own chain:
//   TX  host lanes → DSP → driver → bond wires → Mach-Zehnder modulators (lit by the CW lasers) → fiber → connector
//   RX  connector → fiber → photodiodes → bond wires → TIA → DSP → host lanes
import { THREE, MAT, Builder, flow, setup, materials, die, strand, trace, bondWire, label, lidBox, outline, FLOW, COL, note, unitCol, dspTex, mzmPicTex, MZM, finTex, glowMat } from './side-kit.js';

export function build({ quality, state }) {
  const scene = setup(quality, 9), M = materials();
  const S = new Builder(), N = new Builder(), TD = new Builder(), TL = new Builder();   // TD: traces with a DSP, TL: the LPO module's
  const flows = [], dataFlows = [], heatFlows = [];
  const dspOnly = new Set(), lpoOnly = new Set();
  const lpo = { on: false };

  const LEN = 10.78, MW = 2.258, MX0 = -LEN / 2, MX1 = LEN / 2, mx = u => MX0 + u;
  const Y = { shell: 0, pcb: 1.3, top: 1.35, lid: 3.4 };
  // shell and board
  S.box(LEN, 0.12, MW, MAT.darkSteel, 0, Y.shell, 0);
  S.box(LEN, 0.55, 0.1, MAT.darkSteel, 0, Y.shell + 0.3, -MW / 2 + 0.05);
  S.box(0.12, 0.55, MW, MAT.darkSteel, MX1 - 0.06, Y.shell + 0.3, 0);
  S.box(LEN - 0.9, 0.1, MW - 0.24, MAT.pcb, (MX0 + MX1 - 0.9) / 2 + 0.05, Y.pcb, 0);
  // the edge connector's gold fingers, both faces
  for (let i = 0; i < 30; i++) { const z = -0.95 + i * 0.066; N.box(0.55, 0.012, 0.045, MAT.gold, mx(0.33), Y.top + 0.006, z); N.box(0.55, 0.012, 0.045, MAT.gold, mx(0.33), Y.pcb - 0.056, z); }
  // power conversion and the controller
  for (let i = 0; i < 4; i++) S.box(0.34, 0.22, 0.34, MAT.inductor, mx(1.35 + (i % 2) * 0.48), Y.top + 0.11, i < 2 ? -0.62 : 0.62);
  S.box(0.3, 0.06, 0.3, MAT.pcbBlack, mx(2.35), Y.top + 0.03, -0.62);
  S.box(0.4, 0.06, 0.4, MAT.pcbBlack, mx(2.35), Y.top + 0.03, 0.62);

  // ---- the DSP ----
  const DSPX = mx(3.9), DH = 0.75;
  const dspGroup = new THREE.Group(); scene.add(dspGroup);
  const sub = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 1.5), MAT.pcbBlack); sub.position.set(DSPX, Y.top + 0.05, 0); sub.castShadow = true; dspGroup.add(sub);
  const dspTop = new THREE.MeshStandardMaterial({ map: dspTex(), roughness: 0.34, metalness: 0.45, envMapIntensity: 0.5, emissive: 0xff6a1a, emissiveIntensity: 0 });
  const dsp = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.06, 0.95), [M.dieSide, M.dieSide, dspTop, M.dieSide, M.dieSide, M.dieSide]); dsp.position.set(DSPX, Y.top + 0.13, 0); dspGroup.add(dsp);
  const ghost = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.01, 1.5), new THREE.MeshBasicMaterial({ color: 0x8fd3ff, transparent: true, opacity: 0.16, depthWrite: false }));
  ghost.position.set(DSPX, Y.top + 0.006, 0); ghost.visible = false; scene.add(ghost);
  const ghostEdge = outline(scene, ghost.geometry, [DSPX, Y.top + 0.006, 0], 0x8fd3ff, 0.7); ghostEdge.visible = false;

  // ---- the driver (transmit) and the TIA (receive): separate chips on separate sides ----
  const DRVX = mx(6.15), CW_ = 0.55, CD = 0.7, zDrv = -0.5, zTia = 0.5;
  const drvTop = die(scene, M, CW_, 0.06, CD, null, DRVX, Y.top + 0.03, zDrv); drvTop.color = new THREE.Color(0x3e4a66);
  const tiaTop = die(scene, M, CW_, 0.06, CD, null, DRVX, Y.top + 0.03, zTia); tiaTop.color = new THREE.Color(0x5a3e62);

  // ---- the silicon photonics chip ----
  const PICX0 = mx(6.75), PL = 1.6, PICX1 = PICX0 + PL, PICX = PICX0 + PL / 2, PZ = 0.85, picTopY = Y.top + 0.07;
  die(scene, M, PL, 0.07, PZ * 2, mzmPicTex(), PICX, Y.top + 0.035, 0);
  const cx = px => PICX0 + px / MZM.w * PL, cz = py => -PZ + py / MZM.h * PZ * 2;      // canvas pixel → world
  const txRow = i => cz(MZM.row(i)), rxRow = i => cz(MZM.rxRow(i)), armRow = i => cz(MZM.row(i) - MZM.arm);
  // CW lasers butt-coupled at the chip's left edge, each feeding its own pair of transmit lanes; none on receive
  const lasers = [0, 1, 2, 3].map(k => cz(MZM.laserY(k))), LZX = PICX0 - 0.08;
  lasers.forEach(z => { S.box(0.14, 0.1, 0.1, MAT.gold, LZX, Y.top + 0.05, z); N.box(0.02, 0.03, 0.05, glowMat(COL.cw, 1.6), PICX0 - 0.005, Y.top + 0.07, z); });
  // bond wires: driver → modulator pads (transmit), photodiode pads → TIA (receive)
  for (let i = 0; i < 8; i++) {
    bondWire(N, [DRVX + CW_ / 2 - 0.02, Y.top + 0.06, zDrv - CD / 2 + 0.05 + i * (CD - 0.1) / 7], [cx(MZM.padX), picTopY, cz(MZM.row(i) - 8)], 0.16);   // over the lasers, to the pad ahead of the electrodes
    bondWire(N, [cx(MZM.rxPadX), picTopY, rxRow(i)], [DRVX + CW_ / 2 - 0.02, Y.top + 0.06, zTia - CD / 2 + 0.05 + i * (CD - 0.1) / 7]);
  }
  // the fiber attach block at the coupling edge
  const FAUX = PICX1 + 0.15;
  S.box(0.3, 0.2, PZ * 2 - 0.1, M.glass, FAUX, Y.top + 0.1, 0);

  // ---- the fibers and the two MPO-12 connectors (DR4 each: 4 transmit, 4 unused, 4 receive) ----
  const MPOX = MX1 - 0.45, mpoY = Y.top + 0.22, MPOZ = [-0.45, 0.45], pos = (c, k) => MPOZ[c] + (k - 5.5) * 0.06;
  const txEnd = i => [i < 4 ? 0 : 1, i % 4], rxEnd = i => [i < 4 ? 0 : 1, 8 + i % 4];
  const fiberPath = (zStart, [c, k], lift) => [[FAUX + 0.15, Y.top + 0.1, zStart], [(FAUX + MPOX) / 2, Y.top + 0.1 + lift, (zStart + pos(c, k)) / 2], [MPOX - 0.3, mpoY, pos(c, k)]];
  for (let i = 0; i < 8; i++) { strand(N, fiberPath(txRow(i), txEnd(i), 0.12), M.fiberTx, 0.011); strand(N, fiberPath(rxRow(i), rxEnd(i), 0.22), M.fiberRx, 0.011); }
  MPOZ.forEach((zc, c) => {
    S.box(0.6, 0.5, 0.78, MAT.polymer, MPOX, mpoY, zc);
    S.box(0.08, 0.12, 0.72, MAT.nickel, MPOX + 0.33, mpoY, zc);
    for (let k = 0; k < 12; k++) N.box(0.02, 0.035, 0.035, k < 4 ? glowMat(COL.tx, 1.4) : k >= 8 ? glowMat(COL.rx, 1.4) : MAT.darkSteel, MPOX + 0.38, mpoY, pos(c, k));
  });

  // ---- copper traces: host side (fingers ↔ DSP) and line side (DSP ↔ driver / TIA), a differential pair per lane ----
  const hostZ = (i, rx) => (rx ? 0.16 : -0.86) + i * 0.1;                        // eight lanes each way at the fingers
  const dspEdgeZ = z => z * 0.78, lineZ = (i, rx) => (rx ? zTia : zDrv) - CD / 2 + 0.06 + i * (CD - 0.12) / 7;
  const pair = (B, pts) => { for (const d of [-0.022, 0.022]) for (let k = 0; k < pts.length - 1; k++) trace(B, [pts[k][0], pts[k][1] + d], [pts[k + 1][0], pts[k + 1][1] + d], Y.top + 0.002, 0.018); };
  for (let i = 0; i < 8; i++) for (const rx of [false, true]) {
    const z = hostZ(i, rx), lz = lineZ(i, rx);
    pair(TD, [[mx(0.62), z], [DSPX - 1.1, z], [DSPX - DH, dspEdgeZ(z)]]);          // host side
    pair(TD, [[DSPX + DH, dspEdgeZ(z)], [DRVX - 0.7, lz], [DRVX - CW_ / 2, lz]]);   // line side
    pair(TL, [[mx(0.62), z], [DRVX - 1.4, z], [DRVX - 0.7, lz], [DRVX - CW_ / 2, lz]]);   // LPO: straight from the host to the linear driver / TIA
  }
  const tracesDsp = TD.build({ cast: false }), tracesLpo = TL.build({ cast: false }); tracesLpo.visible = false;
  scene.add(tracesDsp, tracesLpo);

  // ---- shell top with fins, lifted; the gap pad over the DSP ----
  const pad = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 1.2), new THREE.MeshStandardMaterial({ color: 0xd87aa0, roughness: 0.8, transparent: true, opacity: 0.85 }));
  pad.position.set(DSPX, 2.35, 0); scene.add(pad);
  lidBox(scene, M, LEN, MW, [0, Y.lid, 0]);
  const finMat = new THREE.MeshStandardMaterial({ map: finTex(), color: 0xc2c9d0, metalness: 0.8, roughness: 0.35, transparent: true, opacity: 0.3, depthWrite: false });
  for (let i = 0; i < 26; i++) { const f = new THREE.Mesh(new THREE.BoxGeometry(LEN - 2.2, 0.62, 0.035), finMat); f.position.set(-0.6, Y.lid + 0.38, -MW / 2 + 0.12 + i * 0.08); scene.add(f); }
  scene.add(S.build()); scene.add(N.build({ cast: false }));

  // ======================= flows, each on its drawn path =======================
  const yT = Y.top + 0.01, yD = Y.top + 0.17, yC = Y.top + 0.07;
  for (const i of [0, 2, 5, 7]) {
    const z = hostZ(i, false), lz = lineZ(i, false), zr = hostZ(i, true), lzr = lineZ(i, true);
    // transmit: electrical from the host to the modulator, then light out
    const a = flow([[MX0 - 0.9, yT, z], [mx(0.62), yT, z], [DSPX - 1.1, yT, z], [DSPX - DH, yT, dspEdgeZ(z)], [DSPX + DH, yD, dspEdgeZ(z)], [DRVX - 0.7, yT, lz], [DRVX - CW_ / 2, yT, lz], [DRVX + CW_ / 2, yC, lz], [cx(MZM.padX), picTopY + 0.02, cz(MZM.row(i) - 8)]], 'eth', FLOW.elec);
    const aL = flow([[MX0 - 0.9, yT, z], [mx(0.62), yT, z], [DRVX - 1.4, yT, z], [DRVX - 0.7, yT, lz], [DRVX - CW_ / 2, yT, lz], [DRVX + CW_ / 2, yC, lz], [cx(MZM.padX), picTopY + 0.02, cz(MZM.row(i) - 8)]], 'eth', FLOW.elec);
    // modulated light rides one arm of its modulator, then the lane's waveguide to the fiber edge
    const b = flow([[cx(MZM.mzIn), picTopY + 0.01, txRow(i)], [cx(MZM.mzIn + 20), picTopY + 0.01, armRow(i)], [cx(MZM.mzOut - 20), picTopY + 0.01, armRow(i)], [cx(MZM.mzOut), picTopY + 0.01, txRow(i)], [PICX1, picTopY + 0.01, txRow(i)], ...fiberPath(txRow(i), txEnd(i), 0.12), [MX1 + 0.6, mpoY, pos(...txEnd(i))]], 'tx', FLOW.light);
    // receive: light in to a photodiode, then electrical back to the host
    const c = flow([[MX1 + 0.6, mpoY, pos(...rxEnd(i))], ...fiberPath(rxRow(i), rxEnd(i), 0.22).reverse(), [PICX1, picTopY + 0.01, rxRow(i)], [cx(MZM.pdX), picTopY + 0.01, rxRow(i)]], 'rx', FLOW.light);
    const d = flow([[cx(MZM.rxPadX), picTopY + 0.02, rxRow(i)], [DRVX + CW_ / 2, yC, lzr], [DRVX - CW_ / 2, yT, lzr], [DRVX - 0.7, yT, lzr], [DSPX + DH, yD, dspEdgeZ(zr)], [DSPX - DH, yT, dspEdgeZ(zr)], [DSPX - 1.1, yT, zr], [mx(0.62), yT, zr], [MX0 - 0.9, yT, zr]], 'eth', FLOW.elec);
    const dL = flow([[cx(MZM.rxPadX), picTopY + 0.02, rxRow(i)], [DRVX + CW_ / 2, yC, lzr], [DRVX - CW_ / 2, yT, lzr], [DRVX - 0.7, yT, lzr], [DRVX - 1.4, yT, zr], [mx(0.62), yT, zr], [MX0 - 0.9, yT, zr]], 'eth', FLOW.elec);
    dataFlows.push(a, b, c, d, aL, dL); dspOnly.add(a).add(d); lpoOnly.add(aL).add(dL);
  }
  // laser light, no data: from each laser into the chip's left edge, split to its two lanes' modulators
  lasers.forEach((z, k) => { for (const j of [0, 1]) dataFlows.push(flow([[LZX, picTopY + 0.01, z], [cx(MZM.split), picTopY + 0.01, z], [cx(MZM.split + 30), picTopY + 0.01, txRow(2 * k + j)], [cx(MZM.mzIn), picTopY + 0.01, txRow(2 * k + j)]], 'cw', FLOW.cw)); });
  // power: 3.3 V in at the fingers, the converters, then rails to each chip
  for (let i = 0; i < 4; i++) flows.push(flow([[MX0 - 1.1, yT, -0.9 + i * 0.6], [mx(0.3), yT, -0.9 + i * 0.6], [mx(1.5), Y.top + 0.12, i < 2 ? -0.62 : 0.62]], 'v33', FLOW.power));
  const railTo = (x, z, set) => { const f = flow([[mx(2.0), yT, z * 0.4], [x, Y.top + 0.1, z]], 'core', FLOW.power); flows.push(f); if (set) set.add(f); };
  railTo(DSPX, 0, dspOnly); railTo(DRVX, zDrv); railTo(DRVX, zTia); lasers.forEach(z => railTo(LZX, z));
  // heat: the DSP's heat through the pad into the shell, then out through the fins
  for (let i = 0; i < 10; i++) { const x = DSPX + (i % 5 - 2) * 0.16, z = (Math.floor(i / 5) - 0.5) * 0.4; const f = flow([[x, Y.top + 0.16, z], [x, Y.lid, z], [x, Y.lid + 1.2, z]], 'hot', FLOW.heat); heatFlows.push(f); dspOnly.add(f); }
  for (const z of [zDrv, zTia]) heatFlows.push(flow([[DRVX, Y.top + 0.06, z], [DRVX, Y.lid, z * 0.5], [DRVX, Y.lid + 1.0, z * 0.5]], 'hot', FLOW.heat));
  for (let i = 0; i < 6; i++) heatFlows.push(flow([[MX1 + 1.2, Y.lid + 0.4, -0.9 + i * 0.36], [MX0 - 1.2, Y.lid + 0.4, -0.9 + i * 0.36]], 'air', FLOW.heat));
  [flows, dataFlows, heatFlows].forEach(a => a.forEach(f => scene.add(f.group)));

  // ======================= what the reader should know at a glance =======================
  label(scene, 'Pluggable module · 1.6T DR8, OSFP', [0, -0.35, 2.6], '#e8ecf2', 0.34);
  label(scene, '107.8 × 22.58 mm · layers pulled apart · parts representative', [0, -0.75, 2.6], note, 0.18);
  label(scene, '1 module = 1.6T each way, over 16 fibers', [0, -1.05, 2.6], unitCol, 0.18);
  label(scene, 'TX · 8 lanes in', [MX0 - 0.9, 1.75, -0.55], COL.tx, 0.16);
  label(scene, 'RX · 8 lanes out', [MX0 - 0.9, 1.75, 0.55], COL.rx, 0.16);
  label(scene, 'Electrical · copper traces', [DSPX - 1.2, 1.9, -1.45], COL.elec, 0.14);
  label(scene, 'Bond wires', [(DRVX + PICX0) / 2, 1.9, -1.45], '#e6c46b', 0.14);
  label(scene, 'Light · waveguides on the chip', [PICX, 2.1, -1.45], COL.tx, 0.14);
  label(scene, 'Light · glass fiber', [(FAUX + MPOX) / 2 + 0.2, 1.9, -1.45], COL.tx, 0.14);
  const lpoTag = label(scene, 'LPO · no DSP: host lanes go straight to the linear driver and TIA', [DSPX, 2.0, 0], '#8fd3ff', 0.15); lpoTag.visible = false;

  function setLpo(on) {
    lpo.on = on;
    dspGroup.visible = pad.visible = !on; ghost.visible = ghostEdge.visible = lpoTag.visible = on;
    tracesDsp.visible = !on; tracesLpo.visible = on;
  }
  const view = (p, v, t) => ({ pos: p, view: { pos: v, target: t } });
  const hs = {
    fingers: view([mx(0.3), Y.top + 0.1, 0.9], [mx(-1.6), 3.6, 3.6], [mx(0.8), Y.top, 0]),
    dcdc: view([mx(1.6), Y.top + 0.3, -0.62], [mx(0.8), 3.8, 3.6], [mx(1.9), Y.top, 0]),
    dsp: view([DSPX, Y.top + 0.2, 0.3], [DSPX - 0.6, 4.4, 3.8], [DSPX, Y.top, 0]),
    driver: view([DRVX, Y.top + 0.1, zDrv], [DRVX - 0.4, 3.4, 2.6], [DRVX + 0.3, Y.top, -0.3]),
    lasers: view([LZX, Y.top + 0.15, lasers[1]], [LZX - 0.6, 3.0, 1.9], [LZX + 0.3, Y.top, lasers[1]]),
    mzm: view([cx(340), picTopY + 0.05, armRow(3)], [PICX - 0.3, 3.2, 2.4], [PICX, Y.top, -0.3]),
    mpo: view([MPOX, mpoY + 0.3, 0], [MX1 + 1.8, 3.2, 3.4], [MPOX - 0.5, Y.top, 0]),
    pd: view([cx(MZM.pdX), picTopY + 0.05, rxRow(4)], [PICX - 0.6, 3.0, 2.8], [PICX0 + 0.3, Y.top, 0.4]),
    tia: view([DRVX, Y.top + 0.1, zTia], [DRVX - 0.4, 3.2, 3.0], [DRVX + 0.3, Y.top, 0.3]),
    shell: view([-0.6, Y.lid + 0.7, -0.6], [0, 7.5, 7.5], [0, 2, 0]),
  };
  return {
    scene, flows, dataFlows, heatFlows,
    camera: { pos: [1.2, 8.6, 10.5], target: [0, 1.3, 0], near: 0.05, far: 300, min: 1.2, max: 40, portrait: { pos: [0.6, 12.5, 16.5], target: [0, 0.9, 0.4] } },
    hotspots: { fingers: hs.fingers, dcdc: hs.dcdc, dsp: hs.dsp, driver: hs.driver, lasers: hs.lasers },
    dataHotspots: { fingers: hs.fingers, dsp: hs.dsp, driver: hs.driver, lasers: hs.lasers, mzm: hs.mzm, mpo: hs.mpo, pd: hs.pd, tia: hs.tia },
    heatHotspots: { dsp: hs.dsp, shell: hs.shell },
    variant: { get lpo() { return lpo.on; }, setLpo },
    update(t) {
      const m = state.mode;
      // a flow shows in its own layer, and only in the variant whose path it follows
      const show = (list, mode) => list.forEach(f => (f.group.visible = m === mode && !(lpo.on ? dspOnly.has(f) : lpoOnly.has(f))));
      show(flows, 'power'); show(dataFlows, 'data'); show(heatFlows, 'heat');
      dspTop.emissiveIntensity = m === 'heat' ? 0.5 + 0.08 * Math.sin(t * 2) : 0;
    },
  };
}
