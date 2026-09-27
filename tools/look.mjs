// Screenshot page sections after optional setup steps, and report page errors.
// Usage: node tools/look.mjs <name> <width> '<selector>[,<selector>…]' ['<js to run first>']
//   e.g. node tools/look.mjs sc 1440 '.scenario,.ledger' "ifx.setScenario({accel:'h100'})"
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const [name = 'look', width = '1440', sels = '.scenario', pre = ''] = process.argv.slice(2);
const out = process.env.OUT || 'shots';
const mobile = +width < 700;
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: +width, height: mobile ? 844 : 1000 }, isMobile: mobile, hasTouch: mobile });
const errors = [];
p.on('pageerror', e => errors.push(e.message));
p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await p.goto(process.env.URL || 'http://127.0.0.1:47400/');
await p.waitForFunction(() => window.ifx && window.ifx.state.scene === 0, null, { timeout: 90000 });
if (pre) { await p.evaluate(pre); await p.waitForTimeout(2500); }
let i = 0;
for (const sel of sels.split(',')) {
  const el = await p.$(sel);
  if (!el) { console.log(`missing: ${sel}`); continue; }
  await el.screenshot({ path: `${out}/${name}-${i++}.png` });
}
console.log(errors.length ? `errors:\n  ${errors.join('\n  ')}` : 'no page errors');
await b.close();
