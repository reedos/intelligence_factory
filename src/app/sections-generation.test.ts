import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ACCELERATORS, compute, DEFAULT_SCENARIO } from '../model/engine';
vi.mock('./links.js',()=>({goAttr:()=>''}));
let scaleUpDiagram:any, linkCensusRows:any;
beforeAll(async()=>{
  vi.stubGlobal('document',{getElementById:()=>null});
  ({scaleUpDiagram,linkCensusRows}=await import('./sections.js'));
});
const rows=(accel:any)=>linkCensusRows(compute({...DEFAULT_SCENARIO,accel}));
describe('generation-specific public diagrams and census',()=>{
  it('Rubin shows 36 switch chips and sampled fabric relations without a fabricated ASIC port map',()=>{
    const svg=scaleUpDiagram(ACCELERATORS.rubin);
    expect(svg).toContain('36 NVLink 6 switch chips, 4 per switch tray × 9 trays');
    expect(svg).toContain('36 logical links; 3 TB/s aggregate per GPU');
    expect(svg).toContain('sampled relationships, not port wiring');
    expect(svg).not.toMatch(/72 ports each|5,184|1,296/);
    expect((svg.match(/<circle /g)||[]).length).toBe(72);
    expect((svg.match(/width="14" height="20"/g)||[]).length).toBe(36);
  });
  it('Rubin physical NIC and DPU counts remain separate from aggregate bandwidth',()=>{
    const c=rows('rubin');
    expect(c[1][2]).toContainEqual(['ConnectX-9 SuperNICs','8']);
    expect(c[1][2]).toContainEqual(['BlueField-4 DPUs','1']);
    expect(c[1][2]).toContainEqual(['Scale-out optical ports','8 × 800G']);
    expect(c[2][2]).toContainEqual(['ConnectX-9 SuperNICs','144']);
    expect(c[2][2]).toContainEqual(['BlueField-4 DPUs','18']);
    expect(JSON.stringify(c)).not.toMatch(/BlueField-3|5,184|1,296|one aggregate/);
  });
  it('H100 front-end cards are ConnectX-7 NICs, keeping the modeled link/fiber assumptions explicit',()=>{
    const c=rows('h100');
    expect(c[1][2]).toContainEqual(['Front-end dual-port ConnectX-7 cards','2']);
    expect(c[1][2]).toContainEqual(['Fibers (2 modeled front links)','≈80']);
    expect(c[2][2]).toContainEqual(['Front-end dual-port ConnectX-7 cards','8']);
    expect(c[2][2]).toContainEqual(['Fibers (8 modeled front links)','≈320']);
    expect(JSON.stringify(c)).not.toContain('BlueField');
  });
  it('GB200 and GB300 retain 18 switch chips but have distinct DPU counts',()=>{
    expect(rows('gb200')[1][2]).toContainEqual(['BlueField-3 DPUs, up to 2 × 400G','2']);
    expect(rows('gb300')[1][2]).toContainEqual(['BlueField-3 DPUs, up to 2 × 400G','1']);
    expect(rows('gb300')[2][2]).toContainEqual(['NVLink switch chips','18']);
  });
});
