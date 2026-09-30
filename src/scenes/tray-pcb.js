// Printed-circuit-board surface for the compute tray and the tray pulled out of
// the rack: solder mask with a glass-weave sheen, routed trace groups, via
// fields and stitching, copper pours, silkscreen outlines and reference
// designators, test points, plated mounting holes and an exposed laminate edge.
// Painted once per generation into a top-down atlas that spans the whole tray
// (4.4 x 9 units) and projected onto the Blender board meshes by position, so
// every board shows the part of the layout under it. Layout is representative
// (assumption 'tray-mechanical-detail'): it follows common server-board practice
// around the real device positions in tray.js, not a vendor's routing.
import * as THREE from 'three';

export const PCB_MATERIAL = 'Tray solder mask';
export const RACK_PCB_MATERIAL = 'Rack tray solder mask';
const SPAN = { x0: -2.2, z0: -4.5, w: 4.4, d: 9 };

let C = {
  mask: '#0d3a2b', maskHi: '#114434', pour: '#145139', trace: '#1d6849', traceOnPour: '#228058', clear: '#0a3024',
  tented: '#2b7a59', viaRing: '#b8bab4', hole: '#070908', silk: '#dfe6dc', gold: '#caa24c', tin: '#b9bcbd', lam: '#6a6446',
};
// surface map channels: R height (bump), G roughness, B metalness
const S = {
  mask: 'rgb(0,120,0)', pour: 'rgb(70,112,0)', trace: 'rgb(120,104,0)', clear: 'rgb(0,128,0)', tented: 'rgb(150,100,0)',
  metal: 'rgb(150,80,255)', hole: 'rgb(0,235,0)', silk: 'rgb(185,205,0)', lam: 'rgb(30,200,0)',
};

