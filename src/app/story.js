// Story mode: the panel beside the 3D view becomes a column of beats, grid to token. Scrolling a beat to the middle
// of the column drives the stage to it. On narrow screens the tour takes the whole screen instead, one beat at a
// time under the view, so the view gets every pixel the text does not need.
// Every number comes from the current scenario, so the story retells itself when a setting changes.
// Play steps through on its own: each beat holds long enough to read once the camera has arrived, then the next
// one comes in; after the story come the watt, the request and the heat. Looking around (a drag, wheel or touch)
// only holds the tour: it carries on a few seconds after the reader lets go, from whichever beat is showing.
// Pause (the button, or Space) is the only thing that stops it. One transport at the head of the panel (play,
// back, forward, speed, where the tour is) is the only playback control on the page.
import { store, on } from './store.js';
import { show, go, reduced, onTick, setCinema, setTourPace, getTransitions, setTransitions } from './stage.js';
import { story, watt, request, heat, layer, everything, CHAIN } from './journeys.js';
import { openClock, closeClock } from './clock-ui.js';

const $ = id => document.getElementById(id);
// the id 'story' stays for old links (#story); readers see it as the overview
// 'here' is every numbered part of the level and layer on screen when it starts, 1 to N
const here = { scene: 0, mode: 'power' };
const MODE_NAME = { power: 'power', data: 'data', heat: 'heat' };
export const TOURS = {
  story: { label: 'Overview: all six levels, once', short: 'Overview', beats: story, group: 'Tours' },
  heat: { label: 'Follow the heat', short: 'The heat', beats: heat, group: 'Tours' },
  watt: { label: 'Follow a watt', short: 'A watt', beats: watt, group: 'Tours' },
  request: { label: 'Follow a request', short: 'A request', beats: request, group: 'Tours' },
  here: { get label() { return `Every ${MODE_NAME[here.mode]} part, level ${here.scene + 1}`; }, short: 'This level', beats: M => layer(M, here.mode, here.scene), group: 'Every part' },
  'all-power': { label: 'Every part: power, levels 1 to 6', short: 'Power', beats: M => layer(M, 'power'), group: 'Every part' },
  'all-heat': { label: 'Every part: heat, levels 6 to 1', short: 'Heat', beats: M => layer(M, 'heat'), group: 'Every part' },
  'all-data': { label: 'Every part: data, levels 1 to 6', short: 'Data', beats: M => layer(M, 'data'), group: 'Every part' },
  'all': { label: 'Every part, every layer', short: 'All', beats: everything, group: 'Every part' },
};
let tour = 'story';
let resume = null;                                        // { tour, i }: where the reader left a tour to look around

