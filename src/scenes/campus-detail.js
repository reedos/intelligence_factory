import { hasCampusVehicles, campusVehicleBuilder } from './campus-blender-vehicles.js';
// Companion helpers for the campus scene (src/scenes/campus.js), split out only because that file
// was getting long. Nothing here is scene-specific: a surrounding-terrain texture, a few cloud
// sprites, a clustered-tree layout, and the vehicle/person assemblies driven by fx.movers.
import { hasCampusCatalog, campusCatalogBuilder } from './campus-blender-catalog.js';
import { THREE, MAT, canvasTex, person } from '../kit.js';
import { rbox } from '../fx.js';

// ---------- surrounding terrain: crop patchwork, row texture and a couple of dirt tracks ----------
// One big tile, repeated many times across the ground plane; at that repeat count it reads as
// aerial farmland at the horizon, not as a texture. Plain palette, no labels.
export function terrainTexture() {
  return canvasTex(1024, 1024, (g, w, h) => {
    const fields = [
      ['#30463f', '#344a42'], ['#34483f', '#384c43'], ['#32473e', '#364b42'],
      ['#34473e', '#384b42'], ['#32483f', '#364c43'], ['#344940', '#384d44'],
    ];
    const cols = 4, rows = 4, cw = w / cols, ch = h / rows;
    let s = 5; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const [base, row] = fields[(r * cols + c + Math.floor(rnd() * 2)) % fields.length];
      const x0 = c * cw, y0 = r * ch;
      g.fillStyle = base; g.fillRect(x0, y0, cw, ch);
      g.strokeStyle = row; g.lineWidth = 0.8; g.globalAlpha = 0.25;
      const horiz = (r + c) % 2 === 0, step = (horiz ? ch : cw) / 9;
      for (let i = 1; i < 9; i++) {
        g.beginPath();
        if (horiz) { g.moveTo(x0 + 4, y0 + i * step); g.lineTo(x0 + cw - 4, y0 + i * step); }
        else { g.moveTo(x0 + i * step, y0 + 4); g.lineTo(x0 + i * step, y0 + ch - 4); }
        g.stroke();
      }
      g.globalAlpha = 0.035;
      for (let i = 0; i < 400; i++) { g.fillStyle = rnd() < 0.5 ? '#000' : '#fff'; const rr = 0.5 + rnd() * 2; g.beginPath(); g.arc(x0 + rnd() * cw, y0 + rnd() * ch, rr, 0, Math.PI * 2); g.fill(); }
      g.globalAlpha = 1;
    }
    // Broad, soft changes in vegetation break up the grid at low aerial angles.
    for (let i = 0; i < 180; i++) {
      const x = rnd() * w, y = rnd() * h, r = 35 + rnd() * 160;
      const gradient = g.createRadialGradient(x, y, 0, x, y, r);
      gradient.addColorStop(0, i % 2 ? 'rgba(17,39,32,0.18)' : 'rgba(88,106,76,0.10)');
      gradient.addColorStop(1, 'rgba(30,55,39,0)');
      g.fillStyle = gradient; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }, { repeat: [6, 6] });
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
// anchors are [x, y, z, spread] world positions picked so they actually fall inside the campus's
// own hotspot/overview camera framings (verified by re-projecting through each view's real camera,
// not just placed and hoped for) — a wide 360° ring at 1.5-3.2km never entered any of those tightly
// framed, downward-looking equipment shots, so anchors sit low and close instead: just above the
// tallest roofline, at the handful of distances/directions the establishing views actually look.
export function clouds(anchors, seed = 11) {
  let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const tex = cloudTexture(), g = new THREE.Group();
  for (const [ax, ay, az, spread = 60] of anchors) {
    const mat = new THREE.SpriteMaterial({ map: tex, color: new THREE.Color().setHSL(0.08, 0.3, 0.86 - rnd() * 0.1), transparent: true, opacity: 0.32 + rnd() * 0.16, depthWrite: false, fog: false });
    const spr = new THREE.Sprite(mat);
    spr.position.set(ax + (rnd() - 0.5) * spread * 0.5, ay + (rnd() - 0.5) * spread * 0.2, az + (rnd() - 0.5) * spread * 0.5);
    const sc = spread * (0.55 + rnd() * 0.25); spr.scale.set(sc, sc * 0.5, 1);
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
  if(hasCampusVehicles())return campusVehicleBuilder('MODEL_3',B);
  if(hasCampusCatalog()) { campusCatalogBuilder('CAR',B); return; }
  B.slab(4.4, 0.8, 1.8, MAT.steel, 0, 0.25, 0);
  B.slab(2.4, 0.6, 1.6, MAT.glass, -0.2, 1.05, 0);
  for (const dz of [-0.95, 0.95]) { B.cylZ(0.34, 0.22, MAT.darkSteel, 1.35, 0.34, dz, 10); B.cylZ(0.34, 0.22, MAT.darkSteel, -1.35, 0.34, dz, 10); }
}
export function truckBuild(B) {
  if(hasCampusCatalog()) { campusCatalogBuilder('TRUCK',B); return; }
  rbox(B, 2.5, 2.5, 2.4, MAT.white, -3.7, 1.5, 0, { r: 0.12 });     // cab
  B.slab(0.15, 1.3, 2.1, MAT.glass, -2.5, 2.05, 0);                  // windshield
  rbox(B, 7.6, 3, 2.5, MAT.darkSteel, 2, 1.8, 0, { r: 0.05 });       // box trailer
  for (const x of [-3.7, -1.2, 1.4, 4.6]) for (const z of [-1.25, 1.25]) B.cylZ(0.46, 0.3, MAT.darkSteel, x, 0.46, z, 10);
}
export function walkerBuild(B) { if(hasCampusCatalog())return campusCatalogBuilder('WALKER',B); person(B, 0, 0, 0, 0); }
