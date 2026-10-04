// Is every tour stop's view clear? For each step of every tour, fly there as the tour does (story UI on, the
// step's clock open), then check two things:
//   3D   a ray from the camera to the part must not hit solid geometry well before the part
//   UI   the part's pin must sit inside the view, clear of the title, layer switch, buttons, legend and scale bar
//        (the clock and the tour transport sit below the view, so a pin inside the view is clear of them)
// Usage: node tools/views.mjs [desktop|phone] [all]   (all = every hotspot in every layer, not just tour stops)
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const form = process.argv[2] || 'desktop', everything = process.argv[3] === 'all';
const vp = form === 'phone' ? { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width: 1440, height: 900, deviceScaleFactor: 1 };
const b = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.deviceScaleFactor, isMobile: vp.isMobile, hasTouch: vp.hasTouch });
const errors = []; p.on('pageerror', e => errors.push(e.message));
await p.goto(process.env.URL || 'http://127.0.0.1:47400/');
await p.waitForFunction(() => window.ifx && ifx.state.scene === 0, null, { timeout: 90000 });
// Wait for N consecutive animation frames where the camera, the canvas size and the checked part's own pin rect
// are all unchanged, instead of a flat wall-clock delay. ifx.settle() snaps the camera synchronously, but pin
// layout (updatePins, in stage.js's rAF loop) only recomputes the DOM rect once per frame, and under GPU load
// (another preview rendering at the same time, or just a loaded machine) that next frame can be delayed well past
// a fixed timeout - which is what made "covered by pin off screen" / "pin at the view edge" flake from run to run
// on scenes nobody touched. Counting frames instead of milliseconds means the wait scales with how slow the GPU
// actually is, so it stays correct under load instead of racing it (Reed/Opus, 2026-10).
await p.evaluate(() => {
  window.stable = (id, { want = 3, maxFrames = 240 } = {}) => new Promise(resolve => {
    let prev = null, run = 0, frames = 0;
    const tick = () => {
      frames++;
      const cam = ifx.camera, pos = cam.position, q = cam.quaternion;
      const view = document.getElementById('view').getBoundingClientRect();
      const pinNum = document.querySelector(`.pin[data-id="${id}"] .num`);
      const pr = pinNum ? pinNum.getBoundingClientRect() : null;
      const off = pinNum ? pinNum.closest('.pin').classList.contains('off') : null;
      const cur = [pos.x, pos.y, pos.z, q.x, q.y, q.z, q.w, view.width, view.height,
        pr ? pr.left : null, pr ? pr.top : null, pr ? pr.width : null, pr ? pr.height : null, off].join(',');
      run = prev === cur ? run + 1 : 0;
      prev = cur;
      if (run >= want || frames >= maxFrames) resolve({ frames, run }); else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
});
// Confirmed cause check, logged for the record: under Playwright, navigator.webdriver is true and this gate never
// passes ?govern, so stage.js's own `governing` flag (src/app/stage.js:244) is already false here - the quality
// governor cannot be resizing the canvas mid-check on its own. forceTier below is pinned to each scene's own
// current tier (not forced to a different one) purely as a defensive belt: it stops the level from being retried
// into a *different* tier the instant governing ever is true (?govern, or a future default change) while the
// check runs, without changing which tier is on screen today.
console.log(`governor active in this gate: ${await p.evaluate(() => !!ifx.quality?.().governing)}`);

const scenarios = (process.env.ONLY ? [process.env.ONLY] : ['gb200-ac-warm', 'gb300-dc-liquid', 'h100-air-1gw', 'rubin-dc-warm-10mw', 'gb200-5gw', 'colossus2']).map(k => [k, {
  'gb200-ac-warm': { meterMW: 100, accel: 'gb200', power: 'ac415', cooling: 'warm' },
  'gb300-dc-liquid': { meterMW: 300, accel: 'gb300', power: 'dc800', cooling: 'liquid' },
  'h100-air-1gw': { meterMW: 1000, accel: 'h100', power: 'ac415', cooling: 'air' },
  'rubin-dc-warm-10mw': { meterMW: 10, accel: 'rubin', power: 'dc800', cooling: 'warm' },
  'gb200-5gw': { meterMW: 5000, accel: 'gb200', power: 'ac415', cooling: 'warm' },
  colossus2: { meterMW: 1460, accel: 'gb300', power: 'ac415', cooling: 'liquid', site: 'colossus2', stage: 0 },   // battery backup, closed loop
}[k]]);

// everything measured in the page, after the camera has arrived
const check = () => {
  const T = ifx.THREE, st = ifx.state, B = ifx.built[st.scene];
  const hs = ({ power: B.hotspots, data: B.dataHotspots, heat: B.heatHotspots })[st.mode][st.selected];
  if (!hs) return { err: 'no hotspot' };
  const cam = ifx.camera, target = new T.Vector3(...hs.pos), dir = target.clone().sub(cam.position), dist = dir.length(); dir.normalize();
  const ray = new T.Raycaster(cam.position.clone(), dir, cam.near, dist * 1.02);
  const shown = o => { for (let q = o; q; q = q.parent) if (!q.visible) return false; return true; };
  const solid = o => {
    if (!(o.isMesh || o.isInstancedMesh) || o.isSprite || !shown(o)) return false;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    return mats.some(m => m && m.depthWrite !== false && !(m.transparent && m.opacity < 0.6) && m.visible !== false);
  };
  const objs = []; B.scene.traverse(o => { if (solid(o)) objs.push(o); });
  const hits = ray.intersectObjects(objs, false);
  // anything hit before 85% of the way to the part is in front of it
  const block = hits.find(h => h.distance < dist * 0.85);
  const col = m => { const mm = Array.isArray(m) ? m[0] : m; return mm?.color ? '#' + mm.color.getHexString() : '?'; };
  // the pin on screen against the page's overlays
  const pin = document.querySelector(`.pin[data-id="${st.selected}"] .num`);
  const view = document.getElementById('view').getBoundingClientRect();
  const r = pin && !pin.closest('.pin').classList.contains('off') ? pin.getBoundingClientRect() : null;
  const over = (a, c) => a.left < c.right && a.right > c.left && a.top < c.bottom && a.bottom > c.top;
  const covers = [];
  if (!r) covers.push('pin off screen');
  else {
    if (r.left < view.left + 4 || r.right > view.right - 4 || r.top < view.top + 4 || r.bottom > view.bottom - 4) covers.push('pin at the view edge');
    for (const [name, sel] of [['title', '.hud.tl'], ['layer buttons', '.hud.tr .mode'], ['view buttons', '.hud-row'], ['legend', '.hud.br'], ['scale bar', '.hud.bl']]) {
      const el = document.querySelector(sel);
      if (!el || el.hidden || getComputedStyle(el).display === 'none') continue;
      const c = el.getBoundingClientRect();
      if (c.width && over(r, c)) covers.push(name);
    }
  }
  return { dist: +dist.toFixed(3), blocked: block ? `${block.object.type} ${col(block.object.material)} at ${Math.round(block.distance / dist * 100)}%` : null, covers };
};

// The overview pass. The stops below fly to one part and check its own pin, so a pin that only goes missing in the
// level's opening view (7adb724: the rack's compute and NVLink tray pins fell off the bottom of the frame) never failed.
// Here every part the level lists in each layer must have its numbered chip drawn, not `.off`, inside the canvas and
// clear of the page's overlays and the key hint (or sit in a phone group badge that names it); and the rack cabinet with its
// pulled tray must sit inside the canvas with a 24 px margin and fill most of its height (the audit's G6).
const overviewCheck = async ({ level, mode, rack }) => p.evaluate(async ({ level, mode, rack }) => {
  ifx.exitStory?.(); ifx.closeClock?.();
  await ifx.go(level, null, { force: true, keepCamera: false });
  await new Promise(r => { const t = () => (ifx.built[level] && ifx.built[level].model === ifx.store.M && ifx.state.scene === level ? r() : requestAnimationFrame(t)); t(); });
  ifx.setMode(mode);
  // a level's arrival can start its own glide after go() returns: snap it each frame until the camera holds still for
  // five frames (pin layout runs once a frame, so the pins are then laid out for this camera)
  for (let k = 0, run = 0, prev = ''; run < 5 && k < 300; k++) {
    ifx.settle(); await new Promise(r => requestAnimationFrame(r));
    const c = ifx.camera, now = [c.position.x, c.position.y, c.position.z, c.aspect, c.fov].join(',');
    run = now === prev ? run + 1 : 0; prev = now;
  }
  const C = ifx.store.C, id = C.SCENES[level].id, list = ({ power: C.PARTS, data: C.PARTS_DATA, heat: C.PARTS_HEAT })[mode][id] || [];
  const view = document.getElementById('view').getBoundingClientRect();
  const over = (a, c) => a.left < c.right && a.right > c.left && a.top < c.bottom && a.bottom > c.top;
  const hud = [['title', '.hud.tl'], ['layer buttons', '.hud.tr .mode'], ['view buttons', '.hud-row'], ['legend', '.hud.br'], ['scale bar', '.hud.bl'], ['key hint', '#view .hint']].flatMap(([name, sel]) => {
    const el = document.querySelector(sel); if (!el || el.hidden || getComputedStyle(el).display === 'none') return [];
    const c = el.getBoundingClientRect(); return c.width ? [{ name, c }] : [];
  });
  const groups = [...document.querySelectorAll('.pin-group')].map(g => g.getAttribute('aria-label') || '');
  const problems = [];
  const hs = ({ power: ifx.built[level].hotspots, data: ifx.built[level].dataHotspots, heat: ifx.built[level].heatHotspots })[mode] || {};
  list.forEach((pt, n) => {
    if (!hs[pt.id]) return;                                                     // tools/parts.mjs reports a part the scene does not place
    const el = document.querySelector(`.pin[data-id="${pt.id}"]`), num = el && el.querySelector('.num');
    if (!el || !num) { problems.push(`${pt.id}: no pin element`); return; }
    const r = num.getBoundingClientRect(), grouped = groups.some(a => new RegExp(`(?:: |, )${n + 1}(?:,|[.])`).test(a));
    if (el.classList.contains('off') || !r.width || getComputedStyle(el).visibility === 'hidden' || getComputedStyle(el).display === 'none') { if (!grouped) problems.push(`${pt.id}: pin not drawn (off)`); return; }
    if (r.left < view.left + 4 || r.right > view.right - 4 || r.top < view.top + 4 || r.bottom > view.bottom - 4) problems.push(`${pt.id}: pin outside the canvas`);
    for (const h of hud) if (over(r, h.c)) problems.push(`${pt.id}: pin under the ${h.name}`);
  });
  let frame = null;
  if (rack) {                                                                   // the rack, tray and busway inside the canvas, 24 px margin
    const T = ifx.THREE, B = ifx.built[level], cam = ifx.camera; B.scene.updateMatrixWorld(true);
    const ex = /flow|ribbon|sky|ground|halo|caption|^line$|^linesegments$|^points$|^sprite$|reflector|lettering|nameplate|hazard|stencil|marker|signs?$|studio surround|illustrative/i;
    const boxes = [];
    B.scene.traverse(o => {
      if (!o.isMesh || o.isSprite || o.isInstancedMesh || ex.test(o.name)) return;
      for (let q = o; q; q = q.parent) if (!q.visible || ex.test(q.name || '')) return;
      o.geometry.computeBoundingBox(); const bb = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld), s = bb.getSize(new T.Vector3());
      if (!isFinite(bb.min.x) || (s.x > 6 && s.z > 6)) return;                  // the studio floor is not hardware
      boxes.push(bb);
    });
    cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    // each part's own box corners, not one box round everything (its far corners are empty air)
    const margins = set => {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const bb of set) for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) {
        const q = new T.Vector3(x, y, z).project(cam), sx = (q.x + 1) / 2 * view.width, sy = (1 - q.y) / 2 * view.height;
        x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
      }
      return { left: Math.round(x0), top: Math.round(y0), right: Math.round(view.width - x1), bottom: Math.round(view.height - y1) };
    };
    // the cabinet and its pulled tray (inside +-0.6 m of the rack's axis, no taller than 2.5 m): 24 px on every canvas. The
    // overhead busway and feeds may run off the frame; the feed pin, checked above, keeps the busway's drop in view.
    const cabinet = boxes.filter(bb => bb.min.x >= -0.6 && bb.max.x <= 0.6 && bb.max.y <= 2.5);
    frame = margins(cabinet);
    const m = Math.min(frame.left, frame.top, frame.right, frame.bottom), fill = (view.height - frame.top - frame.bottom) / view.height;
    if (m < 23) problems.push(`rack and pulled tray leave ${m} px at the tightest side (left ${frame.left}, top ${frame.top}, right ${frame.right}, bottom ${frame.bottom}); need 24`);
    if (fill < 0.5) problems.push(`rack and pulled tray fill only ${Math.round(fill * 100)}% of the canvas height (cabinet and tray alone; the feed above them is in the fit too)`);
  }
  return { listed: list.length, problems };
}, { level, mode, rack });
const overviewRows = [];
for (const [label, s] of scenarios) {
  await p.evaluate(s => { ifx.exitStory?.(); ifx.closeClock?.(); ifx.setScenario({ site: undefined, ...s }); }, s);
  await p.waitForTimeout(500);
  let n = 0;
  for (const level of [3]) for (const mode of ['power', 'data', 'heat']) {   // the rack level; the other levels' overviews hide pins by design (pin-layout.js), a separate audit item (G2)
    const r = await overviewCheck({ level, mode, rack: level === 3 });
    n++;
    for (const msg of r.problems) overviewRows.push(`${label} · overview of level ${level + 1} in ${mode}: ${msg}`);
  }
  console.log(`${label}: ${n} rack overviews checked (every listed part's pin drawn and clear; rack framed)`);
}
await p.evaluate(() => { ifx.exitStory?.(); ifx.closeClock?.(); });

