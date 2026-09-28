// Every numbered part must have a pin. Tours number a part by its place in the level's list for its layer, and the view
// numbers its pins the same way, so a listed part the scene does not place would shift every number after it. Walks
// every accelerator × power × cooling at one size, and every size for one, building all six levels in each layer.
// Hotspots a scene places that the list does not name are reported but allowed: they never become numbered pins.
// Usage: node tools/parts.mjs            (URL env for the page, default the dev server)
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://127.0.0.1:47400/';
const combos = [];
for (const accel of ['h100', 'gb200', 'gb300', 'rubin']) for (const power of ['ac415', 'dc800']) for (const cooling of ['air', 'liquid', 'warm']) combos.push({ meterMW: 300, accel, power, cooling });
for (const meterMW of [10, 100, 1000, 5000]) combos.push({ meterMW, accel: 'gb200', power: 'dc800', cooling: 'liquid' });
combos.push({ meterMW: 1461, accel: 'gb300', power: 'ac415', cooling: 'liquid', site: 'colossus2', stage: 0 });   // Elon Musk's 550k mixed fleet, battery backup, closed loop
combos.push({ meterMW: 3253, accel: 'gb300', power: 'ac415', cooling: 'liquid', site: 'colossus2', stage: 3 });   // its largest stage
const b = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errors = []; p.on('pageerror', e => errors.push(e.message));
await p.goto(URL); await p.waitForFunction(() => window.ifx && ifx.state.scene === 0, null, { timeout: 90000 });
const seen = new Set(); let missingTotal = 0; const extras = new Set();
for (const s of combos) {
  const r = await p.evaluate(async s => {
    ifx.setScenario(s);
    const M = ifx.store.M, key = `${M.accel.id} ${M.power.id} ${M.cooling.id} ${Math.round(M.meterMW)}${M.scenario.site ? ` ${M.scenario.site}` : ""}${M.stage != null ? ` stage ${M.stage}` : ""}`;
    const out = [], C = ifx.store.C, by = { power: C.PARTS, data: C.PARTS_DATA, heat: C.PARTS_HEAT };
    for (let i = 0; i < 7; i++) {   // six levels and the side level inside the optics
      await ifx.go(i, null, { force: true, keepCamera: true });
      await new Promise(r => { const t = () => (ifx.built[i] && ifx.built[i].model === ifx.store.M && ifx.state.scene === i ? r() : requestAnimationFrame(t)); t(); });
      const bb = ifx.built[i];
      for (const m of ['power', 'data', 'heat']) {
        const hs = { power: bb.hotspots, data: bb.dataHotspots, heat: bb.heatHotspots }[m] || {};
        const list = (by[m][C.SCENES[i].id] || []).map(x => x.id);
        out.push({ level: i + 1, mode: m, missing: list.filter(id => !hs[id]), extra: Object.keys(hs).filter(id => !list.includes(id)) });
      }
    }
    return { key, out };
  }, s);
  if (seen.has(r.key)) continue;                         // a combination the model normalizes to one already walked
  seen.add(r.key);
  const bad = r.out.filter(x => x.missing.length);
  r.out.forEach(x => x.extra.forEach(id => extras.add(`level ${x.level} ${x.mode}: ${id}`)));
  missingTotal += bad.reduce((n, x) => n + x.missing.length, 0);
  console.log(`${r.key.padEnd(28)} ${bad.length ? bad.map(x => `level ${x.level} ${x.mode} lists [${x.missing.join(', ')}] with no pin`).join('; ') : 'every listed part has a pin'}`);
}
if (extras.size) console.log(`unlisted hotspots (allowed): ${[...extras].join(', ')}`);
console.log(`${seen.size} scenarios; ${missingTotal} listed parts without a pin`);
console.log(errors.length ? errors.join(' | ') : 'no page errors');
await b.close();
process.exitCode = missingTotal || errors.length ? 1 : 0;
