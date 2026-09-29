import { attachFlowRibbons } from '../flow-ribbons.js';
import { SiteBuilder as Builder, preloadSiteConstruction, finalizeSiteGeometry, hasSiteConstruction } from './site-blender-construction.js';
// Scene 1: grid & campus. Units are meters. x runs east, z runs south, y up.
import { THREE, MAT, mtx, flow, insulator, latticeTower, catenary, wires, canvasTex, sky, person, glowMat, spinners, surfaceDetail } from '../kit.js';
import { rbox, lamps, plumes, movers } from '../fx.js';
import { terrainTexture, clouds, treeMatrices, carBuild, truckBuild, walkerBuild } from './campus-detail.js';
import { campusRoadPlan, addCampusRoads, containsPlan } from './campus-roads.js';
import { campusMaterials, addCampusArchitecture } from './campus-architecture.js';
import { campusHorizon, campusLightPools, campusTreeBelt } from './campus-atmosphere.js';
import { campusWoodland, campusMeadow, campusContactShade } from './campus-landscape.js';
import { preloadCampusArchitecture, hasCampusArchitecture, addBlenderCampusArchitecture, addBlenderCampusExpansion } from './campus-blender-architecture.js';
import { preloadCampusCatalog, campusCatalogInstances, campusCatalogRotor } from './campus-blender-catalog.js';
import { preloadCampusVehicles, hasCampusVehicles, campusVehicleInstances } from './campus-blender-vehicles.js';
import { preloadCampusTransformer, hasCampusTransformer, campusTransformerInstances } from './campus-blender-transformer.js';
export const preload = () => Promise.all([preloadCampusArchitecture(), preloadCampusCatalog(), preloadSiteConstruction(), preloadCampusVehicles(), preloadCampusTransformer()]);

