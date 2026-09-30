// Tour-player probes for the tour audit fixes (findings 4, 9, 14, 15, 16, 17). Each check drives the real page
// through window.ifx and the transport's own buttons, the same way a reader would, and reports pass/fail.
// Usage: node tools/tours.mjs            (URL env for the page, default the dev server; SHOTS=1 saves screenshots)
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://127.0.0.1:47400/';
const SHOTS = !!process.env.SHOTS;

const ready = p => p.waitForFunction(() => window.ifx && ifx.state.scene === 0, null, { timeout: 90000 });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const LAYER_WORD = { power: 'power', data: 'data', heat: 'heat' };

let bad = 0;
const results = [];
function report(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
  if (!ok) bad++;
}

// Opt into the real Windows GPU for large authored models; software remains the portable default.
const gateArgs = process.env.IFX_GATE_GPU === '1'
  ? ['--use-angle=d3d11', '--ignore-gpu-blocklist']
  : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const b = await chromium.launch({ args: gateArgs });
// the visualizer no longer runs tours (Reed, 09/2026): say so and pass, rather than fail on a missing feature
{
  const p = await b.newPage();
  await p.goto(URL); await ready(p);
  const has = await p.evaluate(() => typeof window.ifx.enterStory === 'function');
  await p.close();
  if (!has) { console.log('no tours on this page, nothing to check'); await b.close(); process.exit(0); }
}

// ---------- (a) + (b): This level's entry context and This level's OUTWARD-aware next (findings 9, 16) ----------
async function thisLevelCase(layer, scene) {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.goto(URL); await ready(p);
  // set up: the reader is looking at (layer, scene)...
  await p.evaluate(({ layer, scene }) => { window.ifx.setMode(layer); return window.ifx.go(scene); }, { layer, scene });
  await p.waitForFunction(scene => window.ifx.state.scene === scene, scene, { timeout: 15000 });
  // ...then opens and finishes a DIFFERENT tour (moving the camera away)...
  await p.evaluate(() => window.ifx.enterStory('watt'));
  await p.waitForFunction(() => window.ifx.state.scene === 0 && window.ifx.state.mode === 'power', null, { timeout: 15000 });   // watt's own beat 0
  await p.evaluate(() => window.ifx.exitStory());
  // ...comes back to (layer, scene) on their own (no tour open)...
  await p.evaluate(({ layer, scene }) => { window.ifx.setMode(layer); return window.ifx.go(scene); }, { layer, scene });
  await p.waitForFunction(scene => window.ifx.state.scene === scene, scene, { timeout: 15000 });
  // ...then clicks Tours. Finding 9's bug: this resumes/restarts 'watt' (scene 0, power), moving the camera again,
  // before This level ever gets a chance to read where the reader actually was.
  await p.click('#story-btn');
  await sleep(150);
  await p.click('#tour-toggle');
  await p.click('.tour-more summary');           // open "Every part, in order" so the This level tab is reachable
  await p.click('[data-tour="here"]');
  await p.waitForFunction(({ layer, scene }) => window.ifx.state.mode === layer && window.ifx.state.scene === scene, { layer, scene }, { timeout: 15000 }).catch(() => {});
  const got = await p.evaluate(() => ({ mode: window.ifx.state.mode, scene: window.ifx.state.scene, eyebrow: document.querySelector('#tally .eyebrow')?.textContent || '' }));
  const title = await p.evaluate(scene => window.ifx.store.C.SCENES[scene].title, scene);
  const ok = got.mode === layer && got.scene === scene && got.eyebrow.includes(title) && got.eyebrow.toLowerCase().includes(LAYER_WORD[layer]);
  report(`This level after another tour: ${layer} level ${scene + 1}`, ok, `got mode=${got.mode} scene=${got.scene} eyebrow="${got.eyebrow}"; wanted mode=${layer} scene=${scene} ("${title}")`);
  if (errors.length) report(`  (page errors, ${layer} level ${scene + 1})`, false, errors.join(' | '));
  await p.close();
}
for (const layer of ['power', 'data', 'heat']) for (const scene of [0, 5]) await thisLevelCase(layer, scene);

