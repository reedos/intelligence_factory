// Scene 5: the GPU package, exploded, and the tokens that leave it. World unit = 1 cm.
// Blackwell and Rubin: two dies, HBM above and below. H100: one die, HBM sites left and right.
import { THREE, MAT, Builder, flow, canvasTex, glowMat } from '../kit.js';
import { rbox } from '../fx.js';
import { computeMaterials, finishCompute, boardFinish } from './compute-finish.js';
import { STREAM_TPS, buildCycle, sampleAt, tick } from '../model/token-script.js';
import { frameCompute } from './compute-framing.js';
import { componentView } from '../app/housing-frame.js';

function dieTexture() {
  return canvasTex(640, 800, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, '#2f3466'); gr.addColorStop(0.45, '#4d5c8e'); gr.addColorStop(0.55, '#5a4f86'); gr.addColorStop(1, '#2b3160');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    // Illustrative lithographic pattern, not a literal floorplan or SM count.
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
// A token sprite's look depends on its lane (prompt in, reasoning dim and small, answer bright and larger) and
// alternates a shade per token so the boundary between adjacent tokens is visible. Several consecutive tokens
// can share one sprite (see the chunking below `feedLane`) so a fast decode stream doesn't outrun the sprite
// pool; `words` renders each token as its own tinted segment, with a gap between them, so the boundary still reads.
function chunkTexture(words, lane, startParity) {
  const dim = lane === 'reasoning', big = lane === 'answer';
  const px = dim ? 40 : big ? 68 : 52, weight = dim ? 'italic 500' : '600';
  const font = `${weight} ${px}px "IBM Plex Mono", ui-monospace, monospace`;
  const c = document.createElement('canvas'); const g = c.getContext('2d'); g.font = font;
  const padPer = dim ? 16 : big ? 30 : 24, gap = dim ? 4 : big ? 9 : 7, h = big ? 104 : dim ? 64 : 92;
  const widths = words.map(w => Math.max(6, Math.ceil(g.measureText(w).width) + padPer));
  const tw = widths.reduce((a, b) => a + b, 0) + gap * (words.length - 1);
  c.width = tw; c.height = h; g.font = font; // sizing the canvas resets its context
  let x = 0;
  words.forEach((w, i) => {
    const parity = (startParity + i) % 2 === 1, ww = widths[i];
    if (!dim) {
      g.fillStyle = parity ? 'rgba(12,18,28,0.72)' : 'rgba(12,18,28,0.88)';
      g.beginPath(); g.roundRect(x + 2, 6, ww - 4, h - 12, 16); g.fill();
      g.strokeStyle = lane === 'prompt' ? (parity ? 'rgba(120,225,255,0.55)' : 'rgba(120,225,255,0.85)') : (parity ? 'rgba(230,186,130,0.5)' : 'rgba(230,186,130,0.8)');
      g.lineWidth = 2.5; g.stroke();
    }
    g.fillStyle = dim ? (parity ? '#d2dff4' : '#edf3ff') : lane === 'prompt' ? '#d8f6ff' : '#fff6e9';
    g.textBaseline = 'middle'; g.fillText(w, x + (dim ? 10 : 20), h / 2 + (dim ? 1 : 2));
    x += ww + gap;
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return { tex: t, aspect: tw / h };
}

export function build(options) {
  const result = buildPackage(options);
  frameCompute(result, 'chip', options.model.accel.id);
  return result;
}
function buildPackage({ quality, state, model }) {
  const A = model.accel, twin = A.dies > 1, layers = A.hbm.layers;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x090c12);
  scene.add(new THREE.HemisphereLight(0xb5c3e6, 0x111317, 0.8));
  const key = new THREE.DirectionalLight(0xfff0de, 2.0); key.position.set(-7, 12, 3);
  if (quality.shadows) { key.castShadow = true; key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 40 }); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.01; }
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x7aa6ff, 1.2); rim.position.set(-8, 5, -8); scene.add(rim);

  const flows = [], dataFlows = [], heatFlows = [];
  const S = new Builder(), N = new Builder();
  const finish = computeMaterials();
  // layer heights (exploded)
  const Y = { balls: 0.12, sub: 1.1, bumps: 2.05, inter: 2.3, dies: 3.2, lid: 4.7 };
  const SUB = 8.4;

  // board beneath, cut square
  S.box(12, 0.16, 12, MAT.pcb, 0, -0.08, 0);
  boardFinish(N, finish, 0, -0.01, 0, 12, 12, 3);
  for (let i = 0; i < 26; i++) N.box(0.06, 0.004, 11.6, MAT.copper, -5.6 + i * 0.45, 0.002, 0);
  // BGA balls
  const ball = new THREE.SphereGeometry(0.1, 10, 8);
  const pitch = 0.3, nB = 26, balls = new THREE.InstancedMesh(ball, MAT.nickel, nB * nB);
  balls.userData.computeDynamic = 'bga';
  const o = new THREE.Object3D(); let bi = 0;
  for (let i = 0; i < nB; i++) for (let j = 0; j < nB; j++) { o.position.set(-3.75 + i * pitch, Y.balls, -3.75 + j * pitch); o.updateMatrix(); balls.setMatrixAt(bi++, o.matrix); }
  balls.castShadow = true; scene.add(balls);
  // organic substrate with decoupling capacitors
  S.box(SUB, 0.25, SUB, MAT.pcbBlack, 0, Y.sub, 0);
  S.box(SUB - 0.1, 0.01, SUB - 0.1, MAT.pcb, 0, Y.sub + 0.13, 0);
  // Four edge rows of representative surface-mount decoupling capacitors.
  // Keep the original 90 count; the orthogonal placement and plated terminals
  // read as assembled electronics rather than a decorative circular necklace.
  for (let i = 0; i < 90; i++) {
    const edge = Math.floor(i / 23), k = i % 23, a = (k - 11) * 0.29;
    const x = edge < 2 ? a : (edge === 2 ? -3.64 : 3.64);
    const z = edge < 2 ? (edge === 0 ? -3.64 : 3.64) : a;
    const rotated = edge >= 2;
    N.box(rotated ? 0.07 : 0.12, 0.06, rotated ? 0.12 : 0.07, MAT.beige, x, Y.sub + 0.16, z);
    for (const s of [-1, 1]) N.box(rotated ? 0.075 : 0.025, 0.065, rotated ? 0.025 : 0.075, finish.satin,
      x + (rotated ? 0 : s * 0.05), Y.sub + 0.16, z + (rotated ? s * 0.05 : 0));
  }
  for (const side of [-1, 1]) for (const dy of [-0.08, 0, 0.08]) {
    N.box(SUB - 0.08, 0.008, 0.008, finish.laminate, 0, Y.sub + dy, side * (SUB / 2 + 0.004));
    N.box(0.008, 0.008, SUB - 0.08, finish.laminate, side * (SUB / 2 + 0.004), Y.sub + dy, 0);
  }
  // The stiffener ring is authored in Blender (tools/blender/build-compute.py).
  // C4 bumps between substrate and interposer
  const bump = new THREE.SphereGeometry(0.045, 8, 6), nx = 34, nz = 32;
  const bumps = new THREE.InstancedMesh(bump, MAT.nickel, nx * nz); bi = 0;
  bumps.userData.computeDynamic = 'c4';
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { o.position.set(-2.97 + i * 0.18, Y.bumps, -2.79 + j * 0.18); o.updateMatrix(); bumps.setMatrixAt(bi++, o.matrix); }
  scene.add(bumps);
  // silicon interposer
  const IW = twin ? 6.2 : 6.0, ID = twin ? 5.9 : 4.0;
  S.box(IW, 0.1, ID, MAT.silicon, 0, Y.inter, 0);
  for (let i = 0; i < 40; i++) N.box(0.012, 0.004, ID - 0.3, MAT.gold, -2.9 + i * 0.15, Y.inter + 0.052, 0);
  // GPU dies
  const dieMat = new THREE.MeshPhysicalMaterial({ map: dieTexture(), roughness: 0.38, metalness: 0.35, clearcoat: 0.25, clearcoatRoughness: 0.32, iridescence: 0.18, iridescenceThicknessRange: [110, 230], envMapIntensity: 0.35, emissive: 0x6fd8ff, emissiveIntensity: 0.0 });
  dieMat.userData.ifxAnimatedSurface = 'gpu-die';
  const dieSide = new THREE.MeshStandardMaterial({ color: 0x3b4262, roughness: 0.3, metalness: 0.6 });
  const dies = [];
  const dieX = twin ? [-1.36, 1.36] : [0];
  for (const dx of dieX) {
    const d = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 3.3), [dieSide, dieSide, dieMat, dieSide, dieSide, dieSide]);
    d.position.set(dx, Y.dies, 0); if (dx > 0) d.rotation.y = Math.PI; d.castShadow = true; scene.add(d); dies.push(d);
  }
  // NV-HBI bridge glow between the dies
  if (twin) { const hbi = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 3.0), glowMat('#6fd8ff', 2.4)); hbi.position.set(0, Y.dies + 0.02, 0); scene.add(hbi); }
  // HBM stacks: one molded block per stack (logic base die plus DRAM dies in
  // epoxy mold compound) with a bare silicon top. The layer count reads as a
  // striped band on the cut face that carries the TSVs. Real stacks are about
  // 0.72 mm tall, level with the GPU die; the height here is drawn about 3x
  // (representative) so the layers stay visible.
  const mold = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.55, metalness: 0.05 }); mold.name = 'HBM epoxy mold compound';
  const hbmTopMat = new THREE.MeshPhysicalMaterial({ color: 0x6c737c, roughness: 0.18, metalness: 0.0, clearcoat: 0.6, clearcoatRoughness: 0.2 }); hbmTopMat.name = 'HBM bare silicon top';
  const dramMat = new THREE.MeshStandardMaterial({ color: 0x59616c, roughness: 0.3, metalness: 0.35 }); dramMat.name = 'HBM DRAM die edge';
  const baseDieMat = new THREE.MeshStandardMaterial({ color: 0x7a6a52, roughness: 0.34, metalness: 0.4 }); baseDieMat.name = 'HBM logic base die edge';
  const spacerMat = new THREE.MeshPhysicalMaterial({ color: 0x8a929c, roughness: 0.12, metalness: 0.0, clearcoat: 1.0, clearcoatRoughness: 0.08 }); spacerMat.name = 'Blank silicon spacer';
  const hbmPos = [];
  if (twin) { for (const x of [-2.02, -0.7, 0.7, 2.02]) for (const z of [-2.3, 2.3]) hbmPos.push([x, z]); }
  else { for (const x of [-2.05, 2.05]) for (const z of [-1.12, 0, 1.12]) hbmPos.push([x, z]); }
  const spare = twin ? -1 : 5;                           // H100: six sites, five working stacks and a spacer
  const HW = 1.06, HD = 1.0, hb = Y.dies - 0.04;       // stack footprint and underside, level with the die underside
  const stackH = 0.24;
  const spacerOutlines = [];
  hbmPos.forEach(([x, z], i) => {
    if (i === spare) {
      // A blank polished silicon spacer keeps the sixth site level: no DRAM,
      // no TSVs. A dashed outline marks it as the unpopulated site.
      S.box(HW, stackH, HD, spacerMat, x, hb + stackH / 2, z);
      spacerOutlines.push([x, z]);
      return;
    }
    S.box(HW, stackH - 0.012, HD, mold, x, hb + (stackH - 0.012) / 2, z);
    S.box(HW - 0.04, 0.012, HD - 0.04, hbmTopMat, x, hb + stackH - 0.006, z);
    // the cut face on the package-edge side: base die, then one band per DRAM die, then TSVs
    const n = layers + 1, band = (stackH - 0.03) / n;
    const fx = twin ? 0 : Math.sign(x), fz = twin ? Math.sign(z) : 0;            // outward normal of the cut face
    const fcx = x + fx * (HW / 2 + 0.002), fcz = z + fz * (HD / 2 + 0.002), along = twin ? HW - 0.08 : HD - 0.08;
    for (let l = 0; l < n; l++) {
      const y = hb + 0.015 + band * (l + 0.5), h = band * (l === 0 ? 0.8 : 0.55);
      const m = l === 0 ? baseDieMat : dramMat;
      if (twin) N.box(along, h, 0.004, m, fcx, y, fcz); else N.box(0.004, h, along, m, fcx, y, fcz);
    }
    for (let t = 0; t < 5; t++) {
      const off = -0.3 + t * 0.15;
      if (twin) N.box(0.01, stackH - 0.03, 0.006, MAT.copper, x + off, hb + stackH / 2, fcz + fz * 0.002);
      else N.box(0.006, stackH - 0.03, 0.01, MAT.copper, fcx + fx * 0.002, hb + stackH / 2, z + off);
    }
  });
  const live = hbmPos.filter((_, i) => i !== spare);
  // lid, lifted, translucent so the dies read through it
  const lid = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.2, 7.0), new THREE.MeshPhysicalMaterial({ color: 0xc1cbd6, metalness: 0.6, roughness: 0.36, envMapIntensity: 0.4, transparent: true, opacity: 0.085, depthWrite: false }));
  lid.material.userData.ifxCoverSurface = 'ihs';
  lid.position.set(0, Y.lid, 0); scene.add(lid);
  const lidEdge = new THREE.LineSegments(new THREE.EdgesGeometry(lid.geometry), new THREE.LineBasicMaterial({ color: 0xc8d2df, transparent: true, opacity: 0.4 }));
  lidEdge.position.copy(lid.position); scene.add(lidEdge);
  lidEdge.userData.computeCoverOutline = 'ihs';
  // Opaque machined perimeter keeps the illustrative x-ray lid legible as metal.
  const lidRim = finish.satin.clone();
  lidRim.userData.ifxCoverSurface = 'ihs';
  for (const side of [-1, 1]) {
    rbox(N, 7.2, 0.035, 0.07, lidRim, 0, Y.lid + 0.075, side * 3.465, { r: 0.22 });
    rbox(N, 0.07, 0.035, 6.86, lidRim, side * 3.565, Y.lid + 0.075, 0, { r: 0.22 });
  }

  scene.add(S.build()); scene.add(N.build({ cast: false }));
  for (const [x, z] of spacerOutlines) {
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(HW + 0.04, stackH + 0.02, HD + 0.04)),
      new THREE.LineDashedMaterial({ color: 0xdfe6ee, dashSize: 0.06, gapSize: 0.045, transparent: true, opacity: 0.85 }));
    edge.computeLineDistances(); edge.position.set(x, hb + stackH / 2, z); edge.name = 'Unpopulated HBM site outline'; scene.add(edge);
  }
  finishCompute(scene, finish);

  // ---------- current climbing into the dies ----------
  let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  // Sample inside actual silicon, never in the visible seam between twin dies.
  const dieSampleX = () => twin ? ((rnd() < 0.5 ? -1 : 1) * 1.36 + (rnd() - 0.5) * 2.4) : (rnd() - 0.5) * 2.4;
  for (let i = 0; i < 28; i++) {
    const x = dieSampleX(), z = (rnd() - 0.5) * 3.0;
    flows.push(flow([[x, -1.4, z], [x, Y.balls, z], [x, Y.sub, z], [x, Y.bumps, z], [x, Y.inter, z], [x, Y.dies, z]], 'core', { count: 3, speed: 1.6 + rnd(), size: 0.03, k: 2.8, trail: false }));
  }
  // die-to-die traffic across NV-HBI
  flows.forEach(f => scene.add(f.group));
  // ---------- data: die to die, HBM into the dies, NVLink out of the package edge ----------
  if (twin) for (let i = 0; i < 7; i++) { const z = -1.35 + i * 0.45; dataFlows.push(flow([[-1.2, Y.dies + 0.06, z], [1.2, Y.dies + 0.06, z]], 'hbi', { count: 3, speed: 2.4, size: 0.035, k: 3.2, trail: false })); dataFlows.push(flow([[1.2, Y.dies + 0.07, z + 0.1], [-1.2, Y.dies + 0.07, z + 0.1]], 'hbi', { count: 3, speed: 2.4, size: 0.035, k: 3.2, trail: false })); }
  live.forEach(([x, z]) => { for (const d of [-0.25, 0, 0.25]) dataFlows.push(flow(twin ? [[x + d, Y.dies + 0.3, z], [x * 0.85 + d, Y.dies + 0.06, z * 0.5]] : [[x, Y.dies + 0.3, z + d], [x * 0.5, Y.dies + 0.06, z * 0.8 + d]], 'hbm', { count: 3, speed: 1.2, size: 0.03, k: 3.4, trail: false })); });
  const serdes = glowMat('#ff5fd2', 1.6);
  // NVLink leaves the free edges: outer die edges on twins, top/bottom on H100.
  // The substrate leg is a buried electrical route, below the metal stiffener;
  // its previous top-surface height falsely ran through that structural frame.
  for (const side of [-1, 1]) {
    if (twin) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 3.0), serdes); m.position.set(side * 2.62, Y.dies + 0.05, 0); scene.add(m);
      for (let i = 0, n = A.nvlink.linksPerGpu / 2; i < n; i++) { const z = -1.3 + i * 2.6 / (n - 1); dataFlows.push(flow([[side * 2.62, Y.dies + 0.04, z], [side * 3.1, Y.inter + 0.06, z], [side * 3.1, Y.sub - 0.01, z * 1.2], [side * 4.2, Y.sub - 0.01, z * 1.25]], 'nvl', { count: 3, speed: 1.6, size: 0.035, k: 2.8, trailR: 0.008, trailK: 0.3 })); }
    } else {
      const m = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.03, 0.1), serdes); m.position.set(0, Y.dies + 0.05, side * 1.62); scene.add(m);
      for (let i = 0; i < 9; i++) { const x = -1.1 + i * 0.275; dataFlows.push(flow([[x, Y.dies + 0.04, side * 1.62], [x, Y.inter + 0.06, side * 2.1], [x * 1.2, Y.sub - 0.01, side * 2.6], [x * 1.25, Y.sub - 0.01, side * 4.0]], 'nvl', { count: 3, speed: 1.6, size: 0.035, k: 2.8, trailR: 0.008, trailK: 0.3 })); }
    }
  }
  dataFlows.forEach(f => scene.add(f.group));
  // ---------- heat: up out of the dies and HBM, through the lid ----------
  for (let i = 0; i < 30; i++) {
    const x = dieSampleX(), z = (rnd() - 0.5) * 3.0;
    heatFlows.push(flow([[x, Y.dies + 0.06, z], [x, Y.lid - 0.12, z], [x * 1.05, Y.lid + 1.4, z * 1.05]], 'hot', { count: 3, speed: 1.1 + rnd() * 0.6, size: 0.045, k: 2.6, trail: false }));
  }
  live.forEach(([x, z]) => { const f = flow([[x, hb + stackH, z], [x, Y.lid - 0.12, z], [x, Y.lid + 1.2, z]], 'hot', { count: 2, speed: 0.9, size: 0.04, k: 2.4, trail: false }); f.thermalOrigin = 'hbm'; heatFlows.push(f); });
  scene.userData.computePackage = { gpuDies: dieX.length, liveHbmStacks: live.length, hbmDramLayers: layers, spacerSites: spare < 0 ? 0 : 1, nvlinkLinks: A.nvlink.linksPerGpu, explodedRepresentative: true };
  heatFlows.forEach(f => scene.add(f.group));

  // ---------- tokens: a live generation cycle, streamed as sprites ----------
  // Three lanes share one cache (keyed by lane, token text and even/odd index, so the boundary between adjacent
  // tokens reads as a tint change): prompt tokens fly INTO the package as a burst (prefill); reasoning tokens
  // stream out small, dim and italic-looking, gathering into a faint ribbon; answer tokens stream out bright and
  // larger along the path tokens already left by. token-script.js is the single source for which tokens are out,
  // so the 3D stream and the 2D console (src/app/tokens-ui.js) always agree.
  const cache = new Map();
  function texFor(lane, words, startIdx) {
    const startParity = startIdx % 2, key = `${lane}:${startParity}:${words.join('\u0001')}`;
    if (!cache.has(key)) cache.set(key, chunkTexture(words, lane, startParity));
    return cache.get(key);
  }
  // more sprites, so each carries a few tokens rather than ten: a chunk reads as a phrase, not a banner across the package
  const CAP = quality.mobile ? { prompt: 6, reasoning: 12, answer: 16 } : { prompt: 12, reasoning: 24, answer: 36 };
  const LIFE = { prompt: 0.8, reasoning: 2.0, answer: 3.2 };
  function pool(n) {
    const arr = [];
    for (let i = 0; i < n; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, toneMapped: false, opacity: 0 }));
      sp.visible = false; scene.add(sp); arr.push({ sp, t: 0, live: false, x0: 0, z0: 0, aspect: 1 });
    }
    return arr;
  }
  const pools = { prompt: pool(CAP.prompt), reasoning: pool(CAP.reasoning), answer: pool(CAP.answer) };
  const nextI = { prompt: 0, reasoning: 0, answer: 0 };
  let tokenSequence = 0;
  const pulse = { v: 0 };
  function spawnChunk(lane, words, startIdx) {
    const arr = pools[lane], s = arr[nextI[lane]++ % arr.length];
    const { tex, aspect } = texFor(lane, words, startIdx);
    s.sp.material.map = tex; s.sp.material.needsUpdate = true;
    s.aspect = aspect; s.live = true; s.t = 0; s.sequence = tokenSequence++; s.lane = lane;
    s.sp.userData.tokenChunk = { lane, words: [...words], sequence: s.sequence };
    s.x0 = (rnd() - 0.5) * (twin ? 4.2 : 2.2); s.z0 = (rnd() - 0.5) * 2.4; s.sp.visible = true;
    if (lane === 'answer') pulse.v = 1;
  }
  // A decode stream reveals tokens far faster than a pool of a few dozen sprites can each fly a multi-second arc
  // without recycling a slot mid-flight (which reads as clutter — several words stacked on top of each other).
  // So several consecutive tokens are batched onto one sprite: `chunkSize` is picked, per lane, so that filling
  // the whole pool at that batch size takes at least one sprite's flight time (`LIFE`), which guarantees a slot
  // is free again before it's reused. `feedLane` buffers newly-revealed tokens and flushes a chunk once it's
  // full, or once the lane finishes (so trailing tokens are never dropped).
  const laneChunkSize = (lane, spawnRate) => Math.max(1, Math.ceil(spawnRate * LIFE[lane] / CAP[lane]));
  const pendingBuf = { prompt: { words: [], startIdx: 0 }, reasoning: { words: [], startIdx: 0 }, answer: { words: [], startIdx: 0 } };
  const chunkSize = { prompt: 1, reasoning: 1, answer: 1 };
  function resetGen() {
    genShown.prompt = genShown.reasoning = genShown.answer = 0;
    for (const lane of ['prompt', 'reasoning', 'answer']) pendingBuf[lane] = { words: [], startIdx: 0 };
    chunkSize.prompt = laneChunkSize('prompt', genCycle.prompt.length / genCycle.timings.prefillS);
    chunkSize.reasoning = laneChunkSize('reasoning', STREAM_TPS);
    chunkSize.answer = laneChunkSize('answer', STREAM_TPS);
  }
  function feedLane(lane, tokens, targetOut) {
    const buf = pendingBuf[lane];
    for (let i = genShown[lane]; i < targetOut; i++) {
      if (buf.words.length === 0) buf.startIdx = i;
      buf.words.push(tokens[i]);
      if (buf.words.length >= chunkSize[lane]) { spawnChunk(lane, buf.words, buf.startIdx); buf.words = []; }
    }
    if (targetOut >= tokens.length && buf.words.length > 0) { spawnChunk(lane, buf.words, buf.startIdx); buf.words = []; }
  }
  // the KV cache: a thin emissive sheath that climbs each live HBM stack as the context grows, and empties on
  // restart. Data layer only, and only slightly larger than the stack, so the stack itself still reads as hardware.
  const fillGeo = new THREE.BoxGeometry(1, 1, 1); fillGeo.translate(0, 0.5, 0);
  // additive, so it reads as light on the dark mold rather than a colored plastic shell
  const fillMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#c86bff').multiplyScalar(.9), transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending });
  const hbmFill = new THREE.InstancedMesh(fillGeo, fillMat, Math.max(1, live.length));
  hbmFill.frustumCulled = false; hbmFill.count = live.length; scene.add(hbmFill);
  let genCycle = buildCycle(model), genLen = genCycle.timings.totalS, genLastE = -1;
  const genShown = { prompt: 0, reasoning: 0, answer: 0 };
  resetGen();
  function animLane(arr, life, dt, place) {
    for (const item of arr) {
      if (!item.live) continue;
      item.sp.visible = true;
      item.t += dt / life;
      if (item.t >= 1) { item.live = false; item.sp.visible = false; continue; }
      place(item, item.t);
    }
  }

  const d0 = dieX[0], [hx, hz] = live[live.length - 1], hy = hb + stackH + 0.03;
  const hbmHS = { pos: [hx, hy, hz], view: { pos: [hx + 3.5, hy + 4.5, hz + 4.2], target: [hx * 0.8, Y.dies + 0.5, hz * 0.9] } };
  // Tokens: frame the top of the package and the live readout above it, so the
  // generated text is legible; the pin sits beside the rows, never on them.
  const TOKEN_ROWS = [2.2, 7.6, -1];
  const tokensHS = { pos: [TOKEN_ROWS[0] + 4.1, TOKEN_ROWS[1] - 1.3, TOKEN_ROWS[2]], view: componentView([2.0, 5.7, -0.5], [6, 4.6, 11], [9.4, 5.2, 5.0]) };
  const nvphyHS = twin ? { pos: [2.62, Y.dies + 0.1, -1.2], view: { pos: [8, 5, 1], target: [3, 2.6, 0] } } : { pos: [0.9, Y.dies + 0.1, 1.62], view: { pos: [2, 5.5, 8], target: [0, 2.6, 2.2] } };
  return {
    scene, flows,
    look: { env: 'studio', envIntensity: 0.45, exposure: 0.94, bloom: 0.32, threshold: 2.0, ao: 0.12, dof: true },
    camera: { pos: [9.5, 8.2, 11.5], target: [0, 2.3, 0], near: 0.05, far: 500, min: 2, max: 40 },
    // Lower power view exposes the exploded BGA/substrate/interposer gaps.
    // Data and heat retain their higher view of silicon and the heat spreader.
    cameraByMode: { power: { pos: [10.5, 4.4, 12], target: [0, 2.1, 0] } },
    hotspots: {
      balls: { pos: [3.75, .20, 3.75], view: { pos: [7, .6, 7], target: [2.8, .15, 2.8] } },
      interposer: { pos: [3.1, Y.inter, 0], view: { pos: [7.5, 4.2, 4.5], target: [1.5, 2.2, 0] } },
      dies: { pos: [d0, Y.dies + 0.1, 0.4], view: { pos: [d0 + 0.4, 8, 5], target: [d0 * 0.45, 3.1, 0] } },
      hbm: hbmHS,
      tokens: tokensHS,
    },
    dataFlows, heatFlows,
    heatHotspots: {
      junction: { pos: [d0, Y.dies + 0.1, 0.4], view: { pos: [d0 + 0.4, 8, 5], target: [d0 * 0.45, 3.1, 0] } },
      flux: { pos: [dieX[dieX.length - 1], Y.dies + 0.1, -0.8], view: { pos: [4, 6.5, 4], target: [1, 3.1, 0] } },
      tim: { pos: [3.2, Y.lid + 0.1, 3.0], view: { pos: [9, 7.5, 9], target: [0, 4, 0] } },
      hbm: hbmHS,
    },
    dataHotspots: {
      hbm: hbmHS,
      ...(twin ? { hbi: { pos: [0, Y.dies + 0.12, 1.3], view: { pos: [.2, 7.5, 1.2], target: [0, 3.1, .8] } } } : {}),
      nvphy: nvphyHS,
      cpo: { pos: [-4.2, Y.sub + 0.3, 3.8], view: { pos: [-8, 5, 9], target: [-2.5, 1.5, 2] } },
      tokens: tokensHS,
    },
    dispose() { cache.forEach(({ tex }) => tex.dispose()); },
    update(t, dt) {
      const e = tick(genLen);
      if (e < genLastE) { genCycle = buildCycle(model); genLen = genCycle.timings.totalS; resetGen(); }
      genLastE = e;
      const s = sampleAt(genCycle, e);
      feedLane('prompt', genCycle.prompt, s.promptOut);
      feedLane('reasoning', genCycle.reasoning, s.reasoningOut);
      feedLane('answer', genCycle.answer, s.answerOut);
      genShown.prompt = s.promptOut; genShown.reasoning = s.reasoningOut; genShown.answer = s.answerOut;

      animLane(pools.prompt, LIFE.prompt, dt, (item, u) => {
        const ez = u * u;                                                        // ease in: accelerates toward the die
        // the prompt comes in low and small, from just beyond the package, so it never crosses the title in a close view
        item.sp.position.set(item.x0 * 2.2 * (1 - ez) + item.x0 * 0.12 * ez, Y.dies + 2.2 * (1 - ez) + 0.14, item.z0 * 2.2 * (1 - ez) + item.z0 * 0.12 * ez);
        const sz = 0.17 * (1 - 0.35 * ez); item.sp.scale.set(sz * item.aspect, sz, 1);
        item.sp.material.opacity = Math.min(1, u * 5) * (1 - Math.max(0, (u - 0.72) / 0.28));
      });
      animLane(pools.reasoning, LIFE.reasoning, dt, (item, u) => {
        const g = 1 - Math.pow(1 - u, 3), pull = 1 - 0.45 * u;                    // gathers inward as it drifts up: a thinking ribbon, over the lid
        item.sp.position.set(item.x0 * 0.9 * pull, Y.lid + 0.15 + g * 0.8, item.z0 * 0.9 * pull);
        const sz = 0.13; item.sp.scale.set(sz * item.aspect, sz, 1);
        item.sp.material.opacity = 0.55 * Math.min(1, u * 5) * (1 - Math.max(0, (u - 0.65) / 0.35));
      });
      // capped below Y.dies+3 (~6.2 total) so the arc's top stays clear of the fixed 2D HUD chrome (title,
      // mode toggle, tour controls) at the chip scene's default and tokens-hotspot camera framings.
      animLane(pools.answer, LIFE.answer, dt, (item, u) => {
        const g = 1 - Math.pow(1 - u, 3);                                          // out of the die, clear of the lid fast, then drifting
        item.sp.position.set(item.x0 + 0.6 + g * 1.8, Y.dies + 0.4 + g * 2.6, item.z0 - g * 1.0);
        const sz = 0.2 + g * 0.08; item.sp.scale.set(sz * item.aspect, sz, 1);
        item.sp.material.opacity = Math.min(1, u * 6) * (1 - Math.max(0, (u - 0.7) / 0.3));
      });
      if (state.selected === 'tokens' && state.mode !== 'heat') {
        // The Tokens part shows the live generation in every layer: the three
        // newest chunks settle into a compact readout while the rest stay on
        // their flight paths out of the package, fading before they reach it.
        const all = Object.values(pools).flat();
        const recent = all.filter(item => item.live && item.sp.material.opacity > 0.04)
          .sort((a, b) => b.sequence - a.sequence).slice(0, 3).reverse();
        const shown = new Set(recent);
        for (const item of all) {
          item.sp.visible = item.live && (shown.has(item) || item.lane === 'answer');
          if (item.live && !shown.has(item)) item.sp.material.opacity *= Math.max(0, 1 - Math.max(0, item.t - 0.45) / 0.3) * 0.6;
        }
        recent.forEach((item, row) => {
          const h = Math.min(0.5, 9.0 / item.aspect);
          item.sp.position.set(TOKEN_ROWS[0], TOKEN_ROWS[1] - row * 0.72, TOKEN_ROWS[2]);
          item.sp.scale.set(h * item.aspect, h, 1);
          item.sp.material.opacity = Math.max(.9, item.sp.material.opacity); // selected, still-live text stays readable
        });
      } else {
        for (const item of Object.values(pools).flat()) item.sp.visible = false;
      }
      live.forEach(([x, z], i) => {
        const h = Math.max(0.02, stackH * s.contextFrac);
        o.position.set(x, hb + 0.002, z); o.rotation.set(0, 0, 0); o.scale.set(HW + 0.03, h, HD + 0.03); o.updateMatrix();
        hbmFill.setMatrixAt(i, o.matrix);
      });
      hbmFill.instanceMatrix.needsUpdate = true;
      hbmFill.visible = state.mode === 'data';          // the cache is a data-layer idea: hardware stays hardware in power and heat

      pulse.v = Math.max(0, pulse.v - dt * 3);
      const heatOn = state.mode === 'heat';
      dieMat.emissive.setHex(heatOn ? 0xff6a1a : 0x6fd8ff);
      dieMat.emissiveIntensity = heatOn ? 0.55 + 0.08 * Math.sin(t * 2) : 0.06 + pulse.v * 0.12;
      dies.forEach(d => (d.material[2].emissiveIntensity = dieMat.emissiveIntensity));
    },
  };
}
