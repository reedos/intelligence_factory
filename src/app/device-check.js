// Optional, local-only measurement on the device actually displaying this page.
import { observeFrame, qualityInfo, renderScale, getRenderer, isBusy } from './stage.js';
import { store, on } from './store.js';
import './device-check.css';

const box = document.createElement('details');
box.id = 'device-check';
box.open = true;
box.innerHTML = `<summary>Device check · 30 seconds</summary>
  <div class="device-check-body">
    <p>This measures the device running this page. A phone-sized desktop window does not measure a phone. No results are uploaded.</p>
    <p>Choose a scene, stop any tour, and let the view settle. Keep this tab visible during the check. You may orbit and zoom; changing scene, layer, or scenario cancels the run.</p>
    <div class="device-check-actions"><button type="button" data-run>Run current view</button><button type="button" data-cancel disabled>Cancel</button></div>
    <p data-status role="status">Ready. Run on your phone to measure your phone.</p>
    <label>Device / browser and observations<textarea data-notes rows="2" placeholder="e.g. iPhone, Safari; smooth orbit; mild warmth"></textarea></label>
    <fieldset><legend>Check manually after the run</legend>
      <label><input type="checkbox" data-check="Orbit and pinch zoom respond smoothly"> Orbit and pinch zoom</label>
      <label><input type="checkbox" data-check="Part selection and source cards are usable"> Select parts and open sources</label>
      <label><input type="checkbox" data-check="Door entry and Back out return correctly"> Enter a close-up and Back out</label>
      <label><input type="checkbox" data-check="Tours and layers remain usable"> Tours and layers</label>
      <label><input type="checkbox" data-check="Device warmth checked manually and recorded in notes"> Note device warmth manually</label>
    </fieldset>
    <p>Browser timing does not measure temperature or battery draw. Check warmth yourself; a 30-second run does not establish sustained performance.</p>
    <label>Local report<textarea data-report rows="9" readonly placeholder="The report appears after a completed run."></textarea></label>
    <button type="button" data-copy disabled>Copy report</button>
  </div>`;
document.querySelector('.panel-scroll').prepend(box);
const run = box.querySelector('[data-run]'), cancel = box.querySelector('[data-cancel]');
const status = box.querySelector('[data-status]'), report = box.querySelector('[data-report]');
const copy = box.querySelector('[data-copy]'), notes = box.querySelector('[data-notes]');
let abort = null, measurement = null;
const round = n => Math.round(n * 100) / 100;
const percentile = (sorted, p) => sorted[Math.floor((sorted.length - 1) * p)];
const dimensions = () => {
  const canvas = getRenderer().domElement, rect = canvas.getBoundingClientRect();
  return { viewportCss: [innerWidth, innerHeight], canvasCss: [round(rect.width), round(rect.height)], drawingBuffer: [canvas.width, canvas.height], devicePixelRatio };
};
const quality = () => {
  const q = qualityInfo();
  return { tier: q.tiers[store.ui.scene], pixelRatio: renderScale(), composerRatio: q.composerRatio, governing: q.governing };
};
function updateReport() {
  if (!measurement) return;
  report.value = JSON.stringify({ ...measurement, notes: notes.value.trim(), manualChecks: [...box.querySelectorAll('[data-check]')].map(el => ({ check: el.dataset.check, checked: el.checked })) }, null, 2);
}
notes.addEventListener('input', updateReport);
box.querySelectorAll('[data-check]').forEach(el => el.addEventListener('change', updateReport));
cancel.addEventListener('click', () => abort?.('Canceled. You can run the check again.'));
run.addEventListener('click', async () => {
  if (document.hidden || isBusy() || store.ui.scene < 0) { status.textContent = 'Wait for the scene to finish opening and keep this tab visible.'; return; }
  run.disabled = true; cancel.disabled = false; copy.disabled = true;
  measurement = null; report.value = '';
  box.querySelectorAll('[data-check]').forEach(el => { el.checked = false; });
  const scene = store.ui.scene, mode = store.ui.mode, startSize = dimensions();
  const initialQuality = quality(), startedAt = performance.now(), qualityChanges = [];
  let previousQuality = JSON.stringify(initialQuality);
  status.textContent = 'Measuring for 30 seconds. Keep this tab visible.';
  try {
    const samples = await new Promise((resolve, reject) => {
      const samples = [], cleanups = [];
      let done = false, lastSecond = -1;
      const finish = message => {
        if (done) return;
        done = true; cleanups.forEach(fn => fn()); abort = null;
        if (message) reject(new Error(message));
        else if (samples.length < 2) reject(new Error('No usable frame samples. Keep the 3D view visible and try again.'));
        else resolve(samples);
      };
      abort = message => finish(message);
      const hidden = () => { if (document.hidden) finish('Tab became hidden; measurement canceled. Run again with this tab visible.'); };
      document.addEventListener('visibilitychange', hidden);
      cleanups.push(() => document.removeEventListener('visibilitychange', hidden));
      for (const event of ['scene', 'mode', 'scenario']) cleanups.push(on(event, () => finish('Scene, layer, or scenario changed; measurement canceled. Run again in the new view.')));
      cleanups.push(observeFrame(sample => {
        if (isBusy() || scene !== store.ui.scene || mode !== store.ui.mode) { finish('View changed; measurement canceled. Wait for it to settle and run again.'); return; }
        const elapsed = performance.now() - startedAt;
        // Discard the first interval: it started before this measurement.
        if (samples.length || elapsed > sample.dt) samples.push(sample);
        const q = quality(), signature = JSON.stringify(q);
        if (signature !== previousQuality) { qualityChanges.push({ elapsedSeconds: round(elapsed / 1000), ...q }); previousQuality = signature; }
        const second = Math.floor(elapsed / 1000);
        if (second !== lastSecond) { status.textContent = `Measuring… ${Math.min(second, 30)} / 30 seconds. Keep this tab visible.`; lastSecond = second; }
      }));
      const timer = setTimeout(() => finish(), 30000);
      cleanups.push(() => clearTimeout(timer));
    });
    const intervals = samples.map(s => s.dt).sort((a, b) => a - b);
    const mean = intervals.reduce((sum, dt) => sum + dt, 0) / intervals.length;
    measurement = {
      measuredAt: new Date().toLocaleString('en-US'), scene, mode, elapsedSeconds: round((performance.now() - startedAt) / 1000), sampleCount: samples.length,
      frameIntervalMs: { p50: round(percentile(intervals, .5)), p95: round(percentile(intervals, .95)), mean: round(mean) },
      averageFps: round(1000 / mean), startSize, endSize: dimensions(), initialQuality, finalQuality: quality(), qualityChanges,
      browser: navigator.userAgent,
      limitations: 'Current device and view only; timing may be display-limited. Viewport emulation is not a physical-phone test. No temperature or battery measurement; no sustained-performance claim.',
    };
    updateReport(); copy.disabled = false;
    status.textContent = 'Complete. Add your device and manual observations, then copy or select the local report.';
  } catch (error) { status.textContent = error instanceof Error ? error.message : 'Measurement failed. You can run it again.'; }
  finally { abort = null; run.disabled = false; cancel.disabled = true; }
});
copy.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(report.value); status.textContent = 'Report copied.'; }
  catch { report.focus(); report.select(); status.textContent = 'Report selected. Use your browser’s Copy command.'; }
});
