// Do the page's controls stay out of each other's way, and does a phone spend its screen on the view?
// For each state (exploring, clock open, tour, tour with its clock) at desktop and phone size:
//   overlap    no two visible controls or overlays share pixels (anything docked to the view included)
//   single     one play control and one speed control on screen at a time
//   phone use  in a tour the stage fills the screen, and the view gets what the transport and the beat leave
// Usage: node tools/ui.mjs [desktop|phone|tablet|landscape]   (desktop and phone when omitted); SHOTS=1 saves screenshots
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const forms = process.argv[2] ? [process.argv[2]] : ['desktop', 'phone'];
const VP = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  tablet: { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  landscape: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const STATES = {
  explore: async p => { await p.evaluate(() => ifx.go(2)); },
  side: async p => { await p.evaluate(() => ifx.go(6)); },
  // the CPO package, its engine toggle on the widest view
  cpo: async p => { await p.evaluate(() => { ifx.go(7); ifx.setCpoVariant?.('mzm'); }); },
  // the heat layer's legend carries the log-scale note (src/heat.js), a second line on a phone
  heat: async p => { await p.evaluate(() => { ifx.setMode('heat'); ifx.go(2); }); },
  sideheat: async p => { await p.evaluate(() => { ifx.setMode('heat'); ifx.go(6); }); },
  clock: async p => { await p.evaluate(() => { ifx.go(1); document.getElementById('clock-btn').click(); }); },
  // the visualizer page has no hero button: start the overview through the player, then play it
  tour: async p => { await p.evaluate(() => { const h = document.getElementById('story-hero-play'); if (h) h.click(); else { window.ifx.enterStory('story'); document.getElementById('tour-play').click(); } }); },
  tourclock: async p => {
    await p.evaluate(() => ifx.enterStory('story'));
    await p.waitForTimeout(1500);
    for (let k = 0; k < 4; k++) { await p.evaluate(() => document.getElementById('tour-next').click()); await p.waitForTimeout(700); }
    await p.evaluate(() => document.getElementById('tour-play').click());
  },
};

// everything measured in the page
const measure = () => {
  const vis = el => {
    if (!el) return null;
    for (let q = el; q && q !== document.body; q = q.parentElement) { const cs = getComputedStyle(q); if (q.hidden || cs.display === 'none' || cs.visibility === 'hidden') return null; }
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) return null;
    return r;
  };
  const named = [
    ['top bar', '.topbar'], ['scale tabs', '.steps'], ['title', '.hud.tl'], ['layer switch', '.hud.tr .mode'], ['view buttons', '.hud-row'], ['key hints', '.hint'],
    ['scale bar', '.hud.bl'], ['legend', '.hud.br'], ['clock', '#clock'], ['transport', '.transport'], ['tour picker', '.tour-pick'],
    ['tally', '#tally'], ['beat', '.beat.on'], ['part card', '#card'], ['engine toggle', '#cpo-variant'],
  ];
  // a beat's box can reach under the sticky head while its words sit clear; judge the words
  const inked = el => { const r = vis(el); if (!r || !el.matches('.beat')) return r; const k = [...el.children].map(c => c.getBoundingClientRect()).filter(c => c.height);
    if (!k.length) return r;
    // Phone beats scroll inside their own box. Offscreen paragraphs are clipped, not painted over the picker.
    const clips = /auto|scroll|hidden|clip/.test(getComputedStyle(el).overflowY);
    const top = clips ? Math.max(r.top, k[0].top) : k[0].top;
    const bottom = clips ? Math.min(r.bottom, k[k.length - 1].bottom) : k[k.length - 1].bottom;
    return new DOMRect(r.left, top, r.width, Math.max(0, bottom - top)); };
  const boxes = named.map(([n, s]) => [n, inked(document.querySelector(s))]).filter(([, r]) => r);
  const overlaps = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const [a, ra] = boxes[i], [b, rb] = boxes[j];
    const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
    if (w > 1 && h > 1) overlaps.push(`${a} × ${b} (${Math.round(w)}×${Math.round(h)} px)`);
  }
  const count = sel => [...document.querySelectorAll(sel)].filter(vis).length;
  const view = vis(document.getElementById('view')), stage = vis(document.querySelector('.stage'));
  const beat = document.querySelector('.beat.on');
  return {
    overlaps,
    plays: count('#tour-play, #story-hero-play, #layer-play, [id$="-play"]:not(#ck-play)'),
    paces: count('#tour-pace'),
    exits: count('#story-exit, #story-btn[aria-pressed="true"]'),
    view: view && { w: Math.round(view.width), h: Math.round(view.height), share: +(view.width * view.height / (innerWidth * innerHeight)).toFixed(2) },
    stage: stage && { top: Math.round(stage.top), h: Math.round(stage.height) },
    // room in the beat card below its last line, beyond its own padding
    beatSlack: beat && vis(beat) ? (() => { const cs = getComputedStyle(beat), r = beat.getBoundingClientRect(), last = [...beat.children].filter(c => c.getBoundingClientRect().height).pop();
      return Math.round(r.bottom - parseFloat(cs.paddingBottom) - last.getBoundingClientRect().bottom); })() : null,
    story: document.body.classList.contains('story'),
    screen: { w: innerWidth, h: innerHeight },
  };
};

