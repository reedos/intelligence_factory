// Source popovers. A basis chip with data-src names one claim (src/claims.js); its popover says what the label means
// and what backs that one figure: each source with where in it the figure is, when it was published and when it was
// checked; or how the model calculates it; or what the model assumes and why. Claims not yet traced one by one fall
// back to the sources listed for their whole card, and say so.
import { SOURCES, PART_SOURCES, LEDGER_SOURCES } from '../sources.js';
import { BASIS, CALCS, ASSUMPTIONS } from '../evidence.js';
import { claimByKey } from '../claims.js';
import { store } from './store.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const pop = document.createElement('div');
pop.className = 'src-pop'; pop.id = 'src-pop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Sources'); pop.hidden = true;
document.body.appendChild(pop);
let opener = null;

// the method page, keeping the reader's scenario
const methodLink = (hash, text) => `<a href="method.html${location.search}#${hash}">${text}</a>`;
const dated = s => [s.published && `published ${esc(s.published)}`, s.accessed && `checked ${esc(s.accessed)}`].filter(Boolean).join(' · ');
const refItem = ([id, at]) => {
  const s = SOURCES[id]; if (!s) return '';
  return `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a><span>${esc(s.publisher)}${at ? ` · ${esc(at)}` : ''}</span>${dated(s) ? `<span class="sp-d">${dated(s)}</span>` : ''}</li>`;
};

// the sources a card or ledger row listed as a whole, before its figures were traced one by one
function legacyIds(key) {
  if (key.startsWith('card:')) { const [, mode, scene, part] = key.split(':'); return PART_SOURCES[`${mode}:${scene}:${part}`] || []; }
  if (key.startsWith('ledger:')) { const r = store.M.ledger[+key.slice(7)]; return (r && LEDGER_SOURCES.find(([p]) => r.label.startsWith(p))?.[1]) || []; }
  if (key.startsWith('links:')) return PART_SOURCES[key] || [];
  if (key.startsWith('site:')) { const s = claimByKey(store.M, store.C, key)?.site; return s?.sources || []; }
  return [];
}

function body(key) {
  const c = claimByKey(store.M, store.C, key);
  const basis = c?.basis && BASIS[c.basis] ? c.basis : 'est', b = BASIS[basis], ev = c?.ev;
  const head = `<div class="sp-head"><span class="chip ${basis}">${b.short}</span><b>${b.label}</b><button type="button" class="sp-x" aria-label="Close">×</button></div>
    ${c ? `<p class="sp-claim">${esc(c.label)}${c.value ? `: <b>${esc(c.value)}</b>` : ''}</p>` : ''}<p class="sp-mean">${b.meaning}</p>`;
  if (ev) {
    let html = head;
    if (ev.vs) html += `<p class="sp-note">Compared with: ${esc(ev.vs)}</p>`;
    if (ev.calc && CALCS[ev.calc]) html += `<p class="sp-k">How it is calculated</p><p class="sp-note">${esc(CALCS[ev.calc].how)} ${methodLink(`calc-${ev.calc}`, 'Method')}</p>`;
    if (ev.assume && ASSUMPTIONS[ev.assume]) { const a = ASSUMPTIONS[ev.assume]; html += `<p class="sp-k">What the model assumes</p><p class="sp-note">${esc(a.title)}: ${esc(a.value)}. ${esc(a.why)} ${methodLink(`assume-${ev.assume}`, 'Method')}</p>`; }
    if (ev.refs?.length) html += `<p class="sp-k">${ev.calc ? 'Its published inputs' : 'Sources for this figure'}</p><ul>${ev.refs.map(refItem).join('')}</ul>`;
    return html;
  }
  const ids = legacyIds(key).filter(id => SOURCES[id]);
  return head + (ids.length
    ? `<p class="sp-k">Sources for this ${key.startsWith('card:') ? 'card' : 'row'}, not yet matched to this figure</p><ul>${ids.map(id => refItem([id, ''])).join('')}</ul>`
    : '<p class="sp-k">Not yet traced to a source, a calculation or an assumption.</p>');
}

function open(chip) {
  pop.innerHTML = body(chip.dataset.src);
  pop.hidden = false;
  // place under the chip, kept on screen
  const r = chip.getBoundingClientRect(), w = Math.min(380, innerWidth - 24);
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
