import { managedRoute, FIBER_JACKET, HALL_RUNWAY } from './fiber-routing.js';
import { attachFlowRibbons } from '../flow-ribbons.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { SiteBuilder as Builder, preloadSiteConstruction, finalizeSiteGeometry, hasSiteConstruction } from './site-blender-construction.js';
// Scene 2: power room & data hall, drawn as a section cut. Units are meters.
import { THREE, MAT, mtx, flow, insulator, canvasTex, sky, person, glowMat, textSprite, spinners } from '../kit.js';
import { preloadCampusCatalog, hasCampusCatalog, campusCatalogBuilder, campusCatalogRotor, campusCatalogInstances } from './campus-blender-catalog.js';
import { preloadHallFinish, hasHallFinish, hallFinishInstances } from './hall-blender-finish.js';
import { buildBreakout, multimodeTabKeys } from './hall-breakout.js';
export const preload=()=>Promise.all([preloadCampusCatalog(),preloadSiteConstruction(),preloadHallFinish()]);
import { rbox, bundle, blinkers, lamps, plumes, movers, floorMirror } from '../fx.js';
import { printDecals, textTexture, printTexture, SANS } from './print-kit.js';
import { switchLabel, labelLines } from './lid-labels.js';
import { hallMarks } from './electrical-marks.js';
import { hallPipeMarks } from './cooling-marks.js';
import { hallIds, cduPlates } from './site-signs.js';
import { tagHeat, balanceHeat, heatIntensity, heatWeight, PART_W } from '../heat.js';
import { ledgerW } from '../power-glow.js';
import { FABRICS } from '../model/engine.ts';

