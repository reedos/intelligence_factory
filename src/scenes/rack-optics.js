import { THREE, MAT, Builder, flow } from '../kit.js';

// Rounded orthogonal cable runs: fixed corridors avoid spline overshoot into
// neighboring trays. Corner radius is illustrative, not a cable SKU rating.
function managedRoute(points, radius=.035) {
  const p=points.map(v=>new THREE.Vector3(...v)), out=[p[0].toArray()];
  for(let i=1;i<p.length-1;i++) {
    const a=p[i-1],b=p[i],c=p[i+1],r=Math.min(radius,a.distanceTo(b)*.4,b.distanceTo(c)*.4);
    const start=b.clone().add(a.clone().sub(b).normalize().multiplyScalar(r));
    const end=b.clone().add(c.clone().sub(b).normalize().multiplyScalar(r));
    out.push(start.toArray(),...new THREE.QuadraticBezierCurve3(start,b,end).getPoints(8).slice(1).map(v=>v.toArray()));
  }
  out.push(p.at(-1).toArray());return out;
}

// Representative optical population, not an exact customer cable schedule.
// GB200/GB300: four compute-fabric OSFP cages; H100: four twin-port OSFP
// cages for eight HCAs. Optical patch leads stay separate from NVLink copper.
// Sources: NVIDIA DGX GB hardware/networking guide and DGX H100 user guide.
export function addRackOptics(built, accel) {
  const h100 = accel === 'h100', rubin = accel === 'rubin', U = .04445;
  const hardware = new Builder(), modules = [], links = [], storageCages = [];
  const jacket = new THREE.MeshStandardMaterial({ color: 0xd3b940, roughness: .48, metalness: .08 });
  jacket.name = 'Optical patch cable jacket';
  const connector = new THREE.MeshStandardMaterial({ color: 0x266c50, roughness: .42, metalness: .1 });
  connector.name = 'MPO APC connector boot';
  const shell = MAT.nickel.clone(); shell.name = 'Inserted flat top OSFP shell';
  shell.roughness=.48;shell.metalness=.6;shell.envMapIntensity=.35;
  const rows = h100 ? [0,1,2,3] : [3,4,5,6,7,8,9,10,20,21,22,23,24,25,26,27,28,29];
  const ports = rubin ? [-.166,-.104,.104,.166].flatMap(x=>[{x,dy:0},{x,dy:.018}]) : [-.195,-.15,.15,.195].map(x=>({x,dy:0}));
  rows.forEach((row,index) => {
    const pulled = row === (h100 ? 2 : 24);
    const rowY = h100 ? .16+row*(8*U+.004)+.23 : .12+row*U+U/2-.009;
    const z = h100 ? (pulled ? 1.045-.42 : .465-.84) : pulled ? .965+.45+.011 : .486;
    const direction = h100 ? -1 : 1;
    // Show a few populated links per tray with the remaining cages inspectable.
    ports.forEach(({x,dy},port) => {
      const y=rowY+dy;
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
      if (h100) {
        hardware.box(.025,.003,.075,shell,x,y+.009,z+.042);
        for(let fin=0;fin<8;fin++)hardware.box(.0012,.010,.073,shell,x-.0105+fin*.003,y+.015,z+.042);
      }
      const connectorCount = h100 || accel === 'gb300' ? 2 : 1;
      for (let lane=0;lane<connectorCount;lane++) {
        const cx=x+(connectorCount===2?(lane-.5)*.009:0);
        hardware.box(connectorCount===2?.0075:.014,.007,.018,connector,cx,y,z+direction*.03);
        for(let rib=0;rib<4;rib++)hardware.box(connectorCount===2?.0078:.0143,.0074,.0012,MAT.black,cx,y,z+direction*(.035+rib*.002));
        const side = Math.sign(x), rail = side*(.365+(index%6)*.0028);
        const managerZ=(h100?-.63:.64)+direction*(Math.floor(index/6)*.007+lane*.0032);
        const start=[cx,y,z+direction*.044], end=[rail,2.32,managerZ];
        // Short faceplate run, then a controlled side return for the extended
        // service tray. Neighboring leads share a narrow, combed riser corridor.
        const exitZ=z+direction*(.105+lane*.008);
        const points=managedRoute([start,[cx,y,exitZ],[rail,y,exitZ],
          [rail,y,managerZ],[rail,y+.10,managerZ],end]);
        const motion=flow(points,'eth',{count:8,speed:.30,size:.0013,k:1,trail:false});
        // Many neighboring fibers must remain individually readable; their
        // moving cores use less ribbon emission than the single backbone.
        motion.ribbonIntensity=.28;
        motion.rackOpticalLink={row,port,lane,start,end,managed:true};
        hardware.addM(new THREE.TubeGeometry(motion.path,96,.0014,5,false),jacket,new THREE.Matrix4());
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
    const storage = h100 ? [-.096,-.069,.069,.096] : rubin ? [-.018,.018] : accel==='gb200' ? [-.187,-.16,.16,.187] : [.16,.187];
    for(const x of storage) {
      const y=rowY+(rubin?.008:.021);
      for(const s of [-1,1]) {
        hardware.box(.0185,.001,.012,shell,x,y+s*.0048,z);
        hardware.box(.001,.0086,.012,shell,x+s*.0093,y,z);
      }
      hardware.box(.0165,.0075,.001,MAT.black,x,y,z-direction*.004);
      storageCages.push({row,position:[x,y,z],form:'QSFP',role:'storage/in-band'});
    }
  });
  for (const side of [-1,1]) {
    const center=side*.372,managerZ=h100?-.63:.64;
    hardware.box(.042,.033,.008,MAT.darkSteel,center,2.327,managerZ+(h100?.012:-.012));
    // Open-sided vertical managers support the bundle without hiding motion.
    hardware.box(.004,2.16,.055,MAT.darkSteel,side*.397,1.22,managerZ);
    for(let y=.22;y<2.31;y+=.18) {
      hardware.box(.043,.006,.004,shell,side*.377,y,managerZ+(h100?.031:-.013));
      hardware.box(.004,.016,.055,MAT.darkSteel,side*.351,y,managerZ+.008);
    }
    // Each patch strip's outgoing multifiber loom continues into the overhead
    // runway. This is a cable bundle, not an optical combiner or active switch.
    for(let strand=0;strand<4;strand++) {
      const x=center+(strand-1.5)*.0035,z=managerZ;
      const f=flow(managedRoute([[x,2.34,z],[x,3.54,z],
        [side*(.12+strand*.007),3.66,z],[side*(.12+strand*.007),3.66,-1.52]],.10),'eth',{count:9,speed:.4,size:.0017,k:1,trail:false});
      f.ribbonIntensity=.30;f.rackOpticalTrunk=true;
      hardware.addM(new THREE.TubeGeometry(f.path,64,.0018,5,false),jacket,new THREE.Matrix4());
      built.dataFlows.push(f);built.scene.add(f.group);
    }
  }
  const mesh=hardware.build();mesh.name='Rack optical population and passive patch terminations';built.scene.add(mesh);
  built.scene.userData.rackOptics={modules,links,storageCages,cagesPerTray:ports.length,representative:true,termination:'passive patch strip'};
  const hero=modules.find(m=>m.pulled && (h100 ? m.position[0]>0 : true));
  if(hero && built.dataHotspots.uplinks) {
    const [x,y,z]=hero.position;
    built.dataHotspots.uplinks={pos:[x,y+.012,z+(h100?-.024:.024)],view:{pos:[x+(h100?.35:-.12),y+(h100?.22:.11),z+(h100?-.45:.40)],target:[x,y,z],focus:[x,y,z],detailSize:h100?[.22,.12,.25]:[.13,.065,.18]}};
  }
}
