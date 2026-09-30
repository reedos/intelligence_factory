// Layouts for the two spread-out plant symbols on the regional map (wind farm, solar array) and the search that
// sets each one down wholly on land. Pure functions of map coordinates, so the tests can check every campus.
//
// Everything here is a representative cartographic symbol at the map's exaggerated scale, not a real plant's plan:
// spacings are given in rotor diameters or row pitch so the proportions read right, not in map kilometers.

// ---- wind: rows of turbines, staggered, rotors facing +z ----
// The authored turbine (R = 10 on a 16.5 hub, rotor diameter about 1.2x hub height) is set at 0.6 scale, R = 6 on
// a 9.9 hub, so a dense farm fits inside one state near any campus. Rows sit 2.4 rotor diameters apart across the
// wind and 4 downwind, each row offset half a spacing, with a small fixed jitter so the farm reads as sited
// turbines rather than a printed grid. Compressed from real spacing (about 3-5 D across, 5-10 D downwind) so the
// farm reads as dense at map scale; the rotors still never overlap.
export const WIND_SCALE = 0.6, WIND_R = 10 * WIND_SCALE, WIND_HUB = 16.5 * WIND_SCALE;
export function windLayout(mobile) {
  const cols = mobile ? 5 : 6, rows = mobile ? 3 : 4, D = 2 * WIND_R, across = 2.4 * D, down = 4 * D;
  const out = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const k = r * cols + c, jx = Math.sin(k * 12.9898) * 0.18 * D, jz = Math.sin(k * 78.233) * 0.3 * D;
    out.push([(c - (cols - 1) / 2 + (r % 2 ? 0.25 : -0.25)) * across + jx, (r - (rows - 1) / 2) * down + jz]);
  }
  return out;
}

// ---- solar: blocks of single-axis tracker rows, rows running north-south ----
// A row is 2.6 wide (two modules in portrait) and 32 long; rows repeat at a 6.5 pitch (ground coverage ratio 0.4)
// in blocks of 10, separated by gravel access roads, with one inverter skid per block on the road south of it.
export const SOLAR = { rowW: 2.6, rowL: 32, pitch: 6.5, perBlock: 10, road: 8 };
export function solarLayout(mobile) {
  const bx = 2, bz = mobile ? 2 : 3, { rowL, pitch, perBlock, road } = SOLAR;
  const blockW = perBlock * pitch, W = bx * blockW + (bx - 1) * road, L = bz * rowL + (bz - 1) * road;
  const rows = [], skids = [], roads = [];
  for (let i = 0; i < bx; i++) for (let j = 0; j < bz; j++) {
    const x0 = -W / 2 + i * (blockW + road), zc = -L / 2 + j * (rowL + road) + rowL / 2;
    for (let k = 0; k < perBlock; k++) rows.push([x0 + (k + 0.5) * pitch, zc]);
    skids.push([x0 + blockW / 2, zc - rowL / 2 - road / 2]);                             // on the road south of the block
  }
  // access roads: one between the block columns (north-south), one between each pair of block rows (east-west),
  // and a ring road around the array
  roads.push({ x: 0, z: 0, w: road * 0.55, l: L + road });
  for (let j = 1; j < bz; j++) roads.push({ x: 0, z: -L / 2 + j * (rowL + road) - road / 2, w: W + road, l: road * 0.55 });
  for (const s of [-1, 1]) {
    roads.push({ x: s * (W / 2 + road / 2), z: 0, w: road * 0.4, l: L + road * 1.4 });
    roads.push({ x: 0, z: s * (L / 2 + road / 2), w: W + road * 1.4, l: road * 0.4 });
  }
  return { rows, skids, roads, W: W + road * 1.4, L: L + road * 1.4 };
}

// the ground points a footprint must keep on land: a grid over its bounding box plus a margin
export function footprintSamples(halfW, halfL, step = 6) {
  const pts = [];
  const nx = Math.max(1, Math.ceil(2 * halfW / step)), nz = Math.max(1, Math.ceil(2 * halfL / step));
  for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) pts.push([-halfW + 2 * halfW * i / nx, -halfL + 2 * halfL * j / nz]);
  return pts;
}

// Set a plant down near (H + offset), turning the offset around the campus and trying nearer and farther spots,
// until every sample point stands inside one state. It prefers a state the map shades with a carbon figure (which
// reads as lit land); an unshaded state fills nearly as dark as the sea, and a plant on it looks offshore. It also
// keeps clear of the campus and of plants already placed. Returns [x, z] or null.
export function sitePlant({ H, offset, samples, radius, stateAt, shaded, taken = [], clearOfCampus = 90 }) {
  const [dx, dz] = offset;
  const tiers = [id => shaded.has(id), () => true];
  for (const ok of tiers) for (const s of [1, 0.85, 1.2, 0.7, 1.4, 0.55]) for (let k = 0; k < 24; k++) {
    const a = (k % 2 ? -1 : 1) * Math.ceil(k / 2) * Math.PI / 12;                       // 0, +15, -15, +30, -30 degrees...
    const x = H[0] + s * (dx * Math.cos(a) - dz * Math.sin(a)), z = H[1] + s * (dx * Math.sin(a) + dz * Math.cos(a));
    if (Math.hypot(x - H[0], z - H[1]) < radius + clearOfCampus) continue;
    if (taken.some(t => Math.hypot(x - t[0], z - t[1]) < radius + t[2])) continue;
    const id = stateAt(x, z);
    if (!id || !ok(id)) continue;
    if (samples.every(([px, pz]) => stateAt(x + px, z + pz) === id)) return [x, z];
  }
  return null;
}

// Place every plant: the compact ones (gas, nuclear) turned about the campus until their center stands on land,
// then the wide ones (those with a footprint) set down whole by sitePlant, clear of the rest. Keeps the order of
// `around`, since the grid lines seed their routes by it.
export function placePlants({ H, around, footprints, stateAt, shaded }) {
  const turnToLand = ([dx, dz, kind]) => {
    for (let k = 0; k < 24; k++) {
      const a = k * Math.PI / 12, x = H[0] + dx * Math.cos(a) - dz * Math.sin(a), z = H[1] + dx * Math.sin(a) + dz * Math.cos(a);
      if (stateAt(x, z) !== null) return [x, z, kind];
    }
    return [H[0] + dx * 0.3, H[1] + dz * 0.3, kind];
  };
  const plants = around.map(p => footprints[p[2]] ? null : turnToLand(p));
  const taken = plants.filter(Boolean).map(([x, z, kind]) => [x, z, kind === 'nuclear' ? 65 : 35]);
  around.forEach(([dx, dz, kind], i) => {
    if (plants[i]) return;
    const samples = footprints[kind], radius = Math.max(...samples.map(([x, z]) => Math.hypot(x, z)));
    const at = sitePlant({ H, offset: [dx, dz], samples, radius, stateAt, shaded, taken });
    plants[i] = at ? [at[0], at[1], kind] : turnToLand([dx, dz, kind]);
    taken.push([plants[i][0], plants[i][1], radius]);
  });
  return plants;
}
export const windFootprint = pts => pts.flatMap(([x, z]) => [[x - WIND_R - 2, z - 3], [x + WIND_R + 2, z - 3], [x - WIND_R - 2, z + 3], [x + WIND_R + 2, z + 3]]);
