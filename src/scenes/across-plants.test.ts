import { it, expect } from 'vitest';
// @ts-ignore topojson-client ships no types; across.js uses it the same way
import { feature } from 'topojson-client';
import us from 'us-atlas/states-10m.json';
import { SITES, STATE_CARBON, DEFAULT_PLACE, albers } from '../model/sites';
import { WIND_R, windLayout, windFootprint, solarLayout, solarFootprint, SOLAR, placePlants, plantAvoid } from './across-plants.js';

// the same projection and state rings as across.js
const ORIGIN = albers(-92, 37);
const world = (lon: number, lat: number) => { const [x, y] = albers(lon, lat); return [x - ORIGIN[0], -(y - ORIGIN[1])]; };
const EXCLUDED = ['02', '15', '60', '66', '69', '72', '78'];
const RINGS = (feature(us as any, (us as any).objects.states) as any).features.filter((f: any) => !EXCLUDED.includes(f.id)).map((f: any) => ({
  id: f.id, rings: (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates).map((p: any) => p.map((r: any) => r.map(([a, b]: number[]) => world(a, b)))),
}));
const BOX = new Map<any, number[]>(RINGS.flatMap(({ rings }: any) => rings.map((poly: any) => {
  const r = poly[0], xs = r.map((p: number[]) => p[0]), zs = r.map((p: number[]) => p[1]);
  return [poly, [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)]];
})));
function stateAt(x: number, z: number) {
  for (const { id, rings } of RINGS) for (const poly of rings) {
    const b = BOX.get(poly)!; if (x < b[0] || x > b[1] || z < b[2] || z > b[3]) continue;
    let inside = false; const r = poly[0];
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, zi] = r[i], [xj, zj] = r[j];
      if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
    }
    if (inside) return id;
  }
  return null;
}
const SHADED = new Set(Object.keys(STATE_CARBON));
const AROUND = [[-420, -300, 'gas'], [-260, 330, 'nuclear'], [260, -420, 'wind'], [380, 180, 'gas'], [120, 420, 'solar']];
const AVOID = plantAvoid(world, Object.values(SITES));                              // as across.js passes it
const homes = [DEFAULT_PLACE, ...Object.values(SITES)].map(s => ({ name: s.name, H: world(s.lon, s.lat) }));

it('the wind farm is dense and its rotors never overlap', () => {
  for (const mobile of [false, true]) {
    const t = windLayout(mobile);
    expect(t.length).toBeGreaterThanOrEqual(mobile ? 15 : 24);
    let nearest = Infinity;
    for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) {
      const dx = Math.abs(t[i][0] - t[j][0]), dz = Math.abs(t[i][1] - t[j][1]);
      // rotor disks face +z: two overlap only if they sit side by side closer than a diameter; rows keep a gap of
      // at least one diameter so no row's blades reach into the next from above
      expect(dx >= 2 * WIND_R + 2 || dz >= 2 * WIND_R).toBe(true);
      if (dz < 2 * WIND_R) nearest = Math.min(nearest, dx);
    }
    // compact: neighbours along a row stand just over one rotor diameter apart
    expect(nearest).toBeLessThan(2 * WIND_R + 5);
  }
});

it('every campus sets its whole wind farm down on carbon-shaded land', () => {
  for (const mobile of [false, true]) for (const { name, H } of homes) {
    const t = windLayout(mobile);
    const plants = placePlants({ H, around: AROUND, footprints: { wind: windFootprint(t) }, stateAt, shaded: SHADED, avoid: AVOID });
    const [x, z] = plants[2];
    for (const [px, pz] of windFootprint(t)) expect(SHADED.has(stateAt(x + px, z + pz)), `${name} turbine off shaded land`).toBe(true);
  }
});

const box = (x: number, z: number, w: number, l: number) => ({ x0: x - w / 2, x1: x + w / 2, z0: z - l / 2, z1: z + l / 2 });
const overlaps = (a: any, b: any) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 1e-6 && Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) > 1e-6;

it('the solar array is a large array of tracker blocks whose rows, roads and skids never collide', () => {
  for (const mobile of [false, true]) {
    const a = solarLayout(mobile);
    expect(a.rows.length).toBeGreaterThanOrEqual(mobile ? 40 : 60);
    expect(SOLAR.rowW / SOLAR.pitch).toBeCloseTo(0.4, 2);                       // ground coverage ratio
    const rows = a.rows.map(([x, z]: number[]) => box(x, z, SOLAR.rowW, SOLAR.rowL));
    const roads = a.roads.map((r: any) => box(r.x, r.z, r.w, r.l));
    const skids = a.skids.map(([x, z]: number[]) => box(x, z, 5.2, 2.6));
    for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) expect(overlaps(rows[i], rows[j])).toBe(false);
    for (let i = 0; i < roads.length; i++) for (let j = i + 1; j < roads.length; j++) expect(overlaps(roads[i], roads[j]), `roads ${i} ${j}`).toBe(false);
    for (const r of rows) { for (const q of roads) expect(overlaps(r, q)).toBe(false); for (const k of skids) expect(overlaps(r, k)).toBe(false); }
    // every skid stands on a road
    for (const k of skids) expect(roads.some((q: any) => k.x0 >= q.x0 && k.x1 <= q.x1 && k.z0 >= q.z0 && k.z1 <= q.z1)).toBe(true);
    for (const q of roads) expect(Math.abs(q.x0) <= a.W / 2 + 1e-6 && Math.abs(q.x1) <= a.W / 2 + 1e-6 && Math.abs(q.z0) <= a.L / 2 + 1e-6 && Math.abs(q.z1) <= a.L / 2 + 1e-6).toBe(true);
  }
});

it('every campus sets its whole solar array down on carbon-shaded land, clear of the wind farm', () => {
  for (const mobile of [false, true]) for (const { name, H } of homes) {
    const t = windLayout(mobile), a = solarLayout(mobile), samples = solarFootprint(a);
    const plants = placePlants({ H, around: AROUND, footprints: { wind: windFootprint(t), solar: samples }, stateAt, shaded: SHADED, avoid: AVOID });
    const [x, z] = plants[4];
    for (const [px, pz] of samples) expect(SHADED.has(stateAt(x + px, z + pz)), `${name} solar off shaded land`).toBe(true);
    // every row end and middle, not just the footprint grid, on shaded land
    for (const [rx, rz] of a.rows) for (const u of [-1, 0, 1]) expect(SHADED.has(stateAt(x + rx, z + rz + u * SOLAR.rowL / 2))).toBe(true);
    const [wx, wz] = plants[2];
    expect(Math.hypot(x - wx, z - wz), `${name} solar clear of wind`).toBeGreaterThan(Math.hypot(a.W, a.L) / 2);
  }
});
