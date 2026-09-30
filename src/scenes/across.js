import { attachFlowRibbons } from '../flow-ribbons.js';
// Scene 1: scale across, on a real map of the lower 48. World unit = 1 km (Albers equal-area); heights are exaggerated.
// The campus sits at its real site when the scenario is based on one, otherwise at a generic spot in southwest Ohio.
// States with EIA carbon figures are shaded by grams of CO₂ per kWh; the other real campuses are pinned.
// The look is a satellite night image: a dark map lit by city glow, campus and route light, and plant activity
// (steam plumes off nuclear and gas plants, turning wind rotors) rather than daylight.
import { feature, mesh } from 'topojson-client';
import us from 'us-atlas/states-10m.json';
import { THREE, MAT, Builder, mtx, flow, canvasTex, sky, glowMat, spinners } from '../kit.js';
import { rbox, plumes } from '../fx.js';
import { SITES, STATE_CARBON, DEFAULT_PLACE, PLACES, placeKey, albers, greatCircleKm } from '../model/sites.ts';
import { preloadCampusCatalog, campusCatalogInstances } from './campus-blender-catalog.js';
import { preloadAcrossAssets, hasAcrossAssets, acrossAssetInstances, acrossSurfaceGeometry, replaceWindRotor } from './across-blender-assets.js';
export const preload = () => Promise.all([preloadCampusCatalog(), preloadAcrossAssets()]);

