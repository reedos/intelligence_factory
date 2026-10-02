// Printed-circuit-board surface for the compute tray and the tray pulled out of
// the rack: solder mask with a glass-weave sheen, routed trace groups, via
// fields and stitching, copper pours, silkscreen outlines and reference
// designators, test points, plated mounting holes and an exposed laminate edge.
// Painted once per generation into a top-down atlas that spans the whole tray
// (4.4 x 9 units) and projected onto the Blender board meshes by position, so
// every board shows the part of the layout under it. Layout is representative
// (assumption 'tray-mechanical-detail'): it follows common server-board practice
// around the real device positions in tray.js, not a vendor's routing.
// Routing keeps the design rules a real board would (pcb-check.js, tray-pcb.test.ts):
// buses leave a package on an inner layer, drawn dim, under its decoupling rows and
// regulator ring, and come up to the top layer through a via row where the channel is
// clear; nothing runs through a hole, pad, package or a part tray.js models on the
// board, nothing crosses on its own layer, and everything keeps a 3 px clearance.
import * as THREE from 'three';
import { Clearance, segsOf, pointSeg } from './pcb-check.js';

export const PCB_MATERIAL = 'Tray solder mask';
export const RACK_PCB_MATERIAL = 'Rack tray solder mask';
const SPAN0 = { x0: -2.2, z0: -4.5, w: 4.4, d: 9 };
// DGX H100 paints two decks side by side (h100Layout), so its atlas is twice as wide.
export const spanOf = accel => accel === 'h100' ? { ...SPAN0, w: 8.8 } : SPAN0;

let C = {
  mask: '#0d3a2b', maskHi: '#114434', pour: '#145139', trace: '#1d6849', traceOnPour: '#228058', clear: '#0a3024',
  traceIn: '#165a3f', tented: '#2b7a59', viaRing: '#b8bab4', hole: '#070908', silk: '#dfe6dc', gold: '#caa24c', tin: '#b9bcbd', lam: '#6a6446',
};
// surface map channels: R height (bump), G roughness, B metalness
const S = {
  mask: 'rgb(0,120,0)', pour: 'rgb(70,112,0)', trace: 'rgb(120,104,0)', traceIn: 'rgb(20,116,0)', clear: 'rgb(0,128,0)', tented: 'rgb(150,100,0)',
  metal: 'rgb(150,80,255)', hole: 'rgb(0,235,0)', silk: 'rgb(185,205,0)', lam: 'rgb(30,200,0)',
};

// ---------- layouts, in tray units (10 cm), front +z; positions mirror tray.js ----------
// Keep-outs for the parts tray.js models in 3D on the board surface (passive rows, power stages, regulators,
// copper bars, DIMM slots): no top-layer copper runs under them. smdRow extents: a 0402 is 1 x 0.5 mm.
function smdRowPart(L, [x0, z0], [x1, z1], alongZ, id) {
  const hx = alongZ ? 0.0026 : 0.005, hz = alongZ ? 0.005 : 0.0026;
  L.parts.push({ id, kind: 'passive row', x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: Math.abs(x1 - x0) + 2 * hx, d: Math.abs(z1 - z0) + 2 * hz });
}
function smdFramePart(L, x, z, w, d, g, id) {
  for (const s of [-1, 1]) {
    smdRowPart(L, [x - w / 2, z + s * (d / 2 + g)], [x + w / 2, z + s * (d / 2 + g)], true, id);
    smdRowPart(L, [x + s * (w / 2 + g), z - d / 2], [x + s * (w / 2 + g), z + d / 2], false, id);
  }
}
const part = (L, id, x, z, w, d, more = {}) => L.parts.push({ id, kind: 'part', x, z, w, d, ...more });

