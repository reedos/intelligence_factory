// Scene 4: one compute tray, lid off. World unit = 10 cm (the tray is 4.4 units wide).
// Front faces +z. NVL72 racks: two superchip boards, each one CPU and two GPUs.
// H100: a DGX H100 server cut open along one side: the GPU tray on top, the motherboard tray under it, the supplies
// across the bottom of the rear and a midplane behind the front fans (dgx-h100-layout.js).
import { THREE, MAT, Builder, flow, canvasTex, texMat, glowMat, spinners } from '../kit.js';
import { rbox, tube, bundle, blinkers, plumes } from '../fx.js';
import { buildRubin } from './tray-rubin.js';
import { computeMaterials, finishCompute, coldPlateDetail, boardFinish } from './compute-finish.js';
import { frameCompute } from './compute-framing.js';
import { componentView } from '../app/housing-frame.js';
import { printDecals, textTexture } from './print-kit.js';
import { nicLabel, labelLines } from './lid-labels.js';
import { etch, GPU_NAME } from './package-marks.js';
import { DGX } from './dgx-h100-layout.js';
import { tagHeat, balanceHeat, heatIntensity, PART_W } from '../heat.js';
import { FABRICS } from '../model/engine.ts';
import { trayPackage, packageLog } from './gpu-package.js';

// Printed lid labels on the modules seated in the NIC cages: the scenario's NIC-side class (lid-labels.js).
export function trayLidLabels(scene, accel, placements, size) {
  return printDecals(scene, { texture: textTexture(labelLines(nicLabel(accel)), { px: 96, aspect: 2, ink: '#474d55', pad: .05 }),
    size, placements, lift: .0006, name: 'NIC module lid labels', material: { roughness: .7, metalness: .25 } });
}

// Package top: dark molded substrate, a laser-etched field and a generic name
// (no logos or part numbers). 512 px so the text stays crisp at part cameras.
export function pkgTex(label) {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#16181c'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1f2227'; g.fillRect(18, 18, w - 36, h - 36);
    g.strokeStyle = 'rgba(160,170,182,0.35)'; g.lineWidth = 2; g.strokeRect(34, 34, w - 68, h - 68);
    g.fillStyle = 'rgba(150,160,172,0.18)'; for (let i = 0; i < 3; i++) g.fillRect(48, h - 150 + i * 16, 150 - i * 30, 5);
    g.fillStyle = '#9aa3ae'; g.font = '600 40px system-ui, sans-serif'; g.fillText(label, 48, h - 52);
  });
}
// Bare die backside: near-black polished silicon with a faint thin-film tint
// that shifts across the face, and a thin seal-ring border. Representative
// appearance, matching published package photos (dark and specular, not blue).
export function dieTex() {
  return canvasTex(512, 640, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, '#121419'); gr.addColorStop(0.42, '#1b1e2a'); gr.addColorStop(0.58, '#1f1c2b'); gr.addColorStop(1, '#101216');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const sheen = g.createLinearGradient(0, h, w, 0);
    sheen.addColorStop(0.2, 'rgba(90,110,190,0)'); sheen.addColorStop(0.5, 'rgba(120,100,200,0.10)'); sheen.addColorStop(0.8, 'rgba(90,150,170,0)');
    g.fillStyle = sheen; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(170,176,196,0.28)'; g.lineWidth = 3; g.strokeRect(6, 6, w - 12, h - 12);
    g.strokeStyle = 'rgba(170,176,196,0.08)'; g.lineWidth = 1; g.strokeRect(16, 16, w - 32, h - 32);
  });
}

// ---------- shared decoration helpers (product-shot detail; no logos, no invented numbers) ----------
// stiffener frame around a package (the die and memory stay visible), with corner screws
function ihsLid(S, N, x, y, z, w, d, heavy, band = 0.035) {
  for (const s of [-1, 1]) { S.box(w, 0.022, band, MAT.nickel, x, y, z + s * (d / 2 - band / 2)); S.box(band, 0.022, d - 2 * band, MAT.nickel, x + s * (w / 2 - band / 2), y, z); }
  if (heavy) for (const sx of [-1, 1]) for (const sz of [-1, 1]) N.cyl(0.014, 0.01, MAT.black, x + sx * (w / 2 - 0.03), y + 0.014, z + sz * (d / 2 - 0.03), 8);
}
// a ring of small decoupling capacitors around a package footprint
function capField(N, x, z, y, r, n, size = 0.02) {
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; N.cyl(size, size * 1.4, MAT.black, x + Math.cos(a) * r, y, z + Math.sin(a) * r, 6); }
}
// a row of gold SXM / board-to-board connector pins along one edge
function connectorPins(N, x0, x1, y, z, n) {
  for (let i = 0; i < n; i++) N.box(0.018, 0.014, 0.05, MAT.gold, x0 + (x1 - x0) * (i / (n - 1)), y, z);
}
// a bright metal cap on top of a VRM inductor can (no labels)
function inductorTop(N, x, y, z, s) { N.box(s * 0.72, 0.012, s * 0.72, MAT.alu, x, y, z); }
// small heatsink fins on top of an OSFP cage
function cageFins(N, x, y, z, w, d, count = 4) {
  for (let f = 0; f < count; f++) N.box(w / count * 0.62, 0.09, d * 0.9, MAT.alu, x - w / 2 + (f + 0.5) * (w / count), y, z);
}
// a couple of light chip packages on the outward face of a memory module
function dimmChips(N, x, y0, z0, dz, n, side) {
  for (let i = 0; i < n; i++) N.box(0.012, 0.1, dz * 0.6, MAT.hbm, x + side * 0.017, y0, z0 + (i - (n - 1) / 2) * dz * 1.15, 0);
}

// Flat twinax flyover ribbon: conductor pairs side by side under one jacket,
// swept along a smooth path in a y-z plane (its width runs along x). The top
// carries one shallow lobe per pair so the ribbon reads as cable, not a strip.
const twinaxJacket = new THREE.MeshStandardMaterial({ color: 0x24282e, roughness: 0.42, metalness: 0.15 });
twinaxJacket.name = 'Twinax flyover jacket';
function ribbon(B, pts, width, thick, { pairs = 8, steps = 26 } = {}) {
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)), false, 'centripetal');
  const hw = width / 2, per = 3, prof = [[-hw, -thick / 2], [hw, -thick / 2]];
  for (let k = 0; k <= pairs * per; k++) {
    const s = hw - width * k / (pairs * per), f = (k % per) / per;
    prof.push([s, thick / 2 * (0.62 + 0.38 * Math.sin(Math.PI * f))]);
  }
  const X = new THREE.Vector3(1, 0, 0), pos = [], idx = [], n = prof.length;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, p = curve.getPointAt(t), up = curve.getTangentAt(t).cross(X).normalize();
    if (up.y < 0) up.negate();
    for (const [s, h] of prof) pos.push(p.x + s, p.y + up.y * h, p.z + up.z * h);
  }
  for (let i = 0; i < steps; i++) for (let j = 0; j < n; j++) {
    const a = i * n + j, b = i * n + (j + 1) % n, c = a + n, d = b + n;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return B.addM(g, twinaxJacket, new THREE.Matrix4());
}
// A cable-to-board connector: low receptacle on the board, the cable plug
// seated in it, and a latch (GB300) or a pull tab (GB200, DensiLink-style).
function cableHead(S, N, x, yTop, z, style, w = 0.15, dir = 1) {
  S.box(w, 0.022, 0.075, MAT.black, x, yTop + 0.011, z);
  S.box(w - 0.02, 0.03, 0.068, MAT.pcbBlack, x, yTop + 0.037, z);
  if (style === 'densilink') N.box(w / 3, 0.004, 0.07, MAT.polymer, x, yTop + 0.054, z + 0.03 * dir);
  else N.box(w * 0.66, 0.004, 0.045, MAT.nickel, x, yTop + 0.054, z);
}
// NIC SerDes leave the NIC board on internal cable assemblies and land on the
// board that carries the front optical cages (GB300: one per OSFP board port;
// GB200: DensiLink from the mezzanine). Routing and connector shapes are
// representative; the cable count is one assembly per port.
function nicFlyovers(S, N, ports, { nicTop, cageTop, zNic, zCage, style, clips, width = 0.1, clipZ }) {
  const dir = Math.sign(zCage - zNic);
  for (const x of ports) {
    cableHead(S, N, x, nicTop, zNic, style, width + 0.05, dir);
    cableHead(S, N, x, cageTop, zCage, style, width + 0.05, -dir);
    const a = nicTop + 0.052, b = cageTop + 0.052, crest = Math.max(a, b) + 0.03;
    ribbon(N, [[x, a, zNic + 0.02 * dir], [x, crest, zNic + 0.08 * dir], [x, crest - 0.008, (zNic + zCage) / 2 + 0.03 * dir], [x, b + 0.03, zCage - 0.035 * dir], [x, b, zCage - 0.01 * dir]], width, 0.012);
  }
  // dressing: a molded tie-bar over the ribbons, its legs on the NIC board's front edge
  for (const [x0, x1] of clips) {
    const y = Math.max(nicTop, cageTop) + 0.052 + 0.03 + 0.012, z = clipZ ?? zNic + 0.075 * dir;
    N.box(x1 - x0, 0.01, 0.028, MAT.black, (x0 + x1) / 2, y, z);
    for (const x of [x0, x1]) N.box(0.014, y - nicTop, 0.022, MAT.black, x, (y + nicTop) / 2, z);
  }
}

// Surface-mount passives: 0402 and 0201 ceramic capacitors (tan body) and thick-
// film resistors (black body) with tinned end terminations, placed in the rows
// and clusters a board designer puts around packages and regulator phases.
// Positions are representative; see assumption 'tray-mechanical-detail'.
const passiveMats = {
  cap: Object.assign(new THREE.MeshStandardMaterial({ color: 0x8a7556, roughness: 0.55, metalness: 0.02 }), { name: 'PCB passive body' }),
  res: Object.assign(new THREE.MeshStandardMaterial({ color: 0x141517, roughness: 0.5, metalness: 0.05 }), { name: 'PCB passive resistor' }),
  term: Object.assign(new THREE.MeshStandardMaterial({ color: 0xb4b8bb, roughness: 0.32, metalness: 0.9 }), { name: 'PCB passive termination' }),
};
function smd(N, x, y, z, alongZ, small, resistor) {
  const L = small ? 0.006 : 0.01, w = small ? 0.003 : 0.005, h = small ? 0.0025 : 0.0035;
  const [bw, bd] = alongZ ? [w, L * 0.6] : [L * 0.6, w];
  N.box(bw, h, bd, resistor ? passiveMats.res : passiveMats.cap, x, y + h / 2, z);
  for (const s of [-1, 1]) {
    const [tw, td] = alongZ ? [w * 1.02, L * 0.2] : [L * 0.2, w * 1.02];
    N.box(tw, h * 1.04, td, passiveMats.term, x + (alongZ ? 0 : s * L * 0.4), y + h * 0.52, z + (alongZ ? s * L * 0.4 : 0));
  }
}
// a row of n parts from a to b; every third one a resistor, a few 0201s mixed in
function smdRow(N, y, [x0, z0], [x1, z1], n, alongZ, seed = 1) {
  let s = seed * 9301 + 49297;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    if (r() < 0.12) continue;
    smd(N, x0 + (x1 - x0) * t, y, z0 + (z1 - z0) * t, alongZ, r() < 0.3, i % 3 === 2);
  }
}
// decoupling rows around a package footprint (w x d), g = gap outside its edge
function smdFrame(N, y, x, z, w, d, g, pitch, seed) {
  const nx = Math.max(2, Math.round(w / pitch)), nz = Math.max(2, Math.round(d / pitch));
  for (const s of [-1, 1]) {
    smdRow(N, y, [x - w / 2, z + s * (d / 2 + g)], [x + w / 2, z + s * (d / 2 + g)], nx, true, seed + s);
    smdRow(N, y, [x + s * (w / 2 + g), z - d / 2], [x + s * (w / 2 + g), z + d / 2], nz, false, seed + 3 + s);
  }
}

// Representative folded sheet-metal lip on an intact chassis side. Cutaway
// edges intentionally do not get this finish. Fine captive screws are desktop
// detail only; the lip stays clear of the central airflow and all board routes.
function chassisLip(N, wallX, topY, depth, inward, heavy) {
  const x = wallX + inward * 0.014;
  rbox(N, 0.058, 0.016, depth - 0.06, MAT.galv, x, topY - 0.006, 0, { r: 0.35 });
  if (heavy) for (const z of [-depth / 2 + 0.3, depth / 2 - 0.3]) {
    N.cyl(0.018, 0.007, MAT.nickel, x, topY + 0.005, z, 10);
    N.box(0.022, 0.002, 0.004, MAT.black, x, topY + 0.009, z);
  }
}

// Rear NVLink connector (shared by the NVL72 builders): black housing, a thin
// shroud, recessed contact rows on the rear mating face, guide pins.
export function nvConnector(S, N, x, y, z, w = 0.5, h = 0.24, d = 0.32) {
  S.box(w - 0.04, h - 0.04, d, MAT.black, x, y, z);
  for (const s of [-1, 1]) { S.box(w, 0.016, d, MAT.galv, x, y + s * (h / 2 - 0.008), z); S.box(0.016, h - 0.032, d, MAT.galv, x + s * (w / 2 - 0.008), y, z); }
  for (let r = 0; r < 3; r++) N.box(w - 0.16, 0.012, 0.012, MAT.gold, x, y - 0.05 + r * 0.05, z - d / 2 + 0.004);
  for (const s of [-1, 1]) N.cylZ(0.012, 0.07, MAT.nickel, x + s * (w / 2 - 0.05), y, z - d / 2 - 0.02, 10);
}

export function build(opts) {
  const result = opts.model.accel.id === 'rubin' ? buildRubin(opts, { lights, pkgTex, dieTex, nvConnector, trayLidLabels }) : opts.model.accel.gpusPerRack === 72 ? buildNVL(opts) : buildHGX(opts);
  frameCompute(result, 'tray', opts.model.accel.id);
  modeAccents(result, opts.state);
  return result;
}

