// Screen-width engineering overlays on exact existing Flow paths. Two batched
// draws per layer, independent of route count. These are explanatory graphics,
// not newly modeled wires/pipes; opaque hardware still occludes them.
import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

function material({ width, brightness, dashed, opacity }) {
  const m = new LineMaterial({ color: new THREE.Color().setScalar(brightness),
    linewidth: width, vertexColors: true, dashed, dashSize: .36, gapSize: .64,
    transparent: true, opacity, depthTest: true, depthWrite: false,
    toneMapped: false, fog: false });
  m.onBeforeCompile = shader => {
    shader.vertexShader = `attribute float instanceFlowPhase;\nattribute float instanceFlowAlpha;\nvarying float vFlowAlpha;\n${shader.vertexShader}`
      .replace('void main() {', 'void main() { vFlowAlpha = instanceFlowAlpha;')
      .replace('dashScale * instanceDistanceStart : dashScale * instanceDistanceEnd;',
        'dashScale * instanceDistanceStart + instanceFlowPhase : dashScale * instanceDistanceEnd + instanceFlowPhase;');
    shader.fragmentShader = `varying float vFlowAlpha;\n${shader.fragmentShader}`
      .replace('gl_FragColor = vec4( diffuseColor.rgb, alpha );',
        `alpha *= vFlowAlpha; ${dashed
          ? 'float pulseHead = pow(max(0.0, 1.0 - abs(fract(vLineDistance + dashOffset) - 0.28) / 0.10), 2.0); diffuseColor.rgb *= 1.0 + 1.2 * pulseHead;'
          : 'alpha *= 0.2 + 0.8 * pow(max(0.0, 1.0 - abs(vUv.x)), 2.0);'}\nif (alpha < 0.002) discard;\ngl_FragColor = vec4( diffuseColor.rgb, alpha );`);
  };
  m.customProgramCacheKey = () => `ifx-flow-ribbon-v2-${dashed}`;
  return m;
}

function visible(flow) {
  if (!flow.mesh.visible || flow.gain <= .02) return false;
  for (let node = flow.group; node; node = node.parent) if (!node.visible) return false;
  return true;
}

