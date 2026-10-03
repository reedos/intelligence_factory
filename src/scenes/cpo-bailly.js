// The CPO level's Broadcom-style package (Reed, 10/01/2026): a 51.2T Bailly-class package, eight radial 6.4T engine
// tiles around a Tomahawk 5-class switch chip (Broadcom's Bailly release: "eight silicon photonics based 6.4-Tbps
// optical engines" with "Tomahawk®5"), each tile an electronic die over the electrical end of a photonic die with
// segmented Mach-Zehnder modulators (write-ups of Broadcom's ISSCC 2026 paper 23.4), four FR4 wavelengths a fiber,
// a Broadcom Fiber Connector at its outer end and remote laser modules at the front. The reference system is
// air-cooled, so a finned heat sink stands where the NVIDIA-style package draws its cold plate. Sizes, the tile
// floorplan and the fiber routing are representative (evidence.js 'cpo-bailly-layout').
// This file builds the runtime half of that package: native stand-in geometry (the authored build draws the real
// meshes from the same layout), flows, captions, guides and pins, all into the package's own groups.
import { THREE, MAT, flow, laneFlow, die, strand, trace, label, FLOW, COL, note, unitCol } from './side-kit.js';
import { CPO_MZM, CPO_EIC, CPO_DIE, BAILLY, baillyLayout, baillyFiberRoutes, asicTap, eicBox, frameToLocal, cpoBlocks, engineTraceLandings, landingWorld, tileEntry, engineBusWidth, engineBusPoint, engineEntryRadius } from './side-geometry.js';
import { eicMzmTex, mzmCpoPicTex } from './cpo-variants.js';
import { roundCorners, keepCwCorner, CW_BEND, CPO_AUDIT as AU } from './side-cpo-routes.js';
import { tagHeat, PART_W } from '../heat.js';

export const BAILLY_DETAIL = BAILLY.detail;
export const MY = 1.56;   // the tiles' photonic die center: on the organic build-up layers (top 1.50)
// where the detail's electronic-chip and modulator pins sit along the tile, in frame px (see the pins below)
export const PIN_EIC_X = 45, PIN_MOD_X = 375;

