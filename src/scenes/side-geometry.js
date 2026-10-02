// Pure geometry for the side levels, free of THREE and the DOM so the unit tests can check it (side-geometry.test.ts).
// World unit = 1 cm.

// ---------- the CPO package ----------
export const SUBS = [[1, -1.75], [1, 1.75], [3, -1.75], [3, 1.75], [0, 0], [2, 0]];   // [side, offset along it]: six subassemblies
// exact unit vectors per side (never cos/sin of multiples of pi/2, whose tiny remainders once sent 15 of 18
// connectors off the package edge): out points away from the ASIC, tan runs along the side
export const OUT = [[1, 0], [0, 1], [-1, 0], [0, -1]], TAN = OUT.map(([x, z]) => [-z, x]);
// Representative 24 mm square face, not a measured vendor die. Keep the drawn
// monolithic die within a conventional lithography field; taps follow its edge.
export const ASIC_HALF = 1.2, TAP_MAX = 1.0, ELS_LANES = 32;
// where an engine's traffic reaches the ASIC's SerDes edge: along the facing edge, never past its corner. The taps of
// one side spread over the edge in the same order as their engines (scaled by the side's widest engine offset,
// tMax), so the buses fan out without crossing and no two engines share a tap (design rules 2 and 6; before
// 10/01/2026 two engines per long side clamped onto one corner tap).
export const asicTap = e => { const t = TAP_MAX * e.t / (e.tMax || Math.max(Math.abs(e.t), TAP_MAX)); return [OUT[e.side][0] * ASIC_HALF + TAN[e.side][0] * t, OUT[e.side][1] * ASIC_HALF + TAN[e.side][1] * t]; };
// Laser modules sit at the front panel (+x), five along it from z = -4.4 to 4.4. Each engine takes its light from the
// module nearest its own z, four engines (32 transmit lanes, NVIDIA) at most per module: engines are ranked front to
// back and dealt out in fours from the front module, so a fiber's run round the package stays short (design rule 5).
export const ELS_Z = [-4.4, -2.2, 0, 2.2, 4.4];
/** @template {{ z: number, x: number, els: number, elsSlot: number }} T @param {T[]} list @param {number} perModule @returns {T[]} */
function dealLasers(list, perModule) {
  const order = list.map((e, i) => [e, i]).sort((a, b) => b[0].z - a[0].z || b[0].x - a[0].x);
  order.forEach(([e], k) => { e.els = ELS_Z.length - 1 - Math.floor(k / perModule); e.elsSlot = k % perModule; });
  return list;
}
// where its connector sits: on the package edge, in line with the engine; data and laser fibers both use it
export const edgeConnOf = (e, SUB) => [OUT[e.side][0] * (SUB / 2 + 0.2) + TAN[e.side][0] * e.t, OUT[e.side][1] * (SUB / 2 + 0.2) + TAN[e.side][1] * e.t];
// engines, in a fixed order, each with its side, its offset along the side and its position
export const RING_R = 3.35;
export function engineLayout() {
  const r = RING_R, list = [];
  for (const [side, t0] of SUBS) for (let k = 0; k < 3; k++) {
    const t = t0 + (k - 1) * 1.12, out = OUT[side], tan = TAN[side];
    list.push({ side, t, out, tan, rot: side * Math.PI / 2, r, x: out[0] * r + tan[0] * t, z: out[1] * r + tan[1] * t, sub: [side, t0], tMax: 0, els: 0, elsSlot: 0 });
  }
  for (const e of list) e.tMax = Math.max(...list.filter(o => o.side === e.side).map(o => Math.abs(o.t)));
  return dealLasers(list, ELS_LANES / 8);
}
// each laser module lights 32 transmit lanes (NVIDIA), four engines of eight: 18 engines need four and a half
export const elsOf = i => Math.floor(i / (ELS_LANES / 8));
export const ELS_COUNT = ELS_Z.length;

