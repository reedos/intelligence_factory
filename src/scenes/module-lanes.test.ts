// Every stage of the pluggable module draws one cell per lane (Reed, 10/03/2026): the level showed four
// modulators next to eight TIAs. This counts the DRAWN geometry in the built module asset, not the route
// metadata: connected pieces of each stage's mesh. 800G (8 x 100G, 2 x 400G DR4) and 1.6T (8 x 200G,
// 2 x 800G DR4) both carry eight lanes each way, four per DR4 engine; the four lasers are shared, each
// feeding two modulators. Rate: lanes x lane rate = module rate on the electrical and on the optical side.
import { beforeAll, describe, it, expect, vi } from 'vitest';
// @ts-expect-error Vitest supplies Node built-ins; app tsconfig intentionally excludes Node types.
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
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

type Piece = { n: number; z: number };
/** The separate solid pieces of a mesh: triangles joined through shared (welded) vertices. */
export function pieces(mesh: THREE.Mesh): Piece[] {
  const g = mesh.geometry, pos = g.attributes.position, idx = g.index;
  const parent: number[] = [...Array(pos.count).keys()];
  const find = (a: number): number => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  const weld = new Map<string, number>();
  for (let i = 0; i < pos.count; i++) {
    const k = `${Math.round(pos.getX(i) * 1e7)},${Math.round(pos.getY(i) * 1e7)},${Math.round(pos.getZ(i) * 1e7)}`;
    const first = weld.get(k);
    if (first === undefined) weld.set(k, i); else parent[find(i)] = find(first);
  }
  const tri = idx ? idx.count / 3 : pos.count / 3;
  for (let t = 0; t < tri; t++) {
    const a = idx ? idx.getX(3 * t) : 3 * t, b = idx ? idx.getX(3 * t + 1) : 3 * t + 1, c = idx ? idx.getX(3 * t + 2) : 3 * t + 2;
    parent[find(b)] = find(a); parent[find(c)] = find(a);
  }
  const groups = new Map<number, { n: number; z: number }>();
  for (let i = 0; i < pos.count; i++) {
    const r = find(i), e = groups.get(r) ?? { n: 0, z: 0 };
    e.n++; e.z += pos.getZ(i); groups.set(r, e);
  }
  return [...groups.values()].map(e => ({ n: e.n, z: e.z / e.n }));
}

export const STAGES = {
  // [mesh name, expected pieces]: eight per direction, or the stated count
  txDriverCells: ['DRIVER channel cells', 8],
  rxTiaCells: ['TIA channel cells', 8],
  txModulators: ['MZM modulator bodies', 8],
  txDriverPadsElectrodes: ['PART_PIC transmit electrodes', 24],   // 8 driver pads + 16 electrodes (two per modulator)
  txDriverPads: ['DRIVER channel pads', 8],
  rxTiaPads: ['TIA channel pads', 8],
  rxPhotodiodePads: ['PART_PIC__05', 8],
  rxPhotodiodePackages: ['PART_PIC__07', 8],
  cwLasers: ['PART_LASERS__07', 4],                                // shared: each laser feeds two modulators
} as const;

let asset: any, meta: any, data: any, engine: any;
// three.js turns spaces in node names into underscores: compare names the way side-module-blender.js keys them
const norm = (n: string) => n.replace(/[\s_]+/g, ' ').trim().toLowerCase();
const meshNamed = (name: string): THREE.Mesh | undefined => { let m: THREE.Mesh | undefined; asset.scene.traverse((o: any) => { if (o.isMesh && norm(o.name) === norm(name)) m = o; }); return m; };
const counts: Record<string, number> = {};
const lanes = (tx: boolean) => (meta.routes as { name: string }[]).filter(r => (tx ? /^TX / : /^RX /).test(r.name));
const gbps = (s: string) => { const m = s.match(/([\d.]+)\s*(T|G)/)!; return +m[1] * (m[2] === 'T' ? 1000 : 1); };
const contentFor = (accel: string) => data.content(engine.compute({ meterMW: 300, accel, power: 'dc800', cooling: 'liquid' }));

beforeAll(async () => {
  vi.stubGlobal('document', canvasDocument());
  data = await import('../data.js'); engine = await import('../model/engine');
  const b = readFileSync(new URL('../../public/models/osfp-module-runtime.glb', import.meta.url));
  asset = await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
  asset.scene.traverse((o: THREE.Object3D) => { if (o.userData.ifx) meta = JSON.parse(o.userData.ifx); });
  for (const [stage, [name]] of Object.entries(STAGES)) {
    const mesh = meshNamed(name);
    counts[stage] = mesh ? pieces(mesh).length : 0;
  }
});

