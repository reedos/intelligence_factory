// Shared parts for the side levels inside the links: the module, the CPO package, the coherent module and the copper
// cables, each its own diagram. World unit = 1 cm, as on the GPU package level.
// Drawing rules every side level follows (Reed, 09/28):
//   - electrical paths are copper: traces on a board or substrate, bond wires where a chip meets the photonics;
//   - light runs in glass: waveguides drawn on a photonic chip, fibers as pale glass strands tinted by what they carry;
//   - transmit and receive are separate chains, transmit on the far side (z < 0), receive on the near side (z > 0);
//   - what has a published size is drawn to it, and each diagram says which parts those are.
import { THREE, MAT, Builder, flow, canvasTex, glowMat, textSprite } from '../kit.js';
export { THREE, MAT, Builder, flow, canvasTex, glowMat, textSprite };

export const COL = { tx: '#62e6ff', rx: '#ff7ad9', cw: '#ffb347', elec: '#a6f35a' };
export const note = '#8a96a8', unitCol = '#9ff1ff';

export function setup(quality, extent = 14) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x080b11);
  scene.add(new THREE.HemisphereLight(0xb5c3e6, 0x111317, 0.8));
  const key = new THREE.DirectionalLight(0xfff0de, 2.0); key.position.set(-6, 14, 5);
  if (quality.shadows) { key.castShadow = true; key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent, near: 1, far: 50 }); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.01; }
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x7aa6ff, 1.2); rim.position.set(-8, 5, -9); scene.add(rim);
  return scene;
}

export function materials() {
  const glassFiber = (hex, glow) => new THREE.MeshStandardMaterial({ color: hex, emissive: glow, emissiveIntensity: 0.35, roughness: 0.15, metalness: 0, transparent: true, opacity: 0.85 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xbfe6ff, transmission: 0.8, roughness: 0.08, thickness: 0.2, transparent: true, opacity: 0.55 });
  // PCF shadow depth ignores this glass's transmission and alpha. Keep the
  // ferrules/splitter visible without projecting an opaque rectangular shadow.
  glass.userData.ifxCastShadow = false;
  return {
    dieSide: new THREE.MeshStandardMaterial({ color: 0x3b4262, roughness: 0.3, metalness: 0.6 }),
    fiberTx: glassFiber(0xc8f6ff, 0x62e6ff),
    fiberRx: glassFiber(0xffd6f2, 0xff7ad9),
    fiberCw: glassFiber(0xffe2b8, 0xffb347),
    glass,
    lid: new THREE.MeshPhysicalMaterial({ color: 0xb8c0c8, metalness: 0.7, roughness: 0.4, envMapIntensity: 0.4, transparent: true, opacity: 0.14, depthWrite: false }),
    bond: MAT.gold,
    trace: MAT.copper,
  };
}