// Representative fan-out, not a vendor harness drawing. Data fibers continue
// outward toward omitted front-panel ports; lower CW fibers terminate only at
// their assigned engine. Separate elevations prevent an apparent optical bus.
export function cpoFiberRoutes(e, i) {
  const { out, tan, side } = e;
  const point = (r, y, t) => [out[0] * r + tan[0] * t, y, out[1] * r + tan[1] * t];
  const data = Array.from({ length: 16 }, (_, j) => {
    const t = e.t + (j - 7.5) * .034;
    return [point(4.18, 1.73, t), point(5.4, 1.2, t),
      point(6.1, 1.2, t), point(6.8, 2.35, t), point(7.6, 2.35, t)];
  });
  const cw = Array.from({ length: 2 }, (_, j) => {
    const r = 5.94 + i * .032 + j * .013, y = .35 + i * .04 + j * .02;
    const lz = ELS_Z[e.els ?? elsOf(i)] + ((e.elsSlot ?? i % 4) - 1.5) * .10 + (j - .5) * .028;
    const t = e.t + .305 + j * .028;
    // Descend outside the complete perimeter fan-out, then enter the assigned
    // elevation horizontally. A diagonal descent to r crosses other fibers.
    // An engine on the panel side (side 0) takes its fiber straight across from its module at its own height, no
    // short jog along the package edge (that tightened the bends); the others run round the outside.
    const end = point(r, y, t), pts = [[7.24, 1.5, lz], [7.0, y, lz]];
    if (side !== 0) pts.push([r, y, lz]);
    if (side === 1 || side === 3) pts.push([r, y, side === 3 ? -r : r]);
    if (side === 2) pts.push([r, y, r], [-r, y, r]);
    pts.push(end, point(5.4, 1.2, t), point(4.18, 1.73, t));
    return pts;
  });
  return { tx: data.slice(0, 8), rx: data.slice(8), cw };
}