describe('module lanes: every stage draws one cell per lane', () => {
  it('counts the drawn pieces of each stage: 8 per direction, 4 shared lasers', () => {
    for (const [stage, [name, expected]] of Object.entries(STAGES)) expect(counts[stage], `${stage} (${name})`).toBe(expected);
  });

  it('counts the lane-pitched pieces (z) so no two cells share a lane', () => {
    // eight distinct lane rows for the driver cells, modulator bodies and TIA cells
    const rows = (name: string) => {
      return new Set(pieces(meshNamed(name)!).map(p => Math.round(p.z * 1e5))).size;
    };
    expect(rows('DRIVER channel cells')).toBe(8); expect(rows('TIA channel cells')).toBe(8); expect(rows('MZM modulator bodies')).toBe(8);
  });

  it('the routes carry 8 + 8 lanes: host pairs, DSP engine pairs, drivers, MZM arms, RF feeds, TIAs, waveguides and fibers', () => {
    const count = (re: RegExp) => (meta.routes as { name: string }[]).filter(r => re.test(r.name)).length;
    expect(count(/^TX host copper \d+ -1$/)).toBe(8); expect(count(/^TX host copper \d+ 1$/)).toBe(8);          // 8 differential pairs, both members
    expect(count(/^RX host copper \d+ -1$/)).toBe(8); expect(count(/^RX host copper \d+ 1$/)).toBe(8);
    expect(count(/^TX engine copper \d+ -?1$/)).toBe(16); expect(count(/^RX engine copper \d+ -?1$/)).toBe(16);   // DSP lanes, 8 pairs each way
    expect(count(/^Driver bond \d+$/)).toBe(8); expect(count(/^TX RF feed \d+$/)).toBe(8);
    expect(count(/^TX \d+ MZM arm -1$/)).toBe(8); expect(count(/^TX \d+ MZM arm 1$/)).toBe(8);
    expect(count(/^TIA bond \d+$/)).toBe(8); expect(count(/^RX \d+ waveguide$/)).toBe(8);
    expect(count(/^TX glass fiber \d+$/)).toBe(8); expect(count(/^RX glass fiber \d+$/)).toBe(8);
    expect(count(/^CW feed \d+ \d$/)).toBe(8);                                                                   // 4 lasers x 2 modulators
    expect(lanes(true).filter(r => (r as any).engine === 1 && /glass fiber/.test(r.name))).toHaveLength(4);       // 4 lanes per DR4 engine
    expect(lanes(false).filter(r => (r as any).engine === 2 && /glass fiber/.test(r.name))).toHaveLength(4);
  });

  it('draws the lit MPO fiber positions: 4 transmit + 4 receive on each of the two connectors', () => {
    // one merged mesh per fiber class on the receptacle group: 'TX optical paths' (13) and 'RX optical paths' (14)
    const faces = (key: string) => { let n = 0; asset.scene.traverse((o: any) => { if (o.isMesh && norm(o.name).startsWith(`part mpo ${key} `)) n += pieces(o).length; }); return n; };
    expect(faces('13')).toBe(8); expect(faces('14')).toBe(8);
  });

  it('a stage that loses one cell fails the count', () => {
    const lose = (k: keyof typeof STAGES) => counts[k] - 1;
    for (const stage of Object.keys(STAGES) as (keyof typeof STAGES)[]) expect(lose(stage)).not.toBe(STAGES[stage][1]);
  });

  it('tier-aware: lanes x lane rate = module rate on the electrical and the optical side, and the line rate follows', () => {
    const n = lanes(true).filter(r => /glass fiber/.test(r.name)).length;
    expect(n).toBe(8);
    const tiers = new Set<string>();
    for (const accel of Object.keys(ACCELERATORS)) {
      const t = moduleTier(accel); tiers.add(t.key);
      const rows = Object.values(contentFor(accel)).flatMap((layer: any) => layer?.module ?? []).flatMap((p: any) => p.specs ?? []);
      const rowOf = (re: RegExp) => rows.find((r: any) => re.test(r[0]));
      const host = rowOf(/^Host lanes/)[1].match(/^(\d+) × (\d+)G/);
      expect(+host[1] * +host[2], `${accel} electrical`).toBe(gbps(t.rate)); expect(+host[1]).toBe(n);
      if (t.published) {
        const opt = rowOf(/^Optical lanes/)[1].match(/^(\d+) × (\d+)G PAM4/);
        expect(+opt[1] * +opt[2], `${accel} optical`).toBe(gbps(t.rate)); expect(+opt[1]).toBe(n);
      }
      const line = rowOf(/^Line rate per lane/)[1].match(/([\d.]+) GBd, ([\d.]+) Gb\/s/);
      expect(+line[1] * 2, `${accel} line rate = baud x 2 bits`).toBe(+line[2]);
      expect(+line[2] / t.laneGbps, `${accel} line / payload`).toBeCloseTo(1.0625, 6);
      // the driver, TIA, modulator cards say eight, the lane rate matches the tier
      const dataCards = Object.values(contentFor(accel)).flatMap((layer: any) => layer?.module ?? []);
      for (const id of ['driver', 'tia', 'mzm']) {
        const card = dataCards.find((p: any) => p.id === id && (p.specs ?? []).some((r: any) => /as drawn$/.test(r[0]) && /8 each way/.test(r[1])));
        expect(card, `${accel}: ${id} card says 8 each way`).toBeTruthy();
      }
    }
    expect([...tiers].sort()).toEqual(expect.arrayContaining(['1.6t', '800g']));
  });
});

