import { Box3, PerspectiveCamera, Vector3 } from 'three';

// Snapshot the complete exploded hardware, including raised lids and release
// hardware. Animation ribbons, labels and the studio floor are not housing.
export function hardwareBounds(model) {
  model.updateWorldMatrix(true, true);
  const bounds = new Box3();
  model.traverse(object => {
    if (!object.isMesh) return;
    for (let parent = object; parent; parent = parent.parent) if (!parent.visible) return;
    object.geometry.computeBoundingBox();
    bounds.union(object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld));
  });
  return bounds;
}

// Preserve the chosen viewing direction, but retain the full enclosure as
// context in every automatic part view. Fit the actual canvas and HUD margins.
export function fitHousing(preset, bounds, width, height, safe = { x0: -.86, x1: .86, y0: -.82, y1: .82 }) {
  if (!bounds || bounds.isEmpty()) return preset;
  const aspect = width / Math.max(1, height);
  const camera = new PerspectiveCamera(aspect < .9 ? 48 : 35, aspect, .001, 10000);
  const direction = new Vector3().fromArray(preset.pos).sub(new Vector3().fromArray(preset.target)).normalize();
  // Shallow chip close-ups look through the raised lid and side walls. Keep an
  // elevated inspection angle while retaining the selected side's azimuth.
  if (direction.y < .72) { direction.y = 0; direction.normalize().multiplyScalar(Math.sqrt(1 - .72 ** 2)); direction.y = .72; }
  const center = bounds.getCenter(new Vector3());
  const corners = [];
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) corners.push(new Vector3(x, y, z));
  // Aim above/below the object when the page overlays leave an asymmetric area.
  const midX = (safe.x0 + safe.x1) / 2, midY = (safe.y0 + safe.y1) / 2;
  const tanY = Math.tan(camera.fov * Math.PI / 360);
  camera.position.copy(center).add(direction); camera.lookAt(center); camera.updateMatrixWorld();
  const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  let target;
  const place = distance => {
    target = center.clone().addScaledVector(right, -midX * distance * tanY * aspect).addScaledVector(up, -midY * distance * tanY);
    camera.position.copy(target).addScaledVector(direction, distance); camera.lookAt(target); camera.updateMatrixWorld();
    return corners.every(corner => {
      const p = corner.clone().project(camera);
      return p.z > -1 && p.z < 1 && p.x >= safe.x0 && p.x <= safe.x1 && p.y >= safe.y0 && p.y <= safe.y1;
    });
  };
  let low = 0, high = Math.max(1, bounds.getSize(new Vector3()).length());
  while (!place(high) && high < 10000) high *= 2;
  for (let i = 0; i < 32; i++) { const mid = (low + high) / 2; if (place(mid)) high = mid; else low = mid; }
  place(high * 1.015);
  return { ...preset, pos: camera.position.toArray(), target: target.toArray() };
}