// ---------- the CPO level's two packages (Reed, 10/01/2026) ----------
// A toggle shows two shipping designs, each in its own package:
//   ring  NVIDIA-style: the Quantum-X package above (six subassemblies of three engines), each engine an electronic
//         die stacked on a micro-ring photonic die
//   mzm   Broadcom-style: a 51.2T Bailly-class package, eight radial 6.4T engine tiles around a Tomahawk 5-class
//         switch chip, each an electronic die over the electrical end of a photonic die with segmented Mach-Zehnder
//         modulators (the write-ups of Broadcom's ISSCC 2026 paper 23.4); 400G FR4 ports, four wavelengths a fiber
// Every engine follows the signal path: its electrical edge (frame x = 0, local -x) faces the switch chip, where the
// package traces arrive; its fiber edge (frame x = W, local +x) faces the package edge, where the fibers leave. In
// both designs each driver block sits directly over the modulator it drives and each TIA over its photodiode, in
// lane order, as face-to-face bonding places them. Pure data, read by side-cpo.js, cpo-bailly.js, the faces
// (cpo-variants.js) and tools/blender/build-cpo.py (through link-layout.json, written by
// tools/blender/export-cpo-layout.mjs). Positions are representative, not floorplans.
export const CPO_VARIANTS = ['ring', 'mzm'];
const lanes8 = f => Array.from({ length: 8 }, (_, i) => f(i));
const txRow = i => 50 + i * 20, rxRow = i => 214 + i * 20;
// Each engine's photonic die, in package cm, and its drawing frame in px (one px scale per die, isotropic).
export const CPO_DIE = { ring: { L: 1.35, W: .95, fw: 512, fh: 384 }, mzm: { L: 1.6, W: 1.0, fw: 480, fh: 300 } };
// The ring engine, as side-kit's RING draws it: one lane per fiber, each lane's ring above its own waveguide, the
// eight in a straight row across the lanes with their drivers in a row above them, each bond pad beside its ring
// (RING.bondAt); the photodiodes near the fiber edge, where the receive waveguides arrive, under their TIAs.
export const CPO_RING = {
  busY: 24, manX: 24, row: txRow, rxRow, pdX: 440, ringR: 6,
  ringX: _i => 200, ringZ: i => txRow(i) - 10, pad: i => [213, txRow(i) - 10],
};
// The Mach-Zehnder tile, frame 480 × 300 (1.6 × 1.0 cm, about 2.2 : 1 with its connector, as in Broadcom's package
// images): ALL 64 lanes each way of a 6.4 Tb/s engine, its sixteen 400G FR4 ports (16 × 4 lanes × 100 Gb/s per
// direction). Transmit in the upper half: per FR4 group, laser light reaches a wavelength demultiplexer at the
// electrical end, which feeds four lanes; each lane splits into two arms, runs three electrode segments along them
// under the electronic die (one segment for the PAM4 low bit, two for the high bit, as reported), runs on past it with
// a bias heater and rejoins; a multiplexer near the fiber edge puts the group's four lanes on one transmit fiber.
// Receive in the lower half: one fiber per group, a demultiplexer, four photodiodes under their TIAs near the
// electronic die's outer edge. Laser light enters on two fibers, each running to a trunk along the electrical end
// that taps eight groups' demultiplexers (the laser fiber count and that split are representative, not published).
// Drawn arms are representative in length (real silicon Mach-Zehnder modulators run millimeters).
const MZ_LANES = 64, MZ_GROUPS = 16, MZ_PITCH = 2, MZ_GROUP = 8.5;
const mzTx0 = g => 11 + g * MZ_GROUP, mzRx0 = g => 155 + g * MZ_GROUP;
const mzTx = i => mzTx0(i >> 2) + (i & 3) * MZ_PITCH, mzRx = i => mzRx0(i >> 2) + (i & 3) * MZ_PITCH;
const lanesN = (n, f) => Array.from({ length: n }, (_, i) => f(i));
const groupBox = (x0, x1, y0) => [x0, y0 - .8, x1, y0 + 3 * MZ_PITCH + .8];
export const CPO_MZM = {
  lanes: MZ_LANES, groups: MZ_GROUPS, perGroup: 4, pitch: MZ_PITCH,
  row: mzTx, rxRow: mzRx, pdX: 170, pdW: 8, pdH: 1.4,
  lasers: [3, 149], trunkX: 8, feed: g => (g < MZ_GROUPS / 2 ? 0 : 1),           // two laser buses, eight groups each
  txOut: g => mzTx0(g) + 1.5 * MZ_PITCH, rxIn: g => mzRx0(g) + 1.5 * MZ_PITCH,  // per FR4 group: its transmit and receive fiber rows
  demux: g => groupBox(12, 20, mzTx0(g)), mux: g => groupBox(440, 452, mzTx0(g)), rxDemux: g => groupBox(440, 452, mzRx0(g)),
  split: 26, armIn: 30, armOut: 380, join: 384, arm: .6, elecW: 1.6, segments: 3,
  heater: [290, 330], seg: k => [36 + 40 * k, 72 + 40 * k], pad: k => 40 + 40 * k, coupler: [468, 478],
  // through-silicon via columns drawn in the detail (representative): under the electronic die, in the receive half
  // short of the photodiodes, where no waveguide runs, clear of the laser bus and trunk
  tsvX: [60, 90, 120], tsvZ: [166, 196, 226, 256, 282],
};
// The electronic die of each design, as a rect in its photonic frame: the ring's covers the die but for the fiber
// landing (1.23 × 0.902 cm, set back 0.5 mm from the fiber edge); the Mach-Zehnder tile's covers only the electrical
// end, over the electrode segments and the photodiodes, so the arms show past it.
export const CPO_EIC = { ring: [3.8, 9.7, 470.3, 374.3], mzm: [4, 4, 200, 296] };
// Where each design's driver and TIA blocks sit, in its frame: centered on the modulator they drive (the ring; the
// middle of the Mach-Zehnder electrode run, which its block spans) and on their photodiode.
export const cpoBlocks = kind => kind === 'ring'
  ? { drivers: lanes8(i => [CPO_RING.ringX(i), CPO_RING.ringZ(i)]), tias: lanes8(i => [CPO_RING.pdX, rxRow(i)]) }
  : { drivers: lanesN(MZ_LANES, i => [(CPO_MZM.seg(0)[0] + CPO_MZM.seg(CPO_MZM.segments - 1)[1]) / 2, mzTx(i)]), tias: lanesN(MZ_LANES, i => [CPO_MZM.pdX, mzRx(i)]) };
