// Side level: inside a 1.6T twin-port pluggable module (OSFP, 2 × DR4), exploded, and its LPO variant. World unit = 1 cm.
// The footprint is drawn to its published size and the layers are pulled apart vertically; the parts inside are
// representative (this research pass found no suitable public teardown).
// NVIDIA's datasheet for this class of module: "This enables it to host two transceivers inside, each with its own
// MPO-12/APC optical connector operating independently." So the module holds TWO independent engines, one per port,
// represented side by side with a visible gap: this illustrative implementation gives each its own DSP, driver, TIA and
// silicon-photonics PIC. The vendor statement establishes independent ports, not separate physical die counts. Here the shared parts are the shell, board, edge connector
// (gold fingers: 8 host lanes each way total, 4 to each engine), power conversion and the controller.
// Inside each engine, transmit runs along its far side (away from the module's centerline), receive along its near
// side (toward the centerline, mirrored for the other engine), each its own chain:
//   TX  host lanes → DSP → driver → bond wires → Mach-Zehnder modulators (lit by the CW lasers) → fiber → connector
//   RX  connector → fiber → photodiodes → bond wires → TIA → DSP → host lanes
import { THREE, MAT, Builder, flow, setup, materials, die, strand, trace, bondWire, label, lidBox, outline, FLOW, COL, note, unitCol, dspTex, finTex, glowMat, canvasTex } from './side-kit.js';

