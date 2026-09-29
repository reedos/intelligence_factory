// The clock on the page. A strip docked under the 3D view plays one simulation at a time (the flows react:
// they speed up with the load, the grid goes dark in an outage, the generator feed lights up), and a section
// below the ledger draws all four as charts. Everything is resampled when the scenario changes.
import { SIMS, totals } from '../model/clock.ts';
import { store, on } from './store.js';
import { setLevels, onTick, show, reduced, stageActive } from './stage.js';
import { calc } from './sections.js';
import { BASIS } from '../data.js';
import { chip } from '../evidence.js';

import { opts, simFor, clockTxt, warp, chart, inv, WHERE, mwTxt, mwhTxt, big, n0 } from './clock-charts.js';
const $ = id => document.getElementById(id);
const viewer = $('viewer');
const strip = document.createElement('div');
strip.className = 'clock'; strip.id = 'clock'; strip.hidden = true;
strip.innerHTML = `
  <div class="ck-row">
    <div class="ck-tabs" role="tablist" aria-label="Simulation">${SIMS.map(s => `<button type="button" role="tab" data-sim="${s.id}" aria-selected="false">${s.label}</button>`).join('')}</div>
    <button type="button" class="ck-play" id="ck-play" aria-label="Pause">❚❚</button>
    <span class="ck-time" id="ck-time"></span>
    <span class="ck-phase" id="ck-phase"></span>
    <button type="button" class="ck-x" id="ck-x" aria-label="Close the clock">×</button>
  </div>
  <div class="ck-body">
    <svg class="ck-spark" id="ck-spark" viewBox="0 0 1000 70" preserveAspectRatio="none" aria-hidden="true"></svg>
    <dl class="ck-counters" id="ck-counters"></dl>
  </div>`;
viewer.appendChild(strip);

