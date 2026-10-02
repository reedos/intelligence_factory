import { describe, it, expect } from 'vitest';
import { glowFor, powerGlowLayer, POWER_GLOW, ledgerW } from './power-glow.js';
import { powerWeight, heatWeight, HEAT_SCALE } from './heat.js';
import { TIERS } from './app/render-quality.js';

// The power-draw glow's rule (src/power-glow.js): the heat rule's log weight, brightness and reach each its square root.
describe('power glow rule', () => {
  it('is the heat rule: same weight, same threshold', () => {
    for (const [w, ref] of [[1200, 1200], [25, 1200], [2, 10], [0.4, 10], [0.5, 10], [5e7, 4.3e7]]) expect(powerWeight(w, ref)).toBe(heatWeight(w, ref));
    expect(glowFor(HEAT_SCALE.minW * 0.99, 10)).toBeNull();
    expect(glowFor(HEAT_SCALE.minW, 10)).not.toBeNull();
  });
  it('more watts never glows less, and every 10× is the same step', () => {
    let last = 0;
    for (const w of [0.5, 1, 2, 5, 10, 50, 100, 500, 1000]) { const g = glowFor(w, 1000)!; expect(g.gain * g.reach).toBeGreaterThan(last); last = g.gain * g.reach; }
    const a = glowFor(10, 1000)!, b = glowFor(100, 1000)!, c = glowFor(1000, 1000)!;
    expect(b.weight / a.weight).toBeCloseTo(c.weight / b.weight, 6);
    expect(c.weight / b.weight).toBeCloseTo(HEAT_SCALE.perDecade, 6);
    expect(c.gain).toBeCloseTo(POWER_GLOW.gain, 9);
  });
});

describe('power glow layer', () => {
  const parts = [
    { id: 'big', watts: 1000, at: [0, 0, 0], size: [1, 1] },
    { id: 'mid', watts: 100, at: [2, 0, 0], size: [0.5, 0.5] },
    { id: 'tiny', watts: 0.6, at: [3, 0, 0], size: [0.1, 0.1] },
    { id: 'passive', watts: 0.1, at: [4, 0, 0], size: [0.1, 0.1] },
  ];
  it('one instanced mesh, brightest first, sub-threshold parts left out', () => {
    const L = powerGlowLayer(parts)!;
    expect(L.mesh.isInstancedMesh).toBe(true);
    expect(L.parts.map((p: any) => p.id)).toEqual(['big', 'mid', 'tiny']);
    expect(L.refWatts).toBe(1000);
    expect(powerGlowLayer([{ id: 'x', watts: 0.2, at: [0, 0, 0], size: [1, 1] }])).toBeNull();
  });
  it('shows in the power layer only', () => {
    const L = powerGlowLayer(parts)!;
    L.update(1, 'power'); expect(L.mesh.visible).toBe(true);
    L.update(1, 'data'); expect(L.mesh.visible).toBe(false);
    L.update(1, 'heat'); expect(L.mesh.visible).toBe(false);
  });
  it('a fixed reference keeps a lesser variant dimmer, and switched-off parts draw nothing', () => {
    const L = powerGlowLayer([{ id: 'a', watts: 6, at: [0, 0, 0], size: [1, 1] }], { refWatts: 14 })!;
    expect(L.parts[0].glow.weight).toBeCloseTo(heatWeight(6, 14), 9);
    L.setActive(() => false); L.update(0, 'power'); expect(L.mesh.visible).toBe(false);
  });
  it('tiers: bloom-free tiers are brighter, saver tiers drop the faintest; reduced motion does not breathe', () => {
    const L = powerGlowLayer(parts)!, u = (L.mesh.material as any).uniforms;
    L.setTier(TIERS[0]); expect(u.uBoost.value).toBe(1); expect(L.drawn).toBe(3);
    L.setTier(TIERS[TIERS.length - 1]); expect(u.uBoost.value).toBe(POWER_GLOW.noBloomBoost); expect(L.drawn).toBe(2); expect(L.mesh.count).toBe(2);
    expect(u.uPulse.value).toBe(POWER_GLOW.pulse);
    expect((powerGlowLayer(parts, { reduced: true })!.mesh.material as any).uniforms.uPulse.value).toBe(0);
  });
  it('ledger losses sum the rows linked to a part, in watts', () => {
    const M = { ledger: [{ mw: 0.4, link: { scene: 1, part: 'mpt' } }, { mw: 0.1, link: { scene: 1, part: 'mpt' } }, { mw: 9, link: { scene: 2, part: 'ups' } }] };
    expect(ledgerW(M, 1, 'mpt')).toBeCloseTo(5e5, 3);
    expect(ledgerW(M, 2, 'mpt')).toBe(0);
  });
});