// Opt into the real Windows GPU for large authored models; software remains the portable default.
const gateArgs = process.env.IFX_GATE_GPU === '1'
  ? ['--use-angle=d3d11', '--ignore-gpu-blocklist']
  : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const b = await chromium.launch({ args: gateArgs });
let bad = 0;
for (const form of forms) {
  for (const [name, run] of Object.entries(STATES)) {
    const p = await b.newPage(VP[form]);
    const errors = []; p.on('pageerror', e => errors.push(e.message));
    await p.goto(process.env.URL || 'http://127.0.0.1:47400/');
    await p.waitForFunction(() => window.ifx && ifx.state.scene === 0, null, { timeout: 90000 });
    await p.evaluate(() => document.querySelector('.stage').scrollIntoView());
    // tours and the clock left the visualizer (Reed, 09/2026); their states run only on a page that still has them
    const offered = await p.evaluate(n => ['explore', 'side', 'cpo', 'heat', 'sideheat'].includes(n) || (n === 'clock' ? !!document.getElementById('clock-btn') : typeof window.ifx.enterStory === 'function'), name);
    if (!offered) { console.log(`${form} ${name}: not on this page, skipped`); await p.close(); continue; }
    await run(p);
    await p.waitForTimeout(+process.env.WAIT || 6000);
    const m = await p.evaluate(`(${measure})()`);
    if (process.env.SHOTS) await p.screenshot({ path: `shots/ui-${form}-${name}.png` });
    const fails = [...m.overlaps.map(o => `overlap ${o}`), ...errors.map(e => `page error ${e}`)];
    if (m.story && m.plays !== 1) fails.push(`${m.plays} play controls on screen`);
    if (m.story && m.paces !== 1) fails.push(`${m.paces} speed controls on screen`);
    if (m.story && m.exits !== 1) fails.push(`${m.exits} ways out of the tour on screen`);
    if (form !== 'desktop' && m.story && (m.stage?.top !== 0 || m.stage?.h !== m.screen.h)) fails.push(`tour does not fill the screen (stage ${JSON.stringify(m.stage)})`);
    if (form !== 'desktop' && m.beatSlack > 24) fails.push(`${m.beatSlack} px of empty beat`);
    bad += fails.length;
    console.log(`${form} ${name}: view ${m.view ? `${m.view.w}×${m.view.h} (${Math.round(m.view.share * 100)}% of the screen)` : 'off screen'}${fails.length ? '\n  ' + fails.join('\n  ') : ' · ok'}`);
    await p.close();
  }
}
await b.close();
console.log(bad ? `${bad} problems` : 'no problems');
process.exitCode = bad ? 1 : 0;
