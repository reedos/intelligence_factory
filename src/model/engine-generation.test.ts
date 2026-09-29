import { describe, expect, it } from 'vitest';
import { ACCELERATORS, compute, DEFAULT_SCENARIO } from './engine';

// NVIDIA: Rubin technical blogs p=111036 and p=113993; current NVLink specs;
// DGX H100 user guide. Validate end-to-end counts, not just catalog values.
describe('generation-specific network inventory', () => {
  for (const [id, chips, dpus, links] of [
    ['h100', 16, 0, 18], ['gb200', 18, 36, 18], ['gb300', 18, 18, 18], ['rubin', 36, 18, 36],
  ] as const) it(`${id} counts switch ASICs, DPUs and logical links by generation`, () => {
    const m=compute({...DEFAULT_SCENARIO,accel:id});
    expect(m.NET.nvswitchChips).toBe(m.racks*chips);
    expect(m.NET.dpus).toBe(m.racks*dpus);
    expect(m.NET.nvlinkLinks).toBe(m.gpus*links);
  });
  it('Rubin counts two physical 800G ports per GPU, including optics and switch capacity', () => {
    const m=compute({...DEFAULT_SCENARIO,accel:'rubin'}), f=m.fabric, F=m.NET.fabric;
    expect(m.accel.nicGbps).toBe(1600);
    expect(m.accel.nicPortGbps).toBe(800);
    expect(m.NET.fabrics[0].endpoints).toBe(m.gpus*2);
    expect(m.NET.gpuModules).toBe(m.gpus*2);
    expect(m.NET.links).toBe(m.gpus*2*(f.tiers===2?2:3));
    expect(m.NET.switchModules).toBe(m.gpus*2*(f.tiers===2?3:5)/F.portsPerModule);
    expect(m.NET.opticsMW).toBeCloseTo((m.gpus*2*F.gpuModuleW+m.NET.switchModules*F.portsPerModule*F.portModuleW)/1e6,10);
    expect(m.NET.fibers).toBe(m.NET.links*8);
    expect(m.NET.switches*F.radix).toBeGreaterThanOrEqual(m.gpus*2*(f.tiers===2?3:5));
    expect(m.ledger.reduce((n,r)=>n+r.mw,0)+m.gpuSiliconMW).toBeCloseTo(m.meterMW,9);
  });
  it('H100 uses four twin-port OSFP modules per eight-GPU server without halving optical power',()=>{
    const m=compute({...DEFAULT_SCENARIO,accel:'h100'}),F=m.NET.fabric;
    expect(m.NET.gpuModules).toBe(m.racks*4*4);
    expect(m.NET.gpuModules*2).toBe(m.gpus);
    expect(m.NET.opticsMW).toBeCloseTo((m.gpus*F.gpuModuleW+m.NET.switchModules*F.portsPerModule*F.portModuleW)/1e6,10);
  });
  it('Rubin tier boundary is evaluated using physical ports, not GPUs', () => {
    for(const meterMW of [1,10,20,50,100]) {
      const m=compute({...DEFAULT_SCENARIO,accel:'rubin',meterMW});
      if(m.fabric.tiers===2)expect(m.NET.fabrics[0].endpoints).toBeLessThanOrEqual(m.NET.fabric.radix**2/2);
    }
  });
  it('the bandwidth ladder keeps aggregate per-GPU line rate',()=>{
    const m=compute({...DEFAULT_SCENARIO,accel:'rubin'});
    expect(m.accel.nvlink.tbs).toBe(3);
    expect(m.accel.hbm.tbs).toBe(19.2);
    expect(m.accel.nicPortGbps*m.accel.nicsPerGpu).toBe(m.accel.nicGbps);
  });
});
