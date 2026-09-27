// Usage: node ifx-shot.mjs name:w:h:scene[:m][:part] ...   (server on 127.0.0.1:47393 serves the prototype dir)
import { createRequire } from 'module';
import path from 'path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const dir = process.env.OUT || 'shots';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const spec of process.argv.slice(2)) {
  const [name, w, h, sc, m, part, mode] = spec.split(':');
  const page = await browser.newPage({ viewport: { width: +w, height: +h }, isMobile: m === 'm', hasTouch: m === 'm', deviceScaleFactor: 1 });
  page.on('console', msg => { if (['error', 'warning'].includes(msg.type())) console.log(`[${name}] ${msg.type()}: ${msg.text().slice(0, 300)}`); });
  page.on('pageerror', e => console.log(`[${name}] pageerror: ${e.message}`));
  await page.goto(process.env.URL || 'http://127.0.0.1:47400/');
  await page.waitForFunction(() => window.ifx && window.ifx.state.scene === 0, null, { timeout: 90000 });
  if (mode && mode !== 'power') await page.evaluate(m => window.ifx.setMode(m), mode);
  if (+sc > 0) { await page.evaluate(i => window.ifx.go(i), +sc); await page.waitForFunction(i => window.ifx.state.scene === i, +sc, { timeout: 90000 }); }
  // let the arrival tween finish (software GL is slow, so skip it)
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.ifx.settle());
  if (part && part !== '-') { await page.evaluate(p => { window.ifx.select(p, true); window.ifx.settle(); }, part); }
  await page.waitForTimeout(3500);
  const el = name.endsWith('full') ? null : await page.$('.stage');
  if (el) await el.screenshot({ path: path.join(dir, name + '.png') });
  else await page.screenshot({ path: path.join(dir, name + '.png'), fullPage: true });
  console.log(`[${name}] done`);
  await page.close();
}
await browser.close();
