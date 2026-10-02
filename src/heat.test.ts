import { describe, it, expect } from 'vitest';
import { heatWeight, HEAT_SCALE, HEAT_GAMMA, tagHeat, heatSources, scaleEmission, balanceHeat, PART_W } from './heat.js';

// A stand-in for kit.js Flow: the fields the heat rule reads and writes, no WebGL.
function fakeFlow(count: number, { size = 0.04, k = 2.6, opacity = 1 } = {}) {
  const matrix = { count, constructor: function (this: any, a: Float32Array) { this.count = a.length / 16; } };
  return { count, size, base: { color: { r: k, g: k * 0.7, b: 0 }, opacity },
    mesh: { count, instanceMatrix: matrix, material: { opacity, transparent: false } } } as any;
}

describe('the site heat rule', () => {
  it('is log-compressed: every 10× in watts is the same 5× step in visual weight', () => {
    expect(HEAT_GAMMA).toBeCloseTo(Math.log10(5), 10);
    expect(heatWeight(1000, 1000)).toBe(1);
    expect(heatWeight(100, 1000)).toBeCloseTo(1 / 5, 10);
    expect(heatWeight(10, 1000)).toBeCloseTo(1 / 25, 10);
    expect(heatWeight(1, 1000)).toBeCloseTo(1 / 125, 10);
  });
  it('is monotonic and draws nothing under the threshold', () => {
    let last = 0;
    for (let w = 0.5; w < 2000; w *= 1.1) { const v = heatWeight(w, 2000); expect(v).toBeGreaterThan(last); last = v; }
    expect(heatWeight(HEAT_SCALE.minW * 0.99, 10)).toBe(0);
    expect(heatWeight(0.05, 1)).toBe(0);
    // the parts the rule removes everywhere: photodiode and modulator bias, a DAC end
    expect(heatWeight(PART_W.coherent.receiverOptics, PART_W.coherent.dsp)).toBe(0);
    expect(heatWeight(PART_W.coherent.modulator, PART_W.coherent.dsp)).toBe(0);
    expect(heatWeight(PART_W.copper.dac, PART_W.copper.aec)).toBe(0);
  });
  it('scales one stream exactly: pulses first, the remainder as opacity, never under the floor', () => {
    const f = scaleEmission(fakeFlow(6), 0.5);
    expect(f.count).toBe(3); expect(f.base.opacity).toBe(1);
    const g = scaleEmission(fakeFlow(3), 0.5);
    expect(g.count * g.base.opacity).toBeCloseTo(1.5, 10);
    const h = scaleEmission(fakeFlow(3), 0.01);
    expect(h.count).toBe(1); expect(h.base.opacity).toBe(HEAT_SCALE.minOpacity);
  });
  it('balances a view: rule weights relative to the largest, within the pulse budget', () => {
    const big = [0, 1, 2, 3, 4, 5].map(() => tagHeat(fakeFlow(3), 'dsp', 14));
    const small = [tagHeat(fakeFlow(3), 'driver', 3), tagHeat(fakeFlow(3), 'tia', 2), tagHeat(fakeFlow(3), 'lasers', 3)];
    const flows = [...big, ...small], before = flows.reduce((a, f) => a + f.count, 0);
    balanceHeat(flows);
    const s = Object.fromEntries(heatSources(flows).map(x => [x.source, x.weight]));
    expect(s.driver / s.dsp).toBeCloseTo(heatWeight(3, 14), 6);
    expect(s.tia / s.dsp).toBeCloseTo(heatWeight(2, 14), 6);
    expect(s.dsp).toBeGreaterThan(s.driver); expect(s.driver).toBeGreaterThan(s.tia);
    expect(flows.reduce((a, f) => a + f.count, 0)).toBeLessThanOrEqual(before);
  });
  it('refuses a stream for a part under the threshold', () => {
    expect(() => balanceHeat([tagHeat(fakeFlow(3), 'dsp', 16), tagHeat(fakeFlow(3), 'pd', 0.05)])).toThrow(/under 0.5 W/);
  });
});
