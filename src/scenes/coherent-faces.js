// The two coherent optical dies, as checked block diagrams (face-diagram.js). Canvas x runs from the RF end (x = 0,
// facing the driver/TIA and the DSP) to the fiber end (right), as the OIF HB-CDM and micro-ICR agreements place them;
// canvas y runs toward +z on the board. Fiber ports and RF pad rows are fixed by the scene and the Blender asset:
// the four RF lanes at y = 58 + 46k on the left edge; on the right edge the modulator's carrier in at y = h - 14 and
// light out at y = h/2, the receiver's signal in at y = h/2 and local oscillator in at y = 24.

export const RF_ROWS = [58, 104, 150, 196];
const BG = '#4a5468';
const C = {
  lo: 'rgba(255,179,71,0.92)', sig: 'rgba(255,122,217,0.92)', tx: 'rgba(98,230,255,0.95)', rf: 'rgba(201,161,74,0.95)',
  fill: 'rgba(255,255,255,0.16)', line: 'rgba(255,255,255,0.7)', edge: 'rgba(255,255,255,0.2)', text: 'rgba(255,255,255,0.88)',
};
const pads = (portName = 'out') => RF_ROWS.map((y, k) => ({ id: `rf${k}`, x: 2, y: y - 7, w: 24, h: 14, fill: C.rf, ports: { [portName]: [26, y] } }));

// ---------- receiver: OIF-DPC-RX-01.2 sec. 6 functions 1-5 ----------
// The signal's polarization splitter (PBS) hands X and Y to their own 90-degree hybrid; the local oscillator's
// polarization-maintaining power splitter (the IA allows a power splitter or a polarization splitter; this draws the
// former) feeds both hybrids' LO ports. Each hybrid's four outputs land on two balanced photodiode pairs, and each pair
// sends one current (XI, XQ, YI, YQ) to its RF pad. With both fibers on one end and every RF pad on the other, one
// optical crossing is unavoidable in a planar layout: the Y-hybrid's LO crosses the X signal, at a marked crossing.
export function icrDiagram() {
  const w = 512, h = 256;
  const boxes = [
    { id: 'fiber', x: 500, y: 0, w: 12, h, fill: C.edge, ports: { sig: [500, 128], lo: [500, 24] } },
    ...pads(),
    ...RF_ROWS.map((y, k) => ({
      id: `pd${k}`, x: 40, y: y - 18, w: 52, h: 36, fill: 'rgba(255,255,255,0.08)', stroke: 'rgba(255,122,217,0.75)',
      label: 'PD', size: 12, labelAt: [56, y], ports: { a: [92, y - 9], b: [92, y + 9], out: [40, y] },
      glyph: [{ x: 76, y: y - 14, w: 13, h: 10, fill: C.sig }, { x: 76, y: y + 4, w: 13, h: 10, fill: C.sig }],
    })),
    { id: 'hx', x: 150, y: 38, w: 112, h: 86, fill: C.fill, stroke: C.line, label: '90° X', size: 15,
      ports: { o0: [150, 49], o1: [150, 67], o2: [150, 95], o3: [150, 113], lo: [262, 62], s: [262, 100] } },
    { id: 'hy', x: 150, y: 132, w: 112, h: 86, fill: C.fill, stroke: C.line, label: '90° Y', size: 15,
      ports: { o0: [150, 141], o1: [150, 159], o2: [150, 187], o3: [150, 205], lo: [262, 150], s: [262, 190] } },
    { id: 'pbs', x: 404, y: 110, w: 44, h: 36, fill: C.fill, stroke: C.line, label: 'PBS', size: 13,
      ports: { in: [448, 128], x: [404, 118], y: [404, 138] } },
    { id: 'split', x: 384, y: 8, w: 64, h: 32, fill: C.fill, stroke: C.line, label: 'SPLIT', size: 12,
      ports: { in: [448, 24], x: [384, 18], y: [384, 32] } },
  ];
  const paths = [
    { id: 'sig', from: 'fiber.sig', to: 'pbs.in', pts: [[500, 128], [448, 128]], color: C.sig, width: 3 },
    { id: 'lo', from: 'fiber.lo', to: 'split.in', pts: [[500, 24], [448, 24]], color: C.lo, width: 3 },
    { id: 'loX', from: 'split.x', to: 'hx.lo', pts: [[384, 18], [290, 18], [290, 62], [262, 62]], color: C.lo, width: 2.5 },
    { id: 'loY', from: 'split.y', to: 'hy.lo', pts: [[384, 32], [330, 32], [330, 150], [262, 150]], color: C.lo, width: 2.5 },
    { id: 'sX', from: 'pbs.x', to: 'hx.s', pts: [[404, 118], [310, 118], [310, 100], [262, 100]], color: C.sig, width: 2.5 },
    { id: 'sY', from: 'pbs.y', to: 'hy.s', pts: [[404, 138], [350, 138], [350, 190], [262, 190]], color: C.sig, width: 2.5 },
  ];
  RF_ROWS.forEach((y, k) => {
    const hyb = k < 2 ? 'hx' : 'hy', o = (k % 2) * 2;
    for (const [n, port] of [[o, 'a'], [o + 1, 'b']]) {
      const py = y + (port === 'a' ? -9 : 9);
      paths.push({ id: `out${k}${port}`, from: `${hyb}.o${n}`, to: `pd${k}.${port}`, pts: [[150, py], [92, py]], color: C.sig, width: 2 });
    }
    paths.push({ id: `rf${k}`, from: `pd${k}.out`, to: `rf${k}.out`, pts: [[40, y], [26, y]], color: C.rf, width: 2.5 });
  });
  const texts = [
    { text: 'LO', x: 474, y: 12, size: 11, color: C.lo },
    { text: 'SIGNAL', x: 476, y: 114, size: 10, color: C.sig },
  ];
  return { w, h, bg: BG, boxes, paths, texts, crossings: [['loY', 'sX']] };
}

