// Scene 1: scale across, on a real map of the lower 48. World unit = 1 km (Albers equal-area); heights are exaggerated.
// The campus sits at its real site when the scenario is based on one, otherwise at a generic spot in central Ohio.
// States with EIA carbon figures are shaded by grams of CO₂ per kWh; the other real campuses are pinned.
// The look is a satellite night image: a dark map lit by city glow, campus and route light, and plant activity
// (steam plumes off nuclear and gas plants, turning wind rotors) rather than daylight.
import { feature } from 'topojson-client';
import us from 'us-atlas/states-10m.json';
import { THREE, MAT, Builder, mtx, flow, canvasTex, sky, glowMat, spinners } from '../kit.js';
import { rbox, plumes } from '../fx.js';
import { SITES, STATE_CARBON, DEFAULT_PLACE, PLACES, placeKey, albers, greatCircleKm } from '../model/sites.ts';

const ORIGIN = albers(-92, 37);
const world = (lon, lat) => { const [x, y] = albers(lon, lat); return [x - ORIGIN[0], -(y - ORIGIN[1])]; };
const LOWER48 = feature(us, us.objects.states).features.filter(f => !['02', '15', '60', '66', '69', '72', '78'].includes(f.id));

// carbon ramp: hydro-heavy teal → coal-heavy amber
export const carbonColor = g => {
  const u = Math.min(1, Math.max(0, (g - 100) / 400));
  const a = [63, 166, 150], b = [230, 170, 70], c = [226, 88, 70];
  const mix = (p, q, k) => p.map((v, i) => Math.round(v + (q[i] - v) * k));
  return `rgb(${(u < 0.6 ? mix(a, b, u / 0.6) : mix(b, c, (u - 0.6) / 0.4)).join(',')})`;
};

// bounds of the map in world km
let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
const RINGS = LOWER48.map(f => {
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  return { id: f.id, rings: polys.map(p => p.map(ring => ring.map(([lon, lat]) => { const [x, z] = world(lon, lat); minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); return [x, z]; }))) };
});
const PAD = 260; minX -= PAD; maxX += PAD; minZ -= PAD; maxZ += PAD;
const MW = maxX - minX, MD = maxZ - minZ;
// is a point on land? (ray casting against every state ring)
function onLand(x, z) {
  for (const { rings } of RINGS) for (const poly of rings) {
    let inside = false; const r = poly[0];
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, zi] = r[i], [xj, zj] = r[j];
      if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
    }
    if (inside) return true;
  }
  return false;
}
const CENTROID = {};
RINGS.forEach(({ id, rings }) => {                               // label point: the middle of the largest ring's bounding box
  let best = null, area = 0;
  rings.forEach(poly => { const r = poly[0], xs = r.map(p => p[0]), zs = r.map(p => p[1]); const a = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...zs) - Math.min(...zs)); if (a > area) { area = a; best = [(Math.max(...xs) + Math.min(...xs)) / 2, (Math.max(...zs) + Math.min(...zs)) / 2]; } });
  CENTROID[id] = best;
});

