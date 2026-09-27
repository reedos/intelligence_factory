// Story mode: the panel beside the 3D view becomes a column of beats, grid to token. Scrolling a beat to the middle
// of the column drives the stage to it. On narrow screens the view sticks to the top and the page scrolls the beats.
// Every number comes from the current scenario, so the story retells itself when a setting changes.
// Play steps through on its own: each beat holds long enough to read once the camera has arrived, then the next
// one scrolls in; after the story come the watt, the request and the heat. Any drag, wheel, touch or key pauses it.
import { store, on } from './store.js';
import { show, reduced, onTick } from './stage.js';
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
let playing = false, arrived = false, held = 0;         // held: ms spent on the current beat since the camera arrived
const ORDER = Object.keys(TOURS);
const dwell = b => Math.min(16000, Math.max(6000, 3000 + `${b.title} ${b.text}`.split(/\s+/).length * 230));   // ≈260 words a minute
const narrow = matchMedia('(max-width: 1100px)');

function render() {
  list = TOURS[tour].beats(store.M);
  box.innerHTML = `<div class="story-head"><div class="tour-tabs" role="tablist" aria-label="Journey">${Object.entries(TOURS).map(([id, t]) => `<button type="button" role="tab" data-tour="${id}" aria-selected="${id === tour}">${t.short}</button>`).join('')}</div><button type="button" class="btn" id="story-exit">Exit</button>`
    + `<button type="button" class="btn play" id="story-play" aria-pressed="${playing}">${playing ? 'Pause' : 'Play'}</button>`
    + `<div class="tally" id="tally" aria-live="polite"${list.some(b => b.tally) ? '' : ' hidden'}><span class="eyebrow">${TOURS[tour].label}</span><b id="tally-v"></b></div></div>`
    + list.map((b, i) => `<article class="beat" data-i="${i}"><span class="k">${String(i + 1).padStart(2, '0')} · ${b.k}</span><h3>${b.title}</h3><p>${b.text}</p><span class="beat-bar" aria-hidden="true"><i></i></span></article>`).join('')
    + '<div class="beat-end"><button type="button" class="btn" id="story-done">Explore on your own</button></div>';
  $('story-exit').addEventListener('click', exit);
  $('story-play').addEventListener('click', () => setPlaying(!playing));
  box.querySelectorAll('[data-tour]').forEach(b => b.addEventListener('click', () => { if (b.dataset.tour !== tour) switchTour(b.dataset.tour); }));
  $('story-done').addEventListener('click', exit);
  observe();
  if (active >= 0) mark(active);
}
function mark(i) {
  box.querySelectorAll('.beat').forEach(b => b.classList.toggle('on', +b.dataset.i === i));
  const v = $('tally-v'); if (v) v.textContent = list[i]?.tally ?? '';
}
function scrollTo0() { if (narrow.matches) box.querySelector('.beat')?.scrollIntoView({ block: 'start' }); }
function switchTour(id) { tour = id; active = -1; render(); panel.scrollTop = 0; scrollTo0(); activate(0); }
async function activate(i) {
  if (i === active) return;
  active = i; mark(i); arrived = false; held = 0; bar(0);
  const my = ++seq;
  await show(list[i].link, { scroll: false, still: () => my === seq });
  if (my === seq) arrived = true;                        // the reading clock starts once the camera is there
}
function bar(p) { const i = box.querySelector(`.beat[data-i="${active}"] .beat-bar i`); if (i) i.style.transform = `scaleX(${p})`; }
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
  setPlaying(false);
  observer?.disconnect(); seq++;
  document.body.classList.remove('story');
  box.hidden = true; active = -1;
  $('story-btn')?.setAttribute('aria-pressed', 'false');
  panel.scrollTop = 0;
}
export const inStory = () => !box.hidden;

// ---------- play / pause ----------
export function setPlaying(on_) {
  playing = on_;
  document.body.classList.toggle('playing', playing);
  const b = $('story-play'); if (b) { b.textContent = playing ? 'Pause' : 'Play'; b.setAttribute('aria-pressed', String(playing)); }
  if (!playing) bar(0);
}
export function play(which = 'story') { if (!inStory() || which !== tour) enter(which); setPlaying(true); }
onTick(dt => {
  if (!playing || box.hidden || active < 0 || !arrived) return;
  held += dt * 1000 * (window.ifx?.tourPace || 1);       // tests speed it up; readers get real time
  const need = dwell(list[active]);
  bar(Math.min(1, held / need));
  if (held < need) return;
  arrived = false;                                        // wait for the next beat's camera before counting again
  if (active < list.length - 1) step(1);
  else {
    const next = ORDER[ORDER.indexOf(tour) + 1];
    if (next) switchTour(next);
    else { setPlaying(false); box.querySelector('.beat-end')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' }); }
  }
});
// the reader taking the controls pauses the tour
const takeOver = e => { if (playing && !e.target.closest?.('#story-play, #story-hero-play')) setPlaying(false); };
for (const el of [panel, $('view')]) for (const ev of ['wheel', 'touchstart', 'pointerdown']) el?.addEventListener(ev, takeOver, { passive: true });
addEventListener('wheel', e => { if (playing && narrow.matches) takeOver(e); }, { passive: true });
addEventListener('touchmove', e => { if (playing && narrow.matches) takeOver(e); }, { passive: true });

$('story-btn')?.addEventListener('click', () => (inStory() ? exit() : enter()));
addEventListener('keydown', e => {
  if (e.target.matches?.('input, textarea, select')) return;
  if (e.key === 's' || e.key === 'S') { inStory() ? exit() : enter(); return; }
  if (!inStory()) return;
  if (e.key === ' ' && !e.target.closest?.('button, a')) { setPlaying(!playing); e.preventDefault(); e.stopImmediatePropagation(); return; }
  if (['ArrowDown', 'ArrowRight', 'PageDown'].includes(e.key)) { setPlaying(false); step(1); e.preventDefault(); e.stopImmediatePropagation(); }
  else if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(e.key)) { setPlaying(false); step(-1); e.preventDefault(); e.stopImmediatePropagation(); }
  else if (e.key === 'Escape') exit();
}, true);
narrow.addEventListener('change', () => { if (inStory()) observe(); });
on('scenario', () => { if (inStory()) render(); });
on('tokens', () => { if (inStory()) render(); });
const hashTour = location.hash.slice(1);
if (hashTour === 'story' || TOURS[hashTour]) setTimeout(() => enter(hashTour), 0);
document.querySelectorAll('[data-tour-start]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); enter(a.dataset.tourStart); }));
$('story-hero-play')?.addEventListener('click', e => { e.preventDefault(); play('story'); });
