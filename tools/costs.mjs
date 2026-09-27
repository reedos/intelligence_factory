// What each effect costs in one view, on the real GPU with vsync off. Switches effects off one at a time,
// cumulatively, and times 240 frames after each. Usage: node tools/costs.mjs [scene] [layer] [WxH@dpr]
// e.g. node tools/costs.mjs 2 data 1920x1080@1.5   (a typical laptop panel)
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [scene = '2', layer = 'data', size = '1920x1080@1.5'] = process.argv.slice(2);
const [, W, H, D] = size.match(/(\d+)x(\d+)@([\d.]+)/);
const b = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const p = await b.newPage({ viewport: { width: +W, height: +H }, deviceScaleFactor: +D });
const errors = []; p.on('pageerror', e => errors.push(e.message));
await p.goto(process.env.URL || 'http://127.0.0.1:47400/');
await p.waitForFunction(() => window.ifx && ifx.state.scene === 0, null, { timeout: 90000 });
await p.evaluate(async ([sc, mode]) => {
  document.querySelector('.view').scrollIntoView({ block: 'center' });
  await ifx.show({ scene: +sc, mode, part: null }, { scroll: false }); ifx.settle();
}, [scene, layer]);
await p.waitForTimeout(1500);
const measure = () => new Promise(res => {
  const ts = []; let last = performance.now(), n = 0;
  const tick = now => { if (n++ > 20) ts.push(now - last); last = now; if (ts.length < 240) return requestAnimationFrame(tick); ts.sort((a, c) => a - c); res({ med: ts[ts.length >> 1], p95: ts[Math.floor(ts.length * .95)] }); };
  requestAnimationFrame(tick);
});
const steps = [
  ['everything on', () => {}],
  ['floor mirror off', () => { ifx.built[ifx.state.scene].scene.traverse(o => { if (o.isReflector) o.visible = false; }); }],
  ['ambient occlusion off', () => { ifx.composers[ifx.state.scene].passes.forEach(x => { if (x.constructor.name === 'GTAOPass') x.enabled = false; }); }],
  ['shadows frozen', () => { const r = ifx.renderer(); r.shadowMap.autoUpdate = false; }],
  ['bloom off', () => { ifx.composers[ifx.state.scene].passes.forEach(x => { if (x.constructor.name === 'UnrealBloomPass') x.enabled = false; }); }],
  ['antialiasing 4x off', () => { const c = ifx.composers[ifx.state.scene]; for (const t of [c.renderTarget1, c.renderTarget2]) { t.samples = 0; t.dispose(); } }],
];
const gpu = await p.evaluate(() => { const gl = ifx.renderer().getContext(), e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?'; });
console.log(`${gpu}\nscene ${scene} ${layer} at ${W}×${H} @${D}x, ratio ${await p.evaluate(() => ifx.renderScale())}`);
let prev = null;
for (const [name, fn] of steps) {
  await p.evaluate(`(${fn})()`); await p.waitForTimeout(400);
  const m = await p.evaluate(`(${measure})()`);
  console.log(`${name.padEnd(24)} median ${m.med.toFixed(2).padStart(6)} ms  p95 ${m.p95.toFixed(2).padStart(6)} ms${prev ? `   saves ${(prev - m.med).toFixed(2)} ms` : ''}`);
  prev = m.med;
}
console.log(errors.length ? errors.join(' | ') : 'no page errors');
await b.close();
