// Flicker probe: with animation hidden, nudge the camera a hair and count pixels that change sharply.
// Z-fighting shows up as speckle; a clean render changes only along edges.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
const diffPage = await b.newPage();
await p.goto(process.env.URL || 'http://127.0.0.1:47400/');
await p.waitForFunction(() => window.ifx && window.ifx.state.scene === 0, null, { timeout: 90000 });

async function diff(a, c) {
  return diffPage.evaluate(async ([a, c]) => {
    const load = async s => { const im = await createImageBitmap(await (await fetch('data:image/png;base64,' + s)).blob()); const cv = new OffscreenCanvas(im.width, im.height); const g = cv.getContext('2d'); g.drawImage(im, 0, 0); load.w = im.width; return g.getImageData(0, 0, im.width, im.height).data; };
    const A = await load(a), C = await load(c); let n = 0;
    const W = load.w, H = A.length / 4 / W, cv = new OffscreenCanvas(W, H), g = cv.getContext('2d'), img = g.createImageData(W, H);
    for (let i = 0; i < A.length; i += 4) { const f = Math.abs(A[i] - C[i]) + Math.abs(A[i + 1] - C[i + 1]) + Math.abs(A[i + 2] - C[i + 2]) > 90; if (f) n++; img.data[i] = f ? 255 : A[i] * 0.35; img.data[i + 1] = f ? 40 : A[i + 1] * 0.35; img.data[i + 2] = f ? 40 : A[i + 2] * 0.35; img.data[i + 3] = 255; }
    g.putImageData(img, 0, 0); const bl = await cv.convertToBlob(); const r = new FileReader();
    const url = await new Promise(res => { r.onload = () => res(r.result); r.readAsDataURL(bl); });
    return [n / (A.length / 4), url];
  }, [a, c]);
}
const names = ['across', 'campus', 'hall', 'rack', 'tray', 'chip'];
for (const sc of [1, 2, 3, 4, 5]) {
  await p.evaluate(i => window.ifx.go(i), sc); await p.waitForFunction(i => window.ifx.state.scene === i, sc);
  await p.waitForTimeout(1200); await p.evaluate(() => window.ifx.settle());
  // freeze: hide animated flows and sprites
  await p.evaluate(() => { const b = window.ifx.built[window.ifx.state.scene]; [...(b.flows || []), ...(b.dataFlows || []), ...(b.heatFlows || [])].forEach(f => (f.group.visible = false)); window.ifx.controls.enableDamping = false; });
  const view = await p.$('#view');
  const out = [];
  for (const fixed of [false]) {
    await p.evaluate(f => { window.ifx.state.fixedNear = f; }, fixed);
    await p.waitForTimeout(800);
    const a = (await view.screenshot()).toString('base64');
    await p.evaluate(() => { const { camera, controls } = window.ifx; const o = camera.position.clone().sub(controls.target); o.applyAxisAngle({ x: 0, y: 1, z: 0, isVector3: true }, 0.0015); camera.position.copy(controls.target).add(o); });
    await p.waitForTimeout(800);
    const c = (await view.screenshot()).toString('base64');
    await p.evaluate(() => { const { camera, controls } = window.ifx; const o = camera.position.clone().sub(controls.target); o.applyAxisAngle({ x: 0, y: 1, z: 0, isVector3: true }, -0.0015); camera.position.copy(controls.target).add(o); });
    const [frac, url] = await diff(a, c);
    if (!fixed) (await import('fs')).writeFileSync(`flip-${names[sc]}.png`, Buffer.from(url.split(',')[1], 'base64'));
    out.push(`${fixed ? 'old fixed near' : 'fitted near'}: ${(frac * 100).toFixed(2)}% pixels flip`);
  }
  console.log(names[sc].padEnd(7), out.join('   '));
}
await b.close();
