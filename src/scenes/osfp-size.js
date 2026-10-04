// The pluggable-module envelopes every level draws, in one place (meters, and tray units of 10 cm for the tray).
//
// OSFP MSA, as the module level and the hall already draw it: 22.58 mm wide, 13.0 mm tall, 107.8 mm with its heat sink
// (data.js 'OSFP body', ascentoptics-osfp-form-factor; osfp-msa Fig. 3-2: "width 22.58 +/- 0.10 mm, height 13.00 mm inside
// the cage"). The cage is the folded-metal mouth the module slides into: its opening is a little larger than the module
// (23.0 x 13.2 mm) inside a 0.8 mm wall, so a drawn module always fits its cage, and 25 mm cage pitch (the DGX H100's four
// side-by-side cages) still leaves them 0.4 mm apart. Wall and clearance are representative; the module is the MSA's.
//
// QSFP112, the storage and in-band cage of the BlueField DPU / ConnectX storage card (QSFP28/QSFP-DD class: 18.35 x 8.5 mm),
// in a cage built the same way.
const mm = v => v / 1000;

export const OSFP_MM = { w: 22.58, h: 13.0, len: 107.8, cageInnerW: 23.0, cageInnerH: 13.2, cageWall: 0.8 };
export const QSFP_MM = { w: 18.35, h: 8.5, cageInnerW: 18.6, cageInnerH: 8.8, cageWall: 0.6 };

const envelope = e => ({ w: mm(e.w), h: mm(e.h), cageW: mm(e.cageInnerW + 2 * e.cageWall), cageH: mm(e.cageInnerH + 2 * e.cageWall),
  innerW: mm(e.cageInnerW), innerH: mm(e.cageInnerH), wall: mm(e.cageWall) });
/** Meters. `w`, `h` the module; `cageW`, `cageH` the cage's outside; `innerW`, `innerH` its opening; `wall` its sheet. */
export const OSFP = { ...envelope(OSFP_MM), len: mm(OSFP_MM.len),
  label: [0.019, 0.0088] };   // the printed lid label every level draws on the module's exposed top (lid-labels.js text)
export const QSFP = envelope(QSFP_MM);

/** The same, in the tray level's units (10 cm). */
export const toTrayUnits = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Array.isArray(v) ? v.map(x => x * 10) : v * 10]));
export const OSFP_U = toTrayUnits(OSFP);
export const QSFP_U = toTrayUnits(QSFP);
