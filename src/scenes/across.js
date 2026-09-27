// Scene 6: scale across. A region about 2,000 km wide; world unit = 1 km. Heights are exaggerated.
import { THREE, MAT, Builder, mtx, flow, canvasTex, sky, glowMat } from '../kit.js';

const CAMPUSES = { A: [-620, 260], B: [-120, -280], C: [560, 120] };

function mapTexture() {
  return canvasTex(2048, 1408, (g, w, h) => {
    let seed = 11; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    g.fillStyle = '#0f1419'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {                                   // land cover
      const x = r() * w, y = r() * h, rad = 20 + r() * 120;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      const c = r() < 0.5 ? '28,36,30' : '22,28,34';
      gr.addColorStop(0, `rgba(${c},0.55)`); gr.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    g.strokeStyle = 'rgba(80,110,140,0.10)'; g.lineWidth = 1;          // graticule
    for (let x = 0; x < w; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y < h; y += 128) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.strokeStyle = 'rgba(60,110,150,0.55)'; g.lineWidth = 3;            // rivers
    for (let k = 0; k < 4; k++) {
      g.beginPath(); let x = r() * w, y = 0; g.moveTo(x, y);
      while (y < h) { x += (r() - 0.5) * 90; y += 40 + r() * 40; g.lineTo(x, y); }
      g.stroke();
    }
    g.fillStyle = 'rgba(40,80,120,0.5)';                                 // lakes
    for (let k = 0; k < 9; k++) { g.beginPath(); g.ellipse(r() * w, r() * h, 10 + r() * 30, 6 + r() * 16, r() * 3, 0, Math.PI * 2); g.fill(); }
    g.setLineDash([10, 8]); g.strokeStyle = 'rgba(150,160,175,0.16)'; g.lineWidth = 2;   // borders
    for (let k = 0; k < 5; k++) { g.beginPath(); let x = r() * w, y = r() * h; g.moveTo(x, y); for (let s = 0; s < 8; s++) { x += (r() - 0.3) * 260; y += (r() - 0.5) * 200; g.lineTo(x, y); } g.stroke(); }
    g.setLineDash([]);
    for (let k = 0; k < 26; k++) {                                        // city glow
      const x = r() * w, y = r() * h, rad = 6 + r() * 22;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, 'rgba(255,200,130,0.55)'); gr.addColorStop(1, 'rgba(255,190,120,0)');
      g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  }, { srgb: true });
}
function labelSprite(text, color = '#ffe7a3') {
  const c = document.createElement('canvas'), g = c.getContext('2d');
  g.font = '600 44px "IBM Plex Mono", ui-monospace, monospace';
  const w = Math.ceil(g.measureText(text).width) + 36; c.width = w; c.height = 72;
  g.font = '600 44px "IBM Plex Mono", ui-monospace, monospace';
  g.fillStyle = 'rgba(10,14,20,0.82)'; g.beginPath(); g.roundRect(2, 4, w - 4, 64, 14); g.fill();
  g.strokeStyle = color; g.globalAlpha = 0.7; g.lineWidth = 2.5; g.stroke(); g.globalAlpha = 1;
  g.fillStyle = color; g.textBaseline = 'middle'; g.fillText(text, 18, 37);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(w / 72 * 26, 26, 1); s.renderOrder = 10; return s;
}
// a wandering route between two points, like fiber laid along roads and rail
function route(a, b, wiggle, seed) {
  let s = seed; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const pts = [], n = 18, dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), px = -dz / len, pz = dx / len;
  for (let i = 0; i <= n; i++) {
    const u = i / n, bend = Math.sin(u * Math.PI) * wiggle * 0.45 + (i && i < n ? (r() - 0.5) * wiggle * 0.12 : 0);
    pts.push([a[0] + dx * u + px * bend, 3, a[1] + dz * u + pz * bend]);
  }
  return pts;
}
const polyLen = pts => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[2] - pts[i][2]), 0);
function pointAt(pts, d) {
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2]);
    if (d <= seg) { const u = d / seg; return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * u, 3, pts[i - 1][2] + (pts[i][2] - pts[i - 1][2]) * u]; }
    d -= seg;
  }
  return pts[pts.length - 1];
}

