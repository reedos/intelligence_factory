// The CPO level's Broadcom-style package (Reed, 10/01/2026): a 51.2T Bailly-class package, eight radial 6.4T engine
// tiles around a Tomahawk 5-class switch chip (Broadcom's Bailly release: "eight silicon photonics based 6.4-Tbps
// optical engines" with "Tomahawk®5"), each tile an electronic die over the electrical end of a photonic die with
// segmented Mach-Zehnder modulators (write-ups of Broadcom's ISSCC 2026 paper 23.4), four FR4 wavelengths a fiber,
// a Broadcom Fiber Connector at its outer end and remote laser modules at the front. The reference system is
// air-cooled, so a finned heat sink stands where the NVIDIA-style package draws its cold plate. Sizes, the tile
// floorplan and the fiber routing are representative (evidence.js 'cpo-bailly-layout').
// This file builds the runtime half of that package: native stand-in geometry (the authored build draws the real
// meshes from the same layout), flows, captions, guides and pins, all into the package's own groups.
import { THREE, MAT, flow, die, strand, trace, label, FLOW, COL, note, unitCol } from './side-kit.js';
import { CPO_MZM, CPO_EIC, CPO_DIE, BAILLY, baillyLayout, baillyFiberRoutes, asicTap, eicBox, frameToLocal, cpoBlocks } from './side-geometry.js';
import { eicMzmTex, mzmCpoPicTex } from './cpo-variants.js';
import { roundCorners, keepCwCorner, CW_BEND } from './side-cpo-routes.js';
import { tagHeat, PART_W } from '../heat.js';

