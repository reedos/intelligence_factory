// Side level: inside the optics. World unit = 1 cm, as on the GPU package level.
// Left, a 1.6T OSFP pluggable module, exploded: shell, board, DSP, drivers, the silicon photonics chip, lasers,
// photodiodes, fibers and the connector (the LPO variant takes the DSP out). Right, a co-packaged optics switch
// package in the NVIDIA Photonics style: the switch ASIC in the middle, optical engines around it, fiber leaving
// each engine, external laser modules feeding them, a cold plate above. Both are schematic: parts and counts are
// representative of the public descriptions, not a vendor's drawing.
import { THREE, MAT, Builder, flow, canvasTex, glowMat, textSprite } from '../kit.js';

// counts from research/optics-internals-sources.md
export const OPTICS = {
  lanes: 8,              // 8 × 200G electrical lanes each way; 8 optical lanes each way (DR8 / 2×DR4)
  subassemblies: 6,      // Quantum-X: 6 optical subassemblies per switch ASIC, 3 engines each
  perSub: 3,
  engineFibers: [8, 8, 2], // per engine: transmit, receive, laser in
  els: 4,                // drawn laser modules: the Q3450's 18 serve its 4 packages, about 4.5 each
};
const TX = '#62e6ff', RX = '#ff7ad9', CW = '#ffb347', ELEC = '#a6f35a', RAIL = '#8fd3ff', CORE = '#e9fbff';

// ---------- textures ----------
function dspTexture() {
  return canvasTex(512, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, '#2a3358'); gr.addColorStop(0.5, '#3f4f82'); gr.addColorStop(1, '#262d52');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    // host-side SerDes along the left edge, line-side along the right, DSP and FEC logic in the middle
    for (let i = 0; i < 8; i++) {
      g.fillStyle = 'rgba(166,243,90,0.35)'; g.fillRect(10, 40 + i * 56, 54, 40);
      g.fillStyle = 'rgba(98,230,255,0.35)'; g.fillRect(w - 64, 40 + i * 56, 54, 40);
    }
    for (let r = 0; r < 6; r++) for (let c = 0; c < 5; c++) { g.fillStyle = `rgba(200,215,255,${0.08 + ((r + c) % 3) * 0.03})`; g.fillRect(90 + c * 66, 50 + r * 70, 58, 60); }
    g.fillStyle = 'rgba(255,205,140,0.2)'; g.fillRect(90, h / 2 - 16, w - 180, 32);            // FEC / control band
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 3; g.strokeRect(4, 4, w - 8, h - 8);
  });
}
// silicon photonics chip seen from above: eight modulators on the transmit side, eight photodiodes on the receive side,
// waveguides running to the fiber edge
function picTexture(rings = false) {
  return canvasTex(640, 512, (g, w, h) => {
    g.fillStyle = '#4a5468'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < 40; i++) g.fillRect(0, i * 13, w, 1);
    g.lineCap = 'round';
    for (let i = 0; i < 8; i++) {
      const y = 36 + i * 28;                                              // transmit: top half
      g.strokeStyle = 'rgba(255,179,71,0.75)'; g.lineWidth = 3; g.beginPath(); g.moveTo(40, y); g.lineTo(200, y); g.stroke();   // laser light in
      if (rings) { g.strokeStyle = 'rgba(98,230,255,0.9)'; g.lineWidth = 3; g.beginPath(); g.arc(260, y - 9, 9, 0, Math.PI * 2); g.stroke(); }
      else {                                                              // Mach-Zehnder: split, two arms with electrodes, join
        g.strokeStyle = 'rgba(98,230,255,0.9)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(200, y); g.lineTo(220, y - 7); g.lineTo(360, y - 7); g.lineTo(380, y); g.moveTo(200, y); g.lineTo(220, y + 7); g.lineTo(360, y + 7); g.lineTo(380, y); g.stroke();
        g.fillStyle = 'rgba(201,161,74,0.8)'; g.fillRect(226, y - 12, 128, 3); g.fillRect(226, y + 9, 128, 3);
      }
      g.strokeStyle = 'rgba(98,230,255,0.9)'; g.lineWidth = 3; g.beginPath(); g.moveTo(rings ? 200 : 380, y); g.lineTo(w - 20, y); g.stroke();   // out to the fiber
    }
    for (let i = 0; i < 8; i++) {
      const y = h / 2 + 30 + i * 28;                                      // receive: bottom half
      g.strokeStyle = 'rgba(255,122,217,0.85)'; g.lineWidth = 3; g.beginPath(); g.moveTo(w - 20, y); g.lineTo(150, y); g.stroke();
      g.fillStyle = 'rgba(255,122,217,0.9)'; g.fillRect(118, y - 8, 30, 16);                                     // germanium photodiode
    }
    g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(w - 16, 0, 16, h);                                         // fiber-coupling edge
  });
}
function eicTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#23283a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) { g.fillStyle = 'rgba(166,243,90,0.28)'; g.fillRect(14 + i * 29, 20, 22, 90); g.fillStyle = 'rgba(255,122,217,0.25)'; g.fillRect(14 + i * 29, 140, 22, 90); }
    g.strokeStyle = 'rgba(255,255,255,0.16)'; g.lineWidth = 3; g.strokeRect(3, 3, w - 6, h - 6);
  });
}
function asicTexture() {
  return canvasTex(768, 768, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, w * 0.7);
    gr.addColorStop(0, '#46558a'); gr.addColorStop(1, '#232a4e'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let r = 0; r < 12; r++) for (let c = 0; c < 12; c++) { g.fillStyle = `rgba(200,215,255,${0.06 + ((r * 7 + c) % 4) * 0.025})`; g.fillRect(96 + c * 48, 96 + r * 48, 42, 42); }
    g.fillStyle = 'rgba(166,243,90,0.3)';                                                                       // SerDes on all four edges
    for (let i = 0; i < 18; i++) { const p = 70 + i * 35; g.fillRect(p, 12, 28, 60); g.fillRect(p, h - 72, 28, 60); g.fillRect(12, p, 60, 28); g.fillRect(w - 72, p, 60, 28); }
  });
}
function finTexture() {
  return canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#9aa3ad'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 16; i++) g.fillRect(i * 16, 0, 3, h); });
}

