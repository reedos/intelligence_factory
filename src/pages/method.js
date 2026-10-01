// The Method page: how the model makes its numbers, then the registers of calculations and assumptions its figures
// point to, with a contents list that follows the reader.
import { SECTIONS as WRITTEN } from './method-data.js';
import { CALCS, ASSUMPTIONS } from '../evidence.js';
import { buildMethodSections, buildBodyHtml, buildTocHtml } from './method-render.js';
import '../app/site.js';

const $ = id => document.getElementById(id);
// After the written sections, the two registers the site's labels point into: every calculation a Calc. figure names,
// and every assumption an Assumed figure names, each with an anchor its popover links to. Facts live on the Evidence
// page with their sources; these two lists are what the model adds to them. Built once in method-render.js so this
// script and the build-time prerender (tools/prerender-plugin.mjs) can never disagree on the text.
const SECTIONS = buildMethodSections(WRITTEN, CALCS, ASSUMPTIONS);

$('mt-body').innerHTML = buildBodyHtml(SECTIONS);
$('mt-toc').innerHTML = buildTocHtml(SECTIONS);
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