// ---------- layouts, in tray units (10 cm), front +z; positions mirror tray.js ----------
function nvlLayout(accel) {
  const L = base();
  for (const bx of [-1.1, 1.1]) {
    L.boards.push({ x: bx, z: -0.35, w: 2.0, d: 5.8 });
    const cz = 1.75;
    L.pkgs.push({ x: bx, z: cz, w: 0.62, d: 0.62, ref: bx < 0 ? 'U1' : 'U2', fan: 3 });
    for (const side of [-1, 1]) for (let i = 0; i < 4; i++) L.pkgs.push({ x: bx + side * 0.55, z: cz - 0.36 + i * 0.24, w: 0.16, d: 0.2, ref: `U${30 + i + (side > 0 ? 4 : 0)}`, fan: 1 });
    for (const [k, gz] of [0.2, -1.55].entries()) {
      L.pkgs.push({ x: bx, z: gz, w: 0.95, d: 0.95, ref: `U${3 + k + (bx > 0 ? 2 : 0)}`, fan: 4 });
      for (let i = 0; i < 8; i++) for (const sx of [-1, 1]) L.vrms.push({ x: bx + sx * 0.72, z: gz - 0.42 + i * 0.12, w: 0.1, d: 0.09 });
      for (let i = 0; i < 7; i++) L.vrms.push({ x: bx - 0.36 + i * 0.12, z: gz - 0.62, w: 0.1, d: 0.09 });
      L.pours.push({ x: bx - 0.72, z: gz, w: 0.2, d: 1.05 }, { x: bx + 0.72, z: gz, w: 0.2, d: 1.05 }, { x: bx, z: gz - 0.64, w: 0.9, d: 0.16 });
      L.conns.push({ x: bx, z: gz - 0.46, w: 0.84, d: 0.05, ref: `J${1 + k + (bx > 0 ? 2 : 0)}` });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) L.holes.push([bx + sx * 0.279, gz + sz * 0.279, 0.018]);
      // NVLink to the rear connectors: a side channel outboard of the VRM column
      const ch = bx + Math.sign(bx) * 0.87, rx = bx + Math.sign(bx) * 0.4;
      L.buses.push({ pts: [[rx - Math.sign(bx) * 0.1, gz - 0.5], [rx, gz - 0.56], [ch, gz - 0.56], [ch, -3.2]], pairs: 12 });
      // PCIe / C2C from the GPU's front edge
      L.buses.push({ pts: [[bx - 0.25, gz + 0.48], [bx - 0.25, gz + 0.62], [bx - 0.86 * Math.sign(bx), gz + 0.78]], pairs: 6 });
    }
    // C2C: Grace to the upper GPU (short and wide), and to the lower GPU along the inboard channel
    L.buses.push({ pts: [[bx + 0.1, 1.44], [bx + 0.1, 0.68]], pairs: 16 });
    const inb = bx - Math.sign(bx) * 0.87;
    L.buses.push({ pts: [[bx - Math.sign(bx) * 0.31, 1.6], [inb, 1.6], [inb, -1.2], [bx - Math.sign(bx) * 0.48, -1.35]], pairs: 10 });
    // Grace to the NIC side of the tray (PCIe to the mezzanine connectors)
    L.buses.push({ pts: [[bx + 0.15, 2.06], [bx + 0.15, 2.2], [bx + 0.45, 2.5]], pairs: 8 });
    for (const side of [-1, 1]) L.buses.push({ pts: [[bx + side * 0.31, cz], [bx + side * 0.47, cz]], pairs: 6 });
    // 12 V: the copper runs down the board sit on a pour
    L.pours.push({ x: bx + 0.08, z: -0.9, w: 0.34, d: 5.2 });
    for (const sx of [-1, 1]) for (const z of [-3.15, -1.0, 1.0, 2.45]) L.holes.push([bx + sx * 0.93, z, 0.02]);
    for (let i = 0; i < 10; i++) L.tps.push([bx + 0.93 * Math.sign(bx) - Math.sign(bx) * 0.03, -2.8 + i * 0.5]);
  }
  // NIC mezzanine boards and the front cage boards
  const ultra = accel === 'gb300';
  const mezz = ultra ? [[0.45, 0.92], [1.45, 0.92]] : [0.2, 0.7, 1.2, 1.7].map(x => [x, 0.42]);
  mezz.forEach(([x, w], i) => {
    L.boards.push({ x, z: 3.315, w, d: 0.93 });
    L.conns.push({ x, z: 2.9, w: w * 0.65, d: 0.06, ref: `J${10 + i}` });
    for (const sx of [-1, 1]) for (const z of [2.9, 3.73]) L.holes.push([x + sx * (w / 2 - 0.04), z, 0.014]);
  });
  for (const x of [0.2, 0.7, 1.2, 1.7]) {
    L.pkgs.push({ x, z: 3.3, w: 0.26, d: 0.26, ref: '', fan: 2, hidden: true });
    L.buses.push({ pts: [[x, 3.44], [x, 3.66]], pairs: 8 });
    L.buses.push({ pts: [[x - 0.05, 3.16], [x - 0.05, 2.96]], pairs: 8 });
    L.conns.push({ x, z: 3.93, w: 0.15, d: 0.075, ref: '' });
    L.buses.push({ pts: [[x, 3.97], [x, 4.4]], pairs: 8 });
  }
  const cage = ultra ? [[0.45, 0.92], [1.45, 0.92]] : [[0.95, 1.96]];
  for (const [x, w] of cage) {
    L.boards.push({ x, z: 4.165, w, d: 0.61 });
    for (const sx of [-1, 1]) for (const z of [3.92, 4.41]) L.holes.push([x + sx * (w / 2 - 0.04), z, 0.014]);
  }
  return L;
}
function h100Layout() {
  const L = base();
  L.boards.push({ x: 0, z: 1.3, w: 4.2, d: 5.0 });
  const gpuX = [-1.62, -0.54, 0.54, 1.62], gpuZ = [2.75, 1.05], swX = [-1.5, -0.5, 0.5, 1.5];
  gpuZ.forEach((z, r) => gpuX.forEach((x, c) => {
    L.pkgs.push({ x, z, w: 0.9, d: 1.4, ref: `SXM${r * 4 + c + 1}`, fan: 0 });
    L.buses.push({ pts: [[x + 0.15, z - 0.72], [x + 0.15, -0.0], [swX[c] + 0.1, -0.02]], pairs: 12 });
    L.buses.push({ pts: [[x - 0.15, z - 0.72], [x - 0.15, -0.72], [x - 0.3, -0.85], [x - 0.3, -1.15]], pairs: 8 });
  }));
  swX.forEach((x, i) => { L.pkgs.push({ x, z: -0.25, w: 0.42, d: 0.42, ref: `U${60 + i}`, fan: 3 }); L.pours.push({ x, z: -0.95, w: 0.4, d: 0.36 }); });
  for (let i = 0; i < 8; i++) L.vrms.push({ x: -1.75 + i * 0.5, z: -0.95, w: 0.3, d: 0.3 });
  for (const sx of [-1, 1]) for (const z of [-1.1, 0.35, 1.9, 3.7]) L.holes.push([sx * 2.03, z, 0.022]);
  for (let i = 0; i < 14; i++) L.tps.push([-1.95 + i * 0.3, 0.3]);
  // CPU tray board, NIC cards and the rear cage boards (upper deck)
  L.boards.push({ x: 0, z: -2.775, w: 4.2, d: 2.95 });
  for (const x of [-1.0, 1.0]) {
    L.pkgs.push({ x, z: -2.2, w: 0.62, d: 0.75, ref: x < 0 ? 'CPU1' : 'CPU2', fan: 3 });
    for (const s of [-1, 1]) L.buses.push({ pts: [[x + s * 0.31, -2.2], [x + s * 0.4, -2.2]], pairs: 16, pitch: 0.012 });
    L.buses.push({ pts: [[x, -1.82], [x, -1.62], [x * 0.55, -1.55]], pairs: 8 });
  }
  for (const x of [-1.6, -0.55, 0.55, 1.6]) L.pkgs.push({ x, z: -1.55, w: 0.3, d: 0.3, ref: 'U', fan: 2 });
  for (const x of [-1.65, -1.05, 1.05, 1.65]) {
    L.boards.push({ x, z: -3.3, w: 0.4, d: 0.9 });
    for (const z of [-3.05, -3.5]) L.pkgs.push({ x, z, w: 0.28, d: 0.31, ref: '', fan: 2, hidden: true });
    L.buses.push({ pts: [[x, -2.9], [x, -2.7]], pairs: 8 });
  }
  for (const x of [-1.35, 1.35]) L.boards.push({ x, z: -4.17, w: 0.95, d: 0.62 });
  for (const sx of [-1, 1]) for (const z of [-4.1, -2.9, -1.45]) L.holes.push([sx * 2.03, z, 0.02]);
  return L;
}
function rubinLayout() {
  const L = base();
  const gp = [[-1.6, -2.7], [-0.62, -2.7], [0.62, -2.7], [1.6, -2.7]], cp = [[-1.1, -0.65], [1.1, -0.65]];
  for (const x of [-1.1, 1.1]) L.boards.push({ x, z: -1.52, w: 2.02, d: 4.9 });
  gp.forEach(([x, z], i) => {
    L.pkgs.push({ x, z, w: 0.83, d: 0.95, ref: `U${i + 1}`, fan: 4 });
    for (let k = 0; k < 7; k++) for (const s of [-1, 1]) L.vrms.push({ x: x - 0.36 + k * 0.12, z: z + s * 0.66, w: 0.1, d: 0.09 });
    L.buses.push({ pts: [[x + 0.2, z - 0.5], [x + 0.2, -3.9]], pairs: 10 });
  });
  cp.forEach(([x, z], i) => {
    L.pkgs.push({ x, z, w: 0.75, d: 0.77, ref: `U${10 + i}`, fan: 3 });
    for (let k = 0; k < 5; k++) for (const s of [-1, 1]) L.vrms.push({ x: x - 0.24 + k * 0.12, z: z + s * 0.52, w: 0.1, d: 0.09 });
    for (const s of [-1, 1]) L.buses.push({ pts: [[x + s * 0.3, z - 0.4], [x + s * 0.5, -2.1]], pairs: 10 });
    L.buses.push({ pts: [[x, z + 0.4], [x, 0.9]], pairs: 12 });
    for (const s of [-1, 1]) L.boards.push({ x: x + s * 0.64, z, w: 0.3, d: 1.05, module: true });
  });
  for (const [x, z] of [[-1.35, 2.85], [1.35, 2.85]]) {
    L.boards.push({ x, z, w: 1.35, d: 2.15 });
    for (const dx of [-0.3, 0.3]) for (const dz of [-0.47, 0.47]) L.pkgs.push({ x: x + dx, z: z + dz, w: 0.4, d: 0.52, ref: '', fan: 2 });
  }
  L.boards.push({ x: 0, z: 2.85, w: 0.85, d: 2.15 });
  L.pkgs.push({ x: 0, z: 2.85, w: 0.66, d: 0.75, ref: 'U20', fan: 3 });
  for (const sx of [-1, 1]) for (const z of [-3.8, -2.0, -0.2, 0.8]) L.holes.push([sx * 1.1 + sx * 0.95, z, 0.02]);
  return L;
}
function base() { return { boards: [], pkgs: [], vrms: [], pours: [], buses: [], holes: [], tps: [], conns: [] }; }
export function pcbLayout(accel) { return accel === 'h100' ? h100Layout() : accel === 'rubin' ? rubinLayout() : nvlLayout(accel); }