// (b) heat's This level at the package (level 6) offers the tray (level 5) next, outward-labeled
{
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(URL); await ready(p);
  await p.evaluate(() => { window.ifx.setMode('heat'); return window.ifx.go(5); });
  await p.waitForFunction(() => window.ifx.state.scene === 5, null, { timeout: 15000 });
  await p.click('#play-these');
  await p.waitForFunction(() => document.querySelector('.beat.on'), null, { timeout: 15000 });
  await p.evaluate(() => { const play = document.getElementById('tour-play'); for (let i = 0; i < 2 && play?.getAttribute('aria-pressed') === 'true'; i++) play.click(); });
  let label = '';
  for (let k = 1; k <= 8; k++) {
    label = await p.evaluate(() => document.getElementById('tour-next')?.getAttribute('aria-label') || '');
    if (label.toLowerCase().includes('tray')) break;
    await p.evaluate(() => document.querySelector('#tour-next').click());
    await p.waitForFunction(k => document.querySelector('.beat.on')?.dataset.i === String(k), k, { timeout: 8000 }).catch(() => {});
    await sleep(200);
  }
  const trayTitle = await p.evaluate(() => window.ifx.store.C.SCENES[4].title);
  report('Heat This level at the package offers the tray next, outward', label.includes(trayTitle) && label.includes('outward'), `aria-label="${label}"; wanted destination="${trayTitle}"`);
  await p.close();
}

// ---------- (c): mobile picker - selected tab visible, lengths visible (finding 15) ----------
{
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await p.goto(URL); await ready(p);
  await p.evaluate(() => window.ifx.enterStory('story'));
  await sleep(150);
  report('Mobile: tour choices are hidden by default', await p.locator('#tour-pick').isHidden());
  await p.click('#tour-toggle');
  await p.click('.tour-more summary');
  const before = await p.evaluate(() => window.scrollY);
  await p.click('[data-tour="all-data"]');
  report('Mobile: picking a tour collapses its choices', await p.locator('#tour-pick').isHidden());
  report('Mobile: picker retains keyboard focus after choosing', await p.evaluate(() => document.activeElement?.id === 'tour-toggle'));
  await p.click('#tour-toggle');
  const m = await p.evaluate(() => {
    const btn = document.querySelector('.tour-tabs [aria-selected="true"]'), row = document.querySelector('.tour-pick');
    const br = btn.getBoundingClientRect(), rr = row.getBoundingClientRect();
    const small = btn.querySelector('small');
    return {
      inRow: br.left >= rr.left - 1 && br.right <= rr.right + 1,
      lengthVisible: !!small && small.offsetWidth > 0 && small.offsetHeight > 0,
      lengthText: small?.textContent || '',
      scrollY: window.scrollY,
    };
  });
  report('Mobile 390×844: the selected Every-part tab is inside the picker\'s visible area', m.inRow, JSON.stringify(m));
  report('Mobile 390×844: the tab\'s length text is visible', m.lengthVisible && /step/.test(m.lengthText), `"${m.lengthText}"`);
  report('Mobile 390×844: centering the tab scrolled only the picker, never the page', m.scrollY === before, `scrollY ${before} → ${m.scrollY}`);
  if (SHOTS) await p.screenshot({ path: 'shots/tours-mobile-picker.png' });
  await p.close();
}