// Heat mode already has warm volumetric glow; power and data sat on a flatter,
// darker board. Two low accent lights (a cool edge rim from the rear and a soft
// warm counter-fill) give those layers the same depth. Off in heat mode.
function modeAccents(result, state) {
  const rim = new THREE.DirectionalLight(0x8fd0ff, 0), warm = new THREE.DirectionalLight(0xe6ba82, 0);
  rim.name = 'Tray layer rim'; warm.name = 'Tray layer counter-fill';
  rim.position.set(7, 3.2, -8); warm.position.set(-7, 2.4, 6);
  result.scene.add(rim, warm);
  const apply = () => { const mode = state?.mode; rim.intensity = mode === 'heat' ? 0 : 0.95; warm.intensity = mode === 'power' ? 0.55 : mode === 'data' ? 0.3 : 0; };
  apply();
  const update = result.update;
  result.update = (t, dt) => { apply(); return update?.(t, dt); };
}

function lights(scene, quality) {
  scene.background = new THREE.Color(0x0a0d13);
  scene.add(new THREE.HemisphereLight(0xb8c6e4, 0x121418, 0.85));
  // product-shot macro lighting: a strong key for crisp speculars on copper and nickel, plus a cool rim
  const key = new THREE.DirectionalLight(0xfff2df, 2.5); key.position.set(4, 9, 6); key.target.position.set(0, 0, 0);
  if (quality.shadows) { key.castShadow = true; key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30 }); key.shadow.bias = -0.0003; key.shadow.normalBias = 0.01; }
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0x7fa8ff, 1.2); rim.position.set(-6, 4, -7); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffdcb0, 0.55); fill.position.set(-3, 3.5, 5); scene.add(fill);
  const under = new THREE.DirectionalLight(0x6f7f9c, 0.5); under.position.set(2, -3, -4); scene.add(under);
}

// ---------- DGX H100: 8U, air-cooled ----------
// NVIDIA's DGX H100 user guide figures (research/dgx-h100-2026-10-01.md): seen from the rear, the GPU tray fills the
// top, the motherboard tray sits under it and the six supplies run across the bottom. Twelve fan modules cover the
// front above a strip of eight U.2 drives and the console board. Both trays slide in from the rear and plug into a
// midplane behind the fans ("Midplane connectivity: Power, PCIe, sensors and signaling communications"). Inside the
// motherboard tray, rear to front: PCIe risers and the four OSFP cages, the two CPUs with 32 DIMMs, the two
// network modules (four ConnectX-7 each) on the interposer board, the midplane connectors. Inside the GPU tray,
// rear to front: four NVSwitches, the 2 x 4 GPU grid, the midplane. Depths, the midplane's openings, the power
// distribution under the motherboard tray and the PCIe switch positions are representative.

