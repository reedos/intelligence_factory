import { RACK_RUNWAY, ROW_RUNWAY } from './fiber-routing.js';
// Scene 3: one rack. Units are meters. Front faces +z, open side faces +x.
// NVL72 class (GB200, GB300, Rubin), or four air-cooled DGX H100 servers.
import { THREE, MAT, Builder, mtx, flow, canvasTex, glowMat, spinners } from '../kit.js';
import { rbox, bundle, blinkers, plumes, floorMirror } from '../fx.js';
import { computeMaterials, finishCompute } from './compute-finish.js';
import { frameCompute } from './compute-framing.js';
import { addRackOptics } from './rack-optics.js';
import { addRackMgmt } from './rack-mgmt.js';
import { etch } from './package-marks.js';
import { rackUnits } from './site-signs.js';
import { RACK, BASE as RACK_BASE, LAYOUT as NVL_LAYOUT, trayY as nvlTrayY, ROWS as NVL_ROWS, PULLED as NVL_PULLED, SWITCH_PULLED as NVL_SWITCH_PULLED } from './nvl72-layout.js';
import { componentView } from '../app/housing-frame.js';
import { DGX, DGX_RACK, dgxServerY } from './dgx-h100-layout.js';
// The pulled compute tray's cold plates and fans come from the same layout tray.js and tray-rubin.js build the
// tray level from, in tray units (10 cm) converted to the rack's meters below (TRAY_UNIT), so the rack's LOD
// tray cannot silently drift from the authoritative one (tests/rack-tray-match.test.ts checks this stays wired).
import { pcbLayout } from './tray-pcb.js';
import { NVL_BOARD_X, NVL_CPU, NVL_GPU_Z, NVL_GPU_SIZE, NVL_FAN_X, NVL_FAN_Z, NVL_FRONT, NVL_REAR } from './tray.js';
import { RUBIN_COLD_PLATES, RUBIN_FRONT, RUBIN_REAR } from './tray-rubin.js';
import { OSFP_U } from './osfp-size.js';
const TRAY_UNIT = 0.1;
export const NVL_COLD_PLATES = NVL_BOARD_X.flatMap(bx => [
  { x: bx, z: NVL_CPU.z, w: NVL_CPU.size, d: NVL_CPU.size, kind: 'cpu' },
  { x: bx, z: NVL_GPU_Z[0], w: NVL_GPU_SIZE, d: NVL_GPU_SIZE, kind: 'gpu' },
  { x: bx, z: NVL_GPU_Z[1], w: NVL_GPU_SIZE, d: NVL_GPU_SIZE, kind: 'gpu' },
]);
import { tagHeat, balanceHeat, heatIntensity, PART_W } from '../heat.js';

const U = 0.04445;
// product-shot trim: the champagne bezel band from the server texture, in real geometry; and quick-disconnect collars
const TRIM = new THREE.MeshStandardMaterial({ color: 0xb39a6a, roughness: 0.42, metalness: 0.6 });
const COLLAR = new THREE.MeshStandardMaterial({ color: 0xc7ccd2, roughness: 0.42, metalness: 0.55 });
const AIR_HAZE = '#ff8a4a';                                    // matches the 'air' heat flow color: hot exhaust, decorative only

// Management switch face: 48 RJ45 ports of 1GbE and 4 QSFP28 ports of 100GbE,
// the SN2201's published port count (NVIDIA SN2201 specifications). Port
// grouping, console/management jacks and link LEDs are drawn as representative.
function mgmtFace(g, w, h) {
  const sx = w / 1024, sy = h / 96, r = rng(5);
  g.fillStyle = '#2f353d'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#1a1e23'; g.fillRect(0, 0, w, 4 * sy); g.fillRect(0, h - 4 * sy, w, 4 * sy);
  // console and out-of-band jacks, USB
  for (const x of [34, 62]) { g.fillStyle = '#07080a'; g.fillRect(x * sx, 30 * sy, 22 * sx, 20 * sy); g.fillStyle = '#50565e'; g.fillRect((x + 6) * sx, 30 * sy, 10 * sx, 4 * sy); }
  g.fillStyle = '#07080a'; g.fillRect(92 * sx, 34 * sy, 14 * sx, 8 * sy);
  // four blocks of twelve RJ45 (six wide, two high), link LEDs above/below
  for (let b = 0; b < 4; b++) for (let c = 0; c < 6; c++) for (let row = 0; row < 2; row++) {
    const x = (140 + b * 170 + c * 26) * sx, y = (row ? 52 : 18) * sy;
    g.fillStyle = '#5a6068'; g.fillRect(x - 1 * sx, y - 1 * sy, 24 * sx, 24 * sy);
    g.fillStyle = '#060708'; g.fillRect(x, y, 22 * sx, 22 * sy);
    g.fillStyle = '#23272c'; g.fillRect(x + 7 * sx, y + (row ? 16 : 0) * sy, 8 * sx, 6 * sy);
    const lit = r() < 0.7;
    g.fillStyle = lit ? '#5cf29a' : '#1b2a21'; g.fillRect(x + 2 * sx, y + (row ? 23 : -5) * sy, 4 * sx, 3 * sy);
    g.fillStyle = lit && r() < 0.4 ? '#f2b84a' : '#2a2416'; g.fillRect(x + 16 * sx, y + (row ? 23 : -5) * sy, 4 * sx, 3 * sy);
  }
  // four QSFP28 cages, 2 x 2
  for (let c = 0; c < 2; c++) for (let row = 0; row < 2; row++) {
    const x = (842 + c * 62) * sx, y = (row ? 52 : 16) * sy;
    g.fillStyle = '#8a9098'; g.fillRect(x - 2 * sx, y - 2 * sy, 54 * sx, 28 * sy);
    g.fillStyle = '#07080a'; g.fillRect(x, y, 50 * sx, 24 * sy);
  }
  g.fillStyle = '#5cf29a'; g.fillRect(990 * sx, 20 * sy, 6 * sx, 5 * sy);                 // system status
  g.fillStyle = '#d7dbe0'; g.fillRect(990 * sx, 60 * sy, 22 * sx, 10 * sy);              // label pull-tab
}

// 1U tray faces at 0.43 mm per texel (1024 x 96 over 0.44 m). Sourced content
// only: four E1.S sleds per compute tray (NVIDIA DGX GB hardware guide) where the tray level draws them (tray.js
// NVL_FRONT.drives, at the tray's own x; Vera Rubin's tray has none, so none are painted), six supplies per power shelf
// (Flex/LITEON shelf pages). The network cages are real geometry drawn by rack-optics.js, so none are painted here.
// Vent perforation, labels, latches and light pipes are representative (ASSUMPTIONS 'nvl72-tray-faces'); Rubin uses the
// same graphite finish.
function perforate(g, x0, y0, x1, y1, step, rad, color = '#0a0c0f') {
  g.fillStyle = color;
  for (let y = y0, row = 0; y < y1; y += step * 0.87, row++) for (let x = x0 + (row % 2) * step / 2; x < x1; x += step) { g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill(); }
}
function labelStrip(g, x, y, w, h, seed) {
  const r = rng(seed);
  g.fillStyle = '#c9ced3'; g.fillRect(x, y, w, h);
  g.fillStyle = '#1b1e22'; for (let bx = x + 3; bx < x + w - 3; bx += 1 + Math.floor(r() * 3)) if (r() < 0.55) g.fillRect(bx, y + 3, 1, h - 6);
}
function trayTex(kind, generation) {
  return canvasTex(1024, 96, (g, w, h) => {
    g.fillStyle = kind === 'ps' ? '#3b424a' : '#2f363e'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#0d0e10'; g.fillRect(0, 0, w, 4); g.fillRect(0, h - 4, w, 4);
    g.fillStyle = '#4a525b'; g.fillRect(0, 4, w, 2);                                  // folded top edge catches light
    if (kind === 'compute') {
      const rubin = generation === 'rubin', F = rubin ? RUBIN_FRONT : NVL_FRONT[generation] || NVL_FRONT.gb200;
      const px = u => (u + 2.2) / 4.4 * w;                                   // tray units across the 4.4-unit face -> texels
      const cageHalf = OSFP_U.cageW / 2;
      // vent fields in the stretches of face between the cages, the DPUs' storage cages and the drive bay (all real geometry)
      const vents = rubin
        ? [[16, px(F.cageX[0] - cageHalf) - 8], [px(F.cageX[0] + cageHalf) + 8, px(F.serviceIo.x[0] - F.serviceIo.w) - 8],
           [px(F.serviceIo.x[3] + F.serviceIo.w) + 8, px(F.cageX[2] - cageHalf) - 8], [px(F.cageX[3] + cageHalf) + 8, 1008]]
        : [[px(Math.max(...F.storageX) + 0.1) + 6, px(F.cageX[0] - cageHalf) - 6], [px(F.cageX[3] + cageHalf) + 8, 940]];
      for (const [x0, x1] of vents) if (x1 - x0 > 14) perforate(g, x0, 16, x1, 84, 9, 3);
      // four E1.S sleds at the tray level's drive positions: carrier, latch, light pipe, pull tab
      if (F.drives) for (const dx of F.drives.x) {
        const sw = Math.round(F.drives.w / 4.4 * w), x = Math.round(px(dx)) - sw / 2, sc = sw / 72;
        g.fillStyle = '#545c64'; g.fillRect(x, 10, sw, 76);
        g.fillStyle = '#1a1f24'; g.fillRect(x + 5 * sc, 16, 14 * sc, 64);
        perforate(g, x + 25 * sc, 18, x + sw - 3, 70, 5, 1.6, '#20262c');
        g.fillStyle = '#7d858d'; g.fillRect(x + 23 * sc, 74, 32 * sc, 8);
        g.fillStyle = '#5cf29a'; g.fillRect(x + 8 * sc, 20, 7 * sc, 5);
      }
      labelStrip(g, rubin ? 620 : 944, 66, 60, 18, 3);
      g.fillStyle = '#47cfff'; g.fillRect(w - 26, h / 2 - 4, 8, 8);
    } else if (kind === 'switch') {
      perforate(g, 380, 16, 900, 84, 9, 3);
      labelStrip(g, 916, 20, 80, 22, 9);
      g.fillStyle = '#5cf29a'; g.fillRect(930, 60, 8, 6); g.fillRect(948, 60, 8, 6);
    } else if (kind === 'ps') {
      for (let k = 0; k < 6; k++) {
        const x = 8 + k * 168;
        g.fillStyle = '#4a525b'; g.fillRect(x, 10, 160, 76);
        g.fillStyle = '#0d1013'; g.fillRect(x, 10, 160, 2); g.fillRect(x, 10, 2, 76);
        // fan grille: dark disc, guard rings and spokes
        const cx = x + 44, cy = 48;
        g.fillStyle = '#0b0d10'; g.beginPath(); g.arc(cx, cy, 33, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#59616a'; g.lineWidth = 2;
        for (const rr of [12, 21, 30]) { g.beginPath(); g.arc(cx, cy, rr, 0, Math.PI * 2); g.stroke(); }
        for (let a = 0; a < 4; a++) { g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a * Math.PI / 2 + 0.4) * 32, cy + Math.sin(a * Math.PI / 2 + 0.4) * 32); g.stroke(); }
        perforate(g, x + 90, 20, x + 128, 80, 7, 2.2);
        g.fillStyle = '#5cf29a'; g.fillRect(x + 136, 20, 8, 6);
        g.fillStyle = '#f2b84a'; g.fillRect(x + 136, 32, 8, 6);
      }
    } else if (kind === 'mgmt') {
      mgmtFace(g, w, h);
    } else {
      g.fillStyle = '#16181c'; g.fillRect(0, 0, w, h);
    }
  });
}

export function build(opts) {
  const result = opts.model.accel.gpusPerRack === 72 ? buildNVL(opts) : buildHGX(opts);
  finishCompute(result.scene, computeMaterials());
  addRackOptics(result, opts.model.accel.id);
  if (opts.model.accel.gpusPerRack === 72) addRackMgmt(result, opts.model.accel.id, opts.quality);   // 1 GbE management leads (rack-mgmt.js)
  // Where compute-blender prints the voltage marks once the authored hardware is in place (electrical-marks.js):
  // the busway housing's front face and, on NVL72 racks, the busbar's free span at the management slot.
  result.printMarks = { manifolds: result.manifoldTags || [], busway: { x0: -0.6 - 1.6, x1: -0.6 + 1.6, y: 3.2 - 0.035, zFront: -0.25 + 0.075 }, busbar: result.busbarTag || null };
  frameCompute(result, 'rack', opts.model.accel.id);
  return result;
}

// A product shot: a dark studio stage (see stage.js envScene('studio') for the softbox and rim strips this lights
// reflections with), our own key + rim to match, a little bloom and AO, and desktop depth of field on tour close-ups.
const LOOK = { exposure: 1.0, bloom: 0.48, threshold: 1.3, ao: 0.14, env: 'studio', envIntensity: 0.4, dof: true };

