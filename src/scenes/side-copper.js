// Side level: inside three copper cable plugs, one end of each. World unit = 1 cm.
// Electrical the whole way: copper traces on a paddle card, then twinax pairs in the cable. What differs is what sits
// in the path: nothing (passive DAC), one analog redriver, typically on the receive side of the end that has it (ACC),
// or a DSP retimer handling both directions, one in each end (AEC). Transmit pairs on the left half of each card,
// receive pairs on the right. Plugs and cards are representative (no labeled teardown is public).
import { THREE, MAT, Builder, flow, setup, materials, strand, trace, label, lidBox, FLOW, COL, note, unitCol } from './side-kit.js';
import { COPPER_HEADS, copperLane, copperChip, copperPad, copperPadX, COPPER_PADS, PAIR_HALF, copperPairRoute } from './side-geometry.js';
import { componentView } from '../app/housing-frame.js';
import { tagHeat, balanceHeat, heatWeight, PART_W } from '../heat.js';

// A swept elliptical tube along a curve: offset (ox, oy) and radii (rx, ry) in the curve's own frame, which stays
// level (right = tangent x up). arc = [start, length] leaves a window open; cap closes the start end.
function sweep(curve, u0, u1, { ox = 0, oy = 0, rx, ry = rx, seg = 8, steps = 16, arc = [0, Math.PI * 2], cap = false }) {
  const pos = [], idx = [], up = new THREE.Vector3(0, 1, 0), closed = arc[1] >= Math.PI * 2 - 1e-6, ring = closed ? seg : seg + 1;
  const frame = u => {
    const c = curve.getPointAt(u), t = curve.getTangentAt(u);
    const right = new THREE.Vector3().crossVectors(t, up).normalize(), v = new THREE.Vector3().crossVectors(right, t).normalize();
    return [c, right, v];
  };
  for (let s = 0; s <= steps; s++) {
    const [c, right, v] = frame(u0 + (u1 - u0) * s / steps);
    for (let k = 0; k < ring; k++) {
      const a = arc[0] + arc[1] * k / seg;
      const p = c.clone().addScaledVector(right, ox + rx * Math.cos(a)).addScaledVector(v, oy + ry * Math.sin(a));
      pos.push(p.x, p.y, p.z);
    }
  }
  for (let s = 0; s < steps; s++) for (let k = 0; k < seg; k++) {
    const a = s * ring + k, b = s * ring + (k + 1) % ring, c = a + ring, d = b + ring;
    idx.push(a, c, b, b, c, d);
  }
  if (cap) {
    const [c, right, v] = frame(u0), centre = c.clone().addScaledVector(right, ox).addScaledVector(v, oy), n = pos.length / 3;
    pos.push(centre.x, centre.y, centre.z);
    for (let k = 0; k < seg; k++) idx.push(n, (k + 1) % ring, k);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// a soft round falloff for glows that should read as light on the board, not as a disc
let softDot;
function softTex() {
  if (softDot) return softDot;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,0.45)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  return (softDot = new THREE.CanvasTexture(c));
}
// curve parameter where the pair crosses depth z (the route only ever moves toward -z)
const uAtZ = (curve, z) => { let lo = 0, hi = 1; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (curve.getPointAt(m).z > z) lo = m; else hi = m; } return (lo + hi) / 2; };

