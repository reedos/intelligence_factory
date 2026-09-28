// Share links. The address bar always holds the scenario (scenario.js) and the current view: scene, layer and
// selected part as ?view=scene.layer.part. Opening a link with a view jumps straight to it. Share copies the link.
import { store, on } from './store.js';
import { show } from './stage.js';

const $ = id => document.getElementById(id);
const MODES = ['power', 'data', 'heat'];
let timer = 0;
function write() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    const { scene, mode, selected } = store.ui;
    if (scene < 0) return;
    const q = new URLSearchParams(location.search);
    q.set('view', [scene, mode, selected].filter(v => v !== null && v !== undefined).join('.'));
    try { history.replaceState(null, '', `${location.pathname}?${q}${location.hash}`); } catch { /* sandboxed viewers refuse */ }
  }, 250);
}
on('scene', write); on('mode', write); on('select', write); on('scenario', write);

// open a shared view once the first scene is up
const v = new URLSearchParams(location.search).get('view');
if (v) {
  const [scene, mode, part] = v.split('.');
  const s = +scene;
  if (s >= 0 && s <= 9 && MODES.includes(mode)) {
    const wait = setInterval(() => { if (store.ui.scene >= 0) { clearInterval(wait); show({ scene: s, mode, part: part || null }, { scroll: s > 0 || !!part }); } }, 100);
  }
}

// the Share button copies the link and says so
const btn = $('share-btn');
if (window.IFX_ARTIFACT && btn) btn.hidden = true;   // an artifact link carries no query string, so a copied view would not reopen
btn?.addEventListener('click', async () => {
  clearTimeout(timer);
  const { scene, mode, selected } = store.ui, q = new URLSearchParams(location.search);
  q.set('view', [scene, mode, selected].filter(x => x !== null && x !== undefined).join('.'));
  const url = `${location.origin}${location.pathname}?${q}`;
  let ok = false;
  try { await navigator.clipboard.writeText(url); ok = true; } catch { /* no clipboard in this frame */ }
  const toast = $('toast');
  toast.textContent = ok ? 'Link copied: it opens this campus, this scale and this part.' : url;
  toast.hidden = false; toast.classList.toggle('select', !ok);
  clearTimeout(toast._t); toast._t = setTimeout(() => (toast.hidden = true), ok ? 2600 : 9000);
});