// A frame px to the engine's local frame (package cm; the detail scales by s): x along the engine (fiber edge +).
export const frameToLocal = (kind, px, py, s = 1) => { const d = CPO_DIE[kind]; return [(-d.L / 2 + px / d.fw * d.L) * s, (-d.W / 2 + py / d.fh * d.W) * s]; };
// An electronic die rect as a box in the engine's local frame: center along x and z, width along x, depth along z.
export function eicBox(kind, s = 1) {
  const [x0, y0, x1, y1] = CPO_EIC[kind], d = CPO_DIE[kind];
  const [cx, cz] = frameToLocal(kind, (x0 + x1) / 2, (y0 + y1) / 2, s);
  return { cx, cz, w: (x1 - x0) / d.fw * d.L * s, d: (y1 - y0) / d.fh * d.W * s };
}
// Representative substrate-trace landing cells per engine (Reed, 10/02/2026): enough traces to read clearly at
// package scale, each ending under a driver (transmit) or TIA (receive) cell so the fan spans the engine's whole
// electrical edge and bump field, as the real SerDes bus does, instead of a single spot (design-rules.md). Each
// Mach-Zehnder engine takes 128 differential pairs (64 lanes each way) across its electronic chip's whole
// electrical edge: one trace per FR4 group (16) stands in for that, alternating a representative lane's driver and
// TIA cell so the set still covers both the transmit and receive halves of the edge. Each ring engine takes 16
// pairs (8 lanes each way): one trace per lane (8), alternating driver and TIA the same way.
export function engineTraceLandings(kind) {
  const B = cpoBlocks(kind);
  if (kind === 'mzm') return Array.from({ length: CPO_MZM.groups }, (_, g) => {
    const lane = g * CPO_MZM.perGroup + 1;                       // a representative lane near the group's middle
    return g % 2 === 0 ? B.drivers[lane] : B.tias[lane];
  });
  return B.drivers.map((d, i) => (i % 2 === 0 ? d : B.tias[i]));
}
// A landing cell (frame px, py) as a world [x, z] offset from the package center, for an engine at radius r along
// `out` with tan-offset `e.t`: frameToLocal centers the die on its own frame, so its local x (electrical edge at
// -L/2, frame px = 0) runs along `out` and its local z runs along `tan`, both added to the engine's own position.
export function landingWorld(kind, e, r, px, py) {
  const [lx, lz] = frameToLocal(kind, px, py);
  return [e.out[0] * (r + lx) + e.tan[0] * (e.t + lz), e.out[1] * (r + lx) + e.tan[1] * (e.t + lz)];
}
// The substrate's single entrance point for a tile or engine, on its own radial line (no lateral fan yet): where
// the package trace from the ASIC's SerDes edge reaches the die's own footprint, before it fans out inside that
// footprint to the driver and TIA cells (engineTraceLandings, landingWorld). Used by both designs' trace fan, data
// flow and SerDes pin, so every one of those agrees on where the engine "starts".
export const tileEntry = t => [t.out[0] * BAILLY.rIn + t.tan[0] * t.t, t.out[1] * BAILLY.rIn + t.tan[1] * t.t];
export const ringEntry = e => [e.x - e.out[0] * 0.62, e.z - e.out[1] * 0.62];
// ---- the Broadcom-style package: eight radial tiles, two per side ----
// Short edge at the switch chip, fiber connector (Broadcom Fiber Connector, BFC) at the outer end. Tiles on a side
// sit 2 cm apart, clear of the corner tiles of the next side; their inner ends leave an 8 mm band for the package
// traces from the switch chip's SerDes edge. The tile order sets laser-fiber elevations, as for the ring engines.
const BAILLY_IN = 2.0, BAILLY_CONN = .6;
export const BAILLY = { n: 8, rIn: BAILLY_IN, conn: [BAILLY_IN + CPO_DIE.mzm.L, BAILLY_IN + CPO_DIE.mzm.L + BAILLY_CONN], t: 1.0, connH: .3,
  // the exploded detail of one tile: its scale and center (the die drawn 3.5x, so the 64 lanes' pitch reads)
  detail: { s: 3.5, DX: -12.2, DY: 1.4, DZ: -8.4 } };
