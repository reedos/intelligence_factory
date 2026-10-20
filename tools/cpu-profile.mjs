// Main-thread CPU profile of one level under the phone profile (4x CPU throttle): self time by function.
// Usage: URL=http://127.0.0.1:<port>/visualizer.html node tools/cpu-profile.mjs <sceneIndex> [power|data|heat] [phone|desktop]
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const sc = Number(process.argv[2] || 2), mode = process.argv[3] || 'data', form = process.argv[4] || 'phone';
const vp = form === 'phone' ? { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true } : { width: 1440, height: 900, deviceScaleFactor: 1 };
const b = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const p = await b.newPage({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.deviceScaleFactor, isMobile: vp.isMobile, hasTouch: vp.hasTouch });
await p.goto(process.env.URL);
await p.waitForFunction(() => window.ifx && ifx.state.scene === 0, null, { timeout: 90000 });
const cdp = await p.context().newCDPSession(p);
if (form === 'phone') await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await p.evaluate(s => ifx.setScenario(s), { meterMW: 5000, accel: 'gb300', power: 'dc800', cooling: 'warm' });
await p.evaluate(i => ifx.go(i), sc); await p.waitForFunction(i => ifx.state.scene === i && ifx.built[i], sc);
await p.evaluate(m => { ifx.setMode(m); ifx.settle(); document.querySelector('.view').scrollIntoView({ block: 'center' }); }, mode);
await p.waitForTimeout(1000);
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start');
await p.waitForTimeout(4000);
const { profile } = await cdp.send('Profiler.stop');
const byId = new Map(profile.nodes.map(n => [n.id, n])), self = new Map();
const dt = profile.timeDeltas; let total = 0;
profile.samples.forEach((id, k) => { const n = byId.get(id), key = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber + 1}`; self.set(key, (self.get(key) || 0) + dt[k]); total += dt[k]; });
// inclusive time per function (each sample counted once per distinct function on its stack)
const parent = new Map(); for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
const incl = new Map();
profile.samples.forEach((id, k) => { const seen = new Set(); for (let x = id; x !== undefined; x = parent.get(x)) { const n = byId.get(x), key = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop().split('?')[0]}:${n.callFrame.lineNumber + 1}`; if (!seen.has(key)) { seen.add(key); incl.set(key, (incl.get(key) || 0) + dt[k]); } } });
console.log('inclusive:'); for (const [k, v] of [...incl].sort((a, c) => c[1] - a[1]).slice(0, 30)) console.log(`${(v / total * 100).toFixed(1).padStart(5)}%  ${k}`);
console.log('self:');
console.log(`scene ${sc} ${mode} ${form}: ${(total / 1000).toFixed(0)} ms sampled`);
for (const [k, v] of [...self].sort((a, c) => c[1] - a[1]).slice(0, 25)) console.log(`${(v / total * 100).toFixed(1).padStart(5)}%  ${k}`);
await b.close();
