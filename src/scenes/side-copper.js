// Side level: inside three copper cable plugs, one end of each. World unit = 1 cm.
// Electrical the whole way: copper traces on a paddle card, then twinax pairs in the cable. What differs is what sits
// in the path: nothing (passive DAC), one analog redriver, typically on the receive side of the end that has it (ACC),
// or a DSP retimer handling both directions, one in each end (AEC). Transmit pairs on the left half of each card,
// receive pairs on the right. Plugs and cards are representative (no labeled teardown is public).
import { THREE, MAT, Builder, flow, setup, materials, strand, trace, label, lidBox, FLOW, COL, note, unitCol } from './side-kit.js';
import { COPPER_HEADS, copperLane, copperChip, PAIR_HALF } from './side-geometry.js';

export function build({ quality, state }) {
  const scene = setup(quality, 12), M = materials();
  const S = new Builder(), N = new Builder();
  const flows = [], dataFlows = [];
  const HL = 6.0, HW = 2.2, z0 = 2.8, zc = z0 - HL / 2, cardY = 0.9, cardTop = 0.94, back = z0 - HL + 1.0;
  const heads = [];
  COPPER_HEADS.forEach(([kind, hx]) => {
    S.box(HW, 0.12, HL, MAT.darkSteel, hx, 0, zc);
    S.box(HW - 0.3, 0.08, HL - 1.4, MAT.pcb, hx, cardY, zc + 0.5);
    for (let i = 0; i < 20; i++) N.box(0.045, 0.012, 0.5, MAT.gold, hx - 0.8 + i * 0.084, cardTop + 0.006, z0 - 0.3);
    S.box(0.18, 0.05, 0.18, MAT.pcbBlack, hx + 0.72, cardTop + 0.025, zc + 1.6);                 // the ID memory every plug carries
    // four pairs each way: transmit on the left half, receive on the right
    const lane = (i, rx) => copperLane(hx, i, rx);
    const chipZ = zc, chip = copperChip(kind, hx);
    for (let i = 0; i < 4; i++) for (const rx of [false, true]) {
      const x = lane(i, rx), through = chip && (kind === 'aec' || rx);
      for (const d of [-PAIR_HALF, PAIR_HALF]) {
        if (through) { trace(N, [x + d, z0 - 0.55], [x + d, chipZ + chip.d / 2], cardTop + 0.002, 0.016); trace(N, [x + d, chipZ - chip.d / 2], [x + d, back], cardTop + 0.002, 0.016); }
        else trace(N, [x + d, z0 - 0.55], [x + d, back], cardTop + 0.002, 0.016);
        // the twinax pair soldered at the back of the card and into the cable
        N.strut([x + d, cardTop, back], [hx + (x - hx) * 0.35 + d, cardY, back - 4.0], 0.016, MAT.copper, 5);
      }
    }
    N.cyl(0.52, 3.2, MAT.polymer, hx, cardY, back - 2.5, 16, Math.PI / 2, 0, 0);
    if (chip) {
      S.box(chip.w, 0.07, chip.d, MAT.silicon, chip.x, cardTop + 0.035, chipZ);
      if (kind === 'aec') for (let i = 0; i < 3; i++) S.box(0.22, 0.16, 0.22, MAT.inductor, hx + 0.85, cardTop + 0.08, zc + 1.0 + i * 0.3);
    }
    lidBox(scene, M, HW, HL, [hx, 2.3, zc]);
    // flows: transmit from the host into the cable, receive from the cable to the host, through the chip if there is one
    for (const [i, rx] of [[1, false], [2, true]]) {
      const x = lane(i, rx), yF = cardTop + 0.01;
      const via = chip && (kind === 'aec' || rx) ? [[x, cardTop + 0.08, chipZ + chip.d / 2], [x, cardTop + 0.08, chipZ - chip.d / 2]] : [];
      const pts = [[x, yF, z0 + 1.0], [x, yF, z0 - 0.55], ...via, [x, yF, back], [hx + (x - hx) * 0.35, cardY, back - 4.0]];
      dataFlows.push(flow(rx ? pts.reverse() : pts, 'eth', FLOW.elec));
    }
    if (chip) flows.push(flow([[hx + 0.85, cardTop + 0.02, z0 + 1.0], [hx + 0.85, cardTop + 0.02, z0 - 0.55], [chip.x + chip.w / 2, cardTop + 0.05, chipZ]], 'v33', FLOW.power));
    heads.push({ kind, x: hx, chip });
  });
  scene.add(S.build()); scene.add(N.build({ cast: false }));
  [flows, dataFlows].forEach(a => a.forEach(f => scene.add(f.group)));

  label(scene, 'Copper cables · one end of each', [0, 0.9, z0 + 2.6], '#e8ecf2', 0.34);
  label(scene, 'Plugs and cards representative · electrical the whole way, no light', [0, 0.5, z0 + 2.6], note, 0.18);
  label(scene, 'DAC: nothing in the path · ACC: one redriver · AEC: a retimer in each end', [0, 0.2, z0 + 2.6], unitCol, 0.18);
  label(scene, 'Passive (DAC)', [-4.6, 2.9, z0 + 0.6], '#e8ecf2', 0.2);
  label(scene, 'Active copper (ACC) · redriver on the receive side', [0, 2.9, z0 + 0.6], '#e8ecf2', 0.2);
  label(scene, 'AEC · retimer, both directions · this end shown', [4.6, 2.9, z0 + 0.6], '#e8ecf2', 0.2);
  for (const hx of [-4.6, 0, 4.6]) { label(scene, 'TX', [hx - 0.45, 1.35, z0 + 0.35], COL.tx, 0.14); label(scene, 'RX', [hx + 0.4, 1.35, z0 + 0.35], COL.rx, 0.14); }
  label(scene, 'Electrical · traces, then twinax pairs', [0, 1.6, back - 3.2], COL.elec, 0.16);

  const view = (p, v, t) => ({ pos: p, view: { pos: v, target: t } });
  const hs = Object.fromEntries(heads.map((h, k) => [h.kind, view([h.x, 1.3, zc + 1.4 - k * 1.4], [h.x + 1.6, 5.0, z0 + 2.4], [h.x, 0.9, zc - 0.3])]));   // staggered front to back
  return {
    scene, flows, dataFlows, heatFlows: [],
    camera: { pos: [0, 12.5, 14], target: [0, 0.9, 0], near: 0.05, far: 300, min: 1.5, max: 60, portrait: { pos: [0, 18, 22], target: [0, 0.6, 0.5] } },
    hotspots: { dac: hs.dac, acc: hs.acc, aec: hs.aec },
    dataHotspots: { dac: hs.dac, acc: hs.acc, aec: hs.aec },
    heatHotspots: {},
    update() {},
  };
}