export function baillyLayout() {
  const { L, W } = CPO_DIE.mzm, list = [];
  for (const side of [1, 3, 0, 2]) for (const t of [-BAILLY.t, BAILLY.t]) {
    const out = OUT[side], tan = TAN[side], r = BAILLY.rIn + L / 2;
    list.push({ side, t, out, tan, rot: side * Math.PI / 2, r, L, W, tMax: BAILLY.t, els: 0, elsSlot: 0, x: out[0] * r + tan[0] * t, z: out[1] * r + tan[1] * t });
  }
  return dealLasers(list, 2);
}
// Fibers out of each tile's connector: 16 transmit and 16 receive fibers (its sixteen 400G FR4 ports, duplex), drawn
// as two flat ribbons that rise and leave toward the front panel, and two laser fibers from the remote laser modules
// at the front, which run round the outside of the package low down and rise into the connector beside the data
// fibers. Same rules as the ring engines' routes: separate elevations, no crossings.
export function baillyFiberRoutes(e, i) {
  const { out, tan, side } = e, rc = BAILLY.conn[1];
  const point = (r, y, t) => [out[0] * r + tan[0] * t, y, out[1] * r + tan[1] * t];
  const data = Array.from({ length: 32 }, (_, j) => {
    const t = e.t + (j - 15.5) * .028;
    return [point(rc, 1.62, t), point(rc + .75, 1.62, t), point(6.6, 2.35, t), point(7.6, 2.35, t)];
  });
  const cw = Array.from({ length: 2 }, (_, j) => {
    const r = 5.94 + i * .032 + j * .013, y = .35 + i * .04 + j * .02;
    const lz = ELS_Z[e.els] + (e.elsSlot - .5) * .10 + (j - .5) * .028;
    const t = e.t + .52 + j * .028;
    const end = point(r, y, t), pts = [[7.24, 1.5, lz], [7.0, y, lz]];
    if (side !== 0) pts.push([r, y, lz]);
    if (side === 1 || side === 3) pts.push([r, y, side === 3 ? -r : r]);
    if (side === 2) pts.push([r, y, r], [-r, y, r]);
    pts.push(end, point(Math.max(rc + .6, 5.5), 1.3, t), point(rc, 1.52, t));   // lift clear of the package edge (5.2)
    return pts;
  });
  return { tx: data.slice(0, 16), rx: data.slice(16), cw };
}
// The same layouts, as plain numbers for the Blender build.
export function cpoVariantLayout() {
  const R = CPO_RING, M = CPO_MZM;
  const tiles = baillyLayout();
  return {
    die: CPO_DIE, eic: CPO_EIC,
    ring: { busY: R.busY, manX: R.manX, rows: lanes8(R.row), rxRows: lanes8(R.rxRow), pdX: R.pdX, ringR: R.ringR,
      rings: lanes8(i => [R.ringX(i), R.ringZ(i)]), pads: lanes8(R.pad) },
    mzm: { rows: lanesN(M.lanes, M.row), rxRows: lanesN(M.lanes, M.rxRow), pdX: M.pdX, pdW: M.pdW, pdH: M.pdH, lasers: M.lasers, trunkX: M.trunkX,
      feeds: lanesN(M.groups, M.feed), txOut: lanesN(M.groups, M.txOut), rxIn: lanesN(M.groups, M.rxIn),
      demux: lanesN(M.groups, M.demux), mux: lanesN(M.groups, M.mux), rxDemux: lanesN(M.groups, M.rxDemux),
      split: M.split, armIn: M.armIn, armOut: M.armOut, join: M.join, coupler: M.coupler,
      arm: M.arm, elecW: M.elecW, heater: M.heater, tsvX: M.tsvX, tsvZ: M.tsvZ,
      segs: Array.from({ length: M.segments }, (_, k) => M.seg(k)), pads: Array.from({ length: M.segments }, (_, k) => M.pad(k)) },
    bailly: { ...BAILLY, tiles, taps: tiles.map(asicTap), fiberRoutes: tiles.map(baillyFiberRoutes) },
    ringTaps: engineLayout().map(asicTap),
    // Fanned package-trace landings (Reed, 10/02/2026): each engine's own entrance point, then the world [x, z] of
    // every trace that fans from there to a driver or TIA cell, across its electronic chip's whole electrical edge
    // (engineTraceLandings, landingWorld, tileEntry, ringEntry). Pre-computed here so the Blender build draws the
    // same traces as the native scene, not a re-derivation of the same math.
    ringEntry: engineLayout().map(ringEntry),
    ringLandings: engineLayout().map(e => engineTraceLandings('ring').map(([px, py]) => landingWorld('ring', e, RING_R, px, py))),
    tileEntry: tiles.map(tileEntry),
    mzmLandings: tiles.map(t => engineTraceLandings('mzm').map(([px, py]) => landingWorld('mzm', t, t.r, px, py))),
  };
}

