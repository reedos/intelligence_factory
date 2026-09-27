// Story mode: the panel beside the 3D view becomes a column of beats, grid to token. Scrolling a beat to the middle
// of the column drives the stage to it. On narrow screens the view sticks to the top and the page scrolls the beats.
// Every number comes from the current scenario, so the story retells itself when a setting changes.
import { store, on } from './store.js';
import { show, reduced } from './stage.js';
import { story, watt, request, heat } from './journeys.js';

const $ = id => document.getElementById(id);
export const TOURS = {
  story: { label: 'The story', short: 'Story', beats: story },
  watt: { label: 'Follow a watt', short: 'A watt', beats: watt },
  request: { label: 'Follow a request', short: 'A request', beats: request },
  heat: { label: 'Follow the heat', short: 'The heat', beats: heat },
};
let tour = 'story';

// ---------- UI ----------
const panel = document.querySelector('.panel-scroll'), stageEl = document.querySelector('.stage');
const box = document.createElement('div');
box.className = 'story'; box.id = 'story'; box.hidden = true;
panel.appendChild(box);
let active = -1, seq = 0, observer = null, list = [];
const narrow = matchMedia('(max-width: 1100px)');

function render() {
  list = TOURS[tour].beats(store.M);
  box.innerHTML = `<div class="story-head"><div class="tour-tabs" role="tablist" aria-label="Journey">${Object.entries(TOURS).map(([id, t]) => `<button type="button" role="tab" data-tour="${id}" aria-selected="${id === tour}">${t.short}</button>`).join('')}</div><button type="button" class="btn" id="story-exit">Exit</button>`
    + `<div class="tally" id="tally" aria-live="polite"${list.some(b => b.tally) ? '' : ' hidden'}><span class="eyebrow">${TOURS[tour].label}</span><b id="tally-v"></b></div></div>`
    + list.map((b, i) => `<article class="beat" data-i="${i}"><span class="k">${String(i + 1).padStart(2, '0')} · ${b.k}</span><h3>${b.title}</h3><p>${b.text}</p></article>`).join('')
    + '<div class="beat-end"><button type="button" class="btn" id="story-done">Explore on your own</button></div>';
  $('story-exit').addEventListener('click', exit);
  box.querySelectorAll('[data-tour]').forEach(b => b.addEventListener('click', () => { if (b.dataset.tour !== tour) { tour = b.dataset.tour; active = -1; render(); panel.scrollTop = 0; scrollTo0(); activate(0); } }));
  $('story-done').addEventListener('click', exit);
  observe();
  if (active >= 0) mark(active);
}
function mark(i) {
  box.querySelectorAll('.beat').forEach(b => b.classList.toggle('on', +b.dataset.i === i));
  const v = $('tally-v'); if (v) v.textContent = list[i]?.tally ?? '';
}
function scrollTo0() { if (narrow.matches) box.querySelector('.beat')?.scrollIntoView({ block: 'start' }); }
async function activate(i) {
  if (i === active) return;
  active = i; mark(i);
  const my = ++seq;
  await show(list[i].link, { scroll: false, still: () => my === seq });
}
function observe() {
  observer?.disconnect();
  observer = new IntersectionObserver(entries => {
    const hit = entries.filter(e => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (hit) activate(+hit.target.dataset.i);
  }, { root: narrow.matches ? null : panel, rootMargin: narrow.matches ? '-60% 0px -25% 0px' : '-40% 0px -40% 0px', threshold: 0 });
  box.querySelectorAll('.beat').forEach(b => observer.observe(b));
}
function step(d) {
  const i = Math.max(0, Math.min(list.length - 1, (active < 0 ? -1 : active) + d));
  box.querySelector(`.beat[data-i="${i}"]`)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: narrow.matches ? 'start' : 'center' });
}

export function enter(which = tour) {
  if (!box.hidden && which === tour) return;
  tour = TOURS[which] ? which : 'story';
  document.body.classList.add('story');
  box.hidden = false; active = -1;
  render();
  stageEl.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  panel.scrollTop = 0;
  activate(0);
  $('story-btn')?.setAttribute('aria-pressed', 'true');
}
export function exit() {
  if (box.hidden) return;
  observer?.disconnect(); seq++;
  document.body.classList.remove('story');
  box.hidden = true; active = -1;
  $('story-btn')?.setAttribute('aria-pressed', 'false');
  panel.scrollTop = 0;
}
export const inStory = () => !box.hidden;

$('story-btn')?.addEventListener('click', () => (inStory() ? exit() : enter()));
addEventListener('keydown', e => {
  if (e.target.matches?.('input, textarea, select')) return;
  if (e.key === 's' || e.key === 'S') { inStory() ? exit() : enter(); return; }
  if (!inStory()) return;
  if (['ArrowDown', 'ArrowRight', 'PageDown'].includes(e.key)) { step(1); e.preventDefault(); e.stopImmediatePropagation(); }
  else if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(e.key)) { step(-1); e.preventDefault(); e.stopImmediatePropagation(); }
  else if (e.key === 'Escape') exit();
}, true);
narrow.addEventListener('change', () => { if (inStory()) observe(); });
on('scenario', () => { if (inStory()) render(); });
on('tokens', () => { if (inStory()) render(); });
const hashTour = location.hash.slice(1);
if (hashTour === 'story' || TOURS[hashTour]) setTimeout(() => enter(hashTour), 0);
document.querySelectorAll('[data-tour-start]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); enter(a.dataset.tourStart); }));