// ---------- modulator: a dual-polarization IQ modulator ----------
// Carrier in at the fiber end runs back along the bottom edge to the RF end, splits X/Y, then I/Q; four Mach-Zehnder
// modulators run toward the fiber end, the direction their traveling-wave electrodes carry the drive from the RF pads;
// Q gets its 90-degree phase section, X and Y recombine, Y passes the polarization rotator (PR), and the combiner
// (PBC) puts both on the output fiber. With both fibers on the fiber end and all four RF pads on the other, three
// electrode feeds must cross a waveguide in a planar drawing (on the chip, metal crossovers): XQ and YI cross the X
// branch, YQ crosses the carrier feed. Each crossing is marked; XI's feed crosses nothing.
export const IQ = { rows: [36, 90, 158, 210], mzIn: 230, mzOut: 430, arm: 8, bend: 16, elec: [254, 406] };
export function iqDiagram() {
  const w = 640, h = 256, { rows, mzIn, mzOut, arm, bend, elec } = IQ;
  const names = ['XI', 'XQ', 'YI', 'YQ'];
  // the drive electrode faces the side its feed arrives from: XI and YI above, XQ and YQ below
  const feedSide = [-1, 1, -1, 1], barY = (k, s) => rows[k] + s * 14;
  const boxes = [
    { id: 'fiber', x: 628, y: 0, w: 12, h, fill: C.edge, ports: { in: [628, 242], out: [628, 128] } },
    ...pads(),
    { id: 'pr', x: 524, y: 172, w: 32, h: 24, fill: C.fill, stroke: C.line, label: 'PR', size: 12, ports: { in: [524, 184], out: [556, 184] } },
    { id: 'pbc', x: 572, y: 50, w: 38, h: 150, fill: C.fill, stroke: C.line, label: 'PBC', size: 13, ports: { x: [572, 63], y: [572, 184], out: [610, 128] } },
  ];
  const paths = [
    { id: 'trunk', from: 'fiber.in', pts: [[628, 242], [132, 242], [132, 140], [150, 140]], color: C.lo, width: 3 },
    { id: 'xbr', pts: [[150, 140], [160, 130], [160, 63], [190, 63]], color: C.lo, width: 2.5 },
    { id: 'ybr', pts: [[150, 140], [160, 150], [160, 184], [190, 184]], color: C.lo, width: 2.5 },
    { id: 'xout', to: 'pbc.x', pts: [[506, 63], [572, 63]], color: C.tx, width: 2.5 },
    { id: 'yout', to: 'pr.in', pts: [[506, 184], [524, 184]], color: C.tx, width: 2.5 },
    { id: 'yrot', from: 'pr.out', to: 'pbc.y', pts: [[556, 184], [572, 184]], color: C.tx, width: 2.5 },
    { id: 'out', from: 'pbc.out', to: 'fiber.out', pts: [[610, 128], [628, 128]], color: C.tx, width: 3 },
  ];
  rows.forEach((y, k) => {
    const split = k < 2 ? [190, 63] : [190, 184], join = k < 2 ? [506, 63] : [506, 184], q = k % 2 === 1;
    paths.push({ id: `feed${k}`, pts: [split, [206, y], [mzIn, y]], color: C.lo, width: 2.5 });
    for (const s of [-1, 1]) paths.push({ id: `arm${k}${s}`, pts: [[mzIn, y], [mzIn + bend, y + s * arm], [mzOut - bend, y + s * arm], [mzOut, y]], color: C.tx, width: 2.5 });
    if (q) {
      boxes.push({ id: `ph${k}`, x: 444, y: y - 9, w: 32, h: 18, fill: C.fill, stroke: C.line, label: '90°', size: 12, ports: { in: [444, y], out: [476, y] } });
      paths.push({ id: `mz${k}`, to: `ph${k}.in`, pts: [[mzOut, y], [444, y]], color: C.tx, width: 2.5 });
      paths.push({ id: `q${k}`, from: `ph${k}.out`, pts: [[476, y], [480, y], join], color: C.tx, width: 2.5 });
    } else paths.push({ id: `mz${k}`, pts: [[mzOut, y], [480, y], join], color: C.tx, width: 2.5 });
    // traveling-wave electrodes along both arms; the feed lands on the drive electrode's RF-end edge
    for (const s of [-1, 1]) {
      const by = barY(k, s), drive = s === feedSide[k];
      boxes.push({ id: `el${k}${s}`, x: elec[0], y: by - 2, w: elec[1] - elec[0], h: 4, fill: drive ? C.rf : 'rgba(201,161,74,0.55)',
        ports: drive ? { rf: [elec[0], by] } : {} });
    }
  });
  const port = k => [elec[0], barY(k, feedSide[k])];
  paths.push(
    { id: 'rfXI', from: 'rf0.out', to: 'el0-1.rf', pts: [[26, 58], [40, 58], [40, port(0)[1]], port(0)], color: C.rf, width: 2 },
    { id: 'rfXQ', from: 'rf1.out', to: 'el11.rf', pts: [[26, 104], port(1)], color: C.rf, width: 2 },
    { id: 'rfYI', from: 'rf2.out', to: 'el2-1.rf', pts: [[26, 150], [40, 150], [40, 118], [220, 118], [220, port(2)[1]], port(2)], color: C.rf, width: 2 },
    { id: 'rfYQ', from: 'rf3.out', to: 'el31.rf', pts: [[26, 196], [60, 196], [60, port(3)[1]], port(3)], color: C.rf, width: 2 },
  );
  const texts = names.map((t, k) => ({ text: t, x: 330, y: rows[k], size: 11, color: 'rgba(98,230,255,0.95)' }));
  return { w, h, bg: BG, boxes, paths, texts, crossings: [['rfXQ', 'xbr'], ['rfYI', 'xbr'], ['rfYQ', 'trunk']] };
}
