// Verify the level-overview control against each real scene, layer, camera and share URL.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ args: process.env.IFX_GATE_GPU === '1'
  ? ['--use-angle=d3d11', '--ignore-gpu-blocklist']
  : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(process.env.URL || 'http://127.0.0.1:47410/visualizer.html');
  await page.waitForFunction(() => window.ifx?.state.scene === 0);
  await page.evaluate(() => ifx.setTransitions('instant'));
  for (const scene of Array.from({ length: 10 }, (_, i) => i)) {
    for (const mode of ['power', 'data', 'heat']) {
      await page.evaluate(async ({ scene, mode }) => {
        await ifx.show({ scene, mode, part: null }, { scroll: false });
        ifx.settle();
      }, { scene, mode });
      const baseline = await page.evaluate(() => ({
        pos: ifx.camera.position.toArray(), target: ifx.controls.target.toArray(),
        intro: document.getElementById('intro').textContent,
        count: document.querySelectorAll('#parts button[data-id]').length,
      }));
      const part = await page.locator('#parts button[data-id]').last().getAttribute('data-id');
      await page.evaluate(part => { ifx.select(part, true); ifx.settle(); }, part);
      await page.locator('#parts button[data-overview]').click();
      await page.waitForFunction(() => ifx.state.selected === null && document.getElementById('card').hidden);
      await page.evaluate(() => ifx.settle());
      await page.waitForFunction(expected => new URL(location.href).searchParams.get('view') === expected, `${scene}.${mode}`);
      const got = await page.evaluate(() => ({
        pos: ifx.camera.position.toArray(), target: ifx.controls.target.toArray(),
        intro: document.getElementById('intro').textContent,
        selected: [...document.querySelectorAll('#parts button[aria-pressed="true"]')].map(b => b.querySelector('.pn').textContent),
        numbers: [...document.querySelectorAll('#parts .pn')].map(el => Number(el.textContent)),
        overflow: document.querySelector('.panel-scroll').scrollWidth > document.querySelector('.panel-scroll').clientWidth,
      }));
      assert.deepEqual(got.selected, ['0']);
      assert.deepEqual(got.numbers, Array.from({ length: baseline.count + 1 }, (_, i) => i));
      assert.equal(got.intro, baseline.intro);
      assert.ok(got.pos.every((v, i) => Math.abs(v - baseline.pos[i]) < 0.001));
      assert.ok(got.target.every((v, i) => Math.abs(v - baseline.target[i]) < 0.001));
      assert.equal(got.overflow, false);
      console.log(`ok scene ${scene} ${mode}: overview, camera, numbering, description, share URL`);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#parts button[data-id]').first().click();
  await page.locator('#parts button[data-overview]').focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => ifx.state.selected === null && document.getElementById('card').hidden);
  assert.equal(await page.locator('#parts button[data-overview]').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.evaluate(() => document.querySelector('.panel-scroll').scrollWidth > document.querySelector('.panel-scroll').clientWidth), false);
  assert.deepEqual(errors, []);
  console.log('ok phone: keyboard activation and no horizontal overflow');
} finally {
  await browser.close();
}
