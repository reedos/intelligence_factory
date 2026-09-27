// Click every data-go link on the page and check it lands: right scene, right layer, the part selected with a pin.
// Usage: URL='http://127.0.0.1:47400/?accel=h100&cooling=air' node tools/links.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
const errors = [];
p.on('pageerror', e => errors.push(e.message));
await p.goto(process.env.URL || 'http://127.0.0.1:47400/');
await p.waitForFunction(() => window.ifx && window.ifx.state.scene === 0, null, { timeout: 90000 });
const targets = await p.evaluate(() => [...new Set([...document.querySelectorAll('[data-go]')].map(e => e.dataset.go))]);
let bad = 0;
for (const t of targets) {
  const [scene, mode, part] = t.split(':');
  await p.evaluate(t => document.querySelector(`[data-go="${t}"]`).dispatchEvent(new MouseEvent('click', { bubbles: true })), t);
  const ok = await p.waitForFunction(([s, m, id]) => {
    const st = window.ifx.state;
    return st.scene === +s && st.mode === m && st.selected === id && !!document.querySelector(`.pin.on[data-id="${id}"]`);
  }, [scene, mode, part], { timeout: 60000 }).then(() => true, () => false);
  const links = await p.evaluate(() => document.getElementById('card-links').hidden ? 0 : document.querySelectorAll('#card-links button').length);
  if (!ok) { bad++; console.log(`MISS ${t}`); } else console.log(`ok   ${t}${links ? `  (card links back: ${links})` : ''}`);
}
console.log(`${targets.length} targets, ${bad} missed`);
console.log(errors.length ? `errors:\n  ${[...new Set(errors)].join('\n  ')}` : 'no page errors');
await b.close();
