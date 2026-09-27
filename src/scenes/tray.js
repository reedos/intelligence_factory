// Scene 4: one compute tray, lid off. World unit = 10 cm (the tray is 4.4 units wide).
// Front faces +z. Two superchip boards: each one Grace CPU and two Blackwell GPUs.
import { THREE, MAT, Builder, flow, canvasTex, texMat } from '../kit.js';

export function pkgTex(label) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#1a1c20'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#23262c'; g.fillRect(10, 10, w - 20, h - 20);
    g.fillStyle = '#8b939e'; g.font = '600 20px system-ui, sans-serif'; g.fillText(label, 22, h - 26);
  });
}
function dieTex() {
  return canvasTex(256, 320, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#3c3f70'); gr.addColorStop(0.5, '#56628a'); gr.addColorStop(1, '#343a60');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let y = 10; y < h - 10; y += 30) for (let x = 10; x < w - 10; x += 30) { g.fillStyle = 'rgba(210,220,255,0.12)'; g.fillRect(x, y, 26, 26); g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x + 3, y + 3, 9, 9); }
    g.fillStyle = 'rgba(255,215,150,0.18)'; g.fillRect(0, h / 2 - 12, w, 24);
  });
}

export function build({ quality }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0d13);
  scene.add(new THREE.HemisphereLight(0xb8c6e4, 0x121418, 0.85));
  const key = new THREE.DirectionalLight(0xfff0dc, 2.3); key.position.set(4, 9, 6); key.target.position.set(0, 0, 0);
  if (quality.shadows) { key.castShadow = true; key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30 }); key.shadow.bias = -0.0003; key.shadow.normalBias = 0.01; }
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0x6e9bff, 1.0); rim.position.set(-6, 4, -7); scene.add(rim);

  const flows = [], dataFlows = [], heatFlows = [];
  const S = new Builder(), N = new Builder();
  const W = 4.4, D = 9, H = 0.42, ZF = D / 2, ZB = -D / 2;
  const floorY = 0.03;

  // bench surface
  const bench = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: 0.85 }));
  bench.rotation.x = -Math.PI / 2; bench.position.y = -0.01; bench.receiveShadow = true; scene.add(bench);

  // chassis
  S.box(W, 0.03, D, MAT.galv, 0, 0.015, 0);
  S.box(0.03, H, D, MAT.galv, -W / 2, H / 2, 0); S.box(0.03, H, D, MAT.galv, W / 2, H / 2, 0);
  S.box(W, H, 0.03, MAT.galv, 0, H / 2, ZB);
  const bezel = canvasTex(1024, 96, (g, w, h) => {
    g.fillStyle = '#1b1e23'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#101216'; for (let x = 20; x < 380; x += 12) for (let y = 14; y < h - 14; y += 12) g.fillRect(x + (y % 24 ? 6 : 0), y, 7, 7);
    for (let i = 0; i < 4; i++) { g.fillStyle = '#2d323a'; g.fillRect(410 + i * 60, 16, 50, h - 32); g.fillStyle = '#5cf29a'; g.fillRect(418 + i * 60, 22, 6, 6); }
    for (let i = 0; i < 6; i++) { g.fillStyle = '#0b0c0e'; g.fillRect(670 + i * 52, 22, 42, h - 44); g.fillStyle = '#3a3f47'; g.fillRect(674 + i * 52, 26, 34, h - 52); }
  });
  const bz = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.05), [MAT.rackFace, MAT.rackFace, MAT.rackFace, MAT.rackFace, texMat(bezel, { rough: 0.5, metal: 0.35 }), MAT.rackFace]);
  bz.position.set(0, H / 2, ZF); bz.castShadow = true; scene.add(bz);

  // ---------- rear power board: busbar clip, bus converters, 12 V copper ----------
  S.box(W - 0.2, 0.02, 1.0, MAT.pcbBlack, 0, floorY + 0.01, ZB + 0.65);
  for (let i = 0; i < 5; i++) N.box(0.05, 0.3, 0.26, MAT.copper, -0.12 + i * 0.06, 0.2, ZB - 0.12);        // clip fingers
  S.box(0.5, 0.18, 0.3, MAT.polymer, 0, 0.12, ZB + 0.1);
  const ibcX = [-1.5, -0.55, 0.55, 1.5];
  ibcX.forEach(x => {
    S.box(0.62, 0.08, 0.5, MAT.darkSteel, x, floorY + 0.06, ZB + 0.85);
    for (let f = 0; f < 11; f++) N.box(0.02, 0.2, 0.46, MAT.alu, x - 0.28 + f * 0.056, floorY + 0.2, ZB + 0.85);
  });
  // 12 V copper runs forward along each board
  for (const bx of [-1.1, 1.1]) { S.box(0.12, 0.02, 5.2, MAT.copper, bx, floorY + 0.04, -0.9); S.box(0.12, 0.02, 5.2, MAT.copper, bx + 0.16, floorY + 0.04, -0.9); }

  // ---------- two superchip boards ----------
  const gpus = [], cpus = [];
  const dieM = texMat(dieTex(), { rough: 0.25, metal: 0.6 }), cpuTex = texMat(pkgTex('GRACE'), { rough: 0.5 });
  for (const bx of [-1.1, 1.1]) {
    S.box(2.0, 0.02, 5.8, MAT.pcb, bx, floorY + 0.01, -0.35);
    // Grace near the front, LPDDR5X either side
    const cz = 1.75; cpus.push([bx, cz]);
    const cp = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.05, 0.62), [MAT.hbm, MAT.hbm, cpuTex, MAT.hbm, MAT.hbm, MAT.hbm]); cp.position.set(bx, floorY + 0.045, cz); cp.castShadow = true; scene.add(cp);
    for (const side of [-1, 1]) for (let i = 0; i < 4; i++) S.box(0.16, 0.025, 0.2, MAT.black, bx + side * 0.55, floorY + 0.03, cz - 0.36 + i * 0.24);
    // two GPUs
    for (const gz of [0.2, -1.55]) {
      gpus.push([bx, gz]);
      S.box(0.95, 0.04, 0.95, MAT.pcbBlack, bx, floorY + 0.04, gz);                 // substrate
      S.box(0.7, 0.012, 0.66, MAT.silicon, bx, floorY + 0.066, gz);                  // interposer
      for (const dx of [-0.16, 0.16]) { const d = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.4), [MAT.silicon, MAT.silicon, dieM, MAT.silicon, MAT.silicon, MAT.silicon]); d.position.set(bx + dx, floorY + 0.082, gz); scene.add(d); }
      for (const dx of [-0.24, -0.08, 0.08, 0.24]) for (const dz of [-0.27, 0.27]) S.box(0.13, 0.03, 0.1, MAT.hbm, bx + dx, floorY + 0.087, gz + dz);
      // VRM ring: inductors with power stages inside them, on three sides
      const ring = [];
      for (let i = 0; i < 8; i++) { ring.push([bx - 0.72, gz - 0.42 + i * 0.12]); ring.push([bx + 0.72, gz - 0.42 + i * 0.12]); }
      for (let i = 0; i < 7; i++) ring.push([bx - 0.36 + i * 0.12, gz - 0.62]);
      ring.forEach(([x, z]) => {
        S.box(0.1, 0.07, 0.09, MAT.inductor, x, floorY + 0.055, z);
        const inward = Math.sign(bx - x) || 0;
        N.box(0.06, 0.012, 0.06, MAT.black, x + inward * 0.1, floorY + 0.026, z + (inward === 0 ? 0.1 : 0));
      });
      for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; N.box(0.02, 0.012, 0.012, MAT.beige, bx + Math.cos(a) * 0.56, floorY + 0.026, gz + Math.sin(a) * 0.56); }
      N.box(0.08, 0.01, 0.08, MAT.black, bx + 0.6, floorY + 0.025, gz - 0.62);          // controller
      // 12 V into the ring, core power into the package
      flows.push(flow([[bx, floorY + 0.06, ZB + 1.3], [bx, floorY + 0.06, gz - 0.62], [bx - 0.36, floorY + 0.09, gz - 0.62]], 'bus12', { count: 10, speed: 0.9, size: 0.03, trailR: 0.01 }));
      for (const side of [-1, 1]) for (const dz of [-0.3, 0, 0.3]) flows.push(flow([[bx + side * 0.72, floorY + 0.1, gz + dz], [bx + side * 0.2, floorY + 0.1, gz + dz * 0.4]], 'core', { count: 4, speed: 0.35, size: 0.018, trailR: 0.006, k: 2.6, trailK: 0.2 }));
    }
  }
  // clip to the converters, converters onto the 12 V runs
  flows.push(flow([[0, 0.2, ZB - 0.2], [0, 0.2, ZB + 0.4], [-1.5, 0.12, ZB + 0.6], [-1.5, 0.12, ZB + 0.85]], 'dc', { count: 10, speed: 1.2, size: 0.035, trailR: 0.012 }));
  flows.push(flow([[0, 0.2, ZB - 0.2], [0, 0.2, ZB + 0.4], [1.5, 0.12, ZB + 0.6], [1.5, 0.12, ZB + 0.85]], 'dc', { count: 10, speed: 1.2, size: 0.035, trailR: 0.012 }));
  for (const bx of [-1.1, 1.1]) flows.push(flow([[bx * 1.36, 0.12, ZB + 1.1], [bx, floorY + 0.06, ZB + 1.3], [bx, floorY + 0.06, 1.4]], 'bus12', { count: 18, speed: 1.1, size: 0.03, trailR: 0.01 }));

  // ---------- cold plates, lifted to show the chips ----------
  const lift = 0.55;
  const plateLoop = [];
  for (const bx of [-1.1, 1.1]) {
    const pts = [];
    [[bx, 1.75, 0.66], [bx, 0.2, 0.9], [bx, -1.55, 0.9]].forEach(([x, z, s]) => {
      S.box(s, 0.08, s, MAT.copper, x, floorY + 0.1 + lift, z);
      S.box(s * 0.8, 0.06, s * 0.8, MAT.nickel, x, floorY + 0.17 + lift, z);
      N.cyl(0.035, 0.08, MAT.nickel, x - 0.2, floorY + 0.23 + lift, z, 10); N.cyl(0.035, 0.08, MAT.nickel, x + 0.2, floorY + 0.23 + lift, z, 10);
      pts.push([x, z]);
      for (const [dx, dz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) heatFlows.push(flow([[x + dx * s, floorY + 0.09, z + dz * s], [x + dx * s, floorY + 0.1 + lift, z + dz * s]], 'hot', { count: 3, speed: 0.5, size: 0.028, k: 2.6, trail: false }));
    });
    plateLoop.push(pts);
    const y = floorY + 0.28 + lift;
    const qdX = bx * 1.45;
    // supply: rear quick disconnect → CPU plate → GPU → GPU → back
    const sup = [[qdX, 0.25, ZB - 0.05], [qdX, y, ZB + 0.3], [bx - 0.2, y, -1.55], [bx - 0.2, y, 0.2], [bx - 0.2, y, 1.75]];
    const ret = [[bx + 0.2, y, 1.75], [bx + 0.2, y, 0.2], [bx + 0.2, y, -1.55], [qdX + 0.15, y, ZB + 0.3], [qdX + 0.15, 0.25, ZB - 0.05]];
    for (let i = 0; i < sup.length - 1; i++) N.strut(sup[i], sup[i + 1], 0.03, MAT.pipeBlue, 10);
    for (let i = 0; i < ret.length - 1; i++) N.strut(ret[i], ret[i + 1], 0.03, MAT.pipeRed, 10);
    flows.push(flow(sup, 'cool', { count: 14, speed: 0.8, size: 0.035, trail: false }));
    flows.push(flow(ret, 'warm', { count: 14, speed: 0.8, size: 0.035, trail: false }));
    heatFlows.push(flow(sup, 'cool', { count: 20, speed: 0.8, size: 0.045, k: 2.4, trailR: 0.034, trailK: 0.45 }));
    heatFlows.push(flow(ret, 'warm', { count: 20, speed: 0.8, size: 0.045, k: 2.4, trailR: 0.034, trailK: 0.45 }));
    S.cylZ(0.07, 0.2, MAT.nickel, qdX, 0.25, ZB - 0.1, 12); S.cylZ(0.07, 0.2, MAT.nickel, qdX + 0.15, 0.25, ZB - 0.1, 12);
  }

  // ---------- rear connectors, front NICs, DPU, drives, fans ----------
  for (const x of [-1.9, -1.15, 1.15, 1.9]) { S.box(0.5, 0.24, 0.32, MAT.black, x, 0.15, ZB + 0.2); N.box(0.46, 0.02, 0.3, MAT.gold, x, 0.28, ZB + 0.2); }
  for (let i = 0; i < 4; i++) {
    const x = -1.7 + i * 0.5;
    S.box(0.42, 0.02, 1.3, MAT.pcb, x + 1.9, floorY + 0.2, ZF - 1.0);
    S.box(0.3, 0.12, 0.5, MAT.alu, x + 1.9, floorY + 0.28, ZF - 1.2);
  }
  S.box(0.5, 0.02, 1.4, MAT.pcbBlack, -0.35, floorY + 0.2, ZF - 1.0); S.box(0.34, 0.14, 0.6, MAT.alu, -0.35, floorY + 0.29, ZF - 1.0);   // DPU
  for (let i = 0; i < 4; i++) S.box(0.22, 0.34, 1.1, MAT.darkSteel, -1.95 + i * 0.26, 0.2, ZF - 0.6);                                    // E1.S drives
  for (let i = 0; i < 6; i++) { S.box(0.38, 0.36, 0.3, MAT.fan, -1.9 + i * 0.76 + 0.19, 0.2, ZF - 1.95); N.cylZ(0.15, 0.02, MAT.darkSteel, -1.9 + i * 0.76 + 0.19, 0.2, ZF - 1.79, 16); }

  scene.add(S.build()); scene.add(N.build({ cast: false }));
  flows.forEach(f => scene.add(f.group));

  // ---------- data: NVLink out the back, C2C to the CPU, NIC and optics out the front ----------
  const nvX = [-1.9, -1.15, 1.15, 1.9], nicX = [0.2, 0.7, 1.2, 1.7], yD = floorY + 0.14;
  gpus.forEach(([gx, gz], i) => {
    dataFlows.push(flow([[gx, yD, gz - 0.3], [gx + (nvX[i] - gx) * 0.5, yD, ZB + 0.9], [nvX[i], 0.16, ZB + 0.36]], 'nvl', { count: 10, speed: 0.9, size: 0.03, k: 2.4, trailR: 0.01 }));
    dataFlows.push(flow([[gx + 0.3, yD, gz + 0.3], [nicX[i], yD + 0.08, ZF - 1.7], [nicX[i], floorY + 0.24, ZF - 1.0], [nicX[i], 0.24, ZF]], 'eth', { count: 10, speed: 0.9, size: 0.03, k: 2.3, trailR: 0.01 }));
  });
  cpus.forEach(([cx, cz]) => {
    dataFlows.push(flow([[cx, yD, cz - 0.3], [cx, yD, 0.55]], 'c2c', { count: 5, speed: 0.6, size: 0.028, k: 2.2, trailR: 0.01 }));
    dataFlows.push(flow([[cx + 0.1, yD, 0.55], [cx + 0.1, yD, cz - 0.3]], 'c2c', { count: 5, speed: 0.6, size: 0.028, k: 2.2, trailR: 0.01 }));
  });
  dataFlows.push(flow([[-0.35, floorY + 0.3, ZF - 1.4], [-0.35, 0.24, ZF]], 'eth', { count: 5, speed: 0.6, size: 0.028, k: 1.6, trailR: 0.01 }));
  // optical module cages behind the bezel
  nicX.forEach(x => { S.box(0.2, 0.14, 0.5, MAT.galv, x, 0.24, ZF - 0.28); N.box(0.16, 0.04, 0.04, MAT.polymer, x, 0.24, ZF + 0.03); });
  dataFlows.forEach(f => scene.add(f.group));
  // air over the parts water does not reach, front to back
  for (let i = 0; i < 6; i++) { const x = -1.9 + i * 0.76 + 0.19; heatFlows.push(flow([[x, 0.3, ZF - 1.75], [x, 0.3, ZF - 3.2], [x * 0.9, 0.34, ZB + 1.5]], 'air', { count: 6, speed: 0.9, size: 0.04, k: 2.0, opacity: 0.8, trail: false })); }
  heatFlows.forEach(f => scene.add(f.group));

  const [g0x, g0z] = gpus[1];
  return {
    scene, flows,
    camera: { pos: [5.9, 6.4, 8.3], target: [0, 0.1, -0.5], near: 0.02, far: 400, min: 1, max: 30 },
    hotspots: {
      clip: { pos: [0, 0.4, ZB - 0.15], view: { pos: [2.4, 2.2, -7.5], target: [0, 0.2, ZB] } },
      ibc: { pos: [-1.5, 0.35, ZB + 0.85], view: { pos: [-2.8, 2.5, -1.6], target: [-1, 0.1, ZB + 0.9] } },
      vrm: { pos: [g0x + 0.72, 0.2, g0z + 0.1], view: { pos: [g0x + 2.2, 1.6, g0z + 1.4], target: [g0x, 0.05, g0z] } },
      gpu: { pos: [gpus[3][0], 0.2, gpus[3][1]], view: { pos: [gpus[3][0] + 1.5, 2.0, gpus[3][1] + 1.8], target: [gpus[3][0], 0.05, gpus[3][1]] } },
      grace: { pos: [cpus[0][0], 0.18, cpus[0][1]], view: { pos: [cpus[0][0] - 1.4, 1.8, cpus[0][1] + 1.8], target: [cpus[0][0], 0.05, cpus[0][1]] } },
      lpddr: { pos: [cpus[1][0] + 0.55, 0.14, cpus[1][1] + 0.36], view: { pos: [cpus[1][0] + 1.6, 1.4, cpus[1][1] + 1.4], target: [cpus[1][0] + 0.4, 0.05, cpus[1][1]] } },
      coldplates: { pos: [-1.1, 0.95, 0.2], view: { pos: [-3.6, 2.6, 2.4], target: [-1.1, 0.6, 0] } },
      nic: { pos: [1.2, 0.5, ZF - 1.0], view: { pos: [2.8, 2.4, 6.6], target: [0.8, 0.2, ZF - 1] } },
      nvconn: { pos: [1.9, 0.4, ZB + 0.2], view: { pos: [3.6, 2.2, -6.4], target: [1.6, 0.2, ZB] } },
    },
    dataFlows, heatFlows,
    heatHotspots: {
      coldplates: { pos: [-1.1, 0.95, 0.2], view: { pos: [-3.6, 2.6, 2.4], target: [-1.1, 0.6, 0] } },
      gpuheat: { pos: [gpus[3][0], 0.2, gpus[3][1]], view: { pos: [gpus[3][0] + 1.5, 2.0, gpus[3][1] + 1.8], target: [gpus[3][0], 0.05, gpus[3][1]] } },
      fans: { pos: [0.2, 0.5, ZF - 1.95], view: { pos: [2.4, 2.4, 6.8], target: [0.4, 0.2, ZF - 2] } },
      qd: { pos: [1.6, 0.4, ZB - 0.1], view: { pos: [3.6, 2.2, -6.4], target: [1.6, 0.2, ZB] } },
    },
    dataHotspots: {
      nvconn: { pos: [1.9, 0.4, ZB + 0.2], view: { pos: [3.6, 2.2, -6.4], target: [1.6, 0.2, ZB] } },
      c2c: { pos: [cpus[0][0], 0.3, 1.0], view: { pos: [cpus[0][0] - 1.8, 2.0, 2.8], target: [cpus[0][0], 0.05, 1.0] } },
      cx: { pos: [1.2, 0.45, ZF - 1.1], view: { pos: [2.8, 2.4, 6.6], target: [0.8, 0.2, ZF - 1] } },
      osfp: { pos: [0.7, 0.4, ZF - 0.2], view: { pos: [1.6, 1.4, 6.8], target: [0.9, 0.2, ZF - 0.3] } },
      dpu: { pos: [-0.35, 0.5, ZF - 1.0], view: { pos: [-1.4, 2.0, 6.4], target: [-0.35, 0.2, ZF - 1.0] } },
      gpu: { pos: [gpus[3][0], 0.2, gpus[3][1]], view: { pos: [gpus[3][0] + 1.5, 2.0, gpus[3][1] + 1.8], target: [gpus[3][0], 0.05, gpus[3][1]] } },
    },
    update() {},
  };
}
