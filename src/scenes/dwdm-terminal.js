// The inside of a campus line-terminal hut, cut away and set beside the hut on the campus (data layer only), like the
// duct-bank section: a corner of an insulated shelter with two open telecom racks.
//   Rack A, the line system: an 8-slot ROADM/amplifier shelf drawn to the published size of Ciena's 6500 RLS R8-300
//   (330 x 440 x 281 mm, 7.5U) and a 2RU 64-channel mux/demux (Ciena's CMD64 is 2RU, 75 GHz, 64 channels).
//   Rack B, a router whose own ports hold the coherent pluggables, one wavelength each.
// Eight colored jumpers run from the pluggables to the mux; one amber fiber carries all of them on to the ROADM shelf
// and out through the wall. Sizes other than the R8-300 shelf and the CMD64's height, the slot layout, the router and
// every port count drawn are representative (ASSUMPTIONS 'dwdm-terminal-rack'). The colors only tell the wavelengths
// apart: every one of them is infrared, near 1,550 nm.
// Units are meters, in campus world coordinates; the cutaway opens toward +x/+z, where the part camera stands.
import { THREE, MAT, flow, glowMat, textSprite } from '../kit.js';
import { rbox, tube, blinkers, lamps } from '../fx.js';
import { SiteBuilder as Builder } from './site-blender-construction.js';
import { palette } from './campus-palette.js';

const U = 0.04445;                                    // one rack unit
// eight channels, told apart by color only (schematic: all are C-band infrared)
export const LAMBDA_CSS = ['#ff5470', '#ff9a3c', '#ffe066', '#8cff6a', '#3dffc8', '#4cb8ff', '#7f6bff', '#e66bff'];

