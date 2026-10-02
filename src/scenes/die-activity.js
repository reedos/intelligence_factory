// On-die activity for the GPU package's data layer (schematic: evidence 'die-activity-drawing'). Not a real floorplan or
// a scheduling trace: it shows compute being scheduled across the die's tiles and the memory traffic feeding it.
//   tiles    every compute tile of the x-ray floorplan (chip.js floorplanLayout) carries a bright point and a soft wash
//            that fire in short, staggered bursts riding rolling waves across the die; brightness varies tile to tile
//   streaks  comet streaks on Manhattan on-die paths: from each HBM waterfall's landing line straight inward to the L2
//            band, along it toward the die's middle; from the middle out along the band and up or down a column to
//            tiles; and, on two-die packages, bursts across the NV-HBI seam. Every path stays on its die except the
//            seam crossings, the one documented die-to-die interface.
// Two draw calls: one merged tile mesh, one merged streak mesh. The activity rides the waterfall's pulse wave (the same
// 1.25 rad/s wave around the package), so the compute brightens as the memory beside it pours.
// Reduced motion: a calm shimmer, no waves, slow streaks. Low quality tiers draw half the tiles and streaks.
import { THREE } from '../kit.js';

const tileVert = /* glsl */`
attribute vec2 aLocal; attribute vec3 aSeed; attribute vec2 aCentre;
varying vec2 vLocal; varying vec3 vSeed; varying vec2 vCentre;
void main() { vLocal = aLocal; vSeed = aSeed; vCentre = aCentre; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const tileFrag = /* glsl */`
uniform float uTime; uniform float uWaves; uniform float uGain; uniform float uHalf; uniform float uFar; uniform vec3 uColor;
varying vec2 vLocal; varying vec3 vSeed; varying vec2 vCentre;
void main() {
  if (uHalf > 0.5 && vSeed.z > 0.5) discard;                         // low tiers: every other tile
  float ang = atan(vCentre.y, vCentre.x) / 6.2832;
  float pour = 0.5 + 0.5 * sin(uTime * 1.25 - ang * 6.2832);           // the waterfall's wave around the package
  // two rolling waves across the die at different angles and speeds; each tile fires a short burst as one passes,
  // staggered by its own seed so neighbours do not blink together
  float w1 = fract(uTime * 0.42 - (vCentre.x * 0.16 + vCentre.y * 0.11) - vSeed.x * 0.22);
  float w2 = fract(uTime * 0.29 + (vCentre.x * 0.09 - vCentre.y * 0.17) - vSeed.y * 0.31);
  float burst = max(smoothstep(0.0, 0.035, w1) * (1.0 - smoothstep(0.035, 0.22, w1)), 0.8 * smoothstep(0.0, 0.04, w2) * (1.0 - smoothstep(0.04, 0.26, w2)));
  float calm = 0.35 + 0.25 * sin(uTime * 0.6 + vSeed.x * 6.2832);
  float act = mix(calm, (0.08 + 1.9 * burst) * (0.5 + 0.7 * pour), uWaves) * (0.45 + 1.0 * vSeed.y);
  vec2 d = vLocal - 0.5;
  float core = exp(-dot(d, d) * (90.0 - 40.0 * uFar));                // the bright point at the tile's centre
  float wash = smoothstep(0.5, 0.36, max(abs(d.x), abs(d.y))) * 0.07;   // the tile, faintly lit
  vec3 c = mix(uColor, vec3(1.0), core * 0.7);
  gl_FragColor = vec4(c * (core * 3.6 * (1.0 + 0.7 * uFar) + wash) * act * uGain, 1.0);
}`;
const streakVert = /* glsl */`
attribute float aU; attribute float aV; attribute float aSeed; attribute vec3 aSide; attribute float aHalf;
uniform float uHalfW; uniform float uMinPx; uniform float uPxK; uniform float uFar;
varying float vU; varying float vV; varying float vSeed; varying float vDrop;
void main() {
  vU = aU; vV = aV; vSeed = aSeed; vDrop = aHalf;
  float depth = -(modelViewMatrix * vec4(position, 1.0)).z;
  float half_ = max(uHalfW, 0.5 * uMinPx * (1.0 + uFar) * uPxK * depth);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position + aSide * aV * half_, 1.0);
}`;
const streakFrag = /* glsl */`
uniform float uTime; uniform float uSpeed; uniform float uWaves; uniform float uGain; uniform float uHalf; uniform float uFar; uniform vec3 uColor;
varying float vU; varying float vV; varying float vSeed; varying float vDrop;
void main() {
  if (uHalf > 0.5 && vDrop > 0.5) discard;
  float f = fract(vU * 1.3 - uTime * uSpeed - vSeed);
  float tail = smoothstep(0.35, 0.94, f) * (1.0 - smoothstep(0.96, 1.0, f));
  float head = smoothstep(0.92, 0.965, f) * (1.0 - smoothstep(0.97, 1.0, f));
  float across = 1.0 - vV * vV;
  float ends = smoothstep(0.0, 0.05, vU) * (1.0 - smoothstep(0.95, 1.0, vU));
  float k = (0.05 + 1.3 * tail * tail + 3.2 * (1.0 + 0.8 * uFar) * head) * across * ends * mix(0.5, 1.0, uWaves) * uGain;
  gl_FragColor = vec4(mix(uColor, vec3(1.0), head * 0.75) * k, 1.0);
}`;

// dies: [{ x, rot (true: the decal is turned 180 degrees), tiles: [{ x, y, w, h }] in canvas px, cw, ch (canvas size) }]
// face: [w, d] of the decal in world units; y: the die top. feeds: [{ from: [x, z], die index }] the waterfalls' landing
// points (one per stack sheet, its centre), seam: z positions of the NV-HBI crossings (two-die packages only)
export function dieActivity({ dies, face, y, feeds, seam = [], color = '#bff4ff' }) {
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const toWorld = (die, px, py) => { const s = die.rot ? -1 : 1; return [die.x + s * (px / die.cw - 0.5) * face[0], s * (py / die.ch - 0.5) * face[1]]; };
  // ---- tiles ----
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const tp = [], tl = [], ts = [], tc = [], ti = [], tileCentres = [];
  dies.forEach(die => die.tiles.forEach((t, k) => {
    const pad = 5, [x0, z0] = toWorld(die, t.x + pad, t.y + pad), [x1, z1] = toWorld(die, t.x + t.w - pad, t.y + t.h - pad);
    const lo = [Math.min(x0, x1), Math.min(z0, z1)], hi = [Math.max(x0, x1), Math.max(z0, z1)], b = tp.length / 3;
    for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) { tp.push(lo[0] + u * (hi[0] - lo[0]), y, lo[1] + v * (hi[1] - lo[1])); tl.push(u, v); }
    const sd = [rnd(), rnd(), k % 2], cx = (lo[0] + hi[0]) / 2, cz = (lo[1] + hi[1]) / 2;
    for (let q = 0; q < 4; q++) { ts.push(...sd); tc.push(cx, cz); }
    ti.push(b, b + 2, b + 1, b, b + 3, b + 2);
    tileCentres.push({ x: cx, z: cz, lo, hi });
  }));
  const tg = new THREE.BufferGeometry();
  tg.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3));
  tg.setAttribute('aLocal', new THREE.Float32BufferAttribute(tl, 2));
  tg.setAttribute('aSeed', new THREE.Float32BufferAttribute(ts, 3));
  tg.setAttribute('aCentre', new THREE.Float32BufferAttribute(tc, 2));
  tg.setIndex(ti);
  const col = new THREE.Color(color);
  const shared = { uTime: { value: 0 }, uWaves: { value: reduced ? 0 : 1 }, uGain: { value: 1 }, uHalf: { value: 0 }, uFar: { value: 0 }, uColor: { value: col } };
  const tileMat = new THREE.ShaderMaterial({ vertexShader: tileVert, fragmentShader: tileFrag, uniforms: shared, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide });
  const tileMesh = new THREE.Mesh(tg, tileMat); tileMesh.name = 'On-die activity tiles (schematic)'; tileMesh.renderOrder = 4; tileMesh.frustumCulled = false;
  // ---- streak paths (Manhattan, on the die top) ----
  const paths = [];
  const dieOf = i => dies[i], halfW = face[0] / 2;
  const band = 0.07;                                                       // the L2 band's half-depth, around z = 0
  feeds.forEach(({ from, die, axis }) => {
    const d = dieOf(die);
    if (axis === 'z') {      // the stack faces the die across a z edge: inward in z to the band, then along it to the die's middle
      const sz = Math.sign(from[1]);
      paths.push({ pts: [[from[0], from[1]], [from[0], sz * band], [d.x, sz * band]], kind: 'feed' });
    } else {                 // across an x edge (H100): inward in x to near the middle column, then in z to the band
      const sx = Math.sign(from[0]);
      paths.push({ pts: [[from[0], from[1]], [d.x + sx * 0.18, from[1]], [d.x + sx * 0.18, Math.sign(from[1] || 1) * band]], kind: 'feed' });
    }
  });
  // distribution: from the middle of each die along the band, then up or down a tile column to a tile
  dies.forEach((d, di) => {
    const cols = [...new Set(d.tiles.map(t => t.x))].sort((a, b) => a - b);
    cols.forEach((cx, ci) => {
      for (const side of [-1, 1]) {
        if ((ci + (side > 0 ? 0 : 1)) % 2) continue;                       // every other column each side: no clutter
        const t = d.tiles.filter(q => q.x === cx).map(q => toWorld(d, q.x + q.w / 2, q.y + q.h / 2)).filter(([, z]) => Math.sign(z) === side);
        if (!t.length) continue;
        const far = t.reduce((a, b) => (Math.abs(b[1]) > Math.abs(a[1]) ? b : a)), x = far[0];
        paths.push({ pts: [[d.x, side * band * 0.5], [x, side * band * 0.5], [x, far[1] * 0.92]], kind: 'out' });
      }
    });
  });
  // NV-HBI: straight across the seam, both directions, between the two dies' middles
  if (dies.length > 1) seam.forEach((z, k) => {
    const a = dies[0].x * 0.35, b = dies[1].x * 0.35;
    paths.push({ pts: k % 2 ? [[b, z], [a, z]] : [[a, z], [b, z]], kind: 'hbi' });
  });
  const sp = [], su = [], sv = [], ss = [], sside = [], shalf = [], si = [];
  paths.forEach((p, k) => {
    // resample the polyline evenly so the comet moves at one speed around corners
    const L = []; let total = 0;
    for (let i = 1; i < p.pts.length; i++) { const l = Math.hypot(p.pts[i][0] - p.pts[i - 1][0], p.pts[i][1] - p.pts[i - 1][1]); L.push(l); total += l; }
    const N = Math.max(8, Math.ceil(total / 0.04)), at = s => {
      let d = s * total;
      for (let i = 0; i < L.length; i++) { if (d <= L[i] || i === L.length - 1) { const f = L[i] ? Math.min(1, d / L[i]) : 0; return [p.pts[i][0] + (p.pts[i + 1][0] - p.pts[i][0]) * f, p.pts[i][1] + (p.pts[i + 1][1] - p.pts[i][1]) * f, i]; } d -= L[i]; }
    };
    const base = sp.length / 3, sd = ((k * 0.618) % 1) * (p.kind === 'hbi' ? 0.5 : 1);
    for (let j = 0; j <= N; j++) {
      const [x, z, i] = at(j / N), dx = p.pts[i + 1][0] - p.pts[i][0], dz = p.pts[i + 1][1] - p.pts[i][1], l = Math.hypot(dx, dz) || 1;
      for (const v of [-1, 1]) { sp.push(x, y + 0.004, z); su.push(j / N); sv.push(v); ss.push(sd); sside.push(-dz / l, 0, dx / l); shalf.push(k % 2); }
      if (j) { const a = base + (j - 1) * 2; si.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
  });
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  for (const [n, a, k] of [['aU', su, 1], ['aV', sv, 1], ['aSeed', ss, 1], ['aSide', sside, 3], ['aHalf', shalf, 1]]) sg.setAttribute(n, new THREE.Float32BufferAttribute(a, k));
  sg.setIndex(si);
  const streakMat = new THREE.ShaderMaterial({ vertexShader: streakVert, fragmentShader: streakFrag, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: { ...shared, uSpeed: { value: reduced ? 0.1 : 0.7 }, uHalfW: { value: 0.012 }, uMinPx: { value: 1.6 }, uPxK: { value: 0.001 } } });
  const streaks = new THREE.Mesh(sg, streakMat); streaks.name = 'On-die data streaks (schematic)'; streaks.renderOrder = 5; streaks.frustumCulled = false;
  const _size = new THREE.Vector2(), centre = new THREE.Vector3(0, y, 0);
  streaks.onBeforeRender = (renderer, _s, camera) => {
    renderer.getDrawingBufferSize(_size);
    streakMat.uniforms.uPxK.value = camera.isPerspectiveCamera ? 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / Math.max(1, _size.y) : 0;
    shared.uFar.value = THREE.MathUtils.smoothstep(camera.position.distanceTo(centre), 9, 15);
  };
  const group = new THREE.Group(); group.name = 'On-die activity (schematic)'; group.add(tileMesh, streaks);
  for (const o of [group, tileMesh, streaks]) o.userData.flowAuditIgnore = 'schematic overlay';
  return {
    group, paths: paths.map(p => ({ kind: p.kind, pts: p.pts.map(([x, z]) => [x, y, z]) })), tiles: tileCentres,
    setTier(tier) { shared.uHalf.value = (tier?.particles ?? 1) < 0.5 ? 1 : 0; shared.uGain.value = tier?.bloom === false ? 1.3 : 1; },
    update(t, visible) { group.visible = visible; shared.uTime.value = t; },
    dispose() { tg.dispose(); sg.dispose(); tileMat.dispose(); streakMat.dispose(); },
  };
}
