// Layouts for the two spread-out plant symbols on the regional map (wind farm, solar array) and the search that
// sets each one down wholly on land. Pure functions of map coordinates, so the tests can check every campus.
//
// Everything here is a representative cartographic symbol at the map's exaggerated scale, not a real plant's plan:
// spacings are given in rotor diameters or row pitch so the proportions read right, not in map kilometers.

// ~40 major US metro areas, lon/lat and a rough population weight (millions) for glow size only: purely decorative
// city lights, no labels and no invented figures reach the page.
export const METROS = [
  [-74.01, 40.71, 19.5], [-118.24, 34.05, 13.2], [-87.63, 41.88, 9.5], [-96.80, 32.78, 7.8],
  [-95.37, 29.76, 7.3], [-77.04, 38.91, 6.3], [-80.19, 25.76, 6.2], [-75.17, 39.95, 6.2],
  [-84.39, 33.75, 6.3], [-112.07, 33.45, 5.0], [-71.06, 42.36, 4.9], [-122.42, 37.77, 4.7],
  [-117.40, 33.95, 4.6], [-83.05, 42.33, 4.3], [-122.33, 47.61, 4.0], [-93.27, 44.98, 3.7],
  [-117.16, 32.72, 3.3], [-82.46, 27.95, 3.3], [-104.99, 39.74, 3.0], [-90.20, 38.63, 2.8],
  [-76.61, 39.29, 2.8], [-80.84, 35.23, 2.7], [-81.38, 28.54, 2.7], [-98.49, 29.42, 2.6],
  [-122.68, 45.52, 2.5], [-121.49, 38.58, 2.4], [-79.99, 40.44, 2.3], [-115.14, 36.17, 2.3],
  [-84.51, 39.10, 2.3], [-94.58, 39.10, 2.2], [-83.00, 39.96, 2.1], [-86.16, 39.77, 2.1],
  [-81.69, 41.50, 2.0], [-121.89, 37.34, 2.0], [-86.78, 36.16, 2.0], [-76.29, 36.85, 1.8],
  [-81.66, 30.33, 1.6], [-87.91, 43.04, 1.6], [-97.52, 35.47, 1.4], [-78.64, 35.78, 1.5],
];
// keep-out circles for the wide plants: each metro's light pool (as across.js draws it) and each campus's glow
export const plantAvoid = (world, sites) => [
  ...METROS.map(([lon, lat, w]) => [...world(lon, lat), 0.5 * (20 + Math.min(40, Math.sqrt(w) * 9)) + 4]),
  ...sites.map(s => [...world(s.lon, s.lat), 70]),
];

// ---- wind: rows of turbines, staggered, rotors facing +z ----
// The authored turbine (R = 10 on a 16.5 hub, rotor diameter about 1.2x hub height) is set at 0.6 scale, R = 6 on
// a 9.9 hub. Turbines stand just over one rotor diameter apart along a row (one diameter plus a 3 km gap) and rows
// sit 1.5 diameters apart downwind, each row offset a quarter spacing, with a small fixed jitter so the farm reads
// as sited turbines rather than a printed grid. Far tighter than real spacing (about 3-5 D across, 5-10 D downwind)
// so the farm reads as one compact, dense farm at map scale; the rotors still never overlap. `size` ([columns, rows])
// gives a smaller farm for a remote campus.
export const WIND_SCALE = 0.6, WIND_R = 10 * WIND_SCALE, WIND_HUB = 16.5 * WIND_SCALE;
export function windLayout(mobile, size = mobile ? [6, 3] : [7, 4]) {
  const [cols, rows] = size, D = 2 * WIND_R, across = D + 3, down = 1.5 * D;
  const out = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const k = r * cols + c, jx = Math.sin(k * 12.9898) * 0.5, jz = Math.sin(k * 78.233) * 0.1 * D;
    out.push([(c - (cols - 1) / 2 + (r % 2 ? 0.25 : -0.25)) * across + jx, (r - (rows - 1) / 2) * down + jz]);
  }
  return out;
}

