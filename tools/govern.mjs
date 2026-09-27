// Watches the quality governor on one view and checks it does what it claims, on the real GPU or in software.
// Usage: node tools/govern.mjs <mode> [scene] [layer]      e.g. node tools/govern.mjs load 2 data
//   watch     the tier it settles on, frame rate, GPU and draw time
//   soft      the same in software rendering (SwiftShader): a very slow GPU; expect it to step down to the bottom
//   climb     force tier 3, then expect it to climb back while the GPU has room
//   res       force tiers 3 to 6 under a fill-bound load: the passes must draw at the tier's resolution, so GPU time falls
//   throttle  rAF capped near 30 fps with the GPU idle (a battery saver): expect it to keep full quality
//   load      a heavy full-screen shader in the scene (a weak GPU): expect it to step down, then climb once it is gone
// Every mode checks each tier's effects are really off, and reports page errors.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [mode = 'watch', scene = '2', layer = 'data'] = process.argv.slice(2);
const soft = mode === 'soft';
const b = await chromium.launch({ headless: true, args: soft ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: soft ? { width: 1280, height: 800 } : { width: 1920, height: 1080 }, deviceScaleFactor: soft ? 1 : 1.5 });
const errors = []; p.on('pageerror', e => errors.push(e.message));
if (mode === 'throttle') await p.addInitScript(() => {   // every callback runs on every other frame, as a 30 fps cap does
  const raf = window.requestAnimationFrame.bind(window); let queue = [], armed = false, last = -1e9;
  const arm = () => { if (!armed) { armed = true; raf(pump); } };
  const pump = t => { armed = false; if (t - last < 30) return arm(); last = t; const q = queue; queue = []; q.forEach(cb => cb(t)); };
  window.requestAnimationFrame = cb => { queue.push(cb); arm(); return 0; };
});
await p.goto((process.env.URL || 'http://127.0.0.1:47400/') + '?govern');
await p.waitForFunction(() => window.ifx && ifx.state.scene === 0, null, { timeout: 120000 });
await p.evaluate(async ([sc, m]) => {
  document.querySelector('.view').scrollIntoView({ block: 'center' });
  await ifx.show({ scene: +sc, mode: m, part: null }, { scroll: false }); ifx.settle();
  window.__fps = []; let last = performance.now(), n = 0;
  const tick = now => { n++; if (now - last >= 1000) { __fps.push(n * 1000 / (now - last)); n = 0; last = now; } requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}, [scene, layer]);
const state = () => p.evaluate(() => {
  const i = ifx.state.scene, q = ifx.quality(), c = ifx.composers[i], bb = ifx.built[i];
  const mirrors = []; bb.scene.traverse(o => { if (o.isReflector) mirrors.push(o.visible); });
  return { tier: q.tiers[i], ceiling: q.ceilings[i], ratio: q.ratio, composerRatio: q.composerRatio, rtWidth: c.renderTarget1.width, gpuMs: q.gpuMs, drawMs: q.drawMs, fps: __fps.at(-1), gpu: q.gpu, timers: q.timers, integrated: q.integrated,
    mirror: mirrors.length ? mirrors.every(Boolean) : null, ao: q.ao, samples: c.renderTarget1.samples, liveShadows: ifx.renderer().shadowMap.autoUpdate, q };
});
const s0 = await state();
console.log(`${s0.gpu}\ntimers ${s0.timers}, integrated ${s0.integrated}; ${mode}, scene ${scene} ${layer}`);
const fmt = v => (v == null ? '—' : v.toFixed(2));
const watch = async secs => {
  let prev = '';
  for (let k = 0; k < secs; k++) {
    await p.waitForTimeout(1000);
    const s = await state(), line = `tier ${s.tier} (ceiling ${s.ceiling})  mirror ${s.mirror} ao ${s.ao} msaa ${s.samples} liveShadows ${s.liveShadows} ratio ${s.ratio}`;
    if (line !== prev) console.log(`${String(k + 1).padStart(3)} s  ${line}`);
    prev = line;
    if (k % 5 === 4 || process.env.DEBUG) console.log(`       ${s.fps?.toFixed(1)} fps, GPU ${fmt(s.gpuMs)} ms, draw ${fmt(s.drawMs)} ms${process.env.DEBUG ? `  judged ${JSON.stringify(s.q.judged)} pending ${s.q.pending} quiet ${s.q.quietFor.toFixed(0)} window ${s.q.window}` : ''}`);
  }
  return state();
};
const TIERS = [[true, true, 4, true], [false, true, 4, true], [false, false, 4, true], [false, false, 0, false]];
const fails = [];
const check = s => {
  const want = TIERS[Math.min(3, s.tier)], bad = [];
  if (s.mirror !== null && s.mirror !== want[0]) bad.push('mirror');
  if (s.ao !== null && s.ao !== want[1]) bad.push('ao');
  if (s.samples !== want[2]) bad.push('msaa');
  if (s.liveShadows !== want[3]) bad.push('shadows');
  if (s.composerRatio !== s.ratio) bad.push(`passes draw at ${s.composerRatio}, not ${s.ratio}`);
  console.log(bad.length ? `MISMATCH at tier ${s.tier}: ${bad.join(', ')}` : `effects match tier ${s.tier}`);
  if (bad.length) fails.push(`tier ${s.tier}: ${bad.join(', ')}`);
};
// a full-screen shader whose cost is per pixel: n iterations of sin per pixel (on the 5090, about 1,750 per ms at
// 2880 x 1620), drawn inside the scene so it lands in the composer's render target at the tier's resolution
const HEAVY = n => {
  const T = ifx.THREE, m = new T.Mesh(new T.PlaneGeometry(2, 2), new T.ShaderMaterial({
    uniforms: { n: { value: n } },
    vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'uniform int n; void main() { float a = 0.0; for (int i = 0; i < n; i++) a += sin(float(i) * gl_FragCoord.x * 0.0013 + a); gl_FragColor = vec4(0.0, 0.0, 0.0, clamp(a, 0.0, 1.0) * 1e-4); }',
    transparent: true, depthTest: false, depthWrite: false }));
  m.frustumCulled = false; m.renderOrder = 999; m.name = 'heavy';
  ifx.built[ifx.state.scene].scene.add(m);
};
let s;
if (mode === 'res') {
  const rows = [];
  await p.evaluate(`(${HEAVY})(30000)`);                // fill-bound, as on a laptop GPU, so resolution is what costs
  for (const t of [3, 4, 5, 6]) {
    await p.evaluate(t => ifx.forceTier(t, { hold: true }), t); await p.waitForTimeout(4000);
    s = await state(); check(s); rows.push([t, s.ratio, s.rtWidth, s.gpuMs]);
    console.log(`tier ${t}: ratio ${s.ratio}, passes ${s.rtWidth} px wide, GPU ${fmt(s.gpuMs)} ms`);
  }
  if (!(rows.at(-1)[3] < rows[0][3] * 0.6)) fails.push(`GPU time did not fall with resolution (${fmt(rows[0][3])} → ${fmt(rows.at(-1)[3])} ms)`);
} else if (mode === 'climb') {
  s = await watch(8); check(s);
  console.log('forcing tier 3, then watching it climb back');
  await p.evaluate(() => ifx.forceTier(3));
  s = await watch(25); check(s);
  if (s.tier !== 0) fails.push(`did not climb back to tier 0 (at ${s.tier})`);
} else if (mode === 'throttle') {
  s = await watch(20); check(s);
  if (s.tier !== 0) fails.push(`a 30 fps cap with an idle GPU cost quality (tier ${s.tier})`);
} else if (mode === 'load') {
  s = await watch(6); check(s);
  console.log('adding a heavy full-screen shader');
  await p.evaluate(`(${HEAVY})(60000)`);
  s = await watch(30); check(s);
  if (s.tier === 0) fails.push('a GPU-bound frame did not step down');
  const low = s.tier;
  console.log('removing it; a failed tier waits 30 s before it may be tried again');
  await p.evaluate(() => { const sc = ifx.built[ifx.state.scene].scene, m = sc.getObjectByName('heavy'); sc.remove(m); m.geometry.dispose(); m.material.dispose(); });
  s = await watch(60); check(s);
  if (!(s.tier < low)) fails.push(`did not climb once the load was gone (still tier ${s.tier})`);
} else {
  s = await watch(soft ? 40 : 15); check(s);
}
if (errors.length) fails.push(...errors);
console.log(fails.length ? `FAIL: ${fails.join(' | ')}` : 'ok, no page errors');
await b.close();
process.exitCode = fails.length ? 1 : 0;
