import { SiteBuilder as Builder, preloadSiteConstruction, finalizeSiteGeometry, hasSiteConstruction } from './site-blender-construction.js';
// Architectural concept around the scenario's existing engineering layout.
// Units are metres. These facades, planting and canopies are illustrative;
// they do not add generation, cooling capacity, buildings or utility connections.
import { THREE, MAT, mtx, canvasTex, glowMat, surfaceDetail } from '../kit.js';
import { rbox } from '../fx.js';
import { campusWoodland } from './campus-landscape.js';

export function campusMaterials() {
  const metal = (color, roughness, metalness) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  return {
    panel: metal(0x344753, 0.48, 0.45),
    fin: metal(0xd5e1e3, 0.29, 0.55),
    bronze: metal(0xaf8d60, 0.35, 0.65),
    recess: metal(0x182b35, 0.68, 0.15),
    paving: surfaceDetail(metal(0x66777b, 0.86, 0), { meters: 2, amount: .18, roughness: .16 }),
    planted: metal(0x304e43, 1, 0),
    foliage: metal(0x426f59, 0.96, 0),
    foliageLight: metal(0x6a8770, 0.96, 0),
    roof: metal(0x889b9f, 0.73, 0.12),
    // Warm white architectural fixtures: distinguish them from colored data overlays.
    fixture: glowMat('#ffead1', 1.9),
  };
}

