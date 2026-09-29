import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
// @ts-expect-error The browser app deliberately excludes Node types; Vitest provides this built-in at runtime.
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { ACCELERATORS, compute, DEFAULT_SCENARIO } from '../model/engine';
import { content } from '../data.js';
import { heat, layer, light, request, story, watt } from '../app/journeys.js';

// The browser checks own rendering and performance. Here the real GLB parser, geometry, scene graph,
// flow paths and scene builder run in Node. Only canvas rasterization and the URL fetch are replaced.
function canvasDocument() {
  return {
    createElement(tag: string) {
      if (tag !== 'canvas') throw new Error(`Unexpected DOM dependency: ${tag}`);
      const noop = () => undefined;
      const context = new Proxy({
        createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
        measureText: (text: string) => ({ width: text.length * 24 }),
        createLinearGradient: () => ({ addColorStop: noop }),
        createRadialGradient: () => ({ addColorStop: noop }),
      } as Record<string, unknown>, {
        get(target, key: string) { return key in target ? target[key] : noop; },
      });
      return { width: 1, height: 1, getContext: () => context };
    },
  };
}

type Mode = 'power' | 'data' | 'heat';
type Point = [number, number, number];
type AssetMetadata = {
  version: number;
  units: string;
  coordinates: string;
  routes: { name: string; assembly: string; points: Point[] }[];
  anchors: Record<string, { assembly: string; position: Point }>;
  contacts: { name: string; pins: number[]; signal: string; matingSequence: number; position: Point }[];
};
type SceneModule = typeof import('./side-module-blender.js');
type Built = ReturnType<SceneModule['build']>;

let module: SceneModule;
let asset: GLTF;
let metadata: AssetMetadata;
let load: ReturnType<typeof vi.spyOn>;
let initialLoads = 0;
const builds: Built[] = [];
const expectedPins: Record<Mode, string[]> = {
  power: ['fingers', 'dcdc', 'dsp', 'lasers'],
  data: ['fingers', 'dsp', 'driver', 'lasers', 'mzm', 'mpo', 'pd', 'tia'],
  heat: ['dsp', 'shell'],
};
const maps = { power: 'hotspots', data: 'dataHotspots', heat: 'heatHotspots' } as const;
const arrays = { power: 'flows', data: 'dataFlows', heat: 'heatFlows' } as const;

function build(mode: Mode = 'data') {
  const state = { mode };
  const result = module.build({ quality: { shadows: false }, state });
  builds.push(result);
  result.update(0);
  return { result, state };
}

function expectPoint(actual: number[], expected: number[], context: string) {
  expect(actual, context).toHaveLength(3);
  actual.forEach((value, axis) => {
    expect(Number.isFinite(value), `${context}, axis ${axis}`).toBe(true);
    expect(value, `${context}, axis ${axis}`).toBeCloseTo(expected[axis], 6);
  });
}

beforeAll(async () => {
  vi.stubGlobal('document', canvasDocument());
  const bytes = readFileSync(new URL('../../public/models/osfp-module-runtime.glb', import.meta.url));
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  asset = await new GLTFLoader().parseAsync(buffer, '');
  const root = asset.scene.getObjectByName('IFX_OSFP');
  expect(root, 'GLB has the named runtime root').toBeDefined();
  metadata = JSON.parse(root!.userData.ifx);
  load = vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValue(asset);
  module = await import('./side-module-blender.js');
  await module.preload();
  initialLoads = load.mock.calls.length;
});

afterAll(() => {
  load?.mockRestore();
  vi.unstubAllGlobals();
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  for (const { scene } of builds) scene.traverse((object: THREE.Object3D) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
  });
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => material.dispose());
});