// ---- solar: blocks of single-axis tracker rows, rows running north-south ----
// A row is 2.6 wide (two modules in portrait) and 32 long; rows repeat at a 6.5 pitch (ground coverage ratio 0.4)
// in blocks of 10, separated by gravel access roads, with one inverter skid per block on the road north of it (map north is -z).
export const SOLAR = { rowW: 2.6, rowL: 32, pitch: 6.5, perBlock: 10, road: 8 };
export function solarLayout(mobile) {
  const bx = 2, bz = mobile ? 2 : 3, { rowL, pitch, perBlock, road } = SOLAR;
  const blockW = perBlock * pitch, W = bx * blockW + (bx - 1) * road, L = bz * rowL + (bz - 1) * road;
  const rows = [], skids = [], roads = [];
  for (let i = 0; i < bx; i++) for (let j = 0; j < bz; j++) {
    const x0 = -W / 2 + i * (blockW + road), zc = -L / 2 + j * (rowL + road) + rowL / 2;
    for (let k = 0; k < perBlock; k++) rows.push([x0 + (k + 0.5) * pitch, zc]);
    skids.push([x0 + blockW / 2, zc - rowL / 2 - road / 2]);                             // on the road north of the block
  }
  // gravel access roads: a ring around the array, one north-south between the block columns and one east-west
  // between each pair of block rows. Laid as butting strips with a hair's gap, never overlapping, so no two road
  // tops share a plane.
  const g = 0.05, ringW = road * 0.4, midW = road * 0.55, inX = W / 2 + road * 0.3, inZ = L / 2 + road * 0.3;
  for (const s of [-1, 1]) {
    roads.push({ x: s * (W / 2 + road / 2), z: 0, w: ringW, l: 2 * (L / 2 + road * 0.7) });               // east and west
    roads.push({ x: 0, z: s * (L / 2 + road / 2), w: 2 * inX - 2 * g, l: ringW });                       // north and south
  }
  roads.push({ x: 0, z: 0, w: midW, l: 2 * inZ - 2 * g });
  for (let j = 1; j < bz; j++) {
    const zr = -L / 2 + j * (rowL + road) - road / 2, x0 = midW / 2 + g, x1 = inX - g;
    for (const s of [-1, 1]) roads.push({ x: s * (x0 + x1) / 2, z: zr, w: x1 - x0, l: midW });
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
// until every sample point stands on land the map shades with a carbon figure, which reads as lit land (it may
// straddle a line between two shaded states). An unshaded state fills nearly as dark as the sea, and a plant on it
// looks offshore, so that is only the fallback: all on land inside one state. It also keeps clear of the campus and
// of every circle in `taken`. Returns [x, z] or null.
export function sitePlant({ H, offset, samples, radius, stateAt, shaded, taken = /** @type {number[][]} */ ([]), clearOfCampus = 60 }) {
  const [dx, dz] = offset;
  const tiers = [
    (x, z) => samples.every(([px, pz]) => shaded.has(stateAt(x + px, z + pz))),
    (x, z) => { const id = stateAt(x, z); return id !== null && samples.every(([px, pz]) => stateAt(x + px, z + pz) === id); },
  ];
  for (const ok of tiers) for (const s of [1, 0.85, 1.2, 0.7, 1.4, 0.55, 0.45, 0.35, 1.65]) for (let k = 0; k < 48; k++) {
    const a = (k % 2 ? -1 : 1) * Math.ceil(k / 2) * Math.PI / 24;                       // 0, +7.5, -7.5, +15 degrees...
    const x = H[0] + s * (dx * Math.cos(a) - dz * Math.sin(a)), z = H[1] + s * (dx * Math.sin(a) + dz * Math.cos(a));
    if (Math.hypot(x - H[0], z - H[1]) < radius + clearOfCampus) continue;
    if (taken.some(t => Math.hypot(x - t[0], z - t[1]) < radius + t[2])) continue;
    if (ok(x, z)) return [x, z];
  }
  return null;
}

// Place every plant: the compact ones (gas, nuclear) turned about the campus until their center stands on land,
// then the wide ones (those with a footprint) set down whole by sitePlant, clear of the rest. Keeps the order of
// `around`, since the grid lines seed their routes by it. `avoid` lists [x, z, r] circles the wide plants keep out
// of as well: city light pools and the other campuses, whose glow would otherwise spill over an array.
export function placePlants({ H, around, footprints, stateAt, shaded, avoid = /** @type {number[][]} */ ([]) }) {
  const turnToLand = ([dx, dz, kind]) => {
    for (let k = 0; k < 24; k++) {
      const a = k * Math.PI / 12, x = H[0] + dx * Math.cos(a) - dz * Math.sin(a), z = H[1] + dx * Math.sin(a) + dz * Math.cos(a);
      if (stateAt(x, z) !== null) return [x, z, kind];
    }
    return [H[0] + dx * 0.3, H[1] + dz * 0.3, kind];
  };
  const plants = around.map(p => footprints[p[2]] ? null : turnToLand(p));
  const taken = [...plants.filter(Boolean).map(([x, z, kind]) => [x, z, kind === 'nuclear' ? 90 : 45]), ...avoid];
  around.forEach(([dx, dz, kind], i) => {
    if (plants[i]) return;
    const samples = footprints[kind], radius = Math.max(...samples.map(([x, z]) => Math.hypot(x, z)));
    const at = sitePlant({ H, offset: [dx, dz], samples, radius, stateAt, shaded, taken });
    plants[i] = at ? [at[0], at[1], kind] : turnToLand([dx, dz, kind]);
    taken.push([plants[i][0], plants[i][1], radius]);
  });
  return plants;
}
// Footprints carry a shore margin of 10 map km past the outermost rotor tip or roadside, so a plant never
// hugs a coast or a dark state line.
export const SHORE = 10;
export const windFootprint = pts => {
  const xs = pts.map(p => p[0]), zs = pts.map(p => p[1]);
  const x0 = Math.min(...xs) - WIND_R - SHORE, x1 = Math.max(...xs) + WIND_R + SHORE, z0 = Math.min(...zs) - SHORE, z1 = Math.max(...zs) + SHORE;
  return footprintSamples((x1 - x0) / 2, (z1 - z0) / 2).map(([x, z]) => [x + (x0 + x1) / 2, z + (z0 + z1) / 2]);
};
export const solarFootprint = a => footprintSamples(a.W / 2 + SHORE, a.L / 2 + SHORE);
