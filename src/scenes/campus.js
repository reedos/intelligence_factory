// Scene 1: grid & campus. Units are meters. x runs east, z runs south, y up.
import { THREE, MAT, Builder, mtx, flow, insulator, latticeTower, catenary, wires, canvasTex, sky, person, glowMat, spinners } from '../kit.js';
import { rbox, lamps, plumes, movers } from '../fx.js';
import { terrainTexture, clouds, treeMatrices, carBuild, truckBuild, walkerBuild } from './campus-detail.js';

export function build({ quality, model }) {
  const L = model.layout, warm = model.cooling.id === 'warm';
  const nHalls = Math.min(2, model.halls), extra = Math.max(0, model.halls - 2);
  // halls beyond the two drawn in detail stand as plain blocks east of the site, in columns
  const perCol = Math.min(12, Math.max(2, Math.ceil(Math.sqrt(extra / 1.2)))), cols = Math.ceil(extra / perCol);
  const reach = extra ? 620 + cols * 320 : 0;
  const scene = new THREE.Scene();
  // golden-hour haze: warm and thin close in, so it reads as atmosphere rather than murk
  scene.fog = new THREE.Fog(0x372c26, Math.max(1900, reach * 0.9), Math.max(6200, reach * 2.4));
  scene.add(sky('#070d19', '#1a2742', '#b9794f'));

  // light: a real golden hour — a low, warm sun with long shadows, cool sky fill for the shadow side
  scene.add(new THREE.HemisphereLight(0x8fa8d6, 0x2a2318, 0.85));
  const sun = new THREE.DirectionalLight(0xffb27a, 2.35);
  sun.position.set(-1250, 430, 500); sun.target.position.set(-60, 0, -60);
  if (quality.shadows) {
    sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
    Object.assign(sun.shadow.camera, { left: -760, right: 760, top: 520, bottom: -520, near: 100, far: 3000 });
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6;
  }
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0x7f9cff, 0.38); fill.position.set(600, 300, 800); scene.add(fill);

  const flows = [], dataFlows = [], heatFlows = [];
  const moverGroups = [], plumeUpdates = [];
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const SITE = MAT.gravel;         // graded pad: shared, already-textured material, so it still reads lit at dusk
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
  S.slab(1080, 0.15, 580, SITE, -70, 0, -40);                              // graded site
  const road = (w, d, x, z) => S.slab(w, 0.1, d, MAT.asphalt, x, 0.15, z);
  road(760, 14, -20, -55);            // spine road between halls
  road(14, 330, -110, 90);            // south entry
  road(14, 250, 262, -60);            // east road by generators
  road(170, 12, -445, -30);           // substation access
  road(12, 120, -360, 80);            // to battery yard
  // lane stripes and a dashed centerline on the two main roads, plus low curbs along their edges
  for (let x = -380; x < 350; x += 14) N.slab(6, 0.04, 0.25, MAT.paint, x, 0.25, -55);
  for (let x = -373; x < 345; x += 16) N.slab(3.2, 0.04, 0.35, MAT.paint, x, 0.25, -55);
  for (const zc of [-55 - 8, -55 + 8]) N.slab(760, 0.15, 0.35, MAT.concrete, -20, 0.15, zc);
  for (let z = -70; z < 250; z += 16) N.slab(0.35, 0.04, 3.2, MAT.paint, -110, 0.25, z);
  for (const xc of [-110 - 8, -110 + 8]) N.slab(0.35, 0.15, 330, MAT.concrete, xc, 0.15, 90);

  // perimeter fence: posts and top rail
  const fence = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(len / 6);
    for (let i = 0; i <= n; i++) { const u = i / n; N.cyl(0.05, 2.4, MAT.galv, x0 + (x1 - x0) * u, 1.2, z0 + (z1 - z0) * u, 5); }
    N.strut([x0, 2.4, z0], [x1, 2.4, z1], 0.03, MAT.galv, 4);
    N.strut([x0, 1.2, z0], [x1, 1.2, z1], 0.02, MAT.galv, 4);
  };
  fence(-610, -330, 470, -330); fence(470, -330, 470, 250); fence(470, 250, -100, 250); fence(-120, 250, -610, 250); fence(-610, 250, -610, -330);

  // ---------- transmission line from the west ----------
  const tower = new Builder();
  const tips = latticeTower(tower, 46, 9);
  const towerXs = [-640, -990, -1340, -1690, -2040, -2390, -2740];
  const towerZ = -150;
  tower.instance(towerXs.map(x => mtx(x, 0, towerZ, Math.PI / 2))).children.forEach(m => scene.add(m));
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
  fence(-567, -235, -357, -235); fence(-357, -235, -357, -65); fence(-357, -65, -567, -65); fence(-567, -65, -567, -235);
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
  mptZ.forEach(z => {
    S.slab(14, 0.55, 16, MAT.concreteDark, mptX, 0, z);           // oil containment, curb above the gravel
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
    for (const dz of [-2.6, 0, 2.6]) insulator(N, mptX - 2.2, 7.3, z + dz, 5.2, 0.3, MAT.porcelain);   // HV bushings
    insulator(N, mptX - 2.2, 7.3, z + 4, 2.4, 0.18, MAT.porcelain);                                      // neutral
    for (const dz of [-2, 0, 2]) insulator(N, mptX + 2.6, 7.3, z + dz, 1.8, 0.22, MAT.porcelain);      // 34.5 kV bushings
    S.slab(1.2, 2, 0.9, MAT.ansi61, mptX + 3.5, 0.8, z + 3.8);    // control cabinet
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
  // a lone hall is drawn only as long as its load needs, 45 MW to a full 260 m hall
  const hallLen = nHalls === 1 ? Math.round(Math.max(70, Math.min(260, 260 * model.IT_MW / 45))) : 260;
  const hallX0 = -30, hallX1 = hallX0 + hallLen, hcx = (hallX0 + hallX1) / 2, hallA = { z0: -215, z1: -125 }, hallB = { z0: 15, z1: 105 };
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
    g.fillStyle = '#9aa1a8'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) { g.fillStyle = x % 64 === 0 ? '#80878e' : '#8f969d'; g.fillRect(x, 0, 2, h); }
    g.fillStyle = '#50565d'; g.fillRect(0, 26, w, 34);                                // louver band
    for (let y = 28; y < 60; y += 4) { g.fillStyle = '#3c4148'; g.fillRect(0, y, w, 1.5); }
    g.fillStyle = '#2d3238'; for (let x = 60; x < w; x += 250) g.fillRect(x, h - 58, 34, 58);   // doors
    g.fillStyle = '#6d747b'; g.fillRect(0, h - 6, w, 6);
  }, { repeat: [6.5, 1] });
  const facadeEnd = facade.clone(); facadeEnd.repeat.set(2.25, 1); facadeEnd.needsUpdate = true;
  const wallMat = new THREE.MeshStandardMaterial({ map: facade, roughness: 0.75, metalness: 0.1 });
  const wallEnd = new THREE.MeshStandardMaterial({ map: facadeEnd, roughness: 0.75, metalness: 0.1 });
  const officeTex = canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#16202b'; g.fillRect(0, 0, w, h);
    for (let y = 8; y < h; y += 32) for (let x = 6; x < w; x += 22) { const lit = Math.random() < 0.55; g.fillStyle = lit ? '#ffd9a0' : '#233242'; g.fillRect(x, y, 16, 22); }
  }, { repeat: [2, 1] });
  const officeMat = new THREE.MeshStandardMaterial({ color: 0x1b2633, roughness: 0.15, metalness: 0.6, emissive: 0xffffff, emissiveMap: officeTex, emissiveIntensity: 0.55 });

  const coolerUnit = new Builder();
  coolerUnit.slab(11.6, 0.3, 2.3, MAT.darkSteel, 0, 0, 0);
  for (const dz of [-0.95, 0.95]) coolerUnit.box(11.6, 1.8, 0.12, MAT.steel, 0, 1.2, dz, 0, dz > 0 ? 0.35 : -0.35); // V coils
  coolerUnit.slab(11.6, 0.2, 2.4, MAT.galv, 0, 2.1, 0);
  for (let i = 0; i < 6; i++) { coolerUnit.cyl(0.9, 0.35, MAT.galv, -4.9 + i * 1.96, 2.45, 0, 20); coolerUnit.cyl(0.8, 0.36, MAT.fan, -4.9 + i * 1.96, 2.46, 0, 20); }
  for (const x of [-5.6, 5.6]) for (const z of [-1, 1]) coolerUnit.slab(0.15, 0.4, 0.15, MAT.galv, x, -0.4, z);

  const coolerMx = [];
  const unitSub = new Builder();
  unitSub.slab(4, 0.3, 4, MAT.concrete, 0, 0, 0);
  unitSub.slab(2.3, 2.1, 1.9, MAT.ansi61, 0, 0.3, -0.3);
  for (let f = 0; f < 8; f++) unitSub.slab(0.05, 1.4, 0.6, MAT.ansi61, -1 + f * 0.28, 0.6, 0.95);
  unitSub.slab(0.8, 0.6, 0.6, MAT.darkSteel, 0.6, 2.4, -0.3);
  const unitSubMx = [];
  const hallCentersZ = [];

  const hallList = [hallA, hallB].slice(0, nHalls);
  hallList.forEach((h, hi) => {
    const cz = (h.z0 + h.z1) / 2, cx = (hallX0 + hallX1) / 2, W = hallX1 - hallX0, D = h.z1 - h.z0, H = 22;
    hallCentersZ.push(cz);
    const shell = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), [wallEnd, wallEnd, MAT.roof, MAT.roof, wallMat, wallMat]);
    shell.position.set(cx, H / 2 + 0.15, cz); shell.castShadow = shell.receiveShadow = true; scene.add(shell);
    // parapet and roof equipment
    S.slab(W, 1.4, 0.4, MAT.wall, cx, H, h.z0 + 0.2); S.slab(W, 1.4, 0.4, MAT.wall, cx, H, h.z1 - 0.2);
    S.slab(0.4, 1.4, D, MAT.wall, hallX0 + 0.2, H, cz); S.slab(0.4, 1.4, D, MAT.wall, hallX1 - 0.2, H, cz);
    if (warm) {
      for (let r = 0; r < 3; r++) for (let i = 0; i < Math.floor((W - 18) / 13.5) + 1; i++) coolerMx.push(mtx(hallX0 + 12 + i * 13.5, H + 0.6, h.z0 + 22 + r * 23));
      // roof walkways and pipe racks to the coolers
      for (let r = 0; r < 3; r++) N.cylX(0.35, W - 20, MAT.pipeInsul, cx, H + 1.2, h.z0 + 22 + r * 23 + 2.2, 10);
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
    const office = new THREE.Mesh(new THREE.BoxGeometry(28, 16, 60), officeMat);
    office.position.set(hallX0 - 14, 8.15, cz); office.castShadow = office.receiveShadow = true; scene.add(office);
    S.slab(29, 0.6, 61, MAT.roof, hallX0 - 14, 16.15, cz);
    // loading dock on the east end, with a stair down from the platform for the personnel door
    for (let i = 0; i < 4; i++) N.slab(0.3, 4.5, 3.6, MAT.darkSteel, hallX1 + 0.2, 0.15, cz - 20 + i * 5);
    S.slab(8, 0.6, 26, MAT.concrete, hallX1 + 4, 0.15, cz - 12);
    for (let k = 0; k < 3; k++) rslab(N, 1.6, 0.25, 0.55, MAT.concrete, hallX1 + 8.3 + k * 0.55, 0.5 - k * 0.25, cz - 12, 0, 0.2);
    N.strut([hallX1 + 8, 0.2, cz - 12.9], [hallX1 + 8, 1, cz - 12.9], 0.035, MAT.galv, 6);
    N.strut([hallX1 + 8, 0.2, cz - 11.1], [hallX1 + 8, 1, cz - 11.1], 0.035, MAT.galv, 6);
  });
  coolerUnit.instance(coolerMx, { cast: true }).children.forEach(m => scene.add(m));
  // the coolers' fans turn: six per unit, just above each fan ring
  const fanItems = [], fp = new THREE.Vector3();
  coolerMx.forEach(mx => { for (let i = 0; i < 6; i++) { fp.set(-4.9 + i * 1.96, 2.67, 0).applyMatrix4(mx); fanItems.push({ p: fp.toArray(), axis: 'y', r: 0.74 }); } });
  // heat: warm water up to the cooler rows, plumes of warm air above them
  if (warm) hallList.forEach(h => {
    const Hh = 22;
    for (let r = 0; r < 3; r++) {
      const pz = h.z0 + 22 + r * 23 + 2.2;
      heatFlows.push(flow([[hallX0 + 5, Hh + 1.2, (h.z0 + h.z1) / 2], [hallX0 + 10, Hh + 1.2, pz], [hallX1 - 10, Hh + 1.2, pz]], 'warm', { count: 30, speed: 30, size: 0.8, k: 2.4, trailR: 0.3, trailK: 0.4 }));
      for (let i = 0; i < Math.floor((hallLen - 18) / 13.5) + 1; i += 2) {
        const x = hallX0 + 12 + i * 13.5, z = h.z0 + 22 + r * 23;
        heatFlows.push(flow([[x, Hh + 3.5, z], [x + 3, Hh + 22, z - 2], [x + 8, Hh + 50, z - 6]], 'air', { count: 5, speed: 7, size: 2.4, k: 2.0, opacity: 0.6, trail: false }));
      }
    }
  });
  const towerRows = warm ? [-275] : [-275, -290];
  const plantX = Math.max(hallX0 + 45, Math.min(100, hcx + 20));
  towerRows.forEach(tz => { for (let i = 0; i < 6; i++) { const x = 15 + i * 12; heatFlows.push(flow([[x, 11.5, tz], [x + 2, 35, tz - 3], [x + 6, 65, tz - 9]], 'vapor', { count: warm ? 5 : 7, speed: 6, size: 2.4, k: 1.2, opacity: warm ? 0.4 : 0.55, trail: false })); } });
  if (!warm) {
    // chiller plant between hall A and the towers: warm return in, cold supply back, heat on to the towers
    heatFlows.push(flow([[plantX - 10, 2.2, -215], [plantX - 10, 2.2, -236]], 'warm', { count: 14, speed: 10, size: 0.8, k: 2.4, trailR: 0.3 }));
    heatFlows.push(flow([[plantX + 10, 2.2, -236], [plantX + 10, 2.2, -215]], 'cool', { count: 14, speed: 10, size: 0.8, k: 2.4, trailR: 0.3 }));
    heatFlows.push(flow([[plantX - 20, 2.2, -254], [plantX - 20, 2.2, -262], [15, 2.2, -262], [15, 9, -275]], 'warm', { count: 18, speed: 14, size: 0.8, k: 2.4, trailR: 0.3 }));
  }
  heatFlows.push(flow([[125, 1, -280], [80, 1, -280], [80, 1, -275], [20, 1, -275]], 'cool', { count: 10, speed: 12, size: 0.6, k: 2.2, trailR: 0.2 }));
  unitSub.instance(unitSubMx).children.forEach(m => scene.add(m));

  // ---------- generator yard and fuel ----------
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
  genset.instance(gensetMx).children.forEach(m => scene.add(m));
  // fuel farm
  for (let i = 0; i < 6; i++) {
    const x = 390 + (i % 2) * 14, z = -120 + Math.floor(i / 2) * 18;
    S.slab(12, 0.4, 16, MAT.concreteDark, x, 0.15, z);
    for (const dz of [-3.5, 3.5]) S.slab(1.2, 1.4, 5, MAT.concrete, x, 0.5, z + dz);
    S.cylZ(2.2, 13.5, MAT.white, x, 4.0, z, 24);
  }
  S.slab(6, 2.4, 3, MAT.steel, 405, 0.15, -145);                             // fuel polishing skid
  // standby flow: generators to the MV network (dim, slow)
  flows.push(flow([[285, uY, -170], [262, uY, -170], [262, uY, -112], [225, uY, -112]], 'mv', { count: 10, speed: 12, size: 1.0, k: 0.8, opacity: 0.45, trailK: 0.15, role: 'standby' }));
  if (gensetMx.length > 20) flows.push(flow([[285, uY, 40], [262, uY, 40], [262, uY, 3], [225, uY, 3]], 'mv', { count: 10, speed: 12, size: 1.0, k: 0.8, opacity: 0.45, trailK: 0.15, role: 'standby' }));

  // ---------- battery storage yard ----------
  const bessBox = new Builder();
  bessBox.slab(6.5, 0.3, 3.2, MAT.concrete, 0, 0, 0);
  rslab(bessBox, 6.06, 2.6, 2.44, MAT.white, 0, 0.3, 0, 0, 0.05);
  for (let x = -2.8; x <= 2.8; x += 0.7) bessBox.slab(0.1, 2.5, 0.06, MAT.white, x, 0.35, 1.25);
  for (const x of [-3.2, 3.2]) bessBox.slab(0.4, 1.8, 1.8, MAT.darkSteel, x, 0.6, 0);
  const bessMx = [];
  for (let c = 0; c < 5; c++) for (let r = 0; r < 4; r++) if (bessMx.length < Math.min(20, Math.max(2, Math.ceil(L.bessMWh / 2)))) bessMx.push(mtx(-335 + c * 9, 0.15, 55 + r * 14));
  bessBox.instance(bessMx).children.forEach(m => scene.add(m));
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
  if (!warm) {
    // chiller plant: a long shed with louvered walls, headers to hall A and to the towers
    S.slab(60, 11, 18, MAT.white, plantX, 0.15, -245); S.slab(61, 0.5, 19, MAT.roof, plantX, 11.15, -245);
    for (let i = 0; i < 10; i++) N.slab(4, 3.2, 0.1, MAT.darkSteel, plantX - 25 + i * 5.6, 6, -235.95);
    for (let i = 0; i < 6; i++) N.cyl(1.1, 1.2, MAT.galv, plantX - 24 + i * 9.5, 12.2, -245, 14);
    for (const dx of [-10, 10]) S.cylZ(0.6, 21, dx < 0 ? MAT.pipeRed : MAT.pipeBlue, plantX + dx, 2.2, -225.5, 12);
    S.cylZ(0.6, 8, MAT.pipeRed, plantX - 20, 2.2, -258); S.cylX(0.6, plantX - 35, MAT.pipeRed, (plantX - 20 + 15) / 2, 2.2, -262);
  }
  for (const [x, z] of [[125, -280], [158, -280]]) { S.cyl(13, 12, MAT.galv, x, 6.15, z, 36); S.add(new THREE.ConeGeometry(13.2, 2.2, 36), MAT.galv, x, 13.25, z); }
  S.slab(18, 5, 12, MAT.beige, 190, 0.15, -280);                              // water treatment building

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
  const dci = (pts, n) => dataFlows.push(flow(pts, 'dci', { count: n, speed: 45, size: 0.9, k: 2.2, trailK: 0.35, trailR: 0.3 }));
  dci([[fiberA[0], 0.7, 900], [fiberA[0], 0.7, fiberA[1]]], 40);
  dci([[fiberB[0], 0.7, -1100], [fiberB[0], 0.7, fiberB[1]]], 40);
  dci([[fiberA[0], 0.7, fiberA[1]], [hutA[0], 0.7, hutA[1]], [hutA[0], 0.7, 150], [-40, 0.7, 150], [-40, 0.7, 108]], 16);
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

  // ---------- the rest of a big campus: plain hall blocks east of the site ----------
  if (extra) {
    const roofTex = canvasTex(512, 256, (g, w, h) => {
      g.fillStyle = '#8f9498'; g.fillRect(0, 0, w, h);
      if (warm) for (let r = 0; r < 3; r++) for (let i = 0; i < 18; i++) { g.fillStyle = '#3c4148'; g.fillRect(8 + i * 28, 40 + r * 64, 24, 14); g.fillStyle = '#1b1e22'; for (let f = 0; f < 3; f++) g.fillRect(10 + i * 28 + f * 8, 43 + r * 64, 6, 8); }
      else for (let r = 0; r < 2; r++) for (let i = 0; i < 9; i++) { g.fillStyle = '#5d6268'; g.beginPath(); g.arc(28 + i * 56, 80 + r * 96, 7, 0, Math.PI * 2); g.fill(); }
    });
    const roofMat = new THREE.MeshStandardMaterial({ map: roofTex, roughness: 0.85 });
    const geo = new THREE.BoxGeometry(260, 22, 90); geo.translate(0, 11.15, 0);
    const blocks = new THREE.InstancedMesh(geo, [wallEnd, wallEnd, roofMat, MAT.roof, wallMat, wallMat], extra);
    const z0 = -55 - (perCol - 1) * 120 / 2;
    for (let i = 0; i < extra; i++) blocks.setMatrixAt(i, mtx(750 + Math.floor(i / perCol) * 320, 0, z0 + (i % perCol) * 120));
    blocks.castShadow = blocks.receiveShadow = true; scene.add(blocks);
    const pads = new Builder();
    for (let c = 0; c < cols; c++) pads.slab(300, 0.1, perCol * 120 + 20, MAT.concreteDark, 750 + c * 320, 0.05, z0 + (perCol - 1) * 60);
    scene.add(pads.build({ cast: false }));
  }
  // hall-to-hall: the two spines joined through the duct bank, both directions
  if (nHalls > 1) dataFlows.push(flow([[-44, 0.6, -128], [-44, 0.6, 12]], 'eth', { count: 22, speed: 30, size: 0.45, k: 2.2, trailR: 0.18 }));
  if (nHalls > 1) dataFlows.push(flow([[-47, 0.6, 12], [-47, 0.6, -128]], 'eth', { count: 22, speed: 30, size: 0.45, k: 2.2, trailR: 0.18 }));

  // ---------- parking, gatehouse, gate, lights, people, trees ----------
  S.slab(160, 0.12, 60, MAT.asphalt, 0, 0.15, 170);
  for (let x = -76; x <= 76; x += 3.2) for (const z of [150, 160, 180, 190]) N.slab(0.12, 0.06, 4.6, MAT.paint, x, 0.27, z);
  N.slab(0.35, 0.1, 82, MAT.concrete, -78, 0, 170); N.slab(0.35, 0.1, 82, MAT.concrete, 78, 0, 170);   // lot curbs
  const car = new Builder(); carBuild(car);
  const carMx = [];
  for (let x = -74; x <= 74; x += 3.2) for (const z of [155, 185]) if (rnd() < 0.62) { const m = mtx(x + 1.6, 0.27, z, Math.PI / 2); carMx.push(m); }
  car.instance(carMx).children.forEach(m => scene.add(m));
  S.slab(8, 3.6, 5, MAT.beige, -96, 0.15, 232); S.slab(10, 0.4, 7, MAT.roof, -96, 3.75, 232);
  N.slab(0.3, 1.1, 10, MAT.orange, -110, 0.15, 226);
  // swing gate at the south entry, where the access road meets the perimeter fence: two posts,
  // one leaf swung open at an angle so the drive reads as staffed rather than sealed
  for (const dx of [-6, 6]) N.cyl(0.1, 2.7, MAT.galv, -110 + dx, 1.35, 250, 8);
  N.strut([-116, 2.6, 250], [-104.5, 1.35, 254.2], 0.045, MAT.galv, 6);
  N.strut([-116, 1.35, 250], [-104.5, 1.35, 254.2], 0.045, MAT.galv, 6);
  // site lighting: pole heads on every light pole, plus warm lamps at the office and hall doors
  const lampItems = [];
  for (let x = -350; x <= 250; x += 50) for (const z of [-64, -46]) { N.cyl(0.12, 10, MAT.galv, x, 5, z, 6); lampItems.push({ p: [x, 9.9, z], w: 1.3 }); }
  hallCentersZ.forEach(cz => lampItems.push({ p: [hallX0 - 1, 3.6, cz + 26], w: 1.0 }, { p: [hallX0 - 1, 3.6, cz - 26], w: 1.0 }));
  scene.add(lamps(lampItems, { color: '#ffcf9e', k: 3.6, halo: 4, haloOpacity: 0.4 }));
  for (let i = 0; i < 6; i++) person(N, -405 + i * 2.2, -140 + i * 1.3, i);
  person(N, 212, -104, 1.2); person(N, 214, -103, 2.2);
  // a touch lighter than the shared MAT.tree so canopies still read against the dusk haze
  const treeCanopy = new THREE.MeshStandardMaterial({ color: 0x37522c, roughness: 0.92 });
  const tree = new Builder();
  tree.cyl(0.35, 3, MAT.trunk, 0, 1.5, 0, 6); tree.add(new THREE.ConeGeometry(3.4, 11, 8), treeCanopy, 0, 8, 0);
  const treeCount = quality.mobile ? 5 : 9;
  const treeMx = treeMatrices(rnd, {
    clusters: treeCount, perCluster: quality.mobile ? 26 : 48, distant: quality.mobile ? 90 : 190,
    minR: 550, maxR: 1500, distMinR: 1550, distMaxR: 1950,
    exclude: (x, z) => x < -600 && Math.abs(z - towerZ) < 45,
  });
  for (let i = 0; i < 80; i++) { const x = -620 + rnd() * 1100, z = 262 + rnd() * 90; treeMx.push(mtx(x, 0, z, rnd() * 6, 0.6 + rnd() * 0.6)); }
  tree.instance(treeMx, { cast: true }).children.forEach(m => scene.add(m));

  // ---------- activity: cars and a truck loop the site roads, a few people walk, clouds drift ----------
  const carPaths = [
    [[-114, 0.28, -60], [-114, 0.28, 230], [-106, 0.28, 230], [-106, 0.28, -60], [-114, 0.28, -60]],
    [[258, 0.28, -175], [258, 0.28, 55], [266, 0.28, 55], [266, 0.28, -175], [258, 0.28, -175]],
  ];
  moverGroups.push(movers(carBuild, carPaths, { speed: quality.mobile ? 9 : 11, perPath: quality.mobile ? 1 : 2 }));
  const truckPaths = [[[-372, 0.32, -59], [326, 0.32, -59], [326, 0.32, -51], [-372, 0.32, -51], [-372, 0.32, -59]]];
  moverGroups.push(movers(truckBuild, truckPaths, { speed: 6.5, perPath: quality.mobile ? 1 : 2 }));
  const walkPaths = [
    [[-30, 0.16, 178], [-30, 0.16, 226], [-96, 0.16, 226], [-30, 0.16, 226], [-30, 0.16, 178]],
    [[hallX0 - 20, 0.16, hallCentersZ[0] + 40], [hallX0 - 1, 0.16, hallCentersZ[0] + 26], [hallX0 - 20, 0.16, hallCentersZ[0] + 40]],
  ];
  moverGroups.push(movers(walkerBuild, walkPaths, { speed: 1.3, perPath: quality.mobile ? 1 : 2 }));
  moverGroups.forEach(m => scene.add(m.group));

  // vapor plumes off the cooling-tower fans, visible in every layer (not just the heat overlay);
  // a phone skips this heavy, fully-transparent overdraw in favor of the fans and the flow lines alone
  if (!quality.mobile) {
    const plumeEmitters = towerRows.flatMap(z => Array.from({ length: 6 }, (_, i) => ({ p: [15 + i * 12, 13.6, z], dir: [0, 1, 0] })));
    const towerPlumes = plumes(plumeEmitters, {
      perEmitter: 16, size: 1.4, grow: 4.5, life: 7, rise: 2.6,
      drift: [1.1, 0.4, 0.2], spread: 0.6, color: '#eef1f4', opacity: warm ? 0.28 : 0.4,
    });
    scene.add(towerPlumes.points); plumeUpdates.push(towerPlumes.update);
  }

  // a handful of soft clouds catching the low sun (desktop only: full-screen alpha overdraw adds up on
  // a phone; skipped on the big-campus layout, whose camera pulls back far enough that a fixed-size
  // cloud sprite would loom instead of read as background)
  if (!quality.mobile && !extra) scene.add(clouds(6, 11, { cx: -70, cz: -40 }));

  scene.add(S.build({ cast: true, receive: true }));
  scene.add(N.build({ cast: false, receive: true }));
  flows.forEach(f => scene.add(f.group));
  dataFlows.forEach(f => scene.add(f.group));
  heatFlows.forEach(f => scene.add(f.group));
  const fans = spinners(fanItems, MAT.darkSteel, { speed: 3.2 }); scene.add(fans.mesh);

  const hallAz = hallCentersZ[0];
  return {
    scene, flows,
    camera: extra
      ? { pos: [reach * 0.55, reach * 0.42, reach * 0.62], target: [reach * 0.3 - 300, 0, -120], near: 0.2, far: Math.max(9000, reach * 3), min: 3, max: Math.max(2600, reach * 1.6) }
      : { pos: [520, 290, 780], target: [-300, 25, -150], near: 0.2, far: 9000, min: 3, max: 2600 },
    hotspots: {
      line: { pos: [-990, 50, towerZ], view: { pos: [-1100, 120, 40], target: [-800, 30, -150] } },
      substation: { pos: [-500, 22, -150], view: { pos: [-360, 120, 60], target: [-480, 5, -150] } },
      mpt: { pos: [-418, 16, -150], view: { pos: [-360, 40, -40], target: [-420, 5, -150] } },
      ehouse: { pos: [-378, 8, -150], view: { pos: [-320, 40, -60], target: [-380, 2, -150] } },
      gensets: { pos: [320, 10, -190], view: { pos: [440, 90, -60], target: [320, 0, -150] } },
      fuel: { pos: [397, 9, -100], view: { pos: [480, 50, -40], target: [397, 0, -100] } },
      bess: { pos: [-316, 6, 75], view: { pos: [-250, 60, 170], target: [-315, 0, 75] } },
      unitsubs: { pos: [hcx, 5, -115], view: { pos: [hcx + 20, 30, -40], target: [hcx, 0, -110] } },
      hall: { pos: [hcx, 26, hallAz], view: { pos: [hcx + 160, 170, 120], target: [hcx, 10, -120] } },
      ...(warm ? { drycoolers: { pos: [Math.min(60, hcx), 26, -170], view: { pos: [Math.min(60, hcx) + 60, 70, -90], target: [Math.min(60, hcx), 20, -170] } } } : { chillers: { pos: [plantX, 13, -245], view: { pos: [plantX + 70, 70, -160], target: [plantX - 10, 5, -250] } } }),
      towers: { pos: [45, 13, -275], view: { pos: [110, 60, -200], target: [70, 5, -275] } },
      fiber: { pos: [fiberA[0], 3, fiberA[1]], view: { pos: [-60, 60, 330], target: [-120, 0, 200] } },
    },
    dataFlows, heatFlows, layers: { data: dataGroup },
    heatHotspots: {
      ...(warm ? { drycoolers: { pos: [Math.min(60, hcx), 26, -170], view: { pos: [Math.min(60, hcx) + 80, 90, -60], target: [Math.min(60, hcx), 25, -170] } } } : { chillers: { pos: [plantX, 13, -245], view: { pos: [plantX + 70, 70, -160], target: [plantX - 10, 5, -250] } } }),
      towers: { pos: [45, 13, -275], view: { pos: [110, 60, -200], target: [70, 20, -275] } },
      plume: { pos: [hcx, 70, -170], view: { pos: [hcx + 220, 160, 80], target: [hcx, 40, -110] } },
      reuse: { pos: [hallX0 - 28, 18, 60], view: { pos: [-160, 80, 180], target: [-40, 10, 60] } },
    },
    dataHotspots: {
      fiber: { pos: [fiberA[0], 3, fiberA[1]], view: { pos: [-60, 60, 330], target: [-120, 0, 200] } },
      dci: { pos: [hutA[0], 6, hutA[1]], view: { pos: [-130, 40, 290], target: [hutA[0], 0, hutA[1]] } },
      ...(nHalls > 1 ? { interhall: { pos: [-45, 3, -58], view: { pos: [40, 70, 60], target: [-45, 0, -58] } } } : {}),
      ...(nHalls > 1 ? { ductbank: { pos: [-54, 1.1, -90], view: { pos: [-57.2, 1.9, -87.4], target: [-54, 0.45, -89.2] } } } : {}),
      hall: { pos: [hcx, 26, hallAz], view: { pos: [hcx + 160, 170, 120], target: [hcx, 10, -120] } },
      longhaul: { pos: [fiberA[0], 3, 520], view: { pos: [200, 260, 900], target: [-150, 0, 420] } },
    },
    look: { env: 'sky', envIntensity: 0.6, exposure: 1.12, bloom: 0.95, threshold: 0.8, ao: 0 },
    update(t, dt) {
      fans.update(t);
      moverGroups.forEach(m => m.update(t));
      plumeUpdates.forEach(u => u(t));
    },
  };
}
