// Scene 4: one compute tray, lid off. World unit = 10 cm (the tray is 4.4 units wide).
// Front faces +z. NVL72 racks: two superchip boards, each one CPU and two GPUs.
// H100: a DGX H100 server, the GPU baseboard below and the CPU tray cut away above.
import { THREE, MAT, Builder, flow, canvasTex, texMat, glowMat, spinners } from '../kit.js';
import { rbox, tube, bundle, blinkers, plumes } from '../fx.js';
import { buildRubin } from './tray-rubin.js';
import { computeMaterials, finishCompute, coldPlateDetail, boardFinish } from './compute-finish.js';
import { frameCompute } from './compute-framing.js';
import { componentView } from '../app/housing-frame.js';
import { printDecals, textTexture } from './print-kit.js';
import { nicLabel, labelLines } from './lid-labels.js';
import { etch, GPU_NAME } from './package-marks.js';

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
function dieTex() {
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
function ihsLid(S, N, x, y, z, w, d, heavy) {
  for (const s of [-1, 1]) { S.box(w, 0.022, 0.035, MAT.nickel, x, y, z + s * (d / 2 - 0.0175)); S.box(0.035, 0.022, d - 0.07, MAT.nickel, x + s * (w / 2 - 0.0175), y, z); }
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
function buildHGX({ quality }) {
  const scene = new THREE.Scene();
  lights(scene, quality);
  const flows = [], dataFlows = [], heatFlows = [];
  const S = new Builder(), N = new Builder();
  const finish = computeMaterials();
  const W = 4.4, D = 9, H = 3.56, ZF = D / 2, ZB = -D / 2, fy = 0.03;

  // chassis: floor, far side, rear wall; the lid is off and the near side is cut low, like a section drawing
  S.box(W, 0.03, D, MAT.galv, 0, 0.015, 0);
  S.box(0.03, H, D, MAT.galv, -W / 2, H / 2, 0);
  const CUT = 0.45;
  S.box(0.03, CUT, D, MAT.galv, W / 2, CUT / 2, 0); N.box(0.034, 0.02, D, glowMat('#d9dde2', 0.8), W / 2, CUT + 0.01, 0);
  // Open rear service frame: the former solid wall covered the actual optical
  // sockets and incorrectly enclosed their outgoing signal paths.
  S.box(W, .12, .03, MAT.galv, 0, H - .06, ZB);
  for (const x of [-W / 2 + .03, W / 2 - .03]) S.box(.06, H - .12, .03, MAT.galv, x, (H - .12) / 2, ZB);

  chassisLip(N, -W / 2, H, D, 1, !quality.mobile);

  // fan wall at the front: two rows of six modules. NVIDIA's service manual
  // lists two fans per module (front and rear), so each open housing carries a
  // front and a rear rotor on a motor strut. Module count stays representative.
  const fanX = i => -1.85 + i * 0.74, frontFans = [];
  for (const y of [0.9, 2.6]) for (let i = 0; i < 6; i++) {
    const x = fanX(i);
    for (const s of [-1, 1]) { S.box(0.7, 0.035, 0.45, MAT.fan, x, y + s * 0.3825, ZF - 0.35); S.box(0.035, 0.73, 0.45, MAT.fan, x + s * 0.3325, y, ZF - 0.35); }
    for (const z of [ZF - 0.2, ZF - 0.48]) {
      N.cylZ(0.075, 0.07, MAT.fan, x, y, z, 10);
      for (const a of [0.5, 2.6, 4.7]) N.box(0.3, 0.018, 0.018, MAT.fan, x + Math.cos(a) * 0.17, y + Math.sin(a) * 0.17, z - 0.04, 0, 0, a);
      frontFans.push({ p: [x, y, z + 0.045], axis: 'z', r: 0.28 });
    }
  }
  const hgxFans = spinners(frontFans, MAT.darkSteel, { speed: 9 }); hgxFans.mesh.userData.computeDynamic = 'rotor'; scene.add(hgxFans.mesh);

  // GPU baseboard, full width, from behind the fans to the middle of the chassis
  S.box(W - 0.2, 0.03, 5.0, MAT.pcb, 0, fy + 0.015, 1.3);
  boardFinish(N, finish, 0, fy + 0.024, 1.3, W - 0.2, 5.0);
  const gpuX = [-1.62, -0.54, 0.54, 1.62], gpuZ = [2.75, 1.05];
  const gpus = [];
  gpuZ.forEach(z => gpuX.forEach(x => gpus.push([x, z])));
  const LIFT = 1.5;                                  // the front-left heat sink is lifted to show the package
  const dieM = texMat(dieTex(), { rough: 0.22, metal: 0.3 });
  const heavy = !quality.mobile;
  const hotTops = [], nicLeds = [];
  gpus.forEach(([x, z], i) => {
    S.box(0.9, 0.03, 1.4, MAT.pcbBlack, x, fy + 0.05, z);                                  // SXM5 module board
    boardFinish(N, finish, x, fy + 0.06, z, 0.9, 1.4, 0.5);
    S.box(0.5, 0.03, 0.52, MAT.pcbBlack, x, fy + 0.08, z);                                 // package substrate
    const d = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.02, 0.32), [MAT.silicon, MAT.silicon, dieM, MAT.silicon, MAT.silicon, MAT.silicon]); d.position.set(x, fy + 0.105, z); scene.add(d);
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) S.box(0.09, 0.03, 0.1, k === 2 && s > 0 ? MAT.silicon : MAT.hbm, x + s * 0.2, fy + 0.11, z - 0.12 + k * 0.12);
    // integrated heat spreader / stiffener lid over the die, and the decoupling caps ringing the package
    ihsLid(S, N, x, fy + 0.116, z, 0.56, 0.58, heavy);
    if (heavy) { capField(N, x, z, fy + 0.05, 0.32, 10); connectorPins(N, x - 0.42, x + 0.42, fy + 0.065, z - 0.68, 14); }
    // VRM rows either side of the module, bright metal caps on top
    for (const s of [-1, 1]) for (let k = 0; k < 9; k++) { const vx = x + s * 0.4, vz = z - 0.56 + k * 0.14; S.box(0.07, 0.06, 0.07, MAT.inductor, vx, fy + 0.1, vz); inductorTop(N, vx, fy + 0.131, vz, 0.07); }
    // heat sink: copper base, a stack of fins running front to back
    const y0 = fy + 0.12 + (i === 0 ? LIFT : 0);
    S.box(0.86, 0.08, 1.3, MAT.copper, x, y0 + 0.04, z);
    for (let f = 0; f < 16; f++) N.box(0.018, 1.05, 1.28, MAT.alu, x - 0.4 + f * 0.0533, y0 + 0.6, z);
    // Representative heat pipes: out of the copper base, up both sides and
    // across through the fin stack; folded straps and end flanges hold the fins.
    for (const [k, zz] of [-0.42, -0.14, 0.14, 0.42].entries()) {
      const sx = k % 2 ? 1 : -1, top = y0 + 0.62 + (k % 2) * 0.28;
      tube(S, [[x + sx * 0.2, y0 + 0.06, z + zz], [x + sx * 0.445, y0 + 0.16, z + zz], [x + sx * 0.455, top - 0.12, z + zz], [x + sx * 0.33, top, z + zz], [x - sx * 0.36, top, z + zz]], 0.028, MAT.copper, { seg: 10, steps: 18 });
    }
    for (const sz of [-1, 1]) { S.box(0.86, 0.014, 0.1, MAT.galv, x, y0 + 1.132, z + sz * 0.45); S.box(0.86, 0.12, 0.014, MAT.galv, x, y0 + 1.07, z + sz * 0.643); }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      S.cyl(0.022, 0.05, MAT.nickel, x + sx * 0.38, y0 + 0.105, z + sz * 0.58, 12);
      if (i === 0) S.cyl(0.012, LIFT, MAT.nickel, x + sx * 0.38, fy + 0.12 + LIFT / 2, z + sz * 0.58, 10);   // guide posts: the lift is a service position
    }
    hotTops.push([x, y0 + 1.15, z]);
    // 12 V to the ring, core power into the package
    flows.push(flow([[x, fy + 0.07, -0.95], [x, fy + 0.07, z - 0.7], [x + 0.4, fy + 0.14, z - 0.56]], 'bus12', { count: 6, speed: 0.9, size: 0.03, trailR: 0.01 }));
    // Core power leaves the VRM row at board level and enters the package
    // through the substrate edge, so the die and HBM tops stay clear.
    if (i === 0) for (const s of [-1, 1]) for (const dz of [-0.3, 0, 0.3]) flows.push(flow([[x + s * 0.36, fy + 0.08, z + dz], [x + s * 0.22, fy + 0.08, z + dz * 0.8]], 'core', { count: 3, speed: 0.35, size: 0.018, trailR: 0.006, k: 2.6, trailK: 0.2 }));
    // heat: up from the die into the sink, then swept back by the air
    heatFlows.push(flow([[x, fy + 0.12, z], [x, y0 + 0.1, z]], 'hot', { count: 3, speed: 0.4, size: 0.035, k: 2.6, trail: false }));
    for (const dx of [-0.25, 0.25]) heatFlows.push(flow([[x + dx, y0 + 0.6, z + 0.9], [x + dx, y0 + 0.6, z - 0.7], [x + dx * 1.1, y0 + 0.65, z - 2.0]], 'air', { count: 4, speed: 1.0, size: 0.045, k: 2.2, opacity: 0.85, trail: false }));
  });
  // small local fill so GPU0's lifted-lid package reads clearly from the 'gpu' hotspot, not just lit from the far key
  const gpuFill = new THREE.PointLight(0xfff2df, 0.9, 3.2, 2); gpuFill.position.set(gpuX[0] - 0.15, 0.7, gpuZ[0] + 1.1); scene.add(gpuFill);
  // warm rim from behind, low and grazing: catches fin edges, heat pipes and the PSU bay (the site's amber)
  // without flooding the flat CPU-tray board, which turned olive under a steeper rim
  const amber = new THREE.DirectionalLight(0xe6ba82, 1.3); amber.name = 'H100 amber rim'; amber.position.set(-5, 1.9, -8); amber.target.position.set(0, 1.2, 0); scene.add(amber, amber.target);
  // NVSwitch chips behind the GPUs, with small sinks
  const swX = [-1.5, -0.5, 0.5, 1.5], swZ = -0.25;
  swX.forEach(x => { S.box(0.42, 0.03, 0.42, MAT.pcbBlack, x, fy + 0.05, swZ); S.box(0.4, 0.5, 0.4, MAT.alu, x, fy + 0.32, swZ); for (let f = 0; f < 8; f++) N.box(0.015, 0.45, 0.42, MAT.galv, x - 0.18 + f * 0.05, fy + 0.35, swZ); });
  // bus converters 54 → 12 V along the rear edge of the baseboard
  for (let i = 0; i < 8; i++) S.box(0.3, 0.12, 0.3, MAT.darkSteel, -1.75 + i * 0.5, fy + 0.09, -0.95);
  // 54 V bus bar from the supplies to the baseboard
  S.box(0.3, 0.05, 2.6, MAT.copper, 0, fy + 0.06, -2.35);

  // power supplies at the rear, below the CPU tray: fan grille plus a slotted vent field and a status LED
  const psuX = i => -1.83 + i * 0.73;
  const psuLeds = [];
  for (let i = 0; i < 6; i++) {
    const px = psuX(i);
    S.box(0.68, 0.7, 1.26, MAT.darkSteel, px, 0.4, ZB + 0.62); N.box(0.5, 0.5, 0.02, MAT.fan, px, 0.4, ZB - 0.019);
    if (heavy) for (let f = 0; f < 5; f++) N.box(0.5, 0.03, 0.02, MAT.black, px, 0.16 + f * 0.1, ZB + 1.245);      // proud of the PSU face, never flush
    psuLeds.push({ p: [px + 0.28, 0.68, ZB + 1.24], color: '#5cf29a', rate: 0 });
  }

  // CPU tray, cut away over the rear half so the GPUs stay in view
  const ty = 1.95, tz0 = ZB + 0.15, tz1 = -1.2, tzc = (tz0 + tz1) / 2;
  S.box(W - 0.1, 0.03, tz1 - tz0, MAT.galv, 0, ty - 0.03, tzc);
  // formed pan edges and slide rails into the side walls (the near wall is cut away in this section view)
  for (const s of [-1, 1]) { S.box(0.018, 0.09, tz1 - tz0, MAT.galv, s * (W - 0.13) / 2, ty - 0.09, tzc); S.box(0.06, 0.05, tz1 - tz0 + 0.2, MAT.darkSteel, s * (W / 2 - 0.045), ty - 0.1, tzc - 0.075); }
  S.box(W - 0.2, 0.025, tz1 - tz0 - 0.1, MAT.pcb, 0, ty, tzc);
  N.box(W - 0.1, 0.02, 0.03, glowMat('#d9dde2', 0.8), 0, ty - 0.01, tz1 + 0.01);              // lit cut edge
  const cpuTexM = texMat(pkgTex('XEON'), { rough: 0.5 });
  const cpus = [[-1.0, -2.2], [1.0, -2.2]];
  cpus.forEach(([x, z]) => {
    const cp = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.05, 0.75), [MAT.hbm, MAT.hbm, cpuTexM, MAT.hbm, MAT.hbm, MAT.hbm]); cp.position.set(x, ty + 0.04, z); scene.add(cp);
    for (let f = 0; f < 12; f++) N.box(0.015, 0.55, 0.7, MAT.alu, x - 0.28 + f * 0.05, ty + 0.35, z);   // CPU sink, fins front to back
    for (const s of [-1, 1]) for (let k = 0; k < 8; k++) {
      const dx = x + s * (0.42 + k * 0.055);
      S.box(0.025, 0.32, 1.25, k % 2 ? MAT.black : MAT.pcbBlack, dx, ty + 0.17, z);                    // DDR5 DIMMs
      if (heavy) dimmChips(N, dx, ty + 0.17, z, 0.15, 6, 1);
    }
  });
  // PCIe switches between the CPUs and the NICs
  const pcieX = [-1.6, -0.55, 0.55, 1.6], pcieZ = -1.55;
  pcieX.forEach(x => { S.box(0.3, 0.03, 0.3, MAT.pcbBlack, x, ty + 0.03, pcieZ); S.box(0.26, 0.18, 0.26, MAT.alu, x, ty + 0.13, pcieZ); });
  // Eight compute ConnectX-7 devices grouped behind four twin-port cages; two separate storage ConnectX-7 cards in the middle
  // Each card sits in line with its twin-port cage; SemiAnalysis reports DGX H100
  // routes ConnectX-7 to the OSFP cages over DensiLink flyover cables, so the
  // cards end short of the cages and two cables (one per NIC) reach each cage.
  const nicX = [-1.65, -1.05, 1.05, 1.65];
  nicX.forEach(x => { S.box(0.4, 0.02, 0.9, MAT.pcb, x, ty + 0.22, -3.3); for (const z of [-3.05,-3.5]) { S.box(.28,.025,.31,MAT.silicon,x,ty+.255,z);S.box(.28,.03,.31,finish.graphite,x,ty+.2825,z);for (let f = 0; f < 6; f++) S.box(.018,.07,.31,finish.graphite,x-.115+f*.046,ty+.332,z); } nicLeds.push({ p: [x - 0.1, ty + 0.35, -3.14], color: '#5cf29a', rate: 0.4 }, { p: [x + 0.1, ty + 0.35, -3.14], color: '#3fa8ff', rate: 1.6 }); });
  for (const x of [-0.25, 0.25]) { S.box(0.34, 0.02, 1.3, MAT.pcbBlack, x, ty + 0.3, -3.5); S.box(0.26, 0.12, 0.5, MAT.alu, x, ty + 0.37, -3.5); nicLeds.push({ p: [x, ty + 0.44, -3.28], color: '#e8b23d', rate: 2.2 }); }
  const cageX = [-1.65, -1.05, 1.05, 1.65];
  // two cage boards under the four rear cages (representative), on standoffs from the CPU-tray board
  for (const cx of [-1.35, 1.35]) {
    S.box(0.95, 0.016, 0.62, MAT.pcb, cx, ty + 0.262, ZB + 0.33);
    for (const sx of [-1, 1]) for (const z of [ZB + 0.08, ZB + 0.58]) N.cyl(0.012, 0.24, MAT.nickel, cx + sx * 0.43, ty + 0.134, z, 8);
  }
  nicFlyovers(S, N, cageX.flatMap(x => [x - 0.065, x + 0.065]), { nicTop: ty + 0.23, cageTop: ty + 0.27, zNic: -3.71, zCage: -3.93, style: 'densilink', width: 0.075, clipZ: -3.74,
    clips: cageX.map(x => [x - 0.15, x + 0.15]) });
  if (heavy) cageX.forEach(x => cageFins(N, x, ty + .47, ZB + .3, .2, .4, 4));
  cageX.forEach(x => { for(const dy of [-.08,.08])S.box(.22,.016,.5,MAT.galv,x,ty+.35+dy,ZB+.25);for(const dx of [-.11,.11])S.box(.016,.144,.5,MAT.galv,x+dx,ty+.35,ZB+.25); N.box(0.16, 0.05, 0.05, MAT.polymer, x, ty + 0.23, ZB - 0.02); nicLeds.push({ p: [x, ty + 0.44, ZB + 0.02], color: '#5cf29a', rate: 0 }); });
  // A twin-port module seated in each cage: its nose stands 15 mm proud of the rear mouth, two MPO
  // receptacles on its face and a pull tab below; the lid label prints on the exposed nose.
  const lidAt = [];
  cageX.forEach(x => {
    N.box(.19, .12, .25, MAT.nickel, x, ty + .35, ZB - .025);
    for (const dx of [-.045, .045]) N.box(.07, .05, .006, MAT.polymer, x + dx, ty + .35, ZB - .153);
    N.box(.04, .008, .07, MAT.black, x, ty + .286, ZB - .175);
    lidAt.push({ p: [x, ty + .41, ZB - .09], face: 'top', yaw: Math.PI });
  });
  // board population: decoupling rows around the NVSwitch chips, the SXM
  // packages and the CPU sockets, bypass rows by the PCIe switches
  swX.forEach((x, k) => { smdFrame(N, fy + 0.03, x, swZ, 0.42, 0.42, 0.04, 0.03, k); smdFrame(N, fy + 0.03, x, swZ, 0.42, 0.42, 0.058, 0.045, k + 20); });
  gpus.forEach(([x, z], k) => smdRow(N, fy + 0.065, [x - 0.36, z + 0.3], [x + 0.36, z + 0.3], 16, true, k + 40));
  cpus.forEach(([x, z], k) => smdFrame(N, ty + 0.0125, x, z, 0.62, 0.75, 0.04, 0.03, k + 60));
  pcieX.forEach((x, k) => smdFrame(N, ty + 0.0125, x, pcieZ, 0.3, 0.3, 0.03, 0.03, k + 70));
  // rear AC inlets and power cords
  for (let i = 0; i < 6; i++) N.box(0.14, 0.1, 0.06, MAT.black, psuX(i) + 0.2, 0.62, ZB - 0.045);
  if (heavy) for (const i of [1, 4]) bundle(N, [psuX(i) + 0.2, 0.55, ZB - 0.05], [psuX(i) + 0.2, 0.05, ZB - 0.7], { n: 2, r: 0.014, spread: 0.03, sag: 0.12, mats: [MAT.black], seed: i + 3 });

  scene.add(S.build()); scene.add(N.build({ cast: false }));
  trayLidLabels(scene, 'h100', lidAt, [.16, .08]);

  // ---------- power: AC into the supplies, 54 V forward, 12 V to the modules ----------
  for (let i = 0; i < 6; i++) flows.push(flow([[psuX(i) + 0.2, 0.6, ZB - 0.8], [psuX(i) + 0.2, 0.6, ZB + 0.05]], 'lv', { count: 4, speed: 0.6, size: 0.03, trailR: 0.01 }));
  for (let i = 0; i < 6; i++) flows.push(flow([[psuX(i), 0.4, ZB + 1.25], [psuX(i) * 0.3, fy + 0.1, -3.4], [0, fy + 0.1, -3.4]], 'dc', { count: 5, speed: 0.8, size: 0.035, trailR: 0.012 }));
  flows.push(flow([[0, fy + 0.1, -3.6], [0, fy + 0.1, -1.1]], 'dc', { count: 14, speed: 1.0, size: 0.04, trailR: 0.014 }));
  for (const s of [-1, 1]) flows.push(flow([[0, fy + 0.1, -1.1], [s * 1.75, fy + 0.1, -1.1]], 'dc', { count: 8, speed: 0.9, size: 0.035, trailR: 0.012 }));
  gpuX.forEach(x => flows.push(flow([[x, fy + 0.16, -0.95], [x, fy + 0.07, -0.95]], 'bus12', { count: 2, speed: 0.3, size: 0.03, trail: false })));
  flows.push(flow([[psuX(2), 0.8, ZB + 1.25], [psuX(2), ty, -3.0], [-1.0, ty + 0.05, -2.6]], 'dc', { count: 5, speed: 0.6, size: 0.03, trailR: 0.01 }));
  flows.forEach(f => scene.add(f.group));

  // ---------- data: NVLink to the switches, PCIe up to the switches, NICs out the back ----------
  gpus.forEach(([x, z], i) => {
    const sx = swX[i % 4];
    dataFlows.push(flow([[x + 0.15, fy + 0.13, z - 0.5], [x + 0.15, fy + 0.1, swZ + 0.5], [sx, fy + 0.1, swZ + 0.22]], 'nvl', { count: 6, speed: 0.8, size: 0.03, k: 2.4, trailR: 0.01 }));
    const px = pcieX[i % 4];
    dataFlows.push(flow([[x - 0.15, fy + 0.13, z - 0.5], [x - 0.15, fy + 0.13, -1.3], [px, ty - 0.02, -1.3], [px, ty + 0.05, pcieZ]], 'pcie', { count: 4, speed: 0.7, size: 0.028, k: 2.2, trailR: 0.009 }));
  });
  pcieX.forEach((x, i) => dataFlows.push(flow([[x, ty + 0.2, pcieZ], [x, ty + 0.2, -2.8], [nicX[i], ty + 0.3, -3.2]], 'pcie', { count: 4, speed: 0.7, size: 0.028, k: 2.2, trailR: 0.009 })));
  nicX.forEach((x, i) => dataFlows.push(flow([[x, ty + 0.42, -3.28], [x, ty + 0.42, -3.82], [cageX[i], ty + 0.36, -3.97], [cageX[i], ty + 0.35, ZB - 0.9]], 'eth', { count: 6, speed: 0.9, size: 0.03, k: 2.3, trailR: 0.01 })));
  cpus.forEach(([x, z]) => dataFlows.push(flow([[x, ty + 0.1, z + 0.4], [x * 0.9, ty + 0.1, pcieZ]], 'pcie', { count: 3, speed: 0.5, size: 0.025, k: 2.0, trail: false })));
  dataFlows.forEach(f => scene.add(f.group));
  // air through the whole server, front to back
  for (let i = 0; i < 6; i++) for (const y of [0.9, 2.6]) heatFlows.push(flow([[fanX(i), y, ZF - 0.6], [fanX(i), y, 0.2], [fanX(i) * 0.95, y, ZB + 1.4], [fanX(i) * 0.9, y + 0.1, ZB - 0.8]], 'air', { count: 5, speed: 1.1, size: 0.05, k: 2.0, opacity: 0.75, trail: false }));
  heatFlows.forEach(f => scene.add(f.group));

  // status LEDs on the NICs, DPU and PSUs; a faint heat shimmer over the hottest heat sinks
  const leds = blinkers(nicLeds.concat(psuLeds)); scene.add(leds.mesh);
  const shimmer = heavy ? plumes(hotTops.map(p => ({ p, dir: [0, 1, 0] })), { perEmitter: 10, size: 0.16, grow: 2.2, life: 2.2, rise: 0.35, drift: [0.04, 0, 0.02], spread: 0.18, color: '#ffddb0', opacity: 0.12, additive: true }) : null;
  if (shimmer) scene.add(shimmer.points);

  const [g0x, g0z] = gpus[0], [g5x, g5z] = gpus[5];
  // Inspect through the open gap below the lifted sink, from inside the front
  // fan wall. The old external view looked directly into the fan cartridges.
  // A fitted close view (detailSize) so generic reframing cannot pull the
  // camera back out through the fan wall: the package is the subject.
  const hsGpu = { pos: [g0x, fy + 0.4, g0z], view: componentView([g0x, fy + 0.13, g0z - 0.05], [0.22, 0.72, 0.8], [0.8, 0.3, 0.75]) };
  // From the cut-away side, level with the fin tops: both rows of sinks, the
  // lifted one included, stay in frame (the old view sat over the fan wall).
  const hsSink = { pos: [g5x, 1.3, g5z], view: { pos: [g5x + 3.6, 2.05, g5z + 1.1], target: [g5x - 0.2, 0.75, g5z + 0.7] } };
  finishCompute(scene, finish);
  scene.userData.computeGeneration = { id: 'h100', gpus: 8, cpus: 2, fans: 12, dpuCount: 0, nicCount: 8, storageNicCount: 2, opticalPorts: 4, representative: true };
  return {
    // the GPU name etched on each package's substrate, ahead of the die inside the stiffener ring (package-marks.js)
    printSpots: [etch('GPU package marking', GPU_NAME.h100, [.16, .036], gpus.map(([x, z]) => ({ from: [x, fy + .104, z + .188], dir: [0, -1, 0] })))],
    scene, flows,
    look: { env: 'studio', envIntensity: 0.5, exposure: 0.95, bloom: 0.38, threshold: 2.0, ao: 0.14, dof: true },
    camera: { pos: [9.2, 8.4, 4.6], target: [0, 0.7, -0.2], near: 0.02, far: 400, min: 1, max: 30 },
    hotspots: {
      osfp: { pos: [cageX[3], ty + 0.5, ZB + 0.25], view: { pos: [1.6, 6.0, -3.4], target: [1.3, ty + .25, ZB + .28] } },
      psu: { pos: [psuX(4), 0.9, ZB + 0.65], view: { pos: [3.4, 3.0, -8.0], target: [0.8, 0.5, ZB + 0.6] } },
      ibc: { pos: [-1.25, 0.3, -0.95], view: { pos: [-1.0, 1.55, -.55], target: [-1.25, .12, -.95] } },
      vrm: { pos: [g0x + 0.4, 0.25, g0z], view: { pos: [g0x + .72, 1.1, g0z + .8], target: [g0x + .4, .2, g0z] } },
      gpu: hsGpu,
      cpu: { pos: [cpus[1][0], ty + 0.7, cpus[1][1]], view: { pos: [3.2, 4.2, 0.4], target: [1, ty, -2.2] } },
      heatsinks: hsSink,
      nvswitch: { pos: [swX[2], 0.7, swZ], view: { pos: [.5, 1.8, .1], target: [.5, .4, swZ] } },
      nic: { pos: [nicX[3], ty + 0.4, -3.3], view: { pos: [1.4, 6.2, -2.9], target: [1.4, ty + .2, -3.5] } },
    },
    dataFlows, heatFlows,
    heatHotspots: {
      osfp: { pos: [cageX[3], ty + 0.5, ZB + 0.25], view: { pos: [1.6, 6.0, -3.4], target: [1.3, ty + .25, ZB + .28] } },
      heatsinks: hsSink,
      gpuheat: hsGpu,
      fans: { pos: [fanX(3), 3.1, ZF - 0.35], view: { pos: [1.6, 3.8, 8.2], target: [0.2, 1.6, ZF - 0.5] } },
    },
    dataHotspots: {
      nvswitch: { pos: [swX[1], 0.7, swZ], view: { pos: [-.5, 1.8, .1], target: [-.5, .4, swZ] } },
      pcie: { pos: [pcieX[2], ty + 0.35, pcieZ], view: { pos: [2.2, 3.8, 1.4], target: [0.6, ty, pcieZ] } },
      cx: { pos: [nicX[0], ty + 0.4, -3.3], view: { pos: [-1.4, 6.2, -2.9], target: [-1.4, ty + .2, -3.5] } },
      osfp: { pos: [cageX[3], ty + 0.5, ZB + 0.25], view: { pos: [1.6, 6.0, -3.4], target: [1.3, ty + .25, ZB + .28] } },
      dpu: { pos: [0.25, ty + 0.55, -3.5], view: { pos: [0.8, 4.2, -6.4], target: [0, ty, -3.5] } },
      gpu: hsGpu,
    },
    update(t) { hgxFans.update(t); leds.update(t); if (shimmer) shimmer.update(t); },
  };
}

