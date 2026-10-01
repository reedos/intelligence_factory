// Does any camera flight between parts pass through solid geometry? For every level and layer, fly from the overview
// to part 1, then from each part to the next in list order, the way a reader stepping down the parts list does; record
// the camera's position every frame of each flight, and raycast each step (one frame's position to the next) against
// the level's solid geometry: visible meshes that read as surfaces (not mostly transparent, not lines or additive
// glows or sky domes; a wide flow ribbon counts, depth or not: flying inside one fills the frame), less the surroundings
// (ground, ridgeline, studio floor: flat and as wide as the level) where the camera stays above them. A step that
// crosses one is a flight through a building. Mid-flight the camera must also keep a margin from surfaces (6% of its
// distance from the aim point, or of the end framings' if larger) and a clear view ahead (nothing solid in the first
// 25% of the way to the aim point for three frames running), both tapering to nothing at the two ends, whose framing
// is the part's own: skimming a roof two metres under a camera framing a building 40 m off, or a facade filling the
// frame, reads as flying through it (Reed, 09/30: campus data 1→2 and 2→3, hall data 11→12). The stage plans with a
// wider margin and a longer view. Pins and labels (HTML), sprites, particles and flow lines are not surfaces.
// Within 3% of the aim distance of the start or end framing, whatever is there belongs to that framing (a hall view
// that sits a centimetre from a hanging cable), not to the flight, whose ends are fixed: those steps are not counted.
// Usage: node tools/flights.mjs [desktop|phone]   (URL env for the page; IFX_GATE_GPU=1 for the real GPU;
//        ONLY=campus or ONLY=campus:data to run one level or one layer)
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const form = process.argv[2] || 'desktop';
const vp = form === 'phone' ? { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width: 1440, height: 900, deviceScaleFactor: 1 };
const gateArgs = process.env.IFX_GATE_GPU === '1'
  ? ['--use-angle=d3d11', '--ignore-gpu-blocklist']
  : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const b = await chromium.launch({ headless: true, args: gateArgs });
const p = await b.newPage({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.deviceScaleFactor, isMobile: vp.isMobile, hasTouch: vp.hasTouch });
const errors = []; p.on('pageerror', e => errors.push(e.message));
await p.goto(process.env.URL || 'http://127.0.0.1:47400/');
await p.waitForFunction(() => window.ifx && ifx.state.scene === 0, null, { timeout: 90000 });
await p.evaluate(() => { ifx.setTransitions('quick'); document.querySelector('.stage')?.scrollIntoView({ block: 'start' }); });

