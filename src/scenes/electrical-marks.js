// Electrical nameplates, voltage stencils and hazard signs on the power equipment drawn in the campus, hall and
// rack scenes. Every figure printed comes from the model (its voltage staircase and the cards' ratings); signs carry
// no incident-energy or boundary figures. Placements are found by casting a ray at the equipment and printing on
// the first surface hit, so the marks sit on the authored surfaces they label.
import { printDecals, plateTexture, warningTexture, stencilTexture, textTexture, stick } from './print-kit.js';

const volts = (model, where) => model.staircase.find(s => s.where === where)?.label;
const hv = () => warningTexture([{ text: 'DANGER', size: .34, weight: 800 }, { text: 'HIGH VOLTAGE', size: .3, weight: 700 }]);
const arc = () => warningTexture([{ text: 'WARNING', size: .34, weight: 800 }, { text: 'ARC FLASH HAZARD', size: .26, weight: 700 }]);
const sign = (scene, texture, size, placements, name) => printDecals(scene, { texture, size, placements: placements.filter(Boolean), lift: .004, name,
  material: { roughness: .55 } });
const notHelper = o => !o.userData?.printed && !/Flow|route|halo|dash|glow/i.test(o.name || '') && !o.material?.isMeshBasicMaterial;

/** Campus: main power transformers (ID, voltage pair, unit rating) and the 34.5 kV switchgear e-houses. */
export function campusMarks(scene, model, { mptX, mptZ, ehouses }) {
  // Rays test only the equipment they label (the merged site geometry is far too large to ray-test whole).
  const mpt = scene.getObjectByName('Blender main transformers'), eh = scene.getObjectByName('Blender EHOUSE');
  const on = (root, ...a) => root ? stick(root, ...a) : null;
  const hvLine = volts(model, 'Transmission line') || '345 kV', mv = volts(model, 'Campus feeders') || '34.5 kV';
  const pair = `${hvLine.replace(' kV', '')} / ${mv}`;
  mptZ.forEach((z, i) => {
    // On the tank's plain long face toward the yard road (+z): radiators and fans line the other faces.
    const plate = on(mpt, [mptX + 1.1, 3.5, z + 10], [0, 0, -1], notHelper);
    sign(scene, plateTexture([{ text: `MAIN POWER TRANSFORMER T${i + 1}`, size: .22, weight: 700 }, { text: pair, size: .3, weight: 700 }, { text: `${model.layout.mvaUnit} MVA`, size: .22 }], { aspect: 2 }),
      [1.3, .65], [plate], `Main transformer T${i + 1} nameplate`);
    sign(scene, hv(), [.9, .38], [on(mpt, [mptX + 2.15, 3.5, z + 10], [0, 0, -1], notHelper, { footprint: [.9, .38] })], `Main transformer T${i + 1} hazard sign`);
  });
  ehouses.forEach(([x, z], i) => {
    // Between the wall-mounted HVAC units (every 8 m from 12 m off centre); signs sit on the wall ribs' crests.
    sign(scene, plateTexture([{ text: `${mv} SWITCHGEAR`, size: .34, weight: 700 }, { text: `E-HOUSE ${String.fromCharCode(65 + i)}`, size: .26 }], { aspect: 3.2 }),
      [2.6, .8], [on(eh, [x + 12, 3.0, z], [-1, 0, 0], notHelper, { footprint: [2.6, .8] })], `Switchgear e-house ${i + 1} nameplate`);
    sign(scene, hv(), [1.0, .42], [on(eh, [x + 12, 1.7, z - 1.6], [-1, 0, 0], notHelper, { footprint: [1, .42] })], `Switchgear e-house ${i + 1} hazard sign`);
    sign(scene, arc(), [1.0, .42], [on(eh, [x + 12, 1.7, z + 1.6], [-1, 0, 0], notHelper, { footprint: [1, .42] })], `Switchgear e-house ${i + 1} arc-flash sign`);
  });
}