function room(scene, quality, S, N, W, H, D, { rearRail = null } = {}) {
  scene.background = new THREE.Color(0x0a0d13);
  scene.fog = new THREE.Fog(0x0a0d13, 3.4, 11.5);                                   // soft floor falloff into the dark stage
  scene.add(new THREE.HemisphereLight(0xa9bbdc, 0x15171b, 0.85));
  const key = new THREE.DirectionalLight(0xfff0dc, 2.2); key.position.set(3, 5, 4); key.target.position.set(0, 1, 0);
  if (quality.shadows) { key.castShadow = true; key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -2.5, right: 2.5, top: 3.5, bottom: -1, near: 1, far: 14 }); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.01; }
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0x8fc2ff, 1.2); rim.position.set(-3.4, 3.2, -4.2); scene.add(rim);
  const faceFill = new THREE.DirectionalLight(0xdce6ef, 0.8); faceFill.position.set(-1, 2, 6); scene.add(faceFill);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: 0x24262c, roughness: 0.5, metalness: 0.2 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  if (quality.reflections) scene.add(floorMirror(9, 9, { y: 0.0016, strength: 0.16, tint: '#9fb2cc', blur: 1.8 }));
  for (let i = -8; i <= 8; i++) { N.box(0.005, 0.004, 16, MAT.darkSteel, i * 1.2, 0.004, 0); N.box(16, 0.004, 0.005, MAT.darkSteel, 0, 0.004, i * 1.2); }
  S.slab(W, H, D, MAT.rack, -0.62, 0, 0);                                         // the neighbor rack
  const X = W / 2, ZF = D / 2, ZB = -D / 2;
  for (const x of [-X + 0.02, X - 0.02]) for (const z of [ZF - 0.03, ZB + 0.03]) S.box(0.035, H, 0.035, MAT.rack, x, H / 2, z);
  S.slab(W, 0.04, D, MAT.rack, 0, H - 0.04, 0);
  S.slab(W, 0.1, D, MAT.rack, 0, 0, 0);
  rbox(S, 0.014, H - 0.006, D - 0.006, MAT.rackFace, -X - 0.008, H / 2, 0, { r: 0.03 });   // side panel, rounded edge
  for (const x of [-0.25, 0.25]) for (const z of [-0.45, 0.45]) N.cyl(0.025, 0.04, MAT.darkSteel, x, 0.02, z, 12);
  for (const x of [-X + 0.05, X - 0.05]) N.box(0.012, H - 0.2, 0.012, MAT.galv, x, H / 2, ZF - 0.06);
  if (rearRail) for (const x of [-rearRail.x, rearRail.x]) N.box(0.008, H - 0.2, 0.012, MAT.galv, x, H / 2, rearRail.z);
  else for (const x of [-X + 0.05, X - 0.05]) N.box(0.012, H - 0.2, 0.012, MAT.galv, x, H / 2, ZB + 0.06);
  // Folded enclosure edges catch a continuous reflection down the cabinet.
  // This is mechanical trim, deliberately non-emissive so it cannot be mistaken
  // for a power or data route.
  for (const x of [-X + 0.016, X - 0.016]) {
    rbox(N, 0.009, H - 0.18, 0.012, COLLAR, x, H / 2, ZF - 0.02, { r: 0.18 });
    if (!quality.mobile) for (let u = 2; u < 46; u++) {
      N.box(0.004, 0.009, 0.001, MAT.black, x, 0.06 + u * U, ZF - 0.0135);
    }
  }
  rbox(N, W - 0.04, 0.008, D - 0.025, MAT.darkSteel, 0, H + 0.004, 0, { r: 0.28 });
  rackUnits(scene, { X, ZF, U, H });   // U numbers beside the rail holes (site-signs.js)
}

// Overhead plug-in busway and the rack's two tap-off units (the A and B feeds).
// Generic plug-in busway hardware: ribbed aluminum housing on threaded-rod
// hangers and strut, outlet covers every 0.6 m, a bolted joint pack, and steel
// tap-off boxes with breaker handles and a cord grip. Shape and dimensions are
// representative, not a named product (ASSUMPTIONS 'busway-tapoff-hardware').
// The voltage color stays on the moving flow and a thin status stripe.
const TAPBODY = new THREE.MeshStandardMaterial({ color: 0x70767d, roughness: 0.55, metalness: 0.35 }); TAPBODY.name = 'Tap-off powder-coated steel';
const BUSWAY = new THREE.MeshStandardMaterial({ color: 0x9aa2aa, roughness: 0.4, metalness: 0.75 }); BUSWAY.name = 'Busway extruded aluminum';
const GLAND = new THREE.MeshStandardMaterial({ color: 0x1b1d21, roughness: 0.7, metalness: 0.05 }); GLAND.name = 'Cord grip and grommet';
function labelTex(text) {
  return canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#e6e2d6'; g.fillRect(0, 0, w, h); g.fillStyle = '#111317'; g.fillRect(3, 3, w - 6, h - 6);
    g.fillStyle = '#e6e2d6'; g.font = 'bold 44px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 2);
  });
}
const TAP = { y: 2.98, glandY: 2.83 };
function busway(scene, S, N, xs, stripeColor, H, { bz = -0.25, labels = ['A', 'B'], grommets = true } = {}) {
  const bx = -0.6, by = 3.2, len = 3.2;
  S.box(len, 0.12, 0.15, BUSWAY, bx, by, bz);
  for (const s of [-1, 1]) N.box(len, 0.022, 0.001, MAT.darkSteel, bx, by + 0.012, bz + s * 0.0755);   // extrusion groove
  for (let x = bx - len / 2 + 0.3; x < bx + len / 2 - 0.1; x += 0.6) if (xs.every(t => Math.abs(t - x) > 0.14)) {
    N.box(0.1, 0.012, 0.11, MAT.darkSteel, x, by - 0.067, bz);                                             // plug-in outlet cover
    N.box(0.02, 0.006, 0.02, MAT.galv, x + 0.035, by - 0.074, bz + 0.04);
  }
  N.box(0.16, 0.15, 0.19, MAT.darkSteel, bx - 1.2, by, bz);                                                  // bolted joint pack
  for (const dx of [-0.05, 0.05]) for (const dy of [-0.045, 0.045]) N.cylZ(0.007, 0.012, MAT.galv, bx - 1.2 + dx, by + dy, bz + 0.1, 8);
  for (const x of [-0.25, 0.25, -1.45]) {                                                                   // threaded rods, strut under the housing
    N.strut([x, by - 0.075, bz], [x, 3.8, bz], 0.005, MAT.darkSteel, 6);
    N.box(0.042, 0.042, 0.26, MAT.galv, x, by - 0.082, bz);
    N.cyl(0.011, 0.012, MAT.galv, x, by - 0.108, bz, 6);
  }
  xs.forEach((x, i) => {
    const top = by - 0.066;
    N.box(0.09, 0.055, 0.1, MAT.darkSteel, x, top - 0.0285, bz);                                               // hook-and-clamp plug head
    for (const s of [-1, 1]) N.box(0.012, 0.05, 0.13, MAT.galv, x + s * 0.05, top + 0.01, bz);
    rbox(S, 0.2, 0.2, 0.15, TAPBODY, x, TAP.y, bz, { r: 0.04 });
    N.box(0.12, 0.07, 0.004, MAT.black, x - 0.01, TAP.y + 0.035, bz + 0.076);                                 // breaker window
    for (let k = 0; k < 3; k++) { N.box(0.018, 0.04, 0.004, MAT.darkSteel, x - 0.05 + k * 0.04, TAP.y + 0.035, bz + 0.079); N.box(0.012, 0.014, 0.012, MAT.white, x - 0.05 + k * 0.04, TAP.y + 0.045, bz + 0.085); }
    N.box(0.16, 0.012, 0.003, stripeColor, x, TAP.y - 0.06, bz + 0.0765);                                      // thin status stripe
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.045, 0.045), new THREE.MeshStandardMaterial({ map: labelTex(labels[i]), roughness: 0.6 }));
    label.position.set(x + 0.06, TAP.y - 0.02, bz + 0.0762); scene.add(label);
    N.cyl(0.02, 0.03, GLAND, x, TAP.y - 0.118, bz, 12);                                                      // cord grip
    N.cyl(0.014, 0.018, MAT.darkSteel, x, TAP.glandY + 0.012, bz, 10);
    if (grommets) {
      N.cyl(0.03, 0.01, GLAND, x, H + 0.018, bz, 16);                                                        // brush grommet at the rack top
      N.cyl(0.022, 0.012, MAT.black, x, H + 0.02, bz, 16);
    }
  });
}

// Rack ears, captive screws and a few patched copper leads that dress down to
// the side cable manager, so the out-of-band network reads as cabled hardware.
const CAT6 = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.6, metalness: 0.05 }); CAT6.name = 'Management patch lead';
function mgmtHardware(N, y, z, heavy, seed = 3) {
  for (const x of [-0.245, 0.245]) N.box(0.03, U * 0.9, 0.01, MAT.galv, x, y, z + 0.005);
  if (heavy) earFasteners(N, y, z + 0.0115);
  // port x positions follow mgmtFace(): 0.44 m face, 1024 px texture
  // Dressed, not draped: each lead leaves its lower-row port, turns down to a
  // harness line under the port field and runs level to the side manager.
  // Every lead has its own depth so no two runs share a surface.
  const leads = heavy ? [2, 5, 9, 16, 21] : [5, 16];
  leads.forEach((c, i) => {
    const b = Math.floor(c / 6), x = -0.22 + (140 + b * 170 + (c % 6) * 26 + 11) / 1024 * 0.44, yy = y - 0.0085;
    const zr = z + 0.026 + i * 0.006, yh = y - U * 0.36;
    N.box(0.0095, 0.0085, 0.02, CAT6, x, yy, z + 0.01);                                                      // plug boot
    const path = [[x, yy, z + 0.02], [x, yy - 0.003, zr - 0.002], [x + 0.004, yh, zr], [0.228, yh, zr], [0.25, yh + 0.004, zr + 0.004], [0.262, yh + 0.012, z + 0.032]];
    for (let k = 1; k < path.length; k++) N.strut(path[k - 1], path[k], 0.0026, CAT6, 6);
  });
}

// Unused rack units: one 1U brush-strip cable manager above the top switch,
// then individual 1U snap-in blanking panels, not one tall sheet. Panel count
// fills whatever space is left; styling is representative (ASSUMPTIONS
// 'rack-elevation-fill').
function blankTex(brush) {
  return canvasTex(1024, 96, (g, w, h) => {
    g.fillStyle = '#1b1f24'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#07080a'; g.fillRect(0, 0, w, 3); g.fillRect(0, h - 3, w, 3);
    g.fillStyle = '#2a3037'; g.fillRect(0, 3, w, 2);
    if (brush) {
      g.fillStyle = '#050607'; g.fillRect(90, 30, w - 180, 36);
      const r = rng(21); g.strokeStyle = '#2c3137'; g.lineWidth = 1;
      for (let x = 92; x < w - 92; x += 2) { g.beginPath(); g.moveTo(x, 31); g.lineTo(x + (r() - 0.5) * 3, 48 - r() * 4); g.stroke(); g.beginPath(); g.moveTo(x, 65); g.lineTo(x + (r() - 0.5) * 3, 48 + r() * 4); g.stroke(); }
    } else {
      g.fillStyle = '#23282e'; for (const y of [30, 60]) g.fillRect(40, y, w - 80, 3);     // pressed stiffening ribs
    }
    for (const x of [14, w - 42]) { g.fillStyle = '#3a4149'; g.fillRect(x, 26, 28, 44); g.fillStyle = '#0c0e10'; g.fillRect(x + 8, 34, 12, 28); }   // snap tabs
  });
}
function blanking(scene, N, y0, y1, z, w) {
  const n = Math.floor((y1 - y0) / U + 0.001);
  if (n < 1) return;
  const side = new THREE.MeshStandardMaterial({ color: 0x15181c, roughness: 0.7, metalness: 0.2 });
  const mats = [0, 1].map(k => new THREE.MeshStandardMaterial({ map: blankTex(k === 0), roughness: 0.68, metalness: 0.25 }));
  mats[0].name = 'Brush-strip cable manager'; mats[1].name = 'Snap-in blanking panel';
  const brush = new THREE.Mesh(new THREE.BoxGeometry(w, U * 0.97, 0.012), [side, side, side, side, mats[0], side]);
  brush.position.set(0, y0 + U / 2, z); scene.add(brush);
  const panels = new THREE.InstancedMesh(new THREE.BoxGeometry(w, U * 0.97, 0.008), [side, side, side, side, mats[1], side], n - 1);
  for (let k = 1; k < n; k++) panels.setMatrixAt(k - 1, mtx(0, y0 + (k + 0.5) * U, z - 0.002));
  panels.castShadow = panels.receiveShadow = true; scene.add(panels);
  // back plate behind the panels closes any sliver left over at the top
  N.box(w, y1 - y0, 0.004, MAT.black, 0, (y0 + y1) / 2, z - 0.012);
}