export function build({ quality, state }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x080b11);
  scene.add(new THREE.HemisphereLight(0xb5c3e6, 0x111317, 0.8));
  const key = new THREE.DirectionalLight(0xfff0de, 2.0); key.position.set(-6, 14, 5);
  if (quality.shadows) { key.castShadow = true; key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -22, right: 22, top: 24, bottom: -24, near: 1, far: 50 }); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.01; }
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x7aa6ff, 1.2); rim.position.set(-8, 5, -9); scene.add(rim);

  const flows = [], dataFlows = [], heatFlows = [];
  const S = new Builder(), N = new Builder();
  const o = new THREE.Object3D();
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const lpo = { on: false };                            // the LPO variant: no DSP; set by the level's variant toggle

  // ======================= the pluggable module (left) =======================
  // along x: the electrical edge at MX0, the fiber connector at MX1; z across the module's 2.26 cm width
  const MX0 = -13.2, LEN = 10.78, MX1 = MX0 + LEN, MW = 2.258, mx = u => MX0 + u;   // u: cm from the edge connector
  const MY = { shell: 0, pcb: 1.3, parts: 1.36, pad: 2.35, lid: 3.4 };
  // bottom shell: floor and low side walls, cut open along the near side
  S.box(LEN, 0.12, MW, MAT.darkSteel, MX0 + LEN / 2, MY.shell, 0);
  S.box(LEN, 0.55, 0.1, MAT.darkSteel, MX0 + LEN / 2, MY.shell + 0.3, -MW / 2 + 0.05);
  S.box(0.12, 0.55, MW, MAT.darkSteel, MX1 - 0.06, MY.shell + 0.3, 0);
  // the board
  S.box(LEN - 0.9, 0.1, MW - 0.24, MAT.pcb, MX0 + (LEN - 0.9) / 2 + 0.05, MY.pcb, 0);
  // gold fingers on the edge connector, both faces
  for (let i = 0; i < 30; i++) { const z = -0.95 + i * 0.066; N.box(0.55, 0.012, 0.045, MAT.gold, mx(0.33), MY.pcb + 0.056, z); N.box(0.55, 0.012, 0.045, MAT.gold, mx(0.33), MY.pcb - 0.056, z); }
  // power: DC-DC converters (inductors and controllers) and the module's microcontroller
  for (let i = 0; i < 4; i++) { S.box(0.34, 0.22, 0.34, MAT.inductor, mx(1.35 + (i % 2) * 0.48), MY.parts + 0.11, i < 2 ? -0.5 : 0.5); }
  S.box(0.3, 0.06, 0.3, MAT.pcbBlack, mx(2.35), MY.parts + 0.03, -0.55);                 // PMIC
  S.box(0.4, 0.06, 0.4, MAT.pcbBlack, mx(2.35), MY.parts + 0.03, 0.5);                   // microcontroller
  for (let i = 0; i < 14; i++) N.box(0.08, 0.05, 0.04, MAT.beige, mx(1.1 + (i % 7) * 0.2), MY.parts + 0.025, i < 7 ? -0.92 : 0.92);
  // the DSP: a flip-chip package with its die facing up
  const DSPX = mx(3.9);
  const dspGroup = new THREE.Group(); scene.add(dspGroup);
  const dspSub = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 1.5), MAT.pcbBlack); dspSub.position.set(DSPX, MY.parts + 0.05, 0); dspSub.castShadow = true; dspGroup.add(dspSub);
  const dspMat = new THREE.MeshStandardMaterial({ map: dspTexture(), roughness: 0.34, metalness: 0.45, envMapIntensity: 0.5, emissive: 0xff6a1a, emissiveIntensity: 0 });
  const dieSide = new THREE.MeshStandardMaterial({ color: 0x3b4262, roughness: 0.3, metalness: 0.6 });
  const dspDie = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.06, 0.95), [dieSide, dieSide, dspMat, dieSide, dieSide, dieSide]); dspDie.position.set(DSPX, MY.parts + 0.13, 0); dspGroup.add(dspDie);
  // what the LPO variant leaves: the empty land where the DSP would sit
  const dspGhost = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.01, 1.5), new THREE.MeshBasicMaterial({ color: 0x8fd3ff, transparent: true, opacity: 0.18, depthWrite: false }));
  dspGhost.position.set(DSPX, MY.parts + 0.006, 0); dspGhost.visible = false; scene.add(dspGhost);
  const dspGhostEdge = new THREE.LineSegments(new THREE.EdgesGeometry(dspGhost.geometry), new THREE.LineBasicMaterial({ color: 0x8fd3ff, transparent: true, opacity: 0.7 }));
  dspGhostEdge.position.copy(dspGhost.position); dspGhostEdge.visible = false; scene.add(dspGhostEdge);
  // host lanes from the fingers to the DSP, line lanes from the DSP to the drivers and TIAs: differential pairs
  const trace = glowMat(ELEC, 0.55, 0.8);
  for (let i = 0; i < 8; i++) {
    const z = -0.84 + i * 0.24;
    N.box(DSPX - 0.75 - mx(0.62), 0.004, 0.03, MAT.copper, (mx(0.62) + DSPX - 0.75) / 2, MY.pcb + 0.052, z - 0.025);
    N.box(DSPX - 0.75 - mx(0.62), 0.004, 0.03, MAT.copper, (mx(0.62) + DSPX - 0.75) / 2, MY.pcb + 0.052, z + 0.025);
    N.box(mx(6.0) - DSPX - 0.75, 0.004, 0.03, MAT.copper, (DSPX + 0.75 + mx(6.0)) / 2, MY.pcb + 0.052, z);
  }
  // drivers (transmit) and transimpedance amplifiers (receive), four lanes each
  const drv = [], tia = [];
  for (const [i, z] of [[0, -0.5], [1, 0.5]]) {
    S.box(0.5, 0.06, 0.62, MAT.silicon, mx(6.25), MY.parts + 0.03, z); drv.push([mx(6.25), z]);
    S.box(0.4, 0.06, 0.5, MAT.silicon, mx(6.95), MY.parts + 0.03, z); tia.push([mx(6.95), z]);
  }
  // the silicon photonics chip: modulators and photodiodes, waveguides to the fiber edge
  const PICX = mx(8.1), PICW = 1.6, PICD = 1.7;
  const picMat = new THREE.MeshStandardMaterial({ map: picTexture(false), roughness: 0.3, metalness: 0.4, envMapIntensity: 0.6 });
  const pic = new THREE.Mesh(new THREE.BoxGeometry(PICW, 0.07, PICD), [dieSide, dieSide, picMat, dieSide, dieSide, dieSide]);
  pic.position.set(PICX, MY.parts + 0.035, 0); pic.castShadow = true; scene.add(pic);
  // continuous-wave lasers bonded at the chip's back edge: light only, the modulators put the data on it
  const laserGlow = glowMat(CW, 1.6);
  for (let i = 0; i < 4; i++) { const z = -0.72 + i * 0.16; S.box(0.22, 0.08, 0.12, MAT.gold, PICX - PICW / 2 - 0.14, MY.parts + 0.1, z); N.box(0.02, 0.03, 0.06, laserGlow, PICX - PICW / 2 - 0.02, MY.parts + 0.1, z); }
  // lens array and fiber block at the coupling edge, then the ribbon to the connector
  S.box(0.3, 0.2, 1.4, new THREE.MeshPhysicalMaterial({ color: 0xbfe6ff, transmission: 0.8, roughness: 0.08, thickness: 0.2, transparent: true, opacity: 0.55 }), PICX + PICW / 2 + 0.18, MY.parts + 0.1, 0);
  const fiberTx = new THREE.MeshStandardMaterial({ color: 0x9ff1ff, emissive: 0x62e6ff, emissiveIntensity: 0.25, roughness: 0.3 });
  const fiberRx = new THREE.MeshStandardMaterial({ color: 0xffb3ea, emissive: 0xff7ad9, emissiveIntensity: 0.25, roughness: 0.3 });
  const MPOX = MX1 - 0.45, MPOZ = [-0.5, 0.5], slot = k => (k - 5.5) * 0.06;   // twelve positions per connector
  // one DR4 half per connector: positions 1-4 transmit, 9-12 receive, 5-8 unused
  const dr4 = k => (k < 4 ? 'tx' : k >= 8 ? 'rx' : null);
  MPOZ.forEach((zc, h) => {
    S.box(0.6, 0.5, 0.92, MAT.polymer, MPOX, MY.parts + 0.22, zc);
    S.box(0.08, 0.12, 0.8, MAT.nickel, MPOX + 0.33, MY.parts + 0.22, zc);
    for (let k = 0; k < 12; k++) {
      const role = dr4(k), z1 = zc + slot(k);
      N.box(0.02, 0.035, 0.035, role === 'tx' ? glowMat(TX, 1.4) : role === 'rx' ? glowMat(RX, 1.4) : MAT.darkSteel, MPOX + 0.38, MY.parts + 0.22, z1);
      if (role) N.strut([PICX + PICW / 2 + 0.34, MY.parts + 0.1, -0.62 + (h * 8 + (role === 'tx' ? k : k - 4)) * 0.08], [MPOX - 0.3, MY.parts + 0.22, z1], 0.012, role === 'tx' ? fiberTx : fiberRx, 5);
    }
  });
  // the gap pad that carries the DSP's heat to the shell, and the top shell with its fins, lifted and see-through
  const pad = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 1.2), new THREE.MeshStandardMaterial({ color: 0xd87aa0, roughness: 0.8, transparent: true, opacity: 0.85 }));
  pad.position.set(DSPX, MY.pad, 0); scene.add(pad);
  const lidMat = new THREE.MeshPhysicalMaterial({ color: 0xb8c0c8, metalness: 0.7, roughness: 0.4, envMapIntensity: 0.4, transparent: true, opacity: 0.16, depthWrite: false });
  const lid = new THREE.Mesh(new THREE.BoxGeometry(LEN, 0.14, MW), lidMat); lid.position.set(MX0 + LEN / 2, MY.lid, 0); scene.add(lid);
  const lidEdge = new THREE.LineSegments(new THREE.EdgesGeometry(lid.geometry), new THREE.LineBasicMaterial({ color: 0xc9d3dc, transparent: true, opacity: 0.55 }));
  lidEdge.position.copy(lid.position); scene.add(lidEdge);
  const finMat = new THREE.MeshStandardMaterial({ map: finTexture(), color: 0xc2c9d0, metalness: 0.8, roughness: 0.35, transparent: true, opacity: 0.35, depthWrite: false });
  for (let i = 0; i < 26; i++) { const f = new THREE.Mesh(new THREE.BoxGeometry(LEN - 2.2, 0.62, 0.035), finMat); f.position.set(MX0 + LEN / 2 - 0.6, MY.lid + 0.38, -MW / 2 + 0.12 + i * 0.08); scene.add(f); }
  const lpoTag = textSprite('LPO · no DSP', '#8fd3ff', 0.22); lpoTag.position.set(DSPX, MY.parts + 0.7, 0); lpoTag.visible = false; scene.add(lpoTag);

  // ======================= the co-packaged optics switch (right) =======================
  // set well apart from the module: the two are alternatives, not parts of one assembly, and no fiber joins them here
  // (a real link between a NIC's module and a CPO switch is meters of fiber, not this gap)
  const CX = 9.2, SUB = 10.4;
  const gapX = (MX1 + CX - SUB / 2) / 2;
  const gapLine = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.01, 16), new THREE.MeshBasicMaterial({ color: 0x3a4658, transparent: true, opacity: 0.8 }));
  gapLine.position.set(gapX, 0, -1); scene.add(gapLine);
  const altTag = textSprite('Two alternatives · not connected', '#8a96a8', 0.2); altTag.position.set(gapX, 0.35, 5.6); scene.add(altTag);
  const CY = { board: 0, sub: 0.9, inter: 1.45, die: 1.62, eng: 1.5, plate: 4.2 };
  S.box(SUB + 3.2, 0.14, SUB + 3.2, MAT.pcb, CX, CY.board, 0);
  S.box(SUB, 0.28, SUB, MAT.pcbBlack, CX, CY.sub, 0);
  for (let i = 0; i < 120; i++) { const a = i / 120 * Math.PI * 2, r = SUB * 0.46; N.box(0.12, 0.06, 0.07, MAT.beige, CX + Math.cos(a) * r, CY.sub + 0.17, Math.sin(a) * r * 0.98, a); }
  // the switch ASIC on its interposer
  S.box(4.6, 0.1, 4.6, MAT.silicon, CX, CY.inter, 0);
  const asicMat = new THREE.MeshStandardMaterial({ map: asicTexture(), roughness: 0.34, metalness: 0.45, envMapIntensity: 0.5, emissive: 0xff6a1a, emissiveIntensity: 0 });
  const asic = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.1, 3.8), [dieSide, dieSide, asicMat, dieSide, dieSide, dieSide]);
  asic.position.set(CX, CY.die, 0); asic.castShadow = true; scene.add(asic);
  // optical engines around the ASIC: an electronic chip stacked on a photonic chip, micro-ring modulators on the
  // photonic chip, a fiber attach at the outer edge
  const engPIC = new THREE.MeshStandardMaterial({ map: picTexture(true), roughness: 0.3, metalness: 0.4, envMapIntensity: 0.6 });
  const engEIC = new THREE.MeshStandardMaterial({ map: eicTexture(), roughness: 0.35, metalness: 0.45 });
  const fau = new THREE.MeshPhysicalMaterial({ color: 0xbfe6ff, transmission: 0.8, roughness: 0.08, thickness: 0.2, transparent: true, opacity: 0.55 });
  const engines = [], subs = [];
  // where the six subassemblies sit around the ASIC is schematic; that there are six, of three engines, is not
  const SUBS = [[1, -1.75], [1, 1.75], [3, -1.75], [3, 1.75], [0, 0], [2, 0]];   // [side, offset along it]
  for (const [side, t0] of SUBS) {
    const rot = side * Math.PI / 2, out = [Math.cos(rot), Math.sin(rot)], r = 3.35;
    const sx = CX + Math.cos(rot) * r - Math.sin(rot) * t0, sz = Math.sin(rot) * r + Math.cos(rot) * t0;
    const carrier = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 3.5), MAT.pcbBlack); carrier.position.set(sx, CY.eng - 0.055, sz); carrier.rotation.y = -rot; carrier.receiveShadow = true; scene.add(carrier);
    subs.push({ x: sx, z: sz, rot });
  for (let k = 0; k < OPTICS.perSub; k++) {
    const t = t0 + (k - 1) * 1.12;
    const cx = CX + Math.cos(rot) * r - Math.sin(rot) * t, cz = Math.sin(rot) * r + Math.cos(rot) * t;
    const p = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.06, 0.95), [dieSide, dieSide, engPIC, dieSide, dieSide, dieSide]);
    p.position.set(cx, CY.eng, cz); p.rotation.y = -rot; p.castShadow = true; scene.add(p);
    const e = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.07, 0.8), [dieSide, dieSide, engEIC, dieSide, dieSide, dieSide]);
    e.position.set(cx - out[0] * 0.3, CY.eng + 0.065, cz - out[1] * 0.3); e.rotation.y = -rot; scene.add(e);
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.8), fau); f.position.set(cx + out[0] * 0.83, CY.eng + 0.08, cz + out[1] * 0.83); f.rotation.y = -rot; scene.add(f);
    engines.push({ x: cx, z: cz, out, rot });
  }
  }
  // fiber from each engine out to the package edge, where a detachable connector takes it
  const edgeConn = [];
  engines.forEach(({ x, z, out }, i) => {
    const ex = CX + out[0] * (SUB / 2 + 0.2) + (out[1] !== 0 ? x - CX : 0), ez = out[1] * (SUB / 2 + 0.2) + (out[0] !== 0 ? z : 0);
    const [nt, nr] = OPTICS.engineFibers;
    for (let j = 0; j < nt + nr; j++) { const o_ = (j - (nt + nr - 1) / 2) * 0.034, px = out[1] * o_, pz = -out[0] * o_; N.strut([x + out[0] * 1.0 + px, CY.eng + 0.08, z + out[1] * 1.0 + pz], [ex + px, CY.sub + 0.3, ez + pz], 0.007, j < nt ? fiberTx : fiberRx, 4); }
    S.box(out[0] ? 0.3 : 0.7, 0.3, out[0] ? 0.7 : 0.3, MAT.polymer, ex, CY.sub + 0.3, ez);
    edgeConn.push([ex, ez]);
  });
  // external laser source modules: pluggable boxes at the front panel, light only, fed to the engines by fiber
  const ELSX = CX + SUB / 2 + 3.2, els = [];
  for (let i = 0; i < OPTICS.els; i++) {
    const z = -3.3 + i * 2.2;
    S.box(1.9, 0.9, 1.1, MAT.darkSteel, ELSX, CY.sub + 0.45, z);
    N.box(0.04, 0.18, 0.5, glowMat(CW, 1.5), ELSX + 0.96, CY.sub + 0.6, z);
    els.push([ELSX, z]);
  }
  const cwFiber = new THREE.MeshStandardMaterial({ color: 0xffd08a, emissive: 0xffb347, emissiveIntensity: 0.3, roughness: 0.3 });
  // an engine's two laser fibers arrive in its own fiber bundle, through the same connector at the package edge, so
  // they run from the front-panel modules around the outside of the package, never over the switch chip
  const R = SUB / 2 + 1.1, yF = CY.sub + 0.45;
  function laserRoute(i) {
    const { x, z, out } = engines[i], [lx, lz] = els[i % els.length], [ex, ez] = edgeConn[i];
    const side = Math.round(Math.atan2(out[1], out[0]) / (Math.PI / 2) + 4) % 4;   // 0 east (the laser side), 1, 2 west, 3
    const zc = side === 3 ? -1 : 1;                                                // go round by the nearer corner
    const pts = [[lx - 0.95, yF, lz], [CX + R, yF, lz]];
    if (side === 1 || side === 3) pts.push([CX + R, yF, zc * R], [ex, yF, zc * R]);
    if (side === 2) pts.push([CX + R, yF, R], [CX - R, yF, R], [CX - R, yF, ez]);
    if (side === 0) pts.push([CX + R, yF, ez]);
    pts.push([ex + out[0] * 0.2, CY.sub + 0.35, ez + out[1] * 0.2], [x + out[0] * 0.8, CY.eng + 0.1, z + out[1] * 0.8]);
    return pts;
  }
  engines.forEach((_, i) => {
    const pts = laserRoute(i);
    for (const d of [-0.04, 0.04]) for (let k = 0; k < pts.length - 1; k++) {
      const [a, b] = [pts[k], pts[k + 1]], dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz) || 1;
      const nx = -dz / L * d, nz = dx / L * d;                                     // the pair side by side
      N.strut([a[0] + nx, a[1], a[2] + nz], [b[0] + nx, b[1], b[2] + nz], 0.008, cwFiber, 5);
    }
  });
  // the cold plate, lifted and see-through, with its water in and out
  const plate = new THREE.Mesh(new THREE.BoxGeometry(SUB - 0.6, 0.35, SUB - 0.6), new THREE.MeshPhysicalMaterial({ color: 0xc98a5c, metalness: 0.6, roughness: 0.45, envMapIntensity: 0.4, transparent: true, opacity: 0.14, depthWrite: false }));
  plate.position.set(CX, CY.plate, 0); scene.add(plate);
  const plateEdge = new THREE.LineSegments(new THREE.EdgesGeometry(plate.geometry), new THREE.LineBasicMaterial({ color: 0xd9a070, transparent: true, opacity: 0.6 }));
  plateEdge.position.copy(plate.position); scene.add(plateEdge);
  // water in and out straight up from the back of the plate, clear of every fiber and of the row behind
  const pipeZ = -SUB / 2 + 1.0, pipeTop = CY.plate + 2.6;
  for (const [dx, m] of [[-1.4, MAT.pipeBlue], [1.4, MAT.pipeRed]]) S.add(new THREE.CylinderGeometry(0.28, 0.28, pipeTop - CY.plate, 16), m, CX + dx, (CY.plate + pipeTop) / 2, pipeZ);

  // ======================= back row: the coherent pluggable and the copper cable heads =======================
  // Same rules as the front row: each station stands alone (no fiber or cable runs between them), says what is to
  // scale, and names its like-for-like unit. Layouts inside are representative: no labeled teardown of either is public.
  const RZ = -13.5;                                        // the back row's centerline

  // ---- 800ZR coherent module, directly behind the DR8 module: the same OSFP envelope, a different job ----
  const ZY = MY, zx = u => MX0 + u;
  S.box(LEN, 0.12, MW, MAT.darkSteel, MX0 + LEN / 2, ZY.shell, RZ);
  S.box(LEN, 0.55, 0.1, MAT.darkSteel, MX0 + LEN / 2, ZY.shell + 0.3, RZ - MW / 2 + 0.05);
  S.box(LEN - 0.9, 0.1, MW - 0.24, MAT.pcb, MX0 + (LEN - 0.9) / 2 + 0.05, ZY.pcb, RZ);
  for (let i = 0; i < 30; i++) { const z = RZ - 0.95 + i * 0.066; N.box(0.55, 0.012, 0.045, MAT.gold, zx(0.33), ZY.pcb + 0.056, z); N.box(0.55, 0.012, 0.045, MAT.gold, zx(0.33), ZY.pcb - 0.056, z); }
  for (let i = 0; i < 4; i++) S.box(0.34, 0.22, 0.34, MAT.inductor, zx(1.35 + (i % 2) * 0.48), ZY.parts + 0.11, RZ + (i < 2 ? -0.5 : 0.5));
  // the coherent DSP: the largest chip in the module
  const cdspX = zx(3.9);
  S.box(1.7, 0.1, 1.7, MAT.pcbBlack, cdspX, ZY.parts + 0.05, RZ);
  const cdspMat = new THREE.MeshStandardMaterial({ map: dspTexture(), roughness: 0.34, metalness: 0.45, envMapIntensity: 0.5, emissive: 0xff6a1a, emissiveIntensity: 0 });
  const cdsp = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.06, 1.15), [dieSide, dieSide, cdspMat, dieSide, dieSide, dieSide]); cdsp.position.set(cdspX, ZY.parts + 0.13, RZ); scene.add(cdsp);
  // the IQ modulator with its driver (transmit) and the coherent receiver (receive), side by side
  const cdmX = zx(6.7), icrX = zx(6.7);
  const iqTex = canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#4a5468'; g.fillRect(0, 0, w, h); g.lineCap = 'round';
    g.strokeStyle = 'rgba(255,179,71,0.8)'; g.lineWidth = 3; g.beginPath(); g.moveTo(10, h / 2); g.lineTo(70, h / 2); g.stroke();
    // four nested Mach-Zehnders: I and Q for each of two polarizations, recombined toward the fiber
    for (let k = 0; k < 4; k++) {
      const y = 36 + k * 56;
      g.strokeStyle = 'rgba(98,230,255,0.9)'; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(70, h / 2); g.lineTo(110, y); g.lineTo(130, y - 9); g.lineTo(330, y - 9); g.lineTo(350, y); g.moveTo(110, y); g.lineTo(130, y + 9); g.lineTo(330, y + 9); g.lineTo(350, y); g.lineTo(420, h / 2); g.stroke();
      g.fillStyle = 'rgba(201,161,74,0.8)'; g.fillRect(136, y - 15, 188, 3); g.fillRect(136, y + 12, 188, 3);
    }
    g.strokeStyle = 'rgba(98,230,255,0.9)'; g.lineWidth = 3; g.beginPath(); g.moveTo(420, h / 2); g.lineTo(w - 10, h / 2); g.stroke();
  });
  const icrTex = canvasTex(384, 256, (g, w, h) => {
    g.fillStyle = '#4a5468'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,122,217,0.85)'; g.lineWidth = 3; g.beginPath(); g.moveTo(w - 10, 70); g.lineTo(200, 70); g.stroke();       // signal in
    g.strokeStyle = 'rgba(255,179,71,0.8)'; g.beginPath(); g.moveTo(w - 10, 190); g.lineTo(200, 190); g.stroke();                          // local oscillator in
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 2; g.strokeRect(120, 40, 80, 176);                                            // 90-degree hybrid
    for (let k = 0; k < 4; k++) { g.fillStyle = 'rgba(255,122,217,0.9)'; g.fillRect(40, 44 + k * 44, 26, 16); g.fillRect(74, 44 + k * 44, 26, 16); }   // balanced photodiode pairs
  });
  const cdm = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.07, 0.8), [dieSide, dieSide, new THREE.MeshStandardMaterial({ map: iqTex, roughness: 0.3, metalness: 0.4 }), dieSide, dieSide, dieSide]);
  cdm.position.set(cdmX, ZY.parts + 0.035, RZ - 0.5); scene.add(cdm);
  const icr = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.07, 0.7), [dieSide, dieSide, new THREE.MeshStandardMaterial({ map: icrTex, roughness: 0.3, metalness: 0.4 }), dieSide, dieSide, dieSide]);
  icr.position.set(icrX, ZY.parts + 0.035, RZ + 0.55); scene.add(icr);
  S.box(0.5, 0.06, 0.55, MAT.silicon, zx(5.45), ZY.parts + 0.03, RZ - 0.5);        // modulator driver
  S.box(0.4, 0.06, 0.45, MAT.silicon, zx(5.55), ZY.parts + 0.03, RZ + 0.55);       // TIAs
  // the tunable laser: a nano-ITLA, drawn to its published size (25.0 × 15.6 × 6.5 mm)
  const itlaX = zx(8.95), itlaZ = RZ - 0.3;
  S.box(2.5, 0.65, 1.56, MAT.nickel, itlaX, ZY.parts + 0.325, itlaZ);
  N.box(0.03, 0.12, 0.3, glowMat(CW, 1.5), itlaX - 1.27, ZY.parts + 0.33, itlaZ);
  // one fiber pair: an LC duplex connector, transmit and receive
  const lcX = MX1 - 0.3;
  for (const [dz, m] of [[-0.3, TX], [0.3, RX]]) { S.box(0.5, 0.36, 0.42, MAT.polymer, lcX, ZY.parts + 0.2, RZ + dz); N.box(0.02, 0.05, 0.05, glowMat(m, 1.4), lcX + 0.26, ZY.parts + 0.2, RZ + dz); }
  const lidZ = new THREE.Mesh(new THREE.BoxGeometry(LEN, 0.14, MW), lidMat); lidZ.position.set(MX0 + LEN / 2, ZY.lid, RZ); scene.add(lidZ);
  const lidZEdge = new THREE.LineSegments(new THREE.EdgesGeometry(lidZ.geometry), new THREE.LineBasicMaterial({ color: 0xc9d3dc, transparent: true, opacity: 0.55 })); lidZEdge.position.copy(lidZ.position); scene.add(lidZEdge);
  // laser light: split, one path to the modulator, one to the receiver as its local oscillator
  const loSplit = [itlaX - 1.4, ZY.parts + 0.3, RZ];
  N.strut([itlaX - 1.27, ZY.parts + 0.33, itlaZ], loSplit, 0.01, cwFiber, 5);
  N.strut(loSplit, [cdmX + 0.75, ZY.parts + 0.08, RZ - 0.5], 0.01, cwFiber, 5);
  N.strut(loSplit, [icrX + 0.55, ZY.parts + 0.08, RZ + 0.55], 0.01, cwFiber, 5);
  // the modulated light out, and the received light in
  N.strut([cdmX - 0.75, ZY.parts + 0.08, RZ - 0.5], [cdmX - 0.95, ZY.parts + 0.3, RZ - 0.95], 0.01, fiberTx, 5);
  N.strut([cdmX - 0.95, ZY.parts + 0.3, RZ - 0.95], [lcX - 0.25, ZY.parts + 0.2, RZ - 0.3], 0.01, fiberTx, 5);
  N.strut([lcX - 0.25, ZY.parts + 0.2, RZ + 0.3], [icrX + 0.55, ZY.parts + 0.1, RZ + 0.75], 0.01, fiberRx, 5);
  // flows
  const zPts = (...pts) => pts;
  for (let i = 0; i < 3; i++) {
    const z = RZ - 0.7 + i * 0.2;
    dataFlows.push(flow(zPts([zx(-1.0), ZY.pcb + 0.06, z], [zx(0.62), ZY.pcb + 0.06, z], [cdspX - 0.85, ZY.pcb + 0.06, z]), 'eth', { count: 3, speed: 1.6, size: 0.03, k: 2.8, trail: false }));
    dataFlows.push(flow(zPts([cdspX + 0.85, ZY.pcb + 0.06, z], [zx(5.45), ZY.parts + 0.08, RZ - 0.5], [cdmX - 0.5, ZY.parts + 0.09, RZ - 0.5]), 'eth', { count: 3, speed: 1.6, size: 0.03, k: 2.8, trail: false }));
    const zr = RZ + 0.3 + i * 0.2;
    dataFlows.push(flow(zPts([icrX - 0.55, ZY.parts + 0.09, RZ + 0.55], [zx(5.55), ZY.parts + 0.08, RZ + 0.55], [cdspX + 0.85, ZY.pcb + 0.06, zr]), 'eth', { count: 3, speed: 1.6, size: 0.03, k: 2.8, trail: false }));
    dataFlows.push(flow(zPts([cdspX - 0.85, ZY.pcb + 0.06, zr], [zx(0.62), ZY.pcb + 0.06, zr], [zx(-1.0), ZY.pcb + 0.06, zr]), 'eth', { count: 3, speed: 1.6, size: 0.03, k: 2.8, trail: false }));
  }
  dataFlows.push(flow([[itlaX - 1.27, ZY.parts + 0.33, itlaZ], loSplit, [cdmX + 0.75, ZY.parts + 0.08, RZ - 0.5]], 'cw', { count: 3, speed: 1.2, size: 0.03, k: 2.6, trail: false }));
  dataFlows.push(flow([[itlaX - 1.27, ZY.parts + 0.33, itlaZ], loSplit, [icrX + 0.55, ZY.parts + 0.08, RZ + 0.55]], 'cw', { count: 3, speed: 1.2, size: 0.03, k: 2.6, trail: false }));
  dataFlows.push(flow([[cdmX - 0.75, ZY.parts + 0.08, RZ - 0.5], [cdmX - 0.95, ZY.parts + 0.3, RZ - 0.95], [lcX - 0.25, ZY.parts + 0.2, RZ - 0.3], [MX1 + 0.5, ZY.parts + 0.2, RZ - 0.3]], 'tx', { count: 4, speed: 1.9, size: 0.035, k: 3.2, trailR: 0.008, trailK: 0.3 }));
  dataFlows.push(flow([[MX1 + 0.5, ZY.parts + 0.2, RZ + 0.3], [lcX - 0.25, ZY.parts + 0.2, RZ + 0.3], [icrX + 0.55, ZY.parts + 0.1, RZ + 0.75]], 'rx', { count: 4, speed: 1.9, size: 0.035, k: 3.2, trailR: 0.008, trailK: 0.3 }));
  for (let i = 0; i < 4; i++) flows.push(flow([[zx(-1.2), ZY.pcb + 0.06, RZ - 0.6 + i * 0.4], [zx(0.3), ZY.pcb + 0.06, RZ - 0.6 + i * 0.4], [zx(1.5), ZY.parts + 0.1, RZ - 0.3 + i * 0.2]], 'v33', { count: 3, speed: 1.4, size: 0.035, k: 2.6, trail: false }));
  for (const [x, z] of [[cdspX, RZ], [itlaX, itlaZ], [zx(5.45), RZ - 0.5]]) flows.push(flow([[zx(2.0), ZY.parts + 0.1, RZ], [x, ZY.parts + 0.16, z]], 'core', { count: 3, speed: 1.5, size: 0.03, k: 2.8, trail: false }));
  const tagC = textSprite('Coherent pluggable · 800ZR', '#e8ecf2', 0.34); tagC.position.set(MX0 + LEN / 2, 5.2, RZ); scene.add(tagC);
  const scaleC = textSprite('OSFP envelope and laser to scale · layout representative', '#8a96a8', 0.2); scaleC.position.set(MX0 + LEN / 2, 4.7, RZ); scene.add(scaleC);
  const unitC = textSprite('1 module = 800G over one fiber pair', '#9ff1ff', 0.2); unitC.position.set(MX0 + LEN / 2, MY.lid + 1.05, RZ); scene.add(unitC);

  // ---- copper cable heads, behind the CPO package: passive, one redriver, a retimer in each end ----
  const heads = [], HL = 6.0, HW = 2.2;
  [['dac', CX - 4.6], ['acc', CX], ['aec', CX + 4.6]].forEach(([kind, hx]) => {
    const z0 = RZ + 2.4, zc = z0 - HL / 2;              // the plug's front (its edge fingers) faces the viewer
    S.box(HW, 0.12, HL, MAT.darkSteel, hx, 0, zc);
    S.box(HW - 0.3, 0.08, HL - 1.4, MAT.pcb, hx, 0.9, zc + 0.5);                       // the paddle card
    for (let i = 0; i < 20; i++) N.box(0.045, 0.012, 0.5, MAT.gold, hx - 0.8 + i * 0.084, 0.95, z0 - 0.3);
    S.box(0.18, 0.05, 0.18, MAT.pcbBlack, hx + 0.6, 0.97, zc + 1.4);                    // the ID memory every cable carries
    // twinax pairs soldered at the back of the card, bundled into the cable
    for (let i = 0; i < 8; i++) { const x = hx - 0.7 + i * 0.2; for (const d of [-0.035, 0.035]) N.strut([x + d, 0.95, z0 - HL + 1.0], [hx + (x - hx) * 0.35 + d, 0.9, z0 - HL - 3.2], 0.016, MAT.copper, 5); }
    N.cyl(0.52, 3.2, MAT.polymer, hx, 0.9, z0 - HL - 1.7, 16, Math.PI / 2, 0, 0);
    if (kind === 'acc') S.box(0.6, 0.07, 0.6, MAT.silicon, hx - 0.2, 0.975, zc);          // one redriver
    if (kind === 'aec') { S.box(0.95, 0.08, 0.95, MAT.silicon, hx - 0.2, 0.98, zc); for (let i = 0; i < 3; i++) S.box(0.22, 0.16, 0.22, MAT.inductor, hx + 0.65, 1.02, zc - 0.6 + i * 0.3); }
    const lid = new THREE.Mesh(new THREE.BoxGeometry(HW, 0.12, HL), lidMat); lid.position.set(hx, 2.3, zc); scene.add(lid);
    const le = new THREE.LineSegments(new THREE.EdgesGeometry(lid.geometry), new THREE.LineBasicMaterial({ color: 0xc9d3dc, transparent: true, opacity: 0.5 })); le.position.copy(lid.position); scene.add(le);
    // electrical lanes in at the fingers and out down the twinax; through the chip where there is one
    for (let i = 0; i < 3; i++) {
      const x = hx - 0.6 + i * 0.5, via = kind === 'dac' ? [] : [[hx - 0.2, 1.05, zc]];
      dataFlows.push(flow([[x, 0.98, z0 + 1.0], [x, 0.98, z0 - 0.3], ...via, [x * 0.35 + hx * 0.65, 0.95, z0 - HL - 3.2]], 'eth', { count: 3, speed: 1.6, size: 0.035, k: 2.8, trail: false }));
    }
    if (kind !== 'dac') flows.push(flow([[hx + 0.6, 0.98, z0 + 1.0], [hx + 0.6, 0.98, z0 - 0.3], [hx - 0.2, 1.05, zc]], 'v33', { count: 3, speed: 1.3, size: 0.035, k: 2.6, trail: false }));
    heads.push({ kind, x: hx, zc, z0 });
  });
  const tagD = textSprite('Copper cable heads · DAC, ACC, AEC', '#e8ecf2', 0.34); tagD.position.set(CX, 4.2, RZ - 1); scene.add(tagD);
  const scaleD = textSprite('Heads representative · one end of each cable', '#8a96a8', 0.2); scaleD.position.set(CX, 3.7, RZ - 1); scene.add(scaleD);
  const unitD = textSprite('DAC: no chip · ACC: one redriver · AEC: a retimer in each end', '#9ff1ff', 0.2); unitD.position.set(CX, 3.2, RZ - 1); scene.add(unitD);

  // the fair comparison: one 1.6T module does the job of one 1.6T engine; this package holds 18 of them
  const EQ = engines[1];
  const eqBox = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.34, 1.15), new THREE.MeshBasicMaterial({ color: 0x62e6ff, transparent: true, opacity: 0.07, depthWrite: false }));
  eqBox.position.set(EQ.x, CY.eng + 0.08, EQ.z); eqBox.rotation.y = -EQ.rot; scene.add(eqBox);
  const eqEdge = new THREE.LineSegments(new THREE.EdgesGeometry(eqBox.geometry), new THREE.LineBasicMaterial({ color: 0x62e6ff, transparent: true, opacity: 0.9 }));
  eqEdge.position.copy(eqBox.position); eqEdge.rotation.copy(eqBox.rotation); scene.add(eqEdge);
  const eqTag = textSprite('1 engine = 1.6T each way, like one module', '#9ff1ff', 0.2); eqTag.position.set(EQ.x, CY.sub + 0.9, EQ.z + 2.6);   // out over its own fibers, clear of the part's pin scene.add(eqTag);
  const pkgTag = textSprite('18 engines · 28.8T each way', '#9ff1ff', 0.24); pkgTag.position.set(CX, CY.plate + 0.9, 0); scene.add(pkgTag);
  const modTag = textSprite('1 module = 1.6T each way', '#9ff1ff', 0.2); modTag.position.set(MX0 + LEN / 2, MY.lid + 1.05, 0); scene.add(modTag);
  scene.add(S.build()); scene.add(N.build({ cast: false }));

  // ======================= power =======================
  // the module: 3.3 V in through the edge fingers, down to the DSP's core and the drivers and lasers
  for (let i = 0; i < 6; i++) { const z = -0.8 + i * 0.32; flows.push(flow([[mx(-1.4), MY.pcb + 0.06, z], [mx(0.3), MY.pcb + 0.06, z], [mx(1.5), MY.parts + 0.1, z * 0.5]], 'v33', { count: 3, speed: 1.4, size: 0.035, k: 2.6, trail: false })); }
  const modPower = [];
  for (let i = 0; i < 5; i++) modPower.push(flow([[mx(2.0), MY.parts + 0.1, -0.4 + i * 0.2], [DSPX, MY.parts + 0.16, -0.4 + i * 0.2]], 'core', { count: 3, speed: 1.6, size: 0.03, k: 2.8, trail: false }));
  modPower.forEach(f => flows.push(f));
  flows.push(flow([[mx(2.0), MY.parts + 0.1, 0.7], [mx(6.25), MY.parts + 0.1, 0.7], [PICX - PICW / 2 - 0.14, MY.parts + 0.14, 0.7]], 'v33', { count: 4, speed: 1.3, size: 0.03, k: 2.6, trail: false }));
  // the package: current up through the substrate into the ASIC and the engines; the lasers draw their own
  for (let i = 0; i < 26; i++) { const x = CX + (rnd() - 0.5) * 3.4, z = (rnd() - 0.5) * 3.4; flows.push(flow([[x, -1.2, z], [x, CY.sub, z], [x, CY.die, z]], 'core', { count: 3, speed: 1.6 + rnd(), size: 0.03, k: 2.8, trail: false })); }
  engines.forEach(({ x, z }) => flows.push(flow([[x, -1.0, z], [x, CY.sub, z], [x, CY.eng, z]], 'v33', { count: 2, speed: 1.4, size: 0.03, k: 2.6, trail: false })));
  els.forEach(([x, z]) => flows.push(flow([[x + 2.4, CY.sub + 0.45, z], [x + 0.9, CY.sub + 0.45, z]], 'v33', { count: 3, speed: 1.2, size: 0.035, k: 2.6, trail: false })));
  flows.forEach(f => scene.add(f.group));

  // ======================= data: transmit and receive, each its own path =======================
  // module transmit: host lane in at the fingers, through the DSP, to a driver, into a modulator, out as light
  const modTx = [], modRx = [], dspHops = [];
  for (let i = 0; i < 4; i++) {
    const z = -0.84 + i * 0.24;
    const a = flow([[mx(-1.2), MY.pcb + 0.06, z], [mx(0.62), MY.pcb + 0.06, z], [DSPX - 0.75, MY.pcb + 0.06, z]], 'eth', { count: 3, speed: 1.6, size: 0.03, k: 2.8, trail: false });
    const b = flow([[DSPX - 0.4, MY.parts + 0.17, z * 0.6], [DSPX + 0.4, MY.parts + 0.17, z * 0.6]], 'eth', { count: 2, speed: 1.6, size: 0.03, k: 2.8, trail: false });
    const c = flow([[DSPX + 0.75, MY.pcb + 0.06, z], [mx(6.25), MY.parts + 0.08, -0.5 + (i - 1.5) * 0.12], [PICX - 0.2, MY.parts + 0.08, -0.5 + (i - 1.5) * 0.12]], 'eth', { count: 3, speed: 1.6, size: 0.03, k: 2.8, trail: false });
    const d = flow([[PICX - 0.2, MY.parts + 0.09, -0.62 + i * 0.1], [PICX + PICW / 2, MY.parts + 0.09, -0.62 + i * 0.1], [MPOX - 0.3, MY.parts + 0.22, MPOZ[i >> 1] + slot(i % 2 * 2)], [MX1 + 0.5, MY.parts + 0.22, MPOZ[i >> 1] + slot(i % 2 * 2)]], 'tx', { count: 4, speed: 1.9, size: 0.035, k: 3.2, trailR: 0.008, trailK: 0.3 });
    modTx.push(a, c, d); dspHops.push(b);
  }
  // module receive: light in at the connector, to a photodiode, a TIA, the DSP, and back out the fingers
  for (let i = 0; i < 4; i++) {
    const z = 0.12 + i * 0.24;
    const d = flow([[MX1 + 0.5, MY.parts + 0.22, MPOZ[i >> 1] + slot(9 + i % 2 * 2)], [MPOX - 0.3, MY.parts + 0.22, MPOZ[i >> 1] + slot(9 + i % 2 * 2)], [PICX + PICW / 2, MY.parts + 0.09, 0.2 + i * 0.1], [PICX - 0.55, MY.parts + 0.09, 0.2 + i * 0.1]], 'rx', { count: 4, speed: 1.9, size: 0.035, k: 3.2, trailR: 0.008, trailK: 0.3 });
    const c = flow([[PICX - 0.55, MY.parts + 0.08, 0.5 + (i - 1.5) * 0.12], [mx(6.95), MY.parts + 0.08, 0.5 + (i - 1.5) * 0.12], [DSPX + 0.75, MY.pcb + 0.06, z]], 'eth', { count: 3, speed: 1.6, size: 0.03, k: 2.8, trail: false });
    const b = flow([[DSPX + 0.4, MY.parts + 0.17, z * 0.6], [DSPX - 0.4, MY.parts + 0.17, z * 0.6]], 'eth', { count: 2, speed: 1.6, size: 0.03, k: 2.8, trail: false });
    const a = flow([[DSPX - 0.75, MY.pcb + 0.06, z], [mx(0.62), MY.pcb + 0.06, z], [mx(-1.2), MY.pcb + 0.06, z]], 'eth', { count: 3, speed: 1.6, size: 0.03, k: 2.8, trail: false });
    modRx.push(d, c, a); dspHops.push(b);
  }
  // module laser light: the CW lasers light the modulators, which is where the data goes onto it
  const modCw = [];
  for (let i = 0; i < 4; i++) { const z = -0.72 + i * 0.16; modCw.push(flow([[PICX - PICW / 2 - 0.1, MY.parts + 0.1, z], [PICX - 0.2, MY.parts + 0.09, z]], 'cw', { count: 2, speed: 1.2, size: 0.03, k: 2.6, trail: false })); }
  [...modTx, ...modRx, ...dspHops, ...modCw].forEach(f => dataFlows.push(f));
  // package: SerDes on the ASIC's edge a few millimeters to the engine, light out through the fiber; light in the
  // other way; laser light from the front-panel modules into every engine
  engines.forEach(({ x, z, out }, i) => {
    const ax = CX + out[0] * 1.85, az = out[1] * 1.85 + (out[0] !== 0 ? z * 0.5 : 0), axx = out[1] !== 0 ? CX + (x - CX) * 0.5 : ax;
    const [ex, ez] = edgeConn[i];
    dataFlows.push(flow([[axx, CY.die + 0.06, az], [x - out[0] * 0.3, CY.eng + 0.1, z - out[1] * 0.3]], 'eth', { count: 2, speed: 1.8, size: 0.03, k: 2.8, trail: false }));
    dataFlows.push(flow([[x + out[0] * 0.5, CY.eng + 0.08, z + out[1] * 0.5], [ex, CY.sub + 0.3, ez], [ex + out[0] * 0.9, CY.sub + 0.3, ez + out[1] * 0.9]], 'tx', { count: 3, speed: 1.9, size: 0.035, k: 3.2, trailR: 0.008, trailK: 0.3 }));
    dataFlows.push(flow([[ex + out[0] * 0.9 + out[1] * 0.12, CY.sub + 0.32, ez + out[1] * 0.9 - out[0] * 0.12], [ex + out[1] * 0.12, CY.sub + 0.32, ez - out[0] * 0.12], [x + out[0] * 0.5, CY.eng + 0.1, z + out[1] * 0.5]], 'rx', { count: 3, speed: 1.9, size: 0.035, k: 3.2, trailR: 0.008, trailK: 0.3 }));
    dataFlows.push(flow(laserRoute(i), 'cw', { count: 3, speed: 1.4, size: 0.03, k: 2.6, trail: false }));
  });
  dataFlows.forEach(f => scene.add(f.group));

  // ======================= heat =======================
  const modHeat = [];
  for (let i = 0; i < 12; i++) { const x = DSPX + (rnd() - 0.5) * 0.8, z = (rnd() - 0.5) * 0.8; modHeat.push(flow([[x, MY.parts + 0.16, z], [x, MY.lid, z], [x + (rnd() - 0.5) * 2, MY.lid + 1.6, z * 2]], 'hot', { count: 3, speed: 1.0 + rnd() * 0.5, size: 0.04, k: 2.6, trail: false })); }
  for (let i = 0; i < 5; i++) heatFlows.push(flow([[mx(6.25 + (i % 2) * 0.7), MY.parts + 0.08, -0.5 + (i % 3) * 0.5], [mx(6.6), MY.lid, 0], [mx(6.6), MY.lid + 1.2, 0]], 'hot', { count: 2, speed: 0.8, size: 0.035, k: 2.4, trail: false }));
  modHeat.forEach(f => heatFlows.push(f));
  // air through the fins, front to back
  for (let i = 0; i < 6; i++) heatFlows.push(flow([[MX1 + 1.5, MY.lid + 0.4, -0.9 + i * 0.36], [MX0 - 1.5, MY.lid + 0.4, -0.9 + i * 0.36]], 'air', { count: 4, speed: 1.4, size: 0.04, k: 2.4, trail: false }));
  for (let i = 0; i < 30; i++) { const x = CX + (rnd() - 0.5) * 3.4, z = (rnd() - 0.5) * 3.4; heatFlows.push(flow([[x, CY.die + 0.06, z], [x, CY.plate - 0.2, z]], 'hot', { count: 3, speed: 1.1 + rnd() * 0.6, size: 0.045, k: 2.6, trail: false })); }
  engines.forEach(({ x, z }) => heatFlows.push(flow([[x, CY.eng + 0.1, z], [x, CY.plate - 0.2, z]], 'hot', { count: 2, speed: 0.9, size: 0.035, k: 2.4, trail: false })));
  heatFlows.push(flow([[CX - 1.4, pipeTop, pipeZ], [CX - 1.4, CY.plate, pipeZ], [CX - 1.4, CY.plate, 3], [CX + 1.4, CY.plate, 3], [CX + 1.4, CY.plate, pipeZ], [CX + 1.4, pipeTop, pipeZ]], 'cool', { count: 10, speed: 1.6, size: 0.06, k: 2.2, trail: false }));
  heatFlows.forEach(f => scene.add(f.group));

  // ---------- labels over each half ----------
  const tagA = textSprite('Pluggable module · 1.6T OSFP', '#e8ecf2', 0.34); tagA.position.set(MX0 + LEN / 2, 5.2, 0); scene.add(tagA);
  const scaleA = textSprite('To scale: 107.8 × 22.58 × 13.0 mm', '#8a96a8', 0.2); scaleA.position.set(MX0 + LEN / 2, 4.7, 0); scene.add(scaleA);
  const tagB = textSprite('Co-packaged optics · one switch package', '#e8ecf2', 0.34); tagB.position.set(CX, 5.9, 0); scene.add(tagB);
  const scaleB = textSprite('Size representative · counts are NVIDIA’s', '#8a96a8', 0.2); scaleB.position.set(CX, 5.4, 0); scene.add(scaleB);

  function setLpo(on) {
    lpo.on = on;
    dspGroup.visible = !on; pad.visible = !on; dspGhost.visible = on; dspGhostEdge.visible = on; lpoTag.visible = on;
    [...dspHops, ...modPower, ...modHeat].forEach(f => (f.group.visible = !on && f.group.visible));
  }

  const V = (x, y, z) => [x, y, z];
  const at = (pos, view, target) => ({ pos, view: { pos: view, target } });
  const hs = {
    fingers: at(V(mx(0.3), MY.pcb + 0.1, 0.8), V(mx(-2.5), 3.5, 4.5), V(mx(0.8), MY.pcb, 0)),
    dcdc: at(V(mx(1.6), MY.parts + 0.3, -0.5), V(mx(0.5), 4, 4), V(mx(1.8), MY.parts, 0)),
    dsp: at(V(DSPX, MY.parts + 0.2, 0.3), V(DSPX - 0.8, 5, 4.2), V(DSPX, MY.parts, 0)),
    driver: at(V(mx(6.25), MY.parts + 0.1, -0.5), V(mx(5.6), 4.2, 4), V(mx(6.6), MY.parts, 0)),
    pic: at(V(PICX, MY.parts + 0.1, -0.3), V(PICX - 0.5, 4.5, 3.6), V(PICX, MY.parts, 0)),
    lasers: at(V(PICX - PICW / 2 - 0.14, MY.parts + 0.2, -0.7), V(PICX - 2, 3.2, 3.2), V(PICX - 0.6, MY.parts, -0.3)),
    mpo: at(V(MPOX, MY.parts + 0.5, 0), V(MX1 + 2.5, 3.5, 4.2), V(MPOX - 0.5, MY.parts, 0)),
    shell: at(V(MX0 + LEN / 2 - 0.6, MY.lid + 0.7, -0.6), V(MX0 + LEN / 2, 8.5, 8), V(MX0 + LEN / 2, 2, 0)),
    asic: at(V(CX, CY.die + 0.1, 0), V(CX - 1, 9, 7), V(CX, CY.die, 0)),
    engine: at(V(engines[1].x, CY.eng + 0.15, engines[1].z), V(engines[1].x + 3, 5, engines[1].z + 3.5), V(engines[1].x, CY.eng, engines[1].z)),
    els: at(V(ELSX, CY.sub + 1.0, 0), V(ELSX + 3.5, 5, 6), V(ELSX - 1, CY.sub, 0)),
    fiberout: at(V(edgeConn[1][0], CY.sub + 0.5, edgeConn[1][1]), V(edgeConn[1][0] + 3.5, 4.5, edgeConn[1][1] + 3), V(edgeConn[1][0] - 0.5, CY.sub, edgeConn[1][1])),
    ...Object.fromEntries(heads.map(h => [h.kind, at(V(h.x, 1.3, h.zc), V(h.x + 1.8, 5.2, h.z0 + 1.2), V(h.x, 0.9, h.zc - 0.4))])),   // close, from just above the plug's front, clear of the package
    cdsp: at(V(cdspX, ZY.parts + 0.3, RZ + 0.3), V(cdspX - 0.8, 5, RZ + 4.2), V(cdspX, ZY.parts, RZ)),
    cdm: at(V(cdmX, ZY.parts + 0.2, RZ - 0.5), V(cdmX - 0.5, 4.5, RZ + 3.8), V(cdmX, ZY.parts, RZ)),
    icr: at(V(icrX, ZY.parts + 0.2, RZ + 0.55), V(icrX - 0.5, 4.5, RZ + 3.8), V(icrX, ZY.parts, RZ)),
    itla: at(V(itlaX, ZY.parts + 0.75, itlaZ), V(itlaX - 1.5, 5, RZ + 4), V(itlaX, ZY.parts, RZ)),
    lc: at(V(lcX, ZY.parts + 0.5, RZ), V(MX1 + 2.5, 3.5, RZ + 4.2), V(lcX - 0.5, ZY.parts, RZ)),
    coldplate: at(V(CX + 2.5, CY.plate + 0.3, 2.5), V(CX + 6, 10, 11), V(CX, 2.4, 0)),
  };
  return {
    scene, flows, dataFlows, heatFlows,
    camera: { pos: [1.8, 27, 19], target: [1.8, 1.0, -6.5], near: 0.05, far: 500, min: 2, max: 80 },
    // from the hall's CPO switch, open on the package; from a tray's cages, on the whole level with the module first
    cameraFrom: {
      osfp: { pos: [-4.2, 10.5, 12.5], target: [-6.8, 1.3, 0], near: 0.05, far: 500, min: 2, max: 60 },
      optics: { pos: [-4.2, 10.5, 12.5], target: [-6.8, 1.3, 0], near: 0.05, far: 500, min: 2, max: 60 },
      dci: { pos: [MX0 + LEN / 2 + 2, 10, RZ + 12], target: [MX0 + LEN / 2, 1.3, RZ], near: 0.05, far: 500, min: 2, max: 80 },
      spine: { pos: [CX + 1, 11, RZ + 13], target: [CX, 1.0, RZ - 1], near: 0.05, far: 500, min: 2, max: 80 },
      cpo: { pos: [CX + 1.5, 12.5, 14.5], target: [CX, 1.4, 0], near: 0.05, far: 500, min: 2, max: 60 } },
    hotspots: { fingers: hs.fingers, dcdc: hs.dcdc, dsp: hs.dsp, lasers: hs.lasers, asic: hs.asic, engine: hs.engine, els: hs.els, acc: hs.acc, aec: hs.aec, dac: hs.dac },
    dataHotspots: { fingers: hs.fingers, dsp: hs.dsp, driver: hs.driver, pic: hs.pic, mpo: hs.mpo, asic: hs.asic, engine: hs.engine, fiberout: hs.fiberout, els: hs.els,
      dac: hs.dac, acc: hs.acc, aec: hs.aec, cdsp: hs.cdsp, cdm: hs.cdm, itla: hs.itla, icr: hs.icr, lc: hs.lc },
    heatHotspots: { dsp: hs.dsp, shell: hs.shell, asic: hs.asic, coldplate: hs.coldplate },
    variant: { get lpo() { return lpo.on; }, setLpo },
    update(t) {
      const heatOn = state.mode === 'heat';
      for (const m of [dspMat, asicMat, cdspMat]) { m.emissiveIntensity = heatOn ? 0.5 + 0.08 * Math.sin(t * 2) : 0; }
      if (lpo.on) [...dspHops, ...modPower, ...modHeat].forEach(f => (f.group.visible = false));
    },
  };
}
