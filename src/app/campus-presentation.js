import { on, store } from './store.js';
import { setCampusView, setCampusFocus, campusFocusInfo, setInspectionView, built } from './stage.js';
import './campus-presentation.css';

const panel = document.createElement('section');
panel.className = 'campus-presentation';
panel.setAttribute('aria-label', 'View controls');
panel.innerHTML = `<div class="campus-view-buttons" role="group" aria-label="Campus views">
    <button type="button" data-campus-view="campus">Campus vista</button>
    <button type="button" data-campus-view="infrastructure">Infrastructure</button>
    <button type="button" data-campus-view="arrival">Arrival</button>
  </div>
  <button type="button" id="campus-focus" aria-pressed="true" aria-describedby="campus-focus-note">Soft focus</button>
  <span id="campus-focus-note" class="view-sr-only">Gentle depth of field; labels stay crisp.</span>
  <button type="button" id="link-annotations" aria-pressed="false" hidden>Annotations</button>
  <select id="link-view" aria-label="Closeup camera view" hidden></select>
  <button type="button" id="link-covers" aria-pressed="false" hidden>Show covers</button>
  <div class="view-tools"><button type="button" id="presentation-view" aria-pressed="false">Present</button>
  <button type="button" id="inspector-toggle" aria-expanded="true" aria-controls="inspector">Hide details</button></div>`;
document.getElementById('viewer').append(panel);
const scope = document.createElement('section'); scope.className = 'link-scope'; scope.hidden = true;
const scopeBrief = document.createElement('p');
const scopeDetails = document.createElement('details');
const scopeSummary = document.createElement('summary'); scopeSummary.textContent = 'Model boundaries and scale';
const scopeText = document.createElement('p');
scopeDetails.append(scopeSummary, scopeText); scope.append(scopeBrief, scopeDetails);
document.getElementById('intro').before(scope);
document.querySelector('.panel').id = 'inspector';
const details = panel.querySelector('#inspector-toggle');
const present = panel.querySelector('#presentation-view');
let previousCollapsed = false;
function collapseInspector(collapsed) {
  document.body.classList.toggle('inspector-collapsed', collapsed);
  details.setAttribute('aria-expanded', String(!collapsed));
  details.textContent = collapsed ? 'Show details' : 'Hide details';
}
function setPresentation(enabled) {
  if (enabled) previousCollapsed = document.body.classList.contains('inspector-collapsed');
  document.body.classList.toggle('presentation-view', enabled);
  present.setAttribute('aria-pressed', String(enabled));
  present.textContent = enabled ? 'Exit presentation' : 'Present';
  collapseInspector(enabled || previousCollapsed);
}
present.addEventListener('click', () => setPresentation(!document.body.classList.contains('presentation-view')));
details.addEventListener('click', () => collapseInspector(!document.body.classList.contains('inspector-collapsed')));
addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.classList.contains('presentation-view')) setPresentation(false); });
new MutationObserver(() => {
  if (document.body.classList.contains('story') && document.body.classList.contains('presentation-view')) {
    setPresentation(false); collapseInspector(false);
  }
}).observe(document.body, { attributes: true, attributeFilter: ['class'] });
on('select', () => {
  if (document.body.classList.contains('presentation-view')) return;
  const wasCollapsed = document.body.classList.contains('inspector-collapsed');
  collapseInspector(false);
  if (wasCollapsed) requestAnimationFrame(() => {
    const scroller = document.querySelector('.panel-scroll'), card = document.getElementById('card');
    if (card && !card.hidden) scroller.scrollTop += card.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 12;
  });
});
const focusButton = panel.querySelector('#campus-focus');
function sync() {
  const inspection = built[store.ui.scene]?.inspection;
  scope.hidden = !inspection?.scope;
  scopeText.textContent = inspection?.scope || '';
  scopeBrief.textContent = store.ui.scene === 8
    ? 'One packaging example. Driver and TIA chips may also be separate from the optics.'
    : store.ui.scene === 7
      ? 'Representative package with a separate 2.5× engine detail. X-ray layers reveal buried routes.'
      : 'Representative plug ends and internal routing. Moving marks explain flow, not speed or watts.';
  if (scope.dataset.scene !== String(store.ui.scene)) { scopeDetails.open = false; scope.dataset.scene = String(store.ui.scene); }
  const viewSelect = panel.querySelector('#link-view');
  viewSelect.hidden = !inspection?.views;
  const viewKey = `${store.ui.scene}:${Object.keys(inspection?.views || {}).join(',')}`;
  if (viewSelect.dataset.scene !== viewKey) {
    const selectedPart = new Option('Selected part', ''); selectedPart.disabled = true;
    const custom = new Option('Custom view', 'custom'); custom.disabled = true;
    viewSelect.replaceChildren(selectedPart, custom, ...Object.entries(inspection?.views || {}).map(([key, view]) => new Option(view.label, key)));
    viewSelect.dataset.scene = viewKey;
  }
  viewSelect.value = inspection?.currentView ?? 'diagram';
  const annotations = panel.querySelector('#link-annotations'), covers = panel.querySelector('#link-covers');
  annotations.hidden = !inspection;
  annotations.setAttribute('aria-pressed', String(!!inspection?.annotations));
  covers.hidden = !inspection?.hasCovers;
  const thermal = !!inspection?.coversForced;
  covers.disabled = thermal;
  const coverLabel = inspection?.coverLabel || 'covers';
  covers.textContent = thermal ? `${coverLabel === 'covers' ? 'Thermal covers' : 'Cold plate'} shown` : `${inspection?.covers ? 'Hide' : 'Show'} ${coverLabel}`;
  covers.setAttribute('aria-pressed', String(thermal || !!inspection?.covers));
  const campus = store.ui.scene === 1;
  panel.querySelector('.campus-view-buttons').hidden = !campus;
  focusButton.hidden = !campus;
  panel.querySelector('#campus-focus-note').hidden = !campus;
  const info = campusFocusInfo();
  focusButton.disabled = !info.available;
  focusButton.setAttribute('aria-pressed', String(info.enabled && info.available));
  panel.querySelector('#campus-focus-note').textContent = !info.available
    ? 'Soft focus is off at this rendering quality.'
    : info.enabled ? 'Gentle depth of field; labels stay crisp.' : 'Full scene in focus.';
  focusButton.title = panel.querySelector('#campus-focus-note').textContent;
}
panel.querySelectorAll('[data-campus-view]').forEach(button => button.addEventListener('click', () => setCampusView(button.dataset.campusView)));
focusButton.addEventListener('click', () => { setCampusFocus(!campusFocusInfo().enabled); sync(); });
panel.querySelector('#link-annotations').addEventListener('click', () => {
  const api = built[store.ui.scene]?.inspection; api?.setAnnotations(!api.annotations); sync();
});
panel.querySelector('#link-covers').addEventListener('click', () => {
  const api = built[store.ui.scene]?.inspection; api?.setCovers(!api.covers); sync();
});
panel.querySelector('#link-view').addEventListener('change', event => setInspectionView(event.target.value));
for (const event of ['scene', 'scenario', 'mode', 'select', 'campus-presentation', 'render-quality']) on(event, sync);
sync();
