// Story mode: the panel beside the 3D view becomes a column of beats, grid to token. Scrolling a beat to the middle
// of the column drives the stage to it. On narrow screens the tour takes the whole screen instead, one beat at a
// time under the view, so the view gets every pixel the text does not need.
// Every number comes from the current scenario, so the story retells itself when a setting changes.
// Play steps through on its own: each beat holds long enough to read once the camera has arrived, then the next
// one comes in. The overview stops at its own last step and offers the watt, the request and the heat as three
// separate choices, rather than picking one and playing on into it; the every-part tours do hand over, since
// they are meant to run through as one long walk. Looking around (a drag, wheel or touch) only holds the tour:
// it carries on a few seconds after the reader lets go, from whichever beat is showing.
// Pause (the button, or Space) is the only thing that stops it. One transport at the head of the panel (play,
// back, forward, speed, where the tour is) is the only playback control on the page.
import { store, on } from './store.js';
import { show, go, reduced, onTick, setCinema, setTourPace, getTransitions, setTransitions, pinNumber, partCount, stageActive, isBusy } from './stage.js';
import { story, watt, request, heat, layer, everything, CHAIN, OUTWARD } from './journeys.js';
import { openClock, closeClock, clockNow } from './clock-ui.js';
import { chip } from '../evidence.js';
import { FIGURE_CLAIMS, opticsCutawaySVG } from '../diagrams/links-media.js';
// the lead's narrated-tour work adds TOUR_NOTES to journeys.js; import it defensively (namespace import, with a
// fallback) so this branch keeps working before that lands and after it does, without editing journeys.js above
// the "every part" block this file owns
import * as J from './journeys.js';
const TOUR_NOTES = J.TOUR_NOTES || {};

