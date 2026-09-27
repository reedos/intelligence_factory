// Companion helpers for the campus scene (src/scenes/campus.js), split out only because that file
// was getting long. Nothing here is scene-specific: a surrounding-terrain texture, a few cloud
// sprites, a clustered-tree layout, and the vehicle/person assemblies driven by fx.movers.
import { THREE, MAT, canvasTex, person } from '../kit.js';
import { rbox } from '../fx.js';

// ---------- surrounding terrain: crop patchwork, row texture and a couple of dirt tracks ----------
// One big tile, repeated many times across the ground plane; at that repeat count it reads as
// aerial farmland at the horizon, not as a texture. Plain palette, no labels.
export function terrainTexture() {
  return canvasTex(1024, 1024, (g, w, h) => {
    const fields = [
      ['#3a4d2b', '#4b6339'], ['#54522c', '#69682f'], ['#3e5933', '#517142'],
      ['#5b5230', '#6d6238'], ['#455b2d', '#527239'], ['#57592f', '#6a6b3d'],
    ];
    const cols = 4, rows = 4, cw = w / cols, ch = h / rows;
    let s = 5; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const [base, row] = fields[(r * cols + c + Math.floor(rnd() * 2)) % fields.length];
      const x0 = c * cw, y0 = r * ch;
      g.fillStyle = base; g.fillRect(x0, y0, cw, ch);
      g.strokeStyle = row; g.lineWidth = Math.max(2, cw * 0.018);
      const horiz = (r + c) % 2 === 0, step = (horiz ? ch : cw) / 9;
      for (let i = 1; i < 9; i++) {
        g.beginPath();
        if (horiz) { g.moveTo(x0 + 4, y0 + i * step); g.lineTo(x0 + cw - 4, y0 + i * step); }
        else { g.moveTo(x0 + i * step, y0 + 4); g.lineTo(x0 + i * step, y0 + ch - 4); }
        g.stroke();
      }
      g.globalAlpha = 0.12;
      for (let i = 0; i < 40; i++) { g.fillStyle = rnd() < 0.5 ? '#000' : '#fff'; const rr = 3 + rnd() * 8; g.beginPath(); g.arc(x0 + rnd() * cw, y0 + rnd() * ch, rr, 0, Math.PI * 2); g.fill(); }
      g.globalAlpha = 1;
    }
    // dirt tracks: soft tan bands corner to corner, so they join into a lattice once tiled
    g.strokeStyle = '#8a7256'; g.lineCap = 'round';
    g.lineWidth = w * 0.016; g.beginPath(); g.moveTo(0, h * 0.14); g.lineTo(w, h * 0.86); g.stroke();
    g.lineWidth = w * 0.011; g.beginPath(); g.moveTo(w * 0.62, 0); g.lineTo(w * 0.12, h); g.stroke();
  }, { repeat: [46, 46] });
}

// ---------- clouds: a few big soft sprites high overhead ----------
let _cloudTex;
function cloudTexture() {
  if (_cloudTex) return _cloudTex;
  _cloudTex = canvasTex(256, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const blob = (x, y, r, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
    blob(w * 0.35, h * 0.55, w * 0.3, 0.9); blob(w * 0.6, h * 0.42, w * 0.26, 0.85);
    blob(w * 0.78, h * 0.58, w * 0.18, 0.7); blob(w * 0.18, h * 0.6, w * 0.16, 0.6);
  });
  _cloudTex.wrapS = _cloudTex.wrapT = THREE.ClampToEdgeWrapping;
  return _cloudTex;
}
export function clouds(n, seed, { cx = -70, cz = -40 } = {}) {
  let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const tex = cloudTexture(), g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const mat = new THREE.SpriteMaterial({ map: tex, color: new THREE.Color().setHSL(0.08, 0.4, 0.82 - rnd() * 0.14), transparent: true, opacity: 0.45 + rnd() * 0.25, depthWrite: false, fog: false });
    const spr = new THREE.Sprite(mat);
    const a = rnd() * Math.PI * 2, r = 1500 + rnd() * 1700;
    spr.position.set(cx + Math.cos(a) * r, 560 + rnd() * 340, cz + Math.sin(a) * r * 0.6);
    const sc = 480 + rnd() * 480; spr.scale.set(sc, sc * 0.5, 1);
    g.add(spr);
  }
  return g;
}

// ---------- clustered trees: cluster centers with local scatter, plus a thin distant tree line ----------
export function treeMatrices(rnd, { cx = -70, cz = -40, clusters = 9, perCluster = 48, distant = 130, minR = 650, maxR = 1900, distMinR, distMaxR, exclude } = {}) {
  const o = new THREE.Object3D();
  const mtxAt = (x, y, z, ry, s) => { o.position.set(x, y, z); o.rotation.set(0, ry, 0); o.scale.set(s, s, s); o.updateMatrix(); return o.matrix.clone(); };
  const keep = (x, z) => !exclude || !exclude(x, z);
  const out = [];
  for (let c = 0; c < clusters; c++) {
    const a = rnd() * Math.PI * 2, r = minR + rnd() * (maxR - minR);
    const ccx = cx + Math.cos(a) * r, ccz = cz + Math.sin(a) * r * 0.75;
    const spread = 40 + rnd() * 70, n = Math.round(perCluster * (0.6 + rnd() * 0.8));
    for (let i = 0; i < n; i++) {
      const ta = rnd() * Math.PI * 2, tr = Math.sqrt(rnd()) * spread;
      const x = ccx + Math.cos(ta) * tr, z = ccz + Math.sin(ta) * tr;
      if (keep(x, z)) out.push(mtxAt(x, 0, z, rnd() * 6, 0.85 + rnd() * 1.05));
    }
  }
  const dr0 = distMinR ?? 2500, dr1 = distMaxR ?? dr0 + 500;
  for (let i = 0; i < distant; i++) {
    const a = rnd() * Math.PI * 2, r = dr0 + rnd() * (dr1 - dr0);
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r * 0.75;
    if (keep(x, z)) out.push(mtxAt(x, 0, z, rnd() * 6, 1.6 + rnd() * 0.9));
  }
  return out;
}

// ---------- moving vehicles and walking people, drawn at the origin facing +x for fx.movers ----------
export function carBuild(B) {
  B.slab(4.4, 0.8, 1.8, MAT.steel, 0, 0.25, 0);
  B.slab(2.4, 0.6, 1.6, MAT.glass, -0.2, 1.05, 0);
  for (const dz of [-0.95, 0.95]) { B.cylZ(0.34, 0.22, MAT.darkSteel, 1.35, 0.34, dz, 10); B.cylZ(0.34, 0.22, MAT.darkSteel, -1.35, 0.34, dz, 10); }
}
export function truckBuild(B) {
  rbox(B, 2.5, 2.5, 2.4, MAT.white, -3.7, 1.5, 0, { r: 0.12 });     // cab
  B.slab(0.15, 1.3, 2.1, MAT.glass, -2.5, 2.05, 0);                  // windshield
  rbox(B, 7.6, 3, 2.5, MAT.darkSteel, 2, 1.8, 0, { r: 0.05 });       // box trailer
  for (const x of [-3.7, -1.2, 1.4, 4.6]) for (const z of [-1.25, 1.25]) B.cylZ(0.46, 0.3, MAT.darkSteel, x, 0.46, z, 10);
}
export function walkerBuild(B) { person(B, 0, 0, 0, 0); }
