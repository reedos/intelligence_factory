// Lane math on every drawn optical engine and module (Reed, 10/02/2026): a 6.4T engine drawn with 8 lanes read as
// 8 × 800G. For each one the site draws, the lanes it draws times their stated rate must equal the rate it states,
// with the port structure it names (DR4, 2 × DR4, FR4), and each package's total must equal engines × engine rate.
//   pluggable module   800G twin-port (8 × 100G, 2 × 400G DR4) and 1.6T twin-port (8 × 200G, 2 × 800G DR4)
//   NVIDIA-style CPO   8 rings × 200G = 1.6T per engine; 18 engines = 28.8T per switch chip
//   Broadcom-style CPO 16 × 400G FR4 = 64 lanes × 100G = 6.4T per engine; 8 engines = 51.2T
//   coherent 800ZR     one wavelength, DP-16QAM: 2 polarizations × 4 bits × ≈118 GBd carries the 800G
import { beforeAll, describe, it, expect, vi } from 'vitest';
// @ts-expect-error Vitest supplies Node built-ins; app tsconfig intentionally excludes Node types.
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CPO_MZM, BAILLY, cpoBlocks, baillyLayout, baillyFiberRoutes, engineLayout, cpoFiberRoutes } from './side-geometry.js';
import { moduleTier } from './lid-labels.js';
import { ACCELERATORS } from '../model/engine';

function canvasDocument() {
  return { createElement(tag: string) {
    if (tag !== 'canvas') throw new Error(`Unexpected DOM dependency ${tag}`);
    const noop = () => undefined;
    const context = new Proxy({
      createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      measureText: (text: string) => ({ width: text.length * 24 }),
      createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }),
    } as Record<string, unknown>, { get: (target, key: string) => key in target ? target[key] : noop });
    return { width: 1, height: 1, getContext: () => context };
  } };
}
const glbMeta = async (file: string, root: string | null) => {
  const b = readFileSync(new URL(`../../public/models/${file}`, import.meta.url));
  const asset = await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
  let meta: any; asset.scene.traverse((o: THREE.Object3D) => { if (o.userData.ifx && (!root || o.name === root)) meta = JSON.parse(o.userData.ifx); });
  return { asset, meta };
};
// '800G' → 800, '1.6T' → 1600, '6.4 Tb/s' → 6400, '200G' → 200 (Gb/s)
const gbps = (s: string) => { const m = s.match(/([\d.]+)\s*(T|G)/)!; return +m[1] * (m[2] === 'T' ? 1000 : 1); };
let data: any, engine: any, cpo: any, module: any, coherent: any;
const contentFor = (accel: string) => data.content(engine.compute({ meterMW: 300, accel, power: 'dc800', cooling: 'liquid' }));
const card = (c: any, layer: string, scene: string, id: string) => c[layer][scene].find((p: any) => p.id === id);
const row = (cardObj: any, label: RegExp) => cardObj.specs.find((r: any) => label.test(r[0]));
beforeAll(async () => {
  vi.stubGlobal('document', canvasDocument());
  data = await import('../data.js'); engine = await import('../model/engine');
  cpo = await glbMeta('cpo-hardware.glb', null);
  module = await glbMeta('osfp-module-runtime.glb', 'IFX_OSFP');
  coherent = await import('./side-coherent.js');
});

