// Routes for the NVL72 rack's out-of-band management leads, as plain numbers (no THREE, so tests can check them).
//
// Sourced: NVIDIA's GB200 SuperPOD reference architecture puts the management ports of every compute tray and
// switch tray on the out-of-band network, built from SN2201 switches; the SN2201's ports are 48 RJ45 at 1 GbE
// (nvidia-superpod-gb200-network-fabrics, nvidia-sn2201-specs). So each tray gets one copper RJ45 lead back to the
// management switch at the top of the rack.
// Representative (ASSUMPTIONS 'mgmt-tray-leads'): which switch port feeds which tray, one lead per tray, the jack's
// place on each tray face, the jacket color, and the dressing: up from the top switch into the brush-strip cable
// manager above it, out at its right end, then down a combed harness inside the right-hand rack post, where each
// lead peels off at its tray. The two trays pulled out for inspection are drawn unplugged.
//
// Units are meters, in rack.js's NVL72 frame: front faces +z, tray faces at z = 0.465, trayY(i) as there.

export const U = 0.04445;
export const trayY = i => 0.12 + i * U + U / 2;
export const FACE_Z = 0.465;
export const LEAD_R = 0.0022;               // ≈4.4 mm jacket: thin-gauge patch cord
export const SWITCH_ROW = 36, BRUSH_ROW = 37;
const PULLED = [25, 16];                    // rack.js PULLED and SWITCH_PULLED

// rack.js layout (nvl72-layout.js): ps 0-3, compute 4-11, switch 12-20, compute 21-30, ps 31-34, mgmt 35-36
const kindOf = row => (row >= 12 && row <= 20 ? 'switch' : 'compute');
export const MGMT_ROWS = [...Array(27)].map((_, k) => 30 - k).filter(r => r >= 4 && !PULLED.includes(r));

// SN2201 face as rack.js mgmtFace() paints it: four blocks of six RJ45 columns, two rows, on a 0.44 m face drawn as a
// 1024 px texture. rack.js already patches lower-row ports 2, 5, 9, 16 and 21 to the side manager.
const portX = c => -0.22 + (140 + Math.floor(c / 6) * 170 + (c % 6) * 26 + 11) / 1024 * 0.44;
function port(k) {
  const y = trayY(SWITCH_ROW);
  return k < 24 ? { c: k, row: 'upper', x: portX(k), y: y + 0.0083, rise: 0.5, dy: 0 } : { c: 0, row: 'lower', x: portX(0), y: y - 0.0085, rise: 0.512, dy: 0.007 };
}

// Where each tray's jack sits: clear of the scale-out and storage cages that rack-optics.js draws on the same face.
export function jackOf(row, accel) {
  const y = trayY(row);
  if (kindOf(row) === 'switch') return { x: 0.127, y, z: FACE_Z };
  return accel === 'rubin' ? { x: 0.135, y: y - 0.004, z: FACE_Z } : { x: 0.127, y: y + 0.0025, z: FACE_Z };
}

export function planMgmtLeads(accel) {
  const y35 = trayY(BRUSH_ROW), plugEnd = FACE_Z + 0.029;
  return MGMT_ROWS.map((row, k) => {
    const col = Math.floor(k / 9), d = k % 9;
    const xs = 0.228 + col * 0.0055, zs = 0.526 + d * 0.0048;       // harness slot: three columns, nine deep
    const ye = y35 - 0.005 + col * 0.005, xe = 0.1785 - d * 0.005;  // where it leaves the brush strip
    const p = port(k), j = jackOf(row, accel);
    // switch end: plug, rise to the brush strip, run inside it (hidden), out of its right end
    const yb = y35 + p.dy, lean = p.rise - 0.5;   // the lower-row lead runs a few millimetres proud of the upper-row plugs
    const up = [[p.x, p.y, plugEnd], [p.x, p.y + 0.004, p.rise], [p.x, yb - 0.013, 0.488 + lean], [p.x, yb - 0.005, 0.475], [p.x, yb, 0.466], [xe, ye, 0.466]];
    // harness: forward to its slot depth, across to its column, down to its tray, across to the jack, into it
    const down = [[xe, ye, 0.466], [xe, ye, zs], [xs, ye, zs], [xs, j.y, zs], [j.x, j.y, zs], [j.x, j.y, plugEnd]];
    return { row, kind: kindOf(row), port: p, jack: j, slot: { col, d, x: xs, z: zs }, up, down };
  });
}

// shortest distance between two segments (for the clearance test)
export function segDist(p1, q1, p2, q2) {
  const sub = (a, b) => a.map((v, i) => v - b[i]), dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
  const d1 = sub(q1, p1), d2 = sub(q2, p2), r = sub(p1, p2);
  const a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r);
  let s, t;
  if (a < 1e-12 && e < 1e-12) return Math.sqrt(dot(r, r));
  if (a < 1e-12) { s = 0; t = Math.min(1, Math.max(0, f / e)); }
  else {
    const c = dot(d1, r);
    if (e < 1e-12) { t = 0; s = Math.min(1, Math.max(0, -c / a)); }
    else {
      const b = dot(d1, d2), den = a * e - b * b;
      s = den > 1e-12 ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -c / a)); } else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (b - c) / a)); }
    }
  }
  const c1 = p1.map((v, i) => v + d1[i] * s), c2 = p2.map((v, i) => v + d2[i] * t), w = sub(c1, c2);
  return Math.sqrt(dot(w, w));
}
