import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { compute, DEFAULT_SCENARIO, type Scenario } from '../model/engine';

// Keep the actual geometry, instancing, flow paths and model. Canvas texturing is the only stub.
function canvasDocument() {
  return { createElement(tag: string) {
    if (tag !== 'canvas') throw new Error(`Unexpected DOM dependency: ${tag}`);
    const noop = () => undefined;
    const context = new Proxy({
      createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      measureText: (text: string) => ({ width: text.length * 24 }),
      createLinearGradient: () => ({ addColorStop: noop }),
      createRadialGradient: () => ({ addColorStop: noop }),
    } as Record<string, unknown>, { get(target, key: string) { return key in target ? target[key] : noop; } });
    return { width: 1, height: 1, getContext: () => context };
  } };
}

type Campus = ReturnType<typeof import('./campus.js')['build']>;
type Case = { name: string; model: ReturnType<typeof compute>; built: Campus };
let cases: Case[];

beforeAll(async () => {
  vi.stubGlobal('document', canvasDocument());
  const { build } = await import('./campus.js');
  const scenarios: [string, Partial<Scenario>][] = [
    ['one warm-water hall', { meterMW: 10 }],
    ['many warm-water halls', { meterMW: 1000 }],
    ['battery backup with closed-loop cooling', { meterMW: 100, site: 'colossus2', accel: 'gb300', cooling: 'liquid' }],
  ];
  cases = scenarios.map(([name, scenario]) => {
    const model = compute({ ...DEFAULT_SCENARIO, ...scenario });
    const before = JSON.stringify(model);
    const built = build({ quality: { shadows: false, mobile: true }, model });
    expect(JSON.stringify(model), `${name}: architecture does not change the engineering model`).toBe(before);
    return { name, model, built };
  });
}, 20000);

afterAll(() => {
  vi.unstubAllGlobals();
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  for (const c of cases ?? []) c.built.scene.traverse((o: THREE.Object3D) => {
    if (!(o instanceof THREE.Mesh)) return;
    geometries.add(o.geometry);
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m);
  });
  geometries.forEach(g => g.dispose());
  materials.forEach(m => m.dispose());
});

function halls(scene: THREE.Scene) {
  const found: THREE.Mesh<THREE.BoxGeometry>[] = [];
  scene.traverse(o => {
    if (o instanceof THREE.Mesh && o.geometry instanceof THREE.BoxGeometry
      && o.geometry.parameters.height === 22 && o.geometry.parameters.depth === 90) found.push(o);
  });
  return found;
}

