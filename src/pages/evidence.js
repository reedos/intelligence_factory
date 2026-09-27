// The Evidence page: every claim in the 3D cards and the power ledger, with its basis label and sources, built
// from the same content() and sources the visualizer uses, so it cannot drift from what the site says.
import { compute, DEFAULT_SCENARIO } from '../model/engine.ts';
import { content, BASIS } from '../data.js';
import { SOURCES, PART_SOURCES, LEDGER_SOURCES, EST_NOTES } from '../sources.js';
import { SITES } from '../model/sites.ts';
import '../app/site.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const M = compute(DEFAULT_SCENARIO), C = content(M);
const LAYERS = [['power', 'PARTS', 'Power'], ['data', 'PARTS_DATA', 'Data'], ['heat', 'PARTS_HEAT', 'Heat']];

// ---------- the claims ----------
const claims = [];
C.SCENES.forEach((sc, i) => {
  for (const [mode, key] of LAYERS) for (const p of C[key][sc.id] || []) {
    const src = PART_SOURCES[`${mode}:${sc.id}:${p.id}`] || [];
    for (const [k, v, b] of p.specs || []) claims.push({ level: i, sc, mode, part: p, k, v, b, src, note: EST_NOTES[`${mode}:${sc.id}:${p.id}`] });
  }
});
const ledger = C.LEDGER.filter(r => r.basis).map(r => ({ r, src: (LEDGER_SOURCES.find(([pre]) => r.label.startsWith(pre)) || [, []])[1] }));

// how often each source is cited, anywhere the site cites
const cites = new Map();
const cite = id => cites.set(id, (cites.get(id) || 0) + 1);
Object.values(PART_SOURCES).forEach(ids => ids.forEach(cite));
LEDGER_SOURCES.forEach(([, ids]) => ids.forEach(cite));
Object.values(SITES).forEach(s => s.sources.forEach(cite));

$('ev-scenario').textContent = `Figures are shown for the default campus: ${Math.round(M.meterMW)} MW at the meter, ${M.accel.rackName} racks, 415 V AC to the rack, warm-water cooling. Change the campus on the main page and every number there follows; the sources stay the same.`;
const count = b => claims.filter(c => c.b === b).length;
$('ev-stats').innerHTML = [['Claims in the 3D cards', claims.length], ['Spec', count('spec')], ['Typical', count('typical')], ['Est.', count('est')], ['Sources', Object.keys(SOURCES).length]]
  .map(([k, v]) => `<div><dt>${k}</dt><dd>${v.toLocaleString('en-US')}</dd></div>`).join('');

// one entry per publisher: its name links to its only page, or is followed by numbered links to each of its pages
const srcLinks = ids => {
  const by = new Map();
  for (const s of ids.map(id => SOURCES[id]).filter(Boolean)) { if (!by.has(s.publisher)) by.set(s.publisher, []); by.get(s.publisher).push(s); }
  const a = (s, text) => `<a href="${esc(s.url)}" target="_blank" rel="noopener" title="${esc(s.title)}">${text}</a>`;
  return [...by].map(([pub, list]) => list.length === 1 ? a(list[0], esc(pub))
    : `${esc(pub)} <span class="ev-n">${list.map((s, i) => a(s, i + 1)).join(' ')}</span>`).join('<span aria-hidden="true"> · </span>');
};
const view = (i, mode, id) => `index.html?view=${i}.${mode}.${id}#explore`;

function render() {
  const q = $('ev-q').value.trim().toLowerCase();
  const bases = new Set([...document.querySelectorAll('[data-basis][aria-pressed="true"]')].map(b => b.dataset.basis));
  const layers = new Set([...document.querySelectorAll('[data-layer][aria-pressed="true"]')].map(b => b.dataset.layer));
  const hit = c => bases.has(c.b) && layers.has(c.mode) && (!q || `${c.k} ${c.v} ${c.part.title} ${c.sc.title} ${c.src.map(id => `${SOURCES[id]?.publisher} ${SOURCES[id]?.title}`).join(' ')}`.toLowerCase().includes(q));
  const shown = claims.filter(hit);
  let html = '';
  C.SCENES.forEach((sc, i) => {
    const mine = shown.filter(c => c.level === i); if (!mine.length) return;
    html += `<section class="ev-level"><h2 class="ev-lt"><span>${sc.n}</span>${esc(sc.title)}<small>${esc(sc.scale)}</small></h2>`;
    const parts = [...new Set(mine.map(c => `${c.mode}:${c.part.id}`))];
    for (const key of parts) {
      const rows = mine.filter(c => `${c.mode}:${c.part.id}` === key), c0 = rows[0];
      html += `<article class="ev-part" style="--c: var(${c0.mode === 'power' ? '--mv' : c0.mode === 'data' ? '--nvl' : '--warm'})">
        <header><span class="ev-mode">${c0.mode}</span><h3>${esc(c0.part.title)}</h3><a class="ev-go" href="${view(i, c0.mode, c0.part.id)}">See it in 3D ↗</a></header>
        <dl>${rows.map(c => `<div><dt>${esc(c.k)}</dt><dd>${esc(c.v)}</dd><span class="chip ${c.b}">${BASIS[c.b].short}</span></div>`).join('')}</dl>
        ${c0.note ? `<p class="ev-note">How the estimate is made: ${esc(c0.note)}</p>` : ''}
        <p class="ev-src">${c0.src.length ? `Sources: ${srcLinks(c0.src)}` : 'No outside source: derived on this page from the figures above.'}</p>
      </article>`;
    }
    html += '</section>';
  });
  // the ledger: where 100 MW goes, row by row
  const lrows = ledger.filter(({ r }) => bases.has(r.basis) && layers.has('power') && (!q || r.label.toLowerCase().includes(q)));
  if (lrows.length) html += `<section class="ev-level"><h2 class="ev-lt"><span>2.1</span>The ledger<small>where ${Math.round(M.meterMW)} MW goes</small></h2>
    <article class="ev-part" style="--c: var(--mv)"><dl>${lrows.map(({ r, src }) => `<div><dt>${esc(r.label)}</dt><dd>${r.mw >= 0 ? '' : '−'}${Math.abs(r.mw).toFixed(1)} MW${src.length ? ` <span class="ev-inline">· ${srcLinks(src)}</span>` : ''}</dd><span class="chip ${r.basis}">${BASIS[r.basis].short}</span></div>`).join('')}</dl></article></section>`;
  $('ev-claims').innerHTML = html || '<p class="ev-none">Nothing matches. Clear the search or turn a label back on.</p>';
  $('ev-count').textContent = `${shown.length.toLocaleString('en-US')} of ${claims.length.toLocaleString('en-US')} claims`;
}
$('ev-q').addEventListener('input', render);
document.querySelectorAll('.ev-filter button').forEach(b => b.addEventListener('click', () => { b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); render(); }));
render();

// ---------- the bibliography ----------
const byPub = new Map();
for (const [id, s] of Object.entries(SOURCES)) { const k = s.publisher; if (!byPub.has(k)) byPub.set(k, []); byPub.get(k).push([id, s]); }
$('ev-src').innerHTML = [...byPub.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([pub, list]) => `
  <div class="ev-pub"><h3>${esc(pub)}</h3><ul>${list.map(([id, s]) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a><span class="ev-cites">${cites.get(id) ? `cited in ${cites.get(id)} ${cites.get(id) === 1 ? 'place' : 'places'}` : 'background'}</span></li>`).join('')}</ul></div>`).join('');
