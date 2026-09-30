// Representative manufacturing finish for compute scenes. No new signal paths,
// device counts, or vendor-specific assembly claims are introduced here.
import { THREE, MAT, surfaceDetail } from '../kit.js';
import { rbox } from '../fx.js';

export function computeMaterials() {
  const metal = (color, roughness, metalness, grain) => surfaceDetail(
    new THREE.MeshStandardMaterial({ color, roughness, metalness, envMapIntensity: 0.42 }),
    // surfaceDetail converts scene units to meters itself through DETAIL.unit.
    { meters: grain, amount: 0.025, roughness: 0.055, pattern: 'brushed' },
  );
  return {
    shell: metal(0xaeb8c3, 0.38, 0.72, 0.09),
    satin: metal(0xb4bec8, 0.44, 0.7, 0.035),
    copper: metal(0xb87543, 0.4, 0.78, 0.022),
    graphite: metal(0x3b4651, 0.48, 0.4, 0.035),
    // Named: compute-blender.js finds the board meshes by it and gives them the PCB surface (tray-pcb.js).
    pcb: Object.assign(new THREE.MeshStandardMaterial({ color: 0x102e2b, roughness: 0.5, metalness: 0.12 }), { name: 'Tray solder mask' }),
    laminate: new THREE.MeshStandardMaterial({ color: 0x73613d, roughness: 0.74, metalness: 0.05 }),
    silkscreen: new THREE.MeshStandardMaterial({ color: 0xa7b9b2, roughness: 0.85, metalness: 0 }),
    recess: new THREE.MeshStandardMaterial({ color: 0x090f15, roughness: 0.78, metalness: 0.15 }),
  };
}

// Replace only shared physical surface materials, leaving colored route guides,
// textured dies, status LEDs, and all animated flow materials intact.
export function finishCompute(scene, finish) {
  const replacements = new Map([
    [MAT.galv, finish.shell], [MAT.nickel, finish.satin],
    [MAT.copper, finish.copper], [MAT.pcb, finish.pcb],
    [MAT.rack, finish.graphite], [MAT.rackFace, finish.graphite],
  ]);
  scene.traverse(object => {
    if (!object.isMesh) return;
    const replace = material => replacements.get(material) || material;
    object.material = Array.isArray(object.material) ? object.material.map(replace) : replace(object.material);
  });
  scene.userData.computeFinish = 'Representative manufacturing details; functional topology unchanged';
}

// Folded tray lip, thin nickel cover with an inset seam, and captive heads.
// The original cold-plate footprint and coolant fittings remain authoritative.
export function coldPlateDetail(B, F, x, y, z, size, heavy) {
  rbox(B, size, 0.08, size, F.copper, x, y, z, { r: 0.22 });
  rbox(B, size * 0.86, 0.012, size * 0.86, F.recess, x, y + 0.048, z, { r: 0.2 });
  rbox(B, size * 0.8, 0.06, size * 0.8, F.satin, x, y + 0.07, z, { r: 0.2 });
  if (heavy) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const px = x + sx * size * 0.32, pz = z + sz * size * 0.32;
    B.cyl(0.023, 0.006, F.graphite, px, y + 0.103, pz, 12);
    B.box(0.023, 0.002, 0.005, F.satin, px, y + 0.107, pz);
  }
}

// Board perimeter lamination and tiny registration marks. These are mechanical
// board edges and silkscreen, not conductive traces or additional connectors.
export function boardFinish(B, F, x, y, z, w, d, scale = 1) {
  for (const side of [-1, 1]) {
    B.box(w, 0.007 * scale, 0.006 * scale, F.laminate, x, y, z + side * d / 2);
    B.box(0.006 * scale, 0.007 * scale, d, F.laminate, x + side * w / 2, y, z);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const px = x + sx * (w / 2 - 0.065 * scale), pz = z + sz * (d / 2 - 0.065 * scale);
    B.box(0.075 * scale, 0.002 * scale, 0.007 * scale, F.silkscreen, px - sx * 0.034 * scale, y + 0.012 * scale, pz);
    B.box(0.007 * scale, 0.002 * scale, 0.075 * scale, F.silkscreen, px, y + 0.012 * scale, pz - sz * 0.034 * scale);
  }
}