let sim = null, t = 0, playing = true, spark = null, stopTick = null, carbon = () => calc.carbon;
function load(id, { restart = true } = {}) {
  const keep = t;
  sim = simFor(id);
  t = restart ? 0 : Math.min(keep, sim.duration);
  strip.querySelectorAll('[data-sim]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.sim === id)));
  const c = chart(sim, { W: 1000, H: 70, pad: [6, 6, 6, 6], n: 300, compact: true });
  spark = c;
  $('ck-spark').innerHTML = c.svg + `<line id="ck-cursor" x1="0" x2="0" y1="0" y2="70" stroke="#f0f0fa" stroke-width="1.5"/>`;
  document.body.dataset.sim = id;
  draw();
}
function draw() {
  const s = sim.sample(t), tot = totals(sim, t, 120);
  $('ck-time').textContent = clockTxt(sim, t);
  $('ck-phase').textContent = s.phase;
  const cur = $('ck-cursor'); if (cur) { const xx = spark.x(t); cur.setAttribute('x1', xx); cur.setAttribute('x2', xx); }
  // Off-grid, the utility meter reads zero while the site keeps drawing power from batteries and
  // generators instead, so "energy so far" needs to say which of those two very different things it means.
  const rows = sim.id === 'outage' ? [
    ['Site draw', mwTxt(s.siteMW)],
    ['Site energy so far', tot.siteMwh >= 10 ? `${n0(tot.siteMwh)} MWh` : `${tot.siteMwh.toFixed(2)} MWh`],
    ['Utility energy so far', tot.mwh >= 10 ? `${n0(tot.mwh)} MWh` : `${tot.mwh.toFixed(2)} MWh`],
    ['Water so far', `${tot.water >= 10 ? n0(tot.water) : tot.water.toFixed(1)} m³`],
    store.M.backup === 'battery'
      ? ['From the site batteries', mwhTxt(fromSource(t, 'battery'))]
      : ['Diesel burned', `${n0(fromSource(t, 'gens') * 260)} L`],
  ] : [
    ['At the meter', mwTxt(s.meterMW)],
    ['Energy so far', tot.mwh >= 10 ? `${n0(tot.mwh)} MWh` : `${tot.mwh.toFixed(2)} MWh`],
    ['Water so far', `${tot.water >= 10 ? n0(tot.water) : tot.water.toFixed(1)} m³`],
    sim.id === 'inference' ? ['Tokens so far', big(tot.tokens)] : ['CO₂ so far', `${(tot.mwh * carbon() / 1000).toFixed(tot.mwh * carbon() / 1000 >= 10 ? 0 : 2)} t`],
  ];
  $('ck-counters').innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  setLevels(s.levels);
}
// energy one source has delivered so far, MWh; diesel is the generators' share × 260 L/MWh (a 2.5 MW unit at full
// load burns ≈0.26 L/kWh). Same event-boundary integration as totals(): generator output really does drop to zero
// the instant the campus transfers back to the grid, and a bin straddling that instant would otherwise blend it
// into a smooth taper.
function fromSource(tt, key) {
  let mwh = 0; const n = 200;
  const bp = [...new Set([0, tt, ...sim.events.map(e => e.t).filter(et => et > 0 && et < tt)])].sort((a, b) => a - b);
  for (let seg = 0; seg < bp.length - 1; seg++) {
    const a0 = bp[seg], b0 = bp[seg + 1], segN = Math.max(1, Math.round(n * (b0 - a0) / tt));
    for (let i = 0; i < segN; i++) {
      const a = a0 + (b0 - a0) * i / segN, b = a0 + (b0 - a0) * (i + 1) / segN;
      mwh += (sim.sample((a + b) / 2).values[key] || 0) * (b - a) / 3600;
    }
  }
  return mwh;
}
function tick(dt) {
  if (!sim || strip.hidden) return;
  if (playing) {
    t += dt * sim.speed(t) * (reduced ? 0.5 : 1);
    if (t >= sim.duration) t = 0;
  }
  draw();
}
// tour audit finding 17: the clock always runs at its own speed() (below, in tick()), never at the tour's
// playback pace, so story.js polls this to hold a sim beat until the simulation itself has reached the moment
// the beat is there to show, instead of a fixed dwell that a fast tour would blow through
export const clockNow = () => ({ id: sim?.id ?? null, t, events: sim?.events || [] });
export function openClock(id = sim?.id || 'training') {
  if (!strip.hidden && sim?.id === id) return;           // already running this one; leave its clock where it is
  strip.hidden = false; document.body.classList.add('clocking');
  $('clock-btn')?.setAttribute('aria-pressed', 'true');
  load(id);
  playing = true; $('ck-play').textContent = '❚❚'; $('ck-play').setAttribute('aria-label', 'Pause');
  stopTick ||= onTick(tick);
}
export function closeClock() {
  strip.hidden = true; document.body.classList.remove('clocking'); delete document.body.dataset.sim;
  $('clock-btn')?.setAttribute('aria-pressed', 'false');
  setLevels(null);
}
strip.querySelectorAll('[data-sim]').forEach(b => b.addEventListener('click', () => { load(b.dataset.sim); playing = true; $('ck-play').textContent = '❚❚'; }));
$('ck-play').addEventListener('click', () => { playing = !playing; $('ck-play').textContent = playing ? '❚❚' : '▶'; $('ck-play').setAttribute('aria-label', playing ? 'Pause' : 'Play'); });
$('ck-x').addEventListener('click', closeClock);
// drag on the sparkline to scrub
$('ck-spark').addEventListener('pointerdown', e => {
  const svg = e.currentTarget, move = ev => {
    const r = svg.getBoundingClientRect(), u = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
    t = sim.id === 'outage' ? inv(sim, u) : u * sim.duration; draw();
  };
  playing = false; $('ck-play').textContent = '▶'; move(e);
  svg.setPointerCapture(e.pointerId);
  svg.addEventListener('pointermove', move);
  svg.addEventListener('pointerup', () => svg.removeEventListener('pointermove', move), { once: true });
});
$('clock-btn')?.addEventListener('click', () => (strip.hidden ? openClock() : closeClock()));
addEventListener('keydown', e => {
  if (e.target.matches?.('input, textarea, select') || e.target.closest?.('.pace-menu')) return;
  if (!stageActive()) return;                              // scoped to the stage: see stage.js's stageActive
  if (e.key === 'c' || e.key === 'C') strip.hidden ? openClock() : closeClock();
  else if (e.key === ' ' && !strip.hidden && document.activeElement === document.body) { e.preventDefault(); $('ck-play').click(); }
});

on('scenario', () => { if (!strip.hidden) load(sim.id, { restart: false }); });
on('tokens', () => { if (!strip.hidden && sim.id === 'inference') load('inference', { restart: false }); });
// a link from the story page's "Play in 3D": ?clock=<sim>, with its settings, opens that clock at its place in 3D
{
  const q = new URLSearchParams(location.search), id = q.get('clock');
  if (id && SIMS.some(x => x.id === id)) {
    if (q.has('pt')) opts.peakTrough = +q.get('pt');
    if (q.has('hot')) opts.hotMax = +q.get('hot');
    const wait = setInterval(() => { if (store.ui.scene >= 0) { clearInterval(wait); openClock(id); if (!q.has('view')) show(WHERE[id], { scroll: false }); } }, 100);
  }
}