export const BAILLY_DETAIL = { s: 2.5, DX: -12.2, DY: 1.4, DZ: -8.4 };
export const MY = 1.56;   // the tiles' photonic die center: on the organic build-up layers (top 1.50)

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
  // package traces from the switch chip's SerDes edge to each tile's inner end
  const inner = t => [t.out[0] * BAILLY.rIn + t.tan[0] * t.t, t.out[1] * BAILLY.rIn + t.tan[1] * t.t];
  tiles.forEach(t => {
    const [ax, az] = asicTap(t), [ix, iz] = inner(t);
    for (let j = 0; j < 4; j++) { const o = (j - 1.5) * 0.09, px = t.tan[0] * o, pz = t.tan[1] * o; trace(B, [ax + px, az + pz], [ix + px, iz + pz], Y.subTop + 0.001, 0.03); }
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
  const bonds = [];
  for (let i = 0; i < 8; i++) {
    for (let k = 0; k < Z.segments; k++) bonds.push([pcx(Z.pad(k)), pcz(Z.row(i) - Z.strip)]);
    bonds.push([pcx(Z.pdX), pcz(Z.rxRow(i))]);
  }
  const guides = [];
  for (const [px, pz] of bonds) {
    for (const y of [0.09, 0.875]) B.cyl(0.026, 0.025, MAT.gold, ...w(px, y, pz), 8);
    guides.push(...w(px, 0.12, pz), ...w(px, 0.85, pz));
  }
  const guide = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(guides, 3)),
    new THREE.LineDashedMaterial({ color: 0x8292a6, dashSize: 0.06, gapSize: 0.055, transparent: true, opacity: 0.4 }));
  guide.computeLineDistances(); group.add(guide);
  if (!authoredHardware) {
    B.box(0.4, 0.4, W - 0.2, M.glass, ...w(L / 2 + 0.2, 0.1, 0));
    for (const [rows, mat, y] of [[Z.txOut, M.fiberTx, 0.1], [Z.rxIn, M.fiberRx, 0.14], [Z.lasers, M.fiberCw, 0.1]])
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
  tiles.forEach((t, i) => {
    const [ax, az] = asicTap(t), [ix, iz] = inner(t), top = [ix + t.out[0] * 0.3, MY + 0.12, iz + t.out[1] * 0.3];
    addFlow('data', flow([[ax, Y.subTop + 0.02, az], [ix, Y.subTop + 0.02, iz], top], 'eth', FLOW.elec));
    const o = 0.045, ox = t.tan[0] * o, oz = t.tan[1] * o;
    addFlow('data', flow([[top[0] + ox, top[1], top[2] + oz], [ix + ox, Y.subTop + 0.04, iz + oz], [ax + ox, Y.subTop + 0.04, az + oz]], 'eth', FLOW.elec));
    addFlow('data', flow(roundCorners(routes[i].tx[7]), 'tx', FLOW.light));
    addFlow('data', flow(roundCorners([...routes[i].rx[7]].reverse()), 'rx', FLOW.light));
    addFlow('data', flow(roundCorners(routes[i].cw[0], keepCwCorner, CW_BEND), 'cw', FLOW.cw));
    addFlow('power', flow([[t.x, -1.0, t.z], [t.x, Y.sub, t.z], [t.x, MY, t.z]], 'v33', FLOW.power));
    const [ex, ez] = [t.x - t.out[0] * 0.8, t.z - t.out[1] * 0.8];   // over the electronic die
    addFlow('heat', tagHeat(flow([[ex, MY + 0.13, ez], [ex, Y.plate - 0.2, ez]], 'hot', FLOW.heat), `tile-${i}`, PART_W.cpo.tile));
  });
  // air through the heat sink's fin channels, front (+x, the panel) to back, along the fins
  for (const z of [-3.3, -0.9, 1.5, 3.3]) addFlow('heat', tagHeat(flow([[4.9, Y.plate + 0.55, z], [-4.9, Y.plate + 0.55, z], [-6.2, Y.plate + 1.2, z]], 'air', { count: 8, speed: 1.6, size: 0.06, k: 1.6, trail: false }), 'heatsink-air', PART_W.cpo.asic + tiles.length * PART_W.cpo.tile, 'carrier'));
  // the detail: three sampled lanes, one in each electrode segment
  const pdx = pcx(Z.pdX);
  [1, 4, 6].forEach((i, n) => {
    const g = i < 4 ? 0 : 1, row = Z.row(i), zr = pcz(row), zs = pcz(row - Z.strip), [, s1] = Z.seg(n), padX = pcx(Z.pad(n));
    const zIn = -0.55 + (i % 3) * 0.22, zOut = 0.55 - (i % 3) * 0.22, dm = Z.demux[g], mx = Z.mux[g], rd = Z.rxDemux[g], rr = pcz(Z.rxRow(i));
    addFlow('data', flow([w(eEdge - 1.6, 0.96, zIn), w(eEdge, 0.96, zIn), w(padX, 0.89, zs), w(padX, 0.09, zs), w(pcx(s1), 0.09, zs)], 'eth', FLOW.elec), true);
    addFlow('data', flow([w(L / 2 + 2.6, 0.1, pcz(Z.lasers[g])), w(L / 2, 0.09, pcz(Z.lasers[g])), w(pcx(dm[2]), 0.09, pcz(Z.lasers[g])), w(pcx(dm[2]), 0.09, zr), w(pcx(Z.split), 0.09, zr)], 'cw', FLOW.cw), true);
    addFlow('data', flow([w(pcx(Z.split), 0.09, zr), w(pcx(Z.armIn), 0.09, pcz(row - Z.arm)), w(pcx(Z.armOut), 0.09, pcz(row - Z.arm)), w(pcx(Z.join), 0.09, zr), w(pcx(mx[0]), 0.09, zr), w(pcx(mx[2]), 0.09, pcz(Z.txOut[g])), w(L / 2, 0.09, pcz(Z.txOut[g])), w(L / 2 + 2.6, 0.1, pcz(Z.txOut[g]))], 'tx', FLOW.light), true);
    addFlow('data', flow([w(L / 2 + 2.6, 0.14, pcz(Z.rxIn[g])), w(L / 2, 0.09, pcz(Z.rxIn[g])), w(pcx(rd[2]), 0.09, pcz(Z.rxIn[g])), w(pcx(rd[0]), 0.09, rr), w(pdx, 0.09, rr)], 'rx', FLOW.light), true);
    addFlow('data', flow([w(pdx, 0.09, rr), w(pdx, 0.89, rr), w(eEdge, 0.96, zOut), w(eEdge - 1.6, 0.96, zOut)], 'eth', FLOW.elec), true);
  });

  // ---- captions ----
  viewLabel('mzm', 'Size and layout representative · counts are Broadcom’s, 51.2T Bailly', [0, 0.1, FZ], note, 0.2);
  viewLabel('mzm', '8 engines × 6.4T = 51.2T · 64 lanes each · 400G FR4 ports', [0, -0.3, FZ], unitCol, 0.2);
  viewLabel('mzm', 'Detail · one engine tile, lifted out and exploded · 2.5×', [DX, DY - 0.45, DZ + W / 2 + 1.3], '#e8ecf2', 0.15);
  viewLabel('mzm', 'Functional schematic · bonded faces unfolded · edge-coupled fibers', [DX, DY - 0.45, DZ + W / 2 + 0.9], note, 0.13);
  viewLabel('mzm', 'Electronic chip: drivers over the electrode ends (TX), TIAs (RX)', [DX + 1.6, DY + 2.35, DZ - 1.6], unitCol, 0.15);
  viewLabel('mzm', 'Photonic chip: Mach-Zehnder modulators, wavelength mux/demux, photodiodes', [DX - 0.6, DY + 0.55, DZ + W / 2 + 0.5], unitCol, 0.15);
  viewLabel('mzm', 'Light · 8 of 64 lanes: 2 TX, 2 RX, 2 laser fibers', [DX - L / 2 - 1.6, DY + 0.75, DZ], COL.tx, 0.15);
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
    eic: fitted(w(pcx(cpoBlocks('mzm').drivers[2][0]), 1.1, pcz(Z.row(2))), [DX + 2.0, DY + 4.6, DZ + 4.6], stack, stackSize),
    mod: fitted(w(pcx((CPO_EIC.mzm[2] + Z.armOut) / 2), 0.12, pcz(Z.row(3))), [DX - 1.2, DY + 3.8, DZ + 4.2], stack, stackSize),
    pd: fitted(w(pdx, 0.12, pcz(Z.rxRow(7))),   // the last receive lane: its label clears the die lettering
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
