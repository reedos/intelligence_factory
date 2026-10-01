// Multimode short-reach links and 1:2 splitter (breakout) fiber cables at one leaf switch, drawn as one
// representative instance in the data hall (ASSUMPTIONS 'hall-multimode-breakout').
//
// Published (NVIDIA LinkX documentation, see sources.js):
//   - MMA4Z00-NS, the twin-port 800G (2 x 400G SR4) switch module: OM3 2-30 m, OM4 2-50 m, two MPO-12/APC
//     connectors, "Multimode optics is denoted by a tan-colored pull tab" (nvidia-mma4z00-ns-specs).
//   - MMA4Z00-NS400, the single-port 400G SR4 adapter module: "850nm VCSEL", flat top, "tan-colored pull tab
//     and aqua-colored optical fiber"; on a 1:2 splitter end it lights 2 channels and runs at 200G
//     (nvidia-mma4z00-ns400-datasheet).
//   - MFP7E20 (multimode) / MFP7E40 (single-mode): one 4-channel MPO-12/APC end split into two 2-channel ends;
//     two splitters per twin-port module reach four adapters; both of a twin-port's ports must be the same
//     type, straight or splitter; aqua (multimode) or yellow (single-mode) jacket; green MPO-12/APC shell
//     (nvidia-mfp7e20-splitter, nvidia-mfp7e40-splitter).
// Representative here: which leaf port, which racks the ends land in, the end modules' slot in the rack, where
// along the cable the split happens, cable routing and the drawn cable thickness (about twice the published
// 3 mm so it reads at hall scale, like the yellow jumpers beside it).
import { THREE, Builder, textSprite } from '../kit.js';
import { managedRoute, HALL_RUNWAY } from './fiber-routing.js';

// leaf row and ports used: the second QM9700 in the row-end rack of the second row (z = -8.2), whose ports
// carry no rack jumpers in this layout (the first chassis takes the 32 racks of the row)
const ROW = 1, STRAIGHT_C = 6, SPLIT_C = 10, TOP = 32 + 16;
export const breakoutDrawn = model => model.accel.nicPortGbps === 400 && model.accel.gpusPerRack === 72;
// switch ports whose black pull tab gives way to the multimode module's tan one
export function multimodeTabKeys(model, leafX, rowZs) {
  if (!breakoutDrawn(model)) return new Set();
  return new Set([TOP + STRAIGHT_C].map(i => `${leafX}:${rowZs[ROW]}:${i}`));
}

// A smooth cable: rings at every route point, oriented by a parallel-transported frame and the joint bisector,
// so rounded corners read as one bent jacket instead of a chain of cylinders.
const _I = new THREE.Matrix4();
function polyTube(points, r, radial) {
  const P = points.map(p => new THREE.Vector3(...p)).filter((p, i, a) => !i || p.distanceTo(a[i - 1]) > 1e-5);
  const n = P.length, pos = [], nor = [], idx = [];
  const T = P.map((p, i) => {
    const a = i ? p.clone().sub(P[i - 1]).normalize() : null, b = i < n - 1 ? P[i + 1].clone().sub(p).normalize() : null;
    return a && b ? a.add(b).normalize() : (a || b);
  });
  let N = new THREE.Vector3(0, 1, 0); if (Math.abs(N.dot(T[0])) > .9) N.set(1, 0, 0);
  N.sub(T[0].clone().multiplyScalar(N.dot(T[0]))).normalize();
  for (let i = 0; i < n; i++) {
    if (i) { const q = new THREE.Quaternion().setFromUnitVectors(T[i - 1], T[i]); N.applyQuaternion(q).normalize(); }
    const Bn = new THREE.Vector3().crossVectors(T[i], N);
    for (let k = 0; k < radial; k++) {
      const t = k / radial * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
      const d = N.clone().multiplyScalar(c).addScaledVector(Bn, s);
      pos.push(P[i].x + d.x * r, P[i].y + d.y * r, P[i].z + d.z * r); nor.push(d.x, d.y, d.z);
    }
  }
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < radial; k++) {
    const a = i * radial + k, b = i * radial + (k + 1) % radial, c = a + radial, d = b + radial;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx);
  return g;
}

