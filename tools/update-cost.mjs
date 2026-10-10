// CPU cost of one frame's animation updates (route pulses, ribbons, LEDs, plumes: everything the loop runs before it
// draws), with no drawing and no GPU in the number, so it is steady where frame times are not.
// Usage: URL=http://127.0.0.1:<port>/visualizer.html node tools/update-cost.mjs   (phone viewport, 4x CPU throttle)
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const b = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await p.goto(process.env.URL);
await p.waitForFunction(() => window.ifx && ifx.state.scene === 0, null, { timeout: 90000 });
await p.evaluate(() => { ifx.setTransitions('instant'); ifx.setScenario({ meterMW: 5000, accel: 'gb300', power: 'dc800', cooling: 'warm' }); });
const cdp = await p.context().newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.CPU_RATE || 4) });
const NAMES = ['across', 'campus', 'hall', 'rack', 'tray', 'chip', 'module', 'cpo', 'coherent', 'copper'];
for (const sc of [1, 2, 3, 4, 5]) {
  await p.evaluate(i => { ifx.go(i); }, sc); await p.waitForFunction(i => ifx.state.scene === i && ifx.built[i], sc);
  for (const mode of ['power', 'data', 'heat']) {
    await p.evaluate(m => { ifx.setMode(m); ifx.settle(); }, mode); await p.waitForTimeout(400);
    const ms = await p.evaluate(() => { const bb = ifx.built[ifx.state.scene], m = ifx.state.mode, flows = (m === 'data' ? bb.dataFlows : m === 'heat' ? bb.heatFlows : bb.flows) || [];
      const proj = { position: ifx.camera.position, worldPerPixelAtUnit: 0.002 }; let t = 100; const runs = [];
      for (let r = 0; r < 5; r++) { const t0 = performance.now(); for (let k = 0; k < 120; k++) { t += 0.016; for (const f of flows) f.update(t, proj); bb.update(t, 0.016); } runs.push((performance.now() - t0) / 120); }
      runs.sort((a, c) => a - c); return runs[2]; });
    console.log(`${NAMES[sc].padEnd(7)} ${mode.padEnd(6)} ${ms.toFixed(2)} ms/frame`);
  }
}
await b.close();
