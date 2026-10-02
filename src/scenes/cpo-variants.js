// The CPO level's three engine views (Reed, 10/01/2026), shared by the authored (Blender) and the native package:
//   ring  electronic die stacked on the photonic die, micro-ring modulators: the NVIDIA-style original drawing
//   mzm   electronic die stacked on the photonic die, segmented Mach-Zehnder modulators: Broadcom-style, as reported
//         from write-ups of its ISSCC 2026 paper 23.4 (Tencent Cloud developer community, SemiAnalysis)
//   mono  one die, drivers beside the rings and TIAs beside the photodiodes: Ranovus Odin / Ayar Labs TeraPHY-style
// Only the engines change. The package, its 18 engines, every count and the fibers stay NVIDIA's; floorplans are
// representative (evidence.js 'cpo-engine-variants'). Layout numbers live in side-geometry.js (CPO_MZM, CPO_MONO).
// Spec rows stay those of the shared cards (their evidence chips are keyed by position): data.js carries the rows
// for every view on each card, and this file changes only titles, kickers and bodies.
import { THREE, canvasTex } from './side-kit.js';
import { CPO_VARIANTS, CPO_MZM, CPO_MONO } from './side-geometry.js';

export { CPO_VARIANTS };
export const CPO_VARIANT_COLOR = { ring: '#62e6ff', mzm: '#ffcf7a', mono: '#8fd3ff' };

