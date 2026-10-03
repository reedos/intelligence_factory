// Campus layout: the hall/substation/cooling/plant placement math shared by the campus level
// (campus.js, the authoritative scale-site drawing) and the across level's campus miniature
// (across.js). Pulling this out of campus.js stops the two from drifting apart: a change to hall
// sizing or count here changes both drawings together. Units are meters; x runs east, z runs south
// (campus.js's own convention), origin at the substation/hall complex, same as campus.js always used.
//
// campusFootprint(model) returns the same geometry campus.js's build() used to compute inline from
// its `model` argument (quality/model passed to every scene's build()). campusBounds(F) adds the
// overall footprint box (every component: halls, substation, cooling plant, generator/battery/fuel
// yards) that the across level's miniature fits itself into.

export function campusFootprint(model) {
  const L = model.layout, warm = model.cooling.id === 'warm';
  const batteryYard = model.backup === 'battery', closed = model.closedLoop;
  const nHalls = Math.min(2, model.halls), extra = Math.max(0, model.halls - 2);
  // Additional representative hall envelopes repeat east of the detailed utility plant.
  const perCol = Math.min(12, Math.max(2, Math.ceil(Math.sqrt(extra / 1.2)))), cols = Math.ceil(extra / perCol);
  const reach = extra ? 620 + cols * 320 : 0;
  const extentWest = -1100, extentEast = extra ? 750 + (cols - 1) * 320 + 132 : 440, span = extentEast - extentWest;
  const hallLen = nHalls === 1 ? Math.round(Math.max(70, Math.min(260, 260 * model.IT_MW / 45))) : 260;
  const hallX0 = -30, hallX1 = hallX0 + hallLen, hcx = (hallX0 + hallX1) / 2;
  const hallA = { z0: -215, z1: -125 }, hallB = { z0: 15, z1: 105 };
  const hallList = [hallA, hallB].slice(0, nHalls);
  const towerRows = closed ? [] : warm ? [-275] : [-275, -290];
  const plantX = Math.max(hallX0 + 45, Math.min(100, hcx + 20));
  return {
    warm, batteryYard, closed, nHalls, extra, perCol, cols, reach,
    extentWest, extentEast, span, hallLen, hallX0, hallX1, hcx, hallA, hallB, hallList,
    towerRows, plantX,
    // fixed-position plant: the substation yard (fence envelope), main transformer row, generator
    // and fuel-tank yards, battery yards. Positions as campus.js draws them.
    substation: { x0: -567, x1: -357, z0: -235, z1: -65 },
    gantryX: -548, mptX: -418,
    genset: L.gensets ? { x0: 283, x1: 283 + 4 * 21 + 12, blocks: [{ z0: -210, z1: -205 + 4 * 8 }, { z0: 15, z1: 20 + 4 * 8 }] } : null,
    fuel: L.gensets ? { x0: 384, x1: 417, z0: -129, z1: -75 } : null,
    bessYard: { x0: -340, x1: -290, z0: 48, z1: 103 },
    bigBattery: batteryYard ? { x0: 281, x1: 292 + 13 * 9, z0: -212, z1: -206 + 8 * 13 } : null,
    fiberA: [-150, 238], fiberB: [455, -300],
  };
}

// Every data hall's center and x-length (meters): the two detailed halls plus, on a campus with
// more than two, the representative envelope halls campus.js repeats east of the utility plant
// (its own addBlenderCampusExpansion / expansionMatrices). The campus level draws the detailed
// pair from this directly; the across level's miniature draws every cell the same way, just
// smaller, so a big campus's hall count and arrangement still show up at that scale.
export function campusHallCells(F) {
  const cells = F.hallList.map(h => ({ x: F.hcx, z: (h.z0 + h.z1) / 2, len: F.hallLen }));
  if (F.extra) {
    const z0 = -55 - (F.perCol - 1) * 120 / 2;
    for (let i = 0; i < F.extra; i++) cells.push({ x: 750 + Math.floor(i / F.perCol) * 320, z: z0 + (i % F.perCol) * 120, len: 260 });
  }
  return cells;
}

// Overall footprint box in meters, every drawn component included, for the across level's miniature
// to size and orient itself from.
export function campusBounds(F) {
  const cells = campusHallCells(F);
  const xs = [F.substation.x0, F.hallX0 - 28, ...cells.map(c => c.x + c.len / 2 + 14), ...cells.map(c => c.x - c.len / 2)];
  const zs = [F.substation.z0, F.substation.z1, ...cells.map(c => c.z - 45 - 20), ...cells.map(c => c.z + 45 + 20)];
  if (F.towerRows.length) { xs.push(9, 87); zs.push(Math.min(...F.towerRows) - 15, Math.max(...F.towerRows) + 15); }
  if (!F.warm) xs.push(F.plantX + 31); zs.push(-250);
  if (F.genset) { xs.push(F.genset.x1); F.genset.blocks.forEach(b => zs.push(b.z0, b.z1)); }
  if (F.fuel) xs.push(F.fuel.x1);
  xs.push(F.bessYard.x0, F.bessYard.x1); zs.push(F.bessYard.z0, F.bessYard.z1);
  if (F.bigBattery) { xs.push(F.bigBattery.x1); zs.push(F.bigBattery.z0, F.bigBattery.z1); }
  return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
}
