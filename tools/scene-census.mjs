// What a level's scene graph spends: meshes, instanced meshes, triangles, draw calls by top-level child, shadow casters,
// duplicated geometry. Usage: URL=http://127.0.0.1:<port>/visualizer.html node tools/scene-census.mjs [phone|desktop] [sceneIndex ...]
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const form = process.argv[2] || 'phone';
const idx = process.argv.slice(3).map(Number);
const vp = form === 'phone' ? { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true } : { width: 1440, height: 900, deviceScaleFactor: 1 };
const b = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.deviceScaleFactor, isMobile: vp.isMobile, hasTouch: vp.hasTouch });
await p.goto(process.env.URL);
await p.waitForFunction(() => window.ifx && ifx.state.scene === 0, null, { timeout: 90000 });
for (const sc of idx) {
  await p.evaluate(i => ifx.go(i), sc);
  await p.waitForFunction(i => ifx.state.scene === i && ifx.built[i], sc, { timeout: 90000 });
  await p.waitForTimeout(500);
  const r = await p.evaluate(i => {
    const root = ifx.built[i].scene, out = { meshes: 0, inst: 0, instCount: 0, tris: 0, casters: 0, transp: 0, lights: 0, geos: new Map(), groups: [] };
    const triOf = o => { const g = o.geometry; const n = g.index ? g.index.count : g.attributes.position.count; return n / 3 * (o.isInstancedMesh ? o.count : 1); };
    const walk = (o, acc) => {
      if (!o.visible) return;
      if (o.isLight) { out.lights++; }
      if (o.isMesh || o.isLine || o.isPoints) {
        const t = o.isMesh ? triOf(o) : 0; acc.t += t; acc.n++; acc.draw += 1;
        out.meshes++; out.tris += t; if (o.castShadow) out.casters++;
        if (o.isInstancedMesh) { out.inst++; out.instCount += o.count; }
        const m = Array.isArray(o.material) ? o.material[0] : o.material; if (m && m.transparent) out.transp++;
        const k = o.geometry.uuid; out.geos.set(k, (out.geos.get(k) || 0) + 1);
      }
      for (const c of o.children) walk(c, acc);
    };
    for (const c of root.children) { const acc = { t: 0, n: 0, draw: 0 }; walk(c, acc); out.groups.push({ name: c.name || c.type, ...acc }); }
    out.groups.sort((a, c) => c.t - a.t);
    out.sharedGeos = [...out.geos.values()].filter(v => v > 1).length; out.geoCount = out.geos.size; delete out.geos;
    out.groups = out.groups.slice(0, 12); return out;
  }, sc);
  console.log(`scene ${sc}:`, JSON.stringify({ ...r, groups: undefined }));
  for (const g of r.groups) console.log(`   ${String(g.name).padEnd(24)} meshes ${String(g.n).padStart(5)} tris ${String(Math.round(g.t / 1000)).padStart(6)}k`);
}
await b.close();
