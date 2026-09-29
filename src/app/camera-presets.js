// Fit named inspection views to the drawing canvas, never the physical screen.
// minScale limits horizontal fitting when a short canvas becomes height-limited.
export function cameraPresetFor(c, width, height) {
  const aspect = width / Math.max(1, height);
  const preset = (width < 600 || aspect < .9) && c.portrait ? c.portrait
    : aspect < 1.5 && c.compact ? c.compact : c;
  if (!preset.fit) return preset;
  const { aspect: referenceAspect = 1, fov: referenceFov = 35, minScale = .5 } = preset.fit;
  const fov = aspect < .9 ? 48 : 35;
  const scale = Math.tan(referenceFov * Math.PI / 360) / Math.tan(fov * Math.PI / 360)
    * Math.max(referenceAspect / aspect, minScale);
  return { ...preset, pos: preset.pos.map((v, i) => preset.target[i] + (v - preset.target[i]) * scale) };
}
