import { SiteBuilder as Builder, preloadSiteConstruction, finalizeSiteGeometry, hasSiteConstruction } from './site-blender-construction.js';
import { THREE, MAT, canvasTex } from '../kit.js';
import { hasCampusCatalog, campusCatalogBuilder } from './campus-blender-catalog.js';

// Three irregular broadleaf silhouettes, with visible branches and gaps between
// crown clusters. All copies are instanced; movement is a small vertex offset.
export function campusWoodland(scene, matrices, { mobile = false, reduced = false } = {}) {
  const time = { value: 0 }, grove = new THREE.Group(); grove.name = 'Campus woodland';
  const wind = shader => {
    shader.uniforms.uGroveTime = time;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float uGroveTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 seed = vec3(0.0);
        #ifdef USE_INSTANCING
          seed = instanceMatrix[3].xyz;
        #endif
        float bend = smoothstep(2.5, 12.0, transformed.y);
        transformed.x += sin(uGroveTime * .65 + seed.x * .027 + seed.z * .019) * bend * .12;
        transformed.z += sin(uGroveTime * .43 + seed.z * .035) * bend * .08;`);
  };
  for (let variant = 0; variant < 3; variant++) {
    let seed = 81 + variant * 37; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
    const authored = hasCampusCatalog();
    const B = authored ? campusCatalogBuilder(`TREE${variant}`) : new Builder();
    const foliage = [0x365542, 0x4a6550, 0x536b51].map(color => {
      const mat = new THREE.MeshStandardMaterial({ color, roughness: .94, flatShading: false });
      if (!reduced) { mat.onBeforeCompile = wind; mat.customProgramCacheKey = () => 'campus-grove-wind-v1'; }
      return mat;
    });
    if (!authored) { B.cyl(.25, 6.5, MAT.trunk, 0, 3.25, 0, 6);
    const clump = new THREE.IcosahedronGeometry(1, 1);
    const p = clump.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const r = 1 + .18 * Math.sin(x * 9 + z * 7) * Math.cos(y * 11 - x * 4);
      p.setXYZ(i, x * r, y * r, z * r);
    }
    clump.computeVertexNormals();
    const count = mobile ? 9 : 15;
    for (let i = 0; i < count; i++) {
      const a = i * 2.399 + variant, spread = 1.5 + rnd() * 2.6;
      const x = Math.cos(a) * spread, z = Math.sin(a) * spread;
      const y = 6.1 + rnd() * 3.4 + (variant === 1 ? 1.5 : 0);
      const scale = .9 + rnd() * .75;
      B.strut([0, 3 + rnd() * 2, 0], [x, y, z], .07, MAT.trunk, 4);
      B.add(clump, foliage[i % 3], x, y, z, rnd(), a, 0, scale * 1.25, scale * (variant === 1 ? 1.8 : 1.05), scale);
    }
    } else {
      for(const mat of B.parts.keys()) if(mat.name.startsWith('Foliage')) {
        foliage.push(mat);
        if(!reduced) { mat.onBeforeCompile=wind; mat.customProgramCacheKey=()=> 'campus-blender-grove-wind-v1'; }
      }
    }
    const group = B.instance(matrices.filter((_, i) => i % 3 === variant));
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    if (!reduced) { depth.onBeforeCompile = wind; depth.customProgramCacheKey = () => 'campus-grove-wind-depth-v1'; }
    group.traverse(mesh => { if (mesh.isMesh && foliage.includes(mesh.material)) mesh.customDepthMaterial = depth; });
    grove.add(group);
  }
  scene.add(grove);
  return t => { time.value = reduced ? 0 : t; };
}

// A feathered landscape boundary replaces the hard rectangular green platform.
// Surface lies below roads and equipment pads; no utility geometry is displaced.
export function campusMeadow(scene) {
  const tex = canvasTex(512, 256, (g, w, h) => {
    for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
      const edge = Math.min(x / 30, (w - x) / 30, y / 24, (h - y) / 24, 1);
      const noise = Math.sin(x * .071 + y * .12) * Math.sin(y * .047 - x * .035);
      const v = Math.round(48 + noise * 5);
      g.fillStyle = `rgba(${v},${v + 19},${v + 10},${Math.max(0, edge)})`;
      g.fillRect(x, y, 2, 2);
    }
  });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const meadow = new THREE.Mesh(new THREE.PlaneGeometry(1160, 660), new THREE.MeshStandardMaterial({
    map: tex, transparent: true, depthWrite: false, roughness: 1,
  }));
  meadow.rotation.x = -Math.PI / 2; meadow.position.set(-70, .08, -40); meadow.receiveShadow = true;
  meadow.name = 'Feathered campus meadow'; scene.add(meadow);
}

// Soft ground contact only, not projected fake equipment or utility connections.
export function campusContactShade(scene, rectangles) {
  const tex = canvasTex(64, 64, (g, w, h) => {
    for (let i = 0; i < 10; i++) {
      g.fillStyle = 'rgba(0,0,0,0.05)';
      g.fillRect(i * 2, i * 2, w - i * 4, h - i * 4);
    }
  });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: .6 });
  const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
  const shadows = new THREE.InstancedMesh(geo, mat, rectangles.length), o = new THREE.Object3D();
  rectangles.forEach(([x, y, z, w, d], i) => {
    o.position.set(x, y, z); o.scale.set(w, 1, d); o.updateMatrix(); shadows.setMatrixAt(i, o.matrix);
  });
  shadows.name = 'Approximate ground contact shade'; scene.add(shadows);
}
