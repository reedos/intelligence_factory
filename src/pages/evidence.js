// The Evidence page: every figure the site shows beside a basis chip, one claim at a time, with what backs it: the
// sources and where in each the figure is, the calculation, or the assumption. Built from the same claim list the
// visualizer's popovers read (src/claims.js), so the two cannot disagree. It shows one fixed reference scenario.
// The claims list, the bibliography and this scenario note are also baked into evidence.html at build time
// (tools/prerender-plugin.mjs, via src/pages/evidence-render.js) so a crawler that never runs this script still
// sees the same text; this script's job at runtime is the search box and the basis/layer filters on top of it.
import { compute, DEFAULT_SCENARIO } from '../model/engine.ts';
import { content } from '../data.js';
import { SOURCES } from '../sources.js';
import { allClaims } from '../claims.js';
import { scenarioNote, shownBasesOf, renderStats, renderBasesFilter, renderClaims, renderSources } from './evidence-render.js';
import '../app/site.js';

const $ = id => document.getElementById(id);
const M = compute(DEFAULT_SCENARIO), C = content(M);
const claims = allClaims(M, C);
const shownBases = shownBasesOf(claims);

// This page always computes from one fixed reference scenario, not from whatever campus the reader last set
// on the visualizer (that scenario lives in the main page's URL, which this page does not read); say so plainly.
$('ev-scenario').textContent = scenarioNote(M);
$('ev-stats').innerHTML = renderStats(claims, shownBases, Object.keys(SOURCES).length);
$('ev-bases').innerHTML = renderBasesFilter(shownBases);

{ const q0 = new URLSearchParams(location.search).get('q'); if (q0) $('ev-q').value = q0; }
function render() {
  const q = $('ev-q').value.trim().toLowerCase();
  const bases = new Set([...document.querySelectorAll('[data-basis][aria-pressed="true"]')].map(b => b.dataset.basis));
  const layers = new Set([...document.querySelectorAll('[data-layer][aria-pressed="true"]')].map(b => b.dataset.layer));
  // a search or a filter in use: the page's head steps aside so the matching claims sit right under the tools
  document.body.classList.toggle('ev-searching', !!q || !!document.querySelector('[data-basis][aria-pressed="false"], [data-layer][aria-pressed="false"]'));
  const text = c => `${c.label} ${c.value} ${c.part?.title || ''} ${c.scene?.title || ''} ${(c.ev?.refs || []).map(([id, at]) => `${SOURCES[id]?.publisher} ${SOURCES[id]?.title} ${at}`).join(' ')}`.toLowerCase();
  const hit = c => bases.has(c.basis) && (!c.mode || layers.has(c.mode)) && (!q || text(c).includes(q));
  const shown = claims.filter(hit);
  $('ev-claims').innerHTML = renderClaims(C, SOURCES, shown, M);
  $('ev-count').textContent = `${shown.length.toLocaleString('en-US')} of ${claims.length.toLocaleString('en-US')} claims`;
}
$('ev-q').addEventListener('input', render);
document.querySelectorAll('.ev-filter').forEach(g => g.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); render(); }));
render();

$('ev-src').innerHTML = renderSources(claims, SOURCES);
