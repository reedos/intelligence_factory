import { THREE, MAT, Builder, flow } from '../kit.js';

import { managedRoute, RACK_RUNWAY, FIBER_JACKET } from './fiber-routing.js';
import { printDecals, textTexture } from './print-kit.js';
import { nicLabel, labelLines } from './lid-labels.js';
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
  const shell = MAT.nickel.clone(); shell.name = 'Inserted flat top OSFP shell';
  shell.roughness=.48;shell.metalness=.6;shell.envMapIntensity=.35;
  const rows = h100 ? [0,1,2,3] : [3,4,5,6,7,8,9,10,20,21,22,23,24,25,26,27,28,29];
  // DGX H100: four OSFP side by side in the middle of the motherboard tray's rear (user guide port figure)
  const ports = rubin ? [-.166,-.104,.104,.166].flatMap(x=>[{x,dy:0},{x,dy:.018}]) : h100 ? [-.0375,-.0125,.0125,.0375].map(x=>({x,dy:0})) : [-.195,-.15,.15,.195].map(x=>({x,dy:0}));
  rows.forEach((row,index) => {
    const pulled = row === (h100 ? 2 : 24);
    const rowY = h100 ? .16+row*(8*U+.004)+.094 : .12+row*U+U/2-.009;
    const z = h100 ? (pulled ? 1.045-.42 : .465-.84) : pulled ? .965+.45+.011 : .486;
    const direction = h100 ? -1 : 1;
    // Show a few populated links per tray with the remaining cages inspectable.
    ports.forEach(({x,dy},port) => {
      const y=rowY+dy;
      // Cage numbers read left to right from the aisle; stacked Vera Rubin cages number top then bottom per
      // column, the lower number printed under its cage. Order is representative.
      if (!h100) {   // the DGX H100's rear cages sit under riding heat sinks and patch leads: no room for a number
        const order = [...ports].sort((a, b) => (a.x - b.x) * direction || b.dy - a.dy), n = order.indexOf(ports[port]) + 1;
        const below = rubin && dy === 0, ny = y + (below ? -.0098 : .0098);
        if (!portNumbers.has(n)) portNumbers.set(n, []);
        portNumbers.get(n).push({ p: [x, ny, z - direction * .006], n: [0, 0, direction] });   // on the tray face, flush with the cage plane
      }
      const occupied = port === 0 || port === ports.length-1;
      // Rolled metal mouth is a hollow frame, not a painted black rectangle.
      for (const s of [-1,1]) {
        hardware.box(.024,.0012,.012,shell,x,y+s*.0068,z);
        hardware.box(.0012,.0124,.012,shell,x+s*.012,y,z);
      }
      if (!occupied) { hardware.box(.021,.011,.001,MAT.black,x,y,z-direction*.004); return; }
      // Closed trays expose only the nose; the opened tray also exposes the
      // full module envelope seated inside its cage. No extra transceiver count.
      const length = pulled ? .1078 : .020;
      hardware.box(.02258,.013,length,shell,x,y,z-direction*(length/2-.017));
      hardware.box(.020,.010,.004,MAT.black,x,y,z+direction*.019);
      // printed lid label on the nose ahead of the cage lip (lip to z+.006, nose to z+.017), read from the aisle
      lidLabels.push({ p: [x, y + .0065, z + direction * .0118], face: 'top', yaw: direction > 0 ? 0 : Math.PI });
      if (h100) {
        hardware.box(.025,.003,.075,shell,x,y+.009,z+.042);
        for(let fin=0;fin<8;fin++)hardware.box(.0012,.010,.073,shell,x-.0105+fin*.003,y+.015,z+.042);
      }
      const connectorCount = h100 || accel === 'gb300' ? 2 : 1;
      for (let lane=0;lane<connectorCount;lane++) {
        const cx=x+(connectorCount===2?(lane-.5)*.009:0);
        hardware.box(connectorCount===2?.0075:.014,.007,.018,connector,cx,y,z+direction*.03);
        for(let rib=0;rib<4;rib++)hardware.box(connectorCount===2?.0078:.0143,.0074,.0012,MAT.black,cx,y,z+direction*(.035+rib*.002));
        // DGX H100: the leads keep outboard of the rear rail post at x +-.25 on their run to the manager
        const side = Math.sign(x), rail = side*((h100?.262:.252)+(index%6)*.0028);
        const managerZ=(h100?-.575:.575)+direction*(Math.floor(index/6)*.007+lane*.0032);
        const start=[cx,y,z+direction*.044], end=[rail,2.32,managerZ];
        // one tag per module, hanging under its lead or straddling a twin pair, clear of the connector faces
        if (lane === 0) mpoTags.push({ p: [x, y - .0058, z + direction * .066], n: [0, 0, direction] });
        // Short faceplate run, then a controlled side return for the extended
        // service tray. Neighboring leads share a narrow, combed riser corridor.
        const exitZ=z+direction*(.085+lane*.008);
        const points=managedRoute([start,[cx,y,exitZ],[rail,y,exitZ],
          [rail,y,managerZ],[rail,y+.10,managerZ],end]);
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
      for(const s of [-1,1])hardware.box(.0012,.002,.029,shell,x+s*.010,y-.008,z+direction*.027);
      hardware.box(.020,.002,.0015,shell,x,y-.008,z+direction*.041);
      modules.push({row,port,position:[x,y,z],pulled,connectors:connectorCount,capacityGbps:accel==='gb200'?400:800});
    });
    // Storage/in-band QSFP cages are narrower and separated vertically from
    // the compute ports. Four for two BF3s in GB200 / dual CX7s in this DGX
    // H100 configuration; two for the GB300 BF3 or Rubin BF4 configuration.
    // DGX H100: the two dual-port storage ConnectX-7 in riser slots 1 and 2, either side of the OSFP row
    const storage = h100 ? [-.167,-.137,.117,.147] : rubin ? [-.018,.018] : accel==='gb200' ? [-.187,-.16,.16,.187] : [.16,.187];
    for(const x of storage) {
      const y=rowY+(h100?.0045:rubin?.008:.021);
      for(const s of [-1,1]) {
        hardware.box(.0185,.001,.012,shell,x,y+s*.0048,z);
        hardware.box(.001,.0086,.012,shell,x+s*.0093,y,z);
      }
      hardware.box(.0165,.0075,.001,MAT.black,x,y,z-direction*.004);
      storageCages.push({row,position:[x,y,z],form:'QSFP',role:'storage/in-band'});
    }
  });
  // Dark hook-and-loop straps gather the yellow patch leads in each riser corridor every 180 mm, between the
  // comb fingers (representative dressing; lead and connector counts unchanged).
  const strap = new THREE.MeshStandardMaterial({ color: 0x17191c, roughness: .92, metalness: 0 });
  strap.name = 'Hook-and-loop cable strap';
  const leadTop = Math.min(...rows.map(row => h100 ? .16+row*(8*U+.004)+.094 : .12+row*U+U/2-.009)) + .12;
  for (const side of [-1,1]) {
    const managerZ=h100?-.575:.575, direction=h100?-1:1;
    for(let y=.31;y<2.29;y+=.18) if(y>leadTop) hardware.box(.022,.012,.028,strap,side*.259,y,managerZ+direction*.011);
  }
  for (const side of [-1,1]) {
    const center=side*.259,managerZ=h100?-.575:.575;
    hardware.box(.042,.033,.008,MAT.darkSteel,center,2.327,managerZ+(h100?.012:-.012));
    // Managers and fibers stay inside the 600 mm rack width; front/rear
    // service clearance remains outside the face, not outside the side posts.
    hardware.box(.004,2.16,.055,MAT.darkSteel,side*.284,1.22,managerZ);
    for(let y=.22;y<2.31;y+=.18) {
      hardware.box(.043,.006,.004,shell,side*.264,y,managerZ+(h100?.031:-.013));
      hardware.box(.004,.016,.055,MAT.darkSteel,side*.238,y,managerZ+.008);
    }
    // Each patch strip's outgoing multifiber loom continues into the overhead
    // runway. This is a cable bundle, not an optical combiner or active switch.
    for(let strand=0;strand<4;strand++) {
      const x=center+(strand-1.5)*.0035,z=managerZ;
      const laneX=RACK_RUNWAY.x+(side<0?-.085:.035)+strand*.012;
      // Pass above the side lip before settling inside the yellow raceway.
      // DGX H100: the right-hand loom rises outboard of the runway's side wall, not through its floor
      const out = h100 && side>0 ? [[.37,2.34,z],[.37,RACK_RUNWAY.rimTop+.10,z]] : [[x,RACK_RUNWAY.rimTop+.10,z]];
      const f=flow(managedRoute([[x,2.34,z],...out,
        [laneX,RACK_RUNWAY.rimTop+.10,z],[laneX,RACK_RUNWAY.cableY,z-.12],
        [laneX,RACK_RUNWAY.cableY,-1.58]],.055),'eth',{count:9,speed:.4,size:.0017,k:1,trail:false});
      f.ribbonIntensity=.30;f.rackOpticalTrunk={laneX,runway:RACK_RUNWAY};
      hardware.addM(new THREE.TubeGeometry(f.path,64,.0018,5,false),jacket,new THREE.Matrix4());
      built.dataFlows.push(f);built.scene.add(f.group);
    }
  }
  const mesh=hardware.build();mesh.name='Rack optical population and passive patch terminations';built.scene.add(mesh);
  // MPO-12 flag tags: thin printed sleeves hanging off each lead, readable from either side (MPO-12/APC leads, as the
  // module datasheets give; the tag form is representative).
  const pair = h100 || accel === 'gb300';
  printDecals(built.scene, { texture: textTexture([{ text: pair ? '2× MPO-12' : 'MPO-12', size: .62, weight: 700 }], { px: 64, aspect: pair ? 3.2 : 2.6, ink: '#1b1e22', align: 'center', plate: '#eef0f1' }),
    size: pair ? [.019, .0059] : [.0154, .0059], placements: mpoTags, name: 'MPO patch lead tags', material: { roughness: .7, side: THREE.DoubleSide } });
  // Lid print: the NIC-side module class for this scenario (lid-labels.js), etched dark on the nickel shell.
  printDecals(built.scene, { texture: textTexture(labelLines(nicLabel(accel)), { px: 72, aspect: 2, ink: '#474d55', pad: .05 }),
    size: [.019, .0088], placements: lidLabels, lift: .00008, name: 'NIC module lid labels', material: { roughness: .7, metalness: .25 } });
  built.scene.userData.rackOptics={modules,links,storageCages,cagesPerTray:ports.length,representative:true,termination:'passive patch strip'};
  built.printSpots = [...(built.printSpots || []), ...[...portNumbers].map(([n, spots]) => etch(`Cage number ${n}`, String(n), [.008, .0045], spots, { ink: '#c9cfd6' }))];
  const hero=modules.find(m=>m.pulled && (h100 ? m.position[0]>0 : true));
  if(hero && built.dataHotspots.uplinks) {
    const [x,y,z]=hero.position;
    built.dataHotspots.uplinks={pos:[x,y+.012,z+(h100?-.024:.024)],view:{pos:[x+(h100?.35:-.12),y+(h100?.22:.11),z+(h100?-.45:.40)],target:[x,y,z],focus:[x,y,z],detailSize:h100?[.22,.12,.25]:[.13,.065,.18]}};
  }
}