// ---------- NVL72 compute tray: two superchip boards, liquid-cooled ----------
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
  const ibcX = [-1.5, -0.55, 0.55, 1.5];
  ibcX.forEach(x => {
    S.box(0.62, 0.08, 0.5, MAT.darkSteel, x, floorY + 0.06, ZB + 0.85);
    for (let f = 0; f < 11; f++) N.box(0.02, 0.2, 0.46, MAT.alu, x - 0.28 + f * 0.056, floorY + 0.2, ZB + 0.85);
    warmTops.push([x, floorY + 0.3, ZB + 0.85]);
    statusLeds.push({ p: [x + 0.28, floorY + 0.11, ZB + 0.85], color: '#5cf29a', rate: 0 });
  });
  // 12 V copper runs forward along each board
  for (const bx of [-1.1, 1.1]) { S.box(0.12, 0.02, 5.2, MAT.copper, bx, floorY + 0.04, -0.9); S.box(0.12, 0.02, 5.2, MAT.copper, bx + 0.16, floorY + 0.04, -0.9); }

  // ---------- two superchip boards ----------
  const gpus = [], cpus = [];
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
      const lx = bx + side * 0.55, lz = cz - 0.36 + i * 0.24;
      S.box(0.16, 0.025, 0.2, MAT.black, lx, floorY + 0.03, lz);                                            // LPDDR5X package
      if (heavy) N.box(0.1, 0.008, 0.13, MAT.hbm, lx, floorY + 0.043, lz);                                   // die-side detail, one shade lighter
    }
    // two GPUs
    for (const gz of [0.2, -1.55]) {
      gpus.push([bx, gz]);
      S.box(0.95, 0.04, 0.95, MAT.pcbBlack, bx, floorY + 0.04, gz);                 // substrate
      S.box(0.7, 0.012, 0.66, MAT.silicon, bx, floorY + 0.066, gz);                  // interposer
      for (const dx of [-0.16, 0.16]) { const d = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.4), [MAT.silicon, MAT.silicon, dieM, MAT.silicon, MAT.silicon, MAT.silicon]); d.position.set(bx + dx, floorY + 0.082, gz); scene.add(d); }
      for (const dx of [-0.24, -0.08, 0.08, 0.24]) for (const dz of [-0.27, 0.27]) S.box(0.13, 0.03, 0.1, MAT.hbm, bx + dx, floorY + 0.087, gz + dz);
      // board-to-board connector along the substrate's rear edge, and a ring of decoupling caps
      if (heavy) { connectorPins(N, bx - 0.4, bx + 0.4, floorY + 0.062, gz - 0.46, 16); capField(N, bx, gz, floorY + 0.03, 0.42, 8, 0.016); }
      // VRM ring: inductors with power stages inside them, on three sides, bright metal caps on top
      const ring = [];
      for (let i = 0; i < 8; i++) { ring.push([bx - 0.72, gz - 0.42 + i * 0.12]); ring.push([bx + 0.72, gz - 0.42 + i * 0.12]); }
      for (let i = 0; i < 7; i++) ring.push([bx - 0.36 + i * 0.12, gz - 0.62]);
      ring.forEach(([x, z]) => {
        S.box(0.1, 0.07, 0.09, MAT.inductor, x, floorY + 0.055, z);
        inductorTop(N, x, floorY + 0.091, z, 0.1);
        const inward = Math.sign(bx - x) || 0;
        N.box(0.06, 0.012, 0.06, MAT.black, x + inward * 0.1, floorY + 0.026, z + (inward === 0 ? 0.1 : 0));
      });
      for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; N.box(0.02, 0.012, 0.012, MAT.beige, bx + Math.cos(a) * 0.56, floorY + 0.026, gz + Math.sin(a) * 0.56); }
      N.box(0.08, 0.01, 0.08, MAT.black, bx + 0.6, floorY + 0.025, gz - 0.62);          // controller
      // 12 V into the ring, core power into the package
      flows.push(flow([[bx, floorY + 0.06, ZB + 1.3], [bx, floorY + 0.06, gz - 0.62], [bx - 0.36, floorY + 0.09, gz - 0.62]], 'bus12', { count: 10, speed: 0.9, size: 0.03, trailR: 0.01 }));
      // Core power runs from the ring into the substrate edge, below the die and HBM tops.
      for (const side of [-1, 1]) for (const dz of [-0.3, 0, 0.3]) flows.push(flow([[bx + side * 0.64, floorY + 0.05, gz + dz], [bx + side * 0.42, floorY + 0.05, gz + dz * 0.8]], 'core', { count: 3, speed: 0.35, size: 0.018, trailR: 0.006, k: 2.6, trailK: 0.2 }));
    }
  }
  // clip to the converters, converters onto the 12 V runs
  flows.push(flow([[0, 0.2, ZB - 0.2], [0, 0.2, ZB + 0.4], [-1.5, 0.12, ZB + 0.6], [-1.5, 0.12, ZB + 0.85]], 'dc', { count: 10, speed: 1.2, size: 0.028, k: 1.8, trailR: 0.01 }));
  flows.push(flow([[0, 0.2, ZB - 0.2], [0, 0.2, ZB + 0.4], [1.5, 0.12, ZB + 0.6], [1.5, 0.12, ZB + 0.85]], 'dc', { count: 10, speed: 1.2, size: 0.028, k: 1.8, trailR: 0.01 }));
  for (const bx of [-1.1, 1.1]) flows.push(flow([[bx * 1.36, 0.12, ZB + 1.1], [bx, floorY + 0.06, ZB + 1.3], [bx, floorY + 0.06, 1.4]], 'bus12', { count: 18, speed: 1.1, size: 0.03, trailR: 0.01 }));

  // ---------- cold plates, lifted to show the chips ----------
  const lift = 0.55;
  const plateLoop = [];
  for (const bx of [-1.1, 1.1]) {
    const pts = [];
    [[bx, 1.75, 0.66], [bx, 0.2, 0.9], [bx, -1.55, 0.9]].forEach(([x, z, s]) => {
      coldPlateDetail(S, finish, x, floorY + 0.1 + lift, z, s, heavy);
      N.cyl(0.035, 0.08, MAT.nickel, x - 0.2, floorY + 0.23 + lift, z, 10); N.cyl(0.035, 0.08, MAT.nickel, x + 0.2, floorY + 0.23 + lift, z, 10);
      pts.push([x, z]);
      for (const [dx, dz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) heatFlows.push(flow([[x + dx * s, floorY + 0.09, z + dz * s], [x + dx * s, floorY + 0.1 + lift, z + dz * s]], 'hot', { count: 3, speed: 0.5, size: 0.028, k: 2.6, trail: false }));
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
    heatFlows.push(flow(sup, 'cool', { count: 20, speed: 0.8, size: 0.045, k: 2.4, trailR: 0.034, trailK: 0.45 }));
    heatFlows.push(flow(ret, 'warm', { count: 20, speed: 0.8, size: 0.045, k: 2.4, trailR: 0.034, trailK: 0.45 }));
    S.cylZ(0.07, 0.2, MAT.nickel, qdX, 0.25, ZB - 0.1, 12); S.cylZ(0.07, 0.2, MAT.nickel, qdX + 0.15, 0.25, ZB - 0.1, 12);
  }

  // ---------- rear connectors, front NICs, DPU, drives, fans ----------
  // NVLink connectors: dark housing in a metal shroud, a recessed contact field
  // on the mating (rear) face and guide pins at both ends; no gold slab on top.
  for (const x of [-1.9, -1.15, 1.15, 1.9]) nvConnector(S, N, x, 0.15, ZB + 0.2);
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
  for (let i = 0; i < 6; i++) { S.box(0.38, 0.36, 0.3, MAT.fan, -1.9 + i * 0.76 + 0.19, 0.2, ZF - 1.95); N.cylZ(0.15, 0.02, MAT.darkSteel, -1.9 + i * 0.76 + 0.19, 0.2, ZF - 1.79, 16); trayFans.push({ p: [-1.9 + i * 0.76 + 0.19, 0.2, ZF - 1.76], axis: 'z', r: 0.14 }); }
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
  const nvX = [-1.9, -1.15, 1.15, 1.9], yD = floorY + 0.14;
  gpus.forEach(([gx, gz], i) => {
    dataFlows.push(flow([[gx, yD, gz - 0.3], [gx + (nvX[i] - gx) * 0.5, yD, ZB + 0.9], [nvX[i], 0.16, ZB + 0.36]], 'nvl', { count: 10, speed: 0.9, size: 0.03, k: 2.4, trailR: 0.01 }));
    // Representative board routing, not an OEM trace map. Cross the fan row
    // through its open service gaps; a diagonal to the NIC used to cut through
    // the fan motors. Keep the NIC leg beside its heat sink before entering
    // the module, rather than drawing electricity through the metal fins.
    const laneX = [-0.36, -0.12, 0.12, 0.36][i];
    const fanGapX = [-1.33, -0.57, 0.95, 1.71][i];
    dataFlows.push(flow([[gx + 0.3, yD, gz + 0.3],
      [laneX, 0.20, gz + 0.3], [laneX, 0.20, 2.16],
      [fanGapX, 0.20, 2.16], [fanGapX, 0.20, 2.88],
      [nicX[i] - 0.22, 0.25, 2.88], [nicX[i] - 0.22, 0.25, 3.62],
      // then out along its flyover cable, riding just above the jacket, into the cage
      [nicX[i], 0.33, 3.70], [nicX[i], 0.35, 3.80], [nicX[i], 0.30, 3.90],
      [nicX[i], 0.24, 3.97], [nicX[i], 0.24, ZF]],
    'eth', { count: 10, speed: 0.9, size: 0.03, k: 2.3, trailR: 0.01 }));
  });
  cpus.forEach(([cx, cz]) => {
    dataFlows.push(flow([[cx, yD, cz - 0.3], [cx, yD, 0.55]], 'c2c', { count: 5, speed: 0.6, size: 0.028, k: 2.2, trailR: 0.01 }));
    dataFlows.push(flow([[cx + 0.1, yD, 0.55], [cx + 0.1, yD, cz - 0.3]], 'c2c', { count: 5, speed: 0.6, size: 0.028, k: 2.2, trailR: 0.01 }));
  });
  for (const x of dpuX) dataFlows.push(flow([[x, floorY + 0.3, ZF - 1.2], [x, 0.24, ZF]], 'eth', { count: 5, speed: 0.6, size: 0.028, k: 1.6, trailR: 0.01 }));
  dataFlows.forEach(f => scene.add(f.group));
  // air over the parts water does not reach, front to back
  if (!allLiquid) for (let i = 0; i < 6; i++) { const x = -1.9 + i * 0.76 + 0.19; heatFlows.push(flow([[x, 0.3, ZF - 1.75], [x, 0.3, ZF - 3.2], [x * 0.9, 0.34, ZB + 1.5]], 'air', { count: 6, speed: 0.9, size: 0.04, k: 2.0, opacity: 0.8, trail: false })); }
  heatFlows.forEach(f => scene.add(f.group));

  // status LEDs on the NICs, DPU, drives and converters; a faint warm-air shimmer over the bus converters
  const leds = blinkers(statusLeds); scene.add(leds.mesh);
  const shimmer = heavy ? plumes(warmTops.map(p => ({ p, dir: [0, 1, 0] })), { perEmitter: 8, size: 0.13, grow: 2.0, life: 1.8, rise: 0.3, drift: [0.03, 0, 0.015], spread: 0.14, color: '#ffddb0', opacity: 0.1, additive: true }) : null;
  if (shimmer) scene.add(shimmer.points);

  const [g0x, g0z] = gpus[1];
  // GPU close-up: from the front, in the gap between the board and the lifted
  // plates, looking down on the package (dies and HBM), as on H100 and Rubin.
  const gpuClose = { pos: [gpus[3][0], 0.2, gpus[3][1]], view: componentView([gpus[3][0], 0.07, gpus[3][1]], [0.25, 0.4, 1.3], [0.6, 0.2, 0.6]) };
  finishCompute(scene, finish);
  scene.userData.computeGeneration = { id: model.accel.id, gpus: 4, cpus: 2, fans: 6, dpuCount: dpuX.length, nicCount: 4, nic: ultra ? 'ConnectX-8' : 'ConnectX-7', memoryModules: 'soldered LPDDR5X', nicBoards: ultra ? 2 : 4, representative: true };
  return {
    // the GPU name etched on each package's front substrate margin, clear of its capacitor ring (package-marks.js)
    printSpots: [etch('GPU package marking', GPU_NAME[model.accel.id], [.2, .055], gpus.map(([x, z]) => ({ from: [x - .15, floorY + .075, z + .40], dir: [0, -1, 0] })))],
    scene, flows,
    look: { env: 'studio', envIntensity: 0.5, exposure: 0.98, bloom: 0.36, threshold: 2.0, ao: 0.12, dof: true },
    camera: { pos: [5.9, 6.4, 8.3], target: [0, 0.1, -0.5], near: 0.02, far: 400, min: 1, max: 30 },
    hotspots: {
      osfp: { pos: [0.7, 0.4, ZF - 0.2], view: { pos: [1.6, 1.4, 6.8], target: [0.9, 0.2, ZF - 0.3] } },
      clip: { pos: [0, 0.4, ZB - 0.15], view: { pos: [2.4, 2.2, -7.5], target: [0, 0.2, ZB] } },
      ibc: { pos: [-1.5, 0.35, ZB + 0.85], view: { pos: [-2.8, 2.5, -1.6], target: [-1, 0.1, ZB + 0.9] } },
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
