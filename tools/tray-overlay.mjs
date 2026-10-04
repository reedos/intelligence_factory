// Tray-versus-tray gate: is the compute tray the rack pulls out the same tray the tray level draws?
//
// For each accelerator (gb200 gb300 rubin h100) it renders the tray level (level 5, scene index 4) and the rack level's pulled compute
// tray (level 4, scene index 3) from the same top-down orthographic camera, framed on the tray level's own bounding box at the same scale and
// orientation (front +z at the bottom, +x to the right), and compares what each draws:
//   - <accel>-tray.png, <accel>-rack.png   the two shaded views (labels, pins, flows and glows hidden)
//   - <accel>-overlay.png                  the two shaded views averaged 50/50 (a tray that coincides looks like one tray)
//   - <accel>-diff.png                     |difference| of the two height maps (white = the height maps disagree by more than 2 mm; red = one tray has surface where the other has none)
//   - <accel>-tray-parts.json / -rack-parts.json   every part (a connected piece of surface): material, x, z, w, d, y0, y1 in
//                                          millimetres of the tray's own frame (x across, z along, front +z, y up from the floor)
//   - <accel>-compare.json                 parts only one tray has, parts offset by more than 5 mm, resized, or in another material
// and prints those, then exits 1 if any accelerator differs (so it can gate a build). Parts under 8 mm in plan (screws,
// passives) are not compared: that is the level of detail the rack draws at.
//
// Usage (against a built preview or a dev server; run one gate at a time):
//   URL=http://127.0.0.1:<port>/visualizer.html IFX_GATE_GPU=1 node tools/tray-overlay.mjs [accel ...]
//   OUT=<folder>        where the images and JSON go (default shots/tray-overlay)
//   TOL=5 MIN_MM=8      offset tolerance and the smallest part compared, in millimetres
//   REPORT_ONLY=1       print and write everything but always exit 0
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const partsSrc = fs.readFileSync(path.join(here, 'tray-parts.mjs'), 'utf8').replace(/^export /gm, '');
const { compareParts, RACK_OWNED: OWNED } = await import('./tray-parts.mjs');

const OUT = process.env.OUT || 'shots/tray-overlay';
const TOL = +(process.env.TOL || 5), MIN_MM = +(process.env.MIN_MM || 8);
const accels = process.argv.slice(2).length ? process.argv.slice(2) : ['gb200', 'gb300', 'rubin', 'h100'];
fs.mkdirSync(OUT, { recursive: true });

const gateArgs = process.env.IFX_GATE_GPU === '1'
  ? ['--use-angle=d3d11', '--ignore-gpu-blocklist']
  : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const b = await chromium.launch({ args: gateArgs });
const p = await b.newPage({ viewport: { width: 1000, height: 700 } });
p.on('pageerror', e => console.log('pageerror', e.message));
await p.goto(process.env.URL || 'http://127.0.0.1:47400/visualizer.html');
await p.waitForFunction(() => window.ifx && window.ifx.state.scene === 0, null, { timeout: 90000 });
await p.addScriptTag({ content: partsSrc });