function buildHGX({ quality, model }) {
  const scene = new THREE.Scene();
  lights(scene, quality);
  const flows = [], dataFlows = [], heatFlows = [];
  const S = new Builder(), N = new Builder();
  const finish = computeMaterials();
  const { W, D, H, ZF, ZB, ZM, my, gy, gpuX, gpuZ, swX, swZ, connX, cpuX, cpuZ, bankX, modX, modZ, ny, pcieX, pcieZ, cageX, cageY, psuX, psuY, fanX, fanY, driveX, driveY, busX } = DGX;
  const heavy = !quality.mobile;
  const statusLeds = [], hotTops = [];
  // Vertical boards (midplane, risers, backplanes) keep a plain mask: the painted atlas is a top-down projection.
  const vBoard = Object.assign(new THREE.MeshStandardMaterial({ color: 0x0f3a2b, roughness: 0.55, metalness: 0.08 }), { name: 'Vertical board mask' });

  // ---------- chassis: floor, far wall, rear frame; lid off, the near wall cut down to the supplies, like a section ----------
  S.box(W, 0.03, D, MAT.galv, 0, 0.015, 0);
  S.box(0.03, H, D, MAT.galv, -W / 2, H / 2, 0);
  const CUT = 0.45;
  S.box(0.03, CUT, D, MAT.galv, W / 2, CUT / 2, 0); N.box(0.034, 0.02, D, glowMat('#d9dde2', 0.8), W / 2, CUT + 0.01, 0);
  S.box(W, .08, .03, MAT.galv, 0, H - .04, ZB);
  for (const x of [-W / 2 + .03, W / 2 - .03]) S.box(.06, H - .08, .03, MAT.galv, x, (H - .08) / 2, ZB);
  chassisLip(N, -W / 2, H, D, 1, heavy);

  // ---------- front: twelve fan modules (4 x 3) over eight U.2 drives and the console board ----------
  const rotors = [];
  for (const y of fanY) for (const x of fanX) {
    for (const s of [-1, 1]) { S.box(1.04, 0.03, 0.7, MAT.fan, x, y + s * 0.48, ZF - 0.36); S.box(0.03, 0.93, 0.7, MAT.fan, x + s * 0.505, y, ZF - 0.36); }
    S.box(0.07, 0.93, 0.7, MAT.fan, x, y, ZF - 0.36);                                         // center web, behind the handle
    N.box(0.05, 0.8, 0.035, MAT.beige, x, y, ZF + 0.02);                                      // pull handle
    for (const s of [-1, 1]) {
      const fx = x + s * 0.255;
      N.cylZ(0.07, 0.07, MAT.fan, fx, y, ZF - 0.42, 12);                                       // motor hub on its struts
      for (const a of [0.5, 2.6, 4.7]) N.box(0.4, 0.016, 0.016, MAT.fan, fx + Math.cos(a) * 0.2, y + Math.sin(a) * 0.2, ZF - 0.44, 0, 0, a);
      rotors.push({ p: [fx, y, ZF - 0.3], axis: 'z', r: 0.21 });
    }
  }
  const fanSpin = spinners(rotors, MAT.darkSteel, { speed: 9 }); fanSpin.mesh.userData.computeDynamic = 'rotor'; scene.add(fanSpin.mesh);
  for (const x of driveX) for (const y of driveY) {
    S.box(0.74, 0.14, 1.0, MAT.alu, x, y, ZF - 0.62);                                          // 15 mm U.2 drive in its carrier
    S.box(0.76, 0.15, 0.12, MAT.fan, x, y, ZF - 0.06);                                         // carrier front with its lever
    statusLeds.push({ p: [x + 0.33, y + 0.045, ZF + 0.002], color: '#5cf29a', rate: 1.1 + x * 0.2, duty: 0.6 });
  }
  S.box(0.8, 0.38, 0.06, MAT.fan, 0, 0.24, ZF - 0.03);                                        // front console board: 2 x USB, VGA, sensor
  for (const x of [-0.27, -0.13]) N.box(0.1, 0.035, 0.02, MAT.black, x, 0.18, ZF + 0.005);
  N.box(0.16, 0.07, 0.02, MAT.black, 0.2, 0.18, ZF + 0.005);
  S.box(W - 0.1, 0.4, 0.03, vBoard, 0, 0.24, ZM + 0.09);                                       // drive backplane

  // ---------- midplane: one board behind the fans with openings for the air, connectors for both trays ----------
  const mpY = [0.03, 3.48];
  S.box(W - 0.1, 0.47, 0.03, vBoard, 0, 0.255, ZM);                                            // lower band, behind the drives
  S.box(W - 0.1, 0.24, 0.03, vBoard, 0, 0.62, ZM);                                             // motherboard-tray connector band
  S.box(W - 0.1, 0.24, 0.03, vBoard, 0, 1.5, ZM);                                              // GPU-tray connector band
  S.box(W - 0.1, 0.06, 0.03, vBoard, 0, mpY[1] - 0.03, ZM);
  for (const x of [-2.12, -1.08, 0, 1.08, 2.12]) S.box(0.14, mpY[1] - 0.49, 0.03, vBoard, x, (mpY[1] + 0.49) / 2, ZM);
  // 54 V blades up the outer and center stiles; PCIe lanes run down the stiles at +-1.08 (DGX.pciStileX)
  for (const x of DGX.pwrStileX) S.box(0.09, 1.42, 0.012, MAT.copper, x, 0.8, ZM - 0.022);
  const mid = (x, y, w, h = 0.18) => S.box(w, h, 0.06, MAT.black, x, y, ZM - 0.045);
  for (const x of connX) mid(x, 1.5, 0.4); for (const x of DGX.gpuPwrX) mid(x, 1.5, x ? 0.2 : 0.3); for (const x of DGX.sigX) mid(x, 1.5, 0.2, 0.12);
  for (const x of DGX.mbPcieX) mid(x, 0.62, 0.36); for (const x of DGX.mbPwrX) mid(x, 0.62, 0.18); for (const x of DGX.nvmeX) mid(x, 0.62, 0.2);

  // ---------- supplies at the rear bottom, power distribution and 54 V copper forward to the midplane ----------
  for (let i = 0; i < 6; i++) {
    const px = psuX(i);
    S.box(0.68, 0.4, 2.4, MAT.darkSteel, px, psuY, ZB + 1.2);
    N.box(0.18, 0.16, 0.03, MAT.black, px - 0.15, psuY + 0.03, ZB - 0.01);                    // C20 inlet
    S.box(0.4, 0.06, 0.3, MAT.black, px, 0.11, ZB + 2.55);                                      // card-edge into the distribution board
    statusLeds.push({ p: [px + 0.26, psuY + 0.14, ZB - 0.012], color: '#5cf29a', rate: 0 });
  }
  S.box(W - 0.2, 0.03, 0.5, MAT.pcbBlack, 0, 0.06, ZB + 2.75);                                 // power distribution board
  // three 54 V bars straight forward from the distribution board to the midplane's power stiles
  DGX.busX.forEach((x, k) => {
    S.box(0.14, 0.06, ZM - (ZB + 2.75) - 0.05, MAT.copper, x, 0.105, (ZM + ZB + 2.75) / 2 - 0.03);
    S.box(0.1, 0.5, 0.06, MAT.copper, DGX.pwrStileX[k], 0.33, ZM - 0.06);
  });
  if (heavy) for (const i of [1, 4]) bundle(N, [psuX(i) - 0.15, psuY + 0.03, ZB - 0.03], [psuX(i) - 0.15, 0.03, ZB - 0.7], { n: 1, r: 0.016, sag: 0.1, mats: [MAT.black], seed: i + 3 });

  // ---------- motherboard tray: pan, motherboard (rear) and interposer board (front) ----------
  const trayZ0 = -4.48, trayZ1 = ZM - 0.05, trayD = trayZ1 - trayZ0, trayC = (trayZ0 + trayZ1) / 2;
  S.box(W - 0.1, 0.03, trayD, MAT.galv, 0, 0.495, trayC);
  S.box(0.03, 0.14, trayD, MAT.galv, -W / 2 + 0.07, 0.58, trayC);
  S.box(0.03, 0.05, trayD, MAT.galv, W / 2 - 0.07, 0.535, trayC); N.box(0.034, 0.012, trayD, glowMat('#d9dde2', 0.8), W / 2 - 0.07, 0.566, trayC);
  S.box(4.2, 0.03, 4.44, MAT.pcb, 0, my - 0.015, -2.1);                                        // motherboard, z -4.32 .. 0.12
  boardFinish(N, finish, 0, my - 0.006, -2.1, 4.2, 4.44);
  S.box(4.2, 0.03, 3.02, MAT.pcb, 0, my - 0.015, 1.71);                                        // interposer board, z 0.2 .. 3.22
  boardFinish(N, finish, 0, my - 0.006, 1.71, 4.2, 3.02);
  for (const x of cpuX) S.box(0.3, 0.05, 0.14, MAT.black, x - Math.sign(x) * DGX.cpuPcieDX, my + 0.025, 0.16);   // interposer to CPU connectors, in line with each CPU's PCIe
  const mbc = (x, w) => S.box(w, 0.14, 0.08, MAT.black, x, my + 0.07, ZM - 0.115);           // to the midplane
  for (const x of DGX.mbPcieX) mbc(x, 0.36); for (const x of DGX.mbPwrX) mbc(x, 0.18); for (const x of DGX.nvmeX) mbc(x, 0.2);
  // CPUs: socket frame, package, a finned sink with the fins along the airflow
  const cpuTexM = texMat(pkgTex('XEON'), { rough: 0.5 });
  cpuX.forEach(x => {
    S.box(0.74, 0.03, 0.7, MAT.nickel, x, my + 0.015, cpuZ);
    const cp = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.04, 0.56), [MAT.hbm, MAT.hbm, cpuTexM, MAT.hbm, MAT.hbm, MAT.hbm]); cp.position.set(x, my + 0.05, cpuZ); scene.add(cp);
    S.box(0.7, 0.05, 0.92, MAT.copper, x, my + 0.095, cpuZ);
    for (let f = 0; f < 13; f++) N.box(0.014, 0.5, 0.9, MAT.alu, x - 0.312 + f * 0.052, my + 0.37, cpuZ);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) S.cyl(0.022, 0.06, MAT.nickel, x + sx * 0.31, my + 0.15, cpuZ + sz * 0.41, 10);
    // point-of-load regulators in a row along the CPU's front edge, fed straight back from the power connector
    const s = Math.sign(x);
    for (let k = 0; k < 5; k++) { const vx = x + s * (DGX.cpuVrmX[0] + k * 0.09); S.box(0.07, 0.06, 0.07, MAT.inductor, vx, my + 0.03, cpuZ + 0.53); inductorTop(N, vx, my + 0.061, cpuZ + 0.53, 0.07); }
    hotTops.push([x, my + 0.65, cpuZ]);
  });
  // 32 DDR5 RDIMMs, eight either side of each CPU, slots along the airflow
  bankX.forEach(bx => { for (let k = 0; k < 8; k++) {
    const x = bx + (k - 3.5) * DGX.dimmPitch;
    S.box(0.028, 0.04, DGX.dimmLen + 0.08, MAT.black, x, my + 0.02, cpuZ);
    S.box(0.022, 0.3, DGX.dimmLen, MAT.darkSteel, x, my + 0.19, cpuZ);
    for (const s of [-1, 1]) N.box(0.03, 0.06, 0.03, MAT.white, x, my + 0.07, cpuZ + s * (DGX.dimmLen / 2 + 0.03));
  } });
  // PCIe switches between the CPUs and the network modules (drives and storage NICs), small finned sinks
  pcieX.forEach(x => { S.box(0.3, 0.03, 0.3, MAT.pcbBlack, x, my + 0.015, pcieZ); S.box(0.32, 0.03, 0.32, MAT.alu, x, my + 0.045, pcieZ); for (let f = 0; f < 7; f++) N.box(0.014, 0.16, 0.3, MAT.alu, x - 0.135 + f * 0.045, my + 0.14, pcieZ); });
  // two network modules on the interposer, four ConnectX-7 each under finned sinks
  const cxPts = [];
  modX.forEach(mx => {
    for (const s of [-1, 1]) S.box(0.5, 0.055, 0.14, MAT.black, mx + s * 0.3, my + 0.0275, modZ);
    S.box(1.42, 0.025, 1.3, MAT.pcb, mx, ny - 0.0125, modZ);
    boardFinish(N, finish, mx, ny - 0.004, modZ, 1.42, 1.3, 0.6);
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) {
      const x = mx + dx * DGX.cxD[0], z = modZ + dz * DGX.cxD[1];
      cxPts.push([x, z]);
      S.box(0.26, 0.02, 0.26, MAT.silicon, x, ny + 0.01, z);
      S.box(0.6, 0.03, 0.56, finish.graphite, x, ny + 0.035, z);
      for (let f = 0; f < 10; f++) S.box(0.014, 0.26, 0.54, finish.graphite, x - 0.27 + f * 0.06, ny + 0.18, z);
    }
    statusLeds.push({ p: [mx - 0.66, ny + 0.03, modZ - 0.6], color: '#5cf29a', rate: 0.4 }, { p: [mx - 0.6, ny + 0.03, modZ - 0.6], color: '#3fa8ff', rate: 1.6 });
  });
  // four DensiLink cables, two ports each, from the module's rear edge back over the CPU field to the OSFP cages
  const cbl = [], cageBoardTop = 0.87, cageZ0 = ZB + 0.25;
  modX.forEach((mx, m) => [-1, 1].forEach((dx, k) => {
    const x0 = mx + dx * DGX.cxD[0], cx = cageX[m * 2 + k], a = ny + 0.052, b = cageBoardTop + 0.052;
    cableHead(S, N, x0, ny, modZ - 0.62, 'densilink', 0.13, -1);
    cableHead(S, N, cx, cageBoardTop, cageZ0 + 0.33, 'densilink', 0.13, 1);
    // the four run as one flat bundle down the center, over the inner DIMMs and clear of the CPU sinks, in cage order
    const pts = [[x0, a, modZ - 0.6], [x0, 1.04, modZ - 0.82], [cx, 1.12, 0.55], [cx, 1.12, -2.3], [cx, 1.05, -3.0], [cx, b + 0.03, cageZ0 + 0.43], [cx, b, cageZ0 + 0.34]];
    ribbon(N, pts, 0.09, 0.014, { pairs: 8, steps: 40 });
    cbl.push(pts);
  }));
  // two molded ties hold the bundle, each on a post in the board's center channel
  for (const z of [-0.8, -2.0]) { N.box(0.92, 0.012, 0.035, MAT.black, 0, 1.172, z); N.box(0.03, 1.166 - my, 0.03, MAT.black, 0, (1.166 + my) / 2, z); }
  // rear: OSFP cage board and four cages with their seated twin-port modules
  S.box(1.15, 0.016, 0.62, MAT.pcb, 0, cageBoardTop - 0.008, ZB + 0.33);
  for (const sx of [-1, 1]) for (const z of [ZB + 0.08, ZB + 0.58]) N.cyl(0.012, cageBoardTop - my, MAT.nickel, sx * 0.53, (cageBoardTop + my) / 2, z, 8);
  const lidAt = [];
  cageX.forEach(x => {
    for (const dy of [-0.072, 0.072]) S.box(0.22, 0.014, 0.5, MAT.galv, x, cageY + dy, ZB + 0.25);
    for (const dx of [-0.103, 0.103]) S.box(0.014, 0.13, 0.5, MAT.galv, x + dx, cageY, ZB + 0.25);
    N.box(0.18, 0.11, 0.25, MAT.nickel, x, cageY, ZB - 0.025);                                  // seated module nose, flat top
    for (const dx of [-0.045, 0.045]) N.box(0.07, 0.045, 0.006, MAT.polymer, x + dx, cageY, ZB - 0.153);
    N.box(0.04, 0.008, 0.07, MAT.black, x, cageY - 0.062, ZB - 0.175);
    lidAt.push({ p: [x, cageY + 0.056, ZB - 0.09], face: 'top', yaw: Math.PI });
    statusLeds.push({ p: [x - 0.08, cageY + 0.1, ZB - 0.01], color: '#5cf29a', rate: 0 });
  });
  if (heavy) cageX.forEach(x => cageFins(N, x, cageY + 0.115, ZB + 0.3, 0.2, 0.4, 4));
  // rear I/O on the motherboard's edge: BMC and LAN RJ45, UID, power, BMC reset, code display; USB and VGA; COM
  for (const x of [-0.42, -0.2]) S.box(0.16, 0.13, 0.2, MAT.galv, x, my + 0.065, ZB + 0.12);
  S.box(0.28, 0.1, 0.05, MAT.black, 0.33, my + 0.07, ZB + 0.03);
  for (const x of [-1.92, -1.74]) S.box(0.14, 0.07, 0.18, MAT.galv, x, my + 0.035, ZB + 0.1);
  S.box(0.26, 0.11, 0.1, MAT.pcbBlack, -1.4, my + 0.055, ZB + 0.06);
  S.box(0.26, 0.11, 0.1, MAT.pcbBlack, 1.45, my + 0.055, ZB + 0.06);
  statusLeds.push({ p: [0.08, my + 0.08, ZB - 0.005], color: '#4aa8ff', rate: 0 }, { p: [0.15, my + 0.08, ZB - 0.005], color: '#5cf29a', rate: 0 });
  // two PCIe risers: slots 1 (storage ConnectX-7) and 3 (100 GbE) left, 2 (storage ConnectX-7) and 4 (M.2 boot pair) right
  const cards = [];
  for (const s of [-1, 1]) {
    S.box(0.02, 0.74, 1.9, vBoard, s * DGX.riserX, my + 0.37, DGX.cardZ + 0.25);
    S.box(0.06, 0.74, 0.12, MAT.black, s * DGX.riserX, my + 0.37, DGX.cardZ + 1.2);
    DGX.cardY.forEach((y, k) => {
      const x = s * DGX.cardX, slot = s < 0 ? (k ? 3 : 1) : (k ? 4 : 2);
      S.box(1.3, 0.02, 1.68, MAT.pcb, x, y, DGX.cardZ);
      S.box(1.3, 0.2, 0.015, MAT.galv, x, y + 0.08, ZB + 0.03);                              // bracket
      S.box(0.06, 0.04, 1.5, MAT.gold, s * (DGX.riserX + 0.04), y, DGX.cardZ);                // edge fingers in the riser slot
      if (slot === 4) for (const dx of [-0.2, 0.2]) { S.box(0.22, 0.012, 0.8, MAT.pcbBlack, x + dx, y + 0.016, DGX.cardZ + 0.1); S.box(0.2, 0.02, 0.7, MAT.alu, x + dx, y + 0.032, DGX.cardZ + 0.1); }
      else {
        S.box(0.24, 0.02, 0.24, MAT.silicon, x + s * 0.15, y + 0.02, DGX.cardZ + 0.35);
        S.box(0.34, 0.025, 0.34, finish.graphite, x + s * 0.15, y + 0.043, DGX.cardZ + 0.35);
        for (let f = 0; f < 6; f++) S.box(0.014, 0.08, 0.32, finish.graphite, x + s * 0.15 - 0.15 + f * 0.06, y + 0.095, DGX.cardZ + 0.35);
        for (const dx of [-0.25, 0.05]) S.box(0.2, 0.09, 0.42, MAT.galv, x + dx, y + 0.055, ZB + 0.25);     // QSFP112 cages at the bracket
      }
      cards.push({ x, y, slot });
    });
  }

  // ---------- GPU tray: pan, rear grille, HGX baseboard ----------
  S.box(W - 0.1, 0.03, trayD, MAT.galv, 0, DGX.deck + 0.015, trayC);
  S.box(0.03, 0.22, trayD, MAT.galv, -W / 2 + 0.07, DGX.deck + 0.11, trayC);
  S.box(0.03, 0.05, trayD, MAT.galv, W / 2 - 0.07, DGX.deck + 0.04, trayC); N.box(0.034, 0.012, trayD, glowMat('#d9dde2', 0.8), W / 2 - 0.07, DGX.deck + 0.071, trayC);
  {
    const y0 = DGX.deck + 0.03, y1 = H - 0.08, zg = ZB + 0.03;
    for (const y of [y0 + 0.03, y1 - 0.03]) S.box(W - 0.16, 0.06, 0.03, MAT.galv, 0, y, zg);
    for (let i = 1; i < 14; i++) N.box(W - 0.2, 0.014, 0.02, MAT.galv, 0, y0 + i * (y1 - y0) / 14, zg);
    for (let i = 0; i <= 16; i++) N.box(0.014, y1 - y0, 0.02, MAT.galv, -2.08 + i * 0.26, (y0 + y1) / 2, zg);
  }
  S.box(4.2, 0.03, 6.6, MAT.pcb, 0, gy - 0.015, -0.05);                                        // HGX baseboard, z -3.35 .. 3.25
  boardFinish(N, finish, 0, gy - 0.006, -0.05, 4.2, 6.6);
  // to the midplane: PCIe in front of each column, 54 V and sideband between them (DGX)
  for (const x of connX) S.box(0.4, 0.16, 0.08, MAT.black, x, gy + 0.08, ZM - 0.115);
  for (const x of DGX.gpuPwrX) { S.box(x ? 0.2 : 0.3, 0.16, 0.08, MAT.black, x, gy + 0.08, ZM - 0.115); S.box(x ? 0.22 : 0.3, 0.012, 0.75, MAT.copper, x, gy + 0.006, 2.78); }   // 54 V straps into the converters
  for (const x of DGX.sigX) S.box(0.2, 0.12, 0.08, MAT.black, x, gy + 0.06, ZM - 0.115);
  DGX.ibcs.forEach(([x, z, w]) => { S.box(w, 0.12, 0.36, MAT.darkSteel, x, gy + 0.072, z); for (let f = 0; f < 5; f++) N.box(0.012, 0.08, 0.34, MAT.alu, x - w / 2 + 0.03 + f * (w - 0.06) / 4, gy + 0.172, z); });
  { const [hx, hz] = DGX.hgxPcie; S.box(0.3, 0.03, 0.3, MAT.pcbBlack, hx, gy + 0.015, hz); S.box(0.36, 0.04, 0.36, MAT.alu, hx, gy + 0.05, hz); for (let f = 0; f < 7; f++) N.box(0.014, 0.16, 0.34, MAT.alu, hx - 0.15 + f * 0.05, gy + 0.15, hz); }
  const gpus = [], PKG = trayPackage('h100'), pkgLog = packageLog(0.1);
  gpuZ.forEach(z => gpuX.forEach(x => gpus.push([x, z])));
  const LIFT = 1.0;                                     // the front-right heat sink is lifted on its guide posts to show the package
  const dieM = texMat(dieTex(), { rough: 0.22, metal: 0.3 });
  gpus.forEach(([x, z], i) => {
    const fy = gy - 0.03;                               // the former baseboard top; the module stack is unchanged above it
    S.box(0.9, 0.03, 1.4, MAT.pcbBlack, x, fy + 0.05, z);
    boardFinish(N, finish, x, fy + 0.06, z, 0.9, 1.4, 0.5);
    // the package, from the descriptor the chip level draws too (gpu-package.js): substrate, dies, six HBM sites
    const slab = (kind, w, h, d, mat, px, py, pz) => { pkgLog.note(i, kind, w, d, px - x, pz - z); S.box(w, h, d, mat, px, py, pz); };
    slab('substrate', PKG.substrate.w, 0.024, PKG.substrate.d, MAT.pcbBlack, x, fy + 0.077, z);
    slab('interposer', PKG.interposer.w, 0.006, PKG.interposer.d, MAT.silicon, x, fy + 0.092, z);   // CoWoS-S silicon under the die and stacks
    for (const D of PKG.dies) { pkgLog.note(i, 'die', D.w, D.d, D.x, D.z); const d = new THREE.Mesh(new THREE.BoxGeometry(D.w, 0.02, D.d), [MAT.silicon, MAT.silicon, dieM, MAT.silicon, MAT.silicon, MAT.silicon]); d.position.set(x + D.x, fy + 0.105, z + D.z); scene.add(d); }
    for (const h of PKG.hbm) slab(h.spare ? 'spacer' : 'hbm', h.w, 0.03, h.d, h.spare ? MAT.silicon : MAT.hbm, x + h.x, fy + 0.11, z + h.z);
    ihsLid(S, N, x, fy + 0.116, z, PKG.frame.w - 0.01, PKG.frame.d - 0.01, heavy, 0.012);
    if (heavy) { capField(N, x, z, fy + 0.05, 0.32, 10); connectorPins(N, x - 0.42, x + 0.42, fy + 0.065, z - 0.68, 14); }
    for (const s of [-1, 1]) for (let k = 0; k < 9; k++) { const vx = x + s * 0.4, vz = z - 0.56 + k * 0.14; S.box(0.07, 0.06, 0.07, MAT.inductor, vx, fy + 0.1, vz); inductorTop(N, vx, fy + 0.131, vz, 0.07); }
    // heat sink: copper base, 20 fins front to back, heat pipes up through the stack
    const lifted = i === DGX.lifted, y0 = fy + 0.12 + (lifted ? LIFT : 0);
    S.box(0.96, 0.08, 1.7, MAT.copper, x, y0 + 0.04, z);
    for (let f = 0; f < 20; f++) N.box(0.016, 1.55, 1.66, MAT.alu, x - 0.456 + f * 0.048, y0 + 0.855, z);
    for (const [k, zz] of [-0.6, -0.2, 0.2, 0.6].entries()) {
      const sx = k % 2 ? 1 : -1, top = y0 + 0.9 + (k % 2) * 0.4;
      tube(S, [[x + sx * 0.2, y0 + 0.06, z + zz], [x + sx * 0.49, y0 + 0.18, z + zz], [x + sx * 0.5, top - 0.15, z + zz], [x + sx * 0.36, top, z + zz], [x - sx * 0.4, top, z + zz]], 0.028, MAT.copper, { seg: 10, steps: 18 });
    }
    for (const sz of [-1, 1]) { S.box(0.96, 0.014, 0.1, MAT.galv, x, y0 + 1.635, z + sz * 0.6); S.box(0.96, 0.14, 0.014, MAT.galv, x, y0 + 1.56, z + sz * 0.843); }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      S.cyl(0.022, 0.05, MAT.nickel, x + sx * 0.38, y0 + 0.105, z + sz * 0.58, 12);
      if (lifted) S.cyl(0.012, LIFT, MAT.nickel, x + sx * 0.38, fy + 0.12 + LIFT / 2, z + sz * 0.58, 10);
    }
    hotTops.push([x, y0 + 1.65, z]);
  });
  // NVSwitch chips behind the GPUs, under wide finned sinks
  swX.forEach(x => { S.box(0.42, 0.03, 0.42, MAT.pcbBlack, x, gy + 0.015, swZ); S.box(0.9, 0.06, 1.1, MAT.copper, x, gy + 0.06, swZ); for (let f = 0; f < 16; f++) N.box(0.014, 0.9, 1.08, MAT.alu, x - 0.42 + f * 0.056, gy + 0.54, swZ); });
  // board population: decoupling rows around the NVSwitches, the SXM modules, the CPUs and the PCIe switches
  swX.forEach((x, k) => { smdFrame(N, gy, x, swZ, 0.42, 0.42, 0.04, 0.03, k); smdFrame(N, gy, x, swZ, 0.42, 0.42, 0.058, 0.045, k + 20); });
  gpus.forEach(([x, z], k) => smdRow(N, gy + 0.005, [x - 0.36, z + 0.3], [x + 0.36, z + 0.3], 16, true, k + 40));
  cpuX.forEach((x, k) => { for (const s of [-1, 1]) smdRow(N, my, [x - 0.33, cpuZ + s * 0.39], [x + 0.33, cpuZ + s * 0.39], 22, true, k + 60 + s); });
  pcieX.forEach((x, k) => smdFrame(N, my, x, pcieZ, 0.3, 0.3, 0.03, 0.03, k + 70));

  scene.add(S.build()); scene.add(N.build({ cast: false }));
  trayLidLabels(scene, 'h100', lidAt, [.16, .08]);

  // ---------- power: AC in, 54 V along the floor copper, up the midplane into both trays, 12 V to the GPU modules ----------
  for (let i = 0; i < 6; i++) flows.push(flow([[psuX(i) - 0.15, psuY + 0.03, ZB - 0.8], [psuX(i) - 0.15, psuY + 0.03, ZB + 0.05]], 'lv', { count: 4, speed: 0.6, size: 0.03, trailR: 0.01 }));
  const nearest = (xs, x) => xs.reduce((a, b) => Math.abs(b - x) < Math.abs(a - x) ? b : a);
  for (let i = 0; i < 6; i++) { const px = psuX(i), bx = nearest(DGX.busX, px); flows.push(flow([[px, 0.15, ZB + 2.42], [px, 0.1, ZB + 2.75], [bx, 0.1, ZB + 2.75]], 'dc', { count: 4, speed: 0.6, size: 0.03, trailR: 0.01 })); }
  DGX.busX.forEach((x, k) => {
    const sx = DGX.pwrStileX[k], px = DGX.gpuPwrX[k];
    flows.push(flow([[x, 0.15, ZB + 2.75], [x, 0.15, ZM - 0.1], [sx, 0.5, ZM - 0.1]], 'dc', { count: 14, speed: 1.0, size: 0.04, trailR: 0.014 }));
    // up the stile's copper blade to the GPU tray's 54 V connector, along its strap through the two converters behind it
    flows.push(flow([[sx, 0.5, ZM - 0.04], [sx, gy + 0.04, ZM - 0.04], [px, gy + 0.04, ZM - 0.12], [px, gy + 0.04, 2.15]], 'dc', { count: 10, speed: 0.9, size: 0.035, trailR: 0.012 }));
    // outer stiles also feed the motherboard tray's power connectors, straight down the interposer's outer strip, across
    // behind the network modules and straight back to the CPU's regulator row (never through a signal channel)
    if (x) { const s = Math.sign(x), mp = s * DGX.mbPwrX[1], run = s * DGX.mbPwrRunX;
      flows.push(flow([[sx, 0.62, ZM - 0.04], [mp, my + 0.02, ZM - 0.2], [mp, my + 0.02, 0.3], [run, my + 0.02, 0.3], [run, my + 0.02, cpuZ + 0.6]], 'dc', { count: 8, speed: 0.8, size: 0.028, trailR: 0.009 })); }
  });
  // 12 V: each converter feeds the regulator row of the modules on its side, front module first, then straight back
  // along that row's line (the power plane under the front module) to the rear module's row
  gpus.forEach(([x, z], i) => {
    const ib = DGX.ibcs.find(([bx, bz]) => bz < 2.5 && bx === nearest([-1.95, 0, 1.95], x)), front = z > 0, rx = x + Math.sign(ib[0] - x) * 0.4;
    const pts = front ? [[ib[0], gy + 0.04, ib[1] - 0.2], [rx, gy + 0.04, z + 0.75], [rx, gy + 0.06, z + 0.56]]
      : [[ib[0], gy + 0.04, ib[1] - 0.2], [rx, gy + 0.005, 1.2 + 0.72], [rx, gy + 0.005, z + 0.8], [rx, gy + 0.06, z + 0.56]];
    flows.push(flow(pts, 'bus12', { count: front ? 6 : 9, speed: 0.9, size: 0.03, trailR: 0.01 }));
    if (i === DGX.lifted) for (const s of [-1, 1]) for (const dz of [-0.3, 0, 0.3]) flows.push(flow([[x + s * 0.36, gy + 0.05, z + dz], [x + s * 0.22, gy + 0.05, z + dz * 0.8]], 'core', { count: 3, speed: 0.35, size: 0.018, trailR: 0.006, k: 2.6, trailK: 0.2 }));
  });
  flows.forEach(f => scene.add(f.group));

  // ---------- data: NVLink on the baseboard; PCIe from each GPU through the midplane to its ConnectX-7;
  // each ConnectX-7 to a CPU; DensiLink to the cages; drives and storage NICs through the PCIe switches ----------
  const gapOf = x => x < -1 ? -1.08 : x < 0 ? -0.02 : x < 1 ? 0.02 : 1.08;
  gpus.forEach(([x, z], i) => {
    const c = i % 4, sx = swX[c], front = z > 0, gap = gapOf(x);
    dataFlows.push(flow(front
      ? [[x - Math.sign(x) * 0.15, gy + 0.04, z - 0.72], [gap, gy + 0.04, z - 0.88], [gap, gy + 0.04, -1.55], [sx, gy + 0.04, swZ + 0.25]]
      : [[x - Math.sign(x) * 0.15, gy + 0.04, z - 0.72], [x - Math.sign(x) * 0.15, gy + 0.04, -1.55], [sx, gy + 0.04, swZ + 0.25]], 'nvl', { count: 6, speed: 0.8, size: 0.03, k: 2.4, trailR: 0.01 }));
    // PCIe: forward to the midplane connector, down the midplane, into the interposer, to this GPU's ConnectX-7
    const m = c < 2 ? 0 : 1, mx = modX[m], cxX = mx + (c % 2 ? 1 : -1) * DGX.cxD[0], cxZ = modZ + (front ? 1 : -1) * DGX.cxD[1], cn = connX[c];
    // straight forward along the column to the connector in front of it (the rear module's lanes under the front
    // module, on an inner layer), down the midplane on a PCIe stile, straight back to this GPU's ConnectX-7
    const lx = x + Math.sign(x) * (front ? -0.06 : 0.06), st = DGX.pciStileX[m], mc = DGX.mbPcieX[c];
    const under = front ? [] : [[lx, gy + 0.005, 0.45], [lx, gy + 0.005, 1.95]];
    const f = flow([[lx, gy + 0.04, z + 0.72], ...under, [lx, gy + 0.04, 2.1], [lx, gy + 0.04, ZM - 0.2], [cn, gy + 0.04, ZM - 0.04], [st, 1.5, ZM - 0.04], [st, 0.58, ZM - 0.04], [mc, 0.58, ZM - 0.04], [mc, my + 0.02, ZM - 0.2], [mc, my + 0.02, modZ + 0.7], [cxX, ny + 0.01, cxZ + (front ? 0.13 : -0.13)]], 'pcie', { count: 6, speed: 0.75, size: 0.028, k: 2.2, trailR: 0.009 });
    f.dgxPcie = { gpu: i, module: m }; dataFlows.push(f);
  });
  modX.forEach((mx, m) => { const s = Math.sign(mx), lx = s * (cpuX[1] - DGX.cpuPcieDX), f = flow([[lx, ny + 0.01, modZ - 0.5], [lx, my + 0.02, modZ - 0.7], [lx, my + 0.02, cpuZ + 0.3]], 'pcie', { count: 5, speed: 0.6, size: 0.026, k: 2.0, trailR: 0.008 }); f.dgxCpuLink = m; dataFlows.push(f); });
  cbl.forEach((pts, i) => dataFlows.push(flow([...pts.map(([x, y, z]) => [x, y + 0.03, z]), [cageX[i], cageY, ZB + 0.3], [cageX[i], cageY, ZB - 0.9]], 'eth', { count: 7, speed: 0.9, size: 0.03, k: 2.3, trailR: 0.01 })));
  for (const s of [-1, 1]) {
    const px = s * 0.35, card = cards.find(c => Math.sign(c.x) === s && (c.slot === 1 || c.slot === 2));
    const cx0 = s * (cpuX[1] - DGX.cpuSwDX);
    dataFlows.push(flow([[cx0, my + 0.02, cpuZ + 0.2], [cx0, my + 0.02, -0.37], [px, my + 0.02, -0.37], [px, my + 0.02, pcieZ - 0.05]], 'pcie', { count: 3, speed: 0.5, size: 0.024, k: 2.0, trail: false }));
    // switch to the storage NIC: out the switch's inner side, back down the center channel between the inner DIMM banks,
    // behind them to the riser's foot, up the riser to the card
    dataFlows.push(flow([[s * 0.27, my + 0.02, pcieZ - 0.05], [s * 0.06, my + 0.02, pcieZ - 0.05], [s * 0.06, my + 0.02, -2.05], [s * 0.62, my + 0.02, -2.05], [s * DGX.riserX, my + 0.02, -2.5], [s * DGX.riserX, card.y, -2.8], [card.x, card.y + 0.02, DGX.cardZ + 0.35]], 'pcie', { count: 4, speed: 0.6, size: 0.024, k: 2.0, trailR: 0.008 }));
    // NVMe: the inner drives through the backplane, along the midplane's solid lower band to the center channel,
    // up into the motherboard tray and straight back to the switch
    const nx = DGX.nvmeX[s < 0 ? 0 : 1];
    dataFlows.push(flow([[s * 0.87, 0.43, ZF - 1.0], [s * 0.87, 0.43, ZM + 0.12], [s * 0.87, 0.3, ZM - 0.04], [nx, 0.3, ZM - 0.04], [nx, my + 0.1, ZM - 0.04], [nx, my + 0.02, ZM - 0.2], [nx, my + 0.02, 0.2], [px, my + 0.02, pcieZ + 0.15]], 'pcie', { count: 6, speed: 0.6, size: 0.024, k: 2.0, trailR: 0.008 }));
  }
  // Flow-path audit (tools/flow-audit.mjs): each route may share space only with the conductors it stands for. Boxes in
  // tray units: the midplane (its connectors on both faces, the board's own lanes and 54 V blades), the PSU card edges
  // into the distribution board, the 54 V straps running into their converters, the inner-layer lanes and 12 V plane
  // under each SXM module, the network modules' mezzanine connectors, the CPU-to-interposer connectors, the storage
  // risers and their cards, the drives' own connectors, and the seated OSFP modules the electrical lanes end in.
  const box = (x, y, z, w, h, d) => [x - w / 2, y - h / 2, z - d / 2, x + w / 2, y + h / 2, z + d / 2];
  const MID = [[-2.2, 0.03, ZM - 0.16, 2.2, 3.48, ZM + 0.11]];
  const PDB = [[-2.2, 0.03, ZB + 2.38, 2.2, 0.2, ZB + 3.0]];
  const STRAP = DGX.ibcs.map(([x, z, w]) => box(x, gy + 0.07, z, w + 0.02, 0.15, 0.38)).concat(DGX.gpuPwrX.map(x => box(x, gy + 0.04, 2.78, 0.32, 0.08, 0.8)));
  const SXM = gpus.map(([x, z]) => box(x, gy + 0.02, z, 0.92, 0.08, 1.42));
  const MEZZ = modX.map(mx => box(mx, (my + ny) / 2, modZ, 1.44, 0.1, 1.32)).concat(cpuX.map(x => box(x - Math.sign(x) * DGX.cpuPcieDX, my + 0.03, 0.16, 0.32, 0.08, 0.16)));
  const RISER = [-1, 1].flatMap(s => [box(s * DGX.riserX, my + 0.37, DGX.cardZ + 0.35, 0.1, 0.78, 2.2), ...DGX.cardY.map(y => box(s * DGX.cardX, y, DGX.cardZ, 1.32, 0.05, 1.7))]);
  const DRIVES = DGX.driveX.flatMap(x => DGX.driveY.map(y => box(x, y, ZF - 0.62, 0.76, 0.16, 1.02)));
  const CAGE = cageX.map(x => box(x, cageY, ZB + 0.1, 0.24, 0.16, 0.8));
  const why = 'inside the connector, board, copper or module it runs through: midplane, PSU card edge, 54 V strap into its converters, inner layers under an SXM module, mezzanine and CPU connectors, risers, drive connectors, seated OSFP module';
  for (const f of flows) if (f.cls === 'dc' || f.cls === 'bus12') f.audit = { within: [...MID, ...PDB, ...STRAP, ...SXM, ...MEZZ], why };
  for (const f of dataFlows) f.audit = { within: [...MID, ...SXM, ...MEZZ, ...RISER, ...DRIVES, ...CAGE], why };
  dataFlows.forEach(f => scene.add(f.group));

  // ---------- heat: every source tagged with its part and watts, drawn on the site's log rule (src/heat.js) ----------
  const PW = PART_W.dgxH100, cpuW = PW.cpu, srcHot = (f, part, watts) => heatFlows.push(tagHeat(f, part, watts));
  gpus.forEach(([x, z], i) => {
    const y0 = gy + 0.09 + (i === DGX.lifted ? LIFT : 0);
    srcHot(flow([[x, gy + 0.09, z], [x, y0 + 0.1, z]], 'hot', { count: 3, speed: 0.4, size: 0.035, k: 2.6, trail: false }), `gpu-${i}`, model.accel.gpuW);
    for (const dx of [-0.25, 0.25]) heatFlows.push(tagHeat(flow([[x + dx, y0 + 0.9, z + 1.0], [x + dx, y0 + 0.9, z - 0.8], [x + dx * 1.1, y0 + 0.95, z - 2.2]], 'air', { count: 4, speed: 1.0, size: 0.045, k: 2.2, opacity: 0.85, trail: false }), `gpu-${i}-sink-air`, model.accel.gpuW, 'carrier'));
  });
  swX.forEach((x, k) => srcHot(flow([[x, gy + 0.05, swZ], [x, gy + 0.7, swZ]], 'hot', { count: 2, speed: 0.35, size: 0.03, k: 2.4, trail: false }), `nvswitch-${k}`, PW.nvswitch));
  cpuX.forEach((x, k) => srcHot(flow([[x, my + 0.07, cpuZ], [x, my + 0.62, cpuZ]], 'hot', { count: 3, speed: 0.4, size: 0.032, k: 2.4, trail: false }), `cpu-${k}`, cpuW));
  bankX.forEach((bx, k) => srcHot(flow([[bx, my + 0.2, cpuZ + 0.7], [bx, my + 0.2, cpuZ - 0.75], [bx, my + 0.25, cpuZ - 1.6]], 'air', { count: 3, speed: 0.8, size: 0.03, k: 2.0, opacity: 0.8, trail: false }), `dimm-bank-${k}`, 8 * PW.dimm));
  cxPts.forEach(([x, z], k) => srcHot(flow([[x, ny + 0.02, z], [x, ny + 0.3, z]], 'hot', { count: 2, speed: 0.35, size: 0.026, k: 2.2, trail: false }), `connectx7-${k}`, PW.connectx7));
  for (let i = 0; i < 6; i++) srcHot(flow([[psuX(i), psuY, ZB + 2.3], [psuX(i), psuY, ZB + 0.3], [psuX(i), psuY + 0.05, ZB - 0.7]], 'air', { count: 3, speed: 0.8, size: 0.035, k: 2.0, opacity: 0.8, trail: false }), `psu-${i}-loss`, PW.psuLoss);
  // the fan wall: each module's air through the midplane openings and out the rear; together they carry the server's heat
  const serverW = model.rack.kw * 1000 / (model.accel.gpusPerRack / 8);
  fanY.forEach((y, r) => fanX.forEach(x => heatFlows.push(tagHeat(flow([[x, y, ZF - 0.5], [x, y, ZM - 0.3], [x * 0.95, y, -2.0], [x * 0.9, y + (r ? 0.1 : 0), ZB - 0.8]], 'air', { count: 5, speed: 1.1, size: 0.05, k: 2.0, opacity: 0.75, trail: false }), 'server-air', serverW, 'carrier'))));
  balanceHeat(heatFlows);
  heatFlows.forEach(f => scene.add(f.group));

  const leds = blinkers(statusLeds); scene.add(leds.mesh);
  const shimmer = heavy ? plumes(hotTops.map(p => ({ p, dir: [0, 1, 0] })), { perEmitter: 10, size: 0.16, grow: 2.2, life: 2.2, rise: 0.35, drift: [0.04, 0, 0.02], spread: 0.18, color: '#ffddb0', opacity: 0.12, additive: true }) : null;
  if (shimmer) scene.add(shimmer.points);

  const [g0x, g0z] = gpus[DGX.lifted], [g5x, g5z] = gpus[5];
  const fy = gy - 0.03;
  // Under the lifted sink from the open near side (section cut): the package is the subject.
  const hsGpu = { pos: [g0x, fy + 0.4, g0z], view: componentView([g0x, fy + 0.13, g0z - 0.05], [0.95, 0.55, 0.45], [0.8, 0.3, 0.75]) };
  // From the cut-away side above the fin tops: both rows of sinks, the lifted one included.
  const hsSink = { pos: [g5x, gy + 1.85, g5z], view: { pos: [g5x + 4.2, 4.8, g5z + 1.4], target: [g5x - 0.2, gy + 1.2, g5z + 0.6] } };
  const cpuV = { pos: [cpuX[1], my + 0.62, cpuZ], view: { pos: [4.2, 1.3, -0.4], target: [cpuX[1], my + 0.35, cpuZ] } };
  const nicV = { pos: [modX[1] + DGX.cxD[0], ny + 0.3, modZ - DGX.cxD[1]], view: { pos: [4.0, 1.2, 2.3], target: [modX[1], ny + 0.15, modZ] } };
  const cageV = { pos: [cageX[2], cageY + 0.12, ZB + 0.25], view: { pos: [1.3, 1.75, -7.0], target: [0.1, cageY, ZB + 0.25] } };
  const psuV = { pos: [psuX(4), psuY + 0.2, ZB + 0.3], view: { pos: [3.2, 1.0, -8.2], target: [0.6, psuY, ZB + 0.6] } };
  const midV = { pos: [connX[3], 1.05, ZM - 0.05], view: { pos: [4.2, 1.6, 2.0], target: [1.2, 1.0, ZM - 0.05] } };
  const nvmeV = { pos: [driveX[3], 0.4, ZF], view: { pos: [2.6, 0.9, 7.6], target: [1.2, 0.27, ZF - 0.2] } };
  const card2 = cards.find(c => c.slot === 2);
  // The power layer's glow (src/power-glow.js), on the heat layer's watts: GPUs and their regulator columns,
  // NVSwitches, PCIe switches, bus converters, CPUs with their regulator rows, DIMM banks, ConnectX-7s, the PCIe
  // cards' NICs, the supplies' loss, and the rack's drive, fan and management power over the fans and drives evenly.
  const PD = [], A_ = model.accel, perServer = A_.gpusPerRack / 8, gpuLoss = A_.gpuW * (1 / A_.vrmEff - 1);
  gpus.forEach(([x, z], i) => {
    PD.push({ id: `gpu-${i}`, part: 'gpu', watts: A_.gpuW, volt: 'core', at: [x, gy + 0.004, z], size: [0.9, 1.4] });
    for (const s of [-1, 1]) PD.push({ id: `vrm-${i}-${s}`, part: 'vrm', watts: gpuLoss / 2, at: [x + s * 0.4, fy + 0.067, z], size: [0.1, 1.26] });
  });
  swX.forEach((x, k) => PD.push({ id: `nvswitch-${k}`, watts: PW.nvswitch, at: [x, gy + 0.004, swZ], size: [0.9, 1.1] }));
  PD.push({ id: 'pcie-hgx', watts: PW.pcieSwitch, at: [DGX.hgxPcie[0], gy + 0.004, DGX.hgxPcie[1]], size: [0.36, 0.36] });
  pcieX.forEach((x, k) => PD.push({ id: `pcie-${k}`, watts: PW.pcieSwitch, at: [x, my + 0.004, pcieZ], size: [0.32, 0.32] }));
  DGX.ibcs.forEach(([x, z, w], k) => PD.push({ id: `ibc-${k}`, part: 'ibc', watts: model.rack.ibcLossKW * 1000 / perServer / DGX.ibcs.length, at: [x, gy + 0.004, z], size: [w, 0.36] }));
  cpuX.forEach((x, k) => {
    PD.push({ id: `cpu-${k}`, part: 'cpu', watts: PW.cpu, volt: 'core', at: [x, my + 0.004, cpuZ], size: [0.74, 0.7] });
    PD.push({ id: `cpu-vrm-${k}`, part: 'vrm', watts: PW.cpu * (1 / A_.vrmEff - 1), at: [x + Math.sign(x) * (DGX.cpuVrmX[0] + 0.18), my + 0.004, cpuZ + 0.53], size: [0.45, 0.1] });
  });
  bankX.forEach((bx, k) => PD.push({ id: `dimm-bank-${k}`, part: 'dimm', watts: 8 * PW.dimm, at: [bx, my + 0.004, cpuZ], size: [8 * DGX.dimmPitch, DGX.dimmLen] }));
  cxPts.forEach(([x, z], k) => PD.push({ id: `connectx7-${k}`, part: 'nic', watts: PW.connectx7, at: [x, ny + 0.004, z], size: [0.6, 0.56] }));
  cards.filter(c => c.slot !== 4).forEach((c, k) => PD.push({ id: `card-nic-${k}`, part: 'nic', watts: PW.connectx7, at: [c.x + Math.sign(c.x) * 0.15, c.y + 0.012, DGX.cardZ + 0.35], size: [0.34, 0.34] }));
  for (let i = 0; i < 6; i++) PD.push({ id: `psu-${i}`, part: 'psu', watts: PW.psuLoss, volt: 'lv', at: [psuX(i), 0.032, ZB + 1.2], size: [0.68, 2.4] });
  const fansDrives = fanX.length * fanY.length + DGX.driveX.length * DGX.driveY.length, otherEach = A_.otherKW * 1000 / perServer / fansDrives;
  fanY.forEach((y, r) => fanX.forEach((x, k) => PD.push({ id: `fan-${r}-${k}`, part: 'fans', watts: otherEach, at: [x, y, ZF - 0.36], size: [1.04, 0.96], normal: [0, 0, 1], fill: 0.04 })));
  DGX.driveX.forEach((x, k) => DGX.driveY.forEach((y, r) => PD.push({ id: `drive-${k}-${r}`, part: 'nvme', watts: otherEach, at: [x, y - 0.068, ZF - 0.62], size: [0.74, 1.0] })));
  finishCompute(scene, finish);
  scene.userData.dgxCables = cbl;
  scene.userData.gpuPackageDrawn = pkgLog;
  scene.userData.computeGeneration = { id: 'h100', gpus: 8, cpus: 2, fans: 12, fanRotors: rotors.length, dimms: 32, drives: 8, psus: 6, dpuCount: 0, nicCount: 8, networkModules: 2, densiLinkCables: cbl.length, storageNicCount: 2, opticalPorts: 4, pcieSwitches: 3, midplane: true, trays: ['GPU tray (top)', 'motherboard tray', 'power supplies (bottom)'], representative: true };
  return {
    printSpots: [etch('GPU package marking', GPU_NAME.h100, [.16, .036], gpus.map(([x, z]) => ({ from: [x, fy + .104, z + (PKG.interposer.d + PKG.substrate.d) / 4], dir: [0, -1, 0] })))],
    scene, flows, powerDraw: PD,
    look: { env: 'studio', envIntensity: 0.5, exposure: 0.95, bloom: 0.38, threshold: 2.0, ao: 0.14, dof: true },
    camera: { pos: [9.2, 6.4, 6.6], target: [0, 1.4, -0.2], near: 0.02, far: 400, min: 1, max: 30 },
    hotspots: {
      osfp: cageV,
      psu: psuV,
      ibc: { pos: [DGX.ibcs[4][0], gy + 0.2, DGX.ibcs[4][1]], view: { pos: [3.6, 3.7, 3.1], target: [DGX.ibcs[4][0] - 0.3, gy, 2.5] } },
      vrm: { pos: [g0x + 0.4, gy + 0.12, g0z], view: { pos: [g0x + 1.1, gy + 0.75, g0z + 0.8], target: [g0x + 0.4, gy + 0.05, g0z] } },
      gpu: hsGpu,
      cpu: cpuV,
      dimm: { pos: [bankX[3], my + 0.34, cpuZ], view: { pos: [4.2, 1.25, -0.2], target: [bankX[3], my + 0.2, cpuZ] } },
      heatsinks: hsSink,
      nvswitch: { pos: [swX[2], gy + 0.95, swZ], view: { pos: [1.6, 3.9, -3.5], target: [swX[2], gy + 0.4, swZ] } },
      nic: nicV,
      midplane: midV,
    },
    dataFlows, heatFlows,
    heatHotspots: {
      heatsinks: hsSink,
      gpuheat: hsGpu,
      cpuheat: cpuV,
      psuheat: psuV,
      osfp: cageV,
      fans: { pos: [fanX[3], fanY[2] + 0.3, ZF - 0.3], view: { pos: [1.6, 3.8, 8.6], target: [0.2, 1.8, ZF - 0.5] } },
    },
    dataHotspots: {
      nvswitch: { pos: [swX[1], gy + 0.95, swZ], view: { pos: [-.5, 3.9, -3.5], target: [swX[1], gy + 0.4, swZ] } },
      pcie: { pos: [pcieX[1], my + 0.2, pcieZ], view: { pos: [4.0, 1.25, 0.9], target: [pcieX[1], my + 0.1, pcieZ] } },
      cx: nicV,
      osfp: cageV,
      dpu: { pos: [card2.x - 0.15, card2.y + 0.12, DGX.cardZ + 0.35], view: { pos: [3.8, 1.3, -4.9], target: [card2.x, card2.y, DGX.cardZ + 0.2] } },
      gpu: hsGpu,
      midplane: midV,
      nvme: nvmeV,
    },
    update(t) { fanSpin.update(t); leds.update(t); if (shimmer) shimmer.update(t); },
  };
}

