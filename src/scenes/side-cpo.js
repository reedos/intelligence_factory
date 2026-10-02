// Side level: inside a co-packaged optics switch package, NVIDIA Photonics style. World unit = 1 cm.
// Counts are NVIDIA's (six optical subassemblies of three engines per switch chip, 18 fibers per engine: 8 transmit,
// 8 receive, 2 laser in; laser modules at the front panel, 32 transmit lanes each; subassemblies socketed, fibers through a
// sealed interface). The package's size and layout, its cold plate and the photonic chip's floorplan are representative.
// Electrical paths: the switch chip's SerDes to each engine through copper traces in the package substrate, then
// down through bonds from the electronic chip to the photonic chip. Light: the laser fibers in, the modulated
// transmit fibers out, the receive fibers in. One engine is drawn again beside the package, lifted and exploded, as
// a labeled 2.5x detail view. An engine toggle (cpo-variants.js) redraws the engines three ways: ring modulators under a
// stacked electronic die (the original, NVIDIA-style), segmented Mach-Zehnder modulators under one (Broadcom-style, as
// reported), or one die holding both (Ranovus Odin / Ayar Labs TeraPHY-style). Each view's dies, bonds, guides,
// captions and detail flows sit in their own groups; only the engines change.
import { THREE, MAT, Builder, flow, setup, materials, die, strand, trace, label, lidBox, outline, FLOW, COL, note, unitCol, asicTex, ringPicTex, RING, glowMat } from './side-kit.js';

import { SUBS, OUT, TAN, ASIC_HALF, asicTap, edgeConnOf, engineLayout, elsOf, cpoFiberRoutes, CPO_VARIANTS, CPO_RING, CPO_MZM, CPO_MONO, CPO_EIC, eicBox } from './side-geometry.js';
import { ringEicTex, eicMzmTex, monoFaceTex, mzmCpoPicTex, cpoIntro, cpoPartCopy } from './cpo-variants.js';

// Fiber cannot fold at a point. The route contract (side-geometry.js) stays a
// reviewed polyline; the drawn fiber and its moving light follow the same path
// with each interior corner rounded by a short quadratic arc (up to 3 mm,
// representative bend radius). build-cpo.py applies the identical rounding.
export function roundCorners(pts, keep = () => false, radius = .3, steps = 6) {
  const out = [pts[0]];
  for (let k = 1; k < pts.length - 1; k++) {
    const p = pts[k], a = pts[k - 1], b = pts[k + 1];
    if (keep(k, pts.length)) { out.push(p); continue; }
    const la = Math.hypot(...a.map((v, j) => v - p[j])), lb = Math.hypot(...b.map((v, j) => v - p[j]));
    const d = Math.min(radius, la * .45, lb * .45);
    const p1 = p.map((v, j) => v + (a[j] - v) / la * d), p2 = p.map((v, j) => v + (b[j] - v) / lb * d);
    for (let s = 0; s <= steps; s++) { const t = s / steps, u = 1 - t; out.push(p.map((v, j) => u * u * p1[j] + 2 * u * t * v + t * t * p2[j])); }
  }
  out.push(pts.at(-1));
  return out;
}
// Laser feeds keep the sharp drop from the module aperture and the final lift onto the engine.
export const keepCwCorner = (k, n) => k === 1 || k === n - 2;

