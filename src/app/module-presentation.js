// Presentation controls for the isolated Blender prototype. The scene owns all geometry and motion.
import * as stage from './stage.js';
import { store, on } from './store.js';
import './module-presentation.css';

const query = new URLSearchParams(location.search);
if (query.get('module') === 'blender') installModulePresentation();

export function installModulePresentation() {
  if (document.getElementById('module-presentation')) return;
  const intro = document.getElementById('intro');
  if (!intro) return;

  const matched = query.get('finish') === 'matched';
  const card = document.createElement('details');
  card.id = 'module-presentation';
  card.open = matchMedia('(min-width: 1101px)').matches;
  card.hidden = true;
  card.innerHTML = `
    <summary><span class="mp-heading"><span class="mp-eyebrow">Module close-up</span><span class="mp-title">Presentation</span></span><span class="mp-finish">${matched ? 'Matched' : 'Studio'}</span><span class="mp-chevron" aria-hidden="true"></span></summary>
    <div class="mp-body">
      <nav class="mp-segment" aria-label="Module lighting">
        <a data-finish="studio" ${matched ? '' : 'aria-current="true"'}>Studio</a>
        <a data-finish="matched" ${matched ? 'aria-current="true"' : ''}>Matched effects</a>
      </nav>
      <p class="mp-caption">${matched ? 'Original app effects for a visual comparison.' : 'Clean studio lighting with brighter animated signals.'}</p>
      <div class="mp-assembly-head"><label for="module-explode">Assembly</label><output for="module-explode" id="module-explode-value">Exploded</output></div>
      <input id="module-explode" type="range" min="0" max="100" step="1" value="100" aria-describedby="module-assembly-note">
      <div class="mp-endpoints" role="group" aria-label="Assembly position"><button type="button" data-explode="0">Assembled</button><button type="button" data-explode="1">Exploded</button></div>
      <p class="mp-caption mp-assembly-note" id="module-assembly-note">Follow the data, power and heat overlays in the exploded view.</p>
      <div class="mp-views" role="group" aria-label="Module camera views"><button type="button" data-view="overview">Overview <span aria-hidden="true">↗</span></button><button type="button" data-view="optics">Optical detail <span aria-hidden="true">↗</span></button></div>
      <p class="mp-scope">Representative internals and RF routing, not a validated 200G package design. Separation reveals the parts; the display gaps are not physical. Moving markers explain flow, not propagation speed.</p>
    </div>`;
  intro.before(card);
  const paths = document.createElement('section');
  paths.className = 'mp-signal-paths';
  paths.setAttribute('aria-label', 'Module signal directions');
  paths.innerHTML = `
    <p><strong class="mp-tx">Transmit (TX)</strong> Host electrical signal → module → light out to fiber</p>
    <p><strong class="mp-rx">Receive (RX)</strong> Light from fiber → module → electrical signal to host</p>
    <p class="mp-caption">The edge connector carries electrical signals. The fiber connectors carry light.</p>`;
  card.after(paths);

  const range = card.querySelector('#module-explode');
  const output = card.querySelector('#module-explode-value');
  const note = card.querySelector('#module-assembly-note');
  const presentation = () => stage.built[6]?.presentation;
  function sync() {
    card.hidden = store.ui.scene !== 6;
    paths.hidden = store.ui.scene !== 6 || store.ui.mode !== 'data';
    const api = presentation();
    const fraction = Math.max(0, Math.min(1, api?.explode ?? 1));
    range.disabled = !api;
    range.value = String(Math.round(fraction * 100));
    output.value = fraction === 0 ? 'Assembled' : fraction === 1 ? 'Exploded' : `${Math.round(fraction * 100)}% open`;
    range.setAttribute('aria-valuetext', output.value);
    card.querySelectorAll('[data-explode]').forEach(button => {
      button.disabled = !api;
      button.setAttribute('aria-pressed', String(fraction === Number(button.dataset.explode)));
    });
    note.textContent = fraction < 1
      ? 'Inspect the exterior or separation. Fully explode the module to follow the overlays.'
      : 'Follow the data, power and heat overlays in the exploded view.';
  }
  function explode(fraction, options) {
    stage.setModuleExplode(fraction, options);
    sync();
  }
  range.addEventListener('input', () => explode(Number(range.value) / 100, { frame: false }));
  range.addEventListener('change', () => explode(Number(range.value) / 100));
  card.querySelectorAll('[data-explode]').forEach(button => {
    button.addEventListener('click', () => explode(Number(button.dataset.explode)));
  });
  card.querySelectorAll('[data-finish]').forEach(link => {
    // Preserve the current module part and layer when switching the renderer treatment.
    const updateUrl = () => {
      const url = new URL(location.href);
      if (link.dataset.finish === 'matched') url.searchParams.set('finish', 'matched');
      else url.searchParams.delete('finish');
      link.href = url.href;
    };
    updateUrl();
    link.addEventListener('pointerdown', updateUrl);
    link.addEventListener('focus', updateUrl);
  });
  card.querySelectorAll('[data-view]').forEach(button => {
    button.addEventListener('click', async () => {
      const optics = button.dataset.view === 'optics';
      if (optics) explode(1);
      await stage.show({ scene: 6, mode: optics ? 'data' : store.ui.mode, part: optics ? 'mzm' : null });
      sync();
    });
  });
  for (const event of ['scene', 'mode', 'select', 'scenario', 'module-presentation']) on(event, sync);
  sync();
}
