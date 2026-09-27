// The Method page: twelve sections on how the model makes its numbers, with a contents list that follows the reader.
import { SECTIONS } from './method-data.js';
import '../app/site.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
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
