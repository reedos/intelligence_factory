// Scene 3: one rack. Units are meters. Front faces +z, open side faces +x.
// NVL72 class (GB200, GB300, Rubin), or four air-cooled DGX H100 servers.
import { THREE, MAT, Builder, mtx, flow, canvasTex, glowMat } from '../kit.js';

const U = 0.04445;
function trayTex(kind) {
  return canvasTex(512, 48, (g, w, h) => {
    g.fillStyle = kind === 'ps' ? '#2b2f36' : '#1b1e23'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#0d0e10'; g.fillRect(0, 0, w, 2); g.fillRect(0, h - 2, w, 2);
    if (kind === 'compute') {
      g.fillStyle = '#101216'; for (let x = 14; x < 200; x += 7) for (let y = 8; y < h - 8; y += 7) g.fillRect(x + (y % 14 ? 3 : 0), y, 4, 4);   // grille
      for (let i = 0; i < 4; i++) { g.fillStyle = '#2d323a'; g.fillRect(212 + i * 30, 10, 24, h - 20); g.fillStyle = '#5cf29a'; g.fillRect(216 + i * 30, 14, 3, 3); }
      for (let i = 0; i < 6; i++) { g.fillStyle = '#0b0c0e'; g.fillRect(340 + i * 26, 12, 20, h - 24); g.fillStyle = '#3a3f47'; g.fillRect(342 + i * 26, 14, 16, h - 28); }
      g.fillStyle = '#47cfff'; g.fillRect(w - 18, h / 2 - 2, 5, 4);
    } else if (kind === 'switch') {
      g.fillStyle = '#101216'; for (let x = 14; x < 380; x += 7) for (let y = 8; y < h - 8; y += 7) g.fillRect(x, y, 4, 4);
      g.fillStyle = '#76b900'; g.fillRect(400, 18, 60, 12);
      g.fillStyle = '#5cf29a'; g.fillRect(w - 20, h / 2 - 2, 5, 4); g.fillRect(w - 32, h / 2 - 2, 5, 4);
    } else if (kind === 'ps') {
      for (let i = 0; i < 6; i++) { const x = 6 + i * 84; g.fillStyle = '#353a42'; g.fillRect(x, 5, 78, h - 10); g.fillStyle = '#101216'; for (let gx = x + 6; gx < x + 50; gx += 5) g.fillRect(gx, 10, 3, h - 20); g.fillStyle = '#c9ccd0'; g.fillRect(x + 56, 12, 14, h - 24); g.fillStyle = '#5cf29a'; g.fillRect(x + 72, 12, 3, 3); }
    } else if (kind === 'mgmt') {
      for (let i = 0; i < 24; i++) for (let r = 0; r < 2; r++) { g.fillStyle = '#0b0c0e'; g.fillRect(40 + i * 16, 8 + r * 17, 13, 13); }
      g.fillStyle = '#e8c547'; g.fillRect(440, 16, 40, 16);
    } else {
      g.fillStyle = '#16181c'; g.fillRect(0, 0, w, h);
    }
  });
}

export function build(opts) {
  return opts.model.accel.gpusPerRack === 72 ? buildNVL(opts) : buildHGX(opts);
}

function room(scene, quality, S, N, W, H, D) {
  scene.background = new THREE.Color(0x0a0d13);
  scene.add(new THREE.HemisphereLight(0xa9bbdc, 0x15171b, 0.8));
  const key = new THREE.DirectionalLight(0xffe6c8, 2.2); key.position.set(3, 5, 4); key.target.position.set(0, 1, 0);
  if (quality.shadows) { key.castShadow = true; key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -2.5, right: 2.5, top: 3.5, bottom: -1, near: 1, far: 14 }); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.01; }
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0x6f9dff, 1.1); rim.position.set(-3, 3, -4); scene.add(rim);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.7, metalness: 0.05 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  for (let i = -8; i <= 8; i++) { N.box(0.005, 0.004, 16, MAT.darkSteel, i * 1.2, 0.004, 0); N.box(16, 0.004, 0.005, MAT.darkSteel, 0, 0.004, i * 1.2); }
  S.slab(W, H, D, MAT.rack, -0.62, 0, 0);                                         // the neighbor rack
  const X = W / 2, ZF = D / 2, ZB = -D / 2;
  for (const x of [-X + 0.02, X - 0.02]) for (const z of [ZF - 0.03, ZB + 0.03]) S.box(0.035, H, 0.035, MAT.rack, x, H / 2, z);
  S.slab(W, 0.04, D, MAT.rack, 0, H - 0.04, 0);
  S.slab(W, 0.1, D, MAT.rack, 0, 0, 0);
  S.slab(0.012, H - 0.004, D - 0.004, MAT.rackFace, -X - 0.006, 0.002, 0);
  for (const x of [-0.25, 0.25]) for (const z of [-0.45, 0.45]) N.cyl(0.025, 0.04, MAT.darkSteel, x, 0.02, z, 12);
  for (const z of [ZF - 0.06, ZB + 0.06]) for (const x of [-X + 0.05, X - 0.05]) N.box(0.012, H - 0.2, 0.012, MAT.galv, x, H / 2, z);
}

