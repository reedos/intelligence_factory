// Cycle through scenarios, scenes and modes and report any page errors. Usage: node tools/cycle.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
p.on('pageerror', e => errors.push(e.message));
p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await p.goto(process.env.URL || 'http://127.0.0.1:47400/');
await p.waitForFunction(() => window.ifx && window.ifx.state.scene === 0, null, { timeout: 90000 });
const scenarios = [
  { accel: 'h100', cooling: 'air', meterMW: 1000 },
  { accel: 'gb300', power: 'dc800', cooling: 'liquid', meterMW: 10 },
  { accel: 'rubin', power: 'dc800', cooling: 'warm', meterMW: 5000 },
  { accel: 'gb200', power: 'ac415', cooling: 'warm', meterMW: 100 },
];
for (const s of scenarios) {
  await p.evaluate(s => window.ifx.setScenario(s), s);
  for (let sc = 0; sc < 6; sc++) {
    await p.evaluate(i => window.ifx.go(i), sc);
    await p.waitForFunction(i => window.ifx.state.scene === i, sc, { timeout: 90000 });
    for (const mode of ['power', 'data', 'heat']) {
      await p.evaluate(m => { window.ifx.setMode(m); window.ifx.settle(); }, mode);
      const n = await p.evaluate(() => document.querySelectorAll('#parts button').length);
      const pins = await p.evaluate(() => document.querySelectorAll('.pin').length);
      if (!n || n !== pins) errors.push(`${s.accel}/${s.meterMW} scene ${sc} ${mode}: ${n} parts, ${pins} pins`);
      // select every part once
      await p.evaluate(() => { for (const b of document.querySelectorAll('#parts button')) b.click(); });
    }
  }
  console.log(`${s.accel} ${s.power || ''} ${s.cooling} ${s.meterMW} MW: ok so far (${errors.length} errors)`);
}
console.log(errors.length ? `errors:\n  ${[...new Set(errors)].join('\n  ')}` : 'no page errors');
await b.close();
