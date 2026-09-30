import { it, expect } from 'vitest';
// @ts-ignore topojson-client ships no types; across.js uses it the same way
import { feature } from 'topojson-client';
import us from 'us-atlas/states-10m.json';
import { SITES, STATE_CARBON, DEFAULT_PLACE, albers } from '../model/sites';
import { WIND_R, windLayout, windFootprint, placePlants } from './across-plants.js';

// the same projection and state rings as across.js
const ORIGIN = albers(-92, 37);
const world = (lon: number, lat: number) => { const [x, y] = albers(lon, lat); return [x - ORIGIN[0], -(y - ORIGIN[1])]; };
const EXCLUDED = ['02', '15', '60', '66', '69', '72', '78'];
const RINGS = (feature(us as any, (us as any).objects.states) as any).features.filter((f: any) => !EXCLUDED.includes(f.id)).map((f: any) => ({
  id: f.id, rings: (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates).map((p: any) => p.map((r: any) => r.map(([a, b]: number[]) => world(a, b)))),
}));
function stateAt(x: number, z: number) {
  for (const { id, rings } of RINGS) for (const poly of rings) {
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
const homes = [DEFAULT_PLACE, ...Object.values(SITES)].map(s => ({ name: s.name, H: world(s.lon, s.lat) }));

it('the wind farm is dense and its rotors never overlap', () => {
  for (const mobile of [false, true]) {
    const t = windLayout(mobile);
    expect(t.length).toBeGreaterThanOrEqual(mobile ? 15 : 24);
    for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) {
      const dx = Math.abs(t[i][0] - t[j][0]), dz = Math.abs(t[i][1] - t[j][1]);
      // rotor disks face +z: two overlap only if they sit side by side closer than a diameter
      expect(dx >= 2 * WIND_R + 4 || dz >= 3 * 2 * WIND_R).toBe(true);
    }
  }
});

it('every campus sets its whole wind farm down inside one carbon-shaded state', () => {
  for (const mobile of [false, true]) for (const { name, H } of homes) {
    const t = windLayout(mobile);
    const plants = placePlants({ H, around: AROUND, footprints: { wind: windFootprint(t) }, stateAt, shaded: SHADED });
    const [x, z] = plants[2], id = stateAt(x, z);
    expect(SHADED.has(id), `${name} wind farm state ${id}`).toBe(true);
    for (const [px, pz] of windFootprint(t)) expect(stateAt(x + px, z + pz), `${name} turbine on ${id}`).toBe(id);
  }
});