// a satellite-night map: water a touch bluer than land, a soft glow along every state (and coast) line
function mapTexture(small) {
  const W = small ? 2048 : 4096, H = Math.round(W * MD / MW), sx = W / MW, sz = H / MD;
  return canvasTex(W, H, (g) => {
    g.fillStyle = '#050912'; g.fillRect(0, 0, W, H);                                          // water
    const path = rings => { g.beginPath(); rings.forEach(poly => poly.forEach(r => r.forEach(([x, z], i) => { const px = (x - minX) * sx, pz = (z - minZ) * sz; i ? g.lineTo(px, pz) : g.moveTo(px, pz); }))); };
    RINGS.forEach(({ id, rings }) => {
      const c = STATE_CARBON[id];
      path(rings);
      g.fillStyle = '#1b2028'; g.fill('evenodd');                                              // land, a shade warmer than water
      if (c) { g.globalAlpha = 0.5; g.fillStyle = carbonColor(c.g); g.fill('evenodd'); g.globalAlpha = 1; }
    });
    RINGS.forEach(({ rings }) => {                                                              // border glow: coastline and state lines both
      path(rings);
      g.shadowColor = 'rgba(130,175,255,0.55)'; g.shadowBlur = 7;
      g.strokeStyle = 'rgba(170,200,240,0.5)'; g.lineWidth = 1.1; g.stroke();
      g.shadowBlur = 0;
    });
    RINGS.forEach(({ id, rings }) => {
      const c = STATE_CARBON[id];
      path(rings);
      g.strokeStyle = c ? 'rgba(240,240,250,0.3)' : 'rgba(170,178,185,0.18)'; g.lineWidth = 1.2; g.stroke();
    });
    g.strokeStyle = 'rgba(80,110,140,0.07)'; g.lineWidth = 1;                                   // graticule every 5°
    for (let lon = -125; lon <= -65; lon += 5) { g.beginPath(); for (let lat = 24; lat <= 50; lat += 1) { const [x, z] = world(lon, lat), px = (x - minX) * sx, pz = (z - minZ) * sz; lat === 24 ? g.moveTo(px, pz) : g.lineTo(px, pz); } g.stroke(); }
    for (let lat = 25; lat <= 50; lat += 5) { g.beginPath(); for (let lon = -126; lon <= -65; lon += 1) { const [x, z] = world(lon, lat), px = (x - minX) * sx, pz = (z - minZ) * sz; lon === -126 ? g.moveTo(px, pz) : g.lineTo(px, pz); } g.stroke(); }
  }, { srgb: true });
}
function labelSprite(text, color = '#ffe7a3', size = 26) {
  const c = document.createElement('canvas'), g = c.getContext('2d');
  g.font = '600 44px "IBM Plex Mono", ui-monospace, monospace';
  const w = Math.ceil(g.measureText(text).width) + 36; c.width = w; c.height = 72;
  g.font = '600 44px "IBM Plex Mono", ui-monospace, monospace';
  g.fillStyle = 'rgba(10,14,20,0.82)'; g.beginPath(); g.roundRect(2, 4, w - 4, 64, 14); g.fill();
  g.strokeStyle = color; g.globalAlpha = 0.7; g.lineWidth = 2.5; g.stroke(); g.globalAlpha = 1;
  g.fillStyle = color; g.textBaseline = 'middle'; g.fillText(text, 18, 37);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  // a fixed size on screen: sized in km, labels would fill the view whenever the camera flies in close
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true, sizeAttenuation: false }));
  const k = size / 26 * 0.016;
  s.scale.set(w / 72 * k, k, 1); s.renderOrder = 10; return s;
}
// a wandering route between two points, like fiber laid along roads and rail
function route(a, b, wiggle, seed) {
  let s = seed; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const pts = [], n = 22, dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), px = -dz / len, pz = dx / len;
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
// a hyperboloid cooling tower shell: wide base, a narrow waist about 2/3 up, a flared lip at the top
function coolingTowerGeo(h, rBase, rWaist, rTop, seg) {
  const waistY = h * 0.62, steps = 14, pts = [];
  for (let i = 0; i <= steps; i++) {
    const y = h * i / steps;
    const r = y <= waistY
      ? rWaist + (rBase - rWaist) * ((waistY - y) / waistY) ** 2
      : rWaist + (rTop - rWaist) * ((y - waistY) / (h - waistY)) ** 2;
    pts.push(new THREE.Vector2(Math.max(0.2, r), y));
  }
  return new THREE.LatheGeometry(pts, seg);
}
// ~40 major US metro areas, lon/lat and a rough population weight (millions) for glow size only: purely decorative
// city lights, no labels and no invented figures reach the page.
const METROS = [
  [-74.01, 40.71, 19.5], [-118.24, 34.05, 13.2], [-87.63, 41.88, 9.5], [-96.80, 32.78, 7.8],
  [-95.37, 29.76, 7.3], [-77.04, 38.91, 6.3], [-80.19, 25.76, 6.2], [-75.17, 39.95, 6.2],
  [-84.39, 33.75, 6.3], [-112.07, 33.45, 5.0], [-71.06, 42.36, 4.9], [-122.42, 37.77, 4.7],
  [-117.40, 33.95, 4.6], [-83.05, 42.33, 4.3], [-122.33, 47.61, 4.0], [-93.27, 44.98, 3.7],
  [-117.16, 32.72, 3.3], [-82.46, 27.95, 3.3], [-104.99, 39.74, 3.0], [-90.20, 38.63, 2.8],
  [-76.61, 39.29, 2.8], [-80.84, 35.23, 2.7], [-81.38, 28.54, 2.7], [-98.49, 29.42, 2.6],
  [-122.68, 45.52, 2.5], [-121.49, 38.58, 2.4], [-79.99, 40.44, 2.3], [-115.14, 36.17, 2.3],
  [-84.51, 39.10, 2.3], [-94.58, 39.10, 2.2], [-83.00, 39.96, 2.1], [-86.16, 39.77, 2.1],
  [-81.69, 41.50, 2.0], [-121.89, 37.34, 2.0], [-86.78, 36.16, 2.0], [-76.29, 36.85, 1.8],
  [-81.66, 30.33, 1.6], [-87.91, 43.04, 1.6], [-97.52, 35.47, 1.4], [-78.64, 35.78, 1.5],
];
function cityLights(quality) {
  const list = quality.mobile ? METROS.slice(0, 18) : METROS;
  const m = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), glowMat('#ffd7a0', 2.4), list.length);
  list.forEach(([lon, lat, w], i) => { const [x, z] = world(lon, lat); m.setMatrixAt(i, mtx(x, 5, z, 0, 1.0 + Math.sqrt(w) * 0.5)); });
  m.instanceMatrix.needsUpdate = true;
  return m;
}