// 0U vertical PDU face: C19 outlets in branch-circuit banks, each bank with its
// own colored band. Outlet type follows the reported C19 class for these
// strips; bank count, colors and layout are representative (ASSUMPTIONS
// 'h100-pdu-cords').
function pduTex(banks) {
  return canvasTex(64, 1024, (g, w, h) => {
    g.fillStyle = '#4a5058'; g.fillRect(0, 0, w, h);
    const colors = ['#4f8fd6', '#e0a83a', '#9a6fd6'];
    for (let b = 0; b < banks; b++) {
      const y0 = 40 + b * (h - 80) / banks, bh = (h - 80) / banks - 12;
      g.fillStyle = '#2a2f35'; g.fillRect(6, y0, w - 12, bh);
      g.fillStyle = colors[b % 3]; g.fillRect(6, y0, 8, bh);
      for (let o = 0; o < 5; o++) {
        const oy = y0 + 10 + o * (bh - 20) / 5;
        g.fillStyle = '#6a717a'; g.fillRect(18, oy - 2, 34, 24);
        g.fillStyle = '#0a0b0d'; g.fillRect(20, oy, 30, 20);
        g.fillStyle = '#5b626b'; g.fillRect(25, oy + 5, 20, 3); g.fillRect(25, oy + 12, 20, 3);
      }
    }
  });
}

// Seeded generator: every build, and the Blender export, draws identical surface detail.
function rng(seed) { let s = seed >>> 0; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; }

// DGX H100 front bezel: NVIDIA describes it as decorative metal foam with
// handles. Open-cell foam is drawn as a height field of overlapping pores,
// giving a matching color map and tangent-space normal map. Cell size is
// representative (ASSUMPTIONS 'dgx-h100-bezel-rear').
function foamMaps(w = 512, h = 400, seed = 7) {
  // Dense, overlapping shallow pores leave a web of struts rather than isolated
  // dark holes on a flat plate; the tile repeats 2 x 2 so a cell is about 1-2 mm.
  const r = rng(seed), H = new Float32Array(w * h).fill(1);
  for (let n = 0, count = Math.round(w * h / 7); n < count; n++) {
    const cx = r() * w, cy = r() * h, rad = 1.6 + r() * r() * 2.4, depth = 0.3 + r() * 0.3;
    for (let y = Math.floor(cy - rad); y <= Math.ceil(cy + rad); y++) for (let x = Math.floor(cx - rad); x <= Math.ceil(cx + rad); x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / rad; if (d >= 1) continue;
      const i = ((y + h) % h) * w + ((x + w) % w), v = 1 - depth * (1 - d * d);
      if (v < H[i]) H[i] = v;
    }
  }
  const at = (x, y) => H[((y + h) % h) * w + ((x + w) % w)];
  const repeat = [2, 2];
  const map = canvasTex(w, h, (g) => {
    const img = g.createImageData(w, h), d = img.data;
    for (let i = 0; i < w * h; i++) {
      const k = 0.46 + 0.62 * Math.pow(H[i], 1.6), j = 0.96 + 0.08 * ((i * 2654435761 >>> 0) / 4294967296);
      d[i * 4] = Math.min(255, DGX_RACK.bezel.rgb[0] * k * j); d[i * 4 + 1] = Math.min(255, DGX_RACK.bezel.rgb[1] * k * j); d[i * 4 + 2] = Math.min(255, DGX_RACK.bezel.rgb[2] * k * j); d[i * 4 + 3] = 255;
    }
    g.putImageData?.(img, 0, 0);
  }, { repeat });
  const normalMap = canvasTex(w, h, (g) => {
    const img = g.createImageData(w, h), d = img.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = (at(x - 1, y) - at(x + 1, y)) * 1.6, dy = (at(x, y + 1) - at(x, y - 1)) * 1.6, len = Math.hypot(dx, dy, 1), i = (y * w + x) * 4;
      d[i] = 128 + 127 * dx / len; d[i + 1] = 128 + 127 * dy / len; d[i + 2] = 128 + 127 / len; d[i + 3] = 255;
    }
    g.putImageData?.(img, 0, 0);
  }, { srgb: false, repeat });
  const mat = new THREE.MeshStandardMaterial({ map, normalMap, normalScale: new THREE.Vector2(0.55, 0.55), roughness: 0.55, metalness: 0.8 });
  mat.name = 'DGX bezel metal foam';
  return mat;
}

// DGX H100 rear, as the user guide's rear figure lays it out: the GPU tray's
// perforated exhaust over the top 60%, the motherboard tray's I/O band under it
// (riser slots either side, the OSFP cages in the middle, the management row),
// six supplies across the bottom. Hole size and port shapes are representative
// (ASSUMPTIONS 'dgx-h100-bezel-rear').
function serverRearTex() {
  return canvasTex(512, 406, (g, w, h) => {
    g.fillStyle = '#4a515a'; g.fillRect(0, 0, w, h);
    const r = rng(11);
    const perforate = (x0, y0, x1, y1, step, rad) => {
      g.fillStyle = '#07080a';
      for (let y = y0, row = 0; y < y1; y += step * 0.87, row++) for (let x = x0 + (row % 2) * step / 2; x < x1; x += step) { g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill(); }
    };
    // GPU tray exhaust, framed by folded sheet seams
    g.fillStyle = '#3a4048'; g.fillRect(8, 6, w - 16, 238); perforate(16, 14, w - 12, 240, 9, 3.1);
    // motherboard tray I/O band: riser brackets either side, the cage window in the middle, the management row below
    g.fillStyle = '#1c2026'; g.fillRect(8, 249, w - 16, 100);
    for (const x0 of [14, 330]) for (const y0 of [256, 284]) { g.fillStyle = '#4a515a'; g.fillRect(x0, y0, 168, 24); g.fillStyle = '#050607'; g.fillRect(x0 + 50, y0 + 6, 26, 12); g.fillRect(x0 + 82, y0 + 6, 26, 12); }
    g.fillStyle = '#2b3037'; g.fillRect(190, 262, 132, 46);
    for (let i = 0; i < 2; i++) { g.fillStyle = '#050607'; g.fillRect(200 + i * 30, 318, 22, 18); g.fillStyle = '#5a6068'; g.fillRect(200 + i * 30, 318, 22, 3); }
    g.fillStyle = '#050607'; g.fillRect(30, 322, 14, 10); g.fillRect(50, 322, 14, 10); g.fillRect(80, 320, 30, 14); g.fillRect(270, 318, 40, 16); g.fillRect(400, 320, 30, 14);
    // six supplies: grille, pull handle, C20 inlet, status window
    for (let i = 0; i < 6; i++) {
      const x = 10 + i * 82, y = 355;
      g.fillStyle = '#5b626b'; g.fillRect(x, y, 78, h - y - 6);
      g.fillStyle = '#0a0b0d'; g.fillRect(x, y, 78, 2); g.fillRect(x, y, 2, h - y - 6);
      perforate(x + 8, y + 10, x + 44, h - 12, 6, 2.1);
      g.fillStyle = '#090a0c'; g.fillRect(x + 50, y + 8, 20, 16); g.fillStyle = '#2b2f35'; g.fillRect(x + 53, y + 12, 3, 8); g.fillRect(x + 59, y + 12, 3, 8); g.fillRect(x + 65, y + 12, 3, 8);
      g.fillStyle = '#b8bfc6'; g.fillRect(x + 52, y + 36, 16, 4);
      g.fillStyle = r() < 2 ? '#1c3a2a' : '#000'; g.fillRect(x + 50, y + 28, 5, 5);
    }
  });
}

// a proud trim bar (top or bottom) plus a small handle nub in front of a panel face at (cx, cy, facez)
function bezel(B, cx, cy, halfW, halfH, facez, mat = TRIM) {
  rbox(B, halfW * 2, 0.01, 0.012, mat, cx, cy - halfH + 0.005, facez + 0.007, { r: 0.3 });
  rbox(B, halfW * 2, 0.01, 0.012, mat, cx, cy + halfH - 0.005, facez + 0.007, { r: 0.3 });
  rbox(B, 0.03, 0.05, 0.012, mat, cx + halfW - 0.05, cy, facez + 0.007, { r: 0.25 });
}

// Representative captive heads on the mounting ears already drawn below.
// A dark slot sits on each head; no new connector or functional port is implied.
function earFasteners(B, y, z, offsets = [0]) {
  for (const x of [-0.245, 0.245]) for (const dy of offsets) {
    B.cylZ(0.004, 0.003, COLLAR, x, y + dy, z, 10);
    B.box(0.0045, 0.0008, 0.0004, MAT.black, x, y + dy, z + 0.0017);
  }
}

// Low-relief service geometry over the existing representative front panel:
// recessed grille frame, folded border and two-ended pull handle. Grille bars
// are ventilation, not additional I/O port counts.
function serviceFace(B, y, z, heavy, kind) {
  rbox(B, 0.414, 0.003, 0.004, COLLAR, 0, y - U * 0.43, z + 0.002, { r: 0.3 });
  if (kind === 'switch') {
    B.box(0.147, U * 0.58, 0.002, MAT.black, -0.126, y, z + 0.0015);
    if (heavy) for (let i = 0; i < 20; i++) B.box(0.0015, U * 0.48, 0.0025, MAT.darkSteel, -0.195 + i * 0.0073, y, z + 0.0035);
  }
  const gold = kind === 'switch';
  for (const x of [-0.204, 0.194]) {
    if (gold) {
      // bent pull handle: two standoffs and a proud grip bar
      for (const dy of [-0.013, 0.013]) B.box(0.008, 0.005, 0.016, TRIM, x, y + dy, z + 0.008);
      rbox(B, 0.011, U * 0.72, 0.006, TRIM, x, y, z + 0.0185, { r: 0.35 });
      continue;
    }
    rbox(B, 0.009, U * 0.57, 0.004, COLLAR, x, y, z + 0.004, { r: 0.22 });
    // The black grip sits on the collar front; its rear must not coincide
    // with the collar rear (which caused a second, overlapping back face).
    B.box(0.005, U * 0.34, 0.002, MAT.black, x, y, z + 0.007);
  }
}

