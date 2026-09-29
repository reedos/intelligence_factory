// Local prototype controls. Activated only by ?module=original|blender.
import * as stage from './stage.js';
import { store } from './store.js';

const query = new URLSearchParams(location.search), variant = query.get('module');
const box = document.createElement('details');
box.id = 'blender-test';
box.innerHTML = `<summary>Visual test · ${variant === 'blender' ? 'Blender' : 'Original'}</summary>
  <div class="test-body"><p>Same app, controls and tours. Use Matched effects for the original lighting comparison. Representative internals.</p>
  <nav><a data-model="original">Original</a><a data-model="blender">Blender</a></nav>
  <button type="button" id="measure-layers">Measure three layers</button>
  <button type="button" id="measure-current">Measure current view</button>
  <p id="test-status" role="status">Open the module and use the usual controls. Measurements include every render pass.</p>
  <pre id="test-results"></pre></div>`;
const css = document.createElement('style');
css.textContent = `#blender-test{position:fixed;bottom:12px;left:12px;z-index:90;width:min(320px,calc(100vw - 24px));background:#111c29ee;border:1px solid #668494;border-radius:8px;color:#e4eff5;font:12px/1.45 system-ui;box-shadow:0 5px 20px #0006}#blender-test summary{cursor:pointer;padding:9px 12px}#blender-test .test-body{padding:0 12px 10px;max-height:40vh;overflow:auto}#blender-test p{margin:5px 0 9px}#blender-test nav{display:flex;gap:18px;margin:8px 0}#blender-test a{color:#84dcff;text-decoration:underline;cursor:pointer}#blender-test button{padding:6px 10px;border:1px solid #6c94a5;background:#263f50;color:white;border-radius:4px;cursor:pointer}#blender-test pre{white-space:pre-wrap;overflow-wrap:anywhere;font:10px/1.4 monospace}@media(max-width:600px){#blender-test{bottom:6px;left:6px;width:calc(100vw - 12px)}#blender-test .test-body{max-height:30vh}}`;
document.head.append(css); document.querySelector('.panel-scroll').append(box);
box.style.cssText = 'position:static;width:auto;margin-top:12px;flex:none';
box.querySelectorAll('[data-model]').forEach(a => {
  const url = new URL(location.href); url.searchParams.set('module', a.dataset.model);
  url.searchParams.set('view', '6.data'); a.href = url.href;
});
const status = box.querySelector('#test-status'), results = box.querySelector('#test-results'), button = box.querySelector('button');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const percentile = (a, p) => [...a].sort((x, y) => x - y)[Math.floor((a.length - 1) * p)];
const round = x => Math.round(x * 100) / 100;
box.querySelector('#measure-current').addEventListener('click', async e => {
  const currentButton = e.currentTarget; currentButton.disabled = button.disabled = true;
  status.textContent = 'Measuring this view… keep the tab visible.';
  const scene = store.ui.scene, mode = store.ui.mode;
  try {
    const samples = await new Promise((resolve, reject) => {
      const a = [], timer = setTimeout(() => { off(); reject(new Error('Measurement timed out. Keep this tab visible.')); }, 30000);
      const off = stage.observeFrame(s => {
        if (store.ui.scene !== scene || store.ui.mode !== mode) { off(); clearTimeout(timer); reject(new Error('View changed; run the measurement again.')); return; }
        a.push(s); if (a.length >= 360) { off(); clearTimeout(timer); resolve(a); }
      });
    });
    const mean = samples.reduce((sum, s) => sum + s.dt, 0) / samples.length;
    results.textContent = JSON.stringify({ scene, mode, viewport: [innerWidth, innerHeight], frames: samples.length,
      fps: round(1000 / mean), p95FrameMs: round(percentile(samples.map(s => s.dt), .95)),
      medianCpuMs: round(percentile(samples.map(s => s.cpuMs), .5)),
      medianCallsAllPasses: percentile(samples.map(s => s.calls), .5),
      medianTrianglesAllPasses: percentile(samples.map(s => s.triangles), .5), quality: stage.qualityInfo() }, null, 2);
    status.textContent = 'Complete. This measures this host and viewport, not physical-phone performance.';
  } catch (error) { status.textContent = error.message; }
  finally { currentButton.disabled = button.disabled = false; }
});
button.addEventListener('click', async () => {
  button.disabled = true;
  const report = { variant, finish: query.get('finish') === 'matched' ? 'matched' : variant === 'blender' ? 'studio' : 'original', timestamp: new Date().toISOString(), viewport: [innerWidth, innerHeight], quality: stage.qualityInfo(), layers: [] };
  try {
    for (const mode of ['data', 'power', 'heat']) {
      status.textContent = `Measuring ${mode}… keep this tab visible.`;
      await stage.show({ scene: 6, mode, part: null });
      document.querySelector('[data-variant="dsp"]').click();
      await delay(2500);
      report.viewport = [innerWidth, innerHeight];
      const canvas = stage.getRenderer().domElement, rect = canvas.getBoundingClientRect();
      const frameSize = { viewport: [innerWidth, innerHeight], canvasCss: [round(rect.width), round(rect.height)], drawingBuffer: [canvas.width, canvas.height] };
      const samples = await new Promise((resolve, reject) => {
        const a = [], timer = setTimeout(() => { off(); reject(new Error('Measurement timed out. Keep this tab visible.')); }, 30000);
        const off = stage.observeFrame(s => { a.push(s); if (a.length >= 600) { off(); clearTimeout(timer); resolve(a); } });
      });
      const mean = samples.reduce((sum, s) => sum + s.dt, 0) / samples.length;
      report.layers.push({ mode, ...frameSize, frames: samples.length, meanFrameMs: round(mean), fps: round(1000 / mean),
        p95FrameMs: round(percentile(samples.map(s => s.dt), .95)),
        medianCpuFrameMs: round(percentile(samples.map(s => s.cpuMs), .5)),
        medianCpuSubmitMs: round(percentile(samples.map(s => s.submitMs), .5)),
        medianCallsAllPasses: percentile(samples.map(s => s.calls), .5),
        medianTrianglesAllPasses: percentile(samples.map(s => s.triangles), .5),
        tier: stage.qualityInfo().tiers[6], pixelRatio: stage.renderScale() });
      results.textContent = JSON.stringify(report, null, 2);
    }
    status.textContent = 'Complete. CPU times are submission costs; frame rate may be display-limited. Phone viewport is not a physical phone benchmark.';
    await stage.show({ scene: 6, mode: 'data', part: null });
  } catch (e) { status.textContent = e.message; }
  finally { button.disabled = false; }
});
