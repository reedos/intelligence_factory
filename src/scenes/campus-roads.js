// Representative site circulation, not a surveyed layout. Metres, X/Z plan.
// Runtime assembles Blender-authored construction modules into a non-overlapping
// pavement union; the same plan drives markings, vehicle paths and validation.
import { SiteBuilder as Builder } from './site-blender-construction.js';
import { MAT } from '../kit.js';
export {campusRoadPlan,containsPlan} from './campus-road-plan.js';
export function addCampusRoads(scene,plan,asphalt){
 const pavement=new Builder(),details=new Builder();
 for(const r of plan.tiles)pavement.slab(r.x1-r.x0,.12,r.z1-r.z0,asphalt,(r.x0+r.x1)/2,.15,(r.z0+r.z1)/2);
 for(const m of plan.markings)details.slab(m.w,.02,m.d,MAT.paint,m.x,.28,m.z);
 for(const e of plan.curbs)details.slab(Math.max(.28,Math.abs(e[2]-e[0])),.15,Math.max(.28,Math.abs(e[3]-e[1])),MAT.concrete,(e[0]+e[2])/2,.15,(e[1]+e[3])/2);
 const road=pavement.build({cast:false});road.name='Continuous campus pavement';scene.add(road);
 const trim=details.build({cast:false});trim.name='Campus road markings and boundary curbs';scene.add(trim);
 scene.userData.campusRoads=plan;
}
