// The data hall's rack faces take their rows from the rack level (10/03/2026 drift audit, items 6, 7, 12 and the hall rack
// depth of 17). Before, hall.js and build-hall-finish.py each held a literal copy of the NVL72 elevation (36 rows, one
// management unit, against the rack's 37 and two) and the hall's H100 racks painted near-black servers with ten fan circles
// where the rack level covers each closed DGX H100 with a foam bezel. These tests read what is DRAWN or SHIPPED on the hall
// side (the painted texture, the JSON the Python reads, the GLB's extras, the built scene) and compare it with the rack level's
// own records (nvl72-layout.js, dgx-h100-layout.js, rack.js's built H100 rack).
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
// @ts-expect-error test-only Node built-in
import { readFileSync } from 'node:fs';
import { compute, DEFAULT_SCENARIO } from '../model/engine';

type Fill = { style: string; a: number[] };
let fills: Fill[] = [];
let L: any, G: any, F: any, hall: any, rack: any, kit: any;
beforeAll(async () => {
  const noop = () => undefined;
  const target: Record<string, any> = { createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), measureText: (t: string) => ({ width: t.length * 24 }),
    createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }),
    fillRect: (...a: number[]) => { fills.push({ style: target.fillStyle, a }); } };
  const ctx = new Proxy(target, { get: (t, k: string) => k in t ? t[k] : noop, set: (t, k: string, v) => { t[k] = v; return true; } });
  vi.stubGlobal('document', { createElement: () => ({ width: 1, height: 1, getContext: () => ctx }) });
  [L, G, F, hall, rack, kit] = await Promise.all([import('./nvl72-layout.js'), import('./dgx-h100-layout.js'), import('./hall-rack-face.js'), import('./hall.js'), import('./rack.js'), import('../kit.js')]);
}, 60000);
afterAll(() => { vi.unstubAllGlobals(); });

const opts = (scenario: any = {}) => ({ quality: { mobile: true, shadows: false, reflections: false }, state: { mode: 'power' }, model: compute({ ...DEFAULT_SCENARIO, ...scenario }) });
const json = (name: string) => JSON.parse(readFileSync(new URL(`../../tools/blender/references/${name}`, import.meta.url), 'utf8'));
const glbExtras = (name: string) => {
  const d = readFileSync(new URL('../../public/models/hall-finish.glb', import.meta.url)), len = d.readUInt32LE(12);
  const j = JSON.parse(d.subarray(20, 20 + len).toString('utf8'));
  return j.nodes.find((n: any) => n.name === name)?.extras;
};
const counts = (kinds: string[]) => ['compute', 'switch', 'power', 'management'].map(k => `${kinds.filter(x => x === k).length} ${k}`).join(';') + `;${kinds.length} total`;

