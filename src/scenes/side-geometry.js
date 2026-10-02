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
// where an engine's traffic reaches the ASIC's SerDes edge: along the facing edge, never past its corner
export const asicTap = e => { const t = Math.max(-TAP_MAX, Math.min(TAP_MAX, e.t * 0.6)); return [OUT[e.side][0] * ASIC_HALF + TAN[e.side][0] * t, OUT[e.side][1] * ASIC_HALF + TAN[e.side][1] * t]; };
// where its connector sits: on the package edge, in line with the engine; data and laser fibers both use it
export const edgeConnOf = (e, SUB) => [OUT[e.side][0] * (SUB / 2 + 0.2) + TAN[e.side][0] * e.t, OUT[e.side][1] * (SUB / 2 + 0.2) + TAN[e.side][1] * e.t];
// engines, in a fixed order, each with its side, its offset along the side and its position
export function engineLayout() {
  const r = 3.35, list = [];
  for (const [side, t0] of SUBS) for (let k = 0; k < 3; k++) {
    const t = t0 + (k - 1) * 1.12, out = OUT[side], tan = TAN[side];
    list.push({ side, t, out, tan, rot: side * Math.PI / 2, x: out[0] * r + tan[0] * t, z: out[1] * r + tan[1] * t, sub: [side, t0] });
  }
  return list;
}
// each laser module lights 32 transmit lanes (NVIDIA), four engines of eight: 18 engines need four and a half
export const elsOf = i => Math.floor(i / (ELS_LANES / 8));

// Representative fan-out, not a vendor harness drawing. Data fibers continue
// outward toward omitted front-panel ports; lower CW fibers terminate only at
// their assigned engine. Separate elevations prevent an apparent optical bus.
export function cpoFiberRoutes(e, i) {
  const { out, tan, side } = e;
  const point = (r, y, t) => [out[0] * r + tan[0] * t, y, out[1] * r + tan[1] * t];
  const data = Array.from({ length: 16 }, (_, j) => {
    const t = e.t + (j - 7.5) * .034;
    return [point(4.18, 1.73, t), point(5.4, 1.2, t),
      point(5.75, 1.2, t), point(6.8, 2.35, t), point(7.6, 2.35, t)];
  });
  const cw = Array.from({ length: 2 }, (_, j) => {
    const r = 5.94 + i * .032 + j * .013, y = .35 + i * .045 + j * .021;
    const lz = -4.4 + elsOf(i) * 2.2 + (i % 4 - 1.5) * .10 + (j - .5) * .028;
    const t = e.t + .305 + j * .028;
    // Descend outside the complete perimeter fan-out, then enter the assigned
    // elevation horizontally. A diagonal descent to r crosses other fibers.
    const end = point(r, y, t), pts = [[7.24, 1.5, lz], [6.95, y, lz], [r, y, lz]];
    if (side === 1 || side === 3) pts.push([r, y, side === 3 ? -r : r]);
    if (side === 2) pts.push([r, y, r], [-r, y, r]);
    pts.push(end, point(5.4, 1.2, t), point(4.18, 1.73, t));
    return pts;
  });
  return { tx: data.slice(0, 8), rx: data.slice(8), cw };
}

// ---------- the CPO engine views (Reed, 10/01/2026): ring, Mach-Zehnder, one die ----------
// The engine toggle on the CPO level draws three engine designs in one photonic-die frame, the 512 × 384 px frame
// of side-kit's RING layout, so every view keeps the same fiber rows, laser bus and photodiodes and only the
// modulators and the electronics move. The package, its 18 engines and every count stay NVIDIA's.
//   ring  an electronic die stacked on the photonic die; micro-ring modulators (NVIDIA-style, the original drawing)
//   mzm   an electronic die stacked on the photonic die; segmented Mach-Zehnder modulators (Broadcom-style, as reported)
//   mono  one die: drivers beside the rings, TIAs beside the photodiodes (Ranovus Odin / Ayar Labs TeraPHY-style)
// Pure data, read by side-cpo.js, the face textures (cpo-variants.js) and tools/blender/build-cpo.py (through
// link-layout.json, written by tools/blender/export-cpo-layout.mjs). Positions are representative, not floorplans.
export const CPO_VARIANTS = ['ring', 'mzm', 'mono'];
const lanes8 = f => Array.from({ length: 8 }, (_, i) => f(i));
const txRow = i => 50 + i * 20, rxRow = i => 214 + i * 20;
// Mach-Zehnder: each lane's laser branch splits at `split` into two arms `arm` px either side of the lane row, runs
// the long arms from `armIn` to `armOut` and recombines at `join`. Three electrode segments lie between the arms
// (the write-ups of Broadcom's ISSCC 2026 paper 23.4 drive each modulator in three segments: one for the PAM4 low
// bit, two for the high bit); each segment's driver bond is a pad at its input end. Arms are drawn far shorter than a
// real silicon MZM, but many times a ring's diameter.
export const CPO_MZM = {
  busY: 24, manX: 24, split: 150, armIn: 168, armOut: 404, join: 422, arm: 5, segW: 4, segments: 3,
  row: txRow, rxRow, pdX: 77,
  seg: k => [176 + 74 * k, 242 + 74 * k], pad: k => 182 + 74 * k,
};
// One die: the ring layout's bus and manifold, rings spread over the die, each lane's driver circuit beside its
// ring (left of it, level with its center, between its own branch and the previous lane's waveguide) and each
// photodiode's TIA beside it on the electrical side. Rects are [x0, y0, x1, y1].
export const CPO_MONO = {
  busY: 24, manX: 24, row: txRow, rxRow, pdX: 77, ringR: 6, ringGap: 4,
  ringX: i => 150 + 36 * i, ringZ: i => txRow(i) - 10,
  driver: i => [150 + 36 * i - 32, txRow(i) - 15, 150 + 36 * i - 12, txRow(i) - 5],
  tia: i => [30, rxRow(i) - 6, 56, rxRow(i) + 6],
};
// The same, as plain numbers for the Blender build.
export function cpoVariantLayout() {
  const M = CPO_MZM, O = CPO_MONO;
  return {
    frame: [512, 384],
    mzm: { busY: M.busY, manX: M.manX, split: M.split, armIn: M.armIn, armOut: M.armOut, join: M.join, arm: M.arm, segW: M.segW,
      rows: lanes8(M.row), rxRows: lanes8(M.rxRow), pdX: M.pdX,
      segs: Array.from({ length: M.segments }, (_, k) => M.seg(k)), pads: Array.from({ length: M.segments }, (_, k) => M.pad(k)) },
    mono: { busY: O.busY, manX: O.manX, rows: lanes8(O.row), rxRows: lanes8(O.rxRow), pdX: O.pdX, ringR: O.ringR,
      rings: lanes8(i => [O.ringX(i), O.ringZ(i)]), drivers: lanes8(O.driver), tias: lanes8(O.tia) },
  };
}

// ---------- the copper cable plugs ----------
// four pairs each way per plug: transmit on the left half of the card, receive on the right; x of pair i's centerline
export const COPPER_HEADS = [['dac', -4.6], ['acc', 0], ['aec', 4.6]];
export const copperLane = (hx, i, rx) => hx + (rx ? 0.15 : -0.63) + i * 0.16;
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
export const copperChip = (kind, hx) => kind === 'acc' ? { x: hx + 0.39, w: 0.62, d: 0.6, h: 0.085, rxOnly: true } : kind === 'aec' ? { x: hx, w: 1.42, d: 0.95, h: 0.194, rxOnly: false } : null;
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
