// Verify cinematic approaches, rapid reselection, named presets and resize on
// the rendered application. Housing/detail geometry is checked by housings.mjs.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(process.env.URL || 'http://127.0.0.1:47410/visualizer.html');
  await page.waitForFunction(() => window.ifx?.state.scene === 0);
  await page.evaluate(() => ifx.setTransitions('instant'));
  for (const [scene, first, next] of [[6, 'dsp', 'tia'], [8, 'driver', 'tia'], [9, 'acc', 'aec']]) {
    await page.evaluate(async scene => { await ifx.show({ scene, mode: 'data', part: null }, { scroll: false }); ifx.settle(); }, scene);
    const motion = await page.evaluate(async part => {
      const samples = [], start = performance.now();
      ifx.select(part, true);
      await new Promise(resolve => {
        const tick = () => {
          samples.push({ t: performance.now() - start, pos: ifx.camera.position.toArray(), target: ifx.controls.target.toArray() });
          if (performance.now() - start < 2700) requestAnimationFrame(tick); else resolve();
        };
        requestAnimationFrame(tick);
      });
      return samples;
    }, first);
    const distance = s => Math.hypot(...s.pos.map((v, i) => v - s.target[i]));
    assert.ok(motion.length > 12, 'motion must render intermediate frames');
    assert.ok(motion.every(s => [...s.pos, ...s.target].every(Number.isFinite)), 'finite camera motion');
    assert.ok(distance(motion.at(-1)) < distance(motion[0]) * .65, 'approach must close in');
    const start = motion[0].pos, end = motion.at(-1).pos, line = end.map((v, i) => v - start[i]);
    const lengthSquared = line.reduce((s, v) => s + v * v, 0);
    const deviation = Math.max(...motion.map(s => {
      const delta = s.pos.map((v, i) => v - start[i]), t = delta.reduce((sum, v, i) => sum + v * line[i], 0) / lengthSquared;
      return Math.hypot(...delta.map((v, i) => v - line[i] * t));
    }));
    assert.ok(deviation > .05, 'approach follows an arc, not a straight slide');
    const settled = motion.find(s => s.t > 2350);
    assert.ok(Math.hypot(...settled.pos.map((v, i) => v - end[i])) < .005, 'no drift after arrival');
    await page.evaluate(first => ifx.select(first, true), first);
    await page.waitForTimeout(150);
    await page.evaluate(next => ifx.select(next, true), next);
    await page.waitForTimeout(200);
    await page.setViewportSize({ width: 390, height: 844 }); // resize during the approach
    await page.waitForTimeout(2300);
    assert.equal(await page.evaluate(() => ifx.state.selected), next);
    const resized = await page.evaluate(() => {
      const b = ifx.built[ifx.state.scene], h = b.dataHotspots[ifx.state.selected];
      return { focus: new ifx.THREE.Vector3(...h.pos).project(ifx.camera).toArray(), distance: ifx.camera.position.distanceTo(ifx.controls.target) };
    });
    assert.ok(Math.abs(resized.focus[0]) < .82 && Math.abs(resized.focus[1]) < .82 && resized.distance < 9, 'resize retains component framing');
    const landingError = await page.evaluate(() => {
      const landed = ifx.camera.position.clone();
      ifx.select(ifx.state.selected, true); ifx.settle();
      return landed.distanceTo(ifx.camera.position);
    });
    assert.ok(landingError < .01, 'a resize in flight lands on the responsive preset');
    if (scene !== 6) {
      const names = await page.locator('#link-view option').evaluateAll(options => options.map(option => option.value).filter(Boolean));
      for (const name of names) {
        await page.locator('#link-view').selectOption(name);
        await page.evaluate(() => ifx.settle());
        const named = await page.evaluate(() => ({ name: ifx.state.selected, distance: ifx.camera.position.distanceTo(ifx.controls.target) }));
        assert.equal(named.name, name);
        assert.ok(named.distance < 9, `named preset ${name} stays close`);
      }
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    console.log(`ok scene ${scene}: curved approach, settles, rapid reselection, phone resize and named presets`);
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