const ORIGIN = albers(-92, 37);
const world = (lon, lat) => { const [x, y] = albers(lon, lat); return [x - ORIGIN[0], -(y - ORIGIN[1])]; };
const EXCLUDED = ['02', '15', '60', '66', '69', '72', '78'];
const LOWER48 = feature(us, us.objects.states).features.filter(f => !EXCLUDED.includes(f.id));
const STATES48 = { type: 'GeometryCollection', geometries: us.objects.states.geometries.filter(g => !EXCLUDED.includes(g.id)) };
// coastline (arcs bordering only one state, or a foreign edge) vs interior state-to-state borders, from the
// topology directly, so the glow pass below can tell an actual coast from a state line.
const toWorldLine = coords => coords.map(([lon, lat]) => world(lon, lat));
const COASTLINES = mesh(us, STATES48, (a, b) => a === b).coordinates.map(toWorldLine);
const BORDERS = mesh(us, STATES48, (a, b) => a !== b).coordinates.map(toWorldLine);

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
    const linePath = lines => { g.beginPath(); lines.forEach(line => line.forEach(([x, z], i) => { const px = (x - minX) * sx, pz = (z - minZ) * sz; i ? g.lineTo(px, pz) : g.moveTo(px, pz); })); };
    RINGS.forEach(({ id, rings }) => {
      const c = STATE_CARBON[id];
      path(rings);
      g.fillStyle = '#1b2028'; g.fill('evenodd');                                              // land, a shade warmer than water
      if (c) { g.globalAlpha = 0.62; g.fillStyle = carbonColor(c.g); g.fill('evenodd'); g.globalAlpha = 1; }
    });
    linePath(COASTLINES);                                                                       // border glow: a real coast reads bluer and brighter...
    g.shadowColor = 'rgba(130,175,255,0.6)'; g.shadowBlur = 8;
    g.strokeStyle = 'rgba(170,205,245,0.55)'; g.lineWidth = 1.2; g.stroke();
    g.shadowBlur = 0;
    linePath(BORDERS);                                                                          // ...an interior state line stays dim and neutral
    g.shadowColor = 'rgba(170,180,195,0.28)'; g.shadowBlur = 3;
    g.strokeStyle = 'rgba(190,195,205,0.3)'; g.lineWidth = 1; g.stroke();
    g.shadowBlur = 0;
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
// Map captions are annotations: keep their geographic anchors and move only the caption,
// with a leader whenever screen-space collision avoidance displaces it.
// `reserved` holds screen boxes already taken by the page's own overlays (numbered pins, title, buttons), in the
// canvas's CSS pixels, so a caption steps around them instead of printing over them.
export function layoutMapCaptions(entries, camera, width, height, selected = null, reserved = []) {
  const occupied = [...reserved];
  camera.updateMatrixWorld();
  for (const entry of [...entries].sort((a, b) =>
    (b.main ? 100 : b.key === selected ? 90 : b.priority || 0) - (a.main ? 100 : a.key === selected ? 90 : a.priority || 0))) {
    const { sprite, anchor, leader } = entry;
    const p = anchor.clone().project(camera);
    const eligible = entry.parent.visible && (!entry.route || selected === 'route');
    sprite.visible = eligible && p.z > -1 && p.z < 1 && Math.abs(p.x) < 1.05 && Math.abs(p.y) < 1.05;
    leader.visible = false;
    if (!sprite.visible) continue;
    const w = sprite.scale.x * camera.projectionMatrix.elements[0] * width / 2;
    const h = sprite.scale.y * camera.projectionMatrix.elements[5] * height / 2;
    const x = (p.x + 1) * width / 2, y = (1 - p.y) * height / 2;
    let box = null;
    const tries = [];
    // route distances also try sideways and further out: two routes leaving one campus put their midpoints close
    const dys = entry.route ? [0, -24, 24, -48, 48, -72, 72, -96, 96, -120, 120, -144, 144] : [0, -24, 24, -48, 48, -72, 72, -96, 96];
    for (const dx of entry.route ? [0, -0.6, 0.6] : [0]) for (const dy of dys) tries.push([dx * w, dy]);
    tries.sort((a, b) => Math.hypot(...a) - Math.hypot(...b));
    // the home campus caption never disappears: if every slot is taken it keeps its anchor slot
    if (entry.main) tries.push([0, 0, true]);
    for (const [dx, dy, force] of tries) {
      if (!force && entry.maxShift != null && Math.hypot(dx, dy) > entry.maxShift) continue;
      const cx = Math.max(w / 2 + 8, Math.min(width - w / 2 - 8, x + dx));
      // Reserve the bottom strip for the map scale and canvas controls.
      const cy = Math.max(h / 2 + 8, Math.min(height - h / 2 - 64, y + dy));
      const candidate = [cx - w / 2 - 5, cy - h / 2 - 4, cx + w / 2 + 5, cy + h / 2 + 4];
      if (force || !occupied.some(q => candidate[0] < q[2] && candidate[2] > q[0] && candidate[1] < q[3] && candidate[3] > q[1])) {
        box = candidate;
        sprite.position.set(cx / width * 2 - 1, 1 - cy / height * 2, p.z).unproject(camera);
        sprite.updateMatrixWorld();
        leader.visible = Math.hypot(cx - x, cy - y) > 8;
        leader.geometry.setFromPoints([anchor, sprite.position]);
        break;
      }
    }
    sprite.visible = !!box;
    sprite.userData.screenBox = box;
    if (box) occupied.push(box);
  }
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
// a soft radial falloff, white so instance colors tint it: ground light pools for metros and campuses
let radial = null;
function radialTex() {
  if (radial) return radial;
  radial = canvasTex(128, 128, (g, w) => {
    const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.18, 'rgba(255,255,255,.55)'); r.addColorStop(0.5, 'rgba(255,255,255,.16)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, w);
  });
  radial.wrapS = radial.wrapT = THREE.ClampToEdgeWrapping;
  return radial;
}
// Metro light as it looks from orbit: a warm pool on the ground (20-60 km across by population weight), a scatter
// of street-light points inside it, and a small bright core so bloom still gives a pinpoint from the overview.
function cityLights(quality) {
  const list = quality.mobile ? METROS.slice(0, 18) : METROS;
  const group = new THREE.Group(); group.name = 'Metro night light';
  const pool = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: radialTex(), color: new THREE.Color('#ffc27a').multiplyScalar(1.1), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), list.length);
  const core = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), glowMat('#ffd7a0', 2.4), list.length);
  const M = new THREE.Matrix4(), dots = [];
  let s = 12345; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  list.forEach(([lon, lat, w], i) => {
    const [x, z] = world(lon, lat), size = 20 + Math.min(40, Math.sqrt(w) * 9);
    pool.setMatrixAt(i, M.makeScale(size, 1, size).setPosition(x, 0.25, z));
    core.setMatrixAt(i, mtx(x, 2.5, z, 0, (1.0 + Math.sqrt(w) * 0.5) * 0.4));
    const n = Math.round((quality.mobile ? 18 : 36) * Math.min(1.6, 0.6 + w / 8));
    for (let k = 0; k < n; k++) {                                    // clustered toward the center, like a street grid thinning out
      const a = rnd() * Math.PI * 2, r = size * 0.42 * Math.pow(rnd(), 0.8);
      dots.push(x + Math.cos(a) * r, 0.6, z + Math.sin(a) * r);
    }
  });
  const pts = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(dots, 3)),
    new THREE.PointsMaterial({ color: new THREE.Color('#ffd49a').multiplyScalar(1.6), size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.85, depthWrite: false, fog: false }));
  pool.renderOrder = 1; pool.userData.runtimeOverlay = true; pts.userData.runtimeOverlay = true;
  group.add(pool, core, pts);
  return group;
}


