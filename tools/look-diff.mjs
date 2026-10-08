// Is the look unchanged? Screenshots every level and layer at fixed poses on a virtual clock, then pixel-diffs two builds.
//   node tools/look-diff.mjs shoot <outDir> <url> [desktop|phone|both]
//   node tools/look-diff.mjs compare <dirA> <dirB> [outDiffDir]
// Determinism: requestAnimationFrame and performance.now run on a virtual clock this script advances, Math.random is
// seeded, the camera is the level's overview pose (ifx.go then ifx.settle), and every capture is taken after the same
// number of virtual frames. Two captures of the same build must match exactly (run `shoot` twice to see the noise floor).
// Pass condition (compare): at most 0.5% of pixels differ by more than 8/255 in any channel, per image.
import { createRequire } from 'module';
import fs from 'fs'; import path from 'path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [cmd, a1, a2, a3] = process.argv.slice(2);
const SIZES = { desktop: { width: 1440, height: 900, deviceScaleFactor: 1 }, phone: { width: 360, height: 800, deviceScaleFactor: 2, isMobile: true, hasTouch: true } };
const NAMES = ['across', 'campus', 'hall', 'rack', 'tray', 'chip', 'module', 'cpo', 'coherent', 'copper'];
const SCENARIO = { meterMW: 100, accel: 'gb200', power: 'ac415', cooling: 'warm' };
const TOL = 8, MAX_FRACTION = 0.005;

