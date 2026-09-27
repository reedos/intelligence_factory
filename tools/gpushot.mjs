// Screenshots on the real GPU (look quality, not software rendering). Usage: node tools/gpushot.mjs name:scene[:layer[:part]] ...
//   URL env picks the page (default the dev server); shots land in shots/.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const b = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const errors = [];
for (const spec of process.argv.slice(2)) {
  const [name, sc, mode = 'power', part = ''] = spec.split(':');
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto(process.env.URL || 'http://127.0.0.1:47400/');
  await p.waitForFunction(() => window.ifx && ifx.state.scene === 0, null, { timeout: 90000 });
  await p.evaluate(async ([sc, mode, part]) => { document.querySelector('.view').scrollIntoView(); await ifx.show({ scene: +sc, mode, part: part || null }, { scroll: false }); ifx.settle(); }, [sc, mode, part]);
  await p.waitForTimeout(2500);
  await (await p.$('.view')).screenshot({ path: `shots/${name}.png` });
  await p.close();
}
console.log(errors.length ? errors.join(' | ') : 'no page errors');
await b.close();
