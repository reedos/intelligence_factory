// The four side levels are the bar's "Interconnects" group (Reed, 10/01/2026): each has a short tab name, the
// coherent one is named for what it is part of, its scene index stays 8 so every ?view=8.… link keeps working, and
// the line terminals at Scale across and the campus's line-terminal cutaway open it.
import { describe, it, expect } from 'vitest';
import { compute, DEFAULT_SCENARIO } from '../model/engine';
import { content } from '../data.js';

const C: any = content(compute(DEFAULT_SCENARIO));

describe('interconnects', () => {
  it('the side levels, in order, carry the tab names the bar shows', () => {
    const side = C.SCENES.map((s: any, i: number) => [i, s]).filter(([, s]: any) => s.side);
    expect(side.map(([i, s]: any) => [i, s.id, s.tab])).toEqual([
      [6, 'module', 'Pluggable optics'], [7, 'cpo', 'Co-packaged optics'],
      [8, 'coherent', 'Coherent optics'], [9, 'copper', 'Copper cables'],
    ]);
    expect(C.SCENES.filter((s: any) => !s.side).map((s: any) => s.n)).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it('the coherent level is coherent optics, the data center interconnect its kicker (Reed, 10/02)', () => {
    const s = C.SCENES[8];
    expect([s.title, s.kicker, s.door, s.n]).toEqual(['Coherent optics', '800ZR · data center interconnect', 'coherent optics', '+']);
    expect([C.SCENES[6].tab, C.SCENES[6].door, C.SCENES[9].kicker]).toEqual(['Pluggable optics', 'pluggable optics', 'DAC / ACC / AEC']);
    expect(C.SCENES[6].kicker).toMatch(/^(800G 2×DR4|1\.6T 2×DR4|1\.6T) · switch$/);
  });
  it('the line terminals at Scale across and the campus cutaway open it; the campus hut card does not (Reed, 10/01)', () => {
    const at = (sc: string, id: string) => C.PARTS_DATA[sc].find((p: any) => p.id === id)?.drill;
    expect([at('across', 'dci'), at('campus', 'lineterm'), at('campus', 'dci')]).toEqual([8, 8, undefined]);
  });
});