export function build({ quality, model, state = {} }) {
  const authored = hasAcrossAssets();
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

  const ground = new THREE.Mesh(authored ? acrossSurfaceGeometry() : new THREE.PlaneGeometry(MW, MD), new THREE.MeshStandardMaterial({ map: mapTexture(quality.mobile), roughness: 1 }));
  if (authored) ground.scale.set(MW, 1, MD); else ground.rotation.x = -Math.PI / 2;
  ground.position.set((minX + maxX) / 2, 0, (minZ + maxZ) / 2); scene.add(ground);
  const under = new THREE.Mesh(authored ? acrossSurfaceGeometry() : new THREE.PlaneGeometry(30000, 30000), new THREE.MeshStandardMaterial({ color: 0x05070a, roughness: 1 }));
  if (authored) under.scale.set(30000, 1, 30000); else under.rotation.x = -Math.PI / 2;
  under.position.y = -0.5; scene.add(under);

  const power = new THREE.Group(), data = new THREE.Group();
  scene.add(power, data);
  const flows = [], dataFlows = [], heatFlows = [];

  // campuses: exaggerated so they read at this scale, rounded so they read as buildings and not blocks
  const S = new Builder();
  const roofGlow = glowMat('#ffd49a', 1.35);
  const iconRoof = new THREE.MeshStandardMaterial({ color: 0x58687b, roughness: .42, metalness: .55 });
  const iconTrim = new THREE.MeshStandardMaterial({ color: 0xa5b6c4, roughness: .32, metalness: .7 });
  // Night light on every campus symbol, home or remote: a warm apron at the plinth edge, lit roof edges and a
  // clerestory band, and a soft ground halo like the light a large site throws in satellite night imagery.
  // Lighting only; the hall count and footprint stay the shared representative symbol.
  const apronHome = glowMat('#ffb14e', 0.5), apronOther = glowMat('#ffb14e', 0.32);
  const clerestory = glowMat('#ffd49a', 1.2);
  const halos = [], substations = [];
  // where the regional HV lines land: the gantry of the substation symbol beside each campus plinth
  const gantry = ([x, z], k) => [x - 30.5 * k, 6 * k, z];
  const campus = ([x, z], main) => {
    const k = main ? 1 : 0.85;
    halos.push([x, z, (main ? 150 : 125) * k, main ? 1 : 0.8]);
    substations.push(mtx(x - 26 * k, 0, z, 0, k));
    // Local heat rejection on exaggerated campus icons, not regional heat
    // transport, exhaust specifications or a quantified thermal simulation.
    for (const dz of [-6, 6]) {
      const heat = flow([[x + 2 * k, 7, z + dz * k], [x + 2 * k, 18, z + dz * k],
        [x + 5 * k, 30, z + (dz + 3) * k]], 'air',
      { count: 5, speed: 8, size: .75 * k, k: 2.8, opacity: .8, trail: false });
      heatFlows.push(heat); scene.add(heat.group);
    }
    if (authored) {
      scene.add(campusCatalogInstances('MAP_CAMPUS', [mtx(x, 0, z, 0, k)]));
      S.slab(40 * k, 0.3, 32 * k, main ? apronHome : apronOther, x, 0.05, z);
      for (const dz of [-6, 6]) {
        for (const edge of [-1, 1]) S.box(22 * k, .3 * k, .3 * k, roofGlow, x + 2 * k, 5.95 * k, z + (dz + edge * 4.05) * k);
        S.box(22 * k, .45 * k, .1 * k, clerestory, x + 2 * k, 4.3 * k, z + (dz - 4.09) * k);
      }
      return;
    }
    rbox(S, 34 * k, 0.6, 26 * k, MAT.concreteDark, x, 0.3, z, { r: 0.05 });
    for (const dz of [-6, 6]) {
      rbox(S, 24 * k, 5, 8 * k, MAT.wall, x + 2 * k, 3.1, z + dz * k, { r: 0.07 });
      S.slab(24 * k, 0.3, 8 * k, iconRoof, x + 2 * k, 5.6, z + dz * k);
      // Exaggerated landmark icons, not a second site-specific equipment inventory.
      // Edge fixtures preserve the night-map glow while the roof retains physical form.
      for (const edge of [-1, 1]) S.box(24 * k, .18, .25 * k, roofGlow, x + 2 * k, 5.88, z + (dz + edge * 3.9) * k);
      for (let i = 0; i < 7; i++) {
        S.box(.18 * k, 4.5, .3 * k, iconTrim, x + (-8 + i * 3.4) * k, 3.1, z + (dz + 4.05) * k);
      }
      for (let i = 0; i < 4; i++) rbox(S, 2.7 * k, .65, 3 * k, iconTrim, x + (-6 + i * 5.2) * k, 6.23, z + dz * k, { r: .12 });
    }
    rbox(S, 6 * k, 3, 10 * k, MAT.xfmr, x - 14 * k, 2.1, z, { r: 0.08 });
    if (main) S.slab(36, 0.4, 28, glowMat('#ffb14e', 0.65), x, 0.62, z);
  };
  campus(H, true);
  others.forEach(p => campus(world(p.site.lon, p.site.lat), false));
  scene.add(S.build({ cast: false }));
  if (authored) power.add(acrossAssetInstances('MAP_SUBSTATION', substations));
  {
    const tex = radialTex();
    const halo = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color('#ff9a3c').multiplyScalar(0.55), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), halos.length);
    const hm = new THREE.Matrix4();
    halos.forEach(([x, z, size, a], i) => { hm.makeScale(size, 1, size).setPosition(x, 0.2, z); halo.setMatrixAt(i, hm); halo.setColorAt(i, new THREE.Color(a, a, a)); });
    halo.name = 'Campus night-light halo'; halo.renderOrder = 1; halo.userData.runtimeOverlay = true;
    scene.add(halo);
  }
  const mapCaptions = [];
  const caption = (sprite, parent, options = {}) => {
    const leader = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: options.main ? 0xffb14e : 0x91a3b7, transparent: true, opacity: .65, depthTest: false, depthWrite: false }));
    leader.renderOrder = 9; leader.visible = false; parent.add(leader);
    sprite.name = options.route ? 'Map route distance caption' : 'Map campus caption';
    const entry = { sprite, parent, anchor: sprite.position.clone(), leader, ...options };
    mapCaptions.push(entry); return entry;
  };
  const hereLab = labelSprite(here.name, '#ffb14e', 36); hereLab.position.set(H[0], 70, H[1]); scene.add(hereLab);
  caption(hereLab, scene, { main: true, key: 'home' });
  // the other campuses are named by their numbered pins in the power layer; the data layer names them on the map,
  // where they are the far ends of the fiber
  others.forEach(p => { const [x, z] = world(p.site.lon, p.site.lat), l = labelSprite(p.name, '#e8ecf2', 28); l.position.set(x, 52, z); data.add(l); caption(l, data, { key: placeKey(p), priority: 1 / Math.max(1, greatCircleKm(here, p.site)) }); });

  // ---------- power layer: state carbon labels, plants and the HV backbone near this campus ----------
  Object.entries(STATE_CARBON).forEach(([id, c]) => {
    const at = CENTROID[id]; if (!at) return;
    const l = labelSprite(`${c.abbr} ${c.g} g`, carbonColor(c.g), 34); l.position.set(at[0], 30, at[1]); power.add(l);
    // state figures yield to campus names and pins: they shift a little, or drop out where the map is crowded
    caption(l, power, { key: `carbon-${id}`, priority: 0.1, maxShift: 30 });
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
  const GAS_RY = -0.85;
  // a scene-local glass so the shared MAT.glass elsewhere is untouched: a clearcoat catches the key light as a
  // glint, a faint emissive keeps the panels from reading as flat black slabs at night.
  const solarGlass = new THREE.MeshPhysicalMaterial({ color: 0x141c26, roughness: 0.12, metalness: 0.5, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 2.2, emissive: 0x16232f, emissiveIntensity: 0.4 });
  const nuclearEmitters = [], gasEmitters = [], turbineItems = [];
  const plantMatrices = new Map();
  const placePlant = (name, matrix) => { if (!plantMatrices.has(name)) plantMatrices.set(name, []); plantMatrices.get(name).push(matrix); };
  plants.forEach(([x, z, kind]) => {
    if (kind === 'gas') {                                              // combined cycle: turbine hall, two HRSGs, a stack at the end of each
      // turned so the Generation view sees the hall front and the HRSG trains receding at three quarters
      const at = (dx, dz) => [x + dx * Math.cos(GAS_RY) + dz * Math.sin(GAS_RY), z - dx * Math.sin(GAS_RY) + dz * Math.cos(GAS_RY)];
      if (authored) placePlant('GAS_PLANT', mtx(x, 0, z, GAS_RY));
      else {
      const [hx, hz] = at(0, 3); rbox(P, 20, 8.5, 7, MAT.steel, hx, 4.25, hz, { r: 0.05, ry: GAS_RY });
      for (const sx of [-5, 5]) { const [cx, cz] = at(sx, -7.6), [sx2, sz2] = at(sx, -13.6); rbox(P, 3.2, 5.8, 9, MAT.steel, cx, 2.9, cz, { r: 0.05, ry: GAS_RY }); P.cyl(1.2, 18, MAT.galv, sx2, 9, sz2, 12); }
      }
      const [s1x, s1z] = at(-5, -13.6), [s2x, s2z] = at(5, -13.6);
      if (!gasEmitters.length) {                                       // the hero plant only: warm site floodlight, one light for the level
        const [lx, lz] = at(14, 14), flood = new THREE.PointLight(0xffc78a, 600, 110, 1.6);
        flood.position.set(lx, 22, lz); power.add(flood);
      }
      gasEmitters.push({ p: [s1x, 18.2, s1z], dir: [0.15, 1, 0] }, { p: [s2x, 18.2, s2z], dir: [-0.1, 1, 0.1] });
    }
    if (kind === 'nuclear') {                                          // two hyperbolic cooling towers, a containment dome
      const H2 = 34, seg = quality.mobile ? 10 : 18;
      if (authored) placePlant('NUCLEAR_PLANT', mtx(x, 0, z));
      else {
      towerGeo ||= coolingTowerGeo(H2, 15, 9, 12, seg);
      P.addM(towerGeo, MAT.concrete, mtx(x - 17, 0, z)); P.addM(towerGeo, MAT.concrete, mtx(x + 17, 0, z));
      P.cyl(7, 15, MAT.white, x + 42, 7.5, z - 2, 20);
      }
      nuclearEmitters.push({ p: [x - 17, H2, z], dir: [0.1, 1, 0] }, { p: [x + 17, H2, z], dir: [-0.1, 1, 0] });
    }
    if (kind === 'wind') {                                             // three-blade rotors, turning in update()
      // R = 10 on a 16.5 hub; rows 2.5 rotor diameters apart across the wind and 5.5 downwind, each row staggered
      const cols = quality.mobile ? 3 : 4, rows = 2, R = 10;
      for (let i = 0; i < cols * rows; i++) {
        const row = Math.floor(i / cols), tx = x + ((i % cols) - (cols - 1) / 2 + row * 0.5) * 2.5 * 2 * R, tz = z + (row - 0.5) * 5.5 * 2 * R;
        if (!onLand(tx, tz)) continue;                                 // a land farm: drop any turbine the spread puts offshore
        if (authored) placePlant('WIND_MAST', mtx(tx, 0, tz));
        else { P.cyl(0.3, 16, MAT.white, tx, 8, tz, 8); P.box(1.2, 1, 2.4, MAT.white, tx, 16.5, tz - .35); }
        turbineItems.push({ p: [tx, 16.5, tz + 1.05], axis: 'z', r: R });
      }
    }
    // single-axis trackers: rows run north-south, 11 apart for a 4.4-wide module plane (ground coverage about 0.4)
    if (kind === 'solar') for (let i = 0; i < 10; i++) {
      if (!onLand(x - 49.5 + i * 11, z - 30) || !onLand(x - 49.5 + i * 11, z + 30)) continue;   // no rows offshore
      if (authored) placePlant('SOLAR_ROW', mtx(x - 49.5 + i * 11, 0, z));
      else P.box(4.4, 0.2, 60, solarGlass, x - 49.5 + i * 11, 1.6, z, 0, 0, 0.26);
    }
  });
  for (const [name, matrices] of plantMatrices) power.add(acrossAssetInstances(name, matrices));
  // red aviation lights on nacelles and stacks flash together, about 30 times a minute
  const beacons = [];
  power.traverse(o => { if (o.material && /Aviation light|Obstruction light/.test(o.material.name) && !beacons.some(b => b.m === o.material)) beacons.push({ m: o.material, k: o.material.emissiveIntensity }); });
  power.add(P.build({ cast: false }));
  const plumeUpdates = [];
  if (nuclearEmitters.length) { const pl = plumes(nuclearEmitters, { perEmitter: quality.mobile ? 10 : 22, size: 2.2, grow: 5, life: 9, rise: 2.1, drift: [0.4, 0, 0.15], spread: 0.6, color: '#eef3f8', opacity: 0.3 }); power.add(pl.points); plumeUpdates.push(pl.update); }
  if (gasEmitters.length) { const pl = plumes(gasEmitters, { perEmitter: quality.mobile ? 8 : 16, size: 1.6, grow: 4, life: 6, rise: 2.6, drift: [0.5, 0, 0.1], spread: 0.5, color: '#c9cfd6', opacity: 0.28 }); power.add(pl.points); plumeUpdates.push(pl.update); }
  const turbines = turbineItems.length ? spinners(turbineItems, MAT.white, { blades: 3, speed: 1.8 }) : null;
  if (authored && turbines) replaceWindRotor(turbines.mesh);
  if (turbines) power.add(turbines.mesh);
  const HG = gantry(H, 1);
  // Towers every 30 along a line, crossarms square to it. The line hangs from an insulator tip on one side of each
  // tower (1.6 off the centerline at 5.3 up) and sags between towers, instead of threading the tower tops.
  const towerMatrices = [];
  const hvLine = (pts, count) => {
    const L = polyLen(pts), anchors = [pts[0]];
    for (let d = 20; d < L - 12; d += 30) {
      const a = pointAt(pts, d), b = pointAt(pts, d + 1), ry = Math.atan2(b[0] - a[0], b[2] - a[2]);
      towerMatrices.push(mtx(a[0], 0, a[2], ry));
      anchors.push([a[0] + Math.cos(ry) * 1.6, 5.3, a[2] - Math.sin(ry) * 1.6]);
    }
    anchors.push(pts[pts.length - 1]);
    const path = [anchors[0]];
    for (let j = 1; j < anchors.length; j++) {
      const p = anchors[j - 1], q = anchors[j];
      for (let k = 1; k <= 4; k++) { const u = k / 4; path.push([p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u - 0.8 * Math.sin(u * Math.PI), p[2] + (q[2] - p[2]) * u]); }
    }
    const f = flow(path, 'hv', { count, speed: 160, size: 1.4, trailR: .38, trailK: 0.45 });
    flows.push(f); power.add(f.group);
  };
  plants.forEach(([px, pz, kind], i) => {
    const from = kind === 'gas' ? [px + 16 * Math.cos(GAS_RY) + 3 * Math.sin(GAS_RY), pz - 16 * Math.sin(GAS_RY) + 3 * Math.cos(GAS_RY)]
      : kind === 'nuclear' ? [px + 55, pz + 12] : [px, pz];             // gas and nuclear lines leave from their switchyard gantries
    let pts = route(from, [HG[0], HG[2]], 60, 100 + i).map(p => [p[0], 6, p[2]]);
    // a line arriving from the far side swings around the plinth to the gantry instead of crossing the roofs
    const overCampus = pts.some(([x, , z]) => Math.abs(x - H[0]) < 19 && Math.abs(z - H[1]) < 16);
    if (overCampus) {
      const side = Math.sign(from[1] - H[1]) || 1, via = [H[0] - 22, H[1] + side * 26];
      pts = [...route(from, via, 60, 100 + i).map(p => [p[0], 6, p[2]]), [HG[0] - 4, 6, HG[2] + side * 10], [HG[0], 6, HG[2]]];
    }
    hvLine(pts, 18);
  });
  // each remote campus gets a short representative tie-in from its own substation toward the regional grid, so a
  // close view of it shows where its power comes from; the path is illustrative, not a surveyed line
  others.forEach((p, i) => {
    const [x, z] = world(p.site.lon, p.site.lat), G = gantry([x, z], 0.85);
    const a = Math.PI + (i % 2 ? 0.55 : -0.55) + (i - 3) * 0.12;
    const pts = route([G[0] - 3, G[2]], [G[0] + Math.cos(a) * 150, G[2] + Math.sin(a) * 150], 18, 300 + i).map(q => [q[0], 6, q[2]]).reverse();
    pts[pts.length - 1] = [G[0], G[1], G[2]];
    hvLine(pts, 7);
  });
  if (authored) power.add(acrossAssetInstances('GRID_PYLON', towerMatrices));
  else {
    const tb = new Builder(); tb.cyl(0.6, 6, MAT.galv, 0, 3, 0, 5); tb.box(4, 0.4, 0.4, MAT.galv, 0, 6, 0);
    power.add(tb.instance(towerMatrices));
  }

  // ---------- data layer: DWDM routes to the two nearest other campuses ----------
  const near = others.map(p => ({ p, km: greatCircleKm(here, p.site) })).sort((a, b) => a.km - b.km).slice(0, 2);
  const huts = [];
  let longest = null;
  // each line terminal sits on the east edge of its campus plinth; the route ends at a lit fiber-entrance vault
  // on the terminal's outer wall rather than at the campus center
  const terminalAt = ([x, z], k) => [x + 17 * k + 5.4, z - 6 * k];
  const vaultAt = t => [t[0] + 5.3, t[1]];
  const HT = terminalAt(H, 1);
  near.forEach(({ p, km }, i) => {
    const B = world(p.site.lon, p.site.lat), BT = terminalAt(B, 0.85);
    // near the ground: long-haul fiber runs in buried conduit and enters each amplifier hut, rather than overhead
    const pts = route(vaultAt(HT), vaultAt(BT), Math.min(160, km * 0.12), 7 + i * 10).map(q => [q[0], 1.2, q[2]]);
    const L = polyLen(pts);
    // Screen-width cartographic overlay, not a physical cable diameter. The public geographic
    // endpoints, representative wandering path and directional elevations stay unchanged.
    const ink = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map(p => new THREE.Vector3(...p))),
      new THREE.LineBasicMaterial({ color: 0xffcf66, transparent: true, opacity: .72, depthTest: false, depthWrite: false }));
    ink.name = 'Regional fiber route annotation'; ink.renderOrder = 3; data.add(ink);
    for (const dir of [1, -1]) {
      const pp = dir > 0 ? pts : [...pts].reverse().map(q => [q[0], q[1] + 1.5, q[2]]);
      const f = flow(pp, 'dci', { count: Math.round(L / 22), speed: 240, size: 1.4, k: 1.7, trailR: 0.38, trailK: 0.4 });
      // Keep a readable moving map symbol at long range, without a huge marker
      // covering an amplifier shelter when the user inspects it close up.
      const advance = f.update.bind(f), midpoint = new THREE.Vector3(...pointAt(pts, L / 2));
      f.update = (t, projection) => {
        f.size = projection ? Math.max(.65, Math.min(5, projection.position.distanceTo(midpoint) * projection.worldPerPixelAtUnit * 1.65)) : 1.4;
        advance(t, projection);
      };
      f.mesh.material.depthTest = false; f.mesh.renderOrder = 4;
      dataFlows.push(f); data.add(f.group);
    }
    for (let d = 80; d < L - 20; d += 80) huts.push(pointAt(pts, d));
    const mid = pointAt(pts, L / 2);
    // the route itself is invented, so round the distance and read the label as an estimate, not a
    // surveyed span; ms is one-way propagation only (no equipment, routing or queuing), at the same
    // ≈4.9 µs/km assumption used elsewhere, computed from the rounded km so the two numbers agree
    const kmR = Math.round(L / 10) * 10;
    const lab = labelSprite(`≈ ${kmR.toLocaleString('en-US')} km · ≈ ${(kmR * 0.0049).toFixed(1)} ms one way`);
    lab.position.set(mid[0], 40, mid[2]); lab.visible = false; data.add(lab); caption(lab, data, { route: true, priority: 2 - i });   // the nearer route places first
    if (!longest || L > longest.L) longest = { L, mid, B };
  });
  if (authored) {
    data.add(campusCatalogInstances('MAP_HUT', huts.map(p => mtx(p[0], 0, p[2]))));
    data.add(acrossAssetInstances('HUT_SITE', huts.map(p => mtx(p[0], 0, p[2]))));
  } else {
  const hut = new Builder();
  // Representative shelter envelope, raised plinth and service door: no extra amplifier stages.
  rbox(hut, 6, 3, 4, MAT.beige, 0, 1.5, 0, { r: .16 });
  hut.slab(6.5, .25, 4.5, MAT.concreteDark, 0, 0, 0);
  hut.slab(6.4, .22, 4.4, iconTrim, 0, 3, 0);
  hut.box(1.2, 2.3, .05, MAT.darkSteel, 1.5, 1.35, 2.03);
  hut.box(.1, .45, .08, iconTrim, 1.88, 1.45, 2.08);
  for (let y = .65; y < 2.5; y += .25) hut.box(1.9, .09, .1, iconRoof, -1.35, y, 2.02);
  hut.cyl(.3, 8, MAT.galv, 3.5, 4, 0, 6);
  hut.cyl(.16, .14, glowMat('#ffd35c', 1.4), 2.4, 3.3, 1.5, 10);
  data.add(hut.instance(huts.map(p => mtx(p[0], 0, p[2]))));
  }
  const terminals = [HT, ...near.map(({ p }) => terminalAt(world(p.site.lon, p.site.lat), 0.85))];
  const terminalMatrices = terminals.map(([x, z]) => mtx(x, 0, z));
  {
    // gold carries the data layer's color onto the building: a crown strip and the vault the fiber enters by
    const v = new Builder(), gold = glowMat('#ffd35c', 1.6);
    v.box(7, .12, .1, gold, 0, 4.03, 3.36);
    v.slab(.9, .35, 1.1, MAT.darkSteel, 5.3, 0, 0); v.box(1.0, .08, 1.2, gold, 5.3, .39, 0);
    data.add(v.instance(terminalMatrices));
  }
  if (authored) data.add(campusCatalogInstances('MAP_TERMINAL', terminalMatrices));
  else {
    const lt = new Builder(); lt.slab(8, 4, 6, MAT.white, 0, 0, 0); lt.slab(8.4, 0.4, 6.4, glowMat('#ffd35c', 0.9), 0, 4, 0);
    data.add(lt.instance(terminalMatrices));
  }

  if (authored) scene.userData.blenderAcross = {
    completePhysicalGeometry: true, sources: ['across-infrastructure.glb', 'campus-catalog.glb'],
    representative: true, scale: 'Geographic positions follow public map data; facility symbols and heights are exaggerated.',
    runtimeExceptions: ['animated signal and city markers', 'geographic data texture', 'captions and selection', 'sky and plume effects', 'authored rotor motion'],
  };

  const viewport = new THREE.Vector2();
  // the page's overlays inside the view: numbered pins (circle and label), the title block, layer switch, buttons, hint
  const OVERLAYS = '#pins .pin .num, #pins .pin .lbl, #view .hud.tl, #view .hud.tr, #hud-btns .btn, #hud-btns .hint';
  const reservedBoxes = canvas => {
    if (typeof document === 'undefined') return [];
    const c = canvas.getBoundingClientRect(), out = [];
    for (const el of document.querySelectorAll(OVERLAYS)) {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1 || getComputedStyle(el).visibility === 'hidden') continue;
      out.push([r.left - c.left - 3, r.top - c.top - 3, r.right - c.left + 3, r.bottom - c.top + 3]);
    }
    return out;
  };
  scene.onBeforeRender = (renderer, _scene, camera) => {
    renderer.getSize(viewport);
    layoutMapCaptions(mapCaptions, camera, viewport.x, viewport.y, state.selected, reservedBoxes(renderer.domElement));
  };

  const [hx, hz] = H, h0 = huts[3] || huts[0] || [hx, 3, hz], R0 = near[0] ? world(near[0].p.site.lon, near[0].p.site.lat) : [hx + 300, hz];
  const view = (x, z, d = 200) => ({ pos: [x + d * 0.3, d * 0.9, z + d * 1.1], target: [x, 0, z] });
  const siteSpots = Object.fromEntries(others.map(p => { const [x, z] = world(p.site.lon, p.site.lat); return [placeKey(p), { pos: [x, 12, z], view: view(x - 15, z, 300) }]; }));
  const built = {
    scene, flows, dataFlows, heatFlows, layers: { power, data },
    look: { exposure: 1.0, bloom: 0.85, threshold: 0.92, ao: 0, env: 'night', envIntensity: 0.5 },
    camera: { pos: [hx - 220, 1380, hz + 1560], target: [hx - 60, 0, hz + 200], near: 1, far: 30000, min: 60, max: 6000 },
    hotspots: {
      grid: { pos: [(plants[1][0] + hx) / 2, 12, (plants[1][1] + hz) / 2], view: view((plants[1][0] + hx) / 2, (plants[1][1] + hz) / 2, 700) },
      plants: { pos: [plants[0][0] + 5 * Math.cos(GAS_RY) - 7 * Math.sin(GAS_RY), 24, plants[0][1] - 5 * Math.sin(GAS_RY) - 7 * Math.cos(GAS_RY)], view: view(plants[0][0] + 2, plants[0][1] - 4, 95) },
      home: { pos: [hx, 10, hz], view: view(hx - 8, hz, 130) },          // close enough that the lit halls and substation fill the frame
      carbon: (() => { const c = CENTROID[(site || DEFAULT_PLACE).state] || [hx, hz]; return { pos: [c[0], 34, c[1]], view: { pos: [c[0], 1300, c[1] + 1100], target: [c[0], 0, c[1]] } }; })(),
      ...siteSpots,
    },
    heatHotspots: {
      climate: { pos: [hx - 300, 12, hz + 200], view: { pos: [hx - 300, 1400, hz + 1500], target: [hx - 300, 0, hz] } },
      home: { pos: [hx + 2, 12, hz + 6], view: view(hx, hz + 6, 150) },
    },
    dataHotspots: {
      dci: { pos: [HT[0], 8, HT[1]], view: view(HT[0] - 6, HT[1], 110) },
      ila: { pos: [h0[0], 9, h0[2]], view: view(h0[0], h0[2], 60) },
      route: { pos: [longest?.mid[0] ?? hx, 60, longest?.mid[2] ?? hz], view: { pos: [(longest?.mid[0] ?? hx) - 100, 900, (longest?.mid[2] ?? hz) + 900], target: [longest?.mid[0] ?? hx, 0, longest?.mid[2] ?? hz] } },
      remote: { pos: [R0[0], 10, R0[1]], view: view(R0[0] - 10, R0[1], 340) },
      home: { pos: [hx - 40, 10, hz + 40], view: view(hx, hz, 220) },
    },
    update(t) {
      plumeUpdates.forEach(u => u(t)); if (turbines) turbines.update(t);
      const on = (t % 2) < 0.45 ? 1 : 0.12; beacons.forEach(b => { b.m.emissiveIntensity = b.k * on; });
    },
  };
  attachFlowRibbons(built, { width: 2.4, glow: 5.8, brightness: 2.65, mobile: quality.mobile });
  return built;
}
