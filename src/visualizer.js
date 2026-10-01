// The contained visualizer (visualizer.html): the 3D stage and its side pane fill one screen, and nothing scrolls but
// the pane. Exploration uses numbered parts, layers and scenario controls.
import { store, setScenario, pin, on } from './app/store.js';
import * as stage from './app/stage.js';
import './app/sources-ui.js';
// Tours and simulation clocks are deferred. Keep their modules for future work,
// but do not load their UI, keyboard listeners or automatic deep-link handlers.
import './app/share.js';
import './app/tokens-ui.js';
import './tokens.css';
import { THREE } from './kit.js';
import './app/scenario.js';
import './app/site.js';
import './app/campus-presentation.js';
import './app/toprow.js';
import './app/page-sheet.js';
import { setGo } from './app/links.js';
import { moreCue } from './app/more-cue.js';
import './app/ocs-figure.js';

stage.start();
// links to a part move the 3D view here, rather than opening a page
setGo(link => stage.show(link));

// test hook
window.ifx = {
  store, setScenario, pin, state: store.ui, go: stage.go, select: stage.select, setMode: stage.setMode,
  camera: stage.camera, controls: stage.controls, composers: stage.composers, built: stage.built, settle: stage.settle,
  renderer: stage.getRenderer, renderScale: stage.renderScale, quality: stage.qualityInfo, forceTier: stage.forceTier, setTransitions: stage.setTransitions,
  show: stage.show, THREE,
};
if (new URLSearchParams(location.search).has('module')) import('./app/blender-test.js');
if (new URLSearchParams(location.search).get('module') !== 'native') import('./app/module-presentation.js');
if (new URLSearchParams(location.search).get('devicecheck') === '1') import('./app/device-check.js');

// the side pane's two tabs: the parts of the level on screen, and the scenario that sizes everything
const tabs = [...document.querySelectorAll('[data-pane]')], sc = document.getElementById('pane-scenario');
function showPane(which) {
  tabs.forEach(b => b.setAttribute('aria-selected', String(b.dataset.pane === which)));
  sc.hidden = which !== 'scenario';
  document.querySelectorAll('.panel-scroll > :not(#pane-scenario):not(.story):not(.pane-note)').forEach(el => el.classList.toggle('pane-off', which === 'scenario'));
  document.querySelector('.panel-scroll').scrollTop = 0;
}
tabs.forEach(b => b.addEventListener('click', () => { showPane(b.dataset.pane); if (b.dataset.pane === 'scenario') setSheet(true); }));
// phones: the side pane is a sheet the reader can pull up (the view shrinks to a strip) or push back down
const sheetBtn = document.getElementById('sheet-toggle');
function setSheet(open) { document.body.style.removeProperty('--inspector-size'); document.body.classList.toggle('sheet-open', open); sheetBtn.setAttribute('aria-expanded', String(open)); sheetBtn.setAttribute('aria-label', open ? 'Shrink the panel' : 'Expand the panel'); }
// the pane says when there is more below its fold; on a phone whose sheet is down, More pulls the sheet up first
const phoneSheet = () => matchMedia('(max-width: 1100px)').matches;
// on the parts tab it counts the parts still below the fold
const scroller = document.querySelector('.panel-scroll');
const moreLabel = () => {
  if (!sc.hidden) return 'More';
  const fold = scroller.getBoundingClientRect().bottom - 24;
  const below = [...document.querySelectorAll('#parts button[data-id]')].filter(b => b.getBoundingClientRect().top > fold).length;
  return below ? `${below} more part${below === 1 ? '' : 's'}` : 'More';
};
moreCue(scroller, { host: document.querySelector('.panel'), label: moreLabel,
  press: () => { if (phoneSheet() && !document.body.classList.contains('sheet-open')) { setSheet(true); return true; } return false; } });
document.getElementById('card-more').addEventListener('click', () => setSheet(true));
// a part picked (a pin, a row, a link) shows on the parts tab: on a phone whose sheet is down, that is the peek, with
// the part's name, its key figure and its door
on('select', () => { if (sc.hidden) return; showPane('parts'); });
// the level's intro keeps to three lines so the part list starts high in the pane; Read more opens the rest
const intro = document.getElementById('intro'), introMore = document.getElementById('intro-more');
function fitIntro() {
  intro.classList.remove('open'); introMore.textContent = 'Read more'; introMore.setAttribute('aria-expanded', 'false');
  requestAnimationFrame(() => { if (intro.getClientRects().length) introMore.hidden = intro.scrollHeight <= intro.clientHeight + 2; });
}
new MutationObserver(fitIntro).observe(intro, { childList: true, characterData: true, subtree: true });
addEventListener('resize', () => { if (!intro.classList.contains('open')) fitIntro(); });
introMore.addEventListener('click', () => {
  const open = !intro.classList.contains('open');
  intro.classList.toggle('open', open); introMore.textContent = open ? 'Less' : 'Read more'; introMore.setAttribute('aria-expanded', String(open));
});
tabs.forEach(b => b.addEventListener('click', () => { if (b.dataset.pane === 'parts') fitIntro(); }));
let sheetDrag = null, dragged = false;
sheetBtn.addEventListener('pointerdown', e => {
  if (!matchMedia('(max-width: 1100px)').matches) return;
  sheetDrag = { y: e.clientY, height: document.querySelector('.panel').getBoundingClientRect().height };
  dragged = false; sheetBtn.setPointerCapture(e.pointerId);
});
sheetBtn.addEventListener('pointermove', e => {
  if (!sheetDrag) return;
  const delta = sheetDrag.y - e.clientY;
  if (Math.abs(delta) > 5) dragged = true;
  if (!dragged) return;
  const height = Math.max(82, Math.min(innerHeight * .62, sheetDrag.height + delta));
  document.body.style.setProperty('--inspector-size', `${height}px`);
  const open = height > innerHeight * .35;
  document.body.classList.toggle('sheet-open', open);
  sheetBtn.setAttribute('aria-expanded', String(open));
  sheetBtn.setAttribute('aria-label', open ? 'Shrink the panel' : 'Expand the panel');
});
sheetBtn.addEventListener('pointerup', () => { sheetDrag = null; });
sheetBtn.addEventListener('pointercancel', () => { sheetDrag = null; dragged = false; });
sheetBtn.addEventListener('click', () => { if (!dragged) setSheet(!document.body.classList.contains('sheet-open')); dragged = false; });
{
  const q = new URLSearchParams(location.search);
  if (q.get('pane') === 'scenario') {
    showPane('scenario'); setSheet(true);
    q.delete('pane');
    try { history.replaceState(null, '', `${location.pathname}${q.size ? `?${q}` : ''}${location.hash}`); } catch { /* sandboxed viewers refuse */ }
  }
}
const sum = document.getElementById('pane-sum');
const summarize = () => { const M = store.M; if (M && sum) sum.textContent = `${M.accel.short ?? M.accel.id} · ${Math.round(M.meterMW).toLocaleString('en-US')} MW · ${M.cooling.short ?? M.cooling.id}`; };
import('./app/store.js').then(({ on }) => { on('scenario', summarize); summarize(); });
