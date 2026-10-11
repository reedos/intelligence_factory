import { on, store } from './store.js';
import { setCampusView, setCampusFocus, campusFocusInfo, built, qualityInfo, setQualityPreference, partsFor, select, onTick, isCameraMoving } from './stage.js';
import { createPartCycle } from './part-cycle.js';
import './campus-presentation.css';

const panel = document.createElement('section');
panel.className = 'campus-presentation';
panel.setAttribute('aria-label', 'View controls');
panel.innerHTML = `<button type="button" id="link-annotations" aria-pressed="false" hidden>Annotations</button>
  <button type="button" id="link-covers" aria-pressed="false" hidden>Show covers</button>`;
document.getElementById('viewer').append(panel);
// the view's occasional controls (the campus views, soft focus, Auto cycle) live in the More menu at every size, so
// under the view a desktop shows only Previous/Next and the covers and annotations a level offers
const extras = document.createElement('div');
extras.className = 'campus-presentation view-extras';
extras.innerHTML = `<div class="campus-view-buttons" role="group" aria-label="Campus views">
    <button type="button" data-campus-view="campus">Campus vista</button>
    <button type="button" data-campus-view="infrastructure">Infrastructure</button>
    <button type="button" data-campus-view="arrival">Arrival</button>
  </div>
  <button type="button" id="campus-focus" aria-pressed="true" aria-describedby="campus-focus-note">Soft focus</button>
  <span id="campus-focus-note" class="view-sr-only">Gentle depth of field; labels stay crisp.</span>
  <button type="button" id="part-cycle" aria-pressed="false" title="Cycle through this level's parts in order. Each part holds for 8 seconds after the camera arrives.">▶ Auto cycle</button>`;
document.getElementById('mm-view').append(extras);
// Share, quality, Present and Hide details live in the one menu at the end of the top row (visualizer.html), at every
// size (round-3 review: fewer controls over the view)
document.getElementById('mm-tools').insertAdjacentHTML('beforeend', `<label class="mm-select"><span>Rendering</span><select id="render-quality"><option value="max" title="Every effect on at every level; never lowers quality to keep frames smooth">Max quality</option><option value="auto">Auto quality</option><option value="laptop" title="Turns off reflections, ambient occlusion, depth of field and anti-aliasing to keep the GPU cool and save battery">Battery saver</option></select></label>
  <button type="button" class="mm-item" id="inspector-toggle" aria-expanded="true" aria-controls="inspector">Hide details</button>`);
