// The reference pages (Evidence, Method, Glossary) open in a sheet over the visualizer instead of replacing it, so the
// level, layer, part and scenario on screen are still there when the reader closes it. A plain link still works where
// the reader asks for a new tab (a modified click), and the sheet offers "Open as a page". A link inside the sheet to
// a part in the visualizer closes the sheet and shows that part here (site.js posts it from the embedded page).
import { show } from './stage.js';
import { withScenario } from './scenario-links.js';

const PAGES = { 'evidence.html': 'Evidence', 'method.html': 'Method', 'glossary.html': 'Glossary' };
const sheet = document.createElement('div');
sheet.className = 'page-sheet'; sheet.id = 'page-sheet'; sheet.hidden = true;
sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true'); sheet.setAttribute('aria-labelledby', 'ps-t');
sheet.innerHTML = `<button type="button" class="ps-scrim" tabindex="-1" aria-label="Close"></button>
  <div class="ps-panel">
    <div class="ps-bar"><b id="ps-t">Evidence</b><a class="ps-open" id="ps-open" href="evidence.html" target="_blank" rel="noopener">Open as a page <span aria-hidden="true">↗</span></a><button type="button" class="ps-x" aria-label="Close and go back to the visualizer">×</button></div>
    <iframe id="ps-frame" title="Evidence"></iframe>
  </div>`;
document.body.append(sheet);
const frame = sheet.querySelector('#ps-frame'), title = sheet.querySelector('#ps-t'), openAsPage = sheet.querySelector('#ps-open');
let opener = null;

export function openPage(href) {
  const url = new URL(withScenario(location.search, href), location.href), page = url.pathname.split('/').pop();
  opener = document.activeElement;
  title.textContent = PAGES[page] || 'Reference'; frame.title = title.textContent;
  openAsPage.href = url.pathname.slice(1) + url.search + url.hash;
  url.searchParams.set('embed', '1');
  frame.src = url.href;
  sheet.hidden = false; document.body.classList.add('page-sheet-open');
  sheet.querySelector('.ps-x').focus({ preventScroll: true });
}
export function closePage() {
  if (sheet.hidden) return;
  sheet.hidden = true; document.body.classList.remove('page-sheet-open');
  opener?.focus?.({ preventScroll: true }); opener = null;
}
sheet.querySelector('.ps-x').addEventListener('click', closePage);
sheet.querySelector('.ps-scrim').addEventListener('click', closePage);
addEventListener('keydown', e => { if (e.key === 'Escape' && !sheet.hidden) { e.stopPropagation(); closePage(); } }, true);

// a plain click on a link to a reference page opens it here; ctrl/cmd/shift/middle clicks keep the browser's way
document.addEventListener('click', e => {
  const a = e.target.closest?.('a[href]');
  if (!a || a.closest('#page-sheet') || a.target === '_blank' || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const url = new URL(a.getAttribute('href'), location.href);
  if (url.origin !== location.origin || !PAGES[url.pathname.split('/').pop()]) return;
  e.preventDefault(); e.stopPropagation();
  document.getElementById('topnav')?.classList.remove('open'); document.getElementById('menu-btn')?.setAttribute('aria-expanded', 'false');
  openPage(a.getAttribute('href'));
}, true);

// a part link from inside the sheet: close it and show the part here
addEventListener('message', e => {
  if (e.origin !== location.origin || e.data?.type !== 'ifx-view') return;
  closePage();
  const v = new URLSearchParams(e.data.search || '').get('view'); if (!v) return;
  const [scene, mode, part] = v.split('.');
  if (+scene >= 0 && ['power', 'data', 'heat'].includes(mode)) show({ scene: +scene, mode, part: part || null }, { scroll: false });
});