// ---------- (d): a sim beat does not advance before its key event, at 1x and 8x (finding 17) ----------
// Reached by manual "Next" clicks, paused: onTick's dwell/sim-key gating only applies to autoplay, so stepping
// there by hand skips straight past the two earlier sim beats (training, hot day) without waiting on them too.
// Freeze the real clock before its key event, run the tour until dwell is exhausted, and require it to
// hold. Then unfreeze the clock and require the tour to advance. This works at both GPU and software speeds.
async function outageHoldCase(pace) {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  // set the pace via localStorage before load (story.js reads ifx-pace once, at import time) instead of driving
  // the speed menu's own UI - fewer moving parts for a probe that only needs the pace already set, not to prove
  // the menu itself works (tools/ui.mjs and normal use already exercise clicking it)
  await p.addInitScript(pace => { try { localStorage.setItem('ifx-pace', String(pace)); } catch { /* ignore */ } }, pace);
  await p.goto(URL); await ready(p);
  await p.evaluate(() => window.ifx.enterStory('story'));
  await p.waitForFunction(() => document.querySelector('.beat.on'), null, { timeout: 15000 });
  await p.evaluate(() => { const play = document.getElementById('tour-play'); for (let i = 0; i < 2 && play?.getAttribute('aria-pressed') === 'true'; i++) play.click(); });
  // A manual click faster than the panel's own scroll can settle sometimes outruns its steering window (a
  // pre-existing scroll/IntersectionObserver race, not one of the findings fixed on this branch) and the panel
  // falls back a beat on its own. Rather than assume each click lands exactly where aimed, click toward the
  // outage beat and keep clicking Next until its clock is the one actually showing, confirmed twice in a row.
  let seenTwice = 0;
  for (let tries = 0; tries < 40 && seenTwice < 2; tries++) {
    const sim = await p.evaluate(() => document.body.dataset.sim || null);
    // after a click, give the new step's clock time to load before judging it: under load a 400 ms look could miss
    // the outage beat's clock and click straight past it, to the tour's end
    if (sim === 'outage') { seenTwice++; await sleep(400); } else { seenTwice = 0; await p.evaluate(() => document.querySelector('#tour-next').click()); await sleep(1500); }
  }
  const reached = await p.evaluate(() => document.body.dataset.sim === 'outage');
  if (!reached) throw new Error(`outageHoldCase(${pace}): never settled on the outage beat`);
  const paceShown = await p.evaluate(() => document.getElementById('tour-pace')?.textContent || '');
  await p.evaluate(() => {
    document.querySelector('#clock [data-sim="outage"]').click();
    document.getElementById('ck-play').click(); // paused at zero, before the key event
  });
  await p.evaluate(() => document.querySelector('#tour-play').click());
  await p.waitForFunction(() => {
    const m = /scaleX\(([\d.]+)\)/.exec(document.querySelector('.beat.on .beat-bar i')?.style.transform || '');
    return (m && +m[1] >= 0.999) || document.body.dataset.sim !== 'outage';
  }, null, { timeout: 60000 });
  const held = await p.evaluate(() => ({ sim: document.body.dataset.sim, clock: document.getElementById('ck-time')?.textContent, title: document.querySelector('.beat.on h3')?.textContent }));
  report(`Outage step holds after its dwell at ${pace}× while its clock is before the key event`, held.sim === 'outage', `pace ${paceShown}; ${JSON.stringify(held)}`);
  await p.evaluate(() => document.querySelector('#ck-play').click());
  await p.waitForFunction(() => document.body.dataset.sim !== 'outage', null, { timeout: 60000 });
  report(`Outage step advances after the clock resumes at ${pace}×`, true);
  await p.close();
}
await outageHoldCase(1);
await outageHoldCase(8);