// a chip: sides plain, its top face textured
export function die(scene, M, w, h, d, map, x, y, z, ry = 0, extra = {}) {
  const top = new THREE.MeshStandardMaterial({ map, roughness: 0.32, metalness: 0.42, envMapIntensity: 0.5, emissive: 0xff6a1a, emissiveIntensity: 0, ...extra });
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [M.dieSide, M.dieSide, top, M.dieSide, M.dieSide, M.dieSide]);
  m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = true; scene.add(m);
  return top;
}
// a polyline of struts: a fiber, or a trace that climbs
export function strand(B, pts, mat, r = 0.01, seg = 5) { for (let i = 0; i < pts.length - 1; i++) B.strut(pts[i], pts[i + 1], r, mat, seg); }
// a flat copper trace on a board from a to b (both at the board's surface height y)
export function trace(B, [x0, z0], [x1, z1], y, w = 0.028) {
  const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz); if (L < 1e-6) return;
  B.box(L, 0.004, w, MAT.copper, (x0 + x1) / 2, y, (z0 + z1) / 2, -Math.atan2(dz, dx));
}
// a gold bond wire from a chip's pad to another's, arched
export function bondWire(B, a, b, h = 0.12) {
  const m1 = [a[0] + (b[0] - a[0]) * 0.25, Math.max(a[1], b[1]) + h, a[2] + (b[2] - a[2]) * 0.25], m2 = [a[0] + (b[0] - a[0]) * 0.75, Math.max(a[1], b[1]) + h * 0.8, a[2] + (b[2] - a[2]) * 0.75];
  strand(B, [a, m1, m2, b], MAT.gold, 0.0045, 4);
}
export function label(scene, text, pos, color = '#e8ecf2', h = 0.3) { const s = textSprite(text, color, h); s.userData.caption = { text, color, height: h }; s.position.set(...pos); scene.add(s); return s; }
export function outline(scene, geo, pos, color = 0x62e6ff, opacity = 0.9, rotY = 0) {
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color, transparent: true, opacity })); e.position.set(...pos); e.rotation.y = rotY; scene.add(e); return e;
}
export function lidBox(scene, M, w, d, pos) {
  const lid = new THREE.Mesh(new THREE.BoxGeometry(w, 0.14, d), M.lid); lid.position.set(...pos); scene.add(lid);
  outline(scene, lid.geometry, pos, 0xc9d3dc, 0.55);
  return lid;
}
// flows ride exactly on the drawn paths; `opts` sets how they look, by kind
export const FLOW = {
  elec: { count: 3, speed: 1.5, size: 0.028, k: 2.8, trail: false },
  light: { count: 4, speed: 1.9, size: 0.032, k: 3.2, trailR: 0.007, trailK: 0.3 },
  cw: { count: 3, speed: 1.2, size: 0.028, k: 2.6, trail: false },
  power: { count: 3, speed: 1.4, size: 0.032, k: 2.6, trail: false },
  heat: { count: 3, speed: 1.0, size: 0.04, k: 2.6, trail: false },
};

