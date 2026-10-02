import { THREE } from '../kit.js';

export const FIBER_JACKET = 0xd3b940;
export const RACK_RUNWAY = { x: .2, floorY: 3.62, cableY: 3.665, width: .3, length: 3.2, rimTop: 3.71 };
// NVL72 racks: the runway runs along the row over the rack centerline, as the hall draws it (x is its center along the
// row, z its centerline). The DGX H100 rack keeps RACK_RUNWAY until its rebuild lands.
export const ROW_RUNWAY = { x: -.6, z: 0, floorY: 3.62, cableY: 3.665, width: .3, length: 3.2, rimTop: 3.71, end: -2.1 };
// cables lie on the ladder's rungs (rung tops at 4.393) and pass over a crossing runway's rim, not through them
export const HALL_RUNWAY = { floorY: 4.3, cableY: 4.41, rimTop: 4.4, entryY: 4.55 };

// Rounded orthogonal cable runs: fixed corridors avoid spline overshoot into
// neighboring trays. Corner radius is illustrative, not a cable SKU rating.
export function managedRoute(points, radius=.035) {
  const p=points.map(v=>new THREE.Vector3(...v)), out=[p[0].toArray()];
  for(let i=1;i<p.length-1;i++) {
    const a=p[i-1],b=p[i],c=p[i+1],r=Math.min(radius,a.distanceTo(b)*.4,b.distanceTo(c)*.4);
    const start=b.clone().add(a.clone().sub(b).normalize().multiplyScalar(r));
    const end=b.clone().add(c.clone().sub(b).normalize().multiplyScalar(r));
    out.push(start.toArray(),...new THREE.QuadraticBezierCurve3(start,b,end).getPoints(8).slice(1).map(v=>v.toArray()));
  }
  out.push(p.at(-1).toArray());return out;
}

