import { on, store } from './store.js';
import { setCampusView, setCampusFocus, campusFocusInfo, built, qualityInfo, setQualityPreference, partsFor, select, show, onTick, isCameraMoving, controls } from './stage.js';
import { createPartCycle } from './part-cycle.js';
import { createIdleAttract } from './idle-attract.js';
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
  <label class="view-part" hidden><span>Part</span><select id="link-view" aria-label="Selected part"></select></label>
  <button type="button" id="part-cycle" aria-pressed="false" title="Cycle through this level's parts in order. Each part holds for 8 seconds after the camera arrives.">▶ Auto cycle</button>
  <button type="button" id="link-covers" aria-pressed="false" hidden>Show covers</button>`;
document.getElementById('viewer').append(panel);
// Share, quality, Present and Hide details live in the one menu at the end of the top row (visualizer.html)
document.getElementById('mm-tools').insertAdjacentHTML('beforeend', `<label class="mm-select"><span>Rendering</span><select id="render-quality"><option value="max" title="Every effect on at every level; never lowers quality to keep frames smooth">Max quality</option><option value="auto">Auto quality</option><option value="laptop" title="Turns off reflections, ambient occlusion, depth of field and anti-aliasing to keep the GPU cool and save battery">Battery saver</option></select></label>
  <button type="button" class="mm-item" id="presentation-view" aria-pressed="false">Present</button>
  <button type="button" class="mm-item" id="inspector-toggle" aria-expanded="true" aria-controls="inspector">Hide details</button>`);
// On tablets and phones the view's own controls join that menu too, so no control row sits between the view and the
// side pane; on a desktop they stay in a row under the view.
const inMenu = matchMedia('(max-width: 1100px)');
// Previous/next part stay in view at every size (Reed, 09/30): beside Auto cycle on a desktop, and in the side pane's
// tab bar, which never scrolls away, where the view controls fold into the menu
const partNav = document.querySelector('.card-navigation');
partNav.classList.add('part-nav');
const place = () => {
  if (inMenu.matches) { document.getElementById('mm-view').append(panel); document.querySelector('.pane-tabs').append(partNav); }
  else { document.getElementById('viewer').append(panel); document.getElementById('part-cycle').before(partNav); }
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
const present = document.getElementById('presentation-view');
const launch = document.createElement('button');
launch.type = 'button'; launch.className = 'present-launch';
launch.textContent = 'Present'; launch.setAttribute('aria-pressed', 'false');
document.getElementById('view').append(launch);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const idleAttract = createIdleAttract({
  enter: () => { setPresentation(true); controls.autoRotateSpeed = 0.3; controls.autoRotate = true; },
  leave: () => { controls.autoRotate = false; setPresentation(false); },
});
const stopAttract = idleAttract.reset;
for (const event of ['pointerdown', 'pointermove', 'wheel', 'keydown']) addEventListener(event, stopAttract, { capture: true, passive: true });
reducedMotion.addEventListener('change', stopAttract);
document.addEventListener('visibilitychange', stopAttract);
onTick(dt => {
  idleAttract.tick(dt, !reducedMotion.matches && !document.hidden && store.ui.scene === 0 && !isCameraMoving());
});
on('scene', () => { if (store.ui.scene !== 0) stopAttract(); });
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
  launch.textContent = present.textContent; launch.setAttribute('aria-pressed', String(enabled));
  collapseInspector(enabled || previousCollapsed);
}
launch.addEventListener('click', () => setPresentation(!document.body.classList.contains('presentation-view')));
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
const currentParts = () => store.ui.scene < 0 ? [] : partsFor(store.ui.scene);
const cycleButton = panel.querySelector('#part-cycle');
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
  const viewSelect = panel.querySelector('#link-view');
  const parts = currentParts();
  viewSelect.closest('label').hidden = store.ui.scene < 0;
  const viewKey = JSON.stringify([store.ui.scene, store.ui.mode, parts.map(p => [p.id, p.title])]);
  if (viewSelect.dataset.scene !== viewKey) {
    viewSelect.replaceChildren(new Option('0. Overview', ''), ...parts.map((part, i) => new Option(`${i + 1}. ${part.title}`, part.id)));
    viewSelect.dataset.scene = viewKey;
  }
  viewSelect.value = store.ui.selected || '';
  viewSelect.title = viewSelect.selectedOptions[0]?.textContent || 'Selected part';
  syncCycle();
  const annotations = panel.querySelector('#link-annotations'), covers = panel.querySelector('#link-covers');
  annotations.hidden = !inspection;
  annotations.setAttribute('aria-pressed', String(!!inspection?.annotations));
  covers.hidden = !inspection?.hasCovers || !!inspection?.coversAlwaysVisible;
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
panel.querySelector('#link-view').addEventListener('change', event => {
  partCycle.stop();
  if (event.target.value) select(event.target.value, true);
  else show({ scene: store.ui.scene, mode: store.ui.mode, part: null }, { scroll: false });
});
for (const event of ['scene', 'scenario', 'mode', 'module-variant', 'select', 'campus-presentation', 'render-quality']) on(event, sync);
sync();
