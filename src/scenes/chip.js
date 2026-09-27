// Scene 5: the GPU package, exploded, and the tokens that leave it. World unit = 1 cm.
import { THREE, MAT, Builder, flow, canvasTex, glowMat } from '../kit.js';

function dieTexture() {
  return canvasTex(640, 800, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, '#2f3466'); gr.addColorStop(0.45, '#4d5c8e'); gr.addColorStop(0.55, '#5a4f86'); gr.addColorStop(1, '#2b3160');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    // streaming multiprocessors in a grid, with tensor-core blocks
    const cols = 8, rows = 10, pad = 36, cw = (w - pad * 2) / cols, rh = (h - pad * 2 - 60) / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = pad + c * cw, y = pad + r * rh + (r >= rows / 2 ? 60 : 0);
      g.fillStyle = 'rgba(200,215,255,0.10)'; g.fillRect(x + 3, y + 3, cw - 6, rh - 6);
      g.fillStyle = 'rgba(160,255,230,0.16)'; for (let t = 0; t < 4; t++) g.fillRect(x + 8 + t * (cw - 16) / 4, y + rh * 0.55, (cw - 16) / 4 - 4, rh * 0.3);
      g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(x + 8, y + 8, cw - 16, rh * 0.35);
    }
    g.fillStyle = 'rgba(255,205,140,0.22)'; g.fillRect(pad, h / 2 - 28, w - pad * 2, 56);       // L2 cache band
    g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(0, 0, w, 18); g.fillRect(0, h - 18, w, 18); // HBM PHY edges
    g.fillStyle = 'rgba(120,200,255,0.25)'; g.fillRect(w - 16, 40, 16, h - 80);                  // NV-HBI edge
  });
}
function wordTexture(word) {
  const c = document.createElement('canvas'); const g = c.getContext('2d');
  g.font = '600 64px "IBM Plex Mono", ui-monospace, monospace';
  const tw = Math.ceil(g.measureText(word).width) + 40; c.width = tw; c.height = 96;
  g.font = '600 64px "IBM Plex Mono", ui-monospace, monospace';
  g.fillStyle = 'rgba(12,18,28,0.82)'; const r = 18; g.beginPath(); g.roundRect(2, 8, tw - 4, 80, r); g.fill();
  g.strokeStyle = 'rgba(160,240,255,0.7)'; g.lineWidth = 3; g.stroke();
  g.fillStyle = '#e9fbff'; g.textBaseline = 'middle'; g.fillText(word, 20, 50);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return { tex: t, aspect: tw / 96 };
}
const TOKENS = ['The', ' heron', ' lifts', ' off', ' the', ' water', ',', ' wings', ' catching', ' the', ' last', ' light', '.', ' Every', ' word', ' here', ' cost', ' about', ' a', ' joule', '.'];

