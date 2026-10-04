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
import { THREE, textSprite } from '../kit.js';
import { OSFP } from './osfp-size.js';
import { switchModulePorts } from './lid-labels.js';
import { SiteBuilder as Builder } from './site-blender-construction.js';
const _I = new THREE.Matrix4();
import { managedRoute, HALL_RUNWAY } from './fiber-routing.js';

// leaf row and ports used: the second QM9700 in the row-end rack of the second row (z = -8.2), whose ports
// carry no rack jumpers in this layout (the first chassis takes the 32 racks of the row)
const ROW = 1, STRAIGHT_C = 6, SPLIT_C = 10, TOP = 32 + 16;
export const breakoutDrawn = model => model.accel.nicPortGbps === 400 && model.accel.gpusPerRack === 72;
// switch ports whose black pull tab gives way to the multimode module's tan one
export function multimodeTabKeys(model, leafX, rowZs) {
  if (!breakoutDrawn(model)) return new Set();
  return new Set([TOP + STRAIGHT_C, TOP + SPLIT_C].map(i => `${leafX}:${rowZs[ROW]}:${i}`));
}

// A smooth cable: straight runs are cylinders and each rounded corner is a short tube along the same quadratic
// corner managedRoute() draws, so corners read as one bent jacket instead of a chain of cylinders. Both go through
// the hall's SiteBuilder, which swaps them for the Blender-authored cylinder and tube modules.
function cableInto(B, points, r, mat, seg, radius = .03) {
  const p = points.map(v => new THREE.Vector3(...v));
  let from = p[0];
  for (let i = 1; i < p.length - 1; i++) {
    const a = p[i - 1], b = p[i], c = p[i + 1], rr = Math.min(radius, a.distanceTo(b) * .4, b.distanceTo(c) * .4);
    const s0 = b.clone().add(a.clone().sub(b).normalize().multiplyScalar(rr)), s1 = b.clone().add(c.clone().sub(b).normalize().multiplyScalar(rr));
    B.strut(from.toArray(), s0.toArray(), r, mat, seg);
    if (rr > 1e-5) B.addM(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(s0, b.clone(), s1), 10, r, seg, false), mat, _I);
    from = s1;
  }
  B.strut(from.toArray(), p.at(-1).toArray(), r, mat, seg);
  return managedRoute(points, radius);
}

const AQUA = 0x37c6c0;                          // industry-standard multimode jacket colour (published: "Aqua")
const mats = () => ({
  aqua: new THREE.MeshStandardMaterial({ color: AQUA, roughness: .42, metalness: .05, name: 'Multimode fiber jacket (aqua)' }),
  green: new THREE.MeshStandardMaterial({ color: 0x3fae4a, roughness: .45, metalness: .05, name: 'MPO-12/APC shell (green)' }),
  boot: new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: .6, metalness: .05, name: 'Connector boot' }),
  tan: new THREE.MeshStandardMaterial({ color: 0xc9a77a, roughness: .55, metalness: .05, name: 'Multimode pull tab (tan)' }),
  metal: new THREE.MeshStandardMaterial({ color: 0xcfd3d8, roughness: .28, metalness: .85, name: 'OSFP shell' }),
  band: new THREE.MeshStandardMaterial({ color: 0xb9bec4, roughness: .5, metalness: 0, name: 'Splitter label band' }),
});