// ---------- textures ----------
// canvas top = the far side (z < 0) of the chip = transmit; canvas left = the chip's -x edge
export function dspTex() {
  return canvasTex(512, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#2a3358'); gr.addColorStop(0.5, '#3f4f82'); gr.addColorStop(1, '#262d52');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) {                                           // host-side SerDes (left), line-side (right): transmit above, receive below
      const y = i < 4 ? 30 + i * 52 : 282 + (i - 4) * 52;
      g.fillStyle = i < 4 ? 'rgba(166,243,90,0.4)' : 'rgba(166,243,90,0.25)'; g.fillRect(8, y, 50, 38); g.fillRect(w - 58, y, 50, 38);
    }
    for (let r = 0; r < 6; r++) for (let c = 0; c < 5; c++) { g.fillStyle = `rgba(200,215,255,${0.08 + ((r + c) % 3) * 0.03})`; g.fillRect(84 + c * 70, 40 + r * 74, 60, 62); }
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(70, h / 2 - 2, w - 140, 4);   // the transmit / receive divide
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 3; g.strokeRect(4, 4, w - 8, h - 8);
  });
}
// the module's silicon photonics chip. Transmit above: four lasers butt-coupled at the left edge, each split in two
// for its own pair of lanes, so no waveguide crosses another; eight Mach-Zehnder modulators; the driver's bond pads sit
// just ahead of each modulator's electrodes. Receive below: eight waveguides from the fiber edge to germanium
// photodiodes at the left, beside the TIA's bond pads.
export const MZM = { w: 640, h: 544, row: i => 26 + i * 28, laserY: k => 40 + k * 56, split: 60, mzIn: 250, mzOut: 440, arm: 7, padX: 232, rxRow: i => 296 + i * 30, pdX: 68, rxPadX: 25 };
export function mzmPicTex() {
  return canvasTex(MZM.w, MZM.h, (g, w, h) => {
    g.fillStyle = '#4a5468'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < 42; i++) g.fillRect(0, i * 13, w, 1);
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (let k = 0; k < 4; k++) {                                            // a laser input, split into its two lanes
      const y = MZM.laserY(k), a = MZM.row(2 * k), b = MZM.row(2 * k + 1);
      g.strokeStyle = 'rgba(255,179,71,0.9)'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(0, y); g.lineTo(MZM.split, y); g.lineTo(MZM.split + 30, a); g.lineTo(MZM.mzIn, a); g.moveTo(MZM.split, y); g.lineTo(MZM.split + 30, b); g.lineTo(MZM.mzIn, b); g.stroke();
    }
    for (let i = 0; i < 8; i++) {
      const y = MZM.row(i), A = MZM.arm;
      g.strokeStyle = 'rgba(98,230,255,0.95)'; g.lineWidth = 2.5;           // Mach-Zehnder: split, two arms, recombine
      g.beginPath(); g.moveTo(MZM.mzIn, y); g.lineTo(MZM.mzIn + 20, y - A); g.lineTo(MZM.mzOut - 20, y - A); g.lineTo(MZM.mzOut, y); g.moveTo(MZM.mzIn, y); g.lineTo(MZM.mzIn + 20, y + A); g.lineTo(MZM.mzOut - 20, y + A); g.lineTo(MZM.mzOut, y); g.lineTo(w - 14, y); g.stroke();
      g.fillStyle = 'rgba(201,161,74,0.85)'; g.fillRect(MZM.mzIn + 26, y - A - 6, MZM.mzOut - MZM.mzIn - 52, 3); g.fillRect(MZM.mzIn + 26, y + A + 3, MZM.mzOut - MZM.mzIn - 52, 3);   // electrodes
      g.fillStyle = 'rgba(201,161,74,0.95)'; g.fillRect(MZM.padX - 8, y - 12, 16, 8);                                          // the driver's bond pad
      g.strokeStyle = 'rgba(201,161,74,0.7)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(MZM.padX + 8, y - 8); g.lineTo(MZM.mzIn + 26, y - A - 5); g.stroke();
    }
    g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(0, (MZM.row(7) + MZM.rxRow(0)) / 2, w, 2);   // the divide
    for (let i = 0; i < 8; i++) {
      const y = MZM.rxRow(i);
      g.strokeStyle = 'rgba(255,122,217,0.9)'; g.lineWidth = 3; g.beginPath(); g.moveTo(w - 14, y); g.lineTo(MZM.pdX + 16, y); g.stroke();
      g.fillStyle = 'rgba(255,122,217,0.95)'; g.fillRect(MZM.pdX - 16, y - 9, 32, 18);    // germanium photodiode
      g.fillStyle = 'rgba(201,161,74,0.9)'; g.fillRect(14, y - 6, 22, 12);             // the TIA's bond pad
    }
    g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(w - 14, 0, 14, h);             // the fiber-coupling edge
  });
}
// a CPO engine's photonic chip, representative (not NVIDIA's floorplan). Transmit: laser light comes in on a bus
// along the top edge, a manifold at the left splits it into eight lane waveguides, and each lane passes its own
// micro-ring, drawn beside the waveguide with a coupling gap, then carries on to its fiber (the ring modulates the
// light passing it; the output is the same waveguide). Receive: eight waveguides from the fiber edge to photodiodes.
// Each ring's bond to the driver above sits beside the ring, level with its center: between its own waveguide and the
// previous lane's, clear of both (a pad above the ring would land on the previous lane's waveguide, 20 px up).
export const RING = { busY: 24, manX: 24, row: i => 50 + i * 20, ringX: i => 110 + i * 40, ringR: 6, ringGap: 4, rxRow: i => 214 + i * 20, pdX: 77, w: 512, h: 384,
  bondAt: i => [110 + i * 40 + 13, 50 + i * 20 - 10] };