describe('hall NVL72 rack face is the rack level\'s elevation', () => {
  it('the painted face has one row per rack unit of nvl72-layout.js, at the layout\'s heights (37, two management units)', () => {
    fills = []; F.paintNvlFace(new Proxy({}, { get: () => () => undefined }), 256, 512);   // warm the painter on a bare proxy: no throw
    fills = [];
    const g = new Proxy({ fillRect: (...a: number[]) => fills.push({ style: (g as any).fillStyle, a }) } as any, { get: (t, k: string) => k in t ? t[k] : () => undefined, set: (t, k: string, v) => { t[k] = v; return true; } });
    F.paintNvlFace(g, 256, 512);
    const rows = fills.filter(f => f.a[0] === 8 && f.a[2] === 256 - 16 && f.a[3] > 4).sort((p, q) => q.a[1] - p.a[1]);   // bottom row first
    expect(L.LAYOUT.length).toBe(37);
    expect(rows).toHaveLength(L.LAYOUT.length);
    const faceH = L.RACK.H - 0.05;
    rows.forEach((r, i) => {
      const centerM = L.RACK.H - (r.a[1] + (r.a[3] + 2) / 2) / 512 * faceH;       // the row's center, meters up the rack
      expect(centerM, `row ${i} height`).toBeCloseTo(L.trayY(i), 3);
    });
    expect(L.LAYOUT.filter((k: string) => k === 'mgmt')).toHaveLength(2);
  });
  it('the descriptor the Blender relief reads matches the layout kind for kind', () => {
    const rows = F.nvlFaceRows();
    expect(rows.map((r: any) => r.kind)).toEqual(L.LAYOUT.map((k: string) => ({ ps: 'power', compute: 'compute', switch: 'switch', mgmt: 'management' } as any)[k]));
    expect(rows.map((r: any) => r.y)).toEqual(L.LAYOUT.map((_: string, i: number) => L.trayY(i)));
  });
  it('references/hall-layout.json (read by build-hall-finish.py) is the exported record, not a stale copy', () => {
    const j = json('hall-layout.json'), plain = (v: unknown) => JSON.parse(JSON.stringify(v));
    expect(j.rack).toEqual(L.RACK);
    expect(j.face).toEqual(plain(F.FACE));
    expect(j.nvl.rows).toEqual(plain(F.nvlFaceRows()));
    expect(j.nvl.pitch).toBe(L.U);
    expect(j.h100).toEqual(plain({ ...G.DGX_RACK, serverY: F.h100FaceServers().map((s: any) => s.y), mgmtY: F.h100FaceMgmtY() }));
  });
  it('build-hall-finish.py reads that file and keeps no literal copy of either elevation', () => {
    const py = readFileSync(new URL('../../tools/blender/build-hall-finish.py', import.meta.url), 'utf8');
    expect(py).toMatch(/hall-layout\.json/); expect(py).toMatch(/HL\['nvl'\]\['rows'\]/); expect(py).toMatch(/H\['serverY'\]/);
    expect(py).not.toMatch(/\['power'\]\*4/); expect(py).not.toMatch(/range\(4\)[\s\S]{0,80}8\.2/); expect(py).not.toMatch(/total'$/m);
  });
  it('the shipped hall-finish.glb was built from this layout (drawer counts in its extras)', () => {
    const e = glbExtras('NVL_FACE');
    expect(e?.ifxDrawerCounts, 'rebuild: blender --background --python tools/blender/build-hall-finish.py').toBe(counts(F.nvlFaceRows().map((r: any) => r.kind)));
    expect(e.ifxDrawerCounts).toBe('18 compute;9 switch;8 power;2 management;37 total');
  });
});

describe('hall H100 rack face is the rack level\'s DGX H100 front', () => {
  it('four servers at the rack\'s chassis heights, the same bezel color, handles, panel and ears', () => {
    const { DGX_RACK: R, dgxServerY } = G;
    expect(R.servers).toBe(4);
    expect(F.h100FaceServers().map((s: any) => s.y)).toEqual([0, 1, 2, 3].map(k => dgxServerY(k)));
    expect(R.chassisW).toBeCloseTo(G.DGX.W / 10, 6);                               // the server level's width
    expect(R.fans).toBe(12);                                                      // four across, three high behind the bezel
    expect(R.bezel.w).toBeCloseTo(R.chassisW - 0.016, 9);
  });
  it('rack.js builds its closed servers from that record: foam bezel plate, two handles each, ears, control panel', () => {
    const built = rack.build(opts({ accel: 'h100', cooling: 'air' })), R = G.DGX_RACK;
    let foam: any = null, plates = 0;
    built.scene.traverse((o: any) => { if (o.isInstancedMesh && o.material?.[4]?.name === 'DGX bezel metal foam') { foam = o; plates = o.count; } });
    expect(foam, 'the foam-bezelled plate mesh').toBeTruthy();
    expect(plates, 'closed servers in the rack level (one is pulled out)').toBe(R.servers - 1);
    const p = foam.geometry.parameters;
    expect(p.width).toBeCloseTo(R.bezel.w, 9); expect(p.height).toBeCloseTo(R.bezel.h, 9);
    const m = new kit.THREE.Matrix4(), pos = new kit.THREE.Vector3(), ys: number[] = [];
    for (let i = 0; i < foam.count; i++) { foam.getMatrixAt(i, m); pos.setFromMatrixPosition(m); ys.push(pos.y); }
    ys.sort((a, b) => a - b).forEach((y, i) => expect(y).toBeCloseTo(G.dgxServerY([0, 1, 3][i]), 5));       // servers 0, 1 and 3; server 2 is the pulled one
    // the foam's base color is the record's, on the rack's map (read back from the texture it painted)
    expect(foam.material[4].map).toBeTruthy();
  });
  it('the hall paints the same four bezel-covered servers (no fan circles) and a management switch above them', () => {
    const arcs: number[] = [], rects: Fill[] = [];
    const g: any = new Proxy({ fillRect: (...a: number[]) => rects.push({ style: g.fillStyle, a }), arc: (...a: number[]) => arcs.push(a[2]) } as any,
      { get: (t, k: string) => k in t ? t[k] : () => undefined, set: (t, k: string, v) => { t[k] = v; return true; } });
    F.paintH100Face(g, 256, 512);
    const [fr, fg, fb] = G.DGX_RACK.bezel.rgb, bezelFill = `rgb(${Math.round(fr * 0.86)},${Math.round(fg * 0.86)},${Math.round(fb * 0.86)})`;
    const plates = rects.filter(f => f.style === bezelFill);
    expect(plates, 'one foam bezel per server').toHaveLength(G.DGX_RACK.servers);
    const faceH = L.RACK.H - 0.05;
    plates.forEach((f, k) => {
      expect(L.RACK.H - (f.a[1] + f.a[3] / 2) / 512 * faceH, `server ${k} height`).toBeCloseTo(G.dgxServerY(k), 2);
      expect(f.a[2] / 256 * 0.52, 'bezel width').toBeCloseTo(G.DGX_RACK.bezel.w, 2);
    });
    expect(arcs.filter(r => r > 8), 'no ten-fan face: the 12 fans sit behind the closed bezel').toHaveLength(0);
  });
  it('the shipped hall-finish.glb carries the same server count and chassis pitch', () => {
    const e = glbExtras('H100_FACE'), R = G.DGX_RACK;
    expect(e?.ifxFace, 'rebuild: blender --background --python tools/blender/build-hall-finish.py').toBe(`${R.servers} servers;${R.fans} fans each;pitch ${(R.SU + R.gap).toFixed(5)}`);
  });
});

describe('hall rack depth comes from the rack layout', () => {
  it('the hall plan\'s rack depth is the rack level\'s 1.07 m, and the rack level builds that depth', () => {
    expect(L.RACK.D).toBe(1.07);
    const h = hall.build(opts()), r = rack.build(opts());
    expect(h.scene.userData.hallPlan.rackDepth).toBe(L.RACK.D);
    expect(h.scene.userData.hallSlice.rackDepth).toBe(L.RACK.D);
    expect(r.scene.userData.rackPlan.depth).toBe(L.RACK.D);
  }, 60000);
});
