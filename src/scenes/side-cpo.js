// Side level: inside a co-packaged optics switch package, NVIDIA Photonics style. World unit = 1 cm.
// Counts are NVIDIA's (six optical subassemblies of three engines per switch chip, 18 fibers per engine: 8 transmit,
// 8 receive, 2 laser in; laser modules at the front panel, 32 transmit lanes each; subassemblies socketed, fibers through a
// sealed interface). The package's size and layout, its cold plate and the photonic chip's floorplan are representative.
// Electrical paths: the switch chip's SerDes to each engine through copper traces in the package substrate, then
// down through bonds from the electronic chip to the photonic chip. Light: the laser fibers in, the modulated
// transmit fibers out, the receive fibers in. One engine is drawn again beside the package, lifted and exploded, as
// a labeled 2.5x detail view.
import { THREE, MAT, Builder, flow, setup, materials, die, strand, trace, label, lidBox, outline, FLOW, COL, note, unitCol, asicTex, ringPicTex, RING, eicTex, glowMat } from './side-kit.js';

import { SUBS, OUT, TAN, ASIC_HALF, asicTap, edgeConnOf, engineLayout, elsOf, cpoFiberRoutes } from './side-geometry.js';

export function build({ quality, state, authoredHardware = false, authoredAsicMaterial = null }) {
  const scene = setup(quality, 14), M = materials();
  // Blender owns every physical mesh in the authored variant. Keep this layout
  // calculation as the source of runtime flows, anchors and diagram guides.
  const makeBuilder = () => authoredHardware
    ? { box() {}, cyl() {}, strut() {}, add() {}, build: () => new THREE.Group() }
    : new Builder();
  const S = makeBuilder(), N = makeBuilder();
  const flows = [], dataFlows = [], heatFlows = [];
  const SUB = 10.4, Y = { board: 0, sub: 0.9, subTop: 1.04, inter: 1.45, die: 1.62, eng: 1.65, plate: 4.2 };
  const edgeMetal = new THREE.MeshStandardMaterial({ color: 0x8996a5, metalness: 0.78, roughness: 0.3 });
  const laminateEdge = new THREE.MeshStandardMaterial({ color: 0x394739, metalness: 0.1, roughness: 0.65 });
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  if (!authoredHardware) S.box(SUB + 3.2, 0.14, SUB + 3.2, MAT.pcb, 0, Y.board, 0);
  if (!authoredHardware) S.box(SUB, 0.28, SUB, MAT.pcbBlack, 0, Y.sub, 0);
  // Thin exposed laminate layers and socket hardware establish the package stack
  // without implying a measured routing stack-up or adding invented signal nets.
  for (const z of [-SUB / 2, SUB / 2]) for (const y of [0.82, 0.94]) N.box(SUB, 0.012, 0.012, laminateEdge, 0, y, z);
  for (const x of [-SUB / 2, SUB / 2]) for (const y of [0.82, 0.94]) N.box(0.012, 0.012, SUB, laminateEdge, x, y, 0);
  if (!authoredHardware) for (const x of [-6.15, 6.15]) for (const z of [-6.15, 6.15]) {
    N.cyl(0.19, 0.05, edgeMetal, x, 0.09, z, 12);
    N.box(0.2, 0.012, 0.045, MAT.pcbBlack, x, 0.121, z);
  }
  // One shared interposer supports the switch ASIC and optical engine ring.
  // Its 9 cm square envelope is representative; the common integration is public.
  if (!authoredHardware) S.box(9.0, 0.1, 9.0, MAT.silicon, 0, Y.inter, 0);
  const asicTop = authoredHardware ? authoredAsicMaterial
    : die(scene, M, ASIC_HALF * 2, 0.1, ASIC_HALF * 2, asicTex(), 0, Y.die, 0);

  // ---- engines ----
  const engines = engineLayout();
  if (!authoredHardware) for (const [side, t0] of SUBS) {
    const out = OUT[side], tan = TAN[side], r = 3.35;
    const carrier = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 3.5), MAT.pcbBlack); carrier.position.set(out[0] * r + tan[0] * t0, Y.eng - 0.055, out[1] * r + tan[1] * t0); carrier.rotation.y = -side * Math.PI / 2; scene.add(carrier);
    for (const d of [-0.78, 0.78]) {
      const p = [out[0] * (r + d) + tan[0] * t0, out[1] * (r + d) + tan[1] * t0];
      N.box(0.035, 0.04, 3.5, edgeMetal, p[0], Y.eng - 0.03, p[1], -side * Math.PI / 2);
    }
  }
  if (!authoredHardware) engines.forEach(({ x, z, out, rot }) => {
    die(scene, M, 1.35, 0.06, 0.95, ringPicTex(), x, Y.eng, z, -rot);
    die(scene, M, 1.23, 0.07, 0.902, eicTex(), x, Y.eng + 0.065, z, -rot);
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.8), M.glass); f.position.set(x + out[0] * 0.83, Y.eng + 0.08, z + out[1] * 0.83); f.rotation.y = -rot; scene.add(f);
  });
  // electrical: copper traces in the substrate from the ASIC's SerDes edge to each engine's electronic chip
  const asicEdge = asicTap, eicIn = e => [e.x - e.out[0] * 0.62, e.z - e.out[1] * 0.62];
  engines.forEach(e => {
    const [ax, az] = asicEdge(e), [ex, ez] = eicIn(e);
    for (let j = 0; j < 4; j++) { const o = (j - 1.5) * 0.09, px = e.tan[0] * o, pz = e.tan[1] * o; trace(N, [ax + px, az + pz], [ex + px, ez + pz], Y.subTop + 0.001, 0.03); }
  });
  // light: each engine's 8 transmit and 8 receive fibers to its own connector at the package edge
  const edgeConn = engines.map(e => edgeConnOf(e, SUB));
  const fiberRoutes = engines.map(cpoFiberRoutes);
  engines.forEach(({ out }, i) => {
    const [ex, ez] = edgeConn[i];
    for (const [kind, material] of [['tx', M.fiberTx], ['rx', M.fiberRx], ['cw', M.fiberCw]])
      for (const points of fiberRoutes[i][kind]) strand(N, points, material, kind === 'cw' ? .008 : .007);
    S.box(out[0] !== 0 ? .3 : .7, .3, out[0] !== 0 ? .7 : .3, MAT.polymer, ex, 1.2, ez);
  });
  // the laser modules at the front panel, and each engine's two laser fibers, run round the outside of the package
  // and in through the engine's own connector with its data fibers
  // Five modules are shown: four light four engines each, the fifth lights the last two.
  // This allocation is illustrative; published totals do not specify the cross-package wiring.
  const ELSX = SUB / 2 + 3.0, nEls = elsOf(engines.length - 1) + 1, els = [];
  for (let i = 0; i < nEls; i++) { const z = -4.4 + i * 2.2; if (!authoredHardware) S.box(1.9, 0.9, 1.1, MAT.darkSteel, ELSX, Y.sub + 0.45, z); N.box(0.04, 0.18, 0.5, glowMat(COL.cw, 1.5), ELSX - 0.96, Y.sub + 0.6, z); els.push([ELSX, z]); }
  // the cold plate, lifted and see-through; water in and out straight up
  if (!authoredHardware) {
  const plate = new THREE.Mesh(new THREE.BoxGeometry(SUB - 0.6, 0.35, SUB - 0.6), new THREE.MeshPhysicalMaterial({ color: 0xc98a5c, metalness: 0.6, roughness: 0.45, transparent: true, opacity: 0.12, depthWrite: false }));
  plate.position.set(0, Y.plate, 0); scene.add(plate); outline(scene, plate.geometry, [0, Y.plate, 0], 0xd9a070, 0.6);
  for (const z of [-(SUB - 0.6) / 2, (SUB - 0.6) / 2]) N.box(SUB - 0.6, 0.04, 0.035, edgeMetal, 0, Y.plate + 0.15, z);
  for (const x of [-(SUB - 0.6) / 2, (SUB - 0.6) / 2]) N.box(0.035, 0.04, SUB - 0.6, edgeMetal, x, Y.plate + 0.15, 0);
  }
  const pipeZ = -SUB / 2 + 1.0, pipeTop = Y.plate + 2.6;
  const coolant = makeBuilder();
  for (const [dx, m] of [[-1.4, MAT.pipeBlue], [1.4, MAT.pipeRed]]) coolant.add(new THREE.CylinderGeometry(0.28, 0.28, pipeTop - Y.plate, 16), m, dx, (Y.plate + pipeTop) / 2, pipeZ);
  if (!authoredHardware) for (const dx of [-1.4, 1.4]) coolant.cyl(0.4, 0.16, edgeMetal, dx, Y.plate + 0.23, pipeZ, 12);
  const coolingHardware = coolant.build(); coolingHardware.name = 'CPO cooling pipes'; scene.add(coolingHardware);

  // ---- the detail: one engine, lifted out, exploded, drawn 2.5x ----
  // the detail stands off the back-left corner, clear of every fiber and trace of the package, turned so its fibers
  // leave to the left, away from everything
  const s = 2.5, DX = -(SUB / 2 + 6.2), DY = 1.4, DZ = -(SUB / 2 + 3.2), w = (lx, ly, lz) => [DX - lx, DY + ly, DZ - lz];
  const PW = 1.35 * s, PD = 0.95 * s;
  if (!authoredHardware) die(scene, M, PW, 0.15, PD, ringPicTex(), DX, DY, DZ, Math.PI);
  const EW = 1.23 * s, ED = 0.902 * s, electricalEdge = -EW / 2;
  if (!authoredHardware) die(scene, M, EW, 0.12, ED, eicTex(), ...w(0, 0.95, 0), Math.PI);
  const pcx = px => -PW / 2 + px / RING.w * PW, pcz = py => -PD / 2 + py / RING.h * PD;
  const ringAt = i => [pcx(RING.ringX(i)), pcz(RING.row(i) - RING.ringR - RING.ringGap)], txRowZ = i => pcz(RING.row(i)), rxRowZ = i => pcz(RING.rxRow(i)), pdX = pcx(RING.pdX);
  const ringBondAt = i => [pcx(RING.ringX(i)), pcz(RING.row(i) - RING.ringR * 2 - RING.ringGap - 4.5)];
  // Paired pads mark face-to-face bonding; dashed registration guides cross the
  // exploded gap. They are not centimeter-long copper bond wires in a real engine.
  const bondGuides = [];
  for (let i = 0; i < 8; i++) {
    const [rx_, rz] = ringBondAt(i);
    for (const [px, pz] of [[rx_, rz], [pdX, rxRowZ(i)]]) {
      for (const y of [0.09, 0.88]) N.cyl(0.033, 0.025, MAT.gold, ...w(px, y, pz), 8);
      bondGuides.push(...w(px, 0.12, pz), ...w(px, 0.85, pz));
    }
  }
  const guide = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(bondGuides, 3)),
    new THREE.LineDashedMaterial({ color: 0x8292a6, dashSize: 0.06, gapSize: 0.055, transparent: true, opacity: 0.4 }));
  guide.computeLineDistances(); scene.add(guide);
  // Neutral diagram corner marks distinguish the separate detail from hardware.
  const corners = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = DX + sx * 4.6, z = DZ + sz * 2.25, y = DY - 0.25;
    corners.push(x - sx * 0.45, y, z, x, y, z, x, y, z, x, y, z - sz * 0.45);
  }
  scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(corners, 3)),
    new THREE.LineBasicMaterial({ color: 0x617187, transparent: true, opacity: 0.55 })));
  // the fiber attach and all 18 fibers: 8 transmit, 8 receive, 2 laser in
  S.box(0.4, 0.4, PD - 0.2, M.glass, ...w(PW / 2 + 0.2, 0.1, 0));
  for (let i = 0; i < 8; i++) { strand(N, [w(PW / 2 + 0.4, 0.1, txRowZ(i)), w(PW / 2 + 2.6, 0.1, txRowZ(i))], M.fiberTx, 0.02); strand(N, [w(PW / 2 + 0.4, 0.14, rxRowZ(i)), w(PW / 2 + 2.6, 0.14, rxRowZ(i))], M.fiberRx, 0.02); }
  for (const d of [-0.07, 0.07]) strand(N, [w(PW / 2 + 0.4, 0.1, pcz(RING.busY) + d), w(PW / 2 + 2.6, 0.1, pcz(RING.busY) + d)], M.fiberCw, 0.02);
  // the electrical side: a stub of package trace from the switch chip into the electronic chip
  for (let j = 0; j < 6; j++) N.box(1.6, 0.01, 0.05, MAT.copper, ...w(electricalEdge - 0.8, 0.95, -0.55 + j * 0.22));
  const EQ = engines[6];                                 // a back-side engine, the one nearest the detail
  const eqGeo = new THREE.BoxGeometry(1.55, 0.34, 1.15);
  outline(scene, eqGeo, [EQ.x, Y.eng + 0.08, EQ.z], 0x62e6ff, 0.9, -EQ.rot);
  // a dotted leader from the detail to the engine it shows
  const eqTop = Y.eng + 0.08 + 0.17;
  const leader = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(DX + PW / 2 + 0.3, DY + 1.6, DZ),
    new THREE.Vector3(DX + PW / 2 + 1.2, DY + 1.6, DZ),
    new THREE.Vector3(EQ.x, eqTop + 0.8, EQ.z), new THREE.Vector3(EQ.x, eqTop, EQ.z),
  ]), new THREE.LineDashedMaterial({ color: 0x8a96a8, dashSize: 0.18, gapSize: 0.14, transparent: true, opacity: 0.8 }));
  leader.computeLineDistances(); scene.add(leader);
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), new THREE.MeshBasicMaterial({ color: 0x8a96a8 })); dot.position.set(EQ.x, eqTop, EQ.z); scene.add(dot);
  scene.add(S.build()); scene.add(N.build({ cast: false }));

  // ======================= flows =======================
  engines.forEach((e, i) => {
    const [ax, az] = asicEdge(e), [ex, ez] = eicIn(e), [cx_, cz_] = edgeConn[i], tn = e.tan;
    dataFlows.push(flow([[ax, Y.subTop + 0.02, az], [ex, Y.subTop + 0.02, ez], [e.x - e.out[0] * 0.3, Y.eng + 0.1, e.z - e.out[1] * 0.3]], 'eth', FLOW.elec));
    // The receive lanes return electrically from the EIC to the switch ASIC,
    // offset along the same substrate corridor so both directions remain readable.
    const rxOffset = 0.045, rxX = tn[0] * rxOffset, rxZ = tn[1] * rxOffset;
    dataFlows.push(flow([[e.x - e.out[0] * 0.3 + rxX, Y.eng + 0.1, e.z - e.out[1] * 0.3 + rxZ], [ex + rxX, Y.subTop + 0.04, ez + rxZ], [ax + rxX, Y.subTop + 0.04, az + rxZ]], 'eth', FLOW.elec));
    // Every modeled engine is active. These route-level marks sample its lane
    // bundle; they are not a count of fibers or a bandwidth scale.
    {
      const routes = fiberRoutes[i];
      dataFlows.push(flow(routes.tx[3], 'tx', FLOW.light));
      dataFlows.push(flow([...routes.rx[3]].reverse(), 'rx', FLOW.light));
      dataFlows.push(flow(routes.cw[0], 'cw', FLOW.cw));
    }
  });
  // in the detail: electrical in to the drivers, down to the rings; laser light along the bus; light out; light in to
  // a photodiode, up to a TIA, electrical out
  for (const i of [1, 4, 6]) {
    const [rx_, rz] = ringAt(i);
    const [bondX, bondZ] = ringBondAt(i);
    dataFlows.push(flow([w(electricalEdge - 1.6, 0.96, -0.55 + (i % 3) * 0.22), w(electricalEdge, 0.96, -0.55 + (i % 3) * 0.22), w(bondX, 0.89, bondZ), w(bondX, 0.09, bondZ)], 'eth', FLOW.elec));
    dataFlows.push(flow([w(PW / 2 + 2.6, 0.1, pcz(RING.busY)), w(PW / 2, 0.09, pcz(RING.busY)), w(pcx(RING.manX), 0.09, pcz(RING.busY)), w(pcx(RING.manX), 0.09, txRowZ(i)), w(rx_, 0.09, txRowZ(i))], 'cw', FLOW.cw));
    dataFlows.push(flow([w(rx_, 0.09, txRowZ(i)), w(PW / 2, 0.09, txRowZ(i)), w(PW / 2 + 2.6, 0.1, txRowZ(i))], 'tx', FLOW.light));
    dataFlows.push(flow([w(PW / 2 + 2.6, 0.14, rxRowZ(i)), w(PW / 2, 0.09, rxRowZ(i)), w(pdX, 0.09, rxRowZ(i))], 'rx', FLOW.light));
    dataFlows.push(flow([w(pdX, 0.09, rxRowZ(i)), w(pdX, 0.89, rxRowZ(i)), w(electricalEdge, 0.96, 0.55 - (i % 3) * 0.22), w(electricalEdge - 1.6, 0.96, 0.55 - (i % 3) * 0.22)], 'eth', FLOW.elec));
  }
  const activeDieSpan = (ASIC_HALF - .2) * 2;
  for (let i = 0; i < 24; i++) { const x = (rnd() - 0.5) * activeDieSpan, z = (rnd() - 0.5) * activeDieSpan; flows.push(flow([[x, -1.2, z], [x, Y.sub, z], [x, Y.die, z]], 'core', FLOW.power)); }
  engines.forEach(({ x, z }) => flows.push(flow([[x, -1.0, z], [x, Y.sub, z], [x, Y.eng, z]], 'v33', FLOW.power)));
  els.forEach(([x, z]) => flows.push(flow([[x + 2.3, Y.sub + 0.45, z], [x + 0.9, Y.sub + 0.45, z]], 'v33', FLOW.power)));
  for (let i = 0; i < 26; i++) { const x = (rnd() - 0.5) * activeDieSpan, z = (rnd() - 0.5) * activeDieSpan; heatFlows.push(flow([[x, Y.die + 0.06, z], [x, Y.plate - 0.2, z]], 'hot', FLOW.heat)); }
  engines.forEach(({ x, z }) => heatFlows.push(flow([[x, Y.eng + 0.1, z], [x, Y.plate - 0.2, z]], 'hot', FLOW.heat)));
  heatFlows.push(flow([[-1.4, pipeTop, pipeZ], [-1.4, Y.plate, pipeZ], [-1.4, Y.plate, 3], [1.4, Y.plate, 3], [1.4, Y.plate, pipeZ], [1.4, pipeTop, pipeZ]], 'cool', { count: 10, speed: 1.6, size: 0.06, k: 2.2, trail: false }));
  [flows, dataFlows, heatFlows].forEach(a => a.forEach(f => scene.add(f.group)));

  // ======================= labels =======================
  const FZ = SUB / 2 + 4.6;                              // the labels stand in front of the package, clear of the view's buttons
  label(scene, 'Co-packaged optics · one switch package', [0, 0.6, FZ], '#e8ecf2', 0.36);
  label(scene, 'Size and layout representative · counts are NVIDIA’s', [0, 0.1, FZ], note, 0.2);
  label(scene, '18 engines · 28.8T each way · 1 engine = 1.6T each way, like one module', [0, -0.3, FZ], unitCol, 0.2);
  label(scene, 'Detail · one engine, lifted out and exploded · 2.5×', [DX, DY + 2.9, DZ], '#e8ecf2', 0.22);
  label(scene, 'Functional schematic · bonded faces and surface fiber coupling unfolded', [DX, DY - 0.45, DZ + 2.0], note, 0.13);
  label(scene, 'Electronic chip: drivers (TX) and TIAs (RX)', [DX, DY + 2.35, DZ - 1.6], unitCol, 0.15);
  label(scene, 'Photonic chip: ring modulators (TX), photodiodes (RX)', [DX, DY + 0.55, DZ + 2.0], unitCol, 0.15);
  label(scene, 'Light · 8 TX, 8 RX, 2 laser fibers', [DX - PW / 2 - 1.6, DY + 0.75, DZ], COL.tx, 0.15);
  label(scene, 'TX / RX fibers → front-panel ports (outside this diagram)', [0, 2.8, 7.8], COL.tx, .16);
  label(scene, 'Lower amber fibers: laser supply only · no engine-to-engine optical loop', [0, .5, 7.8], COL.cw, .14);
  label(scene, 'Electrical · copper traces in the substrate', [0, Y.subTop + 0.5, -2.6], COL.elec, 0.15);
  label(scene, 'Laser modules · front panel, light only · 32 transmit lanes each', [ELSX, Y.sub + 1.6, 0], COL.cw, 0.16);
  label(scene, 'Five shown · allocation illustrative · 18 serve the four-package switch', [ELSX, Y.sub + 1.25, els[nEls - 1][1]], note, 0.13);

  const view = (p, v, t) => ({ pos: p, view: { pos: v, target: t } });
  const [r3x, r3z] = ringAt(3);
  const hs = {
    asic: view([0, Y.die + 0.1, 0], [-1, 8.5, 7], [0, Y.die, 0]),
    serdes: view([asicEdge(engines[1])[0], Y.subTop + 0.1, asicEdge(engines[1])[1] + 0.3], [engines[1].x + 1.5, 5, engines[1].z + 3.2], [engines[1].x * 0.7, Y.subTop, engines[1].z * 0.7]),
    engine: view([EQ.x, Y.eng + 0.15, EQ.z], [EQ.x + 2.5, 5, EQ.z + 3.2], [EQ.x, Y.eng, EQ.z]),
    eic: view(w(-0.9, 1.1, 0.4), [DX + 1.5, DY + 4.2, DZ + 4.2], w(-0.6, 0.6, 0)),
    rings: view(w(r3x, 0.12, r3z), [DX + 0.5, DY + 3.6, DZ + 3.8], w(r3x, 0.1, r3z)),
    pd: view(w(pdX, 0.12, rxRowZ(4)), [DX + 1.2, DY + 2.3, DZ - 4.0], w(pdX, 0.1, rxRowZ(4))),
    els: view([ELSX, Y.sub + 1.0, 0], [ELSX + 3.2, 5, 5.5], [ELSX - 1, Y.sub, 0]),
    fiberout: view([edgeConn[1][0], 1.45, edgeConn[1][1]], [edgeConn[1][0] + 4, 7.5, 10.7], [edgeConn[1][0], 1.5, 5.5]),
    coldplate: view([2.5, Y.plate + 0.3, 2.5], [6, 10, 11], [0, 2.4, 0]),
  };
  return {
    scene, flows, dataFlows, heatFlows, coolingHardware,
    camera: { pos: [-0.5, 22, 25], target: [-0.5, 1.0, -1.5], near: 0.05, far: 500, min: 2, max: 90, portrait: { pos: [-3, 33, 35], target: [-3, 0.5, -1.5] } },
    hotspots: { asic: hs.asic, engine: hs.engine, els: hs.els },
    dataHotspots: { asic: hs.asic, serdes: hs.serdes, eic: hs.eic, rings: hs.rings, pd: hs.pd, els: hs.els, fiberout: hs.fiberout },
    heatHotspots: { asic: hs.asic, coldplate: hs.coldplate },
    update(t) { if (asicTop) asicTop.emissiveIntensity = state.mode === 'heat' ? 0.5 + 0.08 * Math.sin(t * 2) : 0; },
  };
}