export function ringPicTex() {
  return canvasTex(RING.w, RING.h, (g, w, h) => {
    g.fillStyle = '#4a5468'; g.fillRect(0, 0, w, h); g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = 'rgba(255,179,71,0.9)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(w - 12, RING.busY); g.lineTo(RING.manX, RING.busY); g.lineTo(RING.manX, RING.row(7)); g.stroke();   // bus and manifold
    for (let i = 0; i < 8; i++) {
      const y = RING.row(i), rx = RING.ringX(i);
      g.strokeStyle = 'rgba(255,179,71,0.9)'; g.beginPath(); g.moveTo(RING.manX, y); g.lineTo(rx - 14, y); g.stroke();   // unmodulated, up to the ring
      g.strokeStyle = 'rgba(98,230,255,0.95)'; g.lineWidth = 3; g.beginPath(); g.moveTo(rx - 14, y); g.lineTo(w - 12, y); g.stroke();   // modulated, past it
      g.lineWidth = 2.5; g.beginPath(); g.arc(rx, y - RING.ringR - RING.ringGap, RING.ringR, 0, Math.PI * 2); g.stroke();       // the ring, a gap above
      const [bx, by] = RING.bondAt(i); g.fillStyle = 'rgba(201,161,74,0.9)'; g.fillRect(bx - 3, by - 3, 6, 6);   // its bond to the driver above
      g.strokeStyle = 'rgba(98,230,255,0.95)'; g.lineWidth = 3;
    }
    g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(0, (RING.row(7) + RING.rxRow(0)) / 2, w, 2);
    for (let i = 0; i < 8; i++) {
      const y = RING.rxRow(i);
      g.strokeStyle = 'rgba(255,122,217,0.9)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(w - 12, y); g.lineTo(90, y); g.stroke();
      g.fillStyle = 'rgba(255,122,217,0.95)'; g.fillRect(64, y - 6, 26, 12);
    }
    g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(w - 12, 0, 12, h);
  });
}
// A CPO engine's electronic chip as bare silicon, representative (no floorplan is published): scribe margin, seal
// ring and guard ring at the edge, alignment marks in the corners, a mirror-dark die with faint thin-film color, and
// one analog macro per lane, eight transmit drivers and eight receive TIAs. Each macro is drawn with generic
// standard-cell rows, a multi-finger output device, a capacitor array, one spiral inductor (a common peaking
// element, not a claimed circuit) and a top-metal power grid. Driver and TIA blocks are circuit regions of this one
// die, outlined thinly in the transmit and receive colors and marked in small die lettering, not separate chips.
// Canvas top is the die's +z edge (receive) with flipY off, so the GLB's 0-1 top UVs and the native box agree; the
// texture's u is mirrored so the lettering reads from the viewer's side, and the canvas is drawn mirrored to match.
// Lane columns keep the layout the Blender detail was built on: centers at (23 + 29i)/256 of the width.
export const EIC = { w: 1024, h: 768, laneX: i => (23 + i * 29) * 4, laneW: 88, rx: [53, 329], tx: [415, 690] };
export function eicTex() {
  const t = canvasTex(EIC.w, EIC.h, (g, w, h) => {
    let seed = 29; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const lanes = Array.from({ length: 8 }, (_, i) => w - EIC.laneX(i) - EIC.laneW / 2).reverse();   // drawn mirrored, left to right
    const inMacro = (x, y) => lanes.some(l => x >= l && x < l + EIC.laneW) && ((y >= EIC.rx[0] && y < EIC.rx[1]) || (y >= EIC.tx[0] && y < EIC.tx[1]));
    // per-pixel base: scribe, seal ring, guard ring, silicon with thin-film tint, cell rows inside the macros
    const img = g.createImageData(w, h), cellEdge = new Float32Array(w);
    const blocks = Array.from({ length: (h >> 4) + 1 }, () => Array.from({ length: (w >> 4) + 1 }, rnd));
    const srgb = v => Math.round(255 * Math.min(1, Math.max(0, v)) ** (1 / 2.2));
    let row = -1;
    for (let y = 0; y < h; y++) {
      if ((y / 6 | 0) !== row) { row = y / 6 | 0; let x = 0; cellEdge.fill(0); while (x < w) { cellEdge[x] = 1; x += 3 + (rnd() * 14 | 0); } }
      for (let x = 0; x < w; x++) {
        const e = Math.min(x, w - 1 - x, y, h - 1 - y), n = (blocks[y >> 4][x >> 4] - .5) * .014;
        let c;
        if (e < 8) c = [.07 + n, .075 + n, .08 + n];                                         // scribe lane, matte
        else if (e < 22) c = (e % 3 === 0) ? [.11, .12, .13] : [.42 + n, .45 + n, .48 + n];  // seal ring, stacked metal
        else if (e < 26) c = [.025, .03, .04];
        else if (e < 29) c = [.30, .32, .35];                                               // guard ring
        else {
          const p = .8 * Math.sin(x * .0041 + y * .0029) + .5 * Math.sin(x * .0017 - y * .0053);
          const film = k => .018 * Math.cos(6.283 * (p + k));                                // thin-film interference tint
          c = [.045 + n + film(0), .055 + n + film(.33), .075 + n + film(.67)];
          if (inMacro(x, y)) {
            const k = (y % 6 === 0 ? -.03 : 0) + (cellEdge[x] ? -.02 : 0) + ((x * 7 + row * 13) % 11 < 2 ? .012 : 0);
            c = [.085 + k + n, .095 + k + n, .11 + k + n];
          } else if (y % 10 === 0) c = c.map(v => v - .008);                                // fill / decap rows
        }
        const i = (y * w + x) * 4;
        img.data[i] = srgb(c[0]); img.data[i + 1] = srgb(c[1]); img.data[i + 2] = srgb(c[2]); img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    // alignment marks, one cross and an L in each corner inside the guard ring
    g.fillStyle = 'rgba(205,212,222,0.75)';
    for (const [ax, ay, sx, sy] of [[44, 38, 1, 1], [w - 44, 38, -1, 1], [44, h - 38, 1, -1], [w - 44, h - 38, -1, -1]]) {
      g.fillRect(ax - 9, ay - 1.5, 18, 3); g.fillRect(ax - 1.5, ay - 9, 3, 18);
      g.fillRect(ax + sx * 14 - (sx < 0 ? 10 : 0), ay + sy * 10, 10, 2); g.fillRect(ax + sx * 14 - (sx < 0 ? 2 : 0), ay + sy * 10 - (sy < 0 ? 8 : 0), 2, 10);
    }
    // global top-metal power grid
    g.fillStyle = 'rgba(150,160,175,0.16)';
    for (let x = 64; x < w - 32; x += 64) g.fillRect(x, 32, 3, h - 64);
    for (let y = 48; y < h - 32; y += 48) g.fillRect(32, y, w - 64, 3);
    for (const [y0, y1, tx] of [[EIC.rx[0], EIC.rx[1], false], [EIC.tx[0], EIC.tx[1], true]]) {
      for (const lx of lanes) {
        const W = EIC.laneW, H = y1 - y0;
        // denser lane grid straps
        g.fillStyle = 'rgba(190,198,212,0.26)';
        for (let x = lx + 6; x < lx + W - 2; x += 19) g.fillRect(x, y0, 2, H);
        for (let y = y0 + 8; y < y1 - 2; y += 26) g.fillRect(lx, y, W, 2);
        // spiral inductor near the bond edge, in a metal keep-out
        const S = 62, ix = lx + (W - S) / 2, iy = tx ? y1 - S - 12 : y0 + 12;
        g.fillStyle = '#0b0f16'; g.fillRect(ix - 4, iy - 4, S + 8, S + 8);
        g.fillStyle = 'rgba(214,170,112,0.92)';
        const tw = 4, st = 8, sp = [[ix, iy + S]];
        for (let k = 0; k < 3; k++) {
          const l = ix + k * st, t0 = iy + k * st, r = ix + S - tw - k * st, b = iy + S - tw - k * st;
          sp.push([l, t0], [r, t0], [r, b], [l + st, b]);
        }
        for (let k = 1; k < sp.length; k++) {
          const [x0, y0_] = sp[k - 1], [x1, y1_] = sp[k];
          g.fillRect(Math.min(x0, x1), Math.min(y0_, y1_), Math.abs(x1 - x0) + tw, Math.abs(y1_ - y0_) + tw);
        }
        g.fillRect(ix + S / 2 - 4, iy + S / 2 - 4, 8, 8);                                    // center tap via
        // multi-finger output device and a capacitor array, mid-macro
        const dy = tx ? y0 + 30 : y1 - 70;
        g.fillStyle = '#121822'; g.fillRect(lx + 10, dy, W - 20, 40);
        g.fillStyle = 'rgba(176,186,204,0.55)'; for (let x = lx + 13; x < lx + W - 12; x += 4) g.fillRect(x, dy + 3, 1.5, 34);
        const cy = tx ? y0 + 84 : y1 - 124;
        g.fillStyle = 'rgba(120,132,160,0.5)';
        for (let r = 0; r < 4; r++) for (let q = 0; q < 6; q++) g.fillRect(lx + 12 + q * 11, cy + r * 11, 8, 8);
        // macro boundary, a dark hairline
        g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(lx, y0, W, 1.5); g.fillRect(lx, y1 - 1.5, W, 1.5); g.fillRect(lx, y0, 1.5, H); g.fillRect(lx + W - 1.5, y0, 1.5, H);
      }
    }
    // thin data-layer outlines around each block region: receive TIAs (magenta), transmit drivers (cyan)
    g.lineWidth = 2.5;
    g.strokeStyle = 'rgba(255,122,217,0.7)'; g.strokeRect(lanes[0] - 8, EIC.rx[0] - 8, lanes[7] + EIC.laneW - lanes[0] + 16, EIC.rx[1] - EIC.rx[0] + 16);
    g.strokeStyle = 'rgba(98,230,255,0.7)'; g.strokeRect(lanes[0] - 8, EIC.tx[0] - 8, lanes[7] + EIC.laneW - lanes[0] + 16, EIC.tx[1] - EIC.tx[0] + 16);
    // die lettering in the band between the two regions
    g.font = '600 26px ui-monospace, Consolas, monospace'; g.textBaseline = 'middle'; g.textAlign = 'left';
    g.fillStyle = 'rgba(255,170,230,0.78)'; g.fillText('RX TIAs ×8', lanes[0], EIC.rx[1] + 30);
    g.fillStyle = 'rgba(160,236,255,0.78)'; g.fillText('TX DRIVERS ×8', lanes[0], EIC.tx[0] - 30);
    g.textAlign = 'right'; g.fillStyle = 'rgba(190,198,212,0.5)'; g.font = '500 18px ui-monospace, Consolas, monospace';
    g.fillText('EIC · as drawn', lanes[7] + EIC.laneW, EIC.tx[0] - 30);
  }, { repeat: [1, 1] });
  t.flipY = false; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.repeat.x = -1; t.offset.x = 1;
  return t;
}
// The EIC's underside, tiled: a hybrid-bond copper pad array in dielectric. Representative pitch, not a spec.
export function eicBondTex(repeat = [48, 36]) {
  const t = canvasTex(32, 32, (g, w, h) => {
    g.fillStyle = '#10141b'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#b07a48'; g.fillRect(9, 9, 14, 14);
    g.fillStyle = 'rgba(255,220,180,0.35)'; g.fillRect(10, 10, 12, 2.5);
  }, { repeat });
  return t;
}
export function asicTex() {
  return canvasTex(768, 768, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, w * 0.7); gr.addColorStop(0, '#46558a'); gr.addColorStop(1, '#232a4e'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let r = 0; r < 12; r++) for (let c = 0; c < 12; c++) { g.fillStyle = `rgba(200,215,255,${0.06 + ((r * 7 + c) % 4) * 0.025})`; g.fillRect(96 + c * 48, 96 + r * 48, 42, 42); }
    g.fillStyle = 'rgba(166,243,90,0.32)';
    for (let i = 0; i < 18; i++) { const p = 70 + i * 35; g.fillRect(p, 12, 28, 60); g.fillRect(p, h - 72, 28, 60); g.fillRect(12, p, 60, 28); g.fillRect(w - 72, p, 60, 28); }
  });
}
export function finTex() { return canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#9aa3ad'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 16; i++) g.fillRect(i * 16, 0, 3, h); }); }