// Cabinet front textures (drawn once).
function frontTex(kind) {
  const W = 256, H = 512;
  return canvasTex(W, H, (g, w, h) => {
    if (kind === 'rack') {
      g.fillStyle = '#121418'; g.fillRect(0, 0, w, h);
      const U = h / 48;
      const row = (y, hgt, fill, leds) => { g.fillStyle = fill; g.fillRect(8, y, w - 16, hgt - 2); for (let i = 0; i < leds; i++) { g.fillStyle = i % 5 === 0 ? '#5cf29a' : '#1e8a55'; g.fillRect(16 + i * 9, y + hgt / 2 - 1.5, 4, 3); } };
      // Match scene3's NVL72 layout: bottom-up, with blanking above.
      const drawers=[...Array(4).fill('power'),...Array(8).fill('compute'),...Array(9).fill('switch'),...Array(10).fill('compute'),...Array(4).fill('power'),'management'];   // nvl72-layout.js: eight shelves
      drawers.forEach((kind,i)=>{
        const center=.12+i*.04445+.022225,y=(2.25-center-.022225)/2.2*h,dy=.04445/2.2*h;
        row(y,dy,kind==='compute'?'#1d2026':kind==='switch'?'#23303a':'#2a2e35',kind==='switch'?14:kind==='power'?6:2);
        if(kind==='compute'){g.fillStyle='#2d323a';for(let x=60;x<w-20;x+=7)g.fillRect(x,y+3,4,Math.max(1,dy-7));}
      });
      g.fillStyle = '#0b0c0e'; g.fillRect(0, 0, 8, h); g.fillRect(w - 8, 0, 8, h);
    } else if (kind === 'rackH100') {
      g.fillStyle = '#121418'; g.fillRect(0, 0, w, h);
      const U = h / 48;
      for (let s = 0; s < 4; s++) {                                                   // four 8U servers, fans on the face
        const y = h - U * (3 + s * 8.2) - U * 8;
        g.fillStyle = '#1b1d21'; g.fillRect(8, y, w - 16, U * 8 - 3);
        g.fillStyle = '#b39a6a'; g.fillRect(8, y, w - 16, 3);
        for (let r = 0; r < 2; r++) for (let i = 0; i < 5; i++) { g.fillStyle = '#0b0c0e'; g.beginPath(); g.arc(34 + i * 47, y + U * (2 + r * 4), U * 1.6, 0, Math.PI * 2); g.fill(); }
      }
      g.fillStyle = '#2a2e35'; g.fillRect(8, U * 2, w - 16, U - 2);
      g.fillStyle = '#0b0c0e'; g.fillRect(0, 0, 8, h); g.fillRect(w - 8, 0, 8, h);
    } else if (kind === 'sst') {
      g.fillStyle = '#d0d4d7'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#8d9398'; g.lineWidth = 3; g.strokeRect(4, 4, w - 8, h - 8);
      g.fillStyle = '#0e1d2a'; g.fillRect(60, 50, 136, 70); g.fillStyle = '#d8f04a'; g.fillRect(72, 64, 70, 8); g.fillStyle = '#45c6ff'; g.fillRect(72, 82, 50, 6);
      g.fillStyle = '#aeb3b7'; for (let y = 170; y < h - 30; y += 11) g.fillRect(24, y, w - 48, 5);
    } else if (kind === 'inrow') {
      g.fillStyle = '#26292e'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#1a1c20'; for (let y = 30; y < h - 30; y += 9) g.fillRect(16, y, w - 32, 5);
      g.fillStyle = '#0e1d2a'; g.fillRect(70, 40, 116, 50); g.fillStyle = '#4c8dff'; g.fillRect(80, 54, 50, 7);
    } else if (kind === 'swgr') {
      g.fillStyle = '#c4c8cb'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#8d9398'; g.lineWidth = 3; g.strokeRect(4, 4, w - 8, h - 8);
      for (let i = 0; i < 3; i++) { const y = 40 + i * 150; g.fillStyle = '#b2b7bb'; g.fillRect(24, y, w - 48, 120); g.fillStyle = '#2b2f34'; g.fillRect(70, y + 20, w - 140, 50); g.fillStyle = i === 0 ? '#e0483c' : '#3fbf6a'; g.fillRect(40, y + 90, 14, 14); g.fillStyle = '#e9d44a'; g.fillRect(w - 64, y + 90, 26, 14); }
    } else if (kind === 'ups') {
      g.fillStyle = '#2a2e34'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#20252b'; for (let y = 180; y < h - 20; y += 10) g.fillRect(20, y, w - 40, 5);
      g.fillStyle = '#0e1d2a'; g.fillRect(60, 50, 136, 80); g.fillStyle = '#45c6ff'; g.fillRect(70, 62, 60, 8); g.fillRect(70, 80, 90, 5); g.fillStyle = '#5cf29a'; g.fillRect(70, 96, 40, 5);
    } else if (kind === 'batt') {
      g.fillStyle = '#23272d'; g.fillRect(0, 0, w, h);
      for (let y = 30; y < h - 30; y += 44) { g.fillStyle = '#31363d'; g.fillRect(16, y, w - 32, 36); g.fillStyle = '#5cf29a'; g.fillRect(w - 40, y + 14, 8, 8); }
    } else if (kind === 'cdu') {
      g.fillStyle = '#d3d6d8'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#0e1d2a'; g.fillRect(60, 60, 136, 90); g.fillStyle = '#4c8dff'; g.fillRect(72, 76, 50, 8); g.fillStyle = '#ff5a6e'; g.fillRect(72, 94, 70, 8);
      g.fillStyle = '#b3b8bc'; for (let y = 200; y < h - 30; y += 12) g.fillRect(24, y, w - 48, 6);
    } else if (kind === 'net') {
      // network rack: 1U blanking panels, two horizontal cable managers either side of the switch units
      // (the switch chassis and patch panel are geometry drawn over this face); representative
      g.fillStyle = '#101216'; g.fillRect(0, 0, w, h);
      const row = y => (2.25 - y) / 2.2 * h, U = .04445 / 2.2 * h;
      for (let y = row(2.25); y < h; y += U) { g.fillStyle = '#16191e'; g.fillRect(10, y + 1, w - 20, U - 2); g.fillStyle = '#1d2127'; g.fillRect(10, y + 1, w - 20, 1); }
      for (const y of [1.76, 1.48]) {
        const top = row(y + .022); g.fillStyle = '#0a0b0d'; g.fillRect(8, top, w - 16, U);
        g.fillStyle = '#23272e'; for (let x = 14; x < w - 14; x += 12) g.fillRect(x, top + 2, 6, U - 4);
      }
      g.fillStyle = '#0b0c0e'; g.fillRect(0, 0, 8, h); g.fillRect(w - 8, 0, 8, h);
    } else if (kind === 'storage') {
      // JBOD-style 2U drive shelves: dense grids of small drive bays, no NVLink switches, no coolant gear
      g.fillStyle = '#15171b'; g.fillRect(0, 0, w, h);
      const U = h / 48;
      for (let s = 0; s < 12; s++) {
        const y = s * U * 4;
        g.fillStyle = '#1c1f24'; g.fillRect(6, y + 2, w - 12, U * 4 - 4);
        g.fillStyle = '#0b0c0e'; g.fillRect(6, y + 2, w - 12, 3);
        for (let r = 0; r < 2; r++) for (let c = 0; c < 12; c++) {
          const bw = (w - 24) / 12, bx = 12 + c * bw, by = y + 7 + r * (U * 2 - 2);
          g.fillStyle = '#2a2e35'; g.fillRect(bx, by, bw - 3, U * 2 - 6);
          g.fillStyle = (c + r + s) % 7 === 0 ? '#ff8a3d' : '#5cf29a'; g.fillRect(bx + 2, by + U * 2 - 9, 4, 3);
        }
      }
      g.fillStyle = '#0b0c0e'; g.fillRect(0, 0, 8, h); g.fillRect(w - 8, 0, 8, h);
    } else if (kind === 'cpu') {
      // plain 1U CPU server faces: head / login / scheduler nodes, no GPU faceplate, no drive-bay grid
      g.fillStyle = '#121418'; g.fillRect(0, 0, w, h);
      const U = h / 48;
      for (let i = 0; i < 43; i++) {
        const y = U * (2 + i * 1.06);
        g.fillStyle = '#1d2026'; g.fillRect(8, y, w - 16, U - 2);
        g.fillStyle = '#2a2e35'; g.fillRect(8, y, w - 16, 3);
        for (let d = 0; d < 2; d++) { g.fillStyle = '#0b0c0e'; g.beginPath(); g.arc(24 + d * 16, y + U / 2, U * 0.28, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = i % 9 === 0 ? '#ffb347' : '#5cf29a'; g.fillRect(w - 26, y + U / 2 - 1.5, 5, 3);
      }
      g.fillStyle = '#0b0c0e'; g.fillRect(0, 0, 8, h); g.fillRect(w - 8, 0, 8, h);
    }
  });
}
// The shared Blender PLANE / BOX_SIX_FACES modules that finalizeSiteGeometry() swaps in carry V running
// top-down while canvas textures keep flipY=true, so every front graphic rendered upside down (UPS/CDU
// displays at knee height, switchgear rows inverted, NVL72 rows off the NVL_FACE relief). Re-orient V on
// each vertical face so its top edge samples the top of the canvas. Idempotent: a face that already reads
// top-up is left alone, so this stays correct if the shared module is fixed at the source.
function uprightFaceUVs(scene) {
  const seen = new Set();
  scene.traverse(o => {
    const module = o.isMesh && o.geometry.userData.blender?.module;
    if ((module !== 'PLANE' && module !== 'BOX_SIX_FACES') || seen.has(o.geometry)) return;
    seen.add(o.geometry);
    const g = o.geometry, pos = g.attributes.position, uv = g.attributes.uv, idx = g.index;
    if (!uv) return;
    const total = idx ? idx.count : pos.count;
    const groups = g.groups.length ? g.groups : [{ start: 0, count: total }];
    for (const { start, count } of groups) {
      const verts = new Set();
      for (let i = start; i < start + count; i++) verts.add(idx ? idx.getX(i) : i);
      let top = -1, bottom = -1, yMin = Infinity, yMax = -Infinity;
      for (const v of verts) {
        const y = pos.getY(v);
        if (y > yMax) { yMax = y; top = v; }
        if (y < yMin) { yMin = y; bottom = v; }
      }
      if (yMax - yMin < 1e-6) continue;                                                              // horizontal face
      if (uv.getY(top) >= uv.getY(bottom)) continue;                                                 // already upright
      for (const v of verts) uv.setY(v, 1 - uv.getY(v));
    }
    uv.needsUpdate = true;
  });
}
export function build({ quality, model }) {
  const dc = model.power.id === 'dc800', air = model.cooling.id === 'air', nvl = model.accel.gpusPerRack === 72;
  const itV = dc ? 'hvdc' : 'lv';
  const scene = new THREE.Scene();
  scene.add(sky('#020305', '#05080d', '#0b111a', 800));
  // Architectural cutaway lighting: broad cool fill keeps cabinet construction legible;
  // the warm ceiling fixtures remain the visible light sources, without burying services in black.
  scene.add(new THREE.HemisphereLight(0xaabed1, 0x20262b, 0.67));
  const key = new THREE.DirectionalLight(0xe4edff, 1.65);
  key.position.set(-40, 60, 45); key.target.position.set(0, 0, -2);
  if (quality.shadows) { key.castShadow = true; key.shadow.mapSize.set(4096, 4096); Object.assign(key.shadow.camera, { left: -48, right: 48, top: 32, bottom: -32, near: 10, far: 180 }); key.shadow.bias = -0.0003; key.shadow.normalBias = 0.04; }
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0xadc2d5, 0.48); fill.position.set(40, 18, 60); scene.add(fill);
  // Raised to ~40 deg: at the old ~15 deg its mirror angle matched the low close-up cameras (CDU, fan wall,
  // busway), so it painted a glare hotspot on flat cabinet tops, tray and floor.
  const edgeLight=new THREE.DirectionalLight(0xffddba,.5);edgeLight.position.set(30,34,-30);edgeLight.target.position.set(4,1,0);scene.add(edgeLight,edgeLight.target);

  const flows = [], dataFlows = [], heatFlows = [];
  const S = new Builder(), N = new Builder();
  const X0 = -35, X1 = 25, Z0 = -18, Z1 = 18, WALL_H = 7.5, PART = -12;

  // ---------- network faceplates: pluggable OSFP modules, or one CPO switch with on-chassis MPO + ELS ----------
  // Sources: research/interconnect-sources.md section 2 (Scale-out): DSP pluggables ~17 W (800G DR8) to ~25-30 W
  // (1.6T); LPO saves ~40-50%; NVIDIA Quantum-X/Spectrum-X Photonics (CPO) is 4x fewer lasers via external laser
  // sources and, as of its August 2026 update, 5x power efficiency (up from an initial 3.5x); Broadcom Davisson
  // (Tomahawk 6 CPO) is 3.5 W per 800G port of optics.
  const moduleMetal = new THREE.MeshStandardMaterial({ color: 0xcfd3d8, roughness: 0.28, metalness: 0.85 });
  const pullTabMat = new THREE.MeshStandardMaterial({ color: 0x101215, roughness: 0.55, metalness: 0.1 });
  const mpoBody = new THREE.MeshStandardMaterial({ color: 0x2fb6c9, roughness: 0.4, metalness: 0.3 });
  const elsMetal = new THREE.MeshStandardMaterial({ color: 0xbcc2c9, roughness: 0.3, metalness: 0.7 });
  const busway = MAT.alu.clone(); busway.name = 'Busway and bus duct';           // the IT power flows ride inside it
  const dropCable = MAT.black.clone(); dropCable.name = 'Rack drop cable';
  const guideRing = moduleMetal.clone(); guideRing.name = 'Fiber guide ring';
  const patchTerm = MAT.darkSteel.clone(); patchTerm.name = 'Fiber patch termination';   // a fiber passes through its connector
  const fiberJacket = new THREE.MeshStandardMaterial({ color: FIBER_JACKET, roughness: 0.5, metalness: 0.1 }); fiberJacket.name = 'Optical fiber jacket';   // the flows ride inside it (tools/flow-audit.mjs conduit)
  const networkPorts = new Map(), fiberRoutes = [];
  let tanTabs = new Set();                             // multimode modules (hall-breakout.js) carry their own tan pull tab
  const portLedItems = [];                              // link LEDs on the switch ports (the racks keep ledItems)
  const mmLidLabels = [];                               // multimode (2xSR4) modules print their own class
  const lidLabels = [];                                 // printed lid labels, one per pluggable module (lid-labels.js)
  // Switch chassis drawn at true size with pluggable OSFP modules (22.58 mm wide x 13 mm tall, OSFP MSA).
  // 400G fabrics: Quantum-2 QM9700, 1U (43.6 mm) x 438 mm, 32 OSFP cages (nvidia-quantum2-qm9700-specs).
  // 800G and up: Quantum-X800 Q3400, 4U (177.8 mm) x 438 mm, 72 OSFP cages (nvidia-xdr-switch-specs,
  // nvidia-quantum-x800-switches). Cage arrangement and the chassis count per rack are representative.
  const bigSwitch = model.accel.nicGbps >= 800;
  const SWITCH_FORMS = { qm9700: { h: .0436, rows: 2, cols: 16 }, q3400: { h: .1778, rows: 4, cols: 18 }, tor: { h: .0436, rows: 1, cols: 16 } };
  function switchChassis(cx, cz, fs, form, yb, ports) {
    const { h, rows, cols } = SWITCH_FORMS[form], faceZ = cz + fs * 0.6, pitchX = .0235, pitchY = .0172;
    const yc = yb + h / 2;
    N.box(.438, h - .002, .012, MAT.darkSteel, cx, yc, faceZ + fs * .006);                  // chassis face
    N.box(.018, h - .006, .006, MAT.black, cx - .209, yc, faceZ + fs * .015);                 // mounting ears
    N.box(.018, h - .006, .006, MAT.black, cx + .209, yc, faceZ + fs * .015);
    portLedItems.push({ p: [cx - .2, yc + h / 2 - .008, faceZ + fs * .02], color: '#5cf29a', rate: .6 });   // status LED
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const bank = form === 'q3400' ? (r < 2 ? -1 : 1) * .012 : 0;
      const x = cx + (c - (cols - 1) / 2) * pitchX, y = yc + (r - (rows - 1) / 2) * pitchY + bank;
      N.box(.0226, .013, .02, moduleMetal, x, y, faceZ + fs * .02);                           // OSFP module, ~18 mm proud
      const mm = tanTabs.has(`${cx}:${cz}:${ports.length}`);
      (mm ? mmLidLabels : lidLabels).push({ p: [x, y + .0065, faceZ + fs * .02], face: 'top', yaw: fs > 0 ? 0 : Math.PI });
      if (!mm) N.box(.004, .0035, .03, pullTabMat, x, y - .0045, faceZ + fs * .027);   // pull tab (multimode modules carry a tan one)
      ports.push({ point: [x, y, faceZ + fs * .03], f: fs, cx, i: ports.length, under: yb - .012 });
      portLedItems.push({ p: [x + .008, y + .0047, faceZ + fs * .0305], color: (r + c) % 3 ? '#5cf29a' : '#ffb347', rate: 0.35 + ((r * cols + c) * 0.37) % 1.2 });
    }
  }
  // Printed chassis face: port numbers in the gaps above each cage and, where the face has room, the model name
  // (Quantum-X800 Q3400 in the band over its ports; QM9700 up the narrow strip beside the first column). One texture
  // per chassis form, laid on the face just behind the modules. Numbering order is representative.
  const facePrints = new Map();
  const SWITCH_NAMES = { q3400: 'Quantum-X800 Q3400', qm9700: 'QM9700' };
  function faceTexture(form) {
    const { h, rows, cols } = SWITCH_FORMS[form], W = 4096, H = Math.round(W * h / .438), k = W / .438, pitchX = .0235, pitchY = .0172;
    return printTexture(W, H, (g) => {
      g.fillStyle = '#c3c8ce'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `600 ${Math.round(.0032 * k)}px ${SANS}`;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const bank = form === 'q3400' ? (r < 2 ? -1 : 1) * .012 : 0;
        const x = (c - (cols - 1) / 2) * pitchX, y = (r - (rows - 1) / 2) * pitchY + bank + .0065 + .0021;
        g.fillText(String(c * rows + (rows - 1 - r) + 1), W / 2 + x * k, H / 2 - y * k);
      }
      const name = SWITCH_NAMES[form];
      if (form === 'q3400') { g.fillStyle = '#a3aab2'; g.font = `600 ${Math.round(.0095 * k)}px ${SANS}`; g.fillText(name, W / 2, H / 2 - .066 * k); }
      else if (name) { g.save(); g.translate(W / 2 - .194 * k, H / 2); g.rotate(-Math.PI / 2); g.font = `600 ${Math.round(.0075 * k)}px ${SANS}`; g.fillText(name, 0, 0); g.restore(); }
    });
  }
  function pluggableFace(cx, cz, fs, { forms, y0 }) {
    const ports = [];
    let yb = y0;
    for (const form of forms) {
      switchChassis(cx, cz, fs, form, yb, ports);
      if (!facePrints.has(form)) facePrints.set(form, []);
      facePrints.get(form).push({ p: [cx, yb + SWITCH_FORMS[form].h / 2, cz + fs * 0.6 + fs * .012], n: [0, 0, fs] });
      yb += SWITCH_FORMS[form].h + .0009;
    }
    networkPorts.set(`${cx}:${cz}`, ports); return ports;
  }
  // the co-packaged optics switch, drawn with the Quantum-X Photonics Q3450's published front-panel counts:
  // 144 MPO connectors, 18 removable external light-source (ELS) modules, 4 UDQ4 liquid connections
  // (lambda-q3450-unboxing). Adapter size is to scale (~13 x 8 mm); the arrangement is representative.
  function cpoFace(cx, cz, fs) {
    const faceZ = cz + fs * 0.6, plateZ = faceZ + fs * .018, frontZ = faceZ + fs * .033;
    N.box(.47, .34, .03, elsMetal, cx, 1.71, plateZ);                                     // chassis faceplate
    for (let r = 0; r < 8; r++) for (let c = 0; c < 18; c++) {                              // 144 MPO adapters, 8 x 18
      const x = cx + (c - 8.5) * .0225, y = 1.61 + r * .0135;
      N.box(.0135, .0085, .012, MAT.black, x, y, frontZ + fs * .006);
      N.box(.005, .0022, .003, mpoBody, x, y + .0032, frontZ + fs * .0135);                // coloured key
    }
    for (let i = 0; i < 18; i++) {                                                         // 18 hot-swap ELS modules
      const x = cx + (i - 8.5) * .0225;
      N.box(.019, .05, .02, elsMetal, x, 1.8, frontZ + fs * .01);
      N.box(.012, .006, .012, pullTabMat, x, 1.772, frontZ + fs * .026);                   // pull handle
      N.box(.004, .004, .004, glowMat('#ffb347', 1.3), x + .005, 1.818, frontZ + fs * .0215);
    }
    // The comparison chassis is not deployed: four capped UDQ4-style couplings (two supply, two return),
    // with no floor hoses or fiber drop into the live fabric.
    for (const [dx, mat] of [[-.165,MAT.pipeBlue],[-.115,MAT.pipeBlue],[.115,MAT.pipeRed],[.165,MAT.pipeRed]]) {
      N.cylZ(.019,.03,mat,cx+dx,1.575,frontZ+fs*.015,12);
      N.cylZ(.015,.012,MAT.darkSteel,cx+dx,1.575,frontZ+fs*.036,12);
    }
  }
  // Physical jackets and particles use one route definition. Network and rack
  // drops rise beside the face, then pass over the raceway rim before landing.
  function fiberPath(points,kind,{count=6,size=.035,particles=true,radius=.006,audit}={}) {
    const pts=managedRoute(points,.075);
    for(let i=1;i<pts.length;i++)N.strut(pts[i-1],pts[i],radius,fiberJacket,6);
    const rackLink=kind==='rack-to-leaf';
    const f=flow(pts,'eth',{count:particles?count:0,speed:rackLink?2.4:1.6,size,k:1.4,trail:false,...(audit?{audit}:{})});
    f.group.userData.fiberRoute=kind;
    if(rackLink){
      f.group.userData.rackFiberUplink=true;
      // All bundles carry moving ribbons. Sample only the extra 3D particle
      // cores; a zero-count Flow contributes no individual particle draw.
      const ribbonCount=Math.ceil(f.len/(quality.mobile?2.3:1.6))*2;
      f.ribbonCount=ribbonCount;f.ribbonIntensity=.65;
      // The hall line represents a fiber bundle with separate Tx/Rx strands,
      // not a claim that a parallel-optics strand carries both directions.
      const back=flow([...pts].reverse(),'eth',{count:0,speed:2.4,size,k:1.4,trail:false,...(audit?{audit}:{})});
      back.ribbonCount=ribbonCount;back.ribbonIntensity=.55;
      back.group.userData.rackFiberReturn=true;
      back.group.userData.fiberRoute='rack-return';
      dataFlows.push(back);
    }
    dataFlows.push(f);
    const route={kind,points:pts,start:pts[0],end:pts.at(-1),animated:true,particleCores:particles};
    fiberRoutes.push(route);return route;
  }
  function portDrop(port,rowZ) {
    const [x,y,z]=port.point,fs=port.f;
    N.box(.012,.008,.02,mpoBody,x,y,z+fs*.01);                                       // connector boot
    if(port.cx===undefined)return [[x,y,z+fs*.026],[x,y,z+fs*.12],[x,HALL_RUNWAY.entryY,z+fs*.12],
      [x,HALL_RUNWAY.entryY,rowZ],[x,HALL_RUNWAY.cableY,rowZ]];
    // Jumpers drop below the chassis, dress sideways to the vertical cable manager at the nearer rack edge, then rise there,
    // leaving the switch face readable; each strand keeps its own lane in the manager.
    const side=Math.sign(x-port.cx)||1,lane=(port.i%10)*.007,mx=port.cx+side*(.232-lane),mz=z+fs*(.07+(port.i%3)*.012);
    // under the chassis, then sideways; a bottom-row jumper still drops 45 mm first so its turn keeps a G.657.A2 radius
    const low=Math.min(port.under,y-.045)-(port.i%4)*.006;
    // a manager lane right under the spine-to-frames runway rises beside it, then crosses over its rim at entry height
    const sx=rowX0+4.8,rise=rx=>{const under=Math.abs(rx-sx)<.17&&mz>10.48&&mz<14.22,ux=under?sx+(Math.sign(rx-sx)||1)*.2:rx;
      return {ux,tail:[[ux,HALL_RUNWAY.entryY,mz],...(under?[[rx,HALL_RUNWAY.entryY,mz]]:[]),[rx,HALL_RUNWAY.entryY,rowZ],[rx,HALL_RUNWAY.cableY,rowZ]]};};
    // An edge port already beside its manager lane goes straight to it at port height instead of dipping under the
    // chassis and hairpinning back up (that U-turn bent the jumper below 7.5 mm).
    if(Math.abs(mx-x)<.03){const r=rise(x);return [[x,y,z+fs*.026],[x,y,mz],...(r.ux!==x?[[r.ux,y,mz]]:[]),...r.tail];}
    if(Math.abs(mx-x)<.06){const r=rise(mx);return [[x,y,z+fs*.026],[x,y,mz],[r.ux,y,mz],...r.tail];}
    const r=rise(mx);return [[x,y,z+fs*.026],[x,y,mz],[x,low,mz],[r.ux,low,mz],...r.tail];
  }
  function rackDrop(k) {
    const h100=model.accel.id==='h100',fs=h100?-k.f:k.f,y=h100?1.108:1.333375;
    const x=k.x+.20,z=k.z+fs*.62,rail=k.x+.255;
    N.box(.026,.017,.035,moduleMetal,x,y,z);
    N.box(.014,.009,.022,mpoBody,x,y,z+fs*.025);
    if(h100){
      // Rear-port DGX H100 racks: the leads turn back through the rear door into the rack's own rear cable manager,
      // rise inside it and leave through a brush grommet in the roof, so nothing pierces the hot-aisle roof
      // (it spans the aisle from each rack's rear face). The manager inside the cabinet is not drawn.
      const zr=k.z+fs*.55;
      N.box(.05,.012,.05,patchTerm,rail,2.306,zr);                                            // roof brush grommet
      return {points:[[x,y,z+fs*.036],[x,y,z+fs*.07],[rail,y,z+fs*.07],[rail,y,zr],[rail,2.36,zr],
        [rail,HALL_RUNWAY.entryY,zr],[rail,HALL_RUNWAY.entryY,k.z],[rail,HALL_RUNWAY.cableY,k.z]],
        audit:{within:[[k.x-.31,0,Math.min(k.z+fs*.5,k.z+fs*.71),k.x+.31,2.32,Math.max(k.z+fs*.5,k.z+fs*.71)]],why:'through the rear door into the rack, up its rear cable manager to the roof grommet'}};
    }
    N.box(.025,.035,.018,patchTerm,rail,2.327,k.z+fs*.70);
    N.box(.004,1.08,.012,MAT.darkSteel,rail+.016,1.81,k.z+fs*.708);
    for(let yy=1.4;yy<2.31;yy+=.18)N.box(.032,.006,.012,guideRing,rail,yy,k.z+fs*.712);   // the riser's fibers pass through these
    return {points:[[x,y,z+fs*.036],[x,y,z+fs*.10],[rail,y,z+fs*.10],
      [rail,2.34,k.z+fs*.70],[rail,HALL_RUNWAY.entryY,k.z+fs*.70],
      [rail,HALL_RUNWAY.entryY,k.z],[rail,HALL_RUNWAY.cableY,k.z]]};
  }

  // ---------- site, slab, walls (section cut) ----------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({color:0x05070a,roughness:.88,metalness:.02})); ground.name='Hall dark studio surround'; ground.rotation.x = -Math.PI / 2; ground.position.y = -0.35; ground.receiveShadow = true; scene.add(ground);   // below the site pad, never flush with it
  S.slab(X1 - X0 + 20, 0.3, Z1 - Z0 + 14, new THREE.MeshStandardMaterial({color:0x131a22,roughness:.52,metalness:.15}), -5, -0.3, 0);
  const hallFloor=new THREE.MeshStandardMaterial({color:0x343e49,roughness:.3,metalness:.2,envMapIntensity:.85});
  S.slab(X1 - X0, 0.35, Z1 - Z0, hallFloor, (X0 + X1) / 2, -0.2, 0);                 // floor slab
  const cut = MAT.concrete, cutTop = glowMat('#d9dde2', 0.9);
  if(hasHallFinish())scene.add(hallFinishInstances('SERVICE_WALL',[mtx((X0+X1)/2,0,Z0-.15)]));
  else S.slab(X1 - X0 + 0.6, WALL_H, 0.3, MAT.wall, (X0 + X1) / 2, 0, Z0 - 0.15);          // back wall
  // every wall but the back one is cut at 3.2 m, like a section drawing; cut faces are lit
  const CUT_H = 3.2;
  const cutWall = (w, d, x, z) => { S.slab(w, CUT_H, d, MAT.wall, x, 0, z); N.slab(w, 0.02, d, cutTop, x, CUT_H, z); };
  cutWall(0.3, Z1 - Z0, X0 - 0.15, 0);                                                  // west exterior wall
  cutWall(0.3, Z1 - Z0, X1 + 0.15, 0);                                                  // east wall
  cutWall(0.3, 14, PART, Z0 + 7); cutWall(0.3, 12, PART, Z1 - 6);                       // partition with an opening
  S.slab(X1 - X0 + 0.6, 1.0, 0.3, cut, (X0 + X1) / 2, 0, Z1 + 0.15);                  // front wall, cut low
  N.slab(X1 - X0 + 0.6, 0.02, 0.3, cutTop, (X0 + X1) / 2, 1.0, Z1 + 0.15);
  // roof steel only along the back wall, cut short
  if(!hasHallFinish())for (let x = X0 + 3; x < X1; x += 6) N.box(0.14, 0.5, 3, MAT.darkSteel, x, WALL_H - 0.25, Z0 + 1.5);
  // Architectural panel reveals and slim kick plates on the uncut back wall.
  // These are finishes, not utility runs; neutral material keeps flow colors unambiguous.
  const wallTrim = new THREE.MeshStandardMaterial({ color: 0x515f6b, roughness: .48, metalness: .45 });
  for (let x = X0 + 1.5; x < X1; x += 3) N.box(.026, WALL_H - .35, .028, wallTrim, x, WALL_H / 2, Z0 + .012);
  N.box(X1 - X0, .17, .034, wallTrim, (X0 + X1) / 2, .16, Z0 + .015);
  // exterior louvers on the west wall of the electrical room
  for (let y = 1.6; y < 3.0; y += 0.2) N.box(0.08, 0.05, 8, MAT.darkSteel, X0 - 0.35, y, 6);

  // ---------- unit substation outside the west wall ----------
  const usX = -42, usZ = -10;
  S.slab(6, 0.3, 6, MAT.concrete, usX, 0, usZ);
  if (hasHallFinish()) {
    // Close-coupled secondary unit substation (representative; see build-hall-finish.py): enclosed MV
    // primary cabinet, liquid-filled tank with four radiator banks, enclosed LV throat flanged to the duct.
    scene.add(hallFinishInstances('HALL_UNITSUB', [mtx(usX, 0, usZ)]));
    S.box(5.67, 0.5, 0.6, busway, usX + 4.565, 2.2, usZ);                              // bus duct, throat flange to the wall
    // the 34.5 kV feeder arrives underground and rises through the conduit into the primary cabinet
    flows.push(flow([[usX - 4.2, -0.2, usZ + .4], [usX - 2.35, -0.2, usZ + .4], [usX - 2.35, 1.1, usZ + .4], [usX - 1.7, 1.1, usZ + .4]], 'mv', { count: 6, speed: 1.5, size: 0.11, trailR: 0.03, audit: { within: [[usX - 4.5, -0.35, usZ - 1, usX - 2, 0.01, usZ + 1]], why: 'the 34.5 kV feeder arrives buried in the site slab' } }));
  } else {
    S.slab(2.6, 2.3, 2.4, MAT.ansi61, usX, 0.3, usZ);
    for (let f = 0; f < 9; f++) { N.slab(0.05, 1.6, 0.7, MAT.ansi61, usX - 1.1 + f * 0.27, 0.6, usZ - 1.55); N.slab(0.05, 1.6, 0.7, MAT.ansi61, usX - 1.1 + f * 0.27, 0.6, usZ + 1.55); }
    for (const dz of [-0.7, 0, 0.7]) insulator(N, usX - 0.9, 2.6, usZ + dz, 0.6, 0.08, MAT.porcelain, { sheds: 4 });
    S.slab(1.2, 0.8, 1.6, MAT.ansi61, usX + 1.6, 1.4, usZ);                            // LV throat
    S.box(5.6, 0.5, 0.6, busway, usX + 4.6, 2.2, usZ);                                   // bus duct to the wall
    flows.push(flow([[usX - 4.2, -0.2, usZ + .4], [usX - 2.35, -0.2, usZ + .4], [usX - 2.35, 1.1, usZ + .4], [usX - 1.7, 1.1, usZ + .4]], 'mv', { count: 6, speed: 1.5, size: 0.11, trailR: 0.03, audit: { within: [[usX - 4.5, -0.35, usZ - 1, usX - 2, 0.01, usZ + 1]], why: 'the 34.5 kV feeder arrives buried in the site slab' } }));
  }

  // ---------- electrical room ----------
  // rounded cabinet: a smooth painted body (merged into S, one draw call per material) plus a flat
  // textured front panel held a hair proud of the body so the two never go coplanar.
  // With the campus catalog loaded, switchgear, UPS and battery rows use its true-size sections (front +Z, origin
  // at the floor centre), which carry their own doors, cubicles, displays, plinths and handles, so nothing is
  // stretched and no painted panel or seam trim is needed. Other sizes (the taller DC solid-state transformer)
  // keep the stretched cabinet with its textured front.
  // (each section is inset a few millimetres, a different amount per kind, so neighbouring side walls and the
  // row ends that line up across rows never share a plane)
  const TRUE_SIZE = { swgr: ['HALL_SWGR_SECTION', .9, 2.3, 1.5, .010], ups: ['HALL_UPS', 1.1, 2.0, 1.0, .014], batt: ['HALL_BATT', .6, 2.0, .8, .006] };
  const cabinetRow = (n, w, h, d, tex, x0, z, facing = 1) => {
    const bw = n * w;
    const kind = tex === TEX.swgr ? 'swgr' : tex === TEX.ups && !dc ? 'ups' : tex === TEX.batt ? 'batt' : null;
    const section = kind && TRUE_SIZE[kind];
    if (hasCampusCatalog() && section && section[1] === w && section[2] === h && section[3] === d) {
      const g = campusCatalogInstances(section[0], Array.from({ length: n }, (_, i) => mtx(x0 + (i + .5) * w, 0, z, facing < 0 ? Math.PI : 0).scale(new THREE.Vector3((w - section[4]) / w, 1, 1))));
      g.userData.trueSizeSection = kind; scene.add(g);
      return { x0, bw, h, z };
    }
    const sideColor = tex === TEX.swgr || (tex === TEX.cdu && !air) || (tex === TEX.ups && dc) ? 0xc3c7ca : 0x2b2f35;
    const bodyMat = new THREE.MeshStandardMaterial({ color: sideColor, roughness: 0.55, metalness: 0.22 });
    if(hasCampusCatalog()) {
      const matrices=Array.from({length:n},(_,i)=>mtx(x0+(i+.5)*w,0,z,facing<0?Math.PI:0).scale(new THREE.Vector3(w-.025,h-.02,d-.05)));
      scene.add(campusCatalogInstances('HALL_CABINET',matrices));
    } else rbox(S, bw - 0.05, h - 0.02, d - 0.05, bodyMat, x0 + bw / 2, h / 2, z, { r: 0.05, ry: facing < 0 ? Math.PI : 0 });
    const t = tex.clone(); t.repeat.set(n, 1); t.needsUpdate = true;
    // the dim hall key/fill leaves a dark cabinet graphic near-black; lift just the panel's own texture back
    // out via a low-intensity emissive map (same texture, no extra lights, no extra draw calls or shadows)
    const frontMat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.5, metalness: 0.2, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.22 });
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(bw - 0.08, h - 0.06), frontMat);
    panel.position.set(x0 + bw / 2, h / 2, z + (d / 2 + 0.010) * facing);
    if (facing < 0) panel.rotation.y = Math.PI;
    panel.receiveShadow = true; scene.add(panel);
    // Representative enclosure joinery: each existing cabinet gets a physical
    // seam and recessed toe-kick, so a repeated front texture reads as a bank
    // of serviceable cabinets. These do not add equipment or routed services.
    const trimZ = z + (d / 2 + 0.025) * facing;
    for (let i = 0; i <= n; i++) N.box(0.022, h - 0.07, 0.022, MAT.darkSteel, x0 + i * w, h / 2, trimZ);
    for (let i = 0; i < n; i++) {
      const cx = x0 + (i + .5) * w;
      N.box(w - 0.04, 0.055, 0.025, MAT.black, cx, 0.033, trimZ - 0.012 * facing);
      // Recessed escutcheon and raised service handle on each existing door.
      N.box(.065, .32, .012, MAT.darkSteel, cx + w * .36, h * .48, trimZ + .006 * facing);
      N.box(.022, .23, .042, MAT.alu, cx + w * .36, h * .48, trimZ + .025 * facing);
      for (const y of [h * .18, h * .78]) N.box(.025, .075, .022, MAT.alu, cx - w * .43, y, trimZ + .012 * facing);
    }
    N.box(bw - 0.04, 0.018, 0.022, MAT.darkSteel, x0 + bw / 2, h - 0.025, trimZ);
    return { x0, bw, h, z };
  };
  const TEX = { swgr: frontTex('swgr'), ups: frontTex(dc ? 'sst' : 'ups'), batt: frontTex('batt'), cdu: frontTex(air ? 'inrow' : 'cdu'), rack: frontTex(nvl ? 'rack' : 'rackH100'), net: frontTex('net'), storage: frontTex('storage'), cpu: frontTex('cpu') };
  cabinetRow(14, 0.9, 2.3, 1.5, TEX.swgr, -33.5, -15.6);                                 // 480 V switchgear against the back wall
  const upsH = dc ? 2.3 : 2.0;
  cabinetRow(3, 1.1, upsH, 1.0, TEX.ups, -33.5, -6.5); cabinetRow(3, 1.1, upsH, 1.0, TEX.ups, -29.6, -6.5); cabinetRow(3, 1.1, upsH, 1.0, TEX.ups, -25.7, -6.5);
  cabinetRow(12, 0.6, 2.0, 0.8, TEX.batt, -33.5, 1.5); cabinetRow(12, 0.6, 2.0, 0.8, TEX.batt, -33.5, 5.5, -1);
  // cable ladder over the gear: two rails and open rungs (not a solid pan), carrying bundled feeder cable;
  // bus riser from the UPS to the ceiling
  N.box(12.6, 0.25, 0.04, MAT.galv, -27.2, 3.42, -15.5); N.box(12.6, 0.25, 0.04, MAT.galv, -27.2, 3.42, -14.9);
  for (let x = -27.2 - 6.2; x <= -27.2 + 6.2; x += 0.55) N.box(0.05, 0.04, 0.6, MAT.galv, x, 3.3, -15.2);
  bundle(N, [-27.2 - 6.2, 3.32, -15.35], [-27.2 + 6.2, 3.32, -15.35], { n: 10, r: 0.017, spread: 0.11, sag: 0.025, mats: [MAT.black, MAT.darkSteel, MAT.copper], seed: 3 });
  bundle(N, [-27.2 - 6.2, 3.32, -15.05], [-27.2 + 6.2, 3.32, -15.05], { n: 7, r: 0.015, spread: 0.09, sag: 0.02, mats: [MAT.black, MAT.pipeBlue], seed: 7 });
  S.box(0.5, 3.6, 0.6, busway, -22.5, 3.8, -6.5);                                       // riser
  S.box(10.3, 0.5, 0.6, busway, -17.4, 5.6, -6.5);                                      // main busway to the hall
  // B side of the 2N distribution: its own riser off the UPS line-up and its own main, 0.6 m apart and 0.4 m higher
  // than A's, so the two never share a support or a crossing
  S.box(0.5, 4.0, 0.4, busway, -21.9, 4.0, -5.85);                                      // B riser
  S.box(11.8, 0.3, 0.4, busway, -16.0, 6.0, -5.85);                                     // B main to the hall
  for (let i = 0; i < 4; i++) N.strut([-20 + i * 2.6, 5.85, -6.5], [-20 + i * 2.6, WALL_H - 0.9, -6.5], 0.02, MAT.darkSteel, 4);
  // AC: 480 V from the unit substation through switchgear and UPS. DC: medium voltage through switchgear into the SSTs, 800 V DC out
  flows.push(flow([[X0 - 1.5, 2.2, usZ], [X0 + 0.5, 2.2, usZ], [-33, 2.6, -15.2], [-21, 2.6, -15.2]], dc ? 'mv' : 'lv', { count: 16, speed: 2.4, size: 0.1, trailR: 0.03 }));
  flows.push(flow([[-21, 2.6, -15.2], [-21, 2.6, -9], [-31.0, 2.6, -7.45], [-31.0, 1.8, -7.45], [-31.0, 1.8, -6.7]], dc ? 'mv' : 'lv', { count: 12, speed: 2.4, size: 0.1, trailR: 0.03 }));   // into the back of the UPS line-up
  // out of the back of the UPS line-up, along behind it, up and over the last cabinet into the bus riser (it used to run
  // through the cabinets at floor height)
  flows.push(flow([[-30.5, 1.8, -6.7], [-30.5, 1.8, -7.3], [-22.5, 1.8, -7.3], [-22.5, upsH + 0.2, -7.3], [-22.5, upsH + 0.2, -6.5], [-22.5, 5.6, -6.5], [-12.2, 5.6, -6.5]], itV, { count: 14, speed: 2.4, size: 0.1, trailR: 0.03 }));
  flows.push(flow([[-21.9, upsH + 0.2, -5.85], [-21.9, 6.0, -5.85], [-10.1, 6.0, -5.85]], itV, { count: 12, speed: 2.4, size: 0.1, trailR: 0.03 }));   // the B side

  // ---------- data hall: three contained pods, six rows ----------
  const rowX0 = -7.2, groups = 4, perGroup = 8, RW = 0.6, CW = 0.8, GAP = 0.6;
  const rowZs = [-11.2, -8.2, -4.6, -1.6, 2.0, 5.0];
  const facing = [-1, 1, -1, 1, -1, 1];
  // Overhead plan per row (TIA-942 / BICSI practice, research/design-review-rack-hall-site-2026-10-01.md): each rack's
  // front faces its cold aisle, its rear the contained hot aisle. Power rides at the rear, where the NVL72 power shelves
  // take their whips (DGX GB200 user guide: the rear carries the bus bar, manifolds and cable cartridges); the fiber
  // runway rides over the rack centerline 0.8 m higher (BICSI: 300 mm from power); the rack loop's supply and return
  // run just over the rear of the rack tops, below the busway; facility water drops into the front of each CDU, clear
  // of the runway and the busway. Offsets are in meters from the row centerline, toward the rear or the front.
  // 2N power: an A busway over each rack's rear quarter and a B busway over its front quarter, each rack taking one
  // tap from each (rack.js FEED). The fiber runway rides between them over the centerline, 0.8 m higher.
  const HALL_PLAN = { busRear: .25, busFront: .25, tapX: .12, tcsSupplyRear: .42, tcsReturnRear: .52, tcsDropX: .255, facilityFront: .48 };
  const busZOf = r => rowZs[r] - facing[r] * HALL_PLAN.busRear, busZBOf = r => rowZs[r] + facing[r] * HALL_PLAN.busFront;
  const rackMx = [], cduMx = [], rowEnds = [];
  rowZs.forEach((z, r) => {
    let x = rowX0;
    for (let gI = 0; gI < groups; gI++) {
      cduMx.push({ x: x + CW / 2, z, f: facing[r] }); x += CW;
      for (let i = 0; i < perGroup; i++) { rackMx.push({ x: x + RW / 2, z, f: facing[r] }); x += RW; }
      x += GAP;
    }
    rowEnds.push(x - GAP);
  });
  const rowX1 = rowEnds[0];
  const instanced = (w, h, d, tex, sideColor, items) => {
    // Serviceable enclosure silhouette, rather than a texture wrapped around a cube.
    // Same cabinet footprint/placement with shallow front trim; no added hardware count.
    const front = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.43, metalness: 0.3, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.12 });
    const side = new THREE.MeshStandardMaterial({ color: sideColor, roughness: 0.34, metalness: 0.55 });
    const trim = new THREE.MeshStandardMaterial({ color: 0x69747b, roughness: 0.31, metalness: 0.72 });
    const enclosure = hasCampusCatalog() ? campusCatalogBuilder('HALL_RACK') : new Builder();
    if (!hasCampusCatalog()) {
    rbox(enclosure, w, h, d, side, 0, h / 2, 0, { r: 0.025 });
    for (const x of [-w / 2 + .026, w / 2 - .026]) {
      enclosure.box(.022, h - .09, .028, trim, x, h / 2, d / 2 + .009);
      for (const y of [.2, h - .2]) enclosure.box(.012, .08, .038, MAT.darkSteel, x, y, d / 2 + .024);
    }
    enclosure.box(w - .035, .036, .035, trim, 0, h - .024, d / 2 + .008);
    enclosure.box(w - .045, .07, .035, MAT.black, 0, .043, d / 2 + .007);
    }
    const matrices = items.map(it => { const matrix=mtx(it.x, 0, it.z, it.f > 0 ? 0 : Math.PI); return hasCampusCatalog()?matrix.scale(new THREE.Vector3(w/.58,h/2.3,d/1.2)):matrix; });
    scene.add(enclosure.instance(matrices));
    const computeFace=tex===TEX.rack&&hasHallFinish()&&!quality.mobile; // phones rely on the face texture: the relief is sub-centimetre and repeats 192x
    const geo = new THREE.PlaneGeometry(w - .06, h - .1); geo.translate(0, h / 2, d / 2 + (computeFace ? .032 : .003));
    if(computeFace)scene.add(hallFinishInstances(nvl?'NVL_FACE':'H100_FACE',matrices));
    else if(tex===TEX.storage&&hasHallFinish())scene.add(hallFinishInstances('STORAGE_FACE',matrices)); // representative shelf bezels over the drive-bay rows
    const m = new THREE.InstancedMesh(geo, front, items.length);
    items.forEach((it, i) => m.setMatrixAt(i, mtx(it.x, 0.0, it.z, it.f > 0 ? 0 : Math.PI)));
    m.castShadow = m.receiveShadow = true; scene.add(m); return m;
  };
  instanced(RW - 0.02, 2.3, 1.2, TEX.rack, 0x131519, rackMx);
  // CDU / in-row cooler cabinets: rounded bodies merge straight into S (no extra draw call), the shared
  // front graphic rides as one instanced panel held proud of every body by the same gap as the electrical room.
  if (hasHallFinish()) {
    // Authored cabinet (doors, astragal, louvres, HMI, handle, roof plate): representative, see
    // build-hall-finish.py. Roof valve ports sit where the facility drops and secondary loops land.
    scene.add(hallFinishInstances(air ? 'HALL_INROW' : 'HALL_CDU', cduMx.map(it => mtx(it.x, 0, it.z, it.f > 0 ? 0 : Math.PI))));
    const ports = [];
    rowZs.forEach((z, r) => cduMx.filter(c => c.z === z).forEach(c => {
      for (const dx of [-.15, .15]) ports.push(mtx(c.x + dx, 2.3, c.z + c.f * HALL_PLAN.facilityFront));
      if (!air) for (const [rear, dx] of [[HALL_PLAN.tcsSupplyRear, -.18], [HALL_PLAN.tcsReturnRear, .18]]) ports.push(mtx(c.x + dx, 2.3, z - facing[r] * rear).scale(new THREE.Vector3(.5, .5, .5)));
    }));
    scene.add(hallFinishInstances('CDU_PORT', ports));
  } else {
    const cduH = 2.3, cduBody = new THREE.MeshStandardMaterial({ color: 0xc9ccce, roughness: 0.55, metalness: 0.25 });
    cduMx.forEach(it => rbox(S, CW - 0.02 - 0.05, cduH - 0.02, 1.2 - 0.05, cduBody, it.x, cduH / 2, it.z, { r: 0.05, ry: it.f > 0 ? 0 : Math.PI }));
    const cduFront = new THREE.MeshStandardMaterial({ map: TEX.cdu, roughness: 0.5, metalness: 0.2 });
    const cduFrontGeo = new THREE.PlaneGeometry(CW - 0.02 - 0.08, cduH - 0.06); cduFrontGeo.translate(0, cduH / 2, 1.2 / 2 + 0.016);
    const cduPanels = new THREE.InstancedMesh(cduFrontGeo, cduFront, cduMx.length);
    cduMx.forEach((it, i) => cduPanels.setMatrixAt(i, mtx(it.x, 0, it.z, it.f > 0 ? 0 : Math.PI)));
    cduPanels.receiveShadow = true; scene.add(cduPanels);
  }
  // hot aisle containment: glass roof and end doors per pod
  const containmentTrim = new THREE.MeshStandardMaterial({ color: 0x8799a6, roughness: .3, metalness: .72 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xa8c4dd, roughness: 0.22, metalness: 0, ior: 1.5, specularIntensity: 1, envMapIntensity: 1.3, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide });
  for (let p = 0; p < 3; p++) {
    const za = rowZs[p * 2], zb = rowZs[p * 2 + 1], zc = (za + zb) / 2, aisle = Math.abs(zb - za) - 1.2;
    const roofM = new THREE.Mesh(new THREE.BoxGeometry(rowX1 - rowX0, 0.04, aisle), glass); roofM.position.set((rowX0 + rowX1) / 2, 2.35, zc); scene.add(roofM);
    for (const x of [rowX0 - 0.02, rowX1 + 0.02]) {
      const d = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.3, aisle), glass); d.position.set(x, 1.15, zc); scene.add(d);
      N.box(0.06, 2.3, 0.06, MAT.darkSteel, x, 1.15, zc - aisle / 2); N.box(0.06, 2.3, 0.06, MAT.darkSteel, x, 1.15, zc + aisle / 2); N.box(0.06, 0.06, aisle, MAT.darkSteel, x, 2.33, zc);
      N.box(0.05, 2.24, 0.05, MAT.darkSteel, x, 1.15, zc);                                // center mullion: two door leaves, not one sheet of glass
      N.box(0.03, 0.22, 0.05, MAT.black, x, 1.05, zc - aisle / 4); N.box(0.03, 0.22, 0.05, MAT.black, x, 1.05, zc + aisle / 4); // door handles
      // Representative sliding end doors: an aluminium frame round each leaf (top and bottom rails, a
      // kick plate) and an overhead track the leaves hang from, so the doors read as doors, not glass sheets.
      const out = x < rowX0 ? -1 : 1;
      for (const lz of [zc - aisle / 4, zc + aisle / 4]) {
        N.box(.045, .04, aisle / 2 - .07, MAT.alu, x + out * .004, 2.23, lz);
        N.box(.045, .16, aisle / 2 - .07, MAT.alu, x + out * .004, .1, lz);
        for (const e of [-1, 1]) N.box(.045, 2.1, .04, MAT.alu, x + out * .004, 1.16, lz + e * (aisle / 4 - .055));
      }
      N.box(.07, .05, aisle + .1, MAT.darkSteel, x + out * .07, 2.285, zc);                       // top track
      for (const lz of [zc - aisle / 4, zc + aisle / 4]) for (const e of [-1, 1]) N.box(.03, .07, .03, MAT.darkSteel, x + out * .045, 2.25, lz + e * aisle / 8); // hangers
    }
    for (let x = rowX0; x <= rowX1; x += 1.2) N.box(0.04, 0.05, aisle, containmentTrim, x, 2.37, zc);
    for (const z of [zc - aisle / 2, zc + aisle / 2]) N.box(rowX1 - rowX0, .05, .04, containmentTrim, (rowX0 + rowX1) / 2, 2.37, z);
    // Restrained floor wayfinding and a door header make each existing pod legible.
    const signMap = canvasTex(256, 64, (g, w, h) => {
      g.fillStyle = '#263740'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#dbe8ec'; g.font = '600 28px sans-serif'; g.textAlign = 'center';
      g.fillText(`POD ${String(p + 1).padStart(2, '0')}`, w / 2, 42);
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.25, .31), new THREE.MeshStandardMaterial({ map: signMap, roughness: .5 }));
    sign.rotation.y = Math.PI / 2; sign.position.set(rowX1 + .05, 2.12, zc); scene.add(sign);
  }
  // overhead busway per row with tap-off boxes and drops
  const tap = glowMat(dc ? '#d8f04a' : '#ff8a3d', 0.9);
  // Authored tap-off units carry the voltage colour on a label band only (the box itself is grey steel);
  // joint-pack covers every 3 m and threaded-rod trapeze hangers replace the thin struts. Representative.
  const tapMx = [], jointMx = [];
  const tapOff = (x, z) => { if (hasHallFinish()) tapMx.push(mtx(x, 3.39, z)); else N.box(0.22, 0.2, 0.2, tap, x, 3.29, z); };
  N.box(2.7,.22,.18,busway,-10.85,5.6,-6.5);
  const busZ0=busZOf(0),busZ1=busZOf(rowZs.length-1);
  N.box(.18,.22,busZ1-busZ0,busway,-9.5,5.6,(busZ0+busZ1)/2);
  const busZB0=Math.min(busZBOf(0),-5.85),busZB1=busZBOf(rowZs.length-1);
  N.box(.18,.22,busZB1-busZB0,busway,-10.1,6.0,(busZB0+busZB1)/2);                     // B cross bus
  rowZs.forEach((z, r) => {
    for (const [side, bz, crossX, crossY] of [['A', busZOf(r), -9.5, 5.6], ['B', busZBOf(r), -10.1, 6.0]]) {
    S.box(rowX1 - rowX0 + 5, 0.22, 0.18, busway, (rowX0 + rowX1) / 2 - 2.5, 3.5, bz);
    if (hasHallFinish()) {
      // joints and trapezes at rack-group gaps and every fifth rack boundary, clear of the tap-offs
      const gaps = [rowX0 - 2.5, rowX0 - .3];
      for (let gI = 0; gI < groups; gI++) { const gx = rowX0 + gI * (CW + perGroup * RW + GAP); gaps.push(gx + CW + 3 * RW, gx + CW + perGroup * RW + GAP / 2); }
      gaps.forEach((x, i) => {
        if (x < rowX1 - .1) jointMx.push(mtx(x, 3.5, bz));
        for (const dz of [-.14, .14]) N.strut([x + .09, 3.37, bz + dz], [x + .09, WALL_H - 0.9, bz + dz], 0.008, MAT.galv, 6);
        N.box(.04, .035, .34, MAT.galv, x + .09, 3.37, bz);
      });
      N.box(.02, .24, .2, MAT.darkSteel, rowX1 + .005, 3.5, bz);                          // end cap
    } else for (let x = rowX0 + 0.3; x < rowX1; x += 2 * RW) N.strut([x, 3.6, bz], [x, WALL_H - 0.9, bz], 0.012, MAT.darkSteel, 4);
    // each rack's A tap sits on its left (looking at its front), its B tap on its right, as in rack.js
    const tx = k => k.x + (side === 'A' ? -1 : 1) * k.f * HALL_PLAN.tapX;
    rackMx.filter(k => k.z === z).forEach(k => { tapOff(tx(k), bz); N.strut([tx(k), hasHallFinish() ? 3.13 : 3.2, bz], [tx(k), 2.3, bz], hasHallFinish() ? 0.012 : 0.018, dropCable, 6); });
    N.box(.18,crossY-3.5,.18,busway,crossX,(crossY+3.5)/2,bz);
    flows.push(flow(side === 'A' ? [[-12.2, 5.6, -6.5], [-9.5, 5.6, -6.5], [-9.5, 5.6, bz], [-9.5, 3.5, bz], [rowX1, 3.5, bz]] : [[-10.1, 6.0, -5.85], [-10.1, 6.0, bz], [-10.1, 3.5, bz], [rowX1, 3.5, bz]], itV, { count: 20, speed: 2.2, size: 0.07, trailR: 0.02, trailK: 0.25 }));
    // Sampled activity down the already modeled tap/drop cables. Particle count
    // is presentation density; rack count and electrical capacities do not change.
    rackMx.filter(k=>k.z===z).forEach((k,i)=>{
      if(i%(quality.mobile?8:4))return;
      const f=flow([[tx(k),3.5,bz],[tx(k),3.2,bz],[tx(k),2.3,bz]],itV,{count:3,speed:1.4,size:.05,k:2.1,trail:false});
      f.group.userData.rackPowerDrop=side;flows.push(f);
    });
    }
  });
  // yellow fiber runway over the rows and a trunk to the network spine. A slightly muted safety yellow
  // (representative) so the moving fiber ribbons, not the tray, stay the brightest thing in the data view.
  const runwayMat = new THREE.MeshStandardMaterial({ color: 0xc9a431, roughness: 0.5, metalness: 0.05 });
  rowZs.forEach(z => { N.box(rowX1 - rowX0, 0.04, 0.3, runwayMat, (rowX0 + rowX1) / 2, 4.3, z); N.box(rowX1 - rowX0, 0.1, 0.02, runwayMat, (rowX0 + rowX1) / 2, 4.35, z - 0.15); N.box(rowX1 - rowX0, 0.1, 0.02, runwayMat, (rowX0 + rowX1) / 2, 4.35, z + 0.15); });
  // rolled lips on the channel walls and a joint splice every 1.8 m, so the runway reads as a formed U-channel
  rowZs.forEach(z => {
    for (const dz of [-0.155, 0.155]) N.cylX(.013, rowX1 - rowX0, runwayMat, (rowX0 + rowX1) / 2, 4.405, z + dz, 8);
    for (let x = rowX0 + 1.8; x < rowX1 - .3; x += 1.8) N.box(.05, .1, .336, runwayMat, x, 4.343, z);
  });
  N.box(0.3, 0.04, 23, runwayMat, rowX0 - 1.3, 4.3, -1.6);
  // Short connectors join each row runway to the cross-hall trunks.
  rowZs.forEach(z=>{
    N.box(1.3,.04,.3,runwayMat,rowX0-.65,4.3,z);
    N.box(.45,.04,.3,runwayMat,rowX1+.225,4.3,z);
  });
  // network spine racks along the front
  // ten pluggable spine switches, then the CPO comparison unit set apart past the end of the row: a fabric that
  // adopts CPO uses it in place of pluggable switches, so it must not read as one mixed into the row
  const netItems = []; for (let i = 0; i < 10; i++) netItems.push({ x: rowX0 + 2 + i * 0.62, z: 10.5, f: 1 });
  netItems.push({ x: rowX0 + 2 + 9 * 0.62 + 1.2, z: 10.5, f: 1 });
  instanced(0.6, 2.3, 1.2, TEX.net, 0x131519, netItems);
  // spine faceplates: pluggable OSFP; the unit apart is the CPO switch (liquid-cooled, MPO direct on the chassis)
  const CPO_I = 10;
  scene.userData.cpoComparison={deployed:false,fiberDrops:0,cappedCoolantPorts:4,mpoConnectors:144,laserModules:18};
  netItems.forEach((it, i) => {
    if (i === CPO_I) { cpoFace(it.x, it.z, it.f); }
    else { pluggableFace(it.x, it.z, it.f, { forms: bigSwitch ? ['q3400', 'q3400'] : ['qm9700', 'qm9700', 'qm9700', 'qm9700'], y0: 1.52 }); }   // chassis per rack representative
  });
  // Extend the IT distribution to deployed network racks as well as compute.
  // These are representative rack feeds, not building voltage applied to an OSFP.
  // The switch's PSU/regulators supply the module; the closeup draws that boundary.
  const networkFeeds = [];
  function networkPowerRoute(points, radius, kind) {
    for (let i = 1; i < points.length; i++) N.strut(points[i - 1], points[i], radius, busway, 6);
    const f = flow(points, itV, { count: kind === 'busway' ? 12 : 4, speed: 1.5, size: .045, trailR: .012, trailK: .18 });
    f.group.userData.networkPower = kind; flows.push(f);
    networkFeeds.push({ kind, points });
  }
  const spineBusZ = 10.25, lastSpineX = netItems[CPO_I - 1].x;
  networkPowerRoute([[-9.5, 5.6, busZ1], [-9.5, 5.6, spineBusZ], [-9.5, 3.5, spineBusZ], [lastSpineX, 3.5, spineBusZ]], .07, 'busway');
  netItems.slice(0, CPO_I).forEach(it => {
    tapOff(it.x, spineBusZ);
    networkPowerRoute([[it.x, 3.5, spineBusZ], [it.x, 2.3, spineBusZ]], .018, 'spine-drop');
  });
  scene.userData.networkPowerFeeds = networkFeeds;
  // this one switch stands apart from the pluggable row for comparison, not as a claim that the spine
  // actually mixes both — the tag keeps it from reading as deployed hardware or a ledger change.
  // kept small: the 'cpo' hotspot camera is close enough that a sprite sized like the rack-top
  // stage numbers below would fill the frame and hide the very chassis it is meant to label
  // The comparison hotspot is a fitted view of the faceplate itself (0.47 x 0.34 m), so the 144 MPO adapters,
  // 18 laser modules and 4 capped couplings fill the frame; the pin sits on the MPO field. The tag above
  // the chassis and the data layer's rack-top replica labels stay outside this frame.
  const cpoAt = netItems[CPO_I], cpoFront = cpoAt.z + cpoAt.f * .64;
  // The camera looks down on it about 25 degrees, so pins of parts far behind it (the hot aisle, the busway)
  // project above the frame instead of onto the faceplate.
  const cpoSpot = { pos: [cpoAt.x + .08, 1.64, cpoFront + cpoAt.f * .03],
    view: { pos: [cpoAt.x - .12, 2.27, cpoFront + cpoAt.f * 1.2], target: [cpoAt.x, 1.71, cpoFront], detailSize: [.5, .36, .06] } };
  const cpoTag = textSprite('CPO alternative · disconnected', '#8fe4ff', 0.065);
  cpoTag.position.set(netItems[CPO_I].x, 2.42, netItems[CPO_I].z + netItems[CPO_I].f * 0.85);
  scene.add(cpoTag);
  N.box(.3,.04,.6,runwayMat,rowX0-1.3,4.3,10.2);
  // fiber distribution frames: every fabric link is patched here, between the spine row and the cross-hall sleeve
  const odfTex = canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = '#d7dadd'; g.fillRect(0, 0, w, h);
    for (let y = 16; y < h - 16; y += 14) { g.fillStyle = '#b9bec3'; g.fillRect(12, y, w - 24, 11); for (let x = 16; x < w - 16; x += 6) { g.fillStyle = (x + y) % 5 ? '#2e8fd6' : '#e8c547'; g.fillRect(x, y + 3, 3, 5); } }
    g.fillStyle = 'rgba(230,190,40,0.55)'; for (let i = 0; i < 26; i++) { const x = 20 + i * 8.5; g.fillRect(x, 0, 2, h * (0.35 + 0.5 * ((i * 37) % 11) / 11)); }
  });
  const odfItems = []; for (let i = 0; i < 8; i++) odfItems.push({ x: rowX0 + 1.2 + i * 0.92, z: 14.2, f: 1 });
  const odfFront = new THREE.MeshStandardMaterial({ map: odfTex, roughness: 0.6, metalness: 0.1 });
  const odfSide = new THREE.MeshStandardMaterial({ color: 0xd3d6d9, roughness: 0.6, metalness: 0.1 });
  const odfGeo = new THREE.BoxGeometry(0.88, 2.2, 0.6); odfGeo.translate(0, 1.1, 0);
  if (hasHallFinish()) scene.add(hallFinishInstances('HALL_ODF', odfItems.map(it => mtx(it.x, 0, it.z))));   // open bays: housings, managers, jumpers
  else {
    const odf = new THREE.InstancedMesh(odfGeo, [odfSide, odfSide, odfSide, odfSide, odfFront, odfSide], odfItems.length);
    odfItems.forEach((it, i) => odf.setMatrixAt(i, mtx(it.x, 0, it.z)));
    odf.castShadow = odf.receiveShadow = true; scene.add(odf);
  }
  N.box(0.3, 0.04, 3.7, runwayMat, rowX0 + 4.8, 4.3, 12.35);                         // runway spine row → frames
  N.box(7.8, 0.04, 0.3, runwayMat, rowX0 + 4.4, 4.3, 14.2);
  // floor sleeve where the cross-hall cables drop into the duct bank
  const sleeveX = rowX0 + 9.4, sleeveZ = 14.2;
  S.cyl(0.36, 0.12, MAT.darkSteel, sleeveX, 0.2, sleeveZ, 20);
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; N.strut([sleeveX + Math.cos(a) * 0.16, 4.3, sleeveZ + Math.sin(a) * 0.16], [sleeveX + Math.cos(a) * 0.16, 0.1, sleeveZ + Math.sin(a) * 0.16], 0.045, runwayMat, 8); }
  N.box(1.4, 0.04, 0.3, runwayMat, sleeveX - 0.6, 4.3, sleeveZ);
  // ---------- storage & control racks: patched via the ODF runway ----------
  // storage: short 2U drive-shelf racks (dense drive-bay grid, no NVLink gear, no coolant manifolds) plus a
  // pair of storage/front-end Ethernet switches on top of the last one; control: head/login/scheduler nodes
  const svcZ = 12.0, svcGap = 0.6, storageX0 = 6.0;
  const storageMx = []; for (let i = 0; i < 4; i++) storageMx.push({ x: storageX0 + i * RW + RW / 2, z: svcZ, f: 1 });
  instanced(RW - 0.02, 2.3, 1.2, TEX.storage, 0x131519, storageMx).name = 'Storage rack faces';
  const storLast = storageMx[3];
  pluggableFace(storLast.x, storLast.z, storLast.f, { forms: ['tor', 'tor'], y0: 2.02 });   // representative storage/front-end pair
  N.box(2.0, 0.04, 0.3, runwayMat, storLast.x, 4.3, svcZ);                             // short local runway stub
  N.box(2.0, 0.1, 0.02, runwayMat, storLast.x, 4.35, svcZ - 0.15);
  // Rear wall leaves a T-junction into the storage-to-ODF spur.
  for(const side of [-1,1])N.box(.8,.1,.02,runwayMat,storLast.x+side*.6,4.35,svcZ+.15);

  const controlX0 = storageX0 + 4 * RW + svcGap;
  const controlMx = []; for (let i = 0; i < 2; i++) controlMx.push({ x: controlX0 + i * RW + RW / 2, z: svcZ, f: 1 });
  instanced(RW - 0.02, 2.3, 1.2, TEX.cpu, 0x131519, controlMx).name = 'Control rack faces';
  scene.userData.supportRacks = { storage: storageMx.length, control: controlMx.length, representative: true };
  const ctrlFirst = controlMx[0];
  N.box(ctrlFirst.x-sleeveX,.04,.3,runwayMat,(ctrlFirst.x+sleeveX)/2,4.3,14.2);
  for(const it of [storLast,ctrlFirst]){
    N.box(.3,.04,2.2,runwayMat,it.x,4.3,13.1);
    N.box(.6,.04,.3,runwayMat,it.x,4.3,svcZ);
  }
  pluggableFace(ctrlFirst.x, ctrlFirst.z, ctrlFirst.f, { forms: ['tor'], y0: 2.06 }); // small ToR management switch, representative
  // scale-out: a leaf-switch rack at the end of every row, a cross runway to the spine row
  const leafX = rowX1 + 0.45;
  rowZs.forEach((z, r) => {
    const bz = busZOf(r);
    networkPowerRoute([[rowX1, 3.5, bz], [leafX, 3.5, bz]], .07, 'busway');
    tapOff(leafX, bz);
    networkPowerRoute([[leafX, 3.5, bz], [leafX, 2.3, bz]], .018, 'leaf-drop');
  });
  instanced(0.6, 2.3, 1.2, TEX.net, 0x131519, rowZs.map((z, r) => ({ x: leafX, z, f: facing[r] })));
  if (tapMx.length) {
    const taps = hallFinishInstances('TAPOFF', tapMx);
    taps.traverse(o => { if (o.isMesh && o.material.name === 'Voltage label band') { o.material.color.set(dc ? '#d8f04a' : '#ff8a3d'); o.material.emissive.set(dc ? '#d8f04a' : '#ff8a3d'); } });
    scene.add(taps, hallFinishInstances('BUS_JOINT', jointMx));
  }
  // leaf faceplates: pluggable OSFP modules, fiber pigtails rising into the runway overhead
  tanTabs = multimodeTabKeys(model, leafX, rowZs);
  rowZs.forEach((z, r) => { pluggableFace(leafX, z, facing[r], { forms: bigSwitch ? ['q3400'] : ['qm9700', 'qm9700'], y0: 1.52 }); });
  N.box(.3,.04,23,runwayMat,leafX,HALL_RUNWAY.floorY,-.8);
  // Open T-junctions: the row fibers must not pass through a solid tray wall.
  const runwayOpenings=[...rowZs,10.5];let wallStart=-12.3;
  for(const junction of runwayOpenings){
    const end=junction-.2;
    if(end>wallStart)N.box(.02,.1,end-wallStart,runwayMat,leafX-.15,4.35,(wallStart+end)/2);
    wallStart=junction+.2;
  }
  N.box(.02,.1,23,runwayMat,leafX+.15,4.35,-.8);
  N.box(leafX-(rowX0-1.3),.04,.3,runwayMat,(leafX+rowX0-1.3)/2,4.3,10.5);
  // patch panels on the spine row
  // 1U MPO patch panel in each spine rack's top units (was a block sitting on the roof): 12 cassette ports
  for (let i = 0; i < 10; i++) {
    const px = rowX0 + 2 + i * 0.62;
    N.box(.438, .042, .014, MAT.darkSteel, px, 2.12, 11.107);
    for (let k = 0; k < 12; k++) N.box(.02, .012, .01, mpoBody, px - .165 + k * .03, 2.12, 11.118);
  }
  rowZs.forEach((z,r)=>{
    const ports=networkPorts.get(`${leafX}:${z}`),row=rackMx.filter(k=>k.z===z);
    row.forEach((k,i)=>{
      const {points:rise,audit}=rackDrop(k),drop=portDrop(ports[i],z);
      const route=fiberPath([...rise,[drop.at(-1)[0],HALL_RUNWAY.cableY,z],...drop.slice(0,-1).reverse()],
        'rack-to-leaf',{count:10,particles:i%(quality.mobile?8:4)===0||i===10,audit});
      route.rack={x:k.x,z:k.z,f:k.f};
    });
    const leaf=portDrop(ports.at(-1),z),spineRack=netItems[r],spinePort=networkPorts.get(`${spineRack.x}:10.5`)[0];
    const spine=portDrop(spinePort,10.5);
    fiberPath([...leaf,[leafX,HALL_RUNWAY.cableY,z],[leafX,HALL_RUNWAY.cableY,10.5],
      [spine.at(-1)[0],HALL_RUNWAY.cableY,10.5],...spine.slice(0,-1).reverse()],'leaf-to-spine',{count:14,size:.06});
  });
  // Spine patching and storage/control use the same continuous overhead plan.
  netItems.slice(0,CPO_I).forEach((it,i)=>{
    const start=portDrop(networkPorts.get(`${it.x}:${it.z}`).at(-1),it.z),od=odfItems[i%odfItems.length];
    const px=od.x+(i<odfItems.length?-.12:.12),end=[px,2.17,od.z+.32];
    N.box(.08,.06,.04,mpoBody,...end);
    fiberPath([...start,[rowX0+4.8,HALL_RUNWAY.cableY,10.5],
      [rowX0+4.8,HALL_RUNWAY.cableY,14.2],[px,HALL_RUNWAY.cableY,14.2],
      [px,HALL_RUNWAY.entryY,14.2],[px,HALL_RUNWAY.entryY,end[2]],end],'spine-to-patch',{count:8,size:.045});
  });
  for(const [i,it] of [storLast,ctrlFirst].entries()) {
    const rise=portDrop(networkPorts.get(`${it.x}:${it.z}`).at(-1),it.z),od=odfItems.at(-1),px=od.x+.12+i*.18,end=[px,2.17,od.z+.32];
    N.box(.08,.06,.04,mpoBody,...end);
    fiberPath([...rise,[it.x,HALL_RUNWAY.cableY,svcZ],[it.x,HALL_RUNWAY.cableY,14.2],[px,HALL_RUNWAY.cableY,14.2],
      [px,HALL_RUNWAY.entryY,14.2],[px,HALL_RUNWAY.entryY,end[2]],end],'storage-control',{count:8,size:.045});
  }
  scene.userData.hallFiber={routes:fiberRoutes,runway:HALL_RUNWAY,computeRackCount:rackMx.length,representative:true};
  // fan wall on the east side
  S.slab(1.2, 6, 26, MAT.darkSteel, X1 - 1.0, 0, -3);
  const wallFans = [];
  const fanCells = [];
  for (let yi = 0; yi < 4; yi++) for (let zi = 0; zi < 14; zi++) {
    const fy = 1.1 + yi * 1.4, fz = -15 + zi * 1.8;
    if (hasHallFinish()) fanCells.push(mtx(X1 - 1.64, fy, fz, -Math.PI / 2));      // authored cell: frame, bellmouth, guard
    else { N.cylX(0.62, 0.1, MAT.fan, X1 - 1.65, fy, fz, 18); N.cylX(0.66, 0.06, MAT.galv, X1 - 1.62, fy, fz, 18); }
    wallFans.push({ p: [X1 - 1.76, fy, fz], axis: 'x', r: 0.56 });
  }
  if (fanCells.length) scene.add(hallFinishInstances('FANWALL_CELL', fanCells));
  const fans = spinners(wallFans, MAT.darkSteel, { speed: 4 }); if(hasCampusCatalog())campusCatalogRotor(fans.mesh); scene.add(fans.mesh);
  // facility water: insulated headers along the back wall, drops to every CDU
  const hdrY = 6.2;
  const facilitySupplyX=X0+2,facilityReturnX=X0+2.8,headerEndX=rowX1+3;
  const coolantAudit={facility:[],secondary:[],rackDrops:[],facilityDrops:[],representative:true};
  // facility water drops into the front of each CDU (HALL_PLAN), clear of the fiber runway and the busway
  const fwZ = c => c.z + c.f * HALL_PLAN.facilityFront;
  const coolantPipe=(pts,mat,r=.035,kind='secondary')=>{for(let i=1;i<pts.length;i++)N.strut(pts[i-1],pts[i],r,mat,8);coolantAudit[kind].push(pts);};
  coolantAudit.facility.push([[facilitySupplyX,hdrY,-16.4],[headerEndX,hdrY,-16.4]]);
  coolantAudit.facility.push([[facilityReturnX,hdrY-.7,-16.4],[headerEndX,hdrY-.7,-16.4]]);
  // Where the return riser rises: it jogs toward the room so it never crosses the supply header.
  const returnRiserZ = -14.8;
  if (hasHallFinish()) {
    // Authored pipework: smooth runs, long-radius elbows (R = 1.5 D), weld-neck flanges every 6 m,
    // trapeze hangers every 3 m, a flanged take-off and a geared butterfly valve on every CDU branch,
    // and risers leaving through a roof curb. Fittings, spacing and valve positions are representative.
    const V3 = (a) => new THREE.Vector3(...a), runs = new Map(), bends = new Map(), flanges = [], valves = [], bands = [];
    const frame = (dir, hint = [0, 1, 0]) => {
      const x = V3(dir).normalize(); let h = V3(hint); if (Math.abs(h.dot(x)) > .9) h = V3([1, 0, 0]);
      const z = new THREE.Vector3().crossVectors(x, h).normalize(), y = new THREE.Vector3().crossVectors(z, x);
      return [x, y, z];
    };
    const place = ([x, y, z], at, sx, sy, sz) => new THREE.Matrix4().makeBasis(x.multiplyScalar(sx), y.multiplyScalar(sy), z.multiplyScalar(sz)).setPosition(V3(at));
    const add = (map, mat, m) => { if (!map.has(mat)) map.set(mat, []); map.get(mat).push(m); };
    const run = (a, b, r, mat) => { const d = V3(b).sub(V3(a)), len = d.length(); if (len < .01) return; add(runs, mat, place(frame(d.toArray()), V3(a).add(V3(b)).multiplyScalar(.5).toArray(), len, r, r)); };
    const bend = (corner, din, dout, r, mat) => {
      const X = V3(din), Y = V3(dout), Z = new THREE.Vector3().crossVectors(X, Y);
      add(bends, mat, place([X, Y, Z], V3(corner).addScaledVector(X, -3 * r).addScaledVector(Y, 3 * r).toArray(), r, r, r));
    };
    const rH = .26, eH = 3 * rH, rD = .07, eD = 3 * rD;
    // supply: header west end turns up into its riser
    bend([X0 + 2, hdrY, -16.4], [-1, 0, 0], [0, 1, 0], rH, MAT.pipeBlue);
    run([X0 + 2 + eH, hdrY, -16.4], [headerEndX, hdrY, -16.4], rH, MAT.pipeBlue);
    run([X0 + 2, hdrY + eH, -16.4], [X0 + 2, 8.9, -16.4], rH, MAT.pipeBlue);
    // return: header, a jog toward the room, then its riser
    run([X0 + 2.8 + eH, hdrY - .7, -16.4], [headerEndX, hdrY - .7, -16.4], rH, MAT.pipeRed);
    bend([X0 + 2.8, hdrY - .7, -16.4], [-1, 0, 0], [0, 0, 1], rH, MAT.pipeRed);
    run([X0 + 2.8, hdrY - .7, -16.4 + eH], [X0 + 2.8, hdrY - .7, returnRiserZ - eH], rH, MAT.pipeRed);
    bend([X0 + 2.8, hdrY - .7, returnRiserZ], [0, 0, 1], [0, 1, 0], rH, MAT.pipeRed);
    run([X0 + 2.8, hdrY - .7 + eH, returnRiserZ], [X0 + 2.8, 8.9, returnRiserZ], rH, MAT.pipeRed);
    for (let x = X0 + 6; x < headerEndX - 1; x += 6) for (const y of [hdrY, hdrY - .7]) flanges.push(place(frame([1, 0, 0]), [x, y, -16.4], rH, rH, rH));
    // trapeze hangers: two rods from under the wall crown, a strut under each header, a band on each pipe
    for (let x = X0 + 4.5; x < headerEndX - .5; x += 3) {
      for (const dz of [-.42, .42]) N.strut([x, 7.35, -16.4 + dz], [x, hdrY - .7 - rH - .07, -16.4 + dz], .011, MAT.galv, 6);
      for (const y of [hdrY, hdrY - .7]) { N.box(.05, .05, .95, MAT.galv, x, y - rH - .035, -16.4); bands.push(place(frame([1, 0, 0]), [x, y, -16.4], rH, rH, rH)); }
    }
    // CDU branches: one flanged take-off per column of CDUs, a branch main out to the farthest row, a
    // long-radius bend there and a tee (collar) at each nearer row; every drop carries a geared butterfly valve.
    const columns = new Map(); cduMx.forEach(c => { const k = c.x.toFixed(3); if (!columns.has(k)) columns.set(k, []); columns.get(k).push(c); });
    for (const list of columns.values()) {
      const far = list.reduce((a, b) => (fwZ(b) > fwZ(a) ? b : a));
      for (const [dx, y, mat, side, valveDrop] of [[-.15, hdrY, MAT.pipeBlue, -1, .6], [.15, hdrY - .7, MAT.pipeRed, 1, .6]]) {
        const x = far.x + dx;
        flanges.push(place(frame([0, 0, 1]), [x, y, -16.4 + rH + .01], rD, rD, rD));
        run([x, y, -16.4], [x, y, fwZ(far) - eD], rD, mat);
        bend([x, y, fwZ(far)], [0, 0, 1], [0, -1, 0], rD, mat);
        for (const c of list) {
          if (c !== far) flanges.push(place(frame([0, 0, 1]), [x, y, fwZ(c)], rD, rD, rD));
          run([x, c === far ? y - eD : y, fwZ(c)], [x, 2.3, fwZ(c)], rD, mat);
          coolantAudit.facilityDrops.push([[x, y, fwZ(c)], [x, 2.3, fwZ(c)]]);
          valves.push(place(frame([0, -1, 0], [side, 0, 0]), [x, y - valveDrop, fwZ(c)], rD, rD, rD));
        }
      }
    }
    const inst = (name, list, mat) => { if (!list.length) return; const g = hallFinishInstances(name, list); if (mat) g.traverse(o => { if (o.isMesh) o.material = mat; }); scene.add(g); };
    for (const [mat, list] of runs) inst('PIPE_UNIT', list, mat);
    for (const [mat, list] of bends) inst('PIPE_ELBOW', list, mat);
    inst('PIPE_FLANGE', flanges); inst('BUTTERFLY_VALVE', valves); inst('PIPE_HANGER', bands);
    // Roof curb where the risers leave the building: the one bay of roof kept in the cutaway. The deck bears on
    // the back wall's crown and on two steel roof beams framed into that wall, both cut off at the bay's edge
    // with the rest of the section, so it reads as retained roof rather than a plate hanging in the air.
    const curbZ0 = Z0 - .28, curbZ1 = -14.1, curbZc = (curbZ0 + curbZ1) / 2, curbL = curbZ1 - curbZ0;
    const beamTop = WALL_H + .295, beamD = .4;
    for (const bx of [X0 + 1.02, X0 + 3.78]) {
      for (const y of [beamTop - .0125, beamTop - beamD + .0125]) N.box(.17, .025, curbL - .05, MAT.darkSteel, bx, y, curbZc - .025);
      N.box(.012, beamD - .05, curbL - .05, MAT.darkSteel, bx, beamTop - beamD / 2, curbZc - .025);
    }
    S.box(3.18, beamTop - WALL_H - .01, .29, MAT.concrete, X0 + 2.4, (WALL_H + beamTop) / 2, Z0 - .15);   // wall crown under the deck
    S.box(3.2, .22, curbL, MAT.concrete, X0 + 2.4, beamTop + .005 + .11, curbZc);
    N.box(3.2, .02, curbL, cutTop, X0 + 2.4, beamTop + .005 + .23, curbZc);
    for (const [x, z] of [[X0 + 2, -16.4], [X0 + 2.8, returnRiserZ]]) N.cyl(.34, .14, MAT.galv, x, beamTop + .31, z, 24);
  } else {
    S.cylX(0.26, headerEndX-facilitySupplyX, MAT.pipeBlue, (headerEndX+facilitySupplyX)/2, hdrY, -16.4, 16);
    S.cylX(0.26, headerEndX-facilityReturnX, MAT.pipeRed, (headerEndX+facilityReturnX)/2, hdrY-.7, -16.4, 16);
    for (let x = rowX0 - 9; x < rowX1 + 3; x += 5) N.strut([x, hdrY + 0.2, -16.4], [x, WALL_H - 0.9, -16.4], 0.03, MAT.darkSteel, 4);
    cduMx.forEach(c => {
      const z = fwZ(c);
      N.strut([c.x - 0.15, hdrY, -16.4], [c.x - 0.15, hdrY, z], 0.07, MAT.pipeBlue, 8); N.strut([c.x - 0.15, hdrY, z], [c.x - 0.15, 2.3, z], 0.07, MAT.pipeBlue, 8);
      N.strut([c.x + 0.15, hdrY - 0.7, -16.4], [c.x + 0.15, hdrY - 0.7, z], 0.07, MAT.pipeRed, 8); N.strut([c.x + 0.15, hdrY - 0.7, z], [c.x + 0.15, 2.3, z], 0.07, MAT.pipeRed, 8);
      for (const dx of [-.15, .15]) coolantAudit.facilityDrops.push([[c.x + dx, dx < 0 ? hdrY : hdrY - .7, z], [c.x + dx, 2.3, z]]);
      N.cylZ(0.12, 0.08, MAT.orange, c.x - 0.15, hdrY - 0.35, z, 12);                      // valve handwheel
    });
  }
  // ASME A13.1-style markers with flow arrows on the headers, risers and CDU drops (cooling-marks.js)
  hallPipeMarks(scene, model, { X0, hdrY, headerEndX, returnRiserZ, cduMx: cduMx.map(c => ({ ...c, z: fwZ(c) })), risers: hasHallFinish() });
  // rack loop from each CDU along its rack group, over the rear of the rack tops (liquid-cooled racks only). Supply and
  // return run as two parallel headers 0.1 m apart over the rack rears, below and clear of the busway; each rack takes
  // its supply drop on one side and its return on the other, where its two rear manifolds rise to the roof (rack.js).
  const tcsZ = r => ({ supply: rowZs[r] - facing[r] * HALL_PLAN.tcsSupplyRear, ret: rowZs[r] - facing[r] * HALL_PLAN.tcsReturnRear });
  if (!air) rowZs.forEach((z, r) => {
    const { supply: zS, ret: zR } = tcsZ(r), f = facing[r];
    for (let gI = 0; gI < groups; gI++) {
      const x0 = rowX0 + gI * (CW + perGroup * RW + GAP), x1 = x0 + CW + perGroup * RW;
      // Two isolated secondary circuits exit the CDU; every rack has paired
      // drops. Facility water terminates separately on the CDU top, at its front.
      const cx=x0+CW/2;
      for(const [lzz,dx,side,mat] of [[zS,-.18,-1,MAT.pipeBlue],[zR,.18,1,MAT.pipeRed]]){
        coolantPipe([[cx+dx,2.3,lzz],[cx+dx,2.45,lzz],[x1,2.45,lzz]],mat);
        for(let k=0;k<perGroup;k++){
          const rx=x0+CW+(k+.5)*RW+side*f*HALL_PLAN.tcsDropX;
          coolantPipe([[rx,2.45,lzz],[rx,2.28,lzz]],mat,.022,'rackDrops');
          N.cyl(.042,.045,MAT.alu,rx,2.315,lzz,8); // representative quick-disconnect collar
        }
        N.cylX(.046,.035,mat,x1,2.45,lzz,8); // closed manifold end, not an open outlet
      }
      if (r % 2 === 0 && gI % 2 === 0) {
        flows.push(flow([[x0 + CW / 2 - .18, 2.45, zS], [x1, 2.45, zS]], 'cool', { count: 8, speed: 1.2, size: 0.05, k: 1.6, trail: false }));
        flows.push(flow([[x1, 2.45, zR], [x0 + CW / 2 + .18, 2.45, zR]], 'warm', { count: 8, speed: 1.2, size: 0.05, k: 1.6, trail: false }));
      }
    }
  });
  flows.push(flow([[X0 + 2, hdrY, -16.4], [rowX1 + 2, hdrY, -16.4]], 'cool', { count: 24, speed: 3, size: 0.12, k: 1.6, trail: false }));
  flows.push(flow([[rowX1 + 2, hdrY - 0.7, -16.4], [facilityReturnX, hdrY - 0.7, -16.4]], 'warm', { count: 24, speed: 3, size: 0.12, k: 1.6, trail: false }));
  // ---------- heat layer ----------
  // Two heat paths, as the level's intro says: water (the liquid share, through the coolant units to the facility
  // loop) and air (the rest, through the hot aisles). In an air-cooled hall all of it rides the air to the in-row
  // coolers, and the chilled water then carries all of it out. Watts are for the racks drawn.
  const hallW = rackMx.length * model.rack.kw * 1000, liq = air ? 0 : model.accel.liquidShare;
  const waterW = air ? hallW : hallW * liq, airW = air ? hallW : hallW * (1 - liq);
  const water = f => tagHeat(f, 'hall-water', waterW, 'carrier'), hallAir = f => tagHeat(f, 'hall-air', airW, 'carrier');
  heatFlows.push(water(flow([[X0 + 2, hdrY + 3, -16.4], [X0 + 2, hdrY, -16.4], [rowX1 + 2, hdrY, -16.4]], 'cool', { count: 36, speed: 3, size: 0.14, k: 2.4, trailR: 0.1, trailK: 0.4 })));
  heatFlows.push(water(flow([[rowX1 + 2, hdrY - 0.7, -16.4], [X0 + 2.8, hdrY - 0.7, -16.4], [X0 + 2.8, hdrY - 0.7, returnRiserZ], [X0 + 2.8, hdrY + 2.8, returnRiserZ]], 'warm', { count: 36, speed: 3, size: 0.14, k: 2.4, trailR: 0.1, trailK: 0.4 })));
  cduMx.forEach(c => {
    const z = fwZ(c);
    heatFlows.push(water(flow([[c.x - 0.15, hdrY, -16.4], [c.x - 0.15, hdrY, z], [c.x - 0.15, 2.3, z]], 'cool', { count: 5, speed: 2.2, size: 0.13, k: 1.5, trail: false })));
    heatFlows.push(water(flow([[c.x + 0.15, 2.3, z], [c.x + 0.15, hdrY - 0.7, z], [c.x + 0.15, hdrY - 0.7, -16.4]], 'warm', { count: 5, speed: 2.2, size: 0.13, k: 1.5, trail: false })));
  });
  if (!air) rowZs.forEach((z, r) => {
    const { supply: zS, ret: zR } = tcsZ(r);
    for (let gI = 0; gI < groups; gI++) {
      const x0 = rowX0 + gI * (CW + perGroup * RW + GAP), x1 = x0 + CW + perGroup * RW;
      heatFlows.push(water(flow([[x0 + CW / 2 - .18, 2.45, zS], [x1, 2.45, zS]], 'cool', { count: 6, speed: 1.2, size: 0.1, k: 1.5, trail: false })));
      heatFlows.push(water(flow([[x1, 2.45, zR], [x0 + CW / 2 + .18, 2.45, zR]], 'warm', { count: 6, speed: 1.2, size: 0.1, k: 1.5, trail: false })));
    }
  });
  // hot air: along each contained aisle, out the end, through the fan wall, back cool (none from all-liquid racks)
  if (heatWeight(airW, waterW)) for (let p = 0; p < 3; p++) {
    const zc = (rowZs[p * 2] + rowZs[p * 2 + 1]) / 2;
    for (const y of [0.8, 1.5, 2.1]) heatFlows.push(hallAir(flow([[rowX0 + 1, y, zc], [rowX1 + 1.2, y + 0.4, zc], [X1 - 1.8, y + 1.2, zc]], 'air', { count: 16, speed: 2.2, size: 0.13, k: 1.5, opacity: 0.9, trail: false })));
    heatFlows.push(hallAir(flow([[X1 - 2.2, 0.7, zc + 3.3], [rowX0 + 2, 0.5, zc + 3.3]], 'cool', { count: 14, speed: 2.0, size: 0.12, k: 2.0, opacity: 0.6, trail: false })));
  }
  balanceHeat(heatFlows);
  // A separate panel port exits through the sleeve into the cross-hall duct.
  const crossPatch=[odfItems[6].x+.12,2.17,14.52];
  N.box(.08,.06,.04,mpoBody,...crossPatch);
  fiberPath([crossPatch,[crossPatch[0],HALL_RUNWAY.entryY,14.52],
    [crossPatch[0],HALL_RUNWAY.entryY,14.2],[crossPatch[0],HALL_RUNWAY.cableY,14.2],
    [sleeveX,HALL_RUNWAY.cableY,14.2],[sleeveX,HALL_RUNWAY.entryY,14.2],
    [sleeveX,HALL_RUNWAY.entryY,14.48],[sleeveX,.26,14.48]],'cross-hall',{count:14,size:.065});
  // ---------- parallelism overlay (data layer): stages and replicas on the rack tops ----------
  const stageCol = ['#ff5fd2', '#c77dff', '#7c9cff', '#5ce1c6'];
  const par = new THREE.Group();
  const stageMats = stageCol.map(c => glowMat(c, 1.1, 0.85));
  const tintGeo = new THREE.BoxGeometry(RW - 0.08, 0.03, 1.0), tints = [[], [], [], []];
  rowZs.forEach(z => {
    const racks = rackMx.filter(k => k.z === z);
    racks.forEach((k, i) => {
      tints[i % 4].push(mtx(k.x, 2.34, z));                       // one instanced mesh per stage color, not one mesh per rack
    });
  });
  tints.forEach((list, c) => { const m = new THREE.InstancedMesh(tintGeo, stageMats[c], list.length); list.forEach((mx, n) => m.setMatrixAt(n, mx)); par.add(m); });
  const front = rackMx.filter(k => k.z === rowZs[5]);
  ['1', '2', '3', '4'].forEach((t, i) => { const s = textSprite(t, stageCol[i], 0.28); s.position.set(front[i].x, 2.75, rowZs[5] + 0.6); par.add(s); });
  for (let g = 0; g < 4; g++) { const s = textSprite(`replica ${g + 1}`, g ? '#a6f35a' : '#e8ecf2', 0.3); s.position.set((front[g * 4 + 1].x + front[g * 4 + 2].x) / 2, 3.25, rowZs[5] + 0.6); par.add(s); }
  scene.add(par);
  buildBreakout({ model, scene, layer: par, leafX, rowZs, ports: networkPorts.get(`${leafX}:${rowZs[1]}`), racks: rackMx.filter(k => k.z === rowZs[1]), quality });
  scene.userData.hallCoolant=coolantAudit;
  // the overhead plan the design-rule tests check (design-rules-rack-hall-site.test.ts)
  scene.userData.hallPlan = { ...HALL_PLAN, rackDepth: 1.2, busY: 3.5, busHalfDepth: .09, runwayY: HALL_RUNWAY.floorY, runwayHalfWidth: .15, tcsY: 2.45,
    rowX0, rowX1, rows: rowZs.map((z, r) => ({ z, f: facing[r], busZ: busZOf(r), busZB: busZBOf(r), runwayZ: z, ...(air ? {} : { tcsSupplyZ: tcsZ(r).supply, tcsReturnZ: tcsZ(r).ret }) })) };
  // headers leave through the roof to the facility cooling plant
  if (!hasHallFinish()) { S.cyl(0.26, 3, MAT.pipeBlue, X0 + 2, hdrY + 1.4, -16.4, 16); S.cylZ(0.26, 1.6, MAT.pipeRed, X0 + 2.8, hdrY - .7, -15.6, 16); S.cyl(0.26, 3.6, MAT.pipeRed, X0 + 2.8, hdrY + 1.1, returnRiserZ, 16); }

  // ---------- lighting fixtures, activity and finishing detail ----------
  // ceiling fixtures: warm pools over the power room, cool white rows over the data hall aisles
  const roomLampZs = hasHallFinish() ? [-17.30] : quality.mobile ? [-9] : [-13, -6.5, 2];
  const roomLampItems = [];
  for (let x = -37; x <= -23; x += quality.mobile ? 8 : 4) for (const lz of roomLampZs) roomLampItems.push({ p: [x, 6.9, lz], w: 1.1, d: 1.0 });
  if(hasHallFinish())scene.add(hallFinishInstances('LUMINAIRE',roomLampItems.map(it=>mtx(...it.p))));
  else scene.add(lamps(roomLampItems, { color: '#ffcf9e', k: 1.25, halo: 1.1, haloOpacity: 0.10 }));
  const hallLampZs = hasHallFinish() ? [-17.30] : [-14, -6.4, 0.2, 8].filter((_, i) => !quality.mobile || i % 2 === 0);
  const hallLampItems = [];
  hallLampZs.forEach(lz => { for (let x = rowX0 - 3; x <= leafX + 3; x += quality.mobile ? 8 : 4) hallLampItems.push({ p: [x, hasHallFinish()?6.9:6.2, lz], w: 1.3, d: 0.5 }); });
  if(hasHallFinish())scene.add(hallFinishInstances('LUMINAIRE',hallLampItems.map(it=>mtx(...it.p))));
  else scene.add(lamps(hallLampItems, { color: '#dce8ff', k: 1.25, halo: 1.1, haloOpacity: 0.10 }));

  // The ceiling is cut away: only its rear fixture strip remains drawn. Actual
  // area lights aggregate those fixtures' broad contribution; emissive materials
  // alone do not illuminate equipment in Three.js. This is presentation lighting,
  // not a lux calculation or an asserted installed fixture inventory.
  if(hasHallFinish()) {
    RectAreaLightUniformsLib.init();
    const hallLight=new THREE.RectAreaLight(0xdcecff,3.2,31,.3);
    hallLight.name='Data hall rear fixture contribution';hallLight.position.set(5,6.85,-17.15);hallLight.lookAt(5,0,1);scene.add(hallLight);
    const roomLight=new THREE.RectAreaLight(0xffdfb8,3.5,20,.3);
    roomLight.name='Power room rear fixture contribution';roomLight.position.set(-25,6.85,-17.15);roomLight.lookAt(-25,0,-2);scene.add(roomLight);
    scene.userData.hallCutaway={roofRemoved:true,fixturesRetainedAtRear:true,actualAreaLights:2,engineeringServicesRetained:true};
  }

  // Slim retained ceiling rails make the cutaway feel like an occupied modern
  // hall. Physical housings/supports reuse authored Blender construction modules;
  // actual broad lights supply illumination rather than relying on bloom alone.
  const railBody=new THREE.MeshStandardMaterial({color:0x253440,roughness:.3,metalness:.72});
  const railTrim=new THREE.MeshStandardMaterial({color:0x8095a3,roughness:.26,metalness:.75});
  const diffuser=new THREE.MeshStandardMaterial({color:0xe5f1ff,emissive:0xbad7ff,emissiveIntensity:1.2,roughness:.36,metalness:.02});
  const lightsBuilder=new Builder(),supportBuilder=new Builder();
  const frameX=[-10.1,22.3],frameZ=[-18.12,7.6],frameY=7.15,railY=6.55;
  const lightZs=[-6.4,.2],railStart=rowX0,railEnd=rowX1,railWidth=.22;
  for(const x of frameX){
    supportBuilder.box(.1,.18,frameZ[1]-frameZ[0],railBody,x,frameY,(frameZ[0]+frameZ[1])/2);
    supportBuilder.box(.14,frameY,.14,railBody,x,frameY/2,frameZ[1]);
    supportBuilder.box(.32,.035,.32,railTrim,x,.17,frameZ[1]);
    // Wall anchor at the back is fixed to the retained building structure.
    supportBuilder.box(.3,.32,.12,railTrim,x,frameY,-18.02);
  }
  supportBuilder.box(frameX[1]-frameX[0],.18,.1,railBody,(frameX[0]+frameX[1])/2,frameY,frameZ[1]);
  lightZs.forEach((z,ri)=>{
    supportBuilder.box(frameX[1]-frameX[0],.12,.07,railBody,(frameX[0]+frameX[1])/2,frameY,z);
    for(let x=railStart+.3;x<railEnd;x+=3.6){
      const len=Math.min(3.25,railEnd-x),cx=x+len/2;
      lightsBuilder.box(len,.11,railWidth,railBody,cx,railY,z);
      lightsBuilder.box(len-.07,.018,railWidth-.035,diffuser,cx,railY-.061,z);
      // Small side reveal stays visible from the elevated overview; no giant halo.
      for(const dz of [-railWidth/2-.003,railWidth/2+.003]){
        lightsBuilder.box(len-.1,.04,.009,diffuser,cx,railY-.005,z+dz);
        lightsBuilder.box(len-.1,.007,.025,diffuser,cx,railY+.057,z+dz*.88); // narrow wrapped opal rim, dark center housing
      }
      for(const dx of [-len*.36,len*.36])supportBuilder.strut([cx+dx,frameY-.06,z],[cx+dx,railY+.055,z],.009,MAT.darkSteel,6);
    }
    // A lighting-only feed follows its supporting crossbeam, then drops into
    // the rail end. It is not tied to the data or IT busway networks.
    supportBuilder.strut([frameX[0],frameY+.11,z],[railStart+.3,frameY+.11,z],.018,MAT.black,6);
    supportBuilder.strut([railStart+.3,frameY+.11,z],[railStart+.3,railY+.055,z],.018,MAT.black,6);
    supportBuilder.box(railEnd-railStart,.025,.035,MAT.black,(railStart+railEnd)/2,railY+.07,z);
    RectAreaLightUniformsLib.init();
    const light=new THREE.RectAreaLight(0xcfe4ff,2.2,railEnd-railStart,.14);
    light.name=`Aisle light rail ${ri+1}`;light.position.set((railStart+railEnd)/2,railY-.075,z);light.lookAt((railStart+railEnd)/2,0,z);scene.add(light);
  });
  // Feed descends the retained wall into a dedicated building-lighting box.
  supportBuilder.box(.35,.55,.14,MAT.darkSteel,frameX[0],2,-17.9);
  supportBuilder.strut([frameX[0],2.25,-17.9],[frameX[0],frameY+.11,-17.9],.018,MAT.black,6);
  supportBuilder.strut([frameX[0],frameY+.11,-17.9],[frameX[0],frameY+.11,lightZs.at(-1)],.018,MAT.black,6);
  const overhead=new THREE.Group();overhead.name='Hall overhead light rails';
  overhead.add(lightsBuilder.build({cast:true,receive:true}),supportBuilder.build({cast:true,receive:true}));scene.add(overhead);
  scene.userData.hallCutaway={roofRemoved:true,fixturesRetainedAtRear:true,slimAisleRails:lightZs.length,actualAreaLights:hasHallFinish()?4:2,engineeringServicesRetained:true};

  // sprinkler branch lines with pendant heads, over the aisles
  const sprinklerMx = [];
  [-9, -2.4, 4.2].forEach(sz => {
    N.cylX(0.035, rowX1 - rowX0 + 2, MAT.galv, (rowX0 + rowX1) / 2, 6.7, sz, 8);
    for (let x = rowX0 - 1; x <= rowX1 + 1; x += 3) { N.cyl(0.018, 0.12, MAT.darkSteel, x, 6.6, sz, 6); if (hasHallFinish()) sprinklerMx.push(mtx(x, 6.54, sz)); else N.cyl(0.05, 0.02, MAT.orange, x, 6.53, sz, 8); }
  });

  // air-sampling smoke detection: a wall box on the partition, well clear of the doorway opening so it
  // reads against a solid wall face; a thin red sampling pipe along the ceiling with a few tiny sampling
  // points, offset from the -9 sprinkler main so the two never share a plane
  const asdX = -11.78, asdY = 2.3, asdZ = -9, asdPipeY = 6.6, asdPipeZ = -9.15;
  if (hasHallFinish()) scene.add(hallFinishInstances('HALL_ASD', [mtx(asdX - .07, asdY, asdZ, Math.PI / 2)]), hallFinishInstances('SPRINKLER', sprinklerMx));
  else {
    N.box(0.14, 0.46, 0.36, MAT.white, asdX, asdY, asdZ);
    N.box(0.03, 0.08, 0.1, glowMat('#ff5a5a', 1.4), asdX + 0.085, asdY + 0.12, asdZ);
  }
  N.strut([asdX, asdY + 0.23, asdZ], [asdX, asdPipeY, asdZ], 0.022, MAT.pipeRed, 8);
  N.strut([asdX, asdPipeY, asdZ], [asdX, asdPipeY, asdPipeZ], 0.022, MAT.pipeRed, 8);
  N.strut([asdX, asdPipeY, asdPipeZ], [-2, asdPipeY, asdPipeZ], 0.022, MAT.pipeRed, 8);
  [-9, -5.5, -2].forEach(x => { N.cyl(0.016, 0.05, MAT.darkSteel, x, asdPipeY - 0.04, asdPipeZ, 6); N.cyl(0.04, 0.014, glowMat('#ff5a5a', 1.1), x, asdPipeY - 0.09, asdPipeZ, 8); });

  // cool LED strips along every rack top (a thin glowing line, distinct from the canvas texture's static dots)
  const ledStrip = glowMat('#8fe4ff', 1.6, 1);
  rowZs.forEach(z => N.box(rowX1 - rowX0, 0.012, 0.05, ledStrip, (rowX0 + rowX1) / 2, 2.312, z));
  N.box(4 * RW, 0.012, 0.05, ledStrip, storageX0 + 2 * RW, 2.312, svcZ);
  N.box(2 * RW, 0.012, 0.05, ledStrip, controlX0 + RW, 2.312, svcZ);

  // rack-front status LEDs, blinking at their own rate; modest count, fewer on phones
  const perRackLed = quality.mobile ? 1 : 3;
  const ledItems = [];
  rackMx.forEach((k, i) => {
    if (quality.mobile && i % 2) return;
    for (let j = 0; j < perRackLed; j++) ledItems.push({
      p: [k.x + (j - (perRackLed - 1) / 2) * 0.1, 0.3 + ((i * 7 + j * 5) % 15) / 15 * 1.6, k.z + k.f * 0.61],
      color: (i * 3 + j) % 11 === 0 ? '#ff5a5a' : '#5cf29a',
      rate: 0.25 + ((i * 13 + j * 5) % 10) / 10 * 1.3, duty: 0.5,
    });
  });
  const rackLeds = blinkers(ledItems, { size: 0.022, k: 3 });
  scene.add(rackLeds.mesh);

  // people walking the aisles (in addition to the standing figures below)
  const walkers = quality.mobile
    ? [[[rowX0 - 1, 0, -6.4], [rowX1 + 1, 0, -6.4], [rowX0 - 1, 0, -6.4]]]
    : [[[rowX0 - 1, 0, -6.4], [rowX1 + 1, 0, -6.4], [rowX0 - 1, 0, -6.4]], [[rowX1 + 1, 0, 0.2], [rowX0 - 1, 0, 0.2], [rowX1 + 1, 0, 0.2]]];
  const strollers = movers(b => hasCampusCatalog()?campusCatalogBuilder('WALKER',b):person(b, 0, 0, 0), walkers, { speed: 1.1 });
  scene.add(strollers.group);

  // faint warm air rising in the hot aisles: purely atmospheric, additive and subtle
  const plumeEmitters = [];
  for (let p = 0; p < 3; p++) {
    const za = rowZs[p * 2], zb = rowZs[p * 2 + 1], zc = (za + zb) / 2;
    for (const dz of quality.mobile ? [0] : [-2.5, 2.5]) plumeEmitters.push({ p: [(rowX0 + rowX1) / 2, 2.0, zc + dz], dir: [0, 1, 0] });
  }
  // the hot-aisle haze is part of the air path: it fades with the air share on the same log rule (src/heat.js)
  const hotPlumes = plumes(plumeEmitters, { perEmitter: quality.mobile ? 8 : 16, size: 0.5, grow: 2.4, life: 5, rise: 0.35, drift: [0.15, 0, 0], spread: 0.5, color: '#ffb37a', opacity: heatIntensity(0.16, airW, Math.max(airW, waterW)), additive: true });
  scene.add(hotPlumes.points);

  // polished-concrete floor tile joints
  const tileTex = canvasTex(64, 64, (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(8,10,12,0.4)'; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, h - 2); }, { repeat: [Math.round((X1 - X0) / 0.6), Math.round((Z1 - Z0) / 0.6)] });
  const tiles = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, Z1 - Z0), new THREE.MeshBasicMaterial({ map: tileTex, transparent: true, depthWrite: false, opacity: 0.9 }));
  tiles.rotation.x = -Math.PI / 2; tiles.position.set((X0 + X1) / 2, 0.17, 0); scene.add(tiles);

  // polished-concrete floor reflection, a hair above the slab, desktop only
  if (quality.reflections) scene.add(floorMirror(X1 - X0 - 1, Z1 - Z0 - 1, { x: (X0 + X1) / 2, y: 0.155, z: 0, res: 0.85, strength: 0.16, blur: 0.56, tint: '#9aaaba' }));

  // light fixtures over the aisles: standing figures for scale
  // Standing scale figures use the same muted technician as the walkers (campus WALKER asset), so the
  // level shows one human style instead of a lime block figure beside the most detailed cabinets.
  const standing = [[-27, -12.5, 0.3], [-29.5, 3.6, 2.4], [rowX0 + 6, -6.4, 0.4], [rowX0 + 14, 0.2, 2.6], [rowX0 + 3.5, 8.6, -0.6]];
  if (hasCampusCatalog()) scene.add(campusCatalogBuilder('WALKER').instance(standing.map(([x, z, ry]) => mtx(x, 0, z, ry))));
  else { const vest = new THREE.MeshStandardMaterial({ color: 0x6f7a4a, roughness: .85 }); standing.forEach(([x, z, ry]) => person(N, x, z, ry, 0, vest)); }

  scene.add(S.build({ cast: true, receive: true }));
  scene.add(N.build({ cast: false, receive: true }));
  // Lid print on every switch-side module: the class the scenario's fabric uses (lid-labels.js), etched dark on
  // the nickel lid, small enough to fade into the lid tone at overview distance.
  printDecals(scene, { texture: textTexture(labelLines(switchLabel(model.accel)), { px: 72, aspect: 2, ink: '#474d55', pad: 0.05 }),
    size: [.019, .0095], placements: lidLabels, lift: .00008, name: 'Switch module lid labels', material: { roughness: .7, metalness: .25 } });
  if (mmLidLabels.length) printDecals(scene, { texture: textTexture(labelLines('OSFP 800G 2xSR4'), { px: 72, aspect: 2, ink: '#474d55', pad: 0.05 }),
    size: [.019, .0095], placements: mmLidLabels, lift: .00008, name: 'Switch module lid labels, multimode', material: { roughness: .7, metalness: .25 } });   // NVIDIA MMA4Z00-NS: 800G twin-port OSFP, 2xSR4
  for (const [form, placements] of facePrints) printDecals(scene, { texture: faceTexture(form), size: [.438, SWITCH_FORMS[form].h - .002],
    placements, lift: .0002, name: `Switch face print ${form}`, material: { roughness: .6 } });
  // Rack labels and the hall's name over the back-wall pipework (site-signs.js).
  hallIds(scene, { rackMx, rowZs, rowX0, wall: { p: [-4, 6.98, Z0 + .03] } });
  if (!air) cduPlates(scene, { cduMx });
  // Nameplates, voltage stencils and hazard signs on the power gear (electrical-marks.js).
  hallMarks(scene, model, { usX, usZ, swgr: { x0: -33.5, w: .9, n: 14, zFront: -15.6 + .75 },
    busways: [{ from: -22.55, to: -12.25, y: 5.6, z: -6.5, depth: .6 },
      ...rowZs.flatMap((z, r) => [busZOf(r), busZBOf(r)].map(bz => ({ from: rowX0 - 5, to: rowX1, y: 3.5, z: bz, depth: .18 })))] });
  flows.forEach(f => scene.add(f.group));
  dataFlows.forEach(f => scene.add(f.group));
  heatFlows.forEach(f => scene.add(f.group));
  const leds = blinkers(portLedItems, { size: 0.006 });
  scene.add(leds.mesh);

  finalizeSiteGeometry(scene);
  uprightFaceUVs(scene);
  // CDU close-up: the first unit of the front row, whose front faces the open service aisle, seen from
  // below the light rails so no diffuser sits in the line of sight (the back-row unit faced the wall).
  const cduHero = cduMx[(rowZs.length - 1) * groups];
  const cduSpot = { pos: [cduHero.x, 2.75, cduHero.z], view: { pos: [cduHero.x - 3.4, 3.1, cduHero.z + 4.6], target: [cduHero.x + .2, 1.35, cduHero.z] } };
  // The switch faces are true size: a lid label is 19 x 9.5 mm and a cage number 3.2 mm tall. These two part views
  // stand close (about 0.35 m on a desktop, 0.26 m on a phone, whose view is narrower), looking down ~38 degrees so
  // both the printed lids and the numbers on the face above each cage read; the stage lets the orbit come this close
  // only while one of them is selected (`close`). The pins sit on the top chassis edge, inside these frames.
  const leafTop = 1.52 + (bigSwitch ? SWITCH_FORMS.q3400.h : 2 * SWITCH_FORMS.qm9700.h + .0009), leafMid = (1.52 + leafTop) / 2;
  const faceView = (x, faceZ, d, side = 0) => ({ pos: [x + side, leafMid + d * .62, faceZ + d * .78], target: [x, leafMid, faceZ + .02] });
  const closeSpot = (x, faceZ, dDesk, dPhone, side) => ({
    pos: [x, leafTop + .012, faceZ + .02],
    view: { ...faceView(x, faceZ, dDesk, side), close: true, portrait: faceView(x, faceZ, dPhone, side * dPhone / dDesk) },
  });
  const leafSpot = closeSpot(leafX - .05, rowZs[3] + facing[3] * .6, .36, .26, -.08);      // row 4's leaf switches
  const opticsSpot = closeSpot(leafX + .07, rowZs[1] + facing[1] * .6, .38, .28, -.04);      // row 2's, with the multimode modules and splitters

  // The power layer's glow (src/power-glow.js), on the floor around each footprint: every rack by its draw; each UPS
  // module or solid-state transformer and the unit substation by its share of the ledger's loss; the switchgear
  // sections, CDU pumps and fans by PART_W.facility; every spine and leaf rack by its switches and their modules. The
  // battery cabinets store energy and the busway carries it, so neither glows.
  const PD = [], FAC = PART_W.facility, F_ = FABRICS[model.accel.nicPortGbps], switchW = F_.switchKW * 1000 + F_.radix * F_.portModuleW;
  const lay = model.layout, onFloor = 0.158;                 // the floor slab's top is at 0.15
  rackMx.forEach((it, i) => PD.push({ id: `rack-${i}`, part: 'racks', watts: model.rack.kw * 1000, at: [it.x, onFloor, it.z], size: [RW - 0.02, 1.2] }));
  const conv = dc ? ['sst', ledgerW(model, 2, 'sst') / Math.max(1, lay.sstModules)] : ['ups', ledgerW(model, 2, 'ups') / Math.max(1, lay.upsModules)];
  for (const x0 of [-33.5, -29.6, -25.7]) for (let i = 0; i < 3; i++) PD.push({ id: `${conv[0]}-${x0}-${i}`, part: conv[0], watts: conv[1], at: [x0 + (i + 0.5) * 1.1, onFloor, -6.5], size: [1.1, 1.0] });
  for (let i = 0; i < 14; i++) PD.push({ id: `swgr-${i}`, part: 'swgr', watts: FAC.switchgear * model.IT_MW * 1e6 / lay.halls / 14, at: [-33.5 + (i + 0.5) * 0.9, onFloor, -15.6], size: [0.9, 1.5] });
  PD.push({ id: 'unitsub', part: 'unitsub', watts: ledgerW(model, 2, 'unitsub') / Math.max(1, lay.unitSubs), at: [usX, 0.305, usZ], size: [2.6, 3.8] });
  const perUnit = rackMx.length * model.rack.kw * 1000 / Math.max(1, cduMx.length);
  cduMx.forEach((c, i) => PD.push({ id: `${air ? 'inrow' : 'cdu'}-${i}`, part: air ? 'inrow' : 'cdu', watts: perUnit * (air ? FAC.fans : FAC.cduPump * model.accel.liquidShare), at: [c.x, onFloor, c.z], size: [CW - 0.02, 1.2] }));
  wallFans.forEach((f, i) => PD.push({ id: `fanwall-${i}`, part: 'fanwall', watts: FAC.fans * airW / wallFans.length, at: [X1 - 1.62, f.p[1], f.p[2]], size: [1.3, 1.3], normal: [-1, 0, 0], fill: 0.04 }));
  netItems.forEach((it, i) => PD.push({ id: i === CPO_I ? 'cpo-switch' : `spine-${i}`, part: i === CPO_I ? 'cpo' : 'network', watts: i === CPO_I ? 3950 /* NVIDIA's Q3450 figure, the CPO card's */ : (bigSwitch ? 2 : 4) * switchW, at: [it.x, onFloor, it.z], size: [0.6, 1.2] }));
  rowZs.forEach((z, r) => PD.push({ id: `leaf-${r}`, part: 'network', watts: (bigSwitch ? 1 : 2) * switchW, at: [leafX, onFloor, z], size: [0.6, 1.2] }));

  const built = {
    scene, flows, powerDraw: PD,
    // Desktop overview sits ~15% closer than before so the hall fills the frame. Every variant below keeps
    // its original pos-minus-target offset (so the opening frame is unchanged) but orbits around the hall's
    // actual bounding-box centre (measured with tools/orbit-center.mjs: [-5.6, 3.94, 0], mesh union excluding
    // the studio surround, rack-label sprites and the exact-route flow ribbons) instead of a hand-placed
    // point. The hall's own footprint still keeps the risers' pin clear of the orbit-hint line in practice.
    camera: { pos: [36.4, 28.44, 41], target: [-5.6, 3.94, 0],
      compact: { pos: [44.4, 33.44, 49], target: [-5.6, 3.94, 0] },
      // Portrait looks steeply down the hall's diagonal so the 60 m hall fills the tall frame and the
      // power-room pins (1-4) separate from the data-hall ones instead of stacking in one cluster.
      portrait: { pos: [44.4, 84.44, 37.5], target: [-5.6, 3.94, 0] },
      near: 0.1, far: 2000, min: 0.6, max: 180 },
    // Phones, data layer: its 13 pins all sit in the data hall, eight of them within ~12 m of the front service
    // aisle, and the shared portrait view (which must also reach the power room) stacked them in one diagonal
    // clump. Looking steeply from the front wall lays the rows across the screen so each pin gets its own spot.
    // Phones only: with cameraByMode set, a layer switch re-opens that layer's overview, which desktop keeps as is.
    ...(quality.mobile ? { cameraByMode: { data: { portrait: { pos: [-5.6, 60.94, 33], target: [-5.6, 3.94, 0] } } } } : {}),
    hotspots: {
      optics: opticsSpot,
      cpo: cpoSpot,
      unitsub: { pos: [usX, 3.3, usZ], view: { pos: [usX - 6.6, 5.0, usZ + 6.4], target: [usX + 1.2, 1.3, usZ] } },
      swgr: { pos: [-27, 2.8, -15.6], view: { pos: [-25, 6, -4], target: [-27, 1.3, -15.6] } },
      [dc ? 'sst' : 'ups']: { pos: [-28, 2.8, -6.5], view: { pos: [-27, 5, 2.5], target: [-28, 1, -6.5] } },
      batt: { pos: [-30, 2.4, 3.5], view: { pos: [-22, 5, 10], target: [-30, 1, 3.5] } },
      busway: { pos: [0, 3.9, -8.0], view: { pos: [-6, 7, 8], target: [2, 3.2, -8] } },
      racks: { pos: [front[18].x, 2.6, rowZs[5]], view: { pos: [front[18].x + 1.6, 3.5, 12], target: [front[18].x, 1.25, rowZs[5]] } },
      containment: { pos: [rowX0 + 2.5, 1.7, -9.7], view: { pos: [rowX0 - 4.4, 2.5, -7.2], target: [rowX0 + 2.5, 1.3, -9.7] } },   // through the pod's end doors, down the contained aisle
      [air ? 'inrow' : 'cdu']: cduSpot,
      fwater: { pos: [4, 6.8, -16.4], view: { pos: [2, 7, -6], target: [4, 5.8, -16.4] } },
      fanwall: { pos: [X1 - 1.2, 6.4, -3], view: { pos: [10, 6, 10], target: [X1 - 1, 3, -3] } },
      network: { pos: [rowX0 + 5, 2.7, 10.5], view: { pos: [rowX0 + 5, 5, 18], target: [rowX0 + 5, 1.2, 10.5] } },
    },
    dataFlows, heatFlows, layers: { data: par },
    heatHotspots: {
      cpo: cpoSpot,
      [air ? 'inrow' : 'cdu']: cduSpot,
      fwater: { pos: [4, 6.8, -16.4], view: { pos: [2, 7, -6], target: [4, 5.8, -16.4] } },
      // Heat keeps the long one-point view down the contained aisle toward the fan wall, over the end doors, so the
      // hot air is seen running the aisle's length; the power layer's containment view stays head-on to the doors.
      hotaisle: { pos: [rowX0 + 6.2, 1.7, -9.7], view: { pos: [rowX0 - 3, 3.6, -9.45], target: [rowX0 + 11.2, 1.3, -9.7] } },
      fanwall: { pos: [X1 - 1.2, 6.4, -3], view: { pos: [10, 6, 10], target: [X1 - 1, 3, -3] } },
      riser: { pos: [X0 + 2.4, 8.5, -15.6], view: { pos: [X0 + 10, 10, -4], target: [X0 + 2.4, 5, -16.4] } },
      fire: { pos: [asdX, 2.9, asdZ], view: { pos: [-7.5, 2.2, -5.2], target: [-10.8, 3.4, -9] } },   // the detector box and its sampling pipe rising to the ceiling
    },
    dataHotspots: {
      // Looking down onto the drive shelves from just above head height: every other pin in the hall sits
      // farther back at ~2.6 m, so from above it projects off the top of the frame instead of stacking over
      // the storage racks (from eye level they all landed on the shelf tops, 'NVL72 racks' among them).
      storage: { pos: [storageMx[1].x, 2.0, svcZ + .6], view: { pos: [(storageMx[0].x + storLast.x) / 2 - .9, 3.5, svcZ + 5.1], target: [(storageMx[0].x + storLast.x) / 2 - .2, 1.1, svcZ + .6] } },
      control: { pos: [(controlMx[0].x + controlMx[1].x) / 2, 2.6, svcZ], view: { pos: [(controlMx[0].x + controlMx[1].x) / 2, 5, 19], target: [(controlMx[0].x + controlMx[1].x) / 2, 1.3, svcZ] } },
      odf: { pos: [rowX0 + 4.4, 2.5, 14.5], view: { pos: [rowX0 + 11, 5.2, 23], target: [rowX0 + 5, 1.6, 12.5] } },
      crosshall: { pos: [rowX0 + 9.4, 1.2, 14.2], view: { pos: [rowX0 + 12, 3.2, 18.5], target: [rowX0 + 9.4, 1.2, 14.2] }, drill: 1 },
      pp: { pos: [front[0].x - 0.3, 2.6, rowZs[5]], view: { pos: [front[4].x, 7.5, rowZs[5] + 7.5], target: [front[4].x, 2.3, rowZs[5] - 1.5] } },
      dp: { pos: [front[6].x, 2.6, rowZs[5]], view: { pos: [front[10].x, 9, rowZs[5] + 10], target: [front[12].x, 2, rowZs[3]] } },
      uplinks: { pos: [rackMx.filter(k => k.z === -4.6)[10].x, 3.4, -4.6], view: { pos: [-1.2, 2.9, -7.0], target: [4.5, 3.2, -4.9] } },
      leaf: leafSpot,
      spine: { pos: [rowX0 + 4, 2.7, 10.5], view: { pos: [rowX0 + 5, 5, 18], target: [rowX0 + 5, 1.2, 10.5] } },
      runways: { pos: [rowX1 + 0.45, 4.7, 4], view: { pos: [rowX1 - 6, 8, 12], target: [rowX1, 4, 2] } },
      optics: opticsSpot,
      cpo: cpoSpot,
      racks: { pos: [front[18].x, 2.6, rowZs[5]], view: { pos: [front[18].x + 1.6, 3.5, 12], target: [front[18].x, 1.25, rowZs[5]] } },
    },
    // bloom stays a small bump over the family default (0.5) for mood; threshold stays near the family
    // default (1.0) rather than dropping, so ceiling fixtures and the shared dataFlow/heatFlow markers
    // don't clip into blown discs at close range (see fx.lamps' own k/halo tuning above for the fixtures)
    look: { exposure: 1.0, bloom: 0.4, threshold: 1.15, ao: 0.42, env: 'indoor', envIntensity: 0.75, dof: true },
    update(t) { fans.update(t); rackLeds.update(t); strollers.update(t); hotPlumes.update(t); leds.update(t); },
  };
  // More activity through the existing distribution network, without adding
  // connections or increasing the ceiling fixtures' bloom.
  for (const list of [flows, dataFlows, heatFlows]) for (const f of list) {
    f.setMotionStyle({ density: 1.5, brightness: 1.25, radius: 1,
      pixels: quality.mobile ? 1 : 1.2, stretch: 2.2 });
  }
  attachFlowRibbons(built, { width: 2.2, glow: 4.4, brightness: 2.65, mobile: quality.mobile, layers: { dataFlows: { haloOpacity: .20 } } });
  return built;
}
