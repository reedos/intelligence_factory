// Side level: inside a co-packaged optics switch package. World unit = 1 cm. A toggle shows two shipping designs,
// each in its own package (Reed, 10/01/2026):
//   ring  NVIDIA-style, the default. Counts are NVIDIA's (six optical subassemblies of three engines per switch chip,
//         18 fibers per engine: 8 transmit, 8 receive, 2 laser in; laser modules at the front panel, 32 transmit lanes
//         each; subassemblies socketed, fibers through a sealed interface). Each engine is an electronic die stacked
//         on a photonic die with micro-ring modulators.
//   mzm   Broadcom-style, a 51.2T Bailly-class package: eight radial 6.4T engine tiles (cpo-bailly.js).
// The package's size and layout, its cold plate and every die floorplan are representative. Electrical paths: the
// switch chip's SerDes to each engine through copper traces in the package substrate, then down through bonds from
// the electronic chip to the photonic chip. Light: the laser fibers in, the modulated transmit fibers out, the
// receive fibers in. One engine of each design is drawn again beside the package, lifted and exploded, as a labeled
// 2.5x detail. Shared by both: the board, the substrate, the switch chip, the front-panel laser modules and their
// power, the switch chip's power and heat. Everything else sits in its design's own groups, shown one at a time.
import { THREE, MAT, Builder, flow, laneFlow, setup, materials, die, strand, trace, label, outline, FLOW, COL, note, unitCol, asicTex, ringPicTex, RING, glowMat } from './side-kit.js';
import { SUBS, OUT, TAN, ASIC_HALF, asicTap, edgeConnOf, engineLayout, elsOf, cpoFiberRoutes, CPO_VARIANTS, CPO_RING, eicBox, frameToLocal, engineTraceLandings, landingWorld, RING_R, engineBusWidth, engineBusPoint, engineEntryRadius } from './side-geometry.js';
import { ringEicTex, cpoIntro, cpoPartCopy } from './cpo-variants.js';
import { roundCorners, keepCwCorner, CW_BEND, CPO_AUDIT as AU } from './side-cpo-routes.js';
import { buildBailly, BAILLY_DETAIL, MY } from './cpo-bailly.js';
import { tagHeat, balanceHeat, PART_W } from '../heat.js';
export { roundCorners, keepCwCorner };

