// The Glossary page: A to Z, each term in plain words, with a link into the 3D view and its sources.
import { TERMS } from './glossary-data.js';
import { SOURCES } from '../sources.js';
import '../app/site.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const COLOR = { power: '--mv', data: '--nvl', compute: '--hbm', heat: '--warm', general: '--muted' };
// numbers and symbols file under the first letter of the words they stand for; 34.5 kV sorts with the other voltages under #
const letter = t => { const c = t.term[0].toUpperCase(); return /[A-Z]/.test(c) ? c : '#'; };
const terms = [...TERMS].sort((a, b) => a.term.localeCompare(b.term, 'en', { numeric: true, sensitivity: 'base' }));
const anchor = t => `t-${t.term.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
const srcLinks = ids => {
  const by = new Map();
  for (const s of (ids || []).map(id => SOURCES[id]).filter(Boolean)) { if (!by.has(s.publisher)) by.set(s.publisher, []); by.get(s.publisher).push(s); }
  const a = (s, text) => `<a href="${esc(s.url)}" target="_blank" rel="noopener" title="${esc(s.title)}">${text}</a>`;
  return [...by].map(([pub, list]) => list.length === 1 ? a(list[0], esc(pub)) : `${esc(pub)} <span class="ev-n">${list.map((s, i) => a(s, i + 1)).join(' ')}</span>`).join('<span aria-hidden="true"> · </span>');
};

function render() {
  const q = $('gl-q').value.trim().toLowerCase();
  const layers = new Set([...document.querySelectorAll('[data-layer][aria-pressed="true"]')].map(b => b.dataset.layer));
  const shown = terms.filter(t => layers.has(t.layer) && (!q || `${t.term} ${(t.aka || []).join(' ')} ${t.def}`.toLowerCase().includes(q)));
  const letters = [...new Set(shown.map(letter))];
  $('gl-list').innerHTML = letters.map(L => `<section class="gl-letter" id="l-${L === '#' ? 'num' : L}"><h2 class="gl-l">${L}</h2><div class="gl-terms">${shown.filter(t => letter(t) === L).map(t => `
    <article class="gl-term" id="${anchor(t)}" style="--c: var(${COLOR[t.layer]})">
      <header><h3>${esc(t.term)}</h3>${t.aka?.length ? `<span class="gl-aka">also ${t.aka.map(esc).join(', ')}</span>` : ''}<span class="ev-mode">${t.layer}</span></header>
      <p>${esc(t.def)}</p>
      ${t.link || t.sources?.length ? `<footer>${t.link ? `<a class="ev-go" href="index.html?view=${t.link.scene}.${t.link.mode}.${t.link.part}#explore">See it in 3D ↗</a>` : ''}${t.sources?.length ? `<span class="ev-src">${srcLinks(t.sources)}</span>` : ''}</footer>` : ''}
    </article>`).join('')}</div></section>`).join('') || '<p class="ev-none">Nothing matches. Clear the search or turn a layer back on.</p>';
  $('gl-count').textContent = `${shown.length} of ${terms.length} terms`;
  $('gl-az').innerHTML = [...'#ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map(L => letters.includes(L) ? `<a href="#l-${L === '#' ? 'num' : L}">${L}</a>` : `<span aria-hidden="true">${L}</span>`).join('');
}
$('gl-q').addEventListener('input', render);
document.querySelectorAll('.ev-filter button').forEach(b => b.addEventListener('click', () => { b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); render(); }));
render();
if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
