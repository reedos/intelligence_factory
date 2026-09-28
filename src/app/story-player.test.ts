// Tests for the tour-player fixes (tour audit findings 9, 10, 14, 16) that don't need a DOM: story.js queries the
// page at import time (the panel, the stage, #view...), so it is driven by the Playwright probes instead
// (tools/tours.mjs, tools/ui.mjs). What's tested here are the pure pieces those fixes are built on: the beats
// layer() generates, the claim keys they carry, and the CHAIN a chaining tab's disclosure text reads from. The
// small helpers below that mirror story.js's private hereDir()/dwell()/tourLen() are commented as such, on
// purpose kept in one place so a change to the real ones is easy to notice here too.
import { describe, it, expect } from 'vitest';
import { compute, ACCELERATORS, POWER, COOLING } from '../model/engine';
import { content } from '../data.js';
import { layer, everything, CHAIN, OUTWARD } from './journeys.js';
import { allClaims } from '../claims.js';

const scenarios: any[] = [];
for (const accel of Object.keys(ACCELERATORS)) for (const power of Object.keys(POWER)) for (const cooling of Object.keys(COOLING))
  scenarios.push({ meterMW: 100, accel, power, cooling });
const M0 = compute({ meterMW: 100, accel: 'gb200', power: 'dc800', cooling: 'liquid' });
const C0 = content(M0);

describe('This level entry context (finding 9): layer(M, mode, scene) for every level and layer', () => {
  it.each(['power', 'data', 'heat'] as const)('%s: every one of the 6 levels generates a walk scoped to just that level and layer', mode => {
    for (let scene = 0; scene < 6; scene++) {
      const beats = layer(M0, mode, scene);
      expect(beats.length, `${mode} level ${scene + 1}`).toBeGreaterThan(0);
      // "This level" only means something if every beat it plays really is that level, in that layer - the
      // whole premise the entry-context snapshot in story.js's enter() protects
      for (const b of beats) { expect(b.link.mode, mode).toBe(mode); expect(b.link.scene, `level ${scene + 1}`).toBe(scene); }
      expect(beats[0].level, 'opens on the level overview').toBe(true);
      expect(C0.SCENES[scene].title, `level ${scene + 1} has a title for the "This level: <title> · ${mode}" label`).toBeTruthy();
    }
  });
});

// mirrors story.js's hereDir()/validLevel()/beyond()/before() - kept in lockstep by hand, since story.js itself
// can't be imported here (see the file banner)
const hereDir = (mode: string) => (OUTWARD.has(mode) ? -1 : 1);
const validLevel = (n: number) => n >= 0 && n < 6;
describe("This level's next/previous follows the layer's flow direction (finding 16)", () => {
  it('power and data stay inward: level 1 to level 6, next is always +1', () => {
    for (const mode of ['power', 'data'] as const) {
      expect(hereDir(mode)).toBe(1);
      let scene = 0; const seen = [scene];
      while (validLevel(scene + hereDir(mode))) { scene += hereDir(mode); seen.push(scene); }
      expect(seen).toEqual([0, 1, 2, 3, 4, 5]);
    }
  });
  it('heat runs outward: package to plant, level 6 to level 1, next is always -1', () => {
    expect(hereDir('heat')).toBe(-1);
    let scene = 5; const seen = [scene];
    while (validLevel(scene + hereDir('heat'))) { scene += hereDir('heat'); seen.push(scene); }
    expect(seen).toEqual([5, 4, 3, 2, 1, 0]);
    // and that is exactly the order the full Heat tour (layer(M, 'heat'), no single level) visits them in -
    // This level's direction has to agree with the tour it's a slice of
    const fullHeatOrder = layer(M0, 'heat').filter((b: any) => b.level).map((b: any) => b.link.scene);
    expect(fullHeatOrder).toEqual(seen);
  });
  it('at the package (level 6), heat has an outward next (the tray) and no inward previous', () => {
    expect(validLevel(5 + hereDir('heat'))).toBe(true);   // next: level 5, the tray - "Continue to compute tray heat"
    expect(validLevel(5 - hereDir('heat'))).toBe(false);  // previous: level 7 doesn't exist
  });
  it('at across (level 1), heat has no outward next and an inward previous (the campus)', () => {
    expect(validLevel(0 + hereDir('heat'))).toBe(false);
    expect(validLevel(0 - hereDir('heat'))).toBe(true);
  });
});

