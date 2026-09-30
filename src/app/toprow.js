// The visualizer's top row: the level picker (phones) and the one "⋯" menu, each a button that opens a panel under
// it. A panel closes on Escape (focus goes back to its button), on a tap outside it, or once one of its choices is
// made. On phones the layer switch joins this row too, so nothing but pins and the scale sit over the view.
const $ = id => document.getElementById(id);
const pops = [['level-pick', 'level-menu'], ['more-btn', 'more-menu']].map(([b, m]) => ({ btn: $(b), menu: $(m) })).filter(p => p.btn && p.menu);

function close(p, { focus = false } = {}) {
  if (p.menu.hidden) return;
  p.menu.hidden = true; p.btn.setAttribute('aria-expanded', 'false');
  if (focus) p.btn.focus({ preventScroll: true });
}
function open(p) {
  pops.forEach(q => q !== p && close(q));
  p.menu.hidden = false; p.btn.setAttribute('aria-expanded', 'true');
  (p.menu.querySelector('[aria-current="step"]') || p.menu.querySelector('button:not([hidden]):not(:disabled), select'))?.focus({ preventScroll: true });
}
export const closeMenus = () => pops.forEach(p => close(p));
for (const p of pops) {
  p.btn.addEventListener('click', () => (p.menu.hidden ? open(p) : close(p)));
  // a choice made: a button pressed or a select changed (the rendering select keeps the menu open for a second look)
  p.menu.addEventListener('click', e => { const b = e.target.closest('button'); if (b && !b.closest('label')) close(p); });
  p.menu.addEventListener('change', e => { if (e.target.id === 'link-view') close(p); });
}
addEventListener('keydown', e => { if (e.key !== 'Escape') return; const p = pops.find(q => !q.menu.hidden); if (p) { e.stopPropagation(); close(p, { focus: true }); } }, true);
document.addEventListener('pointerdown', e => { for (const p of pops) if (!p.menu.hidden && !p.menu.contains(e.target) && !p.btn.contains(e.target)) close(p); }, true);

// phones: the layer switch moves from over the view into the top row
const phone = matchMedia('(max-width: 760px)');
const layers = document.querySelector('.hud.tr .mode'), home = document.querySelector('.hud.tr'), slot = $('mode-slot');
function placeLayers() { if (!layers || !slot || !home) return; if (phone.matches) slot.append(layers); else home.prepend(layers); }
phone.addEventListener('change', placeLayers); placeLayers();