// ---------- UI ----------
const panel = document.querySelector('.panel-scroll'), stageEl = document.querySelector('.stage');
const box = document.createElement('div');
box.className = 'story'; box.id = 'story'; box.hidden = true;
panel.appendChild(box);
let active = -1, seq = 0, observer = null, list = [];
let playing = false, arrived = false, held = 0;         // held: ms spent on the current beat since the camera arrived
let pace = 1, ranClock = false, holdUntil = 0;           // holdUntil: the reader is looking around; wait until then
const HOLD_MS = 4000;                          // pace: 1× to 8×; ranClock: the tour opened the clock, so it closes it
const PACES = [1, 2, 4, 8];
try { const p = +localStorage.getItem('ifx-pace'); if (PACES.includes(p)) pace = p; } catch { /* storage refused: stay at 1× */ }
setTourPace(pace);
function setPace(p) {
  pace = p; setTourPace(p);
  try { localStorage.setItem('ifx-pace', String(p)); } catch { /* not remembered, still works */ }
  paceLabel();
}
function paceLabel() {
  const c = $('tour-pace'); if (c) { c.innerHTML = `${pace}×<i aria-hidden="true"></i>`; c.setAttribute('aria-label', `Tour speed ${pace}× and level transitions`); }
}
// ---------- the speed menu: tour speed, and how every level transition plays ----------
const PACE_NOTE = { 1: 'reading pace', 2: '', 4: '', 8: 'skim' };
const TRANS = [['full', 'Full', 'slow dive'], ['quick', 'Quick', ''], ['instant', 'Instant', 'straight cut']];
let paceMenu = null;
function closePaceMenu(focus = false) {
  if (!paceMenu) return;
  paceMenu.remove(); paceMenu = null;
  const b = $('tour-pace'); b?.setAttribute('aria-expanded', 'false'); if (focus) b?.focus();
}
function togglePaceMenu(btn) {
  if (paceMenu) { closePaceMenu(); return; }
  paceMenu = document.createElement('div');
  paceMenu.className = 'pace-menu'; paceMenu.setAttribute('role', 'menu'); paceMenu.setAttribute('aria-label', 'Tour speed and level transitions');
  const item = (attr, v, label, note, on) => `<button type="button" role="menuitemradio" ${attr}="${v}" aria-checked="${on}"><b>${label}</b>${note ? `<span>${note}</span>` : ''}</button>`;
  paceMenu.innerHTML = `<div role="group" aria-labelledby="pace-h1"><span class="pace-h" id="pace-h1">Tour speed</span>${PACES.map(p => item('data-p', p, `${p}×`, PACE_NOTE[p], p === pace)).join('')}</div>`
    + `<div role="group" aria-labelledby="pace-h2"><span class="pace-h" id="pace-h2">Level transitions</span>${TRANS.map(([v, l, n]) => item('data-t', v, l, n, v === getTransitions())).join('')}</div>`;
  document.body.appendChild(paceMenu);
  paceMenu.style.maxHeight = `${innerHeight - 16}px`;     // a landscape phone is shorter than the menu
  const r = btn.getBoundingClientRect(), h = paceMenu.offsetHeight, w = paceMenu.offsetWidth;
  const below = r.bottom + 6 + h <= innerHeight;
  paceMenu.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, r.left))}px`;
  paceMenu.style.top = `${Math.max(8, Math.min(innerHeight - h - 8, below ? r.bottom + 6 : r.top - 6 - h))}px`;
  btn.setAttribute('aria-expanded', 'true');
  const opts = [...paceMenu.querySelectorAll('[role="menuitemradio"]')];
  opts.forEach(o => o.addEventListener('click', () => { if (o.dataset.p) setPace(+o.dataset.p); else setTransitions(o.dataset.t); closePaceMenu(true); }));
  paceMenu.addEventListener('keydown', e => {
    const i = opts.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { opts[(i + 1) % opts.length].focus(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { opts[(i - 1 + opts.length) % opts.length].focus(); e.preventDefault(); }
    else if (e.key === 'Escape' || e.key === 'Tab') { closePaceMenu(e.key === 'Escape'); e.preventDefault(); }
    e.stopPropagation();                                    // the tour's own keys (Space, arrows) stay out of the menu
  });
  (opts.find(o => o.getAttribute('aria-checked') === 'true') || opts[0]).focus();
}
document.addEventListener('pointerdown', e => { if (paceMenu && !e.target.closest('.pace-menu, #tour-pace')) closePaceMenu(); }, true);
addEventListener('resize', () => closePaceMenu());
addEventListener('scroll', () => closePaceMenu(), { passive: true });   // the page, not the tour column scrolling itself

// playing on carries through the tours, or through the layers, in CHAIN order; never from one group to the other
const nextTour = id => { const g = CHAIN[TOURS[id].group] || [], k = g.indexOf(id); return k < 0 ? null : g[k + 1] ?? null; };
const prevTour = id => { const g = CHAIN[TOURS[id].group] || [], k = g.indexOf(id); return k > 0 ? g[k - 1] : null; };
// past the last step: the next level of a level playthrough, or the next tour in its group
const beyond = () => tour === 'here' ? (here.scene < store.C.SCENES.length - 1 ? { level: here.scene + 1 } : null) : (nextTour(tour) ? { tour: nextTour(tour) } : null);
const before = () => tour === 'here' ? (here.scene > 0 ? { level: here.scene - 1 } : null) : (prevTour(tour) ? { tour: prevTour(tour) } : null);
function crossTo(t, at) {
  if (!t) return false;
  if (t.level !== undefined) { here.scene = t.level; switchTour('here', at); } else switchTour(t.tour, at);
  return true;
}
// ≈260 words a minute; a beat running a clock holds at least 16 s so the simulation gets to its point (an outage's
// generators come on 7.5 s in at playback speed)
const dwell = b => Math.max(b.sim ? 16000 : 0, Math.min(16000, Math.max(6000, 3000 + `${b.title} ${b.text}`.split(/\s+/).length * 230)));
const narrow = matchMedia('(max-width: 1100px)');

// A step on a part that holds another level (the campus on the map, the halls, a rack, a tray, the GPU) gets a button
// named for where it goes. The last step of every tour offers the next move: the next level of a level playthrough,
// the next tour, or exploring from here. Nothing ends in a sentence that says "go in" with nowhere to click.
const partOf = l => {
  if (!l?.part) return null;
  const C = store.C, P = { power: C.PARTS, data: C.PARTS_DATA, heat: C.PARTS_HEAT }[l.mode] || {};
  return (P[C.SCENES[l.scene].id] || []).find(p => p.id === l.part) || null;
};
function goButton(b) {
  if (tour !== 'here') return '';                          // the narrated tours already go in; a way out mid-story is noise
  const p = partOf(b.link); if (!p || p.drill === undefined) return '';
  const inward = p.drill > b.link.scene, to = store.C.SCENES[p.drill];
  return `<button type="button" class="btn go beat-go" data-drill="${p.drill}" data-from="${p.id}" data-scene="${b.link.scene}">${inward ? 'Go inside' : 'Back out'}: ${to.title} ${inward ? '→' : '↑'}</button>`;
}
function nextSteps() {
  const acts = ['<button type="button" class="btn" data-restart>↺ Start over</button>'], S = store.C.SCENES;
  if (tour === 'here' && here.scene < S.length - 1) acts.push(`<button type="button" class="btn go" data-next-level="${here.scene + 1}">Play level ${here.scene + 2}: ${S[here.scene + 1].title} →</button>`);
  const nt = nextTour(tour);
  if (nt) acts.push(`<button type="button" class="btn${acts.some(a => a.includes('btn go')) ? '' : ' go'}" data-next-tour="${nt}">Next: ${TOURS[nt].label} →</button>`);
  acts.push('<button type="button" class="btn" data-explore>Explore on your own</button>');
  return acts.join('');
}
function render() {
  list = TOURS[tour].beats(store.M);
  const tabs = g => `<div class="tour-group"><span class="tour-g">${g}</span><div class="tour-tabs" role="tablist" aria-label="${g}">${Object.entries(TOURS).filter(([, t]) => t.group === g).map(([id, t]) => `<button type="button" role="tab" data-tour="${id}" aria-selected="${id === tour}">${t.short}</button>`).join('')}</div></div>`;
  box.innerHTML = `<div class="story-head">`
    + `<div class="transport" role="group" aria-label="Tour playback">`
    + `<button type="button" class="btn play" id="tour-play" aria-pressed="${playing}" aria-label="${playing ? 'Pause' : 'Play'}">${playing ? '❚❚' : '▶'}</button>`
    + `<button type="button" class="btn icon" id="tour-prev" aria-label="Previous step">‹</button>`
    + `<button type="button" class="btn icon" id="tour-next" aria-label="Next step">›</button>`
    + `<button type="button" class="btn pace" id="tour-pace" aria-haspopup="menu" aria-expanded="false"></button>`
    + `<span class="tour-t" id="tour-t" aria-live="polite"></span>`
    + `<button type="button" class="btn icon" id="story-exit" aria-label="Leave the tour">×</button></div>`
    + `<div class="tour-pick">${tabs('Tours')}${tabs('Every part')}</div>`
    + `<div class="tally" id="tally" aria-live="polite"${list.some(b => b.tally) && tour !== 'here' ? '' : ' hidden'}><span class="eyebrow">${TOURS[tour].label}</span><b id="tally-v"></b></div></div>`
    + list.map((b, i) => {
      // the last step of a level playthrough already offers the next level; a second button to the same place is noise
      const last = i === list.length - 1, into = partOf(b.link)?.drill, dup = last && tour === 'here' && into === here.scene + 1;
      const acts = (dup ? '' : goButton(b)) + (last ? nextSteps() : '');
      return `<article class="beat${b.level ? ' level' : ''}" data-i="${i}"><span class="k">${String(i + 1).padStart(2, '0')} · ${b.k}</span><h3>${b.title}</h3><p>${b.text}</p>${b.specs ? `<dl class="beat-specs">${b.specs.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>` : ''}${acts ? `<div class="beat-acts">${acts}</div>` : ''}<span class="beat-bar" aria-hidden="true"><i></i></span></article>`; }).join('');
  $('story-exit').addEventListener('click', exit);
  $('tour-play').addEventListener('click', () => setPlaying(!playing));
  $('tour-prev').addEventListener('click', () => step(-1));
  $('tour-next').addEventListener('click', () => step(1));
  $('tour-pace').addEventListener('click', e => togglePaceMenu(e.currentTarget));
  paceLabel();
  box.querySelectorAll('[data-tour]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.tour === tour) return;
    if (b.dataset.tour === 'here') { here.scene = store.ui.scene; here.mode = store.ui.mode; }   // the level on screen now
    switchTour(b.dataset.tour);
  }));
  box.querySelectorAll('[data-drill]').forEach(b => b.addEventListener('click', () => {
    const to = +b.dataset.drill;
    if (tour === 'here') { here.scene = to; switchTour('here'); return; }   // a level playthrough carries on at the new level
    exit({ remember: true });
    go(to, b.dataset.from);                                   // dive through the part, into the level it holds
  }));
  box.querySelectorAll('[data-next-level]').forEach(b => b.addEventListener('click', () => { here.scene = +b.dataset.nextLevel; switchTour('here'); setPlaying(true); }));
  box.querySelectorAll('[data-next-tour]').forEach(b => b.addEventListener('click', () => { switchTour(b.dataset.nextTour); setPlaying(true); }));
  box.querySelectorAll('[data-explore]').forEach(b => b.addEventListener('click', () => exit()));
  box.querySelectorAll('[data-restart]').forEach(b => b.addEventListener('click', () => { switchTour(tour); setPlaying(true); }));
  observe();
  if (active >= 0) mark(active);
  else ctlLabel();
}
function mark(i) {
  box.querySelectorAll('.beat').forEach(b => b.classList.toggle('on', +b.dataset.i === i));
  ctlLabel();
  const v = $('tally-v'); if (v) v.textContent = list[i]?.tally ?? '';
}
// at: 'last' opens a tour on its last step (going back into it from the one after)
function switchTour(id, at) {
  tour = id; active = -1; render(); panel.scrollTop = 0;
  const i = at === 'last' ? list.length - 1 : 0;
  if (i && !narrow.matches) centerInPanel(box.querySelector(`.beat[data-i="${i}"]`), false);
  activate(i);
}
async function activate(i) {
  if (i === active) return;
  active = i; mark(i); arrived = false; held = 0; bar(0);
  const my = ++seq;
  const sim = list[i].sim;                                // a beat about something that moves in time runs its clock
  if (sim) { openClock(sim); ranClock = true; } else if (ranClock) { closeClock(); ranClock = false; }
  await show(list[i].link, { scroll: false, still: () => my === seq });
  if (my !== seq) return;
  arrived = true;                                        // the reading clock starts once the camera is there
  // a part this scenario's scene does not draw: while playing, move straight on
  const want = list[i].link.part;
  if (playing && want && store.ui.selected !== want) held = dwell(list[i]);
}
function bar(p) { const i = box.querySelector(`.beat[data-i="${active}"] .beat-bar i`); if (i) i.style.transform = `scaleX(${p})`; }
// beside the view, the beat scrolled to the middle of the column is the one on stage; on narrow screens only the
// beat on stage is drawn, so the buttons and keys step it directly
function observe() {
  observer?.disconnect(); observer = null;
  if (narrow.matches) return;
  observer = new IntersectionObserver(entries => {
    if (performance.now() < steering) return;                // beats passed on the way to the one a step chose
    const hit = entries.filter(e => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (hit) activate(+hit.target.dataset.i);
  }, { root: panel, rootMargin: '-40% 0px -40% 0px', threshold: 0 });
  box.querySelectorAll('.beat').forEach(b => observer.observe(b));
}
// center a beat in the column by scrolling the column alone; scrollIntoView would scroll the page too and slide the
// stage up under the top bar
let steering = 0;                                         // until then the column is scrolling for a step, not for the reader
function centerInPanel(el, smooth = true) {
  if (!el) return;
  const r = el.getBoundingClientRect(), pr = panel.getBoundingClientRect(), dy = r.top - pr.top - (pr.height - r.height) / 2;
  steering = performance.now() + 250 + Math.min(1500, Math.abs(dy) * 0.6);
  panel.scrollBy({ top: dy, behavior: smooth && !reduced ? 'smooth' : 'auto' });
}
panel.addEventListener('scrollend', () => { steering = Math.min(steering, performance.now() + 60); });
function step(d) {
  if (d > 0 && active === list.length - 1) { crossTo(beyond()); return; }
  if (d < 0 && active === 0) { crossTo(before(), 'last'); return; }
  const i = Math.max(0, Math.min(list.length - 1, (active < 0 ? -1 : active) + d));
  activate(i);                                            // at once, so quick presses count from the beat they see
  if (narrow.matches) { box.querySelector('.beat.on')?.scrollTo?.(0, 0); return; }
  centerInPanel(box.querySelector(`.beat[data-i="${i}"]`));
}

// fromStart: a button that names a tour starts it over; the Tours button picks up where the reader left off
export function enter(which = tour, { fromStart = false } = {}) {
  if (!box.hidden && which === tour) return;
  tour = TOURS[which] ? which : 'story';
  const at = !fromStart && resume?.tour === tour ? resume.i : 0;
  resume = null;
  document.body.classList.add('story');
  box.hidden = false; active = -1; setCinema(true);
  render();
  if (!narrow.matches) stageEl.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });   // narrow: the tour is full screen
  panel.scrollTop = 0;
  if (at && !narrow.matches) centerInPanel(box.querySelector(`.beat[data-i="${at}"]`), false);
  activate(Math.min(at, list.length - 1));
  $('story-btn')?.setAttribute('aria-pressed', 'true');
}
// remember: the reader went off to look at something themselves, so the Tours button brings them back here
export function exit({ remember = false } = {}) {
  if (box.hidden) return;
  resume = remember && active >= 0 ? { tour, i: active } : null;
  setPlaying(false);
  if (ranClock) { closeClock(); ranClock = false; }
  observer?.disconnect(); seq++;
  document.body.classList.remove('story');
  box.hidden = true; active = -1; setCinema(false);
  $('story-btn')?.setAttribute('aria-pressed', 'false');
  panel.scrollTop = 0;
  if (narrow.matches) stageEl.scrollIntoView({ block: 'start' });   // back on the page, at the view the tour left
}
export const inStory = () => !box.hidden;

// ---------- play / pause ----------
// on the last step, paused, Play means start over, and shows it
function playIcon() {
  const b = $('tour-play'); if (!b) return;
  const again = !playing && active === list.length - 1 && list.length > 1;
  b.textContent = playing ? '❚❚' : again ? '↺' : '▶';
  b.setAttribute('aria-label', playing ? 'Pause' : again ? 'Start over and play' : 'Play');
}
export function setPlaying(on_) {
  if (on_ && !playing && active === list.length - 1 && list.length > 1 && inStory()) { playing = true; activate(0); if (!narrow.matches) centerInPanel(box.querySelector('.beat[data-i="0"]')); }
  playing = on_; holdUntil = 0;
  document.body.classList.toggle('playing', playing);
  const b = $('tour-play'); if (b) b.setAttribute('aria-pressed', String(playing));
  playIcon(); ctlLabel();
}
// where the tour is, and whether it is waiting on the reader
let heldShown = false;
function ctlLabel() {
  const t = $('tour-t'); if (!t || active < 0 || !list[active]) return;
  const held = playing && performance.now() < holdUntil;
  heldShown = held;
  const last = active === list.length - 1, nb = beyond(), pb = before();
  t.textContent = held ? 'Carries on when you let go'
    : `${active + 1} of ${list.length}${last && !playing && nb ? ` · › ${nb.level !== undefined ? `level ${nb.level + 1}` : TOURS[nb.tour].short}` : playing ? '' : ' · paused'}`;
  $('tour-prev').disabled = active === 0 && !pb; $('tour-next').disabled = last && !nb;
  $('tour-next').setAttribute('aria-label', last && nb ? (nb.level !== undefined ? `Next level: ${store.C.SCENES[nb.level].title}` : `Next tour: ${TOURS[nb.tour].label}`) : 'Next step');
  $('tour-prev').setAttribute('aria-label', active === 0 && pb ? (pb.level !== undefined ? `Previous level: ${store.C.SCENES[pb.level].title}` : `Previous tour: ${TOURS[pb.tour].label}`) : 'Previous step');
  playIcon();
}
function hold() { if (playing) { holdUntil = performance.now() + HOLD_MS; if (!heldShown) ctlLabel(); } }
export function play(which = 'story') { if (!inStory() || which !== tour) enter(which, { fromStart: true }); setPlaying(true); }
onTick(dt => {
  if (!playing || box.hidden || active < 0) return;
  if (performance.now() < holdUntil) return;              // the reader is looking around
  if (heldShown) ctlLabel();
  if (!arrived) return;
  held += dt * 1000 * pace * (window.ifx?.tourPace || 1);   // tourPace is for tests
  const need = dwell(list[active]);
  bar(Math.min(1, held / need));
  if (held < need) return;
  arrived = false;                                        // wait for the next beat's camera before counting again
  if (active < list.length - 1) step(1);
  else {
    const next = nextTour(tour);
    if (next) switchTour(next);
    else setPlaying(false);                                // the last step offers what comes next
  }
});
// the reader looking around holds the tour; it carries on HOLD_MS after the last touch, drag or wheel
const lookAround = e => { if (!e.target.closest?.('.story-head, .beat-acts, .pace-menu, #story-hero-play, #clock')) hold(); };
for (const el of [panel, $('view')]) for (const ev of ['wheel', 'touchstart', 'touchmove', 'pointerdown', 'pointermove']) el?.addEventListener(ev, e => { if (ev !== 'pointermove' || e.buttons) lookAround(e); }, { passive: true });
addEventListener('wheel', e => { if (narrow.matches) lookAround(e); }, { passive: true });
addEventListener('touchmove', e => { if (narrow.matches) lookAround(e); }, { passive: true });

$('story-btn')?.addEventListener('click', () => (inStory() ? exit() : enter()));
document.addEventListener('click', e => {
  if (inStory() && e.target.closest?.('.step, .pin, [data-mode], [data-go]') && !e.target.closest('#story')) exit({ remember: true });   // #story: body.story matches '.story'
}, true);
addEventListener('keydown', e => {
  if (e.target.matches?.('input, textarea, select') || e.target.closest?.('.pace-menu')) return;   // a menu keeps its own keys
  if (e.key === 's' || e.key === 'S') { inStory() ? exit() : enter(); return; }
  if (!inStory()) return;
  if (e.key.length === 1 && '123456pdhPDH'.includes(e.key)) { exit({ remember: true }); return; }   // the stage takes the key from here
  if (e.key === ' ' && !e.target.closest?.('button, a')) { setPlaying(!playing); e.preventDefault(); e.stopImmediatePropagation(); return; }
  if (['ArrowDown', 'ArrowRight', 'PageDown'].includes(e.key)) { step(1); e.preventDefault(); e.stopImmediatePropagation(); }
  else if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(e.key)) { step(-1); e.preventDefault(); e.stopImmediatePropagation(); }
  else if (e.key === 'Escape') exit();
}, true);
narrow.addEventListener('change', () => { if (inStory()) observe(); });
on('scenario', () => { if (inStory()) render(); });
on('tokens', () => { if (inStory()) render(); });
// #tour-watt and the like start a tour on load; the older #story, #watt and #request still do. (#heat, #power and
// #data are the page's chapters now.)
const hashRaw = location.hash.slice(1), hashTour = hashRaw.startsWith('tour-') ? hashRaw.slice(5) : ['story', 'watt', 'request'].includes(hashRaw) ? hashRaw : null;
if (hashTour && TOURS[hashTour]) setTimeout(() => enter(hashTour), 0);
document.querySelectorAll('[data-tour-start]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); enter(a.dataset.tourStart); }));
$('story-hero-play')?.addEventListener('click', e => { e.preventDefault(); play('story'); });
// Play in the 3D view's buttons: every part of the layer on screen, all six levels
$('layer-play')?.addEventListener('click', () => play(`all-${store.ui.mode}`));
// Play 1 to N above the numbered list: every part of this level in this layer, in number order
$('play-these')?.addEventListener('click', () => {
  here.scene = store.ui.scene; here.mode = store.ui.mode;
  if (inStory() && tour === 'here') exit();
  play('here');
});
