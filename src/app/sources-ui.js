// Source popovers. A basis chip with data-src opens a small panel: what the label means, how an estimate was
// made when we know, and the sources behind the card or ledger row. Keys:
//   '<layer>:<sceneId>:<partId>'  a 3D card        'ledger:<row>'  a ledger row        'bom:<group>-<row>'  an inventory row
import { SOURCES, PART_SOURCES, LEDGER_SOURCES, EST_NOTES } from '../sources.js';
import { BASIS } from '../data.js';
import { store } from './store.js';
import { SITES } from '../model/sites.ts';

const MEANING = {
  spec: 'A vendor or a standards body states this figure.',
  typical: 'Several independent sources agree on it; no single official figure exists.',
  est: 'Derived on this page, or the sources disagree. Treat it as a scale, not a spec.',
};
const pop = document.createElement('div');
pop.className = 'src-pop'; pop.id = 'src-pop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Sources'); pop.hidden = true;
document.body.appendChild(pop);
let opener = null;

const partKey = link => `${link.mode}:${store.C.SCENES[link.scene].id}:${link.part}`;
function resolve(key) {
  if (key.startsWith('ledger:')) {
    const row = store.M.ledger[+key.slice(7)];
    const hit = row && LEDGER_SOURCES.find(([p]) => row.label.startsWith(p));
    return { title: row?.label, ids: hit ? hit[1] : [], note: row?.link ? EST_NOTES[partKey(row.link)] : null };
  }
  if (key.startsWith('bom:')) {
    const [g, r] = key.slice(4).split('-').map(Number), row = store.C.BOM[g]?.rows[r];
    const k = row?.[3] ? partKey(row[3]) : null;
    return { title: row?.[0], ids: (k && PART_SOURCES[k]) || [], note: 'Counts are this page’s estimates, sized from the scenario; the sources are for the part itself.' };
  }
  const site = store.M.scenario.site && SITES[store.M.scenario.site];
  if (key === 'power:across:home' && site) return { title: site.name, ids: site.sources, note: site.unknowns.join(' ') };
  return { title: null, ids: PART_SOURCES[key] || [], note: EST_NOTES[key] };
}

function open(chip) {
  const basis = [...chip.classList].find(c => BASIS[c]) || 'est';
  const { title, ids, note } = resolve(chip.dataset.src);
  const list = ids.map(id => SOURCES[id]).filter(Boolean);
  pop.innerHTML = `
    <div class="sp-head"><span class="chip ${basis}">${BASIS[basis].short}</span><b>${BASIS[basis].label}</b><button type="button" class="sp-x" aria-label="Close">×</button></div>
    <p class="sp-mean">${MEANING[basis]}</p>
    ${note && basis !== 'spec' ? `<p class="sp-note">${note}</p>` : ''}
    ${list.length ? `<p class="sp-k">${title ? `Sources for ${title.replace(/</g, '&lt;')}` : 'Sources for this card'}</p><ul>${list.map(s => `<li><a href="${s.url}" target="_blank" rel="noopener">${s.title}</a><span>${s.publisher}</span></li>`).join('')}</ul>`
      : '<p class="sp-k">No published source backs this one directly; it is this page’s estimate.</p>'}`;
  pop.hidden = false;
  // place under the chip, kept on screen
  const r = chip.getBoundingClientRect(), w = Math.min(360, innerWidth - 24);
  pop.style.width = `${w}px`;
  const left = Math.max(12, Math.min(innerWidth - w - 12, r.left + r.width / 2 - w / 2));
  const below = r.bottom + 8, h = pop.offsetHeight;
  pop.style.left = `${left}px`;
  pop.style.top = `${below + h > innerHeight - 12 && r.top - h - 8 > 12 ? r.top - h - 8 : below}px`;
  opener = chip; chip.setAttribute('aria-expanded', 'true');
  pop.querySelector('.sp-x').addEventListener('click', close);
  pop.querySelector('a, .sp-x')?.focus({ preventScroll: true });
}
function close() {
  if (pop.hidden) return;
  pop.hidden = true;
  if (opener) { opener.setAttribute('aria-expanded', 'false'); if (pop.contains(document.activeElement) || document.activeElement === document.body) opener.focus({ preventScroll: true }); }
  opener = null;
}
// capture phase, so a chip inside a linked row opens its sources instead of following the row's link
document.addEventListener('click', e => {
  const chip = e.target.closest?.('[data-src]');
  if (chip) { e.preventDefault(); e.stopPropagation(); if (opener === chip) close(); else open(chip); return; }
  if (!pop.contains(e.target)) close();
}, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
addEventListener('scroll', close, { passive: true });
addEventListener('resize', close);
document.getElementById('parts')?.closest('.panel-scroll')?.addEventListener('scroll', close, { passive: true });