function serverTex() {
  return canvasTex(512, 180, (g, w, h) => {
    g.fillStyle = '#17191d'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#b39a6a'; g.fillRect(0, 0, w, 6); g.fillRect(0, h - 6, w, 6);                 // champagne trim
    for (let r = 0; r < 2; r++) for (let i = 0; i < 6; i++) {                                      // two rows of fan modules
      const cx = 44 + i * 84, cy = 50 + r * 80;
      g.fillStyle = '#0c0d0f'; g.beginPath(); g.arc(cx, cy, 34, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#2c3037'; g.lineWidth = 2; for (let k = 18; k < 34; k += 6) { g.beginPath(); g.arc(cx, cy, k, 0, Math.PI * 2); g.stroke(); }
    }
    g.fillStyle = '#5cf29a'; g.fillRect(w - 16, 12, 5, 5);
  });
}

// ---------- four DGX H100 servers, air-cooled ----------
function buildHGX({ quality }) {
  const scene = new THREE.Scene();
  const flows = [], dataFlows = [], heatFlows = [];
  const S = new Builder(), N = new Builder();
  const W = 0.6, D = 1.07, H = 2.25, X = W / 2, ZF = D / 2, ZB = -D / 2, base = 0.1;
  room(scene, quality, S, N, W, H, D);
  const SU = 8 * U, sw = 0.44, sd = 0.84;
  const sy = k => base + 0.06 + k * (SU + 0.004) + SU / 2;                              // server centers, bottom up
  const PULLED = 2, out = 0.46;
  const front = new THREE.MeshStandardMaterial({ map: serverTex(), roughness: 0.5, metalness: 0.35 });
  const side = new THREE.MeshStandardMaterial({ color: 0x2a2e34, roughness: 0.45, metalness: 0.6 });
  const inRack = [0, 1, 3];
  const m = new THREE.InstancedMesh(new THREE.BoxGeometry(sw, SU * 0.98, sd), [side, side, side, side, front, side], inRack.length);
  inRack.forEach((k, n) => m.setMatrixAt(n, mtx(0, sy(k), ZF - 0.07 - sd / 2)));
  m.castShadow = m.receiveShadow = true; scene.add(m);
  inRack.forEach(k => { N.box(0.03, SU * 0.9, 0.01, MAT.galv, -0.245, sy(k), ZF - 0.065); N.box(0.03, SU * 0.9, 0.01, MAT.galv, 0.245, sy(k), ZF - 0.065); });
  // management switch and blanking above
  const topY = sy(3) + SU / 2 + 0.01;
  const mg = trayTex('mgmt');
  const mgm = new THREE.Mesh(new THREE.BoxGeometry(sw, U * 0.94, 0.5), [side, side, side, side, new THREE.MeshStandardMaterial({ map: mg, roughness: 0.5, metalness: 0.35 }), side]);
  mgm.position.set(0, topY + U / 2, ZF - 0.07 - 0.25); scene.add(mgm);
  S.box(sw, H - 0.05 - topY - U, 0.01, MAT.rackFace, 0, (topY + U + H - 0.05) / 2, ZF - 0.07);

  // the pulled server, lid off: fans at the front, eight heat sinks, the CPU tray behind
  const py = sy(PULLED), pz = ZF - 0.07 - sd / 2 + out, yb = py - SU / 2;
  const pulled = new Builder();
  pulled.box(sw, 0.004, sd, MAT.galv, 0, yb + 0.004, pz);
  pulled.box(0.004, SU * 0.95, sd, MAT.galv, -sw / 2, py, pz); pulled.box(0.004, SU * 0.95, sd, MAT.galv, sw / 2, py, pz);
  pulled.box(sw - 0.02, 0.003, 0.5, MAT.pcb, 0, yb + 0.008, pz + 0.12);
  for (let i = 0; i < 6; i++) pulled.box(0.068, 0.15, 0.045, MAT.fan, -0.185 + i * 0.074, yb + 0.1, pz + sd / 2 - 0.04);
  const sinks = [];
  for (const z of [0.27, 0.1]) for (let i = 0; i < 4; i++) {
    const x = -0.162 + i * 0.108; sinks.push([x, pz + z]);
    pulled.box(0.086, 0.008, 0.13, MAT.copper, x, yb + 0.02, pz + z);
    for (let f = 0; f < 8; f++) pulled.box(0.003, 0.1, 0.128, MAT.alu, x - 0.038 + f * 0.0108, yb + 0.075, pz + z);
  }
  for (let i = 0; i < 4; i++) pulled.box(0.04, 0.045, 0.04, MAT.alu, -0.15 + i * 0.1, yb + 0.035, pz - 0.03);         // NVSwitch sinks
  pulled.box(sw - 0.02, 0.003, 0.38, MAT.pcb, 0, yb + 0.2, pz - 0.26);                                              // CPU tray, upper rear
  for (const x of [-0.1, 0.1]) { pulled.box(0.06, 0.05, 0.07, MAT.alu, x, yb + 0.23, pz - 0.24); for (const s of [-1, 1]) for (let k = 0; k < 4; k++) pulled.box(0.003, 0.03, 0.12, MAT.black, x + s * (0.045 + k * 0.007), yb + 0.22, pz - 0.24); }
  for (let i = 0; i < 6; i++) pulled.box(0.068, 0.07, 0.12, MAT.darkSteel, -0.185 + i * 0.074, yb + 0.045, pz - sd / 2 + 0.07);   // supplies
  for (const x of [-0.26, 0.26]) pulled.box(0.012, 0.012, sd + 0.5, MAT.galv, x, yb + 0.006, pz - 0.25);
  scene.add(pulled.build());

  // rear: two vertical power strips with cords to each server's supplies
  const pduX = [-0.22, 0.22], pduZ = ZB + 0.105, pTop = sy(3) + SU / 2, pBot = sy(0) - SU / 2;
  pduX.forEach(x => { S.box(0.05, pTop - pBot, 0.05, MAT.black, x, (pTop + pBot) / 2, pduZ); for (let k = 0; k < 4; k++) for (let o = 0; o < 3; o++) N.box(0.03, 0.03, 0.01, MAT.darkSteel, x, sy(k) - 0.08 + o * 0.08, pduZ + 0.031); });
  [0, 1, 3].forEach(k => pduX.forEach(x => { for (let o = 0; o < 3; o++) N.strut([x, sy(k) - 0.08 + o * 0.08, pduZ + 0.04], [x * 0.55, sy(k) - 0.1 + o * 0.03, ZF - 0.07 - sd], 0.004, MAT.black, 4); }));
  // feed from the busway above to the top of each strip
  S.box(3.2, 0.18, 0.16, MAT.alu, -0.6, 3.2, -0.25);
  const tap = glowMat('#ff8a3d', 0.9);
  pduX.forEach(x => { N.box(0.2, 0.2, 0.2, tap, x * 0.5, 3.0, -0.25); N.strut([x * 0.5, 2.9, -0.25], [x * 0.5, H + 0.02, -0.25], 0.012, MAT.black, 8); N.strut([x * 0.5, H, -0.25], [x, pTop + 0.02, pduZ], 0.012, MAT.black, 8); });
  N.strut([-0.25, 3.3, -0.25], [-0.25, 3.8, -0.25], 0.01, MAT.darkSteel, 4); N.strut([0.25, 3.3, -0.25], [0.25, 3.8, -0.25], 0.01, MAT.darkSteel, 4);
  // data: fiber from each server's rear cages up the back to the runway
  const fx = 0.12, fz = ZB + 0.06;
  for (let k = 0; k < 5; k++) N.strut([fx - k * 0.006, sy(0), fz], [fx - k * 0.006, H + 0.28, fz], 0.004, k % 2 ? MAT.yellowTray : MAT.polymer, 5);
  [0, 1, 3].forEach(k => { for (let c = 0; c < 4; c++) N.strut([-0.15 + c * 0.1, sy(k) + 0.05, ZF - 0.07 - sd], [fx, sy(k) + 0.08, fz], 0.003, MAT.yellowTray, 4); });
  S.box(0.3, 0.03, 3.2, MAT.yellowTray, 0.2, 3.62, 0); S.box(0.012, 0.1, 3.2, MAT.yellowTray, 0.06, 3.66, 0); S.box(0.012, 0.1, 3.2, MAT.yellowTray, 0.34, 3.66, 0);
  N.strut([fx, H + 0.28, fz], [0.2, 3.6, fz], 0.012, MAT.yellowTray, 6);
  scene.add(S.build()); scene.add(N.build({ cast: false }));

  // ---------- flows ----------
  pduX.forEach(x => flows.push(flow([[x * 0.5, 3.0, -0.25], [x * 0.5, H + 0.02, -0.25], [x, pTop + 0.02, pduZ], [x, pBot, pduZ]], 'lv', { count: 16, speed: 0.35, size: 0.012, trailR: 0.004 })));
  [0, 1, 3].forEach(k => pduX.forEach(x => flows.push(flow([[x, sy(k), pduZ + 0.04], [x * 0.55, sy(k) - 0.04, ZF - 0.07 - sd]], 'lv', { count: 3, speed: 0.2, size: 0.009, trail: false }))));
  flows.push(flow([[0, yb + 0.06, pz - sd / 2 + 0.14], [0, yb + 0.03, pz - 0.05], [0, yb + 0.03, pz + 0.25]], 'dc', { count: 8, speed: 0.2, size: 0.008, trailR: 0.003 }));
  dataFlows.push(flow([[fx, sy(0), fz - 0.01], [fx, H + 0.28, fz - 0.01], [0.2, 3.6, fz], [0.2, 3.64, 1.5]], 'eth', { count: 22, speed: 0.4, size: 0.011, k: 2.3, trailR: 0.004 }));
  // scale-up: NVLink only inside the pulled server, GPUs to the switch row
  sinks.forEach(([x, z]) => dataFlows.push(flow([[x, yb + 0.03, z], [x * 0.9, yb + 0.03, pz - 0.03]], 'nvl', { count: 3, speed: 0.12, size: 0.006, k: 2.4, trail: false })));
  // heat: cold air in the front of every server, hot air out the back
  [0, 1, 3].forEach(k => { for (const x of [-0.14, 0, 0.14]) for (const dy of [-0.08, 0.08]) {
    heatFlows.push(flow([[x, sy(k) + dy, ZF + 0.8], [x, sy(k) + dy, ZF]], 'cool', { count: 3, speed: 0.4, size: 0.02, k: 2.0, opacity: 0.8, trail: false }));
    heatFlows.push(flow([[x, sy(k) + dy, ZB], [x * 1.3, sy(k) + dy + 0.1, ZB - 0.8]], 'air', { count: 3, speed: 0.45, size: 0.024, k: 2.4, opacity: 0.9, trail: false }));
  } });
  sinks.forEach(([x, z]) => heatFlows.push(flow([[x, yb + 0.08, pz + sd / 2 - 0.08], [x, yb + 0.08, z], [x, yb + 0.1, pz - sd / 2 - 0.2]], 'air', { count: 3, speed: 0.25, size: 0.012, k: 2.4, trail: false })));
  [flows, dataFlows, heatFlows].forEach(list => list.forEach(f => scene.add(f.group)));

  const srv = { pos: [0.2, py + 0.12, pz + 0.3], view: { pos: [0.7, 1.9, 1.8], target: [0, py, pz] } };
  return {
    scene, flows,
    camera: { pos: [3.1, 2.3, 3.7], target: [0, 1.0, -0.1], near: 0.01, far: 200, min: 0.4, max: 9 },
    hotspots: {
      feed: { pos: [0.12, 3.12, -0.25], view: { pos: [1.2, 3.1, 1.0], target: [0, 2.7, -0.25] } },
      pdu: { pos: [pduX[1], sy(1), pduZ], view: { pos: [0.9, 1.3, -1.4], target: [0, 0.9, ZB] } },
      servers: srv,
      psus: { pos: [0.15, yb + 0.1, pz - sd / 2 + 0.07], view: { pos: [0.9, 1.5, -0.9], target: [0, yb, pz - 0.4] } },
      cabling: { pos: [pduX[0] * 0.7, sy(0), ZB + 0.15], view: { pos: [-0.8, 0.9, -1.5], target: [0, 0.6, ZB] } },
      mgmt: { pos: [0.22, topY + U / 2, ZF - 0.05], view: { pos: [0.7, 1.9, 1.3], target: [0, topY, ZF] } },
    },
    dataFlows, heatFlows,
    heatHotspots: {
      front: { pos: [0.1, sy(1), ZF + 0.5], view: { pos: [1.4, 1.2, 2.4], target: [0, 0.8, ZF] } },
      rearair: { pos: [0.05, sy(3), ZB - 0.4], view: { pos: [1.6, 1.6, -2.0], target: [0, 1.0, ZB - 0.3] } },
      servers: srv,
    },
    dataHotspots: {
      tp: { pos: [-0.1, yb + 0.14, pz + 0.18], view: { pos: [0.5, 1.6, 1.5], target: [0, py, pz] } },
      servers: srv,
      uplinks: { pos: [fx, H + 0.2, fz], view: { pos: [1.3, 2.9, -1.6], target: [0.2, 2.2, fz] } },
      optical: { pos: [-0.62, H + 0.05, 0], view: { pos: [-1.8, 3.0, 2.8], target: [-0.3, 1.6, 0] } },
      mgmt: { pos: [0.22, topY + U / 2, ZF - 0.05], view: { pos: [0.7, 1.9, 1.3], target: [0, topY, ZF] } },
    },
    update() {},
  };
}

// ---------- NVL72 class: 18 compute trays, 9 switch trays, liquid-cooled ----------
function buildNVL({ quality, model }) {
  const feedV = model.power.id === 'dc800' ? 'hvdc' : 'lv';
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0d13);
  scene.add(new THREE.HemisphereLight(0xa9bbdc, 0x15171b, 0.8));
  const key = new THREE.DirectionalLight(0xffe6c8, 2.2); key.position.set(3, 5, 4); key.target.position.set(0, 1, 0);
  if (quality.shadows) { key.castShadow = true; key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -2.5, right: 2.5, top: 3.5, bottom: -1, near: 1, far: 14 }); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.01; }
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0x6f9dff, 1.1); rim.position.set(-3, 3, -4); scene.add(rim);

  const flows = [], dataFlows = [], heatFlows = [];
  const S = new Builder(), N = new Builder();
  const W = 0.6, D = 1.07, H = 2.25, X = W / 2, ZF = D / 2, ZB = -D / 2;
  const base = 0.1;

  // floor: sealed slab with a joint grid, and a ghost of the neighbor rack
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.7, metalness: 0.05 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  for (let i = -8; i <= 8; i++) { N.box(0.005, 0.004, 16, MAT.darkSteel, i * 1.2, 0.004, 0); N.box(16, 0.004, 0.005, MAT.darkSteel, 0, 0.004, i * 1.2); }
  S.slab(W, H, D, MAT.rack, -0.62, 0, 0);

  // frame: posts, top, base, closed left side, feet
  for (const x of [-X + 0.02, X - 0.02]) for (const z of [ZF - 0.03, ZB + 0.03]) S.box(0.035, H, 0.035, MAT.rack, x, H / 2, z);
  S.slab(W, 0.04, D, MAT.rack, 0, H - 0.04, 0);
  S.slab(W, base, D, MAT.rack, 0, 0, 0);
  S.slab(0.012, H - 0.004, D - 0.004, MAT.rackFace, -X - 0.006, 0.002, 0);   // side panel, set just proud of the frame
  for (const x of [-0.25, 0.25]) for (const z of [-0.45, 0.45]) N.cyl(0.025, 0.04, MAT.darkSteel, x, 0.02, z, 12);
  // rails
  for (const z of [ZF - 0.06, ZB + 0.06]) for (const x of [-X + 0.05, X - 0.05]) N.box(0.012, H - 0.2, 0.012, MAT.galv, x, H / 2, z);

  // ---------- trays ----------
  const layout = [];
  const push = (kind, n) => { for (let i = 0; i < n; i++) layout.push(kind); };
  push('ps', 3); push('compute', 8); push('switch', 9); push('compute', 10); push('ps', 3); push('mgmt', 1);
  const TEX = { compute: trayTex('compute'), switch: trayTex('switch'), ps: trayTex('ps'), mgmt: trayTex('mgmt'), blank: trayTex('blank') };
  const PULLED = 24;                              // index of the tray pulled out for view
  const trayY = i => base + 0.02 + i * U + U / 2;
  const kinds = {};
  layout.forEach((k, i) => (kinds[k] = kinds[k] || []).push(i));
  const trayW = 0.44, trayD = 0.9;
  for (const [k, idxs] of Object.entries(kinds)) {
    const items = idxs.filter(i => i !== PULLED);
    const front = new THREE.MeshStandardMaterial({ map: TEX[k], roughness: 0.5, metalness: 0.35 });
    const side = new THREE.MeshStandardMaterial({ color: k === 'ps' ? 0x3a3f46 : 0x2a2e34, roughness: 0.45, metalness: 0.6 });
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(trayW, U * 0.94, trayD), [side, side, side, side, front, side], items.length);
    items.forEach((i, n) => m.setMatrixAt(n, mtx(0, trayY(i), ZF - 0.07 - trayD / 2)));
    m.castShadow = m.receiveShadow = true; scene.add(m);
  }
  // blanking panels above
  const topUsed = trayY(layout.length - 1) + U / 2;
  S.box(trayW, H - 0.05 - topUsed, 0.01, MAT.rackFace, 0, (topUsed + H - 0.05) / 2, ZF - 0.07);
  // tray ears
  layout.forEach((k, i) => { if (i !== PULLED) { N.box(0.03, U * 0.9, 0.01, MAT.galv, -0.245, trayY(i), ZF - 0.065); N.box(0.03, U * 0.9, 0.01, MAT.galv, 0.245, trayY(i), ZF - 0.065); } });

  // pulled-out compute tray with its lid off
  const py = trayY(PULLED), out = 0.5, pz = ZF - 0.07 - trayD / 2 + out;
  const pulled = new Builder();
  pulled.box(trayW, 0.004, trayD, MAT.galv, 0, py - U / 2 + 0.004, pz);
  pulled.box(0.004, U * 0.9, trayD, MAT.galv, -trayW / 2, py, pz); pulled.box(0.004, U * 0.9, trayD, MAT.galv, trayW / 2, py, pz);
  pulled.box(trayW - 0.02, 0.003, trayD * 0.62, MAT.pcb, 0, py - U / 2 + 0.008, pz - 0.05);
  const plates = [[-0.11, -0.2], [0.11, -0.2], [-0.11, 0.08], [0.11, 0.08]];
  plates.forEach(([x, z]) => { pulled.box(0.1, 0.018, 0.12, MAT.copper, x, py - U / 2 + 0.02, pz + z); pulled.box(0.07, 0.006, 0.09, MAT.nickel, x, py - U / 2 + 0.032, pz + z); });
  for (const x of [-0.11, 0.11]) { pulled.box(0.07, 0.014, 0.07, MAT.copper, x, py - U / 2 + 0.018, pz + 0.26); }
  for (const x of [-0.11, 0.11]) { pulled.strut([x - 0.02, py - U / 2 + 0.03, pz + 0.26], [x - 0.02, py - U / 2 + 0.03, pz - 0.44], 0.005, MAT.pipeBlue, 6); pulled.strut([x + 0.02, py - U / 2 + 0.03, pz + 0.26], [x + 0.02, py - U / 2 + 0.03, pz - 0.44], 0.005, MAT.pipeRed, 6); }
  for (let i = 0; i < 6; i++) pulled.box(0.05, 0.03, 0.04, MAT.fan, -0.15 + i * 0.06, py - U / 2 + 0.02, pz + 0.38);
  const pFront = new THREE.Mesh(new THREE.BoxGeometry(trayW, U * 0.94, 0.02), [MAT.rackFace, MAT.rackFace, MAT.rackFace, MAT.rackFace, new THREE.MeshStandardMaterial({ map: TEX.compute, roughness: 0.5, metalness: 0.35 }), MAT.rackFace]);
  pFront.position.set(0, py, pz + trayD / 2); scene.add(pFront);
  for (const x of [-0.26, 0.26]) pulled.box(0.012, 0.012, trayD + 0.5, MAT.galv, x, py - U / 2 + 0.006, pz - 0.25); // slide rails
  scene.add(pulled.build());

  // ---------- rear: busbar, clips, NVLink spine, manifolds ----------
  const bbZ = ZB + 0.1, bbTop = trayY(layout.length - 2) + U / 2, bbBot = trayY(0) - U / 2;
  for (const dx of [-0.018, 0.018]) S.box(0.022, bbTop - bbBot, 0.05, MAT.copper, dx, (bbTop + bbBot) / 2, bbZ);
  S.box(0.08, bbTop - bbBot, 0.012, MAT.polymer, 0, (bbTop + bbBot) / 2, bbZ + 0.035);          // insulating cover
  layout.forEach((k, i) => { if (k !== 'mgmt') N.box(0.07, U * 0.6, 0.04, MAT.copper, 0, trayY(i), bbZ + 0.06); });
  // NVLink cable cartridges and copper links
  const cartX = [-0.2, -0.12, 0.12, 0.2], cartZ = ZB + 0.08;
  const spanLo = trayY(3) - U / 2, spanHi = trayY(29) + U / 2;
  cartX.forEach(x => S.box(0.06, spanHi - spanLo, 0.1, MAT.black, x, (spanLo + spanHi) / 2, cartZ));
  layout.forEach((k, i) => {
    if (k !== 'compute' && k !== 'switch') return;
    const y = trayY(i);
    cartX.forEach((cx, c) => {
      for (let j = 0; j < 3; j++) {
        const ty = y + (j - 1) * 0.008, x0 = -0.08 + j * 0.08;
        N.strut([x0, ty, ZB + 0.16], [cx, ty + (c - 1.5) * 0.004, cartZ + 0.05], 0.0022, j === 1 ? MAT.copper : MAT.black, 4);
      }
    });
  });
  // manifolds with quick disconnects to each liquid-cooled tray
  const mX = [-0.255, 0.255], mZ = ZB + 0.05;
  S.box(0.045, bbTop - bbBot + 0.2, 0.045, MAT.pipeBlue, mX[0], (bbTop + bbBot) / 2, mZ);
  S.box(0.045, bbTop - bbBot + 0.2, 0.045, MAT.pipeRed, mX[1], (bbTop + bbBot) / 2, mZ);
  layout.forEach((k, i) => {
    if (k !== 'compute' && k !== 'switch') return;
    const y = trayY(i);
    N.cylZ(0.009, 0.04, MAT.galv, mX[0], y, mZ + 0.04, 8); N.cylZ(0.009, 0.04, MAT.galv, mX[1], y, mZ + 0.04, 8);
    N.strut([mX[0], y, mZ + 0.06], [-0.16, y, ZB + 0.18], 0.005, MAT.pipeBlue, 6);
    N.strut([mX[1], y, mZ + 0.06], [0.16, y, ZB + 0.18], 0.005, MAT.pipeRed, 6);
  });
  // supply and return hoses leave through the floor to the CDU
  N.strut([mX[0], bbBot - 0.1, mZ], [mX[0], 0.0, mZ - 0.1], 0.02, MAT.pipeBlue, 10);
  N.strut([mX[1], bbBot - 0.1, mZ], [mX[1], 0.0, mZ - 0.1], 0.02, MAT.pipeRed, 10);

  // ---------- feed from the busway above ----------
  S.box(3.2, 0.18, 0.16, MAT.alu, -0.6, 3.2, -0.25);
  const tap = glowMat(feedV === 'hvdc' ? '#d8f04a' : '#ff8a3d', 0.9);
  for (const x of [-0.12, 0.12]) {
    N.box(0.2, 0.2, 0.2, tap, x, 3.0, -0.25);
    N.strut([x, 2.9, -0.25], [x, H + 0.02, -0.25], 0.012, MAT.black, 8);
    N.strut([x, H, -0.25], [x * 0.8, trayY(layout.length - 2), ZB + 0.16], 0.012, MAT.black, 8);
  }
  N.strut([-0.25, 3.3, -0.25], [-0.25, 3.8, -0.25], 0.01, MAT.darkSteel, 4); N.strut([0.25, 3.3, -0.25], [0.25, 3.8, -0.25], 0.01, MAT.darkSteel, 4);
  // bottom power shelves take their feed by a cable down the back
  N.strut([0.1, H, -0.3], [0.1, trayY(1), ZB + 0.16], 0.01, MAT.black, 8);

  // ---------- data: scale-out fiber up the front, runway overhead ----------
  const fx = 0.27, fz = ZF - 0.03;
  for (let k = 0; k < 5; k++) N.strut([fx - k * 0.006, trayY(3), fz], [fx - k * 0.006, H + 0.28, fz], 0.004, k % 2 ? MAT.yellowTray : MAT.polymer, 5);
  layout.forEach((k, i) => { if (k === 'compute' && i !== PULLED) N.strut([0.17, trayY(i), ZF - 0.06], [fx, trayY(i) + 0.01, fz], 0.003, MAT.yellowTray, 4); });
  S.box(0.3, 0.03, 3.2, MAT.yellowTray, 0.2, 3.62, 0); S.box(0.012, 0.1, 3.2, MAT.yellowTray, 0.06, 3.66, 0); S.box(0.012, 0.1, 3.2, MAT.yellowTray, 0.34, 3.66, 0);
  N.strut([fx, H + 0.28, fz], [0.2, 3.6, fz], 0.012, MAT.yellowTray, 6);

  scene.add(S.build()); scene.add(N.build({ cast: false }));

  dataFlows.push(flow([[fx, trayY(3), fz + 0.01], [fx, H + 0.28, fz + 0.01], [0.2, 3.6, fz], [0.2, 3.64, -1.5]], 'eth', { count: 22, speed: 0.4, size: 0.011, k: 2.3, trailR: 0.004 }));
  // scale-up: NVLink up and down the cable cartridges, and out of a few trays to them
  cartX.forEach((cx, c) => {
    const [a, b] = c % 2 ? [spanLo, spanHi] : [spanHi, spanLo];
    dataFlows.push(flow([[cx, a, cartZ + 0.055], [cx, b, cartZ + 0.055]], 'nvl', { count: 26, speed: 0.3, size: 0.009, k: 2.4, trail: false }));
  });
  [4, 8, 12, 16, 22, 26].forEach(i => cartX.forEach(cx => dataFlows.push(flow([[0, trayY(i), ZB + 0.16], [cx, trayY(i), cartZ + 0.05]], 'nvl', { count: 2, speed: 0.15, size: 0.007, k: 2.4, trail: false }))));

  // ---------- flows ----------
  for (const x of [-0.12, 0.12]) flows.push(flow([[x, 3.0, -0.25], [x, H + 0.02, -0.25], [x * 0.8, trayY(layout.length - 2), ZB + 0.16]], feedV, { count: 8, speed: 0.35, size: 0.012, trailR: 0.004 }));
  flows.push(flow([[0.1, H, -0.3], [0.1, trayY(1), ZB + 0.16]], feedV, { count: 10, speed: 0.35, size: 0.012, trailR: 0.004 }));
  // DC: from shelves onto the busbar, up and down the bar
  flows.push(flow([[0, trayY(31), bbZ + 0.03], [0, bbBot + 0.1, bbZ + 0.03]], 'dc', { count: 42, speed: 0.22, size: 0.011, trailR: 0.004, k: 2.4 }));
  flows.push(flow([[0.03, trayY(1), bbZ + 0.03], [0.03, bbTop - 0.1, bbZ + 0.03]], 'dc', { count: 42, speed: 0.22, size: 0.011, trailR: 0.004, k: 2.4 }));
  // DC into the pulled tray
  flows.push(flow([[0, py, bbZ + 0.06], [0, py, ZB + 0.3], [0, py - U / 2 + 0.03, pz - 0.2]], 'dc', { count: 8, speed: 0.2, size: 0.008, trailR: 0.003 }));
  // coolant
  flows.push(flow([[mX[0], bbTop + 0.05, mZ + 0.03], [mX[0], bbBot, mZ + 0.03]], 'cool', { count: 26, speed: 0.25, size: 0.012, trail: false }));
  flows.push(flow([[mX[1], bbBot, mZ + 0.03], [mX[1], bbTop + 0.05, mZ + 0.03]], 'warm', { count: 26, speed: 0.25, size: 0.012, trail: false }));
  // heat: supply up from the floor and down the left manifold, warm return up the right and back to the floor
  heatFlows.push(flow([[mX[0], 0.0, mZ - 0.1], [mX[0], bbBot - 0.1, mZ], [mX[0], bbTop + 0.05, mZ + 0.03]], 'cool', { count: 34, speed: 0.3, size: 0.024, k: 2.6, trailR: 0.014, trailK: 0.5 }));
  heatFlows.push(flow([[mX[1], bbTop + 0.05, mZ + 0.03], [mX[1], bbBot - 0.1, mZ], [mX[1], 0.0, mZ - 0.1]], 'warm', { count: 34, speed: 0.3, size: 0.024, k: 2.6, trailR: 0.014, trailK: 0.5 }));
  [4, 9, 14, 18, 22, 27].forEach(i => {
    heatFlows.push(flow([[mX[0], trayY(i), mZ + 0.06], [-0.16, trayY(i), ZB + 0.18], [-0.1, trayY(i), 0]], 'cool', { count: 3, speed: 0.25, size: 0.016, k: 2.6, trail: false }));
    heatFlows.push(flow([[0.1, trayY(i), 0], [0.16, trayY(i), ZB + 0.18], [mX[1], trayY(i), mZ + 0.06]], 'warm', { count: 3, speed: 0.25, size: 0.016, k: 2.6, trail: false }));
  });
  // the air share: power shelves, switches, optics exhaust out the back
  if (model.accel.liquidShare < 0.99) for (const i of [1, 6, 12, 16, 20, 25, 31]) for (const x of [-0.15, 0.05, 0.2]) heatFlows.push(flow([[x, trayY(i), 0.2], [x, trayY(i) + 0.02, ZB], [x * 1.2, trayY(i) + 0.12, ZB - 0.7]], 'air', { count: 4, speed: 0.35, size: 0.024, k: 2.4, opacity: 0.9, trail: false }));
  for (const x of [-0.11, 0.11]) {
    flows.push(flow([[x - 0.02, py - U / 2 + 0.035, pz - 0.44], [x - 0.02, py - U / 2 + 0.035, pz + 0.26]], 'cool', { count: 6, speed: 0.15, size: 0.006, trail: false }));
    flows.push(flow([[x + 0.02, py - U / 2 + 0.035, pz + 0.26], [x + 0.02, py - U / 2 + 0.035, pz - 0.44]], 'warm', { count: 6, speed: 0.15, size: 0.006, trail: false }));
  }
  flows.forEach(f => scene.add(f.group));
  dataFlows.forEach(f => scene.add(f.group));
  heatFlows.forEach(f => scene.add(f.group));

  return {
    scene, flows,
    camera: { pos: [3.1, 2.3, 3.7], target: [0, 1.1, -0.1], near: 0.01, far: 200, min: 0.4, max: 9 },
    hotspots: {
      feed: { pos: [0.12, 3.12, -0.25], view: { pos: [1.2, 3.1, 1.0], target: [0, 2.7, -0.25] } },
      shelves: { pos: [0.25, trayY(31), ZF - 0.05], view: { pos: [0.7, 1.9, 1.5], target: [0, trayY(31), ZF] } },
      busbar: { pos: [0.03, trayY(14), bbZ], view: { pos: [0.9, 1.3, -1.3], target: [0, 0.9, bbZ] } },
      compute: { pos: [0.2, py + 0.03, pz + 0.2], view: { pos: [0.6, 1.8, 1.7], target: [0, py, pz] } },
      nvswitch: { pos: [0.24, trayY(15), ZF - 0.05], view: { pos: [0.9, 1.0, 1.4], target: [0, trayY(15), ZF - 0.1] } },
      spine: { pos: [0.2, trayY(18), cartZ], view: { pos: [0.4, 1.1, -1.6], target: [0, 0.9, ZB] } },
      manifold: { pos: [mX[1], trayY(6), mZ], view: { pos: [1.3, 0.8, -1.2], target: [0.2, 0.6, ZB] } },
    },
    dataFlows, heatFlows,
    heatHotspots: {
      manifold: { pos: [mX[1], trayY(6), mZ], view: { pos: [1.3, 0.8, -1.2], target: [0.2, 0.6, ZB] } },
      rearair: { pos: [0.05, trayY(20), ZB - 0.4], view: { pos: [1.6, 1.6, -2.0], target: [0, 1.0, ZB - 0.3] } },
      compute: { pos: [0.2, py + 0.03, pz + 0.2], view: { pos: [0.6, 1.8, 1.7], target: [0, py, pz] } },
    },
    dataHotspots: {
      tp: { pos: [-0.2, trayY(15), ZF - 0.05], view: { pos: [1.2, 1.4, 2.2], target: [0, 1.0, 0] } },
      nvswitch: { pos: [0.24, trayY(15), ZF - 0.05], view: { pos: [0.9, 1.0, 1.4], target: [0, trayY(15), ZF - 0.1] } },
      spine: { pos: [0.2, trayY(18), cartZ], view: { pos: [0.4, 1.1, -1.6], target: [0, 0.9, ZB] } },
      uplinks: { pos: [fx, H + 0.2, fz], view: { pos: [1.3, 2.9, 2.2], target: [0.2, 2.2, fz] } },
      optical: { pos: [-0.62, H + 0.05, 0], view: { pos: [-1.8, 3.0, 2.8], target: [-0.3, 1.6, 0] } },
      compute: { pos: [0.2, py + 0.03, pz + 0.2], view: { pos: [0.6, 1.8, 1.7], target: [0, py, pz] } },
      mgmt: { pos: [0.22, trayY(33), ZF - 0.05], view: { pos: [0.7, 1.9, 1.3], target: [0, trayY(33), ZF] } },
    },
    update() {},
  };
}