// On tablets and phones the view's own controls join that menu too, so no control row sits between the view and the
// side pane; on a desktop they stay in a row under the view.
const inMenu = matchMedia('(max-width: 1100px)');
// Previous/next part stay in view at every size (Reed, 09/30): under the view on a desktop, and in the side pane's
// tab bar, which never scrolls away, where the view controls fold into the menu
const partNav = document.querySelector('.card-navigation');
partNav.classList.add('part-nav');
// A level's own toggles (Annotations, the covers) sit with its variant toggles at the view's top left on a desktop, so
// every level puts its extras in one place and the row under the view holds Previous/Next alone; in the menu below that
const annotationsBtn = panel.querySelector('#link-annotations'), coversBtn = panel.querySelector('#link-covers');
const viewToggles = document.createElement('div');
viewToggles.className = 'mode variant view-toggles'; viewToggles.setAttribute('role', 'group'); viewToggles.setAttribute('aria-label', 'This view');
const place = () => {
  if (inMenu.matches) { document.getElementById('mm-view').append(panel); panel.append(annotationsBtn, coversBtn); document.querySelector('.pane-tabs').append(partNav); }
  else { document.getElementById('viewer').append(panel); panel.prepend(partNav); viewToggles.append(annotationsBtn, coversBtn); document.querySelector('.hud.vl')?.append(viewToggles); }
};
inMenu.addEventListener('change', place); place();
const scope = document.createElement('section'); scope.className = 'link-scope'; scope.hidden = true;
const scopeBrief = document.createElement('p');
const scopeDetails = document.createElement('details');
const scopeSummary = document.createElement('summary'); scopeSummary.textContent = 'Model boundaries and scale';
const scopeText = document.createElement('p');
scopeDetails.append(scopeSummary, scopeText); scope.append(scopeBrief, scopeDetails);
document.getElementById('intro').before(scope);
document.querySelector('.panel').id = 'inspector';
const details = document.getElementById('inspector-toggle');
const launch = document.createElement('button');
launch.type = 'button';
launch.textContent = 'Present'; launch.setAttribute('aria-pressed', 'false');
launch.className = 'mm-item present-launch'; document.getElementById('mm-tools').prepend(launch);
let previousCollapsed = false;
function collapseInspector(collapsed) {
  document.body.classList.toggle('inspector-collapsed', collapsed);
  details.setAttribute('aria-expanded', String(!collapsed));
  details.textContent = collapsed ? 'Show details' : 'Hide details';
}
function setPresentation(enabled) {
  if (enabled) previousCollapsed = document.body.classList.contains('inspector-collapsed');
  document.body.classList.toggle('presentation-view', enabled);
  launch.textContent = enabled ? 'Exit presentation' : 'Present'; launch.setAttribute('aria-pressed', String(enabled));
  collapseInspector(enabled || previousCollapsed);
}
launch.addEventListener('click', () => setPresentation(!document.body.classList.contains('presentation-view')));
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
const focusButton = extras.querySelector('#campus-focus');
const currentParts = () => store.ui.scene < 0 ? [] : partsFor(store.ui.scene);
const cycleButton = extras.querySelector('#part-cycle');
function syncCycle() {
  cycleButton.textContent = partCycle.playing ? 'Ⅱ Pause cycle' : '▶ Auto cycle';
  cycleButton.setAttribute('aria-pressed', String(partCycle.playing));
  cycleButton.disabled = currentParts().length < 2;
}
const partCycle = createPartCycle({
  parts: () => currentParts().map(p => p.id),
  selected: () => store.ui.selected,
  select: id => select(id, true),
  ready: () => !document.hidden && !isCameraMoving() && document.getElementById('src-pop')?.hidden !== false,
  changed: syncCycle,
});
cycleButton.addEventListener('click', () => partCycle.toggle());
onTick(dt => partCycle.tick(dt));
for (const event of ['scene', 'mode', 'scenario', 'module-variant', 'user-camera']) on(event, () => partCycle.stop());
on('select', () => { if (!partCycle.selecting) partCycle.stop(); });
addEventListener('keydown', event => { if (event.key === 'Escape' && partCycle.playing) partCycle.stop(); });
// opening the Scenario tab ends a running Auto cycle: left running it keeps stepping through the parts and pulls the
// camera into one (the tab itself selects nothing)
document.querySelector('[data-pane="scenario"]')?.addEventListener('click', () => partCycle.stop());
document.getElementById('render-quality').addEventListener('change', e => setQualityPreference(e.target.value));
function sync() {
  document.getElementById('render-quality').value = qualityInfo().preference;
  const inspection = built[store.ui.scene]?.inspection;
  scope.hidden = !inspection?.scope;
  scopeText.textContent = inspection?.scope || '';
  scopeBrief.textContent = store.ui.scene === 8
    ? 'Discrete driver and TIA packages, separate from the optical assemblies. Representative board-level design.'
    : store.ui.scene === 7
      ? 'Representative package with a separate enlarged engine detail. X-ray layers reveal buried routes.'
      : 'Representative plug ends and internal routing. Moving marks explain flow, not speed or watts.';
  if (scope.dataset.scene !== String(store.ui.scene)) { scopeDetails.open = false; scope.dataset.scene = String(store.ui.scene); }
  syncCycle();
  const annotations = annotationsBtn, covers = coversBtn;
  annotations.hidden = !inspection;
  annotations.setAttribute('aria-pressed', String(!!inspection?.annotations));
  covers.hidden = !inspection?.hasCovers || !!inspection?.coversAlwaysVisible;
  const thermal = !!inspection?.coversForced;
  covers.disabled = thermal;
  const coverLabel = inspection?.coverLabel || 'covers';
  covers.textContent = thermal ? `${coverLabel === 'covers' ? 'Thermal covers' : 'Cold plate'} shown` : `${inspection?.covers ? 'Hide' : 'Show'} ${coverLabel}`;
  covers.setAttribute('aria-pressed', String(thermal || !!inspection?.covers));
  viewToggles.hidden = annotations.hidden && covers.hidden;
  const campus = store.ui.scene === 1;
  extras.querySelector('.campus-view-buttons').hidden = !campus;
  focusButton.hidden = !campus;
  extras.querySelector('#campus-focus-note').hidden = !campus;
  const info = campusFocusInfo();
  focusButton.disabled = !info.available;
  focusButton.setAttribute('aria-pressed', String(info.enabled && info.available));
  extras.querySelector('#campus-focus-note').textContent = !info.available
    ? 'Soft focus is off at this rendering quality.'
    : info.enabled ? 'Gentle depth of field; labels stay crisp.' : 'Full scene in focus.';
  focusButton.title = extras.querySelector('#campus-focus-note').textContent;
}
extras.querySelectorAll('[data-campus-view]').forEach(button => button.addEventListener('click', () => setCampusView(button.dataset.campusView)));
focusButton.addEventListener('click', () => { setCampusFocus(!campusFocusInfo().enabled); sync(); });
annotationsBtn.addEventListener('click', () => {
  const api = built[store.ui.scene]?.inspection; api?.setAnnotations(!api.annotations); sync();
});
coversBtn.addEventListener('click', () => {
  const api = built[store.ui.scene]?.inspection; api?.setCovers(!api.covers); sync();
});
for (const event of ['scene', 'scenario', 'mode', 'module-variant', 'select', 'campus-presentation', 'render-quality']) on(event, sync);
sync();
