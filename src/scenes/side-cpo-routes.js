// Fiber cannot fold at a point. The route contract (side-geometry.js) stays a
// reviewed polyline; the drawn fiber and its moving light follow the same path
// with each interior corner rounded by a quadratic arc of up to 5 mm (4 mm for the thinner laser fibers), a gentle
// representative bend rather than a kink (design rule 5). build-cpo.py applies the identical rounding.
export const CW_BEND = .4;
export function roundCorners(pts, keep = () => false, radius = .5, steps = 6) {
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
// Laser feeds once kept a sharp drop from the module aperture and a sharp final lift onto the engine; every corner is
// now rounded (design rule 5). Kept as a hook for routes that must keep a corner.
export const keepCwCorner = () => false;

// Declared pass-throughs for the flow audit (tools/flow-audit.mjs): solids a CPO route enters on purpose, each with
// the reason. Everything else a route crosses is still a finding.
export const CPO_AUDIT = {
  // power rises from the board through the package's seating recess into the substrate, then up the stack
  upStack: { through: /Anodized[ _]recess/i, why: 'vertical power up through the package seat and substrate' },
  // the electrical lanes rise from the substrate into the engine inside its socket retainer
  intoEngine: { through: /RETAINERS/, why: 'up into the engine through its socket retainer' },
  // fiber leaves (and the laser feed arrives) through the engine's own fiber connector
  throughConnector: { through: /CPO_INTERFACES__Connector|Connector molding|strain relief/i, why: 'through the engine fiber connector it is plugged into' },
  // laser power arrives through the laser module's own connector
  intoEls: { through: /CPO_ELS__Connector|Connector molding/i, why: 'into the laser module through its power connector' },
  // detail: electrical lanes cross the bond pads and the EIC-to-PIC hybrid bond, inside the electronic die they belong to
  throughBond: { through: /Gold[ _]bond[ _]pads|electronic[ _]die[ _]face|hybrid-bond[ _]face/i, why: 'down through the EIC and its hybrid bond to the photonic die' },
  // detail: light enters and leaves the photonic die through its glass fiber-attach blocks
  throughGlass: { through: /(Transmit|Receive|Laser)[ _]glass/i, why: 'through the glass fiber-attach block on the photonic die' },
  // Broadcom-style tile: as drawn the EIC sits on the PIC's electrical end, so lanes from the substrate rise through
  // the photonic die and the bond into the stacked electronic die
  intoStack: { through: /MZM[ _](photonic|electronic)[ _]die[ _]face/i, why: 'up through through-silicon vias (TSVs) in the photonic die, as drawn, into the stacked electronic die' },
  // the per-lane bus flows (cpo-bailly.js, side-cpo.js): every sampled point rides the same three points
  // (asic tap, entry, landing cell) the wide package-trace bus itself is drawn from, end to end, including the
  // tap on the switch chip's own edge and the landing cell on the engine's die
  onBus: { through: true, why: "the whole run rides the drawn package-trace bus end to end: the ASIC tap, the trace to the engine's own inner edge, then straight into its landing cell" },
};