describe('lane math: drawn lanes × lane rate = stated rate', () => {
  it('pluggable modules: 8 drawn lanes each way × the tier’s lane rate = the module rate; two DR4 ports of four lanes', () => {
    const routes = module.meta.routes as { name: string }[];
    const tx = routes.filter(r => /^TX glass fiber \d+$/.test(r.name)).length, rx = routes.filter(r => /^RX glass fiber \d+$/.test(r.name)).length;
    const mods = routes.filter(r => /^TX \d+ MZM arm -1$/.test(r.name)).length;
    expect(tx).toBe(8); expect(rx).toBe(8); expect(mods).toBe(8);
    const tiers = new Set<string>();
    for (const accel of Object.keys(ACCELERATORS)) {
      const t = moduleTier(accel); tiers.add(t.key);
      expect(tx * t.laneGbps, `${accel}: ${tx} × ${t.lane} = ${t.rate}`).toBe(gbps(t.rate));
      expect(4 * t.laneGbps, `${accel}: DR4 port`).toBe(gbps(t.port));
      expect(2 * gbps(t.port), `${accel}: twin-port`).toBe(gbps(t.rate));
      // the module card's optical-lane row, where the part is published, says the same
      const optical = Object.values(contentFor(accel)).flatMap((layer: any) => layer?.module ?? []).flatMap((p: any) => p.specs ?? []).find((r: any) => /^Optical lanes/.test(r[0]));
      if (t.published) {
        const m = optical[1].match(/(\d+) × (\d+)G PAM4 each way, 2 × DR4/);
        expect(m, `${accel}: ${optical[1]}`).toBeTruthy();
        expect(+m[1]).toBe(tx); expect(+m[2]).toBe(t.laneGbps);
      }
    }
    expect([...tiers].sort()).toEqual(expect.arrayContaining(['1.6t', '800g']));
  });

  it('NVIDIA-style CPO: 8 rings × 200G = 1.6T per engine, 8 TX + 8 RX fibers; 18 engines × 1.6T = 28.8T', () => {
    const c = contentFor('gb300'), lanes = cpoBlocks('ring').drivers.length;
    expect(lanes).toBe(8); expect(cpoBlocks('ring').tias).toHaveLength(8); expect(cpo.meta.detailRingCount).toBe(lanes);
    const routes = cpoFiberRoutes(engineLayout()[0], 0);
    expect(routes.tx).toHaveLength(lanes); expect(routes.rx).toHaveLength(lanes);
    const per = row(card(c, 'PARTS', 'cpo', 'engine'), /^Per engine/)[1];          // '1.6 Tb/s each way, 8 × 200G'
    const [, n, g] = per.match(/(\d+) × (\d+)G/);
    expect(+n).toBe(lanes); expect(+n * +g).toBe(gbps(per));
    const engines = engineLayout().length; expect(engines).toBe(cpo.meta.engineCount);
    const chip = row(card(c, 'PARTS_DATA', 'cpo', 'asic'), /^Per switch chip/)[1];  // '28.8 Tb/s each way'
    expect(engines * gbps(per)).toBeCloseTo(gbps(chip), 6);
    const math = row(card(c, 'PARTS', 'cpo', 'engine'), /^Engine and package rate/)[1];
    expect(math).toMatch(new RegExp(`${lanes} lanes × 200 Gb/s`)); expect(math).toMatch(/18 engines × 1\.6 Tb\/s = 28\.8 Tb\/s/);
  });

  it('Broadcom-style CPO: 16 FR4 groups × 4 lanes = 64 lanes × 100G = 6.4T per engine, 16 TX + 16 RX fibers; 8 engines × 6.4T = 51.2T', () => {
    const c = contentFor('gb300'), M = CPO_MZM;
    // drawn: every lane's modulator and driver, every photodiode and TIA, in groups of four on one fiber each way
    expect(cpoBlocks('mzm').drivers).toHaveLength(M.lanes); expect(cpoBlocks('mzm').tias).toHaveLength(M.lanes);
    expect(M.groups * M.perGroup).toBe(M.lanes); expect(M.perGroup).toBe(4);   // FR4: four wavelengths per fiber
    const detail = cpo.asset.scene.getObjectByName('CPO_MZM_DETAIL');
    const electrodes = (detail.children as THREE.Mesh[]).find(m => (m.material as THREE.Material).name === 'Mach-Zehnder electrode')!;
    expect(electrodes.geometry.attributes.position.count / 24 / 3, 'modulators in the detail').toBe(M.lanes);
    for (const [i, t] of baillyLayout().entries()) { const r = baillyFiberRoutes(t, i); expect(r.tx).toHaveLength(M.groups); expect(r.rx).toHaveLength(M.groups); }
    // stated: 64 × 106.25 Gb/s line (reported), 400G FR4 ports, 6.4 Tb/s engines, eight per 51.2 Tb/s package
    const lanesRow = row(card(c, 'PARTS', 'cpo', 'mzm-engine'), /lanes$/)[1];          // '64 × 106.25 Gb/s PAM4, 6.4 Tb/s, …'
    const [, n, line] = lanesRow.match(/(\d+) × ([\d.]+) Gb\/s/);
    expect(+n).toBe(M.lanes);
    const engineRate = 6400, laneRate = 100, port = 400;
    expect(lanesRow).toMatch(/6\.4 Tb\/s/);
    expect(M.lanes * laneRate).toBe(engineRate); expect(M.groups * port).toBe(engineRate); expect(M.perGroup * laneRate).toBe(port);
    expect(+line).toBeGreaterThan(laneRate); expect(+line / laneRate).toBeLessThan(1.1);   // the line rate carries the 100G payload
    const tiles = baillyLayout().length; expect(tiles).toBe(cpo.meta.baillyTiles); expect(tiles).toBe(BAILLY.n);
    const pkg = row(card(c, 'PARTS', 'cpo', 'mzm-asic'), /^Package, Broadcom/)[1];   // '… eight 6.4 Tb/s optical engines: 51.2 Tb/s'
    expect(pkg).toMatch(/eight 6\.4 Tb\/s/); expect(tiles * engineRate).toBe(gbps(pkg.split(':').at(-1)!));
    const math = row(card(c, 'PARTS', 'cpo', 'mzm-engine'), /^Engine and package rate/)[1];
    expect(math).toMatch(/16 × 400G FR4 ports = 64 lanes × 100 Gb\/s/); expect(math).toMatch(/8 engines × 6\.4 Tb\/s = 51\.2 Tb\/s/);
    // nothing on the Broadcom-style cards or captions frames a subset of the lanes as the engine
    const texts = ['PARTS', 'PARTS_DATA', 'PARTS_HEAT'].flatMap(l => c[l].cpo.filter((p: any) => p.id.startsWith('mzm-'))).map((p: any) => p.body).join(' ');
    expect(texts).not.toMatch(/\b8 of (the )?64\b|[Ee]ight of the 64/);
  });

  it('coherent 800ZR: one wavelength each way; 2 polarizations × 4 bits (16QAM) × ≈118 GBd carries the 800G', () => {
    const { scene } = coherent.build({ quality: { shadows: false }, state: { mode: 'data' } });
    const r = scene.userData.coherentRouting;
    expect(r.txFiber.length).toBeGreaterThan(1); expect(r.rxFiber.length).toBeGreaterThan(1);   // one transmit fiber, one receive fiber
    const c = contentFor('gb300'), specs = Object.values(c).flatMap((layer: any) => layer?.coherent ?? []).flatMap((p: any) => p.specs ?? []);
    const mod = specs.find((x: any) => x[0] === 'Modulation')[1];                       // 'DP-16QAM at ≈118 GBd'
    const gbd = +mod.match(/([\d.]+) GBd/)[1], bitsPerSymbol = 2 * Math.log2(16);
    expect(mod).toMatch(/DP-16QAM/);
    const line = gbd * bitsPerSymbol;                                                  // ≈ 944 Gb/s on the line
    expect(line).toBeGreaterThan(800); expect(line / 800).toBeLessThan(1.25);         // the payload plus coding overhead
  });
});