export function buildBailly({ view, M, B, authoredHardware, Y, viewLabel, FZ, ELSX, els }) {
  const { group, addFlow } = view;
  const tiles = baillyLayout(), routes = tiles.map(baillyFiberRoutes);
  const D = CPO_DIE.mzm, { s, DX, DY, DZ } = BAILLY_DETAIL;
  // ---- native stand-ins for the authored meshes ----
  if (!authoredHardware) {
    const pic = mzmCpoPicTex(), eic = eicMzmTex(), e = eicBox('mzm');
    B.box(9.0, 0.1, 9.0, MAT.pcbBlack, 0, Y.inter, 0);   // the organic build-up layers under the switch chip and tiles
    for (const t of tiles) {
      die(group, M, D.L, 0.06, D.W, pic, t.x, MY, t.z, -t.rot);
      die(group, M, e.w, 0.07, e.d, eic, t.x + t.out[0] * e.cx, MY + 0.073, t.z + t.out[1] * e.cx, -t.rot);
      const c = (BAILLY.conn[0] + BAILLY.conn[1]) / 2;
      B.box(0.6, BAILLY.connH, D.W, MAT.polymer, t.out[0] * c + t.tan[0] * t.t, MY + 0.09, t.out[1] * c + t.tan[1] * t.t, -t.rot);
    }
    // the heat sink's stand-in: a see-through block where the authored fins stand
    const sink = new THREE.Mesh(new THREE.BoxGeometry(9.27, 0.95, 9.27), new THREE.MeshPhysicalMaterial({ color: 0xb0b8c0, metalness: 0.6, roughness: 0.4, transparent: true, opacity: 0.1, depthWrite: false }));
    sink.position.set(0, Y.plate + 0.4, 0); sink.name = 'CPO heat sink stand-in'; group.add(sink);
    const dp = mzmCpoPicTex(), de = eicMzmTex(), ed = eicBox('mzm', s);
    die(group, M, D.L * s, 0.15, D.W * s, dp, DX, DY, DZ, Math.PI);
    die(group, M, ed.w, 0.12, ed.d, de, DX - ed.cx, DY + 0.95, DZ - ed.cz, Math.PI);
  }
  // the substrate's entrance point for each tile (used below by the data flow and the SerDes pin only)
  const inner = tileEntry;
  // package traces: a wide, evenly pitched bus from the switch chip's SerDes edge, landing straight on the
  // driver and TIA cells across the tile's whole electrical edge (one trace per lane shown, 16; see
  // engineTraceLandings in side-geometry.js). Each trace leaves the ASIC already at its own lane's offset — no
  // shared trunk — spreads to that offset over the run to the tile's own inner edge (engineEntryRadius; for this
  // design, which never needs to narrow, that is a straight, parallel line start to entry), then runs straight
  // into the die to its cell.
  const landings = engineTraceLandings('mzm'), entryR = engineEntryRadius('mzm');
  tiles.forEach(t => {
    const { desired, scale } = engineBusWidth('mzm', tiles, t);
    const pitch = landings.length > 1 ? (2 * desired) / (landings.length - 1) : desired;
    const w = Math.min(0.022, pitch * 0.4);
    for (const [px, py] of landings) {
      const [asic, entry, land] = engineBusPoint('mzm', t, t.r, px, py, scale, entryR);
      trace(B, asic, entry, Y.subTop + 0.001, w);
      trace(B, entry, land, Y.subTop + 0.001, w);
    }
  });
  tiles.forEach((t, i) => {
    for (const [kind, material] of [['tx', M.fiberTx], ['rx', M.fiberRx], ['cw', M.fiberCw]])
      for (const points of routes[i][kind]) strand(B, kind === 'cw' ? roundCorners(points, keepCwCorner, CW_BEND) : roundCorners(points), material, kind === 'cw' ? .008 : .007);
  });

  // ---- the detail: one tile, lifted out, exploded, drawn 2.5x ----
  const w = (lx, ly, lz) => [DX - lx, DY + ly, DZ - lz];
  const L = D.L * s, W = D.W * s;
  const pcx = px => frameToLocal('mzm', px, 0, s)[0], pcz = py => frameToLocal('mzm', 0, py, s)[1];
  const ed = eicBox('mzm', s), eEdge = ed.cx - ed.w / 2, Z = CPO_MZM;
  // every lane's bonds: three on its electrode segments, one on its photodiode (64 lanes each way)
  const bonds = [];
  for (let i = 0; i < Z.lanes; i++) {
    for (let k = 0; k < Z.segments; k++) bonds.push([pcx(Z.pad(k)), pcz(Z.row(i))]);
    bonds.push([pcx(Z.pdX), pcz(Z.rxRow(i))]);
  }
  const guides = [];
  for (const [px, pz] of bonds) {
    B.cyl(0.0065, 0.012, MAT.gold, ...w(px, 0.099, pz), 8); B.cyl(0.0065, 0.025, MAT.gold, ...w(px, 0.875, pz), 8);
    guides.push(...w(px, 0.12, pz), ...w(px, 0.85, pz));
  }
  const guide = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(guides, 3)),
    new THREE.LineDashedMaterial({ color: 0x8292a6, dashSize: 0.06, gapSize: 0.055, transparent: true, opacity: 0.4 }));
  guide.computeLineDistances(); group.add(guide);
  if (!authoredHardware) {
    B.box(0.4, 0.4, W - 0.2, M.glass, ...w(L / 2 + 0.2, 0.1, 0));
    const groups = Array.from({ length: Z.groups }, (_, g) => g);
    for (const [rows, mat, y] of [[groups.map(Z.txOut), M.fiberTx, 0.1], [groups.map(Z.rxIn), M.fiberRx, 0.14], [Z.lasers, M.fiberCw, 0.1]])
      for (const r of rows) strand(B, [w(L / 2 + 0.4, y, pcz(r)), w(L / 2 + 2.6, y, pcz(r))], mat, 0.02);
    for (let j = 0; j < 6; j++) B.box(1.6, 0.01, 0.05, MAT.copper, ...w(eEdge - 0.8, 0.95, -0.55 + j * 0.22));
  }
  // corner marks round the detail, a bracket on the tile it shows and a dotted leader between them
  const corners = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = DX + sx * (L / 2 + 1.0), z = DZ + sz * (W / 2 + 0.9), y = DY - 0.25;
    corners.push(x - sx * 0.45, y, z, x, y, z, x, y, z, x, y, z - sz * 0.45);
  }
  group.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(corners, 3)),
    new THREE.LineBasicMaterial({ color: 0x617187, transparent: true, opacity: 0.55 })));
  const EQ = tiles[2];   // the back-side tile nearest the detail
  const ticks = [], hw = D.L / 2 + 0.1, hd = D.W / 2 + 0.1, y0 = MY - 0.1, y1 = MY + 0.25, tick = 0.34;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * hw, z = sz * hd;
    ticks.push(x, y1, z, x - sx * tick, y1, z, x, y1, z, x, y1, z - sz * tick * 0.8, x, y1, z, x, y0, z);
    ticks.push(x, y0, z, x - sx * tick, y0, z, x, y0, z, x, y0, z - sz * tick * 0.8);
  }
  const mark = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(ticks, 3)),
    new THREE.LineBasicMaterial({ color: 0xffcf7a, transparent: true, opacity: 0.9 }));
  mark.position.set(EQ.x, 0, EQ.z); mark.rotation.y = -EQ.rot; group.add(mark);
  const leader = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(DX + L / 2 + 0.3, DY + 1.6, DZ), new THREE.Vector3(DX + L / 2 + 1.2, DY + 1.6, DZ),
    new THREE.Vector3(EQ.x, y1 + 0.8, EQ.z), new THREE.Vector3(EQ.x, y1, EQ.z),
  ]), new THREE.LineDashedMaterial({ color: 0x8a96a8, dashSize: 0.18, gapSize: 0.14, transparent: true, opacity: 0.8 }));
  leader.computeLineDistances(); group.add(leader);

  // ---- flows ----
  // Electrical data rides the wide bus's own lanes (one real animated stream per drawn lane, matching the 16
  // traces drawn above, of the tile's 64) instead of one abstracted line: a 6.4T tile should read as carrying as
  // much as its fibers, not a trickle next to them. Transmit lanes (the drivers' half of engineTraceLandings) run
  // toward the engine; receive lanes (the TIAs' half) run back toward the switch chip — both riding the same
  // asic/entry/land points the trace is drawn from, with a short rise at the end into the stacked die (the same
  // pierce the single abstracted flow used before). One LaneFlow per direction keeps this at the same two
  // dataFlow entries (and draw calls) per tile as before, whatever lane count is drawn.
  const half = landings.length / 2;
  tiles.forEach((t, i) => {
    const { scale } = engineBusWidth('mzm', tiles, t);
    const laneUp = ([asic, entry, land]) => {
      const [lx, lz] = land, top = [lx + t.out[0] * 0.3, MY + 0.12, lz + t.out[1] * 0.3];
      return [[asic[0], Y.subTop + 0.02, asic[1]], [entry[0], Y.subTop + 0.02, entry[1]], [land[0], Y.subTop + 0.02, land[1]], top];
    };
    const lanesOf = set => set.map(([px, py]) => engineBusPoint('mzm', t, t.r, px, py, scale, entryR)).map(laneUp);
    // The route-ribbon overlay (flow-ribbons.js) draws every one of a flow's own path segments at full glow; with
    // 16 real lane segments this close together that reads as one solid sheet rather than a bus. Tone it down the
    // same way rack-optics.js does for its own per-lane flows; the moving pulses still carry the "several lanes"
    // read at full brightness.
    const bus = lanes => Object.assign(laneFlow(lanes, 'eth', { ...FLOW.elecBus, audit: AU.onBus }), { ribbonIntensity: 0.3 });
    addFlow('data', bus(lanesOf(landings.slice(0, half))));
    addFlow('data', bus(lanesOf(landings.slice(half)).map(l => [...l].reverse())));
    addFlow('data', flow(roundCorners(routes[i].tx[7]), 'tx', { ...FLOW.light, audit: AU.throughConnector }));
    addFlow('data', flow(roundCorners([...routes[i].rx[7]].reverse()), 'rx', { ...FLOW.light, audit: AU.throughConnector }));
    addFlow('data', flow(roundCorners(routes[i].cw[0], keepCwCorner, CW_BEND), 'cw', { ...FLOW.cw, audit: AU.throughConnector }));
    addFlow('power', flow([[t.x, -1.0, t.z], [t.x, Y.sub, t.z], [t.x, MY, t.z]], 'v33', { ...FLOW.power, audit: AU.upStack }));
    const ec = eicBox('mzm').cx, [ex, ez] = [t.x + t.out[0] * ec, t.z + t.out[1] * ec];   // over the electronic die
    addFlow('heat', tagHeat(flow([[ex, MY + 0.13, ez], [ex, Y.plate - 0.2, ez]], 'hot', FLOW.heat), `tile-${i}`, PART_W.cpo.tile));
  });
  // air through the heat sink's fin channels, front (+x, the panel) to back, along the fins
  for (const z of [-3.3, -0.9, 1.5, 3.3]) addFlow('heat', tagHeat(flow([[4.9, Y.plate + 0.55, z], [-4.9, Y.plate + 0.55, z], [-6.2, Y.plate + 1.2, z]], 'air', { count: 8, speed: 1.6, size: 0.06, k: 1.6, trail: false }), 'heatsink-air', PART_W.cpo.asic + tiles.length * PART_W.cpo.tile, 'carrier'));
  // the detail: moving light on three sampled lanes of the 64 (every lane is drawn), one bond on each electrode segment
  const pdx = pcx(Z.pdX), FY = 0.091;   // flows ride just above the waveguides and electrodes, under the pads
  [5, 30, 58].forEach((i, n) => {
    const g = i >> 2, row = Z.row(i), zr = pcz(row), [, s1] = Z.seg(n), padX = pcx(Z.pad(n));
    const zIn = -0.55 + n * 0.22, zOut = 0.55 - n * 0.22, dm = Z.demux(g), mx = Z.mux(g), rd = Z.rxDemux(g), rr = pcz(Z.rxRow(i));
    const lz = pcz(Z.lasers[Z.feed(g)]), gz = pcz(Z.txOut(g));
    addFlow('data', flow([w(eEdge - 1.6, 0.96, zIn), w(eEdge, 0.96, zIn), w(padX, 0.89, zr), w(padX, FY, zr), w(pcx(s1), FY, zr)], 'eth', { ...FLOW.elec, audit: AU.throughBond }), true);
    addFlow('data', flow([w(L / 2 + 2.6, 0.1, lz), w(L / 2, FY, lz), w(pcx(Z.trunkX), FY, lz), w(pcx(Z.trunkX), FY, gz), w(pcx(dm[0]), FY, gz), w(pcx(dm[2]), FY, zr), w(pcx(Z.split), FY, zr)], 'cw', { ...FLOW.cw, audit: AU.throughGlass }), true);
    addFlow('data', flow([w(pcx(Z.split), FY, zr), w(pcx(Z.armIn), FY, pcz(row - Z.arm)), w(pcx(Z.armOut), FY, pcz(row - Z.arm)), w(pcx(Z.join), FY, zr), w(pcx(mx[0]), FY, zr), w(pcx(mx[2]), FY, gz), w(L / 2, FY, gz), w(L / 2 + 2.6, 0.1, gz)], 'tx', { ...FLOW.light, audit: AU.throughGlass }), true);
    addFlow('data', flow([w(L / 2 + 2.6, 0.14, pcz(Z.rxIn(g))), w(L / 2, FY, pcz(Z.rxIn(g))), w(pcx(rd[2]), FY, pcz(Z.rxIn(g))), w(pcx(rd[0]), FY, rr), w(pdx, FY, rr)], 'rx', { ...FLOW.light, audit: AU.throughGlass }), true);
    addFlow('data', flow([w(pdx, FY, rr), w(pdx, 0.89, rr), w(eEdge, 0.96, zOut), w(eEdge - 1.6, 0.96, zOut)], 'eth', { ...FLOW.elec, audit: AU.throughBond }), true);
  });

  // ---- captions ----
  viewLabel('mzm', 'Size and layout representative · counts are Broadcom’s, 51.2T Bailly', [0, 0.1, FZ], note, 0.2);
  viewLabel('mzm', '8 engines × 6.4 Tb/s = 51.2 Tb/s', [0, -0.3, FZ], unitCol, 0.2);
  viewLabel('mzm', 'Each engine: 16 × 400G FR4 = 64 lanes × 100 Gb/s each way (106.25 Gb/s line rate)', [0, -0.65, FZ], unitCol, 0.17);
  viewLabel('mzm', `Detail · one engine tile, lifted out and exploded · ${s}×`, [DX, DY - 0.45, DZ + W / 2 + 1.3], '#e8ecf2', 0.15);
  viewLabel('mzm', 'Functional schematic · bonded faces unfolded · edge-coupled fibers', [DX, DY - 0.45, DZ + W / 2 + 0.9], note, 0.13);
  viewLabel('mzm', 'Electronic chip: drivers over the electrode ends (TX), TIAs (RX)', [DX + 1.6, DY + 2.35, DZ - 1.6], unitCol, 0.15);
  viewLabel('mzm', 'Photonic chip: Mach-Zehnder modulators, wavelength mux/demux, photodiodes', [DX - 0.6, DY + 0.55, DZ + W / 2 + 0.5], unitCol, 0.15);
  viewLabel('mzm', 'TSVs under the electronic chip · representative', [DX - 0.6, DY + 0.25, DZ + W / 2 + 0.5], note, 0.13);
  viewLabel('mzm', 'All 64 lanes each way · 16 TX + 16 RX fibers, 4 wavelengths each · 2 laser fibers', [DX - L / 2 - 1.6, DY + 0.75, DZ], COL.tx, 0.15);
  viewLabel('mzm', 'TX / RX fibers → 128 duplex LC front-panel ports (outside this diagram)', [0, 2.8, 7.8], COL.tx, .16);
  viewLabel('mzm', 'Remote laser modules · front panel, field-replaceable · count illustrative', [ELSX, Y.sub + 1.6, 0], COL.cw, 0.16);
  viewLabel('mzm', 'Five shown, four used here · allocation illustrative', [ELSX, Y.sub + 1.25, els[els.length - 1][1]], note, 0.13);

  // ---- pins ----
  const at = (p, v, t) => ({ pos: p, view: { pos: v, target: t } });
  const fitted = (p, v, t, size) => ({ pos: p, view: { pos: v, target: t, focus: p, detailSize: size } });
  const stack = w(0.3, 0.55, 0), stackSize = [L + 0.6, 1.2, W + 0.2];
  const conn = t => { const c = (BAILLY.conn[0] + BAILLY.conn[1]) / 2; return [t.out[0] * c + t.tan[0] * t.t, MY + 0.3, t.out[1] * c + t.tan[1] * t.t]; };
  const T1 = tiles[0], [tx1, tz1] = asicTap(T1), fo = conn(tiles[0]);   // the front tile right of center, clear of the landscape pins
  const hs = {
    asic: fitted([0, Y.die + 0.1, 0], [-1, 8.5, 7], [0, Y.die, 0], [3.6, 0.5, 3.6]),
    serdes: at([(tx1 + inner(T1)[0]) / 2, Y.subTop + 0.1, (tz1 + inner(T1)[1]) / 2 + 0.3], [T1.x + 1.5, 5, T1.z + 3.2], [T1.x * 0.5, Y.subTop, T1.z * 0.5]),
    engine: at([EQ.x, MY + 0.15, EQ.z], [EQ.x + 2.5, 5.5, EQ.z + 3.6], [EQ.x, MY, EQ.z]),
    // The three detail pins stand apart even when the detail is small (the package overview, phone): the electronic
    // chip's at its switch-chip end over the first lane's driver, the modulators' near the far end of the arms on a
    // front lane, the photodiodes' on the last receive lane at the back.
    eic: fitted(w(pcx(PIN_EIC_X), 1.1, pcz(Z.row(Z.lanes - 1))), [DX + 2.0, DY + 4.6, DZ + 4.6], stack, stackSize),
    mod: fitted(w(pcx(PIN_MOD_X), 0.12, pcz(Z.row(0))), [DX - 1.2, DY + 3.8, DZ + 4.2], stack, stackSize),
    pd: fitted(w(pdx, 0.12, pcz(Z.rxRow(Z.lanes - 1))),   // the last receive lane: its label clears the die lettering
      [DX + 1.8, DY + 2.5, DZ - 4.4], stack, stackSize),
    laser: at([ELSX, Y.sub + 1.0, 0], [ELSX + 3.2, 5, 5.5], [ELSX - 1, Y.sub, 0]),
    fiberout: fitted(fo, [fo[0] + 1.0, 7.5, fo[2] + 5.0], [fo[0], 1.6, fo[2] + 1.0], [3.2, 1.6, 3.0]),
    sink: at([1.5, Y.plate + 0.9, 1.0], [6, 10, 11], [0, 2.4, 0]),
  };
  return {
    tiles, routes, EQ, mark,
    hotspots: { 'mzm-asic': hs.asic, 'mzm-engine': hs.engine, 'mzm-laser': hs.laser },
    dataHotspots: { 'mzm-asic': hs.asic, 'mzm-serdes': hs.serdes, 'mzm-eic': hs.eic, 'mzm-mod': hs.mod, 'mzm-pd': hs.pd, 'mzm-laser': hs.laser, 'mzm-fiberout': hs.fiberout },
    heatHotspots: { 'mzm-asic': at(hs.asic.pos, [1.2, 3.55, 10.5], [0, 2.75, 0]), 'mzm-sink': hs.sink },
  };
}
