// Exercise real model bounds and camera selection, including phone card resizing.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.URL || 'http://127.0.0.1:47410/visualizer.html');
  await page.waitForFunction(() => window.ifx?.state.scene === 0);
  await page.evaluate(() => ifx.setTransitions('instant'));
  let checked = 0;
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (const scene of [6, 8, 9]) for (const mode of ['data', 'power', 'heat']) {
      await page.evaluate(async ({ scene, mode }) => { await ifx.show({ scene, mode, part: null }, { scroll: false }); ifx.settle(); }, { scene, mode });
      const parts = await page.locator('#parts button[data-id]').evaluateAll(elements => elements.map(el => el.dataset.id));
      for (const part of [null, ...parts]) {
        if (part) await page.evaluate(part => { ifx.select(part, true); ifx.settle(); }, part);
        await page.waitForTimeout(60);
        const result = await page.evaluate(() => {
          const b = ifx.built[ifx.state.scene], bounds = b.housingBounds, camera = ifx.camera;
          camera.updateMatrixWorld();
          const corners = [];
          for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) corners.push(new ifx.THREE.Vector3(x, y, z).project(camera).toArray());
          const hidden = [];
          b.scene.traverse(o => { if (o.isMesh && o.name.includes('_cover_') && !o.visible) hidden.push(o.name); });
          return { corners, hidden, overflow: document.querySelector('.panel-scroll').scrollWidth > document.querySelector('.panel-scroll').clientWidth };
        });
        const label = `${viewport.width}px ${scene}.${mode}.${part || 'overview'}`;
        assert.deepEqual(result.hidden, [], label);
        assert.equal(result.overflow, false, label);
        for (const [x, y, z] of result.corners) assert.ok(Math.abs(x) < .96 && Math.abs(y) < .96 && z > -1 && z < 1, `${label}: clipped housing ${[x, y, z]}`);
        checked++;
      }
      console.log(`ok ${viewport.width}px scene ${scene} ${mode}: housing and all part views`);
    }
  }
  assert.deepEqual(errors, []);
  console.log(`${checked} complete-housing views passed; no page errors or sidebar overflow.`);
} finally { await browser.close(); }