export function build({ quality }) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0b111b, 2600, 7000);
  scene.add(sky('#060b15', '#101a2c', '#2b3346', 9000));
  scene.add(new THREE.HemisphereLight(0x8aa2cc, 0x0d1014, 1.1));
  const key = new THREE.DirectionalLight(0xdfe8ff, 0.8); key.position.set(-800, 1200, 600); scene.add(key);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2600, 1800), new THREE.MeshStandardMaterial({ map: mapTexture(), roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; scene.add(ground);
  const under = new THREE.Mesh(new THREE.PlaneGeometry(20000, 20000), new THREE.MeshStandardMaterial({ color: 0x0a0e13, roughness: 1 }));
  under.rotation.x = -Math.PI / 2; under.position.y = -0.5; scene.add(under);

  const power = new THREE.Group(), data = new THREE.Group();
  scene.add(power, data);
  const flows = [], dataFlows = [];

  // campuses: exaggerated so they read at this scale
  const S = new Builder();
  const roofGlow = glowMat('#ffd49a', 1.2);
  for (const [k, [x, z]] of Object.entries(CAMPUSES)) {
    S.slab(34, 0.6, 26, MAT.concreteDark, x, 0, z);
    for (const dz of [-6, 6]) { S.slab(24, 5, 8, MAT.wall, x + 2, 0.6, z + dz); S.slab(24, 0.3, 8, roofGlow, x + 2, 5.6, z + dz); }
    S.slab(6, 3, 10, MAT.xfmr, x - 14, 0.6, z);
    if (k === 'A') S.slab(36, 0.4, 28, glowMat('#ffb14e', 0.6), x, 0.62, z);
  }
  scene.add(S.build({ cast: false }));

  // ---------- power layer: plants and the HV backbone ----------
  const P = new Builder();
  const plants = [[-980, -380, 'gas'], [-260, 520, 'nuclear'], [120, -640, 'wind'], [900, -300, 'gas'], [980, 520, 'solar'], [-40, 140, 'gas']];
  plants.forEach(([x, z, kind]) => {
    if (kind === 'gas') { P.slab(18, 6, 12, MAT.steel, x, 0, z); P.cyl(1.6, 22, MAT.concrete, x - 4, 11, z, 12); P.cyl(1.6, 22, MAT.concrete, x + 4, 11, z, 12); }
    if (kind === 'nuclear') { P.add(new THREE.CylinderGeometry(9, 13, 26, 24, 1, true), MAT.concrete, x - 10, 13, z); P.add(new THREE.CylinderGeometry(9, 13, 26, 24, 1, true), MAT.concrete, x + 14, 13, z); P.cyl(7, 14, MAT.white, x + 2, 7, z + 18, 20); }
    if (kind === 'wind') for (let i = 0; i < 18; i++) { const tx = x + (i % 6) * 14 - 35, tz = z + Math.floor(i / 6) * 16 - 16; P.cyl(0.5, 16, MAT.white, tx, 8, tz, 6); P.box(12, 0.5, 0.8, MAT.white, tx, 16.5, tz, 0, 0, i); }
    if (kind === 'solar') for (let i = 0; i < 10; i++) P.box(60, 0.4, 3, MAT.glass, x, 1.2, z - 20 + i * 4.5, 0, -0.35);
  });
  power.add(P.build({ cast: false }));
  const hvLines = [
    [plants[0], 'A'], [plants[1], 'A'], [plants[5], 'A'], [plants[5], 'B'], [plants[2], 'B'], [plants[3], 'C'], [plants[4], 'C'], [plants[3], 'B'],
  ];
  const towerPts = [];
  hvLines.forEach(([[px, pz], c], i) => {
    const [cx, cz] = CAMPUSES[c];
    const pts = route([px, pz], [cx, cz], 60, 100 + i).map(p => [p[0], 6, p[2]]);
    const f = flow(pts, 'hv', { count: 18, speed: 160, size: 4, trailR: 1.1, trailK: 0.45 });
    flows.push(f); power.add(f.group);
    const L = polyLen(pts); for (let d = 0; d < L; d += 30) towerPts.push(pointAt(pts, d));
  });
  const tb = new Builder(); tb.cyl(0.6, 6, MAT.galv, 0, 3, 0, 5); tb.box(4, 0.4, 0.4, MAT.galv, 0, 6, 0);
  tb.instance(towerPts.map(p => mtx(p[0], 0, p[2], Math.random() * 3))).children.forEach(m => power.add(m));

  // ---------- data layer: DWDM routes, amplifier huts, latency labels ----------
  const routes = [['A', 'B', 120, 7], ['B', 'C', 160, 17], ['A', 'C', 220, 29]];
  const huts = [];
  let longest = null;
  routes.forEach(([a, b, wig, sd]) => {
    const pts = route(CAMPUSES[a], CAMPUSES[b], wig, sd);
    const L = polyLen(pts);
    for (const dir of [1, -1]) {
      const pp = dir > 0 ? pts : [...pts].reverse().map(p => [p[0], p[1] + 1.5, p[2]]);
      const f = flow(pp, 'dci', { count: Math.round(L / 22), speed: 240, size: 3.2, trailR: 1.0, trailK: 0.5 });
      dataFlows.push(f); data.add(f.group);
    }
    for (let d = 80; d < L - 20; d += 80) huts.push(pointAt(pts, d));
    const mid = pointAt(pts, L / 2);
    const lab = labelSprite(`${Math.round(L).toLocaleString('en-US')} km · ${(L * 0.005).toFixed(1)} ms`);
    lab.position.set(mid[0], 40, mid[2]); data.add(lab);
    if (!longest || L > longest.L) longest = { L, mid, pts };
  });
  const hut = new Builder(); hut.slab(6, 3, 4, MAT.beige, 0, 0, 0); hut.slab(6.4, 0.4, 4.4, MAT.roof, 0, 3, 0); hut.cyl(0.3, 8, MAT.galv, 3.5, 4, 0, 6);
  hut.instance(huts.map(p => mtx(p[0], 0, p[2], Math.atan2(p[0], p[2])))).children.forEach(m => data.add(m));
  const hutGlow = new THREE.InstancedMesh(new THREE.SphereGeometry(2.2, 10, 8), glowMat('#ffd35c', 2.2), huts.length);
  huts.forEach((p, i) => hutGlow.setMatrixAt(i, mtx(p[0], 5, p[2]))); data.add(hutGlow);
  // line terminal buildings at each campus
  const lt = new Builder(); lt.slab(8, 4, 6, MAT.white, 0, 0, 0); lt.slab(8.4, 0.4, 6.4, glowMat('#ffd35c', 0.9), 0, 4, 0);
  lt.instance(Object.values(CAMPUSES).map(([x, z]) => mtx(x + 20, 0, z - 16))).children.forEach(m => data.add(m));

  const [ax, az] = CAMPUSES.A, [cx, cz] = CAMPUSES.C, h0 = huts[3] || huts[0];
  return {
    scene, flows, dataFlows, heatFlows: [], layers: { power, data },
    heatHotspots: {
      climate: { pos: [CAMPUSES.B[0], 12, CAMPUSES.B[1]], view: { pos: [-300, 500, 300], target: [CAMPUSES.B[0], 0, CAMPUSES.B[1]] } },
      home: { pos: [CAMPUSES.A[0] - 40, 10, CAMPUSES.A[1] + 40], view: { pos: [-560, 160, 480], target: [CAMPUSES.A[0], 0, CAMPUSES.A[1]] } },
    },
    camera: { pos: [-120, 1450, 1500], target: [-20, 0, 60], near: 1, far: 20000, min: 60, max: 4200 },
    hotspots: {
      grid: { pos: [(plants[1][0] + ax) / 2, 12, (plants[1][1] + az) / 2], view: { pos: [-700, 300, 900], target: [-450, 0, 380] } },
      plants: { pos: [plants[0][0], 26, plants[0][1]], view: { pos: [-1100, 180, -150], target: [-980, 0, -380] } },
      home: { pos: [ax, 10, az], view: { pos: [-560, 160, 480], target: [ax, 0, az] } },
    },
    dataHotspots: {
      dci: { pos: [ax + 20, 8, az - 16], view: { pos: [-540, 150, 420], target: [ax + 10, 0, az - 10] } },
      ila: { pos: [h0[0], 9, h0[2]], view: { pos: [h0[0] + 120, 140, h0[2] + 160], target: [h0[0], 0, h0[2]] } },
      route: { pos: [longest.mid[0], 60, longest.mid[2]], view: { pos: [longest.mid[0] - 100, 700, longest.mid[2] + 700], target: [longest.mid[0], 0, longest.mid[2]] } },
      remote: { pos: [cx, 10, cz], view: { pos: [cx + 160, 180, cz + 240], target: [cx, 0, cz] } },
      home: { pos: [ax - 40, 10, az + 40], view: { pos: [-560, 160, 480], target: [ax, 0, az] } },
    },
    update() {},
  };
}