function nvlLayout(accel) {
  const L = base();
  for (const bx of [-1.1, 1.1]) {
    const s = Math.sign(bx), X = u => bx + s * u, side = bx < 0 ? 'left' : 'right';
    L.boards.push({ x: bx, z: -0.35, w: 2.0, d: 5.8 });
    const cz = 1.75;
    // Grace with its decoupling frame (tray.js smdFrame .58, gap .05) and LPDDR5X either side
    L.pkgs.push({ x: bx, z: cz, w: 0.62, d: 0.62, ref: bx < 0 ? 'U1' : 'U2', fan: 1, m: 0.005 });
    smdFramePart(L, bx, cz, 0.58, 0.58, 0.05, `Grace ${side} decoupling`);
    for (const sd of [-1, 1]) for (let i = 0; i < 4; i++) {
      const lz = cz - 0.36 + i * 0.24;
      L.pkgs.push({ x: bx + sd * 0.55, z: lz, w: 0.16, d: 0.2, ref: `U${30 + i + (sd > 0 ? 4 : 0)}`, fan: 0, m: 0.008 });
      smdRowPart(L, [bx + sd * 0.655, lz - 0.04], [bx + sd * 0.655, lz + 0.04], false, `LPDDR bypass ${side}`);
      // memory channel: Grace's edge to each package, on an inner layer under the decoupling row
      const mz = Math.max(cz - 0.3, Math.min(cz + 0.3, lz));
      L.buses.push({ id: `LPDDR ${side} ${sd}${i}`, pts: [[bx + sd * 0.3, mz], [bx + sd * 0.5, mz]], pairs: 4, layer: 'in' });
    }
    for (const [k, gz] of [0.2, -1.55].entries()) {
      const g = `GPU ${side} ${k ? 'rear' : 'front'}`;
      L.pkgs.push({ x: bx, z: gz, w: 0.95, d: 0.95, ref: `U${3 + k + (bx > 0 ? 2 : 0)}`, fan: 1, m: 0.005 });
      // VRM ring: inductors with their power stages (tray.js), the controller, a ring of caps and the decoupling rows
      const ring = [];
      for (let i = 0; i < 8; i++) for (const sx of [-1, 1]) ring.push([bx + sx * 0.72, gz - 0.42 + i * 0.12, -sx * 0.1, 0]);
      for (let i = 0; i < 7; i++) if (i !== 3) ring.push([bx - 0.36 + i * 0.12, gz - 0.62, 0, 0.1]);   // a channel on the centerline for NVLink
      for (const [x, z, dx, dz] of ring) {                      // power stage beside each inductor, toward the package
        L.vrms.push({ x, z, w: 0.1, d: 0.09 });
        part(L, `${g} power stage`, x + dx, z + dz, 0.06, 0.06, { land: true });
      }
      part(L, `${g} controller`, bx + 0.6, gz - 0.62, 0.08, 0.08, { land: true });
      for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; if (Math.sin(a) < 0 && Math.abs(Math.cos(a)) * 0.56 < 0.08) continue; part(L, `${g} cap ring`, bx + Math.cos(a) * 0.56, gz + Math.sin(a) * 0.56, 0.02, 0.02); }
      for (const [gg] of [[0.03], [0.05]]) {
        smdRowPart(L, [bx - 0.46, gz + 0.475 + gg], [bx + 0.46, gz + 0.475 + gg], true, `${g} decoupling`);
        for (const sx of [-1, 1]) smdRowPart(L, [bx + sx * (0.475 + gg), gz - 0.44], [bx + sx * (0.475 + gg), gz + 0.46], false, `${g} decoupling`);
      }
      for (let i = 0; i < 8; i++) for (const sx of [-1, 1]) smdRowPart(L, [bx + sx * 0.565, gz - 0.44 + i * 0.12], [bx + sx * 0.565, gz - 0.4 + i * 0.12], false, `${g} bypass`);
      L.pours.push({ x: bx - 0.72, z: gz, w: 0.12, d: 1.05 }, { x: bx + 0.72, z: gz, w: 0.12, d: 1.05 }, { x: bx - 0.27, z: gz - 0.64, w: 0.38, d: 0.16 }, { x: bx + 0.27, z: gz - 0.64, w: 0.38, d: 0.16 });
      // cold-plate mounting holes at the package corners, outside the regulator ring
      for (const sx of [-1, 1]) { L.holes.push([bx + sx * 0.6, gz + 0.6, 0.018]); L.holes.push([bx + sx * 0.62, gz - 0.75, 0.018]); }
    }
    // Buses, one interface per channel (design rules: short and direct, a via only at the escape and the connector,
    // nothing under a regulator, mirror-symmetric boards). NVLink leaves every GPU the same way: out of the package's
    // rear edge on an inner layer, up a via just outside it, then on top through the channel in the regulator row.
    const ch = 0.8325;                                        // the outboard channel: between the VRM column and the edge holes
    // front GPU: one turn between the GPUs, then straight back along the outboard channel to the outer connector
    L.buses.push({ id: `NVLink ${side} front`, pts: [[bx, -0.1], [bx, -0.36], [bx, -0.62], [bx + s * 0.08, -0.7], [X(ch) - s * 0.08, -0.7], [X(ch), -0.78], [X(ch), -3.08]], pairs: 8,
      layers: ['in', 'top', 'top', 'top', 'top', 'top'] });
    L.conns.push({ x: X(ch), z: -3.12, w: 0.12, d: 0.05, ref: `J${s > 0 ? 22 : 20}` });
    // rear GPU: straight back to the inner connector behind it
    L.buses.push({ id: `NVLink ${side} rear`, pts: [[bx, -1.85], [bx, -2.11], [bx, -3.08]], pairs: 8, layers: ['in', 'top'] });
    L.conns.push({ x: bx, z: -3.12, w: 0.12, d: 0.05, ref: `J${s > 0 ? 23 : 21}` });
    // C2C to the front GPU on the centerline: vias under Grace's and the GPU's decoupling rows, top layer between
    L.buses.push({ id: `C2C ${side} front`, pts: [[X(0.08), 1.45], [X(0.08), 1.3], [X(0.08), 0.86], [X(0.08), 0.66]], pairs: 14, layers: ['in', 'top', 'in'] });
    // C2C to the rear GPU: out of Grace's inboard rear corner, back along the inboard channel, in at the rear GPU's front edge
    const cin = 0.835;                                         // the inboard channel, between the 12 V bar and the VRM column
    L.buses.push({ id: `C2C ${side} rear`, pts: [[X(-0.24), 1.46], [X(-0.24), 1.22], [X(-cin) + s * 0.05, 1.17], [X(-cin), 1.12], [X(-cin), -0.67], [X(-cin) + s * 0.05, -0.72], [X(-0.2) - s * 0.06, -0.72], [X(-0.2), -0.78], [X(-0.2), -0.93], [X(-0.2), -1.25]],
      pairs: 6, layers: ['in', 'top', 'top', 'top', 'top', 'top', 'top', 'top', 'in'] });
    // Grace to the NIC mezzanines (PCIe), to a board-to-board connector at the front edge
    L.buses.push({ id: `PCIe ${side} NIC`, pts: [[bx + 0.15, 2.05], [bx + 0.15, 2.18], [bx + 0.15, 2.3]], pairs: 8, layers: ['in', 'top'] });
    L.conns.push({ x: bx + 0.15, z: 2.34, w: 0.16, d: 0.04, ref: `J${s > 0 ? 25 : 24}` });
    // 12 V: one copper bar along the board's inboard edge, in its own channel (tray.js barX)
    part(L, `12 V bar ${side}`, s * 0.15, -0.975, 0.08, 5.75);
    for (const z of [-3.0, -1.0, 1.0, 2.45]) L.holes.push([X(0.93), z, 0.02]);   // edge holes on the outboard edge only
    for (let i = 0; i < 10; i++) L.tps.push([X(0.9), -2.8 + i * 0.5, s]);
  }
  // NIC mezzanine boards and the front cage boards
  const ultra = accel === 'gb300';
  const mezz = ultra ? [[0.45, 0.92], [1.45, 0.92]] : [0.2, 0.7, 1.2, 1.7].map(x => [x, 0.42]);
  mezz.forEach(([x, w], i) => {
    L.boards.push({ x, z: 3.315, w, d: 0.93 });
    L.conns.push({ x, z: 2.9, w: w * 0.5, d: 0.06, ref: `J${10 + i}` });
    for (const sx of [-1, 1]) for (const z of [2.9, 3.73]) L.holes.push([x + sx * (w / 2 - 0.04), z, 0.014]);
  });
  for (const x of [0.2, 0.7, 1.2, 1.7]) {
    L.pkgs.push({ x, z: 3.3, w: 0.26, d: 0.26, ref: '', fan: 2, m: 0.02, hidden: true });
    smdRowPart(L, [x - 0.12, 3.03], [x + 0.12, 3.03], true, 'NIC bypass');
    smdRowPart(L, [x + 0.19, 3.1], [x + 0.19, 3.5], false, 'NIC bypass');
    L.buses.push({ id: `NIC ${x} out`, pts: [[x, 3.44], [x, 3.66]], pairs: 8 });
    L.buses.push({ id: `NIC ${x} host`, pts: [[x - 0.05, 3.16], [x - 0.05, 2.96]], pairs: 8, layer: 'in' });
    L.conns.push({ x, z: 3.93, w: 0.15, d: 0.075, ref: '' });
    L.buses.push({ id: `cage ${x}`, pts: [[x, 3.97], [x, 4.4]], pairs: 8 });
  }
  const cage = ultra ? [[0.45, 0.92], [1.45, 0.92]] : [[0.95, 1.96]];
  for (const [x, w] of cage) {
    L.boards.push({ x, z: 4.165, w, d: 0.61 });
    for (const sx of [-1, 1]) for (const z of [3.92, 4.41]) L.holes.push([x + sx * (w / 2 - 0.04), z, 0.014]);
  }
  return L;
}
// DGX H100 (tray.js DGX): two decks overlap in plan, the GPU tray's HGX baseboard over the motherboard tray. The
// atlas is twice as wide for this generation: the GPU deck paints at its own x, the motherboard deck 4.4 units to the
// right (H100_DECK2), and applyPcb sends each board mesh to its deck by height.
export const H100_DECK2 = 4.4, H100_DECK_Y = 1.4;
function h100Layout() {
  const L = base(), X = x => x + H100_DECK2;
  // ---- GPU deck: HGX baseboard ----
  L.boards.push({ x: 0, z: -0.05, w: 4.2, d: 6.6 });
  const gpuX = [-1.62, -0.54, 0.54, 1.62], gpuZ = [1.2, -0.62], swX = [-1.55, -0.52, 0.52, 1.55], swZ = -2.3, connX = gpuX;
  gpuZ.forEach((z, r) => gpuX.forEach((x, c) => L.pkgs.push({ x, z, w: 0.9, d: 1.4, ref: `SXM${r * 4 + c + 1}`, fan: 0, m: 0.01 })));
  swX.forEach((x, i) => {
    L.pkgs.push({ x, z: swZ, w: 0.42, d: 0.42, ref: `U${60 + i}`, fan: 2, m: 0.005 });
    for (const g of [0.04, 0.058]) smdFramePart(L, x, swZ, 0.42, 0.42, g, `NVSwitch ${i + 1} decoupling`);
  });
  // power entry, conversion and point of load in straight lines: 54 V connectors in the outer strips and the center,
  // their straps and converters straight behind, beside the regulator rows they feed; PCIe channels stay clear of them
  [[-1.95, 0.3], [0, 0.36], [1.95, 0.3]].forEach(([x, w]) => {
    for (const z of [2.75, 2.3]) part(L, '54 V converter', x, z, w, 0.36);
    L.pours.push({ x, z: 2.7, w: w + 0.04, d: 0.9 });
  });
  [-1.97, 0, 1.97].forEach((x, i) => L.conns.push({ x, z: 3.19, w: x ? 0.2 : 0.3, d: 0.08, ref: `J${10 + i}` }));
  [-1.08, 1.08].forEach((x, i) => L.conns.push({ x, z: 3.19, w: 0.2, d: 0.08, ref: `J${13 + i}` }));
  L.pkgs.push({ x: -1.08, z: 2.5, w: 0.3, d: 0.3, ref: 'U70', fan: 1, m: 0.01 });
  connX.forEach((x, i) => L.conns.push({ x, z: 3.19, w: 0.4, d: 0.08, ref: `J${1 + i}` }));
  // NVLink: each rear-row module straight back into its NVSwitch; each front-row module out its rear edge, down the
  // gap between the rear-row modules (their footprints are connectors: nothing routes under them) and into a switch's
  // side. A bus dives to an inner layer to pass the switches' decoupling rows.
  const vertical = [];
  swX.forEach((x, c) => { const bx = x + 0.1; L.buses.push({ id: `NVLink SXM${5 + c}`, pts: [[bx, -1.25], [bx, -1.85], [bx, -2.1]], pairs: 12, layers: ['top', 'in'] }); vertical.push([bx, 0.07]); });
  const gapX = [-1.08, -0.0365, 0.0365, 1.08], pairs = [6, 5, 5, 6];
  gpuX.forEach((x, c) => {
    const gx = gapX[c], s = c < 2 ? -1 : 1;
    const sw = c === 0 ? swX[0] : c === 3 ? swX[3] : swX[c];
    const edge = sw - s * 0.21, via = edge - s * 0.12, start = gx + (c < 2 ? -1 : 1) * 0.17;
    L.buses.push({ id: `NVLink SXM${1 + c}`, pts: [[start, 0.56], [start, 0.29], [gx, 0.29], [gx, swZ], [via, swZ], [edge + s * 0.1, swZ]], pairs: pairs[c], layers: ['top', 'top', 'top', 'top', 'in'] });
    vertical.push([gx, 0.04]);
    // PCIe straight forward from each front-row module to the connector in front of its column, one layer, no via;
    // the rear-row module's lanes run under the front module on an inner layer and join it at the connector
    L.buses.push({ id: `PCIe SXM${1 + c}`, pts: [[x, 1.85], [x, 3.17]], pairs: 8 });
  });
  for (const [c, gx, sw, s] of [[0, -1.08, swX[1], 1], [3, 1.08, swX[2], -1]]) {
    const start = gx - s * 0.27;
    L.buses.push({ id: `NVLink SXM${1 + c} b`, pts: [[start, 0.56], [start, 0.41], [gx, 0.41], [gx, swZ - 0.08], [sw - s * 0.12, swZ - 0.08]], pairs: 5, layer: 'in' });
  }
  for (const sx of [-1, 1]) for (const z of [-3.1, -1.75, 0.29, 2.02]) L.holes.push([sx * 2.03, z, 0.022]);
  for (let i = 0; i < 25; i++) { const x = -1.8 + i * 0.15; if (vertical.every(([vx, hw]) => Math.abs(x - vx) > hw + 0.04)) L.tps.push([x, -1.72]); }
  // ---- motherboard deck (x + H100_DECK2): motherboard, interposer, then the upper boards ----
  L.boards.push({ x: X(0), z: -2.1, w: 4.2, d: 4.44 }, { x: X(0), z: 1.71, w: 4.2, d: 3.02 });
  const cpuX = [-1.07, 1.07], cpuZ = -1.15, bankX = [-1.74, -0.4, 0.4, 1.74], modX = [-1.07, 1.07], modZ = 2.0, cageX = [-0.375, -0.125, 0.125, 0.375];
  cpuX.forEach((x, k) => {
    L.pkgs.push({ x: X(x), z: cpuZ, w: 0.66, d: 0.56, ref: `CPU${k}`, fan: 1, m: 0.03 });
    for (const s of [-1, 1]) smdRowPart(L, [X(x) - 0.33, cpuZ + s * 0.39], [X(x) + 0.33, cpuZ + s * 0.39], true, `CPU${k} decoupling`);
    const s = Math.sign(x);
    // memory channels to the slot banks either side, on an inner layer
    for (const d of [-1, 1]) L.buses.push({ id: `DDR5 CPU${k} ${d}`, pts: [[X(x + d * 0.26), cpuZ], [X(x + d * 0.42), cpuZ]], pairs: 16, pitch: 0.012, layer: 'in' });
    // PCIe straight forward to the interposer connector, and to this side's PCIe switch; the regulator row takes the
    // rest of the CPU's front edge, fed by a pour straight back from the power connector (point of load)
    const pc = x - s * 0.18;
    L.buses.push({ id: `PCIe CPU${k} to modules`, pts: [[X(pc), cpuZ + 0.2], [X(pc), -0.6], [X(pc), 0.02]], pairs: 10, layers: ['in', 'top'] });
    L.conns.push({ x: X(pc), z: 0.05, w: 0.3, d: 0.05, ref: `J${40 + k}` });
    L.buses.push({ id: `PCIe CPU${k} to switch`, pts: [[X(x - s * 0.31), cpuZ + 0.2], [X(x - s * 0.31), -0.37], [X(s * 0.35), -0.37], [X(s * 0.35), -0.2]], pairs: 3, layers: ['in', 'top', 'in'] });
    for (let i = 0; i < 5; i++) L.vrms.push({ x: X(x + s * (-0.07 + i * 0.09)), z: cpuZ + 0.53, w: 0.07, d: 0.07 });
    L.pours.push({ x: X(s * 1.09), z: -0.21, w: 0.06, d: 0.66 });
    // switch to the storage NIC: out the switch's inner side, down the center channel, behind the banks to the riser
    L.buses.push({ id: `PCIe switch ${k} to riser`, pts: [[X(s * 0.27), -0.2], [X(s * 0.06), -0.2], [X(s * 0.06), -2.05], [X(s * 0.62), -2.05], [X(s * 0.66), -2.4]], pairs: 3, layers: ['in', 'top', 'top', 'top'] });
    L.conns.push({ x: X(s * 0.66), z: -3.4, w: 0.06, d: 1.9, ref: '' });
  });
  bankX.forEach((bx, i) => part(L, `DIMM slots ${i + 1}`, X(bx), cpuZ, 0.54, 1.5, { layer: 'all', term: true }));
  for (const x of [-0.35, 0.35]) { L.pkgs.push({ x: X(x), z: -0.15, w: 0.3, d: 0.3, ref: 'U', fan: 1, m: 0.01 }); smdFramePart(L, X(x), -0.15, 0.3, 0.3, 0.03, `PCIe switch ${x} bypass`); }
  modX.forEach((mx, m) => {
    const s = Math.sign(mx), pc = s * (1.07 - 0.18);
    // CPU to its network module, straight through the interposer connector to the module's rear edge
    L.conns.push({ x: X(pc), z: 0.26, w: 0.3, d: 0.05, ref: `J${20 + m}` });
    L.buses.push({ id: `PCIe module ${m}`, pts: [[X(pc), 0.3], [X(pc), 1.26]], pairs: 10 });
    L.conns.push({ x: X(pc), z: 1.29, w: 0.4, d: 0.05, ref: `J${22 + m}` });
    // drives: straight back down the center channel from their midplane connector to the switch
    L.buses.push({ id: `NVMe ${m}`, pts: [[X(s * 0.25), 3.15], [X(s * 0.25), 0.27]], pairs: 6 });
    L.conns.push({ x: X(s * 0.25), z: 0.24, w: 0.2, d: 0.05, ref: `J${24 + m}` });
    L.conns.push({ x: X(s * 0.3), z: 0.08, w: 0.2, d: 0.05, ref: `J${26 + m}` });
    L.buses.push({ id: `NVMe ${m} b`, pts: [[X(s * 0.3), 0.045], [X(s * 0.3), -0.05]], pairs: 6, layer: 'in' });
    // GPU PCIe: from each midplane connector straight back to the ConnectX-7 column in line with it
    for (const dx of [-0.36, 0.36]) L.buses.push({ id: `GPU PCIe ${mx + dx}`, pts: [[X(mx + dx), 3.15], [X(mx + dx), 2.72]], pairs: 8 });
    // 54 V: the outer strip from the power connector, across behind the module, then straight back to the CPU regulators
    L.pours.push({ x: X(s * 1.9), z: 1.73, w: 0.1, d: 2.9 }, { x: X(s * 1.505), z: 0.27, w: 0.89, d: 0.1 });
  });
  [-1.43, -0.71, 0.71, 1.43].forEach((x, i) => L.conns.push({ x: X(x), z: 3.185, w: 0.36, d: 0.08, ref: `J${30 + i}` }));
  [-1.9, 1.9].forEach((x, i) => L.conns.push({ x: X(x), z: 3.185, w: 0.18, d: 0.08, ref: `J${34 + i}` }));
  [-0.25, 0.25].forEach((x, i) => L.conns.push({ x: X(x), z: 3.185, w: 0.2, d: 0.08, ref: `J${36 + i}` }));
  for (const sx of [-1, 1]) for (const z of [-4.1, -2.6, 0.6, 3.0]) L.holes.push([X(sx * 2.03), z, 0.02]);
  // the rear: the cage board's cable connectors to its four cages
  L.boards.push({ x: X(0), z: -4.17, w: 1.15, d: 0.62 });
  cageX.forEach(x => { L.conns.push({ x: X(x), z: -3.92, w: 0.16, d: 0.06, ref: '' }); L.buses.push({ id: `cage ${x}`, pts: [[X(x), -3.95], [X(x), -4.4]], pairs: 6 }); });
  for (const sx of [-1, 1]) for (const z of [-4.42, -3.92]) L.holes.push([X(sx * 0.53), z, 0.014]);
  // network module boards (upper) with their four ConnectX-7 and the rear-edge DensiLink connectors
  modX.forEach(mx => {
    L.boards.push({ x: X(mx), z: modZ, w: 1.42, d: 1.3 });
    for (const dx of [-0.36, 0.36]) {
      for (const dz of [-0.32, 0.32]) L.pkgs.push({ x: X(mx + dx), z: modZ + dz, w: 0.26, d: 0.26, ref: '', fan: 1, m: 0.01, hidden: true });
      L.conns.push({ x: X(mx + dx), z: modZ - 0.6, w: 0.15, d: 0.05, ref: '' });
      L.buses.push({ id: `module ${mx} ${dx}`, pts: [[X(mx + dx), modZ - 0.45], [X(mx + dx), modZ - 0.58]], pairs: 6 });
    }
  });
  // riser cards (upper): slots 1 and 3 left, 2 and 4 right
  for (const sx of [-1, 1]) L.boards.push({ x: X(sx * 1.42), z: -3.62, w: 1.3, d: 1.68 });
  return L;
}
function rubinLayout() {
  const L = base();
  const gp = [[-1.6, -2.7], [-0.62, -2.7], [0.62, -2.7], [1.6, -2.7]], cp = [[-1.1, -0.65], [1.1, -0.65]];
  for (const x of [-1.1, 1.1]) L.boards.push({ x, z: -1.52, w: 2.02, d: 4.9 });
  // regulator rows as tray-rubin.js builds them: inductors, power stages toward the package, a cap ring at its edge. Slots
  // are left open as routing channels (design rules: nothing under a regulator), mirrored left to right: each GPU's
  // rear row opens on its centerline for NVLink, its front row on the side facing its CPU for C2C; each CPU's rows open
  // 0.12 either side of its centerline for C2C (rear) and PCIe (front).
  const vrmRow = (x0, z, n, inward, id, skip = []) => { for (let k = 0; k < n; k++) { if (skip.includes(k)) continue; L.vrms.push({ x: x0 + k * 0.12, z, w: 0.1, d: 0.09 }); part(L, `${id} power stage`, x0 + k * 0.12, z + inward * 0.085, 0.06, 0.05, { land: true }); } };
  const c2cSide = x => Math.sign((x < 0 ? -1.1 : 1.1) - x);
  gp.forEach(([x, z], i) => {
    L.pkgs.push({ x, z, w: 0.83, d: 0.95, ref: `U${i + 1}`, fan: 1, m: 0.005 });
    vrmRow(x - 0.36, z - 0.66, 7, 1, `GPU ${i + 1}`, [3]); vrmRow(x - 0.36, z + 0.66, 7, -1, `GPU ${i + 1}`, [c2cSide(x) > 0 ? 5 : 1]);
    for (let k = 0; k < 8; k++) for (const s of [-1, 1]) {
      const u = -0.45 + (k + 0.5) * 0.1125;
      if ((s < 0 && Math.abs(u) < 0.1) || (s > 0 && Math.abs(u - c2cSide(x) * 0.24) < 0.12)) continue;
      part(L, `GPU ${i + 1} cap ring`, x + u, z + s * 0.54, 0.018, 0.012);
    }
    // NVLink: out of the rear edge on an inner layer, a via just outside the package, then straight back on the top
    // layer through the channel in the rear row to the connector directly behind the GPU
    L.buses.push({ id: `NVLink GPU${i + 1}`, pts: [[x, z - 0.3], [x, z - 0.56], [x, -3.84]], pairs: 8, layers: ['in', 'top'] });
    L.conns.push({ x, z: -3.88, w: 0.16, d: 0.04, ref: '' });
  });
  const housings = [-1.325, -0.795, 0.795, 1.325];             // midplane connector columns (tray-rubin.js)
  cp.forEach(([x, z], i) => {
    L.pkgs.push({ x, z, w: 0.75, d: 0.77, ref: `U${10 + i}`, fan: 1, m: 0.005 });
    vrmRow(x - 0.24, z - 0.52, 5, 1, `CPU ${i + 1}`, [1, 3]); vrmRow(x - 0.24, z + 0.52, 5, -1, `CPU ${i + 1}`, [1, 3]);
    for (const s of [-1, 1]) L.boards.push({ x: x + s * 0.64, z, w: 0.3, d: 1.05, module: true });
    // C2C to its two GPUs: out of the rear edge 0.12 toward the GPU, one diagonal, in at the GPU's front-row gap
    for (const g of gp.filter(([gx]) => Math.sign(gx) === Math.sign(x))) {
      const a = Math.sign(g[0] - x) * 0.12, b = -Math.sign(g[0] - x) * 0.24;
      L.buses.push({ id: `C2C CPU${i + 1} to ${g[0]}`, pts: [[x + a, z - 0.33], [x + a, z - 0.47], [x + a, -1.3], [g[0] + b, -1.9], [g[0] + b, -2.1], [g[0] + b, -2.45]], pairs: 8, layers: ['in', 'top', 'top', 'top', 'in'] });
    }
    // PCIe forward: out of the front edge 0.12 either side, through the front row's gaps, one jog to its midplane column
    for (const dx of [-0.12, 0.12]) {
      const hx = housings.reduce((m, h) => (Math.abs(h - (x + dx * 2.5)) < Math.abs(m - (x + dx * 2.5)) ? h : m));
      L.buses.push({ id: `PCIe CPU${i + 1} ${dx}`, pts: [[x + dx, z + 0.33], [x + dx, z + 0.47], [x + dx, 0], [hx, 0.2], [hx, 0.82]], pairs: 8, layers: ['in', 'top', 'top', 'top'] });
      L.conns.push({ x: hx, z: 0.86, w: 0.2, d: 0.04, ref: '' });
    }
  });
  for (const x of [-1.1, 1.1]) part(L, '12 V bar', x, -1.7, 0.11, 4.5);
  for (const [x, z] of [[-1.35, 2.85], [1.35, 2.85]]) {
    L.boards.push({ x, z, w: 1.35, d: 2.15 });
    for (const dx of [-0.3, 0.3]) for (const dz of [-0.47, 0.47]) L.pkgs.push({ x: x + dx, z: z + dz, w: 0.4, d: 0.52, ref: '', fan: 2 });
  }
  L.boards.push({ x: 0, z: 2.85, w: 0.85, d: 2.15 });
  L.pkgs.push({ x: 0, z: 2.85, w: 0.66, d: 0.75, ref: 'U20', fan: 3 });
  for (const sx of [-1, 1]) for (const z of [-3.8, -1.75, -0.2, 0.8]) L.holes.push([sx * 2.05, z, 0.02]);
  return L;
}
function base() { return { boards: [], pkgs: [], vrms: [], pours: [], buses: [], holes: [], tps: [], conns: [], parts: [] }; }
export function pcbLayout(accel) { return accel === 'h100' ? h100Layout() : accel === 'rubin' ? rubinLayout() : nvlLayout(accel); }