export function build({ quality, model }) {
  const L = model.layout, warm = model.cooling.id === 'warm';
  const authoredCampus = hasCampusArchitecture();
  // a real campus's published plant (sites.ts): battery backup instead of a diesel yard, a closed loop instead of towers
  const batteryYard = model.backup === 'battery', closed = model.closedLoop;
  const nHalls = Math.min(2, model.halls), extra = Math.max(0, model.halls - 2);
  // Additional representative hall envelopes repeat east of the detailed utility plant.
  const perCol = Math.min(12, Math.max(2, Math.ceil(Math.sqrt(extra / 1.2)))), cols = Math.ceil(extra / perCol);
  const reach = extra ? 620 + cols * 320 : 0;
  const extentWest=-1100,extentEast=extra?750+(cols-1)*320+132:440,span=extentEast-extentWest;
  const hallLen = nHalls === 1 ? Math.round(Math.max(70, Math.min(260, 260 * model.IT_MW / 45))) : 260;
  const hallX0 = -30, hallX1 = hallX0 + hallLen, hcx = (hallX0 + hallX1) / 2, hallA = { z0: -215, z1: -125 }, hallB = { z0: 15, z1: 105 };
  const roadPlan=campusRoadPlan({extra,perCol,cols,hallX1,nHalls,batteryYard,gensets:L.gensets});
  const scene = new THREE.Scene();
  // Clear blue-hour atmosphere: architecture stays readable against the landscape.
  scene.fog = new THREE.Fog(0x243a55, extra?span*3:1900, extra?span*5:6500);
  const campusSky=sky('#081a3b', '#254675', '#9b807a', extra?span*3.4:5000);campusSky.name='Campus sky';scene.add(campusSky);
  campusHorizon(scene, { reach, extra });

  // Cool sky fill with a warm low sun. Separate building faces through lighting,
  // without letting haze or color grading obscure equipment and route overlays.
  scene.add(new THREE.HemisphereLight(0x9cbde6, 0x26372f, 1.1));
  scene.add(new THREE.AmbientLight(0xa6b9d3, 0.3));
  const sun = new THREE.DirectionalLight(0xffdec2, 2.05);
  sun.position.set(-850, 800, 550); sun.target.position.set(-60, 0, -60);
  if (quality.shadows) {
    sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
    Object.assign(sun.shadow.camera, { left: -760, right: 760, top: 520, bottom: -520, near: 100, far: 3000 });
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6;
  }
  scene.add(sun, sun.target);
  // fill from the sun's opposite quarter (east/south), stronger than a token bounce so the shadow
  // side of anything actually has form; a second, cooler rim from due east specifically lifts the
  // generator and battery yards, whose own equipment faces away from the low sun on that side
  const fill = new THREE.DirectionalLight(0x9db4e6, 0.85); fill.position.set(600, 300, 800); scene.add(fill);
  const rim = new THREE.DirectionalLight(0x9fc4e6, 0.85); rim.position.set(950, 210, -40); rim.target.position.set(-60, 0, -60); scene.add(rim, rim.target);

  const flows = [], dataFlows = [], heatFlows = [];
  const moverGroups = [], plumeUpdates = [];
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const architectureMaterials = campusMaterials();
  const asphalt = surfaceDetail(MAT.asphalt.clone(), { meters: 3.5, amount: .26, roughness: .14 });
  const S = new Builder();         // static, shadowed
  const N = new Builder();         // small parts, no shadow casting
  // a rounded box standing on y0, for equipment that should read as molded rather than milled
  const rslab = (B, w, h, d, mat, x, y0, z, ry = 0, r = 0.1) => rbox(B, w, h, d, mat, x, y0 + h / 2, z, { r, ry });

  // ---------- ground, roads, pads ----------
  // surrounding terrain: crop-field patchwork under the campus itself, so the graded pad reads
  // as carved out of real farmland rather than floating on a flat dark plate
  const terrainMat = new THREE.MeshStandardMaterial({ map: terrainTexture(), roughness: 0.97 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), terrainMat);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  campusMeadow(scene);
  addCampusRoads(scene,roadPlan,asphalt);

  // perimeter fence: posts and top rail
  const fence = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0);if(len<.01)return;const n = Math.max(1,Math.floor(len / 6));
    for (let i = 0; i <= n; i++) { const u = i / n; N.cyl(0.05, 2.4, MAT.galv, x0 + (x1 - x0) * u, 1.2, z0 + (z1 - z0) * u, 5); }
    N.strut([x0, 2.4, z0], [x1, 2.4, z1], 0.03, MAT.galv, 4);
    N.strut([x0, 1.2, z0], [x1, 1.2, z1], 0.02, MAT.galv, 4);
  };
  fence(-610,-330,470,-330);
  if(extra){
    const en=-55-(perCol-1)*60-85,es=-55+(perCol-1)*60+85,ex=590+cols*320+25;
    const north=Math.min(-330,en),south=Math.max(250,es);
    fence(470,-330,470,north);fence(470,north,ex,north);fence(ex,north,ex,south);fence(ex,south,470,south);fence(470,south,470,250);
  }else fence(470,-330,470,250);
  fence(470,250,-100,250);fence(-120,250,-610,250);fence(-610,250,-610,-330);

  // ---------- transmission line from the west ----------
  const tower = new Builder();
  const tips = latticeTower(tower, 46, 9);
  const towerXs = [-640, -990, -1340, -1690, -2040, -2390, -2740];
  const towerZ = -150;
  scene.add(tower.instance(towerXs.map(x => mtx(x, 0, towerZ, Math.PI / 2))));
  // conductors: tower tips rotated 90° (arms along z)
  const tipAt = (x, i) => [x + tips[i][2], tips[i][1], towerZ - tips[i][0]];
  const spans = [];
  for (let t = towerXs.length - 1; t > 0; t--) for (let i = 0; i < tips.length; i++) spans.push({ i, pts: catenary(tipAt(towerXs[t], i), tipAt(towerXs[t - 1], i), i >= 6 ? 7 : 10) });
  scene.add(wires(spans.map(s => s.pts), 0x3a4048));
  // last span into the dead-end gantries
  const gantryX = -548, gantryH = 20, circuitZ = [-178, -122];
  const phaseZ = [-6, 0, 6];
  const landing = [];
  for (let c = 0; c < 2; c++) for (let p = 0; p < 3; p++) {
    const tipIdx = [0, 2, 4][p] + (c === 0 ? 0 : 1); // side +1 / -1 on each level
    const a = tipAt(towerXs[0], tipIdx), b = [gantryX, gantryH - 1.5, circuitZ[c] + phaseZ[p]];
    landing.push({ c, p, pts: catenary(a, b, 5, 20) });
  }
  scene.add(wires(landing.map(l => l.pts), 0x3a4048));
  // HV flow: one conductor per phase on the incoming line, all the way to the gantry
  for (let c = 0; c < 2; c++) for (let p = 0; p < 3; p++) {
    const tipIdx = [0, 2, 4][p] + (c === 0 ? 0 : 1);
    const path = [];
    for (let t = towerXs.length - 1; t > 0; t--) path.push(...catenary(tipAt(towerXs[t], tipIdx), tipAt(towerXs[t - 1], tipIdx), 10, 12).slice(0, -1));
    path.push(...landing[c * 3 + p].pts);
    flows.push(flow(path, 'hv', { count: 70, speed: 140, size: 0.8, trail: false }));
  }

  // ---------- substation yard ----------
  S.slab(210, 0.3, 170, MAT.gravel, -462, 0.1, -150);
  fence(-567, -235, -357, -235); fence(-357, -235, -357, -65);
  fence(-357, -65, -439, -65); fence(-451, -65, -567, -65); fence(-567, -65, -567, -235);
  // The connected road plan meets the 12 m substation gate opening.
  // dead-end gantries: two tubular columns and a beam per circuit
  for (const cz of circuitZ) {
    for (const dz of [-10, 10]) { S.cyl(0.45, gantryH, MAT.galv, gantryX, gantryH / 2, cz + dz, 10); S.slab(1.6, 0.6, 1.6, MAT.concrete, gantryX, 0, cz + dz); }
    S.cylZ(0.4, 21, MAT.galv, gantryX, gantryH, cz, 10);
    for (const pz of phaseZ) insulator(N, gantryX - 3.2, gantryH - 1.5, cz + pz, 3, 0.16, MAT.polymer, { axis: 'x', sheds: 10 });
  }
  // equipment per phase: disconnect → breaker → bus
  const busY = 10, busX = -470;
  const breakerAt = [];
  for (let c = 0; c < 2; c++) for (let p = 0; p < 3; p++) {
    const z = circuitZ[c] + phaseZ[p];
    // surge arrester and CVT near the gantry
    S.slab(0.6, 3, 0.6, MAT.galv, gantryX + 8, 0, z); insulator(N, gantryX + 8, 3, z, 3.6, 0.22, MAT.porcelain);
    S.slab(0.6, 3, 0.6, MAT.galv, gantryX + 13, 0, z); insulator(N, gantryX + 13, 3, z, 4.2, 0.26, MAT.porcelain);
    // disconnect switch: two posts and a blade
    S.slab(0.5, 4, 3.8, MAT.galv, gantryX + 21, 0, z);
    insulator(N, gantryX + 21, 4, z - 1.5, 2.8, 0.2); insulator(N, gantryX + 21, 4, z + 1.5, 2.8, 0.2);
    N.cylZ(0.07, 3.2, MAT.alu, gantryX + 21, 7, z, 8);
    breakerAt.push([gantryX + 34, z]);
  }
  // dead-tank SF6 breakers (three-phase units, one per circuit per side of the ring)
  const breakerZ = [-190, -170, -150, -130, -110, -90];
  breakerZ.forEach((z, i) => {
    const x = gantryX + 36;
    S.slab(4.5, 2.2, 4.2, MAT.galv, x, 0, z);
    for (const dz of [-1.4, 0, 1.4]) {
      S.cylX(0.55, 3.4, MAT.ansi61, x, 3.0, z + dz, 16);
      insulator(N, x - 1.2, 3.4, z + dz, 3.0, 0.2, MAT.polymer); insulator(N, x + 1.2, 3.4, z + dz, 3.0, 0.2, MAT.polymer);
    }
    S.slab(1.4, 1.8, 1, MAT.ansi61, x + 3.2, 0, z + 1.5); // operating cabinet
  });
  // tubular HV bus on post insulators
  for (const dx of [-2.5, 0, 2.5]) {
    N.cylZ(0.12, 150, MAT.alu, busX + dx, busY, -150, 10);
    for (let z = -222; z <= -78; z += 12) { S.slab(0.5, 5.5, 0.5, MAT.galv, busX + dx, 0, z); insulator(N, busX + dx, 5.5, z, 4.3, 0.2); }
  }
  // lightning masts
  [[-560, -230], [-560, -70], [-465, -230], [-465, -70], [-365, -230], [-365, -70]].forEach(([x, z]) => {
    S.strut([x, 0, z], [x, 34, z], 0.35, MAT.galv, 8); N.strut([x, 34, z], [x, 40, z], 0.08, MAT.galv, 6);
  });
  // control house
  S.slab(22, 5, 10, MAT.beige, -525, 0, -82); S.slab(23, 0.5, 11, MAT.roof, -525, 5, -82);
  for (let i = 0; i < 3; i++) N.slab(1.4, 0.8, 0.4, MAT.darkSteel, -532 + i * 7, 5.5, -82);

  // main power transformers ×3 with radiators, conservator, bushings, fire walls
  const mptX = -418, mptZ = [-195, -150, -105];
  if(hasCampusTransformer())scene.add(campusTransformerInstances(mptZ.map(z=>mtx(mptX,0,z))));
  mptZ.forEach(z => {
    S.slab(14, 0.55, 16, MAT.concreteDark, mptX, 0, z);           // oil containment, curb above the gravel
    if(!hasCampusTransformer()) {
    rslab(S, 6, 6, 9.5, MAT.xfmr, mptX, 0.8, z, 0, 0.05);           // main tank
    S.slab(6.4, 0.5, 9.9, MAT.xfmr, mptX, 6.8, z);                  // cover
    S.slab(6.8, 0.8, 10.2, MAT.darkSteel, mptX, 0.4, z);            // skid
    for (const side of [-1, 1]) {                                    // radiator banks on the long faces
      for (let r = 0; r < 4; r++) {
        const rz = z + side * (5.6 + r * 0.0), rx0 = mptX - 2.4;
        for (let f = 0; f < 10; f++) N.slab(0.06, 4.6, 1.3, MAT.xfmr, rx0 + f * 0.52, 1.2, rz + side * 0.9);
        N.cylX(0.14, 5.3, MAT.xfmr, mptX, 5.9, rz + side * 0.9, 8); N.cylX(0.14, 5.3, MAT.xfmr, mptX, 1.2, rz + side * 0.9, 8);
      }
      for (let f = 0; f < 3; f++) N.cylZ(0.75, 0.3, MAT.fan, mptX - 1.8 + f * 1.8, 0.95, z + side * 7.25, 16);
    }
    S.cylZ(0.9, 7, MAT.xfmr, mptX + 1.5, 9.4, z, 20);              // conservator
    N.strut([mptX + 1.5, 7.3, z - 2.5], [mptX + 1.5, 8.6, z - 2.5], 0.12, MAT.xfmr); N.strut([mptX + 1.5, 7.3, z + 2.5], [mptX + 1.5, 8.6, z + 2.5], 0.12, MAT.xfmr);
    }
    for (const dz of [-2.6, 0, 2.6]) insulator(N, mptX - 2.2, 7.3, z + dz, 5.2, 0.3, MAT.porcelain);   // HV bushings
    insulator(N, mptX - 2.2, 7.3, z + 4, 2.4, 0.18, MAT.porcelain);                                      // neutral
    for (const dz of [-2, 0, 2]) insulator(N, mptX + 2.6, 7.3, z + dz, 1.8, 0.22, MAT.porcelain);      // 34.5 kV bushings
    if(!hasCampusTransformer()) S.slab(1.2, 2, 0.9, MAT.ansi61, mptX + 3.5, 0.8, z + 3.8);    // control cabinet
  });
  [-172.5, -127.5].forEach(z => S.slab(16, 11, 0.6, MAT.concrete, mptX, 0, z));  // fire walls
  // 34.5 kV switchgear e-houses
  [[-378, -178], [-378, -122]].forEach(([x, z]) => {
    rslab(S, 8, 4.2, 34, MAT.white, x, 0.4, z, 0, 0.03); S.slab(8.4, 0.4, 34.4, MAT.roof, x, 4.6, z);
    for (let i = 0; i < 4; i++) N.slab(0.9, 0.9, 2.2, MAT.darkSteel, x + 4.3, 3.2, z - 12 + i * 8);
    for (let i = 0; i < 6; i++) N.slab(0.05, 2.1, 1, MAT.darkSteel, x - 4.02, 0.4, z - 14 + i * 5.6);
  });
  // overhead bus bits from gantries into the breakers and out to the transformers (visual)
  for (let c = 0; c < 2; c++) for (let p = 0; p < 3; p++) {
    const z = circuitZ[c] + phaseZ[p];
    N.strut([gantryX, gantryH - 1.5, z], [gantryX + 21, 7, z], 0.05, MAT.alu, 4);
    N.strut([gantryX + 21, 7, z], [gantryX + 36, 6.4, breakerZ[c * 3 + p]], 0.05, MAT.alu, 4);
  }
  mptZ.forEach(z => { for (const dz of [-2.6, 0, 2.6]) N.strut([busX + 2.5, busY, z + dz], [mptX - 2.2, 12.5, z + dz], 0.05, MAT.alu, 4); });

  // HV flows inside the yard
  for (let c = 0; c < 2; c++) for (let p = 0; p < 3; p++) {
    const z = circuitZ[c] + phaseZ[p], bz = breakerZ[c * 3 + p];
    flows.push(flow([[gantryX, gantryH - 1.5, z], [gantryX + 21, 7, z], [gantryX + 36, 6.6, bz], [busX, busY, bz]], 'hv', { count: 6, speed: 40, size: 0.35, trailR: 0.08 }));
  }
  flows.push(flow([[busX, busY + 0.3, -222], [busX, busY + 0.3, -78]], 'hv', { count: 26, speed: 30, size: 0.35, trailR: 0.08 }));
  mptZ.forEach(z => flows.push(flow([[busX, busY, z], [mptX - 2.2, 12.5, z]], 'hv', { count: 5, speed: 20, size: 0.35, trailR: 0.08 })));

  // ---------- 34.5 kV duct bank to the halls ----------
  const uY = 0.9;
  mptZ.forEach(z => flows.push(flow([[mptX + 2.6, 9, z], [-382, 5, z], [-382, 5, z > -150 ? -122 : -178]], 'mv', { count: 5, speed: 18, size: 0.4, trailR: 0.1 })));
  const trunk = [[-374, uY, -150], [-340, uY, -150], [-340, uY, -62], [-40, uY, -62]];
  flows.push(flow(trunk, 'mv', { count: 40, speed: 60, size: 0.9, trailR: 0.35 }));
  flows.push(flow([[-40, uY, -62], [-40, uY, -112], [hallX1 - 5, uY, -112]], 'mv', { count: 30, speed: 55, size: 1.2, trailR: 0.4 }));
  if (nHalls > 1) flows.push(flow([[-40, uY, -62], [-40, uY, 3], [hallX1 - 5, uY, 3]], 'mv', { count: 30, speed: 55, size: 1.2, trailR: 0.4 }));
  // duct bank manholes along the route
  [[-340, -100], [-250, -62], [-150, -62], [-40, -62], [-40, -30]].forEach(([x, z]) => N.cyl(0.9, 0.3, MAT.concrete, x, 0.3, z, 16));

  // ---------- data halls ----------
  const facade = canvasTex(1024, 256, (g, w, h) => {
    g.fillStyle = '#aab4bb'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) { g.fillStyle = x % 64 === 0 ? '#7e8b96' : '#9aa5af'; g.fillRect(x, 0, 2, h); }
    g.fillStyle = '#7f8d97';
    for (const y of [91, 171]) g.fillRect(0, y, w, 1.3); // panel joints, not floor slabs
    g.fillStyle = '#50565d'; g.fillRect(0, 26, w, 34);                                // louver band
    for (let y = 28; y < 60; y += 4) { g.fillStyle = '#3c4148'; g.fillRect(0, y, w, 1.5); }
    g.fillStyle = '#2d3238'; for (let x = 60; x < w; x += 250) g.fillRect(x, h - 58, 34, 58);   // doors
    g.fillStyle = '#6d747b'; g.fillRect(0, h - 6, w, 6);
  }, { repeat: [6.5, 1] });
  // Approximate facade uplighting, inspired by the site's hero illustration.
  // A material light wash avoids dozens of runtime lights; it is not a photometric simulation.
  const uplightMap = canvasTex(1024, 256, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    for (let x = 40; x < w; x += 128) {
      const glow = g.createRadialGradient(x, h - 8, 0, x, h - 8, 145);
      glow.addColorStop(0, '#ffe2aa'); glow.addColorStop(0.25, '#aa7944'); glow.addColorStop(0.7, '#211508'); glow.addColorStop(1, '#000');
      g.fillStyle = glow; g.fillRect(x - 128, h - 154, 256, 154);
    }
  }, { repeat: [6.5, 1] });
  const facadeEnd = facade.clone(); facadeEnd.repeat.set(2.25, 1); facadeEnd.needsUpdate = true;
  const uplightEnd = uplightMap.clone(); uplightEnd.repeat.set(2.25, 1); uplightEnd.needsUpdate = true;
  const wallMat = new THREE.MeshStandardMaterial({ map: facade, roughness: 0.5, metalness: 0.18, emissiveMap: uplightMap, emissive: 0xffcf8e, emissiveIntensity: 1.25 });
  const wallEnd = new THREE.MeshStandardMaterial({ map: facadeEnd, roughness: 0.5, metalness: 0.18, emissiveMap: uplightEnd, emissive: 0xffcf8e, emissiveIntensity: 1.25 });
  surfaceDetail(wallMat, { meters: 6, amount: .06, roughness: .13 });
  surfaceDetail(wallEnd, { meters: 6, amount: .06, roughness: .13 });
  const officeTex = canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#16202b'; g.fillRect(0, 0, w, h);
    // Three broad office levels aligned to the exterior floor bands, with grouped
    // lit rooms. A dense random window grid made this 16 m wing look many stories tall.
    const bay = w / 17, floor = h / 3;
    for (let row = 0; row < 3; row++) for (let col = 0; col < 17; col++) {
      const lit = (Math.floor(col / 3) + row * 2) % 5 < 2;
      g.fillStyle = lit ? '#c9b28c' : '#243b4b';
      g.fillRect(col * bay + 2, row * floor + 7, bay - 4, floor - 17);
      g.fillStyle = '#121e2a'; g.fillRect(col * bay + bay / 2, row * floor + 7, 1.2, floor - 17);
    }
  });
  const officeMat = new THREE.MeshPhysicalMaterial({ color: 0x182733, roughness: 0.19, metalness: 0.4, clearcoat: .8, clearcoatRoughness: .12, envMapIntensity: 1.3, emissive: 0xffffff, emissiveMap: officeTex, emissiveIntensity: 0.32 });
  const officeShort = officeMat.clone();
  officeShort.emissiveMap = officeTex.clone(); officeShort.emissiveMap.repeat.x = 28 / 60;

  const coolerUnit = new Builder();
  coolerUnit.slab(11.6, 0.3, 2.3, MAT.darkSteel, 0, 0, 0);
  for (const dz of [-0.95, 0.95]) coolerUnit.box(11.6, 1.8, 0.12, MAT.steel, 0, 1.2, dz, 0, dz > 0 ? 0.35 : -0.35); // V coils
  coolerUnit.slab(11.6, 0.2, 2.4, MAT.galv, 0, 2.1, 0);
  // the fan cap sat only 0.01 above the housing ring's own flat top, which the reparenting bug had
  // hidden (the fan mesh never rendered at all); raised clear of it now that both actually draw
  for (let i = 0; i < 6; i++) { coolerUnit.cyl(0.9, 0.35, MAT.galv, -4.9 + i * 1.96, 2.45, 0, 20); coolerUnit.cyl(0.8, 0.36, MAT.fan, -4.9 + i * 1.96, 2.52, 0, 20); }
  for (const x of [-5.6, 5.6]) for (const z of [-1, 1]) coolerUnit.slab(0.15, 0.4, 0.15, MAT.galv, x, -0.4, z);

  const coolerMx = [];
  const unitSub = new Builder();
  unitSub.slab(4, 0.3, 4, MAT.concrete, 0, 0, 0);
  unitSub.slab(2.3, 2.1, 1.9, MAT.ansi61, 0, 0.3, -0.3);
  for (let f = 0; f < 8; f++) unitSub.slab(0.05, 1.4, 0.6, MAT.ansi61, -1 + f * 0.28, 0.6, 0.95);
  unitSub.slab(0.8, 0.6, 0.6, MAT.darkSteel, 0.6, 2.4, -0.3);
  const unitSubMx = [];
  const hallCentersZ = [];
  let opsAnt;

  const hallList = [hallA, hallB].slice(0, nHalls);
  hallList.forEach((h, hi) => {
    const cz = (h.z0 + h.z1) / 2, cx = (hallX0 + hallX1) / 2, W = hallX1 - hallX0, D = h.z1 - h.z0, H = 22;
    hallCentersZ.push(cz);
    S.slab(W + 42, 0.04, D + 28, architectureMaterials.paving, cx - 10, 0.15, cz);
    const shell = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), [wallEnd, wallEnd, architectureMaterials.roof, MAT.roof, wallMat, wallMat]);
    shell.name = `Campus hall ${hi + 1}`;
    shell.position.set(cx, H / 2 + 0.15, cz); shell.castShadow = shell.receiveShadow = true; if (!authoredCampus) scene.add(shell); else { shell.geometry.dispose(); }
    // parapet and roof equipment
    if (!authoredCampus) { S.slab(W, 1.4, 0.4, MAT.wall, cx, H, h.z0 + 0.2); S.slab(W, 1.4, 0.4, MAT.wall, cx, H, h.z1 - 0.2);
    S.slab(0.4, 1.4, D, MAT.wall, hallX0 + 0.2, H, cz); S.slab(0.4, 1.4, D, MAT.wall, hallX1 - 0.2, H, cz); }
    if (warm) {
      for (let r = 0; r < 3; r++) for (let i = 0; i < Math.floor((W - 18) / 13.5) + 1; i++) coolerMx.push(mtx(hallX0 + 12 + i * 13.5, H + 0.6, h.z0 + 22 + r * 23));
      // roof walkways and pipe racks to the coolers
      // A closed two-pipe roof loop: hot feed and cooled return have
      // separate headers, roof penetrations and branch connections to each unit.
      const hotX=hallX0+10,coolX=hallX0+11.5,roofHeaderEnd=hallX0+13+Math.floor((W-18)/13.5)*13.5;
      for(const [x,dz,dy]of [[hotX,0,0],[coolX,.9,.8]]){
        N.cyl(.35,1.6+dy,MAT.pipeInsul,x,H+.4+dy/2,h.z0+24.2+dz,10);
        N.cylZ(.35,46,MAT.pipeInsul,x,H+1.2+dy,h.z0+47.2+dz,10);
      }
      for(let r=0;r<3;r++){
        const pz=h.z0+24.2+r*23;
        for(const [dz,x0,dy]of [[0,hotX,0],[.9,coolX,.8]])N.cylX(.35,roofHeaderEnd-x0,MAT.pipeInsul,(roofHeaderEnd+x0)/2,H+1.2+dy,pz+dz,10);
        for(let i=0;i<Math.floor((W-18)/13.5)+1;i++){
          const ux=hallX0+12+i*13.5;
          for(const [dx,dz,dy]of [[-1,0,0],[1,.9,.8]]){
            N.strut([ux+dx,H+1.2+dy,pz+dz],[ux+dx,H+1.2+dy,pz-1.2],.16,MAT.pipeInsul,8);
            if(dy)N.strut([ux+dx,H+1.2+dy,pz-1.2],[ux+dx,H+1.2,pz-1.2],.16,MAT.pipeInsul,8);
          }
        }
      }
    } else {
      // chilled-water halls: only exhaust fans and air intakes on the roof
      for (let i = 0; i < Math.floor((W - 30) / 27) + 1; i++) for (let r = 0; r < 2; r++) { S.cyl(1.4, 1.6, MAT.galv, hallX0 + 20 + i * 27, H + 0.8, h.z0 + 28 + r * 34, 16); N.cyl(1.2, 0.1, MAT.fan, hallX0 + 20 + i * 27, H + 1.65, h.z0 + 28 + r * 34, 16); }
    }
    // stairs/elevator core
    S.slab(8, 5, 8, MAT.wall, hallX0 + 5, H, cz);
    // unit substations along the road-facing side
    const sideZ = hi === 0 ? h.z1 + 10 : h.z0 - 10;
    for (let i = 0; i < Math.floor((W - 12) / 11) + 1; i++) unitSubMx.push(mtx(hallX0 + 8 + i * 11, 0.15, sideZ, hi === 0 ? 0 : Math.PI));
    // MV taps from the feeder to each unit sub
    // office block at the west end
    const office = new THREE.Mesh(new THREE.BoxGeometry(28, 16, 60), [officeMat, officeMat, MAT.roof, MAT.roof, officeShort, officeShort]);
    office.position.set(hallX0 - 14, 8.15, cz); office.castShadow = office.receiveShadow = true; if (!authoredCampus) scene.add(office); else office.geometry.dispose();
    if (!authoredCampus) S.slab(29, 0.6, 61, MAT.roof, hallX0 - 14, 16.15, cz);
    if(hi===0){
      const antX=hallX0-6,antZ=cz+20,roofY=authoredCampus?19.4:16.45;
      N.cyl(.06,4,MAT.galv,antX,roofY+2,antZ,8);
      N.cylX(.5,.12,MAT.darkSteel,antX,roofY+3.1,antZ,16);
      N.add(new THREE.SphereGeometry(.09,10,8),glowMat('#ff5a5a',1.6),antX,roofY+4.05,antZ);
      opsAnt={x:antX,z:antZ,roofY};
    }
    // loading dock on the east end, with a stair down from the platform for the personnel door
    for (let i = 0; i < 4; i++) N.slab(0.3, 4.5, 3.6, MAT.darkSteel, hallX1 + 0.2, 0.15, cz - 20 + i * 5);
    S.slab(8, 0.6, 26, MAT.concrete, hallX1 + 4, 0.15, cz - 12);
    for (let k = 0; k < 3; k++) rslab(N, 1.6, 0.25, 0.55, MAT.concrete, hallX1 + 8.3 + k * 0.55, 0.5 - k * 0.25, cz - 12, 0, 0.2);
    N.strut([hallX1 + 8, 0.2, cz - 12.9], [hallX1 + 8, 1, cz - 12.9], 0.035, MAT.galv, 6);
    N.strut([hallX1 + 8, 0.2, cz - 11.1], [hallX1 + 8, 1, cz - 11.1], 0.035, MAT.galv, 6);
  });
  scene.add(authoredCampus ? campusCatalogInstances('COOLER',coolerMx,{cast:true}) : coolerUnit.instance(coolerMx, { cast: true }));
  // the coolers' fans turn: six per unit, just above each fan ring
  const fanItems = [], fp = new THREE.Vector3();
  coolerMx.forEach(mx => { for (let i = 0; i < 6; i++) { fp.set(-4.9 + i * 1.96, 2.67, 0).applyMatrix4(mx); fanItems.push({ p: fp.toArray(), axis: 'y', r: 0.74 }); } });
  // heat: warm water up to the cooler rows, plumes of warm air above them
  if (warm) hallList.forEach(h => {
    const Hh = 22;
    for (let r = 0; r < 3; r++) {
      const pz = h.z0 + 22 + r * 23 + 2.2,roofHeaderEnd=hallX0+13+Math.floor((hallLen-18)/13.5)*13.5;
      heatFlows.push(flow([[hallX0 + 10, Hh + .4, h.z0+24.2], [hallX0 + 10, Hh + 1.2, h.z0+24.2], ...(r?[[hallX0+10,Hh+1.2,pz]]:[]), [roofHeaderEnd, Hh + 1.2, pz]], 'warm', { count: 30, speed: 30, size: 0.8, k: 2.4, trailR: 0.3, trailK: 0.4 }));
      heatFlows.push(flow([[roofHeaderEnd,Hh+2,pz+.9],[hallX0+11.5,Hh+2,pz+.9],...(r?[[hallX0+11.5,Hh+2,h.z0+25.1]]:[]),[hallX0+11.5,Hh+.4,h.z0+25.1]],'cool',{count:22,speed:25,size:.65,k:2,trailR:.22}));
      for (let i = 0; i < Math.floor((hallLen - 18) / 13.5) + 1; i += 2) {
        const x = hallX0 + 12 + i * 13.5, z = h.z0 + 22 + r * 23;
        heatFlows.push(flow([[x, Hh + 3.5, z], [x + 3, Hh + 22, z - 2], [x + 8, Hh + 50, z - 6]], 'air', { count: 5, speed: 7, size: 2.4, k: 2.0, opacity: 0.6, trail: false }));
      }
    }
  });
  const towerRows = closed ? [] : warm ? [-275] : [-275, -290];
  const plantX = Math.max(hallX0 + 45, Math.min(100, hcx + 20));
  towerRows.forEach(tz => { for (let i = 0; i < 6; i++) { const x = 15 + i * 12; heatFlows.push(flow([[x, 11.5, tz], [x + 2, 35, tz - 3], [x + 6, 65, tz - 9]], 'vapor', { count: warm ? 5 : 7, speed: 6, size: 2.4, k: 1.2, opacity: warm ? 0.4 : 0.55, trail: false })); } });
  if (!warm) {
    // chiller plant between hall A and the towers: warm return in, cold supply back, heat on to the towers
    heatFlows.push(flow([[plantX - 10, 2.2, -215], [plantX - 10, 2.2, -236]], 'warm', { count: 14, speed: 10, size: 0.8, k: 2.4, trailR: 0.3 }));
    heatFlows.push(flow([[plantX + 10, 2.2, -236], [plantX + 10, 2.2, -215]], 'cool', { count: 14, speed: 10, size: 0.8, k: 2.4, trailR: 0.3 }));
    if (towerRows.length) heatFlows.push(flow([[plantX - 20, 2.2, -254], [plantX - 20, 2.2, -262], [15, 2.2, -262], [15, 2.2, -275], [15, 9, -275]], 'warm', { count: 18, speed: 14, size: 0.8, k: 2.4, trailR: 0.3 }));
    // air-cooled chillers on a closed loop: the heat leaves as warm air off their roof fans, and no water goes with it
    else for (let i = 0; i < 6; i++) { const x = plantX - 24 + i * 9.5; heatFlows.push(flow([[x, 12.8, -245], [x + 2, 34, -248], [x + 6, 60, -254]], 'air', { count: 5, speed: 7, size: 2.4, k: 2.0, opacity: 0.6, trail: false })); }
  }
  if (towerRows.length) heatFlows.push(flow([[125, 1, -280], [80, 1, -280], [80, 1, -275], [20, 1, -275]], 'cool', { count: 10, speed: 12, size: 0.6, k: 2.2, trailR: 0.2 }));
  scene.add(authoredCampus ? campusCatalogInstances('UNITSUB',unitSubMx) : unitSub.instance(unitSubMx));

  // ---------- generator yard and fuel (a campus whose operator names batteries as its backup has neither) ----------
  if (L.gensets) {
    S.slab(94, 0.04, 50, MAT.gravel, 320, 0.15, -187);
    if (L.gensets > 20) S.slab(94, 0.04, 50, MAT.gravel, 320, 0.15, 38);
    S.slab(42, 0.04, 68, MAT.gravel, 397, 0.15, -103);
    const genset = new Builder();
    genset.slab(13, 0.4, 3.8, MAT.concrete, 0, 0, 0);
    rslab(genset, 12.2, 2.9, 3, MAT.beige, 0, 0.4, 0, 0, 0.06);
    for (let x = -5.8; x <= 5.8; x += 0.8) { genset.slab(0.12, 2.8, 0.08, MAT.beige, x, 0.45, 1.53); genset.slab(0.12, 2.8, 0.08, MAT.beige, x, 0.45, -1.53); }
    genset.slab(3.2, 1.3, 2.8, MAT.steel, 4.3, 3.3, 0);                       // radiator housing
    for (const dz of [-0.7, 0.7]) genset.cyl(0.62, 0.1, MAT.fan, 4.3, 4.62, dz, 18);
    genset.cylX(0.45, 2.6, MAT.darkSteel, -2.5, 3.8, 0, 14);                  // silencer
    genset.cyl(0.26, 2.8, MAT.darkSteel, -1.2, 4.6, 0, 12);                  // stack
    genset.slab(1.2, 1.8, 1.6, MAT.ansi61, -7.4, 0.4, 0);                    // step-up transformer
    const gensetMx = [];
    for (const blockZ of [-205, 20]) for (let c = 0; c < 4; c++) for (let r = 0; r < 5; r++) if (gensetMx.length < Math.min(40, L.gensets)) gensetMx.push(mtx(290 + c * 21, 0.15, blockZ + r * 8));
    scene.add(authoredCampus ? campusCatalogInstances('GENSET',gensetMx) : genset.instance(gensetMx));
    // fuel farm
    for (let i = 0; i < 6; i++) {
      const x = 390 + (i % 2) * 14, z = -120 + Math.floor(i / 2) * 18;
      S.slab(12, 0.4, 16, MAT.concreteDark, x, 0.15, z);
      for (const dz of [-3.5, 3.5]) S.slab(1.2, 1.4, 5, MAT.concrete, x, 0.5, z + dz);
      S.cylZ(2.2, 13.5, MAT.white, x, 4.0, z, 24);
    }
    S.slab(6, 2.4, 3, MAT.steel, 405, 0.15, -145);                             // fuel polishing skid
    // standby flow: generators to the MV network (dim, slow)
    flows.push(flow([[285, uY, -170], [262, uY, -170], [262, uY, -112], [hallX1 - 5, uY, -112]], 'mv', { count: 10, speed: 12, size: 1.0, k: 0.8, opacity: 0.45, trailK: 0.15, role: 'standby' }));
    if (gensetMx.length > 20) flows.push(flow([[285, uY, 40], [262, uY, 40], [262, uY, 3], [hallX1 - 5, uY, 3]], 'mv', { count: 10, speed: 12, size: 1.0, k: 0.8, opacity: 0.45, trailK: 0.15, role: 'standby' }));
  }

  // ---------- battery storage yard ----------
  const bessBox = new Builder();
  S.slab(80, 0.04, 72, MAT.gravel, -305, 0.15, 77);
  bessBox.slab(6.5, 0.3, 3.2, MAT.concrete, 0, 0, 0);
  rslab(bessBox, 6.06, 2.6, 2.44, MAT.white, 0, 0.3, 0, 0, 0.05);
  for (let x = -2.8; x <= 2.8; x += 0.7) bessBox.slab(0.1, 2.5, 0.06, MAT.white, x, 0.35, 1.25);
  for (const x of [-3.2, 3.2]) bessBox.slab(0.4, 1.8, 1.8, MAT.darkSteel, x, 0.6, 0);
  const bessMx = [];
  for (let c = 0; c < 5; c++) for (let r = 0; r < 4; r++) if (bessMx.length < Math.min(20, Math.max(2, Math.ceil(L.bessMWh / 2)))) bessMx.push(mtx(-335 + c * 9, 0.15, 55 + r * 14));
  scene.add(authoredCampus ? campusCatalogInstances('BESS',bessMx) : bessBox.instance(bessMx));                  // the group itself: adding its meshes one by one skips every other one
  if (batteryYard) {
    S.slab(145, 0.04, 124, MAT.gravel, 350, 0.15, -154);
    // battery backup: the yard where the generators would stand is a battery field too, rows of containers with their
    // MV step-up transformers, drawn at a scale that reads (schematic: a 3.3 GWh pack is several hundred containers)
    const bigMx = [];
    for (let c = 0; c < 14; c++) for (let r = 0; r < 9; r++) bigMx.push(mtx(292 + c * 9, 0.15, -206 + r * 13));
    scene.add(authoredCampus ? campusCatalogInstances('BESS',bigMx) : bessBox.instance(bigMx));
    for (let r = 0; r < 9; r++) { S.slab(4, 2.4, 2.4, MAT.ansi61, 283, 0.15, -206 + r * 13); S.slab(2, 2.2, 2, MAT.xfmr, 287.5, 0.15, -206 + r * 13); }
    flows.push(flow([[285, uY, -170], [262, uY, -170], [262, uY, -112], [hallX1 - 5, uY, -112]], 'mv', { count: 12, speed: 16, size: 1.0, k: 1.0, opacity: 0.6, trailK: 0.2, role: 'standby' }));
  }
  for (let r = 0; r < 4; r++) { S.slab(4, 2.4, 2.4, MAT.ansi61, -280, 0.15, 55 + r * 14); S.slab(2, 2.2, 2, MAT.xfmr, -275, 0.15, 55 + r * 14); }
  flows.push(flow([[-275, uY, 55], [-275, uY, 20], [-340, uY, 20], [-340, uY, -62]], 'mv', { count: 12, speed: 20, size: 1.0, k: 1.2, opacity: 0.7, trailK: 0.2 }));

  // ---------- cooling towers and water tanks ----------
  towerRows.forEach(z => { for (let i = 0; i < 6; i++) {
    const x = 15 + i * 12;
    fanItems.push({ p: [x, 11.36, z], axis: 'y', r: 3.7 });
    S.slab(11.4, 8, 11, MAT.ansi61, x, 0.15, z);
    for (let y = 1; y < 6; y += 0.6) N.slab(11.5, 0.12, 0.2, MAT.darkSteel, x, y, z + 5.6);
    S.cyl(4.2, 3.2, MAT.ansi61, x, 9.8, z, 24); N.cyl(3.9, 0.2, MAT.fan, x, 11.2, z, 24);
  } });
  if (towerRows.length) S.slab(205, 0.04, 55, MAT.gravel, 100, 0.15, -280);
  if (!warm) {
    // chiller plant: a long shed with louvered walls, headers to hall A and to the towers
    S.slab(60, 11, 18, MAT.white, plantX, 0.15, -245); S.slab(61, 0.5, 19, MAT.roof, plantX, 11.15, -245);
    for (let i = 0; i < 10; i++) N.slab(4, 3.2, 0.1, MAT.darkSteel, plantX - 25 + i * 5.6, 6, -235.95);
    for (let i = 0; i < 6; i++) N.cyl(1.1, 1.2, MAT.galv, plantX - 24 + i * 9.5, 12.2, -245, 14);
    for (const dx of [-10, 10]) S.cylZ(0.6, 21, dx < 0 ? MAT.pipeRed : MAT.pipeBlue, plantX + dx, 2.2, -225.5, 12);
    if (towerRows.length) {
      S.cylZ(0.6, 8, MAT.pipeRed, plantX - 20, 2.2, -258); S.cylX(0.6, plantX - 35, MAT.pipeRed, (plantX - 20 + 15) / 2, 2.2, -262);
      N.strut([15,2.2,-262],[15,2.2,-275],.6,MAT.pipeRed,12);
      N.strut([15,2.2,-275],[15,9,-275],.6,MAT.pipeRed,12);
      const condenserReturn=[[18,.8,-275],[18,.8,-265],[plantX-17,.8,-265],[plantX-17,.8,-254]];
      for(let i=1;i<condenserReturn.length;i++)N.strut(condenserReturn[i-1],condenserReturn[i],.6,MAT.pipeBlue,12);
      heatFlows.push(flow(condenserReturn,'cool',{count:18,speed:14,size:.7,k:2.1,trailR:.23}));

    }
  }
  if (towerRows.length) {
    for (const [x, z] of [[125, -280], [158, -280]]) { S.cyl(13, 12, MAT.galv, x, 6.15, z, 36); S.add(new THREE.ConeGeometry(13.2, 2.2, 36), MAT.galv, x, 13.25, z); }
    S.slab(18, 5, 12, MAT.beige, 190, 0.15, -280); // evaporative makeup-water treatment
  }

  // ---------- fiber vaults ----------
  const fiberA = [-150, 238], fiberB = [455, -300];
  for (const [x, z] of [fiberA, fiberB]) { S.slab(3, 0.6, 3, MAT.concrete, x, 0.15, z); N.slab(1.2, 0.05, 1.2, MAT.darkSteel, x, 0.76, z); }
  // data: long-haul fiber in, through the line-terminal huts, to the halls; hall-to-hall fabric fiber
  const hutA = [-215, 196], hutB = [430, -276];
  for (const [x, z] of [hutA, hutB]) {
    S.slab(12, 3.6, 7, MAT.white, x, 0.15, z); S.slab(12.6, 0.4, 7.6, MAT.roof, x, 3.75, z);
    N.slab(1.4, 1.2, 0.6, MAT.darkSteel, x + 6.5, 1.2, z); N.slab(1.4, 1.2, 0.6, MAT.darkSteel, x + 6.5, 1.2, z - 2);
    N.cyl(0.15, 9, MAT.galv, x - 5, 4.5, z + 3, 6);
  }
  // Representative meet-me/border-router annex at the existing fiber landing.
  const borderX=hallX1+6,borderZ=-210;
  S.slab(12,3.6,7,MAT.white,borderX,.15,borderZ);S.slab(12.6,.4,7.6,MAT.roof,borderX,3.75,borderZ);
  N.slab(1.4,1.2,.6,MAT.darkSteel,borderX-6.5,1.2,borderZ);N.slab(1.4,1.2,.6,MAT.darkSteel,borderX-6.5,1.2,borderZ-2);
  N.cyl(.15,9,MAT.galv,borderX-1,4.5,borderZ+3,6);
  const dci = (pts, n) => dataFlows.push(flow(pts, 'dci', { count: n, speed: 45, size: 0.9, k: 2.2, trailK: 0.35, trailR: 0.3 }));
  dci([[fiberA[0], 0.7, 900], [fiberA[0], 0.7, fiberA[1]]], 40);
  dci([[fiberB[0], 0.7, -1100], [fiberB[0], 0.7, fiberB[1]]], 40);
  dci([[fiberA[0], 0.7, fiberA[1]], [hutA[0], 0.7, hutA[1]], [hutA[0], 0.7, 150], [-40, 0.7, 150], [-40, 0.7, nHalls > 1 ? 108 : -120], ...(nHalls > 1 ? [] : [[hallX0 + 4, 0.7, -120], [hallX0 + 4, 0.7, hallA.z1]])], 16);
  dci([[fiberB[0], 0.7, fiberB[1]], [hutB[0], 0.7, hutB[1]], [440, 0.7, -240], [hallX1 + 10, 0.7, -240], [hallX1 + 10, 0.7, -212]], 16);
  // duct bank cutaway where the hall-to-hall route crosses open ground: concrete encasement, 3 × 4 conduits
  const dataGroup = new THREE.Group(), D = new Builder();
  const dbX = -54, dbZ = -90, dbY = 0.15;              // set beside the route so the section reads on its own
  D.slab(0.9, 0.72, 1.2, MAT.concrete, dbX, dbY, dbZ);
  const cableMat = MAT.yellowTray, ductMat = new THREE.MeshStandardMaterial({ color: 0x3b3f44, roughness: 0.7 });
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
    const x = dbX - 0.285 + c * 0.19, y = dbY + 0.16 + r * 0.2;
    D.cylZ(0.057, 1.3, ductMat, x, y, dbZ, 18);                                           // 4-inch conduit, cut ends proud of the concrete
    if (r < 2) D.cylZ(0.035, 1.32, cableMat, x, y, dbZ, 14);                                // one high-count cable per conduit; top row spare
  }
  D.slab(1.6, 0.05, 2.6, MAT.gravel, dbX, dbY - 0.02, dbZ);                                   // trench floor
  // handhole a few meters on, where cables are spliced and slack is stored
  D.slab(1.4, 0.9, 1.1, MAT.concrete, dbX, dbY, dbZ + 4); D.slab(1.2, 0.02, 0.9, MAT.darkSteel, dbX, dbY + 0.9, dbZ + 4);
  dataGroup.add(D.build({ cast: false }));
  if (nHalls > 1) scene.add(dataGroup);

  // ---------- the rest of a big campus: representative authored hall exteriors ----------
  if (extra) {
    const z0 = -55 - (perCol - 1) * 120 / 2;
    const expansionMatrices=Array.from({length:extra},(_,i)=>mtx(750+Math.floor(i/perCol)*320,0,z0+(i%perCol)*120));
    // Conceptual campus distribution, not a surveyed Colossus routing plan.
    // Branches terminate at each representative hall envelope; no device or
    // conduit count/capacity is inferred from these aggregate utility symbols.
    const serviceNorth=z0-60, powerFeed=[[-40,uY,-62],[-40,uY,-55],[575,uY,-55],[575,uY,serviceNorth]],
      dataFeed=[[hallX1+10,.7,-212],[hallX1+10,.7,-240],[581,.7,-240],[581,.7,serviceNorth-4]];
    const expansionServices={basis:'assumed conceptual distribution; not a surveyed site topology',power:[],data:[]};
    const service=(points,kind,count)=>{
      const f=flow(points,kind,{count,speed:kind==='mv'?45:55,size:1.15,k:2.3,trailR:.28,trailK:.42});
      f.group.userData.conceptualExpansion=true;
      (kind==='mv'?flows:dataFlows).push(f);
      expansionServices[kind==='mv'?'power':'data'].push(points);
    };
    service([...powerFeed,[750+(cols-1)*320-146,uY,serviceNorth]],'mv',Math.max(30,cols*16));
    service([...dataFeed,[750+(cols-1)*320-140,.7,serviceNorth-4]],'dci',Math.max(30,cols*16));
    for(let c=0;c<cols;c++){
      const cx=750+c*320,rows=Math.min(perCol,extra-c*perCol),lastZ=z0+(rows-1)*120;
      service([[cx-146,uY,serviceNorth],[cx-146,uY,lastZ]],'mv',Math.max(16,rows*12));
      service([[cx-140,.7,serviceNorth-4],[cx-140,.7,lastZ]],'dci',Math.max(16,rows*12));
      for(let r=0;r<rows;r++){
        const z=z0+r*120;
        service([[cx-146,uY,z],[cx-130,uY,z]],'mv',4);
        service([[cx-140,.7,z-3],[cx-130,.7,z-3]],'dci',4);
      }
    }
    if(!warm){
      // Paired conceptual facility-water distribution from the existing central
      // plant. Return crosses beneath supply with 1.4m vertical separation.
      // Actual flow reverses on the warm leg so each hall returns heat to plant.
      expansionServices.cool=[];expansionServices.warm=[];
      const thermal=(points,kind,count)=>{
        expansionServices[kind].push(points);
        const f=flow(kind==='warm'?[...points].reverse():points,kind,{count,speed:24,size:.85,k:2.4,trailR:.24,trailK:.4});
        f.group.userData.conceptualExpansion=true;heatFlows.push(f);
      };
      thermal([[plantX+10,2.2,-236],[plantX+10,2.2,-229],[569,2.2,-229],[569,2.2,serviceNorth-8],[750+(cols-1)*320-154,2.2,serviceNorth-8]],'cool',Math.max(30,cols*16));
      thermal([[plantX-10,2.2,-236],[plantX-10,2.2,-233],[plantX-10,.8,-233],[563,.8,-233],[563,.8,serviceNorth-12],[750+(cols-1)*320-158,.8,serviceNorth-12]],'warm',Math.max(30,cols*16));
      for(let c=0;c<cols;c++){
        const cx=750+c*320,rows=Math.min(perCol,extra-c*perCol),lastZ=z0+(rows-1)*120;
        thermal([[cx-154,2.2,serviceNorth-8],[cx-154,2.2,lastZ+3]],'cool',Math.max(16,rows*12));
        thermal([[cx-158,.8,serviceNorth-12],[cx-158,.8,lastZ+6]],'warm',Math.max(16,rows*12));
        for(let r=0;r<rows;r++){
          const z=z0+r*120;
          thermal([[cx-154,2.2,z+3],[cx-130,2.2,z+3]],'cool',4);
          thermal([[cx-158,.8,z+6],[cx-130,.8,z+6]],'warm',4);
        }
      }
    }
    scene.userData.campusExpansionServices=expansionServices;

    if(authoredCampus)addBlenderCampusExpansion(scene,expansionMatrices,quality);
    else {
    const roofTex = canvasTex(512, 256, (g, w, h) => {
      g.fillStyle = '#8f9498'; g.fillRect(0, 0, w, h);
      if (warm) for (let r = 0; r < 3; r++) for (let i = 0; i < 18; i++) { g.fillStyle = '#3c4148'; g.fillRect(8 + i * 28, 40 + r * 64, 24, 14); g.fillStyle = '#1b1e22'; for (let f = 0; f < 3; f++) g.fillRect(10 + i * 28 + f * 8, 43 + r * 64, 6, 8); }
      else for (let r = 0; r < 2; r++) for (let i = 0; i < 9; i++) { g.fillStyle = '#5d6268'; g.beginPath(); g.arc(28 + i * 56, 80 + r * 96, 7, 0, Math.PI * 2); g.fill(); }
    });
    const roofMat = new THREE.MeshStandardMaterial({ map: roofTex, roughness: 0.85 });
    const geo = new THREE.BoxGeometry(260, 22, 90); geo.translate(0, 11.15, 0);
    const blocks = new THREE.InstancedMesh(geo, [wallEnd, wallEnd, roofMat, MAT.roof, wallMat, wallMat], extra);
    blocks.name='Expanded campus halls';
    expansionMatrices.forEach((m,i)=>blocks.setMatrixAt(i,m));
    blocks.castShadow = blocks.receiveShadow = true; scene.add(blocks);
    }
    const pads = new Builder();
    for (let c = 0; c < cols; c++) pads.slab(300, 0.1, perCol * 120 + 20, MAT.concreteDark, 750 + c * 320, 0.05, z0 + (perCol - 1) * 60);
    scene.add(pads.build({ cast: false }));
  }
  scene.userData.campusHallCounts={modeled:model.halls,detailed:nHalls,expansion:extra};
  // hall-to-hall: the two spines joined through the duct bank, both directions
  if (nHalls > 1) dataFlows.push(flow([[-44, 0.6, -128], [-44, 0.6, 12]], 'eth', { count: 22, speed: 30, size: 0.45, k: 2.2, trailR: 0.18 }));
  if (nHalls > 1) dataFlows.push(flow([[-47, 0.6, 12], [-47, 0.6, -128]], 'eth', { count: 22, speed: 30, size: 0.45, k: 2.2, trailR: 0.18 }));

  // ---------- parking, gatehouse, gate, lights, people, trees ----------
  // Parking pavement/entry curb are part of the connected road union.
  for (let x = -76; x <= 76; x += 3.2) for (const z of [150, 160, 180, 190]) N.slab(0.12, 0.06, 4.6, MAT.paint, x, 0.27, z);
  // No separate full-length lot curb crossing its entrance.
  const car = new Builder(); carBuild(car);
  const carMx = [];
  for (let x = -74; x <= 74; x += 3.2) for (const z of [155, 185]) if (rnd() < 0.62) { const m = mtx(x + 1.6, 0.27, z, Math.PI / 2); carMx.push(m); }
  if(hasCampusVehicles()) {
    // Keep the original occupied-vehicle count. One shuttle moves to a dedicated
    // 8.5 x 3.5m bay on the existing paved south edge, clear of z202 pedestrian path.
    const ordinary=carMx.slice(0,-1),fleet=['MODEL_3','MODEL_Y','CYBERCAB'];
    for(const [i,name] of fleet.entries())scene.add(campusVehicleInstances(name,ordinary.filter((_,j)=>j%3===i)));
    scene.add(campusVehicleInstances('ROBOVAN',[mtx(52,.27,196)]));
    for(const z of [194.25,197.75])N.slab(8.5,.025,.08,MAT.paint,52,.28,z);
    for(const x of [47.75,56.25])N.slab(.08,.025,3.5,MAT.paint,x,.28,196);
    scene.userData.blenderFleet={ordinaryCount:ordinary.length,robovanCount:1,total:carMx.length,robovanBay:{x:52,z:196,width:8.5,depth:3.5},representative:true};
  } else scene.add(car.instance(carMx));
  const gardenMotion = addCampusArchitecture({ scene, hallList, hallX0, hallX1, extra, quality, materials: architectureMaterials, authoredHall: authoredCampus });
  if (authoredCampus) addBlenderCampusArchitecture(scene, hallList, hallX0, hallX1, quality);
  S.slab(8, 3.6, 5, MAT.beige, -96, 0.15, 232); S.slab(10, 0.4, 7, MAT.roof, -96, 3.75, 232);
  N.slab(0.3, 1.1, 10, MAT.orange, -110, 0.15, 226);
  // swing gate at the south entry, where the access road meets the perimeter fence: two posts,
  // one leaf swung open at an angle so the drive reads as staffed rather than sealed
  for (const dx of [-6, 6]) N.cyl(0.1, 2.7, MAT.galv, -110 + dx, 1.35, 250, 8);
  N.strut([-116, 2.6, 250], [-116, 1.35, 261.5], 0.045, MAT.galv, 6);
  N.strut([-116, 1.35, 250], [-116, 1.35, 261.5], 0.045, MAT.galv, 6);
  // site lighting: pole heads on every light pole, plus warm lamps at the office and hall doors
  const lampItems = [];
  const streetLightPoles=[];
  const streetPole=(x,z,height,width,spill)=>{
    // Include pole radius plus a half-metre clearance, including apron edges.
    if(roadPlan.rects.some(r=>containsPlan(r,x,z,.62))||roadPlan.junctions.some(j=>Math.abs(j.x-x)<14&&Math.abs(j.z-z)<14))return;
    N.cyl(.12,height,MAT.galv,x,height/2,z,6);
    lampItems.push({p:[x,height-.1,z],w:width,...(spill?{spill}:{})});
    streetLightPoles.push({x,z,radius:.12});
  };
  for(let x=-350;x<=250;x+=50)for(const z of [-64,-46])streetPole(x,z,10,1.3);
  roadPlan.streetLightPoles=streetLightPoles;
  // Warm white architectural lighting stays visually distinct from the colored flows.
  for (let z = 5; z <= 235; z += 46) {
    streetPole(-121,z,8,1.1,34);
  }
  for (const x of [-554, -455, -367]) for (const z of [-227, -73]) {
    N.cyl(0.18, 14, MAT.galv, x, 7, z, 6);
    lampItems.push({ p: [x, 13.9, z], w: 2, spill: 58, ground: 0.42 });
  }
  for (let x = -65; x <= 65; x += 26) for (const z of [145, 195]) {
    N.cyl(0.09, 5, MAT.galv, x, 2.5, z, 6);
    lampItems.push({ p: [x, 4.9, z], w: 0.8, spill: 20 });
  }
  hallCentersZ.forEach(cz => lampItems.push({ p: [hallX0 - 1, 3.6, cz + 26], w: 1.0 }, { p: [hallX0 - 1, 3.6, cz - 26], w: 1.0 }));
  scene.add(lamps(lampItems, { color: '#ffdcad', k: 2.6, halo: 2.4, haloOpacity: 0.22 }));
  campusLightPools(scene, lampItems);
  if (!quality.mobile) for (const z of [-227, -73]) {
    const light = new THREE.PointLight(0xffd39a, 1800, 150, 2);
    light.position.set(-455, 13.5, z); scene.add(light);
  }
  for (let i = 0; i < 6; i++) person(N, -405 + i * 2.2, -140 + i * 1.3, i);
  person(N, 212, -104, 1.2); person(N, 214, -103, 2.2);
  const treeCount = quality.mobile ? 5 : 9;
  const treeMx = treeMatrices(rnd, {
    clusters: treeCount, perCluster: quality.mobile ? 26 : 48, distant: quality.mobile ? 90 : 190,
    minR: 550, maxR: 1500, distMinR: 1550, distMaxR: 1950,
    exclude: (x, z) => (x < -600 && Math.abs(z - towerZ) < 45)
      || (extra && x > 580 && x < reach + 100 && Math.abs(z + 55) < perCol * 60 + 30),
  });
  for (let i = 0; i < 80; i++) { const x = -620 + rnd() * 1100, z = 262 + rnd() * 90; treeMx.push(mtx(x, 0, z, rnd() * 6, 0.6 + rnd() * 0.6)); }
  campusTreeBelt(treeMx, rnd, { extra, perCol, mobile: quality.mobile });
  const roadsideTrees=treeMx.filter(m=>!roadPlan.rects.some(r=>containsPlan(r,m.elements[12],m.elements[14],10)));
  const woodlandMotion = campusWoodland(scene, roadsideTrees, quality);
  campusContactShade(scene, [
    ...hallList.flatMap(h => {
      const cz = (h.z0 + h.z1) / 2;
      return [[hcx, .17, cz, hallLen + 14, 104], [hallX0 - 14, .17, cz, 37, 68]];
    }),
    ...mptZ.map(z => [mptX, .66, z, 16, 18]),
    ...[-178, -122].map(z => [-378, .42, z, 13, 38]),
  ]);

  // ---------- activity: cars and a truck loop the site roads, a few people walk, clouds drift ----------
  moverGroups.push(movers(carBuild,roadPlan.carPaths,{speed:quality.mobile?9:11,perPath:quality.mobile?1:2}));
  // Catalog truck cab faces -X; movers orients +X along travel. Rotate the
  // owned builder geometry so the truck travels cab-first, not trailer-first.
  const forwardTruck=B=>{truckBuild(B);for(const parts of B.parts.values())for(const g of parts)g.rotateY(Math.PI);};
  moverGroups.push(movers(forwardTruck,roadPlan.truckPaths,{speed:6.5,perPath:quality.mobile?1:2}));
  const walkPaths = [
    [[-30, 0.16, 178], [-30, 0.16, 202], [-64, 0.16, 202], [-64, 0.16, 226], [-96, 0.16, 226], [-64, 0.16, 226], [-64, 0.16, 202], [-30, 0.16, 202], [-30, 0.16, 178]],
    [[hallX0 - 20, 0.16, hallCentersZ[0] + 40], [hallX0 - 1, 0.16, hallCentersZ[0] + 26], [hallX0 - 20, 0.16, hallCentersZ[0] + 40]],
  ];
  moverGroups.push(movers(walkerBuild, walkPaths, { speed: 1.3, perPath: quality.mobile ? 1 : 2 }));
  moverGroups.forEach(m => scene.add(m.group));

  // vapor plumes off the cooling-tower fans, visible in every layer (not just the heat overlay);
  // a phone skips this heavy, fully-transparent overdraw in favor of the fans and the flow lines alone
  if (!quality.mobile) {
    const plumeEmitters = towerRows.flatMap(z => Array.from({ length: 6 }, (_, i) => ({ p: [15 + i * 12, 13.6, z], dir: [0, 1, 0] })));
    if (plumeEmitters.length) {
    const towerPlumes = plumes(plumeEmitters, {
      perEmitter: 16, size: 1.4, grow: 4.5, life: 7, rise: 2.6,
      drift: [1.1, 0.4, 0.2], spread: 0.6, color: '#eef1f4', opacity: warm ? 0.28 : 0.4,
    });
    scene.add(towerPlumes.points); plumeUpdates.push(towerPlumes.update);
    }
  }

  // a handful of soft clouds catching the low sun (desktop only: full-screen alpha overdraw adds up on
  // a phone; skipped on the big-campus layout, whose camera pulls back far enough that a fixed-size
  // cloud sprite would loom instead of read as background). Anchored low and close rather than on a
  // wide 360° ring: every one of this scene's camera views pitches down at ground-level equipment, so
  // the only sky actually in frame is a narrow band near the horizon in the direction each view looks.
  // These three positions were solved for by re-projecting candidate points through every real
  // hotspot/overview camera and checking BOTH that the sprite lands inside the frame and that it stays
  // a small, background-sized thing there (<12°) rather than looming — a first pass covered the
  // transmission-line and substation hotspots too, but their cameras sit close enough to the west side
  // that any cloud visible there filled the whole frame like fog, which is the opposite of the fix.
  // Only the far one stays: the two over the site sat 90 m up, fog height, and read as smoke over the halls.
  let cloudDrift = null;
  if (!quality.mobile && !extra) {
    cloudDrift = clouds([[-2173, 150, -957, 220]]); scene.add(cloudDrift);
    for (const cloud of cloudDrift.children) { cloud.scale.y *= .3; cloud.material.opacity *= .45; }
  }

  scene.add(S.build({ cast: true, receive: true }));
  scene.add(N.build({ cast: false, receive: true }));
  flows.forEach(f => scene.add(f.group));
  dataFlows.forEach(f => scene.add(f.group));
  heatFlows.forEach(f => scene.add(f.group));
  const fans = spinners(fanItems, MAT.darkSteel, { speed: 3.2 }); if (authoredCampus) campusCatalogRotor(fans.mesh); scene.add(fans.mesh);

  const hallAz = hallCentersZ[0];
  // Fit the actual eastward expansion and the west grid approach. Keep the
  // close campus/infrastructure presets available for equipment inspection.
  const campusCenter=(-610+extentEast)/2;
  const wideTarget=[campusCenter,10,-55];
  // Look east from the detailed plant: it reads as the foreground, while the
  // repeated capacity halls recede into depth instead of flattening into a strip.
  // Fit actual bounds in camera space; retain every hall at all supported aspects.
  const overviewPoints=[];
  for(const x of [-610,470])for(const z of [-330,250])for(const y of [0,50])overviewPoints.push([x,y,z]);
  for(let i=0;i<extra;i++){
    const cx=750+Math.floor(i/perCol)*320,cz=-55-(perCol-1)*60+(i%perCol)*120;
    for(const x of [cx-150,cx+150])for(const z of [cz-55,cz+55])for(const y of [0,24])overviewPoints.push([x,y,z]);
  }
  scene.userData.campusOverviewBounds={points:overviewPoints,scope:'Campus compound and all modeled halls; off-campus transmission approach has its own detail view'};
  const wideView=(aspect,fov)=>{
    const out=new THREE.Vector3(-.82,.60,.48).normalize(),right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),out).normalize(),up=new THREE.Vector3().crossVectors(out,right).normalize();
    const tan=Math.tan(fov*Math.PI/360),target=new THREE.Vector3(...wideTarget);
    let distance=0;
    // Perspective makes the foreground wider than the distant expansion. Center
    // the projected occupied bounds, rather than the empty plan rectangle.
    for(let pass=0;pass<6;pass++){
      distance=0;
      for(const p of overviewPoints){
        const q=new THREE.Vector3(...p).sub(target),depth=q.dot(out);
        distance=Math.max(distance,Math.abs(q.dot(right))/(tan*aspect*.94)+depth,Math.abs(q.dot(up))/(tan*.94)+depth);
      }
      distance*=1.01;
      if(pass===5)break;
      const projected=overviewPoints.map(p=>{const q=new THREE.Vector3(...p).sub(target),depth=distance-q.dot(out);return [q.dot(right)/(depth*tan*aspect),q.dot(up)/(depth*tan)];});
      const cx=(Math.min(...projected.map(p=>p[0]))+Math.max(...projected.map(p=>p[0])))/2,
        cy=(Math.min(...projected.map(p=>p[1]))+Math.max(...projected.map(p=>p[1])))/2;
      target.addScaledVector(right,cx*distance*tan*aspect).addScaledVector(up,cy*distance*tan);
    }
    return {pos:target.clone().addScaledVector(out,distance).toArray(),target:target.toArray()};
  };
  const campusWide={...wideView(1.6,35),compact:wideView(947/850,35),portrait:wideView(.55,48)};
  finalizeSiteGeometry(scene);
  const built = {
    scene, flows,
    cinematography: { compactPins: true, views: {
      campus: extra ? campusWide : { pos: [560, 240, 670], target: [-40, 10, -70], portrait: { pos: [650, 360, 780], target: [-60, 15, -50] } },
      infrastructure: extra
        ? { pos: [reach * 0.55, reach * 0.42, reach * 0.62], target: [reach * 0.3 - 300, 0, -120] }
        : { pos: [700, 470, 790], target: [-60, 18, -50], portrait: { pos: [1120, 930, 1400], target: [-60, 18, -50] } },
      primary: { pos: [-420, 320, 570], target: [-30, 13, -80], compact: { pos: [-560, 460, 780], target: [-30, 13, -80] }, portrait: { pos: [-710, 670, 990], target: [-30, 13, -80] } },
      arrival: { pos: [-250, 60, 335], target: [-80, 8, 105], portrait: { pos: [-370, 125, 475], target: [-90, 8, 120] } },
    } },
    camera: extra
      ? { ...campusWide, near: 0.2, far: Math.max(9000, span * 6), min: 3, max: Math.max(2600, span * 3.2) }
      : { pos: [560, 240, 670], target: [-40, 10, -70], near: 0.2, far: 9000, min: 3, max: 2600,
        portrait: { pos: [650, 360, 780], target: [-60, 15, -50] } },
    hotspots: {
      line: { pos: [-990, 50, towerZ], view: { pos: [-1100, 120, 40], target: [-800, 30, -150] } },
      substation: { pos: [-500, 22, -150], view: { pos: [-360, 120, 60], target: [-480, 5, -150] } },
      mpt: { pos: [-418, 16, -150], view: { pos: [-388, 23, -112], target: [-418, 6, -150] } },
      ehouse: { pos: [-378, 8, -150], view: { pos: [-320, 40, -60], target: [-380, 2, -150] } },
      ...(L.gensets ? {
        gensets: { pos: [320, 10, -190], view: { pos: [440, 90, -60], target: [320, 0, -150] } },
        fuel: { pos: [397, 9, -100], view: { pos: [480, 50, -40], target: [397, 0, -100] } },
      } : {}),
      bess: batteryYard ? { pos: [350, 6, -150], view: { pos: [480, 120, -10], target: [350, 0, -150] } } : { pos: [-316, 6, 75], view: { pos: [-250, 60, 170], target: [-315, 0, 75] } },
      unitsubs: { pos: [hcx, 5, -115], view: { pos: [hcx + 20, 30, -40], target: [hcx, 0, -110] } },
      hall: { pos: [hcx, 26, hallAz], view: { pos: [hcx + 160, 170, 120], target: [hcx, 10, -120] } },
      ...(warm ? { drycoolers: { pos: [Math.min(60, hcx), 26, -170], view: { pos: [Math.min(60, hcx) + 60, 70, -90], target: [Math.min(60, hcx), 20, -170] } } } : { chillers: { pos: [plantX, 13, -245], view: { pos: [plantX + 70, 70, -160], target: [plantX - 10, 5, -250] } } }),
      ...(towerRows.length ? {
        towers: { pos: [45, 13, -275], view: { pos: [110, 60, -200], target: [70, 5, -275] } },
      } : {}),
      fiber: { pos: [fiberA[0], 3, fiberA[1]], view: { pos: [-60, 60, 330], target: [-120, 0, 200] } },
      security:{pos:[-96,4.2,232],view:{pos:[-140,20,290],target:[-103,3,241]}},
      ops:{pos:[opsAnt.x,opsAnt.roofY+3,opsAnt.z],view:{pos:[hallX0-89,42,hallAz+85],target:[hallX0-14,8,hallAz]}},
    },
    dataFlows, heatFlows, layers: { data: dataGroup },
    heatHotspots: {
      ...(warm ? { drycoolers: { pos: [Math.min(60, hcx), 26, -170], view: { pos: [Math.min(60, hcx) + 80, 90, -60], target: [Math.min(60, hcx), 25, -170] } } } : { chillers: { pos: [plantX, 13, -245], view: { pos: [plantX + 70, 70, -160], target: [plantX - 10, 5, -250] } } }),
      ...(towerRows.length ? {
        towers: { pos: [45, 13, -275], view: { pos: [110, 60, -200], target: [70, 20, -275] } },
      } : {}),
      plume: { pos: [hcx, 70, -170], view: { pos: [hcx + 220, 160, 80], target: [hcx, 40, -110] } },
      reuse: { pos: [hallX0 - 28, 18, 60], view: { pos: [-160, 80, 180], target: [-40, 10, 60] } },
    },
    dataHotspots: {
      fiber: { pos: [fiberA[0], 3, fiberA[1]], view: { pos: [-60, 60, 330], target: [-120, 0, 200] } },
      dci: { pos: [hutA[0], 6, hutA[1]], view: { pos: [-130, 40, 290], target: [hutA[0], 0, hutA[1]] } },
      ...(nHalls > 1 ? { interhall: { pos: [-45, 3, -58], view: { pos: [40, 70, 60], target: [-45, 0, -58] } } } : {}),
      ...(nHalls > 1 ? { ductbank: { pos: [-54, 1.1, -90], view: { pos: [-57.2, 1.9, -87.4], target: [-54, 0.45, -89.2] } } } : {}),
      hall: { pos: [hcx, 26, hallAz], view: { pos: [hcx + 160, 170, 120], target: [hcx, 10, -120] } },
      border:{pos:[borderX,4.2,borderZ],view:{pos:[borderX+70,45,borderZ+70],target:[borderX,3,borderZ]}},
      longhaul: { pos: [fiberA[0], 3, 520], view: { pos: [200, 260, 900], target: [-150, 0, 420] } },
    },
    look: { env: 'sky', envIntensity: 0.75, exposure: 1.08, bloom: 0.7, threshold: 1.4, ao: 0, grain: 0.006, vignette: 0.18, dof: true },
    update(t, dt) {
      woodlandMotion(t); gardenMotion(t);
      if (cloudDrift && !quality.reduced) cloudDrift.position.x = Math.sin(t * .008) * 35;
      fans.update(t);
      moverGroups.forEach(m => m.update(t));
      plumeUpdates.forEach(u => u(t));
    },
  };
  attachFlowRibbons(built, { width: 2.4, glow: 5.8, brightness: 2.65, mobile: quality.mobile });
  return built;
}
