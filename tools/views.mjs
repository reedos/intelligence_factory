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

const scenarios = (process.env.ONLY ? [process.env.ONLY] : ['gb200-ac-warm', 'gb300-dc-liquid', 'h100-air-1gw', 'rubin-dc-warm-10mw', 'gb200-5gw', 'colossus2']).map(k => [k, {
  'gb200-ac-warm': { meterMW: 100, accel: 'gb200', power: 'ac415', cooling: 'warm' },
  'gb300-dc-liquid': { meterMW: 300, accel: 'gb300', power: 'dc800', cooling: 'liquid' },
  'h100-air-1gw': { meterMW: 1000, accel: 'h100', power: 'ac415', cooling: 'air' },
  'rubin-dc-warm-10mw': { meterMW: 10, accel: 'rubin', power: 'dc800', cooling: 'warm' },
  'gb200-5gw': { meterMW: 5000, accel: 'gb200', power: 'ac415', cooling: 'warm' },
  colossus2: { meterMW: 1100, accel: 'gb300', power: 'ac415', cooling: 'liquid', site: 'colossus2' },   // battery backup, closed loop
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

const rows = [];
for (const [label, s] of scenarios) {
  await p.evaluate(s => { ifx.exitStory(); ifx.closeClock(); ifx.setScenario({ ...s, site: undefined }); }, s);
  await p.waitForTimeout(500);
  const stops = await p.evaluate(all => {
    const M = ifx.store.M, J = ifx.journeys;
    if (all) {
      const out = [];
      ifx.store.C.SCENES.forEach((sc, i) => [['power', ifx.store.C.PARTS], ['data', ifx.store.C.PARTS_DATA], ['heat', ifx.store.C.PARTS_HEAT]].forEach(([mode, P]) => (P[sc.id] || []).forEach(pt => out.push({ tour: 'explore', i: out.length, link: { scene: i, mode, part: pt.id } }))));
      return out;
    }
    // the tours' stops, then every part of the side level inside the optics, which no tour passes through
    const extra = [];
    ifx.store.C.SCENES.forEach((sc, side) => { if (sc.side) [['power', ifx.store.C.PARTS], ['data', ifx.store.C.PARTS_DATA], ['heat', ifx.store.C.PARTS_HEAT]].forEach(([mode, P]) => (P[sc.id] || []).forEach(pt => extra.push({ tour: sc.id, i: extra.length, link: { scene: side, mode, part: pt.id } }))); });
    return ['story', 'watt', 'request', 'heat'].flatMap(t => J[t](M).map((bt, i) => ({ tour: t, i, link: bt.link, sim: bt.sim || null, title: bt.title }))).concat(extra);
  }, everything);
  if (!everything) await p.evaluate(() => ifx.enterStory('story'));
  for (const st of stops) {
    await p.evaluate(async ({ link, sim }) => {
      if (sim) ifx.openClock(sim); else ifx.closeClock();
      document.querySelector('.view').scrollIntoView({ block: 'start' });
      for (let k = 0; k < 3; k++) {                        // a tour's own first jump can race ours; land for sure
        await ifx.show(link, { scroll: false });
        const st = ifx.state;
        if (st.scene === link.scene && st.mode === link.mode && st.selected === link.part) break;
      }
      ifx.settle();
    }, st);
    await p.waitForTimeout(250);
    const r = await p.evaluate(`(${check})()`);
    if (r.err || r.blocked || r.covers.length) rows.push({ label, ...st, ...r });
  }
  console.log(`${label}: ${stops.length} stops checked, ${rows.filter(x => x.label === label).length} not clear`);
}
for (const r of rows) console.log(`  ${r.label} · ${r.tour} #${r.i + 1} ${r.link.scene}:${r.link.mode}:${r.link.part}${r.sim ? ` (clock ${r.sim})` : ''} → ${[r.err, r.blocked && `3D blocked by ${r.blocked}`, ...(r.covers || []).map(c => `covered by ${c}`)].filter(Boolean).join('; ')}`);
console.log(errors.length ? `errors: ${[...new Set(errors)].join(' | ')}` : 'no page errors');
await b.close();