// ---------- painter ----------
function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; }
const cache = new Map();
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

export function paintPcb(accel, { W = 2048, lod = 'tray' } = {}) {
  const key = `${accel}|${W}|${lod}`;
  if (cache.has(key)) return cache.get(key);
  const H = W * 2, col = makeCanvas(W, H), surf = makeCanvas(W / 2, H / 2);
  const layers = [[col.getContext('2d'), W / SPAN.w, 'c'], [surf.getContext('2d'), W / 2 / SPAN.w, 's']];
  const sz = H / SPAN.d / (W / SPAN.w);            // z stretch relative to x (≈1)
  const each = (cs, ss, fn) => { for (const [g, k, t] of layers) { g.setTransform(k, 0, 0, k * sz, -SPAN.x0 * k, -SPAN.z0 * k * sz); fn(g, t === 'c' ? cs : ss, t); } };
  const rect = (x, z, w, d, cs, ss) => each(cs, ss, (g, st) => { g.fillStyle = st; g.fillRect(x - w / 2, z - d / 2, w, d); });
  const stroke = (pts, width, cs, ss) => each(cs, ss, (g, st) => { g.strokeStyle = st; g.lineWidth = width; g.lineJoin = 'round'; g.lineCap = 'round'; g.beginPath(); pts.forEach(([x, z], i) => i ? g.lineTo(x, z) : g.moveTo(x, z)); g.stroke(); });
  const disc = (x, z, r, cs, ss) => each(cs, ss, (g, st) => { g.fillStyle = st; g.beginPath(); g.arc(x, z, r, 0, Math.PI * 2); g.fill(); });
  const rack = lod === 'rack', rnd = rng(accel.length * 7919 + (rack ? 3 : 0));
  if (rack) C.silk = '#9fb0a2';                                 // at rack distance a full-white silk line reads as a glare stripe
  else C.silk = '#dfe6dc';
  const L = pcbLayout(accel);
  const px = SPAN.w / W;                            // one color pixel in tray units
  const text = (x, z, str, h) => {                  // silkscreen text, in color and surface
    if (rack || !str) return;
    for (const [g, k, t] of layers) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = t === 'c' ? C.silk : S.silk; g.font = `600 ${Math.max(4, h * k)}px monospace`; g.textBaseline = 'middle';
      g.fillText(str, (x - SPAN.x0) * k, (z - SPAN.z0) * k * sz);
    }
  };
  // occupancy (cell 0.04) so the fill does not paint over the planned parts
  const cell = 0.04, occ = new Set(), mark = (x, z, w, d, pad = 0.02) => {
    for (let i = Math.floor((x - w / 2 - pad) / cell); i <= Math.floor((x + w / 2 + pad) / cell); i++)
      for (let j = Math.floor((z - d / 2 - pad) / cell); j <= Math.floor((z + d / 2 + pad) / cell); j++) occ.add(`${i},${j}`);
  };
  const free = (x, z, w, d) => { for (let i = Math.floor((x - w / 2) / cell); i <= Math.floor((x + w / 2) / cell); i++) for (let j = Math.floor((z - d / 2) / cell); j <= Math.floor((z + d / 2) / cell); j++) if (occ.has(`${i},${j}`)) return false; return true; };
  const inBoard = (x, z, m = 0.04) => L.boards.some(b => Math.abs(x - b.x) < b.w / 2 - m && Math.abs(z - b.z) < b.d / 2 - m);

  // background outside boards (never seen) and each board, in order (upper decks paint last)
  rect(0, 0, SPAN.w, SPAN.d, C.mask, S.mask);
  for (const b of L.boards) {
    rect(b.x, b.z, b.w, b.d, C.lam, S.lam);                                   // exposed laminate at the chamfered edge
    const e = Math.max(px * 2.2, 0.0035);
    rect(b.x, b.z, b.w - 2 * e, b.d - 2 * e, C.mask, S.mask);
    // faint mask thickness variation
    if (!rack) for (let k = 0; k < b.w * b.d * 40; k++) { const x = b.x + (rnd() - 0.5) * b.w, z = b.z + (rnd() - 0.5) * b.d, r = 0.02 + rnd() * 0.06; disc(x, z, r, rnd() < 0.5 ? 'rgba(20,78,58,0.10)' : 'rgba(4,30,22,0.12)', 'rgba(0,120,0,0)'); }
    // edge stitching vias, 1.5 mm pitch, 1.2 mm in from the edge
    const st = rack ? 0.05 : 0.016, inset = e + 0.012;
    for (const s of [-1, 1]) {
      for (let x = b.x - b.w / 2 + inset; x < b.x + b.w / 2 - inset; x += st) { via(x, b.z + s * (b.d / 2 - inset), 0.0035, true); }
      for (let z = b.z - b.d / 2 + inset; z < b.z + b.d / 2 - inset; z += st) { via(b.x + s * (b.w / 2 - inset), z, 0.0035, true); }
    }
    // silkscreen board outline corners (fab marks)
    for (const sx of [-1, 1]) for (const sz2 of [-1, 1]) {
      const cx = b.x + sx * (b.w / 2 - inset - 0.012), cz = b.z + sz2 * (b.d / 2 - inset - 0.012);
      stroke([[cx - sx * 0.05, cz], [cx, cz], [cx, cz - sz2 * 0.05]], rack ? 0.006 : 0.0025, C.silk, S.silk);
    }
    if (b.module) text(b.x - b.w * 0.3, b.z - b.d * 0.42, 'M1', 0.018);
  }
  function via(x, z, r, tented) {
    if (tented) { disc(x, z, r * 1.25, C.tented, S.tented); if (!rack) disc(x, z, r * 0.45, C.clear, S.pour); }
    else { disc(x, z, r * 1.3, C.viaRing, S.metal); disc(x, z, r * 0.55, C.hole, S.hole); }
  }
  // copper pours under power parts, with thermal via arrays
  for (const p of L.pours) {
    rect(p.x, p.z, p.w, p.d, C.pour, S.pour);
    const pitch = rack ? 0.045 : 0.02;
    for (let x = p.x - p.w / 2 + pitch / 2; x < p.x + p.w / 2; x += pitch) for (let z = p.z - p.d / 2 + pitch / 2; z < p.z + p.d / 2; z += pitch) if (rnd() < 0.55) via(x, z, 0.0032, true);
    mark(p.x, p.z, p.w, p.d, 0);
  }
  // routed buses: differential pairs with a clearance channel, via transitions at the ends
  for (const bus of L.buses) {
    const n = bus.pairs, pp = bus.pitch ?? 0.0105, inner = 0.0032, tw = rack ? 0.004 : 0.0016;
    const width = n * pp;
    const off = (pts, o) => pts.map(([x, z], i) => {           // offset a polyline sideways (miter-free, fine for 45/90 degree bends)
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      return [x - dz * o, z + dx * o];
    });
    stroke(bus.pts, width + 0.006, C.clear, S.clear);
    if (rack) { stroke(bus.pts, width * 0.9, '#155a40', S.trace); }
    else for (let k = 0; k < n; k++) {
      const o = -width / 2 + (k + 0.5) * pp;
      for (const s of [-1, 1]) stroke(off(bus.pts, o + s * inner / 2), tw, C.trace, S.trace);
    }
    for (const [i, end] of [[0, bus.pts[0]], [1, bus.pts.at(-1)]]) {
      const nb = bus.pts[i ? bus.pts.length - 2 : 1];
      let dx = end[0] - nb[0], dz = end[1] - nb[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      for (let k = 0; k < n; k++) { const o = -width / 2 + (k + 0.5) * pp; for (const s of [-1, 1]) via(end[0] - dz * (o + s * inner / 2) + dx * 0.01, end[1] + dx * (o + s * inner / 2) + dz * 0.01, 0.0022, true); }
    }
    for (let i = 1; i < bus.pts.length; i++) { const [a, b] = [bus.pts[i - 1], bus.pts[i]]; mark((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.abs(a[0] - b[0]) + width, Math.abs(a[1] - b[1]) + width); }
  }
  // package footprints: silkscreen outline and courtyard, pin-1 mark, breakout via ring, decoupling pads
  for (const p of L.pkgs) {
    const m = 0.03;
    if (p.fan) {
      const ring = p.fan, pitch = rack ? 0.03 : 0.0125;
      for (let r = 0; r < ring; r++) {
        const w = p.w / 2 + 0.012 + r * pitch, d = p.d / 2 + 0.012 + r * pitch;
        for (let x = -w; x <= w; x += pitch) for (const s of [-1, 1]) if (rnd() < 0.8) via(p.x + x, p.z + s * d, 0.0024, r % 2 === 1);
        for (let z = -d + pitch; z < d; z += pitch) for (const s of [-1, 1]) if (rnd() < 0.8) via(p.x + s * w, p.z + z, 0.0024, r % 2 === 1);
      }
    }
    const ow = p.w / 2 + m + (p.fan || 0) * 0.0125, od = p.d / 2 + m + (p.fan || 0) * 0.0125;
    if (!p.hidden) {
      stroke([[p.x - ow, p.z - od], [p.x + ow, p.z - od], [p.x + ow, p.z + od], [p.x - ow, p.z + od], [p.x - ow, p.z - od]], rack ? 0.005 : 0.0022, C.silk, S.silk);
      disc(p.x - ow + 0.018, p.z - od + 0.018, 0.006, C.silk, S.silk);
      text(p.x - ow, p.z - od - 0.022, p.ref, p.w > 0.4 ? 0.028 : 0.016);
    }
    mark(p.x, p.z, ow * 2, od * 2, 0.01);
  }
  // VRM phases: two large pads per inductor, a power-stage pad beside it, outline and designator
  L.vrms.forEach((v, i) => {
    for (const s of [-1, 1]) rect(v.x + s * v.w * 0.3, v.z, v.w * 0.32, v.d * 0.8, C.tin, S.metal);
    stroke([[v.x - v.w / 2 - 0.006, v.z - v.d / 2 - 0.006], [v.x + v.w / 2 + 0.006, v.z - v.d / 2 - 0.006], [v.x + v.w / 2 + 0.006, v.z + v.d / 2 + 0.006], [v.x - v.w / 2 - 0.006, v.z + v.d / 2 + 0.006], [v.x - v.w / 2 - 0.006, v.z - v.d / 2 - 0.006]], rack ? 0.004 : 0.0018, C.silk, S.silk);
    if (i % 2 === 0) text(v.x - v.w / 2, v.z + v.d / 2 + 0.014, `L${i + 1}`, 0.012);
    mark(v.x, v.z, v.w, v.d, 0.01);
  });
  // connectors: pad rows, outline, designator
  for (const c of L.conns) {
    const n = Math.max(6, Math.round(c.w / 0.02));
    for (let k = 0; k < n; k++) for (const s of [-1, 1]) rect(c.x - c.w / 2 + (k + 0.5) * c.w / n, c.z + s * c.d * 0.28, c.w / n * 0.5, c.d * 0.3, C.gold, S.metal);
    stroke([[c.x - c.w / 2 - 0.01, c.z - c.d / 2 - 0.01], [c.x + c.w / 2 + 0.01, c.z - c.d / 2 - 0.01], [c.x + c.w / 2 + 0.01, c.z + c.d / 2 + 0.01], [c.x - c.w / 2 - 0.01, c.z + c.d / 2 + 0.01], [c.x - c.w / 2 - 0.01, c.z - c.d / 2 - 0.01]], rack ? 0.004 : 0.0018, C.silk, S.silk);
    text(c.x + c.w / 2 + 0.016, c.z, c.ref, 0.014);
    mark(c.x, c.z, c.w, c.d, 0.02);
  }
  // plated mounting holes with a keep-out ring, and gold test points with designators
  for (const [x, z, r] of L.holes) {
    disc(x, z, r * 2.1, C.clear, S.clear);
    disc(x, z, r * 1.55, C.tin, S.metal);
    disc(x, z, r, C.hole, S.hole);
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; via(x + Math.cos(a) * r * 1.3, z + Math.sin(a) * r * 1.3, 0.0022, false); }
    mark(x, z, r * 4, r * 4, 0);
  }
  L.tps.forEach(([x, z], i) => { disc(x, z, 0.007, C.gold, S.metal); text(x + 0.012, z, `TP${i + 1}`, 0.011); mark(x, z, 0.03, 0.03, 0); });
  // fill: short routed groups, via pairs and small pad sets in the free board area
  for (const b of L.boards) {
    const n = Math.round(b.w * b.d * (rack ? 30 : 60));
    for (let k = 0; k < n; k++) {
      const x = b.x + (rnd() - 0.5) * (b.w - 0.12), z = b.z + (rnd() - 0.5) * (b.d - 0.12), kind = rnd();
      if (kind < 0.45) {                                                           // a short bus with a 45-degree jog
        const len = 0.08 + rnd() * 0.25, horiz = rnd() < 0.5, jog = (rnd() - 0.5) * 0.12, pairs = 2 + Math.floor(rnd() * 5);
        const pts = horiz ? [[x, z], [x + len * 0.5, z], [x + len * 0.5 + Math.abs(jog), z + jog], [x + len + Math.abs(jog), z + jog]]
          : [[x, z], [x, z + len * 0.5], [x + jog, z + len * 0.5 + Math.abs(jog)], [x + jog, z + len + Math.abs(jog)]];
        const bx = pts.map(p => p[0]), bz = pts.map(p => p[1]);
        const cx = (Math.min(...bx) + Math.max(...bx)) / 2, cz = (Math.min(...bz) + Math.max(...bz)) / 2, w = Math.max(...bx) - Math.min(...bx) + pairs * 0.01, d = Math.max(...bz) - Math.min(...bz) + pairs * 0.01;
        if (!free(cx, cz, w, d) || !inBoard(cx - w / 2, cz - d / 2) || !inBoard(cx + w / 2, cz + d / 2)) continue;
        const tw = rack ? 0.004 : 0.0016;
        for (let p = 0; p < pairs; p++) {
          const o = (p - (pairs - 1) / 2) * 0.0105;
          for (const s of [-1, 1]) stroke(pts.map(([px2, pz2]) => horiz ? [px2, pz2 + o + s * 0.0016] : [px2 + o + s * 0.0016, pz2]), tw, C.trace, S.trace);
        }
        for (const e of [pts[0], pts.at(-1)]) for (let p = 0; p < pairs; p++) { const o = (p - (pairs - 1) / 2) * 0.0105; via(horiz ? e[0] : e[0] + o, horiz ? e[1] + o : e[1], 0.0022, true); }
        mark(cx, cz, w, d, 0.01);
      } else if (kind < 0.7) {                                                     // a via field
        const w = 0.04 + rnd() * 0.08, d = 0.04 + rnd() * 0.08;
        if (!free(x, z, w, d) || !inBoard(x, z)) continue;
        for (let i = -w / 2; i <= w / 2; i += 0.0125) for (let j = -d / 2; j <= d / 2; j += 0.0125) via(x + i, z + j, 0.0024, rnd() < 0.8);
        mark(x, z, w, d, 0.01);
      } else if (!rack) {                                                          // a small part footprint: pads, outline, designator
        const w = 0.03 + rnd() * 0.05, d = 0.03 + rnd() * 0.05;
        if (!free(x, z, w, d) || !inBoard(x, z)) continue;
        const pins = 3 + Math.floor(rnd() * 5);
        for (let i = 0; i < pins; i++) for (const s of [-1, 1]) rect(x - w / 2 + (i + 0.5) * w / pins, z + s * d * 0.42, w / pins * 0.45, d * 0.14, C.tin, S.metal);
        stroke([[x - w / 2, z - d / 2], [x + w / 2, z - d / 2], [x + w / 2, z + d / 2], [x - w / 2, z + d / 2], [x - w / 2, z - d / 2]], 0.0016, C.silk, S.silk);
        text(x - w / 2, z - d / 2 - 0.012, `${'RCUQ'[Math.floor(rnd() * 4)]}${100 + Math.floor(rnd() * 800)}`, 0.011);
        mark(x, z, w, d, 0.01);
      }
    }
  }
  cache.set(key, { col, surf });
  return cache.get(key);
}