const $ = id => document.getElementById(id);
// the id 'story' stays for old links (#story); readers see it as the overview
// 'here' is every numbered part of the level and layer on screen when it starts, 1 to N
const here = { scene: 0, mode: 'power' };
// tour audit finding 9: the level/layer the reader was looking at the moment the tour UI opened. Captured once,
// in enter() below, before anything (a resumed or restarted tour) can move the camera; This level uses this,
// not a live read of store.ui.scene, for the rest of that tour session - including if the reader picks "This
// level" from a tab partway through some other tour, where store.ui.scene would by then be wherever that other
// tour's own beats have scrolled the camera to. That is the deliberate reading of "this": the level the reader
// entered the tours from, not whatever is on screen at the instant they click the tab.
let entry = { scene: 0, mode: 'power' };
const MODE_NAME = { power: 'power', data: 'data', heat: 'heat' };
const LAYER_NAME = { power: 'Power', data: 'Data', heat: 'Heat' };
export const TOURS = {
  story: { label: 'Overview: all six levels, once', short: 'Overview', beats: story, group: 'Tours' },
  heat: { label: 'Follow the heat', short: 'The heat', beats: heat, group: 'Tours' },
  watt: { label: 'Follow a watt', short: 'A watt', beats: watt, group: 'Tours' },
  request: { label: 'Follow a request', short: 'A request', beats: request, group: 'Tours' },
  here: { get label() { return `This level: ${store.C.SCENES[here.scene]?.title ?? ''} · ${MODE_NAME[here.mode]}`; }, short: 'This level', beats: M => layer(M, here.mode, here.scene), group: 'Every part' },
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
let heldReal = 0;              // same, but never scaled by pace - what a sim beat's own clock actually experiences (finding 17)
let popoverOpen = false;       // a chip's source popover (sources-ui.js) is open - see the MutationObserver near the bottom (finding 4)
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
// the overview's own next tour, for auto-play (onTick) and for stepping past its last beat (beyond, below): both
// have to agree that there isn't one, since it offers three siblings instead - never pick one of them for the reader
const chainNext = id => id === 'story' ? null : nextTour(id);
// tour audit finding 16: This level's own next/previous follows the layer's real flow direction, not always the
// numerically higher level - heat runs outward, package to plant (6 to 1), like the full Heat tour; power and
// data stay inward (1 to 6), the way they already read.
const hereDir = () => OUTWARD.has(here.mode) ? -1 : 1;
const validLevel = n => n >= 0 && n < store.C.SCENES.length;
// past the last step: the next level of a level playthrough, or the next tour in its group
const beyond = () => tour === 'here' ? (validLevel(here.scene + hereDir()) ? { level: here.scene + hereDir() } : null) : (chainNext(tour) ? { tour: chainNext(tour) } : null);
const before = () => tour === 'here' ? (validLevel(here.scene - hereDir()) ? { level: here.scene - hereDir() } : null) : (prevTour(tour) ? { tour: prevTour(tour) } : null);
function crossTo(t, at) {
  if (!t) return false;
  if (t.level !== undefined) { here.scene = t.level; switchTour('here', at); } else switchTour(t.tour, at);
  return true;
}
const fmtMs = ms => ms < 60000 ? `${Math.round(ms / 1000)} s` : `${Math.round(ms / 60000)} min`;
// tour audit findings 4 and 14: a card's first three specification rows show in the beat itself, so dwell has to
// count their words too - a long card's read time can run past the old flat 16 s cap, up to a sane ceiling.
const specWords = b => (b.specs || []).slice(0, 3).reduce((n, [k, v]) => n + `${k} ${v}`.split(/\s+/).length, 0);
// ≈260 words a minute; a beat running a clock holds at least 16 s so a sim's clock is running by the time the
// reader can act on what it shows (finding 17 makes the clock's own key event, not this dwell alone, the real
// gate for a sim beat - see SIM_HOLD_MAX_MS and simKeyReached below)
const dwell = b => {
  const words = `${b.title} ${b.text}`.split(/\s+/).length + specWords(b);
  const read = Math.max(6000, 3000 + words * 230);
  const cap = Math.max(16000, Math.min(30000, read));     // long cards may run past 16 s, up to a sane 30 s ceiling
  return Math.max(b.sim ? 16000 : 0, Math.min(cap, read));
};
const narrow = matchMedia('(max-width: 1100px)');

// A step on a part that holds another level (the campus on the map, the halls, a rack, a tray, the GPU) gets a button
// named for where it goes. The last step of every tour offers the next move: the next level of a level playthrough,
// the next tour, or exploring from here. Nothing ends in a sentence that says "go in" with nowhere to click.
// the pin a step shows, numbered as the view numbers it; the level's overview is no part and has none
const pinOf = b => (b?.link?.part ? pinNumber(b.link.scene, b.link.part, b.link.mode) : null);
const perLevel = () => TOURS[tour].group === 'Every part';
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
  if (tour === 'here') {
    const nx = here.scene + hereDir();
    if (validLevel(nx)) {
      // finding 16: heat's This level runs outward (the package's next level is the tray, toward the cooling
      // plant), so the suggestion has to say "continue to", not "play level N" which reads as going deeper in
      const label = OUTWARD.has(here.mode) ? `Continue to ${S[nx].title.toLowerCase()} ${here.mode} →` : `Play level ${nx + 1}: ${S[nx].title} →`;
      acts.push(`<button type="button" class="btn go" data-next-level="${nx}">${label}</button>`);
    }
  }
  const go1 = () => acts.some(a => a.includes('btn go')) ? '' : ' go';   // only the first suggestion is accented
  if (tour === 'story') {
    // the overview's own three follow-ups are siblings, not a sequence: offer all three, not just the first
    CHAIN.Tours.slice(1).forEach(id => acts.push(`<button type="button" class="btn${go1()}" data-next-tour="${id}">${TOURS[id].label} →</button>`));
  } else {
    const nt = nextTour(tour);
    if (nt) acts.push(`<button type="button" class="btn${go1()}" data-next-tour="${nt}">Next: ${TOURS[nt].label} →</button>`);
  }
  acts.push('<button type="button" class="btn" data-explore>Explore on your own</button>');
  return acts.join('');
}
// a tour's length for the picker: steps, and about how long they take to read through at 1x (dwell, unsped)
function tourLen(id) {
  const beats = TOURS[id].beats(store.M), ms = beats.reduce((a, b) => a + dwell(b), 0);
  const own = `${beats.length} step${beats.length === 1 ? '' : 's'} · ≈${fmtMs(ms)}`;
  if (TOURS[id].group !== 'Every part') return own;
  // finding 10: Power hands over into Heat then Data, and Heat into Data, once played through - the tab has to
  // disclose that full scope and its full time before the reader presses play, not just its own slice of it
  const chain = CHAIN['Every part'], k = chain.indexOf(id), after = chain.slice(k + 1);
  if (!after.length) return own;
  const allMs = chain.slice(k).reduce((a, tid) => a + TOURS[tid].beats(store.M).reduce((a2, b) => a2 + dwell(b), 0), 0);
  const names = after.length > 1 ? `${after.slice(0, -1).map(t => TOURS[t].short).join(', ')} and ${TOURS[after.at(-1)].short}` : TOURS[after[0]].short;
  return `${own}, then ${names} (≈${fmtMs(allMs)} in all)`;
}
// finding 14: level/layer chapters a reader can jump straight to, each a [beat index, label] pair for one of
// that tour's level-overview beats (the only beats with .level set)
const chapters = () => list.map((b, i) => (b.level ? [i, `${LAYER_NAME[b.link.mode]} · Level ${b.link.scene + 1}: ${b.title}`] : null)).filter(Boolean);
const chapterOf = i => { for (let k = i; k >= 0; k--) if (list[k]?.level) return k; return 0; };
// finding 4: the preview rows (first three) plus a working disclosure for the rest, each row with its own chip;
// finding 4 also puts the optics-cutaway figure, where the beat carries one, behind its own disclosure
function specsHTML(b) {
  if (!b.specs?.length) return '';
  const row = (r, j) => `<div><dt>${r[0]}</dt><dd>${r[1]}</dd>${b.specKey ? chip(r[2], `${b.specKey}:${j}`, r[0]) : ''}</div>`;
  const rest = b.specs.slice(3);
  const more = rest.length ? `<details class="beat-more"><summary>All ${b.specs.length} specifications and sources</summary><dl class="beat-specs">${rest.map((r, j) => row(r, j + 3)).join('')}</dl></details>` : '';
  return `<dl class="beat-specs">${b.specs.slice(0, 3).map((r, j) => row(r, j)).join('')}</dl>${more}`;
}
function figureHTML(b) {
  if (b.figure !== 'optics-cutaway') return '';
  const chips = ['cutaway-dsp', 'cutaway-lpo', 'cutaway-cpo'].map(k => `<span class="chip-k">${FIGURE_CLAIMS[k].short}</span>${chip(FIGURE_CLAIMS[k].basis, `links:${k}`, FIGURE_CLAIMS[k].label)}`).join(' ');
  return `<details class="beat-more"><summary>Inside the optics: DSP, LPO and CPO cutaway</summary><div class="beat-figure">${opticsCutawaySVG()}</div><p class="beat-fig-cap">${chips}</p></details>`;
}
function render() {
  list = TOURS[tour].beats(store.M);
  const tabRow = g => `<div class="tour-tabs" role="tablist" aria-label="${g}">${Object.entries(TOURS).filter(([, t]) => t.group === g).map(([id, t]) => `<button type="button" role="tab" data-tour="${id}" aria-selected="${id === tour}">${t.short}<small>${tourLen(id)}</small></button>`).join('')}</div>`;
  // "Every part" is the exhaustive, card-by-card option: a disclosure keeps it from competing with the four
  // narrated tours, open by default only while one of its own tours is the one showing
  const everyPart = `<details class="tour-more"${TOURS[tour].group === 'Every part' ? ' open' : ''}><summary>Every part, in order</summary>${tabRow('Every part')}</details>`;
  const ch = chapters();
  const chapterPicker = ch.length > 1 ? `<select id="tour-chapters" class="chapters" aria-label="Jump to a chapter">${ch.map(([i, label]) => `<option value="${i}"${i === chapterOf(Math.max(active, 0)) ? ' selected' : ''}>${label}</option>`).join('')}</select>` : '';
  box.innerHTML = `<div class="story-head">`
    + `<div class="transport" role="group" aria-label="Tour playback">`
    + `<button type="button" class="btn play" id="tour-play" aria-pressed="${playing}" aria-label="${playing ? 'Pause' : 'Play'}">${playing ? '❚❚' : '▶'}</button>`
    + `<button type="button" class="btn icon" id="tour-prev" aria-label="Previous step">‹</button>`
    + `<button type="button" class="btn icon" id="tour-next" aria-label="Next step">›</button>`
    + `<button type="button" class="btn pace" id="tour-pace" aria-haspopup="menu" aria-expanded="false"></button>`
    + `<span class="tour-t" id="tour-t" aria-live="polite"></span>`
    + `<button type="button" class="btn icon" id="story-exit" aria-label="Leave the tour">×</button></div>`
    + `<div class="tour-pick"><div class="tour-group"><span class="tour-g">Tours</span>${tabRow('Tours')}</div>${everyPart}</div>`
    + `<div class="tally" id="tally" aria-live="polite"${list.some(b => b.tally) && !perLevel() ? '' : ' hidden'}><span class="eyebrow">${TOURS[tour].label}</span><b id="tally-v"></b></div>`
    + `${TOUR_NOTES[tour] ? `<p class="tour-note">${TOUR_NOTES[tour]}</p>` : ''}`
    + `${chapterPicker}</div>`
    + list.map((b, i) => {
      // the last step of a level playthrough already offers the next level; a second button to the same place is noise
      const last = i === list.length - 1, into = partOf(b.link)?.drill, dup = last && tour === 'here' && into === here.scene + hereDir();
      const acts = (dup ? '' : goButton(b)) + (last ? nextSteps() : '');
      const n = pinOf(b);
      return `<article class="beat${b.level ? ' level' : ''}" data-i="${i}"><span class="k">${n ? `<span class="bpin" role="img" aria-label="Pin ${n}" title="Pin ${n} in the view">${n}</span>` : ''}${b.k}</span><h3>${b.title}</h3><p>${b.text}</p>${specsHTML(b)}${figureHTML(b)}${acts ? `<div class="beat-acts">${acts}</div>` : ''}<span class="beat-bar" aria-hidden="true"><i></i></span></article>`; }).join('');
  $('story-exit').addEventListener('click', exit);
  $('tour-play').addEventListener('click', () => setPlaying(!playing));
  $('tour-prev').addEventListener('click', () => step(-1));
  $('tour-next').addEventListener('click', () => step(1));
  $('tour-pace').addEventListener('click', e => togglePaceMenu(e.currentTarget));
  $('tour-chapters')?.addEventListener('change', e => {
    const i = +e.target.value;
    activate(i);
    if (narrow.matches) box.querySelector('.beat.on')?.scrollTo?.(0, 0); else centerInPanel(box.querySelector(`.beat[data-i="${i}"]`));
  });
  paceLabel();
  box.querySelectorAll('[data-tour]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.tour === tour) return;
    if (b.dataset.tour === 'here') { here.scene = entry.scene; here.mode = entry.mode; }   // finding 9: the level the reader entered the tours from
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
  // finding 15: the selected tab, whenever the picker renders (a tour switch, or the scenario/tokens changes
  // that also call render()). Not also on the "Every part" <details> toggle event: a <details open> element
  // inserted via innerHTML can fire that event on its own during parsing, and centering twice in one render -
  // the second measurement mid-animation from the first - was overshooting the scroll (found while testing).
  centerInPicker(box.querySelector('.tour-tabs [aria-selected="true"]'));
  observe();
  if (active >= 0) mark(active);
  else ctlLabel();
}
function mark(i) {
  box.querySelectorAll('.beat').forEach(b => b.classList.toggle('on', +b.dataset.i === i));
  ctlLabel();
  const v = $('tally-v'); if (v) v.textContent = list[i]?.tally ?? '';
  const sel = $('tour-chapters'); if (sel) sel.value = String(chapterOf(i));
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
  active = i; mark(i); arrived = false; held = 0; heldReal = 0; bar(0);
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
// finding 15: on a phone the picker itself scrolls sideways (styles.css); keep the active tab reachable without
// an exploratory swipe by scrolling that row alone into view - never scrollIntoView, which would also walk the
// page's own scroll container and could move the stage
function centerInPicker(el) {
  if (!el || !narrow.matches) return;
  const row = el.closest('.tour-pick'); if (!row) return;
  const r = el.getBoundingClientRect(), rr = row.getBoundingClientRect(), dx = r.left - rr.left - (rr.width - r.width) / 2;
  if (Math.abs(dx) > 1) row.scrollBy({ left: dx, behavior: reduced ? 'auto' : 'smooth' });
}
function step(d) {
  if (d > 0 && active === list.length - 1) { crossTo(beyond()); return; }
  if (d < 0 && active === 0) { crossTo(before(), 'last'); return; }
  const i = Math.max(0, Math.min(list.length - 1, (active < 0 ? -1 : active) + d));
  activate(i);                                            // at once, so quick presses count from the beat they see
  if (narrow.matches) { box.querySelector('.beat.on')?.scrollTo?.(0, 0); return; }
  centerInPanel(box.querySelector(`.beat[data-i="${i}"]`));
}

// finding 9: wait for any level switch already in flight to land before reading store.ui.scene - stage.js's go()
// only assigns ui.scene partway through its async dive (after the iris has closed on the new level, mid-function,
// well before the promise it returns resolves), so a read made while isBusy() is true would name the level being
// LEFT, not the one the reader just moved to. A capped poll, not a raw await on go()'s own promise: nothing here
// started that switch, and go() already recurses through any switch queued after it.
async function awaitSettle(ms = 5000) {
  const t0 = performance.now();
  while (isBusy() && performance.now() - t0 < ms) await new Promise(r => requestAnimationFrame(r));
}
// fromStart: a button that names a tour starts it over; the Tours button picks up where the reader left off
export async function enter(which = tour, { fromStart = false } = {}) {
  if (!box.hidden && which === tour) return;
  if (isBusy()) await awaitSettle();
  entry = { scene: store.ui.scene, mode: store.ui.mode };   // finding 9: the view the reader was on when the tour UI opened, before anything below moves the camera
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
// finding 14: what's left of an every-part walk, in reading time at the current pace (the dwell each remaining
// beat would get, summed) - approximate, since a beat can end early (a part the scenario skips) or hold longer
// (finding 17's sim wait), but enough to say "a while" versus "almost done"
const remainingMs = from => { let ms = 0; for (let k = from; k < list.length; k++) ms += dwell(list[k]); return ms; };
// where the tour is, and whether it is waiting on the reader
let heldShown = false;
function ctlLabel() {
  const t = $('tour-t'); if (!t || active < 0 || !list[active]) return;
  const held = playing && performance.now() < holdUntil;
  heldShown = held;
  const last = active === list.length - 1, nb = beyond(), pb = before();
  // a level playthrough counts parts as the pins do, and says so; a story counts steps, and says that.
  // Every-part tours also name the layer and, past a single level, the global stop out of every beat in the
  // walk plus about how much reading is left (finding 14: "Data · Level 3 · Part 9 of 11 · Stop 112 of 135")
  const b = list[active], n = pinOf(b), lv = b.link.scene + 1, layerName = LAYER_NAME[b.link.mode];
  const part = n ? `Part ${n} of ${partCount(b.link.scene, b.link.mode)}` : 'overview';
  const where = !perLevel() ? `Step ${active + 1} of ${list.length}`
    : tour === 'here' ? `${layerName} · ${part}`
    : `${layerName} · Level ${lv} · ${part} · Stop ${active + 1} of ${list.length} · ≈${fmtMs(remainingMs(active))} left`;
  // finding 16: This level's own next/previous names the direction, since heat's runs outward while power and
  // data stay inward - "Next level: Compute tray (heat, outward)"
  const dirNote = tour === 'here' ? ` (${MODE_NAME[here.mode]}, ${OUTWARD.has(here.mode) ? 'outward' : 'inward'})` : '';
  t.textContent = held ? 'Carries on when you let go'
    : `${where}${last && !playing && nb ? ` · › ${nb.level !== undefined ? `level ${nb.level + 1}` : TOURS[nb.tour].short}` : playing ? '' : ' · paused'}`;
  $('tour-prev').disabled = active === 0 && !pb; $('tour-next').disabled = last && !nb;
  $('tour-next').setAttribute('aria-label', last && nb ? (nb.level !== undefined ? `Next level: ${store.C.SCENES[nb.level].title}${dirNote}` : `Next tour: ${TOURS[nb.tour].label}`) : 'Next step');
  $('tour-prev').setAttribute('aria-label', active === 0 && pb ? (pb.level !== undefined ? `Previous level: ${store.C.SCENES[pb.level].title}${dirNote}` : `Previous tour: ${TOURS[pb.tour].label}`) : 'Previous step');
  playIcon();
}
function hold() { if (playing) { holdUntil = performance.now() + HOLD_MS; if (!heldShown) ctlLabel(); } }
export function play(which = 'story') { if (!inStory() || which !== tour) enter(which, { fromStart: true }); setPlaying(true); }
// finding 17: what "the clock has reached this sim's key event" means, one entry per sim id, read from the
// sim's own `events` (clock-ui.js/model/clock.ts) rather than hand-picked times, so a change to the model's
// timing keeps this in step. The battery-backed outage has no "Full load" event (batteries pick up the instant
// the grid drops), so that variant's key moment is the "Grid lost" event itself; the generator variant's is the
// "Full load, 10 s" event. Hot day's non-warm variant names "Hottest hour" directly; the warm variant's events
// are its adiabatic-spray crossings instead, so it falls back to hour 15, the day's peak by the model's own
// fixed diurnal curve (src/model/clock.ts hotday(): T(h) always peaks at h=15, whichever cooling is modeled).
// Inference's steadiest high-throughput stretch is its afternoon Peak, not the overnight Trough.
const KEY_EVENT = {
  training: es => es[0]?.t ?? 0,
  outage: es => es.find(e => e.label.startsWith('Full load'))?.t ?? es[0]?.t ?? 0,
  hotday: es => es.find(e => e.label === 'Hottest hour')?.t ?? 15,
  inference: es => es.find(e => e.label === 'Peak')?.t ?? es.at(-1)?.t ?? 0,
};
// a generous backstop only, never the normal path: if a sim's clock ever stalled this keeps a beat from holding
// the tour forever, at any pace
const SIM_HOLD_MAX_MS = 60000;
function simKeyReached(simId) {
  const c = clockNow();
  if (c.id !== simId) return true;                       // not this beat's clock (or none running): nothing to wait for
  return c.t >= (KEY_EVENT[simId]?.(c.events) ?? 0);
}
onTick(dt => {
  if (!playing || box.hidden || active < 0) return;
  if (popoverOpen) return;                                // finding 4: a chip's source popover is open; never advance underneath it
  if (performance.now() < holdUntil) return;              // the reader is looking around
  if (heldShown) ctlLabel();
  if (!arrived) return;
  held += dt * 1000 * pace * (window.ifx?.tourPace || 1);   // tourPace is for tests
  // heldReal is never scaled by pace: the clock a sim beat opens runs at its own speed() regardless of tour
  // pace (clock-ui.js's tick()), so waiting for its key event has to be measured in the same real time it runs in
  heldReal += dt * 1000;
  const need = dwell(list[active]);
  bar(Math.min(1, held / need));
  if (held < need) return;
  const b = list[active];
  if (b.sim && !simKeyReached(b.sim) && heldReal < SIM_HOLD_MAX_MS) return;
  arrived = false;                                        // wait for the next beat's camera before counting again
  if (active < list.length - 1) step(1);
  else {
    // the overview promises "all six levels, once": it stops here and offers every follow-up tour as its own
    // choice (nextSteps, below) instead of picking one and playing on into it; every-part tours still hand over
    const next = chainNext(tour);
    if (next) switchTour(next);
    else setPlaying(false);                                // the last step offers what comes next
  }
});
// the reader looking around holds the tour; it carries on HOLD_MS after the last touch, drag or wheel
const lookAround = e => { if (!e.target.closest?.('.story-head, .beat-acts, .pace-menu, #story-hero-play, #clock')) hold(); };
for (const el of [panel, $('view')]) for (const ev of ['wheel', 'touchstart', 'touchmove', 'pointerdown', 'pointermove']) el?.addEventListener(ev, e => { if (ev !== 'pointermove' || e.buttons) lookAround(e); }, { passive: true });
addEventListener('wheel', e => { if (narrow.matches) lookAround(e); }, { passive: true });
addEventListener('touchmove', e => { if (narrow.matches) lookAround(e); }, { passive: true });

// finding 4: hold the tour for as long as a chip's source popover (sources-ui.js) is open, and resume the normal
// countdown once it closes. Watching #src-pop's own `hidden` attribute, rather than editing that file, works
// for every chip on the page (a card's, a beat's, the Links section's) and needs nothing from it beyond the
// element it already creates and toggles.
const srcPop = document.getElementById('src-pop');
if (srcPop) new MutationObserver(() => {
  popoverOpen = !srcPop.hidden;
  if (!popoverOpen) hold();
}).observe(srcPop, { attributes: true, attributeFilter: ['hidden'] });

$('story-btn')?.addEventListener('click', () => (inStory() ? exit() : enter()));
document.addEventListener('click', e => {
  if (inStory() && e.target.closest?.('.step, .pin, [data-mode], [data-go]') && !e.target.closest('#story')) exit({ remember: true });   // #story: body.story matches '.story'
}, true);
addEventListener('keydown', e => {
  if (e.target.matches?.('input, textarea, select') || e.target.closest?.('.pace-menu')) return;   // a menu keeps its own keys
  if (!stageActive()) return;                              // scoped to the stage/tour: see stage.js's stageActive
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
$('play-these')?.addEventListener('click', async () => {
  if (isBusy()) await awaitSettle();   // finding 9: never capture the level a pending transition is leaving
  here.scene = store.ui.scene; here.mode = store.ui.mode;
  if (inStory() && tour === 'here') exit();
  play('here');
});
