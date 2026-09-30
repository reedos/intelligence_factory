import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { attachFlowRibbons } from './flow-ribbons.js';

function fixture() {
  const scene = new THREE.Scene();
  const make = (points:number[][], color:string) => {
    const path = new THREE.CurvePath<THREE.Vector3>();
    for(let i=1;i<points.length;i++)path.add(new THREE.LineCurve3(new THREE.Vector3(...points[i-1]),new THREE.Vector3(...points[i])));
    const group = new THREE.Group(), mesh = new THREE.Object3D(); group.add(mesh); scene.add(group);
    return { path, group, mesh, len:path.getLength(), count:12, base:{color:new THREE.Color(color),opacity:1}, acc:0, phase:.2, gain:1, bright:1 };
  };
  const flows = [make([[0,0,0],[0,1,0],[1,1,0]],'#00aaff'),make([[1,1,0],[1,0,0]],'#ff6600')];
  const dataFlows=[make([[0,0,0],[0,0,2]],'#ee55ff')];
  let ticks=0;
  const built:any={scene,flows,dataFlows,heatFlows:[],update:()=>++ticks};
  return {built,flows,dataFlows};
}

describe('batched engineering motion ribbons',()=>{
  it('keeps exact path segments and directions with two depth-tested draws per layer',()=>{
    const {built,flows}=fixture(),effect=attachFlowRibbons(built);
    expect(effect.batches).toHaveLength(2);expect(effect.root.children).toHaveLength(2);
    const batch=effect.batches[0],a=batch.geometry.getAttribute('instanceStart'),b=batch.geometry.getAttribute('instanceEnd');
    expect(a.count).toBe(3);
    let i=0;for(const flow of flows)for(const curve of flow.path.curves){
      expect(new THREE.Vector3().fromBufferAttribute(a,i).toArray()).toEqual(curve.getPoint(0).toArray());
      expect(new THREE.Vector3().fromBufferAttribute(b,i).toArray()).toEqual(curve.getPoint(1).toArray());i++;
    }
    for(const layer of effect.batches){expect(layer.group.children).toHaveLength(2);for(const line of layer.group.children){expect((line as any).material.depthTest).toBe(true);expect((line as any).material.depthWrite).toBe(false);}}
    expect(attachFlowRibbons(built)).toBe(effect);
  });
  it('animates zero-core routes at an independent ribbon density',()=>{
    const {built,dataFlows}=fixture();Object.assign(dataFlows[0],{count:0,ribbonCount:20});
    const effect=attachFlowRibbons(built),batch=effect.batches.find((b:any)=>b.key==='dataFlows')!;
    expect(batch.entries[0].period).toBeCloseTo(dataFlows[0].len/10);
    const phase=batch.phase.getX(0);dataFlows[0].acc=.05;effect.update();
    expect(batch.phase.getX(0)).not.toBe(phase);expect(batch.alpha.getX(0)).toBe(1);
    effect.setQuality({halo:false});expect(batch.group.children[1].visible).toBe(true);
  });
  it('follows the source clock and individual route visibility without connecting unrelated paths',()=>{
    const {built,flows,dataFlows}=fixture(),effect=attachFlowRibbons(built),batch=effect.batches[0];
    const before=batch.phase.getX(0);flows[0].acc=.1;expect(built.update(1,.1)).toBe(1);
    expect(batch.phase.getX(0)).not.toBe(before);const stopped=batch.phase.getX(0);built.update(2,1);expect(batch.phase.getX(0)).toBe(stopped);
    flows[0].gain=0;built.update(3,1);expect(batch.alpha.getX(0)).toBe(0);expect(batch.alpha.getX(2)).toBe(1);
    flows[1].base.opacity=.45;built.update(3,0);expect(batch.alpha.getX(2)).toBeCloseTo(.45);flows[1].bright=2.8;built.update(3,0);expect(batch.alpha.getX(2)).toBe(1);
    flows[1].base.opacity=0;built.update(3,0);expect(batch.alpha.getX(2)).toBe(0);
    flows[1].group.visible=false;dataFlows[0].mesh.visible=false;built.update(4,1);
    expect(effect.batches.every((b:any)=>!b.group.visible)).toBe(true);
  });
  it('drops the halo draw while preserving every animated route and clock',()=>{
    const {built,flows}=fixture(),effect=attachFlowRibbons(built);
    effect.setQuality({halo:false});flows[0].acc=.2;effect.update();
    expect(effect.drawCallsPerVisibleLayer).toBe(1);
    for(const batch of effect.batches) {
      expect(batch.group.children[0].visible).toBe(false);
      expect(batch.group.children[1].visible).toBe(true);
      expect(batch.group.visible).toBe(true);
    }
    const phase=effect.batches[0].phase.getX(0);
    effect.setQuality({halo:true});effect.update();
    expect(effect.batches[0].phase.getX(0)).toBe(phase);
    expect(effect.drawCallsPerVisibleLayer).toBe(2);
  });
  it('injects per-route phase and visibility into both shared line shader variants',()=>{
    const {built}=fixture(),effect=attachFlowRibbons(built);
    for(const line of effect.batches[0].group.children){
      const material=(line as any).material,base=(THREE.ShaderLib as any).line;
      const shader={vertexShader:base.vertexShader,fragmentShader:base.fragmentShader};material.onBeforeCompile(shader);
      expect(shader.vertexShader).toContain('vFlowAlpha = instanceFlowAlpha');
      expect(shader.vertexShader).toContain('instanceDistanceEnd + instanceFlowPhase');
      expect(shader.fragmentShader).toContain('alpha *= vFlowAlpha');
    }
  });
  it('tracks translated, rotated and animated exploded parents without rewriting unchanged geometry',()=>{
    const {built,flows}=fixture(),board=new THREE.Group();board.position.set(2,1.5,-3);board.scale.setScalar(2);board.rotation.y=Math.PI/2;built.scene.add(board);board.add(flows[0].group);
    const effect=attachFlowRibbons(built),batch=effect.batches[0],start=batch.geometry.getAttribute('instanceStart'),end=batch.geometry.getAttribute('instanceEnd');
    expect(new THREE.Vector3().fromBufferAttribute(start,0).toArray()).toEqual([2,1.5,-3]);
    expect(new THREE.Vector3().fromBufferAttribute(end,0).toArray()).toEqual([2,3.5,-3]);
    const version=start.data.version;effect.update();expect(start.data.version).toBe(version);
    flows[0].acc=.1;effect.update();const phase=batch.phase.getX(0);
    board.position.y=4;board.scale.setScalar(3);effect.update();
    expect(start.getY(0)).toBe(4);expect(end.getY(0)).toBe(7);expect(batch.phase.getX(0)).toBe(phase);
    expect(start.data.version).toBeGreaterThan(version);
    board.visible=false;effect.update();expect(batch.alpha.getX(0)).toBe(0);expect(batch.alpha.getX(2)).toBe(1);
  });
});