// ---------- material ----------
function textures(accel, W, lod) {
  const { col, surf } = paintPcb(accel, { W, lod });
  const map = new THREE.CanvasTexture(col), data = new THREE.CanvasTexture(surf);
  map.colorSpace = THREE.SRGBColorSpace;
  for (const t of [map, data]) { t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.flipY = false; }
  return { map, data };
}
export function pcbMaterial(accel, { mobile = false, lod = 'tray' } = {}) {
  const rack = lod === 'rack', { map, data } = textures(accel, rack || mobile ? 1024 : 2048, lod);
  const opts = { map, roughnessMap: data, metalnessMap: data, bumpMap: data, bumpScale: rack ? 0.6 : 1.4, roughness: 1, metalness: 1, envMapIntensity: 0.55 };
  const m = rack || mobile ? new THREE.MeshStandardMaterial(opts)
    : new THREE.MeshPhysicalMaterial({ ...opts, clearcoat: 0.45, clearcoatRoughness: 0.32 });
  m.name = rack ? RACK_PCB_MATERIAL : PCB_MATERIAL;
  if (!rack) {
    // Glass-cloth weave under the translucent mask: a faint woven modulation of
    // color and roughness in world space, faded out before it can alias.
    m.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vIfxWorld;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvIfxWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vIfxWorld;
float ifxWeave(vec2 q) {
  vec2 p = q / 0.0065; vec2 f = fract(p); float warp = mod(floor(p.x) + floor(p.y), 2.0);
  float w = mix(sin(3.14159 * f.y), sin(3.14159 * f.x), warp);
  float fade = 1.0 - smoothstep(0.2, 0.55, max(fwidth(p.x), fwidth(p.y)));
  return (w - 0.5) * fade;
}`)
        .replace('#include <map_fragment>', '#include <map_fragment>\nfloat ifxW = ifxWeave(vIfxWorld.xz);\ndiffuseColor.rgb *= 1.0 + ifxW * 0.16;')
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor - ifxW * 0.12, 0.05, 1.0);');
    };
    m.customProgramCacheKey = () => 'ifx-pcb-weave';
  }
  return m;
}

// Project the atlas onto every board mesh of the loaded hardware by position.
// Tray: scene units are tray units. Rack: each pulled-tray board maps into the
// matching tray board through `rects` ([rack box] -> [tray box]).
export function applyPcb(root, accel, { mobile = false, lod = 'tray', rects = null } = {}) {
  const want = lod === 'rack' ? RACK_PCB_MATERIAL : PCB_MATERIAL;
  const targets = [];
  root.updateMatrixWorld(true);
  root.traverse(o => { if (o.isMesh && !Array.isArray(o.material) && o.material.name.replace(/\.\d+$/, '') === want) targets.push(o); });
  if (!targets.length) return 0;
  const material = pcbMaterial(accel, { mobile, lod }), v = new THREE.Vector3();
  for (const mesh of targets) {
    const pos = mesh.geometry.attributes.position, uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      let x = v.x, z = v.z;
      if (rects) {
        const r = rects.find(r => x >= r.from[0] - 0.01 && x <= r.from[1] + 0.01 && z >= r.from[2] - 0.01 && z <= r.from[3] + 0.01 && (r.y == null || Math.abs(v.y - r.y) < 0.03)) || rects[0];
        x = r.to[0] + (x - r.from[0]) / (r.from[1] - r.from[0]) * (r.to[1] - r.to[0]);
        z = r.to[2] + (z - r.from[2]) / (r.from[3] - r.from[2]) * (r.to[3] - r.to[2]);
      }
      uv[i * 2] = (x - SPAN.x0) / SPAN.w; uv[i * 2 + 1] = (z - SPAN.z0) / SPAN.d;
    }
    mesh.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    mesh.material.dispose?.();
    mesh.material = material;
  }
  return targets.length;
}