export function build({ quality, state, authoredHardware = false }) {
  const scene = setup(quality, 12), M = materials();
  const S = new Builder(), N = new Builder();
  const flows = [], dataFlows = [], heatFlows = [];
  // HW: QSFP112 width, about 18.4 mm; HL is shortened for the diagram (Type 1 bodies run to 72.4 mm).
  const HL = 6.0, HW = 1.84, z0 = 2.8, zc = z0 - HL / 2, cardY = 0.9, cardTop = 0.94, back = z0 - HL + 1.0;
  // rear termination: traces end on solder pads just inside the card's back edge
  const cardRear = zc + 0.5 - (HL - 1.4) / 2, term = cardRear + 0.14, DIEL = 0.036, COND = 0.013;
  const housingEdge = new THREE.MeshStandardMaterial({ color: 0x8997a5, metalness: 0.78, roughness: 0.33 });
  const foil = new THREE.MeshStandardMaterial({ name: 'Twinax foil shield', color: 0xb4bcc6, metalness: 0.85, roughness: 0.36, side: THREE.DoubleSide });
  // Named so the Blender pass can give the plating its own finish.
  const padGold = new THREE.MeshStandardMaterial({ name: 'Gold contact pads', color: 0xffc56e, metalness: 0.72, roughness: 0.3 });
  // Twinax construction (US20160073559A1: a signal pair of two conductors and an insulating layer, covered by a shield
  // tape and a drain wire). Sizes are representative: 30 AWG-class conductors, 0.72 mm dielectric, oval foil.
  const dielectric = new THREE.MeshStandardMaterial({ name: 'Twinax dielectric', color: 0xe9e5d8, roughness: 0.5, metalness: 0, side: THREE.DoubleSide });
  const conductor = new THREE.MeshStandardMaterial({ name: 'Twinax conductor copper', color: 0xe0a080, metalness: 0.75, roughness: 0.32 });
  const drain = new THREE.MeshStandardMaterial({ name: 'Tinned drain wire', color: 0xc9ccd0, metalness: 0.85, roughness: 0.3 });
  const solder = new THREE.MeshStandardMaterial({ name: 'Solder fillet', color: 0xd9dbde, metalness: 0.85, roughness: 0.22 });
  const heads = [], powerGlows = [], heatGlows = [], powerDraw = [];
  COPPER_HEADS.forEach(([kind, hx]) => {
    if (!authoredHardware) {
    S.box(HW, 0.12, HL, MAT.darkSteel, hx, 0, zc);
    // Open lower housing and folded rim: mechanical detail only, with the paddle
    // card still lifted clear so the signal chains remain legible.
    for (const dx of [-HW / 2 + 0.055, HW / 2 - 0.055]) {
      S.box(0.11, 0.35, HL - 0.15, MAT.darkSteel, hx + dx, 0.205, zc);
      N.box(0.07, 0.025, HL - 0.2, housingEdge, hx + dx, 0.39, zc);
    }
    for (const dx of [-0.6, 0.6]) for (const dz of [-2.55, 2.55]) {
      N.cyl(0.09, 0.04, housingEdge, hx + dx, 0.085, zc + dz, 10);
      N.box(0.105, 0.012, 0.025, MAT.pcbBlack, hx + dx, 0.111, zc + dz);
    }
    }
    S.box(HW - 0.3, 0.08, HL - 1.4, MAT.pcb, hx, cardY, zc + 0.5);
    for (const dx of [-(HW - 0.3) / 2, (HW - 0.3) / 2]) N.box(0.009, 0.022, HL - 1.42, MAT.pcbBlack, hx + dx, cardY, zc + 0.5);
    // 19 pads on each face, set back from the card edge; lengths stagger ground, power, then signal.
    const cardFront = zc + 0.5 + (HL - 1.4) / 2, cardBottom = cardY - 0.04, padRear = cardFront - 0.23;
    for (let j = 0; j < 19; j++) {
      const kind = COPPER_PADS[j], front = cardFront - (kind === 'g' ? 0.03 : kind === 'p' ? 0.055 : 0.08);
      for (const y of [cardTop + 0.00125, cardBottom - 0.00125]) N.box(0.045, 0.0045, front - padRear, padGold, copperPadX(hx, j), y, (front + padRear) / 2);
    }
    // the ID memory every plug carries, on the power line between the transmit and receive halves
    // (Blender authors it as a leaded SOT-23-class package at the same place)
    if (!authoredHardware) S.box(0.18, 0.05, 0.16, MAT.pcbBlack, hx, cardTop + 0.025, zc + 1.95);
    // four pairs each way: transmit on the left half, receive on the right
    const lane = (i, rx) => copperLane(hx, i, rx);
    const chipZ = zc, chip = copperChip(kind, hx);
    for (let i = 0; i < 4; i++) for (const rx of [false, true]) {
      const x = lane(i, rx), through = chip && (kind === 'aec' || rx), pad = copperPad(hx, i, rx);
      for (const d of [-PAIR_HALF, PAIR_HALF]) {
        // breakout: from the pad pair (0.8 mm apart) into the routed pair, on the top face or the bottom face and up a via
        trace(N, [pad.x + 2 * d, padRear + 0.02], [x + d, z0 - 0.55], pad.top ? cardTop + 0.002 : cardBottom - 0.002, 0.016);
        if (!pad.top) {
          N.cyl(0.011, cardTop - cardBottom + 0.004, MAT.copper, x + d, cardY, z0 - 0.55, 10);
          for (const y of [cardTop + 0.0025, cardBottom - 0.0025]) N.cyl(0.022, 0.005, MAT.copper, x + d, y, z0 - 0.55, 14);
        }
        if (through) { trace(N, [x + d, z0 - 0.55], [x + d, chipZ + chip.d / 2], cardTop + 0.002, 0.016); trace(N, [x + d, chipZ - chip.d / 2], [x + d, term], cardTop + 0.002, 0.016); }
        else trace(N, [x + d, z0 - 0.55], [x + d, term], cardTop + 0.002, 0.016);
        // solder termination: the stripped conductor steps down from its insulation onto its pad, under a fillet
        N.strut([x + Math.sign(d) * DIEL, cardTop + DIEL, cardRear - 0.02], [x + d, cardTop + 0.014, term - 0.02], COND, conductor, 6);
        N.add(new THREE.SphereGeometry(1, 8, 5), solder, x + d, cardTop + 0.006, term - 0.01, 0, 0, 0, 0.022, 0.011, 0.07);
      }
      // the twinax pair: two insulated conductors and a drain wire in an oval foil shield, into the round pack
      const curve = new THREE.CatmullRomCurve3(copperPairRoute(hx, i, rx, { cardTop, cardY, start: cardRear - 0.02 }).map(p => new THREE.Vector3(...p)), false, 'centripetal');
      for (const sx of [-1, 1]) {
        N.add(sweep(curve, 0, 1, { ox: sx * DIEL, rx: DIEL, seg: 8, steps: 12, cap: true }), dielectric);
        N.add(sweep(curve, 0, 1, { ox: sx * DIEL, rx: COND, seg: 5, steps: 10 }), conductor);
      }
      const drainY = Math.sqrt((DIEL + 0.0175) ** 2 - DIEL ** 2);
      N.add(sweep(curve, 0, 1, { oy: drainY, rx: 0.0175, seg: 5, steps: 10 }), drain);
      // drain wire down to its ground pad beside the pair, on its centre-channel side (mirror-symmetric banks)
      const gx = x + (rx ? -0.075 : 0.075);
      N.strut([x, cardTop + DIEL + drainY, cardRear - 0.02], [gx, cardTop + 0.012, term - 0.03], 0.0175, drain, 6);
      N.box(0.05, 0.005, 0.13, MAT.copper, gx, cardTop + 0.0025, term - 0.02);
      N.add(new THREE.SphereGeometry(1, 8, 5), solder, gx, cardTop + 0.007, term - 0.03, 0, 0, 0, 0.026, 0.011, 0.06);
      // foil: stripped back 1 mm, then opened across the top for 6 mm (illustration), then closed into the jacket
      const uFoil = uAtZ(curve, cardRear - 0.12), uOpen = uAtZ(curve, cardRear - 0.72), foilShape = { oy: 0.01, rx: 0.078, ry: 0.062, seg: 12 };
      N.add(sweep(curve, uFoil, uOpen, { ...foilShape, steps: 6, arc: [Math.PI * 0.89, Math.PI * 1.22] }), foil);
      N.add(sweep(curve, uOpen, 1, { ...foilShape, steps: 12 }), foil);
    }
    // The jacket cutaway begins only after all fanned pairs fit its bore.
    // The widened entry clamp leaves the exposed pair shields unobstructed.
    if (!authoredHardware) {
      N.cyl(0.52, 2.05, MAT.polymer, hx, cardY, -5.275, 32, Math.PI / 2, 0, 0);
      for (let i = 0; i < 6; i++) N.cyl(0.555 - i * 0.004, 0.07, MAT.polymer, hx, cardY, -4.35 - i * 0.2, 32, Math.PI / 2, 0, 0);
    }
    if (chip) {
      if (!authoredHardware) S.box(chip.w, chip.h, chip.d, MAT.silicon, chip.x, cardTop + chip.h / 2, chipZ);
      // AEC: power inductors on the supply line ahead of the retimer (representative placement)
      if (kind === 'aec' && !authoredHardware) for (let i = 0; i < 3; i++) S.box(0.2, 0.16, 0.2, MAT.inductor, hx, cardTop + 0.08, zc + 0.78 + i * 0.26);
    }
    if (!authoredHardware) lidBox(scene, M, HW, HL, [hx, 2.3, zc]);
    // flows: transmit from the host into the cable, receive from the cable to the host, through the chip if there is one
    for (let i = 0; i < 4; i++) for (const rx of [false, true]) {
      const x = lane(i, rx), yF = cardTop + 0.01, pad = copperPad(hx, i, rx), yP = pad.top ? yF : cardBottom - 0.01;
      // Electrical transfer inside the opaque IC stays below its printed top.
      const via = chip && (kind === 'aec' || rx) ? [[x, cardTop + 0.035, chipZ + chip.d / 2], [x, cardTop + 0.035, chipZ - chip.d / 2]] : [];
      // host contact -> pad pair -> breakout (and up a via for bottom-face pairs) -> routed pair
      const edge = [[pad.x, yP, z0 + 1.0], [pad.x, yP, padRear + 0.02], [x, yP, z0 - 0.55], ...(pad.top ? [] : [[x, yF, z0 - 0.55]])];
      const route = new THREE.CatmullRomCurve3(copperPairRoute(hx, i, rx, { cardTop, cardY, start: cardRear - 0.02 }).map(p => new THREE.Vector3(...p)), false, 'centripetal');
      const pts = [...edge, ...via, [x, yF, term], ...route.getSpacedPoints(12).map(p => p.toArray())];
      dataFlows.push(flow(rx ? pts.reverse() : pts, 'eth', { ...FLOW.elec, count: 5, size: .018, k: 3.6 }));
    }
    // Port power enters on the centre power pad and runs down the supply trace between the halves to the chip.
    if (chip) {
      const yS = cardTop + 0.02, end = kind === 'aec' ? [hx, yS, chipZ + chip.d / 2] : [chip.x - chip.w / 2, yS, chipZ];
      const supply = [[hx, yS, z0 + 1.0], [hx, yS, padRear + 0.02], ...(kind === 'aec' ? [] : [[hx, yS, chipZ]]), end];
      trace(N, [hx, padRear + 0.02], [hx, kind === 'aec' ? end[2] : chipZ], cardTop + 0.002, 0.04);
      if (kind !== 'aec') trace(N, [hx - 0.02, chipZ], [end[0], chipZ], cardTop + 0.002, 0.04);
      const f = flow(supply, 'v33', { ...FLOW.power, count: 8, size: 0.042 });
      flows.push(f);
      // Power layer only: the supply trace glows as energized copper, and the port's power pad pulses where it enters.
      const hot = new THREE.MeshBasicMaterial({ color: f.base.color.clone().multiplyScalar(2.2), transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false });
      const line = new THREE.Group();
      for (let k = 0; k < supply.length - 1; k++) {
        const a = new THREE.Vector3(...supply[k]).setY(cardTop + 0.0055), b = new THREE.Vector3(...supply[k + 1]).setY(cardTop + 0.0055);
        if (k === 0) a.z = padRear + 0.02;
        const len = a.distanceTo(b); if (len < 1e-4) continue;
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.002, len), hot);
        bar.position.copy(a).add(b).multiplyScalar(0.5); bar.lookAt(b); line.add(bar);
      }
      const pad = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), new THREE.MeshBasicMaterial({ map: softTex(), color: f.base.color.clone().multiplyScalar(2.2), transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
      pad.rotation.x = -Math.PI / 2; pad.position.set(hx, cardTop + 0.006, padRear + 0.12);
      line.add(pad); line.userData.pad = pad; line.visible = false;
      scene.add(line); powerGlows.push(line);
    }
    // Energy transfer, not coolant or a claimed thermal-interface construction. The display gap to the lifted cover
    // is deliberately schematic. Strands, glow and haze follow the site's one log rule (src/heat.js) on each chip's
    // assumed watts (PART_W.copper); the passive DAC has no chip and draws none.
    const chipW = PART_W.copper[kind], chipK = heatWeight(chipW, PART_W.copper.aec);
    if (chip && chipK) {
      const top = cardTop + chip.h;
      [-0.36, -0.18, 0, 0.18, 0.36].forEach((u, k) => {
        const dx = u * chip.w, dz = (k % 2 ? 0.2 : -0.12) * chip.d;
        heatFlows.push(flow([[chip.x + dx, top, chipZ + dz], [chip.x + dx * 1.1, 2.44, chipZ + dz],
          [chip.x + dx * 1.9, 3.3 + Math.abs(u) * 0.3, chipZ + dz - 0.3]], 'hot', { ...FLOW.heat, count: 4, size: 0.05 }));
        tagHeat(heatFlows[heatFlows.length - 1], kind, chipW);
      });
      const hot = heatFlows[heatFlows.length - 1].base.color;
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: softTex(), color: hot.clone().multiplyScalar(1.8), transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
      glow.rotation.x = -Math.PI / 2; glow.scale.set(chip.w * 1.5, chip.d * 1.6, 1); glow.position.set(chip.x, top + 0.004, chipZ);
      const haze = [0, 1, 2, 3].map(i => {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex(), color: hot.clone().multiplyScalar(1.2), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
        sp.userData.phase = i / 4; return sp;
      });
      const g = new THREE.Group(); g.add(glow, ...haze); g.visible = false;
      g.userData = { glow, haze, x: chip.x, z: chipZ, top, w: chip.w, k: chipK };
      scene.add(g); heatGlows.push(g);
    }
    // where the power is spent: the shared power-draw glow on the card around the active package (src/power-glow.js);
    // the passive DAC end's 0.1 W is under the rule's threshold and draws none
    powerDraw.push({ id: kind, part: kind, watts: PART_W.copper[kind], at: chip ? [chip.x, cardTop + 0.0065, chipZ] : [hx, cardTop + 0.0065, chipZ],
      size: chip ? [chip.w, chip.d] : [0.4, 0.4] });
    heads.push({ kind, x: hx, chip });
  });
  scene.add(S.build()); scene.add(N.build({ cast: false }));
  // a warm key from camera-left for the Power layer only: the port feeding the plug sets the mood
  const warm = new THREE.DirectionalLight(0xffc27a, 0); warm.name = 'Copper power warm key';
  warm.position.set(-9, 8, 6); warm.target.position.set(0, 0.8, 0); scene.add(warm, warm.target);
  balanceHeat(heatFlows);
  [flows, dataFlows, heatFlows].forEach(a => a.forEach(f => scene.add(f.group)));

  label(scene, 'Copper cables · one end of each', [0, 0.9, z0 + 2.6], '#e8ecf2', 0.34);
  label(scene, 'Plugs and cards representative', [0, 0.5, z0 + 2.6], note, 0.18);
  label(scene, 'DAC · passive', [-4.6, 0.4, z0 + 0.6], '#e8ecf2', 0.2);
  label(scene, 'ACC · receive redriver', [0, 0.4, z0 + 0.6], '#e8ecf2', 0.2);
  label(scene, 'AEC · bidirectional retimer', [4.6, 0.4, z0 + 0.6], '#e8ecf2', 0.2);
  for (const hx of [-4.6, 0, 4.6]) { label(scene, 'TX', [hx - 0.45, 1.35, z0 + 0.35], COL.tx, 0.14); label(scene, 'RX', [hx + 0.4, 1.35, z0 + 0.35], COL.rx, 0.14); }
  label(scene, 'Electrical · traces, then twinax pairs', [0, 1.6, back - 3.2], COL.elec, 0.16);
  label(scene, 'Pair shields opened for illustration', [0, 0.35, cardRear - 0.5], note, 0.13);

  const hs = {}, heatHotspots = {};
  for (const h of heads) {
    // On the package top: marks are small laser-etch bars, so the pin never sits over printed text.
    const focus = [h.chip?.x ?? h.x, h.chip ? cardTop + h.chip.h + 0.04 : 1.12, zc];
    // The middle pin sits on the card just ahead of its redriver, so in the overview its caption runs on its own
    // baseline instead of into the AEC pin beside it. Views still frame the chip itself.
    hs[h.kind] = { pos: h.kind === 'acc' ? [focus[0], cardTop + 0.02, zc + h.chip.d / 2 + 0.75] : focus };
    hs[h.kind].view = componentView(focus, [1.3, 1.55, 3.0], h.kind === 'dac' ? [2.25, .45, 3.1] : h.kind === 'acc' ? [1.8, .45, 1.9] : [2.4, .5, 2.0]);
    if (h.chip) heatHotspots[h.kind] = hs[h.kind];
  }
  return {
    scene, flows, dataFlows, heatFlows, powerDraw,
    camera: { pos: [0, 12.5, 14], target: [0, 0.9, 0], near: 0.05, far: 300, min: 1.5, max: 60, portrait: { pos: [0, 18, 22], target: [0, 0.6, 0.5] } },
    hotspots: { dac: hs.dac, acc: hs.acc, aec: hs.aec },
    dataHotspots: { dac: hs.dac, acc: hs.acc, aec: hs.aec },
    heatHotspots,
    update(t = 0) {
      const on = state?.mode === 'power';
      for (const g of powerGlows) {
        g.visible = on;
        if (on) {
          const k = 0.8 + 0.2 * Math.sin(t * 3.2);
          g.userData.pad.scale.setScalar(k); g.userData.pad.material.opacity = 0.35 + 0.35 * k;
        }
      }
      warm.intensity = on ? 1.4 : 0;
      // Heat layer: the package top glows and a warm haze rises off it toward the lifted case.
      const heat = state?.mode === 'heat';
      // In a part close-up the camera sits low over one package, so the full plume would climb behind the level
      // title and wash out the pin caption: there the haze stays short and faint and the package glow dims.
      const close = !!state?.selected;
      const rise = close ? 0.75 : 2.1, hazeK = close ? 0.06 : 0.15, grow = close ? 0.6 : 1.3;
      for (const g of heatGlows) {
        g.visible = heat; if (!heat) continue;
        const { glow, haze, x, z, top, w, k } = g.userData;
        glow.material.opacity = k * (close ? 0.16 + 0.05 * Math.sin(t * 2.1) : 0.3 + 0.1 * Math.sin(t * 2.1));
        for (const sp of haze) {
          const p = (t * 0.32 + sp.userData.phase) % 1;
          sp.position.set(x, top + 0.15 + p * rise, z - p * 0.2);
          sp.scale.setScalar(w * (0.7 + p * grow));
          sp.material.opacity = k * hazeK * Math.sin(Math.PI * p);
        }
      }
      return on || heat;
    },
  };
}