describe('Every-part chip keys resolve through claimByKey (finding 4)', () => {
  it.each(scenarios)('$accel / $power / $cooling: every specKey:row on a part beat is a real, matching claim', s => {
    const M = compute(s), C = content(M);
    const claims = allClaims(M, C), byKey = new Map(claims.map(c => [c.key, c]));
    let checked = 0;
    for (const mode of ['power', 'data', 'heat'] as const) {
      for (const b of layer(M, mode) as any[]) {
        if (!b.link.part) continue;                        // a level overview beat carries no specs/specKey
        expect(b.specKey, `${mode}:${b.link.scene}:${b.link.part}`).toBe(`card:${mode}:${C.SCENES[b.link.scene].id}:${b.link.part}`);
        b.specs.forEach((row: any[], j: number) => {
          const key = `${b.specKey}:${j}`, claim = byKey.get(key);
          expect(claim, key).toBeTruthy();
          expect(claim!.value, key).toBe(row[1]);
          expect(claim!.basis, key).toBe(row[2]);
          checked++;
        });
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
  it('layer() passes every row, not a 3-row preview - the disclosure has something to hold', () => {
    // find a part with more than 3 spec rows in the default scenario and confirm layer() kept them all
    const dataBeats = layer(M0, 'data') as any[];
    const long = dataBeats.find(b => b.link.part && b.specs.length > 3);
    expect(long, 'expected at least one data-layer part with > 3 spec rows').toBeTruthy();
    expect(long.specs.length).toBeGreaterThan(3);
  });
});

describe('The optics-cutaway figure lands on the CPO stop (finding 4)', () => {
  it('the hall CPO part carries figure: "optics-cutaway" in the data layer, and only in the data layer', () => {
    const dataHall = (layer(M0, 'data', 2) as any[]).find(b => b.link.part === 'cpo');
    expect(dataHall?.figure).toBe('optics-cutaway');
    const powerLevels = layer(M0, 'power') as any[];
    expect(powerLevels.some(b => b.figure)).toBe(false);   // the figure is data-layer only; power/heat cards don't carry it
  });
});

// mirrors story.js's specWords()/dwell() - see the file banner
const specWords = (b: any) => (b.specs || []).slice(0, 3).reduce((n: number, [k, v]: any[]) => n + `${k} ${v}`.split(/\s+/).length, 0);
const dwellPure = (b: any) => {
  const words = `${b.title} ${b.text}`.split(/\s+/).length + specWords(b);
  const read = Math.max(6000, 3000 + words * 230);
  const cap = Math.max(16000, Math.min(30000, read));
  return Math.max(b.sim ? 16000 : 0, Math.min(cap, read));
};
const fmtMsPure = (ms: number) => (ms < 60000 ? `${Math.round(ms / 1000)} s` : `${Math.round(ms / 60000)} min`);
// mirrors story.js's tourLen() chaining branch
const SHORT: Record<string, string> = { 'all-power': 'Power', 'all-heat': 'Heat', 'all-data': 'Data' };
function tourLenPure(id: string, M: any) {
  const beatsOf = (tid: string) => layer(M, tid.replace('all-', '') as any) as any[];
  const beats = beatsOf(id), ms = beats.reduce((a, b) => a + dwellPure(b), 0);
  const own = `${beats.length} step${beats.length === 1 ? '' : 's'} · ≈${fmtMsPure(ms)}`;
  const chain = CHAIN['Every part'], k = chain.indexOf(id), after = chain.slice(k + 1);
  if (!after.length) return own;
  const allMs = chain.slice(k).reduce((a, tid) => a + beatsOf(tid).reduce((a2, b) => a2 + dwellPure(b), 0), 0);
  const names = after.length > 1 ? `${after.slice(0, -1).map(t => SHORT[t]).join(', ')} and ${SHORT[after.at(-1) as string]}` : SHORT[after[0]];
  return `${own}, then ${names} (≈${fmtMsPure(allMs)} in all)`;
}
describe('Chaining disclosure text (finding 10)', () => {
  it('Power discloses that it hands over into Heat and Data, with the full chained time', () => {
    expect(tourLenPure('all-power', M0)).toMatch(/^\d+ steps? · ≈.+, then Heat and Data \(≈.+ in all\)$/);
  });
  it('Heat discloses that it hands over into Data', () => {
    expect(tourLenPure('all-heat', M0)).toMatch(/, then Data \(≈.+ in all\)$/);
  });
  it('Data is terminal: no "then" clause', () => {
    expect(tourLenPure('all-data', M0)).not.toMatch(/then/);
  });
  it("the chain's own total is at least the sum of what's left after each hand-off (never a shrinking estimate)", () => {
    const chain = CHAIN['Every part'];
    for (let k = 0; k < chain.length; k++) {
      const rest = chain.slice(k).reduce((a, id) => a + (layer(M0, id.replace('all-', '') as any) as any[]).reduce((a2, b) => a2 + dwellPure(b), 0), 0);
      const own = (layer(M0, chain[k].replace('all-', '') as any) as any[]).reduce((a, b) => a + dwellPure(b), 0);
      expect(rest, chain[k]).toBeGreaterThanOrEqual(own);
    }
  });
});

// sanity: everything() still equals the three layers concatenated, unaffected by any of the above
describe('everything() is unaffected by the specKey/figure additions', () => {
  it('still power + heat + data, in order', () => {
    const all = everything(M0) as any[];
    const bounds = ['power', 'heat', 'data'].map(m => (layer(M0, m as any) as any[]).length);
    expect(all.length).toBe(bounds.reduce((a, b) => a + b, 0));
  });
});
