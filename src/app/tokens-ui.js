// A 2D console for the tokens part of the GPU package scene (level 6): the same generation cycle chip.js
// streams in 3D, in real time, as text — the prompt, a dim collapsible reasoning trace, the answer with token
// boundaries shaded, and live counters. Mounted into the part card when the reader picks 'tokens' by hand, or
// into the tour's active beat when a tour is on and that beat links to it; removed as soon as something else
// is selected. Both this and chip.js sample the same shared clock (token-script.js's tick()), so the words match.
import { store, on } from './store.js';
import { STREAM_TPS, REPLY_TOKENS, buildCycle, sampleAt, tick } from '../model/token-script.js';

const $ = id => document.getElementById(id);
const n0 = v => Math.round(v).toLocaleString('en-US');
const big = v => v >= 1e9 ? `${+(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `${+(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${+(v / 1e3).toFixed(1)}k` : n0(v);
const jFmt = v => v < 1 ? v.toFixed(3) : v.toFixed(2);
const PHASE_LABEL = { prefill: 'Reading the prompt', reasoning: 'Thinking', answer: 'Writing the answer', pause: 'Idle between replies' };

function spansFor(tokens) {
  return tokens.map((tok, i) => {
    const s = document.createElement('span');
    s.className = `tok ${i % 2 ? 'tok-odd' : 'tok-even'}`;
    s.textContent = tok;
    return s;
  });
}
function reveal(list, count, prevCount) {
  if (count === prevCount) return;
  const lo = Math.max(0, Math.min(count, prevCount)), hi = Math.min(list.length, Math.max(count, prevCount));
  for (let i = lo; i < hi; i++) list[i].classList.toggle('out', i < count);
}

// ---------- the console element (built once, reused across mounts) ----------
function build() {
  const el = document.createElement('div');
  el.className = 'tok-console'; el.id = 'tok-console';
  el.innerHTML =
    `<div class="tok-head"><span class="eyebrow">Live generation</span><span class="tok-phase" id="tok-phase"></span></div>`
    + `<span class="tok-ctxbar" aria-hidden="true"><i></i></span>`
    + `<div class="tok-lane"><span class="tok-lbl">Prompt</span><span class="tok-line" id="tok-prompt-line"></span></div>`
    + `<details class="tok-reasoning" id="tok-reasoning" open><summary>Reasoning, the thinking tokens <span class="tok-count" id="tok-r-count"></span></summary>`
    + `<span class="tok-line tok-dim" id="tok-reasoning-line"></span></details>`
    + `<div class="tok-lane"><span class="tok-lbl">Answer</span><span class="tok-line tok-big" id="tok-answer-line"></span></div>`
    + `<dl class="tok-counters">`
    + `<div><dt>This stream</dt><dd id="tok-stream-tps">—</dd></div>`
    + `<div><dt>Tokens so far</dt><dd id="tok-count">0</dd></div>`
    + `<div><dt>Context</dt><dd id="tok-ctx">0</dd></div>`
    + `<div><dt>Joules so far</dt><dd id="tok-joules">0.00 J</dd></div>`
    + `<div><dt>Campus, all streams</dt><dd id="tok-campus">—</dd></div>`
    + `</dl>`
    + `<p class="tok-note">Illustrative pacing: ${STREAM_TPS} tokens a second for this stream, the rate the request tour uses. `
    + `A full ${n0(REPLY_TOKENS)}-token reply like this one would use about <span id="tok-reply-wh"></span> here.</p>`;
  return el;
}

let el = null, host = null, raf = null, lastE = -1;
let cycle = null, cycleLen = 0;
let spans = { prompt: [], reasoning: [], answer: [] };
let shown = { prompt: -1, reasoning: -1, answer: -1 };

function rebuildCycle() {
  cycle = buildCycle(store.M);
  cycleLen = cycle.timings.totalS;
  spans.prompt = spansFor(cycle.prompt); spans.reasoning = spansFor(cycle.reasoning); spans.answer = spansFor(cycle.answer);
  shown = { prompt: -1, reasoning: -1, answer: -1 };
  if (!el) return;
  el.querySelector('#tok-prompt-line').replaceChildren(...spans.prompt);
  el.querySelector('#tok-reasoning-line').replaceChildren(...spans.reasoning);
  el.querySelector('#tok-answer-line').replaceChildren(...spans.answer);
  el.querySelector('#tok-r-count').textContent = `0 / ${cycle.reasoning.length}`;
  const wh = el.querySelector('#tok-reply-wh'); if (wh) wh.textContent = `${jFmt(cycle.whReplyRef)} Wh`;
}

function paint(s) {
  $('tok-phase').textContent = PHASE_LABEL[s.phase];
  const bar = el.querySelector('.tok-ctxbar i'); if (bar) bar.style.transform = `scaleX(${s.contextFrac})`;
  reveal(spans.prompt, s.promptOut, shown.prompt); shown.prompt = s.promptOut;
  reveal(spans.reasoning, s.reasoningOut, shown.reasoning); shown.reasoning = s.reasoningOut;
  reveal(spans.answer, s.answerOut, shown.answer); shown.answer = s.answerOut;
  $('tok-r-count').textContent = `${s.reasoningOut} / ${cycle.reasoning.length}`;
  $('tok-stream-tps').textContent = s.streamTps ? `${s.streamTps} tok/s` : '—';
  $('tok-count').textContent = n0(s.tokensGenerated);
  $('tok-ctx').textContent = `${n0(s.contextTokens)} / ${n0(cycle.contextMax)}`;
  $('tok-joules').textContent = `${jFmt(s.jSoFar)} J`;
  $('tok-campus').textContent = `${big(s.campusTps)} tok/s`;
}

// ---------- mount target: the part card, or the active tour beat, whichever is showing 'tokens' ----------
function wantedHost() {
  if (store.ui.selected !== 'tokens') return null;
  if (document.body.classList.contains('story')) return document.querySelector('.beat.on') || null;
  return $('card') || null;
}
function mount(target) {
  if (!el) el = build();
  host = target;                                   // moving `el` in the DOM keeps its children, so nothing to redo there
  const cardB = target.id === 'card' ? $('card-b') : null, bar = target.querySelector?.('.beat-bar');
  if (cardB) cardB.insertAdjacentElement('afterend', el);
  else if (bar) target.insertBefore(el, bar);
  else target.appendChild(el);
  if (!cycle) rebuildCycle();
}
function unmount() { el?.remove(); host = null; }

function step() {
  const want = wantedHost();
  if (!want) { if (host) unmount(); raf = null; return; }
  if (want !== host) mount(want);
  if (!cycle) rebuildCycle();
  const e = tick(cycleLen);
  if (e < lastE) rebuildCycle();   // the cycle wrapped: rebuild with fresh numbers, in case the reader moved a slider
  lastE = e;
  paint(sampleAt(cycle, e));
  raf = requestAnimationFrame(step);
}

on('select', ({ id }) => { if (id === 'tokens' && !raf) step(); else if (id !== 'tokens' && host) unmount(); });
on('scenario', () => { cycle = null; });
on('tokens', () => { cycle = null; });