// ---------- NVL72 compute tray: two superchip boards, liquid-cooled ----------
// Cold-plate and fan layout, GB200/GB300 (shared with the rack's pulled-tray LOD in rack.js so the two can never
// drift apart): tray units (10 cm), tray-local frame, front +z. Two superchip boards at NVL_BOARD_X; on each,
// Grace's plate at NVL_CPU.z, the two GPU plates at NVL_GPU_Z (front, rear). Square plates, side = size.
export const NVL_BOARD_X = [-1.1, 1.1];
export const NVL_LPDDR = { dx: 0.55, z0: -0.36, pitch: 0.24, n: 4 };   // LPDDR5X packages beside Grace, each side
export const NVL_CPU = { z: 1.75, size: 0.66 };
export const NVL_GPU_Z = [0.2, -1.55], NVL_GPU_SIZE = 0.9;
export const NVL_FAN_Z = 2.55;                         // ZF (4.5) - 1.95
export const NVL_FAN_X = Array.from({ length: 6 }, (_, i) => -1.9 + i * 0.76 + 0.19);

function buildNVL({ quality, model }) {
  const cpuLabel = 'GRACE', ultra = model.accel.id === 'gb300';
  const scene = new THREE.Scene();
  lights(scene, quality);

  const flows = [], dataFlows = [], heatFlows = [];
  const S = new Builder(), N = new Builder();
  const finish = computeMaterials();
  const W = 4.4, D = 9, H = 0.42, ZF = D / 2, ZB = -D / 2;
  const floorY = 0.03;
  // EPDM hose jackets tinted by circuit (deep blue supply, deep red return), so
  // the coding still reads where the ID bands are too small, e.g. on a phone.
  const hoseMat = { sup: new THREE.MeshStandardMaterial({ color: 0x1b2c4e, roughness: 0.6, metalness: 0 }), ret: new THREE.MeshStandardMaterial({ color: 0x4a1d22, roughness: 0.6, metalness: 0 }) };
  const heavy = !quality.mobile;
  const statusLeds = [], warmTops = [];

  // bench surface
  const bench = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: 0.85 }));
  bench.rotation.x = -Math.PI / 2; bench.position.y = -0.01; bench.receiveShadow = true; scene.add(bench);

  // chassis
  S.box(W, 0.03, D, MAT.galv, 0, 0.015, 0);
  S.box(0.03, H, D, MAT.galv, -W / 2, H / 2, 0); S.box(0.03, H, D, MAT.galv, W / 2, H / 2, 0);
  S.box(W, H, 0.03, MAT.galv, 0, H / 2, ZB);
  for (const side of [-1, 1]) chassisLip(N, side * W / 2, H, D, -side, heavy);
  const bezel = canvasTex(1024, 96, (g, w, h) => {
    g.fillStyle = '#1b1e23'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#101216'; for (let x = 20; x < 380; x += 12) for (let y = 14; y < h - 14; y += 12) g.fillRect(x + (y % 24 ? 6 : 0), y, 7, 7);
    for (let i = 0; i < 4; i++) { g.fillStyle = '#2d323a'; g.fillRect(410 + i * 60, 16, 50, h - 32); g.fillStyle = '#5cf29a'; g.fillRect(418 + i * 60, 22, 6, 6); }
    for (let i = 0; i < 6; i++) { g.fillStyle = '#0b0c0e'; g.fillRect(670 + i * 52, 22, 42, h - 44); g.fillStyle = '#3a3f47'; g.fillRect(674 + i * 52, 26, 34, h - 52); }
  });
  const bz = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.05), [MAT.rackFace, MAT.rackFace, MAT.rackFace, MAT.rackFace, texMat(bezel, { rough: 0.5, metal: 0.35 }), MAT.rackFace]);
  bz.position.set(0, H / 2, ZF); bz.castShadow = true; scene.add(bz);

  // ---------- rear power board: busbar clip, bus converters, 12 V copper ----------
  S.box(W - 0.2, 0.02, 1.0, MAT.pcbBlack, 0, floorY + 0.01, ZB + 0.65);
  // Busbar clip: two rows of sprung copper fingers either side of an empty
  // slot, in a dark glass-filled polymer housing (finger count representative).
  const clipPoly = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.62, metalness: 0.05 });
  for (const side of [-1, 1]) {
    N.box(0.014, 0.3, 0.08, MAT.copper, side * 0.062, 0.2, ZB - 0.02);
    for (let k = 0; k < 8; k++) N.box(0.012, 0.026, 0.22, MAT.copper, side * 0.044, 0.08 + k * 0.034, ZB - 0.15, side * 0.07);
  }
  S.box(0.5, 0.2, 0.3, clipPoly, 0, 0.13, ZB + 0.1);
  // Two bus converters flank the clip, inboard of every NVLink lane (the lanes run straight back at x = +/-1.1 and
  // +/-1.93 to the connectors), so no high-speed route threads between switching converters (design rule 2).
  const ibcX = [-0.47, 0.47];
  ibcX.forEach(x => {
    S.box(0.62, 0.08, 0.5, MAT.darkSteel, x, floorY + 0.06, ZB + 0.85);
    for (let f = 0; f < 11; f++) N.box(0.02, 0.2, 0.46, MAT.alu, x - 0.28 + f * 0.056, floorY + 0.2, ZB + 0.85);
    warmTops.push([x, floorY + 0.3, ZB + 0.85]);
    statusLeds.push({ p: [x + 0.28, floorY + 0.11, ZB + 0.85], color: '#5cf29a', rate: 0 });
  });
  // 12 V: one copper bar per board, from under its converter forward along the board's inboard edge, in a power channel of
  // its own beside the regulator columns it feeds (it used to run under the GPU packages, sharing their NVLink channel)
  const barX = s => s * 0.15, barZ0 = ZB + 0.6, barZ1 = 1.95;
  for (const s of [-1, 1]) S.box(0.08, 0.02, barZ1 - barZ0, MAT.copper, barX(s), floorY + 0.04, (barZ0 + barZ1) / 2);
  // the bars' volumes: a 12 V route inside one is inside the conductor it stands for (tools/flow-audit.mjs)
  const bars12 = [-1, 1].map(s => [barX(s) - 0.04, floorY + 0.03, barZ0, barX(s) + 0.04, floorY + 0.05, barZ1]);

  // ---------- two superchip boards ----------
  const gpus = [], cpus = [], PKG = trayPackage(model.accel.id), pkgLog = packageLog(0.1);
  const dieM = texMat(dieTex(), { rough: 0.22, metal: 0.3 }), cpuTex = texMat(pkgTex(cpuLabel), { rough: 0.5 });
  for (const bx of [-1.1, 1.1]) {
    S.box(2.0, 0.02, 5.8, MAT.pcb, bx, floorY + 0.01, -0.35);
    boardFinish(N, finish, bx, floorY + 0.014, -0.35, 2.0, 5.8);
    // Grace near the front, LPDDR5X either side
    const cz = 1.75; cpus.push([bx, cz]);
    const cp = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.05, 0.62), [MAT.hbm, MAT.hbm, cpuTex, MAT.hbm, MAT.hbm, MAT.hbm]); cp.position.set(bx, floorY + 0.045, cz); cp.castShadow = true; scene.add(cp);
    if (heavy) ihsLid(S, N, bx, floorY + 0.071, cz, 0.66, 0.66, heavy);
    // Soldered LPDDR5X beside Grace on both GB200 and GB300 (NVIDIA's GB300
    // reference architecture lists LPDDR5 CPU memory; SOCAMM on GB300 is disputed).
    for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
      const lx = bx + side * NVL_LPDDR.dx, lz = cz + NVL_LPDDR.z0 + i * NVL_LPDDR.pitch;
      S.box(0.16, 0.025, 0.2, MAT.black, lx, floorY + 0.03, lz);                                            // LPDDR5X package
      if (heavy) N.box(0.1, 0.008, 0.13, MAT.hbm, lx, floorY + 0.043, lz);                                   // die-side detail, one shade lighter
    }
    // two GPUs
    for (const gz of [0.2, -1.55]) {
      gpus.push([bx, gz]);
      // the package, from the descriptor the chip level draws too (gpu-package.js)
      const gi = gpus.length - 1, slab = (kind, w, h, d, mat, px, py, pz) => { pkgLog.note(gi, kind, w, d, px - bx, pz - gz); S.box(w, h, d, mat, px, py, pz); };
      slab('substrate', PKG.substrate.w, 0.04, PKG.substrate.d, MAT.pcbBlack, bx, floorY + 0.04, gz);
      slab('interposer', PKG.interposer.w, 0.012, PKG.interposer.d, MAT.silicon, bx, floorY + 0.066, gz);
      for (const D of PKG.dies) { pkgLog.note(gi, 'die', D.w, D.d, D.x, D.z); const d = new THREE.Mesh(new THREE.BoxGeometry(D.w, 0.02, D.d), [MAT.silicon, MAT.silicon, dieM, MAT.silicon, MAT.silicon, MAT.silicon]); d.position.set(bx + D.x, floorY + 0.082, gz + D.z); scene.add(d); }
      for (const h of PKG.hbm) slab('hbm', h.w, 0.03, h.d, MAT.hbm, bx + h.x, floorY + 0.087, gz + h.z);
      // board-to-board connector along the substrate's rear edge, and a ring of decoupling caps
      if (heavy) { connectorPins(N, bx - (PKG.substrate.w / 2 - 0.07), bx + (PKG.substrate.w / 2 - 0.07), floorY + 0.062, gz - (PKG.substrate.d / 2 - 0.015), 16); capField(N, bx, gz, floorY + 0.03, PKG.substrate.w / 2 - 0.04, 8, 0.016); }
      // VRM ring: inductors with power stages inside them, on three sides, bright metal caps on top. The rear row leaves
      // a channel on the package centerline for the NVLink escape (tray-pcb.js), the same on every GPU.
      const ring = [];
      // each inductor's power stage sits beside it toward the package: inboard of a column, forward of the rear row
      for (let i = 0; i < 8; i++) { ring.push([bx - 0.72, gz - 0.42 + i * 0.12, 0.1, 0]); ring.push([bx + 0.72, gz - 0.42 + i * 0.12, -0.1, 0]); }
      for (let i = 0; i < 7; i++) if (i !== 3) ring.push([bx - 0.36 + i * 0.12, gz - 0.62, 0, 0.1]);
      ring.forEach(([x, z, dx, dz]) => {
        S.box(0.1, 0.07, 0.09, MAT.inductor, x, floorY + 0.055, z);
        inductorTop(N, x, floorY + 0.091, z, 0.1);
        N.box(0.06, 0.012, 0.06, MAT.black, x + dx, floorY + 0.026, z + dz);
      });
      for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; if (Math.sin(a) < 0 && Math.abs(Math.cos(a)) * 0.56 < 0.08) continue; N.box(0.02, 0.012, 0.012, MAT.beige, bx + Math.cos(a) * 0.56, floorY + 0.026, gz + Math.sin(a) * 0.56); }
      N.box(0.08, 0.01, 0.08, MAT.black, bx + 0.6, floorY + 0.025, gz - 0.62);          // controller
      // 12 V into the ring: off the board's bar, straight across into the inboard regulator column (at a right angle
      // over the C2C channel beside it)
      { const s = Math.sign(bx);
        flows.push(flow([[barX(s), floorY + 0.04, gz + 0.06], [bx - s * 0.72, floorY + 0.055, gz + 0.06]], 'bus12',
          { count: 6, speed: 0.9, size: 0.03, trailR: 0.01, audit: { within: bars12, why: 'out of the 12 V bar it is drawn from' } })); }
      // Core power runs from the ring into the substrate edge, below the die and HBM tops.
      for (const side of [-1, 1]) for (const dz of [-0.3, 0, 0.3]) flows.push(flow([[bx + side * 0.64, floorY + 0.05, gz + dz], [bx + side * (PKG.substrate.w / 2 - 0.055), floorY + 0.05, gz + dz * 0.8]], 'core', { count: 3, speed: 0.35, size: 0.018, trailR: 0.006, k: 2.6, trailK: 0.2 }));
    }
  }
  // clip to the converters, converters onto the 12 V runs. The rack busbar's current passes through the clip's
  // sprung contacts inside its housing; the 12 V trunk leaves each converter and runs inside the copper bar.
  const clipBox = [[-0.25, 0.03, ZB - 0.3, 0.25, 0.33, ZB + 0.25]];
  for (const s of [-1, 1]) flows.push(flow([[0, 0.2, ZB - 0.2], [0, 0.2, ZB + 0.4], [s * 0.47, 0.12, ZB + 0.6], [s * 0.47, 0.12, ZB + 0.85]], 'dc',
    { count: 10, speed: 1.2, size: 0.028, k: 1.8, trailR: 0.01, audit: { within: clipBox, why: 'through the busbar clip contacts in their housing' } }));
  for (const s of [-1, 1]) flows.push(flow([[s * 0.47, floorY + 0.04, ZB + 0.85], [barX(s), floorY + 0.04, ZB + 0.85], [barX(s), floorY + 0.04, 1.85]], 'bus12',
    { count: 18, speed: 1.1, size: 0.03, trailR: 0.01, audit: { within: [...bars12, [s * 0.47 - 0.31, floorY, ZB + 0.6, s * 0.47 + 0.31, floorY + 0.1, ZB + 1.1]], why: 'out of the converter into the 12 V bar, forward inside it' } }));

  // ---------- cold plates, lifted to show the chips ----------
  const lift = 0.55;
  const plateLoop = [];
  // heat per plate: a GPU package or a CPU with its memory; each board's loop carries its three plates
  const { gpuW, cpuW } = model.accel, boardW = 2 * gpuW + cpuW;
  for (const bx of NVL_BOARD_X) {
    const pts = [];
    [[bx, NVL_CPU.z, NVL_CPU.size], [bx, NVL_GPU_Z[0], NVL_GPU_SIZE], [bx, NVL_GPU_Z[1], NVL_GPU_SIZE]].forEach(([x, z, s], k) => {
      coldPlateDetail(S, finish, x, floorY + 0.1 + lift, z, s, heavy);
      N.cyl(0.035, 0.08, MAT.nickel, x - 0.2, floorY + 0.23 + lift, z, 10); N.cyl(0.035, 0.08, MAT.nickel, x + 0.2, floorY + 0.23 + lift, z, 10);
      pts.push([x, z]);
      const [part, watts] = k === 0 ? [`cpu-${bx}`, cpuW] : [`gpu-${bx}-${k}`, gpuW];
      for (const [dx, dz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) heatFlows.push(tagHeat(flow([[x + dx * s, floorY + 0.09, z + dz * s], [x + dx * s, floorY + 0.1 + lift, z + dz * s]], 'hot', { count: 3, speed: 0.5, size: 0.028, k: 2.6, trail: false }), part, watts));
    });
    plateLoop.push(pts);
    const y = floorY + 0.28 + lift;
    const qdX = bx * 1.45;
    // supply: rear quick disconnect → CPU plate → GPU → GPU → back
    const sup = [[qdX, 0.25, ZB - 0.05], [qdX, y, ZB + 0.3], [bx - 0.2, y, -1.55], [bx - 0.2, y, 0.2], [bx - 0.2, y, 1.75]];
    const ret = [[bx + 0.2, y, 1.75], [bx + 0.2, y, 0.2], [bx + 0.2, y, -1.55], [qdX + 0.15, y, ZB + 0.3], [qdX + 0.15, 0.25, ZB - 0.05]];
    // EPDM hose (circuit-tinted jacket) with a colored ID band either side of each turned fitting
    // (hex body, collars); the animated flows still carry supply/return color.
    for (const [pts, band, jacket] of [[sup, MAT.pipeBlue, hoseMat.sup], [ret, MAT.pipeRed, hoseMat.ret]]) {
      tube(N, pts, 0.034, jacket, { seg: 10 });
      const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)));
      for (let i = 1; i < pts.length - 1; i++) {
        const t = i / (pts.length - 1), p = curve.getPoint(t), d = curve.getTangent(t).multiplyScalar(0.05);
        N.strut(p.clone().sub(d).toArray(), p.clone().add(d).toArray(), 0.048, MAT.nickel, 6);
        for (const s of [-1, 1]) {
          N.strut(p.clone().addScaledVector(d, s * 1.0).toArray(), p.clone().addScaledVector(d, s * 1.5).toArray(), 0.04, MAT.nickel, 16);
          N.strut(p.clone().addScaledVector(d, s * 2.2).toArray(), p.clone().addScaledVector(d, s * 3.0).toArray(), 0.037, band, 16);
        }
      }
    }
    // power-mode coolant beads stay small and below clipping: the heat layer carries the coolant story
    flows.push(flow(sup, 'cool', { count: 14, speed: 0.8, size: 0.022, k: 1.5, trail: false }));
    flows.push(flow(ret, 'warm', { count: 14, speed: 0.8, size: 0.022, k: 1.5, trail: false }));
    heatFlows.push(tagHeat(flow(sup, 'cool', { count: 20, speed: 0.8, size: 0.045, k: 2.4, trailR: 0.034, trailK: 0.45 }), `water-${bx}`, boardW, 'carrier'));
    heatFlows.push(tagHeat(flow(ret, 'warm', { count: 20, speed: 0.8, size: 0.045, k: 2.4, trailR: 0.034, trailK: 0.45 }), `water-${bx}`, boardW, 'carrier'));
    S.cylZ(0.07, 0.2, MAT.nickel, qdX, 0.25, ZB - 0.1, 12); S.cylZ(0.07, 0.2, MAT.nickel, qdX + 0.15, 0.25, ZB - 0.1, 12);
  }

  // ---------- rear connectors, front NICs, DPU, drives, fans ----------
  // NVLink connectors: dark housing in a metal shroud, a recessed contact field
  // on the mating (rear) face and guide pins at both ends; no gold slab on top.
  for (const x of [-1.9, -1.1, 1.1, 1.9]) nvConnector(S, N, x, 0.15, ZB + 0.2);
  const nicCardX = [];
  for (let i = 0; i < 4; i++) {
    const x = -1.7 + i * 0.5, ncx = x + 1.9;
    nicCardX.push(ncx);
    // GB200: one ConnectX-7 per mezzanine board (SemiAnalysis: Mirror Mezz onto
    // the main board). Boards end behind the cages; cables bridge the gap.
    if (!ultra) { S.box(0.42, 0.02, 0.93, MAT.pcb, ncx, floorY + 0.2, ZF - 1.185); for (const sx of [-1, 1]) for (const z of [ZF - 1.6, ZF - 0.77]) N.cyl(0.012, 0.19, MAT.nickel, ncx + sx * 0.17, floorY + 0.095, z, 8); }
    S.box(0.3, 0.12, 0.5, MAT.alu, ncx, floorY + 0.28, ZF - 1.2);
    statusLeds.push({ p: [ncx - 0.09, floorY + 0.35, ZF - 0.98], color: '#5cf29a', rate: 0.5 }, { p: [ncx + 0.09, floorY + 0.35, ZF - 0.98], color: '#3fa8ff', rate: 1.8 });
  }
  // GB300: NVIDIA's reference architecture lists two mezzanine network boards
  // with two ConnectX-8 chips each. Each board carries both chip sinks under
  // one shared top plate; the board-to-board connector sits at its rear edge.
  if (ultra) for (const cx of [(nicCardX[0] + nicCardX[1]) / 2, (nicCardX[2] + nicCardX[3]) / 2]) {
    S.box(0.92, 0.02, 0.93, MAT.pcb, cx, floorY + 0.2, ZF - 1.185);
    for (const sx of [-1, 1]) for (const z of [ZF - 1.6, ZF - 0.77]) N.cyl(0.012, 0.19, MAT.nickel, cx + sx * 0.42, floorY + 0.095, z, 8);
    S.box(0.6, 0.03, 0.06, MAT.black, cx, floorY + 0.18, ZF - 1.6);
    // Dark anodized shared plate with milled grooves, so it reads as a machined
    // part beside the finned sinks rather than a pale blank (finish representative).
    S.box(0.8, 0.012, 0.5, finish.graphite, cx, 0.466, ZF - 1.2);
    for (let k = 0; k < 7; k++) N.box(0.72, 0.008, 0.02, finish.recess, cx, 0.4725, ZF - 1.2 - 0.195 + k * 0.065);
  }
  const dpuX = ultra ? [-.35] : [-.8,-.3];
  for (const x of dpuX) {
    S.box(.40,.02,1.2,MAT.pcbBlack,x,floorY+.2,3.65);S.box(.30,.14,.65,MAT.alu,x,floorY+.29,3.65);
    statusLeds.push({p:[x,floorY+.37,3.38],color:'#e8b23d',rate:2.4});
  }
  for (let i = 0; i < 4; i++) { const dx = -1.95 + i * 0.26; S.box(0.22, 0.34, 1.1, MAT.darkSteel, dx, 0.2, ZF - 0.6); statusLeds.push({ p: [dx, 0.38, ZF - 0.06], color: '#5cf29a', rate: 0.3 }); }  // E1.S drives
  const trayFans = [];
  NVL_FAN_X.forEach(fx => { S.box(0.38, 0.36, 0.3, MAT.fan, fx, 0.2, ZF - 1.95); N.cylZ(0.15, 0.02, MAT.darkSteel, fx, 0.2, ZF - 1.79, 16); trayFans.push({ p: [fx, 0.2, ZF - 1.76], axis: 'z', r: 0.14 }); });
  // Blackwell retains peripheral air cooling; Rubin has a separate fanless builder.
  const allLiquid = false;
  const nvlFans = spinners(trayFans, MAT.darkSteel, { speed: allLiquid ? 0 : 9 }); nvlFans.mesh.userData.computeDynamic = 'rotor'; scene.add(nvlFans.mesh);

  // optical module cages behind the bezel, each with its own small heat sink; built here, before
  // S/N.build() below, so the cages, pull tabs and fins are part of the merged geometry
  const nicX = [0.2, 0.7, 1.2, 1.7];
  // The cages stand on their own front boards. GB300 (Lenovo LP2357): two OSFP
  // boards with two ports each. GB200: one front cage board (representative).
  const cageBoards = ultra ? [[0.45, 0.92], [1.45, 0.92]] : [[0.95, 1.96]];
  for (const [cx, w] of cageBoards) {
    S.box(w, 0.016, 0.61, MAT.pcb, cx, 0.162, ZF - 0.335);
    for (const sx of [-1, 1]) for (const z of [ZF - 0.58, ZF - 0.09]) N.cyl(0.012, 0.124, MAT.nickel, cx + sx * (w / 2 - 0.04), 0.092, z, 8);
  }
  nicFlyovers(S, N, nicX, { nicTop: floorY + 0.21, cageTop: 0.17, zNic: ZF - 0.8, zCage: ZF - 0.57, style: ultra ? 'flyover' : 'densilink',
    clips: ultra ? [[0.12, 0.78], [1.12, 1.78]] : nicX.map(x => [x - 0.065, x + 0.065]) });
  // board population: decoupling around the GPUs, Grace and LPDDR5X, output
  // capacitors beside each regulator phase, and bypass rows by each NIC chip
  const top = floorY + 0.02;
  gpus.forEach(([gx, gz], k) => {
    // front edge and both sides (the rear edge carries the board-to-board connector and a regulator row)
    for (const [g, pitch] of [[0.03, 0.03], [0.05, 0.045]]) {
      smdRow(N, top, [gx - 0.46, gz + 0.475 + g], [gx + 0.46, gz + 0.475 + g], Math.round(0.92 / pitch), true, k * 11 + g * 100);
      for (const sx of [-1, 1]) smdRow(N, top, [gx + sx * (0.475 + g), gz - 0.44], [gx + sx * (0.475 + g), gz + 0.46], Math.round(0.9 / pitch), false, k * 13 + sx + g * 100);
    }
    for (let i = 0; i < 8; i++) for (const sx of [-1, 1]) smdRow(N, top, [gx + sx * 0.565, gz - 0.44 + i * 0.12], [gx + sx * 0.565, gz - 0.4 + i * 0.12], 2, false, k * 40 + i);
  });
  cpus.forEach(([cx, cz], k) => {
    smdFrame(N, top, cx, cz, 0.58, 0.58, 0.05, 0.032, 90 + k);
    for (const side of [-1, 1]) for (let i = 0; i < 4; i++) smdRow(N, top, [cx + side * 0.655, cz - 0.4 + i * 0.24], [cx + side * 0.655, cz - 0.32 + i * 0.24], 3, false, 95 + i + k * 4);
  });
  for (const x of nicX) {
    smdRow(N, floorY + 0.21, [x - 0.12, ZF - 1.47], [x + 0.12, ZF - 1.47], 9, true, x * 31);
    smdRow(N, floorY + 0.21, [x + 0.19, ZF - 1.4], [x + 0.19, ZF - 1.0], 7, false, x * 37);
  }
  // A module seated in each cage: its nose stands 15 mm proud of the cage mouth with the MPO receptacle on its
  // face, a pull tab below and the lid label on the exposed top (single-port OSFP at the NIC).
  const lidAt = [];
  nicX.forEach(x => {
    S.box(0.2, 0.14, 0.5, MAT.galv, x, 0.24, ZF - 0.28); if (heavy) cageFins(N, x, 0.33, ZF - 0.28, 0.18, 0.42, 3);
    N.box(.15, .088, .15, MAT.nickel, x, .23, ZF + .045);
    N.box(.10, .05, .006, MAT.polymer, x, .23, ZF + .123);
    N.box(.04, .008, .07, MAT.black, x, .182, ZF + .135);
    statusLeds.push({ p: [x + .06, .25, ZF + .1215], color: '#5cf29a', rate: 0 });
    lidAt.push({ p: [x, .274, ZF + .075], face: 'top', yaw: 0 });
  });

  scene.add(S.build()); scene.add(N.build({ cast: false }));
  flows.forEach(f => scene.add(f.group));
  trayLidLabels(scene, model.accel, lidAt, [.13, .065]);

  // ---------- data: NVLink out the back, C2C to the CPU, NIC and optics out the front ----------
  // Every route follows its board bus (tray-pcb.js nvlLayout), each interface in its own channel: NVLink leaves every GPU
  // the same way, out of the package's rear edge through the channel in its regulator row (a via at the escape, then the
  // top layer). The rear GPU's runs straight back into the connector behind it; the front GPU's turns once between the
  // GPUs and runs straight back along the outboard channel into the outer connector. C2C runs on the centerline (Grace
  // to the front GPU) and along the inboard channel (Grace to the rear GPU); 12 V has the inboard edge; nothing runs
  // under a regulator. The two boards mirror each other.
  const yD = floorY + 0.14, yT = floorY + 0.07, yIn = floorY + 0.01, ch = 0.8325;
  const inBoard = { within: [[-2.1, floorY, -3.25, 2.1, floorY + 0.02, 2.55]], why: 'escape on an inner layer under the package edge, up a via to the top layer' };
  gpus.forEach(([gx, gz], i) => {
    const s = Math.sign(gx), X = u => gx + s * u, front = gz > 0;
    const route = front
      ? [[gx, yIn, gz - 0.3], [gx, yIn, gz - 0.56], [gx, yT, gz - 0.56], [gx, yT, -0.62], [gx + s * 0.08, yT, -0.7], [X(ch) - s * 0.08, yT, -0.7], [X(ch), yT, -0.78], [X(ch), yT, ZB + 0.3]]
      : [[gx, yIn, gz - 0.3], [gx, yIn, gz - 0.56], [gx, yT, gz - 0.56], [gx, yT, ZB + 0.3]];
    dataFlows.push(flow(route, 'nvl', { count: 10, speed: 0.9, size: 0.026, k: 2.4, trailR: 0.009, audit: inBoard }));
    // Representative board routing, not an OEM trace map. Cross the fan row
    // through its open service gaps; a diagonal to the NIC used to cut through
    // the fan motors. Keep the NIC leg beside its heat sink before entering
    // the module, rather than drawing electricity through the metal fins.
    const laneX = [-0.36, -0.12, 0.12, 0.36][i];
    const fanGapX = [-1.33, -0.57, 0.95, 1.71][i];
    dataFlows.push(flow([[gx + 0.3, yD, gz + 0.3],
      [laneX, 0.20, gz + 0.3], [laneX, 0.20, 2.16],
      [fanGapX, 0.20, 2.16], [fanGapX, 0.20, 2.835],
      // up onto the NIC board ahead of its edge (z 2.85), not through it
      [nicX[i] - 0.22, 0.26, 2.835], [nicX[i] - 0.22, 0.26, 3.62],
      // then out along its flyover cable, riding just above the jacket, into the cage
      [nicX[i], 0.33, 3.70], [nicX[i], 0.35, 3.80], [nicX[i], 0.30, 3.90],
      [nicX[i], 0.24, 3.97], [nicX[i], 0.24, ZF]],
    'eth', { count: 10, speed: 0.9, size: 0.03, k: 2.3, trailR: 0.01 }));
  });
  // C2C: one lane each way within each bus. To the front GPU on the centerline (escape vias under Grace's and the GPU's
  // decoupling rows, top layer between); to the rear GPU along the inboard channel and into the rear GPU's front edge.
  cpus.forEach(([cx, cz]) => {
    const s = Math.sign(cx), X = u => cx + s * u;
    const front = x => [[x, yIn, cz - 0.2], [x, yIn, 1.3], [x, yT, 1.3], [x, yT, 0.86], [x, yIn, 0.86], [x, yIn, 0.6]];
    const rear = d => [[X(-0.24) + d, yIn, cz - 0.2], [X(-0.24) + d, yIn, 1.22], [X(-0.24) + d, yT, 1.22], [X(-0.835) + d, yT, 1.12], [X(-0.835) + d, yT, -0.72],
      [X(-0.2) + d, yT, -0.78], [X(-0.2) + d, yT, -0.93], [X(-0.2) + d, yIn, -0.93], [X(-0.2) + d, yIn, -1.25]];
    const opts = { count: 5, speed: 0.6, size: 0.022, k: 2.2, trailR: 0.008, audit: inBoard };
    dataFlows.push(flow(front(X(0.05)), 'c2c', opts));
    dataFlows.push(flow(front(X(0.11)).reverse(), 'c2c', opts));
    dataFlows.push(flow(rear(-s * 0.012), 'c2c', opts));
    dataFlows.push(flow(rear(s * 0.012).reverse(), 'c2c', opts));
  });
  // the DPU's ports: out of the chip under its sink, forward over its board to the bezel
  for (const x of dpuX) dataFlows.push(flow([[x, floorY + 0.27, 3.65], [x, floorY + 0.27, 4.05], [x, 0.26, 4.15], [x, 0.26, ZF]], 'eth', { count: 5, speed: 0.6, size: 0.028, k: 1.6, trailR: 0.01 }));
  dataFlows.forEach(f => scene.add(f.group));
  // air over the parts water does not reach, front to back
  // the air carries what water does not reach: one tray's share of the rack's NICs, DPUs, drives, fans and
  // management, and of its bus-converter losses
  const trayAirW = (model.accel.nicKW + model.accel.otherKW + model.rack.ibcLossKW) * 1000 / 18;
  if (!allLiquid) for (let i = 0; i < 6; i++) { const x = -1.9 + i * 0.76 + 0.19; heatFlows.push(tagHeat(flow([[x, 0.3, ZF - 1.75], [x, 0.3, ZF - 3.2], [x * 0.9, 0.34, ZB + 1.5]], 'air', { count: 6, speed: 0.9, size: 0.04, k: 2.0, opacity: 0.8, trail: false }), 'tray-air', trayAirW, 'carrier')); }
  balanceHeat(heatFlows);
  heatFlows.forEach(f => scene.add(f.group));

  // status LEDs on the NICs, DPU, drives and converters; a faint warm-air shimmer over the bus converters
  const leds = blinkers(statusLeds); scene.add(leds.mesh);
  // each bus converter's loss (the rack's over 18 trays and four converters) against a GPU: on the one log rule
  const ibcW = model.rack.ibcLossKW * 1000 / 18 / ibcX.length;
  const shimmer = heavy ? plumes(warmTops.map(p => ({ p, dir: [0, 1, 0] })), { perEmitter: 8, size: 0.13, grow: 2.0, life: 1.8, rise: 0.3, drift: [0.03, 0, 0.015], spread: 0.14, color: '#ffddb0', opacity: heatIntensity(0.1, ibcW, gpuW), additive: true }) : null;
  if (shimmer) scene.add(shimmer.points);

  // The power layer's glow (src/power-glow.js): every part on the tray that draws power, on its own watts. The GPUs,
  // Grace and its memory from the model; each regulator column and row its share of the GPU's conversion loss;
  // each bus converter its share of the rack's; the rack's NIC and DPU power over the tray's NIC chips and DPUs, its
  // drive, fan and management power over the drives and fans, evenly; each module its fabric allowance.
  const PD = [], A_ = model.accel, onBoard = floorY + 0.022;
  const lp = PART_W.superchip.lpddr, ringW = A_.gpuW * (1 / A_.vrmEff - 1);
  gpus.forEach(([x, z], i) => {
    PD.push({ id: `gpu-${i}`, part: 'gpu', watts: A_.gpuW, volt: 'core', at: [x, onBoard, z], size: [PKG.substrate.w, PKG.substrate.d] });
    for (const s of [-1, 1]) PD.push({ id: `vrm-${i}-${s}`, part: 'vrm', watts: ringW * 8 / 22, at: [x + s * 0.67, onBoard, z], size: [0.22, 0.95] });
    PD.push({ id: `vrm-${i}-rear`, part: 'vrm', watts: ringW * 6 / 22, at: [x, onBoard, z - 0.57], size: [0.82, 0.2] });
  });
  cpus.forEach(([x, z], i) => {
    PD.push({ id: `cpu-${i}`, part: 'grace', watts: A_.cpuW - 8 * lp, volt: 'core', at: [x, onBoard, z], size: [0.62, 0.62] });
    for (const side of [-1, 1]) for (let k = 0; k < 4; k++) PD.push({ id: `lpddr-${i}-${side}-${k}`, part: 'lpddr', watts: lp, at: [x + side * 0.55, onBoard, z - 0.36 + k * 0.24], size: [0.16, 0.2] });
  });
  ibcX.forEach((x, i) => PD.push({ id: `ibc-${i}`, part: 'ibc', watts: model.rack.ibcLossKW * 1000 / 18 / ibcX.length, at: [x, onBoard, ZB + 0.85], size: [0.62, 0.5] }));
  const nicEach = A_.nicKW * 1000 / 18 / (nicCardX.length + dpuX.length), otherEach = A_.otherKW * 1000 / 18 / (4 + 6);
  nicCardX.forEach((x, i) => PD.push({ id: `nic-${i}`, part: 'nic', watts: nicEach, at: [x, floorY + 0.212, ZF - 1.2], size: [0.3, 0.5] }));
  dpuX.forEach((x, i) => PD.push({ id: `dpu-${i}`, part: 'nic', watts: nicEach, at: [x, floorY + 0.212, 3.65], size: [0.3, 0.65] }));
  for (let i = 0; i < 4; i++) PD.push({ id: `drive-${i}`, part: 'nic', watts: otherEach, at: [-1.95 + i * 0.26, floorY + 0.002, ZF - 0.6], size: [0.22, 1.1] });
  for (let i = 0; i < 6; i++) PD.push({ id: `fan-${i}`, watts: otherEach, at: [-1.9 + i * 0.76 + 0.19, floorY + 0.002, ZF - 1.95], size: [0.38, 0.3] });
  nicX.forEach((x, i) => PD.push({ id: `osfp-${i}`, part: 'osfp', watts: FABRICS[A_.nicPortGbps].gpuModuleW, volt: 'v33', at: [x, 0.172, ZF - 0.28], size: [0.2, 0.5] }));

  const [g0x, g0z] = gpus[1];
  // GPU close-up: from the front, in the gap between the board and the lifted
  // plates, looking down on the package (dies and HBM), as on H100 and Rubin.
  const gpuClose = { pos: [gpus[3][0], 0.2, gpus[3][1]], view: componentView([gpus[3][0], 0.07, gpus[3][1]], [0.25, 0.4, 1.3], [0.6, 0.2, 0.6]) };
  finishCompute(scene, finish);
  scene.userData.gpuPackageDrawn = pkgLog;
  scene.userData.computeGeneration = { id: model.accel.id, gpus: 4, cpus: 2, fans: 6, dpuCount: dpuX.length, nicCount: 4, nic: ultra ? 'ConnectX-8' : 'ConnectX-7', memoryModules: 'soldered LPDDR5X', nicBoards: ultra ? 2 : 4, representative: true };
  return {
    // the GPU name etched on each package's front substrate margin, clear of its capacitor ring (package-marks.js)
    printSpots: [etch('GPU package marking', GPU_NAME[model.accel.id], [.2, .055], gpus.map(([x, z]) => ({ from: [x - .15, floorY + .075, z + (PKG.interposer.d + PKG.substrate.d) / 4], dir: [0, -1, 0] }))),
      // GB300: Lenovo's LP2357 guide lists E1.S drives of 7.68 TB (and 3.84 TB); each sled's release paddle carries it
      ...(ultra ? [{ name: 'E1.S drive capacity', lines: [{ text: 'E1.S', size: .34, weight: 700 }, { text: '7.68 TB', size: .4, weight: 700 }],
        text: { px: 96, aspect: 1.6, ink: '#c9cfd6', align: 'center', pad: .04 }, size: [.11, .068],
        spots: [0, 1, 2, 3].map(i => ({ from: [-1.95 + i * 0.26, .29, ZF + .7], dir: [0, 0, -1] })), material: { roughness: .5 } }] : [])],
    scene, flows, powerDraw: PD,
    look: { env: 'studio', envIntensity: 0.5, exposure: 0.98, bloom: 0.36, threshold: 2.0, ao: 0.12, dof: true },
    camera: { pos: [5.9, 6.4, 8.3], target: [0, 0.1, -0.5], near: 0.02, far: 400, min: 1, max: 30 },
    hotspots: {
      osfp: { pos: [0.7, 0.4, ZF - 0.2], view: { pos: [1.6, 1.4, 6.8], target: [0.9, 0.2, ZF - 0.3] } },
      clip: { pos: [0, 0.4, ZB - 0.15], view: { pos: [2.4, 2.2, -7.5], target: [0, 0.2, ZB] } },
      ibc: { pos: [-0.47, 0.35, ZB + 0.85], view: { pos: [-1.9, 2.5, -1.6], target: [-0.4, 0.1, ZB + 0.9] } },
      vrm: { pos: [g0x + 0.72, 0.2, g0z + 0.1], view: { pos: [g0x + 2.2, 1.6, g0z + 1.4], target: [g0x, 0.05, g0z] } },
      gpu: gpuClose,
      grace: { pos: [cpus[0][0], 0.18, cpus[0][1]], view: { pos: [cpus[0][0] - 1.4, 1.8, cpus[0][1] + 1.8], target: [cpus[0][0], 0.05, cpus[0][1]] } },
      // Close on the outboard LPDDR5X column beside Grace; the pin sits on a package, not bare board.
      lpddr: { pos: [cpus[1][0] + 0.55, 0.12, cpus[1][1] - 0.12], view: { pos: [cpus[1][0] + 1.6, 1.4, cpus[1][1] + 1.4], target: [cpus[1][0] + 0.4, 0.05, cpus[1][1]] } },
      coldplates: { pos: [-1.1, 0.95, 0.2], view: { pos: [-3.6, 2.6, 2.4], target: [-1.1, 0.6, 0] } },
      nic: { pos: [1.2, 0.5, ZF - 1.0], view: { pos: [2.8, 2.4, 6.6], target: [0.8, 0.2, ZF - 1] } },
      nvconn: { pos: [1.9, 0.4, ZB + 0.2], view: { pos: [3.6, 2.2, -6.4], target: [1.6, 0.2, ZB] } },
    },
    dataFlows, heatFlows,
    // tools/flows.mjs: NVLink and C2C stay over a board: the two superchip boards and the rear power board, plus the
    // gap between them where each NVLink route leaves its board-edge connector for the rear board
    flowAudit: { floatR: 0.25, boardCls: ['nvl', 'c2c'], boards: [[-2.1, -0.1, -3.25, 2.55], [0.1, 2.1, -3.25, 2.55], [-2.1, 2.1, ZB + 0.15, ZB + 1.15],
      ...[-1, 1].flatMap(s => [[s * 1.9325 - 0.06, s * 1.9325 + 0.06], [s * 1.1 - 0.06, s * 1.1 + 0.06]].map(([a, b]) => [Math.min(a, b), Math.max(a, b), ZB + 1.1, ZB + 1.3]))] },
    heatHotspots: {
      osfp: { pos: [0.7, 0.4, ZF - 0.2], view: { pos: [1.6, 1.4, 6.8], target: [0.9, 0.2, ZF - 0.3] } },
      coldplates: { pos: [-1.1, 0.95, 0.2], view: { pos: [-3.6, 2.6, 2.4], target: [-1.1, 0.6, 0] } },
      gpuheat: { pos: [gpus[3][0], 0.2, gpus[3][1]], view: { pos: [gpus[3][0] + 1.5, 2.0, gpus[3][1] + 1.8], target: [gpus[3][0], 0.05, gpus[3][1]] } },
      fans: { pos: [0.2, 0.5, ZF - 1.95], view: { pos: [2.4, 2.4, 6.8], target: [0.4, 0.2, ZF - 2] } },
      qd: { pos: [1.6, 0.4, ZB - 0.1], view: { pos: [3.6, 2.2, -6.4], target: [1.6, 0.2, ZB] } },
    },
    dataHotspots: {
      nvconn: { pos: [1.9, 0.4, ZB + 0.2], view: { pos: [3.6, 2.2, -6.4], target: [1.6, 0.2, ZB] } },
      c2c: { pos: [cpus[0][0], 0.3, 1.0], view: { pos: [cpus[0][0] - 1.8, 2.0, 2.8], target: [cpus[0][0], 0.05, 1.0] } },
      cx: { pos: [1.2, 0.45, ZF - 1.1], view: { pos: [2.8, 2.4, 6.6], target: [0.8, 0.2, ZF - 1] } },
      osfp: { pos: [0.7, 0.4, ZF - 0.2], view: { pos: [1.6, 1.4, 6.8], target: [0.9, 0.2, ZF - 0.3] } },
      dpu: { pos: [-0.35, 0.5, ZF - 1.0], view: { pos: [-1.4, 2.0, 6.4], target: [-0.35, 0.2, ZF - 1.0] } },
      gpu: gpuClose,
    },
    update(t) { nvlFans.update(t); leds.update(t); if (shimmer) shimmer.update(t); },
  };
}
