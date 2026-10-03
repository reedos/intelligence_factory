import { THREE, canvasTex, mtx } from '../kit.js';

// Scenic context and approximate light spill, not a lighting or civil-engineering model.
// The light pools are one instanced draw rather than a light for every fixture.
export function campusLightPools(scene, fixtures) {
  const tex = canvasTex(128, 128, (g, w, h) => {
    const fade = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    fade.addColorStop(0, 'rgba(255,230,182,0.55)');
    fade.addColorStop(0.3, 'rgba(255,209,145,0.24)');
    fade.addColorStop(1, 'rgba(255,193,116,0)');
    g.fillStyle = fade; g.fillRect(0, 0, w, h);
  });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true,
    depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: 0.4 });
  const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.InstancedMesh(geo, mat, fixtures.length);
  mesh.name = 'Approximate warm spill from site fixtures';
  const o = new THREE.Object3D();
  fixtures.forEach(({ p, spill = 28, ground = 0.32 }, i) => {
    o.position.set(p[0], ground, p[2]); o.scale.set(spill, 1, spill);
    o.updateMatrix(); mesh.setMatrixAt(i, o.matrix);
  });
  scene.add(mesh);
}

export function campusHorizon(scene, { reach }) {
  // A low ridgeline beyond the modeled campus, clear of the transmission corridor. Enough segments for the
  // crest to read as a smooth curve rather than a stepped line at phone resolution, and the taller peaks -
  // the part of the silhouette that cuts against the sky - are tinted toward the fog/dusk-horizon color, so
  // any facet that remains softens into haze instead of showing a hard, high-contrast edge.
  const radius = Math.max(3500, reach + 1800), segments = 480;
  const geo = new THREE.BufferGeometry(), vertices = [], colors = [], indices = [];
  const base = new THREE.Color(0x243c48);
  const haze = (scene.fog ? scene.fog.color.clone() : new THREE.Color(0x243a55)).lerp(new THREE.Color(0x9b807a), 0.4);
  const heights = [];
  for (let i = 0; i <= segments; i++) {
    const a = i / segments * Math.PI * 2;
    heights.push(65 + 30 * Math.sin(a * 5 + 1) + 18 * Math.sin(a * 11) + 9 * Math.sin(a * 23));
  }
  const minH = Math.min(...heights), maxH = Math.max(...heights);
  for (let i = 0; i <= segments; i++) {
    const a = i / segments * Math.PI * 2, height = heights[i];
    // the top third of each peak's rise fades toward the haze color; valleys stay the solid hill color
    const fade = THREE.MathUtils.smoothstep(height, minH + (maxH - minH) * 0.35, maxH);
    const c = base.clone().lerp(haze, fade * 0.85);
    for (const [r, y] of [[radius - 550, -1], [radius, height], [radius + 700, 10]]) {
      vertices.push(Math.cos(a) * r, y, Math.sin(a) * r);
      colors.push(c.r, c.g, c.b);
    }
    if (i < segments) for (let row = 0; row < 2; row++) {
      const n = i * 3 + row; indices.push(n, n + 3, n + 1, n + 1, n + 3, n + 4);
    }
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices); geo.computeVertexNormals();
  const hills = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }));
  hills.name = 'Illustrative distant ridgeline'; scene.add(hills);
}

// A continuous, irregular northern tree belt gives the flat site a landscape edge.
// Additional halls expand east, so this belt sits outside their north edge too.
export function campusTreeBelt(treeMx, rnd, { extra, perCol, mobile }) {
  const zEdge = extra ? Math.min(-410, -perCol * 60 - 130) : -410;
  const count = mobile ? 140 : 360;
  for (let i = 0; i < count; i++) {
    const x = -620 + rnd() * 1220;
    const z = zEdge - rnd() * 90 - 18 * Math.sin(x / 80);
    treeMx.push(mtx(x, 0, z, rnd() * Math.PI * 2, 0.8 + rnd() * 0.85));
  }
}
