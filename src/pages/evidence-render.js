// Pure HTML-generation for the Evidence page: no DOM access, so this module runs equally in the browser (evidence.js
// calls it against document.getElementById results) and in Node at build time (tools/prerender-plugin.mjs calls it
// to bake the same markup into evidence.html, so crawlers that never run JS still see the full claims list and
// bibliography). Keeping the generation here, not duplicated between the two call sites, is the single source of
// truth the SEO pass asked for: both paths read the same data modules and run the same template.
import { BASIS, CALCS, ASSUMPTIONS } from '../evidence.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const srcLine = (SOURCES, id, at) => { const s = SOURCES[id]; if (!s) return '';
  return `<a href="${esc(s.url)}" target="_blank" rel="noopener" title="${esc(s.title)}">${esc(s.publisher)}</a>${at ? ` <span class="ev-at">${esc(at)}</span>` : ''}`; };
const methodLink = (hash, text) => `<a href="method.html#${hash}">${esc(text)}</a>`;

export function backing(c, SOURCES) {
  const ev = c.ev;
  if (ev) {
    const bits = [];
    if (ev.refs?.length) bits.push(`${ev.calc ? 'Inputs' : 'Sources'}: ${ev.refs.map(([id, at]) => srcLine(SOURCES, id, at)).join('<span aria-hidden="true"> · </span>')}`);
    if (ev.vs) bits.push(`Compared with: ${esc(ev.vs)}`);
    if (ev.calc && CALCS[ev.calc]) bits.push(`Calculated: ${esc(CALCS[ev.calc].how)} ${methodLink(`calc-${ev.calc}`, 'Method')}`);
    if (ev.assume && ASSUMPTIONS[ev.assume]) bits.push(`Assumed: ${esc(ASSUMPTIONS[ev.assume].title)}, ${esc(ASSUMPTIONS[ev.assume].value)}. ${methodLink(`assume-${ev.assume}`, 'Why')}`);
    return bits.map(b => `<p class="ev-back">${b}</p>`).join('');
  }
  return '<p class="ev-back ev-todo">Not traced to a source, a calculation or an assumption.</p>';
}
const row = (c, SOURCES) => `<div class="ev-claim"><dt>${esc(c.label)}</dt><dd>${esc(c.value)}</dd><span class="chip ${c.basis}">${BASIS[c.basis]?.short || c.basis}</span>${backing(c, SOURCES)}</div>`;
const view = (i, mode, id) => `visualizer.html?view=${i}.${mode}.${id}`;

const groupsOf = M => [['ledger', '2.1', 'The ledger', `where ${Math.round(M.meterMW)} MW goes`], ['bom', '2.2', 'The inventory', 'counts sized from the scenario'],
  ['links', '3.2', 'Links', 'copper and optics'], ['clock', '4', 'The clock', 'notes under the simulations'], ['temps', '4.1', 'Hot to cold', 'one operating point per cooling design'], ['site', '1', 'Real campuses', 'facts behind the presets'],
  ['tour', '▸', 'The tours', 'the figures each narrated stop states']];

// fixed reference scenario: one sentence of context above the claims list, the same wording whether JS has run or not
export const scenarioNote = M => `Figures below are fixed to one reference scenario, not whichever campus you set on the visualizer: ${Math.round(M.meterMW)} MW at the meter, ${M.accel.rackName} racks, 415 V AC to the rack, warm-water cooling. Change the campus on the main page and its own numbers follow; the claims and sources on this page always describe this one scenario.`;

export const basisOrder = () => ['spec', 'vendor', 'reported', 'derived', 'assumed', 'typical', 'est'];
export const shownBasesOf = claims => basisOrder().filter(b => claims.some(c => c.basis === b));

export function renderStats(claims, shownBases, sourceCount) {
  const count = b => claims.filter(c => c.basis === b).length;
  const untraced = claims.filter(c => !c.ev).length;
  return [['Claims', claims.length], ...shownBases.map(b => [BASIS[b].short, count(b)]), ...(untraced ? [['Not yet traced', untraced]] : []), ['Sources', sourceCount]]
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${v.toLocaleString('en-US')}</dd></div>`).join('');
}
export const renderBasesFilter = shownBases => shownBases.map(b => `<button type="button" data-basis="${b}" aria-pressed="true"><i class="k-${b}"></i>${BASIS[b].short}</button>`).join('');

// the claims list for a given (already-filtered) set of claims; called with the full set for the default, static page
export function renderClaims(C, SOURCES, shown, M) {
  let html = '';
  C.SCENES.forEach((sc, i) => {
    const mine = shown.filter(c => c.group === 'card' && c.level === i); if (!mine.length) return;
    html += `<section class="ev-level"><h2 class="ev-lt"><span>${sc.n}</span>${esc(sc.title)}<small>${esc(sc.scale)}</small></h2>`;
    for (const key of new Set(mine.map(c => `${c.mode}:${c.part.id}`))) {
      const rows = mine.filter(c => `${c.mode}:${c.part.id}` === key), c0 = rows[0];
      html += `<article class="ev-part" style="--c: var(${c0.mode === 'power' ? '--mv' : c0.mode === 'data' ? '--nvl' : '--warm'})">
        <header><span class="ev-mode">${c0.mode}</span><h3>${esc(c0.part.title)}</h3><a class="ev-go" href="${view(i, c0.mode, c0.part.id)}">See it in 3D ↗</a></header>
        <dl>${rows.map(c => row(c, SOURCES)).join('')}</dl></article>`;
    }
    html += '</section>';
  });
  for (const [g, n, title, sub] of groupsOf(M)) {
    const rows = shown.filter(c => c.group === g); if (!rows.length) continue;
    html += `<section class="ev-level"><h2 class="ev-lt"><span>${n}</span>${title}<small>${sub}</small></h2><article class="ev-part" style="--c: var(--mv)"><dl>${rows.map(c => row(c, SOURCES)).join('')}</dl></article></section>`;
  }
  return html || '<p class="ev-none">Nothing matches. Clear the search or turn a label back on.</p>';
}

// the bibliography: who published it, when, when it was checked, and how often the site leans on it
export function renderSources(claims, SOURCES) {
  const cites = new Map();
  for (const c of claims) for (const [id] of c.ev?.refs || []) cites.set(id, (cites.get(id) || 0) + 1);
  const byPub = new Map();
  for (const [id, s] of Object.entries(SOURCES)) { const k = s.publisher; if (!byPub.has(k)) byPub.set(k, []); byPub.get(k).push([id, s]); }
  const meta = s => [s.kind === 'primary' ? 'primary' : s.kind === 'secondary' ? 'secondary' : '', s.published && `published ${s.published}`, s.accessed && `checked ${s.accessed}`].filter(Boolean).join(' · ');
  return [...byPub.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([pub, list]) => `
    <div class="ev-pub"><h3>${esc(pub)}</h3><ul>${list.map(([id, s]) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a><span class="ev-cites">${meta(s) ? `${esc(meta(s))} · ` : ''}${cites.get(id) ? `backs ${cites.get(id)} ${cites.get(id) === 1 ? 'figure' : 'figures'}` : 'background'}</span></li>`).join('')}</ul></div>`).join('');
}
