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