// ---------- four DGX H100 servers, air-cooled ----------
// Pulled-tray boards get the PCB surface at rack distance (tray-pcb.js, rack LOD).
const TRAY_PCB = Object.assign(new THREE.MeshStandardMaterial({ color: 0x10362a, roughness: 0.6, metalness: 0.05 }), { name: 'Rack tray solder mask' });
function buildHGX({ quality, model, state }) {
  const scene = new THREE.Scene();
  const flows = [], dataFlows = [], heatFlows = [];
  const S = new Builder(), N = new Builder();
  const { W, D, H } = RACK, X = W / 2, ZF = D / 2, ZB = -D / 2, base = RACK_BASE;
  room(scene, quality, S, N, W, H, D);
  const SU = DGX_RACK.SU, sw = DGX_RACK.chassisW, sd = DGX_RACK.chassisD;      // dgx-h100-layout.js: the hall's rack faces draw the same bezels
  const sy = dgxServerY;                                                       // server centers, bottom up
  // An exploded service position exposes the complete server instead of
  // burying the CPU board under the next chassis. Not an operating position.
  const PULLED = 2, out = 1.0;
  const side = new THREE.MeshStandardMaterial({ color: 0x454c55, roughness: 0.5, metalness: 0.5 });
  const rear = new THREE.MeshStandardMaterial({ map: serverRearTex(), roughness: 0.6, metalness: 0.25 });
  const foam = foamMaps();
  const inRack = [0, 1, 3];
  const m = new THREE.InstancedMesh(new THREE.BoxGeometry(sw, SU * 0.98, sd), [side, side, side, side, MAT.rackFace, rear], inRack.length);
  inRack.forEach((k, n) => m.setMatrixAt(n, mtx(0, sy(k), ZF - 0.07 - sd / 2)));
  m.castShadow = m.receiveShadow = true; scene.add(m);
  inRack.forEach(k => { for (const x of DGX_RACK.ears.x) N.box(DGX_RACK.ears.w, DGX_RACK.ears.h, 0.01, MAT.galv, x, sy(k), ZF - 0.065); });
  if (!quality.mobile) inRack.forEach(k => earFasteners(N, sy(k), ZF - 0.0585, [-SU * 0.36, SU * 0.36]));
  // Removable metal-foam bezel on every closed server: a proud plate inside the
  // service perimeter, two carry handles, and the published front controls
  // (power button, ID button, fault LED) on a small panel at the right.
  const bz = ZF - 0.07 + 0.0075, bzFront = bz + 0.006;
  // Instanced so the plate keeps its UVs (Builder geometry drops them).
  const plates = new THREE.InstancedMesh(new THREE.BoxGeometry(DGX_RACK.bezel.w, DGX_RACK.bezel.h, 0.012), [side, side, side, side, foam, side], inRack.length);
  inRack.forEach((k, n) => plates.setMatrixAt(n, mtx(0, sy(k), bz)));
  plates.castShadow = plates.receiveShadow = true; scene.add(plates);
  inRack.forEach(k => {
    const { handle: hd, panel: pn } = DGX_RACK;
    for (const x of hd.x) {
      rbox(N, hd.w, hd.h, 0.012, COLLAR, x, sy(k) + hd.dy, bzFront + 0.007, { r: 0.35 });
      for (const dy of hd.standoffDy) N.box(0.01, 0.012, 0.008, MAT.darkSteel, x, sy(k) + hd.dy + dy, bzFront + 0.002);
    }
    rbox(N, pn.w, pn.h, 0.004, MAT.black, pn.x, sy(k) + pn.dy, bzFront + 0.0022, { r: 0.3 });
    N.cylZ(0.0055, 0.004, COLLAR, pn.x, sy(k) + pn.dy + pn.buttonsDy[0], bzFront + 0.0048, 16);   // power button
    N.cylZ(0.0045, 0.004, COLLAR, pn.x, sy(k) + pn.dy + pn.buttonsDy[1], bzFront + 0.0048, 16);   // ID button
    N.box(0.005, 0.005, 0.002, new THREE.MeshStandardMaterial({ color: 0x3a2508, roughness: 0.3 }), pn.x, sy(k) + pn.dy + pn.buttonsDy[2], bzFront + 0.0048); // fault LED, dark
  });
  // Rear supplies: a pull handle proud of each of the six bays.
  inRack.forEach(k => { for (let i = 0; i < 6; i++) rbox(N, 0.034, 0.006, 0.012, MAT.galv, 0.185 - i * 0.0705 - 0.005, sy(k) - SU * 0.49 + 0.012, ZF - 0.07 - sd - 0.006, { r: 0.4 }); });
  // management switch and blanking above
  const topY = sy(3) + SU / 2 + 0.01;
  const mg = trayTex('mgmt');
  const mgm = new THREE.Mesh(new THREE.BoxGeometry(sw, U * 0.94, 0.5), [side, side, side, side, new THREE.MeshStandardMaterial({ map: mg, roughness: 0.5, metalness: 0.35 }), side]);
  mgm.position.set(0, topY + U / 2, ZF - 0.07 - 0.25); scene.add(mgm);
  blanking(scene, N, topY + U, H - 0.05, ZF - 0.07 + 0.001, sw);
  mgmtHardware(N, topY + U / 2, ZF - 0.07, !quality.mobile);

  // The pulled server, lid off and its near wall cut low, laid out like the server level (tray.js DGX, 10 cm units
  // scaled to the 0.84 m chassis): twelve fan modules over eight drives at the front, the GPU tray on top with eight
  // heat sinks and four NVSwitch sinks, the motherboard tray under it (CPUs, 32 DIMMs, two network modules), six
  // supplies across the bottom of the rear and the midplane behind the fans.
  const py = sy(PULLED), pz = ZF - 0.07 - sd / 2 + out, yb = py - SU / 2;
  const kz = sd / DGX.D, tx = x => x * 0.1, ty = y => yb + y * 0.1, tz = z => pz + z * kz;
  const pulled = new Builder();
  pulled.box(sw, 0.004, sd, MAT.galv, 0, yb + 0.004, pz);
  pulled.box(0.004, SU * 0.95, sd, MAT.galv, -sw / 2, py, pz);
  // Right wall is a teaching cutaway, matching the dedicated server view.
  pulled.box(0.004, .045, sd, MAT.galv, sw / 2, yb + .0225, pz);
  const fanItems = [];
  for (const y of DGX.fanY) for (const x of DGX.fanX) {
    pulled.box(0.1, 0.095, 0.06, MAT.fan, tx(x), ty(y), tz(DGX.ZF - 0.36));
    for (const s of [-1, 1]) fanItems.push({ p: [tx(x + s * 0.255), ty(y), tz(DGX.ZF) + 0.002], axis: 'z', r: 0.021 });
  }
  for (const x of DGX.driveX) for (const y of DGX.driveY) pulled.box(0.074, 0.014, 0.1, MAT.alu, tx(x), ty(y), tz(DGX.ZF - 0.6));
  pulled.box(sw - 0.01, 0.34, 0.003, MAT.pcbBlack, 0, ty(1.75), tz(DGX.ZM));                                           // midplane
  // GPU tray: pan, baseboard, eight sinks, four NVSwitch sinks
  // both trays' pans end short of the midplane, where the 54 V blade rises between them
  const panD = (3.1 - DGX.ZB) * kz, panZ = tz((3.1 + DGX.ZB) / 2);
  pulled.box(sw - 0.01, 0.003, panD, MAT.galv, 0, ty(DGX.deck), panZ);
  pulled.box(0.42, 0.003, 6.6 * kz, TRAY_PCB, 0, ty(DGX.gy - 0.015), tz(-0.05));
  const sinks = [];
  // fins get their own material, not the shared MAT.alu: at close range under the studio env, MAT.alu's high
  // metalness+low roughness blows out to featureless white; the fins are the closest, densest metal in the shot
  const FIN = new THREE.MeshStandardMaterial({ color: 0xb8bfc6, roughness: 0.6, metalness: 0.45, envMapIntensity: 0.5 });
  for (const z of DGX.gpuZ) for (const x of DGX.gpuX) {
    sinks.push([tx(x), tz(z)]);
    pulled.box(0.094, 0.008, 1.7 * kz, MAT.copper, tx(x), ty(DGX.gy + 0.16), tz(z));
    for (let f = 0; f < 20; f++) pulled.box(0.0014, 0.155, 1.66 * kz, FIN, tx(x - 0.456 + f * 0.048), ty(DGX.gy + 0.98), tz(z));
  }
  for (const x of DGX.swX) pulled.box(0.088, 0.09, 1.08 * kz, MAT.alu, tx(x), ty(DGX.gy + 0.5), tz(DGX.swZ));
  // motherboard tray: pan, boards, CPU sinks, DIMMs, network modules
  pulled.box(sw - 0.01, 0.003, panD, MAT.galv, 0, ty(0.495), panZ);
  pulled.box(0.42, 0.003, 4.44 * kz, TRAY_PCB, 0, ty(DGX.my - 0.015), tz(-2.1));
  pulled.box(0.42, 0.003, 3.02 * kz, TRAY_PCB, 0, ty(DGX.my - 0.015), tz(1.71));
  for (const x of DGX.cpuX) pulled.box(0.07, 0.055, 0.92 * kz, MAT.alu, tx(x), ty(DGX.my + 0.32), tz(DGX.cpuZ));
  for (const bx of DGX.bankX) for (let k = 0; k < 8; k++) pulled.box(0.0022, 0.03, DGX.dimmLen * kz, MAT.darkSteel, tx(bx + (k - 3.5) * DGX.dimmPitch), ty(DGX.my + 0.19), tz(DGX.cpuZ));
  for (const mx of DGX.modX) { pulled.box(0.142, 0.0025, 1.3 * kz, TRAY_PCB, tx(mx), ty(DGX.ny - 0.0125), tz(DGX.modZ)); for (const dx of [-0.36, 0.36]) for (const dz of [-0.32, 0.32]) pulled.box(0.06, 0.03, 0.56 * kz, MAT.darkSteel, tx(mx + dx), ty(DGX.ny + 0.18), tz(DGX.modZ + dz)); }
  for (let i = 0; i < 6; i++) pulled.box(0.068, 0.04, 2.4 * kz, MAT.darkSteel, tx(DGX.psuX(i)), ty(DGX.psuY), tz(DGX.ZB + 1.22));   // supplies
  for (const x of [-0.26, 0.26]) pulled.box(0.012, 0.012, sd + out, MAT.galv, x, yb + 0.006, pz - out / 2);
  scene.add(pulled.build());
  const fans = spinners(fanItems, MAT.darkSteel, { blades: 7, speed: 7 });
  fans.mesh.userData.computeDynamic = 'rotor';
  scene.add(fans.mesh);

  // rear: two 0U vertical power strips and 24 C19-C20 cords (six supplies per
  // server, three from each strip) plugged into the supplies across the bottom
  // of each server's rear panel. Supply inlet positions follow serverRearTex().
  const pduX = [-0.22, 0.22], pduZ = ZB + 0.105, pTop = sy(3) + SU / 2, pBot = sy(0) - SU / 2;
  const psuX = i => 0.1598 - 0.0705 * i, psuY = k => sy(k) - 0.147, psuZ = ZF - 0.07 - sd - 0.0105;
  const PDUBODY = new THREE.MeshStandardMaterial({ color: 0x454b53, roughness: 0.46, metalness: 0.45 }); PDUBODY.name = 'PDU extrusion';
  const PLUG = new THREE.MeshStandardMaterial({ color: 0x121316, roughness: 0.55, metalness: 0.05 }); PLUG.name = 'Molded C19/C20 plug';
  const outletFace = new THREE.MeshStandardMaterial({ map: pduTex(8), roughness: 0.55, metalness: 0.3 });
  const cordEnds = [];
  pduX.forEach((x, side) => {
    const inward = -Math.sign(x);
    const faces = [PDUBODY, PDUBODY, PDUBODY, PDUBODY, PDUBODY, PDUBODY]; faces[inward > 0 ? 0 : 1] = outletFace;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.055, pTop - pBot, 0.055), faces);
    body.position.set(x, (pTop + pBot) / 2, pduZ); body.castShadow = body.receiveShadow = true; scene.add(body);
    // input head: breaker block with toggles and a small meter window
    rbox(N, 0.06, 0.07, 0.06, PDUBODY, x, pTop + 0.035, pduZ, { r: 0.12 });
    for (const dy of [0.012, 0.042]) N.box(0.008, 0.014, 0.01, MAT.white, x + inward * 0.031, pTop + dy, pduZ);
    N.box(0.003, 0.014, 0.03, glowMat('#6fc3e0', 0.3), x + inward * 0.031, pTop + 0.027, pduZ + 0.008);
    N.cyl(0.014, 0.02, GLAND, x, pTop + 0.078, pduZ, 12);
    [0, 1, 3].forEach(k => [0, 1, 2].forEach(o => {
      const oy = sy(k) - 0.035 + o * 0.035, px = x + inward * 0.036, psu = side ? o : 3 + o;
      N.box(0.022, 0.026, 0.03, PLUG, px, oy, pduZ);                                          // cord's C20 plug in a C19 strip outlet
      N.box(0.03, 0.03, 0.022, PLUG, psuX(psu), psuY(k), psuZ);                                 // cord's C19 connector on the supply's C20 inlet
      bundle(N, [px + inward * 0.012, oy, pduZ], [psuX(psu), psuY(k), psuZ - 0.01], { n: 1, r: 0.0042, sag: 0.05 + o * 0.012, mats: [MAT.black], seed: k * 7 + o + side * 3, seg: 6 });
      if (o === 1) cordEnds.push({ k, from: [px + inward * 0.012, oy, pduZ], to: [psuX(psu), psuY(k), psuZ - 0.01] });
    }));
  });
  // feed from the busway above to the top of each strip
  busway(scene, S, N, pduX.map(x => x * 0.5), glowMat('#ff8a3d', 0.9), H);
  pduX.forEach(x => { N.strut([x * 0.5, TAP.glandY, -0.25], [x * 0.5, H + 0.02, -0.25], 0.012, MAT.black, 8); N.strut([x * 0.5, H, -0.25], [x, pTop + 0.085, pduZ], 0.012, MAT.black, 8); });
  // data: fiber from each server's rear cages up the back to the runway
  const fx = 0.12, fz = ZB + 0.06;
  S.box(RACK_RUNWAY.width,.03,RACK_RUNWAY.length,MAT.yellowTray,RACK_RUNWAY.x,RACK_RUNWAY.floorY,0); for(const side of [-1,1]) S.box(.012,.1,RACK_RUNWAY.length,MAT.yellowTray,RACK_RUNWAY.x+side*.14,3.66,0);
  scene.add(S.build()); scene.add(N.build({ cast: false }));

  // ---------- flows ----------
  pduX.forEach(x => flows.push(flow([[x * 0.5, TAP.glandY, -0.25], [x * 0.5, H + 0.02, -0.25], [x, pTop + 0.085, pduZ], [x, pBot, pduZ]], 'lv', { count: 16, speed: 0.35, size: 0.012, trailR: 0.004, audit: { through: true, why: 'current inside the drawn feed cord: down from the busway tap, through its grommet in the top cap, into the strip head and down the strip' } })));
  cordEnds.forEach(({ from, to }) => flows.push(flow([from, [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2 - 0.04, (from[2] + to[2]) / 2], to], 'lv', { count: 3, speed: 0.2, size: 0.009, trail: false, audit: { through: true, why: 'current inside the drawn C19/C20 cord from the strip outlet to the supply inlet' } })));
  // 54 V forward along the floor copper under the motherboard tray, up the midplane into the GPU tray
  flows.push(flow([[tx(DGX.busX[1]), ty(0.1), tz(DGX.ZB + 2.75)], [tx(DGX.busX[1]), ty(0.1), tz(DGX.ZM - 0.04)], [tx(DGX.busX[1]), ty(DGX.gy + 0.04), tz(DGX.ZM - 0.04)], [tx(DGX.busX[1]), ty(DGX.gy + 0.04), tz(2.2)]], 'dc', { count: 8, speed: 0.2, size: 0.008, trailR: 0.003 }));
  // scale-up: NVLink only inside the pulled server, GPUs to the switch row
  sinks.forEach(([x, z]) => dataFlows.push(flow([[x, ty(DGX.gy + 0.04), z], [x * 0.95, ty(DGX.gy + 0.04), tz(DGX.swZ + 0.3)]], 'nvl', { count: 3, speed: 0.12, size: 0.006, k: 2.4, trail: false })));
  // heat: cold air in the front of every server, hot air out the back
  // each closed server's air carries all of that server's heat; in the pulled one, each GPU sink's air its GPU's
  const serverW = model.rack.kw * 1000 / (model.accel.gpusPerRack / 8);
  [0, 1, 3].forEach(k => { for (const x of [-0.14, 0, 0.14]) for (const dy of [-0.08, 0.08]) {
    heatFlows.push(tagHeat(flow([[x, sy(k) + dy, ZF + 0.8], [x, sy(k) + dy, ZF]], 'cool', { count: 3, speed: 0.4, size: 0.02, k: 2.0, opacity: 0.8, trail: false }), `server-${k}-air`, serverW, 'carrier'));
    heatFlows.push(tagHeat(flow([[x, sy(k) + dy, ZB], [x * 1.3, sy(k) + dy + 0.1, ZB - 0.8]], 'air', { count: 3, speed: 0.45, size: 0.024, k: 2.4, opacity: 0.9, trail: false }), `server-${k}-air`, serverW, 'carrier'));
  } });
  sinks.forEach(([x, z], i) => heatFlows.push(tagHeat(flow([[x, ty(2.4), pz + sd / 2 - 0.08], [x, ty(2.4), z], [x, ty(2.5), pz - sd / 2 - 0.2]], 'air', { count: 3, speed: 0.25, size: 0.012, k: 2.4, trail: false }), `gpu-${i}-sink-air`, model.accel.gpuW, 'carrier')));
  balanceHeat(heatFlows);
  [flows, dataFlows, heatFlows].forEach(list => list.forEach(f => scene.add(f.group)));

  // ---------- activity: status LEDs and warm exhaust shimmer (all four servers are air-cooled) ----------
  const ledStep = quality.mobile ? 2 : 1;
  const ledItems = [], portLeds = [];
  // Front: power LED (solid green when on) and the ID button's blue LED, which
  // only some servers show, as an operator locating one would see. Rear: each
  // supply's status light.
  inRack.forEach((k, i) => {
    ledItems.push({ p: [0.155, sy(k) + SU * 0.3 + 0.024, bzFront + 0.0075], color: '#5cf29a', rate: 0 });
    if (i === 1) ledItems.push({ p: [0.155, sy(k) + SU * 0.3, bzFront + 0.0075], color: '#4aa8ff', rate: 0.5, duty: 0.5 });
    if (!quality.mobile) for (let s = 0; s < 6; s++) ledItems.push({ p: [0.2 - s * 0.0705 - 0.03, sy(k) - SU * 0.49 + 0.0165, ZF - 0.07 - sd - 0.003], color: '#5cf29a', rate: 0 });
  });
  for (let b = 0; b < 4; b++) portLeds.push({ p: [-0.22 + (140 + b * 170 + 64) / 1024 * 0.44, topY + U / 2 + U * 0.36, ZF - 0.067], color: '#5cf29a', rate: 1.3 + b * 0.37, duty: 0.35 });
  const leds = blinkers(ledItems, { size: 0.008 }), links = blinkers(portLeds, { size: 0.0032 });
  scene.add(links.mesh);
  scene.add(leds.mesh);
  const haze = plumes(
    [...inRack.map(k => ({ p: [0, sy(k) + 0.02, ZB - 0.12], dir: [0, 1, 0] })), { p: [0, ty(2.4), pz - sd / 2 - 0.22], dir: [0, 1, 0] }],
    { perEmitter: quality.mobile ? 5 : 14, size: 0.045, grow: 2.4, life: 2.6, rise: 0.3, drift: [0, 0.12, -0.4], spread: 0.05, color: AIR_HAZE, opacity: 0.14, additive: true },
  );
  scene.add(haze.points);

  const srv = { pos: [0.2, py + 0.12, pz + 0.3], view: { pos: [0.7, 1.9, 1.8], target: [0, py, pz] } };
  // The power layer's glow (src/power-glow.js): each closed server on its rear face (the camera's side) by its share
  // of the rack, and inside the pulled server its GPUs, NVSwitches, CPUs and supplies on the server level's watts.
  const PW = PART_W.dgxH100, A_ = model.accel, PD = [];
  inRack.forEach(k => PD.push({ id: `server-${k}`, part: 'servers', watts: model.rack.kw * 1000 / (A_.gpusPerRack / 8), at: [0, sy(k), ZF - 0.07 - sd - 0.004], size: [sw, SU * 0.94], normal: [0, 0, -1], margin: 0.01, fill: 0.04 }));
  for (const z of DGX.gpuZ) for (const x of DGX.gpuX) PD.push({ id: `pulled-gpu-${x}-${z}`, part: 'servers', watts: A_.gpuW, volt: 'core', at: [tx(x), ty(DGX.gy) + 0.0006, tz(z)], size: [0.09, 1.4 * kz] });
  for (const x of DGX.swX) PD.push({ id: `pulled-nvswitch-${x}`, part: 'servers', watts: PW.nvswitch, at: [tx(x), ty(DGX.gy) + 0.0006, tz(DGX.swZ)], size: [0.09, 1.1 * kz] });
  for (const x of DGX.cpuX) PD.push({ id: `pulled-cpu-${x}`, part: 'servers', watts: PW.cpu, volt: 'core', at: [tx(x), ty(DGX.my) + 0.0006, tz(DGX.cpuZ)], size: [0.074, 0.7 * kz] });
  for (let i = 0; i < 6; i++) PD.push({ id: `pulled-psu-${i}`, part: 'psus', watts: PW.psuLoss, volt: 'lv', at: [tx(DGX.psuX(i)), yb + 0.0065, tz(DGX.ZB + 1.22)], size: [0.068, 2.4 * kz] });
  return {
    powerDraw: PD,
    // the server's model name on each closed server's bezel, upper left, text only (package-marks.js etch style)
    printSpots: [etch('DGX H100 bezel name', 'DGX H100', [.1, .02], inRack.map(k => ({ from: [-.12, sy(k) + SU * 0.3, ZF + 1], dir: [0, 0, -1] })), { ink: '#d5dbe2' })],
    scene, flows,
    camera: { pos: [3.1, 2.3, -3.7], target: [0, 1.0, -0.1], near: 0.01, far: 200, min: 0.4, max: 9 },
    hotspots: {
      feed: { pos: [0.12, 3.03, -0.165], view: { pos: [1.2, 3.1, 1.0], target: [0, 2.7, -0.25] } },
      // From the rear on the far side, so the strip's outlet face (it faces
      // into the rack) and its plugged cords are in view, not its blank back.
      pdu: { pos: [pduX[1] - 0.03, sy(1) + 0.1, pduZ], view: componentView([pduX[1] - 0.03, sy(1) + 0.05, pduZ], [-0.62, 0.2, -0.72], [0.22, 0.62, 0.22]) },
      servers: srv,
      psus: { pos: [tx(DGX.psuX(4)), ty(DGX.psuY + 0.2), pz - sd / 2 + 0.03], view: { pos: [0.9, 1.5, -0.9], target: [0, yb, pz - 0.4] } },
      cabling: { pos: [pduX[0] * 0.7, sy(0), ZB + 0.15], view: { pos: [-0.8, 0.9, -1.5], target: [0, 0.6, ZB] } },
      mgmt: { pos: [0.22, topY + U / 2, ZF - 0.03], view: componentView([0.02, topY + U / 2, ZF - 0.02], [0.32, 0.16, 0.9], [0.5, 0.12, 0.2]) },
    },
    dataFlows, heatFlows,
    heatHotspots: {
      front: { pos: [0.1, sy(1), ZF + 0.5], view: { pos: [1.4, 1.2, 2.4], target: [0, 0.8, ZF] } },
      rearair: { pos: [0.05, sy(3), ZB - 0.4], view: { pos: [1.6, 1.6, -2.0], target: [0, 1.0, ZB - 0.3] } },
      servers: srv,
    },
    dataHotspots: {
      tp: { pos: [tx(DGX.gpuX[1]), ty(DGX.gy + 1.7), tz(DGX.gpuZ[0])], view: { pos: [0.5, 1.6, 1.5], target: [0, py, pz] } },
      servers: srv,
      uplinks: { pos: [fx, H + 0.2, fz], view: { pos: [1.3, 2.9, -1.6], target: [0.2, 2.2, fz] } },
      // The rear cage rows, the combed fiber manager and its patch strip: the
      // scale-out optics this card contrasts with scale-up copper.
      optical: { pos: [0.259, 1.62, ZB - 0.06], view: componentView([0.02, 1.28, ZB + 0.06], [0.75, 0.3, -0.95], [0.6, 1.0, 0.4]) },
      mgmt: { pos: [0.22, topY + U / 2, ZF - 0.03], view: componentView([0.02, topY + U / 2, ZF - 0.02], [0.32, 0.16, 0.9], [0.5, 0.12, 0.2]) },
    },
    look: LOOK,
    update(t) { leds.update(t); links.update(t); haze.points.visible = state.mode === 'heat'; if (haze.points.visible) haze.update(t); fans.update(t); },
  };
}