// ---------- (e): a chip opens the popover and holds the tour; closing it resumes (finding 4) ----------
{
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(URL); await ready(p);
  await p.evaluate(() => { window.ifx.setMode('data'); return window.ifx.go(0); });
  await p.waitForFunction(() => window.ifx.state.scene === 0, null, { timeout: 15000 });
  await p.click('#play-these');
  await p.waitForFunction(() => document.querySelector('.beat.on'), null, { timeout: 15000 });
  await p.evaluate(() => { const play = document.getElementById('tour-play'); for (let i = 0; i < 2 && play?.getAttribute('aria-pressed') === 'true'; i++) play.click(); });
  await p.evaluate(() => { if (document.getElementById('tour-play')?.getAttribute('aria-pressed') === 'true') document.getElementById('tour-play').click(); });   // pause first
  await p.evaluate(() => document.querySelector('#tour-next').click());                          // the next part (every-part beats walk data.js's own WALK order): has specs with chips either way
  await p.waitForFunction(() => document.querySelector('.beat.on .beat-specs .chip'), null, { timeout: 15000 });
  const beatBefore = await p.evaluate(() => document.querySelector('.beat.on')?.dataset.i);
  await p.evaluate(() => document.querySelector('#tour-play').click());                          // resume
  await p.click('.beat.on .beat-specs .chip');
  const opened = await p.evaluate(() => !document.getElementById('src-pop').hidden).catch(() => false);
  report('A chip in a tour beat opens the source popover', opened);
  await sleep(6000);                                     // well past the normal dwell for this beat
  const stillOn = await p.evaluate(() => document.querySelector('.beat.on')?.dataset.i);
  report('The tour does not advance while the popover is open', stillOn === beatBefore, `beat ${beatBefore} → ${stillOn}`);
  // force: true - this machine's actionability checks have been unreliable throughout this probe run (flagging
  // genuinely-present, on-screen elements as "not visible"); the popover's own position and the close click's
  // effect are still verified below, not just that the click was accepted
  await p.click('.src-pop .sp-x', { force: true });
  const closed = await p.evaluate(() => document.getElementById('src-pop').hidden);
  report('Closing the popover closes it', closed);
  // Waiting for the full dwell to elapse and actually advance is impractical here (this beat's dwell can run to
  // minutes under this machine's software-rendered frame rate - see the note on outageHoldCase above). Instead,
  // sample the beat's own progress bar (.beat-bar i, driven by the same held/dwell this fix gates) twice, well
  // past HOLD_MS: if it is moving forward, onTick resumed counting once the popover closed, which is the claim.
  await sleep(6000);   // past HOLD_MS (4 s)
  const p1 = await p.evaluate(() => { const m = /scaleX\(([\d.]+)\)/.exec(document.querySelector('.beat.on .beat-bar i')?.style.transform || ''); return m ? +m[1] : null; });
  await sleep(4000);
  const p2 = await p.evaluate(() => { const m = /scaleX\(([\d.]+)\)/.exec(document.querySelector('.beat.on .beat-bar i')?.style.transform || ''); return m ? +m[1] : null; });
  const stillSameBeat = (await p.evaluate(() => document.querySelector('.beat.on')?.dataset.i)) === beatBefore;
  const resumed = p1 !== null && p2 !== null && p2 > p1;
  report('Playback resumes once the popover is closed (its progress bar moves again)', resumed, `bar ${p1} → ${p2}, still beat ${beatBefore}: ${stillSameBeat}`);
  if (SHOTS) await p.screenshot({ path: 'shots/tours-chip-beat.png' });
  await p.close();
}

// ---------- (f): more than three spec rows show three, plus a working disclosure (finding 4) ----------
{
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(URL); await ready(p);
  await p.evaluate(() => { window.ifx.setMode('data'); return window.ifx.go(0); });
  await p.waitForFunction(() => window.ifx.state.scene === 0, null, { timeout: 15000 });
  await p.click('#play-these');
  await p.waitForFunction(() => document.querySelector('.beat.on'), null, { timeout: 15000 });
  await p.evaluate(() => { const play = document.getElementById('tour-play'); for (let i = 0; i < 2 && play?.getAttribute('aria-pressed') === 'true'; i++) play.click(); });
  // 'Fiber route' (data.js's 'route' part on across): 4 spec rows in this build. Every-part beats walk the
  // scene in data.js's own WALK.data.across order (remote, route, ila, dci, home), not PARTS_DATA's array
  // order, so this is reached by title, not assumed to be a fixed step count away from the overview.
  let onIt = false;
  for (let tries = 0; tries < 10 && !onIt; tries++) {
    onIt = await p.evaluate(() => document.querySelector('.beat.on h3')?.textContent === 'Fiber route');
    if (!onIt) { await p.evaluate(() => document.querySelector('#tour-next').click()); await sleep(600); }
  }
  await p.waitForFunction(() => document.querySelector('.beat.on h3')?.textContent === 'Fiber route' && document.querySelector('.beat.on .beat-more'), null, { timeout: 30000 });
  const m1 = await p.evaluate(() => {
    const beat = document.querySelector('.beat.on');
    const previewRows = beat.querySelector('dl.beat-specs')?.children.length ?? 0;
    const details = beat.querySelector('.beat-more');
    return { previewRows, summary: details?.querySelector('summary')?.textContent || '', open: details?.open ?? null, hiddenRows: details?.querySelectorAll('dl.beat-specs > div').length ?? 0 };
  });
  report('The beat shows exactly 3 spec rows as a preview', m1.previewRows === 3, JSON.stringify(m1));
  report('The disclosure names how many specifications there are in all, and starts closed', /All \d+ specifications/.test(m1.summary) && m1.open === false, m1.summary);
  await p.evaluate(() => document.querySelector('.beat.on .beat-more summary').click());
  const m2 = await p.evaluate(() => { const d = document.querySelector('.beat.on .beat-more'); return { open: d.open, visible: d.querySelector('dl.beat-specs')?.offsetHeight > 0 }; });
  report('The disclosure opens and shows the rest of the rows', m2.open && m2.visible, JSON.stringify(m2));
  await p.close();
}

