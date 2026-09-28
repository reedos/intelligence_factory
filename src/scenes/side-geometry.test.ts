import { describe, it, expect } from 'vitest';
import { engineLayout, asicTap, edgeConnOf, elsOf, ELS_LANES, ASIC_HALF, COPPER_HEADS, copperLane, copperChip, PAIR_HALF } from './side-geometry.js';

// Codex's optics review, 09/28: floating-point side vectors sent 12 of 18 ASIC taps outside the chip and 15 of 18
// connectors off the package edge; four laser modules fed more lanes than one can; an AEC pair missed its retimer.
const SUB = 10.4, engines = engineLayout();
describe('CPO package geometry', () => {
  it('has 18 engines, three per subassembly', () => expect(engines.length).toBe(18));
  it('every engine taps the ASIC on the edge it faces, inside the chip', () => {
    for (const e of engines) {
      const [x, z] = asicTap(e), along = e.out[0] !== 0 ? z : x, across = e.out[0] !== 0 ? x : z;
      expect(Math.abs(across), `engine ${e.side}/${e.t}`).toBeCloseTo(ASIC_HALF, 9);
      expect(Math.abs(along), `engine ${e.side}/${e.t}`).toBeLessThan(ASIC_HALF);
      expect(Math.sign(across)).toBe(Math.sign(e.out[0] + e.out[1]));
    }
  });
  it('every connector sits on the package edge, in line with its engine', () => {
    for (const e of engines) {
      const [x, z] = edgeConnOf(e, SUB), across = e.out[0] !== 0 ? x : z, along = e.out[0] !== 0 ? z : x;
      expect(Math.abs(across)).toBeCloseTo(SUB / 2 + 0.2, 9);
      expect(along).toBeCloseTo(e.out[0] !== 0 ? e.z : e.x, 9);
      expect(Math.abs(along)).toBeLessThan(SUB / 2);
    }
  });
  it('no laser module lights more than its 32 transmit lanes', () => {
    const lanes = new Map();
    engines.forEach((_, i) => lanes.set(elsOf(i), (lanes.get(elsOf(i)) || 0) + 8));
    for (const [els, n] of lanes) expect(n, `laser module ${els}`).toBeLessThanOrEqual(ELS_LANES);
    expect([...lanes.values()].reduce((a, b) => a + b, 0)).toBe(144);
  });
});
describe('copper plugs', () => {
  it('every pair that passes a chip enters and leaves its footprint', () => {
    for (const [kind, hx] of COPPER_HEADS) {
      const chip = copperChip(kind, hx); if (!chip) continue;
      for (let i = 0; i < 4; i++) for (const rx of [false, true]) {
        if (chip.rxOnly && !rx) continue;
        const x = copperLane(hx, i, rx);
        expect(x - PAIR_HALF, `${kind} ${rx ? 'RX' : 'TX'} ${i}`).toBeGreaterThan(chip.x - chip.w / 2);
        expect(x + PAIR_HALF, `${kind} ${rx ? 'RX' : 'TX'} ${i}`).toBeLessThan(chip.x + chip.w / 2);
      }
    }
  });
});
