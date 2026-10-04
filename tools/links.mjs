// Do the links between the story page and the visualizer land where they say?
//   story page (URL ends in index.html or /):  every data-go element and every visualizer.html?view= anchor is opened on the
//     visualizer (through one page; the anchors again by a fresh load of their URL), and must land on the right scene, layer and part, selected with its pin on.
//   visualizer (URL ends in visualizer.html):  every data-go element there is clicked and must land the same way; then each
//     part of each level and layer is selected, and every "where this shows up" link on its card must point at an
//     element that exists on the story page.
// Usage: URL='http://127.0.0.1:47400/index.html' node tools/links.mjs
//        URL='http://127.0.0.1:47400/visualizer.html' node tools/links.mjs
// Exits 1 on any miss or page error.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const start = new URL(process.env.URL || 'http://127.0.0.1:47400/index.html');
const onVisualizer = /visualizer\.html$/.test(start.pathname);
const origin = start.origin, dir = start.pathname.replace(/[^/]*$/, '');
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
const errors = [];
p.on('pageerror', e => errors.push(e.message));
let bad = 0;
const miss = msg => { bad++; console.log(`MISS ${msg}`); };

// opens the visualizer on scene.mode.part (keeping the scenario query) and checks where it lands
async function lands(view, search = '') {
  const [scene, mode, part] = view.split('.');
  // a fresh page each time: a software-rendered 3D page is slow to tear down and the next load waits behind it
  const q = await b.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  q.on('pageerror', e => errors.push(e.message));
  await q.goto(`${origin}${dir}visualizer.html?view=${view}${search ? `&${search.replace(/^\?/, '')}` : ''}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  const ok = await q.waitForFunction(([s, m, id]) => {
    const st = window.ifx?.state;
    return st && st.scene === +s && st.mode === m && (id ? st.selected === id && !!document.querySelector(`.pin.on[data-id="${id}"]`) : st.selected == null);
  }, [scene, mode, part || ''], { timeout: 60000 }).then(() => true, () => false);
  await q.close();
  return ok;
}

await p.goto(start.href);
if (!onVisualizer) {
  await p.waitForSelector('[data-go], a[href*="visualizer.html"]', { timeout: 60000 });
  await p.waitForTimeout(1500);
  const found = await p.evaluate(() => {
    const views = new Set(), hrefs = new Set();
    document.querySelectorAll('[data-go]').forEach(e => views.add(e.dataset.go.split(':').filter(Boolean).join('.')));
    document.querySelectorAll('a[href*="visualizer.html"]').forEach(a => { const v = new URL(a.href).searchParams.get('view'); if (v) { views.add(v); hrefs.add(v); } });
    return { views: [...views], hrefs: [...hrefs] };
  });
  // every target is driven through one visualizer page (what a click on it does there); loading a software-rendered 3D page
  // afresh for each of dozens of links takes the better part of an hour
  const v = await b.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  v.on('pageerror', e => errors.push(e.message));
  await v.goto(`${origin}${dir}visualizer.html`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await v.waitForFunction(() => window.ifx && window.ifx.state.scene === 0, null, { timeout: 90000 });
  await v.evaluate(() => ifx.setTransitions?.(false));   // no camera flights: the gate asks where a link lands, not how it gets there
  for (const view of found.views) {
    const [scene, mode, part] = view.split('.');
    await v.evaluate(([s, m, id]) => ifx.show({ scene: +s, mode: m, part: id || null }), [scene, mode, part || '']);
    const ok = scene !== undefined && await v.waitForFunction(([s, m, id]) => {
      const st = window.ifx.state;
      return st.scene === +s && st.mode === m && (id ? st.selected === id && !!document.querySelector(`.pin.on[data-id="${id}"]`) : st.selected == null);
    }, [scene, mode, part || ''], { timeout: 60000 }).then(() => true, () => false);
    if (!ok) miss(view); else console.log(`ok   ${view}`);
  }
  await v.close();
  // and the anchors themselves, as a reader follows them: a fresh load of the URL
  // (each is a full software-rendered boot; HREF_LOADS=n checks only n of them, level-only links first, on a busy machine)
  const hrefs = [...found.hrefs].sort((a, b) => a.split('.').length - b.split('.').length).slice(0, +(process.env.HREF_LOADS || Infinity));
  for (const view of hrefs) {
    const ok = view.split('.').length >= 2 && await lands(view);
    if (!ok) miss(`href ${view}`); else console.log(`ok   href ${view}`);
  }
  console.log(`${found.views.length} story-page link targets (${hrefs.length} of ${found.hrefs.length} anchors also followed by URL) into the visualizer, ${bad} missed`);
} else {
  await p.waitForFunction(() => window.ifx && window.ifx.state.scene === 0, null, { timeout: 90000 });
  const targets = await p.evaluate(() => [...new Set([...document.querySelectorAll('[data-go]')].map(e => e.dataset.go))]);
  for (const t of targets) {
    const [scene, mode, part] = t.split(':');
    await p.evaluate(t => document.querySelector(`[data-go="${t}"]`).dispatchEvent(new MouseEvent('click', { bubbles: true })), t);
    const ok = await p.waitForFunction(([s, m, id]) => {
      const st = window.ifx.state;
      return st.scene === +s && st.mode === m && st.selected === id && !!document.querySelector(`.pin.on[data-id="${id}"]`);
    }, [scene, mode, part], { timeout: 60000 }).then(() => true, () => false);
    if (!ok) miss(t); else console.log(`ok   ${t}`);
  }
  console.log(`${targets.length} data-go targets on the visualizer`);
  // the card's links back to the story page: each must name an element that exists there
  const story = await (await fetch(`${origin}${dir}index.html`)).text();
  const hrefs = new Map();
  let parts = 0;
  const scenes = 12;   // six levels and the interconnect levels after them; a go() past the last one changes nothing and is skipped
  for (let s = 0; s < scenes; s++) for (const m of ['power', 'data', 'heat']) {
    await p.evaluate(([s, m]) => { ifx.setTransitions?.(false); ifx.setMode(m); ifx.go(s); }, [s, m]);
    await p.waitForFunction(([s, m]) => ifx.state.scene === s && ifx.state.mode === m && document.querySelectorAll('#parts button[data-id]').length > 0, [s, m], { timeout: 30000 }).catch(() => {});
    if (await p.evaluate(s => ifx.state.scene !== s, s)) continue;
    const ids = await p.evaluate(() => [...document.querySelectorAll('#parts button[data-id]')].map(b => b.dataset.id));
    for (const id of ids) {
      parts++;
      await p.evaluate(id => ifx.select(id, true), id);
      await p.waitForFunction(id => ifx.state.selected === id, id, { timeout: 15000 }).catch(() => {});
      const hs = await p.evaluate(() => [...document.querySelectorAll('#card-links a')].map(a => a.getAttribute('href')));
      hs.forEach(h => hrefs.set(h.replace(/\?.*#/, '#'), `${s}:${m}:${id}`));
    }
  }
  for (const [h, from] of hrefs) {
    const id = h.split('#')[1];
    if (!id || !story.includes(`id="${id}"`)) miss(`card link ${h} (from ${from}) names no element on the story page`);
  }
  console.log(`${parts} parts selected, ${hrefs.size} distinct card links to the story page, ${bad} missed`);
}
console.log(errors.length ? `errors:\n  ${[...new Set(errors)].join('\n  ')}` : 'no page errors');
await b.close();
process.exit(bad || errors.length ? 1 : 0);
