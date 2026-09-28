// Scene 2: power room & data hall, drawn as a section cut. Units are meters.
import { THREE, MAT, Builder, mtx, flow, insulator, canvasTex, sky, person, glowMat, textSprite, spinners } from '../kit.js';
import { rbox, bundle, blinkers, lamps, plumes, movers, floorMirror } from '../fx.js';

// Cabinet front textures (drawn once).
function frontTex(kind) {
  const W = 256, H = 512;
  return canvasTex(W, H, (g, w, h) => {
    if (kind === 'rack') {
      g.fillStyle = '#121418'; g.fillRect(0, 0, w, h);
      const U = h / 48;
      const row = (y, hgt, fill, leds) => { g.fillStyle = fill; g.fillRect(8, y, w - 16, hgt - 2); for (let i = 0; i < leds; i++) { g.fillStyle = i % 5 === 0 ? '#5cf29a' : '#1e8a55'; g.fillRect(16 + i * 9, y + hgt / 2 - 1.5, 4, 3); } };
      for (let i = 0; i < 4; i++) row(U * (1 + i), U, '#2a2e35', 6);                 // power shelves top
      for (let i = 0; i < 10; i++) { row(U * (6 + i * 1.05), U, '#1d2026', 2); g.fillStyle = '#2d323a'; for (let x = 60; x < w - 20; x += 7) g.fillRect(x, U * (6 + i * 1.05) + 3, 4, U - 8); }
      for (let i = 0; i < 9; i++) row(U * (17 + i), U, '#23303a', 14);               // NVLink switches
      for (let i = 0; i < 8; i++) { row(U * (27 + i * 1.05), U, '#1d2026', 2); g.fillStyle = '#2d323a'; for (let x = 60; x < w - 20; x += 7) g.fillRect(x, U * (27 + i * 1.05) + 3, 4, U - 8); }
      for (let i = 0; i < 4; i++) row(U * (37 + i), U, '#2a2e35', 6);
      g.fillStyle = '#0b0c0e'; g.fillRect(0, 0, 8, h); g.fillRect(w - 8, 0, 8, h);
    } else if (kind === 'rackH100') {
      g.fillStyle = '#121418'; g.fillRect(0, 0, w, h);
      const U = h / 48;
      for (let s = 0; s < 4; s++) {                                                   // four 8U servers, fans on the face
        const y = h - U * (3 + s * 8.2) - U * 8;
        g.fillStyle = '#1b1d21'; g.fillRect(8, y, w - 16, U * 8 - 3);
        g.fillStyle = '#b39a6a'; g.fillRect(8, y, w - 16, 3);
        for (let r = 0; r < 2; r++) for (let i = 0; i < 5; i++) { g.fillStyle = '#0b0c0e'; g.beginPath(); g.arc(34 + i * 47, y + U * (2 + r * 4), U * 1.6, 0, Math.PI * 2); g.fill(); }
      }
      g.fillStyle = '#2a2e35'; g.fillRect(8, U * 2, w - 16, U - 2);
      g.fillStyle = '#0b0c0e'; g.fillRect(0, 0, 8, h); g.fillRect(w - 8, 0, 8, h);
    } else if (kind === 'sst') {
      g.fillStyle = '#d0d4d7'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#8d9398'; g.lineWidth = 3; g.strokeRect(4, 4, w - 8, h - 8);
      g.fillStyle = '#0e1d2a'; g.fillRect(60, 50, 136, 70); g.fillStyle = '#d8f04a'; g.fillRect(72, 64, 70, 8); g.fillStyle = '#45c6ff'; g.fillRect(72, 82, 50, 6);
      g.fillStyle = '#aeb3b7'; for (let y = 170; y < h - 30; y += 11) g.fillRect(24, y, w - 48, 5);
    } else if (kind === 'inrow') {
      g.fillStyle = '#26292e'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#1a1c20'; for (let y = 30; y < h - 30; y += 9) g.fillRect(16, y, w - 32, 5);
      g.fillStyle = '#0e1d2a'; g.fillRect(70, 40, 116, 50); g.fillStyle = '#4c8dff'; g.fillRect(80, 54, 50, 7);
    } else if (kind === 'swgr') {
      g.fillStyle = '#c4c8cb'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#8d9398'; g.lineWidth = 3; g.strokeRect(4, 4, w - 8, h - 8);
      for (let i = 0; i < 3; i++) { const y = 40 + i * 150; g.fillStyle = '#b2b7bb'; g.fillRect(24, y, w - 48, 120); g.fillStyle = '#2b2f34'; g.fillRect(70, y + 20, w - 140, 50); g.fillStyle = i === 0 ? '#e0483c' : '#3fbf6a'; g.fillRect(40, y + 90, 14, 14); g.fillStyle = '#e9d44a'; g.fillRect(w - 64, y + 90, 26, 14); }
    } else if (kind === 'ups') {
      g.fillStyle = '#2a2e34'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#20252b'; for (let y = 180; y < h - 20; y += 10) g.fillRect(20, y, w - 40, 5);
      g.fillStyle = '#0e1d2a'; g.fillRect(60, 50, 136, 80); g.fillStyle = '#45c6ff'; g.fillRect(70, 62, 60, 8); g.fillRect(70, 80, 90, 5); g.fillStyle = '#5cf29a'; g.fillRect(70, 96, 40, 5);
    } else if (kind === 'batt') {
      g.fillStyle = '#23272d'; g.fillRect(0, 0, w, h);
      for (let y = 30; y < h - 30; y += 44) { g.fillStyle = '#31363d'; g.fillRect(16, y, w - 32, 36); g.fillStyle = '#5cf29a'; g.fillRect(w - 40, y + 14, 8, 8); }
    } else if (kind === 'cdu') {
      g.fillStyle = '#d3d6d8'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#0e1d2a'; g.fillRect(60, 60, 136, 90); g.fillStyle = '#4c8dff'; g.fillRect(72, 76, 50, 8); g.fillStyle = '#ff5a6e'; g.fillRect(72, 94, 70, 8);
      g.fillStyle = '#b3b8bc'; for (let y = 200; y < h - 30; y += 12) g.fillRect(24, y, w - 48, 6);
    } else if (kind === 'net') {
      g.fillStyle = '#121418'; g.fillRect(0, 0, w, h);
      for (let y = 20; y < h - 20; y += 22) { g.fillStyle = '#1f232a'; g.fillRect(10, y, w - 20, 18); for (let x = 16; x < w - 16; x += 8) { g.fillStyle = ['#e8c547', '#3fd1c8', '#e8c547', '#9aa3ad'][(x + y) % 4]; g.fillRect(x, y + 5, 4, 8); } }
    }
  });
}
export function build({ quality, model }) {
  const dc = model.power.id === 'dc800', air = model.cooling.id === 'air', nvl = model.accel.gpusPerRack === 72;
  const itV = dc ? 'hvdc' : 'lv';
  const scene = new THREE.Scene();
  scene.add(sky('#0b1220', '#18233a', '#3a4254', 800));
  // dark, moody hall: a low cool ambient and a dim shadow-casting key stand in for the skylights and
  // emergency fixtures; the ceiling fixtures added below (fx.lamps) carry the actual sense of light
  scene.add(new THREE.HemisphereLight(0x2e3a52, 0x0a0b0e, 0.58));
  const key = new THREE.DirectionalLight(0xcfe0ff, 0.55);
  key.position.set(-40, 60, 45); key.target.position.set(0, 0, -2);
  if (quality.shadows) { key.castShadow = true; key.shadow.mapSize.set(4096, 4096); Object.assign(key.shadow.camera, { left: -48, right: 48, top: 32, bottom: -32, near: 10, far: 180 }); key.shadow.bias = -0.0003; key.shadow.normalBias = 0.04; }
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0x1c2a48, 0.16); fill.position.set(40, 30, 60); scene.add(fill);

  const flows = [], dataFlows = [], heatFlows = [];
  const S = new Builder(), N = new Builder();
  const X0 = -35, X1 = 25, Z0 = -18, Z1 = 18, WALL_H = 7.5, PART = -12;

  // ---------- network faceplates: pluggable OSFP modules, or one CPO switch with on-chassis MPO + ELS ----------
  // Sources: research/interconnect-sources.md section 2 (Scale-out): DSP pluggables ~17 W (800G DR8) to ~25-30 W
  // (1.6T); LPO saves ~40-50%; NVIDIA Quantum-X/Spectrum-X Photonics (CPO) is 4x fewer lasers via external laser
  // sources and, as of its August 2026 update, 5x power efficiency (up from an initial 3.5x); Broadcom Davisson
  // (Tomahawk 6 CPO) is 3.5 W per 800G port of optics.
  const moduleMetal = new THREE.MeshStandardMaterial({ color: 0xcfd3d8, roughness: 0.28, metalness: 0.85 });
  const pullTabMat = new THREE.MeshStandardMaterial({ color: 0x101215, roughness: 0.55, metalness: 0.1 });
  const mpoBody = new THREE.MeshStandardMaterial({ color: 0x2fb6c9, roughness: 0.4, metalness: 0.3 });
  const elsMetal = new THREE.MeshStandardMaterial({ color: 0xbcc2c9, roughness: 0.3, metalness: 0.7 });
  const fiberAqua = new THREE.MeshStandardMaterial({ color: 0x3fd1c8, roughness: 0.5, metalness: 0.1 });
  const trunkJacket = new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.6 });
  const portLedItems = [];                              // link LEDs on the switch ports (the racks keep ledItems)
  // one bank of pluggable OSFP cages + modules on a network-rack face at (cx, cz), front normal +z*fs
  function pluggableFace(cx, cz, fs, { rows = 2, cols = 6, y0 = 1.55, y1 = 1.95, w = 0.46 } = {}) {
    const dv = (y1 - y0) / rows, du = w / cols, faceZ = cz + fs * 0.6;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = cx - w / 2 + du * (c + 0.5), y = y0 + dv * (r + 0.5);
      N.box(du * 0.82, dv * 0.78, 0.05, MAT.darkSteel, x, y, faceZ + fs * 0.015);        // cage, set into the face
      N.box(du * 0.6, dv * 0.5, 0.09, moduleMetal, x, y, faceZ + fs * 0.075);            // module body, protrudes
      N.box(du * 0.56, dv * 0.22, 0.02, pullTabMat, x, y - dv * 0.18, faceZ + fs * 0.13); // pull tab
      portLedItems.push({ p: [x + du * 0.16, y + dv * 0.22, faceZ + fs * 0.11], color: (r + c) % 3 ? '#5cf29a' : '#ffb347', rate: 0.35 + ((r * cols + c) * 0.37) % 1.2 });
    }
  }
  // the co-packaged optics switch: dense MPO connectors flush on the chassis, external laser source modules, no pluggables
  function cpoFace(cx, cz, fs) {
    const y0 = 1.5, y1 = 1.98, rows = 5, cols = 8, w = 0.5, dv = (y1 - y0) / rows, du = w / cols, faceZ = cz + fs * 0.6;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = cx - w / 2 + du * (c + 0.5), y = y0 + dv * (r + 0.5);
      N.box(du * 0.72, dv * 0.72, 0.03, mpoBody, x, y, faceZ + fs * 0.02);               // MPO connector, near flush
    }
    for (let i = 0; i < 3; i++) {                                                        // external laser source modules
      const x = cx - 0.16 + i * 0.16;
      N.box(0.13, 0.09, 0.1, elsMetal, x, 2.1, faceZ + fs * 0.06);
      N.box(0.09, 0.02, 0.02, glowMat('#ffb347', 1.3), x, 2.1, faceZ + fs * 0.115);
    }
    for (const [dx, mat] of [[-0.2, MAT.pipeBlue], [0.2, MAT.pipeRed]])                   // liquid cooling to a floor manifold
      N.strut([cx + dx, 1.15, faceZ + fs * 0.06], [cx + dx, 0.15, faceZ + fs * 0.35], 0.03, mat, 8);
  }
  // thin fiber pigtails rising from a face into the overhead runway (n small strands, aqua/yellow)
  function pigtail(x, y0, z0, y1, z1, n = 4) {
    for (let i = 0; i < n; i++) { const o = (i - (n - 1) / 2) * 0.03; N.strut([x + o, y0, z0], [x + o, y1, z1], i % 2 ? 0.006 : 0.0075, i % 2 ? MAT.yellowTray : fiberAqua, 5); }
  }
  // fewer, thicker MPO trunk cables from the CPO switch (no per-port pigtails, since there are no pluggables)
  function trunkCable(x, y0, z0, y1, z1) { for (const o of [-0.05, 0.05]) N.strut([x + o, y0, z0], [x + o, y1, z1], 0.018, trunkJacket, 6); }
  // a compute rack's uplinks, drawn as a small fiber bundle riser (the eth data flow already carries the traffic)
  function fiberBundle(x, y0, z0, y1, z1, n = 5) {
    for (let i = 0; i < n; i++) { const o = (i - (n - 1) / 2) * 0.035; N.strut([x + o, y0, z0 + o * 0.3], [x + o, y1, z1 + o * 0.3], 0.008, i % 2 ? MAT.yellowTray : fiberAqua, 5); }
  }

  // ---------- site, slab, walls (section cut) ----------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), MAT.ground); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.35; ground.receiveShadow = true; scene.add(ground);   // below the site pad, never flush with it
  S.slab(X1 - X0 + 20, 0.3, Z1 - Z0 + 14, MAT.concreteDark, -5, -0.3, 0);
  S.slab(X1 - X0, 0.35, Z1 - Z0, MAT.slab, (X0 + X1) / 2, -0.2, 0);                 // floor slab
  const cut = MAT.concrete, cutTop = glowMat('#d9dde2', 0.9);
  S.slab(X1 - X0 + 0.6, WALL_H, 0.3, MAT.wall, (X0 + X1) / 2, 0, Z0 - 0.15);          // back wall
  // every wall but the back one is cut at 3.2 m, like a section drawing; cut faces are lit
  const CUT_H = 3.2;
  const cutWall = (w, d, x, z) => { S.slab(w, CUT_H, d, MAT.wall, x, 0, z); N.slab(w, 0.02, d, cutTop, x, CUT_H, z); };
  cutWall(0.3, Z1 - Z0, X0 - 0.15, 0);                                                  // west exterior wall
  cutWall(0.3, Z1 - Z0, X1 + 0.15, 0);                                                  // east wall
  cutWall(0.3, 14, PART, Z0 + 7); cutWall(0.3, 12, PART, Z1 - 6);                       // partition with an opening
  S.slab(X1 - X0 + 0.6, 1.0, 0.3, cut, (X0 + X1) / 2, 0, Z1 + 0.15);                  // front wall, cut low
  N.slab(X1 - X0 + 0.6, 0.02, 0.3, cutTop, (X0 + X1) / 2, 1.0, Z1 + 0.15);
  // roof steel only along the back wall, cut short
  for (let x = X0 + 3; x < X1; x += 6) N.box(0.14, 0.5, 3, MAT.darkSteel, x, WALL_H - 0.25, Z0 + 1.5);
  // exterior louvers on the west wall of the electrical room
  for (let y = 1.6; y < 3.0; y += 0.2) N.box(0.08, 0.05, 8, MAT.darkSteel, X0 - 0.35, y, 6);

  // ---------- unit substation outside the west wall ----------
  const usX = -42, usZ = -10;
  S.slab(6, 0.3, 6, MAT.concrete, usX, 0, usZ);
  S.slab(2.6, 2.3, 2.4, MAT.ansi61, usX, 0.3, usZ);
  for (let f = 0; f < 9; f++) { N.slab(0.05, 1.6, 0.7, MAT.ansi61, usX - 1.1 + f * 0.27, 0.6, usZ - 1.55); N.slab(0.05, 1.6, 0.7, MAT.ansi61, usX - 1.1 + f * 0.27, 0.6, usZ + 1.55); }
  for (const dz of [-0.7, 0, 0.7]) insulator(N, usX - 0.9, 2.6, usZ + dz, 0.6, 0.08, MAT.porcelain, { sheds: 4 });
  S.slab(1.2, 0.8, 1.6, MAT.ansi61, usX + 1.6, 1.4, usZ);                            // LV throat
  S.box(5.6, 0.5, 0.6, MAT.alu, usX + 4.6, 2.2, usZ);                                   // bus duct to the wall
  flows.push(flow([[usX - 3, -0.2, usZ], [usX - 0.9, 0.5, usZ], [usX - 0.9, 2.9, usZ]], 'mv', { count: 6, speed: 1.5, size: 0.11, trailR: 0.03 }));

  // ---------- electrical room ----------
  // rounded cabinet: a smooth painted body (merged into S, one draw call per material) plus a flat
  // textured front panel held a hair proud of the body so the two never go coplanar.
  const cabinetRow = (n, w, h, d, tex, x0, z, facing = 1) => {
    const bw = n * w;
    const sideColor = tex === TEX.swgr || (tex === TEX.cdu && !air) || (tex === TEX.ups && dc) ? 0xc3c7ca : 0x2b2f35;
    const bodyMat = new THREE.MeshStandardMaterial({ color: sideColor, roughness: 0.55, metalness: 0.22 });
    rbox(S, bw - 0.05, h - 0.02, d - 0.05, bodyMat, x0 + bw / 2, h / 2, z, { r: 0.05, ry: facing < 0 ? Math.PI : 0 });
    const t = tex.clone(); t.repeat.set(n, 1); t.needsUpdate = true;
    // the dim hall key/fill leaves a dark cabinet graphic near-black; lift just the panel's own texture back
    // out via a low-intensity emissive map (same texture, no extra lights, no extra draw calls or shadows)
    const frontMat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.5, metalness: 0.2, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.22 });
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(bw - 0.08, h - 0.06), frontMat);
    panel.position.set(x0 + bw / 2, h / 2, z + (d / 2 + 0.016) * facing);
    if (facing < 0) panel.rotation.y = Math.PI;
    panel.receiveShadow = true; scene.add(panel);
    return { x0, bw, h, z };
  };
  const TEX = { swgr: frontTex('swgr'), ups: frontTex(dc ? 'sst' : 'ups'), batt: frontTex('batt'), cdu: frontTex(air ? 'inrow' : 'cdu'), rack: frontTex(nvl ? 'rack' : 'rackH100'), net: frontTex('net') };
  cabinetRow(14, 0.9, 2.3, 1.5, TEX.swgr, -33.5, -15.6);                                 // 480 V switchgear against the back wall
  const upsH = dc ? 2.3 : 2.0;
  cabinetRow(3, 1.1, upsH, 1.0, TEX.ups, -33.5, -6.5); cabinetRow(3, 1.1, upsH, 1.0, TEX.ups, -29.6, -6.5); cabinetRow(3, 1.1, upsH, 1.0, TEX.ups, -25.7, -6.5);
  cabinetRow(12, 0.6, 2.0, 0.8, TEX.batt, -33.5, 1.5); cabinetRow(12, 0.6, 2.0, 0.8, TEX.batt, -33.5, 5.5, -1);
  // cable ladder over the gear: two rails and open rungs (not a solid pan), carrying bundled feeder cable;
  // bus riser from the UPS to the ceiling
  N.box(12.6, 0.25, 0.04, MAT.galv, -27.2, 3.42, -15.5); N.box(12.6, 0.25, 0.04, MAT.galv, -27.2, 3.42, -14.9);
  for (let x = -27.2 - 6.2; x <= -27.2 + 6.2; x += 0.55) N.box(0.05, 0.04, 0.6, MAT.galv, x, 3.3, -15.2);
  bundle(N, [-27.2 - 6.2, 3.32, -15.35], [-27.2 + 6.2, 3.32, -15.35], { n: 10, r: 0.017, spread: 0.11, sag: 0.025, mats: [MAT.black, MAT.darkSteel, MAT.copper], seed: 3 });
  bundle(N, [-27.2 - 6.2, 3.32, -15.05], [-27.2 + 6.2, 3.32, -15.05], { n: 7, r: 0.015, spread: 0.09, sag: 0.02, mats: [MAT.black, MAT.pipeBlue], seed: 7 });
  S.box(0.5, 3.6, 0.6, MAT.alu, -22.5, 3.8, -6.5);                                       // riser
  S.box(10.3, 0.5, 0.6, MAT.alu, -17.4, 5.6, -6.5);                                      // main busway to the hall
  for (let i = 0; i < 4; i++) N.strut([-20 + i * 2.6, 5.85, -6.5], [-20 + i * 2.6, WALL_H - 0.9, -6.5], 0.02, MAT.darkSteel, 4);
  // AC: 480 V from the unit substation through switchgear and UPS. DC: medium voltage through switchgear into the SSTs, 800 V DC out
  flows.push(flow([[X0 - 1.5, 2.2, usZ], [X0 + 0.5, 2.2, usZ], [-33, 2.6, -15.2], [-21, 2.6, -15.2]], dc ? 'mv' : 'lv', { count: 16, speed: 2.4, size: 0.1, trailR: 0.03 }));
  flows.push(flow([[-21, 2.6, -15.2], [-21, 2.6, -9], [-30.5, 2.2, -7]], dc ? 'mv' : 'lv', { count: 12, speed: 2.4, size: 0.1, trailR: 0.03 }));
  flows.push(flow([[-30.5, 2.2, -7], [-22.5, 2.2, -6.5], [-22.5, 5.6, -6.5], [-12.2, 5.6, -6.5]], itV, { count: 14, speed: 2.4, size: 0.1, trailR: 0.03 }));
  person(N, -27, -12.5, 0.3); person(N, -29.5, 3.6, 2.4);

  // ---------- data hall: three contained pods, six rows ----------
  const rowX0 = -7.2, groups = 4, perGroup = 8, RW = 0.6, CW = 0.8, GAP = 0.6;
  const rowZs = [-11.2, -8.2, -4.6, -1.6, 2.0, 5.0];
  const facing = [-1, 1, -1, 1, -1, 1];
  const rackMx = [], cduMx = [], rowEnds = [];
  rowZs.forEach((z, r) => {
    let x = rowX0;
    for (let gI = 0; gI < groups; gI++) {
      cduMx.push({ x: x + CW / 2, z, f: facing[r] }); x += CW;
      for (let i = 0; i < perGroup; i++) { rackMx.push({ x: x + RW / 2, z, f: facing[r] }); x += RW; }
      x += GAP;
    }
    rowEnds.push(x - GAP);
  });
  const rowX1 = rowEnds[0];
  const instanced = (w, h, d, tex, sideColor, items) => {
    const front = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: 0.3 });
    const side = new THREE.MeshStandardMaterial({ color: sideColor, roughness: 0.5, metalness: 0.35 });
    const geo = new THREE.BoxGeometry(w, h, d); geo.translate(0, h / 2, 0);
    const m = new THREE.InstancedMesh(geo, [side, side, side, side, front, side], items.length);
    items.forEach((it, i) => m.setMatrixAt(i, mtx(it.x, 0.0, it.z, it.f > 0 ? 0 : Math.PI)));
    m.castShadow = m.receiveShadow = true; scene.add(m); return m;
  };
  instanced(RW - 0.02, 2.3, 1.2, TEX.rack, 0x131519, rackMx);
  // CDU / in-row cooler cabinets: rounded bodies merge straight into S (no extra draw call), the shared
  // front graphic rides as one instanced panel held proud of every body by the same gap as the electrical room.
  {
    const cduH = 2.3, cduBody = new THREE.MeshStandardMaterial({ color: 0xc9ccce, roughness: 0.55, metalness: 0.25 });
    cduMx.forEach(it => rbox(S, CW - 0.02 - 0.05, cduH - 0.02, 1.2 - 0.05, cduBody, it.x, cduH / 2, it.z, { r: 0.05, ry: it.f > 0 ? 0 : Math.PI }));
    const cduFront = new THREE.MeshStandardMaterial({ map: TEX.cdu, roughness: 0.5, metalness: 0.2 });
    const cduFrontGeo = new THREE.PlaneGeometry(CW - 0.02 - 0.08, cduH - 0.06); cduFrontGeo.translate(0, cduH / 2, 1.2 / 2 + 0.016);
    const cduPanels = new THREE.InstancedMesh(cduFrontGeo, cduFront, cduMx.length);
    cduMx.forEach((it, i) => cduPanels.setMatrixAt(i, mtx(it.x, 0, it.z, it.f > 0 ? 0 : Math.PI)));
    cduPanels.receiveShadow = true; scene.add(cduPanels);
  }
  // hot aisle containment: glass roof and end doors per pod
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xa8c4dd, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide });
  for (let p = 0; p < 3; p++) {
    const za = rowZs[p * 2], zb = rowZs[p * 2 + 1], zc = (za + zb) / 2, aisle = Math.abs(zb - za) - 1.2;
    const roofM = new THREE.Mesh(new THREE.BoxGeometry(rowX1 - rowX0, 0.04, aisle), glass); roofM.position.set((rowX0 + rowX1) / 2, 2.35, zc); scene.add(roofM);
    for (const x of [rowX0 - 0.02, rowX1 + 0.02]) {
      const d = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.3, aisle), glass); d.position.set(x, 1.15, zc); scene.add(d);
      N.box(0.06, 2.3, 0.06, MAT.darkSteel, x, 1.15, zc - aisle / 2); N.box(0.06, 2.3, 0.06, MAT.darkSteel, x, 1.15, zc + aisle / 2); N.box(0.06, 0.06, aisle, MAT.darkSteel, x, 2.33, zc);
      N.box(0.05, 2.24, 0.05, MAT.darkSteel, x, 1.15, zc);                                // center mullion: two door leaves, not one sheet of glass
      N.box(0.03, 0.22, 0.05, MAT.black, x, 1.05, zc - aisle / 4); N.box(0.03, 0.22, 0.05, MAT.black, x, 1.05, zc + aisle / 4); // door handles
    }
    for (let x = rowX0; x <= rowX1; x += 1.2) N.box(0.04, 0.05, aisle, MAT.darkSteel, x, 2.37, zc);
  }
  // overhead busway per row with tap-off boxes and drops
  const tap = glowMat(dc ? '#d8f04a' : '#ff8a3d', 0.9);
  rowZs.forEach((z, r) => {
    const bz = z + facing[r] * 0.25;
    S.box(rowX1 - rowX0 + 5, 0.22, 0.18, MAT.alu, (rowX0 + rowX1) / 2 - 2.5, 3.5, bz);
    for (let x = rowX0 + 0.3; x < rowX1; x += 2 * RW) N.strut([x, 3.6, bz], [x, WALL_H - 0.9, bz], 0.012, MAT.darkSteel, 4);
    rackMx.filter(k => k.z === z).forEach(k => { N.box(0.22, 0.2, 0.2, tap, k.x, 3.29, bz); N.strut([k.x, 3.2, bz], [k.x, 2.3, bz], 0.018, MAT.black, 5); });
    flows.push(flow([[-12.2, 5.6, -6.5], [-9.5, 5.6, -6.5], [-9.5, 3.5, bz], [rowX1, 3.5, bz]], itV, { count: 20, speed: 2.2, size: 0.07, trailR: 0.02, trailK: 0.25 }));
  });
  // yellow fiber runway over the rows and a trunk to the network spine
  rowZs.forEach(z => { N.box(rowX1 - rowX0, 0.04, 0.3, MAT.yellowTray, (rowX0 + rowX1) / 2, 4.3, z); N.box(rowX1 - rowX0, 0.1, 0.02, MAT.yellowTray, (rowX0 + rowX1) / 2, 4.35, z - 0.15); N.box(rowX1 - rowX0, 0.1, 0.02, MAT.yellowTray, (rowX0 + rowX1) / 2, 4.35, z + 0.15); });
  N.box(0.3, 0.04, 23, MAT.yellowTray, rowX0 - 1.3, 4.3, -1.6);
  // network spine racks along the front
  const netItems = []; for (let i = 0; i < 10; i++) netItems.push({ x: rowX0 + 2 + i * 0.62, z: 10.5, f: 1 });
  instanced(0.6, 2.3, 1.2, TEX.net, 0x131519, netItems);
  // spine faceplates: one CPO switch (liquid-cooled, MPO direct on the chassis), the rest pluggable OSFP
  const CPO_I = 5;
  netItems.forEach((it, i) => {
    if (i === CPO_I) { cpoFace(it.x, it.z, it.f); trunkCable(it.x, 2.0, it.z + it.f * 0.66, 4.3, it.z); }
    else { pluggableFace(it.x, it.z, it.f); pigtail(it.x, 1.97, it.z + it.f * 0.735, 4.3, it.z); }
  });
  N.box(6.4, 0.04, 0.3, MAT.yellowTray, rowX0 + 4.8, 4.3, 10.5); N.box(0.3, 0.04, 3.5, MAT.yellowTray, rowX0 - 1.3, 4.3, 8.3);
  // fiber distribution frames: every fabric link is patched here, between the spine row and the cross-hall sleeve
  const odfTex = canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = '#d7dadd'; g.fillRect(0, 0, w, h);
    for (let y = 16; y < h - 16; y += 14) { g.fillStyle = '#b9bec3'; g.fillRect(12, y, w - 24, 11); for (let x = 16; x < w - 16; x += 6) { g.fillStyle = (x + y) % 5 ? '#2e8fd6' : '#e8c547'; g.fillRect(x, y + 3, 3, 5); } }
    g.fillStyle = 'rgba(230,190,40,0.55)'; for (let i = 0; i < 26; i++) { const x = 20 + i * 8.5; g.fillRect(x, 0, 2, h * (0.35 + 0.5 * ((i * 37) % 11) / 11)); }
  });
  const odfItems = []; for (let i = 0; i < 8; i++) odfItems.push({ x: rowX0 + 1.2 + i * 0.92, z: 14.2, f: 1 });
  const odfFront = new THREE.MeshStandardMaterial({ map: odfTex, roughness: 0.6, metalness: 0.1 });
  const odfSide = new THREE.MeshStandardMaterial({ color: 0xd3d6d9, roughness: 0.6, metalness: 0.1 });
  const odfGeo = new THREE.BoxGeometry(0.88, 2.2, 0.6); odfGeo.translate(0, 1.1, 0);
  const odf = new THREE.InstancedMesh(odfGeo, [odfSide, odfSide, odfSide, odfSide, odfFront, odfSide], odfItems.length);
  odfItems.forEach((it, i) => odf.setMatrixAt(i, mtx(it.x, 0, it.z)));
  odf.castShadow = odf.receiveShadow = true; scene.add(odf);
  N.box(0.3, 0.04, 3.7, MAT.yellowTray, rowX0 + 4.8, 4.3, 12.35);                         // runway spine row → frames
  N.box(7.8, 0.04, 0.3, MAT.yellowTray, rowX0 + 4.4, 4.3, 14.2);
  odfItems.forEach(it => { for (const dx of [-0.25, 0, 0.25]) N.strut([it.x + dx, 4.28, 14.2], [it.x + dx, 2.2, 14.2], 0.02, MAT.yellowTray, 5); });
  // floor sleeve where the cross-hall cables drop into the duct bank
  const sleeveX = rowX0 + 9.4, sleeveZ = 14.2;
  S.cyl(0.36, 0.12, MAT.darkSteel, sleeveX, 0.2, sleeveZ, 20);
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; N.strut([sleeveX + Math.cos(a) * 0.16, 4.3, sleeveZ + Math.sin(a) * 0.16], [sleeveX + Math.cos(a) * 0.16, 0.1, sleeveZ + Math.sin(a) * 0.16], 0.045, MAT.yellowTray, 8); }
  N.box(1.4, 0.04, 0.3, MAT.yellowTray, sleeveX - 0.6, 4.3, sleeveZ);
  // scale-out: a leaf-switch rack at the end of every row, a cross runway to the spine row
  const leafX = rowX1 + 0.45;
  instanced(0.6, 2.3, 1.2, TEX.net, 0x131519, rowZs.map((z, r) => ({ x: leafX, z, f: facing[r] })));
  // leaf faceplates: pluggable OSFP modules, fiber pigtails rising into the runway overhead
  rowZs.forEach((z, r) => { pluggableFace(leafX, z, facing[r]); pigtail(leafX, 1.97, z + facing[r] * 0.735, 4.5, z); });
  N.box(0.3, 0.04, 23, MAT.yellowTray, leafX, 4.5, -0.8); N.box(0.02, 0.1, 23, MAT.yellowTray, leafX - 0.15, 4.55, -0.8); N.box(0.02, 0.1, 23, MAT.yellowTray, leafX + 0.15, 4.55, -0.8);
  N.box(leafX - rowX0 - 3, 0.04, 0.3, MAT.yellowTray, (leafX + rowX0 + 3) / 2, 4.5, 10.5);
  // patch panels on the spine row
  for (let i = 0; i < 10; i++) N.box(0.5, 0.18, 0.08, MAT.white, rowX0 + 2 + i * 0.62, 2.38, 11.1);
  // k tuned down from the pre-mood-lighting default (2.6): at hotspot zoom a marker this bright fills enough
  // screen space that hall's own bloom (tuned for the fixtures) blows it into an oversized blurred sphere;
  // same hue and path, just under the bloom knee at close range
  const eth = (pts, n, s = 0.09) => dataFlows.push(flow(pts, 'eth', { count: n, speed: 2.4, size: s, k: 1.5, trailR: 0.03, trailK: 0.5 }));
  rowZs.forEach((z, r) => {
    const mid = rackMx.filter(k => k.z === z)[10];
    eth([[mid.x, 2.35, z], [mid.x, 4.3, z], [leafX, 4.3, z], [leafX, 2.35, z]], 14);          // racks to the leaf
    eth([[leafX, 2.35, z + 0.2], [leafX, 4.5, z + 0.2], [leafX, 4.5, 10.5], [rowX0 + 5, 4.5, 10.5], [rowX0 + 5, 2.35, 10.5]], 22); // leaf to spine
    fiberBundle(mid.x, 2.32, z, 4.3, z);                                                      // rack uplink, drawn as fiber
    fiberBundle(leafX, 4.3, z, 1.97, z + facing[r] * 0.7);                                     // runway down into the leaf face
  });
  // fan wall on the east side
  S.slab(1.2, 6, 26, MAT.darkSteel, X1 - 1.0, 0, -3);
  const wallFans = [];
  for (let yi = 0; yi < 4; yi++) for (let zi = 0; zi < 14; zi++) { N.cylX(0.62, 0.1, MAT.fan, X1 - 1.65, 1.1 + yi * 1.4, -15 + zi * 1.8, 18); N.cylX(0.66, 0.06, MAT.galv, X1 - 1.62, 1.1 + yi * 1.4, -15 + zi * 1.8, 18); wallFans.push({ p: [X1 - 1.76, 1.1 + yi * 1.4, -15 + zi * 1.8], axis: 'x', r: 0.56 }); }
  const fans = spinners(wallFans, MAT.darkSteel, { speed: 4 }); scene.add(fans.mesh);
  // facility water: insulated headers along the back wall, drops to every CDU
  const hdrY = 6.2;
  S.cylX(0.26, rowX1 - rowX0 + 12, MAT.pipeBlue, (rowX0 + rowX1) / 2 - 3, hdrY, -16.4, 16);
  S.cylX(0.26, rowX1 - rowX0 + 12, MAT.pipeRed, (rowX0 + rowX1) / 2 - 3, hdrY - 0.7, -16.4, 16);
  for (let x = rowX0 - 9; x < rowX1 + 3; x += 5) N.strut([x, hdrY + 0.2, -16.4], [x, WALL_H - 0.9, -16.4], 0.03, MAT.darkSteel, 4);
  cduMx.forEach(c => {
    N.strut([c.x - 0.15, hdrY, -16.4], [c.x - 0.15, hdrY, c.z], 0.07, MAT.pipeBlue, 8); N.strut([c.x - 0.15, hdrY, c.z], [c.x - 0.15, 2.3, c.z], 0.07, MAT.pipeBlue, 8);
    N.strut([c.x + 0.15, hdrY - 0.7, -16.4], [c.x + 0.15, hdrY - 0.7, c.z], 0.07, MAT.pipeRed, 8); N.strut([c.x + 0.15, hdrY - 0.7, c.z], [c.x + 0.15, 2.3, c.z], 0.07, MAT.pipeRed, 8);
    N.cylZ(0.12, 0.08, MAT.orange, c.x - 0.15, hdrY - 0.35, c.z, 12);                      // valve handwheel
  });
  // rack loop from each CDU along its rack group, over the rack tops (liquid-cooled racks only)
  if (!air) rowZs.forEach((z, r) => {
    const lz = z - facing[r] * 0.35;
    for (let gI = 0; gI < groups; gI++) {
      const x0 = rowX0 + gI * (CW + perGroup * RW + GAP), x1 = x0 + CW + perGroup * RW;
      N.cylX(0.035, x1 - x0, MAT.pipeBlue, (x0 + x1) / 2, 2.45, lz - 0.05, 8); N.cylX(0.035, x1 - x0, MAT.pipeRed, (x0 + x1) / 2, 2.45, lz + 0.05, 8);
      if (r % 2 === 0 && gI % 2 === 0) {
        flows.push(flow([[x0 + CW / 2, 2.45, lz - 0.05], [x1, 2.45, lz - 0.05]], 'cool', { count: 8, speed: 1.2, size: 0.05, k: 1.6, trail: false }));
        flows.push(flow([[x1, 2.45, lz + 0.05], [x0 + CW / 2, 2.45, lz + 0.05]], 'warm', { count: 8, speed: 1.2, size: 0.05, k: 1.6, trail: false }));
      }
    }
  });
  flows.push(flow([[X0 + 2, hdrY, -16.4], [rowX1 + 2, hdrY, -16.4]], 'cool', { count: 24, speed: 3, size: 0.12, k: 1.6, trail: false }));
  flows.push(flow([[rowX1 + 2, hdrY - 0.7, -16.4], [X0 + 2, hdrY - 0.7, -16.4]], 'warm', { count: 24, speed: 3, size: 0.12, k: 1.6, trail: false }));
  // ---------- heat layer ----------
  heatFlows.push(flow([[X0 + 2, hdrY + 3, -16.4], [X0 + 2, hdrY, -16.4], [rowX1 + 2, hdrY, -16.4]], 'cool', { count: 36, speed: 3, size: 0.14, k: 2.4, trailR: 0.1, trailK: 0.4 }));
  heatFlows.push(flow([[rowX1 + 2, hdrY - 0.7, -16.4], [X0 + 2.8, hdrY - 0.7, -16.4], [X0 + 2.8, hdrY + 2.8, -16.4]], 'warm', { count: 36, speed: 3, size: 0.14, k: 2.4, trailR: 0.1, trailK: 0.4 }));
  cduMx.forEach(c => {
    heatFlows.push(flow([[c.x - 0.15, hdrY, -16.4], [c.x - 0.15, hdrY, c.z], [c.x - 0.15, 2.3, c.z]], 'cool', { count: 5, speed: 2.2, size: 0.13, k: 1.5, trail: false }));
    heatFlows.push(flow([[c.x + 0.15, 2.3, c.z], [c.x + 0.15, hdrY - 0.7, c.z], [c.x + 0.15, hdrY - 0.7, -16.4]], 'warm', { count: 5, speed: 2.2, size: 0.13, k: 1.5, trail: false }));
  });
  if (!air) rowZs.forEach((z, r) => {
    const lz = z - facing[r] * 0.35;
    for (let gI = 0; gI < groups; gI++) {
      const x0 = rowX0 + gI * (CW + perGroup * RW + GAP), x1 = x0 + CW + perGroup * RW;
      heatFlows.push(flow([[x0 + CW / 2, 2.45, lz - 0.05], [x1, 2.45, lz - 0.05]], 'cool', { count: 6, speed: 1.2, size: 0.1, k: 1.5, trail: false }));
      heatFlows.push(flow([[x1, 2.45, lz + 0.05], [x0 + CW / 2, 2.45, lz + 0.05]], 'warm', { count: 6, speed: 1.2, size: 0.1, k: 1.5, trail: false }));
    }
  });
  // hot air: along each contained aisle, out the end, through the fan wall, back cool
  for (let p = 0; p < 3; p++) {
    const zc = (rowZs[p * 2] + rowZs[p * 2 + 1]) / 2;
    for (const y of [0.8, 1.5, 2.1]) heatFlows.push(flow([[rowX0 + 1, y, zc], [rowX1 + 1.2, y + 0.4, zc], [X1 - 1.8, y + 1.2, zc]], 'air', { count: 16, speed: 2.2, size: 0.13, k: 1.5, opacity: 0.9, trail: false }));
    heatFlows.push(flow([[X1 - 2.2, 0.7, zc + 3.3], [rowX0 + 2, 0.5, zc + 3.3]], 'cool', { count: 14, speed: 2.0, size: 0.12, k: 2.0, opacity: 0.6, trail: false }));
  }
  // spine → frames → the other hall
  dataFlows.push(flow([[rowX0 + 4.8, 4.4, 10.5], [rowX0 + 4.8, 4.4, 14.2], [rowX0 + 8.2, 4.4, 14.2], [rowX0 + 9.4, 4.4, 14.2], [rowX0 + 9.4, 0.1, 14.2]], 'eth', { count: 22, speed: 2.2, size: 0.09, k: 1.5, trailR: 0.03, trailK: 0.5 }));
  for (let i = 0; i < 8; i += 2) dataFlows.push(flow([[rowX0 + 1.2 + i * 0.92, 4.4, 14.2], [rowX0 + 1.2 + i * 0.92, 2.2, 14.2]], 'eth', { count: 4, speed: 1.4, size: 0.06, k: 1.5, trail: false }));
  // ---------- parallelism overlay (data layer): stages and replicas on the rack tops ----------
  const stageCol = ['#ff5fd2', '#c77dff', '#7c9cff', '#5ce1c6'];
  const par = new THREE.Group();
  const stageMats = stageCol.map(c => glowMat(c, 1.1, 0.85));
  const tintGeo = new THREE.BoxGeometry(RW - 0.08, 0.03, 1.0), tints = [[], [], [], []];
  rowZs.forEach((z, r) => {
    const racks = rackMx.filter(k => k.z === z);
    racks.forEach((k, i) => {
      tints[i % 4].push(mtx(k.x, 2.34, z));                       // one instanced mesh per stage color, not one mesh per rack
      if (i % 4 !== 3 && r >= 4) dataFlows.push(flow([[k.x, 2.5, z], [racks[i + 1].x, 2.5, z]], 'eth', { count: 2, speed: 0.6, size: 0.05, k: 1.5, trail: false }));
    });
  });
  tints.forEach((list, c) => { const m = new THREE.InstancedMesh(tintGeo, stageMats[c], list.length); list.forEach((mx, n) => m.setMatrixAt(n, mx)); par.add(m); });
  const front = rackMx.filter(k => k.z === rowZs[5]);
  ['1', '2', '3', '4'].forEach((t, i) => { const s = textSprite(t, stageCol[i], 0.28); s.position.set(front[i].x, 2.75, rowZs[5] + 0.6); par.add(s); });
  for (let g = 0; g < 4; g++) { const s = textSprite(`replica ${g + 1}`, g ? '#a6f35a' : '#e8ecf2', 0.3); s.position.set((front[g * 4 + 1].x + front[g * 4 + 2].x) / 2, 3.25, rowZs[5] + 0.6); par.add(s); }
  scene.add(par);
  // headers leave through the roof to the dry coolers
  S.cyl(0.26, 3, MAT.pipeBlue, X0 + 2, hdrY + 1.4, -16.4, 16); S.cyl(0.26, 3.6, MAT.pipeRed, X0 + 2.8, hdrY + 1.1, -16.4, 16);

  // ---------- lighting fixtures, activity and finishing detail ----------
  // ceiling fixtures: warm pools over the power room, cool white rows over the data hall aisles
  const roomLampZs = quality.mobile ? [-9] : [-13, -6.5, 2];
  const roomLampItems = [];
  for (let x = -37; x <= -23; x += quality.mobile ? 8 : 4) for (const lz of roomLampZs) roomLampItems.push({ p: [x, 6.9, lz], w: 1.1, d: 1.0 });
  scene.add(lamps(roomLampItems, { color: '#ffcf9e', k: 2.0, halo: 1.8, haloOpacity: 0.28 }));
  const hallLampZs = [-14, -6.4, 0.2, 8].filter((_, i) => !quality.mobile || i % 2 === 0);
  const hallLampItems = [];
  hallLampZs.forEach(lz => { for (let x = rowX0 - 3; x <= leafX + 3; x += quality.mobile ? 8 : 4) hallLampItems.push({ p: [x, 6.2, lz], w: 1.3, d: 0.5 }); });
  scene.add(lamps(hallLampItems, { color: '#dce8ff', k: 1.9, halo: 1.8, haloOpacity: 0.26 }));

  // sprinkler branch lines with pendant heads, over the aisles
  [-9, -2.4, 4.2].forEach(sz => {
    N.cylX(0.035, rowX1 - rowX0 + 2, MAT.galv, (rowX0 + rowX1) / 2, 6.7, sz, 8);
    for (let x = rowX0 - 1; x <= rowX1 + 1; x += 3) { N.cyl(0.018, 0.12, MAT.darkSteel, x, 6.6, sz, 6); N.cyl(0.05, 0.02, MAT.orange, x, 6.53, sz, 8); }
  });

  // cool LED strips along every rack top (a thin glowing line, distinct from the canvas texture's static dots)
  const ledStrip = glowMat('#8fe4ff', 1.6, 1);
  rowZs.forEach(z => N.box(rowX1 - rowX0, 0.012, 0.05, ledStrip, (rowX0 + rowX1) / 2, 2.312, z));

  // rack-front status LEDs, blinking at their own rate; modest count, fewer on phones
  const perRackLed = quality.mobile ? 1 : 2;
  const ledItems = [];
  rackMx.forEach((k, i) => {
    if (quality.mobile && i % 2) return;
    for (let j = 0; j < perRackLed; j++) ledItems.push({
      p: [k.x + (j - (perRackLed - 1) / 2) * 0.1, 0.3 + ((i * 7 + j * 5) % 15) / 15 * 1.6, k.z + k.f * 0.61],
      color: (i * 3 + j) % 11 === 0 ? '#ff5a5a' : '#5cf29a',
      rate: 0.25 + ((i * 13 + j * 5) % 10) / 10 * 1.3, duty: 0.5,
    });
  });
  const rackLeds = blinkers(ledItems, { size: 0.022, k: 3 });
  scene.add(rackLeds.mesh);

  // people walking the aisles (in addition to the standing figures below)
  const walkers = quality.mobile
    ? [[[rowX0 - 1, 0, -6.4], [rowX1 + 1, 0, -6.4], [rowX0 - 1, 0, -6.4]]]
    : [[[rowX0 - 1, 0, -6.4], [rowX1 + 1, 0, -6.4], [rowX0 - 1, 0, -6.4]], [[rowX1 + 1, 0, 0.2], [rowX0 - 1, 0, 0.2], [rowX1 + 1, 0, 0.2]]];
  const strollers = movers(b => person(b, 0, 0, 0), walkers, { speed: 1.1 });
  scene.add(strollers.group);

  // faint warm air rising in the hot aisles: purely atmospheric, additive and subtle
  const plumeEmitters = [];
  for (let p = 0; p < 3; p++) {
    const za = rowZs[p * 2], zb = rowZs[p * 2 + 1], zc = (za + zb) / 2;
    for (const dz of quality.mobile ? [0] : [-2.5, 2.5]) plumeEmitters.push({ p: [(rowX0 + rowX1) / 2, 2.0, zc + dz], dir: [0, 1, 0] });
  }
  const hotPlumes = plumes(plumeEmitters, { perEmitter: quality.mobile ? 8 : 16, size: 0.5, grow: 2.4, life: 5, rise: 0.35, drift: [0.15, 0, 0], spread: 0.5, color: '#ffb37a', opacity: 0.16, additive: true });
  scene.add(hotPlumes.points);

  // polished-concrete floor tile joints
  const tileTex = canvasTex(64, 64, (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(8,10,12,0.4)'; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, h - 2); }, { repeat: [Math.round((X1 - X0) / 0.6), Math.round((Z1 - Z0) / 0.6)] });
  const tiles = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, Z1 - Z0), new THREE.MeshBasicMaterial({ map: tileTex, transparent: true, depthWrite: false, opacity: 0.9 }));
  tiles.rotation.x = -Math.PI / 2; tiles.position.set((X0 + X1) / 2, 0.17, 0); scene.add(tiles);

  // polished-concrete floor reflection, a hair above the slab, desktop only
  if (quality.reflections) scene.add(floorMirror(X1 - X0 - 1, Z1 - Z0 - 1, { x: (X0 + X1) / 2, y: 0.155, z: 0, res: 0.85, strength: 0.11, blur: 0.7, tint: '#93a6bf' }));

  // light fixtures over the aisles: standing figures for scale
  person(N, rowX0 + 6, -6.4, 0.4); person(N, rowX0 + 14, 0.2, 2.6); person(N, rowX0 + 3.5, 8.6, -0.6);

  scene.add(S.build({ cast: true, receive: true }));
  scene.add(N.build({ cast: false, receive: true }));
  flows.forEach(f => scene.add(f.group));
  dataFlows.forEach(f => scene.add(f.group));
  heatFlows.forEach(f => scene.add(f.group));
  const leds = blinkers(portLedItems, { size: 0.014 });
  scene.add(leds.mesh);

  const midRow = rackMx[Math.floor(rackMx.length / 2)];
  return {
    scene, flows,
    camera: { pos: [-38, 34, 44], target: [-4, 1, -2], near: 0.1, far: 2000, min: 4, max: 140 },
    hotspots: {
      unitsub: { pos: [usX, 3.3, usZ], view: { pos: [-52, 8, 2], target: [usX, 1.5, usZ] } },
      swgr: { pos: [-27, 2.8, -15.6], view: { pos: [-25, 6, -4], target: [-27, 1.3, -15.6] } },
      [dc ? 'sst' : 'ups']: { pos: [-28, 2.8, -6.5], view: { pos: [-27, 5, 2.5], target: [-28, 1, -6.5] } },
      batt: { pos: [-30, 2.4, 3.5], view: { pos: [-22, 5, 10], target: [-30, 1, 3.5] } },
      busway: { pos: [0, 3.9, -8.0], view: { pos: [-6, 7, 8], target: [2, 3.2, -8] } },
      racks: { pos: [midRow.x, 2.6, -4.6], view: { pos: [2, 4.5, 6.5], target: [4, 1.2, -4.6] } },
      containment: { pos: [6, 2.5, -9.7], view: { pos: [-11, 5, -9.2], target: [4, 1.5, -9.7] } },
      [air ? 'inrow' : 'cdu']: { pos: [cduMx[0].x, 2.7, cduMx[0].z], view: { pos: [-11, 4, -4], target: [cduMx[0].x, 1.2, cduMx[0].z] } },
      fwater: { pos: [4, 6.8, -16.4], view: { pos: [2, 7, -6], target: [4, 5.8, -16.4] } },
      fanwall: { pos: [X1 - 1.2, 6.4, -3], view: { pos: [10, 6, 10], target: [X1 - 1, 3, -3] } },
      network: { pos: [rowX0 + 5, 2.7, 10.5], view: { pos: [rowX0 + 5, 5, 18], target: [rowX0 + 5, 1.2, 10.5] } },
    },
    dataFlows, heatFlows, layers: { data: par },
    heatHotspots: {
      [air ? 'inrow' : 'cdu']: { pos: [cduMx[0].x, 2.7, cduMx[0].z], view: { pos: [-11, 4, -4], target: [cduMx[0].x, 1.2, cduMx[0].z] } },
      fwater: { pos: [4, 6.8, -16.4], view: { pos: [2, 7, -6], target: [4, 5.8, -16.4] } },
      hotaisle: { pos: [6, 2.5, -9.7], view: { pos: [-11, 5, -9.2], target: [4, 1.5, -9.7] } },
      fanwall: { pos: [X1 - 1.2, 6.4, -3], view: { pos: [10, 6, 10], target: [X1 - 1, 3, -3] } },
      riser: { pos: [X0 + 2.4, hdrY + 3.2, -16.4], view: { pos: [X0 + 10, 10, -4], target: [X0 + 2.4, 5, -16.4] } },
    },
    dataHotspots: {
      odf: { pos: [rowX0 + 4.4, 2.5, 14.5], view: { pos: [rowX0 + 11, 5.2, 23], target: [rowX0 + 5, 1.6, 12.5] } },
      crosshall: { pos: [rowX0 + 9.4, 1.2, 14.2], view: { pos: [rowX0 + 12, 3.2, 18.5], target: [rowX0 + 9.4, 1.2, 14.2] }, drill: 1 },
      pp: { pos: [front[0].x - 0.3, 2.6, rowZs[5]], view: { pos: [front[4].x, 7.5, rowZs[5] + 7.5], target: [front[4].x, 2.3, rowZs[5] - 1.5] } },
      dp: { pos: [front[6].x, 2.6, rowZs[5]], view: { pos: [front[10].x, 9, rowZs[5] + 10], target: [front[12].x, 2, rowZs[3]] } },
      uplinks: { pos: [rackMx.filter(k => k.z === -4.6)[10].x, 3.4, -4.6], view: { pos: [2, 7, 6], target: [4, 2.5, -4.6] } },
      leaf: { pos: [rowX1 + 0.45, 2.7, -1.6], view: { pos: [rowX1 - 5, 5, 8], target: [rowX1 + 0.4, 1.5, -1.6] } },
      spine: { pos: [rowX0 + 4, 2.7, 10.5], view: { pos: [rowX0 + 5, 5, 18], target: [rowX0 + 5, 1.2, 10.5] } },
      runways: { pos: [rowX1 + 0.45, 4.7, 4], view: { pos: [rowX1 - 6, 8, 12], target: [rowX1, 4, 2] } },
      optics: { pos: [leafX, 2.6, -8.2], view: { pos: [leafX + 1.0, 4.0, -4.5], target: [leafX, 1.78, -8.2] } },
      cpo: { pos: [netItems[CPO_I].x, 2.6, 10.5], view: { pos: [netItems[CPO_I].x + 1.0, 4.2, 15.5], target: [netItems[CPO_I].x, 1.8, 10.5] } },
      racks: { pos: [midRow.x, 2.6, -4.6], view: { pos: [2, 4.5, 6.5], target: [4, 1.2, -4.6] } },
    },
    // bloom stays a small bump over the family default (0.5) for mood; threshold stays near the family
    // default (1.0) rather than dropping, so ceiling fixtures and the shared dataFlow/heatFlow markers
    // don't clip into blown discs at close range (see fx.lamps' own k/halo tuning above for the fixtures)
    look: { exposure: 0.92, bloom: 0.56, threshold: 0.98, ao: 0.35, env: 'indoor', envIntensity: 0.55, dof: true },
    update(t) { fans.update(t); rackLeds.update(t); strollers.update(t); hotPlumes.update(t); leds.update(t); },
  };
}
