// Pure HTML-generation for the Glossary page, shared by glossary.js (browser) and tools/prerender-plugin.mjs
// (build time, baking the full A-Z list into glossary.html for crawlers that do not run JS). Reads the same
// src/pages/glossary-data.js terms and src/sources.js citations the interactive page always has.
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const COLOR = { power: '--mv', data: '--nvl', compute: '--hbm', heat: '--warm', general: '--muted' };
// numbers and symbols file under the first letter of the words they stand for; 34.5 kV sorts with the other voltages under #
const letter = t => { const c = t.term[0].toUpperCase(); return /[A-Z]/.test(c) ? c : '#'; };
export const sortedTerms = TERMS => [...TERMS].sort((a, b) => a.term.localeCompare(b.term, 'en', { numeric: true, sensitivity: 'base' }));
const anchor = t => `t-${t.term.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
const srcLinks = (SOURCES, ids) => {
  const by = new Map();
  for (const s of (ids || []).map(id => SOURCES[id]).filter(Boolean)) { if (!by.has(s.publisher)) by.set(s.publisher, []); by.get(s.publisher).push(s); }
  const a = (s, text) => `<a href="${esc(s.url)}" target="_blank" rel="noopener" title="${esc(s.title)}">${text}</a>`;
  return [...by].map(([pub, list]) => list.length === 1 ? a(list[0], esc(pub)) : `${esc(pub)} <span class="ev-n">${list.map((s, i) => a(s, i + 1)).join(' ')}</span>`).join('<span aria-hidden="true"> · </span>');
};

export const ALL_LAYERS = new Set(['power', 'data', 'compute', 'heat', 'general']);

// layers: a Set of layer names to include (the glossary's own filter); q: a lowercase search string ('' = all)
export function buildGlossaryHtml(terms, SOURCES, layers = ALL_LAYERS, q = '') {
  const shown = terms.filter(t => layers.has(t.layer) && (!q || `${t.term} ${(t.aka || []).join(' ')} ${t.def}`.toLowerCase().includes(q)));
  const letters = [...new Set(shown.map(letter))];
  const listHtml = shown.length ? letters.map(L => `<section class="gl-letter" id="l-${L === '#' ? 'num' : L}"><h2 class="gl-l">${L}</h2><div class="gl-terms">${shown.filter(t => letter(t) === L).map(t => `
    <article class="gl-term" id="${anchor(t)}" style="--c: var(${COLOR[t.layer]})">
      <header><h3>${esc(t.term)}</h3>${t.aka?.length ? `<span class="gl-aka">also ${t.aka.map(esc).join(', ')}</span>` : ''}<span class="ev-mode">${t.layer}</span></header>
      <p>${esc(t.def)}</p>
      ${t.cites?.length ? `<ul class="gl-cites">${t.cites.filter(([id]) => SOURCES[id]).map(([id, at]) => `<li><a href="${esc(SOURCES[id].url)}" target="_blank" rel="noopener">${esc(SOURCES[id].publisher)}</a>: ${esc(at)}</li>`).join('')}</ul>` : ''}
      ${t.link || t.sources?.length ? `<footer>${t.link ? `<a class="ev-go" href="visualizer.html?view=${t.link.scene}.${t.link.mode}.${t.link.part}">See it in 3D ↗</a>` : ''}${t.sources?.length ? `<span class="ev-src">${srcLinks(SOURCES, t.sources)}</span>` : ''}</footer>` : ''}
    </article>`).join('')}</div></section>`).join('') : '<p class="ev-none">Nothing matches. Clear the search or turn a layer back on.</p>';
  const countText = `${shown.length} of ${terms.length} terms`;
  const azHtml = [...'#ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map(L => letters.includes(L) ? `<a href="#l-${L === '#' ? 'num' : L}">${L}</a>` : `<span aria-hidden="true">${L}</span>`).join('');
  return { listHtml, countText, azHtml, shown };
}