// ---------- faces ----------
// Engine dimensions in the package (cm), as build-cpo.py and side-cpo.js draw them; the 2.5x detail scales all four.
const PW = 1.35, PD = .95, EW = 1.23, ED = .902;
// A photonic-die pixel (the 512 × 384 RING frame) to the electronic die's canvas (1024 × 768, sampled with u
// mirrored, as eicTex: canvas top is the die's +z edge, its receive side). Used to put each driver and TIA macro
// directly over the pad it bonds to.
export function eicPixel(px, py) {
  const xl = -PW / 2 + px / 512 * PW, zl = -PD / 2 + py / 384 * PD;
  return [(0.5 - xl / EW) * 1024, (0.5 - zl / ED) * 768];
}
const srgb = v => Math.round(255 * Math.min(1, Math.max(0, v)) ** (1 / 2.2));
// Bare silicon, as side-kit's eicTex: scribe lane, seal ring, guard ring, a mirror-dark die with faint thin-film
// color, and standard-cell rows inside the circuit macros. `rects` are the macros, [x0, y0, x1, y1] in canvas px.
function bareSilicon(g, w, h, rects, seed = 29) {
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const inMacro = (x, y) => rects.some(([x0, y0, x1, y1]) => x >= x0 && x < x1 && y >= y0 && y < y1);
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
const around = (rects, pad) => [Math.min(...rects.map(r => r[0])) - pad, Math.min(...rects.map(r => r[1])) - pad, Math.max(...rects.map(r => r[2])) + pad, Math.max(...rects.map(r => r[3])) + pad];
const centered = ([cx, cy], w, h) => [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2];
// The Mach-Zehnder view's electronic die: per lane, three driver macros, one over each electrode segment's pad, and
// one TIA macro over each photodiode, plus one shared block (the write-ups list a transmit PLL, shared circuits and
// ADC/DAC blocks on the same die). Lane pitch follows the photonic die below.
export const MZM_EIC = {
  drivers: Array.from({ length: 8 }, (_, i) => Array.from({ length: CPO_MZM.segments }, (_, k) => centered(eicPixel(CPO_MZM.pad(k), CPO_MZM.row(i)), 104, 24))).flat(),
  tias: Array.from({ length: 8 }, (_, i) => centered(eicPixel(CPO_MZM.pdX, CPO_MZM.rxRow(i)), 104, 24)),
  shared: [380, 150, 640, 236],
};
export function eicMzmTex() {
  const t = canvasTex(1024, 768, (g, w, h) => {
    const { drivers, tias, shared } = MZM_EIC;
    bareSilicon(g, w, h, [...drivers, ...tias, shared]);
    g.fillStyle = 'rgba(150,160,175,0.16)';
    for (let x = 64; x < w - 32; x += 64) g.fillRect(x, 32, 3, h - 64);
    for (let y = 48; y < h - 32; y += 48) g.fillRect(32, y, w - 64, 3);
    for (const r of [...drivers, ...tias, shared]) macro(g, r);
    g.lineWidth = 2.5;
    const tx = around(drivers, 8), rx = around(tias, 6); rx[1] = Math.max(31, rx[1]);
    g.strokeStyle = 'rgba(98,230,255,0.7)'; g.strokeRect(tx[0], tx[1], tx[2] - tx[0], tx[3] - tx[1]);
    g.strokeStyle = 'rgba(255,122,217,0.7)'; g.strokeRect(rx[0], rx[1], rx[2] - rx[0], rx[3] - rx[1]);
    g.textBaseline = 'middle'; g.font = '600 24px ui-monospace, Consolas, monospace';
    g.textAlign = 'center'; g.fillStyle = 'rgba(160,236,255,0.78)';
    g.fillText('TX DRIVERS', 160, 500); g.fillText('3 per lane', 160, 534);
    g.textAlign = 'right'; g.fillStyle = 'rgba(255,170,230,0.78)'; g.fillText('RX TIAs ×8', rx[0] - 14, 300);
    g.textAlign = 'center'; g.fillStyle = 'rgba(190,198,212,0.6)'; g.font = '500 18px ui-monospace, Consolas, monospace';
    g.fillText('PLL · shared', (shared[0] + shared[2]) / 2, shared[3] + 18);
    g.textAlign = 'left'; g.fillStyle = 'rgba(190,198,212,0.5)'; g.fillText('EIC · as drawn', 48, 722);
  }, { repeat: [1, 1] });
  t.flipY = false; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.repeat.x = -1; t.offset.x = 1;
  return t;
}
// The one-die view's face: the photonics (laser bus, rings, lane waveguides, photodiodes) and the circuits beside
// them, all on one silicon die. Sampled like eicTex (u mirrored, canvas top = the die's +z edge), so a photonic-frame
// pixel (px, py) paints at (W - px·s, H - py·s) and the lettering reads from the default view. The Blender detail
// lays its 3D waveguides and rings over exactly these painted positions; the packaged engines show the face alone.
export const MONO_FACE = { w: 1024, h: 768, s: 2 };
export const monoAt = (px, py) => [MONO_FACE.w - px * MONO_FACE.s, MONO_FACE.h - py * MONO_FACE.s];
const monoRect = ([x0, y0, x1, y1]) => { const [a, b] = monoAt(x1, y1), [c, d] = monoAt(x0, y0); return [a, b, c, d]; };
export function monoFaceTex() {
  const t = canvasTex(MONO_FACE.w, MONO_FACE.h, (g, w, h) => {
    const O = CPO_MONO, s = MONO_FACE.s, drivers = Array.from({ length: 8 }, (_, i) => monoRect(O.driver(i))), tias = Array.from({ length: 8 }, (_, i) => monoRect(O.tia(i)));
    bareSilicon(g, w, h, [...drivers, ...tias], 41);
    for (const r of [...drivers, ...tias]) macro(g, r);
    g.lineCap = 'round'; g.lineJoin = 'round';
    const line = (color, width, pts) => { g.strokeStyle = color; g.lineWidth = width; g.beginPath(); pts.forEach(([px, py], k) => { const [x, y] = monoAt(px, py); if (k) g.lineTo(x, y); else g.moveTo(x, y); }); g.stroke(); };
    const amber = 'rgba(255,179,71,0.9)', cyan = 'rgba(98,230,255,0.95)', pink = 'rgba(255,122,217,0.9)', gold = 'rgba(214,170,112,0.95)';
    line(amber, 3 * s, [[506, O.busY], [O.manX, O.busY], [O.manX, O.row(7)]]);
    for (let i = 0; i < 8; i++) {
      const y = O.row(i), rx = O.ringX(i), d1 = O.driver(i)[2];
      line(amber, 3 * s, [[O.manX, y], [rx - 14, y]]);
      line(cyan, 3 * s, [[rx - 14, y], [506, y]]);
      const [cx, cy] = monoAt(rx, O.ringZ(i));
      g.strokeStyle = cyan; g.lineWidth = 2.5 * s; g.beginPath(); g.arc(cx, cy, O.ringR * s, 0, Math.PI * 2); g.stroke();
      line(gold, 1.5 * s, [[d1, O.ringZ(i)], [rx - O.ringR, O.ringZ(i)]]);   // the driver's own short metal to its ring
    }
    for (let i = 0; i < 8; i++) {
      const y = O.rxRow(i);
      line(pink, 3 * s, [[506, y], [O.pdX + 13, y]]);
      const [px0, py0] = monoAt(O.pdX + 13, y + 6); g.fillStyle = 'rgba(255,122,217,0.95)'; g.fillRect(px0, py0, 26 * s, 12 * s);   // germanium photodiode
      line(gold, 1.5 * s, [[O.pdX - 13, y], [O.tia(i)[2], y]]);   // photodiode to its TIA
    }
    g.lineWidth = 2;
    const rx = around(tias, 5);
    g.strokeStyle = 'rgba(98,230,255,0.55)';
    for (const r of drivers) g.strokeRect(r[0] - 3, r[1] - 3, r[2] - r[0] + 6, r[3] - r[1] + 6);
    g.strokeStyle = 'rgba(255,122,217,0.6)'; g.strokeRect(rx[0], rx[1], rx[2] - rx[0], rx[3] - rx[1]);
    g.textBaseline = 'middle'; g.textAlign = 'center';
    g.fillStyle = 'rgba(190,198,212,0.62)'; g.font = '600 17px ui-monospace, Consolas, monospace';
    const [, my] = monoAt(0, (O.row(7) + O.rxRow(0)) / 2);
    g.fillText('ONE DIE · drivers beside rings · TIAs beside photodiodes', w / 2, my);
    g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(0, 0, 12, h);   // the fiber-coupling edge (+x local, the die's right in the frame)
  }, { repeat: [1, 1] });
  t.flipY = false; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.repeat.x = -1; t.offset.x = 1;
  return t;
}
// The native package's flat stand-in for the Mach-Zehnder photonic die, drawn in ringPicTex's frame and convention
// (the authored build models the same layout in 3D).
export function mzmCpoPicTex() {
  return canvasTex(512, 384, (g, w, h) => {
    const M = CPO_MZM;
    g.fillStyle = '#4a5468'; g.fillRect(0, 0, w, h); g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = 'rgba(255,179,71,0.9)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(w - 12, M.busY); g.lineTo(M.manX, M.busY); g.lineTo(M.manX, M.row(7)); g.stroke();
    for (let i = 0; i < 8; i++) {
      const y = M.row(i);
      g.strokeStyle = 'rgba(255,179,71,0.9)'; g.lineWidth = 3; g.beginPath(); g.moveTo(M.manX, y); g.lineTo(M.split, y); g.stroke();
      g.strokeStyle = 'rgba(98,230,255,0.95)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(M.split, y); g.lineTo(M.armIn, y - M.arm); g.lineTo(M.armOut, y - M.arm); g.lineTo(M.join, y); g.lineTo(w - 12, y); g.stroke();
      g.beginPath(); g.moveTo(M.split, y); g.lineTo(M.armIn, y + M.arm); g.lineTo(M.armOut, y + M.arm); g.lineTo(M.join, y); g.stroke();
      g.fillStyle = 'rgba(201,161,74,0.9)';
      for (let k = 0; k < M.segments; k++) { const [a, b] = M.seg(k); g.fillRect(a, y - M.segW / 2, b - a, M.segW); }
    }
    g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(0, (M.row(7) + M.rxRow(0)) / 2, w, 2);
    for (let i = 0; i < 8; i++) {
      const y = M.rxRow(i);
      g.strokeStyle = 'rgba(255,122,217,0.9)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(w - 12, y); g.lineTo(90, y); g.stroke();
      g.fillStyle = 'rgba(255,122,217,0.95)'; g.fillRect(64, y - 6, 26, 12);
    }
    g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(w - 12, 0, 12, h);
  });
}

// ---------- words ----------
// What the panel says in each view. The ring view is the level's own text (data.js); the others replace titles,
// kickers and bodies only.
export const CPO_VARIANT_NAME = { ring: 'Rings, stacked', mzm: 'Mach-Zehnder, stacked', mono: 'One die' };
export function cpoIntro(kind, mode) {
  if (kind === 'mzm') return {
    power: 'Mach-Zehnder view: the same package and counts, with each engine drawn Broadcom-style. An electronic die still sits on a photonic die, but the photonic die modulates with Mach-Zehnder interferometers instead of rings, so its lanes run long and its drivers sit along them. The package’s size and counts stay NVIDIA’s; the engine floorplan is representative.',
    data: 'Mach-Zehnder view, Broadcom-style as reported from its ISSCC 2026 paper: lanes leave the switch chip through package traces to each engine’s electronic die, whose drivers swing segmented Mach-Zehnder modulators on the photonic die below. Photodiodes there read incoming light for TIAs on the same electronic die. Eight lanes each way are drawn, as in the other views; Broadcom’s engine carries 64. Laser light still arrives by fiber from the front panel.',
    heat: 'Mach-Zehnder view: the switch chip and every engine still sit in one package under one cold plate; only the engines’ modulators and their drivers are drawn differently. The cold plate drawn is representative.',
  }[mode];
  if (kind === 'mono') return {
    power: 'One-die view, in the style of Ranovus Odin and Ayar Labs’ monolithic chips: each engine is a single die, its drivers and TIAs built on the same silicon as its ring modulators and photodiodes. No electronic die is stacked on top. The package’s size and counts stay NVIDIA’s; the floorplan is representative.',
    data: 'One-die view: lanes leave the switch chip through package traces to each engine’s single die, where a driver beside each ring modulator swings it and a TIA beside each photodiode amplifies its current. No bond joins two chips; the circuits sit side by side on one die. Laser light still arrives by fiber from the front panel.',
    heat: 'One-die view: each engine’s electronics and photonics share one die, and the switch chip and every engine still sit in one package under one cold plate. The cold plate drawn is representative.',
  }[mode];
  return null;
}
export function cpoPartCopy(kind, part, mode) {
  if (kind === 'mzm') {
    if (part.id === 'engine') return { ...part, body: 'Each engine, drawn Broadcom-style, is an electronic chip bonded on top of a photonic chip that modulates with Mach-Zehnder interferometers, fed from the package substrate like the switch chip beside it. The counts stay NVIDIA’s: 18 engines, each doing the work of one 1.6T module.' };
    if (part.id === 'eic') return { ...part, kicker: 'One die drives every lane', body: 'In this Mach-Zehnder view the electronic die holds three driver blocks per lane, one over each electrode segment of that lane’s modulator, and one TIA over each photodiode, plus a shared block. That follows the write-ups of Broadcom’s ISSCC 2026 paper 23.4: one 7 nm die carries all 64 transmit and receive channels and a transmit PLL, retimes transmit before its segmented MZM drivers, and sends each TIA’s output straight to the switch chip through the package substrate. The write-ups place this engine in Broadcom’s 51.2T (Tomahawk 5) generation, at 106.25 Gb/s per lane. Short bonds join it to the photonic die below. Eight lanes each way are drawn; the floorplan is representative.' };
    if (part.id === 'rings') return { ...part, title: 'Mach-Zehnder modulators', kicker: 'Transmit', body: 'Each lane splits its laser light into two long arms and joins it again. The drive voltage shifts the light’s phase in the arms, so the rejoined light brightens or dims with the data. Broadcom’s modulators, as reported, are driven in three segments each: one for the PAM4 signal’s low bit, two for its high bit. Mach-Zehnder modulators are far longer than rings; these arms are drawn many times a ring’s size but not to scale, and the arrangement is representative.' };
    if (part.id === 'pd') return { ...part, body: 'Incoming light reaches photodiodes on the photonic die. Short bonds carry their currents up to TIAs on the electronic die, which, in Broadcom’s design as reported, send their outputs straight to the switch chip through the package substrate with no retiming on the way. Placement is representative.' };
    if (part.id === 'asic' && mode === 'heat') return { ...part, body: 'The switch chip and the optical engines around it share one package, and their heat goes up into one cold plate, whichever modulators the engines use.' };
    return part;
  }
  if (kind === 'mono') {
    if (part.id === 'engine') return { ...part, body: 'Each engine, drawn in the one-die style, is a single chip holding both its electronics and its photonics, fed from the package substrate like the switch chip beside it. The counts stay NVIDIA’s: 18 engines, each doing the work of one 1.6T module.' };
    if (part.id === 'eic') return { ...part, title: 'Drivers and TIAs, on the same die', kicker: 'No separate electronic chip', body: 'In the one-die view no electronic chip is stacked on top. Each ring modulator has its driver beside it on the same silicon, and each photodiode its TIA. Ranovus describes its Odin engine as a monolithic electronic and photonic integrated circuit with RF drivers, TIAs and control logic; Ayar Labs has called its approach a micro-ring based monolithic electronic/photonic solution, and says later TeraPHY designs can move the electronics to a separate CMOS die. Block placement is representative.' };
    if (part.id === 'rings') return { ...part, kicker: 'Transmit, each driver beside its ring', body: 'As in the stacked view, each ring sits beside a waveguide carrying laser light and changes how much of it passes. Here its driver is on the same die, right next to it, joined by on-chip metal instead of a bond between two chips. Ranovus names micro-ring modulators for Odin; Ayar Labs calls its approach micro-ring based. The ring arrangement is representative.' };
    if (part.id === 'pd') return { ...part, body: 'Incoming light reaches photodiodes on the die, and each photodiode’s current goes straight to a TIA beside it on the same silicon; nothing is bonded between two chips. Placement is representative.' };
    if (part.id === 'asic' && mode === 'heat') return { ...part, body: 'The switch chip and the optical engines around it share one package, and their heat goes up into one cold plate. In the one-die view each engine’s circuits and photonics share one die.' };
    return part;
  }
  return part;
}
