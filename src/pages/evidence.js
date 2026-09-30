// The Evidence page: every figure the site shows beside a basis chip, one claim at a time, with what backs it: the
// sources and where in each the figure is, the calculation, or the assumption. Built from the same claim list the
// visualizer's popovers read (src/claims.js), so the two cannot disagree. It shows one fixed reference scenario.
import { compute, DEFAULT_SCENARIO } from '../model/engine.ts';
import { content } from '../data.js';
import { BASIS, CALCS, ASSUMPTIONS, CITED } from '../evidence.js';
import { allClaims } from '../claims.js';
import { SOURCES } from '../sources.js';
import '../app/site.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const M = compute(DEFAULT_SCENARIO), C = content(M);
const claims = allClaims(M, C);
const ORDER = ['spec', 'vendor', 'reported', 'derived', 'assumed', 'typical', 'est'];
const shownBases = ORDER.filter(b => claims.some(c => c.basis === b));

// This page always computes from one fixed reference scenario, not from whatever campus the reader last set
// on the visualizer (that scenario lives in the main page's URL, which this page does not read); say so plainly.
$('ev-scenario').textContent = `Figures below are fixed to one reference scenario, not whichever campus you set on the visualizer: ${Math.round(M.meterMW)} MW at the meter, ${M.accel.rackName} racks, 415 V AC to the rack, warm-water cooling. Change the campus on the main page and its own numbers follow; the claims and sources on this page always describe this one scenario.`;
const count = b => claims.filter(c => c.basis === b).length;
const untraced = claims.filter(c => !c.ev).length;
$('ev-stats').innerHTML = [['Claims', claims.length], ...shownBases.map(b => [BASIS[b].short, count(b)]), ...(untraced ? [['Not yet traced', untraced]] : []), ['Sources', Object.keys(SOURCES).length]]
  .map(([k, v]) => `<div><dt>${k}</dt><dd>${v.toLocaleString('en-US')}</dd></div>`).join('');
$('ev-bases').innerHTML = shownBases.map(b => `<button type="button" data-basis="${b}" aria-pressed="true"><i class="k-${b}"></i>${BASIS[b].short}</button>`).join('');

// what backs one claim, inline
const srcLine = (id, at) => { const s = SOURCES[id]; if (!s) return '';
  return `<a href="${esc(s.url)}" target="_blank" rel="noopener" title="${esc(s.title)}">${esc(s.publisher)}</a>${at ? ` <span class="ev-at">${esc(at)}</span>` : ''}`; };
const method = (hash, text) => `<a href="method.html#${hash}">${esc(text)}</a>`;
function backing(c) {
  const ev = c.ev;
  if (ev) {
    const bits = [];
    if (ev.refs?.length) bits.push(`${ev.calc ? 'Inputs' : 'Sources'}: ${ev.refs.map(([id, at]) => srcLine(id, at)).join('<span aria-hidden="true"> · </span>')}`);
    if (ev.vs) bits.push(`Compared with: ${esc(ev.vs)}`);
    if (ev.calc && CALCS[ev.calc]) bits.push(`Calculated: ${esc(CALCS[ev.calc].how)} ${method(`calc-${ev.calc}`, 'Method')}`);
    if (ev.assume && ASSUMPTIONS[ev.assume]) bits.push(`Assumed: ${esc(ASSUMPTIONS[ev.assume].title)}, ${esc(ASSUMPTIONS[ev.assume].value)}. ${method(`assume-${ev.assume}`, 'Why')}`);
    return bits.map(b => `<p class="ev-back">${b}</p>`).join('');
  }
  return '<p class="ev-back ev-todo">Not traced to a source, a calculation or an assumption.</p>';
}
const row = c => `<div class="ev-claim"><dt>${esc(c.label)}</dt><dd>${esc(c.value)}</dd><span class="chip ${c.basis}">${BASIS[c.basis]?.short || c.basis}</span>${backing(c)}</div>`;
const view = (i, mode, id) => `visualizer.html?view=${i}.${mode}.${id}`;
const GROUPS = [['ledger', '2.1', 'The ledger', `where ${Math.round(M.meterMW)} MW goes`], ['bom', '2.2', 'The inventory', 'counts sized from the scenario'],
  ['links', '3.2', 'Links', 'copper and optics'], ['clock', '4', 'The clock', 'notes under the simulations'], ['temps', '4.1', 'Hot to cold', 'one operating point per cooling design'], ['site', '1', 'Real campuses', 'facts behind the presets'],
  ['tour', '▸', 'The tours', 'the figures each narrated stop states']];

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
  let html = '';
  C.SCENES.forEach((sc, i) => {
    const mine = shown.filter(c => c.group === 'card' && c.level === i); if (!mine.length) return;
    html += `<section class="ev-level"><h2 class="ev-lt"><span>${sc.n}</span>${esc(sc.title)}<small>${esc(sc.scale)}</small></h2>`;
    for (const key of new Set(mine.map(c => `${c.mode}:${c.part.id}`))) {
      const rows = mine.filter(c => `${c.mode}:${c.part.id}` === key), c0 = rows[0];
      html += `<article class="ev-part" style="--c: var(${c0.mode === 'power' ? '--mv' : c0.mode === 'data' ? '--nvl' : '--warm'})">
        <header><span class="ev-mode">${c0.mode}</span><h3>${esc(c0.part.title)}</h3><a class="ev-go" href="${view(i, c0.mode, c0.part.id)}">See it in 3D ↗</a></header>
        <dl>${rows.map(row).join('')}</dl></article>`;
    }
    html += '</section>';
  });
  for (const [g, n, title, sub] of GROUPS) {
    const rows = shown.filter(c => c.group === g); if (!rows.length) continue;
    html += `<section class="ev-level"><h2 class="ev-lt"><span>${n}</span>${title}<small>${sub}</small></h2><article class="ev-part" style="--c: var(--mv)"><dl>${rows.map(row).join('')}</dl></article></section>`;
  }
  $('ev-claims').innerHTML = html || '<p class="ev-none">Nothing matches. Clear the search or turn a label back on.</p>';
  $('ev-count').textContent = `${shown.length.toLocaleString('en-US')} of ${claims.length.toLocaleString('en-US')} claims`;
}
$('ev-q').addEventListener('input', render);
document.querySelectorAll('.ev-filter').forEach(g => g.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); render(); }));
render();

// ---------- the bibliography: who published it, when, when it was checked, and how often the site leans on it ----------
const cites = new Map();
for (const c of claims) for (const [id] of c.ev?.refs || []) cites.set(id, (cites.get(id) || 0) + 1);
const byPub = new Map();
for (const [id, s] of Object.entries(SOURCES)) { const k = s.publisher; if (!byPub.has(k)) byPub.set(k, []); byPub.get(k).push([id, s]); }
const meta = s => [s.kind === 'primary' ? 'primary' : s.kind === 'secondary' ? 'secondary' : '', s.published && `published ${s.published}`, s.accessed && `checked ${s.accessed}`].filter(Boolean).join(' · ');
$('ev-src').innerHTML = [...byPub.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([pub, list]) => `
  <div class="ev-pub"><h3>${esc(pub)}</h3><ul>${list.map(([id, s]) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a><span class="ev-cites">${meta(s) ? `${esc(meta(s))} · ` : ''}${cites.get(id) ? `backs ${cites.get(id)} ${cites.get(id) === 1 ? 'figure' : 'figures'}` : 'background'}</span></li>`).join('')}</ul></div>`).join('');