// ---------- NVL72 class: 18 compute trays, 9 switch trays, liquid-cooled ----------
function buildNVL({ quality, model, state }) {
  const rubin = model.accel.id === 'rubin', switchChips = rubin ? 4 : 2;
  const feedV = model.power.id === 'dc800' ? 'hvdc' : 'lv';
  const scene = new THREE.Scene();
  const flows = [], dataFlows = [], heatFlows = [];
  const S = new Builder(), N = new Builder();
  const { W, D, H } = RACK, X = W / 2, ZF = D / 2, ZB = -D / 2;
  const base = 0.1;
  // Rear EIA rails 4 mm outboard of the 440 mm trays, at the tray rears, so the corner manifolds and their couplers
  // stand clear of them and of the corner posts (they used to clip both by about 15 mm).
  room(scene, quality, S, N, W, H, D, { rearRail: { x: 0.227, z: ZB + 0.1 } });

  // ---------- trays ----------
  // eight power shelves (four under, four over the compute block), 18 compute and 9 switch trays (nvl72-layout.js)
  const layout = NVL_LAYOUT;
  const TEX = { compute: trayTex('compute', model.accel.id), switch: trayTex('switch', model.accel.id), ps: trayTex('ps'), mgmt: trayTex('mgmt'), blank: trayTex('blank') };
  const PULLED = NVL_PULLED, SWITCH_PULLED = NVL_SWITCH_PULLED, TOP_SHELF = NVL_ROWS.topShelf;   // trays pulled out for view
  const trayY = nvlTrayY;
  // The rear interface comes from the tray level (tray.js NVL_REAR / tray-rubin.js RUBIN_REAR, tray units x TRAY_UNIT): the four NVLink
  // cartridges sit behind the tray's four connectors, and the corner manifolds' nozzles on the tray's blind-mate fittings.
  const REAR = rubin ? RUBIN_REAR : NVL_REAR;
  const cartX = REAR.connectorX.map(x => x * TRAY_UNIT), nozzleX = REAR.manifoldX.map(x => x * TRAY_UNIT);
  // A and B feed cords (2N): the busway each taps (z over the rack), its tap x, its x in the rear cable space and the
  // shelves it feeds. The rear cable space is between the bus bar (x ±0.04) and the inner cartridges (GB: ±0.11, edge ±0.0785),
  // behind the trays (z < -0.435) and in front of the rear door. Vera Rubin's inner cartridges (±0.062) leave none there, so its
  // cords drop in the gap between the inner and outer cartridges instead.
  const CART_HALF = 0.0315, innerCart = Math.min(...cartX.map(Math.abs)), outerCart = Math.max(...cartX.map(Math.abs));
  const feedX = innerCart - CART_HALF - 0.04 >= 0.03 ? 0.065 : (innerCart + CART_HALF + outerCart - CART_HALF) / 2;
  const FEED = { z: ZB + 0.055, inletZ: ZF - 0.07 - 0.9 - 0.006,
    A: { bz: -0.25, tapX: -0.12, x: -feedX, shelves: [0, 1, NVL_ROWS.topShelfFirst, NVL_ROWS.topShelfFirst + 1] },
    B: { bz: 0.25, tapX: 0.12, x: feedX, shelves: [2, 3, NVL_ROWS.topShelf - 1, NVL_ROWS.topShelf] } };
  const feedPath = f => [[f.tapX, TAP.glandY, f.bz], [f.tapX, H + 0.03, f.bz], [f.tapX, H + 0.03, FEED.z], [f.x, H + 0.03, FEED.z], [f.x, trayY(Math.min(...f.shelves)), FEED.z]];
  scene.userData.rackFeeds = [FEED.A, FEED.B].map(f => ({ path: feedPath(f), whips: f.shelves.map(r => [[f.x, trayY(r), FEED.z], [f.x, trayY(r), FEED.inletZ]]) }));
  const kinds = {};
  layout.forEach((k, i) => (kinds[k] = kinds[k] || []).push(i));
  const trayW = 0.44, trayD = 0.9;
  for (const [k, idxs] of Object.entries(kinds)) {
    const items = idxs.filter(i => i !== PULLED && i !== SWITCH_PULLED);
    const front = new THREE.MeshStandardMaterial({ map: TEX[k], roughness: 0.5, metalness: 0.35 });
    const side = new THREE.MeshStandardMaterial({ color: k === 'ps' ? 0x4a5058 : 0x434a53, roughness: 0.5, metalness: 0.5 });
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(trayW, U * 0.94, trayD), [side, side, side, side, front, side], items.length);
    items.forEach((i, n) => m.setMatrixAt(n, mtx(0, trayY(i), ZF - 0.07 - trayD / 2)));
    m.castShadow = m.receiveShadow = true; scene.add(m);
  }
  // blanking panels above
  const topUsed = trayY(layout.length - 1) + U / 2;
  blanking(scene, N, topUsed, H - 0.05, ZF - 0.07 + 0.001, trayW);
  // tray ears, and a proud handle nub on every real tray so the front reads as serviceable hardware, not a picture
  layout.forEach((k, i) => {
    if (i === PULLED || i === SWITCH_PULLED) return;
    if (k === 'mgmt') { mgmtHardware(N, trayY(i), ZF - 0.07, !quality.mobile, i); return; }
    serviceFace(N, trayY(i), ZF - 0.07, !quality.mobile, k);
    N.box(0.03, U * 0.9, 0.01, MAT.galv, -0.245, trayY(i), ZF - 0.065); N.box(0.03, U * 0.9, 0.01, MAT.galv, 0.245, trayY(i), ZF - 0.065);
    if (!quality.mobile) earFasteners(N, trayY(i), ZF - 0.0585);
    if (k === 'compute') rbox(N, 0.05, U * 0.5, 0.01, rubin ? TRIM : COLLAR, X - 0.09, trayY(i), ZF - 0.07 + 0.006, { r: 0.3 });
    if (k === 'ps') for (let s = 0; s < 6; s++) rbox(N, 0.006, U * 0.52, 0.008, COLLAR, -0.22 + (8 + s * 168 + 150) / 1024 * 0.44, trayY(i), ZF - 0.07 + 0.004, { r: 0.4 });
  });

  // pulled-out compute tray with its lid off
  const py = trayY(PULLED), out = 0.95, pz = ZF - 0.07 - trayD / 2 + out;
  const pulled = new Builder();
  // Satin pre-galvanized pan: the polished finish mirrored the studio key into white blocks at the compute camera.
  const PAN = new THREE.MeshStandardMaterial({ color: 0x7a828a, roughness: 0.62, metalness: 0.5 }); PAN.name = 'Tray pan satin steel';
  pulled.box(trayW, 0.004, trayD, PAN, 0, py - U / 2 + 0.004, pz);
  pulled.box(0.004, U * 0.9, trayD, PAN, -trayW / 2, py, pz); pulled.box(0.004, U * 0.9, trayD, PAN, trayW / 2, py, pz);
  // Every board from the tray level's own plan (tray-pcb.js pcbLayout, the layout its solder mask is painted from):
  // the two superchip boards, and the NIC mezzanines and front cage boards (GB) or NIC and DPU boards (Rubin).
  const TU = TRAY_UNIT, by = py - U / 2 + 0.008;
  const lift = b => rubin ? (b.z > 2 ? 0.003 : 0) : b.z > 4 ? 0.012 : b.z > 3 ? 0.019 : 0;   // NIC/cage boards stand above the superchip boards, as at tray level
  for (const b of pcbLayout(model.accel.id).boards) if (!b.module) pulled.box(b.w * TU, 0.003, b.d * TU, TRAY_PCB, b.x * TU, by + lift(b), pz + b.z * TU);
  const plates = (rubin ? RUBIN_COLD_PLATES : NVL_COLD_PLATES).map(p => ({ x: p.x * TRAY_UNIT, z: p.z * TRAY_UNIT, w: p.w * TRAY_UNIT, d: p.d * TRAY_UNIT, kind: p.kind }));
  // Brushed lids, not mirror nickel: upward-facing polished slabs bloomed to white under the studio softbox.
  const LID = new THREE.MeshStandardMaterial({ color: 0x6b7178, roughness: 0.72, metalness: 0.3 }); LID.name = 'Brushed cold plate lid';
  plates.forEach(({ x, z, w, d }) => { pulled.box(w, 0.018, d, MAT.copper, x, py - U / 2 + 0.02, pz + z); pulled.box(w * 0.74, 0.006, d * 0.74, LID, x, py - U / 2 + 0.032, pz + z); });
  if (!rubin) for (const x of NVL_BOARD_X.map(bx => bx * TRAY_UNIT)) { pulled.strut([x - 0.02, py - U / 2 + 0.03, pz + NVL_CPU.z * TRAY_UNIT], [x - 0.02, py - U / 2 + 0.03, pz + NVL_GPU_Z[1] * TRAY_UNIT], 0.005, MAT.pipeBlue, 6); pulled.strut([x + 0.02, py - U / 2 + 0.03, pz + NVL_CPU.z * TRAY_UNIT], [x + 0.02, py - U / 2 + 0.03, pz + NVL_GPU_Z[1] * TRAY_UNIT], 0.005, MAT.pipeRed, 6); }
  const fanItems = [];
  if (!rubin) NVL_FAN_X.forEach(fx0 => { const x = fx0 * TRAY_UNIT, z = pz + NVL_FAN_Z * TRAY_UNIT; pulled.box(0.05, 0.03, 0.04, MAT.fan, x, py - U / 2 + 0.02, z); fanItems.push({ p: [x, py - U / 2 + 0.02, z + 0.022], axis: 'z', r: 0.018 }); });
  // Rubin's midplane (tray-rubin.js, z 1.1): the blind-mate wall between the superchip boards and the NIC/DPU bay.
  if (rubin) pulled.box(.41, .024, .004, MAT.pcbBlack, 0, py - U / 2 + 0.02, pz + 0.112);
  const pFront = new THREE.Mesh(new THREE.BoxGeometry(trayW, U * 0.94, 0.02), [MAT.rackFace, MAT.rackFace, MAT.rackFace, MAT.rackFace, new THREE.MeshStandardMaterial({ map: TEX.compute, roughness: 0.5, metalness: 0.35 }), MAT.rackFace]);
  pFront.position.set(0, py, pz + trayD / 2); scene.add(pFront);
  // Thin service-face returns leave both rows of optical cages accessible.
  // The old full-width 10 mm trim crossed the upper storage ports.
  for (const side of [-1,1]) {
    N.box(trayW,.002,.005,MAT.nickel,0,py+side*U*.46,pz+trayD/2+.012);
    N.box(.008,U*.9,.012,MAT.nickel,side*(trayW/2+.007),py,pz+trayD/2+.014);
  }
  for (const x of [-0.26, 0.26]) pulled.box(0.012, 0.012, trayD + out, MAT.galv, x, py - U / 2 + 0.006, pz - out / 2); // slide rails
  scene.add(pulled.build());
  const fans = spinners(fanItems, MAT.darkSteel, { blades: 7, speed: 8 });
  fans.mesh.userData.computeDynamic = 'rotor';
  scene.add(fans.mesh);

  // One of the nine existing switch trays is opened for service inspection.
  // Its rear remains connected to the illustrative spine through schematic
  // motion only; the service displacement is not extra production cabling.
  const sy = trayY(SWITCH_PULLED), sz = .615;
  S.box(trayW,.004,trayD,PAN,0,sy-U/2+.004,sz);
  S.box(.405,.003,.68,MAT.pcbBlack,0,sy-U/2+.009,sz-.02);
  for(const x of [-.22,.22])S.box(.004,U*.90,trayD,PAN,x,sy,sz);
  const switchPositions = rubin ? [[-.10,-.12],[.10,-.12],[-.10,.06],[.10,.06]] : [[-.11,-.08],[.11,-.08]];
  switchPositions.forEach(([x,z],i)=>{
    const silicon=MAT.silicon.clone();silicon.name=`NVLink ${rubin ? 6 : 5} switch silicon`;
    const m=new THREE.Mesh(new THREE.BoxGeometry(.085,.010,.085),silicon);
    m.name=`NVLink switch ASIC ${i+1}`;m.position.set(x,sy+.004,sz+z);scene.add(m);
    N.box(.099,.003,.099,MAT.nickel,x,sy-.003,sz+z);
    // out of the ASIC's rear edge onto the board, straight back along it (both ASICs alike, mirrored), then the
    // schematic tether to the spine, inboard of the rear frame's vertical members
    const yb=sy-U/2+.0135;
    // ...out through the tray's rear connector, back through its own empty slot (the tray is pulled for inspection)
    // and into the cable cartridge behind it: GB ASICs to the inner cartridges, Rubin's front pair to the outer ones
    const cart=Math.sign(x)*(rubin&&z>0?outerCart:innerCart),face=ZB+.08-.067;
    dataFlows.push(flow([[x,sy+.002,sz+z],[x,yb,sz+z-.05],[x,yb,sz-.33],[cart,yb,sz-.40],[cart,yb,face]],'nvl',
      {count:8,speed:.55,size:.006,trailR:.002,audit:{within:[[x-.04,yb-.02,sz-.37,x+.04,yb+.02,sz-.29],[cart-.04,sy-.03,face-.013,cart+.04,sy+.03,ZB+.125]],why:'through the tray rear NVLink connector, then its own slot connector and cartridge'}}));
  });
  // Gold removal handles as bent rod (ServeTheHome: the gold features on the
  // NVLink switch shelves are handles), not full-width trim slabs.
  for (const x of [-0.204, 0.194]) {
    for (const dy of [-0.013, 0.013]) N.box(0.008, 0.005, 0.016, TRIM, x, sy + dy, sz + trayD / 2 + 0.021);
    rbox(N, 0.011, U * 0.72, 0.006, TRIM, x, sy, sz + trayD / 2 + 0.031, { r: 0.35 });
  }
  const sf=new THREE.Mesh(new THREE.PlaneGeometry(trayW,U*.90),new THREE.MeshStandardMaterial({map:TEX.switch,roughness:.45,metalness:.45}));sf.position.set(0,sy,sz+trayD/2+.013);scene.add(sf);
  for(const x of [-.25,.25])S.box(.01,.01,1.38,MAT.galv,x,sy-U/2+.003,sz-.26);
  scene.userData.computeGeneration={id:model.accel.id,computeTrays:18,switchTrays:9,switchChipsPerTray:switchChips,openedSwitchChips:switchPositions.length,computeFans:rubin?0:6,representative:true};

  // ---------- rear: busbar, clips, NVLink spine, manifolds ----------
  const bbZ = ZB + 0.1, bbTop = trayY(TOP_SHELF) + U / 2, bbBot = trayY(0) - U / 2;
  for (const dx of [-0.018, 0.018]) S.box(0.022, bbTop - bbBot, 0.05, MAT.copper, dx, (bbTop + bbBot) / 2, bbZ);
  S.box(0.08, bbTop - bbBot, 0.012, MAT.polymer, 0, (bbTop + bbBot) / 2, bbZ + 0.035);          // insulating cover
  layout.forEach((k, i) => {
    if (k === 'mgmt') return;
    N.box(0.07, U * 0.6, 0.04, MAT.copper, 0, trayY(i), bbZ + 0.06);
    rbox(N, 0.09, U * 0.16, 0.05, MAT.darkSteel, 0, trayY(i) + U * 0.34, bbZ + 0.06, { r: 0.3 });   // busbar clip
  });
  // NVLink spine: four rear cable cartridges that every compute and switch tray
  // blind-mates into when pushed home (ServeTheHome, DGX GB200 NVL72 tour), so
  // no loose cables run from tray to cartridge. Each cartridge is drawn as a
  // folded sheet-steel cassette; its side windows, the twinax bundle behind
  // them and the connector housings are representative (ASSUMPTIONS
  // 'nvl72-spine-mechanics'). cartZ keeps the audited flow plane (cartZ - 0.067).
  const cartZ = ZB + 0.08;
  const spanLo = trayY(4) - U / 2, spanHi = trayY(30) + U / 2, spanMid = (spanLo + spanHi) / 2, spanH = spanHi - spanLo;
  const cartD = 0.05, cartC = ZB + 0.055;                                   // rear face stays at ZB + 0.03
  const CART = new THREE.MeshStandardMaterial({ color: 0x20262d, roughness: 0.46, metalness: 0.62 }); CART.name = 'NVLink cartridge sheet steel';
  const TWINAX = new THREE.MeshStandardMaterial({ color: 0x0b0c0e, roughness: 0.55, metalness: 0.1 }); TWINAX.name = 'Twinax cable jacket';
  const FOIL = new THREE.MeshStandardMaterial({ color: 0x9aa3ab, roughness: 0.35, metalness: 0.85 }); FOIL.name = 'Twinax shield foil';
  const CONTACT = new THREE.MeshStandardMaterial({ color: 0xd9b25a, roughness: 0.3, metalness: 1 }); CONTACT.name = 'Blind-mate gold contacts';
  const heavy = !quality.mobile;
  cartX.forEach(x => {
    rbox(S, 0.06, spanH, cartD, CART, x, spanMid, cartC, { r: 0.05 });
    for (const s of [-1, 1]) {
      // folded rear flange and riveted spine rail on each side
      N.box(0.002, spanH - 0.01, 0.014, COLLAR, x + s * 0.0305, spanMid, cartC - cartD / 2 + 0.008);
      if (heavy && Math.abs(x + s * 0.03) < 0.22) for (let y = spanLo + 0.04; y < spanHi - 0.02; y += 0.09) N.cylX(0.0022, 0.004, MAT.galv, x + s * 0.0325, y, cartC - cartD / 2 + 0.008, 8);
    }
    // A slotted window every four units shows the packed cable bundle. It is
    // flush with the rear face so the depth-tested NVLink cores stay clear.
    const face = cartC - cartD / 2;
    for (let y = spanLo + 0.07; y < spanHi - 0.05; y += 4 * U) {
      N.box(0.042, 0.112, 0.001, MAT.black, x, y, face - 0.0004);
      if (heavy) for (let j = 0; j < 8; j++) N.cyl(0.0021, 0.106, j % 3 === 1 ? FOIL : TWINAX, x - 0.0165 + j * 0.0047, y, face + 0.0005, 6);
    }
    // captive thumbscrews on the end caps
    for (const [y, dir] of [[spanHi, 1], [spanLo, -1]]) {
      rbox(N, 0.05, 0.008, 0.04, COLLAR, x, y + dir * 0.004, cartC, { r: 0.3 });
      N.cyl(0.0065, 0.012, MAT.galv, x, y + dir * 0.013, cartC, 12);
    }
  });
  // Blind-mate connector housings bridge the tray rear and the cartridge face.
  layout.forEach((k, i) => {
    if (k !== 'compute' && k !== 'switch') return;
    const y = trayY(i);
    cartX.forEach(cx => {
      N.box(0.044, U * 0.5, 0.016, MAT.darkSteel, cx, y, ZB + 0.09);
      N.box(0.036, 0.002, 0.012, CONTACT, cx, y + U * 0.25 + 0.001, ZB + 0.09);
    });
  });
  // The voltage tag sits on the right-hand bar's rear face in the gap between two trays' contact lands, at the
  // height the busbar close-up frames (electrical-marks.js).
  const busbarTag = { x: 0.018, y: trayY(17) + U / 2, z: bbZ };
  // Busbar: a tin-plated contact land on each bar where every tray's clip grabs it.
  const TIN = new THREE.MeshStandardMaterial({ color: 0xc9ccd0, roughness: 0.42, metalness: 0.9 }); TIN.name = 'Busbar tin-plated contact';
  layout.forEach((k, i) => {
    if (k === 'mgmt') return;
    for (const dx of [-0.018, 0.018]) N.box(0.0236, U * 0.45, 0.012, TIN, dx, trayY(i), bbZ - 0.012);
  });
  // Coolant manifolds on either side of the rear (ServeTheHome/LITEON OCP 2024),
  // with blind-mate nozzles on every liquid-cooled tray instead of loose hoses.
  // Stainless body; supply/return color only on a band at each coupler, the
  // top label and the floor valve handles so the legend stays readable. The
  // coupler type, brackets, bleed valve and floor valves are representative
  // (ASSUMPTIONS 'nvl72-manifold-hardware').
  const mX = [-0.255, 0.255], mZ = ZB + 0.075;            // 3.5 mm in front of the corner posts (z ZB + 0.0475)
  const STAINLESS = new THREE.MeshStandardMaterial({ color: 0xb9c0c7, roughness: 0.42, metalness: 0.72 }); STAINLESS.name = 'Manifold brushed stainless';
  const KNURL = new THREE.MeshStandardMaterial({ color: 0x5d646c, roughness: 0.55, metalness: 0.8 }); KNURL.name = 'Coupler knurled sleeve';
  const HOSE = new THREE.MeshStandardMaterial({ color: 0x16181b, roughness: 0.7, metalness: 0.05 }); HOSE.name = 'EPDM coolant hose';
  const mTop = bbTop + 0.1, mBot = trayY(4) - 0.08, mMid = (mTop + mBot) / 2, mLen = mTop - mBot;
  const manifoldTags = mX.map((x, side) => ({ x, y: mMid, z: mZ, side }));   // pipe markers' spots (cooling-marks.js)
  mX.forEach((x, side) => {
    const band = side ? MAT.pipeRed : MAT.pipeBlue, out = Math.sign(x);
    rbox(S, 0.045, mLen, 0.048, STAINLESS, x, mMid, mZ, { r: 0.12 });
    for (const y of [mTop, mBot]) rbox(N, 0.056, 0.012, 0.056, STAINLESS, x, y, mZ, { r: 0.3 });              // welded end caps
    N.cyl(0.006, 0.02, MAT.galv, x, mBot - 0.016, mZ, 10); N.cyl(0.009, 0.008, band, x, mBot - 0.03, mZ, 12);   // drain valve at the low point
    N.box(0.052, 0.07, 0.002, band, x, mTop - 0.06, mZ + 0.0265);                                               // supply / return label
    for (const y of [mBot + 0.06, mTop - 0.14]) N.box(0.0475, 0.018, 0.0505, band, x, y, mZ);                  // colored identification bands
    for (let y = mBot + 0.12; y < mTop - 0.05; y += 0.5) N.box(0.016, 0.022, 0.026, MAT.darkSteel, x + out * 0.0225, y, mZ - 0.026);  // mounting bracket to the corner post behind
  });
  layout.forEach((k, i) => {
    if (k !== 'compute' && k !== 'switch') return;
    const y = trayY(i);
    mX.forEach((x, side) => {
      const band = side ? MAT.pipeRed : MAT.pipeBlue;
      N.cylZ(0.008, 0.03, STAINLESS, x, y, mZ + 0.04, 12);            // coupler body
      N.cylZ(0.0105, 0.012, KNURL, x, y, mZ + 0.046, 12);              // knurled sleeve
      N.cylZ(0.0112, 0.003, COLLAR, x, y, mZ + 0.054, 12);             // latch ring
      N.cylZ(0.0118, 0.009, band, x, y, mZ + 0.033, 12);               // anodized color band
      // rigid stub to the tray's blind-mate nozzle: the tray's own rear coupling (tray.js NVL_REAR.manifoldX, tray-rubin.js RUBIN_REAR)
      N.strut([x, y, mZ + 0.057], [nozzleX[side], y, mZ + 0.057], 0.0045, STAINLESS, 8);
      N.box(0.012, 0.012, 0.016, MAT.darkSteel, nozzleX[side], y, ZB + 0.103);
    });
  });
  // Top-fed, as drawn, to match the hall's overhead rack loop (hall.js HALL_PLAN): the hall is a slab with no floor
  // void, so hoses through the floor had nowhere to go. NVIDIA's guide places the manifold inlets and outlets at the
  // rear without fixing top or bottom. Supply and return leave the manifold heads through a lever ball valve, crimped
  // ferrule and hose, rise behind the trays and exit through roof grommets to dripless couplings, inboard of the rear
  // corner posts. Hose and valve hardware are representative.
  const hoseX = x => x;                                   // straight up from the head: outboard of the rear rails, in front of the posts
  mX.forEach((x, side) => {
    const band = side ? MAT.pipeRed : MAT.pipeBlue, hx = hoseX(x);
    N.box(0.05, 0.05, 0.05, STAINLESS, x, mTop + 0.031, mZ);                        // ball valve body
    N.box(0.09, 0.012, 0.012, band, x - Math.sign(x) * 0.05, mTop + 0.031, mZ + 0.03);   // lever handle
    N.cyl(0.022, 0.03, MAT.galv, x, mTop + 0.075, mZ, 12);                          // crimped ferrule
    N.strut([x, mTop + 0.07, mZ], [hx, H + 0.03, mZ], 0.019, HOSE, 12);
    N.cyl(0.03, 0.01, GLAND, hx, H + 0.018, mZ, 16);                                 // roof grommet
    N.cyl(0.024, 0.05, STAINLESS, hx, H + 0.06, mZ, 12);                            // dripless coupling to the row loop
    N.cyl(0.0255, 0.012, band, hx, H + 0.07, mZ, 12);
  });
  // the layout the design-rule tests check (design-rules-rack-hall-site.test.ts): spine, busbar and manifolds at the rear, mirrored
  scene.userData.rackPlan = { frontZ: ZF, rearZ: ZB, depth: D, cartridgeX: cartX, cartridgeZ: cartC, busbarZ: bbZ, manifoldX: mX, manifoldZ: mZ, nozzleX,
    coolantFeed: 'top', hoses: mX.map(x => ({ x: hoseX(x), top: H + 0.03 })), roofY: H, trayRearZ: ZF - 0.07 - trayD, representative: true,
    shelves: layout.filter(k => k === 'ps').length, trayHalfWidth: trayW / 2,
    // boxes as [x0, z0, x1, z1] in plan, for the collision rule: the right-hand rear corner post, rear rail and manifold
    rearCorner: { post: [X - 0.02 - 0.0175, ZB + 0.03 - 0.0175, X - 0.02 + 0.0175, ZB + 0.03 + 0.0175], rail: [0.227 - 0.004, ZB + 0.1 - 0.006, 0.227 + 0.004, ZB + 0.1 + 0.006],
      manifold: [mX[1] - 0.0225, mZ - 0.024, mX[1] + 0.0225, mZ + 0.024], cartridge: [outerCart - CART_HALF, cartC - cartD / 2, outerCart + CART_HALF, cartC + cartD / 2] } };


  // ---------- feed from the busway above ----------
  // 2N: the A feed comes from a busway over the rack's rear quarter, the B feed from a second busway over its front
  // quarter (the hall draws the same pair over every row, hall.js HALL_PLAN), each through its own tap-off.
  const stripe = glowMat(feedV === 'hvdc' ? '#d8f04a' : '#ff8a3d', 0.9);
  busway(scene, S, N, [FEED.A.tapX], stripe, H, { bz: FEED.A.bz, labels: ['A'], grommets: false });
  busway(scene, S, N, [FEED.B.tapX], stripe, H, { bz: FEED.B.bz, labels: ['B'], grommets: false });
  // Each cord drops from its tap to the roof, is dressed along the roof to a brush grommet over the rear cable
  // space, and runs down that space (between the bus bar and the cable cartridges, behind the trays) with a short
  // whip into the rear inlet of each of its four shelves: A feeds shelves 0-1 and 31-32, B shelves 2-3 and 33-34
  // (N+N, as drawn). Nothing crosses a tray.
  const CORD = MAT.black.clone(); CORD.name = 'Rack feed cable';
  for (const f of [FEED.A, FEED.B]) {
    const path = feedPath(f);
    for (let k = 1; k < path.length; k++) N.strut(path[k - 1], path[k], 0.012, CORD, 8);
    N.cyl(0.03, 0.01, GLAND, f.x, H + 0.018, FEED.z, 16); N.cyl(0.022, 0.012, MAT.black, f.x, H + 0.02, FEED.z, 16);   // brush grommet
    for (const r of f.shelves) {
      N.strut([f.x, trayY(r), FEED.z], [f.x, trayY(r), FEED.inletZ - 0.008], 0.009, CORD, 8);
      N.box(0.03, U * 0.55, 0.016, MAT.darkSteel, f.x, trayY(r), FEED.inletZ);                               // shelf AC inlet
    }
  }

  // ---------- data: scale-out fiber up the front, runway overhead along the row (as in the hall) ----------
  const fx = 0.27, fz = ZF - 0.03, RW = ROW_RUNWAY;
  S.box(RW.length,.03,RW.width,MAT.yellowTray,RW.x,RW.floorY,RW.z); for(const side of [-1,1]) S.box(RW.length,.1,.012,MAT.yellowTray,RW.x,3.66,RW.z+side*.14);

  scene.add(S.build()); scene.add(N.build({ cast: false }));

  // Rear-face teaching overlays remain depth-tested. Put the motion on the
  // exposed cartridge face so the opaque cartridge does not hide its own route.
  // Scale-up: NVLink up and down the cable cartridges, and out of a few trays.
  cartX.forEach((cx, c) => {
    const [a, b] = c % 2 ? [spanLo, spanHi] : [spanHi, spanLo];
    dataFlows.push(flow([[cx, a, cartZ - 0.067], [cx, b, cartZ - 0.067]], 'nvl', { count: 26, speed: 0.3, size: 0.009, k: 2.4, trail: false }));
  });
  // Out of a tray: each tray has a blind-mate NVLink connector in front of each cartridge; every link leaves the tray
  // through its own connector and runs straight back into the cartridge behind it (declared), onto its rear face.
  [5, 9, 13, 17, 23, 27].forEach(i => cartX.forEach(cx => dataFlows.push(flow([[cx, trayY(i), ZB + 0.12], [cx, trayY(i), cartZ - 0.067]], 'nvl',
    { count: 2, speed: 0.15, size: 0.007, k: 2.4, trail: false, audit: { within: [[cx - 0.04, trayY(i) - 0.03, cartZ - 0.08, cx + 0.04, trayY(i) + 0.03, ZB + 0.125]], why: 'out of its own tray through its own NVLink connector into the cartridge behind it' } }))));

  // ---------- flows ----------
  // the feeds ride inside their drawn cables: down from the tap, along the roof, down the rear cable space, into a shelf
  for (const f of [FEED.A, FEED.B]) {
    flows.push(flow(feedPath(f), feedV, { count: 14, speed: 0.35, size: 0.012, trailR: 0.004,
      audit: { within: [[f.x - 0.03, H - 0.06, FEED.z - 0.03, f.x + 0.03, H + 0.045, FEED.z + 0.03]], why: 'through the roof at its brush grommet' } }));
    for (const r of [f.shelves[1], f.shelves.at(-1)]) flows.push(flow([[f.x, trayY(r), FEED.z], [f.x, trayY(r), FEED.inletZ]], feedV, { count: 2, speed: 0.15, size: 0.008, trail: false }));
  }
  // DC: from shelves onto the busbar, up and down the bar
  // Close rear views sit at the pulse screen-size ceiling, so these rails are
  // dimmed rather than shrunk: the bars, contact lands and cartridges stay readable.
  const busDC = { count: 42, speed: 0.22, size: 0.009, trailR: 0.003, k: 1.5, opacity: 0.72 };
  flows.push(flow([[-0.018, trayY(33), bbZ - 0.045], [-0.018, bbBot + 0.1, bbZ - 0.045]], 'dc', busDC));
  flows.push(flow([[0.018, trayY(1), bbZ - 0.045], [0.018, bbTop - 0.1, bbZ - 0.045]], 'dc', busDC));
  // DC into the pulled tray
  flows.push(flow([[0, py, bbZ + 0.06], [0, py, ZB + 0.3], [0, py - U / 2 + 0.03, pz - 0.2]], 'dc', { count: 8, speed: 0.2, size: 0.008, trailR: 0.003 }));
  // coolant
  // Coolant runs as a thin line along the inboard edge of each manifold's rear
  // face (the NVLink cartridges leave no room beside it), so most of the
  // stainless body and its couplers stay visible behind the motion.
  const mIn = [mX[0] + 0.015, mX[1] - 0.015], mFz = mZ - 0.045;          // clear of the face by 1.6 x the heat core radius
  const coolRail = { count: 26, speed: 0.25, size: 0.005, k: 1.5, opacity: 0.8, trail: false };
  flows.push(flow([[mIn[0], bbTop + 0.05, mFz], [mIn[0], bbBot, mFz]], 'cool', coolRail));
  flows.push(flow([[mIn[1], bbBot, mFz], [mIn[1], bbTop + 0.05, mFz]], 'warm', coolRail));
  // The illustrated system is top-fed: supply enters at the top and falls, return rises to the top, in both layers.
  // Two heat paths leave the rack: the liquid share in the manifolds and their tray branches, the rest as air.
  const rackW = model.rack.kw * 1000, waterW = rackW * model.accel.liquidShare, airW = rackW - waterW;
  const water = f => tagHeat(f, 'rack-water', waterW, 'carrier'), airPath = f => tagHeat(f, 'rack-air', airW, 'carrier');
  heatFlows.push(water(flow([[hoseX(mX[0]), H + 0.1, mZ], [hoseX(mX[0]), mTop + 0.16, mZ], [mIn[0], bbTop + 0.05, mFz], [mIn[0], bbBot - 0.1, mFz]], 'cool', { count: 34, speed: 0.3, size: 0.011, k: 2.4, trailR: 0.005, trailK: 0.45 })));
  heatFlows.push(water(flow([[mIn[1], bbBot - 0.1, mFz], [mIn[1], bbTop + 0.05, mFz], [hoseX(mX[1]), mTop + 0.16, mZ], [hoseX(mX[1]), H + 0.1, mZ]], 'warm', { count: 34, speed: 0.3, size: 0.011, k: 2.4, trailR: 0.005, trailK: 0.45 })));
  [5, 10, 15, 19, 23, 28].forEach(i => {
    heatFlows.push(water(flow([[mX[0], trayY(i), mZ + 0.06], [nozzleX[0], trayY(i), ZB + 0.18], [-0.1, trayY(i), 0]], 'cool', { count: 3, speed: 0.25, size: 0.016, k: 2.6, trail: false })));
    heatFlows.push(water(flow([[0.1, trayY(i), 0], [nozzleX[1], trayY(i), ZB + 0.18], [mX[1], trayY(i), mZ + 0.06]], 'warm', { count: 3, speed: 0.25, size: 0.016, k: 2.6, trail: false })));
  });
  // the air share: power shelves, switches, optics exhaust out the back
  const airRow = [1, 7, 13, 17, 21, 26, 33];
  const airShare = model.accel.liquidShare < 0.99;
  if (airShare) for (const i of airRow) for (const x of [-0.15, 0.05, 0.2]) heatFlows.push(airPath(flow([[x, trayY(i), 0.2], [x, trayY(i) + 0.02, ZB], [x * 1.2, trayY(i) + 0.12, ZB - 0.7]], 'air', { count: 4, speed: 0.35, size: 0.024, k: 2.4, opacity: 0.9, trail: false })));
  balanceHeat(heatFlows);
  // coolant along the drawn hoses (supply and return struts above), Grace's plate to the rear GPU's; Rubin draws no hoses
  const hoseFront = pz + NVL_CPU.z * TRAY_UNIT, hoseRear = pz + NVL_GPU_Z[1] * TRAY_UNIT;
  if (!rubin) for (const x of NVL_BOARD_X.map(bx => bx * TRAY_UNIT)) {
    flows.push(flow([[x - 0.02, py - U / 2 + 0.035, hoseRear], [x - 0.02, py - U / 2 + 0.035, hoseFront]], 'cool', { count: 6, speed: 0.15, size: 0.006, trail: false }));
    flows.push(flow([[x + 0.02, py - U / 2 + 0.035, hoseFront], [x + 0.02, py - U / 2 + 0.035, hoseRear]], 'warm', { count: 6, speed: 0.15, size: 0.006, trail: false }));
  }
  flows.forEach(f => scene.add(f.group));
  dataFlows.forEach(f => scene.add(f.group));
  heatFlows.forEach(f => scene.add(f.group));

  // ---------- activity: status LEDs on trays and shelves, warm shimmer off the air share ----------
  const ledStep = quality.mobile ? 3 : 1;
  const ledItems = [], portLeds = [];
  layout.forEach((k, i) => {
    if (i === PULLED || i % ledStep !== 0) return;
    if (k === 'compute' || k === 'switch') ledItems.push({ p: [0.222, trayY(i), ZF - 0.066], color: '#5cf29a', rate: 0.35 + (i % 5) * 0.15, duty: 0.5 });
    else if (k === 'ps') ledItems.push({ p: [0.2, trayY(i), ZF - 0.066], color: '#ffcf5c', rate: 0.25, duty: 0.6 });
    else if (k === 'mgmt') for (let b = 0; b < 4; b++) portLeds.push({ p: [-0.22 + (140 + b * 170 + 64) / 1024 * 0.44, trayY(i) + U * 0.36, ZF - 0.067], color: '#5cf29a', rate: 1.3 + b * 0.37 + i * 0.1, duty: 0.35 });
  });
  const leds = blinkers(ledItems, { size: 0.007 }), links = blinkers(portLeds, { size: 0.0032 });
  scene.add(links.mesh);
  scene.add(leds.mesh);
  let haze = null;
  if (airShare) {
    const emit = (quality.mobile ? airRow.filter((_, i) => i % 2 === 0) : airRow).map(i => ({ p: [0, trayY(i) + 0.02, ZB - 0.1], dir: [0, 1, 0] }));
    // the air share's haze, on the same log rule as the streams (src/heat.js)
    haze = plumes(emit, { perEmitter: quality.mobile ? 5 : 12, size: 0.04, grow: 2.2, life: 2.4, rise: 0.28, drift: [0, 0.12, -0.4], spread: 0.04, color: AIR_HAZE, opacity: heatIntensity(0.12, airW, waterW), additive: true });
    scene.add(haze.points);
  }

  // Rear three-quarter across both manifolds: the card says "blue in, red out",
  // so the supply and the return stand either side of the busbar in one frame,
  // low enough that their colored bands, couplers and floor valves read.
  const manifoldHot = { pos: [mX[1], trayY(7), mZ], view: componentView([0, trayY(5), mZ], [-0.22, 0.16, -0.9], [0.56, 0.3, 0.1]) };
  // Rear three-quarter on the cartridges: their side windows and blind-mate
  // housings read beside the busbar instead of a flat rear elevation.
  const spineHot = { pos: [0.2, trayY(19), cartZ], view: componentView([0.1, trayY(17), ZB + 0.06], [0.85, 0.3, -0.95], [0.5, 0.75, 0.25]) };
  // The power layer's glow (src/power-glow.js): each tray face in the rack by what it draws (a compute tray's share of
  // the 50 V bus, a switch tray's share of the NVLink switching, a power shelf's share of the rack's conversion loss),
  // and inside the two pulled trays their GPUs, CPUs, fans and switch chips. Faces lie just proud of each tray front,
  // with a tight margin so a tray never lights its neighbours.
  const A_ = model.accel, R_ = model.rack, PD = [];
  const trayW_ = { compute: (R_.dcBusKW - A_.scaleupKW - A_.busbarKW) * 1000 / 18, switch: A_.scaleupKW * 1000 / 9, ps: R_.convKW * 1000 / 8 };
  const PART = { compute: 'compute', switch: 'nvswitch', ps: 'shelves' };
  layout.forEach((k, i) => {
    if (!trayW_[k] || i === PULLED || i === SWITCH_PULLED) return;
    PD.push({ id: `${k}-${i}`, part: PART[k], watts: trayW_[k], at: [0, trayY(i), ZF - 0.07 + 0.004], size: [trayW, U * 0.9], normal: [0, 0, 1], margin: 0.008, fill: 0.04 });
  });
  const floor = py - U / 2 + 0.0085;
  // Each plate by what it actually covers: a GPU on gpuW, Grace/Vera on cpuW; the rack's NIC/DPU share (as the tray
  // level's cold plates split it, tray-rubin.js) on Rubin's NIC-board and DPU plates.
  const nicDpuW = rubin ? A_.nicKW * 1000 / 18 : 0;
  const plateW = { gpu: A_.gpuW, cpu: A_.cpuW, nic: nicDpuW * 4 / 10, dpu: nicDpuW * 2 / 10 };
  plates.forEach(({ x, z, w, d, kind }, i) => PD.push({ id: `pulled-${kind}-${i}`, part: 'compute', watts: plateW[kind], volt: kind === 'gpu' || kind === 'cpu' ? 'core' : undefined, at: [x, floor, pz + z], size: [w * 0.9, d * 0.9] }));
  fanItems.forEach((f, i) => PD.push({ id: `pulled-fan-${i}`, watts: A_.otherKW * 1000 / 18 / 10, at: [f.p[0], py - U / 2 + 0.0045, f.p[2]], size: [0.05, 0.04] }));
  switchPositions.forEach(([x, z], i) => PD.push({ id: `pulled-switch-${i}`, part: 'nvswitch', watts: A_.scaleupKW * 1000 / 9 / switchPositions.length, at: [x, sy - 0.0015, sz + z], size: [0.099, 0.099] }));
  return {
    manifoldTags,
    busbarTag,
    scene, flows, powerDraw: PD,
    camera: { pos: [3.1, 2.3, -3.7], target: [0, 1.1, -0.1], near: 0.01, far: 200, min: 0.4, max: 9 },
    hotspots: {
      feed: { pos: [-0.12, 3.03, -0.165], view: { pos: [1.2, 3.1, 1.0], target: [0, 2.7, 0] } },
      shelves: { pos: [0.25, trayY(33), ZF - 0.05], view: { pos: [0.7, 1.9, 1.5], target: [0, trayY(33), ZF] } },
      busbar: { pos: [0.03, trayY(11), bbZ], view: { pos: [0.9, 1.3, -1.3], target: [0, 0.9, bbZ] } },
      compute: { pos: [0.2, py + 0.03, pz + 0.2], view: { pos: [0.6, 1.8, 1.7], target: [0, py, pz] } },
      nvswitch: { pos: [-.12, sy + .04, sz], view: { pos: [.65, sy + .75, sz + 1.0], target: [0, sy, sz] } },
      spine: spineHot,
      manifold: manifoldHot,
    },
    dataFlows, heatFlows,
    heatHotspots: {
      manifold: manifoldHot,
      rearair: { pos: [0.05, trayY(21), ZB - 0.4], view: { pos: [1.6, 1.6, -2.0], target: [0, 1.0, ZB - 0.3] } },
      compute: { pos: [0.2, py + 0.03, pz + 0.2], view: { pos: [0.6, 1.8, 1.7], target: [0, py, pz] } },
    },
    dataHotspots: {
      tp: { pos: [-0.2, trayY(16), ZF - 0.05], view: { pos: [1.2, 1.4, 2.2], target: [0, 1.0, 0] } },
      nvswitch: { pos: [-.12, sy + .04, sz], view: { pos: [.65, sy + .75, sz + 1.0], target: [0, sy, sz] } },
      spine: spineHot,
      uplinks: { pos: [fx, H + 0.2, fz], view: { pos: [1.3, 2.9, 2.2], target: [0.2, 2.2, fz] } },
      // Front cage rows, fiber managers and the patch strip, with the opened
      // tray's seated modules in frame: scale-out optics, set against copper.
      optical: { pos: [-0.195, trayY(28) - 0.009, ZF - 0.02], view: componentView([0.06, 1.4, ZF - 0.06], [0.75, 0.3, 0.95], [0.62, 1.05, 0.4]) },
      compute: { pos: [0.2, py + 0.03, pz + 0.2], view: { pos: [0.6, 1.8, 1.7], target: [0, py, pz] } },
      mgmt: { pos: [0.22, trayY(36), ZF - 0.03], view: componentView([0.02, trayY(35) + U / 2, ZF - 0.02], [0.32, 0.16, 0.9], [0.5, 0.15, 0.2]) },
    },
    look: LOOK,
    update(t) {
      leds.update(t); links.update(t);
      if (haze) { haze.points.visible = state.mode === 'heat'; if (haze.points.visible) haze.update(t); }
      fans.update(t);
    },
  };
}
