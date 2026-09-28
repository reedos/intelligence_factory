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
  return {
    dieSide: new THREE.MeshStandardMaterial({ color: 0x3b4262, roughness: 0.3, metalness: 0.6 }),
    fiberTx: glassFiber(0xc8f6ff, 0x62e6ff),
    fiberRx: glassFiber(0xffd6f2, 0xff7ad9),
    fiberCw: glassFiber(0xffe2b8, 0xffb347),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xbfe6ff, transmission: 0.8, roughness: 0.08, thickness: 0.2, transparent: true, opacity: 0.55 }),
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
export function label(scene, text, pos, color = '#e8ecf2', h = 0.3) { const s = textSprite(text, color, h); s.position.set(...pos); scene.add(s); return s; }
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
// the module's silicon photonics chip: transmit above (laser inputs from the top edge, split to eight Mach-Zehnder
// modulators, out to the right-hand fiber edge), receive below (eight waveguides from the fiber edge to germanium
// photodiodes at the left, beside the TIA's bond pads)
export function mzmPicTex() {
  return canvasTex(640, 544, (g, w, h) => {
    g.fillStyle = '#4a5468'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < 42; i++) g.fillRect(0, i * 13, w, 1);
    g.lineCap = 'round';
    for (let k = 0; k < 4; k++) {                                            // four laser inputs from the top edge, each split in two
      const x = 110 + k * 40, y1 = 26 + k * 2 * 28, y2 = y1 + 28;
      g.strokeStyle = 'rgba(255,179,71,0.85)'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, y1 - 12); g.lineTo(x + 20, y1); g.lineTo(250, y1); g.moveTo(x, y1 - 12); g.lineTo(x + 20, y2); g.lineTo(250, y2); g.stroke();
    }
    for (let i = 0; i < 8; i++) {
      const y = 26 + i * 28;
      g.strokeStyle = 'rgba(98,230,255,0.95)'; g.lineWidth = 2.5;           // Mach-Zehnder: split, two arms, recombine
      g.beginPath(); g.moveTo(250, y); g.lineTo(270, y - 7); g.lineTo(420, y - 7); g.lineTo(440, y); g.moveTo(250, y); g.lineTo(270, y + 7); g.lineTo(420, y + 7); g.lineTo(440, y); g.lineTo(w - 14, y); g.stroke();
      g.fillStyle = 'rgba(201,161,74,0.85)'; g.fillRect(276, y - 13, 138, 3); g.fillRect(276, y + 10, 138, 3);   // electrodes
      g.fillStyle = 'rgba(201,161,74,0.9)'; g.fillRect(14, y - 6, 22, 12);   // RF pads for the driver's bond wires, left edge
      g.strokeStyle = 'rgba(201,161,74,0.6)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(36, y); g.lineTo(276, y - 12); g.stroke();
    }
    g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(0, h / 2 - 1, w, 2);  // the divide
    for (let i = 0; i < 8; i++) {
      const y = h / 2 + 24 + i * 30;
      g.strokeStyle = 'rgba(255,122,217,0.9)'; g.lineWidth = 3; g.beginPath(); g.moveTo(w - 14, y); g.lineTo(84, y); g.stroke();
      g.fillStyle = 'rgba(255,122,217,0.95)'; g.fillRect(52, y - 9, 32, 18);   // germanium photodiode
      g.fillStyle = 'rgba(201,161,74,0.9)'; g.fillRect(14, y - 6, 22, 12);     // pads for the TIA's bond wires
    }
    g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(w - 14, 0, 14, h);     // the fiber-coupling edge
  });
}
// a CPO engine's photonic chip: micro-ring modulators on the transmit side, photodiodes on the receive side
export function ringPicTex() {
  return canvasTex(512, 384, (g, w, h) => {
    g.fillStyle = '#4a5468'; g.fillRect(0, 0, w, h); g.lineCap = 'round';
    g.strokeStyle = 'rgba(255,179,71,0.85)'; g.lineWidth = 3; g.beginPath(); g.moveTo(w - 12, 24); g.lineTo(40, 24); g.stroke();   // laser light in, a bus waveguide
    for (let i = 0; i < 8; i++) {
      const y = 44 + i * 18;
      g.strokeStyle = 'rgba(98,230,255,0.95)'; g.lineWidth = 2.5; g.beginPath(); g.arc(60 + i * 18, 24 + 16, 7, 0, Math.PI * 2); g.stroke();   // a ring beside the bus
      g.beginPath(); g.moveTo(60 + i * 18, 47); g.lineTo(60 + i * 18, y + 10); g.lineTo(w - 12, y + 10); g.stroke();
    }
    g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(0, h / 2 + 8, w, 2);
    for (let i = 0; i < 8; i++) {
      const y = h / 2 + 24 + i * 18;
      g.strokeStyle = 'rgba(255,122,217,0.9)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(w - 12, y); g.lineTo(90, y); g.stroke();
      g.fillStyle = 'rgba(255,122,217,0.95)'; g.fillRect(64, y - 6, 26, 12);
    }
    g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(w - 12, 0, 12, h);
  });
}
// a CPO engine's electronic chip: drivers for the rings (transmit), TIAs for the photodiodes (receive)
export function eicTex() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#23283a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) { g.fillStyle = 'rgba(98,230,255,0.35)'; g.fillRect(12 + i * 29, 18, 22, 92); g.fillStyle = 'rgba(255,122,217,0.3)'; g.fillRect(12 + i * 29, 146, 22, 92); }
    g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(0, h / 2 - 1, w, 2);
    g.strokeStyle = 'rgba(255,255,255,0.16)'; g.lineWidth = 3; g.strokeRect(3, 3, w - 6, h - 6);
  });
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