export function attachFlowRibbons(built, { width = 2.3, glow = 5.5, brightness = 2.6, mobile = false, layers = {} } = {}) {
  if (built.flowRibbons) return built.flowRibbons;
  const root = new THREE.Group(); root.name = 'Exact-route flow ribbons';
  root.userData.runtimeOverlay = true;
  const batches = [];
  for (const key of ['flows', 'dataFlows', 'heatFlows']) {
    const layer = { width, glow, brightness, haloOpacity: .4, ...layers[key] };
    const entries = [], positions = [], colors = [], distances = [];
    for (const flow of built[key] || []) {
      if (!flow.path?.curves.length || !(flow.len > 0)) continue;
      const start = positions.length / 6;
      const c = flow.base.color.clone(); c.multiplyScalar(1 / Math.max(c.r, c.g, c.b, .001));
      c.multiplyScalar(flow.ribbonIntensity ?? 1);
      // Denser luminous packets communicate activity, not physical lane counts.
      const cycles = Math.min(20, Math.max(3, (flow.ribbonCount ?? flow.count) / 2));
      const period = flow.len / cycles;
      let distance = 0;
      for (const curve of flow.path.curves) {
        const a = curve.getPoint(0), b = curve.getPoint(1), length = a.distanceTo(b);
        if (length < 1e-9) continue;
        positions.push(...a.toArray(), ...b.toArray());
        colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
        distances.push(distance / period, (distance + length) / period); distance += length;
      }
      entries.push({ flow, start, end: positions.length / 6, period, matrix: null });
    }
    if (!positions.length) continue;
    const geometry = new LineSegmentsGeometry().setPositions(positions).setColors(colors);
    const n = positions.length / 6;
    const dist = new THREE.InstancedInterleavedBuffer(new Float32Array(distances), 2);
    geometry.setAttribute('instanceDistanceStart', new THREE.InterleavedBufferAttribute(dist, 1, 0));
    geometry.setAttribute('instanceDistanceEnd', new THREE.InterleavedBufferAttribute(dist, 1, 1));
    const phase = new THREE.InstancedBufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage);
    const alpha = new THREE.InstancedBufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('instanceFlowPhase', phase); geometry.setAttribute('instanceFlowAlpha', alpha);
    const group = new THREE.Group(); group.name = `Flow ribbons ${key}`;
    for (const dashed of [false, true]) {
      const line = new LineSegments2(geometry, material({ width: (dashed ? layer.width : layer.glow * .7) * (mobile ? .85 : 1),
        brightness: dashed ? layer.brightness * 1.25 : layer.brightness * .5, dashed, opacity: dashed ? .98 : layer.haloOpacity * .8 }));
      line.name = dashed ? 'Moving route dashes' : 'Continuous route halo';
      line.frustumCulled = false; line.renderOrder = dashed ? 2 : 1; group.add(line);
    }
    root.add(group); batches.push({ key, group, entries, geometry, phase, alpha, sourcePositions: new Float32Array(positions) });
  }
  built.scene.add(root);
  const sceneInverse = new THREE.Matrix4(), relative = new THREE.Matrix4(), point = new THREE.Vector3();
  const update = () => {
    built.scene.updateWorldMatrix(true, false);
    sceneInverse.copy(built.scene.matrixWorld).invert();
    for (const batch of batches) {
      let any = false;
      let geometryChanged = false;
      const starts = batch.geometry.getAttribute('instanceStart'), ends = batch.geometry.getAttribute('instanceEnd');
      for (const entry of batch.entries) {
        const { flow, start, end, period } = entry;
        // Paths are local to their Flow group (e.g. an exploded module board).
        // Only changed transforms rewrite the shared position buffer. Phase uses
        // local arc distance, so uniform scaling preserves the source clock.
        flow.group.updateWorldMatrix(true, false);
        relative.multiplyMatrices(sceneInverse, flow.group.matrixWorld);
        if (!entry.matrix || !entry.matrix.equals(relative)) {
          entry.matrix ||= new THREE.Matrix4(); entry.matrix.copy(relative);
          for (let i = start; i < end; i++) {
            point.fromArray(batch.sourcePositions, i * 6).applyMatrix4(relative); starts.setXYZ(i, point.x, point.y, point.z);
            point.fromArray(batch.sourcePositions, i * 6 + 3).applyMatrix4(relative); ends.setXYZ(i, point.x, point.y, point.z);
          }
          geometryChanged = true;
        }
        const on = visible(flow), value = on ? Math.min(1, Math.max(0, flow.bright * (flow.base.opacity ?? 1))) : 0;
        any ||= on;
        // Modulo keeps GPU floats precise on long-running presentation clocks.
        // Accelerated explanatory motion still pauses/slows with the source
        // clock. The moving head flashes locally; there is no global strobe.
        const p = -((flow.acc * 1.6 / period + flow.phase) % 1);
        for (let i = start; i < end; i++) { batch.phase.setX(i, p); batch.alpha.setX(i, value); }
      }
      if (geometryChanged) { starts.needsUpdate = true; ends.needsUpdate = true; }
      batch.group.visible = any; batch.phase.needsUpdate = batch.alpha.needsUpdate = true;
    }
  };
  const previousUpdate = built.update;
  built.update = (...args) => { const result = previousUpdate?.(...args); update(); return result; };
  const previousDispose = built.dispose;
  built.dispose = () => { previousDispose?.(); for (const b of batches) { b.geometry.dispose(); b.group.children.forEach(o => o.material.dispose()); } root.removeFromParent(); };
  const effect = { root, batches, update, drawCallsPerVisibleLayer: 2,
    setQuality({ halo = true } = {}) {
      for (const batch of batches) batch.group.children[0].visible = halo;
      this.drawCallsPerVisibleLayer = halo ? 2 : 1;
    },
  };
  built.flowRibbons = effect; update(); return effect;
}
