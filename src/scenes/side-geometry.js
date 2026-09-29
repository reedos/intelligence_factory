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

// ---------- the copper cable plugs ----------
// four pairs each way per plug: transmit on the left half of the card, receive on the right; x of pair i's centerline
export const COPPER_HEADS = [['dac', -4.6], ['acc', 0], ['aec', 4.6]];
export const copperLane = (hx, i, rx) => hx + (rx ? 0.12 : -0.72) + i * 0.18;
export const PAIR_HALF = 0.02;                              // each pair's two traces sit this far either side of its centerline
// the chip in each plug's path: none, a redriver on the receive side, or a retimer across both directions
export const copperChip = (kind, hx) => kind === 'acc' ? { x: hx + 0.39, w: 0.62, d: 0.6, rxOnly: true } : kind === 'aec' ? { x: hx, w: 1.6, d: 0.95, rxOnly: false } : null;