// an engine's PIC: 4 transmit + 4 receive lanes (half the module's total), 2 lasers each splitting to its own pair
// of lanes. Half the row count of the module's total, laid out on the same pixel scale as the driver/TIA/pad x
// positions so those don't need to change between engines.
const EMZ = { w: 640, h: 340, row: i => 26 + i * 40, laserY: k => 46 + k * 80, split: 60, mzIn: 250, mzOut: 440, arm: 7, padX: 232, rxRow: i => 180 + i * 40, pdX: 68, rxPadX: 25 };
function ePicTex() {
  return canvasTex(EMZ.w, EMZ.h, (g, w, h) => {
    g.fillStyle = '#4a5468'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < 26; i++) g.fillRect(0, i * 13, w, 1);
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (let k = 0; k < 2; k++) {                                            // a laser input, split into its two lanes
      const y = EMZ.laserY(k), a = EMZ.row(2 * k), b = EMZ.row(2 * k + 1);
      g.strokeStyle = 'rgba(255,179,71,0.9)'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(0, y); g.lineTo(EMZ.split, y); g.lineTo(EMZ.split + 30, a); g.lineTo(EMZ.mzIn, a); g.moveTo(EMZ.split, y); g.lineTo(EMZ.split + 30, b); g.lineTo(EMZ.mzIn, b); g.stroke();
    }
    for (let i = 0; i < 4; i++) {
      const y = EMZ.row(i), A = EMZ.arm;
      g.strokeStyle = 'rgba(98,230,255,0.95)'; g.lineWidth = 2.5;           // Mach-Zehnder: split, two arms, recombine
      g.beginPath(); g.moveTo(EMZ.mzIn, y); g.lineTo(EMZ.mzIn + 20, y - A); g.lineTo(EMZ.mzOut - 20, y - A); g.lineTo(EMZ.mzOut, y); g.moveTo(EMZ.mzIn, y); g.lineTo(EMZ.mzIn + 20, y + A); g.lineTo(EMZ.mzOut - 20, y + A); g.lineTo(EMZ.mzOut, y); g.lineTo(w - 14, y); g.stroke();
      g.fillStyle = 'rgba(201,161,74,0.85)'; g.fillRect(EMZ.mzIn + 26, y - A - 6, EMZ.mzOut - EMZ.mzIn - 52, 3); g.fillRect(EMZ.mzIn + 26, y + A + 3, EMZ.mzOut - EMZ.mzIn - 52, 3);   // electrodes
      g.fillStyle = 'rgba(201,161,74,0.95)'; g.fillRect(EMZ.padX - 8, y - 12, 16, 8);                                          // the driver's bond pad
      g.strokeStyle = 'rgba(201,161,74,0.7)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(EMZ.padX + 8, y - 8); g.lineTo(EMZ.mzIn + 26, y - A - 5); g.stroke();
    }
    g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(0, (EMZ.row(3) + EMZ.rxRow(0)) / 2, w, 2);   // the divide
    for (let i = 0; i < 4; i++) {
      const y = EMZ.rxRow(i);
      g.strokeStyle = 'rgba(255,122,217,0.9)'; g.lineWidth = 3; g.beginPath(); g.moveTo(w - 14, y); g.lineTo(EMZ.pdX + 16, y); g.stroke();
      g.fillStyle = 'rgba(255,122,217,0.95)'; g.fillRect(EMZ.pdX - 16, y - 9, 32, 18);    // germanium photodiode
      g.fillStyle = 'rgba(201,161,74,0.9)'; g.fillRect(14, y - 6, 22, 12);             // the TIA's bond pad
    }
    g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(w - 14, 0, 14, h);             // the fiber-coupling edge
  });
}

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
  // the edge connector's gold fingers, both faces: the module's only electrical connection, 8 host lanes each way
  // total (4 to each engine, split further inside on the board)
  for (let i = 0; i < 30; i++) { const z = -0.95 + i * 0.066; N.box(0.55, 0.012, 0.045, MAT.gold, mx(0.33), Y.top + 0.006, z); N.box(0.55, 0.012, 0.045, MAT.gold, mx(0.33), Y.pcb - 0.056, z); }
  // power conversion and the controller: shared, feeding both engines' rails
  for (let i = 0; i < 4; i++) S.box(0.34, 0.22, 0.34, MAT.inductor, mx(1.35 + (i % 2) * 0.48), Y.top + 0.11, i < 2 ? -0.62 : 0.62);
  S.box(0.3, 0.06, 0.3, MAT.pcbBlack, mx(2.35), Y.top + 0.03, -0.62);
  S.box(0.4, 0.06, 0.4, MAT.pcbBlack, mx(2.35), Y.top + 0.03, 0.62);

  // ---- x positions shared by both engines: they run in parallel along the module's length, side by side in width ----
  const DSPX = mx(3.9), DRVX = mx(6.15), CW_ = 0.55, ECD = 0.35;
  const PICX0 = mx(6.75), PL = 1.6, PICX1 = PICX0 + PL, PICX = PICX0 + PL / 2, picTopY = Y.top + 0.07;
  const cx = px => PICX0 + px / EMZ.w * PL;      // canvas pixel x → world x, same for both engines
  const FAUX = PICX1 + 0.15;                     // the fiber attach block sits just past the coupling edge

  // ---- the two MPO-12 connectors, one per engine (DR4 each: 4 transmit, 4 unused, 4 receive) ----
  const MPOX = MX1 - 0.45, mpoY = Y.top + 0.22, MPOZ = [-0.45, 0.45], pos = (c, k) => MPOZ[c] + (k - 5.5) * 0.06;
  const fiberPath = (zStart, [c, k], lift) => [[FAUX + 0.15, Y.top + 0.1, zStart], [(FAUX + MPOX) / 2, Y.top + 0.1 + lift, (zStart + pos(c, k)) / 2], [MPOX - 0.3, mpoY, pos(c, k)]];
  MPOZ.forEach((zc, c) => {
    S.box(0.6, 0.5, 0.78, MAT.polymer, MPOX, mpoY, zc);
    S.box(0.08, 0.12, 0.72, MAT.nickel, MPOX + 0.33, mpoY, zc);
    for (let k = 0; k < 12; k++) N.box(0.02, 0.035, 0.035, k < 4 ? glowMat(COL.tx, 1.4) : k >= 8 ? glowMat(COL.rx, 1.4) : MAT.darkSteel, MPOX + 0.38, mpoY, pos(c, k));
  });

  // ---- one engine: its own DSP, driver, TIA, PIC and fiber connector, wholly on one side of the module's
  // centerline. `sign` is which side (-1 or +1); `connIdx` is its MPO connector's index into MPOZ. TX sits toward
  // this engine's far edge, RX toward the centerline it shares with the other engine. ----
  function buildEngine(sign, connIdx, engineLabel) {
    const zDrv = sign * 0.8, zTia = sign * 0.3, z0 = sign * 0.55;             // driver (TX, far), TIA (RX, near), PIC center
    const cz = py => sign * (0.95 - (py / EMZ.h) * 0.8);                     // canvas pixel y → world z, mirrored per engine
    const txRow = i => cz(EMZ.row(i)), rxRow = i => cz(EMZ.rxRow(i)), armRow = i => cz(EMZ.row(i) - EMZ.arm);
    const hostZ = (i, rx) => sign * ((rx ? 0.15 : 0.65) + i * 0.1);           // four lanes each way at the fingers
    const lineZ = (i, rx) => (rx ? zTia : zDrv) - ECD / 2 + 0.04 + i * (ECD - 0.08) / 3;

    // this engine's DSP
    const dspGroup = new THREE.Group(); scene.add(dspGroup);
    const sub = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 1.0), MAT.pcbBlack); sub.position.set(DSPX, Y.top + 0.05, z0); sub.castShadow = true; dspGroup.add(sub);
    const dspTop = new THREE.MeshStandardMaterial({ map: dspTex(), roughness: 0.34, metalness: 0.45, envMapIntensity: 0.5, emissive: 0xff6a1a, emissiveIntensity: 0 });
    const dsp = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.7), [M.dieSide, M.dieSide, dspTop, M.dieSide, M.dieSide, M.dieSide]); dsp.position.set(DSPX, Y.top + 0.13, z0); dspGroup.add(dsp);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.12, 0.85), new THREE.MeshStandardMaterial({ color: 0xd87aa0, roughness: 0.8, transparent: true, opacity: 0.85 }));
    pad.position.set(DSPX, 2.35, z0); scene.add(pad);
    const ghost = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.01, 1.0), new THREE.MeshBasicMaterial({ color: 0x8fd3ff, transparent: true, opacity: 0.16, depthWrite: false }));
    ghost.position.set(DSPX, Y.top + 0.006, z0); ghost.visible = false; scene.add(ghost);
    const ghostEdge = outline(scene, ghost.geometry, [DSPX, Y.top + 0.006, z0], 0x8fd3ff, 0.7); ghostEdge.visible = false;

    // the driver (transmit) and the TIA (receive): separate chips, one on each side of this engine's centerline
    const drvTop = die(scene, M, CW_, 0.06, ECD, null, DRVX, Y.top + 0.03, zDrv); drvTop.color = new THREE.Color(0x3e4a66);
    const tiaTop = die(scene, M, CW_, 0.06, ECD, null, DRVX, Y.top + 0.03, zTia); tiaTop.color = new THREE.Color(0x5a3e62);

    // this engine's own silicon photonics chip
    die(scene, M, PL, 0.07, 0.8, ePicTex(), PICX, Y.top + 0.035, z0);
    // CW lasers butt-coupled at the chip's left edge, each feeding its own pair of transmit lanes; none on receive
    const lasers = [0, 1].map(k => cz(EMZ.laserY(k))), LZX = PICX0 - 0.08;
    lasers.forEach(z => { S.box(0.14, 0.1, 0.1, MAT.gold, LZX, Y.top + 0.05, z); N.box(0.02, 0.03, 0.05, glowMat(COL.cw, 1.6), PICX0 - 0.005, Y.top + 0.07, z); });
    // bond wires: driver → modulator pads (transmit), photodiode pads → TIA (receive)
    for (let i = 0; i < 4; i++) {
      bondWire(N, [DRVX + CW_ / 2 - 0.02, Y.top + 0.06, zDrv - ECD / 2 + 0.04 + i * (ECD - 0.08) / 3], [cx(EMZ.padX), picTopY, cz(EMZ.row(i) - 10)], 0.16);
      bondWire(N, [cx(EMZ.rxPadX), picTopY, rxRow(i)], [DRVX + CW_ / 2 - 0.02, Y.top + 0.06, zTia - ECD / 2 + 0.04 + i * (ECD - 0.08) / 3]);
    }
    // the fiber attach block at the coupling edge
    S.box(0.3, 0.2, 0.7, M.glass, FAUX, Y.top + 0.1, z0);

    // this engine's own fibers to its own MPO-12 connector
    const txEnd = i => [connIdx, i], rxEnd = i => [connIdx, 8 + i];
    for (let i = 0; i < 4; i++) { strand(N, fiberPath(txRow(i), txEnd(i), 0.12), M.fiberTx, 0.011); strand(N, fiberPath(rxRow(i), rxEnd(i), 0.22), M.fiberRx, 0.011); }

    // copper traces: host side (fingers ↔ DSP) and line side (DSP ↔ driver / TIA), a differential pair per lane
    const pair = (B, pts) => { for (const d of [-0.022, 0.022]) for (let k = 0; k < pts.length - 1; k++) trace(B, [pts[k][0], pts[k][1] + d], [pts[k + 1][0], pts[k + 1][1] + d], Y.top + 0.002, 0.018); };
    for (let i = 0; i < 4; i++) for (const rx of [false, true]) {
      const z = hostZ(i, rx), lz = lineZ(i, rx);
      pair(TD, [[mx(0.62), z], [DSPX - 1.1, z], [DSPX - 0.5, z]]);              // host side
      pair(TD, [[DSPX + 0.5, z], [DRVX - 0.7, lz], [DRVX - CW_ / 2, lz]]);       // line side
      pair(TL, [[mx(0.62), z], [DRVX - 1.4, z], [DRVX - 0.7, lz], [DRVX - CW_ / 2, lz]]);   // LPO: straight from the host to the linear driver / TIA
    }

    // ======================= this engine's flows =======================
    const yT = Y.top + 0.01, yD = Y.top + 0.17, yC = Y.top + 0.07;
    for (const i of [0, 3]) {
      const z = hostZ(i, false), lz = lineZ(i, false), zr = hostZ(i, true), lzr = lineZ(i, true);
      const a = flow([[MX0 - 0.9, yT, z], [mx(0.62), yT, z], [DSPX - 1.1, yT, z], [DSPX - 0.5, yT, z], [DSPX + 0.5, yD, z], [DRVX - 0.7, yT, lz], [DRVX - CW_ / 2, yT, lz], [DRVX + CW_ / 2, yC, lz], [cx(EMZ.padX), picTopY + 0.02, cz(EMZ.row(i) - 10)]], 'eth', FLOW.elec);
      const aL = flow([[MX0 - 0.9, yT, z], [mx(0.62), yT, z], [DRVX - 1.4, yT, z], [DRVX - 0.7, yT, lz], [DRVX - CW_ / 2, yT, lz], [DRVX + CW_ / 2, yC, lz], [cx(EMZ.padX), picTopY + 0.02, cz(EMZ.row(i) - 10)]], 'eth', FLOW.elec);
      const b = flow([[cx(EMZ.mzIn), picTopY + 0.01, txRow(i)], [cx(EMZ.mzIn + 20), picTopY + 0.01, armRow(i)], [cx(EMZ.mzOut - 20), picTopY + 0.01, armRow(i)], [cx(EMZ.mzOut), picTopY + 0.01, txRow(i)], [PICX1, picTopY + 0.01, txRow(i)], ...fiberPath(txRow(i), txEnd(i), 0.12), [MX1 + 0.6, mpoY, pos(...txEnd(i))]], 'tx', FLOW.light);
      const c = flow([[MX1 + 0.6, mpoY, pos(...rxEnd(i))], ...fiberPath(rxRow(i), rxEnd(i), 0.22).reverse(), [PICX1, picTopY + 0.01, rxRow(i)], [cx(EMZ.pdX), picTopY + 0.01, rxRow(i)]], 'rx', FLOW.light);
      const d = flow([[cx(EMZ.rxPadX), picTopY + 0.02, rxRow(i)], [DRVX + CW_ / 2, yC, lzr], [DRVX - CW_ / 2, yT, lzr], [DRVX - 0.7, yT, lzr], [DSPX + 0.5, yD, zr], [DSPX - 0.5, yT, zr], [DSPX - 1.1, yT, zr], [mx(0.62), yT, zr], [MX0 - 0.9, yT, zr]], 'eth', FLOW.elec);
      const dL = flow([[cx(EMZ.rxPadX), picTopY + 0.02, rxRow(i)], [DRVX + CW_ / 2, yC, lzr], [DRVX - CW_ / 2, yT, lzr], [DRVX - 0.7, yT, lzr], [DRVX - 1.4, yT, zr], [mx(0.62), yT, zr], [MX0 - 0.9, yT, zr]], 'eth', FLOW.elec);
      dataFlows.push(a, b, c, d, aL, dL); dspOnly.add(a).add(d); lpoOnly.add(aL).add(dL);
    }
    // laser light, no data: from each laser into the chip's left edge, split to its two lanes' modulators
    lasers.forEach((z, k) => { for (const j of [0, 1]) dataFlows.push(flow([[LZX, picTopY + 0.01, z], [cx(EMZ.split), picTopY + 0.01, z], [cx(EMZ.split + 30), picTopY + 0.01, txRow(2 * k + j)], [cx(EMZ.mzIn), picTopY + 0.01, txRow(2 * k + j)]], 'cw', FLOW.cw)); });
    // power: rails to each chip
    const railTo = (x, z, set) => { const f = flow([[mx(2.0), yT, z * 0.4], [x, Y.top + 0.1, z]], 'core', FLOW.power); flows.push(f); if (set) set.add(f); };
    railTo(DSPX, z0, dspOnly); railTo(DRVX, zDrv); railTo(DRVX, zTia); lasers.forEach(z => railTo(LZX, z));
    // heat: the DSP's heat through the pad into the shell, then out through the fins
    for (let i = 0; i < 5; i++) { const x = DSPX + (i - 2) * 0.16, z = z0; const f = flow([[x, Y.top + 0.16, z], [x, Y.lid, z], [x, Y.lid + 1.2, z]], 'hot', FLOW.heat); heatFlows.push(f); dspOnly.add(f); }
    for (const z of [zDrv, zTia]) heatFlows.push(flow([[DRVX, Y.top + 0.06, z], [DRVX, Y.lid, z * 0.5], [DRVX, Y.lid + 1.0, z * 0.5]], 'hot', FLOW.heat));

    label(scene, engineLabel, [DSPX, 2.0, z0], sign < 0 ? COL.tx : COL.rx, 0.15);
    label(scene, 'TX · 4 lanes', [MX0 - 0.9, 1.75, hostZ(1.5, false)], COL.tx, 0.14);
    label(scene, 'RX · 4 lanes', [MX0 - 0.9, 1.6, hostZ(1.5, true)], COL.rx, 0.14);

    const view = (p, v, t) => ({ pos: p, view: { pos: v, target: t } });
    return {
      dspTop, dspGroup, pad, ghost, ghostEdge,
      hs: {
        dsp: view([DSPX, Y.top + 0.2, z0 + sign * 0.25], [DSPX - 0.6, 4.4, 3.8], [DSPX, Y.top, z0]),
        driver: view([DRVX, Y.top + 0.1, zDrv], [DRVX - 0.4, 3.4, 2.6], [DRVX + 0.3, Y.top, zDrv * 0.6]),
        lasers: view([LZX, Y.top + 0.15, lasers[0]], [LZX - 0.6, 3.0, 1.9], [LZX + 0.3, Y.top, lasers[0]]),
        mzm: view([cx(340), picTopY + 0.05, armRow(1)], [PICX - 0.3, 3.2, 2.4], [PICX, Y.top, z0 * 0.6]),
        pd: view([cx(EMZ.pdX), picTopY + 0.05, rxRow(2)], [PICX - 0.6, 3.0, 2.8], [PICX0 + 0.3, Y.top, zTia]),
        tia: view([DRVX, Y.top + 0.1, zTia], [DRVX - 0.4, 3.2, 3.0], [DRVX + 0.3, Y.top, zTia * 0.6]),
      },
    };
  }

  // Shared host supply and airflow remain present around the two independent engines.
  for (const z of [-0.6, 0.6]) flows.push(flow([[MX0 - 0.8, Y.top + 0.01, z], [mx(0.6), Y.top + 0.01, z], [mx(2.0), Y.top + 0.01, z * 0.4]], 'v33', FLOW.power));
  for (let i = 0; i < 5; i++) heatFlows.push(flow([[MX1 + 0.8, Y.lid + 1.2, -0.8 + i * 0.4], [MX0 - 0.8, Y.lid + 1.2, -0.8 + i * 0.4]], 'air', FLOW.heat));

  const e1 = buildEngine(-1, 0, 'Engine 1 · port 1');
  const e2 = buildEngine(1, 1, 'Engine 2 · port 2');
  const engines = [e1, e2];

  const tracesDsp = TD.build({ cast: false }), tracesLpo = TL.build({ cast: false }); tracesLpo.visible = false;
  scene.add(tracesDsp, tracesLpo);

  // ---- shell top with fins, lifted ----
  lidBox(scene, M, LEN, MW, [0, Y.lid, 0]);
  const finMat = new THREE.MeshStandardMaterial({ map: finTex(), color: 0xc2c9d0, metalness: 0.8, roughness: 0.35, transparent: true, opacity: 0.3, depthWrite: false });
  for (let i = 0; i < 26; i++) { const f = new THREE.Mesh(new THREE.BoxGeometry(LEN - 2.2, 0.62, 0.035), finMat); f.position.set(-0.6, Y.lid + 0.38, -MW / 2 + 0.12 + i * 0.08); scene.add(f); }
  scene.add(S.build()); scene.add(N.build({ cast: false }));

  [flows, dataFlows, heatFlows].forEach(a => a.forEach(f => scene.add(f.group)));

  // ======================= what the reader should know at a glance =======================
  label(scene, 'Pluggable module · 1.6T twin-port OSFP, 2 × DR4', [0, -0.35, 2.6], '#e8ecf2', 0.34);
  label(scene, '107.8 × 22.58 mm · layers pulled apart · parts representative', [0, -0.75, 2.6], note, 0.18);
  label(scene, '1 module = 2 × 800G each way, 2 engines, 16 fibers', [0, -1.05, 2.6], unitCol, 0.18);
  label(scene, 'Electrical · copper traces', [DSPX - 1.2, 1.9, -1.45], COL.elec, 0.14);
  label(scene, 'Bond wires', [(DRVX + PICX0) / 2, 1.9, -1.45], '#e6c46b', 0.14);
  label(scene, 'Light · waveguides on the chip', [PICX, 2.1, -1.45], COL.tx, 0.14);
  label(scene, 'Light · glass fiber', [(FAUX + MPOX) / 2 + 0.2, 1.9, -1.45], COL.tx, 0.14);
  const lpoTag = label(scene, 'LPO · no DSP: host lanes go straight to the linear driver and TIA', [DSPX, 2.25, 0], '#8fd3ff', 0.15); lpoTag.visible = false;

  function setLpo(on) {
    lpo.on = on;
    engines.forEach(e => { e.dspGroup.visible = e.pad.visible = !on; e.ghost.visible = e.ghostEdge.visible = on; });
    lpoTag.visible = on;
    tracesDsp.visible = !on; tracesLpo.visible = on;
  }
  const view = (p, v, t) => ({ pos: p, view: { pos: v, target: t } });
  const hs = {
    fingers: view([mx(0.3), Y.top + 0.1, 0.9], [mx(-1.6), 3.6, 3.6], [mx(0.8), Y.top, 0]),
    dcdc: view([mx(1.6), Y.top + 0.3, -0.62], [mx(0.8), 3.8, 3.6], [mx(1.9), Y.top, 0]),
    mpo: view([MPOX, mpoY + 0.3, 0], [MX1 + 1.8, 3.2, 3.4], [MPOX - 0.5, Y.top, 0]),
    shell: view([-0.6, Y.lid + 0.7, -0.6], [0, 7.5, 7.5], [0, 2, 0]),
  };
  return {
    scene, flows, dataFlows, heatFlows,
    camera: { pos: [1.2, 8.6, 10.5], target: [0, 1.3, 0], near: 0.05, far: 300, min: 1.2, max: 40, portrait: { pos: [0.6, 12.5, 16.5], target: [0, 0.9, 0.4] } },
    hotspots: { fingers: hs.fingers, dcdc: hs.dcdc, dsp: e1.hs.dsp, driver: e1.hs.driver, lasers: e1.hs.lasers },
    dataHotspots: { fingers: hs.fingers, dsp: e1.hs.dsp, driver: e1.hs.driver, lasers: e1.hs.lasers, mzm: e1.hs.mzm, mpo: hs.mpo, pd: e1.hs.pd, tia: e1.hs.tia },
    heatHotspots: { dsp: e1.hs.dsp, shell: hs.shell },
    variant: { get lpo() { return lpo.on; }, setLpo },
    update(t) {
      const m = state.mode;
      // a flow shows in its own layer, and only in the variant whose path it follows
      const show = (list, mode) => list.forEach(f => (f.group.visible = m === mode && !(lpo.on ? dspOnly.has(f) : lpoOnly.has(f))));
      show(flows, 'power'); show(dataFlows, 'data'); show(heatFlows, 'heat');
      const em = m === 'heat' ? 0.5 + 0.08 * Math.sin(t * 2) : 0;
      engines.forEach(e => e.dspTop.emissiveIntensity = em);
    },
  };
}