// ---------- plan: the layout as design-rule objects, plus the procedural fill ----------
// The painter draws exactly the plan and pcb-check.js checks exactly the plan, so the two cannot drift.
export const PCB_GAP = 0.0064;                        // clearance: 3 px of the 2048 px tray atlas
const PAIR = 0.0105, INNER = 0.0032, THERMAL_R = 0.004;           // thermal via: 0.0032 drill, tented ring 1.25x                  // differential-pair pitch and the gap inside a pair
const pkgOutline = p => [p.w / 2 + (p.m ?? 0.03) + (p.fan || 0) * 0.0125, p.d / 2 + (p.m ?? 0.03) + (p.fan || 0) * 0.0125];
function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; }
const busLayers = b => b.layers || b.pts.slice(1).map(() => b.layer || 'top');
const busWidth = b => b.pairs * (b.pitch ?? PAIR);

export function pcbPlan(accel, lod = 'tray') {
  const L = pcbLayout(accel), rack = lod === 'rack', rnd = rng(accel.length * 7919 + (rack ? 3 : 0) + 101);
  const obstacles = [];
  L.pkgs.forEach((p, i) => { const [ow, od] = pkgOutline(p); obstacles.push({ id: p.ref || `pkg${i}`, kind: 'package', x: p.x, z: p.z, w: ow * 2 + 0.0044, d: od * 2 + 0.0044, layer: 'all', term: true, pad: true }); });
  L.vrms.forEach((v, i) => obstacles.push({ id: `L${i + 1}`, kind: 'VRM pad', x: v.x, z: v.z, w: v.w + 0.014, d: v.d + 0.014, layer: 'top', pad: true }));
  L.conns.forEach((c, i) => obstacles.push({ id: c.ref || `conn${i}`, kind: 'connector', x: c.x, z: c.z, w: c.w + 0.022, d: c.d + 0.022, layer: 'all', term: true, pad: true }));
  L.tps.forEach(([x, z], i) => obstacles.push({ id: `TP${i + 1}`, kind: 'test point', x, z, r: 0.008, layer: 'top', pad: true }));
  L.holes.forEach(([x, z, r], i) => obstacles.push({ id: `H${i + 1} (${x.toFixed(2)}, ${z.toFixed(2)})`, kind: 'hole', x, z, r: r * 2.1, layer: 'all' }));
  L.pours.forEach((p, i) => obstacles.push({ id: `pour${i}`, kind: 'pour', x: p.x, z: p.z, w: p.w, d: p.d, layer: 'top' }));
  L.boards.filter(b => b.module).forEach((b, i) => obstacles.push({ id: `M${i + 1}`, kind: 'module', x: b.x, z: b.z, w: b.w, d: b.d, layer: 'all', pad: true }));
  L.parts.forEach((p, i) => obstacles.push({ id: p.id || `part${i}`, kind: p.kind || 'part', x: p.x, z: p.z, w: p.w, d: p.d, layer: p.layer || 'top', term: !!p.term, pad: true, model: true }));
  const buses = L.buses.map((b, i) => ({ ...b, id: b.id || `bus ${i}`, layers: busLayers(b), hw: (busWidth(b) + 0.006) / 2 }));
  // thermal vias through each pour, a through-hole each, so none lands on an inner-layer run passing under the pour
  const inner = buses.flatMap(b => segsOf(b).filter(sg => sg[2] !== 'top').map(sg => [sg[0], sg[1], b.hw]));
  const pours = L.pours.map(p => {
    const pitch = rack ? 0.045 : 0.02, vias = [];
    for (let x = p.x - p.w / 2 + pitch / 2; x < p.x + p.w / 2; x += pitch) for (let z = p.z - p.d / 2 + pitch / 2; z < p.z + p.d / 2; z += pitch)
      if (rnd() < 0.55 && inner.every(([a, c, hw]) => pointSeg([x, z], a, c) >= hw + PCB_GAP + THERMAL_R)) vias.push([x, z]);
    return { ...p, vias };
  });
  // fill: short routed groups, via fields and small parts in what is left of each board, never closer than the gap
  const fill = { obstacles: [], buses: [] }, CL = new Clearance(PCB_GAP);
  for (const o of obstacles) CL.addObstacle(o);
  for (const b of buses) CL.addBus(b);
  const inBoard = (x0, z0, x1, z1) => L.boards.some(b => !b.module && x0 > b.x - b.w / 2 + 0.03 && x1 < b.x + b.w / 2 - 0.03 && z0 > b.z - b.d / 2 + 0.03 && z1 < b.z + b.d / 2 - 0.03);
  const boardOf = (x, z) => L.boards.filter(b => Math.abs(x - b.x) < b.w / 2 && Math.abs(z - b.z) < b.d / 2).at(-1);
  for (const b of L.boards) {
    if (b.module) continue;
    const n = Math.round(b.w * b.d * (rack ? 60 : 150));
    for (let k = 0; k < n; k++) {
      const x = b.x + (rnd() - 0.5) * (b.w - 0.12), z = b.z + (rnd() - 0.5) * (b.d - 0.12), kind = rnd();
      if (boardOf(x, z) !== b) continue;                                          // under an upper-deck board
      if (kind < 0.45) {                                                           // a short bus with a 45-degree jog
        const len = 0.08 + rnd() * 0.25, horiz = rnd() < 0.5, jog = (rnd() - 0.5) * 0.12, pairs = 2 + Math.floor(rnd() * 5);
        const pts = horiz ? [[x, z], [x + len * 0.5, z], [x + len * 0.5 + Math.abs(jog), z + jog], [x + len + Math.abs(jog), z + jog]]
          : [[x, z], [x, z + len * 0.5], [x + jog, z + len * 0.5 + Math.abs(jog)], [x + jog, z + len + Math.abs(jog)]];
        const fb = { id: `fill bus ${fill.buses.length}`, pts, pairs, horiz, layers: ['top', 'top', 'top'], hw: pairs * PAIR / 2 + 0.004, fill: true };
        const xs = pts.map(p => p[0]), zs = pts.map(p => p[1]);
        if (!inBoard(Math.min(...xs) - fb.hw, Math.min(...zs) - fb.hw, Math.max(...xs) + fb.hw, Math.max(...zs) + fb.hw) || CL.busFaults(fb).length) continue;
        CL.addBus(fb); fill.buses.push(fb);
      } else if (kind < 0.7) {                                                     // a via field
        const w = 0.04 + rnd() * 0.08, d = 0.04 + rnd() * 0.08, seed = Math.floor(rnd() * 1e9);
        const o = { id: `via field ${fill.obstacles.length}`, kind: 'via field', x, z, w: w + 0.008, d: d + 0.008, fw: w, fd: d, seed, layer: 'all' };
        if (!inBoard(x - o.w / 2, z - o.d / 2, x + o.w / 2, z + o.d / 2) || CL.obstacleFaults(o).length) continue;
        CL.addObstacle(o); fill.obstacles.push(o);
      } else if (!rack) {                                                          // a small part footprint: pads, outline, designator
        const w = 0.03 + rnd() * 0.05, d = 0.03 + rnd() * 0.05, pins = 3 + Math.floor(rnd() * 5), ref = `${'RCUQ'[Math.floor(rnd() * 4)]}${100 + Math.floor(rnd() * 800)}`;
        const tw = Math.max(w, ref.length * 0.011 * 0.62) + 0.004;                 // the outline and its designator above
        const o = { id: ref, kind: 'small part', x: x - w / 2 + tw / 2 - 0.002, z: z - 0.011, w: tw, d: d + 0.026, px: x, pz: z, pw: w, pd: d, pins, layer: 'top', pad: true };
        if (!inBoard(o.x - o.w / 2, o.z - o.d / 2, o.x + o.w / 2, o.z + o.d / 2) || CL.obstacleFaults(o).length) continue;
        CL.addObstacle(o); fill.obstacles.push(o);
      }
    }
  }
  return { accel, lod, L, boards: L.boards.filter(b => !b.module), obstacles, buses, pours, fill };
}

