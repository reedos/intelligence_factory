// The GPU package, described once. The tray level (tray.js, tray-rubin.js) and the chip level (chip.js) both build the
// substrate, interposer, dies and HBM stacks from these numbers, the tray at its lower detail and in tray units (10 cm);
// tools/blender/export-native-reference.mjs writes them to tools/blender/references/gpu-package.json for the Blender
// scripts (build-compute.py), and gpu-package.test.ts fails when any level draws something else.
//
// Frame: centimeters, origin at the package centre, x across the tray / board, z along it (the front is +z at the tray
// level), so a package is the same shape and way round at both levels. Sizes are footprints; heights stay with the level
// that draws them (the chip level explodes the layers, the tray stacks them flat).
//
// What is sourced and what is chosen (cited on the chip level's cards through evidence.js 'gpu-package-geometry'):
//   H100 (SXM5)  die 814 mm2 and one die, five working HBM3 stacks on a six-site CoWoS-S interposer: NVIDIA Hopper
//                architecture in-depth. Package about 5.5 x 5.8 cm: an estimate scaled from SXM5 photos (Locuza,
//                2022); NVIDIA does not publish it. Die aspect, HBM footprint, interposer size and stack positions
//                are drawn, not published: the die is 26 mm wide (the reticle field) and as deep as 814 mm2 allows.
//   B200 / B300  two reticle-limit dies joined by NV-HBI and eight HBM3E stacks on CoWoS-L (NVIDIA Blackwell
//                platform release; Blackwell Ultra blog). A reticle field is 26 x 33 mm (858 mm2), so each die is drawn
//                at that limit; two of them exceed the reported 1,600 mm2 total, as ">1600" says. NVIDIA publishes no
//                package, interposer or stack footprint or placement: four stacks along each long die edge is the
//                drawn arrangement, as in public package photos, the footprints representative.
//   Rubin        two reticle dies and eight HBM4 stacks are published; die size, package, interposer and stack
//                placement are not (evidence 'rubin-die-area' already carries Blackwell's two-die area forward). The
//                Blackwell arrangement is carried over, stated as assumed, one drawing at both levels.
export const GPU_PACKAGE_UNIT_CM = 1;

// HBM stack footprint, representative for HBM3 / HBM3E / HBM4 (JEDEC packages are about 11 x 10 mm class).
const HBM = { w: 1.06, d: 1.0 };

// Two-die package: B200 (GB200), B300 (GB300) and Rubin.
function twin(id, label) {
  const sites = [-2.02, -0.7, 0.7, 2.02].flatMap(x => [-2.3, 2.3].map(z => [x, z]));
  return {
    id, label, hbmEdge: 'z',
    substrate: { w: 8.4, d: 8.4 },
    interposer: { w: 6.2, d: 5.9 },
    dies: [{ x: -1.36, z: 0, w: 2.6, d: 3.3 }, { x: 1.36, z: 0, w: 2.6, d: 3.3 }],
    hbm: { ...HBM, sites, spare: -1 },
    // chip-level only: the heat spreader footprint, board and ball grid, stiffener ring, capacitor clusters, name etch
    lid: { w: 7.2, d: 7.0, skirt: 0.36 },
    bga: { pitch: 0.3, n: 26, half: 3.75, r: 0.1 },
    stiffener: { w: 8.2, d: 8.2, band: 0.35 },
    fiducial: [3.52, 3.52],
    capClusters: [...[-1, 1].flatMap(zs => [-2.2, 0, 2.2].map(x => ({ x, z: zs * 3.38, alongX: true }))),
      ...[-1, 1].flatMap(xs => [-1.8, 0, 1.8].map(z => ({ x: xs * 3.4, z, alongX: false })))],
    etch: [1.1, 3.38],
  };
}

export const GPU_PACKAGE = {
  h100: {
    id: 'h100', label: 'H100 SXM5', hbmEdge: 'x',
    substrate: { w: 5.5, d: 5.8 },
    interposer: { w: 5.12, d: 3.7 },
    dies: [{ x: 0, z: 0, w: 2.6, d: 3.13 }],
    // six sites, five working stacks and a blank spacer at the last one (+x, +z)
    hbm: { ...HBM, sites: [-1.98, 1.98].flatMap(x => [-1.12, 0, 1.12].map(z => [x, z])), spare: 5 },
    lid: { w: 5.2, d: 4.4, skirt: 0 },
    bga: { pitch: 0.2, n: 26, half: 2.5, r: 0.07 },
    stiffener: { w: 5.4, d: 5.7, band: 0.12 },
    fiducial: [2.45, 2.62],
    capClusters: [-1, 1].flatMap(zs => [-2.0, 0, 2.0].map(x => ({ x, z: zs * 2.4, alongX: true }))),
    etch: [1.0, 2.4],
  },
  gb200: twin('gb200', 'B200'),
  gb300: twin('gb300', 'B300'),
  rubin: twin('rubin', 'Rubin'),
};

export const gpuPackage = id => GPU_PACKAGE[id];
/** The host board the package level cuts square: a 1.2 cm margin around the substrate. */
export const gpuBoardCm = id => Math.max(GPU_PACKAGE[id].substrate.w, GPU_PACKAGE[id].substrate.d) + 2.4;

/** Flat list of the physical parts, in the order every level draws them: substrate, interposer, dies, HBM sites. */
export function packageParts(id) {
  const p = GPU_PACKAGE[id];
  return [
    { kind: 'substrate', x: 0, z: 0, ...p.substrate },
    { kind: 'interposer', x: 0, z: 0, ...p.interposer },
    ...p.dies.map((d, i) => ({ kind: 'die', i, ...d })),
    ...p.hbm.sites.map(([x, z], i) => ({ kind: p.hbm.spare === i ? 'spacer' : 'hbm', i, x, z, w: p.hbm.w, d: p.hbm.d })),
  ];
}

/** The same parts in tray units (10 cm), for tray.js and tray-rubin.js. */
export const TRAY_PER_CM = 0.1;
export function trayPackage(id) {
  const p = GPU_PACKAGE[id], k = TRAY_PER_CM, s = o => ({ ...o, x: (o.x ?? 0) * k, z: (o.z ?? 0) * k, w: o.w * k, d: o.d * k });
  return {
    id, hbmEdge: p.hbmEdge, spare: p.hbm.spare,
    substrate: s({ ...p.substrate }), interposer: s({ ...p.interposer }), dies: p.dies.map(s),
    hbm: p.hbm.sites.map(([x, z], i) => ({ i, spare: p.hbm.spare === i, ...s({ x, z, w: p.hbm.w, d: p.hbm.d }) })),
    // the tray's heat-spreader frame follows the substrate
    frame: { w: p.substrate.w * k, d: p.substrate.d * k },
  };
}

/** What the Blender scripts read (references/gpu-package.json): the whole descriptor, centimeters. */
export function gpuPackageJson() {
  return { unit: 'cm', ...GPU_PACKAGE };
}

/**
 * What a level actually drew, recorded at the draw call with the numbers handed to the geometry (so a number typed
 * into a level instead of read from the descriptor shows up): each part's footprint and its centre relative to its
 * package, in the level's own units. gpu-package.test.ts compares this with the descriptor. The level hangs it on
 * scene.userData.gpuPackageDrawn.
 */
export function packageLog(perCm) {
  const parts = [];
  return { perCm, parts, note(gpu, kind, w, d, x, z) { parts.push({ gpu, kind, w, d, x, z }); } };
}
