import { LAYOUT as NVL_LAYOUT, PULLED as NVL_PULLED } from './nvl72-layout.js';
import { THREE, MAT, Builder, flow } from '../kit.js';

import { managedRoute, RACK_RUNWAY, ROW_RUNWAY, FIBER_JACKET } from './fiber-routing.js';
import { printDecals, textTexture } from './print-kit.js';
import { nicLabel, labelLines, modulePorts } from './lid-labels.js';
import { OSFP, QSFP } from './osfp-size.js';
import { NVL_FRONT } from './tray.js';
import { RUBIN_FRONT } from './tray-rubin.js';
import { DGX } from './dgx-h100-layout.js';
import { etch } from './package-marks.js';

// Representative optical population, not an exact customer cable schedule.
// GB200/GB300: four compute-fabric OSFP cages; H100: four twin-port OSFP
// cages for eight HCAs. Optical patch leads stay separate from NVLink copper.
// Sources: NVIDIA DGX GB hardware/networking guide and DGX H100 user guide.
export function addRackOptics(built, accel) {
  const h100 = accel === 'h100', rubin = accel === 'rubin', U = .04445;
  const hardware = new Builder(), modules = [], links = [], storageCages = [];
  const lidLabels = [];
  const mpoTags = [];   // cable flags on each patch lead, just behind its connector boot
  const portNumbers = new Map();   // printed cage numbers on the tray faces, by number (realized on the authored hardware)
  const jacket = new THREE.MeshStandardMaterial({ color: FIBER_JACKET, roughness: .48, metalness: .08 });
  jacket.name = 'Optical patch cable jacket';
  const connector = new THREE.MeshStandardMaterial({ color: 0x266c50, roughness: .42, metalness: .1 });
  connector.name = 'MPO APC connector boot';
  const manager = MAT.darkSteel.clone(); manager.name = 'Cable manager steel';   // the riser's plates and comb fingers: the rack's, named so tools/tray-overlay.mjs can tell
  const bootRib = MAT.black.clone(); bootRib.name = 'MPO APC connector boot grip';   // the boot's grip ribs: the lead's, not the tray's (named so tools/tray-overlay.mjs can tell)
  const shell = MAT.nickel.clone(); shell.name = 'Inserted flat top OSFP shell';
  shell.roughness=.48;shell.metalness=.6;shell.envMapIntensity=.35;
  const rows = h100 ? [0,1,2,3] : NVL_LAYOUT.map((k,i)=>k==='compute'?i:-1).filter(i=>i>=0);   // nvl72-layout.js
  // The tray's own front (tray.js NVL_FRONT, tray-rubin.js RUBIN_FRONT, dgx-h100-layout.js DGX): cage x and height, the
  // storage cages, the service sockets. Tray units (10 cm) x TU = the rack's meters; `yb` is the height above the tray floor.
  const TU = .1, front = h100 ? null : rubin ? RUBIN_FRONT : NVL_FRONT[accel];
  const ports = h100 ? DGX.cageX.map(x => ({ x: x*TU, yb: DGX.cageY*TU }))
    : rubin ? front.cageX.flatMap(x => front.cageY.map(y => ({ x: x*TU, yb: y*TU })))
    : front.cageX.map(x => ({ x: x*TU, yb: front.cageY*TU }));
  const floorOf = row => h100 ? .16+row*(8*U+.004) : .12+row*U;   // the tray's floor in the rack (nvl72-layout.js; DGX servers stack at 8U + 4 mm)
  const lowestCage = Math.min(...ports.map(q => q.yb));
  const connectorCount = modulePorts(accel);   // lid-labels.js: the count the module's label names and the tray draws
  const cage = (x, y, z, depth) => {   // the OSFP cage frame around its opening (osfp-size.js)
    for (const s of [-1,1]) {
      hardware.box(OSFP.cageW, OSFP.wall, depth, shell, x, y+s*(OSFP.innerH+OSFP.wall)/2, z);
      hardware.box(OSFP.wall, OSFP.innerH, depth, shell, x+s*(OSFP.innerW+OSFP.wall)/2, y, z);
    }
  };
  // Every lead has its own place in the riser, outboard of the pulled trays' slide rails (x .254-.266) and inside the manager's
  // plate (x .282, z .5475-.6025): the leads of one side of a tray, outermost first (slot 0), take the rails (x) in that order
  // and a staggered run (z), so an outer lead never crosses an inner one; each tray takes the next column in z, so a lower tray's
  // column is never in the way of a higher tray's run to its own. A lead's run to its rail is out past the last column.
  const leadList = ports.flatMap((q, port) => Array.from({ length: connectorCount }, (_, lane) => ({ port, lane, x: q.x + (connectorCount === 2 ? (lane-.5)*.009 : 0), yb: q.yb })));
  const slotOf = new Map();
  for (const side of [-1,1]) {
    const mine = leadList.filter(l => Math.sign(l.x) === side).sort((p, q) => side*q.x - side*p.x || p.yb - q.yb);
    mine.forEach((l, i) => slotOf.set(l, i));
  }
  const RAIL0 = .2685, RAIL_PITCH = .003, COL0 = .5505, COL_PITCH = .003;
  const colMax = COL0 + (rows.length-1)*COL_PITCH;
  rows.forEach((row,index) => {
    const pulled = row === (h100 ? 2 : NVL_PULLED);
    const floor = floorOf(row);
    const direction = h100 ? -1 : 1;
    // The pulled tray is the tray level's own hardware (compute-blender.js seats its GLB at scene.userData.pulledTray), cages,
    // seated modules, MPO faces and service sockets included, so this file draws none of those on that row: it carries the patch
    // leads from the tray's MPO faces (tray.js faceZ, dgx-h100-layout.js cageFaceZ) and the prints on the tray's modules.
    // `z` is the plane the closed trays' cages sit in; on the pulled row it is set back from the face as theirs are (face 17 mm ahead).
    const T = built.scene.userData.pulledTray, TIN = pulled ? T.z + (h100 ? DGX.cageFaceZ : front.faceZ) * TU : 0;
    const z = pulled ? TIN - direction * .017 : h100 ? .465-.84 : .486;
    // Every cage the tray populates is populated here (tray.js seats a module in each of its four, tray-rubin.js in all eight).
    ports.forEach((q,port) => {
      const {x} = q, y = floor+q.yb;
      // Cage numbers read left to right from the aisle; stacked Vera Rubin cages number top then bottom per
      // column, the lower number printed under its cage. Order is representative.
      if (!h100 && !pulled) {   // the DGX H100's rear cages sit under riding heat sinks and patch leads: no room for a number (the pulled tray's face has none: the tray level draws none)
        const order = [...ports].sort((a, b) => (a.x - b.x) * direction || b.yb - a.yb), n = order.indexOf(q) + 1;
        const below = rubin && q.yb === lowestCage, ny = y + (below ? -.0098 : .0098);
        if (!portNumbers.has(n)) portNumbers.set(n, []);
        portNumbers.get(n).push({ p: [x, ny, z - direction * .006], n: [0, 0, direction] });   // on the tray face, flush with the cage plane
      }
      if (!pulled) {
        // Rolled metal mouth is a hollow frame, not a painted black rectangle.
        cage(x, y, z, .012);
        // Closed trays expose only the nose (the pulled one is the tray's own, with its cages and modules).
        hardware.box(OSFP.w,OSFP.h,.020,shell,x,y,z-direction*(.020/2-.017));
        hardware.box(OSFP.w-.0026,OSFP.h-.003,.004,MAT.black,x,y,z+direction*.019);
      }
      // printed lid label on the nose ahead of the cage lip (lip to z+.006, nose to z+.017), read from the aisle; on the pulled tray, where the tray prints it
      lidLabels.push({ p: [x, y + OSFP.h/2, pulled ? T.z + (h100 ? DGX.cageLidZ : front.lidZ) * TU : z + direction * .0118], face: 'top', yaw: direction > 0 ? 0 : Math.PI });
      if (h100 && !pulled) {
        hardware.box(.025,.003,.075,shell,x,y+.009,z+.042);
        for(let fin=0;fin<8;fin++)hardware.box(.0012,.010,.073,shell,x-.0105+fin*.003,y+.015,z+.042);
      }
      for (let lane=0;lane<connectorCount;lane++) {
        const lead = leadList.find(l => l.port === port && l.lane === lane), slot = slotOf.get(lead), side = Math.sign(x);
        const cx=lead.x;
        hardware.box(connectorCount===2?.0075:.014,.007,.018,connector,cx,y,z+direction*.03);
        for(let rib=0;rib<4;rib++)hardware.box(connectorCount===2?.0078:.0143,.0074,.0012,bootRib,cx,y,z+direction*(.035+rib*.002));
        const rail = side*(RAIL0 + slot*RAIL_PITCH);
        const tCol = COL0 + index*COL_PITCH, managerZ = direction*tCol;
        const start=[cx,y,z+direction*.044], end=[rail,2.32,managerZ];
        // one tag per module, hanging under its lead or straddling a twin pair, clear of the connector faces
        if (lane === 0) mpoTags.push({ p: [x, y - .0058, z + direction * .066], n: [0, 0, direction] });
        // Short faceplate run, then a controlled side return for the extended
        // service tray. Neighboring leads share a narrow, combed riser corridor.
        const tNatural = z*direction + .085 + slot*.008, tRun = Math.max(tNatural, colMax + .004 + slot*.004);
        const exitZ = h100 ? z + direction*(.085 + slot*.008) : direction*tRun;
        // the run into the manager passes between its comb fingers (every .18 from .22), never through one
        const finger=.22+Math.round((y-.22)/.18)*.18,runY=Math.abs(y-finger)<.013?finger+(y>=finger?.014:-.014):y;
        // DGX H100 (rear cages): the leads pass the rear rail posts (x +-.25) and corner posts (x +-.28, z +-.505) on
        // their inboard side and only turn out to the manager behind them; the pulled server's leads come back into the
        // rack inboard of the front posts the same way. Other generations keep their front-side corridor.
        const behind=-(Math.max(.535, colMax + .004) + slot*.004), inX=side*(.236-slot*.003);
        const via=h100 ? (pulled ? [[cx,runY,exitZ+direction*.004],[inX,runY,exitZ+direction*.004],[inX,runY,behind],[rail,runY,behind]]
          : [[cx,runY,behind],[rail,runY,behind]]) : [[cx,runY,exitZ+direction*.004],[rail,runY,exitZ+direction*.004]];
        const points=managedRoute([start,[cx,y,exitZ],...via,
          [rail,runY,managerZ],[rail,runY+.10,managerZ],end]);
        const motion=flow(points,'eth',{count:8,speed:.30,size:.0013,k:1,trail:false});
        // Many neighboring fibers must remain individually readable; their
        // moving cores use less ribbon emission than the single backbone.
        motion.ribbonIntensity=.28;
        motion.rackOpticalLink={row,port,lane,start,end,managed:true};
        // the pulled tray's leads are the ones the uplinks camera sees up close: rounder there, 5 sides elsewhere
        hardware.addM(new THREE.TubeGeometry(motion.path,96,.0014,pulled?8:5,false),jacket,new THREE.Matrix4());
        built.dataFlows.push(motion);built.scene.add(motion.group);
        // A visible passive patch termination prevents fibers ending in air.
        hardware.box(.004,.020,.012,connector,rail,2.327,end[2]);
        links.push(motion.rackOpticalLink);
      }
      // Extraction bail surrounds the connector; it does not cross the fiber.
      if (!pulled) {
        for(const s of [-1,1])hardware.box(.0012,.002,.029,shell,x+s*.010,y-.008,z+direction*.027);
        hardware.box(.020,.002,.0015,shell,x,y-.008,z+direction*.041);
      }
      modules.push({row,port,position:[x,y,z],pulled,connectors:connectorCount,capacityGbps:accel==='gb200'?400:800});
    });
    // Storage/in-band QSFP cages are narrower and separated vertically from the compute ports: the BlueField-3 DPUs' two
    // each on GB200 (two DPUs) and GB300 (one), where the tray level draws them (tray.js NVL_FRONT.storageX), and the DGX H100's
    // two dual-port storage ConnectX-7 (dgx-h100-layout.js storageX). Vera Rubin's tray draws no QSFP: four small service
    // sockets between its cages (tray-rubin.js RUBIN_FRONT.serviceIo), drawn the same size here.
    const storage = h100 ? DGX.storageX.map(x => ({ x: x*TU, yb: (DGX.cardY[0] + DGX.storageDY)*TU }))
      : rubin ? front.serviceIo.x.map(x => ({ x: x*TU, yb: front.serviceIo.y*TU }))
      : front.storageX.map(x => ({ x: x*TU, yb: front.storageY*TU }));
    for(const {x, yb} of storage) {
      const y=floor+yb;
      if (pulled) {   // the tray's own QSFP cages / service sockets
        storageCages.push({row,position:[x,y,z],form:rubin?'service socket':'QSFP',role:rubin?'service':'storage/in-band'});
        continue;
      }
      if (rubin) {
        const io = front.serviceIo;
        hardware.box(io.w*TU, io.h*TU, io.d*TU, MAT.darkSteel, x, y, z - direction*(.004 + io.d*TU/2));   // face 4 mm behind the cage mouths, as in the tray
        hardware.box(.009,.005,.0018,MAT.black,x,y,z - direction*.0031);
        storageCages.push({row,position:[x,y,z],form:'service socket',role:'service'});
        continue;
      }
      for(const s of [-1,1]) {
        hardware.box(QSFP.cageW,QSFP.wall,.012,shell,x,y+s*(QSFP.innerH+QSFP.wall)/2,z);
        hardware.box(QSFP.wall,QSFP.innerH,.012,shell,x+s*(QSFP.innerW+QSFP.wall)/2,y,z);
      }
      hardware.box(QSFP.innerW-.002,QSFP.innerH-.001,.001,MAT.black,x,y,z-direction*.004);
      storageCages.push({row,position:[x,y,z],form:'QSFP',role:'storage/in-band'});
    }
  });
  // Dark hook-and-loop straps gather the yellow patch leads in each riser corridor every 180 mm, between the
  // comb fingers (representative dressing; lead and connector counts unchanged).
  const strap = new THREE.MeshStandardMaterial({ color: 0x17191c, roughness: .92, metalness: 0 });
  strap.name = 'Hook-and-loop cable strap';
  const leadTop = Math.min(...rows.map(row => floorOf(row) + lowestCage)) + .12;
  for (const side of [-1,1]) {
    const managerZ=h100?-.575:.575, direction=h100?-1:1;
    for(let y=.31;y<2.29;y+=.18) if(y>leadTop) hardware.box(.034,.012,.056,strap,side*.262,y,direction*(COL0+colMax)/2);
  }
  for (const side of [-1,1]) {
    const center=side*.259,managerZ=h100?-.575:.575;
    hardware.box(.042,.033,.008,manager,center,2.327,(h100?-1:1)*(COL0-.0065));   // behind (NVL72) / in front of (H100) the column of lead ends
    // Managers and fibers stay inside the 600 mm rack width; front/rear
    // service clearance remains outside the face, not outside the side posts.
    hardware.box(.004,2.16,.06,manager,side*.284,1.22,(h100?-1:1)*(COL0+colMax)/2);   // backs the whole bundle of columns
    for(let y=.22;y<2.31;y+=.18) {
      hardware.box(.043,.006,.004,shell,side*.264,y,h100?managerZ+.031:COL0-.004);   // comb teeth: clear of every column
      hardware.box(.004,.016,.055,manager,side*.238,y,managerZ+.008);
    }
    // Each patch strip's outgoing multifiber loom continues into the overhead
    // runway. This is a cable bundle, not an optical combiner or active switch.
    for(let strand=0;strand<4;strand++) {
      const x=center+(strand-1.5)*.0035,z=managerZ;
      let f;
      if (h100) {
        const laneX=RACK_RUNWAY.x+(side<0?-.085:.035)+strand*.012;
        // Pass above the side lip before settling inside the yellow raceway.
        // the right-hand loom, which sits under the runway, crosses over the rack top and rises in the gap inboard of
        // the runway (x < .05), then drops in over the side wall like the left one, not through the runway floor
        const out = side>0 ? [[-.03+strand*.004,2.34,z],[-.03+strand*.004,RACK_RUNWAY.rimTop+.10,z]] : [[x,RACK_RUNWAY.rimTop+.10,z]];
        f=flow(managedRoute([[x,2.34,z],...out,
          [laneX,RACK_RUNWAY.rimTop+.10,z],[laneX,RACK_RUNWAY.cableY,z-.12],
          [laneX,RACK_RUNWAY.cableY,-1.58]],.055),'eth',{count:9,speed:.4,size:.0017,k:1,trail:false});
        f.rackOpticalTrunk={laneX,runway:RACK_RUNWAY};
      } else {
        // NVL72: up the front manager, back over the B busway (above its hanger rods) to the runway along the row,
        // over its front lip, then along the row toward the leaf switches, each strand in its own lane.
        const RW=ROW_RUNWAY,laneZ=RW.z+(side<0?-.085:.035)+strand*.012,top=RW.rimTop+.14;
        f=flow(managedRoute([[x,2.34,z],[x,top,z],[x,top,laneZ+.12],[x,RW.cableY,laneZ],
          [RW.end,RW.cableY,laneZ]],.055),'eth',{count:9,speed:.4,size:.0017,k:1,trail:false});
        f.rackOpticalTrunk={laneZ,runway:RW};
      }
      f.ribbonIntensity=.30;
      hardware.addM(new THREE.TubeGeometry(f.path,64,.0018,5,false),jacket,new THREE.Matrix4());
      built.dataFlows.push(f);built.scene.add(f.group);
    }
  }
  const mesh=hardware.build();mesh.name='Rack optical population and passive patch terminations';built.scene.add(mesh);
  // MPO-12 flag tags: thin printed sleeves hanging off each lead, readable from either side (MPO-12/APC leads, as the
  // module datasheets give; the tag form is representative).
  const pair = connectorCount > 1;
  printDecals(built.scene, { texture: textTexture([{ text: pair ? '2× MPO-12' : 'MPO-12', size: .62, weight: 700 }], { px: 64, aspect: pair ? 3.2 : 2.6, ink: '#1b1e22', align: 'center', plate: '#eef0f1' }),
    size: pair ? [OSFP.label[0], .0059] : [.0154, .0059], placements: mpoTags, name: 'MPO patch lead tags', material: { roughness: .7, side: THREE.DoubleSide } });
  // Lid print: the NIC-side module class for this scenario (lid-labels.js), etched dark on the nickel shell.
  printDecals(built.scene, { texture: textTexture(labelLines(nicLabel(accel)), { px: 72, aspect: 2, ink: '#474d55', pad: .05 }),
    size: OSFP.label, placements: lidLabels, lift: .00008, name: 'NIC module lid labels', material: { roughness: .7, metalness: .25 } });
  built.scene.userData.rackOptics={modules,links,storageCages,cagesPerTray:ports.length,representative:true,termination:'passive patch strip'};
  built.printSpots = [...(built.printSpots || []), ...[...portNumbers].map(([n, spots]) => etch(`Cage number ${n}`, String(n), [.008, .0045], spots, { ink: '#c9cfd6' }))];
  const hero=modules.find(m=>m.pulled && (h100 ? m.position[0]>0 : true));
  if(hero && built.dataHotspots.uplinks) {
    const [x,y,z]=hero.position;
    built.dataHotspots.uplinks={pos:[x,y+.012,z+(h100?-.024:.024)],view:{pos:[x+(h100?.35:-.12),y+(h100?.22:.11),z+(h100?-.45:.40)],target:[x,y,z],focus:[x,y,z],detailSize:h100?[.22,.12,.25]:[.13,.065,.18]}};
  }
}