// ---------- painter ----------
const cache = new Map();
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

export function paintPcb(accel, { W = 2048, lod = 'tray' } = {}) {
  const key = `${accel}|${W}|${lod}`;
  if (cache.has(key)) return cache.get(key);
  const SPAN = spanOf(accel), H = Math.round(W * 2 * SPAN0.w / SPAN.w), col = makeCanvas(W, H), surf = makeCanvas(W / 2, H / 2);
  const layers = [[col.getContext('2d'), W / SPAN.w, 'c'], [surf.getContext('2d'), W / 2 / SPAN.w, 's']];
  const sz = H / SPAN.d / (W / SPAN.w);            // z stretch relative to x (≈1)
  const each = (cs, ss, fn) => { for (const [g, k, t] of layers) { g.setTransform(k, 0, 0, k * sz, -SPAN.x0 * k, -SPAN.z0 * k * sz); fn(g, t === 'c' ? cs : ss, t); } };
  const rect = (x, z, w, d, cs, ss) => each(cs, ss, (g, st) => { g.fillStyle = st; g.fillRect(x - w / 2, z - d / 2, w, d); });
  const stroke = (pts, width, cs, ss, cap = 'round') => each(cs, ss, (g, st) => { g.strokeStyle = st; g.lineWidth = width; g.lineJoin = 'round'; g.lineCap = cap; g.beginPath(); pts.forEach(([x, z], i) => i ? g.lineTo(x, z) : g.moveTo(x, z)); g.stroke(); });
  const disc = (x, z, r, cs, ss) => each(cs, ss, (g, st) => { g.fillStyle = st; g.beginPath(); g.arc(x, z, r, 0, Math.PI * 2); g.fill(); });
  const rack = lod === 'rack', rnd = rng(accel.length * 7919 + (rack ? 3 : 0));
  if (rack) C.silk = '#9fb0a2';                                 // at rack distance a full-white silk line reads as a glare stripe
  else C.silk = '#dfe6dc';
  const plan = pcbPlan(accel, lod), L = plan.L;
  const px = SPAN.w / W;                            // one color pixel in tray units
  const text = (x, z, str, h) => {                  // silkscreen text, in color and surface
    if (rack || !str) return;
    for (const [g, k, t] of layers) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = t === 'c' ? C.silk : S.silk; g.font = `600 ${Math.max(4, h * k)}px monospace`; g.textBaseline = 'middle';
      g.fillText(str, (x - SPAN.x0) * k, (z - SPAN.z0) * k * sz);
    }
  };

  // background outside boards (never seen) and each board, in order (upper decks paint last)
  rect(SPAN.x0 + SPAN.w / 2, SPAN.z0 + SPAN.d / 2, SPAN.w, SPAN.d, C.mask, S.mask);
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
  // routed buses: differential pairs; top-layer runs in a clearance channel, inner-layer runs dim beneath the
  // laminate; a row of vias wherever a bus changes layer and at both ends
  const off = (pts, o) => pts.map(([x, z], i) => {             // offset a polyline sideways (miter-free, fine for 45/90 degree bends)
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    return [x - dz * o, z + dx * o];
  });
  const runs = bus => {                                          // maximal same-layer stretches: [layer, pts]
    const out = [];
    bus.layers.forEach((l, i) => { if (out.length && out.at(-1)[0] === l) out.at(-1)[1].push(bus.pts[i + 1]); else out.push([l, [bus.pts[i], bus.pts[i + 1]]]); });
    return out;
  };
  const viaRow = (bus, at, dir, ahead) => {                      // vias across the bus at a point, `ahead` along dir
    const n = bus.pairs, pp = bus.pitch ?? PAIR, width = n * pp;
    for (let k = 0; k < n; k++) { const o = -width / 2 + (k + 0.5) * pp; for (const s of [-1, 1]) via(at[0] - dir[1] * (o + s * INNER / 2) + dir[0] * ahead, at[1] + dir[0] * (o + s * INNER / 2) + dir[1] * ahead, 0.0022, true); }
  };
  const unit = (a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; return [dx / l, dz / l]; };
  const drawBus = (bus, layer) => {
    const n = bus.pairs, pp = bus.pitch ?? PAIR, width = n * pp, tw = rack ? 0.004 : 0.0016;
    for (const [l, pts] of runs(bus)) {
      if (l !== layer) continue;
      if (l === 'in') {
        if (rack) stroke(pts, width * 0.9, C.traceIn, S.traceIn);
        else for (let k = 0; k < n; k++) { const o = -width / 2 + (k + 0.5) * pp; for (const s of [-1, 1]) stroke(off(pts, o + s * INNER / 2), tw * 1.2, C.traceIn, S.traceIn); }
        continue;
      }
      stroke(pts, width + 0.006, C.clear, S.clear, 'butt');
      if (rack) stroke(pts, width * 0.9, '#155a40', S.trace);
      else for (let k = 0; k < n; k++) { const o = -width / 2 + (k + 0.5) * pp; for (const s of [-1, 1]) stroke(off(pts, o + s * INNER / 2), tw, C.trace, S.trace); }
    }
  };
  for (const bus of plan.buses) drawBus(bus, 'in');
  // copper pours under power parts, with thermal via arrays (over any inner-layer run beneath them)
  for (const p of plan.pours) {
    rect(p.x, p.z, p.w, p.d, C.pour, S.pour);
    for (const [x, z] of p.vias) via(x, z, 0.0032, true);
  }
  for (const bus of plan.buses) drawBus(bus, 'top');
  for (const bus of plan.buses) {
    const p = bus.pts;
    viaRow(bus, p[0], unit(p[1], p[0]), 0.01);
    viaRow(bus, p.at(-1), unit(p.at(-2), p.at(-1)), 0.01);
    for (let i = 1; i < p.length - 1; i++) if (bus.layers[i - 1] !== bus.layers[i]) viaRow(bus, p[i], unit(p[i - 1], p[i + 1]), 0);
  }
  // package footprints: silkscreen outline and courtyard, pin-1 mark, breakout via ring
  for (const p of L.pkgs) {
    if (p.fan) {
      const ring = p.fan, pitch = rack ? 0.03 : 0.0125;
      for (let r = 0; r < ring; r++) {
        const w = p.w / 2 + 0.012 + r * pitch, d = p.d / 2 + 0.012 + r * pitch;
        for (let x = -w; x <= w; x += pitch) for (const s of [-1, 1]) if (rnd() < 0.8) via(p.x + x, p.z + s * d, 0.0024, r % 2 === 1);
        for (let z = -d + pitch; z < d; z += pitch) for (const s of [-1, 1]) if (rnd() < 0.8) via(p.x + s * w, p.z + z, 0.0024, r % 2 === 1);
      }
    }
    const [ow, od] = pkgOutline(p);
    if (!p.hidden) {
      stroke([[p.x - ow, p.z - od], [p.x + ow, p.z - od], [p.x + ow, p.z + od], [p.x - ow, p.z + od], [p.x - ow, p.z - od]], rack ? 0.005 : 0.0022, C.silk, S.silk);
      disc(p.x - ow + 0.018, p.z - od + 0.018, 0.006, C.silk, S.silk);
      text(p.x - ow, p.z - od - 0.022, p.ref, p.w > 0.4 ? 0.028 : 0.016);
    }
  }
  // VRM phases: two large pads per inductor, outline and designator
  L.vrms.forEach((v, i) => {
    for (const s of [-1, 1]) rect(v.x + s * v.w * 0.3, v.z, v.w * 0.32, v.d * 0.8, C.tin, S.metal);
    stroke([[v.x - v.w / 2 - 0.006, v.z - v.d / 2 - 0.006], [v.x + v.w / 2 + 0.006, v.z - v.d / 2 - 0.006], [v.x + v.w / 2 + 0.006, v.z + v.d / 2 + 0.006], [v.x - v.w / 2 - 0.006, v.z + v.d / 2 + 0.006], [v.x - v.w / 2 - 0.006, v.z - v.d / 2 - 0.006]], rack ? 0.004 : 0.0018, C.silk, S.silk);
    if (i % 2 === 0) text(v.x - v.w / 2, v.z + v.d / 2 + 0.014, `L${i + 1}`, 0.012);
  });
  // land pads under the parts modelled in 3D (passive rows, power stages): bare tin, mostly hidden by the part
  const onVrm = p => L.vrms.some(v => Math.abs(p.x - v.x) < (p.w + v.w) / 2 && Math.abs(p.z - v.z) < (p.d + v.d) / 2);
  for (const p of L.parts) if (p.land && !onVrm(p)) rect(p.x, p.z, p.w * 0.8, p.d * 0.8, C.tin, S.metal);
  // connectors: pad rows, outline, designator
  for (const c of L.conns) {
    const n = Math.max(6, Math.round(c.w / 0.02));
    for (let k = 0; k < n; k++) for (const s of [-1, 1]) rect(c.x - c.w / 2 + (k + 0.5) * c.w / n, c.z + s * c.d * 0.28, c.w / n * 0.5, c.d * 0.3, C.gold, S.metal);
    stroke([[c.x - c.w / 2 - 0.01, c.z - c.d / 2 - 0.01], [c.x + c.w / 2 + 0.01, c.z - c.d / 2 - 0.01], [c.x + c.w / 2 + 0.01, c.z + c.d / 2 + 0.01], [c.x - c.w / 2 - 0.01, c.z + c.d / 2 + 0.01], [c.x - c.w / 2 - 0.01, c.z - c.d / 2 - 0.01]], rack ? 0.004 : 0.0018, C.silk, S.silk);
    text(c.x + c.w / 2 + 0.016, c.z, c.ref, 0.014);
  }
  // plated mounting holes with a keep-out ring, and gold test points with designators
  for (const [x, z, r] of L.holes) {
    disc(x, z, r * 2.1, C.clear, S.clear);
    disc(x, z, r * 1.55, C.tin, S.metal);
    disc(x, z, r, C.hole, S.hole);
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; via(x + Math.cos(a) * r * 1.3, z + Math.sin(a) * r * 1.3, 0.0022, false); }
  }
  L.tps.forEach(([x, z, dir = 1], i) => { disc(x, z, 0.007, C.gold, S.metal); const t = `TP${i + 1}`; text(dir > 0 ? x + 0.012 : x - 0.012 - t.length * 0.011 * 0.62, z, t, 0.011); });
  // fill, as planned
  const tw = rack ? 0.004 : 0.0016;
  for (const fb of plan.fill.buses) {
    const { pts, pairs, horiz } = fb;
    for (let p = 0; p < pairs; p++) {
      const o = (p - (pairs - 1) / 2) * PAIR;
      for (const s of [-1, 1]) stroke(pts.map(([px2, pz2]) => horiz ? [px2, pz2 + o + s * 0.0016] : [px2 + o + s * 0.0016, pz2]), tw, C.trace, S.trace);
    }
    for (const e of [pts[0], pts.at(-1)]) for (let p = 0; p < pairs; p++) { const o = (p - (pairs - 1) / 2) * PAIR; via(horiz ? e[0] : e[0] + o, horiz ? e[1] + o : e[1], 0.0022, true); }
  }
  for (const o of plan.fill.obstacles) {
    if (o.kind === 'via field') {
      const r2 = rng(o.seed);
      for (let i = -o.fw / 2; i <= o.fw / 2; i += 0.0125) for (let j = -o.fd / 2; j <= o.fd / 2; j += 0.0125) via(o.x + i, o.z + j, 0.0024, r2() < 0.8);
    } else {
      const { px: x, pz: z, pw: w, pd: d, pins } = o;
      for (let i = 0; i < pins; i++) for (const s of [-1, 1]) rect(x - w / 2 + (i + 0.5) * w / pins, z + s * d * 0.42, w / pins * 0.45, d * 0.14, C.tin, S.metal);
      stroke([[x - w / 2, z - d / 2], [x + w / 2, z - d / 2], [x + w / 2, z + d / 2], [x - w / 2, z + d / 2], [x - w / 2, z - d / 2]], 0.0016, C.silk, S.silk);
      text(x - w / 2, z - d / 2 - 0.012, o.id, 0.011);
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
  const rack = lod === 'rack', { map, data } = textures(accel, Math.round((rack || mobile ? 1024 : 2048) * spanOf(accel).w / SPAN0.w), lod);
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
  const material = pcbMaterial(accel, { mobile, lod }), v = new THREE.Vector3(), SPAN = spanOf(accel);
  // DGX H100 tray: the motherboard deck, under the GPU tray's pan, paints H100_DECK2 to the right in the atlas.
  const decks = accel === 'h100' && !rects;
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
      if (decks && v.y < H100_DECK_Y) x += H100_DECK2;
      uv[i * 2] = (x - SPAN.x0) / SPAN.w; uv[i * 2 + 1] = (z - SPAN.z0) / SPAN.d;
    }
    mesh.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    mesh.material.dispose?.();
    mesh.material = material;
  }
  return targets.length;
}
