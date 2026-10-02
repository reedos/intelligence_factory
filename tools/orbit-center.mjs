// Gate: after a level overview settles, controls.target (the orbit pivot) must sit close to the
// bounding-box centre of that level's hardware, not at a hand-placed point beside it. Reed's report
// (2026-10-02): "on the overview of the GB compute tray, the centre of focus when moving the camera
// around is not actually the centre of the tray" - orbiting swung around an off-centre point.
//
// The "main assembly" bbox is approximated the same way the fix was derived (see compute-framing.js,
// hall.js, campus.js, side-cpo.js/side-cpo-blender.js): the union of visible mesh bounds, excluding
//   - InstancedMesh (fan rotors, status LEDs, repeated rack units: their own geometry/template bbox
//     is a local placeholder, not the instances' world positions)
//   - decorative/background names (sky, ground, reflector, studio surround, labels, flow ribbons, ...)
//   - any individual mesh whose own bbox exceeds the scene's own orbit `max` (a backdrop/cove, not hardware)
//   - anything whose bbox centre lies further than `max` from the current target (a long outlier
//     leaving the frame: a transmission line, a fiber run, an off-campus substation)
// Tolerance: 3% of the hardware's own largest bbox dimension for every level that has a real,
// measurable hardware assembly (rack, tray, chip, cpo, hall) - tight enough that the ~20% miss Reed
// reported on the GB tray would fail it. Campus keeps a looser 15%-of-orbit-`max` tolerance: its
// "main assembly" is the authored campusOverviewBounds point set below, which does not reduce to a
// single clean "largest dimension" the way a mesh-bbox union does, and 0 (across.js) is out of scope
// entirely - its camera aims at a scenario-chosen grid location, not a fixed assembly.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const EXCLUDE = /flow|ribbon|sky|ridgeline|meadow|pavement|curb|woodland|ground|halo|caption|^line$|^linesegments$|^points$|^sprite$|reflector|lettering|nameplate|hazard|stencil|marker|signs?$|bench|studio surround|fiber vault/i;

async function bboxInfo(page, EXCLUDE_SRC) {
  return page.evaluate((EXCLUDE_SRC) => {
    const b = ifx.built[ifx.state.scene]; b.scene.updateMatrixWorld(true);
    const THREE = ifx.THREE, EXCLUDE = new RegExp(EXCLUDE_SRC, 'i');
    // campus.js authors its own "main assembly" as the compound's modeled footprint (its own comment:
    // "Campus compound and all modeled halls; off-campus transmission approach has its own detail
    // view"). Use that bound directly instead of the generic mesh walk below, which otherwise unions in
    // the substation and the transmission line reaching toward the horizon - real geometry, but exactly
    // the kind of long, leaving-the-frame outlier the generic walk is meant to exclude.
    const authored = b.scene.userData.campusOverviewBounds;
    if (authored) {
      const box = new THREE.Box3();
      for (const p of authored.points) box.expandByPoint(new THREE.Vector3(...p));
      const center = new THREE.Vector3(), size = new THREE.Vector3();
      box.getCenter(center); box.getSize(size);
      return { center: center.toArray(), size: size.toArray(), max: b.camera.max || 1e9, kept: authored.points.length, authored: true };
    }
    const anchor = ifx.controls.target.clone(), radius = (b.camera.max || 1e9);
    const whole = new THREE.Box3(); let kept = 0;
    b.scene.traverse(o => {
      if (!o.isMesh || o.isSprite || o.isInstancedMesh) return;
      if (EXCLUDE.test(o.name)) return;
      for (let p = o; p; p = p.parent) if (!p.visible || EXCLUDE.test(p.name || '')) return;
      o.geometry.computeBoundingBox();
      const bb = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
      if (!isFinite(bb.min.x)) return;
      const size = new THREE.Vector3(); bb.getSize(size);
      if (Math.max(size.x, size.y, size.z) > radius) return;
      const c = bb.getCenter(new THREE.Vector3());
      if (c.distanceTo(anchor) > radius) return;
      whole.union(bb); kept++;
    });
    if (whole.isEmpty()) return null;
    const center = new THREE.Vector3(), size = new THREE.Vector3();
    whole.getCenter(center); whole.getSize(size);
    return { center: center.toArray(), size: size.toArray(), max: radius, kept, authored: false };
  }, EXCLUDE_SRC);
}

