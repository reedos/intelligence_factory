// Building and equipment identifiers: hall names on the hall end walls, OPERATIONS on the office wings, SUBSTATION on
// the substation control house, the fiber vault lids, hall rack labels and rack-rail U numbers. Designations
// (HALL A, ROW 3 · R12, U numbers) are representative names, not a site's numbering (ASSUMPTIONS 'site-ids').
import { printDecals, printAtlas, stencilTexture, plateTexture, textTexture, stick } from './print-kit.js';

const sign = (scene, texture, size, placements, name, material = { roughness: .6 }) =>
  printDecals(scene, { texture, size, placements: placements.filter(Boolean), lift: .02, name, material });

/** Campus: hall names, OPERATIONS on the office wings, SUBSTATION, and the fiber vault lids. */
export function campusSigns(scene, { halls, hallX0, hallX1, fibers }) {
  halls.forEach((h, i) => {
    const cz = (h.z0 + h.z1) / 2, hall = scene.getObjectByName(`Blender campus hall ${i + 1}`), office = scene.getObjectByName(`Blender campus office ${i + 1}`);
    const name = `HALL ${String.fromCharCode(65 + i)}`;
    // on the east end wall and high on the long south facade, near the office end
    if (hall) sign(scene, stencilTexture([{ text: name, size: .82, weight: 700 }], { aspect: 3.4, ink: '#dfe3e6' }), [12, 3.5],
      [stick(hall, [hallX1 + 60, 15.5, cz], [-1, 0, 0]), stick(hall, [hallX0 + 26, 18.5, h.z1 + 60], [0, 0, -1])], `${name} lettering`);
    if (office) sign(scene, stencilTexture([{ text: 'OPERATIONS', size: .8, weight: 600 }], { aspect: 6, ink: '#e6e8ea' }), [11, 1.8],
      [stick(office, [office.position.x, 12.5, h.z1 + 60], [0, 0, -1])], `${name} office lettering`);
  });
  const house = scene.getObjectByName('Blender CTRL_HOUSE');
  if (house) sign(scene, plateTexture([{ text: 'SUBSTATION', size: .44, weight: 700 }, { text: 'CONTROL HOUSE', size: .3 }], { aspect: 3 }), [3, 1],
    [stick(house, [-470, 3.0, -82], [-1, 0, 0])], 'Substation control house sign');
  // Cast into the vault lids, as communications vault covers are.
  printDecals(scene, { texture: textTexture([{ text: 'FIBER', size: .38, weight: 800 }, { text: 'ENTRANCE', size: .3, weight: 800 }], { px: 128, aspect: 2, ink: '#9aa1a8', align: 'center' }),
    size: [1.0, .5], placements: fibers.map(([x, z]) => ({ p: [x, .785, z], face: 'top' })), lift: .004, name: 'Fiber vault lid lettering', material: { roughness: .7, metalness: .4 } });
}

/** Hall: a label at the top of every rack's front ("ROW 3" over "R12") and the hall's name on its back wall. */
export function hallIds(scene, { rackMx, rowZs, rowX0, h = 2.3, d = 1.2, wall }) {
  const placements = rackMx.map(it => {
    const row = rowZs.indexOf(it.z) + 1, inRow = rackMx.filter(r => r.z === it.z), n = inRow.indexOf(it) + 1;
    return { p: [it.x, h - .085, it.z + it.f * (d / 2 + .045)], n: [0, 0, it.f], text: `ROW ${row} · R${String(n).padStart(2, '0')}` };
  });
  printAtlas(scene, { placements, size: [.46, .07], cell: [384, 64], lines: t => [{ text: t, size: .62, weight: 700 }],
    text: { ink: '#e4e8ec', plate: '#1d2228' }, lift: .002, name: 'Rack labels', material: { roughness: .55 } });
  if (wall) printDecals(scene, { texture: stencilTexture([{ text: 'HALL A', size: .8, weight: 700 }], { aspect: 3.4, ink: '#cfd4d8' }), size: [4.2, 1.2],
    placements: [{ p: wall.p, n: [0, 0, 1] }], lift: .01, name: 'Hall name on the back wall', material: { roughness: .7 } });
  void rowX0;
}

/** Rack: U numbers on both front mounting posts, beside the trays, one per U counted from the bottom. */
export function rackUnits(scene, { X, ZF, U, H }) {
  const placements = [];
  for (let u = 2; u < 46; u++) for (const x of [-X + 0.05, X - 0.05]) {
    const y = 0.06 + u * U + U / 2;
    if (y > H - .1) continue;
    placements.push({ p: [x, y, ZF - 0.054], n: [0, 0, 1], text: String(u - 1) });
  }
  printAtlas(scene, { placements, size: [.0105, .0066], cell: [64, 40], lines: t => [{ text: t, size: .8, weight: 700 }],
    text: { ink: '#1f2327' }, lift: .0006, name: 'Rack rail U numbers', material: { roughness: .5 } });
}
