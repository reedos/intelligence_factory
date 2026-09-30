// Level 6, Tokens part, "Show the math": one decode step drawn as a single matrix-vector multiply. The token's
// vector x (a row of cyan cells) meets a weight tile W (violet, the HBM color) that streams up out of the HBM
// stacks for every step, column by column the products light, and the sums gather in y (amber) as they would
// accumulate on the die. The tile is 8 × 8 and schematic: one tile of one layer, never real weights or a real
// layer shape (ASSUMPTIONS 'token-math-model'). The figures that go with it are rows on the Tokens card
// (src/model/token-math.js); this module draws only the picture.
//
// Pacing: the stream writes 60 tokens a second, far too fast to watch a step, so each drawn step is slowed and
// takes the newest token the readout has emitted when it starts; the panel says so. It shows only while the
// Tokens part is selected with the math toggled on (store.ui.tokenMath), and never in the heat layer.
import { THREE } from '../kit.js';
import { STREAM_TPS } from '../model/token-script.js';

const N = 8;                    // the tile is N × N, the vector N long
const STEP_S = 1.6;             // one drawn step
const PITCH = 0.52, CELL = 0.44;
const COL = { x: new THREE.Color('#6fd8ff'), w: new THREE.Color('#b08cff'), y: new THREE.Color('#e6ba82'), dim: new THREE.Color('#2a3140') };
const smooth = u => u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u);
const clamp01 = u => Math.max(0, Math.min(1, u));

// deterministic pseudo-random numbers, so the same token always gets the same vector
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let s = seed || 1; return () => { s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909); s ^= s >>> 16; return (s >>> 0) / 4294967296; }; }

function textTexture(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return { c, g: c.getContext('2d'), t };
}
const MONO = '"IBM Plex Mono", ui-monospace, monospace';

// the numbers the panel animates: one fixed schematic tile (the same weights are read again for every token)
export function schematicTile(seed = 7) {
  const r = rng(seed), W = [];
  for (let i = 0; i < N; i++) { W.push([]); for (let j = 0; j < N; j++) W[i].push((r() * 2 - 1) * (0.35 + 0.65 * r())); }
  return W;
}
export function tokenVector(token) {
  const r = rng(hashStr(String(token)) + 1), x = [];
  for (let j = 0; j < N; j++) x.push((r() * 2 - 1) * (0.3 + 0.7 * r()));
  return x;
}
// y = W · x, and the running sums after the first k columns (what the panel shows mid-step)
export function partialSums(W, x, k) {
  return W.map(row => row.slice(0, k).reduce((a, w, j) => a + w * x[j], 0));
}

