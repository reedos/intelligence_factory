// Render a hero image from the 3D scenes on the real GPU: the view alone, full frame, no pins or overlays,
// then encode it in the page as WebP. Usage:
//   node tools/hero.mjs name scene [layer] [--w 2880] [--h 1620] [--cam px,py,pz,tx,ty,tz] [--q 0.86] [--part id]
// Writes public/hero/<name>.webp (and shots/hero-<name>.png to look at). URL env picks the page.
import { createRequire } from 'module';
import { writeFileSync, mkdirSync } from 'fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const [name, scene = '1', mode = 'power'] = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
const W = +opt('w', 2880), H = +opt('h', 1620), Q = +opt('q', 0.86), cam = opt('cam', ''), part = opt('part', '');

const b = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const errors = []; p.on('pageerror', e => errors.push(e.message));
await p.goto(process.env.URL || 'http://127.0.0.1:47400/');
await p.waitForFunction(() => window.ifx && ifx.state.scene === 0, null, { timeout: 90000 });
// the viewer fills the window; everything drawn over the scene goes away
await p.addStyleTag({ content: `
  .viewer { position: fixed !important; inset: 0 !important; height: 100vh !important; z-index: 1000; }
  .view { height: 100vh !important; flex: 1 1 auto !important; }
  .pins, .hud, .hud-btns, .veil, .toast, #clock { display: none !important; }` });
await p.evaluate(async ([sc, mode, part, cam]) => {
  document.querySelector('.view').scrollIntoView();
  await ifx.show({ scene: +sc, mode, part: part || null }, { scroll: false });
  ifx.settle();
  if (cam) {
    const [px, py, pz, tx, ty, tz] = cam.split(',').map(Number);
    ifx.camera.position.set(px, py, pz); ifx.controls.target.set(tx, ty, tz); ifx.controls.update();
  }
}, [scene, mode, part, cam]);
await p.waitForTimeout(3500);                        // flows settle, bloom and AO converge
const png = await p.screenshot({ type: 'png' });
mkdirSync('shots', { recursive: true }); writeFileSync(`shots/hero-${name}.png`, png);
// encode in the page: Chrome's canvas WebP encoder, no image library needed
const webp = await p.evaluate(async ([b64, q]) => {
  const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d').drawImage(img, 0, 0);
  const blob = await new Promise(r => c.toBlob(r, 'image/webp', q));
  const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}, [png.toString('base64'), Q]);
mkdirSync('public/hero', { recursive: true });
writeFileSync(`public/hero/${name}.webp`, Buffer.from(webp, 'base64'));
const cam2 = await p.evaluate(() => [...ifx.camera.position.toArray(), ...ifx.controls.target.toArray()].map(v => +v.toFixed(2)).join(','));
console.log(`public/hero/${name}.webp ${Math.round(Buffer.from(webp, 'base64').length / 1024)} KB · camera ${cam2}`);
console.log(errors.length ? errors.join(' | ') : 'no page errors');
await b.close();