export function addLineTerminalCutaway(group, { x: ox, z: oz, y: oy = 0.15, mobile = false } = {}) {
  const B = new Builder(), G = new Builder();       // B: physical, palette-merged; G: emissive fibers and lit parts
  const std = (color, r = 0.6, m = 0.2, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: r, metalness: m, ...extra });
  const M = {
    skin: std(0xe4e6e3, 0.55, 0.05), inner: std(0x8e959c, 0.7, 0.05), core: std(0xd8c48a, 0.9, 0), floor: std(0x5f6266, 0.8, 0.05), plinth: MAT.concrete,
    frame: std(0x24272c, 0.45, 0.6), rail: std(0x3a3f46, 0.4, 0.7), chassis: std(0x2b2f35, 0.5, 0.45), face: std(0x1c1f24, 0.55, 0.35),
    card: std(0xc4c8cc, 0.5, 0.2, { emissive: 0x2a2c2f }), light: std(0xb9bec3, 0.5, 0.25, { emissive: 0x25272a }), handle: std(0x9aa3ac, 0.35, 0.85), port: std(0x08090b, 0.6, 0.1), cage: std(0x7d858e, 0.35, 0.8),
    module: std(0xb5bcc4, 0.3, 0.9), latchBlue: std(0x2f6fd6, 0.5, 0.1), latchTeal: std(0x22a39a, 0.5, 0.1), latchViolet: std(0x7b55d0, 0.5, 0.1),
    latchAmber: std(0xd99a2a, 0.5, 0.1), blank: std(0x17191d, 0.7, 0.3), vent: std(0x474d54, 0.55, 0.35), ladder: MAT.galv, yellow: MAT.yellowTray, pdu: std(0x30343a, 0.5, 0.4),
    breaker: std(0x0f1012, 0.6, 0.1), sleeve: MAT.darkSteel,
  };
  const at = (x, y, z) => [ox + x, oy + y, oz + z];
  const box = (b, w, h, d, mat, x, y, z) => b.box(w, h, d, mat, ox + x, oy + y, oz + z);
  const cyl = (b, r, h, mat, x, y, z, seg = 12, rx = 0, ry = 0, rz = 0) => b.cyl(r, h, mat, ox + x, oy + y, oz + z, seg, rx, ry, rz);
  const fiber = (b, pts, r, mat) => tube(b, pts.map(p => at(...p)), r, mat, { seg: 6 });
  const leds = [];

  // ---------- the shelter, cut away: floor, a back (north) wall and a west wall in sandwich panel, a roof stub ----------
  const X0 = -1.5, X1 = 0.95, Z0 = -1.32, Z1 = 0.75, H = 2.72, yF = 0.14;
  box(B, X1 - X0 + 0.3, 0.1, Z1 - Z0 + 0.3, M.plinth, (X0 + X1) / 2, 0.05 - 0.02, (Z0 + Z1) / 2);             // concrete pad
  box(B, X1 - X0, 0.04, Z1 - Z0, M.floor, (X0 + X1) / 2, yF - 0.02, (Z0 + Z1) / 2);                          // floor deck
  const wall = (along, len, cx, cz) => {                                                                       // 100 mm sandwich: skin, foam, skin
    for (const [t, off, mat] of [[0.008, -0.046, M.skin], [0.084, 0, M.core], [0.008, 0.046, M.inner]]) {
      if (along === 'x') box(B, len, H, t, mat, cx, yF + H / 2, cz + off); else box(B, t, H, len, mat, cx + off, yF + H / 2, cz);
    }
  };
  wall('x', X1 - X0 + 0.1, (X0 + X1) / 2 + 0.05, Z0 - 0.05);
  wall('z', Z1 - Z0, X0 - 0.05, (Z0 + Z1) / 2);
  // roof stub over the back wall: the rest of the roof is cut away
  box(B, X1 - X0 + 0.1, 0.012, 0.5, M.skin, (X0 + X1) / 2 + 0.05, yF + H + 0.006, Z0 + 0.15);
  box(B, X1 - X0 + 0.1, 0.09, 0.5, M.core, (X0 + X1) / 2 + 0.05, yF + H + 0.057, Z0 + 0.15);
  box(B, X1 - X0 + 0.1, 0.012, 0.5, M.skin, (X0 + X1) / 2 + 0.05, yF + H + 0.108, Z0 + 0.15);

  // ---------- overhead cable ladder, wall to racks, and the sleeve where the line fiber leaves ----------
  const yL = 2.42, zL = -0.72;
  for (const dz of [-0.15, 0.15]) box(B, 1.75, 0.05, 0.012, M.ladder, X0 + 0.875, yL, zL + dz);
  for (let x = X0 + 0.1; x < X0 + 1.75; x += 0.25) box(B, 0.03, 0.012, 0.3, M.ladder, x, yL - 0.019, zL);
  for (const x of [X0 + 0.5, X0 + 1.4]) box(B, 0.02, H + yF - yL - 0.02, 0.02, M.ladder, x, (yL + yF + H) / 2, zL);   // drop rods
  cyl(B, 0.05, 0.16, M.sleeve, X0 - 0.03, yL + 0.07, zL, 16, 0, 0, Math.PI / 2);

  // ---------- two open four-post racks ----------
  const rackX = { A: -0.85, B: -0.02 }, zFront = -0.36, zBack = -1.14, rackH = 2.0;
  const uY = n => yF + 0.06 + (n - 1) * U;                                                    // bottom of unit n
  for (const cx of Object.values(rackX)) {
    for (const px of [-0.28, 0.28]) for (const pz of [zFront, zBack]) box(B, 0.04, rackH, 0.04, M.frame, cx + px, yF + rackH / 2, pz);
    for (const y of [yF + 0.03, yF + rackH - 0.03]) for (const pz of [zFront, zBack]) box(B, 0.52, 0.05, 0.04, M.frame, cx, y, pz);
    for (const y of [yF + 0.03, yF + rackH - 0.03]) for (const px of [-0.28, 0.28]) box(B, 0.04, 0.05, 0.74, M.frame, cx + px, y, (zFront + zBack) / 2);
    for (const px of [-0.235, 0.235]) box(B, 0.03, rackH - 0.1, 0.012, M.rail, cx + px, yF + rackH / 2, zFront + 0.03);   // mounting rails
  }
  // vertical cable manager between the racks
  const xMgr = (rackX.A + rackX.B) / 2;
  box(B, 0.16, rackH - 0.04, 0.02, M.frame, xMgr, yF + rackH / 2, zBack + 0.1);
  for (let i = 0; i < 22; i++) for (const dx of [-0.07, 0.07]) box(B, 0.012, 0.012, 0.6, M.frame, xMgr + dx, uY(3 + i * 1.8), (zFront + zBack) / 2 + 0.06);

  // a 19-inch unit by its front face: ears on the rails, the chassis going back
  const zFace = zFront + 0.02;
  const unit = (cx, n, units, depth, faceMat = M.face) => {
    const h = units * U - 0.002, y = uY(n) + h / 2;
    box(B, 0.44, h - 0.004, depth, M.chassis, cx, y, zFace - depth / 2 - 0.004);
    box(B, 0.482, h, 0.004, faceMat, cx, y, zFace);
    return { y0: uY(n), y1: uY(n) + h, y };
  };

  // ---------- rack A: line system ----------
  const xa = rackX.A;
  // top: LC patch panel where the line fiber leaves for the ladder
  const ppA = unit(xa, 41, 1, 0.22);
  for (let i = 0; i < 12; i++) box(B, 0.016, 0.012, 0.012, M.port, xa - 0.18 + i * 0.03, ppA.y, zFace + 0.007);
  // ROADM/amplifier shelf, Ciena 6500 RLS R8-300: 330 mm high, 440 mm wide, 281 mm deep, 8 slots
  const sh = { y0: uY(31), h: 0.33, w: 0.44, d: 0.281 };
  box(B, sh.w, sh.h, sh.d, M.light, xa, sh.y0 + sh.h / 2, zFace - sh.d / 2 - 0.004);
  box(B, 0.482, 0.03, 0.004, M.light, xa, sh.y0 + 0.015, zFace);                                // fan/air tray strip below the slots
  for (let i = 0; i < 8; i++) box(B, 0.3, 0.003, 0.004, M.port, xa - 0.15 + 0, sh.y0 + 0.006 + i * 0.0026, zFace + 0.002);   // grille
  box(B, 0.482, 0.018, 0.004, M.light, xa, sh.y0 + sh.h - 0.009, zFace);                        // top lip
  // modules: a three-slot ROADM with line amplifier (RLA), a dual line amplifier (DLA), a Raman amplifier (SRA), a
  // colorless mux/demux (CCMD), two blanks. The slot assignment is representative.
  const slotW = sh.w / 8, cardY0 = sh.y0 + 0.034, cardH = sh.h - 0.056;
  const cards = [[0, 3, M.latchBlue, 6], [3, 1, M.latchTeal, 4], [4, 1, M.latchViolet, 2], [5, 1, M.latchAmber, 6], [6, 1, null, 0], [7, 1, null, 0]];
  const portAt = {};
  for (const [s, wSlots, latch, ports] of cards) {
    const w = wSlots * slotW - 0.003, cx = xa - sh.w / 2 + (s + wSlots / 2) * slotW, yc = cardY0 + cardH / 2;
    box(B, w, cardH, 0.006, latch ? M.card : M.blank, cx, yc, zFace + 0.003);
    if (!latch) continue;
    for (const yy of [cardY0 + 0.012, cardY0 + cardH - 0.012]) box(B, Math.min(w - 0.008, 0.04), 0.008, 0.016, M.handle, cx, yy, zFace + 0.012);   // ejectors
    box(B, w - 0.01, 0.006, 0.002, latch, cx, cardY0 + cardH - 0.03, zFace + 0.007);            // color tab by module type
    const cols = wSlots > 1 ? 2 : 1;
    for (let k = 0; k < ports; k++) {
      const c = k % cols, r = Math.floor(k / cols), px = cx + (cols > 1 ? (c - 0.5) * 0.05 : 0), py = cardY0 + 0.06 + r * (cardH - 0.12) / Math.max(1, Math.ceil(ports / cols) - 1);
      box(B, 0.012, 0.018, 0.012, M.port, px, py, zFace + 0.012);
      if (k === 0) portAt[s] = [px, py, zFace + 0.018];
    }
    leds.push({ p: at(cx - w / 2 + 0.008, cardY0 + cardH - 0.05, zFace + 0.008), color: '#5cf29a', rate: 0 });
    leds.push({ p: at(cx - w / 2 + 0.008, cardY0 + cardH - 0.065, zFace + 0.008), color: s === 0 ? '#5cf29a' : '#6ad0ff', rate: s === 3 ? 0.7 : 0 });
  }
  // 2RU 64-channel mux/demux, 75 GHz C-band grid: 64 LC duplex ports in two rows, a common port at the left
  const cmd = unit(xa, 28, 2, 0.24, M.light);
  const cmdPort = ch => [xa - 0.15 + (ch % 32) * 0.0108, ch < 32 ? cmd.y + 0.017 : cmd.y - 0.017, zFace + 0.012];
  for (let ch = 0; ch < 64; ch++) { const [px, py] = cmdPort(ch); box(B, 0.0085, 0.02, 0.012, M.port, px, py, zFace + 0.006); }
  const com = [xa - 0.195, cmd.y, zFace + 0.012];
  box(B, 0.012, 0.024, 0.012, M.port, com[0], com[1], zFace + 0.006);
  box(B, 0.02, 0.05, 0.002, M.latchAmber, xa - 0.218, cmd.y, zFace + 0.003);
  // horizontal finger manager under the mux, shared with the router's
  const mgrY = uY(26) + U / 2;
  for (const cx of [xa, rackX.B]) {
    box(B, 0.482, U - 0.004, 0.004, M.face, cx, mgrY, zFace);
    for (let i = 0; i < 9; i++) box(B, 0.012, 0.03, 0.07, M.frame, cx - 0.2 + i * 0.05, mgrY + 0.004, zFace + 0.035);
  }
  // below: blanks and a power distribution unit
  // vented blank panels fill the empty units
  const blanks = (cx, from, to) => { for (let n = from; n + 3.9 <= to; n += 4) { const b = unit(cx, n, 3.9, 0.03, M.vent); for (let k = 0; k < 5; k++) box(B, 0.36, 0.006, 0.003, M.port, cx, b.y0 + 0.03 + k * 0.028, zFace + 0.003); } };
  // an open fiber-management tray with slack coiled in it (one per rack)
  const tray = (cx, n) => {
    const y0 = uY(n);
    box(B, 0.44, 0.006, 0.32, M.vent, cx, y0 + 0.003, zFace - 0.16);
    box(B, 0.482, 0.03, 0.004, M.face, cx, y0 + 0.015, zFace);
    for (const [dx, r] of [[-0.1, 0.075], [0.1, 0.075]]) for (let k = 0; k < 3; k++) {
      const pts = []; for (let a = 0; a <= 24; a++) { const t = a / 24 * Math.PI * 2; pts.push([cx + dx + Math.cos(t) * (r - k * 0.008), y0 + 0.012 + k * 0.004, zFace - 0.17 + Math.sin(t) * (r - k * 0.008)]); }
      fiber(B, pts, 0.0022, M.yellow);
    }
  };
  tray(xa, 22); tray(rackX.B, 22);
  blanks(xa, 4, 22);
  const pduA = unit(xa, 1, 2, 0.3, M.pdu);
  for (let i = 0; i < 8; i++) box(B, 0.018, 0.04, 0.01, M.breaker, xa - 0.12 + i * 0.03, pduA.y, zFace + 0.006);

  // ---------- rack B: the router, its own ports holding the coherent pluggables ----------
  const xb = rackX.B;
  const rt = unit(xb, 28, 2, 0.5);
  const cageX = i => xb - 0.16 + i * 0.0225;                                                    // 16 cages per row
  const rowY = [rt.y + 0.018, rt.y - 0.018];
  for (const y of rowY) for (let i = 0; i < 16; i++) box(B, 0.02, 0.016, 0.006, M.cage, cageX(i), y, zFace + 0.002);
  box(B, 0.03, 0.06, 0.004, M.port, xb - 0.205, rt.y, zFace + 0.002);                          // management ports
  leds.push({ p: at(xb - 0.205, rt.y + 0.034, zFace + 0.006), color: '#5cf29a', rate: 0 });
  // eight coherent pluggables in the top row, each one wavelength; ten client modules below, toward the campus fabric
  const plug = [], client = [];
  for (let i = 0; i < 8; i++) {
    const px = cageX(i * 2), py = rowY[0];
    rbox(B, 0.019, 0.014, 0.034, M.module, ox + px, oy + py, oz + zFace + 0.018, { r: 0.12 });   // body standing proud of the cage
    box(B, 0.014, 0.01, 0.01, M.port, px, py, zFace + 0.04);                                     // LC receptacle
    box(B, 0.004, 0.004, 0.03, M.latchBlue, px, py - 0.009, zFace + 0.05);                      // pull tab
    plug.push([px, py, zFace + 0.046]);
    leds.push({ p: at(px + 0.008, py + 0.009, zFace + 0.004), color: '#5cf29a', rate: 0 });
  }
  for (let i = 0; i < 10; i++) {
    const px = cageX(i + 3), py = rowY[1];
    box(B, 0.019, 0.014, 0.026, M.module, px, py, zFace + 0.014);
    client.push([px, py, zFace + 0.028]);
  }
  const ppB = unit(xb, 41, 1, 0.22);
  for (let i = 0; i < 12; i++) box(B, 0.016, 0.012, 0.012, M.port, xb - 0.18 + i * 0.03, ppB.y, zFace + 0.007);
  blanks(xb, 4, 22); blanks(xb, 31, 40);
  const pduB = unit(xb, 1, 2, 0.3, M.pdu);
  for (let i = 0; i < 8; i++) box(B, 0.018, 0.04, 0.01, M.breaker, xb - 0.12 + i * 0.03, pduB.y, zFace + 0.006);

  // ---------- fibers ----------
  const lambdaMats = LAMBDA_CSS.map(c => glowMat(c, 2.2));
  const line = glowMat('#ffd35c', 1.8), jr = 0.0026; line.name = 'Line fiber (lit)';   // the dci flow rides inside it (tools/flow-audit.mjs conduit)
  const trough = zFace + 0.07, troughY = mgrY + 0.01;
  // one jumper per pluggable: out of the module, down into the finger manager, across, up into its mux channel
  const chans = [3, 11, 19, 27, 35, 43, 51, 59];
  const jumperPaths = plug.map((p, i) => {
    const c = cmdPort(chans[i]), dz = i * 0.004;
    return [p, [p[0], p[1] - 0.006, p[2] + 0.04 + dz], [p[0] - 0.02, troughY + 0.02, trough + dz], [xMgr, troughY - 0.004, trough + dz + 0.01],
      [c[0] + 0.02, troughY + 0.02, trough + dz], [c[0], c[1] - 0.02, c[2] + 0.04 + dz], c];
  });
  jumperPaths.forEach((pts, i) => fiber(G, pts, jr, lambdaMats[i]));
  // all eight on one fiber: mux common port to the ROADM's add port, then the line port up and out through the wall
  const add = portAt[0], lineOut = [add[0] + 0.05, add[1] + 0.03, add[2]];
  const comPath = [com, [com[0] - 0.012, com[1] + 0.03, com[2] + 0.05], [add[0] - 0.02, add[1] - 0.05, add[2] + 0.05], add];
  fiber(G, comPath, 0.0034, line);
  const linePath = [lineOut, [lineOut[0] + 0.02, lineOut[1] + 0.05, lineOut[2] + 0.05], [xa + 0.21, ppA.y - 0.03, zFace + 0.06], [xa + 0.21, ppA.y + 0.06, zFace + 0.05],
    [xa + 0.17, yF + rackH + 0.1, zFace - 0.05], [xa + 0.1, yL + 0.02, zL + 0.06], [X0 + 0.4, yL + 0.03, zL + 0.06], [X0 - 0.12, yL + 0.07, zL]];   // beside the drop rods, not through them
  fiber(G, linePath, 0.0042, line);
  // client side: yellow single-mode jumpers from the client modules up to the patch panel toward the halls, and on up
  const clientMats = [M.yellow];
  client.forEach((p, i) => fiber(B, [p, [p[0], p[1] - 0.01, p[2] + 0.05], [xb + 0.2 + i * 0.002, rt.y1 + 0.03, zFace + 0.05 + i * 0.002], [xb + 0.2 + i * 0.002, ppB.y - 0.04, zFace + 0.04 + i * 0.002], [xb - 0.18 + i * 0.03, ppB.y, zFace + 0.014]], 0.0024, clientMats[0]));
  for (let i = 0; i < 6; i++) fiber(B, [[xb - 0.15 + i * 0.05, ppB.y, zFace - 0.2], [xb - 0.15 + i * 0.05, yF + rackH + 0.12, zFace - 0.25], [xb - 0.1 + i * 0.01, yL + 0.02, zL + 0.05], [X0 + 0.6, yL + 0.03, zL + 0.07 + i * 0.008]], 0.003, M.yellow);

  // ---------- assemble ----------
  const root = new THREE.Group(); root.name = 'Line terminal, cut away';
  root.add(palette(B).build({ cast: !mobile }));
  root.add(G.build({ cast: false, receive: false }));
  const led = blinkers(leds, { size: 0.006, k: 3.4 }); root.add(led.mesh);
  root.add(lamps([{ p: at(-0.4, yF + H - 0.01, Z0 + 0.3), w: 0.9, d: 0.08 }], { color: '#eef4ff', k: 3.2, halo: 1.6, haloOpacity: 0.2 }));
  // captions
  const cap = (text, p, color = '#e8ecf2') => { const s = textSprite(text, color, 0.07); s.position.set(...at(...p)); s.userData.caption = { text, color, height: 0.07 }; root.add(s); };
  cap('ROADM + AMPLIFIERS', [xa - 0.38, sh.y0 + sh.h * 0.6, zFace + 0.25], '#ffd35c');
  cap('64-CH MUX / DEMUX', [xa - 0.38, cmd.y, zFace + 0.25], '#ffd35c');
  cap('ROUTER · COHERENT PLUGGABLES', [xb + 0.06, rt.y0 - 0.1, zFace + 0.2]);
  cap('LINE FIBER OUT', [X0 + 0.25, yL + 0.14, zL + 0.12], '#ffd35c');
  group.add(root);

  // light moving through: each wavelength from its pluggable to the mux, then the combined signal out to the line
  const flows = [];
  const fl = (pts, n, size) => flows.push(flow(pts.map(p => at(...p)), 'dci', { count: n, speed: 0.35, size, k: 2.4, trailK: 0.3, trailR: 0.0045 }));
  fl([...comPath, ...linePath.slice(1)], mobile ? 6 : 10, 0.016);
  return {
    root, flows, update: t => led.update(t),
    hotspot: { pos: at(xa + 0.1, 2.25, -0.55), view: { pos: at(1.25, 2.2, 3.7), target: at(-0.5, 1.4, -0.55) } },
  };
}