async function run(page, { url, label }) {
  await page.goto(url);
  await page.waitForFunction(() => window.ifx?.state.scene === 0);
  await page.evaluate(() => ifx.setTransitions('instant'));
  // Wait for N consecutive animation frames where the camera is unchanged, instead of a flat
  // wall-clock delay (the same approach as tools/views.mjs, 7dca82b): ifx.settle() snaps the camera
  // synchronously, but a scenario/variant switch rebuilds the scene and schedules its own arrival
  // tween, which a fixed setTimeout can still be mid-flight through under GPU load. Counting frames
  // instead of milliseconds is what caught the tray(gb200) miss as resource-contention noise, not a
  // real bug: under swiftshader with another heavy job running, a flat 150-400ms wait wasn't enough.
  await page.evaluate(() => {
    window.stable = ({ want = 3, maxFrames = 300 } = {}) => new Promise(resolve => {
      let prev = null, run = 0, frames = 0;
      const tick = () => {
        frames++;
        const cam = ifx.camera, pos = cam.position, q = cam.quaternion, t = ifx.controls.target;
        const cur = [pos.x, pos.y, pos.z, q.x, q.y, q.z, q.w, t.x, t.y, t.z].join(',');
        run = prev === cur ? run + 1 : 0;
        prev = cur;
        if (run >= want || frames >= maxFrames) resolve({ frames, run }); else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  });

  // scene -> level name. 0 (across) and 6/8/9 (module, coherent, copper) are intentionally excluded:
  // 0's camera aims at a scenario-chosen grid location, not a fixed assembly, and 6/8/9 already orbit
  // a live housingBounds fit (side-module-blender.js, side-links-blender.js) computed the same way -
  // there is no hand-placed target left there to regress.
  const LEVELS = { 1: 'campus', 2: 'hall', 3: 'rack', 4: 'tray', 5: 'chip', 7: 'cpo' };
  const accelsFor = scene => scene === 3 ? ['gb200', 'h100'] : scene === 4 || scene === 5 ? ['gb200', 'gb300', 'h100', 'rubin'] : [undefined];
  const variantsFor = scene => scene === 7 ? ['ring', 'mzm'] : [undefined];

  for (const [sceneStr, name] of Object.entries(LEVELS)) {
    const scene = Number(sceneStr);
    for (const accel of accelsFor(scene)) {
      if (accel) {
        await page.evaluate(accel => ifx.setScenario({ accel }), accel);
        await page.evaluate(async (scene) => { await ifx.show({ scene, mode: 'power', part: null }, { scroll: false }); ifx.settle(); }, scene);
        await page.evaluate(() => window.stable());
      }
      for (const variant of variantsFor(scene)) {
        if (variant) {
          await page.evaluate(v => ifx.setCpoVariant(v), variant);
          await page.evaluate(() => ifx.settle());
          await page.evaluate(() => window.stable());
        }
        await page.evaluate(async (scene) => { await ifx.show({ scene, mode: 'power', part: null }, { scroll: false }); ifx.settle(); }, scene);
        await page.evaluate(() => window.stable());
        const info = await bboxInfo(page, EXCLUDE.source);
        const tag = `${label} ${name}${accel ? ` (${accel})` : ''}${variant ? ` [${variant}]` : ''}`;
        assert.ok(info, `${tag}: no hardware mesh found to measure`);
        const target = await page.evaluate(() => ifx.controls.target.toArray());
        const d = Math.hypot(...target.map((v, i) => v - info.center[i]));
        const tol = info.authored ? Math.max(0.15 * info.max, 0.02) : Math.max(0.03 * Math.max(...info.size), 0.01);
        assert.ok(d <= tol, `${tag}: orbit target ${JSON.stringify(target)} is ${d.toFixed(3)} from the hardware's bbox centre ${JSON.stringify(info.center.map(v => +v.toFixed(3)))} (tolerance ${tol.toFixed(3)}, kept ${info.kept} meshes)`);
        console.log(`ok ${tag}: orbit target within ${d.toFixed(3)} of bbox centre (tolerance ${tol.toFixed(3)})`);
      }
    }
  }
}

const browser = await chromium.launch({ args: process.env.IFX_GATE_GPU === '1'
  ? ['--use-angle=d3d11', '--ignore-gpu-blocklist']
  : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const base = process.env.URL || 'http://127.0.0.1:47410/visualizer.html';
  const errors = [];
  for (const [label, url] of [['default', base], ['native', `${base}${base.includes('?') ? '&' : '?'}module=native`]]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    page.on('pageerror', e => errors.push(`${label}: ${e.message}`));
    await run(page, { url, label });
    await page.close();
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
