// Side level: inside a 1.6T twin-port pluggable module (OSFP, 2 × DR4), exploded, and its LPO variant. World unit = 1 cm.
// The footprint is drawn to its published size and the layers are pulled apart vertically; the parts inside are
// representative (this research pass found no suitable public teardown).
// One shared DSP and PIC, with eight TX channels on one side and eight RX on the other.
// Two independent 800G optical ports retain four TX and four RX fibers each. This internal
// chip partition is representative; independent ports do not establish physical chip counts.
// TX: host → DSP → driver → Mach-Zehnder modulators, lit by CW lasers → fiber → connector.
// RX: connector → fiber → photodiodes → TIA → DSP → host.
import { MODULE_VARIANTS, LRO_COLOR, inVariant, lroDieTop, lroIntro, lroPartCopy } from './module-lro.js';
import { THREE, MAT, Builder, flow, setup, materials, die, strand, trace, bondWire, label, lidBox, outline, FLOW, COL, note, unitCol, finTex, glowMat, canvasTex } from './side-kit.js';

// A representative shared PIC: eight TX lanes, eight RX lanes; four CW sources feed TX only.
const EMZ = { w: 640, h: 680, row: i => 26 + i * 40, laserY: k => 46 + k * 80, split: 60, mzIn: 250, mzOut: 440, arm: 7, padX: 232, rxRow: i => 360 + i * 40, pdX: 68, rxPadX: 25 };
function ePicTex() {
  return canvasTex(EMZ.w, EMZ.h, (g, w, h) => {
    g.fillStyle = '#4a5468'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < 26; i++) g.fillRect(0, i * 13, w, 1);
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (let k = 0; k < 4; k++) {                                            // a laser input, split into its two lanes
      const y = EMZ.laserY(k), a = EMZ.row(2 * k), b = EMZ.row(2 * k + 1);
      g.strokeStyle = 'rgba(255,179,71,0.9)'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(0, y); g.lineTo(EMZ.split, y); g.lineTo(EMZ.split + 30, a); g.lineTo(EMZ.mzIn, a); g.moveTo(EMZ.split, y); g.lineTo(EMZ.split + 30, b); g.lineTo(EMZ.mzIn, b); g.stroke();
    }
    for (let i = 0; i < 8; i++) {
      const y = EMZ.row(i), A = EMZ.arm;
      g.strokeStyle = 'rgba(98,230,255,0.95)'; g.lineWidth = 2.5;           // Mach-Zehnder: split, two arms, recombine
      g.beginPath(); g.moveTo(EMZ.mzIn, y); g.lineTo(EMZ.mzIn + 20, y - A); g.lineTo(EMZ.mzOut - 20, y - A); g.lineTo(EMZ.mzOut, y); g.moveTo(EMZ.mzIn, y); g.lineTo(EMZ.mzIn + 20, y + A); g.lineTo(EMZ.mzOut - 20, y + A); g.lineTo(EMZ.mzOut, y); g.lineTo(w - 14, y); g.stroke();
      g.fillStyle = 'rgba(201,161,74,0.85)'; g.fillRect(EMZ.mzIn + 26, y - A - 6, EMZ.mzOut - EMZ.mzIn - 52, 3); g.fillRect(EMZ.mzIn + 26, y + A + 3, EMZ.mzOut - EMZ.mzIn - 52, 3);   // electrodes
      g.fillStyle = 'rgba(201,161,74,0.95)'; g.fillRect(EMZ.padX - 8, y - 12, 16, 8);                                          // the driver's bond pad
      g.strokeStyle = 'rgba(201,161,74,0.7)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(EMZ.padX + 8, y - 8); g.lineTo(EMZ.mzIn + 26, y - A - 5); g.stroke();
    }
    g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(0, (EMZ.row(7) + EMZ.rxRow(0)) / 2, w, 2);   // the divide
    for (let i = 0; i < 8; i++) {
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
  const TDr = new Builder(), TLr = new Builder();   // their receive halves, apart so LRO can keep DSP transmit + linear receive
  const flows = [], dataFlows = [], heatFlows = [];
  const dspOnly = new Set(), lpoOnly = new Set(), rxSide = new Set();
  const lpo = { on: false, kind: 'dsp' };

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

  // ---- package positions along the module length ----
  const DSPX = mx(3.9), DRVX = mx(6.15), CW_ = 0.55, ECD = 0.95;
  const PICX0 = mx(6.75), PL = 1.6, PICX1 = PICX0 + PL, PICX = PICX0 + PL / 2, picTopY = Y.top + 0.07;
  const cx = px => PICX0 + px / EMZ.w * PL;      // canvas pixel x → world x, same for both engines
  const FAUX = PICX1 + 0.15;                     // the fiber attach block sits just past the coupling edge

  // ---- the two MPO-12 connectors, one per port (DR4 each: 4 transmit, 4 unused, 4 receive) ----
  const MPOX = MX1 - 0.45, mpoY = Y.top + 0.22, MPOZ = [0.45, -0.45], pos = (c, k) => MPOZ[c] + (5.5 - k) * 0.06;
  const fiberPath = (zStart, [c, k], lift) => [[FAUX + 0.15, Y.top + 0.1, zStart], [(FAUX + MPOX) / 2, Y.top + 0.1 + lift, (zStart + pos(c, k)) / 2], [MPOX - 0.3, mpoY, pos(c, k)]];
  MPOZ.forEach((zc, c) => {
    S.box(0.6, 0.5, 0.78, MAT.polymer, MPOX, mpoY, zc);
    S.box(0.08, 0.12, 0.72, MAT.nickel, MPOX + 0.33, mpoY, zc);
    for (let k = 0; k < 12; k++) N.box(0.02, 0.035, 0.035, k < 4 ? glowMat(COL.tx, 1.4) : k >= 8 ? glowMat(COL.rx, 1.4) : MAT.darkSteel, MPOX + 0.38, mpoY, pos(c, k));
  });

  // One shared eight-lane DSP, thermal pad and absent-in-LPO outline.
  const dspGroup = new THREE.Group(); scene.add(dspGroup);
  const sub = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 1.5), MAT.pcbBlack); sub.position.set(DSPX, Y.top + 0.05, 0); sub.castShadow = true; dspGroup.add(sub);
  const dspMarking = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#344660'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ecf4ff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 48px monospace';
    ['DSP', '8 × 200G', '1.6T'].forEach((text, i) => g.fillText(text, w / 2, h / 2 + (i - 1) * 76));
  });
  const dspTop = new THREE.MeshStandardMaterial({ map: dspMarking, roughness: 0.34, metalness: 0.45, envMapIntensity: 0.5, emissive: 0xff6a1a, emissiveIntensity: 0 });
  const dsp = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 1.1), [M.dieSide, M.dieSide, dspTop, M.dieSide, M.dieSide, M.dieSide]); dsp.position.set(DSPX, Y.top + 0.13, 0); dspGroup.add(dsp);
  const pad = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.12, 1.2), new THREE.MeshStandardMaterial({ color: 0xd87aa0, roughness: 0.8, transparent: true, opacity: 0.85 }));
  pad.position.set(DSPX, 2.35, 0); scene.add(pad);
  const ghost = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.01, 1.5), new THREE.MeshBasicMaterial({ color: 0x8fd3ff, transparent: true, opacity: 0.16, depthWrite: false }));
  ghost.position.set(DSPX, Y.top + 0.006, 0); ghost.visible = false; scene.add(ghost);
  const ghostEdge = outline(scene, ghost.geometry, [DSPX, Y.top + 0.006, 0], 0x8fd3ff, 0.7); ghostEdge.visible = false;

  // A shared eight-channel analog front end; the fiber fan-out assigns four lanes to each port.
  function buildEngine() {
    const zDrv = 0.5, zTia = -0.5, z0 = 0;
    const cz = py => 0.95 - (py / EMZ.h) * 1.9;
    const txRow = i => cz(EMZ.row(i)), rxRow = i => cz(EMZ.rxRow(i)), armRow = i => cz(EMZ.row(i) - EMZ.arm);
    const hostZ = (i, rx) => (rx ? -0.12 : 0.9) - i * 0.11;
    const lineZ = (i, rx) => rx ? rxRow(i) : txRow(i);

    // the driver (transmit) and the TIA (receive): separate chips, one on each side of this engine's centerline
    const drvTop = die(scene, M, CW_, 0.06, ECD, null, DRVX, Y.top + 0.03, zDrv); drvTop.color = new THREE.Color(0x3e4a66);
    const tiaTop = die(scene, M, CW_, 0.06, ECD, null, DRVX, Y.top + 0.03, zTia); tiaTop.color = new THREE.Color(0x5a3e62);

    // this engine's own silicon photonics chip
    die(scene, M, PL, 0.07, 1.9, ePicTex(), PICX, Y.top + 0.035, z0);
    // CW lasers butt-coupled at the chip's left edge, each feeding its own pair of transmit lanes; none on receive
    const lasers = [0, 1, 2, 3].map(k => cz(EMZ.laserY(k))), LZX = PICX0 - 0.08;
    lasers.forEach(z => { S.box(0.14, 0.1, 0.1, MAT.gold, LZX, Y.top + 0.05, z); N.box(0.02, 0.03, 0.05, glowMat(COL.cw, 1.6), PICX0 - 0.005, Y.top + 0.07, z); });
    // bond wires: driver → modulator pads (transmit), photodiode pads → TIA (receive)
    for (let i = 0; i < 8; i++) {
      bondWire(N, [DRVX + CW_ / 2 - 0.02, Y.top + 0.06, lineZ(i, false)], [cx(EMZ.padX), picTopY, cz(EMZ.row(i) - 10)], 0.16);
      bondWire(N, [cx(EMZ.rxPadX), picTopY, rxRow(i)], [DRVX + CW_ / 2 - 0.02, Y.top + 0.06, lineZ(i, true)]);
    }
    // the fiber attach block at the coupling edge
    S.box(0.3, 0.2, 1.85, M.glass, FAUX, Y.top + 0.1, z0);

    // Separate fiber banks fan out to their assigned MPO-12 port
    const txEnd = i => [Math.floor(i / 4), i % 4], rxEnd = i => [Math.floor(i / 4), 8 + i % 4];
    for (let i = 0; i < 8; i++) { strand(N, fiberPath(txRow(i), txEnd(i), 0.12), M.fiberTx, 0.011); strand(N, fiberPath(rxRow(i), rxEnd(i), 0.4), M.fiberRx, 0.011); }

    // copper traces: host side (fingers ↔ DSP) and line side (DSP ↔ driver / TIA), a differential pair per lane
    const pair = (B, pts) => { for (const d of [-0.022, 0.022]) for (let k = 0; k < pts.length - 1; k++) trace(B, [pts[k][0], pts[k][1] + d], [pts[k + 1][0], pts[k + 1][1] + d], Y.top + 0.002, 0.018); };
    for (let i = 0; i < 8; i++) for (const rx of [false, true]) {
      const z = hostZ(i, rx), lz = lineZ(i, rx);
      pair(rx ? TDr : TD, [[mx(0.62), z], [DSPX - 1.1, z], [DSPX - 0.5, z * 0.7]]);              // host side
      pair(rx ? TDr : TD, [[DSPX + 0.5, z * 0.7], [DRVX - 0.7, lz], [DRVX - CW_ / 2, lz]]);       // line side
      pair(rx ? TLr : TL, [[mx(0.62), z], [DRVX - 1.4, z], [DRVX - 0.7, lz], [DRVX - CW_ / 2, lz]]);   // LPO: straight from the host to the linear driver / TIA
    }

    // ======================= this engine's flows =======================
    const yT = Y.top + 0.01, yD = Y.top + 0.05, yC = Y.top + 0.07;
    for (const i of [0, 2, 5, 7]) {
      const z = hostZ(i, false), lz = lineZ(i, false), zr = hostZ(i, true), lzr = lineZ(i, true);
      const a = flow([[MX0 - 0.9, yT, z], [mx(0.62), yT, z], [DSPX - 1.1, yT, z], [DSPX - 0.5, yT, z * 0.7], [DSPX + 0.5, yD, z * 0.7], [DRVX - 0.7, yT, lz], [DRVX - CW_ / 2, yT, lz], [DRVX + CW_ / 2, yC, lz], [cx(EMZ.padX), picTopY + 0.02, cz(EMZ.row(i) - 10)]], 'eth', FLOW.elec);
      const aL = flow([[MX0 - 0.9, yT, z], [mx(0.62), yT, z], [DRVX - 1.4, yT, z], [DRVX - 0.7, yT, lz], [DRVX - CW_ / 2, yT, lz], [DRVX + CW_ / 2, yC, lz], [cx(EMZ.padX), picTopY + 0.02, cz(EMZ.row(i) - 10)]], 'eth', FLOW.elec);
      const b = flow([[cx(EMZ.mzIn), picTopY + 0.01, txRow(i)], [cx(EMZ.mzIn + 20), picTopY + 0.01, armRow(i)], [cx(EMZ.mzOut - 20), picTopY + 0.01, armRow(i)], [cx(EMZ.mzOut), picTopY + 0.01, txRow(i)], [PICX1, picTopY + 0.01, txRow(i)], ...fiberPath(txRow(i), txEnd(i), 0.12), [MX1 + 0.6, mpoY, pos(...txEnd(i))]], 'tx', FLOW.light);
      const c = flow([[MX1 + 0.6, mpoY, pos(...rxEnd(i))], ...fiberPath(rxRow(i), rxEnd(i), 0.4).reverse(), [PICX1, picTopY + 0.01, rxRow(i)], [cx(EMZ.pdX), picTopY + 0.01, rxRow(i)]], 'rx', FLOW.light);
      const d = flow([[cx(EMZ.rxPadX), picTopY + 0.02, rxRow(i)], [DRVX + CW_ / 2, yC, lzr], [DRVX - CW_ / 2, yT, lzr], [DRVX - 0.7, yT, lzr], [DSPX + 0.5, yD, zr * 0.7], [DSPX - 0.5, yT, zr * 0.7], [DSPX - 1.1, yT, zr], [mx(0.62), yT, zr], [MX0 - 0.9, yT, zr]], 'eth', FLOW.elec);
      const dL = flow([[cx(EMZ.rxPadX), picTopY + 0.02, rxRow(i)], [DRVX + CW_ / 2, yC, lzr], [DRVX - CW_ / 2, yT, lzr], [DRVX - 0.7, yT, lzr], [DRVX - 1.4, yT, zr], [mx(0.62), yT, zr], [MX0 - 0.9, yT, zr]], 'eth', FLOW.elec);
      dataFlows.push(a, b, c, d, aL, dL); dspOnly.add(a).add(d); lpoOnly.add(aL).add(dL); rxSide.add(d).add(dL);
    }
    // laser light, no data: from each laser into the chip's left edge, split to its two lanes' modulators
    lasers.forEach((z, k) => { for (const j of [0, 1]) dataFlows.push(flow([[LZX, picTopY + 0.01, z], [cx(EMZ.split), picTopY + 0.01, z], [cx(EMZ.split + 30), picTopY + 0.01, txRow(2 * k + j)], [cx(EMZ.mzIn), picTopY + 0.01, txRow(2 * k + j)]], 'cw', FLOW.cw)); });
    // power: rails to each chip
    const railTo = (x, z, set) => { const f = flow([[mx(2.0), yT, z * 0.4], [x, Y.top + 0.1, z]], 'core', FLOW.power); flows.push(f); if (set) set.add(f); };
    railTo(DSPX, 0, dspOnly); railTo(DRVX, zDrv); railTo(DRVX, zTia); lasers.forEach(z => railTo(LZX, z));
    // heat: the DSP's heat through the pad into the shell, then out through the fins
    for (let i = 0; i < 5; i++) { const x = DSPX + (i - 2) * 0.16, z = 0; const f = flow([[x, Y.top + 0.16, z], [x, Y.lid, z], [x, Y.lid + 1.2, z]], 'hot', FLOW.heat); heatFlows.push(f); dspOnly.add(f); }
    for (const z of [zDrv, zTia]) heatFlows.push(flow([[DRVX, Y.top + 0.06, z], [DRVX, Y.lid, z * 0.5], [DRVX, Y.lid + 1.0, z * 0.5]], 'hot', FLOW.heat));

    label(scene, 'TX · 8 lanes', [MX0 - 0.9, 1.75, hostZ(3.5, false)], COL.tx, 0.14);
    label(scene, 'RX · 8 lanes', [MX0 - 0.9, 1.6, hostZ(3.5, true)], COL.rx, 0.14);

    const view = (p, v, t) => ({ pos: p, view: { pos: v, target: t } });
    return {
      hs: {
        dsp: view([DSPX, Y.top + 0.2, 0], [DSPX - 0.6, 4.4, 3.8], [DSPX, Y.top, 0]),
        driver: view([DRVX, Y.top + 0.1, zDrv], [DRVX - 0.4, 3.4, 2.6], [DRVX + 0.3, Y.top, zDrv * 0.6]),
        lasers: view([LZX, Y.top + 0.15, lasers[0]], [LZX - 0.6, 3.0, 1.9], [LZX + 0.3, Y.top, lasers[0]]),
        mzm: view([cx(340), picTopY + 0.05, armRow(1)], [PICX - 0.3, 3.2, 2.4], [PICX, Y.top, z0 * 0.6]),
        pd: view([cx(EMZ.pdX), picTopY + 0.05, rxRow(2)], [PICX - 0.6, 3.0, 2.8], [PICX0 + 0.3, Y.top, zTia]),
        tia: view([DRVX, Y.top + 0.1, zTia], [DRVX - 0.4, 3.2, 3.0], [DRVX + 0.3, Y.top, zTia * 0.6]),
      },
    };
  }

  // Shared host supply and airflow.
  for (const z of [-0.6, 0.6]) flows.push(flow([[MX0 - 0.8, Y.top + 0.01, z], [mx(0.6), Y.top + 0.01, z], [mx(2.0), Y.top + 0.01, z * 0.4]], 'v33', FLOW.power));
  for (let i = 0; i < 5; i++) heatFlows.push(flow([[MX1 + 0.8, Y.lid + 1.2, -0.8 + i * 0.4], [MX0 - 0.8, Y.lid + 1.2, -0.8 + i * 0.4]], 'air', FLOW.heat));

  const e1 = buildEngine();

  const tracesDsp = TD.build({ cast: false }), tracesLpo = TL.build({ cast: false }); tracesLpo.visible = false;
  const tracesDspRx = TDr.build({ cast: false }), tracesLpoRx = TLr.build({ cast: false }); tracesLpoRx.visible = false;
  scene.add(tracesDsp, tracesLpo, tracesDspRx, tracesLpoRx);
  const lroMark = lroDieTop({ w: 0.66, d: 1.06 }); lroMark.position.set(DSPX, Y.top + 0.161, 0); lroMark.visible = false; scene.add(lroMark);

  // ---- shell top with fins, lifted ----
  lidBox(scene, M, LEN, MW, [0, Y.lid, 0]);
  const finMat = new THREE.MeshStandardMaterial({ map: finTex(), color: 0xc2c9d0, metalness: 0.8, roughness: 0.35, transparent: true, opacity: 0.3, depthWrite: false });
  for (let i = 0; i < 26; i++) { const f = new THREE.Mesh(new THREE.BoxGeometry(LEN - 2.2, 0.62, 0.035), finMat); f.position.set(-0.6, Y.lid + 0.38, -MW / 2 + 0.12 + i * 0.08); scene.add(f); }
  scene.add(S.build()); scene.add(N.build({ cast: false }));

  [flows, dataFlows, heatFlows].forEach(a => a.forEach(f => scene.add(f.group)));

  // ======================= what the reader should know at a glance =======================
  label(scene, 'Pluggable module · 1.6T twin-port OSFP, 2 × DR4', [0, -0.35, 2.6], '#e8ecf2', 0.34);
  label(scene, '107.8 × 22.58 mm · layers pulled apart · parts representative', [0, -0.75, 2.6], note, 0.18);
  label(scene, 'One DSP · 1.6T · 8 TX + 8 RX · two 800G ports', [0, -1.05, 2.6], unitCol, 0.18);
  label(scene, 'Electrical · copper traces', [DSPX - 1.2, 1.9, -1.45], COL.elec, 0.14);
  label(scene, 'Bond wires', [(DRVX + PICX0) / 2, 1.9, -1.45], '#e6c46b', 0.14);
  label(scene, 'Light · waveguides on the chip', [PICX, 2.1, -1.45], COL.tx, 0.14);
  label(scene, 'Light · glass fiber', [(FAUX + MPOX) / 2 + 0.2, 1.9, -1.45], COL.tx, 0.14);
  const lpoTag = label(scene, 'LPO · no DSP: host lanes go straight to the linear driver and TIA', [DSPX, 2.25, 0], '#8fd3ff', 0.15); lpoTag.visible = false;
  const lroTag = label(scene, 'LRO · DSP retimes transmit only; receive runs linear, TIA to host', [DSPX, 2.25, 0], LRO_COLOR, 0.15); lroTag.visible = false;

  function setVariant(next) {
    const kind = lpo.kind = MODULE_VARIANTS.includes(next) ? next : 'dsp', on = lpo.on = kind === 'lpo';
    dspGroup.visible = pad.visible = !on; ghost.visible = ghostEdge.visible = on;
    lpoTag.visible = on; lroTag.visible = lroMark.visible = kind === 'lro';
    tracesDsp.visible = !on; tracesDspRx.visible = kind === 'dsp';
    tracesLpo.visible = on; tracesLpoRx.visible = kind !== 'dsp';
  }
  const setLpo = on => setVariant(on ? 'lpo' : 'dsp');
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
    variant: { get lpo() { return lpo.on; }, setLpo, get kind() { return lpo.kind; }, set: setVariant,
      intro: mode => lpo.kind === 'lro' ? lroIntro(mode) : null, partCopy: (part, mode) => lpo.kind === 'lro' ? lroPartCopy(part, mode) : part },
    update(t) {
      const m = state.mode;
      // a flow shows in its own layer, and only in the variant whose path it follows
      const owner = f => dspOnly.has(f) ? 'dsp' : lpoOnly.has(f) ? 'lpo' : 'common';
      const show = (list, mode) => list.forEach(f => (f.group.visible = m === mode && inVariant(lpo.kind, owner(f), rxSide.has(f))));
      show(flows, 'power'); show(dataFlows, 'data'); show(heatFlows, 'heat');
      lroTag.visible = lpo.kind === 'lro' && !state.selected;
      const em = m === 'heat' ? 0.5 + 0.08 * Math.sin(t * 2) : 0;
      dspTop.emissiveIntensity = em;
    },
  };
}