// one flight, measured in the page: start it, record every frame until the camera has been still a while, then test
// each recorded step against the solid set
const fly = async ({ id }) => {
  const T = ifx.THREE, st = ifx.state, B = ifx.built[st.scene], cam = ifx.camera;
  const frames = [cam.position.clone()], aims = [ifx.controls.target.clone()];
  const t0 = performance.now(), cs = ifx.clearance ? { ...ifx.clearance } : null;
  if (id) ifx.select(id, true);
  const selectMs = performance.now() - t0, ce = ifx.clearance;
  const plan = cs && { built: ce.finishedOnTap > cs.finishedOnTap ? ce.buildMs : null, planned: ce.plans > cs.plans ? ce.planMs : null, ready: ce.hits > cs.hits, clear: ce.clear, chosen: ce.chosen, costs: ce.costs };
  await new Promise(res => {
    let still = 0, n = 0;
    const tick = () => {
      const q = cam.position, last = frames[frames.length - 1];
      if (q.distanceTo(last) > 1e-7) { frames.push(q.clone()); aims.push(ifx.controls.target.clone()); still = 0; } else still++;
      if (++n > 900 || still > 20) res(); else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  ifx.settle();
  const shown = o => { for (let q = o; q; q = q.parent) if (!q.visible) return false; return true; };
  const solid = o => {
    if (!(o.isMesh || o.isInstancedMesh) || o.isSprite || o.isLine2 || o.isLineSegments2 || !shown(o)) return false;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    return mats.some(m => m && m.visible !== false && !m.isLineMaterial && m.side !== T.BackSide && m.blending !== T.AdditiveBlending && !(m.transparent && m.opacity < 0.6));
  };
  const all = []; B.scene.traverse(o => { if (solid(o)) all.push(o); });
  // the surroundings: flat and as wide as the level (terrain, ridgeline, studio floor), with the camera above them
  const span = new T.Box3(); all.forEach(o => span.expandByObject(o));
  const wide = Math.max(span.max.x - span.min.x, span.max.z - span.min.z);
  const lowest = Math.min(...frames.map(f => f.y));
  const box = new T.Box3(), size = new T.Vector3();
  const objs = all.filter(o => {
    box.setFromObject(o); box.getSize(size);
    const across = Math.max(size.x, size.z);
    return !(size.y < 0.02 * across && across >= 0.9 * wide && box.max.y <= lowest);
  });
  const ray = new T.Raycaster(), d = new T.Vector3(), side = new T.Vector3(), hits = [], n = frames.length - 1;
  ray.camera = cam;
  const name = o => o.name || o.parent?.name || o.type;
  // the end framings, the reach that belongs to each, and its distance from its aim point
  const home = [0, n].map(i => { const d = frames[i].distanceTo(aims[i]); return [frames[i], 0.03 * d, d]; });
  const atHome = q => home.some(([f, r]) => q.distanceTo(f) <= r);
  let blockedRun = 0;
  for (let k = 1; k <= n; k++) {
    if (atHome(frames[k - 1]) && atHome(frames[k])) continue;
    d.subVectors(frames[k], frames[k - 1]); const len = d.length(); if (len < 1e-9) continue;
    ray.set(frames[k - 1], d.normalize()); ray.near = 0; ray.far = len;
    let h = ray.intersectObjects(objs, false)[0];
    if (h) { hits.push({ frame: k, kind: 'through', what: name(h.object) }); continue; }
    const taper = Math.max(0, Math.min(Math.sin(Math.PI * (k - 1) / n), Math.sin(Math.PI * k / n))), D = Math.max(frames[k].distanceTo(aims[k]), home[0][2] + (home[1][2] - home[0][2]) * k / n);
    const r = 0.06 * D * taper;
    if (r <= 1e-6) continue;
    // nine probes around the camera: below, above, either side, the four diagonals between, and ahead-down
    side.set(-d.z, 0, d.x); if (side.lengthSq() < 1e-12) side.set(1, 0, 0); side.normalize();
    const dn = new T.Vector3(0, -1, 0), up = new T.Vector3(0, 1, 0), l = side.clone(), rt = side.clone().negate();
    const mix = (x, y) => x.clone().add(y).normalize();
    for (const dir of [dn, up, l, rt, mix(l, dn), mix(rt, dn), mix(l, up), mix(rt, up), mix(d, dn)]) {
      ray.set(frames[k], dir); ray.near = 0; ray.far = r;
      h = ray.intersectObjects(objs, false)[0];
      if (h) { hits.push({ frame: k, kind: `skims (${h.distance.toFixed(2)} of ${r.toFixed(2)} clear)`, what: name(h.object) }); break; }
    }
    if (h) { blockedRun = 0; continue; }
    // the view ahead, toward the aim point: blocked for three frames running (a thin pipe flicking past in one frame
    // is not a facade filling the view)
    const sight = 0.45 * D * taper;
    ray.set(frames[k], aims[k].clone().sub(frames[k]).normalize()); ray.near = 0; ray.far = sight;
    h = ray.intersectObjects(objs, false)[0];
    blockedRun = h ? blockedRun + 1 : 0;
    if (blockedRun === 3) hits.push({ frame: k, kind: `view blocked (${h.distance.toFixed(2)} ahead, of ${sight.toFixed(2)} clear)`, what: name(h.object) });
  }
  return { frames: frames.length, hits: hits.length, first: hits[0] || null, selectMs, plan };
};

const plan = await p.evaluate(() => ifx.store.C.SCENES.map((s, i) => ({ i, id: s.id })));
const only = process.env.ONLY ? process.env.ONLY.split(':') : null;
const fails = [], counts = [], selects = [], plans = [], builds = [];
let ready = 0;
for (const { i, id: level } of plan) {
  if (only && only[0] !== level) continue;
  for (const mode of ['power', 'data', 'heat']) {
    if (only?.[1] && only[1] !== mode) continue;
    await p.evaluate(async ({ i, mode }) => { await ifx.show({ scene: i, mode, part: null }, { scroll: false }); ifx.settle(); }, { i, mode });
    await p.waitForTimeout(400);
    // the level's clearance map builds in the background between frames; a reader's first tap may beat it (the map is
    // then finished on that tap, which the summary counts)
    await p.waitForFunction(() => !ifx.clearance?.pending, null, { timeout: 30000 }).catch(() => {});
    await p.evaluate(() => ifx.settle());
    const parts = await p.evaluate(() => [...document.querySelectorAll('#parts button[data-id]')].map(b => b.dataset.id));
    let from = 'overview', bad = 0;
    for (const id of parts) {
      await p.waitForTimeout(300);                       // a reader's pause between parts (plans ahead run then)
      const r = await p.evaluate(`(${fly})(${JSON.stringify({ id })})`);
      selects.push(r.selectMs);
      if (r.plan?.planned != null) plans.push(r.plan.planned);
      if (r.plan?.ready) ready++;
      if (r.plan?.built != null) builds.push(r.plan.built);
      if (r.hits) { bad++; fails.push(`${level}:${mode}:${from}→${id}  (${r.hits} of ${r.frames - 1} steps, first at frame ${r.first.frame} ${r.first.kind}: ${r.first.what}${r.plan && !r.plan.clear ? "; the planner found no clear path" : ""})`); if (process.env.DEBUG) fails.push(`    ${JSON.stringify(r.plan)}`); }
      from = id;
    }
    counts.push({ level, mode, flights: parts.length, bad });
  }
}
const byLevel = {};
for (const c of counts) { const l = byLevel[c.level] ||= { flights: 0, bad: 0 }; l.flights += c.flights; l.bad += c.bad; }
for (const [level, c] of Object.entries(byLevel)) console.log(`${level}: ${c.flights} flights, ${c.bad} through geometry`);
for (const f of fails) console.log(`  ${f}`);
const stat = a => (a.sort((x, y) => x - y), a.length ? `median ${a[a.length >> 1].toFixed(1)} ms, max ${a.at(-1).toFixed(1)} ms` : 'none');
console.log(`select, all of it: ${stat(selects)}; path planning on the tap: ${stat(plans)} (${plans.length} plans; ${ready} more planned ahead while idle); clearance map finished on a tap ${builds.length}x${builds.length ? ` (${stat(builds)})` : ''}`);
console.log(errors.length ? `errors: ${[...new Set(errors)].join(' | ')}` : 'no page errors');
console.log(`${form}: ${fails.length} flight${fails.length === 1 ? '' : 's'} through geometry`);
await b.close();
if (fails.length || errors.length) process.exitCode = 1;
