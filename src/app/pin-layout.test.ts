import { describe, expect, it } from 'vitest';
import { overlapsRect, pinLabelBox } from './pin-layout.js';

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
