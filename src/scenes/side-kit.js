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
// A CPO engine's electronic chip faces (bare silicon, driver blocks over their modulators, TIAs over their
// photodiodes) live in cpo-variants.js with the engine views that share them.
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