if (cmd === 'shoot') {
  const out = a1, url = a2, forms = (a3 || 'both') === 'both' ? ['desktop', 'phone'] : [a3];
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  for (const form of forms) {
    const vp = SIZES[form];
    const ctx = await b.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.deviceScaleFactor, isMobile: vp.isMobile, hasTouch: vp.hasTouch });
    await ctx.addInitScript(() => {
      let s = 12345; Math.random = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
      let vnow = 1000; const cbs = []; let id = 0;
      // Frame timestamps are virtual and performance.now() is exactly the virtual clock, so everything keyed to it (the
      // token script anchors on it) is repeatable. A loader that spins on performance.now would never end, so after
      // 2000 reads within one virtual frame it creeps forward 0.002 ms per read.
      let calls = 0;
      performance.now = () => { calls++; return vnow + (calls > 2000 ? (calls - 2000) * 0.002 : 0); };
      window.requestAnimationFrame = cb => { cbs.push([++id, cb]); return id; };
      window.cancelAnimationFrame = i => { const k = cbs.findIndex(c => c[0] === i); if (k >= 0) cbs.splice(k, 1); };
      window.__advance = (n, dt = 1000 / 60) => { for (let i = 0; i < n; i++) { vnow += dt; calls = 0; const run = cbs.splice(0); for (const [, cb] of run) cb(vnow); } };
    });
    const p = await ctx.newPage(); const errors = []; p.on('pageerror', e => errors.push(e.message));
    await p.goto(url);
    const until = async (fn, arg) => { for (let k = 0; k < 600; k++) { await p.evaluate(() => window.__advance(6, 0)); if (await p.evaluate(fn, arg)) return; await p.waitForTimeout(100); } throw new Error('timeout waiting for ' + fn); };
    await until(() => window.ifx && ifx.state.scene === 0);
    await p.evaluate(s => { ifx.setScenario(s); ifx.setTransitions('instant'); }, SCENARIO);
    const only = process.env.SCENES ? process.env.SCENES.split(',').map(Number) : null;   // quick runs: SCENES=5,7
    for (let sc = 0; sc < NAMES.length; sc++) {
      if (only && !only.includes(sc)) continue;
      await p.evaluate(i => { ifx.go(i); }, sc);
      await until(i => ifx.state.scene === i && ifx.built[i], sc);
      for (const mode of ['power', 'data', 'heat']) {
        await p.evaluate(m => { ifx.setMode(m); ifx.settle(); window.scrollTo(0, 0); }, mode);
        // route phases come from Math.random in build order, which async loading can reorder: pin them
        await p.evaluate(() => { const b = ifx.built[ifx.state.scene]; ['flows', 'dataFlows', 'heatFlows'].forEach(k => (b[k] || []).forEach((f, i) => { f.phase = (i * 0.6180339) % 1; f.acc = i * 0.37; f.lastT = undefined; })); });
        await p.evaluate(() => window.__advance(90)); await p.waitForTimeout(250); await p.evaluate(() => { ifx.settle(); window.__advance(30); });
        await p.waitForTimeout(150);
        console.log(new Date().toISOString().slice(11,19), form, sc, mode);
        await p.screenshot({ path: path.join(out, `${form}-${sc}-${NAMES[sc]}-${mode}.png`) });
      }
      console.log(form, NAMES[sc], 'done');
    }
    if (errors.length) console.log('page errors:', [...new Set(errors)].join(' | '));
    await ctx.close();
  }
  await b.close();
} else if (cmd === 'compare') {
  const [A, B, D] = [a1, a2, a3]; if (D) fs.mkdirSync(D, { recursive: true });
  const files = fs.readdirSync(A).filter(f => f.endsWith('.png')).sort();
  const b = await chromium.launch({ headless: true }); const p = await b.newPage(); await p.goto('about:blank');
  let worst = 0, failed = 0, total = 0;
  for (const f of files) {
    if (!fs.existsSync(path.join(B, f))) { console.log('missing in B:', f); failed++; continue; }
    const r = await p.evaluate(async ([x, y, tol]) => {
      const load = async s => { const bm = await createImageBitmap(await (await fetch('data:image/png;base64,' + s)).blob()); const c = new OffscreenCanvas(bm.width, bm.height), g = c.getContext('2d'); g.drawImage(bm, 0, 0); return g.getImageData(0, 0, bm.width, bm.height); };
      const ia = await load(x), ib = await load(y);
      if (ia.width !== ib.width || ia.height !== ib.height) return { size: true };
      const out = new ImageData(ia.width, ia.height); let n = 0, maxd = 0, any = 0;
      for (let i = 0; i < ia.data.length; i += 4) {
        const d = Math.max(Math.abs(ia.data[i] - ib.data[i]), Math.abs(ia.data[i + 1] - ib.data[i + 1]), Math.abs(ia.data[i + 2] - ib.data[i + 2]));
        if (d > 0) any++; if (d > maxd) maxd = d; if (d > tol) n++;
        out.data[i] = Math.min(255, d * 8); out.data[i + 1] = d > tol ? 255 : 0; out.data[i + 2] = 0; out.data[i + 3] = 255;
      }
      const c = new OffscreenCanvas(ia.width, ia.height); c.getContext('2d').putImageData(out, 0, 0);
      const blob = await c.convertToBlob({ type: 'image/png' }); const buf = new Uint8Array(await blob.arrayBuffer()); let bin = ''; for (const v of buf) bin += String.fromCharCode(v);
      return { px: ia.width * ia.height, over: n, any, maxd, diff: n || any ? btoa(bin) : null };
    }, [fs.readFileSync(path.join(A, f)).toString('base64'), fs.readFileSync(path.join(B, f)).toString('base64'), TOL]);
    total++;
    if (r.size) { console.log(f, 'SIZE DIFFERS'); failed++; continue; }
    const frac = r.over / r.px; worst = Math.max(worst, frac);
    const bad = frac > MAX_FRACTION; if (bad) failed++;
    console.log(`${bad ? 'FAIL' : 'ok  '} ${f.padEnd(34)} differing>${TOL}: ${r.over} (${(frac * 100).toFixed(4)}%)  any: ${r.any}  max channel delta: ${r.maxd}`);
    if (D && r.diff) fs.writeFileSync(path.join(D, f), Buffer.from(r.diff, 'base64'));
  }
  console.log(`\n${total} images, worst ${(worst * 100).toFixed(4)}% of pixels over ${TOL}/255 (limit ${MAX_FRACTION * 100}%), ${failed} failing`);
  await b.close(); process.exitCode = failed ? 1 : 0;
} else { console.log('usage: shoot <outDir> <url> [desktop|phone|both] | compare <dirA> <dirB> [diffDir]'); process.exitCode = 2; }
