// The NVL72 rack's 1 GbE out-of-band management leads: one copper RJ45 patch lead from the top management switch to
// each compute tray and NVLink switch tray. Routes, sourcing and what is representative: rack-mgmt-plan.js.
import { THREE, MAT, Builder } from '../kit.js';
import { managedRoute } from './fiber-routing.js';
import { planMgmtLeads, LEAD_R, FACE_Z } from './rack-mgmt-plan.js';

// a muted blue jacket keeps the copper management leads apart from the yellow fiber and the dark tray faces
const JACKET = new THREE.MeshStandardMaterial({ color: 0x2f5f8f, roughness: 0.55, metalness: 0.04 }); JACKET.name = 'Management patch lead (RJ45, 1 GbE)';
const PLUG = new THREE.MeshStandardMaterial({ color: 0xc4ccd3, roughness: 0.32, metalness: 0.05 }); PLUG.name = 'RJ45 plug body';
const LED_G = new THREE.MeshStandardMaterial({ color: 0x1d3a28, emissive: 0x5cf29a, emissiveIntensity: 1.2 }); LED_G.name = 'Management link LED';
const LED_A = new THREE.MeshStandardMaterial({ color: 0x3a2e14, emissive: 0xf2b84a, emissiveIntensity: 0.9 }); LED_A.name = 'Management activity LED';

// one RJ45 plug and boot, its nose in the jack face at z0, pointing +z
function plug(B, x, y, z0) {
  B.box(0.0112, 0.0084, 0.012, PLUG, x, y, z0 + 0.0055);              // clear body, seated 0.5 mm into the jack
  B.box(0.0098, 0.0088, 0.0175, JACKET, x, y, z0 + 0.0205);          // strain-relief boot
  B.box(0.004, 0.0016, 0.006, PLUG, x, y + 0.005, z0 + 0.0125);        // latch tab
}

// the tray-side jack: a shielded frame around a dark mouth, two link LEDs, a few millimetres proud of the face
function jack(B, x, y) {
  const z = FACE_Z + 0.0015;
  for (const s of [-1, 1]) {
    B.box(0.0145, 0.0012, 0.0055, MAT.nickel, x, y + s * 0.0056, z);
    B.box(0.0012, 0.0104, 0.0055, MAT.nickel, x + s * 0.0067, y, z);
  }
  B.box(0.0118, 0.0098, 0.001, MAT.black, x, y, FACE_Z + 0.0006);
  B.box(0.002, 0.0012, 0.001, LED_G, x - 0.0045, y + 0.0074, FACE_Z + 0.001);
  B.box(0.002, 0.0012, 0.001, LED_A, x + 0.0045, y + 0.0074, FACE_Z + 0.001);
}

function tube(B, pts, radial) {
  const route = managedRoute(pts, 0.009).map(p => new THREE.Vector3(...p));
  const curve = new THREE.CatmullRomCurve3(route, false, 'centripetal');
  const n = Math.min(260, Math.max(12, Math.ceil(curve.getLength() / 0.008)));
  B.addM(new THREE.TubeGeometry(curve, n, LEAD_R, radial, false), JACKET, new THREE.Matrix4());
}

export function addRackMgmt(built, accel, quality = {}) {
  const leads = planMgmtLeads(accel), B = new Builder(), radial = quality.mobile ? 4 : 6;
  for (const l of leads) {
    plug(B, l.port.x, l.port.y, FACE_Z);
    jack(B, l.jack.x, l.jack.y);
    plug(B, l.jack.x, l.jack.y, FACE_Z);
    tube(B, [...l.up, ...l.down.slice(1)], radial);
  }
  // nativeOverlay: compute-blender.js keeps these native meshes instead of swapping them for the rack GLB, and the
  // GLB exporter skips them, so rebuilding the rack assets neither drops nor doubles them
  const g = B.build({ cast: false }); g.name = 'Out-of-band management leads';
  g.traverse(o => { if (o.isMesh) o.userData.nativeOverlay = true; });
  built.scene.add(g);
  built.scene.userData.rackMgmt = { leads: leads.length, rows: leads.map(l => l.row), medium: '1 GbE RJ45 copper', representative: true };
}