describe('Blender optical module integration', () => {
  it('loads the real texture-free asset once and can build independent scene instances', async () => {
    const loadsBefore = load.mock.calls.length;
    await Promise.all([module.preload(), module.preload()]);
    expect(initialLoads).toBe(1);
    expect(load.mock.calls.length).toBe(loadsBefore);
    expect(asset.animations).toHaveLength(0);
    expect(metadata).toMatchObject({ version: 1, units: 'm', coordinates: 'gltf-root-rest' });
    const a = build().result, b = build().result;
    expect(a.scene).not.toBe(b.scene);
    expect(a.scene.getObjectByName('IFX_OSFP')).not.toBe(b.scene.getObjectByName('IFX_OSFP'));
    // Changing a scenario disposes its built scene. That must not invalidate the cached asset or another build.
    asset.scene.traverse(source => {
      if (!(source instanceof THREE.Mesh)) return;
      const meshA = a.scene.getObjectByName(source.name) as THREE.Mesh;
      const meshB = b.scene.getObjectByName(source.name) as THREE.Mesh;
      expect(meshA.geometry === source.geometry, `${source.name}: cached geometry is isolated`).toBe(false);
      expect(meshA.geometry === meshB.geometry, `${source.name}: scene geometry is isolated`).toBe(false);
      const materials = (mesh: THREE.Mesh) => Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials(meshA).forEach((material, i) => {
        expect(material === materials(source)[i], `${source.name}: cached material is isolated`).toBe(false);
        expect(material === materials(meshB)[i], `${source.name}: scene material is isolated`).toBe(false);
      });
    });
    a.variant.setLpo(true);
    a.update(1);
    expect(a.variant.lpo).toBe(true);
    expect(b.variant.lpo).toBe(false);
  });

  it('keeps every existing module card and tour target reachable, with usable camera coordinates', () => {
    const { result } = build();
    for (const mode of ['power', 'data', 'heat'] as const) {
      const hotspots = result[maps[mode]];
      for (const id of expectedPins[mode]) expect(hotspots, `${mode}:${id}`).toHaveProperty(id);
      for (const [id, hotspot] of Object.entries(hotspots) as [string, any][]) {
        for (const point of [hotspot.pos, hotspot.view.pos, hotspot.view.target]) {
          expect(point, `${mode}:${id}`).toHaveLength(3);
          expect(point.every(Number.isFinite), `${mode}:${id}`).toBe(true);
        }
        expect(new THREE.Vector3(...hotspot.view.pos).distanceTo(new THREE.Vector3(...hotspot.view.target)), `${mode}:${id}`).toBeGreaterThan(0.1);
      }
    }
    for (const accel of Object.keys(ACCELERATORS) as (keyof typeof ACCELERATORS)[]) {
      const model = compute({ ...DEFAULT_SCENARIO, accel }), cards = content(model);
      const moduleLevel = cards.SCENES.findIndex(scene => scene.id === 'module');
      for (const [mode, key] of [['power', 'PARTS'], ['data', 'PARTS_DATA'], ['heat', 'PARTS_HEAT']] as const) {
        for (const card of (cards[key] as Record<string, { id: string }[]>).module) expect(result[maps[mode]], `${accel} card ${mode}:${card.id}`).toHaveProperty(card.id);
      }
      const beats = [story, watt, request, heat, light].flatMap(tour => tour(model));
      for (const mode of ['power', 'data', 'heat'] as const) beats.push(...layer(model, mode), ...layer(model, mode, moduleLevel));
      for (const beat of beats) if (beat.link.scene === moduleLevel && beat.link.part) {
        expect(result[maps[beat.link.mode as Mode]], `${accel} tour ${beat.title}`).toHaveProperty(beat.link.part);
      }
    }
  });

  it('exposes each flow in exactly one layer and switches layers without leaving stale pulses', () => {
    const { result, state } = build();
    const all = [...result.flows, ...result.dataFlows, ...result.heatFlows];
    expect(new Set(all).size).toBe(all.length);
    for (const mode of ['data', 'power', 'heat', 'data'] as const) {
      state.mode = mode;
      result.update(2);
      for (const layer of ['power', 'data', 'heat'] as const) {
        expect(result[arrays[layer]].length, `${layer} is populated`).toBeGreaterThan(0);
        for (const flow of result[arrays[layer]]) {
          expect(flow.route.mode).toBe(layer);
          expect(flow.group.visible, `${mode}: ${flow.route.id}`).toBe(layer === mode && flow.route.variant !== 'lpo');
        }
      }
    }
  });

  it('places hotspots on their exported anchors after metre conversion and exploded assembly offsets', () => {
    const { result } = build();
    result.scene.updateMatrixWorld(true);
    const hotspots = { ...result.hotspots, ...result.dataHotspots, ...result.heatHotspots };
    for (const [id, anchor] of Object.entries(metadata.anchors)) {
      const assembly = result.scene.getObjectByName(anchor.assembly);
      expect(assembly, id).toBeDefined();
      const expected = assembly!.localToWorld(new THREE.Vector3(...anchor.position)).toArray();
      expectPoint((hotspots as Record<string, any>)[id].pos, expected, id);
    }
  });

  it('keeps animated data paths on the exported conductors in world space, including reversed receive paths', () => {
    const { result } = build();
    result.scene.updateMatrixWorld(true);
    const exported = new Map(metadata.routes.map(route => [route.name, route]));
    const sourced = result.dataFlows.filter(flow => flow.route.source);
    expect(sourced.length).toBeGreaterThan(20);
    for (const flow of sourced) {
      const route = exported.get(flow.route.source)!;
      expect(route, flow.route.id).toBeDefined();
      const points = flow.route.direction === 'reverse' ? [...route.points].reverse() : route.points;
      expect(flow.path.curves, flow.route.id).toHaveLength(points.length - 1);
      const assembly = result.scene.getObjectByName(route.assembly)!;
      for (let i = 0; i < points.length - 1; i++) {
        const curve = flow.path.curves[i];
        for (const [u, point] of [[0, points[i]], [1, points[i + 1]]] as const) {
          const actual = flow.group.localToWorld(curve.getPoint(u)).toArray();
          const expected = assembly.localToWorld(new THREE.Vector3(...point)).toArray();
          expectPoint(actual, expected, `${flow.route.id} segment ${i}/${u}`);
        }
      }
      const start = flow.path.getPoint(0), end = flow.path.getPoint(1);
      // Host is left of the optical engine: transmit advances +X; receive returns -X.
      if (flow.route.kind !== 'cw') expect(Math.sign(end.x - start.x), flow.route.id).toBe(flow.route.id.startsWith('RX') ? -1 : 1);
    }
  });

  it('has eight independent TX fibers, eight RX fibers, and CW feeds ending at each TX modulator', () => {
    const routes = new Map(metadata.routes.map(route => [route.name, route]));
    const tx = metadata.routes.filter(route => /^TX glass fiber \d+$/.test(route.name));
    const rx = metadata.routes.filter(route => /^RX glass fiber \d+$/.test(route.name));
    expect(tx).toHaveLength(8);
    expect(rx).toHaveLength(8);
    const ports = [...tx, ...rx].map(route => route.points.at(-1)!);
    expect(new Set(ports.map(point => point.join(','))).size, 'sixteen separate connector endpoints').toBe(16);
    for (let lane = 0; lane < 8; lane++) {
      const number = String(lane + 1).padStart(2, '0');
      const feed = routes.get(`CW feed ${Math.floor(lane / 2)} ${lane % 2}`)!;
      const mzm = routes.get(`TX ${number} MZM arm -1`)!;
      expectPoint(feed.points.at(-1)!, mzm.points[0], `CW to TX ${number}`);
    }
    const { result } = build();
    for (const flow of result.dataFlows.filter(flow => flow.route.kind === 'cw')) {
      expect(flow.route.from).toBe('lasers');
      expect(flow.route.to).toBe('mzm');
      expect(flow.route.variant).toBe('common');
    }
  });

  it('switches DSP/LPO reversibly without losing the analog front end or leaving DSP flows visible', () => {
    const { result, state } = build();
    const originalPins = (Object.keys(maps) as Mode[]).map(mode => Object.keys(result[maps[mode]]));
    const visible = (name: string) => {
      let object = result.scene.getObjectByName(name);
      expect(object, name).toBeDefined();
      for (; object; object = object.parent || undefined) if (!object.visible) return false;
      return true;
    };
    for (const lpo of [true, false, true, false]) {
      result.variant.setLpo(lpo);
      expect(result.variant.lpo).toBe(lpo);
      for (const name of ['PART_DSP', 'PART_DSP_TRACES', '03_THERMAL']) expect(visible(name), name).toBe(!lpo);
      expect(visible('LPO bypass copper')).toBe(lpo);
      for (const name of ['PART_DRIVER', 'PART_TIA', 'PART_LASERS', 'PART_PIC', 'PART_MPO']) expect(visible(name), name).toBe(true);
      for (const mode of ['power', 'data', 'heat'] as const) {
        state.mode = mode;
        result.update(3);
        const shown = result[arrays[mode]].filter(flow => flow.group.visible);
        expect(shown.length, `${mode}/${lpo}`).toBeGreaterThan(0);
        for (const flow of result[arrays[mode]]) {
          expect(flow.group.visible, `${mode}/${lpo}: ${flow.route.id}`).toBe(flow.route.variant !== (lpo ? 'dsp' : 'lpo'));
        }
        if (lpo) for (const flow of shown) expect([flow.route.from, flow.route.to], flow.route.id).not.toContain('dsp');
        if (mode === 'data') {
          const edges = new Set(shown.map(flow => `${flow.route.from}>${flow.route.to}`));
          const expected = ['driver>mzm', 'lasers>mzm', 'mzm>mpo', 'mpo>pd', 'pd>tia',
            ...(lpo ? ['fingers>driver', 'tia>fingers'] : ['fingers>dsp', 'dsp>driver', 'tia>dsp', 'dsp>fingers'])];
          expect([...edges].sort(), `functional data chain: LPO=${lpo}`).toEqual(expected.sort());
        }
        if (mode === 'power') for (const target of ['driver', 'tia', 'lasers']) {
          expect(shown.some(flow => flow.route.from === 'dcdc' && flow.route.to === target), `LPO=${lpo}: ${target} remains powered`).toBe(true);
        }
        if (mode === 'heat') for (const source of ['driver', 'tia', 'lasers']) {
          expect(shown.some(flow => flow.route.from === source), `LPO=${lpo}: ${source} still dissipates heat`).toBe(true);
        }
      }
      expect((Object.keys(maps) as Mode[]).map(mode => Object.keys(result[maps[mode]]))).toEqual(originalPins);
    }
  });

  it('connects each LPO bypass to the same host and analog front-end terminals as the exported DSP routes', () => {
    const { result } = build();
    const routes = new Map(metadata.routes.map(route => [route.name, route]));
    const bypasses = result.dataFlows.filter(flow => flow.route.variant === 'lpo');
    expect(bypasses.filter(flow => flow.route.from === 'fingers')).toHaveLength(4);
    expect(bypasses.filter(flow => flow.route.to === 'fingers')).toHaveLength(4);
    for (const flow of bypasses) {
      const [, direction, lane] = /^(TX|RX)-(\d+)-/.exec(flow.route.id)!;
      const host = routes.get(`${direction} host copper ${lane} -1`)!.points[0];
      const analog = routes.get(`${direction} engine copper ${lane} -1`)!.points.at(-1)!;
      const [start, end] = direction === 'TX' ? [host, analog] : [analog, host];
      expectPoint(flow.path.getPoint(0).toArray(), start.map(value => value * 100), `${flow.route.id} start`);
      expectPoint(flow.path.getPoint(1).toArray(), end.map(value => value * 100), `${flow.route.id} end`);
    }
  });

  it('assembles the centimetre scene into the claimed OSFP envelope without scaling the internals', () => {
    const { result } = build();
    const root = result.scene.getObjectByName('IFX_OSFP')!;
    const pcb = result.scene.getObjectByName('02_BOARD')!;
    const before = new THREE.Box3().setFromObject(pcb).getSize(new THREE.Vector3());
    const raisedCover = result.scene.getObjectByName('04_COVER')!;
    expect(raisedCover.position.x).toBe(0);
    expect(raisedCover.position.z).toBe(0);
    expect(raisedCover.position.y).toBeGreaterThan(pcb.position.y);
    result.presentation.setExplode(0, { immediate: true });
    result.scene.updateMatrixWorld(true);
    expect(metadata.units).toBe('m');
    expect(result.scene.userData.blenderModule.units).toBe('cm');
    expectPoint(root.getWorldScale(new THREE.Vector3()).toArray(), [100, 100, 100], 'metres to centimetres');
    const envelope = new THREE.Box3();
    for (const name of ['01_BASE', '02_BOARD', '03_THERMAL', '04_COVER']) {
      const assembly = result.scene.getObjectByName(name)!;
      expectPoint(assembly.position.toArray(), [0, 0, 0], `${name}: assembled rest position`);
      envelope.union(new THREE.Box3().setFromObject(assembly));
    }
    // The release tab extends beyond the standardized module envelope and is deliberately excluded.
    const size = envelope.getSize(new THREE.Vector3());
    for (const [axis, expected] of [['x', 10.78], ['y', 1.3], ['z', 2.258]] as const) {
      expect.soft(size[axis], `assembled envelope ${axis}, cm`).toBeCloseTo(expected, 2);
    }
    const after = new THREE.Box3().setFromObject(pcb).getSize(new THREE.Vector3());
    expectPoint(after.toArray(), before.toArray(), 'PCB dimensions survive assembly');
    for (const point of [result.presentation.assembledCamera.pos, result.presentation.assembledCamera.target]) {
      expect(point.every(Number.isFinite)).toBe(true);
    }
  });

  it.each(['data', 'power', 'heat'] as const)('hides %s overlays and pins throughout assembly motion and while closed', mode => {
    const { result } = build(mode);
    const all = [...result.flows, ...result.dataFlows, ...result.heatFlows];
    const expectHidden = () => {
      expect(result.presentation.hidePins).toBe(true);
      expect(all.every(flow => !flow.group.visible), 'pulses must not appear over an opaque or moving assembly').toBe(true);
    };
    result.presentation.setExplode(0);
    for (let frame = 0; frame < 180; frame++) {
      result.update(frame / 120, 1 / 120);
      expectHidden();
    }
    expect(result.presentation.amount).toBe(0);
    result.update(3, 1);
    expectHidden();
    result.presentation.setExplode(1);
    for (let frame = 0; frame < 180; frame++) {
      result.update(4 + frame / 120, 1 / 120);
      if (result.presentation.amount < 1) expectHidden();
    }
    expect(result.presentation.amount).toBe(1);
    expect(result.presentation.hidePins).toBe(false);
    expect(result[arrays[mode]].some(flow => flow.group.visible)).toBe(true);
  });

  it('animates assembly continuously, clamps endpoints, and reverses direction without jumping or overshooting', () => {
    const { result } = build();
    const p = result.presentation;
    p.setExplode(-2);
    expect(p.explode).toBe(0);
    expect(p.amount, 'changing the target does not teleport the geometry').toBe(1);
    let last = p.amount;
    for (let frame = 0; frame < 30; frame++) {
      result.update(frame / 60, 1 / 60);
      expect(p.amount).toBeLessThanOrEqual(last);
      expect(p.amount).toBeGreaterThanOrEqual(0);
      last = p.amount;
    }
    expect(p.amount).toBeGreaterThan(0);
    expect(p.amount).toBeLessThan(1);
    p.setExplode(2);
    expect(p.explode).toBe(1);
    expect(p.amount, 'reversing an unfinished transition begins at its displayed position').toBe(last);
    for (let frame = 0; frame < 120; frame++) {
      result.update(1 + frame / 60, 1 / 60);
      expect(p.amount).toBeGreaterThanOrEqual(last);
      expect(p.amount).toBeLessThanOrEqual(1);
      last = p.amount;
    }
    expect(p.amount).toBe(1);
    p.setExplode(Number.NaN);
    expect(p.explode).toBe(1);
    p.setExplode(0);
    result.update(10, 10); // A background-tab frame must land on the endpoint, not overshoot it.
    expect(p.amount).toBe(0);
  });

  it('keeps board conductors registered through partial assembly and preserves the chosen LPO variant', () => {
    const { result } = build();
    result.variant.setLpo(true);
    const routes = new Map(metadata.routes.map(route => [route.name, route]));
    for (const amount of [0.72, 0.23, 0, 0.4, 1]) {
      result.presentation.setExplode(amount, { immediate: true });
      result.scene.updateMatrixWorld(true);
      expect(result.variant.lpo, `LPO at assembly ${amount}`).toBe(true);
      expect(result.scene.getObjectByName('PART_DSP')!.visible).toBe(false);
      expect(result.scene.getObjectByName('03_THERMAL')!.visible).toBe(false);
      for (const flow of result.dataFlows.filter(flow => flow.route.source)) {
        const source = routes.get(flow.route.source)!;
        const point = flow.route.direction === 'reverse' ? source.points.at(-1)! : source.points[0];
        const assembly = result.scene.getObjectByName(source.assembly)!;
        expectPoint(flow.group.localToWorld(flow.path.getPoint(0)).toArray(),
          assembly.localToWorld(new THREE.Vector3(...point)).toArray(), `${flow.route.id} at ${amount}`);
      }
    }
    const visible = result.dataFlows.filter(flow => flow.group.visible);
    expect(visible.some(flow => flow.route.variant === 'lpo')).toBe(true);
    expect(visible.some(flow => flow.route.variant === 'dsp')).toBe(false);
  });

  it('changes the studio finish without changing physical geometry, signal routes, or cached asset materials', () => {
    vi.stubGlobal('location', { search: '?module=blender' });
    const studio = build().result;
    vi.stubGlobal('location', { search: '?module=blender&finish=matched' });
    let matched: Built;
    try { matched = build().result; } finally { vi.stubGlobal('location', undefined); }
    expect(studio.look?.env).toBe('studio');
    expect(matched.look).toBeUndefined();
    const sourceRoot = asset.scene.getObjectByName('IFX_OSFP')!;
    sourceRoot.traverse(source => {
      if (!(source instanceof THREE.Mesh)) return;
      const a = studio.scene.getObjectByName(source.name) as THREE.Mesh;
      const b = matched.scene.getObjectByName(source.name) as THREE.Mesh;
      for (const name of Object.keys(source.geometry.attributes)) {
        const original = source.geometry.attributes[name].array;
        const same = (mesh: THREE.Mesh) => {
          const values = mesh.geometry.attributes[name].array;
          return values.length === original.length && values.every((value, i) => value === original[i]);
        };
        expect(same(a) && same(b), `${source.name}: ${name} does not change with finish`).toBe(true);
      }
      expect(a.geometry.index?.count).toBe(source.geometry.index?.count);
      expect(b.geometry.index?.count).toBe(source.geometry.index?.count);
      expectPoint(a.position.toArray(), b.position.toArray(), `${source.name}: position`);
      const materials = (mesh: THREE.Mesh) => Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials(b).forEach((material, index) => {
        const original = materials(source)[index] as THREE.MeshStandardMaterial;
        const actual = material as THREE.MeshStandardMaterial;
        expect(actual.metalness, `${source.name}: matched metalness`).toBe(original.metalness);
        expect(actual.roughness, `${source.name}: matched roughness`).toBe(original.roughness);
      });
    });
    for (const list of Object.values(arrays)) {
      expect(studio[list].map(flow => flow.route)).toEqual(matched[list].map(flow => flow.route));
    }
  });

  it('accounts for sixty OSFP pins with the paired VCC pads and eight differential lanes in each direction', () => {
    const contacts = metadata.contacts;
    expect(contacts).toHaveLength(58);
    expect(contacts.flatMap(contact => contact.pins).sort((a, b) => a - b)).toEqual(Array.from({ length: 60 }, (_, i) => i + 1));
    expect(contacts.filter(contact => contact.pins.length > 1).map(contact => [...contact.pins].sort((a, b) => a - b)))
      .toEqual([[15, 16], [45, 46]]);
    for (const direction of ['TX', 'RX']) for (let lane = 1; lane <= 8; lane++) for (const polarity of ['p', 'n']) {
      expect(contacts.filter(contact => contact.signal === `${direction}${lane}${polarity}`), `${direction}${lane}${polarity}`).toHaveLength(1);
    }
    for (const contact of contacts) {
      expect(contact.position.every(Number.isFinite), contact.name).toBe(true);
      expect(contact.matingSequence, contact.name).toBe(contact.signal === 'GND' ? 1 : contact.signal === 'VCC' ? 2 : 3);
      if (contact.pins.length === 2) expect(contact.signal).toBe('VCC');
    }
    expect(new Set(contacts.map(contact => contact.position[1])).size, 'contacts occupy two PCB faces').toBe(2);
    const leading = (sequence: number) => contacts.filter(contact => contact.matingSequence === sequence).map(contact => contact.position[0]);
    expect(Math.max(...leading(1)), 'ground reaches the mating end before power').toBeLessThan(Math.min(...leading(2)));
    expect(Math.max(...leading(2)), 'power reaches the mating end before signal').toBeLessThan(Math.min(...leading(3)));
  });

  it('keeps every photodetector-to-TIA bond short, on its receive lane, and terminated at the TIA', () => {
    const routes = new Map(metadata.routes.map(route => [route.name, route]));
    const tia = asset.scene.getObjectByName('PART_TIA')!;
    asset.scene.updateMatrixWorld(true);
    const tiaBounds = new THREE.Box3().setFromObject(tia).expandByScalar(0.00005);
    for (let lane = 1; lane <= 8; lane++) {
      const bond = routes.get(`TIA bond ${lane}`)!;
      const waveguide = routes.get(`RX ${String(lane).padStart(2, '0')} waveguide`)!;
      expect(bond, `lane ${lane}: electrical bond`).toBeDefined();
      const tiaEnd = new THREE.Vector3(...bond.points[0]);
      const pdEnd = new THREE.Vector3(...bond.points.at(-1)!);
      const opticalEnd = new THREE.Vector3(...waveguide.points.at(-1)!);
      expect(tiaBounds.containsPoint(tiaEnd), `lane ${lane}: bond terminates on TIA`).toBe(true);
      // Light enters the detector's right edge; its electrical contact is on the left.
      // They share a lane, not one physical terminal. The representative detector is submillimetre.
      expect(pdEnd.z, `lane ${lane}: optical and electrical paths meet the same detector lane`).toBeCloseTo(opticalEnd.z, 6);
      expect(Math.abs(pdEnd.y - opticalEnd.y), `lane ${lane}: contact sits on detector top`).toBeLessThan(0.00015);
      expect(pdEnd.distanceTo(opticalEnd), `lane ${lane}: endpoints occupy the same submillimetre PD region`).toBeLessThan(0.0008);
      const length = bond.points.slice(1).reduce((sum, point, i) => sum + new THREE.Vector3(...point).distanceTo(new THREE.Vector3(...bond.points[i])), 0);
      expect(length, `lane ${lane}: representative wire bond stays below 1 mm`).toBeLessThan(0.001);
    }
  });

  it.each(['metadata', 'route', 'anchor'] as const)('rejects an incompatible asset with a useful %s error', kind => {
    const root = asset.scene.getObjectByName('IFX_OSFP')!, original = root.userData.ifx;
    const broken = JSON.parse(original);
    if (kind === 'metadata') broken.units = 'cm';
    if (kind === 'route') broken.routes = broken.routes.filter((route: { name: string }) => route.name !== 'TX host copper 0 -1');
    if (kind === 'anchor') delete broken.anchors.dsp;
    root.userData.ifx = JSON.stringify(broken);
    try {
      expect(() => build()).toThrow(kind === 'metadata' ? /metadata.*metres/i : kind === 'route' ? /route: TX host copper 0 -1/ : /anchor: dsp/);
    } finally {
      root.userData.ifx = original;
    }
  });
});