const AQUA = 0x37c6c0;                          // industry-standard multimode jacket colour (published: "Aqua")
const mats = () => ({
  aqua: new THREE.MeshStandardMaterial({ color: AQUA, roughness: .42, metalness: .05, name: 'Multimode fiber jacket (aqua)' }),
  green: new THREE.MeshStandardMaterial({ color: 0x3fae4a, roughness: .45, metalness: .05, name: 'MPO-12/APC shell (green)' }),
  boot: new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: .6, metalness: .05, name: 'Connector boot' }),
  tan: new THREE.MeshStandardMaterial({ color: 0xc9a77a, roughness: .55, metalness: .05, name: 'Multimode pull tab (tan)' }),
  metal: new THREE.MeshStandardMaterial({ color: 0xcfd3d8, roughness: .28, metalness: .85, name: 'OSFP shell' }),
  band: new THREE.MeshStandardMaterial({ color: 0xe9ecef, roughness: .5, metalness: 0, name: 'Splitter label band' }),
});

export function buildBreakout({ model, scene, layer, leafX, rowZs, ports, racks, quality }) {
  if (!breakoutDrawn(model) || !ports || ports.length < 64) return null;
  const M = mats(), B = new Builder(), rowZ = rowZs[ROW], seg = quality.mobile ? 6 : 8;
  const group = new THREE.Group(); group.name = 'Multimode links and 1:2 splitters (representative)';
  const cable = (pts, r) => { const p = managedRoute(pts, .03); B.addM(polyTube(p, r, seg), M.aqua, _I); return p; };
  // switch side: tan pull tab under the module (the chassis skips its black one here), two green MPO shells
  const switchModule = port => {
    const [x, y, z] = port.point, f = port.f;
    B.box(.0046, .0036, .032, M.tan, x, y - .0045, z - f * .002);
    B.box(.0058, .0026, .006, M.tan, x, y - .0058, z + f * .016);               // the tab's finger loop
    return [-1, 1].map(s => {
      const cx = x + s * .005;                                                     // two MPO-12 receptacles, 10 mm apart
      B.box(.0074, .0052, .014, M.green, cx, y + .0012, z - f * .003);
      B.box(.0056, .0042, .012, M.boot, cx, y + .0012, z + f * .0095);
      return [cx, y + .0012, z + f * .0155];
    });
  };
  // adapter side: a flat-top single-port 400G OSFP (tan tab) in a GB200 tray front, two trays under the
  // rack's drawn scale-out module, with its green MPO shell and boot
  const adapterEnd = k => {
    const f = k.f, x = k.x + .2, y = 1.333375 - 2 * .0445, z = k.z + f * .62;
    B.box(.0226, .013, .035, M.metal, x, y, z);
    B.box(.005, .0034, .03, M.tan, x, y - .0047, z + f * .016);
    B.box(.0074, .0052, .012, M.green, x, y + .0012, z + f * .0235);
    B.box(.0056, .0042, .012, M.boot, x, y + .0012, z + f * .0355);
    return [x, y + .0012, z + f * .0415];
  };
  // up the rack face, into the row runway, along it to the leaf, down to the switch
  const runToRack = (start, k, lane, upX) => {
    const f = k.f, zf = start[2] + ports[0].f * .03, rail = k.x + .232, rz = k.z + f * .67, ry = rowZ + lane;
    const end = adapterEnd(k);
    return [start, [start[0], start[1], zf], [upX, start[1] + .03, zf], [upX, HALL_RUNWAY.entryY, zf], [upX, HALL_RUNWAY.entryY, ry], [upX, HALL_RUNWAY.cableY, ry],
      [rail, HALL_RUNWAY.cableY, ry], [rail, HALL_RUNWAY.entryY, ry], [rail, HALL_RUNWAY.entryY, rz], [rail, end[1] + .05, rz],
      [rail, end[1], rz], [end[0], end[1], rz], end];
  };
  const routes = [];
  // straight: each MPO port carries one 4-channel cable to one 400G adapter (MFP7E10 in NVIDIA's documentation)
  const straight = ports[TOP + STRAIGHT_C], sEnds = switchModule(straight);
  sEnds.forEach((p, i) => routes.push(cable(runToRack(p, racks[racks.length - 1 - i], -.1 + i * .03, p[0] + (i ? .004 : -.004)), .0032)));
  // label in the data layer only, where the overlay labels live
  const tagS = textSprite('Multimode, straight · representative', '#7fe3dc', .013);
  tagS.position.set(straight.point[0] + .1, straight.point[1] + .07, straight.point[2] + straight.f * .03);
  layer.add(tagS);
  const mesh = B.build({ cast: false, receive: true });
  group.add(mesh); scene.add(group);
  group.userData.breakout = { routes: routes.length, ports: [TOP + STRAIGHT_C], rowZ };
  return { group, routes };
}