export function buildBreakout({ model, scene, layer, leafX, rowZs, ports, racks, quality, rackDz = 0 }) {   // rackDz: how far the racks' fronts sit from the 1.2 m depth the offsets below were typed for
  if (!breakoutDrawn(model) || !ports || ports.length < 64) return null;
  const M = mats(), B = new Builder(), rowZ = rowZs[ROW], seg = quality.mobile ? 6 : 8;
  const group = new THREE.Group(); group.name = 'Multimode links and 1:2 splitters (representative)';
  const cable = (pts, r) => cableInto(B, pts, r, M.aqua, seg);
  // switch side: tan pull tab under the module (the chassis skips its black one here), two green MPO shells
  const switchModule = port => {
    const [x, y, z] = port.point, f = port.f;
    B.box(.0046, .0036, .032, M.tan, x, y - .0045, z - f * .002);
    B.box(.0058, .0026, .006, M.tan, x, y - .0058, z + f * .016);               // the tab's finger loop
    const n = switchModulePorts(model.accel);                                       // lid-labels.js: the twin-port's two receptacles
    return Array.from({ length: n }, (_, k) => {
      const cx = x + (k - (n - 1) / 2) * .010;                                     // MPO-12 receptacles, 10 mm apart
      B.box(.0074, .0052, .014, M.green, cx, y + .0012, z - f * .003);
      B.box(.0056, .0042, .012, M.boot, cx, y + .0012, z + f * .0095);
      return [cx, y + .0012, z + f * .0155];
    });
  };
  // adapter side: a flat-top single-port 400G OSFP (tan tab) in a GB200 tray front, two trays under the
  // rack's drawn scale-out module, with its green MPO shell and boot
  const adapterEnd = k => {
    const f = k.f, x = k.x + .2, y = 1.333375 - 2 * .0445, z = k.z + f * (.62 + rackDz);
    B.box(OSFP.w, OSFP.h, .035, M.metal, x, y, z);
    B.box(.005, .0034, .03, M.tan, x, y - .0047, z + f * .016);
    B.box(.0074, .0052, .012, M.green, x, y + .0012, z + f * .0235);
    B.box(.0056, .0042, .012, M.boot, x, y + .0012, z + f * .0355);
    return [x, y + .0012, z + f * .0415];
  };
  // up the rack face, into the row runway, along it to the leaf, down to the switch
  const runToRack = (start, k, lane, upX) => {
    const zf = start[2] + ports[0].f * .03;
    return [start, [start[0], start[1], zf], [upX, start[1] + .03, zf], ...overhead(zf, k, lane, upX)];
  };
  // from the leaf face up into the leaf runway, along the row runway, down the rack face to the adapter
  const overhead = (zf, k, lane, upX) => {
    const f = k.f, rail = k.x + .232, rz = k.z + f * (.67 + rackDz), ry = rowZ + lane;
    const end = adapterEnd(k);
    return [[upX, HALL_RUNWAY.entryY, zf], [upX, HALL_RUNWAY.entryY, ry], [upX, HALL_RUNWAY.cableY, ry],
      [rail, HALL_RUNWAY.cableY, ry], [rail, HALL_RUNWAY.entryY, ry], [rail, HALL_RUNWAY.entryY, rz], [rail, end[1] + .05, rz],
      [rail, end[1], rz], [end[0], end[1], rz], end];
  };
  const routes = [];
  // straight: each MPO port carries one 4-channel cable to one 400G adapter (MFP7E10 in NVIDIA's documentation)
  const straight = ports[TOP + STRAIGHT_C], sEnds = switchModule(straight);
  sEnds.forEach((p, i) => routes.push(cable(runToRack(p, racks[racks.length - 1 - i], -.1 + i * .03, p[0] + (i ? .004 : -.004)), .0032)));
  // 1:2 splitters: both MPO ports of the second module take one (NVIDIA: a twin-port's two ports must be the same
  // type, straight or splitter). Each 4-channel trunk rises to a breakout boot; two 2-channel legs leave it, each
  // to its own 400G adapter, which then runs at 200G on two lit lanes (MFP7E20 / MMA4Z00-NS400 documentation).
  const split = ports[TOP + SPLIT_C], f = split.f, pEnds = switchModule(split);
  const boots = [];
  pEnds.forEach((p, i) => {
    const s = i ? 1 : -1, zf = p[2] + f * (.03 + i * .012), bx = p[0] + s * .011, yB = p[1] + .07, len = .045;
    routes.push(cable([p, [p[0], p[1], zf], [bx, p[1] + .025, zf], [bx, yB - len / 2, zf]], .0032));
    B.cyl(.0062, len, M.boot, bx, yB, zf, seg + 4);                                   // breakout boot
    B.cyl(.0065, .005, M.band, bx, yB + .008, zf, seg + 4);                           // its label band
    B.cyl(.0045, .006, M.boot, bx, yB - len / 2 - .002, zf, seg + 4);                 // strain-relief nose, trunk side
    B.cyl(.0045, .006, M.boot, bx, yB + len / 2 + .002, zf, seg + 4);                 // and leg side
    boots.push([bx, yB, zf]);
    [-1, 1].forEach((t, j) => {
      const n = i * 2 + j, legX = bx + t * .0115, top = [bx + t * .0022, yB + len / 2 + .005, zf];
      const k = racks[racks.length - 3 - n];
      routes.push(cable([top, [legX, top[1] + .03, zf], ...overhead(zf, k, .04 + n * .03, legX)], .0026));
    });
  });
  // labels in the data layer only, where the overlay labels live; set just in front of the cables so none hides them
  const tagS = textSprite('Multimode, straight · 2 × 400G', '#7fe3dc', .013);
  tagS.position.set(straight.point[0] - .078, straight.point[1] + .1, straight.point[2] + f * .09);
  const tagB = textSprite('1:2 splitters · 4 × 200G · representative', '#7fe3dc', .013);
  tagB.position.set(split.point[0] + .004, boots[0][1] + .15, split.point[2] + f * .09);
  layer.add(tagS, tagB);
  const mesh = B.build({ cast: false, receive: true });
  group.add(mesh); scene.add(group);
  group.userData.breakout = { routes: routes.length, ports: [TOP + STRAIGHT_C, TOP + SPLIT_C], splitters: 2, rowZ };
  return { group, routes };
}