describe('campus architectural changes preserve the engineering scene', () => {
  it('draws every modeled hall once and scales the one-hall footprint to its load', () => {
    for (const { name, model, built } of cases) {
      const shells = halls(built.scene);
      const count = shells.reduce((n, shell) => n + (shell instanceof THREE.InstancedMesh ? shell.count : 1), 0);
      expect(count, name).toBe(model.halls);
      expect(shells.filter(shell => !(shell instanceof THREE.InstancedMesh)), `${name}: detailed halls`).toHaveLength(Math.min(model.halls, 2));
      for (const shell of shells) {
        const width = shell.geometry.parameters.width;
        expect(width, name).toBeGreaterThanOrEqual(70);
        expect(width, name).toBeLessThanOrEqual(260);
      }
    }
    expect(halls(cases[0].built.scene)[0].geometry.parameters.width).toBeLessThan(260);
  });

  it('does not strand the south fiber entrance at a missing second hall', () => {
    const { built, model } = cases[0];
    expect(model.halls).toBe(1);
    const entry = built.dataHotspots.fiber.pos;
    const downstream = built.dataFlows.find(f => {
      const start = f.path.getPoint(0) as THREE.Vector3;
      return Math.abs(start.x - entry[0]) < 0.1 && Math.abs(start.z - entry[2]) < 0.1;
    });
    expect(downstream, 'fiber entrance has a downstream route').toBeDefined();
    const end = downstream!.path.getPoint(1) as THREE.Vector3;
    const hall = halls(built.scene)[0];
    const footprint = new THREE.Box3().setFromObject(hall);
    // The west office and exterior service margin belong to the hall; fiber is an underground diagram.
    footprint.min.x -= 28;
    footprint.expandByScalar(15);
    expect(footprint.containsPoint(end), 'the entry route reaches the only existing hall or its office').toBe(true);
    expect(built.dataHotspots.interhall).toBeUndefined();
    expect(built.dataHotspots.ductbank).toBeUndefined();
    expect(built.dataFlows.some(f => f.cls === 'eth')).toBe(false);
  });

  it('keeps battery/closed-loop scenarios free of diesel and evaporative-cooling cues', () => {
    const { model, built } = cases[2];
    expect(model.backup).toBe('battery');
    expect(model.closedLoop).toBe(true);
    expect(built.hotspots.gensets).toBeUndefined();
    expect(built.hotspots.fuel).toBeUndefined();
    expect(built.hotspots.bess).toBeDefined();
    expect(built.hotspots.towers).toBeUndefined();
    expect(built.heatHotspots.towers).toBeUndefined();
    expect(built.heatFlows.some(f => f.cls === 'vapor')).toBe(false);
    expect(built.heatFlows.some(f => f.cls === 'air'), 'heat still leaves the closed-loop plant').toBe(true);
    expect(built.flows.some(f => f.role === 'standby'), 'battery backup still connects to the campus').toBe(true);
    const towerMakeup = built.heatFlows.filter(f => {
      const start = f.path.getPoint(0) as THREE.Vector3;
      return Math.abs(start.x - 125) < 0.1 && Math.abs(start.z + 280) < 0.1;
    });
    expect(towerMakeup, 'no makeup-water route to an absent evaporative tower').toHaveLength(0);
  });

  it('connects standby power to the MV network even when the lone hall is short', () => {
    for (const { name, built } of cases) {
      const network = built.flows.filter(flow => flow.cls === 'mv' && flow.role !== 'standby');
      for (const standby of built.flows.filter(flow => flow.role === 'standby')) {
        const end = standby.path.getPoint(1) as THREE.Vector3;
        const distances = network.flatMap(flow => flow.path.curves.map(curve => {
          const segment = new THREE.Line3(curve.getPoint(0) as THREE.Vector3, curve.getPoint(1) as THREE.Vector3);
          return segment.closestPointToPoint(end, true, new THREE.Vector3()).distanceTo(end);
        }));
        expect(Math.min(...distances), `${name}: standby endpoint touches the campus MV feeder`).toBeLessThan(0.01);
      }
    }
  });

  it('keeps new architecture out of vehicle corridors and below the roof-fan discharge plane', () => {
    for (const { name, built, model } of cases) {
      const layout = built.scene.userData.campusArchitecture;
      expect(layout?.representative, `${name}: concept scope is explicit`).toBe(true);
      expect(layout.detailedHalls).toHaveLength(Math.min(model.halls, 2));
      expect(layout.additionalHallCount).toBe(Math.max(0, model.halls - 2));
      const architecture = built.scene.getObjectByName('Campus concept architecture')!;
      expect(architecture).toBeDefined();
      built.scene.updateMatrixWorld(true);
      expect(new THREE.Box3().setFromObject(architecture).max.y, `${name}: no roof cap above the declared cornice`).toBeLessThanOrEqual(layout.roofFeatureMaxY + 0.001);
      const corridors = layout.roads.map((r: { x0: number; x1: number; z0: number; z1: number }) =>
        new THREE.Box3(new THREE.Vector3(r.x0, 0.6, r.z0), new THREE.Vector3(r.x1, 4.5, r.z1)));
      let blocked = false;
      architecture.traverse(node => {
        if (!(node instanceof THREE.Mesh)) return;
        const positions = node.geometry.getAttribute('position'), index = node.geometry.getIndex();
        const triangle = new THREE.Triangle();
        const count = index ? index.count : positions.count;
        for (let i = 0; i < count && !blocked; i += 3) {
          [triangle.a, triangle.b, triangle.c].forEach((point, j) => point.fromBufferAttribute(positions, index ? index.getX(i + j) : i + j).applyMatrix4(node.matrixWorld));
          if (corridors.some((box: THREE.Box3) => box.intersectsTriangle(triangle))) blocked = true;
        }
      });
      expect(blocked, `${name}: architecture leaves road clearance open`).toBe(false);
      if (model.cooling.id === 'warm') for (const air of built.heatFlows.filter(f => f.cls === 'air')) {
        const outlet = air.path.getPoint(0);
        expect(outlet.y, `${name}: roof discharge starts above the new cornice`).toBeGreaterThan(layout.roofFeatureMaxY);
      }
      for (const [i, hall] of layout.detailedHalls.entries()) {
        const shell = built.scene.getObjectByName(`Campus hall ${i + 1}`)!;
        const bounds = new THREE.Box3().setFromObject(shell);
        expect(bounds.min.x).toBeCloseTo(hall.x0, 4);
        expect(bounds.max.x).toBeCloseTo(hall.x1, 4);
        expect(bounds.min.z).toBeCloseTo(hall.z0, 4);
        expect(bounds.max.z).toBeCloseTo(hall.z1, 4);
      }
    }
  });

  it('preserves reachable layer anchors, physical flow coordinates and stable update calls in every layout', () => {
    for (const { name, built, model } of cases) {
      for (const key of ['hotspots', 'dataHotspots', 'heatHotspots'] as const) {
        expect(Object.keys(built[key]).length, `${name}/${key}`).toBeGreaterThan(0);
        for (const [id, hot] of Object.entries(built[key])) for (const point of [hot.pos, hot.view.pos, hot.view.target]) {
          expect(point.length, `${name}/${id}`).toBe(3);
          expect(point.every(Number.isFinite), `${name}/${id}`).toBe(true);
        }
      }
      for (const list of [built.flows, built.dataFlows, built.heatFlows]) for (const f of list) {
        expect(f.len, `${name}/${f.cls}: nonempty path`).toBeGreaterThan(0);
        for (const curve of f.path.curves) for (const point of [curve.getPoint(0), curve.getPoint(1)]) {
          expect(point.toArray().every(Number.isFinite), `${name}/${f.cls}: finite path`).toBe(true);
        }
      }
      for (const t of [0, 1, 20]) expect(() => built.update(t, 1 / 60)).not.toThrow();
      if (model.halls > 1) {
        expect(built.dataHotspots.interhall).toBeDefined();
        expect(built.dataFlows.filter(f => f.cls === 'eth')).toHaveLength(2);
      }
    }
  });
});
