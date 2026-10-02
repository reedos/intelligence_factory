import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
// @ts-expect-error The browser app deliberately excludes Node types; Vitest provides this built-in at runtime.
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { ACCELERATORS, compute, DEFAULT_SCENARIO } from '../model/engine';
import { content } from '../data.js';
import { switchLabel } from './lid-labels.js';
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

function segmentDistance(a:Point,b:Point,c:Point,d:Point) {
      const A=new THREE.Vector3(...a), B=new THREE.Vector3(...b), C=new THREE.Vector3(...c), D=new THREE.Vector3(...d);
      const ab=new THREE.Line3(A,B), cd=new THREE.Line3(C,D), q=new THREE.Vector3();
      let min=Math.min(cd.closestPointToPoint(A,true,q).distanceTo(A),cd.closestPointToPoint(B,true,q).distanceTo(B),ab.closestPointToPoint(C,true,q).distanceTo(C),ab.closestPointToPoint(D,true,q).distanceTo(D));
      const u=B.clone().sub(A), v=D.clone().sub(C), w=A.clone().sub(C);
      const aa=u.dot(u), bb=u.dot(v), cc=v.dot(v), dd=u.dot(w), ee=v.dot(w), den=aa*cc-bb*bb;
      if(den>1e-26){const s=(bb*ee-cc*dd)/den,t=(aa*ee-bb*dd)/den;if(s>=0&&s<=1&&t>=0&&t<=1)min=Math.min(min,A.clone().addScaledVector(u,s).distanceTo(C.clone().addScaledVector(v,t)));}
      return min;
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
      const hotspot = (hotspots as Record<string, any>)[id];
      // The camera frames the anchor; a pin may step to a free corner of its part.
      expectPoint(hotspot.view.focus, expected, id);
      expect(new THREE.Vector3(...hotspot.pos).distanceTo(new THREE.Vector3(...expected)), id).toBeLessThan(0.75);
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

  it('draws the half-retimed (LRO) variant: DSP on transmit, linear receive straight to the host, and switches back', () => {
    const { result, state } = build();
    const visible = (name: string) => {
      let object = result.scene.getObjectByName(name);
      expect(object, name).toBeDefined();
      for (; object; object = object.parent || undefined) if (!object.visible) return false;
      return true;
    };
    const half = (root: string, dir: 'TX' | 'RX') => {
      let found: THREE.Object3D | undefined;
      result.scene.getObjectByName(root)!.traverse(node => { if (!found && node.name.endsWith(` · ${dir}`)) found = node; });
      expect(found, `${root} ${dir} half`).toBeDefined();
      return found!;
    };
    const shownHalf = (root: string, dir: 'TX' | 'RX') => { const o = half(root, dir); return o.visible && visible(root); };
    const merged = (root: string) => { let found: THREE.Object3D | undefined; result.scene.getObjectByName(root)!.traverse(n => { if (!found && (n as THREE.Mesh).isMesh) found = n; }); return found!.visible && visible(root); };
    // the two halves partition the merged copper: every triangle lands on exactly one side
    for (const root of ['PART_DSP_TRACES', 'LPO bypass copper']) {
      const tx = (half(root, 'TX') as THREE.Mesh).geometry.index!.count, rx = (half(root, 'RX') as THREE.Mesh).geometry.index!.count;
      expect(tx, root).toBeGreaterThan(0); expect(rx, root).toBeGreaterThan(0);
    }
    for (const kind of ['lro', 'dsp', 'lro', 'lpo', 'lro'] as const) {
      result.variant.set(kind);
      expect(result.variant.kind).toBe(kind);
      expect(result.variant.lpo).toBe(kind === 'lpo');
      const lro = kind === 'lro';
      expect(visible('LRO transmit-only DSP marking'), kind).toBe(lro);
      if (kind === 'lpo') continue;
      for (const name of ['PART_DSP', '03_THERMAL']) expect(visible(name), `${kind}: ${name}`).toBe(true);
      // full DSP draws the merged DSP copper; LRO swaps in its transmit half and the linear layout's receive half
      expect(merged('PART_DSP_TRACES'), `${kind}: merged DSP copper`).toBe(!lro);
      expect(shownHalf('PART_DSP_TRACES', 'TX'), `${kind}: DSP TX copper`).toBe(lro);
      expect(shownHalf('PART_DSP_TRACES', 'RX'), `${kind}: DSP RX copper`).toBe(false);
      expect(shownHalf('LPO bypass copper', 'RX'), `${kind}: linear RX copper`).toBe(lro);
      expect(shownHalf('LPO bypass copper', 'TX'), `${kind}: linear TX copper`).toBe(false);
      expect(merged('LPO bypass copper'), `${kind}: merged linear copper`).toBe(false);
      for (const mode of ['power', 'data', 'heat'] as const) {
        state.mode = mode;
        result.update(3);
        const shown = result[arrays[mode]].filter(flow => flow.group.visible);
        if (mode === 'data') {
          const edges = new Set(shown.map(flow => `${flow.route.from}>${flow.route.to}`));
          const expected = ['driver>mzm', 'lasers>mzm', 'mzm>mpo', 'mpo>pd', 'pd>tia', 'fingers>dsp', 'dsp>driver',
            ...(lro ? ['tia>fingers'] : ['tia>dsp', 'dsp>fingers'])];
          expect([...edges].sort(), `functional data chain: ${kind}`).toEqual(expected.sort());
        }
        if (mode === 'power') expect(shown.some(flow => flow.route.from === 'dcdc' && flow.route.to === 'dsp'), `${kind}: DSP powered`).toBe(true);
        if (mode === 'heat') {
          const dspHeat = shown.filter(flow => flow.route.from === 'dsp').length;
          expect(dspHeat, `${kind}: DSP heat arrows`).toBe(lro ? 3 : 6);
        }
      }
    }
    expect(result.variant.intro('data')).toMatch(/transmit/);
    const card = result.variant.partCopy({ id: 'dsp', title: 'DSP', specs: [['a', 'b', 'spec']] }, 'data');
    expect(card.title).toBe('DSP, transmit only');
    expect(card.specs, 'spec rows keep their positions (evidence chips are keyed by index)').toEqual([['a', 'b', 'spec']]);
  }, 60000);

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

  it('connects all 32 host signal conductors to the correct contact in DSP and LPO layouts', () => {
    const typed = metadata.routes as (AssetMetadata['routes'][number] & {hostSignal?:string;hostPin?:number})[];
    for (const section of ['host', 'LPO']) {
      const used = new Set<string>();
      for (const direction of ['TX', 'RX']) for (let lane=0;lane<8;lane++) for (const sign of [-1,1]) {
        const polarity = sign === (direction === 'TX' ? 1 : -1) ? 'p' : 'n';
        const signal = `${direction}${lane+1}${polarity}`;
        const contact = metadata.contacts.find(c=>c.signal===signal)!;
        const route = typed.find(r=>r.name===`${direction} ${section} copper ${lane} ${sign}`)!;
        expect(route.hostSignal).toBe(signal); expect(route.hostPin).toBe(contact.pins[0]);
        expectPoint(route.points[0],contact.position,`${section} ${signal} starts on its contact`);
        expect(route.points.some(p=>p[0]<-.040 && p[1]>.0027),`${signal}: visible top-side route after breakout`).toBe(true);
        used.add(signal);
      }
      expect(used.size).toBe(32);
    }
    // Representative escape routing must not pass through the power packages.
    asset.scene.updateMatrixWorld(true);
    const power=asset.scene.getObjectByName('PART_DCDC')!;
    const ray=new THREE.Raycaster();
    for(const route of typed.filter(r=>/^(TX|RX) (host|LPO) copper/.test(r.name))){
      for(let i=1;i<route.points.length;i++){
        const a=new THREE.Vector3(...route.points[i-1]),b=new THREE.Vector3(...route.points[i]);
        const delta=b.clone().sub(a),length=delta.length();
        ray.set(a,delta.normalize());ray.far=length;
        expect(ray.intersectObject(power,true),route.name).toHaveLength(0);
      }
    }
  });

  it('reveals buried connector traces only in the exploded data diagram', () => {
    const {result,state}=build('data');
    const windows:THREE.Mesh[]=[];
    result.scene.traverse((o:THREE.Object3D)=>{if(o.userData.pcbBreakoutWindow)windows.push(o as THREE.Mesh);});
    expect(windows.length).toBeGreaterThan(0);
    const materials=windows.map(w=>w.material as THREE.MeshStandardMaterial);
    expect(materials.every(m=>m.opacity===.08&&!m.depthWrite)).toBe(true);
    state.mode='power'; result.update(1);
    expect(materials.every(m=>m.opacity===1&&m.depthWrite)).toBe(true);
    state.mode='data'; result.update(2);
    expect(materials.every(m=>m.opacity===.08&&!m.depthWrite)).toBe(true);
  });

  it('keeps every pair of separate host conductors electrically isolated through the breakout', () => {
    for(const section of ['host','LPO']){
      const nets=metadata.routes.filter(r=>new RegExp(`^(TX|RX) ${section} copper`).test(r.name));
      for(let a=0;a<nets.length;a++)for(let b=a+1;b<nets.length;b++){
        let clearance=Infinity;
        for(let i=1;i<nets[a].points.length;i++)for(let j=1;j<nets[b].points.length;j++)clearance=Math.min(clearance,segmentDistance(nets[a].points[i-1],nets[a].points[i],nets[b].points[j-1],nets[b].points[j]));
        expect(clearance,`${nets[a].name} / ${nets[b].name}`).toBeGreaterThan(.000056);
      }
    }
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
  it('uses one eight-lane DSP for all 1.6T host and line-side traffic', () => {
    const meta = metadata as AssetMetadata & {
      portCount: number; lanesPerPort: number; nominalLaneGbps: number;
      nominalCapacityGbpsPerDirection: number; dspCount: number; dspLanesPerDirection: number;
    };
    expect(meta.portCount * meta.lanesPerPort * meta.nominalLaneGbps).toBe(1600);
    expect(meta.nominalCapacityGbpsPerDirection).toBe(1600);
    expect(meta.dspCount).toBe(1);
    expect(meta.dspLanesPerDirection * meta.nominalLaneGbps).toBe(1600);
    const marking = asset.scene.getObjectByName('SHARED_DSP_CAPACITY')!;
    expect(marking).toBeDefined();
    expect(marking.userData.capacityMarking).toBe('DSP\n8 × 200G\n1.6T');
    expect(marking.parent!.name).toBe('SHARED_PART_DSP');
    const dspBox = new THREE.Box3().setFromObject(marking.parent!);
    for (const direction of ['TX', 'RX']) for (let lane = 0; lane < 8; lane++) for (const sign of [-1, 1]) {
      const host = metadata.routes.find(r => r.name === `${direction} host copper ${lane} ${sign}`)!;
      const line = metadata.routes.find(r => r.name === `${direction} engine copper ${lane} ${sign}`)!;
      expect(host).toBeDefined(); expect(line).toBeDefined();
      for (const p of [host.points.at(-1)!, line.points[0]]) {
        expect(p[0]).toBeGreaterThanOrEqual(dspBox.min.x - .0001);
        expect(p[0]).toBeLessThanOrEqual(dspBox.max.x + .0001);
        expect(p[2]).toBeGreaterThan(dspBox.min.z);
        expect(p[2]).toBeLessThan(dspBox.max.z);
      }
    }
    for (let e = 0; e < 2; e++) {
      const engineRoutes = metadata.routes.filter(route => (route as typeof route & { engine: number }).engine === e + 1);
      for (const direction of ['TX', 'RX']) {
        expect(engineRoutes.filter(route => new RegExp(`^${direction} host copper \\d+ -1$`).test(route.name))).toHaveLength(4);
        expect(engineRoutes.filter(route => new RegExp(`^${direction} glass fiber \\d+$`).test(route.name))).toHaveLength(4);
      }
    }
  });
  it('keeps eight TX lanes on +Z and eight RX lanes on -Z through the shared PIC', () => {
    const meta = metadata as AssetMetadata & { portCount:number; lanesPerPort:number; picCount:number; implementation:string };
    expect(meta.portCount).toBe(2); expect(meta.lanesPerPort).toBe(4); expect(meta.picCount).toBe(1);
    expect(meta.implementation).toContain('representative'); expect(meta.implementation).toContain('not a teardown');
    asset.scene.updateMatrixWorld(true);
    for (const kind of ['PART_DSP', '03_THERMAL', 'PART_PIC', 'PART_DRIVER', 'PART_TIA']) {
      const group = asset.scene.getObjectByName(['PART_DSP', '03_THERMAL'].includes(kind) ? `SHARED_${kind}` : kind)!;
      expect(group).toBeDefined();
      const box = new THREE.Box3().setFromObject(group);
      expect(box.min.z).toBeGreaterThan(-.010); expect(box.max.z).toBeLessThan(.010);
    }
    for (const direction of ['TX', 'RX']) {
      const side = direction === 'TX' ? 1 : -1;
      for (let lane = 0; lane < 8; lane++) {
        for (const section of ['host', 'engine', 'LPO']) for (const sign of [-1, 1]) {
          const r = metadata.routes.find(r => r.name === `${direction} ${section} copper ${lane} ${sign}`)!;
          for (const p of r.points) expect(p[2] * side, r.name).toBeGreaterThan(0);
        }
        const n = String(lane + 1).padStart(2, '0');
        const optical = metadata.routes.filter(r => r.name.startsWith(`${direction} ${n} `));
        expect(optical.length).toBeGreaterThan(0);
        for (const r of optical) for (const p of r.points) expect(p[2] * side, r.name).toBeGreaterThan(0);
      }
      // One contiguous bank: uniform lane pitch, including lanes four and five.
      const zs = Array.from({length:8}, (_, i) => metadata.routes.find(r => r.name === `${direction} host copper ${i} -1`)!.points.at(-1)![2]);
      // the host pairs run straight from the breakout into the DSP (design review 10/01/2026): the bank's 0.24 mm pitch
      for (let i=1;i<8;i++) expect(zs[i-1]-zs[i]).toBeCloseTo(.00024, 8);
    }
  });
  it('maps each vertical ferrule to the MSA dual-MPO channel orientation with physically separated fiber crossings', () => {
    const routes=new Map(metadata.routes.map(r=>[r.name,r]));
    // OSFP MSA Rev 5.22 Fig 14-48: connector 1 (+Z) RX1-4 top, TX4-TX1 bottom;
    // connector 2 (-Z) TX5-8 top, RX8-RX5 bottom; positions 5-8 from the top are dark.
    for(let lane=1;lane<=8;lane++)for(const prefix of ['TX','RX']){
      const e=lane<=4?0:1;
      const k=e===0?(prefix==='RX'?lane-1:12-lane):(prefix==='TX'?lane-5:16-lane);
      const end=routes.get(`${prefix} glass fiber ${String(lane).padStart(2,'0')}`)!.points.at(-1)!;
      expect(end[2]).toBeCloseTo(e===0?.005:-.005,8);
      expect(end[1]).toBeCloseTo(.00705+(5.5-k)*.00025,8);
      expect(k<4||k>=8).toBe(true);
    }
    const fibers = metadata.routes.filter(r => /^(TX|RX) glass fiber/.test(r.name));
    // Check the complete 3D segment geometry, including crossings between ports.
    for(let a=0;a<fibers.length;a++)for(let b=a+1;b<fibers.length;b++){
      let clearance=Infinity;
      for(let i=1;i<fibers[a].points.length;i++)for(let j=1;j<fibers[b].points.length;j++)clearance=Math.min(clearance,segmentDistance(fibers[a].points[i-1],fibers[a].points[i],fibers[b].points[j-1],fibers[b].points[j]));
      expect(clearance,`${fibers[a].name} / ${fibers[b].name}`).toBeGreaterThan(.00007);
    }
  });
  it('powers one DSP and both analog banks and removes the DSP and pad in LPO', () => {
    const {result}=build('power');
    expect(result.flows.filter(f=>f.route.to==='dsp')).toHaveLength(2);   // one rail from each point-of-load stage (design review 10/01/2026)
    for(const target of ['driver','tia','lasers'])expect(result.flows.filter(f=>f.route.to===target)).toHaveLength(1);
    expect(result.heatFlows.filter(f=>f.route.from==='dsp')).toHaveLength(6);
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

// The module level opens the scenario's switch-side module: its lid prints the hall's switch label, and its captions
// and DSP marking carry that module's lane rate (800G twin-port, 8 × 100G, for H100 / GB200; 1.6T, 8 × 200G, otherwise).
describe('module level follows the scenario', () => {
  const want = { h100: ['100G', '800G', '400G'], gb200: ['100G', '800G', '400G'], gb300: ['200G', '1.6T', '800G'], rubin: ['200G', '1.6T', '800G'] } as const;
  it.each(Object.keys(want))('%s: lid print, captions and DSP marking', id => {
    const accel = (ACCELERATORS as any)[id], [lane, rate, port] = want[id as keyof typeof want];
    const state = { mode: 'data' };
    const result = module.build({ quality: { shadows: false }, state, model: { accel } });
    builds.push(result); result.update(0);
    expect(result.variant.lid).toBe(switchLabel(accel));
    result.variant.set('lpo'); expect(result.variant.lid).toBe(`${switchLabel(accel)} LPO`);
    result.variant.set('lro'); expect(result.variant.lid, 'LRO keeps the plain print').toBe(switchLabel(accel));
    result.variant.set('dsp'); expect(result.variant.lid).toBe(switchLabel(accel));
    const captions: string[] = [];
    result.scene.traverse((o: THREE.Object3D) => { if (o.userData.caption) captions.push(o.userData.caption.text); });
    expect(captions).toContain(`One DSP · ${rate} · 8 TX + 8 RX · two ${port} ports`);
    expect(captions.some(t => t.startsWith(`Pluggable module · ${rate}`)), captions.join(' | ')).toBe(true);
    if (id === 'rubin') expect(captions.some(t => /type unpublished/.test(t))).toBe(true);
    // the DSP's printed capacity: the asset's modeled 1.6T text, or the 800G overlay in its place
    const marks: string[] = [];
    result.scene.traverse((o: THREE.Object3D) => { if (o.visible && o.userData.capacityMarking && /DSP/.test(o.userData.capacityMarking)) marks.push(o.userData.capacityMarking); });
    expect(marks).toEqual([`DSP\n8 × ${lane}\n${rate}`]);
    // no capacity marking floats over the empty footprint in LPO, nor over the LRO retimer marking
    const shown = (o: THREE.Object3D | null): boolean => !o || (o.visible && shown(o.parent));
    for (const kind of ['lpo', 'lro']) {
      result.variant.set(kind);
      const left: string[] = [];
      result.scene.traverse((o: THREE.Object3D) => { if (o.userData.capacityMarking && /DSP/.test(o.userData.capacityMarking) && shown(o)) left.push(o.name); });
      expect(left, kind).toEqual([]);
    }
    result.variant.set('dsp');
    expect(result.scene.userData.blenderModule.scope).toContain(`eight ${lane} lanes`);
  });
});

describe('module level cards follow the scenario', () => {
  const spec = (parts: any[], id: string, label: string) => parts.find(p => p.id === id)?.specs.find((r: any[]) => r[0] === label);
  it.each(Object.keys(ACCELERATORS))('%s', id => {
    const C = content(compute({ ...DEFAULT_SCENARIO, accel: id } as any)) as any, accel = (ACCELERATORS as any)[id];
    const label = switchLabel(accel), lane = accel.nicGbps === 400 ? '100G' : '200G';
    const scene = C.SCENES.find((s: any) => s.id === 'module');
    expect(scene.intro).toContain(`This scenario’s switch module: ${label}`);
    expect(scene.dataIntro).toContain(`This scenario’s switch module, ${label}: `);
    expect(scene.dataIntro).toContain(`at ${lane} per lane`);
    expect(spec(C.PARTS_DATA.module, 'fingers', 'Host lanes')[1]).toContain(`8 × ${lane}`);
    expect(C.PARTS_DATA.module.find((p: any) => p.id === 'dsp').body).toContain(`at ${lane} per lane`);
    expect(spec(C.PARTS_HEAT.module, 'shell', 'Lid print')[1].startsWith(label)).toBe(true);
    const mod = spec(C.PARTS.module, 'fingers', 'This scenario’s switch module');
    expect(mod[1]).toMatch(id === 'rubin' ? /not published/ : accel.nicGbps === 400 ? /MMS4X00, 800G/ : /MMS4A00, 1\.6T/);
    const lanes = spec(C.PARTS_DATA.module, 'dsp', accel.nicGbps === 400 ? 'Optical lanes, MMS4X00' : 'Optical lanes, MMS4A00');
    if (id === 'rubin') expect(lanes).toBeUndefined();
    else expect(lanes[1]).toContain(`8 × ${lane} PAM4`);
    const power = C.PARTS.module.find((p: any) => p.id === 'fingers').specs.find((r: any[]) => /^Max power/.test(r[0]));
    expect(power?.[1]).toBe(id === 'rubin' ? undefined : accel.nicGbps === 400 ? '17 W' : '33.5 W');
    // the doors into the level name the module they open
    for (const P of [C.PARTS_DATA.hall, C.PARTS.hall]) expect(P.find((p: any) => p.id === 'optics').doorName).toBe(label);
    expect(C.PARTS_DATA.hall.find((p: any) => p.id === 'optics').body).toContain(`Go inside to open this scenario’s switch module: ${label}`);
    expect(C.PARTS_DATA.tray.find((p: any) => p.id === 'osfp').doorName).toBe(label);
  });
});

describe('hall and tray optics cards name only modules their scenario uses', () => {
  const refsOf = (rows: any[]) => rows.flatMap(r => (r.at(-1)?.refs || []).map((x: any[]) => x[0]));
  it('Vera Rubin’s hall optics card cites no MMS4A00 and no power figure for its unpublished module', () => {
    const C = content(compute({ ...DEFAULT_SCENARIO, accel: 'rubin' } as any)) as any;
    for (const P of [C.PARTS_DATA.hall]) {
      const card = P.find((p: any) => p.id === 'optics');
      expect(refsOf(card.specs)).not.toContain('nvidia-mms4a00');
      expect(refsOf(card.specs)).not.toContain('nvidia-mms4a00-specs');
      expect(card.specs.some((r: any[]) => /33\.5 W/.test(r[1]))).toBe(false);
      const sw = card.specs.find((r: any[]) => r[0] === 'At the switch: OSFP 1.6T');
      expect(sw[1]).toMatch(/exact type unpublished/); expect(sw[2]).toBe('assumed');
    }
  });
  it.each([['gb200', '9 W max'], ['h100', '17 W max'], ['gb300', null], ['rubin', null]])('%s tray door power rows fit its NIC modules', (id, want) => {
    const C = content(compute({ ...DEFAULT_SCENARIO, accel: id } as any)) as any;
    for (const P of [C.PARTS.tray, C.PARTS_HEAT.tray]) {
      const rows = P.find((p: any) => p.id === 'osfp').specs;
      if (want) { expect(rows[0][1]).toBe(want); expect(rows.some((r: any[]) => /1\.6T/.test(r[0]))).toBe(false); }
      else expect(rows.filter((r: any[]) => /1\.6T/.test(r[0])).every((r: any[]) => /switch-end/.test(r[0]))).toBe(true);
    }
  });
});

// Engineering layout rules (Reed, 10/01/2026; research/design-review-packages-modules-2026-10-01.md), checked on the
// authored asset: units are metres in the glTF rest frame.
describe('module board follows place-and-route rules', () => {
  const plan = (p: number[]) => [p[0], p[2]];
  const segBoxDistance = (a: number[], b: number[], box: { min: number[]; max: number[] }) => {
    let best = Infinity;
    for (let t = 0; t <= 1; t += 1 / 40) {
      const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
      const dx = Math.max(box.min[0] - x, 0, x - box.max[0]), dz = Math.max(box.min[1] - z, 0, z - box.max[1]);
      best = Math.min(best, Math.hypot(dx, dz));
    }
    return best;
  };
  const cross = (a: number[], b: number[], c: number[], d: number[]) => {
    const o = (p: number[], q: number[], r: number[]) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
    return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
  };
  // switching parts: the inductors and controllers (everything in PART_DCDC taller than the passives), clustered in plan
  function powerParts() {
    asset.scene.updateMatrixWorld(true);
    const boxes: { min: number[]; max: number[] }[] = [], v = new THREE.Vector3();
    asset.scene.getObjectByName('PART_DCDC')!.traverse((o: any) => {
      if (!o.isMesh) return;
      const pos = o.geometry.attributes.position, index = o.geometry.index;
      const n = index ? index.count : pos.count;
      for (let t = 0; t < n; t += 3) {
        const tri = [0, 1, 2].map(k => v.fromBufferAttribute(pos, index ? index.getX(t + k) : t + k).applyMatrix4(o.matrixWorld).toArray());
        if (tri.some(p => p[1] <= .0033)) continue;
        boxes.push({ min: [Math.min(...tri.map(p => p[0])), Math.min(...tri.map(p => p[2]))], max: [Math.max(...tri.map(p => p[0])), Math.max(...tri.map(p => p[2]))] });
      }
    });
    // merge boxes that touch until none do (point order can split one part into several boxes)
    for (let merged = true; merged;) {
      merged = false;
      for (let i = 0; i < boxes.length && !merged; i++) for (let j = i + 1; j < boxes.length && !merged; j++) {
        const A = boxes[i], C = boxes[j];
        if (A.min[0] - .00005 < C.max[0] && C.min[0] - .00005 < A.max[0] && A.min[1] - .00005 < C.max[1] && C.min[1] - .00005 < A.max[1]) {
          A.min = [Math.min(A.min[0], C.min[0]), Math.min(A.min[1], C.min[1])]; A.max = [Math.max(A.max[0], C.max[0]), Math.max(A.max[1], C.max[1])];
          boxes.splice(j, 1); merged = true;
        }
      }
    }
    return boxes;
  }
  const route = (name: string) => metadata.routes.find(r => r.name === name)!.points;
  it('host pairs run straight from the connector breakout into the DSP, a few millimetres', () => {
    for (const d of ['TX', 'RX']) for (let i = 0; i < 8; i++) for (const s of [-1, 1]) {
      const pts = route(`${d} host copper ${i} ${s}`), via = pts.findIndex(p => p[1] > .0027 && p[0] > -.0445);
      const after = pts.slice(via);
      expect(after.reduce((n, p, k) => k ? n + Math.hypot(p[0] - after[k - 1][0], p[2] - after[k - 1][2]) : 0, 0)).toBeLessThan(.005);
      expect(new Set(after.map(p => p[2])).size, 'straight: one z after the via').toBe(1);
    }
  });
  it('no high-speed pair passes within 1 mm of a switching inductor or controller', () => {
    const parts = powerParts();
    expect(parts.length).toBe(7);   // four inductors, three controller packages
    for (const r of metadata.routes.filter(r => /(host|engine|LPO) copper/.test(r.name))) for (let k = 1; k < r.points.length; k++)
      for (const box of parts) expect(segBoxDistance(plan(r.points[k - 1]), plan(r.points[k]), box), r.name).toBeGreaterThan(.001);
  });
  it('drivers sit right at the modulators: short RF lines that no laser feed crosses', () => {
    for (let i = 1; i <= 8; i++) {
      const rf = route(`TX RF feed ${i}`);
      expect(rf.slice(1).reduce((n, p, k) => n + Math.hypot(p[0] - rf[k][0], p[2] - rf[k][2]), 0)).toBeLessThan(.004);
      for (let k = 0; k < 4; k++) for (const h of [0, 1]) {
        const cw = route(`CW feed ${k} ${h}`);
        for (let a = 1; a < rf.length; a++) for (let b = 1; b < cw.length; b++) expect(cross(plan(rf[a - 1]), plan(rf[a]), plan(cw[b - 1]), plan(cw[b])), `RF ${i} × CW ${k} ${h}`).toBe(false);
      }
    }
  });
  it('the analog anchors keep their order along the board: DSP, driver and TIA, lasers, modulators', () => {
    const a = metadata.anchors;
    expect(a.dsp.position[0]).toBeLessThan(a.dcdc.position[0]);
    expect(a.dcdc.position[0]).toBeLessThan(a.driver.position[0]);
    expect(a.driver.position[0]).toBeLessThan(a.lasers.position[0]);
    expect(a.lasers.position[0]).toBeLessThan(a.mzm.position[0]);
    expect(a.dsp.position[0] - a.fingers.position[0]).toBeLessThan(.02);   // the DSP is the part next to the connector
  });
});