export function build({ quality, model }) {
  const siteId = model.scenario.site, site = siteId ? SITES[siteId] : null;
  const here = site ? { name: site.name, lat: site.lat, lon: site.lon } : DEFAULT_PLACE;
  const H = world(here.lon, here.lat);
  const others = PLACES.filter(p => !site || !p.ids.includes(siteId));

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x060a12, 3200, 9200);
  scene.add(sky('#040810', '#0c1526', '#1c2436', 12000));
  scene.add(new THREE.HemisphereLight(0x6a84b8, 0x0a0d12, 0.85));
  const key = new THREE.DirectionalLight(0xc9d8ff, 0.45); key.position.set(-800, 1200, 600); scene.add(key);
  scene.add(cityLights(quality));                                      // metro glow: always on, whatever the layer

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(MW, MD), new THREE.MeshStandardMaterial({ map: mapTexture(quality.mobile), roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set((minX + maxX) / 2, 0, (minZ + maxZ) / 2); scene.add(ground);
  const under = new THREE.Mesh(new THREE.PlaneGeometry(30000, 30000), new THREE.MeshStandardMaterial({ color: 0x05070a, roughness: 1 }));
  under.rotation.x = -Math.PI / 2; under.position.y = -0.5; scene.add(under);

  const power = new THREE.Group(), data = new THREE.Group();
  scene.add(power, data);
  const flows = [], dataFlows = [];

  // campuses: exaggerated so they read at this scale, rounded so they read as buildings and not blocks
  const S = new Builder();
  const roofGlow = glowMat('#ffd49a', 1.35);
  const campus = ([x, z], main) => {
    const k = main ? 1 : 0.7;
    rbox(S, 34 * k, 0.6, 26 * k, MAT.concreteDark, x, 0.3, z, { r: 0.05 });
    for (const dz of [-6, 6]) {
      rbox(S, 24 * k, 5, 8 * k, MAT.wall, x + 2 * k, 3.1, z + dz * k, { r: 0.07 });
      S.slab(24 * k, 0.3, 8 * k, roofGlow, x + 2 * k, 5.6, z + dz * k);
    }
    rbox(S, 6 * k, 3, 10 * k, MAT.xfmr, x - 14 * k, 2.1, z, { r: 0.08 });
    if (main) S.slab(36, 0.4, 28, glowMat('#ffb14e', 0.65), x, 0.62, z);
  };
  campus(H, true);
  others.forEach(p => campus(world(p.site.lon, p.site.lat), false));
  scene.add(S.build({ cast: false }));
  const hereLab = labelSprite(here.name, '#ffb14e', 36); hereLab.position.set(H[0], 70, H[1]); scene.add(hereLab);
  others.forEach(p => { const [x, z] = world(p.site.lon, p.site.lat), l = labelSprite(p.name, '#e8ecf2', 28); l.position.set(x, 52, z); scene.add(l); });

  // ---------- power layer: state carbon labels, plants and the HV backbone near this campus ----------
  Object.entries(STATE_CARBON).forEach(([id, c]) => {
    const at = CENTROID[id]; if (!at) return;
    const l = labelSprite(`${c.abbr} ${c.g} g`, carbonColor(c.g), 34); l.position.set(at[0], 30, at[1]); power.add(l);
  });
  const P = new Builder();
  const around = [[-420, -300, 'gas'], [-260, 330, 'nuclear'], [260, -420, 'wind'], [380, 180, 'gas'], [120, 420, 'solar']];
  // illustrative plants around the campus, turned until each one stands on land
  const plants = around.map(([dx, dz, kind]) => {
    for (let k = 0; k < 24; k++) {
      const a = k * Math.PI / 12, x = H[0] + dx * Math.cos(a) - dz * Math.sin(a), z = H[1] + dx * Math.sin(a) + dz * Math.cos(a);
      if (onLand(x, z)) return [x, z, kind];
    }
    return [H[0] + dx * 0.3, H[1] + dz * 0.3, kind];
  });
  let towerGeo = null;
  const nuclearEmitters = [], gasEmitters = [], turbineItems = [];
  plants.forEach(([x, z, kind]) => {
    if (kind === 'gas') {                                              // a turbine hall and two tapered stacks
      rbox(P, 20, 7, 13, MAT.steel, x, 3.5, z, { r: 0.05 });
      const stack = new THREE.CylinderGeometry(1.3, 1.85, 24, 12);
      P.addM(stack, MAT.concrete, mtx(x - 4.5, 12, z)); P.addM(stack, MAT.concrete, mtx(x + 4.5, 12, z));
      gasEmitters.push({ p: [x - 4.5, 24, z], dir: [0.15, 1, 0] }, { p: [x + 4.5, 24, z], dir: [-0.1, 1, 0.1] });
    }
    if (kind === 'nuclear') {                                          // two hyperbolic cooling towers, a containment dome
      const H2 = 34, seg = quality.mobile ? 10 : 18;
      towerGeo ||= coolingTowerGeo(H2, 15, 9, 12, seg);
      P.addM(towerGeo, MAT.concrete, mtx(x - 11, 0, z)); P.addM(towerGeo, MAT.concrete, mtx(x + 13, 0, z));
      P.cyl(7, 15, MAT.white, x + 1, 7.5, z + 19, 20);
      nuclearEmitters.push({ p: [x - 11, H2, z], dir: [0.1, 1, 0] }, { p: [x + 13, H2, z], dir: [-0.1, 1, 0] });
    }
    if (kind === 'wind') {                                             // three-blade rotors, turning in update()
      const cols = quality.mobile ? 3 : 6, n = cols * (quality.mobile ? 3 : 3);
      for (let i = 0; i < n; i++) {
        const tx = x + (i % cols) * 14 - (cols - 1) * 7, tz = z + Math.floor(i / cols) * 16 - 16;
        P.cyl(0.5, 16, MAT.white, tx, 8, tz, 8);
        P.box(1.6, 1, 1.2, MAT.white, tx, 16.5, tz);
        turbineItems.push({ p: [tx, 16.5, tz], axis: 'z', r: 8 });
      }
    }
    if (kind === 'solar') for (let i = 0; i < 10; i++) P.box(60, 0.4, 3, MAT.glass, x, 1.2, z - 20 + i * 4.5, 0, -0.35);
  });
  power.add(P.build({ cast: false }));
  const plumeUpdates = [];
  if (nuclearEmitters.length) { const pl = plumes(nuclearEmitters, { perEmitter: quality.mobile ? 10 : 22, size: 2.2, grow: 5, life: 9, rise: 2.1, drift: [0.4, 0, 0.15], spread: 0.6, color: '#eef3f8', opacity: 0.3 }); power.add(pl.points); plumeUpdates.push(pl.update); }
  if (gasEmitters.length) { const pl = plumes(gasEmitters, { perEmitter: quality.mobile ? 8 : 16, size: 1.6, grow: 4, life: 6, rise: 2.6, drift: [0.5, 0, 0.1], spread: 0.5, color: '#c9cfd6', opacity: 0.28 }); power.add(pl.points); plumeUpdates.push(pl.update); }
  const turbines = turbineItems.length ? spinners(turbineItems, MAT.white, { blades: 3, speed: 1.8 }) : null;
  if (turbines) power.add(turbines.mesh);
  const towerPts = [];
  plants.forEach(([px, pz], i) => {
    const pts = route([px, pz], H, 60, 100 + i).map(p => [p[0], 6, p[2]]);
    const f = flow(pts, 'hv', { count: 18, speed: 160, size: 4, trailR: 1.1, trailK: 0.45 });
    flows.push(f); power.add(f.group);
    const L = polyLen(pts); for (let d = 0; d < L; d += 30) towerPts.push(pointAt(pts, d));
  });
  const tb = new Builder(); tb.cyl(0.6, 6, MAT.galv, 0, 3, 0, 5); tb.box(4, 0.4, 0.4, MAT.galv, 0, 6, 0);
  tb.instance(towerPts.map((p, i) => mtx(p[0], 0, p[2], i * 1.3))).children.forEach(m => power.add(m));

  // ---------- data layer: DWDM routes to the two nearest other campuses ----------
  const near = others.map(p => ({ p, km: greatCircleKm(here, p.site) })).sort((a, b) => a.km - b.km).slice(0, 2);
  const huts = [];
  let longest = null;
  near.forEach(({ p, km }, i) => {
    const B = world(p.site.lon, p.site.lat);
    const pts = route(H, B, Math.min(160, km * 0.12), 7 + i * 10);
    const L = polyLen(pts);
    for (const dir of [1, -1]) {
      const pp = dir > 0 ? pts : [...pts].reverse().map(q => [q[0], q[1] + 1.5, q[2]]);
      const f = flow(pp, 'dci', { count: Math.round(L / 22), speed: 240, size: 3.2, trailR: 1.0, trailK: 0.5 });
      dataFlows.push(f); data.add(f.group);
    }
    for (let d = 80; d < L - 20; d += 80) huts.push(pointAt(pts, d));
    const mid = pointAt(pts, L / 2);
    const lab = labelSprite(`${Math.round(L).toLocaleString('en-US')} km · ${(L * 0.0049).toFixed(1)} ms`);
    lab.position.set(mid[0], 40, mid[2]); data.add(lab);
    if (!longest || L > longest.L) longest = { L, mid, B };
  });
  const hut = new Builder(); hut.slab(6, 3, 4, MAT.beige, 0, 0, 0); hut.slab(6.4, 0.4, 4.4, MAT.roof, 0, 3, 0); hut.cyl(0.3, 8, MAT.galv, 3.5, 4, 0, 6);
  hut.instance(huts.map(p => mtx(p[0], 0, p[2], Math.atan2(p[0], p[2])))).children.forEach(m => data.add(m));
  const hutGlow = new THREE.InstancedMesh(new THREE.SphereGeometry(2.2, 10, 8), glowMat('#ffd35c', 2.2), huts.length);
  huts.forEach((p, i) => hutGlow.setMatrixAt(i, mtx(p[0], 5, p[2]))); data.add(hutGlow);
  const lt = new Builder(); lt.slab(8, 4, 6, MAT.white, 0, 0, 0); lt.slab(8.4, 0.4, 6.4, glowMat('#ffd35c', 0.9), 0, 4, 0);
  lt.instance([H, ...near.map(({ p }) => world(p.site.lon, p.site.lat))].map(([x, z]) => mtx(x + 20, 0, z - 16))).children.forEach(m => data.add(m));

  const [hx, hz] = H, h0 = huts[3] || huts[0] || [hx, 3, hz], R0 = near[0] ? world(near[0].p.site.lon, near[0].p.site.lat) : [hx + 300, hz];
  const view = (x, z, d = 200) => ({ pos: [x + d * 0.3, d * 0.9, z + d * 1.1], target: [x, 0, z] });
  const siteSpots = Object.fromEntries(others.map(p => { const [x, z] = world(p.site.lon, p.site.lat); return [placeKey(p), { pos: [x, 12, z], view: view(x, z, 240) }]; }));
  return {
    scene, flows, dataFlows, heatFlows: [], layers: { power, data },
    look: { exposure: 1.0, bloom: 0.85, threshold: 0.92, ao: 0, env: 'night', envIntensity: 0.5 },
    camera: { pos: [hx - 120, 1650, hz + 1700], target: [hx + 80, 0, hz + 60], near: 1, far: 30000, min: 60, max: 6000 },
    hotspots: {
      grid: { pos: [(plants[1][0] + hx) / 2, 12, (plants[1][1] + hz) / 2], view: view((plants[1][0] + hx) / 2, (plants[1][1] + hz) / 2, 700) },
      plants: { pos: [plants[0][0], 26, plants[0][1]], view: view(plants[0][0], plants[0][1], 260) },
      home: { pos: [hx, 10, hz], view: view(hx, hz, 220) },
      carbon: (() => { const c = CENTROID[(site || DEFAULT_PLACE).state] || [hx, hz]; return { pos: [c[0], 34, c[1]], view: { pos: [c[0], 1300, c[1] + 1100], target: [c[0], 0, c[1]] } }; })(),
      ...siteSpots,
    },
    heatHotspots: {
      climate: { pos: [hx - 300, 12, hz + 200], view: { pos: [hx - 300, 1400, hz + 1500], target: [hx - 300, 0, hz] } },
      home: { pos: [hx - 40, 10, hz + 40], view: view(hx, hz, 220) },
    },
    dataHotspots: {
      dci: { pos: [hx + 20, 8, hz - 16], view: view(hx + 10, hz - 10, 200) },
      ila: { pos: [h0[0], 9, h0[2]], view: view(h0[0], h0[2], 180) },
      route: { pos: [longest?.mid[0] ?? hx, 60, longest?.mid[2] ?? hz], view: { pos: [(longest?.mid[0] ?? hx) - 100, 900, (longest?.mid[2] ?? hz) + 900], target: [longest?.mid[0] ?? hx, 0, longest?.mid[2] ?? hz] } },
      remote: { pos: [R0[0], 10, R0[1]], view: view(R0[0], R0[1], 260) },
      home: { pos: [hx - 40, 10, hz + 40], view: view(hx, hz, 220) },
    },
    update(t) { plumeUpdates.forEach(u => u(t)); if (turbines) turbines.update(t); },
  };
}