export function addCampusArchitecture({ scene, hallList, hallX0, hallX1, extra, quality, materials: M, authoredHall = false }) {
  const B = new Builder(), F = new Builder(), halls = [];
  const width = hallX1 - hallX0, cx = (hallX0 + hallX1) / 2;
  const roofY = 23.4; // Lower than dry-cooler fan caps (25.12 m). No roof cap over equipment.
  for (const [index, h] of hallList.entries()) {
    const cz = (h.z0 + h.z1) / 2;
    halls.push({ x0: hallX0, x1: hallX1, z0: h.z0, z1: h.z1, roofY, shellHeight: 22 });
    if (authoredHall) continue; // Blender supplies complete shell, facade and office, not trim over the old model.
    // Opaque data hall: no invented glass server walls. Segmented rainscreen,
    // projecting vertical fins, and a floating-looking but supported cornice.
    for (const z of [h.z0 - 0.25, h.z1 + 0.25]) {
      const side = z < cz ? -1 : 1;
      B.slab(width, 2.4, 0.25, M.recess, cx, 0.2, z);
      B.slab(width + 2.6, 1.1, 3.6, M.fin, cx, 21.15, z);
      B.slab(width, 0.55, 0.8, M.recess, cx, 20.6, z + side * 0.3);
      // Two-piece folded coping: a bevel catches the sky; the dark reveal separates layers.
      rbox(B, width + 3, .35, 4, M.fin, cx, roofY - .175, z, { r: .12 });
      B.box(width + 1, .09, .08, M.bronze, cx, roofY - .4, z + side * 1.82);
      // Flush opaque base panels and regular service-door reveals. Representative
      // enclosure detailing only: no glass server walls or added infrastructure.
      for (let x = hallX0 + 8; x < hallX1 - 6; x += 24) {
        B.box(2.2, 3.3, .12, M.panel, x, 1.95, z + side * .22);
        B.box(.045, 3.25, .14, M.fin, x - 1.13, 1.95, z + side * .24);
        B.box(.045, 3.25, .14, M.fin, x + 1.13, 1.95, z + side * .24);
        B.box(2.3, .06, .14, M.fin, x, 3.6, z + side * .24);
      }
      for (let x = hallX0 + 5; x < hallX1 - 4; x += 12) {
        // Folded, canted fins give the opaque envelope a sculpted silhouette.
        // They are facade members, not pipes or traces. Their bases stay on the plinth.
        const lean = Math.floor((x - hallX0) / 12) % 2 ? 0.1 : -0.1;
        B.box(0.6, 18, 2.35, M.fin, x, 11.2, z + side * 0.7, 0, 0, lean);
        B.box(0.18, 17.5, 2.5, M.bronze, x + 0.36, 11.2, z + side * 0.72, 0, 0, lean);
        // Mechanical louvers remain exposed in the recessed upper band.
        for (let y = 18; y < 20; y += 0.55) B.box(Math.min(10, hallX1 - x - 1), 0.1, 0.45, M.recess, x + Math.min(10, hallX1 - x - 1) / 2, y, z + side * 0.3);
      }
      // Discontinuous fixtures, clearly facade lighting rather than signal routes.
      for (let x = hallX0 + 7; x < hallX1 - 3; x += 12) F.box(9, 0.14, 0.18, M.fixture, x, 21, z + side * 1.8);
    }
    for (const x of [hallX0 - 0.45, hallX1 + 0.45]) {
      B.slab(1.4, 1.1, h.z1 - h.z0 + 1.7, M.fin, x, 21.15, cz);
      for (const z of [h.z0 + 2, h.z1 - 2]) B.slab(1.2, 21, 3, M.bronze, x, 0.15, z);
    }
    // West office stays within its authored 28 × 60 m footprint. Mullions and
    // brise-soleil sit on its glass, away from the hall-to-hall underground corridor.
    const west = hallX0 - 28.35;
    for (let z = cz - 28; z <= cz + 28; z += 3.5) B.slab(0.65, 15.3, 0.2, M.bronze, west, 0.3, z);
    for (const y of [5.3, 10.4, 15.5]) B.box(0.9, 0.16, 60, M.fin, west, y, cz);
    B.slab(30, 0.5, 63, M.fin, hallX0 - 14, 16.8, cz);
    // A supported crown over the existing office wing, not a new floor.
    B.slab(34, 0.65, 65, M.fin, hallX0 - 15, 19.1, cz);
    for (const z of [cz - 29, cz + 29]) {
      for (const x of [hallX0 - 28, hallX0 - 2]) B.slab(0.35, 2.3, 0.35, M.bronze, x, 16.8, z);
      F.box(29, 0.14, 0.16, M.fixture, hallX0 - 15, 18.95, z);
    }
    // Two entry canopies, supported at the corners, outside the utility corridor.
    for (const z of [cz - 21, cz + 21]) {
      rbox(B, 9, .35, 9, M.fin, west - 4, 4.975, z, { r: .14 });
      // Exposed canopy underside and warm recessed light slots, aligned to the entry.
      B.box(8.4, .08, 8.4, M.recess, west - 4, 4.78, z);
      for (const dz of [-2.6, 2.6]) F.box(6.4, .06, .1, M.fixture, west - 4, 4.72, z + dz);
      for (const dz of [-4, 4]) B.slab(0.25, 4.8, 0.25, M.bronze, west - 8, 0.15, z + dz);
      B.slab(12, 0.12, 12, M.paving, west - 4.5, 0.16, z);
    }
    const sign = canvasTex(512, 128, (g, w, height) => {
      g.fillStyle = '#182b35'; g.fillRect(0, 0, w, height);
      g.fillStyle = '#e0eeee'; g.font = '600 64px sans-serif'; g.textAlign = 'left';
      g.fillText(`HALL ${String(index + 1).padStart(2, '0')}`, 24, 88);
    });
    const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(17, 4.25),
      new THREE.MeshStandardMaterial({ map: sign, roughness: 0.7, emissiveMap: sign, emissive: 0xffffff, emissiveIntensity: 0.15 }));
    signMesh.position.set(hallX1 - 15, 12, h.z1 + 1.1);
    scene.add(signMesh);
  }

  // Parking shade structures, not photovoltaic arrays. No new energy claim.
  // Columns between parking bays; the 10 m centre drive remains open.
  for (const z of [155, 185]) {
    rbox(B, 150, .35, 11.5, M.fin, 0, 5.375, z, { r: .14 });
    // Slim underside ribs add construction detail without lowering vehicle clearance.
    for (let x = -70.4; x <= 70.4; x += 9.6) B.box(.11, .22, 10.7, M.recess, x, 5.08, z);
    B.slab(150, 0.3, 0.5, M.bronze, 0, 5.55, z + 5.4);
    for (let x = -70.4; x <= 70.4; x += 19.2) {
      for (const dz of [-4.8, 4.8]) B.slab(0.28, 5.2, 0.28, M.recess, x, 0.2, z + dz);
    }
    for (let x = -66; x <= 66; x += 12) F.box(8, 0.12, 0.15, M.fixture, x, 5.13, z + 5.5);
  }

  // Arrival portal spans the existing staffed gate, with every support outside
  // the vehicle corridor. Underside > 6 m; no bridge or utility connection.
  for (const x of [-123, -88]) {
    B.slab(0.7, 7.3, 0.7, M.bronze, x, 0.15, 233);
    B.slab(1.8, 0.5, 1.8, M.paving, x, 0.15, 233);
  }
  rbox(B, 40, .65, 10, M.fin, -106, 7.6, 233, { r: .2 });
  B.box(37, .1, 8.5, M.recess, -106, 7.22, 233);
  F.box(35, 0.12, 0.15, M.fixture, -106, 7.15, 237.7);
  // A freestanding identification blade at the arrival garden; no equipment claim.
  B.slab(1.4, 11, 7, M.recess, -137, 0.15, 215);
  const identity = canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = '#162b34'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#d7b481'; g.fillRect(26, 44, 112, 8); g.fillRect(26, 61, 72, 8);
    g.fillStyle = '#f1f4ef'; g.font = '600 27px sans-serif';
    ['THE', 'INTELLIGENCE', 'FACTORY'].forEach((line, i) => g.fillText(line, 24, 177 + i * 42));
    g.fillStyle = '#9ab7b9'; g.font = '20px sans-serif'; g.fillText('CAMPUS', 24, 408);
  });
  const identitySign = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 10.1), new THREE.MeshStandardMaterial({
    map: identity, emissiveMap: identity, emissive: 0xffffff, emissiveIntensity: 0.3, roughness: 0.6,
  }));
  identitySign.rotation.y = -Math.PI / 2; identitySign.position.set(-137.76, 5.7, 215); scene.add(identitySign);

  // Low planted areas occupy unused pedestrian space; they stop short of roads,
  // fiber entrances, battery pads, generator yards, and hall service faces.
  const gardens = [
    { x: 10, z: 216, w: 138, d: 16 },
    { x: 157, z: 183, w: 115, d: 66 },
    { x: -175, z: 72, w: 55, d: 105 },
    { x: -480, z: 130, w: 160, d: 170 },
  ];
  const treeMx = [];
  for (const garden of gardens) {
    B.slab(garden.w + 1.2, 0.24, garden.d + 1.2, M.paving, garden.x, 0.15, garden.z);
    B.slab(garden.w, 0.12, garden.d, M.planted, garden.x, 0.4, garden.z);
    const step = quality.mobile ? 16 : 12;
    for (let x = garden.x - garden.w / 2 + 7; x < garden.x + garden.w / 2 - 5; x += step) {
      for (const z of [garden.z - garden.d / 2 + 7, garden.z + garden.d / 2 - 7]) treeMx.push(mtx(x + Math.sin(x * .5), 0.5, z + Math.cos(x) * 1.5, x * 0.13, 0.55 + (Math.sin(x) + 1) * 0.12));
    }
  }
  // Terraced planting in the large west garden. Paved paths and planted bands
  // make this a landscape, with clear circulation rather than rows on a rectangle.
  for (let i = 0; i < 4; i++) {
    const x = -535 + i * 36;
    B.slab(3.6, 0.13, 151, M.paving, x, 0.52, 130);
    B.slab(24, 0.35, 10, M.planted, x + 17, 0.52, 88 + (i % 2) * 45);
    for (const z of [64, 110, 156, 202]) {
      B.slab(0.25, 1.1, 0.25, M.bronze, x - 2.2, 0.55, z);
      F.box(0.3, 0.14, 0.3, M.fixture, x - 2.2, 1.65, z);
    }
  }
  // Sculpted planted berms provide foreground depth, below sightlines into yards.
  const berm = new THREE.SphereGeometry(1, quality.mobile ? 12 : 20, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  for (const [x, z, sx, sy, sz] of [[145, 183, 34, 1.9, 18], [-175, 65, 16, 1.6, 29]]) B.add(berm, M.planted, x, 0.52, z, 0, 0, 0, sx, sy, sz);
  // A pedestrian strip and warm bollards along the front garden.
  B.slab(140, 0.1, 3, M.paving, 10, 0.16, 230);
  for (let x = -55; x < 80; x += 14) {
    B.slab(0.25, 0.9, 0.25, M.recess, x, 0.25, 229);
    F.box(0.3, 0.12, 0.3, M.fixture, x, 1.1, 229);
  }
  const architecture = B.build({ cast: true, receive: true });
  architecture.name = 'Campus concept architecture';
  scene.add(architecture, F.build({ cast: false, receive: false }));
  const updateGardens = campusWoodland(scene, treeMx, quality);
  scene.userData.campusArchitecture = {
    representative: true, detailedHalls: halls, additionalHallCount: extra,
    gardens, roofFeatureMaxY: roofY,
    roads: [{ x0: -400, x1: 360, z0: -63, z1: -47 }, { x0: -118, x1: -102, z0: -75, z1: 255 }, { x0: 254, x1: 270, z0: -185, z1: 65 }],
  };
  return updateGardens;
}