export function installTokenMath({ scene, state, quality, hotspot, liveHbm, hbmTopY, dieX, dieY, anchor, view, mobileAnchor, mobileView, scale = 1, mobileScale = scale }) {
  const mobile = !!quality?.mobile;
  const at = new THREE.Vector3(...((mobile && mobileAnchor) || anchor));
  // the Tokens hotspot frames the math instead while it is on: every refit (select, resize, layer switch) sees it
  const baseView = hotspot.view, mathView = (mobile && mobileView) || view;
  Object.defineProperty(hotspot, 'view', { get: () => (state.tokenMath ? mathView : baseView), configurable: true, enumerable: true });

  const root = new THREE.Group(); root.name = 'Token matrix math (schematic)'; root.visible = false;
  const panel = new THREE.Group(); panel.position.copy(at); panel.scale.setScalar(mobile ? mobileScale : scale); root.add(panel);
  scene.add(root);

  // layout, in panel space (x right, y up, centered)
  const tileW = N * PITCH, gapY = 0.62, width = tileW + gapY + CELL;
  const left = -width / 2, colX = j => left + CELL / 2 + j * PITCH, yColX = left + tileW + gapY + CELL / 2 - (PITCH - CELL) / 2;
  const topY = 3.9;
  const xRowY = topY - 1.95, tileTop = xRowY - 1.12, rowY = i => tileTop - CELL / 2 - i * PITCH;
  const footY = rowY(N - 1) - 0.86;

  // backing plate: a dark glass card so the cells read against the package and the board
  const plateH = topY - footY + 1.5;
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(width + 0.9, plateH),
    new THREE.MeshBasicMaterial({ color: 0x070a10, transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false }));
  plate.position.set(0, (topY + footY) / 2 - 0.3, -0.02); plate.renderOrder = 20; panel.add(plate);
  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(plate.geometry),
    new THREE.LineBasicMaterial({ color: 0x3a4658, transparent: true, opacity: 0.9, depthWrite: false }));
  edge.position.copy(plate.position); edge.renderOrder = 21; panel.add(edge);
  const accent = new THREE.Mesh(new THREE.PlaneGeometry(width + 0.9, 0.035), new THREE.MeshBasicMaterial({ color: new THREE.Color('#e6ba82'), toneMapped: false, depthWrite: false, transparent: true }));
  accent.position.set(0, plate.position.y + plateH / 2, -0.01); accent.renderOrder = 21; panel.add(accent);

  // cells: one instanced mesh each for x, W and y (per-instance color carries the brightness)
  const cellGeo = new THREE.PlaneGeometry(CELL, CELL);
  const cellMat = () => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, toneMapped: false });
  const xs = new THREE.InstancedMesh(cellGeo, cellMat(), N), ws = new THREE.InstancedMesh(cellGeo, cellMat(), N * N), ys = new THREE.InstancedMesh(cellGeo, cellMat(), N);
  for (const m of [xs, ws, ys]) { m.frustumCulled = false; m.renderOrder = 23; m.setColorAt(0, COL.dim); panel.add(m); }
  // empty slots, drawn once: the tile's grid and the y column stay visible while the weights are in flight
  const slotGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(CELL, CELL));
  const slotMat = new THREE.LineBasicMaterial({ color: 0x2c3544, transparent: true, opacity: 0.9, depthWrite: false });
  const slot = (x, y) => { const e = new THREE.LineSegments(slotGeo, slotMat); e.position.set(x, y, 0.001); e.renderOrder = 22; panel.add(e); };
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) slot(colX(j), rowY(i));
  for (let i = 0; i < N; i++) slot(yColX, rowY(i));
  for (let j = 0; j < N; j++) slot(colX(j), xRowY);
  // the sweep: a bright bar that runs down the active column, and a sum arrow for each row into y
  const bar = new THREE.Mesh(new THREE.PlaneGeometry(CELL + 0.12, tileW + 0.1), new THREE.MeshBasicMaterial({ color: COL.x.clone().multiplyScalar(1.4), transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
  bar.position.set(colX(0), tileTop - tileW / 2 + (PITCH - CELL) / 2, 0.002); bar.renderOrder = 24; panel.add(bar);
  const arrowGeo = new THREE.PlaneGeometry(gapY - 0.16, 0.05);
  const arrows = new THREE.InstancedMesh(arrowGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }), N);
  arrows.frustumCulled = false; arrows.renderOrder = 24; panel.add(arrows);
  const o = new THREE.Object3D();
  for (let i = 0; i < N; i++) { o.position.set(left + tileW - (PITCH - CELL) + gapY / 2, rowY(i), 0.003); o.updateMatrix(); arrows.setMatrixAt(i, o.matrix); arrows.setColorAt(i, COL.dim); }

  // text: a header (title, caption, the token being computed), three labels, a footer
  const labels = [];
  // a line of text on its own canvas; `fit` (panel units) shrinks it so it never runs past the plate
  const label = (text, x, y, h, { color = '#8d97a8', weight = '500', size = 32, w = 1024, align = 'left', spacing = 0, fit = width } = {}) => {
    const T = textTexture(w, Math.round(size * 1.6));
    const font = () => { T.g.font = `${weight} ${size}px ${MONO}`; if ('letterSpacing' in T.g) T.g.letterSpacing = `${spacing}px`; };
    const draw = (s, c = color) => {
      T.g.clearRect(0, 0, T.c.width, T.c.height); font(); T.g.fillStyle = c; T.g.textBaseline = 'middle';
      T.g.textAlign = align; T.g.fillText(s, align === 'left' ? 4 : align === 'right' ? T.c.width - 4 : T.c.width / 2, T.c.height / 2); T.t.needsUpdate = true;
    };
    font(); const px = T.g.measureText(text).width + 8, k = Math.min(1, fit / (h * px / T.c.height));
    draw(text); h *= k;
    const aspect = T.c.width / T.c.height, m = new THREE.Mesh(new THREE.PlaneGeometry(h * aspect, h), new THREE.MeshBasicMaterial({ map: T.t, transparent: true, depthWrite: false, toneMapped: false }));
    m.position.set(align === 'left' ? x + h * aspect / 2 : align === 'right' ? x - h * aspect / 2 : x, y, 0.004); m.renderOrder = 25; panel.add(m);
    labels.push(T); return draw;
  };
  const L = left;
  // canvas glyphs are ≈0.6 of the plane height, so h sets the on-screen text size directly
  label('ONE DECODE STEP', L, topY - 0.05, 0.72, { color: '#f3efe6', weight: '600', spacing: 3 });
  label('one tile of one layer, schematic', L, topY - 0.66, 0.46, { color: '#a7b0bf' });
  label('TOKEN x', L, xRowY + 0.58, 0.5, { color: '#6fd8ff', weight: '600', spacing: 1 });
  const tokenText = label('', L + width, xRowY + 0.58, 0.5, { color: '#e9fbff', weight: '600', align: 'right' });
  label('WEIGHTS W, FROM HBM', L, tileTop + 0.34, 0.5, { color: '#c3a6ff', weight: '600', fit: tileW });
  label('y', yColX + CELL / 2, tileTop + 0.34, 0.5, { color: '#e6ba82', weight: '600', align: 'right', w: 256 });
  label('y = W·x, summed on the die', L, footY + 0.2, 0.44, { color: '#e6ba82' });
  label('W is read again per token', L, footY - 0.22, 0.44, { color: '#c3a6ff' });
  label(`slowed: ${STREAM_TPS} tokens/s here`, L, footY - 0.66, 0.44, { color: '#6f7a8c' });

  // the panel reads like a card held up in the scene: drawn over the package, never cut by it
  panel.traverse(m => { if (m.material) m.material.depthTest = false; });

  // the die glows while y accumulates on it, and a faint tether runs from the die up to y
  const dieGlowMat = new THREE.MeshBasicMaterial({ color: COL.y.clone().multiplyScalar(1.2), transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending });
  for (const dx of dieX) { const g = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 3.2), dieGlowMat); g.rotation.x = -Math.PI / 2; g.position.set(dx, dieY + 0.06, 0); g.renderOrder = 6; root.add(g); }
  const tetherGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const tether = new THREE.Line(tetherGeo, new THREE.LineBasicMaterial({ color: COL.y.clone().multiplyScalar(1.3), transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
  tether.frustumCulled = false; tether.renderOrder = 19; root.add(tether);

  // the camera, caught at render time so the panel can face it
  let cam = null;
  plate.onBeforeRender = (_r, _s, c) => { cam = c; };

  const W = schematicTile(), wMax = Math.max(...W.flat().map(Math.abs));
  let x = tokenVector(''), y = W.map(() => 0), yMax = 1, token = '', stepT = STEP_S, lastSeq = -1;
  const hbmWorld = liveHbm.map(([hx, hz]) => new THREE.Vector3(hx, hbmTopY, hz)), tmp = new THREE.Vector3(), c = new THREE.Color();
  const src = new Array(N * N).fill(0).map((_, k) => k % hbmWorld.length);   // which stack each weight comes out of

  function newestToken(cycle, s) {
    if (s.answerOut > 0) return { text: cycle.answer[s.answerOut - 1], seq: 1e6 + s.answerOut };
    if (s.reasoningOut > 0) return { text: cycle.reasoning[s.reasoningOut - 1], seq: s.reasoningOut };
    return null;
  }
  function startStep(tok) {
    token = tok.text; lastSeq = tok.seq; stepT = 0;
    x = tokenVector(token); y = W.map(row => row.reduce((a, w, j) => a + w * x[j], 0)); yMax = Math.max(1e-6, ...y.map(Math.abs));
    const shown = token.trim() || '␣';
    tokenText(`“${shown.length > 12 ? `${shown.slice(0, 11)}…` : shown}”`);
  }

  return {
    group: root,
    update(t, dt, cycle, s) {
      const on = !!state.tokenMath && state.selected === 'tokens' && state.mode !== 'heat';
      root.visible = on;
      if (!on) { stepT = STEP_S; return; }
      if (cam) panel.quaternion.copy(cam.quaternion);
      panel.updateMatrixWorld(true);
      const decoding = s.phase === 'reasoning' || s.phase === 'answer';
      stepT += dt;
      if (stepT >= STEP_S) { const tok = newestToken(cycle, s); if (tok && decoding && tok.seq !== lastSeq) startStep(tok); else stepT = STEP_S; }
      const u = clamp01(stepT / STEP_S), idle = stepT >= STEP_S;
      // phases of one step: the tile streams in (0–0.3), the columns sweep (0.3–0.82), y holds and the tile drains (0.82–1)
      const inU = u / 0.3, sweepU = clamp01((u - 0.3) / 0.52), drain = smooth((u - 0.86) / 0.14);
      const k = idle ? N : sweepU * N, col = Math.min(N - 1, Math.floor(k)), sweeping = !idle && u > 0.3 && u < 0.82;

      // x: the token's vector, brightness by |value|
      for (let j = 0; j < N; j++) {
        const a = Math.abs(x[j]), lit = idle ? 0.35 : smooth(u / 0.12);
        const hot = sweeping && j === col ? 1.6 : 1;
        o.position.set(colX(j), xRowY, 0.005); o.scale.setScalar(1); o.updateMatrix(); xs.setMatrixAt(j, o.matrix);
        xs.setColorAt(j, c.copy(COL.dim).lerp(COL.x, lit * (0.35 + 0.65 * a)).multiplyScalar(1 + lit * a * 1.3 * hot));
      }
      // W: out of the HBM stacks, up into the tile, lit by x as the sweep passes, then drained
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        const n = i * N + j, delay = (j * 0.055 + i * 0.012), f = idle ? 1 : smooth((inU - delay) / 0.62);
        const from = panel.worldToLocal(tmp.copy(hbmWorld[src[n]]));
        const tx = colX(j), ty = rowY(i), lift = Math.sin(f * Math.PI) * 0.9;
        o.position.set(from.x + (tx - from.x) * f, from.y + (ty - from.y) * f + lift, from.z * (1 - f) + 0.005);
        o.scale.setScalar(0.35 + 0.65 * f); o.updateMatrix(); ws.setMatrixAt(n, o.matrix);
        const base = Math.abs(W[i][j]) / wMax, done = j < k, active = sweeping && j === col;
        const prod = Math.abs(W[i][j] * x[j]) / wMax;
        let bright = idle ? 0.18 : (0.32 + 0.4 * base) * (1 - 0.8 * drain);
        if (!idle && done) bright = Math.max(bright * 0.8, 0.25 + 0.9 * prod) * (1 - 0.8 * drain);
        if (active) bright = 0.9 + 3.2 * prod;
        const flying = !idle && f < 1 ? 1.8 * (1 - f) : 0;
        ws.setColorAt(n, c.copy(COL.dim).lerp(COL.w, Math.min(1, bright + flying)).multiplyScalar(0.8 + bright * 1.1 + flying * 1.6));
      }
      // y: the running sums, amber, with the row arrows flashing as each column adds in
      const sums = idle ? y : partialSums(W, x, Math.min(N, Math.round(k)));
      for (let i = 0; i < N; i++) {
        const a = Math.abs(sums[i]) / yMax, glow = idle ? 0.3 * a : a;
        o.position.set(yColX, rowY(i), 0.005); o.scale.setScalar(0.6 + 0.4 * Math.min(1, a)); o.updateMatrix(); ys.setMatrixAt(i, o.matrix);
        const flash = !idle && u > 0.82 ? 1.2 * (1 - drain) : 0;
        ys.setColorAt(i, c.copy(COL.dim).lerp(COL.y, Math.min(1, 0.35 + glow * 1.4)).multiplyScalar(1 + glow * 2.4 + flash * glow));
        const pulse = sweeping ? Math.abs(W[i][col] * x[col]) / wMax * (1 - (k - col)) : 0;
        arrows.setColorAt(i, c.copy(COL.dim).lerp(COL.y, Math.min(1, 0.2 + pulse * 1.5)).multiplyScalar(1 + pulse * 2));
      }
      for (const m of [xs, ws, ys]) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
      arrows.instanceColor.needsUpdate = true;
      bar.position.x = colX(col); bar.material.opacity = sweeping ? 0.22 * (1 - Math.abs(k - col - 0.5)) + 0.08 : 0;
      dieGlowMat.opacity = sweeping ? 0.18 + 0.06 * Math.sin(t * 12) : idle ? 0 : 0.08 * (1 - drain);
      // tether: from the die center to the bottom of the y column
      const p = tetherGeo.attributes.position;
      tmp.set(yColX, rowY(N - 1) - CELL / 2, 0); panel.localToWorld(tmp);
      p.setXYZ(0, 0, dieY + 0.08, 0); p.setXYZ(1, tmp.x, tmp.y, tmp.z); p.needsUpdate = true;
      tether.material.opacity = idle ? 0.15 : 0.5;
    },
    dispose() { labels.forEach(T => T.t.dispose()); root.traverse(m => { m.geometry?.dispose(); m.material?.dispose?.(); }); },
  };
}
