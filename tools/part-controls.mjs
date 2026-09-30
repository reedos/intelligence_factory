import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(process.env.URL || 'http://127.0.0.1:47410/visualizer.html');
  await page.waitForFunction(() => window.ifx?.state.scene === 0);
  await page.evaluate(() => ifx.setTransitions('instant'));
  let checked = 0;
  for (const scene of Array.from({ length: 10 }, (_, i) => i)) for (const mode of ['power', 'data', 'heat']) {
    await page.evaluate(async ({ scene, mode }) => { await ifx.show({ scene, mode, part: null }, { scroll: false }); ifx.settle(); }, { scene, mode });
    const lists = await page.evaluate(() => ({
      menu: [...document.querySelectorAll('#link-view option')].map(o => [o.value, o.textContent]),
      sidebar: [...document.querySelectorAll('#parts button')].map(b => [b.dataset.id || '', `${b.querySelector('.pn').textContent}. ${b.querySelector('.pt').textContent}`]),
    }));
    assert.deepEqual(lists.menu, lists.sidebar, `${scene}.${mode}: menu matches exact part numbers, names and order`);
    const id = lists.menu.at(-1)[0];
    await page.locator('#link-view').selectOption(id);
    assert.equal(await page.evaluate(() => ifx.state.selected), id);
    assert.equal(await page.locator('#parts button[aria-pressed="true"]').getAttribute('data-id'), id);
    await page.locator('#link-view').selectOption('');
    await page.waitForFunction(() => ifx.state.selected === null);
    checked++;
  }
  await page.evaluate(async () => { await ifx.show({ scene: 9, mode: 'data', part: 'aec' }, { scroll: false }); ifx.settle(); });
  await page.locator('#part-cycle').click();
  assert.equal(await page.locator('#part-cycle').getAttribute('aria-pressed'), 'true');
  await page.waitForFunction(() => ifx.state.selected === 'dac', null, { timeout: 14000 });
  assert.equal(await page.evaluate(() => ifx.state.scene), 9);
  assert.equal(await page.locator('#link-view').inputValue(), 'dac');
  await page.locator('#link-view').selectOption('acc');
  assert.equal(await page.locator('#part-cycle').getAttribute('aria-pressed'), 'false');
  await page.locator('#part-cycle').click();
  await page.getByRole('button', { name: 'Heat', exact: true }).click();
  assert.equal(await page.locator('#part-cycle').getAttribute('aria-pressed'), 'false');
  await page.locator('#part-cycle').click();
  await page.locator('#part-cycle').click();
  assert.equal(await page.locator('#part-cycle').getAttribute('aria-pressed'), 'false');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(async () => { await ifx.show({ scene: 6, mode: 'data', part: null }, { scroll: false }); ifx.settle(); });
  await page.getByRole('button', { name: 'LPO, no DSP', exact: true }).click();
  assert.ok((await page.locator('#link-view').textContent()).includes('DSP footprint, absent in LPO'));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || document.querySelector('.panel-scroll').scrollWidth > document.querySelector('.panel-scroll').clientWidth), false);
  await page.locator('#part-cycle').click();
  await page.waitForFunction(() => ifx.state.selected === 'fingers');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#part-cycle').getAttribute('aria-pressed'), 'false');
  assert.deepEqual(errors, []);
  console.log(`${checked} level/layer menus match the sidebar; playback wraps within the level, pauses on manual changes, and works at 390px.`);
} finally { await browser.close(); }