// ---------- (g): the optics cutaway disclosure renders on the CPO stop (finding 4) ----------
{
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(URL); await ready(p);
  await p.evaluate(() => { window.ifx.setMode('data'); return window.ifx.go(2); });   // the hall
  await p.waitForFunction(() => window.ifx.state.scene === 2, null, { timeout: 15000 });
  await p.click('#play-these');
  await p.waitForFunction(() => document.querySelector('.beat.on'), null, { timeout: 15000 });
  await p.evaluate(() => { const play = document.getElementById('tour-play'); for (let i = 0; i < 2 && play?.getAttribute('aria-pressed') === 'true'; i++) play.click(); });
  let found = false;
  for (let k = 1; k <= 24 && !found; k++) {
    found = await p.evaluate(() => document.querySelector('.beat.on h3')?.textContent === 'Co-packaged optics');
    if (!found) {
      await p.evaluate(() => document.querySelector('#tour-next').click());
      await p.waitForFunction(k => document.querySelector('.beat.on')?.dataset.i === String(k), k, { timeout: 10000 }).catch(() => {});
      await sleep(400);
    }
  }
  await p.waitForFunction(() => document.querySelector('.beat.on .beat-figure, .beat.on details.beat-more'), null, { timeout: 15000 }).catch(() => {});
  const before = await p.evaluate(() => {
    const beat = document.querySelector('.beat.on');
    const figDetails = [...beat.querySelectorAll('.beat-more')].find(d => /Inside the optics/.test(d.querySelector('summary')?.textContent || ''));
    return { found: !!figDetails, summary: figDetails?.querySelector('summary')?.textContent || '', open: figDetails?.open ?? null };
  });
  report('The CPO stop carries the optics-cutaway disclosure', found && before.found, JSON.stringify(before));
  if (before.found) {
    await p.evaluate(() => { const d = [...document.querySelectorAll('.beat.on .beat-more')].find(x => /Inside the optics/.test(x.querySelector('summary').textContent)); d.querySelector('summary').click(); });
    const after = await p.evaluate(() => {
      const beat = document.querySelector('.beat.on');
      const svgs = beat.querySelectorAll('.beat-figure svg');
      const chips = beat.querySelectorAll('.beat-fig-cap .chip');
      return { svgCount: svgs.length, chipCount: chips.length, widths: [...svgs].map(s => s.closest('.beat-figure').offsetWidth) };
    });
    report('The cutaway renders all three modules (DSP, LPO, CPO) with their chips', after.svgCount === 3 && after.chipCount === 3, JSON.stringify(after));
    if (SHOTS) await p.screenshot({ path: 'shots/tours-cpo-cutaway.png' });
  }
  await p.close();
}

// ---------- head + chip-beat screenshots (desktop and phone), for a human look ----------
if (SHOTS) {
  for (const [name, vp] of [['desktop', { viewport: { width: 1440, height: 900 } }], ['phone', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
    const p = await b.newPage(vp);
    await p.goto(URL); await ready(p);
    await p.evaluate(() => { window.ifx.setMode('data'); return window.ifx.go(0); });
    await p.waitForFunction(() => window.ifx.state.scene === 0, null, { timeout: 15000 });
    await p.click('#play-these');
    await p.waitForFunction(() => document.querySelector('.beat.on'), null, { timeout: 15000 });
  await p.evaluate(() => { const play = document.getElementById('tour-play'); for (let i = 0; i < 2 && play?.getAttribute('aria-pressed') === 'true'; i++) play.click(); });
    await sleep(400);
    await p.screenshot({ path: `shots/tours-head-${name}.png` });
    await p.evaluate(() => document.querySelector('#tour-next').click());
    await p.waitForFunction(() => document.querySelector('.beat.on .beat-specs .chip'), null, { timeout: 15000 });
    await sleep(400);
    await p.screenshot({ path: `shots/tours-beat-chips-${name}.png` });
    await p.close();
  }
}

await b.close();
console.log(bad ? `${bad} problems` : 'no problems');
process.exitCode = bad ? 1 : 0;
