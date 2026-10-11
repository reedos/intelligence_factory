// Product lighting scaled to each teaching scene. All physical materials belong
// to the cloned Blender hardware; signal emission and semantic colors survive.
import * as THREE from 'three';
import { attachFlowRibbons } from '../flow-ribbons.js';

const PROFILES = {
  3: { target: [0, 1.05, 0], span: 2.2, bloom: .34, ao: .12 },
  4: { target: [0, .5, -.5], span: 7, bloom: .38, ao: .12 },
  5: { target: [0, 2.3, 0], span: 8, bloom: .36, ao: .1 },
};

export function applyComputeArtDirection({ built, level, quality = {}, matched = false }) {
  const p = PROFILES[level];
  if (!p || !built.scene.userData.blenderCompute) return;
  const restrained = { glow: 4.4, brightness: 2.65, haloOpacity: .28 };
  // Package data streams run on top of emissive silicon at close range: a
  // slightly thinner, dimmer halo keeps the die readable while the streams
  // still glow (set halfway between the original look and the restrained one).
  const packageData = { width: 2.35, glow: 4.35, brightness: 2.5, haloOpacity: .28 };
  attachFlowRibbons(built, { width: level === 3 ? 2.8 : 2.5, glow: level === 3 ? 6.5 : 5.5,
    brightness: 3.1, mobile: quality.mobile,
    layers: level === 4 ? { flows: restrained, dataFlows: restrained } : level === 5 ? { heatFlows: restrained, dataFlows: packageData } : {} });
  if (level === 3 && built.camera?.portrait) {
    // Round-2 review (10/11/2026): the cabinet, not the busway, fills the frame - about 60% of the view's height, the
    // overhead busway cropped at the top. Same viewing direction as compute-framing.js, a lower pivot, closer in.
    const dir = new THREE.Vector3(2.8, 1.2, 3.42).normalize(), target = [-0.05, 1.3, 0.3];
    const at = d => target.map((v, i) => v + dir.getComponent(i) * d);
    built.camera = { ...built.camera, pos: at(6.2), target, portrait: { ...built.camera.portrait, pos: at(5.1), target } };
    // Data: the copper NVLink spine is on the cabinet's rear face, so the data layer looks from behind and to the right,
    // where the scale-up (pink) cartridges the intro leads with are in plain view, not hidden behind the cabinet.
    const back = new THREE.Vector3(3.2, 1.3, -2.6).normalize(), behind = d => target.map((v, i) => v + back.getComponent(i) * d);
    built.cameraByMode = { ...built.cameraByMode, data: { pos: behind(6.2), target, portrait: { ...built.camera.portrait, pos: behind(5.1), target } } };
  }
  if (level === 3) {
    // The studio floor takes no cast shadow: the cabinet's shadow stretched toward the camera read as a black wedge, a
    // plinth under the rack (round-2 review). The floor keeps its reflection and its fade into the dark.
    const size = new THREE.Vector3(), box = new THREE.Box3();
    built.scene.traverse(o => {
      if (!o.isMesh || o.isReflector) return;
      box.setFromObject(o).getSize(size);
      if (size.x > 8 && size.z > 8 && size.y < .05) o.receiveShadow = false;
    });
  }
  if (matched) return;
  const scene = built.scene, center = new THREE.Vector3(...p.target);
  const hemisphere = scene.children.find(o => o.isHemisphereLight);
  if (hemisphere) {
    hemisphere.color.set(0xcbd6e6); hemisphere.groundColor.set(0x171e27);
    // The rack is mostly dark graphite: a little more sky and rim keeps its
    // closed faces legible without lifting the emissive flows.
    hemisphere.intensity = level === 3 ? .92 : .64;
  }
  const lights = scene.children.filter(o => o.isDirectionalLight && !o.userData.computeStudioFill);
  [[lights[0], [-.65, 1.2, .8], 0xfff4e6, 2.15], [lights[1], [.7, .9, -.85], 0xa9c9f5, level === 3 ? 1.75 : 1.35]].forEach(([light, offset, color, intensity]) => {
    if (!light) return;
    light.color.set(color); light.intensity = intensity;
    light.position.copy(center).addScaledVector(new THREE.Vector3(offset[0], offset[1], offset[2]), p.span);
    light.target.position.copy(center);
    if (!light.target.parent) scene.add(light.target);
  });
  if (lights[0]) {
    lights[0].shadow.normalBias = p.span * .0005;
    lights[0].shadow.bias = -.00015;
  }
  let fill = scene.children.find(o => o.userData.computeStudioFill);
  if (!fill) {
    fill = new THREE.DirectionalLight(0xd7e5f3, level === 3 ? 1.15 : .42);
    fill.name = 'Compute studio front fill'; fill.userData.computeStudioFill = true;
    fill.position.copy(center).addScaledVector(new THREE.Vector3(.8, .3, 1), p.span);
    fill.target.position.copy(center); fill.castShadow = false;
    scene.add(fill, fill.target);
  }
  scene.background = new THREE.Color(0x070b12);
  built.look = { ...built.look, env: 'studio', envIntensity: quality.mobile ? (level === 3 ? .78 : .65) : level === 3 ? 1.12 : .82,
    // Level 4: a higher threshold keeps the key light's reflections in the satin tray metal out of the bloom,
    // so power and data can bloom closer to heat without the rails and lids clipping to white.
    exposure: 1, bloom: quality.mobile ? .33 : .44, threshold: level === 4 ? 1.6 : 1.25, ao: p.ao,
    bloomByMode: level === 5 ? { heat: quality.mobile ? .20 : .26, data: quality.mobile ? .255 : .33, power: quality.mobile ? .24 : .3 }
      : level === 4 ? { power: quality.mobile ? .3 : .4, data: quality.mobile ? .3 : .4 } : undefined,
    grain: .004, vignette: .17, dof: !quality.mobile && quality.dof !== false };
  scene.userData.computeArtDirection = 'studio-streams-v2';
  // Keep the polished enclosure treatment while restoring conspicuous moving
  // energy/data cores. Spacing limits prevent dense busbars becoming solid neon.
  for (const list of [built.flows, built.dataFlows, built.heatFlows]) {
    for (const f of list || []) {
      const rackExhaust = level === 3 && f.cls === 'air';
      const packageHeat = level === 5 && list === built.heatFlows;
      const packageSignals = level === 5 && list === built.dataFlows;
      const traySignals = level === 4 && list !== built.heatFlows;
      f.setMotionStyle({ density: 1.8, brightness: rackExhaust ? .85 : packageHeat ? 1.15 : packageSignals ? 1.5 : traySignals ? 1.45 : 1.9,
        radius: rackExhaust ? .55 : 1.15, pixels: rackExhaust ? .75 : quality.mobile ? 1.25 : 1.15,
        stretch: rackExhaust ? 3.2 : 2.6 });
    }
  }
}