describe('twin-port authored module correction', () => {
  it('contains two separate DSP/PIC packages and two thermal pads within the unchanged shell', () => {
    const meta = metadata as AssetMetadata & { engineCount:number; lanesPerEngine:number; implementation:string };
    expect(meta.engineCount).toBe(2);expect(meta.lanesPerEngine).toBe(4);
    expect(meta.implementation).toContain('representative');expect(meta.implementation).toContain('not a teardown');
    asset.scene.updateMatrixWorld(true);
    for (const kind of ['PART_DSP','PIC','03_THERMAL']) {
      const a=asset.scene.getObjectByName(`ENGINE_1_${kind}`),b=asset.scene.getObjectByName(`ENGINE_2_${kind}`);
      expect(a,kind).toBeDefined();expect(b,kind).toBeDefined();
      const aa=new THREE.Box3().setFromObject(a!),bb=new THREE.Box3().setFromObject(b!);
      expect(aa.min.z,`${kind}: separate packages`).toBeGreaterThan(bb.max.z+.0005);
      expect(aa.max.z).toBeLessThan(.010);expect(bb.min.z).toBeGreaterThan(-.010);
    }
  });
  it('maps each engine to its own MPO positions 1–4 TX and 9–12 RX without fiber crossovers', () => {
    const routes=new Map(metadata.routes.map(r=>[r.name,r]));
    for(let e=0;e<2;e++){
      const center=e===0?.0051:-.0051;
      const fibers=[];
      for(let j=0;j<4;j++)for(const prefix of ['TX','RX']){
        const r=routes.get(`${prefix} glass fiber ${String(e*4+j+1).padStart(2,'0')}`)!;
        const position=(prefix==='TX'?j:8+j);
        expect(r.points.at(-1)![2]).toBeCloseTo(center+.001375-position*.00025,8);
        for(const p of r.points)expect(Math.sign(p[2])).toBe(e===0?1:-1);
        fibers.push(r.points);
      }
      // Same-X samples share the authored smooth interpolation; a preserved
      // transverse order and >70um surface separation excludes false junctions.
      for(let a=0;a<fibers.length;a++)for(let b=a+1;b<fibers.length;b++){
        const order=Math.sign(fibers[a][0][2]-fibers[b][0][2]);
        for(let k=0;k<fibers[a].length;k++)expect((fibers[a][k][2]-fibers[b][k][2])*order).toBeGreaterThan(.00007);
      }
    }
  });
  it('powers both engines and removes both DSP/pad sets in LPO while retaining direct pairs', () => {
    const {result}=build('power');
    for(const target of ['dsp','driver','tia','lasers'])expect(result.flows.filter(f=>f.route.to===target)).toHaveLength(2);
    expect(result.heatFlows.filter(f=>f.route.from==='dsp')).toHaveLength(12);
    result.variant.setLpo(true);result.update(1);
    expect(result.scene.getObjectByName('PART_DSP')!.visible).toBe(false);
    expect(result.scene.getObjectByName('03_THERMAL')!.visible).toBe(false);
    expect(result.scene.getObjectByName('LPO bypass copper')!.visible).toBe(true);
    for(let i=0;i<8;i++)for(const prefix of ['TX','RX'])for(const sign of [-1,1]){
      const name=`${prefix} LPO copper ${i} ${sign}`;
      expect(metadata.routes.find(r=>r.name===name),name).toBeDefined();
    }
  });
});