// Everything the page does lives in this function (it is serialized into the page).
async function capture({ scene, accel, frame, zRear, PX_PER_MM, ignore }) {
  const ifx = window.ifx, T = ifx.THREE;
  await ifx.setScenario({ accel });
  await ifx.go(scene);
  await new Promise(r => { const t0 = performance.now(); const tick = () => (ifx.state.scene === scene && ifx.built[scene] && performance.now() - t0 > 600) || performance.now() - t0 > 60000 ? r() : requestAnimationFrame(tick); tick(); });
  ifx.setMode('power'); ifx.settle();
  const B = ifx.built[scene], root = B.scene, R = ifx.renderer();
  const rack = scene === 3, hook = root.userData.pulledTray;
  if (rack && !hook) throw new Error('the rack scene reports no pulledTray frame');
  // tray frame -> this level's world: the tray level draws in tray units (10 cm) about its own origin, the rack in metres
  const unit = rack ? 1 : 10, o = rack ? [hook.x, hook.floor, hook.z] : [0, 0, 0];   // origin of the tray inside this level's world
  const toMm = [o[0], o[1], o[2], rack ? 1000 : 100];                                // (world - origin) * toMm[3] = tray millimetres
  const physical = ob => isHardware(ob, ignore);
  // hide the teaching overlays: flows, sprites, lines, points, pins live in the DOM and are not in the render at all
  const hidden = [];
  for (const k of ['flows', 'dataFlows', 'heatFlows']) for (const f of B[k] || []) { hidden.push([f.group, f.group.visible]); f.group.visible = false; }
  root.traverse(ob => { if (ob.isSprite || ob.isPoints || ob.isLine || ob.isLineSegments || ob.userData.nativeOverlay) { hidden.push([ob, ob.visible]); ob.visible = false; } });
  const rotors = []; root.traverse(ob => { if (ob.userData.computeDynamic === 'rotor') rotors.push(ob); });
  for (const ob of rotors) ob.visible = false;                                           // drawn by position (below), not by the pose they spin through
  root.updateMatrixWorld(true);
  // the window: the tray level's bounding box, in tray millimetres
  const [fx0, fx1, fy0, fy1, fz0, fz1] = frame;
  const pad = 20;                                                                      // mm of margin
  const W = Math.round((fx1 - fx0 + 2 * pad) * PX_PER_MM), H = Math.round((fz1 - fz0 + 2 * pad) * PX_PER_MM);
  const toWorld = (xmm, ymm, zmm) => [o[0] + xmm / toMm[3], o[1] + ymm / toMm[3], o[2] + zmm / toMm[3]];
  const [cx, , cz] = toWorld((fx0 + fx1) / 2, 0, (fz0 + fz1) / 2);
  const halfW = (fx1 - fx0 + 2 * pad) / 2 / toMm[3], halfH = (fz1 - fz0 + 2 * pad) / 2 / toMm[3];
  const yLo = toWorld(0, fy0 - 3, 0)[1], yHi = toWorld(0, fy1 + 3, 0)[1];
  const cam = new T.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0, yHi - yLo + 1 / unit);
  cam.position.set(cx, yHi + 1 / unit, cz); cam.up.set(0, 0, -1); cam.lookAt(cx, yLo, cz); cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
  // shaded, as the scene is lit (no post-processing, no tone mapping)
  const shadeRT = new T.WebGLRenderTarget(W, H, { samples: 4, colorSpace: T.SRGBColorSpace });
  const heightRT = new T.WebGLRenderTarget(W, H, { type: T.FloatType, samples: 0 });
  const oldTarget = R.getRenderTarget(), oldBg = root.background, oldClear = R.getClearColor(new T.Color()), oldAlpha = R.getClearAlpha(), oldAuto = R.autoClear, oldSM = R.shadowMap.autoUpdate;
  R.autoClear = true; R.shadowMap.autoUpdate = false;
  R.setClearColor(0x0b0d10, 1); root.background = null;
  R.setRenderTarget(shadeRT); R.render(root, cam);
  const shade = new Uint8Array(W * H * 4); R.readRenderTargetPixels(shadeRT, 0, 0, W, H, shade);
  // heights: world y above the tray floor, in mm, from a pass that ignores light and texture
  const mat = new T.ShaderMaterial({ side: T.DoubleSide, uniforms: { floorY: { value: o[1] }, k: { value: toMm[3] } },
    vertexShader: 'varying float vY; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vY = w.y; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: 'uniform float floorY; uniform float k; varying float vY; void main(){ gl_FragColor = vec4((vY - floorY) * k, 1.0, 0.0, 1.0); }' });
  root.overrideMaterial = mat; R.setClearColor(0x000000, 1);
  const gone = [];   // meshes the height pass must not draw (the same filter the part list uses)
  root.traverse(ob => { if (ob.isMesh && ob.visible && !physical(ob)) { gone.push(ob); ob.visible = false; } });
  R.setRenderTarget(heightRT); R.render(root, cam);
  const hf = new Float32Array(W * H * 4); R.readRenderTargetPixels(heightRT, 0, 0, W, H, hf);
  for (const ob of gone) ob.visible = true;
  root.overrideMaterial = null; root.background = oldBg; R.setRenderTarget(oldTarget); R.setClearColor(oldClear, oldAlpha); R.autoClear = oldAuto; R.shadowMap.autoUpdate = oldSM;
  shadeRT.dispose(); heightRT.dispose();
  // every part of the tray, from the live scene
  // every part of the tray, from the live scene (tray-parts.mjs levelParts: the same walk the vitest gate does)
  const parts = levelParts(root, T, { toMm, box: trayRegion(frame, zRear), ignore });
  for (const [ob, v] of hidden) ob.visible = v;
  for (const ob of rotors) ob.visible = true;
  const b64 = u8 => { let t = ''; for (let i = 0; i < u8.length; i += 0x8000) t += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(t); };
  const h1 = new Float32Array(W * H); for (let i = 0; i < W * H; i++) h1[i] = hf[i * 4];
  return { W, H, shade: b64(shade), height: b64(new Uint8Array(h1.buffer)), parts };
}

async function bounds(accel) {
  // the tray level's bounding box of its physical meshes, in tray millimetres
  return p.evaluate(async ({ accel }) => {
    const ifx = window.ifx, T = ifx.THREE;
    await ifx.setScenario({ accel });
    const arrive = async i => { await ifx.go(i); await new Promise(r => { const t0 = performance.now(); const tick = () => (ifx.state.scene === i && ifx.built[i] && performance.now() - t0 > 600) || performance.now() - t0 > 60000 ? r() : requestAnimationFrame(tick); tick(); }); };
    await arrive(3);
    const hook = ifx.built[3].scene.userData.pulledTray, zRear = (hook.front - hook.z) * 1000;   // the rack's front plane, in tray millimetres: behind it the tray's rear stands in the rack's frame
    await arrive(4);
    const frame = trayBounds(ifx.built[4].scene, T);
    return { frame, zRear };
  }, { accel });
}

// PNG (8-bit RGBA, bottom-up pixel rows from the GL read are flipped here)
import zlib from 'zlib';
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = buf => { let c = 0xffffffff; for (const x of buf) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function pngBytes(W, H, rgba, flip = true) {
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + (flip ? H - 1 - y : y) * W * 4, W * 4).copy(raw, y * (W * 4 + 1) + 1); }
  const chunk = (t, d) => { const o = Buffer.alloc(12 + d.length); o.writeUInt32BE(d.length, 0); o.write(t, 4, 'ascii'); d.copy(o, 8); o.writeUInt32BE(crc(o.subarray(4, 8 + d.length)), 8 + d.length); return o; };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const savePng = (name, W, H, rgba) => fs.writeFileSync(path.join(OUT, name), pngBytes(W, H, rgba));
const bytes = b64 => new Uint8Array(Buffer.from(b64, 'base64'));
const floats = b64 => { const u = Buffer.from(b64, 'base64'); return new Float32Array(u.buffer, u.byteOffset, u.length / 4).slice(); };

const PX_PER_MM = +(process.env.PX_PER_MM || 1.4);
// What is not the tray's hardware, and so is left out of both the images and the part lists (meshes made only of these materials): the
// rack's own patch leads, which run from the tray's MPO faces to the cable manager, their boots and tags; the cable manager; the closed
// trays' cage shells beside the pulled one; and printed decals (module lid labels, the GPU package etch), which are prints, not parts.
// (tray-parts.mjs RACK_OWNED; RACK_OWNED=<regex> in the environment replaces it.)
const RACK_OWNED = process.env.RACK_OWNED || OWNED;
let failures = 0;
for (const accel of accels) {
  const { frame, zRear } = await bounds(accel);
  const tray = await p.evaluate(capture, { scene: 4, accel, frame, zRear, PX_PER_MM, ignore: RACK_OWNED });
  const rack = await p.evaluate(capture, { scene: 3, accel, frame, zRear, PX_PER_MM, ignore: RACK_OWNED });
  const { W, H } = tray;
  const ts = bytes(tray.shade), rs = bytes(rack.shade), th = floats(tray.height), rh = floats(rack.height);
  // 50/50 overlay of the shaded views; white where the two height maps disagree by more than 2 mm (or only one has surface)
  const over = new Uint8Array(W * H * 4), diff = new Uint8Array(W * H * 4);
  let covered = 0, differ = 0;
  const padPx = Math.round(20 * PX_PER_MM), rearRow = Math.round((zRear - (frame[4] - 20)) * PX_PER_MM);   // rows above rearRow are behind the rack's front plane, under its frame: not compared
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    for (let k = 0; k < 3; k++) over[i * 4 + k] = (ts[i * 4 + k] + rs[i * 4 + k]) >> 1;
    over[i * 4 + 3] = 255;
    const ea = th[i] > 0.01 || ts[i * 4] + ts[i * 4 + 1] + ts[i * 4 + 2] > 80, eb = rh[i] > 0.01 || rs[i * 4] + rs[i * 4 + 1] + rs[i * 4 + 2] > 80;
    const yt = H - 1 - y;   // the GL read is bottom-up; rows are counted from the top (the rear)
    const inside = x >= padPx && x < W - padPx && yt >= Math.max(padPx, rearRow) && yt < H - padPx;   // only the tray's own bounding box counts; the margin shows what the rack has around it
    const d = Math.abs(th[i] - rh[i]), hit = inside && (ea !== eb ? true : d > 2);
    if (inside && (ea || eb)) { covered++; if (hit) differ++; }
    const g = ea || eb ? Math.min(110, 20 + Math.min(d, 4) * 20) : 0;
    diff[i * 4] = hit && (ea || eb) ? 255 : g; diff[i * 4 + 1] = hit && (ea || eb) ? (ea !== eb ? 60 : 255) : g; diff[i * 4 + 2] = hit && (ea || eb) ? (ea !== eb ? 60 : 255) : g; diff[i * 4 + 3] = 255;
  }
  savePng(`${accel}-tray.png`, W, H, ts); savePng(`${accel}-rack.png`, W, H, rs); savePng(`${accel}-overlay.png`, W, H, over); savePng(`${accel}-diff.png`, W, H, diff);
  const strip = ps => ps.map(({ mat, ...rest }) => ({ ...rest, color: '#' + mat.hex.toString(16).padStart(6, '0'), rough: +mat.rough.toFixed(2), metal: +mat.metal.toFixed(2) }));
  fs.writeFileSync(path.join(OUT, `${accel}-tray-parts.json`), JSON.stringify(strip(tray.parts), null, 1));
  fs.writeFileSync(path.join(OUT, `${accel}-rack-parts.json`), JSON.stringify(strip(rack.parts), null, 1));
  const cmp = compareParts(tray.parts, rack.parts, { tol: TOL, minMm: MIN_MM });
  const short = q => `${(q.material || '?').slice(0, 28).padEnd(28)} #${q.mat.hex.toString(16).padStart(6, '0')} x ${String(q.x).padStart(7)} z ${String(q.z).padStart(7)}  ${q.w} x ${q.d} mm  y ${q.y0}..${q.y1}`;
  const pct = covered ? (100 * differ / covered).toFixed(1) : '0';
  console.log(`\n== ${accel}: ${tray.parts.length} parts at the tray level, ${rack.parts.length} in the rack's pulled tray; ${cmp.matched} matched; ${pct}% of the tray's pixels differ`);
  const section = (title, list, f) => { console.log(`  ${title}: ${list.length}`); for (const q of list.slice(0, 40)) console.log('    ' + f(q)); if (list.length > 40) console.log(`    ... ${list.length - 40} more (see ${accel}-compare.json)`); };
  section('only at the tray level (missing from the rack)', cmp.missing, short);
  section('only in the rack (not at the tray level)', cmp.extra, short);
  section(`offset by more than ${TOL} mm`, cmp.offset, q => `${short(q.a)}  -> rack ${q.by} mm away`);
  section('different size', cmp.resized, q => `${short(q.a)}  -> rack ${q.b.w} x ${q.b.d}`);
  section('different material', cmp.material, q => `${short(q.a)}  -> rack #${q.b.mat.hex.toString(16).padStart(6, '0')}`);
  fs.writeFileSync(path.join(OUT, `${accel}-compare.json`), JSON.stringify({ accel, matched: cmp.matched, pixelsDifferPct: +pct, missing: cmp.missing, extra: cmp.extra, offset: cmp.offset, resized: cmp.resized, material: cmp.material }, (k, v) => k === 'mat' ? { hex: v.hex, rough: v.rough, metal: v.metal } : v, 1));
  const bad = cmp.missing.length + cmp.extra.length + cmp.offset.length + cmp.resized.length + cmp.material.length;
  if (bad) failures++;
  console.log(`  ${bad ? 'DIFFERENT' : 'SAME'}: ${bad} part differences`);
}
await b.close();
console.log(`\nimages and part lists in ${path.resolve(OUT)}`);
if (failures && process.env.REPORT_ONLY !== '1') { console.log(`${failures} accelerator(s) draw a different tray in the rack.`); process.exit(1); }
