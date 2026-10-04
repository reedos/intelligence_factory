// The data hall's rack faces, painted from the rack level's own layout. The hall draws one fixed slice (hall-slice.js),
// not a model of the scenario, but what each rack LOOKS like from the aisle is the rack level's elevation:
//   NVL72  nvl72-layout.js LAYOUT (bottom up: shelves, compute, switch, compute, shelves, management), the same rows
//          rack.js stacks; the old literal copy here and in build-hall-finish.py had one management unit, not two.
//   H100   dgx-h100-layout.js DGX_RACK: four closed 8U chassis behind metal-foam bezels with carry handles and a control
//          panel, one 1U management switch above them (rack.js buildHGX builds its closed servers from the same record).
// tools/blender/build-hall-finish.py reads the same numbers from tools/blender/references/hall-layout.json (written by
// export-native-reference.mjs --hall); hall-rack-face.test.ts keeps all four in step.
import { LAYOUT, trayY, U, RACK } from './nvl72-layout.js';
import { DGX_RACK, dgxServerY } from './dgx-h100-layout.js';

// The face plane hall.js lays over the cabinet: 0.52 m wide, from 5 cm above the floor to the rack's top (hall.js instanced()).
export const FACE = { w: 0.52, bottom: 0.05, top: RACK.H };
export const FACE_H = FACE.top - FACE.bottom;
const KIND = { ps: 'power', compute: 'compute', switch: 'switch', mgmt: 'management' };

/** NVL72 elevation as drawn on the hall face, bottom up: one entry per rack unit, y = the unit's center in meters. */
export const nvlFaceRows = () => LAYOUT.map((k, i) => ({ i, kind: KIND[k], y: trayY(i) }));
/** The DGX H100 elevation as drawn on the hall face: four chassis centers and the management switch above them. */
export const h100FaceServers = () => Array.from({ length: DGX_RACK.servers }, (_, k) => ({ k, y: dgxServerY(k) }));
export const h100FaceMgmtY = () => dgxServerY(DGX_RACK.servers - 1) + DGX_RACK.SU / 2 + 0.01 + U / 2;

// a small seeded generator so every build paints the same foam
function rng(seed) { let s = seed >>> 0; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; }

export function paintNvlFace(g, w, h) {
  g.fillStyle = '#121418'; g.fillRect(0, 0, w, h);
  const row = (y, hgt, fill, leds) => { g.fillStyle = fill; g.fillRect(8, y, w - 16, hgt - 2); for (let i = 0; i < leds; i++) { g.fillStyle = i % 5 === 0 ? '#5cf29a' : '#1e8a55'; g.fillRect(16 + i * 9, y + hgt / 2 - 1.5, 4, 3); } };
  const dy = U / FACE_H * h;
  for (const { kind, y: center } of nvlFaceRows()) {
    const y = (FACE.top - center - U / 2) / FACE_H * h;
    row(y, dy, kind === 'compute' ? '#1d2026' : kind === 'switch' ? '#23303a' : '#2a2e35', kind === 'switch' ? 14 : kind === 'power' ? 6 : 2);
    if (kind === 'compute') { g.fillStyle = '#2d323a'; for (let x = 60; x < w - 20; x += 7) g.fillRect(x, y + 3, 4, Math.max(1, dy - 7)); }
  }
  g.fillStyle = '#0b0c0e'; g.fillRect(0, 0, 8, h); g.fillRect(w - 8, 0, 8, h);
}

export function paintH100Face(g, w, h) {
  const X = m => (m / FACE.w + 0.5) * w, Y = m => (FACE.top - m) / FACE_H * h, SX = m => m / FACE.w * w, SY = m => m / FACE_H * h;
  g.fillStyle = '#121418'; g.fillRect(0, 0, w, h);
  const { bezel, ears, handle, panel, SU } = DGX_RACK, [fr, fg, fb] = bezel.rgb, r = rng(7);
  for (const { y } of h100FaceServers()) {
    // galvanized mounting ears, the chassis shell between them, then the foam bezel
    g.fillStyle = '#4b5159'; for (const ex of ears.x) g.fillRect(X(ex - ears.w / 2), Y(y + ears.h / 2), SX(ears.w), SY(ears.h));
    g.fillStyle = '#1b1d21'; g.fillRect(X(-bezel.w / 2 - 0.004), Y(y + SU * 0.49), SX(bezel.w + 0.008), SY(SU * 0.98));
    const bx = X(-bezel.w / 2), by = Y(y + bezel.h / 2), bw = SX(bezel.w), bh = SY(bezel.h);
    g.fillStyle = `rgb(${Math.round(fr * 0.86)},${Math.round(fg * 0.86)},${Math.round(fb * 0.86)})`; g.fillRect(bx, by, bw, bh);
    // open-cell foam at this distance: a fine web of lighter struts and dark pores
    for (let n = 0; n < 900; n++) {
      const dark = r() < 0.55, px = bx + 1 + r() * (bw - 3), py = by + 1 + r() * (bh - 3);
      g.fillStyle = dark ? `rgba(${Math.round(fr * 0.4)},${Math.round(fg * 0.4)},${Math.round(fb * 0.4)},0.7)` : `rgba(${Math.min(255, Math.round(fr * 1.08))},${Math.min(255, Math.round(fg * 1.08))},${Math.min(255, Math.round(fb * 1.08))},0.55)`;
      g.fillRect(px, py, 1 + (r() < 0.25 ? 1 : 0), 1);
    }
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(bx, by + bh - 2, bw, 2);
    // the carry handles' shadows and the control panel (the real handles are the relief in hall-finish.glb)
    g.fillStyle = '#2a2e35'; for (const hx of handle.x) g.fillRect(X(hx - handle.w / 2), Y(y + handle.dy + handle.h / 2), SX(handle.w), SY(handle.h));
    const px0 = X(panel.x - panel.w / 2), py0 = Y(y + panel.dy + panel.h / 2);
    g.fillStyle = '#0b0c0e'; g.fillRect(px0, py0, SX(panel.w), SY(panel.h));
    g.fillStyle = '#c7ccd2'; for (const [i, by2] of panel.buttonsDy.entries()) { if (i < 2) { g.beginPath(); g.arc(X(panel.x), Y(y + panel.dy + by2), Math.max(1, SX(0.005)), 0, Math.PI * 2); g.fill(); } }
    g.fillStyle = '#3a2508'; g.fillRect(X(panel.x) - 1, Y(y + panel.dy + panel.buttonsDy[2]) - 1, 2, 2);
  }
  // the 1U management switch above the top chassis
  const my = h100FaceMgmtY(), mh = SY(DGX_RACK.mgmt.h), mt = Y(my + U / 2);
  g.fillStyle = '#2a2e35'; g.fillRect(8, mt, w - 16, mh);
  g.fillStyle = '#0b0c0e'; for (let i = 0; i < 24; i++) g.fillRect(X(-0.19) + i * SX(0.0145), mt + mh * 0.3, SX(0.011), mh * 0.4);
  // blanking panels to the top, one rack unit each
  const top = my + U / 2;
  for (let y = top; y + U <= FACE.top - 0.05 + 1e-6; y += U) { g.fillStyle = '#16191e'; g.fillRect(8, Y(y + U) + 1, w - 16, SY(U) - 2); }
  g.fillStyle = '#0b0c0e'; g.fillRect(0, 0, 8, h); g.fillRect(w - 8, 0, 8, h);
}
