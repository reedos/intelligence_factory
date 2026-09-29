// Linked views. Any element with data-go="scene:mode:part" jumps the 3D stage to that part; a part selected in 3D
// points back to its ledger row and inventory row. Links come from the model (engine.ts and data.js), so they
// follow the scenario: an H100 ledger row lands on server power supplies, an NVL72 row on rack power shelves.
// On the visualizer the jump moves the 3D view (setGo registers stage.js's show); on the story page, which has no 3D
// view, it opens the visualizer at that level, layer and part, keeping the reader's scenario.
import { store, on } from './store.js';
import { withScenario } from './scenario-links.js';
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let goTo = null;
export function setGo(fn) { goTo = fn; }
export const visualizerHref = (view, extra = '') => withScenario(location.search, `visualizer.html?view=${view}${extra}`);

const $ = id => document.getElementById(id);
const key = l => `${l.scene}:${l.mode}:${l.part}`;

// attributes for an HTML element or an SVG group that links into 3D
export const goAttr = (link, label) => link ? `data-go="${key(link)}" tabindex="0" role="button" aria-label="Show ${String(label).replace(/<[^>]+>/g, '').replace(/"/g, '')} in 3D"` : '';

function follow(el) {
  const [scene, mode, part] = el.dataset.go.split(':');
  if (goTo) goTo({ scene: +scene, mode, part });
  else location.href = visualizerHref([scene, mode, part].filter(Boolean).join('.'));
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-go]');
  if (el) { e.preventDefault(); follow(el); }
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const el = e.target.closest?.('[data-go]');
  if (el && el === document.activeElement) { e.preventDefault(); follow(el); }
});

// ---------- back from 3D: the card lists where this part shows up in the charts ----------
const fmt = v => v >= 100 ? Math.round(v).toLocaleString('en-US') : v >= 10 ? v.toFixed(1) : v.toFixed(2);
function flashTo(el) {
  if (!el) return;
  el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
  el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
}
on('select', ({ scene, mode, id }) => {
  const k = `${scene}:${mode}:${id}`, box = $('card-links');
  document.querySelectorAll('.lg-row.sel').forEach(r => r.classList.remove('sel'));
  const items = [];
  store.M.ledger.forEach((r, i) => {
    if (!r.link || key(r.link) !== k) return;
    document.querySelector(`.lg-row[data-row="${i}"]`)?.classList.add('sel');
    items.push({ label: `In the ledger: ${r.label}`, value: `−${fmt(r.mw)} MW`, anchor: 'ledger-h', target: () => document.querySelector(`.lg-row[data-row="${i}"]`) });
  });
  if (store.C.LEDGER_END.link && key(store.C.LEDGER_END.link) === k) items.push({ label: 'In the ledger: what reaches the GPU silicon', value: `${fmt(store.M.gpuSiliconMW)} MW`, anchor: 'ledger-h', target: () => document.querySelector('.lg-row.end') });
  store.C.BOM.forEach((g, gi) => g.rows.forEach((r, ri) => {
    if (r[3] && key(r[3]) === k) items.push({ label: `Counted: ${r[0]}`, value: r[1], anchor: 'bom-h', target: () => document.querySelector(`#bom [data-bom="${gi}-${ri}"]`) });
  }));
  box.hidden = !items.length;
  // the charts live on the story page: here they scroll to the row; on the visualizer they open the story page there
  const here = !!document.querySelector('.lg-row');
  box.innerHTML = items.map((it, n) => here ? `<button type="button" data-i="${n}"><span>${it.label}</span><b>${it.value} ↓</b></button>`
    : `<a href="${withScenario(location.search, `index.html#${it.anchor}`)}"><span>${it.label}</span><b>${it.value} ↗</b></a>`).join('');
  if (here) box.querySelectorAll('button').forEach(b => b.addEventListener('click', () => flashTo(items[+b.dataset.i].target())));
});
on('scene', () => { document.querySelectorAll('.lg-row.sel').forEach(r => r.classList.remove('sel')); });