export function build({ quality, state }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x090c12);
  scene.add(new THREE.HemisphereLight(0xb5c3e6, 0x111317, 0.8));
  const key = new THREE.DirectionalLight(0xfff0de, 2.0); key.position.set(-7, 12, 3);
  if (quality.shadows) { key.castShadow = true; key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 40 }); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.01; }
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x7aa6ff, 1.2); rim.position.set(-8, 5, -8); scene.add(rim);

  const flows = [], dataFlows = [], heatFlows = [];
  const S = new Builder(), N = new Builder();
  // layer heights (exploded)
  const Y = { balls: 0.12, sub: 1.1, bumps: 2.05, inter: 2.3, dies: 3.2, lid: 4.7 };
  const SUB = 8.4;

  // board beneath, cut square
  S.box(12, 0.16, 12, MAT.pcb, 0, -0.08, 0);
  for (let i = 0; i < 26; i++) N.box(0.06, 0.004, 11.6, MAT.copper, -5.6 + i * 0.45, 0.002, 0);
  // BGA balls
  const ball = new THREE.SphereGeometry(0.1, 10, 8);
  const pitch = 0.3, nB = 26, balls = new THREE.InstancedMesh(ball, MAT.nickel, nB * nB);
  const o = new THREE.Object3D(); let bi = 0;
  for (let i = 0; i < nB; i++) for (let j = 0; j < nB; j++) { o.position.set(-3.75 + i * pitch, Y.balls, -3.75 + j * pitch); o.updateMatrix(); balls.setMatrixAt(bi++, o.matrix); }
  balls.castShadow = true; scene.add(balls);
  // organic substrate with decoupling capacitors
  S.box(SUB, 0.25, SUB, MAT.pcbBlack, 0, Y.sub, 0);
  S.box(SUB - 0.1, 0.01, SUB - 0.1, MAT.pcb, 0, Y.sub + 0.13, 0);
  for (let i = 0; i < 90; i++) { const a = i / 90 * Math.PI * 2, r = 3.7; N.box(0.12, 0.06, 0.07, MAT.beige, Math.cos(a) * r, Y.sub + 0.16, Math.sin(a) * r * 0.98, a); }
  // stiffener ring
  for (const s of [-1, 1]) { S.box(SUB, 0.18, 0.3, MAT.nickel, 0, Y.sub + 0.22, s * (SUB / 2 - 0.15)); S.box(0.3, 0.18, SUB - 0.6, MAT.nickel, s * (SUB / 2 - 0.15), Y.sub + 0.22, 0); }
  // C4 bumps between substrate and interposer
  const bump = new THREE.SphereGeometry(0.045, 8, 6), nx = 34, nz = 32;
  const bumps = new THREE.InstancedMesh(bump, MAT.nickel, nx * nz); bi = 0;
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { o.position.set(-2.97 + i * 0.18, Y.bumps, -2.79 + j * 0.18); o.updateMatrix(); bumps.setMatrixAt(bi++, o.matrix); }
  scene.add(bumps);
  // silicon interposer (CoWoS-L)
  S.box(6.2, 0.1, 5.9, MAT.silicon, 0, Y.inter, 0);
  for (let i = 0; i < 40; i++) N.box(0.012, 0.004, 5.6, MAT.gold, -2.9 + i * 0.15, Y.inter + 0.052, 0);
  // two GPU dies
  const dieMat = new THREE.MeshStandardMaterial({ map: dieTexture(), roughness: 0.34, metalness: 0.45, envMapIntensity: 0.5, emissive: 0x6fd8ff, emissiveIntensity: 0.0 });
  const dieSide = new THREE.MeshStandardMaterial({ color: 0x3b4262, roughness: 0.3, metalness: 0.6 });
  const dies = [];
  for (const dx of [-1.36, 1.36]) {
    const d = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 3.3), [dieSide, dieSide, dieMat, dieSide, dieSide, dieSide]);
    d.position.set(dx, Y.dies, 0); if (dx > 0) d.rotation.y = Math.PI; d.castShadow = true; scene.add(d); dies.push(d);
  }
  // NV-HBI bridge glow between the dies
  const hbi = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 3.0), glowMat('#6fd8ff', 2.4)); hbi.position.set(0, Y.dies + 0.02, 0); scene.add(hbi);
  // HBM3e stacks: eight, each a base die and twelve DRAM layers, slightly spread
  const hbmTop = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#2b2e35'; g.fillRect(0, 0, w, h); g.fillStyle = '#8b939e'; g.font = '600 18px system-ui'; g.fillText('HBM3e', 18, 70); });
  const hbmTopMat = new THREE.MeshStandardMaterial({ map: hbmTop, roughness: 0.4, metalness: 0.3 });
  const hbmPos = [];
  for (const x of [-2.02, -0.7, 0.7, 2.02]) for (const z of [-2.3, 2.3]) hbmPos.push([x, z]);
  hbmPos.forEach(([x, z]) => {
    S.box(1.1, 0.05, 1.05, MAT.silicon, x, Y.dies - 0.02, z);
    for (let l = 0; l < 12; l++) S.box(1.06, 0.035, 1.0, l % 2 ? MAT.hbm : MAT.darkSteel, x, Y.dies + 0.04 + l * 0.055, z);
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.02, 1.0), [MAT.hbm, MAT.hbm, hbmTopMat, MAT.hbm, MAT.hbm, MAT.hbm]);
    top.position.set(x, Y.dies + 0.04 + 12 * 0.055, z); scene.add(top);
    for (let t = 0; t < 5; t++) N.box(0.01, 12 * 0.055, 0.01, MAT.copper, x - 0.3 + t * 0.15, Y.dies + 0.04 + 6 * 0.055, z - 0.505);   // TSVs, cut face
  });
  // lid, lifted, translucent so the dies read through it
  const lid = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.2, 7.0), new THREE.MeshPhysicalMaterial({ color: 0xc98a5c, metalness: 0.6, roughness: 0.45, envMapIntensity: 0.4, transparent: true, opacity: 0.16, depthWrite: false }));
  lid.position.set(0, Y.lid, 0); scene.add(lid);
  const lidEdge = new THREE.LineSegments(new THREE.EdgesGeometry(lid.geometry), new THREE.LineBasicMaterial({ color: 0xd9a070, transparent: true, opacity: 0.6 }));
  lidEdge.position.copy(lid.position); scene.add(lidEdge);

  scene.add(S.build()); scene.add(N.build({ cast: false }));

  // ---------- current climbing into the dies ----------
  let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 28; i++) {
    const x = (rnd() - 0.5) * 5.0, z = (rnd() - 0.5) * 3.0;
    flows.push(flow([[x, -1.4, z], [x, Y.balls, z], [x, Y.sub, z], [x, Y.bumps, z], [x, Y.inter, z], [x, Y.dies, z]], 'core', { count: 3, speed: 1.6 + rnd(), size: 0.03, k: 2.8, trail: false }));
  }
  // die-to-die traffic across NV-HBI
  flows.forEach(f => scene.add(f.group));
  // ---------- data: die to die, HBM into the dies, NVLink out of the package edge ----------
  for (let i = 0; i < 7; i++) { const z = -1.35 + i * 0.45; dataFlows.push(flow([[-1.2, Y.dies + 0.06, z], [1.2, Y.dies + 0.06, z]], 'hbi', { count: 3, speed: 2.4, size: 0.035, k: 3.2, trail: false })); dataFlows.push(flow([[1.2, Y.dies + 0.07, z + 0.1], [-1.2, Y.dies + 0.07, z + 0.1]], 'hbi', { count: 3, speed: 2.4, size: 0.035, k: 3.2, trail: false })); }
  hbmPos.forEach(([x, z]) => { for (const dx of [-0.25, 0, 0.25]) dataFlows.push(flow([[x + dx, Y.dies + 0.3, z], [x * 0.85 + dx, Y.dies + 0.06, z * 0.5]], 'hbm', { count: 3, speed: 1.2, size: 0.03, k: 3.4, trail: false })); });
  const serdes = glowMat('#ff5fd2', 1.6);
  for (const side of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 3.0), serdes); m.position.set(side * 2.62, Y.dies + 0.05, 0); scene.add(m);
    for (let i = 0; i < 9; i++) { const z = -1.3 + i * 0.325; dataFlows.push(flow([[side * 2.62, Y.dies + 0.04, z], [side * 3.1, Y.inter + 0.06, z], [side * 3.1, Y.sub + 0.14, z * 1.2], [side * 4.2, Y.sub + 0.14, z * 1.25]], 'nvl', { count: 3, speed: 1.6, size: 0.035, k: 2.8, trailR: 0.008, trailK: 0.3 })); }
  }
  dataFlows.forEach(f => scene.add(f.group));
  // ---------- heat: up out of the dies and HBM, through the lid ----------
  for (let i = 0; i < 30; i++) {
    const x = (rnd() - 0.5) * 5.0, z = (rnd() - 0.5) * 3.0;
    heatFlows.push(flow([[x, Y.dies + 0.06, z], [x, Y.lid - 0.12, z], [x * 1.05, Y.lid + 1.4, z * 1.05]], 'hot', { count: 3, speed: 1.1 + rnd() * 0.6, size: 0.045, k: 2.6, trail: false }));
  }
  hbmPos.forEach(([x, z]) => heatFlows.push(flow([[x, Y.dies + 0.72, z], [x, Y.lid - 0.12, z], [x, Y.lid + 1.2, z]], 'air', { count: 2, speed: 0.9, size: 0.04, k: 2.4, trail: false })));
  heatFlows.forEach(f => scene.add(f.group));

  // ---------- tokens ----------
  const cache = new Map();
  const sprites = [];
  for (let i = 0; i < 26; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, opacity: 0 }));
    sp.visible = false; scene.add(sp); sprites.push({ sp, t: 0, live: false, x0: 0, z0: 0 });
  }
  let next = 0, acc = 0, wordI = 0;
  const pulse = { v: 0 };
  function spawn() {
    const s = sprites[next++ % sprites.length];
    const word = TOKENS[wordI++ % TOKENS.length];
    if (!cache.has(word)) cache.set(word, wordTexture(word));
    const { tex, aspect } = cache.get(word);
    s.sp.material.map = tex; s.sp.material.needsUpdate = true;
    s.aspect = aspect; s.live = true; s.t = 0; s.x0 = (rnd() - 0.5) * 4.2; s.z0 = (rnd() - 0.5) * 2.4; s.sp.visible = true;
    pulse.v = 1;
  }

  return {
    scene, flows,
    camera: { pos: [9.5, 8.2, 11.5], target: [0, 2.3, 0], near: 0.05, far: 500, min: 2, max: 40 },
    hotspots: {
      balls: { pos: [3.9, Y.sub, 3.9], view: { pos: [8, 2.5, 8], target: [2, 0.8, 2] } },
      interposer: { pos: [3.1, Y.inter, 0], view: { pos: [7.5, 4.2, 4.5], target: [1.5, 2.2, 0] } },
      dies: { pos: [-1.36, Y.dies + 0.1, 0.4], view: { pos: [-1, 8, 5], target: [-0.6, 3.1, 0] } },
      hbm: { pos: [2.02, Y.dies + 0.75, 2.3], view: { pos: [5.5, 5.2, 6.5], target: [1.6, 3.3, 2.1] } },
      tokens: { pos: [3.8, 7.2, -1.0], view: { pos: [11, 8.5, 8], target: [2.5, 5.5, -1] } },
    },
    dataFlows, heatFlows,
    heatHotspots: {
      junction: { pos: [-1.36, Y.dies + 0.1, 0.4], view: { pos: [-1, 8, 5], target: [-0.6, 3.1, 0] } },
      flux: { pos: [1.36, Y.dies + 0.1, -0.8], view: { pos: [4, 6.5, 4], target: [1, 3.1, 0] } },
      tim: { pos: [3.2, Y.lid + 0.1, 3.0], view: { pos: [9, 7.5, 9], target: [0, 4, 0] } },
      hbm: { pos: [2.02, Y.dies + 0.75, 2.3], view: { pos: [5.5, 5.2, 6.5], target: [1.6, 3.3, 2.1] } },
    },
    dataHotspots: {
      hbm: { pos: [2.02, Y.dies + 0.75, 2.3], view: { pos: [5.5, 5.2, 6.5], target: [1.6, 3.3, 2.1] } },
      hbi: { pos: [0, Y.dies + 0.12, 1.3], view: { pos: [1.5, 7.5, 5.5], target: [0, 3.1, 0] } },
      nvphy: { pos: [2.62, Y.dies + 0.1, -1.2], view: { pos: [8, 5, 1], target: [3, 2.6, 0] } },
      cpo: { pos: [-4.2, Y.sub + 0.3, 3.8], view: { pos: [-8, 5, 9], target: [-2.5, 1.5, 2] } },
      tokens: { pos: [3.8, 7.2, -1.0], view: { pos: [11, 8.5, 8], target: [2.5, 5.5, -1] } },
    },
    update(t, dt) {
      const rate = Math.min(9, 1.5 + Math.log10(Math.max(1, state.tokPerGpu)) * 1.4);   // sprites per second, scaled for legibility
      acc += dt * rate; while (acc >= 1) { spawn(); acc -= 1; }
      for (const s of sprites) {
        if (!s.live) continue;
        s.t += dt / 3.2;
        if (s.t >= 1) { s.live = false; s.sp.visible = false; continue; }
        const u = s.t, e = 1 - Math.pow(1 - u, 2);
        s.sp.position.set(s.x0 + 1.2 + e * 4.2, Y.dies + 0.4 + e * 4.4, s.z0 - e * 1.5);
        const sz = 0.3 + e * 0.08; s.sp.scale.set(sz * s.aspect, sz, 1);
        s.sp.material.opacity = Math.min(1, u * 6) * (1 - Math.max(0, (u - 0.7) / 0.3));
      }
      pulse.v = Math.max(0, pulse.v - dt * 3);
      const heatOn = state.mode === 'heat';
      dieMat.emissive.setHex(heatOn ? 0xff6a1a : 0x6fd8ff);
      dieMat.emissiveIntensity = heatOn ? 0.55 + 0.08 * Math.sin(t * 2) : 0.06 + pulse.v * 0.12;
      dies.forEach(d => (d.material[2].emissiveIntensity = dieMat.emissiveIntensity));
    },
  };
}