export function build({ quality, state, authoredHardware = false, authoredAsicMaterial = null }) {
  const scene = setup(quality, 14), M = materials();
  // Blender owns every physical mesh in the authored variant. Keep this layout
  // calculation as the source of runtime flows, anchors and diagram guides.
  const makeBuilder = () => authoredHardware
    ? { box() {}, cyl() {}, strut() {}, add() {}, build: () => new THREE.Group() }
    : new Builder();
  const S = makeBuilder(), N = makeBuilder();
  const flows = [], dataFlows = [], heatFlows = [];
  // One group per engine view for its dies, bond pads, guides and captions, and one for its detail flows; a builder
  // per view for the small native parts. setVariant shows one view.
  const views = Object.fromEntries(CPO_VARIANTS.map(k => {
    const group = new THREE.Group(), flowGroup = new THREE.Group();
    group.name = `CPO engine view ${k}`; flowGroup.name = `CPO engine view ${k} flows`;
    scene.add(group, flowGroup);
    return [k, { group, flowGroup, B: makeBuilder(), flows: [] }];
  }));
  const flowView = new Map();   // a detail flow and the engine view it belongs to
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
  if (!authoredHardware) {
    const faces = { ring: [ringPicTex(), ringEicTex()], mzm: [mzmCpoPicTex(), eicMzmTex()], mono: [monoFaceTex()] };
    engines.forEach(({ x, z, out, rot }) => {
      for (const k of ['ring', 'mzm']) {
        const e = eicBox(k);   // the electronic die over its own part of the photonic die; local +x is outward
        die(views[k].group, M, 1.35, 0.06, 0.95, faces[k][0], x, Y.eng, z, -rot);
        die(views[k].group, M, e.w, 0.07, e.d, faces[k][1], x + out[0] * e.cx, Y.eng + 0.065, z + out[1] * e.cx, -rot);
      }
      die(views.mono.group, M, 1.35, 0.1, 0.95, faces.mono[0], x, Y.eng + 0.02, z, -rot);   // one die, no stack
    });
  }
  if (!authoredHardware) engines.forEach(({ x, z, out, rot }) => {
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
      for (const points of fiberRoutes[i][kind]) strand(N, kind === 'cw' ? roundCorners(points, keepCwCorner, .25) : roundCorners(points), material, kind === 'cw' ? .008 : .007);
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
  // each stacked view's electronic die over its own rect of the photonic die; its electrical edge faces the switch
  const eicD = { ring: eicBox('ring', s), mzm: eicBox('mzm', s) }, edgeOf = k => eicD[k].cx - eicD[k].w / 2;
  const electricalEdge = edgeOf('ring');
  if (!authoredHardware) {
    die(views.ring.group, M, PW, 0.15, PD, ringPicTex(), DX, DY, DZ, Math.PI);
    die(views.ring.group, M, eicD.ring.w, 0.12, eicD.ring.d, ringEicTex(), ...w(eicD.ring.cx, 0.95, 0), Math.PI);
    die(views.mzm.group, M, PW, 0.15, PD, mzmCpoPicTex(), DX, DY, DZ, Math.PI);
    die(views.mzm.group, M, eicD.mzm.w, 0.12, eicD.mzm.d, eicMzmTex(), ...w(eicD.mzm.cx, 0.95, 0), Math.PI);
    die(views.mono.group, M, PW, 0.15, PD, monoFaceTex(), DX, DY, DZ, Math.PI);
  }
  const pcx = px => -PW / 2 + px / RING.w * PW, pcz = py => -PD / 2 + py / RING.h * PD;
  const ringAt = i => [pcx(RING.ringX(i)), pcz(RING.row(i) - RING.ringR - RING.ringGap)], txRowZ = i => pcz(RING.row(i)), rxRowZ = i => pcz(RING.rxRow(i)), pdX = pcx(RING.pdX);
  const ringBondAt = i => { const [bx, bz] = RING.bondAt(i); return [pcx(bx), pcz(bz)]; };
  // Paired pads mark face-to-face bonding; dashed registration guides cross the
  // exploded gap. They are not centimeter-long copper bond wires in a real engine. The one-die view has no bonds.
  const M_ = CPO_MZM, O_ = CPO_MONO;
  const bondsOf = {
    ring: Array.from({ length: 8 }, (_, i) => [ringBondAt(i), [pdX, rxRowZ(i)]]).flat(),
    mzm: Array.from({ length: 8 }, (_, i) => [...Array.from({ length: M_.segments }, (_, k) => [pcx(M_.pad(k)), pcz(M_.row(i) - M_.strip)]), [pdX, rxRowZ(i)]]).flat(),
    mono: [],
  };
  for (const k of CPO_VARIANTS) {
    const bondGuides = [];
    for (const [px, pz] of bondsOf[k]) {
      for (const y of [0.09, 0.875]) views[k].B.cyl(0.033, 0.025, MAT.gold, ...w(px, y, pz), 8);
      bondGuides.push(...w(px, 0.12, pz), ...w(px, 0.85, pz));
    }
    if (!bondGuides.length) continue;
    const guide = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(bondGuides, 3)),
      new THREE.LineDashedMaterial({ color: 0x8292a6, dashSize: 0.06, gapSize: 0.055, transparent: true, opacity: 0.4 }));
    guide.computeLineDistances(); views[k].group.add(guide);
  }
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
  for (let j = 0; j < 6; j++) {
    for (const k of ['ring', 'mzm']) views[k].B.box(1.6, 0.01, 0.05, MAT.copper, ...w(edgeOf(k) - 0.8, 0.95, -0.55 + j * 0.22));
    views.mono.B.box(1.6, 0.01, 0.05, MAT.copper, ...w(-PW / 2 - 0.8, 0.08, -0.55 + j * 0.22));
  }
  const EQ = engines[6];                                 // a back-side engine, the one nearest the detail
  // Corner brackets, the same drawn language as the detail's corner marks, pick
  // out the enlarged engine instead of a full wireframe box.
  const eqTicks = [], eqHW = 1.55 / 2, eqHD = 1.15 / 2, eqY0 = Y.eng + 0.08 - 0.17, eqY1 = Y.eng + 0.08 + 0.17, tick = 0.34;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * eqHW, z = sz * eqHD;
    eqTicks.push(x, eqY1, z, x - sx * tick, eqY1, z, x, eqY1, z, x, eqY1, z - sz * tick * 0.8, x, eqY1, z, x, eqY0, z);
    eqTicks.push(x, eqY0, z, x - sx * tick, eqY0, z, x, eqY0, z, x, eqY0, z - sz * tick * 0.8);
  }
  const eqMark = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(eqTicks, 3)),
    new THREE.LineBasicMaterial({ color: 0x62e6ff, transparent: true, opacity: 0.9 }));
  eqMark.position.set(EQ.x, 0, EQ.z); eqMark.rotation.y = -EQ.rot; scene.add(eqMark);
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
  for (const k of CPO_VARIANTS) views[k].group.add(views[k].B.build({ cast: false }));

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
      dataFlows.push(flow(roundCorners(routes.tx[3]), 'tx', FLOW.light));
      dataFlows.push(flow(roundCorners([...routes.rx[3]].reverse()), 'rx', FLOW.light));
      dataFlows.push(flow(roundCorners(routes.cw[0], keepCwCorner, .25), 'cw', FLOW.cw));
    }
  });
  // in the detail, each engine view's own paths. Stacked views: electrical in to the drivers, down a bond to the
  // modulator; laser light along the bus; light out; light in to a photodiode, up a bond to a TIA, electrical out. The
  // one-die view: the same, sideways, from the die's electrical edge to a driver beside its ring and from a
  // photodiode to the TIA beside it.
  const viewFlow = (k, f) => { flowView.set(f, k); views[k].flows.push(f); dataFlows.push(f); };
  const cwIn = (k, manX, busY, row, endX) => viewFlow(k, flow([w(PW / 2 + 2.6, 0.1, pcz(busY)), w(PW / 2, 0.09, pcz(busY)), w(pcx(manX), 0.09, pcz(busY)), w(pcx(manX), 0.09, pcz(row)), w(endX, 0.09, pcz(row))], 'cw', FLOW.cw));
  const rxIn = (k, i) => viewFlow(k, flow([w(PW / 2 + 2.6, 0.14, rxRowZ(i)), w(PW / 2, 0.09, rxRowZ(i)), w(pdX, 0.09, rxRowZ(i))], 'rx', FLOW.light));
  [1, 4, 6].forEach((i, n) => {
    const zIn = -0.55 + (i % 3) * 0.22, zOut = 0.55 - (i % 3) * 0.22;
    // ring
    const [rx_] = ringAt(i), [bondX, bondZ] = ringBondAt(i);
    viewFlow('ring', flow([w(electricalEdge - 1.6, 0.96, zIn), w(electricalEdge, 0.96, zIn), w(bondX, 0.89, bondZ), w(bondX, 0.09, bondZ)], 'eth', FLOW.elec));
    cwIn('ring', RING.manX, RING.busY, RING.row(i), rx_);
    viewFlow('ring', flow([w(rx_, 0.09, txRowZ(i)), w(PW / 2, 0.09, txRowZ(i)), w(PW / 2 + 2.6, 0.1, txRowZ(i))], 'tx', FLOW.light));
    rxIn('ring', i);
    viewFlow('ring', flow([w(pdX, 0.09, rxRowZ(i)), w(pdX, 0.89, rxRowZ(i)), w(electricalEdge, 0.96, zOut), w(electricalEdge - 1.6, 0.96, zOut)], 'eth', FLOW.elec));
    // Mach-Zehnder: each sampled lane feeds a different one of its three electrode segments
    const row = M_.row(i), zr = pcz(row), zs = pcz(row - M_.strip), s1 = M_.seg(n)[1], padX = pcx(M_.pad(n)), mEdge = edgeOf('mzm');
    viewFlow('mzm', flow([w(mEdge - 1.6, 0.96, zIn), w(mEdge, 0.96, zIn), w(padX, 0.89, zs), w(padX, 0.09, zs), w(pcx(s1), 0.09, zs)], 'eth', FLOW.elec));
    cwIn('mzm', M_.manX, M_.busY, row, pcx(M_.split));
    viewFlow('mzm', flow([w(pcx(M_.split), 0.09, zr), w(pcx(M_.armIn), 0.09, pcz(row - M_.arm)), w(pcx(M_.armOut), 0.09, pcz(row - M_.arm)), w(pcx(M_.join), 0.09, zr), w(PW / 2, 0.09, zr), w(PW / 2 + 2.6, 0.1, zr)], 'tx', FLOW.light));
    rxIn('mzm', i);
    viewFlow('mzm', flow([w(pdX, 0.09, rxRowZ(i)), w(pdX, 0.89, rxRowZ(i)), w(mEdge, 0.96, zOut), w(mEdge - 1.6, 0.96, zOut)], 'eth', FLOW.elec));
    // one die: everything at the surface, just above the waveguides
    const [d0, d1, d2, d3] = O_.driver(i), [t0, , t2] = O_.tia(i), ringX = O_.ringX(i), ringZ = O_.ringZ(i);
    viewFlow('mono', flow([w(-PW / 2 - 1.6, 0.09, zIn), w(-PW / 2, 0.09, zIn), w(pcx((d0 + d2) / 2), 0.09, pcz((d1 + d3) / 2)), w(pcx(ringX - O_.ringR), 0.09, pcz(ringZ))], 'eth', FLOW.elec));
    cwIn('mono', O_.manX, O_.busY, O_.row(i), pcx(ringX));
    viewFlow('mono', flow([w(pcx(ringX), 0.09, pcz(O_.row(i))), w(PW / 2, 0.09, pcz(O_.row(i))), w(PW / 2 + 2.6, 0.1, pcz(O_.row(i)))], 'tx', FLOW.light));
    rxIn('mono', i);
    viewFlow('mono', flow([w(pdX, 0.09, rxRowZ(i)), w(pcx((t0 + t2) / 2), 0.09, rxRowZ(i)), w(-PW / 2, 0.09, zOut), w(-PW / 2 - 1.6, 0.09, zOut)], 'eth', FLOW.elec));
  });
  const activeDieSpan = (ASIC_HALF - .2) * 2;
  for (let i = 0; i < 24; i++) { const x = (rnd() - 0.5) * activeDieSpan, z = (rnd() - 0.5) * activeDieSpan; flows.push(flow([[x, -1.2, z], [x, Y.sub, z], [x, Y.die, z]], 'core', FLOW.power)); }
  engines.forEach(({ x, z }) => flows.push(flow([[x, -1.0, z], [x, Y.sub, z], [x, Y.eng, z]], 'v33', FLOW.power)));
  els.forEach(([x, z]) => flows.push(flow([[x + 2.3, Y.sub + 0.45, z], [x + 0.9, Y.sub + 0.45, z]], 'v33', FLOW.power)));
  // A few sampled columns read as rising heat; a dense sheet hid the die and the plate behind it.
  for (let i = 0; i < 14; i++) { const x = (rnd() - 0.5) * activeDieSpan, z = (rnd() - 0.5) * activeDieSpan; heatFlows.push(flow([[x, Y.die + 0.06, z], [x, Y.plate - 0.2, z]], 'hot', FLOW.heat)); }
  engines.forEach(({ x, z }) => heatFlows.push(flow([[x, Y.eng + 0.1, z], [x, Y.plate - 0.2, z]], 'hot', FLOW.heat)));
  heatFlows.push(flow([[-1.4, pipeTop, pipeZ], [-1.4, Y.plate, pipeZ], [-1.4, Y.plate, 3], [1.4, Y.plate, 3], [1.4, Y.plate, pipeZ], [1.4, pipeTop, pipeZ]], 'cool', { count: 10, speed: 1.6, size: 0.06, k: 2.2, trail: false }));
  [flows, dataFlows, heatFlows].forEach(a => a.forEach(f => (flowView.has(f) ? views[flowView.get(f)].flowGroup : scene).add(f.group)));

  // ======================= labels =======================
  const FZ = SUB / 2 + 4.6, CPO_VIEW_NOTE = '#ffcf7a';                              // the labels stand in front of the package, clear of the view's buttons
  label(scene, 'Co-packaged optics · one switch package', [0, 0.6, FZ], '#e8ecf2', 0.36);
  label(scene, 'Size and layout representative · counts are NVIDIA’s', [0, 0.1, FZ], note, 0.2);
  label(scene, '18 engines · 28.8T each way · 1 engine = 1.6T each way, like one module', [0, -0.3, FZ], unitCol, 0.2);
  label(scene, 'Detail · one engine, lifted out and exploded · 2.5×', [DX, DY + 2.9, DZ], '#e8ecf2', 0.22);
  // captions that name one engine view's chips; setVariant shows the current view's
  const viewLabel = (k, ...a) => { const sprite = label(scene, ...a); sprite.userData.cpoVariant = k; return sprite; };
  viewLabel('ring', 'Functional schematic · bonded faces and surface fiber coupling unfolded', [DX, DY - 0.45, DZ + 2.0], note, 0.13);
  viewLabel('ring', 'Electronic chip: drivers (TX) and TIAs (RX)', [DX, DY + 2.35, DZ - 1.6], unitCol, 0.15);
  viewLabel('ring', 'Photonic chip: ring modulators (TX), photodiodes (RX)', [DX, DY + 0.55, DZ + 2.0], unitCol, 0.15);
  viewLabel('mzm', 'Functional schematic · bonded faces and surface fiber coupling unfolded', [DX, DY - 0.45, DZ + 2.0], note, 0.13);
  viewLabel('mzm', 'Electronic chip: drivers over the electrode ends (TX), TIAs (RX)', [DX, DY + 2.35, DZ - 1.6], unitCol, 0.15);
  viewLabel('mzm', 'Photonic chip: Mach-Zehnder modulators (TX), photodiodes (RX)', [DX, DY + 0.55, DZ + 2.0], unitCol, 0.15);
  viewLabel('mono', 'Functional schematic · one die · surface fiber coupling unfolded', [DX, DY - 0.45, DZ + 2.0], note, 0.13);
  viewLabel('mono', 'One die: drivers beside the rings (TX), TIAs beside the photodiodes (RX)', [DX, DY + 0.55, DZ + 2.0], unitCol, 0.15);
  viewLabel('mzm', 'Engines drawn Broadcom-style: Mach-Zehnder, as reported · 8 of 64 lanes · representative', [0, -0.7, FZ], CPO_VIEW_NOTE, 0.18);
  viewLabel('mono', 'Engines drawn as one die each, Odin / TeraPHY-style · representative', [0, -0.7, FZ], CPO_VIEW_NOTE, 0.18);
  label(scene, 'Light · 8 TX, 8 RX, 2 laser fibers', [DX - PW / 2 - 1.6, DY + 0.75, DZ], COL.tx, 0.15);
  label(scene, 'TX / RX fibers → front-panel ports (outside this diagram)', [0, 2.8, 7.8], COL.tx, .16);
  label(scene, 'Lower amber fibers: laser supply only · no engine-to-engine optical loop', [0, .5, 7.8], COL.cw, .14);
  label(scene, 'Electrical · copper traces in the substrate', [0, Y.subTop + 0.5, -2.6], COL.elec, 0.15);
  label(scene, 'Laser modules · front panel, light only · 32 transmit lanes each', [ELSX, Y.sub + 1.6, 0], COL.cw, 0.16);
  label(scene, 'Five shown · allocation illustrative · 18 serve the four-package switch', [ELSX, Y.sub + 1.25, els[nEls - 1][1]], note, 0.13);

  const view = (p, v, t) => ({ pos: p, view: { pos: v, target: t } });
  // Fitted views: the whole subject box (not just the pin) is kept inside the
  // area left clear by the page title, layer switch and buttons at any aspect.
  const fitted = (p, v, t, size) => ({ pos: p, view: { pos: v, target: t, focus: p, detailSize: size } });
  const stack = w(0.1, 0.55, 0), stackSize = [3.5, 1.2, 2.5];
  const [r3x, r3z] = ringAt(3);
  const hs = {
    asic: fitted([0, Y.die + 0.1, 0], [-1, 8.5, 7], [0, Y.die, 0], [3.6, 0.5, 3.6]),
    serdes: view([asicEdge(engines[1])[0], Y.subTop + 0.1, asicEdge(engines[1])[1] + 0.3], [engines[1].x + 1.5, 5, engines[1].z + 3.2], [engines[1].x * 0.7, Y.subTop, engines[1].z * 0.7]),
    engine: view([EQ.x, Y.eng + 0.15, EQ.z], [EQ.x + 2.5, 5, EQ.z + 3.2], [EQ.x, Y.eng, EQ.z]),
    eic: fitted(w(1.2, 1.1, 1.0), [DX + 1.5, DY + 4.2, DZ + 4.2], stack, stackSize),
    rings: fitted(w(r3x, 0.12, r3z), [DX + 0.5, DY + 3.6, DZ + 3.8], stack, stackSize),
    pd: fitted(w(pdX, 0.12, rxRowZ(4)), [DX + 1.2, DY + 2.3, DZ - 4.0], stack, stackSize),
    els: view([ELSX, Y.sub + 1.0, 0], [ELSX + 3.2, 5, 5.5], [ELSX - 1, Y.sub, 0]),
    fiberout: fitted([edgeConn[1][0], 1.45, edgeConn[1][1]], [edgeConn[1][0] + 4, 7.5, 10.7], [edgeConn[1][0], 1.6, 5.9], [4.2, 1.6, 3.4]),
    // Pinned on the plate's return-leg microchannels, visible from the ASIC view too.
    coldplate: view([1.65, Y.plate + 0.14, 1.0], [6, 10, 11], [0, 2.4, 0]),
    // Landscape cards (who ships CPO, where it is heading): pinned on the substrate's two left corners, whole-package views.
    today: view([-SUB / 2 + 0.5, Y.subTop + 0.05, SUB / 2 - 0.5], [-9, 10, 14], [-1.5, 1.2, 1.0]),
    next: view([-SUB / 2 + 0.5, Y.subTop + 0.05, -SUB / 2 + 0.5], [-13, 10, 3], [-1.5, 1.2, -1.0]),
  };
  // Pins that move with the engine view: the electronics, the modulator and the photodiode each sit on that view's part.
  const pinAt = {
    ring: { eic: w(pcx(CPO_RING.ringX(6)), 1.1, pcz(CPO_RING.ringZ(6))), rings: w(r3x, 0.12, r3z), pd: w(pdX, 0.12, rxRowZ(4)) },
    mzm: { eic: w(pcx(240), 1.1, pcz(M_.row(2))), rings: w(pcx((CPO_EIC.mzm[2] + M_.armOut) / 2), 0.12, pcz(M_.row(3))), pd: w(pdX, 0.12, rxRowZ(4)) },
    mono: (() => { const [d0, d1, d2, d3] = O_.driver(6); return { eic: w(pcx((d0 + d2) / 2), 0.12, pcz((d1 + d3) / 2)), rings: w(pcx(O_.ringX(3)), 0.12, pcz(O_.ringZ(3))), pd: w(pdX, 0.12, rxRowZ(4)) }; })(),
  };
  let kind = 'ring';
  const viewSprites = scene.children.filter(o => o.isSprite && o.userData.cpoVariant);
  function setVariant(next) {
    kind = CPO_VARIANTS.includes(next) ? next : 'ring';
    for (const k of CPO_VARIANTS) views[k].group.visible = views[k].flowGroup.visible = k === kind;
    for (const id of ['eic', 'rings', 'pd']) { const p = pinAt[kind][id]; hs[id].pos = p; hs[id].view.focus = p; }
    for (const sprite of viewSprites) sprite.visible = sprite.userData.cpoVariant === kind;
  }
  setVariant('ring');
  return {
    scene, flows, dataFlows, heatFlows, coolingHardware,
    variant: {
      get kind() { return kind; }, set: setVariant, views,
      intro: mode => cpoIntro(kind, mode),
      partCopy: (part, mode) => cpoPartCopy(kind, part, mode),
      spriteVisible: sprite => !sprite.userData.cpoVariant || sprite.userData.cpoVariant === kind,
    },
    camera: { pos: [-0.5, 22, 25], target: [-0.5, 1.0, -1.5], near: 0.05, far: 500, min: 2, max: 90, portrait: { pos: [14.5, 29.5, 25.5], target: [-1.5, 1.2, -2.5] } },
    hotspots: { asic: hs.asic, engine: hs.engine, els: hs.els, today: hs.today, next: hs.next },
    dataHotspots: { asic: hs.asic, serdes: hs.serdes, eic: hs.eic, rings: hs.rings, pd: hs.pd, els: hs.els, fiberout: hs.fiberout, today: hs.today, next: hs.next },
    // Heat looks in under the lifted plate: the die glows below, its heat rises into the channels above.
    heatHotspots: { asic: view(hs.asic.pos, [1.2, 3.55, 10.5], [0, 2.75, 0]), coldplate: hs.coldplate },
    update(t) { eqMark.material.opacity = 0.62 + 0.3 * Math.sin(t * 1.6); if (asicTop) asicTop.emissiveIntensity = state.mode === 'heat' ? 0.5 + 0.08 * Math.sin(t * 2) : 0; },
  };
}
