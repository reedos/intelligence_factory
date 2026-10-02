// Pipe markers on the cooling water: facility headers, their risers and the drops to every CDU in the hall, and the
// rack loop's manifolds in the rack. ASME A13.1 style: cooling water is marked green with white letters, with an
// arrow for the flow direction (ASSUMPTIONS 'pipe-markers'; summary in projectmaterials-asme-a13-1). The pipe colours
// themselves stay the legend's blue (supply) and red (return).
import { pipeMarkers, pipeMarkerTexture, printDecals } from './print-kit.js';

/** What the facility loop is called in this cooling design. */
export function facilityWater(cooling) {
  return cooling?.id === 'warm' ? 'FACILITY WATER' : 'CHW';
}

const markerSet = (parent, { text, radius, length, letter, flow, placements, name }) =>
  pipeMarkers(parent, { texture: pipeMarkerTexture(text, { length, radius, letter, flow }), radius, length, placements, name });

/** Hall: supply and return headers along the back wall, their risers, and the drops to each CDU. */
export function hallPipeMarks(scene, model, { X0, hdrY, headerEndX, returnRiserZ, cduMx, risers }) {
  const loop = facilityWater(model.cooling), long = loop.length > 3;
  const rH = .26 * 1.03 + .002, LH = long ? 1.55 : .95;
  const along = [];
  for (let x = X0 + 9; x < headerEndX - 1.2; x += 12) along.push(x);
  // Headers: supply flows east from its riser toward the rows, return flows west back to its riser.
  markerSet(scene, { text: `${loop} SUPPLY`, radius: rH, length: LH, letter: .09, flow: 1, name: 'Facility supply header markers',
    placements: along.map(x => ({ p: [x, hdrY, -16.4], axis: [1, 0, 0] })) });
  markerSet(scene, { text: `${loop} RETURN`, radius: rH, length: LH, letter: .09, flow: -1, name: 'Facility return header markers',
    placements: along.map(x => ({ p: [x + 6, hdrY - .7, -16.4], axis: [1, 0, 0] })).filter(pl => pl.p[0] < headerEndX - 1.2) });
  if (risers) {
    // Risers read bottom to top: supply comes down from the roof, return goes up to it.
    const LR = long ? 1.2 : .6;
    markerSet(scene, { text: `${loop} SUPPLY`, radius: rH, length: LR, letter: .08, flow: -1, name: 'Facility supply riser marker',
      placements: [{ p: [X0 + 2, Math.min(7.38, hdrY + .78 + LR / 2 + .05), -16.4], axis: [0, 1, 0] }] });
    markerSet(scene, { text: `${loop} RETURN`, radius: rH, length: LR, letter: .08, flow: 1, name: 'Facility return riser marker',
      placements: [{ p: [X0 + 2.8, 7.0, returnRiserZ], axis: [0, 1, 0] }] });
  }
  // CDU drops: supply down into each unit, return up out of it.
  const rD = .07 * 1.08 + .001, LD = long ? .85 : .45;
  markerSet(scene, { text: `${loop} SUPPLY`, radius: rD, length: LD, letter: .034, flow: -1, name: 'CDU supply drop markers',
    placements: cduMx.map(c => ({ p: [c.x - .15, 3.6, c.z], axis: [0, 1, 0] })) });
  markerSet(scene, { text: `${loop} RETURN`, radius: rD, length: LD, letter: .034, flow: 1, name: 'CDU return drop markers',
    placements: cduMx.map(c => ({ p: [c.x + .15, 3.6, c.z], axis: [0, 1, 0] })) });
}

/**
 * Rack: the technology cooling system (the rack loop) on the two manifolds' rear faces, read bottom to top.
 * The rack is top-fed (rack.js): supply enters at the head and falls; return rises to the head.
 * manifolds: [{ x, y, p (surface point), side }].
 */
export function rackManifoldMarks(scene, manifolds) {
  for (const { p, side } of manifolds) {
    const supply = side === 0, length = .17, half = .036;
    const texture = pipeMarkerTexture(supply ? 'TCS SUPPLY' : 'TCS RETURN', { length, radius: half / Math.PI, letter: .0125, flow: supply ? -1 : 1, px: 256 });
    printDecals(scene, { texture, size: [length, half], placements: [{ p, n: [0, 0, -1], roll: Math.PI / 2 }], lift: .0008,
      name: `Rack ${supply ? 'supply' : 'return'} manifold marker`, material: { roughness: .5 } });
  }
}
