// The GPU package's HBM "waterfall" (data layer, schematic: evidence 'hbm-flow-drawing'). Per HBM stack, one sheet
// of fine parallel strands runs level across the stack's top toward its die-facing edge, breaks over that edge in a
// smooth parabola and falls onto the die on that side, where a soft "plunge pool" glows. Comet streaks (a bright head,
// a fading tail) run down every strand; the stacks pulse in a slow wave around the package.
//
// All strands of all stacks are one merged ribbon mesh and all pools a second mesh: two draw calls,
// whatever the stack count. Ribbons lie flat across the flow (their width runs along the shared edge), so the sheet
// reads from above. Reduced motion: slower streaks, no pulse. Low quality tiers draw every other strand.
import { THREE } from '../kit.js';

export const WATERFALL_STRANDS = 11;

// profile of one strand, s in [0, 1]: a level run over the stack top, then a parabola down to the landing line.
// `r(s)` is the distance from the package centre toward the stack; `y(s)` the height.
export function waterfallProfile({ start, edge, land, top, dieTop, lift = 0.08 }) {
  const run = start - edge, fall = edge - land, total = run + fall, ky = top + lift;
  return s => {
    const d = s * total;
    if (d <= run) return { r: start - d, y: ky };
    const q = (d - run) / fall;                               // 0 at the edge, 1 at the landing line
    return { r: edge - q * fall, y: ky - (ky - dieTop) * q * q };
  };
}

const vert = /* glsl */`
attribute float aU; attribute float aV; attribute float aStrand; attribute float aStack; attribute vec3 aSide;
uniform float uHalf; uniform float uMinPx; uniform float uPxK;
varying float vU; varying float vV; varying float vStrand; varying float vStack;
void main() {
  vU = aU; vV = aV; vStrand = aStrand; vStack = aStack;
  // a strand keeps at least uMinPx pixels of width however far the camera is (uPxK: world units per pixel per unit depth)
  float depth = -(modelViewMatrix * vec4(position, 1.0)).z;
  float half_ = max(uHalf, 0.5 * uMinPx * uPxK * depth);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position + aSide * aV * half_, 1.0);
}`;
const strandFrag = /* glsl */`
uniform float uTime; uniform float uSpeed; uniform float uPulse; uniform float uStep; uniform float uGain; uniform vec3 uColor;
varying float vU; varying float vV; varying float vStrand; varying float vStack;
void main() {
  if (mod(vStrand, uStep) > 0.5) discard;
  float f = fract(vU * 1.7 - uTime * uSpeed);                        // two comets per strand, moving stack -> die
  float tail = smoothstep(0.15, 0.93, f) * (1.0 - smoothstep(0.955, 1.0, f));
  float head = smoothstep(0.90, 0.955, f) * (1.0 - smoothstep(0.965, 1.0, f));
  float across = 1.0 - vV * vV;
  float ends = smoothstep(0.0, 0.07, vU) * (1.0 - smoothstep(0.94, 1.0, vU));
  float wave = 0.5 + 0.5 * sin(uTime * 1.25 - vStack * 6.2832);
  float pulse = mix(0.9, 0.65 + 0.55 * wave * wave, uPulse);
  float k = (0.6 + 1.9 * tail * tail + 4.2 * head) * across * ends * pulse * uGain;
  vec3 c = mix(uColor, vec3(1.0, 0.93, 1.0), head * 0.6);
  gl_FragColor = vec4(c * k, 1.0);
}`;
const poolFrag = /* glsl */`
uniform float uTime; uniform float uPulse; uniform float uGain; uniform vec3 uColor;
varying float vU; varying float vV; varying float vStack;
void main() {
  float r = length(vec2(vU * 2.0 - 1.0, vV));                        // elliptical through the quad's aspect
  if (r > 1.0) discard;
  float wave = 0.5 + 0.5 * sin(uTime * 1.25 - vStack * 6.2832);
  float pulse = mix(0.8, 0.45 + 0.75 * wave * wave, uPulse);
  float ring = 0.5 + 0.5 * sin(r * 14.0 - uTime * 3.0 * (0.4 + 0.6 * uPulse));
  float k = ((1.0 - r) * (1.0 - r) * 1.1 + ring * (1.0 - r) * 0.22) * pulse * uGain;
  gl_FragColor = vec4(uColor * k, 1.0);
}`;

