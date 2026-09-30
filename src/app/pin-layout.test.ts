import { describe, expect, it } from 'vitest';
import { overlapsRect, pinLabelBox, declutterPins } from './pin-layout.js';

describe('pin labels respect visible UI reservations',()=>{
  const hud={left:600,right:1050,top:20,bottom:140};
  it('rejects an unselected label underneath HUD instructions',()=>{
    expect(pinLabelBox(815,100,95,1100,750,[hud])).toBeNull();
    expect(overlapsRect({left:802,right:828,top:87,bottom:113},hud,4)).toBe(true);
  });
  it('places a selected label beside the reservation without moving its anchor',()=>{
    const box=pinLabelBox(815,100,95,1100,750,[hud],true);
    expect(box).not.toBeNull();expect(overlapsRect(box!,hud,4)).toBe(false);
    expect(box!.bottom).toBeLessThan(750);expect(box!.left).toBeGreaterThanOrEqual(6);
  });
  it('flips to the clear side instead of hiding a label whose marker remains clear',()=>{
    const right={left:230,right:390,top:10,bottom:100};
    const box=pinLabelBox(210,65,90,390,445,[right]);
    expect(box!.right).toBeLessThan(210);expect(overlapsRect(box!,right,4)).toBe(false);
  });
  it('does not treat mobile controls below the canvas as a label obstruction',()=>{
    const box=pinLabelBox(180,110,90,390,140,[{left:0,right:390,top:150,bottom:200}]);
    expect(box).not.toBeNull();
  });
});

describe('small-screen pin declutter', () => {
  it('fans a coincident pair apart and keeps each true point as a leader anchor', () => {
    const { placements, hidden, groups } = declutterPins([{ id: 'a', x: 100, y: 100 }, { id: 'b', x: 104, y: 101 }, { id: 'c', x: 300, y: 300 }]);
    expect(hidden.size).toBe(0); expect(groups).toHaveLength(0);
    const a = placements.get('a')!, b = placements.get('b')!;
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(26);
    expect([a.ax, a.ay]).toEqual([100, 100]);
    expect(placements.get('c')).toEqual({ x: 300, y: 300, ax: 300, ay: 300 });
  });
  it('collapses a pile of five into one group, and fans it out once opened', () => {
    const pile = [1, 2, 3, 4, 5].map(i => ({ id: `p${i}`, x: 200 + i * 3, y: 200 - i * 2 }));
    const closed = declutterPins(pile);
    expect(closed.groups).toHaveLength(1); expect(closed.groups[0].ids).toEqual(['p1', 'p2', 'p3', 'p4', 'p5']);
    expect(closed.hidden.size).toBe(5);
    const open = declutterPins(pile, { expanded: new Set(['p3']) });
    expect(open.groups).toHaveLength(0); expect(open.hidden.size).toBe(0);
    const spots = [...open.placements.values()];
    for (let i = 0; i < spots.length; i++) for (let j = i + 1; j < spots.length; j++) expect(Math.hypot(spots[i].x - spots[j].x, spots[i].y - spots[j].y)).toBeGreaterThanOrEqual(25.9);
  });
  it('never leaves two fans or badges touching, however dense the pile', () => {
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let trial = 0; trial < 20; trial++) {
      const pts = Array.from({ length: 13 }, (_, i) => ({ id: `q${i}`, x: 150 + rnd() * 120, y: 300 + rnd() * 70 }));
      const { placements, groups } = declutterPins(pts);
      const spots = [...[...placements.values()].map(p => ({ x: p.x, y: p.y, r: 12 })), ...groups.map(g => ({ x: g.x, y: g.y, r: 21 }))];
      for (let i = 0; i < spots.length; i++) for (let j = i + 1; j < spots.length; j++)
        expect(Math.hypot(spots[i].x - spots[j].x, spots[i].y - spots[j].y)).toBeGreaterThanOrEqual(spots[i].r + spots[j].r + 4 - 1e-6);
    }
  });
});
