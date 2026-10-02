// Gate: after a level overview settles, controls.target (the orbit pivot) must sit close to the
// bounding-box centre of that level's hardware, not at a hand-placed point beside it. Reed's report
// (2026-10-02): "on the overview of the GB compute tray, the centre of focus when moving the camera
// around is not actually the centre of the tray" - orbiting swung around an off-centre point.
//
// The "main assembly" bbox is approximated the same way the fix was derived (see compute-framing.js,
// hall.js, campus.js, side-cpo-blender.js): the union of visible mesh bounds, excluding
//   - InstancedMesh (fan rotors, status LEDs, repeated rack units: their own geometry/template bbox
//     is a local placeholder, not the instances' world positions)
//   - decorative/background names (sky, ground, reflector, studio surround, labels, flow ribbons, ...)
//   - any individual mesh whose own bbox exceeds the scene's own orbit `max` (a backdrop/cove, not hardware)
//   - anything whose bbox centre lies further than `max` from the current target (a long outlier
//     leaving the frame: a transmission line, a fiber run, an off-campus substation)
// Tolerance is 15% of the scene's own orbit `max` (its designed zoom-out limit), which scales
// naturally across the tray's 10 cm units, the rack's metres and the hall's tens of metres.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const EXCLUDE = /flow|ribbon|sky|ridgeline|meadow|pavement|curb|woodland|ground|halo|caption|^line$|^linesegments$|^points$|^sprite$|reflector|lettering|nameplate|hazard|stencil|marker|signs?$|bench|studio surround|fiber vault/i;

async function bboxCenter(page, EXCLUDE_SRC) {
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
      const center = new THREE.Vector3(); box.getCenter(center);
      return { center: center.toArray(), max: b.camera.max || 1e9, kept: authored.points.length };
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
    const center = new THREE.Vector3(); whole.getCenter(center);
    return { center: center.toArray(), max: radius, kept };
  }, EXCLUDE_SRC);
}

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

  // scene -> level name, for messages. 0 (across) and 6/8/9 (module, coherent, copper) are intentionally
  // excluded: 0's camera aims at a scenario-chosen grid location, not a fixed assembly, and 6/8/9 already
  // orbit a live housingBounds fit (side-module-blender.js, side-links-blender.js) computed the same way.
  const LEVELS = { 1: 'campus', 2: 'hall', 3: 'rack', 4: 'tray', 5: 'chip', 7: 'cpo' };
  const accelsFor = scene => scene === 3 ? ['gb200', 'h100'] : scene === 4 ? ['gb200', 'h100', 'rubin'] : [undefined];

  for (const [sceneStr, name] of Object.entries(LEVELS)) {
    const scene = Number(sceneStr);
    for (const accel of accelsFor(scene)) {
      if (accel) { await page.evaluate(accel => ifx.setScenario({ accel }), accel); await page.waitForTimeout(400); }
      await page.evaluate(async (scene) => { await ifx.show({ scene, mode: 'power', part: null }, { scroll: false }); ifx.settle(); }, scene);
      await page.waitForTimeout(150);
      const info = await bboxCenter(page, EXCLUDE.source);
      assert.ok(info, `${name}${accel ? ` (${accel})` : ''}: no hardware mesh found to measure`);
      const target = await page.evaluate(() => ifx.controls.target.toArray());
      const d = Math.hypot(...target.map((v, i) => v - info.center[i]));
      const tol = Math.max(0.15 * info.max, 0.02);
      assert.ok(d <= tol, `${name}${accel ? ` (${accel})` : ''}: orbit target ${JSON.stringify(target)} is ${d.toFixed(3)} from the hardware's bbox centre ${JSON.stringify(info.center.map(v => +v.toFixed(3)))} (tolerance ${tol.toFixed(3)}, kept ${info.kept} meshes)`);
      console.log(`ok ${name}${accel ? ` (${accel})` : ''}: orbit target within ${d.toFixed(3)} of bbox centre (tolerance ${tol.toFixed(3)})`);
    }
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
