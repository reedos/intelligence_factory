// Frame cost on the real GPU. Vsync and the frame cap are off, so frame time reflects the work, not the display.
// For each scenario, scene and layer: median and p95 frame time, draw calls and triangles per frame (all passes),
// textures and geometries held. Usage: node tools/perf.mjs [desktop|phone]   (phone = 390×844 at 3×, mobile path)
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const form = process.argv[2] || 'desktop';
const vp = form === 'phone' ? { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true } : { width: 1440, height: 900, deviceScaleFactor: 1 };
const b = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const p = await b.newPage({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.deviceScaleFactor, isMobile: vp.isMobile, hasTouch: vp.hasTouch });
const errors = []; p.on('pageerror', e => errors.push(e.message));
const cpuRate = Number(process.env.CPU_RATE || (form === 'phone' ? 4 : 1));
const maxP95 = Number(process.env.MAX_P95_MS || (form === 'phone' ? 33.3 : 16.7));
await p.goto(process.env.URL || 'http://127.0.0.1:47400/');
await p.waitForFunction(() => window.ifx && ifx.state.scene === 0, null, { timeout: 90000 });
const gpu = await p.evaluate(() => { const gl = ifx.renderer().getContext(), e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown'; });
const cdp = cpuRate > 1 ? await p.context().newCDPSession(p) : null;
if (cdp) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
console.log(`${form}: ${gpu}, CPU throttle ${cpuRate}x, p95 limit ${maxP95} ms\n`);
if (/swiftshader|software/i.test(gpu)) { console.log('Not on the GPU; stopping.'); process.exit(1); }
// the loop pauses while the view is off screen, so bring it in; count every pass of a frame, not just the last
await p.evaluate(() => { document.querySelector('.view').scrollIntoView({ block: 'center' }); ifx.renderer().info.autoReset = false; });

const scenarios = [
  ['GB200 100 MW warm', { meterMW: 100, accel: 'gb200', power: 'ac415', cooling: 'warm', site: undefined }],
  ['GB300 5 GW DC', { meterMW: 5000, accel: 'gb300', power: 'dc800', cooling: 'warm', site: undefined }],
  ['H100 1 GW air', { meterMW: 1000, accel: 'h100', power: 'ac415', cooling: 'air', site: undefined }],
];
const NAMES = ['across', 'campus', 'hall', 'rack', 'tray', 'chip', 'module', 'cpo', 'coherent', 'copper'];
const measure = () => new Promise(res => {
  const R = ifx.renderer(), ts = []; let last = performance.now(), n = 0, calls = 0, tris = 0;
  const tick = now => {
    if (n++ > 20) { ts.push(now - last); calls = Math.max(calls, R.info.render.calls); tris = Math.max(tris, R.info.render.triangles); }
    R.info.reset(); last = now;
    if (ts.length < 240) return requestAnimationFrame(tick);
    ts.sort((a, c) => a - c);
    res({ med: ts[ts.length >> 1], p95: ts[Math.floor(ts.length * 0.95)], calls, tris, tex: R.info.memory.textures, geo: R.info.memory.geometries });
  };
  requestAnimationFrame(tick);
});
if (process.env.INJECT_ERROR === '1') await p.evaluate(() => { setTimeout(() => { throw new Error('injected page error'); }, 0); });
const rows = [];
for (const [label, s] of scenarios) {
  await p.evaluate(s => ifx.setScenario(s), s);
  for (const sc of process.env.HALL_ONLY === '1' ? [2] : NAMES.map((_, i) => i)) {   // six levels and the four side levels inside the links
    await p.evaluate(i => ifx.go(i), sc);
    await p.waitForFunction(i => ifx.state.scene === i && ifx.built[i], sc, { timeout: 90000 });
    for (const mode of ['power', 'data', 'heat']) {
      await p.evaluate(m => { ifx.setMode(m); ifx.settle(); document.querySelector('.view').scrollIntoView({ block: 'center' }); }, mode);
      await p.waitForTimeout(300);
      rows.push({ label, scene: NAMES[sc], mode, ...(await p.evaluate(`(${measure})()`)) });
    }
  }
}
const f = v => v.toFixed(1).padStart(5);
console.log('scenario            scene   layer   median    p95   fps  calls  tris(k)  tex  geo');
for (const r of rows) console.log(`${r.label.padEnd(19)} ${r.scene.padEnd(7)} ${r.mode.padEnd(6)} ${f(r.med)}ms ${f(r.p95)}ms ${String(Math.min(9999, Math.round(1000 / r.med))).padStart(5)} ${String(r.calls).padStart(6)} ${String(Math.round(r.tris / 1000)).padStart(8)} ${String(r.tex).padStart(4)} ${String(r.geo).padStart(4)}`);
const worst = [...rows].sort((a, c) => c.p95 - a.p95).slice(0, 5);
console.log(`\nslowest p95: ${worst.map(r => `${r.label}/${r.scene}/${r.mode} ${r.p95.toFixed(1)} ms`).join('; ')}`);
console.log(errors.length ? `errors: ${[...new Set(errors)].join(' | ')}` : 'no page errors');
await b.close();
if (process.env.JSON_OUT) (await import('fs')).writeFileSync(process.env.JSON_OUT, JSON.stringify({ form, gpu, cpuRate, rows }, null, 1));
const hallBudget = Number(process.env.HALL_MIN_FPS || 0);
const slow = rows.filter(r => r.p95 > maxP95);
if (slow.length) console.error(['FAIL: ' + slow.length + ' case(s) with p95 above ' + maxP95 + ' ms:', ...slow.map(r => '  ' + r.label + '/' + r.scene + '/' + r.mode + ' p95 ' + r.p95.toFixed(1) + ' ms')].join('\n'));
if (errors.length) console.error(`FAIL: ${errors.length} page error(s)`);
if (hallBudget > 0 && rows.some(r => r.scene === 'hall' && 1000 / r.med < hallBudget)) console.error(`FAIL: hall median below ${hallBudget} fps`);
if (errors.length || slow.length || (hallBudget > 0 && rows.some(r => r.scene === 'hall' && 1000 / r.med < hallBudget))) process.exitCode = 1;
