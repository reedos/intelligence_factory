// Normal/depth overrides cannot reproduce shader-shaped ribbons, sprites, or
// transparent teaching layers. Their backing geometry must never masquerade
// as a solid surface. The color pass still draws every overlay normally.
export function withHardwareDepth(scene, render) {
  const hidden = [], override = scene.overrideMaterial;
  scene.traverse(object => {
    if (!object.visible) return;
    const materials = object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : [];
    if (object.isPoints || object.isLine || object.isLine2 || object.isLineSegments2 ||
      object.isSprite || object.isReflector || object.userData.runtimeOverlay ||
      (materials.length && materials.every(m => m.visible === false || m.depthWrite === false))) {
      hidden.push(object);
      object.visible = false;
    }
  });
  try { return render(); }
  finally {
    scene.overrideMaterial = override;
    for (const object of hidden) object.visible = true;
  }
}
