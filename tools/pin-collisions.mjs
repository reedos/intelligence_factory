// Do the pins and their labels stay clear of each other and of the page furniture? For every level (10) in every
// layer (power, data, heat), at the overview AND with each part selected in turn, at one form factor, it reads the
// rects of what is on screen and fails on:
//   - two visible pin labels that overlap                         (phones show a label only for the selected pin)
//   - a visible label over another pin's number circle
//   - an in-scene caption drawn in the canvas whose type lands under 11 px on screen
//   - an in-scene caption (.scene-cap) under 11 px, or over a pin, label, title or button, or over another caption
//   - a visible label over the title (.hud.tl), the layer switch (.hud.tr) or the Back button (#back-out)
//   - on phone (a note only on desktop): two pin boxes (.pin, .pin-group) that intersect, and the selected pin's name chip (#pin-chip) missing, or over a pin or HUD box
// Usage: URL=http://127.0.0.1:<port>/visualizer.html IFX_GATE_GPU=1 node tools/pin-collisions.mjs [desktop|phone]
// Exit code 1 when anything fails. The failures are listed per level and layer.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const form = process.argv[2] || 'desktop', phone = form === 'phone';
const gateArgs = process.env.IFX_GATE_GPU === '1'
  ? ['--use-angle=d3d11', '--ignore-gpu-blocklist']
  : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const b = await chromium.launch({ headless: true, args: gateArgs });
