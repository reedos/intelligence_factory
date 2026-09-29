import { beforeAll, afterAll, vi, describe, it, expect } from 'vitest';
import { qualityPressure, TIERS } from './render-quality.js';
let Flow:any;
beforeAll(async () => {
  const noop=()=>undefined;
  const ctx=new Proxy({createImageData:(w:number,h:number)=>({data:new Uint8ClampedArray(w*h*4)})} as Record<string,unknown>,{get:(t,k:string)=>k in t?t[k]:noop});
  vi.stubGlobal('document',{createElement:()=>({width:1,height:1,getContext:()=>ctx})});
  ({Flow}=await import('../kit.js'));
});
afterAll(()=>vi.unstubAllGlobals());
import * as THREE from 'three';

describe('adaptive rendering pressure', () => {
  it('responds before 40 fps and sheds faster under severe load', () => {
    expect(qualityPressure({ frame: 23, gpu: 19, cpu: 3 })).toBe(1);
    expect(qualityPressure({ frame: 55, gpu: 42, cpu: 3 })).toBe(2);
  });
  it('handles expensive animation CPU and unavailable GPU timing', () => {
    expect(qualityPressure({ frame: 25, gpu: 4, cpu: 19 })).toBe(1);
    expect(qualityPressure({ frame: 25, gpu: null, cpu: 3 })).toBe(1);
    expect(qualityPressure({ frame: 60, gpu: NaN, cpu: 3 })).toBe(2);
  });
  it('keeps quality under an idle GPU frame cap and requires real recovery headroom', () => {
    expect(qualityPressure({ frame: 33.3, gpu: 3, cpu: 3 })).toBe(0);
    expect(qualityPressure({ frame: 16.7, gpu: null, cpu: 3 })).toBe(0);
    expect(qualityPressure({ frame: 16.7, gpu: 3, cpu: 3 })).toBe(-1);
    expect(qualityPressure({ frame: 16.7, gpu: 10, cpu: 3 })).toBe(0);
  });
});

describe('flow quality budgets', () => {
  it('reduces uploaded/drawn particles without changing routes, direction, speed or clock gating', () => {
    const f = new Flow([[0,0,0],[0,0,10]], '#00aaff', { count: 30, speed: 2 });
    f.phase = 0; const path = f.path, matrix = new THREE.Matrix4(), p = new THREE.Vector3();
    f.setRenderBudget(TIERS[6].particles); f.update(1);
    expect(f.mesh.instanceMatrix.updateRanges).toEqual([{start:0,count:9*16}]);
    expect(f.count).toBe(30); expect(f.mesh.count).toBe(9); expect(f.acc).toBe(2); expect(f.path).toBe(path);
    f.mesh.getMatrixAt(0, matrix); p.setFromMatrixPosition(matrix); expect(p.z).toBeCloseTo(2);
    f.setLevel(0); f.update(2); expect(f.acc).toBe(2); expect(f.mesh.visible).toBe(false);
    f.setRenderBudget(1); f.setLevel(1); f.update(3);
    expect(f.mesh.count).toBe(30); expect(f.mesh.visible).toBe(true); expect(f.acc).toBe(4);
    f.mesh.getMatrixAt(0, matrix); p.setFromMatrixPosition(matrix); expect(p.z).toBeCloseTo(4);
  });
  it('keeps sparse routes visible and does not invent extra particles', () => {
    for (const count of [1,2,3,8]) {
      const f = new Flow([[0,0,0],[1,0,0]], '#ff0000', { count });
      f.setRenderBudget(.3); expect(f.mesh.count).toBeGreaterThanOrEqual(Math.min(count,3));
      expect(f.mesh.count).toBeLessThanOrEqual(count);
    }
  });
});
