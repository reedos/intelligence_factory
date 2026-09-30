// Side level: inside three copper cable plugs, one end of each. World unit = 1 cm.
// Electrical the whole way: copper traces on a paddle card, then twinax pairs in the cable. What differs is what sits
// in the path: nothing (passive DAC), one analog redriver, typically on the receive side of the end that has it (ACC),
// or a DSP retimer handling both directions, one in each end (AEC). Transmit pairs on the left half of each card,
// receive pairs on the right. Plugs and cards are representative (no labeled teardown is public).
import { THREE, MAT, Builder, flow, setup, materials, strand, trace, label, lidBox, FLOW, COL, note, unitCol } from './side-kit.js';
import { COPPER_HEADS, copperLane, copperChip, copperPad, copperPadX, COPPER_PADS, PAIR_HALF } from './side-geometry.js';
import { componentView } from '../app/housing-frame.js';

export function build({ quality, state, authoredHardware = false }) {
  const scene = setup(quality, 12), M = materials();
  const S = new Builder(), N = new Builder();
  const flows = [], dataFlows = [], heatFlows = [];
  const HL = 6.0, HW = 2.2, z0 = 2.8, zc = z0 - HL / 2, cardY = 0.9, cardTop = 0.94, back = z0 - HL + 1.0;
  const housingEdge = new THREE.MeshStandardMaterial({ color: 0x8997a5, metalness: 0.78, roughness: 0.33 });
  const foil = new THREE.MeshStandardMaterial({ color: 0x8a919c, metalness: 0.8, roughness: 0.4, side: THREE.DoubleSide });
  // Named so the Blender pass can give the plating its own finish.
  const padGold = new THREE.MeshStandardMaterial({ name: 'Gold contact pads', color: 0xffc56e, metalness: 0.72, roughness: 0.3 });
  const dielectric = new THREE.MeshStandardMaterial({ color: 0xd5decc, roughness: 0.45, transparent: true, opacity: 0.38, depthWrite: false });
  const heads = [];
  COPPER_HEADS.forEach(([kind, hx]) => {
    if (!authoredHardware) {
    S.box(HW, 0.12, HL, MAT.darkSteel, hx, 0, zc);
    // Open lower housing and folded rim: mechanical detail only, with the paddle
    // card still lifted clear so the signal chains remain legible.
    for (const dx of [-HW / 2 + 0.055, HW / 2 - 0.055]) {
      S.box(0.11, 0.35, HL - 0.15, MAT.darkSteel, hx + dx, 0.205, zc);
      N.box(0.07, 0.025, HL - 0.2, housingEdge, hx + dx, 0.39, zc);
    }
    for (const dx of [-0.87, 0.87]) for (const dz of [-2.55, 2.55]) {
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
    S.box(0.18, 0.05, 0.16, MAT.pcbBlack, hx, cardTop + 0.025, zc + 1.95);
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
        if (through) { trace(N, [x + d, z0 - 0.55], [x + d, chipZ + chip.d / 2], cardTop + 0.002, 0.016); trace(N, [x + d, chipZ - chip.d / 2], [x + d, back], cardTop + 0.002, 0.016); }
        else trace(N, [x + d, z0 - 0.55], [x + d, back], cardTop + 0.002, 0.016);
        // the twinax pair soldered at the back of the card and into the cable
        N.strut([x + d, cardTop, back], [hx + (x - hx) * 0.35 + d, cardY, back - 4.0], 0.016, MAT.copper, 5);
        const start = [x + d, cardTop, back], end = [hx + (x - hx) * 0.35 + d, cardY, back - 4.0];
        const at = t => start.map((v, k) => v + (end[k] - v) * t);
        N.strut(at(0.025), at(0.24), 0.019, dielectric, 8);
      }
      // A partial shield around each pair shows twinax construction without
      // pretending the cable consists of uninsulated exposed signal wires.
      const a = new THREE.Vector3(x + (hx - x) * 0.65 * 0.06, cardTop + (cardY - cardTop) * 0.06, back - 0.24);
      const b = new THREE.Vector3(x + (hx - x) * 0.65 * 0.23, cardTop + (cardY - cardTop) * 0.23, back - 0.92);
      const dir = b.clone().sub(a), mid = a.clone().add(b).multiplyScalar(0.5);
      const rot = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()));
      N.add(new THREE.CylinderGeometry(0.054, 0.054, dir.length(), 10, 1, true, Math.PI * 0.3, Math.PI * 1.4), foil, mid.x, mid.y, mid.z, rot.x, rot.y, rot.z);
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
      if (kind === 'aec') for (let i = 0; i < 3; i++) S.box(0.2, 0.16, 0.2, MAT.inductor, hx, cardTop + 0.08, zc + 0.78 + i * 0.26);
    }
    if (!authoredHardware) lidBox(scene, M, HW, HL, [hx, 2.3, zc]);
    // flows: transmit from the host into the cable, receive from the cable to the host, through the chip if there is one
    for (let i = 0; i < 4; i++) for (const rx of [false, true]) {
      const x = lane(i, rx), yF = cardTop + 0.01, pad = copperPad(hx, i, rx), yP = pad.top ? yF : cardBottom - 0.01;
      // Electrical transfer inside the opaque IC stays below its printed top.
      const via = chip && (kind === 'aec' || rx) ? [[x, cardTop + 0.035, chipZ + chip.d / 2], [x, cardTop + 0.035, chipZ - chip.d / 2]] : [];
      // host contact -> pad pair -> breakout (and up a via for bottom-face pairs) -> routed pair
      const edge = [[pad.x, yP, z0 + 1.0], [pad.x, yP, padRear + 0.02], [x, yP, z0 - 0.55], ...(pad.top ? [] : [[x, yF, z0 - 0.55]])];
      const pts = [...edge, ...via, [x, yF, back], [hx + (x - hx) * 0.35, cardY, back - 4.0]];
      dataFlows.push(flow(rx ? pts.reverse() : pts, 'eth', { ...FLOW.elec, count: 5, size: .018, k: 3.6 }));
    }
    // Port power enters on the centre power pad and runs down the supply trace between the halves to the chip.
    if (chip) {
      const yS = cardTop + 0.02, end = kind === 'aec' ? [hx, yS, chipZ + chip.d / 2] : [chip.x - chip.w / 2, yS, chipZ];
      const supply = [[hx, yS, z0 + 1.0], [hx, yS, padRear + 0.02], ...(kind === 'aec' ? [] : [[hx, yS, chipZ]]), end];
      trace(N, [hx, padRear + 0.02], [hx, kind === 'aec' ? end[2] : chipZ], cardTop + 0.002, 0.04);
      if (kind !== 'aec') trace(N, [hx - 0.02, chipZ], [end[0], chipZ], cardTop + 0.002, 0.04);
      flows.push(flow(supply, 'v33', FLOW.power));
    }
    // Qualitative energy transfer, not coolant or a claimed thermal-interface
    // construction. The display gap to the lifted cover is deliberately schematic.
    // Identical treatment avoids implying a numerical ACC/AEC power ratio.
    if (chip) for (const dx of [-chip.w * 0.22, chip.w * 0.22]) {
      heatFlows.push(flow([[chip.x + dx, cardTop + chip.h, chipZ],
        [chip.x + dx, 2.44, chipZ], [chip.x + dx * 1.6, 3.3, chipZ - 0.25]], 'hot', FLOW.heat));
    }
    heads.push({ kind, x: hx, chip });
  });
  scene.add(S.build()); scene.add(N.build({ cast: false }));
  [flows, dataFlows, heatFlows].forEach(a => a.forEach(f => scene.add(f.group)));

  label(scene, 'Copper cables · one end of each', [0, 0.9, z0 + 2.6], '#e8ecf2', 0.34);
  label(scene, 'Plugs and cards representative', [0, 0.5, z0 + 2.6], note, 0.18);
  label(scene, 'DAC · passive', [-4.6, 0.4, z0 + 0.6], '#e8ecf2', 0.2);
  label(scene, 'ACC · receive redriver', [0, 0.4, z0 + 0.6], '#e8ecf2', 0.2);
  label(scene, 'AEC · bidirectional retimer', [4.6, 0.4, z0 + 0.6], '#e8ecf2', 0.2);
  for (const hx of [-4.6, 0, 4.6]) { label(scene, 'TX', [hx - 0.45, 1.35, z0 + 0.35], COL.tx, 0.14); label(scene, 'RX', [hx + 0.4, 1.35, z0 + 0.35], COL.rx, 0.14); }
  label(scene, 'Electrical · traces, then twinax pairs', [0, 1.6, back - 3.2], COL.elec, 0.16);
  label(scene, 'Pair shields opened for illustration', [0, 0.35, back - 1.05], note, 0.13);

  const hs = {}, heatHotspots = {};
  for (const h of heads) {
    // On the package top: marks are small laser-etch bars, so the pin never sits over printed text.
    const focus = [h.chip?.x ?? h.x, h.chip ? cardTop + h.chip.h + 0.04 : 1.12, zc];
    hs[h.kind] = { pos: focus };
    hs[h.kind].view = componentView(focus, [1.3, 1.55, 3.0], h.kind === 'dac' ? [2.25, .45, 3.1] : h.kind === 'acc' ? [1.8, .45, 1.9] : [2.4, .5, 2.0]);
    if (h.chip) heatHotspots[h.kind] = hs[h.kind];
  }
  return {
    scene, flows, dataFlows, heatFlows,
    camera: { pos: [0, 12.5, 14], target: [0, 0.9, 0], near: 0.05, far: 300, min: 1.5, max: 60, portrait: { pos: [0, 18, 22], target: [0, 0.6, 0.5] } },
    hotspots: { dac: hs.dac, acc: hs.acc, aec: hs.aec },
    dataHotspots: { dac: hs.dac, acc: hs.acc, aec: hs.aec },
    heatHotspots,
    update() {},
  };
}
