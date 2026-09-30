// Audit the actual selectable parts, including scenario-dependent parts, in the
// current exploration UI. Run desktop and phone without resurrecting old tours.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const failures = [], rows = [], errors = [];
const scenes = (process.env.SCENES || '0,1,2,3,4,5,6,7,8,9').split(',').map(Number);
const generations = (process.env.GENERATIONS || 'gb200').split(',');
const forms = (process.env.FORMS || 'desktop,phone').split(',');
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.URL || 'http://127.0.0.1:47410/visualizer.html');
  await page.waitForFunction(() => window.ifx?.state.scene === 0, null, { timeout: 90000 });
  await page.evaluate(() => ifx.setTransitions('instant'));
  for (const accel of generations) {
    await page.evaluate(accel => ifx.setScenario({ accel }), accel);
    await page.waitForTimeout(1000);
    for (const form of forms) {
      await page.setViewportSize(form === 'phone' ? { width: 390, height: 844 } : { width: 1440, height: 900 });
      for (const scene of scenes) for (const mode of ['power', 'data', 'heat']) {
        await page.evaluate(async link => { await ifx.show(link, { scroll: false }); ifx.settle(); }, { scene, mode, part: null });
        await page.waitForFunction(({scene,mode}) => ifx.state.scene === scene && ifx.state.mode === mode && ifx.built[scene] && document.querySelector('#parts button[data-id]'), {scene,mode});
        const parts = await page.locator('#parts button[data-id]').evaluateAll(buttons => buttons.map(b => b.dataset.id));
        for (const part of parts) {
          await page.evaluate(part => { ifx.select(part, true); ifx.settle(); }, part);
          await page.waitForTimeout(35);
          const result = await page.evaluate(() => {
            const T = ifx.THREE, s = ifx.state, b = ifx.built[s.scene];
            const h = b[({power:'hotspots',data:'dataHotspots',heat:'heatHotspots'})[s.mode]][s.selected];
            const point = new T.Vector3(...h.pos), ndc = point.clone().project(ifx.camera);
            const direction = point.clone().sub(ifx.camera.position), distance = direction.length();
            const ray = new T.Raycaster(ifx.camera.position.clone(), direction.normalize(), 0, distance * .85);
            const solids = [];
            b.scene.traverse(o => {
              if (!o.isMesh || o.isSprite) return;
              for (let p = o; p; p = p.parent) if (!p.visible) return;
              if ((Array.isArray(o.material) ? o.material : [o.material]).some(m => m.visible !== false && m.depthWrite !== false && !(m.transparent && m.opacity < .6))) solids.push(o);
            });
            const hit = ray.intersectObjects(solids, false)[0];
            const pin = document.querySelector(`.pin[data-id="${s.selected}"] .num`), view = document.getElementById('view').getBoundingClientRect();
            const r = pin?.getBoundingClientRect(), covers = [];
            if (!r || Math.abs(ndc.x) > .92 || Math.abs(ndc.y) > .92 || ndc.z >= 1) covers.push('outside frame');
            if (r) for (const selector of ['.hud.tl', '.hud.tr', '#hud-btns', '.hud.br', '.hud.bl']) {
              const el = document.querySelector(selector); if (!el || el.hidden || getComputedStyle(el).display === 'none') continue;
              const c = el.getBoundingClientRect();
              if (c.width && r.left < c.right && r.right > c.left && r.top < c.bottom && r.bottom > c.top) covers.push(selector);
            }
            return { ndc: ndc.toArray(), distance, blocked: hit ? { name: hit.object.name, fraction: hit.distance / distance } : null, covers,
              overflow: document.querySelector('.panel-scroll').scrollWidth > document.querySelector('.panel-scroll').clientWidth,
              viewport: [view.width, view.height] };
          });
          const row = { accel, form, scene, mode, part, ...result }; rows.push(row);
          if (result.blocked || result.covers.length || result.overflow) failures.push(row);
        }
        console.log(`${accel} ${form} ${scene}.${mode}: ${parts.length} views`);
      }
    }
  }
  await fs.writeFile(process.env.REPORT || 'framing-audit.json', JSON.stringify({ rows, failures, errors }, null, 2));
  console.log(JSON.stringify({ checked: rows.length, failures, errors }, null, 2));
  if (failures.length || errors.length) process.exitCode = 1;
} finally { await browser.close(); }