const p = await b.newPage(phone
  ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
  : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errors = []; p.on('pageerror', e => errors.push(e.message));
await p.goto(process.env.URL || 'http://127.0.0.1:47401/visualizer.html');
await p.waitForFunction(() => window.ifx && ifx.state.scene === 0, null, { timeout: 90000 });
await p.evaluate(() => ifx.setTransitions?.('instant'));

// measured in the page: every visible label, the furniture rects, every visible pin box
const measure = () => {
  const shown = el => { const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden' && !el.hidden; };
  const box = r => ({ l: +r.left.toFixed(1), t: +r.top.toFixed(1), r: +r.right.toFixed(1), b: +r.bottom.toFixed(1) });
  const labels = [], pinBoxes = [];
  for (const el of document.querySelectorAll('#pins .pin')) {
    if (el.classList.contains('off') || !shown(el)) continue;
    const num = el.querySelector('.num'), name = el.dataset.id;
    pinBoxes.push({ id: name, ...box(num.getBoundingClientRect()) });
    const lbl = el.querySelector('.lbl');
    if (lbl && shown(lbl) && !el.classList.contains('hide-lbl')) labels.push({ id: name, text: lbl.textContent, ...box(lbl.getBoundingClientRect()) });
  }
  for (const el of document.querySelectorAll('#pins .pin-group')) if (shown(el)) pinBoxes.push({ id: 'group:' + el.textContent, ...box(el.getBoundingClientRect()) });
  const caps = [...document.querySelectorAll('#pins .scene-cap')].filter(shown).map(el => ({ text: el.textContent.slice(0, 40), fs: parseFloat(getComputedStyle(el).fontSize), ...box(el.getBoundingClientRect()) }));
  // caption sprites still drawn in the canvas (main draws them all this way): the type height they land at on screen
  const sprites = [], B = ifx.built[ifx.state.scene], cam = ifx.camera, vp = document.getElementById('view').getBoundingClientRect(), tmp = new ifx.THREE.Vector3();
  // (side levels only: the campus level's terminal captions are for its close view and are sub-pixel at the overview)
  if (ifx.state.scene >= 6) B?.scene.traverse(o => {
    if (!o.isSprite || !o.userData.caption || o.material.visible === false) return;
    for (let q = o; q; q = q.parent) if (!q.visible) return;
    o.getWorldPosition(tmp); const d = cam.position.distanceTo(tmp), pr = tmp.clone().project(cam);
    if (pr.z < -1 || pr.z > 1 || Math.abs(pr.x) > 1 || Math.abs(pr.y) > 1) return;
    const spriteH = o.scale.y * vp.height / (2 * d * Math.tan(cam.fov * Math.PI / 360));
    sprites.push({ text: o.userData.caption.text.slice(0, 40), px: +(spriteH * 44 / 72).toFixed(1) });
  });
  const furniture = {}, chipEl = document.getElementById('pin-chip'), chip = chipEl && shown(chipEl) && chipEl.getBoundingClientRect().width ? box(chipEl.getBoundingClientRect()) : null;
  for (const sel of ['.hud.tl', '.hud.tr', '#back-out', '.present-launch']) {
    const el = document.querySelector(sel);
    if (el && shown(el)) { const r = el.getBoundingClientRect(); if (r.width && r.height) furniture[sel] = box(r); }
  }
  const huds = [...document.querySelectorAll('#view .hud, #hud-btns')].filter(shown).map(el => ({ id: el.className || el.id, ...box(el.getBoundingClientRect()) })).filter(r => r.r > r.l && r.b > r.t);
  return { labels, pinBoxes, furniture, chip, caps, sprites, huds };
};
const hit = (a, c, eps = 0.5) => a.l < c.r - eps && a.r > c.l + eps && a.t < c.b - eps && a.b > c.t + eps;

const failures = [];
let checked = 0;
const settled = () => p.evaluate(() => new Promise(res => { let prev = '', run = 0, n = 0; const tick = () => {
  const cur = [...document.querySelectorAll('#pins .pin')].map(e => e.style.transform + e.className).join('|') + [...document.querySelectorAll('#pins .lbl')].map(e => e.style.left + e.style.top).join('|');
  run = cur === prev ? run + 1 : 0; prev = cur; if (run >= 4 || ++n > 300) res(); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); }));
for (let scene = 0; scene < 10; scene++) for (const mode of ['power', 'data', 'heat']) {
  await p.evaluate(async ({ scene, mode }) => { await ifx.show({ scene, mode, part: null }, { scroll: false }); ifx.settle(); }, { scene, mode });
  const ids = await p.evaluate(() => [...document.querySelectorAll('#parts button[data-id]')].map(b => b.dataset.id));
  for (const sel of [null, ...ids]) {
  if (sel) await p.evaluate(id => { ifx.select(id, true); ifx.settle(); }, sel);
  else await p.evaluate(() => { document.querySelector('#parts button[data-overview]').click(); ifx.settle(); });
  await settled();
  const m = await p.evaluate(measure);
  const tag = `L${scene + 1} ${mode}${sel ? ' sel ' + sel : ''}`, found = [], notes = [];
  for (let i = 0; i < m.labels.length; i++) for (let j = i + 1; j < m.labels.length; j++)
    if (hit(m.labels[i], m.labels[j])) found.push(`labels overlap: "${m.labels[i].text}" x "${m.labels[j].text}"`);
  for (const l of m.labels) for (const [fs, r] of Object.entries(m.furniture))
    if (hit(l, r)) found.push(`label "${l.text}" over ${fs}`);
  for (const l of m.labels) for (const q of m.pinBoxes)
    if (q.id !== l.id && hit(l, q)) found.push(`label "${l.text}" over pin ${q.id}`);
  for (const sp of m.sprites) if (sp.px < 11) found.push(`canvas caption "${sp.text}" renders at ${sp.px}px type`);
  for (const c of m.caps) {
    if (c.fs < 11) found.push(`caption "${c.text}" is ${c.fs}px type`);
    for (const l of m.labels) if (hit(c, l)) found.push(`caption "${c.text}" over label "${l.text}"`);
    for (const q of m.pinBoxes) if (hit(c, q)) found.push(`caption "${c.text}" over pin ${q.id}`);
    for (const [fs, r] of Object.entries(m.furniture)) if (hit(c, r)) found.push(`caption "${c.text}" over ${fs}`);
  }
  for (let i = 0; i < m.caps.length; i++) for (let j = i + 1; j < m.caps.length; j++) if (hit(m.caps[i], m.caps[j])) found.push(`captions overlap: "${m.caps[i].text}" x "${m.caps[j].text}"`);
  if (m.chip) for (const q of m.pinBoxes) if (hit(m.chip, q)) found.push(`name chip over pin ${q.id}`);
  if (m.chip) for (const q of m.huds) if (hit(m.chip, q)) found.push(`name chip over .${q.id}`);
  if (phone && sel && !m.chip) found.push('no name chip for the selected pin');
  for (let i = 0; i < m.pinBoxes.length; i++) for (let j = i + 1; j < m.pinBoxes.length; j++)
    if (hit(m.pinBoxes[i], m.pinBoxes[j])) (phone ? found : notes).push(`pins intersect: ${m.pinBoxes[i].id} x ${m.pinBoxes[j].id}`);
  checked++;
  if (found.length) console.log([`FAIL ${form} ${tag}: ${m.pinBoxes.length} pins, ${m.labels.length} labels`, ...found.map(f => '     ' + f)].join('\n'));
  if (notes.length) console.log(`note ${form} ${tag} (not a failure on desktop): ${notes.join('; ')}`);
  for (const f of found) failures.push(`${tag}: ${f}`);
  }
  console.log(`done ${form} L${scene + 1} ${mode}: ${ids.length + 1} states`);
}
await b.close();
if (errors.length) console.log('page errors:', errors.slice(0, 5));
console.log(`\n${form}: ${checked} states (10 levels x 3 layers x overview + each part) checked, ${failures.length} failures`);
process.exit(failures.length || errors.length ? 1 : 0);
