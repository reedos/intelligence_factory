// The Glossary page: A to Z, each term in plain words, with a link into the 3D view and its sources, and for a term
// that states a figure, where in each source it is (the entry's cites). The full A-Z list is also baked into
// glossary.html at build time (tools/prerender-plugin.mjs, via src/pages/glossary-render.js) so a crawler that
// never runs this script still sees every term; this script's job at runtime is the search box and layer filters.
import { TERMS } from './glossary-data.js';
import { SOURCES } from '../sources.js';
import { sortedTerms, buildGlossaryHtml } from './glossary-render.js';
import '../app/site.js';

const $ = id => document.getElementById(id);
const terms = sortedTerms(TERMS);

function render() {
  const q = $('gl-q').value.trim().toLowerCase();
  const layers = new Set([...document.querySelectorAll('[data-layer][aria-pressed="true"]')].map(b => b.dataset.layer));
  const { listHtml, countText, azHtml } = buildGlossaryHtml(terms, SOURCES, layers, q);
  $('gl-list').innerHTML = listHtml;
  $('gl-count').textContent = countText;
  $('gl-az').innerHTML = azHtml;
}
$('gl-q').addEventListener('input', render);
document.querySelectorAll('.ev-filter button').forEach(b => b.addEventListener('click', () => { b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); render(); }));
render();
if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