export function build({ quality, state, authoredHardware = false, authoredAsicMaterial = null }) {
  const scene = setup(quality, 14), M = materials();
  // Blender owns every physical mesh in the authored variant. Keep this layout
  // calculation as the source of runtime flows, anchors and diagram guides.
  const makeBuilder = () => authoredHardware
    ? { box() {}, cyl() {}, strut() {}, add() {}, build: () => new THREE.Group() }
    : new Builder();
  const S = makeBuilder(), N = makeBuilder();
  const flows = [], dataFlows = [], heatFlows = [];
  // One group per design for its geometry, guides and marks, and one for its flows; a builder per design for the
  // small native parts. setVariant shows one design.
  const lists = { power: flows, data: dataFlows, heat: heatFlows };
  const views = Object.fromEntries(CPO_VARIANTS.map(k => {
    const group = new THREE.Group(), flowGroup = new THREE.Group();
    group.name = `CPO engine view ${k}`; flowGroup.name = `CPO engine view ${k} flows`;
    scene.add(group, flowGroup);
    const v = { group, flowGroup, B: makeBuilder(), flows: [] };
    v.addFlow = (mode, f) => { lists[mode].push(f); v.flows.push(f); flowGroup.add(f.group); return f; };
    return [k, v];
  }));
  const R = views.ring;
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
  // NVIDIA-style: one shared interposer supports the switch ASIC and optical engine ring. Its 9 cm square envelope
  // is representative; the common integration is public.
  if (!authoredHardware) R.B.box(9.0, 0.1, 9.0, MAT.silicon, 0, Y.inter, 0);
  const asicTop = authoredHardware ? authoredAsicMaterial
    : die(scene, M, ASIC_HALF * 2, 0.1, ASIC_HALF * 2, asicTex(), 0, Y.die, 0);

  // ======================= NVIDIA-style package =======================
  const engines = engineLayout();
  if (!authoredHardware) for (const [side, t0] of SUBS) {
    const out = OUT[side], tan = TAN[side], r = 3.35;
    const carrier = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 3.5), MAT.pcbBlack); carrier.position.set(out[0] * r + tan[0] * t0, Y.eng - 0.055, out[1] * r + tan[1] * t0); carrier.rotation.y = -side * Math.PI / 2; R.group.add(carrier);
    for (const d of [-0.78, 0.78]) {
      const p = [out[0] * (r + d) + tan[0] * t0, out[1] * (r + d) + tan[1] * t0];
      R.B.box(0.035, 0.04, 3.5, edgeMetal, p[0], Y.eng - 0.03, p[1], -side * Math.PI / 2);
    }
  }
  if (!authoredHardware) {
    const pic = ringPicTex(), eic = ringEicTex(), e = eicBox('ring');   // the electronic die over its rect; local +x is outward
    engines.forEach(({ x, z, out, rot }) => {
      die(R.group, M, 1.35, 0.06, 0.95, pic, x, Y.eng, z, -rot);
      die(R.group, M, e.w, 0.07, e.d, eic, x + out[0] * e.cx, Y.eng + 0.065, z + out[1] * e.cx, -rot);
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.8), M.glass); f.position.set(x + out[0] * 0.83, Y.eng + 0.08, z + out[1] * 0.83); f.rotation.y = -rot; R.group.add(f);
    });
  }
  // electrical: a wide, evenly pitched bus of copper traces in the substrate from the ASIC's SerDes edge, landing
  // straight on the driver and TIA cells across the engine's whole electrical edge (every lane shown, 16; see
  // engineTraceLandings in side-geometry.js). Each trace leaves the ASIC already at its own lane's offset — no
  // shared trunk — narrowed at the ASIC only where engineBusWidth found a same-side neighbour or the chip's own
  // face requires it, spreading to full width over the run out to the engine's own inner edge
  // (engineEntryRadius), then running straight into the die to its cell. asicEdge (asicTap) is kept only for the
  // SerDes pin below; the data flow now rides engineBusPoint's own per-lane points directly.
  const asicEdge = asicTap;
  const ringLandings = engineTraceLandings('ring'), ringEntryR = engineEntryRadius('ring');
  engines.forEach(e => {
    const { desired, scale } = engineBusWidth('ring', engines, e);
    const pitch = ringLandings.length > 1 ? (2 * desired) / (ringLandings.length - 1) : desired;
    const w = Math.min(0.022, pitch * 0.4);
    for (const [px, py] of ringLandings) {
      const [asic, entry, land] = engineBusPoint('ring', e, RING_R, px, py, scale, ringEntryR);
      trace(R.B, asic, entry, Y.subTop + 0.001, w);
      trace(R.B, entry, land, Y.subTop + 0.001, w);
    }
  });
  // light: each engine's 8 transmit and 8 receive fibers to its own connector at the package edge
  const edgeConn = engines.map(e => edgeConnOf(e, SUB));
  const fiberRoutes = engines.map(cpoFiberRoutes);
  engines.forEach(({ out }, i) => {
    const [ex, ez] = edgeConn[i];
    for (const [kind, material] of [['tx', M.fiberTx], ['rx', M.fiberRx], ['cw', M.fiberCw]])
      for (const points of fiberRoutes[i][kind]) strand(R.B, kind === 'cw' ? roundCorners(points, keepCwCorner, CW_BEND) : roundCorners(points), material, kind === 'cw' ? .008 : .007);
    R.B.box(out[0] !== 0 ? .3 : .7, .3, out[0] !== 0 ? .7 : .3, MAT.polymer, ex, 1.2, ez);
  });
  // the laser modules at the front panel (both designs), each engine's two laser fibers running round the outside of
  // the package and in through the engine's own connector with its data fibers. Five modules are shown: in the
  // NVIDIA-style package four light four engines each and the fifth the last two. This allocation is illustrative;
  // published totals do not specify the cross-package wiring.
  const ELSX = SUB / 2 + 3.0, nEls = elsOf(engines.length - 1) + 1, els = [];
  for (let i = 0; i < nEls; i++) { const z = -4.4 + i * 2.2; if (!authoredHardware) S.box(1.9, 0.9, 1.1, MAT.darkSteel, ELSX, Y.sub + 0.45, z); N.box(0.04, 0.18, 0.5, glowMat(COL.cw, 1.5), ELSX - 0.96, Y.sub + 0.6, z); els.push([ELSX, z]); }
  // the cold plate, lifted and see-through; water in and out straight up
  if (!authoredHardware) {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(SUB - 0.6, 0.35, SUB - 0.6), new THREE.MeshPhysicalMaterial({ color: 0xc98a5c, metalness: 0.6, roughness: 0.45, transparent: true, opacity: 0.12, depthWrite: false }));
    plate.position.set(0, Y.plate, 0); R.group.add(plate); outline(R.group, plate.geometry, [0, Y.plate, 0], 0xd9a070, 0.6);
    for (const z of [-(SUB - 0.6) / 2, (SUB - 0.6) / 2]) R.B.box(SUB - 0.6, 0.04, 0.035, edgeMetal, 0, Y.plate + 0.15, z);
    for (const x of [-(SUB - 0.6) / 2, (SUB - 0.6) / 2]) R.B.box(0.035, 0.04, SUB - 0.6, edgeMetal, x, Y.plate + 0.15, 0);
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
  // the electronic die over its rect of the photonic die; its electrical edge faces the switch
  const eicD = eicBox('ring', s), electricalEdge = eicD.cx - eicD.w / 2;
  if (!authoredHardware) {
    die(R.group, M, PW, 0.15, PD, ringPicTex(), DX, DY, DZ, Math.PI);
    die(R.group, M, eicD.w, 0.12, eicD.d, ringEicTex(), ...w(eicD.cx, 0.95, eicD.cz), Math.PI);
  }
  const pcx = px => frameToLocal('ring', px, 0, s)[0], pcz = py => frameToLocal('ring', 0, py, s)[1];
  const ringAt = i => [pcx(RING.ringX(i)), pcz(RING.row(i) - RING.ringR - RING.ringGap)], txRowZ = i => pcz(RING.row(i)), rxRowZ = i => pcz(RING.rxRow(i)), pdX = pcx(RING.pdX);
  const ringBondAt = i => { const [bx, bz] = RING.bondAt(i); return [pcx(bx), pcz(bz)]; };
  // Paired pads mark face-to-face bonding; dashed registration guides cross the
  // exploded gap. They are not centimeter-long copper bond wires in a real engine.
  const bondGuides = [];
  for (let i = 0; i < 8; i++) for (const [px, pz] of [ringBondAt(i), [pdX, rxRowZ(i)]]) {
    for (const y of [0.09, 0.875]) R.B.cyl(0.033, 0.025, MAT.gold, ...w(px, y, pz), 8);
    bondGuides.push(...w(px, 0.12, pz), ...w(px, 0.85, pz));
  }
  const guide = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(bondGuides, 3)),
    new THREE.LineDashedMaterial({ color: 0x8292a6, dashSize: 0.06, gapSize: 0.055, transparent: true, opacity: 0.4 }));
  guide.computeLineDistances(); R.group.add(guide);
  // Neutral diagram corner marks distinguish the separate detail from hardware.
  const corners = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = DX + sx * 4.6, z = DZ + sz * 2.25, y = DY - 0.25;
    corners.push(x - sx * 0.45, y, z, x, y, z, x, y, z, x, y, z - sz * 0.45);
  }
  R.group.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(corners, 3)),
    new THREE.LineBasicMaterial({ color: 0x617187, transparent: true, opacity: 0.55 })));
  // the fiber attach and all 18 fibers: 8 transmit, 8 receive, 2 laser in
  R.B.box(0.4, 0.4, PD - 0.2, M.glass, ...w(PW / 2 + 0.2, 0.1, 0));
  for (let i = 0; i < 8; i++) { strand(R.B, [w(PW / 2 + 0.4, 0.1, txRowZ(i)), w(PW / 2 + 2.6, 0.1, txRowZ(i))], M.fiberTx, 0.02); strand(R.B, [w(PW / 2 + 0.4, 0.14, rxRowZ(i)), w(PW / 2 + 2.6, 0.14, rxRowZ(i))], M.fiberRx, 0.02); }
  for (const d of [-0.07, 0.07]) strand(R.B, [w(PW / 2 + 0.4, 0.1, pcz(RING.busY) + d), w(PW / 2 + 2.6, 0.1, pcz(RING.busY) + d)], M.fiberCw, 0.02);
  // the electrical side: a stub of package trace from the switch chip into the electronic chip
  for (let j = 0; j < 6; j++) R.B.box(1.6, 0.01, 0.05, MAT.copper, ...w(electricalEdge - 0.8, 0.95, -0.55 + j * 0.22));
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
  eqMark.position.set(EQ.x, 0, EQ.z); eqMark.rotation.y = -EQ.rot; R.group.add(eqMark);
  // a dotted leader from the detail to the engine it shows
  const eqTop = Y.eng + 0.08 + 0.17;
  const leader = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(DX + PW / 2 + 0.3, DY + 1.6, DZ),
    new THREE.Vector3(DX + PW / 2 + 1.2, DY + 1.6, DZ),
    new THREE.Vector3(EQ.x, eqTop + 0.8, EQ.z), new THREE.Vector3(EQ.x, eqTop, EQ.z),
  ]), new THREE.LineDashedMaterial({ color: 0x8a96a8, dashSize: 0.18, gapSize: 0.14, transparent: true, opacity: 0.8 }));
  leader.computeLineDistances(); R.group.add(leader);
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), new THREE.MeshBasicMaterial({ color: 0x8a96a8 })); dot.position.set(EQ.x, eqTop, EQ.z); R.group.add(dot);

  // ---- NVIDIA-style flows ----
  // Electrical data rides the wide bus's own lanes (one real animated stream per drawn lane — all 16, the
  // engine's whole lane count, not a subset) instead of one abstracted line: a 1.6T engine should read as
  // carrying as much as its fibers, not a trickle next to them. Transmit lanes (the drivers' half of
  // engineTraceLandings) run toward the engine; receive lanes (the TIAs' half) run back toward the switch chip —
  // both riding the same asic/entry/land points the trace above is drawn from, with a short rise at the end into
  // the stacked die (the same pierce the single abstracted flow used before). One LaneFlow per direction keeps
  // this at the same two dataFlow entries (and draw calls) per engine as before.
  const ringHalf = ringLandings.length / 2;
  engines.forEach((e, i) => {
    const { scale } = engineBusWidth('ring', engines, e);
    const laneUp = ([asic, entry, land]) => {
      const [lx, lz] = land, top = [lx - e.out[0] * 0.3, Y.eng + 0.1, lz - e.out[1] * 0.3];
      return [[asic[0], Y.subTop + 0.02, asic[1]], [entry[0], Y.subTop + 0.02, entry[1]], [land[0], Y.subTop + 0.02, land[1]], top];
    };
    const lanesOf = set => set.map(([px, py]) => engineBusPoint('ring', e, RING_R, px, py, scale, ringEntryR)).map(laneUp);
    // The route-ribbon overlay (flow-ribbons.js) draws every one of a flow's own path segments at full glow; with
    // 16 real lane segments this close together, across 18 engines, that reads as one solid sheet rather than a
    // bus. Tone it down the same way rack-optics.js does for its own per-lane flows; the moving pulses still
    // carry the "several lanes" read at full brightness.
    const bus = lanes => Object.assign(laneFlow(lanes, 'eth', { ...FLOW.elecBus, audit: AU.onBus }), { ribbonIntensity: 0.3 });
    R.addFlow('data', bus(lanesOf(ringLandings.slice(0, ringHalf))));
    R.addFlow('data', bus(lanesOf(ringLandings.slice(ringHalf)).map(l => [...l].reverse())));
    // Every modeled engine is active. These route-level marks sample its lane
    // bundle; they are not a count of fibers or a bandwidth scale.
    const routes = fiberRoutes[i];
    R.addFlow('data', flow(roundCorners(routes.tx[3]), 'tx', { ...FLOW.light, audit: AU.throughConnector }));
    R.addFlow('data', flow(roundCorners([...routes.rx[3]].reverse()), 'rx', { ...FLOW.light, audit: AU.throughConnector }));
    R.addFlow('data', flow(roundCorners(routes.cw[0], keepCwCorner, CW_BEND), 'cw', { ...FLOW.cw, audit: AU.throughConnector }));
  });
  // in the detail: electrical in to a driver, down a bond to its ring; laser light along the bus; light out; light in
  // to a photodiode, up a bond to its TIA, electrical out
  for (const i of [1, 4, 6]) {
    const zIn = -0.55 + (i % 3) * 0.22, zOut = 0.55 - (i % 3) * 0.22;
    const [rx_] = ringAt(i), [bondX, bondZ] = ringBondAt(i);
    R.addFlow('data', flow([w(electricalEdge - 1.6, 0.96, zIn), w(electricalEdge, 0.96, zIn), w(bondX, 0.89, bondZ), w(bondX, 0.09, bondZ)], 'eth', { ...FLOW.elec, audit: AU.throughBond }));
    R.addFlow('data', flow([w(PW / 2 + 2.6, 0.1, pcz(RING.busY)), w(PW / 2, 0.09, pcz(RING.busY)), w(pcx(RING.manX), 0.09, pcz(RING.busY)), w(pcx(RING.manX), 0.09, txRowZ(i)), w(rx_, 0.09, txRowZ(i))], 'cw', { ...FLOW.cw, audit: AU.throughGlass }));
    R.addFlow('data', flow([w(rx_, 0.09, txRowZ(i)), w(PW / 2, 0.09, txRowZ(i)), w(PW / 2 + 2.6, 0.1, txRowZ(i))], 'tx', { ...FLOW.light, audit: AU.throughGlass }));
    R.addFlow('data', flow([w(PW / 2 + 2.6, 0.14, rxRowZ(i)), w(PW / 2, 0.09, rxRowZ(i)), w(pdX, 0.09, rxRowZ(i))], 'rx', { ...FLOW.light, audit: AU.throughGlass }));
    R.addFlow('data', flow([w(pdX, 0.09, rxRowZ(i)), w(pdX, 0.89, rxRowZ(i)), w(electricalEdge, 0.96, zOut), w(electricalEdge - 1.6, 0.96, zOut)], 'eth', { ...FLOW.elec, audit: AU.throughBond }));
  }
  engines.forEach(({ x, z }) => R.addFlow('power', flow([[x, -1.0, z], [x, Y.sub, z], [x, Y.eng, z]], 'v33', { ...FLOW.power, audit: AU.upStack })));
  // Heat per part on the site's one log rule (src/heat.js, PART_W.cpo): each engine, then the water carrying it all.
  engines.forEach(({ x, z }, i) => R.addFlow('heat', tagHeat(flow([[x, Y.eng + 0.1, z], [x, Y.plate - 0.2, z]], 'hot', FLOW.heat), `engine-${i}`, PART_W.cpo.engine)));
  R.addFlow('heat', tagHeat(flow([[-1.4, pipeTop, pipeZ], [-1.4, Y.plate, pipeZ], [-1.4, Y.plate, 3], [1.4, Y.plate, 3], [1.4, Y.plate, pipeZ], [1.4, pipeTop, pipeZ]], 'cool', { count: 10, speed: 1.6, size: 0.06, k: 2.2, trail: false }), 'coldplate-water', PART_W.cpo.asic + engines.length * PART_W.cpo.engine, 'carrier'));

  // ---- shared flows: the switch chip's power and heat, the laser modules' power ----
  const shared = (mode, f) => { lists[mode].push(f); scene.add(f.group); };
  const activeDieSpan = (ASIC_HALF - .2) * 2;
  for (let i = 0; i < 24; i++) { const x = (rnd() - 0.5) * activeDieSpan, z = (rnd() - 0.5) * activeDieSpan; shared('power', flow([[x, -1.2, z], [x, Y.sub, z], [x, Y.die, z]], 'core', { ...FLOW.power, audit: AU.upStack })); }
  els.forEach(([x, z]) => shared('power', flow([[x + 2.3, Y.sub + 0.45, z], [x + 0.9, Y.sub + 0.45, z]], 'v33', { ...FLOW.power, audit: AU.intoEls })));
  // A few sampled columns read as rising heat; a dense sheet hid the die and the plate behind it.
  for (let i = 0; i < 14; i++) { const x = (rnd() - 0.5) * activeDieSpan, z = (rnd() - 0.5) * activeDieSpan; shared('heat', tagHeat(flow([[x, Y.die + 0.06, z], [x, Y.plate - 0.2, z]], 'hot', FLOW.heat), 'asic', PART_W.cpo.asic)); }

  // ======================= labels =======================
  const FZ = SUB / 2 + 4.6;                              // the labels stand in front of the package, clear of the view's buttons
  // captions that belong to one design; setVariant shows the current design's
  const viewLabel = (k, ...a) => { const sprite = label(scene, ...a); sprite.userData.cpoVariant = k; return sprite; };
  label(scene, 'Co-packaged optics · one switch package', [0, 0.6, FZ], '#e8ecf2', 0.36);
  viewLabel('ring', 'Size and layout representative · counts are NVIDIA’s', [0, 0.1, FZ], note, 0.2);
  viewLabel('ring', '18 engines × 1.6 Tb/s = 28.8 Tb/s each way', [0, -0.3, FZ], unitCol, 0.2);
  viewLabel('ring', 'Each engine: 8 lanes × 200 Gb/s = 1.6 Tb/s each way, like one 1.6T module', [0, -0.65, FZ], unitCol, 0.17);
  viewLabel('ring', 'Detail · one engine, lifted out and exploded · 2.5×', [DX, DY - 0.45, DZ + 2.45], '#e8ecf2', 0.15);
  viewLabel('ring', 'Functional schematic · bonded faces and surface fiber coupling unfolded', [DX, DY - 0.45, DZ + 2.0], note, 0.13);
  viewLabel('ring', 'Electronic chip: drivers (TX) and TIAs (RX)', [DX, DY + 2.35, DZ - 1.6], unitCol, 0.15);
  viewLabel('ring', 'Photonic chip: ring modulators (TX), photodiodes (RX)', [DX, DY + 0.55, DZ + 2.0], unitCol, 0.15);
  viewLabel('ring', 'Light · all 8 lanes each way: 8 TX, 8 RX fibers, 2 laser fibers', [DX - PW / 2 - 1.6, DY + 0.75, DZ], COL.tx, 0.15);
  viewLabel('ring', 'TX / RX fibers → front-panel ports (outside this diagram)', [0, 2.8, 7.8], COL.tx, .16);
  label(scene, 'Lower amber fibers: laser supply only · no engine-to-engine optical loop', [0, .5, 7.8], COL.cw, .14);
  label(scene, 'Electrical · copper traces in the substrate', [0, Y.subTop + 0.5, -2.6], COL.elec, 0.15);
  viewLabel('ring', 'Laser modules · front panel, light only · 32 transmit lanes each', [ELSX, Y.sub + 1.6, 0], COL.cw, 0.16);
  viewLabel('ring', 'Five shown · allocation illustrative · 18 serve the four-package switch', [ELSX, Y.sub + 1.25, els[nEls - 1][1]], note, 0.13);

  // ======================= Broadcom-style package =======================
  const bailly = buildBailly({ view: views.mzm, M, B: views.mzm.B, authoredHardware, Y, viewLabel, FZ, ELSX, els });
  // one heat rule over both packages' streams: sources against sources, carriers (water, air) against carriers
  balanceHeat(heatFlows);

  scene.add(S.build()); scene.add(N.build({ cast: false }));
  for (const k of CPO_VARIANTS) views[k].group.add(views[k].B.build({ cast: false }));

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
    // the electronic chip's pin on a driver block, over lane 6's ring; the rings' and photodiodes' on the photonic die
    eic: fitted(w(pcx(CPO_RING.ringX(6)), 1.1, pcz(CPO_RING.ringZ(6))), [DX + 1.5, DY + 4.2, DZ + 4.2], stack, stackSize),
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
  const pins = {
    ring: {
      power: { asic: hs.asic, engine: hs.engine, els: hs.els, today: hs.today, next: hs.next },
      data: { asic: hs.asic, serdes: hs.serdes, eic: hs.eic, rings: hs.rings, pd: hs.pd, els: hs.els, fiberout: hs.fiberout, today: hs.today, next: hs.next },
      // Heat looks in under the lifted plate: the die glows below, its heat rises into the channels above.
      heat: { asic: view(hs.asic.pos, [1.2, 3.55, 10.5], [0, 2.75, 0]), coldplate: hs.coldplate },
    },
    mzm: {
      power: { ...bailly.hotspots, today: hs.today, next: hs.next },
      data: { ...bailly.dataHotspots, today: hs.today, next: hs.next },
      heat: bailly.heatHotspots,
    },
  };
  // The power layer's glow (src/power-glow.js): the switch chip, each engine or tile, and each laser module that
  // lights one, on the interposer or board under it. Both packages keep one reference (the switch chip), and the
  // toggle switches the other package's parts off.
  const pw = PART_W.cpo, onSlab = Y.inter + 0.056, lit = list => new Set(list.map(e => e.els));
  const powerDraw = [
    ...CPO_VARIANTS.map(k => ({ id: k === 'ring' ? 'asic' : 'mzm-asic', part: k === 'ring' ? 'asic' : 'mzm-asic', variants: [k], watts: pw.asic, at: [0, onSlab, 0], size: [ASIC_HALF * 2, ASIC_HALF * 2] })),
    ...engines.map((e, i) => ({ id: `engine-${i}`, part: 'engine', variants: ['ring'], watts: pw.engine, volt: 'v33', at: [e.x, Y.eng - 0.035, e.z], size: [1.35, 0.95], yaw: -e.rot })),
    ...bailly.tiles.map((t, i) => ({ id: `tile-${i}`, part: 'mzm-engine', variants: ['mzm'], watts: pw.tile, volt: 'v33', at: [t.x, MY - 0.035, t.z], size: [t.L, t.W], yaw: -t.rot })),
    ...CPO_VARIANTS.flatMap(k => els.map(([x, z], i) => ({ id: `${k}-els-${i}`, part: k === 'ring' ? 'els' : 'mzm-laser', variants: [k], watts: lit(k === 'ring' ? engines : bailly.tiles).has(i) ? pw.els : 0,
      volt: 'v33', at: [x, Y.sub + 0.005, z], size: [1.9, 1.1] }))),
  ];
  const glowActive = p => !p.variants || p.variants.includes(kind);
  let builtRef = null;
  let kind = 'ring';
  const viewSprites = scene.children.filter(o => o.isSprite && o.userData.cpoVariant);
  function setVariant(next) {
    kind = CPO_VARIANTS.includes(next) ? next : 'ring';
    for (const k of CPO_VARIANTS) views[k].group.visible = views[k].flowGroup.visible = k === kind;
    coolingHardware.visible = kind === 'ring';
    for (const sprite of viewSprites) sprite.visible = sprite.userData.cpoVariant === kind;
    builtRef?.powerGlow?.setActive(glowActive);
  }
  setVariant('ring');
  // The ring and Mach-Zehnder packages measure about 1.2 units apart on x (tools/orbit-center.mjs),
  // too far apart to share one orbit pivot at the 3% tolerance used for this level. Each variant's
  // pos keeps the same offset from target as the one camera this replaces (so the opening frame for
  // 'ring', the default, is unchanged), applied to the Mach-Zehnder package's own measured centre.
  // This builder's own (native, ?module=native) geometry, not side-cpo-blender.js's authored hardware:
  // ring's visible cold-plate (coolingHardware, shown only for 'ring') measures noticeably taller than
  // mzm's package, so the two pivots differ in y by more than the two packages' x offset alone would.
  const CAMERA = {
    ring: { pos: [-3.27, 24.37, 25.51], target: [-3.27, 3.37, -.99], portrait: { pos: [12.73, 31.67, 27.01], target: [-3.27, 3.37, -.99] } },
    mzm: { pos: [-4.51, 23.5, 25.43], target: [-4.51, 2.5, -1.07], portrait: { pos: [11.49, 30.8, 26.93], target: [-4.51, 2.5, -1.07] } },
  };
  return builtRef = {
    scene, flows, dataFlows, heatFlows, coolingHardware,
    powerDraw, powerDrawRef: pw.asic, powerDrawActive: glowActive,
    variant: {
      get kind() { return kind; }, set: setVariant, views, bailly,
      intro: mode => cpoIntro(kind, mode),
      // the data subtitle names each package by its engines (the level's own, for the ring package, is in data.js)
      sub: mode => kind === 'mzm' && mode === 'data' ? '8 Mach-Zehnder engine tiles · 51.2T' : null,
      partCopy: (part, mode) => cpoPartCopy(kind, part, mode),
      spriteVisible: sprite => !sprite.userData.cpoVariant || sprite.userData.cpoVariant === kind,
    },
    get camera() { return { ...CAMERA[kind], near: 0.05, far: 500, min: 2, max: 90 }; },
    get hotspots() { return pins[kind].power; },
    get dataHotspots() { return pins[kind].data; },
    get heatHotspots() { return pins[kind].heat; },
    update(t) {
      eqMark.material.opacity = 0.62 + 0.3 * Math.sin(t * 1.6); bailly.mark.material.opacity = eqMark.material.opacity;
      if (asicTop) asicTop.emissiveIntensity = state.mode === 'heat' ? 0.5 + 0.08 * Math.sin(t * 2) : 0;
    },
  };
}
export { BAILLY_DETAIL };
