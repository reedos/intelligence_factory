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
import { tagHeat, balanceHeat } from '../heat.js';
import { SITES, STATE_CARBON, DEFAULT_PLACE, PLACES, placeKey, albers, greatCircleKm } from '../model/sites.ts';
import { preloadCampusCatalog, campusCatalogInstances } from './campus-blender-catalog.js';
import { preloadAcrossAssets, hasAcrossAssets, acrossAssetInstances, acrossSurfaceGeometry, replaceWindRotor } from './across-blender-assets.js';
import { WIND_R, WIND_SCALE, WIND_HUB, windLayout, windFootprint, solarLayout, solarFootprint, SOLAR, placePlants, plantAvoid, METROS, siteSupply, REMOTE_SCALE, compactFootprint } from './across-plants.js';
import { compute } from '../model/engine.ts';
import { campusFootprint, campusBounds, campusHallCells, campusYardItems } from './campus-layout.js';
import { campusRoadPlan } from './campus-road-plan.js';
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
// which state is a point in, if any? (ray casting against every state ring); null is water or abroad
const RING_BOX = new Map(RINGS.flatMap(({ rings }) => rings.map(poly => {
  const r = poly[0], xs = r.map(p => p[0]), zs = r.map(p => p[1]);
  return [poly, [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)]];
})));
function stateAt(x, z) {
  for (const { id, rings } of RINGS) for (const poly of rings) {
    const b = RING_BOX.get(poly); if (x < b[0] || x > b[1] || z < b[2] || z > b[3]) continue;   // cheap reject first
    let inside = false; const r = poly[0];
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, zi] = r[i], [xj, zj] = r[j];
      if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
    }
    if (inside) return id;
  }
  return null;
}
const onLand = (x, z) => stateAt(x, z) !== null;
const SHADED = new Set(Object.keys(STATE_CARBON));                // states the map fills with a carbon color
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

  // campuses: a shrunken copy of each scenario's own campus level (campus-layout.js, the geometry campus.js draws
  // from): the halls in their real count and arrangement, the substation yard, main transformers and e-houses to the
  // west, the cooling towers or chiller plant, the generator, fuel and battery yards, all on a dark ground pad with the
  // campus's own spine and loop roads, and the dusk lighting the campus level has (lit hall edges and apron, road
  // lamps). Everything is plain unit boxes in two instanced meshes plus one lit strip mesh across every campus on
  // screen, so a 5 GW campus costs a few draw calls. The footprint is exaggerated to the old icon's box so it reads at
  // this zoom (ASSUMPTIONS across-campus-miniature): the shape is scenario-accurate, the size is not to the km scale.
  const iconRoof = new THREE.MeshStandardMaterial({ color: 0x58687b, roughness: .42, metalness: .55 });
  const iconTrim = new THREE.MeshStandardMaterial({ color: 0xa5b6c4, roughness: .32, metalness: .7 });
  const halos = [], campusSymbols = [];
  // where the regional HV lines land: the miniature's substation gantry (campus.js: gantryX -548, mid of the two
  // circuits at z -150), keyed by the campus center the callers pass in
  const edgeAt = new Map();                                            // half-extents of each miniature's pad, for the fiber terminals outside it
  const gantryAt = new Map(), gkey = (x, z) => `${x.toFixed(2)},${z.toFixed(2)}`;
  const gantry = ([x, z], k) => gantryAt.get(gkey(x, z)) || [x - 23.6 * k, 4.9 * k, z];
  // heat out of a campus is its power in: the scenario's meter for this campus, each real campus's own (sites.ts)
  const powerDraw = [];
  // instanced across every campus, filled in by campus() below, drawn once after the loop
  const unit = new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0);
  const hallMx = [], yardMx = [], yardCol = [], litMx = [], litCol = [];
  let yo = 0, ncampus = 0;                                              // a hair of height per campus so neighbours never share a plane
  const yardBox = (x, z, w, d, h, hex, y = 0) => { y += yo; yardMx.push(new THREE.Matrix4().makeScale(w, h, d).setPosition(x, y, z)); yardCol.push(new THREE.Color(hex)); };
  const litBox = (x, z, w, d, h, col, y = 0) => { litMx.push(new THREE.Matrix4().makeScale(w, h, d).setPosition(x, y + yo, z)); litCol.push(col); };
  const YARD = { pad: 0x80858a, bus: 0xc9d0d4, xfmr: 0x4a5560, ehouse: 0xe4e8ea, tower: 0xd5dadd, tank: 0xe4e8ea, plant: 0xe4e8ea, genset: 0xb3a58c, fuel: 0xeef0f0, bess: 0xdfe4e6 };
  const campus = ([x, z], main, watts, id, campusModel) => {
    const k = main ? 1 : 0.85;
    // the power layer's glow (src/power-glow.js): each campus hugged by its meter power, the heat streams' watts
    powerDraw.push({ id, part: id, watts, at: [x, 0.2, z], size: [40 * k, 32 * k], margin: 36 });
    halos.push([x, z, (main ? 150 : 125) * k, main ? 1 : 0.8]);
    // Local heat rejection on exaggerated campus icons, not regional heat
    // transport, exhaust specifications or a quantified thermal simulation.
    for (const dz of [-6, 6]) {
      const heat = flow([[x + 2 * k, 7, z + dz * k], [x + 2 * k, 18, z + dz * k],
        [x + 5 * k, 30, z + (dz + 3) * k]], 'air',
      { count: 5, speed: 8, size: .75 * k, k: 2.8, opacity: .8, trail: false });
      heatFlows.push(tagHeat(heat, id, watts)); scene.add(heat.group);
    }
    yo = (ncampus++ % 17) * 0.05;
    const F = campusFootprint(campusModel), B = campusBounds(F), L = campusModel.layout;
    const bw = Math.max(1, B.x1 - B.x0), bd = Math.max(1, B.z1 - B.z0);
    const sc = k * Math.min(56 / bw, 45 / bd);                         // fit the real footprint into the old icon's box
    const refX = (B.x0 + B.x1) / 2, refZ = (B.z0 + B.z1) / 2;
    const toX = rx => x + (rx - refX) * sc, toZ = rz => z + (rz - refZ) * sc;
    const VX = 5, E = 3;                                             // heights read like the rest of the map; small equipment drawn wider
    const glow = main ? new THREE.Color(1, .72, .34) : new THREE.Color(.78, .52, .24);
    // the HV landing: the real substation's gantry, and a tiny anchor instance there for the line routing/tests
    const gp = [toX(F.gantryX), 4.9 * k, toZ(-150)];
    gantryAt.set(gkey(x, z), gp);
    edgeAt.set(gkey(x, z), [(bw / 2 + 14) * sc, (bd / 2 + 14) * sc]);
    if (authored) campusSymbols.push(mtx(gp[0], 0, gp[2], 0, 0.001));
    // ground: the dark site pad, then the campus's own roads from its road plan, clipped to the pad
    const pad = 14;
    yardBox(toX(refX), toZ(refZ), (bw + 2 * pad) * sc, (bd + 2 * pad) * sc, .1, 0x2f5a3c);
    const plan = campusRoadPlan({ extra: F.extra, perCol: F.perCol, cols: F.cols, hallX1: F.hallX1, nHalls: F.nHalls, batteryYard: F.batteryYard, gensets: L.gensets });
    const lampStep = 70;
    for (const s of plan.segments) {
      if (s.id === 'public road') continue;
      const [ax, az] = s.a, [bx, bz] = s.b, horiz = Math.abs(az - bz) < 1e-6;
      const lo = horiz ? Math.max(Math.min(ax, bx), B.x0 - pad) : Math.max(Math.min(az, bz), B.z0 - pad);
      const hi = horiz ? Math.min(Math.max(ax, bx), B.x1 + pad) : Math.min(Math.max(az, bz), B.z1 + pad);
      if (hi - lo < 4) continue;
      const w = Math.max(s.width * sc * 1.6, .22 * k);
      if (horiz) yardBox(toX((lo + hi) / 2), toZ(az), (hi - lo) * sc, w, .14, 0x70767d, .17); else yardBox(toX(ax), toZ((lo + hi) / 2), w, (hi - lo) * sc, .14, 0x70767d, .17);
      // road lamps along the spine and the loops: small warm lit dots
      for (let t = lo + lampStep / 2; t < hi; t += lampStep) litBox(horiz ? toX(t) : toX(ax) + w * .7, horiz ? toZ(az) + w * .7 : toZ(t), .3 * k, .3 * k, .35 * k, glow.clone().multiplyScalar(1.8), .3);
    }
    // the halls: the real cells (detailed pair plus any repeated expansion halls), pale roofs, lit edges and apron
    campusHallCells(F).forEach((c, ci) => {
      const w = c.len * sc, d = 90 * sc, h = 22 * sc * VX, cx = toX(c.x), cz = toZ(c.z);
      hallMx.push(new THREE.Matrix4().makeScale(w, h, d).setPosition(cx, .16, cz));
      if (ci < F.nHalls) litBox(cx, cz, w * 1.1, d * 1.35, .05, glow.clone().multiplyScalar(.9), .3);                    // the apron glow
      for (const e of [-1, 1]) litBox(cx, cz + e * d * .5, w, .3 * k, .3 * k, glow.clone().multiplyScalar(ci < F.nHalls ? 2 : .9), h + .02);      // lit roof edges
    });
    // the yards, where the campus level has them
    let padN = 0;
    for (const it of campusYardItems(F, L)) {
      const w = it.kind === 'pad' || it.kind === 'plant' || it.kind === 'ehouse' || it.kind === 'bus' ? it.w * sc : Math.max(it.w * sc * E, .18 * k);
      const d = it.kind === 'pad' || it.kind === 'plant' || it.kind === 'ehouse' || it.kind === 'bus' ? it.d * sc : Math.max(it.d * sc * E, .18 * k);
      yardBox(toX(it.x), toZ(it.z), w, d, it.kind === 'pad' ? it.h * sc * VX : Math.max(it.h * sc * VX * (it.kind === 'xfmr' ? 1 : .8), .1 * k), YARD[it.kind], it.kind === 'pad' ? .17 : .5);
    }
  };
  campus(H, true, model.meterMW * 1e6, 'home', model);
  others.forEach(p => campus(world(p.site.lon, p.site.lat), false, p.ids.reduce((w, id) => w + SITES[id].scenario.meterMW * 1e6, 0), placeKey(p),
    compute({ ...SITES[p.ids[0]].scenario, site: p.ids[0] })));
  balanceHeat(heatFlows);
  if (authored) scene.add(campusCatalogInstances('MAP_CAMPUS', campusSymbols));    // anchor-only: where the HV lines land
  {
    // lit materials so the miniature takes the map's light, plus a little emission so it stays readable at night
    const mk = (n, mat, mats, cols) => {
      const m = new THREE.InstancedMesh(unit, mat, mats.length); m.name = n;
      mats.forEach((mm, i) => { m.setMatrixAt(i, mm); if (cols) m.setColorAt(i, cols[i]); });
      m.castShadow = m.receiveShadow = false; m.frustumCulled = false; return m;
    };
    const group = new THREE.Group(); group.name = 'Mini campus halls';
    group.add(mk('Mini hall roofs', new THREE.MeshLambertMaterial({ color: 0xf0f3f5, emissive: 0x4c535a }), hallMx));
    scene.add(group);
    const yards = mk('Mini campus yards', new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x24282c }), yardMx, yardCol); yards.name = 'Mini campus yards';
    const lit = mk('Mini campus lights', new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), litMx, litCol);
    scene.add(yards, lit);
  }
  {
    const tex = radialTex();
    const halo = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color('#ff9a3c').multiplyScalar(0.3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), halos.length);
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
  // illustrative plants around the campus on land; the wide ones (a wind farm, a solar array) are set down whole
  // inside one lit state, clear of the campus and the other plants, so no part of them lands on water or on an
  // unshaded state that reads as water
  const windAt = windLayout(quality.mobile), solar = solarLayout(quality.mobile);
  const footprints = { wind: windFootprint(windAt), solar: solarFootprint(solar) };
  const plants = placePlants({ H, around, footprints, stateAt, shaded: SHADED, avoid: plantAvoid(world, PLACES.map(p => p.site)) });
  let towerGeo = null;
  const GAS_RY = -0.85;
  // a scene-local glass so the shared MAT.glass elsewhere is untouched: a clearcoat catches the key light as a
  // glint, a faint emissive keeps the panels from reading as flat black slabs at night.
  const solarGlass = new THREE.MeshPhysicalMaterial({ color: 0x141c26, roughness: 0.12, metalness: 0.5, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 2.2, emissive: 0x16232f, emissiveIntensity: 0.4 });
  const nuclearEmitters = [], gasEmitters = [], turbineItems = [];
  const plantMatrices = new Map();
  const sites = [];                                    // every plant symbol's placement, drawn or not (line detours)
  const placePlant = (name, matrix) => { if (!plantMatrices.has(name)) plantMatrices.set(name, []); plantMatrices.get(name).push(matrix); };
  plants.forEach(([x, z, kind]) => {
    if (kind === 'gas') {                                              // combined cycle: turbine hall, two HRSGs, a stack at the end of each
      // turned so the Generation view sees the hall front and the HRSG trains receding at three quarters
      const at = (dx, dz) => [x + dx * Math.cos(GAS_RY) + dz * Math.sin(GAS_RY), z - dx * Math.sin(GAS_RY) + dz * Math.cos(GAS_RY)];
      sites.push(['GAS_PLANT', mtx(x, 0, z, GAS_RY)]);                          // drawn or not (line detours)
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
      sites.push(['NUCLEAR_PLANT', mtx(x, 0, z)]);
      if (authored) placePlant('NUCLEAR_PLANT', mtx(x, 0, z));
      else {
      towerGeo ||= coolingTowerGeo(H2, 15, 9, 12, seg);
      P.addM(towerGeo, MAT.concrete, mtx(x - 17, 0, z)); P.addM(towerGeo, MAT.concrete, mtx(x + 17, 0, z));
      P.cyl(7, 15, MAT.white, x + 42, 7.5, z - 2, 20);
      }
      nuclearEmitters.push({ p: [x - 17, H2, z], dir: [0.1, 1, 0] }, { p: [x + 17, H2, z], dir: [-0.1, 1, 0] });
    }
    if (kind === 'wind') {                                             // three-blade rotors, turning in update()
      // the authored turbine at 0.6 scale; a dense farm of staggered rows (across-plants.js has the spacing)
      for (const [ox, oz] of windAt) {
        const tx = x + ox, tz = z + oz;
        if (!onLand(tx, tz)) continue;                                 // a land farm: drop any turbine still offshore
        if (authored) placePlant('WIND_MAST', mtx(tx, 0, tz, 0, WIND_SCALE));
        else { P.cyl(0.3 * WIND_SCALE, WIND_HUB, MAT.white, tx, WIND_HUB / 2, tz, 8); P.box(1.2 * WIND_SCALE, WIND_SCALE, 2.4 * WIND_SCALE, MAT.white, tx, WIND_HUB, tz - .35 * WIND_SCALE); }
        turbineItems.push({ p: [tx, WIND_HUB, tz + 1.05 * WIND_SCALE], axis: 'z', r: WIND_R });
      }
    }
    // single-axis tracker rows running north-south in blocks between gravel roads, an inverter skid per block
    // (across-plants.js has the layout); a row is dropped only if some part of it would still stand off land
    if (kind === 'solar') {
      const half = SOLAR.rowL / 2;
      for (const [ox, oz] of solar.rows) {
        const rx = x + ox, rz = z + oz;
        if (![-1, -0.5, 0, 0.5, 1].every(t => onLand(rx, rz + t * half))) continue;
        if (authored) placePlant('SOLAR_ROW', mtx(rx, 0, rz));
        else P.box(SOLAR.rowW, 0.12, SOLAR.rowL, solarGlass, rx, 1.1, rz, 0, 0, 0.26);
      }
      if (authored) {
        for (const [ox, oz] of solar.skids) placePlant('SOLAR_SKID', mtx(x + ox, 0, z + oz));
        for (const r of solar.roads) placePlant('SOLAR_ROAD', new THREE.Matrix4().makeScale(r.w, 1, r.l).setPosition(x + r.x, 0, z + r.z));
      }
    }
  });
  // ---------- each remote campus's own supply ----------
  // Every remote campus draws its power from something drawn on the map: generation its site facts report beside it,
  // wired straight to its gantry, and where it takes grid power, a utility substation near it fed by the reported
  // grid source or else the state's leading sources (across-plants.js, siteSupply). Smaller symbols than the home
  // campus's plants, set on land clear of every campus, city glow and the home plants.
  const remoteWind = windLayout(quality.mobile, [4, 2]);
  const remoteFoot = { gas: compactFootprint('gas'), coal: compactFootprint('coal'), nuclear: compactFootprint('nuclear'), sub: compactFootprint('sub'), wind: windFootprint(remoteWind) };
  const reach = kind => Math.max(...remoteFoot[kind].map(([a, b]) => Math.hypot(a, b)));
  const occupied = [[...H, 45], ...PLACES.map(p => [...world(p.site.lon, p.site.lat), 45]), ...plantAvoid(world, []),
    ...[...SHADED].filter(id => CENTROID[id]).map(id => [...CENTROID[id], 30]),                 // the state carbon labels
    ...plants.map(([x, z, kind]) => [x, z, kind === 'nuclear' ? 90 : kind === 'gas' ? 45 : Math.max(...footprints[kind].map(([a, b]) => Math.hypot(a, b)))])];
  const facing = (from, to) => Math.atan2(-(to[1] - from[1]), to[0] - from[0]);   // turns a symbol's +x toward `to`
  const local = (x, z, ry, s) => (lx, lz) => [x + s * (lx * Math.cos(ry) + lz * Math.sin(ry)), z + s * (-lx * Math.sin(ry) + lz * Math.cos(ry))];
  const remote = others.map(p => {
    const C = world(p.site.lon, p.site.lat), G = gantry(C, 0.85), supply = siteSupply(p.ids[0], p.site.state);
    // keep clear of the campus's pin label too, which reads to the right (+x) of the campus
    const avoid = [...occupied.filter(([x, z]) => Math.hypot(x - C[0], z - C[1]) > 1), [C[0] + 40, C[1] - 6, 24], [C[0] + 85, C[1] - 6, 24]];
    const put = (at, around, clear) => placePlants({ H: at, around, footprints: remoteFoot, stateAt, shaded: SHADED, avoid, clear })
      .map(([x, z, kind]) => { avoid.push([x, z, reach(kind)]); occupied.push([x, z, reach(kind)]); return { kind, x, z }; });
    // on-site plants stand just off the campus's gantry side (-x), one a little north and one south
    const onsite = put(C, supply.onsite.map((kind, j) => [-44, (j ? -1 : 1) * 30, kind]), 18);
    let sub = null, grid = [];
    if (supply.grid.length) {
      const side = onsite.length === 1 ? -Math.sign(onsite[0].z - C[1]) || 1 : 1;
      [sub] = put(C, [[-70, side * 20, 'sub']], 20);
      const u = [sub.x - C[0], sub.z - C[1]], L = Math.hypot(...u), ux = u[0] / L, uz = u[1] / L;
      // the grid plants stand beyond the substation, away from the campus, fanned when there are two
      grid = put([sub.x, sub.z], supply.grid.map((kind, j, all) => {
        const a = all.length > 1 ? (j ? -0.55 : 0.55) : 0, d = kind === 'wind' ? 95 : kind === 'nuclear' ? 85 : 70;
        return [d * (ux * Math.cos(a) - uz * Math.sin(a)), d * (ux * Math.sin(a) + uz * Math.cos(a)), kind];
      }), 16);
      sub.ry = facing([sub.x, sub.z], [G[0], G[2]]);
      grid.forEach(q => { q.ry = facing([q.x, q.z], [sub.x, sub.z]); });
    }
    onsite.forEach(q => { q.ry = facing([q.x, q.z], [G[0], G[2]]); });
    return { p, C, G, onsite, sub, grid };
  });
  for (const { onsite, sub, grid } of remote) for (const q of [...onsite, ...grid, ...(sub ? [sub] : [])]) {
    const s = REMOTE_SCALE[q.kind] ?? 1, at = local(q.x, q.z, q.ry, s);
    if (q.kind === 'wind') {
      for (const [ox, oz] of remoteWind) {
        const tx = q.x + ox, tz = q.z + oz;
        if (!onLand(tx, tz)) continue;
        if (authored) placePlant('WIND_MAST', mtx(tx, 0, tz, 0, WIND_SCALE));
        else P.cyl(0.3 * WIND_SCALE, WIND_HUB, MAT.white, tx, WIND_HUB / 2, tz, 8);
        turbineItems.push({ p: [tx, WIND_HUB, tz + 1.05 * WIND_SCALE], axis: 'z', r: WIND_R });
      }
      continue;
    }
    const asset = { gas: 'GAS_PLANT', coal: 'COAL_PLANT', nuclear: 'NUCLEAR_PLANT', sub: 'GRID_SUBSTATION' }[q.kind];
    sites.push([asset, mtx(q.x, 0, q.z, q.ry, s)]);
    if (authored) placePlant(asset, mtx(q.x, 0, q.z, q.ry, s));
    else if (q.kind === 'sub') P.box(22 * s, 0.3, 16 * s, MAT.concreteDark, q.x, 0.16, q.z, q.ry);
    else P.box(18 * s, (q.kind === 'coal' ? 20 : 8.5) * s, 9 * s, MAT.steel, q.x, (q.kind === 'coal' ? 10 : 4.25) * s, q.z, q.ry);
    if (q.kind === 'gas') for (const lx of [-5, 5]) { const [ex, ez] = at(lx, -13.6); gasEmitters.push({ p: [ex, 18.2 * s, ez], dir: [0.1, 1, 0] }); }
    if (q.kind === 'coal') { const [ex, ez] = at(-14, -12); gasEmitters.push({ p: [ex, 34 * s, ez], dir: [0.1, 1, 0] }); }
    if (q.kind === 'nuclear') for (const lx of [-17, 17]) { const [ex, ez] = at(lx, 0); nuclearEmitters.push({ p: [ex, 34 * s, ez], dir: [0.1, 1, 0] }); }
  }
  for (const [name, matrices] of plantMatrices) power.add(acrossAssetInstances(name, matrices));
  // red aviation lights on nacelles and stacks flash together, about 30 times a minute
  const beacons = [];
  power.traverse(o => { if (o.material && /aviation light|obstruction light/i.test(o.material.name) && !beacons.some(b => b.m === o.material)) beacons.push({ m: o.material, k: o.material.emissiveIntensity }); });
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
  // A line is one or more legs: a line through a substation runs plant -> in-gantry, across the yard, then
  // out-gantry -> campus, with towers along each leg long enough to need them (none inside the yard).
  // Plant symbols a line must go around, not through (its own source and destination excepted: a leg's ends stay put)
  const blockers = [], _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
  const reachOf = { COAL_PLANT: 32, GAS_PLANT: 26, NUCLEAR_PLANT: 62, GRID_SUBSTATION: 16 };   // symbol half-extent at scale 1
  for (const [name, m] of sites) if (reachOf[name]) { m.decompose(_p, _q, _s); blockers.push([_p.x, _p.z, reachOf[name] * _s.x]); }
  // A leg that would pass over a plant symbol bows smoothly around it (a bell-shaped sideways shift over a few
  // points either side), so the towers and the straight spans between them clear it too.
  const detour = leg => {
    const out = leg.map(p => [...p]), n = out.length;
    for (const [bx, bz, r] of blockers) {
      if ([out[0], out[n - 1]].some(e => Math.hypot(e[0] - bx, e[2] - bz) < r + 8)) continue;   // its own source or destination
      let k = -1, dmin = Infinity;
      for (let i = 1; i < n - 1; i++) { const d = Math.hypot(out[i][0] - bx, out[i][2] - bz); if (d < dmin) { dmin = d; k = i; } }
      const R = r + 14; if (k < 0 || dmin >= R) continue;
      const a = out[Math.max(0, k - 1)], c = out[Math.min(n - 1, k + 1)], tx = c[0] - a[0], tz = c[2] - a[2], tl = Math.hypot(tx, tz) || 1;
      let nx = -tz / tl, nz = tx / tl;                                  // away from the symbol's side
      if (nx * (out[k][0] - bx) + nz * (out[k][2] - bz) < 0) { nx = -nx; nz = -nz; }
      const push = R - (nx * (out[k][0] - bx) + nz * (out[k][2] - bz)), span = 4;
      for (let i = Math.max(1, k - span); i <= Math.min(n - 2, k + span); i++) {
        const w = 0.5 + 0.5 * Math.cos(Math.PI * (i - k) / (span + 1));
        out[i][0] += nx * push * w; out[i][2] += nz * push * w;
      }
    }
    return out;
  };
  const hvLine = (pts, count, { legs: rawLegs = [pts], trail = true } = {}) => {
    const legs = rawLegs.map(detour);
    const anchors = [legs[0][0]];
    for (const leg of legs) {
      const L = polyLen(leg);
      for (let d = 20; d < L - 12; d += 30) {
        const a = pointAt(leg, d), b = pointAt(leg, d + 1), ry = Math.atan2(b[0] - a[0], b[2] - a[2]);
        towerMatrices.push(mtx(a[0], 0, a[2], ry));
        anchors.push([a[0] + Math.cos(ry) * 1.6, 5.3, a[2] - Math.sin(ry) * 1.6]);
      }
      anchors.push(leg[leg.length - 1]);
    }
    const path = [anchors[0]];
    for (let j = 1; j < anchors.length; j++) {
      const p = anchors[j - 1], q = anchors[j];
      for (let k = 1; k <= 4; k++) { const u = k / 4; path.push([p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u - 0.8 * Math.sin(u * Math.PI), p[2] + (q[2] - p[2]) * u]); }
    }
    const f = flow(path, 'hv', { count, speed: 160, size: 1.4, trailR: .38, trailK: 0.45, trail });
    flows.push(f); power.add(f.group);
  };
  const farmEdge = (px, pz, pts, to = H) => {
    let best = null, d = Infinity;
    for (const [ox, oz] of pts) { const e = Math.hypot(px + ox - to[0], pz + oz - to[1]); if (e < d) { d = e; best = [px + ox, pz + oz]; } }
    const ux = (to[0] - best[0]) / d, uz = (to[1] - best[1]) / d;
    return [best[0] + ux * (WIND_R + 4), best[1] + uz * (WIND_R + 4)]; // just outside the rotor, toward the campus
  };
  // the array's line leaves from the inverter skid nearest the campus, out through the ring road
  const arrayEdge = (px, pz) => {
    let best = null, d = Infinity;
    for (const [ox, oz] of solar.skids) { const e = Math.hypot(px + ox - H[0], pz + oz - H[1]); if (e < d) { d = e; best = [ox, oz]; } }
    const ex = Math.sign(H[0] - px) * (solar.W / 2 + 2), ez = Math.sign(H[1] - pz) * (solar.L / 2 + 2);
    // step outside the array along whichever axis the campus lies farther along
    return Math.abs(H[0] - px) / solar.W > Math.abs(H[1] - pz) / solar.L ? [px + ex, pz + best[1]] : [px + best[0], pz + ez];
  };
  plants.forEach(([px, pz, kind], i) => {
    const from = kind === 'gas' ? [px + 16 * Math.cos(GAS_RY) + 3 * Math.sin(GAS_RY), pz - 16 * Math.sin(GAS_RY) + 3 * Math.cos(GAS_RY)]
      : kind === 'nuclear' ? [px + 55, pz + 12]                         // gas and nuclear lines leave from their switchyard gantries
      : kind === 'wind' ? farmEdge(px, pz, windAt)                      // the wind farm's from the turbine nearest the campus,
      : kind === 'solar' ? arrayEdge(px, pz) : [px, pz];                // the solar array's from the skid nearest the campus
    let pts = route(from, [HG[0], HG[2]], 60, 100 + i).map(p => [p[0], 6, p[2]]);
    // a line arriving from the far side swings around the plinth to the gantry instead of crossing the roofs
    const overCampus = pts.some(([x, , z]) => Math.abs(x - H[0]) < 19 && Math.abs(z - H[1]) < 16);
    if (overCampus) {
      const side = Math.sign(from[1] - H[1]) || 1, via = [H[0] - 22, H[1] + side * 26];
      pts = [...route(from, via, 60, 100 + i).map(p => [p[0], 6, p[2]]), [HG[0] - 4, 6, HG[2] + side * 10], [HG[0], 6, HG[2]]];
    }
    hvLine(pts, 18);
  });
  // Remote campus lines: each leaves a drawn source's line gantry and lands on a campus gantry, through the
  // substation's two gantries when it comes from the grid. Their paths are illustrative, not surveyed lines. The
  // ribbon overlay already draws each route, so these short lines skip the tube trail (one draw each, not two).
  const lift = ([x, z], y = 6) => [x, y, z];
  const leaves = (q, s) => {                                           // where a source's line leaves it
    if (q.kind === 'wind') return null;
    const at = local(q.x, q.z, q.ry, s);
    return q.kind === 'nuclear' ? at(55, 12) : at(16, 3);             // the switchyard gantry of each plant symbol
  };
  remote.forEach(({ G, onsite, sub, grid }, i) => {
    const end = [G[0], G[1], G[2]], gz = [G[0], G[2]];
    onsite.forEach((q, j) => {
      const from = leaves(q, REMOTE_SCALE[q.kind]);
      const pts = route(from, gz, 8, 300 + i * 7 + j).map(r => [r[0], 6, r[2]]);
      pts[pts.length - 1] = end;
      hvLine(pts, 5, { trail: false });
    });
    if (!sub) return;
    const ss = REMOTE_SCALE.sub, at = local(sub.x, sub.z, sub.ry, ss), gIn = lift(at(-9.5, 0), 6.5 * ss), gOut = lift(at(9.5, 0), 6.5 * ss);   // under the gantry beam (at 7), on its insulators
    const out = route([gOut[0], gOut[2]], gz, 10, 340 + i).map(r => [r[0], 6, r[2]]); out[0] = gOut; out[out.length - 1] = end;
    grid.forEach((q, j) => {
      const from = q.kind === 'wind' ? farmEdge(q.x, q.z, remoteWind, [gIn[0], gIn[2]]) : leaves(q, REMOTE_SCALE[q.kind]);
      const inn = route(from, [gIn[0], gIn[2]], 14, 320 + i * 7 + j).map(r => [r[0], 6, r[2]]); inn[inn.length - 1] = gIn;
      // the first plant's line runs on through the yard to the campus; a second one ends at the substation
      if (j === 0) hvLine(null, 7, { legs: [inn, [gIn, gOut], out], trail: false });
      else hvLine(inn, 5, { trail: false });
    });
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
  const terminalAt = ([x, z], k, side = 1) => [x + side * (Math.max(edgeAt.get(gkey(x, z))?.[0] ?? 0, 17 * k) + 5.4), z - 6 * k];
  // a far campus's terminal stands on the side its route arrives from, so the fiber reaches its vault without
  // crossing the building (east of the campus for a route from the east, west for one from the west)
  const farSide = B => (H[0] >= B[0] ? 1 : -1);
  const vaultAt = (t, north = false, side = 1) => north ? [t[0], t[1] - 5.3] : [t[0] + 5.3 * side, t[1]];
  // This campus takes its two routes through two terminals on different sides of its plinth, as the campus level draws
  // its two fiber entrances (diverse entrances, at least 20 m apart: VA OIT telecom infrastructure standard after
  // TIA-942). The northernmost route leaves by the north terminal, the other by the east one; the west side is the
  // grid's (the substation and the incoming lines).
  const HT = terminalAt(H, 1), HN = [H[0] + 6, H[1] - (Math.max(edgeAt.get(gkey(H[0], H[1]))?.[1] ?? 0, 16) + 5)];
  const northFirst = near.map(({ p }, i) => [world(p.site.lon, p.site.lat)[1], i]).sort((a, b) => a[0] - b[0])[0]?.[1];
  const homeFor = i => near.length > 1 && i === northFirst ? { t: HN, north: true } : { t: HT, north: false };
  near.forEach(({ p, km }, i) => {
    const B = world(p.site.lon, p.site.lat), bs = farSide(B), BT = terminalAt(B, 0.85, bs), home = homeFor(i);
    // near the ground: long-haul fiber runs in buried conduit and enters each amplifier hut, rather than overhead
    const pts = route(vaultAt(home.t, home.north), vaultAt(BT, false, bs), Math.min(160, km * 0.12), 7 + i * 10).map(q => [q[0], 1.25, q[2]]);
    const L = polyLen(pts);
    // Screen-width cartographic overlay, not a physical cable diameter. The public geographic
    // endpoints, representative wandering path and directional elevations stay unchanged.
    const ink = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map(p => new THREE.Vector3(...p))),
      new THREE.LineBasicMaterial({ color: 0xffcf66, transparent: true, opacity: .72, depthTest: false, depthWrite: false }));
    ink.name = 'Regional fiber route annotation'; ink.renderOrder = 3; data.add(ink);
    for (const dir of [1, -1]) {
      const pp = dir > 0 ? pts : [...pts].reverse().map(q => [q[0], q[1] + 1.5, q[2]]);
      // the fiber enters each in-line amplifier hut on its route (see above), so it passes through them on purpose
      const f = flow(pp, 'dci', { count: Math.round(L / 22), speed: 240, size: 1.4, k: 1.7, trailR: 0.38, trailK: 0.4, audit: { through: /MAP_HUT|HUT_SITE/, why: 'the fiber runs through each in-line amplifier hut' } });
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
  const farTerminals = near.map(({ p }) => { const B = world(p.site.lon, p.site.lat), bs = farSide(B); return { t: terminalAt(B, 0.85, bs), ry: bs < 0 ? Math.PI : 0 }; });
  const terminals = [HT, ...(near.length > 1 ? [HN] : []), ...farTerminals.map(f => f.t)];
  // the north terminal is the east one turned a quarter, so its vault faces north toward its route
  const homeCount = near.length > 1 ? 2 : 1;
  const terminalMatrices = terminals.map(([x, z], i) => mtx(x, 0, z, i === 1 && homeCount === 2 ? Math.PI / 2 : i >= homeCount ? farTerminals[i - homeCount].ry : 0));
  scene.userData.campusTerminals = { east: HT, north: near.length > 1 ? HN : null, diverse: near.length > 1 };
  // gold carries the data layer's color onto the building: the terminal's own crown fixture (MAP_TERMINAL) and
  // the vault the fiber enters by (TERMINAL_TRIM)
  if (authored) data.add(acrossAssetInstances('TERMINAL_TRIM', terminalMatrices));
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
  const OVERLAYS = '#pins .pin .num, #pins .pin .lbl, #pins .pin-group, #view .hud.tl, #view .hud.tr, #hud-btns .btn, #view .hint';
  const reservedBoxes = canvas => {
    if (typeof document === 'undefined' || !document.querySelectorAll || !canvas?.getBoundingClientRect) return [];
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
    scene, flows, dataFlows, heatFlows, layers: { power, data }, powerDraw,
    look: { exposure: 1.0, bloom: 0.85, threshold: 0.92, ao: 0, env: 'night', envIntensity: 0.5 },
    camera: { pos: [hx - 220, 1380, hz + 1560], target: [hx - 60, 0, hz + 200], near: 1, far: 30000, min: 60, max: 6000 },
    hotspots: {
      grid: { pos: [(plants[1][0] + hx) / 2, 12, (plants[1][1] + hz) / 2], view: view((plants[1][0] + hx) / 2, (plants[1][1] + hz) / 2, 700) },
      plants: { pos: [plants[0][0] + 5 * Math.cos(GAS_RY) - 7 * Math.sin(GAS_RY), 24, plants[0][1] - 5 * Math.sin(GAS_RY) - 7 * Math.cos(GAS_RY)], view: view(plants[0][0] + 2, plants[0][1] - 4, 95) },
      home: { pos: [hx, 10, hz], mapNamed: true, view: view(hx - 8, hz, 130) },          // close enough that the lit halls and substation fill the frame
      carbon: (() => { const c = CENTROID[(site || DEFAULT_PLACE).state] || [hx, hz]; return { pos: [c[0], 34, c[1]], view: { pos: [c[0], 1300, c[1] + 1100], target: [c[0], 0, c[1]] } }; })(),
      ...siteSpots,
    },
    heatHotspots: {
      climate: { pos: [hx - 300, 12, hz + 200], view: { pos: [hx - 300, 1400, hz + 1500], target: [hx - 300, 0, hz] } },
      home: { pos: [hx + 2, 12, hz + 6], mapNamed: true, view: view(hx, hz + 6, 150) },
    },
    dataHotspots: {
      dci: { pos: [HT[0], 8, HT[1]], view: view(HT[0] - 6, HT[1], 110) },
      ila: { pos: [h0[0], 9, h0[2]], view: view(h0[0], h0[2], 60) },
      route: { pos: [longest?.mid[0] ?? hx, 60, longest?.mid[2] ?? hz], view: { pos: [(longest?.mid[0] ?? hx) - 100, 900, (longest?.mid[2] ?? hz) + 900], target: [longest?.mid[0] ?? hx, 0, longest?.mid[2] ?? hz] } },
      remote: { pos: [R0[0], 10, R0[1]], view: view(R0[0] - 10, R0[1], 340) },
      home: { pos: [hx - 40, 10, hz + 40], mapNamed: true, view: view(hx, hz, 220) },
    },
    update(t) {
      plumeUpdates.forEach(u => u(t)); if (turbines) turbines.update(t);
      const on = (t % 2) < 0.45 ? 1 : 0.12; beacons.forEach(b => { b.m.emissiveIntensity = b.k * on; });
    },
  };
  attachFlowRibbons(built, { width: 2.4, glow: 5.8, brightness: 2.65, mobile: quality.mobile });
  return built;
}