const rows = [];
for (const [label, s] of scenarios) {
  await p.evaluate(s => { ifx.exitStory?.(); ifx.closeClock?.(); ifx.setScenario({ site: undefined, ...s }); }, s);
  await p.waitForTimeout(500);
  const stops = await p.evaluate(all => {
    const M = ifx.store.M, J = ifx.journeys;
    // the visualizer no longer runs tours (Reed, 09/2026): every part in every layer is the set of stops
    if (all || !J || typeof ifx.enterStory !== 'function') {
      const out = [];
      ifx.store.C.SCENES.forEach((sc, i) => [['power', ifx.store.C.PARTS], ['data', ifx.store.C.PARTS_DATA], ['heat', ifx.store.C.PARTS_HEAT]].forEach(([mode, P]) => (P[sc.id] || []).forEach(pt => out.push({ tour: 'explore', i: out.length, link: { scene: i, mode, part: pt.id } }))));
      return out;
    }
    // the tours' stops, then every part of the side level inside the optics, which no tour passes through
    const extra = [];
    ifx.store.C.SCENES.forEach((sc, side) => { if (sc.side) [['power', ifx.store.C.PARTS], ['data', ifx.store.C.PARTS_DATA], ['heat', ifx.store.C.PARTS_HEAT]].forEach(([mode, P]) => (P[sc.id] || []).forEach(pt => extra.push({ tour: sc.id, i: extra.length, link: { scene: side, mode, part: pt.id } }))); });
    return ['story', 'watt', 'request', 'heat'].flatMap(t => J[t](M).map((bt, i) => ({ tour: t, i, link: bt.link, sim: bt.sim || null, title: bt.title }))).concat(extra);
  }, everything);
  if (!everything) await p.evaluate(() => ifx.enterStory?.('story'));
  for (const st of stops) {
    await p.evaluate(async ({ link, sim }) => {
      if (sim) ifx.openClock?.(sim); else ifx.closeClock?.();
      document.querySelector('.view').scrollIntoView({ block: 'start' });
      for (let k = 0; k < 3; k++) {                        // a tour's own first jump can race ours; land for sure
        await ifx.show(link, { scroll: false });
        const st = ifx.state;
        if (st.scene === link.scene && st.mode === link.mode && st.selected === link.part) break;
      }
      const q = ifx.quality?.();                           // hold the level's own current tier, not a different one
      if (q?.tiers && link.scene < q.tiers.length) ifx.forceTier?.(q.tiers[link.scene], { hold: true, i: link.scene });
      ifx.settle();
      await stable(link.part);
    }, st);
    let r = await p.evaluate(`(${check})()`);
    if (r.blocked || (r.covers && r.covers.length)) {
      // settle() snaps the camera synchronously, but pin layout (updatePins) runs once per animation frame and can
      // still land a frame or two late under GPU load; `stable` above waits for it, but a slow or congested run can
      // need one more pass. Re-measure once after another stability wait and only report if it still fails. (`err`,
      // meaning no hotspot at all for this part/mode, is a content issue, not a timing flake - never retried.)
      await p.evaluate(part => stable(part), st.link.part);
      const r2 = await p.evaluate(`(${check})()`);
      console.log(`  retry ${r2.err || r2.blocked || r2.covers.length ? 'still fails' : 'cleared'}: ${label} · ${st.tour} #${st.i + 1} ${st.link.scene}:${st.link.mode}:${st.link.part}`);
      r = r2;
    }
    if (r.err || r.blocked || r.covers.length) rows.push({ label, ...st, ...r });
  }
  console.log(`${label}: ${stops.length} stops checked, ${rows.filter(x => x.label === label).length} not clear`);
}
for (const r of rows) console.log(`  ${r.label} · ${r.tour} #${r.i + 1} ${r.link.scene}:${r.link.mode}:${r.link.part}${r.sim ? ` (clock ${r.sim})` : ''} → ${[r.err, r.blocked && `3D blocked by ${r.blocked}`, ...(r.covers || []).map(c => `covered by ${c}`)].filter(Boolean).join('; ')}`);
for (const r of overviewRows) console.log(`  ${r}`);
console.log(errors.length ? `errors: ${[...new Set(errors)].join(' | ')}` : 'no page errors');
await b.close();
if (rows.length || overviewRows.length || errors.length) process.exitCode = 1;
