// The Method page: how the model makes its numbers, then the registers of calculations and assumptions its figures
// point to, with a contents list that follows the reader.
import { SECTIONS as WRITTEN } from './method-data.js';
import { CALCS, ASSUMPTIONS } from '../evidence.js';
import '../app/site.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// After the written sections, the two registers the site's labels point into: every calculation a Calc. figure names,
// and every assumption an Assumed figure names, each with an anchor its popover links to. Facts live on the Evidence
// page with their sources; these two lists are what the model adds to them.
const n = WRITTEN.length;
const SECTIONS = [...WRITTEN,
  { id: 'calculations', title: `${n + 1}. Calculations`, html: `<p>What the model calculates, how, and from what. A figure labeled <b>Calc.</b> names one of these.</p><dl class="mt-reg">${Object.entries(CALCS).map(([id, c]) => `<div id="calc-${esc(id)}"><dt>${esc(c.title)}</dt><dd>${esc(c.how)}${c.inputs?.length ? `<span class="mt-in">From: ${c.inputs.map(esc).join(', ')}</span>` : ''}</dd></div>`).join('')}</dl>` },
  { id: 'assumptions', title: `${n + 2}. Assumptions`, html: `<p>Values the model chooses where no single published figure applies, and why. A figure labeled <b>Assumed</b> names one of these. Change one and the figures that rest on it change with it.</p><dl class="mt-reg">${Object.entries(ASSUMPTIONS).map(([id, a]) => `<div id="assume-${esc(id)}"><dt>${esc(a.title)}: ${esc(a.value)}</dt><dd>${esc(a.why)}</dd></div>`).join('')}</dl>` },
];
// titles carry their own numbers ("3. Power: ..."); the contents list shows them apart
const split = t => { const m = t.match(/^(\d+)\.\s*(.*)$/); return m ? [m[1], m[2]] : ['', t]; };

$('mt-body').innerHTML = SECTIONS.map(s => { const [n, t] = split(s.title); return `
  <section class="mt-sec" id="${esc(s.id)}"><h2><span>${n}</span>${esc(t)}</h2><div class="mt-html">${s.html}</div></section>`; }).join('');
$('mt-toc').innerHTML = `<p class="eyebrow">On this page</p><ol>${SECTIONS.map(s => { const [n, t] = split(s.title); return `<li><a href="#${esc(s.id)}"><span>${n}</span>${esc(t)}</a></li>`; }).join('')}</ol>`;
// wide tables scroll in their own box on a phone
document.querySelectorAll('.mt-html table').forEach(t => { const w = document.createElement('div'); w.className = 'mt-scroll'; t.replaceWith(w); w.appendChild(t); });

// the section in view is marked in the contents
const links = [...document.querySelectorAll('#mt-toc a')];
const secs = SECTIONS.map(s => document.getElementById(s.id));
function spy() {
  let on = secs[0]?.id;
  for (const s of secs) if (s.getBoundingClientRect().top < innerHeight * 0.35) on = s.id;
  links.forEach(a => a.setAttribute('aria-current', String(a.getAttribute('href') === `#${on}`)));
}
addEventListener('scroll', () => requestAnimationFrame(spy), { passive: true });
spy();
if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
