// The contained visualizer (visualizer.html): the 3D stage and its side pane fill one screen, and nothing scrolls but
// the pane. The same store, stage, tours and scenario controls as the story page, without its chapters.
import { store, setScenario, pin } from './app/store.js';
import * as stage from './app/stage.js';
import './app/sources-ui.js';
import './app/story.js';
import './app/clock-ui.js';
import './app/share.js';
import './app/tokens-ui.js';
import './tokens.css';
import { THREE } from './kit.js';
import * as journeys from './app/journeys.js';
import { openClock, closeClock } from './app/clock-ui.js';
import { enter as enterStory, exit as exitStory } from './app/story.js';
import './app/scenario.js';
import './app/site.js';
import { setGo } from './app/links.js';

stage.start();
// links to a part move the 3D view here, rather than opening a page
setGo(link => stage.show(link));

// test hook
window.ifx = {
  store, setScenario, pin, state: store.ui, go: stage.go, select: stage.select, setMode: stage.setMode,
  camera: stage.camera, controls: stage.controls, composers: stage.composers, built: stage.built, settle: stage.settle,
  renderer: stage.getRenderer, renderScale: stage.renderScale, quality: stage.qualityInfo, forceTier: stage.forceTier, setTransitions: stage.setTransitions,
  show: stage.show, THREE, journeys, openClock, closeClock, enterStory, exitStory,
};

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
function setSheet(open) { document.body.classList.toggle('sheet-open', open); sheetBtn.setAttribute('aria-expanded', String(open)); sheetBtn.setAttribute('aria-label', open ? 'Shrink the panel' : 'Expand the panel'); }
sheetBtn.addEventListener('click', () => setSheet(!document.body.classList.contains('sheet-open')));
const sum = document.getElementById('pane-sum');
const summarize = () => { const M = store.M; if (M && sum) sum.textContent = `${M.accel.short ?? M.accel.id} · ${Math.round(M.meterMW).toLocaleString('en-US')} MW · ${M.cooling.short ?? M.cooling.id}`; };
import('./app/store.js').then(({ on }) => { on('scenario', summarize); summarize(); });