/** Hall: the unit substation, the switchgear lineup and the busways (415 V or 800 V DC). */
export function hallMarks(scene, model, { usX, usZ, swgr, busways }) {
  const dc = model.power.id === 'dc800', mv = volts(model, 'Campus feeders') || '34.5 kV';
  const us = scene.getObjectByName('Blender hall finish HALL_UNITSUB'), sw = scene.getObjectByName('Blender HALL_SWGR_SECTION');
  const on = (root, ...a) => root ? stick(root, ...a) : null;
  const lv = '480 V', bus = dc ? (volts(model, 'DC busway to the rack') || '800 V DC') : (volts(model, 'Busway to the rack') || '415 V');
  // Unit substation: the 2.5 MVA rating is the card's (ASSUMPTIONS unitsub-mva).
  sign(scene, plateTexture([{ text: 'UNIT SUBSTATION', size: .22, weight: 700 }, { text: `${mv} / ${lv}`, size: .3, weight: 700 }, { text: '2.5 MVA', size: .22 }], { aspect: 2 }),
    [.56, .28], [on(us, [usX - 12, 1.75, usZ - .4], [1, 0, 0], notHelper)], 'Unit substation nameplate');
  sign(scene, hv(), [.48, .2], [on(us, [usX - 12, 1.25, usZ - .4], [1, 0, 0], notHelper)], 'Unit substation hazard sign');
  // Switchgear lineup: one lineup plate, arc-flash warnings on alternate sections.
  const { x0, w, n, zFront } = swgr;
  sign(scene, plateTexture([{ text: dc ? `${mv} SWITCHGEAR` : `${lv} SWITCHGEAR`, size: .42, weight: 700 }, { text: 'LINEUP 1', size: .3 }], { aspect: 3.2 }),
    [.62, .19], [on(sw, [x0 + w * .5, 2.17, zFront + 2], [0, 0, -1], notHelper, { footprint: [.62, .19] })], 'Switchgear lineup nameplate');
  const arcs = [];
  // below each door's instrument window, clear of its handle
  for (let i = 1; i < n; i += 3) arcs.push(on(sw, [x0 + (i + .5) * w - .08, 1.36, zFront + 2], [0, 0, -1], notHelper, { footprint: [.3, .125] }));
  sign(scene, arc(), [.3, .125], arcs, 'Switchgear arc-flash signs');
  // Busway stencils along each run on both faces, so the runs read from either aisle (plain housings: the
  // faces are known, no ray needed).
  const stencils = [];
  for (const { from, to, y, z, depth } of busways) {
    for (let x = from + 1.2; x < to - .6; x += 6) for (const f of [1, -1]) stencils.push({ p: [x, y, z + f * depth / 2], n: [0, 0, f] });
  }
  printDecals(scene, { texture: stencilTexture([{ text: `${bus}${dc ? '' : ' AC'}`, size: .8, weight: 700 }], { ink: '#232629' }), size: [.5, .125],
    placements: stencils.filter(Boolean), lift: .003, name: 'Busway voltage stencils', material: { roughness: .6 } });
}

/** Rack: the busway over the rack and, on NVL72 racks, a voltage tag on the DC busbar. */
export function rackMarks(scene, model, { busway, busbar, root = scene }) {
  const dc = model.power.id === 'dc800';
  const bus = dc ? (volts(model, 'DC busway to the rack') || '800 V DC') : `${volts(model, 'Busway to the rack') || '415 V'} AC`;
  const { x0, x1, y, zFront } = busway;
  const marks = [];
  for (const x of [x0 + .2, x1 - .38]) marks.push(stick(root, [x, y, zFront + 2], [0, 0, -1], notHelper));
  printDecals(scene, { texture: stencilTexture([{ text: bus, size: .8, weight: 700 }], { ink: '#24282c' }), size: [.2, .05],
    placements: marks.filter(Boolean), lift: .0008, name: 'Busway voltage stencils', material: { roughness: .6 } });
  if (busbar) {
    const label = model.staircase.find(s => s.where === 'Rack busbar')?.label;   // '50 V'
    // A small tag on one bar's rear face, in the gap between two trays' contact lands.
    if (label) printDecals(scene, { texture: textTexture([{ text: `≈${label}`, size: .4, weight: 800 }, { text: 'DC', size: .3, weight: 800 }], { px: 96, aspect: 1, ink: '#141414', align: 'center', plate: '#f2c230' }),
      size: [.021, .021], placements: [{ p: busbar.p, n: busbar.n }], lift: .0008, name: 'Busbar voltage tag', material: { roughness: .55 } });
  }
}