// The NIC side (Reed, 10/03/2026): GB200's single-port 400G DR4 and GB300's single-port 800G DR4 are ONE DR4 engine of
// the same asset (scenes/module-engine.js): the second engine's cells, modulators, photodiodes, lasers, pads, fibers and
// connector are gone, so every stage counts four per direction (two lasers) where the switch side counts eight (four).
describe('module lanes, NIC side: one DR4 engine, four per direction', () => {
  let nic: any;
  const nicCounts: Record<string, number> = {};
  beforeAll(async () => {
    const b = readFileSync(new URL('../../public/models/osfp-module-runtime.glb', import.meta.url));
    nic = await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
    const { keepEngine } = await import('./module-engine.js');
    keepEngine(nic.scene, meta, 1);
    const find = (name: string) => { let m: THREE.Mesh | undefined; nic.scene.traverse((o: any) => { if (o.isMesh && norm(o.name) === norm(name)) m = o; }); return m; };
    for (const [stage, [name]] of Object.entries(STAGES)) { const m = find(name); nicCounts[stage] = m && m.visible ? pieces(m).length : 0; }
  });
  it('counts 4 per direction in every lane stage, 2 shared lasers, and one connector face of each class', () => {
    for (const [stage, [name, expected]] of Object.entries(STAGES)) expect(nicCounts[stage], `${stage} (${name})`).toBe(expected / 2);
    let faces = 0, receptacles = 0;
    nic.scene.traverse((o: any) => { if (o.isMesh && o.visible && /^part mpo 13 /.test(norm(o.name))) faces += pieces(o).length; if (o.visible && /^mpo receptacle \d$/.test(norm(o.name))) receptacles++; });
    expect(faces).toBe(4); expect(receptacles).toBe(1);
  });
  it('keeps only engine 1 in the pieces of the lane meshes: four distinct lane rows each', () => {
    const rows = (name: string) => { let m: any; nic.scene.traverse((o: any) => { if (o.isMesh && norm(o.name) === norm(name)) m = o; }); return new Set(pieces(m).map(p => Math.round(p.z * 1e5))).size; };
    expect(rows('DRIVER channel cells')).toBe(4); expect(rows('TIA channel cells')).toBe(4); expect(rows('MZM modulator bodies')).toBe(4);
  });
  it('lanes x lane rate = module rate on both sides of the link, per tier; the card says 4 or 8 each way', () => {
    const n = lanes(true).filter(r => /glass fiber/.test(r.name) && (r as any).engine === 1).length;
    expect(n).toBe(4);
    for (const accel of Object.keys(ACCELERATORS)) for (const side of ['switch', 'nic']) {
      const t = moduleTier(accel, side), C = data.content(engine.compute({ meterMW: 300, accel, power: 'dc800', cooling: 'liquid' }), { moduleSide: side });
      const rows = Object.values(C).flatMap((layer: any) => layer?.module ?? []).flatMap((p: any) => p.specs ?? []);
      const host = rows.find((r: any) => /^Host lanes/.test(r[0]))[1].match(/^(\d+) × (\d+)G/);
      expect(+host[1], `${accel} ${side} lanes`).toBe(t.lanes);
      expect(+host[1] * +host[2], `${accel} ${side} electrical`).toBe(gbps(t.rate));
      expect(t.lanes * t.laneGbps, `${accel} ${side} lanes x rate`).toBe(gbps(t.rate));
      expect(t.ports * (t.lanes / t.ports) * t.laneGbps, `${accel} ${side} ports`).toBe(gbps(t.rate));
      expect(gbps(t.port) * t.ports, `${accel} ${side} port rate`).toBe(gbps(t.rate));
      const optical = rows.find((r: any) => /^Optical lanes/.test(r[0]));
      if (t.published) {
        const m = optical[1].match(/^(\d+) × (\d+)G PAM4/);
        expect(+m[1] * +m[2], `${accel} ${side} optical`).toBe(gbps(t.rate)); expect(+m[1]).toBe(t.lanes);
      }
    }
    expect(moduleTier('gb200', 'nic')).toMatchObject({ lanes: 4, ports: 1, rate: '400G', port: '400G', lane: '100G' });
    expect(moduleTier('gb300', 'nic')).toMatchObject({ lanes: 4, ports: 1, rate: '800G', port: '800G', lane: '200G' });
    expect(moduleTier('h100', 'nic').lanes).toBe(8); expect(moduleTier('gb200', 'switch').lanes).toBe(8);
  });
});
