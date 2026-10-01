// A crawler-readable (and no-JS-readable) text version of the visualizer: every level, and every part card at every
// level, for the site's one default scenario (src/model/engine.ts's DEFAULT_SCENARIO). Built from the same content(M)
// the 3D view itself reads (src/data.js), so there is nothing here to keep in sync by hand. Two things render this:
// a <noscript> block inside visualizer.html (shown to real visitors without JavaScript, not hidden from them) and
// the static src/pages/parts.html page it links to, which is the one a crawler or a no-JS reader can actually open
// and read like any other page. tools/prerender-plugin.mjs calls buildLevels() once at build time for both.
import { BASIS, evOf } from '../evidence.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const basisLabel = basis => BASIS[basis]?.short || basis;
const MODES = [['power', 'Power', 'PARTS'], ['data', 'Data', 'PARTS_DATA'], ['heat', 'Heat', 'PARTS_HEAT']];

function specLine(row, SOURCES) {
  const [label, value, basis] = row;
  const ev = evOf(row);
  const titles = (ev?.refs || []).map(([id]) => SOURCES[id]?.title).filter(Boolean);
  return { label, value, basisKey: basis, basis: basisLabel(basis), sourceTitles: titles };
}

// one flat list of levels (the six main scales plus the side levels), each carrying its parts per mode, for the
// default scenario; `drillHref` points a part at its in-3D view the same way the Evidence page's "See it in 3D" does
export function buildLevels(M, C, SOURCES) {
  return C.SCENES.map((sc, i) => ({
    id: sc.id, n: sc.n, title: sc.title, kicker: sc.kicker, scale: sc.scale, side: !!sc.side,
    modes: MODES.map(([mode, label, key]) => ({
      mode, label,
      parts: (C[key][sc.id] || []).map(p => ({
        id: p.id, title: p.title, kicker: p.kicker, body: p.body,
        href: `visualizer.html?view=${i}.${mode}.${p.id}`,
        specs: (p.specs || []).map(row => specLine(row, SOURCES)),
      })),
    })).filter(m => m.parts.length),
  }));
}

// a text label for the reference scenario, reused by the noscript block, parts.html and llms.txt
export const scenarioLine = M => `Reference scenario: ${Math.round(M.meterMW)} MW at the meter, ${M.accel.rackName} racks, 415 V AC to the rack, warm-water cooling.`;

// Markup reuses evidence.html's own classes (ev-level, ev-lt, ev-part, ev-mode, chip) so this index needs no CSS
// of its own and looks like the rest of the site, in both parts.html and the <noscript> block in visualizer.html.
function specListHtml(s) {
  if (!s.length) return '';
  return `<dl>${s.map(r => `<div><dt>${esc(r.label)}</dt><dd>${esc(r.value)}${r.sourceTitles.length ? ` <span class="ev-at">(${r.sourceTitles.map(esc).join('; ')})</span>` : ''}</dd><span class="chip ${r.basisKey}">${esc(r.basis)}</span></div>`).join('')}</dl>`;
}
function partHtml(p, mode) {
  return `<article class="ev-part" style="--c: var(${mode === 'power' ? '--mv' : mode === 'data' ? '--nvl' : '--warm'})">
    <header><span class="ev-mode">${esc(mode)}</span><h3>${esc(p.title)}</h3><a class="ev-go" href="${p.href}">See it in 3D ↗</a></header>
    <p class="ev-back">${esc(p.kicker)}</p><p>${esc(p.body)}</p>${specListHtml(p.specs)}</article>`;
}
function levelHtml(lv) {
  return `<section class="ev-level"><h2 class="ev-lt">${lv.n !== undefined ? `<span>${esc(String(lv.n))}</span>` : ''}${esc(lv.title)}<small>${lv.kicker ? `${esc(lv.kicker)} · ` : ''}${esc(lv.scale)}</small></h2>
    ${lv.modes.map(m => m.parts.map(p => partHtml(p, m.mode)).join('')).join('')}</section>`;
}

// the full index, as the markup of a real, visible page (used for both parts.html and the visualizer's <noscript>)
export function renderLevelsHtml(levels) {
  return levels.map(levelHtml).join('');
}
