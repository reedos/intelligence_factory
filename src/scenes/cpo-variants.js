// The CPO level's two designs (Reed, 10/01/2026): the faces painted at runtime and the panel's words.
//   ring  NVIDIA-style: an electronic die stacked on a micro-ring photonic die, in NVIDIA's Quantum-X package
//   mzm   Broadcom-style: a 51.2T Bailly-class package of eight radial tiles, each an electronic die over the
//         electrical end of a photonic die with segmented Mach-Zehnder modulators (write-ups of Broadcom's ISSCC 2026
//         paper 23.4) and FR4 wavelength multiplexing (Broadcom's Bailly release)
// Layout numbers live in side-geometry.js (CPO_DIE, CPO_RING, CPO_MZM, CPO_EIC); floorplans are representative
// (evidence.js 'cpo-circuit-partition', 'cpo-bailly-layout'). Each design has its own parts in data.js.
import { THREE, canvasTex } from './side-kit.js';
import { CPO_VARIANTS, CPO_MZM, CPO_EIC, CPO_DIE, cpoBlocks } from './side-geometry.js';

export { CPO_VARIANTS };
export const CPO_VARIANT_COLOR = { ring: '#62e6ff', mzm: '#ffcf7a' };

// ---------- faces ----------
// An electronic die's canvas is sampled with u mirrored, like the original EIC face: canvas top is the die's +z edge
// (its receive side) and canvas left its fiber side, so the lettering reads from the default view, and a block drawn
// at eicPixel(kind, px, py) lies directly over photonic-frame pixel (px, py) once the die is bonded face-down over its
// rect (side-geometry CPO_EIC). Each canvas keeps its die's aspect.
export const EIC_CANVAS = { ring: [1024, 768], mzm: [1024, 1526] };
export function eicPixel(kind, px, py) {
  const [x0, y0, x1, y1] = CPO_EIC[kind], [W, H] = EIC_CANVAS[kind];
  return [(x1 - px) / (x1 - x0) * W, (y1 - py) / (y1 - y0) * H];
}
const srgb = v => Math.round(255 * Math.min(1, Math.max(0, v)) ** (1 / 2.2));
// Bare silicon, as side-kit's eicTex: scribe lane, seal ring, guard ring, a mirror-dark die with faint thin-film
// color, and standard-cell rows inside the circuit macros. `rects` are the macros, [x0, y0, x1, y1] in canvas px.
function bareSilicon(g, w, h, rects, seed = 29) {
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const mask = new Uint8Array(w * h);
  for (const [x0, y0, x1, y1] of rects) for (let y = Math.max(0, Math.ceil(y0)); y < Math.min(h, y1); y++) mask.fill(1, y * w + Math.max(0, Math.ceil(x0)), y * w + Math.max(0, Math.min(w, Math.ceil(x1))));
  const inMacro = (x, y) => mask[y * w + x] === 1;
  const img = g.createImageData(w, h), cellEdge = new Float32Array(w);
  const blocks = Array.from({ length: (h >> 4) + 1 }, () => Array.from({ length: (w >> 4) + 1 }, rnd));
  let row = -1;
  for (let y = 0; y < h; y++) {
    if ((y / 6 | 0) !== row) { row = y / 6 | 0; let x = 0; cellEdge.fill(0); while (x < w) { cellEdge[x] = 1; x += 3 + (rnd() * 14 | 0); } }
    for (let x = 0; x < w; x++) {
      const e = Math.min(x, w - 1 - x, y, h - 1 - y), n = (blocks[y >> 4][x >> 4] - .5) * .014;
      let c;
      if (e < 8) c = [.07 + n, .075 + n, .08 + n];
      else if (e < 22) c = (e % 3 === 0) ? [.11, .12, .13] : [.42 + n, .45 + n, .48 + n];
      else if (e < 26) c = [.025, .03, .04];
      else if (e < 29) c = [.30, .32, .35];
      else {
        const p = .8 * Math.sin(x * .0041 + y * .0029) + .5 * Math.sin(x * .0017 - y * .0053);
        const film = k => .018 * Math.cos(6.283 * (p + k));
        c = [.045 + n + film(0), .055 + n + film(.33), .075 + n + film(.67)];
        if (inMacro(x, y)) {
          const k = (y % 6 === 0 ? -.03 : 0) + (cellEdge[x] ? -.02 : 0) + ((x * 7 + row * 13) % 11 < 2 ? .012 : 0);
          c = [.085 + k + n, .095 + k + n, .11 + k + n];
        } else if (y % 10 === 0) c = c.map(v => v - .008);
      }
      const i = (y * w + x) * 4;
      img.data[i] = srgb(c[0]); img.data[i + 1] = srgb(c[1]); img.data[i + 2] = srgb(c[2]); img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  // alignment marks in the corners, inside the guard ring
  g.fillStyle = 'rgba(205,212,222,0.75)';
  for (const [ax, ay] of [[44, 38], [w - 44, 38], [44, h - 38], [w - 44, h - 38]]) { g.fillRect(ax - 9, ay - 1.5, 18, 3); g.fillRect(ax - 1.5, ay - 9, 3, 18); }
}
// One small analog macro: grid straps, a multi-finger output device and a two-turn inductor, the generic features
// side-kit's eicTex draws at its larger lane scale. Not this die's circuit.
function macro(g, [x0, y0, x1, y1]) {
  const W = x1 - x0, H = y1 - y0;
  g.fillStyle = 'rgba(190,198,212,0.24)';
  for (let x = x0 + 5; x < x1 - 2; x += 15) g.fillRect(x, y0, 1.5, H);
  const S = Math.min(H - 6, 20), ix = x0 + 4, iy = y0 + (H - S) / 2;
  g.fillStyle = '#0b0f16'; g.fillRect(ix - 2, iy - 2, S + 4, S + 4);
  g.fillStyle = 'rgba(214,170,112,0.92)';
  for (const k of [0, 4]) { g.fillRect(ix + k, iy + k, S - 2 * k, 2); g.fillRect(ix + S - k - 2, iy + k, 2, S - 2 * k); g.fillRect(ix + k, iy + S - k - 2, S - 2 * k, 2); g.fillRect(ix + k, iy + k + 4, 2, S - 2 * k - 4); }
  const dx = ix + S + 8;
  g.fillStyle = '#121822'; g.fillRect(dx, y0 + 4, x1 - dx - 4, H - 8);
  g.fillStyle = 'rgba(176,186,204,0.55)'; for (let x = dx + 3; x < x1 - 6; x += 4) g.fillRect(x, y0 + 6, 1.5, H - 12);
  g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(x0, y0, W, 1.5); g.fillRect(x0, y1 - 1.5, W, 1.5); g.fillRect(x0, y0, 1.5, H); g.fillRect(x1 - 1.5, y0, 1.5, H);
}
// One lane cell on the Mach-Zehnder die: a driver or TIA at the lane pitch, an output stage and a strap.
function laneCell(g, [x0, y0, x1, y1]) {
  g.fillStyle = '#121822'; g.fillRect(x0, y0, x1 - x0, y1 - y0);
  g.fillStyle = 'rgba(176,186,204,0.5)'; for (let x = x0 + 3; x < x1 - 3; x += 6) g.fillRect(x, y0 + 1.5, 1.5, y1 - y0 - 3);
  g.fillStyle = 'rgba(214,170,112,0.85)'; g.fillRect(x0, (y0 + y1) / 2 - 0.75, Math.min(14, x1 - x0), 1.5);
}
const around = (rects, pad) => [Math.min(...rects.map(r => r[0])) - pad, Math.min(...rects.map(r => r[1])) - pad, Math.max(...rects.map(r => r[2])) + pad, Math.max(...rects.map(r => r[3])) + pad];
const centered = ([cx, cy], w, h) => [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2];
// The electronic dies: each driver block centered over the modulator it drives (the ring; the middle of the
// Mach-Zehnder electrode run, which its block spans) and each TIA block over its photodiode, in lane order. The rest
// of the die holds representative support blocks, lettered as such: the host interface along the electrical edge,
// where the package traces land, then clocking, control, bias, test and power. On the Mach-Zehnder die the clocking,
// transmit DSP and ADC/DAC blocks are the ones the write-ups of Broadcom's paper list on its single die (a transmit
// PLL, a CDR and transmit DSP, ADC/DAC for photonic-die sensing and control); their placement is representative.
// Support blocks are rects in the photonic frame [x0, y0, x1, y1].
// The Mach-Zehnder die carries all 64 lanes each way, so its blocks are lane cells at the lane pitch (about 10 canvas
// px): a driver cell spanning each lane's three electrode segments, a TIA cell over each photodiode.
const BLOCK = { ring: { drv: [76, 30], tia: [64, 26] }, mzm: { drv: [590, 7.5], tia: [60, 7.5] } };
const SUPPORT = {
  ring: [['HOST I/O', [14, 30, 60, 360]], ['PLL · CLOCK', [75, 30, 170, 100]], ['CONTROL', [75, 115, 170, 190]],
    ['RING BIAS · HEATERS', [240, 30, 420, 95]], ['TEST', [240, 140, 420, 190]], ['POWER · DECAP', [75, 214, 330, 360]]],
  mzm: [['HOST I/O', [8, 12, 30, 288]], ['TX PLL', [40, 157, 150, 181]], ['TX DSP · CDR', [40, 187, 150, 211]],
    ['ADC/DAC · CONTROL', [40, 217, 150, 241]], ['TEST', [40, 247, 92, 287]], ['POWER · DECAP', [98, 247, 150, 287]]],
};
// Lettering for the driver and TIA groups, placed in free space beside them; the arrow points at the group as seen
// from the default view (canvas left is the die's fiber side).
const GROUP_TEXT = {
  ring: [['TX DRIVERS', [330, 117], [200, 117]], ['RX TIAs', [370, 290], [440, 290]]],
  mzm: [['TX DRIVERS', [174, 60], [140, 60]], ['RX TIAs', [100, 150], [170, 150]]],
};
const NOTE_AT = { ring: [250, 202], mzm: [174, 100] };
const toCanvasRect = (kind, [x0, y0, x1, y1]) => { const [a, b] = eicPixel(kind, x1, y1), [c, d] = eicPixel(kind, x0, y0); return [a, b, c, d]; };
export function eicBlocks(kind) {
  const b = cpoBlocks(kind), size = BLOCK[kind];
  return { drivers: b.drivers.map(p => centered(eicPixel(kind, ...p), ...size.drv)), tias: b.tias.map(p => centered(eicPixel(kind, ...p), ...size.tia)),
    support: SUPPORT[kind].map(([name, r]) => ({ name, rect: toCanvasRect(kind, r) })) };
}
function eicFaceTex(kind) {
  const [CW, CH] = EIC_CANVAS[kind];
  const t = canvasTex(CW, CH, (g, w, h) => {
    const { drivers, tias, support } = eicBlocks(kind), all = [...drivers, ...tias, ...support.map(s => s.rect)];
    bareSilicon(g, w, h, all);
    g.fillStyle = 'rgba(150,160,175,0.16)';
    for (let x = 64; x < w - 32; x += 64) g.fillRect(x, 32, 3, h - 64);
    for (let y = 48; y < h - 32; y += 48) g.fillRect(32, y, w - 64, 3);
    for (const r of [...drivers, ...tias]) (kind === 'mzm' ? laneCell : macro)(g, r);
    g.textBaseline = 'middle'; g.textAlign = 'center';
    for (const { name, rect: [x0, y0, x1, y1] } of support) {
      g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(x0, y0, x1 - x0, 1.5); g.fillRect(x0, y1 - 1.5, x1 - x0, 1.5); g.fillRect(x0, y0, 1.5, y1 - y0); g.fillRect(x1 - 1.5, y0, 1.5, y1 - y0);
      const vertical = x1 - x0 < 120, size = vertical ? 15 : 17;
      g.font = `600 ${size}px ui-monospace, Consolas, monospace`;
      g.fillStyle = 'rgba(8,10,16,0.6)';
      if (vertical) {   // a narrow block: one letter per line, top to bottom
        const chars = [...name.replace(/ /g, '')], top = (y0 + y1) / 2 - chars.length * size * .55;
        g.fillRect((x0 + x1) / 2 - size * .6, top - size * .6, size * 1.2, chars.length * size * 1.1 + size * .2);
        g.fillStyle = 'rgba(190,198,212,0.7)';
        chars.forEach((c, k) => g.fillText(c, (x0 + x1) / 2, top + k * size * 1.1));
      } else {
        const tw = g.measureText(name).width;
        g.fillRect((x0 + x1) / 2 - tw / 2 - 6, (y0 + y1) / 2 - size * .7, tw + 12, size * 1.4);
        g.fillStyle = 'rgba(190,198,212,0.7)'; g.fillText(name, (x0 + x1) / 2, (y0 + y1) / 2);
      }
    }
    g.lineWidth = 2.5;
    g.strokeStyle = 'rgba(98,230,255,0.7)';
    if (kind === 'mzm') { const tx = around(drivers, 4); g.strokeRect(tx[0], tx[1], tx[2] - tx[0], tx[3] - tx[1]); }   // lane cells at the lane pitch: one outline
    else for (const r of drivers) g.strokeRect(r[0] - 4, r[1] - 4, r[2] - r[0] + 8, r[3] - r[1] + 8);
    const rx = around(tias, 6); rx[1] = Math.max(31, rx[1]);
    g.strokeStyle = 'rgba(255,122,217,0.7)'; g.strokeRect(rx[0], rx[1], rx[2] - rx[0], rx[3] - rx[1]);
    g.font = '600 22px ui-monospace, Consolas, monospace';
    for (const [text, at, toward] of GROUP_TEXT[kind]) {
      const [cx, cy] = eicPixel(kind, ...at), [tx, ty] = eicPixel(kind, ...toward);
      const arrow = Math.abs(tx - cx) > Math.abs(ty - cy) ? (tx < cx ? '← ' : ' →') : (ty < cy ? ' ↑' : ' ↓');
      g.fillStyle = text.startsWith('TX') ? 'rgba(160,236,255,0.82)' : 'rgba(255,170,230,0.82)';
      g.fillText(arrow === '← ' ? arrow + text : text + arrow, cx, cy);
    }
    g.font = '500 16px ui-monospace, Consolas, monospace'; g.fillStyle = 'rgba(190,198,212,0.55)';
    g.fillText('EIC · blocks as drawn', ...eicPixel(kind, ...NOTE_AT[kind]));
  }, { repeat: [1, 1] });
  t.flipY = false; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.repeat.x = -1; t.offset.x = 1;
  return t;
}
export const ringEicTex = () => eicFaceTex('ring');
export const eicMzmTex = () => eicFaceTex('mzm');
// The Mach-Zehnder tile's photonic die face, frame 480 × 300 painted at 3 canvas px per frame px, drawn as the
// authored detail models it: all 64 lanes each way. Per FR4 group, a laser tap off its trunk into a wavelength
// demultiplexer, four lanes that split into two arms with electrode segments along them and a bias heater, rejoin,
// and meet in a multiplexer on one transmit fiber; receive through a demultiplexer to four photodiodes; edge couplers
// at the fiber edge. Painted onto the packaged tiles (sampled like the electronic die: u mirrored, canvas top the +z
// edge, so frame pixel (px, py) paints at (W - px, H - py)), and used whole on the native stand-in.
export const MZM_PIC_SCALE = 3;
export function mzmCpoPicTex() {
  const M = CPO_MZM, D = CPO_DIE.mzm, K = MZM_PIC_SCALE, W = D.fw * K, H = D.fh * K, P = (px, py) => [W - px * K, H - py * K];
  const t = canvasTex(W, H, (g) => {
    g.fillStyle = '#4a5468'; g.fillRect(0, 0, W, H); g.lineCap = 'round'; g.lineJoin = 'round';
    const line = (color, width, pts) => { g.strokeStyle = color; g.lineWidth = width; g.beginPath(); pts.forEach((q, k) => { const [x, y] = P(...q); if (k) g.lineTo(x, y); else g.moveTo(x, y); }); g.stroke(); };
    const rect = (color, [x0, y0, x1, y1]) => { const [a, b] = P(x1, y1); g.fillStyle = color; g.fillRect(a, b, (x1 - x0) * K, (y1 - y0) * K); };
    const amber = 'rgba(255,179,71,0.9)', cyan = 'rgba(98,230,255,0.95)', pink = 'rgba(255,122,217,0.9)', gold = 'rgba(201,161,74,0.9)';
    // the two laser buses, each to its trunk along the electrical end
    for (let f = 0; f < 2; f++) {
      const gs = Array.from({ length: M.groups }, (_, gi) => gi).filter(gi => M.feed(gi) === f), far = M.txOut(f ? gs[0] : gs.at(-1));
      line(amber, 2.5, [[M.coupler[1], M.lasers[f]], [M.trunkX, M.lasers[f]], [M.trunkX, far]]);
    }
    for (let gi = 0; gi < M.groups; gi++) {
      const dm = M.demux(gi), mx = M.mux(gi), rd = M.rxDemux(gi);
      line(amber, 1.5, [[M.trunkX, M.txOut(gi)], [dm[0], M.txOut(gi)]]);
      for (let i = 4 * gi; i < 4 * gi + 4; i++) {
        const y = M.row(i);
        line(amber, 1.2, [[dm[2], y], [M.split, y]]);
        line(cyan, 0.9, [[M.split, y], [M.armIn, y - M.arm], [M.armOut, y - M.arm], [M.join, y], [mx[0], y]]);
        line(cyan, 0.9, [[M.split, y], [M.armIn, y + M.arm], [M.armOut, y + M.arm], [M.join, y]]);
        for (let k = 0; k < M.segments; k++) { const [s0, s1] = M.seg(k); rect(gold, [s0, y - M.elecW / 2, s1, y + M.elecW / 2]); }
        rect('rgba(200,80,60,0.85)', [M.heater[0], y - M.elecW / 2, M.heater[1], y + M.elecW / 2]);
        const ry = M.rxRow(i);
        line(pink, 1.2, [[rd[0], ry], [M.pdX + M.pdW / 2, ry]]);
        rect('rgba(255,122,217,0.95)', [M.pdX - M.pdW / 2, ry - M.pdH / 2, M.pdX + M.pdW / 2, ry + M.pdH / 2]);
      }
      line(cyan, 2, [[mx[2], M.txOut(gi)], [M.coupler[1], M.txOut(gi)]]);
      line(pink, 2, [[M.coupler[1], M.rxIn(gi)], [rd[2], M.rxIn(gi)]]);
      for (const r of [dm, mx, rd]) rect('rgba(120,150,200,0.85)', r);
    }
    for (const y of [...M.lasers, ...Array.from({ length: M.groups }, (_, gi) => [M.txOut(gi), M.rxIn(gi)]).flat()])
      rect('rgba(220,235,245,0.8)', [M.coupler[0], y - 1.2, M.coupler[1], y + 1.2]);   // edge couplers
  });
  t.flipY = false; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.repeat.x = -1; t.offset.x = 1;
  return t;
}

// ---------- words ----------
// What the panel says in the Broadcom-style design. Its parts are its own (data.js, ids mzm-*); the NVIDIA-style
// design is the level's own text.
export const CPO_VARIANT_NAME = { ring: 'NVIDIA-style · micro-rings', mzm: 'Broadcom-style · Mach-Zehnder' };
export function cpoIntro(kind, mode) {
  if (kind !== 'mzm') return null;
  return {
    power: 'A Broadcom-style switch package, in the class of its 51.2T Bailly: eight 6.4 Tb/s optical engines around a Tomahawk 5 switch chip (8 × 6.4 Tb/s = 51.2 Tb/s), each a tile with its electronics at the switch-chip end and its fiber connector at the package edge. Each engine is fed from the package substrate like the switch chip. Remote laser modules at the front supply the light. The package’s size and layout are representative; the counts are Broadcom’s.',
    data: 'Lanes leave the switch chip’s SerDes through package traces to the electronic die of each of the eight tiles, whose drivers swing segmented Mach-Zehnder modulators on the photonic die below; multiplexers put four wavelengths on each transmit fiber, as 400G FR4 ports do: 16 ports per engine, 64 lanes × 100 Gb/s = 6.4 Tb/s each way. Receive light is split by wavelength to photodiodes whose TIAs, on the electronic die, drive the switch chip directly. Laser light arrives by fiber from the front panel.',
    heat: 'The switch chip and the eight engines share one package. Broadcom’s 51.2T reference system is air-cooled, so a finned heat sink is drawn over the package, in x-ray, with air through its channels; its shape is representative.',
  }[mode];
}
// The NVIDIA-style design's parts keep the level's own text.
export const cpoPartCopy = (kind, part) => part;