// ---------- the copper cable plugs ----------
// four pairs each way per plug: transmit on the left half of the card, receive on the right; x of pair i's centerline.
// The two banks sit toward the card edges (0.15 cm pitch) and leave a 4.4 mm centre channel for the supply trace,
// the ID memory and the AEC's power inductors, so no pair runs beside a switching part (design review 10/01/2026).
export const COPPER_HEADS = [['dac', -4.6], ['acc', 0], ['aec', 4.6]];
export const COPPER_PITCH = 0.15, COPPER_CHANNEL = 0.25;
export const copperLane = (hx, i, rx) => hx + (rx ? COPPER_CHANNEL + i * COPPER_PITCH : -(COPPER_CHANNEL + (3 - i) * COPPER_PITCH));
// The card edge: 38 contacts (QSFP112 MSA), drawn as 19 on each face at a representative 0.8 mm pitch.
// Kinds per face, host-left to right: g ground, s high-speed signal, l low-speed control, p power. Grounds reach
// nearest the edge, power next, signals last (the MSA's ground, power, signal mating order).
export const COPPER_PADS = 'gssgssgllpllgssgssg', PAD_PITCH = 0.08;
export const copperPadX = (hx, j) => hx + (j - 9) * PAD_PITCH;
// Where each pair meets the edge: half the pairs on the top face, half on the bottom, reaching the top-layer
// routing through vias. Returns the pad pair's centerline and its face.
export const copperPad = (hx, i, rx) => {
  const top = rx ? i % 2 === 1 : i % 2 === 0;
  const outer = rx ? i >= 2 : i <= 1;
  return { x: hx + (rx ? 1 : -1) * (outer ? 0.6 : 0.36), top };
};
export const PAIR_HALF = 0.02;                              // each pair's two traces sit this far either side of its centerline
// the chip in each plug's path: none, a redriver on the receive side, or a retimer across both directions
// h: package height above the card (representative: a leaded QFN redriver; a lidded flip-chip BGA retimer).
export const copperChip = (kind, hx) => kind === 'acc' ? { x: hx + 0.475, w: 0.58, d: 0.6, h: 0.085, rxOnly: true } : kind === 'aec' ? { x: hx, w: 1.5, d: 0.95, h: 0.194, rxOnly: false } : null;
// Twinax pairs leave the card's rear termination in a row and gather into a round pack inside the jacket: transmit
// pairs on the left half of the ring, receive on the right, outer lanes nearer the horizontal, alternating above and
// below so neighbours never cross. Centerline control points (world cm) for pair i.
export const COPPER_RING = 0.24;
export function copperPairRoute(hx, i, rx, { cardTop = 0.94, cardY = 0.9, start = -2.02, end = -6.2 } = {}) {
  const x = copperLane(hx, i, rx), k = rx ? 3 - i : i;                  // k: 0 outermost .. 3 innermost
  const deg = [157.5, 202.5, 112.5, 247.5][k] * Math.PI / 180, sx = rx ? -1 : 1;
  const rxp = hx + sx * COPPER_RING * Math.cos(deg), ryp = COPPER_RING * Math.sin(deg);
  const yA = cardTop + 0.036;                                              // resting on the card: dielectric radius
  return [[x, yA, start], [x, yA + 0.02, start - 0.33], [x * 0.35 + rxp * 0.65, cardY + ryp * 0.7 + (yA - cardY) * 0.3, -3.15],
    [rxp, cardY + ryp, -3.9], [rxp, cardY + ryp, end]];
}