// stacks: [{ along: unit [x, z] along the shared edge, out: unit [x, z] from the package centre toward the stack,
//   centre: along-edge centre coordinate, width: strand span, profile(s) -> { r, y }, phase: 0..1 around the package }]
export function hbmWaterfall({ stacks, color: css = '#b08cff', strandWidth = 0.03 }) {
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const N = WATERFALL_STRANDS, SEG = 48;
  const pos = [], aU = [], aV = [], aStrand = [], aStack = [], aSide = [], idx = [];
  const poolPos = [], pU = [], pV = [], pStack = [], pIdx = [];
  const centerlines = [];
  const at = (st, t, s) => {
    const { r, y } = st.profile(s);
    return [st.out[0] * r + st.along[0] * t, y, st.out[1] * r + st.along[1] * t];
  };
  for (const st of stacks) {
    for (let k = 0; k < N; k++) {
      const t = st.centre + (k / (N - 1) - 0.5) * st.width, base = pos.length / 3, line = [];
      for (let j = 0; j <= SEG; j++) {
        const s = j / SEG, c = at(st, t, s); line.push(c);
        for (const side of [-1, 1]) {
          pos.push(c[0], c[1], c[2]); aSide.push(st.along[0], 0, st.along[1]);
          aU.push(s); aV.push(side); aStrand.push(k); aStack.push(st.phase);
        }
        if (j) { const a = base + (j - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      centerlines.push(line);
    }
    // the plunge pool: a flat ellipse on the die top along the landing line, a little wider than the sheet
    const land = st.profile(1), half = st.width / 2 + 0.12, depth = 0.16, b = poolPos.length / 3;
    for (const [u, v] of [[0, -1], [1, -1], [1, 1], [0, 1]]) {
      const t = st.centre + (u * 2 - 1) * half, r = land.r + v * depth;
      poolPos.push(st.out[0] * r + st.along[0] * t, land.y + 0.004, st.out[1] * r + st.along[1] * t);
      pU.push(u); pV.push(v); pStack.push(st.phase);
    }
    pIdx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  for (const [n, a] of [['aU', aU], ['aV', aV], ['aStrand', aStrand], ['aStack', aStack]]) g.setAttribute(n, new THREE.Float32BufferAttribute(a, 1));
  g.setAttribute('aSide', new THREE.Float32BufferAttribute(aSide, 3));
  g.setIndex(idx);
  const color = new THREE.Color(css);
  const common = { uTime: { value: 0 }, uPulse: { value: reduced ? 0 : 1 }, uGain: { value: 1 }, uColor: { value: color }, uPxK: { value: 0.001 } };
  const strandMat = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: strandFrag, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: { ...common, uSpeed: { value: reduced ? 0.12 : 0.55 }, uStep: { value: 1 }, uHalf: { value: strandWidth / 2 }, uMinPx: { value: 2.0 } } });
  const strands = new THREE.Mesh(g, strandMat); strands.name = 'HBM waterfall strands (schematic)'; strands.renderOrder = 5; strands.frustumCulled = false;
  // world units per pixel per unit of depth, for the strands' minimum on-screen width
  const _size = new THREE.Vector2();
  strands.onBeforeRender = (renderer, _s, camera) => {
    renderer.getDrawingBufferSize(_size);
    common.uPxK.value = camera.isPerspectiveCamera ? 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / Math.max(1, _size.y) : 0;
  };
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.Float32BufferAttribute(poolPos, 3));
  for (const [n, a] of [['aU', pU], ['aV', pV], ['aStack', pStack], ['aStrand', pStack.map(() => 0)]]) pg.setAttribute(n, new THREE.Float32BufferAttribute(a, 1));
  pg.setAttribute('aSide', new THREE.Float32BufferAttribute(new Float32Array(poolPos.length), 3));
  pg.setIndex(pIdx);
  const poolMat = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: poolFrag, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, toneMapped: false, uniforms: { ...common, uHalf: { value: 0 }, uMinPx: { value: 0 } } });
  const pools = new THREE.Mesh(pg, poolMat); pools.name = 'HBM waterfall plunge pools (schematic)'; pools.renderOrder = 4; pools.frustumCulled = false;
  const group = new THREE.Group(); group.name = 'HBM waterfall (schematic)'; group.add(pools, strands);
  group.userData.flowAuditIgnore = 'schematic overlay';
  for (const m of [strands, pools]) m.userData.flowAuditIgnore = 'schematic overlay';
  return {
    group, centerlines,
    // tier: the site's render-quality tier (render-quality.js TIERS): fewer strands where particles are cut
    setTier(tier) { strandMat.uniforms.uStep.value = (tier?.particles ?? 1) < 0.5 ? 2 : 1; common.uGain.value = tier?.bloom === false ? 1.35 : 1; },
    update(t, visible) { group.visible = visible; common.uTime.value = t; },
    dispose() { g.dispose(); pg.dispose(); strandMat.dispose(); poolMat.dispose(); },
  };
}
