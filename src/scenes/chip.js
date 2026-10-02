// Scene 5: the GPU package, exploded, and the tokens that leave it. World unit = 1 cm.
// Blackwell and Rubin: two dies, HBM above and below. H100: one die, HBM sites left and right.
import { THREE, MAT, Builder, flow, canvasTex, glowMat } from '../kit.js';
import { etch, GPU_NAME } from './package-marks.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { computeMaterials, finishCompute, boardFinish } from './compute-finish.js';
import { STREAM_TPS, buildCycle, sampleAt, tick } from '../model/token-script.js';
import { frameCompute } from './compute-framing.js';
import { componentView } from '../app/housing-frame.js';
import { installTokenMath } from './token-math.js';
import { tagHeat, balanceHeat } from '../heat.js';
import { hbmWaterfall, waterfallProfile } from './hbm-waterfall.js';
import { dieActivity } from './die-activity.js';

// The visible top of a flip-chip die is its polished silicon backside. A faint
// roughness pattern (a grayscale map) lets the key light break across it.
function dieRoughness() {
  return canvasTex(512, 640, (g, w, h) => {
    g.fillStyle = 'rgb(60,60,60)'; g.fillRect(0, 0, w, h);
    let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const cols = 8, rows = 10, pad = 20, cw = (w - pad * 2) / cols, rh = (h - pad * 2) / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const v = 38 + Math.round(rnd() * 72);
      g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(pad + c * cw + 2, pad + r * rh + 2, cw - 4, rh - 4);
    }
    g.fillStyle = 'rgba(120,120,120,0.6)'; g.fillRect(0, 0, w, 6); g.fillRect(0, h - 6, w, 6); g.fillRect(0, 0, 6, h); g.fillRect(w - 6, 0, 6, h);
  }, { srgb: false });
}
// X-ray floorplan decal: thin lines, not filled boxes. Illustrative, not a
// literal floorplan or SM count (die-floorplan-drawing). hbmEdges: 'z' puts the
// HBM PHY along the long edges (twin dies), 'x' along the short edges (H100).
// distance from point p to segment ab (canvas pixels)
function distToSeg(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
  const t = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
// The floorplan's layout in canvas pixels (1024 x 1300, the die's 2.56 x 3.26 cm face): shared by the x-ray decal and
// the on-die activity (die-activity.js), so the lights sit on the tiles the decal draws.
export function floorplanLayout(hbmEdges) {
  const w = 1024, h = 1300, phy = 70, pad = hbmEdges === 'z' ? phy + 26 : 40, padX = hbmEdges === 'x' ? phy + 26 : 40;
  const cols = 8, rows = 8, cw = (w - padX * 2) / cols, band = 90, rh = (h - pad * 2 - band) / rows;
  const tiles = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) tiles.push({ r, c, x: padX + c * cw, y: pad + r * rh + (r >= rows / 2 ? band : 0), w: cw, h: rh });
  return { w, h, phy, pad, padX, cols, rows, cw, rh, band, tiles };
}
export function floorplanTexture(hbmEdges, seam) {
  return canvasTex(1024, 1300, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const line = (a, width = 2) => { g.strokeStyle = `rgba(150,225,255,${a})`; g.lineWidth = width; };
    const { phy, pad, padX, cols, rows, cw, band, rh } = floorplanLayout(hbmEdges);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = padX + c * cw, y = pad + r * rh + (r >= rows / 2 ? band : 0);
      line(0.55, 2); g.strokeRect(x + 5, y + 5, cw - 10, rh - 10);
      line(0.25, 1); for (let t = 1; t < 4; t++) { g.beginPath(); g.moveTo(x + 5 + t * (cw - 10) / 4, y + rh * 0.45); g.lineTo(x + 5 + t * (cw - 10) / 4, y + rh - 5); g.stroke(); }
      g.beginPath(); g.moveTo(x + 5, y + rh * 0.45); g.lineTo(x + cw - 5, y + rh * 0.45); g.stroke();
    }
    g.strokeStyle = 'rgba(255,200,140,0.75)'; g.lineWidth = 2.5; g.strokeRect(padX, h / 2 - band / 2 + 8, w - padX * 2, band - 16);   // L2 cache band
    g.strokeStyle = 'rgba(200,150,255,0.8)'; g.lineWidth = 2.5;                                                               // HBM PHY
    if (hbmEdges === 'z') { g.strokeRect(24, 10, w - 48, phy); g.strokeRect(24, h - 10 - phy, w - 48, phy); }
    else { g.strokeRect(10, 24, phy, h - 48); g.strokeRect(w - 10 - phy, 24, phy, h - 48); }
    if (seam) { g.strokeStyle = 'rgba(111,216,255,0.9)'; g.strokeRect(w - 34, pad, 24, h - pad * 2); }                       // NV-HBI PHY on the seam edge
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

// The host board's BGA land pattern (26 x 26 pads at 0.3 cm, as drawn) and the escape runs that leave its outer
// row: run k of a side starts on outer-row pad k + 1, leaves straight for 0.35 cm, jogs 45 degrees toward the
// nearer corner (more for runs nearer the corner, so neighbours never cross) and ends on a via at 5.25 cm.
// Points are world [x, z] in cm, package centre at the origin. Side 0 leaves toward +x, 1 toward -x, 2 toward
// +z, 3 toward -z (the texture's pixel axes map to world x and z).
export const BGA = { pitch: 0.3, n: 26, half: 3.75 }, BGA_RUNS = 24;
// the HBM print on a stack top, as fractions of the top: its length along the text, its height, and how far its centre
// sits from the top's centre toward the stack's outer edge
export const HBM_LABEL = { len: 0.6, h: 0.2, off: 0.24 };
export function bgaRun(side, k) {
  const along = -BGA.half + (k + 1) * BGA.pitch, t = (k - (BGA_RUNS - 1) / 2) / ((BGA_RUNS - 1) / 2), jog = t * Math.abs(t) * 0.85;
  const r0 = BGA.half, r1 = 5.25;
  const pt = (r, a) => side === 0 ? [r, a] : side === 1 ? [-r, -a] : side === 2 ? [-a, r] : [a, -r];
  return [pt(r0, along), pt(r0 + 0.35, along), pt(r0 + 0.35 + Math.abs(jog), along + jog), pt(r1, along + jog)];
}

export function build(options) {
  const result = buildPackage(options);
  frameCompute(result, 'chip', options.model.accel.id);
  if (options.quality?.mobile) {
    // Portrait phones are width-limited: a steeper view and a tighter fit on the
    // 8.4 cm package (the board is context) let the stack fill more of the height.
    // {pos, target} only, not componentView's full result: carrying its `detailSize` into
    // built.camera makes stage.js's cameraPreset() treat the whole overview as a part/hotspot view
    // (see the comment in compute-framing.js) instead of landing on this pivot directly.
    result.camera = { ...result.camera, pos: [6, 12.655, 7.5], target: [0, 1.655, 0] };
    result.cameraByMode.power = { pos: [8, 7.22, 9.8], target: [0, 1.62, 0] };
  }
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
  // A soft fill from the side opposite the key, so the second die and its HBM
  // cluster read with the same specular pop as the first. Studio art direction
  // repositions only the key and rim; this third light keeps its place.
  const balance = new THREE.DirectionalLight(0xe4ecf7, 0.6); balance.name = 'Package balance fill';
  balance.position.set(5.6, 11.1, -5.2); balance.target.position.set(0, 2.3, 0); scene.add(balance, balance.target);

  const flows = [], dataFlows = [], heatFlows = [];
  const S = new Builder(), N = new Builder();
  const finish = computeMaterials();
  // layer heights (exploded)
  const Y = { balls: 0.068, sub: 1.1, bumps: 2.05, inter: 2.3, dies: 3.2, lid: 4.7 };   // lid: the lifted, translucent heat spreader
  const SUB = 8.4;
  const dots = (pitch, r, bg, dot) => canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = dot;
    for (let y = pitch / 2; y < h; y += pitch) for (let x = pitch / 2; x < w; x += pitch) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  });
  // Builder merges drop UVs, so textured slabs are their own meshes; UVs scale with size so the dot pitch stays fixed.
  const texBox = (w, h, d, mat, x, y, z, cell) => {
    const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * w / cell, uv.getY(k) * d / cell);
    const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; scene.add(m); return m;
  };

  // board beneath, cut square: 10.8 cm, a 1.2 cm margin around the package, so
  // the whole cut board still fits a portrait phone frame
  const BOARD = 10.8;
  // Host board under the package: solder mask with the BGA land pattern (gold
  // pads on the ball grid), a via field and trace bundles fanning out, darkening
  // toward the cut edge. Representative host board.
  const boardTex = canvasTex(2048, 2048, (g, w, h) => {
    const px = w / BOARD, c = w / 2;
    g.fillStyle = '#0d2a26'; g.fillRect(0, 0, w, h);
    let seed = 9; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    // Trace fan-out on every side of the BGA field: each run starts on an outer-row pad (the dog-bone escape a BGA
    // breakout uses for its outer row), leaves straight, and the runs nearer the corners jog 45 degrees so the
    // corners carry routing too. Copper under the green mask reads lighter than the bare laminate; each run ends on
    // a tented via. bgaRun is shared with the NVLink flows, which leave the package along the same runs.
    g.strokeStyle = 'rgba(80,150,124,0.78)'; g.lineWidth = w / 560;
    const runs = [], ends = [];
    for (let side = 0; side < 4; side++) for (let k = 0; k < BGA_RUNS; k++) {
      const run = bgaRun(side, k).map(([x, z]) => [c + x * px, c + z * px]);
      g.beginPath(); run.forEach((q, i) => i ? g.lineTo(...q) : g.moveTo(...q)); g.stroke(); runs.push(run);
      const [vx, vy] = run.at(-1); ends.push([vx, vy]);
      g.fillStyle = 'rgba(150,196,164,0.9)'; g.beginPath(); g.arc(vx, vy, 0.05 * px, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(12,30,26,1)'; g.beginPath(); g.arc(vx, vy, 0.022 * px, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = 'rgba(110,140,120,0.5)';
    // stray vias in the open board, never on a run or its end via
    const clearOfRuns = (x, y, d) => runs.every(run => run.slice(1).every((q, i) => distToSeg([x, y], run[i], q) > d)) && ends.every(([ex, ey]) => Math.hypot(x - ex, y - ey) > d + 0.05 * px);
    for (let k = 0; k < 500; k++) { const x = rnd() * w, y = rnd() * h; if (Math.max(Math.abs(x - c), Math.abs(y - c)) > 4.0 * px && clearOfRuns(x, y, 0.018 * px + w / 1120 + 3)) { g.beginPath(); g.arc(x, y, 0.018 * px, 0, Math.PI * 2); g.fill(); } }
    for (let i = 0; i < 26; i++) for (let j = 0; j < 26; j++) {          // BGA land pattern, ENIG gold, with a via beside each pad
      const x = c + (-3.75 + i * 0.3) * px, y = c + (-3.75 + j * 0.3) * px;
      g.fillStyle = '#c9a54f'; g.beginPath(); g.arc(x, y, 0.075 * px, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(20,40,34,0.9)'; g.beginPath(); g.arc(x + 0.15 * px, y + 0.15 * px, 0.025 * px, 0, Math.PI * 2); g.fill();
    }
    const fade = g.createRadialGradient(c, c, 4.4 * px, c, c, 7.7 * px);
    fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(4,8,10,0.92)');
    g.fillStyle = fade; g.fillRect(0, 0, w, h);
  });
  boardTex.anisotropy = 8;                                            // the solder-ball camera looks across it at a low angle
  const boardMat = new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.6, metalness: 0.08, envMapIntensity: 0.6 }); boardMat.name = 'Host board solder mask';
  texBox(BOARD, 0.16, BOARD, boardMat, 0, -0.08, 0, BOARD);
  boardFinish(N, finish, 0, -0.01, 0, BOARD, BOARD, 3);
  // BGA balls
  const ball = new THREE.SphereGeometry(0.1, 10, 8);
  const pitch = 0.3, nB = 26, balls = new THREE.InstancedMesh(ball, MAT.nickel, nB * nB);
  balls.userData.computeDynamic = 'bga';
  const o = new THREE.Object3D(); let bi = 0;
  for (let i = 0; i < nB; i++) for (let j = 0; j < nB; j++) { o.position.set(-3.75 + i * pitch, Y.balls, -3.75 + j * pitch); o.updateMatrix(); balls.setMatrixAt(bi++, o.matrix); }
  balls.castShadow = true; scene.add(balls);
  // organic substrate with decoupling capacitors
  S.box(SUB, 0.25, SUB, MAT.pcbBlack, 0, Y.sub, 0);
  // Solder-mask top: dark green-black with a faint via field and trace bundles, satin sheen.
  const maskTex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#0f2420'; g.fillRect(0, 0, w, h);
    let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    g.strokeStyle = 'rgba(40,78,66,0.55)'; g.lineWidth = 3;
    // seven bundles, evenly spread (random heights let two run on top of each other), each kept on the tile
    const lanes = [];
    for (let k = 0; k < 7; k++) { const y0 = 12 + (k + 0.2 + rnd() * 0.6) * (h - 84) / 7, lane = [[0, y0], [w * 0.4, y0], [w * 0.55, y0 + 60], [w, y0 + 60]]; lanes.push(lane); g.beginPath(); lane.forEach((q, i) => i ? g.lineTo(...q) : g.moveTo(...q)); g.stroke(); }
    g.fillStyle = 'rgba(120,150,120,0.5)';
    for (let k = 0; k < 900; k++) { const x = rnd() * w, y = rnd() * h; if (lanes.every(l => l.slice(1).every((q, i) => distToSeg([x, y], l[i], q) > 1.6 + 1.5 + 2))) { g.beginPath(); g.arc(x, y, 1.6, 0, Math.PI * 2); g.fill(); } }
  });
  const mask = new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: maskTex, roughness: 0.45, metalness: 0.05, clearcoat: 0.3, clearcoatRoughness: 0.4 }); mask.name = 'Substrate solder mask';
  texBox(SUB - 0.1, 0.01, SUB - 0.1, mask, 0, Y.sub + 0.13, 0, 2.8);
  // Representative decoupling capacitors: clusters of two case sizes (drawn
  // oversize) in the ring opening next to the dies and HBM,
  // tan ceramic bodies with bright tin terminals (package-stiffener-drawing).
  const mlcc = new THREE.MeshStandardMaterial({ color: 0xa58c6a, roughness: 0.6, metalness: 0.05 }); mlcc.name = 'MLCC ceramic body';
  const tin = new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.28, metalness: 0.95 }); tin.name = 'MLCC tin terminal';
  const cap = (x, z, big, alongX) => {
    const L = big ? 0.13 : 0.085, W = big ? 0.07 : 0.045, H = big ? 0.06 : 0.04, t = L * 0.2;
    N.box(alongX ? L - 2 * t : W, H, alongX ? W : L - 2 * t, mlcc, x, Y.sub + 0.135 + H / 2, z);
    for (const sgn of [-1, 1]) N.box(alongX ? t : W + 0.004, H + 0.004, alongX ? W + 0.004 : t, tin,
      x + (alongX ? sgn * (L / 2 - t / 2) : 0), Y.sub + 0.135 + H / 2, z + (alongX ? 0 : sgn * (L / 2 - t / 2)));
  };
  const cluster = (cx, cz, alongX) => {
    for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) {
      const big = r === 0, du = (c - 1.5) * (big ? 0.17 : 0.13), dv = (r - 0.5) * 0.19;
      cap(cx + (alongX ? du : dv), cz + (alongX ? dv : du), big, !alongX);
    }
  };
  for (const zs of [-1, 1]) for (const cx of [-2.2, 0, 2.2]) cluster(cx, zs * 3.38, true);
  for (const xs of [-1, 1]) for (const cz of [-1.8, 0, 1.8]) cluster(xs * 3.4, cz, false);
  for (const side of [-1, 1]) for (const dy of [-0.08, 0, 0.08]) {
    N.box(SUB - 0.08, 0.008, 0.008, finish.laminate, 0, Y.sub + dy, side * (SUB / 2 + 0.004));
    N.box(0.008, 0.008, SUB - 0.08, finish.laminate, side * (SUB / 2 + 0.004), Y.sub + dy, 0);
  }
  // The stiffener ring is authored in Blender (tools/blender/build-compute.py).
  // C4 bumps between substrate and interposer, only under the interposer they bond to (the H100 interposer is
  // shallower than the Blackwell one, so its field is too; IW and ID are set below with the interposer).
  const cowosL0 = A.id !== 'h100', IW0 = twin ? 6.2 : 6.0, ID0 = twin ? 5.9 : 4.0;
  const bump = new THREE.SphereGeometry(0.045, 8, 6), C4 = 0.18, nx = Math.floor((IW0 - 0.2) / C4) + 1, nz = Math.floor((ID0 - 0.2) / C4) + 1;
  const bumps = new THREE.InstancedMesh(bump, MAT.nickel, nx * nz); bi = 0;
  bumps.userData.computeDynamic = 'c4';
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { o.position.set((i - (nx - 1) / 2) * C4, Y.bumps, (j - (nz - 1) / 2) * C4); o.updateMatrix(); bumps.setMatrixAt(bi++, o.matrix); }
  scene.add(bumps);
  // Interposer. H100 (CoWoS-S): one monolithic silicon interposer, drawn as
  // mirror-grey silicon with a fine TSV dot field. Blackwell and Rubin
  // (CoWoS-L): an organic redistribution interposer with small silicon bridges
  // embedded under the die seam and the die-to-HBM edges. Bridge count, size
  // and placement are representative (cowos-bridge-drawing).
  const cowosL = cowosL0, IW = IW0, ID = ID0;
  const interMat = cowosL
    ? new THREE.MeshStandardMaterial({ color: 0x1c1a1a, roughness: 0.5, metalness: 0.1 })
    : new THREE.MeshStandardMaterial({ color: 0x8e96a2, map: dots(16, 2.2, '#b8bec8', '#8a8f98'), roughness: 0.15, metalness: 0.55 });
  interMat.name = cowosL ? 'CoWoS-L organic redistribution interposer' : 'CoWoS-S silicon interposer';
  if (cowosL) S.box(IW, 0.1, ID, interMat, 0, Y.inter, 0); else texBox(IW, 0.1, ID, interMat, 0, Y.inter, 0, 0.5);
  if (cowosL) {
    // Bright polished silicon against the dark organic body, each span reaching
    // under both sides of the edge it joins, with a crisp rim so the bridges
    // still read as separate inlays through the microbump fields above them.
    const bridge = new THREE.MeshStandardMaterial({ color: 0xd2dae6, roughness: 0.1, metalness: 0.55, emissive: 0x3c4a60, emissiveIntensity: 0.6 }); bridge.name = 'Embedded silicon bridge';
    const rim = new THREE.LineBasicMaterial({ color: 0xe8f0fa, transparent: true, opacity: 0.7 });
    const bridges = new THREE.Group(); bridges.name = 'Embedded silicon bridges';
    const inlay = (w, d, x, z) => {
      S.box(w, 0.02, d, bridge, x, Y.inter + 0.045, z);
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, 0.02, d)), rim); e.position.set(x, Y.inter + 0.045, z); bridges.add(e);
    };
    inlay(0.46, 2.9, 0, 0);                                                                  // under the die-to-die seam
    for (const x of [-2.02, -0.7, 0.7, 2.02]) for (const z of [-1.72, 1.72]) inlay(0.84, 0.62, x, z);   // die-to-HBM edges
    scene.add(bridges);
  }
  // GPU dies: polished silicon backside with a dark sidewall; the floorplan is a
  // separate x-ray decal (runtime overlay) shown in the data and heat layers.
  const dieMat = new THREE.MeshPhysicalMaterial({ color: 0x4a5262, roughness: 1, roughnessMap: dieRoughness(), metalness: 0.35, clearcoat: 1.0, clearcoatRoughness: 0.06, iridescence: 0.1, iridescenceThicknessRange: [180, 320], envMapIntensity: 0.9, emissive: 0x6fd8ff, emissiveIntensity: 0.0 });
  dieMat.name = 'GPU die silicon backside';
  dieMat.userData.ifxAnimatedSurface = 'gpu-die';
  const dieSide = new THREE.MeshStandardMaterial({ color: 0x1a1d24, roughness: 0.4, metalness: 0.3 }); dieSide.name = 'GPU die sidewall';
  const dies = [], xray = [];
  const dieX = twin ? [-1.36, 1.36] : [0];
  const planTex = floorplanTexture(twin ? 'z' : 'x', twin);
  for (const dx of dieX) {
    const d = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 3.3), [dieSide, dieSide, dieMat, dieSide, dieSide, dieSide]);
    d.position.set(dx, Y.dies, 0); if (dx > 0) d.rotation.y = Math.PI; d.castShadow = true; scene.add(d); dies.push(d);
    const plan = new THREE.Mesh(new THREE.PlaneGeometry(2.56, 3.26), new THREE.MeshBasicMaterial({ map: planTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    plan.rotation.x = -Math.PI / 2; if (dx > 0) plan.rotation.z = Math.PI; plan.position.set(dx, Y.dies + 0.046, 0);
    plan.name = 'Illustrative die floorplan (x-ray)'; plan.renderOrder = 3; scene.add(plan); xray.push(plan);
  }
  // NV-HBI seam: a thin inlaid line in power, brighter in the data layer
  const hbiMat = glowMat('#6fd8ff', 1.0);
  if (twin) { const hbi = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 3.0), hbiMat); hbi.position.set(0, Y.dies + 0.03, 0); scene.add(hbi); }
  // HBM stacks: one molded block per stack (logic base die plus DRAM dies in
  // epoxy mold compound) with the memory type printed on its top, as a label
  // for the reader. The layer count reads as a striped band on the cut face
  // that carries the TSVs. Real stacks are about 0.72 mm tall, level with the
  // GPU die; the height here is drawn about 3x (representative) so the layers
  // stay visible.
  const mold = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.55, metalness: 0.05 }); mold.name = 'HBM epoxy mold compound';
  // The memory type is printed on the stack's outer half, leaving the die-facing half clear for the data layer's
  // waterfall (hbm-waterfall.js), and always upright toward the default camera (which looks from +x, +z): one canvas
  // holds four prints, one per stack orientation, each in its own quadrant (a stack's top maps to one quadrant).
  //   0 (top left)     a stack on the +z side: text across, on the quadrant's lower (+z) half
  //   1 (top right)    a stack on the -z side: text across, on the upper (-z) half
  //   2 (bottom left)  a stack on the +x side (H100): text turned to run along z, base toward +x, on the +x half
  //   3 (bottom right) a stack on the -x side: the same turn, on the -x half
  const LABEL_AT = [{ cx: 0.5, cy: 0.5 + HBM_LABEL.off, turn: false }, { cx: 0.5, cy: 0.5 - HBM_LABEL.off, turn: false },
    { cx: 0.5 + HBM_LABEL.off, cy: 0.5, turn: true }, { cx: 0.5 - HBM_LABEL.off, cy: 0.5, turn: true }];
  const hbmPrint = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#2b2e35'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#8b939e'; g.font = '600 44px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
    LABEL_AT.forEach(({ cx, cy, turn }, q) => {
      g.save(); g.translate((q % 2 + cx) * 256, (Math.floor(q / 2) + cy) * 256);
      if (turn) g.rotate(-Math.PI / 2);
      g.fillText(A.hbm.type, 0, 0, 256 * HBM_LABEL.len); g.restore();
    });
  });
  const hbmTopMat = new THREE.MeshStandardMaterial({ map: hbmPrint, roughness: 0.4, metalness: 0.3 }); hbmTopMat.name = `HBM printed top ${A.hbm.type}`;
  const hbmTops = [], hbmLabels = [];                   // one textured mesh for all tops (the Builder would drop the UVs)
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
    // this stack's quadrant of the print canvas (see LABEL_AT): its outer side picks the print
    const q = twin ? (z > 0 ? 0 : 1) : (x > 0 ? 2 : 3), top = new THREE.BoxGeometry(HW - 0.04, 0.012, HD - 0.04), uv = top.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, (uv.getX(k) + q % 2) / 2, (uv.getY(k) + 1 - Math.floor(q / 2)) / 2);
    hbmTops.push(top.translate(x, hb + stackH - 0.006, z));
    // the label's footprint in world x/z: canvas x runs with world x, canvas y with world z
    { const L = LABEL_AT[q], tw = HW - 0.04, td = HD - 0.04, half = { a: HBM_LABEL.len / 2, b: HBM_LABEL.h / 2 };
      const [hx, hz] = L.turn ? [half.b, half.a] : [half.a, half.b];
      hbmLabels.push({ x0: x + (L.cx - hx - 0.5) * tw, x1: x + (L.cx + hx - 0.5) * tw, z0: z + (L.cy - hz - 0.5) * td, z1: z + (L.cy + hz - 0.5) * td, y: hb + stackH }); }
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
  // Underfill with the microbump field under every die and HBM site, on the
  // interposer: what each exploded gap connects to (pitch representative).
  const underfill = new THREE.MeshPhysicalMaterial({ color: 0x8a6a3a, map: dots(12, 3.2, '#6b5230', '#d8c08a'), roughness: 0.45, metalness: 0.2, transparent: true, opacity: cowosL ? 0.62 : 0.8 });
  underfill.name = 'Underfill and microbumps';
  for (const dx of dieX) texBox(2.6, 0.012, 3.3, underfill, dx, Y.inter + 0.072, 0, 1.2);
  for (const [x, z] of hbmPos) texBox(HW, 0.012, HD, underfill, x, Y.inter + 0.072, z, 1.2);
  const live = hbmPos.filter((_, i) => i !== spare);
  // Heat layer only: what sits above the silicon. A thin thermal interface
  // sheet on each die and stack, then, lifted, a representative heat spreader:
  // one flat nickel-plated plate with a straight skirt around its edge, drawn
  // translucent so the glowing silicon and the rising heat read through it.
  // H100 SXM5 is reported bare-die, so there the plate has no skirt and stands
  // for the heat sink's flat contact base (thermal-stack-layers).
  const cover = m => { m.userData.ifxCoverSurface = 'ihs'; return m; };
  const tim = cover(new THREE.MeshPhysicalMaterial({ color: 0x5b5f70, roughness: 0.7, metalness: 0.1, transparent: true, opacity: 0.45 })); tim.name = 'Thermal interface sheet';
  const lidMat = cover(new THREE.MeshPhysicalMaterial({ color: 0xc9d0d8, roughness: 0.45, metalness: 0.6, envMapIntensity: 0.25, transparent: true, opacity: 0.12, depthWrite: false }));
  lidMat.name = A.id === 'h100' ? 'Heat sink contact base (translucent)' : 'Nickel-plated heat spreader (translucent)';
  for (const dx of dieX) S.box(2.6, 0.02, 3.3, tim, dx, Y.dies + 0.05, 0);
  hbmPos.forEach(([x, z], i) => { if (i !== spare) S.box(HW - 0.04, 0.02, HD - 0.04, tim, x, hb + stackH + 0.01, z); });
  const PW = 7.2, PD = 7.0, PT = 0.14, skirt = A.id === 'h100' ? 0 : 0.36, wall = 0.12;
  S.box(PW, PT, PD, lidMat, 0, Y.lid, 0);
  if (skirt) for (const side of [-1, 1]) {
    S.box(PW, skirt, wall, lidMat, 0, Y.lid - PT / 2 - skirt / 2, side * (PD / 2 - wall / 2));
    S.box(wall, skirt, PD - 2 * wall, lidMat, side * (PW / 2 - wall / 2), Y.lid - PT / 2 - skirt / 2, 0);
  }
  // Crisp edges so the translucent metal still reads as one clean part.
  const lidOutline = new THREE.Group(); lidOutline.name = 'Heat spreader outline'; lidOutline.userData.computeCoverOutline = 'ihs';
  const edgeMat = new THREE.LineBasicMaterial({ color: 0xdfe6ee, transparent: true, opacity: 0.55 });
  const outline = (w, h, d, y) => { const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)), edgeMat); e.position.y = y; lidOutline.add(e); };
  outline(PW, PT, PD, Y.lid);
  if (skirt) outline(PW, skirt, PD, Y.lid - PT / 2 - skirt / 2);
  // Heat showing through the plate: a warm glow on its top face over each die
  // and, fainter, over each HBM stack (illustrative, not a measured map).
  const glowTex = canvasTex(128, 128, (g, w, h) => {
    const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    r.addColorStop(0, 'rgba(255,120,50,0.9)'); r.addColorStop(0.5, 'rgba(255,90,30,0.4)'); r.addColorStop(1, 'rgba(255,70,20,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, h);
  });
  const lidGlow = (w, d, x, z, k) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: k, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, Y.lid + PT / 2 + 0.005, z); m.renderOrder = 4; m.name = 'Heat through the spreader (illustrative)'; lidOutline.add(m);
  };
  for (const dx of dieX) lidGlow(3.2, 3.9, dx, 0, 0.4);
  for (const [x, z] of live) lidGlow(1.3, 1.2, x, z, 0.2);
  scene.add(lidOutline);
  scene.add(S.build()); scene.add(N.build({ cast: false }));
  if (hbmTops.length) { const tops = new THREE.Mesh(mergeGeometries(hbmTops, false), hbmTopMat); tops.name = 'HBM printed tops'; tops.castShadow = tops.receiveShadow = true; scene.add(tops); }
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
  // Current columns stay a few millimeters inside each die's edge: columns that
  // ended right at the exposed front corner stacked into one bloom hot spot there.
  for (let i = 0; i < 28; i++) {
    const x = dieSampleX() * 0.9, z = (rnd() - 0.5) * 2.6;
    // Declared pass-through (tools/flow-audit.mjs): this is vertical power delivery, up through the host board, a
    // BGA ball, the substrate's power vias, a C4 bump and the interposer's TSVs into the die. Every solid it crosses
    // is a layer of the conductor stack it stands for.
    flows.push(flow([[x, -1.4, z], [x, Y.balls, z], [x, Y.sub, z], [x, Y.bumps, z], [x, Y.inter, z], [x, Y.dies, z]], 'core', { count: 3, speed: 1.6 + rnd(), size: 0.03, k: 2.8, trail: false,
      audit: { through: true, why: 'vertical power delivery through board, ball, substrate vias, C4 bump and interposer TSVs into the die' } }));
  }
  // die-to-die traffic across NV-HBI
  flows.forEach(f => scene.add(f.group));
  // ---------- data: die to die, HBM into the dies, NVLink out of the package edge ----------
  // Every route follows the package's layers in the exploded view: down from a die or stack through its
  // microbumps, along the interposer (on CoWoS-L, across the silicon bridge drawn under that edge), and up into its
  // partner; NVLink continues down through the C4 bumps, out through the substrate to its ball and onto the host
  // board's escape runs. Lanes of one link run parallel and evenly spaced, straight across the edge they cross.
  const DIE_HALF = { x: 1.3, z: 1.65 }, yUnder = Y.dies - 0.04, yRdl = Y.inter + 0.085, ySub = Y.sub;
  const routes = { hbi: [], hbm: [], hbmDrawn: [], nvl: [] };
  if (twin) for (let i = 0; i < 7; i++) {
    // NV-HBI: straight across the seam over the long bridge under it, both directions (bridge spans |x| < 0.23)
    const z = -1.2 + i * 0.4, x0 = 0.15;
    const ab = [[-x0, yUnder, z], [-x0, yRdl, z], [x0, yRdl, z], [x0, yUnder, z]];
    const ba = [[x0, yUnder, z + 0.1], [x0, yRdl, z + 0.1], [-x0, yRdl, z + 0.1], [-x0, yUnder, z + 0.1]];
    routes.hbi.push(ab, ba);
    dataFlows.push(flow(ab, 'hbi', { count: 3, speed: 1.2, size: 0.035, k: 3.2, trail: false }), flow(ba, 'hbi', { count: 3, speed: 1.2, size: 0.035, k: 3.2, trail: false }));
  }
  live.forEach(([x, z]) => {
    // each stack's PHY edge faces the die edge it sits beside; its lanes cross that gap perpendicular to it
    for (const d of [-0.25, 0, 0.25]) {
      let pts;
      if (twin) { const s = Math.sign(z), hz = s * (Math.abs(z) - HD / 2 + 0.1), dz = s * (DIE_HALF.z - 0.1);
        pts = [[x + d, hb, hz], [x + d, yRdl, hz], [x + d, yRdl, dz], [x + d, yUnder, dz]]; }
      else { const s = Math.sign(x), hx0 = s * (Math.abs(x) - HW / 2 + 0.1), dx0 = s * (DIE_HALF.x - 0.1);
        pts = [[hx0, hb, z + d], [hx0, yRdl, z + d], [dx0, yRdl, z + d], [dx0, yUnder, z + d]]; }
      routes.hbm.push(pts);
      dataFlows.push(flow(pts, 'hbm', { count: 4, speed: 0.9, size: 0.042, k: 4.0, trail: false }));
    }
  });
  // The drawn waterfall (schematic, evidence 'hbm-flow-drawing'): the buried route above sits under the dies and stacks
  // and is hard to see from above, so each stack also shows its traffic as one sheet of fine strands lifted over the
  // parts: level across the stack's top toward the edge whose PHY faces the die, over that edge in a smooth parabola
  // and down onto the die on that side (Reed, 10/01/2026: "drop into the die still, the viewer will get the idea";
  // "clean and dramatic"). The stacks pulse in a slow wave around the package, one after another, so each stack reads
  // as its own channel while the whole package keeps one rhythm (hbm-waterfall.js).
  const waterfall = hbmWaterfall({ stacks: live.map(([x, z]) => {
    const s = twin ? Math.sign(z) : Math.sign(x), far = twin ? Math.abs(z) : Math.abs(x), depth = twin ? HD : HW, inner = far - depth / 2;
    const dieEdge = twin ? DIE_HALF.z : DIE_HALF.x;
    return { out: twin ? [0, s] : [s, 0], along: twin ? [1, 0] : [0, 1], centre: twin ? x : z, width: (twin ? HW : HD) * 0.72,
      phase: ((Math.atan2(z, x) / (2 * Math.PI)) + 1) % 1,
      profile: waterfallProfile({ start: far + 0.04, edge: inner, land: dieEdge - 0.32, top: hb + stackH, dieTop: Y.dies + 0.045, lift: 0.07 }) };
  }) });
  scene.add(waterfall.group);
  routes.hbmDrawn = waterfall.centerlines;
  // On-die activity (schematic, evidence 'die-activity-drawing'): compute tiles firing in rolling waves and comet
  // streaks carrying each waterfall's traffic inward to the L2 band, out to the tiles, and across the NV-HBI seam.
  // Data layer only: in power the columns of current tell that story, and in heat the dies' own glow does.
  const layout = floorplanLayout(twin ? 'z' : 'x');
  const activity = dieActivity({
    dies: dieX.map(dx => ({ x: dx, rot: dx > 0, tiles: layout.tiles, cw: layout.w, ch: layout.h })), face: [2.56, 3.26], y: Y.dies + 0.05,
    feeds: live.map(([x, z]) => twin
      ? { from: [x, Math.sign(z) * (DIE_HALF.z - 0.32)], die: x < 0 ? 0 : 1, axis: 'z' }
      : { from: [Math.sign(x) * (DIE_HALF.x - 0.32), z], die: 0, axis: 'x' }),
    seam: twin ? [-1.0, -0.55, -0.1, 0.35, 0.8, 1.25] : [] });
  scene.add(activity.group);
  routes.dieActivity = activity.paths; routes.dieTiles = activity.tiles;
  scene.userData.hbmLabels = hbmLabels;
  const serdes = glowMat('#ff5fd2', 0.5);                // an inlaid strip in power and heat, lit in the data layer
  // NVLink leaves the free edges: outer die edges on twins, top/bottom on H100. Below the die each lane takes the
  // same path: microbumps, out along the interposer to the C4 field's edge, down into the substrate, out through
  // the substrate (fanning to the coarser ball pitch) to an outer-row ball, then along that ball's escape run on
  // the host board (bgaRun). The substrate leg is buried, below the metal stiffener.
  // n consecutive escape runs, centred in the side's 24 (0.3 cm apart at the ball row)
  const n = A.nvlink.linksPerGpu / 2, runK = i => Math.floor((BGA_RUNS - n) / 2) + i;
  // Declared pass-throughs (tools/flow-audit.mjs): the lane goes down through the interposer at the C4 column
  // (its through-vias) and its own C4 bump, runs buried inside the substrate (it is a substrate trace, below the
  // stiffener) and down through its own BGA ball onto the board. These boxes are the interposer slab, the C4 layer, the
  // substrate slab and the ball layer; the route meets no other solid.
  const nvlBuried = { within: [[-IW / 2, Y.inter - 0.06, -ID / 2, IW / 2, Y.inter + 0.06, ID / 2], [-IW / 2, Y.bumps - 0.06, -ID / 2, IW / 2, Y.bumps + 0.06, ID / 2],
    [-SUB / 2, Y.sub - 0.14, -SUB / 2, SUB / 2, Y.sub + 0.15, SUB / 2], [-SUB / 2, -0.01, -SUB / 2, SUB / 2, 0.15, SUB / 2]],
    why: 'NVLink lane: interposer through-via, its C4 bump, buried substrate trace, then its own BGA ball' };
  for (const side of [-1, 1]) {
    const boardSide = twin ? (side > 0 ? 0 : 1) : (side > 0 ? 2 : 3);
    if (twin) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 3.0), serdes); m.position.set(side * 2.6, Y.dies + 0.035, 0); scene.add(m); }
    else { const m = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.02, 0.04), serdes); m.position.set(0, Y.dies + 0.035, side * 1.63); scene.add(m); }
    for (let i = 0; i < n; i++) {
      const u = n > 1 ? -1 + 2 * i / (n - 1) : 0, along = (twin ? 1.3 : 1.1) * u;        // along the die edge
      // on sides where the run index counts against the die edge's direction, take the runs in reverse so the
      // substrate fan keeps the lanes in order (no crossings)
      const flip = (twin ? bgaRun(boardSide, 1)[0][1] - bgaRun(boardSide, 0)[0][1] : bgaRun(boardSide, 1)[0][0] - bgaRun(boardSide, 0)[0][0]) < 0;
      const run = bgaRun(boardSide, runK(flip ? n - 1 - i : i)).map(([x, z]) => [x, 0.004, z]);
      const ball = run[0];
      // world point at distance r from the package centre toward this side, offset t along the edge
      const P = (r, y, t) => twin ? [side * r, y, t] : [t, y, side * r];
      const die = twin ? dieX[1] + DIE_HALF.x - 0.11 : DIE_HALF.z - 0.1;               // the SerDes strip, just inside the outer edge
      const c4 = twin ? IW / 2 - 0.25 : ID / 2 - 0.15;                                 // last C4 column inside the interposer
      const subOut = (twin ? Math.abs(ball[0]) : Math.abs(ball[2])) - 0.3;            // one row in from the outer ball
      const tBall = twin ? ball[2] : ball[0];
      const pts = [P(die, yUnder, along), P(die, yRdl, along), P(c4, yRdl, along), P(c4, ySub, along),
        P(subOut, ySub, tBall), P(subOut + 0.3, ySub, tBall), P(subOut + 0.3, Y.balls, tBall), ...run];
      routes.nvl.push(pts);
      dataFlows.push(flow(pts, 'nvl', { count: 4, speed: 1.6, size: 0.035, k: 2.8, trailR: 0.008, trailK: 0.3, audit: nvlBuried }));
    }
  }
  scene.userData.packageRouting = routes;
  dataFlows.forEach(f => scene.add(f.group));
  // ---------- heat: up out of the dies and HBM, through the heat spreader ----------
  // Watts per source (src/heat.js): the GPU silicon is the package less its HBM share; each live stack carries an
  // even part of that share. balanceHeat then sizes every source's streams by the site's one log rule.
  const hbmW = A.gpuW * A.hbmShare, siliconW = A.gpuW - hbmW, stackW = hbmW / Math.max(1, live.length);
  for (let i = 0; i < 30; i++) {
    const x = dieSampleX(), z = (rnd() - 0.5) * 3.0;
    heatFlows.push(tagHeat(flow([[x, Y.dies + 0.06, z], [x, Y.lid - 0.12, z], [x * 1.05, Y.lid + 1.4, z * 1.05]], 'hot', { count: 3, speed: 1.1 + rnd() * 0.6, size: 0.045, k: 2.6, trail: false }), 'gpu-silicon', siliconW));
  }
  live.forEach(([x, z], i) => { const f = flow([[x, hb + stackH, z], [x, Y.lid - 0.12, z], [x, Y.lid + 1.2, z]], 'hot', { count: 2, speed: 0.9, size: 0.04, k: 2.4, trail: false }); f.thermalOrigin = 'hbm'; heatFlows.push(tagHeat(f, `hbm-${i}`, stackW)); });
  balanceHeat(heatFlows);
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
  // H100's single die pin sits toward the die's far corner, clear of the HBM pin on its right edge
  const diePin = twin ? [d0, Y.dies + 0.1, 0.4] : [-0.9, Y.dies + 0.1, -1.3];
  // the pin sits on the stack's outer corner, clear of the dies pin in the overview and interposer views
  const hbmHS = { pos: [hx + Math.sign(hx) * 0.42, hy, hz + Math.sign(hz) * 0.4], view: { pos: [hx + 3.5, hy + 4.5, hz + 4.2], target: [hx * 0.8, Y.dies + 0.5, hz * 0.9] } };
  // Tokens: frame the top of the package and the live readout above it, so the
  // generated text is legible; the pin sits beside the rows, never on them.
  const TOKEN_ROWS = [2.2, 7.6, -1];
  // The pin rides just above the back of the package, where the answer tokens
  // leave the die, so in the overviews it marks a place rather than empty air.
  const tokensHS = { pos: [2.0, Y.dies + 1.5, -2.2], view: componentView([2.0, 5.7, -0.5], [6, 4.6, 11], [9.4, 5.2, 5.0]) };
  // "Show the math" on the Tokens card: one decode step as a matrix-vector multiply, beside the readout (token-math.js)
  const tokenMath = installTokenMath({ scene, state, quality, hotspot: tokensHS, liveHbm: live, hbmTopY: hy, dieX, dieY: Y.dies,
    anchor: [-4.4, 6.95, 2.4], view: componentView([-1.8, 5.9, 0.9], [6, 4.6, 11], [7.8, 7.8, 3]),
    mobileAnchor: [1.1, 12.5, -0.6], mobileScale: 0.85, mobileView: componentView([1.0, 9.2, -0.4], [6, 4.6, 11], [5.4, 12.4, 2.5]) });
  const nvphyHS = twin ? { pos: [2.62, Y.dies + 0.1, -1.2], view: { pos: [8, 5, 1], target: [3, 2.6, 0] } } : { pos: [0.9, Y.dies + 0.1, 1.62], view: { pos: [2, 5.5, 8], target: [0, 2.6, 2.2] } };
  return {
    // the GPU's name, laser-etched on the substrate margin between two capacitor clusters (package-marks.js)
    printSpots: [etch('GPU package marking', GPU_NAME[A.id] || A.short, [1.3, .36], [{ from: [1.1, 12, 3.38], dir: [0, -1, 0] }])],
    scene, flows,
    look: { env: 'studio', envIntensity: 0.45, exposure: 0.94, bloom: 0.32, threshold: 2.0, ao: 0.12, dof: true },
    camera: { pos: [9.5, 8.2, 11.5], target: [0, 2.3, 0], near: 0.05, far: 500, min: 2, max: 40 },
    // Lower power view exposes the exploded BGA/substrate/interposer gaps.
    // Data and heat retain their higher view of silicon and the heat spreader.
    cameraByMode: { power: { pos: [10.5, 4.4, 12], target: [0, 2.1, 0] } },
    hotspots: {
      // raised to about 13 degrees: the board's traces and via field read between
      // the ball rows and the fan-out past the field, still under the substrate edge
      balls: { pos: [3.75, .20, 3.75], view: { pos: [7.2, 1.6, 7.2], target: [2.8, .15, 2.8] } },
      interposer: { pos: [3.1, Y.inter, 0], view: { pos: [7.5, 4.2, 4.5], target: [1.5, 2.2, 0] } },
      dies: { pos: diePin, view: { pos: [d0 + 0.4, 8, 5], target: [d0 * 0.45, 3.1, 0] } },
      hbm: hbmHS,
      tokens: tokensHS,
    },
    dataFlows, heatFlows,
    heatHotspots: {
      junction: { pos: diePin, view: { pos: [d0 + 0.4, 8, 5], target: [d0 * 0.45, 3.1, 0] } },
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
    dispose() { cache.forEach(({ tex }) => tex.dispose()); tokenMath.dispose(); waterfall.dispose(); activity.dispose(); },
    setRenderTier(tier) { waterfall.setTier(tier); activity.setTier(tier); },
    update(t, dt) {
      const e = tick(genLen);
      if (e < genLastE) { genCycle = buildCycle(model); genLen = genCycle.timings.totalS; resetGen(); }
      genLastE = e;
      const s = sampleAt(genCycle, e);
      feedLane('prompt', genCycle.prompt, s.promptOut);
      feedLane('reasoning', genCycle.reasoning, s.reasoningOut);
      feedLane('answer', genCycle.answer, s.answerOut);
      genShown.prompt = s.promptOut; genShown.reasoning = s.reasoningOut; genShown.answer = s.answerOut;
      tokenMath.update(t, dt, genCycle, s);

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
      waterfall.update(t, state.mode === 'data');
      activity.update(t, state.mode === 'data');

      pulse.v = Math.max(0, pulse.v - dt * 3);
      const dataOn = state.mode === 'data', xrayOn = dataOn || state.mode === 'heat' || ['dies', 'junction', 'flux', 'hbi'].includes(state.selected);
      for (const p of xray) { p.material.opacity = xrayOn ? (state.mode === 'heat' ? 0.3 : 0.6) : 0; p.visible = xrayOn; }
      hbiMat.color.set('#6fd8ff').multiplyScalar(dataOn ? 2.2 : 1.0);
      serdes.color.set('#ff5fd2').multiplyScalar(dataOn ? 1.6 : 0.5);
      const heatOn = state.mode === 'heat';
      dieMat.emissive.setHex(heatOn ? 0xff6a1a : 0x6fd8ff);
      dieMat.emissiveIntensity = heatOn ? 0.55 + 0.08 * Math.sin(t * 2) : 0.06 + pulse.v * 0.12;
      dies.forEach(d => (d.material[2].emissiveIntensity = dieMat.emissiveIntensity));
    },
  };
}
